import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, Bell, ChevronDown, CircleHelp, CircleUserRound, Copy, ExternalLink, Eye, EyeOff, Flame, Globe2, Home, LayoutGrid, LockKeyhole, Menu, MoreHorizontal, QrCode, RefreshCw, Search, Settings2, ShieldCheck, Sparkles, Star, TrendingDown, TrendingUp, Wallet, X, Zap } from 'lucide-react';

type Chain = { id: number; name: string; symbol: string; label: string; rpc: string; explorer: string; color: string; priceId: string };
type MarketToken = { id: string; symbol: string; name: string; image: string; current_price: number | null; market_cap: number | null; total_volume: number | null; price_change_percentage_24h: number | null; market_cap_rank: number | null };
type EthereumProvider = { request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>; on?: (event: string, cb: (...args: unknown[]) => void) => void; removeListener?: (event: string, cb: (...args: unknown[]) => void) => void };
declare global { interface Window { ethereum?: EthereumProvider } }

const CHAINS: Chain[] = [
  { id: 1, name: 'Ethereum', symbol: 'ETH', label: 'Ethereum Mainnet', rpc: 'https://ethereum-rpc.publicnode.com', explorer: 'https://etherscan.io', color: '#7895ff', priceId: 'ethereum' },
  { id: 56, name: 'BNB Chain', symbol: 'BNB', label: 'BNB Smart Chain', rpc: 'https://bsc-rpc.publicnode.com', explorer: 'https://bscscan.com', color: '#f0b90b', priceId: 'binancecoin' },
  { id: 8453, name: 'Base', symbol: 'ETH', label: 'Base Mainnet', rpc: 'https://mainnet.base.org', explorer: 'https://basescan.org', color: '#4c7df0', priceId: 'ethereum' },
  { id: 137, name: 'Polygon', symbol: 'POL', label: 'Polygon PoS', rpc: 'https://polygon-bor-rpc.publicnode.com', explorer: 'https://polygonscan.com', color: '#9b7bf7', priceId: 'matic-network' },
  { id: 42161, name: 'Arbitrum', symbol: 'ETH', label: 'Arbitrum One', rpc: 'https://arb1.arbitrum.io/rpc', explorer: 'https://arbiscan.io', color: '#2d9cdb', priceId: 'ethereum' },
  { id: 10, name: 'Optimism', symbol: 'ETH', label: 'Optimism', rpc: 'https://mainnet.optimism.io', explorer: 'https://optimistic.etherscan.io', color: '#ff5364', priceId: 'ethereum' },
];
const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
const shortAddress = (s: string) => s ? `${s.slice(0, 6)}…${s.slice(-4)}` : '';
const rpcCall = async (chain: Chain, method: string, params: unknown[] = []) => {
  const response = await fetch(chain.rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'RPC request failed');
  return data.result as string;
};
const formatBalance = (hex: string) => Number(BigInt(hex)) / 1e18;
const iconLetters: Record<string, string> = { ETH: 'Ξ', BNB: '◆', POL: '⬡' };

