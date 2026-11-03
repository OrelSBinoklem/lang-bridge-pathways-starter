import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBVH, MeshBVHUniformStruct, FloatVertexAttributeTexture, BVHShaderGLSL } from 'three-mesh-bvh';
import { BOARD } from './layout';
import type { BoardRenderer } from './renderer';

/**
 * Ray-traced light on the board's surface, on the GPU against a BVH of every part (three-mesh-bvh).
 *
 *   baked — one light map per LED (the lamps HL9–HL16 are the tree's garland, traced by tree.ts), each accumulated from shadow rays to random points on that
 *           source: soft shadows of every part. The frame's light is their sum weighted by what is lit right now, so
 *           switching is instant and the maps keep converging in the background.
 *   live  — one map of the light as it is now, with one more bounce: rays leave the board, hit a part (its colour
 *           read from the geometry) and bring back that part's own direct light (coloured spill from the LEDs off the
 *           resistors, transistors and the board around them). It is averaged over time; when the LEDs change it
 *           blends over a few frames.
 *
 * Either way the board's shader then takes the traced light instead of its point lights (which cast no shadows).
 * Units match three's lights: the map holds irradiance per unit intensity × the light's current intensity / π.
 */

const TW = 512;
const TH = Math.round((TW * BOARD.h) / BOARD.w);

type Light = { pos: THREE.Vector3; radius: number; kind: 0 | 1; color: THREE.Color; level: () => number; scale: number };

const COMMON = /* glsl */ `
precision highp float;
precision highp int;
precision highp isampler2D;
precision highp usampler2D;
${BVHShaderGLSL.common_functions}
${BVHShaderGLSL.bvh_struct_definitions}
${BVHShaderGLSL.bvh_ray_functions}
uniform BVH bvh;
uniform vec2 uBoard;
uniform float uFrame;
in vec2 vUv;
out vec4 outColor;
uint seed;
float rnd() {
  seed = seed * 747796405u + 2891336453u;
  uint w = ((seed >> ((seed >> 28u) + 4u)) ^ seed) * 277803737u;
  return float((w >> 22u) ^ w) / 4294967295.0;
}
vec3 sphereDir() {
  float z = rnd() * 2.0 - 1.0, a = rnd() * 6.2831853;
  float r = sqrt(max(0.0, 1.0 - z * z));
  return vec3(r * cos(a), z, r * sin(a));
}
/** Irradiance (per unit intensity) at p with normal n from a spherical source, one sample, shadowed. */
float lightSample(vec3 p, vec3 n, vec3 lp, float lr, float kind) {
  vec3 q = lp + sphereDir() * lr;
  vec3 d = q - p;
  float dist = length(d);
  d /= dist;
  float cosT = dot(d, n);
  if (cosT <= 0.0) return 0.0;

  float pattern = 1.0;
  uvec4 fi; vec3 fn; vec3 bc; float side; float hit;
  if (bvhIntersectFirstHit(bvh, p + n * 0.03, d, fi, fn, bc, side, hit) && hit < dist - lr * 0.6) return 0.0;
  return pattern * cosT / (dist * dist);
}
vec3 boardPoint(vec2 uv) {
  // The traced map is sampled with the board textures' orientation: v = 0 at the back edge.
  return vec3((uv.x - 0.5) * uBoard.x, 0.02, (uv.y - 0.5) * uBoard.y);
}
`;

const VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export function createTracer(r: BoardRenderer, mode: 'baked' | 'live') {
  const renderer = r.renderer;
  // --- occluders: every static part (not the labels), plus the LED leads' frames; the glass lets light through.
  const geos: THREE.BufferGeometry[] = [];
  const colors: number[] = [];
  const pushGeo = (mesh: THREE.Mesh, color: THREE.Color) => {
    mesh.updateWorldMatrix(true, false);
    const g = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()).applyMatrix4(mesh.matrixWorld);
    const pos = g.getAttribute('position');
    const plain = new THREE.BufferGeometry();
    plain.setAttribute('position', pos);
    const col = new Float32Array(pos.count * 4);
    for (let i = 0; i < pos.count; i += 1) {
      col[i * 4] = color.r;
      col[i * 4 + 1] = color.g;
      col[i * 4 + 2] = color.b;
      col[i * 4 + 3] = 1;
    }
    plain.setAttribute('color', new THREE.BufferAttribute(col, 4));
    geos.push(plain);
    colors.push(0);
  };
  for (const m of r.statics) {
    const key = m.userData.mat as string;
    if (key === 'label' || key === 'labelDark' || key === 'glass') continue;
    const mat = m.material as THREE.MeshStandardMaterial;
    pushGeo(m, mat.color.clone());
  }
  for (const led of r.dyn.leds) {
    led.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && (mesh.userData.part === 'LEADS' || mesh.userData.part === 'REFLECTOR')) pushGeo(mesh, new THREE.Color('#c8ccd0'));
    });
  }
  const merged = mergeGeometries(geos, false)!;
  const bvh = new MeshBVH(merged, { maxLeafTris: 6 });
  const bvhUniform = new MeshBVHUniformStruct();
  bvhUniform.updateFrom(bvh);
  const colorTex = new FloatVertexAttributeTexture();
  colorTex.updateFrom(bvh.geometry.getAttribute('color') as THREE.BufferAttribute);

  const lights: Light[] = [
    ...r.dyn.leds.map((l) => ({
      pos: l.position.clone().setY(8.2), radius: 1.8, kind: 1 as const, color: l.color, level: () => r.ledLevel[l.k], scale: 0,
    })),
  ];
  // Intensities as the renderer's point lights use them.
  const intensity = (i: number) => r.ledLights[i].intensity;

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  const qScene = new THREE.Scene();
  qScene.add(quad);
  const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const target = (w: number, h: number) =>
    new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter });

  const traced = target(TW, TH);
  const board = new THREE.Vector2(BOARD.w, BOARD.h);
  let frame = 0;

  if (mode === 'baked') {
    // 4 × 2 tiles, one per LED, accumulated with additive blending.
    const atlas = target(TW * 4, TH * 2);
    const bake = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: `${COMMON}
uniform vec3 uLightPos;
uniform float uLightRadius;
uniform float uKind;
void main() {
  seed = uint(gl_FragCoord.x) * 1973u + uint(gl_FragCoord.y) * 9277u + uint(uFrame) * 26699u;
  vec3 p = boardPoint(vUv);
  float e = 0.0;
  for (int s = 0; s < 2; s++) e += lightSample(p, vec3(0.0, 1.0, 0.0), uLightPos, uLightRadius, uKind);
  outColor = vec4(e, e, e, 2.0);
}`,
      uniforms: { bvh: { value: bvhUniform }, uBoard: { value: board }, uFrame: { value: 0 }, uLightPos: { value: new THREE.Vector3() }, uLightRadius: { value: 1 }, uKind: { value: 0 } },
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      depthTest: false,
      depthWrite: false,
    });
    const compose = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: `precision highp float;
uniform sampler2D uAtlas;
uniform vec3 uWeight[8];
in vec2 vUv;
out vec4 outColor;
void main() {
  vec3 sum = vec3(0.0);
  float n = max(1.0, texture(uAtlas, vUv * vec2(0.25, 0.5)).a);
  for (int i = 0; i < 8; i++) {
    vec2 tile = vec2(float(i % 4) * 0.25, float(i / 4) * 0.5);
    sum += uWeight[i] * texture(uAtlas, tile + vUv * vec2(0.25, 0.5)).r;
  }
  outColor = vec4(sum / n * 0.3183099, 1.0);
}`,
      uniforms: { uAtlas: { value: atlas.texture }, uWeight: { value: [...Array(8)].map(() => new THREE.Vector3()) } },
      depthTest: false,
      depthWrite: false,
    });
    renderer.setRenderTarget(atlas);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.setRenderTarget(null);
    let samples = 0;
    const MAX = 512;
    r.boardUniforms.uTraced.value = traced.texture;
    r.boardUniforms.uTracedOn.value = 1;
    setBoardTraced(r, true);
    return {
      mode,
      update() {
        const prevAutoClear = renderer.autoClear;
        renderer.autoClear = false;
        if (samples < MAX) {
          quad.material = bake;
          renderer.setRenderTarget(atlas);
          lights.forEach((l, i) => {
            bake.uniforms.uLightPos.value.copy(l.pos);
            bake.uniforms.uLightRadius.value = l.radius;
            bake.uniforms.uKind.value = l.kind;
            bake.uniforms.uFrame.value = frame * 8 + i;
            atlas.viewport.set((i % 4) * TW, Math.floor(i / 4) * TH, TW, TH);
            renderer.setRenderTarget(atlas);
            renderer.render(qScene, qCam);
          });
          atlas.viewport.set(0, 0, TW * 4, TH * 2);
          samples += 2;
          frame += 1;
        }
        quad.material = compose;
        lights.forEach((l, i) => (compose.uniforms.uWeight.value[i] as THREE.Vector3).set(l.color.r, l.color.g, l.color.b).multiplyScalar(intensity(i)));
        renderer.setRenderTarget(traced);
        renderer.render(qScene, qCam);
        renderer.setRenderTarget(null);
        renderer.autoClear = prevAutoClear;
      },
      get progress() {
        return samples / MAX;
      },
      dispose() {
        setBoardTraced(r, false);
        r.boardUniforms.uTracedOn.value = 0;
        r.boardUniforms.uTraced.value = null;
        atlas.dispose();
        traced.dispose();
        bake.dispose();
        compose.dispose();
        colorTex.dispose();
        bvhUniform.dispose();
        quad.geometry.dispose();
      },
    };
  }

  // Live: all lights as they are now (power-weighted choice of one per sample) + one bounce off the parts.
  const acc = [target(TW, TH), target(TW, TH)];
  const live = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: `${COMMON}
uniform sampler2D uColors;
uniform sampler2D uPrev;
uniform float uBlend;
uniform vec3 uLightPos[8];
uniform float uLightRadius[8];
uniform float uLightKind[8];
uniform vec3 uLightPower[8];
uniform float uCdf[8];
uniform float uTotal;
int pickLight(out float pdf) {
  float u = rnd() * uTotal;
  for (int i = 0; i < 8; i++) {
    if (u <= uCdf[i]) {
      float prev = i == 0 ? 0.0 : uCdf[i - 1];
      pdf = (uCdf[i] - prev) / uTotal;
      return i;
    }
  }
  pdf = 1.0;
  return 7;
}
vec3 direct(vec3 p, vec3 n) {
  if (uTotal <= 0.0) return vec3(0.0);
  float pdf;
  int i = pickLight(pdf);
  float e = lightSample(p, n, uLightPos[i], uLightRadius[i], uLightKind[i]);
  return uLightPower[i] * e / max(pdf, 1e-4);
}
void main() {
  seed = uint(gl_FragCoord.x) * 1973u + uint(gl_FragCoord.y) * 9277u + uint(uFrame) * 26699u;
  vec3 p = boardPoint(vUv);
  vec3 n = vec3(0.0, 1.0, 0.0);
  vec3 e = direct(p, n);
  // One bounce: a cosine-weighted ray; what it hits reflects its own direct light (albedo × E).
  float a = rnd() * 6.2831853, rr = sqrt(rnd());
  vec3 d = normalize(vec3(rr * cos(a), sqrt(max(0.0, 1.0 - rr * rr)), rr * sin(a)));
  uvec4 fi; vec3 fn; vec3 bc; float side; float hit;
  if (bvhIntersectFirstHit(bvh, p + n * 0.03, d, fi, fn, bc, side, hit)) {
    vec3 h = p + d * hit;
    vec3 hn = normalize(fn) * side;
    vec3 albedo = textureSampleBarycoord(uColors, bc, fi.xyz).rgb;
    e += albedo * direct(h + hn * 0.03, hn);
  }
  vec3 prev = texture(uPrev, vUv).rgb;
  outColor = vec4(mix(prev, e * 0.3183099, uBlend), 1.0);
}`,
    uniforms: {
      bvh: { value: bvhUniform },
      uColors: { value: colorTex },
      uBoard: { value: board },
      uFrame: { value: 0 },
      uPrev: { value: acc[0].texture },
      uBlend: { value: 1 },
      uLightPos: { value: lights.map((l) => l.pos) },
      uLightRadius: { value: lights.map((l) => l.radius) },
      uLightKind: { value: lights.map((l) => l.kind) },
      uLightPower: { value: lights.map(() => new THREE.Vector3()) },
      uCdf: { value: new Array(8).fill(0) },
      uTotal: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
  });
  let ping = 0;
  let history = 0;
  let lastKey = '';
  r.boardUniforms.uTracedOn.value = 1;
  setBoardTraced(r, true);
  return {
    mode,
    update() {
      // Choose lights by power; a change of what is lit restarts the average softly.
      let total = 0;
      const cdf: number[] = [];
      const key = lights.map((_, i) => (intensity(i) > 1 ? 1 : 0)).join('');
      lights.forEach((l, i) => {
        const I = intensity(i);
        (live.uniforms.uLightPower.value[i] as THREE.Vector3).set(l.color.r, l.color.g, l.color.b).multiplyScalar(I);
        total += I;
        cdf.push(total);
      });
      live.uniforms.uCdf.value = cdf;
      live.uniforms.uTotal.value = total;
      if (key !== lastKey) {
        lastKey = key;
        history = Math.min(history, 3);
      }
      history += 1;
      live.uniforms.uBlend.value = 1 / Math.min(history, 24);
      live.uniforms.uFrame.value = frame++;
      live.uniforms.uPrev.value = acc[ping].texture;
      quad.material = live;
      const out = acc[1 - ping];
      renderer.setRenderTarget(out);
      renderer.render(qScene, qCam);
      renderer.setRenderTarget(null);
      ping = 1 - ping;
      r.boardUniforms.uTraced.value = out.texture;
    },
    get progress() {
      return Math.min(1, history / 24);
    },
    dispose() {
      setBoardTraced(r, false);
      r.boardUniforms.uTracedOn.value = 0;
      r.boardUniforms.uTraced.value = null;
      acc.forEach((t) => t.dispose());
      traced.dispose();
      live.dispose();
      colorTex.dispose();
      bvhUniform.dispose();
      quad.geometry.dispose();
    },
  };
}

/** The board's shader drops its (unshadowed) point lights while the traced light stands in for them. */
function setBoardTraced(r: BoardRenderer, on: boolean) {
  for (const mesh of [r.scene.getObjectByName('board-top'), r.scene.getObjectByName('board-bottom')]) {
    const mat = (mesh as THREE.Mesh | undefined)?.material as THREE.MeshPhysicalMaterial | undefined;
    if (!mat) continue;
    mat.defines = { ...(mat.defines ?? {}) };
    if (on) mat.defines.BOARD_TRACED = '';
    else delete mat.defines.BOARD_TRACED;
    mat.needsUpdate = true;
  }
}
