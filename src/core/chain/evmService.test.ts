import { describe, expect, it } from 'vitest';
import { EVM_NETWORKS, estimateNativeTransfer, readNetworkSnapshot } from './evmService';

const validAddress = '0x0000000000000000000000000000000000000001';

describe('EVM RPC validation', () => {
  it('exposes only the implemented Ethereum and Base mainnets', () => {
    expect(EVM_NETWORKS.map(network => [network.name, network.chainId])).toEqual([
      ['Ethereum Mainnet', 1],
      ['Base Mainnet', 8453],
    ]);
  });

  it('rejects an invalid address before attempting an RPC call', async () => {
    await expect(readNetworkSnapshot(EVM_NETWORKS[0], 'not-an-address'))
      .rejects.toThrow('not a valid EVM address');
  });

  it('rejects an invalid sender before attempting an RPC call', async () => {
    await expect(estimateNativeTransfer(EVM_NETWORKS[0], 'not-an-address', validAddress, '0.1'))
      .rejects.toThrow('public address');
  });

  it('rejects an invalid recipient before attempting an RPC call', async () => {
    await expect(estimateNativeTransfer(EVM_NETWORKS[0], validAddress, 'not-an-address', '0.1'))
      .rejects.toThrow('valid recipient');
  });

  it('rejects malformed and zero amounts before attempting an RPC call', async () => {
    await expect(estimateNativeTransfer(EVM_NETWORKS[0], validAddress, validAddress, 'abc'))
      .rejects.toThrow('valid ETH amount');
    await expect(estimateNativeTransfer(EVM_NETWORKS[0], validAddress, validAddress, '0'))
      .rejects.toThrow('greater than zero');
  });
});
