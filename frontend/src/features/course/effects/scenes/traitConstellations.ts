import type { CanvasSceneDef } from './types';
import { TAU, clamp, mixHex, rgba } from './kit';

/**
 * "What we are like": a summer night sky over a hill where two friends sit watching it. The Milky Way crosses the
 * picture — thousands of faint stars thickening towards its axis, glowing star clouds and dark dust lanes — and among
 * the bright stars, which twinkle in their own colours (blue-white hot to orange cool) with diffraction spikes on the
 * brightest, hide constellations of character traits: a heart (sirsnīgs), a lamp (gudrs), a smile (jautrs), a shield
 * (drosmīgs), two friends holding hands (draudzīgs), a star (radošs) and a crescent moon (mierīgs). One after another
 * they are drawn in, line by line, with the Latvian word and its Russian meaning; the cursor reveals the one it is
 * near. Shooting stars cross now and then — a click sends one from the cursor.
 */

type Shape = { lv: string; ru: string; pts: [number, number][]; edges: [number, number][] };

const loop = (n: number, from = 0): [number, number][] => Array.from({ length: n }, (_, i) => [from + i, from + ((i + 1) % n)]);

const starPts = (): [number, number][] =>
  Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 0.4 : 0.95;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });

const SHAPES: Shape[] = [
  {
    lv: 'sirsnīgs',
    ru: 'сердечный',
    pts: [[0, 0.9], [-0.55, 0.35], [-0.9, -0.2], [-0.72, -0.7], [-0.3, -0.8], [0, -0.45], [0.3, -0.8], [0.72, -0.7], [0.9, -0.2], [0.55, 0.35]],
    edges: loop(10),
  },
  {
    lv: 'gudrs',
    ru: 'умный',
    pts: [[0, -0.95], [-0.55, -0.72], [-0.68, -0.15], [-0.36, 0.3], [-0.3, 0.6], [0.3, 0.6], [0.36, 0.3], [0.68, -0.15], [0.55, -0.72], [-0.24, 0.88], [0.24, 0.88], [0, -0.2]],
    edges: [...loop(9), [4, 9], [9, 10], [10, 5]],
  },
  {
    lv: 'jautrs',
    ru: 'весёлый',
    pts: [
      ...Array.from({ length: 9 }, (_, i): [number, number] => [Math.cos((i / 9) * TAU) * 0.92, Math.sin((i / 9) * TAU) * 0.92]),
      [-0.34, -0.3], [0.34, -0.3],
      [-0.55, 0.12], [-0.3, 0.42], [0, 0.52], [0.3, 0.42], [0.55, 0.12],
    ],
    edges: [...loop(9), [11, 12], [12, 13], [13, 14], [14, 15]],
  },
  {
    lv: 'drosmīgs',
    ru: 'смелый',
    pts: [[-0.75, -0.8], [0, -0.95], [0.75, -0.8], [0.7, 0.1], [0.36, 0.6], [0, 0.92], [-0.36, 0.6], [-0.7, 0.1], [-0.4, -0.25], [0, 0.12], [0.4, -0.25]],
    edges: [...loop(8), [8, 9], [9, 10]],
  },
  {
    lv: 'draudzīgs',
    ru: 'дружелюбный',
    pts: [
      [-0.55, -0.72], [-0.55, -0.38], [-0.55, 0.25], [-0.82, 0.92], [-0.32, 0.92], [-0.95, -0.02], [0, -0.06],
      [0.55, -0.72], [0.55, -0.38], [0.55, 0.25], [0.32, 0.92], [0.82, 0.92], [0.95, -0.02],
    ],
    edges: [[0, 1], [1, 2], [2, 3], [2, 4], [1, 5], [1, 6], [7, 8], [8, 9], [9, 10], [9, 11], [8, 12], [8, 6]],
  },
  { lv: 'radošs', ru: 'творческий', pts: starPts(), edges: loop(10) },
  {
    lv: 'mierīgs',
    ru: 'спокойный',
    pts: [
      ...Array.from({ length: 7 }, (_, i): [number, number] => {
        const a = Math.PI * (0.28 + (i / 6) * 1.44);
        return [Math.cos(a) * 0.92, Math.sin(a) * 0.92];
      }),
      ...Array.from({ length: 5 }, (_, i): [number, number] => {
        const a = Math.PI * (1.58 - (i / 4) * 1.16);
        return [0.35 + Math.cos(a) * 0.7, Math.sin(a) * 0.7];
      }),
    ],
    edges: [...Array.from({ length: 6 }, (_, i): [number, number] => [i, i + 1]), [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 0]],
  },
];

