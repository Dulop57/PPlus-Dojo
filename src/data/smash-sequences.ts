import checkedSource from './smash-timing.json';
import {combineSmash, ranges, smashStartFor} from './moves';
import type {FighterData, Frame, FrameRange, MoveData, MoveIndex} from './types';

type CheckedTiming={sha256:string;family:string;active:FrameRange[]|null;actionable:number;cells:string;dependencies:Record<string,string>;prefix?:string};
const checked=checkedSource.fighters as unknown as Record<string,Record<string,CheckedTiming>>;
const enabled=(frame:Frame)=>frame.hit_boxes.some(h=>'Grab' in h.next_values||h.next_values.Hit.enabled);

export function checkedSmashTiming(fighter:FighterData,entry:MoveIndex){
  const timing=checked[fighter.id]?.[entry.internalName];
  if(!timing||timing.sha256!==entry.sha256)return undefined;
  // A re-extraction must be rechecked, including its start and preceding attack.
  if(Object.entries(timing.dependencies).some(([name,sha])=>!fighter.moves.some(m=>m.internalName===name&&m.sha256===sha)))return undefined;
  return timing;
}

function append(prefix:MoveData,release:MoveData,count:number):MoveData{
  const opening=prefix.frames.slice(0,count),offset=opening.at(-1)??{x_pos:0,y_pos:0};
  return {...release,frames:[...opening,...release.frames.map(f=>({...f,x_pos:f.x_pos+offset.x_pos,y_pos:f.y_pos+offset.y_pos,sourceMoveId:release.moveId}))].map((f,index)=>({...f,index})),
    extent:{left:Math.min(prefix.extent.left,release.extent.left+offset.x_pos),right:Math.max(prefix.extent.right,release.extent.right+offset.x_pos),up:Math.max(prefix.extent.up,release.extent.up+offset.y_pos),down:Math.min(prefix.extent.down,release.extent.down+offset.y_pos)},
    warnings:[...new Set([...prefix.warnings,...release.warnings])],bad_interrupts:prefix.bad_interrupts||release.bad_interrupts,
    iasa:release.iasa===null?null:release.iasa+opening.length,sequence:prefix.sequence};
}

/** Align extracted poses to checked timing. No new collision positions or values are generated. */
export function applyCheckedSmashTiming(move:MoveData,timing:Pick<CheckedTiming,'active'|'actionable'|'cells'>):MoveData{
  if(!move.frames.length)return move;
  const active=timing.active;
  const recorded=ranges(move.frames.map(enabled));
  const total=Math.max(move.frames.length,timing.actionable,active?.at(-1)?.[1]??0);
  const same=JSON.stringify(recorded)===JSON.stringify(active??[]);
  const missing=!!active?.length&&!recorded.length;
  // Match each active/inactive run independently. Extending an active run reuses
  // extracted poses; it is explicitly marked below, not presented as new geometry.
  const runFrames=(windows:FrameRange[],length:number)=>{
    const result:{from:number;through:number;active:boolean}[]=[];let next=1;
    for(const [from,through] of windows){if(next<from)result.push({from:next,through:from-1,active:false});result.push({from,through,active:true});next=through+1;}
    if(next<=length)result.push({from:next,through:length,active:false});return result;
  };
  const original=runFrames(recorded,move.frames.length),desired=runFrames(active??[],total);
  const sameRuns=original.length===desired.length&&original.every((r,i)=>r.active===desired[i].active);
  if(!same&&!missing&&active!==null&&!sameRuns)throw new Error('The checked windows cannot be matched to the extracted collision phases. Use the raw subaction to inspect the source.');
  const frames=Array.from({length:total},(_,i)=>{
    let sourceIndex=Math.min(i,move.frames.length-1);
    if(!same&&!missing&&active!==null){
      const runIndex=desired.findIndex(r=>i+1>=r.from&&i+1<=r.through),run=desired[runIndex];
      const sourceRun=original[runIndex];sourceIndex=sourceRun.from-1+Math.min(sourceRun.through-sourceRun.from,Math.floor((i+1-run.from)*(sourceRun.through-sourceRun.from+1)/(run.through-run.from+1)));
    }
    const source=move.frames[sourceIndex],isActive=(active??[]).some(([a,b])=>i+1>=a&&i+1<=b);
    return {...source,index:i,hit_boxes:active!==null&&!isActive?[]:source.hit_boxes,interruptible:i+1>=timing.actionable};
  });
  const notes=[`Smash timing: owner's ${checkedSource.source}, ${checkedSource.sheet}!${timing.cells}.`];
  if(missing)notes.push('Active timing is checked; this attack has no extracted collision geometry. Hitboxes are unavailable.');
  else if(!same)notes.push('Collision poses are retimed from the unverified extraction to the checked active windows; geometry and hit parameters are not independently verified.');
  return {...move,frames,iasa:timing.actionable-1,timing:{active,actionable:timing.actionable,source:notes.join(' '),geometryRetimed:!same&&!missing,missingGeometry:missing},warnings:[...move.warnings,...notes]};
}

export async function presentSmash(fighter:FighterData,entry:MoveIndex,read:(path:string)=>Promise<MoveData>):Promise<MoveData>{
  const raw=await read(entry.path),timing=checkedSmashTiming(fighter,entry);
  const start=smashStartFor(entry,fighter.moves,fighter.id);
  if(!start)return raw;
  const opening=await read(start.path);
  if(!timing)return combineSmash(opening,raw);
  let combined:MoveData;
  if(timing.prefix){
    const firstEntry=fighter.moves.find(m=>m.internalName===timing.prefix)!;
    const first=await presentSmash(fighter,firstEntry,read);
    const rawActive=ranges(raw.frames.map(enabled))[0]?.[0];
    const secondActive=timing.active?.at(-1)?.[0];
    if(rawActive===undefined||secondActive===undefined)throw new Error('The checked follow-up has no matching extracted attack.');
    combined=append(first,raw,secondActive-rawActive);
  }else{
    const rawActive=ranges(raw.frames.map(enabled))[0]?.[0],target=timing.active?.[0]?.[0];
    const startHasHits=opening.frames.slice(0,-1).some(enabled);
    const count=!startHasHits&&rawActive!==undefined&&target!==undefined?target-rawActive:opening.frames.length-1;
    if(count<0||count>opening.frames.length)throw new Error('The checked smash start cannot be matched to its extracted frames.');
    // combineSmash drops one transition frame. Supply precisely the checked
    // opening, retaining all exported frames when the sheet requires them.
    combined=combineSmash({...opening,frames:[...opening.frames.slice(0,count),opening.frames.at(-1)!]},raw);
    combined={...combined,frames:combined.frames.map((f,i)=>({...f,sourceMoveId:i<count?opening.moveId:raw.moveId}))};
  }
  return applyCheckedSmashTiming(combined,timing);
}
