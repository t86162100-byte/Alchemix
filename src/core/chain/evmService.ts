import { formatEther, isAddress, JsonRpcProvider, parseEther } from 'ethers';

export type EvmNetwork = {
  key: 'ethereum' | 'base';
  name: string;
  chainId: number;
  symbol: 'ETH';
  rpcUrl: string;
  explorerUrl: string;
};

export const EVM_NETWORKS: EvmNetwork[] = [
  {
    key: 'ethereum',
    name: 'Ethereum Mainnet',
    chainId: 1,
    symbol: 'ETH',
    rpcUrl: 'https://cloudflare-eth.com',
    explorerUrl: 'https://etherscan.io',
  },
  {
    key: 'base',
    name: 'Base Mainnet',
    chainId: 8453,
    symbol: 'ETH',
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
  },
];

export type NetworkSnapshot = {
  chainId: number;
  blockNumber: number;
  balanceWei: string;
  balanceEth: string;
};

function providerFor(network: EvmNetwork): JsonRpcProvider {
  return new JsonRpcProvider(network.rpcUrl, network.chainId, { staticNetwork: true });
}

/** Read-only RPC calls. Only the public address is sent to the RPC endpoint. */
export async function readNetworkSnapshot(network: EvmNetwork, address: string): Promise<NetworkSnapshot> {
  if (!isAddress(address)) throw new Error('The wallet address is not a valid EVM address.');
  const provider = providerFor(network);
  try {
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
      balanceEth: formatEther(balance),
    };
  } finally {
    provider.destroy();
  }
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
};

function cleanDecimal(value: string): string {
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: 8, useGrouping: false });
}

/**
 * Prepares and estimates a native ETH transfer without signing or broadcasting it.
 * No wallet object or private key is accepted by this function.
 */
export async function estimateNativeTransfer(
  network: EvmNetwork,
  fromAddress: string,
  recipientInput: string,
  amountInput: string,
): Promise<TransferEstimate> {
  if (!isAddress(fromAddress)) throw new Error('Unlock your wallet to use its public address.');
  if (!isAddress(recipientInput.trim())) throw new Error('Enter a valid recipient EVM address.');
  if (!amountInput.trim() || !/^\\d+(?:\\.\\d{1,18})?$/.test(amountInput.trim())) {
    throw new Error('Enter a valid ETH amount with up to 18 decimal places.');
  }
  const value = parseEther(amountInput.trim());
  if (value <= 0n) throw new Error('The transfer amount must be greater than zero.');

  const provider = providerFor(network);
  try {
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
      amountEth: cleanDecimal(amountInput.trim()),
      chainId: network.chainId,
      gasLimit: gasLimit.toString(),
      maxFeePerGasWei: feeData.maxFeePerGas?.toString() ?? null,
      gasPriceWei: feeData.gasPrice?.toString() ?? null,
      estimatedFeeEth: formatEther(fee),
      totalRequiredEth: formatEther(value + fee),
    };
  } finally {
    provider.destroy();
  }
}
