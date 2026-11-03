import type { CanvasSceneDef, SceneParams } from './types';
import { clamp } from './kit';
import { createDragonSmoke, type DragonSmoke } from './dragonSmokeGL';
import { createOrbit } from './orbitControl';

/**
 * An experimental effect: a ceramic dragon burner with backflow incense smoke (dragonSmokeGL.ts) — the smoke pours
 * over the top dish, lies on the ledges, falls into the basins, spills over the big dish and spreads on the table,
 * lit from the left and shading itself and the ceramic. The camera is the photograph's; the cursor stirs the smoke.
 */

type NumberKey = { [K in keyof SceneParams]: SceneParams[K] extends number ? K : never }[keyof SceneParams];

export const DRAGON_SMOKE_SETTINGS: readonly { key: NumberKey; label: string; min: number; max: number; step: number }[] = [
  { key: 'dsRate', label: 'Сколько дыма', min: 0, max: 2.5, step: 0.05 },
  { key: 'dsHeavy', label: 'Тяжесть дыма', min: 0.2, max: 2.5, step: 0.05 },
  { key: 'dsLife', label: 'Живёт, с', min: 2, max: 30, step: 0.5 },
  { key: 'dsSwirl', label: 'Завихрения', min: 0, max: 4, step: 0.05 },
  { key: 'dsLight', label: 'Свет слева', min: 0.2, max: 3, step: 0.05 },
  { key: 'dsShadow', label: 'Тень дыма', min: 0, max: 2, step: 0.05 },
  { key: 'dsGlow', label: 'Свечение внутри', min: 0, max: 3, step: 0.05 },
  { key: 'dsExposure', label: 'Экспозиция', min: 0.5, max: 2, step: 0.05 },
];

const load = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error(`не загрузилась ${src}`));
  img.src = src;
});

