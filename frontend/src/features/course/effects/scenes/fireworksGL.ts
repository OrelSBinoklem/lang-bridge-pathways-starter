import { FULL_VS, TONEMAP_GLSL, createKit, type Target } from './glKit';
import { LIGHT_FLOATS, MAX_LIGHTS, MAX_PUFFS, MAX_STARS, PUFF_FLOATS, STAR_FLOATS } from './fireworksSim';

/**
 * WebGL2 renderer of the fireworks show (fireworksSim.ts), all in linear light:
 * - stars as motion-blurred streaks from last frame's position to this one's, into a buffer that fades out quickly
 *   (the eye's persistence: fast stars draw short lines);
 * - smoke puffs into a small density buffer, broken up by noise, lit by the bursts' light (inverse-square falloff
 *   from each burst) and the city's glow;
 * - the night sky with faint stars, then a bloom pyramid;
 * - Riga's skyline (spires, gables, lit windows) whose roofs catch the bursts' light, and the river below reflecting
 *   everything above it through moving ripples (brighter towards the horizon, as water is at grazing angles).
 */

const PROJECT = `
uniform vec2 uRes;
uniform float uHorizon;
uniform float uCx;
uniform float uFocal;
uniform float uCamH;
vec2 project(vec3 p) { return vec2(uCx + uFocal * p.x / p.z, uHorizon + uFocal * (p.y - uCamH) / p.z); }
`;

const STAR_VS = `#version 300 es
precision highp float;
${PROJECT}
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aPrev;
layout(location = 2) in vec3 aColor;
layout(location = 3) in float aSize;
layout(location = 4) in float aPower;
out vec2 vA;
out vec2 vB;
out float vR;
out vec3 vCol;
out vec2 vPx;
void main() {
  vec2 a = project(aPrev);
  vec2 b = project(aPos);
  float r = max(aSize * uFocal / aPos.z, 0.75);
  float halo = r * 3.0 + 1.0;
  vec2 d = b - a;
  float len = length(d);
  vec2 dir = len > 1e-3 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float along = float(gl_VertexID >> 1);
  float side = float(gl_VertexID & 1) * 2.0 - 1.0;
  vec2 p = mix(a, b, along) + dir * (along * 2.0 - 1.0) * halo + nrm * side * halo;
  vA = a;
  vB = b;
  vR = r;
  // A moving star spreads the same light along its path.
  vCol = aColor * aPower / (1.0 + len / (r * 2.0));
  vPx = p;
  gl_Position = vec4(p / uRes * 2.0 - 1.0, 0.0, 1.0);
}`;

const STAR_FS = `#version 300 es
precision highp float;
in vec2 vA;
in vec2 vB;
in float vR;
in vec3 vCol;
in vec2 vPx;
out vec4 o;
void main() {
  vec2 ab = vB - vA;
  float h = clamp(dot(vPx - vA, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  float d = length(vPx - vA - ab * h);
  float q = d / vR;
  float core = exp(-q * q * 1.3);
  float glow = 0.12 * exp(-q * q * 0.12);
  // The hot core of a star burns whiter than its colour.
  vec3 col = vCol * (core + glow) + vec3(length(vCol) * 0.25) * core * core;
  o = vec4(col, 0.0);
}`;

const FADE_FS = `#version 300 es
precision highp float;
uniform float uKeep;
out vec4 o;
void main() { o = vec4(0.0, 0.0, 0.0, uKeep); }`;

const PUFF_VS = `#version 300 es
precision highp float;
${PROJECT}
layout(location = 0) in vec3 aPos;
layout(location = 1) in float aRadius;
layout(location = 2) in float aDensity;
uniform float uScale;
out vec2 vC;
out float vR;
out float vD;
out vec2 vPx;
out float vSeed;
void main() {
  vec2 c = project(aPos) * uScale;
  float r = aRadius * uFocal / aPos.z * uScale;
  vec2 q = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
  vec2 p = c + q * r * 1.6;
  vC = c;
  vR = r;
  vD = aDensity;
  vPx = p;
  vSeed = float(gl_InstanceID) * 7.31;
  gl_Position = vec4(p / (uRes * uScale) * 2.0 - 1.0, 0.0, 1.0);
}`;

