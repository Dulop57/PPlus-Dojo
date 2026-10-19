import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {sandboxMove} from '../../src/data/sandbox';
import {extractStudyHits} from '../../scripts/study-hits.mjs';
const entry={id:'Attack11-72',internalName:'Attack11',path:'fixture/move.json',totalFrames:sandboxMove.frames.length,warnings:[],sha256:''};
const move={...sandboxMove,fighterId:'marth',moveId:entry.id,name:entry.internalName,frames:sandboxMove.frames.map(frame=>({...frame,hit_boxes:frame.hit_boxes.flatMap(box=>{
  if(!('Hit'in box.next_values))return [box];
  return [box,{...box,hitbox_id:1,next_values:{Hit:{...box.next_values.Hit,hitbox_id:1,damage:7}}},{...box,hitbox_id:2,next_size:7.5,next_values:{Hit:{...box.next_values.Hit,hitbox_id:2,damage:13,trajectory:45,kbg:99,bkb:20,wdsk:0}}}];
})}))};
const fighter={schemaVersion:1,id:'marth',name:'Marth',sourcePath:'fixture/fighter.json',attributes:{weight:87,jump_squat_frames:4},hits:extractStudyHits(move,entry),moves:[],warnings:[]};
test.beforeEach(async({page})=>{
  await page.route('**/data/manifest.json',route=>route.fulfill({json:{schemaVersion:1,game:'Project+',version:'3.2',generatedAt:'fixture',parser:{name:'fixture',version:'1'},verification:'unverified',partial:true,fighters:[{id:'marth',name:'Marth',internalName:'Marth',path:fighter.sourcePath,moveCount:1}],warnings:[],sourceChecksums:[]}}));
  await page.route('**/study/index.json',route=>route.fulfill({json:{schemaVersion:1,version:'3.2',verification:'unverified',sourceFingerprint:'fixture',generatedAt:'fixture',fighters:[{id:'marth',name:'Marth',path:'fighters/marth.json',cards:2,bubbles:fighter.hits.length,moves:1,sha256:''}]}}));
  await page.route('**/study/fighters/marth.json',route=>route.fulfill({json:fighter}));
  await page.route('**/data/fixture/move.json',route=>route.fulfill({json:move}));
});

test('Narrow Study deck tabs leave the floating navigation button clear',async({page})=>{
  for(const width of [390,489]){
    await page.setViewportSize({width,height:844});
    await page.goto('/#/study');
    const nav=page.getByRole('navigation',{name:'Study decks'});
    const tabs=nav.getByRole('button');
    await expect(tabs).toHaveCount(3);
    const menu=await page.getByRole('button',{name:'Open navigation'}).boundingBox();
    const lastTab=await tabs.last().boundingBox();
    expect(menu).not.toBeNull();expect(lastTab).not.toBeNull();
    expect(lastTab!.x+lastTab!.width).toBeLessThan(menu!.x);
    await tabs.last().click();
    await expect(tabs.last()).toHaveAttribute('aria-pressed','true');
  }
  await page.setViewportSize({width:1280,height:800});
  await page.goto('/#/study');
  await expect(page.getByRole('button',{name:'Open navigation'})).toBeHidden();
  expect(await page.getByRole('navigation',{name:'Study decks'}).evaluate(element=>getComputedStyle(element).paddingRight)).toBe('0px');
});

