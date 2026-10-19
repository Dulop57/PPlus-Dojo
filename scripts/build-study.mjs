import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {extractStudyHits} from './study-hits.mjs';
import {buildCompendium} from './build-compendium.mjs';
import {createServer} from 'vite';
const root=resolve(process.argv[2]??'public/data'),out=resolve(process.argv[3]??'public/study');
const sha=value=>createHash('sha256').update(value).digest('hex');
function file(path){const full=resolve(root,path);if(!full.startsWith(root+sep)||path.includes('\\'))throw new Error('Invalid source path');return full;}
async function read(path){const bytes=await readFile(file(path));return JSON.parse((path.endsWith('.gz')?gunzipSync(bytes):bytes).toString('utf8'));}
function ranges(flags){const result=[];for(let i=0;i<flags.length;i++)if(flags[i]){const last=result.at(-1);if(last&&last[1]===i)last[1]=i+1;else result.push([i+1,i+1]);}return result;}
function summary(move){
  const active=ranges(move.frames.map(f=>f.hit_boxes.some(b=>'Grab'in b.next_values||b.next_values.Hit.enabled)));
  const throws=ranges(move.frames.map(f=>f.throw!==null));
  return {animation_frames:move.frames.length,first_active_frame:active[0]?.[0]??throws[0]?.[0]??null,active_windows:active.length?active:null,throw_windows:throws.length?throws:null,iasa:move.iasa===null?null:move.iasa+1,landing_lag:move.landing_lag,l_cancel_landing_lag:move.landing_lag===null?null:Math.floor(move.landing_lag/2),autocancel_windows:move.landing_lag===null?null:ranges(move.frames.map(f=>!f.landing_lag)),invincible_windows:ranges(move.frames.map(f=>f.hurt_boxes.length>0&&f.hurt_boxes.every(b=>b.state==='Invincible'))),intangible_windows:ranges(move.frames.map(f=>f.hurt_boxes.length>0&&f.hurt_boxes.every(b=>b.state.startsWith('Intangible'))))};
}
await mkdir(join(out,'fighters'),{recursive:true});
let manifestBytes;
try{manifestBytes=await readFile(join(root,'manifest.json'));}
catch(error){if(error.code==='ENOENT'){await buildCompendium(out);console.log('No extracted dataset: workbook study cards remain available.');process.exit(0);}throw error;}
const manifest=JSON.parse(manifestBytes.toString('utf8'));
const index={schemaVersion:1,version:manifest.version,verification:manifest.verification,sourceFingerprint:sha(manifestBytes),generatedAt:new Date().toISOString(),fighters:[]};
const server=await createServer({server:{middlewareMode:true,watch:null,hmr:false},appType:'custom',logLevel:'error'});
try{
const {presentSmash}=await server.ssrLoadModule('/src/data/smash-sequences.ts');
const {smashStartFor}=await server.ssrLoadModule('/src/data/moves.ts');
async function decoded(path){let move=await read(path);if(move.sharedMove){const base=await read(move.sharedMove.path);move={...base,name:move.name,moveId:move.moveId};}return move;}
for(const fighterEntry of manifest.fighters){
  const fighter=await read(fighterEntry.path),hits=[],moves=[];
  // Process sequentially to bound memory; release each decoded animation.
  for(const entry of fighter.moves){
    if(!entry.totalFrames)continue;
    const startFamily=entry.internalName.match(/^Attack(S4|Hi4|Lw4)Start$/)?.[1];
    const primaryName=startFamily==='S4'?'AttackS4S':startFamily==='Lw4'&&fighter.id==='ike'?'AttackLw41':`Attack${startFamily}`;
    const primary=startFamily&&fighter.moves.find(e=>e.internalName===primaryName&&e.totalFrames);
    if(primary){
      const sequence=await presentSmash(fighter,primary,decoded);
      const ownFrames=sequence.frames.map(f=>f.sourceMoveId===entry.id?f:{...f,hit_boxes:[],throw:null});
      // Keep the original start-bubble IDs, but point to their checked frame in
      // the complete smash. Do not create cards for the discarded transition.
      if(sequence.timing){hits.push(...extractStudyHits({...sequence,frames:ownFrames},entry).map(hit=>({...hit,moveId:primary.id,path:primary.path,internalName:primary.internalName,view:'full'})));continue;}
    }
    const full=!!smashStartFor(entry,fighter.moves,fighter.id);
    const move=full?await presentSmash(fighter,entry,decoded):await decoded(entry.path);
    // A follow-up's display includes the earlier hit. Its cards retain only the
    // follow-up bubbles, with their old IDs and the corrected global frame.
    const collisionMove=full?{...move,frames:move.frames.map(f=>f.sourceMoveId&&f.sourceMoveId!==entry.id?{...f,hit_boxes:[],throw:null}:f)}:move;
    const bubbles=extractStudyHits(collisionMove,entry).map(hit=>full?{...hit,view:'full'}:hit);hits.push(...bubbles);
    // Get-up dodge timings need their animation/hurtbox data even without attacks.
    if(bubbles.length||move.timing||/^Down(Stand|Forward|Back)(U|D)$/.test(entry.internalName)){
      const stats=summary(move);if(move.timing){stats.active_windows=move.timing.active;stats.first_active_frame=move.timing.active?.[0]?.[0]??null;stats.first_actionable_frame=move.timing.actionable;}
      moves.push({id:entry.id,internalName:entry.internalName,path:entry.path,stats,warnings:move.warnings,...(full?{view:'full'}:{})});
    }
  }
  const data={schemaVersion:1,id:fighter.id,name:fighter.name,sourcePath:fighterEntry.path,attributes:fighter.attributes,hits,moves,warnings:fighter.warnings};
  const path=`fighters/${fighter.id}.json`,json=JSON.stringify(data);
  await writeFile(join(out,path),json);
  index.fighters.push({id:fighter.id,name:fighter.name,path,cards:hits.filter(h=>h.kind!=='throw').length,bubbles:hits.length,moves:moves.length,sha256:sha(json)});
  console.log(`${fighter.name}: ${hits.length} collision phases, ${moves.length} timing moves`);
}
await writeFile(join(out,'index.json'),JSON.stringify(index));
console.log(`Study catalog generated for ${index.fighters.length} fighters.`);
await buildCompendium(out,index);
}finally{await server.close();}
