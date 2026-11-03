/**
 * The three.js cat: one skinned body (from catGeometry) plus rigid details attached to bones, two looks
 * (cel-shaded anime with ink outline / soft 3D with sheen and shell fur), outfits and emotion sprites.
 * `update()` eases the current pose toward a target and applies it, including leg IK.
 */
import * as THREE from 'three';
import { BONES, boneAt, TAIL_BONES, type V3 } from './catRig';
import { catPrimitives, catSdf, EYE, type CatMeshData } from './catGeometry';
import { POSE_DEFAULTS, RATE, type Pose, type PoseKey, type SpriteKind } from './catPose';
import { clamp, lerp, solveTwoBone, wrapAngle } from './catMath';
import { blushTexture, spriteTexture } from './catSprites';

export type CatStyle = 'anime' | 'soft';
export type CatOutfit = 'plain' | 'collar' | 'teacher' | 'professor';

const prims = catPrimitives();
const sdf = (p: THREE.Vector3) => catSdf(prims, p.x, p.y, p.z);
/** Sphere-traces from `from` along `dir` to the bind-pose skin. */
function surface(from: V3, dir: V3, lift = 0): THREE.Vector3 {
  const o = new THREE.Vector3(...from), d = new THREE.Vector3(...dir).normalize(), p = o.clone();
  for (let i = 0, t = 0; i < 120 && t < 0.6; i++) {
    p.copy(o).addScaledVector(d, t);
    const dist = sdf(p);
    if (dist < 0.0004) break;
    // Outside every primitive's box the field is a huge constant, so steps are capped.
    t += clamp(dist * 0.8, 0.0006, 0.01);
  }
  return p.addScaledVector(d, -lift);
}
const local = (bone: string, p: THREE.Vector3 | V3) => {
  const b = boneAt(bone), v = Array.isArray(p) ? new THREE.Vector3(...p) : p.clone();
  return v.sub(new THREE.Vector3(...b));
};

function taperTube(points: THREE.Vector3[], r0: number, r1: number, radial = 5, segments = 14) {
  const curve = new THREE.CatmullRomCurve3(points);
  const g = new THREE.TubeGeometry(curve, segments, 1, radial, false);
  const pos = g.attributes.position as THREE.BufferAttribute, c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    curve.getPointAt(i / segments, c);
    const r = lerp(r0, r1, i / segments);
    for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c); pos.setXYZ(k, v.x, v.y, v.z); }
  }
  g.computeVertexNormals();
  return g;
}

function gradientMap() {
  const t = new THREE.DataTexture(new Uint8Array([60, 60, 60, 255, 135, 135, 135, 255, 255, 255, 255, 255]), 3, 1);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}

type RimUniforms = { uRim: { value: THREE.Color }; uRimK: { value: number }; uSheen: { value: number }; uHard: { value: number } };
/** Anime rim light and a painted highlight band, or a soft rim, injected into a lit material. */
function addRim<M extends THREE.Material>(m: M, rim: string, k: number, sheen: number, hard: number): M {
  const u: RimUniforms = { uRim: { value: new THREE.Color(rim) }, uRimK: { value: k }, uSheen: { value: sheen }, uHard: { value: hard } };
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, u);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRim; uniform float uRimK; uniform float uSheen; uniform float uHard;')
      .replace('#include <opaque_fragment>', `{
        float facing = 1.0 - max(dot(normal, normalize(vViewPosition)), 0.0);
        float rimHard = smoothstep(0.6, 0.68, facing), rimSoft = smoothstep(0.35, 1.0, facing) * 0.7;
        outgoingLight += uRim * uRimK * mix(rimSoft, rimHard, uHard);
        outgoingLight += uRim * uSheen * smoothstep(0.84, 0.88, dot(normal, normalize(vec3(-0.35, 0.82, 0.45))));
      }
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `cat-rim-${m.type}`;
  return m;
}

function outlineMaterial(width: { value: number }) {
  const m = new THREE.MeshBasicMaterial({ color: '#0a0a12', side: THREE.BackSide });
  m.onBeforeCompile = shader => {
    shader.uniforms.uOutline = width;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uOutline;')
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>
        #ifdef USE_SKINNING
          transformed += normalize(objectNormal) * uOutline;
        #else
          transformed += normalize(normal) * uOutline;
        #endif`);
  };
  m.customProgramCacheKey = () => 'cat-outline';
  return m;
}

/** One layer of shell fur: strands are random cells of the bind-pose lattice, thinning toward the tips. */
function shellMaterial(level: number, offset: number) {
  const m = new THREE.MeshStandardMaterial({ color: '#2c2e3e', roughness: 0.75 });
  m.onBeforeCompile = shader => {
    shader.uniforms.uOff = { value: offset }; shader.uniforms.uLevel = { value: level };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uOff; varying vec3 vBind;')
      .replace('#include <skinning_vertex>', `vBind = position;\n#include <skinning_vertex>\ntransformed += normalize(objectNormal) * uOff; transformed.y -= uOff * uOff * 5.0;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uLevel; varying vec3 vBind;
        float catHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        vec3 cell = vBind * 420.0;
        float strand = catHash(floor(cell));
        if (strand < uLevel * 0.82 || length(fract(cell) - 0.5) > (1.0 - uLevel) * 0.55 + 0.1) discard;`)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(0.78, 1.08, uLevel);');
  };
  m.customProgramCacheKey = () => 'cat-shell';
  return m;
}

