import type { CanvasSceneDef } from './types';
import { TAU, clamp, rgb } from './kit';
import { createFireflySignals } from './fireflySignals';

/**
 * «Среди своих» — fireflies over a summer meadow at dusk (owner: «придумай, как улучшить эффект, и на весь экран сделай
 * вариант»; 2026-10-30: «доработать детализацию»).
 *
 * The meadow, painted once: a night sky with the Milky Way (a noisy band of faint light and denser stars), stars of
 * different brightness and colour, a textured moon (maria, darker limb) behind thin moonlit cloud; two rows of trees —
 * leafy crowns built of many small clusters and pointed spruces, the near row with a thin moonlit rim on its moon side;
 * layered haze over the meadow; the far meadow combed with fine blades, pale at the tips, with chamomile and yarrow
 * flowers. Drawn live: a few twinkling stars, the near grass — tapered blades, timothy heads, yarrow umbels and broad
 * leaves — swaying in gusts, and lit warm by any flash near it.
 *
 * Each insect wanders at its own depth. Idle glimmers never transmit: a click selects one closest insect,
 * then a delayed, weakening relay travels only to neighbours inside the exact 3D radius.
 * Six hops, refractory time and per-wave visitation prevent a permanent all-over flash loop.
 * Distance is checked again on receipt, so moving away can break the chain. A flash lights nearby grass; a strong one
 * leaves a short fading trail, and the near insects show their dark body and wings around the glowing lantern.
 */

const N_SPRITES = 3;
const TRAIL = 6;

