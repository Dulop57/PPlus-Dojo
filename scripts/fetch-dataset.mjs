import {writeFile,mkdir,access} from 'node:fs/promises';
import {resolve,sep,dirname} from 'node:path';
import {unzipSync} from 'fflate';
import {validateDataset} from './validate-data.mjs';
const raw=process.env.DATASET_URL;
if(!raw)throw new Error('DATASET_URL must point to a public HTTPS ZIP with manifest.json at its root');
const url=new URL(raw);if(url.protocol!=='https:')throw new Error('Dataset URL must be HTTPS');
const response=await fetch(url);if(!response.ok)throw new Error(`Dataset download failed (${response.status})`);
const chunks=[];let size=0;
for await(const chunk of response.body){size+=chunk.length;if(size>1_000_000_000)throw new Error('Dataset ZIP exceeds the Pages budget');chunks.push(chunk);}
const files=unzipSync(Buffer.concat(chunks));
const root=resolve('public/data');await mkdir(root,{recursive:true});
try{await access(resolve(root,'manifest.json'));throw new Error('Refusing to replace an existing dataset during download');}catch(e){if(e.code!=='ENOENT')throw e;}
let unpacked=0;
for(const [path,bytes]of Object.entries(files)){
  unpacked+=bytes.length;if(unpacked>1_000_000_000)throw new Error('Unpacked dataset exceeds the Pages budget');
  const target=resolve(root,path);if(!target.startsWith(root+sep)||path.includes('\\')||/\.(pac|pcs|gct|iso|wbfs)$/i.test(path))throw new Error(`Unsafe or raw-game ZIP entry: ${path}`);
  if(path.endsWith('/'))continue;
  await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes);
}
await validateDataset(root,{release:true});
