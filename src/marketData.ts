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
const dexChains: Record<number, string> = { 1:'ethereum', 56:'bsc', 8453:'base', 137:'polygon', 42161:'arbitrum', 10:'optimism', 43114:'avalanche', 5000:'mantle', 16661:'0g', 2741:'abstract', 33139:'apechain', 42170:'arbitrum-nova', 5042:'arc', 80094:'berachain', 81457:'blast', 60808:'bob', 288:'boba', 42220:'celo', 25:'cronos', 42793:'etherlink', 14:'flare', 747:'flow', 252:'fraxtal', 122:'fuse', 100:'gnosis', 1625:'gravity', 43111:'hemi', 999:'hyperevm', 1337:'hyperliquid', 13371:'immutable-zkevm', 1776:'injective', 57073:'ink', 8217:'kaia', 747474:'katana', 59144:'linea', 1135:'lisk', 1088:'metis', 34443:'mode', 143:'monad', 2818:'morph', 204:'opbnb', 9745:'plasma', 98866:'plume', 4663:'robinhood', 2020:'ronin', 30:'rootstock', 534352:'scroll', 1329:'sei', 5031:'somnia', 1868:'soneium', 146:'sonic', 988:'stable', 40:'telos', 130:'unichain', 1480:'vana', 88:'viction', 480:'world-chain', 50:'xdc', 196:'xlayer', 324:'zksync', 250:'fantom', 7777777:'zora' };
const geckoNetworks: Record<number, string> = { 1:'eth',56:'bsc',8453:'base',137:'polygon_pos',42161:'arbitrum',10:'optimism',43114:'avax',5000:'mantle',16661:'0g',2741:'abstract',33139:'ape_chain',42170:'arbitrum_nova',5042:'arc',80094:'berachain',81457:'blast',60808:'bob',288:'boba',42220:'celo',25:'cronos',42793:'etherlink',14:'flare',747:'flow',252:'fraxtal',122:'fuse',100:'xdai',1625:'gravity',43111:'hemi',999:'hyperevm',1337:'hyperliquid',13371:'immutable_zkevm',57073:'ink',8217:'kaia',747474:'katana',59144:'linea',1135:'lisk',1088:'metis',34443:'mode',143:'monad',2818:'morph',204:'opbnb',9745:'plasma',98866:'plume',4663:'robinhood',2020:'ronin',30:'rootstock',534352:'scroll',1329:'sei',5031:'somnia',1868:'soneium',146:'sonic',988:'stable',40:'telos',130:'unichain',1480:'vana',88:'viction',480:'world_chain',50:'xdc',196:'xlayer',324:'zksync',250:'ftm',7777777:'zora' };
const validAddress = (address: string) => /^0x[a-fA-F0-9]{40}$/.test(address) && address.toLowerCase() !== '0x0000000000000000000000000000000000000000';
const asNumber = (value: string | number | null | undefined): number | undefined => {
  if (value == null || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};
type GeckoPrices = { data?: { attributes?: { token_prices?: Record<string,string|number>; market_cap_usd?: Record<string,string|number|null>; h24_volume_usd?: Record<string,string|number|null>; h24_price_change_percentage?: Record<string,string|number|null>; total_reserve_in_usd?: Record<string,string|number|null> } } };

export async function fetchDexMarketMetrics(results: Array<{ chainId:number; tokens:Array<{address:string}> }>): Promise<Record<string,MarketMetrics>> {
  const metrics: Record<string,MarketMetrics> = {};
  const normalized = results.map(result => ({ chainId: result.chainId, tokens: [...new Map(result.tokens.filter(token => validAddress(token.address)).map(token => [token.address.toLowerCase(), token])).values()] }));
  // DexScreener supplies detailed metrics; select the most liquid pair per token.
  const dexChunks = normalized.flatMap(result => {
    const chain = dexChains[result.chainId];
    if (!chain) return [];
    const chunks: Array<{chainId:number;chain:string;tokens:Array<{address:string}>}> = [];
    for (let i=0;i<result.tokens.length;i+=30) chunks.push({chainId:result.chainId,chain,tokens:result.tokens.slice(i,i+30)});
    return chunks;
  });
  const dexResults = await Promise.all(dexChunks.map(async chunk => {
    try {
      const response = await fetch('https://api.dexscreener.com/tokens/v1/'+chunk.chain+'/'+chunk.tokens.map(token=>token.address).join(','), { cache: 'no-cache' });
      if (!response.ok) return [];
      // DexScreener /tokens/v1 returns a JSON array directly (not { pairs: [...] }).
      // Accept both shapes so a provider response is never silently treated as empty.
      const payload = await response.json() as Pair[] | { pairs?: Pair[] };
      const pairs = Array.isArray(payload) ? payload : (payload.pairs || []);
      const requested = new Set(chunk.tokens.map(token=>token.address.toLowerCase()));
      const best = new Map<string,Pair>();
      for (const pair of pairs) {
        const address = pair.baseToken?.address?.toLowerCase();
        const price = asNumber(pair.priceUsd);
        const change = pair.priceChange?.h24;
        if (pair.chainId !== chunk.chain || !address || !requested.has(address) || price === undefined || price <= 0) continue;
        // Ignore clearly corrupted provider values rather than presenting them as market data.
        if (change !== undefined && (!Number.isFinite(change) || Math.abs(change) > 10000)) continue;
        const prior = best.get(address);
        if (!prior || Number(pair.liquidity?.usd || 0) > Number(prior.liquidity?.usd || 0)) best.set(address,pair);
      }
      return [...best.entries()].map(([address,pair]) => [chunk.chainId+':'+address,{
        priceUsd:asNumber(pair.priceUsd),priceChange:pair.priceChange,volume:pair.volume,
        marketCap:pair.marketCap,fdv:pair.fdv,liquidity:pair.liquidity,pairAddress:pair.pairAddress,dexId:pair.dexId
      } as MarketMetrics] as [string,MarketMetrics]);
    } catch { return []; }
  }));
  Object.assign(metrics,Object.fromEntries(dexResults.flat()));

  // Fill missing prices through GeckoTerminal's dedicated price endpoint, in
  // same-network batches of at most 30 contract addresses.
  const fallbackRequests = normalized.flatMap(result => {
    const network = geckoNetworks[result.chainId];
    if (!network) return [];
    const missing = result.tokens.filter(token => {
      const item = metrics[result.chainId+':'+token.address.toLowerCase()];
      return !item || !(item.priceUsd && item.priceUsd > 0);
    });
    const chunks: Array<{chainId:number;network:string;tokens:Array<{address:string}>}> = [];
    for (let i=0;i<missing.length;i+=30) chunks.push({chainId:result.chainId,network,tokens:missing.slice(i,i+30)});
    return chunks;
  });
  const fallbackResults = await Promise.all(fallbackRequests.map(async request => {
    try {
      const url = 'https://api.geckoterminal.com/api/v2/simple/networks/'+encodeURIComponent(request.network)+'/token_price/'+request.tokens.map(token=>token.address).join(',')+'?include_market_cap=true&include_24hr_vol=true&include_24hr_price_change=true&include_total_reserve_in_usd=true';
      const response = await fetch(url,{headers:{accept:'application/json;version=20230203'},signal:AbortSignal.timeout(10000),cache:'no-cache'});
      if (!response.ok) return [];
      const attributes = ((await response.json()) as GeckoPrices).data?.attributes;
      const prices = attributes?.token_prices || {};
      return Object.entries(prices).flatMap(([rawAddress,rawPrice]) => {
        const address = rawAddress.toLowerCase();
        const priceUsd = asNumber(rawPrice);
        if (priceUsd === undefined || priceUsd <= 0) return [];
        const key = request.chainId+':'+address;
        const prior = metrics[key] || {};
        const marketCap = asNumber(attributes?.market_cap_usd?.[rawAddress]);
        const volume = asNumber(attributes?.h24_volume_usd?.[rawAddress]);
        const change = asNumber(attributes?.h24_price_change_percentage?.[rawAddress]);
        const liquidity = asNumber(attributes?.total_reserve_in_usd?.[rawAddress]);
        return [[key,{
          ...prior,priceUsd,
          marketCap:prior.marketCap ?? marketCap,
          volume:prior.volume ?? (volume === undefined ? undefined : {h24:volume}),
          priceChange:prior.priceChange ?? (change === undefined ? undefined : {h24:change}),
          liquidity:prior.liquidity ?? (liquidity === undefined ? undefined : {usd:liquidity})
        } as MarketMetrics] as [string,MarketMetrics]];
      });
    } catch { return []; }
  }));
  return Object.assign(metrics,Object.fromEntries(fallbackResults.flat()));
}
