import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const file='FLASHCARD-STATS.md',text=await readFile(file,'utf8');
const entries=[],ids=new Set();let deck,topic;
for(const line of text.split(/\r?\n/)){
  const heading=line.match(/^## (Character stats|Collision cards|Stage cards) \/ (.+)$/);
  if(heading){deck={'Character stats':'attributes','Collision cards':'hitboxes','Stage cards':'stages'}[heading[1]];topic=heading[2];continue;}
  const entry=line.match(/^- \[x\] ([A-Z]{2}-[a-f0-9]{8}) — (.+)$/i);
  if(!entry)continue;
  if(!deck||!topic)throw new Error(`A checked stat has no deck/topic: ${line}`);
  const [id,field]=entry.slice(1),prefix={attributes:'CS',hitboxes:'HB',stages:'ST'}[deck];
  const expected=`${prefix}-${createHash('sha256').update(JSON.stringify([deck,topic,field])).digest('hex').slice(0,8)}`;
  if(id!==expected)throw new Error(`Stat ID/label mismatch: ${id} — ${field}. Keep the original ID and label when selecting stats.`);
  if(ids.has(id))throw new Error(`Duplicate selected stat: ${id}`);ids.add(id);
  entries.push({id,deck,topic,field});
}
if(!entries.length)throw new Error('No checked stats found. Refusing to replace the selection with an empty catalog.');
await writeFile('src/data/study-selection.json',JSON.stringify({schemaVersion:1,mergeMainRankings:true,entries},null,2)+'\n');
const counts=Object.fromEntries(['attributes','hitboxes','stages'].map(deck=>[deck,entries.filter(e=>e.deck===deck).length]));
console.log(`Applied ${entries.length} selected stat entries: ${JSON.stringify(counts)}. Main attribute values and ranks will share a card.`);
