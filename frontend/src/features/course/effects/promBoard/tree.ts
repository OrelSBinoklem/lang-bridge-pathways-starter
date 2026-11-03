import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshBVH, MeshBVHUniformStruct, BVHShaderGLSL } from 'three-mesh-bvh';

/**
 * A small decorative spruce on the desk beside the board, with a garland of 8 sections wired to the automaton's
 * channels: 7 rings of rice bulbs around the tree and the star on top (red or white). "Снизу вверх": Q1 is the lowest
 * ring … Q7 the highest, the star is Q8; "сверху вниз": the star is Q1, then the rings downwards.
 *
 * Its light is ray traced as a scene of its own (so the bakes never multiply): for each of the 8 sections, a map of
 * the light it throws, with shadows — per vertex on the needles (the tree lights itself: lower rings on lower
 * branches, the upper tiers shading those under them) and per texel on the desk around it. The frame's light is their
 * sum weighted by what is lit, so the direction and the star's colour change instantly. The bake runs on the GPU
 * against a BVH of the tree (three-mesh-bvh) a few samples a frame until it has converged.
 */

const H = 200;
const BASE_R = 74;
const DESK_SIZE = 460;
const DESK_RES = 256;
const RING_COLORS = ['#ff3b2a', '#ff8a1c', '#ffd21a', '#3ce05a', '#2ad4ff', '#3a6aff', '#b04aff'];
export const STAR_COLORS = { red: '#ff2a1a', white: '#fff1dc' } as const;
const SAMPLES = 256;

type Section = { bulbs: THREE.Vector3[]; color: THREE.Color; mesh: THREE.InstancedMesh | THREE.Mesh; radius: number };

/** Tree silhouette: radius of the branch tips at a height (0 at the bottom tier's tips). */
const silhouette = (y: number, y0: number) => BASE_R * Math.pow(Math.max(0, 1 - (y - y0) / (H - y0 + 12)), 0.92);

function hash(n: number) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

