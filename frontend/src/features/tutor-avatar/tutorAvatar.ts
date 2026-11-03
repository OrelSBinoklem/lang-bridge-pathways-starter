/**
 * 3D tutor avatar from a VRM model. The body plays motion-captured clips (Mixamo, retargeted and fitted to the
 * model's body offline, see tools/avatar/convert-mixamo.mjs): a loop per state or
 * idle stance and one-shot motions cross-faded on top. Head offsets, gaze, blinking, emotions and lip sync from any
 * audio routed through an AnalyserNode are layered over the clips. Renders into its own canvas inside `host`, only
 * while visible.
 */
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, VRMExpression, VRMExpressionMorphTargetBind, type VRM, type VRMHumanBoneName } from '@pixiv/three-vrm';
import { EMOTIONS, IDLE_ACTS, MOTIONS, STATE_LOOPS, STATES, type AvatarState, type Emotion, type EmotionName, type Framing, type Motion, type MotionName, type StatePose } from './avatarPose';
import { LipSync, NO_VISEMES, type Visemes } from './lipSync';
import { buildMotionClip, loadMotion } from './motionClips';
import { ClothPhysics } from './clothPhysics';

export type TutorAvatarOptions = {
  url: string;
  /** Folder of this model's motions (fitted to its body), ending with '/'. */
  motions: string;
  framing?: Framing; followPointer?: boolean; onProgress?: (share: number) => void;
  /** Idle life: changes stance and now and then does something on its own (default on). */
  autonomy?: boolean;
  /** Reports what the avatar just did on its own (for the test page). */
  onAct?: (label: string) => void;
};

const FRAMES: Record<Framing, { height: number; width: number }> = {
  portrait: { height: 0.5, width: 0.45 },
  bust: { height: 0.95, width: 0.8 },
  full: { height: 1.78, width: 0.62 },
};
/** Motions during which the eyes follow the head instead of the viewer. */
const LOOK_AWAY = new Set<MotionName>(['lookAround', 'lookingAround', 'looking', 'lookBehind', 'stretch', 'yawn', 'bored', 'turnLeft', 'walkCircle', 'rope', 'phone']);
const FADE = 0.45;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const approach = (from: number, to: number, rate: number, dt: number) => from + (to - from) * (1 - Math.exp(-rate * dt));

type MeshDef = { extras?: { targetNames?: string[] }; primitives: { extras?: { targetNames?: string[] } }[] };
/** VRM 0.0 exports keep morph names on the primitives, where three.js does not look; without them they are numbers. */
function nameMorphs(gltf: GLTF) {
  const meshes = (gltf.parser.json as { meshes?: MeshDef[] }).meshes ?? [];
  gltf.scene.traverse(o => {
    const mesh = o as THREE.Mesh, ref = gltf.parser.associations.get(mesh);
    if (!mesh.morphTargetDictionary || ref?.meshes == null) return;
    const def = meshes[ref.meshes], names = def?.extras?.targetNames ?? def?.primitives[0]?.extras?.targetNames;
    if (names && mesh.morphTargetDictionary[names[0]] == null) mesh.morphTargetDictionary = Object.fromEntries(names.map((n, i) => [n, i]));
  });
}

/** One playing clip; exactly one layer has target 1, the others fade out. */
type Layer = { name: MotionName; action: THREE.AnimationAction; once: boolean; weight: number; target: number };

