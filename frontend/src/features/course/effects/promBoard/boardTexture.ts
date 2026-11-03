import { BOARD, NETS, PARTS, packagePins, pinAt, type Part } from './layout';
import routesJson from './routes.json';

/**
 * Raster maps of the board, in board millimetres × `ppm` pixels (y up: row 0 is the back edge, as the texture is
 * sampled with v = 1 − y/h):
 *
 *   surface (RGBA8, filtered)  R top copper (traces, pads, the GND pour with thermal reliefs), G silkscreen,
 *                              B bare metal (tinned pads and vias — no solder mask there), A board (0 = drilled hole)
 *   bottom  (RGBA8, filtered)  R bottom copper, B bare metal, A board
 *   nets    (RGBA8, nearest)   R net index + 1 of the top copper, G its arc position (mm × 10, mod 256),
 *                              B, A the same for the bottom
 *
 * Copper coverage is drawn with Canvas 2D (antialiased); net indices are rasterised by hand, so that edges never
 * blend two indices.
 */

type Route = { name: string; width: number; segments: { layer: number; s0: number; pts: number[] }[]; vias: number[][] };
type Pad = { key: string; x: number; y: number; r: number; net: string | null };
const routes = routesJson as unknown as { nets: Route[]; pads: Pad[] };

export const NET_INDEX = new Map(NETS.map((n, i) => [n.name, i]));
export const ROUTES = routes;
const CLEAR = 0.45;
const HOLES = [[4, 4], [BOARD.w - 4, 4], [4, BOARD.h - 4], [BOARD.w - 4, BOARD.h - 4]];

export type BoardMaps = { width: number; height: number; ppm: number; surface: Uint8Array<ArrayBuffer>; bottom: Uint8Array<ArrayBuffer>; nets: Uint8Array<ArrayBuffer> };

/** Pad shape of a pin: DIP pads are ovals across the row, the rest round. */
const padShape = (pad: Pad): { rx: number; ry: number } => {
  const ref = pad.key.split('.')[0];
  const part = PARTS.find((p) => p.ref === ref)!;
  if (part.pkg.kind === 'dip') return { rx: 0.8, ry: 1.1 };
  return { rx: pad.r, ry: pad.r };
};

const drillOf = (pad: Pad) => (pad.r > 2 ? 3.2 : pad.r > 1.1 ? 1.2 : 0.8);

