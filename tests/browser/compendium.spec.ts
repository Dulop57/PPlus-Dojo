import {test,expect,type Page} from '@playwright/test';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {createEmptyCard,State} from 'ts-fsrs';
import type {KnowledgeCard} from '../../src/data/study-metrics';
import {catalog as fighterCatalog} from '../../src/data/catalog';
const available:KnowledgeCard[]=JSON.parse(readFileSync('public/study/compendium.json','utf8')).cards;
const cards=available.filter(c=>c.subjectId==='marth'&&c.deck==='attributes'&&c.id.startsWith('workbook:'));
const weight=cards.find(c=>c.field==='Weight')!;
const stage=available.find(c=>c.deck==='stages')!;
const manifest={schemaVersion:1,game:'Project+',version:'3.2',generatedAt:'fixture',parser:{name:'fixture',version:'1'},verification:'unverified',partial:true,fighters:[{id:'marth',name:'Marth',internalName:'Marth',path:'fixture/fighter.json',moveCount:0}],warnings:[],sourceChecksums:[]};
const source=JSON.stringify(manifest),sha=(value:string)=>createHash('sha256').update(value).digest('hex');
let selectionFingerprint:string;
test.beforeAll(async()=>{selectionFingerprint=sha(JSON.stringify(JSON.parse(await readFile('src/data/study-selection.json','utf8'))));});
test.beforeEach(async({page})=>{
 await page.route('**/data/manifest.json',r=>r.fulfill({contentType:'application/json',body:source}));
 await page.route('**/study/compendium.json',r=>r.fulfill({json:{schemaVersion:1,complete:true,sourceFingerprint:sha(source),selectionFingerprint,generatedAt:'fixture',subjects:[{id:'marth',name:'Marth',kind:'fighter'},{id:stage.subjectId,name:stage.subject,kind:'stage'}],cards:[...cards,stage]}}));
 await page.route('**/study/index.json',r=>r.fulfill({json:{schemaVersion:1,version:'3.2',verification:'unverified',sourceFingerprint:sha(source),generatedAt:'fixture',fighters:[{id:'marth',name:'Marth',path:'fighters/marth.json',cards:0,bubbles:0,moves:0,sha256:''}]}}));
 await page.route('**/study/fighters/marth.json',r=>r.fulfill({json:{schemaVersion:1,id:'marth',name:'Marth',sourcePath:'fixture/fighter.json',attributes:{},moves:[],hits:[],warnings:[]}}));
});
async function storedCount(page:Page){return page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('pplus-dojo-study');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return new Promise<number>(resolve=>{const r=db.transaction('reviews').objectStore('reviews').count();r.onsuccess=()=>{db.close();resolve(r.result);};});});}

for(const viewport of [{width:1100,height:602},{width:1366,height:628},{width:1920,height:1080}]){
test(`Compendium fits ${viewport.width} × ${viewport.height} with all roster information and activity tabs`,async({page,isMobile})=>{
 test.skip(isMobile,'Wide desktop layout.');
 await page.setViewportSize(viewport);
 const subjects=fighterCatalog.map(fighter=>({id:fighter.id,name:fighter.name,kind:'fighter'}));
 await page.route('**/study/compendium.json',route=>route.fulfill({json:{schemaVersion:1,complete:true,sourceFingerprint:sha(source),selectionFingerprint,generatedAt:'fixture',subjects,cards:subjects.map(subject=>({...weight,id:`fixture:${subject.id}:weight`,subjectId:subject.id,subject:subject.name}))}}));
 await page.goto('/#/compendium');
 await expect(page.locator('.knowledge-tile')).toHaveCount(subjects.length);
 await expect(page.locator('.knowledge-heading,.knowledge-explanation')).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Continue learning',exact:true})).toHaveCount(0);
 const fits=async()=>expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await fits();
 expect(await page.locator('.knowledge-tile').evaluateAll(tiles=>tiles.every(tile=>tile.scrollHeight<=tile.clientHeight+1))).toBe(true);
 const marth=page.locator('.knowledge-tile').filter({has:page.getByRole('heading',{name:'Marth',exact:true})});
 await expect(marth).toContainText('learned');await expect(marth).toContainText('studied');await expect(marth).toContainText('due');await expect(marth).toContainText('cards');await expect(marth).toContainText('Not studied yet');
 await expect(marth.locator('picture source')).toHaveAttribute('srcset',/Grid\.png/);
 await page.screenshot({path:`artifacts/compendium-compact-${viewport.width}.png`});
 await page.getByLabel('Search compendium').fill('Marth');await expect(page.locator('.knowledge-tile')).toHaveCount(1);
 await page.getByRole('tab',{name:'Activity & practice',exact:true}).click();
 for(const name of ['Study activity','Upcoming reviews','Topics needing practice','Frequently missed cards'])await expect(page.getByRole('heading',{name,exact:true})).toBeInViewport();
 await expect(page.locator('.knowledge-footnote')).toBeInViewport();await fits();
 await page.screenshot({path:`artifacts/compendium-activity-${viewport.width}.png`});
 await page.getByRole('tab',{name:'Overview',exact:true}).click();await expect(page.getByLabel('Search compendium')).toHaveValue('Marth');
 await marth.locator('a').click();await expect(page.getByRole('heading',{name:'Marth',exact:true})).toBeVisible();
 await page.locator('.knowledge-group>summary').filter({hasText:'Attributes · Main'}).click();await expect(page.locator('.knowledge-card-row')).toBeVisible();await fits();
 await page.getByRole('tab',{name:'Activity & practice',exact:true}).click();await expect(page.getByRole('heading',{name:'Study activity',exact:true})).toBeVisible();await fits();
});
}