export const DRAGON_SMOKE: CanvasSceneDef = {
  kind: 'canvas',
  id: 'dragon-smoke',
  label: 'Дракон и стекающий дым (фото + карта глубины)',
  palettes: [['#0d0c0b']],
  create(c) {
    const W = c.width;
    const H = c.height;
    let smoke: DragonSmoke | null = null;
    let failed = '';
    let clock = 0;
    const s = Math.min(c.dpr, 1.5) * (0.6 + 0.4 * clamp(c.params.quality, 0.35, 1));
    Promise.all([load(W * s > 1700 ? '/course/effects/dragon-burner-2560.webp' : '/course/effects/dragon-burner-1600.webp'), load('/course/effects/dragon-burner-surface.png')])
      .then(([photo, surface]) => {
        smoke = createDragonSmoke(Math.round(W * s), Math.round(H * s), photo, surface);
        if (!smoke) failed = 'нужен WebGL2 с float-текстурами';
        // The smoke already flowing when the picture first shows.
        else smoke.warm(12, look());
      })
      .catch((e: unknown) => {
        failed = e instanceof Error ? e.message : String(e);
      });
    const ptr = { x: 0, y: 0, vx: 0, vy: 0, active: false };
    // The camera: the eye moves a little round the burner (parallax from the depth map), the wheel brings it closer.
    const orbit = createOrbit(c, { pitch: [-40, 40], zoom: [1, 3] });
    const look = () => ({
      cam: [0.035 * Math.sin(orbit.yaw), 0.025 * Math.sin(orbit.pitch), orbit.zoom] as [number, number, number],
      rate: c.params.dsRate, heavy: c.params.dsHeavy, life: c.params.dsLife, swirl: c.params.dsSwirl,
      light: c.params.dsLight, shadow: c.params.dsShadow, glow: c.params.dsGlow, exposure: c.params.dsExposure,
    });
    let panelOpen = false;
    let dragKey: NumberKey | null = null;
    const gear = { x: 10, y: 10, s: 28 };
    const PW = Math.min(W - 20, 320);
    const ROW = 27;
    const panelX = 10;
    const panelY = 46;
    const trackX = panelX + 160;
    const trackW = PW - 160 - 48;
    const panelH = DRAGON_SMOKE_SETTINGS.length * ROW + 12;
    const panelRow = (x: number, y: number) => {
      if (!panelOpen || x < panelX || x > panelX + PW || y < panelY || y > panelY + panelH) return -1;
      return clamp(Math.floor((y - panelY - 6) / ROW), 0, DRAGON_SMOKE_SETTINGS.length - 1);
    };
    const setFromX = (key: NumberKey, x: number) => {
      const st = DRAGON_SMOKE_SETTINGS.find((q) => q.key === key)!;
      const v = st.min + clamp((x - trackX) / trackW, 0, 1) * (st.max - st.min);
      c.params[key] = Math.round(v / st.step) * st.step;
    };

    return {
      update(dt, _t, pIn) {
        const p = orbit.update(pIn);
        clock += Math.min(dt, 1 / 20);
        if (dragKey && p.pressed) setFromX(dragKey, p.rawX);
        if (!p.pressed) dragKey = null;
        const onGear = p.rawX >= gear.x && p.rawX <= gear.x + gear.s && p.rawY >= gear.y && p.rawY <= gear.y + gear.s;
        if (p.clicked) {
          const row = panelRow(p.rawX, p.rawY);
          if (onGear) panelOpen = !panelOpen;
          else if (row >= 0) {
            dragKey = DRAGON_SMOKE_SETTINGS[row].key;
            setFromX(dragKey, p.rawX);
          }
        }
        if (smoke) {
          const [ux, uy] = smoke.toPhoto(p.rawX, p.rawY, W, H, orbit.zoom);
          const k = 1 / Math.max(dt, 1e-3);
          ptr.vx = ptr.active ? (ux - ptr.x) * k : 0;
          ptr.vy = ptr.active ? (uy - ptr.y) * k : 0;
          ptr.x = ux;
          ptr.y = uy;
          ptr.active = p.active && panelRow(p.rawX, p.rawY) < 0 && !onGear;
        }
      },
      draw(g) {
        if (smoke) {
          smoke.frame(1 / 60, clock, look(), ptr);
          g.drawImage(smoke.canvas, 0, 0, W, H);
        } else {
          g.fillStyle = '#0d0c0b';
          g.fillRect(0, 0, W, H);
          g.fillStyle = '#e9e2cf';
          g.font = '14px sans-serif';
          g.textAlign = 'center';
          g.fillText(failed ? `Не удалось запустить: ${failed}` : 'Загрузка…', W / 2, H / 2);
        }
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
          g.font = '13px sans-serif';
          for (let i = 0; i < DRAGON_SMOKE_SETTINGS.length; i += 1) {
            const st = DRAGON_SMOKE_SETTINGS[i];
            const y = panelY + 6 + i * ROW + ROW / 2;
            const v = c.params[st.key];
            g.textAlign = 'left';
            g.fillStyle = '#f6eee0';
            g.fillText(st.label, panelX + 12, y);
            const fr = clamp((v - st.min) / (st.max - st.min), 0, 1);
            g.fillStyle = 'rgba(255,255,255,0.18)';
            g.fillRect(trackX, y - 2, trackW, 4);
            g.fillStyle = '#ffd27a';
            g.fillRect(trackX, y - 2, trackW * fr, 4);
            g.beginPath();
            g.arc(trackX + trackW * fr, y, dragKey === st.key ? 7 : 6, 0, Math.PI * 2);
            g.fill();
            g.textAlign = 'right';
            g.fillStyle = 'rgba(246,238,224,0.8)';
            g.fillText(v.toFixed(st.step < 0.1 ? 2 : 1), panelX + PW - 10, y);
          }
        }
        orbit.draw(g);
      },
      dispose() {
        orbit.dispose();
        smoke?.dispose();
      },
    };
  },
};
