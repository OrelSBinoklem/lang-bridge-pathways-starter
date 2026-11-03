import type { CanvasSceneDef } from './types';
import { clamp } from './kit';
import { createOrbit } from './orbitControl';
import { ATLAS_H, ATLAS_W, DIGIT_POINTS, GLYPH_BOX, GLYPH_DMAX, createNixieRenderer, type NixieRenderer } from './nixieClockGL';

/**
 * "The age of technology and information": a nixie tube clock on a varnished wooden base, showing the real time —
 * hours, minutes and seconds in six glass tubes. Each tube holds ten wire digits stacked one behind another inside a
 * copper mesh; the lit one glows neon orange, the others catch its light. The tubes' glow is path traced into light
 * maps on the table, the wall and the base (nixieClockGL.ts) — baked per tube and re-weighted as digits change, or,
 * with live tracing on, traced every frame from the shapes of the digits that are lit — so the scene can be turned
 * any way: drag it to orbit the clock (it keeps turning a little when let go). Digits change with the short afterglow
 * of real nixies; every minute, and on a click, the tubes run through all their digits (the "slot machine" real nixie
 * clocks do against cathode poisoning). In a card the clock stands to the right of the title; over the whole page it
 * sits in the middle of the table. The debug panel has the camera, the tracing and the materials.
 */

const arc = (cx: number, cy: number, rx: number, ry: number, from: number, to: number, n: number): [number, number][] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / n;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
  });
const PI = Math.PI;
/** The digits' wires, IN-14 style, as polylines in a box 0.62 wide and 1 tall (y up). */
const DIGITS: [number, number][][][] = [
  [arc(0.31, 0.5, 0.3, 0.5, 0, 2 * PI, 36)],
  [[[0.31, 0], [0.31, 1]]],
  [[...arc(0.31, 0.73, 0.28, 0.27, PI * 0.95, -PI * 0.22, 18), [0.02, 0], [0.62, 0]]],
  [[[0.05, 1], [0.6, 1], [0.21, 0.58], ...arc(0.31, 0.3, 0.3, 0.3, PI * 0.62, -PI * 0.85, 20)]],
  [[[0.46, 0], [0.46, 1], [0, 0.3], [0.62, 0.3]]],
  [[[0.6, 1], [0.08, 1], [0.05, 0.56], ...arc(0.31, 0.31, 0.3, 0.31, PI * 0.8, -PI * 0.85, 20)]],
  [arc(0.31, 0.3, 0.3, 0.3, 0, 2 * PI, 28), arc(0.72, 0.36, 0.7, 0.64, PI, PI * 0.55, 14)],
  [[[0, 1], [0.62, 1], [0.16, 0]]],
  [arc(0.31, 0.76, 0.25, 0.24, 0, 2 * PI, 28), arc(0.31, 0.27, 0.3, 0.27, 0, 2 * PI, 28)],
  [arc(0.31, 0.7, 0.3, 0.3, 0, 2 * PI, 28), arc(-0.1, 0.64, 0.7, 0.64, 0, -PI * 0.45, 14)],
];
const segmentsOf = (d: [number, number][][]) => d.flatMap((l) => l.slice(1).map((p, i) => [l[i][0], l[i][1], p[0], p[1]]));
const LENGTHS = DIGITS.map((d) => segmentsOf(d).reduce((a, [x0, y0, x1, y1]) => a + Math.hypot(x1 - x0, y1 - y0), 0));
/** How much a digit lights the room: by the length of its glowing wire. */
const BRIGHTNESS = LENGTHS.map((l) => 0.55 + 0.45 * (l / Math.max(...LENGTHS)));

/** Distance fields of the ten digits, one layer each, rows from the top of the glyph box. */
function buildAtlas() {
  const data = new Uint8Array(ATLAS_W * ATLAS_H * 10);
  const [bx, by, bw, bh] = GLYPH_BOX;
  DIGITS.forEach((lines, digit) => {
    const segs = segmentsOf(lines);
    for (let j = 0; j < ATLAS_H; j += 1) {
      const y = by + bh - ((j + 0.5) / ATLAS_H) * bh;
      for (let i = 0; i < ATLAS_W; i += 1) {
        const x = bx + ((i + 0.5) / ATLAS_W) * bw;
        let d = Infinity;
        for (const [ax, ay, cx, cy] of segs) {
          const dx = cx - ax;
          const dy = cy - ay;
          const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
          d = Math.min(d, Math.hypot(x - ax - dx * t, y - ay - dy * t));
        }
        data[digit * ATLAS_W * ATLAS_H + j * ATLAS_W + i] = Math.round(clamp(d / GLYPH_DMAX, 0, 1) * 255);
      }
    }
  });
  return data;
}

