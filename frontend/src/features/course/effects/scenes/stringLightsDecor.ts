import { TAU, clamp, rgb } from './kit';

type Ctx = CanvasRenderingContext2D;
type Pt = { x: number; y: number };

/**
 * Every piece of decor is painted twice, in the same place: `a` gets its colour (unshaded, as if under flat white
 * light — all the shading comes from the path tracer) and `d` gets its relief as a grey level (0 = the mortar between
 * the bricks, 1 = as far out as the bulbs hang). stringLightsPathTracer.ts bounces the light off that relief.
 */
export type DecorPen = { a: Ctx; d: Ctx };

export type DecorLayout = {
  /** Things that shine by themselves (the moonlit sky through the window) — added on top of the lit room. */
  paintEmissive: (g: Ctx) => void;
  beamB: number;
  floorY: number;
  /** The window opening, the moonlight's area source. */
  window: { x0: number; y0: number; x1: number; y1: number };
  /** The lid of the top suitcase — where the amber stands. */
  caseTop: { x: number; w: number; y: number };
  /** The little retro fridge (its magnets are drawn live by the scene): its box, and where the
   * freezer's door ends. */
  fridge: { x: number; y: number; w: number; h: number; split: number };
};

const gray = (h: number) => {
  const v = Math.round(clamp(h, 0, 1) * 255);
  return `rgb(${v},${v},${v})`;
};

/** A colour scaled in brightness (`f`) and nudged warmer (+) or cooler (−). */
function tone(hex: string, f: number, warm = 0): string {
  const [r, g, b] = rgb(hex);
  const k = (n: number) => Math.round(clamp(n, 0, 255));
  return `rgb(${k(r * f + warm)},${k(g * f + warm * 0.3)},${k(b * f - warm)})`;
}

const vary = (rand: () => number, hex: string, spread: number) => tone(hex, 1 + (rand() - 0.5) * spread, (rand() - 0.5) * spread * 22);

function rect(p: DecorPen, x: number, y: number, w: number, h: number, color: string, height: number) {
  p.a.fillStyle = color;
  p.a.fillRect(x, y, w, h);
  p.d.fillStyle = gray(height);
  p.d.fillRect(x, y, w, h);
}

function shape(p: DecorPen, path: (g: Ctx) => void, color: string, height: number) {
  p.a.fillStyle = color;
  p.a.beginPath();
  path(p.a);
  p.a.fill();
  p.d.fillStyle = gray(height);
  p.d.beginPath();
  path(p.d);
  p.d.fill();
}

function polyPath(g: Ctx, pts: Pt[]) {
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) g.lineTo(pts[i].x, pts[i].y);
  g.closePath();
}

/** A rounded lump: flat colour, but a relief rising from `edge` at its rim to `top` in the middle. */
function dome(p: DecorPen, cx: number, cy: number, rx: number, ry: number, rot: number, color: string, top: number, edge: number) {
  p.a.fillStyle = color;
  p.a.beginPath();
  p.a.ellipse(cx, cy, rx, ry, rot, 0, TAU);
  p.a.fill();
  const g = p.d;
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  g.scale(1, ry / rx);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  grad.addColorStop(0, gray(top));
  grad.addColorStop(0.6, gray(edge + (top - edge) * 0.72));
  grad.addColorStop(1, gray(edge));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, rx, 0, TAU);
  g.fill();
  g.restore();
}

function rotated(p: DecorPen, cx: number, cy: number, rot: number, draw: (g: Ctx, albedo: boolean) => void) {
  for (const [g, albedo] of [[p.a, true], [p.d, false]] as const) {
    g.save();
    g.translate(cx, cy);
    g.rotate(rot);
    draw(g, albedo);
    g.restore();
  }
}

function clipBoth(p: DecorPen, path: (g: Ctx) => void, draw: () => void) {
  for (const g of [p.a, p.d]) {
    g.save();
    g.beginPath();
    path(g);
    g.clip();
  }
  draw();
  p.a.restore();
  p.d.restore();
}

function noiseCanvas(rand: () => number, size: number, spread: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d')!;
  const img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i += 1) {
    const val = 128 + (rand() - 0.5) * spread;
    img.data[i * 4] = val;
    img.data[i * 4 + 1] = val;
    img.data[i * 4 + 2] = val;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return canvas;
}

/** Fine surface texture (grit, fibres, pores) laid over a patch of colour. */
function grit(a: Ctx, noise: HTMLCanvasElement, x: number, y: number, w: number, h: number, alpha: number) {
  const pattern = a.createPattern(noise, 'repeat');
  if (!pattern) return;
  a.save();
  a.globalCompositeOperation = 'overlay';
  a.globalAlpha = alpha;
  a.fillStyle = pattern;
  a.fillRect(x, y, w, h);
  a.restore();
}

/** Large soft blotches — age, soot, sun-fade — so no surface is one flat colour. */
function mottle(a: Ctx, rand: () => number, x: number, y: number, w: number, h: number, count: number, colors: string[], maxAlpha: number) {
  for (let i = 0; i < count; i += 1) {
    const cx = x + rand() * w;
    const cy = y + rand() * h;
    const r = (0.04 + rand() * 0.16) * Math.max(w, h);
    const col = colors[Math.floor(rand() * colors.length)];
    const grad = a.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `${col}${(maxAlpha * (0.3 + rand() * 0.7)).toFixed(3)})`);
    grad.addColorStop(1, `${col}0)`);
    a.fillStyle = grad;
    a.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
}

/** Wavy grain lines along a piece of wood, on the colour layer only. */
function grain(a: Ctx, rand: () => number, x: number, y: number, w: number, h: number, vertical: boolean, count: number, alpha: number) {
  a.save();
  a.beginPath();
  a.rect(x, y, w, h);
  a.clip();
  for (let i = 0; i < count; i += 1) {
    a.strokeStyle = `rgba(26,12,4,${(alpha * (0.35 + rand())).toFixed(3)})`;
    a.lineWidth = 0.5 + rand() * 1.3;
    const off = rand();
    const amp = 0.6 + rand() * 2.6;
    const freq = 0.008 + rand() * 0.03;
    const phase = rand() * 6;
    a.beginPath();
    for (let s = 0; s <= 28; s += 1) {
      const t = s / 28;
      const px = vertical ? x + off * w + Math.sin((y + t * h) * freq + phase) * amp : x + t * w;
      const py = vertical ? y + t * h : y + off * h + Math.sin((x + t * w) * freq + phase) * amp;
      if (s === 0) a.moveTo(px, py);
      else a.lineTo(px, py);
    }
    a.stroke();
  }
  a.restore();
}

function knot(a: Ctx, cx: number, cy: number, rx: number, ry: number) {
  for (let k = 4; k >= 1; k -= 1) {
    a.strokeStyle = `rgba(30,14,5,${0.12 + 0.06 * (4 - k)})`;
    a.lineWidth = 0.9;
    a.beginPath();
    a.ellipse(cx, cy, (rx * k) / 4, (ry * k) / 4, 0, 0, TAU);
    a.stroke();
  }
  a.fillStyle = 'rgba(32,15,5,0.55)';
  a.beginPath();
  a.ellipse(cx, cy, rx * 0.22, ry * 0.22, 0, 0, TAU);
  a.fill();
}

/** An irregular closed outline (a continent, a stain) from a few random harmonics. */
function blob(rand: () => number, cx: number, cy: number, rx: number, ry: number, n = 30): Pt[] {
  const waves = Array.from({ length: 5 }, (_, i) => ({ k: i + 2, amp: ((rand() - 0.5) * 0.4) / (i + 1), ph: rand() * TAU }));
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * TAU;
    let r = 1 + (rand() - 0.5) * 0.08;
    for (const w of waves) r += w.amp * Math.sin(w.k * t + w.ph);
    return { x: cx + Math.cos(t) * rx * r, y: cy + Math.sin(t) * ry * r };
  });
}

function archPath(g: Ctx, x: number, y: number, w: number, h: number) {
  g.moveTo(x, y + h);
  g.lineTo(x, y + w / 2);
  g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
  g.lineTo(x + w, y + h);
  g.closePath();
}

function paintBricks(p: DecorPen, rand: () => number, fine: HTMLCanvasElement, x0: number, y0: number, x1: number, y1: number, brickH: number) {
  const bw = brickH * 3.1;
  const joint = Math.max(1.6, brickH * 0.14);
  const clay = ['#8e4a33', '#9c5539', '#7e3f2b', '#a8623f', '#743726', '#955240', '#88452f', '#b16f4b', '#6a3322'];
  clipBoth(p, (g) => g.rect(x0, y0, x1 - x0, y1 - y0), () => {
    rect(p, x0, y0, x1 - x0, y1 - y0, '#8b8274', 0.004);
    grit(p.a, fine, x0, y0, x1 - x0, y1 - y0, 0.5);
    let row = 0;
    for (let y = y0; y < y1; y += brickH, row += 1) {
      const shift = row % 2 ? bw * 0.5 : 0;
      for (let x = x0 - shift; x < x1; x += bw) {
        const bx = x + joint / 2;
        const by = y + joint / 2;
        const w = bw - joint;
        const h = brickH - joint;
        rect(p, bx, by, w, h, tone(clay[Math.floor(rand() * clay.length)], 0.8 + rand() * 0.32), 0.016 + rand() * 0.007);
        const a = p.a;
        for (let k = 0; k < 3; k += 1) {
          a.fillStyle = rand() < 0.55 ? `rgba(46,20,10,${(0.06 + rand() * 0.12).toFixed(3)})` : `rgba(226,186,150,${(0.05 + rand() * 0.08).toFixed(3)})`;
          a.beginPath();
          a.ellipse(bx + rand() * w, by + rand() * h, w * (0.08 + rand() * 0.22), h * (0.2 + rand() * 0.35), 0, 0, TAU);
          a.fill();
        }
        a.strokeStyle = 'rgba(34,16,8,0.25)';
        a.lineWidth = 1;
        a.strokeRect(bx + 0.5, by + 0.5, w - 1, h - 1);
        if (rand() < 0.07) {
          a.fillStyle = 'rgba(236,228,214,0.3)';
          a.fillRect(bx, by, w, h);
        } else if (rand() < 0.05) {
          a.fillStyle = 'rgba(24,18,14,0.28)';
          a.fillRect(bx, by, w, h);
        }
      }
    }
  });
}

