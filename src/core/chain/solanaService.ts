import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Mnemonic, formatUnits } from 'ethers';
import { derivePath } from 'ed25519-hd-key';

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
 * common Phantom-compatible hardened Ed25519 path. The phrase stays in memory
 * and is never sent to the RPC provider.
 */
export function deriveSolanaAddress(phraseInput: string): string {
  const phrase = phraseInput.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!Mnemonic.isValidMnemonic(phrase)) {
    throw new Error('A valid recovery phrase is required to derive the Solana account.');
  }
  const seedHex = Mnemonic.fromPhrase(phrase).computeSeed().replace(/^0x/, '');
  const derived = derivePath(SOLANA_DERIVATION_PATH, seedHex);
  const keypair = Keypair.fromSeed(new Uint8Array(derived.key));
  return keypair.publicKey.toBase58();
}

/** Read-only SOL balance lookup. Only the derived public address is sent to RPC. */
export async function readSolanaSnapshot(phraseInput: string): Promise<SolanaSnapshot> {
  const address = deriveSolanaAddress(phraseInput);
  const publicKey = new PublicKey(address);
  const connection = new Connection(SOLANA_RPC_URL, { commitment: 'confirmed', disableRetryOnRateLimit: false });
  try {
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
  } finally {
    connection
      .getVersion()
      .catch(() => undefined);
  }
}

export const SOLANA_LAMPORTS_PER_SOL = LAMPORTS_PER_SOL;
