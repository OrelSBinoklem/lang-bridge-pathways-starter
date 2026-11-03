import * as THREE from 'three';
import { BASE as B, FOUNTAIN as F, SCALE } from './sim';

/**
 * The fountain in stone: a round basin with a moulded coping, a column on a plinth standing in its water, the upper
 * bowl with its lip, the finial and a bronze nozzle — all lathe profiles about the axis (metres, y up).
 *
 * The stone is a limestone drawn in the shader (world-space noise, no textures to load): grain and pitting, darker
 * grime in the low parts and on the undersides, wet and greenish where the water keeps it wet (below the pool's
 * level, the bowl's underside with the streaks of the sheet running down it), a bump from the same noise. The basin's
 * floor gets the caustics of the waves above it.
 */

/** A profile point at design scale (the meshes are scaled by SCALE). */
const P = (r: number, y: number) => new THREE.Vector2(r, y);

/** The basin: outer wall and coping down to the floor's edge. */
function basinProfile() {
  const o = B.basinOut, i = B.basinIn, t = B.rimTop;
  return [
    P(o + 0.07, 0), P(o + 0.07, 0.07), P(o + 0.03, 0.09), P(o, 0.11),
    P(o, t - 0.1), P(o + 0.035, t - 0.085), P(o + 0.08, t - 0.06), P(o + 0.09, t - 0.03), P(o + 0.075, t - 0.008),
    P(o + 0.04, t), P(i + 0.02, t), P(i - 0.015, t - 0.012), P(i - 0.02, t - 0.035), P(i, t - 0.05),
    P(i, B.floor + 0.02), P(i - 0.02, B.floor),
  ];
}

/** Plinth, column, the bowl's underside, the lip, the bowl's dish and the finial. */
function columnProfile() {
  const pr = B.plinthR, pool = B.pool;
  return [
    P(pr, B.floor), P(pr, pool + 0.1), P(pr - 0.02, pool + 0.13), P(pr - 0.02, pool + 0.16), P(pr - 0.07, pool + 0.19),
    P(pr - 0.1, pool + 0.19), P(0.34, pool + 0.26), P(0.28, pool + 0.36), P(0.25, 0.95), P(0.235, 1.22),
    P(0.29, 1.25), P(0.3, 1.28), P(0.27, 1.3), P(0.34, 1.36), P(0.55, 1.46), P(0.8, 1.53), P(B.lipR, 1.57),
    P(B.lipR + 0.045, 1.59), P(B.lipR + 0.055, B.lipY - 0.03), P(B.lipR + 0.04, B.lipY - 0.005), P(B.lipR, B.lipY),
    P(B.bowlR + 0.02, B.lipY - 0.005), P(B.bowlR, B.lipY - 0.03), P(B.bowlR - 0.06, B.bowlWater - 0.09),
    P(0.7, B.bowlWater - 0.14), P(0.35, B.bowlWater - 0.17), P(B.finialR + 0.06, B.bowlWater - 0.17),
    P(B.finialR + 0.03, B.bowlWater - 0.12), P(B.finialR, B.bowlWater + 0.02), P(0.095, 1.7), P(0.12, 1.72),
    P(0.125, 1.74), P(0.1, 1.76),
  ];
}

/** The bronze nozzle on top of the finial. */
function nozzleProfile() {
  return [P(0.1, 1.76), P(0.06, 1.765), P(0.045, 1.78), P(0.04, B.nozzleY - 0.01), P(0.028, B.nozzleY), P(0.012, B.nozzleY), P(0.001, B.nozzleY - 0.01)];
}

const NOISE = /* glsl */ `
float fh(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float fnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(fh(i), fh(i + vec3(1, 0, 0)), f.x), mix(fh(i + vec3(0, 1, 0)), fh(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(fh(i + vec3(0, 0, 1)), fh(i + vec3(1, 0, 1)), f.x), mix(fh(i + vec3(0, 1, 1)), fh(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float ffbm(vec3 p) { float a = 0.5, s = 0.0; for (int k = 0; k < 5; k++) { s += a * fnoise(p); p *= 2.03; a *= 0.5; } return s; }
`;

export type StoneUniforms = {
  uTime: { value: number };
  uWaves: { value: THREE.Texture | null };
  uSun: { value: THREE.Vector3 };
  uCaustics: { value: number };
};

