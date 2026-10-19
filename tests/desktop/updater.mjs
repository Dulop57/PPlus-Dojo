// Tests the packaged updater using a loopback feed and an isolated cache.
// Download/checksum handling is real. Installation is intercepted: the fixture
// is deliberately not a Windows executable and is never launched.
import {_electron as electron,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,readFile,rm} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {resolve,sep,dirname} from 'node:path';

const executablePath=process.env.DOJO_DESKTOP_EXECUTABLE;
assert.ok(executablePath,'Set DOJO_DESKTOP_EXECUTABLE to the built Windows app.');
const config=JSON.parse(await readFile('desktop.config.json','utf8'));
const metadata=JSON.parse(await readFile('package.json','utf8'));
const [major,minor,patch]=metadata.version.split('.').map(Number),newVersion=`${major}.${minor}.${patch+1}`;
const updateConfig=await readFile(resolve(dirname(executablePath),'resources/app-update.yml'),'utf8');
assert.ok(updateConfig.includes('provider: github')&&updateConfig.includes('updaterCacheDirName:'),'Packaged updater configuration must exist.');
const profile=resolve('artifacts',`desktop-updater-${randomUUID()}`),cache=resolve(profile,'update-cache');
assert.ok(profile.startsWith(resolve('artifacts')+sep)&&cache.startsWith(profile+sep));
await mkdir(cache,{recursive:true});
const payload=Buffer.alloc(2*1024*1024,0x50),hash=createHash('sha512').update(payload).digest('base64');
let version=metadata.version,corrupt=false,downloads=0,app;const errors=[];
const server=createServer((request,response)=>{
  const path=new URL(request.url,'http://localhost').pathname;
  if(path==='/latest.yml'){
    const checksum=corrupt?Buffer.alloc(64).toString('base64'):hash;
    response.writeHead(200,{'Content-Type':'text/yaml'});
    response.end(`version: ${version}\nfiles:\n  - url: update-fixture.exe\n    sha512: ${checksum}\n    size: ${payload.length}\npath: update-fixture.exe\nsha512: ${checksum}\nreleaseDate: '${new Date().toISOString()}'\n`);
  }else if(path==='/update-fixture.exe'){
    downloads++;response.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':payload.length});response.end(payload);
  }else{response.writeHead(404);response.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const feed=`http://127.0.0.1:${server.address().port}/`;
try{
  app=await electron.launch({executablePath,args:[`--user-data-dir=${profile}`],env:{...process.env,DOJO_DESKTOP_TEST:'1'},timeout:60000});
  const page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));
  const native=await app.evaluate(({app,BrowserWindow},{feed,cache})=>{
    const path=process.getBuiltinModule('path'),taskRequire=process.getBuiltinModule('module').createRequire(path.join(app.getAppPath(),'main.cjs'));
    const updaterRoot=path.join(app.getAppPath(),'node_modules/electron-updater');
    const updater=taskRequire(updaterRoot).autoUpdater;
    const {DownloadedUpdateHelper}=taskRequire(path.join(updaterRoot,'out/DownloadedUpdateHelper.js'));
    BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false);
    global.__dojoUpdaterTest={updater,installs:[]};
    updater.setFeedURL({provider:'generic',url:feed});
    updater.disableDifferentialDownload=true;
    updater.downloadedUpdateHelper=new DownloadedUpdateHelper(cache);
    updater.quitAndInstall=(...args)=>global.__dojoUpdaterTest.installs.push(args);
    return {isPackaged:app.isPackaged,version:app.getVersion(),autoDownload:updater.autoDownload,autoInstallOnAppQuit:updater.autoInstallOnAppQuit};
  },{feed,cache});
  assert.equal(native.isPackaged,true);assert.equal(native.version,metadata.version);assert.equal(native.autoDownload,true);assert.equal(native.autoInstallOnAppQuit,false);
  await page.locator('.diamond-board').waitFor({timeout:60000});
  const info=await page.evaluate(()=>window.dojoDesktop.info());
  assert.equal(info.releaseRepository,config.releaseRepository);assert.deepEqual(info.firebase,config.firebase);
  await page.evaluate(()=>window.dojoDesktop.checkUpdate());
  await expect.poll(async()=>(await page.evaluate(()=>window.dojoDesktop.info())).update.status,{timeout:30000}).toBe('current');
  assert.equal(downloads,0,'Current versions must not download.');
  version=newVersion;corrupt=true;
  await page.evaluate(()=>window.dojoDesktop.checkUpdate());
  await expect.poll(async()=>(await page.evaluate(()=>window.dojoDesktop.info())).update.status,{timeout:60000}).toBe('error');
  assert.equal(await app.evaluate(()=>global.__dojoUpdaterTest.updater.downloadedUpdateHelper.file),null,'A corrupt download must not become installable.');
  corrupt=false;
  await page.evaluate(()=>window.dojoDesktop.checkUpdate());
  await expect.poll(async()=>(await page.evaluate(()=>window.dojoDesktop.info())).update.status,{timeout:60000}).toBe('ready');
  const downloaded=await app.evaluate(()=>global.__dojoUpdaterTest.updater.downloadedUpdateHelper.file);
  assert.ok(downloaded.startsWith(cache+sep));assert.equal(createHash('sha512').update(await readFile(downloaded)).digest('base64'),hash);
  assert.deepEqual(await app.evaluate(()=>global.__dojoUpdaterTest.installs),[],'Downloading must not trigger installation.');
  await page.getByRole('link',{name:'Study',exact:true}).click();
  await page.getByRole('button',{name:'Study now',exact:true}).click({timeout:60000});
  await page.getByRole('button',{name:'Reveal answer',exact:true}).click();await page.getByRole('button',{name:/^Good/}).click();
  await page.getByRole('button',{name:'Account & app',exact:true}).click();
  await expect(page.locator('.account-dialog')).toContainText(`Version ${newVersion} is ready to install.`);
  await page.getByRole('button',{name:'Install update and restart',exact:true}).click();
  await expect.poll(()=>app.evaluate(()=>global.__dojoUpdaterTest.installs),{timeout:10000}).toEqual([[false,true]]);
  const reviews=await page.evaluate(async()=>{
    const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('pplus-dojo-study');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    return new Promise((resolve,reject)=>{const request=db.transaction('reviews').objectStore('reviews').count();request.onsuccess=()=>{resolve(request.result);db.close();};request.onerror=()=>reject(request.error);});
  });
  assert.equal(reviews,1);assert.deepEqual(errors,[]);
  console.log('Packaged updater passed: configuration, current-version check, corrupt download rejection, verified background download, explicit install request, and saved review. Actual installer execution was intercepted.');
}finally{
  if(app)await app.close();await new Promise(resolve=>server.close(resolve));await rm(profile,{recursive:true,force:true});
}
