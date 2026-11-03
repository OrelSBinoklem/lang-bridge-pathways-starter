'use client';
import { profileEffectFrame } from './effectDiagnostics';


import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { PointerState } from './engine';
import { createSunWaterParams, dragFromDamping, MAX_SUN_WATER_DETAIL, type SunWaterParams } from './sunWater/params';
import {
  createFluid,
  createSpray,
  createVessel,
  DEFAULT_STEP,
  EFFECT_SUBSTEPS,
  emitSpray,
  FILL_RATIO,
  geyser,
  GRAVITY,
  moveVessel,
  placeVessel,
  pushFluid,
  SIM_DT,
  stepFluid,
  stepSpray,
  VESSEL_STEP_PER_SUBSTEP,
  vesselDimensions,
  type Vessel,
} from './sunWater/fluid';

export { createSunWaterParams, type SunWaterParams } from './sunWater/params';

const POINTER_RADIUS = 46;
const POINTER_PUSH = 1.6;
/** Seconds between the pool's own splashes at `geysers` 1: a fixed part plus up to as much again (the first version had 1.6 + 1.4). */
const GEYSER_INTERVAL = 4.5;
const GEYSER_JITTER = 4;
/** Turns the ripple slider into surface slope, and the caustics slider into brightness. */
const RIPPLE_GAIN = 0.8;
const CAUSTIC_GAIN = 1.4;
/** Over budget (ms per physics step) for this long, the water gets one substep fewer. */
const PHYSICS_BUDGET_MS = 11;
const SUN_RAYS = 14;
const MAX_SPRAY = 260;
/** Height of the sun above the water plane, as a multiple of the water field's height (lower = more grazing light). */
const SUN_ELEVATION = 1.3;
/** The gradient of the density field, scaled by the kernel radius over the interior density, gives the surface tilt. */
const TILT_GAIN = 1.5;

type Rgb = [number, number, number];
const WATER_TOP: Rgb = [112, 208, 240];
const WATER_BOTTOM: Rgb = [14, 92, 176];
const SKY_HIGH: Rgb = [190, 228, 252];
const SKY_LOW: Rgb = [255, 240, 208];
const FOAM: Rgb = [238, 250, 255];
const SUN_LIGHT: Rgb = [255, 244, 210];

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * A random number in [0, 1) for a lattice point: an integer hash, so it never repeats. (A lookup table with a
 * hash into it used to sit here, and its small pattern could be seen tiling across the water.)
 */
function noise2(x: number, y: number) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Smooth value noise (interpolated between lattice points): used where per-pixel static would look like TV noise. */
function vnoise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = noise2(xi, yi);
  const b = noise2(xi + 1, yi);
  const c = noise2(xi, yi + 1);
  const d = noise2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/**
 * Slope of the small ripples at a point of the card (px, not field pixels), written into `slope`. Three layers of
 * value noise, each turned, stretched sideways (ripples seen at a grazing angle are wide and flat) and drifting its
 * own way, so that no pattern repeats and it never looks like one picture sliding along.
 */
const RIPPLE_LAYERS = [
  { cos: 1, sin: 0, lx: 34, ly: 12, vx: -13, vy: 2.5, amp: 3.4 },
  { cos: 0.88, sin: 0.48, lx: 19, ly: 8, vx: 8, vy: -4, amp: 2.1 },
  { cos: 0.94, sin: -0.34, lx: 10, ly: 5, vx: -6, vy: 6, amp: 1.1 },
];
const slope = { x: 0, y: 0 };
const RIPPLE_EPS = 0.2;
function rippleSlope(X: number, Y: number, t: number) {
  let gx = 0;
  let gy = 0;
  for (const L of RIPPLE_LAYERS) {
    const u = (X * L.cos - Y * L.sin + t * L.vx) / L.lx;
    const v = (X * L.sin + Y * L.cos + t * L.vy) / L.ly;
    const n0 = vnoise(u, v);
    const du = (vnoise(u + RIPPLE_EPS, v) - n0) / RIPPLE_EPS;
    const dv = (vnoise(u, v + RIPPLE_EPS) - n0) / RIPPLE_EPS;
    gx += L.amp * (du * L.cos / L.lx + dv * L.sin / L.ly);
    gy += L.amp * (-du * L.sin / L.lx + dv * L.cos / L.ly);
  }
  slope.x = gx;
  slope.y = gy;
}

