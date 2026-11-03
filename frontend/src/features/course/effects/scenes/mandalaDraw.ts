import type { CanvasSceneDef, ScenePointer } from './types';
import { clamp } from './kit';

/**
 * An experimental effect: a kaleidoscope drawing board for Indian-style patterns (mandala, rangoli, mehndi).
 *
 * The screen is tiled with identical flat-top hexagons, each cut into six 60° sectors around its centre. Whatever is
 * drawn anywhere shows at once in every sector of every hexagon: all strokes live in one canonical sector (sector 0,
 * radius 1) and are painted into a single hexagon canvas six times (rotations by 60°) or twelve (with the mirror on,
 * as in a real kaleidoscope, each sector is also symmetric about its middle line); that canvas is then stamped over
 * the whole screen. With the mirror on the pattern also runs on seamlessly across the hexagons' borders — the line
 * through a hexagon's centre parallel to an edge is one of its mirror axes, so the neighbour holds the reflection.
 * While the button is held the pen is locked into the sector where the press began: the point is clamped into that
 * sector's triangle, so a stroke never jumps over into the next sector or hexagon.
 *
 * A toolbar on top: 10 colours, three brushes (line, dots, petals), three thicknesses, mirror, hexagon size,
 * background, undo, a new generated pattern and clear. Until somebody draws, the board draws generated mandalas by
 * itself, ring by ring, and makes a new one now and then.
 */

const SQ3 = Math.sqrt(3);
const SECTOR = Math.PI / 3;
const D2R = Math.PI / 180;

const COLORS = ['#fff4e0', '#e8b923', '#ff9933', '#e23d28', '#e0218a', '#8a4fd6', '#0f8a9c', '#35d0c0', '#27a35f', '#7b3f00'];
const COLOR_NAMES = ['Белый', 'Золото', 'Шафран', 'Киноварь', 'Розовый', 'Фиолетовый', 'Павлиний', 'Бирюза', 'Изумруд', 'Хна'];
const BACKGROUNDS = [
  { name: 'Ночь', top: '#221541', bottom: '#0b0719', guide: 'rgba(255,236,200,', light: false },
  { name: 'Камень', top: '#3b342f', bottom: '#1b1714', guide: 'rgba(255,236,200,', light: false },
  { name: 'Бумага', top: '#f9f1df', bottom: '#e8d8b8', guide: 'rgba(90,60,30,', light: true },
  { name: 'Хна на коже', top: '#f0cda6', bottom: '#d3a27a', guide: 'rgba(90,40,10,', light: true },
];
const WIDTHS = [0.012, 0.024, 0.046];
// The hexagon sizes the toolbar steps through (of the shorter side); the middle one by default (owner: «по дефолту
// покрупнее соты»).
const HEX_SIZES = [0.16, 0.24, 0.33];

/** kind: 0 line, 1 dots along the path, 2 petals along the path, 3 one petal [x, y, angle, length], 4 one dot [x, y]. */
type Stroke = { kind: number; color: string; width: number; mirror: boolean; pts: number[] };

type Item = { id: string; x: number; y: number; s: number; label: string; w?: number };

const mid = (a: number, b: number) => (a + b) / 2;

/** The point of triangle ABC nearest to P (Ericson, Real-Time Collision Detection 5.1.5). */
function closestInTriangle(px: number, py: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number): [number, number] {
  const abx = bx - ax, aby = by - ay, acx = cx - ax, acy = cy - ay;
  const apx = px - ax, apy = py - ay;
  const d1 = abx * apx + aby * apy, d2 = acx * apx + acy * apy;
  if (d1 <= 0 && d2 <= 0) return [ax, ay];
  const bpx = px - bx, bpy = py - by;
  const d3 = abx * bpx + aby * bpy, d4 = acx * bpx + acy * bpy;
  if (d3 >= 0 && d4 <= d3) return [bx, by];
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return [ax + abx * v, ay + aby * v];
  }
  const cpx = px - cx, cpy = py - cy;
  const d5 = abx * cpx + aby * cpy, d6 = acx * cpx + acy * cpy;
  if (d6 >= 0 && d5 <= d6) return [cx, cy];
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    return [ax + acx * w, ay + acy * w];
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    return [bx + (cx - bx) * w, by + (cy - by) * w];
  }
  return [px, py];
}

