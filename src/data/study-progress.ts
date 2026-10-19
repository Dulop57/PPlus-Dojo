import {createEmptyCard,fsrs,Rating,type Card,type Grade,type ReviewLog} from 'ts-fsrs';
import {compareVersion,reviewIdentity,validSyncRecord,type RecordKind,type RecordVersion,type SyncRecord} from './sync-records';
export {Rating};
export type StudySettings={retention:number;newPerDay:number};
export type Progress={id:string;card:Card;introduced:string;suspended:boolean;answer:string};
export type StoredReview={id?:number;cardId:string;log:ReviewLog;answer:string};
export const defaultSettings:StudySettings={retention:.9,newPerDay:20};
export function studyDay(now=new Date()){return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;}
export function scheduler(settings:StudySettings){return fsrs({request_retention:settings.retention,enable_fuzz:false,learning_steps:['1m','10m'],relearning_steps:['10m']});}
export function restoreProgress(row:Progress):Progress{return {...row,card:{...row.card,due:new Date(row.card.due),...(row.card.last_review?{last_review:new Date(row.card.last_review)}:{})}};}
export function rateCard(id:string,answer:string,previous:Progress|undefined,grade:Grade,settings:StudySettings,now=new Date()){
  const result=scheduler(settings).next(previous&&previous.answer===answer?previous.card:createEmptyCard(now),now,grade);
  return {progress:{id,card:result.card,introduced:previous?.introduced??studyDay(now),suspended:previous?.suspended??false,answer},review:{cardId:id,log:result.log,answer}};
}
export function studyQueue<T extends {id:string;answer:string}>(cards:T[],progress:Map<string,Progress>,settings:StudySettings,now=new Date()){
  const day=studyDay(now),introduced=[...progress.values()].filter(p=>p.introduced===day).length;
  const eligible=cards.filter(c=>!progress.get(c.id)?.suspended);
  const due=eligible.filter(c=>{const p=progress.get(c.id);return p&&p.card.reps>0&&(p.answer!==c.answer||p.card.due.getTime()<=now.getTime());}).sort((a,b)=>progress.get(a.id)!.card.due.getTime()-progress.get(b.id)!.card.due.getTime());
  const fresh=eligible.filter(c=>!progress.get(c.id)?.card.reps).slice(0,Math.max(0,settings.newPerDay-introduced));
  return {cards:[...due,...fresh],due:due.length,new:fresh.length,introduced};
}
let activeAccount:string|null=null,lastMutation=0;
const databases=new Map<string,Promise<IDBDatabase>>();
export function studyAccount(){return activeAccount;}
export function setStudyAccount(uid:string|null){activeAccount=uid;}
function changed(){if(typeof window!=='undefined')window.dispatchEvent(new Event('study-changed'));}
function openDatabase(account=activeAccount){
  const name=account?`pplus-dojo-study-account:${account}`:'pplus-dojo-study';
  if(databases.has(name))return databases.get(name)!;
  const database=new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open(name,2);
    request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('progress')){db.createObjectStore('progress',{keyPath:'id'});db.createObjectStore('reviews',{keyPath:'id',autoIncrement:true});db.createObjectStore('settings');}if(!db.objectStoreNames.contains('sync')){db.createObjectStore('sync',{keyPath:'key'});db.createObjectStore('meta');}};
    request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();databases.delete(name);};resolve(request.result);};request.onerror=()=>{databases.delete(name);reject(new Error('Study storage is unavailable. Enable storage to save progress.'));};
    request.onblocked=()=>reject(new Error('Close other Dojo tabs and reload to open study storage.'));
  });databases.set(name,database);return database;
}
async function all<T>(store:string,account=activeAccount):Promise<T[]>{const db=await openDatabase(account);return new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function loadStudyProgress(account=activeAccount){return new Map((await all<Progress>('progress',account)).map(p=>[p.id,restoreProgress(p)]));}
export async function loadStudyReviews(account=activeAccount){return all<StoredReview>('reviews',account);}
export async function loadSettings(account=activeAccount):Promise<StudySettings>{const db=await openDatabase(account);return new Promise((resolve,reject)=>{const r=db.transaction('settings').objectStore('settings').get('preferences');r.onsuccess=()=>resolve(r.result??defaultSettings);r.onerror=()=>reject(r.error);});}
const pendingWrites=new Set<Promise<void>>();
function transaction(stores:string[],write:(tx:IDBTransaction)=>void,account=activeAccount){
  const database=openDatabase(account);
  const work=(async()=>{const db=await database;await new Promise<void>((resolve,reject)=>{const tx=db.transaction(stores,'readwrite');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error??new Error('Progress could not be saved.'));tx.onabort=()=>reject(tx.error??new Error('Progress could not be saved.'));try{write(tx);}catch(e){tx.abort();reject(e);}});})();
  pendingWrites.add(work);work.then(()=>pendingWrites.delete(work),()=>pendingWrites.delete(work));return work;
}
export async function flushStudyWrites(){while(pendingWrites.size)await Promise.all([...pendingWrites]);}
function queue(tx:IDBTransaction,kind:RecordKind,id:string,payload:unknown){
  lastMutation=Math.max(Date.now(),lastMutation+1);
  const record:SyncRecord={key:`${kind}:${id}`,kind,payload:JSON.stringify(payload),version:{at:lastMutation,revision:crypto.randomUUID()}};
  tx.objectStore('sync').put(record);tx.objectStore('meta').put(record.version,`version:${record.key}`);
}
export async function saveReview(progress:Progress,review:StoredReview){const {id:_,...row}=review;await transaction(['progress','reviews','sync','meta'],tx=>{tx.objectStore('progress').put(progress);tx.objectStore('reviews').add(row);queue(tx,'progress',progress.id,progress);queue(tx,'reviews',reviewIdentity(row).slice(8),row);});changed();}
export async function saveProgress(progress:Progress){await transaction(['progress','sync','meta'],tx=>{tx.objectStore('progress').put(progress);queue(tx,'progress',progress.id,progress);});changed();}
export async function saveSettings(settings:StudySettings){await transaction(['settings','sync','meta'],tx=>{tx.objectStore('settings').put(settings,'preferences');queue(tx,'settings','preferences',settings);});changed();}
export async function exportStudyBackup(account=activeAccount){return {schemaVersion:1,app:'P+ Dojo Study',exportedAt:new Date().toISOString(),settings:await loadSettings(account),progress:await all<Progress>('progress',account),reviews:await all<StoredReview>('reviews',account)};}
export function validateBackup(value:unknown){
  const data=value as Awaited<ReturnType<typeof exportStudyBackup>>;
  if(!data||data.schemaVersion!==1||data.app!=='P+ Dojo Study'||!Array.isArray(data.progress)||!Array.isArray(data.reviews))throw new Error('Choose a P+ Dojo Study backup.');
  if(!data.settings||!Number.isFinite(data.settings.retention)||data.settings.retention<.7||data.settings.retention>.97||!Number.isInteger(data.settings.newPerDay)||data.settings.newPerDay<0||data.settings.newPerDay>200)throw new Error('The backup has invalid study settings.');
  const ids=new Set<string>();
  for(const row of data.progress){
    if(!row||typeof row.id!=='string'||ids.has(row.id)||typeof row.answer!=='string'||typeof row.introduced!=='string'||typeof row.suspended!=='boolean'||!row.card)throw new Error('The backup has invalid card progress.');
    ids.add(row.id);const c=restoreProgress(row).card;
    if(!Number.isFinite(c.due.getTime())||c.last_review&&!Number.isFinite(c.last_review.getTime())||![0,1,2,3].includes(c.state)||!['stability','difficulty','elapsed_days','scheduled_days','learning_steps','reps','lapses'].every(k=>Number.isFinite(c[k as keyof Card])&&Number(c[k as keyof Card])>=0))throw new Error('The backup has invalid scheduling data.');
  }
  for(const review of data.reviews)if(!review||typeof review.cardId!=='string'||typeof review.answer!=='string'||!review.log||![1,2,3,4].includes(review.log.rating)||!Number.isFinite(new Date(review.log.review).getTime()))throw new Error('The backup has invalid review history.');
  return data;
}
// Restore atomically. Merge progress by latest review and deduplicate logs,
// allowing a backup to be imported repeatedly without duplicating history.
export async function importStudyBackup(value:unknown){
  const account=activeAccount,data=validateBackup(value),existing=await loadStudyProgress(account),logs=await all<StoredReview>('reviews',account);
  const logKey=(r:StoredReview)=>reviewIdentity({cardId:r.cardId,answer:r.answer,log:r.log});
  const keys=new Set(logs.map(logKey));
  await transaction(['progress','reviews','settings','sync','meta'],tx=>{
    for(const row of data.progress){const p=restoreProgress(row),old=existing.get(p.id);if(!old||Number(p.card.last_review??0)>=Number(old.card.last_review??0)){tx.objectStore('progress').put(p);queue(tx,'progress',p.id,p);}}
    for(const log of data.reviews)if(!keys.has(logKey(log))){keys.add(logKey(log));const {id:_,...row}=log;const restored={...row,log:{...row.log,review:new Date(row.log.review),due:new Date(row.log.due)}};tx.objectStore('reviews').add(restored);queue(tx,'reviews',logKey(restored).slice(8),restored);}
    tx.objectStore('settings').put(data.settings,'preferences');queue(tx,'settings','preferences',data.settings);
  },account);changed();
}
export async function pendingSyncRecords(account:string){return all<SyncRecord>('sync',account);}
export async function acknowledgeSync(record:SyncRecord,account:string){await transaction(['sync'],tx=>{const store=tx.objectStore('sync'),request=store.get(record.key);request.onsuccess=()=>{if(request.result?.version.revision===record.version.revision)store.delete(record.key);};},account);}
export async function readSyncCursor(account:string):Promise<{seconds:number;nanoseconds:number}|null>{const db=await openDatabase(account);return new Promise((resolve,reject)=>{const r=db.transaction('meta').objectStore('meta').get('cursor');r.onsuccess=()=>resolve(r.result??null);r.onerror=()=>reject(r.error);});}
export async function writeSyncCursor(account:string,cursor:{seconds:number;nanoseconds:number}){await transaction(['meta'],tx=>tx.objectStore('meta').put(cursor,'cursor'),account);}
export async function applyCloudRecord(record:SyncRecord,account:string){
  if(!validSyncRecord(record))throw new Error('Invalid cloud record');
  const payload=JSON.parse(record.payload);
  validateBackup({schemaVersion:1,app:'P+ Dojo Study',settings:record.kind==='settings'?payload:defaultSettings,progress:record.kind==='progress'?[payload]:[],reviews:record.kind==='reviews'?[payload]:[]});
  if(record.kind==='progress'&&record.key!==`progress:${payload.id}`||record.kind==='settings'&&record.key!=='settings:preferences'||record.kind==='reviews'&&record.key!==reviewIdentity(payload))throw new Error('Cloud record identity mismatch');
  let applied=false;
  await transaction(['progress','reviews','settings','sync','meta'],tx=>{
    const meta=tx.objectStore('meta'),request=meta.get(`version:${record.key}`);
    request.onsuccess=()=>{
      const previous=request.result as RecordVersion|undefined;
      if(previous&&compareVersion(previous,record.version)>=0)return;
      lastMutation=Math.max(lastMutation,record.version.at);
      if(record.kind==='progress')tx.objectStore('progress').put(restoreProgress(payload));
      if(record.kind==='settings')tx.objectStore('settings').put(payload,'preferences');
      if(record.kind==='reviews'&&!previous){const {id:_,...row}=payload;tx.objectStore('reviews').add({...row,log:{...row.log,review:new Date(row.log.review),due:new Date(row.log.due)}});}
      meta.put(record.version,`version:${record.key}`);tx.objectStore('sync').delete(record.key);applied=true;
    };
  },account);
  return applied;
}
