import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,ChevronDown} from 'lucide-react';
import {fighterStockImage} from '../data/fighter-images';

export default function FighterSelect({fighters,value,disabled,onChange}:{fighters:{id:string;name:string}[];value:string;disabled:boolean;onChange:(value:string)=>void}){
  const options=[{id:'all',name:'All fighters'},...fighters];
  const selected=options.find(option=>option.id===value)??options[0];
  const [open,setOpen]=useState(false),[active,setActive]=useState(0);
  const [position,setPosition]=useState({left:0,top:0,width:0,maxHeight:300});
  const trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null),search=useRef({text:'',time:0});
  const id=useId(),optionId=(index:number)=>`${id}-option-${index}`;
  const place=()=>{
    const bounds=trigger.current!.getBoundingClientRect();
    const below=innerHeight-bounds.bottom-12,above=bounds.top-12;
    const upwards=below<Math.min(280,innerHeight*.4)&&above>below;
    const maxHeight=Math.max(60,Math.min(300,upwards?above:below));
    setPosition({left:bounds.left,top:upwards?bounds.top-maxHeight-4:bounds.bottom+4,width:bounds.width,maxHeight});
  };
  const show=()=>{place();setActive(Math.max(0,options.findIndex(option=>option.id===value)));setOpen(true);search.current={text:'',time:0};};
  const choose=(index:number)=>{onChange(options[index].id);setOpen(false);trigger.current?.focus();};
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!trigger.current?.contains(event.target as Node)&&!menu.current?.contains(event.target as Node))setOpen(false);};
    const reposition=(event:Event)=>{if(!menu.current?.contains(event.target as Node))place();};
    document.addEventListener('pointerdown',outside);window.addEventListener('resize',reposition);window.addEventListener('scroll',reposition,true);
    return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',reposition);window.removeEventListener('scroll',reposition,true);};
  },[open]);
  useEffect(()=>{if(open)document.getElementById(optionId(active))?.scrollIntoView({block:'nearest'});},[active,open]);
  useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
  const icon=(option:{id:string;name:string})=>{const image=option.id==='all'?undefined:fighterStockImage(option.id,option.name);return image?<img src={image} alt=""/>:<span className="fighter-choice-placeholder" aria-hidden="true"/>;};
  return <>
    <button type="button" className="study-fighter-combobox" ref={trigger} role="combobox" aria-label="Study fighter" aria-expanded={open} aria-haspopup="listbox" aria-controls={open?id:undefined} aria-activedescendant={open?optionId(active):undefined} disabled={disabled} onClick={()=>open?setOpen(false):show()} onBlur={event=>{if(!menu.current?.contains(event.relatedTarget as Node))setOpen(false);}} onKeyDown={event=>{
      if(event.key==='Tab'){setOpen(false);return;}
      if(event.key==='Escape'){event.preventDefault();setOpen(false);return;}
      if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
        event.preventDefault();if(!open){show();return;}
        setActive(index=>event.key==='Home'?0:event.key==='End'?options.length-1:Math.max(0,Math.min(options.length-1,index+(event.key==='ArrowDown'?1:-1))));return;
      }
      if(event.key==='Enter'||event.key===' '){event.preventDefault();if(open)choose(active);else show();return;}
      if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
        event.preventDefault();const now=Date.now();search.current={text:(now-search.current.time<700?search.current.text:'')+event.key.toLowerCase(),time:now};
        if(!open){place();setOpen(true);}
        const index=options.findIndex(option=>option.name.toLowerCase().startsWith(search.current.text));if(index>=0)setActive(index);
      }
    }}>{icon(selected)}<span>{selected.name}</span><ChevronDown size={16}/></button>
    {open&&createPortal(<div id={id} ref={menu} role="listbox" aria-label="Fighters" className="study-fighter-options" style={{left:position.left,top:position.top,width:position.width,maxHeight:position.maxHeight}}>{options.map((option,index)=><div id={optionId(index)} key={option.id} role="option" aria-selected={option.id===value} className={index===active?'active':''} onPointerMove={()=>setActive(index)} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(index)}>{icon(option)}<span>{option.name}</span>{option.id===value&&<Check size={15}/>}</div>)}</div>,document.body)}
  </>;
}
