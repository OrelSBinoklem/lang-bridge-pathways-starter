import type { CanvasSceneDef, SceneInstance, SceneParams, SceneCtx } from './types';
import type { LedFigures, LedFiguresLook } from './ledFiguresGL';
import { createOrbit, orbitView } from './orbitControl';
import { TAU, clamp, rgb } from './kit';
import { VOXEL_LED_CUBE_2D } from './canvasScenes7';
import { LED_N, createLedCubeRenderer } from './ledCubeGL';
import { createLedPinball } from './ledPinball';
import { createMissionPinball } from './pinballMissionTable';
import { createPinballSkyline } from './pinballSkyline';
import { createFiestaPinball } from './pinballFiesta';

/**
 * A 20³ cube of RGB LEDs on a circuit board, rendered as real LEDs (ledCubeGL.ts) and playing festive volume
 * programs: 3D fireworks (rockets that rise, stop and burst into spheres of stars that fall and fade), a rainbow
 * shell, three rainbow helices, snow with glitter, a torus round a pulsing core. Programs change every 8–14 s with a
 * crossfade; a click fires a shell. Without WebGL2 the flat 2D cube (canvasScenes7.ts) is drawn instead.
 * (VOXEL_LED_CUBE at the end of this file wraps it, with New Year LED figures as the other variants.)
 */

const N = LED_N;
const COUNT = N * N * N;
const STEP = 2 / (N - 1);

type Spark = { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number; r: number; g: number; b: number; kind: 0 | 1 | 2 };

function hsv(h: number, s: number, v: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h * 6) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}
const toLinear = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** Festive firework colours, as hues (a few pure colours, gold and white). */
const SHELL_COLORS: [number, number, number][] = [
  [1, 0.12, 0.2], [0.15, 1, 0.3], [0.2, 0.45, 1], [1, 0.75, 0.2], [0.85, 0.3, 1], [1, 0.45, 0.1], [0.9, 0.95, 1], [0.1, 0.9, 1],
];

const PROGRAMS = [
  { name: 'fireworks', time: 14 },
  { name: 'shell', time: 8 },
  { name: 'helix', time: 8 },
  { name: 'snow', time: 9 },
  { name: 'torus', time: 8 },
] as const;

const CUBE_ONLY: CanvasSceneDef = {
  kind: 'canvas',
  id: 'voxel-led-cube',
  label: 'Светодиодный куб 20³',
  defaultParams: { speed: 1, intensity: 1, react: 0.7 },
  palettes: [
    ['#07040f', '#ff4d6d', '#ffd166', '#4dd2ff'],
    ['#020b14', '#37dced', '#4e80ff', '#c9fff0'],
    ['#120719', '#df65ff', '#687dff', '#fff0a3'],
  ],
  create: createCube,
};

