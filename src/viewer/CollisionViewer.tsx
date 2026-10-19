import { forwardRef,useEffect,useImperativeHandle,useRef,useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AlertTriangle, Crosshair, Maximize, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import type { Frame, MoveData } from '../data/types';
import { capsuleGeometry, hitTransform, hurtTransform, setCapsule } from './geometry';

export type Layers = { hit: boolean; hurt: boolean; collision: boolean; ledge: boolean; wireframe: boolean };
export type ViewerHandle={showFrame:(index:number)=>void};
type Runtime = { setMove:(move:MoveData|null)=>void;render: (frame: Frame, layers: Layers,selectedHitboxIndex?:number) => void; reset: () => void; zoom: (factor: number) => void };
const hitColors = [0xff8a65,0xff4e69,0xcc86ff,0x63dbe6,0xc1f17a];
export default forwardRef<ViewerHandle,{move:MoveData|null;frame:number;layers:Layers;playing?:boolean;selectedHitboxIndex?:number;onHitboxSelect?:(index:number|null,frame:number)=>void}>(function CollisionViewer({ move, frame, layers,playing=false,selectedHitboxIndex,onHitboxSelect },ref) {
  const container = useRef<HTMLDivElement>(null), runtime = useRef<Runtime | null>(null);
  const liveMove=useRef(move),liveLayers=useRef(layers),liveFrame=useRef(frame),liveSelection=useRef(selectedHitboxIndex);
  const selectionFrame=useRef(frame),selectionCallback=useRef(onHitboxSelect);
  selectionCallback.current=onHitboxSelect;
  const showFrame=(index:number)=>{
    liveFrame.current=index;
    const f=liveMove.current?.frames[index],selected=liveMove.current?.frames[selectionFrame.current]?.hit_boxes[liveSelection.current??-1];
    const matching=selected&&f?f.hit_boxes.findIndex(box=>box.hitbox_id===selected.hitbox_id&&'Hit' in box.next_values&&'Hit' in selected.next_values&&box.next_values.Hit.set_id===selected.next_values.Hit.set_id):undefined;
    if(f)runtime.current?.render(f,liveLayers.current,matching===-1?undefined:matching);
  };
  useImperativeHandle(ref,()=>({showFrame}),[]);
  const [error, setError] = useState('');
  const [fullscreenError, setFullscreenError] = useState('');
  useEffect(() => {
    const host = container.current!;
    setError('');
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setError('The interactive viewer needs WebGL 2. Enable hardware acceleration or use a compatible browser. Move data remains available below.'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.setClearColor(0x14181b,0);
    renderer.domElement.setAttribute('aria-label','Interactive collision geometry. Drag to rotate; scroll or pinch to zoom.');
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36,1,0.1,2000);
    const controls = new OrbitControls(camera,renderer.domElement);
    controls.enableDamping=false;
    const extent = move?.extent ?? {left:-12,right:12,up:24,down:0};
    let height = Math.max(20,extent.up-extent.down), width = Math.max(20,extent.right-extent.left);
    const center = new THREE.Vector3(0,(extent.up+extent.down)/2,(extent.left+extent.right)/2);
    const reset = () => {
      const fit = Math.max(height,width/camera.aspect);
      camera.position.copy(center).add(new THREE.Vector3(-fit*1.8,fit*.08,fit*.2));
      controls.target.copy(center); controls.update();
    };
    const grid = new THREE.GridHelper(180,36,0x3d4546,0x282f32); scene.add(grid);
    const axisGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,-90),new THREE.Vector3(0,0,90)]);
    scene.add(new THREE.Line(axisGeometry,new THREE.LineBasicMaterial({color:0x697856,transparent:true,opacity:.5})));
    const pool: THREE.Mesh[] = [];
    const materialCache = new Map<string,THREE.MeshBasicMaterial>();
    const material = (color: number, wireframe: boolean,opacity=wireframe?.55:.32) => {
      const key=`${color}-${wireframe}-${opacity}`;
      if (!materialCache.has(key)) materialCache.set(key,new THREE.MeshBasicMaterial({color,wireframe,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide}));
      return materialCache.get(key)!;
    };
    let used=0;
    const capsule = (transform: ReturnType<typeof hitTransform>, color:number, wire:boolean,opacity=wire?.55:.32) => {
      let mesh = pool[used++];
      if (!mesh) { mesh = new THREE.Mesh(capsuleGeometry(),material(color,wire)); pool.push(mesh); scene.add(mesh); }
      mesh.material=material(color,wire,opacity); mesh.visible=true;
      delete mesh.userData.hitboxIndex;
      setCapsule(mesh,transform.start,transform.end,transform.startRadius,transform.endRadius,transform.matrix);
      return mesh;
    };
    const overlayGeometry = new THREE.BufferGeometry();
    const overlay = new THREE.LineSegments(overlayGeometry,new THREE.LineBasicMaterial({color:0xc1f17a,depthTest:false})); scene.add(overlay);
    const ledgeGeometry = new THREE.BufferGeometry();
    const ledge = new THREE.LineSegments(ledgeGeometry,new THREE.LineBasicMaterial({color:0x8dceff,depthTest:false})); scene.add(ledge);
    const labelCanvas=document.createElement('canvas');labelCanvas.width=256;labelCanvas.height=80;
    const labelTexture=new THREE.CanvasTexture(labelCanvas);
    const labelMaterial=new THREE.SpriteMaterial({map:labelTexture,depthTest:false,depthWrite:false});
    const targetLabel=new THREE.Sprite(labelMaterial);targetLabel.scale.set(9,2.8,1);targetLabel.renderOrder=20;targetLabel.visible=false;scene.add(targetLabel);
    const targetLine=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x8ffff0,depthTest:false}));targetLine.renderOrder=19;targetLine.visible=false;scene.add(targetLine);
    let labelId:number|undefined;
    const draw=()=>renderer.render(scene,camera);
    const runtimeValue: Runtime = {
      setMove:next=>{
        pool.forEach(mesh=>mesh.visible=false);overlay.visible=false;ledge.visible=false;targetLabel.visible=false;targetLine.visible=false;
        if(next){const e=next.extent;height=Math.max(20,e.up-e.down);width=Math.max(20,e.right-e.left);center.set(0,(e.up+e.down)/2,(e.left+e.right)/2);reset();}
        draw();
      },
      reset:()=>{reset();draw();},
      zoom:factor=>{camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);controls.update();draw();},
      render:(f,l,selection)=> {
        used=0;
        targetLabel.visible=false;targetLine.visible=false;
        if (l.hurt) for (const box of f.hurt_boxes) capsule(hurtTransform(box,f),box.state==='Invincible'?0x8dceff:box.state.startsWith('Intangible')?0xa998db:0xdbc671,l.wireframe);
        if (l.hit) for (const [boxIndex,box] of f.hit_boxes.entries()) {
          if ('Hit' in box.next_values && !box.next_values.Hit.enabled) continue;
          const selected=boxIndex===selection,transform=hitTransform(box,f);
          const mesh=capsule(transform,selected?0x5fffe1:'Grab' in box.next_values?0x65d8ab:hitColors[box.hitbox_id%hitColors.length],l.wireframe,selected?.65:selection===undefined?(l.wireframe?.55:.32):.13);
          if('Hit' in box.next_values)mesh.userData.hitboxIndex=boxIndex;
          if(selected){
            capsule(transform,0xc3fff5,true,.75);
            const target=new THREE.Vector3(transform.end.x,transform.end.y,transform.end.z).applyMatrix4(transform.matrix);
            targetLabel.position.copy(target).add(new THREE.Vector3(0,Math.max(5,box.next_size*1.6)+2,0));
            targetLine.geometry.setFromPoints([target,targetLabel.position]);targetLine.visible=true;targetLabel.visible=true;
            if(labelId!==box.hitbox_id){
              const context=labelCanvas.getContext('2d')!;context.clearRect(0,0,256,80);context.fillStyle='#113b3b';context.fillRect(0,0,256,80);context.strokeStyle='#83fff0';context.lineWidth=5;context.strokeRect(3,3,250,74);context.fillStyle='#e0fff9';context.font='bold 48px sans-serif';context.textAlign='center';context.textBaseline='middle';context.fillText(`ID ${box.hitbox_id}`,128,41);labelTexture.needsUpdate=true;labelId=box.hitbox_id;
            }
          }
        }
        pool.slice(used).forEach(mesh=>mesh.visible=false);
        const e=f.ecb, mid=(e.top+e.bottom)/2;
        const a=new THREE.Vector3(0,e.top+f.y_pos,f.x_pos), b=new THREE.Vector3(0,mid+f.y_pos,e.right+f.x_pos), c=new THREE.Vector3(0,e.bottom+f.y_pos,f.x_pos), d=new THREE.Vector3(0,mid+f.y_pos,e.left+f.x_pos);
        overlayGeometry.setFromPoints([a,b,b,c,c,d,d,a]); overlay.visible=l.collision;
        ledge.visible=l.ledge && f.ledge_grab_box!==null;
        if (f.ledge_grab_box) {
          const box=f.ledge_grab_box, p=(y:number,z:number)=>new THREE.Vector3(0,y+f.y_pos,z+f.x_pos);
          const la=p(box.up,box.left),lb=p(box.up,box.right),lc=p(box.down,box.right),ld=p(box.down,box.left);
          ledgeGeometry.setFromPoints([la,lb,lb,lc,lc,ld,ld,la]);
        }
        draw();
      },
    };
    runtime.current=runtimeValue;
    const resize=()=>{const w=host.clientWidth,h=host.clientHeight; renderer.setSize(w,h); camera.aspect=w/Math.max(h,1);camera.updateProjectionMatrix();draw();};
    const observer=new ResizeObserver(resize);observer.observe(host);
    resize();reset();
    if (move?.frames.length) runtimeValue.render(move.frames[Math.min(frame,move.frames.length-1)],layers,liveSelection.current); else draw();
    controls.addEventListener('change',draw);
    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
    let press:{x:number;y:number;id:number;dragged:boolean}|undefined;
    const pointerDown=(event:PointerEvent)=>{if(event.button===0&&event.isPrimary)press={x:event.clientX,y:event.clientY,id:event.pointerId,dragged:false};};
    const pointerMove=(event:PointerEvent)=>{if(press&&press.id===event.pointerId&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>5)press.dragged=true;};
    const pointerUp=(event:PointerEvent)=>{
      const click=press;press=undefined;
      if(!click||click.id!==event.pointerId||click.dragged||!selectionCallback.current)return;
      const rect=renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
      scene.updateMatrixWorld(true);raycaster.setFromCamera(pointer,camera);
      const found=raycaster.intersectObjects(pool.filter(mesh=>mesh.visible&&typeof mesh.userData.hitboxIndex==='number'),false)[0];
      selectionCallback.current(found?found.object.userData.hitboxIndex:null,liveFrame.current);
    };
    const pointerCancel=()=>{press=undefined;};
    renderer.domElement.addEventListener('pointerdown',pointerDown);
    renderer.domElement.addEventListener('pointermove',pointerMove);
    renderer.domElement.addEventListener('pointerup',pointerUp);
    renderer.domElement.addEventListener('pointercancel',pointerCancel);
    const lost=(event:Event)=>{event.preventDefault();setError('Graphics context was lost. Reload this page to restore the viewer.');};
    renderer.domElement.addEventListener('webglcontextlost',lost);
    return ()=> {
      runtime.current=null;observer.disconnect();controls.removeEventListener('change',draw);controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost',lost);
      renderer.domElement.removeEventListener('pointerdown',pointerDown);
      renderer.domElement.removeEventListener('pointermove',pointerMove);
      renderer.domElement.removeEventListener('pointerup',pointerUp);
      renderer.domElement.removeEventListener('pointercancel',pointerCancel);
      scene.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Line||object instanceof THREE.LineSegments){object.geometry.dispose(); const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(m=>m.dispose());}});
      labelTexture.dispose();labelMaterial.dispose();materialCache.forEach(m=>m.dispose());renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
    };
    // Keep the graphics context, mesh pool and shaders across move changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  useEffect(()=>{liveMove.current=move;runtime.current?.setMove(move);if(move?.frames.length)showFrame(Math.min(frame,move.frames.length-1));},[move]);
  useEffect(()=>{liveLayers.current=layers;showFrame(liveFrame.current);},[layers]);
  useEffect(()=>{selectionFrame.current=frame;liveSelection.current=selectedHitboxIndex;showFrame(liveFrame.current);},[selectedHitboxIndex,frame]);
  useEffect(()=>{if(!playing)showFrame(frame);},[move,frame,playing]);
  async function fullscreen() {
    try { if(document.fullscreenElement) await document.exitFullscreen(); else await container.current?.parentElement?.requestFullscreen(); }
    catch {setFullscreenError('Fullscreen is unavailable in this browser.');}
  }
  return <div className="viewer-stage" data-selected-hitbox={selectedHitboxIndex===undefined?undefined:move?.frames[frame]?.hit_boxes[selectedHitboxIndex]?.hitbox_id}>
    <div className="viewer-corner"><span className="live-dot"/> {move ? 'COLLISION VIEW' : 'VIEWER READY'} <span className="stage-divider">/</span> 3D</div>
    <div ref={container} className="three-host"/>
    {!move&&!error&&<div className="viewer-placeholder"><Crosshair size={42} strokeWidth={1}/><strong>Your next discovery starts here</strong><span>Import P+ data to inspect every frame.</span></div>}
    {error&&<div className="viewer-placeholder graphics-error" role="alert"><AlertTriangle size={30}/><strong>Viewer unavailable</strong><span>{error}</span></div>}
    <div className="viewer-axis"><span>Y ↑</span><span>Z →</span></div>
    <div className="viewer-camera"><button aria-label="Zoom in" title="Zoom in" onClick={()=>runtime.current?.zoom(.85)}><ZoomIn size={17}/></button><button aria-label="Zoom out" title="Zoom out" onClick={()=>runtime.current?.zoom(1.18)}><ZoomOut size={17}/></button><button aria-label="Reset camera" title="Reset camera" onClick={()=>runtime.current?.reset()}><RotateCcw size={17}/></button><button aria-label="Fullscreen viewer" title="Fullscreen" onClick={fullscreen}><Maximize size={17}/></button></div>
    <span className="viewer-hint">{onHitboxSelect?'Click a hitbubble · ':''}Drag to orbit · Scroll to zoom</span>
    {fullscreenError&&<span role="status" className="fullscreen-error">{fullscreenError}</span>}
  </div>;
});
