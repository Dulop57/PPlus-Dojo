import {useState} from 'react';
import source from '../data/reference/attributes.json';
import {displayCell,type ReferenceBook} from '../data/reference';
import {attributeSections,type AttributeSection} from '../data/attribute-sections';
import {ReferenceTable} from './AttributeSections';
import FighterName from './FighterName';
import {sectionChart} from '../data/attribute-charts';
import {AttributeChartControls,AttributeChartView,useAttributeControls} from './AttributeCharts';

const misc=(source as ReferenceBook).sheets.find(sheet=>sheet.name==='Misc')!;
const sections=attributeSections(misc).sections.filter(section=>section.kind==='groups'||section.title==='Notable outliers'||section.title==='True spikes').map(section=>({sheet:misc.name,section}));

export default function FighterGroupReference(){
  const [selected,setSelected]=useState(0);
  const {query,setQuery}=useAttributeControls();
  const current=sections[selected];
  return <div className="fighter-groups-view attribute-workspace">
    <aside className="reference-toolbar attribute-metric-sidebar misc-category-sidebar"><div className="metric-picker"><span className="metric-picker-label">CATEGORY</span><label className="narrow-metric-picker"><span className="sr-only">Misc category</span><select aria-label="Misc category" value={selected} onChange={event=>{setSelected(Number(event.currentTarget.value));setQuery('');}}>{sections.map((item,index)=><option key={item.section.title} value={index}>{item.section.title}</option>)}</select></label><nav className="metric-options" aria-label="Misc categories">{sections.map((item,index)=><button className="metric-option" key={item.section.title} title={item.section.title} aria-pressed={index===selected} onClick={()=>{setSelected(index);setQuery('');}}><span>{item.section.title}</span></button>)}</nav></div></aside>
    <div className="attribute-primary"><AttributeChartControls chartLabel={current.section.title==='True spikes'?'Cards':'Chart'}/>
    {current&&<AttributeChartView model={sectionChart(current.sheet,current.section)} table={current.section.kind==='groups'?<FighterGroupCard section={current.section} sheet={current.sheet} query={query}/>:<ReferenceTable section={current.section} query={query} sheetName={current.sheet}/>}/>}
    </div>
  </div>;
}

function FighterGroupCard({section,sheet,query}:{section:AttributeSection;sheet:string;query:string}){
  return <section className="attribute-section-card">
    <header><span className="eyebrow">FIGHTER GROUP · {sheet.toUpperCase()}</span><h2>{section.title}</h2>{section.description&&<p>{section.description}</p>}</header>
    <div className="attribute-group-grid compact-fighter-groups">{section.rows.filter(row=>row.some(c=>String(c.v??'').toLowerCase().includes(query.toLowerCase()))).map((row,index)=><div key={index}><h3>{displayCell(row[0])}{typeof row[0].v==='number'&&/frame|lag|squat|length/i.test(section.title)?' frames':''}</h3><div>{row.slice(1).map(cell=><span className="fighter-chip" key={`${cell.r}-${cell.c}`} title={cell.note}><FighterName name={displayCell(cell)}/></span>)}</div></div>)}</div>
  </section>;
}
