import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {readMove} from './read-move.mjs';
import {combineSmash,summarize} from '../src/data/moves.ts';
import {resolve,join,sep} from 'node:path';
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const packaged=process.argv[2];
const root=packaged?resolve(packaged,'app'):resolve('dist'),exe=packaged?resolve(packaged,'P+ Dojo.exe'):resolve('target/release/pplus-dojo.exe');
const child=spawn(exe,packaged?['--no-browser']:['--root',root,'--no-browser'],{env:{SystemRoot:process.env.SystemRoot,PATH:join(process.env.SystemRoot,'System32')},stdio:['ignore','pipe','pipe']});
const url=await new Promise((done,reject)=>{let log='';child.stdout.on('data',data=>{log+=data;const match=log.match(/http:\/\/127\.0\.0\.1:\d+\//);if(match)done(match[0]);});child.once('error',reject);child.once('exit',code=>reject(new Error(`Launcher exited before startup: ${code}`)));setTimeout(()=>reject(new Error('Launcher startup timed out')),15_000).unref();});
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});const external=[];
await context.route('**/*',route=>{if(new URL(route.request().url()).hostname==='127.0.0.1')return route.continue();external.push(route.request().url());return route.abort();});
let server;
try{
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.getByRole('heading',{name:'Know your next frame.'}).waitFor();
  await page.goto(`${url}#/sandbox?frame=8`);await page.locator('.three-host canvas').waitFor();assert.equal(await page.getByRole('slider',{name:'Animation frame'}).inputValue(),'8');
  assert.equal(await page.locator('.graphics-error').count(),0,'WebGL viewer must render');
  await page.getByRole('button',{name:'Next frame',exact:true}).click();await page.reload();assert.equal(await page.getByRole('slider',{name:'Animation frame'}).inputValue(),'9');
  assert.deepEqual(external,[],'Offline bundle contacted an external service');assert.deepEqual(errors,[],'Production app threw a render error');
  let manifest;
  try{manifest=JSON.parse(await readFile(join(root,'data/manifest.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  if(manifest){
    for(const fighter of manifest.fighters){
      const index=JSON.parse(await readFile(join(root,'data',fighter.path),'utf8'));
      const move=index.moves.find(m=>m.internalName==='AttackAirF'&&m.totalFrames>=6)??index.moves.find(m=>m.internalName.startsWith('Attack')&&m.totalFrames>=6);
      assert(move,`Missing playable representative attack: ${fighter.name}`);
      await page.goto(`${url}#/fighters/${fighter.id}/${move.id}?frame=5`);
      await page.locator('.three-host canvas').waitFor();
      if(fighter.id==='fox'){
        await expect(page.locator('.move-groups').getByRole('link',{name:'Forward Tilt AttackS3S',exact:true})).toHaveCount(1);
        const specials=page.locator('.move-groups section').filter({has:page.getByRole('heading',{name:'Specials',exact:true})});
        const labels=await specials.getByRole('link').allTextContents();
        assert(labels.length>0,'Fox Specials must retain its attacks');
        assert(labels.every(label=>!/bitten|capture|egg|zitabata/i.test(label)),'Captured states leaked into Specials');
      }
      await expect(page.getByRole('slider',{name:'Animation frame'})).toHaveValue('5');
      assert.equal(await page.locator('.graphics-error').count(),0);
      await page.getByRole('button',{name:'Next frame',exact:true}).click();
      await page.reload();
      await page.locator('.three-host canvas').waitFor();
      await expect(page.getByRole('slider',{name:'Animation frame'})).toHaveValue('6');
      if(fighter.id==='marth'){
        await mkdir(resolve('artifacts/screenshots'),{recursive:true});
        await page.screenshot({path:resolve('artifacts/screenshots/marth-real-data.png'),fullPage:true});
      }
      for(const smash of index.moves.filter(m=>/^Attack(S4|Hi4|Lw4)(S|Hi|Lw)?(_\d+)?$/.test(m.internalName))){
        const family=smash.internalName.match(/^Attack(S4|Hi4|Lw4)/)[1];
        const start=index.moves.find(m=>m.internalName===`Attack${family}Start`&&m.totalFrames>0);
        if(!start)continue;
        const openingFrames=start.totalFrames-1;
        const firstActive=smash.activeWindows[0]?.[0];
        const release=await readMove(join(root,'data'),smash.path);
        const combined=summarize(combineSmash(await readMove(join(root,'data'),start.path),release));
        console.log(`Checking ${fighter.id} ${smash.internalName}`);
        await page.goto(`${url}#/fighters/${fighter.id}/${smash.id}?frame=${firstActive?firstActive+openingFrames:1}`);
        await expect(page.locator('.frame-counter')).toContainText(`/ ${openingFrames+smash.totalFrames}`);
        if(combined.startup)await expect(page.locator('.stat-card').filter({hasText:'Startup'})).toContainText(`${combined.startup}f`);
        if(fighter.id==='fox'&&smash.internalName==='AttackHi4')await expect(page.locator('.stat-card').filter({hasText:'Startup'})).toContainText('7f');
        if(release.iasa!==null)await expect(page.locator('.stat-card').filter({hasText:'IASA'})).toContainText(`${release.iasa+openingFrames+1}f`);
        await page.locator('.three-host canvas').waitFor();
        await expect(page.getByText(/Uncharged smash · includes/)).toHaveCount(0);
        if(fighter.id==='fox'&&smash.internalName==='AttackS4S')await page.screenshot({path:resolve('artifacts/screenshots/fox-full-smash.png'),fullPage:true});
        await page.getByRole('link',{name:'View release subaction',exact:true}).click();
        await expect(page.locator('.frame-counter')).toContainText(`/ ${smash.totalFrames}`);
        if(firstActive)await expect(page.locator('.stat-card').filter({hasText:'Startup'})).toContainText(`${firstActive}f`);
      }
    }
    assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
    console.log(`Real dataset browser checks passed for ${manifest.fighters.length} fighters (rendering and frame links; game accuracy remains ${manifest.verification}).`);
  }
  // A separate static host reproduces the GitHub Pages repository subpath.
  server=createServer(async(req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(!pathname.startsWith('/PPlus-Dojo/')){res.writeHead(404).end();return;}const relative=pathname.slice('/PPlus-Dojo/'.length)||'index.html';const file=resolve(root,relative);if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}try{const bytes=await readFile(file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(bytes);}catch{res.writeHead(404).end();}});
  await new Promise(done=>server.listen(0,'127.0.0.1',done));const address=server.address();
  await page.goto(`http://127.0.0.1:${address.port}/PPlus-Dojo/#/sandbox?frame=7`);await page.locator('.three-host canvas').waitFor();assert.equal(await page.getByRole('slider',{name:'Animation frame'}).inputValue(),'7');await page.reload();assert.equal(await page.getByRole('slider',{name:'Animation frame'}).inputValue(),'7');
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  console.log('Production artifact verified: launcher runs without dev runtimes; external network requests blocked; fonts/viewer/hash refresh work; GitHub Pages subpath works.');
}finally{await browser.close();if(server)await new Promise(done=>server.close(done));child.kill();}
