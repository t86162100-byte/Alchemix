import { useEffect, useState } from 'react';
import { Activity, ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, Bell, ChevronDown, CircleHelp, Eye, EyeOff, Globe2, Home, LockKeyhole, Search, Settings2, ShieldCheck, Sparkles, TrendingUp, Wallet, X } from 'lucide-react';
import { createWalletDraft, importWalletDraft, unlockWallet } from './core/wallet/walletService';
import { readKeystore, writeKeystore } from './core/wallet/secureStore';

type Tab = 'Overview' | 'Market' | 'Activity' | 'Wallet' | 'Swap' | 'Explore';
type Modal = 'wallet' | 'create' | 'import' | 'unlock' | 'help' | null;
const navItems: Array<{name: Tab; label: string; icon: typeof Home}> = [
  { name: 'Overview', label: 'Overview', icon: Home },
  { name: 'Market', label: 'Market', icon: TrendingUp },
  { name: 'Activity', label: 'Activity', icon: Activity },
  { name: 'Swap', label: 'Swap', icon: ArrowLeftRight },
  { name: 'Explore', label: 'Explore', icon: Globe2 },
];
const shortAddress = (value: string) => value ? value.slice(0, 6) + '…' + value.slice(-4) : '';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [mobileNav, setMobileNav] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [address, setAddress] = useState('');
  const [keystoreExists, setKeystoreExists] = useState(false);
  const [password, setPassword] = useState('');
  const [phrase, setPhrase] = useState('');
  const [importPhrase, setImportPhrase] = useState('');
  const [showPhrase, setShowPhrase] = useState(false);
  const [confirmedBackup, setConfirmedBackup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [totalValueVisible, setTotalValueVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;
    readKeystore().then(value => { if (!cancelled) setKeystoreExists(Boolean(value)); })
      .catch(() => { if (!cancelled) setNotice('Secure browser storage is unavailable. Wallet setup cannot continue until storage is available.'); });
    return () => { cancelled = true; };
  }, []);

  const closeModal = () => {
    setModal(null); setError(''); setPassword(''); setPhrase(''); setImportPhrase('');
    setShowPhrase(false); setConfirmedBackup(false);
  };
  const startCreate = async () => {
    setBusy(true); setError('');
    try {
      const draft = await createWalletDraft();
      setPhrase(draft.phrase);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create a wallet on this device.');
    } finally { setBusy(false); }
  };
  const saveCreatedWallet = async () => {
    if (password.length < 8) { setError('Use a password with at least 8 characters.'); return; }
    if (!confirmedBackup) { setError('Confirm that you have safely written down the recovery phrase first.'); return; }
    setBusy(true); setError('');
    try {
      const draft = importWalletDraft(phrase);
      const encrypted = await draft.wallet.encrypt(password);
      await writeKeystore(encrypted);
      setAddress(draft.address); setKeystoreExists(true); closeModal();
      setNotice('Wallet encrypted and saved on this device.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not securely save the wallet.');
    } finally { setBusy(false); }
  };
  const saveImportedWallet = async () => {
    if (password.length < 8) { setError('Use a password with at least 8 characters.'); return; }
    setBusy(true); setError('');
    try {
      const draft = importWalletDraft(importPhrase);
      const encrypted = await draft.wallet.encrypt(password);
      await writeKeystore(encrypted);
      setAddress(draft.address); setKeystoreExists(true); closeModal();
      setNotice('Wallet imported, encrypted and saved on this device.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not import this recovery phrase.');
    } finally { setBusy(false); }
  };
  const unlockSavedWallet = async () => {
    if (!password) { setError('Enter your wallet password.'); return; }
    setBusy(true); setError('');
    try {
      const encrypted = await readKeystore();
      if (!encrypted) throw new Error('No saved wallet was found in this browser.');
      const wallet = await unlockWallet(encrypted, password);
      setAddress(wallet.address); closeModal(); setNotice('Wallet unlocked for this session.');
    } catch {
      setError('Incorrect password or the saved wallet could not be opened.');
    } finally { setBusy(false); }
  };

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Sparkles size={21} strokeWidth={2.4}/></div><span>ferra<span className="brand-light">wallet</span></span><button className="mobile-close icon-button" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={19}/></button></div>
      <div className="workspace-label">WALLET</div>
      <nav className="main-nav">{navItems.map(item => <button key={item.name} className={`nav-item ${activeTab === item.name ? 'active' : ''}`} onClick={() => { setActiveTab(item.name); setMobileNav(false); if (item.name === 'Swap' || item.name === 'Explore') setNotice('This feature is not enabled in the clean wallet foundation yet.'); }}><item.icon size={19}/><span>{item.label}</span>{item.name === 'Swap' && <span className="soon-tag">SOON</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="security-card"><div className="security-icon"><ShieldCheck size={19}/></div><div><strong>Your keys, your control</strong><p>Encrypted wallet data stays in this browser.</p></div></div><button className="nav-item" onClick={() => setModal('help')}><CircleHelp size={19}/><span>Help & security</span></button><button className="nav-item" onClick={() => setNotice('Settings are not part of this foundation phase.')}><Settings2 size={19}/><span>Settings</span></button><div className="profile-row"><div className="profile-avatar">F</div><div className="profile-info"><strong>Ferra Wallet</strong><span>Self-custody foundation</span></div><button className="icon-button" onClick={() => setModal('wallet')} aria-label="Wallet options"><ChevronDown size={17}/></button></div></div>
    </aside>
    {mobileNav && <button className="mobile-overlay" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
    <main className="main-content">
      {activeTab === 'Overview' && <header className="sire-home-header"><button type="button" className="sire-home-icon sire-home-profile-button" aria-label="Wallet profile" onClick={() => setModal('wallet')}><Wallet size={22}/></button><div className="sire-home-header-actions"><button type="button" className="sire-home-icon" aria-label="Search" onClick={() => setNotice('Search will be added in a later phase.')}><Search size={21}/></button><button type="button" className="sire-home-icon" aria-label="Notifications" onClick={() => setNotice('You’re all caught up.')}><Bell size={21}/></button><button type="button" className="sire-home-icon" aria-label="Help" onClick={() => setModal('help')}><CircleHelp size={22}/></button></div></header>}
      {activeTab !== 'Overview' && <div className="home-wallet-controls"><div className="breadcrumb">Ferra Wallet <span>/</span> <strong>{activeTab}</strong></div><div className="topbar-actions">{address ? <button className="connect-button connected" onClick={() => setNotice('Wallet is unlocked in this session: ' + shortAddress(address))}><span className="connected-dot"/>{shortAddress(address)}<ChevronDown size={15}/></button> : <button className="connect-button" onClick={() => setModal('wallet')}><Wallet size={16}/>{keystoreExists ? 'Unlock wallet' : 'Create / import'}</button>}</div></div>}
      <div className={`page-wrap ${activeTab === 'Overview' ? 'overview-page-wrap' : ''}`}>
        {activeTab === 'Market' ? <section className="panel activity-panel"><div className="panel-heading"><div><h2>Market</h2><p>Market data will be connected in a separate, verified phase.</p></div><span className="market-placeholder-tag">PLANNED</span></div><div className="market-empty">No external market feeds are connected in this clean foundation build.</div></section> : activeTab === 'Activity' ? <section className="panel activity-panel activity-page"><div className="panel-heading"><div><h2>History</h2><p>Wallet activity</p></div><span className="market-placeholder-tag">ACTIVITY</span></div><div className="market-empty">Transaction history is not connected yet.</div></section> : activeTab === 'Wallet' ? <section className="panel activity-panel"><div className="panel-heading"><div><h2>Your wallet</h2><p>Manage your local self-custody wallet.</p></div></div><p className="modal-description">{address ? address : 'No wallet is currently unlocked.'}</p><button className="primary-button" onClick={() => setModal('wallet')}>{address ? 'Wallet options' : keystoreExists ? 'Unlock wallet' : 'Create or import wallet'} <ArrowRight size={16}/></button></section> : <>
          <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> YOUR WEB3 HOME</div><h1>Your crypto, clearly.</h1><p className="page-subtitle">One calm place to see and manage your digital assets.</p></div><button className="refresh-button" onClick={() => address ? setNotice('Balance lookup is not enabled yet; no balance is being estimated.') : setModal('wallet')}><span>{address ? 'Refresh' : 'Get started'}</span><ArrowUpRight size={15}/></button></div>
          <section className="sire-home-value-card" aria-label="Total account value"><div className="sire-home-value-main"><div className="sire-home-value-copy"><div className="sire-home-value-card-top"><span>NATIVE BALANCE</span><button type="button" className="sire-home-value-eye" aria-label={totalValueVisible ? 'Hide balance' : 'Show balance'} onClick={() => setTotalValueVisible(value => !value)}>{totalValueVisible ? <Eye size={17}/> : <EyeOff size={17}/>}</button></div><div className="sire-home-value-amount">{totalValueVisible ? '—' : '••••••'}</div><div className="page-subtitle">{address ? shortAddress(address) : 'Create or unlock a wallet to get started'}</div></div><div className="sire-home-value-chart" aria-hidden="true"><svg viewBox="0 0 320 100" preserveAspectRatio="none"><defs><linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".18"/><stop offset="100%" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs><path d="M0 78 C35 75,45 68,72 71 S110 62,132 66 S165 48,188 53 S220 39,242 45 S278 25,320 31 L320 100 L0 100 Z" fill="url(#balanceGradient)"/><path d="M0 78 C35 75,45 68,72 71 S110 62,132 66 S165 48,188 53 S220 39,242 45 S278 25,320 31" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></div></div><button type="button" className="sire-home-value-add-funds" onClick={() => setModal('wallet')}>{address ? 'Wallet options' : 'Get started'}</button></section>
          <section className="network-marquee" aria-label="Supported blockchain networks"><div className="network-marquee-track"><div className="network-marquee-group">{[['Ethereum','ETH'],['BNB Chain','BNB'],['Base','ETH'],['Polygon','POL'],['Arbitrum','ETH'],['Optimism','ETH']].map(([name,symbol]) => <div className="network-marquee-pill" key={name}><span className="network-marquee-logo"><span>{symbol}</span></span><span>{name}</span></div>)}</div></div></section>
          <nav className="wallet-quick-actions" aria-label="Wallet actions"><button type="button" className="wallet-quick-action" onClick={() => setNotice('Sending is disabled until transaction review and signing are implemented.')}><span className="wallet-quick-icon"><ArrowUpRight size={20}/></span><span>Send</span></button><button type="button" className="wallet-quick-action" onClick={() => setNotice(address ? 'Your public address: ' + address : 'Create or unlock a wallet first.')}><span className="wallet-quick-icon"><ArrowDownLeft size={20}/></span><span>Receive</span></button><button type="button" className="wallet-quick-action" onClick={() => setActiveTab('Activity')}><span className="wallet-quick-icon"><Activity size={20}/></span><span>History</span></button></nav>
          <section className="panel activity-panel"><div className="panel-heading"><div><h2>Quick actions</h2><p>Common wallet tasks, made simple</p></div></div><div className="quick-actions-grid"><button className="quick-action" onClick={() => setNotice('Transaction signing is intentionally not enabled yet.')}><span className="quick-icon send"><ArrowUpRight size={19}/></span><span><strong>Send</strong><small>Transfer crypto</small></span><ArrowRight size={15} className="quick-arrow"/></button><button className="quick-action" onClick={() => setNotice(address ? 'Public address: ' + address : 'Create or unlock a wallet first.')}><span className="quick-icon receive"><ArrowDownLeft size={19}/></span><span><strong>Receive</strong><small>Share your address</small></span><ArrowUpRight size={15} className="quick-arrow"/></button><button className="quick-action" onClick={() => setNotice('Swaps are not implemented in this foundation build.')}><span className="quick-icon swap"><ArrowLeftRight size={19}/></span><span><strong>Swap tokens</strong><small>Coming soon</small></span><span className="soon-tag">SOON</span></button><button className="quick-action" onClick={() => setNotice('Network selection will be added after wallet core verification.')}><span className="quick-icon network"><Globe2 size={19}/></span><span><strong>Change network</strong><small>Explore supported chains</small></span><ArrowUpRight size={15} className="quick-arrow"/></button></div><div className="quick-note"><LockKeyhole size={15}/><span>Transaction features stay disabled until their safety checks are implemented.</span></div></section>
          <section className="panel activity-panel"><div className="panel-heading"><div><h2>Recent activity</h2><p>Your wallet transactions</p></div><button className="panel-action" onClick={() => setActiveTab('Activity')}>View all <ArrowUpRight size={14}/></button></div><div className="activity-empty"><div className="activity-empty-icon"><Activity size={20}/></div><div><strong>No activity yet</strong><p>Transaction history will appear after verified transaction support is added.</p></div></div></section>
        </>}
        <footer className="footer"><div><span className="footer-logo"><Sparkles size={14}/> ferra wallet</span><span>Built for clarity. Designed for you.</span></div><div className="footer-right"><span><span className="status-dot"/> Wallet foundation</span><button onClick={() => setModal('help')}>Security first <ShieldCheck size={13}/></button></div></footer>
      </div>
    </main>
    <nav className="bottom-navigation" aria-label="Main navigation"><button type="button" className={activeTab === 'Overview' ? 'active' : ''} onClick={() => setActiveTab('Overview')}><Home size={20}/><span>Home</span></button><button type="button" className={activeTab === 'Market' ? 'active' : ''} onClick={() => setActiveTab('Market')}><TrendingUp size={20}/><span>Market</span></button><button type="button" className={activeTab === 'Activity' ? 'active' : ''} onClick={() => setActiveTab('Activity')}><Activity size={20}/><span>History</span></button><button type="button" onClick={() => setModal('wallet')}><Wallet size={20}/><span>Wallet</span></button></nav>
    {notice && <div className="toast" role="status"><span className="toast-dot"/><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss notification"><X size={16}/></button></div>}
    {modal && <div className="modal-backdrop" onClick={closeModal}><section className="modal-card" onClick={event => event.stopPropagation()}>
      <div className="modal-head"><div><span className="modal-eyebrow">FERRA WALLET</span><h2>{modal === 'wallet' ? 'Your wallet' : modal === 'create' ? 'Create a wallet' : modal === 'import' ? 'Import a wallet' : modal === 'unlock' ? 'Unlock your wallet' : 'Help & security'}</h2></div><button className="icon-button" onClick={closeModal} aria-label="Close dialog"><X size={19}/></button></div>
      {modal === 'wallet' && <><p className="modal-description">Create a new self-custody wallet or import an existing recovery phrase. Wallet data is encrypted before it is saved in this browser.</p><div className="wallet-choice-grid"><button type="button" className="wallet-choice" onClick={() => { setError(''); setPhrase(''); setPassword(''); setModal('create'); void startCreate(); }}><span className="wallet-choice-icon"><Sparkles size={19}/></span><strong>Create new wallet</strong><small>Generate a recovery phrase</small></button><button type="button" className="wallet-choice" onClick={() => { setError(''); setImportPhrase(''); setPassword(''); setModal('import'); }}><span className="wallet-choice-icon"><ArrowDownLeft size={19}/></span><strong>Import wallet</strong><small>Use an existing recovery phrase</small></button></div>{keystoreExists && <button className="primary-button full-button" onClick={() => { setError(''); setPassword(''); setModal('unlock'); }}>Unlock saved wallet</button>}<div className="form-warning"><LockKeyhole size={16}/><span>Never share your recovery phrase. Ferra cannot recover it if you lose it.</span></div></>}
      {modal === 'create' && <><p className="modal-description">Your recovery phrase is generated locally. Write it down and store it offline before securing the wallet.</p>{busy && !phrase ? <p className="network-loading">Generating wallet locally…</p> : phrase && <><div className="wallet-recovery-phrase">{phrase.split(' ').map((word,index) => <span key={index}><small>{index+1}</small>{showPhrase ? word : '••••'}</span>)}</div><button className="text-button" onClick={() => setShowPhrase(value => !value)}>{showPhrase ? 'Hide recovery phrase' : 'Reveal recovery phrase'}</button><label className="form-label"><input type="checkbox" checked={confirmedBackup} onChange={event => setConfirmedBackup(event.target.checked)}/> I have written down my recovery phrase and stored it safely.</label><label className="form-label">Encryption password (8+ characters)</label><input className="form-input" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Choose a strong password"/><button className="primary-button full-button" disabled={busy || !showPhrase} onClick={() => void saveCreatedWallet()}>{busy ? 'Securing wallet…' : 'Secure wallet and continue'} <ArrowRight size={16}/></button></>}{error && <p className="wallet-error" role="alert">{error}</p>}</>}
      {modal === 'import' && <><p className="modal-description">Import a valid 12- or 24-word recovery phrase. The phrase is processed locally and is never sent to a server.</p><label className="form-label">Recovery phrase</label><textarea className="form-input wallet-phrase-input" rows={3} autoComplete="off" spellCheck={false} value={importPhrase} onChange={event => setImportPhrase(event.target.value)} placeholder="Enter recovery phrase separated by spaces"/><label className="form-label">Encryption password (8+ characters)</label><input className="form-input" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Choose a strong password"/><button className="primary-button full-button" disabled={busy} onClick={() => void saveImportedWallet()}>{busy ? 'Importing wallet…' : 'Import and secure wallet'} <ArrowRight size={16}/></button>{error && <p className="wallet-error" role="alert">{error}</p>}</>}
      {modal === 'unlock' && <><p className="modal-description">Enter the password used to encrypt the wallet saved in this browser.</p><label className="form-label">Wallet password</label><input className="form-input" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Wallet password"/><button className="primary-button full-button" disabled={busy} onClick={() => void unlockSavedWallet()}>{busy ? 'Unlocking…' : 'Unlock wallet'} <ArrowRight size={16}/></button>{error && <p className="wallet-error" role="alert">{error}</p>}</>}
      {modal === 'help' && <><p className="modal-description">Ferra is being rebuilt in phases. Wallet creation and local encrypted storage are implemented first; network and transaction features remain disabled until verified.</p><div className="security-list"><div><ShieldCheck size={18}/><span><strong>Keep your recovery phrase private</strong><small>Anyone with it can control your funds. Store it offline and never share it.</small></span></div><div><LockKeyhole size={18}/><span><strong>Encrypted local storage</strong><small>The browser stores an encrypted keystore, not the plaintext recovery phrase.</small></span></div><div><Globe2 size={18}/><span><strong>Transactions are not enabled yet</strong><small>Send, swap and network switching remain unavailable until their safety checks are implemented.</small></span></div></div><button className="primary-button full-button" onClick={closeModal}>Got it</button></>}
    </section></div>}
  </div>;
}
