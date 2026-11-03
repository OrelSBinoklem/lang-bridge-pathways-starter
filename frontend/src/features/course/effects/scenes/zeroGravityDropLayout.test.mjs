import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const compile = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText).toString('base64');
const { zeroGravityDropLayout: layout, dropHitCoordinates: hit } = await import(compile(await readFile(new URL('./zeroGravityDropLayout.ts', import.meta.url), 'utf8')));
const { createDropState } = await import(compile(await readFile(new URL('./zeroGravityDropState.ts', import.meta.url), 'utf8')));
const pixels = (drop, view, w, h) => ({
  x: (drop.x / view.halfX + 1) * w / 2,
  y: (1 - drop.y / view.halfY) * h / 2,
  r: .94 * drop.scale * h / (2 * view.halfY),
});

test('standalone experiment keeps its single original drop and camera', () => {
  for (const [w, h] of [[1100, 190], [1920, 1080], [390, 844]]) {
    const view = layout(w, h);
    assert.deepEqual(view.drops, [{ x: 0, y: 0, scale: 1, phase: 0, rate: 1, warm: false }]);
    assert.equal(view.halfY, 1.55 * Math.max(1, h / w));
  }
});

test('course card places a single drop on the right, inside its bounds', () => {
  for (const [w, h] of [[350, 190], [500, 190], [1100, 190], [600, 300]]) {
    const view = layout(w, h, true);
    assert.equal(view.drops.length, 1);
    const p = pixels(view.drops[0], view, w, h);
    assert.ok(p.x - p.r > w * .6);
    assert.ok(p.x + p.r < w && p.y - p.r > 0 && p.y + p.r < h);
  }
});

test('body drops leave the 1240px content column clear, even with a narrow side margin', () => {
  for (const [w, h] of [[1280, 720], [1920, 1080], [2560, 1440], [3840, 2160]]) {
    const view = layout(w, h, true, true, true);
    const [a, b] = view.drops.map(d => pixels(d, view, w, h));
    const margin = (w - 1240) / 2;
    // Include maximum bounded shader deformation and idle/interaction movement.
    assert.ok(a.x - a.r * 1.5 >= 0 && a.x + a.r * 1.5 < margin);
    assert.ok(b.x - b.r * 1.5 > w - margin && b.x + b.r * 1.5 <= w);
    assert.notEqual(view.drops[0].rate, view.drops[1].rate);
    assert.notEqual(view.drops[0].warm, view.drops[1].warm);
  }
});

test('focus enlarges two separate drops, including the expanded portrait card', () => {
  for (const [w, h] of [[1920, 1080], [390, 844]]) {
    const view = layout(w, h, true, false, false);
    const [a, b] = view.drops.map(d => pixels(d, view, w, h));
    assert.ok(a.x + a.r < b.x - b.r);
    assert.ok(a.x - a.r > 0 && b.x + b.r < w);
    assert.ok(view.drops.every(d => Number.isFinite(d.scale) && d.scale > 0));
    assert.equal(layout(w, h, true, true, false).drops.length, 2);
  }
});

test('hit coordinates target independent states without cross-talk', () => {
  const w = 1920, h = 1080, view = layout(w, h, true, true);
  const states = view.drops.map(() => createDropState());
  for (let chosen = 0; chosen < 2; chosen++) {
    const point = pixels(view.drops[chosen], view, w, h);
    view.drops.forEach((d, i) => {
      const local = hit(point.x, point.y, w, h, view.halfX, view.halfY, d.x, d.y, d.scale);
      assert.equal(states[i].poke(local.x, local.y), i === chosen);
    });
  }
  assert.deepEqual(states.map(s => s.impulses.length), [1, 1]);
  states[0].update(.05);
  assert.ok(states[0].time > 0);
  assert.equal(states[1].time, 0);
});

test('only the career group opts into the course arrangement', async () => {
  const catalog = compile(await readFile(new URL('./cinematic/catalog.ts', import.meta.url), 'utf8'));
  const source = (await readFile(new URL('../groupEffects.config.ts', import.meta.url), 'utf8'))
    .replace(/(['"])\.\/scenes\/cinematic\/catalog\1/, JSON.stringify(catalog));
  const { getGroupEffect } = await import(compile(source));
  const career = getGroupEffect({ categoryId: 1784, title: null, variantId: 'zero-gravity-drop' });
  assert.equal(career.sceneParams.zgLayout, 1);
  assert.equal(career.bodyEffect.scene, 'zero-gravity-drop');
  const types = await readFile(new URL('./types.ts', import.meta.url), 'utf8');
  assert.match(types, /zgLayout: 0/);
});
