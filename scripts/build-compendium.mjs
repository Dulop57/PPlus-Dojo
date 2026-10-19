import {createServer} from 'vite';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const excludedStudyFighterIds=new Set(['giga-bowser','wario-man']);
export async function buildCompendium(out,index=null){
  const server=await createServer({server:{middlewareMode:true,watch:null},appType:'custom',logLevel:'error'});
  try {
    const {referenceStudyCards,fighterStudyCards,stageBook}=await server.ssrLoadModule('/src/data/study-cards.ts');
    const {selectedStudyCards}=await server.ssrLoadModule('/src/data/study-selection.ts');
    const {catalog}=await server.ssrLoadModule('/src/data/catalog.ts');
    const selection=JSON.stringify(JSON.parse(await readFile('src/data/study-selection.json','utf8')));
    const cards=referenceStudyCards();
    for(const entry of index?.fighters??[]){if(excludedStudyFighterIds.has(entry.id))continue;const fighter=JSON.parse(await readFile(join(out,entry.path),'utf8'));cards.push(...fighterStudyCards(fighter,index.verification));}
    const selected=[...new Map(selectedStudyCards(cards).map(c=>[c.id,c])).values()];
    const fighters=new Map(catalog.map(f=>[f.id,{id:f.id,name:f.name,kind:'fighter'}]));
    for(const f of index?.fighters??[])if(!excludedStudyFighterIds.has(f.id)&&!fighters.has(f.id))fighters.set(f.id,{id:f.id,name:f.name,kind:'fighter'});
    const compact=selected.map(({id,deck,subjectId,subject,topic,field,question,answer,href,move})=>({id,deck,subjectId,subject,topic,field,question,answer,href,...(move?{move}:{})}));
    const data={schemaVersion:1,sourceFingerprint:index?.sourceFingerprint??null,selectionFingerprint:createHash('sha256').update(selection).digest('hex'),complete:!!index,generatedAt:new Date().toISOString(),subjects:[...fighters.values(),...stageBook.stages.map(s=>({id:s.id,name:s.name,kind:'stage'}))],cards:compact};
    await mkdir(out,{recursive:true});await writeFile(join(out,'compendium.json'),JSON.stringify(data));
    console.log(`Compendium: ${compact.length} selected cards, ${data.subjects.length} subjects.`);
  } finally {await server.close();}
}
