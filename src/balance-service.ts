export type AssetBalance = {
  id: string;
  chainId: string;
  chainName: string;
  kind: 'native' | 'token';
  name: string;
  symbol: string;
  balance: string;
  decimals: number;
  contractAddress?: string;
  mintAddress?: string;
  usdValue?: number;
  priceSource?: string;
  source: string;
};

export type ChainBalanceResult = {
  id: string;
  name: string;
  nativeSymbol: string;
  address: string;
  status: 'loading' | 'success' | 'partial' | 'error' | 'unavailable';
  message: string;
  assets: AssetBalance[];
  updatedAt?: number;
};

export type PortfolioSnapshot = {
  chains: ChainBalanceResult[];
  updatedAt: number;
  totalUsd?: number;
  pricedAssets: number;
  unpricedAssets: number;
};

type ChainConfig = {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  family: 'evm' | 'solana' | 'bitcoin' | 'tron';
  chainId?: number;
  rpcUrls?: string[];
  explorerBase?: string;
  registryId: string;
};

const CHAINS: ChainConfig[] = [
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', decimals: 18, family: 'evm', chainId: 1, registryId: 'ethereum', rpcUrls: ['https://ethereum-rpc.publicnode.com', 'https://cloudflare-eth.com'], explorerBase: 'https://eth.blockscout.com' },
  { id: 'bsc', name: 'BNB Chain', symbol: 'BNB', decimals: 18, family: 'evm', chainId: 56, registryId: 'smartchain', rpcUrls: ['https://bsc-rpc.publicnode.com', 'https://bsc-dataseed.binance.org'], explorerBase: 'https://bscscan.com' },
  { id: 'base', name: 'Base', symbol: 'ETH', decimals: 18, family: 'evm', chainId: 8453, registryId: 'base', rpcUrls: ['https://base-rpc.publicnode.com', 'https://mainnet.base.org'], explorerBase: 'https://base.blockscout.com' },
  { id: 'solana', name: 'Solana', symbol: 'SOL', decimals: 9, family: 'solana', registryId: 'solana' },
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', decimals: 8, family: 'bitcoin', registryId: 'bitcoin' },
  { id: 'tron', name: 'Tron', symbol: 'TRX', decimals: 6, family: 'tron', registryId: 'tron' },
];

const runtimeEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};
const ALCHEMY_API_KEY = runtimeEnv.VITE_ALCHEMY_API_KEY?.trim() ?? '';
const configuredSolanaRpc = runtimeEnv.VITE_SOLANA_RPC_URL?.trim() ?? '';
const SOLANA_RPC = [
  ...(configuredSolanaRpc ? [configuredSolanaRpc] : []),
  'https://api.mainnet.solana.com',
  'https://api.mainnet-beta.solana.com',
];
const SOLANA_TOKEN_PROGRAMS = [
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
];

const COINGECKO_IDS: Record<string, string> = {
  ETH: 'ethereum',
  BNB: 'binancecoin',
  SOL: 'solana',
  BTC: 'bitcoin',
  TRX: 'tron',
};

function timeoutSignal(ms = 25000): AbortSignal {
  return AbortSignal.timeout(ms);
}

