/**
 * Backflow incense smoke over a photograph of a dragon burner, simulated and lit on the GPU (WebGL2).
 *
 * The photograph (generated, see docs/COURSE_EFFECTS.md) and the camera are fixed; a depth map of it (Depth Anything
 * V2, baked into dragon-burner-surface.png: metric depth, 16 bit, and how much each surface faces up) gives the
 * burner's shape. The smoke is a fluid in the picture's plane — stable fluids: semi-Lagrangian advection, vorticity
 * confinement, a Jacobi-solved pressure projection — that also carries its own depth (as ρ·z beside its density ρ):
 *
 *   · smoke is never behind the visible surface: wherever the surface comes nearer than the smoke, the smoke is put
 *     onto it — that is how it lands on a ledge sticking out below it;
 *   · on the surface it clings (more drag); where the surface faces up (a ledge's top, a dish's rim, the table) its
 *     weight does not pull it down the picture and it spreads out, and landing there stops its fall; on upright faces
 *     it runs down;
 *   · where the surface falls away behind it (an overhang) it is off the surface and falls freely, at its depth, till
 *     the next surface that reaches it.
 *
 * Backflow smoke is cooler and heavier than the air: its density weighs it down; thinned out it is lifted a little
 * and fades.
 *
 * Lighting, per pixel: the optical depth towards the key light (left) is marched through the smoke, with the burner
 * in the way where it is nearer than the smoke — so the smoke is lit on its left, dark in its own depth; the light it
 * scatters inside comes back as a glow (the density blurred), the milky, lit-from-within look of thick smoke; the
 * smoke's shadow darkens the ceramic and the table; fine wisps come from noise carried along the flow.
 */