/**
 * Bright network of light inside the water (caustics): the ridges of two noise layers drifting against each other,
 * one of them bent by a slow third layer. Where the ridges cross the light is strongest.
 */
function causticLight(X: number, Y: number, t: number) {
  const warp = vnoise(X / 41 + t * 0.05, Y / 19 - t * 0.04) - 0.5;
  const a = 1 - Math.abs(vnoise((X + warp * 26 + t * 7) / 23, (Y - warp * 12) / 10 + t * 0.22) * 2 - 1);
  const b = 1 - Math.abs(vnoise((X - warp * 20 - t * 5) / 16, (Y + warp * 9) / 7 - t * 0.3 + 31.7) * 2 - 1);
  const c = a * b;
  const c2 = c * c;
  return c2 * c2;
}

/** Patchy lace for foam: irregular white areas with holes in them, drifting slowly. 0..1. */
function foamLace(X: number, Y: number, t: number) {
  const n = 0.5 * vnoise(X / 9 + t * 0.6, Y / 5 - t * 0.35) + 0.32 * vnoise(X / 4.6 - t * 0.8, Y / 2.7 + t * 0.5 + 17.3) + 0.18 * vnoise(X / 2.3 + 51.1, Y / 1.4 - t);
  return smooth(0.3, 0.72, n);
}

/** Where the sun sits in the card: the top-right corner, as before. */
function sunGeometry(width: number, height: number) {
  const radius = Math.max(22, Math.min(44, height * 0.16));
  return { radius, cx: width - radius * 1.7 - 74, cy: radius * 1.55 };
}

/** A soft four-pointed sparkle, drawn once and stamped wherever the sun catches the water. */
function makeSparkle(): HTMLCanvasElement {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  if (!g) return c;
  const mid = size / 2;
  const glow = g.createRadialGradient(mid, mid, 0, mid, mid, mid * 0.5);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, size, size);
  g.globalCompositeOperation = 'lighter';
  for (const [w, h] of [[size, 3], [3, size]]) {
    const beam = g.createLinearGradient(0, 0, w > h ? size : 0, w > h ? 0 : size);
    beam.addColorStop(0, 'rgba(255,255,255,0)');
    beam.addColorStop(0.5, 'rgba(255,255,255,0.95)');
    beam.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = beam;
    g.fillRect(mid - w / 2, mid - h / 2, w, h);
  }
  return c;
}

/**
 * A sun in the top-right corner over a pool of particle water at the bottom of the card. The water is a
 * position-based particle fluid (see sunWater/fluid.ts) that sloshes with gravity, rocks gently, is pushed
 * around by the cursor and now and then throws a splash whose drops fly off and fall back.
 *
 * It is drawn as a shaded surface: every frame the particles are splatted into a density field (with its
 * gradient), and each pixel is lit from the sun. The tilt of the surface gives a sky reflection (Fresnel),
 * a highlight where a facet faces the sun, foam where the water moves fast, and light patterns inside. Sparks
 * twinkle on the surface and on the spray only where they face the sun.
 */
