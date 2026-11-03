import * as T from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { SceneCtx, SceneInstance, ScenePointer } from '../types';
import { renderSize } from './renderSize';

export { T };
export const TAU = Math.PI * 2;
export type Tick = (time: number, dt: number, pointer: ScenePointer) => void;
export const v = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);

/** One renderer per selected scene. Geometry, maps, postprocessing and the GL context are all owned here. */
export class World implements SceneInstance {
  scene = new T.Scene();
  root = new T.Group();
  camera: T.PerspectiveCamera;
  renderer: T.WebGLRenderer;
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  ticks: Tick[] = [];
  pulse = 0;
  pointer = v();
  mobile: boolean;
  stage = new T.Group();
  eye = v(0, 2, 21);
  target = v();
  cameraMotion = 1;
  sidePadding = 4.4;
  mobileSidePadding = 3.5;
  exposure = 1;
  private quality = -1;
  private env: T.WebGLRenderTarget;
  private passes: { dispose(): void }[];
  private maps = new Set<T.Texture>();
  private cameraBase: number;
  private anchors: { group: T.Group; x: number; y: number }[] = [];
  constructor(public c: SceneCtx, public accent: string, background = '#050914') {
    this.mobile = c.width / c.height < 0.85;
    this.cameraBase = this.mobile ? 28 : c.width / c.height > 3 ? 16 : 21;
    this.camera = new T.PerspectiveCamera(46, c.width / c.height, 0.1, 140);
    this.camera.position.set(0, 2, this.cameraBase);
    this.eye.copy(this.camera.position);
    this.camera.lookAt(0, 0, 0);
    this.renderer = new T.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = !this.mobile;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.scene.background = new T.Color(background);
    this.scene.fog = new T.FogExp2(background, 0.019);
    this.scene.add(this.root);
    const room = new RoomEnvironment();
    const pmrem = new T.PMREMGenerator(this.renderer);
    this.env = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.env.texture;
    room.dispose(); pmrem.dispose();
    this.scene.add(new T.HemisphereLight('#b8d6ff', '#282238', 1.5));
    const key = new T.DirectionalLight('#ffe9d0', 3.2);
    key.position.set(-6, 12, 9); key.castShadow = !this.mobile;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -18, right: 18, top: 15, bottom: -15, far: 60 });
    key.shadow.bias = -0.001;
    this.scene.add(key);
    const rim = new T.DirectionalLight(accent, 3);
    rim.position.set(8, 4, -8); this.scene.add(rim);
    this.scene.add(this.stage);
    const floor = this.mesh(new T.PlaneGeometry(150, 150), this.metal('#0f1829', 0.15, 0.85));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -6.4; floor.receiveShadow = true;
    this.stage.add(floor);
    const render = new RenderPass(this.scene, this.camera);
    this.bloom = new UnrealBloomPass(new T.Vector2(1, 1), 0.45, 0.45, 1.4);
    const output = new OutputPass();
    this.composer = new EffectComposer(this.renderer);
    // Postprocessing uses render targets, so the renderer's default-framebuffer antialias is not enough.
    this.composer.renderTarget1.samples = 2;
    this.composer.renderTarget2.samples = 2;
    this.composer.addPass(render); this.composer.addPass(this.bloom); this.composer.addPass(output);
    this.passes = [render, this.bloom, output];
    this.resize();
  }
  private resize() {
    const quality = Math.max(0.35, Math.min(1.5, this.c.params.quality));
    if (Math.abs(quality - this.quality) < 0.025) return;
    this.quality = quality;
    const size = renderSize(this.c.width, this.c.height, this.c.dpr, quality, this.mobile);
    const samples = !this.mobile && size.width * size.height <= 4500000 ? 4 : 2;
    this.composer.renderTarget1.samples = samples; this.composer.renderTarget2.samples = samples;
    this.renderer.setSize(size.width, size.height, false); this.composer.setSize(size.width, size.height);
  }
  metal(color: T.ColorRepresentation, metalness = 0.7, roughness = 0.25) {
    return new T.MeshStandardMaterial({ color, metalness, roughness });
  }
  ownTexture<TTexture extends T.Texture>(texture: TTexture): TTexture {
    this.maps.add(texture); return texture;
  }
  glow(color: T.ColorRepresentation, power = 2.5) {
    return new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: power, metalness: 0.25, roughness: 0.3 });
  }
  glass(color: T.ColorRepresentation, opacity = 0.25) {
    return new T.MeshPhysicalMaterial({ color, metalness: 0.2, roughness: 0.13, transparent: true, opacity, side: T.DoubleSide, depthWrite: false, clearcoat: 1 });
  }
  mesh(geometry: T.BufferGeometry, material: T.Material, parent?: T.Object3D, position = v()) {
    const mesh = new T.Mesh(geometry, material); mesh.position.copy(position);
    mesh.castShadow = true; mesh.receiveShadow = true;
    parent?.add(mesh); return mesh;
  }
  box(parent: T.Object3D, size: [number, number, number], position: [number, number, number], mat: T.Material) {
    return this.mesh(new T.BoxGeometry(...size), mat, parent, v(...position));
  }
  sphere(parent: T.Object3D, radius: number, position: [number, number, number], mat: T.Material) {
    return this.mesh(new T.SphereGeometry(radius, 40, 28), mat, parent, v(...position));
  }
  ring(parent: T.Object3D, radius: number, tube: number, material: T.Material, position = v()) {
    return this.mesh(new T.TorusGeometry(radius, tube, 12, 192), material, parent, position);
  }
  tube(parent: T.Object3D, points: T.Vector3[], material: T.Material, radius = 0.035, closed = false) {
    const curve = new T.CatmullRomCurve3(points, closed, 'catmullrom', 0.35);
    this.mesh(new T.TubeGeometry(curve, Math.max(64, points.length * 12), radius, 8, closed), material, parent);
    return curve;
  }
  beam(parent: T.Object3D, a: T.Vector3, b: T.Vector3, radius: number, material: T.Material) {
    const mesh = this.mesh(new T.CylinderGeometry(radius, radius, a.distanceTo(b), 8), material, parent, a.clone().add(b).multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(v(0, 1, 0), b.clone().sub(a).normalize()); return mesh;
  }
  side(index: number, y = 0) {
    const group = new T.Group();
    const sideX = this.mobile ? 2.8 : Math.min(17, this.cameraBase * Math.tan(23 * Math.PI / 180) * this.camera.aspect * 0.74);
    group.position.set((index === 0 ? -1 : 1) * sideX, y + (this.mobile ? (index === 0 ? 4.4 : -4.4) : 0), 0);
    if (this.mobile) group.scale.setScalar(0.8);
    this.anchors.push({ group, x: group.position.x, y: group.position.y });
    this.root.add(group); return group;
  }
  text(parent: T.Object3D, text: string, color: string, width = 2.4, height = 0.55) {
    const canvas = document.createElement('canvas'); canvas.width = Math.min(2048, Math.round(256 * width / height)); canvas.height = 256;
    const g = canvas.getContext('2d')!;
    g.font = '600 176px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color;
    g.fillText(text, canvas.width / 2, 128, canvas.width * 0.92);
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; this.maps.add(texture);
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const material = new T.MeshBasicMaterial({ map: texture, transparent: true, side: T.DoubleSide, depthWrite: false });
    return this.mesh(new T.PlaneGeometry(width, height), material, parent);
  }
  dust(count: number, color: string, span = 15, size = 0.045) {
    const data = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      data[i * 3] = (this.c.rand() - 0.5) * span * 2;
      data[i * 3 + 1] = (this.c.rand() - 0.5) * 16;
      data[i * 3 + 2] = (this.c.rand() - 0.5) * 16;
      phases[i] = this.c.rand() * TAU;
    }
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.BufferAttribute(data, 3));
    const material = new T.PointsMaterial({ color, size, transparent: true, opacity: 0.75, blending: T.AdditiveBlending, depthWrite: false });
    const points = new T.Points(geometry, material); this.scene.add(points);
    this.ticks.push((time, dt) => {
      for (let i = 0; i < count; i++) {
        data[i * 3 + 1] += dt * (0.05 + 0.03 * Math.sin(time + phases[i]));
        if (data[i * 3 + 1] > 9) data[i * 3 + 1] = -8;
      }
      geometry.attributes.position.needsUpdate = true;
      points.rotation.y = Math.sin(time * 0.05) * 0.1;
    });
    return points;
  }
  update(dt: number, time: number, pointer: ScenePointer) {
    this.pulse = Math.max(0, this.pulse - dt * 0.7);
    if (pointer.clicked && this.c.params.react > 0) this.pulse = 1;
    const react = this.c.params.react;
    this.pointer.lerp(v((pointer.x / this.c.width - 0.5) * 2, (0.5 - pointer.y / this.c.height) * 2, 0), Math.min(1, dt * 3));
    const drift = this.c.params.cinemaCamera * this.cameraMotion;
    this.camera.position.copy(this.eye).add(v(this.pointer.x * 0.65 * react + Math.sin(time * 0.14) * 0.65 * drift, this.pointer.y * 0.45 * react + Math.sin(time * 0.21) * 0.3 * drift, Math.cos(time * 0.1) * 0.45 * drift));
    this.camera.lookAt(this.target);
    const zoom = Math.max(0.6, Math.min(1.5, this.c.params.zoom));
    this.camera.zoom = zoom; this.camera.updateProjectionMatrix();
    // Zoom enlarges the rides, not the empty gap between them. Keep them inside the viewport.
    const halfWidth = this.cameraBase * Math.tan(23 * Math.PI / 180) * this.camera.aspect / zoom;
    const maxX = Math.max(0, halfWidth - (this.mobile ? this.mobileSidePadding : this.sidePadding));
    for (const anchor of this.anchors) {
      anchor.group.position.x = Math.sign(anchor.x) * Math.min(Math.abs(anchor.x) / zoom, maxX);
      if (this.mobile) anchor.group.position.y = anchor.y / zoom;
    }
    for (const tick of this.ticks) tick(time, dt, pointer);
  }
  draw(g: CanvasRenderingContext2D) {
    this.resize();
    this.renderer.toneMappingExposure = this.exposure * (0.7 + this.c.params.intensity * 0.3);
    this.bloom.strength = this.c.params.cinemaBloom * (0.25 + this.c.params.intensity * 0.18 + this.pulse * 0.08);
    this.composer.render(0);
    g.save();
    if (this.c.params.hue) g.filter = `hue-rotate(${this.c.params.hue}deg)`;
    g.drawImage(this.renderer.domElement, 0, 0, this.c.width, this.c.height);
    g.restore();
  }
  dispose() {
    const geometries = new Set<T.BufferGeometry>(); const materials = new Set<T.Material>();
    this.scene.traverse(object => {
      const item = object as T.Mesh;
      if (item.geometry) geometries.add(item.geometry);
      if (item.material) (Array.isArray(item.material) ? item.material : [item.material]).forEach(m => materials.add(m));
      if (object instanceof T.InstancedMesh) object.dispose();
      if (object instanceof T.Light && 'shadow' in object) (object as T.DirectionalLight).shadow?.dispose();
    });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
    this.maps.forEach(map => map.dispose()); this.env.dispose();
    this.passes.forEach(pass => pass.dispose()); this.composer.dispose();
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.ticks.length = 0;
  }
}
