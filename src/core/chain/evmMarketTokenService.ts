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
type CoinGeckoPlatform = { id?: string; chain_identifier?: string | number; name?: string };
type CachedPlatforms = { expiresAt: number; platforms: CoinGeckoPlatform[] };

const TOKEN_LIST_CACHE_TTL_MS = 30 * 60 * 1000;
const PLATFORM_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const tokenCache = new Map<number, { expiresAt: number; tokens: EvmMarketToken[] }>();
let platformCache: CachedPlatforms | null = null;

async function loadCoinGeckoPlatforms(): Promise<CoinGeckoPlatform[]> {
  if (platformCache && platformCache.expiresAt > Date.now()) return platformCache.platforms;
  const response = await fetch('https://api.coingecko.com/api/v3/asset_platforms', {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Chain registry responded with HTTP ${response.status}.`);
  const payload = await response.json() as unknown;
  if (!Array.isArray(payload)) throw new Error('Chain registry returned an invalid response.');
  const platforms = payload.filter((item): item is CoinGeckoPlatform => Boolean(
    item && typeof item === 'object' && typeof (item as CoinGeckoPlatform).id === 'string',
  ));
  platformCache = { expiresAt: Date.now() + PLATFORM_CACHE_TTL_MS, platforms };
  return platforms;
}

async function resolveTokenListUrls(chainId: number, networkName: string): Promise<string[]> {
  const platforms = await loadCoinGeckoPlatforms();
  const matchingPlatforms = platforms
    .filter(platform => Number(platform.chain_identifier) === chainId && typeof platform.id === 'string')
    .map(platform => platform.id as string);
  // The platform registry is live, so newly supported EVM chains do not require
  // a token-address catalogue or a chain-ID edit in Ferra.
  const urls = matchingPlatforms.map(platform => `https://tokens.coingecko.com/${encodeURIComponent(platform)}/all.json`);
  // A final name-derived candidate helps when a registry platform has no chain ID.
  const nameSlug = networkName.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (nameSlug) urls.push(`https://tokens.coingecko.com/${encodeURIComponent(nameSlug)}/all.json`);
  return [...new Set(urls)];
}

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

  let urls: string[];
  try {
    urls = await resolveTokenListUrls(chainId, networkName);
  } catch (error) {
    throw new Error(`Could not discover the token registry for ${networkName}. ${error instanceof Error ? error.message : 'Chain registry unavailable.'}`);
  }
  if (!urls.length) {
    throw new Error(`No public token-list registry was found for ${networkName} (chain ID ${chainId}). The network stays selectable, but its registry does not currently publish a matching token directory.`);
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
  if (typeof chainId !== 'number') platformCache = null;
}