export class TutorAvatar {
  readonly canvas = document.createElement('canvas');
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(20, 1, 0.1, 20);
  private lookTarget = new THREE.Object3D();
  private vrm: VRM | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private clips = new Map<MotionName, Promise<THREE.AnimationClip | null>>();
  private layers: Layer[] = [];
  private base: Layer | null = null;
  private once: Layer | null = null;
  private motionToken = 0;
  private baseToken = 0;
  private hipsRest = new THREE.Vector3();
  private framing: Framing;
  private frameFrom = new THREE.Vector3();
  private frameTo = new THREE.Vector3();
  private frameBlend = 1;
  private headY = 1.4;
  private state: AvatarState = 'idle';
  private pose: StatePose = { ...STATES.idle.pose };
  private emotion: EmotionName = 'neutral';
  private emotionTimer = 0;
  private emotionWeights = new Map<EmotionName, number>();
  private autonomy: boolean;
  private manualEmotion = false;
  private stanceAt = 0;
  private actAt = 0;
  private tiltStart = -10;
  private nodStart = -10;
  private blinkAt = 0;
  private blinkStart = -1;
  private glance = { x: 0, y: 0, until: 0, next: 0 };
  private nodAt = 0;
  private pointer: { x: number; y: number } | null = null;
  private followPointer: boolean;
  private lip: LipSync | null = null;
  private visemes: Visemes = { ...NO_VISEMES };
  private beat = 0;
  private audio: { ctx: AudioContext; analyser: AnalyserNode; element: HTMLAudioElement | null } | null = null;
  private time = 0;
  private last = 0;
  private raf = 0;
  private visible = true;
  private disposed = false;
  private observers: { disconnect(): void }[] = [];
  private tmpQ = new THREE.Quaternion();
  /** Bone rotations as the clips left them, before this frame's head/spine offsets. */
  private beforeOverlay = new Map<THREE.Object3D, THREE.Quaternion>();
  private cloth: ClothPhysics | null = null;
  /** Smoothed gaze (glances and the pointer jump; the head and eyes follow this). */
  private gazeNow = { x: 0, y: 0 };
  private tmpE = new THREE.Euler();
  private tmpV = new THREE.Vector3();
  /** -1 for VRM 0.0: its normalized bones face -Z, so offsets about x and z turn the other way. */
  private flip = 1;

  constructor(private host: HTMLElement, private options: TutorAvatarOptions) {
    this.framing = options.framing ?? 'portrait';
    this.followPointer = options.followPointer ?? true;
    this.autonomy = options.autonomy ?? true;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;';
    host.appendChild(this.canvas);
    const light = new THREE.DirectionalLight(0xffffff, Math.PI);
    light.position.set(0.6, 1.4, 1.6);
    this.scene.add(light, new THREE.AmbientLight(0xffffff, 0.35), this.lookTarget);
    const resize = new ResizeObserver(() => this.resize());
    resize.observe(host);
    const seen = new IntersectionObserver(([entry]) => { this.visible = entry.isIntersecting; this.loop(); });
    seen.observe(host);
    this.observers.push(resize, seen);
    window.addEventListener('pointermove', this.onPointer, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibility);
    this.resize();
  }

