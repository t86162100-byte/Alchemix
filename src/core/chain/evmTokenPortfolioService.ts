import { formatUnits, isAddress } from 'ethers';

const ROUTESCAN_BASE = 'https://api.routescan.io/v2/network/mainnet/evm/all/address';

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

function safeBalance(raw: string, decimals: number): string {
  try {
    return formatUnits(BigInt(raw), decimals);
  } catch {
    return '0';
  }
}

/**
 * Discover ERC-20 holdings from Routescan's indexed cross-chain API.
 * The wallet address is public chain data, but this request discloses it to Routescan.
 * A free keyless tier is supported; results are limited to chains Routescan indexes.
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
    } finally {
      clearTimeout(timeout);
    }
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
          !Number.isInteger(decimals) || decimals < 0 || decimals > 36 || !/^\d+$/.test(rawBalance)) continue;
      if (BigInt(rawBalance) <= 0n) continue;
      const key = `${chainId}:${tokenAddress.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      holdings.push({
        chainId,
        tokenAddress,
        tokenName: String(item.tokenName ?? '').trim().slice(0, 100) || 'Unknown token',
        tokenSymbol: String(item.tokenSymbol ?? '').trim().slice(0, 32) || 'TOKEN',
        tokenDecimals: decimals,
        rawBalance,
        balance: safeBalance(rawBalance, decimals),
        tokenValueUsd: item.tokenValueInUsd && Number.isFinite(Number(item.tokenValueInUsd)) ? item.tokenValueInUsd : null,
        updatedAtBlock: Number.isSafeInteger(Number(item.updatedAtBlock)) ? Number(item.updatedAtBlock) : null,
      });
    }

    nextToken = String(data.link?.nextToken ?? '');
    if (!nextToken || data.items.length === 0) break;
  }

  return holdings.sort((a, b) => a.tokenName.localeCompare(b.tokenName) || a.tokenSymbol.localeCompare(b.tokenSymbol));
}
