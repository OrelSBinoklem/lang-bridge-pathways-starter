import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// The uncached traversal is intentionally retained as an independent reference.
// Injected into the simulation's lexical scope, never executed in this test module.
function referenceRelax(st, s, extent) {
  const gN = Math.min(CELLS, Math.max(4, Math.floor((extent * 2) / s)));
  const gs = (extent * 2) / gN;
  cell.fill(-1, 0, gN * gN);
  for (let i = 0; i < N; i++) {
    if (state[i] !== st) continue;
    const gi = Math.min(gN - 1, Math.max(0, Math.floor((px[i] + extent) / gs)));
    const gj = Math.min(gN - 1, Math.max(0, Math.floor((pz[i] + extent) / gs)));
    const c = gj * gN + gi;
    next[i] = cell[c]; cell[c] = i;
  }
  const reach = Math.ceil(s / gs), s2 = s * s;
  for (let gj = 0; gj < gN; gj++) for (let gi = 0; gi < gN; gi++) {
    for (let a = cell[gj * gN + gi]; a >= 0; a = next[a]) {
      for (let nj = gj; nj <= Math.min(gN - 1, gj + reach); nj++) {
        for (let ni = Math.max(0, gi - reach); ni <= Math.min(gN - 1, gi + reach); ni++) {
          if (nj === gj && ni < gi) continue;
          for (let b = cell[nj * gN + ni]; b >= 0; b = next[b]) {
            if (nj === gj && ni === gi && b <= a) continue;
            const dx = px[b] - px[a], dz = pz[b] - pz[a], d2 = dx * dx + dz * dz;
            if (d2 >= s2 || d2 < 1e-12) continue;
            const d = Math.sqrt(d2), push = (s - d) * .45 / d;
            px[a] -= dx * push; pz[a] -= dz * push;
            px[b] += dx * push; pz[b] += dz * push;
          }
        }
      }
    }
  }
}
const source = await readFile(new URL('./sim.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('sim.ts', source, ts.ScriptTarget.Latest, true);
let initializer;
function find(node) { if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'relax') initializer = node.initializer; ts.forEachChild(node, find); }
find(ast); assert.ok(initializer);
const referenceSource = source.slice(0, initializer.getStart(ast)) + referenceRelax.toString() + source.slice(initializer.end);
async function load(text) {
  const code = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}
const modules = await Promise.all([load(source), load(referenceSource)]);
for (const count of [1200, 20000]) test(`cached neighbours preserve exact particle ordering and physics (${count} particles)`, () => {
  const sims = modules.map(mod => {
    let seed = 17;
    return mod.createFountainSim({ count, rate: count / 10, ringShare: .3, jetSpeed: 6, jetSpread: .05, windX: .2, windZ: 0,
      rand: () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296 });
  });
  for (let frame = 0; frame < 120; frame++) for (const sim of sims) sim.step(1 / 60);
  for (const key of ['px', 'py', 'pz', 'vx', 'vy', 'vz', 'state', 'waves', 'counts']) assert.deepEqual(sims[0][key], sims[1][key], key);
});