function paintWainscot(p: DecorPen, rand: () => number, noise: HTMLCanvasElement, W: number, top: number, floorY: number) {
  const h = floorY - top;
  rect(p, 0, top, W, h, '#4c3222', 0.045);
  const boardW = clamp(W * 0.024, 20, 46);
  for (let x = 0; x < W; x += boardW) {
    p.a.fillStyle = vary(rand, '#4c3222', 0.24);
    p.a.fillRect(x, top, boardW, h);
    grain(p.a, rand, x, top, boardW, h, true, 5, 0.14);
    if (rand() < 0.18) knot(p.a, x + boardW * (0.3 + rand() * 0.4), top + h * (0.2 + rand() * 0.6), boardW * 0.18, boardW * 0.34);
    rect(p, x, top, Math.max(1.5, boardW * 0.07), h, '#22150b', 0.03);
    p.a.fillStyle = 'rgba(150,110,80,0.2)';
    p.a.fillRect(x + Math.max(1.5, boardW * 0.07), top, 1, h);
  }
  grit(p.a, noise, 0, top, W, h, 0.3);
  const railH = clamp(floorY * 0.024, 8, 20);
  rect(p, 0, top - railH, W, railH, '#5a3c28', 0.095);
  grain(p.a, rand, 0, top - railH, W, railH, false, 6, 0.18);
  rect(p, 0, top - railH, W, Math.max(2, railH * 0.2), '#7a563c', 0.1);
  rect(p, 0, top - 2, W, 2, '#2a190f', 0.08);
  const baseH = clamp(floorY * 0.034, 12, 30);
  rect(p, 0, floorY - baseH, W, baseH, '#3a2619', 0.075);
  rect(p, 0, floorY - baseH, W, 2, '#5c3e2a', 0.08);
  grain(p.a, rand, 0, floorY - baseH, W, baseH, false, 5, 0.18);
}

/** Floorboards running away from the viewer, in perspective, with the relief rising towards the bottom edge so the
 * floor faces up at the lamps (the one real bit of 3D in a front-on relief). A worn rug lies in the middle. */
function paintFloor(p: DecorPen, rand: () => number, noise: HTMLCanvasElement, W: number, H: number, floorY: number) {
  const vpX = W * 0.5;
  const vpY = H * 0.3;
  const ramp = p.d.createLinearGradient(0, floorY, 0, H);
  ramp.addColorStop(0, gray(0.045));
  ramp.addColorStop(1, gray(0.6));
  p.d.fillStyle = ramp;
  p.d.fillRect(0, floorY, W, H - floorY);
  const a = p.a;
  a.fillStyle = '#3b2415';
  a.fillRect(0, floorY, W, H - floorY);
  const at = (xWall: number, t: number): Pt => {
    const y = floorY + (H - floorY) * t;
    return { x: vpX + (xWall - vpX) * ((y - vpY) / (floorY - vpY)), y };
  };
  const pw = clamp(W * 0.05, 40, 96);
  for (let x = -W * 1.2; x < W * 2.2; x += pw) {
    const A = at(x, 0);
    const B = at(x + pw, 0);
    const C = at(x + pw, 1);
    const D = at(x, 1);
    if (Math.max(C.x, B.x) < 0 || Math.min(A.x, D.x) > W) continue;
    a.save();
    a.beginPath();
    polyPath(a, [A, B, C, D]);
    a.fillStyle = vary(rand, '#452a18', 0.34);
    a.fill();
    a.clip();
    for (let k = 0; k < 6; k += 1) {
      const f = rand();
      const P0 = at(x + pw * f, 0);
      const P1 = at(x + pw * f, 1);
      a.strokeStyle = `rgba(20,10,4,${(0.06 + rand() * 0.12).toFixed(3)})`;
      a.lineWidth = 0.6 + rand();
      a.beginPath();
      a.moveTo(P0.x, P0.y);
      a.lineTo(P1.x, P1.y);
      a.stroke();
    }
    const tj = 0.15 + rand() * 0.7;
    const J0 = at(x, tj);
    const J1 = at(x + pw, tj);
    a.strokeStyle = 'rgba(14,7,3,0.55)';
    a.lineWidth = 1.2;
    a.beginPath();
    a.moveTo(J0.x, J0.y);
    a.lineTo(J1.x, J1.y);
    a.stroke();
    a.restore();
    a.strokeStyle = 'rgba(12,6,2,0.75)';
    a.lineWidth = 1.4;
    a.beginPath();
    a.moveTo(A.x, A.y);
    a.lineTo(D.x, D.y);
    a.stroke();
  }
  grit(a, noise, 0, floorY, W, H - floorY, 0.3);

  // The rug: a bilinear map of the unit square onto its perspective quad.
  const r0 = at(W * 0.35, 0.18);
  const r1 = at(W * 0.65, 0.18);
  const r2 = at(W * 0.65, 0.92);
  const r3 = at(W * 0.35, 0.92);
  const rug = (s: number, t: number): Pt => ({
    x: (r0.x * (1 - s) + r1.x * s) * (1 - t) + (r3.x * (1 - s) + r2.x * s) * t,
    y: (r0.y * (1 - s) + r1.y * s) * (1 - t) + (r3.y * (1 - s) + r2.y * s) * t,
  });
  const band = (i: number, color: string) => {
    a.fillStyle = color;
    a.beginPath();
    polyPath(a, [rug(i, i), rug(1 - i, i), rug(1 - i, 1 - i), rug(i, 1 - i)]);
    a.fill();
  };
  band(0, '#6e2a22');
  band(0.05, '#1f2c46');
  band(0.1, '#b58a44');
  band(0.12, '#7a2e24');
  for (let i = 1; i < 8; i += 1) {
    for (let j = 1; j < 5; j += 1) {
      const s = 0.12 + (0.76 * i) / 8;
      const t = 0.12 + (0.76 * j) / 5;
      const d = 0.035;
      a.fillStyle = (i + j) % 2 ? '#c9a45a' : '#2a3a5c';
      a.beginPath();
      polyPath(a, [rug(s, t - d * 1.6), rug(s + d, t), rug(s, t + d * 1.6), rug(s - d, t)]);
      a.fill();
    }
  }
  a.fillStyle = '#d8c7a0';
  a.beginPath();
  polyPath(a, Array.from({ length: 24 }, (_, i) => rug(0.5 + Math.cos((i / 24) * TAU) * 0.12, 0.5 + Math.sin((i / 24) * TAU) * 0.2)));
  a.fill();
  a.strokeStyle = 'rgba(220,205,170,0.7)';
  a.lineWidth = 1;
  for (let i = 0; i <= 30; i += 1) {
    const q = rug(i / 30, 1);
    a.beginPath();
    a.moveTo(q.x, q.y);
    a.lineTo(q.x + (q.x - vpX) * 0.01, q.y + 5);
    a.stroke();
  }
  grit(a, noise, Math.min(r0.x, r3.x), r0.y, Math.max(r1.x, r2.x) - Math.min(r0.x, r3.x), r2.y - r0.y, 0.45);
}

/** A little photograph printed on a postcard, in the card's own coordinates. */
function paintPhoto(g: Ctx, kind: number, x: number, y: number, w: number, h: number, rand: () => number) {
  const sky = (top: string, bottom: string, until: number) => {
    const s = g.createLinearGradient(0, y, 0, y + h * until);
    s.addColorStop(0, top);
    s.addColorStop(1, bottom);
    g.fillStyle = s;
    g.fillRect(x, y, w, h);
  };
  const ridge = (color: string, base: number, peak: number, steps: number) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(x, y + h);
    for (let i = 0; i <= steps; i += 1) g.lineTo(x + (w * i) / steps, y + h * (base - rand() * peak));
    g.lineTo(x + w, y + h);
    g.closePath();
    g.fill();
  };
  switch (kind % 6) {
    case 0:
      sky('#8fc3e8', '#e3f1f7', 0.6);
      g.fillStyle = '#2f7fa8';
      g.fillRect(x, y + h * 0.58, w, h * 0.42);
      g.fillStyle = '#e6d3a0';
      g.fillRect(x, y + h * 0.84, w, h * 0.16);
      g.fillStyle = '#fff3c4';
      g.beginPath();
      g.arc(x + w * 0.72, y + h * 0.28, h * 0.1, 0, TAU);
      g.fill();
      break;
    case 1:
      sky('#9dbfe0', '#dfeaf2', 0.7);
      ridge('#56657a', 0.62, 0.35, 6);
      ridge('#3e5a3a', 0.86, 0.12, 8);
      break;
    case 2:
      sky('#f0a86a', '#5e3f7a', 1);
      g.fillStyle = '#1e1a2a';
      for (let i = 0; i < 9; i += 1) {
        const bw = w / 9;
        const bh = h * (0.2 + rand() * 0.45);
        g.fillRect(x + i * bw, y + h - bh, bw - 1, bh);
      }
      g.fillStyle = '#ffd98a';
      for (let i = 0; i < 18; i += 1) g.fillRect(x + rand() * w, y + h * (0.6 + rand() * 0.35), 1.2, 1.2);
      break;
    case 3:
      sky('#f6d8a0', '#fbeed2', 0.7);
      ridge('#d9a860', 0.72, 0.18, 5);
      ridge('#c18a48', 0.9, 0.1, 5);
      break;
    case 4:
      sky('#a9cce0', '#eaf3f6', 0.5);
      ridge('#2f4f36', 0.52, 0.16, 10);
      g.fillStyle = '#4b7f98';
      g.fillRect(x, y + h * 0.55, w, h * 0.45);
      g.fillStyle = 'rgba(47,79,54,0.55)';
      g.fillRect(x, y + h * 0.55, w, h * 0.12);
      break;
    default:
      sky('#f08a4a', '#7a3a6a', 1);
      g.fillStyle = '#1c1420';
      g.fillRect(x, y + h * 0.8, w, h * 0.2);
      g.strokeStyle = '#1c1420';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(x + w * 0.3, y + h * 0.8);
      g.quadraticCurveTo(x + w * 0.34, y + h * 0.5, x + w * 0.28, y + h * 0.3);
      g.stroke();
      for (let i = 0; i < 5; i += 1) {
        g.beginPath();
        g.ellipse(x + w * 0.28 + Math.cos(i * 1.3) * w * 0.06, y + h * 0.3 + Math.sin(i * 1.3) * h * 0.04, w * 0.09, h * 0.025, i * 1.3, 0, TAU);
        g.fill();
      }
  }
}

