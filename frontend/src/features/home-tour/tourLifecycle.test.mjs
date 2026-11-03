import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(new URL('../../../package.json', import.meta.url));
const ts = require('typescript');
const compile = async path => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const [homeCode, pageCode] = await Promise.all([compile('./HomeTour.tsx'), compile('./PageTour.tsx')]);
const flushPromises = () => new Promise(resolve => setImmediate(resolve));
const jsx = (type, props) => ({ type, props });

// Preserve state/refs and commit only changed effects, so a rerender exercises the real effect dependencies.
function hooks() {
  const slots = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, next => { slots[index].value = typeof next === 'function' ? next(slots[index].value) : next; }];
    },
    useRef(initial) {
      const index = cursor++;
      slots[index] ??= { ref: { current: initial } };
      return slots[index].ref;
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      const changed = !previous || !dependencies || dependencies.some((value, i) => !Object.is(value, previous.dependencies?.[i]));
      slots[index] = { ...previous, dependencies, pending: changed ? effect : undefined };
    },
  };
  return {
    react,
    render(Component, props) {
      cursor = 0;
      const tree = Component(props);
      for (const slot of slots) {
        if (!slot.pending) continue;
        slot.cleanup?.();
        slot.cleanup = slot.pending();
        slot.pending = undefined;
      }
      return tree;
    },
    unmount() { for (const slot of slots) { slot.cleanup?.(); slot.cleanup = undefined; } },
  };
}

function fixture(code, extraImports = {}) {
  const renderer = hooks(), calls = [], listeners = new Map(), runners = [];
  class Runner {
    constructor() { runners.push(this); }
    invite = async auto => { calls.push(auto ? 'auto-invite' : 'invite'); };
    dispose = () => { calls.push('dispose'); };
    setLanguage() {}
  }
  const imports = {
    react: renderer.react,
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-dom': { createPortal: node => node },
    'next-intl': { useLocale: () => 'ru' },
    '@/features/tutor-characters/characterRuntime': { getCharacterTour: () => false, setCharacterTour() {} },
    './tourRunner': { HomeTourRunner: Runner, TOUR_LAYER: 100000, tourInviteDue: () => true },
    './homeTourSteps': { HOME_TOUR: [], TOUR_RELEASE: 'test' },
    './home-tour.module.css': { __esModule: true, default: {} },
    ...extraImports,
  };
  const exports = {};
  vm.runInNewContext(code, {
    exports, URL, location: { href: 'https://example.test/' }, clearTimeout,
    window: {
      addEventListener(type, listener) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(listener);
      },
      removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
      setTimeout: () => assert.fail('manual lifecycle test unexpectedly scheduled an automatic invitation'),
    },
    require: name => {
      assert(Object.hasOwn(imports, name), `unexpected dependency: ${name}`);
      return imports[name];
    },
  });
  return { ...renderer, exports, calls, listeners, runners };
}

function deferredUser() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  const requests = [];
  return { resolve, requests, clientApi: path => { requests.push(path); return promise; } };
}

test('HomeTour ignores a delayed authenticated /user response after route cleanup', async t => {
  const user = deferredUser();
  const view = fixture(homeCode, { '@/lib/client-api': { clientApi: user.clientApi } });
  t.after(() => view.unmount());
  view.render(view.exports.HomeTour);
  assert.deepEqual(user.requests, ['/user']);
  assert.deepEqual(view.calls, []);
  assert.equal(view.listeners.get('lbp.tour.start').size, 1);

  view.unmount();
  assert.deepEqual(view.calls, ['dispose']);
  assert.equal(view.listeners.get('lbp.tour.start').size, 0);
  user.resolve({ user: { id: 1 } });
  await flushPromises();

  assert.deepEqual(view.calls, ['dispose'], 'late authentication must not resurrect the disposed runner');
  assert.equal(view.runners.length, 1);
});

test('HomeTour still invites an authenticated user when the request resolves while mounted', async t => {
  const user = deferredUser();
  const view = fixture(homeCode, { '@/lib/client-api': { clientApi: user.clientApi } });
  t.after(() => view.unmount());
  view.render(view.exports.HomeTour);
  user.resolve({ user: { id: 1 } });
  await flushPromises();

  assert.deepEqual(user.requests, ['/user']);
  assert.deepEqual(view.calls, ['auto-invite'], 'positive control: the auth path must remain functional');
});

const pageProps = {
  isAuthenticated: false, autoInvite: false, entryId: 'chat', eventName: 'lbp.chat-tour.start', release: 'test',
  definition: { steps: [], cookie: 'test_chat_tour' },
  copy: { ru: { title: 'Тур по чату', invite: 'Показать чат?' }, uk: { title: 'Тур чатом', invite: 'Показати чат?' } },
};

function replayButton(tree) {
  if (Array.isArray(tree)) return tree.map(replayButton).find(Boolean);
  if (!tree || typeof tree !== 'object') return undefined;
  return tree.props?.['data-chat-tour'] === 'replay' ? tree : replayButton(tree.props?.children);
}

test('PageTour replay button calls the latest beforeStart before invite, never on an ordinary rerender', async t => {
  const view = fixture(pageCode);
  t.after(() => view.unmount());
  const first = { ...pageProps, onBeforeStart: () => view.calls.push('before-old') };
  view.render(view.exports.PageTour, first);
  assert.deepEqual(view.calls, [], 'mount must not interrupt chat playback');

  const updated = { ...pageProps, onBeforeStart: () => view.calls.push('before-new') };
  view.render(view.exports.PageTour, updated);
  const tree = view.render(view.exports.PageTour, updated);
  assert.deepEqual(view.calls, [], 'changing the callback or rerendering must not start or dispose a tour');
  assert.equal(view.runners.length, 1, 'rerender must keep the same runner');

  const button = replayButton(tree);
  assert(button);
  assert.equal(button.props.disabled, false);
  button.props.onClick();
  await flushPromises();
  assert.deepEqual(view.calls, ['before-new', 'invite']);
});

test('PageTour replay event reads the updated beforeStart ref without reinstalling its listener', async t => {
  const view = fixture(pageCode);
  t.after(() => view.unmount());
  view.render(view.exports.PageTour, { ...pageProps, onBeforeStart: () => view.calls.push('before-old') });
  const original = [...view.listeners.get(pageProps.eventName)];
  assert.equal(original.length, 1);

  view.render(view.exports.PageTour, { ...pageProps, onBeforeStart: () => view.calls.push('before-new') });
  assert.deepEqual(view.calls, [], 'callback replacement must not dispose or restart the runner');
  assert.deepEqual([...view.listeners.get(pageProps.eventName)], original);
  original[0]();
  await flushPromises();
  assert.deepEqual(view.calls, ['before-new', 'dispose', 'invite']);
});
