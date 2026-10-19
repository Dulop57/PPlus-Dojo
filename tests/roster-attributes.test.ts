import {describe,it,expect} from 'vitest';
import {catalog} from '../src/data/catalog';
import {diamondRows,jumpsquatFill,rosterStats,zScoreFill} from '../src/data/roster-attributes';
describe('Diamond roster attribute data',()=>{
  it('Contains every standard fighter once plus the central Random slot',()=>{
    expect(diamondRows.map(row=>row.length)).toEqual([9,8,9,8,9]);
    const ids=diamondRows.flat().filter(id=>id!=='random');
    expect(new Set(ids).size).toBe(42);expect([...ids].sort()).toEqual(catalog.map(fighter=>fighter.id).sort());
    expect(diamondRows[4][4]).toBe('random');
  });
  it('Maps the minimum, midpoint and maximum Z-scores independently',()=>{
    expect(zScoreFill(-2,-2,2)).toBe(5);expect(zScoreFill(0,-2,2)).toBe(52.5);expect(zScoreFill(2,-2,2)).toBe(100);
    expect(zScoreFill(8,-2,2)).toBe(100);expect(zScoreFill(null,-2,2)).toBeNull();expect(zScoreFill(NaN,-2,2)).toBeNull();expect(zScoreFill(1,1,1)).toBe(52.5);
    for(let metric=0;metric<15;metric++){
      const stats=catalog.map(fighter=>rosterStats(fighter.id)[metric]).filter(stat=>stat.z!==null&&stat.value!==null);
      expect(stats.length).toBeGreaterThan(0);
      expect(stats.reduce((a,b)=>a.z!<b.z!?a:b).fill).toBeCloseTo(5);
      expect(stats.reduce((a,b)=>a.z!>b.z!?a:b).fill).toBeCloseTo(100);
    }
  });
  it('Reads source values by fighter identity, including workbook aliases and acceleration Sum',()=>{
    const stat=(id:string,name:string)=>rosterStats(id).find(stat=>stat.name===name)!;
    expect(stat('marth','Weight').value).toBe(87);
    expect(stat('captain-falcon','Weight').value).toBe(99);
    expect(stat('king-dedede','Weight').value).toBe(107);
    expect(stat('game-watch','Weight').value).toBe(75);
    expect(stat('wario','Horizontal Air Accel.').value).toBeCloseTo(.33);
    expect(stat('jigglypuff','Horizontal Air Accel.').value).toBeCloseTo(.28);
    expect(rosterStats('not-a-fighter')).toHaveLength(16);
    expect(rosterStats('not-a-fighter').every(stat=>stat.fill===null&&stat.value===null)).toBe(true);
  });
  it('Uses the 5/4/3-frame jumpsquat groups rather than Z-score normalization',()=>{
    expect(jumpsquatFill(5)).toBe(33);expect(jumpsquatFill(4)).toBe(66);expect(jumpsquatFill(3)).toBe(100);expect(jumpsquatFill(null)).toBeNull();expect(jumpsquatFill(7)).toBeNull();
    expect(rosterStats('bowser')[15]).toMatchObject({value:5,fill:33});
    expect(rosterStats('mario')[15]).toMatchObject({value:4,fill:66});
    expect(rosterStats('fox')[15]).toMatchObject({value:3,fill:100});
  });
});
