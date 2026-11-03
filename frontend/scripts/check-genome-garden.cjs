/* Focused DNA/agent regression checks without adding a browser test dependency. */
/* eslint-disable @typescript-eslint/no-require-imports -- this standalone Node script installs a .ts require hook */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

Module._extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  module._compile(output, filename);
};

const { createSceneParams } = require('../src/features/course/effects/scenes/types.ts');
const {
  createGardenGenome, resolveGardenForm, GARDEN_COLUMNS, GARDEN_FEATURES, GARDEN_FORM_COUNT, GARDEN_GENE_LABELS,
} = require('../src/features/course/effects/scenes/genomeGardenGenetics.ts');
const { growGardenGenome, GENOME_GARDEN } = require('../src/features/course/effects/scenes/genomeGarden.ts');

assert.equal(createSceneParams().gardenGenerationMode, 0, 'default must be the archive\'s own full-random DNA, not the structured/"forms" generator');
assert.equal(GENOME_GARDEN.defaultParams.gardenGenerationMode, 0, 'the scene must not override the full-random default');

// This block exercises the structured/"forms" generator specifically (its own feature under test,
// independent of whichever mode the scene defaults to), so it opts into mode 1 explicitly.
const params = createSceneParams({ gardenGenerationMode: 1, gardenSeedLeft: 0.123, gardenSeedRight: 0.687 });
const left = createGardenGenome(params, 0);
const right = createGardenGenome(params, 1);
assert.equal(left.length, GARDEN_COLUMNS * GARDEN_FEATURES);
assert.equal(GARDEN_GENE_LABELS.length, 25);
assert.deepEqual([left[0], left[26], left[52]], [26, 14, 10]);
assert.deepEqual(left, createGardenGenome(params, 0), 'same seed must reproduce the DNA');
assert.notEqual(resolveGardenForm(params, 0), resolveGardenForm(params, 1), 'automatic forms must differ');
assert.ok(left.reduce((count, value, index) => count + (value !== right[index]), 0) > 250, 'two trees need genuinely different DNA');

const leftGrowth = growGardenGenome(left, 100, { form: resolveGardenForm(params, 0), crown: params.gardenCrown, bloom: params.gardenBloom, leafLength: params.gardenLeafLength });
const rightGrowth = growGardenGenome(right, 200, { form: resolveGardenForm(params, 1), crown: params.gardenCrown, bloom: params.gardenBloom, leafLength: params.gardenLeafLength });
for (const growth of [leftGrowth, rightGrowth]) {
  assert.ok(growth.stamps.length > 1000 && growth.stamps.length <= 170000);
  assert.ok(Number.isFinite(growth.minX) && growth.maxX > growth.minX);
  assert.ok(Number.isFinite(growth.minY) && growth.maxY > growth.minY);
}
for (let form = 1; form <= GARDEN_FORM_COUNT; form += 1) {
  const formParams = createSceneParams({ gardenSpeciesLeft: form, gardenSeedLeft: 0.19 });
  assert.equal(resolveGardenForm(formParams, 0), form);
  const genome = createGardenGenome(formParams, 0);
  const growth = growGardenGenome(genome, 119, { form, crown: formParams.gardenCrown, bloom: formParams.gardenBloom, leafLength: formParams.gardenLeafLength });
  assert.ok(growth.stamps.length > 1000 && growth.stamps.length <= 170000, `form ${form} must grow within budget`);
  assert.ok(growth.stamps.some(stamp => Math.max(stamp.red, stamp.green, stamp.blue) > 170), `form ${form} needs bright pigment`);
  assert.ok(growth.stamps.filter(stamp => Math.hypot(stamp.x - stamp.fromX, stamp.y - stamp.fromY) > 0.1).length > growth.stamps.length * 0.95,
    `form ${form} should draw connected segments, not isolated dots`);
  for (const stamp of growth.stamps) {
    assert.ok(Number.isFinite(stamp.fromX) && Number.isFinite(stamp.fromY), `form ${form} needs connected branch segments`);
  }
}
const seenForms = new Set(Array.from({ length: 120 }, (_, index) => resolveGardenForm(
  createSceneParams({ gardenSeedLeft: (index + 0.5) / 120 }), 0,
)));
assert.equal(seenForms.size, GARDEN_FORM_COUNT, 'automatic generation must expose every silhouette');

params.gardenGeneOverrides[0][11] = 0;
params.gardenGeneOverrides[0][13 * GARDEN_FEATURES + 25] = 255;
assert.equal(createGardenGenome(params, 0)[11], 0, 'first generation edits must apply');
assert.equal(createGardenGenome(params, 0)[13 * GARDEN_FEATURES + 25], 255, 'last generation edits must apply');
assert.deepEqual(createGardenGenome(params, 1), right, 'editing left must not edit right');

const raw = createGardenGenome(createSceneParams({ gardenGenerationMode: 0, gardenSeedLeft: 0.123 }), 0);
assert.equal(raw.length, GARDEN_COLUMNS * GARDEN_FEATURES);
assert.ok(raw.reduce((count, value, index) => count + (value !== left[index]), 0) > 250);

const archived = createGardenGenome(createSceneParams({ gardenGenerationMode: 2, gardenGenomeA: 0, gardenCrossMode: 0, gardenMutations: 0 }), 0);
assert.equal(archived.length, GARDEN_COLUMNS * GARDEN_FEATURES);
assert.ok(archived.reduce((count, value, index) => count + (value !== left[index]), 0) > 250);

console.log('Genome garden: eleven forms, connected branches, vivid pigments, independent trees, edits, archive mode and growth passed.');
