import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = await readFile(new URL('./HumanTutorAvatar.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(`${source}\nexport { AvatarPortrait };`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
const flush = () => new Promise(resolve => setImmediate(resolve));

class Host {
  style = {};
  children = [];
  parent = null;
  appendChild(child) { child.remove(); child.parent = this; this.children.push(child); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
}

function setup(t) {
  const previous = { window: globalThis.window, document: globalThis.document, error: console.error };
  const errors = [], instances = [], effects = [], updates = [], host = new Host();
  const motion = new EventTarget(); motion.matches = false;
  globalThis.window = { matchMedia: () => motion };
  globalThis.document = { createElement: () => new Host() };
  console.error = (...args) => errors.push(args);
  t.after(() => {
    for (const key of ['window', 'document']) {
      if (previous[key] === undefined) delete globalThis[key]; else globalThis[key] = previous[key];
    }
    console.error = previous.error;
  });
  class Avatar {
    disposed = 0;
    states = [];
    constructor(target) { this.host = target; this.canvas = new Host(); target.appendChild(this.canvas); instances.push(this); }
    init() {
      return new Promise((resolve, reject) => {
        this.fail = reject;
        this.finish = () => {
          assert.equal(this.disposed, 0, 'init must not continue against a disposed scene');
          this.host.appendChild(new Host());
          resolve();
        };
      });
    }
    setState(value) { this.states.push(value); }
    attachAnalyser(value) { this.analyser = value; }
    setAutonomy() {}
    setFollowPointer() {}
    dispose() { this.disposed++; this.canvas.remove(); }
  }
  let refIndex = 0, stateIndex = 0;
  const hooks = {
    useRef: value => ({ current: refIndex++ === 0 ? host : value }),
    useState: value => { const index = stateIndex++; return [value, next => updates.push([index, next])]; },
    useEffect: effect => effects.push(effect),
  };
  const exportsObject = {};
  new Function('require', 'exports', code)(name => {
    if (name === 'react') return hooks;
    if (name === 'next-intl') return {};
    if (name === './tutorAvatar') return { TutorAvatar: Avatar };
    if (name === './avatarModels' || name === './avatar-selection') return {};
    if (name.endsWith('.css')) return { default: {} };
    return require(name);
  }, exportsObject);
  exportsObject.AvatarPortrait({ model: { url: '/models/avatar/test.vrm', motions: '/models/avatar/anim/test/' }, state: 'speaking', analyser: 'analyser', uk: false, retry() {} });
  effects[0]();
  return { host, instances, updates, errors, mount: effects[1] };
}

test('StrictMode cleanup before the lazy import resolves constructs only the surviving setup', async t => {
  const h = setup(t);
  const first = h.mount(); first();
  const second = h.mount();
  await flush();
  assert.equal(h.instances.length, 1);
  h.instances[0].finish(); await flush();
  assert.deepEqual(h.instances[0].states, ['speaking']);
  assert.equal(h.instances[0].analyser, 'analyser');
  second();
  assert.equal(h.instances[0].disposed, 1);
  assert.equal(h.host.children.length, 0);
});

test('late init finishes in its detached host and disposes once without touching the replacement', async t => {
  const h = setup(t);
  const first = h.mount(); await flush();
  const old = h.instances[0]; first();
  assert.equal(old.disposed, 0);
  assert.equal(old.host.parent, null);
  const second = h.mount(); await flush();
  const replacement = h.instances[1];
  old.finish(); await flush();
  assert.equal(old.disposed, 1);
  assert.equal(h.host.children[0], replacement.host);
  assert.deepEqual(h.updates, []);
  replacement.finish(); await flush();
  assert.deepEqual(h.updates, [[0, true]]);
  second();
  assert.equal(replacement.disposed, 1);
  assert.equal(h.host.children.length, 0);
});

test('rejected initialization after cleanup disposes once without stale state or unhandled rejection', async t => {
  const h = setup(t);
  const cleanup = h.mount(); await flush();
  cleanup(); h.instances[0].fail(new Error('late failure')); await flush();
  assert.equal(h.instances[0].disposed, 1);
  assert.deepEqual(h.updates, []);
  assert.equal(h.host.children.length, 0);
});

test('initialization errors are reported, remove the failed host and expose the retry state', async t => {
  const h = setup(t);
  const cleanup = h.mount(); await flush();
  h.instances[0].fail(new Error('model failure')); await flush();
  assert.equal(h.instances[0].disposed, 1);
  assert.equal(h.errors.length, 1);
  assert.deepEqual(h.updates, [[1, true]]);
  assert.equal(h.host.children.length, 0);
  cleanup();
  assert.equal(h.instances[0].disposed, 1);
});
