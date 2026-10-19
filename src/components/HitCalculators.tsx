import {useEffect,useMemo,useState} from 'react';
import type {FighterData,HitValues,Manifest,MoveData} from '../data/types';
import {loadFighter} from '../data/loader';
import source from '../data/reference/attributes.json';
import type {ReferenceBook} from '../data/reference';
import {referenceFighters,referenceRoster} from '../data/reference-fighters';
import {asdiThreshold,calculateHit,hitEndlag,stalePenalties,type Threshold} from '../data/hit-calculations';
import '../hit-calculators.css';

const raw=(source as ReferenceBook).sheets.find(sheet=>sheet.name==='Raw Data');
const weightColumn=raw?.cells.find(cell=>cell.r===2&&cell.v==='Weight')?.c;
const referenceWeights=new Map<string,number>();
for(const cell of raw?.cells??[]){
  if(cell.c!==1||cell.r<3||typeof cell.v!=='string')continue;
  const weight=raw?.cells.find(value=>value.r===cell.r&&value.c===weightColumn)?.v;
  if(typeof weight==='number'&&weight>0)for(const fighter of referenceFighters(cell.v))referenceWeights.set(fighter.id,weight);
}
const number=(value:number|null|undefined,digits=2)=>value===null||value===undefined?'—':Number(value.toFixed(digits)).toString();
const threshold=(value:Threshold|null)=>value===null?'—':value.kind==='never'?'Never':`${number(value.percent)}%`;
type Props={hit:HitValues|null;hitId:number|undefined;manifest:Manifest|null;attacker:FighterData|null;move:MoveData|null;frame:number;internalName:string};

