import { useEffect, useState } from 'react';
export type StudyLink={deck?:'attributes'|'hitboxes'|'stages';subject?:string;topic?:string;field?:string;card?:string;move?:string;category?:'attributes'|'moves'|'hitboxes'|'stages';mode?:'library'|'review';due?:boolean};
export type Route = { page: string; fighterId?: string; moveId?: string; frame: number; view?: 'raw'; metric?:string; graph?:'3d'; study?:StudyLink };
export function parseRoute(hash: string): Route {
  const [path, query] = hash.replace(/^#\/?/, '').split('?');
  let parts: string[];
  try { parts = path.split('/').map(decodeURIComponent); } catch { return { page: 'missing', frame: 1 }; }
  const params = new URLSearchParams(query), frame = Number(params.get('frame') ?? 1);
  const deck=params.get('deck'),mode=params.get('mode');
  const study:StudyLink={...(['attributes','hitboxes','stages'].includes(deck??'')?{deck:deck as StudyLink['deck']}:{}),...(['library','review'].includes(mode??'')?{mode:mode as StudyLink['mode']}:{}),...(params.get('due')==='1'?{due:true}:{})};
  for(const key of ['subject','topic','field','card','move'] as const)if(params.has(key))study[key]=params.get(key)!;
  if(['attributes','moves','hitboxes','stages'].includes(params.get('category')??''))study.category=params.get('category') as StudyLink['category'];
  return { page: parts[0] || 'fighters', fighterId: parts[1], moveId: parts[2], frame: Number.isSafeInteger(frame) && frame > 0 ? frame : 1, ...(params.get('view') === 'raw' ? {view: 'raw' as const} : {}),...(params.has('metric')?{metric:params.get('metric')!}:{}),...(params.get('graph')==='3d'?{graph:'3d' as const}:{}),...(parts[0]==='study'?{study}:{}) };
}
export function studyHref(filters:StudyLink){const params=new URLSearchParams();for(const [key,value] of Object.entries(filters))if(value!==undefined&&value!==false)params.set(key,value===true?'1':String(value));return `#/study?${params}`;}
export function moveHref(fighterId: string, moveId: string, frame = 1, view?: 'raw') {
  return `#/fighters/${encodeURIComponent(fighterId)}/${encodeURIComponent(moveId)}?frame=${frame}${view === 'raw' ? '&view=raw' : ''}`;
}
export function useRoute() {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => { const onHash = () => setRoute(parseRoute(location.hash)); window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash); }, []);
  return route;
}
