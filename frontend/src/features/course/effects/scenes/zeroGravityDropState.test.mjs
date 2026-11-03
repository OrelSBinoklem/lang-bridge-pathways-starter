import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const compiled = ts.transpileModule(await readFile(new URL('./zeroGravityDropState.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { createDropState, DROP_IMPULSE_LIMIT } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
test('a hit creates a localized unit-normal impulse, while a miss does nothing', () => {
  const s = createDropState();
  assert.equal(s.poke(2, 0), false); assert.equal(s.poke(NaN, 0), false);
  assert.equal(s.impulses.length, 0);
  assert.equal(s.poke(.4, .3), true);
  const p = s.impulses[0];
  assert.ok(Math.abs(Math.hypot(p.x, p.y, p.z) - 1) < 1e-10);
  assert.ok(s.center.vx < 0 && s.center.vy < 0);
});
test('rapid clicks have bounded memory and velocity; disturbances decay', () => {
  const s = createDropState();
  for (let i = 0; i < 1000; i++) s.poke(.6, .3, 100);
  assert.equal(s.impulses.length, DROP_IMPULSE_LIMIT);
  assert.ok(Math.abs(s.center.vx) <= .8 && Math.abs(s.center.vy) <= .8);
  for (let i = 0; i < 120 * 20; i++) s.update(1 / 120);
  assert.equal(s.impulses.length, 0);
  assert.ok(Math.hypot(s.center.x, s.center.y, s.center.vx, s.center.vy) < 1e-6);
});
test('fixed-step interaction state agrees at 30, 60 and 120 fps', () => {
  const results = [30, 60, 120].map(fps => {
    const s = createDropState(); s.poke(-.4, .1);
    for (let i = 0; i < fps * 2; i++) s.update(1 / fps);
    return { center: s.center, impulses: s.impulses };
  });
  assert.deepEqual(results[0], results[1]); assert.deepEqual(results[0], results[2]);
});
test('paused and invalid updates do not change state, long frames are capped', () => {
  const s = createDropState(); s.poke(0, 0);
  s.update(0); s.update(-1); s.update(NaN);
  assert.equal(s.time, 0); assert.equal(s.impulses[0].age, 0);
  s.update(100); assert.ok(s.time < .101);
});

test('a single disturbance survives long enough for several wave returns', () => {
  const s = createDropState(); s.poke(.2, -.3);
  for (let i = 0; i < 120 * 12; i++) s.update(1 / 120);
  assert.equal(s.impulses.length, 1);
  assert.ok(s.impulses[0].age > 11.9);
});