export type DragonSmokeLook = {
  /** Smoke let out per second (relative). */
  rate: number;
  /** How heavy it is (1 = backflow smoke). */
  heavy: number;
  /** How long it lives, seconds. */
  life: number;
  swirl: number;
  light: number;
  shadow: number;
  glow: number;
  exposure: number;
  /** The camera (orbitControl.ts): the eye moved sideways and up (metres, the burner kept in place), closer (×). */
  cam?: [number, number, number];
};

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 o;
uniform vec2 uTexel;
uniform sampler2D uSurf;
// The burner's surface under a point: depth (m), how much it faces up, whether it is the burner (1) or the table (.5).
float surfZ(vec2 uv) { vec4 s = texture(uSurf, uv); return 0.8 + 1.6 * (s.r * 65280.0 + s.g * 255.0) / 65535.0; }
float upness(vec2 uv) { return texture(uSurf, uv).b; }
float objMask(vec2 uv) { return texture(uSurf, uv).a; }
// Below the picture: the table goes on (a floor for the smoke).
float solid(vec2 uv) { return uv.y < 0.0 ? 1.0 : 0.0; }
uniform sampler2D uDens;
float smokeZ(vec2 uv) { vec2 d = texture(uDens, uv).xy; return d.x > 1e-4 ? d.y / d.x : 9.0; }
// A floor under uv for this smoke: a ledge — a flat run of five cells looking clearly up — that the smoke has
// reached (not behind it). The rock's small bumps are no floor: smoke runs over them.
float floorBelow(vec2 uv) {
  vec2 b = uv - vec2(0.0, uTexel.y);
  if (b.y < 0.0) return 1.0;
  float zs = smokeZ(uv);
  float n = 0.0;
  for (int i = -2; i <= 2; i++) {
    vec2 q = b + vec2(float(i) * uTexel.x, 0.0);
    n += step(0.7, upness(q)) * step(surfZ(q), zs + 0.02);
  }
  return step(4.5, n);
}
`;

const CURL = `${HEAD}
uniform sampler2D uVel;
void main() {
  float l = texture(uVel, vUv - vec2(uTexel.x, 0.0)).y, r = texture(uVel, vUv + vec2(uTexel.x, 0.0)).y;
  float b = texture(uVel, vUv - vec2(0.0, uTexel.y)).x, t = texture(uVel, vUv + vec2(0.0, uTexel.y)).x;
  o = vec4(0.5 * (r - l - t + b), 0.0, 0.0, 1.0);
}`;

/** Forces: vorticity confinement, the smoke's weight along the surface, drag and clinging, the outflow, the cursor. */
const FORCE = `${HEAD}
uniform sampler2D uVel; uniform sampler2D uCurl;
uniform float uDt; uniform float uSwirl; uniform vec2 uGravity; uniform float uDrag;
uniform vec2 uSrc; uniform vec2 uSrcR; uniform vec2 uSrcVel; uniform float uRate;
uniform vec3 uPtr; uniform vec2 uPtrVel; uniform float uAspect; uniform float uTime;
void main() {
  vec2 v = texture(uVel, vUv).xy;
  float c = texture(uCurl, vUv).x;
  float cl = abs(texture(uCurl, vUv - vec2(uTexel.x, 0.0)).x), cr = abs(texture(uCurl, vUv + vec2(uTexel.x, 0.0)).x);
  float cb = abs(texture(uCurl, vUv - vec2(0.0, uTexel.y)).x), ct = abs(texture(uCurl, vUv + vec2(0.0, uTexel.y)).x);
  vec2 f = vec2(ct - cb, cr - cl);
  f /= length(f) + 1e-5;
  f *= uSwirl * c;
  f.y *= -1.0;
  vec2 dz = texture(uDens, vUv).xy;
  float rho = dz.x;
  float zs = rho > 1e-4 ? dz.y / rho : 9.0;
  float zf = surfZ(vUv);
  // On the surface (or just off it): it clings.
  float on = 1.0 - smoothstep(0.004, 0.025, zf - zs);
  vec2 acc = f + uGravity * rho - uGravity * 0.035 * smoothstep(0.15, 0.0, rho) * step(0.001, rho);
  v += acc * uDt;
  v *= exp(-(uDrag + on * 1.5) * uDt);
  // A floor under it stops the fall; its weight then spreads it sideways (through the pressure).
  if (floorBelow(vUv) > 0.5 && v.y < 0.0) v.y = 0.0;
  // Dense smoke does not climb (only the thinned-out edges drift up).
  v.y = min(v.y, mix(1e9, -uGravity.y * 0.012, smoothstep(0.08, 0.3, rho)));
  vec2 q = (vUv - uSrc) / uSrcR;
  float s = exp(-dot(q, q) * 2.0);
  v = mix(v, uSrcVel * (1.0 + 0.2 * sin(uTime * 3.1)), s * min(1.0, uRate) * 0.5);
  vec2 pq = (vUv - uPtr.xy) * vec2(uAspect, 1.0);
  v += uPtrVel * exp(-dot(pq, pq) / 0.0012) * uPtr.z;
  o = vec4(v, 0.0, 1.0);
}`;

/** Advection (velocity, or density with depth: then the smoke is kept off the far side of the surface, and fed). */
const ADVECT = `${HEAD}
uniform sampler2D uVel; uniform sampler2D uSrcTex; uniform float uDt; uniform float uDecay;
uniform vec2 uSrc; uniform vec2 uSrcR; uniform float uAdd; uniform float uIsDens;
void main() {
  vec2 v = texture(uVel, vUv).xy;
  // Velocities are in cells per second (the cells are square: 1.25 mm).
  vec2 p = vUv - v * uDt * uTexel;
  vec4 val = texture(uSrcTex, p) * uDecay;
  if (uIsDens > 0.5) {
    float zf = surfZ(vUv);
    float rho = val.x;
    float zs = rho > 1e-5 ? val.y / rho : zf;
    zs = min(zs, zf - 0.003);
    vec2 q = (vUv - uSrc) / uSrcR;
    float add = uAdd * exp(-dot(q, q) * 2.0);
    val.x = rho + add;
    val.y = rho * zs + add * (zf - 0.003);
    if (solid(vUv) > 0.5) val = vec4(0.0);
  }
  o = val;
}`;

const DIVERGENCE = `${HEAD}
uniform sampler2D uVel;
void main() {
  vec2 c = texture(uVel, vUv).xy;
  vec2 L = vUv - vec2(uTexel.x, 0.0), R = vUv + vec2(uTexel.x, 0.0), B = vUv - vec2(0.0, uTexel.y), T = vUv + vec2(0.0, uTexel.y);
  float l = texture(uVel, L).x, r = texture(uVel, R).x;
  float b = floorBelow(vUv) > 0.5 ? -c.y : texture(uVel, B).y;
  float t = texture(uVel, T).y;
  o = vec4(0.5 * (r - l + t - b), 0.0, 0.0, 1.0);
}`;

const PRESSURE = `${HEAD}
uniform sampler2D uPres; uniform sampler2D uDiv;
void main() {
  float c = texture(uPres, vUv).x;
  vec2 B = vUv - vec2(0.0, uTexel.y);
  float l = texture(uPres, vUv - vec2(uTexel.x, 0.0)).x, r = texture(uPres, vUv + vec2(uTexel.x, 0.0)).x;
  float b = floorBelow(vUv) > 0.5 ? c : texture(uPres, B).x;
  float t = texture(uPres, vUv + vec2(0.0, uTexel.y)).x;
  o = vec4((l + r + b + t - texture(uDiv, vUv).x) * 0.25, 0.0, 0.0, 1.0);
}`;

const GRADIENT = `${HEAD}
uniform sampler2D uPres; uniform sampler2D uVel;
void main() {
  float c = texture(uPres, vUv).x;
  vec2 B = vUv - vec2(0.0, uTexel.y);
  float l = texture(uPres, vUv - vec2(uTexel.x, 0.0)).x, r = texture(uPres, vUv + vec2(uTexel.x, 0.0)).x;
  float b = floorBelow(vUv) > 0.5 ? c : texture(uPres, B).x;
  float t = texture(uPres, vUv + vec2(0.0, uTexel.y)).x;
  o = vec4(texture(uVel, vUv).xy - 0.5 * 0.55 * vec2(r - l, t - b), 0.0, 1.0);
}`;

const BLUR = `${HEAD}
uniform sampler2D uSrcTex; uniform vec2 uStep;
void main() {
  float c = texture(uSrcTex, vUv).x * 0.227027;
  for (int i = 1; i <= 4; i++) {
    float w = i == 1 ? 0.1945946 : i == 2 ? 0.1216216 : i == 3 ? 0.054054 : 0.016216;
    c += (texture(uSrcTex, vUv + uStep * float(i)).x + texture(uSrcTex, vUv - uStep * float(i)).x) * w;
  }
  o = vec4(c, 0.0, 0.0, 1.0);
}`;

/** 1/depth on the simulation's grid (then blurred): for the camera's parallax. */
const LAMBDA = `${HEAD}
void main() { o = vec4(1.0 / surfZ(vUv), 0.0, 0.0, 1.0); }`;

/** The picture: the photograph, the smoke lit and self-shadowed over it, its shadow on the burner. */
const COMPOSE = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uPhoto; uniform sampler2D uDens; uniform sampler2D uGlowTex; uniform sampler2D uVel; uniform sampler2D uSurf;
uniform vec2 uScale; uniform float uTime; uniform float uAspect;
uniform float uLight; uniform float uShadow; uniform float uGlow; uniform float uExposure;
// The camera: how far a point moves per dioptre (1/z) as the eye moves (uv), and closer (×).
uniform vec3 uCam;
float surfZ(vec2 uv) { vec4 s = texture(uSurf, uv); return 0.8 + 1.6 * (s.r * 65280.0 + s.g * 255.0) / 65535.0; }
// 1/depth, smoothed (made once, see LAMBDA): the camera's parallax follows it, so where the depth jumps (the burner
// against the wall) the picture stretches softly instead of tearing into streaks.
uniform sampler2D uLam;
// The eye moved: the photograph's point now seen at uv — a point at depth z moves by uCam.xy · (1/z − 1/1.2), so march
// 1/z from near to far and take the first surface met (the nearest; what the move uncovers is smeared from beside it).
vec2 parallax(vec2 uv) {
  const float Z0 = 1.0 / 1.2;
  float prev = 1.25;
  vec2 prevS = uv - uCam.xy * (prev - Z0);
  float prevD = texture(uLam, prevS).x - prev;
  for (int i = 1; i <= 40; i++) {
    float lam = mix(1.25, 0.4, float(i) / 40.0);
    vec2 s = uv - uCam.xy * (lam - Z0);
    float d = texture(uLam, s).x - lam;
    if (d >= 0.0) {
      float f = prevD / max(prevD - d, 1e-5);
      return mix(prevS, s, clamp(f, 0.0, 1.0));
    }
    prev = lam;
    prevS = s;
    prevD = d;
  }
  return prevS;
}
float hh(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float nz(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hh(i), hh(i + vec3(1, 0, 0)), f.x), mix(hh(i + vec3(0, 1, 0)), hh(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hh(i + vec3(0, 0, 1)), hh(i + vec3(1, 0, 1)), f.x), mix(hh(i + vec3(0, 1, 1)), hh(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int k = 0; k < 4; k++) { s += a * nz(p); p *= 2.07; a *= 0.5; } return s; }
vec3 toSrgb(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  vec2 uv = 0.5 + (vUv - 0.5) * uScale / uCam.z;
  if (uCam.x != 0.0 || uCam.y != 0.0) uv = parallax(uv);
  vec3 photo = texture(uPhoto, vec2(uv.x, 1.0 - uv.y)).rgb;
  vec2 vel = texture(uVel, uv).xy;
  vec2 dz = texture(uDens, uv).xy;
  float d0 = dz.x;
  float zs = d0 > 1e-4 ? dz.y / d0 : 9.0;
  // Wisps: noise carried a little along the flow sharpens the edges and breaks thin smoke.
  vec3 np = vec3(uv * vec2(uAspect, 1.0) * 16.0 - vel * 0.004, uTime * 0.18);
  float w = fbm(np) * 0.65 + fbm(np * 2.3 + 4.1) * 0.35;
  float d = max(0.0, d0 * (0.7 + 0.6 * w) - 0.012);
  // Towards the key light (upper left): the smoke's own depth, and the burner in the way where it is nearer.
  vec2 ld = normalize(vec2(-1.0, 0.42)) * vec2(1.0 / uAspect, 1.0) * 0.011;
  float tau = 0.0;
  float block = 0.0;
  for (int i = 1; i <= 16; i++) {
    vec2 q = uv + ld * float(i);
    tau += texture(uDens, q).x;
    if (d0 > 0.002) block = max(block, step(surfZ(q), zs - 0.015) * (1.0 - float(i) / 20.0));
  }
  float T = exp(-tau * 0.55) * (1.0 - 0.7 * block);
  vec3 key = vec3(1.0, 0.95, 0.88) * uLight;
  vec3 amb = vec3(0.075, 0.078, 0.09);
  float glow = texture(uGlowTex, uv).x;
  vec3 smoke = amb * (0.8 + 0.6 * d) + key * T * (0.55 + 0.25 * w) + key * glow * 0.35 * uGlow;
  float alpha = 1.0 - exp(-d * 3.4);
  // The smoke's shadow on the burner and the table.
  float obj = texture(uSurf, uv).a;
  float sh = 1.0 - uShadow * 0.45 * (1.0 - exp(-tau * 0.35)) * (0.35 + 0.65 * obj);
  vec3 col = photo * sh * (1.0 - alpha) + smoke * alpha;
  col += photo * key * glow * 0.12 * uGlow;
  o = vec4(toSrgb(col * uExposure), 1.0);
}`;

