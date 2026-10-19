import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {datasetPath} from './read-move.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
// Used only on the copied dist dataset. Source generations remain untouched.
export async function compactDataset(root){
  const manifest=JSON.parse(await readFile(datasetPath(root,'manifest.json'),'utf8'));
  let aliases=0,saved=0;
  for(const entry of manifest.fighters){
    const indexPath=datasetPath(root,entry.path),index=JSON.parse(await readFile(indexPath,'utf8')),seen=new Map();
    for(const move of index.moves){
      const file=datasetPath(root,move.path),bytes=await readFile(file),data=JSON.parse(gunzipSync(bytes));
      if(data.sharedMove)continue;
      const {name,moveId,...payload}=data;
      const key=hash(JSON.stringify(payload)),canonical=seen.get(key);
      if(!canonical){seen.set(key,{path:move.path,sha256:hash(bytes)});continue;}
      const alias=gzipSync(JSON.stringify({schemaVersion:1,fighterId:data.fighterId,name,moveId,sharedMove:canonical}),{level:9});
      if(alias.length>=bytes.length)continue;
      await writeFile(file,alias);move.sha256=hash(alias);aliases++;saved+=bytes.length-alias.length;
    }
    await writeFile(indexPath,JSON.stringify(index));
  }
  console.log(`Lossless dataset compaction: ${aliases} shared subactions, ${(saved/1048576).toFixed(2)} MiB saved.`);
  return {aliases,saved};
}
