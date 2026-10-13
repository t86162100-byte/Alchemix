import type { NativePriceMap, PriceDataProvider } from './types';

const API_BASE = 'https://api.coingecko.com/api/v3';

export const coinGeckoPriceProvider: PriceDataProvider = {
  id: 'coingecko-simple-price',
  async fetchNativePrices(assetIds, quoteCurrency = 'usd'): Promise<NativePriceMap> {
    if (!assetIds.length) return {};
    const query = new URLSearchParams({ ids: [...new Set(assetIds)].join(','), vs_currencies: quoteCurrency });
    const response = await fetch(API_BASE + '/simple/price?' + query.toString());
    if (!response.ok) throw new Error('Price source returned HTTP ' + response.status + '.');
    const payload = await response.json() as Record<string, Record<string, number | undefined> | undefined>;
    return Object.fromEntries(assetIds.map(id => [id, Number(payload[id]?.[quoteCurrency] || 0)]));
  },
};
