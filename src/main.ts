import './style.css';
import { initializeWalletCore, type WalletCoreRuntime } from './wallet-core';
import {
  decryptMnemonic,
  encryptMnemonic,
  getSavedVault,
  removeSavedVault,
  saveVault,
} from './vault';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root element was not found');

type WalletAddress = { label: string; ticker: string; value: string };
type View = 'welcome' | 'create-phrase' | 'restore' | 'locked' | 'ready';

let view: View = 'welcome';
let pendingMnemonic: string | null = null;
let addresses: WalletAddress[] = [];
let errorMessage = '';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

function normalizeMnemonic(value: string): string {
  return value.trim().toLowerCase().split(/\s+/).filter(Boolean).join(' ');
}

function setError(message: string): void {
  errorMessage = message;
  const target = document.querySelector<HTMLParagraphElement>('#form-error');
  if (target) {
    target.textContent = message;
    target.hidden = !message;
  }
}

function setBusy(busy: boolean, message = ''): void {
  document.querySelectorAll<HTMLButtonElement>('button[type="submit"], button[data-busy]').forEach((button) => {
    button.disabled = busy;
  });
  const note = document.querySelector<HTMLParagraphElement>('#busy-note');
  if (note && message) note.textContent = message;
  const busyIndicator = document.querySelector<HTMLSpanElement>('#busy-indicator');
  if (busyIndicator) busyIndicator.textContent = busy ? 'WORKING…' : '';
}

function deriveAddresses(core: WalletCoreRuntime, mnemonic: string): WalletAddress[] {
  const wallet = core.HDWallet.createWithMnemonic(mnemonic, '');
  try {
    const ethereumAddress = String(wallet.getAddressForCoin(core.CoinType.ethereum));
    const bitcoinAddress = String(wallet.getAddressForCoin(core.CoinType.bitcoin));
    if (!ethereumAddress || ethereumAddress === '[object Object]' || !bitcoinAddress || bitcoinAddress === '[object Object]') {
      throw new Error('Wallet Core did not return usable addresses.');
    }
    return [
      { label: 'Ethereum', ticker: 'ETH', value: ethereumAddress },
      { label: 'Bitcoin', ticker: 'BTC', value: bitcoinAddress },
    ];
  } finally {
    wallet.delete();
  }
}

