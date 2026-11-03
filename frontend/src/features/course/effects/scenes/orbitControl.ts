import type { SceneCtx, ScenePointer, SceneParams } from './types';
import { clamp } from './kit';

/**
 * The camera control shared by the 3D scenes (owner: «во всех 3D сценах управлять камерой курсором и приближением
 * колесом»): a «🎥 Камера» button in the scene's top right corner (not on a page's background). While it is on, a drag
 * turns the camera round the scene (yaw, pitch) and the wheel brings it closer; «↺» puts it back. A press that does not
 * move still reaches the scene as a click (when let go), so a scene's own clicks keep working; its own drags do not
 * while the camera is on. Off, the scene behaves as before and the wheel scrolls the page.
 *
 * The state lives in the scene's params (camOn, camYaw and camPitch in degrees, camZoom ×), so the debug panel shows
 * it too. A scene reads `yaw`, `pitch` (radians, offsets from its own view) and `zoom`, and `version` to know the
 * view changed (for scenes that must bake again). Scenes that already turn by dragging pass `ownDrag` and get only the
 * wheel (and the button for it).
 *
 * For admins: the «C» key turns the camera on or off in the scene under the cursor (in all of them when the cursor is
 * over none), and in this browser it can be on from the start in every 3D scene (cameraDefaultOn: the debug panel's «Камера»
 * folder; the owner: «в настройках для админов чтобы она была по дефолту включена или задать горячую клавишу»).
 */

/** The scenes with this control (for the debug panel's «Камера» folder). */
export const ORBIT_SCENES = [
  'domino-workshop',
  'domino-archipelago',
  'hourglass', 'voxel-led-cube', 'fireworks', 'fountain', 'snow-lantern', 'nixie-clock', 'prom-board',
  'gems', 'kaleidoscope', 'dragon-smoke', 'fogged-glass', 'string-lights',
] as const;
/** Scenes with a camera of their own (a switch in their settings) that the default and the key also turn on. */
export const OWN_CAMERA_SCENES = ['glass-fountain', 'dragon-burner'] as const;

const DEFAULT_KEY = 'lbp_effects_camera_default';

// Admins only (the app shell tells, once /user answers): the default and the «C» key. Everyone can still turn the
// camera on with its button or in the debug panel (owner: «юзерам обычным разрешать в дебагере включать … а для
// админов настройка дефолта камеры с горячими клавишами остаётся»). In development, localStorage lbp_dev_camera_admin
// = '1' stands in for an admin (the headless checks have no login).
let admin = false;
const adminListeners = new Set<() => void>();
export function isCameraAdmin() {
  if (admin) return true;
  if (process.env.NODE_ENV === 'production') return false;
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('lbp_dev_camera_admin') === '1';
  } catch {
    return false;
  }
}
/** Called whenever it is known whether this visitor is an admin; the default is applied once it is. */
export function setCameraAdmin(on: boolean) {
  if (admin === on) return;
  admin = on;
  if (cameraDefaultOn()) for (const s of switches) applyDefault(s);
  adminListeners.forEach((l) => l());
}
/** Listens to the admin flag changing; returns the function that stops it. */
export function onCameraAdminChange(l: () => void) {
  adminListeners.add(l);
  return () => {
    adminListeners.delete(l);
  };
}

/** What is stored (whoever is looking). */
export function cameraDefaultStored() {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(DEFAULT_KEY) === '1';
  } catch {
    return false;
  }
}
/** The camera on from the start in every 3D scene (this browser, an admin). */
export function cameraDefaultOn() {
  return cameraDefaultStored() && isCameraAdmin();
}

type CameraSwitch = { hovered: () => boolean; on: () => boolean; set: (on: boolean) => void };
type Registered = CameraSwitch & { P: SceneParams; key: string };
const switches = new Set<Registered>();
const applied = new WeakMap<object, Set<string>>();
/** The default, once per params and key (a scene made again on a resize keeps what was chosen). */
const applyDefault = (s: Registered) => {
  let keys = applied.get(s.P);
  if (!keys) applied.set(s.P, (keys = new Set()));
  if (keys.has(s.key)) return;
  keys.add(s.key);
  s.set(true);
};
const onKey = (e: KeyboardEvent) => {
  if (e.code !== 'KeyC' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || !isCameraAdmin()) return;
  const t = e.target as HTMLElement | null;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  const all = [...switches];
  const hovered = all.filter((s) => s.hovered());
  const list = hovered.length ? hovered : all;
  if (!list.length) return;
  const next = !list.some((s) => s.on());
  for (const s of list) s.set(next);
};

