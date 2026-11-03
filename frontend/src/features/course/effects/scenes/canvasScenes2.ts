import type { CanvasSceneDef } from './types';
import { FONT_SERIF, TAU, clamp, fillGradient, glow, mixHex, rgba, smooth } from './kit';

export const CANVAS_SCENES_2: CanvasSceneDef[] = [
  {
    kind: 'canvas',
    id: 'chalkboard',
    label: 'Меловая доска',
    palettes: [['#1f3a2e', '#f4f1e6', '#ffe27a', '#9ad0ff'], ['#1a2436', '#f4f1e6', '#ffb0c8', '#9affc8']],
    create(c) {
      const W = c.width;
      const H = c.height;
      const layer = document.createElement('canvas');
      layer.width = Math.round(W);
      layer.height = Math.round(H);
      const lg = layer.getContext('2d')!;
      lg.lineCap = 'round';
      lg.lineJoin = 'round';
      const items = [
        { t: 'a² + b² = c²', x: 0.07, y: 0.3, s: 30, col: 1 },
        { t: 'E = mc²', x: 0.42, y: 0.22, s: 34, col: 2 },
        { t: 'A B C', x: 0.62, y: 0.4, s: 40, col: 3 },
        { t: '2 + 2 = 4', x: 0.12, y: 0.68, s: 28, col: 1 },
        { t: 'Lv ↔ Ru ↔ Uk', x: 0.4, y: 0.72, s: 26, col: 3 },
        { t: 'π ≈ 3,14', x: 0.75, y: 0.7, s: 28, col: 2 },
        { t: '✓ done', x: 0.83, y: 0.25, s: 24, col: 2 },
      ];
      let clock = 0;
      let last: { x: number; y: number } | null = null;
      const dust: Array<{ x: number; y: number; vx: number; vy: number; life: number }> = [];
      const stroke = (x0: number, y0: number, x1: number, y1: number, color: string, w: number) => {
        lg.strokeStyle = rgba(color, 0.85);
        lg.lineWidth = w;
        lg.beginPath();
        lg.moveTo(x0 + (c.rand() - 0.5) * 0.6, y0 + (c.rand() - 0.5) * 0.6);
        lg.lineTo(x1 + (c.rand() - 0.5) * 0.6, y1 + (c.rand() - 0.5) * 0.6);
        lg.stroke();
        lg.strokeStyle = rgba(color, 0.3);
        lg.lineWidth = w * 0.5;
        lg.beginPath();
        lg.moveTo(x0 + 0.8, y0 + 0.5);
        lg.lineTo(x1 + 0.8, y1 + 0.5);
        lg.stroke();
      };
      // The doodles are written a piece at a time.
      let written = 0;
      return {
        update(dt, t, p) {
          clock += dt;
          if (clock > 0.35 && written < items.length) {
            clock = 0;
            const it = items[written];
            lg.font = `italic 600 ${it.s}px ${FONT_SERIF}`;
            lg.fillStyle = rgba(c.palette[it.col], 0.88);
            lg.fillText(it.t, it.x * W, it.y * H);
            lg.fillStyle = rgba(c.palette[it.col], 0.25);
            lg.fillText(it.t, it.x * W + 0.8, it.y * H + 0.6);
            written += 1;
          }
          if (written >= items.length && clock > 12) {
            // Wipe the board and start again.
            lg.clearRect(0, 0, W, H);
            written = 0;
            clock = 0;
          }
          if (p.active && p.pressed !== undefined) {
            const moved = last ? Math.hypot(p.x - last.x, p.y - last.y) : 0;
            if (last && moved > 1) {
              stroke(last.x, last.y, p.x, p.y, c.palette[1], 2.4);
              if (c.rand() < 0.5) dust.push({ x: p.x, y: p.y, vx: (c.rand() - 0.5) * 30, vy: c.rand() * 40, life: 1 });
            }
            last = { x: p.x, y: p.y };
          } else last = null;
          for (let i = dust.length - 1; i >= 0; i -= 1) {
            const d = dust[i];
            d.x += d.vx * dt;
            d.y += d.vy * dt;
            d.life -= dt * 1.2;
            if (d.life <= 0) dust.splice(i, 1);
          }
          void t;
        },
        draw(g) {
          fillGradient(g, W, H, mixHex(c.palette[0], '#ffffff', 0.05), mixHex(c.palette[0], '#000000', 0.25));
          for (let i = 0; i < 6; i += 1) glow(g, ((i * 0.37 + 0.1) % 1) * W, ((i * 0.53 + 0.2) % 1) * H, H * 0.6, '#ffffff', 0.03);
          g.drawImage(layer, 0, 0);
          for (const d of dust) {
            g.fillStyle = rgba('#ffffff', d.life * 0.6);
            g.fillRect(d.x, d.y, 1.6, 1.6);
          }
          g.fillStyle = rgba('#000000', 0.25);
          g.fillRect(0, H - 9, W, 9);
          g.fillStyle = rgba(c.palette[1], 0.85);
          g.fillRect(W * 0.08, H - 8, 26, 5);
          g.fillStyle = rgba(c.palette[2], 0.85);
          g.fillRect(W * 0.08 + 34, H - 8, 20, 5);
        },
      };
    },
  },
];

