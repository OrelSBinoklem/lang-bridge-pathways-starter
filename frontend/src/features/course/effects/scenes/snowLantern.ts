import type { CanvasSceneDef, SceneParams } from './types';
import { clamp } from './kit';
import { createSnowLantern, type LanternBake, type LanternLook, type SnowLantern } from './snowLanternGL';
import { LANTERN_MODELS } from './snowLanternModels';
import { createOrbit } from './orbitControl';

/**
 * An experimental effect: a New Year snow-globe lantern (snowLanternGL.ts) after the owner's photos — a bronze one with
 * a tree and snowy houses, a teal-and-copper one with a barn and deer, or a stepped arch of LED candles with a little
 * window of water. The lantern's light is baked by ray tracing (it shows as it bakes); the glitter is alive: a pump
 * sends it up the walls, along the top, it falls like snow and is drawn back into the jets. A click shakes the lantern,
 * a drag stirs the water. ⚙ (not on a page's background) and the debug panel: the settings.
 *
 * «Пара» (owner: «эффект на весь экран, чтобы один фонарь был слева экрана, а другой справа»; the default): the bronze
 * lantern on the left and the teal one on the right, each its own renderer 62 % of the width wide, the right one faded
 * in over the middle (their rooms differ, so no seam); a click or a drag goes to the lantern under the pointer, the
 * camera turns both.
 */
/** In the pair: each renderer's share of the width (they overlap in the middle by 2·SHARE − 1). */
const SHARE = 0.62;

type NumberKey = { [K in keyof SceneParams]: SceneParams[K] extends number ? K : never }[keyof SceneParams];

export const SNOW_LANTERN_TABS = [
  { id: 'lantern', label: 'Фонарь' },
  { id: 'glitter', label: 'Блёстки' },
  { id: 'bake', label: 'Запекание' },
] as const;
type Tab = (typeof SNOW_LANTERN_TABS)[number]['id'];

export const SNOW_LANTERN_SETTINGS: readonly { key: NumberKey; label: string; min: number; max: number; step: number; tab: Tab }[] = [
  { key: 'nlLight', label: 'Свет фонаря', min: 0, max: 2.5, step: 0.05, tab: 'lantern' },
  { key: 'nlFlicker', label: 'Мерцание свечей', min: 0, max: 2.5, step: 0.05, tab: 'lantern' },
  { key: 'nlBloom', label: 'Ореол (bloom)', min: 0, max: 3, step: 0.05, tab: 'lantern' },
  { key: 'nlExposure', label: 'Экспозиция', min: 0.4, max: 3, step: 0.05, tab: 'lantern' },
  { key: 'nlGlitter', label: 'Сколько блёсток', min: 0, max: 3, step: 0.05, tab: 'glitter' },
  { key: 'nlSize', label: 'Размер блёсток', min: 0.4, max: 2.5, step: 0.05, tab: 'glitter' },
  { key: 'nlSnow', label: 'Доля снега (белые)', min: 0, max: 1, step: 0.05, tab: 'glitter' },
  { key: 'nlPumpSpeed', label: 'Насос: напор', min: 0, max: 2.5, step: 0.05, tab: 'glitter' },
  { key: 'nlSwirl', label: 'Завихрения', min: 0, max: 2.5, step: 0.05, tab: 'glitter' },
  { key: 'nlSettle', label: 'Тяжесть (как быстро падают)', min: 0.1, max: 3, step: 0.05, tab: 'glitter' },
  { key: 'nlSparkle', label: 'Блеск', min: 0, max: 3, step: 0.05, tab: 'glitter' },
  { key: 'nlRoom', label: 'Свет в комнате', min: 0, max: 2.5, step: 0.05, tab: 'bake' },
  { key: 'nlZoom', label: 'Приближение', min: 0.6, max: 2, step: 0.05, tab: 'bake' },
  { key: 'nlSamples', label: 'Лучей на пиксель', min: 2, max: 128, step: 1, tab: 'bake' },
  { key: 'nlRes', label: 'Разрешение', min: 0.4, max: 1, step: 0.05, tab: 'bake' },
];

