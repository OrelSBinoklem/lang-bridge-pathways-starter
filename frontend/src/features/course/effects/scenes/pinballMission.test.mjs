import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const modules = new Map();
function url(name) {
  if (modules.has(name)) return modules.get(name);
  let code = ts.transpileModule(readFileSync(new URL(name + '.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const match of [...code.matchAll(/from ['"]([^'"]+)['"]/g)]) code = code.replace(match[0], `from ${JSON.stringify(url(match[1]))}`);
  const result = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64'); modules.set(name, result); return result;
}
const { createPinballMission } = await import(url('./pinballMission'));
const { createMissionPinball } = await import(url('./pinballMissionTable'));
const { createPinball } = await import(url('./pinballPhysics'));
const { createPinballBot } = await import(url('./pinballBot'));
const state = () => ({ score: 0, shots: 0, activeBalls: 0, targets: [{ down: false }, { down: false }, { down: false }] });

test('score alone cannot win; colors persist between launches and a final winning contact beats drain', () => {
  const table = state(), round = createPinballMission(table);
  table.shots = 1; table.score = 3500; table.targets[0].down = true; round.update();
  assert.equal(round.status, 'playing'); assert.equal(round.colors, 1);
  table.targets[0].down = false; table.targets[1].down = true; table.shots = 2; round.update();
  assert.equal(round.colors, 3);
  table.targets[1].down = false; table.targets[2].down = true; table.shots = 5; round.update();
  assert.equal(round.status, 'won'); assert.equal(round.colors, 7);
  table.score = 0; round.update(); assert.equal(round.score, 3500, 'finished result is latched');
});

test('all colors alone cannot win, multiball does not consume attempts and last active ball can keep playing', () => {
  const table = state(), round = createPinballMission(table);
  table.shots = 5; table.score = 2999; table.activeBalls = 2;
  table.targets.forEach(t => { t.down = true; }); round.update();
  assert.equal(round.status, 'playing'); assert.equal(round.remaining, 0);
  table.activeBalls = 1; round.update(); assert.equal(round.status, 'playing');
  table.activeBalls = 0; round.update(); assert.equal(round.status, 'lost');
});

test('new round counts only its own score, colors and launches', () => {
  const table = state(), round = createPinballMission(table);
  table.shots = 5; table.score = 4000; table.targets[0].down = true; round.update();
  assert.equal(round.status, 'lost');
  table.targets.forEach(t => { t.down = false; }); round.reset();
  assert.equal(round.status, 'ready'); assert.equal(round.score, 0); assert.equal(round.remaining, 5);
  table.shots++; table.score += 100; table.activeBalls = 1; round.update();
  assert.equal(round.shots, 1); assert.equal(round.score, 100); assert.equal(round.colors, 0);
});

test('goal is reachable by ordinary play with existing physics, without forced contacts or score edits', t => {
  let winningSeed = null;
  for (let seed = 0; seed < 16 && winningSeed === null; seed++) {
    const table = createPinball(), round = createPinballMission(table);
    for (let frame = 0; frame < 24000 && round.status !== 'won' && round.status !== 'lost'; frame++) {
      table.update(1 / 120, { launch: table.activeBalls === 0, nudge: frame % (80 + seed * 7) === 0,
        left: frame % (137 + seed * 3) < 47 + seed, right: frame % (113 + seed * 5) < 39 + seed });
      round.update();
    }
    if (round.status === 'won') winningSeed = seed;
  }
  assert.notEqual(winningSeed, null, '3000 points and all RGB targets must be reachable in five launches');
  t.diagnostic(`Ordinary control replay won with seed ${winningSeed}`);
});

test('bot keeps real balls in motion and scoring without placing balls or editing the score', () => {
  const table = createPinball(), bot = createPinballBot(table);
  let flipperFrames = 0;
  for (let frame = 0; frame < 120 * 45; frame++) {
    const controls = bot.update(1 / 120);
    if (controls.left || controls.right) flipperFrames++;
    table.update(1 / 120, controls);
  }
  assert.ok(table.shots >= 1);
  assert.ok(table.score > 0);
  assert.ok(flipperFrames > 0);
  assert.ok(table.balls.every(b => Number.isFinite(b.x) && Number.isFinite(b.y)));
});

test('bot demo has no start dialog; first enabled click starts a clean user round; end/retry reuse baked assets', () => {
  let canvases = 0, gradients = 0;
  const labels = [];
  const context = () => new Proxy({}, { get(obj, key) {
    if (key in obj) return obj[key];
    if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => { gradients++; return { addColorStop() {} }; };
    if (key === 'fillText') return value => labels.push(value);
    return () => {};
  } });
  globalThis.document = { createElement: () => { canvases++; return { getContext: context }; } };
  const game = createMissionPinball(1920, 1080, () => {}), bakedCanvases = canvases, bakedGradients = gradients;
  const pointer = (x = .5, y = 1.7) => ({ rawX: game.rect.x + x * game.rect.width, rawY: game.rect.y + y * game.rect.width, active: true, clicked: true, pressed: true });
  const away = { rawX: -1, rawY: -1, active: false, clicked: false, pressed: false };
  for (let frame = 0; frame < 120 * 20; frame++) game.update(1 / 120, away, true);
  assert.equal(game.attract, true);
  assert.equal(game.mission.status, 'ready'); assert.equal(game.mission.shots, 0);
  assert.ok(game.model.score > 0, 'demo scores independently');
  game.draw(context());
  assert.ok(labels.includes('ИГРАЕТ БОТ · КЛИК — ТВОЙ ХОД'));
  assert.ok(!labels.includes('ИГРАТЬ') && !labels.includes('ЕЩЁ РАУНД') && !labels.includes('ПОБЕДА!'));
  game.update(.01, { ...pointer(), clicked: false }, true); assert.equal(game.attract, true, 'hover/holding alone is not a takeover click');
  game.update(.01, pointer(), false); assert.equal(game.attract, true, 'disabled interaction leaves the bot playing');
  for (let shot = 0; shot < 5; shot++) {
    game.update(.01, pointer(), true);
    assert.equal(game.attract, false);
    assert.equal(game.mission.shots, shot + 1);
    if (shot === 0) assert.equal(game.mission.score, 0, 'bot points must not belong to the user');
    game.update(.01, pointer(), true); assert.equal(game.mission.shots, shot + 1);
    for (const ball of game.model.balls) if (ball.active) ball.y = 1.9;
    game.update(.01, away, true);
  }
  assert.equal(game.mission.status, 'lost');
  game.update(.01, pointer(), true); assert.equal(game.mission.status, 'lost');
  game.update(.01, pointer(.5, 1.43), false); assert.equal(game.mission.status, 'lost', 'disabled effects cannot restart');
  game.update(.01, pointer(.5, 1.43), true);
  assert.equal(game.mission.status, 'ready'); assert.equal(game.mission.score, 0); assert.equal(game.model.activeBalls, 0);
  game.update(.01, pointer(), true); assert.equal(game.mission.shots, 1);
  game.draw(context()); assert.ok(labels.some(s => s === '0000 / 3000'));
  assert.equal(canvases, bakedCanvases); assert.equal(gradients, bakedGradients);
});

test('classic archive source remains byte-for-byte frozen', () => {
  const frozen = JSON.parse(readFileSync(new URL('./pinballReactor.frozen.json', import.meta.url), 'utf8'));
  for (const [file, hash] of Object.entries(frozen.sha256)) {
    assert.equal(createHash('sha256').update(readFileSync(new URL(file, import.meta.url), 'utf8').replace(/\r\n/g, '\n')).digest('hex'), hash);
  }
});
