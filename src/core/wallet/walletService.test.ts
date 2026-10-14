import { describe, expect, it } from 'vitest';
import { Mnemonic, Wallet } from 'ethers';
import { createWalletDraft, importWalletDraft } from './walletService';

describe('wallet foundation', () => {
  it('creates a valid random twelve-word wallet and derives its address', async () => {
    const draft = await createWalletDraft();
    expect(draft.phrase.trim().split(/\\s+/)).toHaveLength(12);
    expect(Mnemonic.isValidMnemonic(draft.phrase)).toBe(true);
    expect(draft.address).toBe(Wallet.fromPhrase(draft.phrase).address);
  });

  it('imports a valid recovery phrase deterministically', () => {
    const phrase = 'test test test test test test test test test test test junk';
    const imported = importWalletDraft(phrase);
    expect(imported.address).toBe(Wallet.fromPhrase(phrase).address);
  });

  it('rejects an invalid recovery phrase', () => {
    expect(() => importWalletDraft('this is not a valid recovery phrase')).toThrow(/invalid/i);
  });
});
