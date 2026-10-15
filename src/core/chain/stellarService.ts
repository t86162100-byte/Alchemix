import { Mnemonic } from 'ethers';
import { derivePath } from 'ed25519-hd-key';
import { Keypair } from '@stellar/stellar-sdk';

const DEFAULT_HORIZON = 'https://horizon.stellar.org';
export const STELLAR_DERIVATION_PATH = "m/44'/148'/0'";

export type StellarSnapshot = {
  address: string;
  balanceXlm: string;
  apiUrl: string;
};

function getHorizonUrl(): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const url = (env?.VITE_STELLAR_HORIZON_URL?.trim() || DEFAULT_HORIZON).replace(/\/$/, '');
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('Stellar Horizon URL is invalid.'); }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    throw new Error('Stellar Horizon must use HTTPS.');
  }
  return url;
}

/** Derives a Stellar Ed25519 account locally from the wallet's BIP-39 phrase. */
export function deriveStellarAddress(phraseInput: string): string {
  const phrase = phraseInput.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!Mnemonic.isValidMnemonic(phrase)) throw new Error('A valid recovery phrase is required to derive the Stellar account.');
  const seedHex = Mnemonic.fromPhrase(phrase).computeSeed().replace(/^0x/, '');
  const derived = derivePath(STELLAR_DERIVATION_PATH, seedHex);
  const keypair = Keypair.fromRawEd25519Seed(derived.key);
  return keypair.publicKey();
}

/** Read-only XLM balance lookup. Only the public Stellar address is sent to Horizon. */
export async function readStellarSnapshot(phraseInput: string): Promise<StellarSnapshot> {
  const address = deriveStellarAddress(phraseInput);
  const apiUrl = getHorizonUrl();
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/accounts/${encodeURIComponent(address)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    throw new Error(`Stellar Horizon request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  // Unfunded Stellar accounts do not exist in Horizon yet; that is a real zero-balance state.
  if (response.status === 404) return { address, balanceXlm: '0', apiUrl };
  if (response.status === 429) throw new Error('Stellar Horizon rate limit reached. Wait briefly and try again.');
  if (response.status === 401 || response.status === 403) throw new Error('Stellar Horizon access was denied.');
  if (!response.ok) throw new Error(`Stellar Horizon request failed (HTTP ${response.status}).`);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { balances?: unknown }).balances)) {
    throw new Error('Stellar Horizon returned an unexpected account response.');
  }
  const native = ((payload as { balances: Array<{ asset_type?: unknown; balance?: unknown }> }).balances)
    .find(item => item.asset_type === 'native');
  if (!native || typeof native.balance !== 'string') throw new Error('Stellar XLM balance was not present in the Horizon response.');
  return { address, balanceXlm: native.balance, apiUrl };
}
