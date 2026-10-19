const excludedStudyFighterIds=new Set(['giga-bowser','wario-man']);

export function isExcludedStudyFighter(id:string){return excludedStudyFighterIds.has(id);}
