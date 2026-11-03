import type { CanvasSceneDef, SceneCtx } from './types';
import { TAU, clamp, mixHex, rgb, rgba } from './kit';

/**
 * A close-up of a shop's brick wall at night with three big, real-looking neon signs: VEIKALS on a raceway, a hanging
 * shopping bag and −50% on a black backer board. Glass tubes bent into single-stroke letters and pictograms, with
 * electrodes at their ends, clear clips holding them, and the joins between letters painted out black the way sign
 * makers do it. The signs gather on the right of the card (its picture and title are on the left); a drainpipe beside
 * them and cables down the wall show where each sign's light falls.
 *
 * Every sign's light is baked once into its own layer. The light its tubes throw on the brick, the pipe, the boards
 * and the pavement is computed, not painted, over the whole card: each tube is a row of small lights a few cm off the
 * wall, summed with a real falloff, lit through the brick's relief (bevelled edges and grit catch it, mortar stays
 * dark) or the pipe's roundness (with a highlight) and multiplied by the surface colours in linear light. Add the
 * glow in the air (a wide and a tight bloom), the lit glass itself and its rippled, streaky reflection in the wet
 * pavement. A frame is the dark street plus each layer added on top at its
 * current brightness, so flickering, a dying letter or a sign clicked off and on again (it ignites with a stutter,
 * like real neon) costs one drawImage per layer and nothing else.
 */

type Ctx = CanvasRenderingContext2D;
type Pt = { x: number; y: number };
type Glyph = { w: number; strokes: number[][][] };
type Tube = { strokes: Pt[][]; color: string };

const ring = (cx: number, cy: number, rx: number, ry: number, n = 14): number[][] =>
  Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos((i / n) * TAU - Math.PI / 2) * rx, cy + Math.sin((i / n) * TAU - Math.PI / 2) * ry]);

const heartShape = (): number[][] =>
  Array.from({ length: 29 }, (_, i) => {
    const t = (i / 28) * TAU;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return [3 + x * 0.18, 2.6 - y * 0.18];
  });

/** A single-stroke uppercase font on a grid 6 units tall — the way a neon bender would run one tube through a letter. */
const GLYPHS: Record<string, Glyph> = {
  A: { w: 4, strokes: [[[0, 6], [2, 0], [4, 6]], [[0.9, 3.9], [3.1, 3.9]]] },
  C: { w: 3.8, strokes: [[[3.8, 1], [2.8, 0], [1, 0], [0, 1.4], [0, 4.6], [1, 6], [2.8, 6], [3.8, 5]]] },
  D: { w: 3.8, strokes: [[[0, 0], [0, 6], [1.8, 6], [3.4, 5], [3.8, 3], [3.4, 1], [1.8, 0], [0, 0]]] },
  E: { w: 3.4, strokes: [[[3.4, 0], [0, 0], [0, 6], [3.4, 6]], [[0, 3], [2.7, 3]]] },
  I: { w: 0.4, strokes: [[[0.2, 0], [0.2, 6]]] },
  K: { w: 3.6, strokes: [[[0, 0], [0, 6]], [[3.4, 0], [0, 3.6]], [[1.1, 2.6], [3.6, 6]]] },
  L: { w: 3.2, strokes: [[[0, 0], [0, 6], [3.2, 6]]] },
  R: { w: 3.8, strokes: [[[0, 6], [0, 0], [2.6, 0], [3.6, 0.9], [3.6, 2.1], [2.6, 3], [0, 3]], [[1.8, 3], [3.8, 6]]] },
  S: { w: 3.6, strokes: [[[3.6, 0.9], [2.7, 0], [0.9, 0], [0, 0.9], [0, 2], [0.9, 2.9], [2.7, 3.1], [3.6, 4], [3.6, 5.1], [2.7, 6], [0.9, 6], [0, 5.1]]] },
  T: { w: 3.8, strokes: [[[0, 0], [3.8, 0]], [[1.9, 0], [1.9, 6]]] },
  V: { w: 4, strokes: [[[0, 0], [2, 6], [4, 0]]] },
  '-': { w: 2.2, strokes: [[[0, 3.2], [2.2, 3.2]]] },
  '3': { w: 3.4, strokes: [[[0.2, 0.5], [1.6, 0], [2.8, 0.5], [3.4, 1.5], [2.8, 2.5], [1.5, 3], [2.8, 3.5], [3.4, 4.5], [2.8, 5.5], [1.6, 6], [0.2, 5.5]]] },
  '5': { w: 3.4, strokes: [[[3.2, 0], [0.4, 0], [0.1, 2.7], [1.8, 2.3], [3, 2.9], [3.4, 4.3], [2.9, 5.5], [1.7, 6], [0.2, 5.4]]] },
  '0': { w: 3.4, strokes: [ring(1.7, 3, 1.7, 3, 16)] },
  '%': { w: 4, strokes: [ring(0.9, 1.2, 0.8, 1.1, 10), [[3.8, 0.2], [0.2, 5.8]], ring(3.1, 4.8, 0.8, 1.1, 10)] },
};
/** Latvian long vowels: the base letter plus a short tube for the macron. */
const MACRONS: Record<string, string> = { Ē: 'E', Ā: 'A', Ī: 'I' };

