import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { PerspectiveCamera, Matrix4, Vector4 } from 'three';

const source = await readFile(new URL('./waterBounds.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { waterScreenRect } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
function cameraMatrix(aspect = 2) {
  const camera = new PerspectiveCamera(50, aspect, .1, 100);
  camera.position.set(0, 0, 10); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  return new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
}

test('empty/offscreen water skips work, near-plane crossings fall back safely', () => {
  const m = cameraMatrix().elements;
  const rect = b => waterScreenRect(b, m, 800, 400, .1, 400, 2, .1);
  assert.equal(rect([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]).width, 0);
  assert.equal(rect([100, 0, 0, 101, 1, 1]).width, 0);
  assert.deepEqual(rect([-1, -1, 9, 1, 1, 11]), { x: 0, y: 0, width: 800, height: 400 });
});

test('bounds contain projected streak corners and blur/normal footprints at varied camera angles', () => {
  let seed = 614;
  const rand = () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
  for (let trial = 0; trial < 200; trial++) {
    const width = trial % 2 ? 390 : 1600, height = trial % 2 ? 844 : 900;
    const camera = new PerspectiveCamera(35 + rand() * 50, width / height, .1, 100);
    const angle = rand() * Math.PI * 2;
    camera.position.set(Math.cos(angle) * 9, rand() * 8 - 4, Math.sin(angle) * 9);
    camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    const matrix = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const bounds = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    const particles = Array.from({ length: 30 }, () => {
      const head = [rand() * 4 - 2, rand() * 4 - 2, rand() * 4 - 2];
      const tail = head.map(x => x + (rand() - .5) * 1.2);
      for (let axis = 0; axis < 3; axis++) {
        bounds[axis] = Math.min(bounds[axis], head[axis], tail[axis]);
        bounds[axis + 3] = Math.max(bounds[axis + 3], head[axis], tail[axis]);
      }
      return { head, tail, radius: .005 + rand() * .1 };
    });
    const smooth = rand() * 5, projScale = height * camera.projectionMatrix.elements[5] / 2;
    const rect = waterScreenRect(bounds, matrix.elements, width, height, Math.max(...particles.map(p => p.radius)), projScale, smooth, camera.near);
    for (const particle of particles) {
      const project = p => new Vector4(...p, 1).applyMatrix4(matrix);
      const head = project(particle.head), tail = project(particle.tail);
      const hx = (head.x / head.w * .5 + .5) * width, hy = (head.y / head.w * .5 + .5) * height;
      const tx = (tail.x / tail.w * .5 + .5) * width, ty = (tail.y / tail.w * .5 + .5) * height;
      const len = Math.hypot(hx - tx, hy - ty);
      const dx = len > 1e-3 ? (hx - tx) / len : 0, dy = len > 1e-3 ? (hy - ty) / len : 1;
      const r = Math.max(.8, particle.radius * projScale / head.w);
      const footprint = 2 * Math.max(.5, smooth) + 2;
      for (const along of [0, 1]) for (const side of [-1, 1]) {
        const x = (along ? hx : tx) + (-dy * side + dx * (along * 2 - 1)) * r;
        const y = (along ? hy : ty) + (dx * side + dy * (along * 2 - 1)) * r;
        assert.ok(Math.max(0, x - footprint) >= rect.x);
        assert.ok(Math.min(width, x + footprint) <= rect.x + rect.width);
        assert.ok(Math.max(0, y - footprint) >= rect.y);
        assert.ok(Math.min(height, y + footprint) <= rect.y + rect.height);
      }
    }
  }
});

test('a centred water volume avoids shading empty screen margins', () => {
  const rect = waterScreenRect([-1, -2, -1, 1, 2, 1], cameraMatrix().elements, 1600, 800, .04, 850, 2, .1);
  assert.ok(rect.width * rect.height < 1600 * 800 * .15);
});