/** Petal (a teardrop, tip at +x) of the given length and breadth around the origin. */
function petalPath(path: Path2D, x: number, y: number, angle: number, len: number, breadth: number) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const pt = (u: number, v: number): [number, number] => [x + u * c - v * s, y + u * s + v * c];
  const h = len / 2, b = breadth / 2;
  const tip = pt(h, 0);
  path.moveTo(tip[0], tip[1]);
  const c1 = pt(h * 0.1, -b * 1.25), c2 = pt(-h * 1.05, -b * 1.05), base = pt(-h, 0);
  path.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], base[0], base[1]);
  const c3 = pt(-h * 1.05, b * 1.05), c4 = pt(h * 0.1, b * 1.25);
  path.bezierCurveTo(c3[0], c3[1], c4[0], c4[1], tip[0], tip[1]);
  path.closePath();
}

/** Stamps along a polyline from point `from` on, every `spacing`; returns the distance left over for the next call. */
function stampAlong(pts: number[], from: number, spacing: number, carry: number, stamp: (x: number, y: number, dir: number) => void): number {
  let left = carry;
  for (let i = Math.max(1, from); i < pts.length / 2; i += 1) {
    const x0 = pts[i * 2 - 2], y0 = pts[i * 2 - 1], x1 = pts[i * 2], y1 = pts[i * 2 + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 1e-9) continue;
    const dir = Math.atan2(y1 - y0, x1 - x0);
    let d = left;
    while (d <= len) {
      stamp(x0 + ((x1 - x0) * d) / len, y0 + ((y1 - y0) * d) / len, dir);
      d += spacing;
    }
    left = d - len;
  }
  return left;
}

/** A generated mandala in the canonical sector (radius 1), ring by ring from the centre; mirror on. */
function generateMandala(rand: () => number, light: boolean): Stroke[] {
  const out: Stroke[] = [];
  const pool = COLORS.filter((_, i) => (light ? i !== 0 : i !== 9));
  const colors: string[] = [];
  while (colors.length < 4) {
    const c = pool[Math.floor(rand() * pool.length)];
    if (!colors.includes(c)) colors.push(c);
  }
  let ci = 0;
  const next = () => colors[(ci += 1) % colors.length];
  const P = (r: number, deg: number): [number, number] => [r * Math.cos(deg * D2R), r * Math.sin(deg * D2R)];
  const add = (kind: number, color: string, width: number, pts: number[]) => out.push({ kind, color, width, mirror: true, pts });
  const curve = (rf: (deg: number) => number, a0 = 0, a1 = 30, steps = 30) => {
    const pts: number[] = [];
    for (let i = 0; i <= steps; i += 1) {
      const d = a0 + ((a1 - a0) * i) / steps;
      pts.push(...P(rf(d), d));
    }
    return pts;
  };
  const line = 0.009 + rand() * 0.006;
  // The centre: a disc and a small flower.
  add(4, next(), 0.07 + rand() * 0.04, [0, 0]);
  add(4, next(), 0.03, [0, 0]);
  let r = 0.07;
  let last = -1;
  while (r < 0.74) {
    let type = Math.floor(rand() * 7);
    if (type === last) type = (type + 1) % 7;
    last = type;
    const c = next();
    if (type === 0 || type === 1) {
      // A ring of double petals: 6, 12 or 24 of them.
      const len = 0.07 + rand() * 0.09 * (1 + r);
      const angles = [[15], [0, 30], [7.5, 22.5]][Math.floor(rand() * 3)];
      const inner = next();
      for (const a of angles) {
        add(3, c, len * (0.42 + rand() * 0.12), [...P(r + len / 2, a), a * D2R, len]);
        add(3, inner, len * 0.22, [...P(r + len * 0.55, a), a * D2R, len * 0.55]);
      }
      r += len + 0.015;
    } else if (type === 2) {
      // A ring of dots.
      const step = [5, 7.5, 10, 15][Math.floor(rand() * 4)];
      const size = 0.012 + rand() * 0.018;
      for (let a = 0; a <= 30.01; a += step) add(4, c, size, P(r + size, a));
      r += size * 2 + 0.02;
    } else if (type === 3) {
      // A circle, sometimes doubled.
      add(0, c, line, curve(() => r));
      if (rand() < 0.5) add(0, next(), line * 0.7, curve(() => r + 0.018));
      r += 0.035;
    } else if (type === 4) {
      // Scallops: 6, 12 or 18 arches.
      const n = [3, 6, 9][Math.floor(rand() * 3)];
      const depth = 0.03 + rand() * 0.05;
      add(0, c, line, curve((d) => r + depth * Math.abs(Math.sin(n * d * D2R)), 0, 30, 60));
      if (rand() < 0.6) add(0, next(), line * 0.8, curve((d) => r + depth * 0.45 * Math.abs(Math.sin(n * d * D2R)), 0, 30, 60));
      r += depth + 0.025;
    } else if (type === 5) {
      // A zigzag band between two circles.
      const n = [6, 12][Math.floor(rand() * 2)];
      const amp = 0.025 + rand() * 0.03;
      add(0, c, line, curve((d) => r + amp * (1 - Math.abs(((n * d) / 60) % 2 - 1) * 2 + 1) / 2, 0, 30, 90));
      add(0, next(), line * 0.7, curve(() => r - 0.008));
      add(0, next(), line * 0.7, curve(() => r + amp + 0.008));
      r += amp + 0.03;
    } else {
      // Rays with a dot on each.
      const len = 0.05 + rand() * 0.06;
      const angles = rand() < 0.5 ? [0, 30] : [0, 15, 30];
      for (const a of angles) {
        add(0, c, line, [...P(r, a), ...P(r + len, a)]);
        add(4, next(), line * 3.2, P(r + len + line * 2, a));
      }
      r += len + 0.03;
    }
  }
  // Where hexagons meet: petals on the edges (they close into lenses with the neighbour's) and flowers at the corners.
  const edge = next();
  const lensLen = 0.16 + rand() * 0.08;
  add(3, edge, lensLen * 0.5, [...P(SQ3 / 2 - lensLen / 2 + 0.01, 30), 30 * D2R, lensLen]);
  add(4, next(), 0.1 + rand() * 0.05, [1, 0]);
  add(4, next(), 0.045, [1, 0]);
  // An inner hexagon frame, when there is room for it.
  if (r < 0.8) add(0, next(), line, [...P(0.86, 0), ...P(0.86 * (SQ3 / 2), 30)]);
  return out;
}

