import type { CanvasSceneDef, SceneParams } from './types';
import { clamp } from './kit';
import { createFogRenderer, DROP_FLOATS, MAX_DROPS, type FogRenderer } from './foggedGlassGL';
import { createOrbit } from './orbitControl';
import { BLACKHEADS_PHOTO, foggedPhotoSource } from './foggedPhotoSource';

/**
 * An experimental effect: a misted window at night over the whole screen (foggedGlassGL.ts): through clear glass the
 * street is sharp (houses, stars, cars, lamps), through the mist blurred. Drops sit on the glass, grow, and now and
 * then one runs down — in jerks, swerving, merging with the ones it meets (it swallows them: grows, is pulled
 * towards them, catches a moment and goes on faster), leaving a clear wet trail with fine droplets in it; through a
 * drop the lights are seen bent. A drag wipes the mist off (unevenly, in streaks), leaving smears that catch the
 * lamps' light; the drops under the cloth are not taken away but pushed to the edges of its stroke, broken into
 * smaller ones; the mist slowly comes back.
 *
 * The drops are simulated here: a list of up to MAX_DROPS (x, y, radius in css px), sitting ones growing slowly
 * (condensation), a big one running down at a speed that grows with its size, stopping and going (stick-slip),
 * shedding small droplets behind it as it goes (and thinning), merging with what it touches (volumes add).
 */

type NumberKey = { [K in keyof SceneParams]: SceneParams[K] extends number ? K : never }[keyof SceneParams];

/** How the street is made (fgStreet): live, baked (still parts once, moving ones each frame), a looped video. */
export const FOG_STREET_MODES = ['Живая', 'Запечённая', 'Видео'];

/** The ⚙ panel's tabs. */
export const FOGGED_GLASS_TABS = [
  { id: 'glass', label: 'Стекло и капли' },
  { id: 'street', label: 'Улица' },
] as const;
type Tab = (typeof FOGGED_GLASS_TABS)[number]['id'];

export const FOGGED_GLASS_SETTINGS: readonly { key: NumberKey; label: string; min: number; max: number; step: number; tab: Tab }[] = [
  { key: 'fgFog', label: 'Запотевание', min: 0, max: 1, step: 0.02, tab: 'glass' },
  { key: 'fgBlur', label: 'Размытие тумана', min: 0, max: 2, step: 0.05, tab: 'glass' },
  { key: 'fgVeil', label: 'Молочность тумана', min: 0, max: 3, step: 0.05, tab: 'glass' },
  { key: 'fgGrain', label: 'Зернистость тумана', min: 0, max: 1, step: 0.05, tab: 'glass' },
  { key: 'fgRegrow', label: 'Скорость запотевания', min: 0, max: 0.4, step: 0.01, tab: 'glass' },
  { key: 'fgTrail', label: 'Следы капель держатся', min: 0, max: 0.9, step: 0.05, tab: 'glass' },
  { key: 'fgDrops', label: 'Капли', min: 0, max: 3, step: 0.05, tab: 'glass' },
  { key: 'fgDropSize', label: 'Размер капель', min: 0.5, max: 2, step: 0.05, tab: 'glass' },
  { key: 'fgWipe', label: 'Ширина протирки, px', min: 20, max: 160, step: 1, tab: 'glass' },
  { key: 'fgSmudge', label: 'Разводы', min: 0, max: 2, step: 0.05, tab: 'glass' },
  { key: 'fgRes', label: 'Разрешение (нагрузка)', min: 0.4, max: 1, step: 0.05, tab: 'glass' },
  { key: 'fgLights', label: 'Огни', min: 0.3, max: 3, step: 0.05, tab: 'street' },
  { key: 'fgFocus', label: 'Улица: размытие (фокус)', min: 0, max: 1, step: 0.02, tab: 'street' },
  { key: 'fgBokeh', label: 'Размер огней (боке)', min: 0.5, max: 2, step: 0.05, tab: 'street' },
  { key: 'fgTraffic', label: 'Машины', min: 0, max: 2, step: 0.05, tab: 'street' },
  { key: 'fgPuddles', label: 'Лужи на асфальте', min: 0, max: 1.5, step: 0.05, tab: 'street' },
  { key: 'fgExposure', label: 'Экспозиция', min: 0.4, max: 3, step: 0.05, tab: 'street' },
];

