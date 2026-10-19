import {test,expect} from '@playwright/test';
test('All attribute categories use web sections and removed pages have no entry points',async({page})=>{
  await page.goto('/#/attributes');
  const tabs=page.getByRole('navigation',{name:'Attribute worksheets'}).getByRole('link');
  await expect(tabs).toHaveCount(10);await expect(tabs.filter({hasText:/^About$/})).toHaveCount(0);
  const targets=await tabs.evaluateAll(links=>links.map(link=>link.getAttribute('href')!));
  for(const target of targets){await page.goto('/'+target);await expect(page.locator('.reference-grid')).toHaveCount(0);await expect(page.locator('.reference-page')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.goto('/#/attributes/Raw%20Data');await page.getByRole('combobox',{name:'Reference value'}).selectOption({label:'Weight'});
  await page.getByRole('button',{name:'Table',exact:true}).click();await page.getByRole('textbox',{name:'Search reference entries'}).fill('Fox');await expect(page.locator('.attribute-section-card tbody tr')).toHaveCount(1);await expect(page.locator('.attribute-section-card tbody')).toContainText('75');
  await expect(page.locator('a[href="#/setup"],a[href="#/guide"]')).toHaveCount(0);
  for(const route of ['setup','guide']){await page.goto('/#/'+route);await expect(page.getByRole('heading',{name:'Page not found',exact:true})).toBeVisible();}
});
test('Attributes preserve workbook tabs, rankings, search, sorting and direct links',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/#/attributes');await expect(page.locator('.attribute-reference-page')).toBeVisible();
  await expect(page.getByRole('navigation',{name:'Attribute worksheets'}).getByRole('link')).toHaveCount(10);
  await expect(page.locator('[data-chart-kind=bars]')).toBeVisible();await page.getByRole('button',{name:'Table',exact:true}).click();
  await page.getByRole('textbox',{name:'Search attribute entries'}).fill('fox');
  await expect(page.locator('.ranking-table tbody tr')).toHaveCount(1);await expect(page.locator('.ranking-table tbody tr')).toContainText('75');
  await page.getByRole('textbox',{name:'Search attribute entries'}).fill('');await page.getByRole('table').getByRole('button',{name:'Weight',exact:true}).click();
  await expect(page.locator('.ranking-table thead th').nth(2)).toHaveAttribute('aria-sort','ascending');
  await page.getByRole('button',{name:'Max Fall Speed',exact:true}).click();await page.reload();
  await expect(page.getByRole('button',{name:'Max Fall Speed',exact:true})).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('link',{name:'Grab Timings',exact:true}).click();await expect(page.getByRole('heading',{name:'Standing grab',exact:true})).toBeVisible();
  await expect(page.locator('.reference-grid')).toHaveCount(0);await page.getByText('Reference notes',{exact:true}).click();await expect(page.locator('.attribute-notes')).toContainText('JC Grabs have');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
test('Stage graph shows only surfaces and blastzones while preserving scale and links',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/#/stages/battlefield');await expect(page.getByRole('heading',{name:'Battlefield',exact:true})).toBeVisible();
  await expect(page.locator('.is-selected .blastzone-box')).toHaveAttribute('data-left','-224');await expect(page.locator('.is-selected .blastzone-box')).toHaveAttribute('data-right','224');
  expect(await page.locator('.is-selected .stage-surface').getAttribute('y1')).toBe(await page.locator('.is-selected .stage-surface').getAttribute('y2'));
  await expect(page.locator('.stage-platform')).toHaveCount(0);
  await expect(page.locator('.stage-layer,.stage-surface,.blastzone-box')).toHaveCount(60);
  await expect(page.locator('.stage-legend span')).toHaveText(['Stage surface','Blastzones']);
  const scale=await page.locator('.is-selected').evaluate(layer=>{
    const box=layer.querySelector('.blastzone-box')!;
    return {x:Number(box.getAttribute('width'))/(Number(box.getAttribute('data-right'))-Number(box.getAttribute('data-left'))),y:Number(box.getAttribute('height'))/(Number(box.getAttribute('data-top'))-Number(box.getAttribute('data-bottom')))};
  });
  expect(scale.x).toBeCloseTo(scale.y,8);
  await page.locator('.stage-list button').filter({hasText:'Green Hill Zone'}).click();
  await expect(page.locator('.is-selected')).toHaveAttribute('data-stage-id','green-hill-zone');
  await expect(page.locator('.stage-platform')).toHaveCount(0);
  await page.reload();await expect(page.getByRole('heading',{name:'Green Hill Zone',exact:true})).toBeVisible();
  await page.locator('.stage-list button').filter({hasText:'Final Destination'}).click();
  await expect(page.locator('.is-selected')).toHaveAttribute('data-stage-id','final-destination');
  await expect(page.locator('.stage-platform')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('link',{name:'Raw data',exact:true}).click();await expect(page.locator('.reference-grid')).toContainText('Dead0 X');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
test('Platforms warning sits below the tabs and aligns left on narrow screens',async({page})=>{
  await page.setViewportSize({width:489,height:602});
  await page.goto('/#/stages');
  const nav=page.getByRole('navigation',{name:'Stage views'});
  const tabs=nav.getByRole('link');
  const warning=nav.locator('.stage-platform-warning');
  await expect(tabs).toHaveCount(3);
  await expect(warning).toBeVisible();
  const tabBoxes=await tabs.evaluateAll(links=>links.map(link=>{const r=link.getBoundingClientRect();return{x:r.x,bottom:r.bottom};}));
  const warningBox=await warning.boundingBox();
  expect(warningBox).not.toBeNull();
  expect(warningBox!.y).toBeGreaterThan(Math.max(...tabBoxes.map(box=>box.bottom)));
  expect(warningBox!.x).toBeCloseTo(tabBoxes[0].x,0);
  await page.setViewportSize({width:1280,height:800});
  const wideTab=await tabs.first().boundingBox();
  const wideWarning=await warning.boundingBox();
  expect(wideWarning).not.toBeNull();
  expect(wideWarning!.y).toBeLessThan(wideTab!.y+wideTab!.height);
});
test('Selecting a stage preserves scroll, document, scale and graph placement',async({page})=>{
  await page.goto('/#/stages/battlefield');await expect(page.locator('.is-selected')).toHaveAttribute('data-stage-id','battlefield');
  await page.evaluate(()=>{(window as Window&{dojoDocumentMarker?:string}).dojoDocumentMarker='same-document';document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,90);});
  const before=await page.locator('.stage-diagram').boundingBox();
  const scroll=await page.evaluate(()=>scrollY);
  // Programmatic button activation avoids Playwright scrolling an offscreen
  // button into view, which is independent of the app's selection behavior.
  await page.locator('.stage-list button').filter({hasText:'Smashville'}).evaluate((el:HTMLElement)=>el.click());
  await expect(page.locator('.is-selected')).toHaveAttribute('data-stage-id','smashville');
  expect(await page.evaluate(()=>scrollY)).toBe(scroll);
  expect(await page.locator('.stage-diagram').boundingBox()).toEqual(before);
  expect(await page.evaluate(()=>(window as Window&{dojoDocumentMarker?:string}).dojoDocumentMarker)).toBe('same-document');
  const scaleBox=await page.locator('[data-stage-id="final-destination"] .blastzone-box').getAttribute('x');
  await page.locator('.stage-list button').filter({hasText:'Green Hill Zone'}).evaluate((el:HTMLElement)=>el.click());
  await expect(page.locator('.is-selected')).toHaveAttribute('data-stage-id','green-hill-zone');
  expect(await page.locator('[data-stage-id="final-destination"] .blastzone-box').getAttribute('x')).toBe(scaleBox);
  expect(await page.locator('.stage-diagram').boundingBox()).toEqual(before);
  expect(await page.evaluate(()=>scrollY)).toBe(scroll);
});
