import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const directory = dirname(fileURLToPath(import.meta.url));
const require = createRequire(pathToFileURL(resolve(directory, '../../../../package.json')));
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  if (file.endsWith('.json')) return JSON.parse(readFileSync(file, 'utf8'));
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'module', 'exports', code)(name => name.startsWith('.') ? load(resolve(dirname(file), name) + (name.endsWith('.json') ? '' : '.ts')) : require(name), loaded, loaded.exports);
  cache.set(file, loaded.exports); return loaded.exports;
}
const { getEffectPoster } = load(resolve(directory, 'effectPosters.ts'));
const { getGroupEffect, getGroupEffectVariants, getHiddenGroupEffectVariants } = load(resolve(directory, 'groupEffects.config.ts'));
const manifest = load(resolve(directory, 'effect-posters.json'));

test('technology default and stale choices use the LCD poster in both sizes', () => {
  for (const variantId of [null, 'lcd-screen', 'led-matrix', 'digital-rain', 'nixie-clock', 'nixie-clock-full']) {
    const effect = getGroupEffect({ categoryId: 1792, title: null, variantId });
    for (const body of [false, true]) {
      const image = getEffectPoster(effect, body);
      assert.equal(image, `/course/effects/previews/1792-lcd-screen-${body ? 'full' : 'card'}.webp`);
      assert.ok(existsSync(resolve(directory, '../../../../public', image.slice(1))));
    }
  }
});

test('every default, visible and archived course variant has an existing static image in both sizes', () => {
  const categories = load(resolve(directory, '../category-icons.json'));
  const effects = [getGroupEffect({ categoryId: null, title: 'Введение' })];
  for (const categoryId of Object.keys(categories).map(Number)) effects.push(getGroupEffect({ categoryId, title: null }), ...(getGroupEffectVariants(categoryId) ?? []).map(v => v.effect));
  effects.push(...getHiddenGroupEffectVariants().map(v => v.variant.effect));
  let checked = 0;
  for (const effect of effects.filter(Boolean)) for (const body of [false, true]) {
    const image = getEffectPoster(effect, body);
    assert.match(image, /^\/course\/.*\.(webp|png|jpg|svg)$/);
    assert.ok(existsSync(resolve(directory, '../../../../public', image.slice(1))), image);
    if (effect.sceneId) assert.ok(manifest.scenes[effect.sceneId], `Scene needs its own poster: ${effect.sceneId}`);
    checked++;
  }
  assert.equal(checked, effects.filter(Boolean).length * 2);
  assert.ok(checked > Object.keys(categories).length * 2);
});

test('every experimental poster is a real saved asset, not an on-demand capture', () => {
  assert.ok(Object.keys(manifest.scenes).length > 100);
  for (const [sceneId, source] of Object.entries(manifest.scenes)) {
    assert.ok(existsSync(resolve(directory, '../../../../public', source.slice(1))), sceneId);
    assert.equal(getEffectPoster({ kind: 'scene', sceneId, background: '#000', glow: '#fff' }), source);
  }
});

test('idle posters do not mount their renderer; explicit launch mounts it and stop unmounts it', () => {
  const { EffectPreviewPoster } = load(resolve(directory, 'EffectPreviewPoster.tsx'));
  let mounted = 0;
  const Effect = () => { mounted++; return React.createElement('canvas'); };
  const render = running => renderToStaticMarkup(React.createElement(EffectPreviewPoster, { running, title: 'Test', stillSrc: '/course/effects/previews/domino-workshop.webp' }, React.createElement(Effect)));
  const idle = render(false);
  assert.equal(mounted, 0); assert.match(idle, /<img /); assert.match(idle, /loading="lazy"/); assert.doesNotMatch(idle, /<canvas/);
  assert.match(render(true), /<canvas/); assert.equal(mounted, 1);
  assert.match(render(false), /<img /); assert.equal(mounted, 1);
});

test('gallery never restores all-effects mode or generates previews while scrolling', () => {
  const page = readFileSync(resolve(directory, '../../../app/course/effects-preview/page.tsx'), 'utf8');
  const poster = readFileSync(resolve(directory, 'EffectPreviewPoster.tsx'), 'utf8');
  assert.doesNotMatch(page, /localStorage|setMode|chooseMode|Все сразу/);
  assert.match(page, /running = false/);
  assert.match(page, /running && <EffectSurface/);
  assert.doesNotMatch(poster, /IntersectionObserver|requestAnimationFrame|createPreviewQueue|createElement\('canvas'\)|toDataURL/);
});
