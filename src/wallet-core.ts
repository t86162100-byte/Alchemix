import { initWasm } from '@trustwallet/wallet-core';

export type WalletCoreRuntime = Awaited<ReturnType<typeof initWasm>>;

let runtimePromise: Promise<WalletCoreRuntime> | undefined;

/**
 * Initialize the upstream Wallet Core WASM runtime without creating or
 * importing a wallet. This deliberately does not touch seed phrases or keys.
 */
export function initializeWalletCore(): Promise<WalletCoreRuntime> {
  if (!runtimePromise) {
    runtimePromise = initWasm().then((runtime) => {
      if (!runtime || !runtime.CoinType || !runtime.HDWallet) {
        throw new Error('Wallet Core initialized without the expected wallet APIs.');
      }
      return runtime;
    }).catch((error: unknown) => {
      runtimePromise = undefined;
      throw error;
    });
  }
  return runtimePromise;
}