/** Colours of stars by temperature, hot to cool. */
const STAR_COLS = ['#bcd2ff', '#dfe8ff', '#ffffff', '#fff4dc', '#ffe0b0', '#ffc690'];

type Bright = { x: number; y: number; m: number; col: string; ph: number; f: number };
type Slot = { x: number; y: number; r: number; shape: number; reveal: number; want: number; since: number };
type Meteor = { x: number; y: number; vx: number; vy: number; life: number };

export const TRAIT_CONSTELLATIONS: CanvasSceneDef = {
  kind: 'canvas',
  id: 'constellation',
  label: 'Созвездия характера',
  palettes: [
    ['#050814', '#0e1636', '#ffe6a8', '#9fc4ff'],
    ['#07040f', '#1c1030', '#ffd0e8', '#b8a8ff'],
  ],
  create(c) {
    const W = c.width;
    const H = c.height;
    const S = c.dpr;
    const rand = c.rand;
    const [skyLow, skyHigh, labelCol, lineCol] = c.palette;
    const unit = c.body ? clamp(Math.min(W, H) / 400, 0.9, 2.5) : clamp(H / 150, 0.8, 2.5);

    // The sky, painted once: gradient, the Milky Way (stars, star clouds, dust), faint stars, the hill.
    const sky = document.createElement('canvas');
    sky.width = Math.ceil(W * S);
    sky.height = Math.ceil(H * S);
    const hillY = (x: number) => H * (c.body ? 0.93 : 0.9) - Math.sin((x / W) * Math.PI * 1.1 + 0.3) * H * (c.body ? 0.03 : 0.08);
    {
      const g = sky.getContext('2d')!;
      g.scale(S, S);
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, skyLow);
      gr.addColorStop(0.7, skyHigh);
      gr.addColorStop(1, mixHex(skyHigh, '#2a3a60', 0.35));
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
      const ax = { x0: W * 0.12, y0: H * 1.15, x1: W * 0.98, y1: -H * 0.15 };
      const len = Math.hypot(ax.x1 - ax.x0, ax.y1 - ax.y0);
      const nx = -(ax.y1 - ax.y0) / len;
      const ny = (ax.x1 - ax.x0) / len;
      const bw = c.body ? Math.min(W, H) * 0.2 : H * 0.28;
      const gauss = () => (rand() + rand() + rand() + rand() - 2) * 0.9;
      const along = (t: number, off: number) => ({ x: ax.x0 + (ax.x1 - ax.x0) * t + nx * off, y: ax.y0 + (ax.y1 - ax.y0) * t + ny * off });
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 90; i += 1) {
        const p = along(rand(), gauss() * bw * 0.5);
        const r = bw * (0.3 + rand() * 0.7);
        const col = ['#8fa8ff', '#ffe2c0', '#ffc8dc', '#c8d8ff'][i % 4];
        const b = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        b.addColorStop(0, rgba(col, 0.05 + rand() * 0.04));
        b.addColorStop(1, rgba(col, 0));
        g.fillStyle = b;
        g.fillRect(p.x - r, p.y - r, 2 * r, 2 * r);
      }
      const count = Math.round((W * H) / (c.body ? 90 : 22));
      for (let i = 0; i < count; i += 1) {
        const inBand = rand() < 0.7;
        const p = inBand ? along(rand(), gauss() * bw * 0.55) : { x: rand() * W, y: rand() * H };
        const a = rand() ** 2 * (inBand ? 0.55 : 0.45);
        g.fillStyle = rgba(STAR_COLS[Math.floor(rand() * STAR_COLS.length)], a);
        const s = rand() < 0.93 ? 0.7 : 1.3;
        g.fillRect(p.x, p.y, s, s);
      }
      g.globalCompositeOperation = 'source-over';
      const ang = Math.atan2(ax.y1 - ax.y0, ax.x1 - ax.x0);
      for (let i = 0; i < 46; i += 1) {
        const p = along(rand(), gauss() * bw * 0.18);
        g.save();
        g.translate(p.x, p.y);
        g.rotate(ang + (rand() - 0.5) * 0.5);
        const rx = bw * (0.15 + rand() * 0.4);
        const d = g.createRadialGradient(0, 0, 0, 0, 0, rx);
        d.addColorStop(0, 'rgba(2,2,8,0.32)');
        d.addColorStop(1, 'rgba(2,2,8,0)');
        g.fillStyle = d;
        g.scale(1, 0.28);
        g.beginPath();
        g.arc(0, 0, rx, 0, TAU);
        g.fill();
        g.restore();
      }
      // The hill, a lone pine and two friends sitting on it, looking up.
      const hill = '#03050a';
      g.fillStyle = hill;
      g.beginPath();
      g.moveTo(0, H);
      for (let x = 0; x <= W; x += 6) g.lineTo(x, hillY(x));
      g.lineTo(W, H);
      g.fill();
      const fx = W * (c.body ? 0.82 : 0.9);
      const fs = (c.body ? 16 : 11) * unit;
      const base = hillY(fx);
      for (const [dx, lean] of [[-0.7, 0.15], [0.7, -0.1]] as const) {
        const x = fx + dx * fs;
        g.beginPath();
        g.arc(x + lean * fs, base - fs * 1.55, fs * 0.28, 0, TAU);
        g.fill();
        g.beginPath();
        g.moveTo(x - fs * 0.35, base);
        g.quadraticCurveTo(x - fs * 0.4 + lean * fs, base - fs * 1.3, x + lean * fs, base - fs * 1.28);
        g.quadraticCurveTo(x + fs * 0.4 + lean * fs, base - fs * 1.1, x + fs * 0.7, base);
        g.fill();
      }
      const tx = W * (c.body ? 0.93 : 0.97);
      const tb = hillY(tx);
      for (let k = 0; k < 7; k += 1) {
        const w = fs * (1.6 - k * 0.18);
        const y = tb - fs * (0.6 + k * 0.55);
        g.beginPath();
        g.moveTo(tx - w, y + fs * 0.5);
        g.lineTo(tx, y - fs * 0.45);
        g.lineTo(tx + w, y + fs * 0.5);
        g.fill();
      }
      g.fillRect(tx - fs * 0.1, tb - fs * 0.8, fs * 0.2, fs * 0.8);
    }

    const brights: Bright[] = Array.from({ length: Math.round((c.body ? 90 : 46) * clamp(c.params.intensity, 0.4, 2)) }, () => ({
      x: rand() * W,
      y: rand() * (c.body ? H * 0.88 : H * 0.84),
      m: rand() ** 2.5,
      col: STAR_COLS[Math.floor(rand() * STAR_COLS.length)],
      ph: rand() * TAU,
      f: 2 + rand() * 5,
    }));

    const slots: Slot[] = [];
    if (c.body) {
      const r = Math.min(W, H) * 0.11;
      for (let row = 0; row < 2; row += 1) for (let col = 0; col < 3; col += 1) slots.push({ x: W * (0.2 + col * 0.3 + (row ? 0.08 : 0)), y: H * (0.25 + row * 0.38), r, shape: 0, reveal: 0, want: 0, since: 0 });
    } else {
      const r = Math.min(H * 0.28, W * 0.07);
      for (let i = 0; i < 4; i += 1) slots.push({ x: W * (0.4 + i * 0.165), y: H * (i % 2 ? 0.46 : 0.38), r, shape: 0, reveal: 0, want: 0, since: 0 });
    }
    const deck = SHAPES.map((_, i) => i).sort(() => rand() - 0.5);
    slots.forEach((s, i) => (s.shape = deck[i % deck.length]));
    let deckAt = slots.length % deck.length;
    let turn = 0;
    let turnClock = 0;
    let clock = 0;
    const meteors: Meteor[] = [];
    let nextMeteor = 3 + rand() * 5;

    const place = (s: Slot, i: number): [number, number][] => {
      const sh = SHAPES[s.shape];
      return sh.pts.map(([px, py], k) => {
        const j = (Math.sin(k * 12.9898 + i * 78.233 + s.shape * 3.1) * 43758.5453) % 1;
        return [s.x + px * s.r + j * s.r * 0.06, s.y + py * s.r - j * s.r * 0.05];
      });
    };
    const launch = (x: number, y: number) => {
      const a = Math.PI * (0.12 + rand() * 0.16) * (rand() < 0.5 ? 1 : -1) + (rand() < 0.5 ? 0 : Math.PI);
      const sp = (380 + rand() * 260) * unit;
      meteors.push({ x, y, vx: Math.cos(a) * sp, vy: Math.abs(Math.sin(a)) * sp, life: 1 });
    };

    return {
      update(dt, _t, p) {
        const sdt = Math.min(dt, 0.05) * clamp(c.params.speed, 0.2, 3);
        clock += sdt;
        turnClock += sdt;
        // One constellation at a time is drawn in, held, and let go; the next slot follows.
        if (turnClock > 6.5) {
          turnClock = 0;
          const done = slots[turn];
          // It swaps to a trait not on the sky yet, once it has faded out.
          done.since = clock;
          turn = (turn + 1) % slots.length;
        }
        slots.forEach((s, i) => {
          let want = i === turn && turnClock < 5 ? 1 : 0;
          if (p.active && c.params.react > 0 && Math.hypot(p.x - s.x, p.y - s.y) < s.r * 1.25) want = 1;
          s.want = want;
          const rate = want ? 0.45 : 1.2;
          s.reveal = clamp(s.reveal + (want ? rate : -rate) * sdt, 0, 1);
          if (!want && s.reveal === 0 && s.since > 0 && clock - s.since > 1) {
            s.since = 0;
            const on = new Set(slots.map((q) => q.shape));
            for (let k = 0; k < deck.length; k += 1) {
              const cand = deck[(deckAt + k) % deck.length];
              if (!on.has(cand)) {
                s.shape = cand;
                deckAt = (deckAt + k + 1) % deck.length;
                break;
              }
            }
          }
        });
        if ((nextMeteor -= sdt) <= 0) {
          launch(W * (0.3 + rand() * 0.7), rand() * H * 0.3);
          nextMeteor = 5 + rand() * 8;
        }
        if (p.active && p.clicked && c.params.react > 0) launch(p.rawX, p.rawY);
        for (let i = meteors.length - 1; i >= 0; i -= 1) {
          const m = meteors[i];
          m.x += m.vx * sdt;
          m.y += m.vy * sdt;
          m.life -= sdt * 1.1;
          if (m.life <= 0) meteors.splice(i, 1);
        }
      },
      draw(g) {
        g.drawImage(sky, 0, 0, W, H);
        g.globalCompositeOperation = 'lighter';
        const star = (x: number, y: number, r: number, col: string, a: number, spikes: number) => {
          const halo = g.createRadialGradient(x, y, 0, x, y, r * 4);
          halo.addColorStop(0, rgba('#ffffff', a));
          halo.addColorStop(0.18, rgba(col, a * 0.6));
          halo.addColorStop(1, rgba(col, 0));
          g.fillStyle = halo;
          g.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
          if (spikes > 0) {
            g.strokeStyle = rgba(col, a * 0.45 * spikes);
            g.lineWidth = Math.max(0.6, r * 0.3);
            g.beginPath();
            g.moveTo(x - r * 7, y);
            g.lineTo(x + r * 7, y);
            g.moveTo(x, y - r * 7);
            g.lineTo(x, y + r * 7);
            g.stroke();
          }
        };
        for (const b of brights) {
          const tw = 0.72 + 0.28 * Math.sin(clock * b.f + b.ph) * Math.sin(clock * b.f * 0.37 + b.ph * 2);
          const r = (0.6 + b.m * 1.6) * unit;
          star(b.x, b.y, r, b.col, (0.35 + b.m * 0.6) * tw, b.m > 0.55 ? 1 : 0);
        }
        // The constellations: their stars always shine a little brighter than the rest; lines and names come in.
        g.lineCap = 'round';
        slots.forEach((s, i) => {
          const pts = place(s, i);
          const sh = SHAPES[s.shape];
          const e = s.reveal * s.reveal * (3 - 2 * s.reveal);
          pts.forEach(([x, y], k) => {
            const tw = 0.8 + 0.2 * Math.sin(clock * 3 + k * 1.7 + i);
            star(x, y, (1.0 + e * 0.5) * unit, k % 3 ? '#fff6e0' : '#cfe0ff', (0.45 + e * 0.5) * tw, e > 0.5 ? (e - 0.5) * 1.2 : 0);
          });
          if (e <= 0.01) return;
          const shown = e * sh.edges.length;
          g.strokeStyle = rgba(lineCol, 0.55);
          g.shadowColor = lineCol;
          g.shadowBlur = 6 * unit;
          g.lineWidth = 1.1 * unit;
          g.beginPath();
          sh.edges.forEach(([a, b], k) => {
            const f = clamp(shown - k, 0, 1);
            if (f <= 0) return;
            const [x0, y0] = pts[a];
            const [x1, y1] = pts[b];
            g.moveTo(x0, y0);
            g.lineTo(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f);
          });
          g.stroke();
          g.shadowBlur = 0;
          g.globalCompositeOperation = 'source-over';
          const la = clamp((e - 0.35) / 0.5, 0, 1);
          const big = Math.round(clamp(s.r * 0.3, 11, 34));
          g.textAlign = 'center';
          g.textBaseline = 'top';
          g.font = `italic 600 ${big}px Georgia, "Times New Roman", serif`;
          g.fillStyle = rgba(labelCol, 0.95 * la);
          g.shadowColor = 'rgba(0,0,0,0.8)';
          g.shadowBlur = 6;
          const ly = s.y + s.r * 1.05;
          g.fillText(sh.lv, s.x, ly);
          g.font = `${Math.round(big * 0.62)}px "Segoe UI", system-ui, sans-serif`;
          g.fillStyle = rgba('#c8d0e8', 0.8 * la);
          g.fillText(sh.ru, s.x, ly + big * 1.05);
          g.shadowBlur = 0;
          g.globalCompositeOperation = 'lighter';
        });
        for (const m of meteors) {
          const sp = Math.hypot(m.vx, m.vy);
          const tail = 90 * unit * Math.min(1, (1 - m.life) * 4 + 0.2);
          const tx = m.x - (m.vx / sp) * tail;
          const ty = m.y - (m.vy / sp) * tail;
          const gr = g.createLinearGradient(m.x, m.y, tx, ty);
          gr.addColorStop(0, rgba('#ffffff', 0.9 * m.life));
          gr.addColorStop(1, rgba('#9fc4ff', 0));
          g.strokeStyle = gr;
          g.lineWidth = 1.6 * unit;
          g.beginPath();
          g.moveTo(m.x, m.y);
          g.lineTo(tx, ty);
          g.stroke();
        }
        g.globalCompositeOperation = 'source-over';
      },
    };
  },
};
