/**
 * Geometric optics in 2D for the optics-lab scene (pure maths, no DOM, so it can be checked in Node).
 *
 * Every piece is a closed outline: flat edges and circular arcs. An arc is cut into short edges, but each edge keeps the
 * arc's true normals at its ends and the tracer interpolates between them, so a lens focuses like a lens and not like
 * a polygon. A ray hitting glass splits by the Fresnel equations into a reflected and a refracted part (or reflects
 * whole past the critical angle); the refractive index depends on the wavelength (Cauchy), so white light fans out
 * into a spectrum. Mirrors reflect, housings and screens stop the light. The result is a flat list of lit segments,
 * each with its colour, the optical path length at its start (for the light front that crawls along them) and the
 * refractive index of the medium it runs in (light is slower in glass).
 */

export type Material =
  | { kind: 'glass'; A: number; B: number; tint: [number, number, number] }
  | { kind: 'mirror' }
  | { kind: 'absorber'; albedo: [number, number, number] };

/** Cauchy coefficients (wavelength in µm): n(λ) = A + B / λ². */
export const MATERIALS = {
  acrylic: { kind: 'glass', A: 1.4812, B: 0.0048, tint: [0.62, 0.86, 0.92] },
  crown: { kind: 'glass', A: 1.5046, B: 0.0042, tint: [0.7, 0.88, 0.92] },
  flint: { kind: 'glass', A: 1.6, B: 0.0105, tint: [0.8, 0.86, 0.96] },
  diamond: { kind: 'glass', A: 2.3818, B: 0.0121, tint: [0.92, 0.96, 1] },
  water: { kind: 'glass', A: 1.3199, B: 0.0031, tint: [0.55, 0.8, 1] },
  mirror: { kind: 'mirror' },
  metal: { kind: 'absorber', albedo: [0.07, 0.075, 0.085] },
  card: { kind: 'absorber', albedo: [0.78, 0.78, 0.74] },
} satisfies Record<string, Material>;

const REF_UM = 0.55;

/** Refractive index; `dispersion` scales how much it varies with colour (1 = the real glass) around its value at 550 nm. */
export function refractiveIndex(m: { A: number; B: number }, nm: number, dispersion: number) {
  const um = nm / 1000;
  return m.A + m.B / (REF_UM * REF_UM) + dispersion * m.B * (1 / (um * um) - 1 / (REF_UM * REF_UM));
}

// ---- colour of a wavelength: CIE 1931 matching functions (Wyman, Sloan & Shirley 2013 fit) → linear sRGB.

const lobe = (x: number, mu: number, s1: number, s2: number) => {
  const t = (x - mu) / (x < mu ? s1 : s2);
  return Math.exp(-0.5 * t * t);
};

/** Linear sRGB of pure light at `nm`, out-of-gamut parts clipped, brightest channel = 1. */
export function wavelengthRGB(nm: number): [number, number, number] {
  const X = 1.056 * lobe(nm, 599.8, 37.9, 31) + 0.362 * lobe(nm, 442, 16, 26.7) - 0.065 * lobe(nm, 501.1, 20.4, 26.2);
  const Y = 0.821 * lobe(nm, 568.8, 46.9, 40.5) + 0.286 * lobe(nm, 530.9, 16.3, 31.1);
  const Z = 1.217 * lobe(nm, 437, 11.8, 36) + 0.681 * lobe(nm, 459, 26, 13.8);
  const r = Math.max(0, 3.2406 * X - 1.5372 * Y - 0.4986 * Z);
  const g = Math.max(0, -0.9689 * X + 1.8758 * Y + 0.0415 * Z);
  const b = Math.max(0, 0.0557 * X - 0.204 * Y + 1.057 * Z);
  const m = Math.max(r, g, b, 1e-6);
  return [r / m, g / m, b / m];
}

/** `count` wavelengths across 400–700 nm with colours that add up to white (1, 1, 1). */
export function whiteSpectrum(count: number): { nm: number[]; rgb: [number, number, number][] } {
  const nm: number[] = [];
  const rgb: [number, number, number][] = [];
  const sum = [0, 0, 0];
  for (let i = 0; i < count; i += 1) {
    const l = 405 + ((i + 0.5) / count) * 290;
    const c = wavelengthRGB(l);
    nm.push(l);
    rgb.push(c);
    for (let k = 0; k < 3; k += 1) sum[k] += c[k];
  }
  for (const c of rgb) for (let k = 0; k < 3; k += 1) c[k] /= sum[k];
  return { nm, rgb };
}

