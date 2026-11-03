/**
 * Page mascot controller. The cat lives in a small transparent canvas that travels over the document: jumps,
 * walks and drags move the canvas along the path while the 3D cat plays the matching motion inside it, so
 * only a few hundred pixels are ever rendered. Perches are elements marked `data-cat-perch` (the cat sits on
 * their top edge) or any page point.
 */
import * as THREE from 'three';
import { buildCatMesh } from './catGeometry';
import { CatModel, type CatOutfit, type CatStyle } from './catModel';
import { ACTIONS, ADDITIVE, EMOTIONS, POSE_DEFAULTS, POSTURES, getAction, getEmotion, type ActionName, type EmotionName, type PartialPose, type Pose, type PoseKey, type SpriteKind } from './catPose';
import { clamp, jumpArc, planScroll, smooth, wrapAngle } from './catMath';

export type { ActionName, EmotionName, CatOutfit, CatStyle };
export type CatQuality = 'low' | 'medium' | 'high';
export type HighlightMode = 'ring' | 'spotlight' | 'marker' | 'laser';
export type PagePoint = { x: number; y: number };
export type CatTarget = HTMLElement | PagePoint;
/** An answer button in the speech bubble. */
export type CatAction = { label: string; primary?: boolean; onClick: () => void };
export type CatFacing = 'camera' | 'left' | 'right' | 'away';
export type CatState = { action: ActionName; emotion: EmotionName; motion: string; fps: number; triangles: number; buildMs: number; x: number; y: number };
export type CatMascotOptions = {
  size?: number; style?: CatStyle; outfit?: CatOutfit; quality?: CatQuality; start?: CatTarget;
  followCursor?: boolean; autonomy?: boolean; onState?: (state: CatState) => void;
  /** z-index of the cat; its highlight sits just below, bubble and laser just above (a tour lifts it over the site menu). */
  layer?: number;
  /** Extra elements the cat must not sit on when it points (besides perches), e.g. 'main a[href], main button'. */
  avoid?: string;
  /** Live chat commands may point at the fixed header: keep the complete canvas on screen. */
  keepOnScreen?: boolean;
};

type Jump = { kind: 'jump'; from: PagePoint; to: PagePoint; arc: ReturnType<typeof jumpArc>; t: number; dir: number; done: () => void; anchor?: Anchor; scroll?: number[] };
type Walk = { kind: 'walk'; from: PagePoint; to: PagePoint; t: number; duration: number; dir: number; done: () => void; anchor?: Anchor };
type Drag = { kind: 'drag'; pointer: PagePoint; vx: number };
type Motion = Jump | Walk | Drag;
type Anchor = { el: HTMLElement; fx: number };

/** Jump phases in seconds: turn toward the target, crouch, (flight = arc duration), landing. */
const TURN = 0.16, PREP = 0.34, LAND = 0.32, SCROLL_HZ = 60;
/** The most the page slides down to fit a bubble above the cat (px). */
const MAX_LIFT = 180;
const FOV = 26, CAM_Z = 4, CAM_Y = 0.74, LOOK_Y = 0.64, ASPECT = 1.3;
const YAW: Record<CatFacing, number> = { camera: -Math.PI / 2 + 0.42, left: Math.PI, right: 0, away: Math.PI / 2 };
const STYLE_ID = 'catm-style';
const CSS = `
.catm-wrap{position:fixed;left:0;top:0;pointer-events:none;z-index:70;will-change:transform}
.catm-wrap canvas{display:block;width:100%;height:100%}
.catm-wrap[data-debug=true]{outline:1px dashed rgba(255,80,80,.8);background:rgba(255,80,80,.05)}
.catm-bubble{position:fixed;left:0;top:0;z-index:71;max-width:260px;padding:10px 14px;border-radius:16px;background:#fff;color:#1b1d2c;
 font:600 16px/1.35 system-ui,sans-serif;box-shadow:0 6px 22px rgba(20,22,40,.22),0 0 0 2px #1b1d2c;pointer-events:none;opacity:0;transition:opacity .2s;white-space:pre-line}
.catm-bubble[data-on=true]{opacity:1}
.catm-bubble::after{content:'';position:absolute;left:var(--tail,50%);bottom:-9px;width:16px;height:16px;background:#fff;transform:translateX(-50%) rotate(45deg);box-shadow:2px 2px 0 0 #1b1d2c}
.catm-bubble[data-side=below]::after{bottom:auto;top:-9px;box-shadow:-2px -2px 0 0 #1b1d2c}
.catm-bubble[data-side=right]::after{left:-9px;bottom:auto;top:var(--tail,50%);transform:translateY(-50%) rotate(45deg);box-shadow:-2px 2px 0 0 #1b1d2c}
.catm-bubble[data-side=left]::after{left:auto;right:-9px;bottom:auto;top:var(--tail,50%);transform:translateY(-50%) rotate(45deg);box-shadow:2px -2px 0 0 #1b1d2c}
.catm-bubble small{display:block;margin-top:3px;font-weight:500;font-size:14px;color:#5b6077}
.catm-bubble:has(.catm-actions){max-width:min(330px,calc(100vw - 16px))}
.catm-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;white-space:nowrap}
.catm-actions button{font:600 15px/1.2 system-ui,sans-serif;padding:8px 14px;border-radius:999px;border:2px solid #1b1d2c;background:#fff;color:#1b1d2c;cursor:pointer}
.catm-actions button[data-primary]{background:#b3203a;border-color:#b3203a;color:#fff}
.catm-actions button:focus-visible{outline:3px solid #6aa8ff;outline-offset:2px}
.catm-bubble[data-on=true] .catm-actions{pointer-events:auto}
.catm-hl{position:fixed;pointer-events:none;z-index:65;border-radius:12px;transition:opacity .25s;opacity:0}
.catm-hl[data-on=true]{opacity:1}
.catm-hl[data-mode=ring]{box-shadow:0 0 0 3px #ffb02e,0 0 18px 6px rgba(255,176,46,.55);animation:catm-pulse 1.1s ease-in-out infinite}
.catm-hl[data-mode=spotlight]{box-shadow:0 0 0 4000px rgba(12,14,30,.55),0 0 0 3px rgba(255,255,255,.9);transition:opacity .35s}
.catm-hl[data-mode=marker]{border-radius:3px}
.catm-hl[data-mode=marker]::before{content:'';position:absolute;left:-4px;bottom:2px;height:42%;width:0;background:rgba(255,226,74,.6);border-radius:3px;mix-blend-mode:multiply;animation:catm-sweep .6s .1s ease-out forwards}
.catm-laser{position:fixed;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:#ff2b2b;box-shadow:0 0 10px 4px rgba(255,40,40,.7);pointer-events:none;z-index:72;opacity:0;transition:opacity .2s}
.catm-laser[data-on=true]{opacity:1}
.catm-shadow{position:absolute;width:90px;height:16px;margin:-8px 0 0 -45px;border-radius:50%;background:radial-gradient(rgba(15,15,35,.35),rgba(15,15,35,0) 70%);pointer-events:none;z-index:64;opacity:0}
.catm-point{position:absolute;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;border:2px solid #ff4d6d;pointer-events:none;z-index:63}
@keyframes catm-pulse{50%{box-shadow:0 0 0 5px #ffb02e,0 0 26px 10px rgba(255,176,46,.35)}}
@keyframes catm-sweep{to{width:calc(100% + 8px)}}
@media (prefers-reduced-motion: reduce){.catm-hl{animation:none!important}}`;