function createCube(c: SceneCtx, classicPinball = false): SceneInstance {
    const W = c.width;
    const H = c.height;
    const S = c.body ? 1 : Math.min(c.dpr, 2);
    const aw = Math.max(2, Math.round(W * S));
    const ah = Math.max(2, Math.round(H * S));
    const mobileBody = c.body && W <= 700;
    const size = c.body
      ? mobileBody ? Math.min(W * 0.31, H * 0.28) : Math.min(W, H) * 0.2
      : Math.min(W, H) * 0.34;
    // Leave text space on desktop; on phones the cube is the full-width focal point.
    const cx = mobileBody ? W * 0.5 : W - size * 1.85;
    const cy = 0.5 * H;
    const hasPinball = c.body && (c.params.leisurePinball === 1 || c.params.leisurePinball === 2 || c.params.leisurePinball === 3);
    const bg = rgb(c.palette[0]).map(toLinear) as [number, number, number];
    const renderer = createLedCubeRenderer({
      width: aw,
      height: ah,
      center: [cx * S, ah - (hasPinball && mobileBody ? H * .24 : cy) * S],
      size: size * S,
      background: [bg, bg.map((v) => v * 0.35) as [number, number, number]],
    });
    if (!renderer) return VOXEL_LED_CUBE_2D.create(c);

    const rand = c.rand;
    const acc = new Float32Array(COUNT * 3);
    const volume = new Uint8Array(COUNT * 4);
    const sparks: Spark[] = [];
    const flakes = Array.from({ length: 70 }, () => ({ x: rand() * 2 - 1, y: rand() * 2 - 1, z: rand() * 2 - 1, v: 0.18 + rand() * 0.2 }));
    const twinkles: { i: number; age: number; life: number; r: number; g: number; b: number }[] = [];
    const palette = c.palette.map((hex) => rgb(hex).map((v) => v / 255));
    let clock = 0;
    // Start past the crossfade, straight into the first program.
    let programAt = 1;
    let program = 0;
    let launchIn = 0.2;
    let yaw = 0.6;
    const rot = new Float32Array(9);

    const add = (i: number, r: number, g: number, b: number) => {
      acc[i * 3] += r;
      acc[i * 3 + 1] += g;
      acc[i * 3 + 2] += b;
    };
    /** Spreads a point of light over the 8 LEDs around it. */
    const splat = (x: number, y: number, z: number, r: number, g: number, b: number) => {
      const u = ((x + 1) / 2) * (N - 1);
      const v = ((y + 1) / 2) * (N - 1);
      const w = ((z + 1) / 2) * (N - 1);
      if (u < -0.5 || v < -0.5 || w < -0.5 || u > N - 0.5 || v > N - 0.5 || w > N - 0.5) return;
      const i0 = Math.floor(u);
      const j0 = Math.floor(v);
      const k0 = Math.floor(w);
      const fu = u - i0;
      const fv = v - j0;
      const fw = w - k0;
      for (let dk = 0; dk < 2; dk += 1) {
        const k = k0 + dk;
        if (k < 0 || k >= N) continue;
        const wk = dk ? fw : 1 - fw;
        for (let dj = 0; dj < 2; dj += 1) {
          const j = j0 + dj;
          if (j < 0 || j >= N) continue;
          const wj = (dj ? fv : 1 - fv) * wk;
          for (let di = 0; di < 2; di += 1) {
            const i = i0 + di;
            if (i < 0 || i >= N) continue;
            const wt = (di ? fu : 1 - fu) * wj;
            add(i + j * N + k * N * N, r * wt, g * wt, b * wt);
          }
        }
      }
    };

    const burst = (x: number, y: number, z: number, color?: [number, number, number]) => {
      if (sparks.length > 1000) sparks.splice(0, sparks.length - 1000);
      const a = color ?? SHELL_COLORS[Math.floor(rand() * SHELL_COLORS.length)];
      const b = !color && rand() < 0.4 ? SHELL_COLORS[Math.floor(rand() * SHELL_COLORS.length)] : a;
      const glitter = rand() < 0.3;
      const count = 70 + Math.floor(rand() * 50);
      const speed = 0.75 + rand() * 0.35;
      for (let s = 0; s < count; s += 1) {
        // Even directions on the sphere (a golden-angle spiral with a little jitter).
        const t = (s + 0.5) / count;
        const phi = Math.acos(1 - 2 * t);
        const th = s * 2.39996 + rand() * 0.3;
        const sp = speed * (0.9 + rand() * 0.2);
        const col = s % 2 ? a : b;
        sparks.push({
          x, y, z,
          vx: Math.sin(phi) * Math.cos(th) * sp, vy: Math.cos(phi) * sp, vz: Math.sin(phi) * Math.sin(th) * sp,
          age: 0, life: 1.3 + rand() * 0.6, r: col[0], g: col[1], b: col[2], kind: glitter ? 2 : 1,
        });
      }
    };
    const launch = () => {
      sparks.push({
        x: (rand() - 0.5) * 0.9, y: -1, z: (rand() - 0.5) * 0.9, vx: (rand() - 0.5) * 0.2, vy: 2.2 + rand() * 0.45, vz: (rand() - 0.5) * 0.2,
        age: 0, life: 9, r: 1, g: 0.72, b: 0.35, kind: 0,
      });
    };
    const pinball = !hasPinball ? null : c.params.leisurePinball === 3
      ? createFiestaPinball(W, H, color => burst((rand() - .5) * .7, .15, (rand() - .5) * .7, color), c.locale)
      : c.params.leisurePinball === 2
      ? createPinballSkyline(W, H, color => burst((rand() - .5) * .7, .15, (rand() - .5) * .7, color), c.contentVisible === false)
      : classicPinball
        ? createLedPinball(W, H, color => burst((rand() - .5) * .7, .15, (rand() - .5) * .7, color))
        : createMissionPinball(W, H, color => burst((rand() - .5) * .7, .15, (rand() - .5) * .7, color), c.locale);

    const fireworks = (dt: number, weight: number) => {
      launchIn -= dt;
      if (weight > 0.5 && launchIn <= 0) {
        launch();
        launchIn = 0.7 + rand() * 1.1;
      }
      for (let i = sparks.length - 1; i >= 0; i -= 1) {
        const s = sparks[i];
        s.age += dt;
        if (s.kind === 0) {
          s.vy -= 2.4 * dt;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.z += s.vz * dt;
          splat(s.x, s.y, s.z, 1.4, 1.0, 0.55);
          if (s.vy < 0.25) {
            burst(s.x, s.y, s.z);
            sparks.splice(i, 1);
          }
          continue;
        }
        // Stars: air drag, gravity, burning out; glittering ones crackle towards the end.
        const drag = Math.exp(-1.7 * dt);
        s.vx *= drag;
        s.vy = s.vy * drag - 0.75 * dt;
        s.vz *= drag;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.z += s.vz * dt;
        const k = s.age / s.life;
        if (k >= 1) {
          sparks.splice(i, 1);
          continue;
        }
        let e = (1 - k) ** 1.4 * (k < 0.06 ? 1.8 : 1);
        if (s.kind === 2 && k > 0.55) e *= rand() < 0.35 ? 2.2 : 0.15;
        splat(s.x, s.y, s.z, s.r * e, s.g * e, s.b * e);
      }
    };

    const field = (weight: number, name: (typeof PROGRAMS)[number]['name'], dt: number) => {
      if (weight <= 0.001) return;
      if (name === 'snow') {
        for (const f of flakes) {
          f.y -= f.v * dt;
          if (f.y < -1.05) {
            f.y = 1.05;
            f.x = rand() * 2 - 1;
            f.z = rand() * 2 - 1;
          }
          splat(f.x, f.y, f.z, 0.55 * weight, 0.65 * weight, 0.9 * weight);
        }
        if (rand() < dt * 30 * weight) twinkles.push({ i: Math.floor(rand() * COUNT), age: 0, life: 0.35 + rand() * 0.4, r: 1, g: 0.78, b: 0.35 });
        return;
      }
      for (let k = 0, i = 0; k < N; k += 1) {
        const z = k * STEP - 1;
        for (let j = 0; j < N; j += 1) {
          const y = j * STEP - 1;
          for (let q = 0; q < N; q += 1, i += 1) {
            const x = q * STEP - 1;
            let e = 0;
            let hue = 0;
            let col: [number, number, number] | null = null;
            if (name === 'shell') {
              const radius = Math.hypot(x, y, z);
              const front = 0.15 + ((clock * 0.42) % 1.5);
              e = Math.max(0, 1 - Math.abs(radius - front) / 0.14) + 0.6 * Math.max(0, 1 - Math.abs(radius - front + 0.55) / 0.1);
              hue = Math.atan2(z, x) / TAU + clock * 0.08 + y * 0.15;
            } else if (name === 'helix') {
              const radius = Math.hypot(x, z);
              const spiral = Math.abs(Math.sin(Math.atan2(z, x) * 3 - y * 5 + clock * 2.6));
              const body = 1 - Math.abs(radius - (0.55 + 0.12 * Math.sin(clock + y * 3))) / 0.2;
              e = clamp((spiral - 0.72) * 3.6, 0, 1) * clamp(body, 0, 1);
              hue = Math.atan2(z, x) / TAU + y * 0.25 + clock * 0.05;
            } else {
              const torus = 1 - (Math.abs(Math.hypot(x, z) - 0.6) + Math.abs(y * 0.8 + Math.sin(clock * 1.8 + x * 2) * 0.12)) / 0.17;
              const core = 1 - Math.hypot(x, y, z) / (0.2 + 0.07 * Math.sin(clock * 2.6));
              e = clamp(Math.max(torus, core), 0, 1);
              col = (torus > core ? palette[1] : palette[2]) as [number, number, number];
            }
            if (e <= 0.02) continue;
            const [r, g, b] = col ?? hsv(((hue % 1) + 1) % 1, 0.9, 1);
            const w = e * weight;
            add(i, r * w, g * w, b * w);
          }
        }
      }
    };

    return {
      ready() { return !(pinball && 'ready' in pinball) || pinball.ready(); },
      update(dt, t, p) {
        const step = Math.min(dt, 0.05) * clamp(c.params.speed, 0.1, 4);
        clock += step;
        acc.fill(0);
        // The program schedule, with a one-second crossfade.
        programAt += step;
        if (programAt > PROGRAMS[program].time) {
          programAt = 0;
          program = (program + 1) % PROGRAMS.length;
        }
        const fade = clamp(programAt / 1, 0, 1);
        const prev = (program + PROGRAMS.length - 1) % PROGRAMS.length;
        const current = PROGRAMS[program].name;
        const overPinball = pinball?.update(step, p, c.params.react > 0);
        if (p.clicked && !overPinball && c.params.react > 0) burst((rand() - 0.5) * 0.6, 0.1 + rand() * 0.3, (rand() - 0.5) * 0.6);
        fireworks(step, current === 'fireworks' ? fade : 0);
        if (current !== 'fireworks') field(fade, current, step);
        if (PROGRAMS[prev].name !== 'fireworks') field(1 - fade, PROGRAMS[prev].name, step);
        for (let i = twinkles.length - 1; i >= 0; i -= 1) {
          const tw = twinkles[i];
          tw.age += step;
          if (tw.age >= tw.life) {
            twinkles.splice(i, 1);
            continue;
          }
          const e = Math.sin((tw.age / tw.life) * Math.PI) * 1.4;
          add(tw.i, tw.r * e, tw.g * e, tw.b * e);
        }
        for (let i = 0; i < COUNT; i += 1) {
          for (let ch = 0; ch < 3; ch += 1) volume[i * 4 + ch] = Math.round(255 * (1 - Math.exp(-acc[i * 3 + ch] * 1.3)));
          volume[i * 4 + 3] = 255;
        }
        const target = 0.6 + clock * 0.22 + (p.active ? (p.x / W - 0.5) * 0.9 * c.params.react : 0);
        yaw += (target - yaw) * Math.min(1, dt * 4);
        const view = orbitView(c.params);
        const pitch = clamp(0.42 + Math.sin(clock * 0.2) * 0.08 + (p.active ? (p.y / H - 0.5) * 0.25 * c.params.react : 0) + view.pitch, -1.2, 1.45);
        // cube → view: Rx(pitch) · Ry(yaw), column by column.
        const cyw = Math.cos(yaw + view.yaw);
        const syw = Math.sin(yaw + view.yaw);
        const cp = Math.cos(pitch);
        const sp = Math.sin(pitch);
        const m = [
          [cyw, 0, syw],
          [sp * syw, cp, -sp * cyw],
          [-cp * syw, sp, cp * cyw],
        ];
        for (let col = 0; col < 3; col += 1) for (let row = 0; row < 3; row += 1) rot[col * 3 + row] = m[row][col];
        void t;
      },
      draw(g) {
        renderer.render(volume, { rot, exposure: clamp(c.params.intensity, 0.2, 3), mirror: c.params.quality >= 0.6, zoom: orbitView(c.params).zoom });
        g.drawImage(renderer.canvas, 0, 0, W, H);
        pinball?.draw(g);
      },
      dispose() {
        if (pinball && 'dispose' in pinball) pinball.dispose();
        renderer.dispose();
      },
    };
}

