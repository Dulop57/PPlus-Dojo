import {describe,it,expect} from 'vitest';
import {createEmptyCard,State,Rating} from 'ts-fsrs';
import {cardStatus,knowledgeSummary,knowledgeHistory,continueCard,type KnowledgeCard} from '../src/data/study-metrics';
import {studyDay,type Progress,type StoredReview} from '../src/data/study-progress';
import {parseRoute,studyHref} from '../src/router';
const now=new Date(2026,9,11,12);
const at=(offset:number,hour=12)=>{const d=new Date(now);d.setDate(d.getDate()+offset);d.setHours(hour);return d;};
function card(id:string,deck:KnowledgeCard['deck']='attributes'):KnowledgeCard{return {id,deck,subjectId:'marth',subject:'Marth',topic:'Attributes · Main',field:'Weight',question:`Question ${id}`,answer:'87',href:'#/fighters/marth'};}
function progress(id:string,state=State.Review,extra:Partial<Progress>={}):Progress{return {id,answer:'87',introduced:studyDay(at(-2)),suspended:false,card:{...createEmptyCard(at(-2)),state,reps:3,lapses:1,due:at(-1),last_review:at(-2)},...extra};}
function review(id:string,day:number,rating=Rating.Good,answer='87'):StoredReview{return {cardId:id,answer,log:{rating,state:State.Review,due:at(day+1),review:at(day),stability:3,difficulty:3,elapsed_days:1,last_elapsed_days:1,scheduled_days:1,learning_steps:0}};}
describe('Compendium progress',()=>{
 it('Partitions current cards, preserves suspended coverage, excludes old answers and removed cards, and deduplicates IDs',()=>{
  const cards=['unseen','learning','learned','relearning','changed','paused'].map(id=>card(id));
  const p=new Map([progress('learning',State.Learning),progress('learned'),progress('relearning',State.Relearning),progress('changed',State.Review,{answer:'old'}),progress('paused',State.Review,{suspended:true}),progress('removed')].map(p=>[p.id,p]));
  const result=knowledgeSummary([...cards,cards[0]],p,now);
  expect(result.counts).toEqual({unseen:1,learning:1,learned:2,relearning:1,refresh:1});expect(result.total).toBe(6);expect(result.studied).toBe(4);expect(result.remaining).toBe(4);expect(result.due).toBe(4);expect(result.suspended).toBe(1);expect(result.learnedPercent).toBeCloseTo(100/3);
  expect(cardStatus(card('changed'),p.get('changed'))).toBe('refresh');
 });
 it('Does not declare empty categories complete and a due Review card stays learned',()=>{
  expect(knowledgeSummary([],new Map(),now)).toMatchObject({total:0,learnedPercent:0,studiedPercent:0});
  expect(knowledgeSummary([card('x')],new Map([['x',progress('x')]]),now)).toMatchObject({counts:{learned:1},due:1});
 });
 it('Counts a bubble answer table as a single card',()=>{expect(knowledgeSummary([{...card('bubble','hitboxes'),answer:'ID: 2\nDamage: 13\nAngle: 45\nKBG: 99\nBKB: 20\nWDSK: 0\nRadius: 7.5'}],new Map(),now).total).toBe(1);});
 it('Builds local-day activity and streaks, with overdue reviews today and suspended cards out of forecasts',()=>{
  const p=new Map([progress('a'),progress('b',State.Learning,{card:{...progress('b').card,due:at(1,0)}}),progress('c',State.Review,{suspended:true})].map(p=>[p.id,p]));
  const logs=[review('a',0),review('a',-1),review('a',-2),review('a',-5),review('removed',-3),review('a',1)];
  const history=knowledgeHistory(['a','b','c'].map(id=>card(id)),p,logs,now);
  expect(history.today).toBe(1);expect(history.currentStreak).toBe(3);expect(history.bestStreak).toBe(3);expect(history.days).toHaveLength(90);expect(history.forecast.map(d=>d.count)).toEqual([1,1,0,0,0,0,0]);
  expect(knowledgeHistory([card('a')],p,logs,at(1)).currentStreak).toBe(4);
 });
 it('Requires three current-answer reviews for difficult cards and ignores removed or outdated answers',()=>{
  const logs=[review('a',-1,Rating.Again),review('a',-2,Rating.Good),review('a',-3,Rating.Again),review('b',-1,Rating.Again),review('b',-2,Rating.Again),review('b',-3,Rating.Again,'old'),review('removed',-1,Rating.Again)];
  const h=knowledgeHistory([card('a'),card('b')],new Map(),logs,now);expect(h.difficult).toHaveLength(1);expect(h.difficult[0].card.id).toBe('a');expect(h.difficult[0].rate).toBeCloseTo(2/3);
 });
 it('Chooses the earliest due card then unseen character stats before hitbubbles, skipping suspended cards',()=>{
  const cards=[card('bubble','hitboxes'),card('attribute'),card('paused')],p=new Map([['paused',progress('paused',State.Review,{suspended:true})]]);expect(continueCard(cards,p,now)?.id).toBe('attribute');
  p.set('bubble',progress('bubble'));expect(continueCard(cards,p,now)?.id).toBe('bubble');
 });
 it('Round-trips encoded Study links with due-only and move filters',()=>{const filters={deck:'hitboxes' as const,subject:'marth',card:'id:Frame 6 / ID 2',topic:'Specials',mode:'library' as const,due:true,move:'AttackS4-123',category:'hitboxes' as const};expect(parseRoute(studyHref(filters)).study).toEqual(filters);expect(parseRoute('#/study?deck=invalid&mode=invalid&category=invalid').study).toEqual({});});
});
