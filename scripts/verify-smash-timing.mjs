import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {readMove} from './read-move.mjs';
const root=resolve('public/data'),manifest=JSON.parse(await readFile(join(root,'manifest.json')));
const checked=JSON.parse(await readFile('src/data/smash-timing.json'));
const server=await createServer({server:{middlewareMode:true,watch:null,hmr:false},appType:'custom',logLevel:'error'});
try{
  const {presentSmash,checkedSmashTiming}=await server.ssrLoadModule('/src/data/smash-sequences.ts');
  const {summarize,ranges,combineSmash,smashStartFor}=await server.ssrLoadModule('/src/data/moves.ts');
  const report={source:checked.source,sha256:checked.sha256,checked:[],retimedGeometry:[],missingGeometry:[],changedFromOldViewer:[]};
  for(const f of manifest.fighters){
    if(!checked.fighters[f.id])continue;
    const fighter=JSON.parse(await readFile(join(root,f.path)));
    const read=path=>readMove(root,path);
    const catalog=JSON.parse(await readFile(`public/study/fighters/${f.id}.json`));
    for(const [name,timing] of Object.entries(checked.fighters[f.id])){
      const entry=fighter.moves.find(m=>m.internalName===name);assert(entry);
      assert(checkedSmashTiming(fighter,entry),`${f.id}/${name} checksum binding`);
      const raw=await read(entry.path),rawBefore=JSON.stringify(raw);
      const presented=await presentSmash(fighter,entry,path=>path===entry.path?Promise.resolve(raw):read(path));
      assert.equal(JSON.stringify(raw),rawBefore,'Raw payload mutated');
      const summary=summarize(presented);
      assert.deepEqual(summary.active,timing.active??[],`${f.id}/${name} active`);
      assert.equal(summary.iasa,timing.actionable,`${f.id}/${name} actionable`);
      assert(presented.frames.length>=timing.actionable);
      const collisions=ranges(presented.frames.map(f=>f.hit_boxes.some(h=>'Grab' in h.next_values||h.next_values.Hit.enabled)));
      if(!presented.timing.missingGeometry)assert.deepEqual(collisions,timing.active??[],`${f.id}/${name} visible bubble windows`);
      const move=catalog.moves.find(m=>m.id===entry.id);assert(move,`${f.id}/${name} catalog`);
      assert.deepEqual(move.stats.active_windows,timing.active);
      assert.equal(move.stats.first_actionable_frame,timing.actionable);
      for(const hit of catalog.hits.filter(h=>h.moveId===entry.id&&h.view==='full')){
        const box=presented.frames[hit.frame-1]?.hit_boxes[hit.boxIndex];assert(box,`${f.id}/${name} bubble geometry`);
        assert.equal(box.hitbox_id,hit.hitboxId);assert.equal(box.next_size,hit.radius);
        assert.deepEqual('Hit' in box.next_values?box.next_values.Hit:box.next_values.Grab,hit.values);
      }
      const item={fighter:f.id,move:name,active:summary.active,actionable:summary.iasa};report.checked.push(item);
      if(presented.timing.geometryRetimed)report.retimedGeometry.push(item);
      if(presented.timing.missingGeometry)report.missingGeometry.push(item);
      const oldFamily=name.match(/^Attack(S4|Hi4|Lw4)(S|Hi|Lw)?(_\d+)?$/)?.[1];
      const start=oldFamily&&fighter.moves.find(m=>m.internalName===`Attack${oldFamily}Start`&&m.totalFrames);
      const old=start?summarize(combineSmash(await read(start.path),raw)):summarize(raw);
      if(JSON.stringify(old.active)!==JSON.stringify(summary.active)||Math.min(old.total,old.iasa??Infinity)!==summary.iasa)report.changedFromOldViewer.push({...item,old:{active:old.active,actionable:Math.min(old.total,old.iasa??Infinity)}});
    }
  }
  const before=JSON.parse(await readFile('artifacts/smash-compendium-before.json'));
  const after=JSON.parse(await readFile('public/study/compendium.json'));
  const previous=new Map(before.cards.map(c=>[c.id,c])),current=new Map(after.cards.map(c=>[c.id,c]));
  report.catalog={before:before.cards.length,after:after.cards.length,added:after.cards.filter(c=>!previous.has(c.id)),removed:before.cards.filter(c=>!current.has(c.id)),changedAnswers:after.cards.filter(c=>previous.has(c.id)&&previous.get(c.id).answer!==c.answer)};
  // Changed move timing keeps its stable ID. Bubble answers and non-smash answers remain unchanged.
  for(const c of report.catalog.changedAnswers)assert(c.topic==='Move stats · Smashes',`Unexpected answer change: ${c.id}`);
  for(const c of report.catalog.removed)assert.equal(c.subjectId,'olimar',`Unexpected removed card: ${c.id}`);
  assert(!after.cards.some(c=>c.subjectId==='olimar'&&(c.move&&c.topic!=='Attributes · Dodges'||c.deck==='hitboxes'||c.topic==='Attributes · Grab Timings'||/Ledge.*Attack/i.test(c.question))));
  await writeFile('artifacts/smash-timing-verification.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({checked:report.checked.length,changedViewer:report.changedFromOldViewer.length,retimedGeometry:report.retimedGeometry.map(x=>`${x.fighter}/${x.move}`),missingGeometry:report.missingGeometry.map(x=>`${x.fighter}/${x.move}`),catalog:{before:report.catalog.before,after:report.catalog.after,added:report.catalog.added.length,removed:report.catalog.removed.length,changedAnswers:report.catalog.changedAnswers.length}},null,2));
}finally{await server.close();}
