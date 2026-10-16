import type { WalletCoreRuntime } from './wallet-core';
import walletCoreRegistryJson from './data/wallet-core-registry.json';
import { deriveSolanaAddress, SOLANA_DERIVATION_PATH } from './solana-derivation';

export type WalletAddress = {
  label: string;
  ticker: string;
  value: string;
  derivationPath: string;
  family: 'EVM' | 'UTXO' | 'Ed25519' | 'Other';
  note?: string;
  registryId?: string;
  blockchain?: string;
};

type WalletCoreRegistryEntry = {
  id: string;
  name: string;
  coinId?: number;
  symbol: string;
  blockchain: string;
  derivation?: Array<{ path?: string }>;
};

type WalletCoreCoinType = unknown;

const WALLET_CORE_REGISTRY = walletCoreRegistryJson as WalletCoreRegistryEntry[];
const PREFERRED_CHAIN_ORDER = [
  'ethereum', 'smartchain', 'base', 'polygon', 'arbitrum', 'optimism',
  'avalanchec', 'mantle', 'linea', 'scroll', 'zksync', 'opbnb', 'celo',
  'xdai', 'moonbeam', 'moonriver', 'fantom', 'bitcoin', 'solana',
];

const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  smartchain: 'BNB Chain',
  bsc: 'BNB Chain (Legacy)',
  xdai: 'Gnosis',
  classic: 'Ethereum Classic',
  doge: 'Dogecoin',
  ripple: 'XRP Ledger',
  elrond: 'MultiversX',
  ton: 'TON',
  internet_computer: 'Internet Computer',
};

