import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFile } from 'node:fs/promises';
register(new URL('../../../../../scripts/scene-catalog-loader.mjs', import.meta.url));
const { ALL_SCENES, getScene } = await import('./registry.ts');
const { ALL_SCENES: originals } = await import('./sceneSources.ts');
const { lazyScene } = await import('./lazyScene.ts');

test('all lazy descriptors resolve the exact original scene, preserving tuning and palettes', async () => {
  assert.equal(ALL_SCENES.length, originals.length);
  assert.equal(new Set(ALL_SCENES.map(s => s.id)).size, ALL_SCENES.length);
  for (const scene of ALL_SCENES) {
    const actual = await scene.load();
    assert.equal(actual, originals.find(s => s.id === scene.id));
    assert.deepEqual(scene.defaultParams, actual.defaultParams);
    assert.deepEqual(scene.palettes, actual.palettes);
    assert.equal(scene.sourceKind, actual.kind);
    assert.equal(scene.pixelRatioCap, actual.pixelRatioCap);
  }
  assert.equal(getScene('not-a-scene'), null);
});

test('concurrent mounts share one import and failed imports can retry', async () => {
  const actual = { kind:'canvas', id:'test', palettes:[['#000']], label:'Test', create(){} };
  let calls = 0;
  const scene = lazyScene(actual, async () => { if (++calls === 1) throw new Error('Network unavailable'); return actual; });
  await assert.rejects(scene.load(), /Network/);
  const [a,b] = await Promise.all([scene.load(),scene.load()]);
  assert.equal(a,actual); assert.equal(b,actual); assert.equal(calls,2);
});

test('registry and tuning tables do not eagerly import GPU/physics engines', async () => {
  const registry = await readFile(new URL('./registry.ts', import.meta.url),'utf8');
  const settings = await readFile(new URL('./sceneSettings.generated.ts', import.meta.url),'utf8');
  assert.doesNotMatch(registry, /from ['"].*(?:sceneSources|gems|cinematic|dragonBurner)['"]/);
  assert.doesNotMatch(settings, /^import\s/m);
});

test('Among friends has only fireflies and Earth/Air/Water keeps its large composition', async () => {
  const { getGroupEffect, getGroupEffectVariants } = await import('../groupEffects.config.ts');
  assert.deepEqual(getGroupEffectVariants(1787).map(v => v.id), ['fireflies']);
  assert.equal(getGroupEffect({categoryId:1787,title:null,variantId:'light-circle'}).sceneId,'fireflies');
  const earth = getGroupEffect({categoryId:1791,title:null});
  assert.equal(earth.sceneId,'dragon-burner-card');
  assert.equal(earth.bodyEffect.scene,'burner-pair');
  const card = await getScene(earth.sceneId).load();
  assert.equal(card.defaultParams.dbGrid,0);
  assert.equal(card.defaultParams.dbPasses,10);
});

test('burners have bounded startup work and show the model before smoke finishes filling', async () => {
  const source = await readFile(new URL('./dragonBurner.ts', import.meta.url),'utf8');
  assert.doesNotMatch(source,/\.warm\(0\.5/);
  assert.doesNotMatch(source,/b && warmed >= 30/);
  assert.match(source,/const left = c.width - width/);
});
