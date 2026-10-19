import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cropGeometry } from '../src/features/pets/crop-geometry.ts';
test('cover geometry prevents blank edges for landscape and portrait rotations', () => {
  for (const [w,h] of [[1200,800],[800,1200],[512,512]]) {
    for (const rotation of [0,90,180,270]) for (const zoom of [1,1.5,3]) {
      const g=cropGeometry(w,h,rotation,zoom,1,-1);
      const width=(rotation%180 ? h : w)*g.scale;
      const height=(rotation%180 ? w : h)*g.scale;
      assert.ok(width>=256 && height>=256);
      assert.ok(Math.abs(g.dx)<= (width-256)/2 + 1e-8);
      assert.ok(Math.abs(g.dy)<= (height-256)/2 + 1e-8);
    }
  }
});
test('rotation swaps crop pan limits and centered square has no pan', () => {
  const g=cropGeometry(1200,800,0,1,1,1);
  const rotated=cropGeometry(1200,800,90,1,1,1);
  assert.equal(g.dx,rotated.dy); assert.equal(g.dy,0); assert.equal(rotated.dx,0);
  assert.deepEqual(cropGeometry(512,512,0,1,1,1),{scale:.5,dx:0,dy:0});
});
