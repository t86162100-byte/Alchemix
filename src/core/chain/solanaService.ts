import { Mnemonic, formatUnits, parseUnits } from 'ethers';

export const SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'";

export type SolanaSnapshot = {
  address: string;
  balanceLamports: string;
  balanceSol: string;
  slot: number;
  rpcUrl: string;
};

const DEFAULT_SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com';

/**
 * Configure VITE_SOLANA_RPC_URL to a dedicated Solana Mainnet RPC provider for
 * production. The public endpoint is only a development fallback and may block
 * browser traffic (HTTP 403) or rate-limit requests.
 */
function getSolanaRpcUrl(): string {
  // Type this locally so the service still typechecks if Vite's ImportMeta
  // declarations are not included by the project's TypeScript configuration.
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const configured = env?.VITE_SOLANA_RPC_URL?.trim();
  const url = configured || DEFAULT_SOLANA_RPC_URL;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Solana RPC URL is invalid. Configure VITE_SOLANA_RPC_URL with a valid HTTPS endpoint.');
  }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    throw new Error('Solana RPC must use HTTPS.');
  }
  return url;
}

/** SLIP-0010 Ed25519 hardened derivation using browser-native Web Crypto. */
async function deriveEd25519Seed(seedHex: string): Promise<Uint8Array> {
  const fromHex = (hex: string) => Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) => parseInt(byte, 16));
  const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return copy.buffer;
  };
  const hmac = async (keyBytes: Uint8Array, data: Uint8Array): Promise<Uint8Array> => {
    const key = await crypto.subtle.importKey('raw', toArrayBuffer(keyBytes), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', key, toArrayBuffer(data)));
  };

  let digest = await hmac(new TextEncoder().encode('ed25519 seed'), fromHex(seedHex));
  let key = digest.slice(0, 32);
  let chainCode = digest.slice(32);
  for (const index of [44, 501, 0, 0]) {
    const data = new Uint8Array(37);
    data[0] = 0;
    data.set(key, 1);
    const hardenedIndex = (index + 0x80000000) >>> 0;
    data[33] = (hardenedIndex >>> 24) & 0xff;
    data[34] = (hardenedIndex >>> 16) & 0xff;
    data[35] = (hardenedIndex >>> 8) & 0xff;
    data[36] = hardenedIndex & 0xff;
    digest = await hmac(chainCode, data);
    key = digest.slice(0, 32);
    chainCode = digest.slice(32);
  }
  return key;
}

/** Derive the first Solana account from a BIP-39 phrase using a hardened Ed25519 path. */
export async function deriveSolanaKeypair(phraseInput: string) {
  const phrase = phraseInput.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!Mnemonic.isValidMnemonic(phrase)) {
    throw new Error('A valid recovery phrase is required to derive the Solana account.');
  }
  const { Keypair } = await import('@solana/web3.js');
  const seedHex = Mnemonic.fromPhrase(phrase).computeSeed().replace(/^0x/, '');
  const derivedSeed = await deriveEd25519Seed(seedHex);
  return Keypair.fromSeed(derivedSeed);
}

export async function deriveSolanaAddress(phraseInput: string): Promise<string> {
  const keypair = await deriveSolanaKeypair(phraseInput);
  return keypair.publicKey.toBase58();
}

/** Read-only SOL balance lookup. Only the derived public address is sent to RPC. */
export async function readSolanaSnapshot(phraseInput: string): Promise<SolanaSnapshot> {
  const address = await deriveSolanaAddress(phraseInput);
  const { Connection, PublicKey } = await import('@solana/web3.js');
  const rpcUrl = getSolanaRpcUrl();
  const connection = new Connection(rpcUrl, {
    commitment: 'confirmed',
    disableRetryOnRateLimit: false,
    confirmTransactionInitialTimeout: 15_000,
  });
  const publicKey = new PublicKey(address);
  try {
    const [balance, slot] = await Promise.all([
      connection.getBalance(publicKey, 'confirmed'),
      connection.getSlot('confirmed'),
    ]);
    return {
      address,
      balanceLamports: String(balance),
      balanceSol: formatUnits(BigInt(balance), 9),
      slot,
      rpcUrl,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/403|access forbidden|forbidden/i.test(message)) {
      throw new Error('Solana RPC access was denied (HTTP 403). Check the configured provider endpoint and API key; the shared public endpoint may block browser traffic.');
    }
    if (/429|rate.?limit/i.test(message)) {
      throw new Error('Solana RPC rate limit reached. Wait briefly or check your provider plan and request limits.');
    }
    throw new Error(`Solana RPC request failed: ${message}`);
  }
}


