import {useEffect,useState} from 'react';
import {TriangleAlert} from 'lucide-react';
import source from '../data/reference/stages.json';
import {displayCell,type Stage,type StageBook} from '../data/reference';
import type {Route} from '../router';
import SheetGrid from './SheetGrid';
import StageHeader from './StageHeader';
const book=source as StageBook;
const viewSheets=book.sheets.filter(s=>s.name!=='2025 list');
const number=(v:number|null)=>displayCell({v,format:'0.##'});
const roomyChartQuery='(min-width: 601px) and (min-height: 540px), (max-width: 600px) and (min-height: 740px)';
export function StageDiagram({stage,roomy}:{stage:Stage;roomy:boolean}){
  const g=stage.geometry,w=960,h=roomy?740:600,pad=58;
  const span={left:Math.min(...book.stages.map(s=>s.geometry.blastLeft)),right:Math.max(...book.stages.map(s=>s.geometry.blastRight)),top:Math.max(...book.stages.map(s=>s.geometry.blastTop-s.geometry.ledgeY)),bottom:Math.min(...book.stages.map(s=>s.geometry.blastBottom-s.geometry.ledgeY))};
  const scale=Math.min((w-pad*2)/(span.right-span.left),(h-pad*2)/(span.top-span.bottom));
  const x=(v:number)=>w/2+(v-(span.left+span.right)/2)*scale;
  const y=(v:number)=>h/2-(v-(span.top+span.bottom)/2)*scale;
  const xTicks=Array.from({length:Math.floor(span.right/50)-Math.ceil(span.left/50)+1},(_,i)=>(Math.ceil(span.left/50)+i)*50);
  const yTicks=Array.from({length:Math.floor(span.top/50)-Math.ceil(span.bottom/50)+1},(_,i)=>(Math.ceil(span.bottom/50)+i)*50);
  return <svg className="stage-diagram" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${stage.name} stage surface and blastzone diagram`}>
    <title>All stages: {stage.name} highlighted</title><desc>All 20 stages and their blastzones share an equal scale on both axes. The selected stage is highlighted above the other stages. Stage surfaces are continuous horizontal lines. Origin is at the source ledge height.</desc>
    <defs><clipPath id="stage-plot-clip"><rect x="35" y="20" width="890" height={h-50}/></clipPath></defs>
    <g clipPath="url(#stage-plot-clip)">
      <g className="stage-grid-lines">{xTicks.map(t=><line key={`x${t}`} x1={x(t)} x2={x(t)} y1={y(span.top)} y2={y(span.bottom)}/>)}{yTicks.map(t=><line key={`y${t}`} x1={x(span.left)} x2={x(span.right)} y1={y(t)} y2={y(t)}/>)}</g>
      <line className="stage-origin-axis" x1={x(0)} x2={x(0)} y1={y(span.top)} y2={y(span.bottom)}/><line className="stage-origin-axis" x1={x(span.left)} x2={x(span.right)} y1={y(0)} y2={y(0)}/>
      {[...book.stages.filter(s=>s.id!==stage.id),stage].map(s=>{const selected=s.id===stage.id,geo=s.geometry,hi=geo.blastTop-geo.ledgeY,lo=geo.blastBottom-geo.ledgeY;return <g key={s.id} className={`stage-layer ${selected?'is-selected':'is-background'}`} data-stage-id={s.id} aria-label={`${s.name}${selected?' highlighted':''}`}>
        <rect className="blastzone-box" data-left={geo.blastLeft} data-right={geo.blastRight} data-top={hi} data-bottom={lo} x={x(geo.blastLeft)} y={y(hi)} width={(geo.blastRight-geo.blastLeft)*scale} height={(hi-lo)*scale}><title>{s.name} blastzones</title></rect>
        <line className="stage-surface" data-left={geo.left} data-right={geo.right} x1={x(geo.left)} x2={x(geo.right)} y1={y(0)} y2={y(0)}><title>{s.name}: {number(geo.left)} to {number(geo.right)}, Y=0</title></line>
        {selected&&<><circle className="selected-ledge" cx={x(geo.left)} cy={y(0)} r="4"/><circle className="selected-ledge" cx={x(geo.right)} cy={y(0)} r="4"/></>}
      </g>;})}
      <text className="stage-width-label" x={(x(g.left)+x(g.right))/2} y={y(0)+30} textAnchor="middle">{number(stage.summary.width)} units</text>
    </g>
    <g className="stage-axis-labels">{xTicks.map(t=><text key={`x${t}`} x={x(t)} y={h-15} textAnchor="middle">{t}</text>)}{yTicks.map(t=><text key={`y${t}`} x="60" y={y(t)+4} textAnchor="end">{t}</text>)}</g>
    <text className="stage-plot-caption" x="58" y="30">ALL 20 STAGES / EQUAL AXIS SCALE</text>
  </svg>;
}
export default function StageReference({route}:{route:Route}){
  const [roomyChart,setRoomyChart]=useState(()=>window.matchMedia(roomyChartQuery).matches);
  useEffect(()=>{const media=window.matchMedia(roomyChartQuery),update=()=>setRoomyChart(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
  const stage=book.stages.find(s=>s.id===route.fighterId)??book.stages.find(s=>s.id==='battlefield')!;
  const worksheet=book.sheets.find(s=>s.name===route.moveId);
  const activeTab=worksheet?.name??'visualizer';
  const [visitedTabs,setVisitedTabs]=useState(()=>new Set([activeTab]));
  useEffect(()=>{setVisitedTabs(current=>current.has(activeTab)?current:new Set(current).add(activeTab));},[activeTab]);
  const variant=stage.variant?.trim()||'';
  const eyebrow=variant.toLowerCase()==='hazards on'?'Stage':variant==='Standard'?'P+ 3.2 STAGE':variant||'Stage';
  const selectStage=(id:string)=>{location.hash=`#/stages/${id}`;};
  return <div className="reference-page stage-reference-page">
    <nav className="reference-tabs" aria-label="Stage views"><a href={`#/stages/${stage.id}`} aria-current={!worksheet?'page':undefined}>Visualizer</a>{viewSheets.map(s=><a key={s.name} href={`#/stages/${stage.id}/${encodeURIComponent(s.name)}`} aria-current={worksheet===s?'page':undefined}>{s.name==='Page 1'?'Stage stats':s.name}</a>)}<p className="stage-platform-warning"><TriangleAlert size={15} aria-hidden="true"/>Platforms info coming soon</p></nav>
    <div hidden={activeTab!=='visualizer'} style={{display:activeTab==='visualizer'?'contents':'none'}}><div className="stage-layout"><aside className="stage-list" aria-label="Stage selection"><header className="stage-list-heading"><span className="stage-list-label">STAGE LIBRARY</span><span className="stage-list-count">{book.stages.length}</span></header><div>{book.stages.map(s=><button key={s.id} aria-current={s.id===stage.id?'true':undefined} onClick={()=>selectStage(s.id)}><span>{s.name}<small>{s.variant==='Standard'?`${number(s.summary.width)} units wide`:s.variant}</small></span><span className="stage-list-marker" aria-hidden="true">◇</span></button>)}</div></aside>
      <section className="stage-detail">
      <div className="stage-graph-card">
        <StageHeader key={stage.id} stage={stage} eyebrow={eyebrow}/>
        <div className="stage-graph-content">
          <div className="stage-graph-main"><StageDiagram stage={stage} roomy={roomyChart}/><div className="stage-stat-grid" role="group" aria-label="Stage measurements">{([['Top',stage.summary.top],['Side',stage.summary.side],['Bottom',-stage.summary.bottom],['Width',stage.summary.width]] as const).map(([label,value])=><div key={label}><span>{label}</span><strong>{number(value)}</strong></div>)}</div><div className="stage-legend"><span><i className="legend-surface"/>Stage surface</span><span><i className="legend-blast"/>Blastzones</span></div></div>
        </div>
      </div>
      </section></div></div>
    {viewSheets.filter(sheet=>visitedTabs.has(sheet.name)||activeTab===sheet.name).map(sheet=><div key={sheet.name} hidden={activeTab!==sheet.name} style={{display:activeTab===sheet.name?'contents':'none'}}><div className="worksheet-heading"><h2>{sheet.name}</h2><p>Original values, saved formulas and cell notes from the stage workbook.</p></div><SheetGrid sheet={sheet}/></div>)}
  </div>;
}
