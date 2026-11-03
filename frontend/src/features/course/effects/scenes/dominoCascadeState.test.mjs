import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const compiled = ts.transpileModule(await readFile(new URL('./dominoCascadeState.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { createCascade } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const run = (s, seconds, fps = 60) => { for (let i = 0; i < seconds * fps; i++) s.update(1 / fps); };
const descendants = (s, start) => {
  const seen = new Set(), queue = [start];
  while (queue.length) { const id = queue.pop(); if (seen.has(id)) continue; seen.add(id); queue.push(...s.nodes[id].next); }
  return seen;
};

test('all links are valid; the complete cascade reaches every mechanism and both branches', () => {
  const s = createCascade(); assert.ok(s.nodes.length > 100);
  assert.equal(descendants(s, 0).size, s.nodes.length);
  for (const n of s.nodes) for (const id of n.next) assert.ok(id > n.id && id < s.nodes.length);
  s.trigger(0); run(s, 100);
  assert.ok(s.nodes.every(n => n.active && n.fired));
});

test('every individual object can start its downstream cascade without starting upstream nodes', () => {
  for (let start = 0; start < createCascade().nodes.length; start++) {
    const s = createCascade(), expected = descendants(s, start); s.trigger(start); run(s, 100, 30);
    for (const n of s.nodes) assert.equal(n.fired, expected.has(n.id), `start=${start} target=${n.id}`);
  }
});

test('transfer waits for contact; it is not an immediate/global timed activation', () => {
  const s = createCascade(); s.trigger(0); s.update(1 / 120);
  assert.equal(s.nodes[1].active, false); assert.ok(s.nodes[0].q > 0);
  run(s, 1); assert.ok(s.nodes[1].active); assert.ok(!s.nodes.at(-1).active);
});

test('restarting a spent middle section preserves unrelated branches and upstream state', () => {
  const s = createCascade(); s.trigger(0); run(s, 100);
  const split = s.nodes.find(n => n.kind === 'rotor'); const start = split.next[0];
  const affected = descendants(s, start); const before = s.nodes.map(n => n.q);
  s.trigger(start);
  for (const n of s.nodes) assert.equal(n.q, affected.has(n.id) ? 0 : before[n.id]);
  run(s, 100); assert.ok(s.nodes.every(n => n.fired));
});

test('multiple starts, frame rate and long/invalid deltas stay bounded and deterministic', () => {
  const states = [30, 60, 120].map(fps => {
    const s = createCascade(); s.trigger(0); s.trigger(55); s.trigger(90); run(s, 12, fps); return s;
  });
  assert.deepEqual(states[0].nodes, states[1].nodes); assert.deepEqual(states[1].nodes, states[2].nodes);
  const s = states[0], time = s.time; s.update(NaN); s.update(-4); assert.equal(s.time, time);
  s.update(100); assert.ok(s.time - time < .101);
  s.trigger(-1); s.trigger(999); s.reset();
  assert.equal(s.time, 0); assert.ok(s.nodes.every(n => !n.active && n.q === 0));
});
