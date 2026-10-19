import {describe,expect,it} from 'vitest';
import source from '../src/data/smash-timing.json';
import {applyCheckedSmashTiming,checkedSmashTiming,presentSmash} from '../src/data/smash-sequences';
import {summarize,moveLabel,smashStartFor} from '../src/data/moves';
import {fighterStudyCards} from '../src/data/study-cards';
import {selectedStudyCards} from '../src/data/study-selection';
import {fixtureFrame,sandboxMove} from '../src/data/sandbox';
import type {FighterData,MoveData} from '../src/data/types';
const animation=(fighterId:string,name:string,total:number,windows:number[][]):MoveData=>({...sandboxMove,fighterId,moveId:name,name,iasa:null,frames:Array.from({length:total},(_,index)=>({...fixtureFrame(7),index,hit_boxes:windows.some(([a,b])=>index+1>=a&&index+1<=b)?fixtureFrame(7).hit_boxes:[]}))});
function fighterFixture(id:'link'|'pit'|'ike'|'rob'|'snake',names:string[]){
  const timings=source.fighters[id] as Record<string,{sha256:string;dependencies:Record<string,string>}>;
  const moves=names.map(name=>({id:name,internalName:name,path:name,totalFrames:60,warnings:[],sha256:timings[name]?.sha256??Object.values(timings).map(t=>t.dependencies[name]).find(Boolean)??''}));
  return {schemaVersion:1,id,name:id,internalName:id,attributes:{},warnings:[],moves} as FighterData;
}
describe('Checked smash timing',()=>{
  it('Retimes complete active windows, retains parameters, marks reused geometry and never mutates the raw move',()=>{
    const raw=animation('king-dedede','AttackHi4',30,[[17,23]]),before=JSON.stringify(raw);
    const move=applyCheckedSmashTiming(raw,{active:[[17,26]],actionable:57,cells:'D6:E6'});
    expect(summarize(move).active).toEqual([[17,26]]);expect(summarize(move).iasa).toBe(57);
    expect(move.frames[25].hit_boxes).toBe(raw.frames[22].hit_boxes);expect(move.frames[26].hit_boxes).toEqual([]);
    expect(move.timing?.geometryRetimed).toBe(true);expect(JSON.stringify(raw)).toBe(before);
  });
  it('Displays checked article timing without fabricating collision geometry',()=>{
    const raw=animation('ness','AttackHi4',50,[]),move=applyCheckedSmashTiming(raw,{active:[[10,29]],actionable:47,cells:'D27:E27'});
    expect(summarize(move).active).toEqual([[10,29]]);expect(move.frames.every(f=>!f.hit_boxes.length)).toBe(true);expect(move.timing?.missingGeometry).toBe(true);
  });
  it('Retains attacks inside R.O.B. and Snake start phases without double-counting the transition',async()=>{
    for(const id of ['rob','snake'] as const){
      const f=fighterFixture(id,['AttackHi4Start','AttackHi4']);
      const start=animation(id,'AttackHi4Start',id==='rob'?8:24,id==='rob'?[[5,8]]:[[11,12]]);
      const release=animation(id,'AttackHi4',id==='rob'?37:28,id==='rob'?[[5,9]]:[]);
      const result=await presentSmash(f,f.moves[1],async name=>name===start.name?start:release);
      expect(summarize(result).active).toEqual(id==='rob'?[[5,7],[12,16]]:[[11,12]]);
      expect(result.timing?.geometryRetimed).toBe(false);
    }
  });
  for(const [id,startName,firstName,secondName,firstActive,secondActive,expected] of [
    ['ike','AttackLw4Start','AttackLw41','AttackLw42',[8,11],[11,15],[[12,15],[26,30]]],
    ['link','AttackS4Start','AttackS4S','AttackS4S2',[5,8],[10,14],[[14,17],[28,32]]],
    ['pit','AttackS4Start','AttackS4S','AttackS4S2',[6,8],[5,8],[[10,12],[18,21]]],
  ] as const){
    it(`Joins ${id}'s start, first hit and follow-up on one global timeline`,async()=>{
      const f=fighterFixture(id,[startName,firstName,secondName]),opening=id==='ike'?5:id==='link'?10:5;
      const data=new Map<string,MoveData>([[startName,animation(id,startName,opening,[])],[firstName,animation(id,firstName,60,[[...firstActive]])],[secondName,animation(id,secondName,60,[[...secondActive]])]]);
      const first=await presentSmash(f,f.moves[1],async path=>data.get(path)!);
      const second=await presentSmash(f,f.moves[2],async path=>data.get(path)!);
      expect(summarize(first).active).toEqual([expected[0]]);expect(summarize(second).active).toEqual(expected);
      expect(summarize(first).iasa).toBe(id==='ike'?40:id==='link'?49:34);expect(summarize(second).iasa).toBe(id==='ike'?62:id==='link'?68:53);
      expect(moveLabel(secondName).category).toBe('Smashes');expect(smashStartFor(f.moves[2],f.moves,id)).toBe(f.moves[0]);
      expect(checkedSmashTiming(f,{...f.moves[2],sha256:'changed'})).toBeUndefined();
      const changed={...f,moves:f.moves.map((m,i)=>i===0?{...m,sha256:'changed'}:m)};
      expect(checkedSmashTiming(changed,f.moves[2])).toBeUndefined();
    });
  }
  it('Keeps the new checked actionable value and ID while linking smash cards to the full viewer',()=>{
    const cards=selectedStudyCards(fighterStudyCards({schemaVersion:1,id:'fox',name:'Fox',attributes:{},sourcePath:'index',hits:[],warnings:[],moves:[{id:'AttackHi4-1',internalName:'AttackHi4',path:'move',view:'full',stats:{animation_frames:30,iasa:21,first_actionable_frame:42,active_windows:[[7,16]]},warnings:[]}]},'unverified'));
    expect(cards.map(c=>c.answer)).toEqual(['42','7-16']);expect(cards.every(c=>!c.href.includes('view=raw'))).toBe(true);
    expect(cards[0].id).toBe('pplus3.2:move:fox:AttackHi4-1:first_actionable_frame');
  });
  it('Removes Olimar attack and bubble cards but preserves get-up dodge cards',()=>{
    const cards=fighterStudyCards({schemaVersion:1,id:'olimar',name:'Olimar',sourcePath:'index',attributes:{},warnings:[],hits:[],moves:['Attack11','AttackAirF','DownAttackU','DownStandU'].map(name=>({id:name,internalName:name,path:name,stats:{animation_frames:30,active_windows:[[5,6]],intangible_windows:[[1,10]]},warnings:[]}))},'unverified');
    expect(cards).toHaveLength(2);expect(cards.every(c=>c.topic==='Attributes · Dodges')).toBe(true);
  });
  it('Labels only the supported follow-ups as complete sequences',()=>{
    expect(moveLabel('AttackS4S2','link').name).toContain('full sequence');
    expect(moveLabel('AttackS4S2','snake').name).not.toContain('full sequence');
    expect(moveLabel('AttackLw42','lucas').name).not.toContain('full sequence');
  });
});
