import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, Bell, ChevronDown, CircleHelp, CircleUserRound, Copy, ExternalLink, Eye, EyeOff, Globe2, Home, LayoutGrid, LockKeyhole, Menu, MoreHorizontal, QrCode, RefreshCw, Search, Settings2, ShieldCheck, Sparkles, Wallet, X, Zap } from 'lucide-react';

type Chain = { id: number; name: string; symbol: string; label: string; rpc: string; explorer: string; color: string; icon?: string };
type EthereumProvider = { request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>; on?: (event: string, cb: (...args: unknown[]) => void) => void; removeListener?: (event: string, cb: (...args: unknown[]) => void) => void };
declare global { interface Window { ethereum?: EthereumProvider } }

const CHAINS: Chain[] = [
  { id: 1, name: 'Ethereum', symbol: 'ETH', label: 'Ethereum Mainnet', rpc: 'https://ethereum-rpc.publicnode.com', explorer: 'https://etherscan.io', color: '#7895ff', icon: 'ethereum' },
  { id: 56, name: 'BNB Chain', symbol: 'BNB', label: 'BNB Smart Chain', rpc: 'https://bsc-rpc.publicnode.com', explorer: 'https://bscscan.com', color: '#f0b90b', icon: 'bsc' },
  { id: 8453, name: 'Base', symbol: 'ETH', label: 'Base Mainnet', rpc: 'https://mainnet.base.org', explorer: 'https://basescan.org', color: '#4c7df0', icon: 'base' },
  { id: 137, name: 'Polygon', symbol: 'POL', label: 'Polygon PoS', rpc: 'https://polygon-bor-rpc.publicnode.com', explorer: 'https://polygonscan.com', color: '#9b7bf7', icon: 'polygon' },
  { id: 42161, name: 'Arbitrum', symbol: 'ETH', label: 'Arbitrum One', rpc: 'https://arb1.arbitrum.io/rpc', explorer: 'https://arbiscan.io', color: '#2d9cdb', icon: 'arbitrum' },
  { id: 10, name: 'Optimism', symbol: 'ETH', label: 'Optimism', rpc: 'https://mainnet.optimism.io', explorer: 'https://optimistic.etherscan.io', color: '#ff5364', icon: 'optimism' },
  { id: 33139, name: 'ApeChain', symbol: 'APE', label: 'ApeChain Mainnet', rpc: 'https://rpc.apechain.com', explorer: 'https://apescan.io', color: '#a98bff', icon: 'apechain' },
];
const shortAddress = (s: string) => s ? `${s.slice(0, 6)}…${s.slice(-4)}` : '';
const rpcCall = async (chain: Chain, method: string, params: unknown[] = []) => {
  const response = await fetch(chain.rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'RPC request failed');
  return data.result as string;
};
const formatBalance = (hex: string) => Number(BigInt(hex)) / 1e18;
const iconLetters: Record<string, string> = { ETH: 'Ξ', BNB: '◆', POL: '⬡' };
const chainLogoUrls = (item: Chain) => {
  // Use the maintained DeFiLlama chain-icon service at a crisp 512px size first.
  // Keep original Trust Wallet chain artwork and the legacy icon URL as fallbacks.
  const trustedAssets: Record<number, string> = {
    1: 'ethereum', 56: 'smartchain', 137: 'polygon', 42161: 'arbitrum', 10: 'optimism',
    43114: 'avalanchec', 100: 'xdai', 250: 'fantom', 42220: 'celo',
    1313161554: 'aurora', 25: 'cronos', 1284: 'moonbeam', 1285: 'moonriver',
    1666600000: 'harmony', 1088: 'metis', 40: 'telos', 8217: 'klaytn',
    122: 'fuse', 324: 'zksync', 59144: 'linea', 534352: 'scroll',
  };
  const candidates: string[] = [];
  const icon = item.icon?.trim();
  if (icon) candidates.push(`https://icons.llamao.fi/icons/chains/${encodeURIComponent(icon)}?w=512&h=512`);
  const folder = trustedAssets[item.id];
  if (folder) candidates.push(`https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${folder}/info/logo.png`);
  if (icon) candidates.push(`https://icons.llamao.fi/icons/chains/rsz_${encodeURIComponent(icon)}.jpg`);
  return [...new Set(candidates)];
};
const chainLogoUrl = (item: Chain) => chainLogoUrls(item)[0] || '';
const handleChainLogoError = (event: React.SyntheticEvent<HTMLImageElement>) => {
  const image = event.currentTarget;
  let candidates: string[] = [];
  try { candidates = JSON.parse(image.dataset.logoCandidates || '[]') as string[]; } catch { candidates = []; }
  const nextIndex = Number(image.dataset.logoIndex || '0') + 1;
  if (candidates[nextIndex]) {
    image.dataset.logoIndex = String(nextIndex);
    image.src = candidates[nextIndex];
  } else {
    image.remove();
  }
};

