import {describe,expect,it} from 'vitest';
import {asdiThreshold,calculateHit,hitEndlag,staleDamage,type CalculationSettings} from '../src/data/hit-calculations';
import type {HitValues} from '../src/data/types';
import {sandboxMove} from '../src/data/sandbox';

const hit:HitValues={hitbox_id:0,set_id:0,damage:12,trajectory:361,kbg:100,bkb:30,wdsk:0,size:3,enabled:true,ground:true,aerial:true,shield_damage:0,hitlag_mult:1,sdi_mult:1,effect:'Normal'};
const settings:CalculationSettings={percent:19,weight:100,crouch:false,chargingSmash:false,throw:false,staleSlots:Array(9).fill(false),endlag:8};
describe('Supplied workbook calculations',()=>{
  it('matches every cached output in Input & Output!P5:W5 (Luigi at 19%)',()=>{
    const result=calculateHit(hit,settings)!;
    expect(result.knockback).toBeCloseTo(78.38,10);
    expect(result.launchSpeed).toBeCloseTo(2.3514,10);
    expect([result.hitstun,result.attackerHitlag,result.victimHitlag,result.shieldHitlag,result.shieldstun,result.shieldAdvantage]).toEqual([31,7,7,7,7,-1]);
  });
  it('matches cached ASDI-template percentages for Bowser, Diddy, Fox and Jigglypuff',()=>{
    const templateHit={...hit,damage:10,bkb:10};
    for(const [weight,cc,tumble] of [[113,107,56],[85,92,48],[75,86,45],[62,79,41]]){
      expect(asdiThreshold(templateHit,weight,120,settings)).toEqual({kind:'percent',percent:cc});
      expect(asdiThreshold(templateHit,weight,80,settings)).toEqual({kind:'percent',percent:tumble});
    }
  });
  it('uses unrounded attacker hitlag, rounded victim hitlag and the source CC and charge factors',()=>{
    const result=calculateHit({...hit,damage:11,hitlag_mult:1.5},{...settings,crouch:true,chargingSmash:true})!;
    expect(result.attackerHitlag).toBe(10);
    expect(result.victimHitlag).toBe(4);
    expect(result.shieldHitlag).toBe(6);
    expect(result.knockback).toBeCloseTo(60.24,10);
    expect(result.shieldAdvantage).toBe(-6);
  });
  it('uses staled damage for post-hit percent and lag, and original damage in the KB coefficient',()=>{
    const slots=Array(9).fill(true);
    expect(staleDamage(12,slots)).toBeCloseTo(6.6,10);
    const result=calculateHit(hit,{...settings,staleSlots:slots})!;
    expect(result.knockback).toBeCloseTo(73.088,10);
    expect(result.attackerHitlag).toBe(5);
    expect(result.shieldstun).toBe(4);
  });
  it('handles percent-independent set knockback without dividing by zero or inventing a threshold',()=>{
    const fixed={...hit,bkb:0,wdsk:20};
    expect(calculateHit(fixed,{...settings,percent:999})!.knockback).toBeCloseTo(33.4,10);
    expect(calculateHit(fixed,{...settings,percent:0})!.knockback).toBeCloseTo(33.4,10);
    expect(asdiThreshold(fixed,100,80,settings)).toEqual({kind:'never'});
    expect(asdiThreshold({...fixed,bkb:120},100,120,settings)).toEqual({kind:'percent',percent:0});
    expect(asdiThreshold({...hit,kbg:0,bkb:79},100,80,settings)).toEqual({kind:'never'});
    expect(asdiThreshold({...hit,kbg:0,bkb:80},100,80,settings)).toEqual({kind:'percent',percent:0});
  });
  it('uses throw weight 100 and preserves source zero-damage guards',()=>{
    expect(calculateHit(hit,{...settings,weight:150,throw:true})!.knockback).toBeCloseTo(78.38,10);
    const zero=calculateHit({...hit,damage:0,hitlag_mult:2},settings)!;
    expect([zero.attackerHitlag,zero.victimHitlag,zero.shieldHitlag,zero.shieldstun,zero.shieldAdvantage]).toEqual([6,0,0,0,0]);
  });
  it('leaves invalid or missing inputs unavailable',()=>{
    expect(calculateHit(hit,{...settings,weight:NaN})).toBeNull();
    expect(calculateHit(hit,{...settings,percent:-1})).toBeNull();
    expect(calculateHit({...hit,damage:NaN},settings)).toBeNull();
    expect(asdiThreshold(hit,NaN,80,settings)).toBeNull();
    expect(calculateHit(hit,{...settings,endlag:null})!.shieldAdvantage).toBeNull();
  });
  it('derives endlag from displayed IASA, contact frame, or L-cancelled aerial landing lag',()=>{
    expect(hitEndlag({...sandboxMove,iasa:16},2,'Attack11')).toBe(14);
    expect(hitEndlag({...sandboxMove,iasa:null},2,'Attack11')).toBe(21);
    expect(hitEndlag({...sandboxMove,landing_lag:19},2,'AttackAirF')).toBe(9);
    expect(hitEndlag({...sandboxMove,landing_lag:null},2,'AttackAirF',false,22)).toBe(22);
    expect(hitEndlag({...sandboxMove,landing_lag:null},2,'AttackAirF')).toBeNull();
    expect(calculateHit(hit,{...settings,landingHit:true})!.shieldAdvantage).toBe(-2);
  });
});
