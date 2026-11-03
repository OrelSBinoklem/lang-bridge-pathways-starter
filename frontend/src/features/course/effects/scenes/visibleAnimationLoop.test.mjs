import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const code = ts.transpileModule(await readFile(new URL('./visibleAnimationLoop.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { createVisibleAnimationLoop } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
function setup({ hidden = false, top = 0 } = {}) {
  let observer, id = 0, disconnected = false;
  const pending = new Map(), listeners = new Map();
  const original = globalThis.IntersectionObserver;
  globalThis.IntersectionObserver = class {
    constructor(callback) { observer = callback; }
    observe() {}
    disconnect() { disconnected = true; }
  };
  const doc = {
    hidden,
    defaultView: { innerWidth: 800, innerHeight: 600, requestAnimationFrame: fn => { pending.set(++id, fn); return id; }, cancelAnimationFrame: key => pending.delete(key) },
    addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key),
  };
  const element = { ownerDocument: doc, dataset: {}, getBoundingClientRect: () => ({ width: 200, height: 150, top, bottom: top + 150, left: 0, right: 200 }) };
  return {
    element, pending, listeners,
    tick(time) { const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(fn => fn(time)); },
    intersect(visible) { observer([{ target: element, isIntersecting: visible, intersectionRatio: visible ? 1 : 0 }]); },
    hide(value) { doc.hidden = value; listeners.get('visibilitychange')?.(); },
    cleanup() { globalThis.IntersectionObserver = original; },
    disconnected: () => disconnected,
  };
}
test('offscreen pauses without rebuilding or advancing the simulation; return has no catch-up', () => {
  const s = setup(), deltas = []; let clock = 0;
  const stop = createVisibleAnimationLoop(s.element, dt => { deltas.push(dt); clock += dt; });
  try {
    s.tick(100); s.tick(120); const saved = clock;
    s.intersect(false); assert.equal(s.pending.size, 0); assert.equal(s.element.dataset.effectRunning, 'false');
    s.tick(900000); assert.equal(clock, saved);
    s.intersect(true); s.tick(900100);
    assert.equal(deltas.at(-1), 1 / 60); assert.equal(clock, saved + 1 / 60);
  } finally { stop(); s.cleanup(); }
});
test('hidden tab cancels RAF and visible resumes only if canvas also intersects', () => {
  const s = setup(); const stop = createVisibleAnimationLoop(s.element, () => {});
  try {
    s.hide(true); assert.equal(s.pending.size, 0);
    s.intersect(false); s.hide(false); assert.equal(s.pending.size, 0);
    s.intersect(true); assert.equal(s.pending.size, 1);
  } finally { stop(); s.cleanup(); }
});
test('initially offscreen or hidden canvases do not start drawing', () => {
  for (const options of [{ top: 900 }, { hidden: true }]) {
    const s = setup(options); const stop = createVisibleAnimationLoop(s.element, () => assert.fail('invisible frame'));
    try { assert.equal(s.pending.size, 0); } finally { stop(); s.cleanup(); }
  }
});
test('repeated observer/visibility notifications never multiply frame loops', () => {
  const s = setup(); const stop = createVisibleAnimationLoop(s.element, () => { s.intersect(true); });
  try {
    for (let i = 0; i < 10; i++) { s.intersect(true); s.hide(false); }
    assert.equal(s.pending.size, 1); s.tick(10); assert.equal(s.pending.size, 1);
  } finally { stop(); s.cleanup(); }
});
test('dispose removes observers, listeners and pending frames, including late callbacks', () => {
  const s = setup(); const stop = createVisibleAnimationLoop(s.element, () => assert.fail('disposed frame'));
  try {
    stop(); s.intersect(true); s.hide(false); s.tick(200);
    assert.equal(s.pending.size, 0); assert.equal(s.listeners.size, 0); assert.equal(s.disconnected(), true);
    assert.equal(s.element.dataset.effectRunning, undefined);
  } finally { s.cleanup(); }
});
test('active frame duration is bounded and nonnegative', () => {
  const s = setup(), deltas = []; const stop = createVisibleAnimationLoop(s.element, dt => deltas.push(dt));
  try { s.tick(100); s.tick(10000); s.tick(9999); assert.deepEqual(deltas, [1 / 60, .05, 0]); }
  finally { stop(); s.cleanup(); }
});

test('native video receives visibility transitions and pauses on disposal without polling', () => {
  const s = setup(), states = [];
  const stop = createVisibleAnimationLoop(s.element, () => {}, visible => states.push(visible));
  try { s.intersect(true); s.hide(true); s.hide(true); s.hide(false); s.intersect(false); s.intersect(true); stop();
    assert.deepEqual(states, [true, false, true, false, true, false]);
  } finally { s.cleanup(); }
});
test('without IntersectionObserver, animation still runs and document hiding pauses it', () => {
  const s = setup({ top: 900 }); globalThis.IntersectionObserver = undefined;
  const stop = createVisibleAnimationLoop(s.element, () => {});
  try { assert.equal(s.pending.size, 1); s.hide(true); assert.equal(s.pending.size, 0); s.hide(false); assert.equal(s.pending.size, 1); }
  finally { stop(); s.cleanup(); }
});
