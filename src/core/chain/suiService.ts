import { Mnemonic } from 'ethers';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

const DEFAULT_API = 'https://sui-rpc.publicnode.com';
export const SUI_DERIVATION_PATH = "m/44'/784'/0'/0'/0'";
export type SuiSnapshot = { address: string; balanceSui: string; apiUrl: string };

function getApiUrl(): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const url = (env?.VITE_SUI_RPC_URL?.trim() || DEFAULT_API).replace(/\/$/, '');
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('Sui RPC URL is invalid.'); }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') throw new Error('Sui RPC must use HTTPS.');
  return url;
}

/** Derive the standard Sui Ed25519 address locally from the BIP-39 recovery phrase. */
export function deriveSuiAddress(input: string): string {
  const phrase = input.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!Mnemonic.isValidMnemonic(phrase)) throw new Error('A valid recovery phrase is required to derive the Sui account.');
  return Ed25519Keypair.deriveKeypair(phrase, SUI_DERIVATION_PATH).getPublicKey().toSuiAddress();
}

/** Read the native SUI balance from a public Sui JSON-RPC provider. */
export async function readSuiSnapshot(input: string): Promise<SuiSnapshot> {
  const address = deriveSuiAddress(input);
  const apiUrl = getApiUrl();
  let response: Response;
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'suix_getBalance', params: [address, '0x2::sui::SUI'] }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    throw new Error(`Sui RPC request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (response.status === 429) throw new Error('Sui RPC rate limit reached. Wait briefly and try again.');
  if (response.status === 401 || response.status === 403) throw new Error('Sui RPC access was denied.');
  if (!response.ok) throw new Error(`Sui RPC request failed (HTTP ${response.status}).`);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object') throw new Error('Sui RPC returned an unexpected response.');
  const outer = payload as { result?: { totalBalance?: unknown }; error?: { message?: string } };
  if (outer.error) throw new Error(outer.error.message || 'Sui RPC balance lookup failed.');
  const total = outer.result?.totalBalance;
  if (typeof total !== 'string' && typeof total !== 'number') throw new Error('Sui RPC returned no native balance.');
  const raw = BigInt(total).toString().padStart(10, '0');
  const formatted = `${raw.slice(0, -9) || '0'}.${raw.slice(-9)}`.replace(/\.?0+$/, '');
  return { address, balanceSui: formatted || '0', apiUrl };
}