/** Points spread evenly along each digit's wire — where the live light is emitted from. */
function buildPoints() {
  const out = new Float32Array(DIGIT_POINTS * 10 * 2);
  DIGITS.forEach((lines, digit) => {
    const segs = segmentsOf(lines);
    const total = LENGTHS[digit];
    for (let k = 0; k < DIGIT_POINTS; k += 1) {
      let s = ((k + 0.5) / DIGIT_POINTS) * total;
      for (let q = 0; q < segs.length; q += 1) {
        const [x0, y0, x1, y1] = segs[q];
        const l = Math.hypot(x1 - x0, y1 - y0);
        if (s <= l || q === segs.length - 1) {
          const t = l > 0 ? Math.min(1, s / l) : 0;
          out[(digit * DIGIT_POINTS + k) * 2] = x0 + (x1 - x0) * t;
          out[(digit * DIGIT_POINTS + k) * 2 + 1] = y0 + (y1 - y0) * t;
          break;
        }
        s -= l;
      }
    }
  });
  return out;
}

type Tube = { shown: number; prev: number; since: number };

export const NIXIE_CLOCK: CanvasSceneDef = {
  kind: 'canvas',
  id: 'nixie-clock',
  label: 'Часы на газоразрядных лампах',
  palettes: [['#0a0706', '#ff7a2a', '#ffb070', '#6a3a1a']],
  create(c) {
    const W = c.width;
    const H = c.height;
    const P = c.params;
    // Over the whole page the picture is drawn at no more than ~1.4 million pixels (the browser scales it up).
    const S = c.body ? Math.min(1, Math.sqrt(1.4e6 / Math.max(1, W * H))) : Math.min(c.dpr, 2);
    const aw = Math.max(2, Math.round(W * S));
    const ah = Math.max(2, Math.round(H * S));

    // Six tubes in pairs: hours, minutes, seconds.
    const pitch = 2.9;
    const gap = 0.55;
    const raw = [0, pitch, pitch * 2 + gap, pitch * 3 + gap, pitch * 4 + gap * 2, pitch * 5 + gap * 2];
    const mid = (raw[0] + raw[5]) / 2;
    const tubeX = raw.map((x) => x - mid);
    const half = tubeX[5] + 2.2;
    const baseBox: [number, number, number, number] = [-half, half, -2.4, 2.4];

    // The default framing: in a card the clock stands right of the title (a lens shift keeps it there while the
    // camera orbits the clock itself); over the page it is in the middle.
    const aspect = W / H;
    const vfov = c.body ? 30 : 25;
    const tanH = Math.tan((vfov * PI) / 360);
    const wide = aspect > 3;
    const share = c.body ? (aspect > 1.2 ? 0.3 : 0.44) : wide ? 0.21 : 0.3;
    const centreAt = c.body ? 0.5 : wide ? 0.7 : 0.62;
    const dist0 = half / (2 * share) / (tanH * aspect);
    const target = [0, c.body ? 5.2 : 4.6, 0];
    const shiftX = (centreAt - 0.5) * 2;

    let renderer: NixieRenderer | null = createNixieRenderer({ width: aw, height: ah, tubeX, baseBox, atlas: buildAtlas(), points: buildPoints() });

    const tubes: Tube[] = Array.from({ length: 6 }, () => ({ shown: 0, prev: 0, since: 10 }));
    let clock = 0;
    let rollFrom = -10;
    let rolledMinute = -1;
    let statsAt = 0;
    const drag = { on: false, x: 0, y: 0, moved: 0, vel: 0 };
    let spin = 0;
    const timeDigits = () => {
      const d = new Date();
      const h = d.getHours();
      const m = d.getMinutes();
      const s = d.getSeconds();
      return { digits: [Math.floor(h / 10), h % 10, Math.floor(m / 10), m % 10, Math.floor(s / 10), s % 10], minute: m, second: s };
    };
    {
      const t = timeDigits();
      tubes.forEach((tb, i) => {
        tb.shown = t.digits[i];
        tb.prev = t.digits[i];
      });
      rolledMinute = t.minute;
    }
    const wrap = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;
    // It turns by dragging already; the camera control adds the wheel.
    const orbit = createOrbit(c, { ownDrag: true, onWheel: (f) => { P.nixieZoom = clamp(Number(P.nixieZoom) * f, 0.3, 4); } });

    return {
      update(dt, _t, pIn) {
        const p = orbit.update(pIn);
        const sdt = Math.min(dt, 0.1);
        clock += sdt;
        const now = timeDigits();
        // Drag to orbit the clock; a press that does not move is a click — the slot machine.
        if (p.active && p.pressed && c.params.react > 0) {
          if (!drag.on) Object.assign(drag, { on: true, x: p.rawX, y: p.rawY, moved: 0, vel: 0 });
          else {
            const dx = p.rawX - drag.x;
            const dy = p.rawY - drag.y;
            drag.x = p.rawX;
            drag.y = p.rawY;
            drag.moved += Math.abs(dx) + Math.abs(dy);
            if (drag.moved > 4) {
              P.nixieYaw = wrap(Number(P.nixieYaw) - dx * 0.4);
              P.nixiePitch = clamp(Number(P.nixiePitch) + dy * 0.3, 2, 80);
              drag.vel += (-dx * 0.4 / Math.max(sdt, 1e-3) - drag.vel) * 0.5;
            }
          }
        } else if (drag.on) {
          drag.on = false;
          if (drag.moved <= 4) rollFrom = clock;
          else spin = clamp(drag.vel, -400, 400);
        }
        if (!drag.on) {
          if (Math.abs(spin) > 0.5) {
            P.nixieYaw = wrap(Number(P.nixieYaw) + spin * sdt);
            spin *= Math.exp(-sdt * 2.5);
          } else if (P.nixieAutoRotate) P.nixieYaw = wrap(Number(P.nixieYaw) + 9 * sdt);
        }
        if (now.second === 0 && now.minute !== rolledMinute) {
          rollFrom = clock;
          rolledMinute = now.minute;
        }
        tubes.forEach((tb, i) => {
          // The slot machine: each tube spins through its digits, stopping one after another from the left.
          const rolling = clock - rollFrom < 1.1 + i * 0.12;
          const want = rolling ? (Math.floor((clock - rollFrom) * 17) + i * 3 + now.digits[i]) % 10 : now.digits[i];
          if (want !== tb.shown) {
            tb.prev = tb.shown;
            tb.shown = want;
            tb.since = 0;
          } else tb.since += sdt;
        });
      },
      draw(g) {
        if (!renderer) {
          // No WebGL2: the time in warm glowing figures.
          g.fillStyle = '#0a0706';
          g.fillRect(0, 0, W, H);
          const t = timeDigits();
          g.font = `600 ${Math.round(H * 0.45)}px "Segoe UI", system-ui, sans-serif`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.shadowColor = '#ff7a2a';
          g.shadowBlur = 18;
          g.fillStyle = '#ffb070';
          g.fillText(`${t.digits[0]}${t.digits[1]} ${t.digits[2]}${t.digits[3]} ${t.digits[4]}${t.digits[5]}`, c.body ? W / 2 : W * 0.68, H / 2);
          g.shadowBlur = 0;
          return;
        }
        const on = tubes.map((tb) => clamp(tb.since / 0.04, 0, 1));
        const prevOn = tubes.map((tb) => clamp(1 - tb.since / 0.12, 0, 1));
        const power = clamp(Number(P.nixieGlow), 0, 5);
        const flicker = tubes.map((_, i) => 1 + 0.025 * Math.sin(clock * 47 + i * 1.7) + 0.015 * Math.sin(clock * 131 + i * 5.1));
        const yaw = (Number(P.nixieYaw) * PI) / 180;
        const pitchA = (clamp(Number(P.nixiePitch), 2, 80) * PI) / 180;
        const dist = dist0 / clamp(Number(P.nixieZoom), 0.3, 4);
        const pos = [
          target[0] + dist * Math.sin(yaw) * Math.cos(pitchA),
          target[1] + dist * Math.sin(pitchA),
          target[2] + dist * Math.cos(yaw) * Math.cos(pitchA),
        ];
        renderer.render({
          camera: { pos, target, vfov, shiftX },
          digit: tubes.map((tb) => tb.shown),
          prev: tubes.map((tb) => tb.prev),
          on,
          prevOn,
          glow: tubes.map((tb, i) => BRIGHTNESS[tb.shown] * on[i] * flicker[i] * power),
          glowPrev: tubes.map((tb, i) => BRIGHTNESS[tb.prev] * prevOn[i] * 0.6 * flicker[i] * power),
          room: clamp(Number(P.nixieRoom), 0, 5),
          gloss: clamp(Number(P.nixieGloss), 0, 5),
          rough: clamp(Number(P.nixieRough), 0, 1),
          glass: clamp(Number(P.nixieGlass), 0, 5),
          bloom: clamp(Number(P.nixieBloom), 0, 5),
          exposure: clamp(c.params.intensity, 0.2, 3),
          lightOnly: Number(P.nixieView) === 1,
          denoise: P.nixieDenoise !== false,
          live: !!P.nixieLive,
          mapSize: Number(P.nixieLightmap),
          bounces: clamp(Math.round(Number(P.nixieBounces)), 0, 2),
          spp: clamp(Math.round(Number(P.nixieSpp)), 1, 4096),
          restart: Number(P.nixieRestart),
        });
        g.drawImage(renderer.canvas, 0, 0, W, H);
        orbit.draw(g);
        if (clock - statsAt > 0.25) {
          statsAt = clock;
          P.nixieStats = renderer.stats();
        }
      },
      dispose() {
        orbit.dispose();
        renderer?.dispose();
        renderer = null;
      },
    };
  },
};