// Explicit archive IDs keep both complete compositions selectable in the static test gallery.
export const PINBALL_REACTOR_CLASSIC: CanvasSceneDef = {
  ...CUBE_ONLY, id: 'pinball-reactor-classic', label: 'Хроматический реактор · сохранённый плоский пинбол',
  create(c) { return createCube({ ...c, body: true, params: { ...c.params, lcMode: 0, leisurePinball: 1 } }, true); },
};
export const PINBALL_SKYLINE: CanvasSceneDef = {
  ...CUBE_ONLY, id: 'pinball-skyline', label: 'Skyline · объёмный пинбол с рампами',
  create(c) { return CUBE_ONLY.create({ ...c, body: true, contentVisible: false, params: { ...c.params, lcMode: 0, leisurePinball: 2 } }); },
};

type NumberKey = { [K in keyof SceneParams]: SceneParams[K] extends number ? K : never }[keyof SceneParams];

/** The variants' settings (⚙ and the debug panel): the figures' look. */
export const LED_FIGURE_SETTINGS: readonly { key: NumberKey; label: string; min: number; max: number; step: number }[] = [
  { key: 'lfBase', label: 'Ровный свет (фон фигур)', min: 0, max: 2, step: 0.05 },
  { key: 'lfPlay', label: 'Игра огней', min: 0, max: 2, step: 0.05 },
  { key: 'lfSpeed', label: 'Скорость', min: 0.2, max: 3, step: 0.05 },
  { key: 'lfBloom', label: 'Свечение (ореол)', min: 0, max: 2.5, step: 0.05 },
  { key: 'lfCurtain', label: 'Гирлянда-занавес', min: 0, max: 3, step: 0.05 },
  { key: 'lfSnow', label: 'Снег', min: 0, max: 2, step: 0.05 },
  { key: 'lfExposure', label: 'Экспозиция', min: 0.4, max: 2.5, step: 0.05 },
];
/** The choices shown as rows of buttons. */
export const LED_FIGURE_CHOICES: readonly { key: NumberKey; label: string; options: readonly string[] }[] = [
  { key: 'lcMode', label: 'Вид', options: ['Куб', 'Снеговик', 'Олень', 'Витрина'] },
  { key: 'lfProgram', label: 'Огни', options: ['Авто', 'Мерцание', 'Волна', 'Цвета', 'Дыхание', 'Искры'] },
  { key: 'lfBeat', label: 'Бит', options: ['Выкл', '120/мин'] },
  { key: 'lfCountdown', label: 'Табло', options: ['Радуга', 'Отсчёт до НГ'] },
];

