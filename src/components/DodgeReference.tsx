import {attributeSections,type AttributeSection} from '../data/attribute-sections';
import {displayCell,type ReferenceSheet} from '../data/reference';
import FighterName from './FighterName';

function TimingTable({section}:{section:AttributeSection}){
  return <table className="dodge-timings"><thead><tr><th scope="col">Option</th><th scope="col">Intangible</th><th scope="col">{section.title==='Airdodges'?'Ledge grab':'Actionable'}</th></tr></thead><tbody>{section.rows.map(row=><tr key={row[0].r}><th scope="row"><FighterName name={displayCell(row[0])}/></th><td>{displayCell(row[1])}–{displayCell(row[2])}</td><td>{displayCell(row[3])}</td></tr>)}</tbody></table>;
}
export default function DodgeReference({sheet}:{sheet:ReferenceSheet}){
  const sections=attributeSections(sheet).sections;
  const get=(title:string)=>sections.find(section=>section.title===title)!;
  const groups=get('Spotdodge groups');
  return <div className="dodge-reference" aria-label="Dodge and tech groups">
    <section className="dodge-panel"><header><h2>Rolls</h2><span>Frames</span></header><TimingTable section={get('Rolls')}/><p className="dodge-note">Jigglypuff and Dedede use “Everyone Else” timings for backward rolls.</p></section>
    <section className="dodge-panel"><header><h2>Spotdodges</h2><span>Frames</span></header><div className="spotdodge-groups">{get('Spotdodges').rows.map(row=>{
      const label=displayCell(row[0]),members=groups.rows.find(group=>group[0].v===row[0].v)?.slice(1)??[];
      return <article className="spotdodge-group" key={label}><div className="dodge-group-heading"><h3>{label}</h3><p>Intangible <strong>{displayCell(row[1])}–{displayCell(row[2])}</strong><span>Actionable <strong>{displayCell(row[3])}</strong></span></p></div><div className="dodge-faces" aria-label={`${label} fighters`}>{members.map(cell=><span key={`${cell.r}:${cell.c}`} title={displayCell(cell)}><FighterName name={displayCell(cell)}/></span>)}</div></article>;
    })}</div></section>
    <section className="dodge-panel"><header><h2>Airdodges</h2><span>Frames</span></header><TimingTable section={get('Airdodges')}/></section>
    <section className="dodge-panel"><header><h2>Techs</h2><span>Frames</span></header><p className="dodge-note">Universal across the cast.</p><TimingTable section={get('Techs')}/></section>
  </div>;
}
