import { HEIGHT, vesselRadius, type VesselParameters } from './model';
export const CLAY_ROWS = 24;
export const CLAY_SIDES = 32;
export const clayNode = (row: number, side: number, layer: number) => ((row * CLAY_SIDES + (side + CLAY_SIDES) % CLAY_SIDES) * 2 + layer);

export function createClayMesh(shape?: VesselParameters) {
  const positions = new Float32Array((CLAY_ROWS + 1) * CLAY_SIDES * 2 * 3);
  const inverseMass = new Float32Array(positions.length / 3);
  for (let row = 0; row <= CLAY_ROWS; row++) for (let side = 0; side < CLAY_SIDES; side++) for (let layer = 0; layer < 2; layer++) {
    const t = row / CLAY_ROWS, radius = (shape ? vesselRadius(t, shape) : .74 + .1 * Math.sin(Math.PI * t) + .02 * t) - (layer ? 0 : .14);
    const n = clayNode(row, side, layer), angle = side / CLAY_SIDES * Math.PI * 2;
    positions.set([radius * Math.sin(angle), t * HEIGHT * (shape?.height ?? 1), radius * Math.cos(angle)], n * 3);
    inverseMass[n] = row < 2 ? 0 : 1;
  }
  const tets: number[] = [], edges: number[] = [], unique = new Set<string>();
  const edge = (a: number, b: number) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (!unique.has(key)) { unique.add(key); edges.push(a, b); }
  };
  const parts = [[0, 1, 3, 7], [0, 3, 2, 7], [0, 2, 6, 7], [0, 6, 4, 7], [0, 4, 5, 7], [0, 5, 1, 7]];
  for (let row = 0; row < CLAY_ROWS; row++) for (let side = 0; side < CLAY_SIDES; side++) {
    const cell = [clayNode(row, side, 0), clayNode(row, side + 1, 0), clayNode(row + 1, side, 0), clayNode(row + 1, side + 1, 0), clayNode(row, side, 1), clayNode(row, side + 1, 1), clayNode(row + 1, side, 1), clayNode(row + 1, side + 1, 1)];
    for (const part of parts) {
      const ids = part.map(i => cell[i]);
      const [a, b, c, d] = ids.map(i => positions.subarray(i * 3, i * 3 + 3));
      const x1 = b[0] - a[0], y1 = b[1] - a[1], z1 = b[2] - a[2], x2 = c[0] - a[0], y2 = c[1] - a[1], z2 = c[2] - a[2];
      const volume = (y1 * z2 - z1 * y2) * (d[0] - a[0]) + (z1 * x2 - x1 * z2) * (d[1] - a[1]) + (x1 * y2 - y1 * x2) * (d[2] - a[2]);
      if (volume < 0) [ids[0], ids[1]] = [ids[1], ids[0]];
      tets.push(...ids);
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) edge(ids[i], ids[j]);
    }
  }
  // Longer links resist folding; local plasticity can change their rest lengths.
  for (let row = 0; row <= CLAY_ROWS; row++) for (let side = 0; side < CLAY_SIDES; side++) for (let layer = 0; layer < 2; layer++) {
    const n = clayNode(row, side, layer);
    if (row + 2 <= CLAY_ROWS) edge(n, clayNode(row + 2, side, layer));
    edge(n, clayNode(row, side + 2, layer));
  }
  return { positions, inverseMass, tets: new Uint32Array(tets), edges: new Uint32Array(edges) };
}
const cubic = (a: number, b: number, c: number, d: number, t: number) => b + .5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)));

/** Smooth display surface bound to the coarse volumetric lattice. */
export function sampleClay(positions: Float32Array, row: number, side: number, layer: number, target: { x: number; y: number; z: number }) {
  const r = Math.max(0, Math.min(CLAY_ROWS, row)), ri = Math.floor(r), rt = r - ri;
  const s = (side % CLAY_SIDES + CLAY_SIDES) % CLAY_SIDES, si = Math.floor(s), st = s - si;
  const at = (y: number, x: number, k: number) => positions[clayNode(Math.max(0, Math.min(CLAY_ROWS, y)), x, layer) * 3 + k];
  for (let k = 0; k < 3; k++) {
    const a = cubic(at(ri - 1, si - 1, k), at(ri - 1, si, k), at(ri - 1, si + 1, k), at(ri - 1, si + 2, k), st);
    const b = cubic(at(ri, si - 1, k), at(ri, si, k), at(ri, si + 1, k), at(ri, si + 2, k), st);
    const c = cubic(at(ri + 1, si - 1, k), at(ri + 1, si, k), at(ri + 1, si + 1, k), at(ri + 1, si + 2, k), st);
    const d = cubic(at(ri + 2, si - 1, k), at(ri + 2, si, k), at(ri + 2, si + 1, k), at(ri + 2, si + 2, k), st);
    target[k === 0 ? 'x' : k === 1 ? 'y' : 'z'] = cubic(a, b, c, d, rt);
  }
}
