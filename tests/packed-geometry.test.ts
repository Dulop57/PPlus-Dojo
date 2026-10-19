import {it,expect} from 'vitest';
import {packMoveGeometry,unpackMoveGeometry} from '../src/data/packed-geometry';
import {sandboxMove} from '../src/data/sandbox';
it('preserves every geometry value and frame across packed storage and structured cloning',()=>{
  const original=structuredClone(sandboxMove),before=JSON.stringify(original),packed=packMoveGeometry(original);
  expect(packed.move.frames[0]).not.toHaveProperty('hurt_boxes');
  const restored=unpackMoveGeometry(structuredClone(packed));
  expect(restored).toEqual(original);expect(JSON.parse(JSON.stringify(restored))).toEqual(JSON.parse(before));
  expect(restored.frames[0].hurt_boxes).not.toBe(restored.frames[0].hurt_boxes);
  expect(JSON.stringify(original)).toBe(before);
});