// ---- shapes.

export type Shape = {
  vx: Float64Array;
  vy: Float64Array;
  /** Per edge i (vertex i → i + 1, wrapping): the outward normals at its ends, equal for a flat edge. */
  n0x: Float64Array;
  n0y: Float64Array;
  n1x: Float64Array;
  n1y: Float64Array;
  /** Triangles filling the outline (indices into the vertices). */
  tris: Uint16Array;
  radius: number;
};

/** Builds a closed outline from points and arcs, in order around it (either direction). */
export class Outline {
  private xs: number[] = [];
  private ys: number[] = [];
  /** Centre of the arc edge i lies on, or null for a flat edge. */
  private centres: ([number, number] | null)[] = [];

  point(x: number, y: number) {
    this.xs.push(x);
    this.ys.push(y);
    this.centres.push(null);
    return this;
  }

  /** An arc from angle a0 to a1 (radians, either direction) of the circle (cx, cy, r). */
  arc(cx: number, cy: number, r: number, a0: number, a1: number, steps = 48) {
    const n = Math.max(2, Math.ceil((steps * Math.abs(a1 - a0)) / Math.PI));
    const sx = cx + Math.cos(a0) * r;
    const sy = cy + Math.sin(a0) * r;
    const last = this.xs.length - 1;
    if (last < 0 || Math.hypot(this.xs[last] - sx, this.ys[last] - sy) > 1e-6) this.point(sx, sy);
    for (let k = 1; k <= n; k += 1) {
      this.centres[this.xs.length - 1] = [cx, cy];
      const a = a0 + ((a1 - a0) * k) / n;
      this.point(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    return this;
  }

  build(): Shape {
    const xs = [...this.xs];
    const ys = [...this.ys];
    const centres = [...this.centres];
    if (xs.length > 1 && Math.hypot(xs[0] - xs[xs.length - 1], ys[0] - ys[xs.length - 1]) < 1e-6) {
      xs.pop();
      ys.pop();
      centres.pop();
    }
    const n = xs.length;
    let area = 0;
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      area += xs[i] * ys[j] - xs[j] * ys[i];
    }
    const s = area > 0 ? 1 : -1;
    const shape: Shape = {
      vx: Float64Array.from(xs),
      vy: Float64Array.from(ys),
      n0x: new Float64Array(n),
      n0y: new Float64Array(n),
      n1x: new Float64Array(n),
      n1y: new Float64Array(n),
      tris: earClip(xs, ys, s),
      radius: 0,
    };
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      const dx = xs[j] - xs[i];
      const dy = ys[j] - ys[i];
      const len = Math.hypot(dx, dy) || 1;
      const fx = (s * dy) / len;
      const fy = (-s * dx) / len;
      const c = centres[i];
      if (c) {
        let ax = xs[i] - c[0];
        let ay = ys[i] - c[1];
        let bx = xs[j] - c[0];
        let by = ys[j] - c[1];
        const la = Math.hypot(ax, ay) || 1;
        const lb = Math.hypot(bx, by) || 1;
        ax /= la;
        ay /= la;
        bx /= lb;
        by /= lb;
        const flip = (ax + bx) * fx + (ay + by) * fy < 0 ? -1 : 1;
        shape.n0x[i] = ax * flip;
        shape.n0y[i] = ay * flip;
        shape.n1x[i] = bx * flip;
        shape.n1y[i] = by * flip;
      } else {
        shape.n0x[i] = fx;
        shape.n0y[i] = fy;
        shape.n1x[i] = fx;
        shape.n1y[i] = fy;
      }
      shape.radius = Math.max(shape.radius, Math.hypot(xs[i], ys[i]));
    }
    return shape;
  }
}

