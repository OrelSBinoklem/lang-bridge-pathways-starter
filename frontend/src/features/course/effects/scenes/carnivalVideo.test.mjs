import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import ts from 'typescript';
const code = readFileSync(new URL('./carnivalVideo.ts', import.meta.url), 'utf8');
const { CARNIVAL_VIDEO, parkVideoLayout } = await import('data:text/javascript;base64,' + Buffer.from(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64'));
test('both compositions remain in bounds at card, desktop and phone sizes', () => {
  for (const [w, h] of [[500, 190], [1920, 1080], [2560, 1440], [390, 844]]) for (const body of [true, false]) {
    for (const r of parkVideoLayout(w, h, body)) { assert.ok(r.x >= 0 && r.y >= 0); assert.ok(r.x + r.width <= w + .01); assert.ok(r.y + r.height <= h + .01); }
  }
  assert.ok(parkVideoLayout(1920, 1080, true, false)[0].width > parkVideoLayout(1920, 1080, true, true)[0].width * 2);
});
test('park has no runtime 3D renderer; video lifecycle follows visibility and resources remain bounded', async () => {
  const previous = { document: globalThis.document, window: globalThis.window }, videos = [], allocations = [];
  let draws = [], balloonDraws = 0;
  const gradient = { addColorStop() {} };
  const context = new Proxy({}, { get(_, key) { if (String(key).startsWith('create')) return () => gradient;
    if (key === 'drawImage') return source => { draws.push(source); if (source.tag === 'canvas') balloonDraws++; };
    return () => {}; }, set() { return true; } });
  globalThis.document = { createElement(tag) {
    allocations.push(tag);
    if (tag === 'canvas') return { tag, getContext: () => context };
    const video = { tag, readyState: 2, paused: true, plays: 0, pauses: 0, addEventListener() {}, load() {}, removeAttribute() {},
      async play() { this.paused = false; this.plays++; }, pause() { this.paused = true; this.pauses++; } }; videos.push(video); return video;
  } };
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  try {
    const c = { width: 1920, height: 1080, body: true, rand: () => .5, params: { speed: 1, react: 1 } };
    const scene = CARNIVAL_VIDEO.create(c), total = allocations.length;
    assert.equal(scene.ready(), true); assert.equal(videos.length, 2);
    scene.setVisible(true); await Promise.resolve(); assert.ok(videos.every(v => v.plays === 1));
    scene.draw(context); assert.equal(balloonDraws, 14);
    const r = parkVideoLayout(1920, 1080, true)[0];
    const pointer = { rawX: r.x + r.width * .165, rawY: r.y + r.height * .15, clicked: true, active: true };
    scene.update(0, 0, pointer); balloonDraws = 0; draws = []; scene.draw(context); assert.equal(balloonDraws, 13, 'clicked shell disappears, video remains');
    pointer.clicked = false;
    for (let i = 0; i < 600; i++) scene.update(1 / 60, i / 60, pointer);
    balloonDraws = 0; scene.draw(context); assert.equal(balloonDraws, 14, 'balloon returns independently of video');
    assert.equal(allocations.length, total, 'no per-frame textures/canvases/WebGL');
    c.params.speed = 0; scene.update(.01, 10, pointer); assert.ok(videos.every(v => v.paused));
    c.params.speed = 1; scene.update(.01, 10, pointer); await Promise.resolve(); assert.ok(videos.every(v => !v.paused));
    scene.setVisible(false); assert.ok(videos.every(v => v.paused));
    scene.dispose(); assert.ok(videos.every(v => v.pauses >= 2));
  } finally { Object.assign(globalThis, previous); }
});
test('original complete 3D park remains in the static gallery and the baker cannot run on production', () => {
  const index = readFileSync(new URL('./cinematic/index.ts', import.meta.url), 'utf8');
  assert.match(index, /if \(meta.id === 'cloud-carnival'\) return CARNIVAL_VIDEO.create\(c\)/);
  assert.match(index, /'cloud-carnival-party-v1': carnivalPartyV1/);
  const gallery = readFileSync(new URL('../../../../app/course/effects-preview/page.tsx', import.meta.url), 'utf8');
  assert.match(gallery, /сохранённая живая 3D-версия/);
  const route = readFileSync(new URL('../../../../app/api/dev/carnival-bake/route.ts', import.meta.url), 'utf8');
  assert.match(route, /process.env.NODE_ENV !== 'development'/); assert.match(route, /if \(!user.is_admin\)/); assert.match(route, /request.headers.get\('origin'\) !== url.origin/);
  for (const side of ['left', 'right']) assert.ok(statSync(new URL(`../../../../../public/course/effects/carnival/park-${side}.mp4`, import.meta.url)).size > 100000);
  assert.ok(statSync(new URL('../../../../../public/course/effects/carnival/balloons.webp', import.meta.url)).size > 1000);
});
