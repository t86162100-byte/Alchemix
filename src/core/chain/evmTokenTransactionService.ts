import { Contract, formatUnits, isAddress, JsonRpcProvider, parseUnits, type Signer } from 'ethers';
import type { EvmNetwork } from './evmService';

const ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
];

export type TokenTransferPreview = {
  chainId: number;
  from: string;
  to: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  amount: string;
  tokenBalance: string;
  estimatedFee: string;
  nativeSymbol: string;
};

function validateAmount(amountInput: string, decimals: number) {
  const amountText = amountInput.trim();
  if (!/^\d+(?:\.\d+)?$/.test(amountText) || (amountText.split('.')[1]?.length ?? 0) > decimals) {
    throw new Error('Enter a valid token amount with supported decimal places.');
  }
  const amount = parseUnits(amountText, decimals);
  if (amount <= 0n) throw new Error('The transfer amount must be greater than zero.');
  return { amountText, amount };
}

async function getTokenMetadata(contract: Contract) {
  const [decimalsRaw, symbolRaw] = await Promise.all([contract.decimals(), contract.symbol()]);
  const decimals = Number(decimalsRaw);
  const symbol = String(symbolRaw).trim();
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36 || !symbol || symbol.length > 32) {
    throw new Error('This token returned invalid metadata.');
  }
  return { decimals, symbol };
}

/** Read-only token preview. No signing or broadcast occurs here. */
export async function previewTokenTransfer(
  network: EvmNetwork,
  signer: Signer,
  tokenAddressInput: string,
  recipientInput: string,
  amountInput: string,
): Promise<TokenTransferPreview> {
  const tokenAddress = tokenAddressInput.trim();
  const recipient = recipientInput.trim();
  if (!isAddress(tokenAddress)) throw new Error('Enter a valid ERC-20 token contract address.');
  if (!isAddress(recipient)) throw new Error('Enter a valid recipient EVM address.');
  const provider = new JsonRpcProvider(network.rpcUrl, network.chainId, { staticNetwork: true });
  try {
    const [chain, from, feeData] = await Promise.all([provider.getNetwork(), signer.getAddress(), provider.getFeeData()]);
    if (Number(chain.chainId) !== network.chainId) throw new Error('RPC network mismatch. No transaction was prepared.');
    const connectedNetwork = await signer.provider?.getNetwork();
    if (connectedNetwork && Number(connectedNetwork.chainId) !== network.chainId) throw new Error('The unlocked signer is connected to a different network.');
    const contract = new Contract(tokenAddress, ERC20_ABI, provider);
    const { decimals, symbol } = await getTokenMetadata(contract);
    const { amountText, amount } = validateAmount(amountInput, decimals);
    const [balance, nativeBalance] = await Promise.all([contract.balanceOf(from), provider.getBalance(from)]);
    const feePerGas = feeData.maxFeePerGas ?? feeData.gasPrice;
    if (feePerGas == null) throw new Error('Could not estimate network fees.');
    const feeFields = feeData.maxFeePerGas != null
      ? { maxFeePerGas: feeData.maxFeePerGas, maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? undefined }
      : { gasPrice: feeData.gasPrice ?? undefined };
    const tx = await contract.transfer.populateTransaction(recipient, amount);
    const gasLimit = await provider.estimateGas({ ...tx, from, ...feeFields });
    const fee = gasLimit * feePerGas;
    if (balance < amount) throw new Error(`Insufficient ${symbol} token balance for this transfer.`);
    if (nativeBalance < fee) throw new Error(`Insufficient ${network.symbol} to cover the estimated network fee.`);
    return {
      chainId: network.chainId, from, to: recipient, tokenAddress, tokenSymbol: symbol, tokenDecimals: decimals,
      amount: amountText, tokenBalance: formatUnits(balance, decimals),
      estimatedFee: formatUnits(fee, network.decimals), nativeSymbol: network.symbol,
    };
  } finally {
    provider.destroy();
  }
}

/** Broadcast a locally signed ERC-20 transfer only after explicit confirmation. */
export async function sendTokenTransfer(
  network: EvmNetwork,
  signer: Signer,
  tokenAddressInput: string,
  recipientInput: string,
  amountInput: string,
  confirmed: boolean,
): Promise<{ hash: string; chainId: number; from: string; to: string; tokenSymbol: string; amount: string }> {
  if (!confirmed) throw new Error('Confirm the token contract, recipient, amount, network, and fee before sending.');
  const tokenAddress = tokenAddressInput.trim();
  const recipient = recipientInput.trim();
  if (!isAddress(tokenAddress)) throw new Error('Enter a valid ERC-20 token contract address.');
  if (!isAddress(recipient)) throw new Error('Enter a valid recipient EVM address.');
  const provider = new JsonRpcProvider(network.rpcUrl, network.chainId, { staticNetwork: true });
  try {
    const chain = await provider.getNetwork();
    if (Number(chain.chainId) !== network.chainId) throw new Error('RPC network mismatch. No transaction was sent.');
    const connectedNetwork = await signer.provider?.getNetwork();
    if (connectedNetwork && Number(connectedNetwork.chainId) !== network.chainId) throw new Error('The unlocked signer is connected to a different network. No transaction was sent.');
    const contract = new Contract(tokenAddress, ERC20_ABI, provider);
    const { decimals, symbol } = await getTokenMetadata(contract);
    const { amountText, amount } = validateAmount(amountInput, decimals);
    const from = await signer.getAddress();
    const [balance, nativeBalance, feeData] = await Promise.all([
      contract.balanceOf(from), provider.getBalance(from), provider.getFeeData(),
    ]);
    if (balance < amount) throw new Error(`Insufficient ${symbol} token balance. No transaction was sent.`);
    const feePerGas = feeData.maxFeePerGas ?? feeData.gasPrice;
    if (feePerGas == null) throw new Error('Could not estimate network fees. No transaction was sent.');
    const feeFields = feeData.maxFeePerGas != null
      ? { maxFeePerGas: feeData.maxFeePerGas, maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? undefined }
      : { gasPrice: feeData.gasPrice ?? undefined };
    const tx = await contract.transfer.populateTransaction(recipient, amount);
    const gasLimit = await provider.estimateGas({ ...tx, from, ...feeFields });
    if (nativeBalance < gasLimit * feePerGas) throw new Error(`Insufficient ${network.symbol} to cover the network fee. No transaction was sent.`);
    const connectedSigner = signer.connect(provider);
    const signedContract = new Contract(tokenAddress, ERC20_ABI, connectedSigner);
    const response = await signedContract.transfer(recipient, amount, { gasLimit, ...feeFields, chainId: network.chainId });
    return { hash: response.hash, chainId: network.chainId, from, to: recipient, tokenSymbol: symbol, amount: amountText };
  } finally {
    provider.destroy();
  }
}
