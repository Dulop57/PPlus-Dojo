import {readFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
export function datasetPath(root,path){
  const folder=resolve(root),target=resolve(folder,path);
  assert(target.startsWith(folder+sep)&&!path.includes('\\'),'Dataset path escapes its folder');
  return target;
}
export async function readMove(root,path,bytes){
  const stored=JSON.parse(gunzipSync(bytes??await readFile(datasetPath(root,path))));
  if(!stored.sharedMove)return stored;
  const shared=await readFile(datasetPath(root,stored.sharedMove.path));
  assert.equal(createHash('sha256').update(shared).digest('hex'),stored.sharedMove.sha256,'Shared move checksum mismatch');
  const base=JSON.parse(gunzipSync(shared));
  assert(!base.sharedMove,'Nested shared moves are unsupported');
  assert.equal(base.schemaVersion,stored.schemaVersion);assert.equal(base.fighterId,stored.fighterId);
  return {...base,moveId:stored.moveId,name:stored.name};
}
