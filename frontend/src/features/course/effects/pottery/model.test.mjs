import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const compiled = ts.transpileModule(await readFile(new URL('./model.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { drawPattern, drawPlate, randomPainting, PALETTES, PATTERNS, randomVessel, vesselRadius, VESSEL_PARAMETERS, DEFAULT_VESSEL, DEFAULT_PATTERN_OPTIONS } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
function commands(size, seed, kind, options) {
  const log = [];
  const ctx = new Proxy({}, {
    get: (_, key) => (...args) => { if (key !== 'scale') log.push([key, ...args]); },
    set: (_, key, value) => { log.push([key, value]); return true; },
  });
  drawPattern({ width: size, height: size, getContext: () => ctx }, seed, 0, kind, options);
  return log;
}
test('all pattern thumbnails use the same geometry and stroke weights as the full glaze', () => {
  for (const { id } of PATTERNS) assert.deepEqual(commands(128, 317, id), commands(1024, 317, id), id);
});
test('all pattern families are reproducible and change with a new seed', () => {
  for (const { id } of PATTERNS) {
    assert.deepEqual(commands(128, 317, id), commands(128, 317, id), id);
    assert.notDeepEqual(commands(128, 317, id), commands(128, 90210, id), id);
  }
});

test('exposed pattern controls alter the painted design in every applicable family', () => {
  for (const {id} of PATTERNS) {
    const baseline=commands(128,317,id,DEFAULT_PATTERN_OPTIONS);
    for(const [key,value] of Object.entries({scale:1.6,petals:14,rotation:35,stroke:1.8,border:0})) {
      if(id==='ikat'&&key==='petals')continue;
      assert.notDeepEqual(commands(128,317,id,{...DEFAULT_PATTERN_OPTIONS,[key]:value}),baseline,`${id}: ${key}`);
    }
  }
});

test('generator combines independent bounded parameters into diverse reproducible silhouettes', () => {
  assert.deepEqual(randomVessel(315), randomVessel(315));
  const silhouettes = new Set();
  for (let seed = 1; seed <= 100; seed++) {
    const shape = randomVessel(seed * 100003);
    for (const { key, min, max } of VESSEL_PARAMETERS) assert.ok(shape[key] >= min && shape[key] <= max);
    const radii = Array.from({ length: 101 }, (_, i) => vesselRadius(i / 100, shape));
    assert.ok(radii.every(r => Number.isFinite(r) && r >= .27 && r <= 1.48), 'open neck and bounded wall');
    assert.ok(radii.slice(1).every((r, i) => Math.abs(r - radii[i]) < .28), 'continuous silhouette without spikes');
    silhouettes.add(radii.filter((_, i) => i % 10 === 0).map(r => r.toFixed(1)).join(','));
  }
  assert.ok(silhouettes.size > 95);
  const baseline = Array.from({ length: 101 }, (_, i) => vesselRadius(i / 100, DEFAULT_VESSEL));
  for (const { key, max } of VESSEL_PARAMETERS.filter(p => p.key !== 'height')) {
    const changed = Array.from({ length: 101 }, (_, i) => vesselRadius(i / 100, { ...DEFAULT_VESSEL, [key]: max }));
    assert.notDeepEqual(changed, baseline, `${key} must influence geometry`);
  }
});

function plateCommands(seed, kind, options) {
  const log = [];
  const ctx = new Proxy({}, {
    get: (_, key) => (...args) => { if (key !== 'scale') log.push([key, ...args]); },
    set: (_, key, value) => { log.push([key, value]); return true; },
  });
  drawPlate({ width: 512, height: 512, getContext: () => ctx }, seed, 0, kind, options);
  return log;
}
test('every family paints a reproducible round plate that changes with the seed', () => {
  for (const { id } of PATTERNS) {
    assert.deepEqual(plateCommands(317, id), plateCommands(317, id), id);
    assert.notDeepEqual(plateCommands(317, id), plateCommands(90210, id), id);
    assert.ok(plateCommands(317, id).filter(c => c[0] === 'arc').length > 20, id + ': a composition, not a blank');
  }
});
test('a random painting picks a family, a palette and bounded controls', () => {
  assert.deepEqual(randomPainting(7), randomPainting(7));
  const kinds = new Set();
  for (let s = 1; s <= 60; s++) {
    const p = randomPainting(s * 7919);
    kinds.add(p.kind);
    assert.ok(PATTERNS.some(x => x.id === p.kind) && p.palette >= 0 && p.palette < PALETTES.length);
    assert.ok(p.options.scale >= .7 && p.options.scale <= 1.6 && p.options.petals >= 4 && p.options.petals <= 20);
  }
  assert.ok(kinds.size >= 6);
});