function render(): void {
  const error = errorMessage
    ? `<p class="form-error" id="form-error" role="alert">${escapeHtml(errorMessage)}</p>`
    : '<p class="form-error" id="form-error" role="alert" hidden></p>';
  const header = `
    <header class="topbar">
      <a class="brand" href="#" aria-label="Tradingview X home"><span class="brand-mark">X</span><span>Tradingview <strong>X</strong></span></a>
      <span class="environment"><span class="dot"></span> DEVELOPMENT BUILD</span>
    </header>`;
  const footer = `
    <footer><span>TRADINGVIEW X <span class="footer-sep">/</span> WALLET FOUNDATION</span><span>Self-custody first · No simulated balances</span></footer>`;

  let content = '';
  if (view === 'welcome') {
    content = `
      <section class="hero">
        <div class="eyebrow"><span class="eyebrow-line"></span> YOUR KEYS. YOUR ASSETS.</div>
        <h1>One wallet.<br /><span>Every chain.</span></h1>
        <p class="intro">Create a self-custodial wallet or restore one with a recovery phrase. Your recovery phrase is encrypted in this browser and is never sent to our server.</p>
        ${error}
        <div class="actions action-stack">
          <button class="primary active" id="create-wallet" data-busy>Create a new wallet <span>↗</span></button>
          <button class="secondary" id="show-restore">Restore with recovery phrase</button>
        </div>
        <p class="security-note"><strong>Development build:</strong> Do not use a wallet containing real funds yet. This implementation is an initial security milestone and has not undergone an independent security audit.</p>
      </section>
      <section class="grid" aria-label="Wallet security status">
        <article class="card"><div class="card-head"><span class="icon">⌘</span><span class="tag tag-green">READY</span></div><h2>Cryptographic engine</h2><p>Trust Wallet Core WASM initializes in this browser and derives standard wallet addresses.</p><div class="meta"><span>Engine</span><strong>Initialized on demand</strong></div></article>
        <article class="card"><div class="card-head"><span class="icon">▧</span><span class="tag">LOCAL ONLY</span></div><h2>Encrypted recovery</h2><p>A password encrypts the recovery phrase with AES-256-GCM. The encryption key is derived locally using PBKDF2-SHA-256.</p><div class="meta"><span>Plaintext storage</span><strong>Never saved</strong></div></article>
        <article class="card"><div class="card-head"><span class="icon">⇄</span><span class="tag">LOCKED</span></div><h2>Transactions</h2><p>Balance retrieval and sending are not part of this milestone. No transaction controls are enabled.</p><div class="meta"><span>Send status</span><strong>Disabled</strong></div></article>
      </section>`;
  } else if (view === 'create-phrase') {
    const words = (pendingMnemonic ?? '').split(' ').map((word, index) =>
      `<div class="phrase-word"><span>${index + 1}</span><strong>${escapeHtml(word)}</strong></div>`,
    ).join('');
    content = `
      <section class="form-panel">
        <div class="eyebrow"><span class="eyebrow-line"></span> STEP 1 OF 2 · BACK UP</div>
        <h1>Your recovery<br /><span>phrase.</span></h1>
        <p class="intro">Write these 12 words down offline, in the exact order shown. Anyone who has this phrase can control the wallet.</p>
        <div class="warning-box"><strong>Keep it private.</strong> Never share these words, enter them into chat, or save a screenshot. Tradingview X will not ask you to send them to anyone.</div>
        <div class="phrase-grid" aria-label="Recovery phrase words">${words}</div>
        ${error}
        <form id="backup-form" class="wallet-form">
          <label class="checkbox-row"><input id="backup-ack" type="checkbox" required /><span>I have written down the recovery phrase and stored it somewhere private.</span></label>
          <label for="phrase-confirm">Confirm recovery phrase</label>
          <textarea id="phrase-confirm" name="phrase-confirm" rows="3" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Type all 12 words in the correct order" required></textarea>
          <label for="new-password">Create wallet password</label>
          <input id="new-password" name="password" type="password" minlength="12" autocomplete="new-password" placeholder="At least 12 characters" required />
          <label for="confirm-password">Confirm password</label>
          <input id="confirm-password" name="confirm-password" type="password" minlength="12" autocomplete="new-password" placeholder="Repeat your password" required />
          <p class="muted-note">This password encrypts the wallet on this browser. It cannot recover the wallet without the recovery phrase.</p>
          <button class="primary active" type="submit">Confirm and encrypt wallet <span>↗</span></button>
          <p id="busy-note" class="muted-note">Your wallet is not saved until the phrase is confirmed.</p><span id="busy-indicator" class="busy-indicator"></span>
        </form>
        <button class="text-button" id="cancel-create">Cancel</button>
      </section>`;
  } else if (view === 'restore') {
    content = `
      <section class="form-panel compact-panel">
        <div class="eyebrow"><span class="eyebrow-line"></span> RESTORE WALLET</div>
        <h1>Bring your wallet<br /><span>back.</span></h1>
        <p class="intro">Enter your existing BIP-39 recovery phrase to derive its addresses and encrypt it in this browser.</p>
        <div class="warning-box"><strong>Privacy warning.</strong> Only enter a phrase you control, and never enter a real-funds phrase in this development build.</div>
        ${error}
        <form id="restore-form" class="wallet-form">
          <label for="restore-phrase">Recovery phrase</label>
          <textarea id="restore-phrase" name="phrase" rows="4" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Enter your words separated by spaces" required></textarea>
          <label for="restore-password">Create a local wallet password</label>
          <input id="restore-password" name="password" type="password" minlength="12" autocomplete="new-password" placeholder="At least 12 characters" required />
          <label for="restore-confirm-password">Confirm password</label>
          <input id="restore-confirm-password" name="confirm-password" type="password" minlength="12" autocomplete="new-password" placeholder="Repeat your password" required />
          <p class="muted-note">Your recovery phrase is processed in this browser. It is not uploaded to a server.</p>
          <button class="primary active" type="submit">Validate and encrypt wallet <span>↗</span></button>
          <p id="busy-note" class="muted-note">No wallet will be saved until validation succeeds.</p><span id="busy-indicator" class="busy-indicator"></span>
        </form>
        <button class="text-button" id="cancel-restore">Back</button>
      </section>`;
  } else if (view === 'locked') {
    content = `
      <section class="form-panel compact-panel">
        <div class="eyebrow"><span class="eyebrow-line"></span> WALLET LOCKED</div>
        <h1>Welcome<br /><span>back.</span></h1>
        <p class="intro">An encrypted wallet is saved in this browser. Enter its password to unlock and derive the public receiving addresses.</p>
        ${error}
        <form id="unlock-form" class="wallet-form">
          <label for="unlock-password">Wallet password</label>
          <input id="unlock-password" name="password" type="password" autocomplete="current-password" required />
          <button class="primary active" type="submit">Unlock wallet <span>↗</span></button>
          <p id="busy-note" class="muted-note">The encrypted recovery phrase remains in local browser storage.</p><span id="busy-indicator" class="busy-indicator"></span>
        </form>
        <button class="text-button" id="show-restore">Restore a different wallet instead</button>
      </section>`;
  } else {
    const addressRows = addresses.map((address) => `
      <article class="address-row">
        <div class="coin-icon">${address.ticker.slice(0, 1)}</div>
        <div class="address-info"><strong>${escapeHtml(address.label)}</strong><span>${escapeHtml(address.ticker)} · receiving address</span><code>${escapeHtml(address.value)}</code></div>
        <button class="copy-button" data-copy="${escapeHtml(address.value)}" aria-label="Copy ${escapeHtml(address.label)} address">Copy</button>
      </article>`).join('');
    content = `
      <section class="hero ready-hero">
        <div class="eyebrow"><span class="eyebrow-line"></span> WALLET CREATED</div>
        <h1>Your wallet<br /><span>is ready.</span></h1>
        <p class="intro">The recovery phrase was validated, encrypted, and saved locally. These addresses were derived by Wallet Core; no balances have been requested or simulated.</p>
        <div class="success-banner"><span class="success-check">✓</span><div><strong>Encrypted local vault saved</strong><span>Your recovery phrase is not stored in plaintext.</span></div></div>
      </section>
      <section class="address-panel">
        <div class="section-heading"><div><span class="eyebrow">RECEIVING ADDRESSES</span><h2>Your first addresses</h2></div><span class="tag tag-green">DERIVED LOCALLY</span></div>
        ${addressRows}
        <p class="muted-note">Address derivation for this first milestone shows Ethereum and Bitcoin only. It does not mean network balances or transactions are connected.</p>
        <div class="ready-actions"><button class="secondary" id="lock-wallet">Lock wallet</button><button class="danger-button" id="remove-wallet">Remove encrypted copy</button></div>
      </section>
      <div class="warning-box bottom-warning"><strong>Still a development build.</strong> Do not deposit real funds. Wallet creation and restore need automated test vectors, browser/device testing, and independent security review before production use.</div>`;
  }

  app.innerHTML = `<main class="shell">${header}<div class="content-area">${content}</div>${footer}</main>`;
  bindEvents();
}