export const MANDALA_DRAW: CanvasSceneDef = {
  kind: 'canvas',
  id: 'mandala',
  label: 'Узоры-калейдоскоп: рисование',
  palettes: [['#221541', '#0b0719']],
  create(c) {
    const W = c.width;
    const H = c.height;
    const dpr = c.dpr;
    const rand = c.rand;
    // Expanded card compositions get the full tools back; only the small embedded card is simplified.
    const compact = !c.body && H < 480;
    let colorIdx = 1;
    let brush = 0;
    let sizeIdx = compact ? 0 : 1;
    let mirror = true;
    let hexIdx = 1;
    let bgIdx = 0;
    let strokes: Stroke[] = [];
    let queue: Stroke[] = [];
    let queueRate = 0;
    let queueCarry = 0;
    let userDrew = false;
    let idleFor = 0;

    // --- geometry ---------------------------------------------------------------------------------------------
    let R = 0;
    const ox = W / 2;
    const oy = H / 2 + 12;
    let hex = document.createElement('canvas');
    let hg = hex.getContext('2d')!;
    let hcx = 0;
    let hcy = 0;
    const screen = document.createElement('canvas');
    screen.width = Math.max(1, Math.round(W * dpr));
    screen.height = Math.max(1, Math.round(H * dpr));
    const sg = screen.getContext('2d')!;
    let centers: [number, number][] = [];
    let guides = new Path2D();
    let dirty = true;

    const hexPath = (path: Path2D | CanvasRenderingContext2D, x: number, y: number, r: number) => {
      for (let k = 0; k < 6; k += 1) {
        const a = k * SECTOR;
        if (k === 0) path.moveTo(x + r * Math.cos(a), y + r * Math.sin(a));
        else path.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
      }
      path.closePath();
    };

    const layoutHexes = () => {
      R = Math.max(34, Math.min(W, H) * HEX_SIZES[hexIdx] * (W < 700 ? 1.15 : 1));
      const margin = 2;
      hex = document.createElement('canvas');
      hex.width = 2 * Math.ceil((R + margin) * dpr);
      hex.height = 2 * Math.ceil(((SQ3 / 2) * R + margin) * dpr);
      hg = hex.getContext('2d')!;
      hcx = hex.width / 2;
      hcy = hex.height / 2;
      centers = [];
      guides = new Path2D();
      const colW = 1.5 * R;
      const rowH = SQ3 * R;
      for (let i = Math.floor(-(ox + R) / colW) - 1; i <= Math.ceil((W - ox + R) / colW) + 1; i += 1) {
        const shift = ((i % 2) + 2) % 2 ? rowH / 2 : 0;
        for (let j = Math.floor(-(oy + R) / rowH) - 1; j <= Math.ceil((H - oy + R) / rowH) + 1; j += 1) {
          const x = ox + colW * i;
          const y = oy + rowH * j + shift;
          if (x < -R || x > W + R || y < -R || y > H + R) continue;
          centers.push([x, y]);
          hexPath(guides, x, y, R);
          for (let k = 0; k < 3; k += 1) {
            guides.moveTo(x + R * Math.cos(k * SECTOR), y + R * Math.sin(k * SECTOR));
            guides.lineTo(x - R * Math.cos(k * SECTOR), y - R * Math.sin(k * SECTOR));
          }
        }
      }
    };

    /** Nearest hexagon centre (axial rounding). */
    const hexAt = (x: number, y: number): [number, number] => {
      const px = (x - ox) / R;
      const py = (y - oy) / R;
      const q = (2 / 3) * px;
      const r = (-1 / 3) * px + (SQ3 / 3) * py;
      const s = -q - r;
      let rq = Math.round(q), rr = Math.round(r);
      const rs = Math.round(s);
      const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
      if (dq > dr && dq > ds) rq = -rr - rs;
      else if (dr > ds) rr = -rq - rs;
      return [ox + R * 1.5 * rq, oy + R * SQ3 * (rr + rq / 2)];
    };
    const sectorOf = (vx: number, vy: number) => ((Math.floor(Math.atan2(vy, vx) / SECTOR) % 6) + 6) % 6;

    // --- painting into the hexagon ------------------------------------------------------------------------------
    const eachCopy = (mir: boolean, paint: () => void) => {
      const sc = dpr * R;
      for (let k = 0; k < 6; k += 1) {
        const a = k * SECTOR;
        const cs = Math.cos(a), sn = Math.sin(a);
        for (const m of mir ? [1, -1] : [1]) {
          hg.setTransform(sc * cs, sc * sn, -sc * sn * m, sc * cs * m, hcx, hcy);
          paint();
        }
      }
    };
    const withClip = (paint: () => void) => {
      hg.save();
      hg.setTransform(1, 0, 0, 1, 0, 0);
      hg.beginPath();
      // A pixel over the edge: across the border the neighbour draws the same (mirrored), so the overlap is seamless.
      hexPath(hg, hcx, hcy, R * dpr + 1);
      hg.clip();
      paint();
      hg.restore();
      dirty = true;
    };
    const fillPath = (path: Path2D, color: string, mir: boolean) => withClip(() => {
      hg.fillStyle = color;
      eachCopy(mir, () => hg.fill(path));
    });
    const strokePath = (path: Path2D, color: string, width: number, mir: boolean) => withClip(() => {
      hg.strokeStyle = color;
      hg.lineWidth = width;
      hg.lineCap = 'round';
      hg.lineJoin = 'round';
      eachCopy(mir, () => hg.stroke(path));
    });
    const dotStamp = (path: Path2D, x: number, y: number, rad: number) => {
      path.moveTo(x + rad, y);
      path.arc(x, y, rad, 0, Math.PI * 2);
    };
    /** Paints points `from`.. of a stroke (the whole of it when from = 0); returns the stamping carry. */
    const paintStroke = (s: Stroke, from: number, carry: number, finish: boolean): number => {
      const p = s.pts;
      const n = p.length / 2;
      if (s.kind === 3) {
        const path = new Path2D();
        petalPath(path, p[0], p[1], p[2], p[3], s.width);
        fillPath(path, s.color, s.mirror);
        return 0;
      }
      if (s.kind === 4) {
        const path = new Path2D();
        dotStamp(path, p[0], p[1], s.width / 2);
        fillPath(path, s.color, s.mirror);
        return 0;
      }
      if (s.kind === 0) {
        const path = new Path2D();
        if (n === 1) {
          if (!finish) return 0;
          dotStamp(path, p[0], p[1], s.width / 2);
          fillPath(path, s.color, s.mirror);
          return 0;
        }
        // Quadratic curves through the midpoints: smooth, and drawable a piece at a time.
        const start = Math.max(1, from);
        for (let i = start; i < n; i += 1) {
          if (i === 1) {
            path.moveTo(p[0], p[1]);
            path.lineTo(mid(p[0], p[2]), mid(p[1], p[3]));
          } else {
            path.moveTo(mid(p[i * 2 - 4], p[i * 2 - 2]), mid(p[i * 2 - 3], p[i * 2 - 1]));
            path.quadraticCurveTo(p[i * 2 - 2], p[i * 2 - 1], mid(p[i * 2 - 2], p[i * 2]), mid(p[i * 2 - 1], p[i * 2 + 1]));
          }
        }
        if (finish) {
          path.moveTo(mid(p[n * 2 - 4], p[n * 2 - 2]), mid(p[n * 2 - 3], p[n * 2 - 1]));
          path.lineTo(p[n * 2 - 2], p[n * 2 - 1]);
        }
        strokePath(path, s.color, s.width, s.mirror);
        return 0;
      }
      const path = new Path2D();
      let left = carry;
      if (s.kind === 1) {
        if (from === 0) dotStamp(path, p[0], p[1], s.width * 0.8);
        left = stampAlong(p, from, s.width * 2.6, from === 0 ? s.width * 2.6 : carry, (x, y) => dotStamp(path, x, y, s.width * 0.8));
      } else {
        const len = s.width * 3.4;
        left = stampAlong(p, from, len * 1.05, from === 0 ? 0 : carry, (x, y, dir) => petalPath(path, x, y, dir, len, s.width * 1.5));
      }
      fillPath(path, s.color, s.mirror);
      return left;
    };
    const repaintAll = () => {
      hg.setTransform(1, 0, 0, 1, 0, 0);
      hg.clearRect(0, 0, hex.width, hex.height);
      for (const s of strokes) paintStroke(s, 0, 0, true);
      dirty = true;
    };
    const compose = () => {
      const bg = BACKGROUNDS[bgIdx];
      sg.setTransform(1, 0, 0, 1, 0, 0);
      const gr = sg.createLinearGradient(0, 0, 0, screen.height);
      gr.addColorStop(0, bg.top);
      gr.addColorStop(1, bg.bottom);
      sg.fillStyle = gr;
      sg.fillRect(0, 0, screen.width, screen.height);
      for (const [x, y] of centers) sg.drawImage(hex, x * dpr - hcx, y * dpr - hcy);
      dirty = false;
    };

    // --- generated patterns -------------------------------------------------------------------------------------
    const startGenerated = () => {
      strokes = [];
      queue = generateMandala(rand, BACKGROUNDS[bgIdx].light);
      queueRate = queue.length / 3.2;
      queueCarry = 0;
      idleFor = 0;
      repaintAll();
    };
    const flushQueue = () => {
      for (const s of queue) {
        strokes.push(s);
        paintStroke(s, 0, 0, true);
      }
      queue = [];
    };

    // --- toolbar -------------------------------------------------------------------------------------------------
    let items: Item[] = [];
    let panel = { x: 0, y: 0, w: 0, h: 0 };
    let paletteOpen = false;
    const palette = { x: W - 172, y: H - 116, w: 164, h: 70 };
    const layoutToolbar = () => {
      if (compact) {
        const x = Math.max(8, W - 102), y = Math.max(8, H - 40);
        panel = { x, y, w: 94, h: 32 };
        // Keep swatches on the right, clear of the card's dictionary/practice buttons.
        palette.x = x + panel.w - palette.w;
        palette.y = Math.max(8, y - 76);
        items = [
          { id: 'palette', label: 'Цвет карандаша', x, y, s: 32, w: 54 },
          { id: 'gen', label: 'Новый узор', x: x + 60, y, s: 32, w: 34 },
        ];
        if (paletteOpen) COLORS.forEach((_, i) => items.push({
          id: `c${i}`, label: COLOR_NAMES[i], x: palette.x + 6 + (i % 5) * 31,
          y: palette.y + 6 + Math.floor(i / 5) * 31, s: 27,
        }));
        return;
      }
      const s = W < 460 ? 22 : 26;
      const gap = 4;
      const colorIds = COLORS.map((_, i) => ({ id: `c${i}`, label: COLOR_NAMES[i] }));
      const tools = [
        { id: 'b0', label: 'Кисть: линия' }, { id: 'b1', label: 'Кисть: точки' }, { id: 'b2', label: 'Кисть: лепестки' },
        { id: 'w0', label: 'Тонко' }, { id: 'w1', label: 'Средне' }, { id: 'w2', label: 'Толсто' },
        { id: 'mirror', label: 'Зеркало внутри доли' }, { id: 'hex', label: 'Размер шестигранников' }, { id: 'bg', label: 'Фон' },
        { id: 'undo', label: 'Отменить' }, { id: 'gen', label: 'Новый узор' }, { id: 'clear', label: 'Очистить' },
      ];
      const rowW = (n: number, seps: number) => n * (s + gap) - gap + seps * 8;
      const oneRow = rowW(colorIds.length + tools.length, 5) + 20 < W;
      const rows = oneRow ? [[...colorIds, ...tools]] : [colorIds, tools];
      items = [];
      // Over a whole page the site's header covers the top 70 px: the toolbar goes under it.
      const top = c.body ? 80 : 8;
      let y = top + 6;
      let maxW = 0;
      for (const row of rows) {
        const seps = row.filter((it, i) => i > 0 && (it.id === 'b0' || it.id === 'w0' || it.id === 'mirror' || it.id === 'undo')).length;
        const w = rowW(row.length, seps);
        maxW = Math.max(maxW, w);
        let x = W / 2 - w / 2;
        row.forEach((it, i) => {
          if (i > 0 && (it.id === 'b0' || it.id === 'w0' || it.id === 'mirror' || it.id === 'undo')) x += 8;
          items.push({ ...it, x, y, s });
          x += s + gap;
        });
        y += s + gap;
      }
      panel = { x: W / 2 - maxW / 2 - 6, y: top, w: maxW + 12, h: y - top + 2 };
    };
    /** The number of a colour (c0…), brush (b0…) or width (w0…) button, or −1: a letter and digits exactly, so that
     * "clear" is no colour and "bg" no brush. */
    const slot = (id: string, letter: string) => {
      const m = /^([a-z])(\d+)$/.exec(id);
      return m && m[1] === letter ? Number(m[2]) : -1;
    };
    const itemAt = (x: number, y: number) => items.find((it) => x >= it.x - 2 && x <= it.x + (it.w ?? it.s) + 2 && y >= it.y - 2 && y <= it.y + it.s + 2) ?? null;
    const overPanel = (x: number, y: number) =>
      (x >= panel.x && x <= panel.x + panel.w && y >= panel.y && y <= panel.y + panel.h)
      || (compact && paletteOpen && x >= palette.x && x <= palette.x + palette.w && y >= palette.y && y <= palette.y + palette.h);
    const act = (id: string) => {
      if (id === 'palette') { paletteOpen = !paletteOpen; layoutToolbar(); }
      else if (slot(id, 'c') >= 0) {
        colorIdx = slot(id, 'c');
        if (compact) { paletteOpen = false; layoutToolbar(); }
      }
      else if (slot(id, 'b') >= 0) brush = slot(id, 'b');
      else if (slot(id, 'w') >= 0) sizeIdx = slot(id, 'w');
      else if (id === 'mirror') mirror = !mirror;
      else if (id === 'hex') {
        hexIdx = (hexIdx + 1) % HEX_SIZES.length;
        layoutHexes();
        repaintAll();
      } else if (id === 'bg') {
        bgIdx = (bgIdx + 1) % BACKGROUNDS.length;
        dirty = true;
      } else if (id === 'undo') {
        flushQueue();
        strokes.pop();
        userDrew = true;
        repaintAll();
      } else if (id === 'gen') {
        if (compact) { paletteOpen = false; layoutToolbar(); }
        userDrew = true;
        startGenerated();
      } else if (id === 'clear') {
        queue = [];
        strokes = [];
        userDrew = true;
        repaintAll();
      }
    };

    layoutHexes();
    layoutToolbar();
    startGenerated();

    // --- the pen ---------------------------------------------------------------------------------------------------
    let pen: { stroke: Stroke; cx: number; cy: number; k: number; carry: number } | null = null;
    let pressOnPanel = false;
    let hover: Item | null = null;
    let cursor: { x: number; y: number; cx: number; cy: number; k: number } | null = null;
    /** The canonical (sector 0, radius 1) point for a screen point, clamped into sector k of the hexagon at cx, cy. */
    const toCanon = (x: number, y: number, cx: number, cy: number, k: number): [number, number] => {
      const vx = x - cx, vy = y - cy;
      const a = -k * SECTOR;
      const wx = vx * Math.cos(a) - vy * Math.sin(a);
      const wy = vx * Math.sin(a) + vy * Math.cos(a);
      const [qx, qy] = closestInTriangle(wx, wy, 0, 0, R, 0, R / 2, (SQ3 / 2) * R);
      return [qx / R, qy / R];
    };
    const toScreen = (u: number, v: number, cx: number, cy: number, k: number): [number, number] => {
      const a = k * SECTOR;
      return [cx + R * (u * Math.cos(a) - v * Math.sin(a)), cy + R * (u * Math.sin(a) + v * Math.cos(a))];
    };

    const handlePointer = (p: ScenePointer) => {
      hover = p.active ? itemAt(p.rawX, p.rawY) : null;
      if (p.clicked) {
        pressOnPanel = overPanel(p.rawX, p.rawY);
        if (pressOnPanel) {
          const it = itemAt(p.rawX, p.rawY);
          if (it) act(it.id);
        } else if (compact && paletteOpen) {
          // Dismiss the dropdown without leaving a stray stroke underneath it.
          paletteOpen = false;
          pressOnPanel = true;
          layoutToolbar();
        } else {
          flushQueue();
          userDrew = true;
          const [cx, cy] = hexAt(p.rawX, p.rawY);
          const k = sectorOf(p.rawX - cx, p.rawY - cy);
          const [u, v] = toCanon(p.rawX, p.rawY, cx, cy, k);
          pen = { stroke: { kind: brush, color: COLORS[colorIdx], width: WIDTHS[sizeIdx] * (brush === 0 ? 1 : 1.25), mirror, pts: [u, v] }, cx, cy, k, carry: 0 };
          pen.carry = paintStroke(pen.stroke, 0, 0, false);
        }
      }
      if (pen && p.pressed) {
        const [u, v] = toCanon(p.rawX, p.rawY, pen.cx, pen.cy, pen.k);
        const pts = pen.stroke.pts;
        const lx = pts[pts.length - 2], ly = pts[pts.length - 1];
        if (Math.hypot(u - lx, v - ly) > 0.004) {
          pts.push(u, v);
          pen.carry = paintStroke(pen.stroke, pts.length / 2 - 1, pen.carry, false);
        }
      }
      if (pen && !p.pressed) {
        paintStroke(pen.stroke, pen.stroke.pts.length / 2, pen.carry, true);
        strokes.push(pen.stroke);
        pen = null;
      }
      if (!p.pressed) pressOnPanel = false;
      // Where the pen would draw: the sector under the cursor, or the locked one.
      if (p.active && !overPanel(p.rawX, p.rawY) && !pressOnPanel) {
        const [cx, cy] = pen ? [pen.cx, pen.cy] : hexAt(p.rawX, p.rawY);
        const k = pen ? pen.k : sectorOf(p.rawX - cx, p.rawY - cy);
        const [u, v] = toCanon(p.rawX, p.rawY, cx, cy, k);
        const [x, y] = toScreen(u, v, cx, cy, k);
        cursor = { x, y, cx, cy, k };
      } else cursor = null;
    };

    const drawIcon = (g: CanvasRenderingContext2D, it: Item, on: boolean) => {
      const { x, y, s } = it;
      const cx = x + s / 2, cy = y + s / 2;
      const light = BACKGROUNDS[bgIdx].light;
      g.fillStyle = compact && it.w ? 'rgba(12,9,22,0.88)' : on ? 'rgba(255,230,170,0.28)' : 'rgba(255,255,255,0.06)';
      g.strokeStyle = on ? '#ffd27a' : 'rgba(255,255,255,0.18)';
      g.lineWidth = on ? 1.6 : 1;
      g.beginPath();
      g.roundRect(x, y, it.w ?? s, s, 6);
      g.fill();
      g.stroke();
      const ink = '#f4ecdc';
      g.fillStyle = ink;
      g.strokeStyle = ink;
      g.lineWidth = 1.6;
      g.lineCap = 'round';
      const id = it.id;
      if (compact && (id === 'palette' || id === 'gen')) {
        // Two independent pills, not the large top toolbar.
        g.font = '12px sans-serif';
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        if (id === 'palette') {
          g.fillStyle = COLORS[colorIdx];
          g.beginPath(); g.arc(x + 16, cy, 6, 0, Math.PI * 2); g.fill();
          g.fillStyle = ink;
          g.fillText(paletteOpen ? '▴' : '▾', x + 36, cy);
        } else {
          g.textAlign = 'center';
          g.fillText('✦', x + (it.w ?? s) / 2, cy);
        }
        return;
      }
      if (slot(id, 'c') >= 0) {
        g.fillStyle = COLORS[slot(id, 'c')];
        g.beginPath();
        g.arc(cx, cy, s * 0.3, 0, Math.PI * 2);
        g.fill();
        if (light && id === 'c0') {
          g.strokeStyle = 'rgba(0,0,0,0.3)';
          g.stroke();
        }
      } else if (id === 'b0') {
        g.beginPath();
        g.moveTo(x + s * 0.2, cy + s * 0.12);
        g.bezierCurveTo(x + s * 0.4, cy - s * 0.35, x + s * 0.6, cy + s * 0.35, x + s * 0.8, cy - s * 0.12);
        g.stroke();
      } else if (id === 'b1') {
        for (const dx of [-0.25, 0, 0.25]) {
          g.beginPath();
          g.arc(cx + dx * s, cy, s * 0.07, 0, Math.PI * 2);
          g.fill();
        }
      } else if (id === 'b2') {
        const path = new Path2D();
        petalPath(path, cx - s * 0.16, cy, 0, s * 0.3, s * 0.2);
        petalPath(path, cx + s * 0.16, cy, 0, s * 0.3, s * 0.2);
        g.fill(path);
      } else if (slot(id, 'w') >= 0) {
        g.beginPath();
        g.arc(cx, cy, [1.5, 3, 5][slot(id, 'w')] * (s / 26), 0, Math.PI * 2);
        g.fill();
      } else if (id === 'mirror') {
        g.beginPath();
        g.moveTo(cx - 2, cy - s * 0.28);
        g.lineTo(cx - s * 0.3, cy + s * 0.22);
        g.lineTo(cx - 2, cy + s * 0.22);
        g.closePath();
        g.fill();
        g.beginPath();
        g.moveTo(cx + 2, cy - s * 0.28);
        g.lineTo(cx + s * 0.3, cy + s * 0.22);
        g.lineTo(cx + 2, cy + s * 0.22);
        g.closePath();
        g.globalAlpha = mirror ? 1 : 0.35;
        g.fill();
        g.globalAlpha = 1;
      } else if (id === 'hex') {
        g.beginPath();
        hexPath(g, cx, cy, s * (0.18 + hexIdx * 0.07));
        g.stroke();
      } else if (id === 'bg') {
        g.fillStyle = BACKGROUNDS[bgIdx].top;
        g.beginPath();
        g.arc(cx, cy, s * 0.3, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      } else {
        g.font = `${Math.round(s * 0.62)}px sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(id === 'undo' ? '↶' : id === 'gen' ? '✦' : '✕', cx, cy + 1);
      }
    };

    return {
      isControlPoint: overPanel,
      update(dt, _t, p) {
        const sdt = Math.min(dt, 0.05);
        handlePointer(p);
        if (queue.length) {
          queueCarry += queueRate * sdt;
          while (queueCarry >= 1 && queue.length) {
            queueCarry -= 1;
            const s = queue.shift()!;
            strokes.push(s);
            paintStroke(s, 0, 0, true);
          }
        } else if (!userDrew) {
          // Nobody has drawn yet: a new generated pattern now and then.
          idleFor += sdt;
          if (idleFor > 16) startGenerated();
        }
      },
      draw(g) {
        if (dirty) compose();
        g.drawImage(screen, 0, 0, W, H);
        const bg = BACKGROUNDS[bgIdx];
        if (cursor) {
          g.strokeStyle = `${bg.guide}0.1)`;
          g.lineWidth = 1;
          g.stroke(guides);
          // The sector the pen draws in (or is locked into, while the button is held).
          const { cx, cy, k } = cursor;
          g.beginPath();
          g.moveTo(cx, cy);
          g.lineTo(cx + R * Math.cos(k * SECTOR), cy + R * Math.sin(k * SECTOR));
          g.lineTo(cx + R * Math.cos((k + 1) * SECTOR), cy + R * Math.sin((k + 1) * SECTOR));
          g.closePath();
          g.fillStyle = `${bg.guide}${pen ? 0.08 : 0.05})`;
          g.fill();
          g.strokeStyle = `${bg.guide}${pen ? 0.55 : 0.3})`;
          g.lineWidth = pen ? 1.4 : 1;
          g.stroke();
          const w = WIDTHS[sizeIdx] * R * (brush === 0 ? 0.5 : 0.8);
          g.fillStyle = COLORS[colorIdx];
          g.strokeStyle = bg.light ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)';
          g.beginPath();
          g.arc(cursor.x, cursor.y, Math.max(2, w), 0, Math.PI * 2);
          g.fill();
          g.stroke();
        }
        // Toolbar.
        g.fillStyle = 'rgba(12,9,22,0.74)';
        g.strokeStyle = 'rgba(255,230,180,0.22)';
        g.lineWidth = 1;
        if (!compact || paletteOpen) {
          const frame = compact ? palette : panel;
          g.beginPath();
          g.roundRect(frame.x, frame.y, frame.w, frame.h, 10);
          g.fill();
          g.stroke();
        }
        for (const it of items) {
          const id = it.id;
          const on = slot(id, 'c') === colorIdx || slot(id, 'b') === brush || slot(id, 'w') === sizeIdx || (id === 'mirror' && mirror);
          drawIcon(g, it, on);
        }
        if (hover && !compact) {
          g.font = '12px sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'top';
          const tw = g.measureText(hover.label).width + 12;
          const tx = clamp(hover.x + hover.s / 2, tw / 2 + 4, W - tw / 2 - 4);
          const ty = panel.y + panel.h + 4;
          g.fillStyle = 'rgba(12,9,22,0.85)';
          g.beginPath();
          g.roundRect(tx - tw / 2, ty, tw, 20, 6);
          g.fill();
          g.fillStyle = '#f4ecdc';
          g.fillText(hover.label, tx, ty + 4);
        }
      },
    };
  },
};
