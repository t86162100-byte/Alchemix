import type { EvmMarketToken } from './evmMarketTokenService';

export type NonEvmMarketResult = {
  tokens: EvmMarketToken[];
  source: string;
  warning?: string;
};

type RawToken = {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  source: string;
};

type CacheEntry = { expiresAt: number; result: NonEvmMarketResult };
const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

const NATIVE_ASSETS: Record<string, { name: string; symbol: string; decimals: number; address: string; note?: string }> = {
  Solana: { name: 'Solana', symbol: 'SOL', decimals: 9, address: 'native:sol' },
  Tron: { name: 'TRON', symbol: 'TRX', decimals: 6, address: 'native:trx' },
  Bitcoin: { name: 'Bitcoin', symbol: 'BTC', decimals: 8, address: 'native:btc', note: 'Bitcoin mainnet has no ERC-20-style global token registry.' },
  Ton: { name: 'Toncoin', symbol: 'TON', decimals: 9, address: 'native:ton' },
  Stellar: { name: 'Stellar Lumens', symbol: 'XLM', decimals: 7, address: 'native:xlm' },
  Aptos: { name: 'Aptos', symbol: 'APT', decimals: 8, address: 'native:apt' },
  Cosmos: { name: 'Cosmos Hub Atom', symbol: 'ATOM', decimals: 6, address: 'native:uatom' },
  Doge: { name: 'Dogecoin', symbol: 'DOGE', decimals: 8, address: 'native:doge', note: 'Dogecoin mainnet has no standard global fungible-token registry.' },
  XRPL: { name: 'XRP', symbol: 'XRP', decimals: 6, address: 'native:xrp', note: 'XRPL issued assets depend on the issuer; XRP is the native asset.' },
  SUI: { name: 'Sui', symbol: 'SUI', decimals: 9, address: '0x2::sui::SUI' },
  'HyperLiquid L1': { name: 'Hyperliquid', symbol: 'HYPE', decimals: 8, address: 'native:hype' },
  Lighter: { name: 'USD collateral', symbol: 'USD', decimals: 6, address: 'exchange:usd', note: 'Lighter is an exchange account, not a general-purpose token chain.' },
};

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
    signal: init?.signal ?? AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<unknown>;
}

function validRawToken(token: Partial<RawToken>): token is RawToken {
  return typeof token.address === 'string' && token.address.length > 0
    && typeof token.name === 'string' && token.name.trim().length > 0
    && typeof token.symbol === 'string' && token.symbol.trim().length > 0
    && Number.isInteger(token.decimals) && (token.decimals as number) >= 0 && (token.decimals as number) <= 255;
}