/** The foliage, trunk, bucket and baubles, one indexed geometry with vertex colours (the albedo). */
function buildTreeGeometry(deskY: number) {
  const parts: THREE.BufferGeometry[] = [];
  const colorize = (g: THREE.BufferGeometry, c: (p: THREE.Vector3, i: number) => THREE.Color) => {
    const pos = g.getAttribute('position');
    const col = new Float32Array(pos.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 1) {
      v.fromBufferAttribute(pos, i);
      const cc = c(v, i);
      col[i * 3] = cc.r;
      col[i * 3 + 1] = cc.g;
      col[i * 3 + 2] = cc.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(name)) g.deleteAttribute(name);
    parts.push(g);
  };
  // A red enamelled bucket with a gold rim, the trunk.
  const bucket = new THREE.CylinderGeometry(36, 29, 42, 40, 1, false);
  bucket.translate(0, deskY + 21, 0);
  colorize(bucket, () => new THREE.Color('#9c1c18'));
  const rim = new THREE.TorusGeometry(36, 2, 8, 48);
  rim.rotateX(Math.PI / 2);
  rim.translate(0, deskY + 42, 0);
  colorize(rim, () => new THREE.Color('#c9a24a'));
  const soil = new THREE.CylinderGeometry(34, 34, 1, 32);
  soil.translate(0, deskY + 38, 0);
  colorize(soil, () => new THREE.Color('#2a1c14'));
  const trunk = new THREE.CylinderGeometry(2.5, 6, H - 20, 12);
  trunk.translate(0, deskY + 30 + (H - 20) / 2, 0);
  colorize(trunk, () => new THREE.Color('#4a3020'));
  // Tiers of branches: a drooping star-shaped skirt each (upper and under side).
  const tiers = 11;
  const y0 = deskY + 62;
  const tipY: number[] = [];
  for (let t = 0; t < tiers; t += 1) {
    const f = t / (tiers - 1);
    const top = y0 + f * (H - 70) + 26 * (1 - f);
    const R = silhouette(top - 22 * (1 - f * 0.5), y0) * (1.02 + 0.06 * hash(t));
    const drop = R * 0.62;
    const lobes = 7 + (t % 3) * 2;
    const NR = 9, NA = 108;
    const twist = hash(t + 3) * Math.PI * 2;
    const skin = (under: boolean) => {
      const pos: number[] = [];
      const idx: number[] = [];
      for (let j = 0; j <= NR; j += 1) {
        const u = j / NR;
        for (let a = 0; a <= NA; a += 1) {
          const ang = (a / NA) * Math.PI * 2 + twist;
          const lobe = 0.72 + 0.28 * Math.pow(Math.abs(Math.cos((lobes * (ang - twist)) / 2)), 0.55);
          const n = (hash(t * 1000 + j * 131 + a * 7) - 0.5) * 0.08;
          const r = u * R * (lobe + n) + 3;
          const droop = u * u * R * 0.16 * lobe;
          let y = top - u * drop - droop + (hash(a * 17 + j * 3 + t) - 0.5) * 2.2 * u;
          if (under) y -= 3 + 5 * (1 - u);
          pos.push(Math.cos(ang) * r, y, Math.sin(ang) * r);
        }
      }
      for (let j = 0; j < NR; j += 1) {
        for (let a = 0; a < NA; a += 1) {
          const i0 = j * (NA + 1) + a, i1 = i0 + 1, i2 = i0 + NA + 1, i3 = i2 + 1;
          if (under) idx.push(i0, i1, i2, i1, i3, i2);
          else idx.push(i0, i2, i1, i1, i2, i3);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      const tipR = R;
      colorize(g, (p, i) => {
        const u = Math.min(1, Math.hypot(p.x, p.z) / tipR);
        const c = new THREE.Color().setRGB(0.012 + 0.03 * u, 0.06 + 0.11 * u, 0.022 + 0.03 * u);
        c.multiplyScalar(0.85 + 0.3 * hash(i * 3 + t));
        // A touch of frost on the upper tips.
        if (!under && u > 0.9 && hash(i + t * 77) > 0.8) c.lerp(new THREE.Color('#dfe8ea'), 0.4);
        return c;
      });
    };
    skin(false);
    skin(true);
    tipY.push(top - drop);
  }
  // Baubles: glass balls hung near the tips.
  const baubleColors = ['#c81d25', '#d4a017', '#1d5fc8', '#c0c4c8'];
  for (let b = 0; b < 16; b += 1) {
    const y = y0 + 10 + hash(b * 9.1) * (H - 110);
    const ang = hash(b * 3.7) * Math.PI * 2;
    const r = silhouette(y, y0) * 0.82;
    const s = new THREE.SphereGeometry(5.5, 14, 10);
    s.translate(Math.cos(ang) * r, y - 4, Math.sin(ang) * r);
    colorize(s, () => new THREE.Color(baubleColors[b % baubleColors.length]));
  }
  const merged = mergeGeometries(parts, false)!;
  return { geometry: merged, y0 };
}

export function createTree(renderer: THREE.WebGLRenderer, deskY: number, position: THREE.Vector3) {
  const group = new THREE.Group();
  group.position.copy(position);
  const { geometry, y0 } = buildTreeGeometry(deskY);
  const V = geometry.getAttribute('position').count;
  const texW = 256;
  const texH = Math.ceil(V / texW);
  const bakeIndex = new Float32Array(V);
  for (let i = 0; i < V; i += 1) bakeIndex[i] = i;
  geometry.setAttribute('bakeIndex', new THREE.BufferAttribute(bakeIndex, 1));

  // --- the garland: 7 rings and the star ------------------------------------------------------------------------
  const sections: Section[] = [];
  const wires: THREE.BufferGeometry[] = [];
  const bulbGeo = new THREE.CapsuleGeometry(1.7, 4.2, 4, 10);
  for (let k = 0; k < 7; k += 1) {
    const y = y0 + 8 + (k / 6.4) * (H - 92);
    const R = silhouette(y, y0) * 0.96 + 4;
    const n = Math.max(6, Math.round((2 * Math.PI * R) / 22));
    const color = new THREE.Color(RING_COLORS[k]);
    const bulbs: THREE.Vector3[] = [];
    const pts: THREE.Vector3[] = [];
    for (let s = 0; s <= 96; s += 1) {
      const a = (s / 96) * Math.PI * 2 + k * 0.7;
      const sag = Math.abs(Math.sin(a * n * 0.5)) * 3.2;
      pts.push(new THREE.Vector3(Math.cos(a) * R, y - sag + Math.sin(a * 2 + k) * 4, Math.sin(a) * R));
    }
    for (let b = 0; b < n; b += 1) {
      const a = (b / n) * Math.PI * 2 + k * 0.7;
      bulbs.push(new THREE.Vector3(Math.cos(a) * (R + 1.5), y - 1.5 + Math.sin(a * 2 + k) * 4, Math.sin(a) * (R + 1.5)));
    }
    wires.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, 0.7, 5, true));
    const mat = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.35), emissive: color, emissiveIntensity: 0, roughness: 0.3 });
    const mesh = new THREE.InstancedMesh(bulbGeo, mat, n);
    const m = new THREE.Matrix4();
    bulbs.forEach((p, i) => {
      const out = new THREE.Vector3(p.x, 0, p.z).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), out.clone().multiplyScalar(0.6).add(new THREE.Vector3(0, -0.8, 0)).normalize());
      m.compose(p, q, new THREE.Vector3(1, 1, 1));
      mesh.setMatrixAt(i, m);
    });
    group.add(mesh);
    sections.push({ bulbs, color, mesh, radius: 2.2 });
  }
  // The star: five points, extruded and bevelled, standing on the top.
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 ? 7 : 17;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  starShape.closePath();
  const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 4, bevelEnabled: true, bevelThickness: 2, bevelSize: 1.6, bevelSegments: 2 });
  starGeo.translate(0, 0, -2);
  const starMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.25, metalness: 0.2 });
  const star = new THREE.Mesh(starGeo, starMat);
  const starPos = new THREE.Vector3(0, deskY + H + 26, 0);
  star.position.copy(starPos);
  group.add(star);
  sections.push({ bulbs: [starPos.clone()], color: new THREE.Color('#ffffff'), mesh: star, radius: 11 });
  const starLight = new THREE.PointLight('#ffffff', 0, 700, 2);
  starLight.position.copy(starPos).add(new THREE.Vector3(0, 0, 14));
  group.add(starLight);
  const wireMesh = new THREE.Mesh(mergeGeometries(wires, false)!, new THREE.MeshStandardMaterial({ color: '#12301a', roughness: 0.5 }));
  group.add(wireMesh);

  // --- the tree's own mesh, lit by the baked garland ------------------------------------------------------------
  const atlas = new THREE.WebGLRenderTarget(texW * 4, texH * 2, { type: THREE.HalfFloatType, depthBuffer: false, magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter });
  const deskAtlas = new THREE.WebGLRenderTarget(DESK_RES * 4, DESK_RES * 2, { type: THREE.HalfFloatType, depthBuffer: false });
  const weights = [...Array(8)].map(() => new THREE.Vector3());
  const treeUniforms = {
    uBake: { value: atlas.texture },
    uBakeSize: { value: new THREE.Vector2(texW, texH) },
    uWeights: { value: weights },
  };
  const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, side: THREE.FrontSide });
  treeMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, treeUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute float bakeIndex;
