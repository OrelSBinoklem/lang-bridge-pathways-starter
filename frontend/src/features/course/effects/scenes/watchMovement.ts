// TODO (не закончено): сцена написана, но НЕ зарегистрирована в registry.ts и не проверена в браузере.
// Доделать: убрать заготовки band/stripes в слое мостов, проверить /course/scenes-preview?scene=time-vortex,
// затем удалить шейдер time-vortex из shaderScenes.ts (node .tmp/remove-scene.cjs) и подключить WATCH_MOVEMENT.
import type { CanvasSceneDef } from './types';
import { TAU, clamp, mixHex, rgba } from './kit';
import { GOLD, STEEL, createGearPainter, makeGearSprite, pitchRadius, solveTrain, type GearSprite, type TrainGear } from './gearKit';

/**
 * "It's never too late": the movement of a skeleton watch in close-up. A balance wheel with gold timing screws swings
 * back and forth three times a second while its blued hairspring breathes; at each swing the pallet fork flips and
 * lets the escape wheel jump half a tooth — the tick — and that step runs through the whole train: fourth wheel
 * (which carries the seconds hand, so it steps six times a second), third wheel, centre wheel (one turn an hour) and
 * the mainspring barrel under its ratchet. Rhodium bridges with Côtes de Genève stripes and polished bevels, ruby
 * jewels in their chatons, heat-blued screws, a perlage mainplate engraved "nekad nav par vēlu". The hands show the
 * real time. The cursor is a watchmaker's loupe; a click winds the mainspring and the balance swings wider.
 */

const TRAIN: (TrainGear & { name: string })[] = [
  { name: 'escape', z: 15, parent: -1, contact: 0 },
  { name: 'escape pinion', z: 6, parent: 0, contact: -1 },
  { name: 'fourth', z: 72, parent: 1, contact: 2.75 },
  { name: 'fourth pinion', z: 8, parent: 2, contact: -1 },
  { name: 'third', z: 60, parent: 3, contact: -2.7 },
  { name: 'third pinion', z: 8, parent: 4, contact: -1 },
  { name: 'centre', z: 64, parent: 5, contact: 2.6 },
  { name: 'centre pinion', z: 10, parent: 6, contact: -1 },
  { name: 'barrel', z: 80, parent: 7, contact: -2.2 },
];
const BEATS = 6;

