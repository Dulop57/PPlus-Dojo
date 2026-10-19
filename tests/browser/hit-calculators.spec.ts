import {test,expect} from '@playwright/test';
import {gzipSync} from 'node:zlib';
import {sandboxMove} from '../../src/data/sandbox';
import type {HitValues} from '../../src/data/types';

// Synthetic browser fixture, never published as Project+ game data.
const base:HitValues={hitbox_id:0,set_id:0,damage:12,trajectory:361,kbg:100,bkb:30,wdsk:0,size:3,enabled:true,ground:true,aerial:true,shield_damage:0,hitlag_mult:1,sdi_mult:1,effect:'Normal'};
const hitboxes=[{hitbox_id:0,prev_pos:null,prev_size:null,prev_values:null,next_pos:{x:0,y:10,z:-9},next_size:3,next_values:{Hit:base}},{hitbox_id:1,prev_pos:null,prev_size:null,prev_values:null,next_pos:{x:0,y:10,z:9},next_size:3,next_values:{Hit:{...base,hitbox_id:1,damage:11,hitlag_mult:1.5}}}];
const move={...sandboxMove,fighterId:'marth',moveId:'Attack11-0',name:'Attack11',iasa:14,landing_lag:null,warnings:[],extent:{left:-20,right:20,up:20,down:0},frames:sandboxMove.frames.map((frame,i)=>({...frame,hit_boxes:i===7?[hitboxes[0]]:i===8?[...hitboxes].reverse():i>=6&&i<10?hitboxes:[],hurt_boxes:[]}))};
const aerialMove={...move,moveId:'AttackAirF-1',name:'AttackAirF',landing_lag:19};
const index={schemaVersion:1,id:'marth',name:'Marth',attributes:{weight:87},moves:[{id:move.moveId,internalName:move.name,path:'marth/move.json.gz',totalFrames:24,warnings:[],sha256:'a'.repeat(64)},{id:aerialMove.moveId,internalName:aerialMove.name,path:'marth/aerial.json.gz',totalFrames:24,warnings:[],sha256:'a'.repeat(64)}],warnings:[]};