function App() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [bottomNavVisible, setBottomNavVisible] = useState(true);
  const [navRevealDirection, setNavRevealDirection] = useState<number | null>(null);

  const [chainId, setChainId] = useState(1);
  const [availableChains, setAvailableChains] = useState<Chain[]>(CHAINS);
  const [networkSearch, setNetworkSearch] = useState('');
  const [networkListLoading, setNetworkListLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);
  const [totalValueVisible, setTotalValueVisible] = useState(true);
  const [modal, setModal] = useState<'send' | 'receive' | 'network' | 'help' | null>(null);
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [notice, setNotice] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [activity, setActivity] = useState<{ hash: string; chain: Chain; time: string }[]>([]);

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout>;
    let touchStartX: number | null = null;
    const scheduleHide = () => {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        setBottomNavVisible(false);
        setNavRevealDirection(null);
      }, 10000);
    };
    const onTouchStart = (event: TouchEvent) => {
      touchStartX = event.touches[0]?.clientX ?? null;
      scheduleHide();
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (touchStartX === null) return;
      const delta = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
      touchStartX = null;
      if (Math.abs(delta) < 60) { scheduleHide(); return; }
      const direction = Math.sign(delta);
      if (!bottomNavVisible) {
        setBottomNavVisible(true);
        setNavRevealDirection(direction);
        scheduleHide();
      } else if (navRevealDirection !== null && direction === -navRevealDirection) {
        setBottomNavVisible(false);
        setNavRevealDirection(null);
        clearTimeout(hideTimer);
      } else {
        scheduleHide();
      }
    };
    const onActivity = () => scheduleHide();
    scheduleHide();
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    window.addEventListener('scroll', onActivity, { passive: true });
    return () => {
      clearTimeout(hideTimer);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('scroll', onActivity);
    };
  }, [bottomNavVisible, navRevealDirection]);

  useEffect(() => {
    let cancelled = false;
    setNetworkListLoading(true);
    fetch('https://chainid.network/chains.json')
      .then(response => { if (!response.ok) throw new Error('Could not load chain registry'); return response.json(); })
      .then((items: Array<{ chainId: number; name: string; title?: string; icon?: string; nativeCurrency?: { symbol?: string }; rpc?: string[]; explorers?: { url?: string }[]; network?: string }>) => {
        const curated = new Map(CHAINS.map(item => [item.id, item]));
        const discovered: Chain[] = items
          .filter(item => Number.isFinite(item.chainId) && item.chainId > 0 && item.network !== 'testnet')
          .map(item => {
            const known = curated.get(item.chainId);
            const rpc = (item.rpc || []).find(url => /^https:\/\//.test(url) && !/\$\{|\{[^}]+\}|YOUR_API_KEY|INFURA_API_KEY|ALCHEMY_API_KEY|<api[-_ ]?key>/i.test(url));
            const explorer = (item.explorers || []).find(entry => entry.url?.startsWith('https://'))?.url;
            if (known) return known;
            return {
              id: item.chainId,
              name: item.name || item.title || `Chain ${item.chainId}`,
              symbol: item.nativeCurrency?.symbol || 'ETH',
              label: item.title || item.name || `EVM network ${item.chainId}`,
              rpc: rpc || '',
              explorer: explorer || '',
              color: '#777777',
              icon: item.icon || undefined
            };
          })
          .filter(item => item.name && item.name.trim().length > 0)
          .sort((a, b) => a.name.localeCompare(b.name));
        const merged = discovered.map(item => curated.get(item.id) || item);
        if (!cancelled && merged.length > CHAINS.length) setAvailableChains(merged);
      })
      .catch(() => { /* Keep the built-in network list if the registry is unavailable. */ })
      .finally(() => { if (!cancelled) setNetworkListLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const marqueeChains = useMemo(() => {
    // Keep the home ticker intentionally short; the full 100+ chain directory stays in the picker.
    const featuredIds = [1, 56, 8453, 137, 42161, 10, 43114, 59144, 534352, 324, 250, 100];
    const featured = featuredIds.map(id => availableChains.find(item => item.id === id)).filter((item): item is Chain => Boolean(item));
    return featured.length ? featured : availableChains.slice(0, 12);
  }, [availableChains]);
  const chain = availableChains.find(c => c.id === chainId) ?? CHAINS[0];
  const visibleNetworkOptions = useMemo(() => {
    const query = networkSearch.trim().toLowerCase();
    return availableChains.filter(item => !query || item.name.toLowerCase().includes(query) || item.label.toLowerCase().includes(query) || item.symbol.toLowerCase().includes(query) || String(item.id).includes(query));
  }, [availableChains, networkSearch]);
  const popularNetworkOptions = useMemo(() => [...availableChains].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 8), [availableChains]);

  const refreshBalance = useCallback(async (wallet = address, selected = chain) => {
    if (!wallet) { setBalance(null); return; }
    setLoading(true);
    try {
      const raw = await rpcCall(selected, 'eth_getBalance', [wallet, 'latest']);
      setBalance(formatBalance(raw));
    } catch {
      setNotice('Could not fetch this network balance. Try refreshing or switching RPC networks.');
    } finally { setLoading(false); }
  }, [address, chain]);

 // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!window.ethereum) return;
    const onAccounts = (accounts: unknown) => setAddress(Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : '');
    const onChain = (id: unknown) => setChainId(typeof id === 'string' ? Number.parseInt(id, 16) : 1);
    window.ethereum.on?.('accountsChanged', onAccounts);
    window.ethereum.on?.('chainChanged', onChain);
    return () => { window.ethereum?.removeListener?.('accountsChanged', onAccounts); window.ethereum?.removeListener?.('chainChanged', onChain); };
  }, []);


    if (!window.ethereum) { setNotice('No compatible browser wallet detected. Install a wallet extension, then reload this page.'); return; }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
      const id = await window.ethereum.request({ method: 'eth_chainId' }) as string;
      setAddress(accounts[0] || '');
      setChainId(Number.parseInt(id, 16));
      setNotice(accounts[0] ? 'Wallet connected. Your keys remain with your wallet provider.' : '');
    } catch { setNotice('Wallet connection was cancelled or rejected.'); }
  };
  const disconnect = () => { setAddress(''); setBalance(null); setNotice('Disconnected from this page. To revoke site access, use your wallet settings.'); };
  const switchNetwork = async (target: Chain) => {
    if (!window.ethereum) { setNotice('Connect a compatible wallet first.'); return; }
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${target.id.toString(16)}` }] });
      setChainId(target.id); setModal(null); setNotice(`Network switched to ${target.name}.`);
    } catch (err) {
      const e = err as { code?: number };
      if (e.code === 4902) {
        if (!target.rpc || !target.rpc.startsWith('https://')) {
          setNotice(`${target.name} is listed, but no public RPC was found. Add a trusted RPC in your wallet to use this network.`);
          return;
        }
        try {
          await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: `0x${target.id.toString(16)}`, chainName: target.name, nativeCurrency: { name: target.symbol, symbol: target.symbol, decimals: 18 }, rpcUrls: [target.rpc], ...(target.explorer ? { blockExplorerUrls: [target.explorer] } : {}) }] });
          await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${target.id.toString(16)}` }] });
          setChainId(target.id); setModal(null); setNetworkSearch(''); setNotice(`Network added and switched to ${target.name}.`);
        } catch { setNotice(`Your wallet could not add ${target.name}. Check its RPC details or add it manually in your wallet.`); }
      } else setNotice('Network switch was cancelled or rejected.');
    }
  };
  const send = async () => {
    if (!window.ethereum || !address) { setNotice('Connect your wallet before sending.'); return; }
    if (!/^0x[a-fA-F0-9]{40}$/.test(sendTo)) { setNotice('Enter a valid EVM destination address.'); return; }
    const amount = Number(sendAmount);
    if (!Number.isFinite(amount) || amount <= 0) { setNotice('Enter an amount greater than zero.'); return; }
    try {
      const value = `0x${BigInt(Math.floor(amount * 1e18)).toString(16)}`;
      const hash = await window.ethereum.request({ method: 'eth_sendTransaction', params: [{ from: address, to: sendTo, value }] }) as string;
      setActivity(old => [{ hash, chain, time: new Date().toLocaleString() }, ...old]);
      setModal(null); setSendTo(''); setSendAmount('');
      setNotice('Transaction submitted. Confirm its status in the block explorer.');
      void refreshBalance();
    } catch { setNotice('Transaction was rejected or could not be submitted.'); }
  };
  const copyAddress = async () => { try { await navigator.clipboard.writeText(address); setNotice('Wallet address copied.'); } catch { setNotice(address); } };
  const navItems = [{ name: 'Overview', label: 'Home', icon: Home }, { name: 'Activity', label: 'Activity', icon: Activity }, { name: 'Swap', label: 'Swap', icon: ArrowLeftRight }, { name: 'Explore', label: 'Explore', icon: Globe2 }];
  const accountUser = Boolean(address);

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Sparkles size={21} strokeWidth={2.4}/></div><span>nova<span className="brand-light">wallet</span></span><button className="mobile-close icon-button" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={19}/></button></div>
      <div className="workspace-label">WALLET</div>
      <nav className="main-nav">{navItems.map(item => <button key={item.name} className={`nav-item ${activeTab === item.name ? 'active' : ''}`} onClick={() => { setActiveTab(item.name); setMobileNav(false); if (item.name === 'Swap' || item.name === 'Explore') setNotice(`${item.name} is planned for a later release. No swap or dApp action is performed yet.`); }}><item.icon size={19}/><span>{item.label || item.name}</span>{item.name === 'Swap' && <span className="soon-tag">SOON</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="security-card"><div className="security-icon"><ShieldCheck size={19}/></div><div><strong>Your keys, your control</strong><p>Keys stay in your connected wallet.</p></div></div><button className="nav-item" onClick={() => setModal('help')}><CircleHelp size={19}/><span>Help & security</span></button><button className="nav-item" onClick={() => setNotice('Settings are coming in a future release.')}><Settings2 size={19}/><span>Settings</span></button><div className="profile-row"><div className="profile-avatar">N</div><div className="profile-info"><strong>Nova Wallet</strong><span>Web wallet preview</span></div><button className="icon-button" onClick={() => setModal('help')} aria-label="Account info"><ChevronDown size={17}/></button></div></div>
    </aside>
    {mobileNav && <button className="mobile-overlay" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
    <main className="main-content">
      {activeTab === 'Overview' && (<header className="sire-home-header">
        <button type="button" className="sire-home-icon sire-home-profile-button" aria-label="Profile" onClick={() => address ? setNotice(`Connected wallet: ${shortAddress(address)}. Use the wallet controls below to disconnect.`) : setModal('help')}>
          <CircleUserRound size={23} />
        </button>
        <div className="sire-home-header-actions">
          <button type="button" className="sire-home-icon" aria-label="Search" onClick={() => setNotice('Search is planned for a future release.')}><Search size={21} /></button>
          <button type="button" className="sire-home-icon" aria-label="Notifications" onClick={() => setNotice('You’re all caught up.')}><Bell size={21} /></button>
          <button type="button" className="sire-home-icon" aria-label="Help" onClick={() => setModal('help')}><CircleHelp size={22} /></button>
        </div>
      </header>)}
{activeTab !== 'Overview' && activeTab !== 'Activity' && (
      <div className="home-wallet-controls">
        <div className="breadcrumb">Wallet <span>/</span> <strong>{activeTab}</strong></div>
        <div className="topbar-actions">
          <button className="network-picker" onClick={() => setModal('network')}><span className="chain-dot" style={{ background: chain.color }}/><span>{chain.name}</span><ChevronDown size={15}/></button>
          {address ? <button className="connect-button connected" onClick={disconnect}><span className="connected-dot"/>{shortAddress(address)}<ChevronDown size={15}/></button> : <button className="connect-button" onClick={connect}><Wallet size={16}/> Connect wallet</button>}
        </div>
      </div>
      )}
      <div className={`page-wrap ${activeTab === 'Overview' ? 'overview-page-wrap' : ''}`}>
{activeTab !== 'Overview' && activeTab !== 'Activity' && (
        <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> YOUR WEB3 HOME</div><h1>{activeTab === 'Overview' ? 'Your crypto, clearly.' : activeTab}</h1><p className="page-subtitle">{activeTab === 'Overview' ? 'One calm place to see and manage your digital assets.' : activeTab === 'Activity' ? 'Keep track of transactions submitted from this session.' : activeTab === 'Swap' ? 'Token swaps will be available in a future release.' : 'Discover onchain tools and apps in a future release.'}</p></div><button className="refresh-button" onClick={() => address ? void refreshBalance() : void connect()}><RefreshCw size={15} className={loading ? 'spin' : ''}/><span>{address ? 'Refresh' : 'Get started'}</span></button></div>
        )}

                <footer className="footer"><div><span className="footer-logo"><Sparkles size={14}/> nova wallet</span><span>Built for clarity. Designed for you.</span></div><div className="footer-right"><span><span className="status-dot"/> Networks operational</span><button onClick={() => setModal('help')}>Security first <ShieldCheck size={13}/></button></div></footer>
      </div>
    </main>

    <nav className={`bottom-navigation ${bottomNavVisible ? '' : 'nav-hidden'}`} aria-label="Main navigation">
      <button type="button" className={activeTab === 'Overview' ? 'active' : ''} aria-current={activeTab === 'Overview' ? 'page' : undefined} onClick={() => setActiveTab('Overview')}><Home size={20}/><span>Home</span></button>
      <button type="button" className={activeTab === 'Activity' ? 'active' : ''} aria-current={activeTab === 'Activity' ? 'page' : undefined} onClick={() => setActiveTab('Activity')}><Activity size={20}/><span>History</span></button>
      <button type="button" onClick={() => address ? setNotice(`Connected wallet: ${shortAddress(address)}`) : void connect()}><Wallet size={20}/><span>Wallet</span></button>
    </nav>
    {notice && <div className="toast" role="status"><span className="toast-dot"/><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss notification"><X size={16}/></button></div>}

    {modal && <div className={`modal-backdrop ${modal === 'network' ? 'network-modal-backdrop' : ''}`} onClick={() => setModal(null)}><section className={`modal-card ${modal === 'network' ? 'network-modal-card' : ''}`} onClick={e => e.stopPropagation()}>
      <div className="modal-head"><div><span className="modal-eyebrow">NOVA WALLET</span><h2>{modal === 'network' ? 'Choose a network' : modal === 'send' ? 'Send crypto' : modal === 'receive' ? 'Receive crypto' : 'Your security matters'}</h2></div><button className="icon-button" onClick={() => setModal(null)} aria-label="Close dialog"><X size={19}/></button></div>
      {modal === 'network' && <><p className="modal-description">Choose a network for your wallet. Popular chains are ready below, and the searchable directory includes additional EVM networks. Your wallet will ask you to approve any network change.</p><div className="network-search-wrap"><Search size={16}/><input value={networkSearch} onChange={event => setNetworkSearch(event.target.value)} placeholder="Search by network, token, or chain ID…" aria-label="Search networks" /><span className="network-search-shortcut">⌕</span></div>{!networkSearch && <><div className="network-section-heading"><span>POPULAR NETWORKS</span><small>Quick switch</small></div><div className="network-quick-grid">{popularNetworkOptions.map(c => <button type="button" key={c.id} className={`network-quick-option ${chainId === c.id ? 'selected' : ''}`} onClick={() => void switchNetwork(c)}><span className="network-quick-logo" style={{ background: c.color }}>{chainLogoUrl(c) && <img src={chainLogoUrl(c)} data-logo-candidates={JSON.stringify(chainLogoUrls(c))} data-logo-index="0" alt="" decoding="async" onLoad={event => { const fallback = event.currentTarget.nextElementSibling as HTMLElement | null; if (fallback) fallback.hidden = true; }} onError={handleChainLogoError} />}<span>{iconLetters[c.symbol] || c.symbol.slice(0, 3)}</span></span><span>{c.name}</span>{chainId === c.id && <span className="network-quick-check">✓</span>}</button>)}</div></>}{networkListLoading && <p className="network-loading">Refreshing network directory…</p>}<div className="network-section-heading network-directory-heading"><span>{networkSearch ? 'SEARCH RESULTS' : 'ALL NETWORKS'}</span><small>{visibleNetworkOptions.length}{networkSearch ? ' matches' : ' available'}</small></div><div className="network-list">{visibleNetworkOptions.map(c => <button className={`network-option ${chainId === c.id ? 'selected' : ''}`} key={c.id} onClick={() => void switchNetwork(c)}><span className="asset-icon network-option-logo" style={{ background: c.color }}>{chainLogoUrl(c) && <img src={chainLogoUrl(c)} data-logo-candidates={JSON.stringify(chainLogoUrls(c))} data-logo-index="0" alt="" decoding="async" onLoad={event => { const fallback = event.currentTarget.nextElementSibling as HTMLElement | null; if (fallback) fallback.hidden = true; }} onError={handleChainLogoError} />}<span>{iconLetters[c.symbol] || c.symbol.slice(0, 3)}</span></span><span className="network-option-text"><strong>{c.name}</strong><small>{c.label} · Chain ID {c.id}</small></span>{chainId === c.id ? <span className="current-tag">CURRENT</span> : <ArrowUpRight size={16}/>}</button>)}{visibleNetworkOptions.length === 0 && <p className="network-loading">No networks match that search. Try a symbol such as APE or a numeric chain ID.</p>}</div></>}
      {modal === 'send' && <><p className="modal-description">Send native {chain.symbol} on {chain.name}. Check the address and network carefully before confirming in your wallet.</p><label className="form-label">Recipient address</label><input className="form-input" placeholder="0x…" value={sendTo} onChange={e => setSendTo(e.target.value)} autoComplete="off"/><label className="form-label">Amount ({chain.symbol})</label><input className="form-input" type="number" min="0" step="any" placeholder="0.00" value={sendAmount} onChange={e => setSendAmount(e.target.value)}/><div className="form-warning"><ShieldCheck size={16}/><span>Nova will never ask for your seed phrase. Your wallet provider will display the final transaction for approval.</span></div><button className="primary-button full-button" onClick={() => void send()}>Continue to wallet <ArrowUpRight size={16}/></button></>}
      {modal === 'receive' && <><p className="modal-description">Share your public wallet address to receive assets on the selected network.</p><div className="receive-card"><div className="receive-chain"><span className="chain-dot" style={{ background: chain.color }}/>{chain.name} <span className="receive-symbol">{chain.symbol}</span></div><div className="receive-address">{address}</div><button className="primary-button full-button" onClick={() => void copyAddress()}><Copy size={16}/> Copy address</button></div><div className="form-warning"><CircleHelp size={16}/><span>Only send assets compatible with this network to this address. Sending on the wrong network can result in permanent loss.</span></div></>}
      {modal === 'help' && <><p className="modal-description">Nova is an early web-wallet interface. Your safety comes first.</p><div className="security-list"><div><ShieldCheck size={18}/><span><strong>Your keys stay with your wallet</strong><small>This version connects to an existing browser wallet and does not collect private keys or recovery phrases.</small></span></div><div><LockKeyhole size={18}/><span><strong>Review every transaction</strong><small>Always check the network, destination, amount and fee in your wallet confirmation window.</small></span></div><div><Globe2 size={18}/><span><strong>Public blockchain data</strong><small>Balances are fetched from public RPC endpoints. Prices are not displayed in this version.</small></span></div></div><button className="primary-button full-button" onClick={() => setModal(null)}>Got it</button></>}
    </section></div>}
  </div>;
}

export default App;