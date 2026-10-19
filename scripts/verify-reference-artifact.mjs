import {spawn} from 'node:child_process';
import {readFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,join,sep} from 'node:path';
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
const packaged=process.argv[2],root=packaged?resolve(packaged,'app'):resolve('dist');
const exe=packaged?resolve(packaged,'P+ Dojo.exe'):resolve('target/release/pplus-dojo.exe');
const child=spawn(exe,packaged?['--no-browser']:['--root',root,'--no-browser'],{env:{SystemRoot:process.env.SystemRoot,PATH:join(process.env.SystemRoot,'System32')},stdio:['ignore','pipe','pipe']});
const url=await new Promise((done,reject)=>{let log='';child.stdout.on('data',data=>{log+=data;const m=log.match(/http:\/\/127\.0\.0\.1:\d+\//);if(m)done(m[0]);});child.once('error',reject);child.once('exit',code=>reject(new Error(`Launcher exited: ${code}`)));setTimeout(()=>reject(new Error('Launcher timed out')),15000).unref();});
const browser=await chromium.launch({channel:'msedge',headless:true});let subpath;
try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),external=[],errors=[];
  await context.route('**/*',route=>{if(new URL(route.request().url()).hostname==='127.0.0.1')return route.continue();external.push(route.request().url());return route.abort();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const attributes=JSON.parse(await readFile('src/data/reference/attributes.json','utf8'));
  const stages=JSON.parse(await readFile('src/data/reference/stages.json','utf8'));
  for(const sheet of attributes.sheets.filter(s=>s.name!=='About')){
    await page.goto(`${url}#/attributes/${encodeURIComponent(sheet.name)}${sheet.name==='Main'?'/sheet':''}`);
    await expect(page.getByRole('navigation',{name:'Attribute worksheets'}).getByRole('link',{name:sheet.name,exact:true})).toHaveAttribute('aria-current','page');
    await expect(page.locator('.reference-grid')).toHaveCount(0);
    await expect(page.locator('a[href="#/setup"],a[href="#/guide"]')).toHaveCount(0);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${sheet.name} causes page overflow`);
  }
  for(const stage of stages.stages){
    await page.goto(`${url}#/stages/${stage.id}`);
    await expect(page.getByRole('heading',{name:stage.name,exact:true})).toBeVisible();
    await expect(page.locator('.is-selected .blastzone-box')).toHaveAttribute('data-left',String(stage.geometry.blastLeft));
    await expect(page.locator('.is-selected .blastzone-box')).toHaveAttribute('data-right',String(stage.geometry.blastRight));
    assert.equal(await page.locator('.is-selected .stage-surface').getAttribute('y1'),await page.locator('.is-selected .stage-surface').getAttribute('y2'));
  }
  await mkdir('artifacts/screenshots',{recursive:true});
  for(const [route,file] of [['#/stages/battlefield','stages-desktop'],['#/attributes','attributes-desktop'],['#/fighters','pplus-theme-roster']]){
    await page.goto(url+route);await page.locator('h1').waitFor();await page.screenshot({path:`artifacts/screenshots/${file}.png`,fullPage:true,animations:'disabled'});
  }
  for(const [tab,file] of [['Misc','attribute-groups'],['Grab Timings','attribute-grabs'],['Raw Data','attribute-constants']]){
    await page.goto(`${url}#/attributes/${encodeURIComponent(tab)}`);
    await page.locator('.attribute-web-view').waitFor();
    await page.screenshot({path:`artifacts/screenshots/${file}.png`,animations:'disabled'});
  }
  await page.setViewportSize({width:390,height:844});
  for(const [route,file] of [['#/stages/battlefield','stages-mobile'],['#/attributes','attributes-mobile']]){
    await page.goto(url+route);await page.locator('h1').waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:`artifacts/screenshots/${file}.png`,fullPage:true,animations:'disabled'});
  }
  subpath=createServer(async(req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(!pathname.startsWith('/PPlus-Dojo/')){res.writeHead(404).end();return;}const file=resolve(root,pathname.slice('/PPlus-Dojo/'.length)||'index.html');if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}try{const bytes=await readFile(file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(bytes);}catch{res.writeHead(404).end();}});
  await new Promise(done=>subpath.listen(0,'127.0.0.1',done));const addr=subpath.address();
  for(const route of ['#/attributes/Main?metric=Max%20Fall%20Speed','#/stages/yoshis-story']){
    await page.goto(`http://127.0.0.1:${addr.port}/PPlus-Dojo/${route}`);await page.locator('h1').waitFor();await page.reload();
    if(route.includes('attributes'))await expect(page.getByRole('combobox',{name:'Attribute',exact:true})).toHaveValue('Max Fall Speed');
    else await expect(page.locator('.is-selected .blastzone-box')).toHaveAttribute('data-left','-175.7');
  }
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  console.log('Reference production checks passed: 13 web attribute categories, 20 stages, responsive layouts, offline assets, direct links, and Pages subpath.');
}finally{await browser.close();if(subpath)await new Promise(done=>subpath.close(done));child.kill();}
