import {catalog} from './catalog';
import {referenceFighters, type referenceRoster} from './reference-fighters';
import {columnLetter,displayCell,type ReferenceCell,type Ranking} from './reference';
import type {AttributeSection} from './attribute-sections';

export type ChartKind='bars'|'grouped'|'timeline'|'heatmap'|'groups'|'matrix'|'cards'|'text';
export type ChartFighter=(typeof referenceRoster)[number];
export type ChartSeries={label:string;unit:string;column:number};
export type ChartCell=ReferenceCell&{original?:ReferenceCell};
export type ChartRow={id:string;label:string;description?:string;fighters:ChartFighter[];cells:ChartCell[];group?:boolean};
export type ChartWindow={label:string;from:number;through:number};
export type AttributeChart={kind:ChartKind;title:string;description?:string;sheet:string;axisMinimum?:number;columns?:string[];groupMetric?:'members'|'value';series:ChartSeries[];rows:ChartRow[];windows:{label:string;from:number;through:number}[]};
const numeric=(cell?:ReferenceCell)=>typeof cell?.v==='number'&&Number.isFinite(cell.v);
export function chartNumber(cell?:ReferenceCell):number|null{return numeric(cell)?cell!.v as number:null;}
export function cellSource(sheet:string,cell:ReferenceCell){return `${sheet}!${columnLetter(cell.c)}${cell.r}`;}
function chartFighters(name:string){
  const fighters=referenceFighters(name);
  return fighters.length?fighters:referenceFighters(name.replace(/\s+(?:\d+|RHUS)$/i,''));
}
function unit(sheet:string,title:string,column:string,cell?:ReferenceCell){
  if(cell?.format?.includes('%'))return '%';
  if(/z-score/i.test(column))return 'Z-score';
  if(['Dodges','Grab Timings','Aerial Landing Lags','Ledge stuff','SH Times','Item Throws'].includes(sheet))return 'frames';
  if(sheet==='Main'&&/frames?|time/i.test(title))return 'frames';
  if(sheet==='Raw Data'&&/frames?|lag|squat/i.test(title))return 'frames';
  if(sheet==='Shine'&&/hitstun|frame advantage/i.test(column))return 'frames';
  // Calculation headings such as “Frame 1” identify the sampling frame, not
  // the units of the stored velocity or distance. Leave unspecified units blank.
  return '';
}
export function rankingChart(metric:Ranking):AttributeChart{
  const axisMinimum:Record<string,number>={
    'Weight':50,
    'Max Fall Speed':1,
    'Fast Fall Speed':1,
    'SH FF Time':10,
    'Full Jump Height':20,
    'Short Hop Height':5,
    'Walljump Height':10,
    'Wavedash':10,
    'Dash Dance Length':5,
    'Dash Dance Avg. Velocity':1,
    'Extended Dash Dance (20 Frames)':10,
    'Initial Dash Speed':1,
    'Max Dash/Run Speed':1,
    'Walk Speed':0.5,
    'Max Horizontal Air Speed':0.5,
    'Boost Grab':5,
  };
  return {kind:'bars',title:metric.name,description:metric.description,sheet:'Main',axisMinimum:axisMinimum[metric.name],columns:metric.columns.map(c=>String(c.v)),series:metric.columns.flatMap((c,i)=>i>=2&&String(c.v)!=='F/B'?[{label:String(c.v),column:i,unit:unit('Main',metric.name,String(c.v),metric.rows[0]?.[i])}]:[]),rows:metric.rows.map(row=>({id:`Main:${row[0].r}:${row[0].c}`,label:String(row[1].v),fighters:chartFighters(String(row[1].v)),cells:row})),windows:[]};
}
export function sectionChart(sheet:string,section:AttributeSection,sections:AttributeSection[]=[]):AttributeChart{
  const base={title:section.title,description:section.description,sheet,columns:section.columns,windows:[] as AttributeChart['windows']};
  if(section.kind==='groups'){
    const numbered=section.rows.every(row=>numeric(row[0]));
    const explicitIds=new Set(section.rows.flatMap(row=>row.slice(1).flatMap(cell=>referenceFighters(String(cell.v)).map(f=>f.id))));
    const groupRows=section.rows.map(row=>{
      const members=row.slice(1).flatMap<ChartCell>(cell=>/^everyone else$/i.test(String(cell.v))?catalog.filter(f=>!explicitIds.has(f.id)).map(f=>({...cell,v:f.name,original:cell})):[cell]);
      return {id:`${sheet}:${row[0].r}:${row[0].c}`,label:`${displayCell(row[0])}${/lag|squat|length/i.test(section.title)?' frames':''}`,fighters:members.flatMap(c=>referenceFighters(String(c.v))),cells:[row[0],...members],group:true};
    });
    if(numbered)return {...base,kind:'groups',groupMetric:section.title==='Empty landing lag'?'value':'members',series:[section.title==='Empty landing lag'?{label:'Landing lag',unit:'frames',column:0}:{label:'Fighters',unit:'fighters',column:0}],rows:groupRows};
    const fighters=[...new Map(groupRows.flatMap(row=>row.fighters).map(f=>[f.id,f])).values()];
    return {...base,kind:'matrix',series:groupRows.map((row,i)=>({label:row.label,column:i,unit:''})),rows:fighters.map(f=>({id:f.id,label:f.name,fighters:[f],cells:groupRows.map(row=>{
      const includes=(c:ReferenceCell)=>referenceFighters(String(c.v)).some(member=>member.id===f.id);
      const dependency=section.title==='Crawl options'&&row.label==='Crawl'?'Crawl-Attack':section.title==='Wall movement'&&row.label==='Can Wall-Jump'?'Can Wall-Cling':undefined;
      const match=row.cells.slice(1).find(includes)??groupRows.find(group=>group.label===dependency)?.cells.slice(1).find(includes);
      return match?{...match,v:true,original:match}:{r:0,c:0,v:false};
    })}))};
  }
  const identity=Math.max(0,section.columns.findIndex(c=>/^fighter|^name$/i.test(c)));
  let rows:ChartRow[]=section.rows.map(row=>{
    const label=String(row[identity]?.v??'');
    let fighters=referenceFighters(label);
    if(/^everyone else$/i.test(label))fighters=catalog.filter(f=>!section.rows.some(r=>!String(r[identity]?.v).includes('Forward only')&&referenceFighters(String(r[identity]?.v)).some(member=>member.id===f.id)));
    if(section.title==='Techs')fighters=catalog;
    if(sheet==='Dodges'&&section.title==='Spotdodges')fighters=sections.find(s=>s.title==='Spotdodge groups')?.rows.filter(r=>String(r[0].v)===label).flatMap(r=>r.slice(1).flatMap(c=>referenceFighters(String(c.v))))??[];
    return {id:`${sheet}:${row[0].r}:${row[0].c}`,label,fighters,cells:row,group:!referenceFighters(label).length&&fighters.length>1};
  });
  if(section.title==='True spikes'){
    const cards=new Map<string,ChartRow>();
    for(const row of rows)for(const fighter of row.fighters.length?row.fighters:[{id:row.label,name:row.label}]){
      const card=cards.get(fighter.id)??{id:fighter.id,label:fighter.name,fighters:[fighter],cells:[row.cells[0]]};
      card.cells.push(row.cells[1]);cards.set(fighter.id,card);
    }
    return {...base,kind:'cards',rows:[...cards.values()],series:[]};
  }
  const columns=section.columns.flatMap((label,column)=>column!==identity&&section.rows.some(row=>numeric(row[column]))?[{label,column,unit:unit(sheet,section.title,label,section.rows.find(row=>numeric(row[column]))?.[column])}]:[]);
  if(!columns.length)return {...base,kind:'text',rows,series:[]};
  if(section.title==='Notable outliers'){
    rows=rows.map(row=>({...row,description:displayCell(row.cells[2])}));
    return {...base,kind:'bars',rows,series:columns.filter(c=>c.label==='Z-score')};
  }
  if(sheet==='Aerial Landing Lags')return {...base,kind:'heatmap',rows,series:columns.filter(c=>c.label!=='Total')};
  if(['Dodges','Grab Timings','Ledge stuff','Item Throws'].includes(sheet)&&section.title!=='Totals'){
    const windows:AttributeChart['windows']=[];
    const pair=(from:string,through:string,label:string)=>{
      const a=section.columns.indexOf(from),b=section.columns.indexOf(through);
      if(a>=0&&b>=0)windows.push({from:a,through:b,label});
    };
    pair('Intangible from','Intangible through','Intangible');pair('First active frame','Last active frame','Grab active');pair('Hit from','Hit through','Attack active');
    return {...base,kind:'timeline',rows,series:columns,windows};
  }
  const grouped=section.title==='Grab reach'||sheet==='SH Times';
  return {...base,kind:grouped?'grouped':'bars',rows,series:columns};
}
export function barDomain(values:(number|null)[],minimum=0):[number,number]{
  const valid=values.filter((v):v is number=>v!==null&&Number.isFinite(v));
  const min=Math.min(minimum,...valid),max=Math.max(minimum,...valid);
  return min===max?[min,min+1]:[min,max];
}
