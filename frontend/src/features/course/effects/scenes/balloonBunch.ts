import type { CanvasSceneDef } from './types';
import { TAU, clamp, lerp, mixHex, rgba } from './kit';

/**
 * "Free time": a bunch of glossy latex balloons in a park sky, their ribbons tied together just below the card's
 * right edge. Each balloon is a teardrop painted once per colour — the light-side sheen, latex glowing where the sun
 * shines through it, the darker, more saturated silhouette of the rubber seen edge-on, a window-shaped highlight and a
 * tied knot — and floats on its own ribbon (a verlet rope that sags when slack and pulls taut against the lift). The
 * breeze sways the bunch, the balloons bump into each other, the cursor pushes them aside, and a click pops one:
 * shreds of rubber, a burst of confetti from inside, the ribbon falls, and a new balloon is blown up in its place.
 * A click on the sky sends a gust. Left alone, now and then a balloon slips its ribbon and drifts up and away.
 */

const LATEX = ['#ff3d5a', '#ffae2b', '#23c49a', '#3b8bff', '#a66bff', '#ff6fbf', '#ffd23a', '#36cdf5', '#ff7a3d'];
const CONFETTI = ['#ff3d5a', '#ffd23a', '#23c49a', '#3b8bff', '#ff6fbf', '#ffffff', '#f5c451', '#a66bff'];
const SEGS = 10;

type Pt = { x: number; y: number; px: number; py: number };
type Balloon = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  len: number;
  col: number;
  ang: number;
  av: number;
  grow: number;
  state: 'tied' | 'free' | 'popped' | 'gone';
  back: number;
  rope: Pt[];
  wob: number;
};
type Shred = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; life: number; col: string; pts: number[] };
type Confetti = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; spin: number; vs: number; w: number; h: number; col: string; life: number; ph: number };
type Ring = { x: number; y: number; r: number; col: string; age: number };
type Far = { x: number; y: number; s: number; col: number; ph: number; vy: number };

/** The balloon's outline in its own frame: centre at 0,0, r across; the neck ends at y = 1.1r. */
function outline(g: CanvasRenderingContext2D, r: number) {
  g.beginPath();
  g.moveTo(0, -1.12 * r);
  g.bezierCurveTo(0.62 * r, -1.12 * r, 1.02 * r, -0.62 * r, 1.0 * r, -0.05 * r);
  g.bezierCurveTo(0.98 * r, 0.5 * r, 0.5 * r, 0.95 * r, 0.08 * r, 1.1 * r);
  g.lineTo(-0.08 * r, 1.1 * r);
  g.bezierCurveTo(-0.5 * r, 0.95 * r, -0.98 * r, 0.5 * r, -1.0 * r, -0.05 * r);
  g.bezierCurveTo(-1.02 * r, -0.62 * r, -0.62 * r, -1.12 * r, 0, -1.12 * r);
  g.closePath();
}

function canvasOf(w: number, h: number, S: number) {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.ceil(w * S));
  cv.height = Math.max(1, Math.ceil(h * S));
  const g = cv.getContext('2d')!;
  g.scale(S, S);
  return { cv, g };
}

