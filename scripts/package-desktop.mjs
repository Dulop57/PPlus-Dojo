import {access,readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {checkSite} from './check-site.mjs';
const args=process.argv.slice(2),preview=args.includes('--preview');
await access('dist/index.html');
const manifest=JSON.parse(await readFile('dist/data/manifest.json','utf8'));
if(!manifest.fighters?.length)throw new Error('A desktop app needs the bundled fighter dataset. Build the UI and import data first.');
if(!preview&&(manifest.partial||manifest.verification!=='verified'))throw new Error('The dataset is unverified. Use --preview for a local test app, or verify the data before a public release.');
await checkSite('dist');
// Only the updater is a Node runtime dependency. Firebase, React, and Three.js
// are already bundled into the UI and need no second copy in the installer.
const metadata=JSON.parse(await readFile('package.json','utf8')),desktopMetadata=JSON.parse(await readFile('desktop/package.json','utf8'));
desktopMetadata.version=metadata.version;await writeFile('desktop/package.json',JSON.stringify(desktopMetadata,null,2)+'\n');
try{await access('desktop/node_modules/electron-updater/package.json');}catch(error){
  if(error.code!=='ENOENT')throw error;
  if(!process.env.npm_execpath)throw new Error('Run this helper through npm run desktop:package to install runtime dependencies.');
  const install=spawnSync(process.execPath,[process.env.npm_execpath,'ci','--prefix','desktop','--omit=dev','--ignore-scripts'],{stdio:'inherit'});
  if(install.status!==0)throw new Error('Desktop runtime dependencies could not be installed.');
}
let config={releaseRepository:'',firebase:null};
try{config=JSON.parse(await readFile('desktop.config.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
if(process.env.DOJO_RELEASE_REPOSITORY)config.releaseRepository=process.env.DOJO_RELEASE_REPOSITORY;
if(process.env.DOJO_FIREBASE_CONFIG)config.firebase=JSON.parse(process.env.DOJO_FIREBASE_CONFIG);
if(config.firebase){const {apiKey,authDomain,projectId,appId}=config.firebase;if(![apiKey,authDomain,projectId,appId].every(v=>typeof v==='string'&&v.length))throw new Error('Firebase config needs apiKey, authDomain, projectId and appId.');config.firebase={apiKey,authDomain,projectId,appId};}
if(args.includes('--publish')&&!config.releaseRepository)throw new Error('Configure a public GitHub release repository before publishing.');
await writeFile('desktop.config.json',JSON.stringify(config,null,2)+'\n');
// The dataset is already compressed. Fast outer compression avoids spending
// minutes recompressing it for negligible additional savings.
const result=spawnSync(process.execPath,['node_modules/electron-builder/out/cli/cli.js','--config','desktop/builder.cjs','--win',...(args.includes('--dir')?['--dir']:[]),'--publish',args.includes('--publish')?'always':'never'],{stdio:'inherit',env:{...process.env,ELECTRON_BUILDER_COMPRESSION_LEVEL:process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL??'1'}});
if(result.status!==0)throw new Error('Desktop packaging failed.');
console.log(preview?'Built a standalone preview with unverified data.':'Built the standalone Windows app.');
