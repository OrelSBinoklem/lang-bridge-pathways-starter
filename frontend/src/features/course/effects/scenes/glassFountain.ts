import type { CanvasSceneDef, SceneParams } from './types';
import { clamp } from './kit';
import { createGlassFountainTracer, glassLayout, type GlassFountainTracer } from './glassFountainGL';
import { createGlassWater, type GlassWater } from './glassFountainWater';
import { registerCameraSwitch } from './orbitControl';

/**
 * An experimental effect: a neon tabletop fountain in glass (glassFountainGL.ts) — a white stepped base, a tray of
 * water over an LED panel flowing through the neon hues, glass lily-pad leaves on acrylic stems pouring into each
 * other and into the tray, a glass lotus with a warm lamp and a bubbled glass ball on it, mist on the floor. Ray
 * traced every frame (glass, water, shadows) — fully, lighter, or not at all (only what is seen first), optionally
 * every other row a frame; the camera drifts a little after the cursor, or («Вращать мышью») a drag turns it round the
 * fountain and the wheel brings it closer. The water: as before (fixed shapes), a
 * live film (wobbling, pulsing streams, rivulets over the ball, drips), or particles (glassFountainWater.ts: drops
 * that cling to the ball, run down it and let go, ripples in the tray). ⚙: the settings.
 */

type NumberKey = { [K in keyof SceneParams]: SceneParams[K] extends number ? K : never }[keyof SceneParams];

/** The ⚙ panel's tabs. */
export const GLASS_FOUNTAIN_TABS = [
  { id: 'scene', label: 'Сцена' },
  { id: 'water', label: 'Вода' },
  { id: 'camera', label: 'Камера' },
] as const;
type Tab = (typeof GLASS_FOUNTAIN_TABS)[number]['id'];

export const GLASS_FOUNTAIN_SETTINGS: readonly { key: NumberKey; label: string; min: number; max: number; step: number; tab: Tab }[] = [
  { key: 'gfNeonI', label: 'Неон: яркость', min: 0, max: 3, step: 0.05, tab: 'scene' },
  { key: 'gfNeonSpeed', label: 'Неон: смена цвета', min: 0, max: 2, step: 0.05, tab: 'scene' },
  { key: 'gfHue', label: 'Неон: оттенок, °', min: 0, max: 360, step: 1, tab: 'scene' },
  { key: 'gfWarm', label: 'Тёплая лампа в лотосе', min: 0, max: 3, step: 0.05, tab: 'scene' },
  { key: 'gfKey', label: 'Верхний свет', min: 0, max: 2, step: 0.05, tab: 'scene' },
  { key: 'gfExposure', label: 'Экспозиция', min: 0.4, max: 2.5, step: 0.05, tab: 'scene' },
  { key: 'gfMist', label: 'Туман', min: 0, max: 2, step: 0.05, tab: 'scene' },
  { key: 'gfGlow', label: 'Ореол', min: 0, max: 2, step: 0.05, tab: 'scene' },
  { key: 'gfScale', label: 'Разрешение (нагрузка)', min: 0.3, max: 1, step: 0.05, tab: 'scene' },
  { key: 'gfDetail', label: 'Детализация (капель больше, мельче)', min: 0.5, max: 3, step: 0.05, tab: 'water' },
  { key: 'gfPasses', label: 'Сглаживание: проходов', min: 1, max: 5, step: 1, tab: 'water' },
  { key: 'gfSmooth', label: 'Слитность (радиус сглаживания)', min: 0, max: 3, step: 0.05, tab: 'water' },
  { key: 'gfDrop', label: 'Размер капель', min: 0.4, max: 2.5, step: 0.05, tab: 'water' },
  { key: 'gfAbsorb', label: 'Оттенок воды (поглощение)', min: 0, max: 3, step: 0.05, tab: 'water' },
  { key: 'gfRate', label: 'Поток', min: 0.2, max: 2.5, step: 0.05, tab: 'water' },
  { key: 'gfAdhesion', label: 'Прилипание к шару', min: 0, max: 1500, step: 10, tab: 'water' },
  { key: 'gfWobble', label: 'Неровность струи', min: 0, max: 2, step: 0.05, tab: 'water' },
  { key: 'gfViscosity', label: 'Вязкость плёнки', min: 1, max: 80, step: 1, tab: 'water' },
  { key: 'gfYaw', label: 'Поворот, °', min: -180, max: 180, step: 1, tab: 'camera' },
  { key: 'gfPitch', label: 'Наклон, °', min: -5, max: 80, step: 1, tab: 'camera' },
  { key: 'gfZoom', label: 'Приближение, ×', min: 0.5, max: 4, step: 0.05, tab: 'camera' },
  { key: 'gfOrbit', label: 'За курсором: сила', min: 0, max: 1, step: 0.05, tab: 'camera' },
];
/** The choices shown as rows of buttons (⚙ and the debug panel). */
export const GLASS_FOUNTAIN_CHOICES: readonly { key: NumberKey; label: string; options: readonly string[]; tab: Tab }[] = [
  { key: 'gfRender', label: 'Рендер', options: ['Полная трассировка', 'Лёгкая', 'Без трассировки'], tab: 'scene' },
  { key: 'gfInterlace', label: 'Кадры', options: ['Каждый кадр', 'Через строку (×2)'], tab: 'scene' },
  { key: 'gfWater', label: 'Вода', options: ['Как было', 'Живая плёнка', 'Частицы'], tab: 'water' },
  { key: 'gfCamera', label: 'Камера', options: ['За курсором', 'Вращать мышью'], tab: 'camera' },
];

