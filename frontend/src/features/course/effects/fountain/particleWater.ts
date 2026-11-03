import * as THREE from 'three';
import { JET, SHEET, SPRAY, SCALE, type FountainSim } from './sim';
import { waterScreenRect, type WaterRect } from './waterBounds';

/**
 * The falling water drawn from the simulation's own particles (the fountain's «Вода: частицы» mode): every drop in
 * the air — the jet, the ring's arcs, the overflow sheet, the spray — is a short streak along its velocity (the
 * camera's shutter), so the water breaks up where the particles do: the jet holds together near the nozzle, frays
 * and opens at its top, falls back as separate beads; the sheet tears into threads; nothing is a fixed shape.
 *
 * Screen-space, as fluids are often drawn from particles:
 *   1. thickness — each streak adds how much water a ray crosses there (a round drop's chord, its volume spread over
 *      the streak), and how aerated that water is; hidden by the stone in front (the scene's depth);
 *   2. smoothing — a small blur, so neighbouring streaks merge into one body of water where they are dense and stay
 *      apart where they are sparse;
 *   3. composite — over the picture: a normal from the thickness's slope (a column of water is thickest down its
 *      middle), what is behind refracted through it, the sky and the courtyard in it by Fresnel, the sun's glint,
 *      whiter where the water carries air; opaque as it is thick.
 */

export type ParticleWaterLook = {
  /** Drop size, × the base radius. */
  drop: number;
  /** Smoothing, px. */
  smooth: number;
  /** How white the aerated water is. */
  air: number;
  shutter: number;
  sun: number;
  reflect: number;
};