const pageRect = (el: Element) => { const r = el.getBoundingClientRect(); return { left: r.left + scrollX, top: r.top + scrollY, right: r.right + scrollX, bottom: r.bottom + scrollY, width: r.width, height: r.height }; };
const unionView = (els: Element[]) => {
  const rs = els.map(e => e.getBoundingClientRect()).filter(b => b.width || b.height);
  return rs.length ? { left: Math.min(...rs.map(b => b.left)), top: Math.min(...rs.map(b => b.top)), right: Math.max(...rs.map(b => b.right)), bottom: Math.max(...rs.map(b => b.bottom)) } : null;
};
const unionPage = (els: Element[]) => {
  const v = unionView(els) ?? { left: 0, top: 0, right: 0, bottom: 0 };
  return { left: v.left + scrollX, top: v.top + scrollY, right: v.right + scrollX, bottom: v.bottom + scrollY, width: v.right - v.left, height: v.bottom - v.top };
};
const isElement = (t: CatTarget): t is HTMLElement => typeof (t as HTMLElement).getBoundingClientRect === 'function';
/** Inside a fixed or sticky layer (header, open menu): sliding the page does not move it. */
const inFixedLayer = (el: Element) => {
  for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) if (/fixed|sticky/.test(getComputedStyle(e).position)) return true;
  return false;
};
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export class CatMascot {
  readonly wrap = document.createElement('div');
  private canvas = document.createElement('canvas');
  private bubble = document.createElement('div');
  private hl = document.createElement('div');
  private laser = document.createElement('div');
  private landing = document.createElement('div');
  private debugDots: HTMLElement[] = [];
  private renderer?: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, ASPECT, 0.1, 20);
  private model?: CatModel;
  private catYaw = new THREE.Group();
  private speed: THREE.Mesh[] = [];
  private hemi = new THREE.HemisphereLight('#c9d4ff', '#40342c', 1.1);
  private key = new THREE.DirectionalLight('#fff4e8', 2.3);
  private rim = new THREE.DirectionalLight('#9fb6ff', 1.6);
  private size: number;
  private quality: CatQuality;
  private style: CatStyle;
  private outfit: CatOutfit;
  private pos: PagePoint = { x: 200, y: 300 };
  private anchor?: Anchor;
  private yaw = YAW.camera;
  private yawTarget = YAW.camera;
  private action: ActionName = 'idle';
  private loopAction: ActionName = 'idle';
  private actionT = 0;
  private actionPose: PartialPose = {};
  private emotion: EmotionName = 'neutral';
  private emotionLeft = Infinity;
  private emoteIn = 2;
  private motion?: Motion;
  private motionPose: PartialPose = {};
  private airborne = false;
  private ctx = { pointAngle: 0.3, pointSide: 1 };
  /** Paw angle the pointing pose eases toward (re-aiming without a jump). */
  private pointGoal = 0.3;
  /** Where the cat last jumped to point, and how far and at what angle that first target was. */
  private pointRef: { x: number; y: number; dist: number; angle: number; dir: number } | null = null;
  private bubbleSide = 'above';
  /** How far the page is slid down to make room for the bubble (px), where it is heading, and the body's own padding. */
  private lift = 0;
  private liftGoal = 0;
  private liftBase: string | null = null;
  private quietFor = 0;
  /** The page is scrolling (e.g. the tour revealing the next target): the lift waits, the cat may be off screen. */
  private scrolling = false;
  private scrolledAt = 0;
  private cursor?: PagePoint;
  private follow: boolean;
  private autonomy: boolean;
  private idleFor = 0;
  private bubbleLeft = 0;
  private hlLeft = 0;
  private hlTargets: HTMLElement[] = [];
  private hlPad = 8;
  /** The highlight sits in a fixed layer: the cat stands by it, so the page is not slid for the bubble. */
  private hlFixed = false;
  private mouth: number | null = null;
  private avoid?: string;
  private laserT = 0;
  private raf = 0;
  private last = 0;
  private fps = 60;
  private triangles = 0;
  private buildMs = 0;
  private stateIn = 0;
  private hover = false;
  private press?: { x: number; y: number; t: number; dragging: boolean };
  private disposed = false;
  private onState?: (state: CatState) => void;
  private listeners: [EventTarget, string, EventListener][] = [];

  constructor(private opts: CatMascotOptions = {}) {
    this.size = opts.size ?? (innerWidth < 600 ? 160 : 240);
    this.quality = opts.quality ?? 'high';
    this.style = opts.style ?? 'anime';
    this.outfit = opts.outfit ?? 'plain';
    this.follow = opts.followCursor ?? true;
    this.autonomy = opts.autonomy ?? true;
    this.onState = opts.onState;
    this.avoid = opts.avoid;
  }

  async init() {
    if (!document.getElementById(STYLE_ID)) { const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; document.head.append(s); }
    this.wrap.className = 'catm-wrap'; this.wrap.append(this.canvas);
    this.bubble.className = 'catm-bubble'; this.hl.className = 'catm-hl'; this.laser.className = 'catm-laser'; this.landing.className = 'catm-shadow';
    document.body.append(this.wrap, this.bubble, this.hl, this.laser, this.landing);
    if (this.opts.layer) {
      const z = this.opts.layer;
      this.wrap.style.zIndex = String(z); this.bubble.style.zIndex = String(z + 1); this.laser.style.zIndex = String(z + 2);
      this.hl.style.zIndex = String(z - 2); this.landing.style.zIndex = String(z - 3);
    }
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'low-power' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera.position.set(0, CAM_Y, CAM_Z); this.camera.lookAt(0, LOOK_Y, 0);
    this.key.position.set(1.3, 2.4, 2.6); this.rim.position.set(-1.8, 1.6, -2.2);
    this.scene.add(this.hemi, this.key, this.rim, this.catYaw);
    this.applySize();
    this.applyQualityToRenderer();
    // Speed lines behind the cat during flight.
    const lineMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6 + Math.random() * 0.5, 0.012), lineMat); m.visible = false; this.scene.add(m); this.speed.push(m); }
    await new Promise(r => requestAnimationFrame(r));
    const data = buildCatMesh(this.quality === 'low' ? 0.014 : 0.011);
    if (this.disposed) return;
    this.buildMs = data.ms; this.triangles = data.index.length / 3;
    this.model = new CatModel(data, this.shellCount());
    this.model.setStyle(this.style); this.model.setOutfit(this.outfit);
    this.catYaw.add(this.model.group); this.scene.add(this.model.fx);
    this.applyStyleLights();
    const start = this.opts.start ?? document.querySelector<HTMLElement>('[data-cat-perch]') ?? { x: innerWidth / 2, y: innerHeight * 0.7 };
    this.placeAt(start);
    this.on(window, 'resize', () => this.reanchor());
    this.on(document, 'pointermove', e => this.onPointerMove(e as PointerEvent));
    this.on(document, 'pointerdown', e => this.onPointerDown(e as PointerEvent), false);
    this.on(document, 'pointerup', e => this.onPointerUp(e as PointerEvent));
    this.on(document, 'visibilitychange', () => { this.last = performance.now(); });
    this.on(window, 'scroll', () => { this.scrolledAt = performance.now(); this.placeElements(0); });
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private on(target: EventTarget, type: string, fn: EventListener, passive = true) { target.addEventListener(type, fn, { passive }); this.listeners.push([target, type, fn]); }
  private shellCount() { return this.quality === 'high' ? 10 : this.quality === 'medium' ? 6 : 0; }
  private get width() { return Math.round(this.size * ASPECT); }
  /** Pixels per model unit at the cat's depth. */
  private get ppu() { return this.size / (2 * Math.tan((FOV * Math.PI) / 360) * Math.hypot(CAM_Z, CAM_Y - LOOK_Y)); }
  private groundY = 0;

  private applySize() {
    this.wrap.style.width = `${this.width}px`; this.wrap.style.height = `${this.size}px`;
    this.renderer?.setSize(this.width, this.size, false);
    this.camera.aspect = ASPECT; this.camera.updateProjectionMatrix();
    const g = new THREE.Vector3(0, 0, 0).project(this.camera);
    this.groundY = ((1 - g.y) / 2) * this.size;
  }
  private applyQualityToRenderer() {
    this.renderer?.setPixelRatio(this.quality === 'low' ? 1 : this.quality === 'medium' ? Math.min(devicePixelRatio, 1.5) : Math.min(devicePixelRatio, 2));
    this.renderer?.setSize(this.width, this.size, false);
  }
  private applyStyleLights() {
    const anime = this.style === 'anime';
    this.hemi.intensity = anime ? 1.15 : 1.3; this.key.intensity = anime ? 2.2 : 3.6; this.rim.intensity = anime ? 0.6 : 3.4;
  }

  // ——— public API ———
  setStyle(style: CatStyle) { this.style = style; this.model?.setStyle(style); this.applyStyleLights(); }
  setOutfit(outfit: CatOutfit) { this.outfit = outfit; this.model?.setOutfit(outfit); if (outfit === 'teacher') this.say('Labdien! Sāksim stundu.\nДобрый день! Начнём урок.', 2600); }
  setSize(px: number) { this.size = px; this.applySize(); this.applyQualityToRenderer(); }
  setQuality(q: CatQuality) { this.quality = q; this.applyQualityToRenderer(); this.model?.setShells(this.shellCount()); this.model?.setStyle(this.style); }
  setFollowCursor(on: boolean) { this.follow = on; }
  setAutonomy(on: boolean) { this.autonomy = on; }
  setDebug(on: boolean) {
    this.wrap.dataset.debug = String(on);
    this.debugDots.forEach(d => d.remove()); this.debugDots = [];
    if (!on) return;
    for (const el of document.querySelectorAll<HTMLElement>('[data-cat-perch]')) {
      const p = this.perchPoint(el), d = document.createElement('div'); d.className = 'catm-point';
      d.style.left = `${p.x}px`; d.style.top = `${p.y}px`; document.body.append(d); this.debugDots.push(d);
    }
  }
  face(f: CatFacing) { this.yawTarget = YAW[f]; }
  /** Changes what the cat must not cover when pointing (see options.avoid). */
  setAvoid(selector?: string) { this.avoid = selector; }

  play(action: ActionName) {
    if (!(action in ACTIONS)) return;
    if (ACTIONS[action].duration === 0) this.loopAction = action;
    this.action = action; this.actionT = 0; this.idleFor = 0;
  }
  setEmotion(emotion: EmotionName, seconds = Infinity) {
    this.emotion = emotion; this.emotionLeft = seconds; this.emoteIn = 0.15; this.idleFor = 0;
  }
  emote(kind: SpriteKind) { this.model?.emote(kind); }

  /** Speech bubble; `actions` adds answer buttons under the text (the bubble then takes clicks). */
  say(text: string, ms = 3200, actions: CatAction[] = []) {
    const [main, ...rest] = text.split('\n');
    this.bubble.textContent = main;
    if (rest.length) { const s = document.createElement('small'); s.textContent = rest.join('\n'); this.bubble.append(s); }
    if (actions.length) {
      const row = document.createElement('div');
      row.className = 'catm-actions';
      for (const a of actions) {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = a.label;
        if (a.primary) b.dataset.primary = '';
        b.addEventListener('click', a.onClick);
        row.append(b);
      }
      this.bubble.append(row);
    }
    this.bubble.dataset.on = 'true'; this.bubbleLeft = ms / 1000;
  }
  /** The bubble shows a question with answer buttons (stroking the cat must not replace it). */
  private asking() { return this.bubble.dataset.on === 'true' && !!this.bubble.querySelector('.catm-actions'); }

  /** Jumps, or walks when the target is close on the same level. Resolves on landing. */
  goTo(target: CatTarget, fx = 0.5) {
    const to = isElement(target) ? this.perchPoint(target, fx) : target;
    return Math.abs(to.y - this.pos.y) < 6 && Math.abs(to.x - this.pos.x) < 260 && Math.abs(to.x - this.pos.x) > 8 ? this.walkTo(target, fx) : this.jumpTo(target, fx);
  }
  jumpTo(target: CatTarget, fx = 0.5): Promise<void> {
    const to = isElement(target) ? this.perchPoint(target, fx) : { ...target };
    const anchor = isElement(target) ? { el: target, fx } : undefined;
    this.finishMotion();
    this.pointRef = null;
    return new Promise(done => {
      const dx = to.x - this.pos.x;
      const jump: Jump = { kind: 'jump', from: { ...this.pos }, to, arc: jumpArc(this.pos.x, this.pos.y, to.x, to.y, this.headerBottom() + this.groundY * 0.85), t: 0, dir: Math.abs(dx) < 30 ? 0 : Math.sign(dx), done, anchor };
      jump.scroll = this.planJumpScroll(jump);
      this.motion = jump;
      this.anchor = undefined; this.idleFor = 0;
      this.landing.style.left = `${to.x}px`; this.landing.style.top = `${to.y}px`;
    });
  }
  walkTo(target: CatTarget, fx = 0.5): Promise<void> {
    const to = isElement(target) ? this.perchPoint(target, fx) : { ...target };
    const anchor = isElement(target) ? { el: target, fx } : undefined;
    this.finishMotion();
    this.pointRef = null;
    return new Promise(done => {
      const dist = Math.hypot(to.x - this.pos.x, to.y - this.pos.y);
      this.motion = { kind: 'walk', from: { ...this.pos }, to, t: 0, duration: 0.25 + dist / (0.62 * this.ppu), dir: Math.sign(to.x - this.pos.x) || 1, done, anchor };
      this.anchor = undefined; this.idleFor = 0;
    });
  }
  /** Visits each target in turn with a little reaction on every perch. */
  async tour(targets: CatTarget[], react: ActionName[] = ['lookAround', 'wave', 'nod', 'groom']) {
    for (const [i, t] of targets.entries()) {
      await this.goTo(t);
      this.play(react[i % react.length]);
      await sleep(1700);
      if (this.disposed) return;
    }
  }

  /** Lands beside the element, turns to it and points while it is highlighted. */
  async pointAt(target: HTMLElement | HTMLElement[], mode: HighlightMode = 'ring', text?: string, ms = 4200) {
    // Sit outside the block that holds the target (never on top of its text); without room, sit on the block.
    const els = Array.isArray(target) ? target : [target], el = els[0];
    const r = unionPage(els), perch = el.closest<HTMLElement>('[data-cat-perch]'), box = perch && els.length === 1 ? pageRect(perch) : r;
    const half = this.width * 0.3, tall = this.ppu * 1.05, view = document.documentElement.clientWidth;
    const cy = r.top + Math.min(r.height, 160) / 2, ground = cy + this.ppu * 0.45;
    // Other blocks the cat must not cover; the target itself and its ancestors or parts do not count.
    const blocks = Array.from(document.querySelectorAll<HTMLElement>(['[data-cat-perch]', this.avoid].filter(Boolean).join(', ')))
      .filter(n => !els.some(e => e === n || e.contains(n) || n.contains(e))).map(pageRect).filter(b => b.width && b.height);
    const free = (x: number) => x - half >= scrollX && x + half <= scrollX + view
      && blocks.every(b => b.right < x - half || b.left > x + half || b.bottom < ground - tall || b.top > ground);
    let side = 0, x = clamp(r.left + r.width / 2, box.left + 40, box.right - 40), y = box.top;
    for (const s of [1, -1]) {
      const at = s > 0 ? box.right + half + 6 : box.left - half - 6;
      if (free(at)) { side = s; x = at; y = ground; break; }
    }
    if (this.opts.keepOnScreen) y = Math.max(y, scrollY + this.groundY + 8);
    const cx = r.left + r.width / 2;
    // Close to where the cat already points from: only the paw moves.
    if (this.canReach(r)) {
      this.ctx.pointSide = 0;
      this.pointGoal = this.pawAngle(this.pos.x, this.pos.y, cx, cy);
      if (this.action === 'point') this.actionT = Math.min(this.actionT, 0.3); else this.play('point');
      this.highlight(els, mode, ms);
      if (text) this.say(text, ms);
      return;
    }
    this.highlight(els, mode, 0);
    await this.jumpTo({ x, y });
    const angle = this.pawAngle(x, y, cx, cy);
    this.ctx.pointSide = 0;
    this.ctx.pointAngle = this.pointGoal = angle;
    this.pointRef = { x, y, dist: Math.hypot(cx - x, cy - (y - this.ppu * 0.5)), angle, dir: Math.sign(cx - x) };
    this.yawTarget = side > 0 ? -Math.PI + 0.65 : side < 0 ? -0.65 : cx < x ? -Math.PI + 0.9 : -0.9;
    this.play('point');
    this.highlight(els, mode, ms);
    if (text) this.say(text, ms);
  }

  /** Paw angle from the shoulder of a cat standing at (x, y) to a point (page coordinates). */
  private pawAngle(x: number, y: number, tx: number, ty: number) {
    return Math.atan2(y - this.ppu * 0.5 - ty, Math.max(Math.abs(tx - x), this.ppu * 0.3));
  }

  /**
   * Whether the cat can point at `r` from where it stands: it has not moved since its last pointing jump, the target
   * is on the same side, not more than 30 % further than the first one, the paw turns less than ~35° and stays in its
   * range, the cat does not cover the target and is on screen.
   */
  private canReach(r: { left: number; right: number; top: number; bottom: number; width: number; height: number }) {
    const ref = this.pointRef;
    if (!ref || this.motion || Math.hypot(this.pos.x - ref.x, this.pos.y - ref.y) > 2) return false;
    const cx = r.left + r.width / 2, cy = r.top + Math.min(r.height, 160) / 2;
    const dir = Math.sign(cx - this.pos.x);
    if (dir !== ref.dir || Math.abs(cx - this.pos.x) < this.ppu * 0.3) return false;
    const dist = Math.hypot(cx - this.pos.x, cy - (this.pos.y - this.ppu * 0.5));
    if (dist > Math.max(ref.dist * 1.3, this.ppu * 0.8)) return false;
    const angle = this.pawAngle(this.pos.x, this.pos.y, cx, cy);
    if (Math.abs(angle - ref.angle) > 0.6 || angle < -0.9 || angle > 1.1) return false;
    const half = this.width * 0.3, tall = this.ppu * 1.05;
    const covers = !(r.right < this.pos.x - half || r.left > this.pos.x + half || r.bottom < this.pos.y - tall || r.top > this.pos.y);
    const onScreen = this.pos.y - tall * 0.6 >= scrollY + this.headerBottom() && this.pos.y <= scrollY + innerHeight
      && this.pos.x - half >= scrollX && this.pos.x + half <= scrollX + document.documentElement.clientWidth;
    return !covers && onScreen;
  }
  /** Highlights one element or the union of several; follows them every frame (also fixed headers and menus). */
  highlight(target: HTMLElement | HTMLElement[], mode: HighlightMode, ms = 4000) {
    this.hlTargets = Array.isArray(target) ? target : [target];
    this.hlPad = mode === 'marker' ? 2 : 8;
    this.hlFixed = this.hlTargets.some(inFixedLayer);
    if (this.hlFixed) this.liftGoal = 0;
    this.placeHighlight();
    this.hl.dataset.mode = mode === 'laser' ? 'ring' : mode;
    this.hl.style.visibility = mode === 'laser' ? 'hidden' : 'visible';
    if (mode === 'marker') { this.hl.dataset.on = 'false'; void this.hl.offsetWidth; }
    this.hl.dataset.on = 'true'; this.laser.dataset.on = String(mode === 'laser');
    this.hlLeft = ms ? ms / 1000 : 1e9;
  }
  clearHighlight() { this.hl.dataset.on = 'false'; this.laser.dataset.on = 'false'; this.hlTargets = []; this.hlFixed = false; }
  /** Opens the mouth to `level` (0..1) on top of the pose, e.g. driven by speech loudness; null releases it. */
  setMouth(level: number | null) { this.mouth = level; }
  private placeHighlight() {
    const r = unionView(this.hlTargets), pad = this.hlPad;
    if (!r) return;
    Object.assign(this.hl.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.right - r.left + pad * 2}px`, height: `${r.bottom - r.top + pad * 2}px` });
  }

  // ——— internals ———
  private perchPoint(el: HTMLElement, fx = Number(el.dataset.catPerchX ?? 0.5)): PagePoint {
    const r = pageRect(el);
    return { x: clamp(r.left + r.width * fx, r.left + 30, r.right - 30), y: r.top };
  }
  private placeAt(target: CatTarget) {
    this.pos = isElement(target) ? this.perchPoint(target) : { ...target };
    this.anchor = isElement(target) ? { el: target, fx: Number(target.dataset.catPerchX ?? 0.5) } : undefined;
  }
  private reanchor() { if (this.anchor && !this.motion) this.pos = this.perchPoint(this.anchor.el, this.anchor.fx); }
  private finishMotion() { if (this.motion && this.motion.kind !== 'drag') this.motion.done(); this.motion = undefined; this.motionPose = {}; }

  private hit(e: PointerEvent) {
    if (!this.model) return false;
    const r = this.canvas.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return false;
    const v = new THREE.Vector3(), rad = 0.2 * this.ppu;
    for (const name of ['head', 'spine2', 'spine1', 'hips']) {
      this.model.bones[name].getWorldPosition(v).project(this.camera);
      const px = r.left + ((v.x + 1) / 2) * r.width, py = r.top + ((1 - v.y) / 2) * r.height;
      if (Math.hypot(px - e.clientX, py - e.clientY) < rad) return true;
    }
    return false;
  }
  private onPointerMove(e: PointerEvent) {
    this.cursor = { x: e.pageX, y: e.pageY };
    if (this.press && !this.press.dragging && Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) > 6) {
      this.press.dragging = true; this.finishMotion(); this.anchor = undefined;
      this.motion = { kind: 'drag', pointer: { x: e.pageX, y: e.pageY }, vx: 0 };
      this.setEmotion('surprised', 1.2);
    }
    if (this.motion?.kind === 'drag') { this.motion.vx = e.pageX - this.motion.pointer.x; this.motion.pointer = { x: e.pageX, y: e.pageY }; }
    const over = this.hit(e);
    if (over !== this.hover) { this.hover = over; document.documentElement.style.cursor = over ? 'grab' : ''; }
  }
  private onPointerDown(e: PointerEvent) {
    if (this.bubble.contains(e.target as Node) || !this.hit(e)) return;
    // Grabbing the cat must not start a text selection or a native drag on the page beneath it.
    e.preventDefault();
    this.press = { x: e.clientX, y: e.clientY, t: performance.now(), dragging: false };
  }
  private onPointerUp(e: PointerEvent) {
    const press = this.press; this.press = undefined;
    if (!press) return;
    if (!press.dragging) { this.setEmotion('love', 3); this.play('knead'); if (!this.asking()) this.say('Murr…\nМурр…', 1800); return; }
    // Dropped: fall onto the closest perch below the pointer, or straight down onto the page.
    const p = { x: e.pageX, y: e.pageY + this.ppu * 0.75 };
    let best: PagePoint | undefined, bestEl: HTMLElement | undefined;
    for (const el of document.querySelectorAll<HTMLElement>('[data-cat-perch]')) {
      const r = pageRect(el);
      if (p.x < r.left - 10 || p.x > r.right + 10 || r.top < p.y - 30) continue;
      if (!best || r.top < best.y) { best = { x: clamp(p.x, r.left + 30, r.right - 30), y: r.top }; bestEl = el; }
    }
    this.motion = undefined; this.pos = p;
    void this.jumpTo(bestEl ?? best ?? { x: p.x, y: Math.min(p.y + 200, document.documentElement.scrollHeight - 20) }, bestEl && best ? (best.x - pageRect(bestEl).left) / pageRect(bestEl).width : 0.5).then(() => { this.setEmotion('embarrassed', 2.5); this.emote('sweat'); });
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    if (!this.model || !this.renderer || document.hidden) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.fps += (1 / Math.max(dt, 1e-3) - this.fps) * 0.05;
    this.step(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private step(dt: number) {
    const model = this.model!;
    // Action / emotion timing.
    const prevT = this.actionT;
    this.actionT += dt;
    const action = getAction(this.action);
    for (const [at, kind] of action.sprites ?? []) if (prevT < at && this.actionT >= at) model.emote(kind);
    if (action.duration && this.actionT > action.duration) { this.action = this.loopAction; this.actionT = 0; }
    this.emotionLeft -= dt;
    if (this.emotionLeft <= 0 && this.emotion !== 'neutral') this.setEmotion('neutral');
    const em = getEmotion(this.emotion);
    if (em.sprites && em.every) { this.emoteIn -= dt; if (this.emoteIn <= 0) { this.emoteIn = em.every * (0.7 + Math.random() * 0.6); model.emote(em.sprites[Math.floor(Math.random() * em.sprites.length)]); } }
    this.idleFor += dt;
    if (this.autonomy && !this.motion && this.idleFor > 11 && ACTIONS[this.action].duration === 0) {
      const pick: ActionName[] = ['groom', 'yawn', 'lookAround', 'stretch', 'wave'];
      this.play(pick[Math.floor(Math.random() * pick.length)]);
    }
    this.stepMotion(dt);
    this.ctx.pointAngle += (this.pointGoal - this.ctx.pointAngle) * (1 - Math.exp(-7 * dt));
    // Facing.
    this.yaw += wrapAngle(this.yawTarget - this.yaw) * (1 - Math.exp(-(this.motion ? 12 : 6) * dt));
    this.catYaw.rotation.y = this.yaw;
    model.update(this.composePose(), dt, this.motion?.kind === 'jump' ? 2.6 : 1);
    model.setShadowOpacity(this.motion?.kind === 'jump' || this.motion?.kind === 'drag' ? 0.15 : 1);
    this.placeElements(dt);
    this.stateIn -= dt;
    if (this.onState && this.stateIn <= 0) {
      this.stateIn = 0.25;
      this.onState({ action: this.action, emotion: this.emotion, motion: this.motion?.kind ?? 'none', fps: Math.round(this.fps), triangles: this.triangles, buildMs: Math.round(this.buildMs), x: Math.round(this.pos.x), y: Math.round(this.pos.y) });
    }
  }

  private composePose(): Pose {
    const action = getAction(this.action);
    const target: Pose = { ...POSE_DEFAULTS, ...POSTURES[action.posture] };
    this.actionPose = action.pose(this.actionT, this.ctx);
    Object.assign(target, this.actionPose);
    const em = getEmotion(this.emotion).pose;
    for (const key in em) {
      const k = key as PoseKey, v = em[k] as number;
      if (ADDITIVE.has(k)) target[k] += v; else if (!(k in this.actionPose)) target[k] = v;
    }
    Object.assign(target, this.motionPose);
    if (this.mouth !== null) target.jaw = Math.max(target.jaw, this.mouth);
    if (this.follow && this.cursor && !this.motion && !action.lockHead && this.model) {
      const head = new THREE.Vector3(); this.model.headTop.getWorldPosition(head).project(this.camera);
      const r = this.wrap.getBoundingClientRect();
      const hx = r.left + scrollX + ((head.x + 1) / 2) * this.width, hy = r.top + scrollY + ((1 - head.y) / 2) * this.size;
      // Direction to the cursor in the cat's own frame (x forward, z left).
      const dir = new THREE.Vector3(this.cursor.x - hx, -(this.cursor.y - hy), 260).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.yaw);
      const yaw = clamp(Math.atan2(-dir.z, dir.x), -1.1, 1.1), pitch = clamp(Math.atan2(dir.y, Math.hypot(dir.x, dir.z)), -0.6, 0.6);
      target.headYaw += yaw * 0.6; target.headPitch += pitch * 0.55; target.lookX += yaw * 0.9; target.lookY += pitch * 1.4;
    }
    return target;
  }

  private stepMotion(dt: number) {
    const m = this.motion;
    this.airborne = false;
    if (!m) { this.motionPose = {}; return; }
    if (m.kind === 'drag') {
      this.pos = { x: m.pointer.x, y: m.pointer.y + this.ppu * 0.75 };
      m.vx *= 0.85;
      this.motionPose = { legsBody: 1, hips: 0, spine1: 0.05, spine2: 0.05, bodyPitch: 0.85 + clamp(m.vx * 0.01, -0.3, 0.3), bodyY: 0.05, flX: 0.24, flY: -0.12, frX: 0.24, frY: -0.12, hlX: -0.36, hlY: -0.08, hrX: -0.32, hrY: -0.08, tailLift: -1.1, tailWave: 0.4, tailSpeed: 2, earBackL: 0.4, earBackR: 0.4, neck: 0.25, headPitch: -0.45 };
      this.yawTarget = YAW.camera - clamp(m.vx * 0.02, -0.5, 0.5);
      return;
    }
    m.t += dt;
    if (m.kind === 'walk') {
      if (m.t < 0.2) { this.yawTarget = m.dir > 0 ? YAW.right : YAW.left; this.motionPose = {}; return; }
      const u = clamp((m.t - 0.2) / m.duration, 0, 1);
      this.pos = { x: m.from.x + (m.to.x - m.from.x) * u, y: m.from.y + (m.to.y - m.from.y) * u };
      if (this.action !== 'walk') this.play('walk');
      this.motionPose = {};
      if (u >= 1) { this.pos = m.to; this.anchor = m.anchor; this.motion = undefined; this.play('idle'); this.yawTarget = YAW.camera; m.done(); }
      return;
    }
    // Jump: turn, crouch with a butt wiggle, fly, land. The page scrolls along the plan made at take-off.
    const turn = m.dir ? TURN : 0, air = m.arc.duration, t = m.t;
    if (m.scroll) {
      const f = clamp(t * SCROLL_HZ, 0, m.scroll.length - 1), i = Math.floor(f), j = Math.min(i + 1, m.scroll.length - 1);
      const y = m.scroll[i] + (m.scroll[j] - m.scroll[i]) * (f - i);
      if (Math.abs(y - scrollY) > 0.5) window.scrollTo(scrollX, y);
    }
    if (m.dir) this.yawTarget = m.dir > 0 ? YAW.right : YAW.left;
    if (t < turn + PREP) {
      const c = smooth(turn, turn + 0.2, t);
      this.motionPose = { ...POSTURES.crouch, bodyY: -0.13 * c, bend: Math.sin(t * 38) * 0.07 * smooth(turn + 0.1, turn + PREP, t), pupil: 0.72, earBackL: -0.25, earBackR: -0.25, tailWave: 0.05 };
      this.landing.style.opacity = '0';
    } else if (t < turn + PREP + air) {
      const s = (t - turn - PREP) / air;
      const [x, y] = m.arc.at(s), [vx, vy] = m.arc.velocity(s);
      this.pos = { x, y };
      const pitch = clamp(Math.atan2(-vy, Math.abs(vx) + 1e-3) * 0.75, -0.95, 0.95);
      const reach = smooth(0.45, 0.85, s);
      this.motionPose = {
        legsBody: 1, bodyPitch: pitch, bodyY: 0.04, stretch: 1.1 - 0.08 * reach, squash: 0.96 + 0.04 * reach, hips: 0, spine1: 0, spine2: 0, neck: 0.15, headPitch: -0.1 - pitch * 0.5,
        flRaise: 1 - reach, frRaise: 1 - reach, flA1: 0.15, flA2: 0.05, flA3: -0.1, frA1: 0.1, frA2: 0, frA3: -0.15,
        flX: 0.3, flY: -0.06, frX: 0.32, frY: -0.05,
        hlX: -0.5 + 0.28 * reach, hlY: 0.2 - 0.06 * reach, hlMeta: -2.4 + 1.3 * reach, hrX: -0.52 + 0.3 * reach, hrY: 0.21 - 0.06 * reach, hrMeta: -2.4 + 1.3 * reach,
        tailLift: 0.25 + pitch * 0.4, tailCurl: 0.1, tailWave: 0.06, earBackL: 0.35, earBackR: 0.35, pupil: 0.8, lidUp: 0,
      };
      this.landing.style.opacity = String(0.3 + 0.7 * s);
      this.airborne = true;
    } else if (t < turn + PREP + air + LAND) {
      const u = (t - turn - PREP - air) / LAND;
      this.pos = { ...m.to };
      const squash = Math.sin(u * Math.PI);
      this.motionPose = { ...POSTURES.crouch, squash: 1 - 0.12 * squash, stretch: 1 + 0.06 * squash, bodyY: -0.12 * squash };
      this.landing.style.opacity = '0';
    } else {
      this.pos = { ...m.to }; this.anchor = m.anchor; this.motion = undefined; this.motionPose = {};
      this.yawTarget = YAW.camera;
      this.play(this.loopAction === 'walk' ? 'idle' : this.loopAction);
      m.done();
    }
  }

  /**
   * Scroll for the whole jump, decided at take-off: the full canvas (cat, ears, tail) stays between the fixed
   * site header and the bottom of the viewport at every moment, including the apex. Undefined when no scrolling
   * is needed, so a still page is never touched.
   */
  private planJumpScroll(m: Jump) {
    const turn = m.dir ? TURN : 0, total = turn + PREP + m.arc.duration + LAND;
    // The canvas keeps some empty room above the ears; the cat itself reaches ~85% of it.
    const above = this.groundY * 0.85, below = this.size - this.groundY + 6;
    const spans = Array.from({ length: Math.ceil(total * SCROLL_HZ) + 1 }, (_, i) => {
      const t = i / SCROLL_HZ, s = (t - turn - PREP) / m.arc.duration;
      const y = s <= 0 ? m.from.y : s >= 1 ? m.to.y : m.arc.at(s)[1];
      return { top: y - above, bottom: y + below };
    });
    const max = document.documentElement.scrollHeight - innerHeight;
    const plan = planScroll(spans, scrollY, Math.max(0, max), this.headerBottom() + 8, innerHeight - 8);
    return plan.some(v => Math.abs(v - scrollY) > 1) ? plan : undefined;
  }
  /** Bottom edge of fixed or sticky bars at the top of the viewport (the site header). */
  private headerBottom() {
    let bottom = 0;
    for (let el = document.elementFromPoint(innerWidth / 2, 2); el && el !== document.body; el = el.parentElement) {
      const p = getComputedStyle(el).position;
      if (p === 'fixed' || p === 'sticky') bottom = Math.max(bottom, el.getBoundingClientRect().bottom);
    }
    return clamp(bottom, 0, innerHeight * 0.3);
  }

  /**
   * Puts the speech bubble above the head, or else beside or below the cat, whichever stays on screen, never covers
   * the cat itself and does not cover what is highlighted (e.g. a search field in the header). It may lie over the
   * site header: only the top of the screen limits it. Viewport coordinates.
   * The side is only chosen while the cat stands still (and kept while it still fits); in a jump or walk the bubble
   * keeps its side and just follows the head inside the screen. When no side fits (a cat at the very top of a phone
   * screen), the side that covers the least of the cat, then of the highlight, wins.
   */
  private placeBubble(hx: number, hy: number, catLeft: number, catTop: number) {
    const bw = this.bubble.offsetWidth, bh = this.bubble.offsetHeight, vw = document.documentElement.clientWidth;
    const avoid = this.hlTargets.length ? unionView(this.hlTargets) : null, minTop = 8, maxTop = Math.max(minTop, innerHeight - bh - 8);
    const body = { left: catLeft + this.width * 0.3, right: catLeft + this.width * 0.7, foot: catTop + this.groundY };
    const cat = { left: body.left, right: body.right, top: hy - 6, bottom: body.foot };
    const options: { side: string; x: number; y: number }[] = [
      { side: 'above', x: hx - bw / 2, y: hy - bh - 26 },
      { side: 'right', x: body.right + 14, y: hy - bh * 0.35 },
      { side: 'left', x: body.left - bw - 14, y: hy - bh * 0.35 },
      { side: 'below', x: hx - bw / 2, y: body.foot + 16 },
    ].map(o => ({ ...o, x: clamp(o.x, 8, vw - bw - 8), y: clamp(o.y, minTop, maxTop) }));
    const overlap = (o: { x: number; y: number }, r: { left: number; right: number; top: number; bottom: number } | null) => !r ? 0
      : Math.max(0, Math.min(o.x + bw, r.right + 4) - Math.max(o.x, r.left - 4)) * Math.max(0, Math.min(o.y + bh, r.bottom + 4) - Math.max(o.y, r.top - 4));
    const cost = (o: { x: number; y: number }) => overlap(o, cat) * 4 + overlap(o, avoid);
    const current = options.find(o => o.side === this.bubbleSide) ?? options[0];
    const best = () => options.reduce((a, b) => cost(b) < cost(a) ? b : a);
    let pick = this.motion || cost(current) === 0 ? current : best();
    if (!this.motion && !this.scrolling && !this.hlFixed && hy >= 0 && body.foot <= innerHeight) {
      // Not enough room above a standing cat at the top of the screen: the page slides down to make it (see liftPage).
      const short = minTop - (hy - bh - 26);
      if (cost(pick) > 0 && short > 0 && this.lift + short <= MAX_LIFT) { this.liftGoal = this.lift + short + 4; pick = options[0]; }
      else if (pick.side === 'above' && this.lift > 0) this.liftGoal = clamp(this.lift + short + 4, 0, this.liftGoal);
    }
    this.bubbleSide = pick.side;
    const { x, y } = pick;
    this.bubble.dataset.side = pick.side;
    this.bubble.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    const tail = pick.side === 'above' || pick.side === 'below' ? clamp(hx - x, 18, bw - 18) : clamp(hy - y, 16, bh - 16);
    this.bubble.style.setProperty('--tail', `${tail}px`);
  }

  /**
   * Slides the whole page down by `lift` px (body padding) so a bubble fits above a cat standing at the very top of
   * the screen; the cat and its pointing reference move with the content. Changes only while the cat stands still,
   * and slides back once it has been quiet for a moment.
   */
  private liftPage(dt: number) {
    this.scrolling = performance.now() - this.scrolledAt < 200;
    if (this.motion || this.scrolling) return;
    this.quietFor = this.bubbleLeft > 0 ? 0 : this.quietFor + dt;
    if (this.quietFor > 0.8) this.liftGoal = 0;
    const next = Math.abs(this.liftGoal - this.lift) < 0.5 ? this.liftGoal : this.lift + (this.liftGoal - this.lift) * (1 - Math.exp(-dt * 7));
    if (next === this.lift) return;
    const d = next - this.lift;
    this.lift = next;
    // A cat by a fixed layer stays put while the page slides back under it.
    if (!this.hlFixed) { this.pos.y += d; if (this.pointRef) this.pointRef.y += d; }
    const root = document.documentElement.style;
    if (this.liftBase === null) { this.liftBase = getComputedStyle(document.body).paddingTop; root.overflowAnchor = 'none'; }
    document.body.style.paddingTop = `calc(${this.liftBase} + ${next.toFixed(1)}px)`;
    if (!next) this.unlift();
  }
  private unlift() {
    if (this.liftBase === null) return;
    document.body.style.paddingTop = ''; document.documentElement.style.overflowAnchor = '';
    this.liftBase = null; this.lift = this.liftGoal = 0;
  }

  private placeElements(dt: number) {
    this.liftPage(dt);
    const left = this.pos.x - this.width / 2, top = this.pos.y - this.groundY;
    // Fixed layers never widen the page; page coordinates are converted every frame.
    this.wrap.style.transform = `translate3d(${(left - scrollX).toFixed(1)}px, ${(top - scrollY).toFixed(1)}px, 0)`;
    if (this.bubbleLeft > 0) {
      this.bubbleLeft -= dt;
      const head = new THREE.Vector3(); this.model!.headTop.getWorldPosition(head).project(this.camera);
      const hx = left + ((head.x + 1) / 2) * this.width, hy = top + ((1 - head.y) / 2) * this.size;
      this.placeBubble(hx - scrollX, hy - scrollY, left - scrollX, top - scrollY);
      if (this.bubbleLeft <= 0) this.bubble.dataset.on = 'false';
    }
    if (this.hlTargets.length) {
      this.hlLeft -= dt;
      this.placeHighlight();
      const r = this.laser.dataset.on === 'true' && unionView(this.hlTargets);
      if (r) {
        this.laserT += dt;
        this.laser.style.left = `${r.left + (r.right - r.left) * (0.5 + 0.32 * Math.cos(this.laserT * 2.3))}px`;
        this.laser.style.top = `${r.top + (r.bottom - r.top) * (0.5 + 0.28 * Math.sin(this.laserT * 3.1))}px`;
      }
      if (this.hlLeft <= 0) this.clearHighlight();
    }
    // Speed lines while airborne.
    const flying = this.airborne && this.motion?.kind === 'jump';
    this.speed.forEach((line, i) => {
      line.visible = flying;
      if (!flying) return;
      const m = this.motion as Jump, dir = m.dir || 1, phase = (performance.now() / 260 + i * 0.37) % 1;
      line.position.set(-dir * (0.6 + phase * 0.9), 0.15 + (i / 6) * 0.75, -0.4);
      (line.material as THREE.MeshBasicMaterial).opacity = 0.45 * Math.sin(phase * Math.PI);
    });
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const [t, type, fn] of this.listeners) t.removeEventListener(type, fn);
    document.documentElement.style.cursor = '';
    this.unlift();
    this.model?.dispose();
    for (const m of this.speed) m.geometry.dispose();
    (this.speed[0]?.material as THREE.Material | undefined)?.dispose();
    this.renderer?.dispose();
    this.debugDots.forEach(d => d.remove());
    this.wrap.remove(); this.bubble.remove(); this.hl.remove(); this.laser.remove(); this.landing.remove();
  }
}

export const CAT_ACTIONS = Object.entries(ACTIONS).map(([id, a]) => ({ id: id as ActionName, label: a.label }));
export const CAT_EMOTIONS = Object.entries(EMOTIONS).map(([id, e]) => ({ id: id as EmotionName, label: e.label }));
