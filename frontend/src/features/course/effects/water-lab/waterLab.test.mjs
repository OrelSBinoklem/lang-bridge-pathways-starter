import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function sourceModule(file) {
  const source = await readFile(new URL(file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}
const { fluidGrid, fluidSteps, FLUID_DT, PRESSURE_ITERATIONS } = await sourceModule('./waterfallSimulation.ts');
const { createPoolFoam } = await sourceModule('../fountain/poolFoam.ts');
test('fluid grid has square cells and bounded cost across desktop/mobile', () => {
  for (const aspect of [.25, 390 / 680, 1440 / 788, 4]) {
    const grid = fluidGrid(aspect);
    assert.ok(grid.width <= 320 && grid.height <= 192);
    assert.ok(Math.abs(grid.width / grid.height - aspect) <= 1 / grid.height);
    assert.ok(grid.width * grid.height <= 61440);
  }
  assert.deepEqual(fluidGrid(NaN), fluidGrid(1));
  assert.ok(PRESSURE_ITERATIONS >= 12 && PRESSURE_ITERATIONS <= 24);
});

test('fixed fluid step is frame-rate independent and caps catch-up', () => {
  for (const fps of [30, 60, 120]) {
    let rest = 0, count = 0;
    for (let i = 0; i < fps; i++) { const tick = fluidSteps(rest, 1 / fps); rest = tick.remainder; count += tick.steps; }
    assert.equal(count, 60);
  }
  for (const elapsed of [0, -1, NaN]) assert.deepEqual(fluidSteps(0, elapsed), { steps: 0, remainder: 0 });
  assert.equal(fluidSteps(0, 10).steps, 3);
  assert.equal(fluidSteps(0, FLUID_DT).steps, 1);
});

test('pool foam follows surface particles only, clears old positions, and stays bounded', () => {
  const field = createPoolFoam(32);
  const x = new Float32Array([0, 0]), z = new Float32Array([0, 0]);
  const state = new Uint8Array([5, 4]), foam = new Float32Array([1, 1]);
  field.update(x, z, state, foam, 3, 5);
  const before = field.pixels.slice();
  assert.ok(before.some(v => v > 0));
  x[0] = 2;
  field.update(x, z, state, foam, 3, 5);
  assert.notDeepEqual(field.pixels, before);
  state[0] = 4;
  field.update(x, z, state, foam, 3, 5);
  assert.ok(field.pixels.every(v => v === 0));
});

test('experimental basin remains opt-in and demo stays discoverable', async () => {
  const params = await readFile(new URL('../scenes/types.ts', import.meta.url), 'utf8');
  assert.match(params, /fntPool: 0/);
  const navigation = await readFile(new URL('../../../../lib/admin-navigation.ts', import.meta.url), 'utf8');
  assert.match(navigation, /\/course\/water-lab/);
});
