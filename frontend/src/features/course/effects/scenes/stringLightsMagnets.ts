import { TAU, clamp } from './kit';

/**
 * The magnets on the little fridge of the string-lights room (stringLightsDecor.ts paints the fridge; owner: «малый
 * холодильник, на котором магнитики с разных стран наклеены и реагируют на свет … или зделай курсор просто линзой,
 * чтобы рассматривать крутые магнитики»). Plain 2D drawing, no ray tracing.
 *
 * Fourteen magnets, each a little picture of its country in its own shape (a flag, a coin, a cut-out bus, a pizza
 * slice, a holographic star…), drawn once into sprites at several times the screen's resolution — so they stay sharp
 * under the magnifying glass. Every frame they are lit by the room (the light falling on the fridge, sampled from the
 * baked picture) and by the cursor as a small lamp held in front: each magnet's domed resin shows a glint on the side
 * towards it (brighter the closer), its thickness throws a soft shadow away from it, and the holographic star turns
 * through the rainbow with the angle to it. Over the fridge the cursor is a magnifying glass (2.4×, a chrome rim, the
 * glass's own reflections and a handle).
 */

type Design = {
  /** Width and height in magnet units. */
  w: number;
  h: number;
  /** The outline (centred at 0, 0), in css px. */
  outline: (g: CanvasRenderingContext2D, w: number, h: number) => void;
  paint: (g: CanvasRenderingContext2D, w: number, h: number) => void;
  /** Domed glossy resin (a glint that moves) — or flat printed metal (a broad sheen). */
  dome: boolean;
  holo?: boolean;
};

