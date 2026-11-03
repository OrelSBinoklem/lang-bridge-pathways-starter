/**
 * The cat's body as one seamless skinned surface. Anatomical primitives (ellipsoids and round cones in the bind
 * pose) are blended with a smooth minimum into a signed distance field, polygonised with surface nets, projected
 * back onto the exact surface and skinned by the primitive each vertex belongs to. Plain arrays only (no three.js),
 * so it can be tested in Node and later moved to a worker.
 */
import { BONE_INDEX, boneAt, TAIL_BONES, type V3 } from './catRig';

type BoneWeights = [string, number][];
type Prim = {
  kind: 'ell' | 'cone';
  a: V3; b: V3; r: V3; r2: number; k: number; sub?: boolean;
  weights: (t: number, x: number) => BoneWeights;
  lo: V3; hi: V3;
};

const ss = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** Torso bends smoothly: weight by position along the spine. */
const SPINE: [string, number][] = [['hips', -0.3], ['spine1', -0.08], ['spine2', 0.12], ['neck', 0.27]];
function spine(_t: number, x: number): BoneWeights {
  if (x <= SPINE[0][1]) return [[SPINE[0][0], 1]];
  for (let i = 0; i < SPINE.length - 1; i++) {
    const [a, xa] = SPINE[i], [b, xb] = SPINE[i + 1];
    if (x <= xb) { const u = ss(0, 1, (x - xa) / (xb - xa)); return [[a, 1 - u], [b, u]]; }
  }
  return [[SPINE[SPINE.length - 1][0], 1]];
}
const only = (bone: string) => (): BoneWeights => [[bone, 1]];
/** A limb segment owned by `a`, blending into `b` at its far end and into `parent` at its start. */
const chain = (a: string, b: string | null, parent: string | null) => (t: number): BoneWeights => {
  const w: BoneWeights = [[a, 1]];
  if (b) { const u = 0.5 * ss(0.62, 1, t); w[0][1] -= u; w.push([b, u]); }
  if (parent) w.push([parent, 0.55 * (1 - ss(0, 0.32, t))]);
  return w;
};

function ell(c: V3, r: V3, k: number, weights: Prim['weights'], sub = false): Prim {
  const m = Math.max(...r) + k + 0.03;
  return { kind: 'ell', a: c, b: c, r, r2: 0, k, sub, weights, lo: [c[0] - m, c[1] - m, c[2] - m], hi: [c[0] + m, c[1] + m, c[2] + m] };
}
function cone(a: V3, b: V3, r1: number, r2: number, k: number, weights: Prim['weights']): Prim {
  const m = Math.max(r1, r2) + k + 0.03;
  return { kind: 'cone', a, b, r: [r1, r1, r1], r2, k, weights,
    lo: [Math.min(a[0], b[0]) - m, Math.min(a[1], b[1]) - m, Math.min(a[2], b[2]) - m],
    hi: [Math.max(a[0], b[0]) + m, Math.max(a[1], b[1]) + m, Math.max(a[2], b[2]) + m] };
}

/** Eye centres and radius, shared with the model so the eyeballs sit exactly in their sockets. */
export const EYE = { x: 0.444, y: 0.792, z: 0.054, r: 0.039 };

