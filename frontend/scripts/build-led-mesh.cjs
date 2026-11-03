#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- a standalone Node script */
/**
 * Turns one LED of SonnySee's "light emitting diode - LED" (blendswap #71511, CC BY 3.0) into a compact module for
 * the PROM board scene: src/features/course/effects/promBoard/ledMesh.ts.
 *
 *   node scripts/extract-blend-mesh.cjs "light emitting diode.blend" led.json
 *   node scripts/build-led-mesh.cjs led.json
 *
 * Blender units → millimetres (the lens is 4.4 units across, a 5 mm LED), Z-up → Y-up (three.js). Faces are
 * triangulated; smooth faces share averaged vertex normals, flat ones get their own. Positions are stored as Int16
 * over the bounding box, normals as Int8, both base64, indices as Uint16 — grouped by material (leads, die, glow,
 * lens, reflector).
 */
const fs = require('node:fs');
const path = require('node:path');

const src = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const ob = src.objects.find((o) => o.name === 'LED_RED');
const MM = 5 / 4.4;
const P = ob.positions;
const pos = (v) => [P[v * 3] * MM, P[v * 3 + 2] * MM, -P[v * 3 + 1] * MM];

const polyNormal = (poly) => {
  // Newell's method.
  let nx = 0, ny = 0, nz = 0;
  const vs = poly.slice(1).map(pos);
  for (let k = 0; k < vs.length; k += 1) {
    const a = vs[k], b = vs[(k + 1) % vs.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l, l / 2];
};
const normals = ob.polys.map(polyNormal);
// Smooth vertex normals: area-weighted average over the smooth faces around a vertex.
const vn = new Map();
ob.polys.forEach((poly, i) => {
  if (!ob.smooth[i]) return;
  const [nx, ny, nz, area] = normals[i];
  for (const v of poly.slice(1)) {
    const acc = vn.get(v) ?? [0, 0, 0];
    acc[0] += nx * area; acc[1] += ny * area; acc[2] += nz * area;
    vn.set(v, acc);
  }
});

const verts = [];
const key = new Map();
const vertex = (v, n) => {
  const k = `${v}|${n.map((c) => c.toFixed(3)).join(',')}`;
  if (!key.has(k)) {
    key.set(k, verts.length);
    verts.push([...pos(v), ...n]);
  }
  return key.get(k);
};
const groups = ob.materials.map(() => []);
ob.polys.forEach((poly, i) => {
  const vs = poly.slice(1).map((v) => {
    let n;
    if (ob.smooth[i]) {
      const a = vn.get(v);
      const l = Math.hypot(...a) || 1;
      n = a.map((c) => c / l);
    } else n = normals[i].slice(0, 3);
    return vertex(v, n);
  });
  for (let k = 1; k + 1 < vs.length; k += 1) groups[poly[0]].push(vs[0], vs[k], vs[k + 1]);
});

// Simplify: vertex clustering per material (vertices within one grid cell merge; triangles that collapse go).
// The cell is chosen per part: the leads and the lead frame are plain wire, the lens needs its curve.
const CELL = { LEADS: 0.32, EMITTER_WHITE: 0.14, EMITTER_RED: 0.2, LENS_RED: 0.3, REFLECTOR: 0.16 };
const before = groups.reduce((s, g) => s + g.length / 3, 0);
groups.forEach((g, m) => {
  const cell = CELL[ob.materials[m]] ?? 0.2;
  const cluster = new Map();
  const rep = new Map();
  for (const v of new Set(g)) {
    const p = verts[v];
    // Hard edges keep apart: the normal's direction is part of the key.
    const k = `${Math.round(p[0] / cell)},${Math.round(p[1] / cell)},${Math.round(p[2] / cell)},${Math.round(p[3] * 1.5)},${Math.round(p[4] * 1.5)},${Math.round(p[5] * 1.5)}`;
    const acc = cluster.get(k) ?? { sum: [0, 0, 0, 0, 0, 0], n: 0, id: -1 };
    for (let a = 0; a < 6; a += 1) acc.sum[a] += p[a];
    acc.n += 1;
    cluster.set(k, acc);
    rep.set(v, acc);
  }
  for (const acc of cluster.values()) {
    const s = acc.sum.map((c) => c / acc.n);
    const l = Math.hypot(s[3], s[4], s[5]) || 1;
    acc.id = verts.length;
    verts.push([s[0], s[1], s[2], s[3] / l, s[4] / l, s[5] / l]);
  }
  const out = [];
  const seen = new Set();
  for (let k = 0; k < g.length; k += 3) {
    const a = rep.get(g[k]).id, b = rep.get(g[k + 1]).id, c = rep.get(g[k + 2]).id;
    if (a === b || b === c || a === c) continue;
    const key = [a, b, c].sort((x, y) => x - y).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a, b, c);
  }
  groups[m] = out;
});
// Drop the vertices no triangle uses any more, renumber.
{
  const used = new Map();
  const kept = [];
  for (const g of groups) {
    for (let k = 0; k < g.length; k += 1) {
      if (!used.has(g[k])) {
        used.set(g[k], kept.length);
        kept.push(verts[g[k]]);
      }
      g[k] = used.get(g[k]);
    }
  }
  verts.length = 0;
  verts.push(...kept);
}
console.log(`simplified ${before} → ${groups.reduce((s, g) => s + g.length / 3, 0)} triangles`);

