import { Mnemonic, formatUnits } from 'ethers';

export const SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'";

export type SolanaSnapshot = {
  address: string;
  balanceLamports: string;
  balanceSol: string;
  slot: number;
  rpcUrl: string;
};

const SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com';

/** SLIP-0010 Ed25519 hardened derivation using browser-native Web Crypto. */
async function deriveEd25519Seed(seedHex: string): Promise<Uint8Array> {
  const fromHex = (hex: string) => Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) => parseInt(byte, 16));
  const hmac = async (keyBytes: Uint8Array, data: Uint8Array): Promise<Uint8Array> => {
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', key, data));
  };

  let digest = await hmac(new TextEncoder().encode('ed25519 seed'), fromHex(seedHex));
  let key = digest.slice(0, 32);
  let chainCode = digest.slice(32);
  // The selected path is entirely hardened: 44', 501', 0', 0'.
  for (const index of [44, 501, 0, 0]) {
    const data = new Uint8Array(37);
    data[0] = 0;
    data.set(key, 1);
    const hardenedIndex = (index + 0x80000000) >>> 0;
    data[33] = (hardenedIndex >>> 24) & 0xff;
    data[34] = (hardenedIndex >>> 16) & 0xff;
    data[35] = (hardenedIndex >>> 8) & 0xff;
    data[36] = hardenedIndex & 0xff;
    digest = await hmac(chainCode, data);
    key = digest.slice(0, 32);
    chainCode = digest.slice(32);
  }
  return key;
}

/**
 * Derive the first Solana account from a BIP-39 phrase using the common
 * Phantom-compatible hardened Ed25519 path. This avoids Node-only crypto
 * shims in browser bundles.
 */
export async function deriveSolanaAddress(phraseInput: string): Promise<string> {
  const phrase = phraseInput.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!Mnemonic.isValidMnemonic(phrase)) {
    throw new Error('A valid recovery phrase is required to derive the Solana account.');
  }
  const [{ Keypair }] = await Promise.all([import('@solana/web3.js')]);
  const seedHex = Mnemonic.fromPhrase(phrase).computeSeed().replace(/^0x/, '');
  const derivedSeed = await deriveEd25519Seed(seedHex);
  return Keypair.fromSeed(derivedSeed).publicKey.toBase58();
}

/** Read-only SOL balance lookup. Only the derived public address is sent to RPC. */
export async function readSolanaSnapshot(phraseInput: string): Promise<SolanaSnapshot> {
  const address = await deriveSolanaAddress(phraseInput);
  const { Connection, PublicKey } = await import('@solana/web3.js');
  const publicKey = new PublicKey(address);
  const connection = new Connection(SOLANA_RPC_URL, { commitment: 'confirmed', disableRetryOnRateLimit: false });
  const [balance, slot] = await Promise.all([
    connection.getBalance(publicKey, 'confirmed'),
    connection.getSlot('confirmed'),
  ]);
  return {
    address,
    balanceLamports: String(balance),
    balanceSol: formatUnits(BigInt(balance), 9),
    slot,
    rpcUrl: SOLANA_RPC_URL,
  };
}
