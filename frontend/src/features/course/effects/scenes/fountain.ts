import type { CanvasSceneDef, SceneCtx, SceneInstance, SceneParams } from './types';
import { createOrbit } from './orbitControl';
import { clamp } from './kit';
import { createFountainSim, POOL } from '../fountain/sim';
import type { FountainRenderer } from '../fountain/renderer';
import { createFountainFrameBudget } from '../fountain/frameBudget';

/**
 * An experimental effect: a two-tier stone fountain in the courtyard of a manor house, the water a fixed number of
 * particles going round (fountain/sim.ts: jet, bowl, overflow sheet, the basin drifting slowly to the drain, the pump)
 * and drawn as water (fountain/renderer.ts: the pool and the bowl with reflection, refraction, caustics, foam; the
 * falling water from the particles themselves — streaks gathered into water on the screen, particleWater.ts — or, as
 * before, clear threads along computed paths, or both: threads that break up into the particles; chosen in the
 * settings). The camera is fixed, matched to the
 * photograph behind.
 *
 * The cursor over the basin ruffles the water; dragging stirs it. ⚙ opens the settings (also in the debug panel).
 * three.js is loaded only when the scene starts.
 */

type NumberKey = { [K in keyof SceneParams]: SceneParams[K] extends number ? K : never }[keyof SceneParams];

/** The fountain's sliders, for its own ⚙ panel and the tuning panel. */
export const FOUNTAIN_SETTINGS: readonly { key: NumberKey; label: string; min: number; max: number; step: number }[] = [
  { key: 'fntJet', label: 'Напор струи, м/с', min: 3, max: 8.5, step: 0.1 },
  { key: 'fntWind', label: 'Ветер, м/с', min: -3, max: 3, step: 0.1 },
  { key: 'fntSun', label: 'Солнце', min: 0.2, max: 2, step: 0.05 },
  { key: 'fntExposure', label: 'Экспозиция', min: 0.5, max: 1.8, step: 0.05 },
  { key: 'fntReflect', label: 'Отражения', min: 0, max: 1.5, step: 0.05 },
  { key: 'fntTint', label: 'Мутность воды', min: 0, max: 2.5, step: 0.05 },
  { key: 'fntFoam', label: 'Пена', min: 0, max: 2, step: 0.05 },
  { key: 'fntCaustics', label: 'Каустика на дне', min: 0, max: 2, step: 0.05 },
  { key: 'fntShutter', label: 'Выдержка (размытие), мс', min: 4, max: 60, step: 1 },
  { key: 'fntBreak', label: 'Гибрид: где струя распадается', min: 0.1, max: 1, step: 0.05 },
  { key: 'fntDrop', label: 'Капли: размер', min: 0.3, max: 3, step: 0.05 },
  { key: 'fntSmooth', label: 'Капли: слитность, px', min: 0, max: 5, step: 0.1 },
  { key: 'fntAir', label: 'Капли: белизна (воздух)', min: 0, max: 2, step: 0.05 },
];
/** The falling water's modes, in the order of fntWater. */
export const FOUNTAIN_WATER_MODES = ['Частицы', 'Нити (как было)', 'Гибрид'] as const;

/**
 * The fountain; `yard`: over a whole page (group 1765): the fountain at the right, the dolphin statue with its stream
 * at the left, no ⚙ panel or hint (the tuning panel still has the sliders), fewer particles (20 000) and a capped
 * drawing size — it is a background.
 *
 * The original water, geometry and casting are retained. Normal motion starts directly from the filled pools;
 * only a reduced-motion still needs asynchronous preroll. The yard renders at display cadence; physics stays 60 Hz.
 */
