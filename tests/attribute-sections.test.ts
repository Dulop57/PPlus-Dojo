import {it,expect} from 'vitest';
import source from '../src/data/reference/attributes.json';
import {attributeSections,attributeFields,fieldRows} from '../src/data/attribute-sections';
import type {ReferenceBook} from '../src/data/reference';
const sheets=(source as ReferenceBook).sheets;
it('Presents grab types, ledge conditions and aerial landing variants as distinct web tables',()=>{
  const grabs=attributeSections(sheets.find(s=>s.name==='Grab Timings')!).sections;
  expect(grabs.map(s=>s.title)).toEqual(['Standing grab','Dash grab','Pivot grab']);
  expect(grabs[0].rows[0].map(c=>c.v)).toEqual(['C. Falcon',7,8,31]);
  const ledge=attributeSections(sheets.find(s=>s.name==='Ledge stuff')!).sections;
  expect(ledge.map(s=>s.title)).toContain('Below 100% · Attack');expect(ledge.map(s=>s.title)).toContain('At or above 100% · Jump');
  expect(attributeSections(sheets.find(s=>s.name==='Aerial Landing Lags')!).sections.map(s=>s.title)).toEqual(['L-cancelled','Not L-cancelled']);
});
it('Keeps fighter groups and supporting notes, rather than rebuilding a spreadsheet grid',()=>{
  const misc=attributeSections(sheets.find(s=>s.name==='Misc')!);
  expect(misc.sections.find(s=>s.title==='Jumpsquat')!.rows[0].map(c=>c.v)).toContain('Fox');
  expect(misc.notes.some(c=>String(c.v).includes('Ike can only walljump'))).toBe(true);
  const dodge=attributeSections(sheets.find(s=>s.name==='Dodges')!);
  expect(dodge.sections.find(s=>s.title==='Spotdodge groups')!.rows[0].map(c=>c.v)).toContain('Fox');
});
it('Field explorers preserve independent fighter order, real zeroes and unavailable values',()=>{
  const calculations=sheets.find(s=>s.name==='Calculations')!;
  expect(fieldRows(calculations,60)[1].map(c=>c.v)).toEqual(['Diddy Kong',17.02]);
  const raw=sheets.find(s=>s.name==='Raw Data')!;
  expect(attributeFields(raw).find(f=>f.column===46)!.label).toBe('Weight');
  expect(fieldRows(raw,20).find(r=>String(r[0].v).includes('Gkoopa'))![1].v).toBe(null);
  expect(fieldRows(raw,40).find(r=>String(r[0].v).includes('Gkoopa'))![1].v).toBe(0);
});
