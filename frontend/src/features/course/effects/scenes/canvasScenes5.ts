import type { CanvasSceneDef } from './types';
import { TAU, clamp, mixHex, rgb, rgba, smooth } from './kit';
import { paintDecor } from './stringLightsDecor';
import { createPathTracer, type PathTracer } from './stringLightsPathTracer';
import { createAmber, projectAmber, type Amber, type AmberKind, type AmberLight } from './stringLightsAmber';
import { bakeRows, blurHeights, type BakeLight, type BakeSetup } from './stringLightsLight';
import { createOrbit } from './orbitControl';
import { createFridgeMagnets } from './stringLightsMagnets';

type Ctx = CanvasRenderingContext2D;

type Bulb = {
  x: number;
  cy: number;
  r: number;
  colourT: number;
  seed: number;
  filament: { x: number; y: number }[];
};

/** A classic Edison-bulb outline: a round globe narrowing to a neck at the socket, relative to its centre and radius. */
function bulbPath(g: Ctx, cx: number, cy: number, r: number) {
  g.beginPath();
  g.moveTo(cx - r * 0.55, cy - r * 0.05);
  g.bezierCurveTo(cx - r * 0.58, cy + r * 0.85, cx + r * 0.58, cy + r * 0.85, cx + r * 0.55, cy - r * 0.05);
  g.bezierCurveTo(cx + r * 0.5, cy - r * 0.7, cx + r * 0.22, cy - r * 0.92, cx + r * 0.15, cy - r * 1.02);
  g.lineTo(cx - r * 0.15, cy - r * 1.02);
  g.bezierCurveTo(cx - r * 0.22, cy - r * 0.92, cx - r * 0.5, cy - r * 0.7, cx - r * 0.55, cy - r * 0.05);
  g.closePath();
}

/** The "squirrel cage" of an Edison filament seen from the front: loops strung between a top and a bottom ring. */
function filamentPoints(rand: () => number, r: number): { x: number; y: number }[] {
  const m = 6 + Math.floor(rand() * 3);
  const top = -r * 0.3;
  const bottom = r * 0.42;
  const half = r * (0.17 + rand() * 0.05);
  return Array.from({ length: m + 1 }, (_, k) => ({ x: -half + (2 * half * k) / m, y: k % 2 ? bottom : top }));
}

function filamentPath(g: Ctx, cx: number, cy: number, pts: { x: number; y: number }[]) {
  g.beginPath();
  g.moveTo(cx + pts[0].x, cy + pts[0].y);
  for (let k = 1; k < pts.length; k += 1) g.lineTo(cx + pts[k].x, cy + pts[k].y);
}

/** The bulb as it looks switched off: brass socket, clear amber glass you see the wall through, stem and cold filament. */
function paintBulbBody(a: Ctx, b: Bulb) {
  const { x, cy, r } = b;
  const capW = r * 0.5;
  const capH = r * 0.46;
  const capY = cy - r * 1.05 - capH * 0.12;
  const brass = a.createLinearGradient(x - capW / 2, 0, x + capW / 2, 0);
  brass.addColorStop(0, '#4a3818');
  brass.addColorStop(0.35, '#b99450');
  brass.addColorStop(0.55, '#e0c07a');
  brass.addColorStop(1, '#3a2a12');
  a.fillStyle = brass;
  a.fillRect(x - capW / 2, capY, capW, capH);
  a.strokeStyle = 'rgba(40,26,8,0.6)';
  a.lineWidth = 1;
  for (let k = 1; k < 5; k += 1) {
    const ly = capY + (capH / 5) * k;
    a.beginPath();
    a.moveTo(x - capW / 2, ly + 1);
    a.quadraticCurveTo(x, ly - 1.2, x + capW / 2, ly - 0.5);
    a.stroke();
  }
  a.fillStyle = '#18120c';
  a.fillRect(x - capW * 0.45, capY + capH - 2, capW * 0.9, 3);
  a.fillRect(x - 1, capY - r * 0.12, 2, r * 0.13);
  bulbPath(a, x, cy, r);
  a.save();
  a.clip();
  a.fillStyle = 'rgba(70,46,20,0.18)';
  a.fillRect(x - r, cy - r * 1.1, r * 2, r * 2);
  const rim = a.createRadialGradient(x, cy + r * 0.05, r * 0.2, x, cy + r * 0.05, r * 0.95);
  rim.addColorStop(0.55, 'rgba(0,0,0,0)');
  rim.addColorStop(1, 'rgba(18,12,6,0.42)');
  a.fillStyle = rim;
  a.fillRect(x - r, cy - r * 1.1, r * 2, r * 2);
  a.fillStyle = 'rgba(214,204,184,0.2)';
  a.beginPath();
  a.moveTo(x - r * 0.1, cy - r * 0.98);
  a.lineTo(x + r * 0.1, cy - r * 0.98);
  a.lineTo(x + r * 0.04, cy - r * 0.34);
  a.lineTo(x - r * 0.04, cy - r * 0.34);
  a.closePath();
  a.fill();
  a.strokeStyle = 'rgba(58,48,38,0.6)';
  a.lineWidth = Math.max(0.7, r * 0.025);
  a.beginPath();
  a.moveTo(x - r * 0.05, cy - r * 0.9);
  a.lineTo(x - r * 0.19, cy - r * 0.3);
  a.moveTo(x + r * 0.05, cy - r * 0.9);
  a.lineTo(x + r * 0.19, cy - r * 0.3);
  a.moveTo(x, cy - r * 0.34);
  a.lineTo(x, cy + r * 0.44);
  a.stroke();
  a.strokeStyle = 'rgba(86,56,30,0.75)';
  a.lineWidth = Math.max(0.8, r * 0.035);
  filamentPath(a, x, cy, b.filament);
  a.stroke();
  a.restore();
  bulbPath(a, x, cy, r);
  a.strokeStyle = 'rgba(255,245,225,0.14)';
  a.lineWidth = 1;
  a.stroke();
  a.fillStyle = 'rgba(255,255,255,0.13)';
  a.beginPath();
  a.ellipse(x - r * 0.3, cy - r * 0.2, r * 0.08, r * 0.28, -0.35, 0, TAU);
  a.fill();
}

