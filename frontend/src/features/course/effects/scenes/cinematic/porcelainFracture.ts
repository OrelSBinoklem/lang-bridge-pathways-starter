export type Point2 = { x: number; y: number };
export type PorcelainCell = { center: Point2; polygon: Point2[] };
const CIRCUMFERENCE = 12, HEIGHT = 5.3;

/** Voronoi cracks on a cylinder: cells wrap across the back seam, not eight identical sectors. */
export function porcelainFracture(rand: () => number): PorcelainCell[] {
  const sites: Point2[] = [];
  for (let row = 0; row < 6; row++) for (let col = 0; col < 8; col++) {
    sites.push({ x: (col + .08 + rand() * .84) * CIRCUMFERENCE / 8, y: (row + .08 + rand() * .84) * HEIGHT / 6 });
  }
  const clip = (polygon: Point2[], a: number, b: number, c: number) => {
    const result: Point2[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i], q = polygon[(i + 1) % polygon.length];
      const dp = a * p.x + b * p.y - c, dq = a * q.x + b * q.y - c;
      if (dp <= 1e-10) result.push(p);
      if ((dp < 0) !== (dq < 0)) {
        const t = dp / (dp - dq);
        result.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
      }
    }
    return result;
  };
  return sites.map(site => {
    let polygon = [{ x: site.x - CIRCUMFERENCE / 2, y: 0 }, { x: site.x + CIRCUMFERENCE / 2, y: 0 },
      { x: site.x + CIRCUMFERENCE / 2, y: HEIGHT }, { x: site.x - CIRCUMFERENCE / 2, y: HEIGHT }];
    for (const other of sites) for (const wrap of [-1, 0, 1]) {
      if (site === other && wrap === 0) continue;
      const ox = other.x + wrap * CIRCUMFERENCE, oy = other.y;
      polygon = clip(polygon, ox - site.x, oy - site.y, (ox * ox + oy * oy - site.x * site.x - site.y * site.y) / 2);
    }
    const normalize = (p: Point2) => ({ x: p.x / CIRCUMFERENCE, y: p.y / HEIGHT });
    return { center: normalize(site), polygon: polygon.map(normalize) };
  });
}

const PROFILE = [[.85, -2.7], [1.65, -2.2], [2.15, -1.1], [2.2, .2], [1.7, 1.3], [.95, 2.15], [1.05, 2.6]];
/** Smooth Hermite profile, shared by all fragments and the gold underneath. */
export function porcelainRadius(y: number) {
  let i = 0;
  while (i < PROFILE.length - 2 && y > PROFILE[i + 1][1]) i++;
  const [r0, y0] = PROFILE[i], [r1, y1] = PROFILE[i + 1];
  const previous = PROFILE[Math.max(0, i - 1)], next = PROFILE[Math.min(PROFILE.length - 1, i + 2)];
  const t = Math.max(0, Math.min(1, (y - y0) / (y1 - y0))), t2 = t * t, t3 = t2 * t;
  const m0 = (r1 - previous[0]) / (y1 - previous[1]), m1 = (next[0] - r0) / (next[1] - y0);
  return (2 * t3 - 3 * t2 + 1) * r0 + (t3 - 2 * t2 + t) * m0 * (y1 - y0)
    + (-2 * t3 + 3 * t2) * r1 + (t3 - t2) * m1 * (y1 - y0);
}

export function porcelainPoint(p: Point2, inset = 0): [number, number, number] {
  const angle = p.x * Math.PI * 2, y = p.y * HEIGHT - 2.7, r = porcelainRadius(y) - inset;
  return [Math.sin(angle) * r, y, Math.cos(angle) * r];
}

/** Curved front/back and real cut faces, baked once; animation only moves rigid fragment groups. */
export function porcelainGeometry(cell: PorcelainCell) {
  const outline: Point2[] = [];
  for (let i = 0; i < cell.polygon.length; i++) {
    const a = cell.polygon[i], b = cell.polygon[(i + 1) % cell.polygon.length];
    const steps = Math.max(1, Math.ceil(Math.hypot((b.x - a.x) * CIRCUMFERENCE, (b.y - a.y) * HEIGHT) / .12));
    for (let k = 0; k < steps; k++) {
      const x = a.x + (b.x - a.x) * k / steps, y = a.y + (b.y - a.y) * k / steps;
      outline.push({ x: cell.center.x + (x - cell.center.x) * .984, y: cell.center.y + (y - cell.center.y) * .984 });
    }
  }
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  const rings = Math.max(2, Math.ceil(Math.max(...outline.map(p => Math.hypot((p.x - cell.center.x) * CIRCUMFERENCE, (p.y - cell.center.y) * HEIGHT))) / .12));
  const vertex = (p: Point2, inset: number, sign: number) => {
    const xyz = porcelainPoint(p, inset), angle = p.x * Math.PI * 2;
    const slope = (porcelainRadius(xyz[1] + .001) - porcelainRadius(xyz[1] - .001)) / .002;
    const n = Math.hypot(1, slope);
    positions.push(...xyz); normals.push(sign * Math.sin(angle) / n, -sign * slope / n, sign * Math.cos(angle) / n); uvs.push(p.x, p.y);
    return positions.length / 3 - 1;
  };
  for (const side of [0, 1]) {
    const offset = positions.length / 3, sign = side === 0 ? 1 : -1;
    vertex(cell.center, side * .075, sign);
    for (let ring = 1; ring <= rings; ring++) for (const p of outline) {
      vertex({ x: cell.center.x + (p.x - cell.center.x) * ring / rings, y: cell.center.y + (p.y - cell.center.y) * ring / rings }, side * .075, sign);
    }
    const tri = (a: number, b: number, c: number) => side === 0 ? indices.push(a, b, c) : indices.push(a, c, b);
    for (let i = 0; i < outline.length; i++) {
      const j = (i + 1) % outline.length;
      tri(offset, offset + 1 + i, offset + 1 + j);
      for (let ring = 1; ring < rings; ring++) {
        const a = offset + 1 + (ring - 1) * outline.length + i, b = offset + 1 + (ring - 1) * outline.length + j;
        const c = a + outline.length, d = b + outline.length;
        tri(a, c, b); tri(b, c, d);
      }
    }
  }
  const shellCount = indices.length;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length], offset = positions.length / 3;
    const pts = [porcelainPoint(a), porcelainPoint(b), porcelainPoint(a, .075), porcelainPoint(b, .075)];
    const e = pts[1].map((n, k) => n - pts[0][k]), f = pts[2].map((n, k) => n - pts[0][k]);
    const normal = [e[1] * f[2] - e[2] * f[1], e[2] * f[0] - e[0] * f[2], e[0] * f[1] - e[1] * f[0]];
    const len = Math.hypot(...normal) || 1;
    pts.forEach(p => { positions.push(...p); normals.push(...normal.map(n => n / len)); uvs.push(a.x, a.y); });
    indices.push(offset, offset + 1, offset + 2, offset + 1, offset + 3, offset + 2);
  }
  return { positions, normals, uvs, indices, shellCount };
}
