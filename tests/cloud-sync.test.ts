import 'fake-indexeddb/auto';
import {it,expect,vi} from 'vitest';
const backend=vi.hoisted(()=>({rows:new Map<string,any>(),clock:1,user:'cloud-test-alice',callback:undefined as undefined|((user:any)=>void),fail:false}));
vi.mock('firebase/app',()=>({initializeApp:()=>({})}));
vi.mock('firebase/auth',()=>({
  initializeAuth:()=>({}),indexedDBLocalPersistence:{},
  onAuthStateChanged:(_auth:unknown,callback:(user:unknown)=>void)=>{backend.callback=callback;callback({uid:backend.user,email:`${backend.user}@example.com`});return()=>{};},
  signInWithEmailAndPassword:async(_auth:unknown,email:string)=>{backend.user=email.split('@')[0];backend.callback!({uid:backend.user,email});},
  createUserWithEmailAndPassword:vi.fn(),sendPasswordResetEmail:vi.fn(),signOut:async()=>backend.callback!(null),
}));
vi.mock('firebase/firestore',async importOriginal=>{
  const actual=await importOriginal<typeof import('firebase/firestore')>();
  return {
    Timestamp:actual.Timestamp,initializeFirestore:()=>({}),
    collection:(_db:unknown,...parts:string[])=>({path:parts.join('/')}),
    doc:(root:{path:string},id:string)=>({path:`${root.path}/${id}`}),
    orderBy:()=>({}),startAt:(timestamp:unknown)=>({at:timestamp}),startAfter:(row:unknown)=>({after:row}),limit:(count:number)=>({limit:count}),
    serverTimestamp:()=>actual.Timestamp.fromMillis(backend.clock++*1000),
    runTransaction:async(_db:unknown,run:(tx:any)=>Promise<unknown>)=>{
      if(backend.fail)throw new Error('Network unavailable');
      return run({get:async(reference:{path:string})=>({data:()=>backend.rows.get(reference.path)}),set:(reference:{path:string},value:unknown)=>backend.rows.set(reference.path,value)});
    },
    query:(root:unknown,...constraints:unknown[])=>({root,constraints}),
    getDocsFromServer:async({root,constraints}:any)=>{
      if(backend.fail)throw new Error('Network unavailable');
      const at=constraints.find((c:any)=>c.at)?.at,after=constraints.find((c:any)=>c.after)?.after;
      const rows=[...backend.rows.entries()].filter(([path,r])=>path.startsWith(root.path+'/')&&(!at||r.updatedAt.toMillis()>=at.toMillis())).sort(([,a],[,b])=>a.updatedAt.toMillis()-b.updatedAt.toMillis()).map(([id,data])=>({id,data:()=>data}));
      const start=after?rows.findIndex(r=>r.id===after.id)+1:0,docs=rows.slice(start,start+(constraints.find((c:any)=>c.limit)?.limit??500));
      return {docs,size:docs.length};
    },
  };
});
import {Timestamp} from 'firebase/firestore';
import {initializeCloud,syncNow,accountSnapshot,login,logout} from '../src/cloud';
import {saveReview,loadStudyProgress,loadStudyReviews,pendingSyncRecords,rateCard,Rating,defaultSettings} from '../src/data/study-progress';
it('syncs durable offline reviews, resolves older uploads, retries failures, and switches account scope',async()=>{
  vi.useFakeTimers({toFake:['setTimeout','clearTimeout','setInterval','clearInterval']});vi.stubGlobal('window',new EventTarget());vi.stubGlobal('document',{visibilityState:'visible'});vi.stubGlobal('navigator',{onLine:true});
  try{
    await initializeCloud({apiKey:'test',appId:'test',projectId:'test',authDomain:'test'});
    const first=rateCard('cloud-card','10',undefined,Rating.Good,defaultSettings,new Date('2026-10-01T12:00:00Z'));await saveReview(first.progress,first.review);await syncNow();
    expect(accountSnapshot().sync).toBe('synced');expect(await pendingSyncRecords('cloud-test-alice')).toHaveLength(0);expect(backend.rows.size).toBe(2);
    const second=rateCard('cloud-card','10',first.progress,Rating.Easy,defaultSettings,new Date('2026-10-02T12:00:00Z'));await saveReview(second.progress,second.review);
    backend.fail=true;await syncNow();expect(accountSnapshot().sync).toBe('offline');expect(await pendingSyncRecords('cloud-test-alice')).toHaveLength(2);expect(await loadStudyReviews()).toHaveLength(2);
    backend.fail=false;
    const [key,remote]=[...backend.rows.entries()].find(([,row])=>row.kind==='progress')!;
    const queued=(await pendingSyncRecords('cloud-test-alice')).find(r=>r.kind==='progress')!;
    backend.rows.set(key,{...remote,payload:JSON.stringify({...second.progress,suspended:true}),version:{at:queued.version.at+1000,revision:crypto.randomUUID()},updatedAt:Timestamp.fromMillis(backend.clock++*1000)});
    await syncNow();expect((await loadStudyProgress()).get('cloud-card')!.suspended).toBe(true);expect(await loadStudyReviews()).toHaveLength(2);expect(await pendingSyncRecords('cloud-test-alice')).toHaveLength(0);
    await syncNow();expect(await loadStudyReviews()).toHaveLength(2);
    await logout();expect(accountSnapshot().uid).toBe(null);expect((await loadStudyProgress()).has('cloud-card')).toBe(false);
    await login('cloud-test-bob@example.com','example');await syncNow();expect((await loadStudyProgress()).size).toBe(0);expect(backend.rows.size).toBe(3);
    await login('cloud-test-alice@example.com','example');await syncNow();expect(await loadStudyReviews()).toHaveLength(2);
  }finally{vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();}
});