/** A block whose relief bulges across its width, so it reads as round (a tower, a column) under the lamps. */
function column(p: DecorPen, x: number, y: number, w: number, h: number, color: string, edge: number, top: number) {
  p.a.fillStyle = color;
  p.a.fillRect(x, y, w, h);
  const gr = p.d.createLinearGradient(x, 0, x + w, 0);
  gr.addColorStop(0, gray(edge));
  gr.addColorStop(0.5, gray(top));
  gr.addColorStop(1, gray(edge));
  p.d.fillStyle = gr;
  p.d.fillRect(x, y, w, h);
}

function starPath(g: Ctx, cx: number, cy: number, r: number) {
  for (let k = 0; k < 10; k += 1) {
    const ang = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r * 0.45 : r;
    if (k === 0) g.moveTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
    else g.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
  }
  g.closePath();
}

/** A stroke with a relief, e.g. a raised arm. */
function limb(p: DecorPen, x0: number, y0: number, x1: number, y1: number, width: number, color: string, height: number) {
  for (const [g, col] of [[p.a, color], [p.d, gray(height)]] as const) {
    g.strokeStyle = col;
    g.lineWidth = width;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    g.lineCap = 'butt';
  }
}

type Landmark = { wf: number; hf: number; paint: (p: DecorPen, x: number, y: number, h: number) => void };

/** Souvenir figurines of landmarks, each standing on the shelf with its base at (x, y) and `h` tall. */
const LANDMARKS: Landmark[] = [
  { // Eiffel Tower — France
    wf: 0.44,
    hf: 1.2,
    paint: (p, x, y, h) => {
      const w = h * 0.42;
      const outline = (g: Ctx) => {
        g.moveTo(x - w / 2, y);
        g.quadraticCurveTo(x - w * 0.2, y - h * 0.3, x - w * 0.07, y - h * 0.62);
        g.lineTo(x - w * 0.025, y - h * 0.92);
        g.lineTo(x, y - h);
        g.lineTo(x + w * 0.025, y - h * 0.92);
        g.lineTo(x + w * 0.07, y - h * 0.62);
        g.quadraticCurveTo(x + w * 0.2, y - h * 0.3, x + w / 2, y);
        g.lineTo(x + w * 0.3, y);
        g.quadraticCurveTo(x, y - h * 0.3, x - w * 0.3, y);
        g.closePath();
      };
      p.a.fillStyle = '#5b4632';
      p.a.beginPath();
      outline(p.a);
      p.a.fill();
      const gr = p.d.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
      gr.addColorStop(0, gray(0.36));
      gr.addColorStop(0.5, gray(0.45));
      gr.addColorStop(1, gray(0.36));
      p.d.fillStyle = gr;
      p.d.beginPath();
      outline(p.d);
      p.d.fill();
      p.a.save();
      p.a.beginPath();
      outline(p.a);
      p.a.clip();
      p.a.strokeStyle = 'rgba(170,140,100,0.5)';
      p.a.lineWidth = 0.7;
      for (let k = -14; k <= 14; k += 1) {
        const off = (k * h) / 14;
        p.a.beginPath();
        p.a.moveTo(x - w + off, y);
        p.a.lineTo(x + w + off, y - h * 1.2);
        p.a.moveTo(x + w - off, y);
        p.a.lineTo(x - w - off, y - h * 1.2);
        p.a.stroke();
      }
      p.a.restore();
      rect(p, x - w * 0.22, y - h * 0.34, w * 0.44, Math.max(2, h * 0.025), '#4a382a', 0.46);
      rect(p, x - w * 0.12, y - h * 0.63, w * 0.24, Math.max(2, h * 0.02), '#4a382a', 0.46);
    },
  },
  { // Big Ben — United Kingdom
    wf: 0.28,
    hf: 1.05,
    paint: (p, x, y, h) => {
      const w = h * 0.2;
      column(p, x - w / 2, y - h * 0.7, w, h * 0.7, '#c9a868', 0.36, 0.43);
      p.a.strokeStyle = 'rgba(90,64,30,0.45)';
      p.a.lineWidth = 0.8;
      for (const f of [-0.25, 0, 0.25]) {
        p.a.beginPath();
        p.a.moveTo(x + w * f, y - h * 0.66);
        p.a.lineTo(x + w * f, y - 2);
        p.a.stroke();
      }
      column(p, x - w * 0.6, y - h * 0.81, w * 1.2, h * 0.12, '#c9a868', 0.37, 0.45);
      dome(p, x, y - h * 0.75, w * 0.4, w * 0.4, 0, '#f1e9cf', 0.47, 0.45);
      p.a.strokeStyle = '#2a2016';
      p.a.lineWidth = 1;
      p.a.beginPath();
      p.a.moveTo(x, y - h * 0.75);
      p.a.lineTo(x + w * 0.2, y - h * 0.77);
      p.a.moveTo(x, y - h * 0.75);
      p.a.lineTo(x - w * 0.05, y - h * 0.75 - w * 0.3);
      p.a.stroke();
      column(p, x - w * 0.42, y - h * 0.88, w * 0.84, h * 0.07, '#b89656', 0.37, 0.44);
      shape(p, (g) => polyPath(g, [{ x: x - w * 0.46, y: y - h * 0.88 }, { x: x + w * 0.46, y: y - h * 0.88 }, { x, y: y - h }]), '#465446', 0.44);
    },
  },
  { // Statue of Liberty — USA
    wf: 0.36,
    hf: 1.0,
    paint: (p, x, y, h) => {
      const green = '#5f9a82';
      column(p, x - h * 0.13, y - h * 0.36, h * 0.26, h * 0.36, '#a8997c', 0.36, 0.42);
      rect(p, x - h * 0.16, y - h * 0.37, h * 0.32, h * 0.03, '#968768', 0.43);
      rect(p, x - h * 0.17, y - h * 0.04, h * 0.34, h * 0.04, '#968768', 0.43);
      const robe = [{ x: x - h * 0.075, y: y - h * 0.37 }, { x: x + h * 0.075, y: y - h * 0.37 }, { x: x + h * 0.045, y: y - h * 0.76 }, { x: x - h * 0.045, y: y - h * 0.76 }];
      p.a.fillStyle = green;
      p.a.beginPath();
      polyPath(p.a, robe);
      p.a.fill();
      const gr = p.d.createLinearGradient(x - h * 0.075, 0, x + h * 0.075, 0);
      gr.addColorStop(0, gray(0.4));
      gr.addColorStop(0.5, gray(0.46));
      gr.addColorStop(1, gray(0.4));
      p.d.fillStyle = gr;
      p.d.beginPath();
      polyPath(p.d, robe);
      p.d.fill();
      p.a.strokeStyle = 'rgba(40,80,64,0.5)';
      p.a.lineWidth = 0.8;
      for (const f of [-0.3, 0, 0.3]) {
        p.a.beginPath();
        p.a.moveTo(x + h * 0.05 * f, y - h * 0.74);
        p.a.lineTo(x + h * 0.08 * f, y - h * 0.38);
        p.a.stroke();
      }
      dome(p, x, y - h * 0.8, h * 0.035, h * 0.042, 0, green, 0.47, 0.44);
      p.a.strokeStyle = green;
      p.a.lineWidth = 1;
      for (let k = -3; k <= 3; k += 1) {
        const ang = -Math.PI / 2 + k * 0.32;
        p.a.beginPath();
        p.a.moveTo(x + Math.cos(ang) * h * 0.035, y - h * 0.82 + Math.sin(ang) * h * 0.03);
        p.a.lineTo(x + Math.cos(ang) * h * 0.075, y - h * 0.82 + Math.sin(ang) * h * 0.065);
        p.a.stroke();
      }
      limb(p, x + h * 0.035, y - h * 0.73, x + h * 0.075, y - h * 0.95, Math.max(2, h * 0.025), green, 0.45);
      dome(p, x + h * 0.077, y - h * 0.975, h * 0.022, h * 0.034, 0, '#e2b442', 0.47, 0.45);
      rect(p, x - h * 0.085, y - h * 0.66, h * 0.035, h * 0.075, '#6aa58c', 0.46);
    },
  },
  { // Leaning Tower of Pisa — Italy
    wf: 0.36,
    hf: 0.82,
    paint: (p, x, y, h) => {
      const w = h * 0.26;
      rotated(p, x, y, 0.09, (g, albedo) => {
        if (albedo) g.fillStyle = '#ece4d2';
        else {
          const gr = g.createLinearGradient(-w / 2, 0, w / 2, 0);
          gr.addColorStop(0, gray(0.36));
          gr.addColorStop(0.5, gray(0.45));
          gr.addColorStop(1, gray(0.36));
          g.fillStyle = gr;
        }
        g.fillRect(-w / 2, -h * 0.88, w, h * 0.88);
        g.fillRect(-w * 0.36, -h, w * 0.72, h * 0.12);
        if (!albedo) return;
        g.fillStyle = 'rgba(150,130,100,0.6)';
        for (let k = 1; k < 7; k += 1) g.fillRect(-w / 2, (-h * 0.88 * k) / 7, w, 1.2);
        g.strokeStyle = 'rgba(120,100,70,0.5)';
        g.lineWidth = 0.8;
        for (let k = 0; k < 7; k += 1) {
          const ty = (-h * 0.88 * (k + 0.5)) / 7;
          for (let a = 0; a < 4; a += 1) {
            const ax = -w / 2 + (w * (a + 0.5)) / 4;
            g.beginPath();
            g.arc(ax, ty, w / 10, Math.PI, 0);
            g.stroke();
          }
        }
      });
    },
  },
  { // Freedom Monument — Latvia (Riga)
    wf: 0.3,
    hf: 1.08,
    paint: (p, x, y, h) => {
      column(p, x - h * 0.14, y - h * 0.12, h * 0.28, h * 0.12, '#d9d1c1', 0.36, 0.42);
      column(p, x - h * 0.09, y - h * 0.2, h * 0.18, h * 0.08, '#d4ccbb', 0.37, 0.43);
      const ob = [{ x: x - h * 0.045, y: y - h * 0.2 }, { x: x + h * 0.045, y: y - h * 0.2 }, { x: x + h * 0.03, y: y - h * 0.8 }, { x: x - h * 0.03, y: y - h * 0.8 }];
      p.a.fillStyle = '#d8d0bf';
      p.a.beginPath();
      polyPath(p.a, ob);
      p.a.fill();
      const gr = p.d.createLinearGradient(x - h * 0.045, 0, x + h * 0.045, 0);
      gr.addColorStop(0, gray(0.38));
      gr.addColorStop(0.5, gray(0.45));
      gr.addColorStop(1, gray(0.38));
      p.d.fillStyle = gr;
      p.d.beginPath();
      polyPath(p.d, ob);
      p.d.fill();
      const copper = '#5f9a86';
      shape(p, (g) => polyPath(g, [{ x: x - h * 0.025, y: y - h * 0.8 }, { x: x + h * 0.025, y: y - h * 0.8 }, { x: x + h * 0.012, y: y - h * 0.9 }, { x: x - h * 0.012, y: y - h * 0.9 }]), copper, 0.47);
      dome(p, x, y - h * 0.915, h * 0.014, h * 0.016, 0, copper, 0.48, 0.46);
      limb(p, x - h * 0.01, y - h * 0.9, x - h * 0.03, y - h * 0.97, Math.max(1.5, h * 0.012), copper, 0.47);
      limb(p, x + h * 0.01, y - h * 0.9, x + h * 0.03, y - h * 0.97, Math.max(1.5, h * 0.012), copper, 0.47);
      for (const [sx, sy] of [[-0.05, 0.985], [0, 1.0], [0.05, 0.985]]) shape(p, (g) => starPath(g, x + h * sx, y - h * sy, h * 0.02), '#e3c04a', 0.48);
    },
  },
  { // Pagoda — Japan
    wf: 0.48,
    hf: 0.9,
    paint: (p, x, y, h) => {
      rect(p, x - h * 0.2, y - h * 0.07, h * 0.4, h * 0.07, '#8a847a', 0.4);
      for (let i = 0; i < 5; i += 1) {
        const base = y - h * 0.07 - i * h * 0.16;
        const bodyW = h * (0.28 - i * 0.04);
        column(p, x - bodyW / 2, base - h * 0.09, bodyW, h * 0.09, '#b5402f', 0.37, 0.43);
        const rw = bodyW * 1.6;
        const top = base - h * 0.15;
        shape(p, (g) => {
          g.moveTo(x - rw / 2, base - h * 0.08);
          g.quadraticCurveTo(x - rw * 0.34, base - h * 0.11, x - bodyW * 0.3, top);
          g.lineTo(x + bodyW * 0.3, top);
          g.quadraticCurveTo(x + rw * 0.34, base - h * 0.11, x + rw / 2, base - h * 0.08);
          g.closePath();
        }, '#2f2622', 0.46);
      }
      rect(p, x - 1.2, y - h, 2.4, h * 0.17, '#c9a24a', 0.47);
    },
  },
  { // Taj Mahal — India
    wf: 0.96,
    hf: 0.62,
    paint: (p, x, y, h) => {
      const marble = '#f0ebe1';
      rect(p, x - h * 0.47, y - h * 0.07, h * 0.94, h * 0.07, '#e2dccf', 0.39);
      column(p, x - h * 0.27, y - h * 0.38, h * 0.54, h * 0.31, marble, 0.4, 0.44);
      p.a.fillStyle = '#b9ae9c';
      p.a.beginPath();
      p.a.moveTo(x - h * 0.07, y - h * 0.08);
      p.a.lineTo(x - h * 0.07, y - h * 0.24);
      p.a.quadraticCurveTo(x, y - h * 0.34, x + h * 0.07, y - h * 0.24);
      p.a.lineTo(x + h * 0.07, y - h * 0.08);
      p.a.closePath();
      p.a.fill();
      column(p, x - h * 0.12, y - h * 0.45, h * 0.24, h * 0.07, marble, 0.42, 0.46);
      dome(p, x, y - h * 0.56, h * 0.17, h * 0.15, 0, '#f4f0e8', 0.52, 0.44);
      shape(p, (g) => polyPath(g, [{ x: x - h * 0.05, y: y - h * 0.68 }, { x: x + h * 0.05, y: y - h * 0.68 }, { x, y: y - h * 0.8 }]), '#f4f0e8', 0.5);
      rect(p, x - 1, y - h * 0.86, 2, h * 0.07, '#c9a24a', 0.51);
      for (const sx of [-1, 1]) {
        dome(p, x + sx * h * 0.19, y - h * 0.42, h * 0.06, h * 0.055, 0, '#f2eee6', 0.47, 0.43);
        column(p, x + sx * h * 0.42 - h * 0.018, y - h * 0.58, h * 0.036, h * 0.51, marble, 0.4, 0.45);
        dome(p, x + sx * h * 0.42, y - h * 0.6, h * 0.03, h * 0.028, 0, '#f2eee6', 0.47, 0.44);
      }
    },
  },
  { // Pyramids of Giza — Egypt
    wf: 1.55,
    hf: 0.5,
    paint: (p, x, y, h) => {
      rect(p, x - h * 0.78, y - h * 0.05, h * 1.56, h * 0.05, '#cfb07a', 0.38);
      const face = (cx: number, base: number, ph: number, lo: number, hi: number) => {
        const halfB = ph * 0.78;
        for (const side of [-1, 1]) {
          const tri = [{ x: cx, y: base - ph }, { x: cx + side * halfB, y: base }, { x: cx, y: base }];
          p.a.fillStyle = '#d2ae68';
          p.a.beginPath();
          polyPath(p.a, tri);
          p.a.fill();
          const gr = p.d.createLinearGradient(cx + side * halfB, 0, cx, 0);
          gr.addColorStop(0, gray(lo));
          gr.addColorStop(1, gray(hi));
          p.d.fillStyle = gr;
          p.d.beginPath();
          polyPath(p.d, tri);
          p.d.fill();
        }
        p.a.strokeStyle = 'rgba(140,105,55,0.4)';
        p.a.lineWidth = 0.7;
        for (let k = 1; k < 8; k += 1) {
          const yy = base - (ph * k) / 8;
          const half = halfB * (1 - k / 8);
          p.a.beginPath();
          p.a.moveTo(cx - half, yy);
          p.a.lineTo(cx + half, yy);
          p.a.stroke();
        }
      };
      face(x + h * 0.4, y - h * 0.05, h * 0.55, 0.36, 0.41);
      face(x - h * 0.12, y - h * 0.05, h * 0.9, 0.37, 0.47);
    },
  },
];

