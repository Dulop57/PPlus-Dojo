import { describe,expect,it } from 'vitest';
import { categoryOrder, combineSmash, ranges, smashStartFor, summarize, moveLabel, moveListCategory } from '../src/data/moves';
import { sandboxMove, fixtureFrame } from '../src/data/sandbox';
import { parseRoute,moveHref } from '../src/router';
import { hitTransform,hurtTransform,matrixFromBone } from '../src/viewer/geometry';
import { Vector3 } from 'three';

describe('Frame and summary boundaries',()=>{
  it('Preserves disjoint multi-hit windows and inclusive final frames',()=>{expect(ranges([false,true,true,false,true])).toEqual([[2,3],[5,5]]);expect(ranges([true,true])).toEqual([[1,2]]);expect(ranges([])).toEqual([]);});
  it('Displays IASA as 1-based and computes autocancel and floor L-cancel',()=>{const result=summarize(sandboxMove);expect(result.active).toEqual([[6,14]]);expect(result.iasa).toBe(21);expect(result.autocancel).toEqual([[1,3],[20,24]]);expect(result.lcancel).toBe(4);});
  it('Skips disabled hitboxes and retains grab/throw events',()=>{const f=fixtureFrame(7);const box=f.hit_boxes[0];if('Hit' in box.next_values)box.next_values.Hit.enabled=false;f.throw={damage:8,trajectory:45,kbg:60,bkb:30,wdsk:0};let move={...sandboxMove,frames:[{...f,index:0}],iasa:null};expect(summarize(move).active).toEqual([]);expect(summarize(move).startup).toBe(1);expect(summarize(move).damage).toEqual([8,8]);move.frames[0].hit_boxes[0].next_values={Grab:{hitbox_id:0,size:3,target:'Ground'}};expect(summarize(move).active).toEqual([[1,1]]);});
  it('Does not invent invincibility for a frame with no hurtboxes',()=>{const f={...fixtureFrame(0),hurt_boxes:[]};expect(summarize({...sandboxMove,frames:[f]}).invincible).toEqual([]);});
});
describe('Move names and routes',()=>{
  it('Recognizes forward smash names, variants and raw phases',()=>{expect(moveLabel('AttackS4S').name).toBe('Forward Smash');expect(moveLabel('AttackS4S_1').name).toBe('Forward Smash · Variant 1');expect(moveLabel('AttackS4Hi').category).toBe('Smashes');expect(moveLabel('AttackHi4Start').category).toBe('Smash subactions');expect(moveLabel('AttackLw4Hold').name).toBe('Down Smash · Charge loop');expect(moveListCategory('AttackHi4Start')).toBe('Other subactions');expect(moveListCategory('AttackLw4Hold')).toBe('Other subactions');expect(categoryOrder).not.toContain('Smash subactions');});
  it('Names unangled Forward Tilt and keeps captured states out of Specials',()=>{
    expect(moveLabel('AttackS3S')).toEqual({name:'Forward Tilt',category:'Tilts',alias:'ftilt'});
    for(const name of ['SpecialNBitten','SpecialAirNDxBittenEnd','SpecialHiCapture','SpecialNEgg','SpecialSDxZitabata'])expect(moveLabel(name).category).toBe('Other subactions');
    for(const name of ['SpecialNStart','SpecialAirS','SpecialHiHold','SpecialLwHit'])expect(moveLabel(name).category).toBe('Specials');
    for(const name of ['DownStandU','DownAttackD','DownForwardU','DownBackD','DownSpotU','PassiveStandF'])expect(moveLabel(name).category).toBe('Get-up options');
    expect(moveLabel('SlipAttack')).toEqual({name:'Slip Attack',category:'Get-up options',alias:'getup'});
    expect(moveListCategory('SlipAttack')).toBe('Slip');
    for(const name of ['Slip','SlipDash','SlipDown','SlipEscapeB','SlipEscapeF','SlipStand','SlipTurn','SlipWait'])expect(moveListCategory(name)).toBe('Slip');
    expect(moveLabel('SlipEscapeB').name).toBe('Slip Escape B');
    expect(moveLabel('DownDamageU').category).toBe('Other subactions');
  });
  it('Preserves raw subaction frame links',()=>{expect(parseRoute(moveHref('fox','AttackS4S-87',9,'raw')).view).toBe('raw');});
  it('Keeps directional and ground/air variants separate',()=>{expect(moveLabel('AttackAirF').alias).toBe('fair');expect(moveLabel('SpecialAirHiStart').name).toBe('Up Special · Air · Start');expect(moveLabel('SpecialHiStart').name).toBe('Up Special · Ground · Start');expect(moveLabel('AttackS3Hi').name).not.toBe(moveLabel('AttackS3Lw').name);expect(moveLabel('CustomThing').name).toBe('CustomThing');});
  it('Survives encoded IDs and invalid frame values',()=>{expect(parseRoute(moveHref('game-watch','AttackAirF-42',9))).toEqual({page:'fighters',fighterId:'game-watch',moveId:'AttackAirF-42',frame:9});expect(parseRoute('#/sandbox?frame=-5').frame).toBe(1);expect(parseRoute('#/sandbox?frame=NaN').frame).toBe(1);expect(parseRoute('#/%zz').page).toBe('missing');});
});
describe('Uncharged smash sequences',()=>{
  it('Offsets active windows and IASA and preserves movement and original geometry',()=>{
    const start={...sandboxMove,name:'AttackS4Start',frames:Array.from({length:4},(_,i)=>({...fixtureFrame(i),x_pos:2,y_pos:3})),warnings:['start warning'],bad_interrupts:true};
    start.frames[3]={...fixtureFrame(7),index:3,x_pos:99,y_pos:99};
    const release={...sandboxMove,name:'AttackS4S',warnings:['release warning']};
    const combined=combineSmash(start,release), summary=summarize(combined);
    expect(summary.startup).toBe(9);expect(summary.active).toEqual([[9,17]]);expect(summary.iasa).toBe(24);expect(summary.total).toBe(27);
    expect(combined.frames[3].index).toBe(3);expect(combined.frames[3].x_pos).toBe(2);expect(combined.frames[3].y_pos).toBe(3);
    expect(combined.frames[8].hit_boxes).toBe(release.frames[5].hit_boxes);expect(release.frames[0].index).toBe(0);expect(release.frames[0].x_pos).toBe(0);
    expect(combined.warnings).toEqual(['start warning','release warning']);expect(combined.bad_interrupts).toBe(true);
    expect(combineSmash(start,{...release,iasa:null}).iasa).toBeNull();
    const single=combineSmash({...start,frames:[start.frames[3]]},release);
    expect(single.frames[0].x_pos).toBe(0);expect(single.sequence?.startFrames).toBe(0);expect(single.frames.length).toBe(release.frames.length);
  });
  it('Does not guess missing or ambiguous start phases',()=>{
    const release={id:'release',internalName:'AttackS4S_1',path:'release',totalFrames:42,warnings:[],sha256:''};
    const start={...release,id:'start',internalName:'AttackS4Start',totalFrames:4};
    expect(smashStartFor(release,[start,release])).toBe(start);expect(smashStartFor(release,[release])).toBeUndefined();expect(smashStartFor(release,[start,{...start,id:'duplicate'}])).toBeUndefined();
    expect(smashStartFor({...release,internalName:'AttackS4Hold'},[start])).toBeUndefined();
    expect(smashStartFor({...release,totalFrames:0},[start])).toBeUndefined();
    expect(()=>combineSmash({...sandboxMove,frames:[]},sandboxMove)).toThrow();expect(()=>combineSmash(sandboxMove,{...sandboxMove,fighterId:'different'})).toThrow();
  });
});
describe('Collision transforms match Brawl coordinate conventions',()=>{
  it('Adds frame horizontal movement to Z, not X',()=>{const f={...fixtureFrame(7),x_pos:20,y_pos:5};const t=hitTransform(f.hit_boxes[0],f);const result=new Vector3(t.end.x,t.end.y,t.end.z).applyMatrix4(t.matrix);expect(result.x).toBe(0);expect(result.y).toBe(t.end.y+5);expect(result.z).toBe(t.end.z+20);});
  it('Uses independent hurtbox endpoints and column-based bone matrices',()=>{const f=fixtureFrame(7);const b=f.hurt_boxes[0];b.bone_matrix.w={x:2,y:3,z:4,w:1};const t=hurtTransform(b,{...f,x_pos:10,y_pos:20});expect(t.end).toEqual({x:0,y:17,z:0});expect(new Vector3(0,17,0).applyMatrix4(t.matrix).toArray()).toEqual([2,40,14]);expect(matrixFromBone(b.bone_matrix).elements.slice(12,16)).toEqual([2,3,4,1]);});
});
