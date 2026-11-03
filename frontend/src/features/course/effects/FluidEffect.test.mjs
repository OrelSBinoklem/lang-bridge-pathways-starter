import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';

// Run the real component lifecycle and shaders' draw scheduling, replacing only the GPU/DOM.
function mountFluid(width = 1920, height = 1010) {
  const globals = Object.fromEntries(['window', 'document', 'getComputedStyle', 'MutationObserver', 'requestAnimationFrame', 'cancelAnimationFrame'].map(key => [key, globalThis[key]]));
  let resize, frame, cleanup, target;
  const effects = [], draws = [], sizes = [];
  const bounds = { width, height };
  const canvas = {};
  const listeners = new Map();
  class Renderer {
    capabilities = { isWebGL2: true };
    setClearColor() {} setPixelRatio() {} clear() {} dispose() {}
    setSize(w, h) { sizes.push([w, h]); }
    setRenderTarget(value) { target = value; }
    render(scene) {
      const material = scene.children[0].material;
      if (material.fragmentShader.includes('vec3 splat =')) {
        draws.push({ target, point: material.uniforms.point.value.clone(), color: material.uniforms.color.value.clone() });
      }
    }
  }
  globalThis.window = { innerWidth: width, matchMedia: () => ({ matches: false }), addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) };
  globalThis.document = { body: {}, documentElement: {} };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '#101010' });
  globalThis.MutationObserver = class { observe() {} disconnect() {} };
  globalThis.requestAnimationFrame = fn => { frame = fn; return 1; };
  globalThis.cancelAnimationFrame = () => {};
  const imports = {
    react: { useEffect: fn => effects.push(fn), useMemo: fn => fn(), useReducer: () => [0, () => {}], useRef: () => ({ current: canvas }) },
    'react/jsx-runtime': { jsx: () => null, jsxs: () => null },
    'react-dom': { createPortal: () => null },
    three: { ...THREE, WebGLRenderer: Renderer },
    './effectDiagnostics': { profileEffectFrame: (_canvas, fn) => fn },
    './tuning/EffectTuningPanel': {},
    './EffectHost': {
      useEffectHost: () => ({}), effectBounds: () => bounds,
      effectPoint: (_host, e) => ({ x: e.clientX, y: e.clientY, inside: true }),
      observeEffectSize: (_host, fn) => { resize = fn; fn(); return () => {}; },
    },
  };
  const loaded = { exports: {} };
  const source = readFileSync(new URL('./FluidEffect.tsx', import.meta.url), 'utf8');
  try {
    new Function('require', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText)(name => {
      assert.ok(name in imports, `Unexpected import ${name}`);
      return imports[name];
    }, loaded.exports);
    loaded.exports.FluidEffect({ accent: '#abcdef' });
    cleanup = effects[0]();
    return {
      draws, sizes, listeners,
      resize(w = bounds.width, h = bounds.height) { Object.assign(bounds, { width: w, height: h }); resize(); },
      frame(time = 16) { frame(time); },
      close() { cleanup(); Object.assign(globalThis, globals); },
    };
  } catch (error) { cleanup?.(); Object.assign(globalThis, globals); throw error; }
}

test('initial ResizeObserver notification cannot erase five random startup bursts', () => {
  const fluid = mountFluid();
  try {
    fluid.resize();
    fluid.frame();
    assert.equal(fluid.draws.length, 10, 'five velocity and five dye injections');
    assert.equal(fluid.sizes.length, 1, 'identical size does not recreate buffers');
    const dye = fluid.draws.filter((_, i) => i % 2 === 1);
    assert.equal(new Set(dye.map(draw => `${draw.point.x},${draw.point.y}`)).size, 5);
    assert.ok(dye.every(draw => draw.point.x >= 0.14 && draw.point.x <= 0.86 && draw.point.y >= 0.18 && draw.point.y <= 0.82 && draw.color.length() > 1));
    fluid.resize(); fluid.frame(32);
    assert.equal(fluid.draws.length, 10, 'no repeated idle splashes');
    assert.equal(fluid.sizes.length, 1);
  } finally { fluid.close(); }
});

test('startup uses latest buffers after a real resize, including expanded portrait', () => {
  const fluid = mountFluid();
  try {
    fluid.resize(1920, 1080);
    fluid.frame();
    assert.equal(fluid.draws.length, 10);
    const oldTarget = fluid.draws[0].target;
    fluid.resize(390, 844);
    fluid.resize(390, 844);
    fluid.frame(32);
    assert.equal(fluid.draws.length, 20);
    assert.notEqual(fluid.draws[10].target, oldTarget);
    assert.deepEqual(fluid.sizes, [[1920, 1010], [1920, 1080], [390, 844]]);
    fluid.frame(48);
    assert.equal(fluid.draws.length, 20);
  } finally { fluid.close(); }
});

test('held pointer still injects dye after startup and unchanged-size notifications', () => {
  const fluid = mountFluid();
  try {
    fluid.frame();
    fluid.listeners.get('pointerdown')({ clientX: 800, clientY: 400 });
    fluid.listeners.get('pointermove')({ clientX: 900, clientY: 500 });
    fluid.resize(); fluid.frame(32);
    assert.equal(fluid.draws.length, 12);
    assert.equal(fluid.sizes.length, 1);
    fluid.listeners.get('pointerup')();
    fluid.frame(48);
    assert.equal(fluid.draws.length, 12);
  } finally { fluid.close(); }
  assert.equal(fluid.listeners.size, 0);
});
