import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { defaultFlow, createModuleDefinition, validateGraph, validateModuleDefinition } from '../../../../../resources/tutor-flow/graph.mjs';

const require = createRequire(import.meta.url), cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const code = ts.transpileModule(readFileSync(new URL(`./${file}.ts`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'exports', code)(name => name.startsWith('./') ? load(name.slice(2)) : require(name), exports);
  return exports;
}
const { validFlowConnection } = load('contextOrder');
const { createModuleDraft, moduleDraftReducer: reduce, cleanModule } = load('moduleDraft');
const fingerprint = definition => JSON.stringify(cleanModule(definition));

test('editor permits serializer/module wiring supported by execution and enforces actual declared ports', () => {
  const graph = defaultFlow(), serializer = graph.nodes.find(node => node.type === 'serialize'), model = graph.nodes.find(node => node.type === 'model');
  const definition = createModuleDefinition();
  const input = definition.nodes.find(node => node.type === 'module_input'), output = definition.nodes.find(node => node.type === 'module_output');
  definition.nodes = [input, { id: 'encode', type: 'serialize', position: { x: 400, y: 0 }, data: { format: 'messages' } }, output];
  definition.edges = [
    { id: 'a', source: input.id, target: 'encode', sourceHandle: 'out', targetHandle: 'in' },
    { id: 'b', source: 'encode', target: output.id, sourceHandle: 'out', targetHandle: 'in' },
  ];
  assert.doesNotThrow(() => validateModuleDefinition(definition));
  const fragment = { nodes: definition.nodes, edges: [] };
  assert(validFlowConnection(fragment, definition.edges[0]), 'boundary input can feed a serializer');
  graph.nodes.push({ id: 'module', type: 'module', position: { x: 2000, y: 0 }, data: { definition } });
  graph.edges = graph.edges.filter(edge => !(edge.source === serializer.id && edge.target === model.id));
  const first = { id: 'to_module', source: serializer.id, target: 'module', sourceHandle: 'out', targetHandle: 'in1' };
  const second = { id: 'to_model', source: 'module', target: model.id, sourceHandle: 'out1', targetHandle: 'in' };
  assert(validFlowConnection(graph, first)); assert(validFlowConnection(graph, second));
  graph.edges.push(first, second); assert.doesNotThrow(() => validateGraph(graph));
  assert(!validFlowConnection(graph, { ...first, targetHandle: 'missing' }));
  const merge = graph.nodes.find(node => node.type === 'context'); merge.data.inputs = merge.data.inputs.slice(0, 1);
  assert(!validFlowConnection(graph, { source: 'module', sourceHandle: 'out1', target: merge.id, targetHandle: 'in8' }));
});

test('duplicate wires normalize default handles; reconnect ignores only the replaced edge', () => {
  const nodes = [{ id: 'a', type: 'context', data: {} }, { id: 'b', type: 'serialize', data: {} }];
  const graph = { nodes, edges: [{ id: 'old', source: 'a', target: 'b' }] };
  const wire = { source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in' };
  assert(!validFlowConnection(graph, wire)); assert(validFlowConnection(graph, wire, 'old'));
});

test('save response preserves edits made while request was pending and advances the baseline/version', async () => {
  let state = createModuleDraft(createModuleDefinition());
  const submitted = structuredClone(state.draft), generation = state.generation;
  const saved = { ...submitted, version: 1 };
  let respond; const request = new Promise(resolve => { respond = resolve; });
  const pending = request.then(definition => { state = reduce(state, { type: 'saved', submitted, generation, definition }); });
  state = reduce(state, { type: 'edit', update: current => ({ ...current, name: 'Edited during save', nodes: current.nodes.map(node => ({ ...node, position: { x: 17, y: 42 } })) }) });
  respond(saved); await pending;
  assert.equal(state.draft.name, 'Edited during save'); assert.equal(state.draft.nodes[0].position.x, 17);
  assert.equal(state.baseline, fingerprint(saved)); assert.notEqual(fingerprint(state.draft), state.baseline);
  assert.equal(state.draft.version, 1); assert.equal(state.saved, true);
  const next = { ...cleanModule(state.draft), version: 2 };
  state = reduce(state, { type: 'saved', submitted: state.draft, definition: next, generation });
  assert.equal(fingerprint(state.draft), state.baseline); assert.equal(state.draft.version, 2);
});

test('late save cannot switch modules or overwrite a deliberately reloaded version of the same module', () => {
  const original = createModuleDefinition(), other = createModuleDefinition({ id: 'another' });
  for (const opened of [original, other]) {
    let state = createModuleDraft(original, true), generation = state.generation;
    state = reduce(state, { type: 'load', definition: opened, saved: true });
    const loaded = state;
    state = reduce(state, { type: 'saved', submitted: original, definition: { ...original, version: 2 }, generation });
    assert.equal(state, loaded);
  }
});
