import { describe, expect, it } from 'vitest';
import { deriveSolanaAddress, SOLANA_DERIVATION_PATH } from './solana-derivation';

const TRUST_WALLET_CORE_SOLANA_MNEMONIC =
  'team engine square letter hero song dizzy scrub tornado fabric divert saddle';
const TRUST_WALLET_CORE_SOLANA_ADDRESS =
  'HiipoCKL8hX2RVmJTz3vaLy34hS2zLhWWMkUWtw85TmZ';

describe('Solana BIP-39 / SLIP-0010 derivation', () => {
  it('uses the documented default Solana path', () => {
    expect(SOLANA_DERIVATION_PATH).toBe("m/44'/501'/0'");
  });

  it('matches the published Trust Wallet Core Solana reference address', () => {
    expect(deriveSolanaAddress(TRUST_WALLET_CORE_SOLANA_MNEMONIC)).toBe(
      TRUST_WALLET_CORE_SOLANA_ADDRESS,
    );
  });

  it('rejects an invalid BIP-39 phrase instead of deriving from it', () => {
    expect(() =>
      deriveSolanaAddress('ripple scissors hisc mammal hire column oak again sun offer wealth tomorrow'),
    ).toThrow(/invalid english BIP-39 recovery phrase/i);
  });

  it('uses the optional BIP-39 passphrase as part of seed derivation', () => {
    expect(deriveSolanaAddress(TRUST_WALLET_CORE_SOLANA_MNEMONIC, 'different passphrase')).not.toBe(
      TRUST_WALLET_CORE_SOLANA_ADDRESS,
    );
  });
});