export default function HitCalculators({hit,hitId,manifest,attacker,move,frame,internalName}:Props){
  const [victimId,setVictimId]=useState('mario'),[victim,setVictim]=useState<FighterData|null>(null),[victimError,setVictimError]=useState(''),[pending,setPending]=useState(false),[retry,setRetry]=useState(0);
  const [percent,setPercent]=useState('0'),[crouch,setCrouch]=useState(false),[chargingSmash,setChargingSmash]=useState(false),[isThrow,setIsThrow]=useState(false),[lCancel,setLCancel]=useState(true);
  const [slots,setSlots]=useState<boolean[]>(Array(9).fill(false));
  const victims=useMemo(()=>{
    const roster=new Map(referenceRoster.filter(f=>referenceWeights.has(f.id)).map(f=>[f.id,{id:f.id,name:f.name}]));
    for(const f of manifest?.fighters??[])roster.set(f.id,{id:f.id,name:f.name});
    return [...roster.values()].sort((a,b)=>a.name.localeCompare(b.name));
  },[manifest]);
  const victimIndex=manifest?.fighters.find(f=>f.id===victimId);
  useEffect(()=>{
    const abort=new AbortController();setVictim(null);setVictimError('');setPending(!!victimIndex);
    if(victimIndex)loadFighter(victimIndex.path,abort.signal).then(setVictim).catch(error=>{if(!abort.signal.aborted)setVictimError(error.message);}).finally(()=>{if(!abort.signal.aborted)setPending(false);});
    return()=>abort.abort();
  },[victimIndex?.path,retry]);
  const importedWeight=victim?.id===victimId?victim.attributes.weight:undefined;
  // Imported fighter constants take priority. The Attributes reference supports
  // roster entries without an imported index, and is explicit on load failure.
  const referenceWeight=referenceWeights.get(victimId);
  const weight=typeof importedWeight==='number'&&Number.isFinite(importedWeight)&&importedWeight>0?importedWeight:!victimIndex||victimError?referenceWeight:undefined;
  const weightSource=typeof importedWeight==='number'&&importedWeight>0?'Fighter data':'Attributes reference';
  const aerialKey=/^AttackAir(N|F|B|Hi|Lw)/.exec(internalName)?.[1];
  const landingAttribute=aerialKey?attacker?.attributes[`${{N:'nair',F:'fair',B:'bair',Hi:'uair',Lw:'dair'}[aerialKey]}_landing_lag`]:undefined;
  const endlag=move?hitEndlag(move,frame,internalName,lCancel,typeof landingAttribute==='number'?landingAttribute:null):null;
  const parsedPercent=percent.trim()===''?NaN:Number(percent);
  const settings={percent:parsedPercent,weight:weight??NaN,crouch,chargingSmash,throw:isThrow,staleSlots:slots,endlag,landingHit:/^LandingAir/.test(internalName)};
  const result=hit?calculateHit(hit,settings):null;
  const ccThreshold=hit?asdiThreshold(hit,weight??NaN,120,settings):null;
  const tumbleThreshold=hit?asdiThreshold(hit,weight??NaN,80,settings):null;
  const fixedKnockback=!!hit&&(hit.wdsk!==0||hit.kbg===0);
  const metrics=[
    {label:'Knockback',value:number(result?.knockback),title:'Raw knockback, including weight, staling, crouch canceling and smash-charge interruption.'},
    {label:'Launch Speed',value:number(result?.launchSpeed,4),title:'Initial movement per frame: knockback × 0.03.'},
    {label:'Frames of Hitstun',value:number(result?.hitstun),title:'FLOOR(knockback × 0.4). The workbook notes that effective hitstun is one frame shorter.'},
    {label:'Attacker Hitlag',value:number(result?.attackerHitlag),title:'FLOOR((staled damage / 3 + 3) × hitlag multiplier).'},
    {label:'Victim Hitlag (on Hit)',value:number(result?.victimHitlag),title:'Workbook formula: FLOOR(CC × FLOOR(staled damage / 3 + 3)). Hitlag multiplier is applied to attacker hitlag only in the source.'},
    {label:'Victim Hitlag (on Shield)',value:number(result?.shieldHitlag),title:'Workbook formula: FLOOR(staled damage / 3 + 3).'},
    {label:'Victim Shieldstun',value:number(result?.shieldstun),title:'Workbook formula: FLOOR((staled damage + 4.45) / 2.235).'},
    {label:'Frame Advantage on Shield',value:result?.shieldAdvantage==null?'—':`${result.shieldAdvantage>0?'+':''}${number(result.shieldAdvantage)}`,title:'Shieldstun − endlag + victim shield hitlag − attacker hitlag. Landing hits subtract one extra frame.'},
  ];
  return <div className="hit-calculators">
    <section className="calculator-section asdi-calculator" aria-label="ASDI down calculator">
      <div className="calculator-heading"><h3>ASDI down thresholds</h3><span className="selected-hit-label">{hit?`Hitbubble ${hitId}`:'Select a hitbubble'}</span></div>
      <div className="victim-controls"><label>Victim<select aria-label="Victim fighter" value={victimId} onChange={event=>setVictimId(event.target.value)}>{victims.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><span className="victim-weight" title={weightSource}>{pending?'Loading weight…':weight===undefined?'Weight unavailable':`Weight ${number(weight)}`}<small>{weight!==undefined?weightSource:''}</small></span></div>
      <div className="threshold-results"><div title="The template solves for 120 raw KB, equivalent to 80 KB after crouch canceling. Uses current staling and interrupted-smash settings."><span>Break CC + ASDI down</span><strong>{threshold(ccThreshold)}</strong><small title={fixedKnockback?'Set knockback or zero growth: percent does not change KB.':undefined}>120 KB{fixedKnockback?' · fixed':''}</small></div><div title="The template solves for 80 raw KB. Angle is not part of the template's threshold model."><span>Tumble / break ASDI down</span><strong>{threshold(tumbleThreshold)}</strong><small title={fixedKnockback?'Set knockback or zero growth: percent does not change KB.':undefined}>80 KB{fixedKnockback?' · fixed':''}</small></div></div>
      {victimError&&<p className="calculator-note" role="status">{referenceWeight!==undefined?'Using Attributes reference; fighter data could not load.':victimError} <button onClick={()=>setRetry(v=>v+1)}>Retry</button></p>}
      <p className="calculator-note calculator-selection-hint" aria-hidden={!!hit}>Select a hitbubble above to calculate.</p>
    </section>
    <section className="calculator-section knockback-calculator" aria-label="Knockback calculator">
      <div className="calculator-heading"><h3>Knockback &amp; stun</h3><span>{hit?`${number(hit.damage)}% damage · ${number(hit.hitlag_mult)}× hitlag`:'No active hitbubble selected'}</span></div>
      <div className="calculator-inputs"><label>Victim %<input aria-label="Victim percent before hit" type="number" min="0" step="1" value={percent} onChange={event=>setPercent(event.target.value)}/></label><label title={aerialKey?'Calculated from aerial landing lag, halved and rounded down when L-canceled landing is enabled.':'Calculated from IASA minus the current contact frame, or total frames minus contact when IASA is absent.'}>Endlag (f)<input aria-label="Endlag frames" type="number" readOnly value={endlag??''} placeholder="Unavailable"/></label><label className="calculator-check"><input type="checkbox" checked={crouch} onChange={event=>setCrouch(event.target.checked)}/>Crouch cancel</label></div>
      <div className="knockback-results" aria-live="polite">{metrics.map(metric=><div key={metric.label} title={metric.title}><span>{metric.label}</span><strong>{metric.value}</strong></div>)}</div>
      <details className="calculator-options"><summary>More calculation settings{slots.some(Boolean)?` · ${slots.filter(Boolean).length} stale slots`:''}</summary><div className="calculator-toggle-options"><label><input type="checkbox" checked={chargingSmash} onChange={event=>setChargingSmash(event.target.checked)}/>Victim charging smash (1.2× KB)</label><label><input type="checkbox" checked={isThrow} onChange={event=>setIsThrow(event.target.checked)}/>Treat as throw (weight 100)</label>{aerialKey&&<label><input type="checkbox" checked={lCancel} onChange={event=>setLCancel(event.target.checked)}/>L-canceled landing</label>}</div><fieldset className="stale-slots"><legend>Stale queue · newest to oldest</legend>{stalePenalties.map((penalty,i)=><label key={i} title={`Slot ${i+1}: ${Math.round(penalty*100)}% damage reduction`}><input aria-label={`Stale queue slot ${i+1}`} type="checkbox" checked={slots[i]} onChange={event=>setSlots(previous=>previous.map((value,j)=>j===i?event.target.checked:value))}/>{i+1}</label>)}</fieldset><p className="calculator-note">Workbook formulas and rounding. ASDI values use the 80/120 KB model; angle is excluded. Shield stun uses damage; extra shield damage and effects are outside this workbook model. {aerialKey?'Endlag uses landing lag and the L-cancel setting; aerial advantage assumes landing at contact.':'Endlag follows the selected contact frame.'}</p></details>
    </section>
  </div>;
}
