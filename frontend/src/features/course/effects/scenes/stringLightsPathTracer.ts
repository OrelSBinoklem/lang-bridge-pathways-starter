/**
 * A small WebGL2 path tracer for the string-lights room.
 *
 * The room is a relief seen from the front — a height field painted by stringLightsDecor.ts. For every point of it
 * the tracer gathers the light of ONE source: one bulb (a small sphere hanging in front of the wall), or the moonlit
 * window together with the dark rest of the room. Each sample does next-event estimation towards that source through
 * the relief (soft shadows from the sphere's size), then two cosine-weighted diffuse bounces off the painted colours
 * (contact shadows in every joint, warm brick and wood bleeding onto whatever is next to them), and rays that escape
 * towards the viewer pick up a dim fill standing in for the rest of the room behind the camera.
 *
 * Light adds up linearly, so every source accumulates into its own layer of a float texture array — progressively,
 * one pass (one sample per texel) at a time — and any mix of lamps at any brightness is just a weighted sum of layers,
 * with no re-tracing when a lamp is switched. While a layer is still young an edge-aware à-trous filter hides its
 * noise; an edge-aware upsample to the full-resolution colours and ACES tone mapping make the final picture.
 */

import { createProgressiveProgram } from './progressiveProgram';

export type PathTracerLight = {
  x: number;
  y: number;
  z: number;
  radius: number;
  /** Linear RGB radiant intensity (irradiance at distance d is intensity / d²). */
  intensity: [number, number, number];
  /** Radiance of rays that leave the relief towards the viewer while this lamp is lit (its light off the rest of the room). */
  fill: [number, number, number];
};

export type PathTracerSetup = {
  /** Scene size, CSS px. */
  width: number;
  height: number;
  /** Size of the final picture, device px. */
  outWidth: number;
  outHeight: number;
  /** Size of the light-map grid. */
  bakeWidth: number;
  bakeHeight: number;
  /** CSS px that a relief height of 1.0 stands for. */
  heightUnit: number;
  /** The relief on the bake grid, 0..1, rows from the top. */
  relief: Float32Array;
  /** The relief at full resolution (grey), to keep light from bleeding across object edges when upsampling. */
  heightFull: HTMLCanvasElement;
  /** Unshaded colours, full resolution; transparent where there is nothing (the window). */
  albedo: HTMLCanvasElement;
  /** Self-lit things (the night sky), full resolution. */
  emissive: HTMLCanvasElement;
  window: { x0: number; y0: number; x1: number; y1: number };
  windowRadiance: [number, number, number];
  nightFill: [number, number, number];
  lights: PathTracerLight[];
};

export type PathTracer = {
  readonly canvas: HTMLCanvasElement;
  ready(): boolean;
  readonly layers: number;
  /** Samples per texel accumulated so far, per layer (0 = moonlight, 1… = the bulbs). */
  readonly samples: Float32Array;
  /** Adds `spp` samples per texel to one layer, with 0–2 diffuse bounces after the direct light. */
  trace(layer: number, spp: number, bounces: number): void;
  /** Throws every accumulated sample away (to watch it converge again, or after changing the bounce count). */
  reset(): void;
  /** Renders the room lit by `weights[layer]` of every layer into `canvas`; `lightOnly` shows the light without the
   * room's colours, `denoise: false` shows the raw accumulated samples. */
  compose(weights: Float32Array, exposure: number, emissiveGain: number, lightOnly: boolean, denoise: boolean): void;
  lost(): boolean;
  dispose(): void;
};

const MAX_LAYERS = 24;

const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const TRACE = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform sampler2D uHeight;
uniform sampler2D uAlbedo;
uniform vec2 uSize;
uniform vec2 uBake;
uniform float uZ;
uniform float uAlbedoLod;
uniform uint uSeed;
uniform int uSpp;
uniform int uBounces;
uniform int uMode;
uniform vec3 uLightPos;
uniform float uLightR;
uniform vec3 uLightI;
uniform vec4 uWin;
uniform vec3 uWinL;
uniform vec3 uEnvL;
out vec4 outColor;

const float PI = 3.14159265;
uint rngState;

