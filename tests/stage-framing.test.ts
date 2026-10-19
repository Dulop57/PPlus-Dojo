import {describe,it,expect} from 'vitest';
import {stageImageGeometry,panStageImage,migrateStageFraming} from '../src/data/stage-framing';
const source={width:889,height:500};
const view={width:480,height:112};
describe('Stage banner framing',()=>{
  it('Moves the uncropped source exactly one pixel per drag pixel',()=>{
    const before=stageImageGeometry(view,source,{x:0,y:0,scale:1.5});
    const after=stageImageGeometry(view,source,panStageImage(before,27,-16));
    expect(after.left-before.left).toBeCloseTo(27,9);
    expect(after.top-before.top).toBeCloseTo(-16,9);
    expect(after.width/after.height).toBeCloseTo(source.width/source.height,9);
  });
  it('Always fills the banner when panned to an edge or resized',()=>{
    for(const width of [180,400,900])for(const scale of [1,1.2,3.5])for(const x of [-100,0,100])for(const y of [-100,0,100]){
      const g=stageImageGeometry({width,height:112},source,{x,y,scale});
      expect(g.left).toBeLessThanOrEqual(1e-9);expect(g.top).toBeLessThanOrEqual(1e-9);
      expect(g.left+g.width).toBeGreaterThanOrEqual(width-1e-9);expect(g.top+g.height).toBeGreaterThanOrEqual(112-1e-9);
    }
  });
  it('Keeps the source point at the center stable while zooming',()=>{
    const before=stageImageGeometry(view,source,{x:5,y:-12,scale:1.5});
    const after=stageImageGeometry(view,source,{x:5,y:-12,scale:2});
    expect((view.width/2-before.left)/before.width).toBeCloseTo((view.width/2-after.left)/after.width,9);
    expect((view.height/2-before.top)/before.height).toBeCloseTo((view.height/2-after.top)/after.height,9);
  });
  it('Restores the old rendered offset without carrying over blank edges',()=>{
    const legacy={x:20,y:-39,scale:1.5};
    const migrated=migrateStageFraming(legacy,view,source);
    const g=stageImageGeometry(view,source,migrated),center=stageImageGeometry(view,source,{x:0,y:0,scale:legacy.scale});
    expect(g.left-center.left).toBeCloseTo(.18*legacy.x/100*view.width,9);
    expect(g.top-center.top).toBeCloseTo(.18*legacy.y/100*view.height,9);
    expect(migrateStageFraming({x:100,y:100,scale:.5},view,source).scale).toBe(1);
  });
});