const NOISE = `
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) { float s = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
`;

const PUFF_FS = `#version 300 es
precision highp float;
uniform float uTime;
in vec2 vC;
in float vR;
in float vD;
in vec2 vPx;
in float vSeed;
out vec4 o;
${NOISE}
void main() {
  vec2 q = (vPx - vC) / vR;
  float d2 = dot(q, q);
  float billow = fbm(q * 1.7 + vSeed + uTime * 0.05);
  float dens = vD * exp(-d2 * 1.6) * (0.35 + 1.1 * billow);
  o = vec4(dens, 0.0, 0.0, 0.0);
}`;

const LIGHTS = `
uniform vec4 uLightPos[${MAX_LIGHTS}];
uniform vec3 uLightCol[${MAX_LIGHTS}];
uniform int uLightCount;
/** Light arriving at a screen point from the bursts: each fades with the square of the distance, soft within its radius. */
vec3 burstLight(vec2 px) {
  vec3 s = vec3(0.0);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= uLightCount) break;
    vec2 d = (px - uLightPos[i].xy) / uLightPos[i].z;
    s += uLightCol[i] / (1.0 + dot(d, d));
  }
  return s;
}
`;

const ABOVE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform vec2 uRes;
uniform float uHorizon;
uniform float uTime;
uniform float uStore;
uniform sampler2D uLight;
uniform sampler2D uSmoke;
uniform vec3 uZenith;
uniform vec3 uLow;
uniform float uDim;
out vec4 o;
${NOISE}
${LIGHTS}
void main() {
  vec2 px = gl_FragCoord.xy;
  float up = clamp((px.y - uHorizon) / max(uRes.y - uHorizon, 1.0), 0.0, 1.0);
  // While a word is written in the sky the city puts its lights out: its glow on the haze goes with them.
  vec3 sky = mix(uLow, uZenith, pow(up, 0.55)) * (1.0 - 0.5 * uDim);
  // Faint stars, twinkling.
  vec2 cell = floor(px / 3.0);
  float star = step(0.9965, hash12(cell)) * (0.5 + 0.5 * sin(uTime * 2.0 + hash12(cell + 3.1) * 40.0));
  sky += vec3(0.25, 0.27, 0.32) * star * up;
  float smoke = texture(uSmoke, vUv).r;
  vec3 lit = burstLight(px);
  // Smoke scatters the bursts' light and the city's warm glow, and veils what is behind it.
  vec3 glow = uLow * 2.5 * (1.0 - up) * (1.0 - 0.85 * uDim);
  vec3 col = sky * (1.0 - clamp(smoke, 0.0, 1.0) * 0.5) + smoke * (lit * 0.4 + glow * 0.6);
  col += texture(uLight, vUv).rgb / uStore;
  o = vec4(col * uStore, 1.0);
}`;

const FINAL_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform vec2 uRes;
uniform float uHorizon;
uniform float uTime;
uniform float uStore;
uniform float uExposure;
uniform float uBloomGain;
uniform float uScale;
uniform sampler2D uAbove;
uniform sampler2D uBloom;
uniform sampler2D uCity;
uniform vec3 uWater;
uniform float uDim;
out vec4 o;
${NOISE}
${LIGHTS}
${TONEMAP_GLSL}
vec3 sky(vec2 px) {
  vec2 uv = px / uRes;
  return (texture(uAbove, uv).rgb + texture(uBloom, uv).rgb * uBloomGain) / uStore;
}
float cityHeight(float x) { return texture(uCity, vec2(x / uRes.x, 0.5)).r; }
/** The skyline: near black, lit windows, roofs and spires catching the bursts' light. */
vec3 city(vec2 px, float above, float top) {
  vec3 lit = burstLight(px);
  vec3 col = vec3(0.004, 0.005, 0.009) + lit * 0.035;
  float edge = exp(-max(top - above, 0.0) / (2.0 * uScale));
  col += lit * 0.25 * edge;
  vec2 cell = floor(vec2(px.x / (3.0 * uScale), above / (4.0 * uScale)));
  vec2 inCell = fract(vec2(px.x / (3.0 * uScale), above / (4.0 * uScale)));
  float window = step(0.72, hash12(cell)) * step(0.3, inCell.x) * step(0.35, inCell.y) * step(above, top - 5.0 * uScale) * step(2.0 * uScale, above);
  // Windows go dark one by one as uDim rises, and light up again as it falls.
  window *= step(uDim, hash12(cell + 17.0) * 0.96 + 0.02);
  col += vec3(1.0, 0.62, 0.25) * 0.35 * window * (0.7 + 0.3 * hash12(cell + 9.0));
  return col;
}
void main() {
  vec2 px = gl_FragCoord.xy;
  vec3 col;
  if (px.y >= uHorizon) {
    float above = px.y - uHorizon;
    float top = cityHeight(px.x);
    col = sky(px);
    if (above < top + 1.0) col = mix(col, city(px, above, top), 1.0 - smoothstep(top - 0.7, top + 0.7, above));
  } else {
    // The river: what is above it, mirrored at the horizon, through ripples that grow towards the viewer.
    float depth = (uHorizon - px.y) / max(uHorizon, 1.0);
    float waves = vnoise(vec2(px.x * 0.012 / uScale, (uHorizon - px.y) * 0.45 / uScale / (0.25 + depth) - uTime * 1.3));
    float waves2 = vnoise(vec2(px.x * 0.05 / uScale + 3.0, (uHorizon - px.y) * 1.1 / uScale / (0.25 + depth) + uTime * 0.9));
    vec2 m = vec2(px.x + (waves2 - 0.5) * 3.0 * uScale * depth, 2.0 * uHorizon - px.y + (waves - 0.5) * (2.0 + 26.0 * depth) * uScale);
    m.y = max(m.y, uHorizon + 0.5);
    float above = m.y - uHorizon;
    float top = cityHeight(m.x);
    vec3 refl = sky(m);
    if (above < top + 1.5) refl = mix(refl, city(m, above, top) * 0.8, 1.0 - smoothstep(top - 1.0, top + 1.0, above));
    float fres = 0.18 + 0.62 * pow(1.0 - depth, 3.0);
    col = uWater * (1.0 - 0.6 * uDim) + refl * fres + burstLight(vec2(px.x, 2.0 * uHorizon - px.y)) * 0.01;
  }
  o = vec4(toSrgb(aces(col * uExposure)), 1.0);
}`;

