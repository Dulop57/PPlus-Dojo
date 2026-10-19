import {test,expect} from '@playwright/test';
import stageDefaults from '../../src/data/stage-framings.json' with {type:'json'};
import {stageImageGeometry} from '../../src/data/stage-framing';

test('Public views hide image editors and preserve project framing over older browser crops',async({page})=>{
  test.skip(process.env.VITE_DOJO_IMAGE_EDITOR==='true','Checks the normal user view.');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>{
    localStorage.setItem('pplus-dojo-stage-framing:v2',JSON.stringify({battlefield:{x:0,y:10,scale:1.5}}));
    localStorage.setItem('pplus-dojo-portrait-framing:v1',JSON.stringify({charizard:{zoom:1.5,x:15,y:12}}));
  });
  await page.goto('/#/stages/battlefield');
  const image=page.locator('.stage-header-art img');
  await expect(image).toBeVisible();
  const art=(await page.locator('.stage-header-art').boundingBox())!;
  const source=await image.evaluate((element:HTMLImageElement)=>({width:element.naturalWidth,height:element.naturalHeight}));
  const expected=stageImageGeometry(art,source,stageDefaults.battlefield);
  const actual=(await image.boundingBox())!;
  expect(actual.height).toBeCloseTo(expected.height,1);
  expect(actual.y-art.y).toBeCloseTo(expected.top,1);
  await expect(page.getByRole('button',{name:'Adjust image',exact:true})).toHaveCount(0);
  await expect(page.locator('.stage-image-editor')).toHaveCount(0);
  const before=await image.getAttribute('style');
  await page.reload();
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute('style',before!);
  await page.goto('/#/fighters');
  await expect(page.locator('.diamond-board')).toBeVisible();
  await expect(page.getByRole('button',{name:'Adjust portraits',exact:true})).toHaveCount(0);
  await expect(page.locator('.portrait-editor')).toHaveCount(0);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('pplus-dojo-portrait-framing:v1')!).charizard.x)).toBe(15);
});
