import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { defaultFlow, validateGraph, previewFlow } from '../../../../../resources/tutor-flow/graph.mjs';

const require = createRequire(import.meta.url), cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const fixture = { exports: {} }; cache.set(file, fixture.exports);
  const extension = ['MessageTimeline', 'NodeInspector', 'ContextOrderInspector', 'HandlerSourceLinks'].includes(file) ? 'tsx' : 'ts';
  new Function('require', 'exports', ts.transpileModule(readFileSync(new URL(`./${file}.${extension}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText)(name => name.startsWith('@/config/') ? { default: {} } : name.endsWith('.json') ? { default: require(name) } : name.startsWith('./') && !name.endsWith('.css') ? load(name.slice(2)) : name.endsWith('.css') ? { default: {} } : require(name), fixture.exports);
  return fixture.exports;
}
const timeline = load('timelineModel'), editor = load('flowEditor');
const flatten = element => !element || typeof element !== 'object' ? [] : [element, ...[element.props?.children].flat(Infinity).flatMap(flatten)];

test('21-reply fixture has 20 completed answers, in-flight user and appended task delta without changing snapshot', () => {
  const sources = timeline.createTimelineExample(21), stream = sources.message_stream;
  assert.equal(stream.filter(record => record.role === 'user').length, 21);
  assert.equal(stream.filter(record => record.role === 'assistant').length, 20);
  assert.equal(stream.at(-1).role, 'user');
  const stateIndex = stream.findIndex(record => record.metadata?.kind === 'state_delta');
  assert.equal(stream[stateIndex - 1].role, 'assistant');
  assert.equal(sources.parameter_state.task.completed, false);
  assert.deepEqual(timeline.stateChanges(stream[stateIndex]), [{ path: 'task.completed', value: true }]);
  assert(sources.parameter_state.task.text && sources.parameter_state.task.instructions && sources.parameter_state.task.lessonBlockId);
  assert(JSON.stringify(stream[stateIndex].metadata.changes).length < 80);
  assert.equal(stream[stateIndex].metadata.event_version, 1);
  assert(!JSON.stringify(sources.parameter_state.notes).includes('last_seen_at'));
  assert.equal(new Set(stream.map(record => record.id)).size, stream.length);
});
test('timeline preserves order, duplicate record IDs and long journal prefix while reporting malformed rows', () => {
  const stream = [{ id: 'same', role: 'user', text: 'first' + 'x'.repeat(25000) }, { id: 'same', role: 'assistant', text: 'second' }, { role: 'tool', text: 'third' }];
  const before = JSON.stringify(stream), result = timeline.readMessageStream(stream);
  assert.deepEqual(result.records.map(record => record.text), stream.map(record => record.text));
  assert.equal(JSON.stringify(stream), before); assert.equal(result.errors.length, 0);
  const invalid = timeline.readMessageStream([...stream, { role: 'unknown', text: 'bad' }]);
  assert.equal(invalid.records.length, 3); assert.match(invalid.errors[0], /Запись 4/);
  assert(timeline.parseSources('{').error); assert(timeline.parseSources('[]').error);
  assert.match(timeline.parseSources(' '.repeat(150001)).error, /не обрезано/);
});
test('zebra renders role badges, task delta and explicitly dry summary with escaped text', () => {
  const { renderToStaticMarkup } = require('react-dom/server'), { createElement } = require('react');
  const { MessageTimeline } = load('MessageTimeline'), sources = timeline.createTimelineExample(3);
  const nestedChanges = ['task.topic', 'task.text', 'task.instructions', 'task.lessonBlockId', 'task.format'].map(path => ({ path, value: 'Новое значение' }));
  const stream = [...sources.message_stream, { role: 'tool', text: '<script>bad()</script>' }, { role: 'system', text: 'Учебное резюме', metadata: { dryRun: true } }, { role: 'system', text: 'Изменены поля задания', metadata: { kind: 'state_delta', event_version: 1, changes: [...nestedChanges, { path: 'task', value: { topic: 'Новое задание', completed: false } }] } }];
  const html = renderToStaticMarkup(createElement(MessageTimeline, { stream }));
  for (const label of ['Ученик', 'Робот', 'Изменение состояния', 'Инструмент', 'без вызова модели']) assert(html.includes(label));
  assert(html.includes('&lt;script&gt;bad()&lt;/script&gt;')); assert(!html.includes('<script>bad()'));
  assert(html.indexOf('Учебная реплика 2') < html.indexOf('Ученик завершил учебное задание.'));
  for (const label of ['Задание выполнено', 'Тема задания', 'Текст задания', 'Инструкции к заданию', 'Блок урока', 'Формат задания']) assert(html.includes(label));
  assert(html.includes('>Да<')); assert(html.includes('Новое задание'));
});
test('compact and journal source limits are independent, optional compact is unique and text conditions stay valid', () => {
  const nodes = [
    { id: 'compact1', type: 'compact', position: { x: 0, y: 0 }, data: editor.initialData('compact') },
    { id: 'stream', type: 'source', position: { x: 0, y: 0 }, data: { source: 'message_stream', limitChars: 120000 } },
    { id: 'params', type: 'source', position: { x: 0, y: 0 }, data: { source: 'parameter_state', limitChars: 24000 } },
    { id: 'count', type: 'condition', position: { x: 0, y: 0 }, data: editor.conditionFieldPatch('user_message_count') },
  ];
  const graph = { version: 2, name: 'fixture', nodes, edges: nodes.map(node => ({ id: `e_${node.id}`, source: node.id, target: node.id })) };
  assert.deepEqual(editor.nodeIssues(graph, []), {});
  nodes[0].data.keepPairs = 11; nodes[2].data.limitChars = 24001;
  assert(editor.nodeIssues(graph, []).compact1.some(issue => issue.includes('keepPairs')));
  assert(editor.nodeIssues(graph, []).params.some(issue => issue.includes('limitChars')));
  nodes[3].data.operator = 'equals'; assert(editor.nodeIssues(graph, []).count.length);
  nodes.push({ ...nodes[0], id: 'compact2', data: { keepPairs: 5 } });
  assert(editor.nodeIssues(graph, []).compact2.some(issue => issue.includes('одного')));
});
test('inspector count field selects strict gt 20 and journal selects its 120000 limit', () => {
  const { NodeInspector } = load('NodeInspector'); let patch;
  const render = node => flatten(NodeInspector({ node, issues: [], events: [], patch: data => { patch = data; }, remove() {} }));
  const node = { id: 'check', type: 'condition', position: { x: 0, y: 0 }, data: editor.initialData('condition') };
  render(node).find(element => element.type === 'select' && element.props.value === 'transcript').props.onChange({ target: { value: 'user_message_count' } });
  assert.deepEqual(patch, { field: 'user_message_count', operator: 'gt', value: '20' });
  const controls = render({ ...node, data: patch });
  const operators = controls.find(element => element.type === 'select' && element.props.value === 'gt');
  assert.deepEqual(operators.props.children.map(option => option.props.value), ['gt']);
  render({ ...node, type: 'source', data: { source: 'recent_context', limitChars: 6000 } }).find(element => element.type === 'select').props.onChange({ target: { value: 'message_stream' } });
  assert.equal(patch.limitChars, 120000);
});
test('observed count comes only from actual completed trace, never inferred from test source or running status', () => {
  assert.equal(timeline.observedMessageCount([{ status: 'running', outputPreview: '{"observed":21}' }]), null);
  assert.equal(timeline.observedMessageCount([{ status: 'completed', outputPreview: '{"observed":21,"branch":true}' }]), 21);
  assert.equal(timeline.observedMessageCount([{ status: 'completed', outputPreview: '{"branch":true}' }]), null);
});
test('shared default executor skips compact at 20, folds task state at 21 and retains five pairs plus in-flight user', async () => {
  const graph = validateGraph(defaultFlow()), gate = graph.nodes.find(node => node.type === 'condition' && node.data.field === 'user_message_count'), compact = graph.nodes.find(node => node.type === 'compact');
  assert(gate && compact);
  for (const count of [20, 21]) {
    const sources = timeline.createTimelineExample(count);
    sources.parameter_state.task.text = 'т'.repeat(8000);
    const before = JSON.stringify(sources), baseTask = { ...sources.parameter_state.task };
    const result = await previewFlow(graph, { type: 'user.message', transcript: sources.message_stream.at(-1).text }, sources);
    const actual = result.trace.filter(event => event.nodeId === gate.id);
    assert.equal(timeline.observedMessageCount(actual), count);
    const compactEvent = result.trace.find(event => event.nodeId === compact.id && event.status !== 'running');
    assert.equal(compactEvent.status, count > 20 ? 'completed' : 'skipped');
    const stream = result.packet.parts.message_stream;
    assert.equal(stream.filter(record => record.role === 'user').length, count > 20 ? 6 : 20);
    assert.equal(stream.filter(record => record.role === 'assistant').length, count > 20 ? 5 : 19);
    assert.deepEqual(result.packet.parts.parameter_state.task, { ...baseTask, completed: count > 20 });
    assert.equal(stream.at(-1).role, 'user'); assert.equal(JSON.stringify(sources), before);
    if (count > 20) { assert.equal(JSON.parse(compactEvent.outputPreview).dryRun, true); assert.match(result.packet.parts.context_summary, /без модели/); }
  }
});
test('classic saved version without compact and new journal sources still validates', () => {
  const graph = defaultFlow();
  graph.nodes = graph.nodes.filter(node => ['event', 'context', 'model', 'tools', 'reply', 'speech'].includes(node.type));
  const context = graph.nodes.find(node => node.type === 'context');
  context.data = {};
  graph.edges = graph.nodes.filter(node => node.type === 'event').map((node, index) => ({ id: `legacy_event_${index}`, source: node.id, target: context.id }));
  const types = ['context', 'model', 'tools', 'reply', 'speech'];
  for (let i = 0; i < types.length - 1; i++) graph.edges.push({ id: `legacy_chain_${i}`, source: graph.nodes.find(node => node.type === types[i]).id, target: graph.nodes.find(node => node.type === types[i + 1]).id });
  assert.doesNotThrow(() => validateGraph(graph));
  assert.deepEqual(editor.nodeIssues(graph, Object.keys(JSON.parse(readFileSync(new URL('../../../config/tutor-reasoning.json', import.meta.url), 'utf8')))), {});
});
