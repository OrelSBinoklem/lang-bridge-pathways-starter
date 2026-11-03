import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const require = createRequire(import.meta.url), React = require('react');

test('a functional scheme renders an editable React Flow canvas with its bots, context ports and separate activation; opening only reads', async () => {
  const roles = ['examiner', 'exam_stt_primary', 'exam_stt_secondary'];
  const inputs = Array.from({ length: 8 }, (_, i) => ({ id: `in${i + 1}`, label: `Input ${i + 1}`, key: `part${i + 1}` }));
  const graph = { version: 1, name: 'Экзамены', nodes: roles.flatMap(role => [
    { id: `${role}_event`, type: 'event', position: { x: 0, y: 0 }, data: { role, title: 'Exam event' } },
    { id: `${role}_context`, type: 'context', position: { x: 100, y: 0 }, data: { role, inputs, order: inputs.map(p => p.id), mode: 'object' } },
    { id: `${role}_model`, type: 'model', position: { x: 500, y: 0 }, data: { role, title: role, model: 'gpt-5.4', reasoning: 'medium', maxOutputTokens: 14000 } },
  ]), edges: [] };
  const scheme = { id: 'exams', name: 'Экзамены', roles, versions: [], head: null, active: null, revision: 'fixture', default_graph: graph };
  const drafts = { exams: { graph, baseline: JSON.stringify(graph), revision: 'fixture', loaded: null } };
  let state = 0; const calls = [], effects = [];
  const react = { ...React, useState: initial => [state++ === 0 ? { exams: scheme } : state === 2 ? drafts : typeof initial === 'function' ? initial() : initial, () => {}], useEffect: effect => effects.push(effect), useRef: current => ({ current }) };
  const canvas = { setCenter() {}, fitView() {} };
  const noop = () => {};
  const meta = Object.fromEntries(['event', 'source', 'prompt', 'context', 'serialize', 'model', 'tools', 'reply'].map(kind => [kind, { label: kind, color: '#000', icon: 'pi-table' }]));
  const modules = {
    react, '@/lib/client-api': { clientApi: async (path, options) => { calls.push({ path, options }); return { data: { exams: scheme } }; } },
    '@/config/tutor-reasoning.json': { 'gpt-5.4': ['none', 'medium'] }, './flowEditor': { META: meta, errorText: String },
    './canvasGeometry': { updateCanvasGeometry: current => current }, './edgePresentation': { edgeFocus: () => ({ nodes: new Set(), edges: new Set() }), edgePresentation: () => ({}), portColour: () => '#111', PORT_COLOURS: ['#123456', '#234567', '#345678'] },
    './StudioEdge': { StudioEdge: () => null }, './LiveTracePanel': { LiveTracePanel: () => null }, './ReplaceGraphDialog': { ReplaceGraphDialog: () => null },
    './useTraceHover': { useTraceHover: () => ({ target: null, highlight: null, close: noop }) }, './TraceHoverCard': { TraceHoverCard: () => null },
    '@xyflow/react': { ReactFlowProvider: ({ children }) => children, useNodesInitialized: () => false, useReactFlow: () => canvas, useUpdateNodeInternals: () => noop,
      ReactFlow: props => React.createElement('div', { 'aria-label': props['aria-label'] }, props.nodes.map(n => React.createElement(props.nodeTypes[n.type], { key: n.id, id: n.id, data: n.data }))),
      Background: () => null, Controls: () => null, MiniMap: () => null, Handle: () => React.createElement('span'), Position: { Left: 'left', Right: 'right' }, MarkerType: { ArrowClosed: 'arrow' } },
  };
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL('./ServiceWorkflowStudio.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('require', 'exports', code)(name => name.endsWith('.css') ? { default: {} } : modules[name] ?? require(name), exports);
  const html = renderToStaticMarkup(React.createElement(exports.ServiceWorkflowStudio, { schemeId: 'exams', adminId: 5 }));
  assert(html.includes('Граф модуля Экзамены')); assert(html.includes('exam_stt_primary')); assert(html.includes('exam_stt_secondary'));
  assert(html.includes('Сохранить версию модуля')); assert(html.includes('Применить версию модуля')); assert(html.includes('Input 8'));
  assert(html.includes('Собрать запрос · бесплатно')); assert(!html.includes('Настройки и инструкции'));
  const dragged = { ...graph.nodes[0], position: { x: 42, y: 27 }, dragging: true, measured: { width: 200, height: 140 } };
  const serialized = exports.serviceNodesForStorage([dragged]);
  assert.deepEqual(Object.keys(serialized[0]).sort(), ['data', 'id', 'position', 'type']);
  assert.deepEqual(serialized[0].position, { x: 42, y: 27 });
  const eventGraph = { ...graph, nodes: [...graph.nodes,
    { id: 'p1', type: 'prompt', data: { text: 'For speaking, transcript_candidates are alternative recognition results' }, position: { x: 1, y: 1 } },
    { id: 'p2', type: 'prompt', data: { text: 'Reviewed visual evidence describes image requirements' }, position: { x: 1, y: 2 } },
    { id: 'src', type: 'source', data: { role: 'examiner_en' }, position: { x: 1, y: 3 } }],
    edges: ['p1', 'p2', 'src'].map(target => ({ id: target, source: 'examiner_event', target, sourceHandle: 'out', targetHandle: 'in' })) };
  const links = exports.eventConnections(eventGraph, 'examiner_event');
  assert.deepEqual(links.map(item => item.label), ['Экзамен отправлен на проверку', 'Экзамен отправлен на проверку', 'Экзамен отправлен на проверку']);
  assert.equal(new Set(links.map(item => item.colour)).size, 3);
  assert.deepEqual(exports.eventConnections({ ...eventGraph, edges: [...eventGraph.edges].reverse() }, 'examiner_event'), links);
  assert.equal(exports.canonicalEventConnection({ source: 's', target: 't', sourceHandle: 'event-link:p1', targetHandle: 'in' }).sourceHandle, 'out');
  const context = graph.nodes.find(node => node.id === 'examiner_context');
  const resized = exports.resizeServiceInputs(context, [], 12);
  assert.equal(resized.inputs.length, 12); assert.equal(resized.order.at(-1), 'in12');
  assert.equal(exports.resizeServiceInputs(context, [], 2).inputs.length, 2);
  assert.throws(() => exports.resizeServiceInputs(context, [{ target: context.id, targetHandle: 'in8' }], 2), /отключите линии/);
  assert.equal(context.data.inputs.length, 8);
  const cleanup = effects[0](); await Promise.resolve();
  assert.equal(calls.length, 1); assert.equal(calls[0].path, '/tutor/flows/workflows'); assert(!calls[0].options.method); cleanup();
});
