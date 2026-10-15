import { HDNodeWallet, Mnemonic, SigningKey, formatUnits } from 'ethers';
import { ripemd160 } from '@noble/hashes/ripemd160';

export const BITCOIN_DERIVATION_PATH = "m/84'/0'/0'/0/0";
const DEFAULT_API = 'https://mempool.space/api';
export type BitcoinSnapshot = { address: string; balanceSatoshis: string; balanceBtc: string; apiUrl: string };
function getApiUrl(): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const url = env?.VITE_BITCOIN_API_URL?.trim() || DEFAULT_API;
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('Invalid Bitcoin API URL.'); }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') throw new Error('Bitcoin API must use HTTPS.');
  return url.replace(/\/$/, '');
}
async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const copy = new Uint8Array(bytes.length); copy.set(bytes);
  return new Uint8Array(await crypto.subtle.digest('SHA-256', copy.buffer));
}
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
function polymod(values: number[]): number {
  const gen = [0x3b6a57b2,0x26508e6d,0x1ea119fa,0x3d4233dd,0x2a1462b3]; let chk = 1;
  for (const value of values) { const top = chk >>> 25; chk = ((chk & 0x1ffffff) << 5) ^ value; for (let i=0;i<5;i++) if ((top >>> i)&1) chk ^= gen[i]; }
  return chk >>> 0;
}
function segwitAddress(program: Uint8Array): string {
  let acc=0,bits=0; const data=[0], max=31;
  for (const byte of program) { acc=(acc<<8)|byte; bits+=8; while(bits>=5){bits-=5;data.push((acc>>>bits)&max);} }
  if(bits) data.push((acc<<(5-bits))&max);
  const hrp='bc', expanded=[...Array.from(hrp,c=>c.charCodeAt(0)>>>5),0,...Array.from(hrp,c=>c.charCodeAt(0)&31)];
  const mod=polymod([...expanded,...data,0,0,0,0,0,0])^1;
  const sum=Array.from({length:6},(_,i)=>(mod>>>(5*(5-i)))&31);
  return hrp+'1'+[...data,...sum].map(x=>CHARSET[x]).join('');
}
export async function deriveBitcoinAddress(input: string): Promise<string> {
  const phrase=input.trim().toLowerCase().replace(/\s+/g,' ');
  if(!Mnemonic.isValidMnemonic(phrase)) throw new Error('A valid recovery phrase is required to derive the Bitcoin account.');
  const wallet=HDNodeWallet.fromPhrase(phrase,'',BITCOIN_DERIVATION_PATH);
  const publicKey=SigningKey.computePublicKey(wallet.privateKey,true);
  const bytes=Uint8Array.from(publicKey.slice(2).match(/.{2}/g)??[],x=>parseInt(x,16));
  return segwitAddress(ripemd160(await sha256(bytes)));
}
export async function readBitcoinSnapshot(input: string): Promise<BitcoinSnapshot> {
  const address=await deriveBitcoinAddress(input), endpoint=getApiUrl();
  let response: Response;
  try { response=await fetch(`${endpoint}/address/${encodeURIComponent(address)}`,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)}); }
  catch(e) { throw new Error(`Bitcoin API request failed: ${e instanceof Error?e.message:String(e)}`); }
  if(response.status===429) throw new Error('Bitcoin API rate limit reached. Wait briefly and try again.');
  if(response.status===401||response.status===403) throw new Error('Bitcoin API access denied. Check provider settings.');
  if(!response.ok) throw new Error(`Bitcoin API request failed (HTTP ${response.status}).`);
  const payload: unknown=await response.json();
  if(!payload||typeof payload!=='object') throw new Error('Unexpected Bitcoin API response.');
  const stats=payload as {chain_stats?:{funded_txo_sum?:number;spent_txo_sum?:number};mempool_stats?:{funded_txo_sum?:number;spent_txo_sum?:number}};
  const balance=(stats: {funded_txo_sum?:number;spent_txo_sum?:number}|undefined)=>BigInt(stats?.funded_txo_sum??0)-BigInt(stats?.spent_txo_sum??0);
  const satoshis=(balance(stats.chain_stats)+balance(stats.mempool_stats)).toString();
  return {address,balanceSatoshis:satoshis,balanceBtc:formatUnits(BigInt(satoshis),8),apiUrl:endpoint};
}
