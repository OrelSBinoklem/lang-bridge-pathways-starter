import type { CanvasSceneDef } from './types';
import { clamp } from './kit';
import {
  MATERIALS, SEGMENT_FLOATS, arcBand, brilliant, contains, disc, halfDisc, lens, makeBody, place, polygon, prism, rectangle,
  refractiveIndex, trace, wavelengthRGB, type Body, type Material, type TraceSource,
} from './opticsTrace';
import { WAVE_LAMBDA, createOpticsRenderer, type OpticsRenderer, type WaveSource } from './opticsGL';

/**
 * An optics bench behind the whole page: lenses, prisms, a glass cube, a mirror, a bent light guide, a diamond, water
 * drops and glass shards stand in the margins either side of the content, lasers shine through them. Rays are traced
 * with refraction, Fresnel partial reflection, total internal reflection and dispersion (white light fans out into a
 * spectrum); the light front crawls along the beams and photons stream after it. The second mode solves the wave
 * equation on a grid instead: wavefronts slow down in glass, bend, diffract and interfere.
 *
 * Holding the mouse button shines a laser from the cursor (aimed at the nearest piece of glass; the wheel or Q/E turn
 * it). Glass, mirrors and lasers in the margins can be dragged; the wheel over one turns it. R starts and stops the
 * pieces turning by themselves.
 */

export const OPTICS_SET_LABELS = ['Оптическая скамья', 'Призма и радуга', 'Куб, зеркало, световод', 'Кристаллы и капли'];
export const OPTICS_LASER_LABELS = ['Белый свет', 'Красный 650 нм', 'Зелёный 532 нм', 'Фиолетовый 405 нм'];
const LASER_NM = [0, 650, 532, 405];

type Laser = { body: Body; nm: number; width: number; rays: number; power: number; slot: number; len: number };

const CURSOR_SLOT = 15;
const MAX_SEGMENTS = 16000;
/** Light-front speed at 1×, in optical px per second. */
const LIGHT_SPEED = 650;
const NEVER = 1e9;

