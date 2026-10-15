import { describe, expect, it } from 'vitest';
import { estimateNativeTransfer, readNetworkSnapshot, type EvmNetwork } from './evmService';

const validAddress = '0x0000000000000000000000000000000000000001';
const sampleNetwork: EvmNetwork = {
  key: '1',
  name: 'Test EVM Network',
  chainId: 1,
  symbol: 'TST',
  decimals: 18,
  rpcUrl: 'https://rpc.example.invalid',
  fallbackRpcUrls: [],
  explorerUrl: 'https://explorer.example.invalid',
};

describe('EVM RPC validation', () => {
  it('rejects an invalid address before attempting an RPC call', async () => {
    await expect(readNetworkSnapshot(sampleNetwork, 'not-an-address'))
      .rejects.toThrow('not a valid EVM address');
  });

  it('rejects an invalid sender before attempting an RPC call', async () => {
    await expect(estimateNativeTransfer(sampleNetwork, 'not-an-address', validAddress, '0.1'))
      .rejects.toThrow('public address');
  });

  it('rejects an invalid recipient before attempting an RPC call', async () => {
    await expect(estimateNativeTransfer(sampleNetwork, validAddress, 'not-an-address', '0.1'))
      .rejects.toThrow('valid recipient');
  });

  it('rejects malformed and zero amounts before attempting an RPC call', async () => {
    await expect(estimateNativeTransfer(sampleNetwork, validAddress, validAddress, 'abc'))
      .rejects.toThrow('valid native-coin amount');
    await expect(estimateNativeTransfer(sampleNetwork, validAddress, validAddress, '0'))
      .rejects.toThrow('greater than zero');
  });

  it('rejects amounts with more fractional digits than the native currency supports', async () => {
    const sixDecimalNetwork = { ...sampleNetwork, decimals: 6 };
    await expect(estimateNativeTransfer(sixDecimalNetwork, validAddress, validAddress, '0.0000001'))
      .rejects.toThrow('valid native-coin amount');
  });
});
