import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { defaultFlow, validateGraph } from '../../../../../resources/tutor-flow/graph.mjs';

const require = createRequire(import.meta.url), root = dirname(fileURLToPath(import.meta.url));
function loader(overrides = {}) {
  const cache = new Map();
  return function load(path) {
    const absolute = resolve(root, path);
    if (cache.has(absolute)) return cache.get(absolute);
    const fixture = { exports: {} }; cache.set(absolute, fixture.exports);
    const code = ts.transpileModule(readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    new Function('require', 'exports', code)(name => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name.endsWith('.css')) return { default: {} };
      if (name.startsWith('@/')) name = resolve(root, '../../../', name.slice(2));
      else if (name.startsWith('.')) name = resolve(dirname(absolute), name);
      else return require(name);
      if (extname(name) === '.json') return require(name);
      if (!extname(name)) name = ['.ts', '.tsx'].map(extension => name + extension).find(existsSync);
      return load(name);
    }, fixture.exports);
    return fixture.exports;
  };
}
const load = loader(), settings = load('./presetSettings.ts'), editor = load('./flowEditor.ts');
const presets = load('../tutorPresets.ts'), tts = load('../tutorTts.ts');
function rawData() {
  return { commission_percent: 22, presets: Object.fromEntries(presets.PRESET_IDS.map(id => [id, {
    config: { tutorModel: 'gpt-6-luna', reasoningEnabled: true, reasoningEffort: 'low', maxOutputTokens: 1800 },
    scenario: { callsPerAct: '1.2500', dialogueActs: 17 }, loadedScenario: [],
  }])) };
}

test('preset editing merges full defaults while saving raw pricing scenarios without normalization or mutation', () => {
  const data = rawData(), before = JSON.stringify(data);
  const draft = settings.createPresetDraft('economy', data);
  draft.config = settings.patchPresetConfig(draft.config, 'primaryTranscriptionLanguage', 'uk');
  draft.config = settings.patchPresetConfig(draft.config, 'dualTranscriptionEnabled', true);
  const payload = settings.presetSavePayload(draft);
  assert.equal(payload.config.primaryTranscriptionLanguage, 'uk'); assert.equal(payload.config.dualTranscriptionEnabled, true);
  for (const key of Object.keys(presets.defaultPresetConfig('economy'))) assert(Object.hasOwn(payload.config, key));
  assert.deepEqual(payload.scenario, data.presets.economy.scenario); assert.deepEqual(payload.loadedScenario, []);
  assert.equal(payload.scenario.callsPerAct, '1.2500'); assert.equal(JSON.stringify(data), before);
  assert.equal(settings.STUDIO_PRESET_NAMES.standard, presets.presetName('standard'));
});

test('background updates keep an administrator draft intact, mark it stale, and leave saved preview values separate', () => {
  const data = rawData(), draft = settings.createPresetDraft('standard', data);
  draft.config.tutorModel = 'gpt-6.1-terra';
  assert.equal(settings.resolvedPresetConfig('standard', data).tutorModel, 'gpt-6-luna');
  const refreshed = structuredClone(data); refreshed.presets.standard.config.maxOutputTokens = 2600;
  assert(settings.presetDraftStale(draft, refreshed)); assert.equal(draft.config.maxOutputTokens, 1800);
  assert.equal(draft.config.tutorModel, 'gpt-6.1-terra');
  const other = structuredClone(data); other.presets.economy.config.maxOutputTokens = 700;
  assert(!settings.presetDraftStale(draft, other));
});

test('model and TTS changes choose supported reasoning and a voice from the model own catalog', () => {
  let config = settings.createPresetDraft('standard', rawData()).config;
  config = settings.patchPresetConfig(config, 'reasoningEffort', 'none'); assert.equal(config.reasoningEnabled, false);
  config = settings.patchPresetConfig(config, 'tutorModel', 'gpt-6.1-sol'); assert.equal(config.reasoningEnabled, true); assert.notEqual(config.reasoningEffort, 'none');
  config = settings.patchPresetConfig(config, 'tutorModel', 'gpt-4.1'); assert.equal(config.reasoningEffort, 'none'); assert.equal(config.reasoningEnabled, false);
  for (const model of tts.tutorTtsCatalog.models) {
    config = settings.patchPresetConfig(config, 'ttsModel', model.id);
    assert(model.voices.includes(config.ttsVoice));
  }
});

test('preset hook fetches raw data without a write and explicit save PUT publishes the full successful response', async () => {
  const data = rawData(), calls = [], updates = [], effects = [], cleanups = [];
  const target = new EventTarget(); target.addEventListener('lbp:tutor-presets-updated', event => updates.push(event.detail));
  const previous = globalThis.window; globalThis.window = target;
  const fakeReact = { useState: initial => [initial, () => {}], useRef: value => ({ current: value }), useCallback: callback => callback, useEffect: effect => effects.push(effect) };
  const hook = loader({ react: fakeReact, '@/lib/client-api': { clientApi: async (path, options) => { calls.push({ path, options }); return { data }; } } })('./useStudioPresets.ts');
  try {
    const state = hook.useStudioPresets(); effects.forEach(effect => cleanups.push(effect())); await Promise.resolve();
    assert.deepEqual(calls.map(call => call.path), ['/tutor/presets']); assert.equal(updates.length, 0);
    const draft = settings.createPresetDraft('economy', data); draft.config.maxOutputTokens = 1300;
    assert.equal(await state.save(draft), data); assert.equal(calls[1].path, '/tutor/presets/economy'); assert.equal(calls[1].options.method, 'PUT');
    assert.deepEqual(JSON.parse(calls[1].options.body), settings.presetSavePayload(draft)); assert.deepEqual(updates, [data]);
  } finally { cleanups.forEach(cleanup => cleanup?.()); globalThis.window = previous; }
});