for(const viewport of [{width:1100,height:602},{width:1366,height:628},{width:1920,height:1080}]){
test(`Wide Study fits ${viewport.width} × ${viewport.height} in browsing, hitbubble review and settings views`,async({page,isMobile})=>{
  test.skip(isMobile,'Desktop compact layout.');
    await page.setViewportSize(viewport);
    await page.goto('/#/study');
    await expect(page.getByRole('navigation',{name:'Study decks'})).toBeVisible();
    await expect(page.locator('.study-heading')).toHaveCount(0);
    await page.getByLabel('Study topic').selectOption('Attributes · Main');
    await page.getByLabel('Study stat').selectOption('Weight');
    await page.getByRole('button',{name:'Reveal answer',exact:true}).click();
    const fits=async()=>{
      const size=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,sections:[...document.querySelectorAll('.study-page,.study-summary,.study-filters,.study-layout,.study-tools')].map(element=>({class:element.className,rect:element.getBoundingClientRect().toJSON()}))}));
      expect(size.scrollWidth<=size.width&&size.scrollHeight<=size.height,JSON.stringify(size)).toBe(true);
      const session=(await page.locator('.study-session').boundingBox())!;
      expect(session.y+session.height).toBeLessThanOrEqual(viewport.height);
      expect(await page.locator('.study-session').evaluate(element=>element.scrollHeight<=element.clientHeight+1)).toBe(true);
    };
    await fits();
    await page.getByRole('button',{name:'Hitbubbles',exact:true}).click();
    await page.locator('.study-hit-view canvas').waitFor();
    await page.getByRole('button',{name:'Reveal answer',exact:true}).click();
    await fits();
    await page.screenshot({path:`artifacts/study-compact-${viewport.width}.png`});
    await page.getByRole('button',{name:'Study now',exact:true}).click();
    await page.getByRole('button',{name:'Reveal answer',exact:true}).click();
    await fits();
    await expect(page.locator('.rating-good')).toBeInViewport();
    await page.getByText('Scheduling, backups & export',{exact:true}).click();
    await expect(page.getByRole('button',{name:'Back up progress',exact:true})).toBeInViewport();
    await fits();
    await page.getByText('Coverage & data accuracy',{exact:true}).click();
    await fits();
});
}

test('Fighter dropdown shows option icons and supports keyboard selection and dismissal',async({page,isMobile})=>{
  if(!isMobile)await page.setViewportSize({width:781,height:602});
  await page.goto('/#/study');
  const combo=page.getByRole('combobox',{name:'Study fighter'});
  await combo.click();
  await expect(combo).toHaveAttribute('aria-expanded','true');
  for(const name of ['Bowser','Captain Falcon','Marth'])await expect(page.getByRole('option',{name,exact:true}).locator('img')).toBeVisible();
  const menu=(await page.getByRole('listbox',{name:'Fighters'}).boundingBox())!;
  expect(menu.x).toBeGreaterThanOrEqual(0);expect(menu.y).toBeGreaterThanOrEqual(0);
  expect(menu.y+menu.height).toBeLessThanOrEqual((await page.viewportSize())!.height);
  await page.screenshot({path:`artifacts/study-fighter-menu-${isMobile?'mobile':'desktop'}.png`});
  await combo.press('Home');await combo.press('Enter');
  await expect(combo).toHaveText('All fighters');
  await expect(combo).toHaveAttribute('aria-expanded','false');
  await combo.press('ArrowDown');await combo.press('m');await combo.press('a');await combo.press('r');await combo.press('t');await combo.press('Enter');
  await expect(combo).toHaveText('Marth');
  await combo.click();await combo.press('ArrowDown');await combo.press('Escape');
  await expect(combo).toHaveText('Marth');
  await expect(page.getByRole('listbox',{name:'Fighters'})).toHaveCount(0);
  await combo.click();await page.locator('.study-toolbar>span').click();
  await expect(combo).toHaveAttribute('aria-expanded','false');
  if(isMobile){await combo.tap();await page.getByRole('option',{name:'Marth',exact:true}).tap();await expect(combo).toHaveText('Marth');await expect(combo).toHaveAttribute('aria-expanded','false');}
});

