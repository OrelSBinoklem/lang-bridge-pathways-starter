import { SEGMENT_FLOATS } from './opticsTrace';

/**
 * WebGL2 renderer for the optics-lab scene, two ways of showing the same pieces of glass:
 *
 * - rays: the tracer's segments drawn as instanced quads into a float buffer — a sharp core and a soft halo, a bright
 *   head while the light front is still crawling along them, photon pulses streaming along, spots where light meets a
 *   surface — then a bloom pyramid, glass bodies lit by the light scattered inside them, edges catching nearby light;
 * - waves: the scalar wave equation on a grid (a "cellular automaton" of light, one field per colour channel with its own
 *   wavelength and refractive index), sources that emit one way only (two lines a quarter wave apart, a quarter period
 *   out of phase), absorbing borders; shown as wave crests, time-averaged energy, or both.
 */

export type WaveSource = {
  /** css px */
  x: number;
  y: number;
  dx: number;
  dy: number;
  /** Channel weights: which of the three simulated colours the source emits. */
  r: number;
  g: number;
  b: number;
  /** Beam half-width, css px. */
  halfWidth: number;
  /** 0..1, ramped up when the source turns on. */
  amp: number;
};

export type OpticsFrame = {
  mode: number;
  now: number;
  speed: number;
  on: Float32Array;
  pulses: number;
  glow: number;
  exposure: number;
  waveView: number;
  waveSteps: number;
  sources: WaveSource[];
  clearWaves: boolean;
};

export type OpticsRenderer = {
  canvas: HTMLCanvasElement;
  waves: boolean;
  simWidth: number;
  simHeight: number;
  setBeams(data: Float32Array, count: number): void;
  /** Triangles (x, y, r, g, b, a per vertex) of the pieces as seen, the same triangles coloured with refractive index
   * data for the wave grid, and the outline segments (in the beam layout) for the lit edges. */
  setBodies(fill: Float32Array, fillVertices: number, medium: Float32Array, mediumVertices: number, rims: Float32Array, rimCount: number): void;
  render(frame: OpticsFrame): void;
  dispose(): void;
};

/** Wavelengths of the three wave channels, in grid cells (the wave moves 0.5 cell per step: a period is 2λ steps). */
export const WAVE_LAMBDA = [12, 10, 8];

const FULL_VS = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const BEAM_VS = `#version 300 es
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 iSeg;
layout(location = 2) in vec3 iColor;
layout(location = 3) in vec4 iInfo;
uniform vec2 uView;
uniform float uNow;
uniform float uSpeed;
uniform float uOn[16];
uniform float uHalo;
uniform float uStatic;
out vec2 vLocal;
out float vLen;
out float vVis;
out vec3 vColor;
out vec4 vInfo;
out float vFront;
void main() {
  float front = uStatic > 0.5 ? 1e9 : (uNow - uOn[int(iInfo.z)]) * uSpeed;
  vec2 d = iSeg.zw - iSeg.xy;
  float len = length(d);
  vec2 dir = len > 1e-4 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float vis;
  float halo = uHalo;
  if (iInfo.y <= 0.0) {
    vis = front >= iInfo.x ? 0.0 : -1.0;
    len = 0.0;
    halo *= 1.4;
  } else {
    vis = min(len, (front - iInfo.x) / iInfo.y);
  }
  if (vis < 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  float along = mix(-halo, vis + halo, aCorner.x);
  float across = aCorner.y * halo;
  vec2 pos = iSeg.xy + dir * along + nrm * across;
  vLocal = vec2(along, across);
  vLen = len;
  vVis = vis;
  vColor = iColor;
  vInfo = iInfo;
  vFront = front;
  gl_Position = vec4(pos.x / uView.x * 2.0 - 1.0, 1.0 - pos.y / uView.y * 2.0, 0.0, 1.0);
}`;

