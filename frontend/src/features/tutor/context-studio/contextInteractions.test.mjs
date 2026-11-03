import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { defaultFlow, validateGraph, previewFlow, orderContextBlocks } from '../../../../../resources/tutor-flow/graph.mjs';

const require = createRequire(import.meta.url), cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const fixture = { exports: {} }; cache.set(file, fixture.exports);
  const code = ts.transpileModule(readFileSync(new URL(`./${file}.${file === 'ContextOrderInspector' ? 'tsx' : 'ts'}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function('require', 'exports', code)(name => name.startsWith('./') && !name.endsWith('.css') ? load(name.slice(2)) : name.endsWith('.css') ? { default: {} } : require(name), fixture.exports);
  return fixture.exports;
}
const order = load('contextOrder'), preview = load('tracePreview'), timeline = load('timelineModel'), editor = load('flowEditor');
const contextOf = graph => graph.nodes.find(node => node.type === 'context');
function legacyFlow() {
  const graph = defaultFlow(), serializer = graph.nodes.find(node => node.type === 'serialize');
  if (serializer) {
    const modelId = graph.edges.find(edge => edge.source === serializer.id).target;
    graph.edges = graph.edges.filter(edge => edge.source !== serializer.id).map(edge => edge.target === serializer.id ? { ...edge, target: modelId } : edge);
    graph.nodes = graph.nodes.filter(node => node.id !== serializer.id);
  }
  for (const node of graph.nodes.filter(node => node.type === 'context')) {
    delete node.data.inputs; delete node.data.mode;
    graph.edges = graph.edges.map(edge => edge.target === node.id ? { ...edge, targetHandle: 'in' } : edge);
    node.data.order = [...order.connectedContextIds(graph, node.id), '$request'];
  }
  return graph;
}

test('context order keeps configured request position and inserts omitted reachable blocks before it', () => {
  const graph = legacyFlow(), context = contextOf(graph), connected = order.connectedContextIds(graph, context.id);
  context.data.order = [connected[0], '$request'];
  const effective = order.effectiveContextOrder(graph, context);
  assert.deepEqual(effective, [...connected, '$request']);
  const moved = order.moveContextBlock(effective, '$request', -1);
  assert.equal(moved.at(-2), '$request'); assert.deepEqual(new Set(moved), new Set(effective));
  const blocks = connected.map(id => ({ id, kind: 'source', source: id, value: id }));
  assert.deepEqual(orderContextBlocks(blocks, [connected[0], '$request']).map(block => block.id), effective);
});
test('legacy order derives from incoming edge order through gates and compact without persisting on drag', () => {
  const graph = legacyFlow(), context = contextOf(graph); delete context.data.order;
  const first = order.effectiveContextOrder(graph, context);
  assert(first.includes(graph.nodes.find(node => node.type === 'source' && node.data.source === 'message_stream').id));
  assert(first.includes(graph.nodes.find(node => node.type === 'prompt').id)); assert.equal(first.at(-1), '$request');
  const moved = { ...graph, nodes: graph.nodes.map(node => ({ ...node, position: { x: node.position.x + 150, y: node.position.y - 25 } })) };
  assert.deepEqual(order.effectiveContextOrder(moved, contextOf(moved)), first);
  assert.equal(contextOf(order.syncContextOrders(moved)).data.order, undefined);
});
test('disconnect and delete clean stale tokens while preserving the remaining order and positions', () => {
  const graph = legacyFlow(), context = contextOf(graph), source = graph.nodes.find(node => node.type === 'source' && node.data.source === 'context_summary');
  context.data.order = ['$request', ...order.connectedContextIds(graph, context.id)];
  const disconnected = order.syncContextOrders({ ...graph, edges: graph.edges.filter(edge => edge.source !== source.id) });
  assert(!contextOf(disconnected).data.order.includes(source.id)); assert.equal(contextOf(disconnected).data.order[0], '$request');
  assert.deepEqual(disconnected.nodes.map(node => node.position), graph.nodes.map(node => node.position));
  const deleted = order.syncContextOrders({ ...graph, nodes: graph.nodes.filter(node => node.id !== source.id), edges: graph.edges.filter(edge => edge.source !== source.id && edge.target !== source.id) });
  assert.doesNotThrow(() => validateGraph(deleted)); assert(!contextOf(deleted).data.order.includes(source.id));
  assert(context.data.order.includes(source.id), 'original graph is immutable');
});
test('real context packet follows request reordered to the beginning and preserves block identities', async () => {
  const graph = legacyFlow(), context = contextOf(graph), ids = order.connectedContextIds(graph, context.id);
  context.data.order = ['$request', ...ids.reverse()];
  const result = await previewFlow(validateGraph(graph), { type: 'user.message', transcript: 'Привет' }, timeline.createTimelineExample(3));
  assert.deepEqual(result.packet.blocks.map(block => block.id), context.data.order);
  assert.equal(result.packet.blocks[0].kind, 'request');
});
test('order inspector pins mandatory prefix and persists moves without a remove action', () => {
  const { ContextOrderInspector } = load('ContextOrderInspector'), graph = legacyFlow(), node = contextOf(graph); let patch;
  const element = ContextOrderInspector({ graph, node, patch: data => { patch = data; } });
  const flatten = item => !item || typeof item !== 'object' ? [] : [item, ...[item.props?.children].flat(Infinity).flatMap(flatten)];
  const elements = flatten(element), buttons = elements.filter(item => item.type === 'button');
  assert.equal(buttons.length, node.data.order.length * 2);
  const upRequest = buttons.find(item => item.props['aria-label'] === 'Выше: Текущий запрос'); upRequest.props.onClick();
  assert.equal(patch.order.at(-2), '$request'); assert.deepEqual(new Set(patch.order), new Set(node.data.order));
  const { renderToStaticMarkup } = require('react-dom/server');
  const html = renderToStaticMarkup(element); assert(html.includes('Обязательные правила')); assert(html.includes('Блок параметров')); assert(!html.includes('Удалить'));
});
test('only message stream can feed count conditions or compact, and reconnection ignores its old edge for cycles', () => {
  const graph = legacyFlow(), journal = graph.nodes.find(node => node.type === 'source' && node.data.source === 'message_stream'), params = graph.nodes.find(node => node.type === 'source' && node.data.source === 'parameter_state'), gate = graph.nodes.find(node => node.type === 'condition'), compact = graph.nodes.find(node => node.type === 'compact');
  const wire = (source, target) => ({ source: source.id, target: target.id, sourceHandle: 'out', targetHandle: 'in' });
  const countEdge = graph.edges.find(edge => edge.source === journal.id && edge.target === gate.id);
  assert(!order.validFlowConnection(graph, wire(journal, gate)), 'duplicate wire is rejected');
  assert(order.validFlowConnection(graph, wire(journal, gate), countEdge.id)); assert(order.validFlowConnection(graph, wire(journal, compact)));
  assert(!order.validFlowConnection(graph, wire(params, gate))); assert(!order.validFlowConnection(graph, wire(params, compact)));
  const changed = { ...graph, nodes: graph.nodes.map(node => node.id === gate.id ? { ...node, data: { field: 'transcript', operator: 'contains', value: 'x' } } : node) };
  assert(!order.validFlowConnection(changed, wire(journal, gate)));
  const tiny = { nodes: [{ id: 'a', type: 'condition', data: {} }, { id: 'b', type: 'condition', data: {} }], edges: [{ id: 'old', source: 'a', target: 'b' }] };
  const reversed = { source: 'b', target: 'a', sourceHandle: 'true', targetHandle: 'in' };
  assert(!order.validFlowConnection(tiny, reversed)); assert(order.validFlowConnection(tiny, reversed, 'old'));
});
test('node hover shows only selected trace data and preserves truncated JSON as bounded text', () => {
  assert.equal(preview.nodeTracePreview('n', []).output, undefined);
  const running = { nodeId: 'n', status: 'running', inputPreview: '<script>example</script>', type: 'model', at: 1 };
  const truncated = '{"parts":' + 'x'.repeat(5000) + '…';
  const shown = preview.nodeTracePreview('n', [running, { ...running, status: 'completed', outputPreview: truncated, durationMs: 40 }]);
  assert.equal(shown.input.text, running.inputPreview); assert(shown.output.truncated); assert.equal(shown.output.text.length, 4001);
  const skipped = preview.nodeTracePreview('n', [{ ...running, status: 'skipped' }]); assert.equal(skipped.input, undefined); assert.equal(skipped.output, undefined);
  const failed = preview.nodeTracePreview('n', [running, { ...running, status: 'failed', error: 'provider failed' }]); assert.equal(failed.error, 'provider failed'); assert.equal(failed.output, undefined);
});
test('edge hover trusts top-level branch with truncated payload and hides opposite or unconfirmed branches', () => {
  const edge = { id: 'e', source: 'gate', target: 'compact', sourceHandle: 'true' }, event = { nodeId: 'gate', type: 'condition', status: 'completed', at: 1, outputPreview: '{"parts":…', observed: 21, branch: true };
  assert.equal(preview.edgeTracePreview(edge, [event]).output.text, event.outputPreview);
  assert.equal(preview.edgeTracePreview({ ...edge, sourceHandle: 'false' }, [event]).status, 'skipped'); assert.equal(preview.edgeTracePreview({ ...edge, sourceHandle: 'false' }, [event]).output, undefined);
  const unknown = { ...event }; delete unknown.branch;
  assert.equal(preview.edgeTracePreview(edge, [unknown]).status, 'unconfirmed'); assert.equal(preview.edgeTracePreview(edge, [unknown]).output, undefined);
  assert.equal(preview.edgeTracePreview(edge, [{ ...event, status: 'running' }]).output, undefined);
  assert.equal(preview.edgeTracePreview(edge, [{ ...event, branch: undefined, outputPreview: '{"branch":true}' }]).status, 'completed');
});
test('hover stays within mobile and desktop viewport and count uses authoritative top-level observed', () => {
  for (const viewport of [{ width: 320, height: 480 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) for (const anchor of [{ x: 0, y: 0 }, { x: viewport.width, y: viewport.height }]) {
    const rect = preview.clampPreview(anchor, { width: 380, height: 330 }, viewport);
    assert(rect.left >= 12 && rect.top >= 12); assert(rect.left + rect.width <= viewport.width - 12); assert(rect.top + 330 <= viewport.height - 12);
  }
  assert.equal(timeline.observedMessageCount([{ status: 'completed', observed: 21, outputPreview: '{"observed":4}' }]), 21);
  assert.equal(timeline.observedMessageCount([{ status: 'completed', observed: '22', outputPreview: '{"parts":…' }]), 22);
});

test('module ports and wires expose only their own real data and never invent skipped or truncated outputs', () => {
  const input = { in1: { parts: { context_summary: 'one' } }, in2: { parts: { context_summary: 'other' } } };
  const output = { outputs: { true: { parts: { selected: 'correct port' } }, out2: { parts: { selected: 'other port' } } } };
  const events = [{ nodeId: 'module', type: 'module', status: 'running', at: 1, inputPreview: JSON.stringify(input) }, { nodeId: 'module', type: 'module', status: 'completed', at: 2, outputPreview: JSON.stringify(output) }];
  assert.equal(preview.nodeTracePreview('module', events, 4000, { handleId: 'in1', direction: 'target' }).input.text, JSON.stringify(input.in1));
  assert.equal(preview.nodeTracePreview('module', events, 4000, { handleId: 'true', direction: 'source' }).output.text, JSON.stringify(output.outputs.true));
  const edge = { id: 'wire', source: 'module', target: 'context', sourceHandle: 'true' };
  assert.equal(preview.edgeTracePreview(edge, events).output.text, JSON.stringify(output.outputs.true));
  assert.equal(preview.edgeTracePreview({ ...edge, sourceHandle: 'absent' }, events).status, 'skipped');
  assert.equal(preview.edgeTracePreview(edge, [{ ...events[1], outputPreview: '{"outputs":…' }]).status, 'unconfirmed');
  assert.equal(preview.nodeTracePreview('module', [events[0]], 4000, { handleId: 'out2', direction: 'source' }).output, undefined);
});
test('real node change handler changes positions without rewriting an explicit partial order', () => {
  const js = ts.transpileModule(readFileSync(new URL('./ContextStudio.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const start = js.indexOf('function changeNodes('), end = js.indexOf('function validConnection(', start);
  const alias = /const (\w+) = require\("@xyflow\/react"\)/.exec(js)[1];
  const geometryAlias = /const (\w+) = require\("\.\/canvasGeometry"\)/.exec(js)[1];
  let graph = legacyFlow(); contextOf(graph).data.order = ['$request'];
  let geometry = {};
  const bindings = { [alias]: require('@xyflow/react'), [geometryAlias]: load('canvasGeometry'), flowEditor_1: editor, contextOrder_1: order, setSelectedNodes() {}, setSelectedEdges() {}, setGeometry: updater => { geometry = updater(geometry); }, setGraph: updater => { graph = updater(graph); } };
  const handlers = new Function(...Object.keys(bindings), `${js.slice(start, end)}; return { changeNodes, changeEdges };`)(...Object.values(bindings));
  handlers.changeNodes([{ type: 'position', id: graph.nodes[0].id, position: { x: 900, y: 120 } }]);
  assert.deepEqual(contextOf(graph).data.order, ['$request']); assert.deepEqual(graph.nodes[0].position, { x: 900, y: 120 });
  const saved = editor.fingerprint(graph);
  handlers.changeNodes([{ type: 'dimensions', id: graph.nodes[0].id, dimensions: { width: 248, height: 100 } }]);
  assert.deepEqual(geometry[graph.nodes[0].id].measured, { width: 248, height: 100 });
  assert.equal(editor.fingerprint(graph), saved);
});
