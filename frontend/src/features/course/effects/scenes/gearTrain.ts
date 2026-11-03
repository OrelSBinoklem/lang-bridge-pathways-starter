import type { CanvasSceneDef } from './types';
import { TAU, clamp, rgba } from './kit';
import { BRASS, COPPER, GUNMETAL, STEEL, createGearPainter, makeGearSprite, pitchRadius, solveTrain, type GearMaterial, type GearSprite } from './gearKit';

/**
 * "Shopping and services": the works of a mechanical cash register on a dark steel plate under a workshop lamp. A
 * train of brass, steel, copper and gunmetal gears — spoked wheels, pinions sharing a shaft with a larger wheel,
 * each tooth truly meshing with the next — turns slowly and drives a row of odometer drums that count up the price in
 * euros. The turned metal gleams towards the lamp whatever the angle of the gear. Grab any gear and spin it: the whole
 * train follows at its own ratios, keeps spinning when let go and slows back to the motor's pace.
 */

type Placed = { z: number; mat: GearMaterial; spokes: number; parent: number; contact: number; level: number };

const TRAIN: Placed[] = [
  { z: 40, mat: BRASS, spokes: 5, parent: -1, contact: 0, level: 0 },
  { z: 14, mat: STEEL, spokes: 0, parent: 0, contact: -0.45, level: 1 },
  { z: 32, mat: COPPER, spokes: 4, parent: 1, contact: -1, level: 0 },
  { z: 18, mat: GUNMETAL, spokes: 0, parent: 2, contact: 0.4, level: 1 },
  { z: 36, mat: BRASS, spokes: 6, parent: 3, contact: -0.3, level: 0 },
  { z: 12, mat: STEEL, spokes: 0, parent: 4, contact: 0.9, level: 1 },
];