const BEAM_FS = `#version 300 es
precision highp float;
in vec2 vLocal;
in float vLen;
in float vVis;
in vec3 vColor;
in vec4 vInfo;
in float vFront;
uniform float uCore;
uniform float uHalo;
uniform float uPulse;
uniform float uPulseLen;
uniform float uStatic;
out vec4 o;
void main() {
  float along = vLocal.x;
  float across = vLocal.y;
  float da = max(0.0, max(-along, along - vVis));
  float dist = length(vec2(da, across));
  float k;
  if (vInfo.w > 1.5) {
    float r = uCore * 1.8;
    k = exp(-dist * dist / (2.0 * r * r)) * 1.6 + exp(-dist / (uHalo * 0.18)) * 0.4;
  } else {
    float core = exp(-dist * dist / (2.0 * uCore * uCore));
    float mid = exp(-dist * dist / (2.0 * uHalo * uHalo * 0.018));
    float halo = exp(-dist / (uHalo * 0.3));
    k = core + mid * 0.28 + halo * 0.16;
    // Inside acrylic the beam scatters: brighter and a little wider.
    if (vInfo.w > 0.5) k = core * 1.5 + mid * 0.5 + halo * 0.22;
    if (uStatic < 0.5 && vInfo.y > 0.0) {
      // The light front: a hot head while it is still on its way.
      if (vVis < vLen) {
        float dt = length(vec2(along - vVis, across));
        float r = uCore * 3.0;
        k += exp(-dt * dt / (2.0 * r * r)) * 3.0 + exp(-dt / (uHalo * 0.25)) * 0.5;
      }
      // Photons streaming along the beam.
      if (uPulse > 0.0) {
        float s = vInfo.x + clamp(along, 0.0, vVis) * vInfo.y;
        float ph = fract((vFront - s) / uPulseLen);
        k += uPulse * exp(-ph * 10.0) * (core * 2.2 + mid * 0.5);
      }
    }
  }
  o = vec4(vColor * k, 1.0);
}`;

const FILL_VS = `#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec4 aColor;
uniform vec2 uView;
out vec4 vColor;
void main() {
  vColor = aColor;
  gl_Position = vec4(aPos.x / uView.x * 2.0 - 1.0, 1.0 - aPos.y / uView.y * 2.0, 0.0, 1.0);
}`;

const FILL_FS = `#version 300 es
precision highp float;
in vec4 vColor;
out vec4 o;
void main() { o = vColor; }`;

const DOWN_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSrc;
uniform vec2 uTexel;
out vec4 o;
void main() {
  o = (texture(uSrc, vUv + uTexel * vec2(-1.0, -1.0)) + texture(uSrc, vUv + uTexel * vec2(1.0, -1.0))
    + texture(uSrc, vUv + uTexel * vec2(-1.0, 1.0)) + texture(uSrc, vUv + uTexel * vec2(1.0, 1.0))) * 0.25;
}`;

const UP_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uBase;
uniform sampler2D uSmall;
uniform vec2 uTexel;
out vec4 o;
void main() {
  vec4 s = texture(uSmall, vUv) * 4.0;
  s += (texture(uSmall, vUv + vec2(uTexel.x, 0.0)) + texture(uSmall, vUv - vec2(uTexel.x, 0.0))
      + texture(uSmall, vUv + vec2(0.0, uTexel.y)) + texture(uSmall, vUv - vec2(0.0, uTexel.y))) * 2.0;
  s += texture(uSmall, vUv + uTexel) + texture(uSmall, vUv - uTexel)
      + texture(uSmall, vUv + vec2(uTexel.x, -uTexel.y)) + texture(uSmall, vUv + vec2(-uTexel.x, uTexel.y));
  o = texture(uBase, vUv) + s / 16.0;
}`;

