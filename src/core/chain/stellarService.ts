import { Mnemonic } from 'ethers';
import { ed25519 } from '@noble/curves/ed25519';

const DEFAULT_HORIZON = 'https://horizon.stellar.org';
export const STELLAR_DERIVATION_PATH = "m/44'/148'/0'";

export type StellarSnapshot = {
  address: string;
  balanceXlm: string;
  apiUrl: string;
};

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

function crc16Xmodem(bytes: Uint8Array): number {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

function encodeStellarPublicKey(publicKey: Uint8Array): string {
  if (publicKey.length !== 32) throw new Error('Stellar public key must be 32 bytes.');
  const payload = new Uint8Array(35);
  payload[0] = 48; // StrKey version byte for an Ed25519 public key.
  payload.set(publicKey, 1);
  const checksum = crc16Xmodem(payload.subarray(0, 33));
  payload[33] = checksum & 0xff;
  payload[34] = (checksum >>> 8) & 0xff;
  return base32Encode(payload);
}

function bytesFromHex(hex: string): Uint8Array {
  const normalized = hex.replace(/^0x/, '');
  if (normalized.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(normalized)) throw new Error('Invalid seed encoding.');
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function hmacSha512(keyBytes: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, data));
}

/** SLIP-0010 hardened Ed25519 derivation, implemented with browser Web Crypto. */
async function deriveEd25519PrivateKey(seed: Uint8Array): Promise<Uint8Array> {
  let digest = await hmacSha512(new TextEncoder().encode('ed25519 seed'), seed);
  let key = digest.slice(0, 32);
  let chainCode = digest.slice(32, 64);

  for (const childIndex of [44, 148, 0]) {
    const data = new Uint8Array(37);
    data[0] = 0;
    data.set(key, 1);
    const hardenedIndex = (childIndex + 0x80000000) >>> 0;
    data[33] = (hardenedIndex >>> 24) & 0xff;
    data[34] = (hardenedIndex >>> 16) & 0xff;
    data[35] = (hardenedIndex >>> 8) & 0xff;
    data[36] = hardenedIndex & 0xff;
    digest = await hmacSha512(chainCode, data);
    key = digest.slice(0, 32);
    chainCode = digest.slice(32, 64);
  }
  return key;
}

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

/** Derives the SEP-0005 primary Stellar account locally from a BIP-39 phrase. */
export async function deriveStellarAddress(phraseInput: string): Promise<string> {
  const phrase = phraseInput.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!Mnemonic.isValidMnemonic(phrase)) throw new Error('A valid recovery phrase is required to derive the Stellar account.');
  if (!globalThis.crypto?.subtle) throw new Error('This browser does not support secure Stellar key derivation.');
  const seedHex = Mnemonic.fromPhrase(phrase).computeSeed().replace(/^0x/, '');
  const privateKey = await deriveEd25519PrivateKey(bytesFromHex(seedHex));
  const publicKey = ed25519.getPublicKey(privateKey);
  const address = encodeStellarPublicKey(publicKey);
  if (!/^G[A-Z2-7]{55}$/.test(address)) throw new Error('Stellar key derivation returned an invalid public address.');
  return address;
}

/** Read-only XLM balance lookup. Only the public Stellar address is sent to Horizon. */
export async function readStellarSnapshot(phraseInput: string): Promise<StellarSnapshot> {
  const address = await deriveStellarAddress(phraseInput);
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
