import type { CanvasSceneDef } from './types';
import { TAU, clamp, mixHex, rgb, rgba } from './kit';

/**
 * "Where I live": an isometric Latvian small town. Two streets cross it and a river runs along its edge under a
 * bridge; pastel wooden houses with gabled roofs, panel blocks of flats, a church with a green copper spire and its
 * golden rooster, a shop with a striped awning, a café with umbrellas, the school, the post office, the pharmacy, a
 * park with a fountain, trees and pines. Cars drive the streets, people walk the pavements, smoke curls from the
 * chimneys. By day the sun casts shadows, birds fly and cloud shadows drift over the roofs; in the evening palette the
 * windows light up one by one, street lamps pour light on the road and cars drive with their headlights on.
 * Point at a building (or wait — the town shows them one by one) to see its Latvian name and the Russian meaning.
 */

type Pt = { x: number; y: number };
type Kind = 'house' | 'flats' | 'nave' | 'tower' | 'shop' | 'cafe' | 'school' | 'pharmacy' | 'post' | 'trees' | 'pines' | 'fountain' | 'umbrellas';
type Win = { face: 0 | 1; u0: number; u1: number; v0: number; v1: number; lit: number; ph: number };
type Bld = {
  i: number;
  j: number;
  kind: Kind;
  k: number;
  h: number;
  ridgeI: boolean;
  roofH: number;
  cols: { left: string; right: string; top: string; back: string; front: string; gableL: string; gableR: string; edge: string };
  wins: Win[];
  label?: [string, string];
  seed: number;
};
type Car = { axis: 0 | 1; lane: number; pos: number; dir: 1 | -1; speed: number; col: string };
type Walker = { axis: 0 | 1; lane: number; pos: number; dir: 1 | -1; speed: number; col: string; ph: number };
type Puff = { x: number; y: number; life: number; r: number };

const WALLS = ['#e8c98a', '#c9e0b0', '#b8543a', '#f0e6d2', '#a8c8e0', '#e0a8a0', '#d8b8e0', '#f2d06a'];
const ROOFS = ['#8a3a2a', '#4a5058', '#6a4a3a', '#9a4a32', '#5a3a48'];
const CARS = ['#d83a3a', '#2f6fd0', '#f0f0f0', '#f2c12e', '#2f9a6a', '#3a3a44'];
const LABELS: Partial<Record<Kind, [string, string]>> = {
  house: ['māja', 'дом'],
  flats: ['daudzdzīvokļu māja', 'многоэтажка'],
  nave: ['baznīca', 'церковь'],
  tower: ['baznīca', 'церковь'],
  shop: ['veikals', 'магазин'],
  cafe: ['kafejnīca', 'кафе'],
  school: ['skola', 'школа'],
  pharmacy: ['aptieka', 'аптека'],
  post: ['pasts', 'почта'],
  fountain: ['strūklaka', 'фонтан'],
  trees: ['parks', 'парк'],
};

const lum = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

