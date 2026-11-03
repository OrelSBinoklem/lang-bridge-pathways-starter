import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const compiled = ts.transpileModule(await readFile(new URL('./liquidTimerPhysics.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { createLiquidTimer, TIMER_VOLUME } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const make = () => {
  let seed = 123;
  return createLiquidTimer(() => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32));
};
const total = (sim, lane) => sim.remaining[lane] + sim.collected[lane] + sim.nozzle[lane] + sim.drops.filter(d => d.lane === lane).reduce((n, d) => n + d.volume, 0);

test('liquid is conserved in each channel over a complete run; nothing sticks indefinitely', () => {
  const sim = make();
  let contactSeen = false, flightSeen = false, peak = 0;
  for (let i = 0; i < 60 * 240; i++) {
    sim.update(1 / 60); peak = Math.max(peak, sim.drops.length);
    contactSeen ||= sim.drops.some(d => d.contact >= 0);
    flightSeen ||= sim.drops.some(d => d.contact < 0);
    for (let lane = 0; lane < 2; lane++) assert.ok(Math.abs(total(sim, lane) - TIMER_VOLUME) < 1e-8);
    for (const d of sim.drops) assert.ok(Number.isFinite(d.x + d.y + d.vx + d.vy) && d.volume > 0);
  }
  assert.ok(contactSeen && flightSeen);
  assert.ok(peak < 96);
  assert.equal(sim.drops.length, 0);
  for (const amount of sim.collected) assert.ok(Math.abs(amount - TIMER_VOLUME) < 1e-8);
});
test('fixed time step gives the same positions at 30, 60 and 120 display fps', () => {
  const runs = [30, 60, 120].map(fps => {
    const sim = make(); for (let i = 0; i < fps * 18; i++) sim.update(1 / fps); return sim;
  });
  for (const sim of runs.slice(1)) assert.deepEqual(sim.drops, runs[0].drops);
});
test('a drop traverses the staircase instead of falling through successive shelves', () => {
  const sim = make();
  sim.remaining.fill(0);
  const drop = { x: 100, y: 177, vx: 0, vy: 2, volume: 1, lane: 0, contact: -1, departed: -1, wobble: 0 };
  sim.drops.push(drop);
  const contacts = new Set();
  for (let i = 0; i < 120 * 100 && sim.drops.length; i++) {
    sim.update(1 / 120); if (drop.contact >= 0) contacts.add(drop.contact);
  }
  assert.equal(contacts.size, 18, `Only visited ${contacts.size} of 18 steps: ${[...contacts]}`);
  assert.equal(sim.drops.length, 0);
});
test('reset restores both reservoirs; long frames do not tunnel or spawn a backlog', () => {
  const sim = make(); for (let i = 0; i < 100; i++) sim.update(1 / 30);
  const before = sim.time; sim.update(20);
  assert.ok(sim.time - before < 0.101);
  sim.reset();
  assert.equal(sim.time, 0); assert.equal(sim.drops.length, 0);
  assert.deepEqual(sim.remaining, [TIMER_VOLUME, TIMER_VOLUME]);
  assert.deepEqual(sim.collected, [0, 0]); assert.deepEqual(sim.nozzle, [0, 0]);
});
test('coalescence adds volumes only within one depth channel', () => {
  const sim = make(); sim.remaining.fill(0);
  const drop = lane => ({ x: 200, y: 180, vx: 0, vy: 0, volume: 1, lane, contact: -1, departed: -1, wobble: 0 });
  sim.drops.push(drop(0), drop(0), drop(1));
  sim.update(1 / 120);
  assert.equal(sim.drops.length, 2);
  assert.equal(sim.drops.find(d => d.lane === 0).volume, 2);
  assert.equal(sim.drops.find(d => d.lane === 1).volume, 1);
});

test('swept stirring catches a fast pass, affects only nearby drops and conserves liquid', () => {
  const sim = make(); sim.remaining.fill(0);
  const drop = (x, y) => ({ x, y, vx: 0, vy: 0, volume: 1, lane: 0, contact: -1, departed: -1, wobble: 0 });
  sim.drops.push(drop(200, 300), drop(200, 460));
  sim.stir(100, 300, 300, 300, false, 1 / 60);
  assert.ok(sim.drops[0].vx > 0, 'cursor path must hit even when its endpoint is far away');
  assert.equal(sim.drops[1].vx, 0);
  assert.equal(total(sim, 0), 2);
  sim.stir(200, 300, 200, 280, true, 1 / 60);
  assert.ok(sim.drops[0].vy < 0, 'held cursor pulls upward');
});

test('stirring never creates volume or drives drops beyond the sealed sidewalls', () => {
  const sim = make();
  for (let i = 0; i < 1800; i++) {
    const x = 200 + Math.sin(i * .17) * 100, y = 350 + Math.cos(i * .11) * 150;
    sim.stir(400 - x, 700 - y, x, y, true, 1 / 60, 100);
    sim.update(1 / 60);
    for (let lane = 0; lane < 2; lane++) assert.ok(Math.abs(total(sim, lane) - TIMER_VOLUME) < 1e-8);
    for (const d of sim.drops) {
      assert.ok(Number.isFinite(d.x + d.y + d.vx + d.vy));
      assert.ok(d.x >= 89 && d.x <= 311 && d.y >= 170);
    }
  }
  const snapshot = JSON.stringify(sim.drops);
  sim.stir(NaN, 0, 200, 300, true, 1 / 60);
  sim.stir(200, 300, 210, 310, true, 0);
  assert.equal(JSON.stringify(sim.drops), snapshot);
});
