import { Contract, formatUnits, isAddress, JsonRpcProvider } from 'ethers';

const ROUTESCAN_BASE = 'https://api.routescan.io/v2/network/mainnet/evm/all/address';
const ERC20_READ_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
];

export type EvmTokenHolding = {
  chainId: number;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  rawBalance: string;
  balance: string;
  tokenValueUsd: string | null;
  updatedAtBlock: number | null;
};

type RoutescanHolding = {
  chainId?: string | number;
  tokenAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
  tokenQuantity?: string;
  tokenValueInUsd?: string;
  updatedAtBlock?: number;
};
type RoutescanPage = {
  items?: RoutescanHolding[];
  link?: { nextToken?: string; next?: string };
};

type KnownToken = Pick<EvmTokenHolding, 'tokenAddress' | 'tokenName' | 'tokenSymbol' | 'tokenDecimals'>;

// Curated, verified contract addresses for commonly used mainnet tokens.
// The UI still labels every contract as unverified until the user checks it.
const COMMON_TOKENS: Record<number, KnownToken[]> = {
  1: [
    { tokenAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7', tokenName: 'Tether USD', tokenSymbol: 'USDT', tokenDecimals: 6 },
    { tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', tokenName: 'USD Coin', tokenSymbol: 'USDC', tokenDecimals: 6 },
    { tokenAddress: '0x514910771AF9Ca656af840dff83E8264EcF986CA', tokenName: 'Chainlink', tokenSymbol: 'LINK', tokenDecimals: 18 },
    { tokenAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F', tokenName: 'Dai Stablecoin', tokenSymbol: 'DAI', tokenDecimals: 18 },
    { tokenAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', tokenName: 'Wrapped Ether', tokenSymbol: 'WETH', tokenDecimals: 18 },
  ],
  56: [
    { tokenAddress: '0x55d398326f99059fF775485246999027B3197955', tokenName: 'Tether USD', tokenSymbol: 'USDT', tokenDecimals: 18 },
    { tokenAddress: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', tokenName: 'USD Coin', tokenSymbol: 'USDC', tokenDecimals: 18 },
    { tokenAddress: '0x0E09Fabb73Bd3Ade0a17ECC321fD13a19e81cE82', tokenName: 'PancakeSwap', tokenSymbol: 'CAKE', tokenDecimals: 18 },
    { tokenAddress: '0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bd', tokenName: 'Chainlink', tokenSymbol: 'LINK', tokenDecimals: 18 },
    { tokenAddress: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', tokenName: 'Binance-Peg Ethereum Token', tokenSymbol: 'ETH', tokenDecimals: 18 },
  ],
  8453: [
    { tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', tokenName: 'USD Coin', tokenSymbol: 'USDC', tokenDecimals: 6 },
    { tokenAddress: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', tokenName: 'Dai Stablecoin', tokenSymbol: 'DAI', tokenDecimals: 18 },
    { tokenAddress: '0x4200000000000000000000000000000000000006', tokenName: 'Wrapped Ether', tokenSymbol: 'WETH', tokenDecimals: 18 },
  ],
  137: [
    { tokenAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', tokenName: 'USD Coin', tokenSymbol: 'USDC', tokenDecimals: 6 },
    { tokenAddress: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', tokenName: 'Tether USD', tokenSymbol: 'USDT', tokenDecimals: 6 },
    { tokenAddress: '0x53E0bca35eC356BD5ddDFebBD1Fc0fD03FaBad39', tokenName: 'Chainlink', tokenSymbol: 'LINK', tokenDecimals: 18 },
  ],
  42161: [
    { tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', tokenName: 'USD Coin', tokenSymbol: 'USDC', tokenDecimals: 6 },
    { tokenAddress: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', tokenName: 'Tether USD', tokenSymbol: 'USDT', tokenDecimals: 6 },
    { tokenAddress: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4', tokenName: 'Chainlink', tokenSymbol: 'LINK', tokenDecimals: 18 },
  ],
  10: [
    { tokenAddress: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', tokenName: 'USD Coin', tokenSymbol: 'USDC', tokenDecimals: 6 },
    { tokenAddress: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', tokenName: 'Tether USD', tokenSymbol: 'USDT', tokenDecimals: 6 },
    { tokenAddress: '0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6', tokenName: 'Chainlink', tokenSymbol: 'LINK', tokenDecimals: 18 },
  ],
  43114: [
    { tokenAddress: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', tokenName: 'USD Coin', tokenSymbol: 'USDC', tokenDecimals: 6 },
    { tokenAddress: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', tokenName: 'Tether USD', tokenSymbol: 'USDT', tokenDecimals: 6 },
    { tokenAddress: '0x5947BB275c521040051D82396192181b413227A3', tokenName: 'Chainlink', tokenSymbol: 'LINK', tokenDecimals: 18 },
  ],
};

function safeBalance(raw: string, decimals: number): string {
  try { return formatUnits(BigInt(raw), decimals); } catch { return '0'; }
}

/** Read balances for the common token catalog on the currently selected chain. */
export async function readCommonTokenBalances(addressInput: string, chainId: number, rpcUrl: string): Promise<EvmTokenHolding[]> {
  const address = addressInput.trim();
  if (!isAddress(address)) throw new Error('Unlock a wallet with a valid EVM address before loading token balances.');
  const tokens = COMMON_TOKENS[chainId] ?? [];
  if (!tokens.length) return [];
  const provider = new JsonRpcProvider(rpcUrl, chainId, { staticNetwork: true });
  try {
    const actualChain = await provider.getNetwork();
    if (Number(actualChain.chainId) !== chainId) throw new Error(`RPC network mismatch: expected ${chainId}, received ${actualChain.chainId.toString()}.`);
    return await Promise.all(tokens.map(async token => {
      try {
        const contract = new Contract(token.tokenAddress, ERC20_READ_ABI, provider);
        const raw = (await contract.balanceOf(address)) as bigint;
        const rawBalance = raw.toString();
        return { ...token, chainId, rawBalance, balance: safeBalance(rawBalance, token.tokenDecimals), tokenValueUsd: null, updatedAtBlock: null };
      } catch {
        // Keep the token visible when an RPC does not implement a call; do not pretend its balance is zero.
        return { ...token, chainId, rawBalance: '0', balance: '—', tokenValueUsd: null, updatedAtBlock: null };
      }
    }));
  } finally {
    provider.destroy();
  }
}

/**
 * Discover non-zero ERC-20 holdings across Routescan-indexed mainnet chains.
 * This public-indexer request discloses the wallet's public address to Routescan.
 */
export async function discoverEvmTokenHoldings(addressInput: string): Promise<EvmTokenHolding[]> {
  const address = addressInput.trim();
  if (!isAddress(address)) throw new Error('Unlock a wallet with a valid EVM address before discovering tokens.');
  const holdings: EvmTokenHolding[] = [];
  const seen = new Set<string>();
  let nextToken = '';
  const maxPages = 5;

  for (let pageNumber = 0; pageNumber < maxPages; pageNumber += 1) {
    const url = new URL(`${ROUTESCAN_BASE}/${encodeURIComponent(address)}/erc20-holdings`);
    url.searchParams.set('limit', '100');
    if (nextToken) url.searchParams.set('nextToken', nextToken);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response: Response;
    try {
      response = await fetch(url.toString(), { headers: { Accept: 'application/json' }, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted) throw new Error('Token discovery timed out. Check your connection and try again.');
      throw new Error(error instanceof Error ? `Token discovery failed: ${error.message}` : 'Token discovery failed.');
    } finally { clearTimeout(timeout); }
    if (!response.ok) {
      if (response.status === 429) throw new Error('Token discovery is temporarily rate-limited. Wait a moment and try again.');
      throw new Error(`Token indexer returned HTTP ${response.status}. Try again later.`);
    }
    const data = await response.json() as RoutescanPage;
    if (!Array.isArray(data.items)) throw new Error('The token indexer returned an unexpected response.');
    for (const item of data.items) {
      const chainId = Number(item.chainId);
      const tokenAddress = String(item.tokenAddress ?? '');
      const decimals = Number(item.tokenDecimals);
      const rawBalance = String(item.tokenQuantity ?? '');
      if (!Number.isSafeInteger(chainId) || chainId <= 0 || !isAddress(tokenAddress) ||
          !Number.isInteger(decimals) || decimals < 0 || decimals > 36 || !/^\\d+$/.test(rawBalance)) continue;
      if (BigInt(rawBalance) <= 0n) continue;
      const key = `${chainId}:${tokenAddress.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      holdings.push({
        chainId, tokenAddress,
        tokenName: String(item.tokenName ?? '').trim().slice(0, 100) || 'Unknown token',
        tokenSymbol: String(item.tokenSymbol ?? '').trim().slice(0, 32) || 'TOKEN',
        tokenDecimals: decimals, rawBalance, balance: safeBalance(rawBalance, decimals),
        tokenValueUsd: item.tokenValueInUsd && Number.isFinite(Number(item.tokenValueInUsd)) ? item.tokenValueInUsd : null,
        updatedAtBlock: Number.isSafeInteger(Number(item.updatedAtBlock)) ? Number(item.updatedAtBlock) : null,
      });
    }
    nextToken = String(data.link?.nextToken ?? '');
    if (!nextToken || data.items.length === 0) break;
  }
  return holdings.sort((a, b) => a.tokenName.localeCompare(b.tokenName) || a.tokenSymbol.localeCompare(b.tokenSymbol));
}
