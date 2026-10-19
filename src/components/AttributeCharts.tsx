import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {BarChart3,Grid2X2,Search,Table2} from 'lucide-react';
import {barDomain,chartNumber,type AttributeChart,type ChartRow} from '../data/attribute-charts';
import {displayCell} from '../data/reference';
import FighterName from './FighterName';
import {attributeFighterNote} from '../data/attribute-footnotes';
import {fighterGridImage} from '../data/fighter-images';

type Controls={view:'chart'|'table';setView:(view:'chart'|'table')=>void;query:string;setQuery:(q:string)=>void};
const ChartContext=createContext<Controls|null>(null);
export function useAttributeControls(){const value=useContext(ChartContext);if(!value)throw new Error('Attribute charts require their provider');return value;}
export function AttributeChartProvider({children}:{children:ReactNode}){
  const [view,setView]=useState<'chart'|'table'>(()=>typeof window!=='undefined'&&window.matchMedia('(max-width: 900px)').matches?'table':'chart'),[query,setQuery]=useState('');
  useEffect(()=>{
    const narrow=window.matchMedia('(max-width: 900px)');
    const updateDefault=()=>setView(narrow.matches?'table':'chart');
    narrow.addEventListener('change',updateDefault);
    return ()=>narrow.removeEventListener('change',updateDefault);
  },[]);
  return <ChartContext.Provider value={{view,setView,query,setQuery}}>{children}</ChartContext.Provider>;
}
export function AttributeChartControls({ranking=false,chartLabel='Chart',action,viewSwitch}:{ranking?:boolean;chartLabel?:'Chart'|'Cards';action?:ReactNode;viewSwitch?:ReactNode}){
  const controls=useAttributeControls();
  const ViewIcon=chartLabel==='Cards'?Grid2X2:BarChart3;
  return <div className="attribute-chart-controls">
    {viewSwitch??<div className="chart-view-switch" role="group" aria-label="Attributes view"><button aria-pressed={controls.view==='chart'} onClick={()=>controls.setView('chart')}><ViewIcon size={16}/>{chartLabel}</button><button aria-pressed={controls.view==='table'} onClick={()=>controls.setView('table')}><Table2 size={16}/>Table</button></div>}
    <label className="reference-search"><Search size={16}/><input aria-label={ranking?'Search attribute entries':'Search reference entries'} placeholder="Find a fighter or value…" value={controls.query} onChange={e=>controls.setQuery(e.target.value)}/></label>
    {action}
  </div>;
}