/** Another piece of stone standing elsewhere in the courtyard (the statue): where its own water keeps it wet. */
export type StoneSite = { center: { value: THREE.Vector2 }; pool: number; basinIn: number };

/**
 * Limestone: MeshStandardMaterial with its albedo, roughness and normal worked out per pixel from world-space noise.
 * `floor`: the basin's floor, which also gets the caustics of the waves. `site`: stone round its own basin (the
 * statue), wet below that basin's water instead of the fountain's.
 */
export function stoneMaterial(uniforms: StoneUniforms, floor = false, site?: StoneSite) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms, site ? { uSite: site.center } : {});
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorld;\nvarying vec3 vWorldN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWorldN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWorld;
varying vec3 vWorldN;
uniform float uTime;
uniform sampler2D uWaves;
uniform vec3 uSun;
uniform float uCaustics;
${site ? 'uniform vec2 uSite;' : ''}
${NOISE}
float stoneH(vec3 p) { return ffbm(p * 7.0) * 0.6 + fnoise(p * 55.0) * 0.25 + (1.0 - abs(fnoise(p * 3.0) * 2.0 - 1.0)) * 0.15; }
// Caustics: two layers of warped cells drifting apart, and where the waves above focus the light.
float caustic(vec2 p, float t) {
  float c = 0.0;
  for (int k = 0; k < 2; k++) {
    vec2 q = p * (6.0 + float(k) * 3.3) + vec2(t * 0.35, -t * 0.27) * (1.0 + float(k));
    q += vec2(fnoise(vec3(q * 0.5, t * 0.4)), fnoise(vec3(q * 0.5 + 7.3, t * 0.4))) * 1.4;
    vec2 f = fract(q) - 0.5;
    c += pow(1.0 - smoothstep(0.0, 0.5, abs(length(f) - 0.32) * 2.2), 3.0);
  }
  return c * 0.5;
}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
{
  vec3 p = vWorld;
  float n = ffbm(p * 1.6);
  float grain = fnoise(p * 60.0);
  vec3 lime = mix(vec3(0.66, 0.61, 0.52), vec3(0.54, 0.5, 0.43), n);
  lime *= 0.94 + grain * 0.1;
  // Lichen: dark grey-green and ochre blotches.
  float li = fnoise(p * 5.5 + 11.0) * 0.6 + fnoise(p * 17.0) * 0.4;
  lime = mix(lime, vec3(0.36, 0.36, 0.31), smoothstep(0.66, 0.8, li) * 0.4);
  lime = mix(lime, vec3(0.62, 0.52, 0.32), smoothstep(0.7, 0.85, fnoise(p * 9.0 + 3.0)) * 0.35);
  // Rain runs down the upright faces.
  float runs = fnoise(vec3(atan(p.z${site ? ' - uSite.y' : ''}, p.x${site ? ' - uSite.x' : ''}) * 40.0, p.y * 0.8, 1.0));
  lime *= 1.0 - smoothstep(0.55, 0.85, runs) * 0.18 * (1.0 - abs(vWorldN.y));
  // Grime in the low parts and on the undersides; moss where it stays damp.
  float under = smoothstep(0.1, -0.6, vWorldN.y);
  float low = smoothstep(0.35, 0.0, p.y);
  lime *= 1.0 - 0.28 * under - 0.2 * low;
  // Wet: below the pool's level, and the bowl's underside where the sheet runs down (streaks).
  ${site ? `float r = length(p.xz - uSite);
  float wet = smoothstep(${(site.pool + 0.03).toFixed(3)}, ${(site.pool - 0.02).toFixed(3)}, p.y) * step(r, ${(site.basinIn + 0.01).toFixed(3)});` : `float r = length(p.xz);
  float wetPool = smoothstep(${(F.pool + 0.03).toFixed(3)}, ${(F.pool - 0.02).toFixed(3)}, p.y) * step(r, ${(F.basinIn + 0.01).toFixed(3)});
  float streak = fnoise(vec3(atan(p.z, p.x) * 60.0, p.y * 1.5, 0.0));
  float wetBowl = smoothstep(${(F.lipR - 0.35).toFixed(3)}, ${(F.lipR + 0.02).toFixed(3)}, r) * step(${(1.25 * SCALE).toFixed(3)}, p.y) * step(p.y, ${(F.lipY + 0.01).toFixed(3)}) * (0.55 + 0.45 * streak);
  float wetIn = step(r, ${F.bowlR.toFixed(3)}) * step(${(F.bowlWater - 0.2).toFixed(3)}, p.y);
  float wet = clamp(max(max(wetPool, wetBowl), wetIn), 0.0, 1.0);`}
  vec3 algae = vec3(0.30, 0.36, 0.22);
  lime = mix(lime, lime * 0.55 + algae * 0.12, wet);
  lime = mix(lime, lime * vec3(0.8, 0.88, 0.72), under * 0.5);
  diffuseColor.rgb *= lime;
  ${floor ? `
  // The basin's floor under the water: darker, and the light the waves focus on it.
  diffuseColor.rgb *= 0.7;
  vec2 wuv = (p.xz + ${F.basinIn.toFixed(3)}) / ${(F.basinIn * 2).toFixed(3)};
  float h = texture2D(uWaves, wuv).r;
  float lap = texture2D(uWaves, wuv + vec2(0.006, 0.0)).r + texture2D(uWaves, wuv - vec2(0.006, 0.0)).r
            + texture2D(uWaves, wuv + vec2(0.0, 0.006)).r + texture2D(uWaves, wuv - vec2(0.0, 0.006)).r - 4.0 * h;
  float c = caustic(p.xz, uTime) * (0.8 + clamp(-lap * 900.0, -0.6, 1.5));
  totalEmissiveRadiance += vec3(1.0, 0.97, 0.88) * c * uCaustics * max(uSun.y, 0.0) * 1.3 * diffuseColor.rgb;` : ''}
  stoneWet = wet;
}`)
      .replace('void main() {', 'float stoneWet = 0.0;\nvoid main() {')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.88, 0.32, stoneWet);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  // Bump from the stone's own relief (screen-space derivatives of the height).
  float hh = stoneH(vWorld);
  vec3 dpx = dFdx(vViewPosition), dpy = dFdy(vViewPosition);
  float dhx = dFdx(hh), dhy = dFdy(hh);
  vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
  float det = dot(dpx, r1);
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  normal = normalize(abs(det) * normal - grad * 0.03);
}`);
  };
  return m;
}