uint hash(uint x) {
  x ^= x >> 16u;
  x *= 0x7feb352du;
  x ^= x >> 15u;
  x *= 0x846ca68bu;
  x ^= x >> 16u;
  return x;
}

float rnd() {
  rngState = hash(rngState);
  return float(rngState >> 8u) * (1.0 / 16777216.0);
}

float heightAt(vec2 p) {
  return texture(uHeight, p / uSize).r * uZ;
}

vec3 normalAt(vec2 p) {
  vec2 e = uSize / uBake;
  float dx = heightAt(p + vec2(e.x, 0.0)) - heightAt(p - vec2(e.x, 0.0));
  float dy = heightAt(p + vec2(0.0, e.y)) - heightAt(p - vec2(0.0, e.y));
  return normalize(vec3(-dx / (2.0 * e.x), -dy / (2.0 * e.y), 1.0));
}

vec3 albedoAt(vec2 p) {
  vec3 a = textureLod(uAlbedo, p / uSize, uAlbedoLod).rgb;
  return pow(clamp(a, 0.0, 1.0), vec3(2.2)) * 0.9;
}

float visible(vec3 a, vec3 b) {
  vec3 d = b - a;
  float texel = uSize.x / uBake.x;
  float n = clamp(length(d.xy) / (texel * 1.25), 3.0, 56.0);
  float j = rnd();
  for (int k = 0; k < 56; k++) {
    float fk = float(k);
    if (fk >= n) break;
    vec3 s = a + d * ((fk + j) / n);
    if (heightAt(s.xy) > s.z) return 0.0;
  }
  return 1.0;
}

vec3 onSphere() {
  float z = rnd() * 2.0 - 1.0;
  float a = rnd() * 2.0 * PI;
  float r = sqrt(max(0.0, 1.0 - z * z));
  return vec3(r * cos(a), r * sin(a), z);
}

vec3 cosineDir(vec3 n) {
  float u1 = rnd();
  float u2 = rnd();
  float r = sqrt(u1);
  float phi = 2.0 * PI * u2;
  vec3 t = normalize(abs(n.x) > 0.5 ? cross(n, vec3(0.0, 1.0, 0.0)) : cross(n, vec3(1.0, 0.0, 0.0)));
  vec3 b = cross(n, t);
  return normalize(t * (r * cos(phi)) + b * (r * sin(phi)) + n * sqrt(max(0.0, 1.0 - u1)));
}

// Next-event estimation: irradiance at P straight from this layer's source.
vec3 direct(vec3 P, vec3 N, float eps) {
  vec3 o = P + N * eps;
  if (uMode == 1) {
    vec3 L = uLightPos + uLightR * onSphere();
    vec3 v = L - o;
    float d2 = max(dot(v, v), uLightR * uLightR);
    float c = dot(N, v) * inversesqrt(d2);
    if (c <= 0.0) return vec3(0.0);
    return uLightI * (c / d2) * visible(o, L);
  }
  vec3 W = vec3(mix(uWin.x, uWin.z, rnd()), mix(uWin.y, uWin.w, rnd()), uZ * 0.004);
  vec3 v = W - o;
  float d2 = max(dot(v, v), 1.0);
  float inv = inversesqrt(d2);
  float cp = dot(N, v) * inv;
  float cw = -v.z * inv;
  if (cp <= 0.0 || cw <= 0.0) return vec3(0.0);
  float area = (uWin.z - uWin.x) * (uWin.w - uWin.y);
  return uWinL * (cp * cw * area / d2) * visible(o, W);
}

// First crossing of the ray under the relief, refined by bisection; false if it leaves the room first.
bool march(vec3 o, vec3 d, out vec3 hit) {
  float texel = uSize.x / uBake.x;
  float dt = texel * 1.2 / max(length(d.xy), 0.25);
  float t = dt * rnd();
  hit = o;
  for (int k = 0; k < 72; k++) {
    float prev = t;
    t += dt;
    dt *= 1.04;
    vec3 p = o + d * t;
    if (p.x < 0.0 || p.y < 0.0 || p.x > uSize.x || p.y > uSize.y) return false;
    if (d.z > 0.0 && p.z > uZ) return false;
    if (p.z < heightAt(p.xy)) {
      float lo = prev;
      float hi = t;
      for (int r = 0; r < 5; r++) {
        float m = 0.5 * (lo + hi);
        vec3 q = o + d * m;
        if (q.z < heightAt(q.xy)) hi = m; else lo = m;
      }
      hit = o + d * hi;
      return true;
    }
  }
  return false;
}