const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
for (const v of verts) for (let a = 0; a < 3; a += 1) {
  min[a] = Math.min(min[a], v[a]);
  max[a] = Math.max(max[a], v[a]);
}
const posQ = Buffer.alloc(verts.length * 6);
const nrmQ = Buffer.alloc(verts.length * 3);
verts.forEach((v, i) => {
  for (let a = 0; a < 3; a += 1) {
    posQ.writeInt16LE(Math.round(((v[a] - min[a]) / (max[a] - min[a])) * 65534 - 32767), i * 6 + a * 2);
    nrmQ.writeInt8(Math.round(v[3 + a] * 127), i * 3 + a);
  }
});
const order = [];
const groupInfo = [];
groups.forEach((g, m) => {
  groupInfo.push([order.length, g.length, ob.materials[m].replace(/_RED$|\.\d+$/g, '')]);
  order.push(...g);
});
const idx = Buffer.alloc(order.length * 2);
order.forEach((v, i) => idx.writeUInt16LE(v, i * 2));

const r = (v) => Math.round(v * 1e4) / 1e4;
const outFile = path.resolve(__dirname, '../src/features/course/effects/promBoard/ledMesh.ts');
fs.writeFileSync(outFile, `/**
 * A 5 mm LED, from "light emitting diode - LED" by SonnySee (blendswap #71511), CC BY 3.0 — credit shown in the scene.
 * Generated by scripts/build-led-mesh.cjs: millimetres, Y up, the lens at the origin's height above the leads.
 * Positions: Int16 over [min, max]; normals: Int8; indices: Uint16, grouped by material.
 */
export const LED_MESH = {
  min: [${min.map(r).join(', ')}],
  max: [${max.map(r).join(', ')}],
  vertices: ${verts.length},
  positions: '${posQ.toString('base64')}',
  normals: '${nrmQ.toString('base64')}',
  indices: '${idx.toString('base64')}',
  /** [first index, index count, material]: LEADS, EMITTER_WHITE (die), EMITTER (glow), LENS, REFLECTOR. */
  groups: ${JSON.stringify(groupInfo)} as [number, number, string][],
};
`);
console.log(`${verts.length} vertices, ${order.length / 3} triangles, groups ${JSON.stringify(groupInfo)}; bbox ${min.map(r)} .. ${max.map(r)}; ${fs.statSync(outFile).size} bytes`);
