/** Chain adapters isolate network-specific address, balance, signing, and broadcast behavior. */
export type WalletAccount = { address: string; chainFamily: string };
export type UnsignedTransaction = { chainId: string; payload: unknown };
export type SignedTransaction = { chainId: string; rawTransaction: string };

export interface WalletChainAdapter {
  readonly family: string;
  validateAddress(address: string): boolean;
  getNativeBalance(address: string, networkId: string): Promise<bigint>;
  signTransaction(transaction: UnsignedTransaction): Promise<SignedTransaction>;
  broadcastTransaction(transaction: SignedTransaction): Promise<string>;
}

/**
 * Deliberately no generic fallback: EVM, Bitcoin/UTXO, Solana, Tron, TON, Aptos and Sui
 * have different transaction models and each needs a reviewed adapter before being advertised
 * as transaction-capable. Secret generation/storage belongs in a dedicated audited module and
 * must never use plaintext browser storage.
 */
export type ChainCapability = {
  networkId: string; family: string;
  canReadNativeBalance: boolean;
  canSignTransactions: boolean;
  canBroadcastTransactions: boolean;
  status: 'implemented' | 'planned' | 'unsupported';
};
