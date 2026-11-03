import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { getSmoothStepPath, Position } from '@xyflow/react';

const fixture = { exports: {} };
new Function('exports', ts.transpileModule(readFileSync(new URL('./edgePresentation.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(fixture.exports);
const { edgePresentation, portColour, edgeFocus } = fixture.exports;
const edges = Array.from({ length: 8 }, (_, i) => ({ id: `edge${i}`, source: `source${i}`, target: 'merge', targetHandle: `in${i + 1}` }));

test('eight assembly inputs have distinct stable colours and separate bend tracks', () => {
  const before = JSON.stringify(edges), colours = new Set(), lanes = new Set(), paths = new Set();
  for (const edge of edges) {
    const style = edgePresentation(edges, edge);
    colours.add(style.colour); lanes.add(style.lane);
    assert.equal(style.colour, portColour(edge.targetHandle));
    const [path] = getSmoothStepPath({ sourceX: 300, sourceY: 200, targetX: 900, targetY: 200, sourcePosition: Position.Right, targetPosition: Position.Left, centerX: 300 + 600 * style.lane });
    // With different target heights the paths must keep distinct vertical tracks.
    const [bent] = getSmoothStepPath({ sourceX: 300, sourceY: 200, targetX: 900, targetY: 600, sourcePosition: Position.Right, targetPosition: Position.Left, centerX: 300 + 600 * style.lane });
    assert(path); assert(!bent.includes('NaN')); paths.add(bent);
    assert.deepEqual(edgePresentation([...edges].reverse(), edge), style);
  }
  assert.equal(colours.size, 8); assert.equal(lanes.size, 8); assert.equal(paths.size, 8);
  assert.equal(JSON.stringify(edges), before);
});

test('hover and selection identify only connected cards, including multiple outgoing lines', () => {
  const branch = { id: 'branch', source: 'source0', target: 'other', sourceHandle: 'false' };
  const graph = [...edges, branch];
  const edge = edgeFocus(graph, { kind: 'edge', id: 'edge0' }, []);
  assert.deepEqual([...edge.edges], ['edge0']); assert.deepEqual([...edge.nodes], ['source0', 'merge']);
  const node = edgeFocus(graph, { kind: 'node', id: 'source0' }, []);
  assert.deepEqual([...node.edges], ['edge0', 'branch']);
  assert.deepEqual([...node.nodes], ['source0', 'merge', 'other']);
  assert.equal(edgeFocus(graph, null, []).edges.size, 0);
  assert(edgeFocus(graph, null, ['edge1']).nodes.has('source1'));
  assert.equal(edgePresentation(graph, branch).branch, true);
});
