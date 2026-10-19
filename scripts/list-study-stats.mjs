import {createServer} from 'vite';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
// Reuse the actual TypeScript generators and workbook adapters so this list
// describes live cards, rather than a separately maintained set of labels.
const server=await createServer({server:{middlewareMode:true,watch:null},appType:'custom',logLevel:'error'});
try{
  const {referenceStudyCards,fighterStudyCards,scalarFields,labelField}=await server.ssrLoadModule('/src/data/study-cards.ts');
  const groups=new Map();
  const prefixes={attributes:'CS',hitboxes:'HB',stages:'ST'};
  function add(card){
    const topic=card.deck==='hitboxes'?'Hitbubble, grab and throw parameters':card.topic.startsWith('Move stats ·')?'Move stats (all attack groups)':card.topic;
    const key=JSON.stringify([card.deck,topic,card.field]);
    let group=groups.get(key);
    if(!group){group={id:`${prefixes[card.deck]}-${createHash('sha256').update(key).digest('hex').slice(0,8)}`,deck:card.deck,topic,field:card.field,cards:0,subjects:new Set(),categories:new Set(),example:card.question};groups.set(key,group);}
    group.cards++;group.subjects.add(card.subjectId);group.categories.add(card.topic);
  }
  for(const card of referenceStudyCards())add(card);
  const index=JSON.parse(await readFile('public/study/index.json','utf8'));
  for(const entry of index.fighters){
    const fighter=JSON.parse(await readFile(join('public/study',entry.path),'utf8'));
    for(const card of fighterStudyCards(fighter,index.verification,'attributes'))add(card);
    for(const card of fighterStudyCards(fighter,index.verification,'hitboxes'))add(card);
  }
  const sorted=[...groups.values()].sort((a,b)=>['attributes','hitboxes','stages'].indexOf(a.deck)-['attributes','hitboxes','stages'].indexOf(b.deck)||a.topic.localeCompare(b.topic)||a.field.localeCompare(b.field,undefined,{numeric:true}));
  const data=sorted.map(g=>({...g,subjects:[...g.subjects].sort(),categories:[...g.categories].sort()}));
  const counts=Object.fromEntries(Object.keys(prefixes).map(deck=>[deck,data.filter(g=>g.deck===deck).length]));
  const lines=['# Flashcard stats — selection list','',`This is the complete current list: **${data.length} stat entries** (${counts.attributes} character stats, ${counts.hitboxes} collision parameters, ${counts.stages} stage stats). Z-scores, including columns abbreviated “Z”, have already been removed.`,'','All entries below currently make cards. **Uncheck or delete the stats you do not want**, then send back this file or the remaining IDs/names. These edits do not change the game until the selection is applied.','', 'The same concept may appear under both an extracted field and a workbook label. They are listed separately so you can choose which source to keep. Move stats apply to every attack group; collision parameters apply wherever the source records them. Missing values do not make cards.','', 'Labels containing “Unknown”, camera values, bone IDs, individual frame calculations, and hit flags are included because the current catalog includes them. They are candidates for removal if you only want competitive gameplay facts.',''];
  let previous='';
  for(const row of data){
    const heading=`${row.deck==='attributes'?'Character stats':row.deck==='hitboxes'?'Collision cards':'Stage cards'} / ${row.topic}`;
    if(heading!==previous){lines.push(`## ${heading}`,'');previous=heading;}
    lines.push(`- [x] ${row.id} — ${row.field}`);
  }
  lines.push('','## Already excluded','', '- Z-score / Z-Score / Z columns','');
  await mkdir('artifacts/study-stats',{recursive:true});
  // The selection file is user-edited. Never regenerate over their choices.
  await writeFile('artifacts/study-stats/FLASHCARD-STATS-AVAILABLE.md',lines.join('\n'));
  await mkdir('artifacts/study-stats',{recursive:true});
  await writeFile('artifacts/study-stats/stats.json',JSON.stringify({schemaVersion:1,counts,stats:data},null,2));
  console.log(JSON.stringify({entries:data.length,counts,file:resolve('artifacts/study-stats/FLASHCARD-STATS-AVAILABLE.md')}));
}finally{await server.close();}