/** One latex balloon of radius R, lit from the upper left; the sprite's origin is the balloon's centre at (1.2R, 1.2R). */
function paintBalloon(hex: string, R: number, S: number) {
  const { cv, g } = canvasOf(2.4 * R, 2.7 * R, S);
  g.translate(1.2 * R, 1.2 * R);
  const dark = mixHex(hex, '#000000', 0.42);
  const deep = mixHex(hex, '#12001c', 0.62);
  g.save();
  outline(g, R);
  g.clip();
  let gr = g.createRadialGradient(-0.38 * R, -0.46 * R, 0.02 * R, -0.12 * R, -0.1 * R, 1.5 * R);
  gr.addColorStop(0, mixHex(hex, '#ffffff', 0.5));
  gr.addColorStop(0.22, mixHex(hex, '#ffffff', 0.14));
  gr.addColorStop(0.55, hex);
  gr.addColorStop(0.85, dark);
  gr.addColorStop(1, deep);
  g.fillStyle = gr;
  g.fillRect(-1.3 * R, -1.3 * R, 2.6 * R, 2.6 * R);
  // Sunlight through the rubber glows on the far side, low down.
  gr = g.createRadialGradient(0.32 * R, 0.5 * R, 0, 0.32 * R, 0.5 * R, 0.8 * R);
  gr.addColorStop(0, rgba(mixHex(hex, '#fff6dc', 0.35), 0.55));
  gr.addColorStop(0.6, rgba(hex, 0.16));
  gr.addColorStop(1, rgba(hex, 0));
  g.fillStyle = gr;
  g.fillRect(-1.3 * R, -1.3 * R, 2.6 * R, 2.6 * R);
  // At the silhouette the latex is seen edge-on: darker and more saturated.
  for (const [w, a] of [[0.36, 0.12], [0.2, 0.16], [0.09, 0.24]]) {
    g.lineWidth = w * R;
    g.strokeStyle = rgba(deep, a);
    outline(g, R);
    g.stroke();
  }
  // The sky reflected along the upper-left rim.
  const rim = g.createLinearGradient(-R, -R, 0.2 * R, 0.2 * R);
  rim.addColorStop(0, 'rgba(255,255,255,0.5)');
  rim.addColorStop(1, 'rgba(255,255,255,0)');
  g.lineWidth = 0.08 * R;
  g.strokeStyle = rim;
  outline(g, R);
  g.stroke();
  // The highlight: a soft halo and the sharp reflection of a bright window.
  const hx = -0.42 * R;
  const hy = -0.52 * R;
  gr = g.createRadialGradient(hx, hy, 0, hx, hy, 0.55 * R);
  gr.addColorStop(0, 'rgba(255,255,255,0.45)');
  gr.addColorStop(0.4, 'rgba(255,255,255,0.12)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(-1.3 * R, -1.3 * R, 2.6 * R, 2.6 * R);
  g.save();
  g.translate(hx, hy);
  g.rotate(-0.55);
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.beginPath();
  g.ellipse(0, 0, 0.1 * R, 0.22 * R, 0, 0, TAU);
  g.fill();
  g.restore();
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.beginPath();
  g.ellipse(-0.17 * R, -0.82 * R, 0.05 * R, 0.03 * R, -0.3, 0, TAU);
  g.fill();
  gr = g.createRadialGradient(0.52 * R, 0.5 * R, 0, 0.52 * R, 0.5 * R, 0.24 * R);
  gr.addColorStop(0, 'rgba(255,255,255,0.2)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0.2 * R, 0.2 * R, 0.7 * R, 0.7 * R);
  g.restore();
  // The knot.
  g.fillStyle = dark;
  g.beginPath();
  g.moveTo(-0.07 * R, 1.08 * R);
  g.quadraticCurveTo(-0.17 * R, 1.24 * R, -0.1 * R, 1.27 * R);
  g.lineTo(0.1 * R, 1.27 * R);
  g.quadraticCurveTo(0.17 * R, 1.24 * R, 0.07 * R, 1.08 * R);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath();
  g.ellipse(-0.04 * R, 1.19 * R, 0.025 * R, 0.04 * R, 0, 0, TAU);
  g.fill();
  return cv;
}

function paintCloud(w: number, h: number, S: number, rand: () => number, tint: string) {
  const { cv, g } = canvasOf(w, h, S);
  for (let i = 0; i < 11; i += 1) {
    const x = w * (0.14 + rand() * 0.72);
    const y = h * (0.42 + rand() * 0.22) - Math.sin(((x / w) * Math.PI)) * h * 0.14;
    const r = h * (0.2 + rand() * 0.2);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(tint, 0.55));
    gr.addColorStop(0.6, rgba(tint, 0.3));
    gr.addColorStop(1, rgba(tint, 0));
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  return cv;
}

const inflate = (x: number) => {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
};

export const BALLOON_BUNCH: CanvasSceneDef = {
  kind: 'canvas',
  id: 'balloons',
  label: 'Воздушные шары',
  palettes: [
    ['#3f86d8', '#a4cdef', '#ffdcb6', '#fff2d0'],
    ['#1a1f4d', '#6a4a8c', '#ff9a7a', '#ffd0a0'],
  ],
  create(c) {
    const W = c.width;
    const H = c.height;
    const S = c.dpr;
    const rand = c.rand;
    const [skyTop, skyMid, skyLow, sun] = c.palette;
    const rBase = c.body ? clamp(Math.min(W, H) * 0.055, 22, 64) : clamp(H * 0.125, 13, 56);
    const k = rBase / 20;
    const anchor = { x: W * (c.body ? 0.84 : 0.8), y: H + rBase * 0.6 };
    const leftWall = W * (c.body ? 0.58 : 0.46);
    const count = c.body ? 11 : 9;
    const spriteR = rBase * 1.18;
    const sprites = LATEX.map((hex) => paintBalloon(hex, spriteR, S));

    // The sky, the sun's glow and a hazy line of park trees, painted once.
    const sky = canvasOf(W, H, S);
    {
      const g = sky.g;
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, skyTop);
      gr.addColorStop(0.55, skyMid);
      gr.addColorStop(1, skyLow);
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
      const sx = W * (c.body ? 0.6 : 0.5);
      const sr = Math.max(W, H) * 0.45;
      const glow = g.createRadialGradient(sx, 0, 0, sx, 0, sr);
      glow.addColorStop(0, rgba(sun, 0.7));
      glow.addColorStop(0.25, rgba(sun, 0.25));
      glow.addColorStop(1, rgba(sun, 0));
      g.fillStyle = glow;
      g.fillRect(0, 0, W, H);
      // Two rows of park trees: far ones lost in the haze, nearer ones greener, each crown a cluster of round leaf masses.
      const treeTop = H * (c.body ? 0.9 : 0.84);
      const rows: [number, string, number][] = [
        [treeTop - rBase * 0.35, mixHex(skyLow, '#5f8f7a', 0.35), 0.75],
        [treeTop + rBase * 0.1, mixHex(skyLow, '#3b6e4c', 0.62), 1],
      ];
      for (const [top, col, scale] of rows) {
        for (let x = -rBase; x < W + rBase; x += rBase * (0.9 + rand() * 0.9) * scale) {
          const r = rBase * (0.55 + rand() * 0.55) * scale;
          const cy = top + r * 0.7 + rand() * rBase * 0.25;
          for (let j = 0; j < 5; j += 1) {
            const px = x + (rand() - 0.5) * r * 1.1;
            const py = cy + (rand() - 0.6) * r * 0.8;
            const pr = r * (0.45 + rand() * 0.35);
            const lit = g.createRadialGradient(px - pr * 0.35, py - pr * 0.4, 0, px, py, pr);
            lit.addColorStop(0, mixHex(col, '#fff2c8', 0.22));
            lit.addColorStop(1, col);
            g.fillStyle = lit;
            g.beginPath();
            g.arc(px, py, pr, 0, TAU);
            g.fill();
          }
        }
        g.fillStyle = col;
        g.fillRect(0, top + rBase * 0.75 * scale, W, H);
      }
      const haze = g.createLinearGradient(0, treeTop - rBase, 0, H);
      haze.addColorStop(0, rgba(skyLow, 0));
      haze.addColorStop(1, rgba(skyLow, 0.35));
      g.fillStyle = haze;
      g.fillRect(0, treeTop - rBase, W, H);
    }
    const clouds = Array.from({ length: 3 }, (_, i) => {
      const cw = rBase * (7 + rand() * 5);
      const ch = cw * 0.32;
      return { cv: paintCloud(cw, ch, S, rand, '#ffffff'), w: cw, h: ch, x: rand() * (W + cw) - cw, y: H * (0.05 + i * 0.16 + rand() * 0.08), v: (3 + rand() * 5) * k };
    });

    const colours = LATEX.map((_, i) => i).sort(() => rand() - 0.5);
    const straightRope = (b: Balloon) => {
      const kx = b.x;
      const ky = b.y + 1.25 * b.r * inflate(b.grow);
      b.rope = Array.from({ length: SEGS + 1 }, (_, i) => {
        const x = lerp(anchor.x, kx, i / SEGS);
        const y = lerp(anchor.y, ky, i / SEGS);
        return { x, y, px: x, py: y };
      });
    };
    const heights = Array.from({ length: count }, (_, i) => i / (count - 1)).sort(() => rand() - 0.5);
    const [hiTop, hiLow] = c.body ? [0.42, 0.78] : [0.24, 0.62];
    const balloons: Balloon[] = heights.map((f, i) => {
      const r = rBase * (0.88 + rand() * 0.24);
      const len = anchor.y - H * lerp(hiTop, hiLow, f) - 1.16 * r;
      const b: Balloon = {
        x: anchor.x + (rand() - 0.5) * rBase * 4,
        y: anchor.y - len * 0.95,
        vx: 0,
        vy: 0,
        r,
        len,
        col: colours[i % colours.length],
        ang: 0,
        av: 0,
        grow: 1,
        state: 'tied',
        back: 0,
        rope: [],
        wob: rand() * TAU,
      };
      straightRope(b);
      return b;
    });
    const far: Far[] = Array.from({ length: c.body ? 7 : 5 }, () => ({
      x: W * (c.body ? rand() : 0.3 + rand() * 0.7),
      y: rand() * H,
      s: 0.3 + rand() * 0.22,
      col: Math.floor(rand() * LATEX.length),
      ph: rand() * TAU,
      vy: (10 + rand() * 12) * k,
    }));
    const shreds: Shred[] = [];
    const confetti: Confetti[] = [];
    const rings: Ring[] = [];
    let clock = 0;
    let wind = 0;
    let release = 7 + rand() * 5;

    const alive = (b: Balloon) => b.state === 'tied' || b.state === 'free';
    const knotOf = (b: Balloon) => {
      const s = inflate(b.grow);
      return { x: b.x - Math.sin(b.ang) * 1.25 * b.r * s, y: b.y + Math.cos(b.ang) * 1.25 * b.r * s };
    };
    const pop = (b: Balloon) => {
      const hex = LATEX[b.col];
      rings.push({ x: b.x, y: b.y, r: b.r, col: hex, age: 0 });
      const n = 7 + Math.floor(rand() * 4);
      for (let i = 0; i < n; i += 1) {
        const a = rand() * TAU;
        const d = b.r * (0.3 + rand() * 0.6);
        const sp = (160 + rand() * 300) * k;
        const m = 4 + Math.floor(rand() * 3);
        const size = b.r * (0.12 + rand() * 0.18);
        const pts: number[] = [];
        for (let j = 0; j < m; j += 1) {
          const q = (j / m) * TAU + rand() * 0.6;
          pts.push(Math.cos(q) * size * (0.5 + rand() * 0.7), Math.sin(q) * size * (0.4 + rand() * 0.5));
        }
        shreds.push({ x: b.x + Math.cos(a) * d, y: b.y + Math.sin(a) * d * 1.1, vx: Math.cos(a) * sp + b.vx, vy: Math.sin(a) * sp - 60 * k + b.vy, rot: rand() * TAU, vr: (rand() - 0.5) * 24, life: 1, col: mixHex(hex, '#000000', rand() * 0.35), pts });
      }
      const nc = Math.round(34 * clamp(c.params.intensity, 0.3, 2));
      for (let i = 0; i < nc; i += 1) {
        const a = rand() * TAU;
        const sp = (60 + rand() * 320) * k;
        const w = (2.4 + rand() * 2.6) * k;
        confetti.push({ x: b.x + Math.cos(a) * rand() * b.r * 0.6, y: b.y + Math.sin(a) * rand() * b.r * 0.6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 90 * k, rot: rand() * TAU, vr: (rand() - 0.5) * 8, spin: rand() * TAU, vs: 6 + rand() * 10, w, h: w * (1.4 + rand()), col: CONFETTI[Math.floor(rand() * CONFETTI.length)], life: 1, ph: rand() * TAU });
      }
      // The bang shoves the neighbours.
      for (const o of balloons) {
        if (o === b || !alive(o)) continue;
        const dx = o.x - b.x;
        const dy = o.y - b.y;
        const d = Math.hypot(dx, dy) || 1;
        const f = 1 - d / (b.r * 5);
        if (f <= 0) continue;
        o.vx += (dx / d) * f * 220 * k;
        o.vy += (dy / d) * f * 220 * k;
        o.av += (rand() - 0.5) * f * 6;
      }
      b.state = 'popped';
      b.back = clock + 1.4 + rand() * 1.6;
    };
    const respawn = (b: Balloon) => {
      const used = new Set(balloons.filter(alive).map((o) => o.col));
      const free = LATEX.map((_, i) => i).filter((i) => !used.has(i));
      b.col = free.length ? free[Math.floor(rand() * free.length)] : Math.floor(rand() * LATEX.length);
      b.r = rBase * (0.88 + rand() * 0.24);
      b.x = anchor.x + (rand() - 0.5) * rBase * 2;
      b.y = anchor.y - b.len * 0.45;
      b.vx = 0;
      b.vy = 0;
      b.ang = 0;
      b.av = (rand() - 0.5) * 2;
      b.grow = 0;
      b.state = 'tied';
      straightRope(b);
    };

    return {
      update(dt, _t, p) {
        const sdt = Math.min(dt, 0.033) * clamp(c.params.speed, 0.2, 3);
        clock += sdt;
        const react = clamp(c.params.react, 0, 3);
        wind = (Math.sin(clock * 0.31) * 0.55 + Math.sin(clock * 0.83 + 1.7) * 0.3 + Math.sin(clock * 0.137 + 4) * 0.45) * 22 * k;
        const buoy = 95 * k;

        if (p.active && p.clicked) {
          let hit: Balloon | null = null;
          for (let i = balloons.length - 1; i >= 0 && !hit; i -= 1) {
            const b = balloons[i];
            if (!alive(b)) continue;
            const s = inflate(b.grow) * b.r;
            const dx = p.rawX - b.x;
            const dy = p.rawY - b.y;
            const lx = dx * Math.cos(b.ang) + dy * Math.sin(b.ang);
            const ly = -dx * Math.sin(b.ang) + dy * Math.cos(b.ang);
            if ((lx / s) ** 2 + (ly / (1.12 * s)) ** 2 < 1.3) hit = b;
          }
          if (hit) pop(hit);
          else {
            rings.push({ x: p.rawX, y: p.rawY, r: rBase * 0.4, col: '#ffffff', age: 0 });
            for (const b of balloons) {
              if (!alive(b)) continue;
              const dx = b.x - p.rawX;
              const dy = b.y - p.rawY;
              const d = Math.hypot(dx, dy) || 1;
              const f = 1 - d / (rBase * 8);
              if (f <= 0) continue;
              b.vx += (dx / d) * f * 420 * k;
              b.vy += (dy / d) * f * 420 * k;
              b.av += (dx > 0 ? 1 : -1) * f * 3;
            }
          }
        }
        // Left alone, now and then one slips its ribbon.
        if (p.active) release = Math.max(release, 4);
        else if ((release -= sdt) <= 0) {
          const tied = balloons.filter((b) => b.state === 'tied' && b.grow >= 1);
          if (tied.length > count - 2) tied[Math.floor(rand() * tied.length)].state = 'free';
          release = 8 + rand() * 6;
        }

        for (const b of balloons) {
          if (!alive(b)) {
            if (clock >= b.back && (b.state === 'gone' || b.state === 'popped')) respawn(b);
            continue;
          }
          b.grow = Math.min(1, b.grow + sdt / 0.7);
          const s = inflate(b.grow);
          b.wob += sdt * 1.4;
          let ax = wind * (0.7 + 0.3 * Math.sin(b.wob));
          let ay = -buoy * (0.3 + 0.7 * b.grow);
          if (p.active) {
            const dx = b.x - p.x;
            const dy = b.y - p.y;
            const d = Math.hypot(dx, dy);
            const R = b.r * s * 1.3 + 8 * k;
            if (d < R && d > 0.01) {
              const f = 1 - d / R;
              // A gentle nudge only, so a balloon does not dodge the click meant to pop it; a swipe shoves harder.
              ax += (dx / d) * f * f * 500 * k * react;
              ay += (dy / d) * f * f * 500 * k * react;
              b.vx += clamp(p.vx, -2000, 2000) * f * sdt * 4 * react;
              b.vy += clamp(p.vy, -2000, 2000) * f * sdt * 4 * react;
              b.av += ((p.vx * dy - p.vy * dx) / (d * 900)) * f * react;
            }
          }
          if (b.state === 'tied') {
            if (b.x < leftWall) ax += (leftWall - b.x) * 6;
            if (b.x > W - b.r) ax -= (b.x - (W - b.r)) * 8;
            if (b.y < b.r * 1.1) ay += (b.r * 1.1 - b.y) * 10;
          }
          b.vx += ax * sdt;
          b.vy += ay * sdt;
          const drag = Math.exp(-1.4 * sdt);
          b.vx *= drag;
          b.vy *= drag;
          b.x += b.vx * sdt;
          b.y += b.vy * sdt;
          let target = clamp(b.vx * 0.004, -0.4, 0.4);
          if (b.state === 'tied') {
            const L = b.len + 1.16 * b.r * s;
            const dx = b.x - anchor.x;
            const dy = b.y - anchor.y;
            const d = Math.hypot(dx, dy) || 1;
            if (d > L) {
              const nx = dx / d;
              const ny = dy / d;
              b.x = anchor.x + nx * L;
              b.y = anchor.y + ny * L;
              const vr = b.vx * nx + b.vy * ny;
              if (vr > 0) {
                b.vx -= nx * vr;
                b.vy -= ny * vr;
              }
            }
            const taut = clamp((d - L * 0.9) / (L * 0.1), 0, 1);
            target = lerp(target, Math.atan2(dx, -dy), taut);
          } else if (b.y < -b.r * 3 - b.len * 0.5) {
            b.state = 'gone';
            b.back = clock + 1 + rand();
          }
          b.av += ((target - b.ang) * 30 - b.av * 5) * sdt;
          b.ang += b.av * sdt;
        }
        // Balloons bump into each other.
        for (let i = 0; i < balloons.length; i += 1) {
          const a = balloons[i];
          if (!alive(a)) continue;
          for (let j = i + 1; j < balloons.length; j += 1) {
            const b = balloons[j];
            if (!alive(b)) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.hypot(dx, dy);
            const min = (a.r * inflate(a.grow) + b.r * inflate(b.grow)) * 0.98;
            if (d >= min || d < 0.001) continue;
            const nx = dx / d;
            const ny = dy / d;
            const o = (min - d) / 2;
            a.x -= nx * o;
            a.y -= ny * o;
            b.x += nx * o;
            b.y += ny * o;
            const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (vn < 0) {
              const j2 = -vn * 0.8 * 0.5;
              a.vx -= nx * j2;
              a.vy -= ny * j2;
              b.vx += nx * j2;
              b.vy += ny * j2;
              const tq = ((b.vx - a.vx) * -ny + (b.vy - a.vy) * nx) * 0.004;
              a.av += tq;
              b.av -= tq;
            }
          }
        }
        // The ribbons: verlet ropes pinned to the tie below the card and to the knots.
        const sdt2 = sdt * sdt;
        for (const b of balloons) {
          if (b.state === 'gone') continue;
          const pinA = b.state !== 'free';
          const pinB = alive(b);
          const kn = pinB ? knotOf(b) : null;
          const seg = b.len / SEGS;
          const grav = (b.state === 'popped' ? 520 : 240) * k;
          const rope = b.rope;
          for (let i = 0; i <= SEGS; i += 1) {
            const n = rope[i];
            if ((i === 0 && pinA) || (i === SEGS && pinB)) continue;
            const vx = (n.x - n.px) * 0.985;
            const vy = (n.y - n.py) * 0.985;
            n.px = n.x;
            n.py = n.y;
            n.x += vx + wind * 0.3 * sdt2;
            n.y += vy + grav * sdt2;
          }
          for (let it = 0; it < 8; it += 1) {
            if (pinA) {
              rope[0].x = anchor.x;
              rope[0].y = anchor.y;
            }
            if (kn) {
              rope[SEGS].x = kn.x;
              rope[SEGS].y = kn.y;
            }
            for (let i = 0; i < SEGS; i += 1) {
              const a = rope[i];
              const n = rope[i + 1];
              const wa = i === 0 && pinA ? 0 : 1;
              const wb = i + 1 === SEGS && pinB ? 0 : 1;
              if (wa + wb === 0) continue;
              const dx = n.x - a.x;
              const dy = n.y - a.y;
              const d = Math.hypot(dx, dy) || 1e-6;
              const diff = (d - seg) / d;
              a.x += dx * diff * (wa / (wa + wb));
              a.y += dy * diff * (wa / (wa + wb));
              n.x -= dx * diff * (wb / (wa + wb));
              n.y -= dy * diff * (wb / (wa + wb));
            }
          }
          if (pinA) {
            rope[0].x = anchor.x;
            rope[0].y = anchor.y;
          }
          if (kn) {
            rope[SEGS].x = kn.x;
            rope[SEGS].y = kn.y;
          }
        }
        for (const f of far) {
          f.y -= f.vy * sdt;
          f.x += Math.sin(clock * 0.5 + f.ph) * 6 * k * sdt + wind * 0.2 * sdt;
          if (f.y < -rBase * 2) {
            f.y = H + rBase * 2;
            f.x = W * (c.body ? rand() : 0.3 + rand() * 0.7);
            f.col = Math.floor(rand() * LATEX.length);
          }
        }
        for (const cl of clouds) {
          cl.x += cl.v * sdt;
          if (cl.x > W) cl.x = -cl.w;
        }
        for (let i = shreds.length - 1; i >= 0; i -= 1) {
          const s = shreds[i];
          s.vy += 520 * k * sdt;
          const e = Math.exp(-1.3 * sdt);
          s.vx *= e;
          s.vy *= e;
          s.x += s.vx * sdt;
          s.y += s.vy * sdt;
          s.rot += s.vr * sdt;
          s.life -= sdt / 1.6;
          if (s.life <= 0 || s.y > H + 40) shreds.splice(i, 1);
        }
        for (let i = confetti.length - 1; i >= 0; i -= 1) {
          const q = confetti[i];
          q.vy += 200 * k * sdt;
          q.vx *= Math.exp(-2.2 * sdt);
          q.vy *= Math.exp(-2.4 * sdt);
          q.x += q.vx * sdt + Math.sin(clock * 3 + q.ph) * 22 * k * sdt + wind * 0.4 * sdt;
          q.y += q.vy * sdt;
          q.rot += q.vr * sdt;
          q.spin += q.vs * sdt;
          q.life -= sdt / 5;
          if (q.life <= 0 || q.y > H + 20) confetti.splice(i, 1);
        }
        for (let i = rings.length - 1; i >= 0; i -= 1) {
          rings[i].age += sdt;
          if (rings[i].age > 0.3) rings.splice(i, 1);
        }
      },
      draw(g) {
        g.drawImage(sky.cv, 0, 0, W, H);
        for (const cl of clouds) g.drawImage(cl.cv, cl.x, cl.y, cl.w, cl.h);
        // Far balloons, small and hazy.
        for (const f of far) {
          const s = (rBase * f.s) / spriteR;
          g.globalAlpha = 0.5;
          g.strokeStyle = 'rgba(255,255,255,0.6)';
          g.lineWidth = 0.6 * k;
          g.beginPath();
          g.moveTo(f.x, f.y + 1.25 * spriteR * s);
          g.quadraticCurveTo(f.x + Math.sin(clock + f.ph) * 4 * k, f.y + 2.4 * spriteR * s, f.x, f.y + 3.4 * spriteR * s);
          g.stroke();
          const sp = sprites[f.col];
          g.drawImage(sp, f.x - 1.2 * spriteR * s, f.y - 1.2 * spriteR * s, (sp.width / S) * s, (sp.height / S) * s);
        }
        g.globalAlpha = 1;
        // Ribbons behind the balloons.
        g.lineCap = 'round';
        g.lineJoin = 'round';
        for (const b of balloons) {
          if (b.state === 'gone') continue;
          const fade = b.state === 'popped' ? clamp((b.back - clock) / 1.2, 0, 1) : 1;
          if (fade <= 0) continue;
          const rope = b.rope;
          g.strokeStyle = rgba(mixHex(LATEX[b.col], '#ffffff', 0.2), 0.9 * fade);
          g.lineWidth = 1.1 * k;
          g.beginPath();
          g.moveTo(rope[0].x, rope[0].y);
          for (let i = 1; i < SEGS; i += 1) {
            g.quadraticCurveTo(rope[i].x, rope[i].y, (rope[i].x + rope[i + 1].x) / 2, (rope[i].y + rope[i + 1].y) / 2);
          }
          g.lineTo(rope[SEGS].x, rope[SEGS].y);
          g.stroke();
        }
        for (const b of balloons) {
          if (!alive(b)) continue;
          const s = inflate(b.grow) * (b.r / spriteR);
          const sq = 0.025 * Math.sin(b.wob * 2.1);
          const sp = sprites[b.col];
          g.save();
          g.translate(b.x, b.y);
          g.rotate(b.ang);
          g.scale(s * (1 + sq), s * (1 - sq));
          g.globalAlpha = 0.97;
          g.drawImage(sp, -1.2 * spriteR, -1.2 * spriteR, sp.width / S, sp.height / S);
          g.restore();
        }
        g.globalAlpha = 1;
        for (const s of shreds) {
          g.save();
          g.translate(s.x, s.y);
          g.rotate(s.rot);
          g.globalAlpha = clamp(s.life * 1.5, 0, 1);
          g.fillStyle = s.col;
          g.beginPath();
          g.moveTo(s.pts[0], s.pts[1]);
          for (let i = 2; i < s.pts.length; i += 2) g.lineTo(s.pts[i], s.pts[i + 1]);
          g.closePath();
          g.fill();
          g.restore();
        }
        for (const q of confetti) {
          const flip = Math.cos(q.spin);
          g.save();
          g.translate(q.x, q.y);
          g.rotate(q.rot);
          g.scale(1, Math.max(0.08, Math.abs(flip)));
          g.globalAlpha = clamp(q.life * 3, 0, 1);
          g.fillStyle = flip < 0 ? mixHex(q.col, '#000000', 0.3) : q.col;
          g.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
          g.restore();
        }
        g.globalAlpha = 1;
        for (const r of rings) {
          const a = 1 - r.age / 0.3;
          if (r.age < 0.08) {
            const fl = g.createRadialGradient(r.x, r.y, 0, r.x, r.y, r.r * 1.3);
            fl.addColorStop(0, `rgba(255,255,255,${0.7 * (1 - r.age / 0.08)})`);
            fl.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = fl;
            g.fillRect(r.x - r.r * 1.3, r.y - r.r * 1.3, r.r * 2.6, r.r * 2.6);
          }
          g.strokeStyle = rgba(r.col, a * 0.6);
          g.lineWidth = 2 * k * a;
          g.beginPath();
          g.arc(r.x, r.y, r.r * (1 + r.age * 5), 0, TAU);
          g.stroke();
        }
      },
    };
  },
};
