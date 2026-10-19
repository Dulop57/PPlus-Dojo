import {memo,useEffect,useMemo,useRef} from 'react';
import type {MoveData} from '../data/types';
export default memo(function FrameTimeline({move,frame,onSeek}:{move:MoveData|null;frame:number;onSeek:(value:number)=>void}){
  const host=useRef<HTMLDivElement>(null),previous=useRef(-1);
  const bins=useMemo(()=>{
    if(!move)return [];
    const count=Math.min(240,move.frames.length),total=move.frames.length;
    return Array.from({length:count},(_,i)=>{
      const first=Math.floor(i*total/count),last=Math.floor((i+1)*total/count)-1;
      const frames=move.frames.slice(first,last+1);
      const checked=move.timing?.active;
      const active=checked?checked.some(([a,b])=>a<=last+1&&b>=first+1):frames.some(f=>f.hit_boxes.some(h=>!('Hit' in h.next_values)||h.next_values.Hit.enabled));
      return {first,last,kind:active?'active-frame':frames.some(f=>f.interruptible)?'interrupt-frame':''};
    });
  },[move]);
  const buttons=useMemo(()=>bins.map((bin,i)=><button key={i} className={bin.kind} aria-label={bin.first===bin.last?`Go to frame ${bin.first+1}`:`Go to frame ${bin.first+1} (frames ${bin.first+1}–${bin.last+1})`} title={bin.first===bin.last?`Frame ${bin.first+1}`:`Frames ${bin.first+1}–${bin.last+1}`} onClick={()=>onSeek(bin.first)}/>),[bins,onSeek]);
  useEffect(()=>{const children=host.current?.children;if(!children)return;children[previous.current]?.classList.remove('current-frame');const selected=bins.findIndex(b=>frame>=b.first&&frame<=b.last);children[selected]?.classList.add('current-frame');previous.current=selected;},[bins,frame]);
  return <div className="frame-strip" ref={host} aria-label="Frame timeline">{buttons}</div>;
});
