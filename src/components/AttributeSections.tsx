import {memo,useMemo,useState} from 'react';
import {ArrowDown,ArrowUp} from 'lucide-react';
import {attributeFields,attributeSections,fieldRows,type AttributeSection} from '../data/attribute-sections';
import {displayCell,type ReferenceCell,type ReferenceSheet} from '../data/reference';
import FighterName from './FighterName';
import {attributeFighterNote} from '../data/attribute-footnotes';
import {sectionChart} from '../data/attribute-charts';
import {AttributeChartView,useAttributeControls} from './AttributeCharts';
export function ReferenceTable({section,query,sheetName=''}:{section:AttributeSection;query:string;sheetName?:string}){
  const [sort,setSort]=useState<{column:number;ascending:boolean}|null>(null);
  let rows=section.rows.filter(row=>row.some(c=>String(c.v??'').toLowerCase().includes(query.toLowerCase())));
  if(sort)rows=[...rows].sort((a,b)=>{const x=a[sort.column]?.v,y=b[sort.column]?.v;if(x===null)return 1;if(y===null)return -1;return (typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),undefined,{numeric:true}))*(sort.ascending?1:-1);});
  const fighterColumns=new Set(section.columns.flatMap((name,index)=>/^fighter(?:\s*\/.*)?$|^name$/i.test(name.trim())?[index]:[]));
  return <section className="attribute-section-card">
    <header><span className="eyebrow">{section.kind==='groups'?'FIGHTER GROUPS':`${section.rows.length} ENTRIES`}</span><h2>{section.title}</h2>{section.description&&<p>{section.description}</p>}</header>
    {section.kind==='groups'?<div className="attribute-group-grid">{rows.map((row,i)=><div key={i}><h3>{displayCell(row[0])}{typeof row[0].v==='number'&&/frame|lag|squat|length/i.test(section.title)?' frames':''}</h3><div>{row.slice(1).map(c=>{const name=displayCell(c),note=attributeFighterNote(sheetName,section.title,name,displayCell(row[0]));return <span className="fighter-chip" key={`${c.r}-${c.c}`} title={[c.note,note].filter(Boolean).join('\n')}><FighterName name={name}/></span>;})}</div></div>)}</div>:<div className="reference-table-scroll"><table className="ranking-table"><caption className="sr-only">{section.title}</caption><thead><tr>{section.columns.map((name,i)=><th key={i} aria-sort={sort?.column===i?(sort.ascending?'ascending':'descending'):'none'}><button onClick={()=>setSort({column:i,ascending:sort?.column===i?!sort.ascending:true})}>{name}{sort?.column===i?(sort.ascending?<ArrowUp size={13}/>:<ArrowDown size={13}/>):null}</button></th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{row.map((c,j)=>{const note=attributeFighterNote(sheetName,section.title,displayCell(c));return <td key={j} className={fighterColumns.has(j)?'ranking-fighter':typeof c.v==='number'?'numeric':''} title={[c.note,typeof c.v==='number'?`Exact value: ${c.v}`:null,note].filter(Boolean).join('\n')}>{fighterColumns.has(j)&&typeof c.v==='string'?<><FighterName name={displayCell(c)}/>{note&&<sup style={{fontSize:'8px',verticalAlign:'super',marginLeft:'2px'}} title={note}>*</sup>}</>:displayCell(c)}</td>;})}</tr>)}</tbody></table></div>}
    {!rows.length&&<p className="reference-empty" role="status">No matching entries.</p>}
  </section>;
}
const Notes=memo(function Notes({cells,comments,labels}:{cells:ReferenceCell[];comments:ReferenceCell[];labels?:Map<number,string>}){
  const rows=new Map<number,ReferenceCell[]>();for(const c of cells){if(!rows.has(c.r))rows.set(c.r,[]);rows.get(c.r)!.push(c);}
  if(!cells.length&&!comments.length)return null;
  return <details className="attribute-notes"><summary>Reference notes</summary><div className="attribute-note-grid">{labels?cells.map(c=><article key={`${c.r}-${c.c}`}><h3>{labels.get(c.c)??'Additional reference'}</h3><p>{displayCell(c)}</p></article>):[...rows.values()].map((row,i)=><article key={i}>{row.map(c=><p key={c.c}>{displayCell(c)}</p>)}</article>)}{comments.map(c=><article key={`${c.r}-${c.c}`}><h3>{typeof c.v==='string'?c.v:'Value note'}</h3><p>{c.note}</p></article>)}</div></details>;
});
export default function AttributeSections({sheet}:{sheet:ReferenceSheet}){
  const {query,setQuery}=useAttributeControls();
  const [selected,setSelected]=useState(0),[field,setField]=useState(0);
  const data=useMemo(()=>attributeSections(sheet),[sheet]);
  const fields=useMemo(()=>attributeFields(sheet),[sheet]);
  const isExplorer=['Raw Data','Calculations'].includes(sheet.name);
  const extraGroups=sheet.name==='Misc'||sheet.name==='Dodges';
  const current=fields[field]??fields[0];
  const sections=useMemo(()=>isExplorer?[{title:current?.label??sheet.name,columns:['Fighter','Value'],rows:current?fieldRows(sheet,current.column):[],description:current?.note}]:extraGroups?data.sections.filter(section=>section.kind!=='groups'):data.sections.filter(section=>section.title!=='Fighter notes'),[isExplorer,current,sheet,data.sections,extraGroups]);
  const section=sections[selected]??sections[0];
  const spotdodgeGroups=sheet.name==='Dodges'?data.sections.find(item=>item.kind==='groups'&&item.title==='Spotdodge groups'):undefined;
  const exploratoryNotes=useMemo(()=>isExplorer?sheet.cells.filter(c=>c.r>(sheet.name==='Raw Data'?46:44)):data.notes,[isExplorer,sheet,data.notes]);
  const labels=useMemo(()=>sheet.name==='Raw Data'?new Map(fields.map(f=>[f.column,f.label])):undefined,[sheet.name,fields]);
  return <div className="attribute-web-view">{sheet.name!=='Misc'&&<div className="attribute-content-heading"><div><h2>{sheet.name==='Raw Data'?'Fighter constants':sheet.name==='Calculations'?'Movement calculations':sheet.name}</h2><p>{isExplorer?'Choose a value to compare across fighters.':'Explore fighter values and timing by category.'}</p></div></div>}
    {isExplorer?<label className="metric-picker attribute-field-picker">{sheet.name==='Raw Data'?'Constant':'Calculation'}<select aria-label="Reference value" value={field} onChange={e=>{setField(Number(e.target.value));setQuery('');}}>{fields.map((f,i)=><option key={f.column} value={i}>{f.label}</option>)}</select></label>:sections.length>1?<nav className="attribute-section-tabs" aria-label="Reference categories">{sections.map((s,i)=><button key={s.title} aria-pressed={i===selected} onClick={()=>{setSelected(i);setQuery('');}}>{s.title}</button>)}</nav>:null}
    {section&&<AttributeChartView model={sectionChart(sheet.name,section,data.sections)} table={<><ReferenceTable key={section.title} section={section} query={query} sheetName={sheet.name}/>{sheet.name==='Dodges'&&section.title==='Spotdodges'&&spotdodgeGroups&&<ReferenceTable key={spotdodgeGroups.title} section={spotdodgeGroups} query={query} sheetName={sheet.name}/>}</>}/>}
    <Notes cells={exploratoryNotes} comments={data.comments} labels={labels}/>
  </div>;
}
