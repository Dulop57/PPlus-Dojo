import {describe,it,expect} from 'vitest';
import {defaultRosterFraming,rosterImageGeometry} from '../src/data/roster-framing';
import {panStageImage,stageImageGeometry} from '../src/data/stage-framing';

describe('Roster portrait framing',()=>{
  const view={width:240,height:240},source={width:400,height:700};
  it('Keeps initial top alignment and existing in-range crops in place',()=>{
    const oldDefault=stageImageGeometry(view,source,{x:0,y:100,scale:1});
    const current=rosterImageGeometry(view,source);
    expect(current.top).toBeCloseTo(oldDefault.top);expect(current.left).toBe(oldDefault.left);
    const crop={x:0,y:9.96,scale:1.5};
    expect(rosterImageGeometry(view,source,crop).top).toBe(stageImageGeometry(view,source,crop).top);
    expect(defaultRosterFraming(source).y).toBeCloseTo(oldDefault.y);
  });
  it('Moves below the original 100% position without zoom and preserves saved offsets',()=>{
    const initial=rosterImageGeometry(view,source);
    const lower=rosterImageGeometry(view,source,{x:0,y:initial.verticalUnit*1.5,scale:1});
    expect(lower.top).toBeGreaterThan(initial.top);
    expect(lower.y/lower.verticalUnit*100).toBeCloseTo(150);
    const dragged=panStageImage(initial,20,20);
    expect(rosterImageGeometry(view,source,dragged).top-initial.top).toBeCloseTo(20);
    expect(rosterImageGeometry(view,source,dragged).left-initial.left).toBeCloseTo(20);
    expect(rosterImageGeometry(view,source,{x:0,y:initial.limitY,scale:1}).y/initial.verticalUnit*100).toBeCloseTo(300);
  });
  it('Allows vertical movement for square assets whose original range was zero',()=>{
    const initial=rosterImageGeometry(view,view);
    expect(initial.y).toBe(0);expect(initial.limitY).toBeGreaterThan(0);
    expect(rosterImageGeometry(view,view,panStageImage(initial,0,20)).top).toBeCloseTo(20);
  });
});
