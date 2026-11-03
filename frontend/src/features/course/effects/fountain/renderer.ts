import * as THREE from 'three';
import { FOUNTAIN as F, SCALE, SPRAY, POOL, RING_N, RING_R, RING_ANGLE, type FountainSim } from './sim';
import { createPoolFoam } from './poolFoam';
import { buildFountain, type StoneUniforms } from './geometry';
import { createParticleWater } from './particleWater';
import { buildStatue } from './statue';
import { createFountainStaticBake } from './staticBake';
import { CAPILLARY_WATER_GLSL, WATER_LIGHT_GLSL } from './waterOptics';
import { bakeWaterDetail } from './waterDetail';

/**
 * The fountain drawn with three.js over a photograph of the manor's courtyard (generated, see docs/COURSE_EFFECTS.md).
 * The camera is fixed and matched to the photograph (its horizon, a 58° lens, about 9 m up on the terrace), so the
 * 3D fountain stands on the photographed gravel; its shadow falls on it (a shadow catcher).
 *
 * The falling water has three modes (FountainLook.mode):
 *   - «гибрид» (2, the default): each stream starts as the clear glass thread (below) — the column, the ring's arcs,
 *     the overflow sheet hold together as a smooth body of water — and where it breaks up (`breakup`: a share of its
 *     flight) the thread necks off and the particles take over, flying apart;
 *   - «частицы» (0): drawn from the simulation's own particles all the way — every drop in the air a streak, their
 *     thickness gathered on the screen, smoothed and shaded as water (particleWater.ts);
 *   - «нити» (1, as before): clear threads along paths worked out every frame (below).
 * The water is drawn as clear water, as in the neon glass fountain (glassFountainGL.ts):
 *   - the pool and the bowl are surfaces of their own (meshes at their levels, the pool's lifted by the waves'
 *     heightfield): Fresnel (n = 1.33) between the reflection (the fountain from the mirror pass, else the photograph
 *     looked up in the reflected direction) and the refraction (the stone under the water, displaced, absorbed along
 *     its path through the water: Beer–Lambert), capillary ripples, the sun's glint, foam where the water lands;
 *   - the falling water is clear threads (tubes along the paths the water flies, worked out every frame with the
 *     sim's own air: gravity, drag, wind): the central jet's column, thickening as it slows, a crown of threads falling
 *     back from its top into the bowl, the eight arcs of the ring; each refracts what is behind it (bent across the
 *     thread and turned over, as through a rod of glass), reflects the sky and catches the sun; lower down the threads
 *     neck into beads (the stream breaking into drops) and turn whiter with the air in them;
 *   - the overflow from the bowl's lip is a clear sheet that tears into threads lower down;
 *   - the spray from hard landings stays as short motion-blurred streaks.
 *
 * The courtyard, limestone, wet material, contact shadows and mirror are baked to GPU colour/depth targets once
 * per camera/lighting change. Only water, foam and projected caustics are shaded every animation frame.
 * Passes:
 *   1. scene   — the photograph (cover-cropped, the principal point kept in the middle), then the stone fountain with
 *                the sun's shadows, the basin floor with caustics; colour and depth
 *   2. mirror  — the fountain seen from below the pool's plane (what the pool reflects), half size
 *   3. base    — the scene into the final target, with its depth
 *   4. water   — the pool and the bowl
 *   5. behind  — the picture so far copied (what the falling water refracts)
 *   6. falling — the threads, the sheet, the spray
 *   7. output  — exposure and sRGB (no tone curve: the photograph must stay as it was)
 */

export const BACKDROP = {
  src: (w: number) => (w > 1700 ? '/course/effects/fountain-manor-2560.webp' : '/course/effects/fountain-manor-1600.webp'),
  aspect: 2560 / 1463,
  /** Horizontal field of view the photograph is taken as (degrees), and its horizon (fraction from the top). */
  hfov: 58,
  horizon: 0.277,
};
/** The camera: its height over the gravel and its distance from the fountain's axis (metres). */
const CAM = { height: 9, dist: 23.5 };

export type FountainLook = {
  exposure: number;
  /** Sun strength (1 = matched to the photograph). */
  sun: number;
  /** Reflection strength on the water. */
  reflect: number;
  /** Colour of the water body (0 clear … 2 deep green). */
  tint: number;
  foam: number;
  caustics: number;
  /** Camera shutter for the streaks, seconds. */
  shutter: number;
  /** The falling water: 0 particles, 1 glass threads, 2 hybrid (threads, then particles). */
  mode: number;
  /** Hybrid: where the streams break up, a share of their flight (0 … 1). */
  breakup: number;
  /** Particles: drop size (×), smoothing (px), how white the aerated water is. */
  drop: number;
  smooth: number;
  air: number;
  /** Preview-only replacement of the lower basin's optics; geometry and falling water stay unchanged. */
  pool?: number;
};

const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const LINEARIZE = /* glsl */ `
uniform float uNear;
uniform float uFar;
float linearDepth(float d) { float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }`;

/** Noise, and the photograph looked up in a direction (world): the courtyard's far side is as good as at infinity. */
const WATER_LIB = /* glsl */ `
${WATER_LIGHT_GLSL}
uniform sampler2D uImg; uniform vec2 uScale; uniform mat4 uView; uniform mat4 uProj;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
vec3 photo(vec3 dir) {
  // Above the photograph's top edge (or behind the camera): its sky, deeper blue overhead.
  vec3 skyTop = texture2D(uImg, vec2(0.6, 0.975)).rgb;
  vec3 sky = mix(skyTop * 1.1, skyTop * vec3(0.72, 0.84, 1.05), clamp(dir.y * 1.4, 0.0, 1.0));
  vec3 v = mat3(uView) * dir;
  if (v.z > -0.02) return sky;
  vec4 c = uProj * vec4(v, 0.0);
  vec2 s = c.xy / c.w * 0.5 + 0.5;
  vec2 uv = 0.5 + (s - 0.5) * uScale;
  vec3 img = texture2D(uImg, vec2(clamp(uv.x, 0.005, 0.995), min(uv.y, 0.99))).rgb;
  return mix(img, sky, smoothstep(0.97, 1.08, uv.y));
}`;

type V3 = [number, number, number];
const G = 9.81;

/**
 * A flight through the air as sim.ts steps it (gravity, drag 0.25·|v|, pulled to the wind at 0.6/s): from p with
 * velocity v until `stop` says so (or 6 s), sampled at n even times into out (xyz each); returns the time it took.
 */
function flight(p: V3, v: V3, wind: [number, number], stop: (x: number, y: number, z: number, vy: number) => boolean, n: number, out: Float32Array, offset: number, tMax = Infinity) {
  const dt = 1 / 240;
  const pts: number[] = [p[0], p[1], p[2]];
  let [x, y, z] = p;
  let [vx, vy, vz] = v;
  let t = 0;
  while (t < 6) {
    const sp = Math.hypot(vx, vy, vz);
    const drag = 0.25 * sp;
    vx += ((wind[0] - vx) * 0.6 - vx * drag) * dt;
    vz += ((wind[1] - vz) * 0.6 - vz * drag) * dt;
    vy += (-G - vy * drag) * dt;
    x += vx * dt; y += vy * dt; z += vz * dt;
    t += dt;
    pts.push(x, y, z);
    if (stop(x, y, z, vy) || t >= tMax) break;
  }
  const steps = pts.length / 3 - 1;
  for (let i = 0; i < n; i += 1) {
    const u = (i / (n - 1)) * steps;
    const k = Math.min(steps - 1, Math.floor(u));
    const f = u - k;
    for (let c = 0; c < 3; c += 1) out[offset + i * 3 + c] = pts[k * 3 + c] * (1 - f) + pts[(k + 1) * 3 + c] * f;
  }
  return t;
}

/**
 * Tubes along paths, all in one mesh: `slots` tubes of `rings` rings of `sides` vertices; set() lays one along a path
 * (xyz per ring) with a radius and an airiness per ring (frames carried along the path, so the tube does not twist).
 */
