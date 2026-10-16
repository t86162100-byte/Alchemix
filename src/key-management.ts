import type { WalletCoreRuntime } from './wallet-core';

export type WalletAddress = {
  label: string; ticker: string; value: string; derivationPath: string;
  family: 'EVM' | 'UTXO' | 'Ed25519'; note?: string;
};

export const EVM_NETWORKS = [
  'Ethereum', 'BNB Chain', 'Base', 'Polygon', 'Arbitrum', 'Optimism',
  'Avalanche C-Chain', 'Mantle', 'Linea', 'Scroll', 'zkSync Era',
  'opBNB', 'Celo', 'Gnosis', 'Moonbeam', 'Moonriver', 'Fantom',
] as const;

export function deriveSupportedAddresses(core: WalletCoreRuntime, mnemonic: string, bip39Passphrase = ''): WalletAddress[] {
  const wallet = core.HDWallet.createWithMnemonic(mnemonic, bip39Passphrase);
  try {
    const ethereum = String(wallet.getAddressForCoin(core.CoinType.ethereum));
    const bitcoin = String(wallet.getAddressForCoin(core.CoinType.bitcoin));
    const solanaCoin = (core.CoinType as unknown as Record<string, number | undefined>).solana;
    if (!/^0x[0-9a-fA-F]{40}$/.test(ethereum)) throw new Error('Wallet Core returned an invalid Ethereum-format address.');
    if (!/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{20,}$/.test(bitcoin)) throw new Error('Wallet Core returned an invalid Bitcoin-format address.');

    // EVM networks share the same Ethereum account key/path; these rows do not imply RPC support.
    const result: WalletAddress[] = EVM_NETWORKS.map((label) => ({
      label, ticker: 'EVM', value: ethereum, derivationPath: "m/44'/60'/0'/0/0",
      family: 'EVM', note: 'Shared EVM account address; network connection not enabled',
    }));
    result.push({
      label: 'Bitcoin', ticker: 'BTC', value: bitcoin, derivationPath: "m/84'/0'/0'/0/0",
      family: 'UTXO', note: 'Native SegWit receiving address',
    });
    if (typeof solanaCoin !== 'number') throw new Error('This Wallet Core build does not expose Solana derivation.');
    const solana = String(wallet.getAddressForCoin(solanaCoin));
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(solana)) throw new Error('Wallet Core returned an invalid Solana-format address.');
    result.push({
      label: 'Solana', ticker: 'SOL', value: solana,
      derivationPath: "Wallet Core default (commonly m/44'/501'/0'/0')",
      family: 'Ed25519', note: 'Derived locally; no RPC or balance lookup',
    });
    return result;
  } finally {
    wallet.delete();
  }
}

export type SelfTestResult = { name: string; passed: boolean; detail: string };
const REFERENCE_MNEMONIC = 'ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal';
// Published fixture from Trust Wallet Core's usage guide. Never use test phrases for funds.
export function runKeyDerivationSelfTests(core: WalletCoreRuntime): SelfTestResult[] {
  const results: SelfTestResult[] = [];
  const wallet = core.HDWallet.createWithMnemonic(REFERENCE_MNEMONIC, '');
  try {
    const eth = String(wallet.getAddressForCoin(core.CoinType.ethereum));
    const btc = String(wallet.getAddressForCoin(core.CoinType.bitcoin));
    results.push({
      name: 'Ethereum BIP-44 published reference vector',
      passed: eth.toLowerCase() === '0xa3dcd899c0f3832dfdfed9479a9d828c6a4eb2a7'.toLowerCase(),
      detail: eth,
    });
    results.push({
      name: 'Bitcoin BIP-84 native SegWit published reference vector',
      passed: btc.toLowerCase() === 'bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd',
      detail: btc,
    });
    const solanaCoin = (core.CoinType as unknown as Record<string, number | undefined>).solana;
    if (typeof solanaCoin === 'number') {
      const first = String(wallet.getAddressForCoin(solanaCoin));
      const second = String(wallet.getAddressForCoin(solanaCoin));
      const valid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(first);
      results.push({
        name: 'Solana default derivation format and repeatability',
        passed: valid && first === second,
        detail: valid ? 'Valid Base58 address; repeated derivation matches. Independent published Solana vector remains to be added.' : first,
      });
    } else {
      results.push({ name: 'Solana derivation API available', passed: false, detail: 'Solana coin type is missing.' });
    }
  } catch (error) {
    results.push({ name: 'Wallet Core vector execution', passed: false, detail: error instanceof Error ? error.message : 'Unknown error' });
  } finally {
    wallet.delete();
  }
  return results;
}
