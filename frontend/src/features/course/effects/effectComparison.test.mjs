import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
let admin = false;
const context = React.createContext(false);
const calls = [];
const Renderer = view => props => {
  calls.push({ view, effect: props.effect, tuning: props.tuning, debug: React.useContext(context) });
  return React.createElement('div', { 'data-view': view });
};
const loaded = { exports: {} };
new Function('require', 'exports', compile(readFileSync(new URL('./ThemedGroupOverlay.tsx', import.meta.url), 'utf8')))(name => {
  if (name === 'react') return { ...React, useSyncExternalStore: (_, get) => get() };
  if (name === './scenes/orbitControl') return { isCameraAdmin: () => admin };
  if (name === './EffectDebugContext') return { EffectDebugContext: context };
  if (name === './tuning/types') return { createTuningState: () => ({ kind: 'fixture', params: {} }) };
  if (name === './CardEffect') return { CardEffect: Renderer('card') };
  if (name === './FullscreenEffect') return { FullscreenEffect: Renderer('fullscreen') };
  if (name === './CourseEffectDebug') return { CourseEffectDebug: () => null };
  if (name === './tuning/EffectTuningPanel') return { EffectTuningPanel: () => null };
  return require(name);
}, loaded.exports);

test('comparison renders the same effect and settings in both formats only for admins', () => {
  for (admin of [false, true]) for (const comparison of [false, true]) for (const focused of [false, true]) for (const forceCard of [false, true]) {
    calls.length = 0;
    const effect = { kind: 'scene' };
    renderToStaticMarkup(React.createElement(loaded.exports.ThemedGroupOverlay, { effect, comparison, focused, forceCard, getHost: () => null, pointerRef: { current: {} } }));
    const dual = admin && comparison && !focused;
    assert.equal(calls.length, dual ? 2 : 1);
    assert.equal(calls[0].view, forceCard ? 'card' : 'fullscreen');
    if (dual) {
      assert.deepEqual(calls.map(c => c.view).sort(), ['card', 'fullscreen']);
      assert.equal(calls[0].tuning, calls[1].tuning);
      assert.equal(calls.filter(c => c.debug).length, 1, 'Only one renderer may own settings');
      assert.equal(calls.find(c => c.debug).view, 'fullscreen');
    }
    assert(calls.every(c => c.effect === effect));
  }
});

test('preference defaults off, persists, synchronizes and ignores non-admin changes', () => {
  const previous = globalThis.window;
  const storage = new Map(), events = new Map();
  let snapshot, serverSnapshot, subscribe, adminListener, stopped = false, notifications = 0;
  globalThis.window = {
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    addEventListener: (name, listener) => events.set(name, listener),
    removeEventListener: name => events.delete(name),
  };
  try {
    const hook = { exports: {} };
    new Function('require', 'exports', compile(readFileSync(new URL('./useEffectComparison.ts', import.meta.url), 'utf8')))(name => name === 'react'
      ? { useCallback: fn => fn, useSyncExternalStore: (sub, get, server) => { subscribe = sub; snapshot = get; serverSnapshot = server; return get(); } }
      : { isCameraAdmin: () => admin, onCameraAdminChange: fn => { adminListener = fn; return () => { stopped = true; }; } }, hook.exports);
    admin = true;
    const [enabled, update] = hook.exports.useEffectComparison();
    assert.equal(enabled, false); assert.equal(serverSnapshot(), false);
    const stop = subscribe(() => notifications++);
    update(true); assert.equal(snapshot(), true); assert.equal(notifications, 1);
    events.get('storage')({ key: 'unrelated' }); assert.equal(notifications, 1);
    events.get('storage')({ key: 'lbp_course_effect_comparison' }); assert.equal(notifications, 2);
    admin = false; adminListener(); assert.equal(snapshot(), false);
    update(false); admin = true; assert.equal(snapshot(), true, 'Non-admin must not alter saved setting');
    update(false); assert.equal(snapshot(), false);
    stop(); assert(stopped); assert.equal(events.size, 0);
  } finally { globalThis.window = previous; }
});

test('card-only introduction never mounts a background, including admin comparison', () => {
  for (admin of [false, true]) for (const comparison of [false, true]) for (const focused of [false, true]) for (const forceCard of [false, true]) {
    calls.length = 0;
    renderToStaticMarkup(React.createElement(loaded.exports.ThemedGroupOverlay, {
      effect: { kind: 'compass', cardOnly: true }, comparison, focused, forceCard,
      getHost: () => null, pointerRef: { current: {} },
    }));
    assert.deepEqual(calls.map(call => call.view), ['card']);
  }
});

test('burger switch is admin-only and turns ordinary effects on when enabled', () => {
  const shell = readFileSync(new URL('../../../components/app-shell.tsx', import.meta.url), 'utf8');
  assert.match(shell, /const adminAppearance = useAdminAppearance\(user\?\.is_admin\)/);
  assert.match(shell, /adminAppearance && \([\s\S]*?role="switch" aria-checked=\{effectComparison\}/);
  assert.match(shell, /if \(next\) setEffectsEnabled\(true\)/);
  assert.match(shell, /Эффект: карточка \+ фон/);
});
