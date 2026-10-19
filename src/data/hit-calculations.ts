import type {HitValues, MoveData} from './types';

// Transcribed from the two supplied workbooks. Keep their rounding order:
// Input & Output!P5:W5, Calculation & Data!G3:T3/G15:I15,
// and sheet 1!C4/F4 in MAWWWK's ASDI-down template.
export const stalePenalties=[.09,.08,.07,.06,.05,.04,.03,.02,.01] as const;
export type CalculationSettings={percent:number;weight:number;crouch:boolean;chargingSmash:boolean;throw:boolean;staleSlots:readonly boolean[];endlag:number|null;landingHit?:boolean};
export type HitCalculation={knockback:number;launchSpeed:number;hitstun:number;attackerHitlag:number;victimHitlag:number;shieldHitlag:number;shieldstun:number;shieldAdvantage:number|null;staledDamage:number};

export function validHit(hit:HitValues):boolean {
  return [hit.damage,hit.bkb,hit.kbg,hit.wdsk,hit.hitlag_mult].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0);
}
export function staleDamage(damage:number,slots:readonly boolean[]):number {
  return damage*(1-stalePenalties.reduce((sum,penalty,i)=>sum+(slots[i]?penalty:0),0));
}
export function calculateHit(hit:HitValues,settings:CalculationSettings):HitCalculation|null {
  if(!validHit(hit)||!Number.isFinite(settings.percent)||settings.percent<0||!Number.isFinite(settings.weight)||settings.weight<=0)return null;
  const damage=staleDamage(hit.damage,settings.staleSlots),postPercent=settings.percent+damage;
  const weight=settings.throw?100:settings.weight,cc=settings.crouch?2/3:1,charge=settings.chargingSmash?1.2:1;
  const term=hit.wdsk!==0?hit.wdsk*.5+1:(hit.damage*.05+.1)*postPercent;
  const knockback=charge*cc*(hit.bkb+hit.kbg*.01*(18+200/(weight+100)*1.4*term));
  const baseHitlag=Math.floor(damage/3+3);
  const attackerHitlag=Math.floor((damage/3+3)*hit.hitlag_mult);
  // The provided workbook applies F5 only to attacker hitlag (S5), not T5/U5.
  const victimHitlag=hit.damage===0?0:Math.floor(cc*baseHitlag);
  const shieldHitlag=hit.damage===0?0:baseHitlag;
  const shieldstun=hit.damage===0?0:Math.floor((damage+4.45)/2.235);
  const endlag=settings.endlag;
  const shieldAdvantage=hit.damage===0?0:endlag===null||!Number.isFinite(endlag)||endlag<0?null:shieldstun-endlag+shieldHitlag-attackerHitlag-(settings.landingHit?1:0);
  return {knockback,launchSpeed:knockback*.03,hitstun:Math.floor(knockback*.4),attackerHitlag,victimHitlag,shieldHitlag,shieldstun,shieldAdvantage,staledDamage:damage};
}

export type Threshold={kind:'percent';percent:number}|{kind:'never'};
export function asdiThreshold(hit:HitValues,weight:number,target:80|120,settings:Pick<CalculationSettings,'staleSlots'|'chargingSmash'|'throw'>):Threshold|null {
  if(!validHit(hit)||!Number.isFinite(weight)||weight<=0)return null;
  const effectiveWeight=settings.throw?100:weight,charge=settings.chargingSmash?1.2:1;
  if(hit.wdsk!==0||hit.kbg===0){
    const fixed=charge*(hit.bkb+hit.kbg*.01*(18+200/(effectiveWeight+100)*1.4*(hit.wdsk*.5+1)));
    return fixed>=target?{kind:'percent',percent:0}:{kind:'never'};
  }
  const postPercent=(((target/charge-hit.bkb)/(hit.kbg/100)-18)/(200/(effectiveWeight+100)*1.4))/(hit.damage*.05+.1);
  // Excel CEILING(...,1) rounds total percent before subtracting hit damage.
  return {kind:'percent',percent:Math.max(0,Math.ceil(postPercent)-staleDamage(hit.damage,settings.staleSlots))};
}

export function hitEndlag(move:MoveData,frame:number,internalName:string,lCancel=true,aerialLandingLag:number|null=null):number|null {
  if(/^AttackAir/.test(internalName)){
    const landing=move.landing_lag??aerialLandingLag;
    return landing===null?null:lCancel?Math.floor(landing/2):landing;
  }
  // iasa is a zero-based frame in the extracted data; the UI displays +1.
  return Math.max(0,(move.iasa===null?move.frames.length:move.iasa+1)-(frame+1));
}