/** The first, flat fireworks: now only the fallback of the GPU show (fireworks3d.ts) when WebGL2 is missing. */
export const FIREWORKS_2D: CanvasSceneDef = {
  kind: 'canvas',
  id: 'fireworks',
  label: 'Фейерверк',
  palettes: [['#070a1c', '#ff5a7a', '#ffd45a', '#5ad8ff'], ['#0a0618', '#c85aff', '#5affc8', '#ffe27a']],
  create(c) {
    type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; hue: number; trail: number[] };
    type Rocket = { x: number; y: number; vx: number; vy: number; ty: number; hue: number; trail: number[] };
    const rockets: Rocket[] = [];
    const sparks: Spark[] = [];
    let timer = 0.4;
    const stars = Array.from({ length: Math.round((c.width * c.height) / 5000) }, () => ({ x: c.rand() * c.width, y: c.rand() * c.height * 0.8, a: 0.2 + c.rand() * 0.6 }));
    const launch = (x: number, ty: number) => {
      rockets.push({ x, y: c.height + 4, vx: (c.rand() - 0.5) * 30, vy: -(c.height * 1.6 + c.rand() * 60), ty, hue: 1 + Math.floor(c.rand() * 3), trail: [] });
    };
    const burst = (x: number, y: number, hue: number) => {
      const kind = Math.floor(c.rand() * 3);
      const n = Math.round((60 + c.rand() * 60) * clamp(c.height / 220, 0.7, 1.6) * c.params.intensity);
      for (let i = 0; i < n; i += 1) {
        const a = kind === 1 ? (i / n) * TAU : c.rand() * TAU;
        const s = kind === 1 ? 110 + c.rand() * 12 : 40 + c.rand() * 130;
        sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 1.1 + c.rand() * 0.9 + (kind === 2 ? 0.8 : 0), hue: c.rand() < 0.2 ? 3 : hue, trail: [] });
      }
    };
    return {
      update(dt, t, p) {
        timer -= dt;
        if (timer <= 0) {
          timer = (c.body ? 1.1 : 0.9) / c.params.intensity + c.rand() * 0.9;
          launch(c.width * (0.1 + c.rand() * 0.8), c.height * (0.12 + c.rand() * 0.35));
        }
        if (p.clicked) launch(p.x, p.y);
        for (let i = rockets.length - 1; i >= 0; i -= 1) {
          const r = rockets[i];
          r.trail.unshift(r.x, r.y);
          r.trail.length = Math.min(r.trail.length, 12);
          r.x += r.vx * dt;
          r.y += r.vy * dt;
          r.vy += 260 * dt * 0.4;
          if (r.y <= r.ty || r.vy > -30) {
            burst(r.x, r.y, r.hue);
            rockets.splice(i, 1);
          }
        }
        for (let i = sparks.length - 1; i >= 0; i -= 1) {
          const s = sparks[i];
          s.trail.unshift(s.x, s.y);
          s.trail.length = Math.min(s.trail.length, 10);
          s.life += dt;
          s.vx *= 1 - dt * 1.2;
          s.vy = s.vy * (1 - dt * 1.2) + 70 * dt;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          if (s.life > s.max) sparks.splice(i, 1);
        }
        void t;
      },
      draw(g) {
        fillGradient(g, c.width, c.height, c.palette[0], mixHex(c.palette[0], '#3a1a4a', 0.5));
        for (const s of stars) {
          g.fillStyle = rgba('#ffffff', s.a);
          g.fillRect(s.x, s.y, 1.2, 1.2);
        }
        g.globalCompositeOperation = 'lighter';
        for (const r of rockets) {
          g.strokeStyle = rgba(c.palette[2], 0.7);
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(r.x, r.y);
          for (let i = 0; i < r.trail.length; i += 2) g.lineTo(r.trail[i], r.trail[i + 1]);
          g.stroke();
          glow(g, r.x, r.y, 10, '#ffffff', 0.9);
        }
        for (const s of sparks) {
          const a = 1 - s.life / s.max;
          g.strokeStyle = rgba(c.palette[s.hue], a * 0.8);
          g.lineWidth = 1.6;
          g.beginPath();
          g.moveTo(s.x, s.y);
          for (let i = 0; i < s.trail.length; i += 2) g.lineTo(s.trail[i], s.trail[i + 1]);
          g.stroke();
          if (a > 0.5) glow(g, s.x, s.y, 5 + 4 * a, c.palette[s.hue], a * 0.8);
        }
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = '#04060f';
        let x = 0;
        let seed = 7;
        while (x < c.width) {
          seed = (seed * 9301 + 49297) % 233280;
          const w = 14 + (seed % 26);
          const h = c.height * (0.05 + ((seed >> 3) % 100) / 100 * 0.11);
          g.fillRect(x, c.height - h, w, h);
          x += w + 1;
        }
        void smooth;
      },
    };
  },
};