test('Narrow Compendium uses compact fighter tiles and condensed filters',async({page})=>{
 const subjects=fighterCatalog.map(fighter=>({id:fighter.id,name:fighter.name,kind:'fighter'}));
 await page.route('**/study/compendium.json',route=>route.fulfill({json:{schemaVersion:1,complete:true,sourceFingerprint:sha(source),selectionFingerprint,generatedAt:'fixture',subjects,cards:subjects.map(subject=>({...weight,id:`fixture:${subject.id}:weight`,subjectId:subject.id,subject:subject.name}))}}));
 for(const width of [489,390]){
  await page.setViewportSize({width,height:844});await page.goto('/#/compendium');
  await expect(page.locator('.knowledge-tile')).toHaveCount(subjects.length);await expect(page.locator('.knowledge-summary')).toBeVisible();
  const roster=page.locator('.knowledge-roster'),first=page.locator('.knowledge-tile').first();
  const columns=await roster.evaluate(element=>getComputedStyle(element).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(2);
  await expect(first.locator('picture source')).toHaveAttribute('media',/max-width:650px/);
  const portrait=await first.locator('.knowledge-portrait').boundingBox();
  expect(portrait).not.toBeNull();expect(portrait!.width).toBe(40);expect(portrait!.height).toBe(40);
  await expect(first).toContainText('learned');await expect(first).toContainText('studied');await expect(first).toContainText('due');await expect(first).toContainText('cards');
  const show=await page.getByLabel('Filter compendium').boundingBox(),sort=await page.getByLabel('Sort compendium').boundingBox();
  expect(show).not.toBeNull();expect(sort).not.toBeNull();expect(show!.y).toBeCloseTo(sort!.y,0);expect(show!.height).toBe(36);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(width===489)await page.screenshot({path:'artifacts/compendium-mobile-compact-489.png'});
 }
});

test('Activity tab retains every history section on smaller screens',async({page})=>{
 await page.goto('/#/compendium');
 await page.getByRole('tab',{name:'Overview',exact:true}).focus();await page.keyboard.press('ArrowRight');
 await expect(page.getByRole('tab',{name:'Activity & practice',exact:true})).toHaveAttribute('aria-selected','true');
 for(const name of ['Study activity','Upcoming reviews','Topics needing practice','Frequently missed cards'])await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
 await expect(page.locator('.knowledge-footnote')).toContainText('Suspended cards remain in coverage totals');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('tab',{name:'Activity & practice',exact:true}).press('Home');await expect(page.locator('.knowledge-tile')).toBeVisible();
});
test('Compendium card links preview safely, reviews update learned progress, and pins persist',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/#/compendium');await expect(page.getByRole('tab',{name:'Overview',exact:true})).toBeVisible();await expect(page.locator('.knowledge-summary')).toContainText('0.0%');
 await page.getByRole('button',{name:'Pin Marth',exact:true}).click();await page.getByLabel('Filter compendium').selectOption('pinned');await expect(page.locator('.knowledge-tile')).toHaveCount(1);await page.reload();await expect(page.getByRole('button',{name:'Unpin Marth',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.locator('.knowledge-tile a').click();await expect(page.getByRole('heading',{name:'Marth',exact:true})).toBeVisible();
 await page.locator('.knowledge-group>summary').filter({hasText:'Attributes · Main'}).click();
 await page.locator('.knowledge-card-row').filter({hasText:weight.question}).getByRole('link',{name:'Open card',exact:false}).click();
 await expect(page.locator('.study-question')).toHaveText('Weight');await expect(page.getByRole('combobox',{name:'Study fighter'})).toHaveText('Marth');await expect(page.getByRole('region',{name:'Card preview'})).toBeVisible();await page.getByRole('button',{name:'Reveal answer',exact:true}).click();expect(await storedCount(page)).toBe(0);
 await page.getByRole('button',{name:'Daily review',exact:true}).click();await page.getByRole('button',{name:'Reveal answer',exact:true}).click();await page.locator('.rating-easy').click();
 await page.goto('/#/compendium/fighters/marth');await expect(page.locator('.knowledge-legend')).toContainText('Learned 1');await expect(page.locator('.knowledge-numbers')).toContainText('1reviews today');
 await page.getByRole('tab',{name:'Activity & practice',exact:true}).click();await expect(page.locator('.knowledge-streak')).toContainText('1 day streak');await page.reload();await expect(page.locator('.knowledge-legend')).toContainText('Learned 1');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
test('Due-only links exclude new cards and focus refreshes changed progress',async({page})=>{
 await page.goto('/#/compendium/fighters/marth');await expect(page.locator('.knowledge-summary')).toBeVisible();
 const p={id:weight.id,answer:weight.answer,introduced:'2026-10-01',suspended:false,card:{...createEmptyCard(new Date()),state:State.Review,reps:3,lapses:1,last_review:new Date(),due:new Date(Date.now()-60000)}};
 await page.evaluate(async p=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('pplus-dojo-study');r.onsuccess=()=>resolve(r.result);});await new Promise<void>(resolve=>{const tx=db.transaction('progress','readwrite');tx.objectStore('progress').put(p);tx.oncomplete=()=>resolve();});db.close();window.dispatchEvent(new Event('focus'));},p);
 await expect(page.locator('.knowledge-legend')).toContainText('Learned 1');await expect(page.locator('.knowledge-numbers')).toContainText('1due now');
 await page.locator('.knowledge-group>summary').filter({hasText:'Attributes · Main'}).click();await page.getByRole('link',{name:'Review due (1)',exact:true}).click();await expect(page.locator('.study-question')).toHaveText('Weight');await expect(page.locator('.study-summary')).toContainText('0new available today');
 await page.getByRole('button',{name:'Reveal answer',exact:true}).click();await page.locator('.rating-again').click();await page.goto('/#/compendium/fighters/marth');await expect(page.locator('.knowledge-legend')).toContainText('Relearning 1');await expect(page.locator('.knowledge-legend')).toContainText('Learned 0');
});
test('Stages, filters and incomplete catalogs display honest totals',async({page})=>{
 await page.goto('/#/compendium/stages');await expect(page.locator('.knowledge-tile')).toHaveCount(1);await page.getByLabel('Search compendium').fill('no match');await expect(page.locator('.knowledge-empty')).toBeVisible();await page.getByLabel('Search compendium').fill('');await page.locator('.knowledge-tile a').click();await expect(page.getByRole('heading',{name:stage.subject,exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Stage stats',exact:true})).toBeVisible();
 await page.route('**/data/manifest.json',r=>r.fulfill({status:404}));await page.goto('/#/compendium');await page.reload();await expect(page.getByRole('alert').filter({hasText:'completion totals are incomplete'})).toBeVisible();await expect(page.locator('.knowledge-summary')).toContainText('INCOMPLETE TOTALS');
});
test('Restoring an existing study backup is reflected in compendium without a migration',async({page})=>{
 await page.goto('/#/study');await expect(page.locator('.study-summary')).toBeVisible();
 const at=new Date(),backup={schemaVersion:1,app:'P+ Dojo Study',exportedAt:at.toISOString(),settings:{retention:.9,newPerDay:20},reviews:[],progress:[{id:weight.id,answer:weight.answer,introduced:'2026-10-01',suspended:true,card:{...createEmptyCard(at),state:State.Review,reps:4,lapses:1,last_review:at,due:new Date(at.getTime()+86400000)}}]};
 await page.getByLabel('Restore study backup').setInputFiles({name:'progress.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await expect(page.getByRole('status').filter({hasText:'Backup restored'})).toBeVisible();
 await page.goto('/#/compendium/fighters/marth');await expect(page.locator('.knowledge-legend')).toContainText('Learned 1');await expect(page.locator('.knowledge-numbers')).toContainText('1suspended');await expect(page.locator('.knowledge-numbers')).toContainText('0due now');
});
