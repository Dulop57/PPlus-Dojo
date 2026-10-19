import type { Frame, HitValues, MoveData, BoneMatrix } from './types';
// Explicit synthetic geometry fixture, never registered as a fighter or a game dataset.
const identity: BoneMatrix={x:{x:1,y:0,z:0,w:0},y:{x:0,y:1,z:0,w:0},z:{x:0,y:0,z:1,w:0},w:{x:0,y:0,z:0,w:1}};
export function fixtureFrame(index:number):Frame {
  const z=4+Math.sin(index/24*Math.PI*2)*7;
  const values:HitValues={hitbox_id:0,set_id:0,damage:0,trajectory:45,kbg:0,bkb:0,wdsk:0,size:3,enabled:true,ground:true,aerial:true,shield_damage:0,hitlag_mult:1,sdi_mult:1,effect:'Synthetic'};
  return {index,x_pos:0,y_pos:0,landing_lag:index>2&&index<19,interruptible:index>=20,
    hit_boxes:index>=5&&index<14?[{hitbox_id:0,prev_pos:{x:0,y:12,z:z-2},prev_size:3,prev_values:{Hit:values},next_pos:{x:0,y:12,z},next_size:3,next_values:{Hit:values}}]:[],
    hurt_boxes:[{bone_matrix:identity,hurt_box:{offset:{x:0,y:6,z:0},stretch:{x:0,y:17,z:0},radius:3,grabbable:true},state:index<3?'Invincible':'Normal'},
      {bone_matrix:identity,hurt_box:{offset:{x:0,y:12,z:0},stretch:{x:0,y:12,z:z-2},radius:1.6,grabbable:true},state:'Normal'}],
    ledge_grab_box:{left:-8,right:8,up:20,down:5},ecb:{left:-3,right:3,top:19,bottom:0,transn_x:0,transn_y:0},throw:null};
}
export const sandboxMove:MoveData={schemaVersion:1,fighterId:'synthetic',moveId:'collision-fixture',name:'Collision fixture',iasa:20,landing_lag:8,bad_interrupts:false,
  frames:Array.from({length:24},(_,i)=>fixtureFrame(i)),extent:{left:-6,right:16,up:24,down:0},warnings:['Synthetic test geometry. This is not a fighter animation or Project+ frame data.']};