export const WATCH_MOVEMENT: CanvasSceneDef = {
  kind: 'canvas',
  id: 'time-vortex',
  label: 'Часовой механизм',
  palettes: [
    ['#1a1d24', '#c8ccd2', '#d8b050', '#c8102e'],
    ['#10141c', '#d8c8a8', '#e8c060', '#d02040'],
  ],
  create(c) {
    const W = c.width;
    const H = c.height;
    const S = c.dpr;
    const rand = c.rand;
    const [plateCol, bridgeCol, goldCol, rubyCol] = c.palette;

    // Positions in module units: the escape wheel at the origin, the train running left to the barrel.
    const E_M = 1.45;
    const at: { x: number; y: number }[] = [];
    TRAIN.forEach((gr, i) => {
      if (i === 0) at.push({ x: 0, y: 0 });
      else if (gr.contact === -1) at.push({ ...at[gr.parent] });
      else {
        const d = pitchRadius(TRAIN[gr.parent].z, 1) + pitchRadius(gr.z, 1);
        at.push({ x: at[gr.parent].x + Math.cos(gr.contact) * d, y: at[gr.parent].y + Math.sin(gr.contact) * d });
      }
    });
    const pivot = { x: 18, y: -1 };
    const Rb = 22;
    const bal = { x: pivot.x + 24, y: pivot.y };
    const centre = at[6];
    const plateR = 150;
    const plateC = { x: -52, y: 0 };
    const sc = c.body ? Math.min(W / 260, H / 150) : W * 0.62 / 232;
    const ox = (c.body ? W * 0.52 : W * 0.66) - -50 * sc;
    const oy = H * 0.5 + 3 * sc;
    const P = (x: number, y: number) => ({ x: ox + x * sc, y: oy + y * sc });
    const m = sc;
    const painter = createGearPainter(-2.3);
    const matOf = (i: number) => (i === 0 || i === 1 ? STEEL : GOLD);
    const sprites: GearSprite[] = TRAIN.map((gr, i) =>
      makeGearSprite(
        {
          z: gr.z,
          m: i === 0 ? E_M * m : m,
          mat: matOf(i),
          spokes: i === 0 ? 4 : gr.z >= 60 ? (i === 8 ? 0 : 5) : 0,
          escape: i === 0,
          hub: gr.z < 12 ? m * 1.2 : undefined,
        },
        S,
        rand,
      ),
    );
    const ratchet = makeGearSprite({ z: 44, m: m * 0.7, mat: STEEL, ringed: true }, S, rand);
    const { k, c: c0 } = solveTrain(TRAIN);

    const layer = () => {
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(W * S);
      cv.height = Math.ceil(H * S);
      const g = cv.getContext('2d')!;
      g.scale(S, S);
      return { cv, g };
    };
    const jewel = (g: CanvasRenderingContext2D, x: number, y: number, r: number) => {
      const ring = g.createRadialGradient(x - r * 0.4, y - r * 0.4, 0, x, y, r * 1.7);
      ring.addColorStop(0, '#f6f2e8');
      ring.addColorStop(1, '#8a8478');
      g.fillStyle = ring;
      g.beginPath();
      g.arc(x, y, r * 1.7, 0, TAU);
      g.fill();
      const ruby = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
      ruby.addColorStop(0, mixHex(rubyCol, '#ffffff', 0.35));
      ruby.addColorStop(0.5, rubyCol);
      ruby.addColorStop(1, mixHex(rubyCol, '#000000', 0.55));
      g.fillStyle = ruby;
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath();
      g.arc(x - r * 0.35, y - r * 0.35, r * 0.22, 0, TAU);
      g.fill();
      g.fillStyle = '#1a1414';
      g.beginPath();
      g.arc(x, y, r * 0.2, 0, TAU);
      g.fill();
    };
    const screw = (g: CanvasRenderingContext2D, x: number, y: number, r: number) => {
      const b = g.createRadialGradient(x - r * 0.4, y - r * 0.4, 0, x, y, r);
      b.addColorStop(0, '#8ab4ff');
      b.addColorStop(0.5, '#2f56c8');
      b.addColorStop(1, '#101a58');
      g.fillStyle = b;
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
      const a = rand() * Math.PI;
      g.strokeStyle = 'rgba(5,8,30,0.9)';
      g.lineWidth = r * 0.28;
      g.beginPath();
      g.moveTo(x - Math.cos(a) * r * 0.8, y - Math.sin(a) * r * 0.8);
      g.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8);
      g.stroke();
    };

    // The mainplate: perlage, the edge of the movement, the engraving.
    const plate = layer();
    {
      const g = plate.g;
      g.fillStyle = mixHex(plateCol, '#000000', 0.4);
      g.fillRect(0, 0, W, H);
      const pc = P(plateC.x, plateC.y);
      const pr = plateR * sc;
      g.save();
      g.beginPath();
      g.arc(pc.x, pc.y, pr, 0, TAU);
      g.clip();
      g.fillStyle = plateCol;
      g.fillRect(0, 0, W, H);
      const step = 7 * sc;
      for (let y = -step; y < H + step; y += step * 0.8) {
        for (let x = -step; x < W + step; x += step * 0.8) {
          const gr = g.createRadialGradient(x - step * 0.2, y - step * 0.2, 0, x, y, step * 0.62);
          gr.addColorStop(0, rgba(mixHex(plateCol, '#ffffff', 0.35), 0.8));
          gr.addColorStop(0.7, rgba(plateCol, 0.4));
          gr.addColorStop(1, rgba(mixHex(plateCol, '#000000', 0.3), 0.8));
          g.fillStyle = gr;
          g.beginPath();
          g.arc(x, y, step * 0.62, 0, TAU);
          g.fill();
        }
      }
      g.restore();
      g.strokeStyle = rgba(bridgeCol, 0.8);
      g.lineWidth = 3 * sc;
      g.beginPath();
      g.arc(pc.x, pc.y, pr, 0, TAU);
      g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.6)';
      g.lineWidth = 1.2 * sc;
      g.beginPath();
      g.arc(pc.x, pc.y, pr - 2.4 * sc, 0, TAU);
      g.stroke();
      // Engraved along the plate's edge, filled with gold.
      const text = 'NEKAD NAV PAR VĒLU';
      g.font = `600 ${Math.round(6.5 * sc)}px Georgia, "Times New Roman", serif`;
      g.fillStyle = rgba(goldCol, 0.85);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const rr = pr - 9 * sc;
      let a = Math.PI * 0.86;
      for (const ch of text) {
        const w = g.measureText(ch).width / rr;
        g.save();
        g.translate(pc.x + Math.cos(a + w / 2) * rr, pc.y + Math.sin(a + w / 2) * rr);
        g.rotate(a + w / 2 + Math.PI / 2);
        g.fillText(ch, 0, 0);
        g.restore();
        a += w * 1.15;
      }
    }

    // The bridges, their stripes and bevels, jewels and screws: all still, painted once.
    const bridges = layer();
    {
      const g = bridges.g;
      const stripes = (path: () => void) => {
        g.save();
        path();
        g.fillStyle = bridgeCol;
        g.fill();
        path();
        g.clip();
        const band = 6 * sc;
        g.translate(W / 2, H / 2);
        g.rotate(-0.5);
        for (let x = -W; x < W; x += band) {
          const gr = g.createLinearGradient(x, 0, x + band, 0);
          gr.addColorStop(0, 'rgba(0,0,0,0.12)');
          gr.addColorStop(0.5, 'rgba(255,255,255,0.28)');
          gr.addColorStop(1, 'rgba(0,0,0,0.12)');
          g.fillStyle = gr;
          g.fillRect(x, -H * 2, band, H * 4);
        }
        g.restore();
        // Anglage: a bright polished bevel inside the edge, a dark line outside.
        path();
        g.strokeStyle = 'rgba(0,0,0,0.55)';
        g.lineWidth = 2.2 * sc;
        g.stroke();
        path();
        g.strokeStyle = 'rgba(255,255,255,0.75)';
        g.lineWidth = 0.9 * sc;
        g.stroke();
      };
      const band = (pts: { x: number; y: number }[], w: number) => () => {
        g.beginPath();
        pts.forEach((p, i) => {
          const q = P(p.x, p.y);
          if (i === 0) g.moveTo(q.x, q.y);
          else g.lineTo(q.x, q.y);
        });
        g.lineWidth = w * sc;
        g.lineCap = 'round';
        g.lineJoin = 'round';
        // Turn the stroke into a fillable outline by stroking a copy offscreen is costly; use a thick stroke instead.
      };
      // The train bridge: a curved arm over the third, fourth and escape pivots.
      const trainPts = [at[4], { x: (at[4].x + at[2].x) / 2, y: at[2].y - 12 }, at[2], { x: at[2].x / 2, y: -6 }, at[0]];
      const drawBand = (pts: { x: number; y: number }[], w: number) => {
        const off = layer();
        const o = off.g;
        o.beginPath();
        pts.forEach((p, i) => {
          const q = P(p.x, p.y);
          if (i === 0) o.moveTo(q.x, q.y);
          else o.lineTo(q.x, q.y);
        });
        o.lineWidth = w * sc;
        o.lineCap = 'round';
        o.lineJoin = 'round';
        o.strokeStyle = bridgeCol;
        o.stroke();
        o.globalCompositeOperation = 'source-atop';
        o.translate(W / 2, H / 2);
        o.rotate(-0.5);
        const bw = 6 * sc;
        for (let x = -W; x < W; x += bw) {
          const gr = o.createLinearGradient(x, 0, x + bw, 0);
          gr.addColorStop(0, 'rgba(0,0,0,0.14)');
          gr.addColorStop(0.5, 'rgba(255,255,255,0.3)');
          gr.addColorStop(1, 'rgba(0,0,0,0.14)');
          o.fillStyle = gr;
          o.fillRect(x, -H * 2, bw, H * 4);
        }
        g.save();
        g.shadowColor = 'rgba(0,0,0,0.6)';
        g.shadowBlur = 5 * sc;
        g.shadowOffsetX = 2 * sc;
        g.shadowOffsetY = 3 * sc;
        g.drawImage(off.cv, 0, 0, W, H);
        g.restore();
        // The bevel along its edges.
        g.beginPath();
        pts.forEach((p, i) => {
          const q = P(p.x, p.y);
          if (i === 0) g.moveTo(q.x, q.y);
          else g.lineTo(q.x, q.y);
        });
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.strokeStyle = 'rgba(255,255,255,0.0)';
        g.lineWidth = w * sc;
        g.save();
        g.globalCompositeOperation = 'source-atop';
        g.restore();
      };
      void band;
      void stripes;
      drawBand(trainPts, 11);
      // The barrel bridge: a broad plate over the barrel.
      drawBand([{ x: at[8].x - 2, y: at[8].y }, { x: at[8].x + 2, y: at[8].y + 1 }], 44);
      // The centre bridge, under the hands.
      drawBand([{ x: centre.x - 8, y: centre.y + 6 }, { x: centre.x + 6, y: centre.y - 3 }], 14);
      // The pallet bridge.
      drawBand([{ x: pivot.x - 4, y: pivot.y + 12 }, pivot], 7);
      for (const i of [0, 2, 4]) {
        const q = P(at[i].x, at[i].y);
        jewel(g, q.x, q.y, 1.8 * sc);
      }
      const pq = P(pivot.x, pivot.y);
      jewel(g, pq.x, pq.y, 1.4 * sc);
      for (const [x, y] of [[at[4].x - 8, at[4].y + 6], [at[2].x + 4, at[2].y - 13], [at[0].x - 7, at[0].y - 8], [pivot.x - 4, pivot.y + 12], [at[8].x + 13, at[8].y - 12], [at[8].x - 14, at[8].y + 11], [centre.x - 8, centre.y + 6]]) {
        const q = P(x, y);
        screw(g, q.x, q.y, 2.3 * sc);
      }
    }
    // The balance cock, drawn over the balance: an arm from the plate's rim to a round end with the jewel and the
    // shock-protection spring, and the regulator's index.
    const cock = layer();
    {
      const g = cock.g;
      const off = layer();
      const o = off.g;
      const from = P(bal.x + 14, bal.y - 40);
      const mid = P(bal.x + 6, bal.y - 14);
      const to = P(bal.x, bal.y);
      o.strokeStyle = bridgeCol;
      o.lineCap = 'round';
      o.lineJoin = 'round';
      o.lineWidth = 11 * sc;
      o.beginPath();
      o.moveTo(from.x, from.y);
      o.quadraticCurveTo(mid.x, mid.y, to.x, to.y);
      o.stroke();
      o.fillStyle = bridgeCol;
      o.beginPath();
      o.arc(to.x, to.y, 7.5 * sc, 0, TAU);
      o.fill();
      o.globalCompositeOperation = 'source-atop';
      const sun = o.createConicGradient ? o.createConicGradient(0, to.x, to.y) : null;
      if (sun) {
        for (let q = 0; q <= 24; q += 1) sun.addColorStop(q / 24, q % 2 ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.12)');
        o.fillStyle = sun;
        o.fillRect(0, 0, W, H);
      }
      g.save();
      g.shadowColor = 'rgba(0,0,0,0.6)';
      g.shadowBlur = 6 * sc;
      g.shadowOffsetX = 2 * sc;
      g.shadowOffsetY = 4 * sc;
      g.drawImage(off.cv, 0, 0, W, H);
      g.restore();
      jewel(g, to.x, to.y, 2 * sc);
      g.strokeStyle = 'rgba(230,236,245,0.9)';
      g.lineWidth = 0.7 * sc;
      g.beginPath();
      for (let q = 0; q <= 40; q += 1) {
        const a = (q / 40) * TAU * 1.5;
        const r = 3.6 * sc + Math.sin(a * 2) * 0.6 * sc;
        if (q === 0) g.moveTo(to.x + Math.cos(a) * r, to.y + Math.sin(a) * r);
        else g.lineTo(to.x + Math.cos(a) * r, to.y + Math.sin(a) * r);
      }
      g.stroke();
      const idx = P(bal.x - 15, bal.y + 6);
      g.strokeStyle = bridgeCol;
      g.lineWidth = 1.6 * sc;
      g.beginPath();
      g.moveTo(to.x, to.y);
      g.lineTo(idx.x, idx.y);
      g.stroke();
      screw(g, from.x, from.y, 2.4 * sc);
    }

    let clock = 0;
    let amp = 4.2;
    let wound = 0;
    const now = new Date();
    const secs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000;
    const startBeat = Math.floor(secs * BEATS);
    let pointer = { x: 0, y: 0, on: false };
    const buf = layer();

    return {
      update(dt, _t, p) {
        const sdt = Math.min(dt, 0.05);
        clock += sdt * clamp(c.params.speed, 0.1, 3);
        amp = Math.max(3.0, amp - sdt * 0.02);
        if (p.active && p.clicked && c.params.react > 0) {
          amp = 4.6;
          wound += 0.35;
        }
        pointer = { x: p.x, y: p.y, on: p.active && c.params.react > 0 };
      },
      draw(out) {
        const g = buf.g;
        g.clearRect(0, 0, W, H);
        g.drawImage(plate.cv, 0, 0, W, H);
        const beatT = clock * BEATS;
        const beat = Math.floor(beatT);
        const f = beatT - beat;
        // The tick: half a tooth at every beat, fast, then locked.
        const snap = f < 0.14 ? (f / 0.14) ** 0.6 : 1;
        const phi = ((startBeat + beat + snap) * TAU) / (15 * 2);
        const order = [8, 7, 6, 5, 4, 3, 2, 1, 0];
        for (const i of order) {
          const q = P(at[i].x, at[i].y);
          const ang = c0[i] + k[i] * phi;
          painter.shadow(g, sprites[i], q.x + 2 * sc, q.y + 3 * sc, ang, 0, 0.5);
          painter.gear(g, sprites[i], q.x, q.y, ang, matOf(i), 0.8);
        }
        // The pallet fork: flips at every beat, as the balance passes its centre.
        const swing = Math.sin(Math.PI * beatT);
        const psi = 0.14 * clamp(swing * 4, -1, 1);
        const pv = P(pivot.x, pivot.y);
        g.save();
        g.translate(pv.x, pv.y);
        g.rotate(psi);
        g.strokeStyle = mixHex(STEEL.base, '#ffffff', 0.2);
        g.lineCap = 'round';
        g.lineWidth = 2.4 * sc;
        const eR = pitchRadius(15, E_M) + E_M;
        const arms = [0.62, -0.62].map((a) => ({ x: (Math.cos(Math.PI - a) * eR + 0 - pivot.x) * sc, y: (Math.sin(Math.PI - a) * eR - pivot.y) * sc }));
        g.beginPath();
        for (const a of arms) {
          g.moveTo(0, 0);
          g.lineTo(a.x * 0.85, a.y * 0.85);
        }
        g.moveTo(0, 0);
        g.lineTo((bal.x - pivot.x - Rb * 0.3) * sc, 0);
        g.stroke();
        g.fillStyle = rubyCol;
        for (const a of arms) {
          g.save();
          g.translate(a.x * 0.88, a.y * 0.88);
          g.rotate(Math.atan2(a.y, a.x));
          g.fillRect(-1.6 * sc, -0.9 * sc, 3.2 * sc, 1.8 * sc);
          g.restore();
        }
        g.restore();
        // The balance: rim, arms and timing screws, then the breathing hairspring.
        const theta = amp * Math.sin(Math.PI * beatT);
        const bq = P(bal.x, bal.y);
        const rr = Rb * sc;
        const rimG = g.createLinearGradient(bq.x - rr, bq.y - rr, bq.x + rr, bq.y + rr);
        rimG.addColorStop(0, mixHex(goldCol, '#ffffff', 0.45));
        rimG.addColorStop(0.5, goldCol);
        rimG.addColorStop(1, mixHex(goldCol, '#000000', 0.45));
        g.save();
        g.shadowColor = 'rgba(0,0,0,0.5)';
        g.shadowBlur = 4 * sc;
        g.shadowOffsetY = 3 * sc;
        g.strokeStyle = rimG;
        g.lineWidth = rr * 0.13;
        g.beginPath();
        g.arc(bq.x, bq.y, rr, 0, TAU);
        g.stroke();
        g.restore();
        g.strokeStyle = rimG;
        g.lineWidth = rr * 0.08;
        g.beginPath();
        for (let q = 0; q < 3; q += 1) {
          const a = theta + (q / 3) * TAU;
          g.moveTo(bq.x, bq.y);
          g.lineTo(bq.x + Math.cos(a) * rr, bq.y + Math.sin(a) * rr);
        }
        g.stroke();
        for (let q = 0; q < 10; q += 1) {
          const a = theta + (q / 10) * TAU + 0.2;
          const sx = bq.x + Math.cos(a) * rr * 1.07;
          const sy = bq.y + Math.sin(a) * rr * 1.07;
          const sg = g.createRadialGradient(sx - rr * 0.02, sy - rr * 0.02, 0, sx, sy, rr * 0.06);
          sg.addColorStop(0, '#fff2c0');
          sg.addColorStop(1, mixHex(goldCol, '#000000', 0.35));
          g.fillStyle = sg;
          g.beginPath();
          g.arc(sx, sy, rr * 0.06, 0, TAU);
          g.fill();
        }
        g.fillStyle = mixHex(goldCol, '#000000', 0.2);
        g.beginPath();
        g.arc(bq.x, bq.y, rr * 0.16, 0, TAU);
        g.fill();
        g.fillStyle = rubyCol;
        g.beginPath();
        g.arc(bq.x + Math.cos(theta + Math.PI) * rr * 0.12, bq.y + Math.sin(theta + Math.PI) * rr * 0.12, rr * 0.035, 0, TAU);
        g.fill();
        g.strokeStyle = 'rgba(110,150,230,0.95)';
        g.lineWidth = Math.max(0.5, 0.35 * sc);
        g.beginPath();
        const turns = 10;
        for (let q = 0; q <= turns * 36; q += 1) {
          const s = q / 36;
          const r = rr * (0.18 + (0.44 * s) / turns);
          const a = s * TAU + theta * (1 - s / turns) + 1.2;
          if (q === 0) g.moveTo(bq.x + Math.cos(a) * r, bq.y + Math.sin(a) * r);
          else g.lineTo(bq.x + Math.cos(a) * r, bq.y + Math.sin(a) * r);
        }
        g.stroke();
        g.drawImage(bridges.cv, 0, 0, W, H);
        g.drawImage(cock.cv, 0, 0, W, H);
        // The ratchet wheel on the barrel bridge, turning back as it is wound.
        const bb = P(at[8].x, at[8].y);
        painter.gear(g, ratchet, bb.x, bb.y, c0[8] + k[8] * phi + wound, STEEL, 1);
        screw(g, bb.x, bb.y, 3 * sc);

        // The hands: real time; the seconds hand on the fourth wheel steps with the beats.
        const t = new Date();
        const sec = t.getSeconds() + Math.floor((t.getMilliseconds() / 1000) * BEATS) / BEATS;
        const min = t.getMinutes() + sec / 60;
        const hr = (t.getHours() % 12) + min / 60;
        const cq = P(centre.x, centre.y);
        const hand = (ang: number, len: number, wd: number, light: string, dark: string) => {
          g.save();
          g.translate(cq.x, cq.y);
          g.rotate(ang - Math.PI / 2);
          g.shadowColor = 'rgba(0,0,0,0.55)';
          g.shadowBlur = 4 * sc;
          g.shadowOffsetX = 3 * sc;
          g.shadowOffsetY = 4 * sc;
          g.fillStyle = light;
          g.beginPath();
          g.moveTo(-len * 0.16, 0);
          g.lineTo(len * 0.12, -wd);
          g.lineTo(len, 0);
          g.closePath();
          g.fill();
          g.shadowColor = 'transparent';
          g.fillStyle = dark;
          g.beginPath();
          g.moveTo(-len * 0.16, 0);
          g.lineTo(len * 0.12, wd);
          g.lineTo(len, 0);
          g.closePath();
          g.fill();
          g.restore();
        };
        hand((hr / 12) * TAU, 38 * sc, 3.4 * sc, mixHex(goldCol, '#ffffff', 0.45), mixHex(goldCol, '#000000', 0.25));
        hand((min / 60) * TAU, 58 * sc, 2.8 * sc, mixHex(goldCol, '#ffffff', 0.5), mixHex(goldCol, '#000000', 0.2));
        g.fillStyle = mixHex(goldCol, '#ffffff', 0.3);
        g.beginPath();
        g.arc(cq.x, cq.y, 3 * sc, 0, TAU);
        g.fill();
        const fq = P(at[2].x, at[2].y);
        g.save();
        g.translate(fq.x, fq.y);
        g.rotate((sec / 60) * TAU - Math.PI / 2);
        g.strokeStyle = '#2f56c8';
        g.lineWidth = 1 * sc;
        g.beginPath();
        g.moveTo(-6 * sc, 0);
        g.lineTo(24 * sc, 0);
        g.stroke();
        g.fillStyle = '#2f56c8';
        g.beginPath();
        g.arc(0, 0, 1.8 * sc, 0, TAU);
        g.fill();
        g.restore();

        out.drawImage(buf.cv, 0, 0, W, H);
        if (pointer.on) {
          // The loupe: a round window at twice the size, with a steel rim and a glint on the glass.
          const R = Math.max(40, H * 0.3);
          const z = 2.2;
          out.save();
          out.beginPath();
          out.arc(pointer.x, pointer.y, R, 0, TAU);
          out.clip();
          out.drawImage(buf.cv, (pointer.x - R / z) * S, (pointer.y - R / z) * S, ((2 * R) / z) * S, ((2 * R) / z) * S, pointer.x - R, pointer.y - R, 2 * R, 2 * R);
          const vig = out.createRadialGradient(pointer.x, pointer.y, R * 0.7, pointer.x, pointer.y, R);
          vig.addColorStop(0, 'rgba(0,0,0,0)');
          vig.addColorStop(1, 'rgba(0,0,0,0.45)');
          out.fillStyle = vig;
          out.fillRect(pointer.x - R, pointer.y - R, R * 2, R * 2);
          out.restore();
          out.strokeStyle = '#1a1c20';
          out.lineWidth = 6;
          out.beginPath();
          out.arc(pointer.x, pointer.y, R + 2, 0, TAU);
          out.stroke();
          out.strokeStyle = 'rgba(220,226,235,0.7)';
          out.lineWidth = 1.5;
          out.beginPath();
          out.arc(pointer.x, pointer.y, R + 4.5, Math.PI * 1.05, Math.PI * 1.6);
          out.stroke();
          out.strokeStyle = 'rgba(255,255,255,0.35)';
          out.lineWidth = R * 0.08;
          out.beginPath();
          out.arc(pointer.x, pointer.y, R * 0.8, Math.PI * 1.15, Math.PI * 1.4);
          out.stroke();
        }
      },
    };
  },
};
