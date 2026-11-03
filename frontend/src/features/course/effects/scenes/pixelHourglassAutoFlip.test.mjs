import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const load = async name => {
  const code = ts.transpileModule(await readFile(new URL(name + '.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
};
const { createPixelHourglassAutoFlip, pixelHourglassDrained } = await load('./pixelHourglassAutoFlip');
const { createPixelSand, stepPixelSand } = await load('./pixelHourglassPhysics');
const lowerFull = () => Uint8Array.from({ length: 128 }, (_, i) => Number(i >= 64));

test('only a completely emptied upstream chamber can trigger, in either orientation', () => {
  const cells = lowerFull();
  assert.equal(pixelHourglassDrained(cells, 0), true);
  assert.equal(pixelHourglassDrained(cells, Math.PI), false);
  assert.equal(pixelHourglassDrained(cells, Math.PI / 2), false);
  cells[0] = 1; cells[64] = 0;
  assert.equal(pixelHourglassDrained(cells, 0), false);
  assert.equal(pixelHourglassDrained(new Uint8Array(128), 0), false);
});

test('automatic half turn is smooth, finite and does not bounce back before sand transfers', () => {
  const auto = createPixelHourglassAutoFlip(), cells = lowerFull();
  let angle = 0, previous = 0;
  for (let i = 0; i < 180; i++) {
    angle = auto.update(1 / 60, angle, cells, false);
    assert.ok(angle >= previous && angle - previous < .1);
    previous = angle;
  }
  assert.ok(Math.abs(angle - Math.PI) < 1e-10);
});

test('holding the case suppresses turns; releasing it leaves a grace period', () => {
  const auto = createPixelHourglassAutoFlip(), cells = lowerFull();
  let angle = 0;
  for (let i = 0; i < 600; i++) angle = auto.update(1 / 60, angle, cells, true);
  assert.equal(angle, 0);
  for (let i = 0; i < 80; i++) angle = auto.update(1 / 60, angle, cells, false);
  assert.equal(angle, 0);
  for (let i = 0; i < 120; i++) angle = auto.update(1 / 60, angle, cells, false);
  assert.ok(Math.abs(angle - Math.PI) < 1e-10);
});

test('grabbing a turning case immediately cancels automation without an angle jump', () => {
  const auto = createPixelHourglassAutoFlip(), cells = lowerFull();
  let angle = 0;
  for (let i = 0; i < 65; i++) angle = auto.update(1 / 60, angle, cells, false);
  assert.ok(angle > 0 && angle < Math.PI);
  const grabbed = angle + .12;
  assert.equal(auto.update(1 / 60, grabbed, cells, true), grabbed);
  for (let i = 0; i < 80; i++) assert.equal(auto.update(1 / 60, grabbed, cells, false), grabbed);
});

for (const fps of [30, 60, 144]) test(`real sand repeatedly drains and turns at ${fps} fps without adding or resetting grains`, () => {
  const sand = createPixelSand(), auto = createPixelHourglassAutoFlip();
  const count = sand.cells.reduce((a, b) => a + b, 0);
  let angle = 0, physicsTime = 0;
  for (let frame = 0; frame < fps * 75; frame++) {
    angle = auto.update(1 / fps, angle, sand.cells, false);
    physicsTime += 1 / fps;
    while (physicsTime >= 1 / 60) {
      stepPixelSand(sand, Math.sin(angle), Math.cos(angle), 1 / 60);
      physicsTime -= 1 / 60;
    }
    assert.equal(sand.cells.reduce((a, b) => a + b, 0), count);
  }
  assert.ok(angle >= Math.PI * 3, `expected repeated full drain cycles; angle=${angle}`);
  assert.ok(sand.transfers > 150);
});