const EYE_VERT = `varying vec3 vN; varying vec3 vVN;
void main() { vN = normal; vVN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const EYE_FRAG = `uniform float uPupil; uniform float uShine; uniform vec3 uIrisIn; uniform vec3 uIrisOut; uniform vec3 uRimC;
varying vec3 vN; varying vec3 vVN;
void main() {
  vec3 n = normalize(vN);
  vec2 q = n.zy / 0.82;
  float r = length(q);
  vec3 col = vec3(0.04, 0.04, 0.07);
  if (n.x > 0.0 && r < 1.0) {
    float ang = atan(q.y, q.x);
    float fib = 0.86 + 0.14 * sin(ang * 23.0 + r * 9.0) * sin(ang * 7.0 - r * 4.0);
    col = mix(uIrisIn, uIrisOut, smoothstep(0.12, 0.9, r)) * fib;
    col = mix(col, uRimC, smoothstep(0.8, 0.98, r));
    float pd = length(vec2(q.x / max(uPupil, 0.06), q.y / 0.9));
    col = mix(col, vec3(0.015, 0.015, 0.03), smoothstep(1.06, 0.94, pd));
    col *= mix(1.0, 0.5, smoothstep(0.15, 0.95, q.y));
  }
  vec3 v = normalize(vVN);
  float h1 = smoothstep(0.17, 0.12, length(v.xy - vec2(-0.3, 0.36)));
  float h2 = smoothstep(0.075, 0.05, length(v.xy - vec2(0.24, -0.28)));
  col += (h1 + 0.75 * h2) * uShine;
  col += pow(max(dot(v, normalize(vec3(-0.4, 0.55, 1.0))), 0.0), 60.0) * 0.55 * (1.0 - uShine);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

type Eye = { pivot: THREE.Group; ball: THREE.Mesh; tilt: THREE.Group; upper: THREE.Mesh; lower: THREE.Mesh; side: number; uniforms: Record<string, THREE.IUniform> };
type Leg = { b: [THREE.Bone, THREE.Bone, THREE.Bone, THREE.Bone]; parent: THREE.Bone; front: boolean; z: number; L: [number, number, number]; phi: [number, number, number]; key: 'fl' | 'fr' | 'hl' | 'hr' };
type Fx = { sprite: THREE.Sprite; kind: SpriteKind; age: number; life: number; from: THREE.Vector3; seed: number };
type Dual = { anime: THREE.Material; soft: THREE.Material; meshes: THREE.Mesh[] };

export class CatModel {
  readonly group = new THREE.Group();
  readonly bones: Record<string, THREE.Bone> = {};
  readonly pose: Pose = { ...POSE_DEFAULTS };
  readonly headTop = new THREE.Object3D();
  readonly pawTip = new THREE.Object3D();
  readonly fx = new THREE.Group();
  style: CatStyle = 'anime';
  outfit: CatOutfit = 'plain';
  private body: THREE.SkinnedMesh;
  private outline: THREE.SkinnedMesh;
  private shells: THREE.SkinnedMesh[] = [];
  private outlineWidth = { value: 0.0085 };
  private duals: Dual[] = [];
  private rims: RimUniforms[] = [];
  private outlines: THREE.Mesh[] = [];
  private eyes: Eye[] = [];
  private eyeArcs: THREE.Mesh[] = [];
  private arcMat = new THREE.MeshBasicMaterial({ color: '#eef0ff' });
  private legs: Leg[] = [];
  private whiskers: THREE.Group[] = [];
  private blush: THREE.Mesh[] = [];
  private mouthOpen: THREE.Mesh[] = [];
  private outfits: Record<CatOutfit, THREE.Object3D[]> = { plain: [], collar: [], teacher: [], professor: [] };
  private pointer?: THREE.Object3D;
  private shadow: THREE.Mesh;
  private fxList: Fx[] = [];
  private tailPhase = 0;
  private blinkAt = 2;
  private blinkT = -1;
  private time = 0;
  private gradient = gradientMap();
  private owned: { dispose(): void }[] = [];

  constructor(data: CatMeshData, shellCount: number) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(data.position, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(data.normal, 3));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(data.skinIndex, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(data.skinWeight, 4));
    geometry.setIndex(new THREE.BufferAttribute(data.index, 1));
    this.owned.push(geometry, this.gradient);

    const fur = this.dual('#2c2f47', '#282a38', { rim: '#8a9cf0', soft: { roughness: 0.5, sheen: 1, sheenColor: new THREE.Color('#8696d8'), sheenRoughness: 0.35 } });
    this.body = new THREE.SkinnedMesh(geometry, fur.anime);
    this.body.frustumCulled = false;
    fur.meshes.push(this.body);
    for (const def of BONES) {
      const bone = new THREE.Bone(); bone.name = def.name;
      const p = def.parent ? boneAt(def.parent) : [0, 0, 0];
      bone.position.set(def.at[0] - p[0], def.at[1] - p[1], def.at[2] - p[2]);
      this.bones[def.name] = bone;
      if (def.parent) this.bones[def.parent].add(bone);
    }
    this.body.add(this.bones.root);
    this.body.bind(new THREE.Skeleton(BONES.map(def => this.bones[def.name])));
    this.outline = new THREE.SkinnedMesh(geometry, outlineMaterial(this.outlineWidth));
    this.outline.bind(this.body.skeleton, this.body.bindMatrix);
    this.outline.frustumCulled = false;
    this.owned.push(this.outline.material as THREE.Material);
    this.group.add(this.body, this.outline);
    this.setShells(shellCount, geometry);

    this.buildLegs();
    this.buildEars(fur);
    this.buildFace(fur);
    this.buildTufts(fur);
    this.buildOutfits();
    const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 64;
    const sg = shadowCanvas.getContext('2d')!, gr = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(10,10,25,.42)'); gr.addColorStop(1, 'rgba(10,10,25,0)'); sg.fillStyle = gr; sg.fillRect(0, 0, 64, 64);
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.5), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = 0.002; this.shadow.renderOrder = -1;
    this.owned.push(shadowTex, this.shadow.geometry, this.shadow.material as THREE.Material);
    this.group.add(this.shadow);
    this.bones.head.add(this.headTop); this.headTop.position.set(0.02, 0.2, 0);
    this.bones.handR.add(this.pawTip); this.pawTip.position.set(0.06, 0, 0);
    this.setStyle('anime');
  }

  /** A material in both looks; meshes registered here switch on setStyle. */
  private dual(color: string, softColor: string, o: { rim?: string; metal?: boolean; soft?: THREE.MeshPhysicalMaterialParameters; basic?: boolean } = {}): Dual {
    let anime: THREE.Material, soft: THREE.Material;
    if (o.basic) { anime = new THREE.MeshBasicMaterial({ color }); soft = new THREE.MeshBasicMaterial({ color: softColor }); }
    else {
      anime = new THREE.MeshToonMaterial({ color, gradientMap: this.gradient });
      soft = new THREE.MeshPhysicalMaterial({ color: softColor, roughness: o.metal ? 0.28 : 0.55, metalness: o.metal ? 0.85 : 0, ...o.soft });
      if (o.rim) {
        addRim(anime, o.rim, 0.85, 0.32, 1);
        addRim(soft, o.rim, 0.9, 0, 0);
      }
    }
    const d: Dual = { anime, soft, meshes: [] };
    this.duals.push(d); this.owned.push(anime, soft);
    return d;
  }
  private mesh(geometry: THREE.BufferGeometry, mat: Dual, bone: string, at: THREE.Vector3 | V3, outline = false) {
    const m = new THREE.Mesh(geometry, mat.anime);
    m.position.copy(local(bone, at)); mat.meshes.push(m);
    this.bones[bone].add(m); this.owned.push(geometry);
    if (outline) this.addOutline(m);
    return m;
  }
  private addOutline(m: THREE.Mesh) {
    const o = new THREE.Mesh(m.geometry, this.outline.material as THREE.Material);
    m.add(o); this.outlines.push(o);
  }

  setShells(count: number, geometry = this.body.geometry) {
    for (const s of this.shells) { this.group.remove(s); (s.material as THREE.Material).dispose(); }
    this.shells = [];
    for (let i = 1; i <= count; i++) {
      const s = new THREE.SkinnedMesh(geometry, shellMaterial(i / count, (0.011 * i) / count));
      s.bind(this.body.skeleton, this.body.bindMatrix); s.frustumCulled = false; s.visible = this.style === 'soft';
      this.shells.push(s); this.group.add(s);
    }
  }

  private buildLegs() {
    const make = (side: 'L' | 'R', front: boolean): Leg => {
      const names = front ? ['shoulder', 'elbow', 'wrist', 'hand'] : ['thigh', 'knee', 'hock', 'foot'];
      const b = names.map(n => this.bones[n + side]) as Leg['b'];
      const seg = [b[1].position, b[2].position, b[3].position];
      return {
        b, parent: b[0].parent as THREE.Bone, front, z: b[0].position.z,
        L: seg.map(p => Math.hypot(p.x, p.y)) as Leg['L'], phi: seg.map(p => Math.atan2(p.y, p.x)) as Leg['phi'],
        key: `${front ? 'f' : 'h'}${side.toLowerCase()}` as Leg['key'],
      };
    };
    this.legs = [make('L', true), make('R', true), make('L', false), make('R', false)];
    // z of the leg in its parent frame is the bone's bind offset from the spine, which equals its world z.
    for (const leg of this.legs) leg.z = boneAt(leg.b[0].name)[2];
  }

  private buildEars(fur: Dual) {
    const inner = this.dual('#6d4a63', '#4a3242');
    const hair = this.dual('#c3c8e6', '#9aa0bd', { basic: true });
    for (const side of ['L', 'R'] as const) {
      const s = side === 'L' ? 1 : -1;
      const g = new THREE.ConeGeometry(0.058, 0.142, 24, 6); g.translate(0, 0.071, 0); g.scale(0.58, 1, 1);
      const pos = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        if (x > 0) pos.setX(i, x - 0.016 * (1 - (z / 0.058) ** 2) * (1 - y / 0.142));
      }
      g.computeVertexNormals();
      const ear = new THREE.Group(); ear.position.set(0, -0.026, 0); ear.rotation.set(s * 0.3, -s * 0.22, 0.1);
      this.bones[`ear${side}`].add(ear);
      const outer = new THREE.Mesh(g, fur.anime); fur.meshes.push(outer); ear.add(outer); this.addOutline(outer);
      const ig = new THREE.ConeGeometry(0.043, 0.112, 20, 1); ig.translate(0, 0.056, 0); ig.scale(0.28, 1, 1);
      const im = new THREE.Mesh(ig, inner.anime); im.position.set(0.01, 0.008, 0); inner.meshes.push(im); ear.add(im);
      for (const [dz, h, a] of [[-0.012, 0.06, 0.25], [0.004, 0.075, 0.05], [0.018, 0.055, -0.3]]) {
        const hg = new THREE.ConeGeometry(0.004, h, 4); hg.translate(0, h / 2, 0);
        const hm = new THREE.Mesh(hg, hair.anime); hm.position.set(0.016, 0.012, dz * s); hm.rotation.set(a * s, 0, -0.12); hair.meshes.push(hm); ear.add(hm);
        this.owned.push(hg);
      }
      this.owned.push(g, ig);
    }
  }

  private buildFace(fur: Dual) {
    // Eyes: anime iris shader with slit pupil, lids from the fur material.
    for (const side of [1, -1]) {
      const uniforms = { uPupil: { value: 0.38 }, uShine: { value: 1 }, uIrisIn: { value: new THREE.Color('#d6ec58') }, uIrisOut: { value: new THREE.Color('#f2a91e') }, uRimC: { value: new THREE.Color('#5a3208') } };
      const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: EYE_VERT, fragmentShader: EYE_FRAG });
      const pivot = new THREE.Group(); pivot.position.copy(local('head', [EYE.x, EYE.y, EYE.z * side])); pivot.rotation.y = -0.24 * side;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(EYE.r, 40, 28), mat);
      const tilt = new THREE.Group();
      const upper = new THREE.Mesh(new THREE.SphereGeometry(EYE.r * 1.07, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), fur.anime);
      const lower = new THREE.Mesh(new THREE.SphereGeometry(EYE.r * 1.065, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), fur.anime);
      fur.meshes.push(upper, lower);
      tilt.add(upper, lower); pivot.add(ball, tilt); this.bones.head.add(pivot);
      // Anime "^" for closed happy eyes: a light arch lying on the closed lids.
      const arcPts = Array.from({ length: 9 }, (_, i) => {
        const u = i / 4 - 1, z = u * 0.8 * EYE.r, y = (0.32 - 0.5 * u * u) * EYE.r, rr = EYE.r * 1.1;
        return new THREE.Vector3(Math.sqrt(Math.max(0, rr * rr - y * y - z * z)), y, z);
      });
      const arc = new THREE.Mesh(taperTube(arcPts, 0.0042, 0.0042, 6, 16), this.arcMat);
      arc.visible = false; pivot.add(arc); this.eyeArcs.push(arc); this.owned.push(arc.geometry);
      this.eyes.push({ pivot, ball, tilt, upper, lower, side, uniforms });
      this.owned.push(mat, ball.geometry, upper.geometry, lower.geometry);
    }
    // Nose with a glint.
    const nose = this.dual('#2a2230', '#211b26', { soft: { roughness: 0.25, clearcoat: 1 } });
    const n = this.mesh(new THREE.SphereGeometry(1, 20, 14), nose, 'head', [0.497, 0.747, 0]);
    n.scale.set(0.017, 0.0125, 0.024);
    const glint = this.dual('#ffffff', '#ffffff', { basic: true });
    this.mesh(new THREE.SphereGeometry(0.0042, 8, 6), glint, 'head', [0.511, 0.755, 0.007]);
    // Mouth: the ω line, and an opening that grows with the jaw.
    const line = this.dual('#8f8aad', '#5a566e', { basic: true });
    for (const s of [1, -1]) {
      const pts = ([[0.736, 0], [0.723, 0.001], [0.712, 0.016], [0.716, 0.031]] as [number, number][])
        .map(([y, z]) => surface([0.62, y, z * s], [-1, 0, -0.15 * s * (z > 0.02 ? 1 : 0)], -0.0012));
      this.mesh(taperTube(pts.map(p => local('head', p)), 0.0019, 0.0013, 5, 10), line, 'head', [0.335, 0.74, 0]);
    }
    const mouth = this.dual('#3d0f1c', '#3a0d18', { basic: true });
    const tongue = this.dual('#e27a8c', '#d76b7e');
    const inside = this.mesh(new THREE.SphereGeometry(1, 20, 14), mouth, 'jaw', [0.474, 0.703, 0]);
    const tong = this.mesh(new THREE.SphereGeometry(1, 16, 10), tongue, 'jaw', [0.48, 0.693, 0]);
    this.mouthOpen.push(inside, tong);
    const fang = this.dual('#ffffff', '#f4f2ec', { basic: true });
    for (const s of [1, -1]) {
      const fg = new THREE.ConeGeometry(0.0045, 0.014, 6); fg.rotateZ(Math.PI);
      this.mouthOpen.push(this.mesh(fg, fang, 'head', [0.49, 0.706, 0.012 * s]));
    }
    // Whiskers (pads and brows), each side in a group so emotions can sweep them.
    const whisker = new THREE.MeshBasicMaterial({ color: '#e6eaf6', transparent: true, opacity: 0.92 });
    this.owned.push(whisker);
    for (const s of [1, -1]) {
      const group = new THREE.Group(); group.position.copy(local('head', [0.47, 0.71, 0.03 * s])); this.bones.head.add(group);
      const pad = new THREE.Vector3(0.47, 0.71, 0.03 * s);
      for (const [y, zo, droop, len] of [[0.716, 0.034, 0.012, 0.19], [0.707, 0.04, 0.03, 0.2], [0.698, 0.037, 0.05, 0.17], [0.69, 0.031, 0.065, 0.14]]) {
        const root = surface([0.62, y, zo * s], [-1, 0, 0], 0.002);
        const pts = [root, root.clone().add(new THREE.Vector3(-0.02 * len / 0.2, -droop * 0.25, 0.08 * s * len / 0.2)), root.clone().add(new THREE.Vector3(-0.05 * len / 0.2, -droop, 0.17 * s * len / 0.2))];
        const m = new THREE.Mesh(taperTube(pts.map(p => p.clone().sub(pad)), 0.0024, 0.0004, 4, 12), whisker);
        group.add(m); this.owned.push(m.geometry);
      }
      for (const [dz, len] of [[0.05, 0.075], [0.068, 0.062]]) {
        const root = surface([0.6, 0.835, dz * s], [-1, 0, 0], 0.002);
        const pts = [root, root.clone().add(new THREE.Vector3(-0.005, 0.03, 0.025 * s)), root.clone().add(new THREE.Vector3(-0.025, 0.05, len * s))];
        const m = new THREE.Mesh(taperTube(pts.map(p => local('head', p)), 0.0018, 0.0003, 4, 10), whisker);
        this.bones.head.add(m); this.owned.push(m.geometry);
      }
      this.whiskers.push(group);
    }
    // Anime blush on the cheeks.
    const blushTex = blushTexture(); this.owned.push(blushTex);
    for (const s of [1, -1]) {
      const p = surface([0.62, 0.737, 0.24 * s], [-1, 0, -0.62 * s], -0.004);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.035), new THREE.MeshBasicMaterial({ map: blushTex, transparent: true, depthWrite: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4 }));
      m.position.copy(local('head', p)); m.lookAt(m.position.clone().add(new THREE.Vector3(1, 0, 0.62 * s)));
      this.bones.head.add(m); this.blush.push(m); this.owned.push(m.geometry, m.material as THREE.Material);
    }
    // Toe beans under the front paws (visible when a paw is raised).
    const bean = this.dual('#5e3a4e', '#4e3140');
    for (const side of ['L', 'R']) {
      const h = boneAt(`hand${side}`);
      const main = this.mesh(new THREE.SphereGeometry(1, 12, 8), bean, `hand${side}`, [h[0] + 0.004, 0.0035, h[2]]); main.scale.set(0.019, 0.004, 0.022);
      for (const [dx, dz] of [[0.036, -0.027], [0.044, -0.009], [0.044, 0.009], [0.036, 0.027]]) {
        const toe = this.mesh(new THREE.SphereGeometry(1, 10, 6), bean, `hand${side}`, [h[0] + dx, 0.004, h[2] + dz]); toe.scale.set(0.008, 0.003, 0.0075);
      }
    }
  }

  private buildTufts(fur: Dual) {
    const tuft = (bone: string, at: THREE.Vector3, dir: THREE.Vector3, r: number, h: number) => {
      const g = new THREE.ConeGeometry(r, h, 5); g.translate(0, h / 2 - 0.006, 0);
      const m = this.mesh(g, fur, bone, at, true);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    };
    for (const s of [1, -1]) {
      for (const [y, x, dy, len] of [[0.71, 0.36, -0.15, 0.05], [0.69, 0.375, -0.45, 0.045], [0.672, 0.39, -0.75, 0.034]]) {
        tuft('head', surface([x, y, 0.3 * s], [0, 0, -s], 0.005), new THREE.Vector3(-0.35, dy, s), 0.017, len);
      }
    }
  }

  private buildOutfits() {
    const neckA = new THREE.Vector3(0.17, 0.56, 0), neckB = new THREE.Vector3(0.3, 0.71, 0);
    const axis = neckB.clone().sub(neckA).normalize(), downFront = new THREE.Vector3(axis.y, -axis.x, 0);
    const neckRadius = (c: THREE.Vector3) => {
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2, d = downFront.clone().multiplyScalar(Math.cos(a)).add(new THREE.Vector3(0, 0, Math.sin(a)));
        const p = surface(c.clone().addScaledVector(d, 0.3).toArray() as V3, d.clone().negate().toArray() as V3);
        sum += p.distanceTo(c);
      }
      return sum / 12;
    };
    const ring = (center: THREE.Vector3, tube: number, mat: Dual, bone: string, extra = 0) => {
      const radius = neckRadius(center) + tube * 0.45 + extra;
      const m = this.mesh(new THREE.TorusGeometry(radius, tube, 12, 56), mat, bone, center, true);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
      return { m, radius };
    };
    // Collar: Latvian carmine with a gold bell.
    const red = this.dual('#a3203a', '#8c1a30');
    const gold = this.dual('#f1c04f', '#d9a63c', { metal: true });
    const collarC = neckA.clone().lerp(neckB, 0.42);
    const collar = ring(collarC, 0.012, red, 'neck');
    const bell = this.mesh(new THREE.SphereGeometry(0.021, 20, 14), gold, 'neck', collarC.clone().addScaledVector(downFront, collar.radius + 0.018), true);
    this.outfits.collar.push(collar.m, bell);
    // Teacher: round gold glasses, navy bow tie, pointer stick.
    const glasses = new THREE.Group();
    const frame = this.dual('#e3b54a', '#caa04a', { metal: true });
    const lensTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!;
      g.fillStyle = 'rgba(210,230,255,.16)'; g.beginPath(); g.arc(32, 32, 32, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineCap = 'round'; g.lineWidth = 7; g.beginPath(); g.moveTo(14, 30); g.lineTo(30, 14); g.stroke();
      g.lineWidth = 4; g.beginPath(); g.moveTo(22, 40); g.lineTo(40, 22); g.stroke();
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const lensMat = new THREE.MeshBasicMaterial({ map: lensTex, transparent: true, depthWrite: false });
    this.owned.push(lensTex, lensMat);
    for (const s of [1, -1]) {
      const c = new THREE.Vector3(EYE.x + 0.047, EYE.y + 0.003, (EYE.z + 0.006) * s);
      const rim = this.mesh(new THREE.TorusGeometry(0.037, 0.0042, 8, 44), frame, 'head', c);
      rim.rotation.y = Math.PI / 2; glasses.add(rim);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.035, 32), lensMat); lens.position.copy(local('head', c)); lens.rotation.y = Math.PI / 2; glasses.add(lens); this.owned.push(lens.geometry);
      const arm = this.mesh(taperTube([new THREE.Vector3(c.x - 0.004, c.y + 0.008, c.z + 0.036 * s), new THREE.Vector3(c.x - 0.06, c.y + 0.02, c.z + 0.06 * s), new THREE.Vector3(0.36, 0.82, 0.13 * s)].map(p => local('head', p)), 0.004, 0.003, 5, 8), frame, 'head', [0.335, 0.74, 0]);
      glasses.add(arm);
    }
    const bridgeX = EYE.x + 0.05;
    glasses.add(this.mesh(taperTube([new THREE.Vector3(bridgeX, EYE.y + 0.01, 0.023), new THREE.Vector3(bridgeX + 0.006, EYE.y + 0.02, 0), new THREE.Vector3(bridgeX, EYE.y + 0.01, -0.023)].map(p => local('head', p)), 0.0042, 0.0042, 5, 8), frame, 'head', [0.335, 0.74, 0]));
    this.bones.head.add(glasses);
    const navy = this.dual('#28366e', '#1f2a58');
    const bowAt = surface(neckA.clone().lerp(neckB, 0.62).addScaledVector(downFront, 0.3).toArray() as V3, downFront.clone().negate().toArray() as V3, -0.012);
    const bow = new THREE.Group(); bow.position.copy(local('neck', bowAt)); bow.rotation.z = Math.atan2(downFront.y, downFront.x);
    for (const s of [1, -1]) {
      const wg = new THREE.ConeGeometry(0.028, 0.05, 4); wg.scale(0.45, 1, 1); wg.rotateX(-s * Math.PI / 2); wg.translate(0, 0, s * 0.026);
      const w = new THREE.Mesh(wg, navy.anime); navy.meshes.push(w); bow.add(w); this.addOutline(w); this.owned.push(wg);
    }
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.013, 12, 8), navy.anime); navy.meshes.push(knot); bow.add(knot); this.owned.push(knot.geometry);
    this.bones.neck.add(bow);
    const wood = this.dual('#a0703f', '#8a5a2b');
    const stickG = new THREE.CylinderGeometry(0.0045, 0.0062, 0.4, 8); stickG.rotateZ(-Math.PI / 2); stickG.translate(0.2, 0, 0);
    const pointer = new THREE.Group(); pointer.position.copy(local('handR', [boneAt('handR')[0] + 0.01, 0.04, boneAt('handR')[2]]));
    const stick = new THREE.Mesh(stickG, wood.anime); wood.meshes.push(stick); pointer.add(stick); this.addOutline(stick); this.owned.push(stickG);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), red.anime); tip.position.x = 0.4; red.meshes.push(tip); pointer.add(tip); this.owned.push(tip.geometry);
    this.bones.handR.add(pointer); this.pointer = pointer;
    this.outfits.teacher.push(glasses, bow, pointer);
    // Professor: mortarboard with a gold tassel, glasses and a red-white-red scarf.
    const cap = new THREE.Group(); cap.position.set(0.05, 0.13, 0); cap.rotation.z = -0.14;
    const capMat = this.dual('#27305a', '#1d2240');
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.064, 0.05, 28), capMat.anime); crown.position.y = 0.02;
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.012, 0.15), capMat.anime); board.position.y = 0.05;
    capMat.meshes.push(crown, board); cap.add(crown, board); this.addOutline(crown); this.addOutline(board);
    const button = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 6), gold.anime); button.position.y = 0.058; gold.meshes.push(button);
    const cord = new THREE.Mesh(taperTube([new THREE.Vector3(0, 0.058, 0), new THREE.Vector3(0.05, 0.058, 0.05), new THREE.Vector3(0.074, 0.05, 0.072), new THREE.Vector3(0.078, 0.0, 0.076)], 0.002, 0.002, 4, 10), gold.anime); gold.meshes.push(cord);
    const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.03, 8), gold.anime); tassel.position.set(0.078, -0.012, 0.076); gold.meshes.push(tassel);
    cap.add(button, cord, tassel); this.bones.head.add(cap);
    this.owned.push(crown.geometry, board.geometry, button.geometry, cord.geometry, tassel.geometry);
    const stripes = (horizontal: boolean) => {
      const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d')!;
      g.fillStyle = '#9e1b32'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#f4f1ea';
      if (horizontal) g.fillRect(0, 12, 32, 8); else g.fillRect(12, 0, 8, 32);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; this.owned.push(t); return t;
    };
    const scarfMat = this.dual('#ffffff', '#ffffff');
    const tailMat = this.dual('#ffffff', '#ffffff');
    for (const m of [scarfMat.anime, scarfMat.soft]) (m as THREE.MeshToonMaterial).map = stripes(true);
    for (const m of [tailMat.anime, tailMat.soft]) (m as THREE.MeshToonMaterial).map = stripes(false);
    const scarf = ring(neckA.clone().lerp(neckB, 0.3), 0.024, scarfMat, 'neck', 0.004);
    const tails = new THREE.Group(); tails.position.copy(local('spine2', surface(neckA.clone().lerp(neckB, 0.15).addScaledVector(downFront, 0.3).toArray() as V3, downFront.clone().negate().toArray() as V3, -0.02)));
    for (const [z, a] of [[0.03, 0.18], [-0.025, -0.1]]) {
      const tg = new THREE.BoxGeometry(0.014, 0.16, 0.048); tg.translate(0, -0.075, 0);
      const t = new THREE.Mesh(tg, tailMat.anime); t.position.z = z; t.rotation.set(a, 0, 0.25); tailMat.meshes.push(t); tails.add(t); this.addOutline(t); this.owned.push(tg);
    }
    this.bones.spine2.add(tails);
    const glasses2 = glasses.clone(); this.bones.head.add(glasses2);
    glasses2.traverse(o => { if (o instanceof THREE.Mesh && o.material !== lensMat) frame.meshes.push(o); });
    this.outfits.professor.push(cap, scarf.m, tails, glasses2);
    for (const part of Object.values(this.outfits).flat()) part.visible = false;
  }

  setOutfit(outfit: CatOutfit) {
    this.outfit = outfit;
    for (const [name, parts] of Object.entries(this.outfits)) for (const p of parts) p.visible = name === outfit;
  }

  setStyle(style: CatStyle) {
    this.style = style;
    for (const d of this.duals) for (const m of d.meshes) m.material = style === 'anime' ? d.anime : d.soft;
    this.outlineWidth.value = style === 'anime' ? 0.0085 : 0.0032;
    for (const s of this.shells) s.visible = style === 'soft';
    for (const e of this.eyes) e.uniforms.uShine.value = style === 'anime' ? 1 : 0.38;
  }

  /** Spawns an emotion mark near the head (world space, so it does not turn with the cat). */
  emote(kind: SpriteKind) {
    const mat = new THREE.SpriteMaterial({ map: spriteTexture(kind), transparent: true, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(mat); sprite.renderOrder = 10;
    const from = new THREE.Vector3();
    const seed = Math.random();
    if (kind === 'tear') this.eyes[seed < 0.5 ? 0 : 1].pivot.getWorldPosition(from); else this.headTop.getWorldPosition(from);
    const life: Record<SpriteKind, number> = { heart: 1.5, anger: 1.5, sweat: 1.7, exclaim: 1.2, question: 1.9, sparkle: 0.9, zzz: 2.2, note: 1.7, gloom: 2.2, tear: 0.95, dots: 2.4 };
    this.fx.add(sprite);
    this.fxList.push({ sprite, kind, age: 0, life: life[kind], from, seed });
  }

  private updateFx(dt: number) {
    for (let i = this.fxList.length - 1; i >= 0; i--) {
      const f = this.fxList[i];
      f.age += dt;
      const u = f.age / f.life, s = f.sprite, r = f.seed;
      const fade = Math.min(1, f.age / 0.15) * (1 - Math.max(0, (u - 0.75) / 0.25));
      const pop = (size: number) => size * (u < 0.15 ? 1.25 * Math.sin((u / 0.15) * Math.PI * 0.6) / Math.sin(Math.PI * 0.6) : 1);
      const p = s.position.copy(f.from);
      switch (f.kind) {
        case 'heart': p.add(new THREE.Vector3((r - 0.5) * 0.25 + Math.sin(f.age * 4 + r * 6) * 0.03, -0.05 + u * 0.32, 0.1)); s.scale.setScalar(pop(0.1)); break;
        case 'anger': p.add(new THREE.Vector3(0.14, 0.02, 0.1)); s.scale.setScalar(0.09 + Math.max(0, Math.sin(f.age * 14)) * 0.025); break;
        case 'sweat': p.add(new THREE.Vector3(-0.16, -0.02 - u * 0.08, 0.1)); s.scale.setScalar(pop(0.075)); break;
        case 'exclaim': p.add(new THREE.Vector3(0.12, 0.1, 0.1)); s.scale.setScalar(pop(0.14)); break;
        case 'question': p.add(new THREE.Vector3(0.13, 0.08 + Math.sin(f.age * 5) * 0.012, 0.1)); s.scale.setScalar(pop(0.12)); break;
        case 'sparkle': p.add(new THREE.Vector3(Math.cos(r * 9) * 0.2, Math.sin(r * 9) * 0.12 + 0.02, 0.12)); s.scale.setScalar(0.09 * Math.sin(u * Math.PI)); break;
        case 'zzz': p.add(new THREE.Vector3(0.1 + u * 0.14, 0.02 + u * 0.18, 0.1)); s.scale.setScalar(0.06 + u * 0.06); break;
        case 'note': p.add(new THREE.Vector3((r - 0.5) * 0.3 + Math.sin(f.age * 5) * 0.03, u * 0.25, 0.1)); s.scale.setScalar(pop(0.085)); break;
        case 'gloom': p.add(new THREE.Vector3(0.04, -0.12, 0.16)); s.scale.setScalar(0.13); break;
        case 'tear': p.add(new THREE.Vector3(0.012, -0.02 - u * u * 0.16, 0.05)); s.scale.setScalar(0.045); break;
        case 'dots': p.add(new THREE.Vector3(0.17, 0.12, 0.1)); s.scale.setScalar(pop(0.13)); break;
      }
      s.material.opacity = fade;
      if (f.age >= f.life) { this.fx.remove(s); s.material.dispose(); this.fxList.splice(i, 1); }
    }
  }

  /** Eases toward `target` and applies the pose. `rate` scales all easing speeds (jumps use ~2.5). */
  update(target: Pose, dt: number, rate = 1) {
    this.time += dt;
    for (const key in target) {
      const k = key as PoseKey;
      this.pose[k] += (target[k] - this.pose[k]) * (1 - Math.exp(-(RATE[k] ?? 9) * rate * dt));
    }
    const P = this.pose, B = this.bones;
    B.root.position.set(P.bodyX, P.bodyY + Math.sin(this.time * 58) * 0.0016 * P.purr, 0);
    B.root.rotation.set(P.bodyRoll, 0, P.bodyPitch);
    B.root.scale.set(P.stretch, P.squash, 1 / Math.sqrt(Math.max(0.3, P.stretch * P.squash)));
    B.hips.rotation.set(P.twist * 0.5, -P.bend * 0.35, P.hips);
    B.spine1.rotation.set(P.twist * 0.5, P.bend * 0.35, P.spine1);
    B.spine2.rotation.set(0, P.bend * 0.35, P.spine2);
    B.neck.rotation.set(0, P.headYaw * 0.35, P.neck);
    B.head.rotation.set(P.headRoll, P.headYaw * 0.65, P.headPitch);
    B.jaw.rotation.z = -P.jaw * 0.42;
    B.earL.rotation.set(P.earOutL * 0.85, -P.earTurnL * 0.8, P.earBackL * 0.95);
    B.earR.rotation.set(-P.earOutR * 0.85, P.earTurnR * 0.8, P.earBackR * 0.95);
    this.tailPhase += dt * P.tailSpeed * Math.PI * 2 * 0.55;
    for (let i = 0; i < TAIL_BONES; i++) {
      const bone = B[`tail${i}`], f = i / (TAIL_BONES - 1);
      const w = Math.sin(this.tailPhase - i * 0.62) * P.tailWave * (0.35 + f);
      bone.rotation.set(0, i ? P.tailSideCurl / TAIL_BONES + w * 0.55 : P.tailSide + w * 0.3, i ? -P.tailCurl / TAIL_BONES - Math.cos(this.tailPhase - i * 0.62) * P.tailWave * 0.12 : -P.tailLift);
      // Puffing the first vertebra thickens the whole tail (children inherit the scale).
      if (i === 1) bone.scale.set(1, P.tailPuff, P.tailPuff);
    }
    B.root.updateMatrixWorld(true);
    for (const leg of this.legs) this.solveLeg(leg);

    // Face.
    this.blinkAt -= dt;
    if (this.blinkAt <= 0 && this.blinkT < 0) { this.blinkT = 0; this.blinkAt = 2 + Math.random() * 4.5; }
    let blink = 0;
    if (this.blinkT >= 0) { this.blinkT += dt; blink = Math.sin(Math.min(1, this.blinkT / 0.16) * Math.PI); if (this.blinkT > 0.16) this.blinkT = -1; }
    for (const e of this.eyes) {
      const up = clamp(Math.max(P.lidUp + (e.side > 0 ? P.wink : 0), blink), -0.3, 1);
      e.upper.rotation.z = lerp(1.0, -1.22, up);
      e.lower.rotation.z = lerp(-0.92, 0.08, clamp(P.lidLow + blink * 0.25, 0, 1));
      e.tilt.rotation.x = -e.side * P.lidTilt * 0.32;
      e.ball.rotation.set(0, P.lookX * 0.32, P.lookY * 0.26);
      e.uniforms.uPupil.value = clamp(P.pupil, 0.06, 1);
    }
    const arcs = clamp(P.happyEyes, 0, 1);
    for (const arc of this.eyeArcs) { arc.visible = arcs > 0.05; arc.scale.set(1, 0.4 + 0.6 * arcs, 0.7 + 0.3 * arcs); }
    this.whiskers.forEach((w, i) => { const s = i ? -1 : 1; w.rotation.set(0, s * P.whisk * 0.28, P.whisk * 0.05); });
    for (const b of this.blush) (b.material as THREE.MeshBasicMaterial).opacity = clamp(P.blush, 0, 1) * 0.85;
    const open = clamp(P.jaw, 0, 1);
    const [inside, tongue, fangL, fangR] = this.mouthOpen;
    inside.scale.set(0.026 + open * 0.008, 0.004 + open * 0.026, 0.024 + open * 0.004);
    tongue.scale.set(0.014, 0.004 + open * 0.008, 0.014 + open * 0.004); tongue.visible = open > 0.25;
    fangL.visible = fangR.visible = open > 0.18;
    if (this.pointer) { const p = clamp(P.pointer, 0, 1); this.pointer.scale.set(Math.max(0.001, p), 1, 1); this.pointer.visible = this.outfit === 'teacher' && p > 0.02; }
    this.shadow.position.x = P.bodyX - 0.05;
    this.updateFx(dt);
  }

  setShadowOpacity(v: number) { (this.shadow.material as THREE.MeshBasicMaterial).opacity = v; }

  private solveLeg(leg: Leg) {
    const P = this.pose, root = this.bones.root;
    // Targets are given on the ground (mesh frame) or, in flight, relative to the body (root bone frame).
    const inv = new THREE.Matrix4().copy(leg.parent.matrixWorld).invert();
    const Mg = inv.clone().multiply(this.body.matrixWorld), Mb = inv.multiply(root.matrixWorld), wb = clamp(P.legsBody, 0, 1);
    const angleIn = (M: THREE.Matrix4, a: number) => { const d = new THREE.Vector3(Math.cos(a), Math.sin(a), 0).transformDirection(M); return Math.atan2(d.y, d.x); };
    const dirP = (a: number) => { const g = angleIn(Mg, a); return g + wrapAngle(angleIn(Mb, a) - g) * wb; };
    const pointP = (x: number, y: number) => new THREE.Vector3(x, y, leg.z).applyMatrix4(Mg).lerp(new THREE.Vector3(x, y, leg.z).applyMatrix4(Mb), wb);
    const rho = dirP(0);
    const [b1, b2, b3, b4] = leg.b, [L1, L2, L3] = leg.L, [p1, p2, p3] = leg.phi, S = b1.position;
    let a1: number, a2: number, a3: number, leaf: number;
    if (leg.front) {
      const side = leg.key === 'fl' ? 'fl' : 'fr';
      const x = P[`${side}X`], y = P[`${side}Y`], tilt = P[`${side}Tilt`], raise = clamp(P[`${side}Raise`], 0, 1);
      const paw = pointP(x, y);
      a3 = dirP(p3 + tilt + (y - 0.033) * 3);
      const ik = solveTwoBone(S.x, S.y, paw.x - L3 * Math.cos(a3), paw.y - L3 * Math.sin(a3), L1, L2, -1);
      a1 = ik.a1; a2 = ik.a2; leaf = tilt + rho;
      if (raise > 0) {
        const mix = (a: number, b: number) => a + wrapAngle(b - a) * raise;
        a1 = mix(a1, dirP(P[`${side}A1`])); a2 = mix(a2, dirP(P[`${side}A2`])); a3 = mix(a3, dirP(P[`${side}A3`]));
      }
      b1.rotation.z = a1 - p1; b2.rotation.z = a2 - a1 - (p2 - p1); b3.rotation.z = a3 - a2 - (p3 - p2);
      b4.rotation.z = lerp(leaf - (b1.rotation.z + b2.rotation.z + b3.rotation.z), 0, raise);
    } else {
      const side = leg.key === 'hl' ? 'hl' : 'hr';
      const hock = pointP(P[`${side}X`], P[`${side}Y`]);
      const ik = solveTwoBone(S.x, S.y, hock.x, hock.y, L1, L2, 1);
      a1 = ik.a1; a2 = ik.a2; a3 = dirP(P[`${side}Meta`]);
      b1.rotation.z = a1 - p1; b2.rotation.z = a2 - a1 - (p2 - p1); b3.rotation.z = a3 - a2 - (p3 - p2);
      b4.rotation.z = P[`${side}Foot`] + rho - (b1.rotation.z + b2.rotation.z + b3.rotation.z);
    }
    b1.updateMatrixWorld(true);
  }

  dispose() {
    for (const f of this.fxList) f.sprite.material.dispose();
    for (const s of this.shells) (s.material as THREE.Material).dispose();
    for (const o of this.owned) o.dispose();
    this.arcMat.dispose();
    this.body.skeleton.dispose();
  }
}
