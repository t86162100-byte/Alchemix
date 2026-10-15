import { HDNodeWallet, Mnemonic } from 'ethers';
import { ripemd160 } from '@noble/hashes/ripemd160';
import { sha256 } from '@noble/hashes/sha256';

const DEFAULT_API = 'https://api.blockcypher.com/v1/doge/main';
export const DOGE_DERIVATION_PATH = "m/44'/3'/0'/0/0";
export type DogeSnapshot = { address: string; balanceDoge: string; apiUrl: string };

function getApiUrl(): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const url = (env?.VITE_DOGE_API_URL?.trim() || DEFAULT_API).replace(/\/$/, '');
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('Dogecoin API URL is invalid.'); }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') throw new Error('Dogecoin API must use HTTPS.');
  return url;
}

function base58(bytes: Uint8Array): string {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let zeros = 0; while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits: number[] = [];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) { carry += digits[j] * 256; digits[j] = carry % 58; carry = Math.floor(carry / 58); }
    while (carry > 0) { digits.push(carry % 58); carry = Math.floor(carry / 58); }
  }
  return '1'.repeat(zeros) + digits.reverse().map(d => alphabet[d]).join('');
}

function base58Check(payload: Uint8Array): string {
  const first = sha256(payload);
  const second = sha256(first);
  const all = new Uint8Array(payload.length + 4); all.set(payload); all.set(second.slice(0, 4), payload.length);
  return base58(all);
}

/** Derive the standard Dogecoin P2PKH address locally from the BIP-39 phrase. */
export function deriveDogeAddress(input: string): string {
  const phrase = input.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!Mnemonic.isValidMnemonic(phrase)) throw new Error('A valid recovery phrase is required to derive the Dogecoin account.');
  const wallet = HDNodeWallet.fromPhrase(phrase, undefined, DOGE_DERIVATION_PATH);
  const publicKey = Uint8Array.from(BufferlessHex(wallet.publicKey));
  const hash = ripemd160(sha256(publicKey));
  const payload = new Uint8Array(21); payload[0] = 0x1e; payload.set(hash, 1);
  return base58Check(payload);
}

function BufferlessHex(hex: string): number[] {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  return clean.match(/.{2}/g)?.map(byte => parseInt(byte, 16)) ?? [];
}

/** Read-only DOGE balance lookup. */
export async function readDogeSnapshot(input: string): Promise<DogeSnapshot> {
  const address = deriveDogeAddress(input);
  const apiUrl = getApiUrl();
  let response: Response;
  try { response = await fetch(`${apiUrl}/addrs/${encodeURIComponent(address)}/balance`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) }); }
  catch (error) { throw new Error(`Dogecoin API request failed: ${error instanceof Error ? error.message : String(error)}`); }
  if (response.status === 429) throw new Error('Dogecoin API rate limit reached. Wait briefly and try again.');
  if (response.status === 401 || response.status === 403) throw new Error('Dogecoin API access was denied.');
  if (!response.ok) throw new Error(`Dogecoin API request failed (HTTP ${response.status}).`);
  const payload: unknown = await response.json();
  const balance = payload && typeof payload === 'object' ? (payload as { final_balance?: unknown }).final_balance : undefined;
  if (typeof balance !== 'number' && typeof balance !== 'string') throw new Error('Dogecoin API returned an unexpected balance response.');
  const raw = BigInt(balance).toString().padStart(9, '0');
  const formatted = `${raw.slice(0, -8) || '0'}.${raw.slice(-8)}`.replace(/\.?0+$/, '');
  return { address, balanceDoge: formatted || '0', apiUrl };
}
