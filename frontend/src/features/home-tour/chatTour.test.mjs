import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(new URL('../../../package.json', import.meta.url));
const ts = require('typescript');
const source = JSON.parse(await readFile(new URL('../../../../resources/tour/chat-tour.json', import.meta.url), 'utf8'));
const code = ts.transpileModule(await readFile(new URL('./chatTourSteps.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;

test('chat guide reads visible controls and never invokes microphone, AI or preset commands', () => {
  const selectors = [], exports = {};
  const visible = { getBoundingClientRect: () => ({ width: 100, height: 40 }), click: () => assert.fail('guide clicked a control') };
  vm.runInNewContext(code, { exports, require: name => {
    assert(name.endsWith('chat-tour.json')); return source;
  }, document: { querySelectorAll: selector => { selectors.push(selector); return [visible]; } } });
  const definition = exports.CHAT_TOUR;
  assert.equal(definition.cookie, 'lbp_chat_tour');
  assert.equal(definition.steps.length, 13);
  assert.equal(definition.beforeStep, undefined);
  for (const step of definition.steps) {
    if (step.targets) assert.deepEqual([...step.targets()], [visible]);
    for (const lang of ['ru', 'uk']) assert(definition.text(step.key, lang));
  }
  for (const selector of selectors) assert.match(selector, /^\[data-(?:chat-tour|tour)=/);
});

test('tour blocks a real chat submission and recording, then restores normal submission', async () => {
  const text = await readFile(new URL('../tutor/FloatingTutorAssistant.tsx', import.meta.url), 'utf8');
  const file = ts.createSourceFile('tutor.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let submit, ready;
  const walk = node => {
    if (ts.isJsxAttribute(node) && node.name.getText(file) === 'onSubmit') submit = node.initializer.expression.getText(file);
    if (ts.isJsxAttribute(node) && node.name.getText(file) === 'ready' && node.initializer.expression.getText(file).includes('chatTourActive')) ready = node.initializer.expression.getText(file);
    ts.forEachChild(node, walk);
  };
  walk(file);
  assert(submit && ready);
  for (const active of [true, false]) {
    const sent = [], prevented = [];
    const context = { chatTourActive: active, input: 'kept draft', sendText: value => sent.push(value), event: { preventDefault: () => prevented.push(true) } };
    vm.runInNewContext(`(${submit})(event)`, context);
    assert.equal(prevented.length, 1);
    assert.deepEqual(sent, active ? [] : ['kept draft']);
    assert.equal(vm.runInNewContext(ready, { chatTourActive: active, presets: { ready: true }, testMode: false, status: 'ready', micTesting: false,
      conversationLoading: false, browserSpeechState: 'idle', usesBrowserStt: false }), !active);
  }
});

test('guide speech-bubble clicks do not activate the chat outside-click closer', async () => {
  const text = await readFile(new URL('../tutor/FloatingTutorAssistant.tsx', import.meta.url), 'utf8');
  const file = ts.createSourceFile('tutor.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let effect;
  const walk = node => {
    if (ts.isCallExpression(node) && node.expression.getText(file) === 'useEffect' && node.arguments[0].getText(file).includes('function handleOutsidePointerDown')) effect = node.arguments[0].getText(file);
    ts.forEachChild(node, walk);
  };
  walk(file);
  assert(effect);
  const code = ts.transpileModule(`const mount = ${effect}; mount();`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  for (const active of [false, true]) {
    const listeners = [];
    vm.runInNewContext(code, { open: true, settingsOpen: false, chatTourActive: active, document: { addEventListener: type => listeners.push(type) } });
    assert.deepEqual(listeners, active ? [] : ['mousedown', 'touchstart']);
  }
});
