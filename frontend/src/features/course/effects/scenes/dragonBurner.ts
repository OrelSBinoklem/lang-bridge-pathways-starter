import type { CanvasSceneDef, SceneParams } from './types';
import { clamp } from './kit';
import { createDragonBurner, GRID_LEVELS, type BurnerModel, type DragonBurner, type DragonLook } from './dragonBurnerGL';
import { DRAGON_MODEL } from './burnerDragon';
import { FALLS_MODEL, MILL_MODEL } from './burnerMountains';
import { registerCameraSwitch } from './orbitControl';
import { burnerRenderScale } from './burnerResolution';

/**
 * An experimental effect: procedural backflow incense burners after the owner's photos, with heavy smoke simulated as
 * a fluid on a grid (dragonBurnerGL.ts). The model is chosen in the settings: a clay dragon with spread wings on a
 * black glazed castle, holding a blue glass orb (the smoke pours from its mouth down the castle's switchback stair into
 * the pool in the dish); a red-brown mountain with a house, a pine, a moon and a water wheel; a grey rock with a
 * gorge, a cloud, a house and a tree in bloom (the smoke runs from under the cone's cup down the channel into the
 * pool and spills onto the table). The cursor stirs the smoke. With «Камера: вращать мышью» on, dragging turns the
 * camera round the burner and the wheel brings it closer (also sliders); otherwise it stays where the model puts it.
 * The smoke's grid (finer: sharper, slower) and its drawing (its picture's size, the march's step, powder, detail,
 * the frame before blended in, its shadow on the model) are settings too.
 */

/** The models, in the order of dbModel. */
export const BURNER_MODELS: readonly BurnerModel[] = [DRAGON_MODEL, MILL_MODEL, FALLS_MODEL];
/** Which model's smoke settings each scene's params last got (BurnerModel.smokeDefaults). */
const modelApplied = new WeakMap<object, number>();

type NumberKey = { [K in keyof SceneParams]: SceneParams[K] extends number ? K : never }[keyof SceneParams];

/** The ⚙ panel's tabs. */
export const DRAGON_BURNER_TABS = [
  { id: 'model', label: 'Модель и камера' },
  { id: 'smoke', label: 'Дым' },
  { id: 'speed', label: 'Ускорение' },
] as const;
type Tab = (typeof DRAGON_BURNER_TABS)[number]['id'];

export const DRAGON_BURNER_SETTINGS: readonly { key: NumberKey; label: string; min: number; max: number; step: number; tab: Tab }[] = [
  { key: 'dbLight', label: 'Свет', min: 0.3, max: 3, step: 0.05, tab: 'model' },
  { key: 'dbExposure', label: 'Экспозиция', min: 0.4, max: 3, step: 0.05, tab: 'model' },
  { key: 'dbYaw', label: 'Камера: поворот, °', min: -180, max: 180, step: 1, tab: 'model' },
  { key: 'dbPitch', label: 'Камера: наклон, °', min: -20, max: 60, step: 1, tab: 'model' },
  { key: 'dbZoom', label: 'Камера: приближение, ×', min: 0.5, max: 4, step: 0.05, tab: 'model' },
  { key: 'dbAmount', label: 'Сколько дыма', min: 0.1, max: 1, step: 0.05, tab: 'smoke' },
  { key: 'dbHeavy', label: 'Тяжесть', min: 0.2, max: 3, step: 0.05, tab: 'smoke' },
  { key: 'dbFlow', label: 'Текучесть воздуха', min: 0.2, max: 4, step: 0.05, tab: 'smoke' },
  { key: 'dbSpread', label: 'Напор из источника', min: 0, max: 3, step: 0.05, tab: 'smoke' },
  { key: 'dbSwirl', label: 'Завихрения', min: 0, max: 2, step: 0.05, tab: 'smoke' },
  { key: 'dbCling', label: 'Липнет к руслу (обтекает выступы)', min: 0, max: 3, step: 0.05, tab: 'smoke' },
  { key: 'dbLife', label: 'Живёт, с', min: 4, max: 40, step: 0.5, tab: 'smoke' },
  { key: 'dbDensity', label: 'Густота', min: 0.2, max: 4, step: 0.05, tab: 'smoke' },
  { key: 'dbPowder', label: 'Тёмные края («пудра»)', min: 0, max: 1, step: 0.05, tab: 'smoke' },
  { key: 'dbDetail', label: 'Детализация шумом', min: 0, max: 1, step: 0.05, tab: 'smoke' },
  { key: 'dbShade', label: 'Тень дыма на модели', min: 0, max: 1, step: 0.05, tab: 'smoke' },
  { key: 'dbSmokeRes', label: 'Разрешение картинки дыма', min: 0.25, max: 1, step: 0.05, tab: 'speed' },
  { key: 'dbStep', label: 'Точность луча', min: 0.5, max: 2.5, step: 0.05, tab: 'speed' },
  { key: 'dbTaa', label: 'Сглаживание во времени', min: 0, max: 0.9, step: 0.05, tab: 'speed' },
  { key: 'dbPasses', label: 'Давление: проходов', min: 6, max: 60, step: 2, tab: 'speed' },
];

