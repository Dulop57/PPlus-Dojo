import {clamp,stageImageGeometry,type StageFraming} from './stage-framing';

export function defaultRosterFraming(source:{width:number;height:number}):StageFraming{
  const geometry=stageImageGeometry({width:1,height:1},source,{x:0,y:100,scale:1});
  return {x:0,y:geometry.y,scale:1};
}

// Transparent portraits may move beyond the old edge-coverage boundaries.
// Keep the original vertical unit so 100% stays at the same position.
export function rosterImageGeometry(view:{width:number;height:number},source:{width:number;height:number},framing?:StageFraming){
  const crop=framing??defaultRosterFraming(source);
  const geometry=stageImageGeometry(view,source,crop);
  const verticalUnit=geometry.limitY||50;
  const limitX=50,limitY=Math.min(100,verticalUnit*3);
  const x=clamp(crop.x,-limitX,limitX),y=clamp(crop.y,-limitY,limitY);
  return {...geometry,limitX,limitY,verticalUnit,x,y,
    left:(view.width-geometry.width)/2+x/100*geometry.width,
    top:(view.height-geometry.height)/2+y/100*geometry.height};
}
export type RosterImageGeometry=ReturnType<typeof rosterImageGeometry>;
