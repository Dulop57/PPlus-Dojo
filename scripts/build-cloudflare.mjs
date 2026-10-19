import {access,cp,mkdir,readFile,readdir,writeFile,lstat,rm,stat} from 'node:fs/promises';
import {resolve,join,sep,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';

export async function packReference(source,output,target=2*1024*1024){
  const files={},packs=new Map();await mkdir(join(output,'web-data'),{recursive:true});
  const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  let batch=[],batchSize=0,batchGroup='',count=0;
  async function flush(){
    if(!batch.length)return;const bytes=Buffer.concat(batch.map(row=>row.bytes)),sha256=hash(bytes),path=`web-data/${sha256}.pak`;
    if(!packs.has(path)){await writeFile(join(output,path),bytes);packs.set(path,{path,size:bytes.length,sha256});}
    let offset=0;for(const row of batch){files[row.path]={pack:path,offset,length:row.bytes.length,gzip:row.gzip};offset+=row.bytes.length;}batch=[];batchSize=0;
  }
  async function walk(directory){let result=[];for(const entry of await readdir(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isSymbolicLink())throw new Error('Reference data must not contain symlinks.');if(entry.isDirectory())result.push(...await walk(path));else result.push(path);}return result;}
  const paths=[];for(const folder of ['data','study'])for(const path of await walk(join(source,folder)))paths.push(path);
  paths.sort((a,b)=>relative(source,a).localeCompare(relative(source,b),'en'));
  for(const path of paths){
    const logical=relative(source,path).split(sep).join('/');if(!/\.json(\.gz)?$/.test(logical))throw new Error(`Unexpected reference file: ${logical}`);
    const raw=await readFile(path),bytes=logical.endsWith('.gz')?raw:gzipSync(raw,{level:9});
    if(bytes.length>25*1024*1024)throw new Error(`Reference file exceeds Cloudflare's asset limit: ${logical}`);
    // Indexes and study catalogs stay independently downloadable. Animation
    // groups are bounded to 2 MiB and never cross fighter directories.
    const standalone=logical.startsWith('study/')||!logical.endsWith('.gz');
    const group=logical.replace(/\/[^/]+$/,'');
    if(standalone||batchGroup!==group||batchSize+bytes.length>target)await flush();
    batch.push({path:logical,bytes,gzip:true});batchSize+=bytes.length;batchGroup=group;
    if(standalone||batchSize>=target)await flush();
    if(++count%4000===0)console.log(`Packed ${count.toLocaleString()} reference files…`);
  }
  await flush();
  const catalog={schemaVersion:1,packs:[...packs.values()],files};
  const bytes=gzipSync(Buffer.from(JSON.stringify(catalog)),{level:9}),path=`web-data/catalog-${hash(bytes)}.json.gz`;
  await writeFile(join(output,path),bytes);return {path,catalog};
}

export async function checkCloudflare(folder){
  let count=0,bytes=0;async function walk(path){for(const entry of await readdir(path,{withFileTypes:true})){const file=join(path,entry.name);if(entry.isSymbolicLink())throw new Error('Upload contains a symlink.');if(entry.isDirectory())await walk(file);else{const size=(await stat(file)).size;if(size>25*1024*1024)throw new Error(`Upload asset exceeds 25 MiB: ${file}`);bytes+=size;count++;}}}await walk(folder);
  if(count>1000)throw new Error(`Upload has ${count} files. Cloudflare dashboard uploads allow 1,000.`);
  console.log(`Cloudflare upload ready: ${count} files, ${(bytes/1024/1024).toFixed(1)} MiB, every asset under 25 MiB.`);return {count,bytes};
}

if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
  const root=resolve('.'),output=resolve('dist-web');if(!output.startsWith(root+sep))throw new Error('Invalid web output directory.');
  await access('dist/data/manifest.json');await access('dist/study/index.json');
  const ownerConfig=JSON.parse(await readFile('desktop.config.json','utf8')),metadata=JSON.parse(await readFile('package.json','utf8'));
  if(!ownerConfig.firebase)throw new Error('Configure Firebase before building the website.');
  for(const key of ['apiKey','authDomain','projectId','appId'])if(typeof ownerConfig.firebase[key]!=='string'||!ownerConfig.firebase[key])throw new Error('Incomplete public Firebase config.');
  try{if((await lstat(output)).isSymbolicLink())throw new Error('Refusing to clear a linked output directory.');await rm(output,{recursive:true,force:true});}catch(error){if(error.code!=='ENOENT')throw error;}
  for(const [script,args] of [['node_modules/typescript/bin/tsc',['-b']],['node_modules/vite/bin/vite.js',['build']]]){
    const result=spawnSync(process.execPath,[script,...args],{stdio:'inherit',env:{...process.env,DOJO_WEB_BUILD:'1',VITE_DOJO_WEB:'1'}});if(result.status!==0)throw new Error('Website UI build failed.');
  }
  await cp('dist/licenses',join(output,'licenses'),{recursive:true});await cp('public/favicon.png',join(output,'favicon.png'));await cp('public/favicon.svg',join(output,'favicon.svg'));
  const reference=await packReference(resolve('dist'),output);
  const assets=(await readdir(join(output,'assets'))).sort().map(name=>'assets/'+name);
  const config={schemaVersion:1,version:metadata.version,firebase:ownerConfig.firebase,catalog:reference.path,offlineAssets:assets.filter(name=>!name.endsWith('.js')&&!name.endsWith('.css'))};
  await writeFile(join(output,'web-config.json'),JSON.stringify(config));
  const template=await readFile('scripts/templates/web-service-worker.js','utf8');
  const shellID=createHash('sha256').update(await readFile(join(output,'index.html'))).update(JSON.stringify(config)).update(template).digest('hex').slice(0,24);
  // Cache the canonical homepage: Pages redirects /index.html to /, and a
  // redirected response cannot be reused for offline navigation in Chromium.
  const shellFiles=['','web-config.json','favicon.png','favicon.svg',...assets.filter(name=>name.endsWith('.js')||name.endsWith('.css'))].map(path=>'./'+path);
  await writeFile(join(output,'sw.js'),template.replace('__SHELL_ID__',JSON.stringify(shellID)).replace('__SHELL_FILES__',JSON.stringify(shellFiles)));
  const csp="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; worker-src 'self' blob:; connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com; object-src 'none'; base-uri 'self'; frame-src 'none'";
  await writeFile(join(output,'_headers'),`/*\n  Content-Security-Policy: ${csp}\n  X-Content-Type-Options: nosniff\n/web-data/*\n  Content-Type: application/octet-stream\n  Cache-Control: public, max-age=31536000, immutable, no-transform\n/sw.js\n  Cache-Control: no-cache\n/web-config.json\n  Cache-Control: no-cache\n`);
  await checkCloudflare(output);
  await writeFile('artifacts/cloudflare-build.json',JSON.stringify({version:metadata.version,sourceFiles:Object.keys(reference.catalog.files).length,packs:reference.catalog.packs.length,referenceBytes:reference.catalog.packs.reduce((sum,p)=>sum+p.size,0)},null,2));
}
