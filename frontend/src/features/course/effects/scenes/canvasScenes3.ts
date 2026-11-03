import type { CanvasSceneDef } from './types';
import { clamp, fillGradient, glow, mixHex, rgba } from './kit';

const RAIN_CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789āčēģīķļņšūžLV';

export const CANVAS_SCENES_3: CanvasSceneDef[] = [
  {
    kind: 'canvas',
    id: 'digital-rain',
    label: 'Код-дождь',
    palettes: [['#020a06', '#3aff7a', '#d8ffe6', '#0a5a2a'], ['#020818', '#3ab8ff', '#e0f4ff', '#0a2a5a']],
    create(c) {
      const fs = c.body ? 18 : 15;
      const cols = Math.ceil(c.width / fs);
      const rows = Math.ceil(c.height / fs);
      const heads = Array.from({ length: cols }, () => c.rand() * (rows + 20) - 20);
      const speeds = Array.from({ length: cols }, () => 6 + c.rand() * 14);
      const tails = Array.from({ length: cols }, () => 8 + Math.floor(c.rand() * 16));
      let clock = 0;
      let mx = -999;
      let my = -999;
      return {
        update(dt, t, p) {
          clock = t;
          mx = p.active ? p.x : -999;
          my = p.active ? p.y : -999;
          for (let i = 0; i < cols; i += 1) {
            heads[i] += speeds[i] * dt * c.params.speed;
            if (heads[i] - tails[i] > rows) {
              heads[i] = -c.rand() * 12;
              speeds[i] = 6 + c.rand() * 14;
              tails[i] = 8 + Math.floor(c.rand() * 16);
            }
          }
        },
        draw(g) {
          g.fillStyle = c.palette[0];
          g.fillRect(0, 0, c.width, c.height);
          g.font = `${fs}px "Courier New", monospace`;
          g.textAlign = 'center';
          g.textBaseline = 'top';
          const base = c.body ? 0.5 : 0.9;
          for (let i = 0; i < cols; i += 1) {
            const x = i * fs + fs / 2;
            for (let k = 0; k < tails[i]; k += 1) {
              const row = Math.floor(heads[i]) - k;
              if (row < 0 || row >= rows) continue;
              const y = row * fs;
              const seed = i * 7919 + row * 104729 + Math.floor(clock * (k === 0 ? 8 : 1.5) + i);
              const ch = RAIN_CHARS[seed % RAIN_CHARS.length];
              const a = (1 - k / tails[i]) * base * c.params.intensity;
              const near = 1 - clamp(Math.hypot(x - mx, y - my) / 110, 0, 1);
              if (k === 0) g.fillStyle = rgba(c.palette[2], clamp(a + 0.2, 0, 1));
              else if (near > 0.05) g.fillStyle = rgba(c.palette[2], clamp(a + near * c.params.react, 0, 1));
              else g.fillStyle = rgba(c.palette[k < 3 ? 1 : 3], a);
              g.fillText(ch, x, y);
            }
          }
          g.globalCompositeOperation = 'lighter';
          if (mx > -900) glow(g, mx, my, 90, c.palette[1], 0.16);
          g.globalCompositeOperation = 'source-over';
        },
      };
    },
  },
];

