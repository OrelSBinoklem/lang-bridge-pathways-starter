import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const code = ts.transpileModule(await readFile(new URL('./stitchBrush.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { stitchBrushRadius, inStitchBrush, createStitchTraversal, stepStitchNeedle } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
test('brush is doubled to six stitch nodes, independently of resolution', () => {
  for (const node of [4, 8, 18]) assert.equal(stitchBrushRadius(node, 999), node * 6);
  assert.equal(stitchBrushRadius(8, NaN), 48);
  assert.equal(stitchBrushRadius(8, 6), 2 * stitchBrushRadius(8, 3));
  assert.equal(stitchBrushRadius(0, 3), 0);
});
test('circular brush measures cell centres, not a square or lagging needle', () => {
  const cursor = { x: 0, y: 0, active: true };
  assert.equal(inStitchBrush({x:25,y:-5}, 10, cursor,30),true);
  assert.equal(inStitchBrush({x:25.01,y:-5}, 10, cursor,30),false);
  assert.equal(inStitchBrush({x:20,y:20}, 10,cursor,30),false);
});
test('a fast cursor jump or pointer leave cancels old pending stitches', () => {
  const cell = {x:10,y:10};
  assert.equal(inStitchBrush(cell,10,{x:15,y:15,active:true},30),true);
  assert.equal(inStitchBrush(cell,10,{x:150,y:150,active:true},30),false);
  assert.equal(inStitchBrush(cell,10,{x:15,y:15,active:false},30),false);
});

const grid = () => Array.from({ length: 9 }, (_, i) => ({ id: i, x: (i % 3) * 10, y: Math.floor(i / 3) * 10, done: false, active: false }));

test('rows are sewn in a retained zigzag rather than alternating opposite sides of the cursor', () => {
  const cells = grid(), traversal = createStitchTraversal();
  let scans = 0;
  const candidates = () => { scans++; return cells; };
  const order = [];
  for (let i = 0; i < 9; i++) {
    const next = traversal.next(candidates, 10, { x: 15 + (i % 2) * .2, y: 15, active: true }, 60, { x: 5, y: 5 });
    order.push(next.id);
    next.done = true;
  }
  assert.deepEqual(order, [0, 1, 2, 5, 4, 3, 6, 7, 8]);
  assert.equal(scans, 1, 'pointer jitter must not rebuild or reorder the retained pass');
  assert.equal(traversal.next(candidates, 10, { x: 15, y: 15, active: true }, 60, { x: 25, y: 25 }), null);
});

test('zigzag can start from its nearer end without mutating the supplied layout', () => {
  const cells = grid(), traversal = createStitchTraversal();
  const original = cells.slice();
  const order = [];
  for (let i = 0; i < 9; i++) {
    const next = traversal.next(() => cells, 10, { x: 15, y: 15, active: true }, 60, { x: 25, y: 25 });
    order.push(next.id); next.done = true;
  }
  assert.deepEqual(order, [8, 7, 6, 3, 4, 5, 2, 1, 0]);
  assert.deepEqual(cells, original);
});

test('moved brush drops old queued nodes and never selects completed or active stitches', () => {
  const cells = grid(), traversal = createStitchTraversal();
  const brush = { x: 15, y: 15, active: true };
  const first = traversal.next(() => cells, 10, brush, 60, { x: 5, y: 5 });
  first.done = true;
  const remote = { id: 9, x: 200, y: 200, done: false, active: false };
  assert.equal(traversal.next(() => [...cells, remote], 10, { x: 205, y: 205, active: true }, 20, { x: 5, y: 5 }), remote);
  assert.equal(traversal.next(() => cells, 10, { ...brush, active: false }, 60, brush), null);
  for (const cell of cells) cell.active = true;
  assert.equal(traversal.next(() => cells, 10, brush, 60, brush), null);
});

test('clear discards a previous pass; circular brush still excludes distant corners', () => {
  const cells = grid(), traversal = createStitchTraversal();
  const brush = { x: 15, y: 15, active: true };
  assert.equal(traversal.next(() => cells, 10, brush, 11, { x: 5, y: 5 }).id, 1);
  traversal.clear();
  assert.equal(traversal.next(() => cells, 10, brush, 11, { x: 15, y: 25 }).id, 7);
});

test('local needle travel keeps its steady speed and cannot overshoot', () => {
  const from = { x: 0, y: 0 }, to = { x: 12, y: 16 };
  const one = stepStitchNeedle(from, to, 10, 14, .05);
  const half = stepStitchNeedle(stepStitchNeedle(from, to, 10, 14, .025), to, 10, 14, .025);
  assert.ok(Math.abs(Math.hypot(one.x, one.y) - 14) < 1e-9);
  assert.ok(Math.hypot(one.x - half.x, one.y - half.y) < 1e-9);
  assert.deepEqual(stepStitchNeedle({ x: 11, y: 15 }, to, 10, 14, .05), to);
  assert.deepEqual(stepStitchNeedle(to, to, 10, 14, .05), to);
});

test('screen-wide cursor jumps are caught within 300 ms at different frame rates and stitch rates', () => {
  for (const fps of [30, 60, 144]) for (const rate of [0, 14, 30]) {
    let needle = { x: 0, y: 0 };
    const target = { x: 3840, y: 2160 };
    for (let frame = 0; frame < Math.ceil(fps * .3); frame++) needle = stepStitchNeedle(needle, target, 8, rate, 1 / fps);
    assert.ok(Math.hypot(needle.x - target.x, needle.y - target.y) < 8, `${fps} fps, stitch rate ${rate}`);
  }
});

test('fast catch-up integrates consistently even across the transition to a local stitch', () => {
  const target = { x: 1000, y: 700 }, origin = { x: 0, y: 0 };
  const whole = stepStitchNeedle(origin, target, 8, 14, .2);
  let pieces = origin;
  for (let i = 0; i < 20; i++) pieces = stepStitchNeedle(pieces, target, 8, 14, .01);
  assert.ok(Math.hypot(whole.x - pieces.x, whole.y - pieces.y) < 1e-8);
});

test('needle follows a rapidly moving cursor instead of falling further behind every frame', () => {
  let needle = { x: 0, y: 0 };
  for (let frame = 1; frame <= 60; frame++) {
    const target = { x: frame * 50, y: 0 }; // 3000 px/s, much faster than the local sewing speed.
    needle = stepStitchNeedle(needle, target, 8, 14, 1 / 60);
    assert.ok(target.x - needle.x < 100);
  }
});
