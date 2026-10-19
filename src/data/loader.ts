import {decodeDataset} from './decode';
import type { FighterData, Manifest, MoveData } from './types';
import {readWebFile} from './web-storage';
import {presentSmash} from './smash-sequences';

export class DataError extends Error {}
const cache = new Map<string, unknown>();
const resolvedMoves=new Map<string,MoveData>();
let retainAll=false,cacheEpoch=0;
const validatedMoves=new WeakSet<object>();
export function retainAllData(enabled:boolean){retainAll=enabled;if(!enabled){cacheEpoch++;cache.clear();resolvedMoves.clear();}}
export function cachedDataCount(){return cache.size;}
export function dataUrl(path: string) {
  const root = new URL(`${import.meta.env.BASE_URL}data/`, document.baseURI);
  const url = new URL(path, root);
  if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname) || path.includes('\\')) {
    throw new DataError('The dataset contains an invalid file path.');
  }
  return url.href;
}
async function read<T>(path: string, signal?: AbortSignal): Promise<T> {
  const isManifest=path==='manifest.json';
  if (cache.has(path)) return cache.get(path) as T;
  const epoch=cacheEpoch;
  const web=await readWebFile('data/'+path,signal);
  let bytes:ArrayBuffer,gzip=path.endsWith('.gz');
  if(web){bytes=web.bytes;gzip=web.gzip;}else{
    const response = await fetch(dataUrl(path), { signal, cache: isManifest?'no-cache':'default' });
    if (!response.ok) throw new DataError(response.status === 404 ? 'The P+ dataset has not been imported, or a required file is missing.' : `Unable to read dataset (${response.status}). Try again.`);
    bytes=await response.arrayBuffer();
  }
  let value: T;
  try { value = await decodeDataset(bytes,gzip,signal,retainAll) as T; }
  catch (error) { if(signal?.aborted)throw error;throw new DataError(error instanceof Error?error.message:'The dataset could not be decoded.'); }
  signal?.throwIfAborted();
  if ((value as { schemaVersion?: number }).schemaVersion !== 1) throw new DataError('This dataset version is not supported. Update P+ Dojo.');
  // Bound the cache: retain recently opened moves, not the whole game in memory.
  if (!retainAll&&cache.size >= 12) cache.delete(cache.keys().next().value!);
  if(epoch===cacheEpoch&&(!isManifest||retainAll))cache.set(path, value);
  return value;
}
export async function loadManifest(signal?: AbortSignal) {
  const manifest = await read<Manifest>('manifest.json', signal);
  if (manifest.game !== 'Project+' || manifest.version !== '3.2' || !Array.isArray(manifest.fighters)) throw new DataError('Expected a Project+ v3.2 manifest.');
  return manifest;
}
export async function loadFighter(path: string, signal?: AbortSignal) {
  const fighter = await read<FighterData>(path, signal);
  if (!Array.isArray(fighter.moves) || !fighter.attributes) throw new DataError('The fighter index is incomplete.');
  return fighter;
}
export async function loadMove(path: string, signal?: AbortSignal) {
  signal?.throwIfAborted();if(resolvedMoves.has(path))return resolvedMoves.get(path)!;
  const epoch=cacheEpoch;
  let move = await read<MoveData>(path, signal);
  let alias:MoveData|undefined;
  if(move.sharedMove){
    alias=move;const base=await read<MoveData>(move.sharedMove.path,signal);
    if(base.sharedMove||base.fighterId!==alias.fighterId)throw new DataError('The shared animation reference is invalid.');
    move=base;
  }
  if(!validatedMoves.has(move)){
    if (!Array.isArray(move.frames) || !move.extent || move.frames.some((f, i) => f.index !== i || !Array.isArray(f.hit_boxes) || !Array.isArray(f.hurt_boxes))) throw new DataError('The animation frames are invalid.');
    validatedMoves.add(move);
  }
  if(alias)move={...move,name:alias.name,moveId:alias.moveId};
  if(!retainAll&&resolvedMoves.size>=12)resolvedMoves.delete(resolvedMoves.keys().next().value!);
  if(epoch===cacheEpoch)resolvedMoves.set(path,move);
  return move;
}

/** The same checked sequence is used by the lab, study animation and bubble preview. */
export async function loadPresentedMove(path:string,signal?:AbortSignal,knownManifest?:Manifest|null){
  const raw=await loadMove(path,signal);
  const manifest=knownManifest??await loadManifest(signal),entry=manifest.fighters.find(f=>f.id===raw.fighterId);
  if(!entry)throw new DataError('The fighter for this sequence is unavailable.');
  const fighter=await loadFighter(entry.path,signal),move=fighter.moves.find(m=>m.id===raw.moveId&&m.path===path);
  if(!move)throw new DataError('The sequence does not match the current fighter catalog.');
  return presentSmash(fighter,move,p=>loadMove(p,signal));
}
