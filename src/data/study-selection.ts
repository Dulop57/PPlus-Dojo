import configuration from './study-selection.json';
import type {StudyCard} from './study-types';
export function selectionTopic(card:Pick<StudyCard,'deck'|'topic'>){
  return card.deck==='hitboxes'?'Hitbubble, grab and throw parameters':card.topic.startsWith('Move stats ·')?'Move stats (all attack groups)':card.topic;
}
const key=(card:Pick<StudyCard,'deck'|'topic'|'field'>)=>JSON.stringify([card.deck,selectionTopic(card),card.field]);
const allowed=new Set(configuration.entries.map(e=>JSON.stringify([e.deck,e.topic,e.field])));
const isMainSheetCard=(card:StudyCard)=>card.deck==='attributes'&&card.id.startsWith(`workbook:attribute:${card.subjectId}:Main:`);
export function selectedStudyCards(cards:StudyCard[]):StudyCard[]{
  const metricName=(card:StudyCard)=>card.field.endsWith(' rank')?card.field.slice(0,-5):card.field.split(' · ')[0];
  const selected=cards.filter(c=>allowed.has(key(c))||(isMainSheetCard(c)&&allowed.has(key({...c,field:metricName(c)}))));
  const groups=new Map<string,StudyCard[]>();
  for(const card of selected){
    if(!isMainSheetCard(card))continue;
    const metric=metricName(card);
    const groupKey=JSON.stringify([card.subjectId,metric]);
    if(!groups.has(groupKey))groups.set(groupKey,[]);groups.get(groupKey)!.push(card);
  }
  const merged=new Map<string,StudyCard>(),consumed=new Set<string>();
  for(const group of groups.values()){
    const rank=group.find(c=>c.field.endsWith(' rank')),values=group.filter(c=>!c.field.endsWith(' rank'));
    if(!rank||!values.length)continue;
    const metric=rank.field.slice(0,-5),base=values[0];
    const answers=values.map(c=>({label:c.field.slice(metric.length+3),value:c.answer}));
    const answer=answers.length===1?`${answers[0].value}\nRank: #${rank.answer}`:[...answers.map(a=>`${a.label}: ${a.value}`),`Rank: #${rank.answer}`].join('\n');
    merged.set(base.id,{...base,field:metric,question:`${base.subject}: what is ${metric}?`,answer,exact:undefined});
    group.forEach(c=>consumed.add(c.id));
  }
  return selected.flatMap(c=>merged.has(c.id)?[merged.get(c.id)!]:consumed.has(c.id)?[]:[c]);
}
export function deckHasSelectedStats(deck:StudyCard['deck']){return configuration.entries.some(e=>e.deck===deck);}
