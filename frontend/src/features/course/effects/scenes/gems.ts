import type { CanvasSceneDef, SceneParams } from './types';
import { clamp } from './kit';
import { createOrbit } from './orbitControl';
import { GEMS } from './gemsData';
import { createGemRenderer, type GemRenderer } from './gemsGL';
import { gemsCellRadius } from './gemsLayout';
import { gemsRenderSize } from './gemsResolution';

/**
 * An experimental effect: precious stones in a honeycomb (as the kaleidoscope's eyepieces), seen from above, each
 * cell the same stone on its backing — a fabric of its own colour, its mother rock or a metal setting; the cursor is
 * the lamp over them. Tracing is opt-in: a stable scene then refines to 64 samples and caches.
 *
 * The native stone selector is mounted beside the canvas; rendering settings remain in the admin tuning panel.
 */

type NumberKey = { [K in keyof SceneParams]: SceneParams[K] extends number ? K : never }[keyof SceneParams];

export const GEMS_SETTINGS: readonly { key: NumberKey; label: string; min: number; max: number; step: number }[] = [
  { key: 'gmCell', label: 'Размер сот', min: 0.4, max: 4, step: 0.05 },
  { key: 'gmCellMobile', label: 'Размер сот на телефоне', min: 0.4, max: 4, step: 0.05 },
  { key: 'gmLampH', label: 'Высота лампы', min: 120, max: 1400, step: 10 },
  { key: 'gmLampI', label: 'Сила лампы', min: 0, max: 4, step: 0.05 },
  { key: 'gmWarm', label: 'Тепло лампы', min: 0, max: 1, step: 0.05 },
  { key: 'gmStudio', label: 'Студийный свет', min: 0, max: 2, step: 0.05 },
  { key: 'gmFire', label: 'Огонь (дисперсия), ×', min: 0, max: 3, step: 0.05 },
  { key: 'gmGlow', label: 'Ореол бликов', min: 0, max: 2, step: 0.05 },
  { key: 'gmStars', label: 'Лучи бликов', min: 0, max: 2, step: 0.05 },
  { key: 'gmSpin', label: 'Повороты в сотах', min: 0, max: 1, step: 0.05 },
  { key: 'gmExposure', label: 'Экспозиция', min: 0.3, max: 3, step: 0.05 },
  { key: 'gmRes', label: 'Разрешение (1 = нативное)', min: 0.4, max: 1, step: 0.05 },
];

export const GEMS_SCENE: CanvasSceneDef = {
  kind: 'canvas',
  id: 'gems',
  label: 'Драгоценные камни (соты, свет от курсора)',
  pixelRatioCap: Infinity,
  defaultParams: { gmTrace: 0 },
  palettes: [['#08070a']],
  create(c) {
    const W = c.width;
    const H = c.height;
    let renderer: GemRenderer | null = null;
    let failed = '';
    let resNow = 0;
    const make = () => {
      renderer?.dispose();
      renderer = null;
      try {
        const size = gemsRenderSize(W, H, c.dpr, c.params.gmRes);
        renderer = createGemRenderer(size.width, size.height);
        if (!renderer) failed = 'нужен WebGL2 с float-текстурами';
      } catch (e) {
        failed = e instanceof Error ? e.message.slice(0, 200) : String(e);
        console.error('[gems] Renderer initialization failed', e);
      }
      resNow = c.params.gmRes;
    };
    make();
    let clock = 0;
    const gemOf = () => GEMS[clamp(Math.round(c.params.gmGem), 0, GEMS.length - 1)];

    let lampX = W / 2;
    let lampY = H / 2;
    // The camera: tilt the tray and turn it, the wheel brings it closer.
    const orbit = createOrbit(c, { pitch: [-55, 55], zoom: [0.5, 3] });

    return {
      update(dt, _t, pIn) {
        const p = orbit.update(pIn);
        clock += Math.min(dt, 1 / 20);
        if (resNow !== c.params.gmRes) make();
        // The lamp stays where it was left so automatic refinement can converge even when the cursor leaves.
        if (p.active) {
          // Raw input does not keep drifting after the user stops; freeze the lamp when leaving the scene too.
          lampX = Math.round(p.rawX * 4) / 4;
          lampY = Math.round(p.rawY * 4) / 4;
        }
      },
      draw(g) {
        const gem = gemOf();
        if (renderer) {
          const s = renderer.canvas.width / W;
          const cellR = gemsCellRadius(W, H, c.params.gmCell, c.params.gmCellMobile, c.body);
          renderer.render(gem, {
            lamp: [lampX, lampY, c.params.gmLampH],
            lampI: c.params.gmLampI,
            warm: c.params.gmWarm,
            studio: c.params.gmStudio,
            cellR,
            spin: c.params.gmSpin,
            backing: clamp(Math.round(c.params.gmBacking), 0, 2),
            fire: c.params.gmFire,
            glow: c.params.gmGlow,
            stars: c.params.gmStars,
            exposure: c.params.gmExposure,
            time: clock,
            cam: [orbit.yaw, orbit.pitch, orbit.zoom],
            trace: c.params.gmTrace >= 0.5,
          }, s);
          if(process.env.NODE_ENV !== 'production') g.canvas.dataset.gems = JSON.stringify({ ...renderer.diagnostics,
            gem:gem.id,lamp:[lampX,lampY,c.params.gmLampH],camera:[orbit.yaw,orbit.pitch,orbit.zoom],
            renderWidth: renderer.canvas.width, renderHeight: renderer.canvas.height, nativeDpr: c.dpr, quality: c.params.gmRes });
          g.drawImage(renderer.canvas, 0, 0, W, H);
        } else {
          g.fillStyle = '#08070a';
          g.fillRect(0, 0, W, H);
          g.fillStyle = '#e9e2cf';
          g.font = '14px sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(failed ? `Не удалось запустить: ${failed}` : 'Загрузка…', W / 2, H / 2);
        }
        orbit.draw(g);
      },
      dispose() {
        orbit.dispose();
        renderer?.dispose();
      },
    };
  },
};
