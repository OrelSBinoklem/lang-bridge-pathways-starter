import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('./pizzaChoreography.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { pizzaPhases, pizzaArmPose } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

test('lift waits for the conveyor and returns before the next order', () => {
  for (const t of [0, 3.4, 6, 7]) assert.equal(pizzaPhases(t).lift, 0);
  assert.equal(pizzaPhases(7).conveyor, 1);
  for (const t of [10, 12, 15]) assert.equal(pizzaPhases(t).lift, 1);
  for (const t of [18, 23.99]) assert.equal(pizzaPhases(t).lift, 0);
});
test('all transfers join continuously and the new dough starts invisible', () => {
  const epsilon = 1e-6;
  for (const boundary of [3.4, 7, 10, 12, 15, 17, 18, 18.5, 21, 22.5]) {
    const before = pizzaPhases(boundary - epsilon), after = pizzaPhases(boundary + epsilon);
    for (const key of Object.keys(before).filter(key => key !== 't')) assert.ok(Math.abs(before[key] - after[key]) < 1e-4, `${boundary}: ${key}`);
  }
  assert.equal(pizzaPhases(23.99).servedScale, 0); assert.equal(pizzaPhases(24).dough, 0);
  assert.equal(pizzaPhases(24).returning, 0); assert.ok(pizzaPhases(23.9999).returning > .999);
});
test('robot joint solution reaches the requested point or the reachable boundary', () => {
  for (const [x, y] of [[-.2, -1.01], [.7, -1], [-.5, -.15], [.5, -.15], [10, 0], [0, 0]]) {
    const p = pizzaArmPose(x, y), tipX = Math.cos(p.shoulder) * 1.15 + Math.cos(p.shoulder + p.elbow) * 1.1;
    const tipY = Math.sin(p.shoulder) * 1.15 + Math.sin(p.shoulder + p.elbow) * 1.1;
    assert.ok(Object.values(p).every(Number.isFinite));
    assert.ok(Math.hypot(tipX - p.tipX, tipY - p.tipY) < 1e-10);
    if (Math.hypot(x, y) >= .051 && Math.hypot(x, y) <= 2.249) assert.ok(Math.hypot(tipX - x, tipY - y) < 1e-10);
  }
});