export function createDragonSmoke(width: number, height: number, photo: HTMLImageElement, surface: HTMLImageElement) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) return null;
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    return s;
  };
  const vert = compile(gl.VERTEX_SHADER, VERT);
  const program = (src: string) => {
    const p = gl.createProgram()!;
    gl.attachShader(p, vert);
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, src));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
    const cache = new Map<string, WebGLUniformLocation | null>();
    return { p, u: (n: string) => { if (!cache.has(n)) cache.set(n, gl.getUniformLocation(p, n)); return cache.get(n)!; } };
  };
  const P = {
    curl: program(CURL), force: program(FORCE), advect: program(ADVECT), div: program(DIVERGENCE),
    pres: program(PRESSURE), grad: program(GRADIENT), blur: program(BLUR), compose: program(COMPOSE), lambda: program(LAMBDA),
  };
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // The simulation grid: the photograph's proportions (it is 1344 × 768).
  const SW = 336, SH = 192;
  const field = () => {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, SW, SH, 0, gl.RGBA, gl.HALF_FLOAT, null);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { t, fb };
  };
  const pair = () => {
    let a = field(), b = field();
    return { get read() { return a; }, get write() { return b; }, swap() { const x = a; a = b; b = x; } };
  };
  const vel = pair(), dens = pair(), pres = pair();
  const div = field(), curl = field(), blurA = field(), blurB = field();
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const image = (img: HTMLImageElement, srgb: boolean, flip: boolean, nearest: boolean) => {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flip);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, nearest ? gl.NEAREST : gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, nearest ? gl.NEAREST : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
    if (!nearest) gl.generateMipmap(gl.TEXTURE_2D);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    return t;
  };
  // The photograph (sampled flipped in the shader) and the surface (uv with y up, raw bytes: no colour conversion).
  const photoTex = image(photo, true, false, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  const surfTex = image(surface, false, true, true);

  const texel = [1 / SW, 1 / SH];
  // (lamA, lamB: 1/depth smoothed, made below once `run` is there)
  const lamA = field(), lamB = field();
  const run = (prog: { p: WebGLProgram; u: (n: string) => WebGLUniformLocation | null }, out: { fb: WebGLFramebuffer } | null, inputs: Record<string, WebGLTexture>, set?: (u: (n: string) => WebGLUniformLocation | null) => void) => {
    gl.useProgram(prog.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.fb : null);
    gl.viewport(0, 0, out ? SW : canvas.width, out ? SH : canvas.height);
    let unit = 0;
    for (const [name, t] of Object.entries({ uSurf: surfTex, ...inputs })) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.uniform1i(prog.u(name), unit);
      unit += 1;
    }
    gl.uniform2f(prog.u('uTexel'), texel[0], texel[1]);
    set?.(prog.u);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  run(P.lambda, lamA, {});
  for (let k = 0; k < 2; k += 1) {
    run(P.blur, lamB, { uSrcTex: lamA.t }, (u) => gl.uniform2f(u('uStep'), 1.5 / SW, 0));
    run(P.blur, lamA, { uSrcTex: lamB.t }, (u) => gl.uniform2f(u('uStep'), 0, 1.5 / SH));
  }
  const photoAspect = photo.naturalWidth / photo.naturalHeight;
  /** The smoke's source: the top dish's top, under the dragon (photograph uv, y up), and its outflow. */
  const SRC = [600 / 1344, 1 - 193 / 768];
  // The picture is ~0.42 m wide (an 85 mm lens at a metre): cells per metre.
  const M = SW / 0.42;

  return {
    canvas,
    /** One step of the smoke and a frame. pointer: uv of the photograph (y up) with the pointer's uv velocity. */
    frame(dt: number, time: number, look: DragonSmokeLook, pointer: { x: number; y: number; vx: number; vy: number; active: boolean }) {
      const cw = canvas.width, ch = canvas.height;
      const A = cw / ch;
      const scale = A >= photoAspect ? [1, photoAspect / A] : [A / photoAspect, 1];
      simulate(dt, time, look, pointer);
      run(P.blur, blurA, { uSrcTex: dens.read.t }, (u) => gl.uniform2f(u('uStep'), 3 / SW, 0));
      run(P.blur, blurB, { uSrcTex: blurA.t }, (u) => gl.uniform2f(u('uStep'), 0, 3 / SH));
      run(P.compose, null, { uPhoto: photoTex, uDens: dens.read.t, uGlowTex: blurB.t, uVel: vel.read.t, uLam: lamA.t }, (u) => {
        gl.uniform2f(u('uScale'), scale[0], scale[1]);
        gl.uniform1f(u('uTime'), time);
        gl.uniform1f(u('uAspect'), photoAspect);
        gl.uniform1f(u('uLight'), look.light);
        gl.uniform1f(u('uShadow'), look.shadow);
        gl.uniform1f(u('uGlow'), look.glow);
        gl.uniform1f(u('uExposure'), look.exposure);
        const cam = look.cam ?? [0, 0, 1];
        // The picture is ~0.42 m wide at a metre: the eye's move in uv per dioptre.
        gl.uniform3f(u('uCam'), -cam[0] / 0.42, -cam[1] / (0.42 / photoAspect), cam[2]);
      });
    },
    /** Let the smoke run for a while unseen (so it is already flowing when the picture first shows). */
    warm(seconds: number, look: DragonSmokeLook) {
      const still = { x: 0, y: 0, vx: 0, vy: 0, active: false };
      for (let t = 0; t < seconds; t += 1 / 60) simulate(1 / 60, t, look, still);
    },
    /** Photograph uv (y up) under a canvas point (css px of a canvas cw × ch). */
    toPhoto(x: number, y: number, cw: number, ch: number, zoom = 1) {
      const A = cw / ch;
      const scale = A >= photoAspect ? [1, photoAspect / A] : [A / photoAspect, 1];
      return [0.5 + ((x / cw - 0.5) * scale[0]) / zoom, 0.5 + ((0.5 - y / ch) * scale[1]) / zoom] as [number, number];
    },
    dispose() {
      for (const f of [vel.read, vel.write, dens.read, dens.write, pres.read, pres.write, div, curl, blurA, blurB, lamA, lamB]) {
        gl.deleteTexture(f.t);
        gl.deleteFramebuffer(f.fb);
      }
      gl.deleteTexture(photoTex);
      gl.deleteTexture(surfTex);
      gl.deleteBuffer(buf);
      gl.deleteVertexArray(vao);
      for (const p of Object.values(P)) gl.deleteProgram(p.p);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };

  function simulate(dt: number, time: number, look: DragonSmokeLook, pointer: { x: number; y: number; vx: number; vy: number; active: boolean }) {
    // (A function declaration does not see the null check above.)
    const ctx = gl!;
      const steps = 2;
      const h = Math.min(dt, 1 / 30) / steps;
      for (let s = 0; s < steps; s += 1) {
        run(P.curl, curl, { uVel: vel.read.t });
        run(P.force, vel.write, { uVel: vel.read.t, uCurl: curl.t, uDens: dens.read.t }, (u) => {
          ctx.uniform1f(u('uDt'), h);
          ctx.uniform1f(u('uSwirl'), look.swirl * 0.8);
          ctx.uniform2f(u('uGravity'), 0, -0.9 * look.heavy * M);
          ctx.uniform1f(u('uDrag'), 2.2);
          ctx.uniform2f(u('uSrc'), SRC[0], SRC[1]);
          ctx.uniform2f(u('uSrcR'), 0.016, 0.016 * photoAspect * 0.6);
          ctx.uniform2f(u('uSrcVel'), 0.03 * M, -0.02 * M);
          ctx.uniform1f(u('uRate'), look.rate);
          ctx.uniform3f(u('uPtr'), pointer.x, pointer.y, pointer.active ? 1 : 0);
          ctx.uniform2f(u('uPtrVel'), pointer.vx * SW * 0.25, pointer.vy * SH * 0.25);
          ctx.uniform1f(u('uAspect'), photoAspect);
          ctx.uniform1f(u('uTime'), time);
        });
        vel.swap();
        run(P.advect, vel.write, { uVel: vel.read.t, uSrcTex: vel.read.t }, (u) => {
          ctx.uniform1f(u('uDt'), h);
          ctx.uniform1f(u('uDecay'), 1);
          ctx.uniform1f(u('uIsDens'), 0);
        });
        vel.swap();
        run(P.div, div, { uVel: vel.read.t, uDens: dens.read.t });
        // A soft projection: in 3D the air slips round a thin stream of smoke instead of being pushed back as round
        // the endless slab a plane flow would make of it — so the pressure is only partly solved and half applied.
        for (let k = 0; k < 8; k += 1) {
          run(P.pres, pres.write, { uPres: pres.read.t, uDiv: div.t, uDens: dens.read.t });
          pres.swap();
        }
        run(P.grad, vel.write, { uPres: pres.read.t, uVel: vel.read.t, uDens: dens.read.t });
        vel.swap();
        run(P.advect, dens.write, { uVel: vel.read.t, uSrcTex: dens.read.t }, (u) => {
          ctx.uniform1f(u('uDt'), h);
          ctx.uniform1f(u('uDecay'), Math.exp(-h / Math.max(0.5, look.life)));
          ctx.uniform1f(u('uIsDens'), 1);
          ctx.uniform1f(u('uAdd'), look.rate * h * 3.2);
          ctx.uniform2f(u('uSrc'), SRC[0], SRC[1]);
          ctx.uniform2f(u('uSrcR'), 0.013, 0.013 * photoAspect * 0.6);
        });
        dens.swap();
      }
  }
}

export type DragonSmoke = NonNullable<ReturnType<typeof createDragonSmoke>>;
