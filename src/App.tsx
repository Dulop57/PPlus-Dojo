import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowRight, BookOpen, Boxes, ChevronDown, ChevronRight, CircleHelp, Database, Download, ExternalLink, FlaskConical, Grid2X2, Info, Keyboard, LoaderCircle, Menu, Pause, Play, Repeat2, RotateCcw, Search, Settings2, SkipBack, SkipForward, Swords, X } from 'lucide-react';
import type { FighterData, Frame, Manifest, MoveData } from './data/types';
import { catalog, initials } from './data/catalog';
import { fighterGridImage } from './data/fighter-images';
const Roster=lazy(()=>import('./components/DiamondRoster'));

import { loadFighter, loadManifest, loadMove } from './data/loader';
import { categoryOrder, formatRanges, moveLabel, moveListCategory, smashStartFor, summarize } from './data/moves';
import {presentSmash} from './data/smash-sequences';
import { moveHref, parseRoute, useRoute, type Route } from './router';
import type { Layers,ViewerHandle } from './viewer/CollisionViewer';
import {dragdownPplusWiki,pplusGoogleDocsArchive} from './data/external-links';
const CollisionViewer = lazy(() => import('./viewer/CollisionViewer'));
const HitCalculators = lazy(() => import('./components/HitCalculators'));
const OtherResources = lazy(() => import('./components/OtherResources'));
const AttributeReference = lazy(() => import('./components/AttributeReference'));
const StageReference = lazy(() => import('./components/StageReference'));
const Study = lazy(() => import('./components/Study'));
const Compendium=lazy(()=>import('./components/Compendium'));
import { sandboxMove } from './data/sandbox';
import FrameTimeline from './components/FrameTimeline';
import AccountControls from './components/AccountControls';
import type {DesktopInfo} from './desktop';

const brandLogo=new URL('../Images/project-plus-assets-master/logos/v3/long.png',import.meta.url).href;
const glossary = [
  ['Startup','The first displayed frame with an enabled hitbox or grabbox. Throws use the first throw event.'],
  ['Active frames','Frames with an enabled collision hitbox or grabbox. Separate windows are preserved.'],
  ['IASA','Interruptible As Soon As: the first frame a subaction can be interrupted. This is separate from animation length.'],
  ['KBG','Knockback growth: how much knockback scales with the opponent’s damage.'],
  ['BKB','Base knockback: the fixed component of the hitbox’s knockback.'],
  ['WDSK','Weight-dependent set knockback, preserved from the parser.'],
  ['Autocancel','Frames when an aerial landing does not apply the move’s special landing lag.'],
  ['L-cancel','Successful L-cancel landing lag: regular landing lag divided by two and rounded down.'],
  ['Angle 361','Sakurai angle: 361 is a special code that chooses the launch angle based on the victim’s grounded/airborne state and knockback.\nGrounded: below 32 knockback, the hit sends sideways at 0° and keeps the victim in grounded hitstun without tumbling; at 32 knockback or higher, it launches diagonally upward at 44°.\nAirborne: the launch angle is 45° regardless of knockback.\nThe 32 threshold measures knockback, not damage or the victim’s percent.'],
];
function Loading({text='Loading data…'}:{text?:string}) {return <div className="loading-state" role="status"><LoaderCircle className="spin" size={22}/>{text}</div>;}
function ErrorNote({message,retry}:{message:string;retry?:()=>void}) {return <div className="error-note" role="alert"><Info size={20}/><div><strong>Data unavailable</strong><p>{message}</p></div>{retry&&<button className="button secondary" onClick={retry}>Retry</button>}</div>;}

