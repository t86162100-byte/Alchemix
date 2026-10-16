import './style.css';
import { initializeWalletCore } from './wallet-core';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) throw new Error('App root element was not found');

app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <a class="brand" href="#" aria-label="Tradingview X home"><span class="brand-mark">X</span><span>Tradingview <strong>X</strong></span></a>
      <span class="environment"><span class="dot"></span> DEVELOPMENT BUILD</span>
    </header>
    <section class="hero">
      <div class="eyebrow"><span class="eyebrow-line"></span> YOUR KEYS. YOUR ASSETS.</div>
      <h1>One wallet.<br /><span>Every chain.</span></h1>
      <p class="intro">A clean foundation for a self-custodial multichain wallet, built around audited cryptographic components and explicit security boundaries.</p>
      <div class="actions">
        <button class="primary" id="create-wallet" disabled title="Wallet creation remains locked until local key storage and recovery flows are implemented and tested">Create a wallet <span>↗</span></button>
        <button class="secondary" id="initialize-core">Test crypto engine</button>
        <span class="status-note" id="core-status" role="status" aria-live="polite">Wallet setup is locked; crypto engine not tested in this browser yet.</span>
      </div>
    </section>
    <section class="grid" aria-label="Project status">
      <article class="card core-card"><div class="card-head"><span class="icon">⌘</span><span class="tag tag-green" id="core-tag">PACKAGE ADDED</span></div><h2>Wallet Core</h2><p>Official Trust Wallet Core WASM package is now included. Use the test to verify runtime initialization without creating a wallet or generating keys.</p><div class="meta"><span>Package version</span><code>4.8.4 beta WASM</code></div></article>
      <article class="card"><div class="card-head"><span class="icon">⌁</span><span class="tag">IN PROGRESS</span></div><h2>Local-first security</h2><p>Recovery material and private keys must remain on the user's device. No seed phrase is sent to a server.</p><div class="meta"><span>Key storage</span><strong>Not implemented</strong></div></article>
      <article class="card"><div class="card-head"><span class="icon">⇄</span><span class="tag">LOCKED</span></div><h2>Transactions</h2><p>Sending remains disabled until chain-specific serialization, signing, broadcast, and failure paths pass tests.</p><div class="meta"><span>Send status</span><strong>Disabled</strong></div></article>
    </section>
    <footer><span>TRADINGVIEW X <span class="footer-sep">/</span> WALLET FOUNDATION</span><span>Self-custody first · No simulated balances</span></footer>
  </main>
`;

const initializeButton = document.querySelector<HTMLButtonElement>('#initialize-core');
const status = document.querySelector<HTMLSpanElement>('#core-status');
const coreTag = document.querySelector<HTMLSpanElement>('#core-tag');

initializeButton?.addEventListener('click', async () => {
  if (!initializeButton || !status || !coreTag) return;
  initializeButton.disabled = true;
  initializeButton.textContent = 'Initializing…';
  status.textContent = 'Loading the Wallet Core WASM runtime. No wallet or keys are being created.';
  coreTag.textContent = 'INITIALIZING';
  coreTag.classList.remove('tag-green');

  try {
    const core = await initializeWalletCore();
    if (!core.CoinType.ethereum || !core.HDWallet) {
      throw new Error('Expected Ethereum coin metadata or HD wallet API is missing.');
    }
    coreTag.textContent = 'RUNTIME READY';
    coreTag.classList.add('tag-green');
    status.textContent = 'Wallet Core initialized successfully in this browser. No seed phrase or private key was created.';
    initializeButton.textContent = 'Engine ready';
  } catch (error) {
    coreTag.textContent = 'INITIALIZATION FAILED';
    status.textContent = error instanceof Error
      ? `Wallet Core could not initialize: ${error.message}`
      : 'Wallet Core could not initialize. Check browser console and deployment logs.';
    initializeButton.disabled = false;
    initializeButton.textContent = 'Retry crypto engine test';
  }
});
