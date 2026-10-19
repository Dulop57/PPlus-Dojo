import {describe,it,expect} from 'vitest';
import {extractStudyHits} from '../scripts/study-hits.mjs';
import {fixtureFrame,sandboxMove} from '../src/data/sandbox';
import {fighterStudyCards,isolatedStudyMove,referenceStudyCards,referenceFighters,stageBook,scalarFields,attributeBook} from '../src/data/study-cards';
import {attributeFields,fieldRows} from '../src/data/attribute-sections';
import {defaultSettings,rateCard,Rating,restoreProgress,studyQueue,validateBackup,type Progress} from '../src/data/study-progress';
import type {StudyFighter} from '../src/data/study-types';
import {isExcludedStudyFighter} from '../src/data/study-exclusions';
const entry={id:'AttackAirF-1',internalName:'AttackAirF',path:'fixture.json',totalFrames:5,warnings:[],sha256:''};
function hitFrame(index:number,damage=10){const frame=fixtureFrame(7);frame.index=index;const b=frame.hit_boxes[0];if('Hit'in b.next_values)b.next_values.Hit={...b.next_values.Hit,damage};return frame;}
describe('Collision card coverage',()=>{
  it('Keeps IDs, sets, changing parameters and disjoint windows without making a card for every motion frame',()=>{
    const frames=[hitFrame(0),hitFrame(1),{...hitFrame(2),hit_boxes:[]},hitFrame(3),hitFrame(4,15)];
    frames[1].hit_boxes[0].next_pos={x:5,y:8,z:10};
    const hits=extractStudyHits({...sandboxMove,frames},entry);
    expect(hits).toHaveLength(2);expect(hits[0].ranges).toEqual([[1,2],[4,4]]);expect(hits[1].ranges).toEqual([[5,5]]);expect(hits[0].values.damage).toBe(10);expect(hits[1].values.damage).toBe(15);
  });
  it('Excludes disabled hitboxes, retains all simultaneous bubbles, grabs, and throw events',()=>{
    const frame=hitFrame(0),box=frame.hit_boxes[0];
    if('Hit'in box.next_values)box.next_values.Hit.enabled=false;
    frame.hit_boxes.push({...box,hitbox_id:99,next_values:{Grab:{hitbox_id:99,size:3,target:'Ground'}}});
    frame.throw={damage:8,trajectory:45,kbg:60,bkb:30,wdsk:0};
    const hits=extractStudyHits({...sandboxMove,frames:[frame]},entry);
    expect(hits.map(h=>h.kind)).toEqual(['grab','throw']);expect(hits[0].boxIndex).toBe(1);expect(hits[1].boxIndex).toBeNull();
  });
  it('Makes one table card for each physical bubble and retains source geometry without mutation',()=>{
    const frame=hitFrame(0);frame.hit_boxes.push({...frame.hit_boxes[0],hitbox_id:88});
    const move={...sandboxMove,frames:[frame]},hits=extractStudyHits(move,entry);
    const fighter:StudyFighter={schemaVersion:1,id:move.fighterId,name:'Fixture',sourcePath:'index.json',attributes:{weight:75,flags:{throws:true},missing:null},hits,moves:[],warnings:[]};
    const cards=fighterStudyCards(fighter,'unverified'),card=cards.find(c=>c.hit?.hitboxId===88)!;
    expect(cards.filter(c=>c.deck==='hitboxes')).toHaveLength(2);expect(card.field).toBe('Bubble data');expect(Object.keys(card.bubbleAnswer!)).toEqual(['id','type','damage','angle','kbg','bkb','wdsk','radius']);
    expect(cards.some(c=>c.field==='Flags Throws')).toBe(true);expect(cards.some(c=>c.field==='Missing')).toBe(false);
    const isolated=isolatedStudyMove(move,card);expect(isolated.frames[0].hit_boxes).toHaveLength(1);expect(isolated.frames[0].hit_boxes[0].hitbox_id).toBe(88);expect(isolated.frames[0].hurt_boxes).toBe(frame.hurt_boxes);expect(move.frames[0].hit_boxes).toHaveLength(2);
    expect(cards.every(c=>c.source.includes('unverified'))).toBe(true);expect(new Set(cards.map(c=>c.id)).size).toBe(cards.length);
  });
});
describe('Workbook coverage and source context',()=>{
  const cards=referenceStudyCards();
  it('Covers all 42 roster fighters and all 20 stages with unique IDs and no invented values',()=>{
    expect(new Set(cards.filter(c=>c.deck==='attributes').map(c=>c.subjectId)).size).toBe(42);
    expect(cards.some(c=>isExcludedStudyFighter(c.subjectId))).toBe(false);
    expect(new Set(cards.filter(c=>c.deck==='stages').map(c=>c.subjectId)).size).toBe(20);
    expect(new Set(cards.map(c=>c.id)).size).toBe(cards.length);expect(cards.some(c=>c.answer==='Unavailable')).toBe(false);
    expect(cards.find(c=>c.subjectId==='fox'&&c.question.includes('Weight · Weight'))?.answer).toBe('75');
    expect(cards.filter(c=>c.deck==='attributes').every(c=>c.source.includes('3.1.5'))).toBe(true);
  });
  it('Preserves exact stage coordinate values and distinguishes distances from coordinates',()=>{
    for(const stage of stageBook.stages)for(const [key,value]of scalarFields(stage.geometry))expect(cards.find(c=>c.id===`workbook:stage:${stage.id}:geometry:${key}`)?.exact).toBe(String(value));
    expect(cards.find(c=>c.id==='workbook:stage:battlefield:summary:side')?.field).toBe('Right ledge to side blastzone');
    expect(referenceFighters('Fox / Falco').map(f=>f.id)).toEqual(['fox','falco']);expect(referenceFighters('C. Falcon')[0].id).toBe('captain-falcon');
  });
  it('Maps every raw-data fighter name, including game filenames and transformations, and preserves each cached value',()=>{
    const sheet=attributeBook.sheets.find(s=>s.name==='Raw Data')!;
    const keys=new Set(cards.map(c=>c.id));
    for(const field of attributeFields(sheet))for(const [name,cell]of fieldRows(sheet,field.column)){
      const fighters=referenceFighters(String(name.v));expect(fighters.length,String(name.v)).toBeGreaterThan(0);
      if(cell.v!==null&&cell.v!=='')for(const fighter of fighters.filter(f=>!isExcludedStudyFighter(f.id)))expect(keys.has(`workbook:attribute:${fighter.id}:Raw Data:${cell.r}:${cell.c}:${field.label}`)).toBe(true);
    }
  });
  it('Excludes Z-score statistics, including the abbreviated Z column, from cards',()=>{
    expect(cards.filter(c=>/z[\s-]*score/i.test(c.field)||/·\s*Z$/i.test(c.field))).toHaveLength(0);
    expect(cards.some(c=>c.field==='Weight rank')).toBe(true);
  });
});
describe('FSRS persistence and daily review queues',()=>{
  const now=new Date('2026-10-11T14:00:00Z'),cards=[{id:'a',answer:'1'},{id:'b',answer:'2'},{id:'c',answer:'3'}];
  it('Persists a real FSRS result, restores dates, and brings learning cards back when due',()=>{
    const {progress}=rateCard('a','1',undefined,Rating.Again,defaultSettings,now);
    expect(progress.card.reps).toBe(1);expect(progress.card.due.getTime()).toBeGreaterThan(now.getTime());
    const restored=restoreProgress(JSON.parse(JSON.stringify(progress)));expect(restored.card.due).toBeInstanceOf(Date);
    expect(studyQueue(cards,new Map([['a',restored]]),{...defaultSettings,newPerDay:0},now).due).toBe(0);
    expect(studyQueue(cards,new Map([['a',restored]]),{...defaultSettings,newPerDay:0},restored.card.due).due).toBe(1);
  });
  it('Enforces the global new-card limit and respects suspension and answer corrections',()=>{
    const p=rateCard('a','1',undefined,Rating.Easy,defaultSettings,now).progress;
    const states=new Map<string,Progress>([['a',p]]);
    expect(studyQueue(cards,states,{...defaultSettings,newPerDay:1},now).new).toBe(0);
    expect(studyQueue([{id:'a',answer:'changed'}],states,defaultSettings,now).due).toBe(1);
    states.set('a',{...p,suspended:true});expect(studyQueue([{id:'a',answer:'changed'}],states,defaultSettings,now).cards).toHaveLength(0);
    const corrected=rateCard('a','changed',p,Rating.Good,defaultSettings,now).progress;
    expect(corrected.card.reps).toBe(1);expect(corrected.answer).toBe('changed');
  });
  it('Rejects malformed backups before altering storage',()=>{
    const p=rateCard('a','1',undefined,Rating.Good,defaultSettings,now).progress;
    const backup={schemaVersion:1,app:'P+ Dojo Study',settings:defaultSettings,progress:[p],reviews:[]};
    expect(validateBackup(JSON.parse(JSON.stringify(backup))).progress).toHaveLength(1);
    expect(()=>validateBackup({...backup,progress:[{...p,card:{...p.card,due:'bad date'}}]})).toThrow();
    expect(()=>validateBackup({...backup,settings:{retention:1,newPerDay:20}})).toThrow();
  });
});