uniform sampler2D uBake;
uniform vec2 uBakeSize;
uniform vec3 uWeights[8];
varying vec3 vBaked;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{
  int bw = int(uBakeSize.x), bh = int(uBakeSize.y);
  int id = int(bakeIndex + 0.5);
  ivec2 c = ivec2(id % bw, id / bw);
  vec3 sum = vec3(0.0);
  for (int s = 0; s < 8; s++) {
    vec4 e = texelFetch(uBake, c + ivec2((s % 4) * bw, (s / 4) * bh), 0);
    sum += uWeights[s] * (e.r / max(e.a, 1.0));
  }
  vBaked = sum;
}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBaked;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vBaked * RECIPROCAL_PI;');
  };
  const treeMesh = new THREE.Mesh(geometry, treeMat);
  treeMesh.castShadow = true;
  treeMesh.receiveShadow = true;
  group.add(treeMesh);

  // --- the bake: per section, per vertex of the tree and per texel of the desk around it ------------------------
  const bvhGeo = new THREE.BufferGeometry();
  bvhGeo.setAttribute('position', geometry.getAttribute('position').clone());
  bvhGeo.setIndex(geometry.getIndex()!.clone());
  const bvh = new MeshBVH(bvhGeo, { maxLeafTris: 6 });
  const bvhUniform = new MeshBVHUniformStruct();
  bvhUniform.updateFrom(bvh);
  const posData = new Float32Array(texW * texH * 4);
  const nrmData = new Float32Array(texW * texH * 4);
  const P = geometry.getAttribute('position'), N = geometry.getAttribute('normal');
  for (let i = 0; i < V; i += 1) {
    posData.set([P.getX(i), P.getY(i), P.getZ(i), 1], i * 4);
    nrmData.set([N.getX(i), N.getY(i), N.getZ(i), 0], i * 4);
  }
  const dataTex = (d: Float32Array<ArrayBuffer>) => {
    const t = new THREE.DataTexture(d, texW, texH, THREE.RGBAFormat, THREE.FloatType);
    t.needsUpdate = true;
    return t;
  };
  const posTex = dataTex(posData);
  const nrmTex = dataTex(nrmData);
  const MAXB = 24;
  const bulbUniform = (s: number) => {
    const list = sections[s].bulbs.slice(0, MAXB).map((b) => b.clone());
    while (list.length < MAXB) list.push(list[0].clone());
    return list;
  };
  const bakeMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: 'out vec2 vUv;\nvoid main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */ `
