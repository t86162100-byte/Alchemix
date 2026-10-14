import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, Bell, ChevronDown, CircleHelp, Copy, Eye, EyeOff, Home, LayoutGrid, LockKeyhole, Menu, QrCode, RefreshCw, Search, ShieldCheck, Sparkles, Wallet as WalletIcon, X, Zap } from 'lucide-react';
import { HDNodeWallet, Wallet as EthersWallet } from 'ethers';
import { deleteKeystore, readKeystore, writeKeystore } from './core/wallet/secureStore';
import { createWalletDraft, importWalletDraft, unlockWallet, type WalletDraft } from './core/wallet/walletService';
import './ferra.css';

type ActiveWallet = EthersWallet | HDNodeWallet;
type ModalStep = 'choose' | 'phrase' | 'verify' | 'password' | 'import' | 'unlock';
const navigation = [
  { label: 'Overview', icon: Home },
  { label: 'Markets', icon: LayoutGrid, soon: true },
  { label: 'Portfolio', icon: WalletIcon, soon: true },
  { label: 'Activity', icon: Activity, soon: true },
];
const phrasePositions = [2, 7, 10];

function shortAddress(address: string) {
  return address ? address.slice(0, 6) + '…' + address.slice(-4) : '';
}
function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export default function App() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [wallet, setWallet] = useState<ActiveWallet | null>(null);
  const [storedKeystore, setStoredKeystore] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<ModalStep>('choose');
  const [draft, setDraft] = useState<WalletDraft | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [importPhrase, setImportPhrase] = useState('');
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [hideBalance, setHideBalance] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    readKeystore().then((value) => {
      if (cancelled) return;
      setStoredKeystore(value);
      if (value) {
        setStep('unlock');
        setModalOpen(true);
      }
    }).catch(() => {
      if (!cancelled) setError('Secure wallet storage is unavailable in this browser.');
    });
    return () => { cancelled = true; };
  }, []);

  const openSetup = (next: ModalStep = 'choose') => {
    setError('');
    setNotice('');
    setStep(next);
    setModalOpen(true);
  };
  const closeSetup = () => {
    if (busy) return;
    setModalOpen(false);
    setDraft(null);
    setPassword('');
    setConfirmPassword('');
    setImportPhrase('');
    setAnswers({});
    setError('');
  };
  const beginCreate = async () => {
    setBusy(true); setError('');
    try {
      const nextDraft = await createWalletDraft();
      setDraft(nextDraft);
      setStep('phrase');
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  };
  const checkPhrase = () => {
    if (!draft) return;
    const words = draft.phrase.trim().split(/\s+/);
    const valid = phrasePositions.every((position) => (answers[position] || '').trim().toLowerCase() === words[position - 1]?.toLowerCase());
    if (!valid) { setError('One or more words do not match. Check your recovery phrase and try again.'); return; }
    setError('');
    setStep('password');
  };
  const finishCreate = async () => {
    if (!draft) return;
    if (password.length < 10) { setError('Use a password with at least 10 characters.'); return; }
    if (password !== confirmPassword) { setError('The passwords do not match.'); return; }
    setBusy(true); setError('');
    try {
      const encrypted = await draft.wallet.encrypt(password);
      await writeKeystore(encrypted);
      setStoredKeystore(encrypted);
      setWallet(draft.wallet);
      setDraft(null); setPassword(''); setConfirmPassword(''); setAnswers({});
      setModalOpen(false);
      setNotice('Wallet created. Your recovery phrase is the only way to restore access if you forget your password.');
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  };
  const finishImport = async () => {
    if (password.length < 10) { setError('Use a password with at least 10 characters.'); return; }
    if (password !== confirmPassword) { setError('The passwords do not match.'); return; }
    setBusy(true); setError('');
    try {
      const imported = importWalletDraft(importPhrase);
      const encrypted = await imported.wallet.encrypt(password);
      await writeKeystore(encrypted);
      setStoredKeystore(encrypted); setWallet(imported.wallet);
      setModalOpen(false); setImportPhrase(''); setPassword(''); setConfirmPassword('');
      setNotice('Wallet imported and encrypted locally.');
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  };
  const finishUnlock = async () => {
    if (!storedKeystore) { setError('No encrypted wallet was found on this device.'); return; }
    setBusy(true); setError('');
    try {
      const unlocked = await unlockWallet(storedKeystore, password);
      setWallet(unlocked); setModalOpen(false); setPassword('');
      setNotice('Wallet unlocked.');
    } catch { setError('Could not unlock the wallet. Check your password.'); }
    finally { setBusy(false); }
  };
  const lockWallet = () => {
    setWallet(null); setPassword(''); setStep('unlock'); setModalOpen(true); setError('');
  };
  const copyAddress = async () => {
    if (!wallet) return;
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true); window.setTimeout(() => setCopied(false), 1600);
    } catch { setNotice('Clipboard access was blocked. You can select and copy the address manually.'); }
  };
  const visibleAddress = useMemo(() => wallet?.address ?? '', [wallet]);

  return (
    <div className="app-shell">
      <aside className={'sidebar ' + (mobileNav ? 'sidebar-open' : '')}>
        <div className="brand"><span className="brand-mark"><Sparkles size={19} /></span><span>ferra<span className="brand-light"> wallet</span></span></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="main-nav">
          {navigation.map(({ label, icon: Icon, soon }) => <button key={label} className={'nav-item ' + (activeTab === label ? 'active' : '')} onClick={() => { setActiveTab(label); setMobileNav(false); if (soon) setNotice(label + ' is planned for a later phase.'); }}><Icon size={17} /><span>{label}</span>{soon && <span className="soon-tag">SOON</span>}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="security-card"><div className="security-icon"><ShieldCheck size={18} /></div><div><strong>Self-custody first</strong><p>Your encrypted wallet stays on this device. Never share your recovery phrase.</p></div></div>
          <div className="profile-row"><div className="profile-avatar">F</div><div className="profile-info"><strong>{wallet ? 'Personal wallet' : 'Local wallet'}</strong><span>{wallet ? shortAddress(wallet.address) : 'Not connected'}</span></div>{wallet && <button className="icon-button" aria-label="Lock wallet" onClick={lockWallet}><LockKeyhole size={15} /></button>}</div>
        </div>
        <button className="mobile-close icon-button" aria-label="Close menu" onClick={() => setMobileNav(false)}><X size={18} /></button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Open menu" onClick={() => setMobileNav(true)}><Menu size={19} /></button>
          <div className="breadcrumb">Workspace <span>/</span> <strong>{activeTab}</strong></div>
          <div className="topbar-actions">
            <button className="network-picker" onClick={() => setNotice('Ethereum is the first supported ecosystem. Network reads and transfers will be enabled after the wallet foundation is reviewed.')}><span className="chain-dot" style={{background:'#7895ff'}} />Ethereum <ChevronDown size={13} /></button>
            <button className={'connect-button ' + (wallet ? 'connected' : '')} onClick={() => wallet ? setNotice('Wallet is unlocked and ready for the next build phase.') : openSetup()}>{wallet ? <><span className="connected-dot" />{shortAddress(wallet.address)}</> : <><WalletIcon size={14} /> Create wallet</>}</button>
            <button className="icon-button top-icon" aria-label="Help" onClick={() => setNotice('Ferra is being built in phases. No network or transaction feature is advertised until it is implemented and tested.')}><CircleHelp size={17} /></button>
          </div>
        </header>

        <div className="page-wrap">
          <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line" /> YOUR DIGITAL ASSETS</div><h1>Your wallet, clearly.</h1><p className="page-subtitle">A secure home for your crypto. You stay in control.</p></div><button className="refresh-button" onClick={() => setNotice(wallet ? 'Wallet status refreshed.' : 'Create or import a wallet to get started.')}><RefreshCw size={13} /> Refresh</button></div>

          {!wallet && <section className="connect-banner"><div className="banner-art"><div className="banner-orbit" /><div className="banner-orbit orbit-two" /><div className="banner-coin"><Sparkles size={28} /></div></div><div className="banner-copy"><div className="banner-kicker">WELCOME TO FERRA</div><h2>Your keys. Your crypto. Your choice.</h2><p>Create a new wallet or import an existing recovery phrase. Your wallet is encrypted on this device, and your recovery phrase is never sent to a server.</p><div className="banner-buttons"><button className="primary-button" onClick={() => openSetup()}><WalletIcon size={14} /> Get started <ArrowRight size={14} /></button><button className="text-button" onClick={() => openSetup('import')}>I already have a wallet <ArrowUpRight size={13} /></button></div></div><div className="banner-decoration">F<span>.</span></div></section>}

          <div className="stats-grid">
            <section className="stat-card balance-card"><div className="stat-top"><span>Total balance</span><button className="subtle-icon" aria-label={hideBalance ? 'Show balance' : 'Hide balance'} onClick={() => setHideBalance(!hideBalance)}>{hideBalance ? <EyeOff size={15} /> : <Eye size={15} />}</button></div><div className="balance-number">{wallet ? (hideBalance ? '••••••' : 'Balance unavailable') : '—'}</div><div className="stat-foot"><span className="neutral-pill"><span className="neutral-dot" /> {wallet ? 'Address created' : 'No wallet yet'}</span><span className="muted">USD valuation arrives in Stage 3</span></div><svg className="balance-sparkline" viewBox="0 0 180 44" fill="none" aria-hidden="true"><path d="M0 36 C18 30 24 35 39 23 S61 28 74 17 S95 25 110 14 S132 21 145 10 S165 16 180 3" stroke="currentColor" strokeWidth="2" /></svg></section>
            <section className="stat-card"><div className="stat-top"><span>Wallet status</span><span className="stat-icon purple"><ShieldCheck size={16} /></span></div><div className="stat-main">{wallet ? 'Unlocked' : storedKeystore ? 'Locked' : 'Not created'}</div><div className="stat-description"><span className="status-dot" style={{background: wallet ? '#74dfb9' : '#8e9ab4'}} />{wallet ? 'Local wallet active' : 'Create or import to begin'}</div><button className="card-link" onClick={() => wallet ? setNotice('Wallet is encrypted at rest in browser IndexedDB.') : openSetup()}>{wallet ? 'View security status' : 'Set up wallet'} <ArrowRight size={12} /></button></section>
            <section className="stat-card"><div className="stat-top"><span>Networks</span><span className="stat-icon green"><Zap size={16} /></span></div><div className="stat-main">1 planned</div><div className="stat-description">Ethereum first · test network next</div><button className="card-link" onClick={() => setNotice('Only the first ecosystem is planned at this stage; transaction features are not enabled yet.')}>View roadmap <ArrowRight size={12} /></button></section>
          </div>

          <div className="content-grid">
            <section className="panel assets-panel"><div className="panel-heading"><div><h2>Your assets</h2><p>On-chain balances will appear here once connectivity is implemented.</p></div><button className="panel-action" onClick={() => setNotice('Token discovery is scheduled for Stage 3.')}><Search size={12} /> Explore tokens</button></div><div className="asset-header"><span>ASSET</span><span>BALANCE / VALUE</span></div>{wallet ? <div className="empty-inline"><Activity size={15} /> Wallet address is ready. No live balances are being requested in this phase.</div> : <div className="empty-inline"><WalletIcon size={15} /> Create or import a wallet to get started.</div>}<div className="asset-footer"><span>Real balances only · no demo values</span><span>Stage 2 <ArrowRight size={10} /></span></div></section>
            <section className="panel quick-panel"><div className="panel-heading"><div><h2>Quick actions</h2><p>Wallet tools, added only when ready.</p></div><span className="quick-heading-icon"><Zap size={15} /></span></div><div className="quick-actions">
              <button className="quick-action" onClick={() => wallet ? setNotice('Receive addresses and QR codes are part of Stage 2.') : openSetup()}><span className="quick-icon receive"><ArrowDownLeft size={16} /></span><span><strong>Receive crypto</strong><small>Address & QR code · Stage 2</small></span><ArrowRight className="quick-arrow" size={14} /></button>
              <button className="quick-action" onClick={() => setNotice('Sending is disabled until fee estimation, transaction review, and testnet checks are complete.')}><span className="quick-icon send"><ArrowUpRight size={16} /></span><span><strong>Send crypto</strong><small>Secure transfer · Stage 4</small></span><ArrowRight className="quick-arrow" size={14} /></button>
              <button className="quick-action" onClick={() => setNotice('Swaps are planned for Stage 5 and are not enabled yet.')}><span className="quick-icon swap"><ArrowLeftRight size={16} /></span><span><strong>Swap tokens</strong><small>Swap routes · Stage 5</small></span><ArrowRight className="quick-arrow" size={14} /></button>
              <button className="quick-action" onClick={() => setNotice('Transaction history will use indexed provider data in Stage 2.')}><span className="quick-icon network"><Activity size={16} /></span><span><strong>Transaction history</strong><small>Activity tracking · Stage 2</small></span><ArrowRight className="quick-arrow" size={14} /></button>
            </div><div className="quick-note"><ShieldCheck size={13} /><span>Transaction signing and broadcasting remain disabled until they pass testnet and security checks.</span></div></section>
          </div>

          <section className="panel activity-panel"><div className="panel-heading"><div><h2>Recent activity</h2><p>Your confirmed transactions will appear here.</p></div><button className="panel-action" onClick={() => setActiveTab('Activity')}>View all <ArrowRight size={12} /></button></div><div className="empty-inline"><Activity size={15} /> No transactions to show yet.</div></section>
          <div className="footer-note"><span><ShieldCheck size={13} /> Self-custody by design</span><span>Ferra Wallet · Foundation phase</span></div>
        </div>
      </main>

      {notice && <div className="toast" role="status"><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice('')}><X size={14} /></button></div>}

      {modalOpen && <div className="ferra-modal-backdrop" role="presentation"><section className="ferra-modal" role="dialog" aria-modal="true" aria-labelledby="wallet-modal-title">
        <div className="ferra-modal-head"><div className="ferra-modal-icon"><LockKeyhole size={19} /></div><button className="icon-button" aria-label="Close dialog" disabled={busy} onClick={closeSetup}><X size={17} /></button></div>
        {step === 'choose' && <><div className="ferra-eyebrow">WALLET FOUNDATION · STAGE 1</div><h2 id="wallet-modal-title">Take control of your wallet</h2><p className="ferra-modal-copy">Create a new self-custodial wallet or import an existing recovery phrase. Your secret phrase stays in this browser session and is not uploaded.</p><button className="ferra-choice" onClick={beginCreate} disabled={busy}><span className="ferra-choice-icon"><Sparkles size={18} /></span><span><strong>Create a new wallet</strong><small>Generate a fresh recovery phrase</small></span><ArrowRight size={15} /></button><button className="ferra-choice" onClick={() => { setError(''); setStep('import'); }}><span className="ferra-choice-icon"><WalletIcon size={18} /></span><span><strong>Import existing wallet</strong><small>Restore with your recovery phrase</small></span><ArrowRight size={15} /></button><p className="ferra-security-note"><ShieldCheck size={14} /> Ferra will never ask you to send your phrase to support.</p></>}
        {step === 'phrase' && draft && <><div className="ferra-eyebrow">BACK UP YOUR WALLET</div><h2 id="wallet-modal-title">Write down your recovery phrase</h2><p className="ferra-modal-copy">Store these 12 words somewhere private and offline. Anyone with this phrase can control the wallet. Ferra cannot recover it for you.</p><div className="phrase-grid">{draft.phrase.split(' ').map((word, i) => <div className="phrase-word" key={i}><span>{i + 1}</span><strong>{word}</strong></div>)}</div><div className="ferra-warning"><ShieldCheck size={15} /><span>Never screenshot, email, or share this phrase. It will not be saved by Ferra in plaintext.</span></div><button className="primary-button ferra-full-button" onClick={() => { setAnswers({}); setError(''); setStep('verify'); }}>I've saved my phrase <ArrowRight size={14} /></button></>}
        {step === 'verify' && draft && <><div className="ferra-eyebrow">BACKUP CHECK</div><h2 id="wallet-modal-title">Verify your recovery phrase</h2><p className="ferra-modal-copy">Enter the requested words from the phrase you just saved.</p><div className="verify-grid">{phrasePositions.map((position) => <label key={position}>Word #{position}<input autoComplete="off" spellCheck={false} value={answers[position] || ''} onChange={(e) => setAnswers({ ...answers, [position]: e.target.value })} placeholder={'Enter word ' + position} /></label>)}</div><button className="primary-button ferra-full-button" onClick={checkPhrase}>Verify phrase <ArrowRight size={14} /></button></>}
        {step === 'password' && <><div className="ferra-eyebrow">ENCRYPT LOCAL STORAGE</div><h2 id="wallet-modal-title">Set a wallet password</h2><p className="ferra-modal-copy">This password encrypts the wallet file stored on this device. It is not your recovery phrase and cannot restore your wallet on its own.</p><label className="ferra-field">Password<input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 10 characters" /></label><label className="ferra-field">Confirm password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat password" /></label><button className="primary-button ferra-full-button" disabled={busy} onClick={finishCreate}>{busy ? 'Encrypting wallet…' : 'Encrypt and finish'} <ArrowRight size={14} /></button></>}
        {step === 'import' && <><div className="ferra-eyebrow">RESTORE WALLET</div><h2 id="wallet-modal-title">Import your recovery phrase</h2><p className="ferra-modal-copy">Enter your existing standard 12- or 24-word Ethereum-compatible recovery phrase. It is processed locally and never sent to a server.</p><label className="ferra-field">Recovery phrase<textarea rows={3} autoComplete="off" spellCheck={false} value={importPhrase} onChange={(e) => setImportPhrase(e.target.value)} placeholder="word1 word2 word3 …" /></label><label className="ferra-field">Create a local password<input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 10 characters" /></label><label className="ferra-field">Confirm password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat password" /></label><button className="primary-button ferra-full-button" disabled={busy} onClick={finishImport}>{busy ? 'Importing and encrypting…' : 'Import wallet'} <ArrowRight size={14} /></button><button className="ferra-back-button" onClick={() => { setError(''); setStep('choose'); }}>Back</button></>}
        {step === 'unlock' && <><div className="ferra-eyebrow">WELCOME BACK</div><h2 id="wallet-modal-title">Unlock your wallet</h2><p className="ferra-modal-copy">Your encrypted wallet was found in this browser. Enter your password to unlock it.</p><label className="ferra-field">Wallet password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void finishUnlock(); }} placeholder="Enter your password" /></label><button className="primary-button ferra-full-button" disabled={busy} onClick={finishUnlock}>{busy ? 'Unlocking…' : 'Unlock wallet'} <ArrowRight size={14} /></button><button className="ferra-back-button" onClick={() => { setStoredKeystore(null); setStep('choose'); setPassword(''); setError(''); }}>Use another wallet</button></>}
        {error && <p className="ferra-error" role="alert">{error}</p>}
        {busy && <p className="ferra-progress"><span className="spin"><RefreshCw size={13} /></span> Working locally in this browser…</p>}
        <div className="ferra-modal-foot"><span><LockKeyhole size={12} /> Encrypted locally</span><span>No server custody</span></div>
      </section></div>}
    </div>
  );
}
