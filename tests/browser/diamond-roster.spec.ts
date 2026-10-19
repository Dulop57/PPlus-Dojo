import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {diamondRows,rosterStats} from '../../src/data/roster-attributes';
import {catalog} from '../../src/data/catalog';

for(const viewport of [{width:1100,height:602},{width:1366,height:628},{width:1920,height:1080}]){
test(`Diamond roster fits ${viewport.width} × ${viewport.height} with the complete attribute preview`,async({page,isMobile})=>{
  test.skip(isMobile,'Desktop viewport checks.');
  await page.setViewportSize(viewport);await page.goto('/');
  await expect(page.locator('.fighter-diamond')).toHaveCount(43);
  const rows=page.locator('.diamond-row');
  for(let index=0;index<5;index++){
    expect(await rows.nth(index).locator('.fighter-diamond').count()).toBe(diamondRows[index].length);
    expect(await rows.nth(index).locator('[data-fighter]').evaluateAll(elements=>elements.map(element=>element.getAttribute('data-fighter')))).toEqual(diamondRows[index].filter(id=>id!=='random'));
  }
  await expect(page.locator('.roster-attributes h1')).toHaveText('Mario');
  await expect(page.getByRole('meter')).toHaveCount(16);
  await expect(page.locator('.roster-section,.roster-toolbar,.roster-search')).toHaveCount(0);
  await page.getByRole('link',{name:'Open Bowser',exact:true}).hover();await expect(page.locator('.roster-attributes h1')).toHaveText('Bowser');
  await expect(page.getByRole('meter',{name:'Jumpsquat speed',exact:true})).toHaveAttribute('aria-valuenow','33');
  await page.getByRole('link',{name:'Open Fox',exact:true}).focus();await expect(page.locator('.roster-attributes h1')).toHaveText('Fox');
  await expect(page.getByRole('meter',{name:'Jumpsquat speed',exact:true})).toHaveAttribute('aria-valuenow','100');
  await expect(page.getByRole('meter',{name:'Weight',exact:true})).toHaveAttribute('aria-valuenow',String(rosterStats('fox')[0].fill));
  await page.getByRole('link',{name:'Open Mario',exact:true}).hover();
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.locator('.roster-attributes').evaluate(element=>element.scrollHeight<=element.clientHeight+1)).toBe(true);
  await expect(page.locator('.roster-data-note')).toHaveCount(0);
  await expect(page.getByRole('link',{name:'ENTER MOVESET VIEW',exact:true})).toHaveCount(0);
  await page.screenshot({path:`artifacts/diamond-roster-${viewport.width}.png`});
  await page.getByRole('link',{name:'Open Marth',exact:true}).click();await expect(page).toHaveURL(/#\/fighters\/marth/);
});
}

