import type {BoneMatrix,Frame,HurtBox,MoveData,Vec4} from './types';
type Template=Omit<HurtBox,'bone_matrix'>;
export type PackedMove={move:MoveData;geometry:Float64Array;offsets:Uint32Array;templates:Template[]};
const axes=['x','y','z','w'] as const;
// All matrix numbers remain Float64: this is lossless storage, not a change to
// the extracted geometry. Hurtbox objects are materialized only when used.
export function packMoveGeometry(move:MoveData):PackedMove{
  const count=move.frames.reduce((n,frame)=>n+frame.hurt_boxes.length,0);
  const geometry=new Float64Array(count*17),offsets=new Uint32Array(move.frames.length+1),templates:Template[]=[],indices=new Map<string,number>();
  let row=0;
  const frames=move.frames.map((frame,i)=>{
    offsets[i]=row;
    for(const box of frame.hurt_boxes){
      const {bone_matrix,...template}=box,key=JSON.stringify(template);
      let index=indices.get(key);if(index===undefined){index=templates.length;indices.set(key,index);templates.push(template);}
      let offset=row++*17;geometry[offset++]=index;
      for(const axis of axes)for(const component of axes)geometry[offset++]=bone_matrix[axis][component];
    }
    const {hurt_boxes:_,...rest}=frame;return rest as Frame;
  });offsets[move.frames.length]=row;
  return {move:{...move,frames},geometry,offsets,templates};
}
export function unpackMoveGeometry(packed:PackedMove):MoveData{
  const {move,geometry,offsets,templates}=packed;
  for(let i=0;i<move.frames.length;i++)Object.defineProperty(move.frames[i],'hurt_boxes',{enumerable:true,get:()=>{
    const result:HurtBox[]=[];
    for(let row=offsets[i];row<offsets[i+1];row++){
      let offset=row*17;const template=templates[geometry[offset++]],matrix={} as BoneMatrix;
      for(const axis of axes){const vector={} as Vec4;for(const component of axes)vector[component]=geometry[offset++];matrix[axis]=vector;}
      result.push({...template,bone_matrix:matrix});
    }return result;
  }});
  return move;
}