function App() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [marketTokens, setMarketTokens] = useState<MarketToken[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState('');
  const [marketCategory, setMarketCategory] = useState('Hot');
  const [marketQuery, setMarketQuery] = useState('');
  const [marketPage, setMarketPage] = useState(1);
  const [marketHasMore, setMarketHasMore] = useState(true);
  const [marketSort, setMarketSort] = useState<'market_cap' | 'volume' | 'change'>('market_cap');
  const [favoriteTokens, setFavoriteTokens] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('nova-market-favorites') || '[]') as string[]; } catch { return []; } });
  const [address, setAddress] = useState('');
  const [chainId, setChainId] = useState(1);
  const [balance, setBalance] = useState<number | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [priceLoading, setPriceLoading] = useState(true);
  const [hideBalance, setHideBalance] = useState(false);
  const [totalValueVisible, setTotalValueVisible] = useState(true);
  const [modal, setModal] = useState<'send' | 'receive' | 'network' | 'help' | null>(null);
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [notice, setNotice] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [activity, setActivity] = useState<{ hash: string; chain: Chain; time: string }[]>([]);
  const chain = CHAINS.find(c => c.id === chainId) ?? CHAINS[0];
  const usdBalance = balance === null ? null : balance * (prices[chain.priceId] || 0);

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

  useEffect(() => {
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum,binancecoin,matic-network&vs_currencies=usd')
      .then(r => { if (!r.ok) throw new Error('Price request failed'); return r.json(); })
      .then(d => setPrices({ ethereum: d.ethereum?.usd || 0, binancecoin: d.binancecoin?.usd || 0, 'matic-network': d['matic-network']?.usd || 0 }))
      .catch(() => setPrices({ ethereum: 0, binancecoin: 0, 'matic-network': 0 }))
      .finally(() => setPriceLoading(false));
  }, []);

  useEffect(() => { if (address) void refreshBalance(address, chain); }, [address, chainId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!window.ethereum) return;
    const onAccounts = (accounts: unknown) => setAddress(Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : '');
    const onChain = (id: unknown) => setChainId(typeof id === 'string' ? Number.parseInt(id, 16) : 1);
    window.ethereum.on?.('accountsChanged', onAccounts);
    window.ethereum.on?.('chainChanged', onChain);
    return () => { window.ethereum?.removeListener?.('accountsChanged', onAccounts); window.ethereum?.removeListener?.('chainChanged', onChain); };
  }, []);

  const loadMarketTokens = useCallback(async (page = 1, append = false) => {
    setMarketLoading(true);
    setMarketError('');
    try {
      const response = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=${page}&sparkline=false&price_change_percentage=24h`);
      if (!response.ok) throw new Error(response.status === 429 ? 'Market data is rate-limited. Please wait a moment and retry.' : 'Market data is temporarily unavailable.');
      const data = await response.json() as MarketToken[];
      setMarketTokens(old => append ? [...old, ...data.filter(token => !old.some(existing => existing.id === token.id))] : data);
      setMarketHasMore(data.length === 100);
      setMarketPage(page);
    } catch (error) {
      setMarketError(error instanceof Error ? error.message : 'Could not load market data.');
    } finally { setMarketLoading(false); }
  }, []);

  useEffect(() => {
    void loadMarketTokens(1, false);
  }, [loadMarketTokens]);

  useEffect(() => {
    try { localStorage.setItem('nova-market-favorites', JSON.stringify(favoriteTokens)); } catch { /* Storage may be disabled. */ }
  }, [favoriteTokens]);

  const toggleFavorite = (id: string) => setFavoriteTokens(old => old.includes(id) ? old.filter(tokenId => tokenId !== id) : [...old, id]);
  const marketNumber = (value: number | null | undefined) => {
    if (value == null || !Number.isFinite(value)) return '—';
    if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
    return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  };
  const marketPrice = (value: number | null) => {
    if (value == null) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: value < 1 ? 4 : 2, maximumFractionDigits: value < 1 ? 8 : 2 }).format(value);
  };
  const filteredMarketTokens = useMemo(() => {
    let result = [...marketTokens];
    const query = marketQuery.trim().toLowerCase();
    if (query) result = result.filter(token => token.name.toLowerCase().includes(query) || token.symbol.toLowerCase().includes(query) || token.id.toLowerCase().includes(query));
    if (marketCategory === 'Favorites') result = result.filter(token => favoriteTokens.includes(token.id));
    if (marketCategory === 'Gainers') result = result.filter(token => (token.price_change_percentage_24h ?? -Infinity) > 0).sort((a, b) => (b.price_change_percentage_24h ?? 0) - (a.price_change_percentage_24h ?? 0));
    else if (marketCategory === 'Losers') result = result.filter(token => (token.price_change_percentage_24h ?? Infinity) < 0).sort((a, b) => (a.price_change_percentage_24h ?? 0) - (b.price_change_percentage_24h ?? 0));
    else if (marketCategory === 'Hot') result = result.slice(0, 10);
    else if (marketSort === 'volume') result.sort((a, b) => (b.total_volume ?? 0) - (a.total_volume ?? 0));
    else if (marketSort === 'change') result.sort((a, b) => (b.price_change_percentage_24h ?? -Infinity) - (a.price_change_percentage_24h ?? -Infinity));
    return result;
  }, [marketTokens, marketQuery, marketCategory, favoriteTokens, marketSort]);

  const connect = async () => {
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
      if (e.code === 4902) setNotice('This network is not configured in your wallet yet. Add it using your wallet settings.');
      else setNotice('Network switch was cancelled or rejected.');
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
  const navItems = [{ name: 'Overview', label: 'Home', icon: Home }, { name: 'Market', label: 'Market', icon: TrendingUp }, { name: 'Activity', label: 'Activity', icon: Activity }, { name: 'Swap', label: 'Swap', icon: ArrowLeftRight }, { name: 'Explore', label: 'Explore', icon: Globe2 }];
  const portfolio = useMemo(() => usdBalance, [usdBalance]);
  const accountUser = Boolean(address);
  const accountValue = portfolio === null ? null : money(portfolio);
  const showValue = (value: number | null) => hideBalance ? '••••••' : value === null ? '—' : money(value);

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Sparkles size={21} strokeWidth={2.4}/></div><span>nova<span className="brand-light">wallet</span></span><button className="mobile-close icon-button" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={19}/></button></div>
      <div className="workspace-label">WALLET</div>
      <nav className="main-nav">{navItems.map(item => <button key={item.name} className={`nav-item ${activeTab === item.name ? 'active' : ''}`} onClick={() => { setActiveTab(item.name); setMobileNav(false); if (item.name === 'Swap' || item.name === 'Explore') setNotice(`${item.name} is planned for a later release. No swap or dApp action is performed yet.`); }}><item.icon size={19}/><span>{item.label || item.name}</span>{item.name === 'Swap' && <span className="soon-tag">SOON</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="security-card"><div className="security-icon"><ShieldCheck size={19}/></div><div><strong>Your keys, your control</strong><p>Keys stay in your connected wallet.</p></div></div><button className="nav-item" onClick={() => setModal('help')}><CircleHelp size={19}/><span>Help & security</span></button><button className="nav-item" onClick={() => setNotice('Settings are coming in a future release.')}><Settings2 size={19}/><span>Settings</span></button><div className="profile-row"><div className="profile-avatar">N</div><div className="profile-info"><strong>Nova Wallet</strong><span>Web wallet preview</span></div><button className="icon-button" onClick={() => setModal('help')} aria-label="Account info"><ChevronDown size={17}/></button></div></div>
    </aside>
    {mobileNav && <button className="mobile-overlay" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
    <main className="main-content">
      <header className="sire-home-header">
        <button type="button" className="sire-home-icon sire-home-profile-button" aria-label="Profile" onClick={() => address ? setNotice(`Connected wallet: ${shortAddress(address)}. Use the wallet controls below to disconnect.`) : setModal('help')}>
          <CircleUserRound size={23} />
        </button>
        <div className="sire-home-header-actions">
          <button type="button" className="sire-home-icon" aria-label="Search" onClick={() => setNotice('Search is planned for a future release.')}><Search size={21} /></button>
          <button type="button" className="sire-home-icon" aria-label="Notifications" onClick={() => setNotice('You’re all caught up.')}><Bell size={21} /></button>
          <button type="button" className="sire-home-icon" aria-label="Help" onClick={() => setModal('help')}><CircleHelp size={22} /></button>
        </div>
      </header>
{activeTab !== 'Overview' && activeTab !== 'Activity' && activeTab !== 'Market' && (
      <div className="home-wallet-controls">
        <div className="breadcrumb">Wallet <span>/</span> <strong>{activeTab}</strong></div>
        <div className="topbar-actions">
          <button className="network-picker" onClick={() => setModal('network')}><span className="chain-dot" style={{ background: chain.color }}/><span>{chain.name}</span><ChevronDown size={15}/></button>
          {address ? <button className="connect-button connected" onClick={disconnect}><span className="connected-dot"/>{shortAddress(address)}<ChevronDown size={15}/></button> : <button className="connect-button" onClick={connect}><Wallet size={16}/> Connect wallet</button>}
        </div>
      </div>
      )}
      <div className={`page-wrap ${activeTab === 'Overview' ? 'overview-page-wrap' : ''}`}>
{activeTab !== 'Overview' && activeTab !== 'Activity' && activeTab !== 'Market' && (
        <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> YOUR WEB3 HOME</div><h1>{activeTab === 'Overview' ? 'Your crypto, clearly.' : activeTab}</h1><p className="page-subtitle">{activeTab === 'Overview' ? 'One calm place to see and manage your digital assets.' : activeTab === 'Activity' ? 'Keep track of transactions submitted from this session.' : activeTab === 'Swap' ? 'Token swaps will be available in a future release.' : 'Discover onchain tools and apps in a future release.'}</p></div><button className="refresh-button" onClick={() => address ? void refreshBalance() : void connect()}><RefreshCw size={15} className={loading ? 'spin' : ''}/><span>{address ? 'Refresh' : 'Get started'}</span></button></div>
        )}

        {activeTab === 'Market' ? <section className="market-page">
          <div className="market-page-heading">
            <div><div className="market-eyebrow"><span className="market-eyebrow-dot" /> LIVE CRYPTO MARKET</div><h1>Market</h1><p>Explore prices, trading volume, market caps, and daily moves across crypto.</p></div>
            <button className="market-refresh" type="button" onClick={() => void loadMarketTokens(1, false)} disabled={marketLoading}><RefreshCw size={15} className={marketLoading ? 'spin' : ''}/><span>Refresh</span></button>
          </div>
          <div className="market-summary-grid">
            <article className="market-summary-card"><span>Tokens tracked</span><strong>{marketTokens.length ? marketTokens.length.toLocaleString('en-US') + (marketHasMore ? '+' : '') : '—'}</strong><small>Market catalogue</small></article>
            <article className="market-summary-card"><span>24h gainers</span><strong>{marketTokens.filter(token => (token.price_change_percentage_24h ?? 0) > 0).length.toLocaleString('en-US')}</strong><small>In loaded catalogue</small></article>
            <article className="market-summary-card"><span>Favorites</span><strong>{favoriteTokens.length.toLocaleString('en-US')}</strong><small>Saved on this browser</small></article>
          </div>
          <div className="market-toolbar">
            <label className="market-search"><Search size={17}/><input value={marketQuery} onChange={event => setMarketQuery(event.target.value)} placeholder="Search token name or symbol" aria-label="Search token name or symbol"/>{marketQuery && <button type="button" onClick={() => setMarketQuery('')} aria-label="Clear search"><X size={15}/></button>}</label>
            <div className="market-category-list" role="tablist" aria-label="Market categories">
              {['Hot', 'All tokens', 'Favorites', 'Gainers', 'Losers', 'Volume'].map(category => <button type="button" role="tab" aria-selected={marketCategory === category} className={marketCategory === category ? 'active' : ''} key={category} onClick={() => { setMarketCategory(category); if (category === 'Volume') setMarketSort('volume'); else if (category === 'Gainers' || category === 'Losers') setMarketSort('change'); else setMarketSort('market_cap'); }}>{category === 'Hot' && <Flame size={14}/>} {category === 'Favorites' && <Star size={14}/>} {category === 'Gainers' && <TrendingUp size={14}/>} {category === 'Losers' && <TrendingDown size={14}/>} {category}</button>)}
            </div>
          </div>
          <div className="market-table-panel">
            <div className="market-table-title"><div><h2>{marketCategory === 'Hot' ? 'Trending tokens' : marketCategory === 'All tokens' ? 'All tokens' : marketCategory}</h2><p>Live market data · 24-hour change · USD</p></div><span className="market-live-indicator"><i/> LIVE</span></div>
            {marketError && <div className="market-error"><span>{marketError}</span><button type="button" onClick={() => void loadMarketTokens(1, false)}>Try again</button></div>}
            <div className="market-table-scroll"><table className="market-table"><thead><tr><th className="market-rank-head">#</th><th className="market-asset-head">Asset</th><th className="market-price-head">Price <button type="button" aria-label="Sort by market cap" onClick={() => setMarketSort('market_cap')}><ChevronDown size={12}/></button></th><th className="market-change-head">24h</th><th className="market-volume-head">Vol (24h) <button type="button" aria-label="Sort by volume" onClick={() => setMarketSort('volume')}><ChevronDown size={12}/></button></th><th className="market-cap-head">Market cap</th><th className="market-favorite-head"></th></tr></thead>
            <tbody>{filteredMarketTokens.map((token, index) => { const change = token.price_change_percentage_24h; const isFavorite = favoriteTokens.includes(token.id); return <tr key={token.id}>
              <td className="market-rank">{token.market_cap_rank ?? index + 1}</td>
              <td><div className="market-token"><img src={token.image} alt="" loading="lazy" onError={event => { event.currentTarget.style.visibility = 'hidden'; }}/><div><strong>{token.name}</strong><span>{token.symbol.toUpperCase()}</span></div></div></td>
              <td className="market-price">{marketPrice(token.current_price)}</td>
              <td><span className={change == null ? 'market-change neutral' : change >= 0 ? 'market-change positive' : 'market-change negative'}>{change == null ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(2)}%`}</span></td>
              <td className="market-metric">{marketNumber(token.total_volume)}</td><td className="market-metric">{marketNumber(token.market_cap)}</td>
              <td><button type="button" className={`market-favorite ${isFavorite ? 'saved' : ''}`} aria-label={isFavorite ? `Remove ${token.name} from favorites` : `Add ${token.name} to favorites`} onClick={() => toggleFavorite(token.id)}><Star size={17} fill={isFavorite ? 'currentColor' : 'none'}/></button></td>
            </tr>; })}
            {!marketLoading && filteredMarketTokens.length === 0 && <tr><td colSpan={7}><div className="market-empty">{marketError ? 'Market data could not be loaded.' : marketCategory === 'Favorites' && !marketQuery ? 'No favorites yet. Tap the star beside a token to save it here.' : 'No tokens match your search or category.'}</div></td></tr>}
            {marketLoading && marketTokens.length === 0 && <tr><td colSpan={7}><div className="market-loading"><span className="market-loader"/><span>Loading live market catalogue…</span></div></td></tr>}
            </tbody></table></div>
            <div className="market-table-footer"><span>Prices, volume and market caps from CoinGecko. Market data may be delayed.</span>{marketHasMore && marketCategory !== 'Hot' && marketCategory !== 'Favorites' && <button type="button" onClick={() => void loadMarketTokens(marketPage + 1, true)} disabled={marketLoading}>{marketLoading ? 'Loading…' : 'Load more tokens'} <ArrowDownLeft size={14}/></button>}</div>
          </div>
        </section> : <>
        <section className="sire-home-value-card" aria-label="Total account value">
          <div className="sire-home-value-main">
            <div className="sire-home-value-copy">
              <div className="sire-home-value-card-top">
                <span>TOTAL VALUE</span>
                <button type="button" className="sire-home-value-eye" aria-label={totalValueVisible ? "Hide balance" : "Show balance"} onClick={() => setTotalValueVisible(visible => !visible)}>
                  {totalValueVisible ? <Eye size={17} /> : <EyeOff size={17} />}
                </button>
              </div>
              <div className="sire-home-value-amount">{totalValueVisible ? (accountValue ?? "$0.00") : "••••••"}<small>USD</small></div>
            </div>
            <div className="sire-home-value-chart" aria-hidden="true">
              <svg viewBox="0 0 320 100" preserveAspectRatio="none">
                <defs><linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity="0.18" /><stop offset="100%" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
                <path d="M0 78 C35 75, 45 68, 72 71 S110 62, 132 66 S165 48, 188 53 S220 39, 242 45 S278 25, 320 31 L320 100 L0 100 Z" fill="url(#balanceGradient)" />
                <path d="M0 78 C35 75, 45 68, 72 71 S110 62, 132 66 S165 48, 188 53 S220 39, 242 45 S278 25, 320 31" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          </div>
          <button type="button" className="sire-home-value-add-funds" onClick={() => address ? setModal('receive') : void connect()}>Add funds</button>
        </section>

        <section className="network-marquee" aria-label="Supported blockchain networks">
          <div className="network-marquee-track">
            {[0, 1].map(copy => <div className="network-marquee-group" key={copy} aria-hidden={copy === 1 ? true : undefined}>
              {[
                { name: 'Ethereum', mark: '◆', className: 'ethereum' },
                { name: 'BNB Chain', mark: '◆', className: 'bnb' },
                { name: 'Base', mark: '●', className: 'base' },
                { name: 'Polygon', mark: '⬡', className: 'polygon' },
                { name: 'Arbitrum', mark: 'A', className: 'arbitrum' },
                { name: 'Optimism', mark: 'OP', className: 'optimism' },
              ].map(network => <div className="network-marquee-pill" key={network.name}>
                <span className={`network-marquee-logo ${network.className}`}>{network.mark}</span>
                <span>{network.name}</span>
              </div>)}
            </div>)}
          </div>
        </section>

        <nav className="wallet-quick-actions" aria-label="Wallet actions">
          <button type="button" className="wallet-quick-action" onClick={() => setModal('send')}><span className="wallet-quick-icon"><ArrowUpRight size={20} /></span><span>Send</span></button>
          <button type="button" className="wallet-quick-action" onClick={() => setModal('receive')}><span className="wallet-quick-icon"><ArrowDownLeft size={20} /></span><span>Receive</span></button>
          <button type="button" className="wallet-quick-action" onClick={() => setActiveTab('Activity')}><span className="wallet-quick-icon"><Activity size={20} /></span><span>History</span></button>
          <button type="button" className="wallet-quick-more" aria-label="More options" onClick={() => setModal('network')}><MoreHorizontal size={23} /></button>
        </nav>

        {!address && <div className="connect-banner"><div className="banner-art"><div className="banner-orbit orbit-one"/><div className="banner-orbit orbit-two"/><div className="banner-coin"><Sparkles size={28}/></div></div><div className="banner-copy"><div className="banner-kicker">WELCOME TO NOVA</div><h2>Your assets. Your rules.</h2><p>Connect a browser wallet to see your onchain balance and get started. Nova never asks for your recovery phrase.</p><div className="banner-buttons"><button className="primary-button" onClick={connect}>Connect wallet <ArrowUpRight size={16}/></button><button className="text-button" onClick={() => setModal('help')}>How it works <ExternalLink size={14}/></button></div></div><div className="banner-decoration">N<span>.</span></div></div>}

        <section className="stats-grid">
          <article className="stat-card"><div className="stat-top"><span>Active network</span><span className="stat-icon purple"><Globe2 size={17}/></span></div><div className="stat-main">{chain.name}</div><div className="stat-description"><span className="status-dot"/>{address ? 'Wallet connected to network' : 'Ready when you are'}</div><button className="card-link" onClick={() => setModal('network')}>Change network <ArrowUpRight size={14}/></button></article>
          <article className="stat-card"><div className="stat-top"><span>Wallet status</span><span className="stat-icon green"><ShieldCheck size={17}/></span></div><div className="stat-main">{address ? 'Connected' : 'Not connected'}</div><div className="stat-description">{address ? shortAddress(address) : 'Connect your wallet to begin'}</div><button className="card-link" onClick={address ? copyAddress : connect}>{address ? 'Copy address' : 'Connect wallet'} <ArrowUpRight size={14}/></button></article>
        </section>

        <section className="content-grid">
          <article className="panel assets-panel"><div className="panel-heading"><div><h2>Your assets</h2><p>Native token on the selected network</p></div><button className="panel-action" onClick={() => setModal('network')}>All networks <ChevronDown size={14}/></button></div><div className="asset-table"><div className="asset-header"><span>ASSET</span><span>PRICE</span><span>BALANCE</span></div><div className="asset-row"><div className="asset-name"><div className="asset-icon" style={{ background: chain.color }}>{iconLetters[chain.symbol] || '◈'}</div><div><strong>{chain.symbol}</strong><span>{chain.name}</span></div></div><div className="asset-price">{prices[chain.priceId] ? money(prices[chain.priceId]) : '—'}<span className="change-positive">Market price</span></div><div className="asset-balance"><strong>{balance === null ? (address ? 'Loading…' : '—') : `${balance.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${chain.symbol}`}</strong><span>{showValue(usdBalance)}</span></div></div>{!address && <div className="empty-inline"><Wallet size={18}/><span>Connect a wallet to load your onchain assets.</span></div>}</div><div className="asset-footer"><span>Prices supplied by CoinGecko. Balances read from public RPC endpoints.</span><button className="icon-button" onClick={() => address ? void refreshBalance() : void connect()} aria-label="Refresh assets"><RefreshCw size={15}/></button></div></article>
          <article className="panel quick-panel"><div className="panel-heading"><div><h2>Quick actions</h2><p>Common wallet tasks, made simple</p></div><div className="quick-heading-icon"><Zap size={17}/></div></div><div className="quick-actions"><button className="quick-action" onClick={() => { if (!address) { void connect(); return; } setModal('send'); }}><span className="quick-icon send"><ArrowUpRight size={19}/></span><span><strong>Send</strong><small>Transfer crypto</small></span><ArrowUpRight size={15} className="quick-arrow"/></button><button className="quick-action" onClick={() => address ? setModal('receive') : void connect()}><span className="quick-icon receive"><ArrowDownLeft size={19}/></span><span><strong>Receive</strong><small>Share your address</small></span><ArrowUpRight size={15} className="quick-arrow"/></button><button className="quick-action" onClick={() => setNotice('Swap functionality is planned. No tokens have been exchanged.')}><span className="quick-icon swap"><ArrowLeftRight size={19}/></span><span><strong>Swap tokens</strong><small>Coming soon</small></span><span className="soon-tag">SOON</span></button><button className="quick-action" onClick={() => setModal('network')}><span className="quick-icon network"><Globe2 size={19}/></span><span><strong>Change network</strong><small>Explore supported chains</small></span><ArrowUpRight size={15} className="quick-arrow"/></button></div><div className="quick-note"><LockKeyhole size={15}/><span>Every transaction must be approved in your connected wallet.</span></div></article>
        </section>

        <section className="panel activity-panel"><div className="panel-heading"><div><h2>Recent activity</h2><p>Your latest transactions submitted through Nova</p></div><button className="panel-action" onClick={() => setActiveTab('Activity')}>View all <ArrowUpRight size={14}/></button></div>{activity.length ? <div className="activity-list">{activity.slice(0, 3).map((item, i) => <div className="activity-row" key={item.hash + i}><div className="activity-icon"><ArrowUpRight size={17}/></div><div className="activity-info"><strong>Sent {item.chain.symbol}</strong><span>{item.time}</span></div><div className="activity-right"><span className="pending-pill">Submitted</span><a href={`${item.chain.explorer}/tx/${item.hash}`} target="_blank" rel="noreferrer" className="explorer-link">View transaction <ExternalLink size={12}/></a></div></div>)}</div> : <div className="activity-empty"><div className="activity-empty-icon"><Activity size={20}/></div><div><strong>No activity yet</strong><p>{address ? 'Transactions you submit from this session will appear here.' : 'Connect your wallet to get started with your onchain activity.'}</p></div><button className="text-button" onClick={() => address ? setModal('send') : void connect()}>{address ? 'Send crypto' : 'Connect'} <ArrowUpRight size={14}/></button></div>}</section>

        </>}
        <footer className="footer"><div><span className="footer-logo"><Sparkles size={14}/> nova wallet</span><span>Built for clarity. Designed for you.</span></div><div className="footer-right"><span><span className="status-dot"/> Networks operational</span><button onClick={() => setModal('help')}>Security first <ShieldCheck size={13}/></button></div></footer>
      </div>
    </main>

    <nav className="bottom-navigation" aria-label="Main navigation">
      <button type="button" className={activeTab === 'Overview' ? 'active' : ''} aria-current={activeTab === 'Overview' ? 'page' : undefined} onClick={() => setActiveTab('Overview')}><Home size={20}/><span>Home</span></button>
      <button type="button" className={activeTab === 'Market' ? 'active' : ''} aria-current={activeTab === 'Market' ? 'page' : undefined} onClick={() => setActiveTab('Market')}><TrendingUp size={20}/><span>Market</span></button>
      <button type="button" className={activeTab === 'Activity' ? 'active' : ''} aria-current={activeTab === 'Activity' ? 'page' : undefined} onClick={() => setActiveTab('Activity')}><Activity size={20}/><span>History</span></button>
      <button type="button" onClick={() => address ? setNotice(`Connected wallet: ${shortAddress(address)}`) : void connect()}><Wallet size={20}/><span>Wallet</span></button>
    </nav>
    {notice && <div className="toast" role="status"><span className="toast-dot"/><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss notification"><X size={16}/></button></div>}

    {modal && <div className="modal-backdrop" onClick={() => setModal(null)}><section className="modal-card" onClick={e => e.stopPropagation()}>
      <div className="modal-head"><div><span className="modal-eyebrow">NOVA WALLET</span><h2>{modal === 'network' ? 'Choose a network' : modal === 'send' ? 'Send crypto' : modal === 'receive' ? 'Receive crypto' : 'Your security matters'}</h2></div><button className="icon-button" onClick={() => setModal(null)} aria-label="Close dialog"><X size={19}/></button></div>
      {modal === 'network' && <><p className="modal-description">Select a network. Your connected wallet will ask you to approve any network change.</p><div className="network-list">{CHAINS.map(c => <button className={`network-option ${chainId === c.id ? 'selected' : ''}`} key={c.id} onClick={() => void switchNetwork(c)}><span className="asset-icon" style={{ background: c.color }}>{iconLetters[c.symbol] || '◈'}</span><span className="network-option-text"><strong>{c.name}</strong><small>{c.label}</small></span>{chainId === c.id ? <span className="current-tag">CURRENT</span> : <ArrowUpRight size={16}/>}</button>)}</div></>}
      {modal === 'send' && <><p className="modal-description">Send native {chain.symbol} on {chain.name}. Check the address and network carefully before confirming in your wallet.</p><label className="form-label">Recipient address</label><input className="form-input" placeholder="0x…" value={sendTo} onChange={e => setSendTo(e.target.value)} autoComplete="off"/><label className="form-label">Amount ({chain.symbol})</label><input className="form-input" type="number" min="0" step="any" placeholder="0.00" value={sendAmount} onChange={e => setSendAmount(e.target.value)}/><div className="form-warning"><ShieldCheck size={16}/><span>Nova will never ask for your seed phrase. Your wallet provider will display the final transaction for approval.</span></div><button className="primary-button full-button" onClick={() => void send()}>Continue to wallet <ArrowUpRight size={16}/></button></>}
      {modal === 'receive' && <><p className="modal-description">Share your public wallet address to receive assets on the selected network.</p><div className="receive-card"><div className="receive-chain"><span className="chain-dot" style={{ background: chain.color }}/>{chain.name} <span className="receive-symbol">{chain.symbol}</span></div><div className="receive-address">{address}</div><button className="primary-button full-button" onClick={() => void copyAddress()}><Copy size={16}/> Copy address</button></div><div className="form-warning"><CircleHelp size={16}/><span>Only send assets compatible with this network to this address. Sending on the wrong network can result in permanent loss.</span></div></>}
      {modal === 'help' && <><p className="modal-description">Nova is an early web-wallet interface. Your safety comes first.</p><div className="security-list"><div><ShieldCheck size={18}/><span><strong>Your keys stay with your wallet</strong><small>This version connects to an existing browser wallet and does not collect private keys or recovery phrases.</small></span></div><div><LockKeyhole size={18}/><span><strong>Review every transaction</strong><small>Always check the network, destination, amount and fee in your wallet confirmation window.</small></span></div><div><Globe2 size={18}/><span><strong>Public blockchain data</strong><small>Balances are fetched from public RPC endpoints. Market prices are third-party estimates.</small></span></div></div><button className="primary-button full-button" onClick={() => setModal(null)}>Got it</button></>}
    </section></div>}
  </div>;
}

export default App;