test('Narrow roster opens attributes on click and navigates only through View moveset',async({page,isMobile})=>{
  if(!isMobile)await page.setViewportSize({width:781,height:602});
  await page.goto('/');await page.getByRole('navigation',{name:'Choose a fighter'}).waitFor();
  await expect(page.locator('.fighter-diamond')).toHaveCount(42);await expect(page.getByRole('meter')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Open random fighter'})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);
  const marth=page.getByRole('button',{name:'Show Marth attributes',exact:true});
  await marth.hover();await expect(page.getByRole('dialog')).toHaveCount(0);
  await marth.focus();await expect(page.getByRole('dialog')).toHaveCount(0);
  await marth.press('Enter');
  const dialog=page.getByRole('dialog',{name:'Marth',exact:true});
  await expect(dialog).toBeVisible();await expect(dialog.getByRole('meter')).toHaveCount(16);
  await expect(page).not.toHaveURL(/#\/fighters\/marth/);
  await dialog.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(marth).toBeFocused();await marth.click();
  await dialog.getByRole('link',{name:'View moveset',exact:true}).click();await expect(page).toHaveURL(/#\/fighters\/marth/);
});

for(const viewport of [{width:390,height:844},{width:732,height:828},{width:781,height:602},{width:1099,height:602},{width:844,height:390}]){
  test(`Packed A–Z roster fits ${viewport.width} × ${viewport.height} without scrolling`,async({page,isMobile})=>{
    test.skip(isMobile,'Explicit responsive viewport checks.');
    await page.setViewportSize(viewport);await page.goto('/#/fighters');
    await expect(page.locator('.roster-narrow [data-fighter]')).toHaveCount(42);
    const expected=[...catalog].sort((a,b)=>a.name.localeCompare(b.name,'en')).map(fighter=>fighter.id);
    expect(await page.locator('[data-fighter]').evaluateAll(elements=>elements.map(element=>element.getAttribute('data-fighter')))).toEqual(expected);
    expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const bounds=await page.locator('.fighter-diamond').evaluateAll(elements=>elements.map(element=>{const r=element.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};}));
    for(const box of bounds){expect(box.left).toBeGreaterThanOrEqual(0);expect(box.top).toBeGreaterThanOrEqual(0);expect(box.right).toBeLessThanOrEqual(viewport.width);expect(box.bottom).toBeLessThanOrEqual(viewport.height);}
    await page.screenshot({path:`artifacts/diamond-roster-narrow-${viewport.width}x${viewport.height}.png`});
    await page.getByRole('button',{name:'Show Bowser attributes',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'Bowser',exact:true})).toBeVisible();
    await page.screenshot({path:`artifacts/diamond-roster-stats-${viewport.width}x${viewport.height}.png`});
    await page.getByRole('button',{name:'Close fighter attributes',exact:true}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.setViewportSize({width:1100,height:602});
    await expect(page.locator('.fighter-diamond')).toHaveCount(43);
    await expect(page.getByRole('button',{name:'Open random fighter'})).toBeVisible();
    await page.getByRole('link',{name:'Open Mario',exact:true}).hover();await expect(page.locator('.roster-attributes h1')).toHaveText('Mario');
  });
}

test('Owner diamond crops save to disk and load as defaults in independent browser contexts',async({page,browser})=>{
  test.skip(process.env.VITE_DOJO_IMAGE_EDITOR!=='true','Owner editor opt-in.');
  const testFile='artifacts/roster-editor-test-defaults.json';
  const oldStage=await readFile('src/data/stage-framings.json','utf8');
  const oldPortrait=await readFile('src/data/portrait-framings.ts','utf8');
  const serveDefaults=async(target:import('@playwright/test').Page)=>target.route('**/src/data/roster-framings.json*',async route=>{
    const saved=await readFile(testFile,'utf8').catch(()=> '{}');
    await route.fulfill({contentType:'application/javascript',body:`export default ${saved};`});
  });
  await serveDefaults(page);await page.goto('/');
  await page.getByRole('button',{name:'Adjust portraits',exact:true}).click();
  await page.getByRole('link',{name:'Adjust Mario portrait',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Adjust Mario',exact:true});
  await expect(dialog.locator('img')).toBeVisible();
  await dialog.getByRole('button',{name:'Reset',exact:true}).click();
  await expect(dialog.getByRole('slider',{name:'Mario portrait horizontal',exact:true})).toBeEnabled();
  const baseImage=dialog.locator('img'),baseBounds=(await baseImage.boundingBox())!;
  await dialog.getByRole('slider',{name:'Mario portrait horizontal',exact:true}).fill('20');
  await expect(dialog.getByRole('status',{name:'Project save status'})).toHaveText('Saved to project.');
  expect((await baseImage.boundingBox())!.x-baseBounds.x).toBeCloseTo(baseBounds.width*.1,1);
  const baseSaved=JSON.parse(await readFile(testFile,'utf8')).mario;
  expect(baseSaved.scale).toBe(1);expect(baseSaved.x).toBe(10);
  await dialog.getByRole('slider',{name:'Mario portrait vertical',exact:true}).fill('100');
  await expect(dialog.getByRole('status',{name:'Project save status'})).toHaveText('Saved to project.');
  const oldVertical=(await baseImage.boundingBox())!;
  await dialog.getByRole('slider',{name:'Mario portrait vertical',exact:true}).fill('150');
  await expect(dialog.getByRole('status',{name:'Project save status'})).toHaveText('Saved to project.');
  const lower=(await baseImage.boundingBox())!;
  expect(lower.y).toBeGreaterThan(oldVertical.y);
  expect(JSON.parse(await readFile(testFile,'utf8')).mario.y).toBeGreaterThan(baseSaved.y);
  await dialog.getByRole('button',{name:'Done',exact:true}).click();
  await page.reload();await page.getByRole('button',{name:'Adjust portraits',exact:true}).click();
  await page.getByRole('link',{name:'Adjust Mario portrait',exact:true}).click();
  await expect(dialog.getByRole('slider',{name:'Mario portrait vertical',exact:true})).toHaveValue('150');
  expect((await baseImage.boundingBox())!.y).toBeCloseTo(lower.y,1);
  await dialog.getByRole('slider',{name:'Mario portrait zoom',exact:true}).fill('1.5');
  await dialog.getByRole('slider',{name:'Mario portrait horizontal',exact:true}).fill('7');
  await dialog.getByRole('slider',{name:'Mario portrait vertical',exact:true}).fill('12');
  await expect(dialog.getByRole('status',{name:'Project save status'})).toHaveText('Saved to project.');
  const saved=JSON.parse(await readFile(testFile,'utf8')).mario;
  expect(saved.scale).toBe(1.5);expect(saved.x).toBeGreaterThan(0);expect(saved.y).toBeGreaterThan(0);
  await dialog.getByRole('button',{name:'Done',exact:true}).click();
  for(let index=0;index<2;index++){
    const context=await browser.newContext();const fresh=await context.newPage();
    await serveDefaults(fresh);await fresh.goto('http://127.0.0.1:4173/');
    await fresh.getByRole('button',{name:'Adjust portraits',exact:true}).click();await fresh.getByRole('link',{name:'Adjust Mario portrait',exact:true}).click();
    await expect(fresh.getByRole('slider',{name:'Mario portrait zoom',exact:true})).toHaveValue('1.5');
    await expect(fresh.getByRole('slider',{name:'Mario portrait horizontal',exact:true})).toHaveValue('7');
    await expect(fresh.getByRole('slider',{name:'Mario portrait vertical',exact:true})).toHaveValue('12');
    await context.close();
  }
  expect(await readFile('src/data/stage-framings.json','utf8')).toBe(oldStage);
  expect(await readFile('src/data/portrait-framings.ts','utf8')).toBe(oldPortrait);
  const rejected=await page.request.post('/__dojo-owner/roster-framing',{data:{id:'mario',framing:{x:999,y:0,scale:1}},headers:{Origin:'http://127.0.0.1:4173'}});
  expect(rejected.status()).toBe(400);
  const malformed=await page.request.post('/__dojo-owner/roster-framing',{data:'null',headers:{Origin:'http://127.0.0.1:4173','Content-Type':'application/json'}});expect(malformed.status()).toBe(400);
  const outside=await page.request.post('/__dojo-owner/roster-framing',{data:{id:'mario',framing:{x:0,y:0,scale:1}}});expect(outside.status()).toBe(403);
});

test('Failed project saves keep the crop draft and allow retry',async({page})=>{
  test.skip(process.env.VITE_DOJO_IMAGE_EDITOR!=='true','Owner editor opt-in.');
  await page.goto('/');await page.getByRole('button',{name:'Adjust portraits',exact:true}).click();await page.getByRole('link',{name:'Adjust Marth portrait',exact:true}).click();
  await page.route('**/__dojo-owner/roster-framing',route=>route.fulfill({status:500,json:{error:'Save failed'}}));
  await page.getByRole('slider',{name:'Marth portrait zoom',exact:true}).fill('1.75');
  await expect(page.getByRole('alert')).toContainText('Your draft is still here');await expect(page.getByRole('button',{name:'Done',exact:true})).toBeDisabled();
  await expect(page.getByRole('slider',{name:'Marth portrait zoom',exact:true})).toHaveValue('1.75');
  await page.unroute('**/__dojo-owner/roster-framing');await page.getByRole('button',{name:'Retry saving',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('status',{name:'Project save status'})).toHaveText('Saved to project.');
});

test('Portrait dragging and keyboard panning save the displayed crop',async({page})=>{
  test.skip(process.env.VITE_DOJO_IMAGE_EDITOR!=='true','Owner editor opt-in.');
  await page.goto('/');await page.getByRole('button',{name:'Adjust portraits',exact:true}).click();await page.getByRole('link',{name:'Adjust Mario portrait',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('slider',{name:'Mario portrait zoom',exact:true}).fill('2');
  await dialog.getByRole('slider',{name:'Mario portrait horizontal',exact:true}).fill('0');
  await dialog.getByRole('slider',{name:'Mario portrait vertical',exact:true}).fill('0');
  await expect(dialog.getByRole('status',{name:'Project save status'})).toHaveText('Saved to project.');
  const host=dialog.locator('.roster-photo'),bounds=(await host.boundingBox())!;
  const photo=host.locator('img'),before=(await photo.boundingBox())!;
  const x=bounds.x+bounds.width/2,y=bounds.y+bounds.height/2;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+20,y+10,{steps:4});await page.mouse.up();
  await expect(dialog.getByRole('status',{name:'Project save status'})).toHaveText('Saved to project.');
  const after=(await photo.boundingBox())!;expect(after.x-before.x).toBeCloseTo(20,1);expect(after.y-before.y).toBeCloseTo(10,1);
  await host.focus();await host.press('ArrowLeft');
  await expect(dialog.getByRole('status',{name:'Project save status'})).toHaveText('Saved to project.');
  expect((await photo.boundingBox())!.x).toBeCloseTo(after.x-2,1);
  await dialog.getByRole('button',{name:'Done',exact:true}).click();
  await page.getByRole('link',{name:'Adjust Mario portrait',exact:true}).click();
  const reopened=(await page.getByRole('dialog').locator('.roster-photo img').boundingBox())!;
  expect(reopened.x).toBeCloseTo(after.x-2,1);expect(reopened.y).toBeCloseTo(after.y,1);
});
