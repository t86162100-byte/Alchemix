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

/**
 * Derive the first Solana account from a BIP-39 recovery phrase using the
 * common Phantom-compatible hardened Ed25519 path. Solana-only libraries are
 * loaded on demand so they cannot break initial app startup on browsers.
 */
export async function deriveSolanaAddress(phraseInput: string): Promise<string> {
  const phrase = phraseInput.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!Mnemonic.isValidMnemonic(phrase)) {
    throw new Error('A valid recovery phrase is required to derive the Solana account.');
  }
  const [{ derivePath }, { Keypair }] = await Promise.all([
    import('ed25519-hd-key'),
    import('@solana/web3.js'),
  ]);
  const seedHex = Mnemonic.fromPhrase(phrase).computeSeed().replace(/^0x/, '');
  const derived = derivePath(SOLANA_DERIVATION_PATH, seedHex);
  return Keypair.fromSeed(new Uint8Array(derived.key)).publicKey.toBase58();
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
