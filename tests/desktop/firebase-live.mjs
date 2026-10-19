// Explicit owner-run integration test against the configured Firebase project.
// Creates a temporary account and a few study records, then removes the account.
// Its tiny orphaned Firestore records require console/admin deletion, because the
// production rules deliberately disallow client deletion. Never run this in CI.
import {_electron as electron,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,readFile,rm} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {randomUUID,randomBytes,createHash} from 'node:crypto';

if(process.env.DOJO_FIREBASE_LIVE_TEST!=='1')throw new Error('Set DOJO_FIREBASE_LIVE_TEST=1 to explicitly run a live Firebase test.');
const config=JSON.parse(await readFile('desktop.config.json','utf8')).firebase;
assert.ok(config?.apiKey&&config?.projectId,'Configure Firebase first.');
const run=randomUUID(),email=`dojo-sync-test-${run}@example.com`,password=randomBytes(32).toString('base64url');
const profiles=['a','b'].map(name=>resolve('artifacts',`firebase-live-${run}-${name}`));
for(const profile of profiles){assert.ok(profile.startsWith(resolve('artifacts')+sep));await mkdir(profile,{recursive:true});}
let app,token,uid;const errors=[];
async function authRequest(action,body){
  const response=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${config.apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const value=await response.json();assert.ok(response.ok,`Firebase Auth ${action}: ${value.error?.message??response.status}`);return value;
}
async function launch(profile){
  const instance=await electron.launch({...(process.env.DOJO_DESKTOP_EXECUTABLE?{executablePath:process.env.DOJO_DESKTOP_EXECUTABLE,args:[`--user-data-dir=${profile}`]}:{args:['.',`--user-data-dir=${profile}`]}),env:{...process.env,DOJO_DESKTOP_TEST:'1'},timeout:60000});
  app=instance;const page=await instance.firstWindow();
  await instance.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
  page.on('pageerror',error=>errors.push(error.message));
  await page.locator('.diamond-board').waitFor({timeout:60000});return page;
}
async function signIn(page,signup=false){
  await page.getByRole('button',{name:'Account & app',exact:true}).click();
  await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);
  if(signup)await page.getByRole('button',{name:'Create account',exact:true}).click();
  await page.locator('form').getByRole('button',{name:signup?'Create account':'Sign in',exact:true}).click();
  await page.getByRole('button',{name:email,exact:true}).waitFor({timeout:60000});
}
async function sync(page){
  await page.getByRole('button',{name:email,exact:true}).click();
  await expect(page.getByRole('button',{name:'Sync now',exact:true})).toBeEnabled({timeout:60000});
  await page.getByRole('button',{name:'Sync now',exact:true}).click();
  await expect(page.locator('.account-dialog')).toContainText('Synced at',{timeout:90000});
  await page.getByRole('button',{name:'Close account and app settings'}).click();
}
async function review(page){
  await page.getByRole('link',{name:'Study',exact:true}).click();
  await page.getByRole('button',{name:'Study now',exact:true}).click({timeout:60000});
  await page.getByRole('button',{name:'Reveal answer',exact:true}).click();
  await page.getByRole('button',{name:/^Good/}).click();
}
async function stored(page,store){
  return page.evaluate(async({uid,store})=>{
    const db=await new Promise((resolve,reject)=>{const request=indexedDB.open(`pplus-dojo-study-account:${uid}`);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    return new Promise((resolve,reject)=>{const request=db.transaction(store).objectStore(store).getAll();request.onsuccess=()=>{resolve(request.result);db.close();};request.onerror=()=>reject(request.error);});
  },{uid,store});
}
try{
  let page=await launch(profiles[0]);await signIn(page,true);
  const account=await authRequest('signInWithPassword',{email,password,returnSecureToken:true});token=account.idToken;uid=account.localId;
  await sync(page);await review(page);await sync(page);
  assert.equal((await stored(page,'reviews')).length,1);assert.equal((await stored(page,'sync')).length,0);
  const original=await stored(page,'progress');assert.equal(original.length,1);
  console.log('Live Firebase: account creation and study upload passed.');
  await app.close();app=undefined;
  page=await launch(profiles[1]);await signIn(page);await sync(page);
  assert.deepEqual(await stored(page,'progress'),original);assert.equal((await stored(page,'reviews')).length,1);
  console.log('Live Firebase: second device downloaded identical card scheduling and review history.');
  await page.context().setOffline(true);await review(page);
  assert.equal((await stored(page,'reviews')).length,2);assert.ok((await stored(page,'sync')).length>=2);
  await app.close();app=undefined;
  page=await launch(profiles[1]);
  await page.getByRole('button',{name:email,exact:true}).waitFor({timeout:60000});await sync(page);
  assert.equal((await stored(page,'reviews')).length,2);assert.equal((await stored(page,'sync')).length,0);
  console.log('Live Firebase: login persisted; offline review survived restart and synced.');
  await app.close();app=undefined;
  page=await launch(profiles[0]);await page.getByRole('button',{name:email,exact:true}).waitFor({timeout:60000});await sync(page);
  assert.equal((await stored(page,'reviews')).length,2);await sync(page);assert.equal((await stored(page,'reviews')).length,2);
  const recordId=createHash('sha256').update(`progress:${original[0].id}`).digest('hex');
  const endpoint=`https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/users/${uid}/records/${recordId}`;
  assert.equal((await fetch(endpoint)).status,403,'Unauthenticated reads must be denied.');
  assert.equal((await fetch(endpoint,{headers:{Authorization:`Bearer ${token}`}})).status,200,'Owner can read their record.');
  assert.equal((await fetch(endpoint.replace(`/users/${uid}/`,`/users/another-account/`),{headers:{Authorization:`Bearer ${token}`}})).status,403,'Users must not read other accounts.');
  assert.deepEqual(errors,[]);
  console.log('Live Firebase passed: registration, login, persistence, two-device sync, offline retry, deduplication, and private database rules.');
}finally{
  if(app)await app.close();
  // Recover a token if a UI assertion failed after account creation.
  if(!token){try{const value=await authRequest('signInWithPassword',{email,password,returnSecureToken:true});token=value.idToken;}catch{}}
  if(token){await authRequest('delete',{idToken:token});console.log('Temporary Firebase Auth account removed.');}
  for(const profile of profiles)await rm(profile,{recursive:true,force:true});
}
