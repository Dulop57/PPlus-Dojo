// Explicit live check of the owner's already-published release. No account is
// created, no update is installed, and the expected version needs no download.
import {_electron as electron,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,readFile,rm} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {resolve,sep,join} from 'node:path';

assert.equal(process.env.DOJO_LIVE_GITHUB_TEST,'1','Set DOJO_LIVE_GITHUB_TEST=1 for an explicit live release check.');
const executablePath=process.env.DOJO_DESKTOP_EXECUTABLE;assert.ok(executablePath,'Select the built Windows app.');
const config=JSON.parse(await readFile('desktop.config.json','utf8')),metadata=JSON.parse(await readFile('package.json','utf8'));
const api=await fetch(`https://api.github.com/repos/${config.releaseRepository}/releases/latest`,{headers:{Accept:'application/vnd.github+json','User-Agent':'PPlus-Dojo-release-check'}});
assert.ok(api.ok,`Latest release HTTP ${api.status}`);const release=await api.json();
assert.equal(release.tag_name,`v${metadata.version}`);assert.equal(release.draft,false);assert.equal(release.prerelease,false);
const filename=`PPlus-Dojo-Setup-${metadata.version}.exe`;
for(const name of [filename,filename+'.blockmap','latest.yml']){
  const asset=release.assets.find(asset=>asset.name===name);assert.ok(asset,`Missing release asset: ${name}`);assert.equal(asset.state,'uploaded');
  const hash=createHash('sha256');let size=0;
  for await(const chunk of createReadStream(join('artifacts/desktop',name))){hash.update(chunk);size+=chunk.length;}
  assert.equal(asset.size,size);assert.equal(asset.digest,`sha256:${hash.digest('hex')}`,`Uploaded content differs: ${name}`);
}
const remoteManifest=await fetch(release.assets.find(asset=>asset.name==='latest.yml').browser_download_url);
assert.ok(remoteManifest.ok);assert.deepEqual(Buffer.from(await remoteManifest.arrayBuffer()),await readFile('artifacts/desktop/latest.yml'));
console.log(`GitHub release ${release.tag_name}: all three uploaded assets match local sizes and SHA-256; public updater metadata is accessible.`);
const profile=resolve('artifacts',`github-current-${randomUUID()}`);assert.ok(profile.startsWith(resolve('artifacts')+sep));await mkdir(profile,{recursive:true});
let app;const errors=[];
try{
  app=await electron.launch({executablePath,args:[`--user-data-dir=${profile}`],env:{...process.env,DOJO_DESKTOP_TEST:'1'},timeout:60000});
  const page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
  await page.locator('.diamond-board').waitFor({timeout:60000});
  const info=await page.evaluate(()=>window.dojoDesktop.info());assert.equal(info.version,metadata.version);assert.equal(info.releaseRepository,config.releaseRepository);
  await page.evaluate(()=>window.dojoDesktop.checkUpdate());
  await expect.poll(async()=>(await page.evaluate(()=>window.dojoDesktop.info())).update.status,{timeout:60000}).toBe('current');
  await page.getByRole('button',{name:'Account & app',exact:true}).click();
  await expect(page.locator('.account-dialog')).toContainText('You have the current version.');assert.deepEqual(errors,[]);
  console.log('Live GitHub updater passed: the packaged app reads the published stable release and reports the current version.');
}finally{if(app)await app.close();await rm(profile,{recursive:true,force:true});}