const COMPOSITE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uLight;
uniform sampler2D uBloom;
uniform sampler2D uWide;
uniform sampler2D uGlass;
uniform sampler2D uRim;
uniform float uGlow;
uniform float uExposure;
uniform float uBloomNorm;
uniform float uWideNorm;
out vec4 o;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
  vec3 light = texture(uLight, vUv).rgb;
  vec3 bloom = texture(uBloom, vUv).rgb * uBloomNorm;
  vec3 wide = texture(uWide, vUv).rgb * uWideNorm;
  vec4 glass = texture(uGlass, vUv);
  vec3 rim = texture(uRim, vUv).rgb;
  vec2 p = vUv - 0.5;
  float vig = 1.0 - dot(p, p) * 0.8;
  // A dark matte board that catches the scattered light.
  vec3 col = vec3(0.010, 0.012, 0.018) * vig + (hash(gl_FragCoord.xy) - 0.5) * 0.004;
  col += wide * 0.55 + bloom * 0.12;
  float opaque = step(0.9, glass.a);
  vec3 albedo = glass.rgb / max(glass.a, 1e-3);
  col = mix(col, albedo * (vec3(0.03) + wide * 3.0 + bloom * 0.7), opaque);
  // Glass: slightly darker than the board, glowing with the light scattered inside it.
  float ga = glass.a * (1.0 - opaque);
  col = col * (1.0 - ga * 0.5) + ga * albedo * (0.012 + wide * 0.8 + bloom * 0.12);
  // Edges catch the light around them.
  col += rim * (vec3(0.05) + wide * 3.5 + bloom * 0.8);
  col += light + bloom * uGlow;
  col = aces(col * uExposure);
  o = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
}`;

const SIM_FS = `#version 300 es
precision highp float;
layout(location = 0) out vec4 oU;
layout(location = 1) out vec4 oE;
uniform sampler2D uPrev;
uniform sampler2D uCur;
uniform sampler2D uE;
uniform sampler2D uMedium;
uniform vec2 uSim;
uniform float uT;
uniform vec3 uLam;
uniform vec4 uSrc[8];
uniform vec4 uSrcCol[8];
uniform float uSrcAmp[8];
uniform int uSrcCount;
uniform float uBorder;
vec3 at(ivec2 p) {
  p = clamp(p, ivec2(0), ivec2(uSim) - 1);
  return texelFetch(uCur, p, 0).rgb;
}
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec3 u = texelFetch(uCur, c, 0).rgb;
  vec3 up = texelFetch(uPrev, c, 0).rgb;
  vec3 e = texelFetch(uE, c, 0).rgb;
  vec4 med = texture(uMedium, (vec2(c) + 0.5) / uSim);
  vec3 n = 1.0 + med.rgb * 2.0;
  // Isotropic 9-point Laplacian; the wave moves 0.5 cell per step in vacuum, 0.5/n in glass.
  vec3 lap = (4.0 * (at(c + ivec2(1, 0)) + at(c - ivec2(1, 0)) + at(c + ivec2(0, 1)) + at(c - ivec2(0, 1)))
    + at(c + ivec2(1, 1)) + at(c + ivec2(-1, 1)) + at(c + ivec2(1, -1)) + at(c + ivec2(-1, -1)) - 20.0 * u) / 6.0;
  vec3 next = 2.0 * u - up + 0.25 / (n * n) * lap;
  vec2 pos = vec2(c) + 0.5;
  vec3 omega = 3.14159265 / uLam;
  for (int i = 0; i < 8; i++) {
    if (i >= uSrcCount) break;
    vec4 s = uSrc[i];
    vec2 d = pos - s.xy;
    float along = dot(d, s.zw);
    float across = dot(d, vec2(-s.w, s.z));
    float hw = uSrcCol[i].w;
    if (abs(across) > hw * 2.5 || along > 1.5 || along < -uLam.r * 0.25 - 1.5) continue;
    float g = exp(-across * across / (hw * hw)) * uSrcAmp[i];
    // Two lines a quarter wave apart, a quarter period out of phase: forward they add up, backward they cancel.
    vec3 w1 = vec3(max(0.0, 1.0 - abs(along)));
    vec3 w2 = max(vec3(0.0), 1.0 - abs(along + uLam * 0.25));
    vec3 ph = omega * uT;
    next += uSrcCol[i].rgb * g * (w1 * sin(ph) + w2 * cos(ph));
  }
  vec2 edge = min(pos, uSim - pos);
  float dEdge = min(edge.x, edge.y);
  if (dEdge < uBorder) {
    float k = 1.0 - dEdge / uBorder;
    next *= 1.0 - 0.28 * k * k;
  }
  if (med.a > 0.7) next = vec3(0.0);
  else if (med.a > 0.3) next *= 0.8;
  oU = vec4(next, 1.0);
  oE = vec4(e + (next * next - e) * 0.02, 1.0);
}`;

const DISPLAY_FS = `#version 300 es
precision highp float;
uniform sampler2D uU;
uniform sampler2D uE;
uniform int uView;
uniform float uGain;
uniform vec3 uColR;
uniform vec3 uColG;
uniform vec3 uColB;
out vec4 o;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec3 u = texelFetch(uU, c, 0).rgb;
  vec3 e = texelFetch(uE, c, 0).rgb;
  // Shown as intensity (amplitude squared), the way light is seen: a 4 % reflection looks like 4 %, not 20 %.
  vec3 crest = max(u, 0.0);
  crest *= crest * 2.0;
  vec3 energy = max(e, 0.0) * 2.0;
  vec3 a = uView == 0 ? crest * 1.3 : uView == 1 ? energy : energy * 0.6 + crest * 0.7;
  a *= uGain;
  o = vec4(a.r * uColR + a.g * uColG + a.b * uColB, 1.0);
}`;

type Target = { tex: WebGLTexture; fbo: WebGLFramebuffer; w: number; h: number };

export function createOpticsRenderer(width: number, height: number, scale: number, cell: number, channelColors: [number, number, number][]): OpticsRenderer | null {
  const canvas = document.createElement('canvas');
  const W = Math.max(2, Math.round(width * scale));
  const H = Math.max(2, Math.round(height * scale));
  canvas.width = W;
  canvas.height = H;
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  const floatOk = !!gl.getExtension('EXT_color_buffer_float');

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('optics-lab shader:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  };
  const programs: WebGLProgram[] = [];
  const program = (vs: string, fs: string) => {
    const v = compile(gl.VERTEX_SHADER, vs);
    const f = compile(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    const p = gl.createProgram()!;
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('optics-lab program:', gl.getProgramInfoLog(p));
      return null;
    }
    programs.push(p);
    const cache = new Map<string, WebGLUniformLocation | null>();
    const u = (name: string) => {
      if (!cache.has(name)) cache.set(name, gl.getUniformLocation(p, name));
      return cache.get(name)!;
    };
    return { p, u };
  };
  const beamProg = program(BEAM_VS, BEAM_FS);
  const fillProg = program(FILL_VS, FILL_FS);
  const downProg = program(FULL_VS, DOWN_FS);
  const upProg = program(FULL_VS, UP_FS);
  const compProg = program(FULL_VS, COMPOSITE_FS);
  const simProg = floatOk ? program(FULL_VS, SIM_FS) : null;
  const dispProg = floatOk ? program(FULL_VS, DISPLAY_FS) : null;
  if (!beamProg || !fillProg || !downProg || !upProg || !compProg) return null;

  const textures: WebGLTexture[] = [];
  const framebuffers: WebGLFramebuffer[] = [];
  const makeTex = (w: number, h: number, kind: 'hdr' | 'f32' | 'u8', linear: boolean) => {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    if (kind === 'f32') gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
    else if (kind === 'hdr' && floatOk) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    textures.push(t);
    return t;
  };
  const makeFbo = (...attach: WebGLTexture[]) => {
    const f = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    attach.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0));
    if (attach.length > 1) gl.drawBuffers(attach.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    framebuffers.push(f);
    return ok ? f : null;
  };
  const target = (w: number, h: number, kind: 'hdr' | 'u8' | 'f32', linear = true): Target | null => {
    const tex = makeTex(w, h, kind, linear);
    const fbo = makeFbo(tex);
    return fbo ? { tex, fbo, w, h } : null;
  };

  const light = target(W, H, 'hdr');
  const rim = target(W, H, 'hdr');
  const glass = target(W, H, 'u8');
  const down: Target[] = [];
  const up: Target[] = [];
  for (let i = 0, w = W, h = H; i < 6; i += 1) {
    w = Math.max(1, Math.round(w / 2));
    h = Math.max(1, Math.round(h / 2));
    const d = target(w, h, 'hdr');
    if (d) down.push(d);
    if (i < 5) {
      const u = target(w, h, 'hdr');
      if (u) up.push(u);
    }
  }
  if (!light || !rim || !glass || down.length < 6 || up.length < 5) return null;

  // ---- the wave grid.
  const simW = Math.max(8, Math.ceil(width / cell));
  const simH = Math.max(8, Math.ceil(height / cell));
  let waves = false;
  const U: WebGLTexture[] = [];
  const E: WebGLTexture[] = [];
  const simFbo: (WebGLFramebuffer | null)[][] = [];
  let waveLight: Target | null = null;
  let medium: Target | null = null;
  if (simProg && dispProg) {
    for (let i = 0; i < 3; i += 1) U.push(makeTex(simW, simH, 'f32', false));
    for (let i = 0; i < 2; i += 1) E.push(makeTex(simW, simH, 'f32', false));
    for (let i = 0; i < 3; i += 1) simFbo.push([makeFbo(U[i], E[0]), makeFbo(U[i], E[1])]);
    waveLight = target(simW, simH, 'hdr');
    medium = target(simW * 2, simH * 2, 'u8');
    waves = !!waveLight && !!medium && simFbo.every((row) => row.every(Boolean));
  }
  let cur = 1;
  let eCur = 0;
  let step = 0;
  /** Wave brightness follows the picture (auto exposure): the field's strength depends on the sources and the grid. */
  let waveGain = 0.3;
  let meterFrame = 0;
  let meter = new Float32Array(0);

  // ---- geometry.
  const empty = gl.createVertexArray()!;
  const quad = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 1, -1, 0, 1, 1, 1]), gl.STATIC_DRAW);
  const instanced = () => {
    const vao = gl.createVertexArray()!;
    const buf = gl.createBuffer()!;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const stride = SEGMENT_FLOATS * 4;
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 16);
    gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, stride, 28);
    gl.vertexAttribDivisor(3, 1);
    gl.bindVertexArray(null);
    return { vao, buf, count: 0 };
  };
  const triangles = () => {
    const vao = gl.createVertexArray()!;
    const buf = gl.createBuffer()!;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 24, 8);
    gl.bindVertexArray(null);
    return { vao, buf, count: 0 };
  };
  const beams = instanced();
  const rims = instanced();
  const fill = triangles();
  const med = triangles();
  let mediumDirty = true;

  const upload = (b: { buf: WebGLBuffer }, data: Float32Array, floats: number) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, b.buf);
    gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, floats), gl.DYNAMIC_DRAW);
  };

  const bindTex = (unit: number, tex: WebGLTexture, loc: WebGLUniformLocation | null) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(loc, unit);
  };
  const into = (t: { fbo: WebGLFramebuffer | null; w: number; h: number } | null) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fbo : null);
    gl.viewport(0, 0, t ? t.w : W, t ? t.h : H);
  };

  const drawBeams = (prog: NonNullable<typeof beamProg>, vao: WebGLVertexArrayObject, count: number, f: OpticsFrame, stat: boolean) => {
    if (!count) return;
    gl.useProgram(prog.p);
    gl.uniform2f(prog.u('uView'), width, height);
    gl.uniform1f(prog.u('uNow'), f.now);
    gl.uniform1f(prog.u('uSpeed'), f.speed);
    gl.uniform1fv(prog.u('uOn'), f.on);
    gl.uniform1f(prog.u('uHalo'), stat ? 3 : 22);
    gl.uniform1f(prog.u('uCore'), stat ? 0.55 : 1.05);
    gl.uniform1f(prog.u('uStatic'), stat ? 1 : 0);
    gl.uniform1f(prog.u('uPulse'), f.pulses);
    gl.uniform1f(prog.u('uPulseLen'), 150);
    gl.bindVertexArray(vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    gl.bindVertexArray(null);
  };
  const drawFill = (vao: WebGLVertexArrayObject, count: number, viewW = width, viewH = height) => {
    if (!count) return;
    gl.useProgram(fillProg.p);
    gl.uniform2f(fillProg.u('uView'), viewW, viewH);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, count);
    gl.bindVertexArray(null);
  };
  const fullscreen = () => {
    gl.bindVertexArray(empty);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const waveStep = (f: OpticsFrame) => {
    if (!simProg || !medium) return;
    if (mediumDirty) {
      into(medium);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.disable(gl.BLEND);
      // The grid spans whole cells, a touch wider than the page.
      drawFill(med.vao, med.count, simW * cell, simH * cell);
      mediumDirty = false;
    }
    if (f.clearWaves) {
      gl.clearColor(0, 0, 0, 0);
      for (const row of simFbo) for (const fb of row) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    }
    gl.disable(gl.BLEND);
    gl.useProgram(simProg.p);
    gl.uniform2f(simProg.u('uSim'), simW, simH);
    gl.uniform3f(simProg.u('uLam'), WAVE_LAMBDA[0], WAVE_LAMBDA[1], WAVE_LAMBDA[2]);
    gl.uniform1f(simProg.u('uBorder'), 20);
    const src = new Float32Array(32);
    const col = new Float32Array(32);
    const amp = new Float32Array(8);
    const n = Math.min(8, f.sources.length);
    for (let i = 0; i < n; i += 1) {
      const s = f.sources[i];
      const l = Math.hypot(s.dx, s.dy) || 1;
      // Grid y runs up; css y runs down.
      src.set([s.x / cell, simH - s.y / cell, s.dx / l, -s.dy / l], i * 4);
      col.set([s.r, s.g, s.b, Math.max(4, s.halfWidth / cell)], i * 4);
      amp[i] = s.amp * 0.05;
    }
    gl.uniform4fv(simProg.u('uSrc'), src);
    gl.uniform4fv(simProg.u('uSrcCol'), col);
    gl.uniform1fv(simProg.u('uSrcAmp'), amp);
    gl.uniform1i(simProg.u('uSrcCount'), n);
    bindTex(3, medium.tex, simProg.u('uMedium'));
    for (let k = 0; k < f.waveSteps; k += 1) {
      const prev = (cur + 2) % 3;
      const next = (cur + 1) % 3;
      const eNext = 1 - eCur;
      gl.bindFramebuffer(gl.FRAMEBUFFER, simFbo[next][eNext]);
      gl.viewport(0, 0, simW, simH);
      bindTex(0, U[prev], simProg.u('uPrev'));
      bindTex(1, U[cur], simProg.u('uCur'));
      bindTex(2, E[eCur], simProg.u('uE'));
      // All three periods (2λ steps) divide 240, so the phase can wrap there without a jump.
      gl.uniform1f(simProg.u('uT'), step % 240);
      fullscreen();
      cur = next;
      eCur = eNext;
      step += 1;
    }
    if (!dispProg || !waveLight) return;
    into(waveLight);
    gl.useProgram(dispProg.p);
    bindTex(0, U[cur], dispProg.u('uU'));
    bindTex(1, E[eCur], dispProg.u('uE'));
    gl.uniform1i(dispProg.u('uView'), Math.round(f.waveView));
    gl.uniform1f(dispProg.u('uGain'), waveGain);
    gl.uniform3fv(dispProg.u('uColR'), channelColors[0]);
    gl.uniform3fv(dispProg.u('uColG'), channelColors[1]);
    gl.uniform3fv(dispProg.u('uColB'), channelColors[2]);
    fullscreen();
  };

  return {
    canvas,
    waves,
    simWidth: simW,
    simHeight: simH,
    setBeams(data, count) {
      upload(beams, data, count * SEGMENT_FLOATS);
      beams.count = count;
    },
    setBodies(fillData, fillVertices, mediumData, mediumVertices, rimData, rimCount) {
      upload(fill, fillData, fillVertices * 6);
      fill.count = fillVertices;
      upload(med, mediumData, mediumVertices * 6);
      med.count = mediumVertices;
      upload(rims, rimData, rimCount * SEGMENT_FLOATS);
      rims.count = rimCount;
      mediumDirty = true;
    },
    render(f) {
      if (gl.isContextLost()) return;
      const waveMode = f.mode === 1 && waves;
      if (waveMode) waveStep(f);
      else {
        into(light);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        drawBeams(beamProg, beams.vao, beams.count, f, false);
      }
      into(rim);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      drawBeams(beamProg, rims.vao, rims.count, f, true);
      into(glass);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      drawFill(fill.vao, fill.count);
      gl.disable(gl.BLEND);
      // Bloom: halve five times, then add back up.
      const src = waveMode && waveLight ? waveLight : light;
      gl.useProgram(downProg.p);
      let from: Target = src;
      for (const d of down) {
        into(d);
        bindTex(0, from.tex, downProg.u('uSrc'));
        gl.uniform2f(downProg.u('uTexel'), 1 / from.w, 1 / from.h);
        fullscreen();
        from = d;
      }
      gl.useProgram(upProg.p);
      let small: Target = down[5];
      for (let i = 4; i >= 0; i -= 1) {
        into(up[i]);
        bindTex(0, down[i].tex, upProg.u('uBase'));
        bindTex(1, small.tex, upProg.u('uSmall'));
        gl.uniform2f(upProg.u('uTexel'), 1 / small.w, 1 / small.h);
        fullscreen();
        small = up[i];
      }
      if (waveMode) {
        meterFrame += 1;
        const d = down[3];
        if (meterFrame % 4 === 0) {
          // The brightest spot of the blurred picture (1/16 size) is the beams: keep it at a steady level, so what
          // scatters off to the sides stays as faint as it really is.
          if (meter.length < d.w * d.h * 4) meter = new Float32Array(d.w * d.h * 4);
          gl.bindFramebuffer(gl.FRAMEBUFFER, d.fbo);
          gl.readPixels(0, 0, d.w, d.h, gl.RGBA, gl.FLOAT, meter);
          let peak = 0;
          for (let i = 0; i < d.w * d.h; i += 1) peak = Math.max(peak, meter[i * 4] * 0.3 + meter[i * 4 + 1] * 0.55 + meter[i * 4 + 2] * 0.15);
          if (peak > 1e-5 && Number.isFinite(peak)) waveGain = Math.min(50, Math.max(0.02, waveGain * Math.min(1.4, Math.max(0.5, Math.sqrt(0.9 / peak)))));
        }
      }
      into(null);
      gl.useProgram(compProg.p);
      bindTex(0, src.tex, compProg.u('uLight'));
      bindTex(1, up[0].tex, compProg.u('uBloom'));
      bindTex(2, up[3].tex, compProg.u('uWide'));
      bindTex(3, glass.tex, compProg.u('uGlass'));
      bindTex(4, rim.tex, compProg.u('uRim'));
      gl.uniform1f(compProg.u('uGlow'), f.glow);
      gl.uniform1f(compProg.u('uExposure'), f.exposure);
      gl.uniform1f(compProg.u('uBloomNorm'), 1 / 6);
      gl.uniform1f(compProg.u('uWideNorm'), 1 / 3);
      fullscreen();
    },
    dispose() {
      for (const t of textures) gl.deleteTexture(t);
      for (const f of framebuffers) gl.deleteFramebuffer(f);
      for (const p of programs) gl.deleteProgram(p);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