/** Continuous bent-tube food outlines, not flat emoji or texture decals. */
export const NEON_PRODUCT_ICONS = {
  bread: { w: 6, strokes: [
    [[0.5, 5.8], [0.2, 2.5], [0.8, 0.9], [2.3, 0.3], [4.2, 0.35], [5.6, 1.2], [5.9, 2.8], [5.6, 5.8], [0.5, 5.8]],
    [[1.65, 1.2], [1.1, 2.6]], [[3.1, 1], [2.55, 2.4]], [[4.6, 1.3], [4.1, 2.7]],
  ] },
  cheese: { w: 6, strokes: [
    [[0.3, 2.4], [4.8, 0.4], [5.8, 1.6], [5.8, 5.6], [0.3, 5.6], [0.3, 2.4], [5.8, 1.6]],
    ring(1.5, 3.6, 0.48, 0.48), ring(3.65, 4.4, 0.65, 0.55), ring(4.7, 2.85, 0.35, 0.35),
  ] },
  apple: { w: 6, strokes: [
    [[3, 1.4], [1.8, 0.9], [0.7, 1.5], [0.25, 2.7], [0.6, 4.2], [1.6, 5.8], [2.7, 5.5], [3.3, 5.5], [4.4, 5.8], [5.4, 4.3], [5.7, 2.7], [5.1, 1.5], [4, 0.9], [3, 1.4]],
    [[3, 1.3], [3.8, 0.15], [5, 0.15], [4.2, 1.2], [3, 1.3]], [[3, 1.3], [2.9, 0.2]],
  ] },
  bottle: { w: 4, strokes: [
    [[1.3, 0.3], [2.7, 0.3], [2.7, 1.75], [3.65, 2.65], [3.65, 5.6], [3.35, 5.9], [0.65, 5.9], [0.35, 5.6], [0.35, 2.65], [1.3, 1.75], [1.3, 0.3]],
    [[1.15, 0.7], [2.85, 0.7]], [[0.45, 3.2], [3.55, 3.2]], [[0.45, 4.9], [3.55, 4.9]],
    [[1.5, 3.65], [2, 4.25], [2.5, 3.65]],
  ] },
} satisfies Record<string, Glyph>;

const ICONS: Record<string, Glyph> = {
  bag: { w: 6, strokes: [[[0.6, 2], [5.4, 2], [5, 6], [1, 6], [0.6, 2]], [[2, 2], [2, 1.1], [3, 0.2], [4, 1.1], [4, 2]]] },
  cart: { w: 6.4, strokes: [[[0, 0.6], [1.1, 0.6], [2.1, 4.2], [5.6, 4.2], [6.3, 1.6], [1.5, 1.6]], ring(2.5, 5.4, 0.55, 0.55, 10), ring(5.1, 5.4, 0.55, 0.55, 10)] },
  heart: { w: 6, strokes: [heartShape()] },
  arrow: { w: 6, strokes: [[[0, 3], [5.6, 3]], [[3.8, 1.2], [5.8, 3], [3.8, 4.8]]] },
  ...NEON_PRODUCT_ICONS,
};

/** Fullscreen adds a product circuit; the compact card keeps its three original signs. */
export function getNeonProductLayout(width: number, height: number, body: boolean, region?: SceneCtx['region']) {
  if (!body) return [];
  const products = [
    { icon: 'bread', color: '#ffad5a' }, { icon: 'cheese', color: '#ffdb54' },
    { icon: 'apple', color: '#9aff70' }, { icon: 'bottle', color: '#79dcff' },
  ];
  const selected = region === 'left' ? products.slice(0, 2) : region === 'right' ? products.slice(2) : products;
  const left = width * (width / height >= 2.8 ? .5 : .24), span = width * .985 - left;
  const rows = selected.length === 4 && span < 420 ? 2 : 1;
  const columns = selected.length / rows;
  const size = Math.min(height * (rows === 2 ? .12 : .14), span * .72 / columns, 140);
  return selected.map((product, index) => ({ ...product, size,
    x: left + span * ((index % columns) + .5) / columns,
    y: height * (rows === 2 ? .33 + Math.floor(index / columns) * .14 : .38),
  }));
}

function glyphFor(ch: string): Glyph {
  const base = MACRONS[ch];
  if (base) {
    const g = GLYPHS[base];
    const pad = g.w < 1 ? 0.7 : 0;
    return { w: g.w, strokes: [...g.strokes, [[g.w * 0.15 - pad, -1.2], [g.w * 0.85 + pad, -1.2]]] };
  }
  return GLYPHS[ch] ?? GLYPHS['-'];
}

/** Rounds every bend a little, as a tube is bent over a flame rather than cut at a corner (Chaikin, ends kept). */
function bend(pts: Pt[], iterations = 2): Pt[] {
  let p = pts;
  for (let k = 0; k < iterations && p.length > 2; k += 1) {
    const out: Pt[] = [p[0]];
    for (let i = 0; i < p.length - 1; i += 1) {
      const a = p[i];
      const b = p[i + 1];
      out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    out.push(p[p.length - 1]);
    p = out;
  }
  return p;
}

function place(g: Glyph, x0: number, top: number, s: number): Pt[][] {
  return g.strokes.map((stroke) => bend(stroke.map(([x, y]) => ({ x: x0 + x * s, y: top + y * s }))));
}

/** A word centred on (x, y), `h` tall: one tube per letter. */
function word(text: string, x: number, y: number, h: number, color: string) {
  const s = h / 6;
  const gap = 1.3;
  const glyphs = [...text].map(glyphFor);
  const width = (glyphs.reduce((sum, g) => sum + g.w, 0) + gap * (glyphs.length - 1)) * s;
  let cursor = x - width / 2;
  const tubes: Tube[] = glyphs.map((g) => {
    const tube = { strokes: place(g, cursor, y - h / 2, s), color };
    cursor += (g.w + gap) * s;
    return tube;
  });
  return { tubes, width };
}

function icon(name: string, x: number, y: number, h: number, color: string): Tube {
  const g = ICONS[name];
  const s = h / 6;
  return { strokes: place(g, x - (g.w * s) / 2, y - h / 2, s), color };
}

function tracePath(g: Ctx, pts: Pt[]) {
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) g.lineTo(pts[i].x, pts[i].y);
}

function strokeTubes(g: Ctx, tubes: Tube[], width: number, color: (t: Tube) => string) {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = width;
  for (const t of tubes) {
    g.strokeStyle = color(t);
    for (const s of t.strokes) {
      tracePath(g, s);
      g.stroke();
    }
  }
}

