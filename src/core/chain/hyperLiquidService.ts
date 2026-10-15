const DEFAULT_API = 'https://api.hyperliquid.xyz/info';
export type HyperLiquidSnapshot = { address: string; balanceHype: string; apiUrl: string };

function getApiUrl(): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const url = (env?.VITE_HYPERLIQUID_API_URL?.trim() || DEFAULT_API).replace(/\/$/, '');
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('HyperLiquid API URL is invalid.'); }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') throw new Error('HyperLiquid API must use HTTPS.');
  return url;
}

/** Read-only HyperCore spot balance lookup. Uses only the already-derived public EVM account address. */
export async function readHyperLiquidSnapshot(addressInput: string): Promise<HyperLiquidSnapshot> {
  const address = addressInput.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error('Unlock the wallet to load its HyperLiquid L1 account.');
  const apiUrl = getApiUrl();
  let response: Response;
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ type: 'spotClearinghouseState', user: address }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    throw new Error(`HyperLiquid API request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (response.status === 429) throw new Error('HyperLiquid API rate limit reached. Wait briefly and try again.');
  if (response.status === 401 || response.status === 403) throw new Error('HyperLiquid API access was denied.');
  if (!response.ok) throw new Error(`HyperLiquid API request failed (HTTP ${response.status}).`);
  const payload: unknown = await response.json();
  const balances = payload && typeof payload === 'object' ? (payload as { balances?: unknown }).balances : undefined;
  if (!Array.isArray(balances)) throw new Error('HyperLiquid API returned an unexpected spot balance response.');
  const hype = balances.find((item: any) => String(item?.coin ?? '').toUpperCase() === 'HYPE');
  const total = hype?.total;
  if (total === undefined || total === null || (typeof total !== 'string' && typeof total !== 'number')) {
    return { address, balanceHype: '0', apiUrl };
  }
  const amount = Number(total);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('HyperLiquid returned an invalid HYPE balance.');
  return { address, balanceHype: String(amount), apiUrl };
}
