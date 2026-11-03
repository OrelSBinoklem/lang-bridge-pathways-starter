import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const urls = new Map();
/** Transpiles a TS module of this folder; its relative imports are resolved to already loaded modules. */
async function load(name) {
  if (urls.has(name)) return import(urls.get(name));
  let code = ts.transpileModule(await readFile(new URL(`./${name}.ts`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const [, dep] of code.matchAll(/from '\.\/([A-Za-z]+)'/g)) { await load(dep); code = code.replaceAll(`from './${dep}'`, `from '${urls.get(dep)}'`); }
  urls.set(name, 'data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
  return import(urls.get(name));
}
const { BONES, BONE_INDEX } = await load('catRig');
const { buildCatMesh, catPrimitives, catSdf, EYE } = await load('catGeometry');
const { solveTwoBone, jumpArc, planScroll } = await load('catMath');

test('rig is a tree whose parents come first', () => {
  BONES.forEach((bone, i) => { if (bone.parent) assert(BONE_INDEX[bone.parent] < i, bone.name); });
  assert.equal(new Set(BONES.map(b => b.name)).size, BONES.length);
});

test('body is one closed, consistently wound, fully skinned surface', () => {
  const mesh = buildCatMesh(0.016);
  assert(mesh.vertexCount > 3000, `${mesh.vertexCount} vertices`);
  assert.equal(mesh.index.length % 3, 0);
  // Closed manifold: every edge is shared by exactly two triangles with opposite directions.
  const edges = new Map();
  for (let i = 0; i < mesh.index.length; i += 3) for (let e = 0; e < 3; e++) {
    const a = mesh.index[i + e], b = mesh.index[i + (e + 1) % 3];
    const key = `${a},${b}`; edges.set(key, (edges.get(key) ?? 0) + 1);
  }
  let open = 0;
  for (const [key, count] of edges) { const [a, b] = key.split(','); if (count !== 1 || edges.get(`${b},${a}`) !== 1) open++; }
  assert(open / edges.size < 0.002, `${open} of ${edges.size} edges unpaired`);
  for (let q = 0; q < mesh.vertexCount; q++) {
    const sum = mesh.skinWeight[q * 4] + mesh.skinWeight[q * 4 + 1] + mesh.skinWeight[q * 4 + 2] + mesh.skinWeight[q * 4 + 3];
    assert(Math.abs(sum - 1) < 1e-4);
    assert(Math.abs(Math.hypot(mesh.normal[q * 3], mesh.normal[q * 3 + 1], mesh.normal[q * 3 + 2]) - 1) < 1e-3);
  }
  // Vertices lie on the surface, the paws reach the ground and the eye sockets are open.
  const prims = catPrimitives();
  for (let q = 0; q < mesh.vertexCount; q += 37) assert(Math.abs(catSdf(prims, mesh.position[q * 3], mesh.position[q * 3 + 1], mesh.position[q * 3 + 2])) < 0.004);
  let minY = Infinity; for (let q = 0; q < mesh.vertexCount; q++) minY = Math.min(minY, mesh.position[q * 3 + 1]);
  assert(minY > -0.01 && minY < 0.015, `lowest point ${minY}`);
  assert(catSdf(prims, EYE.x, EYE.y, EYE.z) > 0, 'eye socket carved');
});

test('paws and feet are owned by their own leg bones', () => {
  const mesh = buildCatMesh(0.016);
  const owner = (x, y, z) => {
    let best = 0, dist = Infinity;
    for (let q = 0; q < mesh.vertexCount; q++) {
      const d = Math.hypot(mesh.position[q * 3] - x, mesh.position[q * 3 + 1] - y, mesh.position[q * 3 + 2] - z);
      if (d < dist) { dist = d; best = q; }
    }
    return BONES[mesh.skinIndex[best * 4]].name;
  };
  assert.equal(owner(0.23, 0.0, 0.085), 'handL');
  assert.equal(owner(0.23, 0.0, -0.085), 'handR');
  assert.equal(owner(-0.24, 0.0, 0.09), 'footL');
  assert.match(owner(-1.02, 0.63, 0), /^tail[78]$/);
  assert.equal(owner(0.5, 0.75, 0), 'head');
});

test('two-bone IK reaches reachable targets with the joint on the requested side', () => {
  for (const bend of [1, -1]) {
    const { a1, a2, reach } = solveTwoBone(0, 0, 0.1, -0.3, 0.23, 0.18, bend);
    const ex = 0.23 * Math.cos(a1), ey = 0.23 * Math.sin(a1);
    const tx = ex + 0.18 * Math.cos(a2), ty = ey + 0.18 * Math.sin(a2);
    assert(Math.hypot(tx - 0.1, ty + 0.3) < 1e-9 && reach);
    assert.equal(Math.sign(0.1 * ey - -0.3 * ex), bend);
  }
  const far = solveTwoBone(0, 0, 2, 0, 0.23, 0.18, 1);
  assert.equal(far.reach, false);
  assert(Math.abs(far.a1) < 0.05 && Math.abs(far.a2) < 0.05, 'stretches straight toward an unreachable target');
});

test('jump arc starts and ends on the perches and clears the higher one', () => {
  for (const [ax, ay, bx, by] of [[100, 500, 700, 500], [100, 500, 300, 120], [600, 100, 200, 650]]) {
    const arc = jumpArc(ax, ay, bx, by);
    assert.deepEqual(arc.at(0).map(Math.round), [ax, ay]);
    assert.deepEqual(arc.at(1).map(Math.round), [bx, by]);
    let top = Infinity; for (let s = 0; s <= 1; s += 0.01) top = Math.min(top, arc.at(s)[1]);
    assert(top < Math.min(ay, by) - 30, 'apex above both perches');
    assert(arc.duration > 0.35 && arc.duration < 1.3);
  }
  // Near the top of the page the apex is lowered under the ceiling but still clears the higher perch.
  const low = jumpArc(100, 330, 700, 360, 120);
  let top = Infinity; for (let s = 0; s <= 1; s += 0.01) top = Math.min(top, low.at(s)[1]);
  assert(top >= 119 && top < 330 - 15, `apex ${top}`);
});

test('scroll plan keeps the whole jump on screen and follows a hop up before a drop', () => {
  // Cat at the top edge of the view jumps far down; the arc first rises above the view.
  const vh = 800, view = [80, vh - 10], start = 1000, catAbove = 220, catBelow = 30;
  const arc = jumpArc(600, start + 300, 500, start + 1500);
  const spans = Array.from({ length: 80 }, (_, i) => { const y = arc.at(i / 79)[1]; return { top: y - catAbove, bottom: y + catBelow }; });
  const path = planScroll(spans, start, 5000, ...view);
  path.forEach((s, i) => { assert(spans[i].top - s >= view[0] - 0.5, `top hidden at ${i}`); assert(spans[i].bottom - s <= view[1] + 0.5, `bottom hidden at ${i}`); });
  const min = Math.min(...path);
  assert(min < start - 5, 'scrolls up for the hop first');
  assert(path.at(-1) > start + 500, 'then follows the drop');
  for (let i = 2; i < path.length; i++) assert(Math.abs(path[i] - 2 * path[i - 1] + path[i - 2]) < 40, 'no kinks');
  // Already visible from start to landing: no scrolling at all.
  const still = planScroll([{ top: 1200, bottom: 1300 }, { top: 1100, bottom: 1250 }, { top: 1250, bottom: 1400 }], start, 5000, ...view);
  assert(still.every(s => s === start));
});
