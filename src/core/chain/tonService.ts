import { Mnemonic } from 'ethers';
import { Buffer } from 'buffer';
import { keyPairFromSeed } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';

export const TON_DERIVATION_PATH = "m/44'/607'/0'";
const DEFAULT_API = 'https://tonapi.io/v2';
export type TonSnapshot = { address: string; balanceNanoTon: string; balanceTon: string; apiUrl: string };

function getTonApiUrl(): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const url = env?.VITE_TON_API_URL?.trim() || DEFAULT_API;
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('TON API URL is invalid.'); }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') throw new Error('TON API must use HTTPS.');
  return url.replace(/\/$/, '');
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length); copy.set(bytes); return copy.buffer;
}

/** SLIP-0010 hardened Ed25519 derivation from the wallet's BIP-39 seed. */
async function deriveEd25519Seed(seed: Uint8Array): Promise<Uint8Array> {
  const hmac = async (keyBytes: Uint8Array, data: Uint8Array) => {
    const key = await crypto.subtle.importKey('raw', toArrayBuffer(keyBytes), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', key, toArrayBuffer(data)));
  };
  let digest = await hmac(new TextEncoder().encode('ed25519 seed'), seed);
  let key = digest.slice(0, 32), chainCode = digest.slice(32);
  for (const index of [44, 607, 0]) {
    const data = new Uint8Array(37);
    data[0] = 0; data.set(key, 1);
    const hardened = (index + 0x80000000) >>> 0;
    data[33] = hardened >>> 24; data[34] = hardened >>> 16 & 255; data[35] = hardened >>> 8 & 255; data[36] = hardened & 255;
    digest = await hmac(chainCode, data); key = digest.slice(0, 32); chainCode = digest.slice(32);
  }
  return key;
}

/** Derive a TON Wallet V4R2 public address locally. The mnemonic is never sent to the API. */
export async function deriveTonAddress(phraseInput: string): Promise<{ address: string; publicKey: Uint8Array }> {
  const phrase = phraseInput.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!Mnemonic.isValidMnemonic(phrase)) throw new Error('A valid recovery phrase is required to derive the TON account.');
  const seedHex = Mnemonic.fromPhrase(phrase).computeSeed().replace(/^0x/, '');
  const seed = Uint8Array.from(seedHex.match(/.{2}/g) ?? [], byte => parseInt(byte, 16));
  const privateSeed = await deriveEd25519Seed(seed);
  const keyPair = keyPairFromSeed(Buffer.from(privateSeed));
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
  return { address: wallet.address.toString({ bounceable: false, urlSafe: true }), publicKey: keyPair.publicKey };
}

/** Read-only TON balance lookup; only the derived public address is sent to the public API. */
export async function readTonSnapshot(phraseInput: string): Promise<TonSnapshot> {
  const { address } = await deriveTonAddress(phraseInput);
  const apiUrl = getTonApiUrl();
  let response: Response;
  try { response = await fetch(`${apiUrl}/accounts/${encodeURIComponent(address)}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) }); }
  catch (error) { throw new Error(`TON API request failed: ${error instanceof Error ? error.message : String(error)}`); }
  if (response.status === 429) throw new Error('TON API rate limit reached. Wait briefly and try again.');
  if (response.status === 401 || response.status === 403) throw new Error('TON API access was denied. Check the configured provider settings.');
  if (!response.ok) throw new Error(`TON API request failed (HTTP ${response.status}).`);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object' || typeof (payload as { balance?: unknown }).balance !== 'string' && typeof (payload as { balance?: unknown }).balance !== 'number') throw new Error('TON API returned an unexpected account response.');
  const nano = BigInt((payload as { balance: string | number }).balance).toString();
  const whole = nano.length > 9 ? `${nano.slice(0, -9)}.${nano.slice(-9)}`.replace(/\.?(0+)$/, '') : `0.${nano.padStart(9, '0')}`.replace(/\.?0+$/, '');
  return { address, balanceNanoTon: nano, balanceTon: whole || '0', apiUrl };
}
