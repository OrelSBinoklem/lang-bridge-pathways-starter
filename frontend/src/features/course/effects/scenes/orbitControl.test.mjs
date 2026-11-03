import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const compile = async file => ts.transpileModule(await readFile(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const dataUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const kit = dataUrl(await compile('./kit.ts'));
const { createOrbit } = await import(dataUrl((await compile('./orbitControl.ts')).replace("'./kit'", JSON.stringify(kit))));
function setup(cameraControls = true) {
  const original = globalThis.window;
  const listeners = new Map();
  globalThis.window = { addEventListener: (name, handler) => listeners.set(name, handler), removeEventListener: name => listeners.delete(name) };
  let visible = true;
  const params = { camOn: 1, camYaw: 0, camPitch: 0, camZoom: 1 };
  const orbit = createOrbit({ params, width: 400, height: 200, body: false, cameraControls, isVisible: () => visible });
  return { orbit, params, listeners, visible: value => { visible = value; }, cleanup: () => { orbit.dispose(); globalThis.window = original; } };
}
test('paused scene cannot steal wheel using stale hovered state', () => {
  const s = setup(); let prevented = 0;
  const wheel = () => s.listeners.get('wheel')?.({ deltaY: -100, preventDefault: () => { prevented++; } });
  try {
    s.orbit.update({ active: true, rawX: 100, rawY: 100, clicked: false, pressed: false });
    wheel(); assert.equal(prevented, 1); const zoom = s.params.camZoom;
    s.visible(false); wheel(); assert.equal(prevented, 1); assert.equal(s.params.camZoom, zoom);
    s.visible(true); wheel(); assert.equal(prevented, 2); assert.ok(s.params.camZoom > zoom);
  } finally { s.cleanup(); }
  assert.equal(s.listeners.size, 0);
});
test('course card camera chrome does not swallow interactions or register wheel/key handlers', () => {
  const s = setup(false);
  try {
    assert.equal(s.listeners.size, 0); assert.equal(s.orbit.on, false);
    const pointer = { active: true, rawX: 100, rawY: 100, clicked: true, pressed: true };
    assert.equal(s.orbit.update(pointer), pointer);
    s.orbit.draw(new Proxy({}, { get: () => { throw new Error('hidden chrome drew'); } }));
  } finally { s.cleanup(); }
});
