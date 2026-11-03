import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(await readFile(new URL('./dominoWorkshopPhysics.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from 'cannon-es'/g, `from '${pathToFileURL(require.resolve('cannon-es')).href}'`);
const { createDominoWorkshop } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const run = (s, seconds, fps = 60) => { for (let i = 0; i < seconds * fps; i++) s.update(1 / fps); };
const tipped = p => Math.abs(p.body.quaternion.x) + Math.abs(p.body.quaternion.z) > .25;

test('a physical domino collision propagates through the helix, without a successor graph', () => {
  const s = createDominoWorkshop(); s.push(0); run(s, 8);
  const fallen = s.dynamic.filter(p => p.kind === 'domino' && tipped(p));
  console.log('fallen after 8 seconds:', fallen.length, 'of', s.dynamic.filter(p => p.kind === 'domino').length);
  assert.ok(fallen.length >= 60, `only ${fallen.length} pieces fell`);
  assert.ok(s.world.contacts.length > 0); s.dispose();
});

test('nothing starts by itself, including the ball and tightly curved sections', () => {
  const s = createDominoWorkshop();
  const before = s.dynamic.map(p => p.body.position.clone());
  const rotation = s.dynamic.map(p => p.body.quaternion.clone()); run(s, 10);
  for (const [i, p] of s.dynamic.entries()) {
    assert.ok(p.body.position.distanceTo(before[i]) < .02, `idle ${p.kind} ${i} moved`);
    assert.ok(Math.abs(p.body.quaternion.x - rotation[i].x) + Math.abs(p.body.quaternion.y - rotation[i].y) + Math.abs(p.body.quaternion.z - rotation[i].z) < .001, `idle ${p.kind} ${i} rotated`);
    if (p.kind === 'domino') assert.ok(!tipped(p), `idle domino ${i} fell`);
  }
  assert.equal(s.pushes, 0); s.dispose();
});

test('the upper route releases the ball and reaches the lower physical mechanisms', () => {
  const s = createDominoWorkshop(); s.push(0);
  const ball = s.dynamic.find(p => p.kind === 'ball');
  const pendulum = s.dynamic.find(p => p.kind === 'pendulum');
  const lever = s.dynamic.find(p => p.kind === 'lever');
  let ballTravel = 0, swing = 0, leverTilt = 0;
  for (let i = 0; i < 1200; i++) {
    s.update(1 / 60); ballTravel = Math.max(ballTravel, ball.body.position.distanceTo(ball.initial));
    swing = Math.max(swing, pendulum.body.position.distanceTo(pendulum.initial));
    leverTilt = Math.max(leverTilt, Math.abs(lever.body.quaternion.x));
  }
  assert.ok(ballTravel > 6, `ball travel ${ballTravel}`);
  assert.ok(swing > .2, `pendulum swing ${swing}`);
  assert.ok(leverTilt > .08, `lever tilt ${leverTilt}`);
  for (const p of s.dynamic) assert.ok(p.body.position.y > -.75, `${p.kind} fell through ground`);
  s.dispose();
});

test('clicking a fallen piece adds impulse and never restores positions', () => {
  const s = createDominoWorkshop(); s.push(0); run(s, 2);
  const before = s.dynamic.map(p => p.body.position.clone());
  s.push(0);
  s.dynamic.forEach((p, i) => assert.ok(p.body.position.distanceTo(before[i]) < 1e-12));
  s.dispose();
});

test('pendulum keeps its real hinge and swings back under gravity', () => {
  const s = createDominoWorkshop(), index = s.dynamic.findIndex(p => p.kind === 'pendulum');
  const p = s.dynamic[index]; s.push(index);
  let positive = false, negative = false, maxError = 0;
  const joint = s.hinges.find(h => h.body === p.body);
  for (let i = 0; i < 600; i++) {
    s.update(1 / 120);
    positive ||= p.body.velocity.x > .1; negative ||= p.body.velocity.x < -.1;
    maxError = Math.max(maxError, p.body.pointToWorldFrame(joint.pivot).distanceTo(joint.anchor));
  }
  assert.ok(positive && negative); assert.ok(maxError < .025, `hinge drift ${maxError}`); s.dispose();
});

test('a middle push does not start the whole scene; simulation remains finite', () => {
  const s = createDominoWorkshop();
  s.push(s.dynamic.findIndex(p => p.kind === 'cradle')); run(s, 4);
  assert.ok(!tipped(s.dynamic[0]));
  for (const p of s.dynamic) assert.ok(Number.isFinite(p.body.position.length() + p.body.velocity.length()));
  const time = s.time; s.update(NaN); s.update(-1); assert.equal(s.time, time);
  s.update(10); assert.ok(s.time - time < .061); s.dispose();
});

test('30, 60 and 120 display fps use the same fixed physical steps', () => {
  const positions = [30, 60, 120].map(fps => {
    const s = createDominoWorkshop(); s.push(0); run(s, 2, fps);
    const result = s.dynamic.map(p => p.body.position.clone()); s.dispose(); return result;
  });
  for (const sample of positions.slice(1)) sample.forEach((p, i) => assert.ok(p.distanceTo(positions[0][i]) < 1e-7));
});

test('Newton cradle transmits a collision to the last suspended ball', () => {
  const s = createDominoWorkshop(); const balls = s.dynamic.filter(p => p.kind === 'cradle');
  s.push(s.dynamic.indexOf(balls[0])); let travel = 0;
  for (let i = 0; i < 360; i++) { s.update(1 / 120); travel = Math.max(travel, balls.at(-1).body.position.distanceTo(balls.at(-1).initial)); }
  assert.ok(travel > .2, `last ball moved ${travel}`); assert.ok(!tipped(s.dynamic[0])); s.dispose();
});

test('a fallen domino loses its slide to surface friction instead of skating across the table', () => {
  // Check both the table and the surrounding floor, clear of other pieces.
  for (const [x, y, z] of [[0, .05, -8.8], [20, -.67, 0]]) {
    const s = createDominoWorkshop(), b = s.dynamic[0].body;
    b.position.set(x, y, z); b.quaternion.setFromEuler(0, 0, Math.PI / 2);
    b.velocity.set(2, 0, 0); b.angularVelocity.setZero(); b.aabbNeedsUpdate = true; b.wakeUp();
    run(s, 2);
    const travel = Math.hypot(b.position.x - x, b.position.z - z);
    assert.ok(travel > .1 && travel < .55, `sliding distance ${travel}`);
    assert.ok(Math.hypot(b.velocity.x, b.velocity.z) < .08, `still sliding: ${b.velocity.length()}`);
    s.dispose();
  }
});
