import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,readFile,rm} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {randomUUID} from 'node:crypto';

const origin=process.env.DOJO_WEB_TEST_URL||'http://127.0.0.1:4180';
const manifest=JSON.parse(await readFile('dist/data/manifest.json','utf8'));
const entry=manifest.fighters.find(f=>f.id==='marth'),fighter=JSON.parse(await readFile(join('dist/data',entry.path),'utf8'));
const move=fighter.moves.find(m=>m.internalName==='AttackAirF');assert.ok(move);
const target=`${origin}/#/fighters/marth/${encodeURIComponent(move.id)}`;
const profile=resolve('artifacts',`web-offline-${randomUUID()}`);assert.ok(profile.startsWith(resolve('artifacts')+sep));await mkdir(profile,{recursive:true});
let context;const errors=[];
const launch=offline=>chromium.launchPersistentContext(profile,{channel:process.platform==='win32'?'msedge':undefined,headless:true,offline,viewport:{width:1440,height:960}});
try{
  context=await launch(false);let page=context.pages()[0];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin);await page.locator('.diamond-board').waitFor({timeout:60000});
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:60000});
  // The cached homepage must not carry Cloudflare's /index.html redirect.
  assert.equal(await page.evaluate(async()=>{
    const saved=await caches.match(new URL('/',location.origin));
    return !!saved&&saved.ok&&!saved.redirected;
  }),true);
  await page.getByRole('button',{name:'Account & app',exact:true}).click();
  await page.getByLabel('Email',{exact:true}).waitFor();assert.equal(await page.getByRole('checkbox',{name:'Preload all data'}).isChecked(),false);
  await expect(page.locator('.account-dialog')).toContainText('Offline files');
  await page.getByRole('button',{name:'Close account and app settings'}).click();
  await page.goto(target);await page.getByRole('heading',{name:'Forward Air',exact:true}).waitFor({timeout:60000});
  await page.getByRole('link',{name:'Study',exact:true}).click();await page.getByRole('button',{name:'Study now',exact:true}).click({timeout:60000});
  await page.getByRole('button',{name:'Reveal answer',exact:true}).click();await page.getByRole('button',{name:/^Good/}).click();
  await expect(page.locator('.study-summary')).toContainText('1cards studied');
  await page.goto(origin+'/#/compendium');await expect(page.locator('.knowledge-summary')).toBeVisible({timeout:60000});
  const cached=await page.evaluate(async()=>{const cache=await caches.open('pplus-dojo-web-files-v1');return (await cache.keys()).map(k=>k.url);});
  assert.ok(cached.some(url=>url.endsWith('.pak')));assert.ok(cached.length<100,'Opening pages must not download all reference files.');
  assert.deepEqual(errors,[]);console.log(`Web caching: online reference, study and compendium passed; ${cached.length} index/data files saved on demand.`);
  await context.close();context=await launch(true);page=context.pages()[0];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(target);await page.getByRole('heading',{name:'Forward Air',exact:true}).waitFor({timeout:60000});
  await page.getByRole('link',{name:'Study',exact:true}).click();await expect(page.locator('.study-summary')).toContainText('1cards studied',{timeout:60000});
  await page.getByRole('button',{name:'Account & app',exact:true}).click();await page.getByLabel('Email',{exact:true}).waitFor();
  await page.screenshot({path:'artifacts/web-offline-desktop.png'});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'artifacts/web-offline-mobile.png'});
  await page.getByRole('button',{name:'Clear downloaded files',exact:true}).click();
  await expect(page.locator('.account-dialog')).toContainText('Study progress and accounts are preserved.');
  const reviews=await page.evaluate(async()=>{
    const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('pplus-dojo-study');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    return new Promise((resolve,reject)=>{const request=db.transaction('reviews').objectStore('reviews').count();request.onsuccess=()=>{resolve(request.result);db.close();};request.onerror=()=>reject(request.error);});
  });assert.equal(reviews,1);assert.deepEqual(errors,[]);
  console.log('Web offline passed: browser restart without internet, cached animation and study, retained review, mobile bounds, and safe reference-cache clearing.');
}finally{if(context)await context.close();await rm(profile,{recursive:true,force:true});}