void main() {
  vec2 p = gl_FragCoord.xy * (uSize / uBake);
  rngState = hash(uint(gl_FragCoord.x) * 1973u + hash(uint(gl_FragCoord.y) * 9277u + uSeed));
  float texel = uSize.x / uBake.x;
  float eps = max(uZ * 0.012, texel * 0.6);
  vec3 sum = vec3(0.0);
  for (int s = 0; s < 4; s++) {
    if (s >= uSpp) break;
    vec3 P = vec3(p, heightAt(p));
    vec3 N = normalAt(p);
    vec3 E = direct(P, N, eps);
    vec3 thr = vec3(1.0);
    vec3 pos = P;
    vec3 nrm = N;
    for (int b = 0; b < 2; b++) {
      if (b >= uBounces) break;
      vec3 d = cosineDir(nrm);
      vec3 h;
      if (!march(pos + nrm * eps, d, h)) {
        E += thr * uEnvL * PI;
        break;
      }
      vec3 hn = normalAt(h.xy);
      thr *= albedoAt(h.xy);
      if (max(thr.r, max(thr.g, thr.b)) < 0.002) break;
      E += thr * direct(h, hn, eps);
      pos = h;
      nrm = hn;
    }
    if (!(E.r >= 0.0 && E.g >= 0.0 && E.b >= 0.0) || max(E.r, max(E.g, E.b)) > 1e4) E = vec3(0.0);
    sum += min(E, vec3(48.0));
  }
  outColor = vec4(sum, float(uSpp));
}`;

const COMBINE = `#version 300 es
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray uAccum;
uniform float uW[${MAX_LAYERS}];
uniform int uN;
out vec4 outColor;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec3 E = vec3(0.0);
  float spp = 1e6;
  for (int i = 0; i < ${MAX_LAYERS}; i++) {
    if (i >= uN) break;
    float w = uW[i];
    if (w <= 0.0) continue;
    vec4 a = texelFetch(uAccum, ivec3(c, i), 0);
    if (a.a > 0.0) E += w * a.rgb / a.a;
    spp = min(spp, a.a);
  }
  outColor = vec4(E, spp);
}`;

const DENOISE = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uIn;
uniform sampler2D uHeight;
uniform vec2 uBake;
uniform int uStep;
out vec4 outColor;
float h(ivec2 q) { return texelFetch(uHeight, q, 0).r; }
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  ivec2 mx = ivec2(uBake) - 1;
  vec4 center = texelFetch(uIn, c, 0);
  float hc = h(c);
  vec2 g = 0.5 * vec2(h(min(c + ivec2(1, 0), mx)) - h(max(c - ivec2(1, 0), ivec2(0))), h(min(c + ivec2(0, 1), mx)) - h(max(c - ivec2(0, 1), ivec2(0))));
  float k[3] = float[3](0.375, 0.25, 0.0625);
  vec3 sum = vec3(0.0);
  float ws = 0.0;
  for (int y = -2; y <= 2; y++) {
    for (int x = -2; x <= 2; x++) {
      ivec2 q = clamp(c + ivec2(x, y) * uStep, ivec2(0), mx);
      float expect = hc + dot(g, vec2(q - c));
      float w = k[abs(x)] * k[abs(y)] * exp(-abs(h(q) - expect) * 80.0);
      sum += texelFetch(uIn, q, 0).rgb * w;
      ws += w;
    }
  }
  float strength = clamp(6.0 / max(center.a, 1.0), 0.0, 1.0);
  outColor = vec4(mix(center.rgb, sum / ws, strength), center.a);
}`;

