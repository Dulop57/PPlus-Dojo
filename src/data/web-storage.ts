import {gunzipSync} from 'fflate';
import type {FirebaseConfig} from '../desktop';
type WebConfig={schemaVersion:1;version:string;firebase:FirebaseConfig;catalog:string;offlineAssets?:string[]};
type Pack={path:string;size:number;sha256:string};
type Entry={pack:string;offset:number;length:number;gzip:boolean};
type Catalog={schemaVersion:1;packs:Pack[];files:Record<string,Entry>};
export type WebStorageState={configured:boolean;cachedBytes:number;totalBytes:number;downloading:boolean;persistent:boolean|null;message:string;updateReady:boolean};
const fileCache='pplus-dojo-web-files-v1',settingsCache='pplus-dojo-web-settings-v1';
let config:WebConfig|null=null,catalog:Promise<Catalog>|undefined,registration:ServiceWorkerRegistration|undefined,cancelled=false,reloadRequested=false;
let state:WebStorageState={configured:false,cachedBytes:0,totalBytes:0,downloading:false,persistent:null,message:'',updateReady:false};
const listeners=new Set<()=>void>(),inflight=new Map<string,Promise<ArrayBuffer>>(),memory=new Map<string,ArrayBuffer>();
export const webStorageSnapshot=()=>state;
export function subscribeWebStorage(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
function publish(patch:Partial<WebStorageState>){state={...state,...patch};for(const listener of listeners)listener();}
const base=()=>new URL(import.meta.env.BASE_URL,document.baseURI);
function url(path:string){if(path.includes('\\')||path.includes('..')||path.startsWith('/'))throw new Error('Invalid offline file path.');const result=new URL(path,base());if(result.origin!==base().origin||!result.href.startsWith(base().href))throw new Error('Invalid offline file origin.');return result.href;}
async function digest(bytes:ArrayBuffer){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function cacheOpen(name:string){try{return await caches.open(name);}catch{return null;}}
export async function initializeWeb(){
  if(import.meta.env.VITE_DOJO_WEB!=='1')return null;
  const address=url('web-config.json'),cache=await cacheOpen(settingsCache);let response:Response|undefined;
  try{const fetched=await fetch(address,{cache:'no-cache'});if(!fetched.ok)throw new Error('Web configuration unavailable.');response=fetched;}catch{response=await cache?.match(address);}
  if(!response)throw new Error('Connect once to prepare this website for offline use.');
  const value=await response.clone().json();
  if(value.schemaVersion!==1||!/^web-data\/catalog-[a-f0-9]{64}\.json\.gz$/.test(value.catalog)||!['apiKey','authDomain','projectId','appId'].every(key=>typeof value.firebase?.[key]==='string'&&value.firebase[key]))throw new Error('Invalid website configuration.');
  config=value;try{await cache?.put(address,response);}catch{}
  publish({configured:true});
  if('serviceWorker' in navigator){
    try{
      registration=await navigator.serviceWorker.register(new URL('sw.js',base()),{scope:base().pathname,updateViaCache:'none'});
      if(registration.waiting)publish({updateReady:true});
      registration.addEventListener('updatefound',()=>{const worker=registration?.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)publish({updateReady:true});});});
      navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloadRequested)location.reload();});
      // Install the app shell before offering it as available offline.
      await new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Offline page preparation timed out.')),8000);navigator.serviceWorker.ready.then(()=>{clearTimeout(timeout);resolve();},error=>{clearTimeout(timeout);reject(error);});});
    }catch{publish({message:'Offline page storage is unavailable in this browser. Downloaded data may still be cached.'});}
  }
  try{publish({persistent:await navigator.storage?.persisted?.()??false});}catch{}
  return config;
}
async function getCatalog(){
  if(!config)throw new Error('Offline data is not configured.');
  return catalog??=(async()=>{
    const cache=await cacheOpen(fileCache),address=url(config!.catalog);let response=await cache?.match(address);
    if(!response){response=await fetch(address);if(!response.ok)throw new Error('The offline data index could not be downloaded.');}
    const bytes=await response.arrayBuffer(),expected=config!.catalog.match(/catalog-([a-f0-9]{64})/)![1];
    if(await digest(bytes)!==expected){await cache?.delete(address);throw new Error('Offline index failed its integrity check. Reload to retry.');}
    const value=JSON.parse(new TextDecoder().decode(gunzipSync(new Uint8Array(bytes)))) as Catalog;
    if(value.schemaVersion!==1||!Array.isArray(value.packs)||!value.files||value.packs.some(p=>!/^web-data\/[a-f0-9]{64}\.pak$/.test(p.path)||!Number.isSafeInteger(p.size)||p.size<1||p.size>25*1024*1024||!/[a-f0-9]{64}/.test(p.sha256)||p.path!==`web-data/${p.sha256}.pak`))throw new Error('Invalid offline data index.');
    try{await cache?.put(address,new Response(bytes,{headers:{'Content-Type':'application/octet-stream'}}));}catch{}
    publish({totalBytes:value.packs.reduce((sum,p)=>sum+p.size,0)});return value;
  })().catch(error=>{catalog=undefined;throw error;});
}
async function getPack(pack:Pack){
  if(memory.has(pack.path))return memory.get(pack.path)!;
  if(inflight.has(pack.path))return inflight.get(pack.path)!;
  const work=(async()=>{
    const address=url(pack.path),cache=await cacheOpen(fileCache);let response=await cache?.match(address),fresh=!response;
    if(!response){response=await fetch(address);if(!response.ok)throw new Error(navigator.onLine?'A reference data file is unavailable.':'This data has not been downloaded yet. Connect to load it.');}
    const bytes=await response.arrayBuffer();
    if(bytes.byteLength!==pack.size||await digest(bytes)!==pack.sha256){await cache?.delete(address);throw new Error('A data download failed its integrity check. Try again.');}
    if(fresh){try{if(!cache)throw new Error('Cache storage unavailable.');await cache.put(address,new Response(bytes,{headers:{'Content-Type':'application/octet-stream','Content-Length':String(bytes.byteLength)}}));publish({cachedBytes:Math.min(state.totalBytes,state.cachedBytes+bytes.byteLength)});}catch{publish({message:'Browser storage is full or unavailable. This file works now but could not be saved for later.'});}}
    if(memory.size>=2)memory.delete(memory.keys().next().value!);memory.set(pack.path,bytes);return bytes;
  })().finally(()=>inflight.delete(pack.path));inflight.set(pack.path,work);return work;
}
export async function readWebFile(path:string,signal?:AbortSignal):Promise<{bytes:ArrayBuffer;gzip:boolean}|null>{
  if(!config)return null;signal?.throwIfAborted();
  const index=await getCatalog(),entry=index.files[path];if(!entry)throw new Error('This reference file is missing from the offline index.');
  const pack=index.packs.find(p=>p.path===entry.pack);if(!pack)throw new Error('Invalid reference data pack.');
  const bytes=await getPack(pack);signal?.throwIfAborted();
  if(!Number.isSafeInteger(entry.offset)||!Number.isSafeInteger(entry.length)||entry.offset<0||entry.length<1||entry.offset+entry.length>bytes.byteLength)throw new Error('Invalid reference file offset.');
  return {bytes:bytes.slice(entry.offset,entry.offset+entry.length),gzip:entry.gzip};
}
export async function readWebText(path:string,signal?:AbortSignal){const file=await readWebFile(path,signal);return file?new TextDecoder().decode(file.gzip?gunzipSync(new Uint8Array(file.bytes)):file.bytes):null;}
export async function refreshWebStorage(){
  if(!config)return;try{const index=await getCatalog(),cache=await cacheOpen(fileCache),keys=new Set((await cache?.keys()??[]).map(k=>k.url));publish({cachedBytes:index.packs.filter(p=>keys.has(url(p.path))).reduce((sum,p)=>sum+p.size,0)});}catch(error){publish({message:error instanceof Error?error.message:'Storage could not be checked.'});}
}
export async function downloadAllWebData(){
  if(state.downloading)return;cancelled=false;publish({downloading:true,message:'Preparing offline download…'});
  try{
    const index=await getCatalog();await refreshWebStorage();
    const estimate=await navigator.storage?.estimate?.();if(estimate?.quota&&estimate.usage!==undefined&&estimate.quota-estimate.usage<state.totalBytes-state.cachedBytes)throw new Error('Not enough browser storage to download all data. You can keep saving files as you open them.');
    try{publish({persistent:await navigator.storage?.persist?.()??false});}catch{}
    const cache=await cacheOpen(fileCache);if(!cache)throw new Error('Offline file storage is unavailable in this browser.');
    for(const pack of index.packs){if(cancelled)break;await getPack(pack);if(!await cache.match(url(pack.path)))throw new Error('A file could not be saved. Free browser storage and retry.');publish({message:'Saving reference data for offline use…'});}
    if(!cancelled&&navigator.serviceWorker?.controller)for(const asset of config?.offlineAssets??[]){if(cancelled)break;publish({message:'Saving artwork and fonts…'});const response=await fetch(url(asset));if(!response.ok)throw new Error('Artwork could not be downloaded. Retry to finish offline preparation.');await response.arrayBuffer();}
    await refreshWebStorage();publish({message:cancelled?'Download paused. Saved files remain available.':state.cachedBytes===state.totalBytes?'All reference data is saved for offline use.':'Some files could not be saved. Free browser storage and retry.'});
  }catch(error){publish({message:error instanceof Error?error.message:'Offline download failed. Saved files remain available.'});}
  finally{publish({downloading:false});}
}
export function cancelWebDownload(){cancelled=true;}
export async function clearWebFiles(){cancelled=true;await Promise.allSettled([...inflight.values()]);memory.clear();await caches.delete(fileCache);catalog=undefined;publish({cachedBytes:0,message:'Downloaded reference files cleared. Study progress and accounts are preserved.'});}
export function updateWebpage(){if(registration?.waiting){reloadRequested=true;registration.waiting.postMessage({type:'SKIP_WAITING'});}}
