const VAULT_STORAGE_KEY = 'tradingview-x.vault.v1';
const VAULT_AAD = new TextEncoder().encode('tradingview-x-vault-v1');
const PBKDF2_ITERATIONS = 600_000;

export type EncryptedVault = {
  version: 1;
  algorithm: 'AES-GCM';
  kdf: 'PBKDF2-SHA-256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function getCrypto(): Crypto {
  if (!globalThis.crypto?.subtle || !globalThis.crypto.getRandomValues) {
    throw new Error('Secure browser cryptography is unavailable. Open the app over HTTPS in a supported browser.');
  }
  return globalThis.crypto;
}

async function deriveEncryptionKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const cryptoApi = getCrypto();
  const material = await cryptoApi.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return cryptoApi.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function getSavedVault(): EncryptedVault | null {
  const raw = localStorage.getItem(VAULT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed || typeof parsed !== 'object' ||
      !('version' in parsed) || parsed.version !== 1 ||
      !('algorithm' in parsed) || parsed.algorithm !== 'AES-GCM' ||
      !('kdf' in parsed) || parsed.kdf !== 'PBKDF2-SHA-256' ||
      !('iterations' in parsed) || parsed.iterations !== PBKDF2_ITERATIONS ||
      !('salt' in parsed) || typeof parsed.salt !== 'string' ||
      !('iv' in parsed) || typeof parsed.iv !== 'string' ||
      !('ciphertext' in parsed) || typeof parsed.ciphertext !== 'string'
    ) {
      throw new Error('Unsupported encrypted vault format.');
    }
    return parsed as EncryptedVault;
  } catch {
    throw new Error('The encrypted wallet data in this browser is invalid or unsupported.');
  }
}

export async function encryptMnemonic(mnemonic: string, password: string): Promise<EncryptedVault> {
  if (password.length < 12) throw new Error('Use a password with at least 12 characters.');
  const cryptoApi = getCrypto();
  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const key = await deriveEncryptionKey(password, salt);
  const plaintext = new TextEncoder().encode(mnemonic.trim().split(/\s+/).join(' '));
  const encrypted = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: VAULT_AAD, tagLength: 128 },
    key,
    plaintext,
  );
  return {
    version: 1,
    algorithm: 'AES-GCM',
    kdf: 'PBKDF2-SHA-256',
    iterations: PBKDF2_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
  };
}

export async function decryptMnemonic(vault: EncryptedVault, password: string): Promise<string> {
  try {
    const cryptoApi = getCrypto();
    const salt = base64ToBytes(vault.salt);
    const iv = base64ToBytes(vault.iv);
    if (salt.length !== 16 || iv.length !== 12) throw new Error('Invalid encrypted vault parameters.');
    const key = await deriveEncryptionKey(password, salt);
    const plaintext = await cryptoApi.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: VAULT_AAD, tagLength: 128 },
      key,
      base64ToBytes(vault.ciphertext),
    );
    return new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
  } catch {
    throw new Error('Could not unlock this wallet. Check the password or restore using your recovery phrase.');
  }
}

export function saveVault(vault: EncryptedVault): void {
  try {
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(vault));
  } catch {
    throw new Error('Could not save the encrypted wallet in this browser. Check available storage and try again.');
  }
}

export function removeSavedVault(): void {
  localStorage.removeItem(VAULT_STORAGE_KEY);
}
