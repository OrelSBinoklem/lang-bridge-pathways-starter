import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const code = readFileSync(new URL('./EffectHost.tsx', import.meta.url), 'utf8');
const loaded = { exports: {} };
const aim = { exports: {} };
new Function('exports', ts.transpileModule(readFileSync(new URL('./touchAim.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(aim.exports);
new Function('require', 'exports', ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText)(name => name === './touchAim' ? aim.exports : require(name), loaded.exports);
const { effectBounds, effectPoint, observeEffectSize, effectHeaderInset, observeEffectHeaderInset, PageEffectHost } = loaded.exports;
const host = { getBoundingClientRect: () => ({ left: 120, top: 240, width: 300, height: 180 }) };

test('initial client render stays empty until mount so its portal cannot disagree with SSR', () => {
  const previous = globalThis.document;
  globalThis.document = { body: {} };
  try { assert.equal(renderToStaticMarkup(React.createElement(PageEffectHost, null, React.createElement('span', null, 'effect'))), ''); }
  finally { globalThis.document = previous; }
});

test('only the visible header reserves space; absent and scrolled-away headers do not leave a gap', () => {
  assert.equal(effectHeaderInset({ bottom: 100 }, 900), 100);
  assert.equal(effectHeaderInset({ bottom: 154 }, 844), 154);
  assert.equal(effectHeaderInset({ bottom: -40 }, 900), 0);
  assert.equal(effectHeaderInset({ bottom: 1000 }, 900), 900);
  assert.equal(effectHeaderInset(null, 900), 0);
});

test('header wrapping, scrolling and viewport changes update the inset and release every observer', () => {
  const previous = { window: globalThis.window, document: globalThis.document, ResizeObserver: globalThis.ResizeObserver, MutationObserver: globalThis.MutationObserver };
  let bottom = 100, notify, observed, disconnected = false, mutationDisconnected = false, notifyVisibility, hidden = false;
  const listeners = new Map(), updates = [];
  const header = { getBoundingClientRect: () => ({ bottom }) };
  globalThis.document = { documentElement: {}, querySelector(selector) { assert.equal(selector, '[data-app-header]'); return header; } };
  globalThis.window = { innerHeight: 900, getComputedStyle: () => ({ visibility: hidden ? 'hidden' : 'visible' }), addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  globalThis.ResizeObserver = class { constructor(fn) { notify = fn; } observe(target) { observed = target; } disconnect() { disconnected = true; } };
  globalThis.MutationObserver = class { constructor(fn) { notifyVisibility = fn; } observe() {} disconnect() { mutationDisconnected = true; } };
  try {
    const stop = observeEffectHeaderInset(top => updates.push(top));
    assert.equal(observed, header);
    bottom = 154; notify();
    bottom = 80; listeners.get('scroll')();
    bottom = 0; listeners.get('resize')();
    bottom = 100; hidden = true; notifyVisibility();
    hidden = false; notifyVisibility();
    assert.deepEqual(updates, [100, 154, 80, 0, 0, 100]);
    stop(); assert.equal(disconnected, true); assert.equal(mutationDisconnected, true); assert.equal(listeners.size, 0);
  } finally { Object.assign(globalThis, previous); }
});

test('card coordinates use the actual card bounds, not the document viewport', () => {
  assert.deepEqual(effectBounds(host), host.getBoundingClientRect());
  assert.deepEqual(effectPoint(host, { clientX: 270, clientY: 330 }), { x: 150, y: 90, inside: true });
  assert.equal(effectPoint(host, { clientX: 119, clientY: 330 }).inside, false);
  assert.equal(effectPoint(host, { clientX: 270, clientY: 421 }).inside, false);
});

test('fullscreen coordinates preserve the window viewport and clean up resize listeners', () => {
  const previous = globalThis.window;
  const calls = [];
  globalThis.window = { innerWidth: 1365, innerHeight: 900, addEventListener: (...args) => calls.push(['add', ...args]), removeEventListener: (...args) => calls.push(['remove', ...args]) };
  try {
    assert.deepEqual(effectPoint(null, { clientX: 200, clientY: 300 }), { x: 200, y: 300, inside: true });
    let updates = 0;
    const update = () => updates++;
    const stop = observeEffectSize(null, update);
    stop();
    assert.equal(updates, 1);
    assert.deepEqual(calls, [['add', 'resize', update], ['remove', 'resize', update]]);
  } finally { globalThis.window = previous; }
});

test('card resize follows its host and disconnects its observer', () => {
  const previous = globalThis.ResizeObserver;
  let observed, disconnected = false, updates = 0;
  globalThis.ResizeObserver = class { observe(target) { observed = target; } disconnect() { disconnected = true; } };
  try {
    const stop = observeEffectSize(host, () => updates++);
    assert.equal(observed, host); assert.equal(updates, 1);
    stop(); assert.equal(disconnected, true);
  } finally { globalThis.ResizeObserver = previous; }
});

test('course rendering never embeds a second application page and keeps independent view components', () => {
  const frame = readFileSync(new URL('./EffectBodyFrame.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(frame, /<iframe|src=|effects-preview\?|window\.parent/);
  assert.match(frame, /<ContainedEffectHost><BodyEffectContent/);
  const overlay = readFileSync(new URL('./ThemedGroupOverlay.tsx', import.meta.url), 'utf8');
  assert.match(overlay, /forceCard \? <CardEffect/);
  assert.match(overlay, /: <FullscreenEffect/);
  const page = readFileSync(new URL('../CoursePath.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /key=\{`[^\n]*forceCard/);
  assert.match(code, /contain: 'layout paint'/);
});

test('fullscreen exit controls are outside card stacking contexts and the card tint is hidden', () => {
  const control = readFileSync(new URL('./EffectVariantSwitch.tsx', import.meta.url), 'utf8');
  assert.match(control, /focused && typeof document !== 'undefined' \? createPortal\(toolbar, document.body\)/);
  const css = readFileSync(new URL('../../../app/globals.css', import.meta.url), 'utf8');
  assert.match(css, /html\.course-effect-focus body > \[data-effect-toolbar\]/);
  assert.match(css, /html\.course-effect-focus body > \[data-effect-page-viewport\]/);
  assert.match(css, /\[data-effect-focus='host'\]\[data-effect-body\] \{\s*background: transparent !important;/);
});
