import source from './reference/attributes.json' with {type:'json'};
import {catalog} from './catalog';
import {displayCell,rankings,type ReferenceBook} from './reference';
import {referenceFighters} from './reference-fighters';

export const diamondRows=[
  ['mario','luigi','peach','wario','yoshi','bowser','donkey-kong','diddy-kong','captain-falcon'],
  ['fox','falco','wolf','link','toon-link','zelda','sheik','ganondorf'],
  ['pikachu','jigglypuff','mewtwo','squirtle','ivysaur','charizard','lucario','samus','zero-suit-samus'],
  ['ness','lucas','kirby','meta-knight','king-dedede','marth','roy','ike'],
  ['game-watch','rob','ice-climbers','pit','random','olimar','snake','sonic','knuckles'],
] as const;
export const rosterMetricNames=[
  'Weight','Gravity (Falling Acceleration)','Max Fall Speed','Fast Fall Speed',
  'Full Jump Height','Short Hop Height','Double Jump Height','Walljump Height',
  'Wavedash','Dash Dance Length','Dash Dance Avg. Velocity','Max Dash/Run Speed',
  'Ground Friction','Max Horizontal Air Speed','Horizontal Air Accel.','Jumpsquat speed',
] as const;
export type RosterStat={name:string;label:string;value:number|null;display:string;z:number|null;fill:number|null};
export function zScoreFill(z:number|null,min:number,max:number){
  if(z===null||!Number.isFinite(z)||!Number.isFinite(min)||!Number.isFinite(max))return null;
  return max===min?52.5:Math.max(5,Math.min(100,5+95*(z-min)/(max-min)));
}
export const jumpsquatFill=(frames:number|null)=>frames===5?33:frames===4?66:frames===3?100:null;
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const book=source as ReferenceBook;
const metrics=rankings(book.sheets.find(sheet=>sheet.name==='Main')!);
const standardIds=new Set(catalog.map(fighter=>fighter.id));
const statMaps=rosterMetricNames.slice(0,-1).map(name=>{
  const metric=metrics.find(metric=>metric.name===name)!;
  const zIndex=metric.columns.findIndex(column=>String(column.v)==='Z-score');
  const valueIndex=name==='Horizontal Air Accel.'?metric.columns.findIndex(column=>column.v==='Sum'):metric.columns.findIndex(column=>!['#','Name','Z-score','F/B'].includes(String(column.v)));
  const rows=metric.rows.flatMap(row=>referenceFighters(String(row[1]?.v??'').replace(/\*+$/,'')).filter(fighter=>standardIds.has(fighter.id)).map(fighter=>({id:fighter.id,cell:row[valueIndex],z:name==='Max Dash/Run Speed'&&fighter.id==='sonic'?1.5:finite(row[zIndex]?.v)?row[zIndex].v as number:null})));
  const zs=rows.flatMap(row=>row.z===null?[]:[row.z]);
  const minimum=Math.min(...zs),maximum=Math.max(...zs);
  return new Map(rows.map(row=>[row.id,{name,label:name==='Max Dash/Run Speed'?'Dash/Run Speed':name==='Horizontal Air Accel.'?'Horizontal Air Accel':name,value:finite(row.cell?.v)?row.cell.v:null,display:row.cell?displayCell(row.cell):'—',z:row.z,fill:finite(row.cell?.v)?zScoreFill(row.z,minimum,maximum):null} satisfies RosterStat]));
});
const misc=book.sheets.find(sheet=>sheet.name==='Misc')!;
const jumpsquats=new Map<string,number>();
for(const column of [1,2,3]){
  const frames=misc.cells.find(cell=>cell.r===2&&cell.c===column)?.v;
  if(!finite(frames))continue;
  for(const cell of misc.cells.filter(cell=>cell.c===column&&cell.r>=3&&cell.r<=19&&typeof cell.v==='string')){
    for(const fighter of referenceFighters(String(cell.v).replace(/\*+$/,'')))jumpsquats.set(fighter.id,frames);
  }
}
export function rosterStats(id:string):RosterStat[]{
  const stats=statMaps.map((map,index)=>map.get(id)??{name:rosterMetricNames[index],label:rosterMetricNames[index],value:null,display:'—',z:null,fill:null});
  const frames=jumpsquats.get(id)??null;
  return [...stats,{name:'Jumpsquat speed',label:'Jumpsquat speed',value:frames,display:frames===null?'—':`${frames}f`,z:null,fill:jumpsquatFill(frames)}];
}
