import type { CanvasSceneDef } from './types';
import { TAU, clamp, mixHex, rgb, rgba } from './kit';
import { createSandSim, type SandGrid, type SandSim } from './sandArtGL';

/**
 * An experimental effect: a "moving sand art" desk lamp — a round glass frame filled with clear liquid and layers of
 * coloured sand, standing in a crescent-moon stand of edge-lit acrylic on a white base with a touch switch.
 *
 * The sand is a cellular automaton inside the frame (owner: «дешёвка — усложни! и детализации побольше»): on the GPU
 * (sandArtGL.ts) a grid of up to ~1000² cells, about one a device pixel, so the grains are fine and the strata thin;
 * without WebGL2 the earlier CPU grid (up to 221²). Grains sink through the liquid and slide off to the side, each colour
 * at its own rate (light fine sand sinks slowest and slides furthest, dark coarse sand drops fast and stacks steep), so
 * the colours sort into fine layers on the way down. A divider across the middle has a few narrow openings; the sand of
 * the upper half trickles through them in thin veils and piles up below into a layered mountain landscape. When the
 * upper half has run out the frame turns over on its own (a click on the frame turns it at once) and the landscape
 * becomes the next load of falling sand. The grains are shaded by their neighbours (the slopes' faces lit from the upper
 * left, the backlit liquid through thin sand, darker deep in the pile), some glint (mica). Air bubbles rise through the
 * liquid. The sand is one of a few sets (dusk, ocean, desert, graphite), chosen at random. The acrylic glows along its
 * edges in the base's light, which slowly cycles through colours; a click on the base switches to the next colour, as
 * the touch switch does.
 */

const SAND_SETS: { name: string; colours: string[] }[] = [
  { name: 'Сумерки', colours: ['#2e2360', '#4b3d98', '#8d7fd4', '#f2efe6', '#1c2552', '#c6b7ef', '#6a5fb8', '#0f0d1c'] },
  { name: 'Океан', colours: ['#0b1f3a', '#1f5f8b', '#46b3d3', '#f4f1ea', '#121417', '#8fe0d8', '#2d7f86', '#c9d8de'] },
  { name: 'Пустыня', colours: ['#5a2d0c', '#b5541b', '#e89a3c', '#f6e7c8', '#1a1410', '#d9b27c', '#8c3b12', '#f2c46b'] },
  { name: 'Графит', colours: ['#0d0d0f', '#f2f2f0', '#7a7a7e', '#bfbfbd', '#2a2a2e', '#e0d9c8', '#4d4d52', '#a39c8c'] },
];
const LED = ['#6ad0ff', '#b07aff', '#ff5a9a', '#ff8a3a', '#ffe04a', '#5aff8a', '#ffffff', '#3affd8'];
const WALL = 255;
const PI_HALF = Math.PI / 2;

