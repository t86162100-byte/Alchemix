const DEFAULT_API = 'https://mainnet.zklighter.elliot.ai';
export type LighterSnapshot = {
  address: string;
  accountCount: number;
  collateralUsd: string;
  apiUrl: string;
};

function getApiUrl(): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const url = (env?.VITE_LIGHTER_API_URL?.trim() || DEFAULT_API).replace(/\/$/, '');
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('Lighter API URL is invalid.'); }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    throw new Error('Lighter API must use HTTPS.');
  }
  return url;
}

/** Read-only lookup of public Lighter accounts associated with the wallet's EVM address. */
export async function readLighterSnapshot(addressInput: string): Promise<LighterSnapshot> {
  const address = addressInput.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error('Unlock the wallet to look up its Lighter accounts.');
  const apiUrl = getApiUrl();
  let response: Response;
  try {
    const query = new URLSearchParams({ by: 'l1_address', value: address });
    response = await fetch(`${apiUrl}/api/v1/account?${query.toString()}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    throw new Error(`Lighter API request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (response.status === 429) throw new Error('Lighter API rate limit reached. Wait briefly and try again.');
  if (response.status === 401 || response.status === 403) throw new Error('Lighter API access was denied.');
  if (!response.ok) throw new Error(`Lighter API request failed (HTTP ${response.status}).`);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object') throw new Error('Lighter API returned an unexpected account response.');
  const record = payload as { accounts?: unknown; code?: unknown };
  if (record.code !== undefined && Number(record.code) !== 200 && Number(record.code) !== 0) {
    throw new Error(`Lighter API returned error code ${String(record.code)}.`);
  }
  if (!Array.isArray(record.accounts)) throw new Error('Lighter API response did not contain an accounts list.');
  let collateral = 0;
  for (const item of record.accounts) {
    if (!item || typeof item !== 'object') continue;
    const value = (item as { collateral?: unknown }).collateral;
    if (typeof value === 'string' || typeof value === 'number') {
      const amount = Number(value);
      if (Number.isFinite(amount) && amount >= 0) collateral += amount;
    }
  }
  return { address, accountCount: record.accounts.length, collateralUsd: collateral.toString(), apiUrl };
}
