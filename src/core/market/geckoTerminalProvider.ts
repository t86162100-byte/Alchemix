import type { MarketDataProvider, MarketNetwork, MarketPoolPage } from './types';

const API_BASE = 'https://api.geckoterminal.com/api/v2';
const NETWORK_CACHE_KEY = 'nova-market-network-directory-v1';
const NETWORK_CACHE_TTL = 15 * 60 * 1000;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function requestJson<T>(url: string, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { accept: 'application/json;version=20230302' } });
      if (response.ok) return await response.json() as T;
      if (response.status !== 429 && response.status < 500) {
        if (response.status === 404) throw new Error('This source has no indexed market data for the selected chain.');
        throw new Error('Market source returned HTTP ' + response.status + '.');
      }
      lastError = new Error('Market source is temporarily unavailable (HTTP ' + response.status + ').');
    } catch (error) {
      if (error instanceof Error && !/fetch|network|temporarily unavailable/i.test(error.message)) throw error;
      lastError = error;
    }
    if (attempt + 1 < attempts) await wait(700 * (attempt + 1));
  }
  throw lastError instanceof Error ? lastError : new Error('Market source could not be reached.');
}

export const geckoTerminalProvider: MarketDataProvider = {
  id: 'geckoterminal',
  displayName: 'GeckoTerminal',
  async discoverNetworks(): Promise<MarketNetwork[]> {
    try {
      const cached = sessionStorage.getItem(NETWORK_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as { savedAt?: number; networks?: MarketNetwork[] };
        if (parsed.savedAt && Date.now() - parsed.savedAt < NETWORK_CACHE_TTL && Array.isArray(parsed.networks) && parsed.networks.length) return parsed.networks;
      }
    } catch { /* Storage can be disabled; fetch the live directory instead. */ }
    const found = new Map<string, MarketNetwork>();
    // Load a useful live directory slice sequentially to reduce rate limiting.
    for (let page = 1; page <= 3; page += 1) {
      const payload = await requestJson<{ data?: Array<{ id?: string; attributes?: { name?: string; identifier?: string } }>; links?: { next?: string | null } }>(API_BASE + '/networks?page=' + page);
      const entries = payload.data || [];
      for (const entry of entries) {
        const id = entry.attributes?.identifier || entry.id?.replace(/^network_/, '');
        const name = entry.attributes?.name || id;
        if (id && name) found.set(id, { id, name });
      }
      if (!payload.links?.next || entries.length === 0) break;
      await wait(400);
    }
    const networks = [...found.values()];
    if (!networks.length) throw new Error('Market network directory returned no networks.');
    try { sessionStorage.setItem(NETWORK_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), networks })); } catch { /* Storage can be disabled. */ }
    return networks;
  },
  fetchPools(networkId: string, page = 1): Promise<MarketPoolPage> {
    const url = API_BASE + '/networks/' + encodeURIComponent(networkId) + '/pools?include=base_token,quote_token&page=' + page + '&sort=h24_volume_usd_desc';
    return requestJson<MarketPoolPage>(url);
  },
};