function token(address: unknown, name: unknown, symbol: unknown, decimals: unknown, logoURI: unknown, source: string): RawToken | null {
  const candidate: Partial<RawToken> = {
    address: typeof address === 'string' ? address : '',
    name: typeof name === 'string' ? name.trim() : '',
    symbol: typeof symbol === 'string' ? symbol.trim() : '',
    decimals: Number(decimals),
    ...(typeof logoURI === 'string' && /^https:\/\//i.test(logoURI) ? { logoURI } : {}),
    source,
  };
  return validRawToken(candidate) ? candidate : null;
}

async function geckoTerminalSolanaTokens(): Promise<RawToken[]> {
  const discovered: RawToken[] = [];
  const seen = new Set<string>();
  // GeckoTerminal is a public fallback with no API key. Load several pages so
  // the directory remains useful even if Jupiter's legacy list endpoint is unavailable.
  for (let page = 1; page <= 5; page += 1) {
    const payload = await fetchJson(`https://api.geckoterminal.com/api/v2/networks/solana/tokens?page=${page}`);
    const records = (payload as any)?.data;
    if (!Array.isArray(records)) throw new Error('GeckoTerminal returned an unexpected Solana token list');
    for (const item of records) {
      const attrs = item?.attributes;
      const address = typeof attrs?.address === 'string'
        ? attrs.address
        : typeof item?.id === 'string' ? item.id.replace(/^solana_/, '') : '';
      const candidate = token(address, attrs?.name, attrs?.symbol, attrs?.decimals, attrs?.image_url, 'GeckoTerminal Solana token directory');
      if (!candidate || seen.has(candidate.address)) continue;
      seen.add(candidate.address);
      discovered.push(candidate);
    }
    if (records.length === 0) break;
  }
  if (!discovered.length) throw new Error('GeckoTerminal returned no usable Solana token metadata');
  return discovered;
}

async function solanaTokens(): Promise<{ tokens: RawToken[]; source: string; warning?: string }> {
  try {
    const payload = await fetchJson('https://tokens.jup.ag/tokens?tags=verified');
    if (!Array.isArray(payload)) throw new Error('Jupiter returned an unexpected token list');
    const tokens = payload.map((item: any) => token(item?.address, item?.name, item?.symbol, item?.decimals, item?.logoURI, 'Jupiter verified token list')).filter((item): item is RawToken => Boolean(item));
    if (tokens.length < 2) throw new Error('Jupiter legacy endpoint returned too few tokens');
    return { tokens, source: 'Jupiter verified token list' };
  } catch (jupiterError) {
    try {
      const tokens = await geckoTerminalSolanaTokens();
      return {
        tokens,
        source: 'GeckoTerminal Solana token directory (public fallback)',
        warning: `Jupiter's legacy token list was unavailable; showing assets discovered from GeckoTerminal instead. Token metadata is not a safety guarantee.`,
      };
    } catch (fallbackError) {
      const primaryMessage = jupiterError instanceof Error ? jupiterError.message : 'Jupiter request failed';
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : 'GeckoTerminal request failed';
      throw new Error(`Jupiter token list failed (${primaryMessage}); public fallback failed (${fallbackMessage}).`);
    }
  }
}
async function tronTokens(): Promise<RawToken[]> {
  const payload = await fetchJson('https://apilist.tronscanapi.com/api/token?sort=-marketcap&limit=200&start=0');
  const records = (payload as any)?.data;
  if (!Array.isArray(records)) throw new Error('TronScan returned an unexpected token list');
  return records.map((item: any) => token(item?.tokenId, item?.tokenName, item?.tokenAbbr, item?.tokenDecimal, item?.tokenLogo, 'TronScan public token directory')).filter((item): item is RawToken => Boolean(item));
}

async function stellarTokens(): Promise<RawToken[]> {
  const payload = await fetchJson('https://horizon.stellar.org/assets?limit=200&order=desc');
  const records = (payload as any)?._embedded?.records;
  if (!Array.isArray(records)) throw new Error('Stellar Horizon returned an unexpected asset list');
  return records.map((item: any) => token(
    `${item?.asset_code ?? ''}-${item?.asset_issuer ?? ''}`,
    item?.asset_code,
    item?.asset_code,
    7,
    undefined,
    'Stellar Horizon issued-asset directory',
  )).filter((item): item is RawToken => Boolean(item));
}

async function tonTokens(): Promise<RawToken[]> {
  const payload = await fetchJson('https://tonapi.io/v2/jettons?limit=100&offset=0');
  const records = (payload as any)?.jettons;
  if (!Array.isArray(records)) throw new Error('TON API returned an unexpected jetton list');
  return records.map((item: any) => token(item?.jetton?.address ?? item?.address, item?.metadata?.name ?? item?.name, item?.metadata?.symbol ?? item?.symbol, item?.metadata?.decimals ?? item?.decimals, item?.metadata?.image ?? item?.image, 'TON API jetton directory')).filter((item): item is RawToken => Boolean(item));
}

async function cosmosTokens(): Promise<RawToken[]> {
  const payload = await fetchJson('https://raw.githubusercontent.com/cosmos/chain-registry/master/cosmoshub/assetlist.json');
  const records = (payload as any)?.assets;
  if (!Array.isArray(records)) throw new Error('Cosmos chain registry returned an unexpected asset list');
  return records.map((item: any) => {
    const display = item?.display;
    const unit = Array.isArray(item?.denom_units) ? item.denom_units.find((entry: any) => entry?.denom === display) : undefined;
    return token(item?.base, item?.name, item?.symbol, unit?.exponent ?? 6, item?.logo_URIs?.png ?? item?.logo_URIs?.svg, 'Cosmos chain-registry asset list');
  }).filter((item): item is RawToken => Boolean(item));
}

async function coingeckoPlatformTokens(platform: 'aptos' | 'sui'): Promise<RawToken[]> {
  const payload = await fetchJson('https://api.coingecko.com/api/v3/coins/list?include_platform=true');
  if (!Array.isArray(payload)) throw new Error('CoinGecko returned an unexpected asset list');
  return payload.map((item: any) => {
    const contract = item?.platforms?.[platform];
    if (typeof contract !== 'string' || !contract) return null;
    return token(contract, item?.name, item?.symbol, 8, undefined, 'CoinGecko platform registry');
  }).filter((item): item is RawToken => Boolean(item));
}

async function hyperliquidTokens(): Promise<RawToken[]> {
  const payload = await fetchJson('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'spotMeta' }),
  });
  const records = (payload as any)?.tokens;
  if (!Array.isArray(records)) throw new Error('Hyperliquid returned an unexpected spot-token list');
  return records.map((item: any, index: number) => token(
    typeof item?.tokenId === 'number' ? `spot:${item.tokenId}` : `spot:${index}`,
    item?.name,
    item?.name,
    Number.isInteger(item?.weiDecimals) ? item.weiDecimals : 8,
    undefined,
    'Hyperliquid spot metadata',
  )).filter((item): item is RawToken => Boolean(item));
}

