import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { defaultFlow, validateGraph, previewFlow } from '../../../../../resources/tutor-flow/graph.mjs';
const compiled = { exports: {} };
new Function('exports', ts.transpileModule(readFileSync(new URL('./flowEditor.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(compiled.exports);
const { cleanGraph, fingerprint, nodeIssues, mergeTrace, initialData, applyMutationState } = compiled.exports;
const timelineCompiled = { exports: {} };
new Function('exports', ts.transpileModule(readFileSync(new URL('./timelineModel.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(timelineCompiled.exports);
const require = createRequire(import.meta.url), uiFixtures = new Map();
function loadUiFixture(file) {
  if (uiFixtures.has(file)) return uiFixtures.get(file);
  const fixture = { exports: {} }; uiFixtures.set(file, fixture.exports);
  const code = ts.transpileModule(readFileSync(new URL(`./${file}.${['contextOrder', 'edgePresentation'].includes(file) ? 'ts' : 'tsx'}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function('require', 'exports', code)(name => name === './flowEditor' ? compiled.exports : name === './timelineModel' ? timelineCompiled.exports : name.startsWith('./') && !name.endsWith('.css') ? loadUiFixture(name.slice(2)) : name.endsWith('.css') ? { default: {} } : name.startsWith('@/config/') ? { default: {} } : require(name), fixture.exports);
  return fixture.exports;
}
const models = Object.keys(JSON.parse(readFileSync(new URL('../../../config/tutor-reasoning.json', import.meta.url), 'utf8')));

test('engine serialization preserves legacy omission and explicit native or LangGraph versions', () => {
  const legacy = defaultFlow(); delete legacy.engine;
  const original = fingerprint(legacy);
  assert(!Object.hasOwn(cleanGraph(legacy), 'engine'));
  assert(!Object.hasOwn(validateGraph(cleanGraph(legacy), { models }), 'engine'));
  for (const engine of ['native', 'langgraph']) {
    const draft = { ...legacy, engine };
    assert.equal(validateGraph(cleanGraph(draft), { models }).engine, engine);
    assert.notEqual(fingerprint(draft), original);
  }
  assert.equal(fingerprint(legacy), original);
  assert.throws(() => validateGraph({ ...legacy, engine: 'langflow' }, { models }));
});

test('engine selector changes only the draft and restoring legacy data restores its clean fingerprint', () => {
  const source = ts.createSourceFile('ContextStudio.tsx', readFileSync(new URL('./ContextStudio.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let selector;
  const visit = node => {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === 'select' && node.openingElement.attributes.properties.some(prop => prop.name?.getText(source) === 'aria-label' && prop.initializer?.text === 'Исполнитель графа')) selector = node;
    ts.forEachChild(node, visit);
  };
  visit(source); assert(selector);
  const attrs = selector.openingElement.attributes.properties;
  const expression = name => attrs.find(prop => prop.name?.getText(source) === name).initializer.expression.getText(source);
  const legacy = defaultFlow(); delete legacy.engine; let graph = structuredClone(legacy);
  const baseline = fingerprint(graph);
  assert.equal(new Function('graph', `return (${expression('value')});`)(graph), 'native');
  const handler = ts.transpileModule(`const handler = ${expression('onChange')};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const change = new Function('setGraph', `${handler}; return handler;`)(update => { graph = update(graph); });
  change({ target: { value: 'langgraph' } });
  assert.equal(graph.engine, 'langgraph'); assert.notEqual(fingerprint(graph), baseline);
  assert.deepEqual(graph.nodes, legacy.nodes); assert.deepEqual(graph.edges, legacy.edges);
  graph = structuredClone(legacy); assert.equal(fingerprint(graph), baseline);
  assert.match(selector.getText(source), /JavaScript · LangGraph\.js/);
});

test('editor serialization strips React Flow state and preserves all graph settings and handles', () => {
  const graph = defaultFlow(), original = fingerprint(graph);
  graph.nodes[0].selected = true; graph.nodes[0].measured = { width: 250, height: 110 };
  graph.edges[0].selected = true; graph.edges[0].markerEnd = { type: 'arrowclosed' };
  assert.equal(fingerprint(graph), original);
  assert.doesNotThrow(() => validateGraph(cleanGraph(graph), { models }));
  graph.nodes[0].position.x += 5; assert.notEqual(fingerprint(graph), original);
});
test('multiple sources and explicit condition branches round-trip through the real executor', async () => {
  const graph = defaultFlow();
  const condition = { id: 'test_condition', type: 'condition', position: { x: 200, y: -180 }, data: { field: 'transcript', operator: 'contains', value: 'грамматика' } };
  graph.nodes.push(condition);
  graph.edges.push({ id: 'test_in', source: 'event_0', target: condition.id, sourceHandle: 'out', targetHandle: 'in' }, { id: 'test_yes', source: condition.id, target: 'context', sourceHandle: 'true', targetHandle: 'in5' }, { id: 'test_no', source: condition.id, target: 'context', sourceHandle: 'false', targetHandle: 'in5' });
  const safe = validateGraph(cleanGraph(graph), { models });
  assert(safe.nodes.filter(n => n.type === 'source').length > 1);
  for (const transcript of ['грамматика', 'привет']) {
    const result = await previewFlow(safe, { type: 'user.message', transcript }, { important_notes: ['Учебные заметки'], current_page: '/course' });
    assert(result.trace.some(event => event.nodeId === condition.id && event.status === 'completed'));
    assert(result.trace.some(event => event.nodeId === 'reply' && event.status === 'completed'));
  }
});
test('inspector highlights every invalid node rather than only the first server error', () => {
  const graph = defaultFlow();
  const source = graph.nodes.find(n => n.type === 'source'); source.data.limitChars = 99;
  graph.nodes.find(n => n.type === 'model').data.maxOutputTokens = 99999;
  graph.nodes.find(n => n.type === 'tools').data.allowedCommands = ['bad command'];
  const issues = nodeIssues(graph, models);
  assert(issues[source.id].some(issue => issue.includes('limitChars')));
  assert(issues.model.some(issue => issue.includes('maxOutputTokens')));
  assert(issues.tools.length > 0);
  assert.throws(() => validateGraph(cleanGraph(graph), { models }));
});
test('disconnected new nodes and deleted mandatory nodes stay invalid', () => {
  const graph = defaultFlow();
  graph.nodes.push({ id: 'extra_source', type: 'source', position: { x: 1, y: 1 }, data: initialData('source') });
  assert.equal(nodeIssues(graph, models).extra_source.length, 2);
  graph.nodes = graph.nodes.filter(n => n.type !== 'tools');
  graph.edges = graph.edges.filter(e => e.source !== 'tools' && e.target !== 'tools');
  assert.throws(() => validateGraph(cleanGraph(graph), { models }));
});
test('incremental events and full snapshots retain transitions without duplicates or invented usage', () => {
  const running = { nodeId: 'model', type: 'model', status: 'running', at: '2026-10-28T00:00:00Z' };
  const completed = { ...running, status: 'completed', at: '2026-10-28T00:00:01Z', usage: { input_tokens: 50, output_tokens: 12 } };
  let events = mergeTrace([], [running]); events = mergeTrace(events, [completed]); events = mergeTrace(events, [running, completed]);
  assert.equal(events.length, 2); assert.deepEqual(events[1].usage, completed.usage); assert(!Object.hasOwn(events[0], 'usage'));
});

test('commands textarea retains Enter across re-render and normalizes only on blur', () => {
  const inspector = loadUiFixture('NodeInspector');
  let node = { id: 'tools', type: 'tools', position: { x: 0, y: 0 }, data: { allCommands: false, allowedCommands: ['commands.list'], maxSteps: 3 } };
  const findTextarea = element => {
    if (!element || typeof element !== 'object') return null;
    if (element.type === 'textarea') return element;
    return [element.props?.children].flat(Infinity).map(findTextarea).find(Boolean);
  };
  const render = () => findTextarea(inspector.NodeInspector({ node, issues: [], events: [], patch: data => { node = { ...node, data: { ...node.data, ...data } }; }, remove() {} }));
  render().props.onChange({ target: { value: 'commands.list\n' } });
  assert.equal(render().props.value, 'commands.list\n');
  render().props.onChange({ target: { value: 'commands.list\ngrammar.table.get_structure\n' } });
  assert.equal(render().props.value, 'commands.list\ngrammar.table.get_structure\n');
  render().props.onBlur({ target: { value: ' commands.list \n\n grammar.table.get_structure \n' } });
  assert.deepEqual(node.data.allowedCommands, ['commands.list', 'grammar.table.get_structure']);
  assert.doesNotThrow(() => validateGraph({ ...defaultFlow(), nodes: defaultFlow().nodes.map(n => n.id === 'tools' ? node : n) }, { models }));
});

test('POST state preserves save head, activation and null deactivation without a following GET', () => {
  const first = { id: 1, name: 'Первая', created_at: '2026-10-28T00:00:00Z', created_by: 7 };
  const original = { versions: [first], head_version_id: 1, active_version_id: 1, default_graph: defaultFlow() };
  const second = { id: 2, name: 'Вторая', created_at: '2026-10-28T00:01:00Z', created_by: 7, graph: defaultFlow() };
  const saved = applyMutationState(original, { head_version_id: 2, active_version_id: 1, version: second });
  assert.equal(saved.head_version_id, 2); assert.equal(saved.active_version_id, 1);
  assert.deepEqual(saved.versions.map(v => v.id), [2, 1]);
  assert.equal(saved.versions[0].name, 'Вторая'); assert(!('graph' in saved.versions[0]));
  assert.equal(original.head_version_id, 1); assert.equal(original.versions.length, 1);
  const activated = applyMutationState(saved, { head_version_id: 2, active_version_id: 2, version: second });
  assert.equal(activated.active_version_id, 2); assert.equal(activated.versions.length, 2);
  const rolledBack = applyMutationState(activated, { head_version_id: 2, active_version_id: 1, version: first });
  assert.equal(rolledBack.active_version_id, 1); assert.equal(rolledBack.head_version_id, 2);
  const deactivated = applyMutationState(rolledBack, { head_version_id: 2, active_version_id: null });
  assert.equal(deactivated.active_version_id, null); assert.equal(deactivated.head_version_id, 2);
  assert.equal(deactivated.default_graph, original.default_graph);
});

test('real save/activate/deactivate handlers apply POST state before failed GET and report successful mutation', async () => {
  const js = ts.transpileModule(readFileSync(new URL('./ContextStudio.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const start = js.indexOf('async function refreshAfterMutation('), end = js.indexOf('function changeNodes(', start);
  assert(start > 0 && end > start);
  for (const operation of ['save', 'activate', 'deactivate']) {
    const graph = defaultFlow(), version = { id: 2, name: graph.name, created_at: '2026-10-28T00:01:00Z' };
    let state = { versions: [], head_version_id: 1, active_version_id: 1, default_graph: graph };
    const result = { head_version_id: 2, active_version_id: operation === 'deactivate' ? null : operation === 'activate' ? 2 : 1, ...(operation !== 'deactivate' ? { version } : {}) };
    let error = '', reports = 0, loadedId = null, baseline = '', notice = '';
    const bindings = {
      client_api_1: { clientApi: async () => ({ data: result }) }, graph_mjs_1: { validateGraph }, flowEditor_1: compiled.exports, MODELS: models,
      ready: true, busy: false, dirty: false, graph, server: state, loadedId: 2,
      setBusy() {}, setError: text => { error = text; }, setNotice: text => { notice = text; },
      setServer: updater => { state = updater(state); }, setBaseline: value => { baseline = value; }, setGraph() {},
      setLoadedId: id => { loadedId = id; }, setVersionPick() {}, report: () => { reports++; },
      installGraph() {}, versionPick: '', mayReplace: () => true,
      refresh: async () => { assert.equal(state.head_version_id, 2); assert.equal(state.active_version_id, result.active_version_id); throw Error('GET unavailable'); },
    };
    const handlers = new Function(...Object.keys(bindings), `${js.slice(start, end)}; return { save, activation };`)(...Object.values(bindings));
    if (operation === 'save') await handlers.save(); else await handlers.activation(operation === 'deactivate');
    assert.equal(reports, 0, 'successful POST must not enter generic mutation failure reporting');
    assert.match(error, /успешно/); assert.match(error, /Список версий/); assert.match(error, /GET unavailable/);
    assert(notice.length > 0); assert.equal(state.active_version_id, result.active_version_id);
    if (operation === 'save') { assert.equal(loadedId, 2); assert.equal(baseline, fingerprint(graph)); }
  }
});

test('load/import/reset await the React confirmation, preserve cancelled drafts and skip prompts when clean', async () => {
  const js = ts.transpileModule(readFileSync(new URL('./ContextStudio.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  assert(!js.includes('window.confirm'));
  const tree = ts.createSourceFile('studio.js', js, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const names = ['mayReplace', 'answerReplacement', 'loadVersion', 'importGraph', 'restoreExample'], definitions = [];
  const visit = node => { if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) definitions.push(node.getText(tree)); ts.forEachChild(node, visit); };
  visit(tree); assert.equal(definitions.length, names.length);
  for (const operation of ['loadVersion', 'importGraph', 'restoreExample']) for (const dirty of [true, false]) for (const approve of [true, false]) {
    let shown = false, replaced = 0, requests = 0;
    const replacementResolve = { current: null }, graph = defaultFlow();
    const bindings = {
      dirty, replacementResolve, setReplaceRequested: value => { shown = value; }, versionPick: '1',
      client_api_1: { clientApi: async () => { requests++; return { data: { graph } }; } },
      graph_mjs_1: { validateGraph }, MODELS: models, server: { default_graph: graph },
      installGraph: () => { replaced++; }, setGraph: () => { replaced++; }, setBusy() {}, setError() {},
      setLoadedId() {}, setSelectedNodes() {}, setNotice() {}, requestAnimationFrame: callback => callback(), canvas: { fitView() {} },
      report: cause => { throw cause; },
    };
    const handlers = new Function(...Object.keys(bindings), `${definitions.join('\n')}; return { ${names.join(', ')} };`)(...Object.values(bindings));
    const pending = handlers[operation]({ size: 1, text: async () => JSON.stringify(graph) });
    await Promise.resolve(); await Promise.resolve();
    if (dirty) {
      assert.equal(shown, true, operation); assert.equal(replaced, 0, 'must not replace while waiting'); assert.equal(requests, 0, 'version GET must wait for confirmation');
      assert.equal(await handlers.mayReplace(), false, 'a second action must not replace the pending confirmation');
      handlers.answerReplacement(approve);
    } else assert.equal(shown, false, 'clean graph needs no confirmation');
    await pending;
    assert.equal(replaced, !dirty || approve ? 1 : 0, `${operation}: dirty=${dirty}, approve=${approve}`);
    assert.equal(shown, false); assert.equal(replacementResolve.current, null);
  }
});
