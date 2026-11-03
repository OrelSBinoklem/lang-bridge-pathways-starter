import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const modules = new Map();
function url(name) {
  if (modules.has(name)) return modules.get(name);
  let code = ts.transpileModule(readFileSync(new URL(name + '.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const m of [...code.matchAll(/from ['"]([^'"]+)['"]/g)]) code = code.replace(m[0], `from ${JSON.stringify(url(m[1]))}`);
  const result = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64'); modules.set(name, result); return result;
}
const { createPinball, PINBALL_BUMPERS, PINBALL_TARGETS } = await import(url('./pinballPhysics'));
const { pinballLayout, createLedPinball } = await import(url('./ledPinball'));
const idle = { launch: false, left: false, right: false };
test('ball rests until launched; no automatic scripted restart', () => {
  const p = createPinball(), before = { ...p.ball }, idle = { launch: false, left: false, right: false };
  for (let i = 0; i < 600; i++) p.update(1 / 60, idle);
  assert.deepEqual(p.ball, before); assert.equal(p.shots, 0);
  p.update(1 / 60, { ...idle, launch: true }); assert.equal(p.shots, 1); assert.ok(p.ball.vy < -2);
  for (let i = 0; i < 3600; i++) p.update(1 / 60, idle);
  assert.equal(p.ball.active, false); const after = { ...p.ball };
  for (let i = 0; i < 600; i++) p.update(1 / 60, idle);
  assert.deepEqual(p.ball, after); assert.equal(p.shots, 1);
});
test('real bumper contacts impart outward velocity and emit the matching cube colour once', () => {
  for (let i = 0; i < PINBALL_BUMPERS.length; i++) {
    const hits = [], p = createPinball(color => hits.push(color)), b = PINBALL_BUMPERS[i];
    Object.assign(p.ball, { x: b.x, y: b.y + b.r + p.ball.r + .003, vx: 0, vy: -1, active: true });
    p.update(.03, { launch: false, left: false, right: false });
    assert.ok(p.ball.vy > 0); assert.deepEqual(hits, [i]); assert.equal(p.score, 100);
  }
});
test('moving flippers transfer momentum; paths depend on player input and stay finite', () => {
  const a = createPinball(), b = createPinball();
  Object.assign(a.ball, { x: .4, y: 1.45, vx: 0, vy: .3, active: true }); Object.assign(b.ball, a.ball);
  let fastestUpward = 0;
  for (let i = 0; i < 20; i++) { a.update(1 / 120, { launch: false, left: true, right: false }); b.update(1 / 120, idle); fastestUpward = Math.min(fastestUpward, a.ball.vy); }
  // It may already have hit the new spinner again by the twentieth step.
  assert.ok(fastestUpward < -.5); assert.notEqual(a.ball.y, b.ball.y);
  const game = createPinball();
  for (let i = 0; i < 12000; i++) {
    game.update(i % 2 ? 1 / 144 : .05, { launch: i % 600 === 0, left: i % 83 < 25, right: i % 113 < 30 });
    for (const ball of game.balls) {
      assert.ok(Object.values(ball).filter(v => typeof v === 'number').every(Number.isFinite));
      assert.ok(Math.hypot(ball.vx, ball.vy) < 12);
    }
    assert(Number.isFinite(game.spinner.angle) && Number.isFinite(game.spinner.omega));
  }
  assert.ok(game.score > 0); assert.ok(game.shots > 1);
});

test('three physical drop targets unlock exactly one extra ball and a jackpot', () => {
  const events = [], p = createPinball(undefined, e => events.push(e));
  for (const target of PINBALL_TARGETS) {
    Object.assign(p.ball, { x: target.x, y: target.y + .043, vx: 0, vy: -1, active: true });
    p.update(.025, idle);
  }
  assert(p.targets.every(t => t.down)); assert.equal(p.activeBalls, 2);
  assert.equal(events.filter(e => e.kind === 'target').length, 3);
  assert.equal(events.filter(e => e.kind === 'multiball').length, 1);
  assert.equal(p.score, 1750);
  p.update(.01, { ...idle, launch: true });
  assert.equal(p.shots, 0, 'launch is ignored while either ball remains in play');
  assert.equal(events.filter(e => e.kind === 'multiball').length, 1);
  Object.assign(p.balls[0], { y: 1.9 }); Object.assign(p.balls[1], { y: 1.9 });
  p.update(.01, idle); assert.equal(p.activeBalls, 0);
  for (let i = 0; i < 60; i++) p.update(1 / 60, idle);
  assert.equal(p.activeBalls, 0);
  p.update(.01, { ...idle, launch: true });
  assert.equal(p.shots, 1); assert.equal(p.activeBalls, 1); assert(p.targets.every(t => !t.down));
});

test('spinner exchanges real angular momentum and coasts down without a motor', () => {
  const events = [], p = createPinball(undefined, e => events.push(e));
  p.spinner.angle = 0;
  Object.assign(p.ball, { x: .56, y: 1.105, vx: 0, vy: -1, active: true });
  p.update(.025, idle);
  assert(Math.abs(p.spinner.omega) > .1);
  assert(events.some(e => e.kind === 'spinner' && e.points === 50));
  p.ball.active = false;
  const before = Math.abs(p.spinner.omega), angle = p.spinner.angle;
  for (let i = 0; i < 60; i++) p.update(1 / 60, idle);
  assert.notEqual(p.spinner.angle, angle); assert(Math.abs(p.spinner.omega) < before * .3);
});

test('different bumper contacts build timed combos; inactivity resets them', () => {
  const p = createPinball();
  for (const b of PINBALL_BUMPERS) {
    Object.assign(p.ball, { x: b.x, y: b.y + b.r + p.ball.r + .003, vx: 0, vy: -1, active: true });
    p.update(.03, idle);
  }
  assert.equal(p.combo, 3); assert.equal(p.score, 600); assert(p.comboRemaining > 0);
  p.ball.active = false;
  for (let i = 0; i < 240; i++) p.update(1 / 60, idle);
  assert.equal(p.combo, 1); assert.equal(p.comboRemaining, 0);
});

test('the two balls exchange impulses and are separated instead of passing through each other', () => {
  const p = createPinball();
  Object.assign(p.balls[0], { x: .476, y: 1.22, vx: 1, vy: 0, active: true });
  Object.assign(p.balls[1], { x: .524, y: 1.22, vx: -1, vy: 0, active: true });
  p.update(1 / 240, idle);
  assert(p.balls[0].vx < 0 && p.balls[1].vx > 0);
  assert(p.balls[1].x - p.balls[0].x >= .05);
});

test('a cabinet nudge adds only a small cooldown-limited impulse, never resets or duplicates balls', () => {
  const p = createPinball();
  Object.assign(p.ball, { x: .4, y: 1.2, vx: 0, vy: 0, active: true });
  p.update(0, { ...idle, nudge: true });
  assert.equal(p.ball.vx, .12); assert.equal(p.ball.vy, -.26);
  p.update(0, { ...idle, nudge: true });
  assert.equal(p.ball.vx, .12); assert.equal(p.ball.vy, -.26);
  assert.equal(p.activeBalls, 1); assert.equal(p.shots, 0); assert.equal(p.score, 0);
});

test('ordinary play reaches all new mechanisms without forced positions and does not jam at the hinges', () => {
  const events = {}, p = createPinball(undefined, e => { events[e.kind] = (events[e.kind] ?? 0) + 1; });
  for (let i = 0; i < 60000; i++) p.update(1 / 120, { launch: i % 60 === 0, left: i % 137 < 47, right: i % 113 < 39 });
  for (const kind of ['target', 'multiball', 'sling', 'spinner']) assert(events[kind] > 1, kind);
  assert(p.shots > 5, 'balls must eventually drain instead of getting trapped behind a hinge');
});

test('art and glow atlases are created only once; live effects and score labels remain bounded', () => {
  let canvases = 0, gradients = 0;
  const text = [];
  const makeContext = () => new Proxy({}, { get: (obj, key) => {
    if (key in obj) return obj[key];
    if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => { gradients++; return { addColorStop() {} }; };
    if (key === 'fillText') return label => { text.push(label); };
    return () => {};
  } });
  globalThis.document = { createElement: () => { canvases++; return { getContext: makeContext }; } };
  const hits = [], p = createLedPinball(1920, 1080, c => hits.push(c)), g = makeContext();
  const bakedGradients = gradients, bakedCanvases = canvases;
  assert.equal(bakedCanvases, 2);
  const pointer = { rawX: -1, rawY: -1, active: false, clicked: false, pressed: false };
  for (let i = 0; i < 600; i++) {
    if (i % 20 === 0) {
      const b = PINBALL_BUMPERS[i % 3];
      Object.assign(p.model.ball, { x: b.x, y: b.y + b.r + .028, vx: 0, vy: -1, active: true });
    }
    p.update(1 / 60, pointer, true); text.length = 0; p.draw(g);
    assert(text.filter(s => s.startsWith('+')).length <= 12);
  }
  assert(hits.length > 10); assert.equal(canvases, bakedCanvases); assert.equal(gradients, bakedGradients);
});
test('fullscreen pinball fits left margin on desktop and below cube in portrait', () => {
  for (const [w, h] of [[1920, 1080], [2560, 1440], [1100, 650], [390, 844]]) {
    const r = pinballLayout(w, h);
    assert.ok(r.x >= 0 && r.y >= 0); assert.ok(r.x + r.width <= w); assert.ok(r.y + r.height <= h);
    if (w >= 1920) assert.ok(r.x + r.width < (w - 1240) / 2);
  }
});
test('leisure-only opt-in, real colour callback and bounded cube particle pool', () => {
  const config = readFileSync(new URL('../groupEffects.config.ts', import.meta.url), 'utf8');
  assert.match(config, /BY_CATEGORY_ID\[1771\] = .*leisurePinball: 1/);
  const cube = readFileSync(new URL('./ledCube.ts', import.meta.url), 'utf8');
  assert.match(cube, /c.body && \(c.params.leisurePinball === 1 \|\| c.params.leisurePinball === 2 \|\| c.params.leisurePinball === 3\)/);
  assert.match(cube, /createFiestaPinball\(W, H, color => burst/);
  assert.match(cube, /createLedPinball\(W, H, color => burst/);
  assert.match(cube, /if \(sparks.length > 1000\)/);
});
