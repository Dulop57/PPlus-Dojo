import {loadFighter,loadManifest,loadMove,retainAllData} from './loader';
import type {StudyIndex} from './study-types';
import {readWebText} from './web-storage';
export type PreloadState={enabled:boolean;loading:boolean;complete:boolean;done:number;total:number;message:string};
const preference='pplus-dojo-preload:v1';
let state:PreloadState={enabled:false,loading:false,complete:false,done:0,total:0,message:''},controller:AbortController|undefined;
const listeners=new Set<()=>void>(),studyCache=new Map<string,unknown>();
const cleanup=new Set<()=>void>();
export function registerPreloadCleanup(clear:()=>void){cleanup.add(clear);}
let images:HTMLImageElement[]=[];
export const preloadSnapshot=()=>state;
export function subscribePreload(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
function publish(patch:Partial<PreloadState>){state={...state,...patch};for(const listener of listeners)listener();}
export function preloadPreference(){try{return localStorage.getItem(preference)==='true';}catch{return false;}}
export async function studyFile<T>(path:string,signal?:AbortSignal):Promise<T>{
  signal?.throwIfAborted();
  const root=new URL(`${import.meta.env.BASE_URL}study/`,document.baseURI),url=new URL(path,root);
  if(!url.href.startsWith(root.href)||path.includes('\\'))throw new Error('Invalid study catalog path.');
  if(studyCache.has(path))return studyCache.get(path) as T;
  const text=await readWebText('study/'+path,signal);let value:unknown;
  if(text!==null)value=JSON.parse(text);else{const response=await fetch(url,{signal});if(!response.ok)throw new Error('Study catalog is unavailable. Rebuild the study catalog.');value=await response.json();}
  signal?.throwIfAborted();
  if(state.enabled)studyCache.set(path,value);return value as T;
}
export async function setPreload(enabled:boolean){
  controller?.abort();try{localStorage.setItem(preference,String(enabled));}catch{}
  retainAllData(false);studyCache.clear();
  images=[];
  for(const clear of cleanup)clear();
  publish({enabled,loading:enabled,complete:false,done:0,total:0,message:enabled?'Reading fighter indexes…':''});
  if(!enabled)return;
  retainAllData(true);const abort=new AbortController();controller=abort;
  try{
    const manifest=await loadManifest(abort.signal),fighters=[];
    for(const index of manifest.fighters){fighters.push(await loadFighter(index.path,abort.signal));publish({message:`Reading ${index.name}…`});}
    const paths=[...new Set(fighters.flatMap(f=>f.moves.map(m=>m.path)))];publish({total:paths.length,message:'Preparing animations…'});
    // A small queue bounds temporary decoder memory even when the retained
    // cache is large. Shared animations retain a single geometry payload.
    let reportedAt=0;
    for(let i=0;i<paths.length;i+=2){await Promise.all(paths.slice(i,i+2).map(path=>loadMove(path,abort.signal)));abort.signal.throwIfAborted();if(performance.now()-reportedAt>100||i+2>=paths.length){reportedAt=performance.now();publish({done:Math.min(i+2,paths.length)});}}
    const study=await studyFile<StudyIndex>('index.json',abort.signal);
    for(const fighter of study.fighters)await studyFile(fighter.path,abort.signal);
    await studyFile('compendium.json',abort.signal);
    publish({message:'Preparing reference screens and artwork…'});
    const modules=import.meta.glob('../components/*.tsx');await Promise.all(Object.values(modules).map(load=>load()));await import('../viewer/CollisionViewer');
    const {loadCompendium}=await import('./compendium-loader');await loadCompendium(abort.signal);
    const artwork=import.meta.glob('../../Images/*.{png,jpg,jpeg,webp}',{eager:true,import:'default',query:'?url'}) as Record<string,string>;
    for(const url of Object.values(artwork)){abort.signal.throwIfAborted();const image=new Image();image.src=url;await image.decode();abort.signal.throwIfAborted();images.push(image);}
    abort.signal.throwIfAborted();publish({loading:false,complete:true,message:'All fighter data and study catalogs are ready.'});
  }catch(error){if(!abort.signal.aborted){publish({loading:false,message:error instanceof Error?error.message:'Preload failed. Try again.'});}}
}
