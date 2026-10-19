import {initializeApp} from 'firebase/app';
import {initializeAuth,indexedDBLocalPersistence,onAuthStateChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,sendPasswordResetEmail,signOut,type Auth} from 'firebase/auth';
import {initializeFirestore,doc,collection,query,orderBy,startAt,startAfter,limit,getDocsFromServer,runTransaction,serverTimestamp,Timestamp,type Firestore,type QueryDocumentSnapshot} from 'firebase/firestore';
import type {FirebaseConfig} from './desktop';
import {setStudyAccount,studyAccount,pendingSyncRecords,acknowledgeSync,applyCloudRecord,readSyncCursor,writeSyncCursor,exportStudyBackup,importStudyBackup} from './data/study-progress';
import {compareVersion,validSyncRecord} from './data/sync-records';
export type AccountState={ready:boolean;configured:boolean;uid:string|null;email:string|null;sync:'local'|'syncing'|'synced'|'offline'|'error';message:string;pending:number};
let state:AccountState={ready:false,configured:false,uid:null,email:null,sync:'local',message:'',pending:0};
const listeners=new Set<()=>void>();
export const accountSnapshot=()=>state;
export function subscribeAccount(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
function publish(patch:Partial<AccountState>){state={...state,...patch};for(const listener of listeners)listener();}
let auth:Auth|undefined,db:Firestore|undefined,running:Promise<void>|undefined,epoch=0,runningEpoch=0,timer:ReturnType<typeof setTimeout>|undefined;
function schedule(){clearTimeout(timer);timer=setTimeout(()=>void syncNow(),1500);}
export async function initializeCloud(config:FirebaseConfig|null){
  if(!config){publish({ready:true,message:'Cloud accounts have not been connected yet.'});return;}
  if(!config.apiKey||!config.projectId||!config.appId||!config.authDomain)throw new Error('Incomplete Firebase configuration');
  const app=initializeApp(config);
  auth=initializeAuth(app,{persistence:indexedDBLocalPersistence});
  db=initializeFirestore(app,{experimentalAutoDetectLongPolling:true});
  await new Promise<void>((resolve,reject)=>{
    onAuthStateChanged(auth!,user=>{
      epoch++;setStudyAccount(user?.uid??null);
      publish({ready:true,configured:true,uid:user?.uid??null,email:user?.email??null,sync:user?'offline':'local',message:user?'Waiting to sync…':'Progress is saved on this device.',pending:0});
      resolve();if(user)schedule();
    },reject);
  });
  window.addEventListener('study-changed',schedule);
  window.addEventListener('online',schedule);
  window.addEventListener('focus',schedule);
  setInterval(()=>{if(state.uid&&document.visibilityState==='visible')void syncNow();},60000);
}
function authRequired(){if(!auth)throw new Error('Cloud accounts have not been connected yet.');return auth;}
export async function login(email:string,password:string){await signInWithEmailAndPassword(authRequired(),email.trim(),password);}
export async function register(email:string,password:string){await createUserWithEmailAndPassword(authRequired(),email.trim(),password);}
export async function resetPassword(email:string){await sendPasswordResetEmail(authRequired(),email.trim());}
export async function logout(){await signOut(authRequired());}
export async function importGuestProgress(){
  const uid=state.uid;if(!uid)throw new Error('Sign in before transferring progress.');
  // Fetch this account's latest data before comparing it with the guest backup.
  await syncNow();if(studyAccount()!==uid)throw new Error('Account changed. Try again.');
  const backup=await exportStudyBackup(null);
  if(studyAccount()!==uid)throw new Error('Account changed. Try again.');
  await importStudyBackup(backup);
  window.dispatchEvent(new Event('study-cloud-changed'));await syncNow();
}
async function documentId(key:string){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key));return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');}
export function syncNow():Promise<void>{
  if(running)return runningEpoch===epoch?running:running.then(()=>syncNow());
  const uid=state.uid,connection=db,currentEpoch=epoch;
  if(!uid||!connection)return Promise.resolve();
  const active=()=>epoch===currentEpoch&&state.uid===uid;
  runningEpoch=currentEpoch;
  running=(async()=>{
    if(!navigator.onLine){publish({sync:'offline',message:'Offline. New reviews are saved on this device.'});return;}
    publish({sync:'syncing',message:'Syncing study records…'});
    try{
      const records=collection(connection,'users',uid,'records');
      let pending=await pendingSyncRecords(uid);
      // Each upload compares revisions in a server transaction. A delayed offline
      // device cannot blindly replace a newer remote record.
      while(pending.length&&active()){
        publish({pending:pending.length});
        for(let i=0;i<pending.length&&active();i+=4){
          await Promise.all(pending.slice(i,i+4).map(async record=>{
            const reference=doc(records,await documentId(record.key));
            if(!active())return;
            const winner=await runTransaction(connection,async tx=>{
              const remote=await tx.get(reference),value=remote.data();
              if(value&&!validSyncRecord(value))throw new Error('Invalid cloud record');
              if(value&&compareVersion(value.version,record.version)>0)return value;
              if(!value||compareVersion(value.version,record.version)<0)tx.set(reference,{...record,updatedAt:serverTimestamp()});
              return record;
            });
            if(!active())return;
            if(winner!==record)await applyCloudRecord(winner,uid);
            await acknowledgeSync(record,uid);
          }));
        }
        pending=await pendingSyncRecords(uid);
      }
      if(!active())return;
      const storedCursor=await readSyncCursor(uid);
      let page:QueryDocumentSnapshot|undefined,cursor=storedCursor;
      while(active()){
        const constraints=[orderBy('updatedAt'),...(page?[startAfter(page)]:storedCursor?[startAt(new Timestamp(storedCursor.seconds,storedCursor.nanoseconds))]:[]),limit(500)];
        const snapshot=await getDocsFromServer(query(records,...constraints));
        if(!active())return;
        for(const row of snapshot.docs){
          const value=row.data(),updatedAt=value.updatedAt;if(!validSyncRecord(value)||!(updatedAt instanceof Timestamp))throw new Error('Invalid cloud record');
          await applyCloudRecord(value,uid);cursor={seconds:updatedAt.seconds,nanoseconds:updatedAt.nanoseconds};
        }
        page=snapshot.docs.at(-1);if(snapshot.size<500)break;
      }
      if(!active())return;
      if(cursor)await writeSyncCursor(uid,cursor);
      const remaining=await pendingSyncRecords(uid);
      publish({sync:remaining.length?'syncing':'synced',pending:remaining.length,message:remaining.length?'Finishing new reviews…':`Synced at ${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`});
      window.dispatchEvent(new Event('study-cloud-changed'));
      if(remaining.length)schedule();
    }catch(error){if(active()){const code=(error as {code?:string}).code;publish({sync:code==='permission-denied'?'error':'offline',message:code==='permission-denied'?'Cloud access denied. Check the Firebase database rules.':'Sync unavailable. Your new reviews remain saved on this device.',pending:(await pendingSyncRecords(uid)).length});}}
  })().finally(()=>{running=undefined;if(epoch!==currentEpoch&&state.uid)schedule();});
  return running;
}
