import {memo,useEffect,useMemo,useRef,useState,type Dispatch,type SetStateAction,type PointerEvent} from 'react';
import {ArrowUpDown,Box,RotateCcw,ZoomIn,ZoomOut} from 'lucide-react';
import {OrthographicCamera,Vector3} from 'three';
import {scatterAxes,scatterDomains,scatterFighters,scatterViews,type ScatterFighter,type ScatterKey,type ScatterView} from '../data/attribute-scatter';
import {fighterStockImage} from '../data/fighter-images';
import type {Ranking} from '../data/reference';
import FighterName from './FighterName';
import {useAttributeControls} from './AttributeCharts';
import '../attribute-scatter.css';

type Point=[number,number,number];
const numberFormatter=new Intl.NumberFormat('en-US',{maximumFractionDigits:6});
const number=(value:number)=>numberFormatter.format(value);
const axisIndex:Record<ScatterKey,number>={weight:0,gravity:1,fallSpeed:2};
const upwardAxes:ScatterKey[]=['gravity','weight','fallSpeed'];
// Cyclic permutations keep the same handedness, with the chosen attribute on Y.
const spatialAxes:Record<ScatterKey,Point>={gravity:[0,1,2],weight:[2,0,1],fallSpeed:[1,2,0]};
const defaultAngle={yaw:.7,pitch:.24};
export default function AttributeScatterGraph({metrics}:{metrics:Ranking[]}){
  const allFighters=useMemo(()=>scatterFighters(metrics),[metrics]);
  const domains=useMemo(()=>scatterDomains(allFighters),[allFighters]);
  const {query}=useAttributeControls();
  const fighters=useMemo(()=>allFighters.filter(fighter=>[fighter.name,...Object.values(fighter.values).map(number)].some(value=>value.toLowerCase().includes(query.toLowerCase()))),[allFighters,query]);
  const [view,setView]=useState<ScatterView>('3d'),[angle,setAngle]=useState(defaultAngle),[zoom,setZoom]=useState(1),[pan,setPan]=useState({x:0,y:0});
  const [upwardAxis,setUpwardAxis]=useState<ScatterKey>('gravity');
  const [selected,setSelected]=useState(''),[hovered,setHovered]=useState('');
  const [size,setSize]=useState({width:800,height:400});
  const host=useRef<HTMLDivElement>(null),drag=useRef<{id:number;x:number;y:number;yaw:number;pitch:number;panX:number;panY:number}|null>(null);
  const interactionFrame=useRef<number|null>(null),pendingInteraction=useRef<(()=>void)|null>(null);
  function cancelInteraction(){
    if(interactionFrame.current!==null)cancelAnimationFrame(interactionFrame.current);
    interactionFrame.current=null;pendingInteraction.current=null;drag.current=null;
  }
  // Pointer hardware can send several moves per display frame. Commit only the latest.
  function scheduleInteraction(update:()=>void){
    pendingInteraction.current=update;
    if(interactionFrame.current!==null)return;
    interactionFrame.current=requestAnimationFrame(()=>{
      interactionFrame.current=null;
      const latest=pendingInteraction.current;pendingInteraction.current=null;latest?.();
    });
  }
  function finishDrag(event:PointerEvent<SVGSVGElement>){
    if(drag.current?.id!==event.pointerId)return;
    const latest=pendingInteraction.current;cancelInteraction();latest?.();
  }
  useEffect(()=>()=>cancelInteraction(),[]);
  useEffect(()=>{
    const element=host.current!;
    const observer=new ResizeObserver(([entry])=>{if(entry.contentRect.width&&entry.contentRect.height)setSize({width:entry.contentRect.width,height:entry.contentRect.height});});
    const wheel=(event:WheelEvent)=>{event.preventDefault();setZoom(zoom=>Math.max(.65,Math.min(3,zoom*(event.deltaY<0?1.1:1/1.1))));};
    element.addEventListener('wheel',wheel,{passive:false});
    observer.observe(element);return ()=>{observer.disconnect();element.removeEventListener('wheel',wheel);};
  },[]);
  const mode=scatterViews.find(mode=>mode.id===view)!;
  const normalize=(key:ScatterKey,value:number)=>2*(value-domains[key].minimum)/(domains[key].maximum-domains[key].minimum)-1;
  const position=(fighter:ScatterFighter):Point=>scatterAxes.map(axis=>normalize(axis.key,fighter.values[axis.key])) as Point;
  const camera=useMemo(()=>{
    const aspect=size.width/Math.max(100,size.height-54);
    const camera=new OrthographicCamera(-1,1,1,-1,.1,100);
    if(view==='3d')camera.position.set(8*Math.sin(angle.yaw)*Math.cos(angle.pitch),8*Math.sin(angle.pitch),8*Math.cos(angle.yaw)*Math.cos(angle.pitch));
    else if(view==='weight-gravity')camera.position.set(0,0,8);
    else if(view==='weight-fall'){camera.position.set(0,-8,0);camera.up.set(0,0,1);}
    else{camera.position.set(8,0,0);camera.up.set(0,0,1);}
    camera.lookAt(0,0,0);camera.updateMatrixWorld();
    let halfHeight=1.22/zoom,halfWidth=Math.max(1.3,1/Math.max(.35,1-120/size.width))/zoom;
    if(view==='3d'){
      const corners=[-2,2].flatMap(x=>[-1,1].flatMap(y=>[-2,2].map(z=>new Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse))));
      halfHeight=Math.max(Math.max(...corners.map(point=>Math.abs(point.y)))+.4,(Math.max(...corners.map(point=>Math.abs(point.x)))+.5)/aspect)/zoom;
      halfWidth=halfHeight*aspect;
    }
    camera.left=-halfWidth;camera.right=halfWidth;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();
    return camera;
  },[view,angle,zoom,size]);
  const project=(point:Point)=>{const axes=spatialAxes[upwardAxis];const vector=(view==='3d'?new Vector3(point[axes[0]]*2,point[axes[1]],point[axes[2]]*2):new Vector3(...point)).project(camera);return {x:(vector.x+1)*size.width/2+pan.x,y:10+(1-vector.y)*Math.max(100,size.height-54)/2+pan.y,z:vector.z};};
  const groups=useMemo(()=>{
    const groups=new Map<string,ScatterFighter[]>();
    for(const fighter of fighters){const key=JSON.stringify(mode.axes.map(axis=>fighter.values[axis]));const group=groups.get(key)??[];group.push(fighter);groups.set(key,group);}
    return [...groups.values()];
  },[fighters,mode]);
  const active=fighters.find(fighter=>fighter.id===(hovered||selected));
  const peers=active?fighters.filter(fighter=>mode.axes.every(axis=>fighter.values[axis]===active.values[axis])):[];
  const displayedAxes=scatterAxes.filter(axis=>mode.axes.includes(axis.key));
  const origin:Point=view==='weight-gravity'?[-1,-1,0]:view==='weight-fall'?[-1,0,-1]:view==='gravity-fall'?[0,-1,-1]:[-1,-1,-1];
  const grid:{start:Point;end:Point}[]=[];
  const planes:ScatterKey[][]=view==='3d'?[['weight','gravity'],['weight','fallSpeed'],['gravity','fallSpeed']]:[mode.axes];
  for(const plane of planes)for(const key of plane){
    const other=plane.find(axis=>axis!==key)!;
    for(const tick of domains[key].ticks){
      const start=[...origin] as Point,end=[...origin] as Point;
      start[axisIndex[key]]=end[axisIndex[key]]=normalize(key,tick);end[axisIndex[other]]=1;
      grid.push({start,end});
    }
  }
  const changeZoom=(factor:number)=>setZoom(zoom=>Math.max(.65,Math.min(3,zoom*factor)));
  const reset=()=>{cancelInteraction();setAngle(defaultAngle);setZoom(1);setPan({x:0,y:0});};
  const changeView=(view:ScatterView)=>{setView(view);setHovered('');reset();};
  const upwardLabel=scatterAxes.find(axis=>axis.key===upwardAxis)!.label;
  const nextUpwardAxis=upwardAxes[(upwardAxes.indexOf(upwardAxis)+1)%upwardAxes.length];
  const swapUpwardAxis=()=>{cancelInteraction();setHovered('');setUpwardAxis(nextUpwardAxis);};
  function pointerDown(event:PointerEvent<SVGSVGElement>){
    if(event.button!==0||(event.target as Element).closest('[data-scatter-marker]'))return;
    if(drag.current)return;
    event.preventDefault();
    setHovered('');event.currentTarget.focus();event.currentTarget.setPointerCapture(event.pointerId);
    drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,yaw:angle.yaw,pitch:angle.pitch,panX:pan.x,panY:pan.y};
  }
  function pointerMove(event:PointerEvent<SVGSVGElement>){
    const start=drag.current;if(!start||start.id!==event.pointerId)return;
    const dx=event.clientX-start.x,dy=event.clientY-start.y;
    if(view==='3d')scheduleInteraction(()=>setAngle({yaw:start.yaw-dx*.008,pitch:Math.max(-1.2,Math.min(1.2,start.pitch+dy*.008))}));
    else scheduleInteraction(()=>setPan({x:start.panX+dx,y:start.panY+dy}));
  }
  const caption=view==='3d'?'Drag to rotate · Scroll to zoom · Arrow keys rotate':'Orthographic view · Drag to pan · Scroll to zoom';
  return <section className="attribute-section-card attribute-scatter-card" aria-label="3D fighter attributes graph">
    <header><div><span className="eyebrow">{fighters.length} FIGHTERS · THREE ATTRIBUTES</span><h2><Box size={21}/>3D Graph</h2></div><div className="scatter-axis-legend" aria-label="Graph axes">{scatterAxes.map(axis=><span key={axis.key} style={{color:axis.color}}><i/>{axis.label}</span>)}</div></header>
    <div className="scatter-toolbar">
      <div className="scatter-view-switch" role="group" aria-label="Graph projection">{scatterViews.map(mode=><button key={mode.id} aria-pressed={view===mode.id} onClick={()=>changeView(mode.id)}>{mode.label}</button>)}</div>
      <div className="scatter-navigation" role="group" aria-label="Graph navigation">{view==='3d'&&<button className="scatter-axis-swap" aria-label={`Swap upward axis (currently ${upwardLabel})`} title={`Make ${scatterAxes.find(axis=>axis.key===nextUpwardAxis)!.label} point upwards`} onClick={swapUpwardAxis}><ArrowUpDown size={16}/><span>Up: {upwardLabel}</span></button>}<button aria-label="Zoom in graph" onClick={()=>changeZoom(1.2)}><ZoomIn size={16}/></button><button aria-label="Zoom out graph" onClick={()=>changeZoom(1/1.2)}><ZoomOut size={16}/></button><button aria-label="Reset graph view" onClick={reset}><RotateCcw size={16}/></button></div>
    </div>
    <div className="scatter-plot" ref={host}>
      <svg viewBox={`0 0 ${size.width} ${size.height}`} role="group" aria-label={view==='3d'?'Rotatable 3D attribute plot':`${mode.label} orthographic plot`} tabIndex={0} data-projection={view} data-camera={`${angle.yaw},${angle.pitch}`} data-horizontal-axis={view==='3d'?undefined:mode.axes[0]} data-vertical-axis={view==='3d'?upwardAxis:mode.axes[1]} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={finishDrag} onKeyDown={event=>{
        if(event.target!==event.currentTarget)return;
        if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();const dx=event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:0,dy=event.key==='ArrowUp'?1:event.key==='ArrowDown'?-1:0;if(view==='3d')setAngle(angle=>({yaw:angle.yaw+dx*.12,pitch:Math.max(-1.2,Math.min(1.2,angle.pitch+dy*.12))}));else setPan(pan=>({x:pan.x+dx*15,y:pan.y+dy*15}));}
        else if(event.key==='+'||event.key==='=')changeZoom(1.2);else if(event.key==='-')changeZoom(1/1.2);else if(event.key==='Home'){event.preventDefault();reset();}
      }}>
        <title>Fighter weight, gravity and maximum fall speed</title>
        <desc>Each icon represents a fighter. In flat views, fighters sharing the same coordinates appear together in a larger circle divided into sections. Each section can be inspected separately. Use the projection buttons for a flat comparison of two attributes, or the fighter selector to inspect any character.</desc>
        <g className="scatter-grid" aria-hidden="true">{grid.map((line,index)=>{const start=project(line.start),end=project(line.end);return <line key={index} x1={start.x} y1={start.y} x2={end.x} y2={end.y}/>;})}</g>
        <g className="scatter-axes" aria-hidden="true">{displayedAxes.map(axis=>{
          const end=[...origin] as Point;end[axisIndex[axis.key]]=1;
          const startScreen=project(origin),endScreen=project(end),mid={x:(startScreen.x+endScreen.x)/2,y:(startScreen.y+endScreen.y)/2};
          const horizontal=view!=='3d'&&mode.axes[0]===axis.key,vertical=view!=='3d'&&!horizontal;
          const upward=view==='3d'&&axis.key===upwardAxis;
          const label=horizontal?{x:mid.x,y:mid.y+35}:vertical?{x:mid.x-42,y:mid.y}:{x:Math.max(55,Math.min(size.width-55,endScreen.x)),y:Math.max(14,Math.min(size.height-28,endScreen.y+(upward?-20:35)))};
          return <g key={axis.key} data-axis={axis.key} style={{color:axis.color}}><line x1={startScreen.x} y1={startScreen.y} x2={endScreen.x} y2={endScreen.y} stroke="currentColor" strokeWidth="1.5"/>
            {domains[axis.key].ticks.filter((_,index,ticks)=>view!=='3d'||ticks.length<=6||index%2===0||index===ticks.length-1).map(tick=>{const point=[...origin] as Point;point[axisIndex[axis.key]]=normalize(axis.key,tick);const p=project(point);return <g key={tick}><circle cx={p.x} cy={p.y} r="2" fill="currentColor"/><text x={p.x+(vertical||upward?-9:0)} y={p.y+(vertical||upward?4:16)} textAnchor={vertical||upward?'end':'middle'}>{number(tick)}</text></g>;})}
            <text className="scatter-axis-title" x={label.x} y={label.y} textAnchor="middle" transform={vertical?`rotate(-90 ${label.x} ${label.y})`:undefined}>{axis.label}</text>
          </g>;
        })}</g>
        <g aria-label="Plotted fighters">{groups.map(group=>({group,point:project(position(group[0]))})).sort((a,b)=>Number(a.group.some(fighter=>fighter.id===active?.id))-Number(b.group.some(fighter=>fighter.id===active?.id))||b.point.z-a.point.z).map(({group,point})=>{
          return <g key={group.map(fighter=>fighter.id).join(':')} transform={`translate(${point.x} ${point.y})`}><ScatterMarker group={group} view={view} activeId={active?.id} selected={selected} onHover={setHovered} onSelect={setSelected}/></g>;
        })}</g>
      </svg>
      {!fighters.length&&<p className="scatter-empty" role="status">No fighters match “{query}”.</p>}
      <p className="scatter-help">{caption}</p>
    </div>
    <footer className="scatter-details">
      <label className="scatter-fighter-picker"><span>Inspect fighter</span><select aria-label="Inspect fighter in 3D graph" value={fighters.some(fighter=>fighter.id===selected)?selected:''} onChange={event=>{setSelected(event.target.value);setHovered('');}}><option value="">Choose a fighter…</option>{fighters.map(fighter=><option key={fighter.id} value={fighter.id}>{fighter.name}</option>)}</select></label>
      <div className="scatter-inspection" aria-live="polite">{active?<><FighterName name={active.name}/><dl>{scatterAxes.map(axis=><div key={axis.key}><dt>{axis.label}</dt><dd>{number(active.values[axis.key])}</dd></div>)}</dl>{peers.length>1&&<p className="scatter-peers">Same visible position: {peers.map(fighter=>fighter.name).join(', ')}.{view!=='3d'?' Select an icon to inspect that fighter.':' Use the fighter selector to inspect each.'}</p>}</>:<p>Hover, focus or select a fighter to see all three values. Split circles show fighters sharing the same coordinates.</p>}</div>
    </footer>
  </section>;
}

