import { mkdir,cp,readFile,readdir,unlink,rmdir,writeFile } from 'node:fs/promises';
import { join,resolve,sep } from 'node:path';
import {compactDataset} from './compact-data.mjs';
import {validateDataset} from './validate-data.mjs';
const dist=resolve(process.argv[2]??'dist'),licenses=join(dist,'licenses');
await mkdir(licenses,{recursive:true});
const packages=[['react','LICENSE'],['react-dom','LICENSE'],['three','LICENSE'],['fflate','LICENSE'],['ts-fsrs','LICENSE'],['lucide-react','LICENSE'],['@fontsource-variable/inter','LICENSE'],['@fontsource-variable/space-grotesk','LICENSE']];
for(const [name,file]of packages)await cp(join('node_modules',name,file),join(licenses,`${name.replaceAll('/','-').replace('@','')}.txt`));
await cp('node_modules/@grpc/grpc-js/LICENSE',join(licenses,'firebase-apache-2.0.txt'));
await cp('THIRD-PARTY-NOTICES.md',join(licenses,'THIRD-PARTY-NOTICES.md'));
const root=join(dist,'data');
let manifest;
try{manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));}catch(e){if(e.code==='ENOENT'){await writeFile(join(dist,'BUILD-STATUS.txt'),'SETUP PREVIEW: No real P+ dataset is included. See Data & setup in the app.\n');process.exit(0);}throw e;}
const keep=new Set(['manifest.json']);
function register(path){const absolute=resolve(root,path);if(!absolute.startsWith(root+sep)||path.includes('\\'))throw new Error('Invalid dataset path');keep.add(path);}
for(const entry of manifest.fighters){register(entry.path);const fighter=JSON.parse(await readFile(resolve(root,entry.path),'utf8'));for(const move of fighter.moves)register(move.path);}
// Prune only copied build artifacts. Never remove input or public/data generations.
async function prune(directory){
  if(!resolve(directory).startsWith(root+sep)&&resolve(directory)!==root)throw new Error('Refusing to prune outside dist/data');
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const path=join(directory,entry.name);if(entry.isSymbolicLink())throw new Error('Symlink in build data');
    if(entry.isDirectory()){await prune(path);if((await readdir(path)).length===0)await rmdir(path);}
    else if(!keep.has(path.slice(root.length+1).split(sep).join('/')))await unlink(path);
  }
}
await prune(root);console.log(`Packaged only the active dataset: ${keep.size} files.`);
await compactDataset(root);
await validateDataset(root);