export function catPrimitives(): Prim[] {
  const P: Prim[] = [];
  // Torso: rump, waist, chest, belly and the soft chest ruff.
  P.push(ell([-0.28, 0.495, 0], [0.165, 0.15, 0.13], 0.06, spine));
  P.push(ell([-0.08, 0.49, 0], [0.2, 0.135, 0.12], 0.07, spine));
  P.push(ell([0.1, 0.505, 0], [0.165, 0.16, 0.13], 0.07, spine));
  P.push(ell([-0.08, 0.425, 0], [0.17, 0.075, 0.105], 0.06, spine));
  P.push(ell([0.19, 0.46, 0], [0.085, 0.1, 0.1], 0.06, spine));
  // Neck into the head.
  P.push(cone([0.17, 0.56, 0], [0.3, 0.71, 0], 0.1, 0.085, 0.06, chain('neck', 'head', 'spine2')));
  // Head: skull, broad cheeks, muzzle, whisker pads, nose bridge, chin (jaw).
  const head = only('head');
  P.push(ell([0.35, 0.775, 0], [0.13, 0.12, 0.138], 0.03, head));
  for (const s of [1, -1]) {
    P.push(ell([0.385, 0.722, 0.072 * s], [0.085, 0.068, 0.072], 0.035, head));
    P.push(ell([0.467, 0.709, 0.026 * s], [0.03, 0.03, 0.03], 0.018, head));
    P.push(ell([0.39, 0.815, 0.06 * s], [0.07, 0.04, 0.05], 0.03, head));
  }
  P.push(ell([0.448, 0.725, 0], [0.052, 0.046, 0.058], 0.03, head));
  P.push(cone([0.425, 0.79, 0], [0.486, 0.744, 0], 0.036, 0.02, 0.025, head));
  P.push(ell([0.448, 0.677, 0], [0.04, 0.024, 0.034], 0.02, (_t, x) => [['jaw', ss(0.41, 0.45, x)], ['head', 1 - ss(0.41, 0.45, x)]]));
  for (const side of ['L', 'R'] as const) {
    const s = side === 'L' ? 1 : -1;
    // Front leg: shoulder blade, upper arm, forearm, paw with four toes.
    const sh = boneAt(`shoulder${side}`), el = boneAt(`elbow${side}`), wr = boneAt(`wrist${side}`), ha = boneAt(`hand${side}`);
    P.push(ell(add(sh, [-0.03, 0.06, -0.022 * s]), [0.085, 0.075, 0.05], 0.05, chain(`shoulder${side}`, null, 'spine2')));
    P.push(cone(add(sh, [0, 0.02, 0]), el, 0.058, 0.044, 0.045, chain(`shoulder${side}`, `elbow${side}`, 'spine2')));
    P.push(cone(el, wr, 0.04, 0.032, 0.03, chain(`elbow${side}`, `wrist${side}`, null)));
    P.push(cone(wr, ha, 0.032, 0.036, 0.025, chain(`wrist${side}`, `hand${side}`, null)));
    P.push(ell(add(ha, [0.008, 0, 0]), [0.05, 0.031, 0.04], 0.022, only(`hand${side}`)));
    for (const [dx, dz] of [[0.036, -0.027], [0.044, -0.009], [0.044, 0.009], [0.036, 0.027]]) {
      P.push(ell(add(ha, [dx, -0.008, dz]), [0.019, 0.018, 0.016], 0.01, only(`hand${side}`)));
    }
    // Hind leg: heavy thigh, shin, long hock, paw with toes.
    const th = boneAt(`thigh${side}`), kn = boneAt(`knee${side}`), ho = boneAt(`hock${side}`), fo = boneAt(`foot${side}`);
    P.push(ell(add(th, [0.025, -0.05, 0]), [0.105, 0.135, 0.062], 0.06, (t) => [[`thigh${side}`, 1], ['hips', 0.4 * (1 - ss(-0.02, 0.12, t))]]));
    P.push(cone(kn, ho, 0.046, 0.03, 0.04, chain(`knee${side}`, `hock${side}`, `thigh${side}`)));
    P.push(cone(ho, fo, 0.03, 0.032, 0.02, chain(`hock${side}`, `foot${side}`, null)));
    P.push(ell(add(fo, [0.012, 0, 0]), [0.055, 0.03, 0.039], 0.02, only(`foot${side}`)));
    for (const [dx, dz] of [[0.045, -0.025], [0.053, -0.008], [0.053, 0.008], [0.045, 0.025]]) {
      P.push(ell(add(fo, [dx, -0.006, dz]), [0.018, 0.017, 0.015], 0.01, only(`foot${side}`)));
    }
  }
  // Tail: tapering chain with a slightly fuller tip.
  for (let i = 0; i < TAIL_BONES - 1; i++) {
    const r1 = 0.044 - i * 0.0018, r2 = 0.044 - (i + 1) * 0.0018;
    // Linear blending along the whole segment keeps a curled tail smooth.
    const a = `tail${i}`, b = `tail${i + 1}`, parent = i ? `tail${i - 1}` : 'hips';
    P.push(cone(boneAt(a), boneAt(b), r1, r2, i ? 0.004 : 0.05, t => [[a, 1 - 0.5 * t], [b, 0.5 * t], [parent, 0.5 * (1 - t)]]));
  }
  P.push(ell(add(boneAt(`tail${TAIL_BONES - 1}`), [-0.02, 0.003, 0]), [0.042, 0.032, 0.032], 0.02, only(`tail${TAIL_BONES - 1}`)));
  // Eye sockets are carved out last.
  for (const s of [1, -1]) P.push(ell([EYE.x, EYE.y, EYE.z * s], [EYE.r * 0.97, EYE.r * 0.97, EYE.r * 0.97], 0.012, head, true));
  return P;
}