test('preset editor renders global impact and STT/TTS/memory fields without making a save request', () => {
  const { jsx } = require('react/jsx-runtime'), { renderToStaticMarkup } = require('react-dom/server'); let saves = 0;
  const { PresetEditor } = load('./PresetEditor.tsx');
  const html = renderToStaticMarkup(jsx(PresetEditor, { id: 'standard', data: rawData(), save: () => { saves++; }, close() {} }));
  assert.equal(saves, 0); assert(html.includes('Сохранение сразу изменит реальный тариф'));
  for (const label of ['Основная модель', 'Модель второго потока', 'Голос выбранной модели', 'Модель резюме', 'Эмбеддинги сообщений', 'Глобальный верхний предел']) assert(html.includes(label));
  assert.match(html, /type="submit"[^>]*disabled/);
});

test('model inspector resolves tariff references from saved config without writing them into graph fields', () => {
  const { jsx } = require('react/jsx-runtime'), { renderToStaticMarkup } = require('react-dom/server');
  const { NodeInspector } = load('./NodeInspector.tsx'), graph = defaultFlow(), before = editor.fingerprint(graph);
  const tariff = { id: 'economy', name: 'Эконом', config: settings.resolvedPresetConfig('economy', rawData()) };
  const html = renderToStaticMarkup(jsx(NodeInspector, { graph, node: graph.nodes.find(node => node.type === 'model'), tariff, issues: [], events: [], patch() { assert.fail('read-only resolved value must not patch the graph'); }, remove() {} }));
  assert(html.includes('$tariff.tutorModel')); assert(html.includes('$tariff.reasoningEffort')); assert(html.includes('readOnly="" value="gpt-6-luna"'));
  assert.equal(editor.fingerprint(graph), before);
});

test('checkpoint controls expose the exact next node and block uncertain paid resumption', () => {
  const { jsx } = require('react/jsx-runtime'), { renderToStaticMarkup } = require('react-dom/server');
  const { ExecutionControls } = load('./ExecutionControls.tsx'); let resumed = 0;
  const run = { id: 'fixture', name: 'Test', live: true, started: '', events: [], done: true, paused: true, fixture: {},
    checkpoint: { id: 'checkpoint', completed: 5, uncertain: [], bytes: 1048576, limitBytes: 4194304, next: ['model'] } };
  const props = { graph: defaultFlow(), pauseBefore: 'model', onPauseBefore() {}, run, running: false, onResume() { resumed++; } };
  const html = renderToStaticMarkup(jsx(ExecutionControls, props));
  assert(html.includes('Модель · model')); assert(html.includes('Дальше: model')); assert(html.includes('1.00 / 4 МБ'));
  assert(html.includes('Продолжить сохранённый тест')); assert(html.includes('за кредиты')); assert.equal(resumed, 0);
  const uncertain = renderToStaticMarkup(jsx(ExecutionControls, { ...props, run: { ...run, checkpoint: { ...run.checkpoint, uncertain: ['model'] } } }));
  assert(uncertain.includes('Автоматического повтора')); assert.match(uncertain, /disabled=""[^>]*>Продолжить сохранённый тест/);
});

test('actual studio WebSocket sends each selected test preset after authentication without embedding global drafts', async () => {
  const source = ts.transpileModule(readFileSync(resolve(root, 'ContextStudio.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const ast = ts.createSourceFile('studio.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS); let definition;
  const visit = node => { if (ts.isFunctionDeclaration(node) && node.name?.text === 'testFlow') definition = node.getText(ast); ts.forEachChild(node, visit); }; visit(ast); assert(definition);
  for (const previewPreset of presets.PRESET_IDS) {
    const sent = [], sockets = []; let runs = [];
    class FakeSocket { static OPEN = 1; readyState = 1; constructor() { sockets.push(this); } send(value) { sent.push(JSON.parse(value)); } }
    const bindings = { previewPreset, pauseBefore: '', graph: defaultFlow(), MODELS: [], active: { current: null }, ready: true, sourceText: '{}', testType: 'user.message', transcript: 'Пример', currentPage: '/course', dirty: false, loadedId: 5,
      graph_mjs_1: { validateGraph }, flowEditor_1: editor, client_api_1: { clientApi: async () => ({ ticket: 'fixture' }) }, tutor_config_1: { resolveTutorWsUrl: () => 'ws://fixture' },
      WebSocket: FakeSocket, AbortController, uid: () => 'run', setError() {}, setRunning() {}, setRunPick() {}, setTestTab() {}, setRuns: update => { runs = update(runs); }, setTimeout: () => 1, clearTimeout() {}, report: cause => { throw cause; }, finishRun() {}, updateRun() {} };
    const run = new Function(...Object.keys(bindings), `${definition}; return testFlow;`)(...Object.values(bindings));
    await run(false); const socket = sockets.at(-1); assert.equal(sent.length, 0); socket.onopen(); socket.onmessage({ data: JSON.stringify({ type: 'session.ready' }) });
    const message = sent.find(value => value.type === 'flow.test'); assert.equal(message.preset, previewPreset); assert.equal(message.live, false); assert(!Object.hasOwn(message, 'config'));
    assert.equal(runs[0].preset, previewPreset);
  }
});