export type SolanaTransferPreview = {
  from: string;
  to: string;
  amountSol: string;
  amountLamports: string;
  estimatedFeeSol: string;
  estimatedFeeLamports: string;
  totalRequiredSol: string;
  totalRequiredLamports: string;
  balanceSol: string;
  rpcUrl: string;
  blockhash: string;
  lastValidBlockHeight: number;
};

function parseSolAmount(amountInput: string): bigint {
  const value = amountInput.trim();
  if (!/^\d+(?:\.\d{1,9})?$/.test(value)) {
    throw new Error('Enter a positive SOL amount with no more than 9 decimal places.');
  }
  let amount: bigint;
  try { amount = parseUnits(value, 9); } catch { throw new Error('Enter a valid SOL amount.'); }
  if (amount <= 0n) throw new Error('The transfer amount must be greater than zero.');
  return amount;
}

export async function previewSolanaTransfer(phraseInput: string, recipientInput: string, amountInput: string): Promise<SolanaTransferPreview> {
  const { Connection, PublicKey, SystemProgram, Transaction } = await import('@solana/web3.js');
  const keypair = await deriveSolanaKeypair(phraseInput);
  let recipient;
  try { recipient = new PublicKey(recipientInput.trim()); } catch { throw new Error('Enter a valid Solana recipient address.'); }
  if (!recipient.toBase58()) {
    throw new Error('The recipient address is invalid.');
  }
  if (recipient.equals(keypair.publicKey)) throw new Error('Sending SOL to the same wallet address is not allowed.');
  const amountLamports = parseSolAmount(amountInput);
  const rpcUrl = getSolanaRpcUrl();
  const connection = new Connection(rpcUrl, { commitment: 'confirmed', confirmTransactionInitialTimeout: 30_000 });
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const transaction = new Transaction({
    feePayer: keypair.publicKey,
    recentBlockhash: blockhash,
  }).add(SystemProgram.transfer({
    fromPubkey: keypair.publicKey,
    toPubkey: recipient,
    lamports: amountLamports,
  }));
  const fee = await connection.getFeeForMessage(transaction.compileMessage(), 'confirmed');
  if (fee.value === null) throw new Error('Solana RPC could not estimate the transaction fee. Try again shortly.');
  const balance = BigInt(await connection.getBalance(keypair.publicKey, 'confirmed'));
  const totalRequired = amountLamports + BigInt(fee.value);
  if (balance < totalRequired) {
    throw new Error(`Insufficient SOL. This transfer requires ${formatUnits(totalRequired, 9)} SOL including the estimated network fee; the available balance is ${formatUnits(balance, 9)} SOL.`);
  }
  return {
    from: keypair.publicKey.toBase58(),
    to: recipient.toBase58(),
    amountSol: formatUnits(amountLamports, 9),
    amountLamports: amountLamports.toString(),
    estimatedFeeSol: formatUnits(BigInt(fee.value), 9),
    estimatedFeeLamports: String(fee.value),
    totalRequiredSol: formatUnits(totalRequired, 9),
    totalRequiredLamports: totalRequired.toString(),
    balanceSol: formatUnits(balance, 9),
    rpcUrl,
    blockhash,
    lastValidBlockHeight,
  };
}

export async function sendSolanaTransfer(
  phraseInput: string,
  recipientInput: string,
  amountInput: string,
  userConfirmed: boolean,
): Promise<{ signature: string; preview: SolanaTransferPreview }> {
  if (!userConfirmed) throw new Error('Review the transfer and confirm before signing.');
  const preview = await previewSolanaTransfer(phraseInput, recipientInput, amountInput);
  const { Connection, SystemProgram, Transaction } = await import('@solana/web3.js');
  const keypair = await deriveSolanaKeypair(phraseInput);
  if (keypair.publicKey.toBase58() !== preview.from) throw new Error('The active wallet changed. Review the transfer again.');
  const connection = new Connection(preview.rpcUrl, { commitment: 'confirmed', confirmTransactionInitialTimeout: 30_000 });
  const transaction = new Transaction({
    feePayer: keypair.publicKey,
    recentBlockhash: preview.blockhash,
  }).add(SystemProgram.transfer({
    fromPubkey: keypair.publicKey,
    toPubkey: new (await import('@solana/web3.js')).PublicKey(preview.to),
    lamports: BigInt(preview.amountLamports),
  }));
  const signature = await connection.sendTransaction(transaction, [keypair], {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
    maxRetries: 3,
  });
  // Submission is reported separately from finality; never automatically retry a timed-out send.
  try {
    await connection.confirmTransaction({
      signature,
      blockhash: preview.blockhash,
      lastValidBlockHeight: preview.lastValidBlockHeight,
    }, 'confirmed');
  } catch {
    // The signature is still returned so the user can inspect the explorer and avoid duplicate sends.
  }
  return { signature, preview };
}
