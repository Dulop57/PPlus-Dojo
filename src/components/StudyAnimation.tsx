import {lazy,Suspense,useCallback,useEffect,useRef,useState} from 'react';
import {Pause,Play,ChevronLeft,ChevronRight,SkipBack,SkipForward,Repeat2,X} from 'lucide-react';
import {loadFighter,loadMove,loadPresentedMove} from '../data/loader';
import type {Manifest,MoveData} from '../data/types';
import type {StudyCard} from '../data/study-types';
import type {ViewerHandle} from '../viewer/CollisionViewer';
import FrameTimeline from './FrameTimeline';
const CollisionViewer=lazy(()=>import('../viewer/CollisionViewer'));
const layers={hit:true,hurt:true,collision:false,ledge:false,wireframe:false};

export default function StudyAnimation({card,manifest,onClose}:{card:StudyCard;manifest:Manifest|null;onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null),viewer=useRef<ViewerHandle|null>(null),liveFrame=useRef(0);
  const [move,setMove]=useState<MoveData|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const [frame,setFrame]=useState(0),[playing,setPlaying]=useState(false),[loop,setLoop]=useState(true),[speed,setSpeed]=useState(1);
  const total=move?.frames.length??0;
  useEffect(()=>{const element=dialog.current!;if(!element.open)element.showModal();},[]);
  useEffect(()=>{
    const abort=new AbortController();setMove(null);setError('');setPlaying(false);
    (async()=>{
      let path=card.hit?.path;
      const moveId=card.hit?.moveId??card.move?.id;
      if(!path){
        const entry=manifest?.fighters.find(f=>f.id===card.subjectId);
        if(!entry)throw new Error('Animation data is unavailable for this fighter.');
        const fighter=await loadFighter(entry.path,abort.signal);
        path=fighter.moves.find(m=>m.id===moveId)?.path;
      }
      if(!path)throw new Error('This move has no available animation.');
      const loaded=await (card.href.includes('view=raw')?loadMove(path,abort.signal):loadPresentedMove(path,abort.signal,manifest));
      if(loaded.fighterId!==card.subjectId||loaded.moveId!==moveId)throw new Error('The animation does not match this card.');
      if(!loaded.frames.length)throw new Error('This move has no extracted animation frames.');
      const start=Math.min(Math.max(0,(card.hit?.frame??1)-1),loaded.frames.length-1);
      liveFrame.current=start;setFrame(start);setMove(loaded);
    })().catch(e=>{if(!abort.signal.aborted)setError(e.message);});
    return()=>abort.abort();
  },[card,manifest,retry]);
  const seek=useCallback((value:number)=>{liveFrame.current=Math.min(Math.max(0,value),Math.max(0,total-1));setFrame(liveFrame.current);setPlaying(false);},[total]);
  useEffect(()=>{
    if(!playing||!total)return;
    let last=performance.now(),carry=0,id=0,lastUi=0;
    const tick=(time:number)=>{
      if(document.hidden){last=time;id=requestAnimationFrame(tick);return;}
      carry+=Math.min(time-last,250);last=time;
      const step=1000/(60*speed),count=Math.floor(carry/step);carry-=count*step;
      if(count){
        const next=liveFrame.current+count;
        if(next>=total&&!loop){liveFrame.current=total-1;viewer.current?.showFrame(total-1);setFrame(total-1);setPlaying(false);return;}
        liveFrame.current=next%total;viewer.current?.showFrame(liveFrame.current);
        if(time-lastUi>=1000/15){setFrame(liveFrame.current);lastUi=time;}
      }
      id=requestAnimationFrame(tick);
    };
    id=requestAnimationFrame(tick);return()=>cancelAnimationFrame(id);
  },[playing,total,loop,speed]);
  const toggle=()=>{if(playing){setFrame(liveFrame.current);setPlaying(false);}else{if(!loop&&liveFrame.current===total-1)seek(0);setPlaying(true);}};
  return <dialog className="study-animation-dialog" ref={dialog} aria-labelledby="study-animation-title" onClose={onClose} onClick={event=>{if(event.target===event.currentTarget){const bounds=event.currentTarget.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.current?.close();}}} onKeyDown={event=>{
    if((event.target as HTMLElement).closest('input,select,button,a'))return;
    if(event.code==='Space'){event.preventDefault();if(total)toggle();}
    if(event.code==='ArrowLeft'){event.preventDefault();seek(liveFrame.current-1);}
    if(event.code==='ArrowRight'){event.preventDefault();seek(liveFrame.current+1);}
  }}>
    <header><h2 id="study-animation-title">{card.subject} · {card.move?.name??card.hit?.internalName}</h2><button aria-label="Close animation" autoFocus onClick={()=>dialog.current?.close()}><X size={20}/></button></header>
    {error?<div className="study-animation-message" role="alert">{error} <button onClick={()=>setRetry(value=>value+1)}>Retry</button></div>:!move?<p className="study-animation-message" role="status">Loading animation…</p>:<>
      <div className="viewer-card"><Suspense fallback={<p className="study-animation-message">Loading viewer…</p>}><CollisionViewer ref={viewer} move={move} frame={frame} playing={playing} layers={layers}/></Suspense></div>
      {move.timing&&(move.timing.geometryRetimed||move.timing.missingGeometry)&&<p className="study-warning">{move.timing.missingGeometry?'Checked active timing; collision geometry is unavailable for this attack.':'Timing follows the checked sheet; collision poses are retimed from unverified extracted data.'}</p>}
      <div className="playback-panel">
        <div className="playback-top"><div className="playback-buttons"><button aria-label="First frame" onClick={()=>seek(0)}><SkipBack size={17}/></button><button aria-label="Previous frame" onClick={()=>seek(liveFrame.current-1)}><ChevronLeft size={19}/></button><button className="play-button" aria-label={playing?'Pause animation':'Play animation'} onClick={toggle}>{playing?<Pause size={20}/>:<Play size={20}/>}</button><button aria-label="Next frame" onClick={()=>seek(liveFrame.current+1)}><ChevronRight size={19}/></button><button aria-label="Last frame" onClick={()=>seek(total-1)}><SkipForward size={17}/></button></div><div className="frame-counter">FRAME <strong>{String(frame+1).padStart(2,'0')}</strong><span>/ {total}</span></div><div className="playback-options"><button aria-label="Loop animation" aria-pressed={loop} className={loop?'enabled':''} onClick={()=>setLoop(!loop)}><Repeat2 size={17}/></button><select aria-label="Playback speed" value={speed} onChange={event=>setSpeed(Number(event.target.value))}>{[.25,.5,1,2].map(value=><option key={value} value={value}>{value}×</option>)}</select></div></div>
        <input className="frame-slider" aria-label="Animation frame" type="range" min={1} max={total} value={frame+1} onChange={event=>seek(Number(event.target.value)-1)}/>
        <FrameTimeline move={move} frame={frame} onSeek={seek}/>
      </div>
    </>}
  </dialog>;
}