test.beforeEach(async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('http://127.0.0.1:4173/data/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith('manifest.json'))return route.fulfill({json:{schemaVersion:1,game:'Project+',version:'3.2',generatedAt:'test',verification:'unverified',partial:true,parser:{name:'brawllib_rs',version:'0.29.0'},fighters:[{id:'marth',name:'Marth',path:'marth/index.json',moveCount:1},{id:'luigi',name:'Luigi',path:'luigi/index.json',moveCount:0},{id:'donkey-kong',name:'Donkey Kong',path:'donkey-kong/index.json',moveCount:0}],warnings:[],sourceChecksums:[]}});
    if(path.endsWith('/marth/index.json'))return route.fulfill({json:index});
    if(path.endsWith('/index.json')){const id=path.includes('/luigi/')?'luigi':'donkey-kong';return route.fulfill({json:{...index,id,name:id,attributes:{weight:id==='luigi'?100:150},moves:[]}});}
    return route.fulfill({body:gzipSync(JSON.stringify(path.endsWith('/aerial.json.gz')?aerialMove:move)),contentType:'application/octet-stream'});
  });
});
const metric=(page:import('@playwright/test').Page,label:string)=>page.locator('.knockback-results > div').filter({has:page.locator('span').filter({hasText:new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`)})}).locator('strong');

test('Bubble selection drives workbook outputs, imported victim weights, modifiers and unavailable frames',async({page})=>{
  await page.goto('/#/fighters/marth/Attack11-0?frame=7');
  await expect(page.locator('.selected-hit-label')).toHaveText('Select a hitbubble');
  await expect(page.getByRole('spinbutton',{name:'Endlag frames'})).toHaveAttribute('readonly','');
  await expect(page.getByRole('spinbutton',{name:'Endlag frames'})).toHaveValue('8');
  await page.getByRole('spinbutton',{name:'Endlag frames'}).focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.type('123');
  await expect(page.getByRole('spinbutton',{name:'Endlag frames'})).toHaveValue('8');
  await page.getByRole('button',{name:'Select hitbubble 0',exact:true}).click();
  await page.getByRole('combobox',{name:'Victim fighter'}).selectOption('luigi');
  await expect(page.locator('.victim-weight')).toContainText('Weight 100');
  await page.getByRole('spinbutton',{name:'Victim percent before hit'}).fill('19');
  await expect(metric(page,'Knockback')).toHaveText('78.38');
  await expect(metric(page,'Launch Speed')).toHaveText('2.3514');
  await expect(metric(page,'Frames of Hitstun')).toHaveText('31');
  await expect(metric(page,'Attacker Hitlag')).toHaveText('7');
  await expect(metric(page,'Victim Hitlag (on Hit)')).toHaveText('7');
  await expect(metric(page,'Victim Hitlag (on Shield)')).toHaveText('7');
  await expect(metric(page,'Victim Shieldstun')).toHaveText('7');
  await expect(metric(page,'Frame Advantage on Shield')).toHaveText('-1');
  await page.getByRole('combobox',{name:'Victim fighter'}).selectOption('donkey-kong');
  await expect(metric(page,'Knockback')).toHaveText('72.3');
  await expect(page.locator('.victim-weight')).toContainText('Weight 150');
  await page.getByRole('combobox',{name:'Victim fighter'}).selectOption('luigi');
  await page.getByRole('button',{name:'Select hitbubble 1',exact:true}).click();
  await expect(page.locator('.viewer-stage')).toHaveAttribute('data-selected-hitbox','1');
  await expect(page.locator('.selected-hit-label')).toHaveText('Hitbubble 1');
  await expect(metric(page,'Attacker Hitlag')).toHaveText('10');
  await expect(metric(page,'Victim Hitlag (on Hit)')).toHaveText('6');
  await expect(metric(page,'Frame Advantage on Shield')).toHaveText('-6');
  await page.getByRole('checkbox',{name:'Crouch cancel',exact:true}).check();
  await expect(metric(page,'Victim Hitlag (on Hit)')).toHaveText('4');
  await page.getByRole('button',{name:'Next frame',exact:true}).click();
  await expect(page.getByRole('spinbutton',{name:'Endlag frames'})).toHaveValue('7');
  await expect(page.locator('.selected-hit-label')).toHaveText('Select a hitbubble');
  await expect(metric(page,'Knockback')).toHaveText('—');
  await expect(page.locator('.viewer-stage')).not.toHaveAttribute('data-selected-hitbox');
  await page.getByRole('button',{name:'Next frame',exact:true}).click();
  await expect(page.getByRole('spinbutton',{name:'Endlag frames'})).toHaveValue('6');
  await expect(page.locator('.selected-hit-label')).toHaveText('Hitbubble 1');
  await page.getByText('More calculation settings',{exact:true}).click();
  await page.getByRole('checkbox',{name:'Stale queue slot 1',exact:true}).check();
  await expect(metric(page,'Victim Hitlag (on Hit)')).toHaveText('4');
  await page.getByRole('spinbutton',{name:'Victim percent before hit'}).fill('');
  await expect(metric(page,'Knockback')).toHaveText('—');
  await page.goto('/#/about');
  await expect(page.getByText(/Thank you to MAWWWK/)).toBeVisible();
  await expect(page.getByText(/Magus420 for the formulas/)).toBeVisible();
});

test('3D picking selects the bubble and camera drags leave selection unchanged',async({page,isMobile})=>{
  if(!isMobile)await page.setViewportSize({width:1536,height:714});
  await page.goto('/#/fighters/marth/Attack11-0?frame=7');
  const canvas=page.locator('.three-host canvas');await canvas.waitFor();
  await expect(page.locator('.selected-hit-label')).toHaveText('Select a hitbubble');
  await expect(page.locator('.viewer-stage')).not.toHaveAttribute('data-selected-hitbox');
  const bounds=(await canvas.boundingBox())!;
  // Both fixture spheres lie on opposite sides of the centered camera target.
  if(isMobile)await canvas.tap({position:{x:bounds.width*.69,y:bounds.height*.5}});
  else await canvas.click({position:{x:bounds.width*.65,y:bounds.height*.5}});
  await expect(page.getByRole('button',{name:'Select hitbubble 1',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.viewer-stage')).toHaveAttribute('data-selected-hitbox','1');
  if(!isMobile){
    await page.mouse.move(bounds.x+bounds.width*.65,bounds.y+bounds.height*.5);
    await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.65+40,bounds.y+bounds.height*.5,{steps:8});await page.mouse.up();
  }
  await expect(page.locator('.selected-hit-label')).toHaveText('Hitbubble 1');
  if(isMobile)await canvas.tap({position:{x:bounds.width*.1,y:bounds.height*.85}});
  else await canvas.click({position:{x:bounds.width*.1,y:bounds.height*.85}});
  await expect(page.locator('.viewer-stage')).not.toHaveAttribute('data-selected-hitbox');
  await expect(page.locator('.selected-hit-label')).toHaveText('Select a hitbubble');
  await expect(page.locator('.selected-hitbox')).toHaveCount(0);
  await expect(page.locator('.knockback-results strong')).toHaveText(Array(8).fill('—'));
  await expect(page.locator('.threshold-results strong')).toHaveText(['—','—']);
  await page.getByRole('button',{name:'Next frame',exact:true}).click();
  await expect(page.locator('.selected-hitbox')).toHaveCount(0);
  await expect(page.locator('.viewer-stage')).not.toHaveAttribute('data-selected-hitbox');
  await page.getByRole('button',{name:'Select hitbubble 0',exact:true}).click();
  await expect(page.locator('.viewer-stage')).toHaveAttribute('data-selected-hitbox','0');
  await page.getByRole('button',{name:'Play animation',exact:true}).click();
  await page.getByRole('button',{name:'Pause animation',exact:true}).waitFor();
  await page.getByRole('button',{name:'Pause animation',exact:true}).click();
});

test('Read-only aerial endlag follows landing lag and the L-cancel setting',async({page})=>{
  await page.goto('/#/fighters/marth/AttackAirF-1?frame=7');
  const endlag=page.getByRole('spinbutton',{name:'Endlag frames'});
  await expect(endlag).toHaveAttribute('readonly','');
  await expect(endlag).toHaveValue('9');
  await page.getByText('More calculation settings',{exact:true}).click();
  await page.getByRole('checkbox',{name:'L-canceled landing',exact:true}).uncheck();
  await expect(endlag).toHaveValue('19');
  await page.getByRole('button',{name:'Next frame',exact:true}).click();
  await expect(endlag).toHaveValue('19');
});

test('Threshold values align and bubble selection keeps the viewer and controls stationary',async({page,isMobile})=>{
  test.skip(isMobile,'Desktop layout regression across window widths.');
  for(const width of [1024,1366,1920]){
    await page.setViewportSize({width,height:900});
    await page.goto('/#/fighters/marth/Attack11-0?frame=7');
    await page.locator('.threshold-results strong').first().waitFor();
    const selectors=['.move-viewer-card','.viewer-controls-card','.calculation-panels'];
    const before=await Promise.all(selectors.map(selector=>page.locator(selector).boundingBox()));
    for(const id of [0,1]){
      await page.getByRole('button',{name:`Select hitbubble ${id}`,exact:true}).click();
      await expect(page.locator('.selected-hit-label')).toHaveText(`Hitbubble ${id}`);
      const after=await Promise.all(selectors.map(selector=>page.locator(selector).boundingBox()));
      for(let i=0;i<before.length;i++){
        expect(after[i]!.y).toBeCloseTo(before[i]!.y,0);
        expect(after[i]!.height).toBeCloseTo(before[i]!.height,0);
      }
      const values=await page.locator('.threshold-results strong').all();
      const bounds=await Promise.all(values.map(value=>value.boundingBox()));
      expect(bounds[0]!.y).toBeCloseTo(bounds[1]!.y,1);
    }
  }
});

test('Collision details reserve the available height and scroll long hitbox lists without moving the page',async({page,isMobile})=>{
  test.skip(isMobile,'The wide viewer reserves the remaining viewport height.');
  await page.setViewportSize({width:1340,height:602});
  const crowded={...move,frames:move.frames.map((frame,i)=>({...frame,hit_boxes:i===6?Array.from({length:40},(_,id)=>({...hitboxes[0],hitbox_id:id,next_values:{Hit:{...base,hitbox_id:id}}})):[]}))};
  await page.route('**/data/marth/move.json.gz',route=>route.fulfill({body:gzipSync(JSON.stringify(crowded)),contentType:'application/octet-stream'}));
  await page.goto('/#/fighters/marth/Attack11-0?frame=1');
  await expect(page.locator('.no-hitboxes')).toBeVisible();
  const selectors=['.move-viewer-card','.hitbox-section','.viewer-controls-card','.calculation-panels'];
  const before=await Promise.all(selectors.map(selector=>page.locator(selector).boundingBox()));
  await page.getByRole('button',{name:'Go to frame 7',exact:true}).click();
  await expect(page.locator('.hitbox-section tbody tr')).toHaveCount(40);
  const after=await Promise.all(selectors.map(selector=>page.locator(selector).boundingBox()));
  for(let i=0;i<before.length;i++){
    expect(after[i]!.y).toBeCloseTo(before[i]!.y,0);
    expect(after[i]!.height).toBeCloseTo(before[i]!.height,0);
  }
  const details=page.locator('.hitbox-section');
  expect(await details.evaluate(e=>e.scrollHeight>e.clientHeight)).toBe(true);
  await page.getByRole('button',{name:'Select hitbubble 39',exact:true}).click();
  expect(await details.evaluate(e=>e.scrollTop>0)).toBe(true);
  expect(await page.locator('.move-content').evaluate(e=>e.scrollHeight<=e.clientHeight+1&&e.scrollTop===0)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
  await page.screenshot({path:'artifacts/collision-details-fixed-desktop.png'});
});

test('Desktop calculators and playback controls fit in the window; mobile has no horizontal overflow',async({page,isMobile})=>{
  if(!isMobile)await page.setViewportSize({width:1366,height:628});
  await page.goto('/#/fighters/marth/Attack11-0?frame=7');
  await page.locator('.knockback-results').waitFor();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(!isMobile){
    expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight&&document.querySelector('.move-content')!.scrollHeight<=document.querySelector('.move-content')!.clientHeight+1)).toBe(true);
    expect(await page.locator('.knockback-calculator').evaluate(e=>e.scrollHeight<=e.clientHeight+1)).toBe(true);
    expect(await page.locator('.asdi-calculator').evaluate(e=>e.scrollHeight<=e.clientHeight+1)).toBe(true);
    await page.setViewportSize({width:1340,height:602});
    expect(await page.locator('.asdi-calculator').evaluate(e=>e.scrollHeight<=e.clientHeight+1)).toBe(true);
    await page.setViewportSize({width:1366,height:628});
    const controls=(await page.locator('.viewer-controls-card').boundingBox())!;
    const calculators=(await page.locator('.hit-calculators').boundingBox())!;
    expect(controls.y+controls.height).toBeLessThan(calculators.y);
    await page.getByText('More calculation settings',{exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
    await page.getByRole('checkbox',{name:'Stale queue slot 9',exact:true}).check();
  }
});
