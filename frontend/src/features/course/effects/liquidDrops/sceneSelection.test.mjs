import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url), cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const result = { exports: {} }; cache.set(file, result.exports);
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  new Function('require', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText)(name => {
    if (name === 'next-intl') return { useLocale: () => 'ru' };
    if (name === 'react-dom') return { createPortal: content => content };
    if (name.endsWith('.css')) return { default: {} };
    if (name.startsWith('./')) return load(name + '.ts');
    return require(name);
  }, result.exports);
  return result.exports;
}
const { createLiquidDropsParams, LIQUID_DROPS_SCENE_LABELS } = load('./params.ts');
const { createActivatedDropsParams, selectDropsScene, subscribeDropsScene, notifyDropsScene, setDropsImage } = load('./sceneSelection.ts');

test('activation can pick each bundled scene, never an empty custom image or changed glass settings', () => {
  const scenes = Object.keys(LIQUID_DROPS_SCENE_LABELS).filter(scene => scene !== 'custom');
  const defaults = createLiquidDropsParams();
  for (let index = 0; index < scenes.length; index++) {
    let calls = 0;
    const params = createActivatedDropsParams(() => { calls++; return (index + .5) / scenes.length; });
    assert.equal(calls, 1);
    assert.equal(params.scene, scenes[index]);
    assert.deepEqual({ ...params, scene: defaults.scene }, defaults);
  }
  assert.equal(createActivatedDropsParams(() => 0).scene, scenes[0]);
  assert.equal(createActivatedDropsParams(() => 1).scene, scenes.at(-1));
});

test('each activation owns its params while card/fullscreen changes keep the live shared selection', () => {
  const source = readFileSync(new URL('../tuning/types.ts', import.meta.url), 'utf8');
  const result = { exports: {} };
  new Function('require', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(name => {
    if (name === '../liquidDrops/sceneSelection') return { createActivatedDropsParams };
    return {};
  }, result.exports);
  const random = Math.random;
  try {
    Math.random = () => 0;
    const first = result.exports.createTuningState({ kind: 'pulse-rings', bodyEffect: 'liquid-drops' });
    Math.random = () => .99;
    const next = result.exports.createTuningState({ kind: 'pulse-rings', bodyEffect: 'liquid-drops' });
    assert.equal(first.kind, 'liquid-drops');
    assert.notEqual(first.params.scene, next.params.scene);
    selectDropsScene(first.params, 'grotto');
    assert.equal(first.params.scene, 'grotto');
    assert.notEqual(next.params.scene, 'grotto');
    assert.notEqual(first.params, next.params);
  } finally { Math.random = random; }
  const body = readFileSync(new URL('../BodyEffectContent.tsx', import.meta.url), 'utf8');
  const renderer = readFileSync(new URL('../LiquidDropsEffect.tsx', import.meta.url), 'utf8');
  assert.match(body, /<Drops params=\{tuning\?\.kind === 'liquid-drops' \? tuning.params : undefined\}/);
  assert.match(renderer, /params: params \?\? createLiquidDropsParams\(initialParams\)/);
});

test('public selection changes the same live params without resetting drop settings', () => {
  const p = createLiquidDropsParams(), before = {...p}; let notifications = 0;
  const stop = subscribeDropsScene(p, () => notifications++);
  for (const scene of Object.keys(LIQUID_DROPS_SCENE_LABELS)) assert.equal(selectDropsScene(p, scene), true);
  assert.equal(notifications, Object.keys(LIQUID_DROPS_SCENE_LABELS).length);
  assert.deepEqual({...p, scene:before.scene}, before);
  assert.equal(selectDropsScene(p, '__proto__'), false);
  stop(); notifyDropsScene(p); assert.equal(notifications, Object.keys(LIQUID_DROPS_SCENE_LABELS).length);
});

test('debug-panel notifications reach the public control and do not leak across instances', () => {
  const first = createLiquidDropsParams(), other = createLiquidDropsParams(); let changes = 0;
  const stop = subscribeDropsScene(first, () => changes++);
  selectDropsScene(other, 'grotto'); assert.equal(changes, 0);
  first.scene = 'photo-monstera'; notifyDropsScene(first); assert.equal(changes, 1);
  stop();
});

test('custom images are local and replacing one releases the old object URL', () => {
  const p = createLiquidDropsParams(); const previous = URL.revokeObjectURL, revoked = [];
  try {
    URL.revokeObjectURL = url => revoked.push(url);
    setDropsImage(p, 'blob:first'); assert.equal(p.scene, 'custom'); assert.equal(p.customImage, 'blob:first');
    setDropsImage(p, 'blob:second'); assert.deepEqual(revoked, ['blob:first']);
    selectDropsScene(p, 'sauna'); assert.equal(p.customImage, 'blob:second');
  } finally { URL.revokeObjectURL = previous; }
});

test('the public picker exposes every scene independently of administrator settings', () => {
  const original = globalThis.document;
  try {
    globalThis.document = {body:{}, fullscreenElement:null};
    const source = readFileSync(new URL('./LiquidDropsScenePicker.tsx', import.meta.url), 'utf8');
    const result = {exports:{}};
    new Function('require','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText)(name => {
      if (name === 'next-intl') return {useLocale:()=> 'ru'};
      if (name === 'react-dom') return {createPortal:content=>content};
      if (name.endsWith('.css')) return {default:{}};
      if (name.startsWith('./')) return load(name + '.ts');
      return require(name);
    },result.exports);
    const html = renderToStaticMarkup(React.createElement(result.exports.LiquidDropsScenePicker,{params:createLiquidDropsParams()}));
    assert.equal((html.match(/<option /g)??[]).length, 11);
    assert.match(html,/data-effect-toolbar/); assert.match(html,/Своя картинка…/);
    assert.match(html, /value="sauna" selected/); assert.doesNotMatch(html,/aria-hidden|disabled/);
  } finally { if (original === undefined) delete globalThis.document; else globalThis.document = original; }
});

test('neither fullscreen nor card mounts the separate scene picker; settings keep scene selection', () => {
  const effect = readFileSync(new URL('../LiquidDropsEffect.tsx',import.meta.url),'utf8');
  const frame = readFileSync(new URL('../EffectBodyFrame.tsx',import.meta.url),'utf8');
  const body = readFileSync(new URL('../BodyEffectContent.tsx',import.meta.url),'utf8');
  const settings = readFileSync(new URL('../tuning/EffectTuningPanel.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(effect,/LiquidDropsScenePicker|showScenePicker/);
  assert.doesNotMatch(frame + body,/showScenePicker|LiquidDropsScenePicker/);
  assert.match(effect, /<EffectTuningPanel tuning=\{tuning\}/);
  assert.match(settings, /background\.add\(p, 'scene', scenes\)\.name\('Сцена'\)/);
});
