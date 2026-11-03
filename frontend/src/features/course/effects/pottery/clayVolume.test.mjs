import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const urls = {};
for (const name of ['model', 'tetraBody', 'clayMesh', 'clayPhysics']) {
  let js = ts.transpileModule(await readFile(new URL(`./${name}.ts`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const [dependency, url] of Object.entries(urls)) js = js.replaceAll(`'./${dependency}'`, JSON.stringify(url));
  urls[name] = 'data:text/javascript;base64,' + Buffer.from(js).toString('base64');
}
const { ClayPhysics, levelingSpeed } = await import(urls.clayPhysics);
const { clayNode, CLAY_ROWS, CLAY_SIDES, sampleClay } = await import(urls.clayMesh);
const { DEFAULT_VESSEL, randomVessel } = await import(urls.model);
const tool = { height: 1.625, angle: 0, width: .38, pressure: 1, direction: -1 };
const advance = (clay, seconds, hz = 120) => { for (let i = 0; i < Math.round(seconds * hz); i++) clay.step(1 / hz); };

test('closed periodic volume lattice has positive elements and a seamless smooth surface', () => {
  const clay = new ClayPhysics(), a = { x: 0, y: 0, z: 0 }, b = { ...a };
  assert.equal(clay.diagnostics().nodes, 1600); assert.equal(clay.diagnostics().tets, 4608);
  assert.ok(clay.body.restVolumes.every(v => v > 0));
  sampleClay(clay.positions, 11.5, 0, 1, a); sampleClay(clay.positions, 11.5, CLAY_SIDES, 1, b);
  assert.deepEqual(a, b); assert.equal(clay.step(1), false);
});
test('pressure makes a LOCAL dent, preserves material volume and does not move the anchored base', () => {
  const clay = new ClayPhysics(), before = clay.positions.slice();
  clay.setContact(tool); advance(clay, .7);
  const near = clayNode(12, 0, 1) * 3 + 2, far = clayNode(12, 16, 1) * 3 + 2;
  const dent = Math.abs(clay.positions[near] - before[near]);
  assert.ok(dent > .04); assert.ok(Math.abs(clay.positions[far] - before[far]) < dent * .2);
  assert.deepEqual(clay.positions.slice(0, CLAY_SIDES * 2 * 2 * 3), before.slice(0, CLAY_SIDES * 2 * 2 * 3));
  assert.ok(clay.diagnostics().volumeError < .015); assert.ok(clay.diagnostics().minRatio > .5);
  clay.setContact(null); advance(clay, 2);
  assert.ok(Math.abs(clay.positions[near] - before[near]) > dent * .8, 'no elastic return to the initial shape');
  assert.ok(clay.diagnostics().volumeError < .015); assert.equal(clay.step(1 / 60), false);
});
test('outward pressure expands the touched side and upward movement transports clay vertically', () => {
  const clay = new ClayPhysics(), before = clay.positions.slice(), near = clayNode(12, 0, 1) * 3;
  clay.setContact({ ...tool, direction: 1, lift: .7 }); advance(clay, .5);
  assert.ok(clay.positions[near + 2] > before[near + 2] + .04);
  assert.ok(clay.positions[near + 1] > before[near + 1] + .015);
  assert.ok(clay.diagnostics().volumeError < .015);
});
test('wheel rotation distributes a stationary tool around the vessel', () => {
  const clay = new ClayPhysics(), before = clay.positions.slice();
  for (let i = 0; i < 240; i++) { clay.setContact({ ...tool, angle: -i / 240 * Math.PI * 2 }); clay.step(1 / 120); }
  let sectors = 0;
  for (let side = 0; side < CLAY_SIDES; side++) {
    const n = clayNode(12, side, 1) * 3;
    if (Math.hypot(clay.positions[n], clay.positions[n + 2]) < Math.hypot(before[n], before[n + 2]) - .01) sectors++;
  }
  assert.ok(sectors >= 28); assert.ok(clay.diagnostics().volumeError < .02);
});

test('leveling presses protrusions / fills depressions without reversing the selected direction', () => {
  for (const direction of [-1, 1]) {
    const speeds = [-.1, 0, .1].map(error => levelingSpeed(.85 + error, .85, direction, .4));
    assert.ok(speeds.every(speed => speed * direction >= 0));
    assert.ok(speeds[0] > speeds[1] && speeds[1] > speeds[2]);
    assert.equal(speeds[1], direction * .4);
    for (const error of [-100, 100]) assert.ok(Math.abs(levelingSpeed(.85 + error, .85, direction, .4)) <= 1.2 + 1e-9);
  }
  assert.equal(levelingSpeed(.9, .8, 0, .4), 0);
});

const bandStats = clay => {
  const radii = Array.from({ length: CLAY_SIDES }, (_, side) => {
    const i = clayNode(12, side, 1) * 3;
    return Math.hypot(clay.positions[i], clay.positions[i + 2]);
  });
  return { mean: radii.reduce((a, b) => a + b) / radii.length, spread: Math.max(...radii) - Math.min(...radii) };
};
for (const direction of [-1, 1]) test(`ring tool changes the whole circumference with a stopped wheel (${direction})`, () => {
  const clay = new ClayPhysics(), before = bandStats(clay);
  clay.setContact({ ...tool, ring: true, direction }); advance(clay, .6);
  const after = bandStats(clay);
  assert.ok((after.mean - before.mean) * direction > .04);
  assert.ok(after.spread < .02, `ring must stay round: ${after.spread}`);
  for (let side = 0; side < CLAY_SIDES; side++) {
    const i = clayNode(12, side, 1) * 3;
    assert.ok((Math.hypot(clay.positions[i], clay.positions[i + 2]) - before.mean) * direction > .03);
  }
  assert.ok(clay.diagnostics().volumeError < .015);
  assert.equal(clay.diagnostics().rejectedSteps, 0);
});
test('generated vessels have valid material volumes and remain sculptable; undo restores their own volume targets', () => {
  const clay = new ClayPhysics(), blank = clay.snapshot();
  for (let seed = 0; seed < 12; seed++) {
    const shape = seed ? randomVessel(seed * 10987) : DEFAULT_VESSEL;
    clay.generate(shape); const generated = clay.snapshot();
    assert.ok(clay.body.restVolumes.every(v => v > 0));
    assert.ok(Math.abs(clay.height - shape.height * 3.25) < .00001);
    clay.setContact({ ...tool, ring: true, height: clay.height * .42 }); advance(clay, .15);
    assert.ok(clay.diagnostics().volumeError < .025);
    assert.equal(clay.diagnostics().rejectedSteps, 0);
    clay.restore(generated); assert.deepEqual(clay.snapshot(), generated);
    assert.ok(clay.diagnostics().volumeError < 1e-7);
  }
  clay.restore(blank); assert.deepEqual(clay.snapshot(), blank);
  clay.generate(DEFAULT_VESSEL); clay.reset(); assert.deepEqual(clay.snapshot(), blank);
});
for (const direction of [-1, 1]) {
  test(`held rotating tool levels an existing ${direction < 0 ? 'bump' : 'dent'} while changing radius`, () => {
    const clay = new ClayPhysics();
    clay.setContact({ ...tool, direction: -direction }); advance(clay, .7);
    clay.setContact(null); advance(clay, 2);
    const before = bandStats(clay);
    assert.ok(before.spread > .05, 'start with a genuinely uneven circumference');
    for (let i = 0; i < 480; i++) {
      clay.setContact({ ...tool, direction, angle: -i / 480 * Math.PI * 2 }); clay.step(1 / 120);
    }
    const after = bandStats(clay);
    assert.ok(after.spread < before.spread * .8, `spread ${before.spread} -> ${after.spread}`);
    assert.ok((after.mean - before.mean) * direction > .02);
    assert.ok(clay.diagnostics().volumeError < .01);
    assert.equal(clay.diagnostics().rejectedSteps, 0);
  });
}
test('undo/reset include plastic rest lengths; paint freeze does not change a single vertex', () => {
  const clay = new ClayPhysics(), initial = clay.snapshot();
  clay.setContact(tool); advance(clay, .25); const shaped = clay.snapshot();
  clay.freeze(); advance(clay, 1); assert.deepEqual(clay.snapshot(), shaped);
  clay.reset(); assert.deepEqual(clay.snapshot(), initial);
  clay.restore(shaped); assert.deepEqual(clay.snapshot(), shaped);
});
test('stress strokes do not invert the material or produce invalid vertices', () => {
  const clay = new ClayPhysics(); clay.softness = 1;
  for (let stroke = 0; stroke < 16; stroke++) {
    clay.setContact({ ...tool, height: .15 + stroke % 8 * .44, angle: stroke * 1.3, direction: stroke % 2 ? 1 : -1, width: .2, pressure: 1.5, lift: stroke % 2 ? 1 : -1 });
    advance(clay, .15);
    assert.ok(clay.positions.every(Number.isFinite)); assert.ok(clay.diagnostics().minRatio > .09);
    assert.ok(clay.diagnostics().volumeError < .03);
  }
  assert.ok(clay.positions[clayNode(CLAY_ROWS, 0, 1) * 3 + 1] > 2.5);
});
test('fixed physics steps are equivalent at 30, 60 and 120 Hz', () => {
  const states = [30, 60, 120].map(hz => { const clay = new ClayPhysics(); clay.setContact(tool); advance(clay, .3, hz); return clay.positions.slice(); });
  for (let n = 0; n < states[0].length; n++) { assert.ok(Math.abs(states[0][n] - states[1][n]) < .0001); assert.ok(Math.abs(states[0][n] - states[2][n]) < .0001); }
});

test('many ring strokes keep the jug round: no asymmetry builds up (owner, 2026-10-30)', () => {
  const clay = new ClayPhysics(randomVessel(4242));
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const roundness = () => {
    let worst = 0;
    for (let row = 2; row <= CLAY_ROWS; row++) {
      const radii = [];
      for (let side = 0; side < CLAY_SIDES; side++) { const i = clayNode(row, side, 1) * 3; radii.push(Math.hypot(clay.positions[i], clay.positions[i + 2])); }
      const mean = radii.reduce((a, b) => a + b, 0) / radii.length;
      worst = Math.max(worst, ...radii.map(r => Math.abs(r - mean) / mean));
    }
    return worst;
  };
  for (let k = 0; k < 40; k++) {
    clay.setContact({ ...tool, ring: true, height: clay.height * (.2 + rand() * .7), direction: rand() < .5 ? -1 : 1, lift: (rand() - .5) * .8, width: .25 + rand() * .4 });
    advance(clay, .25);
    clay.setContact(null); advance(clay, .1);
  }
  assert.ok(roundness() < .02, `rows stay round (worst deviation ${(roundness() * 100).toFixed(2)} %)`);
  assert.ok(clay.diagnostics().volumeError < .03); assert.ok(clay.diagnostics().minRatio > .3);
});
