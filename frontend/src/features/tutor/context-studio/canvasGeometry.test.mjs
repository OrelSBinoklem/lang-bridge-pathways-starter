import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { adoptUserNodes } from '@xyflow/system';
import { applyNodeChanges } from '@xyflow/react';
import { defaultFlow } from '../../../../../resources/tutor-flow/graph.mjs';

const require = createRequire(import.meta.url);
function load(file) {
  const code = ts.transpileModule(readFileSync(new URL(`./${file}.ts`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const fixture = { exports: {} }; new Function('exports', 'require', code)(fixture.exports, require); return fixture.exports;
}
const { updateCanvasGeometry } = load('canvasGeometry');
const { cleanGraph, fingerprint } = load('flowEditor');

test('repeated drag and selection renders keep actual React Flow measurements and handle bounds for every card', () => {
  let graph = defaultFlow();
  let geometry = updateCanvasGeometry({}, graph.nodes.map(n => ({ type: 'dimensions', id: n.id, dimensions: { width: n.type === 'context' ? 390 : 248, height: n.type === 'context' ? 650 : 100 } })));
  const lookup = new Map(), parents = new Map();
  const cards = () => graph.nodes.map(n => ({ ...n, ...geometry[n.id], data: { ...n.data, selectedForInspector: 'prompt' } }));
  adoptUserNodes(cards(), lookup, parents);
  // The browser's first measurement has already discovered these DOM ports.
  for (const node of lookup.values()) node.internals.handleBounds = { source: [{ id: 'out', x: node.measured.width, y: 40, width: 12, height: 12 }], target: [] };
  for (let step = 0; step < 20; step++) {
    const changes = [{ id: 'prompt', type: 'position', position: { x: 1230 + step * 5, y: 320 + step }, dragging: step < 19 }];
    geometry = updateCanvasGeometry(geometry, changes);
    graph = cleanGraph({ ...graph, nodes: applyNodeChanges(changes, graph.nodes) });
    adoptUserNodes(cards(), lookup, parents);
    for (const node of lookup.values()) {
      assert.equal(typeof node.measured.width, 'number');
      assert(node.internals.handleBounds, `Lost DOM handles for ${node.id} on step ${step}`);
    }
  }
  assert.equal(lookup.get('prompt').position.x, 1325);
  assert.equal(lookup.get('prompt').dragging, false);
});

test('canvas-only measurements never alter persisted graphs or the dirty fingerprint', () => {
  const graph = defaultFlow(), baseline = fingerprint(graph);
  const geometry = updateCanvasGeometry({}, [{ id: 'context', type: 'dimensions', dimensions: { width: 390, height: 650 } }, { id: 'context', type: 'position', dragging: true }]);
  const decorated = { ...graph, nodes: graph.nodes.map(n => ({ ...n, ...geometry[n.id] })) };
  assert.deepEqual(cleanGraph(decorated), cleanGraph(graph)); assert.equal(fingerprint(decorated), baseline);
  const text = JSON.stringify(cleanGraph(decorated)); assert(!text.includes('measured')); assert(!text.includes('dragging'));
});

test('dimension changes remeasure one card, no-op reports stay stable and removal clears its UI state', () => {
  const start = updateCanvasGeometry({}, [{ id: 'a', type: 'dimensions', dimensions: { width: 248, height: 100 } }, { id: 'b', type: 'dimensions', dimensions: { width: 390, height: 650 } }]);
  assert.strictEqual(updateCanvasGeometry(start, [{ id: 'a', type: 'dimensions', dimensions: { width: 248, height: 100 } }]), start);
  const resized = updateCanvasGeometry(start, [{ id: 'a', type: 'dimensions', dimensions: { width: 248, height: 180 } }]);
  assert.strictEqual(resized.b, start.b); assert.equal(resized.a.measured.height, 180); assert.equal(start.a.measured.height, 100);
  const removed = updateCanvasGeometry(resized, [{ id: 'a', type: 'remove' }]); assert(!removed.a); assert.strictEqual(removed.b, start.b);
});
