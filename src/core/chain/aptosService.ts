import { Mnemonic } from 'ethers';
import { Account } from '@aptos-labs/ts-sdk';

export const APTOS_DERIVATION_PATH = "m/44'/637'/0'/0'/0'";
const DEFAULT_APTOS_URL = 'https://fullnode.mainnet.aptoslabs.com/v1';

export type AptosSnapshot = { address: string; balanceApt: string; apiUrl: string };

function getAptosUrl(): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const url = (env?.VITE_APTOS_API_URL?.trim() || DEFAULT_APTOS_URL).replace(/\/$/, '');
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('Aptos API URL is invalid.'); }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') throw new Error('Aptos API must use HTTPS.');
  return url;
}

/** Derive a legacy Ed25519 Aptos account locally using the Aptos BIP-44 path. */
export function deriveAptosAddress(phraseInput: string): string {
  const phrase = phraseInput.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!Mnemonic.isValidMnemonic(phrase)) throw new Error('A valid recovery phrase is required to derive the Aptos account.');
  return Account.fromDerivationPath({ path: APTOS_DERIVATION_PATH, mnemonic: phrase }).accountAddress.toString();
}

/** Read the native APT coin balance; only the public account address is sent to the Aptos node. */
export async function readAptosSnapshot(phraseInput: string): Promise<AptosSnapshot> {
  const address = deriveAptosAddress(phraseInput);
  const apiUrl = getAptosUrl();
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/accounts/${encodeURIComponent(address)}/resources`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    throw new Error(`Aptos API request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (response.status === 404) return { address, balanceApt: '0', apiUrl };
  if (response.status === 429) throw new Error('Aptos API rate limit reached. Wait briefly and try again.');
  if (response.status === 401 || response.status === 403) throw new Error('Aptos API access was denied.');
  if (!response.ok) throw new Error(`Aptos API request failed (HTTP ${response.status}).`);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error('Aptos API returned an unexpected resource response.');
  const coinStore = payload.find((resource: any) => resource?.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>');
  const raw = coinStore?.data?.coin?.value;
  if (raw === undefined || raw === null || (typeof raw !== 'string' && typeof raw !== 'number')) {
    return { address, balanceApt: '0', apiUrl };
  }
  const units = BigInt(raw);
  const digits = units.toString().padStart(9, '0');
  const formatted = `${digits.slice(0, -8) || '0'}.${digits.slice(-8)}`.replace(/\.?0+$/, '');
  return { address, balanceApt: formatted || '0', apiUrl };
}
