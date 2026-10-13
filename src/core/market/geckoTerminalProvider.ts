import type { MarketDataProvider, MarketNetwork, MarketPoolPage } from './types';

const API_BASE = 'https://api.geckoterminal.com/api/v2';
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function requestJson<T>(url: string, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { accept: 'application/json;version=20230302' } });
      if (response.ok) return await response.json() as T;
      if (response.status !== 429 && response.status < 500) {
        if (response.status === 404) throw new Error('This network has no indexed market data in this source.');
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
    const found = new Map<string, MarketNetwork>();
    // Follow pagination sequentially to reduce throttling, with a safety ceiling.
    for (let page = 1; page <= 12; page += 1) {
      const payload = await requestJson<{ data?: Array<{ id?: string; attributes?: { name?: string; identifier?: string } }>; links?: { next?: string | null } }>(API_BASE + '/networks?page=' + page);
      const entries = payload.data || [];
      for (const entry of entries) {
        const id = entry.attributes?.identifier || entry.id?.replace(/^network_/, '');
        const name = entry.attributes?.name || id;
        if (id && name) found.set(id, { id, name });
      }
      if (!payload.links?.next || entries.length === 0) break;
      await wait(180);
    }
    return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
  },
  fetchPools(networkId: string, page = 1): Promise<MarketPoolPage> {
    const url = API_BASE + '/networks/' + encodeURIComponent(networkId) + '/pools?include=base_token,quote_token&page=' + page + '&sort=h24_volume_usd_desc';
    return requestJson<MarketPoolPage>(url);
  },
};
