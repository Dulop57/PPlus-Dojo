import {referenceFighters} from './reference-fighters';
import type {Ranking} from './reference';

export const scatterAxes=[
  {key:'weight',label:'Weight',metric:'Weight',color:'#50eadb',step:10,minimum:50},
  {key:'gravity',label:'Gravity',metric:'Gravity (Falling Acceleration)',color:'#95b8ff',step:.05},
  {key:'fallSpeed',label:'Max Fall Speed',metric:'Max Fall Speed',color:'#ffc477',step:.5,minimum:1},
] as const;
export type ScatterKey=typeof scatterAxes[number]['key'];
export type ScatterFighter={id:string;name:string;values:Record<ScatterKey,number>};
export type ScatterView='3d'|'weight-gravity'|'weight-fall'|'gravity-fall';
export const scatterViews:{id:ScatterView;label:string;axes:ScatterKey[]}[]=[
  {id:'3d',label:'3D',axes:['weight','gravity','fallSpeed']},
  {id:'weight-gravity',label:'Weight × Gravity',axes:['weight','gravity']},
  {id:'weight-fall',label:'Weight × Max Fall Speed',axes:['weight','fallSpeed']},
  {id:'gravity-fall',label:'Gravity × Max Fall Speed',axes:['gravity','fallSpeed']},
];
export const hasScatterGraph=(metric:string)=>scatterAxes.some(axis=>axis.metric===metric);
// Ranking rows use different orders. Join by fighter identity, never by row/rank.
export function scatterFighters(metrics:Ranking[]):ScatterFighter[]{
  const fighters=new Map<string,{id:string;name:string;values:Partial<Record<ScatterKey,number>>}>();
  for(const axis of scatterAxes)for(const row of metrics.find(metric=>metric.name===axis.metric)?.rows??[]){
    const value=row[2]?.v;if(typeof value!=='number'||!Number.isFinite(value))continue;
    for(const fighter of referenceFighters(String(row[1]?.v??''))){
      const entry=fighters.get(fighter.id)??{...fighter,values:{}};
      entry.values[axis.key]=value;fighters.set(fighter.id,entry);
    }
  }
  return [...fighters.values()].filter((fighter):fighter is ScatterFighter=>scatterAxes.every(axis=>typeof fighter.values[axis.key]==='number')).sort((a,b)=>a.name.localeCompare(b.name));
}
export function scatterDomains(fighters:ScatterFighter[]){
  return Object.fromEntries(scatterAxes.map(axis=>{
    const values=fighters.map(fighter=>fighter.values[axis.key]);
    const lowest=values.length?Math.min(...values):0,highest=values.length?Math.max(...values):axis.step;
    const minimum='minimum'in axis?Math.min(axis.minimum,lowest):Math.floor(lowest/axis.step)*axis.step;
    const maximum=Math.max(minimum+axis.step,Math.ceil(highest/axis.step)*axis.step);
    const ticks=Array.from({length:Math.round((maximum-minimum)/axis.step)+1},(_,i)=>Number((minimum+i*axis.step).toFixed(6)));
    return [axis.key,{minimum,maximum,ticks}];
  })) as Record<ScatterKey,{minimum:number;maximum:number;ticks:number[]}>;
}