export default function App({desktop=null}:{desktop?:DesktopInfo|null}) {
  const route=useRoute();
  const [manifest,setManifest]=useState<Manifest|null>(null),[pending,setPending]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0),[mobileMenu,setMobileMenu]=useState(false);
  const [sectionHashes,setSectionHashes]=useState<Record<string,string>>(()=>({[route.page]:location.hash||`#/${route.page}`}));
  const [visitedPages,setVisitedPages]=useState(()=>new Set([route.page]));
  useEffect(()=> {
    const abort=new AbortController();setPending(true);setError('');
    loadManifest(abort.signal).then(setManifest).catch(e=>{if(!abort.signal.aborted)setError(e.message);}).finally(()=>{if(!abort.signal.aborted)setPending(false);});
    return ()=>abort.abort();
  },[revision]);
  useEffect(()=>{
    const hash=location.hash||`#/${route.page}`;
    setSectionHashes(current=>current[route.page]===hash?current:{...current,[route.page]:hash});
    setVisitedPages(current=>current.has(route.page)?current:new Set(current).add(route.page));
  },[route]);
  const sectionRoute=(page:string)=>route.page===page?route:parseRoute(sectionHashes[page]??`#/${page}`);
  const sectionHref=(page:string)=>route.page===page&&location.hash?location.hash:sectionHashes[page]??`#/${page}`;
  const rememberCurrentSection=()=>{const hash=location.hash||`#/${route.page}`;setSectionHashes(current=>current[route.page]===hash?current:{...current,[route.page]:hash});};
  const hasVisited=(page:string)=>visitedPages.has(page)||route.page===page;
  const fightersRoute=sectionRoute('fighters');
  const scrollTarget=route.page==='stages'?`stages/${route.moveId??''}`:`${route.page}/${route.fighterId??''}/${route.moveId??''}`;
  useEffect(()=>{setMobileMenu(false);},[scrollTarget]);
  useEffect(()=>{if(route.page==='attributes'&&route.fighterId==='Other Resources')location.replace('#/resources');},[route.page,route.fighterId]);
  return <div className={`app-shell ${route.page==='fighters'&&!route.fighterId?'roster-app':route.page==='compendium'?'compendium-app':route.page==='study'?'study-app':route.page==='stages'?'stage-app':route.page==='attributes'?'attribute-app':route.page==='fighters'&&route.fighterId?'fighter-app':''}`}>
    <a className="skip-link" href="#main" onClick={event=>{event.preventDefault();document.getElementById('main')?.focus();}}>Skip to content</a>
    <aside className={`sidebar ${mobileMenu?'open':''}`}>
      <a className="brand" href={sectionHref('fighters')} onClick={rememberCurrentSection}><img className="brand-logo" src={brandLogo} alt=""/><span className="brand-name">DOJO!</span></a>
      <div className="nav-label">EXPLORE</div>
      <nav aria-label="Main navigation">
        <a className={route.page==='fighters'?'active':''} href="#/fighters" onClick={rememberCurrentSection}><Grid2X2 size={18}/>Fighters</a>
        <a className={route.page==='attributes'?'active':''} href={sectionHref('attributes')} onClick={rememberCurrentSection}><Activity size={18}/>Attributes</a>
        <a className={route.page==='stages'?'active':''} href={sectionHref('stages')} onClick={rememberCurrentSection}><Boxes size={18}/>Stages</a>
        <a className={route.page==='study'?'active':''} href={sectionHref('study')} onClick={rememberCurrentSection}><BookOpen size={18}/>Study</a>
        <a className={route.page==='compendium'?'active':''} href={sectionHref('compendium')} onClick={rememberCurrentSection}><Database size={18}/>Compendium</a>
      </nav>
      <div className="nav-label extra-label">EXTRA</div>
      <nav aria-label="Extra"><a href={dragdownPplusWiki} target="_blank" rel="noreferrer"><ExternalLink size={18}/>Dragdown P+ Wiki</a><a href={pplusGoogleDocsArchive} target="_blank" rel="noreferrer"><BookOpen size={18}/>Other resources</a><a className={route.page==='about'?'active':''} href={sectionHref('about')} onClick={rememberCurrentSection}><CircleHelp size={18}/>About the project</a><a href="https://github.com/Dulop57/pplus-dojo-releases/releases" target="_blank" rel="noreferrer"><Download size={18}/>Download for Windows</a></nav>
      <div className="sidebar-bottom"><AccountControls desktop={desktop}/><div className="sidebar-footer"><span className={`status-dot ${manifest?'ready':''}`}/>{manifest?'P+ 3.2 · Local dataset':'P+ 3.2 · Data pending'}<span>v{desktop?.version??'0.2'}</span></div></div>
    </aside>
    {mobileMenu&&<button className="mobile-backdrop" aria-label="Close menu" onClick={()=>setMobileMenu(false)}/>}
    <div className="main-shell">
      <header className="topbar"><button className="mobile-menu icon-button" aria-label={mobileMenu?'Close navigation':'Open navigation'} onClick={()=>setMobileMenu(!mobileMenu)}>{mobileMenu?<X size={21}/>:<Menu size={21}/>}</button></header>
      <main id="main" tabIndex={-1}>
        {hasVisited('fighters')&&<div hidden={route.page!=='fighters'}><Suspense fallback={<Loading/>}>{fightersRoute.fighterId?<FighterLab route={fightersRoute} manifest={manifest} manifestPending={pending} manifestError={error}/>:<Roster manifest={manifest} pending={pending} error={error} retry={()=>setRevision(r=>r+1)}/>}</Suspense></div>}
        {hasVisited('sandbox')&&<div hidden={route.page!=='sandbox'}><Sandbox route={sectionRoute('sandbox')}/></div>}
        {hasVisited('attributes')&&<div hidden={route.page!=='attributes'}><Suspense fallback={<Loading/>}><AttributeReference route={sectionRoute('attributes')}/></Suspense></div>}
        {hasVisited('stages')&&<div hidden={route.page!=='stages'}><Suspense fallback={<Loading/>}><StageReference route={sectionRoute('stages')}/></Suspense></div>}
        {hasVisited('resources')&&<div hidden={route.page!=='resources'}><Suspense fallback={<Loading/>}><OtherResources/></Suspense></div>}
        {hasVisited('about')&&<div hidden={route.page!=='about'}><About/></div>}
        {hasVisited('study')&&<div hidden={route.page!=='study'}><Suspense fallback={<Loading/>}><Study manifest={manifest} route={sectionRoute('study')}/></Suspense></div>}
        {hasVisited('compendium')&&<div hidden={route.page!=='compendium'}><Suspense fallback={<Loading/>}><Compendium route={sectionRoute('compendium')}/></Suspense></div>}
        {!['fighters','attributes','stages','sandbox','about','study','compendium','resources'].includes(route.page)&&<div className="document-page"><h1>Page not found</h1><a className="button primary" href="#/fighters">Return to fighters</a></div>}
      </main>
    </div>
  </div>;
}