/** Silkscreen outline of a part, in its own (unrotated) frame. */
function outline(g: CanvasRenderingContext2D, part: Part) {
  const k = part.pkg;
  const rect = (w: number, h: number, ox = 0, oy = 0) => g.strokeRect(ox - w / 2, oy - h / 2, w, h);
  g.beginPath();
  switch (k.kind) {
    case 'dip': {
      const len = (k.pins / 2) * 2.54 + 0.6;
      rect(len, k.row - 2.2);
      g.beginPath();
      g.arc(-len / 2, 0, 0.9, -Math.PI / 2, Math.PI / 2);
      g.stroke();
      if (k.socket) rect(len + 2.2, k.row + 2.6);
      break;
    }
    case 'axial':
      rect(k.body === 'mlt' ? 6.6 : 4.2, k.body === 'mlt' ? 2.6 : 2.2);
      g.beginPath();
      g.moveTo(-k.pitch / 2 + 0.9, 0);
      g.lineTo(k.body === 'mlt' ? -3.3 : -2.1, 0);
      g.moveTo(k.pitch / 2 - 0.9, 0);
      g.lineTo(k.body === 'mlt' ? 3.3 : 2.1, 0);
      g.stroke();
      if (k.body === 'glass') {
        g.beginPath();
        g.moveTo(1.4, -1.1);
        g.lineTo(1.4, 1.1);
        g.stroke();
      }
      break;
    case 'kt13':
      g.beginPath();
      g.moveTo(-3.6, -1.2);
      g.lineTo(3.6, -1.2);
      g.lineTo(3.6, 1.6);
      g.lineTo(-3.6, 1.6);
      g.closePath();
      g.stroke();
      break;
    case 'to39':
      g.beginPath();
      g.arc(0, 0, 4.8, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.moveTo(-3.4, -3.4);
      g.lineTo(-4.4, -4.4);
      g.stroke();
      break;
    case 'to126':
      rect(8.2, 3.2, 0, 0.4);
      break;
    case 'radial':
      g.beginPath();
      g.arc(0, 0, k.d / 2 + 0.3, 0, Math.PI * 2);
      g.stroke();
      g.font = '2px sans-serif';
      g.fillText('+', -k.pitch / 2 - 2.4, -1.2);
      break;
    case 'ceramic':
      rect(5.4, 2.6);
      break;
    case 'led':
      g.beginPath();
      g.arc(0, 0, 3, 0.35, Math.PI * 2 - 0.35);
      g.stroke();
      break;
    case 'pot':
      g.beginPath();
      g.arc(0, 1.5, 8.2, 0, Math.PI * 2);
      g.stroke();
      break;
    case 'toggle':
      rect(k.poles === 3 ? 13 : 8.4, 7.2);
      break;
    case 'bridge':
      rect(18.5, 6);
      break;
    case 'triac': {
      g.beginPath();
      for (let s = 0; s < 6; s += 1) {
        const a = (s * Math.PI) / 3 + Math.PI / 6;
        const f = s === 0 ? 'moveTo' : 'lineTo';
        g[f](Math.cos(a) * 6.3, Math.sin(a) * 6.3);
      }
      g.closePath();
      g.stroke();
      break;
    }
    case 'xfmrSmall':
      rect(14.5, 12.5);
      break;
    case 'xfmrPower':
      rect(41, 33);
      break;
    case 'terminal':
      rect(k.pins * 5.08 + 0.6, 8.4);
      break;
    case 'jack':
      rect(10, 12.5);
      break;
  }
}

/** Rasterise a capsule (a copper run) into the index map: net + arc position. */
function capsule(ids: Uint8Array, W: number, H: number, ppm: number, x0: number, y0: number, x1: number, y1: number, r: number, id: number, s0: number, ch: number) {
  const minX = Math.max(0, Math.floor((Math.min(x0, x1) - r) * ppm)), maxX = Math.min(W - 1, Math.ceil((Math.max(x0, x1) + r) * ppm));
  const minY = Math.max(0, Math.floor((Math.min(y0, y1) - r) * ppm)), maxY = Math.min(H - 1, Math.ceil((Math.max(y0, y1) + r) * ppm));
  const dx = x1 - x0, dy = y1 - y0;
  const len2 = dx * dx + dy * dy || 1e-9;
  const len = Math.sqrt(len2);
  for (let py = minY; py <= maxY; py += 1) {
    const y = (py + 0.5) / ppm;
    for (let px = minX; px <= maxX; px += 1) {
      const x = (px + 0.5) / ppm;
      const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / len2));
      const ex = x0 + dx * t - x, ey = y0 + dy * t - y;
      if (ex * ex + ey * ey > r * r) continue;
      const o = ((H - 1 - py) * W + px) * 4 + ch;
      ids[o] = id;
      ids[o + 1] = Math.round((s0 + t * len) * 10) & 255;
    }
  }
}