/** A drop: centre and radius (of the round drop of the same water, css px), speed, a hold (stick-slip), running or
 * sitting, the distance to its next shed droplet; a strand smeared by the cloth has an axis (ang) and an elongation e. */
type Drop = { x: number; y: number; r: number; vx: number; vy: number; hold: number; moving: boolean; shed: number; ang: number; e: number };

function foggedGlass(photoUrl?: string): CanvasSceneDef { return {
  kind: 'canvas',
  id: 'fogged-glass',
  label: 'Запотевшее стекло, капли и огни города',
  palettes: [['#05060a']],
  create(c) {
    const W = c.width;
    const H = c.height;
    let renderer: FogRenderer | null = null;
    let failed = '';
    let resNow = 0;
    const make = () => {
      renderer?.dispose();
      renderer = null;
      try {
        const s = clamp(c.params.fgRes, 0.4, 1) * Math.min(c.dpr, 1.5);
        const source = foggedPhotoSource(photoUrl, W, H, window.devicePixelRatio);
        renderer = createFogRenderer(Math.max(64, Math.round(W * s)), Math.max(64, Math.round(H * s)), W, H, source);
        if (!renderer) failed = 'нужен WebGL2 с float-текстурами';
      } catch (e) {
        failed = e instanceof Error ? e.message.slice(0, 200) : String(e);
      }
      resNow = c.params.fgRes;
    };
    make();
    const rand = c.rand;
    const drops: Drop[] = [];
    const data = new Float32Array(MAX_DROPS * DROP_FLOATS);
    const size = () => clamp(c.params.fgDropSize, 0.3, 3);
    const add = (x: number, y: number, r: number) => {
      if (drops.length >= MAX_DROPS) return;
      drops.push({ x, y, r, vx: 0, vy: 0, hold: 0, moving: false, shed: 0, ang: 0, e: 1 });
    };
    // Some drops from the start, a few big ones ready to run.
    for (let i = 0; i < Math.round((W * H) / 9000); i += 1) add(rand() * W, rand() * H, (1.2 + 3.5 * rand() ** 2) * size());
    for (let i = 0; i < 3; i += 1) add(rand() * W, rand() * H * 0.5, (5 + 3 * rand()) * size());
    let clock = 0;
    // Where the glass was wiped and when (a grid of 16 px cells): no condensation drops are born there until it has
    // misted over again (they used to appear on freshly wiped glass at once).
    const CELL = 16;
    const gw = Math.ceil(W / CELL) + 1, gh = Math.ceil(H / CELL) + 1;
    const wipedAt = new Float32Array(gw * gh).fill(-1e9);
    const freshlyWiped = (x: number, y: number) => {
      const i = clamp(Math.floor(y / CELL), 0, gh - 1) * gw + clamp(Math.floor(x / CELL), 0, gw - 1);
      return clock - wipedAt[i] < 25 / Math.max(0.2, c.params.fgRegrow / 0.03);
    };
    let last: [number, number] | null = null;
    let wipe = { a: [0, 0] as [number, number], b: [0, 0] as [number, number], r: 50, on: false };
    let hint = 1;
    // The ⚙ panel.
    let panelOpen = false;
    let tab: Tab = 'glass';
    let dragKey: NumberKey | null = null;
    const gear = { x: 10, y: 10, s: 28 };
    const PW = Math.min(W - 20, 350);
    const ROW = 26;
    const TAB_H = 30;
    const panelX = 10;
    const panelY = 46;
    const trackX = panelX + 182;
    const trackW = PW - 182 - 50;
    const settingsOf = () => FOGGED_GLASS_SETTINGS.filter((q) => q.tab === tab);
    // On the street tab, first a row of buttons: how the street is made.
    const CH = 32;
    const choicesH = () => (tab === 'street' ? CH + 4 : 0);
    const panelH = () => TAB_H + choicesH() + settingsOf().length * ROW + 12;
    const modeBtn = (i: number) => {
      const x0 = panelX + 66;
      const w = (PW - 66 - 8 - 6 * (FOG_STREET_MODES.length - 1)) / FOG_STREET_MODES.length;
      return { x: x0 + i * (w + 6), y: panelY + TAB_H + 6, w, h: CH - 6 };
    };
    const inPanel = (x: number, y: number) => panelOpen && x >= panelX && x <= panelX + PW && y >= panelY && y <= panelY + panelH();
    const panelRow = (x: number, y: number) => {
      if (!inPanel(x, y) || y < panelY + TAB_H + choicesH()) return -1;
      return clamp(Math.floor((y - panelY - TAB_H - choicesH() - 6) / ROW), 0, settingsOf().length - 1);
    };
    const tabBtn = (i: number) => {
      const w = (PW - 16 - 6 * (FOGGED_GLASS_TABS.length - 1)) / FOGGED_GLASS_TABS.length;
      return { x: panelX + 8 + i * (w + 6), y: panelY + 6, w, h: TAB_H - 8 };
    };
    const setFromX = (key: NumberKey, x: number) => {
      const st = FOGGED_GLASS_SETTINGS.find((q) => q.key === key)!;
      const v = st.min + clamp((x - trackX) / trackW, 0, 1) * (st.max - st.min);
      c.params[key] = Math.round(v / st.step) * st.step;
    };

    const stepDrops = (dt: number) => {
      const k = size();
      // New drops: small ones condensing everywhere, now and then a bigger one.
      const rate = c.params.fgDrops * ((W * H) / 1e6) * 9;
      let n = rate * dt;
      while (n > 0) {
        if (rand() < n) {
          const x = rand() * W, y = rand() * H;
          if (!freshlyWiped(x, y)) add(x, y, (0.9 + 2.2 * rand() ** 2) * k);
        }
        n -= 1;
      }
      if (rand() < c.params.fgDrops * 0.15 * dt) {
        const x = rand() * W, y = rand() * H * 0.6;
        if (!freshlyWiped(x, y)) add(x, y, (4.5 + 3 * rand()) * k);
      }
      const slide = 5.8 * k;
      for (const d of drops) {
        if (d.e > 1) d.e = 1 + (d.e - 1) * Math.exp(-dt * (d.moving ? 3 : 0.04));
        if (!d.moving) {
          // Condensation: sitting drops grow, slowly; a heavy one breaks away.
          d.r += dt * 0.05 * k * (d.r < 3 * k ? 1 : 0.3);
          if (d.r > slide) {
            d.moving = true;
            d.vy = 0;
          }
          continue;
        }
        if (d.hold > 0) {
          d.hold -= dt;
          d.vy *= 0.5;
        } else {
          // Faster the bigger it is; it catches now and then (stick-slip) and swerves. One much bigger than an
          // ordinary drop (2.5× its 2.4 px) is heavy: it speeds up hard and does not catch.
          const big = Math.max(0, d.r / (2.5 * 2.4 * k) - 1);
          const vmax = (35 + 16 * d.r / k) * (0.8 + 0.4 * rand()) * (1 + 1.8 * big);
          d.vy += (vmax - d.vy) * Math.min(1, dt * (6 + 12 * big));
          d.vx += (rand() - 0.5) * 120 * dt - d.vx * dt * 4;
          if (big <= 0 && rand() < dt * 1.1) d.hold = 0.05 + 0.5 * rand() * rand();
        }
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        // It leaves droplets behind as it goes, thinning.
        d.shed -= d.vy * dt;
        if (d.shed <= 0) {
          d.shed = 6 + 18 * rand();
          const rr = (0.7 + 1.1 * rand()) * k;
          add(d.x + (rand() - 0.5) * d.r * 0.8, d.y - d.r * (1 + rand()), rr);
          d.r = Math.cbrt(Math.max(d.r ** 3 - rr ** 3 * 0.8, 1));
          if (d.r < slide * 0.62) d.moving = false;
        }
      }
      // A running drop takes in the drops it touches: volumes add, the merged drop sits at their common centre (it
      // is pulled sideways towards the one it met), catches a moment, then goes on faster for its weight; a big one
      // it meets may start it running too.
      for (let i = 0; i < drops.length; i += 1) {
        const a = drops[i];
        if (!a.moving || a.r <= 0) continue;
        for (let j = 0; j < drops.length; j += 1) {
          if (i === j) continue;
          const b = drops[j];
          if (b.r <= 0) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const rr = (a.r + b.r) * 0.85;
          if (dx * dx + dy * dy < rr * rr) {
            const va = a.r ** 3, vb = b.r ** 3;
            a.x = (a.x * va + b.x * vb) / (va + vb);
            a.y = (a.y * va + b.y * vb) / (va + vb);
            a.r = Math.cbrt(va + vb);
            a.e = 1;
            a.vx += (dx / Math.max(1, Math.hypot(dx, dy))) * 20 * vb / (va + vb);
            if (vb > va * 0.15) a.hold = Math.max(a.hold, 0.06 + 0.1 * rand());
            b.r = 0;
          }
        }
      }
      for (let i = drops.length - 1; i >= 0; i -= 1) {
        const d = drops[i];
        if (d.r <= 0 || d.y - d.r > H + 4) drops.splice(i, 1);
      }
    };

    // The camera: the eye moves before the glass (the street far behind it shifts), the wheel looks closer.
    const orbit = createOrbit(c, { pitch: [-40, 40], zoom: [1, 3] });

    return {
      isControlPoint: (x, y) => inPanel(x, y) || (x >= gear.x && x <= gear.x + gear.s && y >= gear.y && y <= gear.y + gear.s),
      update(dt, _t, pIn) {
        const p = orbit.update(pIn);
        const sdt = Math.min(dt, 1 / 20);
        clock += sdt;
        if (dragKey && p.pressed) setFromX(dragKey, p.rawX);
        if (!p.pressed) {
          if (dragKey === 'fgRes' || (!dragKey && resNow !== c.params.fgRes)) make();
          dragKey = null;
        }
        const onGear = p.rawX >= gear.x && p.rawX <= gear.x + gear.s && p.rawY >= gear.y && p.rawY <= gear.y + gear.s;
        const overPanel = inPanel(p.rawX, p.rawY) || onGear;
        if (p.clicked) {
          const row = panelRow(p.rawX, p.rawY);
          if (onGear) panelOpen = !panelOpen;
          else if (inPanel(p.rawX, p.rawY) && p.rawY < panelY + TAB_H) {
            FOGGED_GLASS_TABS.forEach((t, i) => {
              const b = tabBtn(i);
              if (p.rawX >= b.x && p.rawX <= b.x + b.w) tab = t.id;
            });
          } else if (inPanel(p.rawX, p.rawY) && p.rawY < panelY + TAB_H + choicesH()) {
            FOG_STREET_MODES.forEach((_, i) => {
              const b = modeBtn(i);
              if (p.rawX >= b.x && p.rawX <= b.x + b.w && p.rawY >= b.y && p.rawY <= b.y + b.h) c.params.fgStreet = i;
            });
          } else if (row >= 0) {
            dragKey = settingsOf()[row].key;
            setFromX(dragKey, p.rawX);
          }
        }
        stepDrops(sdt);
        // The wipe: a drag (not on the panel) from where the cursor was to where it is.
        const here: [number, number] = [p.rawX, p.rawY];
        const wiping = p.pressed && !dragKey && !overPanel;
        wipe = { a: last ?? here, b: here, r: c.params.fgWipe, on: wiping };
        if (wiping) {
          hint = 0;
          // The finger is soft (owner: «палец мягко, самими краями расталкивает каплю»): its edge pushes each drop it
          // meets out of its way, only as far as it reaches into it (the finger moves on gradually, so the drop eases out) — the
          // front shoves water ahead, the sides push it out sideways — and a shoved drop smears a little along the
          // stroke (longer, thinner; its water kept). Drops shoved together merge: water piles up at the edge and, heavy
          // enough, runs.
          // As wide as the mist the shader takes off (its brush: radius fgWipe, fully clear inside ~0.55 of it).
          const R = c.params.fgWipe * 0.8;
          const ax = wipe.a[0], ay = wipe.a[1], bx = here[0], by = here[1];
          const vx = bx - ax, vy = by - ay;
          const tx = Math.hypot(vx, vy) > 1e-3 ? vx / Math.hypot(vx, vy) : 1, ty = Math.hypot(vx, vy) > 1e-3 ? vy / Math.hypot(vx, vy) : 0;
          const pushed: Drop[] = [];
          // Mark the cells under this stroke as freshly wiped.
          {
            const steps = Math.max(1, Math.ceil(Math.hypot(vx, vy) / (CELL * 0.5)));
            for (let s = 0; s <= steps; s += 1) {
              const px = ax + (vx * s) / steps, py = ay + (vy * s) / steps;
              for (let gy = Math.floor((py - R) / CELL); gy <= Math.floor((py + R) / CELL); gy += 1) {
                for (let gx = Math.floor((px - R) / CELL); gx <= Math.floor((px + R) / CELL); gx += 1) {
                  if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) continue;
                  if (Math.hypot((gx + 0.5) * CELL - px, (gy + 0.5) * CELL - py) < R * 0.9) wipedAt[gy * gw + gx] = clock;
                }
              }
            }
          }
          for (const d of drops) {
            if (d.r <= 0) continue;
            const h = clamp(((d.x - ax) * vx + (d.y - ay) * vy) / Math.max(vx * vx + vy * vy, 1e-6), 0, 1);
            const ox = d.x - (ax + vx * h), oy = d.y - (ay + vy * h);
            const dist = Math.hypot(ox, oy);
            const reach = R + d.r * 0.6;
            if (dist >= reach) continue;
            // Out from the finger's middle (dead centre: sideways).
            const nx = dist > 0.5 ? ox / dist : -ty * (rand() < 0.5 ? 1 : -1);
            const ny = dist > 0.5 ? oy / dist : tx * (nx === -ty ? 1 : -1);
            const push = reach - dist;
            d.x += nx * push;
            d.y += ny * push;
            if (!d.moving) {
              d.ang = Math.atan2(ty, tx);
              d.e = Math.min(3, d.e + (push / Math.max(d.r, 1)) * 0.1);
            }
            pushed.push(d);
          }
          for (const a of pushed) {
            if (a.r <= 0) continue;
            for (const b of drops) {
              if (b === a || b.r <= 0) continue;
              const dx = b.x - a.x, dy = b.y - a.y;
              const rr = (a.r + b.r) * 0.7;
              if (dx * dx + dy * dy > rr * rr) continue;
              const va = a.r ** 3, vb = b.r ** 3;
              a.x = (a.x * va + b.x * vb) / (va + vb);
              a.y = (a.y * va + b.y * vb) / (va + vb);
              a.r = Math.cbrt(va + vb);
              a.e = Math.max(1, (a.e * va + b.e * vb) / (va + vb));
              b.r = 0;
            }
          }
          last = here;
        } else {
          last = null;
        }
        if (!p.pressed) last = null;
        hint = Math.max(0, hint - sdt * 0.02);
      },
      draw(g) {
        if (renderer) {
          const count = Math.min(drops.length, MAX_DROPS);
          for (let i = 0; i < count; i += 1) {
            const d = drops[i];
            const o = i * DROP_FLOATS;
            data[o] = d.x;
            data[o + 1] = d.y;
            data[o + 2] = Math.max(0.5, d.r);
            data[o + 3] = d.moving && d.hold <= 0 ? 1 + clamp(d.vy / 260, 0, 0.5) : 1;
            data[o + 4] = d.ang;
            data[o + 5] = d.e;
          }
          renderer.render({
            time: clock,
            fogMax: c.params.fgFog,
            regrow: c.params.fgRegrow,
            wipe,
            smudge: c.params.fgSmudge,
            lights: c.params.fgLights,
            bokeh: c.params.fgBokeh,
            traffic: c.params.fgTraffic,
            exposure: c.params.fgExposure,
            focus: c.params.fgFocus,
            blur: c.params.fgBlur,
            veil: c.params.fgVeil,
            grain: c.params.fgGrain,
            trail: c.params.fgTrail,
            puddles: c.params.fgPuddles,
            street: c.params.fgStreet,
            cam: [0.07 * Math.sin(orbit.yaw), 0.05 * Math.sin(orbit.pitch), orbit.zoom],
          }, data, count, 1 / 60);
          g.drawImage(renderer.canvas, 0, 0, W, H);
        } else {
          g.fillStyle = '#05060a';
          g.fillRect(0, 0, W, H);
          g.fillStyle = '#e9e2cf';
          g.font = '14px sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(failed ? `Не удалось запустить: ${failed}` : 'Загрузка…', W / 2, H / 2);
        }
        g.textBaseline = 'middle';
        g.fillStyle = panelOpen ? 'rgba(58,42,14,0.94)' : 'rgba(10,10,14,0.66)';
        g.strokeStyle = panelOpen ? '#ffd27a' : 'rgba(255,255,255,0.3)';
        g.lineWidth = 1;
        g.beginPath();
        g.roundRect(gear.x, gear.y, gear.s, gear.s, 7);
        g.fill();
        g.stroke();
        g.fillStyle = panelOpen ? '#ffd27a' : '#f6eee0';
        g.font = '17px sans-serif';
        g.textAlign = 'center';
        g.fillText('⚙', gear.x + gear.s / 2, gear.y + gear.s / 2 + 1);
        if (panelOpen) {
          g.fillStyle = 'rgba(10,10,14,0.86)';
          g.strokeStyle = 'rgba(255,255,255,0.18)';
          g.beginPath();
          g.roundRect(panelX, panelY, PW, panelH(), 9);
          g.fill();
          g.stroke();
          g.font = '12px sans-serif';
          FOGGED_GLASS_TABS.forEach((t, i) => {
            const b = tabBtn(i);
            const on = t.id === tab;
            g.fillStyle = on ? 'rgba(159,211,224,0.28)' : 'rgba(255,255,255,0.06)';
            g.strokeStyle = on ? '#9fd3e0' : 'rgba(255,255,255,0.18)';
            g.beginPath();
            g.roundRect(b.x, b.y, b.w, b.h, 6);
            g.fill();
            g.stroke();
            g.fillStyle = on ? '#dff4fa' : '#f6eee0';
            g.textAlign = 'center';
            g.fillText(t.label, b.x + b.w / 2, b.y + b.h / 2 + 1, b.w - 4);
          });
          g.font = '13px sans-serif';
          if (tab === 'street') {
            g.textAlign = 'left';
            g.fillStyle = '#f6eee0';
            g.fillText('Улица', panelX + 12, panelY + TAB_H + 6 + (CH - 6) / 2);
            g.font = '12px sans-serif';
            FOG_STREET_MODES.forEach((label, i) => {
              const b = modeBtn(i);
              const on = Math.round(c.params.fgStreet) === i;
              g.fillStyle = on ? 'rgba(159,211,224,0.28)' : 'rgba(255,255,255,0.07)';
              g.strokeStyle = on ? '#9fd3e0' : 'rgba(255,255,255,0.2)';
              g.beginPath();
              g.roundRect(b.x, b.y, b.w, b.h, 6);
              g.fill();
              g.stroke();
              g.fillStyle = on ? '#dff4fa' : '#f6eee0';
              g.textAlign = 'center';
              g.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 1, b.w - 4);
            });
            g.font = '13px sans-serif';
          }
          const sts = settingsOf();
          for (let i = 0; i < sts.length; i += 1) {
            const st = sts[i];
            const y = panelY + TAB_H + choicesH() + 6 + i * ROW + ROW / 2;
            const v = c.params[st.key];
            g.textAlign = 'left';
            g.fillStyle = '#f6eee0';
            g.fillText(st.label, panelX + 12, y);
            const fr = clamp((v - st.min) / (st.max - st.min), 0, 1);
            g.fillStyle = 'rgba(255,255,255,0.18)';
            g.fillRect(trackX, y - 2, trackW, 4);
            g.fillStyle = '#9fd3e0';
            g.fillRect(trackX, y - 2, trackW * fr, 4);
            g.beginPath();
            g.arc(trackX + trackW * fr, y, dragKey === st.key ? 7 : 6, 0, Math.PI * 2);
            g.fill();
            g.textAlign = 'right';
            g.fillStyle = 'rgba(246,238,224,0.8)';
            g.fillText(v.toFixed(st.step < 0.1 ? 2 : st.step < 1 ? 1 : 0), panelX + PW - 10, y);
          }
        }
        if (hint > 0 && !panelOpen) {
          const text = 'Проведите с зажатой кнопкой — протрёте стекло';
          g.font = '12.5px sans-serif';
          const tw = g.measureText(text).width + 16;
          g.globalAlpha = Math.min(1, hint * 3);
          g.fillStyle = 'rgba(10,10,14,0.7)';
          g.beginPath();
          g.roundRect(46, 12, tw, 24, 7);
          g.fill();
          g.textAlign = 'left';
          g.fillStyle = '#f6eee0';
          g.fillText(text, 54, 25);
          g.globalAlpha = 1;
        }
        orbit.draw(g);
      },
      dispose() {
        orbit.dispose();
        renderer?.dispose();
      },
    };
  },
}; }

export const FOGGED_GLASS = foggedGlass();
export const FOGGED_BLACKHEADS: CanvasSceneDef = {
  ...foggedGlass(BLACKHEADS_PHOTO),
  id: 'fogged-blackheads', label: 'Дом Черноголовых за запотевшим стеклом',
  defaultParams: { fgFog: .46, fgVeil: .8, fgBlur: .7, fgLights: 1.4 },
};