  async init() {
    const loader = new GLTFLoader();
    loader.register(parser => new VRMLoaderPlugin(parser));
    const gltf = await loader.loadAsync(this.options.url, e => { if (e.total) this.options.onProgress?.(e.loaded / e.total); });
    if (this.disposed) { VRMUtils.deepDispose(gltf.scene); return; }
    const vrm = gltf.userData.vrm as VRM;
    nameMorphs(gltf);
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);
    if (vrm.meta.metaVersion === '0') { VRMUtils.rotateVRM0(vrm); this.flip = -1; }
    vrm.scene.traverse(o => { o.frustumCulled = false; });
    this.registerEmotions(vrm);
    if (vrm.lookAt) vrm.lookAt.target = this.lookTarget;
    this.scene.add(vrm.scene);
    this.vrm = vrm;
    this.mixer = new THREE.AnimationMixer(vrm.scene);
    vrm.scene.updateMatrixWorld(true);
    this.headY = vrm.humanoid.getNormalizedBoneNode('head')?.getWorldPosition(this.tmpV).y ?? 1.4;
    this.hipsRest.copy(vrm.humanoid.getNormalizedBoneNode('hips')?.position ?? this.hipsRest);
    this.cloth = new ClothPhysics(vrm);
    // Start in a stance, never in the T-pose.
    await this.setBase('breathing', true);
    if (this.disposed) return;
    this.mixer.update(0);
    vrm.update(0);
    vrm.springBoneManager?.reset();
    this.setFraming(this.framing, true);
    this.blinkAt = this.time + rand(1, 3);
    this.actAt = this.time + rand(4, 6);
    this.stanceAt = this.time + rand(12, 18);
    for (const name of STATE_LOOPS.idle) void this.clip(name);
    this.loop();
  }

  /**
   * Every emotion becomes two VRM expressions: the face part and the mouth part (quieter while speaking). VRoid face
   * morphs are found by their "Fcl_…" name; older exports prefix it (e.g. "Face.M_F00_000_00_Fcl_MTH_A").
   */
  private registerEmotions(vrm: VRM) {
    const manager = vrm.expressionManager;
    const morphIndex = (m: THREE.Mesh) => {
      const dict = new Map<string, number>();
      for (const [key, i] of Object.entries(m.morphTargetDictionary ?? {})) { const at = key.indexOf('Fcl_'); if (at >= 0) dict.set(key.slice(at), i); }
      return dict;
    };
    const meshes: THREE.Mesh[] = [];
    vrm.scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && morphIndex(m).has('Fcl_MTH_A')) meshes.push(m); });
    if (!manager || !meshes.length) return;
    const dict = morphIndex(meshes[0]);
    const add = (name: string, morphs: Record<string, number>) => {
      const expression = new VRMExpression(name);
      for (const [morph, weight] of Object.entries(morphs)) { const index = dict.get(morph); if (index != null) expression.addBind(new VRMExpressionMorphTargetBind({ primitives: meshes, index, weight })); }
      vrm.scene.add(expression);
      manager.registerExpression(expression);
    };
    for (const [name, emotion] of Object.entries(EMOTIONS)) { add(`emo_${name}`, emotion.face); add(`emo_${name}_mouth`, emotion.mouth); }
    add('st_brows', { Fcl_BRW_Surprised: 1 });
    add('st_smile', { Fcl_MTH_Fun: 0.55, Fcl_BRW_Fun: 0.2 });
  }

  private clip(name: MotionName) {
    let clip = this.clips.get(name);
    if (!clip) {
      clip = loadMotion(this.options.motions, MOTIONS[name].file).then(data => this.vrm ? buildMotionClip(data, this.vrm, this.hipsRest, name) : null).catch(() => null);
      this.clips.set(name, clip);
    }
    return clip;
  }

  private layerFor(name: MotionName, clip: THREE.AnimationClip, once: boolean) {
    let layer = this.layers.find(l => l.name === name);
    if (!layer) {
      const action = this.mixer!.clipAction(clip);
      layer = { name, action, once, weight: 0, target: 0 };
      this.layers.push(layer);
    }
    layer.once = once;
    layer.action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    layer.action.clampWhenFinished = once;
    layer.action.enabled = true;
    if (!layer.action.isRunning() || once) layer.action.reset().play();
    return layer;
  }

  /** Makes `name` the looping base; it fades in unless a one-shot is still playing on top. */
  private async setBase(name: MotionName, instant = false) {
    if (this.base?.name === name && this.base.target > 0) return;
    const token = ++this.baseToken;
    const clip = await this.clip(name);
    if (!clip || !this.mixer || token !== this.baseToken) return;
    const layer = this.layerFor(name, clip, false);
    for (const l of this.layers) if (l !== layer && !l.once) l.target = 0;
    this.base = layer;
    if (!this.once) layer.target = 1;
    if (instant) { for (const l of this.layers) l.weight = l === layer ? 1 : 0; this.applyWeights(); }
    this.loop();
  }

  /** Plays a motion: a loop becomes the stance (until the state or idle life changes it), others play once. */
  async play(name: MotionName) {
    this.calm(3);
    if ((MOTIONS[name] as Motion).loop) { this.stanceAt = this.time + rand(18, 26); return this.setBase(name); }
    const token = ++this.motionToken;
    const clip = await this.clip(name);
    if (!clip || !this.mixer || token !== this.motionToken) return;
    const layer = this.layerFor(name, clip, true);
    for (const l of this.layers) l.target = l === layer ? 1 : 0;
    this.once = layer;
    this.loop();
  }

  private applyWeights() { for (const l of this.layers) l.action.setEffectiveWeight(l.weight); }

  /** Cross-fades layers; a one-shot hands back to the base before its end. */
  private updateLayers(dt: number) {
    const once = this.once;
    if (once && once.action.time >= once.action.getClip().duration - FADE) {
      once.target = 0;
      this.once = null;
      if (this.base) this.base.target = 1;
    }
    for (const l of this.layers) l.weight = l.target > l.weight ? Math.min(l.target, l.weight + dt / FADE) : Math.max(l.target, l.weight - dt / FADE);
    // Drop finished layers but keep their actions cached in the mixer.
    // The base stays even at weight 0 under a one-shot, so it can fade back in.
    this.layers = this.layers.filter(l => { if (l.weight > 0 || l.target > 0 || l === this.base) return true; l.action.stop(); return false; });
    this.applyWeights();
  }

  setFraming(framing: Framing, instant = false) {
    this.framing = framing;
    const f = FRAMES[framing];
    // Portrait and bust keep the top of the hair just inside the frame; the full figure stands on the bottom edge.
    const visible = Math.max(f.height, f.width / this.camera.aspect);
    const centre = framing === 'full' ? visible / 2 - 0.03 : this.headY + 0.22 - visible / 2;
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const distance = (visible / 2) / Math.tan(fov / 2);
    this.frameFrom.copy(this.camera.position);
    this.frameTo.set(0, centre, distance);
    this.frameBlend = instant ? 1 : 0;
    if (instant) this.camera.position.copy(this.frameTo);
    this.loop();
  }

  setState(state: AvatarState) {
    if (state === this.state) return;
    this.state = state;
    if (state === 'listening') this.nodAt = this.time + rand(0.8, 1.6);
    const loops = STATE_LOOPS[state];
    void this.setBase(loops[Math.floor(Math.random() * loops.length)]);
    if (state !== 'idle' && this.once) { this.once.target = 0; this.once = null; if (this.base) this.base.target = 1; }
    this.stanceAt = this.time + rand(12, 18);
    this.calm(4);
    this.loop();
  }
  getState() { return this.state; }

  /** Shows an emotion; with ms it returns to neutral afterwards. A lasting emotion pauses the idle ones. */
  setEmotion(name: EmotionName, ms = 0) {
    this.manualEmotion = name !== 'neutral' && !ms;
    this.showEmotion(name, ms);
    this.calm(4);
  }

  private showEmotion(name: EmotionName, ms: number) {
    this.emotion = name;
    this.emotionTimer = ms ? this.time + ms / 1000 : 0;
    this.loop();
  }

  /** A small head tilt on top of whatever plays. */
  tiltHead() { this.tiltStart = this.time; this.loop(); }

  setAutonomy(on: boolean) { this.autonomy = on; if (on) this.calm(1.5); }

  setFollowPointer(on: boolean) { this.followPointer = on; if (!on) this.pointer = null; }

  /** Commands from outside postpone the avatar's own acts a little. */
  private calm(seconds: number) { this.actAt = Math.max(this.actAt, this.time + seconds + rand(0, 2)); }

  /** Lip sync from any audio graph (e.g. the chat's own player); null stops it. */
  attachAnalyser(analyser: AnalyserNode | null) { this.lip = analyser ? new LipSync(analyser) : null; }

  /** Plays a clip with lip sync, in the speaking state; resolves when it ends. Call from a user gesture first time. */
  async speak(url: string) {
    this.stopSpeaking();
    if (!this.audio) {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.connect(ctx.destination);
      this.audio = { ctx, analyser, element: null };
    }
    const { ctx, analyser } = this.audio;
    await ctx.resume().catch(() => {});
    const element = new Audio(url);
    element.crossOrigin = 'anonymous';
    ctx.createMediaElementSource(element).connect(analyser);
    this.audio.element = element;
    this.attachAnalyser(analyser);
    this.setState('speaking');
    await new Promise<void>(resolve => {
      element.onended = element.onerror = element.onpause = () => resolve();
      element.play().catch(() => resolve());
    });
    if (this.audio?.element === element) { this.audio.element = null; this.attachAnalyser(null); this.setState('idle'); }
  }

  stopSpeaking() { this.audio?.element?.pause(); }

  private onPointer = (e: PointerEvent) => {
    if (!this.followPointer) return;
    const r = this.canvas.getBoundingClientRect();
    if (!r.width) return;
    this.pointer = { x: (e.clientX - (r.left + r.width / 2)) / Math.max(r.width, 300), y: -(e.clientY - (r.top + r.height * 0.3)) / Math.max(r.height, 300) };
    this.loop();
  };

  private onVisibility = () => this.loop();

  private resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.vrm) this.setFraming(this.framing, true);
    this.loop();
  }

  private loop() {
    if (this.raf || this.disposed || !this.visible || document.hidden) return;
    this.last = performance.now();
    const frame = (now: number) => {
      this.raf = 0;
      if (this.disposed || !this.visible || document.hidden) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.update(dt);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  private update(dt: number) {
    this.time += dt;
    const vrm = this.vrm;
    if (this.frameBlend < 1) {
      this.frameBlend = Math.min(1, this.frameBlend + dt * 2.2);
      const k = this.frameBlend * this.frameBlend * (3 - 2 * this.frameBlend);
      this.camera.position.lerpVectors(this.frameFrom, this.frameTo, k);
    }
    this.camera.lookAt(0, this.camera.position.y, 0);
    if (vrm && this.mixer) {
      this.updateMind(dt);
      this.updateLayers(dt);
      // The mixer only writes a bone when its value changes, so last frame's offsets must be taken off first.
      for (const [node, q] of this.beforeOverlay) node.quaternion.copy(q);
      this.beforeOverlay.clear();
      this.mixer.update(dt);
      this.applyOverlay(dt);
      this.applyFace(dt);
      vrm.update(dt);
      this.cloth?.update(dt);
    }
    this.renderer.render(this.scene, this.camera);
  }

  /** Timers: state pose easing, glances, listening nods, idle life, emotion timeout. */
  private updateMind(dt: number) {
    const target = STATES[this.state].pose;
    const p = this.pose;
    for (const key of ['lean', 'tilt', 'pitch', 'brows', 'smile'] as const) p[key] = approach(p[key], target[key], 3.5, dt);
    p.look = [approach(p.look[0], target.look[0], 4, dt), approach(p.look[1], target.look[1], 4, dt)];
    if (this.emotionTimer && this.time > this.emotionTimer) { this.emotion = 'neutral'; this.emotionTimer = 0; }
    const g = this.glance;
    if (this.time > g.next) {
      const away = this.state === 'idle' ? 0.5 : this.state === 'thinking' ? 0.2 : 0.25;
      g.x = rand(-away, away); g.y = rand(-away * 0.5, away * 0.6);
      g.until = this.time + rand(0.4, 1.4);
      g.next = this.time + (this.state === 'listening' ? rand(3, 6) : rand(2, 5));
    }
    if (this.time > g.until) { g.x = 0; g.y = 0; }
    if (this.state === 'listening' && this.time > this.nodAt) { this.nodStart = this.time; this.nodAt = this.time + rand(2.6, 4.5); }
    if (this.state === 'speaking' && this.time > this.stanceAt) {
      const others = STATE_LOOPS.speaking.filter(n => n !== this.base?.name);
      if (others.length) void this.setBase(others[Math.floor(Math.random() * others.length)]);
      this.stanceAt = this.time + rand(8, 14);
    }
    if (this.autonomy && this.state === 'idle') this.idleLife();
    const g2 = this.gazeTarget();
    this.gazeNow.x = approach(this.gazeNow.x, g2.x, 5, dt);
    this.gazeNow.y = approach(this.gazeNow.y, g2.y, 5, dt);
  }

  /** Idle life: another stance every so often, and small acts (glances, stretches, smiles) in between. */
  private idleLife() {
    if (this.time > this.stanceAt && !this.once) {
      const names = STATE_LOOPS.idle.filter(n => n !== this.base?.name);
      const next = names[Math.floor(Math.random() * names.length)];
      void this.setBase(next);
      this.stanceAt = this.time + rand(14, 24);
      this.options.onAct?.(`стойка: ${MOTIONS[next].label.toLowerCase()}`);
    }
    if (this.time < this.actAt || this.once) return;
    const acts = IDLE_ACTS.filter(a => a.motion || !this.manualEmotion);
    let pick = Math.random() * acts.reduce((sum, a) => sum + a.weight, 0);
    const act = acts.find(a => (pick -= a.weight) < 0) ?? acts[0];
    if (act.motion) void this.play(act.motion);
    if (act.emotion && !this.manualEmotion) this.showEmotion(act.emotion, act.ms ?? 2000);
    if (act.tilt) this.tiltHead();
    this.actAt = this.time + rand(6, 11);
    this.options.onAct?.(act.label);
  }

  private bone(name: VRMHumanBoneName) { return this.vrm?.humanoid.getNormalizedBoneNode(name) ?? null; }

  /** Remembers a bone's clip rotation before this frame changes it on top. */
  private keep(node: THREE.Object3D) { if (!this.beforeOverlay.has(node)) this.beforeOverlay.set(node, node.quaternion.clone()); }

  /** Multiplies a small local rotation onto a bone after the clip has posed it. */
  private turn(name: VRMHumanBoneName, x: number, y: number, z: number) {
    const node = this.bone(name);
    if (!node || !(x || y || z)) return;
    this.keep(node);
    node.quaternion.multiply(this.tmpQ.setFromEuler(this.tmpE.set(x * this.flip, y, z * this.flip)));
  }

  /** How much a one-shot that turns away (looking around, stretching) is driving the body right now. */
  private awayWeight() { return this.layers.reduce((w, l) => (l.once && LOOK_AWAY.has(l.name) ? Math.max(w, l.weight) : w), 0); }

  /** Head, neck and spine offsets over the clip: state lean and tilt, emotion, gaze, speech beats, pulses. */
  private applyOverlay(dt: number) {
    const p = this.pose, t = this.time;
    const emo: Emotion = EMOTIONS[this.emotion];
    const ew = this.emotionWeights.get(this.emotion) ?? 0;
    const free = 1 - this.awayWeight();
    const look = this.gaze();
    this.beat = approach(this.beat, this.lip ? this.lip.loudness() : 0, 8, dt);
    const tiltAge = (t - this.tiltStart) / 1.8, tilt = tiltAge < 1 ? Math.sin(Math.PI * tiltAge) * 0.16 : 0;
    const nodAge = (t - this.nodStart) / 0.9, nod = nodAge < 1 ? Math.sin(Math.PI * 2 * nodAge) ** 2 * 0.09 : 0;
    this.turn('spine', p.lean * 0.6, 0, 0);
    const yaw = THREE.MathUtils.clamp(look.x, -1, 1) * 0.42 * free, lift = THREE.MathUtils.clamp(look.y, -1, 1) * 0.22 * free;
    this.turn('neck', p.pitch * 0.4 - lift * 0.3, yaw * 0.3, p.tilt * 0.3);
    this.turn('head',
      (p.pitch * 0.6 + (emo.pitch ?? 0) * ew + this.beat * 0.035 + nod) * free - lift * 0.7,
      yaw * 0.7,
      (p.tilt * 0.7 + (emo.tilt ?? 0) * ew + tilt) * free);
  }

  private gaze() { return this.gazeNow; }

  /** Where the gaze is heading: state, glances and the pointer (x right, y up, about -1..1). */
  private gazeTarget() {
    const look = this.pose.look;
    let x = look[0] + this.glance.x * 0.6, y = look[1] + this.glance.y * 0.6;
    if (this.pointer && this.state !== 'thinking') { x = x * 0.4 + Math.max(-1, Math.min(1, this.pointer.x)) * 0.6; y = y * 0.4 + Math.max(-1, Math.min(1, this.pointer.y)) * 0.6; }
    return { x, y };
  }

  private applyFace(dt: number) {
    const manager = this.vrm?.expressionManager;
    if (!manager) return;
    const speaking = this.lip != null;
    for (const name of Object.keys(EMOTIONS) as EmotionName[]) {
      const w = approach(this.emotionWeights.get(name) ?? 0, name === this.emotion ? 1 : 0, 6, dt);
      this.emotionWeights.set(name, w);
      manager.setValue(`emo_${name}`, w);
      manager.setValue(`emo_${name}_mouth`, w * (speaking ? 0.3 : 1));
    }
    const calm = this.emotionWeights.get('neutral') ?? 0;
    manager.setValue('st_brows', this.pose.brows * calm);
    manager.setValue('st_smile', this.pose.smile * calm * (speaking ? 0.4 : 1));
    // Blink: quick close-open, now and then; skipped while the eyes already squint (^^, wink, sleepy).
    const busyEyes = (this.emotionWeights.get('joy') ?? 0) + (this.emotionWeights.get('wink') ?? 0) + (this.emotionWeights.get('sleepy') ?? 0);
    if (this.blinkStart < 0 && this.time > this.blinkAt) { this.blinkStart = this.time; this.blinkAt = this.time + (Math.random() < 0.15 ? 0.25 : rand(2.2, 5.5)); }
    let blink = 0;
    if (this.blinkStart >= 0) { const b = (this.time - this.blinkStart) / 0.16; blink = b < 0.4 ? b / 0.4 : Math.max(0, 1 - (b - 0.4) / 0.6); if (b >= 1) this.blinkStart = -1; }
    manager.setValue('blink', blink * Math.max(0, 1 - busyEyes));
    this.visemes = this.lip ? this.lip.sample(dt) : { aa: approach(this.visemes.aa, 0, 18, dt), ih: approach(this.visemes.ih, 0, 18, dt), ou: approach(this.visemes.ou, 0, 18, dt), ee: approach(this.visemes.ee, 0, 18, dt), oh: approach(this.visemes.oh, 0, 18, dt) };
    for (const [k, v] of Object.entries(this.visemes)) manager.setValue(k, Math.min(1, v * 1.25));
    // Eyes look at the viewer (offset by the gaze), or straight ahead of the head while a motion turns it away.
    const look = this.gaze();
    const cam = this.camera.position;
    this.lookTarget.position.set(cam.x + look.x * 0.6, cam.y + look.y * 0.45, cam.z);
    const away = this.awayWeight();
    const head = this.bone('head');
    if (away > 0 && head) {
      head.getWorldPosition(this.tmpV);
      const ahead = new THREE.Vector3(0, 0, 1.5 * this.flip).applyQuaternion(head.getWorldQuaternion(this.tmpQ)).add(this.tmpV);
      this.lookTarget.position.lerp(ahead, away);
    }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.observers.forEach(o => o.disconnect());
    window.removeEventListener('pointermove', this.onPointer);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.stopSpeaking();
    this.audio?.ctx.close().catch(() => {});
    this.mixer?.stopAllAction();
    if (this.vrm) VRMUtils.deepDispose(this.vrm.scene);
    this.renderer.dispose();
    this.canvas.remove();
  }
}
