export type EvmMarketToken = {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  tags: string[];
  source: string;
};

type TokenListToken = {
  chainId?: number;
  address?: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  logoURI?: string;
  tags?: Array<string | { name?: string }>;
};
type TokenListResponse = { tokens?: TokenListToken[] };

const TOKEN_LIST_CACHE_TTL_MS = 30 * 60 * 1000;
const tokenCache = new Map<number, { expiresAt: number; tokens: EvmMarketToken[] }>();

// These are registry/platform identifiers, not token addresses or a fixed token catalogue.
// The token entries themselves are fetched live from the registry for each chain.
const COINGECKO_PLATFORM_BY_CHAIN: Record<number, string[]> = {
  1: ['ethereum'],
  56: ['binance-smart-chain'],
  8453: ['base'],
  137: ['polygon-pos'],
  42161: ['arbitrum-one'],
  10: ['optimistic-ethereum'],
  43114: ['avalanche'],
  100: ['xdai'],
  42220: ['celo'],
  59144: ['linea'],
  324: ['zksync'],
  534352: ['scroll'],
  81457: ['blast'],
  5000: ['mantle'],
  204: ['opbnb'],
  146: ['sonic'],
  130: ['unichain'],
  250: ['fantom'],
  25: ['cronos'],
  288: ['boba'],
  1101: ['polygon-zkevm'],
  7777777: ['zora'],
  34443: ['mode'],
  252: ['fraxtal'],
  122: ['fuse'],
  10000: ['smartbch'],
  1284: ['moonbeam'],
  1285: ['moonriver'],
  1666600000: ['harmony-shard-0'],
  66: ['okexchain'],
  199: ['bttc'],
  7000: ['zetachain'],
  169: ['manta-pacific'],
  2741: ['abstract'],
  33139: ['apechain'],
  80094: ['berachain'],
};

const TOKEN_LIST_URLS: Record<number, string[]> = {
  1: ['https://tokens.coingecko.com/ethereum/all.json'],
  56: ['https://tokens.coingecko.com/binance-smart-chain/all.json'],
  8453: ['https://tokens.coingecko.com/base/all.json'],
  137: ['https://tokens.coingecko.com/polygon-pos/all.json'],
  42161: ['https://tokens.coingecko.com/arbitrum-one/all.json'],
  10: ['https://tokens.coingecko.com/optimistic-ethereum/all.json'],
  43114: ['https://tokens.coingecko.com/avalanche/all.json'],
  100: ['https://tokens.coingecko.com/xdai/all.json'],
  42220: ['https://tokens.coingecko.com/celo/all.json'],
  59144: ['https://tokens.coingecko.com/linea/all.json'],
  324: ['https://tokens.coingecko.com/zksync/all.json'],
  534352: ['https://tokens.coingecko.com/scroll/all.json'],
  81457: ['https://tokens.coingecko.com/blast/all.json'],
  5000: ['https://tokens.coingecko.com/mantle/all.json'],
  204: ['https://tokens.coingecko.com/opbnb/all.json'],
  146: ['https://tokens.coingecko.com/sonic/all.json'],
  130: ['https://tokens.coingecko.com/unichain/all.json'],
  250: ['https://tokens.coingecko.com/fantom/all.json'],
  25: ['https://tokens.coingecko.com/cronos/all.json'],
  288: ['https://tokens.coingecko.com/boba/all.json'],
  1101: ['https://tokens.coingecko.com/polygon-zkevm/all.json'],
  7777777: ['https://tokens.coingecko.com/zora/all.json'],
  34443: ['https://tokens.coingecko.com/mode/all.json'],
  252: ['https://tokens.coingecko.com/fraxtal/all.json'],
  122: ['https://tokens.coingecko.com/fuse/all.json'],
  10000: ['https://tokens.coingecko.com/smartbch/all.json'],
  1284: ['https://tokens.coingecko.com/moonbeam/all.json'],
  1285: ['https://tokens.coingecko.com/moonriver/all.json'],
  1666600000: ['https://tokens.coingecko.com/harmony-shard-0/all.json'],
  66: ['https://tokens.coingecko.com/okexchain/all.json'],
  199: ['https://tokens.coingecko.com/bttc/all.json'],
  7000: ['https://tokens.coingecko.com/zetachain/all.json'],
  169: ['https://tokens.coingecko.com/manta-pacific/all.json'],
  2741: ['https://tokens.coingecko.com/abstract/all.json'],
  33139: ['https://tokens.coingecko.com/apechain/all.json'],
  80094: ['https://tokens.coingecko.com/berachain/all.json'],
};

function isValidToken(token: TokenListToken, chainId: number): token is Required<Pick<TokenListToken, 'chainId' | 'address' | 'name' | 'symbol' | 'decimals'>> & TokenListToken {
  return token.chainId === chainId
    && typeof token.address === 'string'
    && /^0x[a-fA-F0-9]{40}$/.test(token.address)
    && typeof token.name === 'string' && token.name.trim().length > 0
    && typeof token.symbol === 'string' && token.symbol.trim().length > 0
    && Number.isInteger(token.decimals) && (token.decimals as number) >= 0 && (token.decimals as number) <= 255;
}

export async function loadEvmMarketTokenCatalog(chainId: number, networkName: string): Promise<EvmMarketToken[]> {
  const cached = tokenCache.get(chainId);
  if (cached && cached.expiresAt > Date.now()) return cached.tokens;

  const urls = TOKEN_LIST_URLS[chainId] ?? COINGECKO_PLATFORM_BY_CHAIN[chainId]?.map(platform => `https://tokens.coingecko.com/${platform}/all.json`) ?? [];
  if (!urls.length) {
    throw new Error(`No public token-list registry is configured for ${networkName} (chain ID ${chainId}) yet. The network remains selectable, but its token directory needs a registry source.`);
  }

  let lastError = 'Token registry returned no usable tokens.';
  for (const url of urls) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`Token registry responded with HTTP ${response.status}.`);
      const payload = await response.json() as TokenListResponse;
      if (!Array.isArray(payload.tokens)) throw new Error('Token registry response did not contain a token list.');
      const deduplicated = new Map<string, EvmMarketToken>();
      for (const raw of payload.tokens) {
        if (!isValidToken(raw, chainId)) continue;
        const key = raw.address.toLowerCase();
        if (deduplicated.has(key)) continue;
        deduplicated.set(key, {
          chainId,
          address: raw.address,
          name: raw.name.trim(),
          symbol: raw.symbol.trim(),
          decimals: raw.decimals,
          ...(typeof raw.logoURI === 'string' && /^https:\/\//i.test(raw.logoURI) ? { logoURI: raw.logoURI } : {}),
          tags: Array.isArray(raw.tags) ? raw.tags.map(tag => typeof tag === 'string' ? tag : tag?.name ?? '').filter(Boolean) : [],
          source: 'CoinGecko token list',
        });
      }
      const tokens = [...deduplicated.values()].sort((a, b) => a.name.localeCompare(b.name) || a.symbol.localeCompare(b.symbol));
      if (!tokens.length) throw new Error('The token registry returned no tokens for this chain.');
      tokenCache.set(chainId, { expiresAt: Date.now() + TOKEN_LIST_CACHE_TTL_MS, tokens });
      return tokens;
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Could not load the public token registry.';
    }
  }
  throw new Error(`Could not load the token directory for ${networkName}. ${lastError}`);
}

export function clearEvmMarketTokenCache(chainId?: number): void {
  if (typeof chainId === 'number') tokenCache.delete(chainId);
  else tokenCache.clear();
}
