import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
async function load(path) {
  let code = ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  if (code.includes("'./touchAim'")) {
    const aim = ts.transpileModule(await readFile(new URL('./touchAim.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    code = code.replace("'./touchAim'", JSON.stringify('data:text/javascript;base64,' + Buffer.from(aim).toString('base64')));
  }
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}
const { pointerStateFromEvent } = await load('./pointerState.ts');
const { createPointerTracker } = await load('./scenes/pointer.ts');
const rect = { left: 20, top: 30, width: 400, height: 200 };
function setup(pointerType = 'mouse') {
  const source = { current: { x: 0, y: 0, active: false, moved: false } };
  const tracker = createPointerTracker(400, 200, source);
  const event = (type, buttons = 0, clientX = 120, clientY = 80) => { source.current = pointerStateFromEvent({ type, buttons, clientX, clientY, pointerType }, rect, source.current); };
  return { source, tracker, event };
}
for (const pointerType of ['mouse', 'touch', 'pen']) test(`${pointerType}: down and up between frames deliver one click at the press position`, () => {
  const { tracker, event } = setup(pointerType);
  event('pointerdown', 1); event('pointerup', 0, 160, 95);
  const p = tracker.update(1 / 60);
  assert.equal(p.clicked, true); assert.equal(p.pressed, false); assert.equal(p.active, true);
  assert.equal(p.rawX, 100); assert.equal(p.rawY, 50);
  assert.equal(tracker.update(1 / 60).clicked, false);
});
test('holding and moving a press does not repeat clicks', () => {
  const { tracker, event } = setup(); event('pointerdown', 1);
  assert.equal(tracker.update(1 / 60).clicked, true);
  event('pointermove', 1); assert.equal(tracker.update(1 / 60).clicked, false);
  event('pointerup'); assert.equal(tracker.update(1 / 60).clicked, false);
  event('pointerdown', 1); event('pointerup'); assert.equal(tracker.update(1 / 60).clicked, true);
});
test('right mouse button does not enqueue a scene click', () => {
  const { tracker, event } = setup(); event('pointerdown', 2); event('pointerup');
  assert.equal(tracker.update(1 / 60).clicked, false);
});
test('several clicks before a slow frame are delivered separately at their original positions', () => {
  const { tracker, event } = setup();
  for (let i = 0; i < 4; i++) { event('pointerdown', 1, 60 + i * 30, 80); event('pointerup'); }
  for (let i = 0; i < 4; i++) {
    const p = tracker.update(1 / 60); assert.equal(p.clicked, true); assert.equal(p.rawX, 40 + i * 30);
  }
  assert.equal(tracker.update(1 / 60).clicked, false);
});

test('touch click history retains the elevated aim, but canvas controls use the physical finger', () => {
  const previous = globalThis.window;
  globalThis.window = { innerHeight: 900 };
  try {
    const { source, tracker, event } = setup('touch');
    event('pointerdown', 1, 120, 130); event('pointerup', 0, 160, 150);
    assert.equal(tracker.update(1 / 60).rawY, 48);
    const control = createPointerTracker(400, 200, source, (_x, y) => y === 100);
    event('pointerdown', 1, 120, 130);
    const hit = control.update(1 / 60);
    assert.equal(hit.clicked, true);
    assert.equal(hit.rawY, 100, 'button under finger is not shifted');
    assert.equal(hit.rawX, 100);
  } finally { globalThis.window = previous; }
});
