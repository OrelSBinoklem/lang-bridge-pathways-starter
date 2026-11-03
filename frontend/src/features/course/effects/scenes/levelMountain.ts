import type { CanvasSceneDef } from './types';
import { TAU, clamp, lerp, mixHex, rgba } from './kit';

/**
 * "Education and career": the climb from A1 to C2 as a mountain at dawn. Far ranges fade into the haze; the peak is
 * lit on the side facing the sun and blue in the shade, with a snow cap and rock bands. A trail switchbacks up its
 * face past six camps — A1, A2 (basic level), B1, B2 (intermediate), C1, C2 (advanced) — each a tent with a flag in
 * its level's colour. A climber with a backpack walks the trail, rests at every camp, plants a flag on the summit
 * amid sparkles, and the climb begins again. Clouds drift across the slopes, some in front of the trail. Pointing at
 * a camp names its level in Latvian and Russian; a click sends the climber there.
 */

const LEVELS: { id: string; col: string; lv: string; ru: string }[] = [
  { id: 'A1', col: '#5ad07a', lv: 'pamatlīmenis, 1. pakāpe', ru: 'начальный уровень' },
  { id: 'A2', col: '#5ad07a', lv: 'pamatlīmenis, 2. pakāpe', ru: 'элементарный уровень' },
  { id: 'B1', col: '#4aa8ff', lv: 'vidējais līmenis, 1. pakāpe', ru: 'средний уровень' },
  { id: 'B2', col: '#4aa8ff', lv: 'vidējais līmenis, 2. pakāpe', ru: 'выше среднего' },
  { id: 'C1', col: '#c08aff', lv: 'augstākais līmenis, 1. pakāpe', ru: 'продвинутый уровень' },
  { id: 'C2', col: '#ffd24a', lv: 'augstākais līmenis, 2. pakāpe', ru: 'в совершенстве' },
];

type Pt = { x: number; y: number };