/** The frame's grid: the glass's circle, the divider with its openings, layers above, a landscape below. */
function makeGrid(N: number, rand: () => number, nColours: number) {
  const kind = new Uint8Array(N * N);
  const shade = new Uint8Array(N * N);
  const extra = new Uint8Array(N * N);
  const mid = (N - 1) / 2;
  const r = N / 2;
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      const dx = x + 0.5 - r;
      const dy = y + 0.5 - r;
      if (dx * dx + dy * dy > r * r) kind[y * N + x] = WALL;
    }
  }
  // Openings of different widths (wider ones run faster), spread unevenly along the divider.
  const holes: number[] = [];
  const count = 5 + Math.floor(rand() * 3);
  const unit = Math.max(1, Math.round(N / 300));
  for (let k = 0; k < count; k += 1) {
    const f = -0.72 + (1.44 * (k + 0.5)) / count + (rand() - 0.5) * (0.9 / count);
    const x0 = Math.round(mid + f * mid);
    const wide = unit * (rand() < 0.4 ? 2 : 1);
    for (let w = 0; w < wide; w += 1) holes.push(x0 + w);
  }
  for (let x = 0; x < N; x += 1) {
    const i = mid * N + x;
    if (kind[i] !== WALL && !holes.includes(x)) kind[i] = WALL;
  }
  // Along the divider: which way the nearest opening is (1 left, 2 right).
  const holeDir = new Int8Array(N);
  for (let x = 0; x < N; x += 1) {
    let best = -1;
    for (const h of holes) if (best < 0 || Math.abs(h - x) < Math.abs(best - x)) best = h;
    holeDir[x] = best < 0 ? 0 : Math.sign(best - x);
    if (kind[mid * N + x] === WALL) extra[mid * N + x] = holeDir[x] < 0 ? 1 : holeDir[x] > 0 ? 2 : 0;
  }
  // A sequence of strata: thin bands of the set's colours, never the same twice running, with thin white and dark
  // accent lines now and then; each its own thickness.
  const bands: { c: number; t: number }[] = [];
  {
    let c = Math.floor(rand() * nColours);
    for (let k = 0; k < 120; k += 1) {
      c = (c + 1 + Math.floor(rand() * (nColours - 1))) % nColours;
      const accent = rand() < 0.2;
      bands.push({ c, t: N * (accent ? 0.004 + rand() * 0.005 : 0.025 + rand() * 0.035) });
    }
  }
  const bandAt = (d: number) => {
    let s = 0;
    for (const b of bands) {
      s += b.t;
      if (d < s) return b.c;
    }
    return bands[bands.length - 1].c;
  };
  const put = (i: number, c: number) => {
    kind[i] = c + 1;
    shade[i] = Math.floor(rand() * 256);
    extra[i] = Math.floor(rand() * 256);
  };
  const ph = rand() * TAU;
  const noise = (x: number, y: number) => Math.sin(x * 0.043 + y * 0.021 + ph) * 0.6 + Math.sin(x * 0.11 - y * 0.05 + ph * 2) * 0.3 + Math.sin(x * 0.31 + y * 0.17) * 0.1;
  // Above the divider: the layers lie flat but wavy, as after a turn.
  const top = Math.round(mid * 0.42);
  for (let y = top; y < mid; y += 1) {
    for (let x = 0; x < N; x += 1) {
      const i = y * N + x;
      if (kind[i] !== 0) continue;
      const wave = noise(x, 0) * N * 0.018 + Math.sin(x * 0.015 + ph) * N * 0.02;
      put(i, bandAt(Math.max(0, mid - y + wave)));
    }
  }
  // Below: a landscape left by the last run — peaks under the openings, strata that follow their slopes and fold.
  const floor = N - 1;
  const ground = new Float32Array(N);
  const peaks = holes.filter((h, k) => k === 0 || h !== holes[k - 1] + 1).map((h) => ({ x: h, top: N * (0.1 + rand() * 0.09), w: N * (0.05 + rand() * 0.05) }));
  for (let x = 0; x < N; x += 1) {
    let h = N * 0.05;
    for (const pk of peaks) h = Math.max(h, N * 0.05 + (pk.top - N * 0.05) * Math.exp(-(((x - pk.x) / pk.w) ** 2)));
    ground[x] = h + noise(x, 5) * N * 0.01;
  }
  for (let y = floor; y > mid; y -= 1) {
    for (let x = 0; x < N; x += 1) {
      const i = y * N + x;
      if (kind[i] !== 0) continue;
      const depth = floor - y;
      if (depth > ground[x]) continue;
      const below = ground[x] - depth;
      put(i, bandAt(below * 0.85 + depth * 0.15 + noise(x, y) * N * 0.006));
    }
  }
  const grid: SandGrid = { n: N, kind, shade, extra };
  return { grid, holeDir, mid };
}