test('Study icons and compact animation playback preserve the card and its review state',async({page,isMobile})=>{
  if(!isMobile)await page.setViewportSize({width:781,height:602});
  await page.goto('/#/study');
  await expect(page.locator('.study-fighter-combobox img')).toBeVisible();
  await page.getByRole('combobox',{name:'Study fighter'}).click();
  await page.getByRole('option',{name:'All fighters',exact:true}).click();
  await expect(page.locator('.study-fighter-combobox img')).toHaveCount(0);
  await page.getByRole('combobox',{name:'Study fighter'}).click();
  await page.getByRole('option',{name:'Marth',exact:true}).click();
  await expect(page.locator('.main-footer')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'View animation',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Hitbubbles',exact:true}).click();
  await page.locator('.study-card-list button').filter({hasText:'Frame 6 · ID 2'}).click();
  const question=await page.locator('.study-question').innerText();
  const progress=(await page.locator('.study-card-footer').textContent())!;
  const href=await page.getByRole('link',{name:'Open full reference ↗',exact:true}).getAttribute('href');
  await page.getByRole('button',{name:'View animation',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.locator('canvas')).toBeVisible();
  expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
  await page.screenshot({path:`artifacts/study-animation-${isMobile?'mobile':'desktop'}.png`});
  await expect(dialog.getByLabel('Animation frame')).toHaveValue('6');
  await expect(dialog.locator('.hitbox-section,.hit-calculators,.move-summary-compact')).toHaveCount(0);
  await dialog.getByRole('button',{name:'Next frame',exact:true}).click();
  await expect(dialog.getByLabel('Animation frame')).toHaveValue('7');
  await dialog.getByRole('button',{name:'Last frame',exact:true}).click();
  await expect(dialog.getByLabel('Animation frame')).toHaveValue(String(move.frames.length));
  await dialog.getByRole('button',{name:'First frame',exact:true}).click();
  await dialog.getByRole('button',{name:'Loop animation',exact:true}).click();
  await dialog.getByLabel('Playback speed').selectOption('2');
  await dialog.getByRole('button',{name:'Play animation',exact:true}).click();
  await expect(dialog.getByRole('button',{name:'Play animation',exact:true})).toBeVisible();
  await expect(dialog.getByLabel('Animation frame')).toHaveValue(String(move.frames.length));
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.study-question')).toHaveText(question);
  await expect(page.locator('.study-card-footer')).toHaveText(progress);
  expect(new URL(page.url()).hash).toBe('#/study');
  await page.getByRole('button',{name:'View animation',exact:true}).click();
  await dialog.getByRole('button',{name:'Close animation',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  expect(href).toContain('#/fighters/marth/Attack11-72');
  await page.getByRole('link',{name:'Open full reference ↗',exact:true}).click();
  await expect(page).toHaveURL(/#\/fighters\/marth\/Attack11-72/);
});
test('Reviews persist across reloads, backup round-trips, and preview does not rate a card',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/#/study');await expect(page.getByRole('navigation',{name:'Study decks'})).toBeVisible();
  await page.getByLabel('Study topic').selectOption('Attributes · Main');await page.getByLabel('Study stat').selectOption('Weight');
  await page.getByRole('button',{name:'Reveal answer',exact:true}).click();await expect(page.locator('.study-answer>p').first()).toHaveText('87\nRank: #25');
  await expect(page.locator('.study-answer .study-card-note')).toHaveCount(0);
  await expect(page.locator('.study-answer details')).toHaveCount(0);
  expect((await page.getByLabel('Study stat').locator('option').allTextContents()).some(label=>/z[\s-]*score/i.test(label))).toBe(false);
  await expect(page.locator('.study-card-footer')).toContainText('Not studied yet');
  await page.getByRole('button',{name:'Study now',exact:true}).click();await page.getByRole('button',{name:'Reveal answer',exact:true}).click();await page.locator('.rating-good').click();
  await expect(page.getByRole('heading',{name:'You’re caught up.'})).toBeVisible();
  await page.reload();await page.getByLabel('Study topic').selectOption('Attributes · Main');await page.getByLabel('Study stat').selectOption('Weight');
  await expect(page.locator('.study-card-footer')).toContainText('1 reviews');
  await page.getByText('Scheduling, backups & export',{exact:true}).click();
  const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Back up progress',exact:true}).click();const downloaded=await downloading;
  const data=JSON.parse(await readFile((await downloaded.path())!,'utf8'));expect(data.progress).toHaveLength(1);expect(data.reviews).toHaveLength(1);expect(data.progress[0].card.reps).toBe(1);
  await page.getByLabel('Restore study backup').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await expect(page.getByRole('status').filter({hasText:'Backup restored'})).toBeVisible();
  const downloadingAgain=page.waitForEvent('download');await page.getByRole('button',{name:'Back up progress',exact:true}).click();const again=JSON.parse(await readFile((await(await downloadingAgain).path())!,'utf8'));expect(again.reviews).toHaveLength(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
test('Deleted stats stay out of the library and exported cards include merged values and ranks',async({page})=>{
  await page.goto('/#/study');await page.getByLabel('Study topic').selectOption('Attributes · Main');await page.getByLabel('Study stat').selectOption('Boost Grab');
  await expect(page.locator('.study-question')).toHaveText('Boost Grab');
  await expect(page.locator('.study-question img')).toHaveAttribute('alt','Marth');
  await page.getByText('Scheduling, backups & export',{exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export cards for Anki',exact:true}).click();const text=await readFile((await(await download).path())!,'utf8');expect(text).toContain('#separator:Tab');expect(text).toContain('Boost Grab');expect(text).toContain('Rank: #');expect(text).not.toContain('Z-score');
  await page.getByRole('button',{name:'Hitbubbles',exact:true}).click();await expect(page.locator('.study-hit-view canvas')).toBeVisible();await expect(page.getByLabel('Study stat')).toHaveValue('all');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('A pointed bubble at the displayed frame has exactly one six-column answer table',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/#/study');await page.getByRole('button',{name:'Hitbubbles',exact:true}).click();
  await page.locator('.study-card-list button').filter({hasText:'Frame 6 · ID 2'}).click();
  await expect(page.locator('.study-bubble-label')).toContainText('TARGET BUBBLE ID 2');await expect(page.locator('.study-bubble-label')).toContainText('Frame 6');
  await expect(page.locator('.study-hit-view .viewer-stage')).toHaveAttribute('data-selected-hitbox','2');await expect(page.locator('.study-hit-view canvas')).toBeVisible();
  await expect(page.getByRole('table',{name:'Selected hitbubble data'})).toHaveCount(0);
  await page.getByRole('button',{name:'Reveal answer',exact:true}).click();
  const table=page.getByRole('table',{name:'Selected hitbubble data'});
  expect(await table.locator('th').allTextContents()).toEqual(['ID / type','Damage','Angle','KBG','BKB','WDSK']);
  expect(await table.locator('tbody td').allTextContents()).toEqual(['2 / Hit','13%','45°','99','20','0']);
  await expect(table.locator('tbody tr')).toHaveCount(1);await expect(page.locator('.study-answer .study-card-note')).toHaveCount(0);
  await page.getByRole('button',{name:'Study now',exact:true}).click();await page.getByRole('button',{name:'Reveal answer',exact:true}).click();await page.locator('.rating-good').click();
  await expect(page.locator('.study-summary')).toContainText('cards studied');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
test('Stage cards keep source coordinates and a missing catalog leaves workbook study available',async({page})=>{
  await page.route('**/study/index.json',route=>route.fulfill({status:404,body:'missing'}));
  await page.goto('/#/study');await expect(page.getByRole('alert')).toContainText('Study catalog is unavailable');
  await page.getByRole('button',{name:'Stage stats',exact:true}).click();await page.getByLabel('Study stage').selectOption('battlefield');await page.getByLabel('Study stat').selectOption('Stage width');
  await page.getByRole('button',{name:'Reveal answer',exact:true}).click();await expect(page.locator('.study-answer>p').first()).toHaveText('136.8');
  await expect(page.getByRole('link',{name:'Open reference ↗'})).toHaveAttribute('href','#/stages/battlefield');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('A stale collision catalog is rejected instead of teaching an older extraction',async({page})=>{
  await page.route('**/study/fighters/marth.json',route=>route.fulfill({json:{...fighter,sourcePath:'old-generation/fighter.json'}}));
  await page.goto('/#/study');
  await expect(page.getByRole('alert')).toContainText('older dataset');
  await expect(page.locator('.study-question')).not.toContainText('Jumpsquat');
});
test('Move cards show active ranges and one First Actionable Frame in browsing, review and export',async({page})=>{
  await page.route('**/data/fixture/fighter.json',route=>route.fulfill({json:{schemaVersion:1,id:'marth',name:'Marth',attributes:{weight:87},moves:[entry],warnings:[]}}));
  await page.route('**/study/fighters/marth.json',route=>route.fulfill({json:{...fighter,moves:[{...entry,stats:{animation_frames:24,iasa:18,first_active_frame:4,active_windows:[[4,6],[8,10]]}}]}}));
  await page.goto('/#/study');await page.getByLabel('Study topic').selectOption('Move stats · Ground attacks');
  await expect(page.locator('.study-card-list button')).toHaveCount(2);
  await expect(page.getByLabel('Study stat').locator('option')).toHaveText(['Every stat','Active Frames','First Actionable Frame']);
  await page.getByLabel('Study stat').selectOption('Active Frames');
  await page.getByRole('button',{name:'View animation',exact:true}).click();
  const animation=page.getByRole('dialog');
  await expect(animation.locator('canvas')).toBeVisible();
  await expect(animation.getByLabel('Animation frame')).toHaveValue('1');
  await animation.getByRole('button',{name:'Close animation',exact:true}).click();
  await expect(animation).toHaveCount(0);
  await page.getByRole('button',{name:'Reveal answer',exact:true}).click();await expect(page.locator('.study-answer>p').first()).toHaveText('4-6, 8-10');
  await page.getByLabel('Study stat').selectOption('First Actionable Frame');
  await page.getByRole('button',{name:'Reveal answer',exact:true}).click();await expect(page.locator('.study-answer>p').first()).toHaveText('18');
  await page.getByLabel('Study stat').selectOption('all');
  await page.getByText('Scheduling, backups & export',{exact:true}).click();
  const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Export cards for Anki',exact:true}).click();
  const exported=await readFile((await(await downloading).path())!,'utf8');
  expect(exported).toContain('4-6, 8-10');expect(exported).toContain('First Actionable Frame');expect(exported).not.toMatch(/First active frame|Animation length|what is IASA/);
  await page.getByRole('button',{name:'Study now',exact:true}).click();
  await expect(page.locator('.study-question')).toContainText('Active Frames');
});
test('Get-up stand and roll cards are discoverable in Dodges by action and stat',async({page})=>{
  const names=['DownStandU','DownStandD','DownForwardU','DownForwardD','DownBackU','DownBackD'];
  await page.route('**/study/fighters/marth.json',route=>route.fulfill({json:{...fighter,moves:names.map(internalName=>({id:`${internalName}-1`,internalName,path:'fixture/move.json',stats:{animation_frames:40,iasa:35,intangible_windows:[[1,10],[12,15]]},warnings:[]}))}}));
  await page.goto('/#/study');
  await expect(page.getByLabel('Study topic').getByRole('option',{name:'Attributes · Dodges',exact:true})).toBeAttached();
  await page.getByLabel('Study topic').selectOption('Attributes · Dodges');
  await page.getByLabel('Search study cards').fill('Stand up');
  await expect(page.locator('.study-card-list button')).toHaveCount(4);
  await page.getByLabel('Study stat').selectOption('Intangible frames');
  await expect(page.locator('.study-card-list button')).toHaveCount(2);
  await expect(page.locator('.study-card-list')).toContainText('Stand up · U');
  await expect(page.locator('.study-card-list')).toContainText('Stand up · D');
  await page.getByRole('button',{name:'Reveal answer',exact:true}).click();
  await expect(page.locator('.study-answer>p').first()).toHaveText('1–10, 12–15');
  await page.getByLabel('Search study cards').fill('Get-up Roll');
  await expect(page.locator('.study-card-list button')).toHaveCount(4);
  for(const direction of ['Forward','Back'])for(const posture of ['U','D'])await expect(page.locator('.study-card-list')).toContainText(`Get-up Roll · ${direction} · ${posture}`);
  await page.getByLabel('Study stat').selectOption('Actionable');
  await expect(page.locator('.study-card-list button')).toHaveCount(4);
  await page.getByRole('button',{name:'Reveal answer',exact:true}).click();
  await expect(page.locator('.study-answer>p').first()).toHaveText('35');
  await expect(page.getByRole('button',{name:'View animation',exact:true})).toBeVisible();
});

test('Slip Attack timings appear in Get-up options and Other subactions is omitted',async({page})=>{
  await page.route('**/study/fighters/marth.json',route=>route.fulfill({json:{...fighter,moves:[
    {id:'SlipAttack-1',internalName:'SlipAttack',path:'move/slip-attack.json',stats:{animation_frames:50,active_windows:[[19,20],[25,26]]},warnings:[]},
    {id:'DownDamageU-1',internalName:'DownDamageU',path:'move/down-damage.json',stats:{animation_frames:40,active_windows:[[8,10]]},warnings:[]},
  ]}}));
  await page.goto('/#/study');await expect(page.getByRole('navigation',{name:'Study decks'})).toBeVisible();
  await expect(page.getByLabel('Study topic').getByRole('option',{name:'Move stats · Get-up options',exact:true})).toBeAttached();
  const topics=await page.getByLabel('Study topic').locator('option').allTextContents();
  expect(topics).toContain('Move stats · Get-up options');expect(topics).not.toContain('Move stats · Other subactions');
  await page.getByLabel('Study topic').selectOption('Move stats · Get-up options');
  await expect(page.locator('.study-card-list button')).toHaveCount(2);
  await expect(page.locator('.study-card-list')).toContainText('Slip Attack');
  await expect(page.locator('.study-card-list')).not.toContainText('DownDamageU');
});