export function AttributeChartView({model,table}:{model:AttributeChart;table:ReactNode}){
  const {view}=useAttributeControls();
  if(model.kind==='text')return <>{table}</>;
  return <><div className="attribute-chart-host" hidden={view!=='chart'}><Chart key={`${model.sheet}:${model.title}`} model={model}/></div>{view==='table'&&table}</>;
}
function Chart({model}:{model:AttributeChart}){
  const controls=useAttributeControls();
  const nameSortedGroups=['Number of jumps','Dash length','Empty landing lag','Costumes'];
  const [seriesIndex,setSeriesIndex]=useState(()=>model.sheet==='Main'?Math.max(0,model.series.findIndex(s=>/^sum$/i.test(s.label))):0),[sort,setSort]=useState(nameSortedGroups.includes(model.title)?'name':'descending'),[detail,setDetail]=useState<{row:ChartRow;column?:number}|null>(null);
  const series=model.kind==='bars'?[model.series[seriesIndex]??model.series[0]]:model.series;
  const valueFor=(row:ChartRow,column:number)=>model.kind==='groups'&&model.groupMetric!=='value'?row.cells.length-1:chartNumber(row.cells[column]);
  const rows=useMemo(()=>{
    const query=controls.query.toLowerCase();
    const result=model.rows.filter(row=>[row.label,...row.fighters.map(f=>f.name),...row.cells.map(c=>String(c.v??''))].some(v=>v.toLowerCase().includes(query)));
    if(['bars','grouped','groups'].includes(model.kind))result.sort((a,b)=>{
      if(sort==='name')return a.label.localeCompare(b.label,undefined,{numeric:true});
      const x=valueFor(a,series[0].column),y=valueFor(b,series[0].column);
      if(x===null)return y===null?0:1;if(y===null)return -1;
      return (sort==='ascending'?x-y:y-x)||a.label.localeCompare(b.label,undefined,{numeric:true});
    });
    return result;
  },[model,controls.query,sort,seriesIndex]);
  const allValues=model.rows.flatMap(row=>[...series.map(s=>valueFor(row,s.column)),...model.windows.flatMap(w=>{const end=chartNumber(row.cells[w.through]);return end===null?[]:[end+1];})]);
  const [min,max]=barDomain(allValues,model.axisMinimum),position=(value:number)=>(value-min)/(max-min)*100,baseline=position(Math.max(min,Math.min(max,0)));
  const show=(row:ChartRow,column?:number)=>setDetail({row,column});
  const detailText=(row:ChartRow)=>row.cells.map((c,i)=>`${model.columns?.[i]??model.series.find(s=>s.column===i)?.label??'Value'}: ${displayCell(c)}`).join('; ');
  const rowEvents=(row:ChartRow,column?:number)=>model.kind==='groups'?{}:({onMouseEnter:()=>show(row,column),onFocus:()=>show(row,column)});
  const matrix=['heatmap','matrix'].includes(model.kind);
  return <section className="attribute-section-card attribute-chart-card" data-chart-kind={model.kind} data-row-descriptions={model.rows.some(row=>row.description)} data-large-group={model.kind==='groups'&&rows.length>=4&&rows.some(row=>row.cells.length>25)} aria-label={`${model.title} ${model.kind==='cards'?'fighters':'chart'}`}>
    <header><span className="eyebrow">{rows.length} {model.kind==='cards'?'FIGHTERS':model.kind==='groups'?'GROUPS':'ENTRIES'}{model.kind==='cards'?'':' · INTERACTIVE CHART'}</span><h2>{model.title}</h2>{model.description&&<details className="chart-description"><summary>About this attribute</summary><p>{model.description}</p></details>}<p>{model.kind==='cards'?'These attacks cannot be meteor cancelled.':model.kind==='groups'?'Fighters are shown beneath each group.':'Hover or focus a fighter to see their values.'}</p></header>
    <div className="chart-local-controls">
      {model.kind==='bars'&&model.series.length>1&&<label>Measurement<select aria-label="Chart measurement" value={seriesIndex} onChange={e=>{setSeriesIndex(Number(e.target.value));setDetail(null);}}>{model.series.map((s,i)=><option key={s.column} value={i}>{s.label}{s.unit&&s.unit.toLowerCase()!==s.label.toLowerCase()?` (${s.unit})`:''}</option>)}</select></label>}
      {['bars','grouped','groups'].includes(model.kind)&&<label>Sort<select aria-label="Sort chart" value={sort} onChange={e=>setSort(e.target.value)}><option value="descending">Value: high to low</option><option value="ascending">Value: low to high</option><option value="name">Fighter/group name</option></select></label>}
      <div className="chart-legend" aria-label="Chart legend">{model.kind==='matrix'?<span>✓ Yes · No</span>:model.kind==='heatmap'?<><span><i style={{background:'hsl(170 48% 18%)'}}/>Lower lag</span><span><i style={{background:'hsl(35 48% 36%)'}}/>Higher lag · frames</span><span>— Unavailable</span></>:series.map((s,i)=><span key={s.column}><i style={{background:`var(--chart-series-${i%6})`}}/>{s.label}{s.unit&&s.unit.toLowerCase()!==s.label.toLowerCase()?` · ${s.unit}`:''}</span>)}</div>
    </div>
    {!rows.length?<p className="reference-empty" role="status">No entries match “{controls.query}”.</p> :model.kind==='cards'?<div className="true-spike-grid" role="list" aria-label="True spike fighters">{rows.map(row=>{
      const image=fighterGridImage(row.fighters[0]?.id??'',row.label);
      return <article key={row.id} className="true-spike-card" role="listitem" data-fighter-id={row.id}>{image&&<img src={image} alt="" aria-hidden="true" decoding="async"/>}<div><h3>{row.label}</h3>{row.cells.slice(1).map((cell,index)=><p key={`${cell.r}:${cell.c}:${index}`} title={cell.note}>{displayCell(cell)}</p>)}</div></article>;
    })}</div>:matrix?<div className="attribute-chart-scroll chart-matrix-scroll"><table className="chart-matrix chart-matrix-overview"><caption className="sr-only">{model.title}: {model.kind==='heatmap'?'landing lag in frames':'fighter membership'}</caption><thead><tr><th scope="col">{model.kind==='heatmap'?'Aerial':'Group / attack'}</th>{rows.map(row=><th scope="col" key={row.id}><button className="matrix-fighter-label" aria-label={`Inspect ${row.label}`} title={row.label} {...rowEvents(row)}><FighterName name={row.label}/></button></th>)}</tr></thead><tbody>{series.map(s=><tr key={s.column}><th scope="row" title={s.label}><span>{s.label}</span></th>{rows.map(row=>{
      const cell=row.cells[s.column],value=chartNumber(cell),member=cell?.v===true;
      const note=attributeFighterNote(model.sheet,model.title,row.label,s.label);
      const status=model.kind==='matrix'?(member?'Yes':'No'):displayCell(cell);
      return <td key={row.id}><button className={model.kind==='heatmap'?'heatmap-cell':'membership-cell'} data-member={member} style={model.kind==='heatmap'&&value!==null?{background:`hsl(${170-(value/(max||1))*135} 48% ${18+(value/(max||1))*18}%)`}:undefined} aria-label={`${row.label}${note?'*':''}, ${s.label}: ${status}${s.unit?` ${s.unit}`:''}${note?`. ${note}`:''}`} title={`${row.label}${note?'*':''} · ${s.label}: ${status}${cell?.note?`\n${cell.note}`:''}${note?`\n${note}`:''}`} {...rowEvents(row,s.column)}>{model.kind==='matrix'?(member?'Yes':'No'):displayCell(cell)}{note&&<sup style={{fontSize:'8px',verticalAlign:'super',marginLeft:'2px'}} aria-hidden="true">*</sup>}</button></td>;
    })}</tr>)}</tbody></table></div>:<div className="chart-comparison-plot">
      <div className="chart-axis" aria-hidden="true"><span>{min.toLocaleString('en-US',{maximumFractionDigits:4})}</span><span>{max.toLocaleString('en-US',{maximumFractionDigits:4})}</span></div>
      <div className="chart-columns chart-roster" role="list" aria-label={`${model.title} entries`} style={{gridTemplateColumns:`repeat(${rows.length},minmax(0,1fr))`}}>{rows.map(row=><div className="chart-roster-row" role="listitem" key={row.id}>
        <button className="chart-row-label" aria-label={`Inspect ${row.label}`} title={row.label} {...rowEvents(row)}><FighterName name={row.label}/>{row.description&&<span className="chart-entry-description">{row.description}</span>}</button>
        <button className="chart-plot-button" aria-label={`${row.label}: ${model.kind==='groups'?`${row.cells.length-1} fighters`:detailText(row)}`} title={model.kind==='groups'?`${row.label} · ${row.cells.length-1} fighters`:`${row.label}\n${detailText(row)}`} {...rowEvents(row)}>
          <svg className="chart-row-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <line x1="0" x2="100" y1={100-baseline} y2={100-baseline} className="chart-zero"/>
            {model.kind==='timeline'?<>
              {series.map((s,i)=>{const value=chartNumber(row.cells[s.column]);return value!==null?<line key={s.column} x1="8" x2="92" y1={100-position(value)} y2={100-position(value)} stroke={`var(--chart-series-${i%6})`} strokeWidth=".8"/>:null;})}
            </>:series.map((s,i)=>{const value=valueFor(row,s.column);return value===null?null:value===0?<line key={s.column} x1="15" x2="85" y1={100-baseline} y2={100-baseline} stroke={`var(--chart-series-${i%6})`} strokeWidth=".7"/>:<rect key={s.column} data-value={value} x={model.kind==='grouped'?10+i*80/series.length:15} y={100-Math.max(baseline,position(value))} width={model.kind==='grouped'?70/series.length:70} height={Math.abs(position(value)-baseline)} rx="1" fill={`var(--chart-series-${i%6})`}/>;})}
          </svg>
          {model.kind!=='groups'&&series.every(s=>chartNumber(row.cells[s.column])===null)&&<span className="chart-missing" aria-label="Unavailable">—</span>}
          <span className="chart-row-values">{model.kind==='groups'?`${row.cells.length-1} fighters`:series.map(s=>`${series.length>1?`${s.label}: `:''}${displayCell(row.cells[s.column])}`).join(' · ')}</span>
        </button>
        {model.kind==='groups'&&<div className="chart-group-members" aria-label={`${row.label} fighters`}>{row.cells.slice(1).map(cell=><span className="chart-group-face" key={`${cell.r}:${cell.c}:${String(cell.v)}`} title={String(cell.v)} tabIndex={0}><FighterName name={String(cell.v)}/></span>)}</div>}
      </div>)}</div>
    </div>}
    {!['groups','cards'].includes(model.kind)&&<aside className="chart-details" aria-label="Chart details" aria-live="polite">{detail?<dl>
      <div className="chart-detail-identity"><dt className="sr-only">Fighter</dt><dd><FighterName name={detail.row.label}/></dd></div>
      {detail.row.cells.map((cell,i)=>{
        const label=model.columns?.[i]??model.series.find(s=>s.column===i)?.label??'Value';
        if(/^fighter(?:\s*\/.*)?$|^name$|^group$|^F\/B$/i.test(label))return null;
        const original=cell.original??cell;
        const note=attributeFighterNote(model.sheet,model.title,detail.row.label,label);
        return <div key={i} data-active={detail.column===i}><dt>{label}</dt><dd title={original.note}>{model.kind==='matrix'?(cell.v===true?'Yes':'No'):displayCell(cell)}{note&&<small>* {note}</small>}</dd></div>;
      })}
    </dl>:<p>Hover a fighter to see their values.</p>}</aside>}
  </section>;
}