function bindEvents(): void {
  document.querySelector<HTMLButtonElement>('#create-wallet')?.addEventListener('click', async () => {
    setBusy(true, 'Initializing cryptographic engine and generating a new recovery phrase…');
    const button = document.querySelector<HTMLButtonElement>('#create-wallet');
    if (button) button.disabled = true;
    try {
      const core = await initializeWalletCore();
      const wallet = core.HDWallet.create(128, '');
      try {
        const phrase = wallet.mnemonic();
        if (typeof phrase !== 'string' || phrase.trim().split(/\s+/).length !== 12) {
          throw new Error('Wallet Core did not return a valid 12-word recovery phrase.');
        }
        pendingMnemonic = normalizeMnemonic(phrase);
      } finally {
        wallet.delete();
      }
      errorMessage = '';
      view = 'create-phrase';
      render();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Wallet creation failed. Please try again.');
      if (button) button.disabled = false;
      setBusy(false);
    }
  });

  document.querySelector<HTMLButtonElement>('#show-restore')?.addEventListener('click', () => {
    errorMessage = '';
    view = 'restore';
    render();
  });
  document.querySelector<HTMLButtonElement>('#cancel-create')?.addEventListener('click', () => {
    pendingMnemonic = null;
    errorMessage = '';
    view = 'welcome';
    render();
  });
  document.querySelector<HTMLButtonElement>('#cancel-restore')?.addEventListener('click', () => {
    errorMessage = '';
    view = getSavedVault() ? 'locked' : 'welcome';
    render();
  });

  document.querySelector<HTMLFormElement>('#backup-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const typedPhrase = normalizeMnemonic(String(data.get('phrase-confirm') ?? ''));
    const password = String(data.get('password') ?? '');
    const confirmation = String(data.get('confirm-password') ?? '');
    if (!document.querySelector<HTMLInputElement>('#backup-ack')?.checked) {
      setError('Confirm that you have written down the recovery phrase before continuing.');
      return;
    }
    if (!pendingMnemonic || typedPhrase !== pendingMnemonic) {
      setError('The recovery phrase does not match. Check every word and its order.');
      return;
    }
    if (password.length < 12) {
      setError('Use a wallet password with at least 12 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }

    setError('');
    setBusy(true, 'Deriving addresses and encrypting your recovery phrase locally…');
    try {
      const core = await initializeWalletCore();
      const derived = deriveAddresses(core, pendingMnemonic);
      const encrypted = await encryptMnemonic(pendingMnemonic, password);
      saveVault(encrypted);
      addresses = derived;
      pendingMnemonic = null;
      view = 'ready';
      errorMessage = '';
      render();
    } catch (error) {
      setBusy(false);
      setError(error instanceof Error ? error.message : 'Could not create the encrypted wallet.');
    }
  });

  document.querySelector<HTMLFormElement>('#restore-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const phrase = normalizeMnemonic(String(data.get('phrase') ?? ''));
    const password = String(data.get('password') ?? '');
    const confirmation = String(data.get('confirm-password') ?? '');
    const wordCount = phrase ? phrase.split(' ').length : 0;
    if (![12, 15, 18, 21, 24].includes(wordCount)) {
      setError('Enter a BIP-39 recovery phrase containing 12, 15, 18, 21, or 24 words.');
      return;
    }
    if (password.length < 12) {
      setError('Use a wallet password with at least 12 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }

    setError('');
    setBusy(true, 'Validating the recovery phrase, deriving addresses, and encrypting locally…');
    try {
      const core = await initializeWalletCore();
      const derived = deriveAddresses(core, phrase);
      const encrypted = await encryptMnemonic(phrase, password);
      saveVault(encrypted);
      addresses = derived;
      view = 'ready';
      errorMessage = '';
      render();
    } catch {
      setBusy(false);
      setError('Could not restore this phrase. Check its spelling, word order, and checksum, then try again.');
    }
  });

  document.querySelector<HTMLFormElement>('#unlock-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const password = String(data.get('password') ?? '');
    setError('');
    setBusy(true, 'Unlocking encrypted vault and deriving public addresses…');
    try {
      const vault = getSavedVault();
      if (!vault) throw new Error('No encrypted wallet was found in this browser.');
      const phrase = await decryptMnemonic(vault, password);
      const core = await initializeWalletCore();
      addresses = deriveAddresses(core, phrase);
      view = 'ready';
      errorMessage = '';
      render();
    } catch (error) {
      setBusy(false);
      setError(error instanceof Error && error.message.startsWith('The encrypted wallet data')
        ? error.message
        : 'Could not unlock this wallet. Check the password or restore using your recovery phrase.');
    }
  });

  document.querySelector<HTMLButtonElement>('#lock-wallet')?.addEventListener('click', () => {
    addresses = [];
    errorMessage = '';
    view = 'locked';
    render();
  });
  document.querySelector<HTMLButtonElement>('#remove-wallet')?.addEventListener('click', () => {
    const confirmed = window.confirm('Remove the encrypted wallet from this browser? Do this only after safely backing up your recovery phrase. This cannot be undone from this browser.');
    if (!confirmed) return;
    removeSavedVault();
    addresses = [];
    pendingMnemonic = null;
    errorMessage = '';
    view = 'welcome';
    render();
  });

  document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      const value = button.dataset.copy ?? '';
      try {
        await navigator.clipboard.writeText(value);
        button.textContent = 'Copied';
        window.setTimeout(() => { button.textContent = 'Copy'; }, 1400);
      } catch {
        button.textContent = 'Copy unavailable';
        window.setTimeout(() => { button.textContent = 'Copy'; }, 1600);
      }
    });
  });
}

try {
  view = getSavedVault() ? 'locked' : 'welcome';
} catch (error) {
  view = 'welcome';
  errorMessage = error instanceof Error ? error.message : 'Could not read the saved wallet data.';
}
render();
