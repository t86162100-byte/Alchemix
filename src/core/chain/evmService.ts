import { formatUnits, isAddress, JsonRpcProvider, parseUnits } from 'ethers';

export type EvmNetwork = {
  /** Stable identity comes from the registry chain ID, not a hard-coded network name. */
  key: string;
  name: string;
  chainId: number;
  symbol: string;
  decimals: number;
  rpcUrl: string;
  fallbackRpcUrls: string[];
  explorerUrl: string;
};

type RegistryRpc = { url?: string; tracking?: string };
type RegistryExplorer = { url?: string };
type RegistryChain = {
  name?: string;
  chainId?: number;
  networkId?: number;
  nativeCurrency?: { symbol?: string; name?: string; decimals?: number };
  rpc?: Array<string | RegistryRpc>;
  explorers?: RegistryExplorer[];
  testnet?: boolean;
};

const REGISTRY_URL = 'https://chainlist.org/rpcs.json';
let cachedNetworks: EvmNetwork[] | null = null;
let cacheExpiresAt = 0;

/**
 * Discover EVM networks from Chainlist at runtime. No chain list is baked into
 * the app bundle. Only mainnets with HTTPS RPC endpoints and valid metadata
 * are offered; endpoints containing API-key placeholders are skipped.
 */
export async function loadEvmNetworks(forceRefresh = false): Promise<EvmNetwork[]> {
  if (!forceRefresh && cachedNetworks && Date.now() < cacheExpiresAt) return cachedNetworks;

  const response = await fetch(REGISTRY_URL, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Network registry request failed (HTTP ${response.status}).`);
  const registry: unknown = await response.json();
  if (!Array.isArray(registry)) throw new Error('The network registry returned an unexpected response.');

  const byChainId = new Map<number, EvmNetwork>();
  for (const raw of registry as RegistryChain[]) {
    const chainId = Number(raw.chainId);
    const symbol = raw.nativeCurrency?.symbol?.trim();
    const decimals = Number(raw.nativeCurrency?.decimals ?? 18);
    const name = raw.name?.trim();
    if (!Number.isSafeInteger(chainId) || chainId <= 0 || !name || !symbol || !Number.isInteger(decimals) || decimals < 0 || decimals > 36 || raw.testnet === true) continue;

    const urls = (raw.rpc ?? [])
      .map(item => typeof item === 'string' ? item : item?.url ?? '')
      .map(url => url.trim())
      .filter(url => /^https:\/\//i.test(url) && !/\$\{[^}]+\}|localhost|127\.0\.0\.1/i.test(url));
    const uniqueUrls = [...new Set(urls)];
    if (!uniqueUrls.length) continue;

    const existing = byChainId.get(chainId);
    // Prefer a record with an explorer and then keep the first valid HTTPS RPC.
    const explorerUrl = (raw.explorers ?? []).map(item => item?.url?.trim() ?? '')
      .find(url => /^https:\/\//i.test(url)) ?? existing?.explorerUrl ?? '';
    if (existing) {
      existing.fallbackRpcUrls = [...new Set([...existing.fallbackRpcUrls, ...uniqueUrls])].filter(url => url !== existing.rpcUrl).slice(0, 3);
      if (!existing.explorerUrl && explorerUrl) existing.explorerUrl = explorerUrl;
      continue;
    }
    byChainId.set(chainId, {
      key: String(chainId),
      name,
      chainId,
      symbol,
      decimals,
      rpcUrl: uniqueUrls[0],
      fallbackRpcUrls: uniqueUrls.slice(1, 4),
      explorerUrl,
    });
  }

  const networks = [...byChainId.values()].sort((a, b) => a.name.localeCompare(b.name));
  if (!networks.length) throw new Error('The network registry did not contain any usable EVM mainnets.');
  cachedNetworks = networks;
  cacheExpiresAt = Date.now() + 30 * 60 * 1000;
  return networks;
}

export type NetworkHealth = {
  chainId: number;
  blockNumber: number;
  rpcUrl: string;
};

export type NetworkSnapshot = {
  chainId: number;
  blockNumber: number;
  balanceWei: string;
  balanceEth: string;
  rpcUrl: string;
};

function providerFor(network: EvmNetwork, rpcUrl: string): JsonRpcProvider {
  return new JsonRpcProvider(rpcUrl, network.chainId, { staticNetwork: true });
}

function rpcUrlsFor(network: EvmNetwork): string[] {
  return [...new Set([network.rpcUrl, ...network.fallbackRpcUrls])];
}

/** Retry read-only requests against alternate public RPCs if one is unavailable. */
async function withRpcFallback<T>(
  network: EvmNetwork,
  operation: (provider: JsonRpcProvider) => Promise<T>,
): Promise<{ value: T; rpcUrl: string }> {
  const errors: string[] = [];
  for (const rpcUrl of rpcUrlsFor(network)) {
    const provider = providerFor(network, rpcUrl);
    try {
      const value = await operation(provider);
      return { value, rpcUrl };
    } catch (error) {
      errors.push(`${rpcUrl}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      provider.destroy();
    }
  }
  throw new Error(`All public RPC endpoints failed for ${network.name}. ${errors.join(' | ')}`);
}