export function buildBoardMaps(ppm = 12): BoardMaps {
  const W = Math.round(BOARD.w * ppm);
  const H = Math.round(BOARD.h * ppm);
  const layer = (draw: (g: CanvasRenderingContext2D) => void) => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    // Board millimetres, y up.
    g.setTransform(ppm, 0, 0, -ppm, 0, H);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    draw(g);
    return g.getImageData(0, 0, W, H).data;
  };
  const padsOf = (pred: (p: Pad) => boolean) => routes.pads.filter(pred);
  const drawPad = (g: CanvasRenderingContext2D, pad: Pad, grow = 0) => {
    const { rx, ry } = padShape(pad);
    g.beginPath();
    g.ellipse(pad.x, pad.y, rx + grow, ry + grow, 0, 0, Math.PI * 2);
    g.fill();
  };
  const drawRuns = (g: CanvasRenderingContext2D, lyr: number, grow: number, pred: (r: Route) => boolean) => {
    for (const r of routes.nets) {
      if (!pred(r)) continue;
      g.lineWidth = r.width + grow * 2;
      for (const s of r.segments) {
        if (s.layer !== lyr) continue;
        g.beginPath();
        g.moveTo(s.pts[0], s.pts[1]);
        for (let k = 2; k < s.pts.length; k += 2) g.lineTo(s.pts[k], s.pts[k + 1]);
        g.stroke();
      }
      for (const [vx, vy] of r.vias) {
        g.beginPath();
        g.arc(vx, vy, 0.55 + grow, 0, Math.PI * 2);
        g.fill();
      }
    }
  };
  /** One copper layer: the GND pour with clearances and thermal spokes, then everything else. */
  const copper = (lyr: number) => layer((g) => {
    g.fillStyle = '#fff';
    g.strokeStyle = '#fff';
    g.fillRect(1, 1, BOARD.w - 2, BOARD.h - 2);
    g.globalCompositeOperation = 'destination-out';
    drawRuns(g, lyr, CLEAR, () => true);
    for (const pad of padsOf((p) => p.net !== 'GND')) drawPad(g, pad, CLEAR);
    for (const pad of padsOf((p) => p.net === 'GND')) drawPad(g, pad, CLEAR);
    for (const [hx, hy] of HOLES) {
      g.beginPath();
      g.arc(hx, hy, 3.6, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    drawRuns(g, lyr, 0, () => true);
    for (const pad of routes.pads) drawPad(g, pad);
    // Thermal reliefs: four spokes from each GND pad into the pour.
    g.lineWidth = 0.5;
    for (const pad of padsOf((p) => p.net === 'GND')) {
      const { rx, ry } = padShape(pad);
      g.beginPath();
      g.moveTo(pad.x - rx - CLEAR - 0.2, pad.y);
      g.lineTo(pad.x + rx + CLEAR + 0.2, pad.y);
      g.moveTo(pad.x, pad.y - ry - CLEAR - 0.2);
      g.lineTo(pad.x, pad.y + ry + CLEAR + 0.2);
      g.stroke();
    }
    // Mounting holes: a copper ring.
    for (const [hx, hy] of HOLES) {
      g.beginPath();
      g.arc(hx, hy, 3, 0, Math.PI * 2);
      g.fill();
    }
  });
  const bare = layer((g) => {
    g.fillStyle = '#fff';
    for (const pad of routes.pads) drawPad(g, pad);
    for (const r of routes.nets) {
      for (const [vx, vy] of r.vias) {
        g.beginPath();
        g.arc(vx, vy, 0.55, 0, Math.PI * 2);
        g.fill();
      }
    }
    for (const [hx, hy] of HOLES) {
      g.beginPath();
      g.arc(hx, hy, 3, 0, Math.PI * 2);
      g.fill();
    }
  });
  const holes = layer((g) => {
    g.fillStyle = '#fff';
    g.fillRect(0, 0, BOARD.w, BOARD.h);
    g.fillStyle = '#000';
    for (const pad of routes.pads) {
      g.beginPath();
      g.arc(pad.x, pad.y, drillOf(pad) / 2, 0, Math.PI * 2);
      g.fill();
    }
    for (const r of routes.nets) {
      for (const [vx, vy] of r.vias) {
        g.beginPath();
        g.arc(vx, vy, 0.25, 0, Math.PI * 2);
        g.fill();
      }
    }
    for (const [hx, hy] of HOLES) {
      g.beginPath();
      g.arc(hx, hy, 1.6, 0, Math.PI * 2);
      g.fill();
    }
  });
  const silk = layer((g) => {
    g.strokeStyle = '#fff';
    g.fillStyle = '#fff';
    g.lineWidth = 0.2;
    for (const part of PARTS) {
      g.save();
      g.translate(part.x, part.y);
      g.rotate((part.rot * Math.PI) / 180);
      outline(g, part);
      g.restore();
      // The reference, upright, beside the part.
      g.save();
      const pins = Object.values(packagePins(part.pkg));
      const ys = pins.map((p) => p[1]);
      const off = part.pkg.kind === 'dip' ? 0 : Math.max(2.2, Math.max(...ys.map(Math.abs)) + 2.2);
      g.translate(part.x, part.y + (part.pkg.kind === 'dip' ? 0 : -off));
      g.scale(1, -1);
      g.font = `${part.pkg.kind === 'dip' ? 1.8 : 1.5}px sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      if (part.pkg.kind === 'dip') g.fillText(part.ref, 0, 0);
      else if (part.pkg.kind === 'axial' && part.rot === 90) {
        g.translate(1.9, off);
        g.fillText(part.ref, 0, 0);
      } else g.fillText(part.ref, 0, 0);
      g.restore();
    }
    // Captions.
    const text = (s: string, x: number, y: number, size: number, align: CanvasTextAlign = 'center') => {
      g.save();
      g.translate(x, y);
      g.scale(1, -1);
      g.font = `bold ${size}px sans-serif`;
      g.textAlign = align;
      g.textBaseline = 'middle';
      g.fillText(s, 0, 0);
      g.restore();
    };
    text('АВТОМАТ СВЕТОВЫХ ЭФФЕКТОВ НА ППЗУ', 95, 122.3, 2.4);
    text('Радиохобби 6/98 · В. Василенко', 95, 1.6, 1.6);
    text('ДЕЛИТЕЛЬ', 12, 16.5, 1.3);
    text('ИСТОЧНИК', 26, 16.5, 1.3);
    text('РЕЖИМ', 40, 16.5, 1.3);
    text('ПОВТОР', 54, 16.5, 1.3);
    text('СЕТЬ', 180, 16.5, 1.3);
    text('СКОРОСТЬ', 14, 43.5, 1.3);
    text('~220 В  ОПАСНО', 160, 112.5, 1.5);
    text('+5 В', 150, 81, 1.3);
    for (let k = 0; k < 8; k += 1) text(String(k + 1), 64 + k * 10.5, 10.2, 1.4);
  });
  const bottomCopper = copper(1);
  const topCopper = copper(0);
  const surface = new Uint8Array(W * H * 4);
  const bottom = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i += 1) {
    const o = i * 4;
    surface[o] = topCopper[o + 3];
    surface[o + 1] = silk[o + 3];
    surface[o + 2] = bare[o + 3];
    surface[o + 3] = holes[o];
    bottom[o] = bottomCopper[o + 3];
    bottom[o + 2] = bare[o + 3];
    bottom[o + 3] = holes[o];
  }
  // Net indices and arc positions.
  const nets = new Uint8Array(W * H * 4);
  for (const r of routes.nets) {
    const id = (NET_INDEX.get(r.name) ?? -1) + 1;
    if (!id) continue;
    for (const s of r.segments) {
      let s0 = s.s0;
      for (let k = 0; k + 3 < s.pts.length; k += 2) {
        const len = Math.hypot(s.pts[k + 2] - s.pts[k], s.pts[k + 3] - s.pts[k + 1]);
        capsule(nets, W, H, ppm, s.pts[k], s.pts[k + 1], s.pts[k + 2], s.pts[k + 3], r.width / 2, id, s0, s.layer === 0 ? 0 : 2);
        s0 += len;
      }
    }
    for (const [vx, vy] of r.vias) for (const ch of [0, 2]) capsule(nets, W, H, ppm, vx, vy, vx, vy, 0.55, id, 0, ch);
  }
  for (const pad of routes.pads) {
    if (!pad.net) continue;
    const id = (NET_INDEX.get(pad.net) ?? -1) + 1;
    const { rx, ry } = padShape(pad);
    for (const ch of [0, 2]) capsule(nets, W, H, ppm, pad.x, pad.y - (ry - rx), pad.x, pad.y + (ry - rx), rx, id, 0, ch);
  }
  // The GND pour carries GND's index wherever there is copper not claimed by another net.
  const gnd = (NET_INDEX.get('GND') ?? -1) + 1;
  for (let i = 0; i < W * H; i += 1) {
    if (!nets[i * 4] && surface[i * 4] > 128) nets[i * 4] = gnd;
    if (!nets[i * 4 + 2] && bottom[i * 4] > 128) nets[i * 4 + 2] = gnd;
  }
  return { width: W, height: H, ppm, surface, bottom, nets };
}

/** Where a pin's pad is, for parts' leads and solder joints. */
export const padPosition = (part: Part, pin: string) => pinAt(part, pin);
