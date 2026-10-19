import attributeSource from './reference/attributes.json';
import stageSource from './reference/stages.json';
import {attributeFields,attributeSections,fieldRows} from './attribute-sections';
import {columnLetter,displayCell,rankings,type ReferenceBook,type ReferenceCell,type StageBook} from './reference';
import {catalog} from './catalog';
import {formatRanges,moveLabel} from './moves';
import {moveHref} from '../router';
import {isExcludedStudyFighter} from './study-exclusions';
import type {StudyCard,StudyFighter,StudyHit,BubbleAnswer} from './study-types';
import type {MoveData} from './types';

export const stageBook=stageSource as StageBook;
export const attributeBook=attributeSource as ReferenceBook;
import {referenceFighters} from './reference-fighters';
export {referenceFighters} from './reference-fighters';
const normalize=(name:string)=>name.toLowerCase().replace(/[^a-z0-9]/g,'');
export function labelField(key:string){
  const names:Record<string,string>={trajectory:'Launch angle',kbg:'Knockback growth (KBG)',bkb:'Base knockback (BKB)',wdsk:'Weight-dependent set knockback',shield_damage:'Shield damage',hitlag_mult:'Hitlag multiplier',sdi_mult:'SDI multiplier',size:'Radius / size',damage:'Damage',ground:'Hits grounded opponents',aerial:'Hits airborne opponents',iasa:'IASA',first_active_frame:'First active frame',animation_frames:'Animation length',active_windows:'Active frames',throw_windows:'Throw event frames',autocancel_windows:'Autocancel frames',intangible_windows:'Intangible frames',invincible_windows:'Invincible frames',l_cancel_landing_lag:'L-cancelled landing lag',jump_squat_frames:'Jumpsquat',num_jumps:'Number of jumps',weight:'Weight',gravity:'Gravity',landing_lag:'Landing lag',windows:'Active frames'};
  return names[key]??key.replace(/[_.]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
}
export function scalarFields(value:unknown,prefix=''): [string,number|string|boolean][] {
  if(typeof value==='number')return Number.isFinite(value)?[[prefix,value]]:[];
  if(typeof value==='string'||typeof value==='boolean')return [[prefix,value]];
  if(value&&typeof value==='object')return Object.entries(value).flatMap(([key,v])=>scalarFields(v,prefix?`${prefix}.${key}`:key));
  return [];
}
export function studyValue(value:unknown):string{
  if(typeof value==='boolean')return value?'Yes':'No';
  if(typeof value==='number')return new Intl.NumberFormat('en-US',{maximumFractionDigits:6}).format(value);
  if(Array.isArray(value)&&value.every(v=>Array.isArray(v)&&v.length===2))return formatRanges(value as [number,number][]);
  return String(value??'Unavailable');
}
export function isNormalMoveStat(internalName:string){
  // Forward attacks may use either the unsuffixed name or the neutral S name.
  // Up/down directions are normal attacks; angled/numbered/charge phases aren't.
  return !/^Attack(?:S3|Hi3|Lw3|S4|Hi4|Lw4)/.test(internalName)||/^Attack(?:S[34]S?|Hi[34]|Lw[34])$/.test(internalName);
}
export const bubbleColumns=['ID / type','Damage','Angle','KBG','BKB','WDSK'];
export function bubbleAnswer(hit:StudyHit):BubbleAnswer{
  const number=(key:string)=>typeof hit.values[key]==='number'?hit.values[key] as number:null;
  return {id:hit.hitboxId!,type:hit.kind==='grab'?'Grab':'Hit',damage:number('damage'),angle:number('trajectory'),kbg:number('kbg'),bkb:number('bkb'),wdsk:number('wdsk'),radius:hit.radius??number('size')??0};
}
export function bubbleAnswerCells(answer:BubbleAnswer){
  const numeric=(value:number|null)=>value===null?'N/A':studyValue(value);
  return [`${answer.id} / ${answer.type}`,answer.damage===null?'N/A':`${studyValue(answer.damage)}%`,answer.angle===null?'N/A':answer.angle===361?'361 (Sakurai)':`${studyValue(answer.angle)}°`,numeric(answer.kbg),numeric(answer.bkb),numeric(answer.wdsk)];
}
export function fighterStudyCards(fighter:StudyFighter,verification:string,deck?:'attributes'|'hitboxes'):StudyCard[]{
  if(isExcludedStudyFighter(fighter.id))return [];
  const result:StudyCard[]=[],source=`Project+ 3.2 extraction · ${verification}`;
  if(deck!=='hitboxes')for(const [key,value]of scalarFields(fighter.attributes))result.push({id:`pplus3.2:constant:${fighter.id}:${key}`,deck:'attributes',subjectId:fighter.id,subject:fighter.name,topic:'Extracted constants',field:labelField(key),question:`${fighter.name}: what is ${labelField(key)}?`,answer:studyValue(value),exact:String(value),source,href:`#/fighters/${fighter.id}`,note:`Extracted field: ${key}. ${fighter.warnings.join(' ')}`});
  if(deck!=='hitboxes')for(const move of fighter.moves){
    if(fighter.id==='olimar'&&!/^Down(Stand|Forward|Back)(U|D)$/.test(move.internalName))continue;
    const followup=(fighter.id==='ike'&&/^AttackLw4[12]$/.test(move.internalName))||(['link','pit'].includes(fighter.id)&&move.internalName==='AttackS4S2');
    if(!isNormalMoveStat(move.internalName)&&!followup)continue;
    const label=moveLabel(move.internalName,fighter.id);
    if(label.category==='Specials'||label.category==='Other subactions')continue;
    const stats={...move.stats};
    const actionable=[stats.animation_frames,stats.iasa].filter((value):value is number=>typeof value==='number'&&Number.isFinite(value));
    if(/^Down(Stand|Forward|Back)(U|D)$/.test(move.internalName)){
      const fields:[string,string,unknown][]=[['intangible_windows','Intangible frames',stats.intangible_windows]];
      if(actionable.length)fields.push(['first_actionable_frame','Actionable',Math.min(...actionable)]);
      for(const [key,field,value]of fields){
        if(value===null||value===undefined)continue;
        result.push({id:`pplus3.2:move:${fighter.id}:${move.id}:${key}`,deck:'attributes',subjectId:fighter.id,subject:fighter.name,topic:'Attributes · Dodges',field,question:`${fighter.name} · ${label.name}: ${field}?`,answer:studyValue(value),exact:JSON.stringify(value),source,href:moveHref(fighter.id,move.id,1,'raw'),move:{id:move.id,name:label.name,category:label.category},note:`Raw subaction ${move.internalName}. Actionable uses the lower recorded animation length or IASA, or the available value. ${move.warnings.join(' ')}`});
      }
      continue;
    }
    delete stats.first_active_frame;delete stats.animation_frames;delete stats.iasa;
    if(stats.first_actionable_frame===undefined&&actionable.length)stats.first_actionable_frame=Math.min(...actionable);
    const active=stats.active_windows??stats.windows;delete stats.windows;
    if(active!==undefined)stats.active_windows=active;
    for(const [key,value]of Object.entries(stats)){
      if(value===null||['intangible_windows','invincible_windows'].includes(key))continue;
      const field=key==='first_actionable_frame'?'First Actionable Frame':key==='active_windows'?'Active Frames':labelField(key);
      const answer=key==='active_windows'&&Array.isArray(value)?value.map(([from,through]:[number,number])=>from===through?String(from):`${from}-${through}`).join(', ')||'None':studyValue(value);
      result.push({id:`pplus3.2:move:${fighter.id}:${move.id}:${key}`,deck:'attributes',subjectId:fighter.id,subject:fighter.name,topic:`Move stats · ${label.category}`,field,question:`${fighter.name} · ${label.name}: what is ${field}?`,answer,exact:JSON.stringify(value),source,href:moveHref(fighter.id,move.id,1,move.view==='full'?undefined:'raw'),move:{id:move.id,name:label.name,category:label.category},note:`${move.view==='full'?'Uncharged smash, including its start and any preceding hit.':'Raw subaction '+move.internalName+'.'} ${move.warnings.join(' ')}`});
    }
  }
  if(deck!=='attributes')for(const hit of fighter.hits){
    if(fighter.id==='olimar')continue;
    if(hit.kind==='throw'||hit.hitboxId===null||hit.boxIndex===null)continue;
    const label=moveLabel(hit.internalName,fighter.id),values=bubbleAnswer(hit),cells=bubbleAnswerCells(values);
    if(label.category==='Specials')continue;
    result.push({id:`pplus3.2:bubble:${fighter.id}:${hit.id}:table`,deck:'hitboxes',subjectId:fighter.id,subject:fighter.name,topic:label.category,field:'Bubble data',question:`${fighter.name} · ${label.name} · Frame ${hit.frame} · ID ${hit.hitboxId}`,answer:bubbleColumns.map((name,i)=>`${name}: ${cells[i]}`).join('\n'),source,href:moveHref(fighter.id,hit.moveId,hit.frame,hit.view==='full'?undefined:'raw'),move:{id:hit.moveId,name:label.name,category:label.category},hit,bubbleAnswer:values});
  }
  return result;
}
export function referenceStudyCards():StudyCard[]{
  const cards=new Map<string,StudyCard>();
  const source='Attributes workbook · filename 3.2 / internal version 3.1.5';
  function add(fighters:{id:string;name:string}[],sheet:string,topic:string,label:string,cell:ReferenceCell,note?:string){
    if(normalize(label).includes('zscore')||cell.v===null||cell.v===''||typeof cell.v==='number'&&!Number.isFinite(cell.v))return;
    const studySection=['Main','Misc','SH Times'].includes(sheet)?'Main':sheet;
    for(const fighter of fighters){if(isExcludedStudyFighter(fighter.id))continue;const id=`workbook:attribute:${fighter.id}:${sheet}:${cell.r}:${cell.c}:${label}`;cards.set(id,{id,deck:'attributes',subjectId:fighter.id,subject:fighter.name,topic:`Attributes · ${studySection}`,field:label,question:`${fighter.name} · ${topic}: ${label}?`,answer:displayCell(cell),exact:String(cell.v),source,href:`#/attributes/${encodeURIComponent(sheet)}`,note:[`${sheet}!${columnLetter(cell.c)}${cell.r}`,note,cell.note].filter(Boolean).join(' · ')});}
  }
  const main=attributeBook.sheets.find(s=>s.name==='Main')!;
  for(const metric of rankings(main))for(const row of metric.rows){const fighters=referenceFighters(String(row[1]?.v??''));for(let i=0;i<row.length;i++)if(i!==1&&!/^z(?:[\s-]*score)?$/i.test(String(metric.columns[i]?.v??'').trim()))add(fighters,'Main',metric.name,i===0?`${metric.name} rank`:`${metric.name} · ${metric.columns[i]?.v}`,row[i],metric.description);}
  for(const sheet of attributeBook.sheets.filter(s=>!['Main','About','Other Resources'].includes(s.name))){
    if(['Raw Data','Calculations'].includes(sheet.name)){
      for(const field of attributeFields(sheet))for(const [name,cell]of fieldRows(sheet,field.column))add(referenceFighters(String(name.v)),sheet.name,field.label,field.label,cell,field.note);
      continue;
    }
    const sections=attributeSections(sheet).sections;
    for(const section of sections){
      if(section.kind==='groups'){
        for(const row of section.rows)for(const cell of row.slice(1))add(referenceFighters(String(cell.v)),sheet.name,section.title,section.title,row[0],section.description);
        continue;
      }
      const fighterColumn=section.columns.findIndex(c=>/^Fighter/.test(c));
      const activeStart=sheet.name==='Grab Timings'?section.columns.indexOf('First active frame'):-1,activeEnd=sheet.name==='Grab Timings'?section.columns.indexOf('Last active frame'):-1;
      const intangibleStart=sheet.name==='Dodges'?section.columns.indexOf('Intangible from'):-1,intangibleEnd=sheet.name==='Dodges'?section.columns.indexOf('Intangible through'):-1;
      const hitStart=sheet.name==='Ledge stuff'?section.columns.indexOf('Hit from'):-1,hitEnd=sheet.name==='Ledge stuff'?section.columns.indexOf('Hit through'):-1;
      const explicit=section.rows.flatMap(row=>referenceFighters(String(row[fighterColumn>=0?fighterColumn:0]?.v??'')));
      for(const row of section.rows){
        const name=String(row[fighterColumn>=0?fighterColumn:0]?.v??'');
        let fighters=referenceFighters(name);
        if(/^everyone else$/i.test(name))fighters=catalog.filter(f=>!section.rows.some(r=>!String(r[0]?.v).includes('Forward only')&&referenceFighters(String(r[0]?.v)).some(e=>e.id===f.id)));
        if(section.title==='Techs')fighters=catalog;
        if(sheet.name==='Dodges'&&section.title==='Spotdodges'){
          const groups=sections.find(s=>s.title==='Spotdodge groups');
          fighters=groups?.rows.filter(r=>String(r[0].v)===name).flatMap(r=>r.slice(1).flatMap(c=>referenceFighters(String(c.v))))??fighters;
        }
        for(const fighter of fighters){
          let context=section.title;
          if(section.title==='Rolls'){
            if(name.includes('Forward only'))context+=' · Forward';
            else if(/^everyone else$/i.test(name)&&section.rows.some(r=>String(r[0]?.v).includes('Forward only')&&referenceFighters(String(r[0]?.v)).some(f=>f.id===fighter.id)))context+=' · Backward';
          }else if(section.title==='Spotdodges')context=section.title;
          else if(fighterColumn<0)context+=` · ${name}`;
          if(activeStart>=0&&activeEnd>=0&&typeof row[activeStart]?.v==='number'&&typeof row[activeEnd]?.v==='number'){
            const from=row[activeStart],through=row[activeEnd],range=from.v===through.v?displayCell(from):`${displayCell(from)}-${displayCell(through)}`;
            add([fighter],sheet.name,context,'Active Frames',{...from,v:range,note:[from.note,through.note].filter(Boolean).join(' · ')},section.description);
          }
          if(hitStart>=0&&hitEnd>=0){
            const from=row[hitStart],through=row[hitEnd],hasFrom=from?.v!==null&&from?.v!==undefined&&from?.v!=='',hasThrough=through?.v!==null&&through?.v!==undefined&&through?.v!=='';
            if(hasFrom||hasThrough){
              const range=hasFrom&&hasThrough?from.v===through.v?displayCell(from):`${displayCell(from)}-${displayCell(through)}`:`From: ${hasFrom?displayCell(from):'—'} · Through: ${hasThrough?displayCell(through):'—'}`;
              add([fighter],sheet.name,context,'Hit frames',{...(hasFrom?from:through),v:range,note:[from?.note,through?.note].filter(Boolean).join(' · ')},section.description);
            }
          }
          if(intangibleStart>=0&&intangibleEnd>=0){
            const from=row[intangibleStart],through=row[intangibleEnd],hasFrom=from?.v!==null&&from?.v!==undefined&&from?.v!=='',hasThrough=through?.v!==null&&through?.v!==undefined&&through?.v!=='';
            if(hasFrom||hasThrough){
              const range=hasFrom&&hasThrough?from.v===through.v?displayCell(from):`${displayCell(from)}-${displayCell(through)}`:`From: ${hasFrom?displayCell(from):'—'} · Through: ${hasThrough?displayCell(through):'—'}`;
              add([fighter],sheet.name,context,'Intangible frames',{...(hasFrom?from:through),v:range,note:[from?.note,through?.note].filter(Boolean).join(' · ')},section.description);
            }
          }
          for(let i=0;i<row.length;i++)if(i!==fighterColumn&&i!==activeStart&&i!==activeEnd&&i!==intangibleStart&&i!==intangibleEnd&&i!==hitStart&&i!==hitEnd&&!(fighterColumn<0&&i===0))add([fighter],sheet.name,context,section.columns[i]??section.title,row[i],section.description);
        }
      }
    }
  }
  for(const stage of stageBook.stages){
    const labels:Record<string,string>={width:'Stage width',top:'Top blastzone distance (summary)',side:'Right ledge to side blastzone',bottom:'Bottom blastzone distance (summary)',low:'Lowest platform height',high:'Highest platform height',platformWidth:'Platform width',left:'Left ledge X',right:'Right ledge X',ledgeY:'Source ledge Y',blastLeft:'Left blastzone X',blastRight:'Right blastzone X',blastTop:'Top blastzone Y (source coordinates)',blastBottom:'Bottom blastzone Y (source coordinates)',platformLow:'Lower platform Y (source coordinates)',platformHigh:'Upper platform Y (source coordinates)',platformLeft:'Recorded platform left X',platformRight:'Recorded platform right X'};
    for(const [group,values]of Object.entries({summary:stage.summary,geometry:stage.geometry}))for(const [key,value]of scalarFields(values)){
      const id=`workbook:stage:${stage.id}:${group}:${key}`,label=labels[key]??labelField(key);
      cards.set(id,{id,deck:'stages',subjectId:stage.id,subject:stage.name,topic:group==='summary'?'Stage stats':'Stage coordinates',field:label,question:`${stage.name}${stage.variant?` · ${stage.variant}`:''}: what is ${label}?`,answer:studyValue(value),exact:String(value),source:stageBook.source,href:`#/stages/${stage.id}`,note:[stage.notes,...stage.cellNotes.map(n=>`${n.cell}: ${n.text}`),'Coordinates retain the workbook origin. Estimated platform placements are excluded.'].filter(Boolean).join(' ')});
    }
    if(stage.notes){const id=`workbook:stage:${stage.id}:notes`;cards.set(id,{id,deck:'stages',subjectId:stage.id,subject:stage.name,topic:'Stage notes',field:'Notes and hazards',question:`${stage.name}: what notes or hazards does the source describe?`,answer:stage.notes,source:stageBook.source,href:`#/stages/${stage.id}`});}
  }
  return [...cards.values()].filter(card=>card.subjectId!=='olimar'||!['Attributes · Grab Timings','Attributes · Ledge stuff'].includes(card.topic)||card.topic==='Attributes · Ledge stuff'&&!/attack/i.test(card.question));
}
// Select by recorded array index as well as ID: this cannot accidentally expose
// another simultaneous bubble sharing an ID. Keep hurtboxes for body context.
export function isolatedStudyMove(move:MoveData,card:StudyCard):MoveData{
  const hit=card.hit;if(!hit)return move;
  return {...move,frames:move.frames.map((frame,i)=>({...frame,hit_boxes:i===hit.frame-1&&hit.boxIndex!==null?frame.hit_boxes.filter((_,j)=>j===hit.boxIndex):[]}))};
}
