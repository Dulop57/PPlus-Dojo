import {test,expect} from '@playwright/test';
import {gzipSync} from 'node:zlib';
import {sandboxMove} from '../../src/data/sandbox';
test('Moves reuse the canvas, long timelines stay bounded and frame links remain exact',async({page})=>{
  const a={...sandboxMove,fighterId:'marth',moveId:'short',name:'AttackAirF',warnings:[]};
  const b={...a,moveId:'long',name:'AttackAirLw',frames:Array.from({length:1200},(_,i)=>({...a.frames[i%a.frames.length],index:i}))};
  const bytes=[gzipSync(JSON.stringify(a)),gzipSync(JSON.stringify(b))];
  const index={schemaVersion:1,id:'marth',name:'Marth',attributes:{weight:100},moves:[a,b].map((move,i)=>({id:move.moveId,internalName:move.name,path:`marth/${i}.json.gz`,totalFrames:move.frames.length,warnings:[],sha256:'a'.repeat(64)})),warnings:[]};
  await page.route('http://127.0.0.1:4173/data/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith('manifest.json'))await route.fulfill({json:{schemaVersion:1,game:'Project+',version:'3.2',generatedAt:'test',verification:'unverified',partial:true,parser:{name:'brawllib_rs',version:'0.29.0'},fighters:[{id:'marth',name:'Marth',path:'marth/index.json',moveCount:2}],warnings:[],sourceChecksums:[]}});
    else if(path.endsWith('index.json'))await route.fulfill({json:index});
    else await route.fulfill({body:bytes[path.endsWith('/0.json.gz')?0:1],contentType:'application/octet-stream'});
  });
  await page.setViewportSize({width:489,height:602});
  await page.goto('/#/fighters/marth/short?frame=1');await expect(page.getByRole('slider',{name:'Animation frame'})).toHaveAttribute('max','24');await page.locator('.three-host canvas').waitFor();
  const firstFrameInset=await page.locator('.frame-strip').evaluate(strip=>strip.querySelector('button')!.getBoundingClientRect().left-strip.getBoundingClientRect().left);
  expect(firstFrameInset).toBeGreaterThanOrEqual(2);
  await page.evaluate(()=>{(window as Window&{dojoCanvas?:HTMLCanvasElement|null}).dojoCanvas=document.querySelector('.three-host canvas');});
  await page.locator('.move-groups').getByRole('link',{name:'Down Air AttackAirLw',exact:true}).click();
  await expect(page.getByRole('slider',{name:'Animation frame'})).toHaveAttribute('max','1200');
  expect(await page.evaluate(()=>(window as Window&{dojoCanvas?:HTMLCanvasElement|null}).dojoCanvas===document.querySelector('.three-host canvas'))).toBe(true);
  await expect(page.locator('.frame-strip button')).toHaveCount(240);
  await page.getByRole('slider',{name:'Animation frame'}).fill('700');await expect(page).toHaveURL(/frame=700/);
  await page.getByRole('button',{name:'Next frame',exact:true}).click();await expect(page.getByRole('slider',{name:'Animation frame'})).toHaveValue('701');
  await page.getByRole('button',{name:'Play animation',exact:true}).click();
  await page.evaluate(()=>{location.hash='#/attributes/Misc';});
  await expect(page.getByRole('heading',{name:'Jumpsquat',exact:true})).toBeVisible();await expect(page).toHaveURL(/attributes\/Misc$/);
});
