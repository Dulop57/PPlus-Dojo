import {test,expect} from '@playwright/test';
test('3D graph cycles all upward axes while retaining fighter values and flat projections',async({page})=>{
  await page.goto('/#/attributes/Main?metric=Weight&graph=3d');
  const plot=page.locator('.scatter-plot svg');
  const swap=page.getByRole('button',{name:/Swap upward axis/});
  await page.getByLabel('Inspect fighter in 3D graph').selectOption('fox');
  let previousPosition='';
  for(const [index,axis] of ['gravity','weight','fallSpeed','gravity'].entries()){
    if(index)await swap.click();
    await expect(plot).toHaveAttribute('data-vertical-axis',axis);
    const line=page.locator(`.scatter-axes [data-axis="${axis}"]>line`);
    const direction=await line.evaluate(element=>({x1:Number(element.getAttribute('x1')),x2:Number(element.getAttribute('x2')),y1:Number(element.getAttribute('y1')),y2:Number(element.getAttribute('y2'))}));
    expect(direction.x1).toBeCloseTo(direction.x2);
    expect(direction.y2).toBeLessThan(direction.y1);
    const position=await page.locator('[data-scatter-marker][data-fighters="fox"]').evaluate(element=>element.parentElement!.getAttribute('transform'));
    if(index)expect(position).not.toBe(previousPosition);
    previousPosition=position!;
    await expect(page.locator('.scatter-inspection dd')).toHaveText(['75','0.23','2.8']);
    expect(await page.locator('[data-scatter-marker]').count()).toBe(42);
    await page.getByRole('button',{name:'Weight × Gravity',exact:true}).click();
    await expect(swap).toHaveCount(0);
    await expect(plot).toHaveAttribute('data-vertical-axis','gravity');
    await page.getByRole('button',{name:'3D',exact:true}).click();
    await expect(plot).toHaveAttribute('data-vertical-axis',axis);
  }
});
test('Graph drag keeps the final position and reset cancels a pending frame',async({page})=>{
  await page.goto('/#/attributes/Main?metric=Weight&graph=3d');
  const plot=page.locator('.scatter-plot svg');
  await expect(plot).toBeVisible();
  const bounds=(await plot.boundingBox())!;
  const x=bounds.x+20,y=bounds.y+20;
  await page.mouse.move(x,y);await page.mouse.down();
  await plot.evaluate((element,{x,y})=>{
    element.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,clientX:x+24,clientY:y+8,bubbles:true}));
    element.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,clientX:x+80,clientY:y+20,bubbles:true}));
    // Release before the scheduled frame: the last move must still be committed.
    element.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,bubbles:true}));
  },{x,y});
  await page.mouse.up();
  await expect.poll(async()=>Number((await plot.getAttribute('data-camera'))!.split(',')[0])).toBeCloseTo(.7-80*.008);
  expect(Number((await plot.getAttribute('data-camera'))!.split(',')[1])).toBeCloseTo(.24+20*.008);
  await page.mouse.move(x,y);await page.mouse.down();
  await plot.evaluate((element,{x,y})=>{
    element.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,clientX:x+100,clientY:y,bubbles:true}));
    (document.querySelector('[aria-label="Reset graph view"]') as HTMLButtonElement).click();
  },{x,y});
  await page.mouse.up();
  await plot.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  await expect(plot).toHaveAttribute('data-camera','0.7,0.24');
});
test('Three-attribute plot opens from each supported metric and offers three orthographic comparisons',async({page,isMobile})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  for(const metric of ['Weight','Gravity (Falling Acceleration)','Max Fall Speed']){
    await page.goto(`/#/attributes/Main?metric=${encodeURIComponent(metric)}`);
    await expect(page.getByRole('link',{name:'3D Graph',exact:true})).toBeVisible();
  }
  await page.getByRole('button',{name:'Table',exact:true}).click();
  await expect(page.locator('.ranking-table')).toBeVisible();
  await page.getByRole('link',{name:'3D Graph',exact:true}).click();
  const plot=page.locator('.scatter-plot svg');
  await expect(plot).toHaveAttribute('data-projection','3d');
  const initialCamera=(await plot.getAttribute('data-camera'))!;
  expect(await page.locator('[data-scatter-marker]').evaluateAll(markers=>markers.reduce((total,marker)=>total+Number(marker.getAttribute('data-count')),0))).toBe(42);
  await page.getByLabel('Inspect fighter in 3D graph').selectOption('fox');
  await expect(page.locator('.scatter-inspection')).toContainText('Fox');
  expect(await page.locator('.scatter-inspection dd').allTextContents()).toEqual(['75','0.23','2.8']);
  await plot.focus();await plot.press('ArrowRight');await expect(plot).not.toHaveAttribute('data-camera',initialCamera);
  await page.getByRole('button',{name:'Reset graph view',exact:true}).click();await expect(plot).toHaveAttribute('data-camera',initialCamera);
  for(const [label,id,x,y] of [['Weight × Gravity','weight-gravity','weight','gravity'],['Weight × Max Fall Speed','weight-fall','weight','fallSpeed'],['Gravity × Max Fall Speed','gravity-fall','gravity','fallSpeed']]){
    await page.getByRole('button',{name:label,exact:true}).click();
    await expect(plot).toHaveAttribute('data-projection',id);await expect(plot).toHaveAttribute('data-horizontal-axis',x);await expect(plot).toHaveAttribute('data-vertical-axis',y);
    expect(await page.locator('[data-scatter-marker]').evaluateAll(markers=>markers.reduce((total,marker)=>total+Number(marker.getAttribute('data-count')),0))).toBe(42);
    await expect(page.locator('[data-scatter-marker] image')).toHaveCount(42);
    await plot.focus();await plot.press('ArrowRight');await expect(plot).toHaveAttribute('data-camera',initialCamera);
    await expect(page.locator('.scatter-inspection dd')).toHaveText(['75','0.23','2.8']);
  }
  await page.getByRole('button',{name:'Weight × Max Fall Speed',exact:true}).click();
  const shared=page.locator('[data-scatter-marker][data-fighters="ivysaur,squirtle"]');
  await expect(shared).toHaveAttribute('data-shared','true');await expect(shared.locator('image')).toHaveCount(2);
  await expect(shared.locator('.scatter-marker-count')).toHaveCount(0);
  for(const [id,name] of [['ivysaur','Ivysaur'],['squirtle','Squirtle']]){
    const half=shared.locator(`[data-fighter="${id}"]`);
    await half.focus();await half.press('Enter');
    await expect(half).toHaveAttribute('aria-pressed','true');await expect(page.locator('.scatter-inspection .fighter-name-with-icon')).toHaveText(name);
    await half.click();await expect(page.getByLabel('Inspect fighter in 3D graph')).toHaveValue(id);
  }
  await page.getByRole('textbox',{name:'Search attribute entries'}).fill('Fox');await expect(page.locator('[data-scatter-marker]')).toHaveCount(1);
  await page.getByRole('textbox',{name:'Search attribute entries'}).fill('no such fighter');await expect(page.getByRole('status')).toContainText('No fighters match');
  await page.getByRole('textbox',{name:'Search attribute entries'}).fill('');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(!isMobile)expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);
  await page.getByRole('link',{name:'Back to chart',exact:true}).click();await expect(page.locator('.chart-columns .chart-roster-row')).toHaveCount(42);
  await page.goto('/#/attributes/Main?metric=Fast%20Fall%20Speed');await expect(page.getByRole('link',{name:'3D Graph',exact:true})).toHaveCount(0);
  expect(errors).toEqual([]);
});
