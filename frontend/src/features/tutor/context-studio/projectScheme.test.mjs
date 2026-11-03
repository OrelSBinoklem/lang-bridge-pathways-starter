import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
const contract = JSON.parse(readFileSync(new URL('../../../../../resources/ai-studio/project.json', import.meta.url)));
const fixture = { exports: {} };
const compile = file => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
new Function('require', 'exports', compile('./projectScheme.ts'))(name => name.endsWith('/project.json') ? contract : require(name), fixture.exports);
const model = fixture.exports;
const geometryFixture = { exports: {} };
new Function('require', 'exports', compile('./canvasGeometry.ts'))(require, geometryFixture.exports);
const blocksFixture = { exports: {} };
new Function('require', 'exports', compile('./projectBlocks.ts'))(name => name === './projectScheme' ? model : require(name), blocksFixture.exports);
const graph = () => ({ version: 2, name: 'Главная схема проекта', modules: contract.modules.map(({ id, position }) => ({ id, position: { ...position }, expanded: false })) });

test('modules retain original executor bindings and declared ports match unchanged project channels', () => {
  for (const module of contract.modules) {
    assert.equal(module.kind, 'application');
    assert.deepEqual(module.binding, { engine: module.id === 'tutor' ? 'tutor_flow' : 'service_workflow', key: module.id });
    assert.deepEqual(module.inputs.map(p => p.id), contract.connections.filter(e => e.target === module.id).map(e => e.id));
    assert.deepEqual(module.outputs.map(p => p.id), contract.connections.filter(e => e.source === module.id).map(e => e.id));
  }
});

test('one module expands without changing bot data or other module views; both layout positions persist independently', () => {
  const original = graph(), expanded = model.expandProjectModule(original, 'tutor', true);
  assert.equal(expanded.modules[0].expanded, true); assert(expanded.modules.slice(1).every(m => !m.expanded));
  assert.equal(original.modules[0].expanded, false); assert.deepEqual(model.projectChannels(expanded), model.projectChannels(original));
  const moved = model.moveProjectModules(expanded, [{ type: 'position', id: 'tutor', position: { x: 37, y: 93 } }], true);
  assert.deepEqual(moved.modules[0].position, original.modules[0].position); assert.deepEqual(moved.modules[0].detailPosition, { x: 37, y: 93 });
  assert.equal(model.expandProjectModule(moved, 'unknown', true), moved);
  assert.equal(model.expandProjectModule(moved, 'tutor', true), moved);
  assert.deepEqual(model.expandProjectModule(moved, 'tutor', false).modules[0].detailPosition, { x: 37, y: 93 });
});

test('project graph exposes six working modules with actual event/request/result/storage channels', () => {
  const ids = contract.modules.map(module => module.id);
  assert.deepEqual(new Set(ids), new Set(['tutor', 'exams', 'english_exams', 'translation', 'memory', 'references']));
  const channels = model.projectChannels(graph());
  assert.equal(channels.length, contract.connections.length);
  assert.equal(new Set(channels.map(edge => edge.id)).size, channels.length);
  assert(channels.some(edge => edge.source === 'tutor' && edge.target === 'memory' && edge.channel === 'request'));
  assert(channels.some(edge => edge.source === 'memory' && edge.target === 'tutor' && edge.channel === 'result'));
  assert(!channels.some(edge => [edge.source, edge.target].includes('english_exams') && [edge.source, edge.target].includes('references')));
  for (const edge of channels) assert(existsSync(new URL('../../../../../' + edge.handler, import.meta.url)), edge.handler);
});

