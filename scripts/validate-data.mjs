import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { readMove } from './read-move.mjs';
import assert from 'node:assert/strict';
export async function validateDataset(folder,{release=false}={}){
  const root=resolve(folder);
  const inside=path=>{const target=resolve(root,path);assert(target.startsWith(root+sep),'Dataset path escapes its folder');assert(!path.includes('\\'),'Dataset paths must use /');return target;};
  const manifest=JSON.parse(await readFile(inside('manifest.json'),'utf8'));
  assert.equal(manifest.schemaVersion,1);assert.equal(manifest.game,'Project+');assert.equal(manifest.version,'3.2');
  assert.equal(manifest.parser.name,'brawllib_rs');assert.equal(manifest.parser.version,'0.29.0');
  assert(['verified','unverified'].includes(manifest.verification));assert.equal(typeof manifest.partial,'boolean');
  assert(manifest.fighters.length>0,'Dataset has no fighters');assert(manifest.sourceChecksums.length>0,'Source checksums missing');
  for(const checksum of manifest.sourceChecksums){assert(['brawl','pplus'].includes(checksum.source));assert(/^[a-f0-9]{64}$/.test(checksum.sha256));}
  if(release){assert.equal(manifest.partial,false,'Release requires a complete dataset');assert.equal(manifest.verification,'verified','Release requires the source-bound validation report');assert(manifest.fighters.length>=42,'Release roster is incomplete');}
  const ids=new Set();let moveCount=0,frameCount=0;
  for(const entry of manifest.fighters){
    assert(!ids.has(entry.id),'Duplicate fighter ID');ids.add(entry.id);
    const fighter=JSON.parse(await readFile(inside(entry.path),'utf8'));
    assert.equal(fighter.schemaVersion,1);assert.equal(fighter.id,entry.id);assert.equal(fighter.moves.length,entry.moveCount);
    const moves=new Set();
    for(const m of fighter.moves){
      assert(!moves.has(m.id),'Duplicate move ID');moves.add(m.id);
      const bytes=await readFile(inside(m.path));
      assert.equal(createHash('sha256').update(bytes).digest('hex'),m.sha256,`Checksum mismatch: ${m.path}`);
      const move=await readMove(root,m.path,bytes);
      assert.equal(move.schemaVersion,1);assert.equal(move.moveId,m.id);assert.equal(move.fighterId,entry.id);assert.equal(move.frames.length,m.totalFrames);
      assert.equal(typeof move.bad_interrupts,'boolean');assert(Array.isArray(move.warnings));
      // Landing subactions may become actionable immediately after the final stored frame.
      assert(move.iasa===null||Number.isSafeInteger(move.iasa)&&move.iasa>=0,'Invalid IASA');
      assert(move.landing_lag===null||Number.isFinite(move.landing_lag)&&move.landing_lag>=0,'Invalid landing lag');
      for(const [index,frame] of move.frames.entries()){
        assert.equal(frame.index,index,'Frame indexes must start at zero');
        assert(Array.isArray(frame.hit_boxes)&&Array.isArray(frame.hurt_boxes));assert(Number.isFinite(frame.x_pos)&&Number.isFinite(frame.y_pos));
        const finiteTree=(value)=>{if(typeof value==='number')assert(Number.isFinite(value),'Non-finite frame geometry');else if(value&&typeof value==='object')Object.values(value).forEach(finiteTree);};
        finiteTree(frame);
        for(const box of frame.hit_boxes)assert(box.next_size>=0&&(box.prev_size===null||box.prev_size>=0),'Invalid hitbox radius');
        for(const box of frame.hurt_boxes)assert(box.hurt_box.radius>=0,'Invalid hurtbox radius');
      }
      moveCount++;frameCount+=move.frames.length;
    }
  }
  console.log(`Dataset valid: ${manifest.fighters.length} fighters, ${moveCount} subactions, ${frameCount} frames; ${manifest.verification}${manifest.partial?', partial':''}.`);
  return manifest;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename))await validateDataset(process.argv[2]??'public/data',{release:process.argv.includes('--release')});