export type FireworksFrame = {
  stars: Float32Array;
  starCount: number;
  lights: Float32Array;
  lightCount: number;
  puffs: Float32Array;
  puffCount: number;
  dt: number;
  time: number;
  exposure: number;
  /** 0…1: how far the city has put its lights out (while a word hangs in the sky). */
  dim?: number;
};

export type FireworksRenderer = {
  canvas: HTMLCanvasElement;
  render(frame: FireworksFrame): void;
  dispose(): void;
};

/**
 * Sizes in device px: `horizon` is the river's far edge (from the bottom), `cx` the view's centre, `focal` px per
 * metre at 1 m. `city` holds the skyline's height above the horizon for every column, device px.
 */
export function createFireworksRenderer(opts: {
  width: number;
  height: number;
  horizon: number;
  cx: number;
  focal: number;
  camH: number;
  scale: number;
  city: Float32Array;
  zenith: [number, number, number];
  low: [number, number, number];
  water: [number, number, number];
  /** Strength of the glow around bright parts (1: as in the card). */
  bloom?: number;
}): FireworksRenderer | null {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.round(opts.width));
  canvas.height = Math.max(2, Math.round(opts.height));
  const kit = createKit(canvas, 'fireworks');
  if (!kit) return null;
  const { gl } = kit;
  const W = canvas.width;
  const H = canvas.height;
  const store = kit.hdr ? 1 : 0.125;
  const smokeScale = 1 / 3;

  const starProg = kit.program(STAR_VS, STAR_FS);
  const fadeProg = kit.program(FULL_VS, FADE_FS);
  const puffProg = kit.program(PUFF_VS, PUFF_FS);
  const aboveProg = kit.program(FULL_VS, ABOVE_FS);
  const finalProg = kit.program(FULL_VS, FINAL_FS);
  const light = kit.target(W, H);
  const smoke = kit.target(Math.max(1, Math.round(W * smokeScale)), Math.max(1, Math.round(H * smokeScale)));
  const above = kit.target(W, H);
  const bloom = kit.bloom(W, H, 5);
  if (!starProg || !fadeProg || !puffProg || !aboveProg || !finalProg || !light || !smoke || !above || !bloom) {
    kit.dispose();
    return null;
  }

  // Skyline heights, one texel per column.
  const cityTex = kit.track.texture(gl.createTexture()!);
  gl.bindTexture(gl.TEXTURE_2D, cityTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, W, 1, 0, gl.RED, gl.FLOAT, opts.city);

  const starBuf = kit.track.buffer(gl.createBuffer()!);
  gl.bindBuffer(gl.ARRAY_BUFFER, starBuf);
  gl.bufferData(gl.ARRAY_BUFFER, MAX_STARS * STAR_FLOATS * 4, gl.DYNAMIC_DRAW);
  const starVao = kit.track.vao(gl.createVertexArray()!);
  gl.bindVertexArray(starVao);
  const stride = STAR_FLOATS * 4;
  const attr = (loc: number, size: number, offset: number) => {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset * 4);
    gl.vertexAttribDivisor(loc, 1);
  };
  attr(0, 3, 0);
  attr(1, 3, 3);
  attr(2, 3, 6);
  attr(3, 1, 9);
  attr(4, 1, 10);

  const puffBuf = kit.track.buffer(gl.createBuffer()!);
  gl.bindBuffer(gl.ARRAY_BUFFER, puffBuf);
  gl.bufferData(gl.ARRAY_BUFFER, MAX_PUFFS * PUFF_FLOATS * 4, gl.DYNAMIC_DRAW);
  const puffVao = kit.track.vao(gl.createVertexArray()!);
  gl.bindVertexArray(puffVao);
  const pstride = PUFF_FLOATS * 4;
  for (const [loc, size, offset] of [[0, 3, 0], [1, 1, 3], [2, 1, 4]] as const) {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, pstride, offset * 4);
    gl.vertexAttribDivisor(loc, 1);
  }
  gl.bindVertexArray(null);

  const lightPos = new Float32Array(MAX_LIGHTS * 4);
  const lightCol = new Float32Array(MAX_LIGHTS * 3);
  const projection = (prog: NonNullable<typeof starProg>) => {
    gl.uniform2f(prog.u('uRes'), W, H);
    gl.uniform1f(prog.u('uHorizon'), opts.horizon);
    gl.uniform1f(prog.u('uCx'), opts.cx);
    gl.uniform1f(prog.u('uFocal'), opts.focal);
    gl.uniform1f(prog.u('uCamH'), opts.camH);
  };
  const lightUniforms = (prog: NonNullable<typeof starProg>, count: number) => {
    gl.uniform4fv(prog.u('uLightPos'), lightPos);
    gl.uniform3fv(prog.u('uLightCol'), lightCol);
    gl.uniform1i(prog.u('uLightCount'), count);
  };

  return {
    canvas,
    render(fr) {
      if (kit.lost()) return;
      // Bursts as screen lights: position, and a reach of ~70 m at their depth.
      for (let i = 0; i < fr.lightCount; i += 1) {
        const o = i * LIGHT_FLOATS;
        const z = Math.max(1, fr.lights[o + 2]);
        lightPos[i * 4] = opts.cx + (opts.focal * fr.lights[o]) / z;
        lightPos[i * 4 + 1] = opts.horizon + (opts.focal * (fr.lights[o + 1] - opts.camH)) / z;
        lightPos[i * 4 + 2] = (70 * opts.focal) / z;
        lightCol.set([fr.lights[o + 3], fr.lights[o + 4], fr.lights[o + 5]], i * 3);
      }
      // The stars: last frame's fades (the eye's persistence, ~0.09 s), this frame's added on top.
      kit.into(light);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ZERO, gl.SRC_ALPHA);
      gl.useProgram(fadeProg.p);
      gl.uniform1f(fadeProg.u('uKeep'), Math.exp(-fr.dt / 0.09));
      kit.fullscreen();
      gl.blendFunc(gl.ONE, gl.ONE);
      if (fr.starCount > 0) {
        gl.useProgram(starProg.p);
        projection(starProg);
        gl.bindBuffer(gl.ARRAY_BUFFER, starBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, fr.stars, 0, fr.starCount * STAR_FLOATS);
        gl.bindVertexArray(starVao);
        // Written scaled down when the targets are 8-bit.
        gl.blendColor(store, store, store, 1);
        gl.blendFunc(gl.CONSTANT_COLOR, gl.ONE);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, fr.starCount);
      }
      // Smoke density, at a third of the size.
      kit.into(smoke);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.blendFunc(gl.ONE, gl.ONE);
      if (fr.puffCount > 0) {
        gl.useProgram(puffProg.p);
        projection(puffProg);
        gl.uniform1f(puffProg.u('uScale'), smokeScale);
        gl.uniform1f(puffProg.u('uTime'), fr.time);
        gl.bindBuffer(gl.ARRAY_BUFFER, puffBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, fr.puffs, 0, fr.puffCount * PUFF_FLOATS);
        gl.bindVertexArray(puffVao);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, fr.puffCount);
      }
      gl.disable(gl.BLEND);
      // The sky with its smoke and stars, then the glow around the bright parts.
      kit.into(above);
      gl.useProgram(aboveProg.p);
      gl.uniform2f(aboveProg.u('uRes'), W, H);
      gl.uniform1f(aboveProg.u('uHorizon'), opts.horizon);
      gl.uniform1f(aboveProg.u('uTime'), fr.time);
      gl.uniform1f(aboveProg.u('uStore'), store);
      gl.uniform3f(aboveProg.u('uZenith'), ...opts.zenith);
      gl.uniform3f(aboveProg.u('uLow'), ...opts.low);
      gl.uniform1f(aboveProg.u('uDim'), fr.dim ?? 0);
      lightUniforms(aboveProg, fr.lightCount);
      kit.bind(0, light.tex, aboveProg.u('uLight'));
      kit.bind(1, smoke.tex, aboveProg.u('uSmoke'));
      kit.fullscreen();
      const glow: Target = bloom.run(above);
      kit.into(null);
      gl.useProgram(finalProg.p);
      gl.uniform2f(finalProg.u('uRes'), W, H);
      gl.uniform1f(finalProg.u('uHorizon'), opts.horizon);
      gl.uniform1f(finalProg.u('uTime'), fr.time);
      gl.uniform1f(finalProg.u('uStore'), store);
      gl.uniform1f(finalProg.u('uExposure'), fr.exposure);
      gl.uniform1f(finalProg.u('uBloomGain'), (1.1 * (opts.bloom ?? 1)) / bloom.levels);
      gl.uniform1f(finalProg.u('uScale'), opts.scale);
      gl.uniform3f(finalProg.u('uWater'), ...opts.water);
      gl.uniform1f(finalProg.u('uDim'), fr.dim ?? 0);
      lightUniforms(finalProg, fr.lightCount);
      kit.bind(0, above.tex, finalProg.u('uAbove'));
      kit.bind(1, glow.tex, finalProg.u('uBloom'));
      kit.bind(2, cityTex, finalProg.u('uCity'));
      kit.fullscreen();
    },
    dispose() {
      kit.dispose();
    },
  };
}
