import {State,Rating} from 'ts-fsrs';
import {studyDay,type Progress,type StoredReview} from './study-progress';
import type {StudyCard} from './study-types';

export type KnowledgeCard=Pick<StudyCard,'id'|'deck'|'subjectId'|'subject'|'topic'|'field'|'question'|'answer'|'href'|'move'>;
export type KnowledgeSubject={id:string;name:string;kind:'fighter'|'stage';bonus?:boolean};
export type CompendiumCatalog={schemaVersion:1;sourceFingerprint:string|null;selectionFingerprint:string;complete:boolean;generatedAt:string;subjects:KnowledgeSubject[];cards:KnowledgeCard[]};
export type KnowledgeStatus='unseen'|'learning'|'learned'|'relearning'|'refresh';
export const statusLabels:Record<KnowledgeStatus,string>={unseen:'Unseen',learning:'Learning',learned:'Learned',relearning:'Relearning',refresh:'Needs refresh'};
export function cardStatus(card:Pick<KnowledgeCard,'answer'>,p?:Progress):KnowledgeStatus {
  if(!p?.card.reps)return 'unseen';
  if(p.answer!==card.answer)return 'refresh';
  if(p.card.state===State.Review)return 'learned';
  return p.card.state===State.Relearning?'relearning':'learning';
}
export function cardIsDue(card:Pick<KnowledgeCard,'answer'>,p:Progress|undefined,now:Date){return !!p&&!p.suspended&&p.card.reps>0&&(p.answer!==card.answer||p.card.due.getTime()<=now.getTime());}
export function uniqueCards<T extends {id:string}>(cards:T[]):T[]{return [...new Map(cards.map(c=>[c.id,c])).values()];}
export function knowledgeSummary(cards:KnowledgeCard[],progress:Map<string,Progress>,now=new Date()){
  const counts:Record<KnowledgeStatus,number>={unseen:0,learning:0,learned:0,relearning:0,refresh:0};
  let due=0,suspended=0,lastStudied:number|null=null;
  const selected=uniqueCards(cards);
  for(const card of selected){const p=progress.get(card.id);counts[cardStatus(card,p)]++;if(cardIsDue(card,p,now))due++;if(p?.suspended)suspended++;if(p?.card.last_review)lastStudied=Math.max(lastStudied??0,p.card.last_review.getTime());}
  const total=selected.length,studied=counts.learning+counts.learned+counts.relearning;
  return {total,counts,studied,due,suspended,lastStudied,remaining:total-counts.learned,studiedPercent:total?studied/total*100:0,learnedPercent:total?counts.learned/total*100:0};
}
export function categoryKey(card:KnowledgeCard){return card.deck==='stages'?'stages':card.deck==='hitboxes'?'hitboxes':card.topic.startsWith('Move stats ·')?'moves':'attributes';}
export const categoryLabels={attributes:'Character attributes',moves:'Move stats',hitboxes:'Hitbubbles',stages:'Stage stats'};
function localDate(date:Date,offset:number){const result=new Date(date);result.setHours(0,0,0,0);result.setDate(result.getDate()+offset);return result;}
export function knowledgeHistory(cards:KnowledgeCard[],progress:Map<string,Progress>,reviews:StoredReview[],now=new Date()){
  const selected=uniqueCards(cards),byId=new Map(selected.map(c=>[c.id,c])),activity=new Map<string,number>();
  const ratings=new Map<string,{reviews:number;again:number}>();
  for(const review of reviews){const c=byId.get(review.cardId),at=new Date(review.log.review);if(!c||!Number.isFinite(at.getTime())||at>now)continue;const day=studyDay(at);activity.set(day,(activity.get(day)??0)+1);if(c.answer===review.answer){const r=ratings.get(c.id)??{reviews:0,again:0};r.reviews++;if(review.log.rating===Rating.Again)r.again++;ratings.set(c.id,r);}}
  const days=Array.from({length:90},(_,i)=>{const date=localDate(now,i-89),day=studyDay(date);return {day,count:activity.get(day)??0};});
  const activeDays=[...activity.keys()].sort();let bestStreak=0,run=0,previous='';
  for(const day of activeDays){const date=new Date(`${day}T12:00:00`);run=previous===studyDay(localDate(date,-1))?run+1:1;bestStreak=Math.max(bestStreak,run);previous=day;}
  let currentStreak=0,offset=activity.has(studyDay(now))?0:-1;while(activity.has(studyDay(localDate(now,offset)))){currentStreak++;offset--;}
  const forecast=Array.from({length:7},(_,i)=>({day:studyDay(localDate(now,i)),count:0}));
  for(const c of selected){const p=progress.get(c.id);if(!p?.card.reps||p.suspended)continue;const day=cardIsDue(c,p,now)?forecast[0].day:studyDay(p.card.due);const slot=forecast.find(d=>d.day===day);if(slot)slot.count++;}
  const difficult=selected.flatMap(card=>{const r=ratings.get(card.id);return r&&r.reviews>=3&&r.again>0?[{card,...r,rate:r.again/r.reviews,lapses:progress.get(card.id)?.card.lapses??0}]:[];}).sort((a,b)=>b.rate-a.rate||b.lapses-a.lapses||a.card.question.localeCompare(b.card.question)).slice(0,5);
  const groups=new Map<string,{card:KnowledgeCard;reviews:number;again:number}>();
  for(const c of selected){const r=ratings.get(c.id);if(!r)continue;const key=JSON.stringify([c.subjectId,c.deck,c.topic]),group=groups.get(key)??{card:c,reviews:0,again:0};group.reviews+=r.reviews;group.again+=r.again;groups.set(key,group);}
  const weakTopics=[...groups.values()].filter(g=>g.reviews>=3&&g.again>0).map(g=>({...g,rate:g.again/g.reviews})).sort((a,b)=>b.rate-a.rate||b.again-a.again).slice(0,5);
  return {days,forecast,currentStreak,bestStreak,today:activity.get(studyDay(now))??0,difficult,weakTopics};
}
export function continueCard(cards:KnowledgeCard[],progress:Map<string,Progress>,now=new Date()){
  const due=cards.filter(c=>cardIsDue(c,progress.get(c.id),now)).sort((a,b)=>progress.get(a.id)!.card.due.getTime()-progress.get(b.id)!.card.due.getTime());
  if(due.length)return due[0];
  return [...cards].sort((a,b)=>Number(a.deck==='hitboxes')-Number(b.deck==='hitboxes')).find(c=>cardStatus(c,progress.get(c.id))==='unseen'&&!progress.get(c.id)?.suspended)??cards.find(c=>!progress.get(c.id)?.suspended);
}
