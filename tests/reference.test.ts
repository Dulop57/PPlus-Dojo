import {describe,it,expect} from 'vitest';
import attributes from '../src/data/reference/attributes.json';
import stages from '../src/data/reference/stages.json';
import {columnLetter,displayCell,rankings,stagePlatforms,type ReferenceBook,type StageBook} from '../src/data/reference';
import {parseRoute} from '../src/router';
const attributeBook=attributes as ReferenceBook,stageBook=stages as StageBook;
describe('Imported workbook references',()=>{
  it('Preserves every worksheet, version note, attribution and cached ranking value',()=>{
    expect(attributeBook.sheets).toHaveLength(14);expect(attributeBook.missingCachedValues).toEqual([]);
    expect(attributeBook.sheets.find(s=>s.name==='About')!.cells.find(c=>c.r===1&&c.c===1)!.v).toContain('3.1.5');
    const metrics=rankings(attributeBook.sheets.find(s=>s.name==='Main')!);
    expect(metrics).toHaveLength(28);
    const weight=metrics.find(m=>m.name==='Weight')!;
    expect(weight.rows[0].map(c=>c.v).slice(0,3)).toEqual([1,'Bowser',113]);
    expect(weight.rows.find(row=>row[1].v==='Fox')?.[2].v).toBe(75);
    expect(metrics.find(m=>m.name==='Gravity (Falling Acceleration)')?.rows[0][2].v).toBe(.23);
    expect(stageBook.stages).toHaveLength(20);expect(stageBook.sheets).toHaveLength(3);
  });
  it('Preserves a real zero, unavailable caches, number formatting and sheet addresses',()=>{
    expect(displayCell({v:0})).toBe('0');expect(displayCell({v:null,formula:'=A1'})).toBe('Unavailable');expect(displayCell({v:null})).toBe('—');
    expect(displayCell({v:.12345,format:'0.00%'})).toBe('12.35%');expect(columnLetter(147)).toBe('EQ');
    expect(parseRoute('#/attributes/Main?metric=Max%20Fall%20Speed').metric).toBe('Max Fall Speed');
    expect(parseRoute('#/stages/dream-land/Raw%20data').moveId).toBe('Raw data');
  });
  it('Keeps every Dash/Run Speed Z-score consistent with the ranking mean and deviation',()=>{
    const main=attributeBook.sheets.find(s=>s.name==='Main')!;
    const speed=rankings(main).find(m=>m.name==='Max Dash/Run Speed')!;
    const mean=Number(main.cells.find(c=>c.r===47&&c.c===97)!.v);
    const deviation=Number(main.cells.find(c=>c.r===48&&c.c===97)!.v);
    for(const row of speed.rows){
      expect(Number(row[3].v),String(row[1].v)).toBeCloseTo((Number(row[2].v)-mean)/deviation,8);
    }
    const slowest=speed.rows.reduce((a,b)=>Number(a[2].v)<Number(b[2].v)?a:b);
    expect(Number(slowest[3].v)).toBeLessThan(0);
  });
  it('Uses absolute blastzones rather than mistaking ledge distances for center coordinates',()=>{
    const bf=stageBook.stages.find(s=>s.id==='battlefield')!;
    expect(bf.geometry.blastLeft).toBe(-224);expect(bf.geometry.blastRight).toBe(224);
    expect(bf.summary.side).toBe(155.6);expect(bf.geometry.right+bf.summary.side).toBe(224);
    const delfino=stageBook.stages.find(s=>s.id==='delfinos-secret')!;
    expect(delfino.geometry.blastTop-delfino.geometry.ledgeY).toBe(201.25);
    expect(delfino.geometry.blastBottom-delfino.geometry.ledgeY).toBe(-158.75);
  });
  it('Retains measured platform spans and marks unmeasured horizontal placement as schematic',()=>{
    const bf=stageBook.stages.find(s=>s.id==='battlefield')!,platforms=stagePlatforms(bf,0);
    expect(platforms).toHaveLength(3);expect(platforms[0]).toMatchObject({left:-18.8,right:18.8,y:54.4,schematic:false});
    expect(platforms.slice(1).every(p=>p.schematic)).toBe(true);
    const fd=stageBook.stages.find(s=>s.id==='final-destination')!;expect(stagePlatforms(fd,0)).toEqual([]);
    const sv=stageBook.stages.find(s=>s.id==='smashville')!;expect(stagePlatforms(sv,0)).toHaveLength(1);
  });
  it('Uses supplied hazards-off moving heights and preserves asymmetric blastzones',()=>{
    const ghz=stageBook.stages.find(s=>s.id==='green-hill-zone')!;
    expect(stagePlatforms(ghz,0)[0].y).toBe(22.67);expect(stagePlatforms(ghz,1)[0].y).toBe(39.06936);
    const ys=stageBook.stages.find(s=>s.id==='yoshis-story')!;
    expect(ys.geometry.blastLeft).toBe(-175.7);expect(ys.geometry.blastRight).toBe(173.6);
    expect(ys.notes).toContain('Asymmetrical');
  });
});