function sdEllipsoid(px: number, py: number, pz: number, p: Prim) {
  const x = px - p.a[0], y = py - p.a[1], z = pz - p.a[2];
  const k0 = Math.hypot(x / p.r[0], y / p.r[1], z / p.r[2]);
  const k1 = Math.hypot(x / (p.r[0] * p.r[0]), y / (p.r[1] * p.r[1]), z / (p.r[2] * p.r[2]));
  return k1 < 1e-9 ? -Math.min(...p.r) : (k0 * (k0 - 1)) / k1;
}
function sdRoundCone(px: number, py: number, pz: number, p: Prim) {
  const r1 = p.r[0], r2 = p.r2;
  const bax = p.b[0] - p.a[0], bay = p.b[1] - p.a[1], baz = p.b[2] - p.a[2];
  const l2 = bax * bax + bay * bay + baz * baz, rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  const pax = px - p.a[0], pay = py - p.a[1], paz = pz - p.a[2];
  const y = pax * bax + pay * bay + paz * baz, z = y - l2;
  const xx = pax * l2 - bax * y, xy = pay * l2 - bay * y, xz = paz * l2 - baz * y;
  const x2 = xx * xx + xy * xy + xz * xz, y2 = y * y * l2, z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
const primDist = (x: number, y: number, z: number, p: Prim) => p.kind === 'ell' ? sdEllipsoid(x, y, z, p) : sdRoundCone(x, y, z, p);
const primT = (x: number, y: number, z: number, p: Prim) => {
  if (p.kind === 'ell') return 0;
  const bx = p.b[0] - p.a[0], by = p.b[1] - p.a[1], bz = p.b[2] - p.a[2];
  return Math.min(1, Math.max(0, ((x - p.a[0]) * bx + (y - p.a[1]) * by + (z - p.a[2]) * bz) / (bx * bx + by * by + bz * bz)));
};
const smin = (a: number, b: number, k: number) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const inBox = (x: number, y: number, z: number, p: Prim) => x >= p.lo[0] && x <= p.hi[0] && y >= p.lo[1] && y <= p.hi[1] && z >= p.lo[2] && z <= p.hi[2];

export function catSdf(prims: Prim[], x: number, y: number, z: number) {
  let d = 1e9;
  for (const p of prims) {
    if (!inBox(x, y, z, p)) continue;
    const di = primDist(x, y, z, p);
    d = p.sub ? -smin(-d, di, p.k) : smin(d, di, p.k);
  }
  return d;
}

export type CatMeshData = {
  position: Float32Array; normal: Float32Array; index: Uint32Array;
  skinIndex: Uint16Array; skinWeight: Float32Array; vertexCount: number; ms: number;
};

/** `cell` is the grid spacing in model units (the cat is ~1.5 long): 0.011 ≈ 30k triangles. */
export function buildCatMesh(cell = 0.011): CatMeshData {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const prims = catPrimitives();
  const lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity];
  for (const p of prims) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], p.lo[a]); hi[a] = Math.max(hi[a], p.hi[a]); }
  const n = [0, 1, 2].map(a => Math.ceil((hi[a] - lo[a]) / cell) + 1);
  const [nx, ny, nz] = n, nxy = nx * ny;
  const field = new Float32Array(nx * ny * nz).fill(1e9);
  // Stamp each primitive into its own box (same order and operators as catSdf).
  for (const p of prims) {
    const i0 = Math.max(0, Math.floor((p.lo[0] - lo[0]) / cell)), i1 = Math.min(nx - 1, Math.ceil((p.hi[0] - lo[0]) / cell));
    const j0 = Math.max(0, Math.floor((p.lo[1] - lo[1]) / cell)), j1 = Math.min(ny - 1, Math.ceil((p.hi[1] - lo[1]) / cell));
    const k0 = Math.max(0, Math.floor((p.lo[2] - lo[2]) / cell)), k1 = Math.min(nz - 1, Math.ceil((p.hi[2] - lo[2]) / cell));
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = lo[0] + i * cell, y = lo[1] + j * cell, z = lo[2] + k * cell;
      if (!inBox(x, y, z, p)) continue;
      const idx = i + nx * j + nxy * k, di = primDist(x, y, z, p);
      field[idx] = p.sub ? -smin(-field[idx], di, p.k) : smin(field[idx], di, p.k);
    }
  }
  // Surface nets: one vertex per cell crossing the surface, at the mean of its edge crossings.
  const cx = nx - 1, cy = ny - 1, cxy = cx * cy;
  const cellVert = new Int32Array(cx * cy * (nz - 1)).fill(-1);
  const verts: number[] = [];
  const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const v = new Float64Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) {
      v[c] = field[(i + corner[c][0]) + nx * (j + corner[c][1]) + nxy * (k + corner[c][2])];
      if (v[c] < 0) mask |= 1 << c;
    }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, count = 0;
    for (const [a, b] of edges) {
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]);
      sx += corner[a][0] + (corner[b][0] - corner[a][0]) * t;
      sy += corner[a][1] + (corner[b][1] - corner[a][1]) * t;
      sz += corner[a][2] + (corner[b][2] - corner[a][2]) * t;
      count++;
    }
    cellVert[i + cx * j + cxy * k] = verts.length / 3;
    verts.push(lo[0] + (i + sx / count) * cell, lo[1] + (j + sy / count) * cell, lo[2] + (k + sz / count) * cell);
  }
  const vertexCount = verts.length / 3;
  const position = new Float32Array(verts);
  const normal = new Float32Array(vertexCount * 3);
  const e = cell * 0.35;
  for (let q = 0; q < vertexCount; q++) {
    let x = position[q * 3], y = position[q * 3 + 1], z = position[q * 3 + 2];
    let gx = 0, gy = 0, gz = 0;
    for (let it = 0; it < 3; it++) {
      const d = catSdf(prims, x, y, z);
      gx = catSdf(prims, x + e, y, z) - catSdf(prims, x - e, y, z);
      gy = catSdf(prims, x, y + e, z) - catSdf(prims, x, y - e, z);
      gz = catSdf(prims, x, y, z + e) - catSdf(prims, x, y, z - e);
      const g = Math.hypot(gx, gy, gz) || 1;
      gx /= g; gy /= g; gz /= g;
      if (it < 2 && Math.abs(d) < cell * 1.5) { x -= d * gx; y -= d * gy; z -= d * gz; }
    }
    position.set([x, y, z], q * 3);
    normal.set([gx, gy, gz], q * 3);
  }
  // Quads around every grid edge that crosses the surface, wound to face along the field gradient.
  const tris: number[] = [];
  const cellAt = (i: number, j: number, k: number) => (i < 0 || j < 0 || k < 0 || i >= cx || j >= cy || k >= nz - 1) ? -1 : cellVert[i + cx * j + cxy * k];
  const quad = (a: number, b: number, c: number, d: number) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    const ax = position[a * 3], ay = position[a * 3 + 1], az = position[a * 3 + 2];
    const ux = position[b * 3] - ax, uy = position[b * 3 + 1] - ay, uz = position[b * 3 + 2] - az;
    const wx = position[c * 3] - ax, wy = position[c * 3 + 1] - ay, wz = position[c * 3 + 2] - az;
    const fx = uy * wz - uz * wy, fy = uz * wx - ux * wz, fz = ux * wy - uy * wx;
    const nxs = normal[a * 3] + normal[b * 3] + normal[c * 3], nys = normal[a * 3 + 1] + normal[b * 3 + 1] + normal[c * 3 + 1], nzs = normal[a * 3 + 2] + normal[b * 3 + 2] + normal[c * 3 + 2];
    if (fx * nxs + fy * nys + fz * nzs >= 0) tris.push(a, b, c, a, c, d); else tris.push(a, c, b, a, d, c);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const s0 = field[i + nx * j + nxy * k] < 0;
    if (s0 !== (field[i + 1 + nx * j + nxy * k] < 0)) quad(cellAt(i, j, k), cellAt(i, j - 1, k), cellAt(i, j - 1, k - 1), cellAt(i, j, k - 1));
    if (s0 !== (field[i + nx * (j + 1) + nxy * k] < 0)) quad(cellAt(i, j, k), cellAt(i - 1, j, k), cellAt(i - 1, j, k - 1), cellAt(i, j, k - 1));
    if (s0 !== (field[i + nx * j + nxy * (k + 1)] < 0)) quad(cellAt(i, j, k), cellAt(i - 1, j, k), cellAt(i - 1, j - 1, k), cellAt(i, j - 1, k));
  }
  // Skin weights: each nearby primitive votes for its bones, the closest surface winning smoothly.
  const skinIndex = new Uint16Array(vertexCount * 4), skinWeight = new Float32Array(vertexCount * 4);
  const acc = new Float64Array(Object.keys(BONE_INDEX).length);
  const unions = prims.filter(p => !p.sub);
  const ds = new Float64Array(unions.length);
  for (let q = 0; q < vertexCount; q++) {
    const x = position[q * 3], y = position[q * 3 + 1], z = position[q * 3 + 2];
    let dmin = Infinity;
    unions.forEach((p, i) => { ds[i] = inBox(x, y, z, p) ? primDist(x, y, z, p) : Infinity; dmin = Math.min(dmin, ds[i]); });
    acc.fill(0);
    unions.forEach((p, i) => {
      if (ds[i] === Infinity) return;
      const influence = Math.exp(-(ds[i] - dmin) / 0.013);
      if (influence < 1e-3) return;
      const w = p.weights(primT(x, y, z, p), x);
      const total = w.reduce((s, [, value]) => s + Math.max(0, value), 0) || 1;
      for (const [bone, value] of w) if (value > 0) acc[BONE_INDEX[bone]] += influence * value / total;
    });
    const top = Array.from(acc, (value, bone) => [bone, value]).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((s, [, value]) => s + value, 0) || 1;
    top.forEach(([bone, value], slot) => { skinIndex[q * 4 + slot] = bone; skinWeight[q * 4 + slot] = value / sum; });
  }
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return { position, normal, index: new Uint32Array(tris), skinIndex, skinWeight, vertexCount, ms: t1 - t0 };
}
