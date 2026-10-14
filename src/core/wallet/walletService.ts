import { HDNodeWallet, Mnemonic, Wallet } from 'ethers';

export type WalletDraft = {
  wallet: HDNodeWallet;
  phrase: string;
  address: string;
};

/** Uses ethers' audited implementation for entropy, BIP-39 mnemonic, and HD derivation. */
export async function createWalletDraft(): Promise<WalletDraft> {
  const wallet = Wallet.createRandom();
  if (!wallet.mnemonic) throw new Error('The wallet library did not return a recovery phrase.');
  return { wallet, phrase: wallet.mnemonic.phrase, address: wallet.address };
}

/** Validate BIP-39 checksum and derive the standard Ethereum account locally. */
export function importWalletDraft(phraseInput: string): WalletDraft {
  const phrase = phraseInput.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!Mnemonic.isValidMnemonic(phrase)) {
    throw new Error('This recovery phrase is invalid. Check the words and their order.');
  }
  const wallet = Wallet.fromPhrase(phrase);
  return { wallet, phrase, address: wallet.address };
}

export async function unlockWallet(encryptedJson: string, password: string): Promise<HDNodeWallet | Wallet> {
  if (!encryptedJson) throw new Error('No encrypted wallet is available.');
  if (!password) throw new Error('Enter the wallet password.');
  return Wallet.fromEncryptedJson(encryptedJson, password);
}
