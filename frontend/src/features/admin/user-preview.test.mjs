import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const storage = new Map();
const events = new EventTarget();
globalThis.window = Object.assign(events, { sessionStorage: {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
} });
let uk = false;
const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const result = {};
  modules.set(file, result);
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  new Function('require', 'exports', source)(name => {
    if (name === 'react') return { ...React, useEffect: () => {}, useState: () => [true, () => {}], useSyncExternalStore: (_, snapshot) => snapshot() };
    if (name === 'react-dom') return { createPortal: child => child };
    if (name === 'next-intl') return { useLocale: () => uk ? 'uk' : 'ru' };
    if (name.endsWith('.css')) return { __esModule: true, default: { toggle: 'toggle' } };
    if (name.startsWith('./')) return load(name + (name.endsWith('Toggle') ? '.tsx' : '.ts'));
    return require(name);
  }, result);
  return result;
}
const store = load('./user-preview-store.ts');
const hooks = load('./useUserPreview.ts');
const { UserPreviewToggle } = load('./UserPreviewToggle.tsx');
globalThis.document = { body: {} };

test('preview updates all subscribers, persists across module reload, and unsubscribes', () => {
  let changes = 0;
  const stop = store.subscribeUserPreview(() => changes++);
  store.setUserPreview(true);
  assert.equal(store.getUserPreview(), true);
  assert.equal(changes, 1);
  modules.delete('./user-preview-store.ts');
  assert.equal(load('./user-preview-store.ts').getUserPreview(), true);
  stop();
  store.setUserPreview(false);
  assert.equal(changes, 1);
});

test('presentation flag can hide admin UI but cannot promote a regular user', () => {
  for (const preview of [false, true]) {
    store.setUserPreview(preview);
    assert.equal(hooks.useAdminAppearance(false), false);
    assert.equal(hooks.useAdminAppearance(undefined), false);
    assert.equal(hooks.useAdminAppearance(true), !preview);
  }
});

test('real admin retains the return button in user view, guests and regular users never get it', () => {
  for (uk of [false, true]) for (const preview of [false, true]) {
    store.setUserPreview(preview);
    assert.equal(UserPreviewToggle({ isAdmin: false }), null);
    const button = UserPreviewToggle({ isAdmin: true });
    assert.equal(button.props['aria-pressed'], preview);
    const html = renderToStaticMarkup(button);
    assert.ok(html.includes(preview ? (uk ? 'Повернути адмін-вид' : 'Вернуть админ-вид') : (uk ? 'Вид користувача' : 'Вид пользователя')));
    assert.equal(html.replace(/<[^>]*>/g, ''), '', 'Button must contain only an icon, with the label in accessibility attributes');
    assert.ok(html.includes(preview ? 'pi-shield' : 'pi-user'));
    button.props.onClick();
    assert.equal(store.getUserPreview(), !preview);
  }
});

test('switch still works if browser storage is unavailable', () => {
  const original = window.sessionStorage;
  window.sessionStorage = { getItem() { throw Error('disabled'); }, setItem() { throw Error('disabled'); } };
  try {
    store.setUserPreview(true);
    assert.equal(store.getUserPreview(), true);
    store.setUserPreview(false);
    assert.equal(store.getUserPreview(), false);
  } finally { window.sessionStorage = original; }
});
