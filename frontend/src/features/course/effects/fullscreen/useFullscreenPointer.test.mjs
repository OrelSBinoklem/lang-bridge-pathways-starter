import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const state = { exports: {} };
const aim = { exports: {} };
new Function('exports', compile('../touchAim.ts'))(aim.exports);
new Function('require', 'exports', compile('../pointerState.ts'))(name => {
  assert.equal(name, './touchAim'); return aim.exports;
}, state.exports);

test('side pointers use local coordinates, ignore centre controls and release listeners', () => {
  const previous = { window: globalThis.window, document: globalThis.document, Element: globalThis.Element };
  const listeners = new Map(), rootListeners = new Map();
  globalThis.window = { innerWidth: 1920, innerHeight: 900, addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) };
  globalThis.document = { documentElement: { addEventListener: (key, fn) => rootListeners.set(key, fn), removeEventListener: key => rootListeners.delete(key) } };
  globalThis.Element = class { closest() { return true; } };
  let cleanup;
  try {
    const loaded = { exports: {} };
    new Function('require', 'exports', compile('./useFullscreenPointer.ts'))(name => name === 'react'
      ? { useRef: current => ({ current }), useEffect: setup => { cleanup = setup(); } }
      : name === '../pointerState' ? state.exports : { PAGE_CONTROLS: 'button' }, loaded.exports);
    const pointer = loaded.exports.useFullscreenPointer(() => ({ left: 1600, top: 0, width: 320, height: 900 }));
    const event = (type, x, buttons = 0, target = {}) => listeners.get(type)({ type, clientX: x, clientY: 450, buttons, pointerType: 'mouse', target });
    event('pointermove', 1760);
    assert.equal(pointer.current.x, 0); assert(pointer.current.y === 0); assert.equal(pointer.current.active, true);
    event('pointerdown', 900, 1, new globalThis.Element());
    event('pointermove', 1760, 1);
    assert.equal(pointer.current.pressed, false); assert.equal(pointer.current.press, undefined);
    event('pointerup', 900);
    event('pointerdown', 1700, 1);
    assert.equal(pointer.current.pressed, true); assert.equal(pointer.current.press.x, -60);
    event('pointermove', 900, 1);
    assert.equal(pointer.current.active, false); assert.equal(pointer.current.pressed, false);
    cleanup();
    assert.equal(listeners.size, 0); assert.equal(rootListeners.size, 0);
  } finally { Object.assign(globalThis, previous); }
});
