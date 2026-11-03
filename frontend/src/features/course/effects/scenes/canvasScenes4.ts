import type { CanvasSceneDef } from './types';
import { createClearLedOptics } from './clearLed';
import { FONT_SANS, TAU, clamp, fillGradient, glow, mixHex, rgb, rgba } from './kit';

type LedMode = 'plasma' | 'matrix' | 'equalizer' | 'life' | 'ripple' | 'text';
const LED_MODES: LedMode[] = ['plasma', 'matrix', 'equalizer', 'life', 'ripple', 'text'];
const LED_MODE_SECONDS = 9;
/** For the tuning panel's "Заставка" dropdown: index 0 is `preset` value 0 (automatic), 1..6 pin `LED_MODES[i-1]`. */
export const LED_MODE_LABELS = ['Авто (сама переключает)', 'Плазма', 'Падающий код', 'Эквалайзер', 'Жизнь', 'Кольца', 'Бегущая строка'];
/** For the tuning panel's "Вид светодиодов" dropdown, matching `style` 0..8. */
export const LED_STYLE_LABELS = [
  'Круглые лампы',
  'Квадратные пиксели',
  'RGB SMD — чистые',
  'RGB SMD — кристаллики с ореолами',
  'RGB SMD — рассеяние в линзе',
  'RGB SMD — потёртые (крупный план)',
  'Стеклянные (прозрачный купол)',
  'Полуматовые (рассеяние в куполе)',
  'Боком (в торец платы)',
];

function palCycle(pal: string[], t: number): string {
  const u = (((t % 1) + 1) % 1) * 3;
  const i = Math.floor(u);
  const f = u - i;
  return mixHex(pal[1 + (i % 3)], pal[1 + ((i + 1) % 3)], f);
}

