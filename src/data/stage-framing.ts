export type StageFraming={x:number;y:number;scale:number};
export const defaultStageFraming:StageFraming={x:0,y:0,scale:1};
export const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));

// Offsets refer to the complete source image, never a cropped box.
export function stageImageGeometry(view:{width:number;height:number},source:{width:number;height:number},framing:StageFraming){
  const scale=clamp(framing.scale,1,3.5);
  const fit=Math.max(view.width/source.width,view.height/source.height);
  const width=source.width*fit*scale,height=source.height*fit*scale;
  const limitX=Math.max(0,(width-view.width)/width*50),limitY=Math.max(0,(height-view.height)/height*50);
  const x=clamp(framing.x,-limitX,limitX),y=clamp(framing.y,-limitY,limitY);
  return {width,height,left:(view.width-width)/2+x/100*width,top:(view.height-height)/2+y/100*height,limitX,limitY,x,y,scale};
}

export type StageImageGeometry=ReturnType<typeof stageImageGeometry>;
export function panStageImage(geometry:StageImageGeometry,dx:number,dy:number):StageFraming{
  return {x:clamp(geometry.x+dx/geometry.width*100,-geometry.limitX,geometry.limitX),y:clamp(geometry.y+dy/geometry.height*100,-geometry.limitY,geometry.limitY),scale:geometry.scale};
}

export function migrateStageFraming(legacy:StageFraming,view:{width:number;height:number},source:{width:number;height:number}):StageFraming{
  const geometry=stageImageGeometry(view,source,legacy);
  // v1 translated a cropped element by 18% of its slider value.
  return {x:clamp(.18*legacy.x*view.width/geometry.width,-geometry.limitX,geometry.limitX),y:clamp(.18*legacy.y*view.height/geometry.height,-geometry.limitY,geometry.limitY),scale:geometry.scale};
}
