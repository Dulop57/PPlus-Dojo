import {useLayoutEffect,useRef,useState,type KeyboardEvent,type PointerEvent} from 'react';
import {Check,RotateCcw,Settings2,X} from 'lucide-react';
import type {Stage} from '../data/reference';
import {imageEditingEnabled} from '../data/image-editing';
import stageDefaults from '../data/stage-framings.json';
import {clamp,defaultStageFraming,migrateStageFraming,panStageImage,stageImageGeometry,type StageFraming,type StageImageGeometry} from '../data/stage-framing';

const storageKey='pplus-dojo-stage-framing:v2';
const legacyStorageKey='pplus-dojo-stage-framing:v1';
const normalize=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'');
const images=new Map(Object.entries(import.meta.glob('../../Images/PPlus_Stage_*.{png,jpg}',{eager:true,import:'default',query:'?url'}) as Record<string,string>).map(([path,url])=>[normalize(path.split('/').pop()!.replace('PPlus_Stage_','').replace(/\.(png|jpg)$/i,'')),url]));
function readFramings(key:string):Record<string,StageFraming>{
  try{
    const data=JSON.parse(localStorage.getItem(key)??'{}');
    if(!data||typeof data!=='object'||Array.isArray(data))return {};
    return Object.fromEntries(Object.entries(data).filter((entry):entry is [string,StageFraming]=>{
      const value=entry[1] as StageFraming|undefined;
      return !!value&&['x','y','scale'].every(k=>typeof value[k as keyof StageFraming]==='number'&&Number.isFinite(value[k as keyof StageFraming]));
    }).map(([id,value])=>[id,{x:clamp(value.x,-100,100),y:clamp(value.y,-100,100),scale:clamp(value.scale,1,3.5)}]));
  }catch{return {};}
}