export const CANVAS_SCENES_4: CanvasSceneDef[] = [
  {
    kind: 'canvas',
    id: 'speakers',
    label: 'Колонки на вечеринке',
    palettes: [['#0a0616', '#ff2a7a', '#2affe0', '#ffcf3a'], ['#060a1c', '#7a4dff', '#2affb0', '#ff9a3c'], ['#0a0a0a', '#3affe6', '#ff3a8a', '#e0ff3a']],
    create(c) {
      const W = c.width;
      const H = c.height;
      const dark = c.body;
      // Two cabinets, mirrored, sized to the card so they still read at a small card size.
      const cabW = clamp(W * 0.17, 44, 130);
      const cabH = clamp(H * 0.82, 90, 300);
      const y0 = H - cabH - H * 0.02;
      const cabs = [
        { x: W * (dark ? 0.28 : 0.16) - cabW / 2, side: -1 },
        { x: W * (dark ? 0.72 : 0.84) - cabW / 2, side: 1 },
      ];
      const LED_COUNT = 10;
      // Bass/treble envelopes per cabinet (a little offset so the two are not perfect mirrors).
      const bass = [0, 0];
      const treble = [0, 0];
      const ledPhase = [c.rand() * 10, c.rand() * 10];
      type Ring = { x: number; y: number; r: number; life: number; hue: number };
      const rings: Ring[] = [];
      const haze: Array<{ x: number; y: number; r: number; vx: number }> = Array.from({ length: 10 }, () => ({ x: c.rand() * W, y: H * (0.3 + c.rand() * 0.6), r: 14 + c.rand() * 30, vx: (c.rand() - 0.5) * 6 }));
      const lights = [
        { a: 0.2, sp: 0.5, hue: 1 },
        { a: 0.6, sp: -0.4, hue: 2 },
        { a: 1.0, sp: 0.35, hue: 3 },
      ];
      let beatClock = 0;
      let beatIndex = 0;
      let flash = 0;
      let shake = 0;

      const kick = (strength: number, x: number, y: number, hue: number) => {
        bass[0] = Math.max(bass[0], strength);
        bass[1] = Math.max(bass[1], strength);
        rings.push({ x, y, r: 4, life: 1, hue });
        flash = Math.max(flash, strength * 0.5);
        shake = Math.max(shake, strength * 2.2);
      };

      return {
        update(dt, t, p) {
          const bpm = 96 + 40 * clamp(c.params.speed, 0, 2);
          beatClock += dt * (bpm / 60);
          while (beatClock >= 1) {
            beatClock -= 1;
            beatIndex += 1;
            // Four-on-the-floor kick, with a lighter off-beat hat driving the tweeters/LEDs.
            const cx0 = cabs[0].x + cabW / 2;
            const cx1 = cabs[1].x + cabW / 2;
            const cy = y0 + cabH * 0.33;
            kick(0.85 + c.rand() * 0.15, cx0, cy, 1 + (beatIndex % 3));
            kick(0.85 + c.rand() * 0.15, cx1, cy, 1 + ((beatIndex + 1) % 3));
            if (beatIndex % 2 === 1) {
              treble[0] = 1;
              treble[1] = 1;
            }
          }
          // A steady hat under the kick so the tweeters/LEDs never go fully idle.
          treble[0] = Math.max(treble[0], 0.18 + 0.1 * Math.sin(t * 9));
          treble[1] = Math.max(treble[1], 0.18 + 0.1 * Math.sin(t * 9 + 1.3));

          // The cursor: nearby it "turns the volume up"; a click or a fast pass is a hand-clap kick.
          if (p.active) {
            for (let i = 0; i < 2; i += 1) {
              const cx = cabs[i].x + cabW / 2;
              const cy = y0 + cabH * 0.33;
              const d = Math.hypot(p.x - cx, p.y - cy);
              const near = Math.exp(-d / (cabW * 2.2)) * c.params.react;
              bass[i] = Math.max(bass[i], near * 0.7);
              treble[i] = Math.max(treble[i], near * 0.9);
            }
            const speed = Math.hypot(p.vx, p.vy);
            if ((p.clicked || speed > 900) && c.params.react > 0) {
              const cx0 = cabs[0].x + cabW / 2;
              const cx1 = cabs[1].x + cabW / 2;
              const cy = y0 + cabH * 0.33;
              kick(1, cx0, cy, 4);
              kick(1, cx1, cy, 4);
            }
          }

          for (let i = 0; i < 2; i += 1) {
            bass[i] = Math.max(0, bass[i] - dt * 2.6);
            treble[i] = Math.max(0, treble[i] - dt * 5.5);
          }
          for (let i = rings.length - 1; i >= 0; i -= 1) {
            const r = rings[i];
            r.r += dt * (cabW * 3.2);
            r.life -= dt * 1.1;
            if (r.life <= 0) rings.splice(i, 1);
          }
          for (const h of haze) {
            h.x += h.vx * dt;
            if (h.x < -40) h.x = W + 40;
            if (h.x > W + 40) h.x = -40;
          }
          flash = Math.max(0, flash - dt * 1.8);
          shake = Math.max(0, shake - dt * 6);
          void t;
        },
        draw(g) {
          const jx = (Math.sin(performance.now() / 40) * shake) | 0;
          fillGradient(g, W, H, mixHex(c.palette[0], '#000000', 0.1), '#000000');
          // Sweeping stage lights and haze, behind everything.
          g.globalCompositeOperation = 'lighter';
          for (const l of lights) {
            const ang = l.a + performance.now() * 0.0002 * l.sp;
            const lx = W * (0.5 + Math.sin(ang) * 0.55);
            g.fillStyle = rgba(c.palette[l.hue], 0.05 + 0.05 * flash);
            g.beginPath();
            g.moveTo(lx, -10);
            g.lineTo(lx - W * 0.16, H * 0.75);
            g.lineTo(lx + W * 0.16, H * 0.75);
            g.closePath();
            g.fill();
          }
          for (const h of haze) {
            g.fillStyle = rgba('#ffffff', 0.02);
            g.beginPath();
            g.arc(h.x, h.y, h.r, 0, TAU);
            g.fill();
          }
          g.globalCompositeOperation = 'source-over';

          for (let i = 0; i < 2; i += 1) {
            const cab = cabs[i];
            const x = cab.x + jx * 0.4;
            const y = y0;
            // Cabinet.
            const body = g.createLinearGradient(x, 0, x + cabW, 0);
            body.addColorStop(0, '#0c0c10');
            body.addColorStop(0.5, '#1c1c22');
            body.addColorStop(1, '#0c0c10');
            g.fillStyle = body;
            g.beginPath();
            if (g.roundRect) g.roundRect(x, y, cabW, cabH, 6);
            else g.rect(x, y, cabW, cabH);
            g.fill();
            g.strokeStyle = 'rgba(0,0,0,0.6)';
            g.lineWidth = 2;
            g.stroke();

            // The woofer: a cone whose apparent depth shifts with `bass[i]` (in = pushed toward the magnet).
            const wr = cabW * 0.36;
            const wx = x + cabW / 2;
            const wy = y + cabH * 0.36;
            const push = bass[i];
            const rings3 = 4;
            for (let k = rings3; k >= 0; k -= 1) {
              const f = k / rings3;
              const r = wr * (0.3 + 0.7 * f);
              const depth = push * (1 - f) * 0.35;
              const shade = 0.14 + 0.5 * f - depth;
              g.fillStyle = `rgb(${Math.round(255 * clamp(shade, 0.03, 0.7))},${Math.round(255 * clamp(shade, 0.03, 0.7))},${Math.round(255 * clamp(shade + 0.02, 0.03, 0.72))})`;
              g.beginPath();
              g.ellipse(wx, wy + depth * r * 0.5, r, r * (0.94 - depth * 0.3), 0, 0, TAU);
              g.fill();
            }
            g.fillStyle = 'rgba(255,255,255,0.18)';
            g.beginPath();
            g.ellipse(wx - wr * 0.25, wy - wr * 0.3 + push * wr * 0.15, wr * 0.16, wr * 0.09, -0.5, 0, TAU);
            g.fill();
            // The surround (rubber ring) lit by the LED bezel colour.
            g.strokeStyle = rgba(c.palette[i === 0 ? 2 : 1], 0.35 + 0.5 * bass[i]);
            g.lineWidth = 2;
            g.beginPath();
            g.arc(wx, wy, wr * 1.04, 0, TAU);
            g.stroke();

            // The tweeter, above, trembling with the treble.
            const tr = cabW * 0.11;
            const tx = wx;
            const ty = y + cabH * 0.13;
            g.fillStyle = `rgb(${20 + treble[i] * 60},${20 + treble[i] * 60},${26 + treble[i] * 70})`;
            g.beginPath();
            g.arc(tx, ty, tr * (1 + treble[i] * 0.12), 0, TAU);
            g.fill();
            g.strokeStyle = rgba(c.palette[3], 0.3 + 0.6 * treble[i]);
            g.lineWidth = 1.5;
            g.stroke();

            // The VU-meter LED column down the outer edge.
            const ledX = cab.side < 0 ? x + cabW - 9 : x + 9;
            const ledTop = y + cabH * 0.18;
            const ledBottom = y + cabH * 0.92;
            const level = clamp(0.5 * bass[i] + 0.5 * treble[i], 0, 1);
            const lit = Math.round(LED_COUNT * level);
            for (let k = 0; k < LED_COUNT; k += 1) {
              const ly = ledBottom - (k / (LED_COUNT - 1)) * (ledBottom - ledTop);
              const on = k < lit;
              const hueT = k / (LED_COUNT - 1);
              const col = hueT < 0.6 ? c.palette[2] : hueT < 0.85 ? c.palette[3] : c.palette[1];
              g.fillStyle = on ? rgba(col, 0.95) : 'rgba(255,255,255,0.06)';
              g.beginPath();
              g.arc(ledX, ly, 3, 0, TAU);
              g.fill();
              if (on) {
                g.globalCompositeOperation = 'lighter';
                glow(g, ledX, ly, 9, col, 0.55);
                g.globalCompositeOperation = 'source-over';
              }
            }

            // A slow colour chase around the cabinet's bezel — alive even between beats.
            const chase = (performance.now() / 900 + ledPhase[i]) % 1;
            const bezelY = y + cabH * 0.5 + Math.sin(chase * TAU) * cabH * 0.28;
            g.globalCompositeOperation = 'lighter';
            glow(g, cab.side < 0 ? x + cabW - 2 : x + 2, bezelY, 14, c.palette[((i + Math.floor(chase * 3)) % 3) + 1], 0.35);
            g.globalCompositeOperation = 'source-over';
          }

          // Sound-wave rings bursting outward from a kick.
          g.globalCompositeOperation = 'lighter';
          for (const r of rings) {
            g.strokeStyle = rgba(c.palette[(r.hue % 3) + 1], r.life * 0.5);
            g.lineWidth = 2;
            g.beginPath();
            g.arc(r.x, r.y, r.r, 0, TAU);
            g.stroke();
          }
          if (flash > 0.02) {
            g.fillStyle = rgba('#ffffff', flash * 0.06);
            g.fillRect(0, 0, W, H);
          }
          g.globalCompositeOperation = 'source-over';
        },
      };
    },
  },
  {
    kind: 'canvas',
    id: 'led-matrix',
    pixelRatioCap: 2,
    label: 'Экран из светодиодов',
    palettes: [['#020304', '#ff2a4d', '#2affb0', '#ffd23f'], ['#020304', '#2ab0ff', '#ff5ac8', '#e0ff3a'], ['#020304', '#ff8a2a', '#2ae0ff', '#c8ff3a']],
    // The panel opens on the glass LEDs, board flat, LEDs on the finer side — settled on after tuning by eye.
    defaultParams: { intensity: 0.65, style: 6, tilt: 0, zoom: 1, ledSize: 0.5 },
    create(c) {
      const W = c.width;
      const H = c.height;
      /** A repeatable random number for a cell, independent of `c.rand()` — the same value every time this cell's
       * scuffs/specks are painted, whether that happens in the static board layer or in a later lit frame. Pure
       * (doesn't depend on the board's size/tilt), so it stays put across geometry rebuilds. */
      const hash2 = (a: number, b: number, salt: number) => {
        let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(salt, 2246822519)) >>> 0;
        h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
        return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
      };

      type PointerCell = { x: number; y: number; vx: number; active: number; clicked: number; col: number; row: number; react: number };

      /** Everything that depends on the board's tilt, zoom or LED coarseness: grid size, the 3D projection, the
       * six prerendered panel layers and the per-screensaver state. Rebuilt only when one of those three sliders
       * actually changes (see `update()`), not every frame — building six offscreen canvases every frame would be
       * wasteful, but rebuilding on a slider change is cheap and keeps the panel controls feeling live. */
      const clearLed = createClearLedOptics((phase) => palCycle(c.palette, phase));
      function buildGeometry(tiltAmt: number, zoomAmt: number, ledSizeAmt: number) {
        // The LED pitch (dot + gap): about 9 px on a normal card, coarser on a tiny one, never more cells than the
        // card can comfortably draw every frame — scaled by `ledSizeAmt`, the "Крупность светодиодов" slider.
        const pitchTarget = clamp(W / 60, 6, 11) * ledSizeAmt;
        const cols = clamp(Math.round(W / pitchTarget), 18, 64);
        // The grid's own pitch (unzoomed) — only used to size the grid itself (`rows`) and as the reference for
        // `guessPitch` below. The on-screen rendering pitch (`pitch`, defined further down once `zoomAmt` is
        // folded in) is a different, zoom-scaled number — see the comment there.
        const gridPitch = W / cols;
        const rows = clamp(Math.round(H / gridPitch), 6, 20);
        const n = cols * rows;
        const level = new Float32Array(n);
        const hueT = new Float32Array(n);
        const idx = (col: number, row: number) => row * cols + col;

        // ---- the board seen at a slight angle -----------------------------------------------------------------
        // The panel is a flat rectangle in its own space, turned a little sideways (yaw) and tipped a little
        // (pitch), then seen through a simple pinhole camera — the same idea as `iso-town`'s isometric grid, just
        // with real perspective instead of a fixed axonometric angle. Every cell's screen position and a size
        // factor (nearer = bigger) are worked out once here, not every frame. `tiltAmt` (the "Наклон платы"
        // slider) scales both angles down to 0 for a flat, non-perspective grid — the pre-3D look.
        const YAW = 0.4 * tiltAmt; // the board turned toward its right edge
        const PITCH_ANGLE = -0.14 * tiltAmt; // tipped as if seen slightly from below
        const CAM_Z = 3.3;
        const FOCAL = 3;
        const project3d = (px: number, py: number) => {
          const x1 = px * Math.cos(YAW);
          const z1 = -px * Math.sin(YAW);
          const y2 = py * Math.cos(PITCH_ANGLE) - z1 * Math.sin(PITCH_ANGLE);
          const z2 = py * Math.sin(PITCH_ANGLE) + z1 * Math.cos(PITCH_ANGLE);
          // Clamped so a far corner of a wide grid can never land behind the camera (negative/zero scale, which
          // would flip signs and hand a negative radius to arc()/ellipse() further down) or blow up to a huge one.
          const s = clamp(FOCAL / (CAM_Z + z2), 0.15, 2.2);
          return { x: x1 * s, y: y2 * s, s };
        };
        // Calibrate the board's own scale so the tilted, foreshortened rectangle still fills most of the card:
        // project a guessed size once, measure it, and correct. `zoomAmt` (the "Приближение" slider) then scales
        // that fit up or down — a simple camera-distance zoom, cropping the edges once zoomed in past 1.
        const guessPitch = Math.min(gridPitch, H / rows) * 1.05;
        const half = (n2: number, guess: number) => ((n2 - 1) / 2) * guess;
        const corners = [
          project3d(-half(cols, guessPitch), -half(rows, guessPitch)),
          project3d(half(cols, guessPitch), -half(rows, guessPitch)),
          project3d(-half(cols, guessPitch), half(rows, guessPitch)),
          project3d(half(cols, guessPitch), half(rows, guessPitch)),
        ];
        const boxW = Math.max(...corners.map((p) => p.x)) - Math.min(...corners.map((p) => p.x));
        const boxH = Math.max(...corners.map((p) => p.y)) - Math.min(...corners.map((p) => p.y));
        const calib = Math.min((W * 0.94) / boxW, (H * 0.84) / boxH) * zoomAmt;
        const cellPitch3d = guessPitch * calib;
        // The on-screen size of one LED: scaled by the same `zoomAmt` as the spacing between them (already baked
        // into `cellPitch3d` via `calib`), so "Приближение" behaves like a real camera zoom — LEDs get both
        // farther apart AND bigger together — rather than just spreading out while staying the same size.
        const pitch = gridPitch * zoomAmt;

        const projX = new Float32Array(n);
        const projY = new Float32Array(n);
        const projS = new Float32Array(n);
        for (let row = 0; row < rows; row += 1) {
          for (let col = 0; col < cols; col += 1) {
            const px = (col - (cols - 1) / 2) * cellPitch3d;
            const py = (row - (rows - 1) / 2) * cellPitch3d;
            const proj = project3d(px, py);
            const i = idx(col, row);
            projX[i] = W / 2 + proj.x;
            projY[i] = H / 2 + proj.y;
            projS[i] = proj.s;
          }
        }
        // The screen-space distance to a cell's nearest neighbour — measured directly off the projected grid
        // rather than derived from `pitch * projS[i]`. The two drift apart under yaw: rotating the board widens
        // its bounding box, which the calibration above compensates by shrinking `cellPitch3d` more than the
        // per-cell perspective scale `projS` alone accounts for, so a size built from `pitch * projS[i]` used to
        // end up visibly smaller than the actual gap to the next LED — more empty board showing through as tilt
        // increased. Sizing every style from this measured spacing instead keeps footprints packed tight at any
        // tilt, zoom or LED-size setting.
        const projPitch = new Float32Array(n);
        for (let row = 0; row < rows; row += 1) {
          for (let col = 0; col < cols; col += 1) {
            const i = idx(col, row);
            let d = Infinity;
            if (col + 1 < cols) d = Math.min(d, Math.hypot(projX[idx(col + 1, row)] - projX[i], projY[idx(col + 1, row)] - projY[i]));
            if (col > 0) d = Math.min(d, Math.hypot(projX[i] - projX[idx(col - 1, row)], projY[i] - projY[idx(col - 1, row)]));
            if (row + 1 < rows) d = Math.min(d, Math.hypot(projX[idx(col, row + 1)] - projX[i], projY[idx(col, row + 1)] - projY[i]));
            if (row > 0) d = Math.min(d, Math.hypot(projX[i] - projX[idx(col, row - 1)], projY[i] - projY[idx(col, row - 1)]));
            projPitch[i] = Number.isFinite(d) ? d : pitch;
          }
        }
        /** Shared geometry for the RGB-chip styles (2..5) at cell i: the three sub-diode slots and the dome that
         * may sit over them, sized from the cell's own measured on-screen spacing. Sized to leave little gap
         * between neighbouring footprints — a tightly packed macro-photo look rather than sparse dots. */
        const rgbGeom = (i: number) => {
          const p = projPitch[i];
          const subW = p / 2.6;
          const subH = p * 0.78;
          return { cx: projX[i], cy: projY[i], subW, subH, domeR: subW * 2.15 };
        };
        /** Shared radius for the round-dome styles (0, 6, 7) at cell i. */
        const roundR = (i: number) => projPitch[i] * 0.48;

        // The board's own outline, a little past the outermost LEDs, and where the (fixed, top-left) light casts
        // each LED's shadow onto it.
        const boardCorner = (cx: number, cy: number) => {
          const px = (cols / 2 + 1.1) * cellPitch3d * cx;
          const py = (rows / 2 + 1.15) * cellPitch3d * cy;
          const proj = project3d(px, py);
          return { x: W / 2 + proj.x, y: H / 2 + proj.y };
        };
        const boardQuad = [boardCorner(-1, -1), boardCorner(1, -1), boardCorner(1, 1), boardCorner(-1, 1)];
        const shadowDX = 0.16 * cellPitch3d * Math.cos(YAW);
        const shadowDY = 0.16 * cellPitch3d;

        // The dark, never-lit board of each physical style: prerendered once, then just blitted every frame. A real
        // panel's unlit look does not depend on which colour a diode shows when lit, only on its casing and its PCB
        // — hence fixed styles here rather than one look re-tinted per cell.
        const makePanel = (paint: (pg: CanvasRenderingContext2D) => void, resolution = 1) => {
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(W * resolution);
          canvas.height = Math.round(H * resolution);
          const pg = canvas.getContext('2d')!;
          pg.scale(canvas.width / W, canvas.height / H);
          fillGradient(pg, W, H, '#03040a', '#000000');
          // The PCB itself: a tilted quad, shaded a little darker on the far (upper-left) side, the way a flat
          // panel catches less light there.
          const boardShade = pg.createLinearGradient(boardQuad[1].x, boardQuad[1].y, boardQuad[3].x, boardQuad[3].y);
          boardShade.addColorStop(0, '#141a16');
          boardShade.addColorStop(1, '#050705');
          pg.fillStyle = boardShade;
          pg.beginPath();
          pg.moveTo(boardQuad[0].x, boardQuad[0].y);
          for (let k = 1; k < 4; k += 1) pg.lineTo(boardQuad[k].x, boardQuad[k].y);
          pg.closePath();
          pg.fill();
          // A thin bright bezel along the board's near (bottom-right) edge, and mounting screws at its corners.
          pg.strokeStyle = 'rgba(140,150,145,0.4)';
          pg.lineWidth = 1;
          pg.stroke();
          for (const cnr of boardQuad) {
            // `boxH` comes from the calibration pass (pre-scale guess corners) and can be a different scale than
            // the real `boardQuad`, so the fraction below isn't guaranteed to land in [0,1] on an extreme aspect
            // ratio — clamp it so a screw radius is never zero or negative.
            const sc = clamp(1 - ((cnr.y - Math.min(...boardQuad.map((q) => q.y))) / boxH) * 0.15, 0.5, 1);
            pg.fillStyle = 'rgba(10,10,10,0.9)';
            pg.beginPath();
            pg.arc(cnr.x, cnr.y, 3.2 * sc, 0, TAU);
            pg.fill();
            pg.strokeStyle = 'rgba(170,175,170,0.5)';
            pg.lineWidth = 0.8;
            pg.stroke();
          }
          // Faint copper traces: short seeded segments between neighbouring footprints.
          pg.strokeStyle = 'rgba(120,140,120,0.06)';
          pg.lineWidth = 1;
          for (let row = 0; row < rows; row += 2) {
            pg.beginPath();
            for (let col = 0; col < cols; col += 1) {
              const i = idx(col, row);
              if (col === 0) pg.moveTo(projX[i], projY[i]);
              else pg.lineTo(projX[i], projY[i]);
            }
            pg.stroke();
          }
          // Each footprint's drop shadow on the board — soldered parts sit a hair proud of it.
          pg.fillStyle = 'rgba(0,0,0,0.4)';
          for (let row = 0; row < rows; row += 1) {
            for (let col = 0; col < cols; col += 1) {
              const i = idx(col, row);
              const r = projPitch[i] * 0.46;
              pg.beginPath();
              pg.ellipse(projX[i] + shadowDX * projS[i], projY[i] + shadowDY * projS[i], r * 0.9, r * 0.7, 0, 0, TAU);
              pg.fill();
            }
          }
          paint(pg);
          const vign = pg.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.8);
          vign.addColorStop(0, 'rgba(0,0,0,0)');
          vign.addColorStop(1, 'rgba(0,0,0,0.5)');
          pg.fillStyle = vign;
          pg.fillRect(0, 0, W, H);
          return canvas;
        };
        const panels = [
          // Round lamps: two solder legs into the board, a diffuser dome above them whose unlit plastic is a faint
          // warm-grey (never pure black — a real LED's resin lens still catches ambient light).
          makePanel((pg) => {
            for (let row = 0; row < rows; row += 1) {
              for (let col = 0; col < cols; col += 1) {
                const i = idx(col, row);
                const cx = projX[i];
                const cy = projY[i];
                const r = roundR(i);
                pg.strokeStyle = 'rgba(190,190,180,0.5)';
                pg.lineWidth = Math.max(0.6, r * 0.12);
                pg.beginPath();
                pg.moveTo(cx - r * 0.35, cy + r * 0.6);
                pg.lineTo(cx - r * 0.35, cy + r * 1.15);
                pg.moveTo(cx + r * 0.35, cy + r * 0.6);
                pg.lineTo(cx + r * 0.35, cy + r * 1.15);
                pg.stroke();
                const dome = pg.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
                dome.addColorStop(0, 'rgba(58,54,50,0.85)');
                dome.addColorStop(0.7, 'rgba(28,26,26,0.9)');
                dome.addColorStop(1, 'rgba(10,10,12,0.95)');
                pg.fillStyle = dome;
                pg.beginPath();
                pg.arc(cx, cy, r, 0, TAU);
                pg.fill();
              }
            }
          }),
          // Square pixels: a video-wall's flat SMD packages on visible corner pads, dark plastic with a thin bezel.
          makePanel((pg) => {
            for (let row = 0; row < rows; row += 1) {
              for (let col = 0; col < cols; col += 1) {
                const i = idx(col, row);
                const s = projPitch[i] * 0.94;
                const cx = projX[i];
                const cy = projY[i];
                pg.fillStyle = 'rgba(200,195,180,0.55)';
                for (const [ox, oy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
                  pg.fillRect(cx + (ox * s) / 2 - s * 0.06, cy + (oy * s) / 2 - s * 0.06, s * 0.12, s * 0.12);
                }
                pg.fillStyle = 'rgba(18,18,20,0.92)';
                pg.strokeStyle = 'rgba(0,0,0,0.6)';
                pg.lineWidth = 1;
                pg.beginPath();
                if (pg.roundRect) pg.roundRect(cx - s / 2, cy - s / 2, s, s, projPitch[i] * 0.08);
                else pg.rect(cx - s / 2, cy - s / 2, s, s);
                pg.fill();
                pg.stroke();
              }
            }
          }),
          // RGB SMD chips: three unlit sub-diodes per pixel on their own tiny package, each tinted its own colour
          // even when off — the characteristic look of a close-up photo of an LED wall. Style 3 ("crystals") reuses
          // this same unlit look; only how a lit chip is painted differs (see draw()).
          makePanel((pg) => {
            for (let row = 0; row < rows; row += 1) {
              for (let col = 0; col < cols; col += 1) {
                const { cx, cy, subW, subH } = rgbGeom(idx(col, row));
                pg.fillStyle = 'rgba(210,205,190,0.4)';
                pg.fillRect(cx - subW * 1.7, cy - subH * 0.62, subW * 3.4, subH * 0.16);
                pg.fillRect(cx - subW * 1.7, cy + subH * 0.46, subW * 3.4, subH * 0.16);
                const subCols: [number, string][] = [[-1, 'rgba(46,10,10,0.9)'], [0, 'rgba(8,32,12,0.9)'], [1, 'rgba(8,12,42,0.9)']];
                for (const [off, colour] of subCols) {
                  pg.fillStyle = colour;
                  pg.fillRect(cx + off * subW * 1.05 - subW / 2, cy - subH / 2, subW, subH);
                }
              }
            }
          }),
        ];
        // RGB SMD under a shared silicone dome (styles 4 and 5): the same three chip windows and corner pads, plus
        // a faint frosted bump — a real dome catches a soft specular highlight even switched off. `scuffed` also
        // bakes in a few scratches and dust specks, always at the same spot on a given cell (`hash2`), so the lit
        // catch-light highlights drawn in draw() land exactly on them.
        const makeDomePanel = (scuffed: boolean) =>
          makePanel((pg) => {
            for (let row = 0; row < rows; row += 1) {
              for (let col = 0; col < cols; col += 1) {
                const i = idx(col, row);
                const { cx, cy, subW, subH, domeR } = rgbGeom(i);
                pg.fillStyle = 'rgba(210,205,190,0.35)';
                pg.fillRect(cx - subW * 1.7, cy - subH * 0.62, subW * 3.4, subH * 0.16);
                pg.fillRect(cx - subW * 1.7, cy + subH * 0.46, subW * 3.4, subH * 0.16);
                const subCols: [number, string][] = [[-1, 'rgba(40,10,10,0.5)'], [0, 'rgba(8,28,12,0.5)'], [1, 'rgba(8,10,38,0.5)']];
                for (const [off, colour] of subCols) {
                  pg.fillStyle = colour;
                  pg.fillRect(cx + off * subW * 1.05 - subW / 2, cy - subH / 2, subW, subH);
                }
                const dome = pg.createRadialGradient(cx - domeR * 0.25, cy - domeR * 0.3, domeR * 0.05, cx, cy, domeR);
                dome.addColorStop(0, 'rgba(70,66,60,0.26)');
                dome.addColorStop(0.6, 'rgba(30,28,26,0.2)');
                dome.addColorStop(1, 'rgba(10,10,10,0)');
                pg.fillStyle = dome;
                pg.beginPath();
                pg.ellipse(cx, cy, domeR, domeR * 0.82, 0, 0, TAU);
                pg.fill();
                if (!scuffed) continue;
                // A few faint scratches and specks of dust, seeded per cell so they never move frame to frame.
                for (let k = 0; k < 3; k += 1) {
                  const rx = (hash2(col, row, k * 7 + 1) - 0.5) * domeR * 1.3;
                  const ry = (hash2(col, row, k * 7 + 2) - 0.5) * domeR * 0.9;
                  pg.strokeStyle = 'rgba(255,255,255,0.05)';
                  pg.lineWidth = 0.6;
                  pg.beginPath();
                  pg.moveTo(cx + rx - 2, cy + ry);
                  pg.lineTo(cx + rx + 2, cy + ry + (hash2(col, row, k * 7 + 5) - 0.5) * 3);
                  pg.stroke();
                }
                for (let k = 0; k < 2; k += 1) {
                  pg.fillStyle = 'rgba(0,0,0,0.16)';
                  pg.beginPath();
                  pg.arc(cx + (hash2(col, row, k + 20) - 0.5) * domeR, cy + (hash2(col, row, k + 30) - 0.5) * domeR * 0.8, 0.5 + hash2(col, row, k + 40), 0, TAU);
                  pg.fill();
                }
              }
            }
          });
        // Style 3 ("crystals") is lit differently from style 2 but looks identical switched off, so it reuses
        // panels[2] rather than rendering its own — the index must line up 1:1 with `style`, hence the explicit
        // duplicate push rather than leaving a gap.
        panels.push(panels[2], makeDomePanel(false), makeDomePanel(true));

        // Clear epoxy package, solder, reflector cup, die and bond wire; baked at display density.
        panels.push(
          makePanel((pg) => {
            for (let row = 0; row < rows; row += 1) {
              for (let col = 0; col < cols; col += 1) {
                const i = idx(col, row);
                clearLed.housing(pg, projX[i], projY[i], projPitch[i] * 0.42);
              }
            }
          }, Math.min(2, Math.max(1, c.dpr))),
        );
        // Style 7, "frosted": the same dome, cast from a matte/sandblasted resin — cloudier, no sharp glints, the
        // lead-frame only a soft blur behind the frosted surface (light diffusing through it, not past it).
        panels.push(
          makePanel((pg) => {
            for (let row = 0; row < rows; row += 1) {
              for (let col = 0; col < cols; col += 1) {
                const i = idx(col, row);
                const cx = projX[i];
                const cy = projY[i];
                const r = roundR(i);
                pg.strokeStyle = 'rgba(190,190,180,0.5)';
                pg.lineWidth = Math.max(0.6, r * 0.12);
                pg.beginPath();
                pg.moveTo(cx - r * 0.35, cy + r * 0.6);
                pg.lineTo(cx - r * 0.35, cy + r * 1.15);
                pg.moveTo(cx + r * 0.35, cy + r * 0.6);
                pg.lineTo(cx + r * 0.35, cy + r * 1.15);
                pg.stroke();
                pg.fillStyle = 'rgba(40,42,44,0.35)';
                pg.beginPath();
                pg.ellipse(cx, cy + r * 0.15, r * 0.2, r * 0.28, 0, 0, TAU);
                pg.fill();
                const dome = pg.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.1, cx, cy, r);
                dome.addColorStop(0, 'rgba(215,212,205,0.62)');
                dome.addColorStop(0.6, 'rgba(150,148,142,0.58)');
                dome.addColorStop(1, 'rgba(70,68,64,0.7)');
                pg.fillStyle = dome;
                pg.beginPath();
                pg.arc(cx, cy, r, 0, TAU);
                pg.fill();
              }
            }
          }),
        );
        // Style 8, "side-mounted": a real side-view/edge-lit SMD package lying on its back, its lens window facing
        // sideways (down-screen here) instead of up — the look used in edge-lit signage. A flat body on two small
        // side pads, with the emitting window as a bright strip along its lower edge.
        panels.push(
          makePanel((pg) => {
            for (let row = 0; row < rows; row += 1) {
              for (let col = 0; col < cols; col += 1) {
                const i = idx(col, row);
                const cx = projX[i];
                const cy = projY[i];
                const bw = projPitch[i] * 0.86;
                const bh = projPitch[i] * 0.56;
                pg.fillStyle = 'rgba(180,178,170,0.5)';
                pg.fillRect(cx - bw * 0.62, cy - bh * 0.1, bw * 0.16, bh * 0.3);
                pg.fillRect(cx + bw * 0.46, cy - bh * 0.1, bw * 0.16, bh * 0.3);
                pg.fillStyle = 'rgba(20,20,22,0.92)';
                pg.strokeStyle = 'rgba(0,0,0,0.6)';
                pg.lineWidth = 1;
                pg.beginPath();
                if (pg.roundRect) pg.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, projPitch[i] * 0.06);
                else pg.rect(cx - bw / 2, cy - bh / 2, bw, bh);
                pg.fill();
                pg.stroke();
                // The emitting window: a bright strip along the package's lower (viewer-facing) edge.
                pg.fillStyle = 'rgba(150,170,175,0.5)';
                pg.fillRect(cx - bw * 0.36, cy + bh * 0.18, bw * 0.72, bh * 0.22);
              }
            }
          }),
        );

        // ---- per-mode state ------------------------------------------------------------------------------------
        const matrixHead = new Float32Array(cols);
        const matrixSpeed = new Float32Array(cols);
        const matrixTail = new Int16Array(cols);
        for (let col = 0; col < cols; col += 1) {
          matrixHead[col] = c.rand() * rows;
          matrixSpeed[col] = 5 + c.rand() * 8;
          matrixTail[col] = 5 + Math.floor(c.rand() * 8);
        }

        const barCount = clamp(Math.round(cols / 3), 6, 20);
        const barHeight = new Float32Array(barCount);
        const barTarget = new Float32Array(barCount);

        let alive = new Uint8Array(n);
        let nextAlive = new Uint8Array(n);
        const age = new Float32Array(n);
        const reseedLife = () => {
          for (let i = 0; i < n; i += 1) alive[i] = c.rand() < 0.26 ? 1 : 0;
        };
        reseedLife();
        let lifeClock = 0;
        let lifeStale = 0;
        let lifePrevCount = -1;

        type Ripple = { col: number; row: number; t0: number; hue: number };
        const ripples: Ripple[] = [];
        let rippleAutoTimer = 1;

        const textCanvas = document.createElement('canvas');
        const MESSAGE = '  LANGBRIDGE PATHWAYS   •   A1 → A2 → B1 → B2   •   SVEIKI!   •   ПРИВЕТ   •   ВІТАЮ   ';
        textCanvas.height = rows;
        const tctx0 = textCanvas.getContext('2d')!;
        tctx0.font = `700 ${Math.round(rows * 0.86)}px ${FONT_SANS}`;
        const textW = Math.max(cols * 2, Math.ceil(tctx0.measureText(MESSAGE).width) + cols);
        textCanvas.width = textW;
        const tctx = textCanvas.getContext('2d')!;
        tctx.font = `700 ${Math.round(rows * 0.86)}px ${FONT_SANS}`;
        tctx.fillStyle = '#000';
        tctx.fillRect(0, 0, textW, rows);
        tctx.fillStyle = '#fff';
        tctx.textBaseline = 'middle';
        tctx.fillText(MESSAGE, 0, rows / 2 + 1);
        let scrollX = 0;

        function runPlasma(t: number, pointer: PointerCell) {
          const warpOn = pointer.active > 0;
          for (let row = 0; row < rows; row += 1) {
            const ny = row / rows;
            for (let col = 0; col < cols; col += 1) {
              const nx = col / cols;
              let v = Math.sin(nx * 9 + t) + Math.sin(ny * 7 - t * 1.3) + Math.sin((nx + ny) * 8 + t * 0.6);
              const dcx = nx - 0.5;
              const dcy = ny - 0.5;
              v += Math.sin(Math.hypot(dcx, dcy) * 13 - t * 1.7);
              if (warpOn) {
                const ddx = col - pointer.col;
                const ddy = row - pointer.row;
                const d2 = ddx * ddx + ddy * ddy;
                v += pointer.react * 3.2 * Math.exp(-d2 / 40);
              }
              const i = idx(col, row);
              level[i] = clamp(v / 4 + 0.55, 0, 1) ** 1.4;
              hueT[i] = v / 4 + 0.5 + nx * 0.15 + t * 0.03;
            }
          }
        }

        function runMatrix(dt: number, t: number, pointer: PointerCell) {
          level.fill(0);
          for (let col = 0; col < cols; col += 1) {
            let sp = matrixSpeed[col];
            if (pointer.active > 0 && Math.abs(col - pointer.col) < 2) sp += 22 * pointer.react;
            matrixHead[col] += sp * dt;
            if (matrixHead[col] - matrixTail[col] > rows + 2) {
              matrixHead[col] = -c.rand() * 4;
              matrixSpeed[col] = 5 + c.rand() * 8;
              matrixTail[col] = 5 + Math.floor(c.rand() * 8);
            }
            const head = matrixHead[col];
            const tail = matrixTail[col];
            for (let k = 0; k <= tail; k += 1) {
              const row = Math.floor(head) - k;
              if (row < 0 || row >= rows) continue;
              const i = idx(col, row);
              const v = k === 0 ? 1 : (1 - k / tail) * 0.65;
              if (v > level[i]) {
                level[i] = v;
                hueT[i] = k === 0 ? 0.98 : 0.32;
              }
            }
          }
          void t;
        }

        function runEqualizer(dt: number, t: number, pointer: PointerCell) {
          level.fill(0);
          const barW = cols / barCount;
          for (let b = 0; b < barCount; b += 1) {
            if (barTarget[b] <= 0.02 || c.rand() < dt * 0.7) barTarget[b] = 0.15 + c.rand() * 0.85;
            let target = barTarget[b];
            if (pointer.active > 0) {
              // Grid-column space, not screen pixels — the board is tilted, so a column's on-screen X isn't a
              // simple multiple of its index any more.
              const barD = (pointer.col - (b + 0.5) * barW) / (barW * 1.4);
              const near = Math.exp(-(barD * barD)) * pointer.react;
              target = clamp(target + near, 0, 1);
            }
            barHeight[b] += (target - barHeight[b]) * Math.min(1, dt * 9);
            const litRows = barHeight[b] * rows;
            const col0 = Math.round(b * barW);
            const col1 = Math.round((b + 1) * barW);
            for (let row = rows - 1; row >= 0; row -= 1) {
              const fromBottom = rows - 1 - row;
              if (fromBottom > litRows) continue;
              const v = clamp(litRows - fromBottom, 0, 1);
              const hueTv = fromBottom / rows < 0.6 ? 0.32 : fromBottom / rows < 0.82 ? 0.62 : 0.97;
              for (let col = col0; col < col1; col += 1) {
                const i = idx(col, row);
                level[i] = v;
                hueT[i] = hueTv;
              }
            }
          }
          void t;
        }

        function runLife(dt: number, pointer: PointerCell) {
          lifeClock += dt;
          if (pointer.active > 0 && pointer.react > 0) {
            if (pointer.clicked > 0) {
              for (let dy = -1; dy <= 1; dy += 1) {
                for (let dx = -1; dx <= 1; dx += 1) {
                  if (c.rand() < 0.65) {
                    const cc = ((pointer.col + dx) % cols + cols) % cols;
                    const rr = ((pointer.row + dy) % rows + rows) % rows;
                    alive[idx(cc, rr)] = 1;
                  }
                }
              }
            } else if (c.rand() < dt * 6 * pointer.react) {
              alive[idx(pointer.col, pointer.row)] = 1;
            }
          }
          const tickTime = 0.11;
          if (lifeClock >= tickTime) {
            lifeClock -= tickTime;
            let count = 0;
            for (let row = 0; row < rows; row += 1) {
              const rUp = (row - 1 + rows) % rows;
              const rDn = (row + 1) % rows;
              for (let col = 0; col < cols; col += 1) {
                const cL = (col - 1 + cols) % cols;
                const cR = (col + 1) % cols;
                const neighbours =
                  alive[idx(cL, rUp)] + alive[idx(col, rUp)] + alive[idx(cR, rUp)] +
                  alive[idx(cL, row)] + alive[idx(cR, row)] +
                  alive[idx(cL, rDn)] + alive[idx(col, rDn)] + alive[idx(cR, rDn)];
                const i = idx(col, row);
                const wasAlive = alive[i] === 1;
                const willLive = wasAlive ? neighbours === 2 || neighbours === 3 : neighbours === 3;
                nextAlive[i] = willLive ? 1 : 0;
                if (willLive) count += 1;
                if (wasAlive && !willLive) age[i] = 1;
              }
            }
            const tmp = alive;
            alive = nextAlive;
            nextAlive = tmp;
            if (count === lifePrevCount) lifeStale += 1;
            else lifeStale = 0;
            lifePrevCount = count;
            if (count < 4 || lifeStale > 26) {
              reseedLife();
              lifeStale = 0;
              lifePrevCount = -1;
            }
          }
          for (let i = 0; i < n; i += 1) {
            if (alive[i]) {
              level[i] = 1;
              hueT[i] = 0.62;
            } else if (age[i] > 0) {
              age[i] = Math.max(0, age[i] - dt * 1.6);
              level[i] = age[i] * 0.6;
              hueT[i] = 0.05;
            } else level[i] = 0;
          }
        }

        function runRipple(dt: number, t: number, pointer: PointerCell) {
          level.fill(0);
          rippleAutoTimer -= dt;
          if (pointer.active > 0 && pointer.clicked > 0) {
            ripples.push({ col: pointer.col, row: pointer.row, t0: t, hue: c.rand() });
            rippleAutoTimer = 2.4;
          } else if (rippleAutoTimer <= 0) {
            ripples.push({ col: Math.floor(c.rand() * cols), row: Math.floor(c.rand() * rows), t0: t, hue: c.rand() });
            rippleAutoTimer = 1.8 + c.rand() * 1.6;
          }
          const maxR = Math.hypot(cols, rows) * 0.6;
          for (let i = ripples.length - 1; i >= 0; i -= 1) {
            const r = ripples[i];
            const age0 = t - r.t0;
            const radius = age0 * 13;
            if (radius > maxR + 6) {
              ripples.splice(i, 1);
              continue;
            }
            const fade = clamp(1 - radius / maxR, 0, 1);
            const rowLo = Math.max(0, Math.floor(r.row - radius - 1));
            const rowHi = Math.min(rows - 1, Math.ceil(r.row + radius + 1));
            for (let row = rowLo; row <= rowHi; row += 1) {
              const dy = row - r.row;
              const spanX = Math.sqrt(Math.max(0, (radius + 1.5) ** 2 - dy * dy));
              const colLo = Math.max(0, Math.floor(r.col - spanX));
              const colHi = Math.min(cols - 1, Math.ceil(r.col + spanX));
              for (let col = colLo; col <= colHi; col += 1) {
                const d = Math.hypot(col - r.col, dy);
                const ring = Math.exp(-((d - radius) ** 2) / 2.6) * fade;
                const i2 = idx(col, row);
                if (ring > level[i2]) {
                  level[i2] = ring;
                  hueT[i2] = r.hue;
                }
              }
            }
          }
        }

        function runText(dt: number, pointer: PointerCell) {
          level.fill(0);
          let px = 26 * c.params.speed;
          if (pointer.active > 0) px += clamp(pointer.vx * -0.06, -60, 60);
          scrollX += px * dt;
          scrollX = ((scrollX % textW) + textW) % textW;
          const data = tctx.getImageData(0, 0, textW, rows).data;
          const base = Math.floor(scrollX);
          for (let row = 0; row < rows; row += 1) {
            for (let col = 0; col < cols; col += 1) {
              const sx = (base + col) % textW;
              const v = data[(row * textW + sx) * 4] / 255;
              const i = idx(col, row);
              level[i] = v;
              hueT[i] = 0.02;
            }
          }
        }

        return {
          cols, rows, pitch, n, level, hueT, idx, projX, projY, projS, projPitch, rgbGeom, roundR, panels,
          runPlasma, runMatrix, runEqualizer, runLife, runRipple, runText,
        };
      }

      type LedGeometry = ReturnType<typeof buildGeometry>;
      let geo: LedGeometry = buildGeometry(c.params.tilt, c.params.zoom, c.params.ledSize);
      let geomTilt = c.params.tilt;
      let geomZoom = c.params.zoom;
      let geomLedSize = c.params.ledSize;
      let geomCheckClock = 0;

      let modeIndex = 0;
      let modeClock = 0;
      let cut = 0; // a short burst of static right after a mode change, like a channel switching

      return {
        update(dt, t, p) {
          // Rebuild the board (grid size, projection, panels) only when the tilt/zoom/LED-size sliders actually
          // moved, checked a few times a second rather than every frame — dragging a slider fires many updates a
          // second, and there is no need to redraw six offscreen canvases for each of them.
          geomCheckClock += dt;
          if (geomCheckClock > 0.12) {
            geomCheckClock = 0;
            if (
              Math.abs(c.params.tilt - geomTilt) > 0.001 ||
              Math.abs(c.params.zoom - geomZoom) > 0.001 ||
              Math.abs(c.params.ledSize - geomLedSize) > 0.001
            ) {
              geo = buildGeometry(c.params.tilt, c.params.zoom, c.params.ledSize);
              geomTilt = c.params.tilt;
              geomZoom = c.params.zoom;
              geomLedSize = c.params.ledSize;
            }
          }

          const pinned = Math.round(c.params.preset);
          if (pinned > 0) {
            // A specific screensaver, chosen in the panel: hold it, and reset the clock so that switching back
            // to "Авто" starts a fresh full cycle rather than jumping mid-way through one.
            const wanted = (pinned - 1) % LED_MODES.length;
            if (wanted !== modeIndex) {
              modeIndex = wanted;
              cut = 1;
            }
            modeClock = 0;
          } else {
            modeClock += dt;
            if (modeClock >= LED_MODE_SECONDS) {
              modeClock = 0;
              modeIndex = (modeIndex + 1) % LED_MODES.length;
              cut = 1;
            }
          }
          cut = Math.max(0, cut - dt * 6);

          // Which cell the cursor is over: the board is tilted, so this is "the nearest projected cell centre"
          // rather than a flat division by pitch. n is at most a couple of thousand, cheap once a frame.
          let pcol = 0;
          let prow = 0;
          if (p.active) {
            let bestD = Infinity;
            for (let i = 0; i < geo.n; i += 1) {
              const dx = geo.projX[i] - p.x;
              const dy = geo.projY[i] - p.y;
              const d = dx * dx + dy * dy;
              if (d < bestD) {
                bestD = d;
                pcol = i % geo.cols;
                prow = (i / geo.cols) | 0;
              }
            }
          }
          const pointer: PointerCell = { x: p.x, y: p.y, vx: p.vx, active: p.active ? 1 : 0, clicked: p.clicked ? 1 : 0, col: pcol, row: prow, react: c.params.react };

          const mode = LED_MODES[modeIndex];
          if (mode === 'plasma') geo.runPlasma(t, pointer);
          else if (mode === 'matrix') geo.runMatrix(dt, t, pointer);
          else if (mode === 'equalizer') geo.runEqualizer(dt, t, pointer);
          else if (mode === 'life') geo.runLife(dt, pointer);
          else if (mode === 'ripple') geo.runRipple(dt, t, pointer);
          else geo.runText(dt, pointer);

          if (cut > 0.02) {
            for (let i = 0; i < geo.n; i += 1) {
              if (c.rand() < 0.5) {
                geo.level[i] = c.rand() * cut;
                geo.hueT[i] = c.rand();
              }
            }
          }
        },
        draw(g) {
          const style = clamp(Math.round(c.params.style), 0, geo.panels.length - 1);
          g.drawImage(geo.panels[style], 0, 0, W, H);
          g.globalCompositeOperation = 'lighter';
          for (let row = 0; row < geo.rows; row += 1) {
            for (let col = 0; col < geo.cols; col += 1) {
              const i = geo.idx(col, row);
              const v = geo.level[i] * c.params.intensity;
              if (v < 0.03) continue;
              const cx = geo.projX[i];
              const cy = geo.projY[i];
              const p = geo.projPitch[i];
              const a = clamp(v, 0, 1);
              if (style === 6) {
                clearLed.light(g, cx, cy, p * 0.42, geo.hueT[i], a * 1.5);
                continue;
              }
              const col2 = palCycle(c.palette, geo.hueT[i]);

              // Subsurface bleed shared by every style: a lit cell washes a little light onto the board and its
              // neighbours, the way real light scatters under a translucent panel surface.
              glow(g, cx, cy, p * 1.9, col2, a * 0.26);

              if (style === 0) {
                // A lit lamp: a hot core, the dome's colour around it, a small fixed specular highlight, and a
                // soft bloom once it is bright — the diffuse glow a real LED throws on its own lens.
                const r = p * 0.42 * Math.min(1, 0.5 + v * 0.6);
                g.fillStyle = rgba(col2, a);
                g.beginPath();
                g.arc(cx, cy, r, 0, TAU);
                g.fill();
                g.fillStyle = rgba(mixHex(col2, '#ffffff', 0.55), a * 0.9);
                g.beginPath();
                g.arc(cx, cy, r * 0.5, 0, TAU);
                g.fill();
                g.fillStyle = rgba('#ffffff', a * 0.5);
                g.beginPath();
                g.arc(cx - r * 0.32, cy - r * 0.32, r * 0.16, 0, TAU);
                g.fill();
                if (v > 0.55) glow(g, cx, cy, p * 1.05, col2, (v - 0.55) * 0.75);
              } else if (style === 1) {
                // A video-wall pixel: flat, crisp, barely any bloom — the diode sits behind a hard plastic face.
                const sPix = p * 0.94 * Math.min(1, 0.55 + v * 0.5);
                g.fillStyle = rgba(col2, a);
                g.beginPath();
                if (g.roundRect) g.roundRect(cx - sPix / 2, cy - sPix / 2, sPix, sPix, p * 0.08);
                else g.rect(cx - sPix / 2, cy - sPix / 2, sPix, sPix);
                g.fill();
                g.strokeStyle = rgba(mixHex(col2, '#ffffff', 0.4), a * 0.7);
                g.lineWidth = 1;
                g.stroke();
                if (v > 0.8) glow(g, cx, cy, p * 0.7, col2, (v - 0.8) * 0.6);
              } else if (style === 2) {
                // RGB SMD, clean: three real sub-diodes, each lit to its own share of the target colour — a
                // macro-photo look, not a single blended dot.
                const { subW, subH } = geo.rgbGeom(i);
                const [r255, g255, b255] = rgb(col2);
                const chans: [number, number][] = [[-1, r255], [0, g255], [1, b255]];
                for (const [off, chan] of chans) {
                  const chAlpha = a * (chan / 255);
                  if (chAlpha < 0.04) continue;
                  const tint: [string, string] = off < 0 ? [col2, '#ff2a2a'] : off > 0 ? [col2, '#2a5aff'] : [col2, '#2aff5a'];
                  g.fillStyle = rgba(mixHex(tint[0], tint[1], 0.35), chAlpha);
                  g.fillRect(cx + off * subW * 1.05 - subW / 2, cy - subH / 2, subW, subH);
                }
                if (v > 0.7) glow(g, cx, cy, p * 0.55, col2, (v - 0.7) * 0.4);
              } else if (style === 3) {
                // RGB SMD with micro-crystals: each of the 3 chips gets its own hot core plus a soft halo around
                // it — three little suns instead of one flat rectangle.
                const { subW, subH } = geo.rgbGeom(i);
                const [r255, g255, b255] = rgb(col2);
                const chans: [number, number][] = [[-1, r255], [0, g255], [1, b255]];
                for (const [off, chan] of chans) {
                  const chAlpha = a * (chan / 255);
                  if (chAlpha < 0.04) continue;
                  const pure = off < 0 ? '#ff2a2a' : off > 0 ? '#2a5aff' : '#2aff5a';
                  const tint = mixHex(col2, pure, 0.35);
                  const ccx = cx + off * subW * 1.05;
                  glow(g, ccx, cy, subW * 2.2, tint, chAlpha * 0.5);
                  g.fillStyle = rgba(mixHex(tint, '#ffffff', 0.3), chAlpha * 0.85);
                  g.beginPath();
                  g.ellipse(ccx, cy, subW * 0.42, subH * 0.42, 0, 0, TAU);
                  g.fill();
                  g.fillStyle = rgba('#ffffff', chAlpha * 0.6);
                  g.beginPath();
                  g.arc(ccx - subW * 0.12, cy - subH * 0.16, subW * 0.14, 0, TAU);
                  g.fill();
                }
                if (v > 0.6) glow(g, cx, cy, p * 0.85, col2, (v - 0.6) * 0.55);
              } else if (style === 4 || style === 5) {
                // Styles 4/5: a lit dome — three dim crystal cores blended under one soft frosted bloom, the
                // characteristic subsurface-scattering look of light diffusing through a real silicone lens.
                const { subW, subH, domeR } = geo.rgbGeom(i);
                const [r255, g255, b255] = rgb(col2);
                const chans: [number, number][] = [[-1, r255], [0, g255], [1, b255]];
                const domeGrad = g.createRadialGradient(cx, cy, 0, cx, cy, domeR);
                domeGrad.addColorStop(0, rgba(mixHex(col2, '#ffffff', 0.5), a * 0.85));
                domeGrad.addColorStop(0.55, rgba(col2, a * 0.5));
                domeGrad.addColorStop(1, rgba(col2, 0));
                g.fillStyle = domeGrad;
                g.beginPath();
                g.ellipse(cx, cy, domeR, domeR * 0.82, 0, 0, TAU);
                g.fill();
                for (const [off, chan] of chans) {
                  const chAlpha = a * (chan / 255);
                  if (chAlpha < 0.05) continue;
                  g.fillStyle = rgba(col2, chAlpha * 0.35);
                  g.beginPath();
                  g.ellipse(cx + off * subW * 1.05, cy, subW * 0.32, subH * 0.32, 0, 0, TAU);
                  g.fill();
                }
                if (style === 5) {
                  // Worn/scuffed close-up: tiny catch-lights sit exactly on the baked-in scuff specks (hash2),
                  // so a lit chip visibly picks out the same wear marks as its static, unlit neighbours.
                  for (let k = 0; k < 2; k += 1) {
                    const sx = cx + (hash2(col, row, k + 20) - 0.5) * domeR;
                    const sy = cy + (hash2(col, row, k + 30) - 0.5) * domeR * 0.8;
                    g.fillStyle = rgba('#ffffff', a * 0.5);
                    g.beginPath();
                    g.arc(sx, sy, 0.6 + hash2(col, row, k + 40) * 0.5, 0, TAU);
                    g.fill();
                  }
                }
                if (v > 0.5) glow(g, cx, cy, p * 1.1, col2, (v - 0.5) * 0.6);
              } else if (style === 7) {
                // Frosted: one soft, evenly diffused bloom filling the dome — no hot core and no sharp glint, the
                // classic subsurface-scattering look of light spreading through a sandblasted resin lens.
                const r = geo.roundR(i);
                const domeGrad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
                domeGrad.addColorStop(0, rgba(mixHex(col2, '#ffffff', 0.45), a * 0.85));
                domeGrad.addColorStop(0.6, rgba(col2, a * 0.55));
                domeGrad.addColorStop(1, rgba(col2, 0));
                g.fillStyle = domeGrad;
                g.beginPath();
                g.arc(cx, cy, r, 0, TAU);
                g.fill();
                if (v > 0.45) glow(g, cx, cy, r * 1.8, col2, (v - 0.45) * 0.6);
              } else {
                // Side-mounted: light spills out one edge, not radially — a bright core along the lens strip plus
                // a widening fan of glow below it, the way a real edge-lit SMD LED throws its light sideways.
                const bw = p * 0.86;
                const bh = p * 0.56;
                g.fillStyle = rgba(mixHex(col2, '#ffffff', 0.5), a * 0.95);
                g.fillRect(cx - bw * 0.36, cy + bh * 0.16, bw * 0.72, bh * 0.26);
                const fan = g.createRadialGradient(cx, cy + bh * 0.3, 0, cx, cy + bh * 0.3, bw * 0.9);
                fan.addColorStop(0, rgba(col2, a * 0.7));
                fan.addColorStop(1, rgba(col2, 0));
                g.fillStyle = fan;
                g.beginPath();
                g.ellipse(cx, cy + bh * 0.9, bw * 0.9, bh * 1.6, 0, 0, TAU);
                g.fill();
                if (v > 0.55) glow(g, cx, cy + bh * 0.4, p * 1.3, col2, (v - 0.55) * 0.6);
              }
            }
          }
          g.globalCompositeOperation = 'source-over';
        },
      };
    },
  },
];
