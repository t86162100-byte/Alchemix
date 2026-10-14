const DB_NAME = 'ferra-wallet-v1';
const STORE_NAME = 'encrypted-keystore';
const KEY = 'primary';

/** Stores only an encrypted JSON keystore. Never pass plaintext secrets to this module. */
function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available in this browser.'));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open wallet storage.'));
    request.onblocked = () => reject(new Error('Wallet storage is blocked by another browser tab.'));
  });
}

export async function readKeystore(): Promise<string | null> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(KEY);
      request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : null);
      request.onerror = () => reject(request.error ?? new Error('Could not read encrypted wallet.'));
    });
  } finally { db.close(); }
}

export async function writeKeystore(encryptedJson: string): Promise<void> {
  if (!encryptedJson || typeof encryptedJson !== 'string') throw new Error('Refusing to store an empty wallet keystore.');
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(encryptedJson, KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not persist encrypted wallet.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Wallet storage transaction was aborted.'));
    });
  } finally { db.close(); }
}

export async function deleteKeystore(): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not delete encrypted wallet.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Wallet deletion was aborted.'));
    });
  } finally { db.close(); }
}
