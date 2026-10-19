import {catalog} from './catalog';
const normalize=(name:string)=>name.toLowerCase().replace(/[^a-z0-9]/g,'');
export const referenceRoster=[...catalog,{id:'giga-bowser',name:'Giga Bowser'},{id:'wario-man',name:'Wario-Man'}];
const aliases:Record<string,string>={cfalcon:'captain-falcon',captain:'captain-falcon',dedede:'king-dedede',dk:'donkey-kong',diddy:'diddy-kong',gaw:'game-watch',mrgamewatch:'game-watch',gameandwatch:'game-watch',gnw:'game-watch',icies:'ice-climbers',iceclimber:'ice-climbers',popo:'ice-climbers',nana:'ice-climbers',metaknight:'meta-knight',zss:'zero-suit-samus',zerosuit:'zero-suit-samus',puff:'jigglypuff',purin:'jigglypuff',szerosuit:'zero-suit-samus',captainfalcon:'captain-falcon',donkey:'donkey-kong',robot:'rob',pokelizardon:'charizard',pokefushigisou:'ivysaur',pokezenigame:'squirtle'};
export function referenceFighters(name:string):{id:string;name:string}[]{
  const exact=normalize(name.replace(/\s*\([^)]*\)\s*$/,''));
  const fileAliases:Record<string,string>={koopa:'bowser',gkoopa:'giga-bowser',pikmin:'olimar',gamewatch:'game-watch',warioman:'wario-man'};
  const id=fileAliases[exact]??aliases[exact]??referenceRoster.find(f=>normalize(f.name)===exact||normalize(f.id)===exact)?.id;
  if(id)return [referenceRoster.find(f=>f.id===id)!];
  return name.split(/\s*(?:\/|,|&|\band\b)\s*/i).flatMap(part=>{const key=normalize(part),match=aliases[key]??catalog.find(f=>normalize(f.name)===key||normalize(f.id)===key)?.id;return match?[catalog.find(f=>f.id===match)!]:[];});
}
