export type MarketMetrics = {
  priceUsd?: number;
  priceChange?: { h1?: number; h6?: number; h24?: number };
  volume?: { h24?: number };
  marketCap?: number;
  fdv?: number;
  liquidity?: { usd?: number };
  pairAddress?: string;
  dexId?: string;
};
type Pair = {
  chainId?: string;
  baseToken?: { address?: string };
  quoteToken?: { address?: string };
  priceUsd?: string;
  priceChange?: { h1?: number; h6?: number; h24?: number };
  volume?: { h24?: number };
  marketCap?: number;
  fdv?: number;
  liquidity?: { usd?: number };
  pairAddress?: string;
  dexId?: string;
};
const dexChains: Record<number, string> = { 1:'ethereum', 56:'bsc', 8453:'base', 137:'polygon', 42161:'arbitrum', 10:'optimism', 43114:'avalanche', 5000:'mantle' };
export async function fetchDexMarketMetrics(results: Array<{ chainId:number; tokens:Array<{address:string}> }>): Promise<Record<string,MarketMetrics>> {
  const targets = results.flatMap(result => {
    const dexChain = dexChains[result.chainId];
    if (!dexChain) return [];
    return result.tokens.filter(token => /^0x[a-fA-F0-9]{40}$/.test(token.address) && token.address.toLowerCase() !== '0x0000000000000000000000000000000000000000')
      .map(token => ({ token, chainId:result.chainId, dexChain }));
  });
  const chunks: Array<typeof targets> = [];
  for (const target of targets) {
    const last = chunks[chunks.length - 1];
    if (!last || last.length >= 30 || last[0].chainId !== target.chainId) chunks.push([target]);
    else last.push(target);
  }
  const responses = await Promise.all(chunks.map(async chunk => {
    try {
      const response = await fetch('https://api.dexscreener.com/tokens/v1/' + chunk[0].dexChain + '/' + chunk.map(item => item.token.address).join(','));
      if (!response.ok) return [] as Array<[string,MarketMetrics]>;
      const payload = await response.json() as { pairs?: Pair[] };
      const best = new Map<string,Pair>();
      for (const pair of payload.pairs || []) {
        if (pair.chainId !== chunk[0]?.dexChain || !pair.baseToken?.address) continue;
        const target = chunk.find(item => item.token.address.toLowerCase() === pair.baseToken!.address!.toLowerCase());
        if (!target) continue;
        const liquidity = Number(pair.liquidity?.usd || 0);
        const volume = Number(pair.volume?.h24 || 0);
        const price = Number(pair.priceUsd || 0);
        if (!Number.isFinite(price) || price <= 0 || liquidity < 10000 || volume < 1000) continue;
        const key = target.chainId + ':' + target.token.address.toLowerCase();
        const previous = best.get(key);
        if (!previous || Number(pair.liquidity?.usd || 0) > Number(previous.liquidity?.usd || 0)) best.set(key,pair);
      }
      return [...best.entries()].map(([key,pair]) => [key,{
        priceUsd:Number(pair.priceUsd), priceChange:pair.priceChange, volume:pair.volume,
        marketCap:pair.marketCap, fdv:pair.fdv, liquidity:pair.liquidity, pairAddress:pair.pairAddress, dexId:pair.dexId
      } as MarketMetrics] as [string,MarketMetrics]);
    } catch { return [] as Array<[string,MarketMetrics]>; }
  }));
  return Object.fromEntries(responses.flat());
}