precision highp float;
precision highp int;
precision highp isampler2D;
precision highp usampler2D;
${BVHShaderGLSL.common_functions}
${BVHShaderGLSL.bvh_struct_definitions}
${BVHShaderGLSL.bvh_ray_functions}
uniform BVH bvh;
uniform sampler2D uPos;
uniform sampler2D uNrm;
uniform int uVerts;
uniform int uDesk;
uniform float uDeskSize;
uniform float uDeskY;
uniform vec3 uBulbs[${MAXB}];
uniform int uBulbCount;
uniform float uRadius;
uniform float uFrame;
in vec2 vUv;
out vec4 outColor;
uint seed;
float rnd() {
  seed = seed * 747796405u + 2891336453u;
  uint w = ((seed >> ((seed >> 28u) + 4u)) ^ seed) * 277803737u;
  return float((w >> 22u) ^ w) / 4294967295.0;
}
void main() {
  vec3 p, n;
  if (uDesk == 1) {
    p = vec3((vUv.x - 0.5) * uDeskSize, uDeskY + 0.05, (vUv.y - 0.5) * uDeskSize);
    n = vec3(0.0, 1.0, 0.0);
  } else {
    ivec2 c = ivec2(gl_FragCoord.xy) % textureSize(uPos, 0);
    int id = c.y * textureSize(uPos, 0).x + c.x;
    if (id >= uVerts) { outColor = vec4(0.0); return; }
    p = texelFetch(uPos, c, 0).xyz;
    n = normalize(texelFetch(uNrm, c, 0).xyz);
  }
  seed = uint(gl_FragCoord.x) * 1973u + uint(gl_FragCoord.y) * 9277u + uint(uFrame) * 26699u;
  float e = 0.0;
  for (int s = 0; s < 2; s++) {
    int b = min(int(rnd() * float(uBulbCount)), uBulbCount - 1);
    float z = rnd() * 2.0 - 1.0, a = rnd() * 6.2831853;
    float rr = sqrt(max(0.0, 1.0 - z * z));
    vec3 q = uBulbs[b] + vec3(rr * cos(a), z, rr * sin(a)) * uRadius;
    vec3 d = q - p;
    float dist = max(length(d), 3.0);
    d = normalize(d);
    // Branches are thin: light reaching their back side still passes partly through the needles.
    float cosT = dot(d, n);
    float face = cosT > 0.0 ? cosT : (uDesk == 1 ? 0.0 : -cosT * 0.25);
    if (face <= 0.0) continue;
    uvec4 fi; vec3 fn; vec3 bc; float side; float hit;
    vec3 o = p + n * (cosT > 0.0 ? 0.6 : -0.6);
    if (bvhIntersectFirstHit(bvh, o, d, fi, fn, bc, side, hit) && hit < dist - uRadius * 0.8) continue;
    // All the bulbs of a section together: the sampled one times their number.
    e += face / (dist * dist) * float(uBulbCount);
  }
  outColor = vec4(e, e, e, 2.0);
}`,
    uniforms: {
      bvh: { value: bvhUniform },
      uPos: { value: posTex },
      uNrm: { value: nrmTex },
      uVerts: { value: V },
      uDesk: { value: 0 },
      uDeskSize: { value: DESK_SIZE },
      uDeskY: { value: deskY },
      uBulbs: { value: bulbUniform(0) },
      uBulbCount: { value: 1 },
      uRadius: { value: 2 },
      uFrame: { value: 0 },
    },
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bakeMat);
  const qScene = new THREE.Scene();
  qScene.add(quad);
  const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  for (const t of [atlas, deskAtlas]) {
    renderer.setRenderTarget(t);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
  }
  renderer.setRenderTarget(null);
  let samples = 0;
  let frame = 0;

  const bakeStep = () => {
    if (samples >= SAMPLES) return;
    const prevAuto = renderer.autoClear;
    renderer.autoClear = false;
    for (let s = 0; s < 8; s += 1) {
      const sec = sections[s];
      bakeMat.uniforms.uBulbs.value = bulbUniform(s);
      bakeMat.uniforms.uBulbCount.value = Math.min(MAXB, sec.bulbs.length);
      bakeMat.uniforms.uRadius.value = sec.radius;
      bakeMat.uniforms.uFrame.value = frame * 8 + s;
      // Needles.
      bakeMat.uniforms.uDesk.value = 0;
      atlas.viewport.set((s % 4) * texW, Math.floor(s / 4) * texH, texW, texH);
      renderer.setRenderTarget(atlas);
      renderer.render(qScene, qCam);
      // Desk.
      bakeMat.uniforms.uDesk.value = 1;
      deskAtlas.viewport.set((s % 4) * DESK_RES, Math.floor(s / 4) * DESK_RES, DESK_RES, DESK_RES);
      renderer.setRenderTarget(deskAtlas);
      renderer.render(qScene, qCam);
    }
    atlas.viewport.set(0, 0, texW * 4, texH * 2);
    deskAtlas.viewport.set(0, 0, DESK_RES * 4, DESK_RES * 2);
    renderer.setRenderTarget(null);
    renderer.autoClear = prevAuto;
    samples += 2;
    frame += 1;
  };

  /** The desk's material gets the tree's traced light around the tree. */
  const deskUniforms = {
    uTreeDesk: { value: deskAtlas.texture },
    uTreeCenter: { value: new THREE.Vector2(position.x, position.z) },
    uTreeDeskSize: { value: DESK_SIZE },
    uTreeWeights: { value: weights },
    uTreeOn: { value: 1 },
  };
  const hookDesk = (mat: THREE.MeshStandardMaterial) => {
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, deskUniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vDeskWorld;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvDeskWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vDeskWorld;
uniform sampler2D uTreeDesk;
uniform vec2 uTreeCenter;
uniform float uTreeDeskSize;
uniform vec3 uTreeWeights[8];
uniform float uTreeOn;`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
if (uTreeOn > 0.5) {
  vec2 uv = (vDeskWorld.xz - uTreeCenter) / uTreeDeskSize + 0.5;
  if (uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0) {
    vec3 sum = vec3(0.0);
    for (int s = 0; s < 8; s++) {
      vec4 e = texture2D(uTreeDesk, (uv + vec2(float(s % 4), float(s / 4))) * vec2(0.25, 0.5));
      sum += uTreeWeights[s] * (e.r / max(e.a, 1.0));
    }
    float edge = smoothstep(0.0, 0.08, min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y)));
    totalEmissiveRadiance += diffuseColor.rgb * sum * RECIPROCAL_PI * edge;
  }
}`);
    };
    mat.needsUpdate = true;
  };

  const RING_POWER = 5;
  const STAR_POWER = 260;
  return {
    group,
    hookDesk,
    get progress() {
      return samples / SAMPLES;
    },
    /** levels[k]: how lit channel k is (0..1, with the filaments' inertia); up: Q1 at the bottom. */
    update(levels: ArrayLike<number>, up: boolean, starColor: 'red' | 'white', visible: boolean) {
      group.visible = visible;
      deskUniforms.uTreeOn.value = visible ? 1 : 0;
      if (!visible) return;
      bakeStep();
      const sc = new THREE.Color(STAR_COLORS[starColor]);
      sections[7].color.copy(sc);
      starMat.color.copy(sc).multiplyScalar(0.6);
      starMat.emissive.copy(sc);
      starLight.color.copy(sc);
      for (let s = 0; s < 8; s += 1) {
        const ch = up ? s : 7 - s;
        const v = levels[ch] * levels[ch];
        const sec = sections[s];
        const mat = sec.mesh.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = s === 7 ? v * 2.2 : v * 3.2;
        weights[s].set(sec.color.r, sec.color.g, sec.color.b).multiplyScalar(v * (s === 7 ? STAR_POWER : RING_POWER));
        if (s === 7) starLight.intensity = v * 1500;
      }
      // The star slowly turns to catch the light.
      star.rotation.y = Math.sin(performance.now() * 0.0004) * 0.5;
    },
    dispose() {
      atlas.dispose();
      deskAtlas.dispose();
      bakeMat.dispose();
      posTex.dispose();
      nrmTex.dispose();
      bvhUniform.dispose();
      quad.geometry.dispose();
      group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material as THREE.Material | undefined;
        mat?.dispose?.();
      });
    },
  };
}

export type Tree = ReturnType<typeof createTree>;
