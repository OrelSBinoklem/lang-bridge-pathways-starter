import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = ts.transpileModule(await readFile(new URL('./gridTrail.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { createGridTrail, visitGridSegment } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const path = (from, to, cols = 30, rows = 20, size = 45) => {
  const cells = [];
  visitGridSegment({ x: from[0], y: from[1] }, { x: to[0], y: to[1] }, size, cols, rows, i => cells.push(i));
  return cells;
};
const setup = () => {
  const cells = new Float32Array(100);
  return { cells, trail: createGridTrail(cells, 10, 10, 45), lit: () => [...cells.keys()].filter(i => cells[i] === 1) };
};

test('a single fast horizontal flick lights every intermediate cell in both directions', () => {
  assert.deepEqual(path([2, 22], [1348, 22]), Array.from({ length: 30 }, (_, i) => i));
  assert.deepEqual(path([1348, 22], [2, 22]), Array.from({ length: 30 }, (_, i) => 29 - i));
});
test('vertical and exact diagonal paths have no missing cells or extra corner neighbours', () => {
  assert.deepEqual(path([22, 2], [22, 898]), Array.from({ length: 20 }, (_, i) => i * 30));
  assert.deepEqual(path([10, 10], [440, 440], 10, 10), Array.from({ length: 10 }, (_, i) => i * 11));
});
test('short crossings close to a corner are not skipped by spaced sampling', () => {
  assert.deepEqual(path([44, 43], [46, 46], 3, 3), [0, 1, 4]);
});
test('all turns arriving between render frames are recorded, not replaced by a chord', () => {
  const { trail, lit } = setup();
  trail.move(22, 22, 1); trail.move(202, 22, 1); trail.move(202, 202, 1);
  assert.deepEqual(lit(), [0, 1, 2, 3, 4, 14, 24, 34, 44]);
});
test('hold refreshes only the current cell, leaving the trail free to fade', () => {
  const { trail, cells, lit } = setup();
  trail.move(22, 22, 1); trail.move(202, 22, 1);
  cells.fill(.3); trail.hold();
  assert.deepEqual(lit(), [4]); assert.ok(cells[0] < 1);
});
test('leave, blur or touch cancellation resets continuity without erasing fading cells', () => {
  const { trail, cells, lit } = setup();
  trail.move(22, 22, 1); trail.reset(); trail.move(427, 427, 1);
  assert.deepEqual(lit(), [0, 99]);
  trail.reset(); cells.fill(.2); trail.hold(); assert.deepEqual(lit(), []);
});
test('different pointers and invalid input cannot create a spurious connecting line', () => {
  const { trail, lit } = setup();
  trail.move(22, 22, 1); trail.move(427, 427, 2);
  trail.move(NaN, 200, 2); trail.move(202, 202, 2);
  assert.deepEqual(lit(), [0, 44, 99]);
});
test('viewport edges, stationary points and non-default cell sizes stay in bounds', () => {
  assert.deepEqual(path([-2, -1], [900, 2], 4, 3, 20), [0, 1, 2, 3]);
  assert.deepEqual(path([80, 60], [80, 60], 4, 3, 20), [11]);
  assert.deepEqual(path([40, 20], [0, 20], 4, 3, 20), [6, 5, 4]);
});
test('200 oblique segments match an independent segment/rectangle intersection oracle', () => {
  let seed = 117;
  const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
  for (let k = 0; k < 200; k++) {
    const from = [random() * 540, random() * 405], to = [random() * 540, random() * 405];
    const expected = [];
    for (let row = 0; row < 9; row++) for (let col = 0; col < 12; col++) {
      let entry = 0, exit = 1;
      for (const [axis, coordinate] of [[0, col], [1, row]]) {
        const a = (coordinate * 45 - from[axis]) / (to[axis] - from[axis]);
        const b = ((coordinate + 1) * 45 - from[axis]) / (to[axis] - from[axis]);
        entry = Math.max(entry, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
      }
      if (entry < exit) expected.push(row * 12 + col);
    }
    assert.deepEqual(path(from, to, 12, 9).sort((a, b) => a - b), expected);
  }
});