/** Ear clipping for a simple polygon; `s` is the sign of its area. */
function earClip(xs: number[], ys: number[], s: number): Uint16Array {
  const idx = xs.map((_, i) => i);
  const out: number[] = [];
  const cross = (a: number, b: number, c: number) => (xs[b] - xs[a]) * (ys[c] - ys[a]) - (ys[b] - ys[a]) * (xs[c] - xs[a]);
  const inside = (p: number, a: number, b: number, c: number) =>
    s * cross(a, b, p) >= 0 && s * cross(b, c, p) >= 0 && s * cross(c, a, p) >= 0;
  let guard = 0;
  while (idx.length > 3 && guard < 100000) {
    guard += 1;
    let clipped = false;
    for (let i = 0; i < idx.length; i += 1) {
      const a = idx[(i + idx.length - 1) % idx.length];
      const b = idx[i];
      const c = idx[(i + 1) % idx.length];
      if (s * cross(a, b, c) <= 1e-12) continue;
      let ear = true;
      for (const p of idx) {
        if (p === a || p === b || p === c) continue;
        if (inside(p, a, b, c)) {
          ear = false;
          break;
        }
      }
      if (!ear) continue;
      out.push(a, b, c);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  if (idx.length === 3) out.push(idx[0], idx[1], idx[2]);
  return Uint16Array.from(out);
}

// ---- bodies: a shape placed in the scene.

export type Role = 'glass' | 'mirror' | 'housing' | 'screen';

export type Body = {
  shape: Shape;
  material: Material;
  role: Role;
  x: number;
  y: number;
  angle: number;
  movable: boolean;
  /** Autorotation: its turning speed and direction (0 = stays put). */
  spin: number;
  wx: Float64Array;
  wy: Float64Array;
  wn0x: Float64Array;
  wn0y: Float64Array;
  wn1x: Float64Array;
  wn1y: Float64Array;
};

export function makeBody(shape: Shape, material: Material, role: Role, x: number, y: number, angle = 0, spin = 0, movable = true): Body {
  const n = shape.vx.length;
  const b: Body = {
    shape, material, role, x, y, angle, movable, spin,
    wx: new Float64Array(n), wy: new Float64Array(n),
    wn0x: new Float64Array(n), wn0y: new Float64Array(n), wn1x: new Float64Array(n), wn1y: new Float64Array(n),
  };
  place(b);
  return b;
}

/** Refreshes the body's world-space outline after it was moved or turned. */
export function place(b: Body) {
  const c = Math.cos(b.angle);
  const s = Math.sin(b.angle);
  const sh = b.shape;
  for (let i = 0; i < sh.vx.length; i += 1) {
    b.wx[i] = b.x + sh.vx[i] * c - sh.vy[i] * s;
    b.wy[i] = b.y + sh.vx[i] * s + sh.vy[i] * c;
    b.wn0x[i] = sh.n0x[i] * c - sh.n0y[i] * s;
    b.wn0y[i] = sh.n0x[i] * s + sh.n0y[i] * c;
    b.wn1x[i] = sh.n1x[i] * c - sh.n1y[i] * s;
    b.wn1y[i] = sh.n1x[i] * s + sh.n1y[i] * c;
  }
}

export function contains(b: Body, px: number, py: number) {
  if (Math.hypot(px - b.x, py - b.y) > b.shape.radius) return false;
  let inside = false;
  const n = b.wx.length;
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    if (b.wy[i] > py !== b.wy[j] > py && px < ((b.wx[j] - b.wx[i]) * (py - b.wy[i])) / (b.wy[j] - b.wy[i]) + b.wx[i]) inside = !inside;
  }
  return inside;
}

/** Nearest crossing of the ray (o + t·d, t > tMin) with any body's outline. */
function nearest(bodies: Body[], ox: number, oy: number, dx: number, dy: number, hit: { t: number; body: number; edge: number; u: number }) {
  hit.t = Infinity;
  hit.body = -1;
  for (let bi = 0; bi < bodies.length; bi += 1) {
    const b = bodies[bi];
    const r = b.shape.radius + 1;
    const cx = b.x - ox;
    const cy = b.y - oy;
    const tc = cx * dx + cy * dy;
    if (cx * cx + cy * cy - tc * tc > r * r || tc + r < 0 || tc - r > hit.t) continue;
    const n = b.wx.length;
    for (let e = 0; e < n; e += 1) {
      const f = e + 1 === n ? 0 : e + 1;
      const ax = b.wx[e];
      const ay = b.wy[e];
      const ex = b.wx[f] - ax;
      const ey = b.wy[f] - ay;
      const den = dx * ey - dy * ex;
      if (den > -1e-12 && den < 1e-12) continue;
      const wx = ax - ox;
      const wy = ay - oy;
      const t = (wx * ey - wy * ex) / den;
      if (t <= 1e-3 || t >= hit.t) continue;
      const u = (wx * dy - wy * dx) / den;
      if (u < 0 || u > 1) continue;
      hit.t = t;
      hit.body = bi;
      hit.edge = e;
      hit.u = u;
    }
  }
}

// ---- tracing.

export type TraceSource = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  /** 0 = white light, otherwise a laser's wavelength, nm. */
  nm: number;
  /** Width of the beam (px); 0 = a single thin ray. */
  width: number;
  rays: number;
  power: number;
  /** Which light-front clock this source runs on (see the renderer's `uOn`). */
  slot: number;
};

