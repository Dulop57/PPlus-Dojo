import {describe,it,expect} from 'vitest';
import {referenceStudyCards,fighterStudyCards,isNormalMoveStat,bubbleAnswerCells} from '../src/data/study-cards';
import {extractStudyHits} from '../scripts/study-hits.mjs';
import {fixtureFrame,sandboxMove} from '../src/data/sandbox';
import {selectedStudyCards,deckHasSelectedStats} from '../src/data/study-selection';
import configuration from '../src/data/study-selection.json';
import type {StudyFighter} from '../src/data/study-types';
describe('User-selected flashcard stats',()=>{
  const raw=referenceStudyCards(),selected=selectedStudyCards(raw);
  it('Includes all six get-up dodge actions without hitbubbles under Dodges with separate timings',()=>{
    const names=['DownStandU','DownStandD','DownForwardU','DownForwardD','DownBackU','DownBackD'];
    const fighter:StudyFighter={schemaVersion:1,id:'marth',name:'Marth',sourcePath:'fixture',attributes:{},hits:[],warnings:[],moves:names.map((internalName,index)=>({id:`${internalName}-${index}`,internalName,path:'fixture',stats:{animation_frames:40+index,iasa:index===0?null:30+index,intangible_windows:index===0?[]:[[1,10],[12,15]],active_windows:null},warnings:[]}))};
    const cards=selectedStudyCards(fighterStudyCards(fighter,'unverified','attributes'));
    expect(cards).toHaveLength(12);
    expect(cards.every(c=>c.topic==='Attributes · Dodges'&&c.source.includes('unverified'))).toBe(true);
    for(const [index,name]of names.entries()){
      const pair=cards.filter(c=>c.move?.id===`${name}-${index}`);
      expect(pair.map(c=>c.field)).toEqual(['Intangible frames','Actionable']);
      expect(pair.map(c=>c.answer)).toEqual([index===0?'None':'1–10, 12–15',String(index===0?40:30+index)]);
      expect(pair.every(c=>c.href.includes(`${name}-${index}`))).toBe(true);
    }
    expect(new Set(cards.map(c=>c.id)).size).toBe(12);
  });
  it('Removes deleted source stats and coordinates and enables only complete bubble tables',()=>{
    expect(configuration.entries).toHaveLength(61);
    expect(deckHasSelectedStats('hitboxes')).toBe(true);
    expect(selected.some(c=>c.topic==='Attributes · Raw Data'||c.topic==='Attributes · Calculations'||c.topic==='Stage coordinates'||c.topic==='Attributes · Grab Range'||c.topic==='Attributes · Aerial Landing Lags')).toBe(false);
    const fixture:StudyFighter={schemaVersion:1,id:'marth',name:'Marth',sourcePath:'fixture',attributes:{weight:87,camera_size_front:5},hits:[],moves:[{id:'Attack11-1',internalName:'Attack11',path:'move',stats:{animation_frames:20,landing_lag:3,iasa:15},warnings:[]}],warnings:[]};
    const cards=selectedStudyCards(fighterStudyCards(fixture,'unverified'));
    expect(cards.map(c=>c.field)).toEqual(['First Actionable Frame']);
    expect(cards[0].answer).toBe('15');
  });
  it('Merges Boost Grab value and rank into one named card per fighter',()=>{
    const cards=selected.filter(c=>c.subjectId==='marth'&&c.topic==='Attributes · Main'&&c.field.startsWith('Boost Grab'));
    expect(cards).toHaveLength(1);expect(cards[0].field).toBe('Boost Grab');expect(cards[0].question).toBe('Marth: what is Boost Grab?');
    const value=raw.find(c=>c.subjectId==='marth'&&c.field==='Boost Grab · Distance')!,rank=raw.find(c=>c.subjectId==='marth'&&c.field==='Boost Grab rank')!;
    expect(cards[0].answer).toBe(`${value.answer}\nRank: #${rank.answer}`);expect(cards[0].id).toBe(value.id);
  });
  it('Asks for every active window even when IASA is recorded, without first-active-frame cards',()=>{
    const fighter:StudyFighter={schemaVersion:1,id:'marth',name:'Marth',sourcePath:'fixture',attributes:{},hits:[],warnings:[],moves:[15,0,null,undefined].map((iasa,index)=>({id:`move-${index}`,internalName:'AttackAirF',path:'move',stats:{first_active_frame:4,active_windows:[[4,6],[8,10]],...(iasa===undefined?{}:{iasa})},warnings:[]}))};
    const cards=selectedStudyCards(fighterStudyCards(fighter,'unverified','attributes'));
    const active=cards.filter(c=>c.field==='Active Frames');
    expect(active).toHaveLength(4);expect(active.every(c=>c.answer==='4-6, 8-10')).toBe(true);
    expect(cards.some(c=>c.field==='First active frame'||c.field==='IASA')).toBe(false);
  });
  it('Combines animation length and IASA into the lower First Actionable Frame',()=>{
    const fighter:StudyFighter={schemaVersion:1,id:'marth',name:'Marth',sourcePath:'fixture',attributes:{},hits:[],warnings:[],moves:[40,50,51,null,undefined].map((iasa,index)=>({id:`move-${index}`,internalName:'AttackAirN',path:'move',stats:{animation_frames:50,...(iasa===undefined?{}:{iasa})},warnings:[]}))};
    const cards=selectedStudyCards(fighterStudyCards(fighter,'unverified','attributes'));
    expect(cards).toHaveLength(5);
    expect(cards.every(c=>c.field==='First Actionable Frame')).toBe(true);
    expect(cards.map(c=>c.answer)).toEqual(['40','50','50','50','50']);
    fighter.moves=[{id:'iasa-only',internalName:'AttackAirF',path:'move',stats:{iasa:0},warnings:[]},{id:'unavailable',internalName:'AttackAirB',path:'move',stats:{animation_frames:null,iasa:null},warnings:[]}];
    const fallback=selectedStudyCards(fighterStudyCards(fighter,'unverified','attributes'));
    expect(fallback).toHaveLength(1);expect(fallback[0].answer).toBe('0');
  });
  it('Keeps Slip Attack timings in Get-up options and removes other subaction stat cards',()=>{
    const fighter:StudyFighter={schemaVersion:1,id:'marth',name:'Marth',sourcePath:'fixture',attributes:{},hits:[],warnings:[],moves:[
      {id:'slip-attack',internalName:'SlipAttack',path:'move',stats:{animation_frames:50,active_windows:[[19,20],[25,26]]},warnings:[]},
      {id:'other-subaction',internalName:'DownDamageU',path:'move',stats:{animation_frames:40,active_windows:[[8,10]]},warnings:[]},
    ]};
    const cards=selectedStudyCards(fighterStudyCards(fighter,'unverified','attributes'));
    expect(cards.map(c=>[c.topic,c.move?.name,c.field])).toEqual([
      ['Move stats · Get-up options','Slip Attack','Active Frames'],
      ['Move stats · Get-up options','Slip Attack','First Actionable Frame'],
    ]);
    expect(cards.some(c=>c.topic==='Move stats · Other subactions')).toBe(false);
  });
  it('Omits special-attack timing and hitbubble cards while keeping other move cards',()=>{
    const specialEntry={id:'SpecialN-1',internalName:'SpecialN',path:'special.json',totalFrames:sandboxMove.frames.length,warnings:[],sha256:''};
    const specialHit=extractStudyHits({...sandboxMove,fighterId:'marth',moveId:'SpecialN-1'},specialEntry);
    const fighter:StudyFighter={schemaVersion:1,id:'marth',name:'Marth',sourcePath:'fixture',attributes:{},warnings:[],hits:specialHit,moves:[
      {id:'SpecialN-1',internalName:'SpecialN',path:'special.json',stats:{animation_frames:30,iasa:22,active_windows:[[8,10]]},warnings:[]},
      {id:'AttackAirF-1',internalName:'AttackAirF',path:'aerial.json',stats:{animation_frames:30,iasa:22,active_windows:[[8,10]]},warnings:[]},
    ]};
    const cards=fighterStudyCards(fighter,'unverified');
    expect(cards.some(c=>c.move?.category==='Specials')).toBe(false);
    expect(cards.some(c=>c.topic==='Move stats · Aerials'&&c.move?.id==='AttackAirF-1')).toBe(true);
    expect(cards.some(c=>c.deck==='hitboxes'&&c.hit?.internalName==='SpecialN')).toBe(false);
  });
  it('Combines workbook grab timing endpoints into Active Frames cards',()=>{
    const cards=selected.filter(c=>c.topic==='Attributes · Grab Timings');
    expect(cards.some(c=>c.field==='First active frame'||c.field==='Last active frame')).toBe(false);
    const active=cards.filter(c=>c.field==='Active Frames');
    expect(active.length).toBeGreaterThan(0);
    expect(active.every(c=>/^\d+(?:-\d+)?$/.test(c.answer))).toBe(true);
  });
  it('Keeps all retained components when merging metrics with several values',()=>{
    const card=selected.find(c=>c.subjectId==='fox'&&c.field==='Dash Acceleration')!;
    for(const component of ['A','B','Sum'])expect(card.answer).toContain(`${component}: ${raw.find(c=>c.subjectId==='fox'&&c.field===`Dash Acceleration · ${component}`)!.answer}`);
    expect(card.answer).toContain('Rank: #');
    expect(selected.some(c=>c.topic==='Attributes · Main'&&c.field.endsWith(' rank'))).toBe(false);
    expect(new Set(selected.map(c=>c.id)).size).toBe(selected.length);
  });
  it('Keeps normal tilts/smashes and excludes numbered, angled and charge variants from move-stat cards',()=>{
    for(const name of ['AttackS3','AttackS3S','AttackHi3','AttackLw3','AttackS4','AttackS4S','AttackHi4','AttackLw4'])expect(isNormalMoveStat(name),name).toBe(true);
    for(const name of ['AttackS3S_1','AttackHi3_1','AttackS3Hi','AttackS3Lw','AttackS4Hi','AttackS4Lw','AttackS4S_2','AttackHi4Start','AttackLw4Hold'])expect(isNormalMoveStat(name),name).toBe(false);
    const names=['AttackS3S','AttackS3Hi','AttackS4S','AttackS4S_1','AttackHi4Hold'];
    const fighter:StudyFighter={schemaVersion:1,id:'marth',name:'Marth',sourcePath:'fixture',attributes:{},hits:[],moves:names.map(name=>({id:name,internalName:name,path:'move',stats:{animation_frames:20,intangible_windows:[[1,3]],invincible_windows:[[2,4]]},warnings:[]})),warnings:[]};
    const cards=selectedStudyCards(fighterStudyCards(fighter,'unverified','attributes'));
    expect(cards).toHaveLength(2);expect(cards.every(c=>c.field==='First Actionable Frame')).toBe(true);expect(cards.every(c=>!c.question.includes('(raw subaction)'))).toBe(true);
  });
  it('Uses bubble ID 2 at its recorded frame, omitting radius and unrelated parameter questions',()=>{
    const frame={...fixtureFrame(7),index:0};frame.hit_boxes[0]={...frame.hit_boxes[0],hitbox_id:2,next_size:7.5};
    const values=frame.hit_boxes[0].next_values;
    if('Hit'in values)frame.hit_boxes[0].next_values={Hit:{...values.Hit,hitbox_id:2,damage:13,trajectory:45,kbg:99,bkb:20,wdsk:0,size:99}};
    const move={...sandboxMove,frames:[frame]},entry={id:'AttackAirF-1',internalName:'AttackAirF',path:'move',totalFrames:1,warnings:[],sha256:''};
    const fighter:StudyFighter={schemaVersion:1,id:'marth',name:'Marth',sourcePath:'fixture',attributes:{},hits:extractStudyHits(move,entry),moves:[],warnings:[]};
    const cards=selectedStudyCards(fighterStudyCards(fighter,'unverified','hitboxes'));
    expect(cards).toHaveLength(1);expect(cards[0].hit?.frame).toBe(1);expect(cards[0].hit?.boxIndex).toBe(0);
    expect(bubbleAnswerCells(cards[0].bubbleAnswer!)).toEqual(['2 / Hit','13%','45°','99','20','0']);
    expect(cards[0].answer).not.toMatch(/Shield|SDI|Clang|Hitlag/);
  });
});