const COMPOSITE = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uAlbedo;
uniform sampler2D uEmissive;
uniform sampler2D uHeightFull;
uniform sampler2D uIrr;
uniform sampler2D uHeight;
uniform vec2 uOut;
uniform vec2 uBake;
uniform float uExposure;
uniform float uEmissiveGain;
uniform int uLightOnly;
out vec4 outColor;
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
void main() {
  vec2 uv = vec2(gl_FragCoord.x / uOut.x, 1.0 - gl_FragCoord.y / uOut.y);
  vec3 A = pow(texture(uAlbedo, uv).rgb, vec3(2.2));
  float hF = texture(uHeightFull, uv).r;
  vec2 tc = uv * uBake - 0.5;
  vec2 f = fract(tc);
  ivec2 i0 = ivec2(floor(tc));
  ivec2 mx = ivec2(uBake) - 1;
  vec3 sum = vec3(0.0);
  float ws = 0.0;
  for (int j = 0; j < 2; j++) {
    for (int i = 0; i < 2; i++) {
      ivec2 q = clamp(i0 + ivec2(i, j), ivec2(0), mx);
      float wb = (i == 0 ? 1.0 - f.x : f.x) * (j == 0 ? 1.0 - f.y : f.y);
      float w = wb * (exp(-abs(texelFetch(uHeight, q, 0).r - hF) * 30.0) + 1e-3);
      sum += texelFetch(uIrr, q, 0).rgb * w;
      ws += w;
    }
  }
  vec3 E = sum / max(ws, 1e-6);
  vec3 col = uLightOnly == 1
    ? E * uExposure * 0.5
    : A * E * uExposure + pow(texture(uEmissive, uv).rgb, vec3(2.2)) * uEmissiveGain;
  outColor = vec4(pow(aces(col), vec3(1.0 / 2.2)), 1.0);
}`;

function warn(reason: string) {
  console.warn(`[string-lights] path tracer unavailable (${reason}); falling back to plain baked lighting.`);
}

export function createPathTracer(s: PathTracerSetup): PathTracer | null {
  const layers = s.lights.length + 1;
  if (layers > MAX_LAYERS) return null;
  const canvas = document.createElement('canvas');
  canvas.width = s.outWidth;
  canvas.height = s.outHeight;
  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
  } catch {
    gl = null;
  }
  if (!gl || typeof gl.texStorage3D !== 'function') {
    warn('no WebGL2');
    return null;
  }
  const g = gl;
  const release = () => g.getExtension('WEBGL_lose_context')?.loseContext();
  if (!g.getExtension('EXT_color_buffer_float')) {
    warn('no float render targets');
    release();
    return null;
  }
  const trace = createProgressiveProgram(g, VERT, TRACE, 'string-lights trace');
  const combine = createProgressiveProgram(g, VERT, COMBINE, 'string-lights combine');
  const denoise = createProgressiveProgram(g, VERT, DENOISE, 'string-lights denoise');
  const composite = createProgressiveProgram(g, VERT, COMPOSITE, 'string-lights composite');
  if (!trace || !combine || !denoise || !composite) {
    warn('shader compile failed');
    release();
    return null;
  }
  const bw = s.bakeWidth;
  const bh = s.bakeHeight;

  const tex2d = (filter: number) => {
    const t = g.createTexture()!;
    g.bindTexture(g.TEXTURE_2D, t);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, filter);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, filter === g.LINEAR_MIPMAP_LINEAR ? g.LINEAR : filter);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    return t;
  };

  const heightTex = tex2d(g.LINEAR);
  g.pixelStorei(g.UNPACK_ALIGNMENT, 1);
  g.texImage2D(g.TEXTURE_2D, 0, g.R16F, bw, bh, 0, g.RED, g.FLOAT, s.relief);

  g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const albedoTex = tex2d(g.LINEAR_MIPMAP_LINEAR);
  g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, g.RGBA, g.UNSIGNED_BYTE, s.albedo);
  g.generateMipmap(g.TEXTURE_2D);
  const emissiveTex = tex2d(g.LINEAR);
  g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, g.RGBA, g.UNSIGNED_BYTE, s.emissive);
  g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  const heightFullTex = tex2d(g.LINEAR);
  g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, g.RGBA, g.UNSIGNED_BYTE, s.heightFull);

  const accum = g.createTexture()!;
  g.bindTexture(g.TEXTURE_2D_ARRAY, accum);
  g.texParameteri(g.TEXTURE_2D_ARRAY, g.TEXTURE_MIN_FILTER, g.NEAREST);
  g.texParameteri(g.TEXTURE_2D_ARRAY, g.TEXTURE_MAG_FILTER, g.NEAREST);
  g.texStorage3D(g.TEXTURE_2D_ARRAY, 1, g.RGBA16F, bw, bh, layers);

  const irr = [0, 1].map(() => {
    const t = tex2d(g.NEAREST);
    g.texStorage2D(g.TEXTURE_2D, 1, g.RGBA16F, bw, bh);
    const fb = g.createFramebuffer()!;
    g.bindFramebuffer(g.FRAMEBUFFER, fb);
    g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, t, 0);
    return { t, fb };
  });
  const accumFb = g.createFramebuffer()!;
  g.bindFramebuffer(g.FRAMEBUFFER, accumFb);
  g.framebufferTextureLayer(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, accum, 0, 0);
  const complete = g.checkFramebufferStatus(g.FRAMEBUFFER) === g.FRAMEBUFFER_COMPLETE;
  g.bindFramebuffer(g.FRAMEBUFFER, irr[0].fb);
  const irrComplete = g.checkFramebufferStatus(g.FRAMEBUFFER) === g.FRAMEBUFFER_COMPLETE;
  g.bindFramebuffer(g.FRAMEBUFFER, null);
  if (!complete || !irrComplete) {
    warn('float framebuffer incomplete');
    release();
    return null;
  }
  const vao = g.createVertexArray();
  g.bindVertexArray(vao);
  g.disable(g.DEPTH_TEST);
  g.disable(g.BLEND);

  const samples = new Float32Array(layers);
  const weightsBuf = new Float32Array(MAX_LAYERS);
  const albedoLod = Math.max(0, Math.log2(s.outWidth / bw));
  let seed = 0x2545f491;
  let isLost = false;
  let disposed = false;
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    isLost = true;
  });
  const bind = (unit: number, target: number, t: WebGLTexture, loc: WebGLUniformLocation | null) => {
    g.activeTexture(g.TEXTURE0 + unit);
    g.bindTexture(target, t);
    g.uniform1i(loc, unit);
  };
  const programs = [trace, combine, denoise, composite];
  const lost = () => isLost || disposed || g.isContextLost() || programs.some(program => program.failed());
  const ready = () => !lost() && programs.map(program => program.ready()).every(Boolean);

  return {
    canvas,
    layers,
    samples,
    ready,
    trace(layer, spp, bounces) {
      if (!ready()) return;
      g.bindFramebuffer(g.FRAMEBUFFER, accumFb);
      g.framebufferTextureLayer(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, accum, 0, layer);
      g.viewport(0, 0, bw, bh);
      g.useProgram(trace.prog);
      bind(0, g.TEXTURE_2D, heightTex, trace.u('uHeight'));
      bind(1, g.TEXTURE_2D, albedoTex, trace.u('uAlbedo'));
      g.uniform2f(trace.u('uSize'), s.width, s.height);
      g.uniform2f(trace.u('uBake'), bw, bh);
      g.uniform1f(trace.u('uZ'), s.heightUnit);
      g.uniform1f(trace.u('uAlbedoLod'), albedoLod);
      seed = (seed + 0x9e3779b9) >>> 0;
      g.uniform1ui(trace.u('uSeed'), seed);
      g.uniform1i(trace.u('uSpp'), Math.max(1, Math.min(4, spp)));
      g.uniform1i(trace.u('uBounces'), Math.max(0, Math.min(2, Math.round(bounces))));
      g.uniform4f(trace.u('uWin'), s.window.x0, s.window.y0, s.window.x1, s.window.y1);
      if (layer === 0) {
        g.uniform1i(trace.u('uMode'), 0);
        g.uniform3f(trace.u('uWinL'), ...s.windowRadiance);
        g.uniform3f(trace.u('uEnvL'), ...s.nightFill);
        g.uniform3f(trace.u('uLightPos'), 0, 0, 0);
        g.uniform1f(trace.u('uLightR'), 1);
        g.uniform3f(trace.u('uLightI'), 0, 0, 0);
      } else {
        const l = s.lights[layer - 1];
        g.uniform1i(trace.u('uMode'), 1);
        g.uniform3f(trace.u('uWinL'), 0, 0, 0);
        g.uniform3f(trace.u('uEnvL'), ...l.fill);
        g.uniform3f(trace.u('uLightPos'), l.x, l.y, l.z);
        g.uniform1f(trace.u('uLightR'), l.radius);
        g.uniform3f(trace.u('uLightI'), ...l.intensity);
      }
      g.enable(g.BLEND);
      g.blendFunc(g.ONE, g.ONE);
      g.drawArrays(g.TRIANGLES, 0, 3);
      g.disable(g.BLEND);
      samples[layer] += Math.max(1, Math.min(4, spp));
    },
    reset() {
      if (lost()) return;
      g.bindFramebuffer(g.FRAMEBUFFER, accumFb);
      g.viewport(0, 0, bw, bh);
      g.clearColor(0, 0, 0, 0);
      for (let l = 0; l < layers; l += 1) {
        g.framebufferTextureLayer(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, accum, 0, l);
        g.clear(g.COLOR_BUFFER_BIT);
      }
      samples.fill(0);
    },
    compose(weights, exposure, emissiveGain, lightOnly, denoiseOn) {
      if (!ready()) return;
      weightsBuf.fill(0);
      weightsBuf.set(weights.subarray(0, Math.min(weights.length, MAX_LAYERS)));
      g.bindFramebuffer(g.FRAMEBUFFER, irr[0].fb);
      g.viewport(0, 0, bw, bh);
      g.useProgram(combine.prog);
      bind(0, g.TEXTURE_2D_ARRAY, accum, combine.u('uAccum'));
      g.uniform1fv(combine.u('uW'), weightsBuf);
      g.uniform1i(combine.u('uN'), layers);
      g.drawArrays(g.TRIANGLES, 0, 3);
      g.activeTexture(g.TEXTURE0);
      g.bindTexture(g.TEXTURE_2D_ARRAY, null);

      let src = 0;
      g.useProgram(denoise.prog);
      g.uniform2f(denoise.u('uBake'), bw, bh);
      for (const step of denoiseOn ? [1, 2, 4] : []) {
        const dst = 1 - src;
        g.bindFramebuffer(g.FRAMEBUFFER, irr[dst].fb);
        bind(0, g.TEXTURE_2D, irr[src].t, denoise.u('uIn'));
        bind(1, g.TEXTURE_2D, heightTex, denoise.u('uHeight'));
        g.uniform1i(denoise.u('uStep'), step);
        g.drawArrays(g.TRIANGLES, 0, 3);
        src = dst;
      }

      g.bindFramebuffer(g.FRAMEBUFFER, null);
      g.viewport(0, 0, g.drawingBufferWidth, g.drawingBufferHeight);
      g.useProgram(composite.prog);
      bind(0, g.TEXTURE_2D, albedoTex, composite.u('uAlbedo'));
      bind(1, g.TEXTURE_2D, emissiveTex, composite.u('uEmissive'));
      bind(2, g.TEXTURE_2D, heightFullTex, composite.u('uHeightFull'));
      bind(3, g.TEXTURE_2D, irr[src].t, composite.u('uIrr'));
      bind(4, g.TEXTURE_2D, heightTex, composite.u('uHeight'));
      g.uniform2f(composite.u('uOut'), g.drawingBufferWidth, g.drawingBufferHeight);
      g.uniform2f(composite.u('uBake'), bw, bh);
      g.uniform1f(composite.u('uExposure'), exposure);
      g.uniform1f(composite.u('uEmissiveGain'), emissiveGain);
      g.uniform1i(composite.u('uLightOnly'), lightOnly ? 1 : 0);
      g.drawArrays(g.TRIANGLES, 0, 3);
    },
    lost,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (!g.isContextLost()) {
        for (const t of [heightTex, albedoTex, emissiveTex, heightFullTex, accum, irr[0].t, irr[1].t]) g.deleteTexture(t);
        for (const fb of [accumFb, irr[0].fb, irr[1].fb]) g.deleteFramebuffer(fb);
        for (const pr of programs) pr.dispose();
        g.deleteVertexArray(vao);
      }
      release();
    },
  };
}
