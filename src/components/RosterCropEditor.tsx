import {useEffect,useRef,useState} from 'react';
import {RotateCcw,X} from 'lucide-react';
import type {StageFraming} from '../data/stage-framing';
import {defaultRosterFraming,type RosterImageGeometry} from '../data/roster-framing';
import DiamondPortrait from './DiamondPortrait';

export default function RosterCropEditor({id,name,image,initial,onChange,onClose}:{id:string;name:string;image:string;initial?:StageFraming;onChange:(id:string,value:StageFraming)=>void;onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null),queue=useRef(Promise.resolve()),revision=useRef(0),mounted=useRef(true);
  const [crop,setCrop]=useState(initial),[status,setStatus]=useState(''),[saving,setSaving]=useState(false),[failed,setFailed]=useState(false);
  const [geometry,setGeometry]=useState<RosterImageGeometry|null>(null);
  useEffect(()=>{mounted.current=true;const element=dialog.current!;if(!element.open)element.showModal();return()=>{mounted.current=false;};},[]);
  const update=(value:StageFraming)=>{
    const next={x:Math.max(-100,Math.min(100,value.x)),y:Math.max(-100,Math.min(100,value.y)),scale:Math.max(1,Math.min(3.5,value.scale))};
    setCrop(next);onChange(id,next);setSaving(true);setFailed(false);setStatus('Saving to project…');
    const current=++revision.current;
    queue.current=queue.current.catch(()=>{}).then(async()=>{
      const response=await fetch('/__dojo-owner/roster-framing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,framing:next})});
      if(!response.ok)throw new Error('Save failed');
      if(mounted.current&&current===revision.current){setSaving(false);setStatus('Saved to project.');}
    }).catch(()=>{if(mounted.current&&current===revision.current){setSaving(false);setFailed(true);setStatus('Could not save to project. Your draft is still here; retry before closing.');}});
  };
  return <dialog ref={dialog} className="roster-crop-dialog" aria-labelledby="roster-crop-title" onClose={onClose} onCancel={event=>{if(saving||failed)event.preventDefault();}}>
    <header><h2 id="roster-crop-title">Adjust {name}</h2><button aria-label="Close portrait editor" disabled={saving||failed} onClick={()=>dialog.current?.close()}><X size={20}/></button></header>
    <p>Drag the portrait or use the sliders. Every adjustment saves to the project.</p>
    <div className="roster-crop-preview"><DiamondPortrait image={image} framing={crop} onChange={update} onGeometry={setGeometry}/></div>
    <div className="roster-crop-sliders">{(['x','y','scale'] as const).map(key=>{
      const limit=key==='x'?geometry?.limitX:key==='y'?geometry?.verticalUnit:undefined;
      const range=key==='y'&&geometry?Math.floor(geometry.limitY/geometry.verticalUnit*100+1e-9):100;
      const scale=crop?.scale??1;
      const value=key==='scale'?scale:geometry&&limit?Math.round(geometry[key]/limit*100):0;
      return <label key={key}><span>{key==='x'?'Horizontal':key==='y'?'Vertical':'Zoom'}<output>{key==='scale'?`${Math.round(scale*100)}%`:`${value}%`}</output></span><input aria-label={`${name} portrait ${key==='x'?'horizontal':key==='y'?'vertical':'zoom'}`} type="range" min={key==='scale'?1:-range} max={key==='scale'?3.5:range} step={key==='scale'?.05:1} value={value} disabled={!geometry||key!=='scale'&&(!limit||limit<.01)} onChange={event=>update({x:geometry?.x??crop?.x??0,y:geometry?.y??crop?.y??0,scale,[key]:key==='scale'?Number(event.target.value):Number(event.target.value)/100*(limit??0)})}/></label>;
    })}</div>
    <div className="roster-crop-actions"><button disabled={!geometry} onClick={()=>{if(geometry)update(defaultRosterFraming(geometry));}}><RotateCcw size={14}/>Reset</button>{failed&&crop&&<button onClick={()=>update(crop)}>Retry saving</button>}<button className="button primary" disabled={saving||failed} onClick={()=>dialog.current?.close()}>Done</button><span aria-label="Project save status" role={failed?'alert':'status'}>{status||'Adjust an image to save its framing.'}</span></div>
  </dialog>;
}
