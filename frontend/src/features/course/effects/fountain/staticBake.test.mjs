import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = name => readFile(new URL(name, import.meta.url), 'utf8');
async function load(name) {
  const code = ts.transpileModule(await source(name), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}
const { createFountainStaticBake } = await load('./staticBake.ts');
const { createFountainFrameBudget } = await load('./frameBudget.ts');
const { createFountainSim, PIPE, POOL, JET, SHEET, FOUNTAIN: F } = await load('./sim.ts');

test('static colour/depth/mirror are retained indefinitely, and refreshed only on view/light changes', () => {
  const bake = createFountainStaticBake();
  assert.ok(bake.needsBake(1));
  bake.commit(1);
  for (let frame = 0; frame < 10000; frame++) assert.equal(bake.needsBake(1), false);
  assert.equal(bake.count, 1);
  bake.invalidate(); assert.ok(bake.needsBake(1)); bake.commit(1);
  assert.ok(bake.needsBake(1.2)); bake.commit(1.2);
  assert.equal(bake.needsBake(1.2), false);
  assert.equal(bake.count, 3);
});

test('yard water renders at display cadence without multiplying the fixed physics clock', () => {
  for (const hz of [30, 60, 120, 144, 240]) {
    const budget = createFountainFrameBudget(true);
    let time = 0;
    for (let i = 0; i < hz * 4; i++) {
      const dt = budget.take(i * 1000 / hz, 1 / hz);
      assert.notEqual(dt, null);
      time += dt;
    }
    assert.ok(Math.abs(time - 4) < 1e-8);
    assert.equal(budget.take(10000, 10, true), null);
    assert.equal(budget.take(11000, 1 / hz), 1 / hz);
  }
});

function sim(solver, count = 20000) {
  let seed = 17;
  return createFountainSim({ count, rate: count / 10, surfaceSolver: solver, ringShare: .3, jetSpeed: 7,
    jetSpread: .05, windX: .4, windZ: 0, rand: () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296 });
}

test('field surface conserves all water and keeps the pump/overflow alive through a full minute', () => {
  const s = sim('field');
  for (let frame = 0; frame < 3600; frame++) {
    if (frame % 120 === 0) s.poke(2, 1, -.02, .18);
    s.step(1 / 60);
    if (frame % 600 !== 599) continue;
    assert.equal(s.counts.reduce((a, b) => a + b), s.N);
    assert.equal(s.counts[PIPE], s.queued);
    assert.ok(s.counts[JET] > 500 && s.counts[SHEET] > 100, `pump/overflow at ${frame}`);
    for (let i = 0; i < s.N; i++) {
      assert.ok(Number.isFinite(s.px[i] + s.py[i] + s.pz[i] + s.vx[i] + s.vy[i] + s.vz[i]));
      if (s.state[i] === POOL) assert.ok(Math.hypot(s.px[i], s.pz[i]) < F.basinIn + .001);
    }
    assert.ok(s.waves.every(h => Number.isFinite(h) && Math.abs(h) < .15));
  }
  assert.ok(s.emitted > 90000 && s.drained > 80000);
});

test('field solver gives identical physics at 30/60/144 Hz', () => {
  const runs = [30, 60, 144].map(hz => {
    const s = sim('field', 1200);
    for (let i = 0; i < hz * 2; i++) s.step(1 / hz);
    return s;
  });
  for (const key of ['px', 'py', 'pz', 'state', 'waves', 'counts']) {
    assert.deepEqual(runs[0][key], runs[1][key], key);
    assert.deepEqual(runs[0][key], runs[2][key], key);
  }
});

test('field pressure maintains similar pump throughput to the original surface solver', () => {
  // Test the actual yard density; the small particle experiments deliberately retain the pairwise solver.
  const runs = ['field', 'particles'].map(mode => sim(mode));
  for (let frame = 0; frame < 600; frame++) for (const s of runs) s.step(1 / 60);
  assert.ok(runs[0].emitted / runs[1].emitted > .9);
  assert.ok(runs[0].emitted / runs[1].emitted < 1.1);
});

test('surface optics animate over baked stone; dolphin mouth and stream share the rotated pose', async () => {
  const renderer = await source('./renderer.ts');
  assert.ok(!renderer.includes('time - lastSolid'));
  assert.ok(!renderer.includes('time - lastMirror'));
  assert.match(renderer, /staticBake\.needsBake\(look\.sun\)/);
  assert.match(renderer, /uCaustics\.value = 0/);
  assert.match(renderer, /u\.uCaustics\.value = look\.caustics/);
  assert.match(renderer, /Math\.hypot\(statuePaths\[3\], statuePaths\[5\]\)/);
  assert.match(renderer, /poolFoam\.update/);
  const optics = await source('./waterOptics.ts');
  assert.match(optics, /refract\(V, N, 1\.0 \/ 1\.333\)/);
  assert.match(optics, /fwidth\(phase\)/);
  assert.ok(!optics.includes('n2('));
  const statue = await source('./statue.ts');
  assert.match(statue, /DOLPHIN_YAW = -0\.48/);
  assert.equal((statue.match(/applyAxisAngle\(new THREE.Vector3\(0, 1, 0\), DOLPHIN_YAW\)/g) || []).length, 2);
  const scene = await source('../scenes/fountain.ts');
  assert.match(scene, /surfaceSolver: yard \? 'field' : 'particles'/);
  assert.match(scene, /createFountainFrameBudget\(yard\)/);
});
