import type { CanvasSceneDef } from './types';
import { createOrbit } from './orbitControl';
import { clamp, rgb } from './kit';
import { FIREWORKS_2D } from './canvasScenes2';
import { createFireworksRenderer } from './fireworksGL';
import { LIGHT_FLOATS, MAX_LIGHTS, MAX_PUFFS, MAX_STARS, PUFF_FLOATS, STAR_FLOATS, createShow } from './fireworksSim';

/**
 * A fireworks show over Riga seen across the Daugava at night: a generative programme of real shell types
 * (fireworksSim.ts) rendered on the GPU (fireworksGL.ts) with lit smoke, the skyline catching the light and the river
 * reflecting it all. A click sends a shell to burst where it was clicked. It plays in a group card or over the whole page
 * (a lower skyline, shells on both sides, a richer show — more colours and shell types, mines from the ground, rainbow
 * salvos — drawn at reduced resolution on big screens). Without WebGL2 the flat
 * fireworks are drawn.
 */

const REF = 230;
/** The show runs 1.7× faster than real time: real shells take ~5 s to climb, too slow for a small card. */
const PACE = 1.7;
const CAM_H = 8;
const toLinear = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** Riga's skyline as a height per column (device px above the horizon): old-town roofs, gables, church spires. */
function skyline(width: number, sky: number, scale: number, rand: () => number) {
  const h = new Float32Array(width);
  let x = 0;
  while (x < width) {
    const w = (10 + rand() * 26) * scale;
    const base = sky * (0.05 + rand() * 0.09);
    const gable = rand() < 0.55;
    for (let i = 0; i < w && x + i < width; i += 1) {
      const u = i / w;
      h[Math.floor(x + i)] = base + (gable ? sky * 0.05 * (1 - Math.abs(u - 0.5) * 2) : 0);
    }
    x += w;
  }
  // Spires: a tower, then a tall thin needle with a gallery (St Peter's), a stepped one (the Dome), a plain one (St James).
  const spire = (cx: number, tower: number, needle: number, wide: number, tiers: number) => {
    const tw = wide * scale;
    for (let i = Math.floor(cx - tw); i <= Math.ceil(cx + tw); i += 1) {
      if (i < 0 || i >= h.length) continue;
      const d = Math.abs(i - cx);
      let top = d < tw * 0.55 ? sky * tower : 0;
      const k = d / (tw * 0.55);
      if (d < tw * 0.55) {
        for (let t = 0; t < tiers; t += 1) {
          const level = tower + (needle * (t + 1)) / (tiers + 1);
          if (k < 0.8 - t * 0.22) top = Math.max(top, sky * level);
        }
        top = Math.max(top, sky * (tower + needle * (1 - k)));
      }
      h[i] = Math.max(h[i], top);
    }
  };
  spire(width * (0.14 + rand() * 0.04), 0.2, 0.28, 7, 2);
  spire(width * (0.45 + rand() * 0.05), 0.24, 0.18, 9, 1);
  spire(width * (0.62 + rand() * 0.04), 0.18, 0.22, 6, 0);
  spire(width * (0.86 + rand() * 0.04), 0.16, 0.12, 8, 1);
  return h;
}

