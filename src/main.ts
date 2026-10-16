import './style.css';

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
      <div class="actions"><button class="primary" id="create-wallet" disabled title="Wallet creation will be enabled after local key storage and recovery flows are implemented and tested">Create a wallet <span>↗</span></button><span class="status-note">Wallet setup is not enabled yet</span></div>
    </section>
    <section class="grid" aria-label="Project status">
      <article class="card core-card"><div class="card-head"><span class="icon">⌘</span><span class="tag tag-green">SOURCE PINNED</span></div><h2>Wallet Core</h2><p>Official Trust Wallet Core source is pinned as a Git submodule. The web-compatible integration will be evaluated before use.</p><div class="meta"><span>Upstream revision</span><code>adf80f8bac98</code></div></article>
      <article class="card"><div class="card-head"><span class="icon">⌁</span><span class="tag">IN PROGRESS</span></div><h2>Local-first security</h2><p>Recovery material and private keys must remain on the user's device. No seed phrase is sent to a server.</p><div class="meta"><span>Key storage</span><strong>Not implemented</strong></div></article>
      <article class="card"><div class="card-head"><span class="icon">⇄</span><span class="tag">LOCKED</span></div><h2>Transactions</h2><p>Sending remains disabled until chain-specific serialization, signing, broadcast, and failure paths pass tests.</p><div class="meta"><span>Send status</span><strong>Disabled</strong></div></article>
    </section>
    <footer><span>TRADINGVIEW X <span class="footer-sep">/</span> WALLET FOUNDATION</span><span>Self-custody first · No simulated balances</span></footer>
  </main>
`;
