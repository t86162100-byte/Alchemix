import { useEffect, useState } from 'react';
import { Activity, ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, Bell, ChevronDown, CircleHelp, Eye, EyeOff, Globe2, Home, LockKeyhole, Search, Settings2, ShieldCheck, Sparkles, TrendingUp, Wallet, X } from 'lucide-react';
import { createWalletDraft, importWalletDraft, unlockWallet } from './core/wallet/walletService';
import { readKeystore, writeKeystore } from './core/wallet/secureStore';
import { loadEvmNetworks, estimateNativeTransfer, readNetworkHealth, readNetworkSnapshot, type EvmNetwork, type NetworkSnapshot, type TransferEstimate } from './core/chain/evmService';
import { readSolanaSnapshot, type SolanaSnapshot } from './core/chain/solanaService';
import { readTronSnapshot, type TronSnapshot } from './core/chain/tronService';
import { readBitcoinSnapshot, type BitcoinSnapshot } from './core/chain/bitcoinService';
import type { TonSnapshot } from './core/chain/tonService';

type Tab = 'Overview' | 'Market' | 'Activity' | 'Wallet' | 'Swap' | 'Explore';
type Modal = 'wallet' | 'create' | 'import' | 'unlock' | 'help' | null;
const navItems: Array<{name: Tab; label: string; icon: typeof Home}> = [
  { name: 'Overview', label: 'Overview', icon: Home },
  { name: 'Market', label: 'Market', icon: TrendingUp },
  { name: 'Activity', label: 'Activity', icon: Activity },
  { name: 'Swap', label: 'Swap', icon: ArrowLeftRight },
  { name: 'Explore', label: 'Explore', icon: Globe2 },
];

type CuratedNetwork = { name: string; aliases: string[]; family: 'EVM' | 'Other' };
const CURATED_NETWORKS: CuratedNetwork[] = [
  { name: 'BNB Chain', aliases: ['bnb smart chain', 'binance smart chain', 'bnb chain', '56'], family: 'EVM' },
  { name: 'Ethereum', aliases: ['ethereum mainnet', 'ethereum', '1'], family: 'EVM' },
  { name: 'Arc', aliases: ['arc'], family: 'EVM' },
  { name: 'Solana', aliases: [], family: 'Other' },
  { name: 'Tron', aliases: [], family: 'Other' },
  { name: 'HyperEVM', aliases: ['hyperevm'], family: 'EVM' },
  { name: 'Bitcoin', aliases: [], family: 'Other' },
  { name: 'Robinhood', aliases: ['robinhood chain', '4663'], family: 'EVM' },
  { name: 'Base', aliases: ['base mainnet', 'base', '8453'], family: 'EVM' },
  { name: 'Polygon(Matic)', aliases: ['polygon mainnet', 'polygon pos', 'matic mainnet', 'polygon'], family: 'EVM' },
  { name: 'Ton', aliases: [], family: 'Other' },
  { name: 'Plasma', aliases: ['plasma'], family: 'EVM' },
  { name: 'Stellar', aliases: [], family: 'Other' },
  { name: 'Mantle', aliases: ['mantle'], family: 'EVM' },
  { name: 'Aptos', aliases: [], family: 'Other' },
  { name: 'ENI', aliases: ['eni'], family: 'EVM' },
  { name: 'Optimism', aliases: ['optimism', 'op mainnet'], family: 'EVM' },
  { name: 'BOT Chain', aliases: ['bot chain'], family: 'EVM' },
  { name: 'Anubis', aliases: ['anubis'], family: 'EVM' },
  { name: 'Linea', aliases: ['linea'], family: 'EVM' },
  { name: 'Berachain', aliases: ['berachain'], family: 'EVM' },
  { name: 'MegaETH', aliases: ['megaeth'], family: 'EVM' },
  { name: 'Mova', aliases: ['mova'], family: 'EVM' },
  { name: 'zkSync Era', aliases: ['zksync era'], family: 'EVM' },
  { name: 'Cosmos', aliases: [], family: 'Other' },
  { name: 'smartBCH', aliases: ['smartbch'], family: 'EVM' },
  { name: 'Ethereum Classic', aliases: ['ethereum classic'], family: 'EVM' },
  { name: 'Doge', aliases: [], family: 'Other' },
  { name: 'opBNB', aliases: ['opbnb'], family: 'EVM' },
  { name: 'Kaia', aliases: ['kaia'], family: 'EVM' },
  { name: 'Core', aliases: ['core blockchain', 'core dao', 'core'], family: 'EVM' },
  { name: 'Celo', aliases: ['celo'], family: 'EVM' },
  { name: 'Scroll', aliases: ['scroll'], family: 'EVM' },
  { name: 'Morph', aliases: ['morph'], family: 'EVM' },
  { name: 'XRPL', aliases: [], family: 'Other' },
  { name: 'Monad', aliases: ['monad'], family: 'EVM' },
  { name: 'Ink', aliases: ['ink'], family: 'EVM' },
  { name: 'SUI', aliases: [], family: 'Other' },
  { name: 'Avalanche-C', aliases: ['avalanche c-chain', 'avalanche mainnet', 'avalanche'], family: 'EVM' },
  { name: 'Arbitrum', aliases: ['arbitrum one', 'arbitrum'], family: 'EVM' },
  { name: 'MakaChain', aliases: ['makachain'], family: 'EVM' },
  { name: 'HyperLiquid L1', aliases: [], family: 'Other' },
  { name: 'Sonic', aliases: ['sonic'], family: 'EVM' },
  { name: 'X Layer', aliases: ['x layer', 'okx x layer'], family: 'EVM' },
  { name: 'Sei EVM', aliases: ['sei evm', 'sei network'], family: 'EVM' },
  { name: '0G Mainnet', aliases: ['0g mainnet', '16661'], family: 'EVM' },
  { name: 'Abstract', aliases: ['abstract', '2741'], family: 'EVM' },
  { name: 'Apechain', aliases: ['apechain', '33139'], family: 'EVM' },
  { name: 'Arbitrum Nova', aliases: ['arbitrum nova', '42170'], family: 'EVM' },
  { name: 'Arbitrum Sepolia Testnet', aliases: ['arbitrum sepolia', '421614'], family: 'EVM' },
  { name: 'Arc Testnet', aliases: ['arc testnet', '5042002'], family: 'EVM' },
  { name: 'Base Sepolia Testnet', aliases: ['base sepolia', '84532'], family: 'EVM' },
  { name: 'Blast', aliases: ['blast', '81457'], family: 'EVM' },
  { name: 'BOB', aliases: ['bob', '60808'], family: 'EVM' },
  { name: 'Boba', aliases: ['boba', '288'], family: 'EVM' },
  { name: 'Cronos', aliases: ['cronos', '25'], family: 'EVM' },
  { name: 'Ethereum Sepolia Testnet', aliases: ['ethereum sepolia', '11155111'], family: 'EVM' },
  { name: 'Etherlink', aliases: ['etherlink', '42793'], family: 'EVM' },
  { name: 'Flare', aliases: ['flare', '14'], family: 'EVM' },
  { name: 'Flow', aliases: ['flow evm', '747'], family: 'EVM' },
  { name: 'Fraxtal', aliases: ['fraxtal', '252'], family: 'EVM' },
  { name: 'FUSE', aliases: ['fuse', '122'], family: 'EVM' },
  { name: 'Gnosis', aliases: ['gnosis', '100'], family: 'EVM' },
  { name: 'Gravity', aliases: ['gravity', '1625'], family: 'EVM' },
  { name: 'Hemi', aliases: ['hemi', '43111'], family: 'EVM' },
  { name: 'Hyperliquid', aliases: ['hyperliquid', '1337'], family: 'EVM' },
  { name: 'Immutable zkEVM', aliases: ['immutable zkevm', '13371'], family: 'EVM' },
  { name: 'Injective', aliases: ['injective', '1776'], family: 'EVM' },
  { name: 'Katana', aliases: ['katana', '747474'], family: 'EVM' },
  { name: 'Lens', aliases: ['lens', '232'], family: 'EVM' },
  { name: 'Lighter', aliases: ['lighter', '3586256'], family: 'EVM' },
  { name: 'Lisk', aliases: ['lisk', '1135'], family: 'EVM' },
  { name: 'Metis', aliases: ['metis', '1088'], family: 'EVM' },
  { name: 'Mode', aliases: ['mode', '34443'], family: 'EVM' },
  { name: 'OP Sepolia Testnet', aliases: ['op sepolia', '11155420'], family: 'EVM' },
  { name: 'Pharos Mainnet', aliases: ['pharos mainnet', '1672'], family: 'EVM' },
  { name: 'Plume', aliases: ['plume', '98866'], family: 'EVM' },
  { name: 'Ronin', aliases: ['ronin', '2020'], family: 'EVM' },
  { name: 'Rootstock', aliases: ['rootstock', '30'], family: 'EVM' },
  { name: 'Somnia', aliases: ['somnia', '5031'], family: 'EVM' },
  { name: 'Soneium', aliases: ['soneium', '1868'], family: 'EVM' },
  { name: 'Stable', aliases: ['stable', '988'], family: 'EVM' },
  { name: 'Telos', aliases: ['telos', '40'], family: 'EVM' },
  { name: 'Tempo', aliases: ['tempo', '4217'], family: 'EVM' },
  { name: 'Unichain', aliases: ['unichain', '130'], family: 'EVM' },
  { name: 'Vana', aliases: ['vana', '1480'], family: 'EVM' },
  { name: 'Viction', aliases: ['viction', '88'], family: 'EVM' },
  { name: 'World Chain', aliases: ['world chain', '480'], family: 'EVM' },
  { name: 'XDC', aliases: ['xdc', '50'], family: 'EVM' },
  { name: 'zkSync', aliases: ['zksync', '324'], family: 'EVM' },

];
const networkMatchesEntry = (network: EvmNetwork, entry: CuratedNetwork) => {
  const networkName = network.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const aliases = entry.aliases.map(alias => alias.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim());
  // Keep testnets distinct from similarly named mainnets (for example Arc vs Arc Testnet).
  const networkIsTestnet = /\btestnet\b|\bsepolia\b/.test(networkName);
  const entryIsTestnet = /\btestnet\b|\bsepolia\b/.test(entry.name.toLowerCase());
  if (networkIsTestnet !== entryIsTestnet) return false;
  return aliases.some(alias => /^\d+$/.test(alias) ? String(network.chainId) === alias : networkName === alias || networkName.startsWith(`${alias} mainnet`) || networkName.startsWith(`${alias} network`));
};


