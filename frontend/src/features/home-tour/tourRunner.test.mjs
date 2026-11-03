import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(new URL('../../../package.json', import.meta.url));
const ts = require('typescript');
const source = await readFile(new URL('./tourRunner.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;

function fixture(init = async () => {}) {
  const calls = [];
  const instances = [];
  class Cat {
    constructor() { instances.push(this); }
    init = init;
    jumpTo = async () => { calls.push('jump'); };
    dispose = () => { calls.push('dispose'); };
    say = text => { calls.push(text); };
    setMouth() {}
    setEmotion() {}
    play() {}
  }
  class Voice { load = async () => {}; dispose() {} }
  const exports = {};
  const context = { exports, Promise, setTimeout, clearTimeout, innerWidth: 1440, innerHeight: 900, scrollX: 0, scrollY: 0,
    document: { cookie: '' }, window: { dispatchEvent() {} },
    require: name => {
      if (name.includes('catMascot')) return { CatMascot: Cat };
      if (name === './tourVoice') return { TourVoice: Voice };
      if (name === './homeTourSteps') return { HOME_TOUR: [], tourText: key => key };
      throw Error(name);
    },
  };
  vm.runInNewContext(code, context);
  const createRunner = () => new exports.HomeTourRunner('ru', null, { text: 'invite', start: 'start', later: 'later' }, () => {});
  return { runner: createRunner(), createRunner, calls, instances };
}

test('route teardown while importing the cat cannot create an orphan tour', async () => {
  const { runner, instances } = fixture();
  const invitation = runner.invite();
  runner.dispose();
  await invitation;
  assert.equal(instances.length, 0);
  assert.equal(runner.state.phase, 'off');
});

test('route teardown during WebGL initialization cannot show the old invitation', async () => {
  let ready;
  const init = new Promise(resolve => { ready = resolve; });
  const { runner, calls, instances } = fixture(() => init);
  const invitation = runner.invite();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(instances.length, 1);
  runner.dispose(); ready();
  await invitation;
  assert.deepEqual(calls, ['dispose']);
  assert.equal(runner.state.phase, 'off');
});

test('automatic invitation cannot interrupt another tour; manual replay releases its cat', async () => {
  const { runner, createRunner, instances } = fixture();
  const next = createRunner();
  await runner.invite();
  await next.invite(true);
  assert.equal(instances.length, 1);
  assert.equal(runner.state.phase, 'invite');
  assert.equal(next.state.phase, 'off');
  await next.invite();
  assert.equal(runner.state.phase, 'off');
  assert.equal(next.state.phase, 'invite');
  assert.equal(instances.length, 2);
  runner.dispose(); // delayed cleanup of the old owner must not release the new tour
  const third = createRunner();
  await third.invite(true);
  assert.equal(third.state.phase, 'off');
  next.dispose();
  await third.invite(true);
  assert.equal(third.state.phase, 'invite');
  third.dispose();
});
