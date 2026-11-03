import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { NaiveBroadphase } from 'cannon-es';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const source = readFileSync(new URL('./pinballSkylinePhysics.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from 'cannon-es'/g, `from '${pathToFileURL(require.resolve('cannon-es')).href}'`);
const { createSkylinePinball, SKYLINE_RADIUS, SKYLINE_STEP } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const layoutCode = ts.transpileModule(readFileSync(new URL('./pinballSkylineLayout.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { skylinePinballLayout } = await import('data:text/javascript;base64,' + Buffer.from(layoutCode).toString('base64'));
const idle = { launch: false, left: false, right: false };
function serve(sim, x, y, z, vx = 0, vy = 0, vz = 0, index = 0) {
  const ball = sim.balls[index]; ball.active = true; ball.body.collisionFilterGroup = 8; ball.body.position.set(x, y, z); ball.body.velocity.set(vx, vy, vz); ball.body.angularVelocity.setZero(); ball.body.wakeUp(); return ball;
}
function run(sim, seconds, input = idle) { for (let i = 0; i < Math.ceil(seconds / SKYLINE_STEP); i++) sim.update(SKYLINE_STEP, input); }

test('two raised routes and a wire return use shared collision geometry, rest until launch and dispose cleanly', () => {
  const sim = createSkylinePinball(), count = sim.world.bodies.length;
  assert.equal(sim.routes.length, 3); assert(Math.max(...sim.routes[0].samples.map(p => p.y)) > 1.4);
  assert(sim.parts.filter(p => p.kind === 'ramp').length > 65);
  assert.equal(sim.world.constraints.length, 2); run(sim, .4); assert.equal(sim.activeBalls, 0); assert.equal(sim.shots, 0);
  sim.update(1 / 60, { ...idle, launch: true }); assert.equal(sim.shots, 1); assert(sim.balls[0].body.velocity.z < -10);
  sim.balls[0].body.position.z = 4.5; sim.update(1 / 60, idle); assert.equal(sim.activeBalls, 0);
  run(sim, .2); assert.equal(sim.shots, 1); assert.equal(sim.world.bodies.length, count);
  sim.dispose(); assert.equal(sim.world.bodies.length, 0); assert.equal(sim.world.constraints.length, 0);
});

test('a ball rolls down a real elevated ramp and can fall freely instead of following a scripted spline', () => {
  const sim = createSkylinePinball(), p = sim.routes[0].samples[12];
  const ball = serve(sim, p.x, p.y + SKYLINE_RADIUS + .025, p.z);
  let before = ball.body.position.clone(), maxStep = 0;
  for (let i = 0; i < 300; i++) { sim.update(SKYLINE_STEP, idle); maxStep = Math.max(maxStep, ball.body.position.distanceTo(before)); before.copy(ball.body.position); }
  assert(ball.body.position.y < p.y, 'gravity must take the ball to a lower section'); assert(maxStep < .15);
  serve(sim, 0, 2.8, 2.6); run(sim, .1);
  assert(ball.body.velocity.y < -.8); assert(ball.body.position.y < 2.8 && ball.body.position.y > 2.65);
  sim.dispose();
});

test('off-centre impacts rotate the free rotor and load tips the hinged bridge without moving its pivot', () => {
  const sim = createSkylinePinball();
  serve(sim, 1.0, .16, 1.88, 0, 0, -3); run(sim, .16);
  assert(Math.abs(sim.rotor.body.angularVelocity.y) > .1);
  const anchor = sim.bridge.body.position.clone(); serve(sim, 1.25, 1.03, -.2); run(sim, .65);
  assert(Math.abs(sim.bridge.body.quaternion.x) > .005); assert(sim.bridge.body.position.distanceTo(anchor) < .03);
  assert(Math.abs(sim.bridge.body.quaternion.x) < .5); sim.dispose();
});

test('kinematic flipper contacts transfer velocity; the two steel balls exchange impulses', () => {
  const sim = createSkylinePinball();
  const ball = serve(sim, -.52, .12, 3.08, 0, 0, .5); let fastest = 0;
  for (let i = 0; i < 50; i++) { sim.update(SKYLINE_STEP, { ...idle, left: true }); fastest = Math.min(fastest, ball.body.velocity.z); }
  assert(fastest < -1, String(fastest));
  serve(sim, -.14, 1.8, 2.7, 2); serve(sim, .14, 1.8, 2.7, -2, 0, 0, 1); run(sim, .04);
  assert(sim.balls[0].body.velocity.x < 0 && sim.balls[1].body.velocity.x > 0); sim.dispose();
});

test('drop-target collisions unlock one extra ball; magnetic capture uses a delayed impulse, not teleportation', () => {
  const events = [], sim = createSkylinePinball(e => events.push(e));
  for (const t of sim.targets) { serve(sim, t.part.body.position.x, .12, -3.1, 0, 0, -3); run(sim, .09); }
  assert(sim.targets.every(t => t.down)); assert.equal(sim.activeBalls, 2);
  assert.equal(events.filter(e => e.kind === 'multiball').length, 1);
  sim.balls[1].active = false; sim.balls[1].body.sleep(); sim.balls[1].body.collisionFilterGroup = 0;
  const ball = serve(sim, 1.45, .12, -3.45); let previous = ball.body.position.clone(), maxStep = 0;
  for (let i = 0; i < 150; i++) { sim.update(SKYLINE_STEP, idle); maxStep = Math.max(maxStep, ball.body.position.distanceTo(previous)); previous.copy(ball.body.position); }
  assert(events.some(e => e.kind === 'kicker')); assert(maxStep < .2); assert(ball.body.velocity.z > 1); sim.dispose();
});

test('3D resources load lazily, use a small render surface, have no shadow/bloom pass and retain the classic source', () => {
  const wrapper = readFileSync(new URL('./pinballSkyline.ts', import.meta.url), 'utf8');
  const render = readFileSync(new URL('./pinballSkylineRenderer.ts', import.meta.url), 'utf8');
  const cube = readFileSync(new URL('./ledCube.ts', import.meta.url), 'utf8');
  const gallery = readFileSync(new URL('../../../../app/course/effects-preview/page.tsx', import.meta.url), 'utf8');
  assert.match(wrapper, /import\('\.\/pinballSkylineRenderer'\)/); assert.match(wrapper, /if \(!disposed\)/);
  assert.match(render, /750_000/); assert.match(render, /renderer.shadowMap.enabled = false/); assert.doesNotMatch(render, /EffectComposer|UnrealBloomPass/);
  assert.match(render, /InstancedMesh/); assert.match(render, /if \(key === lastDisplay\) return/); assert.match(render, /renderer.forceContextLoss/);
  assert.match(cube, /leisurePinball: 1/); assert.match(cube, /leisurePinball: 2/);
  assert.match(gallery, /sceneId: 'pinball-reactor-classic'/); assert.match(gallery, /sceneId: 'pinball-skyline'/);
  const frozen = JSON.parse(readFileSync(new URL('./pinballReactor.frozen.json', import.meta.url), 'utf8'));
  for (const [file, hash] of Object.entries(frozen.sha256)) {
    // Normalize Windows checkout newlines: freezing is about source, not Git autocrlf.
    const content = readFileSync(new URL(file, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(createHash('sha256').update(content).digest('hex'), hash, `${file} must remain the preserved variant`);
  }
});

test('focused 3D is large, while the real course never puts the table over the central content', () => {
  for (const [w, h] of [[1920, 1080], [2560, 1440], [1100, 650], [390, 844]]) for (const focused of [false, true]) {
    const rect = skylinePinballLayout(w, h, focused);
    assert(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= w && rect.y + rect.height <= h);
    if (w >= 1920 && !focused) assert(rect.x + rect.width < (w - 1240) / 2);
  }
  assert(skylinePinballLayout(1920, 1080, true).width > skylinePinballLayout(1920, 1080).width * 2);
});

test('specialized broadphase finds exactly the same physical candidate pairs as the reference broadphase', () => {
  const sim = createSkylinePinball();
  serve(sim, 1.25, 1, -.4); serve(sim, -.4, .15, .5, 1, 0, 0, 1); run(sim, .03);
  const reference = new NaiveBroadphase(); reference.useBoundingBoxes = true;
  const a = [], b = [], c = [], d = [];
  sim.world.broadphase.collisionPairs(sim.world, a, b); reference.collisionPairs(sim.world, c, d);
  const keys = (x, y) => x.map((p, i) => [p.id, y[i].id].sort((a, b) => a - b).join(':')).sort();
  assert.deepEqual(keys(a, b), keys(c, d)); sim.dispose();
});

test('long ordinary play stays finite and reaches raised geometry without scripted ball placement', t => {
  const counts = {}, sim = createSkylinePinball(e => { counts[e.kind] = (counts[e.kind] ?? 0) + 1; });
  let peak = 0; const before = performance.now();
  for (let i = 0; i < 6000; i++) {
    sim.update(1 / 120, { launch: i % 60 === 0, left: i % 137 < 53, right: i % 113 < 47 });
    for (const ball of sim.balls) { assert(Number.isFinite(ball.body.position.lengthSquared())); if (ball.active) peak = Math.max(peak, ball.body.position.y); }
  }
  t.diagnostic(JSON.stringify({ simulatedSeconds: 50, cpuMs: Math.round(performance.now() - before), shots: sim.shots, counts, peakHeight: peak }));
  // A well-kept ball may legitimately last this entire window; do not require an artificial drain/restart.
  assert(sim.shots >= 1); assert(sim.score > 0); assert(counts.ramp > 0); assert(peak > .5);
  sim.dispose();
});

test('a fast real entrance shot climbs to the upper skyline and every deck hull has outward faces', () => {
  const sim = createSkylinePinball();
  for (const part of sim.parts.filter(p => p.hull)) {
    const shape = part.body.shapes[0];
    for (let i = 0; i < shape.faces.length; i++) assert(shape.faceNormals[i].dot(shape.vertices[shape.faces[i][0]]) >= -1e-8);
  }
  const p = sim.routes[0].samples[0], ball = serve(sim, p.x, p.y + SKYLINE_RADIUS + .01, p.z, -.4, 0, -8.5);
  let peak = ball.body.position.y;
  for (let i = 0; i < 900; i++) { sim.update(SKYLINE_STEP, idle); if (ball.active) peak = Math.max(peak, ball.body.position.y); }
  assert(peak > 1.3, String(peak)); sim.dispose();
});