// Marker labels, icons and split geometry stay unchanged while the camera moves.
const ScatterMarker=memo(function ScatterMarker({group,view,activeId,selected,onHover,onSelect}:{group:ScatterFighter[];view:ScatterView;activeId:string|undefined;selected:string;onHover:Dispatch<SetStateAction<string>>;onSelect:Dispatch<SetStateAction<string>>}){
  const mode=scatterViews.find(mode=>mode.id===view)!;
  const fighter=group.find(fighter=>fighter.id===activeId)??group[0];
  const highlighted=group.some(fighter=>fighter.id===activeId),icon=fighterStockImage(fighter.id,fighter.name);
  const shared=view!=='3d'&&group.length>1;
  const radius=group.length===2?18:Math.max(28,group.length*7+2);
  const description=`${group.map(fighter=>fighter.name).join(', ')}: ${mode.axes.map(key=>`${scatterAxes.find(axis=>axis.key===key)!.label} ${number(fighter.values[key])}`).join(', ')}`;
  return <g className="scatter-marker" data-scatter-marker="true" data-shared={shared} data-fighters={group.map(fighter=>fighter.id).join(',')} data-count={group.length} data-selected={highlighted} tabIndex={shared?undefined:0} role={shared?'group':'button'} aria-label={`${shared?'Fighters sharing coordinates':'Inspect'} ${description}`} aria-pressed={shared?undefined:selected!==''&&group.some(fighter=>fighter.id===selected)} onPointerEnter={shared?undefined:()=>onHover(fighter.id)} onPointerLeave={shared?undefined:()=>onHover('')} onFocus={shared?undefined:()=>onHover(fighter.id)} onBlur={shared?undefined:()=>onHover('')} onClick={shared?undefined:()=>{onSelect(fighter.id);onHover('');}} onKeyDown={shared?undefined:event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect(fighter.id);}}}>
    <title>{description}</title>
    {shared?<>
      {group.map((member,index)=>{
        const start=(group.length===2?Math.PI/2:-Math.PI/2)+index*2*Math.PI/group.length,end=start+2*Math.PI/group.length,middle=(start+end)/2;
        const distance=group.length===2?8:radius*(group.length===3?.54:.63),cx=Math.cos(middle)*distance,cy=Math.sin(middle)*distance;
        const iconSize=16,memberIcon=fighterStockImage(member.id,member.name);
        const path=`M 0 0 L ${Math.cos(start)*radius} ${Math.sin(start)*radius} A ${radius} ${radius} 0 0 1 ${Math.cos(end)*radius} ${Math.sin(end)*radius} Z`;
        const memberDescription=`${member.name}: ${scatterAxes.map(axis=>`${axis.label} ${number(member.values[axis.key])}`).join(', ')}`;
        return <g key={member.id} className="scatter-marker-segment" data-fighter={member.id} data-selected={activeId===member.id} role="button" tabIndex={0} aria-label={`Inspect ${memberDescription}`} aria-pressed={selected===member.id} onPointerEnter={()=>onHover(member.id)} onPointerLeave={()=>onHover('')} onFocus={()=>onHover(member.id)} onBlur={()=>onHover('')} onClick={()=>{onSelect(member.id);onHover('');}} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect(member.id);onHover('');}}}>
          <title>{memberDescription}</title><path d={path}/>{memberIcon?<image href={memberIcon} x={cx-iconSize/2} y={cy-iconSize/2} width={iconSize} height={iconSize}/>:<text x={cx} y={cy+4} textAnchor="middle">{member.name.slice(0,2)}</text>}
        </g>;
      })}
      <circle className="scatter-marker-outline" r={radius}/>
    </>:<><circle r="14"/>{icon?<image href={icon} x="-10" y="-10" width="20" height="20"/>:<text textAnchor="middle" y="4">{fighter.name.slice(0,2)}</text>}
      {group.length>1&&<g className="scatter-marker-count"><circle cx="11" cy="-10" r="7"/><text x="11" y="-7" textAnchor="middle">{group.length}</text></g>}
    </>}
  </g>;
});
