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
};

type WalletCoreRegistryEntry = {
  id: string;
  name: string;
  symbol: string;
  blockchain: string;
  derivation?: Array<{ path?: string }>;
};

type WalletCoreCoinType = { value: number };

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

function isWalletCoreCoinType(value: unknown): value is WalletCoreCoinType {
  return typeof value === 'object'
    && value !== null
    && typeof (value as { value?: unknown }).value === 'number';
}

/**
 * Wallet Core WASM exposes CoinType members as objects (for example,
 * CoinType.ethereum.value), not JavaScript numbers. Keep and pass the actual
 * enum object to HDWallet.getAddressForCoin; passing its numeric .value is not
 * the API shown in Trust Wallet Core's own WASM sample.
 */
function findWalletCoreCoinType(core: WalletCoreRuntime, entry: WalletCoreRegistryEntry): WalletCoreCoinType | undefined {
  const coinTypes = core.CoinType as unknown as Record<string, unknown>;
  const identifiers = [entry.id, entry.name].map(normalizeCoinIdentifier);

  // Prefer exact registry ID/name properties, including non-enumerable members.
  for (const identifier of [entry.id, entry.name]) {
    const direct = coinTypes[identifier];
    if (isWalletCoreCoinType(direct)) return direct;
  }

  // Fall back to normalized enum member names. CoinType values are wrapper
  // objects, so filter by their numeric .value rather than typeof value === number.
  const candidates = Object.entries(coinTypes).filter(
    ([key, value]) => !/^\d+$/.test(key) && isWalletCoreCoinType(value),
  );
  const match = candidates.find(([key]) => identifiers.includes(normalizeCoinIdentifier(key)));
  if (match && isWalletCoreCoinType(match[1])) return match[1];

  // EVM chains using the standard Ethereum derivation path share the same
  // underlying account key. Use Wallet Core's actual Ethereum CoinType object
  // only if this particular registry ID is not present in the runtime.
  if (entry.blockchain === 'Ethereum' && entry.derivation?.[0]?.path === EVM_PATH) {
    const ethereum = coinTypes.ethereum;
    if (isWalletCoreCoinType(ethereum)) return ethereum;
  }

  return undefined;
}

const EVM_PATH = "m/44'/60'/0'/0/0";

export function deriveSupportedAddresses(
  core: WalletCoreRuntime,
  mnemonic: string,
  bip39Passphrase = '',
): WalletAddress[] {
  // Wallet Core exposes the canonical BIP-39 checksum/word-list validator; do not derive from word count alone.
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
    const getAddressForCoin = wallet.getAddressForCoin as unknown as (coinType: WalletCoreCoinType) => string;

    for (const entry of WALLET_CORE_REGISTRY) {
      // Solana is handled by the separately validated SLIP-0010 implementation below.
      if (entry.id === 'solana') continue;
      const derivationPath = entry.derivation?.[0]?.path;
      if (!derivationPath) continue;

      const coinType = findWalletCoreCoinType(core, entry);
      if (!coinType) continue;

      try {
        const value = String(getAddressForCoin(coinType)).trim();
        if (!value || value === '[object Object]') continue;

        const isEvmAddress = /^0x[0-9a-fA-F]{40}$/.test(value);
        const label = DISPLAY_NAME_OVERRIDES[entry.id] ?? entry.name;
        const isSharedEvmPath = isEvmAddress && derivationPath === EVM_PATH;
        result.push({
          label,
          registryId: entry.id,
          ticker: entry.symbol,
          value,
          derivationPath,
          family: isEvmAddress
            ? 'EVM'
            : ['Bitcoin', 'BitcoinCash', 'BitcoinDiamond', 'Zcash', 'Verge', 'Groestlcoin', 'Decred', 'Firo', 'Komodo'].includes(entry.blockchain)
              ? 'UTXO'
              : 'Other',
          note: isSharedEvmPath
            ? 'Shared EVM account address; network connection not enabled'
            : 'Derived by Wallet Core from its pinned registry; network connection not enabled',
        });
      } catch {
        // Do not fabricate an address if this runtime cannot derive this entry.
      }
    }

    const solana = deriveSolanaAddress(mnemonic, bip39Passphrase);
    result.push({
      label: 'Solana',
      registryId: 'solana',
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

// Public, published Wallet Core test fixtures only. Never use these phrases for funds.
const EVM_BTC_REFERENCE_MNEMONIC =
  'ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal';
const SOLANA_REFERENCE_MNEMONIC =
  'team engine square letter hero song dizzy scrub tornado fabric divert saddle';

export function runKeyDerivationSelfTests(core: WalletCoreRuntime): SelfTestResult[] {
  const results: SelfTestResult[] = [];

  try {
    const registryAddresses = deriveSupportedAddresses(core, EVM_BTC_REFERENCE_MNEMONIC);
    const derivedCount = registryAddresses.length;
    results.push({
      name: 'Wallet Core 4.8.4 multi-chain registry derivation coverage',
      status: derivedCount >= 100 ? 'passed' : 'failed',
      detail: `Derived ${derivedCount} receiving addresses from the pinned Wallet Core registry (target: 100+).`,
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