export const SNOW_LANTERN_CHOICES: readonly { key: NumberKey; label: string; options: readonly string[]; tab: Tab }[] = [
  { key: 'nlPair', label: 'Показ', options: ['Один', 'Пара на весь экран'], tab: 'lantern' },
  { key: 'nlModel', label: 'Фонарь', options: LANTERN_MODELS.map((m) => m.label), tab: 'lantern' },
  { key: 'nlPump', label: 'Насос', options: ['У стенок', 'По центру', 'С одной стороны'], tab: 'glitter' },
  { key: 'nlPalette', label: 'Цвет', options: ['Серебро', 'Золото', 'Радуга'], tab: 'glitter' },
  { key: 'nlView', label: 'Показ', options: ['Всё', 'Без блёсток', 'Только блёстки'], tab: 'bake' },
];

export const SNOW_LANTERN: CanvasSceneDef = {
  kind: 'canvas',
  id: 'snow-lantern',
  label: 'Новогодний фонарь: сцена в воде, кружатся блёстки',
  palettes: [['#0a0807']],
  create(c) {
    const W = c.width;
    const H = c.height;
    let lanterns: (SnowLantern | null)[] = [];
    let failed = '';
    let built = '';
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pair = () => c.params.nlPair >= 0.5;
    const wanted = () => `${pair() ? 'pair' : clamp(Math.round(c.params.nlModel), 0, LANTERN_MODELS.length - 1)}|${clamp(c.params.nlRes, 0.4, 1)}`;
    // The pair's right lantern faded in over the overlap.
    const fade = document.createElement('canvas');
    const fg = fade.getContext('2d')!;
    // The camera control: turning, tilting and zooming bake the light again (a moment after the view stops changing).
    const orbit = createOrbit(c, { pitch: [-15, 50], zoom: [0.6, 2.5] });
    const bakeOf = (): LanternBake => ({ room: c.params.nlRoom, samples: Math.round(c.params.nlSamples), zoom: c.params.nlZoom * orbit.zoom, yaw: orbit.yaw, pitch: orbit.pitch });
    let bakeKey = '';
    let bakePending = '';
    let bakeSince = 0;
    // Built a moment after the first frame (so "Загрузка…" shows), again for another lantern or resolution.
    const build = () => {
      built = wanted();
      const [which, resS] = built.split('|');
      const res = Number(resS);
      for (const l of lanterns) l?.dispose();
      lanterns = [];
      failed = '';
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          const s = Math.min(c.dpr, 1.5) * res;
          const b = bakeOf();
          bakeKey = JSON.stringify(b);
          const models = which === 'pair' ? [0, 1] : [Number(which)];
          const w = which === 'pair' ? W * SHARE : W;
          lanterns = models.map((m) => createSnowLantern(Math.max(2, Math.round(w * s)), Math.max(2, Math.round(H * s)), LANTERN_MODELS[m], b));
          if (lanterns.some((l) => !l)) failed = 'нужен WebGL2 с float-текстурами';
        } catch (e) {
          failed = e instanceof Error ? e.message.slice(0, 200) : String(e);
        }
      }, 30);
    };
    build();
    const look = (): LanternLook => ({
      glitter: c.params.nlGlitter, size: c.params.nlSize, snow: c.params.nlSnow, pump: c.params.nlPumpSpeed, swirl: c.params.nlSwirl,
      settle: c.params.nlSettle, sparkle: c.params.nlSparkle, light: c.params.nlLight, flicker: c.params.nlFlicker, bloom: c.params.nlBloom,
      exposure: c.params.nlExposure, pumpMode: Math.round(c.params.nlPump), palette: Math.round(c.params.nlPalette), view: Math.round(c.params.nlView),
    });
    const ptr = { x: 0, y: 0, pressed: false, clicked: false, active: false };
    let hint = 1;
    let clock = 0;
    // The ⚙ panel (not on a page's background).
    const showGear = !c.body;
    let panelOpen = false;
    let tab: Tab = 'lantern';
    let dragKey: NumberKey | null = null;
    const gear = { x: 10, y: 10, s: 28 };
    const PW = Math.min(W - 20, 380);
    const ROW = 25;
    const CH = 30;
    const TAB_H = 30;
    const panelX = 10;
    const panelY = 46;
    const trackX = panelX + 178;
    const trackW = PW - 178 - 48;
    const choicesOf = () => SNOW_LANTERN_CHOICES.filter((q) => q.tab === tab);
    const settingsOf = () => SNOW_LANTERN_SETTINGS.filter((q) => q.tab === tab);
    const choicesH = () => choicesOf().length * CH + 4;
    const panelH = () => TAB_H + choicesH() + settingsOf().length * ROW + 12;
    const inPanel = (x: number, y: number) => panelOpen && x >= panelX && x <= panelX + PW && y >= panelY && y <= panelY + panelH();
    const panelRow = (x: number, y: number) => {
      const top = panelY + TAB_H + choicesH();
      if (!inPanel(x, y) || y < top) return -1;
      return clamp(Math.floor((y - top - 6) / ROW), 0, settingsOf().length - 1);
    };
    const tabBtn = (i: number) => {
      const w = (PW - 16 - 6 * (SNOW_LANTERN_TABS.length - 1)) / SNOW_LANTERN_TABS.length;
      return { x: panelX + 8 + i * (w + 6), y: panelY + 6, w, h: TAB_H - 8 };
    };
    const choiceBtn = (row: number, i: number) => {
      const n = choicesOf()[row].options.length;
      const x0 = panelX + 66;
      const w = (PW - 66 - 8 - 5 * (n - 1)) / n;
      return { x: x0 + i * (w + 5), y: panelY + TAB_H + 6 + row * CH, w, h: CH - 6 };
    };
    const setFromX = (key: NumberKey, x: number) => {
      const st = SNOW_LANTERN_SETTINGS.find((q) => q.key === key)!;
      const v = st.min + clamp((x - trackX) / trackW, 0, 1) * (st.max - st.min);
      c.params[key] = Math.round(v / st.step) * st.step;
    };
    let dtLast = 1 / 60;

    return {
      isControlPoint: (x, y) => inPanel(x, y) || (x >= gear.x && x <= gear.x + gear.s && y >= gear.y && y <= gear.y + gear.s),
      update(dt, _t, pIn) {
        const p = orbit.update(pIn);
        dtLast = dt;
        clock += Math.min(dt, 0.1);
        let overUi = false;
        if (showGear) {
          if (dragKey && p.pressed) setFromX(dragKey, p.rawX);
          if (!p.pressed) dragKey = null;
          const onGear = p.rawX >= gear.x && p.rawX <= gear.x + gear.s && p.rawY >= gear.y && p.rawY <= gear.y + gear.s;
          overUi = onGear || inPanel(p.rawX, p.rawY);
          if (p.clicked) {
            if (onGear) panelOpen = !panelOpen;
            else if (inPanel(p.rawX, p.rawY) && p.rawY < panelY + TAB_H) {
              SNOW_LANTERN_TABS.forEach((t, i) => {
                const b = tabBtn(i);
                if (p.rawX >= b.x && p.rawX <= b.x + b.w) tab = t.id;
              });
            } else if (inPanel(p.rawX, p.rawY) && p.rawY < panelY + TAB_H + choicesH()) {
              choicesOf().forEach((ch, r) => ch.options.forEach((_, i) => {
                const b = choiceBtn(r, i);
                if (p.rawX >= b.x && p.rawX <= b.x + b.w && p.rawY >= b.y && p.rawY <= b.y + b.h) c.params[ch.key] = i;
              }));
            } else {
              const row = panelRow(p.rawX, p.rawY);
              if (row >= 0) {
                dragKey = settingsOf()[row].key;
                setFromX(dragKey, p.rawX);
              }
            }
          }
        }
        const free = !overUi && !dragKey;
        ptr.x = p.rawX;
        ptr.y = p.rawY;
        ptr.active = p.active && free;
        ptr.pressed = p.pressed && free;
        ptr.clicked = p.clicked && free;
        if (ptr.clicked) hint = 0;
        hint = Math.max(0, hint - Math.min(dt, 0.1) * 0.04);
        // Another lantern or resolution: built again (when the slider is let go); the bake's settings: baked again
        // once they have stayed put for a moment.
        if (!dragKey && wanted() !== built) build();
        const bk = JSON.stringify(bakeOf());
        if (bk !== bakeKey) {
          if (bk !== bakePending) {
            bakePending = bk;
            bakeSince = clock;
          } else if (!dragKey && clock - bakeSince > 0.35) {
            bakeKey = bk;
            for (const l of lanterns) l?.rebake(bakeOf());
          }
        }
      },
      draw(g) {
        // The status of both (the pair): compiling while either is, baked as far as the slower one.
        const sts = lanterns.map((l) => l?.status() ?? null);
        const lantern = lanterns[0] ?? null;
        const st = sts.length && sts.every((x) => x) ? { failed: sts.find((x) => x!.failed)?.failed ?? '', compiling: sts.some((x) => x!.compiling), baked: Math.min(...sts.map((x) => x!.baked)) } : undefined;
        if (lanterns.length === 2 && st && !st.failed) {
          const w = W * SHARE;
          const off = W - w;
          // The pointer to the lantern under it (in its own frame).
          const right = ptr.x >= W / 2;
          const pl = { ...ptr, active: ptr.active && !right, pressed: ptr.pressed && !right, clicked: ptr.clicked && !right };
          const pr = { ...ptr, x: ptr.x - off, active: ptr.active && right, pressed: ptr.pressed && right, clicked: ptr.clicked && right };
          lanterns[0]!.frame(dtLast, look(), pl, w, H);
          lanterns[1]!.frame(dtLast, look(), pr, w, H);
          g.drawImage(lanterns[0]!.canvas, 0, 0, w, H);
          const cw = lanterns[1]!.canvas.width, ch = lanterns[1]!.canvas.height;
          if (fade.width !== cw || fade.height !== ch) {
            fade.width = cw;
            fade.height = ch;
          }
          fg.globalCompositeOperation = 'copy';
          fg.drawImage(lanterns[1]!.canvas, 0, 0);
          fg.globalCompositeOperation = 'destination-in';
          const ov = ((w - off) / w) * cw;
          const grad = fg.createLinearGradient(0, 0, ov, 0);
          grad.addColorStop(0, 'rgba(0,0,0,0)');
          grad.addColorStop(1, 'rgba(0,0,0,1)');
          fg.fillStyle = grad;
          fg.fillRect(0, 0, cw, ch);
          g.drawImage(fade, off, 0, w, H);
        } else if (lantern && st && !st.failed) {
          lantern.frame(dtLast, look(), ptr, W, H);
          g.drawImage(lantern.canvas, 0, 0, W, H);
        } else {
          g.fillStyle = '#0a0807';
          g.fillRect(0, 0, W, H);
        }
        const message = failed ? `Не удалось запустить: ${failed}` : st?.failed ? `Шейдер: ${st.failed.slice(0, 160)}` : !lantern ? 'Загрузка…' : st?.compiling ? 'Собираю сцену (шейдер)…' : '';
        g.textBaseline = 'middle';
        if (message) {
          g.fillStyle = '#e9e2cf';
          g.font = '14px sans-serif';
          g.textAlign = 'center';
          g.fillText(message, W / 2, H / 2, W - 40);
        }
        // The bake's progress: a thin bar at the bottom.
        if (st && !st.compiling && !st.failed && st.baked < 1) {
          const bw = Math.min(260, W - 40);
          const bx = (W - bw) / 2;
          const by = H - 26;
          g.fillStyle = 'rgba(10,10,8,0.6)';
          g.beginPath();
          g.roundRect(bx - 8, by - 14, bw + 16, 30, 7);
          g.fill();
          g.fillStyle = 'rgba(255,255,255,0.18)';
          g.fillRect(bx, by + 6, bw, 3);
          g.fillStyle = '#ffd27a';
          g.fillRect(bx, by + 6, bw * st.baked, 3);
          g.font = '11.5px sans-serif';
          g.textAlign = 'center';
          g.fillStyle = '#f6eee0';
          g.fillText(`Запекаю свет (трассировка лучей): ${Math.floor(st.baked * 100)}%`, W / 2, by - 4);
        }
        if (hint > 0 && !panelOpen && st && !st.compiling) {
          const text = 'Клик — встряхнуть фонарь, тяните — размешать воду';
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
        if (!showGear) return;
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
        g.fillText('⚙', gear.x + gear.s / 2, gear.y + gear.s / 2 + 1);
        if (!panelOpen) return;
        g.fillStyle = 'rgba(10,10,8,0.86)';
        g.strokeStyle = 'rgba(255,255,255,0.18)';
        g.beginPath();
        g.roundRect(panelX, panelY, PW, panelH(), 9);
        g.fill();
        g.stroke();
        g.font = '12px sans-serif';
        SNOW_LANTERN_TABS.forEach((t, i) => {
          const bt = tabBtn(i);
          const on = t.id === tab;
          g.fillStyle = on ? 'rgba(255,210,122,0.3)' : 'rgba(255,255,255,0.06)';
          g.strokeStyle = on ? '#ffd27a' : 'rgba(255,255,255,0.18)';
          g.beginPath();
          g.roundRect(bt.x, bt.y, bt.w, bt.h, 6);
          g.fill();
          g.stroke();
          g.fillStyle = on ? '#ffe7b0' : '#f6eee0';
          g.textAlign = 'center';
          g.fillText(t.label, bt.x + bt.w / 2, bt.y + bt.h / 2 + 1, bt.w - 4);
        });
        choicesOf().forEach((ch, r) => {
          g.font = '13px sans-serif';
          g.textAlign = 'left';
          g.fillStyle = '#f6eee0';
          g.fillText(ch.label, panelX + 12, panelY + TAB_H + 6 + r * CH + (CH - 6) / 2);
          g.font = '11px sans-serif';
          ch.options.forEach((label, i) => {
            const bt = choiceBtn(r, i);
            const on = Math.round(c.params[ch.key]) === i;
            g.fillStyle = on ? 'rgba(255,210,122,0.28)' : 'rgba(255,255,255,0.07)';
            g.strokeStyle = on ? '#ffd27a' : 'rgba(255,255,255,0.2)';
            g.beginPath();
            g.roundRect(bt.x, bt.y, bt.w, bt.h, 6);
            g.fill();
            g.stroke();
            g.fillStyle = on ? '#ffe7b0' : '#f6eee0';
            g.textAlign = 'center';
            g.fillText(label, bt.x + bt.w / 2, bt.y + bt.h / 2 + 1, bt.w - 4);
          });
        });
        g.font = '12px sans-serif';
        settingsOf().forEach((s, i) => {
          const y = panelY + TAB_H + choicesH() + 6 + i * ROW + ROW / 2;
          const v = c.params[s.key];
          g.textAlign = 'left';
          g.fillStyle = '#f6eee0';
          g.fillText(s.label, panelX + 12, y, 162);
          const fr = clamp((v - s.min) / (s.max - s.min), 0, 1);
          g.fillStyle = 'rgba(255,255,255,0.18)';
          g.fillRect(trackX, y - 2, trackW, 4);
          g.fillStyle = '#ffd27a';
          g.fillRect(trackX, y - 2, trackW * fr, 4);
          g.beginPath();
          g.arc(trackX + trackW * fr, y, dragKey === s.key ? 7 : 6, 0, Math.PI * 2);
          g.fill();
          g.textAlign = 'right';
          g.fillStyle = 'rgba(246,238,224,0.8)';
          g.fillText(v.toFixed(s.step < 0.1 ? 2 : s.step < 1 ? 1 : 0), panelX + PW - 10, y);
        });
      },
      dispose() {
        orbit.dispose();
        clearTimeout(timer);
        for (const l of lanterns) l?.dispose();
      },
    };
  },
};
