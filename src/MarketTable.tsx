import { Star, ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { MarketMetrics } from './marketData';

type Token = { chainId:number; address:string; symbol:string; name:string; decimals:number; logoURI?:string; priceUSD?:string };
type Network = { id:string; chainId:number; name:string; symbol:string; logoURI?:string; tokens:Token[] };
type Props = {
  networks:Network[]; networkId:string; timeRange:'1h'|'24h'|'7d'|'30d'; category:string; search:string; sort:string;
  metrics:Record<string,MarketMetrics>; favorites:string[]; loading:boolean; error:string;
  onToggleFavorite:(key:string)=>void;
};

// Fallback token logos for entries where the LI.FI directory omits or serves a broken logo URI.
const trustWalletFolders:Record<number,string>={
  1:'ethereum',56:'smartchain',137:'polygon',42161:'arbitrum',10:'optimism',
  43114:'avalanchec',100:'xdai',250:'fantom',42220:'celo',1313161554:'aurora',
  25:'cronos',1284:'moonbeam',1285:'moonriver',1666600000:'harmony',1088:'metis',
  40:'telos',8217:'klaytn',122:'fuse',324:'zksync',59144:'linea',534352:'scroll',
  8453:'base',81457:'blast',7777777:'zora',5000:'mantle',204:'opbnb'
};
const marketTokenLogoCandidates=(token:Token):string[]=>{
  const address=token.address?.trim();
  if(!address)return [];
  const candidates:string[]=[];
  const folder=trustWalletFolders[token.chainId];
  if(folder)candidates.push(`https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${folder}/assets/${address}/logo.png`);
  candidates.push(`https://icons.llamao.fi/icons/tokens/${token.chainId}/${encodeURIComponent(address)}?w=64&h=64`);
  return candidates;
};
const money=(value?:number|string)=>{const n=Number(value);if(!Number.isFinite(n)||n<=0)return '—';return n>=1000?'$'+n.toLocaleString('en-US',{maximumFractionDigits:2}):n>=1?'$'+n.toLocaleString('en-US',{maximumFractionDigits:4}):'$'+n.toLocaleString('en-US',{maximumFractionDigits:8});};
const isStockLike=(name:string,symbol:string)=>{const n=name.trim();const s=symbol.trim();return /(?:\bstock\b|\bshares?\b|\bequit(?:y|ies)\b|\btokeni[sz]ed\b|\bpre[- ]?ipo\b|\bincorporated\b|\bcorporation\b|\bcommon stock\b|\bclass [a-c] shares?\b|\bETF\b)/i.test(n)||/(?:\binc\\.?|\bcorp\\.?|\bltd\\.?|\blimited|\bplc\\.?|\bholdings?)\\s*$/i.test(n)||(/^[A-Z]{1,5}c$/.test(s)&&/(?:inc\\.?|corp\\.?|stock|shares?|holdings?|company|class [A-Z])/i.test(n));};
const compact=(value?:number)=>{if(!Number.isFinite(value)||!value)return '—';const n=Math.abs(value);return n>=1e12?'$'+(value/1e12).toFixed(2)+'T':n>=1e9?'$'+(value/1e9).toFixed(2)+'B':n>=1e6?'$'+(value/1e6).toFixed(2)+'M':n>=1e3?'$'+(value/1e3).toFixed(2)+'K':'$'+value.toFixed(2);};
export default function MarketTable({networks,networkId,timeRange,category,search,sort,metrics,favorites,loading,error,onToggleFavorite}:Props){
  const [visibleCount, setVisibleCount] = useState(100);
  useEffect(() => { setVisibleCount(100); }, [networkId, timeRange, category, search, sort]);
  const selected=networkId==='all'?networks:networks.filter(n=>n.id===networkId);
  const query=search.trim().toLowerCase();
  let rows=selected.flatMap(network=>network.tokens.map(token=>{
    const key=token.chainId+':'+token.address.toLowerCase(), data=metrics[key]||{};
    const price=data.priceUsd||undefined;
    const change=timeRange==='1h'?data.priceChange?.h1:timeRange==='24h'?data.priceChange?.h24:undefined;
    return {...token,key,networkName:network.name,data,price,change};
  }));
  // Display the LI.FI token directory as supplied. Market metrics and token categories do not
  // decide eligibility here; actual swap routes are verified by LI.FI when a swap is requested.
  if(query) rows=rows.filter(t=>t.name.toLowerCase().includes(query)||t.symbol.toLowerCase().includes(query)||t.address.toLowerCase().includes(query)||t.networkName.toLowerCase().includes(query));
  if(category==='Favorites') rows=rows.filter(t=>favorites.includes(t.key));
  if(category==='Gainers') rows=rows.filter(t=>typeof t.change==='number'&&t.change>0);
  if(category==='Losers') rows=rows.filter(t=>typeof t.change==='number'&&t.change<0);
  if(category==='Volume') rows=rows.filter(t=>Number(t.data.volume?.h24)>0);
  rows.sort((a,b)=>sort==='price'?Number(b.price||0)-Number(a.price||0):sort==='change'?Number(b.change??-Infinity)-Number(a.change??-Infinity):sort==='volume'||(category==='Hot'&&sort==='market_cap')?Number(b.data.volume?.h24||0)-Number(a.data.volume?.h24||0):Number(b.data.marketCap||b.data.fdv||0)-Number(a.data.marketCap||a.data.fdv||0));
  return <div className="market-table-panel"><div className="market-compact-list">
    <div className="market-sort-bar" aria-label="Sort market instruments"><span className="market-sort-label">#</span><div className="market-sort-asset"><span>MC / VOL</span></div><div className="market-sort-values"><span>Price / {timeRange}</span></div><span className="market-sort-star"><Star size={12}/></span></div>
    {rows.slice(0, visibleCount).map((token,index)=><article className="market-compact-row" key={token.key}><span className="market-compact-rank">{index+1}</span><div className="market-compact-asset"><div className="market-token"><span className="market-token-logos"><img
              src={token.logoURI || marketTokenLogoCandidates(token)[0] || ''}
              data-logo-candidates={JSON.stringify(marketTokenLogoCandidates(token))}
              data-logo-index="0"
              alt=""
              loading="lazy"
              onError={e=>{
                const image=e.currentTarget;
                let candidates:string[]=[];
                try{candidates=JSON.parse(image.dataset.logoCandidates||'[]') as string[];}catch{}
                const next=Number(image.dataset.logoIndex||'0')+1;
                if(candidates[next]){image.dataset.logoIndex=String(next);image.src=candidates[next];}
                else{image.style.display='none';}
              }}
            /><span className="market-token-fallback">{(token.symbol||'?').slice(0,3).toUpperCase()}</span></span><div className="market-token-copy"><strong title={token.name||token.symbol}>{token.symbol||token.name}</strong><span title={(token.name||token.symbol)+' · '+token.networkName}>{token.networkName} · {(token.name||token.symbol)}</span></div></div><div className="market-compact-metrics"><span><b>{token.data.marketCap ? "MC" : token.data.fdv ? "FDV" : "MC"}</b> {compact(token.data.marketCap||token.data.fdv)}</span><span><b>VOL</b> {compact(token.data.volume?.h24)}</span><span><b>LIQ</b> {compact(token.data.liquidity?.usd)}</span></div></div><div className="market-compact-price"><strong>{money(token.price)}</strong><span className={typeof token.change!=='number'?'neutral':token.change>0?'positive':token.change<0?'negative':'neutral'}>{typeof token.change==='number'?(token.change>0?'+':'')+token.change.toFixed(2)+'%':'—'}</span></div><button type="button" className="market-favorite" onClick={()=>onToggleFavorite(token.key)} aria-label={favorites.includes(token.key)?'Remove from favorites':'Add to favorites'} aria-pressed={favorites.includes(token.key)}><Star size={15} fill={favorites.includes(token.key)?'currentColor':'none'}/></button></article>)}
    {rows.length > visibleCount && <button type="button" className="market-load-more" onClick={() => setVisibleCount(count => Math.min(count + 100, rows.length))}>Show more tokens ({Math.min(100, rows.length - visibleCount)} more) <ChevronDown size={15}/></button>}
    {!rows.length&&<div className="market-empty">{loading?'Loading token prices and market metrics…':error|| (category==='Favorites'?'No favorites saved yet. Tap a star beside a token to save it.':'No tokens match these filters. Try another network or search.')}</div>}
  </div><div className="market-table-footer"><span>Tokens listed by LI.FI for the selected networks. Price and DEX metrics appear when a matching market is available; unavailable values are shown as dashes. 7d/30d changes are not available yet.</span></div></div>;
}