export const LEVEL_MOUNTAIN: CanvasSceneDef = {
  kind: 'canvas',
  id: 'skill-tree',
  label: 'Восхождение A1–C2',
  palettes: [
    ['#27336e', '#f4a36a', '#ffe0a0', '#8a7a6a'],
    ['#5aa0e0', '#dcecff', '#fff6d8', '#7a7470'],
  ],
  create(c) {
    const W = c.width;
    const H = c.height;
    const S = c.dpr;
    const rand = c.rand;
    const [skyTop, skyLow, sunCol, rockCol] = c.palette;
    const u = c.body ? clamp(Math.min(W, H) / 420, 1, 3) : clamp(H / 160, 0.8, 2.4);
    const peak = c.body ? { x: W * 0.6, y: H * 0.12 } : { x: W * 0.74, y: H * 0.08 };
    const baseY = H * 1.02;
    const x0 = c.body ? W * 0.18 : W * 0.4;
    const x1 = c.body ? W * 1.02 : W * 1.06;
    const leftAt = (y: number) => lerp(peak.x, x0, (y - peak.y) / (baseY - peak.y));
    const rightAt = (y: number) => lerp(peak.x, x1, (y - peak.y) / (baseY - peak.y));
    const sun = { x: c.body ? W * 0.22 : W * 0.3, y: H * 0.62 };

    // The trail: switchbacks across the lit face, a camp at each turn, the last on the summit.
    const turns: Pt[] = [];
    const n = 6;
    for (let q = 0; q <= n; q += 1) {
      const y = lerp(baseY - H * 0.04, peak.y + H * 0.02, q / n);
      const f = q === n ? 0.5 : q % 2 ? 0.52 : 0.16;
      turns.push({ x: lerp(leftAt(y), rightAt(y), f * (q === n ? 1 : 0.9)), y });
    }
    turns[n] = { x: peak.x, y: peak.y + 2 * u };
    // A smooth polyline through the turns, sampled finely, with distances.
    const trail: Pt[] = [];
    for (let q = 0; q < n; q += 1) {
      const a = turns[q];
      const b = turns[q + 1];
      for (let s = 0; s < 24; s += 1) {
        const t = s / 24;
        const bow = Math.sin(t * Math.PI) * (b.y - a.y) * 0.12;
        trail.push({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) + bow });
      }
    }
    trail.push(turns[n]);
    const dist: number[] = [0];
    for (let q = 1; q < trail.length; q += 1) dist.push(dist[q - 1] + Math.hypot(trail[q].x - trail[q - 1].x, trail[q].y - trail[q - 1].y));
    const total = dist[dist.length - 1];
    const campAt = LEVELS.map((_, q) => dist[(q + 1) * 24] ?? total);
    const pointAt = (d: number): Pt & { dir: number } => {
      const dd = clamp(d, 0, total);
      let q = 1;
      while (q < dist.length - 1 && dist[q] < dd) q += 1;
      const f = (dd - dist[q - 1]) / Math.max(1e-6, dist[q] - dist[q - 1]);
      return { x: lerp(trail[q - 1].x, trail[q].x, f), y: lerp(trail[q - 1].y, trail[q].y, f), dir: Math.sign(trail[q].x - trail[q - 1].x) || 1 };
    };

    // The landscape, painted once.
    const land = document.createElement('canvas');
    land.width = Math.ceil(W * S);
    land.height = Math.ceil(H * S);
    {
      const g = land.getContext('2d')!;
      g.scale(S, S);
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, skyTop);
      sky.addColorStop(1, skyLow);
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
      const sg = g.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, Math.max(W, H) * 0.5);
      sg.addColorStop(0, rgba(sunCol, 0.9));
      sg.addColorStop(0.06, rgba(sunCol, 0.5));
      sg.addColorStop(0.3, rgba(sunCol, 0.12));
      sg.addColorStop(1, rgba(sunCol, 0));
      g.fillStyle = sg;
      g.fillRect(0, 0, W, H);
      // Far ranges: jagged ridgelines, paler and bluer with distance.
      for (let layer = 0; layer < 3; layer += 1) {
        const top = H * (0.5 + layer * 0.1);
        const col = mixHex(mixHex(rockCol, '#4a5a8a', 0.5), skyLow, 0.62 - layer * 0.17);
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(0, H);
        let y = top;
        for (let x = 0; x <= W + 8; x += 8) {
          y += (rand() - 0.5) * 7 * u + (top - y) * 0.08;
          const big = Math.sin(x * 0.012 + layer * 2) * H * 0.07 + Math.sin(x * 0.031 + layer) * H * 0.03;
          g.lineTo(x, y + big);
        }
        g.lineTo(W, H);
        g.fill();
      }
      // The mountain: two faces meeting at a ridge, rock bands, snow above the snowline.
      const ridgeFoot = { x: lerp(peak.x, x1, 0.35), y: baseY };
      const lit = mixHex(rockCol, sunCol, 0.22);
      const shade = mixHex(rockCol, '#2a2a48', 0.55);
      const edge = (from: Pt, to: Pt, rough: number) => {
        const pts: Pt[] = [];
        for (let q = 0; q <= 40; q += 1) {
          const t = q / 40;
          const j = q === 0 || q === 40 ? 0 : (rand() - 0.5) * rough;
          pts.push({ x: lerp(from.x, to.x, t) + j, y: lerp(from.y, to.y, t) + j * 0.5 });
        }
        return pts;
      };
      const leftEdge = edge(peak, { x: x0, y: baseY }, 6 * u);
      const rightEdge = edge(peak, { x: x1, y: baseY }, 6 * u);
      const ridge = edge(peak, ridgeFoot, 4 * u);
      g.fillStyle = lit;
      g.beginPath();
      leftEdge.forEach((p, q) => (q ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      for (let q = ridge.length - 1; q >= 0; q -= 1) g.lineTo(ridge[q].x, ridge[q].y);
      g.fill();
      g.fillStyle = shade;
      g.beginPath();
      ridge.forEach((p, q) => (q ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      for (let q = rightEdge.length - 1; q >= 0; q -= 1) g.lineTo(rightEdge[q].x, rightEdge[q].y);
      g.fill();
      const faceLight = g.createLinearGradient(x0, 0, ridgeFoot.x, 0);
      faceLight.addColorStop(0, rgba(sunCol, 0.22));
      faceLight.addColorStop(1, rgba(sunCol, 0));
      g.fillStyle = faceLight;
      g.beginPath();
      leftEdge.forEach((p, q) => (q ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      for (let q = ridge.length - 1; q >= 0; q -= 1) g.lineTo(ridge[q].x, ridge[q].y);
      g.fill();
      g.save();
      g.beginPath();
      leftEdge.forEach((p, q) => (q ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      for (let q = rightEdge.length - 1; q >= 0; q -= 1) g.lineTo(rightEdge[q].x, rightEdge[q].y);
      g.clip();
      for (let q = 0; q < 26; q += 1) {
        const y = lerp(peak.y, baseY, rand());
        const xa = leftAt(y) + rand() * (rightAt(y) - leftAt(y)) * 0.8;
        g.strokeStyle = rand() < 0.5 ? 'rgba(0,0,0,0.12)' : rgba(sunCol, 0.1);
        g.lineWidth = (1 + rand() * 2) * u;
        g.beginPath();
        g.moveTo(xa, y);
        g.lineTo(xa + (10 + rand() * 30) * u, y + (rand() - 0.2) * 8 * u);
        g.stroke();
      }
      // Snow: a jagged line below the peak, bright on the lit face, blue in the shade.
      const snowY = lerp(peak.y, baseY, 0.3);
      for (const [face, col] of [[0, '#ffffff'], [1, '#b8c8ee']] as const) {
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(peak.x, peak.y - 2);
        const from = face === 0 ? leftAt(snowY) - 4 : lerp(peak.x, ridgeFoot.x, (snowY - peak.y) / (baseY - peak.y));
        const to = face === 0 ? lerp(peak.x, ridgeFoot.x, (snowY - peak.y) / (baseY - peak.y)) : rightAt(snowY) + 4;
        g.lineTo(from, snowY + (face ? 4 : 0) * u);
        for (let q = 1; q <= 14; q += 1) {
          const t = q / 14;
          g.lineTo(lerp(from, to, t), snowY + (q % 2 ? 1 : -1) * (4 + rand() * 7) * u + (rand() - 0.3) * 6 * u);
        }
        g.closePath();
        g.fill();
      }
      g.restore();
      // Pines at the foot.
      for (let q = 0; q < (c.body ? 70 : 34); q += 1) {
        const x = lerp(x0 - 10, W + 10, rand());
        const h = (10 + rand() * 12) * u;
        const y = baseY - rand() * H * 0.06;
        g.fillStyle = mixHex('#1e3a2e', skyLow, 0.12 + rand() * 0.1);
        g.beginPath();
        g.moveTo(x, y - h);
        g.lineTo(x + h * 0.32, y);
        g.lineTo(x - h * 0.32, y);
        g.fill();
      }
      // The trail, a faint worn line.
      g.strokeStyle = rgba('#fff2d8', 0.45);
      g.lineWidth = 1.4 * u;
      g.setLineDash([3 * u, 3 * u]);
      g.beginPath();
      trail.forEach((p, q) => (q ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.stroke();
      g.setLineDash([]);
    }

    const clouds = Array.from({ length: 5 }, (_, q) => ({
      x: rand() * W,
      y: lerp(peak.y + H * 0.15, H * 0.7, rand()),
      w: (60 + rand() * 90) * u,
      v: (4 + rand() * 6) * u,
      front: q % 2 === 0,
      seed: rand() * 10,
    }));
    let d = 0;
    let rest = 1.2;
    let goal = -1;
    let summit = 0;
    let fade = 1;
    let clock = 0;
    let hover = -1;
    const sparks: { x: number; y: number; vx: number; vy: number; life: number; col: string }[] = [];

    const drawCloud = (g: CanvasRenderingContext2D, x: number, y: number, w: number, seed: number, a: number) => {
      for (let q = 0; q < 6; q += 1) {
        const px = x + (((seed * 7.3 + q * 13.1) % 1) - 0.5) * w;
        const py = y + (((seed * 3.1 + q * 5.7) % 1) - 0.5) * w * 0.2;
        const r = w * (0.2 + ((seed + q * 0.37) % 1) * 0.18);
        const gr = g.createRadialGradient(px, py, 0, px, py, r);
        gr.addColorStop(0, `rgba(255,248,240,${0.55 * a})`);
        gr.addColorStop(1, 'rgba(255,248,240,0)');
        g.fillStyle = gr;
        g.fillRect(px - r, py - r, r * 2, r * 2);
      }
    };

    return {
      update(dt, _t, p) {
        const sdt = Math.min(dt, 0.05) * clamp(c.params.speed, 0.2, 3);
        clock += sdt;
        hover = -1;
        if (p.active && c.params.react > 0) {
          LEVELS.forEach((_, q) => {
            const cp = pointAt(campAt[q]);
            if (Math.hypot(p.x - cp.x, p.y - cp.y) < 16 * u) hover = q;
          });
          if (p.clicked) {
            LEVELS.forEach((_, q) => {
              const cp = pointAt(campAt[q]);
              if (Math.hypot(p.rawX - cp.x, p.rawY - cp.y) < 16 * u) goal = q;
            });
          }
        }
        if (summit > 0) {
          summit += sdt;
          if (summit > 3.2) fade = Math.max(0, fade - sdt * 1.5);
          if (fade === 0) {
            summit = 0;
            d = 0;
            rest = 1;
            fade = 1;
          }
        } else if (goal >= 0) {
          // Hurry to the chosen camp, up or down.
          const target = campAt[goal];
          const step = 60 * u * sdt;
          d = Math.abs(target - d) <= step ? target : d + Math.sign(target - d) * step;
          if (d === target) {
            goal = -1;
            rest = 1.5;
            if (target >= total - 1) summit = 0.001;
          }
        } else if (rest > 0) rest -= sdt;
        else {
          const before = d;
          d = Math.min(total, d + 16 * u * sdt);
          for (const at of campAt) if (before < at && d >= at) {
            d = at;
            rest = 1.6;
          }
          if (d >= total) summit = 0.001;
        }
        if (summit > 0 && summit < 2.2 && rand() < sdt * 30) {
          const cols = LEVELS.map((l) => l.col);
          sparks.push({ x: peak.x, y: peak.y - 10 * u, vx: (rand() - 0.5) * 80 * u, vy: -(30 + rand() * 60) * u, life: 1, col: cols[Math.floor(rand() * cols.length)] });
        }
        for (let q = sparks.length - 1; q >= 0; q -= 1) {
          const s = sparks[q];
          s.vy += 60 * u * sdt;
          s.x += s.vx * sdt;
          s.y += s.vy * sdt;
          s.life -= sdt / 1.4;
          if (s.life <= 0) sparks.splice(q, 1);
        }
        for (const cl of clouds) {
          cl.x += cl.v * sdt;
          if (cl.x - cl.w > W) cl.x = -cl.w;
        }
      },
      draw(g) {
        g.drawImage(land, 0, 0, W, H);
        for (const cl of clouds) if (!cl.front) drawCloud(g, cl.x, cl.y, cl.w, cl.seed, 0.8);
        // The part of the trail already climbed, brighter.
        g.strokeStyle = rgba('#ffe7a8', 0.85);
        g.lineWidth = 1.8 * u;
        g.beginPath();
        let q = 0;
        g.moveTo(trail[0].x, trail[0].y);
        while (q < trail.length - 1 && dist[q + 1] <= d) {
          q += 1;
          g.lineTo(trail[q].x, trail[q].y);
        }
        const here = pointAt(d);
        g.lineTo(here.x, here.y);
        g.globalAlpha = fade;
        g.stroke();
        g.globalAlpha = 1;
        // Camps: a tent, a flag in the level's colour, the level's name.
        LEVELS.forEach((lvl, k) => {
          const cp = pointAt(campAt[k]);
          const reached = d >= campAt[k] - 0.5;
          const s = 7.5 * u * (hover === k ? 1.25 : 1);
          if (k < LEVELS.length - 1) {
            g.fillStyle = mixHex(lvl.col, '#000000', reached ? 0.1 : 0.45);
            g.beginPath();
            g.moveTo(cp.x - s * 1.1, cp.y);
            g.lineTo(cp.x, cp.y - s * 1.2);
            g.lineTo(cp.x + s * 1.1, cp.y);
            g.fill();
            g.fillStyle = 'rgba(0,0,0,0.45)';
            g.beginPath();
            g.moveTo(cp.x - s * 0.25, cp.y);
            g.lineTo(cp.x, cp.y - s * 0.7);
            g.lineTo(cp.x + s * 0.25, cp.y);
            g.fill();
          }
          const fx = cp.x + s * 1.5;
          const rise = k === LEVELS.length - 1 ? clamp(summit * 1.5, 0, 1) : 1;
          g.strokeStyle = '#3a2a1a';
          g.lineWidth = Math.max(1, 0.8 * u);
          g.beginPath();
          g.moveTo(fx, cp.y);
          g.lineTo(fx, cp.y - s * 2.6 * (k === LEVELS.length - 1 ? rise : 1));
          g.stroke();
          if (reached || k < LEVELS.length - 1) {
            const wave = Math.sin(clock * 5 + k) * s * 0.15;
            g.fillStyle = reached ? lvl.col : rgba(lvl.col, 0.45);
            g.beginPath();
            const top = cp.y - s * 2.6 * rise;
            g.moveTo(fx, top);
            g.quadraticCurveTo(fx + s * 0.8, top + wave, fx + s * 1.5, top + s * 0.4 + wave);
            g.lineTo(fx, top + s * 0.9);
            g.fill();
          }
          const fs = Math.round(clamp(9 * u, 11, 20));
          g.font = `700 ${fs}px "Segoe UI", system-ui, sans-serif`;
          g.textAlign = 'right';
          g.textBaseline = 'middle';
          g.lineWidth = 3;
          g.strokeStyle = 'rgba(0,0,0,0.55)';
          g.strokeText(lvl.id, cp.x - s * 1.3, cp.y - s * 0.6);
          g.fillStyle = reached ? '#ffffff' : 'rgba(255,255,255,0.75)';
          g.fillText(lvl.id, cp.x - s * 1.3, cp.y - s * 0.6);
        });
        // The climber: boots, legs, a jacket, a big orange backpack, a hat.
        if (fade > 0) {
          const s = 1.4 * u;
          const walking = rest <= 0 && summit === 0 ? 1 : 0;
          const step = Math.sin(clock * 9) * 2 * s * walking;
          g.save();
          g.globalAlpha = fade;
          g.translate(here.x, here.y);
          g.scale(here.dir, 1);
          g.strokeStyle = '#2a2230';
          g.lineWidth = 1.6 * s;
          g.lineCap = 'round';
          g.beginPath();
          g.moveTo(0, -6 * s);
          g.lineTo(-1.5 * s + step, 0);
          g.moveTo(0, -6 * s);
          g.lineTo(1.5 * s - step, 0);
          g.stroke();
          g.fillStyle = '#e8563a';
          g.beginPath();
          g.roundRect(-4.2 * s, -12 * s, 3.6 * s, 6 * s, 1.2 * s);
          g.fill();
          g.fillStyle = '#2f6fd0';
          g.beginPath();
          g.roundRect(-1.4 * s, -12.5 * s, 3.4 * s, 7 * s, 1.2 * s);
          g.fill();
          g.fillStyle = '#f0c8a0';
          g.beginPath();
          g.arc(0.6 * s, -14.5 * s, 1.8 * s, 0, TAU);
          g.fill();
          g.fillStyle = '#c83a3a';
          g.fillRect(-1.2 * s, -16.6 * s, 3.6 * s, 1.2 * s);
          g.strokeStyle = '#6a4a2a';
          g.lineWidth = 0.8 * s;
          g.beginPath();
          g.moveTo(2.4 * s, -10 * s);
          g.lineTo(4 * s + step * 0.4, 0);
          g.stroke();
          g.restore();
        }
        for (const cl of clouds) if (cl.front) drawCloud(g, cl.x, cl.y, cl.w, cl.seed, 0.55);
        g.globalCompositeOperation = 'lighter';
        for (const s of sparks) {
          g.fillStyle = rgba(s.col, s.life);
          g.fillRect(s.x - u, s.y - u, 2 * u, 2 * u);
        }
        g.globalCompositeOperation = 'source-over';
        if (hover >= 0) {
          const lvl = LEVELS[hover];
          const cp = pointAt(campAt[hover]);
          const fs = Math.round(clamp(7 * u, 10, 18));
          g.font = `700 ${fs}px "Segoe UI", system-ui, sans-serif`;
          const l1 = `${lvl.id} — ${lvl.ru}`;
          const w1 = g.measureText(l1).width;
          g.font = `italic ${Math.round(fs * 0.85)}px "Segoe UI", system-ui, sans-serif`;
          const w2 = g.measureText(lvl.lv).width;
          const bw = Math.max(w1, w2) + fs;
          const bh = fs * 2.5;
          const bx = clamp(cp.x - bw / 2, 2, W - bw - 2);
          const by = clamp(cp.y - 26 * u - bh, 2, H - bh - 2);
          g.fillStyle = 'rgba(16,20,40,0.88)';
          g.beginPath();
          g.roundRect(bx, by, bw, bh, fs * 0.4);
          g.fill();
          g.textAlign = 'center';
          g.textBaseline = 'top';
          g.fillStyle = lvl.col;
          g.font = `700 ${fs}px "Segoe UI", system-ui, sans-serif`;
          g.fillText(l1, bx + bw / 2, by + fs * 0.25);
          g.fillStyle = 'rgba(230,235,250,0.85)';
          g.font = `italic ${Math.round(fs * 0.85)}px "Segoe UI", system-ui, sans-serif`;
          g.fillText(lvl.lv, bx + bw / 2, by + fs * 1.35);
        }
      },
    };
  },
};