function FighterLab({route,manifest,manifestPending,manifestError}:{route:Route;manifest:Manifest|null;manifestPending:boolean;manifestError:string}) {
  const index=manifest?.fighters.find(f=>f.id===route.fighterId), guide=catalog.find(f=>f.id===route.fighterId);
  const [fighter,setFighter]=useState<FighterData|null>(null),[move,setMove]=useState<MoveData|null>(null),[loading,setLoading]=useState(false),[moveLoading,setMoveLoading]=useState(false),[error,setError]=useState(''),[moveError,setMoveError]=useState(''),[query,setQuery]=useState(''),[tab,setTab]=useState('moves'),[retry,setRetry]=useState(0),[openMoveGroups,setOpenMoveGroups]=useState<Set<string>>(()=>new Set()),[movePickerOpen,setMovePickerOpen]=useState(false),[wideMoveList,setWideMoveList]=useState(()=>window.matchMedia('(min-width: 1100px)').matches);
  const movePickerTrigger=useRef<HTMLButtonElement|null>(null),movePickerSearch=useRef<HTMLInputElement|null>(null),movePickerPanel=useRef<HTMLDivElement|null>(null);
  useEffect(()=> {
    const abort=new AbortController();setFighter(null);setError('');
    if(!index)return;
    setLoading(true);loadFighter(index.path,abort.signal).then(setFighter).catch(e=>{if(!abort.signal.aborted)setError(e.message);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
    return ()=>abort.abort();
  },[index?.path,retry]);
  const selected=fighter?.moves.find(m=>m.id===route.moveId)??(!route.moveId?fighter?.moves.find(m=>m.totalFrames>0&&m.internalName.startsWith('Attack')):undefined)??(!route.moveId?fighter?.moves[0]:undefined);
  useEffect(()=>{const media=window.matchMedia('(min-width: 1100px)'),sync=()=>setWideMoveList(media.matches);sync();media.addEventListener('change',sync);return()=>media.removeEventListener('change',sync);},[]);
  useEffect(()=>{if(wideMoveList)setOpenMoveGroups(new Set());},[wideMoveList]);
  useEffect(()=>{if(wideMoveList||!selected||!fighter)return;const category=moveListCategory(selected.internalName);setOpenMoveGroups(current=>current.has(category)?current:new Set(current).add(category));},[wideMoveList,fighter?.id,selected?.id]);
  const smashStart=selected&&fighter?smashStartFor(selected,fighter.moves,fighter.id):undefined;
  useEffect(()=> {
    const abort=new AbortController();setMove(null);setMoveError('');setMoveLoading(false);
    if(!selected)return;
    const read=smashStart&&fighter&&route.view!=='raw'?presentSmash(fighter,selected,path=>loadMove(path,abort.signal)):loadMove(selected.path,abort.signal);
    setMoveLoading(true);read.then(setMove).catch(e=>{if(!abort.signal.aborted)setMoveError(e.message);}).finally(()=>{if(!abort.signal.aborted)setMoveLoading(false);});
    return ()=>abort.abort();
  },[selected?.path,smashStart?.path,route.view,retry]);
  useEffect(()=>{setQuery('');setTab('moves');setMovePickerOpen(false);},[route.fighterId]);
  useEffect(()=>{setTab('moves');setMovePickerOpen(false);},[route.moveId]);
  const grouped=useMemo(()=>categoryOrder.map(category=>({category,moves:(fighter?.moves??[]).filter(m=>{const label=moveLabel(m.internalName,fighter?.id);return moveListCategory(m.internalName)===category&&`${label.name} ${label.alias} ${m.internalName}`.toLowerCase().includes(query.toLowerCase());})})).filter(g=>g.moves.length),[fighter,query]);
  const displayName=fighter?.name??index?.name??guide?.name??route.fighterId;
  const gridPortrait=fighterGridImage(route.fighterId??'',displayName??'');
  const fighterPending=manifestPending||loading||!!(index&&!fighter&&!error);
  const closeMovePicker=useCallback(()=>{setMovePickerOpen(false);requestAnimationFrame(()=>movePickerTrigger.current?.focus());},[]);
  useEffect(()=>{if(!movePickerOpen)return;const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';movePickerSearch.current?.focus();const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();closeMovePicker();return;}if(event.key==='Tab'&&movePickerPanel.current){const focusable=[...movePickerPanel.current.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href]')].filter(element=>element.offsetParent!==null);if(!focusable.length)return;const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}};window.addEventListener('keydown',key);return()=>{window.removeEventListener('keydown',key);document.body.style.overflow=previousOverflow;};},[movePickerOpen,closeMovePicker]);
  return <div className="lab-page"><div className="lab-layout">
    <aside className={`move-sidebar${movePickerOpen?' move-picker-active':''}`}>
      <div className="fighter-heading"><div className="fighter-heading-icon">{gridPortrait?<img src={gridPortrait} alt=""/>:initials(displayName??'')}</div><div className="fighter-heading-text"><span className="eyebrow muted">{guide?.series??'PROJECT+ FIGHTER'}</span><h1>{displayName}</h1><span className="fighter-heading-sub">{fighter?`${fighter.moves.length} subactions`:'Awaiting import'} <span>·</span> P+ 3.2</span></div></div>
      <div className="page-tabs"><button className={tab==='moves'?'selected':''} onClick={()=>setTab('moves')}><Swords size={14}/>Moves & frames</button><button aria-label="Fighter attributes" className={tab==='attributes'?'selected':''} onClick={()=>{setTab('attributes');setMovePickerOpen(false);}}><Activity size={14}/>Attributes</button></div>
      {fighter&&!fighterPending&&!error&&<div className="fighter-tab-content" hidden={tab!=='moves'} style={{display:tab==='moves'?undefined:'none'}}>
        <button ref={movePickerTrigger} type="button" className="move-picker-trigger" aria-expanded={movePickerOpen} aria-controls="move-picker-panel" onClick={()=>setMovePickerOpen(true)}><Search size={16}/><span><strong>Select move</strong><small>{selected?moveLabel(selected.internalName,fighter.id).name:'Choose a move'}</small></span><small className="move-picker-count">{fighter.moves.length}</small><ChevronDown size={15}/></button>
        <div ref={movePickerPanel} id="move-picker-panel" className={`move-list-panel${movePickerOpen?' is-open':''}`} role={movePickerOpen?'dialog':undefined} aria-modal={movePickerOpen||undefined} aria-labelledby="move-picker-heading">
          <div className="move-sidebar-title"><h2 id="move-picker-heading">Move list</h2><span>{fighter.moves.length}</span><button type="button" className="move-picker-close" aria-label="Close move selector" onClick={closeMovePicker}><X size={20}/></button></div>
          <div className="move-search"><Search size={15}/><input ref={movePickerSearch} value={query} onChange={e=>setQuery(e.target.value)} aria-label="Search moves" placeholder="Move name, nair, ID…"/></div>
          <div className="move-groups">{grouped.map(group=>{const expanded=openMoveGroups.has(group.category),groupId=`move-group-${group.category.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;return <section key={group.category} className={expanded?'is-open':''}><h3>{group.category}</h3><button type="button" className="move-group-toggle" aria-label={`Toggle ${group.category}`} aria-expanded={expanded} aria-controls={groupId} onClick={()=>setOpenMoveGroups(current=>{const next=new Set(current);if(next.has(group.category))next.delete(group.category);else next.add(group.category);return next;})}><span>{group.category}</span><small>{group.moves.length}</small><ChevronDown size={14} aria-hidden="true"/></button><div className="move-group-items" id={groupId}>{group.moves.map(m=><a key={m.id} className={m.id===selected?.id?'selected':''} href={moveHref(fighter.id,m.id)} onClick={closeMovePicker}><span>{moveLabel(m.internalName,fighter?.id).name}<small>{m.internalName}</small></span><ChevronRight size={13}/></a>)}</div></section>})}{!grouped.length&&<p className="small-empty">No matching subactions.</p>}</div>
        </div>
      </div>}
    </aside>
    <div className="move-content">
      {fighterPending?<Loading/>:error?<ErrorNote message={error} retry={()=>setRetry(v=>v+1)}/>:!index?<div className="no-data-panel"><Database size={36}/><h2>{guide?'This fighter’s data is not imported yet':'Fighter not found in the dataset'}</h2><p>{manifestError||'Generate a fresh P+ v3.2 dataset to see fighter attributes, moves, and collision animations.'}</p><a href="#/sandbox" className="text-link">Try the synthetic viewer sandbox</a></div>:<>
        <div className="move-panel" hidden={tab==='attributes'} style={{display:tab==='moves'?undefined:'none'}}>
          {moveLoading&&<Loading text="Loading animation frames…"/>}
          {moveError?<ErrorNote message={moveError} retry={()=>setRetry(v=>v+1)}/>:route.moveId&&!selected?<ErrorNote message="This move is not present in the imported fighter index."/>:<MovePanel move={move} route={route} fighterId={fighter!.id} manifest={manifest} attacker={fighter} internalName={selected?.internalName??''}/>}
        </div>
        <div hidden={tab!=='attributes'} style={{display:tab==='attributes'?undefined:'none'}}><Attributes fighter={fighter}/></div>
      </>}
    </div>
  </div></div>;
}

function MovePanel({move,route,fighterId,internalName,manifest=null,attacker=null,synthetic=false}:{move:MoveData|null;route:Route;fighterId:string;internalName:string;manifest?:Manifest|null;attacker?:FighterData|null;synthetic?:boolean}) {
  const [frame,setFrame]=useState(0),[playing,setPlaying]=useState(false),[loop,setLoop]=useState(true),[speed,setSpeed]=useState(1);
  const [layers,setLayers]=useState<Layers>({hit:true,hurt:true,collision:false,ledge:false,wireframe:false});
  const [selectedBubble,setSelectedBubble]=useState<{move:MoveData;id:number;set:number}|null>(null);
  useEffect(()=>{setSelectedBubble(null);},[move]);
  const liveFrame=useRef(0),viewerRef=useRef<ViewerHandle|null>(null);
  const total=move?.frames.length??0;
  useEffect(()=>{const selected=Math.min(Math.max(0,route.frame-1),Math.max(0,total-1));liveFrame.current=selected;setFrame(selected);setPlaying(false);},[move,route.frame,total]);
  useEffect(()=> {
    if(!move||total===0)return;
    // A late frame/load effect must not overwrite a navigation that has already
    // changed the URL but has not committed its React render yet.
    const destination=parseRoute(location.hash);
    if(synthetic?destination.page!=='sandbox':destination.page!=='fighters'||destination.fighterId!==fighterId||(destination.moveId&&destination.moveId!==move.moveId)||destination.view!==route.view)return;
    const hash=synthetic?`#/sandbox?frame=${frame+1}`:moveHref(fighterId,move.moveId,frame+1,route.view);
    if(location.hash!==hash)history.replaceState(null,'',`${location.pathname}${location.search}${hash}`);
  },[frame,move,fighterId,synthetic,total,route.view]);
  useEffect(()=> {
    if(!playing||!total)return;
    let last=performance.now(),carry=0,id=0,lastUi=0;
    const tick=(time:number)=> {
      if(document.hidden){last=time;id=requestAnimationFrame(tick);return;}
      carry+=Math.min(time-last,250);last=time;
      const step=1000/(60*speed),count=Math.floor(carry/step);carry-=count*step;
      if(count){const next=liveFrame.current+count;if(next>=total&&!loop){liveFrame.current=total-1;viewerRef.current?.showFrame(total-1);setFrame(total-1);setPlaying(false);return;}liveFrame.current=next%total;viewerRef.current?.showFrame(liveFrame.current);if(time-lastUi>=1000/15){setFrame(liveFrame.current);lastUi=time;}}
      id=requestAnimationFrame(tick);
    };
    id=requestAnimationFrame(tick);return()=>cancelAnimationFrame(id);
  },[playing,total,speed,loop]);
  const seek=useCallback((value:number)=>{const selected=Math.min(Math.max(0,value),Math.max(0,total-1));liveFrame.current=selected;setPlaying(false);setFrame(selected);},[total]);
  function togglePlay(){if(!total)return;if(playing){setFrame(liveFrame.current);setPlaying(false);return;}if(!loop&&liveFrame.current===total-1){liveFrame.current=0;setFrame(0);}setPlaying(true);}
  useEffect(()=> {
    const key=(e:KeyboardEvent)=>{const target=e.target as HTMLElement;if(target.closest('input,textarea,select,button,a,[contenteditable]'))return;
      if(e.code==='Space'){e.preventDefault();togglePlay();}if(e.code==='ArrowRight'){e.preventDefault();seek(liveFrame.current+1);}if(e.code==='ArrowLeft'){e.preventDefault();seek(liveFrame.current-1);}if(e.code==='Home'){e.preventDefault();seek(0);}if(e.code==='End'){e.preventDefault();seek(total-1);}};
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  });
  const summary=useMemo(()=>move?summarize(move):null,[move]), current=move?.frames[frame];
  const selectedHitboxIndex=selectedBubble?.move===move?current?.hit_boxes.findIndex(box=>'Hit' in box.next_values&&box.next_values.Hit.enabled&&box.hitbox_id===selectedBubble.id&&box.next_values.Hit.set_id===selectedBubble.set):undefined;
  const selectedHitbox=selectedHitboxIndex!==undefined&&selectedHitboxIndex>=0?current?.hit_boxes[selectedHitboxIndex]:undefined;
  const selectedHit=selectedHitbox&&'Hit' in selectedHitbox.next_values?selectedHitbox.next_values.Hit:null;
  const selectHitbox=(index:number|null,contactFrame=frame)=>{
    if(index===null){seek(contactFrame);setSelectedBubble(null);return;}
    const box=move?.frames[contactFrame]?.hit_boxes[index];
    if(!move||!box||!('Hit' in box.next_values)||!box.next_values.Hit.enabled)return;
    seek(contactFrame);setSelectedBubble({move,id:box.hitbox_id,set:box.next_values.Hit.set_id});
  };
  return <>
    <div className="move-heading">
      <div className="move-heading-main">
      <div><span className="eyebrow muted">{synthetic?'SYNTHETIC TEST GEOMETRY':moveListCategory(internalName).toUpperCase()}</span><h2>{synthetic?'Collision fixture':moveLabel(internalName,route.view==='raw'?undefined:fighterId).name}</h2><code>{synthetic?'Not Project+ game data':internalName}</code></div>
      </div>
      {summary&&!synthetic&&<div className="move-summary-compact" aria-label="Move summary">
        {[
          {label:'Startup',value:summary.startup===null?'None':`${summary.startup}f`,title:glossary[0][1]},
          {label:'Active',value:formatRanges(summary.active),title:glossary[1][1]},
          {label:'Total',value:`${summary.total}f`,title:'Total animation length'},
          {label:move?.timing?'Actionable':'IASA',value:summary.iasa===null?'None':`${summary.iasa}f`,title:move?.timing?'First actionable frame from the checked smash sheet':glossary[2][1]},
          {label:'Damage',value:summary.damage?(summary.damage[0]===summary.damage[1]?`${summary.damage[0]}%`:`${summary.damage[0]}–${summary.damage[1]}%`):'N/A',title:'Per-hitbox damage range'},
          {label:'Landing lag',value:move!.landing_lag===null?'N/A':`${move!.landing_lag}f`,title:'Regular landing lag before L-cancelling'},
          {label:'Autocancel',value:summary.autocancel===null?'N/A':formatRanges(summary.autocancel),title:'Autocancel windows'},
          {label:'L-cancel',value:summary.lcancel===null?'N/A':`${summary.lcancel}f`,title:'L-cancel landing lag'},
          {label:'Invincible',value:formatRanges(summary.invincible),title:'Fully invincible'},
          {label:'Intangible',value:formatRanges(summary.intangible),title:'Fully intangible'},
        ].map(item=><div className="move-summary-item" key={item.label} title={item.title}><span>{item.label}</span><strong>{item.value}</strong></div>)}
      </div>}
    </div>
    <div className="move-view-hitbox-layout">
      <div className="viewer-card move-viewer-card"><Suspense fallback={<Loading text="Loading collision viewer…"/>}><CollisionViewer ref={viewerRef} move={move} frame={frame} layers={layers} playing={playing} selectedHitboxIndex={selectedHitbox?selectedHitboxIndex:undefined} onHitboxSelect={selectHitbox}/></Suspense></div>
      <div className="viewer-card viewer-controls-card"><div className="playback-panel"><div className="playback-top"><div className="playback-buttons"><button aria-label="First frame" disabled={!total} onClick={()=>seek(0)}><SkipBack size={17}/></button><button aria-label="Previous frame" disabled={!total||frame===0} onClick={()=>seek(liveFrame.current-1)}><ChevronRight className="flip" size={18}/></button><button className="play-button" aria-label={playing?'Pause animation':'Play animation'} disabled={!total} onClick={togglePlay}>{playing?<Pause size={18}/>:<Play size={18} fill="currentColor"/>}</button><button aria-label="Next frame" disabled={!total||frame===total-1} onClick={()=>seek(liveFrame.current+1)}><ChevronRight size={18}/></button><button aria-label="Last frame" disabled={!total} onClick={()=>seek(total-1)}><SkipForward size={17}/></button></div><div className="frame-counter">FRAME <strong>{total?String(frame+1).padStart(2,'0'):'—'}</strong><span>/ {total||'—'}</span></div><div className="playback-options"><button aria-label="Loop animation" aria-pressed={loop} className={loop?'enabled':''} onClick={()=>setLoop(!loop)}><Repeat2 size={17}/></button><select aria-label="Playback speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[.25,.5,1,2].map(s=><option key={s} value={s}>{s}×</option>)}</select></div></div>
        <input className="frame-slider" aria-label="Animation frame" type="range" min={1} max={Math.max(1,total)} value={frame+1} disabled={!total} onChange={e=>seek(Number(e.target.value)-1)}/>
        <FrameTimeline move={move} frame={frame} onSeek={seek}/>
        <div className="timeline-legend"><span><i className="legend-active"/>Active</span><span><i className="legend-interrupt"/>Interruptible</span><span className="keyboard-hint"><Keyboard size={13}/>Space to play · ← → to step</span></div>
      </div><div className="layer-controls"><span><Settings2 size={15}/>Layers</span>{([['hit','Hitboxes'],['hurt','Hurtboxes'],['collision','Collision'],['ledge','Ledge grab'],['wireframe','Wireframe']] as const).map(([key,label])=><label key={key}><input type="checkbox" checked={layers[key]} onChange={e=>setLayers({...layers,[key]:e.target.checked})}/><span className={`layer-dot ${key}`}/>{label}</label>)}</div></div>
      {current&&<FrameDetails current={current} frame={frame} synthetic={synthetic} selectedHitboxIndex={selectedHitboxIndex} onHitboxSelect={selectHitbox}/>}
      {!synthetic&&<div className="calculation-panels"><Suspense fallback={<Loading text="Loading hitbubble calculators…"/>}><HitCalculators hit={selectedHit} hitId={selectedHitbox?.hitbox_id} manifest={manifest} attacker={attacker} move={move} frame={frame} internalName={internalName}/></Suspense></div>}
    </div>
    {move?.warnings.filter(w=>!w.startsWith('Smash timing:')).map(w=><div key={w} className="parser-warning"><Info size={16}/>{w}</div>)}
    {total===0&&move&&<ErrorNote message="This subaction has no extracted animation frames. Playback is disabled."/>}
  </>;
}
function FrameDetails({current,frame,synthetic,selectedHitboxIndex,onHitboxSelect}:{current:Frame;frame:number;synthetic:boolean;selectedHitboxIndex?:number;onHitboxSelect:(index:number)=>void}) {
  const activeHits=current.hit_boxes.map((h,index)=>({h,index})).filter(({h})=>!('Hit' in h.next_values)||h.next_values.Hit.enabled);
  return <section className="hitbox-section">
    <div className="section-heading compact"><div><span className="eyebrow muted">{synthetic?'FIXTURE VALUES ONLY':'CURRENT FRAME'}</span><h3>Collision details <span>{activeHits.length}</span></h3></div><span className="frame-label">FRAME {frame+1}</span></div>
    <div className="table-scroll"><table><thead><tr><th>ID / type</th><th>Damage</th><th>Angle</th><th title={glossary[3][1]}>KBG</th><th title={glossary[4][1]}>BKB</th><th title={glossary[5][1]}>WDSK</th><th>Radius</th></tr></thead><tbody>
      {activeHits.map(({h,index})=>{const v='Hit' in h.next_values?h.next_values.Hit:null;const id=<span className="hitbox-id"><i style={{background:['#ff8a65','#ff4e69','#cc86ff','#63dbe6','#c1f17a'][h.hitbox_id%5]}}/>{h.hitbox_id} <small>{v?'Hit':'Grab'}</small></span>;
        return <tr key={`${h.hitbox_id}-${index}`} className={v?`selectable-hitbox ${index===selectedHitboxIndex?'selected-hitbox':''}`:undefined} onClick={v?()=>onHitboxSelect(index):undefined}><td>{v?<button className="hitbox-select" aria-label={`Select hitbubble ${h.hitbox_id}`} aria-pressed={index===selectedHitboxIndex}>{id}</button>:id}</td><td>{v?`${v.damage}%`:'N/A'}</td><td>{v?(v.trajectory===361?<abbr title={glossary[8][1]}>361°</abbr>:`${v.trajectory}°`):'N/A'}</td><td>{v?.kbg??'N/A'}</td><td>{v?.bkb??'N/A'}</td><td>{v?.wdsk??'N/A'}</td><td>{h.next_size.toFixed(2)}</td></tr>;
      })}
      {current.throw&&<tr><td>Throw event</td><td>{current.throw.damage}%</td><td>{`${current.throw.trajectory}°`}</td><td>{current.throw.kbg}</td><td>{current.throw.bkb}</td><td>{current.throw.wdsk}</td><td>N/A</td></tr>}
    </tbody></table>{!activeHits.length&&!current.throw&&<div className="no-hitboxes">No active hitboxes or throw events on this frame.</div>}</div>
    <div className="frame-extra"><span>Movement <b>Z {current.x_pos.toFixed(2)} / Y {current.y_pos.toFixed(2)}</b></span><span>Hurtboxes <b>{current.hurt_boxes.length}</b></span><span>States <b>{[...new Set(current.hurt_boxes.map(h=>h.state))].join(', ')||'None'}</b></span></div>
    {current.hit_boxes.some(h=>'Hit' in h.next_values)&&<details className="raw-values"><summary>More hitbox properties</summary>{current.hit_boxes.map((h,i)=><div key={i}><strong>Collision {h.hitbox_id}</strong><dl>{Object.entries('Hit' in h.next_values?h.next_values.Hit:h.next_values.Grab).map(([key,value])=><div key={key}><dt>{key.replaceAll('_',' ')}</dt><dd>{typeof value==='object'?JSON.stringify(value):String(value)}</dd></div>)}</dl></div>)}</details>}
  </section>;
}
function Attributes({fighter}:{fighter:FighterData|null}) {return <section className="attributes-section"><h2>Fighter attributes</h2><p>Constants extracted directly from the fighter files. Labels preserve the parser’s field names.</p><div className="attributes-grid">{Object.entries(fighter?.attributes??{}).map(([key,value])=><div key={key}><span>{key.replaceAll('_',' ')}</span><strong>{typeof value==='object'?JSON.stringify(value):String(value)}</strong></div>)}</div></section>;}
function Sandbox({route}:{route:Route}) {return <div className="sandbox-page"><div className="eyebrow muted">TOOLS / VIEWER SANDBOX</div><h1>A place to test the controls.</h1><p className="page-intro">This isolated fixture uses synthetic shapes to exercise playback and rendering. It contains no fighter animations or Project+ statistics.</p><div className="sandbox-warning"><FlaskConical size={18}/><strong>SYNTHETIC FIXTURE</strong><span>Not game data. Values below exist only to test the viewer.</span></div><MovePanel move={sandboxMove} route={route} fighterId="synthetic" internalName="Collision fixture" synthetic/></div>;}

function About(){return <article className="document-page about-page">
  <span className="eyebrow muted">ABOUT P+ DOJO</span>
  <h1>Your guide to Project+.</h1>
  <p className="page-intro">Look up moves and stats, explore stages, or practice with flashcards. P+ Dojo is an independent Project+ guide for the web and Windows.</p>
  <div className="glossary-grid about-guide">
    <section><h2><a href="#/fighters">Find a fighter</a></h2><p>Pick a fighter to see their moves and frame data. Play the animation, show or hide collision layers, and select a hitbubble to try the knockback and ASDI down calculators.</p></section>
    <section><h2><a href="#/attributes">Compare fighter stats</a></h2><p>Compare stats, rankings, and charts. Use the tabs to browse movement, jumps, grab timings, and more.</p></section>
    <section><h2><a href="#/stages">Explore stages</a></h2><p>See stage sizes, blast zones, and camera bounds. Platform info is coming soon.</p></section>
    <section><h2><a href="#/study">Practice with flashcards</a></h2><p>Choose a deck, fighter or stage, and topic. Browse cards without changing your schedule, or review cards that are due. Try to recall the answer, reveal it, then rate how hard it was. FSRS uses your ratings to plan the next review.</p><p>Move cards can show their animation. In Scheduling, backups &amp; export, set daily limits, back up or restore your progress, or export cards for Anki. Anki keeps its own schedule.</p></section>
    <section><h2><a href="#/compendium">See what you know</a></h2><p>Check your progress for each fighter and stage, pin favorites, and jump to their cards. Activity &amp; practice shows your streaks, upcoming reviews, tricky topics, and cards you often miss.</p></section>
    <section><h2><a href={pplusGoogleDocsArchive} target="_blank" rel="noreferrer">P+ Google Docs Archive</a></h2><p>Browse the community archive for Project+ guides and references. You can also find the Dragdown P+ Wiki in the sidebar.</p></section>
  </div>
  <section className="guide-note about-essentials"><h2>Your progress &amp; offline access</h2>
    <p>Your progress is saved on this device. Sign in through Account &amp; app in the sidebar to sync between the website and Windows. Reviews you make offline will sync when you’re back online. Guest progress and account progress stay separate. Use Copy guest progress into this account to bring your guest reviews into your account.</p>
    <p>On the website, reference files download as you open them. To save everything for offline use, choose Download all for offline use while you’re online. You can clear downloaded files without deleting study progress. Browser storage can be cleared, so keep a backup.</p>
    <p>Preload all data is optional and off by default. It can use several gigabytes of memory. In the browser, choose Update webpage when it’s offered. In Windows, choose Check for updates and install the update when it’s ready.</p>
  </section>
  <section className="guide-note"><h2>Data &amp; accuracy</h2><p>Game data was extracted from rukaidata and the P+ Attributes spreadsheet. If you see any error please contact Dulop in the <a href="https://discord.gg/bpWW4vvNx" target="_blank" rel="noreferrer">P+ Discord server</a> so we can fix it.</p></section>
  <section className="guide-note"><h2>What’s next?</h2><ul><li>Adding platforms to the Stage viewer.</li><li>Add special attack cards to study.</li><li>Add olimar data for each pikmin.</li><li>Fix bugs, erroneous data, etc.</li></ul></section>
  <section className="guide-note about-credits"><h2>Credits &amp; sources</h2>
    <p>Fighter portraits, stock icons, and stage images were obtained from the <a href="https://dragdown.wiki/wiki/PPlus" target="_blank" rel="noreferrer">Dragdown P+ Wiki</a>. Check each image's file page for its history and copyright notice; uploaders are not necessarily the original artists. Individual artist credits and redistribution permissions have not been verified.</p>
    <p>Game data extraction: Lucas Kent (Rukai), Rukaidata, and brawllib_rs. Their MIT notices are included in THIRD-PARTY-NOTICES.md.</p>
    <p>Attributes: OrangeChris, Iris Flower, and the contributors to the P+ Attributes document. Study scheduling uses ts-fsrs, an MIT-licensed implementation of FSRS.</p>
    <p>Calculators: MAWWWK’s ASDI down template; Strong Bad’s knockback calculator; Connor’s Project+ update; and Magus420’s formulas and stale-move information. Thanks to Iris Flower for maintaining the spreadsheet.</p>
    <p>P+ Dojo is made by Dulop, thanks to the efforts of the amazing P+ Community</p>
  </section>
</article>;}