async function suiTokens(): Promise<RawToken[]> {
  return coingeckoPlatformTokens('sui');
}

async function loadRawTokens(network: string): Promise<{ tokens: RawToken[]; source: string }> {
  switch (network) {
    case 'Solana': return await solanaTokens();
    case 'Tron': return { tokens: await tronTokens(), source: 'TronScan public token directory' };
    case 'Stellar': return { tokens: await stellarTokens(), source: 'Stellar Horizon issued-asset directory' };
    case 'Ton': return { tokens: await tonTokens(), source: 'TON API jetton directory' };
    case 'Cosmos': return { tokens: await cosmosTokens(), source: 'Cosmos chain-registry asset list' };
    case 'Aptos': return { tokens: await coingeckoPlatformTokens('aptos'), source: 'CoinGecko platform registry' };
    case 'SUI': return { tokens: await suiTokens(), source: 'Sui public RPC metadata' };
    case 'HyperLiquid L1': return { tokens: await hyperliquidTokens(), source: 'Hyperliquid spot metadata' };
    default: return { tokens: [], source: 'Native asset metadata' };
  }
}

export async function loadNonEvmMarketTokenCatalog(network: string, forceRefresh = false): Promise<NonEvmMarketResult> {
  const native = NATIVE_ASSETS[network];
  if (!native) throw new Error(`No token directory is configured for ${network}.`);
  const cached = cache.get(network);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) return cached.result;

  const nativeToken: RawToken = { ...native, source: native.note ?? 'Native asset' };
  let rawTokens: RawToken[] = [];
  let source = 'Native asset metadata';
  let warning = '';
  try {
    const result = await loadRawTokens(network);
    rawTokens = result.tokens;
    source = result.source;
    if (!rawTokens.length) warning = ['Bitcoin', 'Doge', 'XRPL', 'Lighter'].includes(network)
      ? `${network} currently has no general global token registry configured here; showing the native asset or collateral entry only.`
      : `The public directory returned no listed assets for ${network}; showing its native asset only.`;
  } catch (error) {
    warning = `Could not load the live ${network} token registry (${error instanceof Error ? error.message : 'request failed'}). Showing the native asset where the network has one.`;
  }

  const unique = new Map<string, RawToken>();
  for (const item of [nativeToken, ...rawTokens]) {
    if (!validRawToken(item)) continue;
    const key = item.address.toLowerCase();
    if (!unique.has(key)) unique.set(key, item);
  }
  const tokens: EvmMarketToken[] = [...unique.values()]
    .map(item => ({
      chainId: 0,
      networkKey: network,
      networkName: network,
      networkType: 'Other' as const,
      address: item.address,
      name: item.name,
      symbol: item.symbol.toUpperCase(),
      decimals: item.decimals,
      ...(item.logoURI ? { logoURI: item.logoURI } : {}),
      tags: [],
      source: item.source,
    }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.symbol.localeCompare(b.symbol));
  const result = { tokens, source, ...(warning ? { warning } : {}) };
  cache.set(network, { expiresAt: Date.now() + CACHE_TTL_MS, result });
  return result;
}

export function clearNonEvmMarketTokenCache(network?: string): void {
  if (network) cache.delete(network);
  else cache.clear();
}