/** The glowing parts of a lit bulb, drawn additively on top of the room: hot glass, the white-hot filament, the rim. */
function paintLitBulb(g: Ctx, cx: number, cy: number, b: Bulb, warm: string) {
  const r = b.r;
  bulbPath(g, cx, cy, r);
  g.save();
  g.clip();
  const inner = g.createRadialGradient(cx, cy + r * 0.05, 0, cx, cy + r * 0.05, r * 1.05);
  inner.addColorStop(0, 'rgba(255,236,200,0.95)');
  inner.addColorStop(0.35, 'rgba(255,190,110,0.72)');
  inner.addColorStop(0.75, rgba(warm, 0.42));
  inner.addColorStop(1, rgba(warm, 0.2));
  g.fillStyle = inner;
  g.fillRect(cx - r * 1.2, cy - r * 1.2, r * 2.4, r * 2.4);
  g.globalCompositeOperation = 'lighter';
  g.lineJoin = 'round';
  for (const [width, color] of [[r * 0.34, 'rgba(255,150,60,0.22)'], [r * 0.15, 'rgba(255,196,110,0.5)'], [Math.max(1, r * 0.05), 'rgba(255,248,226,1)']] as const) {
    g.strokeStyle = color;
    g.lineWidth = width;
    filamentPath(g, cx, cy, b.filament);
    g.stroke();
  }
  g.restore();
  bulbPath(g, cx, cy, r);
  g.strokeStyle = 'rgba(255,186,110,0.45)';
  g.lineWidth = Math.max(1, r * 0.05);
  g.stroke();
}

function sprite(radius: number, scale: number, draw: (g: Ctx, R: number) => void): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const size = Math.max(2, Math.ceil(radius * 2 * scale));
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d')!;
  g.setTransform(size / (radius * 2), 0, 0, size / (radius * 2), 0, 0);
  draw(g, radius);
  return canvas;
}

function softDot(radius: number, scale: number, stops: [number, string][]): HTMLCanvasElement {
  return sprite(radius, scale, (g, R) => {
    const grad = g.createRadialGradient(R, R, 0, R, R, R);
    for (const [at, color] of stops) grad.addColorStop(at, color);
    g.fillStyle = grad;
    g.fillRect(0, 0, R * 2, R * 2);
  });
}

const linear = (hex: string): [number, number, number] => {
  const [r, g, b] = rgb(hex);
  return [(r / 255) ** 2.2, (g / 255) ** 2.2, (b / 255) ** 2.2];
};

/** Size of the light-map grid along its longer side: light is smooth, so it can be far coarser than the picture. */
const BAKE_LONG_SIDE = 480;
/** The fallback CPU bake's share of each frame. */
const CPU_BUDGET_MS = 6;
/** Samples per texel a layer is refined to: generous for what is on screen, enough to switch on cleanly otherwise. */
const SPP_VISIBLE = 256;
const SPP_IDLE = 40;

