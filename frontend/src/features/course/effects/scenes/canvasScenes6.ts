import type { CanvasSceneDef } from './types';
import { FONT_SANS, TAU, clamp, fillGradient, glow, mixHex, rgba } from './kit';

function rounded(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, radius);
  else g.rect(x, y, w, h);
}

/** Extra scenes deliberately made for groups which previously only had a shared particle treatment.
 * They keep their own modest object budgets so a whole page of previews remains inexpensive. */
export const CANVAS_SCENES_6: CanvasSceneDef[] = [
  {
    kind: 'canvas',
    id: 'home-windows',
    label: 'Окна дома',
    palettes: [
      ['#111a32', '#749bff', '#ffc46b', '#fff0bc'],
      ['#1e172d', '#c48dff', '#ff9d73', '#ffe3a5'],
    ],
    create(c) {
      const W = c.width;
      const H = c.height;
      const cols = clamp(Math.round(W / 48), 8, 24);
      const rows = clamp(Math.round(H / 35), 3, 7);
      const heat = new Float32Array(cols * rows);
      const desired = new Float32Array(cols * rows);
      for (let i = 0; i < heat.length; i += 1) desired[i] = c.rand() > 0.6 ? 1 : 0;
      let clock = 0;
      return {
        update(dt, t, p) {
          clock = t;
          if (p.clicked && c.params.react > 0) {
            const col = clamp(Math.floor(p.x / (W / cols)), 0, cols - 1);
            const row = clamp(Math.floor((p.y - H * 0.17) / (H * 0.72 / rows)), 0, rows - 1);
            desired[row * cols + col] = desired[row * cols + col] > 0.5 ? 0 : 1;
          }
          for (let i = 0; i < heat.length; i += 1) {
            if (Math.sin(t * 0.29 + i * 17.2) > 0.998) desired[i] = desired[i] > 0.5 ? 0 : 1;
            heat[i] += (desired[i] - heat[i]) * Math.min(1, dt * 3.3);
          }
        },
        draw(g) {
          fillGradient(g, W, H, c.palette[0], mixHex(c.palette[0], '#05070e', 0.6));
          const bx = W * 0.08; const by = H * 0.15; const bw = W * 0.84; const bh = H * 0.78;
          g.fillStyle = '#202944'; rounded(g, bx, by, bw, bh, 5); g.fill();
          g.fillStyle = rgba('#ffffff', 0.055); g.fillRect(bx, by, bw, 4);
          const cw = bw / cols; const ch = bh / rows;
          for (let row = 0; row < rows; row += 1) {
            for (let col = 0; col < cols; col += 1) {
              const i = row * cols + col; const x = bx + col * cw + cw * 0.18; const y = by + row * ch + ch * 0.2; const ww = cw * 0.64; const hh = ch * 0.56;
              g.fillStyle = '#0b1020'; g.fillRect(x, y, ww, hh);
              if (heat[i] > 0.02) {
                g.globalCompositeOperation = 'lighter'; glow(g, x + ww / 2, y + hh / 2, Math.max(10, cw * 0.86), c.palette[2], heat[i] * 0.36); g.globalCompositeOperation = 'source-over';
                g.fillStyle = rgba(c.palette[3], heat[i] * 0.9); g.fillRect(x + 1, y + 1, ww - 2, hh - 2);
              }
              g.strokeStyle = rgba('#ffffff', 0.12); g.lineWidth = 1; g.beginPath(); g.moveTo(x + ww / 2, y); g.lineTo(x + ww / 2, y + hh); g.moveTo(x, y + hh / 2); g.lineTo(x + ww, y + hh / 2); g.stroke();
            }
          }
          const moonX = W * (0.75 + Math.sin(clock * 0.1) * 0.04); const moonY = H * 0.18;
          g.globalCompositeOperation = 'lighter'; glow(g, moonX, moonY, 28, c.palette[1], 0.28); g.globalCompositeOperation = 'source-over';
          g.fillStyle = rgba('#ffffff', 0.85); g.beginPath(); g.arc(moonX, moonY, 9, 0, TAU); g.fill();
        },
      };
    },
  },
  {
    kind: 'canvas',
    id: 'focus-clock',
    label: 'Фокус-таймер',
    palettes: [
      ['#17202c', '#6ec7ff', '#ffd36a', '#ff9bb9'],
      ['#242034', '#b69cff', '#85efd0', '#ffe493'],
    ],
    create(c) {
      const W = c.width;
      const H = c.height;
      const tasks = Array.from({ length: 4 }, (_, i) => ({ y: H * (0.18 + i * 0.19), done: c.rand() > 0.65, phase: c.rand() * TAU }));
      const ripples: Array<{ life: number }> = [];
      let clock = 0;
      return {
        update(dt, t, p) {
          clock = t;
          if (p.clicked && c.params.react > 0) {
            const hit = clamp(Math.floor((p.y / H - 0.12) / 0.19), 0, tasks.length - 1);
            tasks[hit].done = !tasks[hit].done; ripples.push({ life: 1 });
          }
          for (let i = ripples.length - 1; i >= 0; i -= 1) { ripples[i].life -= dt; if (ripples[i].life <= 0) ripples.splice(i, 1); }
        },
        draw(g) {
          fillGradient(g, W, H, c.palette[0], mixHex(c.palette[0], '#080b12', 0.55));
          const cx = W * 0.79; const cy = H * 0.52; const r = clamp(H * 0.35, 34, 74);
          g.strokeStyle = rgba('#ffffff', 0.12); g.lineWidth = r * 0.13; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke();
          const amount = (clock * 0.075 * c.params.speed) % 1;
          g.strokeStyle = c.palette[2]; g.lineCap = 'round'; g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * amount); g.stroke(); g.lineCap = 'butt';
          for (const ripple of ripples) { g.strokeStyle = rgba(c.palette[1], ripple.life * 0.4); g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, r + (1 - ripple.life) * 40, 0, TAU); g.stroke(); }
          g.strokeStyle = rgba('#ffffff', 0.8); g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(clock * 0.3) * r * 0.54, cy + Math.sin(clock * 0.3) * r * 0.54); g.stroke();
          g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(-clock * 1.3) * r * 0.32, cy + Math.sin(-clock * 1.3) * r * 0.32); g.stroke();
          const cardX = W * 0.06; const cardW = W * 0.55;
          for (let i = 0; i < tasks.length; i += 1) {
            const task = tasks[i]; const y = task.y;
            g.fillStyle = rgba('#ffffff', 0.075); rounded(g, cardX, y - 13, cardW, 28, 7); g.fill();
            g.strokeStyle = task.done ? c.palette[1] : rgba('#ffffff', 0.34); g.lineWidth = 1.7; g.beginPath(); g.arc(cardX + 15, y + 1, 7, 0, TAU); g.stroke();
            if (task.done) { g.strokeStyle = c.palette[1]; g.beginPath(); g.moveTo(cardX + 11, y + 1); g.lineTo(cardX + 14, y + 4); g.lineTo(cardX + 20, y - 5); g.stroke(); }
            g.strokeStyle = rgba(c.palette[i % 2 ? 3 : 2], 0.65); g.lineWidth = 2;
            g.beginPath(); g.moveTo(cardX + 31, y - 3); g.lineTo(cardX + cardW * (0.52 + 0.28 * Math.sin(task.phase)), y - 3); g.stroke();
          }
        },
      };
    },
  },
  {
    kind: 'canvas',
    id: 'service-route',
    label: 'Маршрут услуг',
    palettes: [
      ['#10252a', '#69d6c0', '#ffcd71', '#83bbff'],
      ['#221c32', '#c49cff', '#f59d70', '#9de5d2'],
    ],
    create(c) {
      const W = c.width;
      const H = c.height;
      const boxes = Array.from({ length: 7 }, (_, i) => ({ t: i / 7 + c.rand() * 0.08, color: 1 + (i % 3), bob: c.rand() * TAU }));
      const stations = [0.12, 0.38, 0.64, 0.88];
      let clock = 0;
      return {
        update(dt, t, p) {
          clock = t;
          const boost = p.active ? clamp(1 - Math.abs(p.y - H * 0.62) / (H * 0.45), 0, 1) * c.params.react : 0;
          for (const box of boxes) { box.t += dt * (0.07 + boost * 0.08) * c.params.speed; if (box.t > 1.1) box.t = -0.08; }
        },
        draw(g) {
          fillGradient(g, W, H, c.palette[0], mixHex(c.palette[0], '#071010', 0.48));
          const y = H * 0.64;
          g.strokeStyle = rgba(c.palette[1], 0.42); g.lineWidth = 3; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W * 0.25, y - H * 0.12, W * 0.72, y + H * 0.1, W, y - H * 0.05); g.stroke();
          for (const position of stations) {
            const x = position * W; const sy = y - Math.sin(position * 5) * H * 0.07;
            g.globalCompositeOperation = 'lighter'; glow(g, x, sy, 26, c.palette[3], 0.22); g.globalCompositeOperation = 'source-over';
            g.fillStyle = rgba('#ffffff', 0.1); rounded(g, x - 18, sy - 38, 36, 25, 5); g.fill();
            g.fillStyle = c.palette[3]; g.beginPath(); g.arc(x, sy, 6, 0, TAU); g.fill();
            g.strokeStyle = rgba('#ffffff', 0.28); g.beginPath(); g.moveTo(x, sy - 6); g.lineTo(x, sy - 20); g.stroke();
          }
          for (const box of boxes) {
            const x = box.t * W; const by = y - Math.sin(box.t * 5) * H * 0.07 - 12 + Math.sin(clock * 2 + box.bob) * 3;
            g.globalCompositeOperation = 'lighter'; glow(g, x, by, 20, c.palette[box.color], 0.25); g.globalCompositeOperation = 'source-over';
            g.fillStyle = c.palette[box.color]; rounded(g, x - 10, by - 8, 20, 16, 3); g.fill();
            g.strokeStyle = rgba('#ffffff', 0.62); g.lineWidth = 1; g.beginPath(); g.moveTo(x, by - 7); g.lineTo(x, by + 7); g.stroke();
          }
          g.fillStyle = rgba('#ffffff', 0.06); g.fillRect(0, H * 0.82, W, H * 0.18);
        },
      };
    },
  },
  {
    kind: 'canvas',
    id: 'career-ladder',
    label: 'Лестница роста',
    palettes: [
      ['#181631', '#9e8cff', '#70e0ff', '#ffd86f'],
      ['#102238', '#6fb6ff', '#8effca', '#ffe091'],
    ],
    create(c) {
      const W = c.width;
      const H = c.height;
      const steps = Array.from({ length: 7 }, (_, i) => ({ x: W * (0.12 + i * 0.115), y: H * (0.77 - i * 0.087), unlocked: i < 2, flash: 0 }));
      const stars = Array.from({ length: 18 }, () => ({ x: c.rand() * W, y: c.rand() * H * 0.75, phase: c.rand() * TAU }));
      let clock = 0;
      return {
        update(dt, t, p) {
          clock = t;
          if (p.clicked && c.params.react > 0) {
            const hit = steps.reduce((best, step, i) => Math.hypot(step.x - p.x, step.y - p.y) < Math.hypot(steps[best].x - p.x, steps[best].y - p.y) ? i : best, 0);
            steps[hit].unlocked = true; steps[hit].flash = 1;
          }
          for (const step of steps) step.flash = Math.max(0, step.flash - dt * 1.4);
        },
        draw(g) {
          fillGradient(g, W, H, c.palette[0], mixHex(c.palette[0], '#070611', 0.55));
          g.globalCompositeOperation = 'lighter';
          for (const star of stars) { const a = 0.15 + 0.5 * (0.5 + 0.5 * Math.sin(clock * 1.6 + star.phase)); g.fillStyle = rgba('#ffffff', a); g.beginPath(); g.arc(star.x, star.y, 1, 0, TAU); g.fill(); }
          g.globalCompositeOperation = 'source-over';
          for (let i = 0; i < steps.length - 1; i += 1) {
            const a = steps[i]; const b = steps[i + 1];
            g.strokeStyle = rgba(a.unlocked && b.unlocked ? c.palette[2] : '#ffffff', a.unlocked && b.unlocked ? 0.65 : 0.13);
            g.lineWidth = 3; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
          }
          for (let i = 0; i < steps.length; i += 1) {
            const step = steps[i]; const active = step.unlocked ? 1 : 0;
            g.globalCompositeOperation = 'lighter'; glow(g, step.x, step.y, 24 + step.flash * 18, active ? c.palette[2] : c.palette[1], 0.22 + step.flash * 0.45); g.globalCompositeOperation = 'source-over';
            g.fillStyle = active ? c.palette[i === steps.length - 1 ? 3 : 2] : rgba('#ffffff', 0.14); g.beginPath(); g.arc(step.x, step.y, 10 + step.flash * 2, 0, TAU); g.fill();
            g.fillStyle = active ? rgba('#ffffff', 0.88) : rgba('#ffffff', 0.42); g.font = `bold 10px ${FONT_SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`${i + 1}`, step.x, step.y + 0.5);
          }
          const top = steps[steps.length - 1];
          g.globalCompositeOperation = 'lighter'; glow(g, top.x, top.y - 37, 38, c.palette[3], 0.5); g.globalCompositeOperation = 'source-over';
          g.fillStyle = c.palette[3]; g.beginPath(); g.moveTo(top.x, top.y - 51); g.lineTo(top.x + 7, top.y - 34); g.lineTo(top.x - 10, top.y - 43); g.lineTo(top.x + 10, top.y - 43); g.lineTo(top.x - 7, top.y - 34); g.fill();
        },
      };
    },
  },
  {
    kind: 'canvas',
    id: 'jetpack-aviator',
    label: 'Реактивный авиатор',
    palettes: [
      ['#071630', '#53c8ff', '#ffb35f', '#f9ecb5'],
      ['#1a1234', '#b789ff', '#ff8a62', '#fff0aa'],
    ],
    create(c) {
      const W = c.width;
      const H = c.height;
      const stars = Array.from({ length: Math.round(clamp(W * H / 12000, 14, 34)) }, () => ({ x: c.rand() * W, y: c.rand() * H * 0.72, phase: c.rand() * TAU }));
      const clouds = Array.from({ length: 7 }, () => ({
        x: c.rand() * W * 1.45 - W * 0.25,
        y: H * (0.12 + c.rand() * 0.76),
        scale: 0.45 + c.rand() * 0.85,
        drift: 3 + c.rand() * 7,
        phase: c.rand() * TAU,
      }));
      let clock = 0;
      let flight = 0.08;
      let boost = 0;
      const pathX = (t: number) => W * (-0.07 + t * 1.16);
      const pathY = (t: number) => H * (0.78 - Math.pow(t, 1.38) * 0.61) + Math.sin(t * TAU * 1.1 + clock * 1.45) * H * 0.012;
      return {
        update(dt, t, p) {
          clock = t;
          flight = (flight + dt * 0.058 * c.params.speed * (1 + boost * 0.8)) % 1;
          boost = Math.max(0, boost - dt * 0.9);
          if (p.clicked && c.params.react > 0) boost = 1;
        },
        draw(g) {
          fillGradient(g, W, H, c.palette[0], mixHex(c.palette[0], '#040714', 0.7));

          g.globalCompositeOperation = 'lighter';
          for (const star of stars) {
            const alpha = 0.15 + (0.5 + 0.5 * Math.sin(clock * 1.9 + star.phase)) * 0.55;
            g.fillStyle = rgba(c.palette[3], alpha * c.params.intensity);
            g.beginPath(); g.arc(star.x, star.y, 0.7 + alpha * 1.15, 0, TAU); g.fill();
          }
          g.globalCompositeOperation = 'source-over';

          for (const cloud of clouds) {
            const x = ((cloud.x + clock * cloud.drift * c.params.speed) % (W * 1.55)) - W * 0.22;
            const y = cloud.y + Math.sin(clock * 0.7 + cloud.phase) * 4;
            const r = 20 * cloud.scale;
            g.fillStyle = rgba('#dceeff', 0.055 + cloud.scale * 0.055);
            g.beginPath();
            g.arc(x - r * 0.75, y, r * 0.72, 0, TAU);
            g.arc(x, y - r * 0.22, r, 0, TAU);
            g.arc(x + r * 0.85, y, r * 0.68, 0, TAU);
            g.arc(x + r * 0.18, y + r * 0.32, r * 0.92, 0, TAU);
            g.fill();
          }

          const visiblePath = Math.min(1, flight + 0.1);
          g.globalCompositeOperation = 'lighter';
          g.strokeStyle = rgba(c.palette[1], 0.14);
          g.lineWidth = 1.5;
          g.setLineDash([3, 7]);
          g.beginPath();
          for (let i = 0; i <= 52; i += 1) {
            const t = i / 52;
            if (i === 0) g.moveTo(pathX(t), pathY(t)); else g.lineTo(pathX(t), pathY(t));
          }
          g.stroke();
          g.setLineDash([]);
          g.strokeStyle = rgba(c.palette[1], 0.72 * c.params.intensity);
          g.lineWidth = 2.2 + boost * 1.2;
          g.beginPath();
          for (let i = 0; i <= 48; i += 1) {
            const t = visiblePath * i / 48;
            if (i === 0) g.moveTo(pathX(t), pathY(t)); else g.lineTo(pathX(t), pathY(t));
          }
          g.stroke();
          g.globalCompositeOperation = 'source-over';

          const riderX = pathX(flight);
          const riderY = pathY(flight);
          const riderScale = clamp(Math.min(W, H) / 145, 0.76, 1.45);
          g.globalCompositeOperation = 'lighter';
          glow(g, riderX - 18 * riderScale, riderY + 17 * riderScale, 38 * riderScale + boost * 18, c.palette[2], 0.3 + boost * 0.28);
          g.globalCompositeOperation = 'source-over';

          g.save();
          g.translate(riderX, riderY);
          g.rotate(-0.43 - flight * 0.1);
          g.scale(riderScale, riderScale);

          // Twin jetpack flames sit behind the rider, so the backpack unmistakably drives the ascent.
          g.globalCompositeOperation = 'lighter';
          for (const offset of [-7, 2]) {
            const flame = g.createLinearGradient(-11, offset + 10, -48 - boost * 16, offset + 28);
            flame.addColorStop(0, rgba('#fff6ba', 0.95));
            flame.addColorStop(0.32, rgba(c.palette[2], 0.9));
            flame.addColorStop(1, rgba('#ff5b4a', 0));
            g.fillStyle = flame;
            g.beginPath();
            g.moveTo(-11, offset + 8); g.lineTo(-47 - boost * 15, offset + 21 + Math.sin(clock * 22 + offset) * 4); g.lineTo(-9, offset + 15); g.closePath(); g.fill();
          }
          g.globalCompositeOperation = 'source-over';

          g.fillStyle = mixHex(c.palette[1], '#16243d', 0.45);
          rounded(g, -15, -7, 10, 25, 4); g.fill();
          g.fillStyle = c.palette[2];
          rounded(g, -16, -5, 4, 10, 2); g.fill();
          rounded(g, -16, 8, 4, 10, 2); g.fill();
          g.fillStyle = rgba('#ffffff', 0.48); g.fillRect(-13, -3, 2, 7);

          g.strokeStyle = '#d5e8ff';
          g.lineWidth = 4.5;
          g.lineCap = 'round';
          g.beginPath(); g.moveTo(1, 4); g.lineTo(17, -1); g.lineTo(25, 5); g.stroke();
          g.beginPath(); g.moveTo(2, 6); g.lineTo(13, 17); g.lineTo(23, 18); g.stroke();
          g.fillStyle = '#31527a';
          rounded(g, -2, -5, 14, 20, 5); g.fill();
          g.fillStyle = rgba(c.palette[1], 0.9); rounded(g, 2, -1, 7, 8, 2); g.fill();
          g.fillStyle = '#f6c39a';
          g.beginPath(); g.arc(2, -14, 8, 0, TAU); g.fill();
          g.fillStyle = '#1b3154';
          g.beginPath(); g.arc(3, -15, 8, Math.PI * 1.03, Math.PI * 1.94); g.fill();
          g.fillStyle = rgba('#bcecff', 0.88);
          g.beginPath(); g.ellipse(4, -15, 6.2, 3.4, -0.18, 0, TAU); g.fill();
          g.fillStyle = '#f6c39a';
          g.beginPath(); g.arc(26, 5, 2.4, 0, TAU); g.arc(24, 18, 2.4, 0, TAU); g.fill();
          g.restore();

          const multiplier = 1.12 + flight * 9.8 + boost * 1.7;
          const badgeW = 76;
          const badgeX = W - badgeW - 16;
          g.fillStyle = rgba('#030914', 0.54); rounded(g, badgeX, 15, badgeW, 32, 16); g.fill();
          g.strokeStyle = rgba(c.palette[1], 0.6); g.lineWidth = 1; rounded(g, badgeX, 15, badgeW, 32, 16); g.stroke();
          g.fillStyle = c.palette[3]; g.font = `700 16px ${FONT_SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(`×${multiplier.toFixed(2)}`, badgeX + badgeW / 2, 31.5);
          g.fillStyle = rgba('#ffffff', 0.5); g.font = `700 8px ${FONT_SANS}`; g.letterSpacing = '1px';
          g.fillText('ВЗЛЁТ', badgeX + badgeW / 2, 58);
          g.letterSpacing = '0px';
        },
      };
    },
  },
];