function paintLandmarks(p: DecorPen, rand: () => number, x0: number, shelfY: number, shelfW: number, unit: number) {
  const shH = clamp(unit * 0.14, 7, 16);
  for (const bx of [x0 + shelfW * 0.1, x0 + shelfW * 0.86]) {
    shape(p, (g) => polyPath(g, [{ x: bx, y: shelfY + shH }, { x: bx + shH * 2.4, y: shelfY + shH }, { x: bx, y: shelfY + shH * 4 }]), '#23201d', 0.3);
  }
  rect(p, x0, shelfY, shelfW, shH, '#5f3f25', 0.42);
  grain(p.a, rand, x0, shelfY, shelfW, shH, false, 5, 0.2);
  rect(p, x0, shelfY, shelfW, 2, '#80593a', 0.425);
  // Keep as many figurines as fit, in order, then spread them evenly along the shelf.
  const chosen: { lm: Landmark; w: number; h: number }[] = [];
  let used = 0;
  const gap = unit * 0.08;
  for (const lm of LANDMARKS) {
    const h = unit * lm.hf;
    const w = h * lm.wf;
    if (used + w + (chosen.length ? gap : 0) > shelfW * 0.94) continue;
    used += w + (chosen.length ? gap : 0);
    chosen.push({ lm, w, h });
  }
  const spare = (shelfW * 0.94 - used) / (chosen.length + 1);
  let cursor = x0 + shelfW * 0.03 + spare;
  for (const c of chosen) {
    c.lm.paint(p, cursor + c.w / 2, shelfY, c.h);
    cursor += c.w + gap + spare;
  }
}

export function getFridgeLayout(W: number, H: number, side: 'left' | 'right' = 'left') {
  const w = clamp(W * 0.11, 70, 240);
  // Rigid proportions: a shorter card crops the room instead of flattening the fridge.
  const h = w * 1.75;
  const margin = W * 0.012;
  return { x: side === 'right' ? W - margin - w : margin, y: H * 0.85 - h, w, h, split: 0 };
}

