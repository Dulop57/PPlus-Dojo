import {lazy,Suspense,useEffect,useMemo,useState} from 'react';
import {Activity,ArrowDown,ArrowLeft,ArrowUp,Box,Footprints,Gauge,MoveVertical,Scale,Timer,Wind} from 'lucide-react';
import source from '../data/reference/attributes.json';
import {columnLetter,displayCell,rankings,type ReferenceBook,type ReferenceSheet} from '../data/reference';
import {parseRoute,type Route} from '../router';
import AttributeSections from './AttributeSections';
import MiscReference from './MiscReference';
import DodgeReference from './DodgeReference';
import FighterName from './FighterName';
import {rankingChart} from '../data/attribute-charts';
import {hasScatterGraph} from '../data/attribute-scatter';
import {AttributeChartProvider,AttributeChartControls,AttributeChartView,useAttributeControls} from './AttributeCharts';
const AttributeScatterGraph=lazy(()=>import('./AttributeScatterGraph'));
const book=source as ReferenceBook;
const main=book.sheets.find(s=>s.name==='Main')!;
const metrics=rankings(main);
const worksheetTabs=[main,...book.sheets.filter(s=>s!==main&&s.name!=='About'&&s.name!=='Other Resources'&&s.name!=='Raw Data'&&s.name!=='Calculations')];
function routeSheet(route:Route){return worksheetTabs.find(sheet=>sheet.name===route.fighterId)??main;}
function metricPresentation(name:string){
  if(/weight/i.test(name))return {Icon:Scale,family:'weight'};
  if(/gravity|fall|drift/i.test(name))return {Icon:Wind,family:'air'};
  if(/jump|hop|height/i.test(name))return {Icon:MoveVertical,family:'jump'};
  if(/frame|time|lag/i.test(name))return {Icon:Timer,family:'timing'};
  if(/dash|speed|velocity|accel|distance|wavedash|boost|friction|grab/i.test(name))return {Icon:Footprints,family:'movement'};
  return {Icon:Gauge,family:'other'};
}
export default function AttributeReference({route}:{route:Route}){
  const activeSheet=routeSheet(route);
  const [sheetRoutes,setSheetRoutes]=useState<Record<string,string>>(()=>({[activeSheet.name]:location.hash||`#/attributes/${encodeURIComponent(activeSheet.name)}`}));
  const [visitedSheets,setVisitedSheets]=useState(()=>new Set([activeSheet.name]));
  useEffect(()=>{
    if(route.page!=='attributes')return;
    const hash=location.hash||`#/attributes/${encodeURIComponent(activeSheet.name)}`;
    setSheetRoutes(current=>current[activeSheet.name]===hash?current:{...current,[activeSheet.name]:hash});
    setVisitedSheets(current=>current.has(activeSheet.name)?current:new Set(current).add(activeSheet.name));
  },[route.page,route.fighterId,route.metric,route.graph,activeSheet.name]);
  const hrefFor=(sheetName:string)=>sheetRoutes[sheetName]??`#/attributes/${encodeURIComponent(sheetName)}`;
  return <>{worksheetTabs.filter(sheet=>visitedSheets.has(sheet.name)||activeSheet===sheet).map(sheet=>{
      const selected=activeSheet===sheet,tabRoute=selected?route:parseRoute(hrefFor(sheet.name));
      return <div key={sheet.name} className="attribute-sheet-panel" hidden={!selected}><AttributeChartProvider><AttributeContent route={tabRoute} sheet={sheet} sheetRoutes={sheetRoutes}/></AttributeChartProvider></div>;
    })}</>;
}
function AttributeContent({route,sheet,sheetRoutes}:{route:Route;sheet:ReferenceSheet;sheetRoutes:Record<string,string>}){
  const metric=metrics.find(m=>m.name===route.metric)??metrics[0];
  const isRanking=sheet.name==='Main';
  const supports3D=isRanking&&hasScatterGraph(metric.name),is3D=supports3D&&route.graph==='3d';
  const chartHref=`#/attributes/Main?metric=${encodeURIComponent(metric.name)}`;
  const {query,setQuery,view,setView}=useAttributeControls();
  useEffect(()=>setQuery(''),[sheet.name,metric.name,setQuery]);
  const [sort,setSort]=useState<{column:number;ascending:boolean}|null>(null);
  const rows=useMemo(()=>{
    const filtered=metric.rows.filter(row=>row.some(c=>String(c.v??'').toLowerCase().includes(query.toLowerCase())));
    if(!sort)return filtered;
    return [...filtered].sort((a,b)=>{const x=a[sort.column]?.v,y=b[sort.column]?.v;if(x===null)return 1;if(y===null)return -1;return (typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),undefined,{numeric:true}))*(sort.ascending?1:-1);});
  },[metric,query,sort]);
  function selectMetric(name:string){setQuery('');setSort(null);location.hash=`#/attributes/Main?metric=${encodeURIComponent(name)}`;}
  const numeric=metric.rows.flatMap(row=>typeof row[2]?.v==='number'?[row[2].v]:[]);
  const stat=(v:number)=>displayCell({v,format:metric.rows[0]?.[2]?.format});
  return <div className="reference-page attribute-reference-page" data-view={is3D?'chart':view} data-ranking={isRanking}>
    <nav className="reference-tabs" aria-label="Attribute worksheets">{worksheetTabs.map(tab=><a key={tab.name} href={sheetRoutes[tab.name]??`#/attributes/${encodeURIComponent(tab.name)}`} aria-current={sheet===tab?'page':undefined}>{tab.name}</a>)}</nav>
    <div className={isRanking?'attribute-workspace':'attribute-category-workspace'}>
    {sheet.name==='Main'&&<aside className="reference-toolbar attribute-metric-sidebar"><div className="metric-picker"><span className="metric-picker-label">ATTRIBUTE</span><label className="narrow-metric-picker"><span className="sr-only">Attribute</span><select aria-label="Attribute" value={metric.name} onChange={event=>selectMetric(event.currentTarget.value)}>{metrics.map(m=><option key={m.name} value={m.name}>{m.name}</option>)}</select></label><div className="metric-options" role="group" aria-label="Attribute">{metrics.map(m=>{const {Icon,family}=metricPresentation(m.name);return <button key={m.name} title={m.name} type="button" className="metric-option" data-family={family} aria-pressed={m===metric} onClick={()=>selectMetric(m.name)}><Icon size={15} aria-hidden="true"/><span>{m.name}</span></button>;})}</div></div></aside>}
    <div className="attribute-primary">
    {!['Other Resources','Misc','Dodges'].includes(sheet.name)&&<AttributeChartControls ranking={isRanking} viewSwitch={is3D?<a className="attribute-graph-link" href={chartHref}><ArrowLeft size={16}/>Back to chart</a>:undefined} action={supports3D&&!is3D?<a className="attribute-graph-link" href={`${chartHref}&graph=3d`} onClick={()=>setView('chart')}><Box size={16}/>3D Graph</a>:undefined}/>}
    {is3D?<Suspense fallback={<p role="status">Loading 3D graph…</p>}><AttributeScatterGraph metrics={metrics}/></Suspense>:isRanking?<>
      {view==='table'&&<div className="reference-stat-strip"><div><span>ATTRIBUTE</span><strong>{metric.name}</strong></div><div><span>ENTRIES</span><strong>{metric.rows.length}</strong></div><div><span>HIGHEST VALUE</span><strong>{numeric.length?stat(Math.max(...numeric)):'—'}</strong></div><div><span>LOWEST VALUE</span><strong>{numeric.length?stat(Math.min(...numeric)):'—'}</strong></div></div>}
      <AttributeChartView model={rankingChart(metric)} table={<section className="ranking-card"><div className="ranking-header"><div><h2>{metric.name}</h2><p>{metric.description??'Original workbook ranking. Select a column to sort.'}</p></div></div>
      <div className="reference-table-scroll"><table className="ranking-table"><caption className="sr-only">{metric.name} rankings</caption><thead><tr>{metric.columns.map((c,i)=>String(c.v)==='F/B'?null:<th key={c.c} aria-sort={sort?.column===i?(sort.ascending?'ascending':'descending'):'none'}><button onClick={()=>setSort({column:i,ascending:sort?.column===i?!sort.ascending:true})}>{String(c.v)}{sort?.column===i?(sort.ascending?<ArrowUp size={13}/>:<ArrowDown size={13}/>):null}</button></th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={`${row[0].r}-${index}`}>{row.map((c,i)=>String(metric.columns[i]?.v)==='F/B'?null:<td key={c.c} className={i===1?'ranking-fighter':typeof c.v==='number'?'numeric':''} title={`${main.name}!${columnLetter(c.c)}${c.r}${c.note?`\n${c.note}`:''}\nExact value: ${c.v??'Unavailable'}`}>{i===0?<span className="rank-number">{displayCell(c)}</span>:i===1?<FighterName name={displayCell(c)}/>:displayCell(c)}</td>)}</tr>)}</tbody></table></div>{!rows.length&&<p className="reference-empty" role="status">No entries match “{query}”.</p>}</section>}/>
    </>:sheet.name==='Misc'?<MiscReference/>:sheet.name==='Dodges'?<DodgeReference sheet={sheet}/>:<AttributeSections key={sheet.name} sheet={sheet}/>}
    </div></div>
  </div>;
}
