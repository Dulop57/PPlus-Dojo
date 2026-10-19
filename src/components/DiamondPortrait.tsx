import {useLayoutEffect,useRef,useState} from 'react';
import {panStageImage,type StageFraming,type StageImageGeometry} from '../data/stage-framing';
import {rosterImageGeometry,type RosterImageGeometry} from '../data/roster-framing';

export default function DiamondPortrait({image,framing,onChange,onGeometry}:{image:string;framing?:StageFraming;onChange?:(value:StageFraming)=>void;onGeometry?:(value:RosterImageGeometry)=>void}){
  const host=useRef<HTMLDivElement>(null);
  const [view,setView]=useState({width:0,height:0}),[source,setSource]=useState({width:0,height:0});
  const drag=useRef<{pointer:number;x:number;y:number;geometry:StageImageGeometry}|null>(null);
  const ready=view.width>0&&source.width>0;
  const geometry=rosterImageGeometry(ready?view:{width:1,height:1},ready?source:{width:1,height:1},framing);
  useLayoutEffect(()=>{if(ready)onGeometry?.(geometry);},[ready,geometry.width,geometry.height,geometry.x,geometry.y,geometry.scale,geometry.limitX,geometry.limitY,geometry.verticalUnit,onGeometry]);
  useLayoutEffect(()=>{const element=host.current!;const measure=()=>{drag.current=null;const bounds=element.getBoundingClientRect();setView({width:bounds.width,height:bounds.height});};measure();const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();},[]);
  return <div className={`roster-photo${onChange?' editable':''}`} ref={host} tabIndex={onChange?0:undefined} role={onChange?'button':undefined} aria-label={onChange?'Drag portrait to reposition':undefined}
    onKeyDown={event=>{if(!onChange||!ready)return;const directions:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};const direction=directions[event.key];if(direction){event.preventDefault();onChange(panStageImage(geometry,direction[0]*(event.shiftKey?10:2),direction[1]*(event.shiftKey?10:2)));}}}
    onPointerDown={event=>{if(!onChange||!ready||event.button!==0)return;event.preventDefault();event.currentTarget.focus();drag.current={pointer:event.pointerId,x:event.clientX,y:event.clientY,geometry};event.currentTarget.setPointerCapture(event.pointerId);}}
    onPointerMove={event=>{const start=drag.current;if(!start||start.pointer!==event.pointerId||!onChange)return;const next=panStageImage(start.geometry,event.clientX-start.x,event.clientY-start.y);start.geometry=rosterImageGeometry(view,source,next);start.x=event.clientX;start.y=event.clientY;onChange(next);}}
    onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}>
    <img src={image} alt="" draggable={false} onLoad={event=>setSource({width:event.currentTarget.naturalWidth,height:event.currentTarget.naturalHeight})} style={{width:geometry.width,height:geometry.height,left:geometry.left,top:geometry.top,visibility:ready?'visible':'hidden'}}/>
  </div>;
}