const roundRect = (r: number) => (g: CanvasRenderingContext2D, w: number, h: number) => {
  g.beginPath();
  g.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) * r);
};
const circle = (g: CanvasRenderingContext2D, w: number) => {
  g.beginPath();
  g.arc(0, 0, w / 2, 0, TAU);
};
const label = (g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, stroke?: string) => {
  g.font = `800 ${size}px "Arial Narrow", Arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = size * 0.18;
    g.lineJoin = 'round';
    g.strokeText(text, x, y);
  }
  g.fillStyle = color;
  g.fillText(text, x, y);
};
const poly = (g: CanvasRenderingContext2D, pts: number[], color: string) => {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  g.fill();
};
const vgrad = (g: CanvasRenderingContext2D, h: number, stops: [number, string][]) => {
  const gr = g.createLinearGradient(0, -h / 2, 0, h / 2);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
};

const DESIGNS: Design[] = [
  // 0 Latvia: carmine-white-carmine (2:1:2), Riga's spires in white, «LATVIJA».
  {
    w: 1.35, h: 0.9, dome: true, outline: roundRect(0.14),
    paint: (g, w, h) => {
      g.fillStyle = '#9e3039';
      g.fillRect(-w / 2, -h / 2, w, h);
      g.fillStyle = '#f4efe6';
      g.fillRect(-w / 2, -h / 10, w, h / 5);
      // St Peter's spire, the Dom's tower, gables between.
      const b = -h / 10;
      g.fillStyle = 'rgba(246,238,226,0.92)';
      g.fillRect(-w * 0.36, b - h * 0.12, w * 0.12, h * 0.12);
      poly(g, [-w * 0.32, b - h * 0.12, -w * 0.3, b - h * 0.38, -w * 0.28, b - h * 0.12], 'rgba(246,238,226,0.92)');
      g.fillRect(w * 0.05, b - h * 0.2, w * 0.1, h * 0.2);
      poly(g, [w * 0.05, b - h * 0.2, w * 0.1, b - h * 0.3, w * 0.15, b - h * 0.2], 'rgba(246,238,226,0.92)');
      for (const gx of [-0.2, -0.08, 0.22, 0.32]) poly(g, [w * gx, b, w * gx, b - h * 0.08, w * (gx + 0.04), b - h * 0.14, w * (gx + 0.08), b - h * 0.08, w * (gx + 0.08), b], 'rgba(246,238,226,0.85)');
      label(g, 'LATVIJA', 0, h * 0.3, h * 0.24, '#f4efe6');
    },
  },
  // 1 Paris: a round coin, the tricolour round its rim, the Eiffel Tower.
  {
    w: 1.0, h: 1.0, dome: true, outline: (g, w) => circle(g, w),
    paint: (g, w) => {
      const r = w / 2;
      const cols = ['#1f3f8f', '#f2efe8', '#c8282e'];
      for (let k = 0; k < 3; k += 1) {
        g.fillStyle = cols[k];
        g.beginPath();
        g.moveTo(0, 0);
        g.arc(0, 0, r, -Math.PI / 2 + (k * TAU) / 3, -Math.PI / 2 + ((k + 1) * TAU) / 3);
        g.closePath();
        g.fill();
      }
      g.fillStyle = '#f1e6cf';
      g.beginPath();
      g.arc(0, 0, r * 0.8, 0, TAU);
      g.fill();
      const t = '#3b2a20';
      poly(g, [-r * 0.38, r * 0.55, -r * 0.08, -r * 0.1, 0, -r * 0.68, r * 0.08, -r * 0.1, r * 0.38, r * 0.55, r * 0.2, r * 0.55, 0, r * 0.18, -r * 0.2, r * 0.55], t);
      g.fillStyle = '#f1e6cf';
      g.beginPath();
      g.arc(0, r * 0.55, r * 0.16, Math.PI, 0);
      g.fill();
      g.fillStyle = t;
      g.fillRect(-r * 0.24, r * 0.12, r * 0.48, r * 0.05);
      g.fillRect(-r * 0.13, -r * 0.18, r * 0.26, r * 0.04);
      label(g, 'PARIS', 0, r * 0.66, r * 0.2, '#1f3f8f');
    },
  },
  // 2 London: a cut-out red double-decker.
  {
    w: 1.45, h: 0.85, dome: true,
    outline: (g, w, h) => {
      g.beginPath();
      g.roundRect(-w / 2, -h / 2, w, h * 0.86, h * 0.14);
    },
    paint: (g, w, h) => {
      const top = -h / 2, bh = h * 0.86;
      g.fillStyle = '#c4161c';
      g.beginPath();
      g.roundRect(-w / 2, top, w, bh, h * 0.14);
      g.fill();
      g.fillStyle = '#f0d9a8';
      g.fillRect(-w / 2, top + bh * 0.47, w, bh * 0.05);
      for (const row of [0.12, 0.55]) {
        for (let k = 0; k < 5; k += 1) {
          g.fillStyle = '#273447';
          g.fillRect(-w / 2 + w * (0.08 + k * 0.17), top + bh * row, w * 0.13, bh * 0.24);
          g.fillStyle = 'rgba(180,210,240,0.5)';
          g.fillRect(-w / 2 + w * (0.08 + k * 0.17), top + bh * row, w * 0.05, bh * 0.24);
        }
      }
      g.fillStyle = '#1a1a1a';
      for (const wx of [-0.3, 0.3]) {
        g.beginPath();
        g.arc(w * wx, top + bh, h * 0.13, 0, TAU);
        g.fill();
        g.fillStyle = '#9a9a9a';
        g.beginPath();
        g.arc(w * wx, top + bh, h * 0.05, 0, TAU);
        g.fill();
        g.fillStyle = '#1a1a1a';
      }
      label(g, 'LONDON', w * 0.06, top + bh * 0.89, bh * 0.15, '#ffffff');
    },
  },
  // 3 New York: the Statue of Liberty against a sunset, the skyline below.
  {
    w: 0.9, h: 1.25, dome: true, outline: roundRect(0.12),
    paint: (g, w, h) => {
      g.fillStyle = vgrad(g, h, [[0, '#ff7a3d'], [0.55, '#ffb35c'], [1, '#ff6f8f']]);
      g.fillRect(-w / 2, -h / 2, w, h);
      g.fillStyle = '#20213a';
      for (let k = 0; k < 9; k += 1) g.fillRect(-w / 2 + (w * k) / 9, h * (0.18 + ((k * 37) % 7) * 0.025), w / 9 + 0.5, h);
      const st = '#3f8f80';
      poly(g, [-w * 0.13, h * 0.38, -w * 0.08, -h * 0.05, w * 0.08, -h * 0.05, w * 0.13, h * 0.38], st);
      g.fillStyle = st;
      g.beginPath();
      g.arc(0, -h * 0.1, w * 0.07, 0, TAU);
      g.fill();
      for (let k = 0; k < 5; k += 1) {
        const a = -Math.PI / 2 + (k - 2) * 0.45;
        poly(g, [Math.cos(a - 0.12) * w * 0.06, -h * 0.1 + Math.sin(a - 0.12) * w * 0.06, Math.cos(a) * w * 0.14, -h * 0.1 + Math.sin(a) * w * 0.14, Math.cos(a + 0.12) * w * 0.06, -h * 0.1 + Math.sin(a + 0.12) * w * 0.06], st);
      }
      poly(g, [w * 0.06, -h * 0.02, w * 0.13, -h * 0.3, w * 0.18, -h * 0.28, w * 0.11, h * 0.0], st);
      poly(g, [w * 0.13, -h * 0.3, w * 0.155, -h * 0.4, w * 0.18, -h * 0.3], '#ffd84a');
      g.fillStyle = '#2b6f63';
      g.fillRect(-w * 0.18, h * 0.38, w * 0.36, h * 0.06);
      label(g, 'NEW YORK', 0, h * 0.44, h * 0.1, '#ffffff', 'rgba(20,20,40,0.6)');
    },
  },
  // 4 Japan: the red sun over Mount Fuji.
  {
    w: 1.0, h: 1.0, dome: true, outline: (g, w) => circle(g, w),
    paint: (g, w) => {
      const r = w / 2;
      g.fillStyle = '#f7f3ea';
      g.beginPath();
      g.arc(0, 0, r, 0, TAU);
      g.fill();
      g.fillStyle = '#d7263d';
      g.beginPath();
      g.arc(r * 0.28, -r * 0.3, r * 0.3, 0, TAU);
      g.fill();
      poly(g, [-r * 0.95, r * 0.45, -r * 0.18, -r * 0.25, r * 0.05, -r * 0.25, r * 0.95, r * 0.45], '#3a5f9e');
      poly(g, [-r * 0.32, -r * 0.1, -r * 0.18, -r * 0.25, r * 0.05, -r * 0.25, r * 0.2, -r * 0.08, r * 0.08, -r * 0.13, -r * 0.05, -r * 0.05, -r * 0.18, -r * 0.13], '#ffffff');
      g.fillStyle = '#2f7a4a';
      g.fillRect(-r, r * 0.45, w, r * 0.6);
      label(g, 'JAPAN', 0, r * 0.68, r * 0.22, '#ffffff');
    },
  },
  // 5 Italia: a pizza slice, crust up.
  {
    w: 1.05, h: 1.1, dome: true,
    outline: (g, w, h) => {
      g.beginPath();
      g.moveTo(-w / 2, -h * 0.32);
      g.quadraticCurveTo(0, -h * 0.62, w / 2, -h * 0.32);
      g.lineTo(0, h / 2);
      g.closePath();
    },
    paint: (g, w, h) => {
      g.fillStyle = '#c98a3e';
      g.beginPath();
      g.moveTo(-w / 2, -h * 0.32);
      g.quadraticCurveTo(0, -h * 0.62, w / 2, -h * 0.32);
      g.lineTo(0, h / 2);
      g.closePath();
      g.fill();
      g.fillStyle = '#f4c542';
      g.beginPath();
      g.moveTo(-w * 0.41, -h * 0.22);
      g.quadraticCurveTo(0, -h * 0.44, w * 0.41, -h * 0.22);
      g.lineTo(0, h * 0.42);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(255,240,170,0.6)';
      for (const [x, y, r] of [[-0.1, -0.12, 0.06], [0.12, 0.05, 0.05], [-0.02, 0.2, 0.04]]) {
        g.beginPath();
        g.arc(w * x, h * y, w * r, 0, TAU);
        g.fill();
      }
      for (const [x, y] of [[-0.18, -0.15], [0.14, -0.2], [0.02, 0.02], [-0.06, 0.2]]) {
        g.fillStyle = '#b3261e';
        g.beginPath();
        g.arc(w * x, h * y, w * 0.075, 0, TAU);
        g.fill();
        g.fillStyle = 'rgba(80,10,5,0.4)';
        g.beginPath();
        g.arc(w * x + w * 0.02, h * y + w * 0.02, w * 0.03, 0, TAU);
        g.fill();
      }
      g.fillStyle = '#2f7d32';
      g.beginPath();
      g.ellipse(w * 0.16, -h * 0.02, w * 0.06, w * 0.03, 0.6, 0, TAU);
      g.fill();
      label(g, 'ITALIA', 0, -h * 0.35, h * 0.12, '#fff3d6');
    },
  },
  // 6 Egypt: pyramids in the desert, the sun.
  {
    w: 1.3, h: 0.85, dome: true, outline: roundRect(0.12),
    paint: (g, w, h) => {
      g.fillStyle = vgrad(g, h, [[0, '#f6c25b'], [0.6, '#f8dc94'], [0.62, '#e2b468'], [1, '#c8904a']]);
      g.fillRect(-w / 2, -h / 2, w, h);
      g.fillStyle = '#fff6d8';
      g.beginPath();
      g.arc(w * 0.3, -h * 0.22, h * 0.12, 0, TAU);
      g.fill();
      const base = h * 0.12;
      for (const [cx, s] of [[-0.18, 0.42], [0.12, 0.3], [-0.38, 0.22]]) {
        poly(g, [w * (cx - s * 0.6), base, w * cx, base - h * s, w * (cx + s * 0.1), base], '#d99b4a');
        poly(g, [w * cx, base - h * s, w * (cx + s * 0.6), base, w * (cx + s * 0.1), base], '#a8692d');
      }
      label(g, 'EGYPT', 0, h * 0.32, h * 0.2, '#6b3410');
    },
  },
  // 7 Australia: a kangaroo against the outback sunset.
  {
    w: 0.95, h: 0.95, dome: true, outline: (g, w) => circle(g, w),
    paint: (g, w) => {
      const r = w / 2;
      const gr = g.createRadialGradient(0, r * 0.2, r * 0.1, 0, r * 0.2, r);
      gr.addColorStop(0, '#ffe08a');
      gr.addColorStop(0.5, '#ff8c3a');
      gr.addColorStop(1, '#b8331f');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(0, 0, r, 0, TAU);
      g.fill();
      const k = '#1c0f0a';
      g.fillStyle = k;
      g.fillRect(-r, r * 0.45, w, r);
      g.beginPath();
      g.ellipse(-r * 0.02, r * 0.12, r * 0.28, r * 0.18, -0.5, 0, TAU);
      g.fill();
      g.beginPath();
      g.ellipse(r * 0.22, -r * 0.18, r * 0.11, r * 0.08, -0.3, 0, TAU);
      g.fill();
      poly(g, [r * 0.18, -r * 0.24, r * 0.2, -r * 0.4, r * 0.25, -r * 0.26], k);
      poly(g, [-r * 0.22, r * 0.2, -r * 0.7, r * 0.45, -r * 0.62, r * 0.48, -r * 0.15, r * 0.3], k);
      poly(g, [-r * 0.05, r * 0.25, r * 0.15, r * 0.45, r * 0.32, r * 0.47, r * 0.1, r * 0.3], k);
      label(g, 'AUSTRALIA', 0, r * 0.68, r * 0.17, '#ffd27a');
    },
  },
  // 8 Kyiv: the blue and yellow flag with a sunflower.
  {
    w: 1.2, h: 0.8, dome: false, outline: roundRect(0.06),
    paint: (g, w, h) => {
      g.fillStyle = '#0057b7';
      g.fillRect(-w / 2, -h / 2, w, h / 2);
      g.fillStyle = '#ffd700';
      g.fillRect(-w / 2, 0, w, h / 2);
      const cx = w * 0.25, cy = 0, pr = h * 0.2;
      for (let k = 0; k < 14; k += 1) {
        const a = (k / 14) * TAU;
        g.fillStyle = k % 2 ? '#ffb000' : '#ffcf26';
        g.beginPath();
        g.ellipse(cx + Math.cos(a) * pr, cy + Math.sin(a) * pr, pr * 0.55, pr * 0.22, a, 0, TAU);
        g.fill();
      }
      g.fillStyle = '#5a3412';
      g.beginPath();
      g.arc(cx, cy, pr * 0.62, 0, TAU);
      g.fill();
      label(g, 'KYIV', -w * 0.18, -h * 0.25, h * 0.26, '#ffffff');
    },
  },
  // 9 Greece: Santorini's white houses and blue domes over the sea.
  {
    w: 1.25, h: 0.9, dome: true, outline: roundRect(0.14),
    paint: (g, w, h) => {
      g.fillStyle = vgrad(g, h, [[0, '#7cc8f2'], [0.45, '#bfe6fa'], [0.46, '#1d6fb0'], [1, '#0d4f8a']]);
      g.fillRect(-w / 2, -h / 2, w, h);
      g.fillStyle = '#f7f7f2';
      g.fillRect(-w / 2, -h * 0.02, w * 0.75, h * 0.35);
      for (const [x, y, s] of [[-0.35, -0.05, 0.12], [-0.12, -0.12, 0.14], [0.12, -0.02, 0.1]]) {
        g.fillStyle = '#f7f7f2';
        g.fillRect(w * (x - s / 2), h * y, w * s, h * 0.2);
        g.fillStyle = '#1f5fc4';
        g.beginPath();
        g.arc(w * x, h * y, w * s * 0.5, Math.PI, 0);
        g.fill();
        g.fillStyle = '#f7f7f2';
        g.fillRect(w * x - 0.6, h * y - w * s * 0.75, 1.2, w * s * 0.25);
      }
      g.fillStyle = '#4a6b8a';
      for (let k = 0; k < 6; k += 1) g.fillRect(-w * 0.45 + k * w * 0.1, h * 0.12, w * 0.03, h * 0.05);
      label(g, 'GREECE', w * 0.18, h * 0.33, h * 0.18, '#ffffff');
    },
  },
  // 10 Brasil: the green flag, the yellow rhombus, the blue globe with its band.
  {
    w: 1.2, h: 0.84, dome: false, outline: roundRect(0.06),
    paint: (g, w, h) => {
      g.fillStyle = '#009c3b';
      g.fillRect(-w / 2, -h / 2, w, h);
      poly(g, [-w * 0.42, 0, 0, -h * 0.4, w * 0.42, 0, 0, h * 0.4], '#ffdf00');
      g.fillStyle = '#002776';
      g.beginPath();
      g.arc(0, 0, h * 0.21, 0, TAU);
      g.fill();
      g.strokeStyle = '#ffffff';
      g.lineWidth = h * 0.04;
      g.beginPath();
      g.arc(0, h * 0.35, h * 0.38, -Math.PI * 0.68, -Math.PI * 0.32);
      g.stroke();
      g.fillStyle = '#ffffff';
      for (const [x, y] of [[-0.06, 0.06], [0.04, 0.1], [0.08, 0.02], [-0.02, 0.12]]) g.fillRect(w * x, h * y, 1.2, 1.2);
    },
  },
  // 11 India: the Taj Mahal in white against a rose dusk.
  {
    w: 0.95, h: 1.2, dome: true, outline: roundRect(0.12),
    paint: (g, w, h) => {
      g.fillStyle = vgrad(g, h, [[0, '#f59ab3'], [0.6, '#ffd1a1'], [0.61, '#9fd3e0'], [1, '#5fa6c0']]);
      g.fillRect(-w / 2, -h / 2, w, h);
      const t = '#fbf7f0';
      const b = h * 0.22;
      g.fillStyle = t;
      g.fillRect(-w * 0.3, b - h * 0.2, w * 0.6, h * 0.2);
      g.beginPath();
      g.ellipse(0, b - h * 0.24, w * 0.17, h * 0.13, 0, Math.PI, 0);
      g.fill();
      g.fillRect(-w * 0.17, b - h * 0.24, w * 0.34, h * 0.04);
      poly(g, [-w * 0.01, b - h * 0.37, 0, b - h * 0.44, w * 0.01, b - h * 0.37], t);
      for (const mx of [-0.4, 0.4]) {
        g.fillRect(w * mx - w * 0.025, b - h * 0.36, w * 0.05, h * 0.36);
        g.beginPath();
        g.arc(w * mx, b - h * 0.36, w * 0.04, Math.PI, 0);
        g.fill();
      }
      g.fillStyle = 'rgba(60,40,60,0.35)';
      g.beginPath();
      g.ellipse(0, b - h * 0.07, w * 0.06, h * 0.08, 0, Math.PI, 0);
      g.fill();
      g.fillRect(-w * 0.06, b - h * 0.07, w * 0.12, h * 0.07);
      g.fillStyle = 'rgba(251,247,240,0.35)';
      g.fillRect(-w * 0.3, b + h * 0.02, w * 0.6, h * 0.12);
      label(g, 'INDIA', 0, h * 0.42, h * 0.12, '#7a1f4a');
    },
  },
  // 12 Holland: a windmill over a row of tulips.
  {
    w: 0.95, h: 0.95, dome: true, outline: (g, w) => circle(g, w),
    paint: (g, w) => {
      const r = w / 2;
      g.fillStyle = vgrad(g, w, [[0, '#9fd2f5'], [1, '#e6f4fb']]);
      g.beginPath();
      g.arc(0, 0, r, 0, TAU);
      g.fill();
      for (let k = 0; k < 7; k += 1) {
        g.fillStyle = k % 2 ? '#e8343f' : '#ffb21f';
        const x = -r * 0.85 + k * r * 0.28;
        g.beginPath();
        g.ellipse(x, r * 0.55, r * 0.09, r * 0.12, 0, 0, TAU);
        g.fill();
      }
      g.fillStyle = '#3d8a3a';
      g.fillRect(-r, r * 0.66, w, r * 0.4);
      poly(g, [-r * 0.18, r * 0.5, -r * 0.1, -r * 0.1, r * 0.1, -r * 0.1, r * 0.18, r * 0.5], '#8a5a3a');
      poly(g, [-r * 0.14, -r * 0.1, 0, -r * 0.3, r * 0.14, -r * 0.1], '#5a3a26');
      g.strokeStyle = '#f2ead8';
      g.lineWidth = r * 0.07;
      for (let k = 0; k < 4; k += 1) {
        const a = 0.5 + (k * TAU) / 4;
        g.beginPath();
        g.moveTo(0, -r * 0.2);
        g.lineTo(Math.cos(a) * r * 0.62, -r * 0.2 + Math.sin(a) * r * 0.62);
        g.stroke();
      }
      label(g, 'HOLLAND', 0, r * 0.8, r * 0.17, '#ffffff');
    },
  },
  // 13 A holographic star (drawn live: its colours turn with the light).
  {
    w: 0.85, h: 0.85, dome: false, holo: true,
    outline: (g, w) => {
      g.beginPath();
      for (let k = 0; k < 10; k += 1) {
        const a = -Math.PI / 2 + (k * TAU) / 10;
        const rr = (k % 2 ? 0.42 : 1) * (w / 2);
        if (k === 0) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.closePath();
    },
    paint: (g, w, h) => {
      g.fillStyle = vgrad(g, h, [[0, '#e9edf2'], [1, '#9aa3ad']]);
      g.fill();
    },
  },
];

/** Where each design sits on the fridge (fractions of its box) and how it is turned. */
const PLACES: [number, number, number, number][] = [
  // [design, x, y, rotation]
  [0, 0.3, 0.14, -0.08], [4, 0.66, 0.15, 0.1], [13, 0.48, 0.24, 0.2],
  [2, 0.32, 0.41, 0.05], [1, 0.68, 0.43, -0.12],
  [3, 0.2, 0.57, -0.1], [5, 0.5, 0.55, 0.15], [9, 0.75, 0.57, 0.07],
  [6, 0.27, 0.7, 0.04], [12, 0.54, 0.68, -0.06], [7, 0.78, 0.71, 0.12],
  [8, 0.24, 0.82, -0.05], [11, 0.52, 0.81, 0.08], [10, 0.77, 0.83, -0.1],
];

export type FridgeBox = { x: number; y: number; w: number; h: number; split: number };

export function createFridgeMagnets(box: FridgeBox, dpr: number) {
  const unit = box.w * 0.27;
  // Sprites at several times the screen's scale: sharp under the 2.4× glass.
  const S = Math.max(2, dpr) * 2.6;
  const magnets = PLACES.map(([d, fx, fy, rot]) => {
    const design = DESIGNS[d];
    const w = design.w * unit;
    const h = design.h * unit;
    const pad = 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil((w + pad * 2) * S);
    canvas.height = Math.ceil((h + pad * 2) * S);
    const g = canvas.getContext('2d')!;
    g.setTransform(S, 0, 0, S, (w / 2 + pad) * S, (h / 2 + pad) * S);
    if (!design.holo) {
      // The picture, clipped to its shape; a printed edge; the resin's dome (lighter top left, a rim of thickness).
      g.save();
      design.outline(g, w, h);
      g.clip();
      design.paint(g, w, h);
      if (design.dome) {
        const sheen = g.createRadialGradient(-w * 0.25, -h * 0.3, 0, -w * 0.1, -h * 0.1, Math.max(w, h) * 0.75);
        sheen.addColorStop(0, 'rgba(255,255,255,0.28)');
        sheen.addColorStop(0.5, 'rgba(255,255,255,0.06)');
        sheen.addColorStop(1, 'rgba(0,0,0,0.12)');
        g.fillStyle = sheen;
        g.fillRect(-w, -h, w * 2, h * 2);
      }
      g.restore();
      design.outline(g, w, h);
      g.strokeStyle = 'rgba(20,14,10,0.55)';
      g.lineWidth = 1.1;
      g.stroke();
      g.save();
      design.outline(g, w, h);
      g.clip();
      design.outline(g, w, h);
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 1.6;
      g.translate(-0.6, -0.6);
      g.stroke();
      g.restore();
    }
    return { design, x: box.x + box.w * fx, y: box.y + box.h * fy, rot, w, h, pad, canvas };
  });

  const draw = (g: CanvasRenderingContext2D, light: { x: number; y: number; on: boolean }, tint: [number, number, number], time: number) => {
    // The room's light on the fridge (its picture over the enamel's own colour): multiplied into every magnet.
    const mul = `rgb(${tint.map((v) => Math.round(clamp(v, 0, 1) * 255)).join(',')})`;
    for (const m of magnets) {
      // The cursor as a small lamp held a little in front (height 2.5 units): its direction and strength here.
      const dx = light.x - m.x;
      const dy = light.y - m.y;
      const dist = Math.hypot(dx, dy) || 1;
      const hgt = unit * 2.5;
      const near = light.on ? (hgt * hgt) / (dist * dist + hgt * hgt) : 0;
      const ux = dx / dist, uy = dy / dist;
      g.save();
      g.translate(m.x, m.y);
      g.rotate(m.rot);
      // The thickness's shadow: always a little down and right (the room's light), more and away from the cursor.
      const sx = 0.8 - ux * near * 3.2;
      const sy = 1.2 - uy * near * 3.2;
      g.shadowColor = `rgba(0,0,0,${(0.35 + 0.25 * near).toFixed(3)})`;
      g.shadowBlur = 2.5 + near * 2;
      g.shadowOffsetX = sx * Math.cos(m.rot) + sy * Math.sin(m.rot);
      g.shadowOffsetY = -sx * Math.sin(m.rot) + sy * Math.cos(m.rot);
      if (m.design.holo) {
        // Holographic foil: a conic rainbow turned by the angle to the light, brighter with it.
        m.design.outline(g, m.w, m.h);
        const ang = Math.atan2(dy, dx) + time * 0.15;
        const holo = typeof g.createConicGradient === 'function' ? g.createConicGradient(ang, 0, 0) : g.createLinearGradient(-m.w / 2, 0, m.w / 2, 0);
        const hues = [0, 60, 120, 180, 240, 300, 360];
        hues.forEach((hue, i) => holo.addColorStop(i / (hues.length - 1), `hsl(${hue},85%,${(62 + 18 * near).toFixed(0)}%)`));
        g.fillStyle = holo;
        g.fill();
        g.shadowColor = 'transparent';
        g.strokeStyle = 'rgba(255,255,255,0.7)';
        g.lineWidth = 1;
        g.stroke();
      } else {
        g.drawImage(m.canvas, -m.w / 2 - m.pad, -m.h / 2 - m.pad, m.w + m.pad * 2, m.h + m.pad * 2);
      }
      g.shadowColor = 'transparent';
      // The room's light on it (the warm garland, dim when the lamps are off).
      g.save();
      m.design.outline(g, m.w, m.h);
      g.clip();
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = mul;
      g.fillRect(-m.w, -m.h, m.w * 2, m.h * 2);
      // The cursor's glint: on a dome it slides towards the light; on flat print a broad sheen.
      if (near > 0.02) {
        g.globalCompositeOperation = 'lighter';
        const lx = m.design.dome ? (ux * Math.cos(m.rot) + uy * Math.sin(m.rot)) * Math.min(m.w, m.h) * 0.32 * (dist / (dist + hgt * 0.5)) : 0;
        const ly = m.design.dome ? (-ux * Math.sin(m.rot) + uy * Math.cos(m.rot)) * Math.min(m.w, m.h) * 0.32 * (dist / (dist + hgt * 0.5)) : 0;
        const r = Math.min(m.w, m.h) * (m.design.dome ? 0.22 : 0.6);
        const glint = g.createRadialGradient(lx, ly, 0, lx, ly, r);
        glint.addColorStop(0, `rgba(255,248,235,${(0.85 * near).toFixed(3)})`);
        glint.addColorStop(m.design.dome ? 0.35 : 0.5, `rgba(255,240,220,${(0.25 * near).toFixed(3)})`);
        glint.addColorStop(1, 'rgba(255,240,220,0)');
        g.fillStyle = glint;
        g.fillRect(-m.w, -m.h, m.w * 2, m.h * 2);
      }
      g.restore();
      g.restore();
    }
  };

  return {
    /** The fridge's box (for the glass: over it the cursor magnifies). */
    contains(x: number, y: number) {
      return x >= box.x - unit * 0.3 && x <= box.x + box.w + unit * 0.3 && y >= box.y - unit * 0.3 && y <= box.y + box.h + unit * 0.2;
    },
    draw,
    /**
     * The magnifying glass at (x, y): what is under it 2.4× larger (the room's picture and the magnets drawn sharp from
     * their sprites), a chrome rim, the glass's reflections and a handle.
     */
    drawLens(g: CanvasRenderingContext2D, x: number, y: number, room: (g: CanvasRenderingContext2D) => void, tint: [number, number, number], time: number) {
      const R = clamp(box.w * 0.46, 46, 120);
      const Z = 2.4;
      // The handle, behind the rim, down and right.
      const ha = Math.PI * 0.25;
      g.save();
      g.lineCap = 'round';
      g.strokeStyle = '#2a1a10';
      g.lineWidth = R * 0.22;
      g.beginPath();
      g.moveTo(x + Math.cos(ha) * R * 1.05, y + Math.sin(ha) * R * 1.05);
      g.lineTo(x + Math.cos(ha) * R * 2.1, y + Math.sin(ha) * R * 2.1);
      g.stroke();
      g.strokeStyle = 'rgba(255,220,180,0.25)';
      g.lineWidth = R * 0.05;
      g.beginPath();
      g.moveTo(x + Math.cos(ha) * R * 1.15 - R * 0.05, y + Math.sin(ha) * R * 1.15);
      g.lineTo(x + Math.cos(ha) * R * 2.0 - R * 0.05, y + Math.sin(ha) * R * 2.0);
      g.stroke();
      g.restore();
      // Inside the glass.
      g.save();
      g.beginPath();
      g.arc(x, y, R, 0, TAU);
      g.clip();
      g.translate(x, y);
      g.scale(Z, Z);
      g.translate(-x, -y);
      room(g);
      draw(g, { x, y, on: true }, tint, time);
      g.restore();
      // The glass: darker towards its edge, a curved reflection top left, a small bright one.
      g.save();
      const edge = g.createRadialGradient(x, y, R * 0.7, x, y, R);
      edge.addColorStop(0, 'rgba(0,0,0,0)');
      edge.addColorStop(1, 'rgba(10,20,30,0.35)');
      g.fillStyle = edge;
      g.beginPath();
      g.arc(x, y, R, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = R * 0.07;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(x, y, R * 0.8, Math.PI * 1.08, Math.PI * 1.42);
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.beginPath();
      g.arc(x - R * 0.45, y - R * 0.5, R * 0.05, 0, TAU);
      g.fill();
      // The chrome rim.
      const rim = typeof g.createConicGradient === 'function' ? g.createConicGradient(-0.8, x, y) : g.createLinearGradient(x - R, y - R, x + R, y + R);
      for (const [o, c] of [[0, '#f4f6fa'], [0.2, '#8a9099'], [0.45, '#e2e6ec'], [0.7, '#6d737c'], [1, '#f4f6fa']] as const) rim.addColorStop(o, c);
      g.strokeStyle = rim;
      g.lineWidth = Math.max(3, R * 0.09);
      g.beginPath();
      g.arc(x, y, R, 0, TAU);
      g.stroke();
      g.restore();
    },
  };
}

export type FridgeMagnets = ReturnType<typeof createFridgeMagnets>;