export function bronzeMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0x6f5a33, roughness: 0.38, metalness: 0.85 });
}

export function buildFountain(uniforms: StoneUniforms) {
  const group = new THREE.Group();
  const seg = 128;
  const stone = stoneMaterial(uniforms);
  const basin = new THREE.Mesh(new THREE.LatheGeometry(basinProfile(), seg), stone);
  const column = new THREE.Mesh(new THREE.LatheGeometry(columnProfile(), seg), stone);
  const floorGeo = new THREE.RingGeometry(B.plinthR - 0.01, B.basinIn + 0.01, seg, 24);
  floorGeo.rotateX(-Math.PI / 2);
  floorGeo.translate(0, B.floor, 0);
  const floorMesh = new THREE.Mesh(floorGeo, stoneMaterial(uniforms, true));
  const nozzle = new THREE.Mesh(new THREE.LatheGeometry(nozzleProfile(), 48), bronzeMaterial());
  // The drain: a bronze grate in the floor.
  const grate = new THREE.Mesh(new THREE.CylinderGeometry(B.drainR * 1.25, B.drainR * 1.35, 0.02, 32), bronzeMaterial());
  grate.position.set(B.drainX, B.floor + 0.005, B.drainZ);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(B.drainR * 0.95, 32), new THREE.MeshBasicMaterial({ color: 0x050605 }));
  hole.rotation.x = -Math.PI / 2;
  hole.position.set(B.drainX, B.floor + 0.017, B.drainZ);
  for (const m of [basin, column, floorMesh, nozzle, grate]) {
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  group.add(hole);
  group.scale.setScalar(SCALE);
  return { group, stone, floor: floorMesh };
}

/** The sheet's path from the lip: thrown out at u m/s, falling for t s. */
export function sheetPath(u: number, t: number) {
  return { r: F.lipR + u * t, y: F.lipY - 0.004 - 0.5 * 9.81 * t * t };
}
