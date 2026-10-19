import {useLayoutEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import {CircleHelp,Settings2,X} from 'lucide-react';
import {catalog} from '../data/catalog';
import {fighterPortraitImage,fighterGridImage} from '../data/fighter-images';
import {diamondRows,rosterStats} from '../data/roster-attributes';
import savedFramings from '../data/roster-framings.json';
import type {StageFraming} from '../data/stage-framing';
import {imageEditingEnabled} from '../data/image-editing';
import type {Manifest} from '../data/types';
import DiamondPortrait from './DiamondPortrait';
import RosterCropEditor from './RosterCropEditor';
import '../diamond-roster.css';

export default function DiamondRoster({manifest,pending,error,retry}:{manifest:Manifest|null;pending:boolean;error:string;retry:()=>void}){
  const [preview,setPreview]=useState('mario'),[editing,setEditing]=useState(false),[editor,setEditor]=useState<string|null>(null);
  const [drafts,setDrafts]=useState<Record<string,StageFraming>>({}),[size,setSize]=useState(80);
  const [narrow,setNarrow]=useState(()=>!matchMedia('(min-width:1100px) and (min-height:560px)').matches);
  const [columns,setColumns]=useState(4),[popup,setPopup]=useState(false);
  const stage=useRef<HTMLDivElement>(null);
  const dialog=useRef<HTMLDialogElement>(null);
  useLayoutEffect(()=>{
    const element=stage.current!;
    const measure=()=>{
      const bounds=element.getBoundingClientRect();
      const compact=!matchMedia('(min-width:1100px) and (min-height:560px)').matches;
      setNarrow(compact);
      if(!compact){setPopup(false);setSize(Math.max(16,Math.min((bounds.width-32)/9,(bounds.height-12)/3)));return;}
      // Alternate full and inset rows so the next row occupies the diamond gaps.
      // Choose the largest portraits that fit both available viewport dimensions.
      let bestSize=0,bestColumns=4;
      for(let count=2;count<=14;count++){
        let remaining=catalog.length,rows=0;
        while(remaining>0){remaining-=count-(rows%2);rows++;}
        const fitted=Math.min((bounds.width-(count-1)*4)/count,(2*bounds.height-(rows-1)*4)/(rows+1));
        if(fitted>bestSize){bestSize=fitted;bestColumns=count;}
      }
      setColumns(bestColumns);setSize(Math.max(1,bestSize));
    };
    measure();const observer=new ResizeObserver(measure);observer.observe(element);window.addEventListener('resize',measure);
    return()=>{observer.disconnect();window.removeEventListener('resize',measure);};
  },[]);
  useLayoutEffect(()=>{if(narrow&&popup&&dialog.current&&!dialog.current.open)dialog.current.showModal();},[narrow,popup]);
  const rows=useMemo(()=>{
    if(!narrow)return diamondRows;
    const fighters=[...catalog].sort((a,b)=>a.name.localeCompare(b.name,'en')).map(fighter=>fighter.id);
    const packed:string[][]=[];
    for(let offset=0;offset<fighters.length;){const count=columns-(packed.length%2);packed.push(fighters.slice(offset,offset+count));offset+=count;}
    return packed;
  },[narrow,columns]);
  const selected=catalog.find(fighter=>fighter.id===preview)!;
  const stats=useMemo(()=>rosterStats(preview),[preview]);
  const current=catalog.find(fighter=>fighter.id===editor);
  const image=current?(fighterPortraitImage(current.id,current.name)??fighterGridImage(current.id,current.name)):undefined;
  const defaults=savedFramings as Record<string,StageFraming>;
  const framing=(id:string)=>imageEditingEnabled&&drafts[id]?drafts[id]:defaults[id];
  const attributes=<section className="roster-attributes" aria-labelledby="roster-preview-name"><header><img src={fighterGridImage(selected.id,selected.name)} alt=""/><h1 id="roster-preview-name">{selected.name}</h1><span>Attributes</span></header><div className="roster-stat-grid">{stats.map(stat=><div className="roster-stat" key={stat.name} data-stat={stat.name} title={`${stat.label}: ${stat.display}${stat.z===null?'':` · Z-score ${stat.z}`}`}><span className="roster-stat-label">{stat.label}</span><div className="roster-stat-track" role="meter" aria-label={stat.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={stat.fill??undefined} aria-valuetext={stat.fill===null?'Unavailable':`${stat.display}${stat.z===null?'':`, Z-score ${stat.z}`}`}><span style={{width:`${stat.fill??0}%`}}/></div><strong>{stat.value===null?'—':stat.display}</strong></div>)}</div></section>;
  return <div className={`diamond-roster-page${narrow?' roster-narrow':''}`}>
    {imageEditingEnabled&&<div className="roster-owner-tools"><button aria-pressed={editing} onClick={()=>setEditing(value=>!value)}><Settings2 size={14}/>{editing?'Finish adjusting portraits':'Adjust portraits'}</button>{editing&&<span>Choose a portrait to edit. Changes save to the project.</span>}</div>}
    <div className="diamond-stage" ref={stage}><nav className="diamond-board" aria-label="Choose a fighter" style={{'--diamond-size':`${size}px`} as CSSProperties}>{rows.map((row,index)=><div className={`diamond-row row-${index+1}`} key={index}>{row.map(id=>{
      if(id==='random')return <button className="fighter-diamond random-diamond" key={id} aria-label="Open random fighter" title="Random fighter" onClick={()=>{const fighter=catalog[Math.floor(Math.random()*catalog.length)];location.hash=`#/fighters/${fighter.id}`;}}><CircleHelp aria-hidden="true"/></button>;
      const fighter=catalog.find(fighter=>fighter.id===id)!;
      const portrait=fighterPortraitImage(id,fighter.name)??fighterGridImage(id,fighter.name);
      if(narrow)return <button key={id} className={`fighter-diamond${preview===id?' previewed':''}`} aria-label={editing?`Adjust ${fighter.name} portrait`:`Show ${fighter.name} attributes`} data-fighter={id} title={fighter.name} onClick={()=>{if(editing&&imageEditingEnabled)setEditor(id);else{setPreview(id);setPopup(true);}}}>{portrait&&<DiamondPortrait image={portrait} framing={framing(id)}/>}</button>;
      return <a key={id} className={`fighter-diamond${preview===id?' previewed':''}`} href={`#/fighters/${id}`} aria-label={editing?`Adjust ${fighter.name} portrait`:`Open ${fighter.name}`} data-fighter={id} title={`${fighter.name} - Click to see full moveset`} onMouseEnter={()=>setPreview(id)} onFocus={()=>setPreview(id)} onClick={event=>{if(editing&&imageEditingEnabled){event.preventDefault();setEditor(id);}}}>{portrait&&<DiamondPortrait image={portrait} framing={framing(id)}/>}</a>;
    })}</div>)}</nav></div>
    {!narrow&&attributes}
    {narrow&&popup&&<dialog ref={dialog} className="roster-stats-dialog" aria-labelledby="roster-preview-name" onClose={()=>setPopup(false)} onClick={event=>{if(event.target===event.currentTarget)dialog.current?.close();}}><button className="roster-stats-close" aria-label="Close fighter attributes" onClick={()=>dialog.current?.close()}><X size={20}/></button>{attributes}<a className="button primary" href={`#/fighters/${preview}`}>View moveset</a></dialog>}
    {(pending||!manifest||error)&&<div className="roster-data-note">{pending?'Checking local dataset…':!manifest?'Fighter animation data not imported':''}{error&&<span role="alert">{error} <button onClick={retry}>Retry data</button></span>}</div>}
    {editor&&current&&image&&<RosterCropEditor key={editor} id={editor} name={current.name} image={image} initial={framing(editor)} onChange={(id,value)=>setDrafts(current=>({...current,[id]:value}))} onClose={()=>setEditor(null)}/>} 
  </div>;
}