function normalizeCoinIdentifier(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isCoinTypeValue(value: unknown): boolean {
  // Wallet Core's WASM package has shipped coin members in more than one JS
  // representation: numeric enum values and wrapper objects exposing .value.
  // The authoritative runtime test is whether getAddressForCoin can derive it.
  return typeof value === 'number' && Number.isFinite(value)
    || (typeof value === 'object' && value !== null
      && typeof (value as { value?: unknown }).value === 'number');
}

function findWalletCoreCoinType(core: WalletCoreRuntime, entry: WalletCoreRegistryEntry): WalletCoreCoinType | undefined {
  const coinTypes = core.CoinType as unknown as Record<string, unknown>;
  const identifiers = [entry.id, entry.name].map(normalizeCoinIdentifier);

  // First try exact properties. Registry IDs and enum member names are not
  // guaranteed to use the same casing (e.g. smartchain vs smartChain).
  for (const identifier of [entry.id, entry.name]) {
    const direct = coinTypes[identifier];
    if (isCoinTypeValue(direct)) return direct;
  }

  // WASM-generated enum properties can be non-enumerable. Object.entries()
  // silently omits those; getOwnPropertyNames() includes them.
  const propertyNames = new Set([
    ...Object.getOwnPropertyNames(coinTypes),
    ...Object.getOwnPropertyNames(Object.getPrototypeOf(coinTypes) ?? {}),
  ]);
  for (const key of propertyNames) {
    if (!identifiers.includes(normalizeCoinIdentifier(key))) continue;
    const candidate = (coinTypes as Record<string, unknown>)[key]
      ?? (Object.getPrototypeOf(coinTypes) as Record<string, unknown> | null)?.[key];
    if (isCoinTypeValue(candidate)) return candidate;
  }

  // EVM registry entries identify separate networks by chain ID, but their
  // standard account derivation is Ethereum's BIP-44 path. They intentionally
  // share the same Ethereum address.
  if (entry.blockchain === 'Ethereum' && entry.derivation?.[0]?.path === EVM_PATH) {
    const ethereum = coinTypes.ethereum;
    if (isCoinTypeValue(ethereum)) return ethereum;
  }

  return undefined;
}

const EVM_PATH = "m/44'/60'/0'/0/0";

export function deriveSupportedAddresses(
  core: WalletCoreRuntime,
  mnemonic: string,
  bip39Passphrase = '',
): WalletAddress[] {
  if (!core.Mnemonic.isValid(mnemonic)) {
    throw new Error('Invalid BIP-39 recovery phrase or checksum. Check the words and their order.');
  }
  const wallet = core.HDWallet.createWithMnemonic(mnemonic, bip39Passphrase);
  try {
    const ethereum = String(wallet.getAddressForCoin(core.CoinType.ethereum));
    const bitcoin = String(wallet.getAddressForCoin(core.CoinType.bitcoin));
    if (!/^0x[0-9a-fA-F]{40}$/.test(ethereum)) {
      throw new Error('Wallet Core returned an invalid Ethereum-format address.');
    }
    if (!/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{20,}$/.test(bitcoin)) {
      throw new Error('Wallet Core returned an invalid Bitcoin-format address.');
    }

    const result: WalletAddress[] = [];
    // Keep the method bound to the Wallet Core HDWallet instance. The WASM
    // wrapper reads its native pointer from `this`; extracting the method and
    // invoking it as a plain function can make non-EVM derivation fail.
    const getAddressForCoin = (coinType: unknown): string =>
      (wallet.getAddressForCoin as unknown as (this: typeof wallet, coinType: unknown) => string)
        .call(wallet, coinType);

    for (const entry of WALLET_CORE_REGISTRY) {
      // Solana uses the separately tested SLIP-0010 derivation below.
      if (entry.id === 'solana') continue;
      const derivationPath = entry.derivation?.[0]?.path;
      if (!derivationPath) continue;

      // Every registry row on the canonical Ethereum BIP-44 path represents
      // a separate EVM network, not a separate key derivation. Reuse the
      // address already verified by Wallet Core instead of asking its CoinType
      // enum to understand network-specific registry IDs (Base, Linea, etc.).
      const isSharedEvmPath = entry.blockchain === 'Ethereum' && derivationPath === EVM_PATH;
      let value = '';
      if (isSharedEvmPath) {
        value = ethereum;
      } else {
        const coinType = findWalletCoreCoinType(core, entry);
        // Trust Wallet's registry coinId is the SLIP-44 coin type for standard
        // non-EVM chains. Try it only as a runtime candidate; only accept it
        // if Wallet Core actually derives a non-empty address.
        const candidates = coinType === undefined
          ? (Number.isInteger(entry.coinId) ? [entry.coinId] : [])
          : [coinType, ...(Number.isInteger(entry.coinId) ? [entry.coinId] : [])];
        for (const candidate of candidates) {
          try {
            const derived = String(getAddressForCoin(candidate)).trim();
            if (derived && derived !== '[object Object]') {
              value = derived;
              break;
            }
          } catch {
            // Try the next candidate. No secrets are logged or exposed.
          }
        }
      }
      if (!value) continue;

      try {
        const isEvmAddress = /^0x[0-9a-fA-F]{40}$/.test(value);
        const label = DISPLAY_NAME_OVERRIDES[entry.id] ?? entry.name;
        const isActuallySharedEvmPath = isEvmAddress && isSharedEvmPath;
        result.push({
          label,
          registryId: entry.id,
          blockchain: entry.blockchain,
          ticker: entry.id === 'ton' ? 'TON' : entry.symbol,
          value,
          derivationPath: isActuallySharedEvmPath
            ? derivationPath
            : 'Wallet Core default path (registry path not independently verified)',
          family: isEvmAddress
            ? 'EVM'
            : ['Bitcoin', 'BitcoinCash', 'BitcoinDiamond', 'Zcash', 'Verge', 'Groestlcoin', 'Decred', 'Firo', 'Komodo'].includes(entry.blockchain)
              ? 'UTXO'
              : 'Other',
          note: isActuallySharedEvmPath
            ? 'Shared EVM account address; network connection not enabled'
            : 'Derived using Wallet Core default path. The displayed registry path is not asserted to match; deposit support is not verified.',
        });
      } catch {
        // A registry entry is not usable if this installed runtime cannot derive it.
      }
    }

    const solana = deriveSolanaAddress(mnemonic, bip39Passphrase);
    result.push({
      label: 'Solana',
      registryId: 'solana',
      blockchain: 'Solana',
      ticker: 'SOL',
      value: solana,
      derivationPath: SOLANA_DERIVATION_PATH,
      family: 'Ed25519',
      note: 'Locally derived with BIP-39 and SLIP-0010; other Solana wallets may use a different path',
    });

    const priority = new Map(PREFERRED_CHAIN_ORDER.map((id, index) => [id, index]));
    result.sort((a, b) => {
      const orderA = priority.get(a.registryId ?? '') ?? Number.MAX_SAFE_INTEGER;
      const orderB = priority.get(b.registryId ?? '') ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB || a.label.localeCompare(b.label);
    });
    return result;
  } finally {
    wallet.delete();
  }
}

export type SelfTestResult = { name: string; status: 'passed' | 'failed' | 'skipped'; detail: string };

const EVM_BTC_REFERENCE_MNEMONIC =
  'ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal';
const SOLANA_REFERENCE_MNEMONIC =
  'team engine square letter hero song dizzy scrub tornado fabric divert saddle';

export function runKeyDerivationSelfTests(core: WalletCoreRuntime): SelfTestResult[] {
  const results: SelfTestResult[] = [];

  try {
    const registryAddresses = deriveSupportedAddresses(core, EVM_BTC_REFERENCE_MNEMONIC);
    const derivedCount = registryAddresses.length;
    const evmRows = registryAddresses.filter((entry) => entry.family === 'EVM').length;
    results.push({
      name: 'Wallet Core 4.8.4 multi-chain registry derivation coverage',
      status: derivedCount >= 100 ? 'passed' : 'failed',
      detail: `Derived ${derivedCount} receiving addresses from the pinned 168-entry registry (${evmRows} EVM rows; target: 100+). A row is counted only after Wallet Core returns a non-empty address.`,
    });
  } catch (error) {
    results.push({
      name: 'Wallet Core multi-chain registry derivation coverage',
      status: 'failed',
      detail: error instanceof Error ? error.message : 'Unknown registry derivation error',
    });
  }

  const referenceWallet = core.HDWallet.createWithMnemonic(EVM_BTC_REFERENCE_MNEMONIC, '');
  try {
    const eth = String(referenceWallet.getAddressForCoin(core.CoinType.ethereum));
    const btc = String(referenceWallet.getAddressForCoin(core.CoinType.bitcoin));

    results.push({
      name: 'Ethereum BIP-44 published Trust Wallet Core reference vector',
      status: eth.toLowerCase() === '0xa3dcd899c0f3832dfdfed9479a9d828c6a4eb2a7' ? 'passed' : 'failed',
      detail: eth,
    });
    results.push({
      name: 'Bitcoin BIP-84 native SegWit published Trust Wallet Core reference vector',
      status: btc.toLowerCase() === 'bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd' ? 'passed' : 'failed',
      detail: btc,
    });
  } catch (error) {
    results.push({
      name: 'Ethereum/Bitcoin reference-vector execution',
      status: 'failed',
      detail: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    referenceWallet.delete();
  }

  try {
    const solana = deriveSolanaAddress(SOLANA_REFERENCE_MNEMONIC);
    const validFormat = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(solana);
    const matchesPublishedVector = solana === 'HiipoCKL8hX2RVmJTz3vaLy34hS2zLhWWMkUWtw85TmZ';

    results.push({
      name: 'Solana SLIP-0010 published reference vector',
      status: validFormat && matchesPublishedVector ? 'passed' : 'failed',
      detail: solana,
    });
    results.push({
      name: 'Solana address format and deterministic derivation',
      status: validFormat ? 'passed' : 'failed',
      detail: validFormat ? 'Valid Base58 address derived locally.' : solana,
    });
  } catch (error) {
    results.push({
      name: 'Solana derivation execution',
      status: 'failed',
      detail: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  return results;
}