function createFountain(c: SceneCtx, yard: boolean): SceneInstance {
    const W = c.width;
    const H = c.height;
    const sim = createFountainSim({
      // Plenty of water: a full jet, a full sheet round the whole lip, and the ring of arcs.
      count: yard ? 20000 : 30000,
      rate: yard ? 2000 : 3000,
      ringShare: 0.3,
      surfaceSolver: yard ? 'field' : 'particles',
      jetSpeed: c.params.fntJet,
      jetSpread: 0.05,
      windX: 0,
      windZ: 0,
      rand: c.rand,
    });
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const WARM = reducedMotion ? 240 : 0;
    const frameBudget = createFountainFrameBudget(yard);
    const controller = new AbortController();
    let disposed = false;
    let dirty = true;
    let context: CanvasRenderingContext2D | null = null;
    let pendingClick = false;
    let lastDiagnostic = 0;
    let warmFrame = 0;

    let warm = 0;
    const settle = () => {
      const t0 = performance.now();
      while (warm < WARM && performance.now() - t0 < 4) {
        sim.step(1 / 60);
        warm += 1;
      }
    };
    let renderer: FountainRenderer | null = null;
    let failed = '';
    let clock = 0;
    const base = () => (0.6 + 0.4 * clamp(c.params.quality, 0.35, 1)) * Math.min(c.dpr, 1.5);
    // Keep the original optical passes, with a bounded full-page raster size.
    const scale = () => (yard ? Math.min(base(), Math.sqrt(1.4e6 / (W * H))) : base());
    import('../fountain/renderer')
      .then((mod) => disposed ? null : mod.createFountainRenderer(W, H, scale(), sim, yard ? { shift: 0.72, statue: true, back: 1.5 } : {}, controller.signal))
      .then((r) => {
        if (!r) return;
        if (disposed) { r.dispose(); return; }
        renderer = r;
        dirty = true;
        if (context) instance.draw(context);
      })
      .catch((e: unknown) => {
        if (disposed) return;
        failed = e instanceof Error ? e.message : String(e);
        console.error('Fountain renderer failed', e);
        dirty = true;
        if (context) instance.draw(context);
      });

    // The ⚙ panel (as the kaleidoscope's).
    let panelOpen = false;
    let dragKey: NumberKey | null = null;
    const gear = { x: 10, y: 10, s: 28 };
    const PW = Math.min(W - 20, 330);
    const ROW = 27;
    const panelX = 10;
    const panelY = 46;
    const trackX = panelX + 176;
    const trackW = PW - 176 - 48;
    // A row of buttons for the water's mode, then the sliders.
    const MODE_H = 34;
    const panelH = MODE_H + FOUNTAIN_SETTINGS.length * ROW + 12;
    const inPanel = (x: number, y: number) => panelOpen && x >= panelX && x <= panelX + PW && y >= panelY && y <= panelY + panelH;
    const panelRow = (x: number, y: number) => {
      if (!inPanel(x, y) || y < panelY + MODE_H) return -1;
      return clamp(Math.floor((y - panelY - MODE_H - 6) / ROW), 0, FOUNTAIN_SETTINGS.length - 1);
    };
    const modeBtn = (i: number) => {
      const n = FOUNTAIN_WATER_MODES.length;
      const w = (PW - 16 - 8 * (n - 1)) / n;
      return { x: panelX + 8 + i * (w + 8), y: panelY + 7, w, h: MODE_H - 10 };
    };
    const setFromX = (key: NumberKey, x: number) => {
      const st = FOUNTAIN_SETTINGS.find((q) => q.key === key)!;
      const v = st.min + clamp((x - trackX) / trackW, 0, 1) * (st.max - st.min);
      c.params[key] = Math.round(v / st.step) * st.step;
    };
    let lastPick: [number, number] | null = null;
    let hint = 1;
    const orbit = createOrbit(c, { pitch: [0, 0], zoom: [0.7, 3] });

    const preroll = () => {
      if (disposed) return;
      if (!document.hidden) settle();
      if (warm < WARM) warmFrame = requestAnimationFrame(preroll);
      else { dirty = true; if (context) instance.draw(context); }
    };
    if (WARM) warmFrame = requestAnimationFrame(preroll);
    const resume = () => { dirty = true; if (!document.hidden && context) instance.draw(context); };
    document.addEventListener('visibilitychange', resume);

    const instance: SceneInstance = {
      isControlPoint: (x, y) => inPanel(x, y) || (!yard && x >= gear.x && x <= gear.x + gear.s && y >= gear.y && y <= gear.y + gear.s),
      update(dt, _t, pIn) {
        pendingClick ||= pIn.clicked;
        if (warm < WARM) return;
        const sdt = frameBudget.take(performance.now(), dt, document.hidden);
        if (sdt === null) return;
        dirty = true;
        const p = orbit.update({ ...pIn, clicked: pendingClick });
        pendingClick = false;
        renderer?.setView(orbit.yaw, orbit.zoom);
        clock += sdt;
        sim.options.jetSpeed = c.params.fntJet;
        // The wind blows across the view, with gusts.
        const gust = 0.75 + 0.25 * Math.sin(clock * 0.7) + 0.15 * Math.sin(clock * 2.3);
        sim.options.windX = c.params.fntWind * gust;
        sim.options.windZ = c.params.fntWind * 0.25 * gust;
        if (dragKey && p.pressed) setFromX(dragKey, p.rawX);
        if (!p.pressed) dragKey = null;
        const onGear = !yard && p.rawX >= gear.x && p.rawX <= gear.x + gear.s && p.rawY >= gear.y && p.rawY <= gear.y + gear.s;
        if (p.clicked) {
          const row = panelRow(p.rawX, p.rawY);
          if (onGear) panelOpen = !panelOpen;
          else if (inPanel(p.rawX, p.rawY) && p.rawY < panelY + MODE_H) {
            for (let i = 0; i < FOUNTAIN_WATER_MODES.length; i += 1) {
              const b = modeBtn(i);
              if (p.rawX >= b.x && p.rawX <= b.x + b.w) c.params.fntWater = i;
            }
          } else if (row >= 0) {
            dragKey = FOUNTAIN_SETTINGS[row].key;
            setFromX(dragKey, p.rawX);
          }
        }
        // The cursor over the water: ripples as it moves; dragging stirs the pool.
        const overPanel = inPanel(p.rawX, p.rawY) || onGear;
        const pick = p.active && !overPanel && renderer ? renderer.pickPool(p.rawX, p.rawY) : null;
        if (pick) {
          if (p.clicked) sim.poke(pick[0], pick[1], -0.03 * c.params.react, 0.2);
          if (lastPick) {
            const mx = pick[0] - lastPick[0], mz = pick[1] - lastPick[1];
            const moved = Math.hypot(mx, mz);
            if (moved > 0.01) {
              sim.poke(pick[0], pick[1], -Math.min(0.02, moved * 0.05) * c.params.react, 0.12);
              hint = 0;
            }
            if (p.pressed && !dragKey && moved > 0) {
              const k = Math.min(3, 1 / Math.max(sdt, 1e-3)) * 0.5;
              for (let i = 0; i < sim.N; i += 1) {
                if (sim.state[i] !== POOL) continue;
                const dx = sim.px[i] - pick[0], dz = sim.pz[i] - pick[1];
                const w = Math.exp(-(dx * dx + dz * dz) / 0.18);
                if (w < 0.02) continue;
                sim.vx[i] += mx * k * w;
                sim.vz[i] += mz * k * w;
                sim.foam[i] = Math.min(1, sim.foam[i] + w * 0.08);
              }
            }
          }
          lastPick = pick;
        } else lastPick = null;
        if (sdt > 0) sim.step(sdt);
        if (hint > 0 && clock > 14) hint = Math.max(0, hint - sdt * 0.5);
      },
      draw(g) {
        context = g;
        if (disposed || document.hidden) return;
        if (!dirty && !reducedMotion) return;
        dirty = false;
        if (renderer && warm >= WARM) {
          renderer.render(clock, {
            exposure: c.params.fntExposure,
            sun: c.params.fntSun,
            reflect: c.params.fntReflect,
            tint: c.params.fntTint,
            foam: c.params.fntFoam,
            caustics: c.params.fntCaustics,
            shutter: c.params.fntShutter / 1000,
            mode: c.params.fntWater,
            breakup: c.params.fntBreak,
            drop: c.params.fntDrop,
            smooth: c.params.fntSmooth,
            air: c.params.fntAir,
            pool: c.params.fntPool,
          });
          g.drawImage(renderer.canvas, 0, 0, W, H);
          if (process.env.NODE_ENV !== 'production' && context && performance.now() - lastDiagnostic > 500) {
            context.canvas.dataset.fountain = JSON.stringify({ ...renderer.diagnostics(), counts: Array.from(sim.counts) });
            lastDiagnostic = performance.now();
          }
          orbit.draw(g);
        } else {
          g.fillStyle = '#0d0f0c';
          g.fillRect(0, 0, W, H);
          g.fillStyle = '#e9e2cf';
          g.font = '14px sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(failed ? `Не удалось запустить: ${failed}` : 'Загрузка фонтана…', W / 2, H / 2);
        }
        if (yard) return;
        // ⚙ and the panel.
        g.fillStyle = panelOpen ? 'rgba(255,225,160,0.3)' : 'rgba(10,10,8,0.66)';
        g.strokeStyle = panelOpen ? '#ffd27a' : 'rgba(255,255,255,0.3)';
        g.lineWidth = 1;
        g.beginPath();
        g.roundRect(gear.x, gear.y, gear.s, gear.s, 7);
        g.fill();
        g.stroke();
        g.fillStyle = '#f6eee0';
        g.font = '17px sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('⚙', gear.x + gear.s / 2, gear.y + gear.s / 2 + 1);
        if (panelOpen) {
          g.fillStyle = 'rgba(10,10,8,0.84)';
          g.strokeStyle = 'rgba(255,255,255,0.18)';
          g.beginPath();
          g.roundRect(panelX, panelY, PW, panelH, 9);
          g.fill();
          g.stroke();
          g.font = '12px sans-serif';
          for (let i = 0; i < FOUNTAIN_WATER_MODES.length; i += 1) {
            const b = modeBtn(i);
            const on = i === Math.round(c.params.fntWater);
            g.fillStyle = on ? 'rgba(255,210,122,0.28)' : 'rgba(255,255,255,0.07)';
            g.strokeStyle = on ? '#ffd27a' : 'rgba(255,255,255,0.2)';
            g.beginPath();
            g.roundRect(b.x, b.y, b.w, b.h, 6);
            g.fill();
            g.stroke();
            g.fillStyle = on ? '#ffe7b0' : '#f6eee0';
            g.textAlign = 'center';
            g.fillText(FOUNTAIN_WATER_MODES[i], b.x + b.w / 2, b.y + b.h / 2 + 1);
          }
          g.font = '13px sans-serif';
          for (let i = 0; i < FOUNTAIN_SETTINGS.length; i += 1) {
            const st = FOUNTAIN_SETTINGS[i];
            const y = panelY + MODE_H + 6 + i * ROW + ROW / 2;
            const v = c.params[st.key];
            g.textAlign = 'left';
            g.fillStyle = '#f6eee0';
            g.fillText(st.label, panelX + 12, y);
            const f = clamp((v - st.min) / (st.max - st.min), 0, 1);
            g.fillStyle = 'rgba(255,255,255,0.18)';
            g.fillRect(trackX, y - 2, trackW, 4);
            g.fillStyle = '#ffd27a';
            g.fillRect(trackX, y - 2, trackW * f, 4);
            g.beginPath();
            g.arc(trackX + trackW * f, y, dragKey === st.key ? 7 : 6, 0, Math.PI * 2);
            g.fill();
            g.textAlign = 'right';
            g.fillStyle = 'rgba(246,238,224,0.8)';
            g.fillText(v.toFixed(st.step < 0.1 ? 2 : st.step < 1 ? 1 : 0), panelX + PW - 10, y);
          }
        } else if (hint > 0 && renderer) {
          const tip = 'Проведите курсором над водой — пойдёт рябь, потяните — размешаете';
          g.font = '13px sans-serif';
          g.textAlign = 'left';
          const tw = g.measureText(tip).width + 16;
          g.globalAlpha = Math.min(1, hint);
          g.fillStyle = 'rgba(10,10,8,0.72)';
          g.beginPath();
          g.roundRect(46, 12, tw, 24, 7);
          g.fill();
          g.fillStyle = '#f6eee0';
          g.fillText(tip, 54, 24);
          g.globalAlpha = 1;
        }
      },
      dispose() {
        disposed = true;
        controller.abort();
        cancelAnimationFrame(warmFrame);
        document.removeEventListener('visibilitychange', resume);
        context = null;
        orbit.dispose();
        renderer?.dispose();
      },
    };
    return instance;
}

export const FOUNTAIN_SCENE: CanvasSceneDef = {
  kind: 'canvas',
  id: 'fountain',
  label: 'Фонтан во дворе усадьбы (3D, вода из частиц)',
  palettes: [['#0d0f0c']],
  warmupFrames: 1,
  create: (c) => createFountain(c, false),
};

/** Group 1765 «В городе и в деревне», over the whole page: the fountain at the right, the dolphin statue at the left. */
export const FOUNTAIN_YARD: CanvasSceneDef = {
  kind: 'canvas',
  id: 'fountain-yard',
  label: 'Двор усадьбы на весь экран: фонтан справа, статуя-дельфин с водой слева',
  palettes: [['#0d0f0c']],
  warmupFrames: 1,
  create: (c) => createFountain(c, true),
};