export const SAND_ART: CanvasSceneDef = {
  kind: 'canvas',
  id: 'sand-art',
  label: 'Песочная картина',
  palettes: [['#15131c', '#2a2533', '#e9ecf2', '#c9ced8']],
  create(c) {
    const W = c.width;
    const H = c.height;
    const S = c.dpr;
    const rand = c.rand;
    const [wallTop, wallLow, liquidCol, ringCol] = c.palette;
    const R = Math.min(W * 0.3, H * 0.3);
    const cx = W * 0.5;
    const cy = H * 0.42;
    const Rin = R * 0.9;
    const set = SAND_SETS[Math.floor(rand() * SAND_SETS.length)];
    const colours = set.colours.map((h) => rgb(h));
    // Per colour from its lightness: light fine sand sinks slowest and slides furthest, dark coarse sand drops fast and
    // stacks steep — which is what sorts the grains into separate layers on the way down.
    const lum = colours.map(([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255);
    const FALL = lum.map((l) => 0.98 - 0.45 * l);
    const SLIDE = lum.map((l) => 0.25 + 0.45 * l ** 1.5);
    const DRIFT = lum.map((l) => 0.04 + 0.3 * l * l);

    // The GPU grid: about a cell a device pixel (up to 1025²); odd, so the divider maps onto itself when turned over.
    const D = Math.max(64, Math.round(2 * Rin * Math.min(S, 2)));
    let sim: SandSim | null = null;
    let gpuGrid: ReturnType<typeof makeGrid> | null = null;
    try {
      const Ng = clamp(D, 201, 1025) | 1;
      gpuGrid = makeGrid(Ng, rand, colours.length);
      sim = createSandSim(gpuGrid.grid, colours.map(([r, g, b]) => [r / 255, g / 255, b / 255] as [number, number, number]), FALL, SLIDE, DRIFT, D);
    } catch (e) {
      console.error('[sand-art]', e);
      sim = null;
    }

    // Without WebGL2: the CPU grid, as before.
    const N = sim ? sim.n : Math.round(clamp((2 * Rin) / 1.6, 81, 221)) | 1;
    const cs = (2 * Rin) / N;
    const cpu = sim ? null : makeGrid(N, rand, colours.length);
    const mid = (N - 1) / 2;
    const small = cpu ? document.createElement('canvas') : null;
    const sg = small?.getContext('2d') ?? null;
    if (small) {
      small.width = N;
      small.height = N;
    }
    const img = sg ? sg.createImageData(N, N) : null;
    let order = false;
    const cpuStep = () => {
      if (!cpu) return;
      const { kind: grid, shade, extra } = cpu.grid;
      const holeDir = cpu.holeDir;
      const move = (from: number, to: number) => {
        grid[to] = grid[from];
        shade[to] = shade[from];
        extra[to] = extra[from];
        grid[from] = 0;
      };
      order = !order;
      for (let y = N - 2; y >= 0; y -= 1) {
        const row = y * N;
        for (let k = 0; k < N; k += 1) {
          const x = order ? k : N - 1 - k;
          const i = row + x;
          const v = grid[i];
          if (v === 0 || v === WALL) continue;
          const below = i + N;
          if (grid[below] === 0) {
            if (rand() < FALL[v - 1] * (y + 1 === mid ? 0.45 : 1)) move(i, below);
            continue;
          }
          if (y + 1 === mid && grid[below] === WALL && holeDir[x] !== 0 && rand() < 0.15) {
            const j = i + holeDir[x];
            if (grid[j] === 0) move(i, j);
            continue;
          }
          if (rand() > SLIDE[v - 1]) continue;
          const d = rand() < 0.5 ? -1 : 1;
          for (const dd of [d, -d]) {
            const nx = x + dd;
            if (nx < 0 || nx >= N) continue;
            if (grid[i + dd] === 0 && grid[below + dd] === 0) {
              move(i, below + dd);
              break;
            }
          }
        }
      }
    };
    const cpuFlip = () => {
      if (!cpu) return;
      cpu.grid.kind.reverse();
      cpu.grid.shade.reverse();
      cpu.grid.extra.reverse();
      cpu.holeDir.reverse();
      for (let x = 0; x < N; x += 1) cpu.holeDir[x] = -cpu.holeDir[x];
    };
    const cpuUpper = () => {
      if (!cpu) return 0;
      let n = 0;
      for (let i = 0; i < mid * N; i += 1) if (cpu.grid.kind[i] !== 0 && cpu.grid.kind[i] !== WALL) n += 1;
      return n;
    };

    // The sand above the divider and, for the bubbles, how full each part of the glass is (GPU: 32 × 32 tiles).
    let tiles: { occupancy: Float32Array; tiles: number; tile: number } | null = null;
    const measure = () => {
      if (sim) {
        const m = sim.count();
        tiles = m;
        return m.upper;
      }
      return cpuUpper();
    };
    const solidAt = (x: number, y: number) => {
      const gx = Math.floor(((x + Rin) / (2 * Rin)) * N);
      const gy = Math.floor(((y + Rin) / (2 * Rin)) * N);
      if (gx < 0 || gy < 0 || gx >= N || gy >= N) return true;
      if (cpu) return cpu.grid.kind[gy * N + gx] !== 0;
      if (!tiles) return false;
      const t = tiles.tile;
      return tiles.occupancy[Math.floor(gy / t) * tiles.tiles + Math.floor(gx / t)] > 0.35;
    };

    // Start as if it had been running for a while.
    if (sim) sim.step(Math.round(N * 0.3));
    else for (let k = 0; k < 120; k += 1) cpuStep();

    // The room, painted once: a dim wall with a faint plaster grain, a desk of dark wood, the lamp's shadow on it.
    const room = document.createElement('canvas');
    room.width = Math.ceil(W * S);
    room.height = Math.ceil(H * S);
    const deskY = cy + R * 1.72;
    const baseTop = cy + R * 1.42;
    const baseW = R * 0.95;
    const baseH = R * 0.34;
    {
      const g = room.getContext('2d')!;
      g.scale(S, S);
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, wallTop);
      gr.addColorStop(1, wallLow);
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
      for (let k = 0; k < (W * H) / 90; k += 1) {
        g.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.018)' : 'rgba(0,0,0,0.03)';
        g.fillRect(rand() * W, rand() * deskY, 1 + rand() * 1.5, 1 + rand() * 1.5);
      }
      const desk = g.createLinearGradient(0, deskY, 0, H);
      desk.addColorStop(0, '#3e2f26');
      desk.addColorStop(1, '#170f0b');
      g.fillStyle = desk;
      g.fillRect(0, deskY, W, H - deskY);
      // The wood's grain: long faint streaks, closer together towards the viewer.
      g.save();
      g.beginPath();
      g.rect(0, deskY, W, H - deskY);
      g.clip();
      for (let k = 0; k < 70; k += 1) {
        const y = deskY + (H - deskY) * Math.pow(rand(), 0.8);
        g.strokeStyle = rand() < 0.5 ? 'rgba(255,220,180,0.035)' : 'rgba(0,0,0,0.12)';
        g.lineWidth = 0.6 + rand() * 1.4;
        g.beginPath();
        g.moveTo(0, y);
        for (let x = 0; x <= W; x += 40) g.lineTo(x, y + Math.sin(x * 0.01 + k) * 2.5);
        g.stroke();
      }
      g.restore();
      g.fillStyle = 'rgba(255,255,255,0.07)';
      g.fillRect(0, deskY, W, 1.5);
      // The lamp's soft shadow on the desk.
      const sh = g.createRadialGradient(cx, baseTop + baseH * 1.05, 0, cx, baseTop + baseH * 1.05, baseW * 0.85);
      sh.addColorStop(0, 'rgba(0,0,0,0.55)');
      sh.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sh;
      g.beginPath();
      g.ellipse(cx, baseTop + baseH * 1.05, baseW * 0.85, baseH * 0.45, 0, 0, TAU);
      g.fill();
    }

    // Shapes of the acrylic stand: a crescent moon behind the frame, a U-shaped cradle and its stem in front.
    const moonPath = (g: CanvasRenderingContext2D) => {
      g.beginPath();
      g.arc(cx + R * 0.12, cy + R * 0.02, R * 1.36, -PI_HALF * 1.05, PI_HALF * 1.35);
      g.arc(cx - R * 0.24, cy - R * 0.06, R * 1.15, PI_HALF * 1.1, -PI_HALF * 0.95, true);
      g.closePath();
    };
    const cradlePath = (g: CanvasRenderingContext2D, r0: number, r1: number, a0: number, a1: number) => {
      g.beginPath();
      g.arc(cx, cy, r1, a0, a1);
      g.arc(cx, cy, r0, a1, a0, true);
      g.closePath();
    };
    const stemPath = (g: CanvasRenderingContext2D) => {
      g.beginPath();
      g.rect(cx - R * 0.07, cy + R * 1.16, R * 0.14, baseTop - (cy + R * 1.16));
    };

    let clock = 0;
    let angle = 0;
    let flipping = -1;
    let checkAt = 0;
    let upperStart = Math.max(1, measure());
    // The grains left above the divider, sampled twice a second over the last 3 s.
    const history: number[] = [];
    let ticks = 0;
    let ledIndex = 0;
    let ledManual = false;
    let led = LED[0];
    let ledShown = LED[0];
    const bubbles: { x: number; y: number; r: number; v: number; ph: number }[] = [];

    // Edge-lit acrylic: a frosted pane (a little of the light inside it, darker towards its inner edge, as if engraved)
    // and the light leaking out of its cut edges.
    const acrylicGlow = (g: CanvasRenderingContext2D, path: () => void, col: string) => {
      g.save();
      path();
      const fill = g.createLinearGradient(cx - R * 1.4, cy - R * 1.4, cx + R * 1.4, cy + R * 1.4);
      fill.addColorStop(0, 'rgba(255,255,255,0.08)');
      fill.addColorStop(0.5, rgba(col, 0.05));
      fill.addColorStop(1, 'rgba(255,255,255,0.03)');
      g.fillStyle = fill;
      g.fill();
      g.clip();
      path();
      g.strokeStyle = 'rgba(0,0,0,0.22)';
      g.lineWidth = R * 0.07;
      g.stroke();
      path();
      g.strokeStyle = rgba(col, 0.35);
      g.lineWidth = R * 0.03;
      g.stroke();
      g.restore();
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (const [w, a] of [[R * 0.12, 0.04], [R * 0.05, 0.1], [R * 0.02, 0.4], [R * 0.008, 0.95]] as const) {
        path();
        g.strokeStyle = rgba(col, a);
        g.lineWidth = w;
        g.lineJoin = 'round';
        g.stroke();
      }
      g.restore();
    };

    const toUnit = (hex: string) => rgb(hex).map((v) => v / 255) as [number, number, number];
    const liquidUnit = toUnit(liquidCol);

    return {
      update(dt, _t, p) {
        const sdt = Math.min(dt, 0.05);
        clock += sdt;
        const speed = clamp(c.params.speed, 0, 4);
        // The light: slowly round the colours, or the one the base was switched to.
        if (!ledManual) {
          const f = (clock * 0.08) % LED.length;
          led = mixHex(LED[Math.floor(f)], LED[(Math.floor(f) + 1) % LED.length], f % 1);
        } else led = LED[ledIndex];
        ledShown = mixHex(ledShown, led, Math.min(1, sdt * 4));

        if (p.active && p.clicked && c.params.react > 0) {
          const onBase = Math.abs(p.rawX - cx) < baseW / 2 && p.rawY > baseTop - baseH * 0.3 && p.rawY < baseTop + baseH * 1.2;
          const onFrame = Math.hypot(p.rawX - cx, p.rawY - cy) < R;
          if (onBase) {
            ledIndex = ledManual ? (ledIndex + 1) % LED.length : 0;
            ledManual = true;
          } else if (onFrame && flipping < 0) flipping = 0;
        }
        if (flipping >= 0) {
          // Turning over: the sand holds still while the frame turns, then the grid is the other way up.
          flipping += sdt / 1.6;
          const e = Math.min(1, flipping);
          angle = Math.PI * (e < 0.5 ? 4 * e * e * e : 1 - (-2 * e + 2) ** 3 / 2);
          if (flipping >= 1) {
            if (sim) sim.flip();
            else cpuFlip();
            angle = 0;
            flipping = -1;
            upperStart = Math.max(1, measure());
            history.length = 0;
            bubbles.length = 0;
          }
          return;
        }
        // About as fast through the glass as before, however fine the grid: passes in proportion to its size.
        const rate = (90 * N) / 221;
        ticks = Math.min(ticks + sdt * rate * speed, sim ? 14 : 8);
        const passes = Math.floor(ticks);
        ticks -= passes;
        if (sim) sim.step(passes);
        else for (let k = 0; k < passes; k += 1) cpuStep();
        if (clock > checkAt && speed > 0) {
          // Turn over once the upper half has run out, or nothing more has got through for a few seconds.
          checkAt = clock + 0.5;
          history.push(measure());
          if (history.length > 7) history.shift();
          const now = history[history.length - 1];
          if (now < upperStart * 0.02 || (history.length === 7 && history[0] - now < upperStart * 0.004)) flipping = 0;
        }
        // Air bubbles rising through the liquid, wobbling, gone when they reach sand.
        if (bubbles.length < 14 && rand() < sdt * 2) {
          const a = rand() * TAU;
          const rr = Math.sqrt(rand()) * Rin * 0.85;
          const b = { x: Math.cos(a) * rr, y: Math.abs(Math.sin(a)) * rr, r: Math.max(0.8, cs) * (0.7 + rand() * 1.6), v: Rin * (0.04 + rand() * 0.06), ph: rand() * TAU };
          if (!solidAt(b.x, b.y)) bubbles.push(b);
        }
        for (let k = bubbles.length - 1; k >= 0; k -= 1) {
          const b = bubbles[k];
          b.y -= b.v * sdt;
          b.x += Math.sin(clock * 3 + b.ph) * b.r * 0.8 * sdt;
          if (solidAt(b.x, b.y - b.r) || b.x * b.x + b.y * b.y > Rin * Rin) bubbles.splice(k, 1);
        }
      },
      draw(g) {
        g.drawImage(room, 0, 0, W, H);
        // The light spills onto the wall and the desk.
        g.save();
        g.globalCompositeOperation = 'lighter';
        const spill = g.createRadialGradient(cx, cy, R * 0.5, cx, cy, R * 3.2);
        spill.addColorStop(0, rgba(ledShown, 0.2));
        spill.addColorStop(1, rgba(ledShown, 0));
        g.fillStyle = spill;
        g.fillRect(0, 0, W, H);
        const pool = g.createRadialGradient(cx, deskY + R * 0.1, 0, cx, deskY + R * 0.1, R * 2);
        pool.addColorStop(0, rgba(ledShown, 0.26));
        pool.addColorStop(1, rgba(ledShown, 0));
        g.fillStyle = pool;
        g.fillRect(cx - R * 2, deskY, R * 4, H - deskY);
        g.restore();

        acrylicGlow(g, () => moonPath(g), ledShown);

        // The frame, turning when it turns over: a chrome ring, the lit liquid with the sand, bubbles, the glass.
        g.save();
        g.translate(cx, cy);
        g.rotate(angle);
        // Chrome: a turned ring that mirrors the room (bright and dark bands round it), bevelled on both edges.
        const ring = typeof g.createConicGradient === 'function' ? g.createConicGradient(-0.6, 0, 0) : g.createLinearGradient(-R, -R, R, R);
        const stops: [number, string][] = [[0, '#fbfcff'], [0.09, ringCol], [0.18, '#6d737f'], [0.27, '#eef1f6'], [0.4, '#9097a3'], [0.52, '#fdfdff'], [0.63, '#7a808c'], [0.75, '#dfe3ea'], [0.86, '#5f6571'], [1, '#fbfcff']];
        for (const [o, col] of stops) ring.addColorStop(o, col);
        g.fillStyle = ring;
        g.beginPath();
        g.arc(0, 0, R, 0, TAU);
        g.fill();
        g.lineWidth = Math.max(1, R * 0.012);
        g.strokeStyle = 'rgba(255,255,255,0.7)';
        g.beginPath();
        g.arc(0, 0, R - g.lineWidth / 2, Math.PI * 1.05, Math.PI * 1.75);
        g.stroke();
        g.strokeStyle = 'rgba(0,0,0,0.35)';
        g.beginPath();
        g.arc(0, 0, R - g.lineWidth / 2, Math.PI * 0.05, Math.PI * 0.75);
        g.stroke();
        // The inner bevel: dark where the ring steps down to the glass.
        g.strokeStyle = 'rgba(20,22,28,0.55)';
        g.lineWidth = R * 0.025;
        g.beginPath();
        g.arc(0, 0, Rin + R * 0.012, 0, TAU);
        g.stroke();
        if (sim) {
          sim.render({ led: toUnit(ledShown), liquid: liquidUnit, time: clock });
          g.drawImage(sim.canvas, -Rin, -Rin, Rin * 2, Rin * 2);
        } else if (cpu && img && sg && small) {
          const liquid = g.createRadialGradient(-Rin * 0.3, -Rin * 0.3, 0, 0, 0, Rin);
          liquid.addColorStop(0, mixHex(liquidCol, '#ffffff', 0.4));
          liquid.addColorStop(1, mixHex(liquidCol, ledShown, 0.18));
          g.fillStyle = liquid;
          g.beginPath();
          g.arc(0, 0, Rin, 0, TAU);
          g.fill();
          const data = img.data;
          const { kind, shade } = cpu.grid;
          for (let i = 0; i < N * N; i += 1) {
            const v = kind[i];
            const o = i * 4;
            if (v === 0) {
              data[o + 3] = 0;
            } else if (v === WALL) {
              const y = Math.floor(i / N);
              data[o] = 200;
              data[o + 1] = 205;
              data[o + 2] = 215;
              data[o + 3] = y === mid ? 90 : 0;
            } else {
              const col = colours[v - 1];
              const k = 0.8 + (0.4 * shade[i]) / 255;
              data[o] = Math.min(255, col[0] * k);
              data[o + 1] = Math.min(255, col[1] * k);
              data[o + 2] = Math.min(255, col[2] * k);
              data[o + 3] = 255;
            }
          }
          sg.putImageData(img, 0, 0);
          g.save();
          g.beginPath();
          g.arc(0, 0, Rin, 0, TAU);
          g.clip();
          g.imageSmoothingEnabled = cs > 2.2;
          g.drawImage(small, -Rin, -Rin, Rin * 2, Rin * 2);
          g.imageSmoothingEnabled = true;
          g.restore();
        }
        g.save();
        g.beginPath();
        g.arc(0, 0, Rin, 0, TAU);
        g.clip();
        // Bubbles: a thin bright rim, lit on the side towards the light, a speck of highlight.
        for (const b of bubbles) {
          g.strokeStyle = 'rgba(255,255,255,0.55)';
          g.lineWidth = Math.max(0.5, b.r * 0.28);
          g.beginPath();
          g.arc(b.x, b.y, b.r, 0, TAU);
          g.stroke();
          g.fillStyle = 'rgba(255,255,255,0.8)';
          g.beginPath();
          g.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, Math.max(0.4, b.r * 0.25), 0, TAU);
          g.fill();
        }
        // The glass over it: a window's soft reflection across the upper left, a curved streak and a glint.
        g.rotate(-angle);
        const win = g.createLinearGradient(-Rin, -Rin, Rin * 0.2, Rin * 0.2);
        win.addColorStop(0, 'rgba(255,255,255,0.16)');
        win.addColorStop(0.45, 'rgba(255,255,255,0.05)');
        win.addColorStop(0.5, 'rgba(255,255,255,0)');
        g.fillStyle = win;
        g.beginPath();
        g.moveTo(-Rin, -Rin * 0.15);
        g.lineTo(-Rin * 0.15, -Rin);
        g.lineTo(Rin * 0.05, -Rin);
        g.lineTo(-Rin, Rin * 0.05);
        g.closePath();
        g.fill();
        g.restore();
        g.rotate(-angle);
        g.strokeStyle = 'rgba(255,255,255,0.32)';
        g.lineWidth = R * 0.045;
        g.lineCap = 'round';
        g.beginPath();
        g.arc(0, 0, Rin * 0.86, Math.PI * 1.1, Math.PI * 1.42);
        g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.12)';
        g.lineWidth = R * 0.02;
        g.beginPath();
        g.arc(0, 0, Rin * 0.9, Math.PI * 0.15, Math.PI * 0.4);
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.6)';
        g.beginPath();
        g.arc(Math.cos(Math.PI * 1.3) * Rin * 0.74, Math.sin(Math.PI * 1.3) * Rin * 0.74, R * 0.028, 0, TAU);
        g.fill();
        g.restore();

        // The cradle, its stem and the base in front.
        acrylicGlow(g, () => cradlePath(g, R * 1.02, R * 1.16, PI_HALF * 0.25, PI_HALF * 1.75), ledShown);
        acrylicGlow(g, () => stemPath(g), ledShown);
        // The base: a white cylinder, its curved side shaded, the top lit by the slot's light, a groove round the top.
        const body = g.createLinearGradient(cx - baseW / 2, 0, cx + baseW / 2, 0);
        body.addColorStop(0, '#9fa3ab');
        body.addColorStop(0.18, '#d9dce1');
        body.addColorStop(0.42, '#fafbfc');
        body.addColorStop(0.7, '#e1e4e9');
        body.addColorStop(1, '#8e929a');
        g.fillStyle = body;
        g.beginPath();
        g.ellipse(cx, baseTop + baseH, baseW / 2, baseH * 0.28, 0, 0, Math.PI);
        g.lineTo(cx - baseW / 2, baseTop);
        g.ellipse(cx, baseTop, baseW / 2, baseH * 0.28, 0, Math.PI, 0, true);
        g.closePath();
        g.fill();
        // The light of the LED on the desk side of the base (the lower edge).
        g.save();
        g.globalCompositeOperation = 'lighter';
        const foot = g.createLinearGradient(0, baseTop + baseH * 0.9, 0, baseTop + baseH * 1.3);
        foot.addColorStop(0, rgba(ledShown, 0));
        foot.addColorStop(1, rgba(ledShown, 0.18));
        g.fillStyle = foot;
        g.fillRect(cx - baseW / 2, baseTop + baseH * 0.9, baseW, baseH * 0.4);
        g.restore();
        const topFace = g.createRadialGradient(cx - baseW * 0.15, baseTop - baseH * 0.08, 0, cx, baseTop, baseW * 0.6);
        topFace.addColorStop(0, '#ffffff');
        topFace.addColorStop(1, '#dfe2e7');
        g.fillStyle = topFace;
        g.beginPath();
        g.ellipse(cx, baseTop, baseW / 2, baseH * 0.28, 0, 0, TAU);
        g.fill();
        g.strokeStyle = 'rgba(120,125,135,0.45)';
        g.lineWidth = 1;
        g.beginPath();
        g.ellipse(cx, baseTop, baseW * 0.44, baseH * 0.24, 0, 0, TAU);
        g.stroke();
        g.save();
        g.globalCompositeOperation = 'lighter';
        const slot = g.createRadialGradient(cx, baseTop, 0, cx, baseTop, baseW * 0.4);
        slot.addColorStop(0, rgba(ledShown, 0.85));
        slot.addColorStop(1, rgba(ledShown, 0));
        g.fillStyle = slot;
        g.beginPath();
        g.ellipse(cx, baseTop, baseW * 0.4, baseH * 0.2, 0, 0, TAU);
        g.fill();
        g.restore();
        // The touch switch: a power symbol on the front, glowing faintly in the chosen colour once switched.
        const bx = cx;
        const by = baseTop + baseH * 0.62;
        const br = baseH * 0.2;
        g.strokeStyle = ledManual ? rgba(ledShown, 0.9) : 'rgba(120,125,135,0.8)';
        g.lineWidth = Math.max(1, br * 0.18);
        g.lineCap = 'round';
        g.beginPath();
        g.arc(bx, by, br, -Math.PI * 0.3, Math.PI * 1.3);
        g.moveTo(bx, by - br * 1.2);
        g.lineTo(bx, by - br * 0.2);
        g.stroke();
      },
      dispose() {
        sim?.dispose();
      },
    };
  },
};
