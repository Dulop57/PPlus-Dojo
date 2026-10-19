import {access,readFile,cp} from 'node:fs/promises';
import {resolve,join,sep,basename} from 'node:path';
import {checkSite} from './check-site.mjs';
import {zipDirectory} from './zip-directory.mjs';
// Refresh an existing preview stage after UI-only changes. Never alter its data.
if(!process.argv[2])throw new Error('Supply an existing Windows preview package folder under artifacts.');
const artifacts=resolve('artifacts'),stage=resolve(process.argv[2]);
if(!stage.startsWith(artifacts+sep)||basename(stage)!=='P+ Dojo - Setup Preview')throw new Error('Expected a preview stage inside artifacts.');
await access(join(stage,'P+ Dojo.exe'));
const manifest=await readFile('dist/data/manifest.json');
if(!manifest.equals(await readFile(join(stage,'app/data/manifest.json'))))throw new Error('Dataset manifest changed; use package:windows to make a fresh stage.');
await checkSite('dist');
await cp(resolve('dist/assets'),join(stage,'app/assets'),{recursive:true});
await cp(resolve('dist/index.html'),join(stage,'app/index.html'));
await cp(resolve('docs'),join(stage,'docs'),{recursive:true});
await cp(resolve('README.md'),join(stage,'README.md'));
await zipDirectory(stage,join(artifacts,'PPlus-Dojo-Windows-Setup-Preview.zip'),basename(stage));
console.log('Updated Windows preview ZIP with current UI and the existing complete dataset.');
