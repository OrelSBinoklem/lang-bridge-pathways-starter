import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('./mandalaDraw.ts', import.meta.url), 'utf8');
const loaded = { exports: {} };
new Function('require', 'exports', ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(() => ({ clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)) }), loaded.exports);

function fixture(width = 1100, height = 190, body = false) {
  const contexts = [];
  function context() {
    const calls = [];
    const g = new Proxy({ calls }, {
      get(target, key) {
        if (key in target) return target[key];
        if (key === 'measureText') return (s) => ({ width: s.length * 7 });
        if (key === 'createLinearGradient') return () => ({ addColorStop() {} });
        return (...args) => calls.push({ method: key, args, color: target.strokeStyle, width: target.lineWidth, fill: target.fillStyle });
      },
    });
    contexts.push(g);
    return g;
  }
  globalThis.document = { createElement: () => ({ getContext: () => context() }) };
  globalThis.Path2D = class {
    constructor() { return new Proxy({}, { get: () => () => {} }); }
  };
  let randomCalls = 0;
  let seed = 123456;
  const scene = loaded.exports.MANDALA_DRAW.create({
    width, height, dpr: 1, body, rand: () => { randomCalls++; seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; },
  });
  const g = context();
  const pointer = { active: false, clicked: false, pressed: false, rawX: 0, rawY: 0 };
  const update = (p) => scene.update(0, 0, { ...pointer, ...p });
  const click = (x, y) => { update({ active: true, clicked: true, pressed: true, rawX: x, rawY: y }); update({ rawX: x, rawY: y }); };
  const draw = () => { g.calls.length = 0; scene.draw(g); return g.calls; };
  return { scene, contexts, g, draw, click, update, randomCalls: () => randomCalls };
}

test('small card has only bottom colour dropdown and new-pattern control; no top toolbar', () => {
  for (const width of [320, 390, 1100]) {
    const f = fixture(width);
    const calls = f.draw();
    const boxes = calls.filter(c => c.method === 'roundRect');
    assert.equal(boxes.length, 2);
    for (const box of boxes) {
      const [x, y, w, h] = box.args;
      assert(x >= 0 && x + w <= width);
      assert(y >= 140 && y + h <= 190);
    }
    assert.deepEqual(calls.filter(c => c.method === 'fillText').map(c => c.args[0]), ['▾', '✦']);
  }
});

test('dropdown opens ten colours, selection closes it and draws with the small line pencil', () => {
  const f = fixture();
  f.click(1020, 164);
  assert.equal(f.draw().filter(c => c.method === 'roundRect').length, 13);
  // Second row, first colour: violet.
  f.click(948, 118);
  assert.equal(f.draw().filter(c => c.method === 'roundRect').length, 2);
  f.update({ active: true, clicked: true, pressed: true, rawX: 550, rawY: 105 });
  for (const g of f.contexts) g.calls.length = 0;
  f.update({ active: true, pressed: true, rawX: 559, rawY: 109 });
  const lines = f.contexts.flatMap(g => g.calls).filter(c => c.method === 'stroke');
  assert(lines.length > 0);
  assert(lines.every(c => c.color === '#8a4fd6' && c.width === .012));
});

test('outside click dismisses colours without drawing; new pattern still generates', () => {
  const f = fixture();
  f.click(1020, 164);
  for (const g of f.contexts) g.calls.length = 0;
  f.click(550, 105);
  assert.equal(f.contexts.flatMap(g => g.calls).filter(c => c.method === 'stroke').length, 0);
  assert.equal(f.draw().filter(c => c.method === 'roundRect').length, 2);
  const before = f.randomCalls();
  f.click(1075, 164);
  assert(f.randomCalls() > before);
});

test('body and expanded card retain the full original toolbar and middle pencil size', () => {
  for (const body of [false, true]) {
    const f = fixture(1100, 650, body);
    assert.equal(f.draw().filter(c => c.method === 'roundRect').length, 23);
    f.update({ active: true, clicked: true, pressed: true, rawX: 550, rawY: 330 });
    for (const g of f.contexts) g.calls.length = 0;
    f.update({ active: true, pressed: true, rawX: 560, rawY: 335 });
    const lines = f.contexts.flatMap(g => g.calls).filter(c => c.method === 'stroke');
    assert(lines.length > 0);
    assert(lines.every(c => c.width === .024));
  }
});