export const ISO_TOWN: CanvasSceneDef = {
  kind: 'canvas',
  id: 'iso-town',
  label: 'Городок',
  palettes: [
    ['#8cc6ee', '#eef6fb', '#86c060', '#ffd27a'],
    ['#131a3c', '#d8876a', '#2e4a3a', '#ffc86a'],
  ],
  create(c) {
    const W = c.width;
    const H = c.height;
    const S = c.dpr;
    const rand = c.rand;
    const [skyTop, skyLow, grassCol, lightCol] = c.palette;
    const evening = lum(skyTop) < 0.3;
    const N = 14;
    const M = 12;
    const ROAD_J = 6;
    const ROAD_I = 7;
    const tw = c.body ? clamp(Math.min(W, H) * 0.09, 40, 90) : clamp(W / 15.5, 34, 64);
    const hw = tw / 2;
    const hh = tw / 4;
    const fh = tw * 0.36;
    const cx = W * (c.body ? 0.55 : 0.64);
    const cy = H * (c.body ? 0.5 : 0.52);
    const ox = cx - ((N - M) / 2) * hw;
    const oy = cy - ((N + M) / 2) * hh;
    const iso = (i: number, j: number, z = 0): Pt => ({ x: ox + (i - j) * hw, y: oy + (i + j) * hh - z });

    // Evening darkens and blues everything lit by the sky; k is how much a face faces the light.
    const shade = (hex: string, k: number) => {
      const base = evening ? mixHex(hex, '#222a50', 0.6) : hex;
      return k >= 1 ? mixHex(base, '#ffffff', Math.min(0.5, k - 1)) : mixHex(base, evening ? '#04050d' : '#1c1c34', 1 - k);
    };

    const tileKind = (i: number, j: number) => {
      if (i >= 12) return j === ROAD_J ? 'bridge' : 'water';
      if (i === ROAD_I && j === ROAD_J) return 'cross';
      if (j === ROAD_J) return 'road-i';
      if (i === ROAD_I) return 'road-j';
      return 'land';
    };

    // The town plan: a few fixed landmarks near the middle, the rest filled in.
    const fixed: Record<string, Kind> = {
      '5,4': 'nave', '5,5': 'tower', '6,5': 'shop', '8,5': 'post', '10,5': 'school', '6,7': 'umbrellas', '5,7': 'cafe',
      '3,7': 'pharmacy', '9,8': 'fountain', '8,8': 'trees', '10,8': 'trees', '9,9': 'trees', '8,7': 'shop',
    };
    const blds: Bld[] = [];
    for (let i = 0; i < 12; i += 1) {
      for (let j = 0; j < M; j += 1) {
        if (tileKind(i, j) !== 'land') continue;
        let kind: Kind | undefined = fixed[`${i},${j}`];
        const street = Math.abs(j - ROAD_J) === 1 || Math.abs(i - ROAD_I) === 1;
        if (!kind) {
          const r = rand();
          if (i === 11 && r < 0.7) kind = 'trees';
          else if (street) kind = r < 0.7 ? 'house' : r < 0.82 ? 'flats' : 'trees';
          else kind = r < 0.5 ? 'house' : r < 0.6 ? 'flats' : r < 0.82 ? 'trees' : 'pines';
        }
        const seed = rand();
        const wall = WALLS[Math.floor(rand() * WALLS.length)];
        let roof = ROOFS[Math.floor(rand() * ROOFS.length)];
        let h = fh * (1 + rand() * 0.6);
        let k = 0.78;
        let roofH = fh * 0.8;
        let ridgeI = rand() < 0.5;
        let wallCol = wall;
        if (kind === 'flats') {
          h = fh * (3 + Math.floor(rand() * 2));
          wallCol = rand() < 0.5 ? '#e4e2dc' : '#cfd6dc';
          roofH = 0;
          k = 0.8;
        } else if (kind === 'nave') {
          h = fh * 1.9;
          wallCol = '#f2eee4';
          roof = '#3e8a70';
          roofH = fh * 1.4;
          ridgeI = false;
          k = 0.86;
        } else if (kind === 'tower') {
          h = fh * 3.6;
          wallCol = '#f2eee4';
          roof = '#3e8a70';
          roofH = fh * 3.4;
          k = 0.5;
        } else if (kind === 'shop' || kind === 'pharmacy' || kind === 'post' || kind === 'cafe') {
          h = fh * (kind === 'post' ? 2 : 1.2);
          roofH = kind === 'post' ? fh * 0.7 : 0;
          wallCol = kind === 'pharmacy' ? '#eef4f0' : kind === 'post' ? '#f2d06a' : kind === 'cafe' ? '#e8c9a8' : '#f0e6d2';
          k = 0.82;
        } else if (kind === 'school') {
          h = fh * 2.2;
          wallCol = '#d9a070';
          roof = '#6a3a2a';
          roofH = fh * 0.6;
          ridgeI = true;
          k = 0.88;
        }
        const floors = Math.max(1, Math.round(h / fh));
        const wins: Win[] = [];
        if (kind !== 'trees' && kind !== 'pines' && kind !== 'fountain' && kind !== 'umbrellas') {
          const per = kind === 'flats' ? 3 : kind === 'tower' ? 1 : 2;
          for (let f = 0; f < floors; f += 1) {
            for (const face of [0, 1] as const) {
              for (let w = 0; w < per; w += 1) {
                const u0 = (w + 0.28) / per;
                const big = kind === 'shop' || kind === 'cafe' || kind === 'pharmacy';
                wins.push({
                  face,
                  u0: big && f === 0 ? 0.12 + w * 0.46 : u0,
                  u1: big && f === 0 ? 0.42 + w * 0.46 : u0 + 0.44 / per,
                  v0: (f + (big ? 0.12 : 0.3)) * (h / floors),
                  v1: (f + (big ? 0.72 : 0.72)) * (h / floors),
                  lit: rand() < 0.62 ? 1 : 0,
                  ph: rand() * 40,
                });
              }
            }
          }
        }
        blds.push({
          i,
          j,
          kind,
          k,
          h,
          ridgeI,
          roofH,
          wins,
          seed,
          label: LABELS[kind],
          cols: {
            left: shade(wallCol, 0.95),
            right: shade(wallCol, 0.7),
            top: shade(kind === 'flats' || roofH === 0 ? '#9a9aa2' : roof, 1.02),
            back: shade(roof, ridgeI ? 0.82 : 1.08),
            front: shade(roof, ridgeI ? 0.98 : 0.7),
            gableL: shade(wallCol, 0.95),
            gableR: shade(wallCol, 0.7),
            edge: shade(wallCol, 0.5),
          },
        });
      }
    }
    blds.sort((a, b) => a.i + a.j - (b.i + b.j) || a.i - b.i);
    const labelled = blds.filter((b) => b.label && b.kind !== 'tower');

    // The ground, painted once: sky behind, tiles, water, roads, and (by day) the buildings' shadows.
    const ground = document.createElement('canvas');
    ground.width = Math.ceil(W * S);
    ground.height = Math.ceil(H * S);
    {
      const g = ground.getContext('2d')!;
      g.scale(S, S);
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, skyTop);
      sky.addColorStop(1, skyLow);
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
      const quad = (a: Pt, b: Pt, cc: Pt, d: Pt) => {
        g.beginPath();
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
        g.lineTo(cc.x, cc.y);
        g.lineTo(d.x, d.y);
        g.closePath();
      };
      // The town sits on a slab of earth, its edges visible where the map ends.
      const e = fh * 0.5;
      const Lc = iso(0, M);
      const Bc = iso(N, M);
      const Rc = iso(N, 0);
      g.fillStyle = shade('#7a5a3a', 0.9);
      quad(Lc, Bc, { x: Bc.x, y: Bc.y + e }, { x: Lc.x, y: Lc.y + e });
      g.fill();
      g.fillStyle = shade('#7a5a3a', 0.62);
      quad(Bc, Rc, { x: Rc.x, y: Rc.y + e }, { x: Bc.x, y: Bc.y + e });
      g.fill();
      const tileRand = (i: number, j: number) => ((Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1 + 1) % 1;
      for (let i = 0; i < N; i += 1) {
        for (let j = 0; j < M; j += 1) {
          const kind = tileKind(i, j);
          const t = iso(i, j);
          const r = iso(i + 1, j);
          const b = iso(i + 1, j + 1);
          const l = iso(i, j + 1);
          let col = mixHex(grassCol, tileRand(i, j) < 0.5 ? '#6aa04a' : '#9ad070', 0.25);
          if (kind === 'water') col = evening ? '#16284a' : '#4a9ad0';
          else if (kind === 'road-i' || kind === 'road-j' || kind === 'cross' || kind === 'bridge') col = '#5a5e66';
          else if (fixed[`${i},${j}`] === 'umbrellas' || fixed[`${i},${j}`] === 'fountain') col = '#d8ccb0';
          g.fillStyle = kind === 'water' ? col : shade(col, 1);
          quad(t, r, b, l);
          g.fill();
          if (kind === 'road-i' || kind === 'road-j' || kind === 'bridge') {
            // Pavement kerbs and the dashed centre line.
            g.strokeStyle = shade('#c8c4bc', 1);
            g.lineWidth = Math.max(1, tw * 0.035);
            g.beginPath();
            if (kind === 'road-j') {
              g.moveTo(t.x, t.y);
              g.lineTo(l.x, l.y);
              g.moveTo(r.x, r.y);
              g.lineTo(b.x, b.y);
            } else {
              g.moveTo(t.x, t.y);
              g.lineTo(r.x, r.y);
              g.moveTo(l.x, l.y);
              g.lineTo(b.x, b.y);
            }
            g.stroke();
            g.strokeStyle = shade('#f2f0e8', 1);
            g.lineWidth = Math.max(0.8, tw * 0.02);
            const a0 = kind === 'road-j' ? iso(i + 0.5, j + 0.2) : iso(i + 0.2, j + 0.5);
            const a1 = kind === 'road-j' ? iso(i + 0.5, j + 0.6) : iso(i + 0.6, j + 0.5);
            g.beginPath();
            g.moveTo(a0.x, a0.y);
            g.lineTo(a1.x, a1.y);
            g.stroke();
          }
          if (kind === 'bridge') {
            g.strokeStyle = shade('#8a8680', 1);
            g.lineWidth = Math.max(1.2, tw * 0.05);
            for (const jj of [j, j + 1]) {
              const p0 = iso(i, jj, fh * 0.35);
              const p1 = iso(i + 1, jj, fh * 0.35);
              g.beginPath();
              g.moveTo(p0.x, p0.y);
              g.lineTo(p1.x, p1.y);
              g.stroke();
            }
          }
        }
      }
      if (!evening) {
        const sh = document.createElement('canvas');
        sh.width = ground.width;
        sh.height = ground.height;
        const s = sh.getContext('2d')!;
        s.scale(S, S);
        s.fillStyle = '#000';
        for (const bd of blds) {
          const i0 = bd.i + 0.5 - bd.k / 2;
          const i1 = bd.i + 0.5 + bd.k / 2;
          const j0 = bd.j + 0.5 - bd.k / 2;
          const j1 = bd.j + 0.5 + bd.k / 2;
          if (bd.kind === 'trees' || bd.kind === 'pines' || bd.kind === 'umbrellas' || bd.kind === 'fountain') {
            if (bd.kind === 'fountain') continue;
            const p = iso(bd.i + 0.5, bd.j + 0.5);
            s.beginPath();
            s.ellipse(p.x + tw * 0.22, p.y + hh * 0.1, tw * 0.3, hh * 0.45, 0, 0, TAU);
            s.fill();
            continue;
          }
          // The shadow of a box, falling to the lower right: the footprint swept along the sun's direction.
          const len = (bd.h + bd.roofH * 0.5) / fh;
          const di = len * 0.55;
          const dj = -len * 0.1;
          const pts = [iso(i0, j0), iso(i1, j0), iso(i1, j1), iso(i0, j1)];
          const sp = [iso(i0 + di, j0 + dj), iso(i1 + di, j0 + dj), iso(i1 + di, j1 + dj), iso(i0 + di, j1 + dj)];
          for (let q = 0; q < 4; q += 1) {
            const a = pts[q];
            const b = pts[(q + 1) % 4];
            s.beginPath();
            s.moveTo(a.x, a.y);
            s.lineTo(b.x, b.y);
            s.lineTo(sp[(q + 1) % 4].x, sp[(q + 1) % 4].y);
            s.lineTo(sp[q].x, sp[q].y);
            s.fill();
          }
          s.beginPath();
          sp.forEach((p, q) => (q ? s.lineTo(p.x, p.y) : s.moveTo(p.x, p.y)));
          s.fill();
        }
        g.globalAlpha = 0.22;
        g.drawImage(sh, 0, 0, W, H);
        g.globalAlpha = 1;
      }
    }

    const cars: Car[] = Array.from({ length: 6 }, (_, n) => ({
      axis: (n % 2) as 0 | 1,
      lane: n % 4 < 2 ? 0.28 : -0.28,
      pos: rand() * 14,
      dir: n % 4 < 2 ? 1 : -1,
      speed: 0.9 + rand() * 0.6,
      col: CARS[n % CARS.length],
    }));
    cars.forEach((car) => (car.dir = car.lane > 0 ? 1 : -1));
    const walkers: Walker[] = Array.from({ length: 10 }, (_, n) => ({
      axis: (n % 2) as 0 | 1,
      lane: rand() < 0.5 ? 0.46 : -0.46,
      pos: rand() * 12,
      dir: rand() < 0.5 ? 1 : -1,
      speed: 0.18 + rand() * 0.12,
      col: ['#d84a4a', '#3a6ad0', '#f2c12e', '#5aa05a', '#8a4ad0', '#f08a3a'][n % 6],
      ph: rand() * TAU,
    }));
    const puffs: Puff[] = [];
    const birds = Array.from({ length: evening ? 0 : 4 }, () => ({ x: rand() * W, y: H * (0.08 + rand() * 0.25), v: 18 + rand() * 14, ph: rand() * TAU }));
    let clock = 0;
    let focus = -1;
    let autoAt = 0;
    let autoIdx = Math.floor(rand() * Math.max(1, labelled.length));
    let focusFade = 0;

    const quad = (g: CanvasRenderingContext2D, pts: Pt[], fill: string) => {
      g.fillStyle = fill;
      g.beginPath();
      pts.forEach((p, q) => (q ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.closePath();
      g.fill();
    };
    const up = (p: Pt, z: number): Pt => ({ x: p.x, y: p.y - z });
    const lerpPt = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    const box = (g: CanvasRenderingContext2D, ci: number, cj: number, li: number, lj: number, z0: number, h: number, left: string, right: string, top: string) => {
      const T = iso(ci - li / 2, cj - lj / 2, z0);
      const R = iso(ci + li / 2, cj - lj / 2, z0);
      const B = iso(ci + li / 2, cj + lj / 2, z0);
      const L = iso(ci - li / 2, cj + lj / 2, z0);
      quad(g, [L, B, up(B, h), up(L, h)], left);
      quad(g, [B, R, up(R, h), up(B, h)], right);
      quad(g, [up(T, h), up(R, h), up(B, h), up(L, h)], top);
    };

    const drawTree = (g: CanvasRenderingContext2D, x: number, y: number, s: number, pine: boolean, sway: number) => {
      g.strokeStyle = shade('#6a4a2a', 0.9);
      g.lineWidth = Math.max(1, s * 0.14);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + sway * 0.3, y - s * 0.9);
      g.stroke();
      if (pine) {
        for (let q = 0; q < 3; q += 1) {
          const w = s * (0.75 - q * 0.18);
          const yy = y - s * (0.6 + q * 0.55);
          g.fillStyle = shade('#2f6a44', 1.05 - q * 0.08);
          g.beginPath();
          g.moveTo(x - w + sway * (0.4 + q * 0.2), yy + s * 0.25);
          g.lineTo(x + sway * (0.6 + q * 0.3), yy - s * 0.55);
          g.lineTo(x + w + sway * (0.4 + q * 0.2), yy + s * 0.25);
          g.fill();
        }
        return;
      }
      const cxp = x + sway;
      const cyp = y - s * 1.35;
      for (const [dx, dy, r, k] of [[-0.3, 0.15, 0.55, 0.85], [0.3, 0.12, 0.52, 0.72], [0, -0.2, 0.62, 1.05]] as const) {
        const gr = g.createRadialGradient(cxp + dx * s - r * s * 0.3, cyp + dy * s - r * s * 0.35, r * s * 0.1, cxp + dx * s, cyp + dy * s, r * s);
        gr.addColorStop(0, shade('#7ac050', k + 0.15));
        gr.addColorStop(1, shade('#3a7a3a', k * 0.8));
        g.fillStyle = gr;
        g.beginPath();
        g.arc(cxp + dx * s, cyp + dy * s, r * s, 0, TAU);
        g.fill();
      }
    };

    const drawBuilding = (g: CanvasRenderingContext2D, bd: Bld, hot: number) => {
      const lift = hot * 3;
      const ci = bd.i + 0.5;
      const cj = bd.j + 0.5;
      if (bd.kind === 'trees' || bd.kind === 'pines') {
        const n = bd.kind === 'pines' ? 3 : 2 + Math.floor(bd.seed * 2);
        for (let q = 0; q < n; q += 1) {
          const a = bd.seed * 10 + q * 2.4;
          const p = iso(ci + Math.cos(a) * 0.22, cj + Math.sin(a) * 0.22);
          const sway = Math.sin(clock * 1.3 + a) * tw * 0.02;
          drawTree(g, p.x, p.y - lift, tw * (0.28 + ((q * 0.37 + bd.seed) % 1) * 0.1), bd.kind === 'pines', sway);
        }
        return;
      }
      if (bd.kind === 'fountain') {
        const p = iso(ci, cj);
        g.fillStyle = shade('#a8a49c', 0.8);
        g.beginPath();
        g.ellipse(p.x, p.y, hw * 0.62, hh * 0.62, 0, 0, TAU);
        g.fill();
        g.fillStyle = evening ? '#2a4a7a' : '#6ab8e8';
        g.beginPath();
        g.ellipse(p.x, p.y - 2, hw * 0.5, hh * 0.5, 0, 0, TAU);
        g.fill();
        g.strokeStyle = rgba('#ffffff', 0.7);
        g.lineWidth = Math.max(1, tw * 0.03);
        for (let q = 0; q < 5; q += 1) {
          const a = (q / 5) * TAU + clock;
          const hgt = tw * (0.35 + 0.08 * Math.sin(clock * 4 + q));
          g.beginPath();
          g.moveTo(p.x, p.y - 3);
          g.quadraticCurveTo(p.x + Math.cos(a) * hw * 0.2, p.y - hgt, p.x + Math.cos(a) * hw * 0.38, p.y - 2 + Math.sin(a) * hh * 0.3);
          g.stroke();
        }
        return;
      }
      if (bd.kind === 'umbrellas') {
        for (const [di, dj, col] of [[-0.18, -0.12, '#d83a3a'], [0.2, 0.15, '#f2f0e8']] as const) {
          const p = iso(ci + di, cj + dj);
          box(g, ci + di, cj + dj, 0.22, 0.22, 0, tw * 0.1, shade('#8a6a4a', 0.9), shade('#8a6a4a', 0.7), shade('#a8845a', 1));
          g.strokeStyle = shade('#6a6a6a', 1);
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(p.x, p.y);
          g.lineTo(p.x, p.y - tw * 0.42);
          g.stroke();
          g.fillStyle = shade(col, 0.95);
          g.beginPath();
          g.moveTo(p.x - hw * 0.42, p.y - tw * 0.32);
          g.lineTo(p.x, p.y - tw * 0.5);
          g.lineTo(p.x + hw * 0.42, p.y - tw * 0.32);
          g.quadraticCurveTo(p.x, p.y - tw * 0.26, p.x - hw * 0.42, p.y - tw * 0.32);
          g.fill();
        }
        return;
      }
      const i0 = ci - bd.k / 2;
      const i1 = ci + bd.k / 2;
      const j0 = cj - bd.k / 2;
      const j1 = cj + bd.k / 2;
      const T = iso(i0, j0, lift);
      const R = iso(i1, j0, lift);
      const B = iso(i1, j1, lift);
      const L = iso(i0, j1, lift);
      const h = bd.h;
      const cl = bd.cols;
      const hl = (col: string) => (hot > 0 ? mixHex(col, '#ffffff', hot * 0.12) : col);
      quad(g, [L, B, up(B, h), up(L, h)], hl(cl.left));
      quad(g, [B, R, up(R, h), up(B, h)], hl(cl.right));
      // Windows, a door, the shop's awning.
      for (const w of bd.wins) {
        const a = w.face === 0 ? L : B;
        const b = w.face === 0 ? B : R;
        const p0 = lerpPt(a, b, w.u0);
        const p1 = lerpPt(a, b, w.u1);
        let col: string;
        if (evening) {
          const on = w.lit && Math.sin(clock * 0.05 + w.ph) > -0.7;
          col = on ? (w.ph % 3 < 1 ? '#ffe2a0' : w.ph % 3 < 2 ? '#ffc870' : '#c8e0ff') : '#1a1e30';
        } else {
          col = w.face === 0 ? '#6a8aa8' : '#4a6480';
        }
        quad(g, [up(p0, w.v0), up(p1, w.v0), up(p1, w.v1), up(p0, w.v1)], col);
        if (!evening && w.face === 0) {
          const q0 = lerpPt(p0, p1, 0.15);
          const q1 = lerpPt(p0, p1, 0.35);
          quad(g, [up(q0, w.v0 + (w.v1 - w.v0) * 0.4), up(q1, w.v0 + (w.v1 - w.v0) * 0.6), up(q1, w.v1), up(q0, w.v1)], 'rgba(255,255,255,0.35)');
        }
      }
      if (bd.kind === 'shop' || bd.kind === 'cafe' || bd.kind === 'pharmacy') {
        const aw = bd.kind === 'pharmacy' ? '#2f9a5a' : bd.kind === 'cafe' ? '#8a3a2a' : '#d83a3a';
        for (let s = 0; s < 6; s += 1) {
          const p0 = lerpPt(L, B, s / 6);
          const p1 = lerpPt(L, B, (s + 1) / 6);
          const top = h * 0.78;
          quad(g, [up(p0, top), up(p1, top), { x: p1.x - hw * 0.12, y: p1.y - top + hh * 0.5 }, { x: p0.x - hw * 0.12, y: p0.y - top + hh * 0.5 }], shade(s % 2 ? '#f2f0e8' : aw, 0.95));
        }
      }
      if (bd.kind === 'pharmacy') {
        const p = lerpPt(B, R, 0.5);
        g.fillStyle = evening ? '#5aff9a' : '#2fae5a';
        g.fillRect(p.x - tw * 0.05, p.y - h * 0.85 - tw * 0.015, tw * 0.1, tw * 0.03);
        g.fillRect(p.x - tw * 0.015, p.y - h * 0.85 - tw * 0.05, tw * 0.03, tw * 0.1);
      }
      if (bd.kind === 'post') {
        const p = lerpPt(B, R, 0.5);
        g.fillStyle = '#1a4a9a';
        g.fillRect(p.x - tw * 0.06, p.y - h * 0.9, tw * 0.12, tw * 0.07);
      }
      if (bd.kind === 'school') {
        const p = up(lerpPt(L, B, 0.5), h * 0.86);
        g.fillStyle = '#f2f0e8';
        g.beginPath();
        g.arc(p.x, p.y, tw * 0.06, 0, TAU);
        g.fill();
        g.strokeStyle = '#2a2a2a';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(p.x, p.y);
        g.lineTo(p.x, p.y - tw * 0.045);
        g.moveTo(p.x, p.y);
        g.lineTo(p.x + tw * 0.03, p.y);
        g.stroke();
      }
      // Roof.
      const Th = up(T, h);
      const Rh = up(R, h);
      const Bh = up(B, h);
      const Lh = up(L, h);
      if (bd.kind === 'tower') {
        const apex = up(iso(ci, cj, lift), h + bd.roofH);
        quad(g, [Lh, Bh, apex], hl(shade('#3e8a70', 0.95)));
        quad(g, [Bh, Rh, apex], hl(shade('#3e8a70', 0.66)));
        g.fillStyle = '#ffd24a';
        g.beginPath();
        g.moveTo(apex.x - tw * 0.04, apex.y - tw * 0.02);
        g.quadraticCurveTo(apex.x, apex.y - tw * 0.12, apex.x + tw * 0.05, apex.y - tw * 0.05);
        g.lineTo(apex.x, apex.y);
        g.fill();
        return;
      }
      if (bd.roofH <= 0) {
        quad(g, [Th, Rh, Bh, Lh], hl(cl.top));
        if (bd.kind === 'flats') box(g, ci - bd.k * 0.15, cj - bd.k * 0.15, 0.2, 0.25, h + lift, tw * 0.12, shade('#b8b8b8', 0.95), shade('#b8b8b8', 0.7), shade('#c8c8c8', 1.02));
        return;
      }
      const rz = bd.roofH;
      if (bd.ridgeI) {
        const m1 = up(lerpPt(Th, Lh, 0.5), rz);
        const m2 = up(lerpPt(Rh, Bh, 0.5), rz);
        quad(g, [Th, Rh, m2, m1], hl(cl.back));
        quad(g, [Bh, Rh, m2], hl(cl.gableR));
        quad(g, [Lh, Bh, m2, m1], hl(cl.front));
        if (bd.kind === 'house') {
          const ch = lerpPt(m1, Th, 0.4);
          const cw = tw * 0.07;
          quad(g, [{ x: ch.x - cw, y: ch.y }, { x: ch.x, y: ch.y + cw * 0.5 }, { x: ch.x, y: ch.y - fh * 0.45 }, { x: ch.x - cw, y: ch.y - fh * 0.5 }], shade('#8a4a3a', 0.9));
          quad(g, [{ x: ch.x, y: ch.y + cw * 0.5 }, { x: ch.x + cw, y: ch.y }, { x: ch.x + cw, y: ch.y - fh * 0.5 }, { x: ch.x, y: ch.y - fh * 0.45 }], shade('#8a4a3a', 0.65));
        }
      } else {
        const m1 = up(lerpPt(Th, Rh, 0.5), rz);
        const m2 = up(lerpPt(Lh, Bh, 0.5), rz);
        quad(g, [Th, Lh, m2, m1], hl(cl.back));
        quad(g, [Lh, Bh, m2], hl(cl.gableL));
        quad(g, [Rh, Bh, m2, m1], hl(cl.front));
      }
    };
    const chimneyOf = (bd: Bld): Pt | null => {
      if (bd.kind !== 'house' || !bd.ridgeI) return null;
      const ci = bd.i + 0.5;
      const cj = bd.j + 0.5;
      const T = iso(ci - bd.k / 2, cj - bd.k / 2);
      const L = iso(ci - bd.k / 2, cj + bd.k / 2);
      const m1 = up(lerpPt(up(T, bd.h), up(L, bd.h), 0.5), bd.roofH);
      const ch = lerpPt(m1, up(T, bd.h), 0.4);
      return { x: ch.x, y: ch.y - fh * 0.5 };
    };
    const chimneys = blds.map(chimneyOf).filter((p): p is Pt => !!p && p.y > 0 && p.y < H && p.x > 0 && p.x < W);

    const carPos = (car: Car) => (car.axis === 0 ? { i: car.pos, j: ROAD_J + 0.5 + car.lane } : { i: ROAD_I + 0.5 + car.lane, j: car.pos });
    const walkerPos = (w: Walker) => (w.axis === 0 ? { i: w.pos, j: ROAD_J + 0.5 + w.lane } : { i: ROAD_I + 0.5 + w.lane, j: w.pos });

    return {
      update(dt, _t, p) {
        const sdt = Math.min(dt, 0.05) * clamp(c.params.speed, 0.2, 3);
        clock += sdt;
        for (const car of cars) {
          const len = car.axis === 0 ? N : M;
          car.pos += car.dir * car.speed * sdt;
          if (car.pos > len + 1) car.pos = -1;
          if (car.pos < -1) car.pos = len + 1;
        }
        for (const w of walkers) {
          const len = w.axis === 0 ? 12 : M;
          w.pos += w.dir * w.speed * sdt;
          if (w.pos > len) w.dir = -1;
          if (w.pos < 0) w.dir = 1;
        }
        if (rand() < sdt * chimneys.length * 1.2) {
          const ch = chimneys[Math.floor(rand() * chimneys.length)];
          puffs.push({ x: ch.x, y: ch.y, life: 1, r: tw * 0.05 });
        }
        for (let q = puffs.length - 1; q >= 0; q -= 1) {
          const pf = puffs[q];
          pf.y -= tw * 0.35 * sdt;
          pf.x += tw * 0.15 * sdt;
          pf.r += tw * 0.08 * sdt;
          pf.life -= sdt / 3;
          if (pf.life <= 0) puffs.splice(q, 1);
        }
        for (const b of birds) {
          b.x += b.v * sdt;
          if (b.x > W + 20) {
            b.x = -20;
            b.y = H * (0.08 + rand() * 0.25);
          }
        }
        // The building under the cursor, or one shown on its own every few seconds.
        let hit = -1;
        if (p.active && c.params.react > 0) {
          for (let q = blds.length - 1; q >= 0 && hit < 0; q -= 1) {
            const bd = blds[q];
            if (!bd.label) continue;
            const base = iso(bd.i + 0.5, bd.j + 0.5);
            const top = base.y - bd.h - bd.roofH - hh;
            if (Math.abs(p.x - base.x) < hw * bd.k * 1.02 && p.y > top && p.y < base.y + hh * bd.k) hit = q;
          }
          if (hit >= 0 && blds[hit].kind === 'tower') hit = blds.findIndex((b) => b.kind === 'nave');
        } else if (clock > autoAt) {
          autoAt = clock + 3.2;
          autoIdx = (autoIdx + 1) % Math.max(1, labelled.length);
        }
        const want = hit >= 0 ? hit : !p.active && labelled.length ? blds.indexOf(labelled[autoIdx]) : -1;
        if (want !== focus) {
          focusFade = Math.max(0, focusFade - sdt * 6);
          if (focusFade === 0) focus = want;
        } else focusFade = Math.min(1, focusFade + sdt * 4);
      },
      draw(g) {
        g.drawImage(ground, 0, 0, W, H);
        // Water shimmer.
        g.strokeStyle = rgba('#ffffff', evening ? 0.12 : 0.35);
        g.lineWidth = 1;
        for (let q = 0; q < 26; q += 1) {
          const j = (q * 0.47 + clock * 0.15) % M;
          const i = 12 + ((q * 0.61) % 2);
          const p0 = iso(i, j);
          g.beginPath();
          g.moveTo(p0.x, p0.y);
          g.lineTo(p0.x + tw * 0.14, p0.y + hh * 0.14);
          g.stroke();
        }
        // Everything standing, back to front: buildings, trees, cars and people sorted by depth.
        type Item = { d: number; draw: () => void };
        const items: Item[] = [];
        blds.forEach((bd, q) => {
          const hot = q === focus ? focusFade : 0;
          items.push({ d: bd.i + bd.j + 1, draw: () => drawBuilding(g, bd, hot) });
        });
        for (const car of cars) {
          const cp = carPos(car);
          if (cp.i < -0.5 || cp.j < -0.5 || cp.i > N + 0.5 || cp.j > M + 0.5) continue;
          items.push({
            d: cp.i + cp.j,
            draw: () => {
              const li = car.axis === 0 ? 0.46 : 0.24;
              const lj = car.axis === 0 ? 0.24 : 0.46;
              box(g, cp.i, cp.j, li, lj, tw * 0.03, tw * 0.1, shade(car.col, 0.95), shade(car.col, 0.68), shade(car.col, 1.05));
              box(g, cp.i - (car.axis === 0 ? car.dir * 0.03 : 0), cp.j - (car.axis === 1 ? car.dir * 0.03 : 0), li * (car.axis === 0 ? 0.55 : 0.9), lj * (car.axis === 1 ? 0.55 : 0.9), tw * 0.13, tw * 0.07, shade('#3a4a5a', 0.95), shade('#2a3440', 0.8), shade(car.col, 1));
            },
          });
        }
        for (const w of walkers) {
          const wp = walkerPos(w);
          items.push({
            d: wp.i + wp.j,
            draw: () => {
              const pt = iso(wp.i, wp.j);
              const s = tw / 44;
              const step = Math.sin(clock * 8 + w.ph) * 1.2 * s;
              g.fillStyle = shade('#2a2a3a', 0.9);
              g.fillRect(pt.x - 1.2 * s + step * 0.3, pt.y - 4 * s, 1.1 * s, 4 * s);
              g.fillRect(pt.x + 0.2 * s - step * 0.3, pt.y - 4 * s, 1.1 * s, 4 * s);
              g.fillStyle = shade(w.col, 1);
              g.fillRect(pt.x - 1.8 * s, pt.y - 9 * s, 3.6 * s, 5.5 * s);
              g.fillStyle = shade('#f0c8a0', 1);
              g.beginPath();
              g.arc(pt.x, pt.y - 10.5 * s, 1.7 * s, 0, TAU);
              g.fill();
            },
          });
        }
        items.sort((a, b) => a.d - b.d);
        for (const it of items) it.draw();

        for (const pf of puffs) {
          g.fillStyle = rgba(evening ? '#8a8aa0' : '#f2f2f2', 0.35 * pf.life);
          g.beginPath();
          g.arc(pf.x, pf.y, pf.r, 0, TAU);
          g.fill();
        }
        if (evening) {
          // Street lamps, their pools of light and the cars' headlights.
          g.globalCompositeOperation = 'lighter';
          for (let q = 0; q < N; q += 2) {
            for (const [li, lj] of [[q + 0.5, ROAD_J - 0.05], [ROAD_I - 0.05, q + 0.5]]) {
              if (lj > M || li > 12) continue;
              const base = iso(li, lj);
              const head = { x: base.x, y: base.y - tw * 0.55 };
              const pool = g.createRadialGradient(base.x, base.y + hh * 0.4, 0, base.x, base.y + hh * 0.4, tw * 0.7);
              pool.addColorStop(0, rgba(lightCol, 0.28));
              pool.addColorStop(1, rgba(lightCol, 0));
              g.fillStyle = pool;
              g.fillRect(base.x - tw * 0.7, base.y - tw * 0.3, tw * 1.4, tw * 1.4);
              const glowG = g.createRadialGradient(head.x, head.y, 0, head.x, head.y, tw * 0.25);
              glowG.addColorStop(0, rgba('#ffffff', 0.9));
              glowG.addColorStop(0.2, rgba(lightCol, 0.6));
              glowG.addColorStop(1, rgba(lightCol, 0));
              g.fillStyle = glowG;
              g.fillRect(head.x - tw * 0.25, head.y - tw * 0.25, tw * 0.5, tw * 0.5);
              g.globalCompositeOperation = 'source-over';
              g.strokeStyle = '#1a1c28';
              g.lineWidth = Math.max(1, tw * 0.03);
              g.beginPath();
              g.moveTo(base.x, base.y);
              g.lineTo(head.x, head.y);
              g.stroke();
              g.globalCompositeOperation = 'lighter';
            }
          }
          for (const car of cars) {
            const cp = carPos(car);
            const front = car.axis === 0 ? iso(cp.i + car.dir * 0.25, cp.j, tw * 0.07) : iso(cp.i, cp.j + car.dir * 0.25, tw * 0.07);
            const far = car.axis === 0 ? iso(cp.i + car.dir * 1.3, cp.j) : iso(cp.i, cp.j + car.dir * 1.3);
            const beam = g.createRadialGradient(front.x, front.y, 0, far.x, far.y, tw * 0.9);
            beam.addColorStop(0, 'rgba(255,240,200,0.24)');
            beam.addColorStop(1, 'rgba(255,240,200,0)');
            g.fillStyle = beam;
            g.beginPath();
            g.moveTo(front.x, front.y);
            const nx = -(far.y - front.y);
            const ny = far.x - front.x;
            const nl = Math.hypot(nx, ny) || 1;
            g.lineTo(far.x + (nx / nl) * tw * 0.3, far.y + (ny / nl) * tw * 0.3);
            g.lineTo(far.x - (nx / nl) * tw * 0.3, far.y - (ny / nl) * tw * 0.3);
            g.fill();
            const back = car.axis === 0 ? iso(cp.i - car.dir * 0.24, cp.j, tw * 0.08) : iso(cp.i, cp.j - car.dir * 0.24, tw * 0.08);
            const tail = g.createRadialGradient(back.x, back.y, 0, back.x, back.y, tw * 0.12);
            tail.addColorStop(0, 'rgba(255,60,60,0.9)');
            tail.addColorStop(1, 'rgba(255,60,60,0)');
            g.fillStyle = tail;
            g.fillRect(back.x - tw * 0.12, back.y - tw * 0.12, tw * 0.24, tw * 0.24);
          }
          g.globalCompositeOperation = 'source-over';
        } else {
          g.strokeStyle = 'rgba(40,40,60,0.7)';
          g.lineWidth = 1.2;
          for (const b of birds) {
            const f = Math.sin(clock * 9 + b.ph) * 3;
            g.beginPath();
            g.moveTo(b.x - 5, b.y - f);
            g.quadraticCurveTo(b.x - 2, b.y - 2, b.x, b.y);
            g.quadraticCurveTo(b.x + 2, b.y - 2, b.x + 5, b.y - f);
            g.stroke();
          }
          // Cloud shadows drifting over the town.
          for (let q = 0; q < 2; q += 1) {
            const x = ((clock * tw * 0.25 + q * W * 0.6) % (W + tw * 8)) - tw * 4;
            const y = H * (0.35 + q * 0.3);
            const cs = g.createRadialGradient(x, y, 0, x, y, tw * 3.2);
            cs.addColorStop(0, 'rgba(20,30,60,0.14)');
            cs.addColorStop(1, 'rgba(20,30,60,0)');
            g.fillStyle = cs;
            g.fillRect(x - tw * 3.2, y - tw * 3.2, tw * 6.4, tw * 6.4);
          }
        }
        // Its name, in a little tag above the building.
        if (focus >= 0 && focusFade > 0) {
          const bd = blds[focus];
          const [lv, ru] = bd.label ?? ['', ''];
          const base = iso(bd.i + 0.5, bd.j + 0.5);
          const x = base.x;
          const big = Math.round(clamp(tw * 0.3, 11, 22));
          const y = Math.max(big * 2.25 + 3, base.y - bd.h - bd.roofH - hh - tw * 0.2);
          g.font = `700 ${big}px "Segoe UI", system-ui, sans-serif`;
          const w1 = g.measureText(lv).width;
          g.font = `${Math.round(big * 0.75)}px "Segoe UI", system-ui, sans-serif`;
          const w2 = g.measureText(ru).width;
          const bw = Math.max(w1, w2) + big;
          const bh = big * 2.25;
          const bx = clamp(x - bw / 2, 2, W - bw - 2);
          g.globalAlpha = focusFade;
          g.fillStyle = evening ? 'rgba(20,22,40,0.88)' : 'rgba(255,255,255,0.92)';
          g.beginPath();
          g.roundRect(bx, y - bh, bw, bh, big * 0.4);
          g.fill();
          g.beginPath();
          g.moveTo(x - 5, y);
          g.lineTo(x + 5, y);
          g.lineTo(x, y + 6);
          g.fill();
          g.textAlign = 'center';
          g.textBaseline = 'top';
          g.fillStyle = evening ? '#ffe2a0' : '#1a2a4a';
          g.font = `700 ${big}px "Segoe UI", system-ui, sans-serif`;
          g.fillText(lv, bx + bw / 2, y - bh + big * 0.22);
          g.fillStyle = evening ? 'rgba(220,225,240,0.85)' : 'rgba(40,50,70,0.75)';
          g.font = `${Math.round(big * 0.75)}px "Segoe UI", system-ui, sans-serif`;
          g.fillText(ru, bx + bw / 2, y - bh + big * 1.3);
          g.globalAlpha = 1;
        }
        // The left part of the card stays calm for its title.
        if (!c.body) {
          const fade = g.createLinearGradient(0, 0, W * 0.34, 0);
          fade.addColorStop(0, rgba(skyTop, 0.75));
          fade.addColorStop(1, rgba(skyTop, 0));
          g.fillStyle = fade;
          g.fillRect(0, 0, W * 0.34, H);
        }
      },
    };
  },
};