export const CANVAS_SCENES_5: CanvasSceneDef[] = [
  {
    kind: 'canvas',
    id: 'string-lights',
    label: 'Гирлянда лампочек Эдисона',
    warmupFrames: 1,
    palettes: [
      ['#100a05', '#ffb066', '#ff7a2e', '#ffe4b8'],
      ['#0a0a0c', '#ffe0a8', '#ffcf80', '#fff6e0'],
      ['#0c0605', '#ff8a4a', '#ff3a1e', '#ffcf8a'],
    ],
    create(c) {
      const W = c.width;
      const H = c.height;
      const S = c.dpr;
      const aw = Math.max(2, Math.round(W * S));
      const ah = Math.max(2, Math.round(H * S));
      const makeCanvas = (w: number, h: number) => {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        return canvas;
      };

      // ---- the room: colours, relief and the self-lit sky, each at full resolution.
      const albedo = makeCanvas(aw, ah);
      const a = albedo.getContext('2d')!;
      const depth = makeCanvas(aw, ah);
      const d = depth.getContext('2d')!;
      d.fillStyle = '#000';
      d.fillRect(0, 0, aw, ah);
      a.setTransform(aw / W, 0, 0, ah / H, 0, 0);
      d.setTransform(aw / W, 0, 0, ah / H, 0, 0);
      const decor = paintDecor({ a, d }, W, H, c.rand, c.body ? 'left' : 'right');
      const emissive = makeCanvas(aw, ah);
      const em = emissive.getContext('2d')!;
      em.setTransform(aw / W, 0, 0, ah / H, 0, 0);
      decor.paintEmissive(em);

      // ---- the string: looped between hooks under the beam, each bulb dangling from the wire.
      const count = clamp(Math.round(W / 118), 6, 16);
      const r0 = clamp(Math.min((W / count) * 0.32, H * 0.085), 10, 38);
      const scallops = clamp(Math.round(W / 560), 2, 4);
      const hookY = decor.beamB + 4;
      const baseSag = clamp(H * 0.26, 34, 260);
      type Span = { x0: number; x1: number; sag: number };
      const spans: Span[] = [];
      for (let s = 0; s < scallops; s += 1) {
        spans.push({ x0: W * (0.04 + (0.92 * s) / scallops), x1: W * (0.04 + (0.92 * (s + 1)) / scallops), sag: baseSag * (0.8 + c.rand() * 0.4) });
      }
      const wireAt = (span: Span, t: number) => ({ x: span.x0 + (span.x1 - span.x0) * t, y: hookY + span.sag * 4 * t * (1 - t) });
      const bulbs: Bulb[] = [];
      spans.forEach((span, s) => {
        const m = Math.floor(count / scallops) + (s < count % scallops ? 1 : 0);
        for (let j = 0; j < m; j += 1) {
          const w = wireAt(span, (j + 0.5) / m);
          const r = r0 * (0.9 + c.rand() * 0.2);
          bulbs.push({ x: w.x, cy: w.y + r * 1.12, r, colourT: c.rand(), seed: c.rand() * 100, filament: filamentPoints(c.rand, r) });
        }
      });
      const n = bulbs.length;
      a.strokeStyle = '#141009';
      a.lineWidth = 2;
      for (const span of spans) {
        a.beginPath();
        for (let i = 0; i <= 32; i += 1) {
          const q = wireAt(span, i / 32);
          if (i === 0) a.moveTo(q.x, q.y);
          else a.lineTo(q.x, q.y);
        }
        a.stroke();
        for (const hx of [span.x0, span.x1]) {
          a.fillStyle = '#9c7a3c';
          a.beginPath();
          a.arc(hx, hookY - 2, 4.5, 0, TAU);
          a.fill();
        }
      }
      for (const b of bulbs) paintBulbBody(a, b);

      // ---- the relief on the bake grid: the full-resolution one averaged down, then smoothed so the normals aren't stepped.
      const bakeScale = Math.min(1, BAKE_LONG_SIDE / Math.max(W, H));
      const bw = Math.max(16, Math.round(W * bakeScale));
      const bh = Math.max(16, Math.round(H * bakeScale));
      const small = makeCanvas(bw, bh);
      const sm = small.getContext('2d', { willReadFrequently: true })!;
      sm.imageSmoothingEnabled = true;
      sm.imageSmoothingQuality = 'high';
      sm.drawImage(depth, 0, 0, bw, bh);
      const px = sm.getImageData(0, 0, bw, bh).data;
      const raw = new Float32Array(bw * bh);
      for (let i = 0; i < raw.length; i += 1) raw[i] = px[i * 4] / 255;
      const heights = blurHeights(raw, bw, bh, 1);
      const heightUnit = 0.11 * Math.max(W, H);

      // ---- the lights: each bulb a small sphere hanging close in front of the wall (close enough that each lights its
      // own pool on the brick and rakes across the relief), its colour normalised to unit luminance.
      const lampPower = 0.5;
      const lampZ = heightUnit * 0.6;
      const warmOf = bulbs.map((b) => mixHex(c.palette[1], c.palette[2], b.colourT * 0.5));
      const lamps = bulbs.map((b, i) => {
        const [lr, lg, lb] = linear(warmOf[i]);
        const lum = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb || 1;
        const col: [number, number, number] = [lr / lum, lg / lum, lb / lum];
        const k = lampPower * heightUnit * heightUnit;
        return {
          x: b.x,
          y: b.cy + b.r * 0.1,
          z: lampZ,
          radius: b.r * 0.38,
          intensity: [col[0] * k, col[1] * k, col[2] * k] as [number, number, number],
          fill: [col[0] * lampPower * 0.02, col[1] * lampPower * 0.02, col[2] * lampPower * 0.02] as [number, number, number],
        };
      });

      let pt: PathTracer | null = createPathTracer({
        width: W,
        height: H,
        outWidth: aw,
        outHeight: ah,
        bakeWidth: bw,
        bakeHeight: bh,
        heightUnit,
        relief: heights,
        heightFull: depth,
        albedo,
        emissive,
        window: decor.window,
        windowRadiance: [0.05, 0.075, 0.14],
        nightFill: [0.012, 0.016, 0.03],
        lights: lamps,
      });

      // ---- the amber on the top suitcase, ray-marched in 3D in its own canvas (stringLightsAmber.ts), two to choose
      // from: the first one, a pebble lying straight on the lid, or the museum piece on a lit display base. Each is set
      // up (and its WebGL context created) the first time it is shown; the other one is let go on switching.
      const caseTop = decor.caseTop;
      const amberZ = heightUnit * 0.62;
      type AmberSlot = {
        kind: AmberKind;
        /** CSS px per amber unit (half its width). */
        U: number;
        /** The amber's own origin on the page, CSS px. */
        cx: number;
        cy: number;
        /** The canvas rectangle on the page, CSS px. */
        left: number;
        top: number;
        w: number;
        h: number;
        bg: HTMLCanvasElement;
        bgCtx: Ctx;
        amber: Amber | null;
        failed: boolean;
        bgDirty: boolean;
        stale: boolean;
        drawnYaw: number;
        drawnGlow: number;
      };
      const makeSlot = (kind: AmberKind): AmberSlot => {
        let U: number;
        let cx: number;
        let cy: number;
        let left: number;
        let top: number;
        let w: number;
        let h: number;
        let originX: number;
        let originY: number;
        if (kind === 'display') {
          U = clamp(Math.min(W * 0.055, H * 0.105), 36, 140);
          // Where the camera target lands so that the front edge of the base sits on the suitcase lid.
          const [, baseV] = projectAmber(0, -1.17, 0.67);
          const tx = caseTop.x + caseTop.w * 0.5;
          const ty = caseTop.y + baseV * U;
          const [ou, ov] = projectAmber(0, 0, 0);
          cx = tx + ou * U;
          cy = ty - ov * U;
          left = tx - U * 1.45;
          top = ty - U * 1.3;
          w = U * 2.9;
          h = U * 2.65;
          originX = U * 1.45 * S;
          originY = U * 1.35 * S;
        } else {
          U = clamp(Math.min(W * 0.062, H * 0.12), 40, 150);
          cx = caseTop.x + caseTop.w * 0.5;
          cy = caseTop.y - U * 0.48;
          left = cx - U * 1.18;
          top = cy - U;
          w = U * 2.36;
          h = U * 2;
          originX = U * 1.18 * S;
          originY = U * S;
        }
        const bg = makeCanvas(Math.max(2, Math.round(w * S)), Math.max(2, Math.round(h * S)));
        const slot: AmberSlot = { kind, U, cx, cy, left, top, w, h, bg, bgCtx: bg.getContext('2d')!, amber: null, failed: false, bgDirty: true, stale: true, drawnYaw: NaN, drawnGlow: NaN };
        slot.amber = createAmber(kind, bg.width, bg.height, U * S, originX, originY, 7331);
        slot.failed = !slot.amber;
        return slot;
      };
      let amberSlot: AmberSlot | null = null;
      const amberKind = (): AmberKind => (Number(c.params.lightsAmberStyle) === 1 ? 'display' : 'pebble');
      const ensureAmber = () => {
        const kind = amberKind();
        if (!amberSlot || amberSlot.kind !== kind) {
          amberSlot?.amber?.dispose();
          amberSlot = makeSlot(kind);
        }
        return amberSlot;
      };
      let amberAngle = 0;
      let amberPhase = 0;
      let amberHover = 0;
      const amberLights: AmberLight[] = [];

      // ---- fallback when the GPU can't path trace: the CPU raytraced direct light of stringLightsLight.ts.
      type Cpu = { canvas: HTMLCanvasElement; pump: () => boolean; compose: (levels: Float32Array, exposure: number) => void };
      let cpu: Cpu | null = null;
      const ensureCpu = (): Cpu => {
        if (cpu) return cpu;
        const setup: BakeSetup = { w: bw, h: bh, step: W / bw, heightUnit, receive: heights, block: heights };
        const cpuLights: BakeLight[] = lamps.map((l, i) => {
          const [cr, cg, cb] = rgb(warmOf[i]);
          const peak = Math.max(cr, cg, cb) || 1;
          return { x: l.x, y: l.y, z: l.z, skipX: 0, skipY: 0, skipRx: 0, skipRy: 0, color: [cr / peak, cg / peak, cb / peak], reach: 0.22 * Math.max(W, H), gain: 2.3 };
        });
        const maps: (HTMLCanvasElement | null)[] = new Array(n).fill(null);
        let job: { i: number; row: number; canvas: HTMLCanvasElement; ctx: Ctx; image: ImageData } | null = null;
        const ambient = makeCanvas(aw, ah);
        const am = ambient.getContext('2d')!;
        const lit = makeCanvas(aw, ah);
        const li = lit.getContext('2d')!;
        am.drawImage(emissive, 0, 0);
        li.drawImage(albedo, 0, 0);
        li.globalCompositeOperation = 'multiply';
        li.fillStyle = 'rgb(64,72,110)';
        li.fillRect(0, 0, aw, ah);
        li.globalCompositeOperation = 'destination-in';
        li.drawImage(albedo, 0, 0);
        li.globalCompositeOperation = 'source-over';
        am.drawImage(lit, 0, 0);
        const out = makeCanvas(aw, ah);
        const co = out.getContext('2d')!;
        const acc = makeCanvas(bw, bh);
        const la = acc.getContext('2d')!;
        cpu = {
          canvas: out,
          pump() {
            const t0 = performance.now();
            let finished = false;
            while (performance.now() - t0 < CPU_BUDGET_MS) {
              if (!job) {
                let i = -1;
                for (let k = 0; k < n && i < 0; k += 1) if (!maps[k] && (wanted[k] || onState[k])) i = k;
                for (let k = 0; k < n && i < 0; k += 1) if (!maps[k]) i = k;
                if (i < 0) break;
                const canvas = makeCanvas(bw, bh);
                const ctx = canvas.getContext('2d')!;
                job = { i, row: 0, canvas, ctx, image: ctx.createImageData(bw, bh) };
              }
              const end = Math.min(bh, job.row + 4);
              bakeRows(setup, cpuLights[job.i], job.image.data, job.row, end);
              job.row = end;
              if (job.row >= bh) {
                job.ctx.putImageData(job.image, 0, 0);
                maps[job.i] = job.canvas;
                finished = true;
                job = null;
              }
            }
            return finished;
          },
          compose(levels, exposure) {
            la.globalCompositeOperation = 'source-over';
            la.globalAlpha = 1;
            la.fillStyle = '#000';
            la.fillRect(0, 0, bw, bh);
            la.globalCompositeOperation = 'lighter';
            for (let i = 0; i < n; i += 1) {
              const map = maps[i];
              if (!map || levels[i] < 0.004) continue;
              la.globalAlpha = levels[i];
              la.drawImage(map, 0, 0);
            }
            la.globalAlpha = 1;
            la.globalCompositeOperation = 'source-over';
            li.globalCompositeOperation = 'source-over';
            li.clearRect(0, 0, aw, ah);
            li.drawImage(albedo, 0, 0);
            li.globalCompositeOperation = 'multiply';
            li.drawImage(acc, 0, 0, aw, ah);
            li.globalCompositeOperation = 'destination-in';
            li.drawImage(albedo, 0, 0);
            li.globalCompositeOperation = 'source-over';
            co.globalCompositeOperation = 'source-over';
            co.globalAlpha = 1;
            co.drawImage(ambient, 0, 0);
            co.globalCompositeOperation = 'lighter';
            co.globalAlpha = clamp(exposure, 0, 1);
            co.drawImage(lit, 0, 0);
            if (exposure > 1) {
              co.globalAlpha = clamp(exposure - 1, 0, 1);
              co.drawImage(lit, 0, 0);
            }
            co.globalAlpha = 1;
            co.globalCompositeOperation = 'source-over';
          },
        };
        return cpu;
      };

      // ---- live state. `heat` eases to on/off after a click (the soft switch-on), `level` is it shaped by smoothstep.
      const onState = new Uint8Array(n);
      for (let i = 0; i < n; i += 1) onState[i] = c.rand() < 0.4 ? 1 : 0;
      const wanted = new Uint8Array(n);
      const heat = new Float32Array(n);
      for (let i = 0; i < n; i += 1) heat[i] = onState[i];
      const level = new Float32Array(n);
      for (let i = 0; i < n; i += 1) level[i] = onState[i];
      const shownLevel = new Float32Array(n).fill(-1);
      const hover = new Float32Array(n);
      const weights = new Float32Array(n + 1);
      const litSum = () => level.reduce((acc, value) => acc + value, 0);
      const targetExposure = () => 1.35 / Math.sqrt(0.28 + 0.17 * litSum());
      let exposure = targetExposure();
      let shownExposure = -1;
      let dirty = true;
      let passBudget = 0;
      let passRate = 1.5;
      let frameEma = 1 / 60;
      let lastNow = 0;
      let rateTimer = 0;
      // The panel's path-tracing controls, as last applied.
      const bouncesSetting = () => clamp(Math.round(Number(c.params.lightsBounces)), 0, 2);
      let tracedBounces = bouncesSetting();
      let tracedRestart = c.params.lightsRestart;
      let shownLightOnly = false;
      let shownDenoise = true;
      let statsTimer = 0;
      let passesSinceStats = 0;

      // Show the painted room while the driver compiles and the first light layers accumulate.
      let shownTracer = false;
      const tracerHasRoom = () => !!pt && pt.ready() && pt.samples[0] > 0
        && bulbs.every((_, i) => !onState[i] || pt!.samples[i + 1] > 0);

      const pickLayer = (tracer: PathTracer) => {
        let best = -1;
        let bestScore = -Infinity;
        for (let l = 0; l <= n; l += 1) {
          const visible = l === 0 || level[l - 1] > 0.001 || onState[l - 1] === 1;
          const spp = tracer.samples[l];
          if (spp >= (visible ? SPP_VISIBLE : SPP_IDLE)) continue;
          const urgent = l > 0 && wanted[l - 1] === 1;
          const score = (urgent ? 4000 : 0) + (visible ? 2000 : 0) + (spp < 12 ? 500 : 0) - spp;
          if (score > bestScore) {
            bestScore = score;
            best = l;
          }
        }
        return best;
      };

      // ---- overlays drawn every frame on top of the lit room: bloom, the hot bulbs, glints on the glass, dust in the light.
      const haloR = bulbs.map((b) => b.r * 5.4);
      const halos = bulbs.map((b, i) => softDot(haloR[i], S, [
        [0, 'rgba(255,220,170,0.85)'],
        [0.07, rgba(warmOf[i], 0.5)],
        [0.22, rgba(warmOf[i], 0.17)],
        [0.5, rgba(warmOf[i], 0.05)],
        [1, rgba(warmOf[i], 0)],
      ]));
      const litR = bulbs.map((b) => b.r * 1.35);
      const litSprites = bulbs.map((b, i) => sprite(litR[i], S, (g, R) => paintLitBulb(g, R, R, b, warmOf[i])));
      const glintWarm = softDot(10, S, [[0, 'rgba(255,246,226,1)'], [0.25, 'rgba(255,214,160,0.55)'], [1, 'rgba(255,190,120,0)']]);
      const glintCool = softDot(10, S, [[0, 'rgba(210,225,255,0.9)'], [0.3, 'rgba(170,195,240,0.35)'], [1, 'rgba(150,180,240,0)']]);
      const dustDot = softDot(4, S, [[0, 'rgba(255,226,180,1)'], [1, 'rgba(255,210,150,0)']]);
      const winX = (decor.window.x0 + decor.window.x1) / 2;
      const winY = (decor.window.y0 + decor.window.y1) / 2;
      const dust = Array.from({ length: 56 }, () => ({
        x: c.rand() * W,
        y: c.rand() * H * 0.85,
        r: 0.6 + c.rand() * 1.6,
        vx: (c.rand() - 0.5) * 6,
        vy: -2 - c.rand() * 6,
        ph: c.rand() * TAU,
      }));

      const lightOnly = () => Number(c.params.lightsView) === 1;
      const denoiseOn = () => c.params.lightsDenoise !== false;
      const compose = () => {
        const eff = exposure * clamp(c.params.intensity, 0, 2);
        weights[0] = 1;
        for (let i = 0; i < n; i += 1) weights[i + 1] = level[i];
        shownLightOnly = lightOnly();
        shownDenoise = denoiseOn();
        shownTracer = tracerHasRoom();
        if (shownTracer && pt) pt.compose(weights, eff, 1.5, shownLightOnly, shownDenoise);
        else ensureCpu().compose(level, eff);
        shownLevel.set(level);
        shownExposure = eff;
        dirty = false;
        if (amberSlot) {
          amberSlot.bgDirty = true;
          amberSlot.stale = true;
        }
      };

      const drawAmber = (g: Ctx, room: HTMLCanvasElement, eff: number) => {
        const slot = ensureAmber();
        const am = slot.amber;
        if (!am || !am.ready()) return;
        const { U, cx, cy, left, top, w, h } = slot;
        if (slot.bgDirty) {
          const sx = aw / W;
          const sy = ah / H;
          slot.bgCtx.clearRect(0, 0, slot.bg.width, slot.bg.height);
          slot.bgCtx.drawImage(room, left * sx, top * sy, w * sx, h * sy, 0, 0, slot.bg.width, slot.bg.height);
          am.setBackground(slot.bg);
          slot.bgDirty = false;
        }
        const display = slot.kind === 'display';
        // The pebble turns all the way round; the display piece only rocks, so its mosquito keeps facing the room.
        const yaw = (display ? Math.sin(amberPhase) * 0.6 : amberAngle) + amberHover;
        const glow = display ? clamp(Number(c.params.lightsAmberGlow), 0, 3) : 0;
        if (glow !== slot.drawnGlow) slot.stale = true;
        if (slot.stale || Math.abs(yaw - slot.drawnYaw) > 1e-4) {
          amberLights.length = 0;
          const k = lampPower * (heightUnit / U) ** 2;
          const norm = lampPower * heightUnit * heightUnit || 1;
          for (let i = 0; i < n; i += 1) {
            if (level[i] < 0.01) continue;
            const [lr, lg, lb] = lamps[i].intensity;
            amberLights.push({
              x: (lamps[i].x - cx) / U,
              y: -(lamps[i].y - cy) / U,
              z: (lamps[i].z - amberZ) / U,
              r: (lr / norm) * k * level[i],
              g: (lg / norm) * k * level[i],
              b: (lb / norm) * k * level[i],
            });
          }
          const win: AmberLight = { x: (winX - cx) / U, y: -(winY - cy) / U, z: -amberZ / U, r: 0.02, g: 0.03, b: 0.06 };
          am.render(yaw, amberLights, win, eff, glow);
          slot.drawnYaw = yaw;
          slot.drawnGlow = glow;
          slot.stale = false;
        }
        // A soft contact shadow on the lid under it.
        g.save();
        g.translate(caseTop.x + caseTop.w * 0.5, caseTop.y);
        g.scale(1, display ? 0.14 : 0.16);
        const shadowR = U * (display ? 1.25 : 1.05);
        const shadow = g.createRadialGradient(0, 0, 0, 0, 0, shadowR);
        shadow.addColorStop(0, display ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.5)');
        shadow.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = shadow;
        g.fillRect(-shadowR * 1.05, -shadowR * 1.05, shadowR * 2.1, shadowR * 2.1);
        g.restore();
        g.globalCompositeOperation = 'lighter';
        if (display && glow > 0.01) {
          // The base's light, coloured by the resin, glowing on the wall behind.
          const haloR = U * 2.6;
          const halo = g.createRadialGradient(cx, cy, U * 0.4, cx, cy, haloR);
          halo.addColorStop(0, `rgba(255,150,50,${clamp(0.3 * glow, 0, 0.7).toFixed(3)})`);
          halo.addColorStop(0.45, `rgba(230,100,30,${clamp(0.1 * glow, 0, 0.3).toFixed(3)})`);
          halo.addColorStop(1, 'rgba(200,80,20,0)');
          g.fillStyle = halo;
          g.fillRect(cx - haloR, cy - haloR, haloR * 2, haloR * 2);
        } else if (!display) {
          // Light from the lit bulbs that passes through the resin, landing on the lid beside the pebble.
          for (let i = 0; i < n; i += 1) {
            if (level[i] < 0.02) continue;
            const dx = cx - bulbs[i].x;
            const dy = caseTop.y - bulbs[i].cy;
            const dist = Math.hypot(dx, dy) || 1;
            const s = level[i] * clamp((heightUnit * 1.4) / dist, 0, 1) ** 2;
            if (s < 0.03) continue;
            g.save();
            g.translate(cx + (dx / dist) * U * 0.75, caseTop.y + 1);
            g.scale(1, 0.22);
            const spot = g.createRadialGradient(0, 0, 0, 0, 0, U * 0.45);
            spot.addColorStop(0, `rgba(255,170,60,${(0.55 * s).toFixed(3)})`);
            spot.addColorStop(1, 'rgba(255,120,30,0)');
            g.fillStyle = spot;
            g.fillRect(-U * 0.5, -U * 0.5, U, U);
            g.restore();
          }
        }
        g.globalCompositeOperation = 'source-over';
        g.drawImage(am.canvas, left, top, w, h);
      };

      // The fridge's magnets (stringLightsMagnets.ts): lit by the room — its light on the fridge read off the picture
      // (the enamel's colour divided out), at most twice a second — and by the cursor; over the fridge the cursor is a
      // magnifying glass.
      const magnets = createFridgeMagnets(decor.fridge, S);
      const ENAMEL = [232 / 255, 223 / 255, 200 / 255];
      let fridgeTint: [number, number, number] = [0.6, 0.5, 0.38];
      let tintAt = -1;
      const probe = makeCanvas(1, 1);
      const pg = probe.getContext('2d', { willReadFrequently: true })!;
      const sampleTint = (room: CanvasImageSource & { width: number; height: number }) => {
        const k = room.width / W;
        const f = decor.fridge;
        pg.clearRect(0, 0, 1, 1);
        pg.drawImage(room, (f.x + f.w * 0.15) * k, (f.y + f.h * 0.4) * k, f.w * 0.6 * k, f.h * 0.4 * k, 0, 0, 1, 1);
        const px = pg.getImageData(0, 0, 1, 1).data;
        fridgeTint = [0, 1, 2].map((i) => Math.min(1.2, px[i] / 255 / ENAMEL[i])) as [number, number, number];
      };
      let ptrX = -1e4;
      let ptrY = -1e4;
      let ptrOn = false;
      // The camera: the room is a picture (the bulbs are painted into it), so a drag looks along the wall and the wheel
      // comes closer — enlarged as needed so the picture's edges never show. Pointer and drawing go through the view.
      const orbit = createOrbit(c, { pitch: [-40, 40], zoom: [1, 3] });
      const view = () => {
        const px = 0.08 * Math.sin(orbit.yaw);
        const py = 0.08 * Math.sin(orbit.pitch);
        return { s: orbit.zoom * (1 + 2.6 * Math.max(Math.abs(px), Math.abs(py))), x: px * W, y: py * H };
      };
      const toRoom = (x: number, y: number, v: ReturnType<typeof view>) => [W / 2 + (x - W / 2) / v.s + v.x, H / 2 + (y - H / 2) / v.s + v.y];

      return {
        ready: () => (!pt || pt.lost() || (tracerHasRoom() && pt.samples[0] >= 12
          && bulbs.every((_, i) => !onState[i] || pt!.samples[i + 1] >= 12)))
          && (!amberSlot?.amber || amberSlot.amber.ready() || amberSlot.amber.failed()),
        update(dt, t, pIn) {
          const po = orbit.update(pIn);
          const v = view();
          const [x, y] = toRoom(po.x, po.y, v);
          const [rawX, rawY] = toRoom(po.rawX, po.rawY, v);
          const p = { ...po, x, y, rawX, rawY };
          ptrX = x;
          ptrY = y;
          ptrOn = p.active;
          const now = performance.now();
          const real = lastNow ? Math.min(0.25, (now - lastNow) / 1000) : 1 / 60;
          lastNow = now;
          frameEma += (real - frameEma) * 0.1;
          rateTimer += real;
          if (rateTimer > 0.3) {
            rateTimer = 0;
            if (frameEma < 1 / 52) passRate = Math.min(6, passRate * 1.25 + 0.1);
            else if (frameEma > 1 / 38) passRate = Math.max(0.25, passRate * 0.7);
          }

          if (p.active && p.clicked && c.params.react > 0) {
            let nearest = -1;
            let nearestD = Infinity;
            for (let i = 0; i < n; i += 1) {
              const dd = Math.hypot(p.rawX - bulbs[i].x, p.rawY - bulbs[i].cy);
              if (dd < nearestD) {
                nearestD = dd;
                nearest = i;
              }
            }
            if (nearest >= 0 && nearestD < bulbs[nearest].r * 2.6) {
              onState[nearest] = onState[nearest] ? 0 : 1;
              wanted[nearest] = 1;
            }
          }
          for (let i = 0; i < n; i += 1) {
            const b = bulbs[i];
            heat[i] += (onState[i] - heat[i]) * Math.min(1, real * 2.6);
            if (Math.abs(onState[i] - heat[i]) < 0.002) heat[i] = onState[i];
            level[i] = smooth(0, 1, heat[i]);
            if (Math.abs(level[i] - shownLevel[i]) > 0.002) dirty = true;
            const near = p.active ? clamp(1 - Math.hypot(p.x - b.x, p.y - b.cy) / (b.r * 2.4), 0, 1) * c.params.react : 0;
            hover[i] += (near - hover[i]) * Math.min(1, real * 8);
          }
          exposure += (targetExposure() - exposure) * Math.min(1, real * 1.6);
          if (Math.abs(exposure * clamp(c.params.intensity, 0, 2) - shownExposure) > 0.002) dirty = true;
          if (lightOnly() !== shownLightOnly || denoiseOn() !== shownDenoise) dirty = true;

          if (pt && pt.lost()) {
            pt.dispose();
            pt = null;
            ensureCpu();
            dirty = true;
          }
          if (pt) {
            const bounces = bouncesSetting();
            if (bounces !== tracedBounces || c.params.lightsRestart !== tracedRestart) {
              pt.reset();
              tracedBounces = bounces;
              tracedRestart = c.params.lightsRestart;
              dirty = true;
            }
            passBudget = pt.ready() ? Math.min(passBudget + passRate, 8) : 0;
            while (passBudget >= 1) {
              const l = pickLayer(pt);
              if (l < 0) {
                passBudget = 0;
                break;
              }
              pt.trace(l, 1, tracedBounces);
              passBudget -= 1;
              passesSinceStats += 1;
              if (l === 0 || level[l - 1] > 0.001) dirty = true;
              if (l > 0 && pt.samples[l] >= 24) wanted[l - 1] = 0;
            }
          } else if (ensureCpu().pump()) {
            dirty = true;
            wanted.fill(0);
          }
          if (tracerHasRoom() !== shownTracer) dirty = true;
          statsTimer += real;
          if (statsTimer > 0.5) {
            if (pt) {
              let lo = Infinity;
              let hi = 0;
              for (let l = 0; l <= n; l += 1) {
                if (!(l === 0 || level[l - 1] > 0.001 || onState[l - 1] === 1)) continue;
                lo = Math.min(lo, pt.samples[l]);
                hi = Math.max(hi, pt.samples[l]);
              }
              const rate = Math.round(passesSinceStats / statsTimer);
              c.params.lightsStats = pt.ready() ? `${lo === hi ? lo : `${lo}–${hi}`} из ${SPP_VISIBLE} · ${rate} прох./с` : 'подготовка шейдеров';
            } else {
              c.params.lightsStats = 'нет WebGL2 — только прямой свет';
            }
            statsTimer = 0;
            passesSinceStats = 0;
          }

          // The amber turns (the pebble) or rocks (the display piece) on its own, and swings towards the cursor over it.
          const spin = clamp(Number(c.params.lightsAmberSpin), 0, 2);
          amberAngle += spin * real;
          amberPhase += spin * 3 * real;
          const slot = amberSlot;
          const overAmber = !!slot && p.active && p.x > slot.left && p.x < slot.left + slot.w && p.y > slot.top && p.y < slot.top + slot.h;
          const hoverTarget = slot && overAmber ? clamp((p.x - slot.left - slot.w / 2) / (slot.w / 2), -1, 1) * 0.9 : 0;
          amberHover += (hoverTarget - amberHover) * Math.min(1, real * 3);

          for (const m of dust) {
            m.x += (m.vx + Math.sin(t * 0.7 + m.ph) * 4) * real;
            m.y += m.vy * real;
            if (m.y < -10) {
              m.y = H * 0.85;
              m.x = c.rand() * W;
            }
            if (m.x < -10) m.x = W + 10;
            if (m.x > W + 10) m.x = -10;
          }
          void dt;
        },
        draw(g) {
          if (dirty) compose();
          const v = view();
          g.save();
          g.translate(W / 2, H / 2);
          g.scale(v.s, v.s);
          g.translate(-W / 2 - v.x, -H / 2 - v.y);
          const room = shownTracer && pt ? pt.canvas : ensureCpu().canvas;
          g.drawImage(room, 0, 0, W, H);
          const plain = !shownLightOnly;
          const now = performance.now() / 1000;
          if (plain && now - tintAt > 0.5) {
            tintAt = now;
            sampleTint(room);
          }
          if (plain) magnets.draw(g, { x: ptrX, y: ptrY, on: ptrOn }, fridgeTint, now);
          if (plain && c.params.lightsAmber !== false) drawAmber(g, room, shownExposure);
          const strength = clamp(0.55 + 0.45 * c.params.intensity, 0.3, 1.3);
          g.globalCompositeOperation = 'lighter';
          for (let i = 0; i < n; i += 1) {
            if (level[i] < 0.01) continue;
            g.globalAlpha = clamp(level[i] * 0.85 * strength, 0, 1);
            g.drawImage(halos[i], bulbs[i].x - haloR[i], bulbs[i].cy - haloR[i], haloR[i] * 2, haloR[i] * 2);
          }
          // Glints: every lit bulb reflects as a bright point on the near side of a dark neighbour's glass (and faintly on
          // its far inner surface); the window's cold light shows as a pale spot on the side towards it.
          for (let i = 0; i < n && plain; i += 1) {
            const dark = 1 - level[i];
            if (dark < 0.05) continue;
            const bi = bulbs[i];
            const glassX = bi.r * 0.4;
            const glassY = bi.r * 0.52;
            for (let j = 0; j < n; j += 1) {
              if (j === i || level[j] < 0.02) continue;
              const dx = bulbs[j].x - bi.x;
              const dy = bulbs[j].cy - bi.cy;
              const dist = Math.hypot(dx, dy) || 1;
              const s = level[j] * dark * clamp(((6 * r0) / dist) ** 1.3, 0, 1);
              if (s < 0.02) continue;
              const ux = dx / dist;
              const uy = dy / dist;
              const size = bi.r * 0.32;
              g.globalAlpha = clamp(s, 0, 1);
              g.drawImage(glintWarm, bi.x + ux * glassX - size / 2, bi.cy + uy * glassY - size / 2, size, size);
              g.globalAlpha = clamp(s * 0.35, 0, 1);
              g.drawImage(glintWarm, bi.x - ux * glassX * 0.45 - size * 0.3, bi.cy - uy * glassY * 0.45 - size * 0.3, size * 0.6, size * 0.6);
            }
            const wx = winX - bi.x;
            const wy = winY - bi.cy;
            const wd = Math.hypot(wx, wy) || 1;
            const size = bi.r * 0.36;
            g.globalAlpha = 0.28 * dark;
            g.drawImage(glintCool, bi.x + (wx / wd) * glassX * 1.1 - size / 2, bi.cy + (wy / wd) * glassY * 1.05 - size / 2, size, size);
          }
          for (let i = 0; i < n; i += 1) {
            const alpha = level[i] * strength * (0.985 + 0.015 * Math.sin(performance.now() * 0.011 + bulbs[i].seed * 10)) + hover[i] * 0.16 * (1 - level[i]);
            if (alpha < 0.01) continue;
            g.globalAlpha = clamp(alpha, 0, 1);
            g.drawImage(litSprites[i], bulbs[i].x - litR[i], bulbs[i].cy - litR[i], litR[i] * 2, litR[i] * 2);
          }
          // Dust only shows where a lit bulb's light catches it.
          const reach = r0 * 3.2;
          for (const m of plain ? dust : []) {
            let light = 0;
            for (let j = 0; j < n; j += 1) {
              if (level[j] < 0.01) continue;
              const dx = m.x - bulbs[j].x;
              const dy = m.y - bulbs[j].cy;
              light += level[j] / (1 + (dx * dx + dy * dy) / (reach * reach));
            }
            const alpha = clamp(light * 0.75, 0, 0.85);
            if (alpha < 0.02) continue;
            g.globalAlpha = alpha;
            g.drawImage(dustDot, m.x - m.r * 2, m.y - m.r * 2, m.r * 4, m.r * 4);
          }
          g.globalAlpha = 1;
          g.globalCompositeOperation = 'source-over';
          // Over the fridge the cursor is a magnifying glass.
          if (plain && ptrOn && magnets.contains(ptrX, ptrY)) magnets.drawLens(g, ptrX, ptrY, (lg) => lg.drawImage(room, 0, 0, W, H), fridgeTint, now);
          g.restore();
          orbit.draw(g);
        },
        dispose() {
          orbit.dispose();
          pt?.dispose();
          pt = null;
          amberSlot?.amber?.dispose();
          amberSlot = null;
        },
      };
    },
  },
];
