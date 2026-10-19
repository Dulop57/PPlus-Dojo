import { expect,test } from '@playwright/test';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { sandboxMove } from '../../src/data/sandbox';

test('Shared sidebar brand uses the Project+ long logo with DOJO below',async({page})=>{
  await page.goto('/#/about');
  const logo=page.locator('.brand-logo'),label=page.locator('.brand-name');
  await expect(logo).toHaveAttribute('src',/long\.png$/);
  expect(await logo.evaluate(image=>(image as HTMLImageElement).naturalWidth>0)).toBe(true);
  await expect(label).toHaveText('DOJO!');
  const [logoBounds,labelBounds]=await Promise.all([logo.boundingBox(),label.boundingBox()]);
  expect(logoBounds).not.toBeNull();expect(labelBounds).not.toBeNull();
  expect(labelBounds!.y).toBeGreaterThanOrEqual(logoBounds!.y+logoBounds!.height-1);
});

test('Diamond roster and missing animation data work without a game dataset',async({page})=>{
  await page.route('http://127.0.0.1:4173/data/manifest.json',route=>route.fulfill({status:404,body:'No dataset'}));
  await page.goto('/');await expect(page.getByRole('navigation',{name:'Choose a fighter'})).toBeVisible();
  await expect(page.locator('.fighter-diamond')).toHaveCount(43);
  await page.getByRole('link',{name:'Open Marth',exact:true}).click();await expect(page.getByRole('heading',{name:'This fighter’s data is not imported yet'})).toBeVisible();
  await expect(page.locator('a[href="#/setup"],a[href="#/guide"]')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('Synthetic viewer keeps frame links, keyboard controls and layers',async({page})=>{
  await page.goto('/#/sandbox?frame=8');await expect(page.getByText('SYNTHETIC FIXTURE',{exact:true})).toBeVisible();
  await expect(page.getByRole('slider',{name:'Animation frame'})).toHaveValue('8');
  await page.getByRole('button',{name:'Next frame',exact:true}).click();await expect(page.getByRole('slider',{name:'Animation frame'})).toHaveValue('9');
  await page.reload();await expect(page.getByRole('slider',{name:'Animation frame'})).toHaveValue('9');
  await page.locator('h1').click();await page.keyboard.press('ArrowLeft');await expect(page.getByRole('slider',{name:'Animation frame'})).toHaveValue('8');
  await page.getByRole('checkbox',{name:'Hurtboxes',exact:true}).uncheck();await expect(page.getByRole('checkbox',{name:'Hurtboxes',exact:true})).not.toBeChecked();
  await page.getByRole('button',{name:'Play animation',exact:true}).click();await expect(page.getByRole('button',{name:'Pause animation',exact:true})).toBeVisible();await page.getByRole('button',{name:'Pause animation',exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('Compressed imported data resolves shared animations, renders statistics and handles invalid moves',async({page})=>{
  // Intercepted synthetic transport fixture: never published as game data.
  const move={...sandboxMove,fighterId:'marth',moveId:'AttackAirF-0',name:'AttackAirF',warnings:[]};
  const bytes=gzipSync(Buffer.from(JSON.stringify({...move,moveId:'canonical',name:'AttackAirN'})));
  const aliasBytes=gzipSync(JSON.stringify({schemaVersion:1,fighterId:'marth',moveId:move.moveId,name:move.name,sharedMove:{path:'marth/shared.json.gz',sha256:createHash('sha256').update(bytes).digest('hex')}}));
  const fighter={schemaVersion:1,id:'marth',name:'Marth',internalName:'marth',attributes:{weight:100},moves:[{id:move.moveId,internalName:move.name,path:'marth/move.json.gz',totalFrames:24,warnings:[],sha256:createHash('sha256').update(aliasBytes).digest('hex')}],warnings:[]};
  await page.route('http://127.0.0.1:4173/data/**',async route=>{const url=new URL(route.request().url());if(url.pathname.endsWith('manifest.json'))await route.fulfill({json:{schemaVersion:1,game:'Project+',version:'3.2',generatedAt:'test',verification:'unverified',partial:true,parser:{name:'brawllib_rs',version:'0.29.0'},fighters:[{id:'marth',name:'Marth',path:'marth/index.json',moveCount:1}],warnings:[],sourceChecksums:[]}});else if(url.pathname.endsWith('index.json'))await route.fulfill({json:fighter});else await route.fulfill({body:url.pathname.endsWith('/move.json.gz')?aliasBytes:bytes,contentType:'application/octet-stream'});});
  await page.goto('/#/fighters/marth/AttackAirF-0?frame=7');await expect(page.getByRole('heading',{name:'Forward Air',exact:true})).toBeVisible();await expect(page.locator('.move-summary-item').filter({hasText:'Startup'})).toContainText('6f');await expect(page.locator('.frame-counter')).toContainText('07');
  await page.setViewportSize({width:489,height:602});
  const collisionTable=page.locator('.fighter-app .hitbox-section .table-scroll');
  await expect(collisionTable.locator('tbody tr')).toHaveCount(1);
  await expect(collisionTable.locator('thead th')).toHaveCount(7);
  expect(await collisionTable.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
  await expect(page).toHaveURL(/AttackAirF-0\?frame=7$/);
  await page.goto('/#/fighters/marth/invalid');await expect(page.getByText('This move is not present in the imported fighter index.')).toBeVisible();
});
test('Narrow fighter move list uses vertically scrollable expandable categories',async({page})=>{
  await page.setViewportSize({width:489,height:602});
  const names=['Attack11','AttackS3','AttackS4','AttackAirN','SpecialN','Catch','Escape','CliffWait','DownStandU','WalkSlow','AttackS4Start','AttackHi4Hold','UnknownAction','Slip','SlipAttack','SlipDash','SlipDown','SlipEscapeB','SlipEscapeF','SlipStand','SlipTurn','SlipWait'];
  const indexed=names.map(name=>{
    const move={...sandboxMove,fighterId:'marth',moveId:name,name,warnings:[]};
    const bytes=gzipSync(Buffer.from(JSON.stringify(move)));
    return {move,bytes,index:{id:name,internalName:name,path:`marth/${name}.json.gz`,totalFrames:move.frames.length,warnings:[],sha256:createHash('sha256').update(bytes).digest('hex')}};
  });
  await page.route('http://127.0.0.1:4173/data/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith('manifest.json'))await route.fulfill({json:{schemaVersion:1,game:'Project+',version:'3.2',generatedAt:'test',verification:'unverified',partial:true,parser:{name:'brawllib_rs',version:'0.29.0'},fighters:[{id:'marth',name:'Marth',path:'marth/index.json',moveCount:indexed.length}],warnings:[],sourceChecksums:[]}});
    else if(path.endsWith('index.json'))await route.fulfill({json:{schemaVersion:1,id:'marth',name:'Marth',internalName:'marth',attributes:{},moves:indexed.map(entry=>entry.index),warnings:[]}});
    else await route.fulfill({body:indexed.find(entry=>path.endsWith(entry.index.path))!.bytes,contentType:'application/octet-stream'});
  });
  await page.goto('/#/fighters/marth/Attack11?frame=1');
  const trigger=page.getByRole('button',{name:/Select move/}),dialog=page.getByRole('dialog',{name:'Move list'});
  await expect(trigger).toBeVisible();
  await expect(page.locator('.move-list-panel')).toBeHidden();
  await trigger.click();await expect(dialog).toBeVisible();
  const pickerBounds=await dialog.boundingBox();
  expect(pickerBounds?.width).toBe(489);expect(pickerBounds?.height).toBe(602);
  await expect(page.getByRole('textbox',{name:'Search moves'})).toBeFocused();
  await page.getByRole('button',{name:'Close move selector'}).click();
  await expect(dialog).toBeHidden();await expect(trigger).toBeFocused();
  await trigger.click();await expect(dialog).toBeVisible();
  const groups=dialog.locator('.move-groups');
  await expect(groups.getByRole('button',{name:'Toggle Ground attacks'})).toHaveAttribute('aria-expanded','true');
  await expect(groups.getByRole('button',{name:'Toggle Tilts'})).toHaveAttribute('aria-expanded','false');
  await expect(groups.getByRole('button')).toHaveCount(12);
  await expect(groups.getByRole('button',{name:'Toggle Smash subactions'})).toHaveCount(0);
  expect(await groups.evaluate(element=>element.scrollHeight>element.clientHeight)).toBe(true);
  expect(await groups.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
  await groups.getByRole('button',{name:'Toggle Tilts'}).click();
  await expect(groups.getByRole('button',{name:'Toggle Tilts'})).toHaveAttribute('aria-expanded','true');
  await expect(groups.getByRole('link',{name:'Forward Tilt AttackS3',exact:true})).toBeVisible();
  await groups.getByRole('button',{name:'Toggle Tilts'}).click();
  await expect(groups.getByRole('link',{name:'Forward Tilt AttackS3',exact:true})).toBeHidden();
  await groups.getByRole('button',{name:'Toggle Other subactions'}).click();
  const otherGroup=groups.locator('#move-group-other-subactions');
  await expect(otherGroup.getByRole('link',{name:/AttackS4Start/})).toBeVisible();
  await expect(otherGroup.getByRole('link',{name:/AttackHi4Hold/})).toBeVisible();
  await groups.getByRole('button',{name:'Toggle Slip'}).click();
  const slipGroup=groups.locator('#move-group-slip');
  await expect(slipGroup.locator('a')).toHaveCount(9);
  for(const name of ['Slip','SlipAttack','SlipDash','SlipDown','SlipEscapeB','SlipEscapeF','SlipStand','SlipTurn','SlipWait'])
    await expect(slipGroup.getByRole('link',{name:new RegExp(`${name}$`)})).toBeVisible();
  await groups.getByRole('button',{name:'Toggle Aerials'}).click();
  await groups.getByRole('link',{name:'Neutral Air AttackAirN',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Neutral Air',exact:true})).toBeVisible();
  await expect(dialog).toBeHidden();
  await page.setViewportSize({width:698,height:602});
  await trigger.click();await expect(dialog).toBeVisible();
  const middleDialog=await dialog.boundingBox();
  expect(middleDialog?.x).toBe(0);expect(middleDialog?.y).toBe(0);expect(middleDialog?.width).toBe(698);expect(middleDialog?.height).toBe(602);
  const viewerBounds=await page.locator('.viewer-stage').boundingBox();
  expect(viewerBounds).not.toBeNull();
  const pickerCoversViewer=await page.evaluate(({x,y})=>!!document.elementFromPoint(x,y)?.closest('#move-picker-panel.is-open'),{x:viewerBounds!.x+viewerBounds!.width/2,y:viewerBounds!.y+viewerBounds!.height/2});
  expect(pickerCoversViewer).toBe(true);
  await page.getByRole('button',{name:'Close move selector'}).click();await expect(dialog).toBeHidden();
  if(test.info().project.name==='desktop'){
    await page.setViewportSize({width:1280,height:900});
    await expect(trigger).toBeHidden();await expect(page.locator('.move-list-panel')).toBeVisible();
    await expect(page.getByRole('heading',{name:'Move list'})).toBeVisible();
    const wideGroups=page.locator('.move-groups');
    await expect(wideGroups.locator('section.is-open')).toHaveCount(0);
    await expect(wideGroups.getByRole('button',{name:'Toggle Other subactions'})).toHaveAttribute('aria-expanded','false');
    await expect(wideGroups.getByRole('button',{name:'Toggle Smash subactions'})).toHaveCount(0);
    await wideGroups.getByRole('button',{name:'Toggle Other subactions'}).click();
    await expect(wideGroups.locator('#move-group-other-subactions').getByRole('link',{name:/AttackS4Start/})).toBeVisible();
  }
});
test('Smashes include the start phase and hide the release subaction switch',async({page})=>{
  const release={...sandboxMove,fighterId:'fox',moveId:'AttackS4S-87',name:'AttackS4S',warnings:[]};
  const start={...release,moveId:'AttackS4Start-86',name:'AttackS4Start',iasa:null,frames:release.frames.slice(0,4)};
  const moves=[start,release].map(move=>{const bytes=gzipSync(Buffer.from(JSON.stringify(move)));return {move,bytes,index:{id:move.moveId,internalName:move.name,path:`fox/${move.moveId}.json.gz`,totalFrames:move.frames.length,warnings:[],sha256:createHash('sha256').update(bytes).digest('hex')}};});
  await page.route('http://127.0.0.1:4173/data/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith('manifest.json'))return route.fulfill({json:{schemaVersion:1,game:'Project+',version:'3.2',generatedAt:'test',verification:'unverified',partial:true,parser:{name:'brawllib_rs',version:'0.29.0'},fighters:[{id:'fox',name:'Fox',path:'fox/index.json',moveCount:2}],warnings:[],sourceChecksums:[]}});
    if(path.endsWith('index.json'))return route.fulfill({json:{schemaVersion:1,id:'fox',name:'Fox',internalName:'fox',attributes:{},moves:moves.map(m=>m.index),warnings:[]}});
    return route.fulfill({body:moves.find(m=>path.endsWith(m.index.path))!.bytes,contentType:'application/octet-stream'});
  });
  await page.goto('/#/fighters/fox/AttackS4S-87?frame=3');
  await expect(page.getByRole('heading',{name:'Forward Smash',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'View release subaction',exact:true})).toHaveCount(0);
  await expect(page.getByText(/Uncharged smash · includes/)).toHaveCount(0);
  await expect(page.locator('.move-summary-item').filter({hasText:'Startup'})).toContainText('9f');
  await expect(page.locator('.move-summary-item').filter({hasText:'IASA'})).toContainText('24f');
  await expect(page.locator('.frame-counter')).toContainText('/ 27');
  await page.getByRole('button',{name:'Next frame',exact:true}).click();await expect(page.getByRole('slider',{name:'Animation frame'})).toHaveValue('4');
  await page.reload();await expect(page.getByRole('slider',{name:'Animation frame'})).toHaveValue('4');
  await page.goto('/#/fighters/fox/AttackS4S-87?frame=1&view=raw');
  await expect(page.locator('.move-summary-item').filter({hasText:'Startup'})).toContainText('6f');
  await expect(page.getByRole('link',{name:/View (release subaction|full smash)/})).toHaveCount(0);
  await page.getByRole('button',{name:'Next frame',exact:true}).click();await expect(page.getByRole('slider',{name:'Animation frame'})).toHaveValue('2');
  await page.reload();await expect(page.getByRole('slider',{name:'Animation frame'})).toHaveValue('2');
  const picker=page.getByRole('button',{name:/Select move/});if(await picker.isVisible())await picker.click();
  const other=page.getByRole('button',{name:'Toggle Other subactions',exact:true});if(await other.getAttribute('aria-expanded')==='false')await other.click();
  await page.locator('.move-sidebar').getByRole('link',{name:/Start subaction/}).click();await expect(page.locator('.frame-counter')).toContainText('/ 4');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
