import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const asUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const models = asUrl(compile(await readFile(new URL('./avatarModels.ts', import.meta.url), 'utf8')));
const source = compile(await readFile(new URL('./avatar-selection.ts', import.meta.url), 'utf8'))
  .replace("from './avatarModels'", `from '${models}'`);
let caseId = 0;

async function setup(t) {
  const original = globalThis.window;
  const values = new Map();
  const browser = new EventTarget();
  browser.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  globalThis.window = browser;
  t.after(() => { if (original === undefined) delete globalThis.window; else globalThis.window = original; });
  const store = await import(asUrl(`${source}\n// isolated store ${caseId++}`));
  const storage = (key, value, area = browser.localStorage) => {
    if (area === browser.localStorage) {
      if (key === null) values.clear();
      else if (value === null) values.delete(key);
      else values.set(key, value);
    }
    const event = new Event('storage');
    Object.assign(event, { key, newValue: value, storageArea: area });
    browser.dispatchEvent(event);
  };
  return { store, browser, values, storage };
}

test('only the three bundled models are accepted; absent and malformed preferences use the default', async t => {
  const { store, values } = await setup(t);
  for (const value of [null, '', '../model.vrm', 'https://example.com/model.vrm', '{}', 'missing']) {
    assert.equal(store.validateHumanAvatar(value), store.DEFAULT_HUMAN_AVATAR);
    if (value !== null) values.set(store.HUMAN_AVATAR_STORAGE_KEY, value);
    assert.equal(store.getHumanAvatarSelection(), store.DEFAULT_HUMAN_AVATAR);
  }
  for (const id of ['a', 'kiyori', 'mikami']) {
    store.setHumanAvatarSelection(id);
    assert.equal(store.getHumanAvatarSelection(), id);
    assert.equal(values.get(store.HUMAN_AVATAR_STORAGE_KEY), id);
  }
  store.setHumanAvatarSelection('not-a-model');
  assert.equal(store.getHumanAvatarSelection(), 'mikami');
});

test('all mounted consumers share selection and unsubscribe without affecting each other', async t => {
  const { store } = await setup(t);
  const first = [], second = [];
  const unsubscribe = store.subscribeHumanAvatarSelection(() => first.push(store.getHumanAvatarSelection()));
  const unsubscribeSecond = store.subscribeHumanAvatarSelection(() => second.push(store.getHumanAvatarSelection()));
  store.setHumanAvatarSelection('mikami');
  unsubscribe();
  store.setHumanAvatarSelection('kiyori');
  unsubscribeSecond();
  assert.deepEqual(first, ['mikami']);
  assert.deepEqual(second, ['mikami', 'kiyori']);
});

test('other tabs synchronize valid selection, deletion, invalid data and clear; unrelated storage is ignored', async t => {
  const { store, storage } = await setup(t);
  const seen = [];
  const unsubscribe = store.subscribeHumanAvatarSelection(() => seen.push(store.getHumanAvatarSelection()));
  t.after(unsubscribe);
  const key = store.HUMAN_AVATAR_STORAGE_KEY;
  storage(key, 'mikami');
  storage('other-setting', 'kiyori');
  storage(key, 'kiyori', {});
  assert.deepEqual(seen, ['mikami']);
  storage(key, 'invalid');
  storage(key, 'kiyori');
  storage(key, null);
  storage(null, null);
  assert.deepEqual(seen, ['mikami', 'a', 'kiyori', 'a', 'a']);
});

test('selection remains usable when writes fail even if reads still work, and when all storage is blocked', async t => {
  const { store, browser, values } = await setup(t);
  const warn = console.warn;
  console.warn = () => {};
  t.after(() => { console.warn = warn; });
  values.set(store.HUMAN_AVATAR_STORAGE_KEY, 'a');
  browser.localStorage.setItem = () => { throw new Error('quota exceeded'); };
  store.setHumanAvatarSelection('mikami');
  assert.equal(store.getHumanAvatarSelection(), 'mikami');
  browser.localStorage.getItem = () => { throw new Error('storage blocked'); };
  store.setHumanAvatarSelection('kiyori');
  assert.equal(store.getHumanAvatarSelection(), 'kiyori');
});

test('a restored saved choice remains selected if storage becomes unreadable', async t => {
  const { store, browser, values } = await setup(t);
  values.set(store.HUMAN_AVATAR_STORAGE_KEY, 'mikami');
  assert.equal(store.getHumanAvatarSelection(), 'mikami');
  browser.localStorage.getItem = () => { throw new Error('storage blocked'); };
  assert.equal(store.getHumanAvatarSelection(), 'mikami');
});

test('server snapshot is safe without browser globals', async t => {
  const { store } = await setup(t);
  delete globalThis.window;
  assert.equal(store.getHumanAvatarSelection(), store.DEFAULT_HUMAN_AVATAR);
  assert.doesNotThrow(() => store.setHumanAvatarSelection('mikami'));
});
