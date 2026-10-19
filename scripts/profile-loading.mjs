import {spawn} from 'node:child_process';
import {resolve,join} from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const child=spawn(resolve('target/release/pplus-dojo.exe'),['--root',resolve(process.argv.includes('--baseline')?'artifacts/windows-2026-10-10T02-52-29-908Z/P+ Dojo - Setup Preview/app':'dist'),'--no-browser'],{stdio:['ignore','pipe','pipe']});
const url=await new Promise((done,reject)=>{let output='';child.stdout.on('data',bytes=>{output+=bytes;const match=output.match(/http:\/\/127\.0\.0\.1:\d+\//);if(match)done(match[0]);});child.once('error',reject);});
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const cdp=await page.context().newCDPSession(page);if(process.argv.includes('--throttle'))await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.addInitScript(()=>{window.dojoDrawTimes=[];const clear=WebGL2RenderingContext.prototype.clear;WebGL2RenderingContext.prototype.clear=function(...args){window.dojoDrawTimes.push(performance.now());return clear.apply(this,args);};window.dojoLongTasks=[];new PerformanceObserver(list=>{for(const entry of list.getEntries())window.dojoLongTasks.push({start:entry.startTime,duration:entry.duration});}).observe({type:'longtask',buffered:true});});
  const manifest=JSON.parse(await readFile('dist/data/manifest.json','utf8'));
  const fox=manifest.fighters.find(f=>f.id==='fox'),fighter=JSON.parse(await readFile(join('dist/data',fox.path),'utf8'));
  const move=fighter.moves.find(m=>m.internalName==='AttackAirF');
  const records=[];
  for(const [label,route,ready] of [['Attributes cold','attributes/Misc','.attribute-group-grid'],['Raw constants','attributes/Raw%20Data','.attribute-field-picker'],['Fox animation',`fighters/fox/${move.id}`,'.three-host canvas']]){
    await page.evaluate(()=>{window.dojoLongTasks=[];});await page.goto(url+'#/'+route);await page.locator(ready).first().waitFor();await page.waitForTimeout(300);
    records.push(await page.evaluate(label=>({label,longTasks:window.dojoLongTasks,totalBlockedMs:window.dojoLongTasks.reduce((sum,t)=>sum+t.duration,0),resources:performance.getEntriesByType('resource').map(r=>({name:r.name.split('/').at(-1),ms:r.duration,bytes:r.transferSize}))}),label));
  }
  // Re-rendering a reference view while typing exercises the numeric formatter.
  await page.evaluate(()=>{window.dojoLongTasks=[];});await page.goto(url+'#/fighters/lucas/WessDance-81');await page.locator('.frame-counter').filter({hasText:'/ 1506'}).waitFor();await page.waitForTimeout(300);records.push(await page.evaluate(()=>({label:'Long animation (1506 frames)',longTasks:window.dojoLongTasks,totalBlockedMs:window.dojoLongTasks.reduce((sum,t)=>sum+t.duration,0)})));
  await page.goto(url+'#/attributes/Raw%20Data');await page.locator('.attribute-field-picker').waitFor();
  const start=await page.evaluate(()=>performance.now());await page.getByRole('textbox',{name:'Search reference entries'}).pressSequentially('fox');
  await page.waitForTimeout(300);
  records.push(await page.evaluate(start=>({label:'Typing search',longTasks:window.dojoLongTasks.filter(t=>t.start>=start)}),start));
  await page.evaluate(()=>{window.dojoLongTasks=[];});await page.goto(url+'#/fighters/lucas/WessDance-81');await page.locator('.frame-counter').filter({hasText:'/ 1506'}).waitFor();await page.waitForTimeout(300);
  await page.evaluate(()=>{window.dojoLongTasks=[];window.dojoDrawTimes=[];window.dojoRafGaps=[];let last=performance.now();const tick=t=>{window.dojoRafGaps.push(t-last);last=t;window.dojoRaf=requestAnimationFrame(tick);};window.dojoRaf=requestAnimationFrame(tick);});
  await page.getByRole('button',{name:'Play animation',exact:true}).click();await page.waitForTimeout(1500);await page.getByRole('button',{name:'Pause animation',exact:true}).click();
  records.push(await page.evaluate(()=>{cancelAnimationFrame(window.dojoRaf);return {label:'Long animation playback',longTasks:window.dojoLongTasks,draws:window.dojoDrawTimes.length,drawFps:window.dojoDrawTimes.length>1?(window.dojoDrawTimes.length-1)*1000/(window.dojoDrawTimes.at(-1)-window.dojoDrawTimes[0]):0,rafSamples:window.dojoRafGaps.length,maxFrameGapMs:Math.max(...window.dojoRafGaps),slowFrames:window.dojoRafGaps.filter(t=>t>50).length};}));
  await writeFile(process.argv.includes('--baseline')?'artifacts/loading-baseline.json':'artifacts/loading-profile.json',JSON.stringify(records,null,2));
  console.log(JSON.stringify(records.map(({resources,...record})=>record),null,2));
}finally{await browser.close();child.kill();}
