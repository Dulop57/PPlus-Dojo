import {describe,it,expect} from 'vitest';
import source from '../src/data/reference/attributes.json';
import {attributeSections,attributeFields,fieldRows} from '../src/data/attribute-sections';
import {rankingChart,sectionChart,barDomain,chartNumber,cellSource} from '../src/data/attribute-charts';
import {rankings,type ReferenceBook} from '../src/data/reference';
const sheets=(source as ReferenceBook).sheets;
const get=(name:string)=>sheets.find(s=>s.name===name)!;
const sections=(name:string)=>attributeSections(get(name)).sections;
describe('Attributes chart adapters',()=>{
  it('preserves every ranking value, rank, source and combined fighter identity',()=>{
    const metrics=rankings(get('Main'));
    expect(metrics).toHaveLength(28);
    for(const metric of metrics){
      const chart=rankingChart(metric);
      expect(chart.kind).toBe('bars');expect(chart.rows.map(r=>r.cells)).toEqual(metric.rows);
      expect(chart.rows.filter(r=>!r.fighters.length).map(r=>r.label),metric.name).toEqual([]);
      expect(cellSource(chart.sheet,chart.rows[0].cells[0])).toMatch(/^Main![A-Z]+3$/);
    }
    const fox=rankingChart(metrics.find(m=>m.name==='Weight')!).rows.find(r=>r.label==='Fox')!;
    expect(fox.fighters.map(f=>f.id)).toEqual(['fox']);expect(fox.cells[2].v).toBe(75);
    const combined={...metrics[0],rows:[[...metrics[0].rows[0]]]};combined.rows[0][1]={...combined.rows[0][1],v:'Zelda / Sheik'};
    expect(rankingChart(combined).rows[0].fighters.map(f=>f.id)).toEqual(['zelda','sheik']);
    const jumps=rankingChart(metrics.find(m=>m.name==='Double Jump Height')!);
    expect(jumps.rows.filter(r=>r.label.startsWith('Pit ')).every(r=>r.fighters[0].id==='pit')).toBe(true);
  });
  it('omits the categorical F/B field from numeric ranking measurements',()=>{
    const glide=rankingChart(rankings(get('Main')).find(metric=>metric.name==='Glide Toss')!);
    expect(glide.series.map(series=>series.label)).toEqual(['Distance','Z-score']);
    expect(glide.series[0].column).toBe(3);
    expect(glide.rows[0].cells[2].v).toMatch(/^[FB]$/);
  });
  it('assigns appropriate charts to all sections and keeps written notes as text',()=>{
    const expected:Record<string,string[]>={
      'Grab Timings':['timeline'],'Grab Range':['grouped','bars'],'Aerial Landing Lags':['heatmap'],
      'Ledge stuff':['timeline','text'],'Dodges':['timeline','matrix'],'SH Times':['grouped'],
      'Item Throws':['timeline','bars'],'Shine':['bars'],'Misc':['groups','matrix','bars'],
    };
    for(const [name,kinds] of Object.entries(expected)){
      const items=sections(name),actual=new Set(items.map(s=>sectionChart(name,s,items).kind));
      for(const kind of kinds)expect(actual,`${name}: ${kind}`).toContain(kind);
    }
  });
  it('records only provided timing windows and preserves actionable markers',()=>{
    const grabs=sectionChart('Grab Timings',sections('Grab Timings')[0]);
    expect(grabs.windows).toEqual([{label:'Grab active',from:1,through:2}]);
    expect(grabs.rows[0].cells.map(c=>c.v)).toEqual(['C. Falcon',7,8,31]);
    const items=sectionChart('Item Throws',sections('Item Throws')[0]);expect(items.windows).toEqual([]);
    const ledge=sectionChart('Ledge stuff',sections('Ledge stuff')[0]);expect(ledge.windows).toEqual([]);
  });
  it('resolves universal dodge rows, directional exceptions and spotdodge groups',()=>{
    const items=sections('Dodges');
    const rolls=sectionChart('Dodges',items.find(s=>s.title==='Rolls')!,items);
    const shared=rolls.rows.find(r=>r.label==='Everyone Else')!;
    expect(shared.group).toBe(true);expect(shared.fighters.some(f=>f.id==='jigglypuff')).toBe(true);
    expect(shared.fighters.some(f=>f.id==='yoshi')).toBe(false);
    const spot=sectionChart('Dodges',items.find(s=>s.title==='Spotdodges')!,items);
    expect(spot.rows[0].fighters.some(f=>f.id==='fox')).toBe(true);
    expect(sectionChart('Dodges',items.find(s=>s.title==='Techs')!,items).rows.every(r=>r.fighters.length>30)).toBe(true);
  });
  it('keeps overlapping membership and original source cells',()=>{
    const chart=sectionChart('Misc',sections('Misc').find(s=>s.title==='Crawl options')!);
    expect(chart.kind).toBe('matrix');
    const present=chart.rows.flatMap(r=>r.cells).filter(c=>c.v===true);
    expect(present.length).toBeGreaterThan(0);expect(present.every(c=>typeof c.original?.v==='string'&&c.r>0)).toBe(true);
    const spikes=sectionChart('Misc',sections('Misc').find(s=>s.title==='True spikes')!);
    expect(spikes.kind).toBe('cards');expect(spikes.rows).toHaveLength(20);
    expect(spikes.rows.find(r=>r.label==='Bowser')!.cells.some(c=>c.v==='Side B (Aerial down)')).toBe(true);
    const landing=sectionChart('Misc',sections('Misc').find(s=>s.title==='Empty landing lag')!);
    expect(landing.rows[0].fighters.some(f=>f.id==='fox')).toBe(true);
    expect(landing.rows[0].fighters.some(f=>f.id==='bowser')).toBe(false);
    expect(landing.rows[0].cells[1].original?.v).toBe('Everyone Else');
    expect(landing.groupMetric).toBe('value');expect(landing.series[0].unit).toBe('frames');
  });
  it('treats crawl-attack and wall-cling as extensions of their base abilities',()=>{
    for(const title of ['Crawl options','Wall movement']){
      const chart=sectionChart('Misc',sections('Misc').find(s=>s.title===title)!);
      const extended=chart.rows.filter(row=>row.cells[1].v===true);
      expect(extended.length).toBeGreaterThan(0);expect(extended.every(row=>row.cells[0].v===true)).toBe(true);
    }
  });
  it('keeps outlier descriptions separate from fighter identity',()=>{
    const chart=sectionChart('Misc',sections('Misc').find(s=>s.title==='Notable outliers')!);
    expect(chart.rows.every(row=>row.fighters.length===1&&row.description)).toBe(true);
    expect(chart.rows.find(row=>row.label==='Mewtwo (Fwd)')!.description).toBe('Glide Toss');
  });
  it('keeps explorer zeroes and missing values distinct and supports negative axes',()=>{
    const raw=get('Raw Data');
    for(const column of [20,40]){
      const field=attributeFields(raw).find(f=>f.column===column)!;
      const chart=sectionChart('Raw Data',{title:field.label,columns:['Fighter','Value'],rows:fieldRows(raw,column)});
      const giga=chart.rows.find(r=>r.fighters.some(f=>f.id==='giga-bowser'))!;
      expect(chartNumber(giga.cells[1])).toBe(column===40?0:null);
    }
    expect(barDomain([null,0,-3,4])).toEqual([-3,4]);expect(barDomain([0,null])).toEqual([0,1]);
    const calculations=get('Calculations'),field=attributeFields(calculations).find(f=>f.label.includes('Frame 1'))!;
    expect(sectionChart('Calculations',{title:field.label,columns:['Fighter','Value'],rows:fieldRows(calculations,field.column)}).series[0].unit).toBe('');
  });
});