export function paintDecor(p: DecorPen, W: number, H: number, rand: () => number, fridgeSide: 'left' | 'right' = 'left'): DecorLayout {
  const u = (f: number) => f * W;
  const v = (f: number) => f * H;
  const beamB = v(0.075);
  const floorY = v(0.85);
  const wainTop = v(0.655);
  const noise = noiseCanvas(rand, 128, 70);
  const fine = noiseCanvas(rand, 48, 120);

  // ---- exposed brick above a dark beadboard wainscot, floorboards running towards the viewer.
  paintBricks(p, rand, fine, 0, beamB, W, wainTop, clamp(H * 0.03, 12, 30));
  mottle(p.a, rand, 0, beamB, W, wainTop - beamB, 26, ['rgba(30,14,8,', 'rgba(236,216,196,'], 0.12);
  paintWainscot(p, rand, noise, W, wainTop, floorY);
  paintFloor(p, rand, noise, W, H, floorY);

  // ---- arched window cut through the brick, a sill with a succulent, heavy linen curtains on a brass rod.
  const win = { x: u(0.575), y: v(0.16), w: clamp(W * 0.15, 90, 320), h: v(0.4) };
  const inset = win.w * 0.085;
  const inner = { x: win.x + inset, y: win.y + inset, w: win.w - inset * 2, h: win.h - inset * 1.35 };
  const frame = '#d6cebd';
  shape(p, (g) => archPath(g, win.x - win.w * 0.045, win.y - win.w * 0.045, win.w * 1.09, win.h + win.w * 0.045), '#3b2b23', 0.004);
  shape(p, (g) => archPath(g, win.x, win.y, win.w, win.h), frame, 0.15);
  grit(p.a, fine, win.x, win.y, win.w, win.h, 0.18);
  p.a.save();
  p.a.globalCompositeOperation = 'destination-out';
  p.a.beginPath();
  archPath(p.a, inner.x, inner.y, inner.w, inner.h);
  p.a.fill();
  p.a.restore();
  p.d.fillStyle = gray(0);
  p.d.beginPath();
  archPath(p.d, inner.x, inner.y, inner.w, inner.h);
  p.d.fill();
  const bar = Math.max(3, win.w * 0.028);
  rect(p, inner.x + inner.w / 2 - bar / 2, inner.y, bar, inner.h, frame, 0.14);
  rect(p, inner.x, inner.y + inner.h * 0.42, inner.w, bar, frame, 0.14);
  const sillH = Math.max(8, H * 0.016);
  const sillY = win.y + win.h;
  rect(p, win.x - win.w * 0.1, sillY, win.w * 1.2, sillH, '#cfc5b0', 0.24);
  rect(p, win.x - win.w * 0.1, sillY + sillH, win.w * 1.2, 2, '#6a5d4c', 0.2);
  const succX = win.x + win.w * 0.8;
  const succR = Math.max(6, win.w * 0.06);
  shape(p, (g) => polyPath(g, [{ x: succX - succR, y: sillY - succR * 1.1 }, { x: succX + succR, y: sillY - succR * 1.1 }, { x: succX + succR * 0.75, y: sillY }, { x: succX - succR * 0.75, y: sillY }]), '#b3643c', 0.34);
  for (let k = 0; k < 7; k += 1) {
    const ang = -Math.PI / 2 + (k - 3) * 0.42;
    dome(p, succX + Math.cos(ang) * succR * 0.7, sillY - succR * 1.2 + Math.sin(ang) * succR * 0.6, succR * 0.55, succR * 0.24, ang, vary(rand, '#6f9a7a', 0.2), 0.42, 0.36);
  }

  const curtainW = clamp(W * 0.055, 34, 130);
  const curtainTop = win.y - H * 0.045;
  const curtainBottom = sillY + H * 0.06;
  for (const cx of [win.x - curtainW * 1.14, win.x + win.w + curtainW * 0.14]) {
    const folds = 6;
    const fw = curtainW / folds;
    for (let k = 0; k < folds; k += 1) {
      const fx = cx + k * fw;
      const shade = p.a.createLinearGradient(fx, 0, fx + fw, 0);
      const f = 0.92 + rand() * 0.16;
      shade.addColorStop(0, tone('#7b8370', f * 0.8));
      shade.addColorStop(0.5, tone('#7b8370', f));
      shade.addColorStop(1, tone('#7b8370', f * 0.78));
      p.a.fillStyle = shade;
      p.a.fillRect(fx, curtainTop, fw + 0.5, curtainBottom - curtainTop);
      const fold = p.d.createLinearGradient(fx, 0, fx + fw, 0);
      fold.addColorStop(0, gray(0.14));
      fold.addColorStop(0.5, gray(0.27));
      fold.addColorStop(1, gray(0.14));
      p.d.fillStyle = fold;
      p.d.fillRect(fx, curtainTop, fw + 0.5, curtainBottom - curtainTop);
    }
    grit(p.a, fine, cx, curtainTop, curtainW, curtainBottom - curtainTop, 0.35);
    p.a.strokeStyle = 'rgba(40,46,36,0.12)';
    p.a.lineWidth = 0.6;
    for (let k = 0; k < curtainW; k += 2.5) {
      p.a.beginPath();
      p.a.moveTo(cx + k, curtainTop);
      p.a.lineTo(cx + k + (rand() - 0.5) * 2, curtainBottom);
      p.a.stroke();
    }
    rect(p, cx - 2, curtainTop + (curtainBottom - curtainTop) * 0.6, curtainW + 4, Math.max(5, H * 0.01), '#a88c55', 0.31);
  }
  const rodY = curtainTop - 7;
  rect(p, win.x - curtainW * 1.3, rodY, win.w + curtainW * 2.6, 6, '#8c6a36', 0.33);
  p.a.fillStyle = 'rgba(255,230,170,0.35)';
  p.a.fillRect(win.x - curtainW * 1.3, rodY + 1, win.w + curtainW * 2.6, 1.2);
  for (const fx of [win.x - curtainW * 1.3, win.x + win.w + curtainW * 1.3]) dome(p, fx, rodY + 3, 7, 7, 0, '#9c7a3c', 0.4, 0.3);
  for (let k = 0; k < 7; k += 1) {
    dome(p, win.x - curtainW * 1.1 + (k * curtainW) / 6, rodY + 6, 3.5, 3.5, 0, '#8a6a34', 0.36, 0.3);
    dome(p, win.x + win.w + curtainW * 0.2 + (k * curtainW) / 6, rodY + 6, 3.5, 3.5, 0, '#8a6a34', 0.36, 0.3);
  }

  // ---- an old framed map with a route across it.
  const map = { x: u(0.07), y: v(0.19), w: u(0.2), h: v(0.28) };
  const fw = clamp(W * 0.009, 7, 16);
  rect(p, map.x - fw, map.y - fw, map.w + fw * 2, map.h + fw * 2, '#3a2418', 0.11);
  grain(p.a, rand, map.x - fw, map.y - fw, map.w + fw * 2, fw, false, 3, 0.2);
  grain(p.a, rand, map.x - fw, map.y + map.h, map.w + fw * 2, fw, false, 3, 0.2);
  p.a.strokeStyle = 'rgba(190,150,90,0.45)';
  p.a.lineWidth = 1.2;
  p.a.strokeRect(map.x - fw * 0.45, map.y - fw * 0.45, map.w + fw * 0.9, map.h + fw * 0.9);
  rect(p, map.x, map.y, map.w, map.h, '#dccaa0', 0.085);
  const age = p.a.createRadialGradient(map.x + map.w / 2, map.y + map.h / 2, Math.min(map.w, map.h) * 0.25, map.x + map.w / 2, map.y + map.h / 2, Math.max(map.w, map.h) * 0.75);
  age.addColorStop(0, 'rgba(120,80,30,0)');
  age.addColorStop(1, 'rgba(120,80,30,0.32)');
  p.a.fillStyle = age;
  p.a.fillRect(map.x, map.y, map.w, map.h);
  mottle(p.a, rand, map.x, map.y, map.w, map.h, 10, ['rgba(130,90,40,'], 0.14);
  p.a.strokeStyle = 'rgba(110,80,40,0.2)';
  p.a.lineWidth = 0.8;
  for (let k = 1; k < 8; k += 1) {
    p.a.beginPath();
    p.a.moveTo(map.x + (map.w * k) / 8, map.y);
    p.a.lineTo(map.x + (map.w * k) / 8, map.y + map.h);
    p.a.stroke();
  }
  for (let k = 1; k < 6; k += 1) {
    p.a.beginPath();
    p.a.moveTo(map.x, map.y + (map.h * k) / 6);
    p.a.lineTo(map.x + map.w, map.y + (map.h * k) / 6);
    p.a.stroke();
  }
  const land: [number, number, number, number][] = [
    [0.2, 0.34, 0.13, 0.17], [0.28, 0.72, 0.06, 0.16], [0.5, 0.28, 0.07, 0.09],
    [0.53, 0.6, 0.09, 0.18], [0.74, 0.36, 0.17, 0.15], [0.85, 0.76, 0.07, 0.07],
  ];
  for (const [lx, ly, lrx, lry] of land) {
    const pts = blob(rand, map.x + lx * map.w, map.y + ly * map.h, lrx * map.w, lry * map.h);
    shape(p, (g) => polyPath(g, pts), '#b9996a', 0.089);
    p.a.strokeStyle = 'rgba(96,70,36,0.6)';
    p.a.lineWidth = 1;
    p.a.beginPath();
    polyPath(p.a, pts);
    p.a.stroke();
  }
  const rose = { x: map.x + map.w * 0.12, y: map.y + map.h * 0.86, r: map.h * 0.08 };
  for (let k = 0; k < 8; k += 1) {
    const ang = (k / 8) * TAU;
    const len = k % 2 ? rose.r * 0.55 : rose.r;
    p.a.fillStyle = k % 2 ? '#7a5a34' : '#9e2b22';
    p.a.beginPath();
    p.a.moveTo(rose.x, rose.y);
    p.a.lineTo(rose.x + Math.cos(ang - 0.25) * rose.r * 0.25, rose.y + Math.sin(ang - 0.25) * rose.r * 0.25);
    p.a.lineTo(rose.x + Math.cos(ang) * len, rose.y + Math.sin(ang) * len);
    p.a.closePath();
    p.a.fill();
  }
  p.a.fillStyle = 'rgba(232,218,180,0.85)';
  p.a.fillRect(map.x + map.w * 0.62, map.y + map.h * 0.05, map.w * 0.32, map.h * 0.12);
  p.a.fillStyle = 'rgba(90,60,30,0.6)';
  for (let k = 0; k < 3; k += 1) p.a.fillRect(map.x + map.w * 0.65, map.y + map.h * (0.075 + k * 0.03), map.w * (0.26 - k * 0.06), 1.3);
  const route: [number, number][] = [[0.2, 0.36], [0.5, 0.29], [0.62, 0.42], [0.76, 0.32], [0.85, 0.72]];
  p.a.save();
  p.a.strokeStyle = '#9e2b22';
  p.a.lineWidth = 2;
  p.a.setLineDash([3, 5]);
  p.a.beginPath();
  route.forEach(([rx, ry], i) => {
    const px = map.x + rx * map.w;
    const py = map.y + ry * map.h;
    if (i === 0) p.a.moveTo(px, py);
    else p.a.quadraticCurveTo(px - map.w * 0.05, py - map.h * 0.08, px, py);
  });
  p.a.stroke();
  p.a.restore();
  route.forEach(([rx, ry], i) => dome(p, map.x + rx * map.w, map.y + ry * map.h, 4.5, 4.5, 0, i % 2 ? '#d8a93a' : '#b0302a', 0.13, 0.1));
  grit(p.a, noise, map.x, map.y, map.w, map.h, 0.3);

  // ---- a clock, and a cluster of postcards taped to the brick.
  const clk = { x: u(0.47), y: v(0.4), r: clamp(Math.min(W, H) * 0.052, 18, 58) };
  dome(p, clk.x, clk.y, clk.r, clk.r, 0, '#2c1e14', 0.16, 0.12);
  dome(p, clk.x, clk.y, clk.r * 0.85, clk.r * 0.85, 0, '#ece2cc', 0.145, 0.135);
  p.a.strokeStyle = '#2a211a';
  for (let k = 0; k < 60; k += 1) {
    const ang = (k / 60) * TAU;
    const long = k % 5 === 0;
    p.a.lineWidth = long ? 2 : 0.8;
    p.a.beginPath();
    p.a.moveTo(clk.x + Math.cos(ang) * clk.r * (long ? 0.66 : 0.74), clk.y + Math.sin(ang) * clk.r * (long ? 0.66 : 0.74));
    p.a.lineTo(clk.x + Math.cos(ang) * clk.r * 0.8, clk.y + Math.sin(ang) * clk.r * 0.8);
    p.a.stroke();
  }
  p.a.lineCap = 'round';
  p.a.lineWidth = 3;
  p.a.beginPath();
  p.a.moveTo(clk.x, clk.y);
  p.a.lineTo(clk.x + Math.cos(-2.6) * clk.r * 0.42, clk.y + Math.sin(-2.6) * clk.r * 0.42);
  p.a.stroke();
  p.a.lineWidth = 2;
  p.a.beginPath();
  p.a.moveTo(clk.x, clk.y);
  p.a.lineTo(clk.x + Math.cos(-0.52) * clk.r * 0.62, clk.y + Math.sin(-0.52) * clk.r * 0.62);
  p.a.stroke();
  p.a.lineCap = 'butt';
  dome(p, clk.x, clk.y, 3, 3, 0, '#8a6a34', 0.16, 0.15);

  const cardW = clamp(W * 0.052, 34, 96);
  for (let i = 0; i < 8; i += 1) {
    const cx = u(0.8) + rand() * u(0.14);
    const cy = v(0.14) + rand() * v(0.2);
    const rot = (rand() - 0.5) * 0.45;
    const lift = 0.05 + i * 0.005;
    const kind = Math.floor(rand() * 6);
    const ch = cardW * 0.7;
    const seed = Math.floor(rand() * 1e9);
    rotated(p, cx, cy, rot, (g, albedo) => {
      g.fillStyle = albedo ? '#efe7d4' : gray(lift);
      g.fillRect(-cardW / 2, -ch / 2, cardW, ch);
      if (albedo) {
        let s = seed;
        const local = () => {
          s = (s * 1664525 + 1013904223) >>> 0;
          return s / 4294967296;
        };
        paintPhoto(g, kind, -cardW / 2 + 3, -ch / 2 + 3, cardW - 6, ch - 6, local);
        g.fillStyle = 'rgba(0,0,0,0.12)';
        g.fillRect(-cardW / 2, ch / 2 - 1, cardW, 1);
      }
      g.fillStyle = albedo ? 'rgba(232,218,160,0.7)' : gray(lift + 0.012);
      g.fillRect(-8, -ch / 2 - 4, 16, 8);
    });
  }

  // ---- under the postcards: a shelf of souvenir landmarks from around the world.
  paintLandmarks(p, rand, u(0.79), v(0.5), u(0.985) - u(0.79), clamp(H * 0.11, 38, 130));

  // ---- a wooden shelf on iron brackets: a globe, a row of worn books, a cactus.
  const shelf = { x: u(0.3), y: v(0.575), w: u(0.24), h: clamp(H * 0.02, 8, 18) };
  for (const bx of [shelf.x + shelf.w * 0.1, shelf.x + shelf.w * 0.86]) {
    shape(p, (g) => polyPath(g, [{ x: bx, y: shelf.y + shelf.h }, { x: bx + shelf.h * 2.4, y: shelf.y + shelf.h }, { x: bx, y: shelf.y + shelf.h * 4 }]), '#23201d', 0.3);
  }
  rect(p, shelf.x, shelf.y, shelf.w, shelf.h, '#6d4a2c', 0.42);
  grain(p.a, rand, shelf.x, shelf.y, shelf.w, shelf.h, false, 5, 0.2);
  rect(p, shelf.x, shelf.y, shelf.w, 2, '#8e6644', 0.425);
  const gr = Math.min(W * 0.028, H * 0.064);
  const gx = shelf.x + shelf.w * 0.15;
  const gy = shelf.y - gr * 1.3;
  dome(p, gx, shelf.y - 3, gr * 0.6, gr * 0.16, 0, '#3a2616', 0.5, 0.44);
  rect(p, gx - 1.5, gy + gr * 0.8, 3, gr * 0.5, '#9c7a3c', 0.55);
  dome(p, gx, gy, gr, gr, 0, '#2d5f8a', 0.8, 0.5);
  p.a.save();
  p.a.beginPath();
  p.a.arc(gx, gy, gr, 0, TAU);
  p.a.clip();
  for (const [ox, oy, rx, ry] of [[-0.35, -0.25, 0.4, 0.3], [0.4, 0.12, 0.3, 0.42], [-0.12, 0.55, 0.3, 0.2], [0.1, -0.7, 0.35, 0.12]] as const) {
    p.a.fillStyle = vary(rand, '#8a9a5a', 0.3);
    p.a.beginPath();
    polyPath(p.a, blob(rand, gx + ox * gr, gy + oy * gr, rx * gr, ry * gr, 20));
    p.a.fill();
  }
  p.a.restore();
  p.a.strokeStyle = '#b8923e';
  p.a.lineWidth = 2.5;
  p.a.beginPath();
  p.a.ellipse(gx, gy, gr * 1.08, gr * 1.08, 0, -1.25, 1.95);
  p.a.stroke();
  const bookColors = ['#7a2e24', '#2b4a63', '#a88234', '#34563c', '#5a3a5a', '#8a5a2a', '#2f2f3f', '#6b2a2a'];
  let bookX = shelf.x + shelf.w * 0.4;
  for (let i = 0; i < 8; i += 1) {
    const bw = clamp(W * 0.009 + rand() * W * 0.006, 8, 24);
    const bh = H * (0.05 + rand() * 0.04);
    const color = vary(rand, bookColors[i % bookColors.length], 0.18);
    const lean = i === 7;
    rotated(p, bookX, shelf.y, lean ? -0.3 : 0, (g, albedo) => {
      g.fillStyle = albedo ? color : gray(0.5 + (i % 3) * 0.012);
      g.fillRect(0, -bh, bw, bh);
      if (albedo) {
        g.fillStyle = 'rgba(214,180,100,0.75)';
        g.fillRect(0, -bh * 0.9, bw, 1.2);
        g.fillRect(0, -bh * 0.14, bw, 1.2);
        g.fillStyle = 'rgba(232,220,190,0.55)';
        g.fillRect(bw * 0.2, -bh * 0.7, bw * 0.6, bh * 0.22);
        g.fillStyle = 'rgba(0,0,0,0.18)';
        g.fillRect(bw - 1, -bh, 1, bh);
      }
    });
    if (!lean) bookX += bw + 1;
  }
  const potR = Math.max(9, W * 0.013);
  const potX = shelf.x + shelf.w * 0.9;
  shape(p, (g) => polyPath(g, [{ x: potX - potR, y: shelf.y - potR * 1.3 }, { x: potX + potR, y: shelf.y - potR * 1.3 }, { x: potX + potR * 0.72, y: shelf.y }, { x: potX - potR * 0.72, y: shelf.y }]), '#b0613a', 0.5);
  rect(p, potX - potR * 1.08, shelf.y - potR * 1.45, potR * 2.16, potR * 0.3, '#c26f45', 0.52);
  dome(p, potX, shelf.y - potR * 2.6, potR * 0.68, potR * 1.4, 0, '#4b7d4a', 0.7, 0.55);
  dome(p, potX + potR * 0.85, shelf.y - potR * 2.3, potR * 0.34, potR * 0.78, 0.5, '#4b7d4a', 0.66, 0.55);
  p.a.strokeStyle = 'rgba(28,52,26,0.45)';
  p.a.lineWidth = 0.8;
  for (let k = -2; k <= 2; k += 1) {
    p.a.beginPath();
    p.a.moveTo(potX + k * potR * 0.22, shelf.y - potR * 1.3);
    p.a.quadraticCurveTo(potX + k * potR * 0.34, shelf.y - potR * 2.6, potX + k * potR * 0.1, shelf.y - potR * 3.9);
    p.a.stroke();
  }
  dome(p, potX, shelf.y - potR * 3.95, potR * 0.3, potR * 0.22, 0, '#e07aa0', 0.72, 0.66);

  // ---- a plant hanging from the beam in a macramé sling, pothos trailing down.
  const hangX = u(0.36);
  const hangY = v(0.27);
  const hangR = Math.max(13, W * 0.02);
  p.a.strokeStyle = '#cbb991';
  p.a.lineWidth = 1.6;
  for (const off of [-0.9, 0, 0.9]) {
    p.a.beginPath();
    p.a.moveTo(hangX, beamB + 2);
    p.a.quadraticCurveTo(hangX + off * hangR * 0.4, hangY - hangR * 1.4, hangX + off * hangR, hangY - hangR * 0.2);
    p.a.stroke();
  }
  dome(p, hangX, hangY, hangR, hangR * 0.82, 0, '#b5623a', 0.66, 0.52);
  rect(p, hangX - hangR * 1.02, hangY - hangR * 0.72, hangR * 2.04, hangR * 0.24, '#c4703f', 0.67);
  for (let vine = 0; vine < 5; vine += 1) {
    const len = H * (0.1 + rand() * 0.16);
    const sx = hangX + (vine - 2) * hangR * 0.45;
    const sway = (rand() - 0.5) * hangR * 2;
    const pts: Pt[] = [];
    for (let s = 0; s <= 12; s += 1) {
      const t = s / 12;
      pts.push({ x: sx + sway * t * t + Math.sin(t * 5 + vine) * 3, y: hangY + hangR * 0.3 + len * t });
    }
    p.a.strokeStyle = '#35602f';
    p.a.lineWidth = 1.2;
    p.a.beginPath();
    pts.forEach((q, i) => (i ? p.a.lineTo(q.x, q.y) : p.a.moveTo(q.x, q.y)));
    p.a.stroke();
    pts.forEach((q, i) => {
      if (i === 0) return;
      const side = i % 2 ? 1 : -1;
      const size = 5 + rand() * 4;
      dome(p, q.x + side * size * 0.8, q.y, size, size * 0.62, side * 0.6, vary(rand, '#3f8a46', 0.35), 0.6, 0.52);
    });
  }

  // ---- a little retro fridge, right in the card and left in the full room: cream
  // enamel rounded at the top, the freezer's door above, chrome handles, a badge, short legs. Its magnets are drawn live
  // over it by the scene (they react to the cursor's light; over the fridge the cursor is a magnifying glass).
  const fridge = getFridgeLayout(W, H, fridgeSide);
  {
    const { x, y, w, h } = fridge;
    const legH = h * 0.045;
    const bodyH = h - legH;
    const rTop = w * 0.2;
    const rBot = w * 0.06;
    const body = (g: Ctx) => {
      g.moveTo(x + rTop, y);
      g.lineTo(x + w - rTop, y);
      g.quadraticCurveTo(x + w, y, x + w, y + rTop);
      g.lineTo(x + w, y + bodyH - rBot);
      g.quadraticCurveTo(x + w, y + bodyH, x + w - rBot, y + bodyH);
      g.lineTo(x + rBot, y + bodyH);
      g.quadraticCurveTo(x, y + bodyH, x, y + bodyH - rBot);
      g.lineTo(x, y + rTop);
      g.quadraticCurveTo(x, y, x + rTop, y);
      g.closePath();
    };
    // The enamel, and its rounded sides in the relief (higher in the middle).
    p.a.fillStyle = '#e8dfc8';
    p.a.beginPath();
    body(p.a);
    p.a.fill();
    const round = p.d.createLinearGradient(x, 0, x + w, 0);
    round.addColorStop(0, gray(0.36));
    round.addColorStop(0.18, gray(0.47));
    round.addColorStop(0.82, gray(0.47));
    round.addColorStop(1, gray(0.36));
    p.d.fillStyle = round;
    p.d.beginPath();
    body(p.d);
    p.d.fill();
    grit(p.a, fine, x, y, w, bodyH, 0.12);
    // The doors' seam: the freezer above, the big door below; a gasket line round the edges.
    fridge.split = y + bodyH * 0.31;
    rect(p, x + w * 0.04, fridge.split - 1.5, w * 0.92, 3, '#8f8775', 0.43);
    p.a.strokeStyle = 'rgba(120,110,90,0.35)';
    p.a.lineWidth = 1;
    p.a.beginPath();
    body(p.a);
    p.a.stroke();
    // Chrome handles on the right of both doors, a badge low on the big door.
    const hw = Math.max(3, w * 0.05);
    for (const [y0, y1] of [[y + bodyH * 0.1, y + bodyH * 0.25], [y + bodyH * 0.36, y + bodyH * 0.62]]) {
      rect(p, x + w * 0.86, y0, hw, y1 - y0, '#c9cdd4', 0.54);
      p.a.fillStyle = 'rgba(255,255,255,0.55)';
      p.a.fillRect(x + w * 0.86 + hw * 0.25, y0 + 2, hw * 0.22, y1 - y0 - 4);
      rect(p, x + w * 0.85, y0 - 2, hw * 1.6, 3, '#9aa0a8', 0.53);
      rect(p, x + w * 0.85, y1 - 1, hw * 1.6, 3, '#9aa0a8', 0.53);
    }
    shape(p, (g) => g.ellipse(x + w * 0.5, y + bodyH * 0.93, w * 0.13, w * 0.035, 0, 0, TAU), '#b8bcc4', 0.5);
    p.a.fillStyle = 'rgba(80,60,40,0.75)';
    p.a.fillRect(x + w * 0.42, y + bodyH * 0.93 - 0.6, w * 0.16, 1.2);
    // Short chrome legs.
    for (const lx of [x + w * 0.1, x + w * 0.82]) rect(p, lx, y + bodyH, w * 0.08, legH, '#7d828a', 0.3);
  }

  // ---- travel-worn suitcases stacked on the left (next to the fridge), with a striped hatbox next to them.
  const cases: { x: number; w: number; h: number; color: string; height: number }[] = [
    { x: u(0.135), w: u(0.2), h: v(0.115), color: '#7a4a2a', height: 0.36 },
    { x: u(0.155), w: u(0.16), h: v(0.092), color: '#3a5a66', height: 0.47 },
    { x: u(0.175), w: u(0.115), h: v(0.072), color: '#8a3a30', height: 0.57 },
  ];
  let caseTop = floorY;
  cases.forEach((cs, ci) => {
    const y = caseTop - cs.h;
    rect(p, cs.x, y, cs.w, cs.h, vary(rand, cs.color, 0.1), cs.height);
    grit(p.a, noise, cs.x, y, cs.w, cs.h, 0.35);
    mottle(p.a, rand, cs.x, y, cs.w, cs.h, 5, ['rgba(20,10,5,', 'rgba(230,200,160,'], 0.14);
    rect(p, cs.x, y, cs.w, 3, tone(cs.color, 0.6), cs.height + 0.01);
    rect(p, cs.x, y + cs.h - 3, cs.w, 3, tone(cs.color, 0.6), cs.height + 0.01);
    p.a.save();
    p.a.strokeStyle = 'rgba(232,206,160,0.45)';
    p.a.lineWidth = 0.9;
    p.a.setLineDash([2.5, 2.5]);
    p.a.strokeRect(cs.x + 5, y + 6, cs.w - 10, cs.h - 12);
    p.a.restore();
    for (const sx of [cs.x + cs.w * 0.16, cs.x + cs.w * 0.8]) {
      rect(p, sx, y, Math.max(5, cs.w * 0.045), cs.h, '#3a2416', cs.height + 0.035);
      rect(p, sx - 1.5, y + cs.h * 0.3, Math.max(5, cs.w * 0.045) + 3, 6, '#c2a15a', cs.height + 0.05);
    }
    for (const [cxp, cyp] of [[cs.x, y], [cs.x + cs.w - 7, y], [cs.x, y + cs.h - 7], [cs.x + cs.w - 7, y + cs.h - 7]]) rect(p, cxp, cyp, 7, 7, '#c2a15a', cs.height + 0.045);
    if (ci === cases.length - 1) {
      p.a.strokeStyle = '#2a1a0c';
      p.a.lineWidth = 4;
      p.a.beginPath();
      p.a.arc(cs.x + cs.w / 2, y, cs.w * 0.09, Math.PI, 0);
      p.a.stroke();
    }
    for (let s = 0; s < 4; s += 1) {
      const sw = 12 + rand() * 14;
      const hue = Math.floor(rand() * 360);
      const oval = rand() < 0.5;
      rotated(p, cs.x + cs.w * (0.28 + rand() * 0.45), y + cs.h * (0.3 + rand() * 0.4), (rand() - 0.5) * 0.6, (g, albedo) => {
        g.fillStyle = albedo ? `hsl(${hue},48%,58%)` : gray(cs.height + 0.012);
        g.beginPath();
        if (oval) g.ellipse(0, 0, sw / 2, sw * 0.34, 0, 0, TAU);
        else g.rect(-sw / 2, -sw * 0.34, sw, sw * 0.68);
        g.fill();
        if (albedo) {
          g.strokeStyle = 'rgba(255,248,230,0.7)';
          g.lineWidth = 1;
          g.stroke();
          g.fillStyle = 'rgba(30,20,10,0.55)';
          g.fillRect(-sw * 0.3, -1, sw * 0.6, 1.2);
        }
      });
    }
    caseTop = y;
  });
  const hat = { x: u(0.35), w: clamp(W * 0.06, 40, 110), h: v(0.1) };
  const hy = floorY - hat.h;
  p.a.fillStyle = '#e4d2ac';
  p.a.fillRect(hat.x, hy, hat.w, hat.h);
  for (let k = 0; k < 9; k += 2) {
    p.a.fillStyle = 'rgba(140,160,130,0.8)';
    p.a.fillRect(hat.x + (hat.w * k) / 9, hy, hat.w / 9, hat.h);
  }
  const hatShade = p.d.createLinearGradient(hat.x, 0, hat.x + hat.w, 0);
  hatShade.addColorStop(0, gray(0.4));
  hatShade.addColorStop(0.5, gray(0.52));
  hatShade.addColorStop(1, gray(0.4));
  p.d.fillStyle = hatShade;
  p.d.fillRect(hat.x, hy, hat.w, hat.h);
  rect(p, hat.x - 2, hy - hat.h * 0.12, hat.w + 4, hat.h * 0.2, '#c7b287', 0.53);
  rect(p, hat.x + hat.w * 0.46, hy - hat.h * 0.12, hat.w * 0.08, hat.h * 1.12, '#8a3a3a', 0.54);

  // ---- a bird of paradise in a big ceramic pot, in the right corner.
  const plantX = u(fridgeSide === 'right' ? 0.075 : 0.905);
  const potH = v(0.11);
  const potW = clamp(W * 0.085, 50, 150);
  const leafY = floorY - potH;
  const leaves = Array.from({ length: 10 }, () => ({ ang: (rand() - 0.5) * 2.3, len: H * (0.12 + rand() * 0.12) }));
  leaves.sort((l1, l2) => Math.abs(l2.ang) - Math.abs(l1.ang));
  for (const leaf of leaves) {
    const dir = -Math.PI / 2 + leaf.ang;
    const stem = leaf.len * 0.45;
    const sx = plantX + Math.cos(dir) * stem;
    const sy = leafY + Math.sin(dir) * stem;
    p.a.strokeStyle = '#3f6a3a';
    p.a.lineWidth = 2.2;
    p.a.beginPath();
    p.a.moveTo(plantX, leafY);
    p.a.lineTo(sx, sy);
    p.a.stroke();
    const lx = sx + Math.cos(dir) * leaf.len * 0.3;
    const ly = sy + Math.sin(dir) * leaf.len * 0.3;
    const lw = leaf.len * 0.3;
    const lh = leaf.len * 0.09;
    dome(p, lx, ly, lw, lh, dir, vary(rand, '#2f6e3c', 0.4), 0.72, 0.56);
    p.a.strokeStyle = 'rgba(190,225,170,0.4)';
    p.a.lineWidth = 1.2;
    p.a.beginPath();
    p.a.moveTo(lx - Math.cos(dir) * lw, ly - Math.sin(dir) * lw);
    p.a.lineTo(lx + Math.cos(dir) * lw, ly + Math.sin(dir) * lw);
    p.a.stroke();
    p.a.strokeStyle = 'rgba(16,40,20,0.35)';
    p.a.lineWidth = 0.8;
    for (let k = -3; k <= 3; k += 1) {
      const t = k / 4;
      const bx = lx + Math.cos(dir) * lw * t;
      const by = ly + Math.sin(dir) * lw * t;
      p.a.beginPath();
      p.a.moveTo(bx, by);
      p.a.lineTo(bx + Math.cos(dir + 1.1) * lh, by + Math.sin(dir + 1.1) * lh);
      p.a.stroke();
    }
  }
  const potPts: Pt[] = [{ x: plantX - potW / 2, y: leafY }, { x: plantX + potW / 2, y: leafY }, { x: plantX + potW * 0.38, y: floorY }, { x: plantX - potW * 0.38, y: floorY }];
  p.a.fillStyle = '#cfc9bd';
  p.a.beginPath();
  polyPath(p.a, potPts);
  p.a.fill();
  const potShade = p.d.createLinearGradient(plantX - potW / 2, 0, plantX + potW / 2, 0);
  potShade.addColorStop(0, gray(0.38));
  potShade.addColorStop(0.5, gray(0.54));
  potShade.addColorStop(1, gray(0.38));
  p.d.fillStyle = potShade;
  p.d.beginPath();
  polyPath(p.d, potPts);
  p.d.fill();
  grit(p.a, fine, plantX - potW / 2, leafY, potW, potH, 0.25);
  rect(p, plantX - potW * 0.55, leafY - 5, potW * 1.1, 9, '#dcd6ca', 0.56);
  p.a.fillStyle = 'rgba(60,70,90,0.35)';
  for (let k = 0; k < 3; k += 1) p.a.fillRect(plantX - potW * 0.45 + k * 2, leafY + potH * (0.3 + k * 0.18), potW * 0.9 - k * 4, 2);

  // ---- the ceiling beam with iron bolts, and a string of cloth bunting along it.
  rect(p, 0, 0, W, beamB, '#48301f', 0.74);
  grain(p.a, rand, 0, 0, W, beamB, false, 12, 0.22);
  for (let k = 0; k < 3; k += 1) knot(p.a, W * (0.15 + rand() * 0.7), beamB * (0.3 + rand() * 0.4), beamB * 0.45, beamB * 0.16);
  const bevel = Math.max(3, beamB * 0.14);
  rect(p, 0, beamB - bevel, W, bevel, '#2f1f14', 0.68);
  for (let k = 0; k < 7; k += 1) {
    const bx = W * (0.07 + (0.86 * k) / 6);
    dome(p, bx, beamB * 0.45, beamB * 0.13, beamB * 0.13, 0, '#3c3a36', 0.77, 0.745);
    dome(p, bx, beamB * 0.45, beamB * 0.06, beamB * 0.06, 0, '#1e1d1b', 0.785, 0.77);
  }
  const flagColors = ['#b84a3a', '#d9a94a', '#3f6f8f', '#5f8a4a', '#e3d7c0', '#7a4a7a'];
  const flagN = 9;
  const bx0 = u(0.05);
  const bx1 = u(0.3);
  const sag = v(0.045);
  const bunting = (t: number): Pt => ({ x: bx0 + (bx1 - bx0) * t, y: beamB + 3 + sag * 4 * t * (1 - t) });
  p.a.strokeStyle = '#2a1c10';
  p.a.lineWidth = 1.5;
  p.a.beginPath();
  for (let i = 0; i <= 24; i += 1) {
    const q = bunting(i / 24);
    if (i === 0) p.a.moveTo(q.x, q.y);
    else p.a.lineTo(q.x, q.y);
  }
  p.a.stroke();
  for (let i = 0; i < flagN; i += 1) {
    const q = bunting((i + 0.5) / flagN);
    const fwid = ((bx1 - bx0) / flagN) * 0.8;
    const tri = [{ x: q.x - fwid / 2, y: q.y }, { x: q.x + fwid / 2, y: q.y }, { x: q.x, y: q.y + H * 0.05 }];
    shape(p, (g) => polyPath(g, tri), vary(rand, flagColors[i % flagColors.length], 0.12), 0.3);
    grit(p.a, fine, q.x - fwid / 2, q.y, fwid, H * 0.05, 0.3);
  }

  const paintEmissive = (g: Ctx) => {
    g.save();
    g.beginPath();
    archPath(g, inner.x, inner.y, inner.w, inner.h);
    g.clip();
    const sky = g.createLinearGradient(0, inner.y, 0, inner.y + inner.h);
    sky.addColorStop(0, '#07132e');
    sky.addColorStop(0.65, '#1a3663');
    sky.addColorStop(1, '#35607e');
    g.fillStyle = sky;
    g.fillRect(inner.x, inner.y, inner.w, inner.h);
    let s = 12345;
    const skyRand = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    for (let i = 0; i < 46; i += 1) {
      g.fillStyle = `rgba(255,255,255,${(0.35 + skyRand() * 0.6).toFixed(2)})`;
      g.fillRect(inner.x + skyRand() * inner.w, inner.y + skyRand() * inner.h * 0.7, 1.3, 1.3);
    }
    const mx = inner.x + inner.w * 0.68;
    const my = inner.y + inner.h * 0.24;
    const mr = inner.w * 0.12;
    const halo = g.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 4.5);
    halo.addColorStop(0, 'rgba(200,215,250,0.38)');
    halo.addColorStop(1, 'rgba(200,215,250,0)');
    g.fillStyle = halo;
    g.fillRect(inner.x, inner.y, inner.w, inner.h);
    g.fillStyle = '#f1ecd6';
    g.beginPath();
    g.arc(mx, my, mr, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(160,160,150,0.35)';
    for (const [ox, oy, rr] of [[-0.3, -0.2, 0.22], [0.25, 0.3, 0.16], [-0.1, 0.35, 0.12]] as const) {
      g.beginPath();
      g.arc(mx + ox * mr, my + oy * mr, rr * mr, 0, TAU);
      g.fill();
    }
    g.fillStyle = '#050c1a';
    g.beginPath();
    g.moveTo(inner.x, inner.y + inner.h);
    const roofs = 10;
    const tops: Pt[] = [];
    for (let i = 0; i <= roofs; i += 1) {
      const rx = inner.x + (inner.w / roofs) * i;
      const ry = inner.y + inner.h * (0.84 - skyRand() * 0.12);
      g.lineTo(rx, ry);
      g.lineTo(rx + inner.w / roofs / 2, ry - inner.h * (0.02 + skyRand() * 0.04));
      tops.push({ x: rx, y: ry });
    }
    g.lineTo(inner.x + inner.w, inner.y + inner.h);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,196,110,0.85)';
    for (const t of tops) {
      if (skyRand() < 0.5) g.fillRect(t.x + 3 + skyRand() * (inner.w / roofs - 8), t.y + 4 + skyRand() * inner.h * 0.08, 2, 2.5);
    }
    g.restore();
  };

  const top = cases[cases.length - 1];
  return {
    paintEmissive,
    beamB,
    floorY,
    window: { x0: inner.x, y0: inner.y, x1: inner.x + inner.w, y1: inner.y + inner.h },
    caseTop: { x: top.x, w: top.w, y: caseTop },
    fridge: { x: fridge.x, y: fridge.y, w: fridge.w, h: fridge.h, split: fridge.split },
  };
}