export type TraceSettings = {
  dispersion: number;
  whiteSamples: number;
  minWeight: number;
  maxDepth: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

/** Floats per output instance: x0, y0, x1, y1, r, g, b, optical start, n (0 = a spot of light), slot, flags. */
export const SEGMENT_FLOATS = 11;
/** flags: 0 = a beam in air, 1 = a beam inside glass (it scatters, so it looks brighter), 2 = a spot where light hits. */

type Ray = { x: number; y: number; dx: number; dy: number; nm: number; r: number; g: number; b: number; w: number; start: number; inside: number; depth: number; slot: number };

export function trace(bodies: Body[], sources: TraceSource[], s: TraceSettings, out: Float32Array): number {
  const max = Math.floor(out.length / SEGMENT_FLOATS);
  let count = 0;
  const emit = (x0: number, y0: number, x1: number, y1: number, r: number, g: number, b: number, start: number, n: number, slot: number, flags: number) => {
    if (count >= max) return;
    const o = count * SEGMENT_FLOATS;
    out[o] = x0;
    out[o + 1] = y0;
    out[o + 2] = x1;
    out[o + 3] = y1;
    out[o + 4] = r;
    out[o + 5] = g;
    out[o + 6] = b;
    out[o + 7] = start;
    out[o + 8] = n;
    out[o + 9] = slot;
    out[o + 10] = flags;
    count += 1;
  };
  const stack: Ray[] = [];
  const white = whiteSpectrum(Math.max(3, s.whiteSamples));
  const whiteWide = whiteSpectrum(Math.max(3, Math.round(s.whiteSamples * 0.5)));
  for (const src of sources) {
    const len = Math.hypot(src.dx, src.dy) || 1;
    const dx = src.dx / len;
    const dy = src.dy / len;
    const rays = src.width > 0 ? Math.max(2, src.rays) : 1;
    const spectrum = src.nm > 0 ? { nm: [src.nm], rgb: [wavelengthRGB(src.nm)] } : rays > 1 ? whiteWide : white;
    for (let k = 0; k < rays; k += 1) {
      const off = rays > 1 ? (k / (rays - 1) - 0.5) * src.width : 0;
      const x = src.x - dy * off;
      const y = src.y + dx * off;
      let inside = -1;
      for (let bi = 0; bi < bodies.length; bi += 1) if (bodies[bi].role === 'glass' && contains(bodies[bi], x, y)) inside = bi;
      const w = (src.power * (rays > 1 ? 0.9 : 1)) / rays;
      for (let i = 0; i < spectrum.nm.length; i += 1) {
        const c = spectrum.rgb[i];
        stack.push({ x, y, dx, dy, nm: spectrum.nm[i], r: c[0], g: c[1], b: c[2], w, start: 0, inside, depth: 0, slot: src.slot });
      }
    }
  }
  const hit = { t: 0, body: -1, edge: 0, u: 0 };
  const exitT = (x: number, y: number, dx: number, dy: number) => {
    let t = 1e5;
    if (dx > 1e-9) t = Math.min(t, (s.x1 - x) / dx);
    if (dx < -1e-9) t = Math.min(t, (s.x0 - x) / dx);
    if (dy > 1e-9) t = Math.min(t, (s.y1 - y) / dy);
    if (dy < -1e-9) t = Math.min(t, (s.y0 - y) / dy);
    return Math.max(0, t);
  };
  while (stack.length && count < max) {
    const ray = stack.pop()!;
    const medium = ray.inside >= 0 ? bodies[ray.inside].material : null;
    const n1 = medium && medium.kind === 'glass' ? refractiveIndex(medium, ray.nm, s.dispersion) : 1;
    nearest(bodies, ray.x, ray.y, ray.dx, ray.dy, hit);
    const t = hit.body < 0 ? exitT(ray.x, ray.y, ray.dx, ray.dy) : hit.t;
    const hx = ray.x + ray.dx * t;
    const hy = ray.y + ray.dy * t;
    // Acrylic swallows a little along the way.
    const keep = ray.inside >= 0 ? Math.exp(-0.00035 * t) : 1;
    emit(ray.x, ray.y, hx, hy, ray.r * ray.w, ray.g * ray.w, ray.b * ray.w, ray.start, n1, ray.slot, ray.inside >= 0 ? 1 : 0);
    if (hit.body < 0 || ray.depth >= s.maxDepth) continue;
    const w = ray.w * keep;
    const start = ray.start + t * n1;
    const b = bodies[hit.body];
    const e = hit.edge;
    const f = e + 1 === b.wx.length ? 0 : e + 1;
    // The flat normal of the edge decides the side; the interpolated one (true to the arc) bends the light.
    const ex = b.wx[f] - b.wx[e];
    const ey = b.wy[f] - b.wy[e];
    const el = Math.hypot(ex, ey) || 1;
    let fx = ey / el;
    let fy = -ex / el;
    if (fx * b.wn0x[e] + fy * b.wn0y[e] < 0) {
      fx = -fx;
      fy = -fy;
    }
    let nx = b.wn0x[e] + (b.wn1x[e] - b.wn0x[e]) * hit.u;
    let ny = b.wn0y[e] + (b.wn1y[e] - b.wn0y[e]) * hit.u;
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl;
    ny /= nl;
    const spot = (k: number) => emit(hx, hy, hx, hy, ray.r * w * k, ray.g * w * k, ray.b * w * k, start, 0, ray.slot, 2);
    const next = (dx: number, dy: number, weight: number, inside: number) => {
      if (weight < s.minWeight) return;
      stack.push({ x: hx + dx * 0.02, y: hy + dy * 0.02, dx, dy, nm: ray.nm, r: ray.r, g: ray.g, b: ray.b, w: weight, start, inside, depth: ray.depth + 1, slot: ray.slot });
    };
    const reflect = (weight: number, inside: number) => {
      const d = ray.dx * nx + ray.dy * ny;
      let rx = ray.dx - 2 * d * nx;
      let ry = ray.dy - 2 * d * ny;
      // The smooth normal must not send the light through the surface it bounced off.
      if (Math.sign(rx * fx + ry * fy) === Math.sign(ray.dx * fx + ray.dy * fy)) {
        const df = ray.dx * fx + ray.dy * fy;
        rx = ray.dx - 2 * df * fx;
        ry = ray.dy - 2 * df * fy;
      }
      next(rx, ry, weight, inside);
    };
    if (b.material.kind === 'absorber') {
      spot(b.role === 'screen' ? 1.4 : 0.25);
      continue;
    }
    if (b.material.kind === 'mirror') {
      spot(0.25);
      reflect(w * 0.93, ray.inside);
      continue;
    }
    const entering = ray.dx * fx + ray.dy * fy < 0;
    const nGlass = refractiveIndex(b.material, ray.nm, s.dispersion);
    const na = entering ? n1 : nGlass;
    const nb = entering ? nGlass : 1;
    // Normal facing the incoming light.
    const sx = entering ? nx : -nx;
    const sy = entering ? ny : -ny;
    const cosI = Math.min(1, Math.max(0, -(ray.dx * sx + ray.dy * sy)));
    const eta = na / nb;
    const k = 1 - eta * eta * (1 - cosI * cosI);
    spot(0.3);
    if (k <= 0) {
      reflect(w, ray.inside);
      continue;
    }
    const cosT = Math.sqrt(k);
    const rs = (na * cosI - nb * cosT) / (na * cosI + nb * cosT);
    const rp = (nb * cosI - na * cosT) / (nb * cosI + na * cosT);
    const R = Math.min(1, 0.5 * (rs * rs + rp * rp));
    reflect(w * R, ray.inside);
    let tx = eta * ray.dx + (eta * cosI - cosT) * sx;
    let ty = eta * ray.dy + (eta * cosI - cosT) * sy;
    if (Math.sign(tx * fx + ty * fy) !== Math.sign(ray.dx * fx + ray.dy * fy)) {
      tx = ray.dx;
      ty = ray.dy;
    }
    const tl = Math.hypot(tx, ty) || 1;
    next(tx / tl, ty / tl, w * (1 - R), entering ? hit.body : -1);
  }
  return count;
}

// ---- ready-made pieces (local coordinates, centred on 0, 0).

/** A lens standing upright (light crossing it left↔right): `h` tall, `t` thick at the centre, faces curved by the
 * given sagittas (positive = bulging out, negative = hollow). */
export function lens(h: number, t: number, sagLeft: number, sagRight: number): Shape {
  const half = h / 2;
  const o = new Outline();
  // Right face, top to bottom.
  const xr = t / 2;
  face(o, xr, half, sagRight, 1);
  const xl = -t / 2;
  face(o, xl, half, sagLeft, -1);
  return o.build();
}

function face(o: Outline, x: number, half: number, sag: number, side: 1 | -1) {
  // The face passes through (x, 0) at its middle and (x - side·sag, ±half) at its ends.
  if (Math.abs(sag) < 1e-6) {
    if (side === 1) o.point(x, -half).point(x, half);
    else o.point(x, half).point(x, -half);
    return;
  }
  const R = (sag * sag + half * half) / (2 * Math.abs(sag));
  const a = Math.asin(Math.min(1, half / R));
  // Centre on the axis, on the side away from the bulge.
  const cx = sag > 0 ? x - side * R : x + side * R;
  if (side === 1) {
    if (sag > 0) o.arc(cx, 0, R, -a, a);
    else o.arc(cx, 0, R, Math.PI + a, Math.PI - a);
  } else if (sag > 0) o.arc(cx, 0, R, Math.PI - a, Math.PI + a);
  else o.arc(cx, 0, R, a, -a);
}

export function polygon(points: [number, number][]): Shape {
  const o = new Outline();
  for (const [x, y] of points) o.point(x, y);
  return o.build();
}

export function rectangle(w: number, h: number): Shape {
  return polygon([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]);
}

/** An equilateral prism, apex up, centred on its centroid. */
export function prism(side: number): Shape {
  const h = (side * Math.sqrt(3)) / 2;
  return polygon([[0, -(2 * h) / 3], [side / 2, h / 3], [-side / 2, h / 3]]);
}

export function disc(r: number): Shape {
  return new Outline().arc(0, 0, r, 0, Math.PI * 2, 64).build();
}

/** A half disc: flat face along the x axis through the origin (the centre of its curve), curved side below. */
export function halfDisc(r: number): Shape {
  return new Outline().point(-r, 0).point(r, 0).arc(0, 0, r, 0, Math.PI, 56).build();
}

/** A bent light guide: the band between two radii around the origin, from angle a0 to a1. */
export function arcBand(r0: number, r1: number, a0: number, a1: number): Shape {
  return new Outline().arc(0, 0, r1, a0, a1, 72).arc(0, 0, r0, a1, a0, 72).build();
}

/** A brilliant-cut stone seen from the side: table on top, crown, girdle, pavilion down to the culet (centred). */
export function brilliant(w: number): Shape {
  const h = w / 2;
  const pts: [number, number][] = [
    [-0.28 * w, 0], [0.28 * w, 0], [0.4 * w, 0.075 * w], [h, 0.16 * w], [h, 0.19 * w],
    [0.22 * w, 0.42 * w], [0, 0.62 * w], [-0.22 * w, 0.42 * w], [-h, 0.19 * w], [-h, 0.16 * w], [-0.4 * w, 0.075 * w],
  ];
  return polygon(pts.map(([x, y]) => [x, y - 0.27 * w]));
}
