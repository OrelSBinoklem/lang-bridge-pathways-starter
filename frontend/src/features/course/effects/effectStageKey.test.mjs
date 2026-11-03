import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// These metadata modules deliberately do not import React or a GPU renderer.
const cache = new Map();
function load(path) {
  if (cache.has(path)) return cache.get(path);
  if (path.endsWith('.json')) { const data = JSON.parse(readFileSync(path, 'utf8')); cache.set(path, data); return data; }
  const loaded = { exports: {} }; cache.set(path, loaded.exports);
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const localRequire = name => {
    assert.ok(name.startsWith('.'), `Metadata unexpectedly imports runtime package ${name}`);
    const target = resolve(dirname(path), name); return load(target.endsWith('.json') ? target : `${target}.ts`);
  };
  new Function('require', 'module', 'exports', code)(localRequire, loaded, loaded.exports);
  cache.set(path, loaded.exports); return loaded.exports;
}
const directory = dirname(fileURLToPath(import.meta.url));
const { effectStageKey, resolveEffectStage } = load(resolve(directory, 'effectStageKey.ts'));
const { getGroupEffect, getGroupEffectVariants, getHiddenGroupEffectVariants } = load(resolve(directory, 'groupEffects.config.ts'));
const categories = load(resolve(directory, '../category-icons.json'));

test('every default, visible variant and hidden variant round-trips through the embedded stage', () => {
  let checked = 0;
  for (const categoryId of Object.keys(categories).map(Number)) {
    const variants = [getGroupEffect({ categoryId, title: null }), ...(getGroupEffectVariants(categoryId) ?? []).map(v => v.effect)];
    for (const effect of variants.filter(Boolean)) {
      const key = effectStageKey(effect); assert.ok(key, `Missing stage key for ${categoryId}`);
      assert.equal(resolveEffectStage(key), effect, key); checked++;
    }
  }
  for (const { variant } of getHiddenGroupEffectVariants()) assert.equal(resolveEffectStage(effectStageKey(variant.effect)), variant.effect);
  assert.ok(checked >= Object.keys(categories).length, `Only ${checked} variants checked`);
});
test('unrecognised or malformed embedded routes never silently render another variant', () => {
  for (const key of ['', '1767', '1767:', '1767:no-such-variant', '0:default', '1767:default:extra', '../1767:default']) assert.equal(resolveEffectStage(key), null, key);
});
test('retained family and unified lifelong-learning effects share the same scene in both sizes', () => {
  for (const [categoryId, variantId, sceneId] of [[1775, 'legacy-1775', 'polaroids'], [1786, 'late-stories', 'late-stories']]) {
    assert.equal(getGroupEffect({ categoryId, title: null }).sceneId, sceneId);
    const effect = getGroupEffectVariants(categoryId).find(v => v.id === variantId)?.effect;
    assert.ok(effect); assert.equal(effect.sceneId, sceneId);
    if (effect.bodyEffect) assert.equal(effect.bodyEffect.scene, sceneId);
  }
});
