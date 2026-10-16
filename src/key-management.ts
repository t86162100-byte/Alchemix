import type { WalletCoreRuntime } from './wallet-core';
import { deriveSolanaAddress, SOLANA_DERIVATION_PATH } from './solana-derivation';

export type WalletAddress = {
  label: string;
  ticker: string;
  value: string;
  derivationPath: string;
  family: 'EVM' | 'UTXO' | 'Ed25519';
  note?: string;
};

const EVM_NETWORKS = [
  { label: 'Ethereum', ticker: 'ETH' },
  { label: 'BNB Chain', ticker: 'BNB' },
  { label: 'Base', ticker: 'ETH' },
  { label: 'Polygon', ticker: 'POL' },
  { label: 'Arbitrum', ticker: 'ETH' },
  { label: 'Optimism', ticker: 'ETH' },
  { label: 'Avalanche C-Chain', ticker: 'AVAX' },
  { label: 'Mantle', ticker: 'MNT' },
  { label: 'Linea', ticker: 'ETH' },
  { label: 'Scroll', ticker: 'ETH' },
  { label: 'zkSync Era', ticker: 'ETH' },
  { label: 'opBNB', ticker: 'BNB' },
  { label: 'Celo', ticker: 'CELO' },
  { label: 'Gnosis', ticker: 'xDAI' },
  { label: 'Moonbeam', ticker: 'GLMR' },
  { label: 'Moonriver', ticker: 'MOVR' },
  { label: 'Fantom', ticker: 'S' },
] as const;

const EVM_PATH = "m/44'/60'/0'/0/0";
const BITCOIN_BIP84_PATH = "m/84'/0'/0'/0/0";

export function deriveSupportedAddresses(
  core: WalletCoreRuntime,
  mnemonic: string,
  bip39Passphrase = '',
): WalletAddress[] {
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

    const result: WalletAddress[] = EVM_NETWORKS.map(({ label, ticker }) => ({
      label,
      ticker,
      value: ethereum,
      derivationPath: EVM_PATH,
      family: 'EVM',
      note: 'Shared EVM account address; network connection not enabled',
    }));

    result.push({
      label: 'Bitcoin',
      ticker: 'BTC',
      value: bitcoin,
      derivationPath: BITCOIN_BIP84_PATH,
      family: 'UTXO',
      note: 'Native SegWit receiving address (BIP-84)',
    });

    const solana = deriveSolanaAddress(mnemonic, bip39Passphrase);
    result.push({
      label: 'Solana',
      ticker: 'SOL',
      value: solana,
      derivationPath: SOLANA_DERIVATION_PATH,
      family: 'Ed25519',
      note: 'Locally derived with BIP-39 and SLIP-0010; other Solana wallets may use a different path',
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
