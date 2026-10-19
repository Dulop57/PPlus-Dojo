import * as THREE from 'three';
import type { BoneMatrix, Frame, HitBox, HurtBox, Vec3 } from '../data/types';

export function matrixFromBone(b: BoneMatrix) {
  return new THREE.Matrix4().set(
    b.x.x,b.y.x,b.z.x,b.w.x, b.x.y,b.y.y,b.z.y,b.w.y,
    b.x.z,b.y.z,b.z.z,b.w.z, b.x.w,b.y.w,b.z.w,b.w.w,
  );
}
export function hitTransform(box: HitBox, frame: Frame) {
  return {
    start: box.prev_pos ?? box.next_pos, end: box.next_pos,
    // The sweep uses the new hitbox size along its full length. Keeping the
    // previous size here would draw a taper that the game does not use.
    startRadius: box.next_size, endRadius: box.next_size,
    matrix: new THREE.Matrix4().makeTranslation(0, frame.y_pos, frame.x_pos),
  };
}
export function hurtTransform(box: HurtBox, frame: Frame) {
  return {
    // These are two independent endpoints in Brawl, not offset + a delta.
    start: box.hurt_box.offset, end: box.hurt_box.stretch,
    startRadius: box.hurt_box.radius, endRadius: box.hurt_box.radius,
    matrix: new THREE.Matrix4().makeTranslation(0, frame.y_pos, frame.x_pos).multiply(matrixFromBone(box.bone_matrix)),
  };
}
const segments = 20, hemisphereRings = 7, ringCount = hemisphereRings * 2;
// Fixed unit-sphere coordinates: do not repeat thousands of trigonometric
// calculations per animation frame for geometry with an unchanged topology.
const unitRings=Array.from({length:ringCount},(_,ring)=>{
  const top=ring<hemisphereRings;
  const phi=top?ring/(hemisphereRings-1)*Math.PI/2:Math.PI/2+(ring-hemisphereRings)/(hemisphereRings-1)*Math.PI/2;
  return Array.from({length:segments+1},(_,column)=>{const theta=column/segments*Math.PI*2;return [Math.sin(phi)*Math.cos(theta),Math.cos(phi),Math.sin(phi)*Math.sin(theta)] as const;});
});
export function capsuleGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ringCount * (segments + 1) * 3),3));
  const indices: number[] = [];
  for (let y=0;y<ringCount-1;y++) for (let x=0;x<segments;x++) {
    const a=y*(segments+1)+x,b=a+segments+1;
    indices.push(a,b,a+1,a+1,b,b+1);
  }
  geometry.setIndex(indices);
  return geometry;
}
export function setCapsule(mesh: THREE.Mesh, start: Vec3, end: Vec3, startRadius: number, endRadius: number, external: THREE.Matrix4) {
  const first = new THREE.Vector3(start.x,start.y,start.z), last = new THREE.Vector3(end.x,end.y,end.z);
  const delta = first.clone().sub(last), length = delta.length();
  const quaternion = length > 0.000001 ? new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()) : new THREE.Quaternion();
  const positions = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let ring=0;ring<ringCount;ring++) {
    const top = ring < hemisphereRings;
    const radius = top ? startRadius : endRadius;
    for (let column=0;column<=segments;column++) {
      const [x,y,z]=unitRings[ring][column];
      positions.setXYZ(ring*(segments+1)+column,radius*x,radius*y+(top?length:0),radius*z);
    }
  }
  positions.needsUpdate = true;
  mesh.matrixAutoUpdate=false;
  mesh.matrix.copy(external).multiply(new THREE.Matrix4().compose(last,quaternion,new THREE.Vector3(1,1,1)));
  mesh.frustumCulled=false;
}