export function SunWaterEffect({
  width,
  height,
  pointerRef,
  params,
}: {
  width: number;
  height: number;
  pointerRef: MutableRefObject<PointerState>;
  params?: SunWaterParams;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const p = params ?? createSunWaterParams();

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const sun = sunGeometry(width, height);
    const sparkle = makeSparkle();
    const spray = createSpray(MAX_SPRAY);

    // ---- what depends on the sliders that rebuild things ----------------------------------------------------------
    let quality = 1;
    let builtDetail = 0;
    let builtScale = 0;
    let fluid = createFluid(width, height, 1);
    let vessel: Vessel = createVessel(fluid);
    /** Physics substeps per frame: the usual three, fewer if the machine cannot keep up (see physicsStep). */
    let substeps = EFFECT_SUBSTEPS;
    let stepCost = 0;
    let overBudget = 0;

    // Field buffers, sized by the surface resolution.
    let scale = 0;
    let fw = 0;
    let fh = 0;
    let density = new Float32Array(0);
    let gradX = new Float32Array(0);
    let gradY = new Float32Array(0);
    let speedField = new Float32Array(0);
    let topY = new Int16Array(0);
    let topSmooth = new Float32Array(0);
    let topNx = new Float32Array(0);
    let topNy = new Float32Array(0);
    let radius = 0;
    let interior = 1;
    let threshold = 0.5;
    const shaded = document.createElement('canvas');
    let shadedCtx: CanvasRenderingContext2D | null = null;
    let image: ImageData | null = null;

    function rebuild() {
      if (p.detail !== builtDetail) {
        builtDetail = p.detail;
        fluid = createFluid(width, height, Math.min(MAX_SUN_WATER_DETAIL, Math.max(0.25, p.detail)));
        vessel = createVessel(fluid, p.vesselSize, p.vesselHole, p.vesselLeak);
        substeps = EFFECT_SUBSTEPS;
        stepCost = 0;
        overBudget = 0;
        spray.count = 0;
        for (let i = 0; i < 40; i += 1) stepFluid(fluid, { ...DEFAULT_STEP, substeps: EFFECT_SUBSTEPS });
      }
      const wanted = Math.max(0.25, Math.min(1, p.fieldScale * quality));
      if (wanted !== builtScale) {
        builtScale = wanted;
        scale = wanted;
        fw = Math.max(40, Math.round(width * scale));
        fh = Math.max(24, Math.round(height * scale));
        density = new Float32Array(fw * fh);
        gradX = new Float32Array(fw * fh);
        gradY = new Float32Array(fw * fh);
        speedField = new Float32Array(fw * fh);
        topY = new Int16Array(fw);
        topSmooth = new Float32Array(fw);
        topNx = new Float32Array(fw);
        topNy = new Float32Array(fw);
        shaded.width = fw;
        shaded.height = fh;
        shadedCtx = shaded.getContext('2d');
        image = shadedCtx ? shadedCtx.createImageData(fw, fh) : null;
      }
      // Kernel radius and the density inside a resting pool, in field pixels: the surface is where the density
      // has fallen to about half of the latter.
      radius = fluid.h * scale * 0.95;
      const spacingField = fluid.spacing * scale;
      interior = (Math.PI * radius * radius) / 4 / (spacingField * spacingField);
      threshold = interior * 0.5;
    }

    // ---- interaction ------------------------------------------------------------------------------------------------
    let geyserTimer = 3.5;
    let lastPointer: { x: number; y: number } | null = null;

    function applyPointer() {
      const cursor = pointerRef.current;
      const useVessel = p.cursorTool === 'vessel';
      if (!cursor.active) {
        lastPointer = null;
        vessel.active = false;
        return;
      }
      const cx = cursor.x + width / 2;
      const cy = height / 2 - cursor.y;
      const mx = lastPointer ? (cx - lastPointer.x) * 0.35 : 0;
      const my = lastPointer ? (cy - lastPointer.y) * 0.35 : 0;
      lastPointer = { x: cx, y: cy };
      if (useVessel) {
        // The cursor is a cup: it follows the pointer and the water meets its walls.
        Object.assign(vessel, vesselDimensions(fluid, p.vesselSize, p.vesselHole, p.vesselLeak));
        if (!vessel.active) placeVessel(fluid, vessel, cx, cy);
        vessel.active = true;
        moveVessel(fluid, vessel, cx, cy, substeps * VESSEL_STEP_PER_SUBSTEP);
        return;
      }
      vessel.active = false;
      // A mouse pushes the water only with the left button down; a finger or a pen touching the card always does.
      const touching = cursor.pointerType === 'touch' || cursor.pointerType === 'pen';
      if (p.pushWhen === 'press' && !touching && !cursor.pressed) return;
      pushFluid(fluid, cx, cy, mx, my, POINTER_RADIUS, POINTER_PUSH * p.pointerPush);
    }

    function physicsStep(clock: number) {
      const started = performance.now();
      applyPointer();
      stepFluid(fluid, {
        ...DEFAULT_STEP,
        gravity: GRAVITY,
        drag: dragFromDamping(p.damping),
        substeps,
        sway: p.swell * 0.05 * Math.sin(clock * 1.4),
        vessel,
      });
      emitSpray(fluid, spray, Math.random, p.spray);
      stepSpray(fluid, spray, GRAVITY);
      // Very fine water (detail in the tens) can cost more than a frame allows: then the water takes fewer, coarser
      // substeps, and if even that is too much the simulation simply runs slower than real time.
      stepCost = stepCost * 0.85 + (performance.now() - started) * 0.15;
      if (stepCost > PHYSICS_BUDGET_MS && substeps > 1) {
        overBudget += 1;
        if (overBudget > 12) {
          substeps -= 1;
          overBudget = 0;
          stepCost *= substeps / (substeps + 1);
        }
      } else overBudget = 0;
    }

    // ---- drawing: the sun -----------------------------------------------------------------------------------------
    function drawSun(t: number) {
      const r = sun.radius;
      const pulse = 1 + Math.sin(t * 1.4) * 0.04;
      const glow = ctx!.createRadialGradient(sun.cx, sun.cy, r * 0.3, sun.cx, sun.cy, r * 4.2 * pulse);
      glow.addColorStop(0, 'rgba(255,236,150,0.85)');
      glow.addColorStop(0.35, 'rgba(255,214,110,0.32)');
      glow.addColorStop(1, 'rgba(255,214,110,0)');
      ctx!.fillStyle = glow;
      ctx!.fillRect(0, 0, width, height);

      ctx!.save();
      ctx!.translate(sun.cx, sun.cy);
      ctx!.rotate(t * 0.12);
      ctx!.fillStyle = 'rgba(255,224,120,0.55)';
      for (let i = 0; i < SUN_RAYS; i += 1) {
        const a = (i / SUN_RAYS) * Math.PI * 2;
        const long = i % 2 === 0 ? 2.15 : 1.7;
        ctx!.save();
        ctx!.rotate(a);
        ctx!.beginPath();
        ctx!.moveTo(r * 1.2, -r * 0.11);
        ctx!.lineTo(r * long * pulse, 0);
        ctx!.lineTo(r * 1.2, r * 0.11);
        ctx!.closePath();
        ctx!.fill();
        ctx!.restore();
      }
      ctx!.restore();

      const disc = ctx!.createRadialGradient(sun.cx - r * 0.3, sun.cy - r * 0.3, r * 0.1, sun.cx, sun.cy, r);
      disc.addColorStop(0, '#fffbe0');
      disc.addColorStop(0.6, '#ffdd66');
      disc.addColorStop(1, '#ffb93a');
      ctx!.fillStyle = disc;
      ctx!.beginPath();
      ctx!.arc(sun.cx, sun.cy, r, 0, Math.PI * 2);
      ctx!.fill();
    }

    // ---- drawing: the water ---------------------------------------------------------------------------------------
    /** Splats every particle into the density field, its gradient and the speed field. Returns the rows in use. */
    function splat() {
      density.fill(0);
      gradX.fill(0);
      gradY.fill(0);
      speedField.fill(0);
      const invR2 = 1 / (radius * radius);
      const r2 = radius * radius;
      let minRow = fh;
      let maxRow = 0;
      for (let k = 0; k < fluid.count; k += 1) {
        const cx = fluid.px[k] * scale;
        const cy = fluid.py[k] * scale;
        const speed = Math.min(1, Math.hypot(fluid.vx[k], fluid.vy[k]) / 9);
        const x0 = Math.max(0, Math.floor(cx - radius));
        const x1 = Math.min(fw - 1, Math.ceil(cx + radius));
        const y0 = Math.max(0, Math.floor(cy - radius));
        const y1 = Math.min(fh - 1, Math.ceil(cy + radius));
        if (y0 < minRow) minRow = y0;
        if (y1 > maxRow) maxRow = y1;
        for (let y = y0; y <= y1; y += 1) {
          const dy = y + 0.5 - cy;
          const row = y * fw;
          for (let x = x0; x <= x1; x += 1) {
            const dx = x + 0.5 - cx;
            const d2 = dx * dx + dy * dy;
            if (d2 >= r2) continue;
            const m = 1 - d2 * invR2;
            const m2 = m * m;
            const w = m2 * m;
            const g = -6 * m2 * invR2;
            const i = row + x;
            density[i] += w;
            gradX[i] += g * dx;
            gradY[i] += g * dy;
            speedField[i] += w * speed;
          }
        }
      }
      return { minRow, maxRow };
    }

    function drawWater(t: number) {
      if (!image || !shadedCtx) return;
      const { minRow, maxRow } = splat();
      const data = image.data;
      data.fill(0);
      topY.fill(-1);
      // The highest water pixel of every column, and a horizontally smoothed copy of it: depth colours are
      // measured from the smooth one, otherwise steep waves would show a step wherever the top jumps.
      const tLow0 = threshold * 0.7;
      for (let x = 0; x < fw; x += 1) {
        for (let y = minRow; y <= maxRow; y += 1) {
          if (density[y * fw + x] >= tLow0) {
            topY[x] = y;
            break;
          }
        }
      }
      const smoothRadius = Math.max(3, Math.round(radius * 0.6));
      for (let x = 0; x < fw; x += 1) {
        let sum = 0;
        let n = 0;
        for (let k = -smoothRadius; k <= smoothRadius; k += 1) {
          const xx = x + k;
          if (xx < 0 || xx >= fw) continue;
          const top = topY[xx];
          if (top >= 0) {
            sum += top;
            n += 1;
          }
        }
        topSmooth[x] = n > 0 ? sum / n : -1;
      }
      const sunFx = sun.cx * scale;
      const sunFy = sun.cy * scale;
      const sunFz = SUN_ELEVATION * fh;
      const tLow = threshold * 0.7;
      const tHigh = threshold * 1.2;
      const tiltScale = (TILT_GAIN * radius) / interior;
      const depthSpan = Math.max(6, fh * (FILL_RATIO + 0.05));
      const rippleAmp = p.ripple * RIPPLE_GAIN;
      const invScale = 1 / scale;
      const shin = Math.max(4, p.shininess);
      const glint = p.glint;
      const foamAmt = p.foam;
      const causticAmt = p.caustics;
      const sheenWidth = fw * 0.2;

      for (let y = minRow; y <= maxRow; y += 1) {
        for (let x = 0; x < fw; x += 1) {
          const i = y * fw + x;
          const f = density[i];
          if (f < tLow) continue;
          const soft = smooth(tLow, tHigh, f);
          const o = i * 4;

          // Surface tilt from the density gradient (it points into the water, the normal points out).
          // Deep inside the density is lumpy between the particles; only the skin of the water has a real tilt.
          const shell = Math.exp(-Math.max(0, f - threshold) / (interior * 0.22));
          let nx = -gradX[i] * tiltScale * shell;
          let ny = -gradY[i] * tiltScale * shell;
          const below = Math.max(0, y - (topY[x] >= 0 ? topY[x] : y)) / depthSpan;
          const belowSmooth = Math.max(0, y - (topSmooth[x] >= 0 ? topSmooth[x] : y)) / depthSpan;
          // Small moving ripples, strongest near the surface.
          const skin = Math.exp(-below * 6);
          const cardX = x * invScale;
          const cardY = y * invScale;
          if (rippleAmp > 0) {
            rippleSlope(cardX, cardY, t);
            nx += rippleAmp * skin * slope.x;
            ny += rippleAmp * skin * slope.y;
          }
          const nLen = Math.hypot(nx, ny, 1);
          const unx = nx / nLen;
          const uny = ny / nLen;
          const unz = 1 / nLen;
          if (topNx[x] === 0 || topY[x] === y) {
            topNx[x] = unx;
            topNy[x] = uny;
          }

          // Colour of the water body: it gets deeper and darker with distance below the surface.
          const absorb = 1 - Math.exp(-belowSmooth * 2.4);
          let cr = WATER_TOP[0] + (WATER_BOTTOM[0] - WATER_TOP[0]) * absorb;
          let cg = WATER_TOP[1] + (WATER_BOTTOM[1] - WATER_TOP[1]) * absorb;
          let cb = WATER_TOP[2] + (WATER_BOTTOM[2] - WATER_TOP[2]) * absorb;

          // Light patterns inside the water, fading with depth.
          if (causticAmt > 0) {
            const c = causticLight(cardX, cardY, t) * causticAmt * Math.exp(-belowSmooth * 3) * CAUSTIC_GAIN;
            cr += 120 * c;
            cg += 150 * c;
            cb += 130 * c;
          }

          // Sky reflection: tilted facets mirror more of the sky (Fresnel), warmer toward the sun.
          const fres = 0.03 + 0.97 * (1 - unz) ** 4;
          const lx = sunFx - x;
          const ly = sunFy - y;
          const lLen = Math.hypot(lx, ly, sunFz);
          const towardSun = clamp01(0.5 + (unx * lx + uny * ly) / Math.max(1, Math.hypot(lx, ly)) * 0.5);
          const skyR = SKY_HIGH[0] + (SKY_LOW[0] - SKY_HIGH[0]) * towardSun;
          const skyG = SKY_HIGH[1] + (SKY_LOW[1] - SKY_HIGH[1]) * towardSun;
          const skyB = SKY_HIGH[2] + (SKY_LOW[2] - SKY_HIGH[2]) * towardSun;
          cr += (skyR - cr) * fres;
          cg += (skyG - cg) * fres;
          cb += (skyB - cb) * fres;

          // Highlight of the sun on facets that face it (Blinn-Phong with the viewer straight above).
          let hx = lx / lLen;
          let hy = ly / lLen;
          let hz = sunFz / lLen + 1;
          const hLen = Math.hypot(hx, hy, hz);
          hx /= hLen;
          hy /= hLen;
          hz /= hLen;
          const ndh = unx * hx + uny * hy + unz * hz;
          if (ndh > 0.55 && glint > 0) {
            const spec = ndh ** shin * glint * 2.4 * (0.35 + 0.65 * skin);
            cr += SUN_LIGHT[0] * spec;
            cg += SUN_LIGHT[1] * spec;
            cb += SUN_LIGHT[2] * spec;
          }
          // A broad sheen on the water right under the sun.
          if (glint > 0) {
            const dxs = (x - sunFx) / sheenWidth;
            const sheen = Math.exp(-dxs * dxs) * skin * 0.32 * glint;
            cr += SUN_LIGHT[0] * sheen;
            cg += SUN_LIGHT[1] * sheen;
            cb += SUN_LIGHT[2] * sheen;
          }

          // Foam: fast water, steep crests, and a thin line along the very top.
          let alpha = p.clarity * soft;
          if (foamAmt > 0) {
            const meanSpeed = speedField[i] / Math.max(1e-4, f);
            const breakup = 0.22 + 0.78 * foamLace(cardX, cardY, t);
            const crest = smooth(0.3, 0.9, Math.hypot(unx, uny)) * skin;
            const edge = below < 0.03 ? 0.55 : below < 0.07 ? 0.18 : 0;
            const foam = clamp01((smooth(0.4, 0.95, meanSpeed) * 0.8 + crest * 0.6 + edge) * breakup * foamAmt);
            cr += (FOAM[0] - cr) * foam;
            cg += (FOAM[1] - cg) * foam;
            cb += (FOAM[2] - cb) * foam;
            alpha = clamp01(alpha + foam * 0.5 * soft);
          }

          data[o] = cr > 255 ? 255 : cr;
          data[o + 1] = cg > 255 ? 255 : cg;
          data[o + 2] = cb > 255 ? 255 : cb;
          data[o + 3] = alpha * 255;
        }
      }
      shadedCtx.putImageData(image, 0, 0);
      ctx!.imageSmoothingEnabled = true;
      ctx!.imageSmoothingQuality = 'high';
      ctx!.drawImage(shaded, 0, 0, width, height);

      // Sparks: only where the surface faces the sun, brightest in the glitter path under it.
      if (p.sparkle > 0 && glint > 0) {
        ctx!.globalCompositeOperation = 'lighter';
        const tick = Math.floor(t * 9);
        for (let x = 0; x < fw; x += 1) {
          if (topY[x] < 0) continue;
          const y = topY[x];
          const dx = sunFx - x;
          const dy = sunFy - y;
          const dLen = Math.hypot(dx, dy) || 1;
          const facing = topNx[x] * (dx / dLen) + topNy[x] * (dy / dLen);
          if (facing < 0.05) continue;
          const path = 0.3 + 0.7 * Math.exp(-(((x - sunFx) / (fw * 0.33)) ** 2));
          const twinkle = noise2(x, tick);
          const power = facing ** 1.4 * path * smooth(0.6, 1, twinkle) * p.sparkle;
          if (power < 0.06) continue;
          const size = (3 + 9 * power) * Math.max(0.75, Math.min(1.3, width / 900));
          ctx!.globalAlpha = Math.min(1, power * 1.4);
          ctx!.drawImage(sparkle, x / scale - size / 2, y / scale - size / 2 - 1, size, size);
        }
        ctx!.globalAlpha = 1;
        ctx!.globalCompositeOperation = 'source-over';
      }
    }

    // ---- drawing: spray -------------------------------------------------------------------------------------------
    /** One drop of water with its highlight on the side toward the sun. */
    function drawDrop(x: number, y: number, r: number, fade: number) {
      const dx = sun.cx - x;
      const dy = sun.cy - y;
      const dLen = Math.hypot(dx, dy) || 1;
      ctx!.globalAlpha = 0.82 * fade;
      ctx!.fillStyle = 'rgb(214,240,252)';
      ctx!.beginPath();
      ctx!.arc(x, y, r, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.globalAlpha = 0.95 * fade * Math.min(1, 0.5 + p.glint * 0.5);
      ctx!.fillStyle = 'rgb(255,255,250)';
      ctx!.beginPath();
      ctx!.arc(x + (dx / dLen) * r * 0.42, y + (dy / dLen) * r * 0.42, Math.max(0.5, r * 0.42), 0, Math.PI * 2);
      ctx!.fill();
    }

    function drawSpray(t: number) {
      // Water particles that have left the pool are too thin to show in the density field: draw them as drops
      // (the stream from the cup's hole, splashes that come apart).
      const looseR = Math.max(1.1, Math.min(3.2, fluid.spacing * 0.3));
      for (let i = 0; i < fluid.count; i += 1) {
        if (fluid.lonely[i]) drawDrop(fluid.px[i], fluid.py[i], looseR, 1);
      }
      for (let i = 0; i < spray.count; i += 1) {
        const x = spray.x[i];
        const y = spray.y[i];
        const r = spray.size[i];
        const fade = clamp01(1 - spray.age[i] / 3.6);
        const dx = sun.cx - x;
        const dy = sun.cy - y;
        const dLen = Math.hypot(dx, dy) || 1;
        drawDrop(x, y, r, fade);
        // Now and then it flashes; more so the nearer it is to the sun.
        const flash = Math.sin(spray.age[i] * 17 + spray.phase[i]);
        if (flash > 0.55 && p.sparkle > 0 && p.glint > 0) {
          const near = 0.45 + 0.55 * Math.exp(-((dLen / (width * 0.5)) ** 2));
          const size = (4 + r * 3.2) * (0.6 + flash * 0.6);
          ctx!.globalCompositeOperation = 'lighter';
          ctx!.globalAlpha = clamp01((flash - 0.55) / 0.45) * near * fade * p.sparkle;
          ctx!.drawImage(sparkle, x - size / 2, y - size / 2, size, size);
          ctx!.globalCompositeOperation = 'source-over';
        }
      }
      ctx!.globalAlpha = 1;
      void t;
    }

    // ---- drawing: the cup ---------------------------------------------------------------------------------------
    function drawVessel() {
      if (!vessel.active) return;
      const g = ctx!;
      const { x, y, width: w, height: h, wall, hole } = vessel;
      const left = x - w / 2;
      const right = x + w / 2;
      const top = y - h / 2;
      const bottom = y + h / 2;
      const gap = hole / 2;
      // The wall facing the sun is lit, the far one is in shade.
      const lit = sun.cx >= x ? 1 : 0;
      const metal = g.createLinearGradient(left, 0, right, 0);
      metal.addColorStop(0, lit ? 'rgba(150,176,194,0.96)' : 'rgba(236,247,252,0.96)');
      metal.addColorStop(0.5, 'rgba(170,196,212,0.94)');
      metal.addColorStop(1, lit ? 'rgba(238,248,252,0.96)' : 'rgba(108,134,152,0.96)');
      g.save();
      g.globalAlpha = 1;
      // Handle on the side away from the sun.
      g.strokeStyle = 'rgba(176,200,216,0.96)';
      g.lineWidth = 3.5;
      g.beginPath();
      if (lit) g.arc(left + 1, y - h * 0.08, h * 0.2, Math.PI / 2, (Math.PI * 3) / 2);
      else g.arc(right - 1, y - h * 0.08, h * 0.2, -Math.PI / 2, Math.PI / 2);
      g.stroke();
      g.fillStyle = metal;
      g.strokeStyle = 'rgba(28,58,86,0.55)';
      g.lineWidth = 1;
      const parts: Array<[number, number, number, number]> = [
        [left, top, wall, h],
        [right - wall, top, wall, h],
        [left, bottom - wall, w / 2 - gap, wall],
        [x + gap, bottom - wall, w / 2 - gap, wall],
      ];
      for (const [px, py, pw, ph] of parts) {
        g.fillRect(px, py, pw, ph);
        g.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
      }
      // Bright rims and a thin glint down the lit wall.
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.fillRect(left, top, wall, 2);
      g.fillRect(right - wall, top, wall, 2);
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fillRect(lit ? right - wall + 1 : left + 1, top + 4, 1.5, h - 10);
      g.restore();
    }

    function render(t: number) {
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, width, height);
      drawSun(t);
      drawWater(t);
      drawSpray(t);
      drawVessel();
    }

    // ---- start ----------------------------------------------------------------------------------------------------
    rebuild();
    // Settle the pool before the first frame so it does not visibly "fall in" on mount.
    for (let i = 0; i < 40; i += 1) physicsStep(0);
    spray.count = 0;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      render(0);
      return;
    }

    let rafId = 0;
    let last = 0;
    let acc = 0;
    let clock = 0;
    let slow = 0;
    const loop = profileEffectFrame(canvas, (time: number) => {
      rafId = requestAnimationFrame(loop);
      const raw = last ? time - last : 0;
      const dt = Math.min(raw / 1000, 0.1);
      last = time;
      // Steady slow frames (a weak device) lower the surface resolution; stalls (a hidden tab) do not count.
      if (raw > 0 && raw < 250) {
        slow = raw > 26 ? slow + 1 : Math.max(0, slow - 2);
        if (slow > 40 && quality > 0.5) {
          quality *= 0.85;
          slow = 0;
        }
      }
      rebuild();
      acc += dt;
      clock += dt;
      if (p.geysers > 0) geyserTimer -= dt * p.geysers;
      if (geyserTimer <= 0) {
        geyser(fluid, Math.random, p.splashPower);
        geyserTimer = GEYSER_INTERVAL + Math.random() * GEYSER_JITTER;
      }
      let steps = 0;
      while (acc >= SIM_DT && steps < 3) {
        physicsStep(clock);
        acc -= SIM_DT;
        steps += 1;
      }
      if (steps === 3) acc = 0;
      render(clock);
    });
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [width, height, pointerRef, params]);

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
}
