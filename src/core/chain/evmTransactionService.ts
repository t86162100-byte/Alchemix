import { formatUnits, isAddress, JsonRpcProvider, parseUnits, type Signer } from 'ethers';
import type { EvmNetwork } from './evmService';

export type NativeSendPreview = {
  chainId: number;
  from: string;
  to: string;
  amount: string;
  symbol: string;
  estimatedFee: string;
  totalRequired: string;
};

/**
 * Build a fresh native-transfer preview against the selected chain.
 * This function does not sign or broadcast a transaction.
 */
export async function previewNativeSend(
  network: EvmNetwork,
  signer: Signer,
  recipientInput: string,
  amountInput: string,
): Promise<NativeSendPreview> {
  const recipient = recipientInput.trim();
  if (!isAddress(recipient)) throw new Error('Enter a valid recipient EVM address.');
  const amountText = amountInput.trim();
  if (!/^\d+(?:\.\d+)?$/.test(amountText) || (amountText.split('.')[1]?.length ?? 0) > network.decimals) {
    throw new Error('Enter a valid amount with supported decimal places.');
  }
  const value = parseUnits(amountText, network.decimals);
  if (value <= 0n) throw new Error('The amount must be greater than zero.');

  const provider = new JsonRpcProvider(network.rpcUrl, network.chainId, { staticNetwork: true });
  try {
    const [chain, from, feeData] = await Promise.all([
      provider.getNetwork(),
      signer.getAddress(),
      provider.getFeeData(),
    ]);
    if (Number(chain.chainId) !== network.chainId) {
      throw new Error(`RPC network mismatch: expected chain ID ${network.chainId}, received ${chain.chainId.toString()}.`);
    }
    const connectedProvider = await signer.provider?.getNetwork();
    if (connectedProvider && Number(connectedProvider.chainId) !== network.chainId) {
      throw new Error('The unlocked signer is connected to a different network.');
    }
    const feePerGas = feeData.maxFeePerGas ?? feeData.gasPrice;
    if (feePerGas == null) throw new Error('Could not estimate network fees. Sending is unavailable right now.');
    const gasLimit = await provider.estimateGas({ from, to: recipient, value });
    const estimatedFee = gasLimit * feePerGas;
    const balance = await provider.getBalance(from);
    if (balance < value + estimatedFee) throw new Error(`Insufficient ${network.symbol} to cover the amount and estimated network fee.`);
    return {
      chainId: network.chainId,
      from,
      to: recipient,
      amount: amountText,
      symbol: network.symbol,
      estimatedFee: formatUnits(estimatedFee, network.decimals),
      totalRequired: formatUnits(value + estimatedFee, network.decimals),
    };
  } finally {
    provider.destroy();
  }
}

export type NativeSendResult = {
  hash: string;
  chainId: number;
  from: string;
  to: string;
  amount: string;
  symbol: string;
};

/**
 * Submit an EVM native-coin transfer only after an explicit user confirmation.
 * The caller must pass the already-unlocked local signer. Never pass a mnemonic
 * or plaintext private key to this function or persist them in transaction state.
 *
 * Deliberately uses one RPC endpoint: retrying a timed-out broadcast on another
 * endpoint can obscure whether the first submission reached the network.
 */
export async function sendNativeTransfer(
  network: EvmNetwork,
  signer: Signer,
  recipientInput: string,
  amountInput: string,
  confirmed: boolean,
): Promise<NativeSendResult> {
  if (!confirmed) throw new Error('Confirm the recipient, amount, network, and fee before sending.');
  const recipient = recipientInput.trim();
  if (!isAddress(recipient)) throw new Error('Enter a valid recipient EVM address.');
  const amountText = amountInput.trim();
  if (!/^\d+(?:\.\d+)?$/.test(amountText) || (amountText.split('.')[1]?.length ?? 0) > network.decimals) {
    throw new Error('Enter a valid amount with supported decimal places.');
  }
  const value = parseUnits(amountText, network.decimals);
  if (value <= 0n) throw new Error('The amount must be greater than zero.');

  const provider = new JsonRpcProvider(network.rpcUrl, network.chainId, { staticNetwork: true });
  try {
    const chain = await provider.getNetwork();
    if (Number(chain.chainId) !== network.chainId) {
      throw new Error(`RPC network mismatch: expected chain ID ${network.chainId}, received ${chain.chainId.toString()}. No transaction was sent.`);
    }
    const from = await signer.getAddress();
    const signerProviderNetwork = await signer.provider?.getNetwork();
    if (signerProviderNetwork && Number(signerProviderNetwork.chainId) !== network.chainId) {
      throw new Error('The unlocked signer is connected to a different network. No transaction was sent.');
    }
    const feeData = await provider.getFeeData();
    const feePerGas = feeData.maxFeePerGas ?? feeData.gasPrice;
    if (feePerGas == null) throw new Error('Could not estimate network fees. No transaction was sent.');
    const gasLimit = await provider.estimateGas({ from, to: recipient, value });
    const estimatedFee = gasLimit * feePerGas;
    const balance = await provider.getBalance(from);
    if (balance < value + estimatedFee) throw new Error(`Insufficient ${network.symbol} to cover the amount and estimated network fee. No transaction was sent.`);

    // Connect the local signer to the verified RPC; ethers performs signing locally.
    const response = await signer.connect(provider).sendTransaction({
      to: recipient,
      value,
      gasLimit,
      ...(feeData.maxFeePerGas != null
        ? { maxFeePerGas: feeData.maxFeePerGas, maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? undefined }
        : { gasPrice: feeData.gasPrice ?? undefined }),
      chainId: network.chainId,
    });
    return { hash: response.hash, chainId: network.chainId, from, to: recipient, amount: amountText, symbol: network.symbol };
  } finally {
    provider.destroy();
  }
}

/** Track a previously submitted hash. A null receipt means it is still pending. */
export async function waitForNativeTransfer(
  network: EvmNetwork,
  transactionHash: string,
  confirmations = 1,
): Promise<'pending' | 'confirmed' | 'reverted'> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(transactionHash)) throw new Error('Invalid EVM transaction hash.');
  if (!Number.isInteger(confirmations) || confirmations < 1 || confirmations > 64) {
    throw new Error('Confirmations must be an integer between 1 and 64.');
  }
  const provider = new JsonRpcProvider(network.rpcUrl, network.chainId, { staticNetwork: true });
  try {
    const chain = await provider.getNetwork();
    if (Number(chain.chainId) !== network.chainId) throw new Error('RPC network mismatch while checking transaction status.');
    const receipt = await provider.getTransactionReceipt(transactionHash);
    if (!receipt) return 'pending';
    if (receipt.status === 0) return 'reverted';
    const latestBlock = await provider.getBlockNumber();
    return latestBlock - receipt.blockNumber + 1 >= confirmations ? 'confirmed' : 'pending';
  } finally {
    provider.destroy();
  }
}