/** The choices shown as rows of buttons (⚙ and the debug panel). */
export const DRAGON_BURNER_CHOICES: readonly { key: NumberKey; label: string; options: readonly string[]; tab: Tab }[] = [
  { key: 'dbModel', label: 'Модель', options: BURNER_MODELS.map((m) => m.label), tab: 'model' },
  { key: 'dbCamera', label: 'Камера', options: ['Закреплена', 'Вращать мышью'], tab: 'model' },
  { key: 'dbGrid', label: 'Сетка', options: GRID_LEVELS.map((l) => l.label), tab: 'speed' },
  { key: 'dbSkip', label: 'Пустоты', options: ['Считать все', 'Пропускать'], tab: 'speed' },
  { key: 'dbSolver', label: 'Давление', options: ['Якоби', 'Гаусс–Зейдель'], tab: 'speed' },
  { key: 'dbHalfRate', label: 'Шаг', options: ['Каждый кадр', 'Через кадр'], tab: 'speed' },
  { key: 'dbAuto', label: 'Авто', options: ['Выкл', 'Само снижает'], tab: 'speed' },
];

export const DRAGON_BURNER: CanvasSceneDef = {
  kind: 'canvas',
  id: 'dragon-burner',
  label: 'Курильница: дракон на замке или горы, дым — жидкость на сетке',
  palettes: [['#0b0a09']],
  defaultParams: { quality: 1 },
  pixelRatioCap: Infinity,
  create(c) {
    const W = c.width;
    const H = c.height;
    const compact = !c.body && H < 480;
    const s = burnerRenderScale(c.dpr, c.params.quality, compact);
    let burner: DragonBurner | null = null;
    let failed = '';
    let warmed = 0;
    let ready = false;
    let built = '';
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wanted = () => `${clamp(Math.round(c.params.dbModel), 0, BURNER_MODELS.length - 1)}|${clamp(Math.round(c.params.dbGrid), 0, GRID_LEVELS.length - 1)}`;
    // Built a moment after the first frame (compiling the shaders takes a while), so "Загрузка…" shows first; built
    // again (its own shaders) when another model or grid is chosen.
    const build = () => {
      built = wanted();
      const [model, grid] = built.split('|').map(Number);
      // The model's own smoke settings, once each time a model is chosen (a scene made again keeps what was tuned).
      if (modelApplied.get(c.params) !== model) {
        modelApplied.set(c.params, model);
        Object.assign(c.params, BURNER_MODELS[model].smokeDefaults ?? {});
        if (compact) c.params.dbDetail = .35;
      }
      burner?.dispose();
      burner = null;
      failed = '';
      warmed = 0;
      ready = false;
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          burner = createDragonBurner(Math.max(2, Math.round(W * s)), Math.max(2, Math.round(H * s)), BURNER_MODELS[model], grid);
          if (!burner) failed = 'нужен WebGL2 с float-текстурами';
        } catch (e) {
          failed = e instanceof Error ? e.message.slice(0, 200) : String(e);
        }
      }, 30);
    };
    build();
    const look = (): DragonLook => ({
      amount: c.params.dbAmount, heavy: c.params.dbHeavy, flow: c.params.dbFlow, spread: c.params.dbSpread, swirl: c.params.dbSwirl, cling: c.params.dbCling,
      life: c.params.dbLife, light: c.params.dbLight, density: c.params.dbDensity, exposure: c.params.dbExposure,
    });
    /** The smoke's drawing and the speed-ups (the automatic scale in steps of 0.05, so the targets are rarely made
     * again). */
    const smokeLook = () => ({
      res: Math.max(0.2, Math.round(c.params.dbSmokeRes * autoScale * 20) / 20), step: c.params.dbStep, powder: c.params.dbPowder,
      detail: c.params.dbDetail, taa: c.params.dbTaa, shade: c.params.dbShade, skip: c.params.dbSkip >= 0.5,
      solver: c.params.dbSolver, passes: c.params.dbPasses, halfRate: c.params.dbHalfRate >= 0.5,
    });
    const ptr = { x: 0, y: 0, vx: 0, vy: 0, active: false };
    let over = false;
    // The wheel brings the camera closer (only with the camera's switch on, and over the scene).
    const onWheel = (e: WheelEvent) => {
      if (c.params.dbCamera < 0.5 || !over) return;
      e.preventDefault();
      c.params.dbZoom = clamp(c.params.dbZoom * Math.exp(-e.deltaY * 0.0012), 0.5, 4);
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    // On from the start when so set (orbitControl.ts), and the «C» key.
    const unregister = registerCameraSwitch(c.params, 'dbCamera', {
      hovered: () => over,
      on: () => c.params.dbCamera >= 0.5,
      set: (on) => {
        c.params.dbCamera = on ? 1 : 0;
      },
    });
    let panelOpen = false;
    let tab: Tab = 'model';
    let dragKey: NumberKey | null = null;
    // Automatic quality: frame time (smoothed) and the scale it puts on the smoke's resolution.
    let frameMs = 16;
    let autoScale = 1;
    let orbiting = false;
    let lastX = 0;
    let lastY = 0;
    const gear = { x: 10, y: 10, s: 28 };
    const PW = Math.min(W - 20, 360);
    const ROW = 25;
    const CH = 30;
    const panelX = 10;
    const panelY = 46;
    const trackX = panelX + 176;
    const trackW = PW - 176 - 48;
    // The tab bar, then this tab's rows of buttons, then its sliders.
    const TAB_H = 30;
    const choicesOf = () => DRAGON_BURNER_CHOICES.filter((q) => q.tab === tab);
    const settingsOf = () => DRAGON_BURNER_SETTINGS.filter((q) => q.tab === tab);
    const choicesH = () => choicesOf().length * CH + 4;
    const panelH = () => TAB_H + choicesH() + settingsOf().length * ROW + 12;
    const inPanel = (x: number, y: number) => panelOpen && x >= panelX && x <= panelX + PW && y >= panelY && y <= panelY + panelH();
    const panelRow = (x: number, y: number) => {
      const top = panelY + TAB_H + choicesH();
      if (!inPanel(x, y) || y < top) return -1;
      return clamp(Math.floor((y - top - 6) / ROW), 0, settingsOf().length - 1);
    };
    const tabBtn = (i: number) => {
      const w = (PW - 16 - 6 * (DRAGON_BURNER_TABS.length - 1)) / DRAGON_BURNER_TABS.length;
      return { x: panelX + 8 + i * (w + 6), y: panelY + 6, w, h: TAB_H - 8 };
    };
    const choiceBtn = (row: number, i: number) => {
      const n = choicesOf()[row].options.length;
      const x0 = panelX + 74;
      const w = (PW - 74 - 8 - 6 * (n - 1)) / n;
      return { x: x0 + i * (w + 6), y: panelY + TAB_H + 6 + row * CH, w, h: CH - 6 };
    };
    const setFromX = (key: NumberKey, x: number) => {
      const st = DRAGON_BURNER_SETTINGS.find((q) => q.key === key)!;
      const v = st.min + clamp((x - trackX) / trackW, 0, 1) * (st.max - st.min);
      c.params[key] = Math.round(v / st.step) * st.step;
    };
    let dtLast = 1 / 60;

    return {
      isControlPoint: (x, y) => inPanel(x, y) || (x >= gear.x && x <= gear.x + gear.s && y >= gear.y && y <= gear.y + gear.s),
      update(dt, _t, p) {
        dtLast = Math.min(dt, 1 / 20);
        frameMs += (Math.min(dt, 0.2) * 1000 - frameMs) * 0.05;
        // Automatic quality: slow frames lower the smoke's resolution step by step, fast ones raise it back.
        if (c.params.dbAuto >= 0.5 && ready) {
          if (frameMs > 24) autoScale = Math.max(0.4, autoScale - 0.004);
          else if (frameMs < 15) autoScale = Math.min(1, autoScale + 0.002);
        } else autoScale = 1;
        if (dragKey && p.pressed) setFromX(dragKey, p.rawX);
        if (!p.pressed) {
          dragKey = null;
          orbiting = false;
        }
        const onGear = p.rawX >= gear.x && p.rawX <= gear.x + gear.s && p.rawY >= gear.y && p.rawY <= gear.y + gear.s;
        if (p.clicked) {
          const row = panelRow(p.rawX, p.rawY);
          if (onGear) panelOpen = !panelOpen;
          else if (inPanel(p.rawX, p.rawY) && p.rawY < panelY + TAB_H) {
            DRAGON_BURNER_TABS.forEach((t, i) => {
              const b = tabBtn(i);
              if (p.rawX >= b.x && p.rawX <= b.x + b.w) tab = t.id;
            });
          } else if (inPanel(p.rawX, p.rawY) && p.rawY < panelY + TAB_H + choicesH()) {
            choicesOf().forEach((ch, r) => ch.options.forEach((_, i) => {
              const b = choiceBtn(r, i);
              if (p.rawX >= b.x && p.rawX <= b.x + b.w && p.rawY >= b.y && p.rawY <= b.y + b.h) c.params[ch.key] = i;
            }));
          } else if (row >= 0) {
            dragKey = settingsOf()[row].key;
            setFromX(dragKey, p.rawX);
          } else if (c.params.dbCamera >= 0.5) {
            orbiting = true;
            lastX = p.rawX;
            lastY = p.rawY;
          }
        }
        // Turning the camera by dragging.
        if (orbiting && p.pressed) {
          c.params.dbYaw = ((((c.params.dbYaw - (p.rawX - lastX) * 0.3) % 360) + 540) % 360) - 180;
          c.params.dbPitch = clamp(c.params.dbPitch + (p.rawY - lastY) * 0.25, -20, 60);
          lastX = p.rawX;
          lastY = p.rawY;
        }
        const k = 1 / Math.max(dt, 1e-3);
        ptr.vx = ptr.active ? (p.rawX - ptr.x) * k : 0;
        ptr.vy = ptr.active ? (p.rawY - ptr.y) * k : 0;
        ptr.x = p.rawX;
        ptr.y = p.rawY;
        over = p.active && !inPanel(p.rawX, p.rawY) && !onGear;
        ptr.active = over && !orbiting;
        if (wanted() !== built) build();
      },
      draw(g) {
        let b = burner;
        if (b && !ready) {
          try {
            ready = b.ready;
          } catch (e) {
            failed = e instanceof Error ? e.message.slice(0, 200) : String(e);
            b.dispose();
            burner = null;
            b = null;
          }
          if (!ready) b = null;
        }
        if (b && warmed < 30) {
          // Two simulation steps, not 30 expensive steps before each initial frame. Show the model immediately.
          b.warm(1 / 30, look(), smokeLook());
          warmed += 1;
        }
        if (b) {
          const cam = c.params.dbCamera >= 0.5;
          b.frame(dtLast, look(), ptr, W, H, cam ? { yaw: c.params.dbYaw, pitch: c.params.dbPitch, zoom: c.params.dbZoom } : { yaw: 0, pitch: 0, zoom: 1 }, smokeLook());
          g.drawImage(b.canvas, 0, 0, W, H);
        } else {
          g.fillStyle = '#0b0a09';
          g.fillRect(0, 0, W, H);
          g.fillStyle = '#e9e2cf';
          g.font = '14px sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(failed ? `Не удалось запустить: ${failed}` : 'Загрузка…', W / 2, H / 2);
        }
        if (compact) return;
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
        g.textBaseline = 'middle';
        g.fillText('⚙', gear.x + gear.s / 2, gear.y + gear.s / 2 + 1);
        if (panelOpen) {
          g.fillStyle = 'rgba(10,10,8,0.84)';
          g.strokeStyle = 'rgba(255,255,255,0.18)';
          g.beginPath();
          g.roundRect(panelX, panelY, PW, panelH(), 9);
          g.fill();
          g.stroke();
          g.font = '12px sans-serif';
          DRAGON_BURNER_TABS.forEach((t, i) => {
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
          const sts = settingsOf();
          for (let i = 0; i < sts.length; i += 1) {
            const st = sts[i];
            const y = panelY + TAB_H + choicesH() + 6 + i * ROW + ROW / 2;
            const v = c.params[st.key];
            g.textAlign = 'left';
            g.fillStyle = '#f6eee0';
            g.fillText(st.label, panelX + 12, y, 160);
            const fr = clamp((v - st.min) / (st.max - st.min), 0, 1);
            g.fillStyle = 'rgba(255,255,255,0.18)';
            g.fillRect(trackX, y - 2, trackW, 4);
            g.fillStyle = '#ffd27a';
            g.fillRect(trackX, y - 2, trackW * fr, 4);
            g.beginPath();
            g.arc(trackX + trackW * fr, y, dragKey === st.key ? 7 : 6, 0, Math.PI * 2);
            g.fill();
            g.textAlign = 'right';
            g.fillStyle = 'rgba(246,238,224,0.8)';
            g.fillText(v.toFixed(st.step < 0.1 ? 2 : st.step < 1 ? 1 : 0), panelX + PW - 10, y);
          }
        } else if (c.params.dbCamera >= 0.5) {
          g.font = '12px sans-serif';
          g.textAlign = 'left';
          g.fillStyle = 'rgba(10,10,8,0.6)';
          g.beginPath();
          g.roundRect(46, 12, 300, 22, 6);
          g.fill();
          g.fillStyle = '#f6eee0';
          g.fillText('Камера: тяните — поворот, колесо — приближение', 54, 23);
        }
      },
      ready() { return ready && warmed >= 30; },
      dispose() {
        clearTimeout(timer);
        window.removeEventListener('wheel', onWheel);
        unregister();
        burner?.dispose();
      },
    };
  },
};

/** A genuine small composition, not two fullscreen burners squeezed into a short card. */
export const DRAGON_BURNER_CARD: CanvasSceneDef = {
  kind: 'canvas', id: 'dragon-burner-card', label: 'Дракон справа — компактная курильница',
  palettes: DRAGON_BURNER.palettes,
  defaultParams: { dbModel: 0, dbGrid: 0, dbSmokeRes: .55, dbPasses: 10, dbStep: 1.5, dbDetail: .35, dbCamera: 0, quality: .7 },
  create(c) {
    const width = Math.min(c.width * .42, c.height * 1.25);
    const left = c.width - width;
    // Local parameters prevent the cheaper card profile from mutating the independent fullscreen profile.
    const params = { ...c.params, ...DRAGON_BURNER_CARD.defaultParams };
    const scene = DRAGON_BURNER.create({ ...c, width, body: false, params, cameraControls: false });
    return {
      isControlPoint: (x, y) => !!scene.isControlPoint?.(x - left, y),
      update(dt, t, p) { scene.update(dt, t, { ...p, x: p.x - left, rawX: p.rawX - left, active: p.active && p.rawX >= left }); },
      draw(g) {
        g.clearRect(0, 0, c.width, c.height);
        g.save(); g.translate(left, 0);
        g.beginPath(); g.rect(0, 0, width, c.height); g.clip();
        scene.draw(g); g.restore();
      },
      ready: () => scene.ready?.() ?? true,
      dispose: () => scene.dispose?.(),
    };
  },
};

/**
 * Two burners over the whole screen (owner, group 1791 «Земля, воздух, вода»: «скалу с водопадом и дымом — дракон слева,
 * а скала справа, по краям экрана»): the dragon on the castle on the left, the rock with the waterfall on the right,
* each its own renderer and smoke (its model's smoke settings) 45 % of the width wide, by the screen's edges (the
 * page's cards cover the middle), each fading into the dark towards the middle. The cursor stirs the smoke of the one it is over. Meant for a page's background: no
 * panel; the light, exposure and the smoke's drawing come from the scene's params.
 */
const PAIR_SHARE = 0.45;
/** Each drawn this share of the width further out than its half (owner: «дракон левее, а гора правее»). */
const PAIR_OUT = 0.06;
export const DRAGON_BURNER_PAIR: CanvasSceneDef = {
  kind: 'canvas',
  id: 'burner-pair',
  label: 'Курильницы на весь экран: дракон слева, скала с водопадом справа',
  palettes: [['#0b0a09']],
  defaultParams: { quality: 1 },
  pixelRatioCap: Infinity,
  create(c) {
    const W = c.width;
    const H = c.height;
    const w = W * PAIR_SHARE;
    const off = W - w;
    const out = W * PAIR_OUT;
    // Where each pane is drawn: the dragon's pushed past the left edge, the rock's past the right.
    const at = [-out, off + out];
    // Native model/light bake at quality 1; smoke has its own independent dbSmokeRes scale.
    const s = burnerRenderScale(c.dpr, c.params.quality);
    const MODELS = [0, 2];
    const burners: (DragonBurner | null)[] = [null, null];
    const ready = [false, false];
    const warmed = [0, 0];
    let failed = '';
    const timer = setTimeout(() => {
      MODELS.forEach((m, i) => {
        try {
          burners[i] = createDragonBurner(Math.max(2, Math.round(w * s)), Math.max(2, Math.round(H * s)), BURNER_MODELS[m], clamp(Math.round(c.params.dbGrid), 0, GRID_LEVELS.length - 1));
          if (!burners[i]) failed = 'нужен WebGL2 с float-текстурами';
        } catch (e) {
          failed = e instanceof Error ? e.message.slice(0, 200) : String(e);
        }
      });
    }, 30);
    const look = (i: number): DragonLook => {
      const d = BURNER_MODELS[MODELS[i]].smokeDefaults;
      const v = (k: keyof NonNullable<typeof d>, fallback: number) => (d ? d[k] : fallback);
      return {
        amount: v('dbAmount', c.params.dbAmount), heavy: v('dbHeavy', c.params.dbHeavy), flow: v('dbFlow', c.params.dbFlow),
        spread: v('dbSpread', c.params.dbSpread), swirl: v('dbSwirl', c.params.dbSwirl), cling: v('dbCling', c.params.dbCling),
        life: v('dbLife', c.params.dbLife), light: c.params.dbLight, density: v('dbDensity', c.params.dbDensity), exposure: c.params.dbExposure,
      };
    };
    const smokeLook = (i: number) => {
      const d = BURNER_MODELS[MODELS[i]].smokeDefaults;
      return {
        res: c.params.dbSmokeRes, step: c.params.dbStep, powder: d ? d.dbPowder : c.params.dbPowder, detail: d ? d.dbDetail : c.params.dbDetail,
        taa: c.params.dbTaa, shade: d ? d.dbShade : c.params.dbShade, skip: c.params.dbSkip >= 0.5,
        solver: c.params.dbSolver, passes: c.params.dbPasses, halfRate: c.params.dbHalfRate >= 0.5,
      };
    };
    const ptrs = [{ x: 0, y: 0, vx: 0, vy: 0, active: false }, { x: 0, y: 0, vx: 0, vy: 0, active: false }];
    const fade = document.createElement('canvas');
    const fg = fade.getContext('2d')!;
    let dtLast = 1 / 60;
    return {
      update(dt, _t, p) {
        dtLast = Math.min(dt, 1 / 20);
        const k = 1 / Math.max(dt, 1e-3);
        const right = p.rawX >= W / 2;
        ptrs.forEach((q, i) => {
          const x = p.rawX - at[i];
          q.vx = q.active ? (x - q.x) * k : 0;
          q.vy = q.active ? (p.rawY - q.y) * k : 0;
          q.x = x;
          q.y = p.rawY;
          q.active = p.active && (i === 1) === right;
        });
      },
      draw(g) {
        const shown: (DragonBurner | null)[] = [null, null];
        burners.forEach((b, i) => {
          if (!b) return;
          if (!ready[i]) {
            try {
              ready[i] = b.ready;
            } catch (e) {
              failed = e instanceof Error ? e.message.slice(0, 200) : String(e);
              b.dispose();
              burners[i] = null;
              return;
            }
          }
          if (!ready[i]) return;
          if (warmed[i] < 30) {
            b.warm(1 / 30, look(i), smokeLook(i));
            warmed[i] += 1;
          }
          b.frame(dtLast, look(i), ptrs[i], w, H, { yaw: 0, pitch: 0, zoom: 1 }, smokeLook(i));
          shown[i] = b;
        });
        g.fillStyle = '#0b0a09';
        g.fillRect(0, 0, W, H);
        // Each by its edge, fading into the dark over its inner quarter.
        shown.forEach((b, i) => {
          if (!b) return;
          const cv = b.canvas;
          if (fade.width !== cv.width || fade.height !== cv.height) {
            fade.width = cv.width;
            fade.height = cv.height;
          }
          fg.globalCompositeOperation = 'copy';
          fg.drawImage(cv, 0, 0);
          fg.globalCompositeOperation = 'destination-in';
          const grad = fg.createLinearGradient(0, 0, cv.width, 0);
          grad.addColorStop(i === 0 ? 0.75 : 0.25, 'rgba(0,0,0,1)');
          grad.addColorStop(i === 0 ? 1 : 0, 'rgba(0,0,0,0)');
          fg.fillStyle = grad;
          fg.fillRect(0, 0, cv.width, cv.height);
          g.drawImage(fade, at[i], 0, w, H);
        });
        if (!shown[0] || !shown[1]) {
          g.fillStyle = '#e9e2cf';
          g.font = '14px sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(failed ? `Не удалось запустить: ${failed}` : 'Загрузка…', W / 2, H / 2);
        }
      },
      dispose() {
        clearTimeout(timer);
        for (const b of burners) b?.dispose();
      },
      ready() { return ready.every(Boolean) && warmed.every(value => value >= 30); },
    };
  },
};