/** Verify network connectivity without requiring or transmitting a wallet address. */
export async function readNetworkHealth(network: EvmNetwork): Promise<NetworkHealth> {
  const result = await withRpcFallback(network, async provider => {
    const [chain, blockNumber] = await Promise.all([provider.getNetwork(), provider.getBlockNumber()]);
    if (Number(chain.chainId) !== network.chainId) {
      throw new Error(`RPC network mismatch: expected chain ID ${network.chainId}, received ${chain.chainId.toString()}.`);
    }
    return { chainId: Number(chain.chainId), blockNumber };
  });
  return { ...result.value, rpcUrl: result.rpcUrl };
}

/** Read-only RPC calls. Only the public address is sent to the RPC endpoint. */
export async function readNetworkSnapshot(network: EvmNetwork, address: string): Promise<NetworkSnapshot> {
  if (!isAddress(address)) throw new Error('The wallet address is not a valid EVM address.');
  const result = await withRpcFallback(network, async provider => {
    const [chain, blockNumber, balance] = await Promise.all([
      provider.getNetwork(),
      provider.getBlockNumber(),
      provider.getBalance(address),
    ]);
    if (Number(chain.chainId) !== network.chainId) {
      throw new Error(`RPC network mismatch: expected chain ID ${network.chainId}, received ${chain.chainId.toString()}.`);
    }
    return {
      chainId: Number(chain.chainId),
      blockNumber,
      balanceWei: balance.toString(),
      balanceEth: formatUnits(balance, network.decimals),
    };
  });
  return { ...result.value, rpcUrl: result.rpcUrl };
}

export type TransferEstimate = {
  to: string;
  amountEth: string;
  chainId: number;
  gasLimit: string;
  maxFeePerGasWei: string | null;
  gasPriceWei: string | null;
  estimatedFeeEth: string;
  totalRequiredEth: string;
  rpcUrl: string;
};

/** Estimate a native-coin transfer. This never signs or broadcasts a transaction. */
export async function estimateNativeTransfer(
  network: EvmNetwork,
  fromAddress: string,
  recipientInput: string,
  amountInput: string,
): Promise<TransferEstimate> {
  if (!isAddress(fromAddress)) throw new Error('Unlock your wallet to use its public address.');
  if (!isAddress(recipientInput.trim())) throw new Error('Enter a valid recipient EVM address.');
  if (!amountInput.trim() || !/^\d+(?:\.\d+)?$/.test(amountInput.trim()) || (amountInput.trim().split('.')[1]?.length ?? 0) > network.decimals) {
    throw new Error("Enter a valid native-coin amount with no more than this network-supported decimal places.");
  }
  const value = parseUnits(amountInput.trim(), network.decimals);
  if (value <= 0n) throw new Error('The transfer amount must be greater than zero.');

  const result = await withRpcFallback(network, async provider => {
    const chain = await provider.getNetwork();
    if (Number(chain.chainId) !== network.chainId) {
      throw new Error('The RPC provider returned the wrong network. No transaction was prepared.');
    }
    const feeData = await provider.getFeeData();
    const feeFields = feeData.maxFeePerGas != null
      ? { maxFeePerGas: feeData.maxFeePerGas, maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? undefined }
      : feeData.gasPrice != null ? { gasPrice: feeData.gasPrice } : {};
    const feePerGas = feeData.maxFeePerGas ?? feeData.gasPrice;
    if (feePerGas == null) throw new Error('The network did not return usable fee data. Try again later.');
    const gasLimit = await provider.estimateGas({
      from: fromAddress,
      to: recipientInput.trim(),
      value,
      ...feeFields,
    });
    const fee = gasLimit * feePerGas;
    return {
      to: recipientInput.trim(),
      amountEth: amountInput.trim(),
      chainId: network.chainId,
      gasLimit: gasLimit.toString(),
      maxFeePerGasWei: feeData.maxFeePerGas?.toString() ?? null,
      gasPriceWei: feeData.gasPrice?.toString() ?? null,
      estimatedFeeEth: formatUnits(fee, network.decimals),
      totalRequiredEth: formatUnits(value + fee, network.decimals),
    };
  });
  return { ...result.value, rpcUrl: result.rpcUrl };
}