async function getJson(url: string, timeoutMs = 25000): Promise<any> {
  const response = await fetch(url, { signal: timeoutSignal(timeoutMs), headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
  return response.json();
}

async function rpc(url: string, method: string, params: unknown[]): Promise<any> {
  const response = await fetch(url, {
    method: 'POST',
    signal: timeoutSignal(),
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`RPC returned HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(String(payload.error.message ?? 'RPC request failed'));
  return payload.result;
}

function amountFromRaw(raw: string, decimals: number): string {
  try {
    const value = BigInt(raw);
    const base = 10n ** BigInt(decimals);
    const whole = value / base;
    const fraction = (value % base).toString().padStart(decimals, '0').replace(/0+$/, '');
    return fraction ? `${whole}.${fraction}` : whole.toString();
  } catch {
    return '0';
  }
}

function numeric(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function tokenMetadataSafe(address: unknown, decimals: unknown, symbol: unknown): address is string {
  return typeof address === 'string'
    && /^0x[a-fA-F0-9]{40}$/.test(address)
    && !/^0x0{40}$/i.test(address)
    && Number.isInteger(Number(decimals))
    && Number(decimals) >= 0
    && Number(decimals) <= 36
    && typeof symbol === 'string'
    && symbol.trim().length > 0
    && symbol.trim().length <= 24;
}

function dedupeAssets(assets: AssetBalance[]): AssetBalance[] {
  const seen = new Set<string>();
  return assets.filter((asset) => {
    const key = asset.kind === 'token'
      ? `${asset.chainId}:${(asset.contractAddress ?? asset.mintAddress ?? asset.id).toLowerCase()}`
      : `${asset.chainId}:native:${asset.symbol}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchEvmNative(config: ChainConfig, address: string): Promise<AssetBalance> {
  let lastError: unknown;
  for (const url of config.rpcUrls ?? []) {
    try {
      const raw = String(await rpc(url, 'eth_getBalance', [address, 'latest']));
      if (!/^0x[0-9a-f]+$/i.test(raw)) throw new Error('RPC returned an invalid balance');
      const balance = amountFromRaw(BigInt(raw).toString(), config.decimals);
      return {
        id: `${config.id}:native`, chainId: String(config.chainId), chainName: config.name,
        kind: 'native', name: config.name, symbol: config.symbol, balance, decimals: config.decimals,
        source: `Public JSON-RPC (${new URL(url).host})`,
      };
    } catch (error) { lastError = error; }
  }
  throw lastError instanceof Error ? lastError : new Error('All native-balance RPC providers failed');
}

function alchemyNetwork(config: ChainConfig): string | undefined {
  if (config.id === 'ethereum') return 'eth-mainnet';
  if (config.id === 'bsc') return 'bnb-mainnet';
  if (config.id === 'base') return 'base-mainnet';
  if (config.id === 'solana') return 'sol-mainnet';
  return undefined;
}

function parseRawTokenBalance(raw: unknown): string | undefined {
  if (typeof raw !== 'string' && typeof raw !== 'number' && typeof raw !== 'bigint') return undefined;
  const value = String(raw).trim();
  try {
    if (/^0x[0-9a-f]+$/i.test(value)) return BigInt(value).toString();
    if (/^\\d+$/.test(value)) return BigInt(value).toString();
  } catch { return undefined; }
  return undefined;
}

/**
 * Alchemy's documented Portfolio API returns owned fungible holdings, metadata,
 * and price data for supported EVM networks and Solana. This is an indexer, not
 * a token registry: only returned positive balances are shown as owned assets.
 * API key is a public browser credential; restrict it by app origin and quotas.
 */
async function fetchAlchemyAssets(config: ChainConfig, address: string): Promise<AssetBalance[]> {
  const network = alchemyNetwork(config);
  if (!ALCHEMY_API_KEY) throw new Error('Alchemy Portfolio API is not configured (set VITE_ALCHEMY_API_KEY in Render).');
  if (!network) throw new Error('Alchemy Portfolio API does not support this network mapping.');
  const endpoint = `https://api.g.alchemy.com/data/v1/${encodeURIComponent(ALCHEMY_API_KEY)}/assets/tokens/by-address`;
  const rows: any[] = [];
  let pageKey: string | undefined;
  let pages = 0;
  do {
    const body: Record<string, unknown> = {
      addresses: [{ address, networks: [network] }],
      withMetadata: true,
      withPrices: true,
      includeNativeTokens: true,
      includeErc20Tokens: true,
      includeBlockMetadata: false,
    };
    if (pageKey) body.pageKey = pageKey;
    const response = await postJson(endpoint, body);
    if (!Array.isArray(response?.data?.tokens)) {
      const detail = response?.error?.message ?? response?.message ?? 'unexpected Portfolio API response';
      throw new Error(String(detail));
    }
    rows.push(...response.data.tokens.filter((row: any) => row?.network === network));
    pageKey = typeof response.data.pageKey === 'string' && response.data.pageKey ? response.data.pageKey : undefined;
    pages += 1;
    if (pages >= 20 && pageKey) throw new Error('Alchemy token pagination exceeded the safety limit; some holdings may be omitted.');
  } while (pageKey);

  const assets: AssetBalance[] = [];
  for (const row of rows) {
    const raw = parseRawTokenBalance(row?.tokenBalance);
    const metadata = row?.tokenMetadata ?? {};
    const decimals = Number(metadata.decimals);
    if (!raw || !Number.isInteger(decimals) || decimals < 0 || decimals > 36) continue;
    let rawBigInt: bigint;
    try { rawBigInt = BigInt(raw); } catch { continue; }
    if (rawBigInt <= 0n) continue;
    const native = row?.tokenAddress == null;
    const symbol = typeof metadata.symbol === 'string' ? metadata.symbol.trim() : '';
    const name = typeof metadata.name === 'string' ? metadata.name.trim() : '';
    const tokenAddress = typeof row?.tokenAddress === 'string' ? row.tokenAddress : undefined;
    if (!symbol || symbol.length > 24 || (!native && !name && !tokenAddress)) continue;
    if (config.family === 'evm' && !native && (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress))) continue;
    if (config.family === 'solana' && !native && (!tokenAddress || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(tokenAddress))) continue;
    const unitPrice = Array.isArray(row?.tokenPrices)
      ? numeric(row.tokenPrices.find((price: any) => String(price?.currency).toLowerCase() === 'usd')?.value)
      : undefined;
    const amount = amountFromRaw(raw, decimals);
    const balanceNumber = Number(amount);
    const usdValue = unitPrice !== undefined && Number.isFinite(balanceNumber) ? unitPrice * balanceNumber : undefined;
    assets.push({
      id: native ? `${config.id}:native` : `${config.id}:token:${tokenAddress!.toLowerCase()}`,
      chainId: config.family === 'evm' ? String(config.chainId) : 'solana-mainnet',
      chainName: config.name,
      kind: native ? 'native' : 'token',
      name: name || symbol,
      symbol,
      balance: amount,
      decimals,
      ...(native ? {} : config.family === 'solana' ? { mintAddress: tokenAddress } : { contractAddress: tokenAddress }),
      ...(usdValue !== undefined ? { usdValue, priceSource: 'Alchemy Portfolio API token price' } : {}),
      source: 'Alchemy Portfolio API (indexed holdings and on-chain balance data)',
    });
  }
  return dedupeAssets(assets);
}

async function fetchEvmTokens(config: ChainConfig, address: string): Promise<AssetBalance[]> {
  const failures: string[] = [];
  if (ALCHEMY_API_KEY) {
    try {
      return (await fetchAlchemyAssets(config, address)).filter((asset) => asset.kind === 'token');
    } catch (error) {
      failures.push(`Alchemy: ${error instanceof Error ? error.message : 'provider error'}`);
    }
  }
  // Routescan is a secondary indexer. Some networks/addresses return HTTP 400;
  // do not interpret an indexer failure as an empty token portfolio.
  const encodedAddress = encodeURIComponent(address);
  const urls = [
    `https://api.routescan.io/v2/network/mainnet/evm/${config.chainId}/address/${encodedAddress}/erc20-holdings?limit=25`,
    `https://api.routescan.io/v2/network/mainnet/evm/all/address/${encodedAddress}/erc20-holdings?includedChainIds=${config.chainId}&limit=25`,
  ];
  let data: any;
  let lastError: unknown;
  for (const url of urls) {
    try {
      const candidate = await getJson(url);
      if (!Array.isArray(candidate.items)) throw new Error('Token indexer returned an unexpected response');
      data = candidate;
      break;
    } catch (error) { lastError = error; }
  }
  if (!data) {
    failures.push(`Routescan: ${lastError instanceof Error ? lastError.message : 'provider error'}`);
    throw new Error(`Automatic token discovery failed. ${failures.join('; ')}. Configure VITE_ALCHEMY_API_KEY in Render to use the documented multi-chain token indexer.`);
  }
  const items: AssetBalance[] = [];
  for (const item of data.items) {
    const contract = item.tokenAddress;
    const decimals = Number(item.tokenDecimals);
    const symbol = typeof item.tokenSymbol === 'string' ? item.tokenSymbol.trim() : '';
    if (!tokenMetadataSafe(contract, decimals, symbol)) continue;
    const rawQuantity = String(item.tokenQuantity ?? '').trim();
    let balance = rawQuantity;
    // Routescan returns tokenQuantity as a human-readable quantity in its holdings schema.
    const amount = Number(balance);
    if (!rawQuantity || !Number.isFinite(amount) || amount <= 0) continue;
    items.push({
      id: `${config.id}:erc20:${contract.toLowerCase()}`, chainId: String(config.chainId), chainName: config.name,
      kind: 'token', name: typeof item.tokenName === 'string' && item.tokenName.trim() ? item.tokenName.trim().slice(0, 80) : symbol,
      symbol, balance, decimals, contractAddress: contract,
      usdValue: numeric(item.tokenValueInUsd), priceSource: numeric(item.tokenValueInUsd) !== undefined ? 'Routescan indexed token value' : undefined,
      source: 'Routescan indexed ERC-20 holdings',
    });
  }
  return dedupeAssets(items);
}

async function fetchEvm(config: ChainConfig, address: string): Promise<ChainBalanceResult> {
  const native = await fetchEvmNative(config, address);
  let tokens: AssetBalance[] = [];
  let tokenError = '';
  try { tokens = await fetchEvmTokens(config, address); }
  catch (error) { tokenError = error instanceof Error ? error.message : 'Token discovery failed'; }
  const assets = dedupeAssets([native, ...tokens]);
  return {
    id: config.id, name: config.name, nativeSymbol: config.symbol, address,
    status: tokenError ? 'partial' : 'success',
    message: tokenError ? `Native balance loaded; automatic token discovery unavailable: ${tokenError}` : `Live native balance and indexed token holdings loaded. Token indexers may lag recent transactions.`,
    assets, updatedAt: Date.now(),
  };
}

async function fetchSolana(address: string): Promise<ChainBalanceResult> {
  if (ALCHEMY_API_KEY) {
    try {
      const indexed = await fetchAlchemyAssets(CHAINS.find((chain) => chain.id === 'solana')!, address);
      if (indexed.some((asset) => asset.kind === 'native')) {
        return {
          id: 'solana', name: 'Solana', nativeSymbol: 'SOL', address,
          status: 'success',
          message: 'Live SOL and indexed SPL holdings loaded through Alchemy Portfolio API. Token metadata/prices may be unavailable for some mints.',
          assets: dedupeAssets(indexed), updatedAt: Date.now(),
        };
      }
      throw new Error('Indexer returned no native SOL balance row.');
    } catch (error) {
      // Continue to the configured RPC providers; preserve the indexer failure if they fail too.
      const alchemyError = error instanceof Error ? error.message : 'Alchemy provider error';
      try {
        return await fetchSolanaRpc(address);
      } catch (rpcError) {
        throw new Error(`Alchemy Portfolio API: ${alchemyError}; Solana RPC fallback: ${rpcError instanceof Error ? rpcError.message : 'provider error'}`);
      }
    }
  }
  return fetchSolanaRpc(address);
}

async function fetchSolanaRpc(address: string): Promise<ChainBalanceResult> {
  let lastError: unknown;
  for (const endpoint of SOLANA_RPC) {
    try {
      const [lamports, ...tokenResponses] = await Promise.all([
        rpc(endpoint, 'getBalance', [address, { commitment: 'confirmed' }]),
        ...SOLANA_TOKEN_PROGRAMS.map((programId) => rpc(endpoint, 'getTokenAccountsByOwner', [address, { programId }, { encoding: 'jsonParsed', commitment: 'confirmed' }])),
      ]);
      const assets: AssetBalance[] = [{
        id: 'solana:native', chainId: 'solana-mainnet', chainName: 'Solana', kind: 'native',
        name: 'Solana', symbol: 'SOL', balance: amountFromRaw(String(lamports.value), 9), decimals: 9,
        source: `Solana JSON-RPC (${new URL(endpoint).host})`,
      }];
      const seen = new Set<string>();
      for (const response of tokenResponses) {
        for (const row of (response?.value ?? [])) {
          const info = row?.account?.data?.parsed?.info;
          const tokenAmount = info?.tokenAmount;
          const mint = info?.mint;
          const decimals = Number(tokenAmount?.decimals);
          const raw = String(tokenAmount?.amount ?? '0');
          if (typeof mint !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)
            || !Number.isInteger(decimals) || decimals < 0 || decimals > 18 || !/^\d+$/.test(raw) || BigInt(raw) === 0n) continue;
          if (seen.has(mint)) continue;
          seen.add(mint);
          // Mint and decimals are on-chain. Do not invent a token name/symbol when
          // a metadata source is not configured; identify it explicitly by mint.
          assets.push({
            id: `solana:spl:${mint}`, chainId: 'solana-mainnet', chainName: 'Solana', kind: 'token',
            name: `SPL token · ${mint.slice(0, 6)}…${mint.slice(-4)}`, symbol: 'SPL',
            balance: amountFromRaw(raw, decimals), decimals, mintAddress: mint,
            source: 'Solana JSON-RPC token account; name/symbol metadata not independently resolved',
          });
        }
      }
      return {
        id: 'solana', name: 'Solana', nativeSymbol: 'SOL', address,
        status: 'success', message: 'Live SOL and SPL token-account balances loaded. Unknown token names are shown by mint to avoid misleading metadata.',
        assets: dedupeAssets(assets), updatedAt: Date.now(),
      };
    } catch (error) { lastError = error; }
  }
  throw lastError instanceof Error ? lastError : new Error('Solana RPC unavailable');
}

async function fetchBitcoin(address: string): Promise<ChainBalanceResult> {
  let data: any;
  let lastError: unknown;
  const endpoints = [
    `https://mempool.space/api/address/${encodeURIComponent(address)}`,
    `https://blockstream.info/api/address/${encodeURIComponent(address)}`,
  ];
  for (const url of endpoints) {
    try { data = await getJson(url, 30000); break; }
    catch (error) { lastError = error; }
  }
  if (!data) throw lastError instanceof Error ? lastError : new Error('Bitcoin explorer providers unavailable');
  const chain = data?.chain_stats;
  const mempool = data?.mempool_stats;
  if (!chain || !mempool) throw new Error('Bitcoin explorer returned an unexpected response');
  const funded = BigInt(chain.funded_txo_sum ?? 0) + BigInt(mempool.funded_txo_sum ?? 0);
  const spent = BigInt(chain.spent_txo_sum ?? 0) + BigInt(mempool.spent_txo_sum ?? 0);
  const sats = funded - spent;
  if (sats < 0n) throw new Error('Bitcoin explorer returned an invalid UTXO balance');
  const native: AssetBalance = {
    id: 'bitcoin:native', chainId: 'bitcoin-mainnet', chainName: 'Bitcoin', kind: 'native',
    name: 'Bitcoin', symbol: 'BTC', balance: amountFromRaw(sats.toString(), 8), decimals: 8,
    source: 'mempool.space address/UTXO API',
  };
  return { id: 'bitcoin', name: 'Bitcoin', nativeSymbol: 'BTC', address, status: 'success', message: 'Live confirmed and mempool UTXO balance loaded; token discovery is not applicable to Bitcoin mainnet.', assets: [native], updatedAt: Date.now() };
}

async function fetchTron(address: string): Promise<ChainBalanceResult> {
  const response = await postJson('https://api.trongrid.io/wallet/getaccount', { address, visible: true });
  if (!response || typeof response !== 'object') throw new Error('Tron provider returned an unexpected account response');
  const rawBalance = response.balance ?? 0;
  const native: AssetBalance = {
    id: 'tron:native', chainId: 'tron-mainnet', chainName: 'Tron', kind: 'native',
    name: 'Tron', symbol: 'TRX', balance: amountFromRaw(String(rawBalance), 6), decimals: 6,
    source: 'TronGrid public account endpoint',
  };
  // TRC-20 enumeration needs an indexed token-holder endpoint. TronScan's documented
  // endpoint requires an API key, so do not silently claim a complete token list.
  const tronScanApiKey = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_TRONSCAN_API_KEY ?? '';
  const keyConfigured = Boolean(tronScanApiKey);
  let tokens: AssetBalance[] = [];
  let tokenMessage = 'TRC-20 discovery unavailable: configure VITE_TRONSCAN_API_KEY for the documented TronScan token-holdings endpoint.';
  if (keyConfigured) {
    try {
      const url = `https://apilist.tronscanapi.com/api/account/tokens?address=${encodeURIComponent(address)}&start=0&limit=200&hidden=0&show=1`;
      const data = await getJsonWithHeaders(url, { 'TRON-PRO-API-KEY': tronScanApiKey });
      const rows = Array.isArray(data.data) ? data.data : Array.isArray(data.tokens) ? data.tokens : [];
      tokens = rows.map((item: any) => {
        const contract = String(item.tokenId ?? item.contractAddress ?? item.tokenAddr ?? '');
        const decimals = Number(item.tokenDecimal ?? item.decimals);
        const symbol = String(item.tokenAbbr ?? item.tokenSymbol ?? item.symbol ?? '').trim();
        const raw = String(item.balance ?? item.quantity ?? '0');
        if (!contract || !Number.isInteger(decimals) || decimals < 0 || decimals > 36 || !symbol || !/^\d+$/.test(raw)) return null;
        return {
          id: `tron:trc20:${contract.toLowerCase()}`, chainId: 'tron-mainnet', chainName: 'Tron', kind: 'token' as const,
          name: String(item.tokenName ?? symbol).slice(0, 80), symbol, balance: amountFromRaw(raw, decimals), decimals,
          contractAddress: contract, usdValue: numeric(item.balanceInUsd ?? item.valueInUsd),
          source: 'TronScan indexed TRC-20 holdings',
        };
      }).filter((item: AssetBalance | null): item is AssetBalance => Boolean(item && Number(item.balance) > 0));
      tokenMessage = 'TRX and indexed TRC-20 holdings loaded; indexer data may lag recent transactions.';
    } catch (error) { tokenMessage = `TRX loaded; TRC-20 discovery failed: ${error instanceof Error ? error.message : 'provider error'}`; }
  }
  return {
    id: 'tron', name: 'Tron', nativeSymbol: 'TRX', address,
    status: keyConfigured && !tokenMessage.includes('discovery failed') ? 'success' : 'partial',
    message: tokenMessage, assets: dedupeAssets([native, ...tokens]), updatedAt: Date.now(),
  };
}

async function getJsonWithHeaders(url: string, headers: Record<string, string>): Promise<any> {
  const response = await fetch(url, { signal: timeoutSignal(), headers: { accept: 'application/json', ...headers } });
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
  return response.json();
}

async function postJson(url: string, body: unknown): Promise<any> {
  const response = await fetch(url, {
    method: 'POST',
    signal: timeoutSignal(25000),
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
  return response.json();
}

async function fetchUsdPrices(): Promise<Record<string, number>> {
  const ids = [...new Set(Object.values(COINGECKO_IDS))].join(',');
  try {
    const data = await getJson(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd`);
    const prices: Record<string, number> = {};
    for (const [symbol, id] of Object.entries(COINGECKO_IDS)) {
      const value = numeric(data?.[id]?.usd);
      if (value !== undefined) prices[symbol] = value;
    }
    return prices;
  } catch { return {}; }
}

export async function loadPortfolio(addresses: Array<{ registryId?: string; value: string }>): Promise<PortfolioSnapshot> {
  const byRegistry = new Map(addresses.filter((item) => item.registryId).map((item) => [item.registryId!, item.value]));
  const configs = CHAINS.map((config) => ({ config, address: byRegistry.get(config.registryId) })).filter((item): item is { config: ChainConfig; address: string } => Boolean(item.address));
  const chains = await Promise.all(configs.map(async ({ config, address }): Promise<ChainBalanceResult> => {
    try {
      if (config.family === 'evm') return await fetchEvm(config, address);
      if (config.family === 'solana') return await fetchSolana(address);
      if (config.family === 'bitcoin') return await fetchBitcoin(address);
      return await fetchTron(address);
    } catch (error) {
      return {
        id: config.id, name: config.name, nativeSymbol: config.symbol, address,
        status: 'error', message: error instanceof Error ? error.message : 'Balance provider unavailable',
        assets: [], updatedAt: Date.now(),
      };
    }
  }));
  const prices = await fetchUsdPrices();
  let totalUsd = 0;
  let pricedAssets = 0;
  let unpricedAssets = 0;
  for (const chain of chains) {
    for (const asset of chain.assets) {
      let usd = asset.usdValue;
      if (usd === undefined && asset.kind === 'native') {
        const price = prices[asset.symbol];
        const balance = Number(asset.balance);
        if (price !== undefined && Number.isFinite(balance)) {
          usd = balance * price;
          asset.usdValue = usd;
          asset.priceSource = 'CoinGecko spot price';
        }
      }
      if (usd !== undefined && Number.isFinite(usd)) { totalUsd += usd; pricedAssets += 1; }
      else if (Number(asset.balance) > 0) unpricedAssets += 1;
    }
  }
  return { chains, updatedAt: Date.now(), totalUsd: pricedAssets ? totalUsd : undefined, pricedAssets, unpricedAssets };
}