function makeTubes(slots: number, rings: number, sides: number, material: THREE.Material) {
  const nv = slots * rings * sides;
  const pos = new Float32Array(nv * 3);
  const nor = new Float32Array(nv * 3);
  const aer = new Float32Array(nv);
  const rad = new Float32Array(nv);
  const idx: number[] = [];
  const circle = Array.from({ length: sides }, (_, k) => [Math.cos(k / sides * Math.PI * 2), Math.sin(k / sides * Math.PI * 2)]);
  const hidden = new Uint8Array(slots);
  for (let s = 0; s < slots; s += 1) {
    for (let r = 0; r < rings - 1; r += 1) {
      for (let k = 0; k < sides; k += 1) {
        const a = (s * rings + r) * sides + k;
        const b = (s * rings + r) * sides + ((k + 1) % sides);
        idx.push(a, a + sides, b, b, a + sides, b + sides);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aAer', new THREE.BufferAttribute(aer, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aR', new THREE.BufferAttribute(rad, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  return {
    mesh,
    hide(slot: number) {
      if (hidden[slot]) return;
      pos.fill(0, slot * rings * sides * 3, (slot + 1) * rings * sides * 3);
      hidden[slot] = 1;
    },
    set(slot: number, path: Float32Array, offset: number, radius: (i: number) => number, airy: (i: number) => number) {
      hidden[slot] = 0;
      let nx = 0, ny = 0, nz = 0;
      for (let i = 0; i < rings; i += 1) {
        const o = offset + i * 3;
        const a = Math.max(0, i - 1), b = Math.min(rings - 1, i + 1);
        let tx = path[offset + b * 3] - path[offset + a * 3];
        let ty = path[offset + b * 3 + 1] - path[offset + a * 3 + 1];
        let tz = path[offset + b * 3 + 2] - path[offset + a * 3 + 2];
        const tl = Math.hypot(tx, ty, tz) || 1;
        tx /= tl; ty /= tl; tz /= tl;
        if (i === 0) {
          // Any normal to start with: across the path and the vertical (or x for a vertical path).
          const hx = Math.abs(ty) > 0.9 ? 1 : 0, hy = Math.abs(ty) > 0.9 ? 0 : 1;
          nx = ty * 0 - tz * hy; ny = tz * hx - tx * 0; nz = tx * hy - ty * hx;
        }
        // Carried along: what of it lies along the path is taken out.
        const d = nx * tx + ny * ty + nz * tz;
        nx -= d * tx; ny -= d * ty; nz -= d * tz;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;
        const bx = ty * nz - tz * ny, by = tz * nx - tx * nz, bz = tx * ny - ty * nx;
        const rr = radius(i), ai = airy(i);
        for (let k = 0; k < sides; k += 1) {
          const [c, sn] = circle[k];
          const ox = nx * c + bx * sn, oy = ny * c + by * sn, oz = nz * c + bz * sn;
          const v = (slot * rings + i) * sides + k;
          pos[v * 3] = path[o] + ox * rr; pos[v * 3 + 1] = path[o + 1] + oy * rr; pos[v * 3 + 2] = path[o + 2] + oz * rr;
          nor[v * 3] = ox; nor[v * 3 + 1] = oy; nor[v * 3 + 2] = oz;
          aer[v] = ai;
          rad[v] = rr;
        }
      }
    },
    commit() {
      for (const name of ['position', 'normal', 'aAer', 'aR']) (geo.attributes[name] as THREE.BufferAttribute).needsUpdate = true;
    },
    dispose() {
      geo.dispose();
    },
  };
}

/**
 * Options for a page's background (group 1765): `shift` puts the fountain off the middle (the camera slid sideways,
 * the photograph kept: the gravel's plane maps onto itself), at that share of the half-width to the right; `statue`
 * stands the dolphin statue (statue.ts) as far to the left, with its own basin of water and its stream; `back`: the
 * camera that many metres further back (level, so the gravel still maps onto itself): both whole on the screen.
 */
export type FountainLayout = { shift?: number; statue?: boolean; back?: number };

export async function createFountainRenderer(width: number, height: number, dpr: number, sim: FountainSim, layout: FountainLayout = {}, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const backdrop = await new THREE.TextureLoader().loadAsync(BACKDROP.src(width * dpr));
  if (signal?.aborted) {
    backdrop.dispose();
    signal.throwIfAborted();
  }
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.info.autoReset = false;
  const staticBake = createFountainStaticBake();
  const diagnostics = { staticBakes: 0, calls: 0, triangles: 0, pixels: 0, frames: 0 };
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.autoClear = false;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

  let W = 1;
  let H = 1;
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 200);
  const uvScale = new THREE.Vector2(1, 1);
  const camWorld = new THREE.Matrix4();
  const viewMat = new THREE.Matrix4();
  const projMat = new THREE.Matrix4();
  backdrop.colorSpace = THREE.SRGBColorSpace;
  backdrop.minFilter = THREE.LinearMipmapLinearFilter;
  backdrop.anisotropy = 4;

  // --- the 3D scene ----------------------------------------------------------------------------------------------
  const scene = new THREE.Scene();
  const waveHalf = new Uint16Array(sim.waveSize * sim.waveSize);
  const waveTex = new THREE.DataTexture(waveHalf, sim.waveSize, sim.waveSize, THREE.RedFormat, THREE.HalfFloatType);
  waveTex.minFilter = THREE.LinearFilter;
  waveTex.magFilter = THREE.LinearFilter;
  waveTex.needsUpdate = true;
  const poolFoam = createPoolFoam();
  const foamTex = new THREE.DataTexture(poolFoam.pixels, poolFoam.size, poolFoam.size, THREE.RedFormat);
  foamTex.minFilter = foamTex.magFilter = THREE.LinearFilter;
  foamTex.needsUpdate = true;
  const sunDir = new THREE.Vector3(-0.72, 0.95, -0.3).normalize();
  const stoneUniforms: StoneUniforms = { uTime: { value: 0 }, uWaves: { value: waveTex }, uSun: { value: sunDir }, uCaustics: { value: 1 } };
  const fountain = buildFountain(stoneUniforms);
  scene.add(fountain.group);
  const sun = new THREE.DirectionalLight(0xfff1dc, 3.4);
  sun.position.copy(sunDir).multiplyScalar(30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(layout.statue ? 3072 : 2048, layout.statue ? 3072 : 2048);
  const sc = sun.shadow.camera;
  sc.left = -7; sc.right = 7; sc.top = 7; sc.bottom = -7; sc.near = 5; sc.far = 60;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  // Retain the main shadow; the two one-off reflected poses can share their temporary map.
  const mirrorShadow = sun.shadow.clone();
  let shadowsDirty = true;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xbcd3ec, 0x8c7a5c, 0.8);
  scene.add(hemi);
  // The gravel: shadows only (the photograph shows the rest), and a soft contact darkening round the basin.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ color: 0x1a1408, opacity: 0.42 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.002;
  ground.receiveShadow = true;
  scene.add(ground);
  const contact = new THREE.Mesh(
    new THREE.RingGeometry(F.basinOut * 0.95, F.basinOut + 1.4, 128, 1),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uR0: { value: F.basinOut + 0.08 } },
      vertexShader: 'varying vec3 vW; void main() { vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }',
      fragmentShader: 'uniform float uR0; varying vec3 vW; void main() { float d = max(0.0, length(vW.xz) - uR0); float a = pow(1.0 - smoothstep(0.0, 1.3, d), 2.0) * 0.5; gl_FragColor = vec4(0.08, 0.06, 0.03, a); }',
    }),
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.004;
  scene.add(contact);
  // The statue (placed with the camera, in placeCamera) and its own contact darkening.
  const statueAt = { value: new THREE.Vector2() };
  const statue = layout.statue ? buildStatue(stoneUniforms, statueAt) : null;
  const statueContact = statue
    ? new THREE.Mesh(
        new THREE.RingGeometry(statue.basinOut * 0.95, statue.basinOut + 0.9, 96, 1),
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          uniforms: { uR0: { value: statue.basinOut + 0.05 }, uC: statueAt },
          vertexShader: 'varying vec3 vW; void main() { vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }',
          fragmentShader: 'uniform float uR0; uniform vec2 uC; varying vec3 vW; void main() { float d = max(0.0, length(vW.xz - uC) - uR0); float a = pow(1.0 - smoothstep(0.0, 0.85, d), 2.0) * 0.5; gl_FragColor = vec4(0.08, 0.06, 0.03, a); }',
        }),
      )
    : null;
  if (statue && statueContact) {
    statueContact.rotation.x = -Math.PI / 2;
    statueContact.position.y = 0.004;
    scene.add(statue.group, statueContact);
  }

  // Full-screen passes.
  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  quadScene.add(quad);
  const pass = (mat: THREE.Material, target: THREE.WebGLRenderTarget | null, clear = true) => {
    quad.material = mat;
    renderer.setRenderTarget(target);
    if (clear) renderer.clear();
    renderer.render(quadScene, quadCam);
  };
  const backdropMat = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: { uImg: { value: backdrop }, uScale: { value: uvScale } },
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: 'uniform sampler2D uImg; uniform vec2 uScale; varying vec2 vUv; void main() { gl_FragColor = texture2D(uImg, 0.5 + (vUv - 0.5) * uScale); }',
  });

  // Render targets (made in setSize).
  const rtOpts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  let sceneRT = new THREE.WebGLRenderTarget(1, 1, rtOpts);
  let mirrorRT = new THREE.WebGLRenderTarget(1, 1, rtOpts);
  let statueMirrorRT = new THREE.WebGLRenderTarget(1, 1, rtOpts);
  let finalRT = new THREE.WebGLRenderTarget(1, 1, rtOpts);
  let behindRT = new THREE.WebGLRenderTarget(1, 1, { ...rtOpts, depthBuffer: false });
  const res = new THREE.Vector2(1, 1);
  const projScale = { value: 1 };
  const near = { value: camera.near };
  const far = { value: camera.far };
  const sceneDepthU = { value: null as THREE.Texture | null };

  // --- 3. the scene into the final target, with its depth (so the water is hidden behind the stone) ---------------
  const baseMat = new THREE.ShaderMaterial({
    depthTest: true,
    depthWrite: true,
    depthFunc: THREE.AlwaysDepth,
    uniforms: { uScene: { value: null as THREE.Texture | null }, uSceneDepth: sceneDepthU },
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: 'uniform sampler2D uScene; uniform sampler2D uSceneDepth; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(uScene, vUv).rgb, 1.0); gl_FragDepth = texture2D(uSceneDepth, vUv).x; }',
  });
  const copyMat = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: { uTex: { value: null as THREE.Texture | null } },
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: 'uniform sampler2D uTex; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(uTex, vUv).rgb, 1.0); }',
  });

  // --- the mirror: the fountain turned over the pool's plane (the sun with it), seen by the same camera — so the
  // reflection lines up pixel for pixel; only what stood above the water is kept.
  const mirrorClip = new THREE.Plane(new THREE.Vector3(0, -1, 0), F.pool);

  // --- 4. the pool and the bowl ------------------------------------------------------------------------------------
  /** Where the falling water comes down (for the foam): the sheet's ring, the ring's arcs, the crown in the bowl. */
  const landing = { sheet: { value: F.lipR + 0.5 }, arcs: { value: F.plinthR + 0.9 }, crown: { value: 0.5 } };
  const detail = bakeWaterDetail();
  const waterDetailTex = new THREE.DataTexture(detail.data, detail.size, detail.size, THREE.RGBAFormat);
  waterDetailTex.wrapS = waterDetailTex.wrapT = THREE.RepeatWrapping;
  waterDetailTex.magFilter = THREE.LinearFilter;
  waterDetailTex.minFilter = THREE.LinearMipmapLinearFilter;
  waterDetailTex.generateMipmaps = true;
  waterDetailTex.needsUpdate = true;
  const surfaceUniforms = {
    uWaterDetail: { value: waterDetailTex },
    uScene: { value: null as THREE.Texture | null },
    uSceneDepth: sceneDepthU,
    uMirror: { value: null as THREE.Texture | null },
    uImg: { value: backdrop },
    uScale: { value: uvScale },
    uWaves: { value: waveTex },
    uFoamMap: { value: foamTex },
    uPoolLook: { value: 0 },
    uRes: { value: res },
    uView: { value: viewMat },
    uProj: { value: projMat },
    uSunDir: { value: sunDir },
    uSun: { value: 1 },
    uReflect: { value: 1 },
    uTint: { value: 1 },
    uFoam: { value: 1 },
    uCaustics: { value: 1 },
    uTime: { value: 0 },
    uNear: near,
    uFar: far,
    uBasin: { value: new THREE.Vector4(F.basinIn, F.pool, F.bowlWater, F.drainR) },
    uDrain: { value: new THREE.Vector2(F.drainX, F.drainZ) },
    uSheetLand: landing.sheet,
    uArcLand: landing.arcs,
    uCrownLand: landing.crown,
  };
  const surfaceMat = (isPool: boolean) =>
    new THREE.ShaderMaterial({
      uniforms: { ...surfaceUniforms, uIsPool: { value: isPool ? 1 : 0 } },
      vertexShader: /* glsl */ `
uniform sampler2D uWaves; uniform vec4 uBasin; uniform float uIsPool;
varying vec3 vW; varying vec4 vClip;
void main() {
  vec3 w = (modelMatrix * vec4(position, 1.0)).xyz;
  // The pool lifted by the waves.
  if (uIsPool > 0.5) w.y += texture2D(uWaves, (w.xz + uBasin.x) / (2.0 * uBasin.x)).r;
  vW = w;
  vClip = projectionMatrix * viewMatrix * vec4(w, 1.0);
  gl_Position = vClip;
}`,
      fragmentShader: /* glsl */ `
uniform sampler2D uScene; uniform sampler2D uSceneDepth; uniform sampler2D uMirror; uniform sampler2D uWaves;
uniform vec2 uRes; uniform vec3 uSunDir; uniform float uSun; uniform float uReflect; uniform float uTint; uniform float uFoam;
uniform float uTime; uniform float uCaustics; uniform vec4 uBasin; uniform vec2 uDrain; uniform float uIsPool;
uniform sampler2D uFoamMap; uniform float uPoolLook;
uniform float uSheetLand; uniform float uArcLand; uniform float uCrownLand;
${LINEARIZE}
${WATER_LIB}
varying vec3 vW; varying vec4 vClip;
${CAPILLARY_WATER_GLSL}
// How churned the water is here: where the sheet, the arcs and the crown's threads come down.
float churn(vec2 xz, bool pool) {
  float r = length(xz);
  if (!pool) return exp(-pow((r - uCrownLand) / 0.22, 2.0));
  float a = atan(xz.y, xz.x);
  float sec = 6.2831853 / 8.0;
  float ak = (floor(a / sec) + 0.5) * sec;
  vec2 c = uArcLand * vec2(cos(ak), sin(ak));
  vec2 dc = xz - c;
  return exp(-pow((r - uSheetLand) / 0.16, 2.0)) * 0.8 + exp(-dot(dc, dc) / 0.06);
}
// Ring waves running out from where the falling water comes down (owner, 2026-10-30: «нормальные волны от падающей
// вниз воды»): ripples about 25–30 cm long (shorter ones alias at the yard's distance), at about 0.3 m/s, fading with distance; their strength
// uneven round the ring (the sheet does not fall evenly). The slope (gradient of the height) is returned.
vec2 ringSlope(vec2 xz, vec2 centre, float radius, float k, float w, float decay, float amp, float seed) {
  vec2 rel = xz - centre;
  float r = length(rel);
  float d = r - radius;
  float ad = abs(d);
  float wobble = 0.65 + 0.35 * sin(atan(rel.y, rel.x) * 5.0 + seed + uTime * 0.7);
  float fade = exp(-ad * decay) * smoothstep(0.0, 0.05, ad);
  float slope = amp * wobble * fade * (cos(k * ad - w * uTime + seed) + 0.45 * cos(k * 1.9 * ad - w * 1.6 * uTime + seed * 2.0));
  return rel / max(r, 1e-4) * slope * sign(d);
}
vec2 landingRings(vec2 xz, bool pool) {
  // The bowl: rings from the crown's threads. The pool: the overflow sheet's landing circle (rings both outwards and
  // inwards), and the eight arcs, each splash its own expanding rings.
  vec2 g = vec2(0.0);
  if (!pool) g = ringSlope(xz, vec2(0.0), uCrownLand, 30.0, 9.5, 2.2, 0.18, 0.0);
  else {
    g = ringSlope(xz, vec2(0.0), uSheetLand, 23.0, 7.5, 0.95, 0.22, 1.3);
    for (int k = 0; k < 8; k++) {
      float a = (float(k) + 0.5) * 6.2831853 / 8.0;
      g += ringSlope(xz, uArcLand * vec2(cos(a), sin(a)), 0.0, 26.0, 8.5, 1.5, 0.17, float(k) * 1.7);
    }
  }
  return g;
}
void main() {
  bool pool = uIsPool > 0.5;
  bool calm = pool && uPoolLook > 0.5;
  vec2 s = vClip.xy / vClip.w * 0.5 + 0.5;
  float d = vClip.w;
  vec3 V = normalize(vW - cameraPosition);
  // The surface: flat water with the waves and ripples on it.
  vec2 grad = ripples(vW.xz, uTime) * (pool ? 1.0 : 1.25);
  if (calm) grad *= 0.32;
  float ch = churn(vW.xz, pool);
  if (pool) {
    vec2 wuv = (vW.xz + uBasin.x) / (2.0 * uBasin.x);
    float e = 1.5 / 160.0;
    float hx = texture2D(uWaves, wuv + vec2(e, 0.0)).r - texture2D(uWaves, wuv - vec2(e, 0.0)).r;
    float hz = texture2D(uWaves, wuv + vec2(0.0, e)).r - texture2D(uWaves, wuv - vec2(0.0, e)).r;
    grad += vec2(hx, hz) / (2.0 * e * 2.0 * uBasin.x) * (calm ? 0.8 : 0.85);
    // The drain's funnel.
    vec2 toD = vW.xz - uDrain;
    grad += toD * 2.0 * exp(-dot(toD, toD) / 0.03) * 0.9;
  } else {
    // Rings running out from where the crown's threads fall in.
    float r = length(vW.xz);
    grad += vW.xz / max(r, 1e-3) * cos(r * 38.0 - uTime * 11.0) * 0.07 * exp(-abs(r - uCrownLand) * 2.5);
  }
  // The rings from the falling water: kept even in the calm look (they are what the eye expects at a fountain).
  vec2 rings = landingRings(vW.xz, pool) * (calm ? 0.8 : 1.0);
  grad += rings;
  // Advected, mip-filtered microstructure: no second wave octave or per-pixel foam hashes.
  vec4 detail = waterDetail(vW.xz, uTime);
  grad += detail.xy * (calm ? 0.12 : 0.35 + 1.3 * ch);
  if (calm) grad = grad / (1.0 + length(grad) * 0.65);
  vec3 N = normalize(vec3(-grad.x, 1.0, -grad.y));
  if (dot(N, -V) < 0.02) N = normalize(N + (-V) * 0.1);
  float cosi = clamp(dot(-V, N), 0.0, 1.0);
  float fres = waterFresnel(cosi);
  // Reflection: the fountain itself from the mirror pass (pool only), else the photograph.
  vec3 R = reflect(V, N);
  vec3 refl = photo(R);
  if (pool) {
    vec4 m = texture2D(uMirror, s + N.xz * vec2(0.04, -0.04));
    refl = mix(refl, m.rgb, m.a);
  }
  // Refraction: the stone under the water, displaced, absorbed along the path it takes through the water.
  float path;
  vec2 ruv = refractedUv(vW, V, N, pool ? ${(F.pool - F.floor).toFixed(4)} : 0.19, path);
  float rs = linearDepth(texture2D(uSceneDepth, ruv).x);
  if (rs < d) { ruv = s; path = 0.0; }
  vec3 sigma = vec3(0.14, 0.045, 0.025) * uTint + vec3(0.018);
  vec3 trans = exp(-sigma * path);
  vec3 sunCol = vec3(1.0, 0.95, 0.86) * uSun;
  vec3 body = vec3(0.04, 0.062, 0.056) * (0.6 + 0.6 * max(uSunDir.y, 0.0)) * sunCol;
  vec3 refr = texture2D(uScene, ruv).rgb * trans + body * (1.0 - trans);
  refr *= 1.0 + detail.w * uCaustics * 0.42 * uSun * (1.0 - exp(-path * 4.0));
  vec3 col = mix(refr, refl, clamp(fres * uReflect, 0.0, 1.0));
  // Seen at a glance the water mostly mirrors an even sky, so a slope alone barely shows: the rings' faces turned to
  // the eye catch more of the bright low sky, the backs more of the darker high sky.
  vec2 toEye = normalize(-V.xz + 1e-5);
  col *= 1.0 + clamp(dot(rings, toEye), -0.6, 0.6) * 0.55;
  // The sun's glint on the ripples.
  col += sunCol * waterSpecular(N, V, uSunDir, calm ? 0.075 : 0.055 + 0.10 * clamp(ch, 0.0, 1.0)) * 4.0;
  // Foam where the water lands: patches and threads drifting off, not a smooth wash.
  float patchy = detail.z;
  float carried = pool ? texture2D(uFoamMap, (vW.xz + uBasin.x) / (2.0 * uBasin.x)).r : 0.0;
  float foam = (smoothstep(0.62, 0.95, patchy + ch * 0.25) * ch * 0.23
    + smoothstep(0.14, 0.75, carried) * smoothstep(0.28, 0.75, patchy) * 0.44) * uFoam;
  if (calm) {
    float edge = 1.0 - smoothstep(0.0, 0.065, uBasin.x - length(vW.xz));
    foam = (smoothstep(0.12, 0.72, carried) * (0.5 + 0.5 * patchy)
      + edge * patchy * 0.14) * uFoam;
  }
  float lit = 0.55 + 0.45 * max(dot(N, uSunDir), 0.0);
  col = mix(col, vec3(0.92, 0.95, 0.96) * lit * (0.55 + 0.45 * uSun), clamp(foam, 0.0, 1.0) * 0.7);
  gl_FragColor = vec4(col, 1.0);
}`,
    });
  const poolMesh = new THREE.Mesh(new THREE.RingGeometry(F.plinthR - 0.02, F.basinIn + 0.02, 192, 48), surfaceMat(true));
  poolMesh.rotation.x = -Math.PI / 2;
  poolMesh.position.y = F.pool;
  const bowlMesh = new THREE.Mesh(new THREE.RingGeometry(F.finialR - 0.01, F.bowlR + 0.02, 128, 12), surfaceMat(false));
  bowlMesh.rotation.x = -Math.PI / 2;
  bowlMesh.position.y = F.bowlWater;
  const waterScene = new THREE.Scene();
  waterScene.add(poolMesh, bowlMesh);
  // The statue's basin: still water but where the stream comes down (rings and foam from there), the photograph and
  // the sky in it, the stone under it.
  const statueLand = { value: new THREE.Vector2() };
  const statueWater = statue
    ? new THREE.Mesh(
        new THREE.CircleGeometry(statue.basinIn + 0.01, 96),
        new THREE.ShaderMaterial({
          uniforms: { ...surfaceUniforms, uMirror: { value: null as THREE.Texture | null }, uC: statueAt, uLand: statueLand },
          vertexShader: 'varying vec3 vW; varying vec4 vClip; void main() { vW = (modelMatrix * vec4(position, 1.0)).xyz; vClip = projectionMatrix * viewMatrix * vec4(vW, 1.0); gl_Position = vClip; }',
          fragmentShader: /* glsl */ `
uniform sampler2D uScene; uniform sampler2D uSceneDepth; uniform sampler2D uMirror;
uniform vec2 uRes; uniform vec3 uSunDir; uniform float uSun; uniform float uReflect; uniform float uTint; uniform float uFoam;
uniform float uTime; uniform float uCaustics; uniform vec2 uC; uniform vec2 uLand;
${LINEARIZE}
${WATER_LIB}
varying vec3 vW; varying vec4 vClip;
${CAPILLARY_WATER_GLSL}
void main() {
  vec2 s = vClip.xy / vClip.w * 0.5 + 0.5;
  float d = vClip.w;
  vec3 V = normalize(vW - cameraPosition);
  vec2 dl = vW.xz - uLand;
  float rl = length(dl);
  float ch = exp(-rl * rl / 0.05);
  vec2 grad = ripples(vW.xz, uTime);
  vec2 rings = dl / max(rl, 1e-3) * (cos(rl * 24.0 - uTime * 8.5) * 0.22 + cos(rl * 13.0 - uTime * 5.0) * 0.1) * exp(-rl * 1.1) * smoothstep(0.0, 0.05, rl);
  grad += rings;
  vec4 detail = waterDetail(vW.xz, uTime);
  grad += detail.xy * (0.35 + 1.5 * ch);
  vec3 N = normalize(vec3(-grad.x, 1.0, -grad.y));
  if (dot(N, -V) < 0.02) N = normalize(N + (-V) * 0.1);
  float cosi = clamp(dot(-V, N), 0.0, 1.0);
  float fres = waterFresnel(cosi);
  vec3 R = reflect(V, N);
  vec3 refl = photo(R);
  vec4 m = texture2D(uMirror, s + N.xz * vec2(0.025, -0.025));
  refl = mix(refl, m.rgb, m.a);
  float path;
  vec2 ruv = refractedUv(vW, V, N, ${(statue ? statue.water - 0.12 * 2.1 : 0.4).toFixed(4)}, path);
  float rs = linearDepth(texture2D(uSceneDepth, ruv).x);
  if (rs < d) { ruv = s; path = 0.0; }
  vec3 sigma = vec3(0.14, 0.045, 0.025) * uTint + vec3(0.018);
  vec3 trans = exp(-sigma * path);
  vec3 sunCol = vec3(1.0, 0.95, 0.86) * uSun;
  vec3 body = vec3(0.04, 0.062, 0.056) * (0.6 + 0.6 * max(uSunDir.y, 0.0)) * sunCol;
  vec3 refr = texture2D(uScene, ruv).rgb * trans + body * (1.0 - trans);
  refr *= 1.0 + detail.w * uCaustics * 0.42 * uSun * (1.0 - exp(-path * 4.0));
  vec3 col = mix(refr, refl, clamp(fres * uReflect, 0.0, 1.0));
  col *= 1.0 + clamp(dot(rings, normalize(-V.xz + 1e-5)), -0.6, 0.6) * 0.6;
  col += sunCol * waterSpecular(N, V, uSunDir, 0.055 + 0.10 * ch) * 4.0;
  float patchy = detail.z;
  float foam = smoothstep(0.5, 0.95, patchy + ch * 0.45) * ch * 0.85 * uFoam;
  float lit = 0.55 + 0.45 * max(dot(N, uSunDir), 0.0);
  col = mix(col, vec3(0.92, 0.95, 0.96) * lit * (0.55 + 0.45 * uSun), clamp(foam, 0.0, 1.0) * 0.75);
  gl_FragColor = vec4(col, 1.0);
}`,
        }),
      )
    : null;
  if (statue && statueWater) {
    statueWater.rotation.x = -Math.PI / 2;
    statueWater.position.y = statue.water;
    waterScene.add(statueWater);
  }

  // --- 6. the falling water: clear threads ------------------------------------------------------------------------
  const glassUniforms = {
    uBehind: { value: null as THREE.Texture | null },
    uRes: { value: res },
    uProjScale: projScale,
    uImg: { value: backdrop },
    uScale: { value: uvScale },
    uView: { value: viewMat },
    uProj: { value: projMat },
    uSunDir: { value: sunDir },
    uSun: { value: 1 },
    uReflect: { value: 1 },
    uTime: { value: 0 },
  };
  const GLASS_FRAG = /* glsl */ `
uniform sampler2D uBehind; uniform vec2 uRes; uniform vec3 uSunDir; uniform float uSun; uniform float uReflect;
${WATER_LIB}
// A thread of water: what is behind it bent across it (and turned over, as through a rod of glass) and a little
// green, the sky and the courtyard in it by Fresnel, the sun's glint; air in it scatters light: whiter.
vec3 clearWater(vec3 W, vec3 N, vec4 clip, float rp, float aer) {
  vec3 V = normalize(W - cameraPosition);
  if (dot(N, V) > 0.0) N = -N;
  float cosi = clamp(dot(-V, N), 0.0, 1.0);
  float fres = waterFresnel(cosi);
  vec3 R = reflect(V, N);
  vec3 nv = mat3(viewMatrix) * N;
  vec2 s = clip.xy / clip.w * 0.5 + 0.5;
  vec3 behind = texture2D(uBehind, s - nv.xy * (rp * 1.7 + 1.0) / uRes).rgb * vec3(0.985, 0.996, 1.0);
  vec3 sunCol = vec3(1.0, 0.95, 0.86) * uSun;
  float lit = 0.6 + 0.4 * max(dot(N, uSunDir), 0.0);
  vec3 col = mix(behind, vec3(0.8, 0.86, 0.9) * lit * (0.5 + 0.5 * uSun), clamp(aer * (0.3 + 0.7 * (1.0 - cosi)), 0.0, 1.0));
  col = mix(col, photo(R), clamp(fres * uReflect, 0.0, 1.0));
  col += sunCol * waterSpecular(N, V, uSunDir, 0.045 + 0.10 * clamp(aer, 0.0, 1.0)) * 4.0;
  // The sun through the thread, focused on its far side.
  col += sunCol * pow(max(dot(V, uSunDir), 0.0), 30.0) * 0.4 * (1.0 - cosi);
  return col;
}`;
  const threadMat = new THREE.ShaderMaterial({
    uniforms: glassUniforms,
    vertexShader: /* glsl */ `
attribute float aAer; attribute float aR;
uniform float uProjScale;
varying vec3 vW; varying vec3 vN; varying vec4 vClip; varying float vAer; varying float vRp;
void main() {
  vW = position;
  vN = normal;
  vAer = aAer;
  vClip = projectionMatrix * viewMatrix * vec4(position, 1.0);
  vRp = aR * uProjScale / vClip.w;
  gl_Position = vClip;
}`,
    fragmentShader: /* glsl */ `
${GLASS_FRAG}
varying vec3 vW; varying vec3 vN; varying vec4 vClip; varying float vAer; varying float vRp;
void main() { gl_FragColor = vec4(clearWater(vW, normalize(vN), vClip, vRp, vAer), 1.0); }`,
  });
  // The central jet: its column (1), the crown of threads falling back (CROWN), the ring's arcs (RING_N).
  const CROWN = 12;
  const RINGS = 28;
  const SIDES = 10;
  const tubes = makeTubes(1 + CROWN + RING_N, RINGS, SIDES, threadMat);
  const paths = new Float32Array((1 + CROWN + RING_N) * RINGS * 3);
  const times = new Float32Array(1 + CROWN + RING_N);
  const fallScene = new THREE.Scene();
  fallScene.add(tubes.mesh);
  // The statue's stream: one thread from the dolphin's mouth (and two thin ones beside it), drawn in every mode.
  const STATUE_STREAMS = 3;
  const statueTubes = statue ? makeTubes(STATUE_STREAMS, RINGS, SIDES, threadMat) : null;
  const statuePaths = new Float32Array(STATUE_STREAMS * RINGS * 3);
  const statueFall = new THREE.Scene();
  if (statueTubes) statueFall.add(statueTubes.mesh);
  /** The stream's speed from the mouth, so that it lands well out in the basin (set in placeCamera). */
  let statueSpeed = 1.5;
  const statueStop = (y: number) => (statue ? y < statue.water - 0.02 : true);
  const layStatue = (time: number) => {
    if (!statue || !statueTubes) return;
    const o = sim.options;
    const wind: [number, number] = [o.windX * 0.6, o.windZ * 0.6];
    const m = statue.group.position;
    const mx = m.x + statue.mouth.x, my = statue.mouth.y, mz = m.z + statue.mouth.z;
    for (let k = 0; k < STATUE_STREAMS; k += 1) {
      const side = k === 0 ? 0 : k === 1 ? -1 : 1;
      const sp = statueSpeed * (k === 0 ? 1 + 0.025 * Math.sin(time * 2.1) : 0.9 + 0.04 * Math.sin(time * 3.1 + k));
      const d = statue.mouthDir;
      flight([mx, my + side * 0.01, mz + side * 0.03], [d.x * sp, d.y * sp, d.z * sp + side * 0.12], wind, (_x, y) => statueStop(y), RINGS, statuePaths, k * RINGS * 3);
    }
    statueLand.value.set(statuePaths[(RINGS - 1) * 3], statuePaths[(RINGS - 1) * 3 + 2]);
    for (let k = 0; k < STATUE_STREAMS; k += 1) {
      statueTubes.set(k, statuePaths, k * RINGS * 3, (i) => {
        const s = i / (RINGS - 1);
        const breakup = Math.max(0, (s - 0.38) / 0.62);
        const phase = Math.sin(Math.PI * 2 * (s * 6.5 - time * 5.2 + k * 0.4));
        const bead = Math.max(0.04, 1 + (k === 0 ? 0.95 : 1.3) * breakup * phase);
        // Conservation of flow: accelerating water thins, then the necks separate into glistening beads.
        const speed = Math.sqrt(statueSpeed * statueSpeed + 2 * G * Math.max(0, my - statuePaths[k * RINGS * 3 + i * 3 + 1]));
        return (k === 0 ? 0.048 : 0.014) * Math.sqrt(statueSpeed / speed) * bead * (i === 0 ? 0.8 : 1);
      }, (i) => 0.035 + 0.22 * Math.pow(i / (RINGS - 1), 2));
    }
    statueTubes.commit();
  };

  /** The paths for now: jet speed and wind from the simulation's options, a slow sway of the crown. */
  /** The streams' breakup times (s from the nozzle / the lip) in the hybrid mode, set by layPaths. */
  const breaks = { jet: 0, ring: 0, sheet: 0 };
  const layPaths = (time: number, cut = 1) => {
    const o = sim.options;
    const wind: [number, number] = [o.windX, o.windZ];
    const v0 = o.jetSpeed;
    // The column: straight up until it stops.
    // (Hybrid: the column only as far up as it holds together.)
    const riseT = v0 / G;
    breaks.jet = riseT * cut;
    times[0] = flight([0, F.nozzleY - 0.02, 0], [0, v0, 0], wind, (_x, _y, _z, vy) => vy <= 0, RINGS, paths, 0, cut < 1 ? breaks.jet : Infinity);
    const apex: V3 = [paths[(RINGS - 1) * 3], paths[(RINGS - 1) * 3 + 1], paths[(RINGS - 1) * 3 + 2]];
    // The crown: threads leaving the top outwards, each its own speed, swaying; into the bowl (or past it, into the
    // pool).
    let landSum = 0;
    for (let k = 0; k < CROWN; k += 1) {
      if (cut < 1) { tubes.hide(1 + k); continue; }
      const a = ((k + 0.5) / CROWN) * Math.PI * 2 + 0.12 * Math.sin(time * 0.9 + k * 2.1);
      const u = (0.18 + 0.32 * ((k * 0.618) % 1)) * (v0 / 7) * (1 + 0.15 * Math.sin(time * 1.3 + k));
      const off = (1 + k) * RINGS * 3;
      times[1 + k] = flight(apex, [Math.cos(a) * u, 0.15, Math.sin(a) * u], wind, (x, y, z) => {
        const r = Math.hypot(x, z);
        return r < F.bowlR ? y < F.bowlWater - 0.03 : y < F.pool - 0.05;
      }, RINGS, paths, off);
      landSum += Math.hypot(paths[off + (RINGS - 1) * 3], paths[off + (RINGS - 1) * 3 + 2]);
    }
    landing.crown.value = cut < 1 ? F.bowlR * 0.48 : Math.min(F.bowlR - 0.1, landSum / CROWN);
    // The ring's arcs, as sim.ts throws them.
    const range = RING_R - (F.plinthR + 0.6 * SCALE);
    const sp = Math.sqrt((range * G) / Math.sin(2 * RING_ANGLE));
    for (let k = 0; k < RING_N; k += 1) {
      const th = ((k + 0.5) / RING_N) * Math.PI * 2;
      const cx = Math.cos(th), cz = Math.sin(th);
      const off = (1 + CROWN + k) * RINGS * 3;
      const arcT = (2 * sp * Math.sin(RING_ANGLE)) / G;
      breaks.ring = arcT * cut;
      times[1 + CROWN + k] = flight([cx * RING_R, F.pool + 0.09 * SCALE, cz * RING_R], [-cx * Math.cos(RING_ANGLE) * sp, Math.sin(RING_ANGLE) * sp, -cz * Math.cos(RING_ANGLE) * sp], wind, (_x, y, _z, vy) => vy < 0 && y < F.pool - 0.05, RINGS, paths, off, cut < 1 ? breaks.ring : Infinity);
    }
    landing.arcs.value = F.plinthR + 0.6 * SCALE;
    // Tubes along them. The column thickens as it slows (the same water, slower: r ∝ 1/√v); threads neck into beads
    // lower down, travelling with the water; air whitens them as they fall.
    const r0 = 0.034 * SCALE;
    // (Hybrid: the thread necks off over its last stretch, where the drops take over.)
    const neck = (i: number) => (cut < 1 ? Math.min(1, ((RINGS - 1 - i) / (RINGS - 1)) / 0.22) ** 0.7 : 1);
    tubes.set(0, paths, 0, (i) => {
      const s = (i / (RINGS - 1)) * Math.min(1, cut);
      const v = Math.max(0.6, v0 * Math.sqrt(Math.max(0, 1 - s)));
      return Math.min(r0 * 2.6, r0 * Math.sqrt(v0 / v)) * (i === 0 ? 0.6 : 1) * neck(i);
    }, (i) => 0.08 + 0.5 * Math.pow((i / (RINGS - 1)) * Math.min(1, cut), 3));
    const bead = (k: number, i: number, T: number, from: number, size: number) => {
      const s = i / (RINGS - 1);
      const neck = Math.max(0, (s - from) / (1 - from));
      return 1 + size * neck * Math.sin(Math.PI * 2 * (s * T * 9 - time * 7 + k * 0.37));
    };
    for (let k = 0; k < CROWN; k += 1) {
      if (cut < 1) continue;
      const T = times[1 + k];
      tubes.set(1 + k, paths, (1 + k) * RINGS * 3, (i) => {
        if (cut < 1) return 0;
        const s = i / (RINGS - 1);
        return 0.016 * SCALE * (1.25 - 0.45 * s) * bead(k, i, T, 0.35, 0.5) * (i === RINGS - 1 ? 0.4 : 1);
      }, (i) => 0.25 + 0.4 * (i / (RINGS - 1)));
    }
    for (let k = 0; k < RING_N; k += 1) {
      const T = times[1 + CROWN + k];
      tubes.set(1 + CROWN + k, paths, (1 + CROWN + k) * RINGS * 3, (i) => {
        const s = i / (RINGS - 1);
        return 0.015 * SCALE * (cut < 1 ? 1.35 : 1) * (1 - 0.2 * s) * (cut < 1 ? 1 + 0.25 * Math.sin(Math.PI * 2 * (s * 3 - time * 7 + k * 0.37)) * s : bead(k + 20, i, T, 0.5, 0.45)) * (i === 0 ? 0.7 : 1) * neck(i);
      }, (i) => 0.06 + 0.3 * Math.pow((i / (RINGS - 1)) * Math.min(1, cut), 2));
    }
    tubes.commit();
  };

  // The overflow: a clear sheet round the lip down its throw, tearing into threads below.
  const sheetCut = { value: 1.2 };
  const sheetUniforms = { ...glassUniforms, uTime: glassUniforms.uTime, uSheetCut: sheetCut };
  const tMaxSheet = Math.sqrt((2 * (F.lipY - F.pool)) / G);
  landing.sheet.value = F.lipR + 0.36 * tMaxSheet + 0.006;
  const sheet = (() => {
    const rows = 48;
    const cols = 320;
    const pos: number[] = [];
    const uvs: number[] = [];
    const idx: number[] = [];
    for (let j = 0; j <= rows; j += 1) {
      const t = (j / rows) * tMaxSheet;
      const r = F.lipR + 0.36 * t + 0.006;
      const y = F.lipY - 0.006 - 0.5 * G * t * t;
      for (let i = 0; i <= cols; i += 1) {
        const a = (i / cols) * Math.PI * 2;
        pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
        uvs.push(i / cols, j / rows);
      }
    }
    for (let j = 0; j < rows; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        const a = j * (cols + 1) + i;
        idx.push(a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return new THREE.Mesh(g, new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      uniforms: sheetUniforms,
      vertexShader: /* glsl */ `
uniform float uProjScale;
varying vec2 vUv2; varying vec3 vN; varying vec3 vW; varying vec4 vClip; varying float vRp;
void main() { vUv2 = uv; vN = normalize(mat3(modelMatrix) * normal); vW = (modelMatrix * vec4(position, 1.0)).xyz; vClip = projectionMatrix * viewMatrix * vec4(vW, 1.0); vRp = 0.01 * uProjScale / vClip.w; gl_Position = vClip; }`,
      fragmentShader: /* glsl */ `
uniform float uTime;
uniform float uSheetCut;
${GLASS_FRAG}
varying vec2 vUv2; varying vec3 vN; varying vec3 vW; varying vec4 vClip; varying float vRp;
void main() {
  // Threads: noise stretched down the fall, flowing; the sheet holds together at the top and tears lower down.
  vec2 q = vec2(vUv2.x * 420.0, vUv2.y * 3.0 - uTime * 3.2);
  float threads = n2(q) * 0.6 + n2(q * vec2(2.3, 1.7) + 3.1) * 0.4;
  float tear = smoothstep(0.4, 1.0, vUv2.y);
  float a = smoothstep(tear * 0.8, tear * 0.8 + 0.18, threads) * (1.0 - smoothstep(0.88, 1.0, vUv2.y));
  // Hybrid: the sheet only down to where it breaks up (the drops below).
  a *= 1.0 - smoothstep(uSheetCut - 0.12, uSheetCut + 0.04, vUv2.y);
  if (a < 0.02) discard;
  // The film's surface rippled along the threads (so it does not refract as a plain cone).
  vec3 N = normalize(vN + vec3(cos(vUv2.x * 6.2831853), 0.0, sin(vUv2.x * 6.2831853)) * (threads - 0.5) * 0.5);
  vec3 c = clearWater(vW, N, vClip, vRp, 0.18 + 0.4 * vUv2.y);
  gl_FragColor = vec4(c, a * 0.9);
}`,
    }));
  })();
  fallScene.add(sheet);

  // The spray: short streaks (camera shutter).
  const maxAir = sim.N;
  const streakGeo = new THREE.InstancedBufferGeometry();
  streakGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]), 3));
  streakGeo.setIndex([0, 1, 2, 0, 2, 3]);
  const iPos = new THREE.InstancedBufferAttribute(new Float32Array(maxAir * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const iVel = new THREE.InstancedBufferAttribute(new Float32Array(maxAir * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const iSize = new THREE.InstancedBufferAttribute(new Float32Array(maxAir), 1).setUsage(THREE.DynamicDrawUsage);
  streakGeo.setAttribute('iPos', iPos);
  streakGeo.setAttribute('iVel', iVel);
  streakGeo.setAttribute('iSize', iSize);
  const shutter = { value: 1 / 45 };
  const streakMat = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: true,
    depthWrite: false,
    uniforms: { uShutter: shutter, uRes: { value: res }, uProjScale: projScale, uBehind: glassUniforms.uBehind, uSun: glassUniforms.uSun },
    vertexShader: /* glsl */ `
attribute vec3 iPos; attribute vec3 iVel; attribute float iSize;
uniform float uShutter; uniform vec2 uRes; uniform float uProjScale;
varying vec2 vC; varying vec2 vScreen; varying float vAlpha;
void main() {
  vec3 head = iPos, tail = iPos - iVel * uShutter;
  vec4 ch = projectionMatrix * viewMatrix * vec4(head, 1.0);
  vec4 ct = projectionMatrix * viewMatrix * vec4(tail, 1.0);
  vec2 sh = ch.xy / ch.w, st = ct.xy / ct.w;
  vec2 dir = (sh - st) * uRes * 0.5;
  float len = length(dir);
  vec2 dn = len > 1e-3 ? dir / len : vec2(0.0, 1.0);
  vec2 pp = vec2(-dn.y, dn.x);
  float w = max(0.7, iSize * uProjScale / ch.w);
  float along = position.x;
  vec2 s = mix(st, sh, along) + (pp * position.y * w + dn * (along * 2.0 - 1.0) * w) * 2.0 / uRes;
  float z = mix(ct.z / ct.w, ch.z / ch.w, along);
  float cw = mix(ct.w, ch.w, along);
  gl_Position = vec4(s * cw, z * cw, cw);
  vC = vec2(along, position.y);
  vScreen = s * 0.5 + 0.5;
  vAlpha = clamp(2.2 * w / (w + len * 0.5), 0.12, 1.0);
}`,
    fragmentShader: /* glsl */ `
uniform sampler2D uBehind; uniform float uSun;
varying vec2 vC; varying vec2 vScreen; varying float vAlpha;
void main() {
  float across = 1.0 - vC.y * vC.y;
  float ends = smoothstep(0.0, 0.25, vC.x) * smoothstep(1.0, 0.75, vC.x);
  float a = across * (0.4 + 0.6 * ends) * vAlpha;
  if (a < 0.01) discard;
  vec3 behind = texture2D(uBehind, vScreen + vec2(vC.y * 0.004, 0.0)).rgb;
  vec3 c = behind * 0.7 + vec3(0.62, 0.68, 0.72) * 0.45 + vec3(1.0, 0.95, 0.85) * uSun * pow(across, 6.0) * 0.5;
  gl_FragColor = vec4(c, a * 0.8);
}`,
  });
  const streaks = new THREE.Mesh(streakGeo, streakMat);
  streaks.frustumCulled = false;
  fallScene.add(streaks);

  // --- output --------------------------------------------------------------------------------------------------------
  const outMat = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: { uTex: { value: null as THREE.Texture | null }, uExposure: { value: 1 } },
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: /* glsl */ `
uniform sampler2D uTex; uniform float uExposure; varying vec2 vUv;
vec3 toSrgb(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  vec3 c = texture2D(uTex, vUv).rgb * uExposure;
  // Highlights roll off softly instead of clipping hard (only above 0.8: the photograph keeps its own tones).
  c = mix(c, 0.8 + 0.2 * (1.0 - exp(-(c - 0.8) * 5.0)), step(0.8, c));
  gl_FragColor = vec4(toSrgb(c), 1.0);
}`,
  });

  // The falling water from the particles (mode 0).
  const particleWater = createParticleWater({
    renderer, camera, sim, res, projScale, sceneDepth: sceneDepthU, near, far, sunDir, camWorld,
    waterLib: WATER_LIB,
    libUniforms: { uImg: { value: backdrop }, uScale: { value: uvScale }, uView: { value: viewMat }, uProj: { value: projMat } },
  });

  // The camera control (orbitControl.ts): the camera turned round the fountain's axis, and zoomed — the photograph
  // behind zoomed with it (it cannot turn: the fountain, being round, can).
  let viewYaw = 0;
  let viewZoom = 1;
  const placeCamera = () => {
    staticBake.invalidate();
    shadowsDirty = true;
    const A = W / H;
    const tanH = Math.tan((BACKDROP.hfov * Math.PI) / 360);
    let tanV: number;
    if (A >= BACKDROP.aspect) {
      tanV = tanH / A;
      uvScale.set(1, BACKDROP.aspect / A);
    } else {
      tanV = tanH / BACKDROP.aspect;
      uvScale.set(A / BACKDROP.aspect, 1);
    }
    tanV /= viewZoom;
    uvScale.multiplyScalar(1 / viewZoom);
    camera.fov = (2 * Math.atan(tanV) * 180) / Math.PI;
    camera.aspect = A;
    // Pitched down so that the photograph's horizon stays where it is in the picture.
    const tanVimg = tanH / BACKDROP.aspect;
    const pitch = -Math.atan((0.5 - BACKDROP.horizon) * 2 * tanVimg);
    const dist = CAM.dist + (layout.back ?? 0);
    camera.position.set(Math.sin(viewYaw) * dist, CAM.height, Math.cos(viewYaw) * dist);
    camera.rotation.set(pitch, viewYaw, 0, 'YXZ');
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    let slide = 0;
    if (layout.shift) {
      // Slid sideways (along the camera's right) so the fountain's middle comes `shift` of the half-width right.
      const depth = -new THREE.Vector3(0, 1.5, 0).applyMatrix4(camera.matrixWorldInverse).z;
      slide = layout.shift * depth * tanV * A;
      const rx = Math.cos(viewYaw), rz = -Math.sin(viewYaw);
      camera.position.x -= rx * slide;
      camera.position.z -= rz * slide;
      camera.updateMatrixWorld(true);
      if (statue) {
        statue.group.position.set(-2 * rx * slide, 0, -2 * rz * slide);
        statue.group.updateMatrixWorld(true);
        statueAt.value.set(statue.group.position.x, statue.group.position.z);
        statueContact?.position.set(statue.group.position.x, 0.004, statue.group.position.z);
        // The basin's water goes with the statue (it used to stay at the origin, hidden under the fountain).
        statueWater?.position.set(statue.group.position.x, statue.water, statue.group.position.z);
        // The stream's speed: landing about three quarters out in the basin (a few steps of bisection on the flight).
        let lo = 0.3, hi = 4;
        for (let it = 0; it < 14; it += 1) {
          const sp = (lo + hi) / 2;
          const d = statue.mouthDir;
          flight([statue.mouth.x, statue.mouth.y, statue.mouth.z], [d.x * sp, d.y * sp, d.z * sp], [0, 0], (_x, y) => statueStop(y), 2, statuePaths, 0);
          if (Math.hypot(statuePaths[3], statuePaths[5]) < statue.basinIn * 0.78) lo = sp;
          else hi = sp;
        }
        statueSpeed = (lo + hi) / 2;
      }
    }
    // The sun's shadow box over everything that stands (the fountain, and the statue if any).
    const mid = new THREE.Vector3(-Math.cos(viewYaw) * slide, 0, Math.sin(viewYaw) * slide);
    const ext = 7 + (statue ? Math.abs(slide) + 2 : 0);
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext;
    sc.updateProjectionMatrix();
    mirrorShadow.camera.copy(sc);
    sun.target.position.copy(mid);
    sun.target.updateMatrixWorld();
    sun.position.copy(mid).addScaledVector(sunDir, 30);
    projScale.value = H / (2 * tanV);
    camWorld.copy(camera.matrixWorld);
    viewMat.copy(camera.matrixWorldInverse);
    projMat.copy(camera.projectionMatrix);
  };
  const setSize = (w: number, h: number) => {
    W = Math.max(1, Math.round(w * dpr));
    H = Math.max(1, Math.round(h * dpr));
    renderer.setSize(W, H, false);
    placeCamera();
    res.set(W, H);
    for (const rt of [sceneRT, mirrorRT, statueMirrorRT, finalRT, behindRT]) rt.dispose();
    const depthTexture = new THREE.DepthTexture(W, H);
    depthTexture.type = THREE.UnsignedIntType;
    sceneRT = new THREE.WebGLRenderTarget(W, H, { ...rtOpts, depthTexture, samples: 4 });
    mirrorRT = new THREE.WebGLRenderTarget(W >> 1, H >> 1, rtOpts);
    statueMirrorRT = new THREE.WebGLRenderTarget(layout.statue ? W >> 1 : 1, layout.statue ? H >> 1 : 1, rtOpts);
    finalRT = new THREE.WebGLRenderTarget(W, H, { ...rtOpts, samples: 4 });
    behindRT = new THREE.WebGLRenderTarget(W, H, { ...rtOpts, depthBuffer: false });
    particleWater.setSize(W, H);
  };
  setSize(width, height);

  const clearBlack = new THREE.Color(0, 0, 0);
  let uploadedRevision = -1;
  let pathMode = -1, pathCut = -1;

  return {
    canvas,
    camera,
    diagnostics: () => diagnostics,
    setSize,
    /** The camera control's view: turned round the fountain (radians), zoom. */
    setView(yaw: number, zoom: number) {
      if (yaw === viewYaw && zoom === viewZoom) return;
      viewYaw = yaw;
      viewZoom = zoom;
      placeCamera();
    },
    /** Where a screen point (css px) meets the pool's surface, or null. */
    pickPool(x: number, y: number): [number, number] | null {
      const ndc = new THREE.Vector3((x / (W / dpr)) * 2 - 1, -(y / (H / dpr)) * 2 + 1, 0.5).unproject(camera);
      const dir = ndc.sub(camera.position).normalize();
      if (dir.y >= -1e-4) return null;
      const t = (F.pool - camera.position.y) / dir.y;
      const px = camera.position.x + dir.x * t, pz = camera.position.z + dir.z * t;
      const r = Math.hypot(px, pz);
      return r < F.basinIn && r > F.plinthR ? [px, pz] : null;
    },
    render(time: number, look: FountainLook) {
      renderer.info.reset();
      const simulationChanged = uploadedRevision !== sim.revision;
      // From the simulation: the spray, the waves.
      const { px, py, pz, vx, vy, vz, state, foam } = sim;
      if (simulationChanged) {
      let na = 0;
      const pos = iPos.array as Float32Array, vel = iVel.array as Float32Array, size = iSize.array as Float32Array;
      for (let i = 0; i < sim.N; i += 1) {
        if (state[i] !== SPRAY) continue;
        pos[na * 3] = px[i]; pos[na * 3 + 1] = py[i]; pos[na * 3 + 2] = pz[i];
        vel[na * 3] = vx[i]; vel[na * 3 + 1] = vy[i]; vel[na * 3 + 2] = vz[i];
        size[na] = 0.006 * SCALE * (0.7 + 0.5 * foam[i]);
        na += 1;
      }
      iPos.needsUpdate = true;
      iVel.needsUpdate = true;
      iSize.needsUpdate = true;
      streakGeo.instanceCount = na;
      const waves = sim.waves;
      for (let k = 0; k < waves.length; k += 1) waveHalf[k] = THREE.DataUtils.toHalfFloat(waves[k]);
      waveTex.needsUpdate = true;
      poolFoam.update(px, pz, state, foam, F.basinIn, POOL);
      foamTex.needsUpdate = true;
      uploadedRevision = sim.revision;
      }
      surfaceUniforms.uPoolLook.value = look.pool ?? 0;
      const mode = Math.round(look.mode);
      const threads = mode === 1;
      const hybrid = mode === 2;
      const cut = Math.max(0.05, Math.min(1, look.breakup));
      tubes.mesh.visible = threads || hybrid;
      sheet.visible = threads || hybrid;
      streaks.visible = threads;
      sheetCut.value = hybrid ? cut : 1.2;
      breaks.sheet = tMaxSheet * cut;
      // Geometry follows the fixed physics step; optics still animate every display frame.
      // A high-refresh monitor must not re-integrate the same ballistic paths or repack unchanged particle data.
      if (simulationChanged || pathMode !== mode || pathCut !== cut || staticBake.needsBake(look.sun)) {
        if (threads || hybrid) layPaths(time, hybrid ? cut : 1);
        layStatue(time);
        pathMode = mode; pathCut = cut;
      }
      stoneUniforms.uTime.value = time;
      // Caustics belong to the live water pass now, not the baked limestone shader.
      stoneUniforms.uCaustics.value = 0;
      sun.intensity = 3.4 * look.sun;
      shutter.value = look.shutter;

      const refreshStatic = staticBake.needsBake(look.sun);
      if (refreshStatic) {
      // 1. The scene.
      renderer.setRenderTarget(sceneRT);
      renderer.setClearColor(clearBlack, 1);
      renderer.clear();
      pass(backdropMat, sceneRT, false);
      renderer.shadowMap.needsUpdate = shadowsDirty;
      renderer.render(scene, camera);
      shadowsDirty = false;
      }
      sceneDepthU.value = sceneRT.depthTexture;
      // 2. The mirror (only what stands above the water).
      if (refreshStatic) {
      renderer.clippingPlanes = [mirrorClip];
      renderer.setRenderTarget(mirrorRT);
      renderer.setClearColor(clearBlack, 0);
      renderer.clear();
      ground.visible = false;
      contact.visible = false;
      fountain.floor.visible = false;
      if (statue && statueContact) {
        statue.group.visible = false;
        statueContact.visible = false;
      }
      fountain.group.scale.set(SCALE, -SCALE, SCALE);
      fountain.group.position.y = 2 * F.pool;
      fountain.group.updateMatrixWorld(true);
      sun.position.y = -sun.position.y;
      hemi.position.y = -1;
      const mainShadow = sun.shadow;
      sun.shadow = mirrorShadow;
      renderer.shadowMap.needsUpdate = true;
      renderer.render(scene, camera);
      sun.shadow = mainShadow;
      sun.position.y = -sun.position.y;
      hemi.position.y = 1;
      fountain.group.scale.setScalar(SCALE);
      fountain.group.position.y = 0;
      fountain.group.updateMatrixWorld(true);
      ground.visible = true;
      contact.visible = true;
      fountain.floor.visible = true;
      if (statue && statueContact) {
        statue.group.visible = true;
        statueContact.visible = true;
      }
      renderer.clippingPlanes = [];
      // The dolphin has its own pool level: a second, also static, reflection bake. No recurring scene pass.
      if (statue && statueContact && statueWater) {
        const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), statue.water);
        renderer.clippingPlanes = [plane];
        renderer.setRenderTarget(statueMirrorRT);
        renderer.setClearColor(clearBlack, 0);
        renderer.clear();
        fountain.group.visible = ground.visible = contact.visible = statueContact.visible = false;
        statue.group.scale.set(statue.group.scale.x, -statue.group.scale.y, statue.group.scale.z);
        statue.group.position.y = 2 * statue.water;
        statue.group.updateMatrixWorld(true);
        sun.position.y = 2 * statue.water - sun.position.y;
        const shadow = sun.shadow;
        sun.shadow = mirrorShadow;
        renderer.shadowMap.needsUpdate = true;
        renderer.render(scene, camera);
        sun.shadow = shadow;
        sun.position.y = 2 * statue.water - sun.position.y;
        statue.group.scale.y = -statue.group.scale.y;
        statue.group.position.y = 0;
        statue.group.updateMatrixWorld(true);
        fountain.group.visible = ground.visible = contact.visible = statueContact.visible = true;
        renderer.clippingPlanes = [];
        (statueWater.material as THREE.ShaderMaterial).uniforms.uMirror.value = statueMirrorRT.texture;
      }
      staticBake.commit(look.sun);
      }
      // 3. The scene with its depth into the final target, 4. the pool and the bowl.
      baseMat.uniforms.uScene.value = sceneRT.texture;
      renderer.setRenderTarget(finalRT);
      renderer.setClearColor(clearBlack, 1);
      renderer.clear();
      pass(baseMat, finalRT, false);
      for (const m of [poolMesh.material, bowlMesh.material] as THREE.ShaderMaterial[]) {
        const u = m.uniforms;
        u.uScene.value = sceneRT.texture;
        u.uMirror.value = mirrorRT.texture;
        u.uSun.value = look.sun;
        u.uReflect.value = look.reflect;
        u.uTint.value = look.tint;
        u.uFoam.value = look.foam;
        u.uCaustics.value = look.caustics;
        u.uTime.value = time;
      }
      renderer.setRenderTarget(finalRT);
      renderer.render(waterScene, camera);
      // 5. What the falling water refracts, 6. the falling water.
      copyMat.uniforms.uTex.value = finalRT.texture;
      pass(copyMat, behindRT);
      glassUniforms.uBehind.value = behindRT.texture;
      glassUniforms.uSun.value = look.sun;
      glassUniforms.uReflect.value = look.reflect;
      glassUniforms.uTime.value = time;
      renderer.setRenderTarget(finalRT);
      if (threads || hybrid) renderer.render(fallScene, camera);
      if (statueTubes) renderer.render(statueFall, camera);
      if (!threads) particleWater.render(finalRT, behindRT.texture, { drop: look.drop, smooth: look.smooth, air: look.air, shutter: look.shutter, sun: look.sun, reflect: look.reflect }, sim.options.jetSpeed, hybrid ? breaks : undefined);
      // 7. Out.
      outMat.uniforms.uTex.value = finalRT.texture;
      outMat.uniforms.uExposure.value = look.exposure;
      pass(outMat, null);
      diagnostics.staticBakes = staticBake.count;
      diagnostics.frames++;
      diagnostics.calls = renderer.info.render.calls;
      diagnostics.triangles = renderer.info.render.triangles;
      diagnostics.pixels = W * H;
    },
    dispose() {
      for (const rt of [sceneRT, mirrorRT, statueMirrorRT, finalRT, behindRT]) rt.dispose();
      backdrop.dispose();
      waveTex.dispose();
      foamTex.dispose();
      waterDetailTex.dispose();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      });
      for (const m of [backdropMat, baseMat, copyMat, threadMat, streakMat, outMat, poolMesh.material, bowlMesh.material, sheet.material] as THREE.Material[]) m.dispose();
      for (const g of [poolMesh.geometry, bowlMesh.geometry, sheet.geometry, streakGeo]) g.dispose();
      tubes.dispose();
      statueTubes?.dispose();
      if (statueWater) {
        statueWater.geometry.dispose();
        (statueWater.material as THREE.Material).dispose();
      }
      particleWater.dispose();
      sun.shadow.dispose();
      mirrorShadow.dispose();
      quad.geometry.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

export type FountainRenderer = Awaited<ReturnType<typeof createFountainRenderer>>;
