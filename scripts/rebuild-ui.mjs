import {access,cp,mkdir,rm,lstat} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {checkSite} from './check-site.mjs';
await access('dist/data/manifest.json');
const selection=spawnSync(process.execPath,['scripts/apply-study-selection.mjs'],{stdio:'inherit'});
if(selection.status!==0)throw new Error('Study selection could not be applied');
// Reuse an already validated static dataset after changes confined to the UI.
// Run the normal build when public/data or dataset packaging code changes.
// Vite retains the dataset in reuse mode. Remove only generated UI assets so
// old hashed chunks do not accumulate across rebuilds.
const distRoot=resolve('dist'),assets=resolve('dist/assets');
if(!assets.startsWith(distRoot+sep))throw new Error('Invalid UI build directory');
try{if((await lstat(assets)).isSymbolicLink())throw new Error('Refusing to clean a linked asset directory');await rm(assets,{recursive:true,force:true});}catch(e){if(e.code!=='ENOENT')throw e;}
for(const [script,args] of [['node_modules/typescript/bin/tsc',['-b']],['node_modules/vite/bin/vite.js',['build']]]){
  const result=spawnSync(process.execPath,[script,...args],{stdio:'inherit',env:{...process.env,DOJO_REUSE_DATA:'1'}});
  if(result.status!==0)throw new Error('UI rebuild failed');
}
try{await cp('public/study','dist/study',{recursive:true});}catch(error){if(error.code!=='ENOENT')throw error;}
await mkdir('dist/licenses',{recursive:true});
await cp('node_modules/ts-fsrs/LICENSE','dist/licenses/ts-fsrs.txt');
await cp('node_modules/@grpc/grpc-js/LICENSE','dist/licenses/firebase-apache-2.0.txt');
await cp('THIRD-PARTY-NOTICES.md','dist/licenses/THIRD-PARTY-NOTICES.md');
await checkSite('dist');