function shade(hex: string, f: number) {
  const [r, g, b] = rgb(hex);
  const k = (n: number) => Math.round(clamp(n * f, 0, 255));
  return `rgb(${k(r)},${k(g)},${k(b)})`;
}

/** sRGB byte → linear light, and linear light → sRGB byte (a 4096-step table). */
const LIN = Float32Array.from({ length: 256 }, (_, i) => {
  const v = i / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
});
const SRGB = Uint8ClampedArray.from({ length: 4096 }, (_, i) => {
  const v = i / 4095;
  return Math.round((v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055) * 255);
});
const encode = (v: number) => SRGB[v >= 1 ? 4095 : v <= 0 ? 0 : (v * 4095) | 0];

/** Points every `spacing` px along the tubes, as [x, y, r, g, b] (linear colour) runs. */
function samplesOf(tubes: Tube[], spacing: number): Float32Array {
  const out: number[] = [];
  for (const t of tubes) {
    const [r, g, b] = rgb(t.color).map((v) => LIN[v]);
    for (const s of t.strokes) {
      let at = spacing / 2;
      for (let i = 1; i < s.length; i += 1) {
        const p = s[i - 1];
        const q = s[i];
        const len = Math.hypot(q.x - p.x, q.y - p.y);
        for (; at < len; at += spacing) out.push(p.x + ((q.x - p.x) * at) / len, p.y + ((q.y - p.y) * at) / len, r, g, b);
        at -= len;
      }
    }
  }
  return Float32Array.from(out);
}

type Layer = { canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number };
type Sign = {
  tubes: Tube[];
  /** Painted-out joins between letters. */
  joins: [Pt, Pt][];
  bbox: { x0: number; y0: number; x1: number; y1: number };
  /** Letter (or icon) height, px: sets how thick the glass is and how far its light reaches. */
  size: number;
  tubeR: number;
  /** Index into `tubes` of a tube on its way out, flickering on its own layer; -1 if none. */
  faulty: number;
};

/** Light a sign throws: `NEAR` is the bright pool right behind the glass (a tube a few cm off the wall), `FAR` the
 * wide coloured wash around it (light scattered by the air and the street), `GAIN` the exposure of both. */
const NEAR = 1.6;
const FAR = 0.4;
const GAIN = 1.7;
/** The wet pavement is dark but shiny: its diffuse light is boosted, the rest is the mirror image. */
const GROUND = 1.3;

export function getNeonSignContent(region?: SceneCtx['region']) {
  return region === 'right'
    ? { heading: 'ATVĒRTS', discount: '-30%', icon: 'cart' }
    : { heading: 'VEIKALS', discount: '-50%', icon: 'bag' };
}

