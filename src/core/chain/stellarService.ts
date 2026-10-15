import { Mnemonic } from 'ethers';
import { derivePath } from 'ed25519-hd-key';
import { ed25519 } from '@noble/curves/ed25519';

const DEFAULT_HORIZON = 'https://horizon.stellar.org';
export const STELLAR_DERIVATION_PATH = "m/44'/148'/0'";

export type StellarSnapshot = {
  address: string;
  balanceXlm: string;
  apiUrl: string;
};

// Stellar StrKey uses RFC 4648 base32 and CRC16-XModem (checksum bytes are little-endian).
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
    for (let bit = 0; bit < 8; bit++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}
function encodeStellarPublicKey(publicKey: Uint8Array): string {
  if (publicKey.length !== 32) throw new Error('Stellar public key must be 32 bytes.');
  const payload = new Uint8Array(35);
  payload[0] = 6 << 3; // Version byte for ed25519 public key (G...)
  payload.set(publicKey, 1);
  const checksum = crc16Xmodem(payload.subarray(0, 33));
  payload[33] = checksum & 0xff;
  payload[34] = (checksum >>> 8) & 0xff;
  return base32Encode(payload);
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

/** Derives a Stellar Ed25519 account locally from the wallet's BIP-39 phrase. */
export function deriveStellarAddress(phraseInput: string): string {
  const phrase = phraseInput.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!Mnemonic.isValidMnemonic(phrase)) throw new Error('A valid recovery phrase is required to derive the Stellar account.');
  const seedHex = Mnemonic.fromPhrase(phrase).computeSeed().replace(/^0x/, '');
  const derived = derivePath(STELLAR_DERIVATION_PATH, seedHex);
  const publicKey = ed25519.getPublicKey(derived.key);
  return encodeStellarPublicKey(publicKey);
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
