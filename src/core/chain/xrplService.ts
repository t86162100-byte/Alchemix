import { HDNodeWallet, Mnemonic } from 'ethers';
import { ripemd160 } from '@noble/hashes/ripemd160';
import { sha256 } from '@noble/hashes/sha256';
import { encodeAccountID } from 'ripple-address-codec';

const DEFAULT_API = 'https://xrplcluster.com';
export const XRPL_DERIVATION_PATH = "m/44'/144'/0'/0/0";
export type XrplSnapshot = { address: string; balanceXrp: string; apiUrl: string };

function getApiUrl(): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const url = (env?.VITE_XRPL_API_URL?.trim() || DEFAULT_API).replace(/\/$/, '');
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('XRPL API URL is invalid.'); }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') throw new Error('XRPL API must use HTTPS.');
  return url;
}

/** Derive the standard BIP-44 secp256k1 key locally, then encode its XRPL account ID. */
export function deriveXrplAddress(input: string): string {
  const phrase = input.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!Mnemonic.isValidMnemonic(phrase)) throw new Error('A valid recovery phrase is required to derive the XRPL account.');
  const wallet = HDNodeWallet.fromPhrase(phrase, undefined, XRPL_DERIVATION_PATH);
  const publicKey = Uint8Array.from((wallet.publicKey.slice(2).match(/.{2}/g) ?? []).map(byte => parseInt(byte, 16)));
  const accountId = ripemd160(sha256(publicKey));
  return encodeAccountID(accountId);
}

/** Read-only XRP balance lookup using XRPL JSON-RPC account_info. */
export async function readXrplSnapshot(input: string): Promise<XrplSnapshot> {
  const address = deriveXrplAddress(input);
  const apiUrl = getApiUrl();
  let response: Response;
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ method: 'account_info', params: [{ account: address, ledger_index: 'validated' }] }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    throw new Error(`XRPL request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (response.status === 429) throw new Error('XRPL endpoint rate limit reached. Wait briefly and try again.');
  if (response.status === 401 || response.status === 403) throw new Error('XRPL endpoint access was denied.');
  if (!response.ok) throw new Error(`XRPL request failed (HTTP ${response.status}).`);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object') throw new Error('XRPL returned an unexpected response.');
  const outer = payload as { result?: { status?: string; error?: string; error_message?: string; account_data?: { Balance?: string } } };
  const result = outer.result;
  if (result?.error === 'actNotFound' || result?.error === 'accountNot_found') return { address, balanceXrp: '0', apiUrl };
  if (result?.status === 'error' || result?.error) throw new Error(result.error_message || result.error || 'XRPL account lookup failed.');
  const drops = result?.account_data?.Balance;
  if (typeof drops !== 'string') throw new Error('XRPL returned no validated account balance.');
  const raw = BigInt(drops).toString().padStart(7, '0');
  const formatted = `${raw.slice(0, -6) || '0'}.${raw.slice(-6)}`.replace(/\.?0+$/, '');
  return { address, balanceXrp: formatted || '0', apiUrl };
}
