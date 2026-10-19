import {describe,expect,it} from 'vitest';
import source from '../src/data/reference/attributes.json';
import {rankings,type ReferenceBook} from '../src/data/reference';
import {hasScatterGraph,scatterAxes,scatterDomains,scatterFighters} from '../src/data/attribute-scatter';
const metrics=rankings((source as ReferenceBook).sheets.find(sheet=>sheet.name==='Main')!);
describe('Three-attribute fighter scatter data',()=>{
  it('joins all three rankings by fighter identity despite different ranking orders',()=>{
    const fighters=scatterFighters(metrics);
    expect(fighters).toHaveLength(42);expect(new Set(fighters.map(fighter=>fighter.id)).size).toBe(42);
    expect(fighters.find(fighter=>fighter.id==='fox')?.values).toEqual({weight:75,gravity:.23,fallSpeed:2.8});
    for(const fighter of fighters)for(const axis of scatterAxes){
      const row=metrics.find(metric=>metric.name===axis.metric)!.rows.find(row=>String(row[1].v)===fighter.name||fighter.name==='Captain Falcon'&&row[1].v==='C. Falcon'||fighter.name==='King Dedede'&&row[1].v==='DeDeDe');
      if(row)expect(fighter.values[axis.key]).toBe(row[2].v);
    }
    expect(scatterFighters(metrics.map(metric=>({...metric,rows:[...metric.rows].reverse()})))).toEqual(fighters);
  });
  it('omits fighters with missing coordinates and keeps full-roster domains while filtering',()=>{
    expect(scatterFighters(metrics.filter(metric=>metric.name!=='Max Fall Speed'))).toEqual([]);
    const fighters=scatterFighters(metrics),domains=scatterDomains(fighters);
    expect(domains.weight.minimum).toBe(50);expect(domains.fallSpeed.minimum).toBe(1);
    for(const fighter of fighters)for(const axis of scatterAxes){expect(fighter.values[axis.key]).toBeGreaterThanOrEqual(domains[axis.key].minimum);expect(fighter.values[axis.key]).toBeLessThanOrEqual(domains[axis.key].maximum);}
    expect(hasScatterGraph('Weight')).toBe(true);expect(hasScatterGraph('Gravity (Falling Acceleration)')).toBe(true);expect(hasScatterGraph('Max Fall Speed')).toBe(true);expect(hasScatterGraph('Fast Fall Speed')).toBe(false);
  });
});