const VERT_FS = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export function createParticleWater(ctx: {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  sim: FountainSim;
  res: THREE.Vector2;
  projScale: { value: number };
  sceneDepth: { value: THREE.Texture | null };
  near: { value: number };
  far: { value: number };
  sunDir: THREE.Vector3;
  /** The photograph looked up in a direction (GLSL, defines photo(dir)) and its uniforms. */
  waterLib: string;
  libUniforms: Record<string, { value: unknown }>;
  camWorld: THREE.Matrix4;
}) {
  const { renderer, camera, sim } = ctx;
  const maxAir = sim.N;
  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  quadScene.add(quad);
  const pass = (mat: THREE.Material, target: THREE.WebGLRenderTarget | null, clear: boolean, rect: WaterRect) => {
    quad.material = mat;
    renderer.setRenderTarget(target);
    renderer.setScissorTest(false);
    // Clear the whole reusable buffer, including last frame's water outside today's bounds.
    if (clear) renderer.clear();
    renderer.setScissor(rect.x, rect.y, rect.width, rect.height);
    renderer.setScissorTest(true);
    try { renderer.render(quadScene, quadCam); } finally { renderer.setScissorTest(false); }
  };

  // --- 1. thickness ----------------------------------------------------------------------------------------------
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]), 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const iPos = new THREE.InstancedBufferAttribute(new Float32Array(maxAir * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const iVel = new THREE.InstancedBufferAttribute(new Float32Array(maxAir * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const iInfo = new THREE.InstancedBufferAttribute(new Float32Array(maxAir * 2), 2).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('iPos', iPos);
  geo.setAttribute('iVel', iVel);
  geo.setAttribute('iInfo', iInfo);
  const shutter = { value: 1 / 45 };
  const dropK = { value: 1 };
  const thickMat = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    uniforms: { uShutter: shutter, uRes: { value: ctx.res }, uProjScale: ctx.projScale, uDrop: dropK, uSceneDepth: ctx.sceneDepth, uNear: ctx.near, uFar: ctx.far },
    vertexShader: /* glsl */ `
attribute vec3 iPos; attribute vec3 iVel; attribute vec2 iInfo;
uniform float uShutter; uniform vec2 uRes; uniform float uProjScale; uniform float uDrop;
varying vec2 vC; varying vec2 vScreen; varying float vChord; varying float vAir; varying float vDist;
void main() {
  vec3 head = iPos, tail = iPos - iVel * uShutter;
  vec4 ch = projectionMatrix * viewMatrix * vec4(head, 1.0);
  vec4 ct = projectionMatrix * viewMatrix * vec4(tail, 1.0);
  vec2 sh = ch.xy / ch.w, st = ct.xy / ct.w;
  vec2 dir = (sh - st) * uRes * 0.5;
  float len = length(dir);
  vec2 dn = len > 1e-3 ? dir / len : vec2(0.0, 1.0);
  vec2 pp = vec2(-dn.y, dn.x);
  float r = iInfo.x * uDrop;
  float rpx = r * uProjScale / ch.w;
  // At least a pixel across (smaller drops still cover a pixel, only less of it).
  float w = max(0.8, rpx);
  float along = position.x;
  vec2 s = mix(st, sh, along) + (pp * position.y * w + dn * (along * 2.0 - 1.0) * w) * 2.0 / uRes;
  float z = mix(ct.z / ct.w, ch.z / ch.w, along);
  float cw = mix(ct.w, ch.w, along);
  gl_Position = vec4(s * cw, z * cw, cw);
  vC = vec2(along, position.y);
  vScreen = s * 0.5 + 0.5;
  // The drop's chord through its middle (m), for a drop smaller than its footprint scaled by how much of the
  // footprint it fills, and spread over the streak's length (the same water, smeared by the shutter).
  vChord = 2.0 * r * min(1.0, rpx / w) * (2.0 * w) / (2.0 * w + len);
  vAir = iInfo.y;
  vDist = cw;
}`,
    fragmentShader: /* glsl */ `
uniform sampler2D uSceneDepth; uniform float uNear; uniform float uFar;
varying vec2 vC; varying vec2 vScreen; varying float vChord; varying float vAir; varying float vDist;
float linearDepth(float d) { float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
void main() {
  // Behind the stone: hidden.
  if (linearDepth(texture2D(uSceneDepth, vScreen).x) < vDist - 0.05) discard;
  float across = sqrt(max(0.0, 1.0 - vC.y * vC.y));
  float ends = smoothstep(0.0, 0.2, vC.x) * smoothstep(1.0, 0.8, vC.x);
  float t = vChord * across * (0.35 + 0.65 * ends);
  if (t <= 0.0) discard;
  gl_FragColor = vec4(t, t * vAir, t * vDist, 1.0);
}`,
  });
  const streaks = new THREE.Mesh(geo, thickMat);
  streaks.frustumCulled = false;
  const streakScene = new THREE.Scene();
  streakScene.add(streaks);

  // --- 2. smoothing (separable Gaussian) ----------------------------------------------------------------------------
  const blurDir = new THREE.Vector2(1, 0);
  const blurRadius = { value: 1.5 };
  const blurMat = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: { uTex: { value: null as THREE.Texture | null }, uDir: { value: blurDir }, uRes: { value: ctx.res }, uR: blurRadius },
    vertexShader: VERT_FS,
    fragmentShader: /* glsl */ `
uniform sampler2D uTex; uniform vec2 uDir; uniform vec2 uRes; uniform float uR; varying vec2 vUv;
void main() {
  if (uR < 0.05) { gl_FragColor = texture2D(uTex, vUv); return; }
  vec4 acc = vec4(0.0);
  float ws = 0.0;
  for (int k = -6; k <= 6; k++) {
    float x = float(k) * max(uR, 0.5) / 3.0;
    float w = exp(-0.5 * float(k * k) / 4.0);
    acc += texture2D(uTex, vUv + uDir * x / uRes) * w;
    ws += w;
  }
  gl_FragColor = acc / ws;
}`,
  });

  // --- 3. composite ---------------------------------------------------------------------------------------------------
  const invProj = new THREE.Matrix4();
  const look = { sun: { value: 1 }, reflect: { value: 1 }, air: { value: 1 } };
  const compMat = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: {
      ...ctx.libUniforms,
      uThick: { value: null as THREE.Texture | null },
      uBehind: { value: null as THREE.Texture | null },
      uRes: { value: ctx.res },
      uInvProj: { value: invProj },
      uCamWorld: { value: ctx.camWorld },
      uSunDir: { value: ctx.sunDir },
      uSun: look.sun,
      uReflect: look.reflect,
      uAir: look.air,
    },
    vertexShader: VERT_FS,
    fragmentShader: /* glsl */ `
uniform sampler2D uThick; uniform sampler2D uBehind; uniform vec2 uRes; uniform mat4 uInvProj; uniform mat4 uCamWorld;
uniform vec3 uSunDir; uniform float uSun; uniform float uReflect; uniform float uAir;
${ctx.waterLib}
varying vec2 vUv;
void main() {
  vec4 t = texture2D(uThick, vUv);
  float T = t.r;
  if (T < 2e-5) discard;
  vec2 e = 1.0 / uRes;
  float tx = texture2D(uThick, vUv + vec2(e.x, 0.0)).r - texture2D(uThick, vUv - vec2(e.x, 0.0)).r;
  float ty = texture2D(uThick, vUv + vec2(0.0, e.y)).r - texture2D(uThick, vUv - vec2(0.0, e.y)).r;
  // The surface tilts where the thickness falls away (towards the edges of a stream, of a drop).
  vec2 slope = vec2(tx, ty) / (T + 0.004) * 1.4;
  vec3 nV = normalize(vec3(-slope, 1.0));
  float dist = t.b / T;
  // The view ray of this pixel, in the world.
  vec4 vp = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 dV = normalize(vp.xyz / vp.w);
  vec3 V = normalize(mat3(uCamWorld) * dV);
  vec3 N = normalize(mat3(uCamWorld) * nV);
  float cosi = clamp(dot(-V, N), 0.0, 1.0);
  float fres = waterFresnel(cosi);
  float a = 1.0 - exp(-T * 70.0);
  // Through the water: bent by its surface, the more the thicker it is.
  vec2 off = nV.xy * min(T * 900.0, 7.0) * e;
  vec3 behind = texture2D(uBehind, vUv - off).rgb * vec3(0.985, 0.996, 1.0);
  vec3 sunCol = vec3(1.0, 0.95, 0.86) * uSun;
  float lit = 0.55 + 0.45 * max(dot(N, uSunDir), 0.0);
  // Air in it scatters the light: whiter, and whiter where thick.
  // Air scatters along the optical path: thin edges stay clear instead of milky.
  float airy = clamp((t.g / T) * uAir * a * 0.72, 0.0, 0.8);
  vec3 col = mix(behind, vec3(0.82, 0.88, 0.92) * lit * (0.5 + 0.5 * uSun), airy);
  vec3 R = reflect(V, N);
  col = mix(col, photo(R), clamp(fres * uReflect, 0.0, 1.0));
  col += sunCol * waterSpecular(N, V, uSunDir, 0.075 + 0.15 * airy) * 4.0;
  // The sun through the water, glowing on its far side.
  col += sunCol * pow(max(dot(V, uSunDir), 0.0), 20.0) * 0.3 * a;
  gl_FragColor = vec4(col * a, a);
}`,
  });

  const rtOpts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  let thickRT = new THREE.WebGLRenderTarget(1, 1, rtOpts);
  let blurRT = new THREE.WebGLRenderTarget(1, 1, rtOpts);
  const clear0 = new THREE.Color(0, 0, 0);
  const bounds = new Float64Array(6), projectionView = new THREE.Matrix4();
  let packedRevision = -1, packedShutter = NaN, packedDrop = NaN, packedJet = NaN;
  let packedBreaks = '';
  let n = 0, maxRadius = 0;

  return {
    setSize(w: number, h: number) {
      thickRT.dispose();
      blurRT.dispose();
      thickRT = new THREE.WebGLRenderTarget(w, h, rtOpts);
      blurRT = new THREE.WebGLRenderTarget(w, h, rtOpts);
    },
    /** Draws the falling water over `target`, refracting `behind`. `breaks` (the hybrid mode): how long after leaving
     * its nozzle (the lip) a stream holds together — the glass threads draw it until then, the drops only after. */
    render(target: THREE.WebGLRenderTarget, behind: THREE.Texture, lk: ParticleWaterLook, jetSpeed: number, breaks?: { jet: number; ring: number; sheet: number }) {
      const { px, py, pz, vx, vy, vz, state, foam, ring, age } = sim;
      const pos = iPos.array as Float32Array, vel = iVel.array as Float32Array, info = iInfo.array as Float32Array;
      const breakKey = breaks ? `${breaks.jet}/${breaks.ring}/${breaks.sheet}` : '';
      if (packedRevision !== sim.revision || packedShutter !== lk.shutter || packedDrop !== lk.drop || packedJet !== jetSpeed || packedBreaks !== breakKey) {
      n = 0;
      maxRadius = 0;
      bounds[0] = bounds[1] = bounds[2] = Infinity; bounds[3] = bounds[4] = bounds[5] = -Infinity;
      const base = 0.011 * SCALE;
      for (let i = 0; i < sim.N; i += 1) {
        const st = state[i];
        if (st !== JET && st !== SHEET && st !== SPRAY) continue;
        pos[n * 3] = px[i]; pos[n * 3 + 1] = py[i]; pos[n * 3 + 2] = pz[i];
        vel[n * 3] = vx[i]; vel[n * 3 + 1] = vy[i]; vel[n * 3 + 2] = vz[i];
        const sp = Math.hypot(vx[i], vy[i], vz[i]);
        // Hybrid: not yet broken up — the glass thread is there instead (and fades into the drops).
        let shown = 1;
        if (breaks && st !== SPRAY) {
          const b = st === SHEET ? breaks.sheet : ring[i] ? breaks.ring : breaks.jet;
          shown = Math.min(1, Math.max(0, (age[i] - b + 0.05) / 0.12));
          if (shown <= 0) continue;
        }
        // Aerated a little: the spray, the jet where it has slowed and broken at its top, the sheet as it falls. The
        // slow drops at the jet's top are small and sparkling (a cloud of fine drops), not big murky balls.
        const slow = Math.max(0, 1 - sp / Math.max(1, jetSpeed * 0.6));
        const air = st === SPRAY ? 0.9 : st === SHEET ? 0.3 + 0.3 * Math.min(1, -vy[i] / 4) : 0.35 + 0.25 * slow;
        info[n * 2] = base * (st === SPRAY ? 0.45 : st === SHEET ? 0.8 : 1 - 0.5 * slow) * (0.75 + 0.35 * foam[i]) * shown;
        info[n * 2 + 1] = air;
        maxRadius = Math.max(maxRadius, info[n * 2] * lk.drop);
        // Both ends of the shutter streak, not just its particle centre.
        const tx = px[i] - vx[i] * lk.shutter, ty = py[i] - vy[i] * lk.shutter, tz = pz[i] - vz[i] * lk.shutter;
        bounds[0] = Math.min(bounds[0], px[i], tx); bounds[3] = Math.max(bounds[3], px[i], tx);
        bounds[1] = Math.min(bounds[1], py[i], ty); bounds[4] = Math.max(bounds[4], py[i], ty);
        bounds[2] = Math.min(bounds[2], pz[i], tz); bounds[5] = Math.max(bounds[5], pz[i], tz);
        n += 1;
      }
      iPos.needsUpdate = true;
      iVel.needsUpdate = true;
      iInfo.needsUpdate = true;
      geo.instanceCount = n;
      packedRevision = sim.revision; packedShutter = lk.shutter; packedDrop = lk.drop; packedJet = jetSpeed; packedBreaks = breakKey;
      }
      if (!n) return; // No visible airborne water: no thickness, blur or composite passes needed.
      shutter.value = lk.shutter;
      dropK.value = lk.drop;
      blurRadius.value = lk.smooth;
      look.sun.value = lk.sun;
      look.reflect.value = lk.reflect;
      look.air.value = lk.air;
      invProj.copy(camera.projectionMatrixInverse);
      projectionView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      const rect = waterScreenRect(bounds, projectionView.elements, ctx.res.x, ctx.res.y, maxRadius, ctx.projScale.value, lk.smooth, camera.near);
      if (!rect.width || !rect.height) return;
      // 1. Thickness.
      renderer.setRenderTarget(thickRT);
      renderer.setClearColor(clear0, 0);
      renderer.clear();
      renderer.render(streakScene, camera);
      // 2. Smoothing.
      blurMat.uniforms.uTex.value = thickRT.texture;
      blurDir.set(1, 0);
      pass(blurMat, blurRT, true, rect);
      blurMat.uniforms.uTex.value = blurRT.texture;
      blurDir.set(0, 1);
      pass(blurMat, thickRT, true, rect);
      // 3. Over the picture.
      compMat.uniforms.uThick.value = thickRT.texture;
      compMat.uniforms.uBehind.value = behind;
      pass(compMat, target, false, rect);
    },
    dispose() {
      thickRT.dispose();
      blurRT.dispose();
      geo.dispose();
      for (const m of [thickMat, blurMat, compMat]) m.dispose();
      quad.geometry.dispose();
    },
  };
}
