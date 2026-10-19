import {it,expect} from 'vitest';
import {Matrix4,Mesh,MeshBasicMaterial,Vector3} from 'three';
import {capsuleGeometry,setCapsule} from '../src/viewer/geometry';
it('Cached capsule topology preserves independent radii, endpoints and external movement',()=>{
  const mesh=new Mesh(capsuleGeometry(),new MeshBasicMaterial());
  const buffer=mesh.geometry.getAttribute('position').array;
  setCapsule(mesh,{x:0,y:5,z:0},{x:0,y:1,z:0},2,1,new Matrix4().makeTranslation(0,2,3));
  const positions=mesh.geometry.getAttribute('position');
  const top=new Vector3().fromBufferAttribute(positions,0).applyMatrix4(mesh.matrix);
  const bottom=new Vector3().fromBufferAttribute(positions,13*21).applyMatrix4(mesh.matrix);
  expect(top.y).toBeCloseTo(9);expect(top.z).toBeCloseTo(3);expect(bottom.y).toBeCloseTo(2);
  expect(positions.getX(6*21)).toBeCloseTo(2);expect(positions.getX(7*21)).toBeCloseTo(1);
  setCapsule(mesh,{x:0,y:6,z:0},{x:0,y:2,z:0},3,2,new Matrix4());
  expect(mesh.geometry.getAttribute('position').array).toBe(buffer);
  mesh.geometry.dispose();mesh.material.dispose();
});