export const FIREFLIES: CanvasSceneDef = {
  kind: 'canvas',
  id: 'fireflies',
  label: 'Светлячки · цепная реакция света по клику',
  palettes: [['#04120e', '#e8ff7a', '#5affb0', '#0a2a20'], ['#0a0a24', '#ffe27a', '#ff9ad4', '#151540']],
  create(c) {
    const W = c.width;
    const H = c.height;
    const S = c.dpr;
    const rand = c.rand;
    const [skyTop, flyCol, accent, skyLow] = c.palette;
    const horizon = H * 0.62;
    const mx = W * 0.78, my = horizon * 0.42, mr = Math.max(10, Math.min(W, H) * 0.035);

    // ---- the still background, painted once.
    const back = document.createElement('canvas');
    back.width = Math.ceil(W * S);
    back.height = Math.ceil(H * S);
    {
      const g = back.getContext('2d')!;
      g.scale(S, S);
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, skyTop);
      sky.addColorStop(0.55, skyLow);
      const [ar, ag, ab] = rgb(accent);
      sky.addColorStop(0.62, `rgba(${Math.round(ar * 0.35 + 30)},${Math.round(ag * 0.25 + 25)},${Math.round(ab * 0.3 + 40)},1)`);
      sky.addColorStop(1, '#030405');
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
      // The Milky Way: a slanted band, its light uneven (soft blobs) and its stars denser.
      const bandAt = (x: number) => horizon * (0.95 - 0.75 * (x / W)) ;
      const bandW = H * 0.11;
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 220; k += 1) {
        const x = rand() * W, y = bandAt(x) + (rand() - 0.5) * bandW * 1.6;
        if (y > horizon) continue;
        const r = bandW * (0.25 + rand() * 0.7);
        const gl = g.createRadialGradient(x, y, 0, x, y, r);
        gl.addColorStop(0, `rgba(170,175,215,${(0.018 + rand() * 0.03).toFixed(3)})`);
        gl.addColorStop(1, 'rgba(170,175,215,0)');
        g.fillStyle = gl;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      // Dark dust lanes along it.
      g.globalCompositeOperation = 'source-over';
      for (let k = 0; k < 60; k += 1) {
        const x = rand() * W, y = bandAt(x) + (rand() - 0.5) * bandW * 0.5;
        if (y > horizon) continue;
        const r = bandW * (0.15 + rand() * 0.3);
        const gl = g.createRadialGradient(x, y, 0, x, y, r);
        gl.addColorStop(0, 'rgba(6,6,18,0.18)');
        gl.addColorStop(1, 'rgba(6,6,18,0)');
        g.fillStyle = gl;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      // Stars: many faint, some bright with a soft glow; bluish, white and warm; denser in the band.
      const tints = ['255,255,245', '220,230,255', '255,236,210', '200,215,255'];
      const nStars = (W * H) / 3200;
      for (let k = 0; k < nStars; k += 1) {
        let x = rand() * W, y = rand() * horizon * 0.92;
        if (rand() < 0.45) { x = rand() * W; y = bandAt(x) + (rand() + rand() + rand() - 1.5) * bandW * 0.8; }
        if (y < 0 || y > horizon * 0.95) continue;
        const fade = 1 - Math.pow(y / horizon, 3);
        const b = Math.pow(rand(), 4.5);
        const t = tints[Math.floor(rand() * tints.length)];
        if (b > 0.6) {
          const r = 1.5 + b * 2.5;
          const gl = g.createRadialGradient(x, y, 0, x, y, r);
          gl.addColorStop(0, `rgba(${t},${(0.35 * fade).toFixed(2)})`);
          gl.addColorStop(1, `rgba(${t},0)`);
          g.fillStyle = gl;
          g.fillRect(x - r, y - r, r * 2, r * 2);
        }
        g.fillStyle = `rgba(${t},${((0.12 + b * 0.8) * fade).toFixed(2)})`;
        const s = 0.6 + b * 1.1;
        g.fillRect(x - s / 2, y - s / 2, s, s);
      }
      // The moon: a wide halo, the disc with maria and a darker limb, then thin cloud lit from behind.
      const halo = g.createRadialGradient(mx, my, mr, mx, my, mr * 8);
      halo.addColorStop(0, 'rgba(255,240,210,0.24)');
      halo.addColorStop(0.35, 'rgba(255,240,210,0.07)');
      halo.addColorStop(1, 'rgba(255,240,210,0)');
      g.fillStyle = halo;
      g.fillRect(0, 0, W, H);
      g.save();
      g.beginPath();
      g.arc(mx, my, mr, 0, TAU);
      g.clip();
      const disc = g.createRadialGradient(mx - mr * 0.25, my - mr * 0.25, mr * 0.1, mx, my, mr);
      disc.addColorStop(0, '#fbf4e2');
      disc.addColorStop(0.75, '#efe3c6');
      disc.addColorStop(1, '#cdbf9f');
      g.fillStyle = disc;
      g.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
      for (const [ox, oy, rr, a] of [[-0.3, -0.2, 0.32, 0.16], [0.15, -0.35, 0.22, 0.13], [0.25, 0.1, 0.3, 0.12], [-0.1, 0.35, 0.2, 0.1], [-0.45, 0.25, 0.15, 0.09], [0.45, -0.1, 0.12, 0.08]]) {
        const cx = mx + ox * mr, cy = my + oy * mr, r = rr * mr;
        const m = g.createRadialGradient(cx, cy, 0, cx, cy, r);
        m.addColorStop(0, `rgba(120,112,98,${a})`);
        m.addColorStop(1, 'rgba(120,112,98,0)');
        g.fillStyle = m;
        g.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
      for (let k = 0; k < 18; k += 1) {
        const a = rand() * TAU, d = Math.sqrt(rand()) * mr * 0.85, r = mr * (0.03 + rand() * 0.06);
        g.fillStyle = 'rgba(120,110,95,0.1)';
        g.beginPath();
        g.arc(mx + Math.cos(a) * d, my + Math.sin(a) * d, r, 0, TAU);
        g.fill();
      }
      g.restore();
      // Thin cloud: soft wisps (radial gradients squashed flat, no hard edge), brighter near the moon.
      for (let k = 0; k < 7; k += 1) {
        const cy = my + (rand() - 0.3) * mr * 3, cx = mx + (rand() - 0.5) * mr * 7;
        const rw = mr * (2.5 + rand() * 4), rh = mr * (0.2 + rand() * 0.3);
        const near = clamp(1 - Math.hypot(cx - mx, cy - my) / (mr * 6), 0, 1);
        const cr = Math.round(40 + 160 * near), cg = Math.round(42 + 150 * near), cb = Math.round(70 + 120 * near);
        const wisp = g.createRadialGradient(cx, cy, 0, cx, cy, rw);
        wisp.addColorStop(0, `rgba(${cr},${cg},${cb},${(0.16 + 0.22 * near).toFixed(2)})`);
        wisp.addColorStop(0.6, `rgba(${cr},${cg},${cb},${(0.06 + 0.08 * near).toFixed(2)})`);
        wisp.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        g.save();
        g.translate(cx, cy);
        g.scale(1, rh / rw);
        g.translate(-cx, -cy);
        g.fillStyle = wisp;
        g.fillRect(cx - rw, cy - rw, rw * 2, rw * 2);
        g.restore();
      }
      // The tree lines. A crown is a cluster of small round clumps (a leafy edge); a spruce is a jagged spire. The near
      // row is first drawn a touch lighter, shifted towards the moon: a thin moonlit rim on that side.
      const crown = (x: number, base: number, w: number, h: number) => {
        const clumps = Math.round(10 + w * 0.5);
        for (let k = 0; k < clumps; k += 1) {
          const a = rand(), b = rand();
          const cx = x + (a - 0.5) * w * (0.4 + 0.6 * b);
          const cy = base - h * (0.25 + 0.75 * b * (1 - Math.abs(a - 0.5) * 0.9));
          const r = w * (0.08 + rand() * 0.12);
          g.moveTo(cx + r, cy);
          g.arc(cx, cy, r, 0, TAU);
        }
        g.moveTo(x - w * 0.3, base);
        g.rect(x - w * 0.3, base - h * 0.35, w * 0.6, h * 0.35 + 2);
      };
      const spruce = (x: number, base: number, w: number, h: number) => {
        const tiers = Math.round(6 + h / 8);
        g.moveTo(x, base - h);
        for (let k = 1; k <= tiers; k += 1) {
          const y = base - h + (h * k) / tiers;
          const half = (w / 2) * (k / tiers) * (0.85 + rand() * 0.3);
          g.lineTo(x + half, y);
          g.lineTo(x + half * 0.55, y - 1.5);
        }
        for (let k = tiers; k >= 1; k -= 1) {
          const y = base - h + (h * k) / tiers;
          const half = (w / 2) * (k / tiers) * (0.85 + rand() * 0.3);
          g.lineTo(x - half * 0.55, y - 1.5);
          g.lineTo(x - half, y);
        }
        g.closePath();
        g.moveTo(x - w * 0.5, base);
        g.rect(x - w * 0.5, base - 2, w, 4);
      };
      const treeRow = (base: number, scale: number) => {
        const out: { x: number; w: number; h: number; spruce: boolean }[] = [];
        let x = -30;
        while (x < W + 40) {
          const sp = rand() < 0.28;
          const h = H * scale * (sp ? 1.25 + rand() * 0.9 : 0.75 + rand() * 0.8);
          const w = sp ? h * (0.32 + rand() * 0.12) : h * (0.9 + rand() * 0.7);
          out.push({ x, w, h, spruce: sp });
          x += w * (sp ? 0.55 : 0.55 + rand() * 0.25);
        }
        return { base, items: out };
      };
      const paint = (row: ReturnType<typeof treeRow>, fill: string, dx = 0, dy = 0) => {
        g.fillStyle = fill;
        g.beginPath();
        g.rect(-10, row.base + dy - H * 0.03, W + 20, H);
        for (const t of row.items) (t.spruce ? spruce : crown)(t.x + dx, row.base + dy, t.w, t.h);
        g.fill();
      };
      const farRow = treeRow(horizon - H * 0.015, 0.05);
      const nearRow = treeRow(horizon + H * 0.012, 0.075);
      // A local generator, so the near row can be painted twice with exactly the same shapes (rim, then mass).
      const local = (seed: number) => {
        let s = seed >>> 0;
        return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      };
      paint(farRow, 'rgba(20,28,34,0.78)');
      // The near row twice: rim (lighter, nudged towards the moon), then the dark mass over it.
      const rowSeed = Math.floor(rand() * 1e9);
      const nearPaint = (fill: string, dx: number, dy: number) => {
        const r2 = local(rowSeed);
        const crown2 = (x: number, base: number, w: number, h: number) => {
          const clumps = Math.round(10 + w * 0.5);
          for (let k = 0; k < clumps; k += 1) {
            const a = r2(), b = r2();
            const cx = x + (a - 0.5) * w * (0.4 + 0.6 * b);
            const cy = base - h * (0.25 + 0.75 * b * (1 - Math.abs(a - 0.5) * 0.9));
            const r = w * (0.08 + r2() * 0.12);
            g.moveTo(cx + r, cy);
            g.arc(cx, cy, r, 0, TAU);
          }
          g.moveTo(x - w * 0.3, base);
          g.rect(x - w * 0.3, base - h * 0.35, w * 0.6, h * 0.35 + 2);
        };
        const spruce2 = (x: number, base: number, w: number, h: number) => {
          const tiers = Math.round(6 + h / 8);
          g.moveTo(x, base - h);
          const halves = Array.from({ length: tiers + 1 }, (_, k) => (w / 2) * (k / tiers) * (0.85 + r2() * 0.3));
          for (let k = 1; k <= tiers; k += 1) {
            const y = base - h + (h * k) / tiers;
            g.lineTo(x + halves[k], y);
            g.lineTo(x + halves[k] * 0.55, y - 1.5);
          }
          for (let k = tiers; k >= 1; k -= 1) {
            const y = base - h + (h * k) / tiers;
            g.lineTo(x - halves[k] * 0.55, y - 1.5);
            g.lineTo(x - halves[k], y);
          }
          g.closePath();
        };
        g.fillStyle = fill;
        g.beginPath();
        g.rect(-10, nearRow.base + dy - H * 0.04, W + 20, H);
        for (const t of nearRow.items) (t.spruce ? spruce2 : crown2)(t.x + dx, nearRow.base + dy, t.w, t.h);
        g.fill();
      };
      const toMoon = Math.atan2(my - nearRow.base, mx - W / 2);
      nearPaint('rgba(70,82,98,0.55)', Math.cos(toMoon) * 1.4, Math.sin(toMoon) * 1.4);
      nearPaint('rgba(7,11,13,1)', 0, 0);
      // Layered haze: a broad band and long soft wisps.
      const haze = g.createLinearGradient(0, horizon - H * 0.05, 0, horizon + H * 0.12);
      haze.addColorStop(0, 'rgba(160,170,190,0)');
      haze.addColorStop(0.5, 'rgba(150,165,185,0.14)');
      haze.addColorStop(1, 'rgba(150,165,185,0)');
      g.fillStyle = haze;
      g.fillRect(0, horizon - H * 0.05, W, H * 0.17);
      for (let k = 0; k < 26; k += 1) {
        const cx = rand() * W, cy = horizon + H * (0.005 + rand() * 0.07), rw = W * (0.08 + rand() * 0.18), rh = H * (0.006 + rand() * 0.012);
        const wisp = g.createRadialGradient(cx, cy, 0, cx, cy, rw);
        wisp.addColorStop(0, 'rgba(165,178,198,0.09)');
        wisp.addColorStop(1, 'rgba(165,178,198,0)');
        g.save();
        g.translate(cx, cy);
        g.scale(1, rh / rw);
        g.translate(-cx, -cy);
        g.fillStyle = wisp;
        g.fillRect(cx - rw, cy - rw, rw * 2, rw * 2);
        g.restore();
      }
      // The far meadow: out of the haze into the dark, combed with fine blades (moon-pale tips), dotted with flowers.
      const meadow = g.createLinearGradient(0, horizon - H * 0.01, 0, H);
      meadow.addColorStop(0, 'rgba(22,30,30,0)');
      meadow.addColorStop(0.08, 'rgba(18,26,24,1)');
      meadow.addColorStop(1, '#050806');
      g.fillStyle = meadow;
      g.fillRect(0, horizon - H * 0.01, W, H);
      g.lineCap = 'round';
      for (let k = 0; k < W * 2.2; k += 1) {
        const y = horizon + H * 0.01 + Math.pow(rand(), 0.7) * (H - horizon);
        const depth = (y - horizon) / (H - horizon);
        const len = 2 + depth * 14 * (0.5 + rand());
        const x = rand() * W;
        const bend = (rand() - 0.5) * len * 0.6;
        const lv = Math.round(24 + 18 * (1 - depth) + rand() * 12);
        g.strokeStyle = `rgba(${lv - 6},${lv + 7},${lv},${(0.35 + 0.4 * (1 - depth)).toFixed(2)})`;
        g.lineWidth = 0.5 + depth * 1.2;
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + bend * 0.3, y - len * 0.6, x + bend, y - len);
        g.stroke();
        if (rand() < 0.25) {
          g.strokeStyle = `rgba(150,165,175,${(0.12 + 0.18 * (1 - depth)).toFixed(2)})`;
          g.lineWidth = 0.5;
          g.beginPath();
          g.moveTo(x + bend * 0.7, y - len * 0.85);
          g.lineTo(x + bend, y - len);
          g.stroke();
        }
      }
      for (let k = 0; k < W * 0.16; k += 1) {
        const y = horizon + H * 0.02 + Math.pow(rand(), 0.8) * (H - horizon) * 0.9;
        const depth = (y - horizon) / (H - horizon);
        const x = rand() * W;
        const a = 0.14 + 0.24 * (1 - depth);
        if (rand() < 0.55) {
          // Chamomile: white petals round a yellow eye.
          const r = 0.8 + depth * 2.2;
          g.fillStyle = `rgba(215,222,228,${a.toFixed(2)})`;
          for (let p = 0; p < 6; p += 1) {
            const ang = (p / 6) * TAU;
            g.beginPath();
            g.ellipse(x + Math.cos(ang) * r, y + Math.sin(ang) * r * 0.5, r * 0.6, r * 0.3, ang, 0, TAU);
            g.fill();
          }
          g.fillStyle = `rgba(200,170,70,${a.toFixed(2)})`;
          g.beginPath();
          g.arc(x, y, r * 0.45, 0, TAU);
          g.fill();
        } else {
          // Yarrow: a flat umbel of tiny dots.
          const r = 1.5 + depth * 4;
          g.fillStyle = `rgba(200,205,215,${(a * 0.8).toFixed(2)})`;
          for (let p = 0; p < 9; p += 1) g.fillRect(x + (rand() - 0.5) * r * 2, y + (rand() - 0.5) * r * 0.6, 0.9 + depth, 0.9 + depth);
        }
      }
    }

    // A few stars twinkle live.
    const twinkles = Array.from({ length: Math.round(W / 40) }, () => ({ x: rand() * W, y: rand() * horizon * 0.8, ph: rand() * TAU, w: 1 + rand() * 2.5, s: 0.8 + rand() * 1.4 }));

    // ---- glow sprites (a hot core, a coloured body of light and a wide halo), the firefly's colour.
    const [fr, fg, fb] = rgb(flyCol);
    const sprite = (size: number, core: number) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = Math.max(8, Math.ceil(size * 2 * S));
      const g = cv.getContext('2d')!;
      const r = cv.width / 2;
      const gr = g.createRadialGradient(r, r, 0, r, r, r);
      gr.addColorStop(0, `rgba(255,255,240,${core})`);
      gr.addColorStop(0.07, `rgba(${Math.min(255, fr + 40)},${Math.min(255, fg + 30)},${fb},0.95)`);
      gr.addColorStop(0.18, `rgba(${fr},${fg},${fb},0.6)`);
      gr.addColorStop(0.4, `rgba(${fr},${fg},${fb},0.18)`);
      gr.addColorStop(0.7, `rgba(${fr},${fg},${fb},0.05)`);
      gr.addColorStop(1, `rgba(${fr},${fg},${fb},0)`);
      g.fillStyle = gr;
      g.fillRect(0, 0, cv.width, cv.height);
      return cv;
    };
    const sprites = Array.from({ length: N_SPRITES }, (_, i) => sprite(10 + i * 14, 1 - i * 0.3));

    // ---- grass: near blades drawn live, swaying; tapered, with timothy heads, yarrow umbels and broad leaves.
    type Blade = { x: number; h: number; lean: number; ph: number; w: number; kind: 0 | 1 | 2 | 3; depth: number; hue: number };
    const blades: Blade[] = [];
    const nBlades = Math.round(W / 3.2);
    for (let k = 0; k < nBlades; k += 1) {
      const depth = rand();
      const roll = rand();
      // 0 blade, 1 timothy head, 2 yarrow umbel, 3 broad leaf.
      const kind = (roll < 0.14 ? 1 : roll < 0.2 ? 2 : roll < 0.3 ? 3 : 0) as Blade['kind'];
      blades.push({ x: rand() * W, h: H * (0.06 + rand() * 0.22) * (0.6 + depth * 0.6) * (kind === 3 ? 0.55 : 1), lean: (rand() - 0.5) * (kind === 3 ? 1.2 : 0.5), ph: rand() * TAU, w: (0.8 + depth * 1.8) * (kind === 3 ? 3.2 : 1), kind, depth, hue: rand() });
    }
    blades.sort((a, b) => a.depth - b.depth);

    // ---- the fireflies.
    const n = Math.round(clamp((W * H) / 9000, 24, 140) * (c.body ? 0.85 : 1) * clamp(c.params.intensity, 0.3, 2));
    type Fly = { x: number; y: number; z: number; vx: number; vy: number; ph: number; w: number; seed: number; flash: number; heading: number; turn: number; rest: number; nextRest: number; trail: Float32Array; trailAt: number };
    const flies: Fly[] = Array.from({ length: n }, () => {
      const z = rand();
      const x = rand() * W, y = horizon - H * 0.15 + rand() * (H - horizon + H * 0.1);
      const trail = new Float32Array(TRAIL * 3);
      for (let k = 0; k < TRAIL; k += 1) { trail[k * 3] = x; trail[k * 3 + 1] = y; }
      return {
        x, y, z,
        vx: 0, vy: 0, ph: rand() * TAU, w: TAU / (2.2 + rand() * 1.2), seed: rand() * 100, flash: 0,
        heading: rand() * TAU, turn: 0, rest: 0, nextRest: 3 + rand() * 16, trail, trailAt: 0,
      };
    });
    const signals = createFireflySignals(n, rand);
    let gust = 0;
    let gustTarget = 0;
    let gustTimer = 0;
    let clock = 0;
    let trailClock = 0;
    let px = W / 2, py = H / 2, pon = false;
    const signalRadius = clamp(Math.sqrt(W * H / n) * .95, 42, 145);
    // Cached light footprints: no radial-gradient construction for every low flash on every frame.
    const groundGlow = sprite(70, .2);
    // The flashes that light the grass this frame (x, y, strength, reach).
    const lights: number[] = [];

    return {
      update(dt, _t, p) {
        const sdt = Math.min(dt, 0.05);
        clock += sdt;
        px = p.x;
        py = p.y;
        pon = p.active;
        // Gusts of wind now and then.
        gustTimer -= sdt;
        if (gustTimer <= 0) {
          gustTimer = 3 + rand() * 6;
          gustTarget = rand() < 0.5 ? 0.2 + rand() * 0.8 : 0;
        }
        gust += (gustTarget - gust) * Math.min(1, sdt * 0.8);
        const react = clamp(c.params.react, 0, 2);
        if (p.clicked && react > 0) {
          let nearest = -1, distance = Infinity;
          flies.forEach((f, i) => { const d = Math.hypot(f.x - p.rawX, f.y - p.rawY); if (d < distance) { distance = d; nearest = i; } });
          signals.trigger(nearest);
        }
        signals.update(sdt, flies, signalRadius);
        // The trails sample positions at a fixed rate (about 30 a second).
        trailClock += sdt;
        const sampleTrail = trailClock >= 1 / 30;
        if (sampleTrail) trailClock = 0;
        for (let index = 0; index < flies.length; index++) {
          const f = flies[index];
          // Near the cursor: drawn to it, and in step much sooner.
          const dx = px - f.x, dy = py - f.y;
          const d = Math.hypot(dx, dy) || 1;
          const near = pon ? clamp(1 - d / (Math.min(W, H) * 0.35), 0, 1) * react : 0;
          // A persistent heading with smooth changes of angular velocity, glides and short rests on grass.
          // No screen-edge teleport: turn inwards before reaching the edge.
          const t = clock + f.seed;
          f.turn += (Math.sin(t * .47) * .95 + Math.sin(t * 1.31 + f.ph) * .5 - f.turn) * (1 - Math.exp(-sdt * 1.8));
          f.heading += f.turn * sdt;
          f.nextRest -= sdt;
          if (f.nextRest <= 0) { f.rest = 1 + rand() * 2.5; f.nextRest = 10 + rand() * 20; }
          f.rest = Math.max(0, f.rest - sdt);
          if (near > .15) f.rest = 0;
          const speed = (7 + f.z * 17) * (.8 + .2 * Math.sin(t * .9));
          let ax = Math.cos(f.heading) * speed;
          let ay = Math.sin(f.heading) * speed * .48 + Math.sin(t * 2.7) * 2;
          if (f.rest > 0) { ax *= .06; ay = clamp((H * (.8 + .1 * f.z) - f.y) * .6, -12, 12); }
          const margin = Math.min(75, W * .12);
          if (f.x < margin) ax += (margin - f.x) * .65;
          if (f.x > W - margin) ax -= (f.x - W + margin) * .65;
          if (near > 0) {
            ax += (dx / d) * 60 * near - (dy / d) * 40 * near;
            ay += (dy / d) * 60 * near + (dx / d) * 40 * near;
          }
          const yTop = horizon - H * 0.25, yBot = H * 0.97;
          if (f.y < yTop) ay += (yTop - f.y) * 0.8;
          if (f.y > yBot) ay -= (f.y - yBot) * 0.8;
          f.vx += (ax - f.vx) * Math.min(1, sdt * 1.5);
          f.vy += (ay - f.vy) * Math.min(1, sdt * 1.5);
          f.x += (f.vx + gust * 8 * (0.4 + f.z)) * sdt * (0.6 + f.z * 0.8);
          f.y += f.vy * sdt * (0.6 + f.z * 0.8);
          f.x = clamp(f.x, -4, W + 4);
          f.y = clamp(f.y, yTop - 4, H - 3);
          // Idle glimmers never transmit. Only a click starts a neighbouring relay.
          f.flash = Math.max(signals.flash[index], .07 * Math.pow(.5 + .5 * Math.sin(clock * .8 + f.ph), 18));
          if (sampleTrail) {
            f.trailAt = (f.trailAt + 1) % TRAIL;
            f.trail[f.trailAt * 3] = f.x;
            f.trail[f.trailAt * 3 + 1] = f.y;
            f.trail[f.trailAt * 3 + 2] = f.flash;
          }
        }
        lights.length = 0;
        for (const f of flies) if (f.flash > 0.25 && f.y > horizon) lights.push(f.x, f.y, f.flash, 40 + f.z * 90);
      },
      draw(g) {
        g.drawImage(back, 0, 0, W, H);
        g.globalCompositeOperation = 'lighter';
        for (const s of twinkles) {
          const a = 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(clock * s.w + s.ph), 3);
          g.fillStyle = `rgba(255,252,240,${(a * 0.7).toFixed(2)})`;
          g.fillRect(s.x - s.s / 2, s.y - s.s / 2, s.s, s.s);
          if (a > 0.8) {
            g.fillStyle = `rgba(255,252,240,${((a - 0.8) * 1.2).toFixed(2)})`;
            g.fillRect(s.x - s.s * 2, s.y - 0.25, s.s * 4, 0.5);
            g.fillRect(s.x - 0.25, s.y - s.s * 2, 0.5, s.s * 4);
          }
        }
        g.globalCompositeOperation = 'source-over';
        // Far fireflies first (behind the near grass), near ones last.
        const drawFlies = (from: number, to: number) => {
          for (const f of flies) {
            if (f.z < from || f.z >= to) continue;
            const glowAmt = 0.045 + f.flash;
            const size = (6 + f.z * 26) * (0.7 + 0.5 * f.flash);
            // Near insects: the dark body and the blur of wings around the lantern (seen against the light).
            if (f.z > 0.72 && f.flash > 0.2) {
              const ang = Math.atan2(f.vy, f.vx);
              const bl = 2.2 + f.z * 4;
              g.save();
              g.translate(f.x, f.y);
              g.rotate(ang);
              g.fillStyle = `rgba(18,16,12,${Math.min(0.85, f.flash).toFixed(2)})`;
              g.beginPath();
              g.ellipse(bl * 0.55, 0, bl * 0.7, bl * 0.32, 0, 0, TAU);
              g.fill();
              const flap = 0.5 + 0.5 * Math.sin(clock * 55 + f.ph);
              g.fillStyle = `rgba(${fr},${fg},${fb},${((0.1 + 0.12 * flap) * f.flash).toFixed(2)})`;
              for (const side of [-1, 1]) {
                g.beginPath();
                g.ellipse(bl * 0.7, side * bl * (0.45 + 0.25 * flap), bl * 0.75, bl * 0.28, side * 0.5, 0, TAU);
                g.fill();
              }
              g.restore();
            }
            if (glowAmt < 0.02) continue;
            g.globalCompositeOperation = 'lighter';
            const sp = sprites[Math.min(N_SPRITES - 1, Math.floor(f.z * N_SPRITES))];
            // The afterglow trail of a strong flash: fading dots along the last positions.
            if (f.flash > 0.35) {
              for (let k = 1; k < TRAIL; k += 1) {
                const at = ((f.trailAt - k + TRAIL) % TRAIL) * 3;
                const a = f.trail[at + 2] * (1 - k / TRAIL) * 0.35 * (0.35 + 0.65 * f.z);
                if (a < 0.02) continue;
                const ts = size * (1 - k / (TRAIL + 2)) * 0.6;
                g.globalAlpha = a;
                g.drawImage(sp, f.trail[at] - ts, f.trail[at + 1] - ts, ts * 2, ts * 2);
              }
            }
            g.globalAlpha = clamp(glowAmt * (0.35 + 0.65 * f.z), 0, 1);
            g.drawImage(sp, f.x - size, f.y - size, size * 2, size * 2);
            if (f.flash > 0.5 && f.z > 0.4) {
              g.globalAlpha = (f.flash - 0.5) * 0.25 * f.z;
              g.drawImage(sprites[N_SPRITES - 1], f.x - size * 3, f.y - size * 3, size * 6, size * 6);
            }
            g.globalAlpha = 1;
            g.globalCompositeOperation = 'source-over';
          }
        };
        drawFlies(0, 0.55);
        // The grass, far (paler, thin) to near (dark, thick), swaying with the wind and the gusts. A blade near a flash
        // takes its light (warmer and brighter towards the flash).
        g.lineCap = 'round';
        const base = H + 2;
        for (const b of blades) {
          const sway = Math.sin(clock * (1.1 + b.depth * 0.6) + b.ph + b.x * 0.004) * (4 + 6 * b.depth) + gust * 22 * (0.4 + b.depth);
          const tipX = b.x + b.lean * b.h + sway;
          const tipY = base - b.h;
          let lit = 0;
          for (let k = 0; k < lights.length; k += 4) {
            const ddx = lights[k] - tipX, ddy = lights[k + 1] - (tipY + b.h * 0.3);
            const r = lights[k + 3];
            const d2 = ddx * ddx + ddy * ddy;
            if (d2 < r * r) lit += lights[k + 2] * (1 - Math.sqrt(d2) / r);
          }
          lit = Math.min(1, lit);
          const shade = 10 + (1 - b.depth) * 22;
          const cr = Math.round(shade - 4 + b.hue * 4 + lit * (fr * 0.55 - shade));
          const cg = Math.round(shade + 6 + b.hue * 3 + lit * (fg * 0.55 - shade));
          const cb = Math.round(shade + lit * (fb * 0.4 - shade));
          const col = `rgb(${cr},${cg},${cb})`;
          const midX = b.x + b.lean * b.h * 0.4 + sway * 0.35, midY = base - b.h * 0.55;
          // A tapered blade: two curves from a base of width w to a point.
          const w = b.w;
          const nx = (tipY - base), ny = -(tipX - b.x);
          const nl = Math.hypot(nx, ny) || 1;
          const ox = (nx / nl) * w * 0.5, oy = (ny / nl) * w * 0.5;
          g.fillStyle = col;
          g.beginPath();
          g.moveTo(b.x - ox, base - oy);
          g.quadraticCurveTo(midX - ox * 0.6, midY - oy * 0.6, tipX, tipY);
          g.quadraticCurveTo(midX + ox * 0.6, midY + oy * 0.6, b.x + ox, base + oy);
          g.closePath();
          g.fill();
          if (b.kind === 1) {
            // Timothy: a slim cylindrical seed head on a short bare stem.
            g.fillStyle = `rgb(${cr + 10},${cg + 10},${cb + 2})`;
            g.beginPath();
            g.ellipse(tipX, tipY - 3 - b.depth * 2, 1.5 + b.depth * 1.6, 5 + b.depth * 5, (b.lean + sway * 0.02) * 0.8, 0, TAU);
            g.fill();
          } else if (b.kind === 2) {
            // Yarrow: a flat umbel of tiny pale florets.
            const r = 3 + b.depth * 5;
            g.fillStyle = `rgba(${Math.round(150 + lit * 100)},${Math.round(155 + lit * 90)},${Math.round(160 + lit * 40)},${(0.35 + 0.35 * (1 - b.depth) + lit * 0.3).toFixed(2)})`;
            for (let k = 0; k < 9; k += 1) {
              const a = (k / 9) * TAU + b.ph;
              g.beginPath();
              g.arc(tipX + Math.cos(a) * r * 0.7, tipY + Math.sin(a) * r * 0.22, 0.7 + b.depth * 0.9, 0, TAU);
              g.fill();
            }
          }
        }
        // The flashes' light on the ground nearby (a warm wash where they glow low).
        g.globalCompositeOperation = 'lighter';
        for (const f of flies) {
          if (f.flash < 0.3 || f.y < H * 0.7) continue;
          const r = 30 + f.z * 50;
          g.globalAlpha = .22 * f.flash;
          g.drawImage(groundGlow, f.x - r, f.y - r * .42, r * 2, r * .84);
        }
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
        drawFlies(0.55, 1.01);
      },
    };
  },
};
