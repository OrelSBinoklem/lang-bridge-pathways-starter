import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { defaultFlow, validateGraph, previewFlow, upgradeVisualAssembly } from '../../../../../resources/tutor-flow/graph.mjs';

const require = createRequire(import.meta.url), cache = new Map();
const { jsx } = require('react/jsx-runtime');
const { renderToStaticMarkup } = require('react-dom/server');
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const fixture = { exports: {} }; cache.set(file, fixture.exports);
  const extension = ['ContextAssembly', 'ContextOrderInspector', 'NodeInspector', 'MessageTimeline', 'HandlerSourceLinks'].includes(file) ? 'tsx' : 'ts';
  const code = ts.transpileModule(readFileSync(new URL(`./${file}.${extension}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'exports', code)(name => {
    if (name === '@xyflow/react') return { Handle: props => jsx('span', { 'data-handle': props.id, 'aria-label': props['aria-label'], style: props.style }), Position: { Left: 'left' }, useUpdateNodeInternals: () => () => {} };
    if (name.endsWith('.css')) return { default: {} };
    if (name.endsWith('.json') && !name.startsWith('@/config/')) return { default: require(name) };
    if (name.startsWith('./')) return load(name.slice(2));
    if (name.startsWith('@/config/')) return { default: {} };
    return require(name);
  }, fixture.exports);
  return fixture.exports;
}
const editor = load('flowEditor'), order = load('contextOrder');
const flatten = element => !element || typeof element !== 'object' ? [] : [element, ...[element.props?.children].flat(Infinity).flatMap(flatten)];
const contextOf = graph => graph.nodes.find(node => node.type === 'context');

test('merge card renders eight named handles and editing labels, keys or order preserves edge handle identity', () => {
  const graph = defaultFlow(), node = contextOf(graph), originalEdges = structuredClone(graph.edges);
  const { ContextAssembly } = load('ContextAssembly');
  const html = renderToStaticMarkup(jsx(ContextAssembly, { graph, node, patch() {}, upgrade() {} }));
  assert.equal((html.match(/data-handle="in[1-8]"/g) || []).length, 8);
  assert.equal((html.match(/left:-24px/g) || []).length, 8);
  assert.equal((html.match(/<input /g) || []).length, 16);
  assert(!html.includes('<label>Подпись')); assert(!html.includes('<label>Ключ'));
  const { ContextOrderInspector } = load('ContextOrderInspector');
  const render = () => ContextOrderInspector({ graph, node, editInputs: true, compact: true, patch: data => Object.assign(node.data, data) });
  const keyInput = flatten(render()).find(item => item.props?.['aria-label'] === 'Ключ in2');
  keyInput.props.onChange({ target: { value: 'summary_custom' } });
  flatten(render()).find(item => item.props?.['aria-label'] === 'Подпись in2').props.onChange({ target: { value: 'Моя сводка' } });
  flatten(render()).find(item => item.props?.['aria-label'] === 'Выше: Моя сводка').props.onClick();
  assert.equal(node.data.order[0], 'in2'); assert.equal(node.data.inputs[1].key, 'summary_custom');
  assert.deepEqual(graph.edges, originalEdges);
  assert.deepEqual(editor.cleanGraph(graph).edges, originalEdges);
  assert.doesNotThrow(() => validateGraph(graph));
});

test('request ordering and empty port order survive disconnection while legacy stale node IDs are removed', () => {
  const graph = defaultFlow(), node = contextOf(graph);
  node.data.order = ['$request', ...editor.CONTEXT_PORTS.slice().reverse()];
  const disconnected = order.syncContextOrders({ ...graph, edges: graph.edges.filter(edge => edge.target !== node.id) });
  assert.deepEqual(contextOf(disconnected).data.order, node.data.order);
  const legacy = { id: 'legacy', type: 'context', position: { x: 0, y: 0 }, data: { order: ['removed', '$request'] } };
  assert.deepEqual(order.effectiveContextOrder({ nodes: [legacy], edges: [] }, legacy), ['$request']);
});

test('nested context and serialization wires validate without allowing cycles or invalid ports', () => {
  const graph = defaultFlow(), root = contextOf(graph), serializer = graph.nodes.find(node => node.type === 'serialize');
  const nested = { id: 'nested', type: 'context', position: { x: 1200, y: 500 }, data: editor.initialData('context') };
  const wire = graph.edges.find(edge => edge.target === root.id);
  graph.nodes.push(nested); wire.target = nested.id; wire.targetHandle = 'in2';
  const added = { id: 'nested_out', source: nested.id, target: root.id, sourceHandle: 'out', targetHandle: 'in8' };
  assert(order.validFlowConnection(graph, added)); graph.edges.push(added);
  assert.doesNotThrow(() => validateGraph(graph));
  assert(!editor.nodeIssues(graph, []).nested);
  assert(!order.validFlowConnection(graph, { ...added, source: root.id, target: nested.id }));
  assert(!order.validFlowConnection(graph, { ...added, targetHandle: 'in9' }));
  assert(!order.validFlowConnection(graph, { ...added, targetHandle: 'in' }));
  const existing = graph.edges.find(edge => edge.source === root.id && edge.target === serializer.id);
  const sameWire = { source: root.id, target: serializer.id, sourceHandle: 'out', targetHandle: 'in' };
  assert(!order.validFlowConnection(graph, sameWire), 'duplicate wire is rejected');
  assert(order.validFlowConnection(graph, sameWire, existing.id), 'reconnecting the same wire is permitted');
  assert(!order.validFlowConnection(graph, { source: serializer.id, target: nested.id, sourceHandle: 'out', targetHandle: 'in1' }));
});

test('real preview follows configured port order and output mode, then explicit serialization', async () => {
  for (const mode of ['object', 'text', 'json']) for (const format of ['messages', 'text', 'json']) {
    const graph = defaultFlow(), node = contextOf(graph);
    node.data.mode = mode; node.data.order = ['$request', ...editor.CONTEXT_PORTS.slice().reverse()];
    graph.nodes.find(node => node.type === 'serialize').data.format = format;
    const result = await previewFlow(validateGraph(graph), { type: 'user.message', transcript: 'Тест' }, { parameter_state: { task: { completed: false } }, message_stream: [] });
    assert.deepEqual(result.packet.bundle.entries.map(entry => entry.port), node.data.order);
    assert.equal(typeof result.packet.bundle.value, mode === 'object' ? 'object' : 'string');
    assert.equal(result.packet.serialization.format, format);
  }
});

test('MCP and serializer inspector settings are editable and validation rejects services, URLs and secrets outside contract', () => {
  const graph = defaultFlow(), mcp = { id: 'search', type: 'mcp', position: { x: 1, y: 1 }, data: editor.initialData('mcp') };
  graph.nodes.push(mcp); graph.edges.push({ id: 'search_in', source: 'event_0', target: mcp.id }, { id: 'search_out', source: mcp.id, target: contextOf(graph).id, targetHandle: 'in8' });
  const { NodeInspector } = load('NodeInspector');
  const render = node => NodeInspector({ graph, node, issues: [], events: [], patch: data => Object.assign(node.data, data), remove() {} });
  const select = flatten(render(mcp)).find(item => item.type === 'select'); select.props.onChange({ target: { value: 'grammar_table' } });
  assert.equal(mcp.data.service, 'grammar_table');
  mcp.data.tableKey = 'present_simple'; assert.doesNotThrow(() => validateGraph(graph));
  assert.equal(editor.nodeIssues(graph, []).search, undefined);
  mcp.data.url = 'https://example.test'; assert(editor.nodeIssues(graph, []).search); assert.throws(() => validateGraph(graph)); delete mcp.data.url;
  mcp.data.service = 'arbitrary'; assert(editor.nodeIssues(graph, []).search); delete mcp.data.service;
  const serializer = graph.nodes.find(node => node.type === 'serialize');
  flatten(render(serializer)).find(item => item.type === 'select').props.onChange({ target: { value: 'json' } }); assert.equal(serializer.data.format, 'json');
  const node = contextOf(graph); node.data.inputs[1].key = node.data.inputs[0].key; assert(editor.nodeIssues(graph, [])[node.id]);
});

test('MCP and serializer hover exposes actual selected trace only, with no invented pre-run output', () => {
  const preview = load('tracePreview');
  for (const type of ['mcp', 'serialize']) {
    assert.equal(preview.nodeTracePreview(type, []).status, 'not-run');
    const event = { nodeId: type, type, status: 'completed', at: 1, inputPreview: '{"query":"пример"}', outputPreview: '{"result":"<script>"}' };
    assert.equal(preview.nodeTracePreview(type, [event]).output.text, event.outputPreview);
    assert.equal(preview.edgeTracePreview({ id: 'out', source: type, target: 'context', sourceHandle: 'out', targetHandle: 'in8' }, [event]).output.text, event.outputPreview);
  }
});

test('reserved context keys fail both editor and shared validation, and MCP inspector explains provider billing', () => {
  for (const key of ['__proto__', 'constructor', 'prototype', 'current_request']) {
    const graph = defaultFlow(), node = contextOf(graph); node.data.inputs[0].key = key;
    assert(editor.nodeIssues(graph, [])[node.id]); assert.throws(() => validateGraph(graph));
  }
  const { NodeInspector } = load('NodeInspector');
  const node = { id: 'web', type: 'mcp', position: { x: 0, y: 0 }, data: { ...editor.initialData('mcp'), service: 'web_search' } };
  const html = renderToStaticMarkup(jsx(NodeInspector, { node, issues: [], events: [], patch() {}, remove() {} }));
  assert(html.includes('TAVILY_API_KEY')); assert(html.includes('отдельно на его аккаунте')); assert(html.includes('списание кредитов сайта для него пока не подключено'));
});

test('explicit visual upgrade keeps legacy draft immutable and preserves model settings before saving', () => {
  const legacy = defaultFlow(), root = contextOf(legacy), serializer = legacy.nodes.find(node => node.type === 'serialize');
  const downstream = legacy.edges.find(edge => edge.source === serializer.id).target;
  legacy.edges = legacy.edges.filter(edge => edge.source !== serializer.id).map(edge => edge.target === serializer.id ? { ...edge, target: downstream } : edge.target === root.id ? { ...edge, targetHandle: 'in' } : edge);
  legacy.nodes = legacy.nodes.filter(node => node.id !== serializer.id);
  root.data = { order: [...order.connectedContextIds(legacy, root.id), '$request'] };
  const before = editor.fingerprint(legacy), settings = structuredClone(legacy.nodes.find(node => node.type === 'model').data);
  const upgraded = upgradeVisualAssembly(legacy);
  assert.equal(editor.fingerprint(legacy), before); assert.notEqual(editor.fingerprint(upgraded), before);
  assert.deepEqual(upgraded.nodes.find(node => node.type === 'model').data, settings);
  assert.doesNotThrow(() => validateGraph(upgraded));
});