/** HSV → linear RGB. */
function hsv(h: number, s: number, v: number): [number, number, number] {
  const k = (n: number) => (n + h / 60) % 6;
  const f = (n: number) => v - v * s * Math.max(0, Math.min(k(n), 4 - k(n), 1));
  return [f(5), f(3), f(1)].map((c) => Math.pow(c, 2.2)) as [number, number, number];
}

export const GLASS_FOUNTAIN: CanvasSceneDef = {
  kind: 'canvas',
  id: 'glass-fountain',
  label: 'Неоновый стеклянный фонтанчик (трассировка лучей)',
  palettes: [['#050508']],
  create(c) {
    const W = c.width;
    const H = c.height;
    let tracer: GlassFountainTracer | null = null;
    let failed = '';
    let tracerScale = 0;
    const make = () => {
      const s = clamp(c.params.gfScale, 0.3, 1) * Math.min(c.dpr, 1.5);
      tracer?.dispose();
      tracer = null;
      try {
        tracer = createGlassFountainTracer(Math.max(64, Math.round(W * s)), Math.max(64, Math.round(H * s)));
        if (!tracer) failed = 'нет WebGL2';
      } catch (e) {
        failed = e instanceof Error ? e.message.slice(0, 200) : String(e);
      }
      tracerScale = c.params.gfScale;
    };
    make();
    let clock = 0;
    let water: GlassWater | null = null;
    let drops = new Float32Array(0);
    let yaw = (c.params.gfYaw * Math.PI) / 180;
    let pitch = (c.params.gfPitch * Math.PI) / 180;
    // The ⚙ panel: a tab bar, then this tab's rows of buttons, then its sliders.
    let panelOpen = false;
    let tab: Tab = 'water';
    let dragKey: NumberKey | null = null;
    const gear = { x: 10, y: 10, s: 28 };
    const PW = Math.min(W - 20, 370);
    const ROW = 25;
    const CH = 30;
    const TAB_H = 30;
    const panelX = 10;
    const panelY = 46;
    const trackX = panelX + 196;
    const trackW = PW - 196 - 46;
    const choicesOf = () => GLASS_FOUNTAIN_CHOICES.filter((q) => q.tab === tab);
    const settingsOf = () => GLASS_FOUNTAIN_SETTINGS.filter((q) => q.tab === tab);
    const choicesH = () => choicesOf().length * CH + 4;
    const panelH = () => TAB_H + choicesH() + settingsOf().length * ROW + 12;
    const inPanel = (x: number, y: number) => panelOpen && x >= panelX && x <= panelX + PW && y >= panelY && y <= panelY + panelH();
    const panelRow = (x: number, y: number) => {
      const top = panelY + TAB_H + choicesH();
      if (!inPanel(x, y) || y < top) return -1;
      return clamp(Math.floor((y - top - 6) / ROW), 0, settingsOf().length - 1);
    };
    const tabBtn = (i: number) => {
      const w = (PW - 16 - 6 * (GLASS_FOUNTAIN_TABS.length - 1)) / GLASS_FOUNTAIN_TABS.length;
      return { x: panelX + 8 + i * (w + 6), y: panelY + 6, w, h: TAB_H - 8 };
    };
    const choiceBtn = (row: number, i: number) => {
      const n = choicesOf()[row].options.length;
      const x0 = panelX + 66;
      const w = (PW - 66 - 8 - 6 * (n - 1)) / n;
      return { x: x0 + i * (w + 6), y: panelY + TAB_H + 6 + row * CH, w, h: CH - 6 };
    };
    const setFromX = (key: NumberKey, x: number) => {
      const st = GLASS_FOUNTAIN_SETTINGS.find((q) => q.key === key)!;
      const v = st.min + clamp((x - trackX) / trackW, 0, 1) * (st.max - st.min);
      c.params[key] = Math.round(v / st.step) * st.step;
    };
    // «Вращать мышью»: a drag turns the camera round the fountain, the wheel brings it closer (over the scene only).
    let orbiting = false;
    let lastX = 0;
    let lastY = 0;
    let over = false;
    const onWheel = (e: WheelEvent) => {
      if (c.params.gfCamera < 0.5 || !over) return;
      e.preventDefault();
      c.params.gfZoom = clamp(c.params.gfZoom * Math.exp(-e.deltaY * 0.0012), 0.5, 4);
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    // On from the start when so set (orbitControl.ts), and the «C» key.
    const unregister = registerCameraSwitch(c.params, 'gfCamera', {
      hovered: () => over,
      on: () => c.params.gfCamera >= 0.5,
      set: (on) => {
        c.params.gfCamera = on ? 1 : 0;
      },
    });

    /** The drops for the tracer: x, y, z, radius each. */
    const packDrops = (w: GlassWater) => {
      if (drops.length < w.st.length * 4) drops = new Float32Array(w.st.length * 4);
      let n = 0;
      for (let i = 0; i < w.st.length; i += 1) {
        if (!w.st[i]) continue;
        drops[n * 4] = w.px[i]; drops[n * 4 + 1] = w.py[i]; drops[n * 4 + 2] = w.pz[i]; drops[n * 4 + 3] = w.rad[i];
        n += 1;
      }
      return { drops, count: n, ripples: w.ripples };
    };

    return {
      isControlPoint: (x, y) => inPanel(x, y) || (x >= gear.x && x <= gear.x + gear.s && y >= gear.y && y <= gear.y + gear.s),
      update(dt, _t, p) {
        const sdt = Math.min(dt, 1 / 20);
        clock += sdt;
        if (dragKey && p.pressed) setFromX(dragKey, p.rawX);
        if (!p.pressed) {
          // A new resolution is taken when the slider is let go.
          if (dragKey === 'gfScale' || (!dragKey && tracerScale !== c.params.gfScale)) make();
          dragKey = null;
        }
        if (!p.pressed) orbiting = false;
        const onGear = p.rawX >= gear.x && p.rawX <= gear.x + gear.s && p.rawY >= gear.y && p.rawY <= gear.y + gear.s;
        const free = c.params.gfCamera >= 0.5;
        if (p.clicked) {
          const row = panelRow(p.rawX, p.rawY);
          if (onGear) panelOpen = !panelOpen;
          else if (inPanel(p.rawX, p.rawY) && p.rawY < panelY + TAB_H) {
            GLASS_FOUNTAIN_TABS.forEach((t, i) => {
              const b = tabBtn(i);
              if (p.rawX >= b.x && p.rawX <= b.x + b.w) tab = t.id;
            });
          } else if (inPanel(p.rawX, p.rawY) && p.rawY < panelY + TAB_H + choicesH()) {
            choicesOf().forEach((ch, r) => ch.options.forEach((_, i) => {
              const b = choiceBtn(r, i);
              if (p.rawX >= b.x && p.rawX <= b.x + b.w && p.rawY >= b.y && p.rawY <= b.y + b.h) c.params[ch.key] = i;
            }));
          } else if (row >= 0) {
            dragKey = settingsOf()[row].key;
            setFromX(dragKey, p.rawX);
          } else if (free) {
            orbiting = true;
            lastX = p.rawX;
            lastY = p.rawY;
          }
        }
        over = p.active && !inPanel(p.rawX, p.rawY) && !onGear;
        if (orbiting && p.pressed) {
          c.params.gfYaw = ((((c.params.gfYaw - (p.rawX - lastX) * 0.35) % 360) + 540) % 360) - 180;
          c.params.gfPitch = clamp(c.params.gfPitch + (p.rawY - lastY) * 0.25, -5, 80);
          lastX = p.rawX;
          lastY = p.rawY;
        }
        // The camera: where the sliders (or the drag) put it; «За курсором» it also drifts a little after the cursor.
        const k = free ? 0 : c.params.gfOrbit;
        const ty = (c.params.gfYaw * Math.PI) / 180 + (p.active ? (p.x / W - 0.5) * 0.9 * k : Math.sin(clock * 0.11) * 0.12 * k);
        const tp = (c.params.gfPitch * Math.PI) / 180 + (p.active ? (0.5 - p.y / H) * 0.3 * k : 0);
        const follow = Math.min(1, sdt * (free ? 12 : 2.5));
        yaw += ((((ty - yaw) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI) * follow;
        pitch += (tp - pitch) * follow;
        // The particles' water (only while that mode is on).
        if (Math.round(c.params.gfWater) === 2) {
          const wp = { rate: c.params.gfRate, adhesion: c.params.gfAdhesion, wobble: c.params.gfWobble, viscosity: c.params.gfViscosity, detail: c.params.gfDetail };
          if (!water) {
            water = createGlassWater(glassLayout());
            // Already flowing over the ball when it first shows.
            for (let k = 0; k < 120; k += 1) water.step(1 / 60, wp);
          }
          water.step(sdt, wp);
        }
      },
      draw(g) {
        // Drawn once its shaders are compiled (in the background).
        let ok = false;
        if (tracer) {
          try {
            ok = tracer.ready;
          } catch (e) {
            failed = e instanceof Error ? e.message.slice(0, 200) : String(e);
            tracer.dispose();
            tracer = null;
          }
        }
        if (tracer && ok) {
          const target: [number, number, number] = [0, 6.5, 0];
          const dist = (74 * (W / H < 1 ? 1.5 : 1)) / clamp(c.params.gfZoom, 0.5, 4);
          const cp = Math.cos(pitch);
          const pos: [number, number, number] = [target[0] + Math.sin(yaw) * cp * dist, target[1] + Math.sin(pitch) * dist, target[2] + Math.cos(yaw) * cp * dist];
          // Camera basis: back (from the target to the eye), right, up.
          const bx = pos[0] - target[0], by = pos[1] - target[1], bz = pos[2] - target[2];
          const bl = Math.hypot(bx, by, bz);
          const back = [bx / bl, by / bl, bz / bl];
          const rl = Math.hypot(back[2], back[0]);
          const right = [back[2] / rl, 0, -back[0] / rl];
          const up = [back[1] * right[2] - back[2] * right[1], back[2] * right[0] - back[0] * right[2], back[0] * right[1] - back[1] * right[0]];
          const vfov = (30 * Math.PI) / 180;
          const hue = (c.params.gfHue + 360 + 38 * Math.sin(clock * 0.35 * c.params.gfNeonSpeed) + 22 * Math.sin(clock * 0.13 * c.params.gfNeonSpeed)) % 360;
          tracer.render(clock, { pos, rot: [...right, ...up, ...back], focal: 0.5 / Math.tan(vfov / 2) }, {
            exposure: c.params.gfExposure,
            neon: hsv(hue, 0.82, 1),
            neonI: c.params.gfNeonI,
            warm: c.params.gfWarm,
            key: c.params.gfKey,
            mist: c.params.gfMist,
            glow: c.params.gfGlow,
            flow: 1,
            quality: c.params.gfRender,
            interlace: c.params.gfInterlace >= 0.5,
            water: c.params.gfWater,
            dropSize: c.params.gfDrop,
            smooth: c.params.gfSmooth,
            detail: c.params.gfDetail,
            passes: c.params.gfPasses,
            absorb: c.params.gfAbsorb,
          }, water && Math.round(c.params.gfWater) === 2 ? packDrops(water) : undefined);
          g.drawImage(tracer.canvas, 0, 0, W, H);
        } else {
          g.fillStyle = '#050508';
          g.fillRect(0, 0, W, H);
          g.fillStyle = '#e9e2cf';
          g.font = '14px sans-serif';
          g.textAlign = 'center';
          g.fillText(failed ? `Не удалось запустить: ${failed}` : 'Загрузка…', W / 2, H / 2);
        }
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
        g.textBaseline = 'middle';
        g.fillText('⚙', gear.x + gear.s / 2, gear.y + gear.s / 2 + 1);
        if (panelOpen) {
          g.fillStyle = 'rgba(10,10,14,0.86)';
          g.strokeStyle = 'rgba(255,255,255,0.18)';
          g.beginPath();
          g.roundRect(panelX, panelY, PW, panelH(), 9);
          g.fill();
          g.stroke();
          g.font = '12px sans-serif';
          GLASS_FOUNTAIN_TABS.forEach((t, i) => {
            const b = tabBtn(i);
            const on = t.id === tab;
            g.fillStyle = on ? 'rgba(184,154,255,0.3)' : 'rgba(255,255,255,0.06)';
            g.strokeStyle = on ? '#b89aff' : 'rgba(255,255,255,0.18)';
            g.beginPath();
            g.roundRect(b.x, b.y, b.w, b.h, 6);
            g.fill();
            g.stroke();
            g.fillStyle = on ? '#e6dcff' : '#f6eee0';
            g.textAlign = 'center';
            g.fillText(t.label, b.x + b.w / 2, b.y + b.h / 2 + 1, b.w - 4);
          });
          choicesOf().forEach((ch, r) => {
            g.font = '13px sans-serif';
            g.textAlign = 'left';
            g.fillStyle = '#f6eee0';
            g.fillText(ch.label, panelX + 12, panelY + TAB_H + 6 + r * CH + (CH - 6) / 2);
            g.font = '11px sans-serif';
            ch.options.forEach((label, i) => {
              const b = choiceBtn(r, i);
              const on = Math.round(c.params[ch.key]) === i;
              g.fillStyle = on ? 'rgba(184,154,255,0.3)' : 'rgba(255,255,255,0.07)';
              g.strokeStyle = on ? '#b89aff' : 'rgba(255,255,255,0.2)';
              g.beginPath();
              g.roundRect(b.x, b.y, b.w, b.h, 6);
              g.fill();
              g.stroke();
              g.fillStyle = on ? '#e6dcff' : '#f6eee0';
              g.textAlign = 'center';
              g.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 1, b.w - 4);
            });
          });
          g.font = '12px sans-serif';
          settingsOf().forEach((st, i) => {
            const y = panelY + TAB_H + choicesH() + 6 + i * ROW + ROW / 2;
            const v = c.params[st.key];
            g.textAlign = 'left';
            g.fillStyle = '#f6eee0';
            g.fillText(st.label, panelX + 12, y, 182);
            const fr = clamp((v - st.min) / (st.max - st.min), 0, 1);
            g.fillStyle = 'rgba(255,255,255,0.18)';
            g.fillRect(trackX, y - 2, trackW, 4);
            g.fillStyle = '#b89aff';
            g.fillRect(trackX, y - 2, trackW * fr, 4);
            g.beginPath();
            g.arc(trackX + trackW * fr, y, dragKey === st.key ? 7 : 6, 0, Math.PI * 2);
            g.fill();
            g.textAlign = 'right';
            g.fillStyle = 'rgba(246,238,224,0.8)';
            g.fillText(v.toFixed(st.step < 0.1 ? 2 : st.step < 1 ? 1 : 0), panelX + PW - 10, y);
          });
        } else if (c.params.gfCamera >= 0.5) {
          g.font = '12px sans-serif';
          g.textAlign = 'left';
          g.fillStyle = 'rgba(10,10,14,0.6)';
          g.beginPath();
          g.roundRect(46, 12, 300, 22, 6);
          g.fill();
          g.fillStyle = '#f6eee0';
          g.fillText('Камера: тяните — поворот, колесо — приближение', 54, 23);
        }
      },
      dispose() {
        window.removeEventListener('wheel', onWheel);
        unregister();
        tracer?.dispose();
      },
    };
  },
};