/** Sets the default (and turns the camera on or off in the scenes now running). */
export function setCameraDefaultOn(on: boolean) {
  try {
    localStorage.setItem(DEFAULT_KEY, on ? '1' : '0');
  } catch {
    // Storage blocked: only the scenes now running change.
  }
  for (const s of switches) s.set(on);
}

/** A scene's camera switch: the default (for an admin) and the «C» key. Returns the function that takes it off again. */
export function registerCameraSwitch(P: SceneParams, key: string, s: CameraSwitch) {
  const r: Registered = { ...s, P, key };
  if (cameraDefaultOn()) applyDefault(r);
  if (!switches.size && typeof window !== 'undefined') window.addEventListener('keydown', onKey);
  switches.add(r);
  return () => {
    switches.delete(r);
    if (!switches.size && typeof window !== 'undefined') window.removeEventListener('keydown', onKey);
  };
}

export type OrbitOpts = {
  /** Pitch range, degrees (offset from the scene's own view). */
  pitch?: [number, number];
  zoom?: [number, number];
  /** The scene turns by dragging itself: the control only adds the wheel (calling onWheel). */
  ownDrag?: boolean;
  onWheel?: (factor: number) => void;
  /** Where the button's right edge and top are (when the top right corner is taken). */
  place?: () => { right: number; top: number };
};