// Keyed by stage in the parent: each stage has its own draft and saved default.
export default function StageHeader({stage,eyebrow}:{stage:Stage;eyebrow:string}){
  const image=images.get(normalize(stage.id))??images.get(normalize(stage.name));
  const [initial]=useState(()=>({current:readFramings(storageKey)[stage.id],legacy:readFramings(legacyStorageKey)[stage.id]}));
  const projectFraming=(stageDefaults as Record<string,StageFraming>)[stage.id];
  const [saved,setSaved]=useState<StageFraming>((imageEditingEnabled?initial.current??projectFraming:projectFraming??initial.current)??defaultStageFraming);
  const [framing,setFraming]=useState(saved);
  const [editing,setEditing]=useState(false);
  const [hasEdited,setHasEdited]=useState(false);
  const [status,setStatus]=useState('');
  const [source,setSource]=useState({width:0,height:0});
  const [view,setView]=useState({width:0,height:0});
  const artRef=useRef<HTMLDivElement>(null);
  const migrated=useRef(false);
  const drag=useRef<{pointer:number;clientX:number;clientY:number;geometry:StageImageGeometry;factorX:number;factorY:number}|null>(null);
  const ready=source.width>0&&view.width>0&&view.height>0;
  const geometry=stageImageGeometry(ready?view:{width:1,height:1},ready?source:{width:1,height:1},framing);
  useLayoutEffect(()=>{
    const element=artRef.current;if(!element)return;
    const measure=()=>{drag.current=null;const bounds=element.getBoundingClientRect();setView({width:bounds.width,height:bounds.height});};
    measure();const observer=new ResizeObserver(measure);observer.observe(element);
    return()=>observer.disconnect();
  },[image]);
  useLayoutEffect(()=>{
    if(!ready||migrated.current)return;
    migrated.current=true;
    if(!initial.current&&!projectFraming&&initial.legacy){
      const converted=migrateStageFraming(initial.legacy,view,source);
      setSaved(converted);setFraming(converted);
    }
  },[ready,initial,projectFraming,view,source]);

  const saveQueue=useRef(Promise.resolve());
  const saveRevision=useRef(0);
  const persist=(value:StageFraming)=>{
    if(!imageEditingEnabled)return;
    const revision=++saveRevision.current;
    try{localStorage.setItem(storageKey,JSON.stringify({...readFramings(storageKey),[stage.id]:value}));}catch{/* Project saving still works without browser storage. */}
    setSaved(value);setStatus('Saving to project…');
    saveQueue.current=saveQueue.current.catch(()=>{}).then(async()=>{
      const response=await fetch('/__dojo-owner/stage-framing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:stage.id,framing:value})});
      if(!response.ok)throw new Error('Project save failed');
      if(revision===saveRevision.current)setStatus('Saved to project.');
    }).catch(()=>{if(revision===saveRevision.current)setStatus('Could not save to project. Keep the editor open and try again.');});
  };
  const update=(value:StageFraming)=>{
    const next=stageImageGeometry(view,source,value);
    const crop={x:next.x,y:next.y,scale:next.scale};
    setFraming(crop);persist(crop);
  };
  const close=()=>{drag.current=null;setFraming(saved);setEditing(false);setStatus('');};
  const save=()=>{
    const value={x:geometry.x,y:geometry.y,scale:geometry.scale};
    persist(value);setFraming(value);setEditing(false);
  };
  const beginDrag=(event:PointerEvent<HTMLDivElement>,overview=false)=>{
    if(!editing||!ready||event.button!==0)return;
    event.preventDefault();
    let start=geometry;
    const bounds=event.currentTarget.getBoundingClientRect();
    if(overview){
      const u=(event.clientX-bounds.left)/bounds.width,v=(event.clientY-bounds.top)/bounds.height;
      const cropLeft=-geometry.left/geometry.width,cropTop=-geometry.top/geometry.height;
      const inside=u>=cropLeft&&u<=cropLeft+view.width/geometry.width&&v>=cropTop&&v<=cropTop+view.height/geometry.height;
      if(!inside){
        const target={...framing,x:(.5-u)*100,y:(.5-v)*100};
        start=stageImageGeometry(view,source,target);update(target);
      }
    }
    drag.current={pointer:event.pointerId,clientX:event.clientX,clientY:event.clientY,geometry:start,factorX:overview?-start.width/bounds.width:1,factorY:overview?-start.height/bounds.height:1};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag=(event:PointerEvent<HTMLDivElement>)=>{
    const start=drag.current;if(!start||start.pointer!==event.pointerId)return;
    const next=panStageImage(start.geometry,(event.clientX-start.clientX)*start.factorX,(event.clientY-start.clientY)*start.factorY);
    start.geometry=stageImageGeometry(view,source,next);start.clientX=event.clientX;start.clientY=event.clientY;
    setFraming(next);persist(next);
  };
  const endDrag=()=>{drag.current=null;};
  const keyPan=(event:KeyboardEvent<HTMLDivElement>,overview=false)=>{
    if(!editing||!ready)return;
    const directions:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    const direction=directions[event.key];
    if(!direction)return;
    event.preventDefault();const step=(event.shiftKey?10:2)*(overview?-1:1);
    update(panStageImage(geometry,direction[0]*step,direction[1]*step));
  };
  const xPercent=geometry.limitX>0?geometry.x/geometry.limitX*100:0;
  const yPercent=geometry.limitY>0?geometry.y/geometry.limitY*100:0;

  return <header className={`stage-header${editing?' is-editing':''}${hasEdited?' has-edited':''}`}>
    <div className="stage-title">
      {image&&<div ref={artRef} className="stage-header-art" role={editing?'button':undefined} tabIndex={editing?0:undefined} aria-label={editing?`Reposition ${stage.name} banner image`:undefined} onKeyDown={keyPan} onPointerDown={event=>beginDrag(event)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}>
        <div className="stage-header-reveal"><img src={image} alt={`${stage.name} stage`} draggable={false} onLoad={event=>setSource({width:event.currentTarget.naturalWidth,height:event.currentTarget.naturalHeight})} style={{width:geometry.width,height:geometry.height,left:geometry.left,top:geometry.top,visibility:ready?'visible':'hidden'}}/></div>
      </div>}
      <div className="stage-header-copy"><span className="eyebrow muted">{eyebrow.toUpperCase()}</span><h2>{stage.name}</h2></div>
      {image?(imageEditingEnabled&&<button className="stage-image-adjust" disabled={!ready} aria-expanded={editing} aria-controls={`stage-image-editor-${stage.id}`} onClick={()=>{if(editing)close();else{setHasEdited(true);setEditing(true);}}}>{editing?<X size={13}/>:<Settings2 size={13}/>}<span>{editing?'Close':'Adjust image'}</span></button>):<span className="stage-image-unavailable">Stage image unavailable</span>}
      <span className="stage-image-feedback" role="status">{status}</span>
    </div>
    {editing&&<section className="stage-image-editor" id={`stage-image-editor-${stage.id}`} aria-label={`${stage.name} image controls`}>
      <p>Drag the banner or choose an area below. Every adjustment saves automatically to the project.</p>
      <div className="stage-image-workspace">
        <div className="stage-image-overview" role="button" tabIndex={0} aria-label={`Choose the visible area of ${stage.name}`} style={{aspectRatio:`${source.width} / ${source.height}`}} onKeyDown={event=>keyPan(event,true)} onPointerDown={event=>beginDrag(event,true)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}>
          <img src={image} alt={`${stage.name} full image`} draggable={false}/>
          <div className="stage-image-crop" aria-hidden="true" style={{left:`${-geometry.left/geometry.width*100}%`,top:`${-geometry.top/geometry.height*100}%`,width:`${view.width/geometry.width*100}%`,height:`${view.height/geometry.height*100}%`}}/>
        </div>
        <div className="stage-image-sliders">
          <label><span>Horizontal<output>{Math.round(xPercent)}%</output></span><input type="range" aria-label={`${stage.name} image horizontal`} min="-100" max="100" step="1" disabled={geometry.limitX<.01} value={xPercent} onChange={event=>update({...framing,x:Number(event.target.value)/100*geometry.limitX})}/>{geometry.limitX<.01&&<small>Increase scale to move left or right.</small>}</label>
          <label><span>Vertical<output>{Math.round(yPercent)}%</output></span><input type="range" aria-label={`${stage.name} image vertical`} min="-100" max="100" step="1" disabled={geometry.limitY<.01} value={yPercent} onChange={event=>update({...framing,y:Number(event.target.value)/100*geometry.limitY})}/></label>
          <label><span>Scale<output>{Math.round(framing.scale*100)}%</output></span><input type="range" aria-label={`${stage.name} image scale`} min="1" max="3.5" step="0.05" value={framing.scale} onChange={event=>update({...framing,scale:Number(event.target.value)})}/></label>
        </div>
      </div>
      <div className="stage-image-actions"><button onClick={()=>update(defaultStageFraming)}><RotateCcw size={13}/>Reset</button><button className="stage-image-save" onClick={save}><Check size={13}/>Done</button><small>Saved per stage in the project for future builds.</small></div>
    </section>}
  </header>;
}
