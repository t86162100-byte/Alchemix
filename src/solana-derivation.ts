import { mnemonicToSeedSync } from '@scure/bip39';
import slip10 from 'micro-key-producer/slip10.js';
import { base58 } from '@scure/base';

/**
 * Solana's Wallet Core-compatible default account path.
 * Different Solana wallets can use different paths; do not silently switch paths
 * when restoring an existing wallet.
 */
export const SOLANA_DERIVATION_PATH = "m/44'/501'/0'";

/**
 * Derive a Solana public receiving address locally from a BIP-39 phrase.
 * The seed and private key material are never persisted or sent over the network.
 */
export function deriveSolanaAddress(mnemonic: string, bip39Passphrase = ''): string {
  const seed = mnemonicToSeedSync(mnemonic, bip39Passphrase);
  let root: ReturnType<typeof slip10.fromMasterSeed> | undefined;
  let child: ReturnType<typeof slip10.fromMasterSeed> | undefined;

  try {
    root = slip10.fromMasterSeed(seed);
    child = root.derive(SOLANA_DERIVATION_PATH);
    const publicKey = child.publicKeyRaw;
    if (publicKey.length !== 32) {
      throw new Error('Solana derivation returned an invalid Ed25519 public key.');
    }
    const address = base58.encode(publicKey);
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
      throw new Error('Solana derivation returned an invalid Base58 address.');
    }
    return address;
  } finally {
    seed.fill(0);
    if (child) {
      child.privateKey.fill(0);
      child.chainCode.fill(0);
    }
    if (root) {
      root.privateKey.fill(0);
      root.chainCode.fill(0);
    }
  }
}