/** The first, flat hourglass: now only the fallback of the ray-traced one (hourglass3d.ts) when WebGL2 is missing. */
export const HOURGLASS_2D: CanvasSceneDef = {
  kind: 'canvas',
  id: 'hourglass',
  label: 'Песочные часы',
  palettes: [['#1a1208', '#e0b45a', '#ffe2a3', '#8a5a22'], ['#0a1420', '#7ab8ff', '#d8f0ff', '#2a4a72']],
  create(c) {
    const W = c.width;
    const H = c.height;
    const size = clamp(H * 0.82, 100, 330);
    const cx = W * (c.body ? 0.5 : 0.72);
    const cy = H * 0.52;
    let level = 1;
    let flip = 0;
    let flipping = false;
    let tilt = 0;
    const grains: Array<{ y: number; x: number; v: number }> = [];
    return {
      update(dt, t, p) {
        const target = p.active ? clamp((p.x / W - 0.5) * 0.5, -0.25, 0.25) * c.params.react : Math.sin(t * 0.3) * 0.04;
        tilt += (target - tilt) * Math.min(1, dt * 3);
        if (flipping) {
          flip += dt * 1.6;
          if (flip >= 1) {
            flipping = false;
            flip = 0;
            level = 1;
          }
        } else {
          level -= dt * 0.045 * c.params.speed;
          if (level <= 0) flipping = true;
        }
        if (!flipping && level > 0.02 && c.rand() < dt * 50) grains.push({ y: 0, x: (c.rand() - 0.5) * 2, v: 60 + c.rand() * 40 });
        for (let i = grains.length - 1; i >= 0; i -= 1) {
          grains[i].y += grains[i].v * dt * (size / 200);
          grains[i].v += 400 * dt;
          if (grains[i].y > size * 0.42 * (1 - Math.max(0, 1 - level) * 0.85)) grains.splice(i, 1);
        }
      },
      draw(g) {
        fillGradient(g, W, H, c.palette[0], mixHex(c.palette[0], '#000000', 0.5));
        g.globalCompositeOperation = 'lighter';
        glow(g, cx, cy, size * 1.2, c.palette[1], 0.16 * c.params.intensity);
        g.globalCompositeOperation = 'source-over';
        g.save();
        g.translate(cx, cy);
        g.rotate(tilt + flip * Math.PI);
        const hw = size * 0.3;
        const hh = size * 0.46;
        const neck = size * 0.025;
        const glass = new Path2D();
        glass.moveTo(-hw, -hh);
        glass.lineTo(hw, -hh);
        glass.bezierCurveTo(hw, -hh * 0.4, neck, -hh * 0.25, neck, 0);
        glass.bezierCurveTo(neck, hh * 0.25, hw, hh * 0.4, hw, hh);
        glass.lineTo(-hw, hh);
        glass.bezierCurveTo(-hw, hh * 0.4, -neck, hh * 0.25, -neck, 0);
        glass.bezierCurveTo(-neck, -hh * 0.25, -hw, -hh * 0.4, -hw, -hh);
        glass.closePath();
        g.fillStyle = rgba('#ffffff', 0.06);
        g.fill(glass);
        g.save();
        g.clip(glass);
        const topFill = level;
        const botFill = 1 - level;
        g.fillStyle = c.palette[1];
        g.fillRect(-hw, -hh + (1 - topFill) * hh * 0.98, hw * 2, hh * topFill);
        const pile = hh * (0.05 + 0.95 * botFill);
        g.fillStyle = mixHex(c.palette[1], c.palette[3], 0.25);
        g.fillRect(-hw, hh - pile, hw * 2, pile);
        g.beginPath();
        g.moveTo(-hw * 0.6, hh - pile);
        g.lineTo(0, hh - pile - hh * 0.18 * Math.min(1, botFill * 3));
        g.lineTo(hw * 0.6, hh - pile);
        g.fill();
        g.fillStyle = c.palette[2];
        for (const gr of grains) g.fillRect(gr.x * neck * 0.6 - 1, gr.y, 2, 2);
        if (!flipping && level > 0.02) g.fillRect(-1, 0, 2, hh * 0.6 * (1 - Math.max(0, 1 - level) * 0.5));
        g.restore();
        g.strokeStyle = rgba(c.palette[2], 0.85);
        g.lineWidth = 3;
        g.stroke(glass);
        g.strokeStyle = rgba('#ffffff', 0.4);
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(-hw * 0.7, -hh * 0.85);
        g.lineTo(-hw * 0.7, -hh * 0.35);
        g.stroke();
        g.fillStyle = c.palette[3];
        g.fillRect(-hw * 1.2, -hh - 12, hw * 2.4, 12);
        g.fillRect(-hw * 1.2, hh, hw * 2.4, 12);
        g.restore();
      },
    };
  },
};
