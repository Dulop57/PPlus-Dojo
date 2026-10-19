import selection from './study-selection.json';
import type {CompendiumCatalog} from './study-metrics';
import {isExcludedStudyFighter} from './study-exclusions';
import {studyFile,preloadSnapshot,registerPreloadCleanup} from './preload';
import {readWebText} from './web-storage';
let prepared:Awaited<ReturnType<typeof readCompendium>>|undefined;
registerPreloadCleanup(()=>{prepared=undefined;});
export async function loadCompendium(signal:AbortSignal){signal.throwIfAborted();if(prepared&&preloadSnapshot().complete)return prepared;const result=await readCompendium(signal);if(preloadSnapshot().enabled)prepared=result;return result;}
async function fingerprint(text:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function readCompendium(signal:AbortSignal){
  const root=new URL(import.meta.env.BASE_URL,document.baseURI);
  const data=await studyFile<CompendiumCatalog>('compendium.json',signal);
  if(data.schemaVersion!==1||!Array.isArray(data.subjects)||!Array.isArray(data.cards)||data.cards.some(c=>!c||typeof c.id!=='string'||typeof c.answer!=='string'||!['attributes','hitboxes','stages'].includes(c.deck)))throw new Error('Invalid compendium catalog. Rebuild the study catalog.');
  if(data.selectionFingerprint!==await fingerprint(JSON.stringify(selection)))throw new Error('Your flashcard selection changed. Rebuild the study catalog to update compendium totals.');
  let matching=false;
  if(data.sourceFingerprint){const web=await readWebText('data/manifest.json',signal);if(web!==null)matching=await fingerprint(web)===data.sourceFingerprint;else{const source=await fetch(new URL('data/manifest.json',root),{signal});if(source.ok)matching=await fingerprint(await source.text())===data.sourceFingerprint;}}
  const withoutBonusFighters={...data,subjects:data.subjects.filter(s=>s.kind!=='fighter'||!isExcludedStudyFighter(s.id)),cards:data.cards.filter(c=>!isExcludedStudyFighter(c.subjectId))};
  if(!data.complete||!matching)return {catalog:{...withoutBonusFighters,complete:false,cards:withoutBonusFighters.cards.filter(c=>c.id.startsWith('workbook:'))},warning:'Fighter extraction is unavailable or out of date. Showing selected workbook cards only; completion totals are incomplete. Rebuild the study catalog after importing data.'};
  return {catalog:withoutBonusFighters,warning:''};
}