/**
 * The LED cube effect with its variants: the cube (above), or New Year LED figures (ledFiguresGL.ts) — a snowman of
 * glowing fabric, a wire reindeer, or a showcase of both with a ticker cube counting down to the New Year before a
 * curtain of fairy lights. The variant (lcMode) may change at any time: the inner scene is made again. ⚙ (not on a
 * page's background): the settings.
 */
export const VOXEL_LED_CUBE: CanvasSceneDef = {
  ...CUBE_ONLY,
  // The showcase is the effect's main look (owner: «сделай витрину как основной эффект»).
  defaultParams: { ...CUBE_ONLY.defaultParams, lcMode: 3 },
  label: 'Светодиодный куб 20³ и новогодние фигурки',
  create(c) {
    const W = c.width;
    const H = c.height;
    let inner: SceneInstance | null = null;
    let figures: LedFigures | null = null;
    let loading = false;
    let failed = '';
    let shown = -1;
    let token = 0;
    const make = () => {
      shown = Math.round(c.params.lcMode);
      inner?.dispose?.();
      inner = null;
      figures?.dispose();
      figures = null;
      failed = '';
      token += 1;
      if (shown === 0) {
        inner = CUBE_ONLY.create(c);
        return;
      }
      // three.js and the figures only when they are asked for.
      const my = token;
      loading = true;
      const s = Math.min(c.dpr, 1.5) * (0.6 + 0.4 * clamp(c.params.quality, 0.35, 1));
      import('./ledFiguresGL')
        .then((m) => m.createLedFigures(Math.max(2, Math.round(W * s)), Math.max(2, Math.round(H * s))))
        .then((f) => {
          if (my !== token) f.dispose();
          else figures = f;
        })
        .catch((e: unknown) => {
          failed = e instanceof Error ? e.message.slice(0, 200) : String(e);
        })
        .finally(() => {
          loading = false;
        });
    };
    make();
    const orbit = createOrbit(c);
    // The ⚙ panel (not on a page's background).
    const showGear = !c.body;
    let panelOpen = false;
    let dragKey: NumberKey | null = null;
    const gear = { x: 10, y: 10, s: 28 };
    const PW = Math.min(W - 20, 380);
    const ROW = 25;
    const CH = 30;
    const panelX = 10;
    const panelY = 46;
    const trackX = panelX + 176;
    const trackW = PW - 176 - 48;
    const choicesH = LED_FIGURE_CHOICES.length * CH + 4;
    const panelH = choicesH + LED_FIGURE_SETTINGS.length * ROW + 12;
    const inPanel = (x: number, y: number) => panelOpen && x >= panelX && x <= panelX + PW && y >= panelY && y <= panelY + panelH;
    const panelRow = (x: number, y: number) => (!inPanel(x, y) || y < panelY + choicesH ? -1 : clamp(Math.floor((y - panelY - choicesH - 6) / ROW), 0, LED_FIGURE_SETTINGS.length - 1));
    const choiceBtn = (row: number, i: number) => {
      const n = LED_FIGURE_CHOICES[row].options.length;
      const x0 = panelX + 62;
      const w = (PW - 62 - 8 - 5 * (n - 1)) / n;
      return { x: x0 + i * (w + 5), y: panelY + 6 + row * CH, w, h: CH - 6 };
    };
    const setFromX = (key: NumberKey, x: number) => {
      const st = LED_FIGURE_SETTINGS.find((q) => q.key === key)!;
      c.params[key] = Math.round((st.min + clamp((x - trackX) / trackW, 0, 1) * (st.max - st.min)) / st.step) * st.step;
    };
    const look = (): LedFiguresLook => ({
      mode: Math.round(c.params.lcMode), program: Math.round(c.params.lfProgram), base: c.params.lfBase, play: c.params.lfPlay,
      speed: c.params.lfSpeed, bloom: c.params.lfBloom, curtain: c.params.lfCurtain, snow: c.params.lfSnow,
      beat: c.params.lfBeat >= 0.5, countdown: c.params.lfCountdown >= 0.5, exposure: c.params.lfExposure,
      cam: orbitView(c.params),
    });
    return {
      isControlPoint: (x, y) => showGear && (inPanel(x, y) || (x >= gear.x && x <= gear.x + gear.s && y >= gear.y && y <= gear.y + gear.s)),
      update(dt, t, p) {
        if (Math.round(c.params.lcMode) !== shown) make();
        let overUi = false;
        if (showGear) {
          if (dragKey && p.pressed) setFromX(dragKey, p.rawX);
          if (!p.pressed) dragKey = null;
          const onGear = p.rawX >= gear.x && p.rawX <= gear.x + gear.s && p.rawY >= gear.y && p.rawY <= gear.y + gear.s;
          overUi = onGear || inPanel(p.rawX, p.rawY);
          if (p.clicked) {
            if (onGear) panelOpen = !panelOpen;
            else if (inPanel(p.rawX, p.rawY) && p.rawY < panelY + choicesH) {
              LED_FIGURE_CHOICES.forEach((ch, r) => ch.options.forEach((_, i) => {
                const b = choiceBtn(r, i);
                if (p.rawX >= b.x && p.rawX <= b.x + b.w && p.rawY >= b.y && p.rawY <= b.y + b.h) c.params[ch.key] = i;
              }));
            } else {
              const row = panelRow(p.rawX, p.rawY);
              if (row >= 0) {
                dragKey = LED_FIGURE_SETTINGS[row].key;
                setFromX(dragKey, p.rawX);
              }
            }
          }
        }
        const pp = orbit.update(overUi || dragKey ? { ...p, clicked: false, pressed: false } : p);
        if (inner) inner.update(dt, t, pp);
        if (figures) figures.update(Math.min(dt, 0.05), look(), { x: pp.rawX, y: pp.rawY, pressed: pp.pressed, clicked: pp.clicked, active: pp.active }, W, H);
      },
      draw(g) {
        if (inner) inner.draw(g);
        else if (figures) {
          figures.render();
          g.drawImage(figures.canvas, 0, 0, W, H);
        } else {
          g.fillStyle = '#03040a';
          g.fillRect(0, 0, W, H);
          g.fillStyle = '#e9e2cf';
          g.font = '14px sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(failed ? `Не удалось запустить: ${failed}` : loading ? 'Загрузка…' : '', W / 2, H / 2);
        }
        orbit.draw(g);
        if (!showGear) return;
        g.textBaseline = 'middle';
        g.fillStyle = panelOpen ? 'rgba(255,225,160,0.3)' : 'rgba(10,10,14,0.66)';
        g.strokeStyle = panelOpen ? '#ffd27a' : 'rgba(255,255,255,0.3)';
        g.lineWidth = 1;
        g.beginPath();
        g.roundRect(gear.x, gear.y, gear.s, gear.s, 7);
        g.fill();
        g.stroke();
        g.fillStyle = '#f6eee0';
        g.font = '17px sans-serif';
        g.textAlign = 'center';
        g.fillText('⚙', gear.x + gear.s / 2, gear.y + gear.s / 2 + 1);
        if (!panelOpen) return;
        g.fillStyle = 'rgba(10,10,14,0.86)';
        g.strokeStyle = 'rgba(255,255,255,0.18)';
        g.beginPath();
        g.roundRect(panelX, panelY, PW, panelH, 9);
        g.fill();
        g.stroke();
        LED_FIGURE_CHOICES.forEach((ch, r) => {
          g.font = '13px sans-serif';
          g.textAlign = 'left';
          g.fillStyle = '#f6eee0';
          g.fillText(ch.label, panelX + 12, panelY + 6 + r * CH + (CH - 6) / 2);
          g.font = '11px sans-serif';
          ch.options.forEach((label, i) => {
            const b = choiceBtn(r, i);
            const on = Math.round(c.params[ch.key]) === i;
            g.fillStyle = on ? 'rgba(255,210,122,0.28)' : 'rgba(255,255,255,0.07)';
            g.strokeStyle = on ? '#ffd27a' : 'rgba(255,255,255,0.2)';
            g.beginPath();
            g.roundRect(b.x, b.y, b.w, b.h, 6);
            g.fill();
            g.stroke();
            g.fillStyle = on ? '#ffe7b0' : '#f6eee0';
            g.textAlign = 'center';
            g.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 1, b.w - 4);
          });
        });
        g.font = '12px sans-serif';
        LED_FIGURE_SETTINGS.forEach((st, i) => {
          const y = panelY + choicesH + 6 + i * ROW + ROW / 2;
          const val = c.params[st.key];
          g.textAlign = 'left';
          g.fillStyle = '#f6eee0';
          g.fillText(st.label, panelX + 12, y, 160);
          const fr = clamp((val - st.min) / (st.max - st.min), 0, 1);
          g.fillStyle = 'rgba(255,255,255,0.18)';
          g.fillRect(trackX, y - 2, trackW, 4);
          g.fillStyle = '#ffd27a';
          g.fillRect(trackX, y - 2, trackW * fr, 4);
          g.beginPath();
          g.arc(trackX + trackW * fr, y, dragKey === st.key ? 7 : 6, 0, Math.PI * 2);
          g.fill();
          g.textAlign = 'right';
          g.fillStyle = 'rgba(246,238,224,0.8)';
          g.fillText(val.toFixed(2), panelX + PW - 10, y);
        });
      },
      dispose() {
        orbit.dispose();
        token += 1;
        inner?.dispose?.();
        figures?.dispose();
      },
    };
  },
};
