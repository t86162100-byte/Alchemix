import { HDNodeWallet, Mnemonic, formatUnits, getAddress } from 'ethers';

export const TRON_DERIVATION_PATH = "m/44'/195'/0'/0/0";
const DEFAULT_TRON_API = 'https://api.trongrid.io';

export type TronSnapshot = {
  address: string;
  balanceSun: string;
  balanceTrx: string;
  blockNumber: number | null;
  apiUrl: string;
};

function getTronApiUrl(): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const configured = env?.VITE_TRON_API_URL?.trim();
  const url = configured || DEFAULT_TRON_API;
  let parsed: URL;
  try { parsed = new URL(url); } catch {
    throw new Error('Tron API URL is invalid. Configure VITE_TRON_API_URL with a valid HTTPS endpoint.');
  }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    throw new Error('Tron API must use HTTPS.');
  }
  return url.replace(/\/$/, '');
}

function base58Encode(bytes: Uint8Array): string {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  let encoded = '';
  while (value > 0n) {
    const remainder = Number(value % 58n);
    encoded = alphabet[remainder] + encoded;
    value /= 58n;
  }
  let leadingZeroes = 0;
  while (leadingZeroes < bytes.length && bytes[leadingZeroes] === 0) leadingZeroes++;
  return '1'.repeat(leadingZeroes) + (encoded || (leadingZeroes ? '' : '1'));
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new Uint8Array(await crypto.subtle.digest('SHA-256', copy.buffer));
}

async function tronBase58Address(ethereumAddress: string): Promise<string> {
  const hex = ethereumAddress.replace(/^0x/i, '').toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(hex)) throw new Error('Could not derive a valid Tron public address.');
  const payload = new Uint8Array(21);
  payload[0] = 0x41;
  for (let i = 0; i < 20; i++) payload[i + 1] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  const first = await sha256(payload);
  const second = await sha256(first);
  const full = new Uint8Array(25);
  full.set(payload);
  full.set(second.slice(0, 4), 21);
  return base58Encode(full);
}

/** Derive a TRON account from the same BIP-39 phrase using BIP-44 coin type 195. */
export async function deriveTronAddress(phraseInput: string): Promise<string> {
  const phrase = phraseInput.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!Mnemonic.isValidMnemonic(phrase)) {
    throw new Error('Unlock the wallet with its recovery phrase to derive the Tron account.');
  }
  const wallet = HDNodeWallet.fromPhrase(phrase, '', TRON_DERIVATION_PATH);
  // getAddress validates and normalizes the EVM-style 20-byte payload before TRON prefixing.
  return tronBase58Address(getAddress(wallet.address));
}

/** Read-only TronGrid account lookup. Only the derived public address is sent to the API. */
export async function readTronSnapshot(phraseInput: string): Promise<TronSnapshot> {
  const address = await deriveTronAddress(phraseInput);
  const apiUrl = getTronApiUrl();
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/v1/accounts/${encodeURIComponent(address)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    throw new Error(`Tron API request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (response.status === 429) throw new Error('Tron API rate limit reached. Wait briefly and try again.');
  if (response.status === 401 || response.status === 403) throw new Error('Tron API access was denied. Check the configured provider and API access settings.');
  if (!response.ok) throw new Error(`Tron API request failed (HTTP ${response.status}).`);

  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { data?: unknown }).data)) {
    throw new Error('Tron API returned an unexpected account response.');
  }
  const data = (payload as { data: Array<{ address?: unknown; balance?: unknown }> }).data;
  const account = data.find(item => item.address === address) ?? data[0];
  // An absent account is normal for a newly derived address and means zero TRX.
  const balance = account?.balance ?? 0;
  if (typeof balance !== 'number' && typeof balance !== 'string') {
    throw new Error('Tron API returned an invalid TRX balance.');
  }
  const balanceSun = BigInt(balance).toString();
  return {
    address,
    balanceSun,
    balanceTrx: formatUnits(BigInt(balanceSun), 6),
    blockNumber: null,
    apiUrl,
  };
}