export const GEAR_TRAIN: CanvasSceneDef = {
  kind: 'canvas',
  id: 'gears',
  label: 'Механизм кассы',
  palettes: [
    ['#1c2026', '#2c323a', '#ffd89a', '#ff9a4a'],
    ['#1a1612', '#34281c', '#ffe2b0', '#7ad0ff'],
  ],
  create(c) {
    const W = c.width;
    const H = c.height;
    const S = c.dpr;
    const rand = c.rand;
    const [plateDark, plateLight, lampCol, digitGlow] = c.palette;
    const light = -2.3;

    // Lay the train out at module 1, then scale it to fit the card's right part.
    const unit: { x: number; y: number }[] = [];
    TRAIN.forEach((gr, i) => {
      if (i === 0) unit.push({ x: 0, y: 0 });
      else if (gr.contact === -1) unit.push({ ...unit[gr.parent] });
      else {
        const d = pitchRadius(TRAIN[gr.parent].z, 1) + pitchRadius(gr.z, 1);
        unit.push({ x: unit[gr.parent].x + Math.cos(gr.contact) * d, y: unit[gr.parent].y + Math.sin(gr.contact) * d });
      }
    });
    const ext = TRAIN.map((gr, i) => ({ x0: unit[i].x - gr.z / 2 - 1, x1: unit[i].x + gr.z / 2 + 1, y0: unit[i].y - gr.z / 2 - 1, y1: unit[i].y + gr.z / 2 + 1 }));
    const bx0 = Math.min(...ext.map((e) => e.x0));
    const bx1 = Math.max(...ext.map((e) => e.x1));
    const by0 = Math.min(...ext.map((e) => e.y0));
    const by1 = Math.max(...ext.map((e) => e.y1));
    const areaW = c.body ? W * 0.7 : W * 0.5;
    const areaH = c.body ? H * 0.7 : H * 1.05;
    const m = Math.min(areaW / (bx1 - bx0), areaH / (by1 - by0));
    const offX = (c.body ? W * 0.5 : W * 0.6) - ((bx0 + bx1) / 2) * m;
    const offY = H * 0.5 - ((by0 + by1) / 2) * m;
    const pos = unit.map((p) => ({ x: offX + p.x * m, y: offY + p.y * m }));
    const sprites: GearSprite[] = TRAIN.map((gr) => makeGearSprite({ z: gr.z, m, mat: gr.mat, spokes: gr.spokes }, S, rand));
    const { k, c: phase0 } = solveTrain(TRAIN.map((gr) => ({ z: gr.z, parent: gr.parent, contact: gr.contact })));
    const painter = createGearPainter(light);

    // The plate: brushed dark steel, screws, the lamp's warm pool, bushings under every shaft.
    const plate = document.createElement('canvas');
    plate.width = Math.ceil(W * S);
    plate.height = Math.ceil(H * S);
    {
      const g = plate.getContext('2d')!;
      g.scale(S, S);
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, plateLight);
      gr.addColorStop(1, plateDark);
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
      for (let y = 0; y < H; y += 1 + rand() * 1.5) {
        g.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.05)';
        g.fillRect(0, y, W, 0.6 + rand());
      }
      const lamp = g.createRadialGradient(W * 0.62, -H * 0.3, 0, W * 0.62, -H * 0.3, Math.max(W, H) * 0.75);
      lamp.addColorStop(0, rgba(lampCol, 0.3));
      lamp.addColorStop(0.5, rgba(lampCol, 0.08));
      lamp.addColorStop(1, 'rgba(0,0,0,0.35)');
      g.fillStyle = lamp;
      g.fillRect(0, 0, W, H);
      const screw = (x: number, y: number, r: number) => {
        const sg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
        sg.addColorStop(0, '#d8dce0');
        sg.addColorStop(1, '#4a5058');
        g.fillStyle = sg;
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.fill();
        g.strokeStyle = 'rgba(20,20,24,0.8)';
        g.lineWidth = r * 0.3;
        const a = rand() * Math.PI;
        g.beginPath();
        g.moveTo(x - Math.cos(a) * r * 0.7, y - Math.sin(a) * r * 0.7);
        g.lineTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7);
        g.stroke();
      };
      const sr = Math.max(3, m * 1.2);
      for (const [x, y] of [[W * 0.36, sr * 2.5], [W - sr * 2.5, sr * 2.5], [W * 0.36, H - sr * 2.5], [W - sr * 2.5, H - sr * 2.5]]) screw(x, y, sr);
      pos.forEach((p, i) => {
        if (TRAIN[i].contact === -1) return;
        const r = m * 3.2;
        const bg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 1.8);
        bg.addColorStop(0, 'rgba(0,0,0,0.5)');
        bg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = bg;
        g.beginPath();
        g.arc(p.x, p.y, r * 1.8, 0, TAU);
        g.fill();
      });
    }

    // The price counter: odometer drums in a window, driven off the last pinion.
    const last = pos[pos.length - 1];
    const drumH = Math.max(14, m * 6.5);
    const drumW = drumH * 0.7;
    const drums = 4;
    const winW = drumW * (drums + 1.7);
    const counter = c.body
      ? { x: W * 0.5 - winW / 2, y: H * 0.85 }
      : { x: W - winW - 12, y: clamp(last.y - pitchRadius(TRAIN[TRAIN.length - 1].z, m) - drumH * 1.1, drumH, H - drumH) };

    let phi = 0;
    let omega = 0.35;
    let grab: { i: number; angle: number; phi: number } | null = null;
    let prevPhi = 0;
    let travelled = 0;
    let clock = 0;
    const motes = Array.from({ length: 18 }, () => ({ x: rand() * W, y: rand() * H, v: 2 + rand() * 5, ph: rand() * TAU }));

    const angleAt = (i: number, x: number, y: number) => Math.atan2(y - pos[i].y, x - pos[i].x);
    const unwrap = (a: number, ref: number) => a + TAU * Math.round((ref - a) / TAU);

    return {
      update(dt, _t, p) {
        const sdt = Math.min(dt, 0.05);
        clock += sdt;
        const idle = 0.35 * clamp(c.params.speed, 0, 3);
        if (p.active && p.clicked && c.params.react > 0) {
          for (let i = TRAIN.length - 1; i >= 0; i -= 1) {
            const r = pitchRadius(TRAIN[i].z, m) + m;
            if (Math.hypot(p.rawX - pos[i].x, p.rawY - pos[i].y) < r) {
              grab = { i, angle: angleAt(i, p.rawX, p.rawY), phi };
              break;
            }
          }
        }
        if (grab && (!p.pressed || !p.active)) grab = null;
        prevPhi = phi;
        if (grab) {
          // The grabbed gear follows the hand; the rest of the train follows it.
          const a = unwrap(angleAt(grab.i, p.rawX, p.rawY), grab.angle);
          const target = grab.phi + (a - grab.angle) / k[grab.i];
          grab.angle = a;
          grab.phi = target;
          phi += (target - phi) * Math.min(1, sdt * 30);
          omega = (phi - prevPhi) / Math.max(sdt, 1e-3);
        } else {
          omega += (idle - omega) * Math.min(1, sdt * 0.7);
          phi += omega * sdt;
        }
        travelled += Math.abs(phi - prevPhi);
        for (const mo of motes) {
          mo.y -= mo.v * sdt;
          mo.x += Math.sin(clock * 0.5 + mo.ph) * 3 * sdt;
          if (mo.y < -4) {
            mo.y = H + 4;
            mo.x = rand() * W;
          }
        }
      },
      draw(g) {
        g.drawImage(plate, 0, 0, W, H);
        const order = TRAIN.map((_, i) => i).sort((a, b) => TRAIN[a].level - TRAIN[b].level);
        for (const i of order) {
          const ang = phase0[i] + k[i] * phi;
          painter.shadow(g, sprites[i], pos[i].x + m * (1.5 + TRAIN[i].level * 1.5), pos[i].y + m * (2 + TRAIN[i].level * 1.5), ang, 0, 0.6);
        }
        for (const i of order) painter.gear(g, sprites[i], pos[i].x, pos[i].y, phase0[i] + k[i] * phi, TRAIN[i].mat);

        // The counter window with its drums; each drum carries into the next in the last tenth of its turn.
        const cents = Math.floor(travelled / TAU * 125) % 10000;
        const frac = ((travelled / TAU) * 125) % 1;
        const { x: wx, y: wy } = counter;
        g.save();
        g.shadowColor = 'rgba(0,0,0,0.6)';
        g.shadowBlur = 8;
        g.fillStyle = '#101216';
        g.beginPath();
        g.roundRect(wx - 4, wy - drumH * 0.72, winW + 8, drumH * 1.44, 5);
        g.fill();
        g.restore();
        g.strokeStyle = rgba(BRASS.base, 0.8);
        g.lineWidth = 1.5;
        g.stroke();
        g.font = `700 ${Math.round(drumH * 0.72)}px "Segoe UI", system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = rgba(digitGlow, 0.9);
        g.fillText('€', wx + drumW * 0.55, wy);
        for (let d = 0; d < drums; d += 1) {
          const place = 10 ** (drums - 1 - d);
          const digit = Math.floor(cents / place) % 10;
          // How far this drum has rolled towards the next digit.
          const lower = cents % place;
          const roll = place === 1 ? frac : lower === place - 1 ? clamp((frac - 0.9) / 0.1, 0, 1) : 0;
          const x = wx + drumW * 1.3 + d * drumW + (d >= drums - 2 ? drumW * 0.25 : 0);
          g.save();
          g.beginPath();
          g.rect(x + 1, wy - drumH / 2, drumW - 2, drumH);
          g.clip();
          const dg = g.createLinearGradient(0, wy - drumH / 2, 0, wy + drumH / 2);
          dg.addColorStop(0, '#6a6e74');
          dg.addColorStop(0.5, '#f2f0ea');
          dg.addColorStop(1, '#6a6e74');
          g.fillStyle = dg;
          g.fillRect(x + 1, wy - drumH / 2, drumW - 2, drumH);
          g.fillStyle = '#16181c';
          for (const q of [0, 1]) g.fillText(String((digit + q) % 10), x + drumW / 2, wy + (q - roll) * drumH * 0.95);
          const shade = g.createLinearGradient(0, wy - drumH / 2, 0, wy + drumH / 2);
          shade.addColorStop(0, 'rgba(0,0,0,0.55)');
          shade.addColorStop(0.3, 'rgba(0,0,0,0)');
          shade.addColorStop(0.7, 'rgba(0,0,0,0)');
          shade.addColorStop(1, 'rgba(0,0,0,0.55)');
          g.fillStyle = shade;
          g.fillRect(x + 1, wy - drumH / 2, drumW - 2, drumH);
          g.restore();
        }
        g.fillStyle = '#f2f0ea';
        g.beginPath();
        g.arc(wx + drumW * 1.3 + (drums - 2) * drumW + drumW * 0.12, wy + drumH * 0.36, Math.max(1.2, drumH * 0.06), 0, TAU);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.fillRect(wx, wy - drumH * 0.5, winW, drumH * 0.16);

        // Dust in the lamp light.
        g.globalCompositeOperation = 'lighter';
        for (const mo of motes) {
          const a = 0.25 + 0.2 * Math.sin(clock * 2 + mo.ph);
          g.fillStyle = rgba(lampCol, a * 0.5);
          g.fillRect(mo.x, mo.y, 1.3, 1.3);
        }
        g.globalCompositeOperation = 'source-over';
      },
    };
  },
};