export const NEON_SIGNS: CanvasSceneDef = {
  kind: 'canvas',
  id: 'neon-signs',
  label: 'Неоновые вывески',
  palettes: [['#100a18', '#ff3a9a', '#3affe6', '#ffb23a'], ['#0a1020', '#ff5a3a', '#5aa0ff', '#e0ff3a']],
  // The owner's pick on the panel: the neon at half strength ("Насыщенность" scales every sign's light).
  defaultParams: { intensity: 0.5 },
  create(c) {
    const W = c.width;
    const H = c.height;
    const S = c.dpr;
    const aw = Math.max(2, Math.round(W * S));
    const ah = Math.max(2, Math.round(H * S));
    const make = (w: number, h: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(w));
      canvas.height = Math.max(1, Math.round(h));
      return canvas;
    };
    const rand = c.rand;

    // ---- a close-up of the shop's brick wall at night: three big signs, a drainpipe, cables, wet pavement below.
    const groundY = H * 0.87;
    const P = c.palette;
    /** Flat, smooth things in front of the brick (their light has no brick relief). */
    const flat: { x0: number; y0: number; x1: number; y1: number }[] = [];

    const albedo = make(aw, ah);
    const a = albedo.getContext('2d')!;
    a.setTransform(S, 0, 0, S, 0, 0);

    // Brick, with a lit top edge and a shadowed bottom one so the courses read even in the dark.
    const bh = clamp(H * 0.1, 9, 26);
    const bw = bh * 2.9;
    const joint = Math.max(1, bh * 0.12);
    a.fillStyle = '#575049';
    a.fillRect(0, 0, W, groundY);
    const clay = ['#7a3a2a', '#6e3325', '#84432f', '#5f2d22', '#8d4b35', '#733c2c', '#6a3a2e'];
    for (let row = 0, y = 0; y < groundY; y += bh, row += 1) {
      for (let x = row % 2 ? -bw / 2 : 0; x < W; x += bw) {
        const bx = x + joint / 2;
        const by = y + joint / 2;
        a.fillStyle = shade(clay[Math.floor(rand() * clay.length)], 0.78 + rand() * 0.36);
        a.fillRect(bx, by, bw - joint, bh - joint);
        if (rand() < 0.5) {
          a.fillStyle = rand() < 0.5 ? 'rgba(20,10,6,0.18)' : 'rgba(230,200,170,0.1)';
          a.fillRect(bx + rand() * bw * 0.5, by, bw * (0.2 + rand() * 0.3), bh - joint);
        }
        a.fillStyle = 'rgba(255,220,190,0.14)';
        a.fillRect(bx, by, bw - joint, Math.max(0.7, joint * 0.55));
        a.fillStyle = 'rgba(0,0,0,0.25)';
        a.fillRect(bx, by + bh - joint * 1.55, bw - joint, Math.max(0.7, joint * 0.55));
      }
    }
    // Grime darkening towards the pavement.
    const grime = a.createLinearGradient(0, groundY - H * 0.25, 0, groundY);
    grime.addColorStop(0, 'rgba(0,0,0,0)');
    grime.addColorStop(1, 'rgba(0,0,0,0.3)');
    a.fillStyle = grime;
    a.fillRect(0, groundY - H * 0.25, W, H * 0.25);

    // Pavement: large slabs, dark and wet.
    a.fillStyle = '#3c3c42';
    a.fillRect(0, groundY, W, H - groundY);
    const slab = Math.max(20, H * 0.3);
    for (let row = 0, y = groundY; y < H; y += slab * 0.35, row += 1) {
      for (let x = row % 2 ? -slab / 2 : 0; x < W; x += slab) {
        a.fillStyle = shade('#44444b', 0.8 + rand() * 0.35);
        a.fillRect(x + 1, y + 1, slab - 2, slab * 0.35 - 2);
      }
    }
    a.fillStyle = '#2a2a2f';
    a.fillRect(0, groundY, W, Math.max(2, H * 0.015));
    a.fillStyle = '#6a6b70';
    a.fillRect(0, groundY, W, Math.max(0.8, H * 0.004));

    // ---- the three signs, big: VEIKALS on a raceway, a hanging shopping bag, −50% on a black backer board.
    const content = getNeonSignContent(c.region);
    const unit = (text: string) => word(text, 0, 0, 6, '#000').width / 6;
    const wV = unit(content.heading);
    const wB = ICONS[content.icon].w / 6;
    /** −50% together with its backer board (0.32 of the letter height on each side). */
    const wS = unit(content.discount) + 0.64;
    const relB = 1.35;
    const relS = 1.1;
    // The card's picture, title and skill icons take its left side: the signs gather on the right, VEIKALS on top, the bag
    // and −50% under it, with a drainpipe just left of them.
    const left = W * (W / H >= 2.8 ? 0.5 : 0.24);
    const span = W * 0.985 - left;
    const mid = left + span / 2;
    const hV = Math.min(H * (c.body ? 0.21 : 0.28), (span * 0.95) / wV);
    const xV = mid;
    const yV = H * (c.body ? 0.16 : 0.23);
    const hB = Math.min(H * (c.body ? 0.30 : 0.38), (span * 0.9) / (wB + (wS * relS) / relB));
    const hS = (hB / relB) * relS;
    const total = wB * hB + wS * hS;
    const gap = Math.max(span * 0.07, (span * 0.92 - total) / 3);
    const xB = mid - (total + gap) / 2 + (wB * hB) / 2;
    const xS = mid + (total + gap) / 2 - (wS * hS) / 2;
    const yB = H * (c.body ? 0.69 : 0.645);
    const yS = H * (c.body ? 0.68 : 0.635);
    const pipeX = Math.min(xV - (wV * hV) / 2, xB - (wB * hB) / 2) - W * 0.035;

    // A drainpipe on the wall: round, so each side catches the colour of the sign next to it.
    const pipe = { x: pipeX, r: clamp(H * 0.032, 3, 9) };
    {
      a.fillStyle = '#707680';
      a.fillRect(pipe.x - pipe.r, 0, pipe.r * 2, groundY);
      // Brackets and a joint sleeve.
      for (let y = H * 0.12; y < groundY - H * 0.05; y += Math.max(40, H * 0.36)) {
        a.fillStyle = '#4c5159';
        a.fillRect(pipe.x - pipe.r * 1.25, y, pipe.r * 2.5, Math.max(2, H * 0.022));
      }
      // The shoe at the bottom, bending away from the wall onto the pavement.
      a.fillStyle = '#5f656e';
      a.fillRect(pipe.x - pipe.r * 1.15, groundY - H * 0.05, pipe.r * 2.3, H * 0.05 + H * 0.015);
    }

    // The raceway box the VEIKALS letters are mounted on (painted, so it catches their light).
    const veikals = word(content.heading, xV, yV, hV, P[1]);
    const rwH = hV * 0.34;
    const rw = { x0: xV - veikals.width / 2 - hV * 0.2, y0: yV + hV * 0.12, x1: xV + veikals.width / 2 + hV * 0.2 };
    a.fillStyle = '#2b2d31';
    a.fillRect(rw.x0, rw.y0, rw.x1 - rw.x0, rwH);
    a.fillStyle = '#5a5e66';
    a.fillRect(rw.x0, rw.y0, rw.x1 - rw.x0, Math.max(1, rwH * 0.15));
    flat.push({ x0: rw.x0, y0: rw.y0, x1: rw.x1, y1: rw.y0 + rwH });

    // −50% on a black backer board with four standoffs.
    const sale = word(content.discount, xS, yS, hS, P[3]);
    const pad = hS * 0.32;
    const board = { x0: xS - sale.width / 2 - pad, y0: yS - hS / 2 - pad, x1: xS + sale.width / 2 + pad, y1: yS + hS / 2 + pad };
    a.fillStyle = '#131316';
    a.beginPath();
    a.roundRect(board.x0, board.y0, board.x1 - board.x0, board.y1 - board.y0, pad * 0.5);
    a.fill();
    a.strokeStyle = 'rgba(160,165,175,0.35)';
    a.lineWidth = Math.max(0.8, pad * 0.06);
    a.stroke();
    a.fillStyle = '#8a8f98';
    for (const [sx, sy] of [[board.x0 + pad * 0.45, board.y0 + pad * 0.45], [board.x1 - pad * 0.45, board.y0 + pad * 0.45], [board.x0 + pad * 0.45, board.y1 - pad * 0.45], [board.x1 - pad * 0.45, board.y1 - pad * 0.45]]) {
      a.beginPath();
      a.arc(sx, sy, Math.max(1.2, pad * 0.14), 0, TAU);
      a.fill();
    }
    flat.push(board);

    // The bag hangs on two chains: from the raceway above it, or from above the card where there is no raceway.
    const bagTube = icon(content.icon, xB, yB, hB, P[2]);
    const bagTop = yB - hB / 2 + (hB / 6) * 2;
    a.strokeStyle = '#6c6f75';
    a.lineWidth = Math.max(1, H * 0.006);
    a.setLineDash([Math.max(2, H * 0.014), Math.max(1, H * 0.007)]);
    for (const f of [-0.36, 0.36]) {
      a.beginPath();
      const cx = xB + hB * f;
      a.moveTo(cx, cx > rw.x0 && cx < rw.x1 ? rw.y0 + rwH : 0);
      a.lineTo(cx, bagTop);
      a.stroke();
    }
    a.setLineDash([]);

    // Power cables: from the raceway and from the bag, down the wall to the pavement.
    const cable = (pts: [number, number][]) => {
      a.lineCap = 'round';
      a.lineJoin = 'round';
      a.strokeStyle = '#141416';
      a.lineWidth = Math.max(1.2, H * 0.011);
      a.beginPath();
      a.moveTo(pts[0][0], pts[0][1]);
      for (const [x, y] of pts.slice(1)) a.lineTo(x, y);
      a.stroke();
      a.strokeStyle = 'rgba(200,205,215,0.18)';
      a.lineWidth = Math.max(0.5, H * 0.004);
      a.stroke();
    };
    cable([[rw.x0 + hV * 0.3, rw.y0 + rwH], [rw.x0 + hV * 0.3, rw.y0 + rwH + H * 0.08], [rw.x0 + hV * 0.2, groundY]]);
    cable([[xB + hB * 0.3, yB + hB / 2], [xB + hB * 0.34, yB + hB / 2 + H * 0.06], [xB + hB * 0.55, groundY]]);
    cable([[board.x1 - pad, board.y1], [board.x1 - pad * 0.8, groundY]]);

    const signs: Sign[] = [];
    const addSign = (tubes: Tube[], size: number, faulty = -1, joinLetters = false) => {
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const t of tubes) for (const s of t.strokes) for (const q of s) {
        x0 = Math.min(x0, q.x);
        y0 = Math.min(y0, q.y);
        x1 = Math.max(x1, q.x);
        y1 = Math.max(y1, q.y);
      }
      const joins: [Pt, Pt][] = [];
      if (joinLetters) {
        for (let i = 0; i < tubes.length - 1; i += 1) {
          const last = tubes[i].strokes[tubes[i].strokes.length - 1];
          joins.push([last[last.length - 1], tubes[i + 1].strokes[0][0]]);
        }
      }
      signs.push({ tubes, joins, bbox: { x0, y0, x1, y1 }, size, tubeR: clamp(size * 0.05, 1.8, 5), faulty });
    };
    addSign(veikals.tubes, hV, 3, true);
    addSign([bagTube], hB);
    addSign(sale.tubes, hS, 3);
    const products = getNeonProductLayout(W, H, c.body, c.region);
    // One baked circuit for all products: wall lighting/reflections are computed once,
    // and the frame gains just one cached layer rather than a live light per tube.
    if (products.length) addSign(products.map(product => icon(product.icon, product.x, product.y, product.size, product.color)), products[0].size);

    // ---- blur: halve the size a few times, then scale back up step by step (a smooth, cheap wide blur).
    const blurred = (src: HTMLCanvasElement, radius: number): HTMLCanvasElement => {
      const levels = [src];
      for (let f = 2; f <= radius; f *= 2) {
        const cur = levels[levels.length - 1];
        if (cur.width < 4 || cur.height < 4) break;
        const next = make(cur.width / 2, cur.height / 2);
        const g = next.getContext('2d')!;
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        g.drawImage(cur, 0, 0, next.width, next.height);
        levels.push(next);
      }
      let cur = levels[levels.length - 1];
      for (let i = levels.length - 2; i >= 0; i -= 1) {
        const up = make(levels[i].width, levels[i].height);
        const g = up.getContext('2d')!;
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        g.drawImage(cur, 0, 0, up.width, up.height);
        cur = up;
      }
      return cur;
    };
    /** Squashes a canvas vertically by `f` and back: a streak, as wet stone smears a reflection downwards. */
    const streak = (src: HTMLCanvasElement, f: number) => {
      const small = make(src.width, src.height / f);
      const sg = small.getContext('2d')!;
      sg.imageSmoothingEnabled = true;
      sg.drawImage(src, 0, 0, small.width, small.height);
      const out = make(src.width, src.height);
      const og = out.getContext('2d')!;
      og.imageSmoothingEnabled = true;
      og.drawImage(small, 0, 0, out.width, out.height);
      return out;
    };
    /** The mirror image of a crop (whose top is at `cropY`) in the wet pavement: flipped about the foot of the wall,
     * squashed by the viewing angle, smeared into streaks, broken by ripples, fading away from the wall. */
    const wetReflection = (src: HTMLCanvasElement, cropY: number): HTMLCanvasElement => {
      const dw = src.width;
      const dh = src.height;
      const gy = (groundY - cropY) * S;
      const k = 0.34;
      const mirrored = make(dw, dh);
      const mg = mirrored.getContext('2d')!;
      mg.setTransform(1, 0, 0, -k, 0, (1 + k) * gy);
      mg.drawImage(src, 0, 0);
      const soft = streak(mirrored, 2.5);
      const long = streak(mirrored, 9);
      const out = make(dw, dh);
      const og = out.getContext('2d')!;
      const step = Math.max(1, Math.round(1.6 * S));
      for (let y = Math.floor(gy); y < dh; y += step) {
        const depth = (y - gy) / Math.max(1, dh - gy);
        const off = (Math.sin(y * 0.9 + rand() * 6) * 0.6 + (rand() - 0.5)) * S * (0.8 + depth * 2.2);
        og.drawImage(soft, 0, y, dw, step, off, y, dw, step);
      }
      og.globalCompositeOperation = 'lighter';
      og.globalAlpha = 0.55;
      og.drawImage(long, 0, 0);
      og.globalAlpha = 1;
      og.globalCompositeOperation = 'destination-in';
      const fade = og.createLinearGradient(0, gy, 0, dh);
      fade.addColorStop(0, 'rgba(0,0,0,0.8)');
      fade.addColorStop(1, 'rgba(0,0,0,0.22)');
      og.fillStyle = fade;
      og.fillRect(0, 0, dw, dh);
      og.globalCompositeOperation = 'destination-out';
      og.fillRect(0, 0, dw, Math.max(0, gy));
      return out;
    };

    // ---- the dark street: every painted surface under a dim, cool night light and a far street lamp off to the left,
    // dark enough that the signs' own light is what shows the wall.
    const ambient = make(aw, ah);
    const am = ambient.getContext('2d')!;
    am.setTransform(S, 0, 0, S, 0, 0);
    am.fillStyle = 'rgb(22,26,44)';
    am.fillRect(0, 0, W, H);
    am.globalCompositeOperation = 'lighter';
    const lamp = am.createRadialGradient(W * 0.02, -H * 0.4, 0, W * 0.02, -H * 0.4, Math.max(W * 0.4, H * 1.6));
    lamp.addColorStop(0, 'rgba(150,140,120,0.3)');
    lamp.addColorStop(1, 'rgba(150,140,120,0)');
    am.fillStyle = lamp;
    am.fillRect(0, 0, W, H);
    am.globalCompositeOperation = 'source-over';
    // The pipe is round: under the soft night light its edges turn away and darken.
    const roundness = am.createLinearGradient(pipe.x - pipe.r, 0, pipe.x + pipe.r, 0);
    roundness.addColorStop(0, 'rgb(8,9,16)');
    roundness.addColorStop(0.35, 'rgb(40,44,66)');
    roundness.addColorStop(1, 'rgb(6,7,12)');
    am.fillStyle = roundness;
    am.fillRect(pipe.x - pipe.r, 0, pipe.r * 2, groundY);
    const base = make(aw, ah);
    const b = base.getContext('2d')!;
    b.drawImage(albedo, 0, 0);
    b.globalCompositeOperation = 'multiply';
    b.drawImage(ambient, 0, 0);
    b.globalCompositeOperation = 'source-over';
    // Switched-off glass: faintly visible tubes, black-painted joins, electrodes and clips.
    b.setTransform(S, 0, 0, S, 0, 0);
    for (const sign of signs) {
      const r = sign.tubeR;
      b.lineCap = 'round';
      b.lineJoin = 'round';
      b.lineWidth = r * 2;
      b.strokeStyle = 'rgba(8,8,10,0.9)';
      for (const [p0, p1] of sign.joins) {
        b.beginPath();
        b.moveTo(p0.x, p0.y);
        b.lineTo(p1.x, p1.y);
        b.stroke();
      }
      strokeTubes(b, sign.tubes, r * 2, (t) => rgba(mixHex(t.color, '#c8ccd6', 0.7), 0.3));
      strokeTubes(b, sign.tubes, r * 0.6, () => 'rgba(255,255,255,0.18)');
      for (const t of sign.tubes) {
        for (const s of t.strokes) {
          for (const end of [s[0], s[s.length - 1]]) {
            b.fillStyle = 'rgba(30,31,34,0.95)';
            b.beginPath();
            b.arc(end.x, end.y, r * 1.25, 0, TAU);
            b.fill();
          }
          let run = 0;
          for (let i = 1; i < s.length; i += 1) {
            run += Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y);
            if (run > 26) {
              run = 0;
              b.fillStyle = 'rgba(190,195,205,0.35)';
              b.beginPath();
              b.arc(s[i].x, s[i].y, r * 0.9, 0, TAU);
              b.fill();
            }
          }
        }
      }
    }

    // ---- brick relief for the neon's light: bevelled brick edges and grit catch it, recessed mortar doesn't.
    const hash = (x: number, y: number) => {
      let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    };
    const bevel = joint * 1.6;
    const normal = [0, 0, 1, 1, 0];
    /** Wall normal (x, y, z), how open the spot is to the light, and 1 on the metal pipe (it has a highlight), into
     * `normal`; flat for everything but brick and the pipe. */
    const wallNormal = (x: number, y: number, px: number, py: number) => {
      normal[0] = 0;
      normal[1] = 0;
      normal[2] = 1;
      normal[3] = 1;
      normal[4] = 0;
      for (const r of flat) if (x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1) return;
      const u = (x - pipe.x) / pipe.r;
      if (u > -1 && u < 1) {
        normal[0] = u;
        normal[2] = Math.sqrt(1 - u * u);
        normal[4] = 1;
        return;
      }
      const row = Math.floor(y / bh);
      const yy = y - row * bh;
      let xx = (x - (row % 2 ? -bw / 2 : 0)) % bw;
      if (xx < 0) xx += bw;
      const hj = joint / 2;
      if (xx < hj || xx > bw - hj || yy < hj || yy > bh - hj) {
        normal[3] = 0.45;
        return;
      }
      let nx = (hash(px, py) - 0.5) * 0.32;
      let ny = (hash(py + 7919, px) - 0.5) * 0.32;
      const dl = xx - hj;
      const dr = bw - hj - xx;
      const dt = yy - hj;
      const db = bh - hj - yy;
      if (dl < bevel) nx -= 1 - dl / bevel;
      if (dr < bevel) nx += 1 - dr / bevel;
      if (dt < bevel) ny -= 1 - dt / bevel;
      if (db < bevel) ny += 1 - db / bevel;
      const len = Math.hypot(nx, ny, 1);
      normal[0] = nx / len;
      normal[1] = ny / len;
      normal[2] = 1 / len;
    };
    const albedoPixels = a.getImageData(0, 0, aw, ah).data;

    /**
     * The light a sign's tubes throw on the street, computed rather than faked: each tube is a row of small lights a
     * few cm off the wall (irradiance z / d³ on the wall, height / d³ on the pavement) plus a wide soft wash. The sum is
     * taken on a coarse grid (light is smooth), with the mean direction it comes from; per pixel it's then lit through
     * the brick's relief and multiplied by the surface colour in linear light.
     */
    const bakeSurfaceLight = (sign: Sign, tubes: Tube[], x0: number, y0: number, w: number, h: number, spread: number) => {
      const size = sign.size;
      const spacing = Math.max(1.5, size * 0.07);
      const pts = samplesOf(tubes, spacing);
      const zN = Math.max(2.5, size * 0.22);
      const zF = size * 0.75;
      const iN = NEAR * zN * spacing;
      const iF = ((FAR * zF) / Math.PI) * spacing;
      const inv2 = 1 / (spread * spread);
      const gs = Math.max(3, H / 50);
      const gw = Math.ceil(w / gs) + 2;
      const gh = Math.ceil(h / gs) + 2;
      const grid = new Float32Array(gw * gh * 6);
      for (let gy = 0; gy < gh; gy += 1) {
        const y = y0 + gy * gs;
        const ground = y > groundY;
        const depth = (y - groundY) * 3;
        for (let gx = 0; gx < gw; gx += 1) {
          const x = x0 + gx * gs;
          let er = 0;
          let eg = 0;
          let eb = 0;
          let lx = 0;
          let ly = 0;
          let lz = 0;
          for (let i = 0; i < pts.length; i += 5) {
            const dx = pts[i] - x;
            const dy = pts[i + 1] - y;
            const d2 = dx * dx + dy * dy;
            const fade = 1 - d2 * inv2;
            if (fade <= 0) continue;
            let wgt: number;
            if (!ground) {
              const q = d2 + zN * zN;
              const len = Math.sqrt(q);
              wgt = ((iN * zN) / (q * len) + iF / (d2 + zF * zF)) * fade * fade;
              const lum = (wgt * (0.3 * pts[i + 2] + 0.6 * pts[i + 3] + 0.1 * pts[i + 4])) / len;
              lx += dx * lum;
              ly += dy * lum;
              lz += zN * lum;
            } else {
              const hgt = groundY - pts[i + 1];
              if (hgt <= 0) continue;
              const dz = depth - zN;
              const q = dx * dx + hgt * hgt + dz * dz;
              wgt = ((iN * hgt) / (q * Math.sqrt(q)) + iF / (q + zF * zF)) * fade * fade * GROUND;
            }
            er += pts[i + 2] * wgt;
            eg += pts[i + 3] * wgt;
            eb += pts[i + 4] * wgt;
          }
          const o = (gy * gw + gx) * 6;
          grid[o] = er;
          grid[o + 1] = eg;
          grid[o + 2] = eb;
          grid[o + 3] = lx;
          grid[o + 4] = ly;
          grid[o + 5] = lz;
        }
      }
      const dw = Math.max(1, Math.round(w * S));
      const dh = Math.max(1, Math.round(h * S));
      const ox = Math.round(x0 * S);
      const oy = Math.round(y0 * S);
      const canvas = make(dw, dh);
      const g = canvas.getContext('2d')!;
      const img = g.createImageData(canvas.width, canvas.height);
      const px = img.data;
      const cell = new Float32Array(6);
      for (let py = 0; py < canvas.height; py += 1) {
        const y = (oy + py + 0.5) / S;
        const fy = clamp((y - y0) / gs, 0, gh - 1.001);
        const iy = Math.floor(fy);
        const ty = fy - iy;
        const ground = y > groundY;
        for (let pxi = 0; pxi < canvas.width; pxi += 1) {
          const x = (ox + pxi + 0.5) / S;
          const fx = clamp((x - x0) / gs, 0, gw - 1.001);
          const ix = Math.floor(fx);
          const tx = fx - ix;
          const o00 = (iy * gw + ix) * 6;
          const o10 = o00 + 6;
          const o01 = o00 + gw * 6;
          const o11 = o01 + 6;
          for (let k = 0; k < 6; k += 1) {
            const top = grid[o00 + k] + (grid[o10 + k] - grid[o00 + k]) * tx;
            const bottom = grid[o01 + k] + (grid[o11 + k] - grid[o01 + k]) * tx;
            cell[k] = top + (bottom - top) * ty;
          }
          if (cell[0] + cell[1] + cell[2] < 1e-4) continue;
          let lit = 1;
          let spec = 0;
          if (!ground) {
            wallNormal(x, y, ox + pxi, oy + py);
            const len = Math.hypot(cell[3], cell[4], cell[5]);
            if (len > 0) {
              const dot = (normal[0] * cell[3] + normal[1] * cell[4] + normal[2] * cell[5]) / len;
              lit = Math.min(3, Math.max(0, dot) / Math.max(0.12, cell[5] / len)) * normal[3];
              if (normal[4]) {
                // Painted metal: a streak where the pipe turns the sign's light towards the viewer (half vector).
                const hx = cell[3] / len;
                const hy = cell[4] / len;
                const hz = cell[5] / len + 1;
                spec = Math.max(0, (normal[0] * hx + normal[2] * hz) / Math.hypot(hx, hy, hz)) ** 24 * 0.9;
              }
            }
          }
          const ax = Math.min(aw - 1, ox + pxi);
          const ay = Math.min(ah - 1, oy + py);
          const ai = (ay * aw + ax) * 4;
          const q = (py * canvas.width + pxi) * 4;
          const k = lit * GAIN;
          px[q] = encode((LIN[albedoPixels[ai]] * k + spec) * cell[0]);
          px[q + 1] = encode((LIN[albedoPixels[ai + 1]] * k + spec) * cell[1]);
          px[q + 2] = encode((LIN[albedoPixels[ai + 2]] * k + spec) * cell[2]);
          px[q + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
      return canvas;
    };

    // ---- bake each sign's light (and, separately, its failing tube's).
    const bakeLayer = (sign: Sign, tubes: Tube[]): Layer => {
      // The light reaches the whole card: its falloff alone decides where it fades into the dark.
      const spread = Math.hypot(W, H) * 1.2;
      const x0 = 0;
      const x1 = W;
      const y0 = 0;
      const w = x1 - x0;
      const h = H - y0;
      const lit = bakeSurfaceLight(sign, tubes, x0, y0, w, h, spread);
      const dw = lit.width;
      const dh = lit.height;
      const local = (g: Ctx) => g.setTransform(S, 0, 0, S, -x0 * S, -y0 * S);
      const r = sign.tubeR;
      // The glow in the air: a wide bloom and a tight one hugging the glass.
      const wideSrc = make(dw, dh);
      const wg = wideSrc.getContext('2d')!;
      local(wg);
      strokeTubes(wg, tubes, r * 4, (t) => t.color);
      const wideGlow = blurred(wideSrc, sign.size * 0.5 * S);
      const tightSrc = make(dw, dh);
      const tg = tightSrc.getContext('2d')!;
      local(tg);
      strokeTubes(tg, tubes, r * 2.2, (t) => t.color);
      const tightGlow = blurred(tightSrc, r * 2.5 * S);
      const face = make(dw, dh);
      const fg = face.getContext('2d')!;
      fg.globalCompositeOperation = 'lighter';
      fg.drawImage(wideGlow, 0, 0);
      fg.drawImage(wideGlow, 0, 0);
      fg.drawImage(tightGlow, 0, 0);
      // The lit glass: saturated at its edges, nearly white at the core, where the gas glows hottest.
      local(fg);
      strokeTubes(fg, tubes, r * 2, (t) => mixHex(t.color, '#ffffff', 0.12));
      strokeTubes(fg, tubes, r * 0.95, (t) => mixHex(t.color, '#ffffff', 0.85));
      const out = make(dw, dh);
      const og = out.getContext('2d')!;
      og.globalCompositeOperation = 'lighter';
      og.drawImage(lit, 0, 0);
      og.drawImage(wetReflection(face, y0), 0, 0);
      og.drawImage(face, 0, 0);
      return { canvas: out, x: x0, y: y0, w: dw / S, h: dh / S };
    };

    type Live = {
      layer: Layer;
      sign: number;
      faulty: boolean;
      level: number;
      target: number;
      tick: number;
      ignite: number;
      glitchIn: number;
      glitch: number;
      dead: number;
    };
    const live: Live[] = [];
    const on = signs.map(() => true);
    signs.forEach((sign, si) => {
      const healthy = sign.tubes.filter((_, i) => i !== sign.faulty);
      const mk = (layer: Layer, faulty: boolean): Live => ({
        layer, sign: si, faulty, level: 1, target: 1, tick: 0, ignite: 0,
        glitchIn: faulty ? 8 + rand() * 30 : 12 + rand() * 40, glitch: 0, dead: 0,
      });
      live.push(mk(bakeLayer(sign, healthy), false));
      if (sign.faulty >= 0 && sign.faulty < sign.tubes.length) live.push(mk(bakeLayer(sign, [sign.tubes[sign.faulty]]), true));
    });
    const hover = signs.map(() => 0);

    return {
      update(dt, t, p) {
        if (p.active && p.clicked && c.params.react > 0) {
          signs.forEach((sign, si) => {
            const m = 8;
            if (p.rawX > sign.bbox.x0 - m && p.rawX < sign.bbox.x1 + m && p.rawY > sign.bbox.y0 - m && p.rawY < sign.bbox.y1 + m) {
              on[si] = !on[si];
              if (on[si]) for (const l of live) if (l.sign === si) l.ignite = 0.5 + rand() * 0.5;
            }
          });
        }
        signs.forEach((sign, si) => {
          const near = p.active ? clamp(1 - Math.hypot(p.x - (sign.bbox.x0 + sign.bbox.x1) / 2, p.y - (sign.bbox.y0 + sign.bbox.y1) / 2) / 120, 0, 1) : 0;
          hover[si] += (near * c.params.react - hover[si]) * Math.min(1, dt * 6);
        });
        for (const l of live) {
          // Random states are drawn ~22 times a second — the stutter of a real tube, not per-frame noise.
          l.tick -= dt;
          const step = l.tick <= 0;
          if (step) l.tick = 0.045;
          if (!on[l.sign]) l.target = 0;
          else if (l.ignite > 0) {
            l.ignite -= dt;
            if (step) l.target = rand() < 0.5 ? 1 : 0.06;
            if (l.ignite <= 0) l.target = 1;
          } else if (l.dead > 0) {
            l.dead -= dt;
            l.target = l.dead > 0 ? 0.02 : 1;
          } else {
            // Steady light, and now and then a short stutter: a whole sign every 20–60 s, its failing letter every
            // 20–60 s for a little longer, sometimes going dark for a moment after it.
            l.glitchIn -= dt;
            if (l.glitchIn <= 0) {
              l.glitch = l.faulty ? 0.4 + rand() * 1.1 : 0.15 + rand() * 0.55;
              l.glitchIn = 20 + rand() * 40;
            }
            if (l.glitch > 0) {
              l.glitch -= dt;
              if (step) l.target = rand() < 0.5 ? 1 : l.faulty ? 0.1 + rand() * 0.45 : 0.12;
              if (l.glitch <= 0) {
                l.target = 1;
                if (l.faulty && rand() < 0.35) l.dead = 0.6 + rand() * 2;
              }
            } else l.target = 1;
          }
          l.level += (l.target - l.level) * Math.min(1, dt * 45);
        }
        void t;
      },
      draw(g) {
        g.drawImage(base, 0, 0, W, H);
        g.globalCompositeOperation = 'lighter';
        const intensity = clamp(c.params.intensity, 0, 2);
        for (const l of live) {
          let alpha = l.level * intensity * (1 + 0.15 * hover[l.sign]);
          while (alpha > 0.01) {
            g.globalAlpha = Math.min(1, alpha);
            g.drawImage(l.layer.canvas, l.layer.x, l.layer.y, l.layer.w, l.layer.h);
            alpha -= 1;
          }
        }
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
      },
    };
  },
};
