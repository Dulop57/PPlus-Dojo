export type RecordKind='progress'|'reviews'|'settings';
export type RecordVersion={at:number;revision:string};
export type SyncRecord={key:string;kind:RecordKind;payload:string;version:RecordVersion};
export function compareVersion(a:RecordVersion,b:RecordVersion){return a.at-b.at||a.revision.localeCompare(b.revision);}
export function stableJSON(value:unknown):string{
  return JSON.stringify(value,(_key,row)=>row&&typeof row==='object'&&!Array.isArray(row)?Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b))):row);
}
export function reviewIdentity(review:{cardId:string;answer:string;log:unknown}){return `reviews:${stableJSON(review)}`;}
export function validSyncRecord(value:unknown):value is SyncRecord{
  const r=value as SyncRecord;
  return !!r&&['progress','reviews','settings'].includes(r.kind)&&typeof r.key==='string'&&r.key.startsWith(`${r.kind}:`)&&r.key.length<20000&&typeof r.payload==='string'&&r.payload.length<200000&&!!r.version&&Number.isSafeInteger(r.version.at)&&r.version.at>=0&&typeof r.version.revision==='string'&&/^[0-9a-f-]{36}$/.test(r.version.revision);
}