export const FIREWORKS_SHOW: CanvasSceneDef = {
  kind: 'canvas',
  id: 'fireworks',
  label: 'Фейерверк',
  palettes: FIREWORKS_2D.palettes,
  create(c) {
    const W = c.width;
    const H = c.height;
    // Over the whole page the picture is drawn at no more than ~1.6 million pixels (the browser scales it up).
    const S = c.body ? Math.min(1, Math.sqrt(1.6e6 / Math.max(1, W * H))) : Math.min(c.dpr, 2);
    const aw = Math.max(2, Math.round(W * S));
    const ah = Math.max(2, Math.round(H * S));
    const horizon = ah * (c.body ? 0.2 : 0.27);
    const sky = ah - horizon;
    // Bursts up to ~150 m reach 88% of the sky at the reference depth.
    const focal = (0.88 * sky * REF) / (150 - CAM_H);
    const cx = aw / 2;
    const zen = rgb(c.palette[0]).map(toLinear);
    const renderer = createFireworksRenderer({
      width: aw,
      height: ah,
      horizon,
      cx,
      focal,
      camH: CAM_H,
      scale: S,
      // On the whole page the skyline stays low, a strip along the bottom.
      city: skyline(aw, sky * (c.body ? 0.45 : 1), S, c.rand),
      zenith: [zen[0] * 0.6, zen[1] * 0.6, zen[2] * 0.9],
      low: [0.035, 0.02, 0.03],
      water: [0.0015, 0.002, 0.004],
      bloom: c.body ? 0.65 : 1,
    });
    if (!renderer) return FIREWORKS_2D.create(c);

    const show = createShow(
      { halfWidth: (cx / focal) * REF, ref: REF, near: 150, far: 330, low: 70, high: 150, rightBias: c.body ? 0.5 : 0.7, lavish: c.body },
      c.rand,
    );
    const stars = new Float32Array(MAX_STARS * STAR_FLOATS);
    const lights = new Float32Array(MAX_LIGHTS * LIGHT_FLOATS);
    const puffs = new Float32Array(MAX_PUFFS * PUFF_FLOATS);
    let clock = 0;
    let lastDt = 1 / 60;
    // Start mid-show, with bursts already in the sky.
    for (let i = 0; i < 150; i += 1) show.step(PACE / 30);
    // The camera control: the show (its bursts, their lights and smoke) turned round its middle in the sky, and the
    // camera brought closer; the city on the horizon stays as it is.
    const orbit = createOrbit(c, { pitch: [-25, 35], zoom: [0.5, 3] });
    const PIV = [0, 110, 240];
    const turn = (a: Float32Array, n: number, stride: number, offs: readonly number[]) => {
      const cy = Math.cos(orbit.yaw), sy = Math.sin(orbit.yaw), cp = Math.cos(orbit.pitch), sp = Math.sin(orbit.pitch);
      const ahead = PIV[2] * (1 - 1 / orbit.zoom);
      for (let i = 0; i < n; i += 1) {
        for (const off of offs) {
          const o = i * stride + off;
          const x = a[o] - PIV[0], y = a[o + 1] - PIV[1], z = a[o + 2] - PIV[2];
          const x1 = cy * x + sy * z, z1 = -sy * x + cy * z;
          const y2 = cp * y - sp * z1, z2 = sp * y + cp * z1;
          a[o] = x1 + PIV[0];
          a[o + 1] = y2 + PIV[1];
          a[o + 2] = Math.max(8, z2 + PIV[2] - ahead);
        }
      }
    };

    return {
      update(dt, t, pIn) {
        const p = orbit.update(pIn);
        const step = Math.min(dt, 0.05) * clamp(c.params.speed, 0.1, 4) * PACE;
        clock += step;
        lastDt = Math.max(1e-3, step);
        if (p.clicked && c.params.react > 0) {
          const x = ((p.x * S - cx) / focal) * REF;
          const height = ((ah - p.y * S - horizon) / focal) * REF + CAM_H;
          if (height > 30) show.fireAt(x, clamp(height, 40, 170));
        }
        show.step(step);
        void t;
      },
      draw(g) {
        const n = show.write(stars, lights, puffs);
        if (orbit.yaw !== 0 || orbit.pitch !== 0 || orbit.zoom !== 1) {
          turn(stars, n.stars, STAR_FLOATS, [0, 3]);
          turn(lights, n.lights, LIGHT_FLOATS, [0]);
          turn(puffs, n.puffs, PUFF_FLOATS, [0]);
        }
        renderer.render({
          stars, starCount: n.stars, lights, lightCount: n.lights, puffs, puffCount: n.puffs,
          dt: lastDt, time: clock % 1000, exposure: clamp(c.params.intensity, 0.2, 3), dim: n.dim,
        });
        g.drawImage(renderer.canvas, 0, 0, W, H);
        orbit.draw(g);
      },
      dispose() {
        orbit.dispose();
        renderer.dispose();
      },
    };
  },
};
