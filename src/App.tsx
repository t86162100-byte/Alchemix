import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, Bell, ChevronDown, CircleHelp, CircleUserRound, Copy, ExternalLink, Eye, EyeOff, Globe2, Home, LayoutGrid, LockKeyhole, Menu, MoreHorizontal, QrCode, RefreshCw, Search, Settings2, ShieldCheck, Sparkles, Wallet, X, Zap, Flame, Star, TrendingUp } from 'lucide-react';
import { JsonRpcProvider, Wallet as EthersWallet, parseEther } from 'ethers';
import MarketTable from './MarketTable';
import { fetchDexMarketMetrics, type MarketMetrics } from './marketData';
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
type MarketToken = { chainId: number; address: string; symbol: string; name: string; decimals: number; logoURI?: string; priceUSD?: string; coinKey?: string };
type MarketNetwork = { id: string; chainId: number; name: string; symbol: string; logoURI?: string; tokens: MarketToken[]; nativeToken?: MarketToken };
type LifiChain = { id: number; key?: string; name: string; chainType?: string; logoURI?: string; nativeToken?: { address: string; symbol: string; name: string; decimals: number; logoURI?: string; priceUSD?: string; coinKey?: string } };
type LifiTokenResponse = { tokens?: Record<string, Array<MarketToken>> };
type CoinGeckoTokenList = { tokens?: Array<{ chainId?: number; address?: string; name?: string; symbol?: string; decimals?: number; logoURI?: string }> };
type CoinGeckoPlatform = { id: string; chain_identifier?: number | null; image?: { thumb?: string; small?: string; large?: string } };
const MARKET_FEATURED_CHAIN_IDS = [1, 56, 8453, 137, 42161, 10, 43114, 5000];
let coinGeckoPlatformsPromise: Promise<CoinGeckoPlatform[]> | null = null;
const getCoinGeckoPlatforms = async () => {
  if (!coinGeckoPlatformsPromise) coinGeckoPlatformsPromise = fetch('https://api.coingecko.com/api/v3/asset_platforms')
    .then(response => { if (!response.ok) throw new Error('Market provider platform list unavailable'); return response.json() as Promise<CoinGeckoPlatform[]>; })
    .catch(error => { coinGeckoPlatformsPromise = null; throw error; });
  return coinGeckoPlatformsPromise;
};
// All supported EVM networks come from LI.FI. This list only controls their display order.
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
const [address, setAddress] = useState('');
const [balance, setBalance] = useState<number | null>(null);
const [loading, setLoading] = useState(false);
const [hideBalance, setHideBalance] = useState(false);
const [totalValueVisible, setTotalValueVisible] = useState(true);
const [modal, setModal] = useState<'send' | 'receive' | 'network' | 'market-network' | 'help' | 'wallet' | 'create' | 'import' | 'unlock' | null>(null);
const [marketNetworkSearch, setMarketNetworkSearch] = useState('');
const [marketNetworks, setMarketNetworks] = useState<MarketNetwork[]>([]);
const [marketNetworksLoading, setMarketNetworksLoading] = useState(false);
const [marketTokensLoading, setMarketTokensLoading] = useState(false);
const [marketNetworkError, setMarketNetworkError] = useState('');
const marketTokenRequests = useRef(new Set<number>());
const marketTokenLoaded = useRef(new Set<number>());
const [sendTo, setSendTo] = useState('');
const [sendAmount, setSendAmount] = useState('');
const [notice, setNotice] = useState('');
const [mobileNav, setMobileNav] = useState(false);
const [activity, setActivity] = useState<{ hash: string; chain: Chain; time: string }[]>([]);
const [marketSearch, setMarketSearch] = useState('');
const [marketSearchOpen, setMarketSearchOpen] = useState(false);
const [marketCategory, setMarketCategory] = useState('Hot');
const [marketNetworkId, setMarketNetworkId] = useState('all');
const [marketTimeRange, setMarketTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
const [marketTimeOpen, setMarketTimeOpen] = useState(false);
const [marketSort, setMarketSort] = useState('market_cap');
const [marketMetrics, setMarketMetrics] = useState<Record<string, MarketMetrics>>({});
const [marketFavorites, setMarketFavorites] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('nova-market-favorites') || '[]') as string[]; } catch { return []; } });
const [privateKey, setPrivateKey] = useState('');
const [walletDraftPrivateKey, setWalletDraftPrivateKey] = useState('');
const [walletPassword, setWalletPassword] = useState('');
const [walletPhrase, setWalletPhrase] = useState('');
const [walletImportPhrase, setWalletImportPhrase] = useState('');
const [walletBusy, setWalletBusy] = useState(false);
const [walletError, setWalletError] = useState('');
const [hasStoredWallet, setHasStoredWallet] = useState(() => Boolean(localStorage.getItem('nova-wallet-keystore')));
const loadMarketTokens = useCallback(async (networkId: string, currentNetworks = marketNetworks) => {
const targets = networkId === 'all' ? currentNetworks : currentNetworks.filter(item => item.id === networkId);
const missing = targets.filter(item => !marketTokenLoaded.current.has(item.chainId) && !marketTokenRequests.current.has(item.chainId));
if (!missing.length) return;
missing.forEach(item => marketTokenRequests.current.add(item.chainId));
setMarketTokensLoading(true);
setMarketNetworkError('');
try {
const platforms = await getCoinGeckoPlatforms();
const platformByChain = new Map<number, CoinGeckoPlatform>();
platforms.forEach(platform => {
  if (Number.isInteger(platform.chain_identifier) && platform.chain_identifier! > 0) platformByChain.set(platform.chain_identifier!, platform);
});
const results = await Promise.all(missing.map(async network => {
  const platform = platformByChain.get(network.chainId);
  if (!platform) return { id: network.id, chainId: network.chainId, tokens: [] as MarketToken[] };
  const providerResponse = await fetch('https://tokens.coingecko.com/' + encodeURIComponent(platform.id) + '/all.json');
  if (!providerResponse.ok) throw new Error('Market provider token list unavailable for ' + network.name);
  const list = await providerResponse.json() as CoinGeckoTokenList;
  const tokens: MarketToken[] = (list.tokens || [])
    .filter(token => Boolean(token.address) && Boolean(String(token.symbol || '').trim()) && Number.isFinite(token.decimals))
    .map(token => ({
      chainId: network.chainId,
      address: token.address!,
      symbol: token.symbol!.trim(),
      name: token.name?.trim() || token.symbol!.trim(),
      decimals: Number(token.decimals),
      logoURI: token.logoURI
    }));
  const unique = new Map<string, MarketToken>();
  tokens.forEach(token => {
    const key = token.address.toLowerCase();
    if (!unique.has(key)) unique.set(key, token);
  });
  const nativeToken = network.nativeToken;
  if (nativeToken && ![...unique.values()].some(token => token.symbol.toLowerCase() === nativeToken.symbol.toLowerCase() && token.address.toLowerCase() === nativeToken.address.toLowerCase())) {
    unique.set(nativeToken.address.toLowerCase(), { ...nativeToken, chainId: network.chainId });
  }
  const sorted = [...unique.values()].sort((a, b) => {
    const aNative = Boolean(nativeToken && a.address.toLowerCase() === nativeToken.address.toLowerCase());
    const bNative = Boolean(nativeToken && b.address.toLowerCase() === nativeToken.address.toLowerCase());
    if (aNative !== bNative) return aNative ? -1 : 1;
    return a.symbol.localeCompare(b.symbol);
  });
  return { id: network.id, chainId: network.chainId, tokens: sorted };
}));
results.forEach(item => marketTokenLoaded.current.add(item.chainId));
setMarketNetworks(previous => previous.map(network => {
  const result = results.find(item => item.id === network.id);
  return result ? { ...network, tokens: result.tokens } : network;
}));
void fetchDexMarketMetrics(results).then(metrics => { if (Object.keys(metrics).length) setMarketMetrics(previous => ({ ...previous, ...metrics })); });
} catch {
setMarketNetworkError('Market provider token list could not be loaded for one or more networks. Try again shortly.');
} finally {
missing.forEach(item => marketTokenRequests.current.delete(item.chainId));
setMarketTokensLoading(false);
}
}, [marketNetworks]);
useEffect(() => {
const directory: Array<[number, string, string]> = [
[1,'Ethereum','ETH'],[56,'BSC','BNB'],[8453,'Base','ETH'],[137,'Polygon','POL'],[42161,'Arbitrum','ETH'],[10,'OP Mainnet','ETH'],[43114,'Avalanche','AVAX'],[5000,'Mantle','MNT'],
[16661,'0G Mainnet','0G'],[2741,'Abstract','ETH'],[33139,'Apechain','APE'],[42170,'Arbitrum Nova','ETH'],[421614,'Arbitrum Sepolia Testnet','ETH'],[5042,'Arc','USDC'],[5042002,'Arc Testnet','USDC'],[84532,'Base Sepolia Testnet','ETH'],[80094,'Berachain','BERA'],[81457,'Blast','ETH'],[60808,'BOB','ETH'],[288,'Boba','ETH'],[42220,'Celo','CELO'],[25,'Cronos','CRO'],[11155111,'Ethereum Sepolia Testnet','ETH'],[42793,'Etherlink','XTZ'],[14,'Flare','FLR'],[747,'Flow','FLOW'],[252,'Fraxtal','FRAX'],[122,'FUSE','FUSE'],[100,'Gnosis','xDAI'],[1625,'Gravity','G'],[43111,'Hemi','ETH'],[999,'HyperEVM','HYPE'],[1337,'Hyperliquid','USDC'],[13371,'Immutable zkEVM','IMX'],[1776,'Injective','INJ'],[57073,'Ink','ETH'],[8217,'Kaia','KAIA'],[747474,'Katana','ETH'],[232,'Lens','GHO'],[3586256,'Lighter','USDC'],[59144,'Linea','ETH'],[1135,'Lisk','ETH'],[4326,'MegaETH','ETH'],[1088,'Metis','METIS'],[34443,'Mode','ETH'],[143,'Monad','MON'],[2818,'Morph','ETH'],[11155420,'OP Sepolia Testnet','ETH'],[204,'opBNB','BNB'],[1672,'Pharos Mainnet','PROS'],[9745,'Plasma','XPL'],[98866,'Plume','PLUME'],[4663,'Robinhood Chain','ETH'],[2020,'Ronin','RON'],[30,'Rootstock','RBTC'],[534352,'Scroll','ETH'],[1329,'Sei','SEI'],[5031,'Somnia','SOMI'],[1868,'Soneium','ETH'],[146,'Sonic','S'],[988,'Stable','USDT0'],[40,'Telos','TLOS'],[4217,'Tempo','PathUSD'],[130,'Unichain','ETH'],[1480,'Vana','VAN'],[88,'Viction','VIC'],[480,'World Chain','ETH'],[50,'XDC','XDC'],[196,'XLayer','OKB'],[324,'zkSync','ETH']
];
getCoinGeckoPlatforms().catch(() => [] as CoinGeckoPlatform[]).then(platforms => {
const platformByChain = new Map<number, CoinGeckoPlatform>();
platforms.forEach(platform => {
  if (Number.isInteger(platform.chain_identifier) && platform.chain_identifier! > 0) platformByChain.set(platform.chain_identifier!, platform);
});
const providerNetworks: MarketNetwork[] = directory.map(([chainId, name, symbol]) => {
  const platform = platformByChain.get(chainId);
  return {
    id: String(chainId), chainId, name, symbol,
    logoURI: platform?.image?.large || platform?.image?.small || platform?.image?.thumb,
    tokens: [],
    nativeToken: { chainId, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', symbol, name: symbol === 'USDC' ? 'USD Coin' : symbol === 'USDT0' ? 'USDT0' : name === 'BSC' ? 'BNB' : name === 'Polygon' ? 'POL' : name === 'Avalanche' ? 'Avalanche' : symbol, decimals: 18 }
  };
});
setMarketNetworks(providerNetworks);
}).catch(() => {
const providerNetworks: MarketNetwork[] = directory.map(([chainId, name, symbol]) => ({
id: String(chainId), chainId, name, symbol, tokens: [],
nativeToken: { chainId, address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', symbol, name, decimals: 18 }
}));
setMarketNetworks(providerNetworks);
}).finally(() => setMarketNetworksLoading(false));
}, []);
useEffect(() => {
if (activeTab === 'Market' && marketNetworks.length) void loadMarketTokens(marketNetworkId);
}, [activeTab, marketNetworks.length, marketNetworkId, loadMarketTokens]);
useEffect(() => {
const savedAddress = localStorage.getItem('nova-wallet-address');
const savedChain = Number(localStorage.getItem('nova-wallet-chain-id') || '1');
if (savedAddress) {
setAddress(savedAddress);
setModal('unlock');
setNotice('Your saved wallet was found on this device. Unlock it to use wallet actions.');
}
if (Number.isFinite(savedChain) && savedChain > 0) setChainId(savedChain);
}, []);
useEffect(() => {
localStorage.setItem('nova-wallet-chain-id', String(chainId));
}, [chainId]);
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
.filter(item => {
if (!Number.isFinite(item.chainId) || item.chainId <= 0) return false;
const identity = `${item.name || ''} ${item.title || ''} ${item.network || ''}`.toLowerCase();
if (/test\s?net|dev\s?net|mini\s?net|local\s?net|sandbox|staging|preview|\bfork\b|\bdevelopment\b/.test(identity)) return false;
const knownTestnetIds = new Set([3, 4, 5, 42, 11155111, 17000, 80001, 80002, 97, 421613, 421614, 84532, 11155420, 534351, 534353, 168587773, 1313161555, 43113, 31337, 1337, 2017, 2018]);
return !knownTestnetIds.has(item.chainId);
})
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
const toggleMarketFavorite = (key: string) => setMarketFavorites(previous => { const next = previous.includes(key) ? previous.filter(item => item !== key) : [...previous, key]; localStorage.setItem('nova-market-favorites', JSON.stringify(next)); return next; });
const marqueeChains = useMemo(() => {
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
useEffect(() => { if (address) void refreshBalance(address, chain); }, [address, chainId]);
useEffect(() => {
if (!window.ethereum) return;
const onAccounts = (accounts: unknown) => setAddress(Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : '');
const onChain = (id: unknown) => setChainId(typeof id === 'string' ? Number.parseInt(id, 16) : 1);
window.ethereum.on?.('accountsChanged', onAccounts);
window.ethereum.on?.('chainChanged', onChain);
return () => { window.ethereum?.removeListener?.('accountsChanged', onAccounts); window.ethereum?.removeListener?.('chainChanged', onChain); };
}, []);
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
const disconnect = () => { setAddress(''); setPrivateKey(''); setBalance(null); setNotice('Wallet locked for this session. Your encrypted wallet remains saved on this device.'); };
const switchNetwork = async (target: Chain) => {
if (!window.ethereum) { if (privateKey) { setChainId(target.id); setModal(null); setNotice(`Selected ${target.name} for your local wallet.`); return; } setNotice('Create/import a wallet or connect a compatible wallet first.'); return; }
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
if (!address || (!window.ethereum && !privateKey)) { setNotice('Create/import a wallet or connect a wallet before sending.'); return; }
if (!/^0x[a-fA-F0-9]{40}$/.test(sendTo)) { setNotice('Enter a valid EVM destination address.'); return; }
const amount = Number(sendAmount);
if (!Number.isFinite(amount) || amount <= 0) { setNotice('Enter an amount greater than zero.'); return; }
try {
let hash: string;
if (privateKey) {
if (!chain.rpc) throw new Error('No public RPC is available for this network.');
const provider = new JsonRpcProvider(chain.rpc, chain.id);
const signer = new EthersWallet(privateKey, provider);
const transaction = await signer.sendTransaction({ to: sendTo, value: parseEther(sendAmount) });
hash = transaction.hash;
} else {
const value = `0x${BigInt(Math.floor(amount * 1e18)).toString(16)}`;
hash = await window.ethereum!.request({ method: 'eth_sendTransaction', params: [{ from: address, to: sendTo, value }] }) as string;
}
setActivity(old => [{ hash, chain, time: new Date().toLocaleString() }, ...old]);
setModal(null); setSendTo(''); setSendAmount('');
setNotice('Transaction submitted. Confirm its status in the block explorer.');
void refreshBalance();
} catch { setNotice('Transaction was rejected or could not be submitted.'); }
};
const copyAddress = async () => { try { await navigator.clipboard.writeText(address); setNotice('Wallet address copied.'); } catch { setNotice(address); } };
const navItems = [{ name: 'Overview', label: 'Home', icon: Home }, { name: 'Market', label: 'Market', icon: Search }, { name: 'Activity', label: 'History', icon: Activity }];
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
<button type="button" className="sire-home-icon sire-home-profile-button" aria-label="Profile" onClick={() => address ? setNotice(`Connected wallet: ${shortAddress(address)}. Use the wallet controls below to disconnect.`) : setModal('wallet')}>
<CircleUserRound size={23} />
</button>
<div className="sire-home-header-actions">
<button type="button" className="sire-home-icon" aria-label="Search" onClick={() => setNotice('Search is planned for a future release.')}><Search size={21} /></button>
<button type="button" className="sire-home-icon" aria-label="Notifications" onClick={() => setNotice('You’re all caught up.')}><Bell size={21} /></button>
<button type="button" className="sire-home-icon" aria-label="Help" onClick={() => setModal('help')}><CircleHelp size={22} /></button>
</div>
</header>)}
{activeTab !== 'Overview' && activeTab !== 'Activity' && activeTab !== 'Market' && (
<div className="home-wallet-controls">
<div className="breadcrumb">Wallet <span>/</span> <strong>{activeTab}</strong></div>
<div className="topbar-actions">
<button className="network-picker" onClick={() => setModal('network')}><span className="chain-dot" style={{ background: chain.color }}/><span>{chain.name}</span><ChevronDown size={15}/></button>
{address ? <button className="connect-button connected" onClick={disconnect}><span className="connected-dot"/>{shortAddress(address)}<ChevronDown size={15}/></button> : <button className="connect-button" onClick={() => setModal('wallet')}><Wallet size={16}/> {hasStoredWallet ? 'Unlock wallet' : 'Create / import'}</button>}
</div>
</div>
)}
<div className={`page-wrap ${activeTab === 'Overview' ? 'overview-page-wrap' : ''}`}>
{activeTab === 'Market' ? <section className="market-page">
<div className="market-topline">
{marketSearchOpen && <label className="market-search-wrap"><Search size={17}/><input autoFocus value={marketSearch} onChange={event => setMarketSearch(event.target.value)} placeholder="Search tokens or contract address…" aria-label="Search market tokens"/><button type="button" onClick={() => { setMarketSearch(''); setMarketSearchOpen(false); }} aria-label="Close search"><X size={15}/></button></label>}
<button type="button" className="market-search-icon-button" aria-label={marketSearchOpen ? 'Close market search' : 'Search market'} onClick={() => setMarketSearchOpen(open => !open)}><Search size={18}/></button>
</div>
<div className="market-data-status">{marketTokensLoading || marketNetworksLoading ? "Loading live token prices and market data…" : marketNetworkError || "Live token prices and available DEX market metrics"}</div>
<div className="market-toolbar"><div className="market-category-list" role="tablist" aria-label="Market categories">
{['Hot','All tokens','Favorites','Gainers','Losers','Volume'].map(category => <button type="button" role="tab" aria-selected={marketCategory === category} className={marketCategory === category ? 'active' : ''} key={category} onClick={() => { setMarketCategory(category); if (category === 'Volume') setMarketSort('volume'); else if (category === 'Gainers' || category === 'Losers') setMarketSort('change'); else setMarketSort('market_cap'); }}>{category === 'Hot' && <Zap size={14}/>} {category === 'Favorites' && <Sparkles size={14}/>} {category === 'Gainers' && <ArrowUpRight size={14}/>} {category === 'Losers' && <ArrowDownLeft size={14}/>} {category}</button>)}
</div></div>
<div className="market-controls-row">
<button type="button" className="market-network-select" onClick={() => { setMarketNetworkSearch(''); setModal('market-network'); }} aria-haspopup="dialog" aria-label="Choose market network"><Globe2 size={15}/><span>{marketNetworkId === 'all' ? 'All networks' : marketNetworks.find(item => item.id === marketNetworkId)?.name || 'All networks'}</span><ChevronDown size={13}/></button>
<div className="market-range-wrap"><button type="button" className="market-range-select" aria-label="Select price change range" aria-expanded={marketTimeOpen} onClick={() => setMarketTimeOpen(open => !open)}><span>{marketTimeRange}</span><ChevronDown size={12}/></button>{marketTimeOpen && <div className="market-range-menu">{(['1h','24h','7d','30d'] as const).map(range => <button type="button" key={range} className={marketTimeRange === range ? 'active' : ''} onClick={() => { setMarketTimeRange(range); setMarketTimeOpen(false); }}>{range}</button>)}</div>}</div>
</div>
<MarketTable networks={marketNetworks} networkId={marketNetworkId} timeRange={marketTimeRange} category={marketCategory} search={marketSearch} sort={marketSort} metrics={marketMetrics} favorites={marketFavorites} loading={marketTokensLoading || marketNetworksLoading} error={marketNetworkError} onToggleFavorite={toggleMarketFavorite} />
</section> : activeTab === 'Activity' ? <section className="panel activity-panel activity-page"><div className="panel-heading"><div><h2>History</h2><p>Transactions submitted from this session</p></div><span className="market-placeholder-tag">ACTIVITY</span></div>{activity.length ? <div className="activity-list">{activity.map((item,i) => <div className="activity-row" key={item.hash+i}><div className="activity-icon"><ArrowUpRight size={17}/></div><div className="activity-info"><strong>Sent {item.chain.symbol}</strong><span>{item.time}</span></div><div className="activity-right"><span className="pending-pill">Submitted</span><a href={`${item.chain.explorer}/tx/${item.hash}`} target="_blank" rel="noreferrer" className="explorer-link">View transaction <ExternalLink size={12}/></a></div></div>)}</div> : <div className="market-empty">No activity yet. Submitted transactions will appear here.</div>}</section> : <>
{activeTab !== 'Overview' && activeTab !== 'Activity' && (
<div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> YOUR WEB3 HOME</div><h1>{activeTab === 'Overview' ? 'Your crypto, clearly.' : activeTab}</h1><p className="page-subtitle">{activeTab === 'Overview' ? 'One calm place to see and manage your digital assets.' : activeTab === 'Activity' ? 'Keep track of transactions submitted from this session.' : activeTab === 'Swap' ? 'Token swaps will be available in a future release.' : 'Discover onchain tools and apps in a future release.'}</p></div><button className="refresh-button" onClick={() => address ? void refreshBalance() : void connect()}><RefreshCw size={15} className={loading ? 'spin' : ''}/><span>{address ? 'Refresh' : 'Get started'}</span></button></div>
)}
<section className="sire-home-value-card" aria-label="Total account value">
<div className="sire-home-value-main">
<div className="sire-home-value-copy">
<div className="sire-home-value-card-top">
<span>NATIVE BALANCE</span>
<button type="button" className="sire-home-value-eye" aria-label={totalValueVisible ? "Hide balance" : "Show balance"} onClick={() => setTotalValueVisible(visible => !visible)}>
{totalValueVisible ? <Eye size={17} /> : <EyeOff size={17} />}
</button>
</div>
<div className="sire-home-value-amount">{totalValueVisible ? (balance === null ? '—' : `${balance.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${chain.symbol}`) : '••••••'}</div>
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
{marqueeChains.map(network => <button type="button" className="network-marquee-pill" key={network.id} onClick={() => { setNetworkSearch(''); setModal('network'); }} title={`Select ${network.name}`}>
<span className={`network-marquee-logo ${network.id === 1 ? 'ethereum' : network.id === 56 ? 'bnb' : network.id === 8453 ? 'base' : network.id === 137 ? 'polygon' : network.id === 42161 ? 'arbitrum' : network.id === 10 ? 'optimism' : ''}`}>{chainLogoUrl(network) && <img src={chainLogoUrl(network)} data-logo-candidates={JSON.stringify(chainLogoUrls(network))} data-logo-index="0" alt="" loading={copy === 0 ? 'eager' : 'lazy'} decoding="async" onLoad={event => { const fallback = event.currentTarget.nextElementSibling as HTMLElement | null; if (fallback) fallback.hidden = true; }} onError={handleChainLogoError} />}<span>{network.symbol.slice(0, 3)}</span></span>
<span>{network.name}</span>
</button>)}
</div>)}
</div>
</section>
<nav className="wallet-quick-actions" aria-label="Wallet actions">
<button type="button" className="wallet-quick-action" onClick={() => setModal('send')}><span className="wallet-quick-icon"><ArrowUpRight size={20} /></span><span>Send</span></button>
<button type="button" className="wallet-quick-action" onClick={() => setModal('receive')}><span className="wallet-quick-icon"><ArrowDownLeft size={20} /></span><span>Receive</span></button>
<button type="button" className="wallet-quick-action" onClick={() => setActiveTab('Activity')}><span className="wallet-quick-icon"><Activity size={20} /></span><span>History</span></button>
<button type="button" className="wallet-quick-more" aria-label="More options" onClick={() => setModal('network')}><MoreHorizontal size={23} /></button>
</nav>
{!address && <div className="connect-banner"><div className="banner-art"><div className="banner-orbit orbit-one"/><div className="banner-orbit orbit-two"/><div className="banner-coin"><Sparkles size={28}/></div></div><div className="banner-copy"><div className="banner-kicker">WELCOME TO NOVA</div><h2>Your assets. Your rules.</h2><p>Connect a browser wallet to see your onchain balance and get started. Nova never asks for your recovery phrase.</p><div className="banner-buttons"><button className="primary-button" onClick={() => setModal('wallet')}>Create / import wallet <ArrowUpRight size={16}/></button><button className="text-button" onClick={() => setModal('help')}>How it works <ExternalLink size={14}/></button></div></div><div className="banner-decoration">N<span>.</span></div></div>}
<section className="stats-grid">
<article className="stat-card"><div className="stat-top"><span>Active network</span><span className="stat-icon purple"><Globe2 size={17}/></span></div><div className="stat-main">{chain.name}</div><div className="stat-description"><span className="status-dot"/>{address ? 'Wallet connected to network' : 'Ready when you are'}</div><button className="card-link" onClick={() => setModal('network')}>Change network <ArrowUpRight size={14}/></button></article>
<article className="stat-card"><div className="stat-top"><span>Wallet status</span><span className="stat-icon green"><ShieldCheck size={17}/></span></div><div className="stat-main">{address ? 'Connected' : 'Not connected'}</div><div className="stat-description">{address ? shortAddress(address) : 'Connect your wallet to begin'}</div><button className="card-link" onClick={address ? copyAddress : connect}>{address ? 'Copy address' : 'Connect wallet'} <ArrowUpRight size={14}/></button></article>
</section>
<section className="content-grid">
<article className="panel assets-panel"><div className="panel-heading"><div><h2>Your assets</h2><p>Native token on the selected network</p></div><button className="panel-action" onClick={() => setModal('network')}>All networks <ChevronDown size={14}/></button></div><div className="asset-table"><div className="asset-header"><span>ASSET</span><span>BALANCE</span></div><div className="asset-row"><div className="asset-name"><div className="asset-icon" style={{ background: chain.color }}>{iconLetters[chain.symbol] || '◈'}</div><div><strong>{chain.symbol}</strong><span>{chain.name}</span></div></div><div className="asset-balance"><strong>{balance === null ? (address ? 'Loading…' : '—') : `${balance.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${chain.symbol}`}</strong><span>{hideBalance ? '••••••' : 'Native balance'}</span></div></div>{!address && <div className="empty-inline"><Wallet size={18}/><span>Connect a wallet to load your onchain assets.</span></div>}</div><div className="asset-footer"><span>Balances are read from public RPC endpoints.</span><button className="icon-button" onClick={() => address ? void refreshBalance() : void connect()} aria-label="Refresh assets"><RefreshCw size={15}/></button></div></article>
<article className="panel quick-panel"><div className="panel-heading"><div><h2>Quick actions</h2><p>Common wallet tasks, made simple</p></div><div className="quick-heading-icon"><Zap size={17}/></div></div><div className="quick-actions"><button className="quick-action" onClick={() => { if (!address) { void connect(); return; } setModal('send'); }}><span className="quick-icon send"><ArrowUpRight size={19}/></span><span><strong>Send</strong><small>Transfer crypto</small></span><ArrowUpRight size={15} className="quick-arrow"/></button><button className="quick-action" onClick={() => address ? setModal('receive') : void connect()}><span className="quick-icon receive"><ArrowDownLeft size={19}/></span><span><strong>Receive</strong><small>Share your address</small></span><ArrowUpRight size={15} className="quick-arrow"/></button><button className="quick-action" onClick={() => setNotice('Swap functionality is planned. No tokens have been exchanged.')}><span className="quick-icon swap"><ArrowLeftRight size={19}/></span><span><strong>Swap tokens</strong><small>Coming soon</small></span><span className="soon-tag">SOON</span></button><button className="quick-action" onClick={() => setModal('network')}><span className="quick-icon network"><Globe2 size={19}/></span><span><strong>Change network</strong><small>Explore supported chains</small></span><ArrowUpRight size={15} className="quick-arrow"/></button></div><div className="quick-note"><LockKeyhole size={15}/><span>Every transaction must be approved in your connected wallet.</span></div></article>
</section>
<section className="panel activity-panel"><div className="panel-heading"><div><h2>Recent activity</h2><p>Your latest transactions submitted through Nova</p></div><button className="panel-action" onClick={() => setActiveTab('Activity')}>View all <ArrowUpRight size={14}/></button></div>{activity.length ? <div className="activity-list">{activity.slice(0, 3).map((item, i) => <div className="activity-row" key={item.hash + i}><div className="activity-icon"><ArrowUpRight size={17}/></div><div className="activity-info"><strong>Sent {item.chain.symbol}</strong><span>{item.time}</span></div><div className="activity-right"><span className="pending-pill">Submitted</span><a href={`${item.chain.explorer}/tx/${item.hash}`} target="_blank" rel="noreferrer" className="explorer-link">View transaction <ExternalLink size={12}/></a></div></div>)}</div> : <div className="activity-empty"><div className="activity-empty-icon"><Activity size={20}/></div><div><strong>No activity yet</strong><p>{address ? 'Transactions you submit from this session will appear here.' : 'Connect your wallet to get started with your onchain activity.'}</p></div><button className="text-button" onClick={() => address ? setModal('send') : void connect()}>{address ? 'Send crypto' : 'Connect'} <ArrowUpRight size={14}/></button></div>}</section>
</>}
<footer className="footer"><div><span className="footer-logo"><Sparkles size={14}/> nova wallet</span><span>Built for clarity. Designed for you.</span></div><div className="footer-right"><span><span className="status-dot"/> Networks operational</span><button onClick={() => setModal('help')}>Security first <ShieldCheck size={13}/></button></div></footer>
</div>
</main>
<nav className={`bottom-navigation ${bottomNavVisible ? '' : 'nav-hidden'}`} aria-label="Main navigation" style={{ display: 'flex', position: 'fixed', left: '50%', bottom: 'calc(14px + env(safe-area-inset-bottom, 0px))', transform: bottomNavVisible ? 'translateX(-50%)' : 'translate(-50%, 160%)', zIndex: 9999, visibility: 'visible', opacity: 1, pointerEvents: bottomNavVisible ? 'auto' : 'none', width: 'min(92vw, 440px)', minHeight: 62, alignItems: 'center', justifyContent: 'space-around', borderRadius: 999, background: 'rgba(20, 20, 22, 0.96)', border: '1px solid rgba(255,255,255,0.13)', boxShadow: '0 8px 32px rgba(0,0,0,0.42), 0 1px 16px rgba(255,255,255,0.08)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', transition: 'transform 220ms ease' }}>
<button type="button" className={activeTab === 'Overview' ? 'active' : ''} aria-current={activeTab === 'Overview' ? 'page' : undefined} onClick={() => setActiveTab('Overview')}><Home size={20}/><span>Home</span></button>
<button type="button" className={activeTab === 'Market' ? 'active' : ''} aria-current={activeTab === 'Market' ? 'page' : undefined} onClick={() => setActiveTab('Market')}><TrendingUp size={20}/><span>Market</span></button>
<button type="button" className={activeTab === 'Activity' ? 'active' : ''} aria-current={activeTab === 'Activity' ? 'page' : undefined} onClick={() => setActiveTab('Activity')}><Activity size={20}/><span>History</span></button>
<button type="button" onClick={() => setModal('wallet')}><Wallet size={20}/><span>Wallet</span></button>
</nav>
{notice && <div className="toast" role="status"><span className="toast-dot"/><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss notification"><X size={16}/></button></div>}
{modal && <div className={`modal-backdrop ${modal === 'network' || modal === 'market-network' ? 'network-modal-backdrop' : ''}`} onClick={() => { setModal(null); setWalletDraftPrivateKey(''); setWalletPhrase(''); setWalletPassword(''); setWalletError(''); }}><section className={`modal-card ${modal === 'network' ? 'network-modal-card' : modal === 'market-network' ? 'market-network-drawer' : ''}`} onClick={e => e.stopPropagation()}>
<div className="modal-head"><div><span className="modal-eyebrow">NOVA WALLET</span><h2>{modal === 'market-network' ? 'Explore network tokens' : modal === 'network' ? 'Choose a network' : modal === 'send' ? 'Send crypto' : modal === 'receive' ? 'Receive crypto' : modal === 'wallet' ? 'Your wallet' : modal === 'create' ? 'Create a wallet' : modal === 'import' ? 'Import a wallet' : modal === 'unlock' ? 'Unlock your wallet' : 'Your security matters'}</h2></div><button className="icon-button" onClick={() => { setModal(null); setWalletDraftPrivateKey(''); setWalletPhrase(''); setWalletPassword(''); setWalletError(''); }} aria-label="Close dialog"><X size={19}/></button></div>
{modal === 'market-network' && <div className="market-network-drawer-content">
<label className="market-network-search"><Search size={17}/><input autoFocus value={marketNetworkSearch} onChange={event => setMarketNetworkSearch(event.target.value)} placeholder={`Search ${marketNetworks.length} supported EVM networks…`} aria-label="Search market networks"/>{marketNetworkSearch && <button type="button" onClick={() => setMarketNetworkSearch('')} aria-label="Clear search"><X size={15}/></button>}</label>
<div className="market-network-vertical-list">
{marketNetworks.filter(item => !marketNetworkSearch.trim() || item.name.toLowerCase().includes(marketNetworkSearch.trim().toLowerCase()) || item.symbol.toLowerCase().includes(marketNetworkSearch.trim().toLowerCase()) || item.id.includes(marketNetworkSearch.trim())).map(item => <button type="button" key={item.id} className={marketNetworkId === item.id ? 'active' : ''} onClick={() => { setMarketNetworkId(item.id); setModal(null); }}><span className="market-network-pill-logo">{item.logoURI && <img src={item.logoURI} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }}/>}<span>{item.symbol.slice(0,3)}</span></span><span className="market-network-vertical-copy"><strong>{item.name}</strong><small>{item.symbol} · EVM · Chain ID {item.chainId}</small></span>{marketNetworkId === item.id && <span className="market-network-selected">Selected</span>}</button>)}
</div>
{(marketNetworksLoading || marketNetworkError) && <div className="market-network-status">{marketNetworksLoading ? 'Loading LI.FI-supported EVM networks…' : marketNetworkError}<button type="button" onClick={() => window.location.reload()} disabled={marketNetworksLoading}>Retry</button></div>}
<p className="market-network-note">Networks are loaded from LI.FI's supported EVM chain directory. Token lists are not shown in this selector.</p>
</div>}{modal === 'network' && <><p className="modal-description">Choose a network for your wallet. Popular chains are ready below, and the searchable directory includes additional EVM networks. Your wallet will ask you to approve any network change.</p><div className="network-search-wrap"><Search size={16}/><input value={networkSearch} onChange={event => setNetworkSearch(event.target.value)} placeholder="Search by network, token, or chain ID…" aria-label="Search networks" /><span className="network-search-shortcut">⌕</span></div>{!networkSearch && <><div className="network-section-heading"><span>POPULAR NETWORKS</span><small>Quick switch</small></div><div className="network-quick-grid">{popularNetworkOptions.map(c => <button type="button" key={c.id} className={`network-quick-option ${chainId === c.id ? 'selected' : ''}`} onClick={() => void switchNetwork(c)}><span className="network-quick-logo" style={{ background: c.color }}>{chainLogoUrl(c) && <img src={chainLogoUrl(c)} data-logo-candidates={JSON.stringify(chainLogoUrls(c))} data-logo-index="0" alt="" decoding="async" onLoad={event => { const fallback = event.currentTarget.nextElementSibling as HTMLElement | null; if (fallback) fallback.hidden = true; }} onError={handleChainLogoError} />}<span>{iconLetters[c.symbol] || c.symbol.slice(0, 3)}</span></span><span>{c.name}</span>{chainId === c.id && <span className="network-quick-check">✓</span>}</button>)}</div></>}{networkListLoading && <p className="network-loading">Refreshing network directory…</p>}<div className="network-section-heading network-directory-heading"><span>{networkSearch ? 'SEARCH RESULTS' : 'ALL NETWORKS'}</span><small>{visibleNetworkOptions.length}{networkSearch ? ' matches' : ' available'}</small></div><div className="network-list">{visibleNetworkOptions.map(c => <button className={`network-option ${chainId === c.id ? 'selected' : ''}`} key={c.id} onClick={() => void switchNetwork(c)}><span className="asset-icon network-option-logo" style={{ background: c.color }}>{chainLogoUrl(c) && <img src={chainLogoUrl(c)} data-logo-candidates={JSON.stringify(chainLogoUrls(c))} data-logo-index="0" alt="" decoding="async" onLoad={event => { const fallback = event.currentTarget.nextElementSibling as HTMLElement | null; if (fallback) fallback.hidden = true; }} onError={handleChainLogoError} />}<span>{iconLetters[c.symbol] || c.symbol.slice(0, 3)}</span></span><span className="network-option-text"><strong>{c.name}</strong><small>{c.label} · Chain ID {c.id}</small></span>{chainId === c.id ? <span className="current-tag">CURRENT</span> : <ArrowUpRight size={16}/>}</button>)}{visibleNetworkOptions.length === 0 && <p className="network-loading">No networks match that search. Try a symbol such as APE or a numeric chain ID.</p>}</div></>}
{modal === 'send' && <><p className="modal-description">Send native {chain.symbol} on {chain.name}. Check the address and network carefully before confirming in your wallet.</p><label className="form-label">Recipient address</label><input className="form-input" placeholder="0x…" value={sendTo} onChange={e => setSendTo(e.target.value)} autoComplete="off"/><label className="form-label">Amount ({chain.symbol})</label><input className="form-input" type="number" min="0" step="any" placeholder="0.00" value={sendAmount} onChange={e => setSendAmount(e.target.value)}/><div className="form-warning"><ShieldCheck size={16}/><span>Nova will never ask for your seed phrase. Your wallet provider will display the final transaction for approval.</span></div><button className="primary-button full-button" onClick={() => void send()}>Continue to wallet <ArrowUpRight size={16}/></button></>}
{modal === 'receive' && <><p className="modal-description">Share your public wallet address to receive assets on the selected network.</p><div className="receive-card"><div className="receive-chain"><span className="chain-dot" style={{ background: chain.color }}/>{chain.name} <span className="receive-symbol">{chain.symbol}</span></div><div className="receive-address">{address}</div><button className="primary-button full-button" onClick={() => void copyAddress()}><Copy size={16}/> Copy address</button></div><div className="form-warning"><CircleHelp size={16}/><span>Only send assets compatible with this network to this address. Sending on the wrong network can result in permanent loss.</span></div></>}
{modal === 'wallet' && <><p className="modal-description">Create a new self-custody wallet or import an existing recovery phrase. Your encrypted wallet is stored only in this browser.{hasStoredWallet ? ' Creating or importing another wallet will replace the locally saved wallet, so keep your existing recovery phrase backed up.' : ''}</p><div className="wallet-choice-grid"><button type="button" className="wallet-choice" onClick={() => { setWalletError(''); setWalletPhrase(''); setWalletDraftPrivateKey(''); setWalletPassword(''); setModal('create'); }}><span className="wallet-choice-icon"><Sparkles size={19}/></span><strong>Create new wallet</strong><small>Generate a new recovery phrase</small></button><button type="button" className="wallet-choice" onClick={() => { setWalletError(''); setWalletImportPhrase(''); setWalletPassword(''); setModal('import'); }}><span className="wallet-choice-icon"><ArrowDownLeft size={19}/></span><strong>Import wallet</strong><small>Use an existing recovery phrase</small></button></div><div className="form-warning"><LockKeyhole size={16}/><span>Never share your recovery phrase. Nova cannot recover it if you lose it.</span></div>{hasStoredWallet && <button className="primary-button full-button" onClick={() => { setWalletPassword(''); setWalletError(''); setModal('unlock'); }}>Unlock saved wallet</button>}</>}
{modal === 'create' && <><p className="modal-description">Generate a new wallet locally. Write down the recovery phrase and keep it private before continuing.</p>{!walletPhrase ? <button className="primary-button full-button" onClick={() => { const fresh = EthersWallet.createRandom(); setWalletPhrase(fresh.mnemonic?.phrase || ''); setWalletDraftPrivateKey(fresh.privateKey); setWalletError(''); }}>Generate recovery phrase <Sparkles size={16}/></button> : <><div className="wallet-recovery-phrase">{walletPhrase.split(' ').map((word,index) => <span key={index}><small>{index+1}</small>{word}</span>)}</div><div className="form-warning"><ShieldCheck size={16}/><span>Anyone with this phrase can control this wallet. Store it offline and do not send it to anyone.</span></div><label className="form-label">Create encryption password (8+ characters)</label><input className="form-input" type="password" autoComplete="new-password" value={walletPassword} onChange={event => setWalletPassword(event.target.value)} placeholder="Choose a strong password"/><button className="primary-button full-button" disabled={walletBusy} onClick={() => void (async () => { if(walletPassword.length<8){setWalletError('Use a password with at least 8 characters.');return;} setWalletBusy(true);setWalletError('');try{const wallet=new EthersWallet(walletDraftPrivateKey);const encrypted=await wallet.encrypt(walletPassword);localStorage.setItem('nova-wallet-keystore',encrypted);setHasStoredWallet(true);localStorage.setItem('nova-wallet-address',wallet.address);setPrivateKey(wallet.privateKey);setWalletDraftPrivateKey('');setAddress(wallet.address);setBalance(null);setModal(null);setWalletPhrase('');setWalletPassword('');setNotice('Wallet created and encrypted on this device. Back up your recovery phrase securely.');}catch{setWalletError('Could not encrypt the wallet. Try again with a different password.');}finally{setWalletBusy(false);}})()}>{walletBusy?'Encrypting wallet…':'Secure wallet and continue'} <ArrowRight size={16}/></button></>}{walletError && <p className="wallet-error" role="alert">{walletError}</p>}</>}
{modal === 'import' && <><p className="modal-description">Import an existing EVM wallet using its 12- or 24-word recovery phrase. The phrase is processed locally in your browser.</p><label className="form-label">Recovery phrase</label><textarea className="form-input wallet-phrase-input" rows={3} autoComplete="off" spellCheck={false} value={walletImportPhrase} onChange={event => setWalletImportPhrase(event.target.value)} placeholder="Enter your recovery phrase separated by spaces"/><label className="form-label">Create encryption password (8+ characters)</label><input className="form-input" type="password" autoComplete="new-password" value={walletPassword} onChange={event => setWalletPassword(event.target.value)} placeholder="Choose a strong password"/><button className="primary-button full-button" disabled={walletBusy} onClick={() => void (async () => { if(walletPassword.length<8){setWalletError('Use a password with at least 8 characters.');return;}setWalletBusy(true);setWalletError('');try{const wallet=EthersWallet.fromPhrase(walletImportPhrase.trim().replace(/\s+/g,' '));const encrypted=await wallet.encrypt(walletPassword);localStorage.setItem('nova-wallet-keystore',encrypted);setHasStoredWallet(true);localStorage.setItem('nova-wallet-address',wallet.address);setPrivateKey(wallet.privateKey);setAddress(wallet.address);setBalance(null);setModal(null);setWalletImportPhrase('');setWalletPassword('');setNotice('Wallet imported and encrypted on this device.');}catch{setWalletError('That recovery phrase is invalid or could not be imported. Check the words and try again.');}finally{setWalletBusy(false);}})()}>{walletBusy?'Importing wallet…':'Import and secure wallet'} <ArrowRight size={16}/></button>{walletError && <p className="wallet-error" role="alert">{walletError}</p>}</>}
{modal === 'unlock' && <><p className="modal-description">Enter the password you chose when saving this wallet on this device.</p><label className="form-label">Wallet password</label><input className="form-input" type="password" autoComplete="current-password" value={walletPassword} onChange={event => setWalletPassword(event.target.value)} placeholder="Wallet password"/><button className="primary-button full-button" disabled={walletBusy} onClick={() => void (async () => {setWalletBusy(true);setWalletError('');try{const encrypted=localStorage.getItem('nova-wallet-keystore');if(!encrypted)throw new Error('No saved wallet');const wallet=await EthersWallet.fromEncryptedJson(encrypted,walletPassword);setPrivateKey(wallet.privateKey);setAddress(wallet.address);setBalance(null);setModal(null);setWalletPassword('');setNotice('Wallet unlocked.');}catch{setWalletError('Incorrect password or saved wallet could not be opened.');}finally{setWalletBusy(false);}})()}>{walletBusy?'Unlocking…':'Unlock wallet'} <ArrowRight size={16}/></button>{walletError && <p className="wallet-error" role="alert">{walletError}</p>}</>}
{modal === 'help' && <><p className="modal-description">Nova is an early web-wallet interface. Your safety comes first.</p><div className="security-list"><div><ShieldCheck size={18}/><span><strong>Your keys stay with your wallet</strong><small>Wallet keys are encrypted with your password and saved in this browser. Keep your recovery phrase offline.</small></span></div><div><LockKeyhole size={18}/><span><strong>Review every transaction</strong><small>Always check the network, destination, amount and fee in your wallet confirmation window.</small></span></div><div><Globe2 size={18}/><span><strong>Public blockchain data</strong><small>Balances are fetched from public RPC endpoints. </small></span></div></div><button className="primary-button full-button" onClick={() => { setModal(null); setWalletDraftPrivateKey(''); setWalletPhrase(''); setWalletPassword(''); setWalletError(''); }}>Got it</button></>}
</section></div>}
</div>;
}
export default App;