const shortAddress = (value: string) => value ? value.slice(0, 6) + '…' + value.slice(-4) : '';
const formatEthForDisplay = (value: string) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Unavailable';
  const formatted = amount.toLocaleString('en-US', { maximumFractionDigits: 8 });
  return amount > 0 && Number(formatted.replace(/,/g, '')) === 0 ? '<0.00000001' : formatted;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [mobileNav, setMobileNav] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [address, setAddress] = useState('');
  const [unlockedWallet, setUnlockedWallet] = useState<Awaited<ReturnType<typeof unlockWallet>> | null>(null);
  const [keystoreExists, setKeystoreExists] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [password, setPassword] = useState('');
  const [phrase, setPhrase] = useState('');
  const [importPhrase, setImportPhrase] = useState('');
  const [showPhrase, setShowPhrase] = useState(false);
  const [confirmedBackup, setConfirmedBackup] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [totalValueVisible, setTotalValueVisible] = useState(true);
  const [networks, setNetworks] = useState<EvmNetwork[]>([]);
  const [registryLoading, setRegistryLoading] = useState(true);
  const [registryError, setRegistryError] = useState('');
  const [networkDrawerOpen, setNetworkDrawerOpen] = useState(false);
  const [networkDrawerSearch, setNetworkDrawerSearch] = useState('');
  const [networkDrawerCategory, setNetworkDrawerCategory] = useState<'All' | 'EVM' | 'Other'>('All');
  const [selectedNetworkKey, setSelectedNetworkKey] = useState('');
  const [selectedOtherNetwork, setSelectedOtherNetwork] = useState('');
  const [activeMnemonicPhrase, setActiveMnemonicPhrase] = useState('');
  const [solanaSnapshot, setSolanaSnapshot] = useState<SolanaSnapshot | null>(null);
  const [tronSnapshot, setTronSnapshot] = useState<TronSnapshot | null>(null);
  const [bitcoinSnapshot, setBitcoinSnapshot] = useState<BitcoinSnapshot | null>(null);
  const [tonSnapshot, setTonSnapshot] = useState<TonSnapshot | null>(null);
  const [networkSnapshot, setNetworkSnapshot] = useState<NetworkSnapshot | null>(null);
  const [networkStatus, setNetworkStatus] = useState<'idle' | 'loading' | 'connected' | 'error'>('idle');
  const [networkError, setNetworkError] = useState('');
  const [activeRpcUrl, setActiveRpcUrl] = useState('');
  const [txRecipient, setTxRecipient] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txEstimate, setTxEstimate] = useState<TransferEstimate | null>(null);
  const [txError, setTxError] = useState('');
  const [txBusy, setTxBusy] = useState(false);
  const selectedNetwork = selectedOtherNetwork ? undefined : networks.find(network => network.key === selectedNetworkKey);
  const selectedCuratedEntry = selectedOtherNetwork ? CURATED_NETWORKS.find(entry => entry.name === selectedOtherNetwork) : selectedNetwork ? CURATED_NETWORKS.find(entry => networkMatchesEntry(selectedNetwork, entry)) : undefined;
  const selectedChainAddress = selectedOtherNetwork === 'Solana' ? (solanaSnapshot?.address ?? '') : selectedOtherNetwork === 'Tron' ? (tronSnapshot?.address ?? '') : selectedOtherNetwork === 'Bitcoin' ? (bitcoinSnapshot?.address ?? '') : selectedOtherNetwork === 'Ton' ? (tonSnapshot?.address ?? '') : address;
  const visibleCuratedNetworks = CURATED_NETWORKS.filter(entry => {
    const matchesCategory = networkDrawerCategory === 'All' || entry.family === networkDrawerCategory;
    const matchesSearch = entry.name.toLowerCase().includes(networkDrawerSearch.trim().toLowerCase());
    return matchesCategory && matchesSearch;
  });
  const networkForEntry = (entry: CuratedNetwork) => networks.find(network => networkMatchesEntry(network, entry));

  useEffect(() => {
    let cancelled = false;
    readKeystore().then(value => { if (!cancelled) { setKeystoreExists(Boolean(value)); setStorageReady(true); } })
      .catch(() => { if (!cancelled) setNotice('Secure browser storage is unavailable. Wallet setup cannot continue until storage is available.'); });
    return () => { cancelled = true; };
  }, []);

  const refreshNetwork = async () => {
    if (selectedOtherNetwork === 'Ton') {
      if (!activeMnemonicPhrase) { setNetworkStatus('error'); setNetworkError('Unlock the wallet with its recovery phrase to derive the TON account.'); return; }
      setNetworkStatus('loading'); setNetworkError('');
      try { const snapshot = await (await import('./core/chain/tonService')).readTonSnapshot(activeMnemonicPhrase); setTonSnapshot(snapshot); setActiveRpcUrl(snapshot.apiUrl); setNetworkStatus('connected'); }
      catch (e) { setTonSnapshot(null); setNetworkStatus('error'); setNetworkError(e instanceof Error ? e.message : 'Could not read the TON balance.'); }
      return;
    }
    if (selectedOtherNetwork === 'Bitcoin') {
      if (!activeMnemonicPhrase) { setNetworkStatus('error'); setNetworkError('Unlock the wallet with its recovery phrase to derive the Bitcoin account.'); return; }
      setNetworkStatus('loading'); setNetworkError('');
      try { const snapshot = await readBitcoinSnapshot(activeMnemonicPhrase); setBitcoinSnapshot(snapshot); setActiveRpcUrl(snapshot.apiUrl); setNetworkStatus('connected'); }
      catch (e) { setBitcoinSnapshot(null); setNetworkStatus('error'); setNetworkError(e instanceof Error ? e.message : 'Could not read the Bitcoin balance.'); }
      return;
    }
    if (selectedOtherNetwork === 'Tron') {
      if (!activeMnemonicPhrase) { setNetworkStatus('error'); setNetworkError('Unlock the wallet with its recovery phrase to derive the Tron account.'); return; }
      setNetworkStatus('loading'); setNetworkError('');
      try { const snapshot = await readTronSnapshot(activeMnemonicPhrase); setTronSnapshot(snapshot); setActiveRpcUrl(snapshot.apiUrl); setNetworkStatus('connected'); }
      catch (e) { setTronSnapshot(null); setNetworkStatus('error'); setNetworkError(e instanceof Error ? e.message : 'Could not read the Tron balance.'); }
      return;
    }
    if (selectedOtherNetwork === 'Solana') {
      if (!activeMnemonicPhrase) { setNetworkStatus('error'); setNetworkError('Unlock this wallet with its recovery phrase available to derive the Solana account.'); return; }
      setNetworkStatus('loading'); setNetworkError('');
      try { const snapshot = await readSolanaSnapshot(activeMnemonicPhrase); setSolanaSnapshot(snapshot); setActiveRpcUrl(snapshot.rpcUrl); setNetworkStatus('connected'); }
      catch (e) { setSolanaSnapshot(null); setNetworkStatus('error'); setNetworkError(e instanceof Error ? e.message : 'Could not read the Solana balance.'); }
      return;
    }
    if (!selectedNetwork) { setNetworkError('Wait for the network registry to load.'); return; }
    setActiveRpcUrl('');
    if (!address) {
      setNetworkSnapshot(null);
      setNetworkStatus('loading');
      setNetworkError('');
      try {
        const health = await readNetworkHealth(selectedNetwork);
        setActiveRpcUrl(health.rpcUrl);
        setNetworkStatus('connected');
      } catch (e) {
        setNetworkStatus('error');
        setNetworkError(e instanceof Error ? e.message : 'Could not connect to the selected blockchain RPC.');
      }
      return;
    }
    setNetworkStatus('loading');
    setNetworkError('');
    try {
      const snapshot = await readNetworkSnapshot(selectedNetwork, address);
      setNetworkSnapshot(snapshot);
      setActiveRpcUrl(snapshot.rpcUrl);
      setNetworkStatus('connected');
    } catch (e) {
      setNetworkSnapshot(null);
      setNetworkStatus('error');
      setNetworkError(e instanceof Error ? e.message : 'Could not connect to the selected blockchain RPC.');
    }
  };

  useEffect(() => {
    let cancelled = false;
    loadEvmNetworks().then(loaded => {
      if (!cancelled) {
        const curatedLoaded = loaded.filter(network => CURATED_NETWORKS.some(entry => entry.family === 'EVM' && networkMatchesEntry(network, entry)));
        setNetworks(curatedLoaded);
        setSelectedNetworkKey(current => current && curatedLoaded.some(network => network.key === current) ? current : (curatedLoaded.find(network => network.chainId === 1)?.key ?? curatedLoaded[0]?.key ?? ''));
        setRegistryError('');
        setRegistryLoading(false);
      }
    }).catch(e => {
      if (!cancelled) { setRegistryError(e instanceof Error ? e.message : 'Could not load the EVM network registry.'); setRegistryLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (selectedOtherNetwork === 'Ton') {
      setNetworkStatus('loading'); setNetworkError(''); setNetworkSnapshot(null); setActiveRpcUrl(''); setTonSnapshot(null); setBitcoinSnapshot(null); setTronSnapshot(null); setSolanaSnapshot(null);
      if (!activeMnemonicPhrase) { setNetworkStatus('error'); setNetworkError('Unlock the wallet with its recovery phrase to derive the TON account.'); return () => { cancelled = true; }; }
      import('./core/chain/tonService').then(({ readTonSnapshot }) => readTonSnapshot(activeMnemonicPhrase)).then(snapshot => {
        if (!cancelled) { setTonSnapshot(snapshot); setActiveRpcUrl(snapshot.apiUrl); setNetworkStatus('connected'); }
      }).catch(e => { if (!cancelled) { setTonSnapshot(null); setNetworkStatus('error'); setNetworkError(e instanceof Error ? e.message : 'Could not read the TON balance.'); } });
      return () => { cancelled = true; };
    }
    setTonSnapshot(null);
    if (selectedOtherNetwork === 'Bitcoin') {
      setNetworkStatus('loading'); setNetworkError(''); setNetworkSnapshot(null); setActiveRpcUrl(''); setBitcoinSnapshot(null); setTronSnapshot(null); setSolanaSnapshot(null);
      if (!activeMnemonicPhrase) { setNetworkStatus('error'); setNetworkError('Unlock the wallet with its recovery phrase to derive the Bitcoin account.'); return () => { cancelled = true; }; }
      readBitcoinSnapshot(activeMnemonicPhrase).then(snapshot => {
        if (!cancelled) { setBitcoinSnapshot(snapshot); setActiveRpcUrl(snapshot.apiUrl); setNetworkStatus('connected'); }
      }).catch(e => { if (!cancelled) { setBitcoinSnapshot(null); setNetworkStatus('error'); setNetworkError(e instanceof Error ? e.message : 'Could not read the Bitcoin balance.'); } });
      return () => { cancelled = true; };
    }
    setBitcoinSnapshot(null);
    if (selectedOtherNetwork === 'Tron') {
      setNetworkStatus('loading'); setNetworkError(''); setNetworkSnapshot(null); setActiveRpcUrl(''); setTronSnapshot(null); setSolanaSnapshot(null);
      if (!activeMnemonicPhrase) { setNetworkStatus('error'); setNetworkError('Unlock the wallet with its recovery phrase to derive the Tron account.'); return () => { cancelled = true; }; }
      readTronSnapshot(activeMnemonicPhrase).then(snapshot => {
        if (!cancelled) { setTronSnapshot(snapshot); setActiveRpcUrl(snapshot.apiUrl); setNetworkStatus('connected'); }
      }).catch(e => { if (!cancelled) { setTronSnapshot(null); setNetworkStatus('error'); setNetworkError(e instanceof Error ? e.message : 'Could not read the Tron balance.'); } });
      return () => { cancelled = true; };
    }
    setTronSnapshot(null);
    if (selectedOtherNetwork === 'Solana') {
      setNetworkStatus('loading'); setNetworkError(''); setNetworkSnapshot(null); setActiveRpcUrl(''); setSolanaSnapshot(null);
      if (!activeMnemonicPhrase) { setNetworkStatus('error'); setNetworkError('Unlock the wallet with its recovery phrase to derive its Solana address.'); return () => { cancelled = true; }; }
      readSolanaSnapshot(activeMnemonicPhrase).then(snapshot => {
        if (!cancelled) { setSolanaSnapshot(snapshot); setActiveRpcUrl(snapshot.rpcUrl); setNetworkStatus('connected'); }
      }).catch(e => { if (!cancelled) { setSolanaSnapshot(null); setNetworkStatus('error'); setNetworkError(e instanceof Error ? e.message : 'Could not read the Solana balance.'); } });
      return () => { cancelled = true; };
    }
    setSolanaSnapshot(null);
    if (!selectedNetwork) { setNetworkStatus('idle'); setNetworkSnapshot(null); setActiveRpcUrl(''); return () => { cancelled = true; }; }
    setNetworkStatus('loading');
    setNetworkError('');
    setActiveRpcUrl('');
    if (!address) {
      setNetworkSnapshot(null);
      readNetworkHealth(selectedNetwork).then(health => {
        if (!cancelled) { setActiveRpcUrl(health.rpcUrl); setNetworkStatus('connected'); }
      }).catch(e => {
        if (!cancelled) {
          setNetworkStatus('error');
          setNetworkError(e instanceof Error ? e.message : 'Could not connect to the selected blockchain RPC.');
        }
      });
    } else {
      readNetworkSnapshot(selectedNetwork, address).then(snapshot => {
        if (!cancelled) {
          setNetworkSnapshot(snapshot);
          setActiveRpcUrl(snapshot.rpcUrl);
          setNetworkStatus('connected');
        }
      }).catch(e => {
        if (!cancelled) {
          setNetworkSnapshot(null);
          setNetworkStatus('error');
          setNetworkError(e instanceof Error ? e.message : 'Could not connect to the selected blockchain RPC.');
        }
      });
    }
    return () => { cancelled = true; };
  }, [address, activeMnemonicPhrase, selectedOtherNetwork, selectedNetworkKey, selectedNetwork]);

  const prepareTransfer = async () => {
    setTxBusy(true);
    setTxError('');
    setTxEstimate(null);
    try {
      if (!address) throw new Error('Unlock your wallet before preparing a transfer.');
      if (!selectedNetwork) throw new Error('Wait for the network registry to load.');
      const estimate = await estimateNativeTransfer(selectedNetwork, address, txRecipient, txAmount);
      setTxEstimate(estimate);
    } catch (e) {
      setTxError(e instanceof Error ? e.message : 'Could not estimate this transfer.');
    } finally {
      setTxBusy(false);
    }
  };

  const closeModal = () => {
    setModal(null); setError(''); setPassword(''); setPhrase(''); setImportPhrase('');
    setShowPhrase(false); setConfirmedBackup(false); setReplaceExisting(false);
  };
  const startCreate = async () => {
    if (!storageReady) { setError('Secure browser storage has not been verified yet.'); return; }
    setBusy(true); setError('');
    try {
      const draft = await createWalletDraft();
      setPhrase(draft.phrase);
      setShowPhrase(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create a wallet on this device.');
    } finally { setBusy(false); }
  };
  const saveCreatedWallet = async () => {
    if (!storageReady) { setError('Secure browser storage is unavailable.'); return; }
    if (password.length < 8) { setError('Use a password with at least 8 characters.'); return; }
    if (keystoreExists && !replaceExisting) { setError('Confirm that you understand this will replace the wallet currently saved in this browser.'); return; }
    if (!confirmedBackup) { setError('Confirm that you have safely written down the recovery phrase first.'); return; }
    setBusy(true); setError('');
    try {
      const draft = importWalletDraft(phrase);
      const encrypted = await draft.wallet.encrypt(password);
      await writeKeystore(encrypted);
      setAddress(draft.address); setUnlockedWallet(draft.wallet); setActiveMnemonicPhrase(draft.phrase); setKeystoreExists(true); closeModal();
      setNotice('Wallet encrypted and saved on this device.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not securely save the wallet.');
    } finally { setBusy(false); }
  };
  const saveImportedWallet = async () => {
    if (!storageReady) { setError('Secure browser storage is unavailable.'); return; }
    if (password.length < 8) { setError('Use a password with at least 8 characters.'); return; }
    if (keystoreExists && !replaceExisting) { setError('Confirm that you understand this will replace the wallet currently saved in this browser.'); return; }
    setBusy(true); setError('');
    try {
      const draft = importWalletDraft(importPhrase);
      const encrypted = await draft.wallet.encrypt(password);
      await writeKeystore(encrypted);
      setAddress(draft.address); setUnlockedWallet(draft.wallet); setActiveMnemonicPhrase(draft.phrase); setKeystoreExists(true); closeModal();
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
      setAddress(wallet.address); setUnlockedWallet(wallet); setActiveMnemonicPhrase(('mnemonic' in wallet && wallet.mnemonic) ? wallet.mnemonic.phrase : ''); closeModal(); setNotice('Wallet unlocked for this session.');
    } catch {
      setError('Incorrect password or the saved wallet could not be opened.');
    } finally { setBusy(false); }
  };

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Sparkles size={21} strokeWidth={2.4}/></div><span>ferra<span className="brand-light">wallet</span></span><button className="mobile-close icon-button" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={19}/></button></div>
      <div className="workspace-label">WALLET</div>
      <nav className="main-nav">{navItems.map(item => <button key={item.name} className={`nav-item ${activeTab === item.name ? 'active' : ''}`} onClick={() => { setActiveTab(item.name); setMobileNav(false); if (item.name === 'Swap' || item.name === 'Explore') setNotice('This feature is not enabled in the clean wallet foundation yet.'); }}><item.icon size={19}/><span>{item.label}</span>{item.name === 'Swap' && <span className="soon-tag">SOON</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="security-card"><div className="security-icon"><ShieldCheck size={19}/></div><div><strong>Your keys, your control</strong><p>Encrypted wallet data stays in this browser.</p></div></div><button className="nav-item" onClick={() => setModal('help')}><CircleHelp size={19}/><span>Help & security</span></button><button className="nav-item" onClick={() => setNotice('Settings are not part of this foundation phase.')}><Settings2 size={19}/><span>Settings</span></button><div className="profile-row"><div className="profile-avatar">F</div><div className="profile-info"><strong>Ferra Wallet</strong><span>{address ? shortAddress(address) : 'Self-custody foundation'}</span></div><button className="icon-button" onClick={() => setModal('wallet')} aria-label="Wallet options"><ChevronDown size={17}/></button></div></div>
    </aside>
    {mobileNav && <button className="mobile-overlay" onClick={() => setMobileNav(false)} aria-label="Close navigation"/>}
    <main className="main-content">
      {activeTab === 'Overview' && <header className="sire-home-header"><button type="button" className="sire-home-icon sire-home-profile-button" aria-label="Wallet profile" onClick={() => setModal('wallet')}><Wallet size={22}/></button><div className="sire-home-header-actions"><button type="button" className="sire-home-icon" aria-label="Search" onClick={() => setNotice('Search will be added in a later phase.')}><Search size={21}/></button><button type="button" className="sire-home-icon" aria-label="Notifications" onClick={() => setNotice('You’re all caught up.')}><Bell size={21}/></button><button type="button" className="sire-home-icon" aria-label="Help" onClick={() => setModal('help')}><CircleHelp size={22}/></button></div></header>}
      {activeTab !== 'Overview' && <div className="home-wallet-controls"><div className="breadcrumb">Ferra Wallet <span>/</span> <strong>{activeTab}</strong></div><div className="topbar-actions">{address ? <button className="connect-button connected" onClick={() => setNotice('Wallet is unlocked in this session: ' + shortAddress(address))}><span className="connected-dot"/>{shortAddress(address)}<ChevronDown size={15}/></button> : <button className="connect-button" onClick={() => setModal('wallet')}><Wallet size={16}/>{keystoreExists ? 'Unlock wallet' : 'Create / import'}</button>}</div></div>}
      <div className={`page-wrap ${activeTab === 'Overview' ? 'overview-page-wrap' : ''}`}>
        {activeTab === 'Market' ? <section className="panel activity-panel"><div className="panel-heading"><div><h2>Market</h2><p>Market data will be connected in a separate, verified phase.</p></div><span className="market-placeholder-tag">PLANNED</span></div><div className="market-empty">No external market feeds are connected in this clean foundation build.</div></section> : activeTab === 'Activity' ? <section className="panel activity-panel activity-page"><div className="panel-heading"><div><h2>History</h2><p>Wallet activity</p></div><span className="market-placeholder-tag">ACTIVITY</span></div><div className="market-empty">Transaction history is not connected yet.</div></section> : activeTab === 'Wallet' ? <section className="panel activity-panel"><div className="panel-heading"><div><h2>Your wallet</h2><p>Manage your local self-custody wallet.</p></div></div><p className="modal-description">{address ? address : 'No wallet is currently unlocked.'}</p><button className="primary-button" onClick={() => setModal('wallet')}>{address ? 'Wallet options' : keystoreExists ? 'Unlock wallet' : 'Create or import wallet'} <ArrowRight size={16}/></button></section> : <>
          <div className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> YOUR WEB3 HOME</div><h1>Your crypto, clearly.</h1><p className="page-subtitle">One calm place to see and manage your digital assets.</p></div><button className="refresh-button" onClick={() => address ? setNotice('Balance lookup is not enabled yet; no balance is being estimated.') : setModal('wallet')}><span>{address ? 'Refresh' : 'Get started'}</span><ArrowUpRight size={15}/></button></div>
          <section className="sire-home-value-card" aria-label="Total account value"><div className="sire-home-value-main"><div className="sire-home-value-copy"><div className="sire-home-value-card-top"><span>NATIVE BALANCE</span><button type="button" className="sire-home-value-eye" aria-label={totalValueVisible ? 'Hide balance' : 'Show balance'} onClick={() => setTotalValueVisible(value => !value)}>{totalValueVisible ? <Eye size={17}/> : <EyeOff size={17}/>}</button></div><div className="sire-home-value-amount">{totalValueVisible ? (selectedOtherNetwork === 'Solana' && solanaSnapshot ? `${formatEthForDisplay(solanaSnapshot.balanceSol)} SOL` : selectedOtherNetwork === 'Tron' && tronSnapshot ? `${formatEthForDisplay(tronSnapshot.balanceTrx)} TRX` : selectedOtherNetwork === 'Bitcoin' && bitcoinSnapshot ? `${formatEthForDisplay(bitcoinSnapshot.balanceBtc)} BTC` : selectedOtherNetwork === 'Ton' && tonSnapshot ? `${formatEthForDisplay(tonSnapshot.balanceTon)} TON` : networkSnapshot && selectedNetwork ? `${formatEthForDisplay(networkSnapshot.balanceEth)} ${selectedNetwork?.symbol ?? '—'}` : networkStatus === 'error' ? 'Unavailable' : registryLoading ? 'Loading networks…' : '—') : '••••••'}</div><div className="page-subtitle">{selectedChainAddress ? shortAddress(selectedChainAddress) : 'Create or unlock a wallet to get started'}</div></div><div className="sire-home-value-chart" aria-hidden="true"><svg viewBox="0 0 320 100" preserveAspectRatio="none"><defs><linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".18"/><stop offset="100%" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs><path d="M0 78 C35 75,45 68,72 71 S110 62,132 66 S165 48,188 53 S220 39,242 45 S278 25,320 31 L320 100 L0 100 Z" fill="url(#balanceGradient)"/><path d="M0 78 C35 75,45 68,72 71 S110 62,132 66 S165 48,188 53 S220 39,242 45 S278 25,320 31" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></div></div><button type="button" className="sire-home-value-add-funds" onClick={() => setModal('wallet')}>{address ? 'Wallet options' : 'Get started'}</button></section>
          <section className="panel activity-panel chain-panel">
            <div className="panel-heading">
              <div><h2>Blockchain connection</h2><p>Live native balance from the selected network</p></div>
              <button className="panel-action" onClick={() => void refreshNetwork()} disabled={(!selectedNetwork && selectedOtherNetwork !== 'Solana' && selectedOtherNetwork !== 'Tron' && selectedOtherNetwork !== 'Bitcoin') || networkStatus === 'loading'}><Activity size={14}/> Refresh</button>
            </div>
            <div className="chain-controls">
              <span className="form-label">Network</span>
              <button type="button" className="network-picker-trigger" onClick={() => { setNetworkDrawerSearch(''); setNetworkDrawerCategory('All'); setNetworkDrawerOpen(true); }} aria-haspopup="dialog" aria-expanded={networkDrawerOpen} disabled={registryLoading || !networks.length}>
                <span className="network-picker-mark">{(selectedCuratedEntry?.name ?? selectedNetwork?.name ?? 'E').slice(0, 1)}</span>
                <span className="network-picker-copy"><strong>{selectedCuratedEntry?.name ?? selectedNetwork?.name ?? (registryLoading ? 'Loading networks…' : 'Choose a network')}</strong><small>{selectedOtherNetwork === 'Solana' ? 'SOL · Solana mainnet' : selectedOtherNetwork === 'Tron' ? 'TRX · Tron mainnet' : selectedNetwork ? `${selectedNetwork.symbol} · Chain ID ${selectedNetwork.chainId}` : 'Choose from Ferra’s network directory'}</small></span>
                <ChevronDown size={18}/>
              </button>
              {registryError && <p className="wallet-error" role="alert">{registryError} Refresh the page to retry.</p>}
              <div className={`chain-status ${networkStatus}`} role="status">
                <span className="chain-status-dot"/>
                <span>{networkStatus === 'loading' ? 'Connecting to RPC…' : networkStatus === 'connected' ? `Connected · ${selectedOtherNetwork === 'Solana' ? `slot ${solanaSnapshot?.slot ?? '—'}` : selectedOtherNetwork === 'Tron' ? 'account balance loaded' : selectedOtherNetwork === 'Bitcoin' ? 'address balance loaded' : selectedOtherNetwork === 'Ton' ? 'account balance loaded' : `block ${networkSnapshot?.blockNumber ?? '—'}`}` : networkStatus === 'error' ? 'Connection failed' : address ? 'Waiting for connection' : 'Connected; unlock wallet to check balance'}</span>
              </div>
              {networkStatus === 'error' && <p className="wallet-error" role="alert">{networkError}</p>}
              <div className="chain-meta"><span>RPC provider</span><strong>{activeRpcUrl || (networkStatus === 'error' ? 'No responding endpoint' : selectedNetwork?.rpcUrl ?? (selectedOtherNetwork === 'Solana' ? 'Solana mainnet RPC' : selectedOtherNetwork === 'Tron' ? 'TronGrid API' : selectedOtherNetwork === 'Bitcoin' ? 'mempool.space API' : selectedOtherNetwork === 'Ton' ? 'TON API' : 'Waiting for registry'))}</strong></div>
              <div className="chain-meta"><span>Wallet address</span><strong>{selectedChainAddress ? shortAddress(selectedChainAddress) : 'Not unlocked'}</strong></div>
              <p className="chain-disclaimer">Read-only connection. Only your public address is queried; recovery phrase and private key are never sent to the RPC provider.</p>
            </div>
          </section>
          <section className="panel activity-panel chain-panel">
            <div className="panel-heading"><div><h2>Prepare a transfer</h2><p>Validate details and estimate network fees — no transaction will be sent.</p></div><span className="market-placeholder-tag">NO SIGNING</span></div>
            {selectedOtherNetwork && <p className="chain-disclaimer">Transfer fee estimation is currently available for EVM networks only. Solana sending is disabled.</p>}
            <label className="form-label" htmlFor="ferra-recipient">Recipient address</label>
            <input id="ferra-recipient" className="form-input" inputMode="text" autoComplete="off" spellCheck={false} value={txRecipient} onChange={event => { setTxRecipient(event.target.value); setTxEstimate(null); setTxError(''); }} placeholder="0x… recipient address"/>
            <label className="form-label" htmlFor="ferra-amount">Amount ({selectedNetwork?.symbol ?? 'native coin'})</label>
            <input id="ferra-amount" className="form-input" inputMode="decimal" autoComplete="off" value={txAmount} onChange={event => { setTxAmount(event.target.value); setTxEstimate(null); setTxError(''); }} placeholder="0.01"/>
            <button className="primary-button full-button" disabled={!address || Boolean(selectedOtherNetwork) || txBusy || networkStatus !== 'connected'} onClick={() => void prepareTransfer()}>{txBusy ? 'Estimating fees…' : 'Validate & estimate fees'} <ArrowRight size={16}/></button>
            {!address && <p className="chain-disclaimer">Unlock your wallet to use its public address as the sender. The private key is not used for fee estimation.</p>}
            {txError && <p className="wallet-error" role="alert">{txError}</p>}
            {txEstimate && <div className="tx-estimate" role="status">
              <div><span>Network</span><strong>{selectedNetwork?.name ?? 'EVM network'} · chain {txEstimate.chainId}</strong></div>
              <div><span>Recipient</span><strong>{shortAddress(txEstimate.to)}</strong></div>
              <div><span>Amount</span><strong>{txEstimate.amountEth} {selectedNetwork?.symbol ?? 'native coin'}</strong></div>
              <div><span>Estimated gas limit</span><strong>{txEstimate.gasLimit}</strong></div>
              <div><span>Estimated network fee</span><strong>{Number(txEstimate.estimatedFeeEth).toLocaleString('en-US', { maximumFractionDigits: 8 })} {selectedNetwork?.symbol ?? 'native coin'}</strong></div>
              <div><span>Estimated total required</span><strong>{Number(txEstimate.totalRequiredEth).toLocaleString('en-US', { maximumFractionDigits: 8 })} {selectedNetwork?.symbol ?? 'native coin'}</strong></div>
              <p className="chain-disclaimer">Estimate only. Fees can change before submission. This does not sign or broadcast a transaction, and sending remains disabled.</p>
            </div>}
          </section>
          <section className="network-marquee" aria-label="Discovered EVM networks"><div className="network-marquee-track"><div className="network-marquee-group">{networks.slice(0, 8).map(network => <div className="network-marquee-pill" key={network.key}><span className="network-marquee-logo"><span>{network.symbol.slice(0, 5)}</span></span><span>{network.name}</span></div>)}</div></div></section>
          <nav className="wallet-quick-actions" aria-label="Wallet actions"><button type="button" className="wallet-quick-action" onClick={() => setNotice('Sending is disabled until transaction review and signing are implemented.')}><span className="wallet-quick-icon"><ArrowUpRight size={20}/></span><span>Send</span></button><button type="button" className="wallet-quick-action" onClick={() => setNotice(address ? 'Your public address: ' + address : 'Create or unlock a wallet first.')}><span className="wallet-quick-icon"><ArrowDownLeft size={20}/></span><span>Receive</span></button><button type="button" className="wallet-quick-action" onClick={() => setActiveTab('Activity')}><span className="wallet-quick-icon"><Activity size={20}/></span><span>History</span></button></nav>
          <section className="panel activity-panel"><div className="panel-heading"><div><h2>Quick actions</h2><p>Common wallet tasks, made simple</p></div></div><div className="quick-actions"><button className="quick-action" onClick={() => setNotice('Transaction signing is intentionally not enabled yet.')}><span className="quick-icon send"><ArrowUpRight size={19}/></span><span><strong>Send</strong><small>Transfer crypto</small></span><ArrowRight size={15} className="quick-arrow"/></button><button className="quick-action" onClick={() => setNotice(address ? 'Public address: ' + address : 'Create or unlock a wallet first.')}><span className="quick-icon receive"><ArrowDownLeft size={19}/></span><span><strong>Receive</strong><small>Share your address</small></span><ArrowUpRight size={15} className="quick-arrow"/></button><button className="quick-action" onClick={() => setNotice('Swaps are not implemented in this foundation build.')}><span className="quick-icon swap"><ArrowLeftRight size={19}/></span><span><strong>Swap tokens</strong><small>Coming soon</small></span><span className="soon-tag">SOON</span></button><button className="quick-action" onClick={() => { if (networks.length) { const index = networks.findIndex(network => network.key === selectedNetworkKey); setSelectedNetworkKey(networks[(index + 1) % networks.length].key); setNotice('Switched to another discovered EVM network.'); setActiveTab('Overview'); } }}><span className="quick-icon network"><Globe2 size={19}/></span><span><strong>Change network</strong><small>Explore supported chains</small></span><ArrowUpRight size={15} className="quick-arrow"/></button></div><div className="quick-note"><LockKeyhole size={15}/><span>Transaction features stay disabled until their safety checks are implemented.</span></div></section>
          <section className="panel activity-panel"><div className="panel-heading"><div><h2>Recent activity</h2><p>Your wallet transactions</p></div><button className="panel-action" onClick={() => setActiveTab('Activity')}>View all <ArrowUpRight size={14}/></button></div><div className="activity-empty"><div className="activity-empty-icon"><Activity size={20}/></div><div><strong>No activity yet</strong><p>Transaction history will appear after verified transaction support is added.</p></div></div></section>
        </>}
        <footer className="footer"><div><span className="footer-logo"><Sparkles size={14}/> ferra wallet</span><span>Built for clarity. Designed for you.</span></div><div className="footer-right"><span><span className="status-dot"/> Wallet foundation</span><button onClick={() => setModal('help')}>Security first <ShieldCheck size={13}/></button></div></footer>
      </div>
    </main>
    <nav className="bottom-navigation" aria-label="Main navigation"><button type="button" className={activeTab === 'Overview' ? 'active' : ''} onClick={() => setActiveTab('Overview')}><Home size={20}/><span>Home</span></button><button type="button" className={activeTab === 'Market' ? 'active' : ''} onClick={() => setActiveTab('Market')}><TrendingUp size={20}/><span>Market</span></button><button type="button" className={activeTab === 'Activity' ? 'active' : ''} onClick={() => setActiveTab('Activity')}><Activity size={20}/><span>History</span></button><button type="button" onClick={() => setModal('wallet')}><Wallet size={20}/><span>Wallet</span></button></nav>

    {networkDrawerOpen && <div className="network-picker-backdrop" onClick={() => setNetworkDrawerOpen(false)}>
      <section className="network-picker-drawer" role="dialog" aria-modal="true" aria-labelledby="network-picker-title" onClick={event => event.stopPropagation()}>
        <div className="network-picker-grabber" aria-hidden="true"/>
        <header className="network-picker-header">
          <div><span className="network-picker-eyebrow">FERRA WALLET</span><h2 id="network-picker-title">Choose network</h2><p>Find your chain and switch in one tap.</p></div>
          <button type="button" className="network-picker-close" onClick={() => setNetworkDrawerOpen(false)} aria-label="Close network list"><X size={19}/></button>
        </header>
        <label className="network-picker-search"><Search size={17}/><input autoFocus type="search" value={networkDrawerSearch} onChange={event => setNetworkDrawerSearch(event.target.value)} placeholder="Search networks" aria-label="Search networks"/>{networkDrawerSearch && <button type="button" onClick={() => setNetworkDrawerSearch('')} aria-label="Clear search"><X size={15}/></button>}</label>
        <div className="network-picker-filters" role="group" aria-label="Filter network type">
          {(['All', 'EVM', 'Other'] as const).map(category => <button type="button" key={category} className={networkDrawerCategory === category ? 'active' : ''} onClick={() => setNetworkDrawerCategory(category)}>{category}<span>{category === 'All' ? CURATED_NETWORKS.length : CURATED_NETWORKS.filter(entry => entry.family === category).length}</span></button>)}
        </div>
        <div className="network-picker-list">
          {visibleCuratedNetworks.map(entry => {
            const network = networkForEntry(entry);
            const active = entry.name === selectedOtherNetwork || Boolean(network && network.key === selectedNetworkKey);
            const unavailable = !network && entry.name !== 'Solana' && entry.name !== 'Tron' && entry.name !== 'Bitcoin' && entry.name !== 'Ton';
            return <button type="button" key={entry.name} className={`network-picker-row ${active ? 'active' : ''} ${unavailable ? 'unavailable' : ''}`} onClick={() => {
              if (entry.name === 'Solana' || entry.name === 'Tron' || entry.name === 'Bitcoin' || entry.name === 'Ton') { setSelectedOtherNetwork(entry.name); setNetworkDrawerOpen(false); return; }
              if (!network) { setNotice(`${entry.name} is listed in Ferra’s network directory, but its chain adapter is not integrated yet.`); return; }
              setSelectedOtherNetwork(''); setSelectedNetworkKey(network.key); setSolanaSnapshot(null); setTxEstimate(null); setTxError(''); setNetworkDrawerOpen(false); setNotice(`Switched to ${entry.name}.`);
            }}>
              <span className={`network-picker-icon network-icon-${entry.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`}>{entry.name === 'Ethereum' ? 'Ξ' : entry.name === 'Bitcoin' ? '₿' : entry.name === 'Ton' ? 'T' : entry.name.slice(0, 1).toUpperCase()}</span>
              <span className="network-picker-row-copy"><strong>{entry.name}</strong><small>{entry.name === 'Solana' ? 'SOL · read-only balance' : entry.name === 'Tron' ? 'TRX · read-only balance' : entry.name === 'Bitcoin' ? 'BTC · read-only balance' : entry.name === 'Ton' ? 'TON · read-only balance' : network ? `${network.symbol} · Chain ID ${network.chainId}` : entry.family === 'Other' ? 'Non-EVM · integration pending' : 'EVM · integration pending'}</small></span>
              {active ? <span className="network-picker-check">✓</span> : unavailable ? <span className="network-picker-soon">SOON</span> : <ArrowRight size={16} className="network-picker-arrow"/>}
            </button>;
          })}
          {!visibleCuratedNetworks.length && <div className="network-picker-empty">No networks match “{networkDrawerSearch}”. Try another name.</div>}
        </div>
        <footer className="network-picker-footer"><span className="network-picker-footer-dot"/><span>{networks.length} curated EVM networks currently have a usable registry match. Unsupported chains are shown honestly and won’t be selected until their adapters are implemented.</span></footer>
      </section>
    </div>}



    {notice && <div className="toast" role="status"><span className="toast-dot"/><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss notification"><X size={16}/></button></div>}
    {modal && <div className="modal-backdrop" onClick={closeModal}><section className="modal-card" onClick={event => event.stopPropagation()}>
      <div className="modal-head"><div><span className="modal-eyebrow">FERRA WALLET</span><h2>{modal === 'wallet' ? 'Your wallet' : modal === 'create' ? 'Create a wallet' : modal === 'import' ? 'Import a wallet' : modal === 'unlock' ? 'Unlock your wallet' : 'Help & security'}</h2></div><button className="icon-button" onClick={closeModal} aria-label="Close dialog"><X size={19}/></button></div>
      {modal === 'wallet' && <><p className="modal-description">Create a new self-custody wallet or import an existing recovery phrase. Wallet data is encrypted before it is saved in this browser.</p>{!storageReady && <p className="wallet-error" role="status">Checking secure browser storage. If it is unavailable, wallet setup remains disabled.</p>}<div className="wallet-choice-grid"><button type="button" className="wallet-choice" disabled={!storageReady || busy} onClick={() => { setError(''); setPhrase(''); setPassword(''); setModal('create'); void startCreate(); }}><span className="wallet-choice-icon"><Sparkles size={19}/></span><strong>Create new wallet</strong><small>Generate a recovery phrase</small></button><button type="button" className="wallet-choice" disabled={!storageReady || busy} onClick={() => { setError(''); setImportPhrase(''); setPassword(''); setModal('import'); }}><span className="wallet-choice-icon"><ArrowDownLeft size={19}/></span><strong>Import wallet</strong><small>Use an existing recovery phrase</small></button></div>{keystoreExists && <button className="primary-button full-button" onClick={() => { setError(''); setPassword(''); setModal('unlock'); }}>Unlock saved wallet</button>}{unlockedWallet && <button className="primary-button full-button" onClick={() => { setUnlockedWallet(null); setAddress(''); setActiveMnemonicPhrase(''); setSolanaSnapshot(null); closeModal(); setNotice('Wallet locked for this session. Encrypted data remains saved on this device.'); }}>Lock wallet</button>}<div className="form-warning"><LockKeyhole size={16}/><span>Never share your recovery phrase. Ferra cannot recover it if you lose it.</span></div></>}
      {modal === 'create' && <><p className="modal-description">Your recovery phrase is generated locally. Write it down and store it offline before securing the wallet.</p>{keystoreExists && <label className="form-label"><input type="checkbox" checked={replaceExisting} onChange={event => setReplaceExisting(event.target.checked)}/> I understand this will replace the wallet currently saved in this browser.</label>}{busy && !phrase ? <p className="network-loading">Generating wallet locally…</p> : phrase && <><div className="wallet-recovery-phrase">{phrase.split(' ').map((word,index) => <span key={index}><small>{index+1}</small>{showPhrase ? word : '••••'}</span>)}</div><button className="text-button" onClick={() => setShowPhrase(value => !value)}>{showPhrase ? 'Hide recovery phrase' : 'Reveal recovery phrase'}</button><label className="form-label"><input type="checkbox" checked={confirmedBackup} onChange={event => setConfirmedBackup(event.target.checked)}/> I have written down my recovery phrase and stored it safely.</label><label className="form-label">Encryption password (8+ characters)</label><input className="form-input" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Choose a strong password"/><button className="primary-button full-button" disabled={busy || !confirmedBackup || password.length < 8 || (keystoreExists && !replaceExisting)} onClick={() => void saveCreatedWallet()}>{busy ? 'Securing wallet…' : 'Secure wallet and continue'} <ArrowRight size={16}/></button></>}{error && <p className="wallet-error" role="alert">{error}</p>}</>}
      {modal === 'import' && <><p className="modal-description">Import a valid 12- or 24-word recovery phrase. The phrase is processed locally and is never sent to a server.</p>{keystoreExists && <label className="form-label"><input type="checkbox" checked={replaceExisting} onChange={event => setReplaceExisting(event.target.checked)}/> I understand this will replace the wallet currently saved in this browser.</label>}<label className="form-label">Recovery phrase</label><textarea className="form-input wallet-phrase-input" rows={3} autoComplete="off" spellCheck={false} value={importPhrase} onChange={event => setImportPhrase(event.target.value)} placeholder="Enter recovery phrase separated by spaces"/><label className="form-label">Encryption password (8+ characters)</label><input className="form-input" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Choose a strong password"/><button className="primary-button full-button" disabled={busy} onClick={() => void saveImportedWallet()}>{busy ? 'Importing wallet…' : 'Import and secure wallet'} <ArrowRight size={16}/></button>{error && <p className="wallet-error" role="alert">{error}</p>}</>}
      {modal === 'unlock' && <><p className="modal-description">Enter the password used to encrypt the wallet saved in this browser.</p><label className="form-label">Wallet password</label><input className="form-input" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Wallet password"/><button className="primary-button full-button" disabled={busy} onClick={() => void unlockSavedWallet()}>{busy ? 'Unlocking…' : 'Unlock wallet'} <ArrowRight size={16}/></button>{error && <p className="wallet-error" role="alert">{error}</p>}</>}
      {modal === 'help' && <><p className="modal-description">Ferra is being rebuilt in phases. Wallet creation and local encrypted storage are implemented first; network and transaction features remain disabled until verified.</p><div className="security-list"><div><ShieldCheck size={18}/><span><strong>Keep your recovery phrase private</strong><small>Anyone with it can control your funds. Store it offline and never share it.</small></span></div><div><LockKeyhole size={18}/><span><strong>Encrypted local storage</strong><small>The browser stores an encrypted keystore, not the plaintext recovery phrase.</small></span></div><div><Globe2 size={18}/><span><strong>Read-only network access</strong><small>Networks are discovered from a public registry. Transaction signing and sending are not enabled yet.</small></span></div></div><button className="primary-button full-button" onClick={closeModal}>Got it</button></>}
    </section></div>}
  </div>;
}