/** The pieces of one set, laid out in the margins either side of a centred content column `contentW` wide. */
function layout(set: number, W: number, H: number, contentW: number, rand: () => number) {
  const band = Math.max(0, (W - contentW) / 2);
  const U = clamp(Math.min(H * 0.12, Math.max(band, 180) * 0.42), 42, 150);
  const lx = Math.max(band * 0.5, U * 1.25);
  const rx = W - lx;
  const bodies: Body[] = [];
  const lasers: Laser[] = [];
  const add = (b: Body) => {
    bodies.push(b);
    return b;
  };
  /** A laser whose beam leaves its housing at (x, y). */
  const laser = (x: number, y: number, angle: number, nm: number, o: { width?: number; rays?: number; power?: number } = {}) => {
    const len = U * 0.9;
    const wid = Math.max(U * 0.3, (o.width ?? 0) + U * 0.12);
    const body = add(makeBody(rectangle(len, wid), MATERIALS.metal, 'housing', x - Math.cos(angle) * (len / 2 + 1), y - Math.sin(angle) * (len / 2 + 1), angle));
    lasers.push({ body, nm, width: o.width ?? 0, rays: o.rays ?? 1, power: o.power ?? 1, slot: lasers.length, len });
  };
  /** Where a 550 nm ray from (x, y) goes after the pieces placed so far: the start and direction of its last leg. */
  const follow = (x: number, y: number, angle: number) => {
    const out = new Float32Array(400 * SEGMENT_FLOATS);
    const n = trace(bodies, [{ x, y, dx: Math.cos(angle), dy: Math.sin(angle), nm: 550, width: 0, rays: 1, power: 1, slot: 0 }], {
      dispersion: 1, whiteSamples: 3, minWeight: 0.45, maxDepth: 40, x0: -1e4, y0: -1e4, x1: 1e4, y1: 1e4,
    }, out);
    for (let i = n - 1; i >= 0; i -= 1) {
      const o = i * SEGMENT_FLOATS;
      if (out[o + 10] > 1.5) continue;
      const dx = out[o + 2] - out[o];
      const dy = out[o + 3] - out[o + 1];
      const l = Math.hypot(dx, dy) || 1;
      return { x: out[o], y: out[o + 1], dx: dx / l, dy: dy / l };
    }
    return null;
  };
  const glass = (shape: ReturnType<typeof rectangle>, m: Material, x: number, y: number, angle: number, spin: number) =>
    add(makeBody(shape, m, 'glass', x, y, angle, spin));

  if (set === 0) {
    // Left: three lasers down through a hollow, a plano-convex and a biconvex lens (like a school optics kit).
    const ap = U * 2.3;
    ([[-1, 405], [0, 650], [1, 532]] as const).forEach(([i, nm]) => laser(lx + i * U * 0.42, H * 0.05 + U * 0.95, Math.PI / 2, nm));
    glass(lens(ap, U * 0.26, 0, -U * 0.3), MATERIALS.acrylic, lx, H * 0.28, Math.PI / 2, 0.6);
    glass(lens(ap, U * 0.55, 0, U * 0.32), MATERIALS.acrylic, lx, H * 0.47, Math.PI / 2, -0.5);
    glass(lens(ap, U * 0.72, U * 0.3, U * 0.3), MATERIALS.acrylic, lx, H * 0.66, Math.PI / 2, 0.4);
    // Right: a white bundle up through a diverging and a converging lens to a concave mirror.
    laser(rx, H * 0.95 - U * 0.1, -Math.PI / 2, 0, { width: U * 0.9, rays: 9, power: 1.2 });
    glass(lens(U * 2.1, U * 0.2, -U * 0.24, -U * 0.24), MATERIALS.crown, rx, H * 0.75, Math.PI / 2, -0.5);
    glass(lens(U * 2.5, U * 0.78, U * 0.34, U * 0.34), MATERIALS.crown, rx, H * 0.53, Math.PI / 2, 0.45);
    const R = U * 2.4;
    add(makeBody(arcBand(R, R + U * 0.12, -Math.PI / 2 - 0.48, -Math.PI / 2 + 0.48), MATERIALS.mirror, 'mirror', rx, H * 0.1 + R + U * 0.12, 0));
  } else if (set === 1) {
    // Newton's prisms: white light fans out into a spectrum, an upside-down prism across the page gathers it again;
    // below, the same the other way round, the spectrum landing on a white card.
    const n = refractiveIndex(MATERIALS.flint, 550, 1);
    const dev = 2 * Math.asin(Math.min(1, n / 2)) - Math.PI / 3;
    const side = U * 1.7;
    const dist = U * 1.9;
    const p1 = glass(prism(side), MATERIALS.flint, lx + U * 0.15, H * 0.3, -dev / 2, 0.35);
    const a1 = -dev;
    const s1 = { x: p1.x - Math.cos(a1) * dist, y: p1.y - Math.sin(a1) * dist };
    laser(s1.x, s1.y, a1, 0, { power: 1.4 });
    const e1 = follow(s1.x, s1.y, a1);
    if (e1 && e1.dx > 0.2) {
      let t = (rx - U * 0.2 - e1.x) / e1.dx;
      const y = e1.y + e1.dy * t;
      if ((y < H * 0.12 || y > H * 0.55) && Math.abs(e1.dy) > 0.05) t = (clamp(y, H * 0.12, H * 0.55) - e1.y) / e1.dy;
      glass(prism(side * 1.6), MATERIALS.flint, e1.x + e1.dx * t, e1.y + e1.dy * t, p1.angle + Math.PI, -0.3);
    }
    const p3 = glass(prism(side), MATERIALS.flint, rx - U * 0.15, H * 0.7, dev / 2, -0.35);
    const a3 = Math.PI + dev;
    const d3 = clamp((W - 10 - p3.x) / Math.max(0.2, Math.cos(dev)), U * 0.9, dist);
    const s3 = { x: p3.x - Math.cos(a3) * d3, y: p3.y - Math.sin(a3) * d3 };
    laser(s3.x, s3.y, a3, 0, { power: 1.4 });
    const e3 = follow(s3.x, s3.y, a3);
    if (e3 && e3.dx < -0.2) {
      const t = (lx - e3.x) / e3.dx;
      add(makeBody(rectangle(U * 0.1, U * 3), MATERIALS.card, 'screen', e3.x + e3.dx * t, clamp(e3.y + e3.dy * t, H * 0.1, H * 0.95), Math.atan2(e3.dy, e3.dx)));
    }
  } else if (set === 2) {
    // A glass cube with a mirror sending the light back into it: partial reflections bouncing about inside.
    const cube = glass(rectangle(U * 1.5, U * 1.5), MATERIALS.acrylic, lx + U * 0.1, H * 0.27, 0.42, 0.5);
    const ag = 0.62;
    const sx = Math.max(U * 0.2, cube.x - Math.cos(ag) * U * 1.8 - Math.sin(ag) * U * 0.18);
    const sy = cube.y - Math.sin(ag) * U * 1.8 + Math.cos(ag) * U * 0.18;
    laser(sx, sy, ag, 532);
    const out = follow(sx, sy, ag);
    if (out) {
      const mx = out.x + out.dx * U * 1.2;
      const my = out.y + out.dy * U * 1.2;
      let nx = cube.x - mx;
      let ny = cube.y - my;
      const l = Math.hypot(nx, ny) || 1;
      nx = nx / l - out.dx;
      ny = ny / l - out.dy;
      add(makeBody(rectangle(U * 0.1, U * 1.4), MATERIALS.mirror, 'mirror', mx, my, Math.atan2(ny, nx)));
    }
    // A half disc: light enters its round side straight and meets the flat face near the critical angle —
    // turning it flips between refraction and total internal reflection.
    const d = glass(halfDisc(U), MATERIALS.acrylic, lx, H * 0.7, 0, 0.45);
    const ad = -Math.PI / 2 + 0.68;
    laser(d.x - Math.cos(ad) * U * 1.8, d.y - Math.sin(ad) * U * 1.8, ad, 650);
    // Right: a bent light guide, and a straight rod the light zigzags down.
    const r0 = U * 0.72;
    const r1 = U * 1.06;
    const a0 = Math.PI / 2 + 0.95;
    const guide = add(makeBody(arcBand(r0, r1, a0, Math.PI / 2 + Math.PI * 2 - 0.95), MATERIALS.acrylic, 'glass', rx, H * 0.3, 0));
    const rm = (r0 + r1) / 2;
    const tang = a0 + Math.PI / 2;
    laser(guide.x + Math.cos(a0) * rm - Math.cos(tang) * U * 0.9, guide.y + Math.sin(a0) * rm - Math.sin(tang) * U * 0.9, tang + 0.05, 405);
    const ra = Math.PI / 2 - 0.35;
    const rod = glass(rectangle(U * 2.8, U * 0.34), MATERIALS.acrylic, rx, H * 0.72, ra, 0);
    const tx = rod.x - Math.cos(ra) * U * 1.4;
    const ty = rod.y - Math.sin(ra) * U * 1.4;
    const dir = ra + 0.42;
    laser(tx - Math.cos(dir) * U * 0.8, ty - Math.sin(dir) * U * 0.8, dir, 0, { power: 1.2 });
  } else {
    // A diamond (high index, strong dispersion: its "fire"), glass shards, and water drops making rainbows.
    const dia = glass(brilliant(U * 1.9), MATERIALS.diamond, lx, H * 0.26, 0, 0.35);
    const ad = 1.0;
    const txd = dia.x + U * 0.15;
    const tyd = dia.y - U * 0.5;
    laser(txd - Math.cos(ad) * U * 1.6, tyd - Math.sin(ad) * U * 1.6, ad, 0, { power: 1.5 });
    const shards: Body[] = [];
    const kinds = [MATERIALS.crown, MATERIALS.flint, MATERIALS.acrylic];
    for (let tries = 0; shards.length < 7 && tries < 200; tries += 1) {
      const size = U * (0.26 + rand() * 0.3);
      const x = lx + (rand() - 0.5) * U * 1.8;
      const y = H * (0.6 + rand() * 0.32);
      if (shards.some((s) => Math.hypot(s.x - x, s.y - y) < (s.shape.radius + size) * 0.9)) continue;
      const count = rand() < 0.5 ? 3 : 4;
      const pts: [number, number][] = [];
      for (let k = 0; k < count; k += 1) {
        const a = ((k + rand() * 0.6) / count) * Math.PI * 2;
        const r = size * (0.55 + rand() * 0.45);
        pts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      shards.push(glass(polygon(pts), kinds[Math.floor(rand() * kinds.length)], x, y, rand() * Math.PI * 2, (rand() < 0.5 ? -1 : 1) * (0.3 + rand() * 0.5)));
    }
    const aim = Math.atan2(H * 0.76 - H * 0.52, lx - U * 0.2);
    laser(U * 0.2, H * 0.52, aim, 0, { power: 0.9 });
    glass(disc(U * 0.6), MATERIALS.water, rx, H * 0.3, 0, 0);
    glass(disc(U * 0.42), MATERIALS.water, rx - U * 0.4, H * 0.58, 0, 0);
    glass(disc(U * 0.3), MATERIALS.water, rx + U * 0.35, H * 0.8, 0, 0);
    laser(rx + U * 0.1, H * 0.04 + U * 0.9, Math.PI / 2 + 0.05, 0, { width: U * 1.25, rays: 12, power: 1.6 });
  }
  return { bodies, lasers, U };
}

export const OPTICS_LAB: CanvasSceneDef = {
  kind: 'canvas',
  id: 'optics-lab',
  label: 'Оптика: лучи и волны',
  palettes: [['#05070a', '#ff3b30', '#39ff6a', '#8a4bff']],
  // The owner's pick from the panel.
  defaultParams: {
    opticsMode: 0, opticsSet: 3, opticsLaser: 0, opticsAutoRotate: true, opticsSpin: 0.09375, opticsDispersion: 8.3,
    opticsBeamSpeed: 1.65, opticsPulses: 0, opticsGlow: 0.85, opticsWaveView: 2, opticsWaveSpeed: 3, opticsWaveCell: 2,
  },
  create(c) {
    const W = c.width;
    const H = c.height;
    const p = c.params;
    const contentW = c.body ? Math.min(1240, W - 64) : W * 0.3;
    const channelColors = [wavelengthRGB(650), wavelengthRGB(532), wavelengthRGB(450)];
    let cell = clamp(Number(p.opticsWaveCell) || 2, 1, 6);
    let renderer: OpticsRenderer | null = createOpticsRenderer(W, H, c.dpr, cell, channelColors);

    let set = -1;
    let bodies: Body[] = [];
    let lasers: Laser[] = [];
    let fill = new Float32Array(0);
    let medium = new Float32Array(0);
    let rims = new Float32Array(0);
    let fillVertices = 0;
    let rimCount = 0;
    const segs = new Float32Array(MAX_SEGMENTS * SEGMENT_FLOATS);
    let segCount = 0;
    let traceMs = 0;
    const on = new Float32Array(16).fill(NEVER);
    let now = 0;
    let geometryDirty = true;
    let beamsDirty = true;
    let clearWaves = true;
    let lastMode = -1;
    let lastRestart = p.opticsRestart;
    let lastDispersion = p.opticsDispersion;
    let lastLaser = p.opticsLaser;

    let hovered: Body | null = null;
    let drag: { body: Body; dx: number; dy: number } | null = null;
    let cursorOn = false;
    let aim = 0;
    let cursorX = 0;
    let cursorY = 0;
    let cursorStyle = '';

    const ignite = () => {
      lasers.forEach((l, i) => {
        on[l.slot] = now + 0.25 + i * 0.45;
      });
      beamsDirty = true;
    };
    const build = (k: number) => {
      set = k;
      const made = layout(k, W, H, contentW, c.rand);
      bodies = made.bodies;
      lasers = made.lasers;
      on.fill(NEVER);
      let tris = 0;
      let edges = 0;
      for (const b of bodies) {
        tris += b.shape.tris.length;
        edges += b.shape.vx.length;
      }
      fill = new Float32Array(tris * 6);
      medium = new Float32Array(tris * 6);
      rims = new Float32Array(edges * SEGMENT_FLOATS);
      fillVertices = tris;
      rimCount = edges;
      hovered = null;
      drag = null;
      geometryDirty = true;
      clearWaves = true;
      ignite();
    };

    const uploadBodies = () => {
      let v = 0;
      let r = 0;
      const disp = p.opticsDispersion;
      for (const b of bodies) {
        const m = b.material;
        let col: number[];
        let med: number[];
        let rim: number[];
        if (m.kind === 'glass') {
          col = [...m.tint, 0.55];
          med = [650, 532, 450].map((nm) => (refractiveIndex(m, nm, disp) - 1) / 2).concat(0);
          rim = m.tint.map((x) => x * 0.55);
        } else if (m.kind === 'mirror') {
          col = [0.74, 0.77, 0.82, 1];
          med = [0, 0, 0, 1];
          rim = [0.9, 0.92, 0.96];
        } else {
          col = [...m.albedo, 1];
          med = [0, 0, 0, 0.5];
          rim = b.role === 'screen' ? [0.35, 0.35, 0.33] : [0.22, 0.23, 0.25];
        }
        const k = b === hovered || b === drag?.body ? 2.4 : 1;
        for (const i of b.shape.tris) {
          const o = v * 6;
          fill[o] = b.wx[i];
          fill[o + 1] = b.wy[i];
          medium[o] = b.wx[i];
          medium[o + 1] = b.wy[i];
          for (let q = 0; q < 4; q += 1) {
            fill[o + 2 + q] = col[q];
            medium[o + 2 + q] = med[q];
          }
          v += 1;
        }
        const n = b.wx.length;
        for (let e = 0; e < n; e += 1) {
          const f = e + 1 === n ? 0 : e + 1;
          const o = r * SEGMENT_FLOATS;
          rims[o] = b.wx[e];
          rims[o + 1] = b.wy[e];
          rims[o + 2] = b.wx[f];
          rims[o + 3] = b.wy[f];
          rims[o + 4] = rim[0] * k;
          rims[o + 5] = rim[1] * k;
          rims[o + 6] = rim[2] * k;
          rims[o + 7] = -NEVER;
          rims[o + 8] = 1;
          rims[o + 9] = 0;
          rims[o + 10] = 0;
          r += 1;
        }
      }
      renderer?.setBodies(fill, fillVertices, medium, fillVertices, rims, rimCount);
    };

    const sourceOf = (l: Laser) => {
      const a = l.body.angle;
      const d = l.len / 2 + 2;
      return { x: l.body.x + Math.cos(a) * d, y: l.body.y + Math.sin(a) * d, dx: Math.cos(a), dy: Math.sin(a) };
    };
    const cursorNm = () => LASER_NM[clamp(Math.round(Number(p.opticsLaser)), 0, 3)];
    const traceSources = (): TraceSource[] => {
      const list: TraceSource[] = lasers.map((l) => ({ ...sourceOf(l), nm: l.nm, width: l.width, rays: l.rays, power: l.power, slot: l.slot }));
      if (cursorOn) list.push({ x: cursorX, y: cursorY, dx: Math.cos(aim), dy: Math.sin(aim), nm: cursorNm(), width: 0, rays: 1, power: 1.3, slot: CURSOR_SLOT });
      return list;
    };
    const channels = (nm: number) => (nm === 0 ? [1, 1, 1] : nm >= 590 ? [1, 0, 0] : nm >= 490 ? [0, 1, 0] : [0, 0, 1]);
    const waveSources = (): WaveSource[] => {
      const ahead = (WAVE_LAMBDA[0] * 0.25 + 3) * cell;
      const minHalf = 2.4 * WAVE_LAMBDA[0] * cell;
      const list: WaveSource[] = [];
      const push = (x: number, y: number, dx: number, dy: number, nm: number, width: number, slot: number) => {
        const [r, g, b] = channels(nm);
        list.push({ x: x + dx * ahead, y: y + dy * ahead, dx, dy, r, g, b, halfWidth: Math.max(width / 2, minHalf), amp: clamp((now - on[slot]) / 1.5, 0, 1) ** 2 });
      };
      for (const l of lasers) {
        const s = sourceOf(l);
        push(s.x, s.y, s.dx, s.dy, l.nm, l.width, l.slot);
      }
      if (cursorOn) push(cursorX, cursorY, Math.cos(aim), Math.sin(aim), cursorNm(), 0, CURSOR_SLOT);
      return list;
    };

    const nearEdge = (b: Body, x: number, y: number, tol: number) => {
      if (Math.hypot(x - b.x, y - b.y) > b.shape.radius + tol) return false;
      const n = b.wx.length;
      for (let e = 0; e < n; e += 1) {
        const f = e + 1 === n ? 0 : e + 1;
        const ex = b.wx[f] - b.wx[e];
        const ey = b.wy[f] - b.wy[e];
        const t = clamp(((x - b.wx[e]) * ex + (y - b.wy[e]) * ey) / (ex * ex + ey * ey || 1), 0, 1);
        if (Math.hypot(x - b.wx[e] - ex * t, y - b.wy[e] - ey * t) < tol) return true;
      }
      return false;
    };
    const pick = (x: number, y: number) => {
      for (let i = bodies.length - 1; i >= 0; i -= 1) if (bodies[i].movable && contains(bodies[i], x, y)) return bodies[i];
      for (let i = bodies.length - 1; i >= 0; i -= 1) if (bodies[i].movable && nearEdge(bodies[i], x, y, 7)) return bodies[i];
      return null;
    };
    const aimAtNearest = (x: number, y: number) => {
      let best = Infinity;
      let angle = aim;
      for (const b of bodies) {
        if (b.role !== 'glass') continue;
        const d = Math.hypot(b.x - x, b.y - y);
        if (d < best && d > 4) {
          best = d;
          angle = Math.atan2(b.y - y, b.x - x);
        }
      }
      return angle;
    };
    const turn = (amount: number) => {
      if (cursorOn) {
        aim += amount;
        beamsDirty = true;
      } else if (hovered) {
        hovered.angle += amount;
        place(hovered);
        geometryDirty = true;
      }
    };

    const onWheel = (event: WheelEvent) => {
      if (!cursorOn && !hovered) return;
      event.preventDefault();
      turn(clamp(event.deltaY, -120, 120) * 0.0024);
    };
    const onKey = (event: KeyboardEvent) => {
      const t = event.target as HTMLElement | null;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const k = event.key.toLowerCase();
      if (k === 'q' || k === 'й') turn(-0.07);
      else if (k === 'e' || k === 'у') turn(0.07);
      else if (k === 'r' || k === 'к') p.opticsAutoRotate = !p.opticsAutoRotate;
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    const setCursor = (value: string) => {
      if (!c.body || value === cursorStyle) return;
      cursorStyle = value;
      document.body.style.cursor = value;
    };

    const fallback = (g: CanvasRenderingContext2D) => {
      g.fillStyle = '#05070a';
      g.fillRect(0, 0, W, H);
      for (const b of bodies) {
        g.beginPath();
        b.wx.forEach((x, i) => (i ? g.lineTo(x, b.wy[i]) : g.moveTo(x, b.wy[i])));
        g.closePath();
        g.fillStyle = b.role === 'glass' ? 'rgba(150,210,230,0.12)' : b.role === 'mirror' ? '#b8bec8' : b.role === 'screen' ? '#c8c8c0' : '#15171b';
        g.fill();
        g.strokeStyle = 'rgba(200,230,240,0.35)';
        g.stroke();
      }
      g.globalCompositeOperation = 'lighter';
      g.lineWidth = 1.6;
      for (let i = 0; i < segCount; i += 1) {
        const o = i * SEGMENT_FLOATS;
        if (segs[o + 10] > 1.5) continue;
        const k = (v: number) => Math.round(clamp(v * 1.6, 0, 1) * 255);
        g.strokeStyle = `rgb(${k(segs[o + 4])},${k(segs[o + 5])},${k(segs[o + 6])})`;
        g.beginPath();
        g.moveTo(segs[o], segs[o + 1]);
        g.lineTo(segs[o + 2], segs[o + 3]);
        g.stroke();
      }
      g.globalCompositeOperation = 'source-over';
    };

    return {
      update(dt, t, ptr) {
        now = t;
        const nextSet = clamp(Math.round(Number(p.opticsSet)), 0, OPTICS_SET_LABELS.length - 1);
        if (nextSet !== set) build(nextSet);
        const nextCell = clamp(Number(p.opticsWaveCell) || 2, 1, 6);
        if (nextCell !== cell) {
          cell = nextCell;
          renderer?.dispose();
          renderer = createOpticsRenderer(W, H, c.dpr, cell, channelColors);
          geometryDirty = true;
          beamsDirty = true;
          clearWaves = true;
        }
        const mode = Number(p.opticsMode) === 1 && renderer?.waves ? 1 : 0;
        if (mode !== lastMode) {
          lastMode = mode;
          clearWaves = true;
          ignite();
        }
        if (p.opticsRestart !== lastRestart) {
          lastRestart = p.opticsRestart;
          clearWaves = true;
          ignite();
        }
        if (p.opticsDispersion !== lastDispersion) {
          lastDispersion = p.opticsDispersion;
          geometryDirty = true;
        }
        if (p.opticsLaser !== lastLaser) {
          lastLaser = p.opticsLaser;
          beamsDirty = true;
        }

        // The cursor: grab a piece in the margins, or shine a laser.
        const inContent = c.body && Math.abs(ptr.rawX - W / 2) < contentW / 2;
        const over = ptr.active && !inContent && !drag && !cursorOn ? pick(ptr.rawX, ptr.rawY) : drag?.body ?? null;
        if (over !== hovered) {
          hovered = over;
          geometryDirty = true;
        }
        if (ptr.clicked && p.react > 0) {
          if (hovered) drag = { body: hovered, dx: ptr.rawX - hovered.x, dy: ptr.rawY - hovered.y };
          else {
            cursorOn = true;
            cursorX = ptr.rawX;
            cursorY = ptr.rawY;
            aim = aimAtNearest(cursorX, cursorY);
            on[CURSOR_SLOT] = now;
            beamsDirty = true;
          }
        }
        if (!ptr.pressed) {
          if (drag) {
            drag = null;
            geometryDirty = true;
          }
          if (cursorOn) {
            cursorOn = false;
            on[CURSOR_SLOT] = NEVER;
            beamsDirty = true;
          }
        }
        if (drag) {
          const x = ptr.rawX - drag.dx;
          const y = ptr.rawY - drag.dy;
          if (x !== drag.body.x || y !== drag.body.y) {
            drag.body.x = x;
            drag.body.y = y;
            place(drag.body);
            geometryDirty = true;
          }
        }
        if (cursorOn && (ptr.rawX !== cursorX || ptr.rawY !== cursorY)) {
          cursorX = ptr.rawX;
          cursorY = ptr.rawY;
          beamsDirty = true;
        }
        if (p.opticsAutoRotate && p.opticsSpin > 0) {
          for (const b of bodies) {
            if (!b.spin || b === drag?.body) continue;
            b.angle += dt * b.spin * p.opticsSpin;
            place(b);
            geometryDirty = true;
          }
        }
        setCursor(drag ? 'grabbing' : hovered ? 'grab' : cursorOn ? 'crosshair' : '');

        if (geometryDirty) {
          uploadBodies();
          geometryDirty = false;
          beamsDirty = true;
        }
        if (beamsDirty && (mode === 0 || !renderer)) {
          const t0 = performance.now();
          segCount = trace(bodies, traceSources(), {
            dispersion: p.opticsDispersion, whiteSamples: 36, minWeight: 0.012, maxDepth: 40, x0: -40, y0: -40, x1: W + 40, y1: H + 40,
          }, segs);
          traceMs += (performance.now() - t0 - traceMs) * 0.2;
          renderer?.setBeams(segs, segCount);
          beamsDirty = false;
        }
        p.opticsStats = mode === 1 && renderer
          ? `${renderer.simWidth}×${renderer.simHeight} клеток · ${Math.round(clamp(8 * p.opticsWaveSpeed, 1, 24))} шагов/кадр`
          : `${segCount} отрезков · ${traceMs.toFixed(1)} мс`;
      },
      draw(g) {
        if (!renderer) {
          fallback(g);
          return;
        }
        renderer.render({
          mode: lastMode,
          now,
          speed: LIGHT_SPEED * p.opticsBeamSpeed,
          on,
          pulses: p.opticsPulses,
          glow: p.opticsGlow * p.intensity,
          exposure: 0.9 + 0.4 * p.intensity,
          waveView: Number(p.opticsWaveView),
          waveSteps: Math.round(clamp(8 * p.opticsWaveSpeed, 1, 24)),
          sources: lastMode === 1 ? waveSources() : [],
          clearWaves,
        });
        clearWaves = false;
        g.drawImage(renderer.canvas, 0, 0, W, H);
      },
      dispose() {
        window.removeEventListener('wheel', onWheel);
        window.removeEventListener('keydown', onKey);
        setCursor('');
        renderer?.dispose();
        renderer = null;
      },
    };
  },
};