export function createOrbit(c: SceneCtx, opts: OrbitOpts = {}) {
  const P = c.params;
  const [pMin, pMax] = opts.pitch ?? [-35, 60];
  const [zMin, zMax] = opts.zoom ?? [0.4, 4];
  const show = !c.body && c.cameraControls !== false;
  const W = c.width;
  const btn = { x: W - 118, y: 10, w: 108, h: 26 };
  const rst = { x: W - 150, y: 10, w: 26, h: 26 };
  const placeUi = () => {
    const at = opts.place ? opts.place() : { right: W - 10, top: c.cameraControls === 'below-toolbar' ? 110 : 10 };
    btn.x = at.right - btn.w;
    btn.y = at.top;
    rst.x = btn.x - 32;
    rst.y = at.top;
  };
  const hit = (b: { x: number; y: number; w: number; h: number }, x: number, y: number) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  c.registerPointerControl?.((x, y) => {
    placeUi();
    return show && (hit(btn, x, y) || (P.camOn >= 0.5 && hit(rst, x, y)));
  });
  let press: { x: number; y: number; moved: boolean; yaw: number; pitch: number } | null = null;
  let over = false;
  let hovered = false;
  let click = false;
  let version = 0;
  let last = '';
  const onWheel = (e: WheelEvent) => {
    if (!show || c.isVisible?.() === false || P.camOn < 0.5 || !over) return;
    e.preventDefault();
    const f = Math.exp(-e.deltaY * 0.0012);
    if (opts.onWheel) opts.onWheel(f);
    else P.camZoom = clamp(P.camZoom * f, zMin, zMax);
  };
  if (show) window.addEventListener('wheel', onWheel, { passive: false });
  const unregister = show
    ? registerCameraSwitch(P, 'camOn', {
        hovered: () => c.isVisible?.() !== false && hovered,
        on: () => P.camOn >= 0.5,
        set: (on) => {
          P.camOn = on ? 1 : 0;
        },
      })
    : () => {};

  return {
    get on() {
      return show && P.camOn >= 0.5;
    },
    /** Offsets from the scene's own view, radians. */
    get yaw() {
      return (P.camYaw * Math.PI) / 180;
    },
    get pitch() {
      return (clamp(P.camPitch, pMin, pMax) * Math.PI) / 180;
    },
    get zoom() {
      return clamp(P.camZoom, zMin, zMax);
    },
    /** Grows whenever the view changes. */
    get version() {
      return version;
    },
    /** Feeds the pointer; returns the pointer the scene should see. */
    update(p: ScenePointer): ScenePointer {
      const key = `${P.camOn}|${P.camYaw}|${P.camPitch}|${P.camZoom}`;
      if (key !== last) {
        last = key;
        version += 1;
      }
      if (!show) return p;
      hovered = p.active;
      placeUi();
      const onUi = hit(btn, p.rawX, p.rawY) || (P.camOn >= 0.5 && hit(rst, p.rawX, p.rawY));
      over = p.active && !onUi;
      if (p.clicked && onUi) {
        if (hit(btn, p.rawX, p.rawY)) P.camOn = P.camOn >= 0.5 ? 0 : 1;
        else {
          P.camYaw = 0;
          P.camPitch = 0;
          P.camZoom = 1;
        }
        return { ...p, pressed: false, clicked: false };
      }
      if (P.camOn < 0.5 || opts.ownDrag) return onUi ? { ...p, pressed: false, clicked: false } : p;
      if (p.clicked) press = { x: p.rawX, y: p.rawY, moved: false, yaw: P.camYaw, pitch: P.camPitch };
      if (press) {
        const dx = p.rawX - press.x;
        const dy = p.rawY - press.y;
        if (!press.moved && Math.hypot(dx, dy) > 4) press.moved = true;
        if (press.moved) {
          P.camYaw = ((((press.yaw - dx * 0.35) % 360) + 540) % 360) - 180;
          P.camPitch = clamp(press.pitch + dy * 0.25, pMin, pMax);
        }
        if (!p.pressed) {
          // Let go without moving: that was a click, for the scene.
          if (!press.moved) click = true;
          press = null;
        }
      }
      const out = { ...p, pressed: false, clicked: click };
      click = false;
      return out;
    },
    draw(g: CanvasRenderingContext2D) {
      if (!show) return;
      placeUi();
      const on = P.camOn >= 0.5;
      g.save();
      g.textBaseline = 'middle';
      g.textAlign = 'center';
      g.font = '12.5px sans-serif';
      g.lineWidth = 1;
      g.fillStyle = on ? 'rgba(74,56,22,0.88)' : 'rgba(10,10,14,0.62)';
      g.strokeStyle = on ? '#ffd27a' : 'rgba(255,255,255,0.3)';
      g.beginPath();
      g.roundRect(btn.x, btn.y, btn.w, btn.h, 7);
      g.fill();
      g.stroke();
      g.fillStyle = on ? '#ffe7b0' : '#f6eee0';
      g.fillText('🎥 Камера', btn.x + btn.w / 2, btn.y + btn.h / 2 + 1);
      if (on) {
        g.fillStyle = 'rgba(10,10,14,0.62)';
        g.strokeStyle = 'rgba(255,255,255,0.3)';
        g.beginPath();
        g.roundRect(rst.x, rst.y, rst.w, rst.h, 7);
        g.fill();
        g.stroke();
        g.fillStyle = '#f6eee0';
        g.fillText('↺', rst.x + rst.w / 2, rst.y + rst.h / 2 + 1);
        const key = isCameraAdmin() ? ' · C' : '';
        const text = opts.ownDrag ? `колесо — приближение${key}` : `тяните — поворот, колесо — приближение${key}`;
        g.font = '11.5px sans-serif';
        const tw = g.measureText(text).width + 14;
        g.fillStyle = 'rgba(10,10,14,0.6)';
        g.beginPath();
        const below = btn.y + btn.h + 26 < c.height;
        const ty = below ? btn.y + btn.h + 6 : btn.y - 26;
        g.roundRect(btn.x + btn.w - tw, ty, tw, 20, 6);
        g.fill();
        g.fillStyle = '#f6eee0';
        g.textAlign = 'right';
        g.fillText(text, btn.x + btn.w - 7, ty + 10);
      }
      g.restore();
    },
    dispose() {
      if (show) window.removeEventListener('wheel', onWheel);
      unregister();
    },
  };
}

export type Orbit = ReturnType<typeof createOrbit>;

/** The view the control has set (for an inner scene whose wrapper owns the control): yaw and pitch offsets (radians),
 * zoom. */
export function orbitView(P: SceneParams) {
  return { yaw: (P.camYaw * Math.PI) / 180, pitch: (P.camPitch * Math.PI) / 180, zoom: clamp(P.camZoom, 0.3, 5) };
}