test('outgoing channels are distinguishable and keep their port/wire colour in subset schemes', () => {
  for (const source of new Set(contract.connections.map(edge => edge.source))) {
    const outputs = contract.connections.filter(edge => edge.source === source);
    const colours = outputs.map(edge => model.projectConnectionColour(edge));
    assert.equal(new Set(colours).size, outputs.length, source);
    for (const edge of outputs) assert.match(model.projectConnectionColour(edge), /^#[0-9a-f]{6}$/);
  }
  for (const edge of model.projectChannels(model.addProjectModule({ ...graph(), modules: [] }, 'english_exams'))) {
    assert.equal(model.projectConnectionColour(edge), model.projectConnectionColour(contract.connections.find(item => item.id === edge.id)));
  }
});

test('a new scheme connects only its present modules and never adds nonexistent bots', () => {
  const empty = { ...graph(), modules: [] };
  assert.deepEqual(model.projectChannels(empty), []);
  const one = model.addProjectModule(empty, 'english_exams');
  assert.deepEqual(one.modules.map(module => module.id), ['english_exams']);
  assert.deepEqual(model.projectChannels(one).map(edge => edge.id), ['english_exam_event', 'english_exam_store']);
  assert.equal(model.addProjectModule(one, 'english_exams'), one);
  assert.equal(model.addProjectModule(one, 'unknown'), one);
  assert.deepEqual(empty.modules, []);
});

test('dragging saves only module coordinates, ignoring measured/selected/anchor changes', () => {
  const original = graph();
  assert.equal(model.moveProjectModules(original, [{ id: 'tutor', type: 'select', selected: true }, { id: 'events', type: 'position', position: { x: 1, y: 1 } }, { type: 'add' }]), original);
  const moved = model.moveProjectModules(original, [{ id: 'tutor', type: 'position', position: { x: -10, y: 900 }, dragging: true, measured: { width: 30 } }]);
  assert.deepEqual(moved.modules[0], { id: 'tutor', position: { x: -10, y: 900 }, expanded: false });
  assert.deepEqual(original.modules[0].position, contract.modules[0].position);
  assert.deepEqual(model.projectChannels(moved), model.projectChannels(original));
});

test('main project renders real module links and opening the view does not mutate or call providers', async () => {
  const document = { id: 'main', version: 0, revision: 'fixture', graph: graph() };
  const catalogue = { contract, schemes: [document], modules: Object.fromEntries(contract.modules.map(module => [module.id, { nodes: 12, edges: 14, active: 3, models: ['fixture'] }])) };
  let index = 0; const effects = [], calls = [], opened = [], renderedNodes = [];
  const mockReact = { ...React, useState: initial => [index++ === 0 ? catalogue : index === 2 ? { main: { graph: document.graph, baseline: JSON.stringify(document.graph), revision: document.revision } } : typeof initial === 'function' ? initial() : initial, () => {}], useRef: current => ({ current }), useEffect: effect => effects.push(effect) };
  const xyflow = { useUpdateNodeInternals: () => () => {}, useReactFlow: () => ({ fitView() {} }), ReactFlowProvider: ({ children }) => children, ReactFlow: props => { renderedNodes.push(...props.nodes); return React.createElement('div', { 'aria-label': props['aria-label'] }, props.nodes.map(node => React.createElement(props.nodeTypes[node.type], { key: node.id, id: node.id, data: node.data }))); }, Background: () => null, Controls: () => null, Handle: () => null, Position: { Left: 'left', Right: 'right' }, MarkerType: { ArrowClosed: 'arrow' } };
  const compiled = { exports: {} };
  new Function('require', 'exports', compile('./ProjectSchemeCanvas.tsx'))(name => name === 'react' ? mockReact : name === '@xyflow/react' ? xyflow : name === './projectScheme' ? model : name === './projectBlocks' ? blocksFixture.exports : name === './ProjectBlockCards' ? { ProjectBlockCard: () => null, ModuleFrameBorder: ({ children }) => children } : name === './canvasGeometry' ? geometryFixture.exports : name === '@/lib/client-api' ? { clientApi: async (path, options) => { calls.push({ path, options }); return { data: catalogue }; } } : name === './flowEditor' ? { errorText: String } : name === './edgePresentation' ? { edgePresentation: () => ({ lane: .5 }) } : name === './StudioEdge' ? { StudioEdge: () => null } : name.endsWith('.css') ? { default: {} } : require(name), compiled.exports);
  const html = renderToStaticMarkup(React.createElement(compiled.exports.ProjectSchemeCanvas, { moduleId: '', openModule: id => opened.push(id), locked: false }));
  assert(html.includes('Суперсхема проекта')); assert(html.includes('Схема проекта')); assert(html.includes('Новая схема'));
  assert.equal((html.match(/data-project-module=/g) ?? []).length, 6);
  assert(html.includes('Работает версия #3')); assert(!html.includes('Схема функционала'));
  assert(html.includes('Раскрыть все модули')); assert(!html.includes('Группа:')); assert(html.includes('Раскрыть на холсте'));
  assert(html.includes('Мастер-сессия')); assert(html.includes('10 мин')); assert(html.includes('32 МиБ'));
  assert(html.includes('>Выходы<')); assert(html.includes('>Входы<'));
  for (const edge of contract.connections) {
    assert.equal(html.split(`data-project-port="${edge.id}"`).length - 1, 2, `${edge.id}: both endpoints have a visible row`);
    assert(html.includes(`>${edge.label}</button>`), `${edge.id}: visible port label`);
  }
  renderedNodes.find(node => node.id === 'memory').data.open('memory'); assert.deepEqual(opened, ['memory']);
  const cleanup = effects[0](); await Promise.resolve();
  assert.equal(calls.length, 1); assert.equal(calls[0].path, '/tutor/flows/project-schemes'); assert(!calls[0].options.method); cleanup();
});

test('master frame encloses visible modules and sources without rewriting their positions or counting children twice', () => {
  const nodes = [{ position: { x: -10, y: 20 }, measured: { width: 300, height: 250 } },
    { position: { x: 900, y: 600 }, style: { width: 1600, height: 1200 } },
    { parentId: 'frame', position: { x: 99999, y: 99999 } }];
  const before = JSON.stringify(nodes), bounds = blocksFixture.exports.masterFrameBounds(nodes);
  assert(bounds.position.x < -10); assert(bounds.position.y < 20);
  assert(bounds.position.x + bounds.width >= 2500);
  assert(bounds.position.y + bounds.height >= 1800);
  assert(bounds.width < 10000); assert.equal(JSON.stringify(nodes), before);
});

test('expanded blocks have distinct parents, real handles, nonoverlapping frames and immutable originals', () => {
  const { projectModuleLayout, blockId } = blocksFixture.exports;
  const node = (id, type, x, y) => ({ id, type, position: { x, y }, data: type === 'prompt' ? { text: 'Original instruction' } : {} });
  const internal = { name: 'Fixture', nodes: [node('event', 'event', 0, -20), node('prompt', 'prompt', 350, 0), node('prompt2', 'prompt', 350, 10)], edges: [{ id: 'edge', source: 'event', target: 'prompt', sourceHandle: 'out', targetHandle: 'in1' }] };
  const snapshots = Object.fromEntries(contract.modules.map(module => [module.id, { active: 4, nodes: 3, edges: 1, models: [], graph: structuredClone(internal) }]));
  const before = JSON.stringify(snapshots), layout = projectModuleLayout({ ...graph(), modules: graph().modules.map(m => ({ ...m, expanded: true })) }, snapshots);
  assert.equal(layout.frames.length, 6); assert.equal(layout.edges.length, 6);
  assert.equal(new Set(layout.frames.flatMap(frame => frame.blocks.map(block => block.id))).size, 18);
  const source = layout.frames[0].blocks.find(block => block.source.id === 'event');
  const target = layout.frames[0].blocks.find(block => block.source.id === 'prompt');
  assert.deepEqual(source.outputs, ['out']); assert.deepEqual(target.inputs, ['in1']);
  assert.equal(layout.edges[0].source, blockId(layout.frames[0].id, 'event'));
  for (const frame of layout.frames) for (const block of frame.blocks) {
    assert(block.position.x >= 0 && block.position.y >= 100);
    assert(block.position.x + 250 <= frame.width && block.position.y + 190 <= frame.height);
  }
  for (const [i, a] of layout.frames.entries()) for (const b of layout.frames.slice(i + 1)) {
    assert(a.position.x + a.width < b.position.x || b.position.x + b.width < a.position.x || a.position.y + a.height < b.position.y || b.position.y + b.height < a.position.y);
  }
  assert.equal(JSON.stringify(snapshots), before);
  assert.deepEqual(projectModuleLayout({ ...graph(), modules: [] }, snapshots).frames, []);
});

test('nested module instances expand in their own frame and retain outer wires and port identities', () => {
  const { projectModuleLayout, blockId } = blocksFixture.exports;
  const definition = { id: 'helper', name: 'Helper', version: 4, inputs: [{ id: 'question', label: 'Question' }], outputs: [{ id: 'answer', label: 'Answer' }],
    nodes: [{ id: 'start', type: 'module_input', data: { port: 'question' }, position: { x: 0, y: 0 } },
      { id: 'end', type: 'module_output', data: { port: 'answer' }, position: { x: 400, y: 0 } }],
    edges: [{ id: 'through', source: 'start', target: 'end', sourceHandle: 'out', targetHandle: 'in' }] };
  const internal = { name: 'Parent', nodes: [
    { id: 'left', type: 'module', position: { x: 0, y: 0 }, data: { definition } },
    { id: 'right', type: 'module', position: { x: 500, y: 0 }, data: { definition } }],
    edges: [{ id: 'join', source: 'left', target: 'right', sourceHandle: 'answer', targetHandle: 'question' }] };
  const project = { ...graph(), modules: graph().modules.map(m => ({ ...m, expanded: m.id === 'tutor' })) };
  const snapshots = { tutor: { active: 12, nodes: 2, edges: 1, models: [], graph: internal } }, before = JSON.stringify(snapshots);
  const folded = projectModuleLayout(project, snapshots), open = projectModuleLayout(project, snapshots, new Set([blockId('tutor', 'left')]));
  assert.equal(open.frames.length, 1); const blocks = open.frames[0].blocks;
  assert.equal(blocks.find(b => b.source.id === 'left').expanded, true);
  assert(!blocks.find(b => b.source.id === 'right').expanded);
  const child = blocks.find(b => b.id === blockId('tutor', 'left__start'));
  assert.equal(child.parentId, blockId('tutor', 'left'));
  assert.deepEqual(blocks.find(b => b.source.id === 'left').inputPorts, definition.inputs);
  assert.deepEqual(open.edges.find(e => e.id.endsWith(':join')), folded.edges[0]);
  for (const block of blocks) {
    const parent = blocks.find(b => b.id === block.parentId) ?? open.frames[0];
    assert(block.position.x + (block.width ?? 250) <= parent.width);
    assert(block.position.y + (block.height ?? 230) <= parent.height);
  }
  assert.equal(new Set(blocks.map(b => b.id)).size, blocks.length); assert.equal(JSON.stringify(snapshots), before);
});
