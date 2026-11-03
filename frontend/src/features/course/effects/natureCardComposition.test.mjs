import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = name => readFile(new URL(name, import.meta.url), 'utf8');
const url = text => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(text, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText).toString('base64');
const catalog = url(await source('./scenes/cinematic/catalog.ts'));
const configUrl = url((await source('./groupEffects.config.ts')).replace(/(['"])\.\/scenes\/cinematic\/catalog\1/, JSON.stringify(catalog)));
const { getGroupEffect, getGroupEffectVariants } = await import(configUrl);
const { natureCardComposition } = await import(url((await source('./natureCardComposition.ts')).replace(/(['"])\.\/groupEffects.config\1/, JSON.stringify(configUrl))));
const group = id => getGroupEffect({ categoryId: 1778, title: null, variantId: id });

test('card sakura uses the existing original card definition, not a smaller BodyNatureEffect', () => {
  const full = group('sakura-card-full');
  const tuning = { kind: 'sakura', params: { petalCount: 120, petalSize: 17, blossomSize: 1, treeScale: 1.2, windStrength: .5 } };
  const result = natureCardComposition(full, tuning);
  assert.equal(result.effect, group('sakura'));
  assert.equal(result.effect.kind, 'sakura'); assert.equal(result.effect.bodyEffect, undefined);
  assert.equal(result.tuning.params.petalCount, 60); assert.equal(result.tuning.params.petalSize, 7);
  assert.equal(result.tuning.params.blossomSize, 1); assert.equal(result.tuning.params.treeScale, 1.2);
  assert.equal(result.tuning.params.windStrength, .5);
  assert.equal(tuning.params.petalSize, 17); assert.equal(full.bodyEffect, 'sakura-card');
});

test('leaf card restores the exact original density, size, speed, sway and interaction settings', () => {
  const full = group('leaves-full');
  const tuning = { kind: 'ambient', params: { ...full.ambient, sizeRange: [...full.ambient.sizeRange] } };
  const result = natureCardComposition(full, tuning);
  assert.equal(result.effect, group('leaves')); assert.equal(result.effect.bodyEffect, undefined);
  const expected = group('leaves').ambient;
  for (const key of ['count', 'swayAmplitude', 'cursorRepelRadius', 'cursorRepelForce']) assert.equal(result.tuning.params[key], expected[key]);
  for (const key of ['sizeRange', 'fallSpeedRange']) for (let i = 0; i < 2; i++) {
    assert.ok(Math.abs(result.tuning.params[key][i] - expected[key][i]) < 1e-10);
  }
  assert.deepEqual(tuning.params.sizeRange, [10, 24]); assert.equal(tuning.params.count, 210);
});

test('existing standalone small variants are untouched and no double shrinkage is applied', () => {
  for (const id of ['sakura', 'leaves']) assert.equal(natureCardComposition(group(id), null), null);
  assert.equal(natureCardComposition(getGroupEffect({ categoryId: 1780, title: null }), null), null);
  assert.equal(natureCardComposition(group('leaves-full'), null).effect, group('leaves'));
  assert.equal(natureCardComposition(group('sakura-card-full'), null).effect, group('sakura'));
  assert.deepEqual(getGroupEffectVariants(1778).map(v => v.id), ['sakura-card-full', 'leaves-full']);
});

test('live tuning remains relative to the original small composition, independent of card viewport size', () => {
  const effect = group('leaves-full');
  const tuning = { kind: 'ambient', params: { ...effect.ambient, count: 420, sizeRange: [20, 48] } };
  const result = natureCardComposition(effect, tuning);
  assert.equal(result.tuning.params.count, 84); assert.deepEqual(result.tuning.params.sizeRange, [14, 26]);
  assert.deepEqual(natureCardComposition(effect, tuning), result);
  const two = natureCardComposition(group('sakura-landscape'), { kind: 'sakura', fullPage: true, params: { petalCount: 180, petalSize: 9, blossomSize: 1.1 } });
  assert.equal(two.tuning.params.petalSize, 7); assert.equal(two.tuning.params.blossomSize, 1); assert.equal(two.tuning.fullPage, false);
});

test('routing bypasses the body engine only for card composition; large views retain the body engines', async () => {
  const surface = await source('./EffectSurface.tsx');
  assert.ok(surface.indexOf('if (bodyView') < surface.indexOf('natureCardComposition(effect, tuning)'));
  assert.match(surface, /if \(natureCard\) return <EffectCanvas[\s\S]*?effect=\{natureCard.effect\}/);
  const canvas = await source('./EffectCanvas.tsx');
  assert.match(canvas, /detailed=\{effect.bodyEffect === 'sakura-card'\}/);
  assert.doesNotMatch(canvas, /compactNature|natureCardScale|natureCardPetals/);
  const body = await source('./BodyNatureEffect.tsx');
  assert.doesNotMatch(body, /compactNature/);
  assert.match(body, /<LandscapeBackdrop/);
  assert.doesNotMatch(await source('./FullscreenEffect.tsx'), /natureCardComposition/);
});
