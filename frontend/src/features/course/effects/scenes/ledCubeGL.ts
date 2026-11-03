import { FULL_VS, TONEMAP_GLSL, createKit, type Target } from './glKit';

/**
 * WebGL2 renderer of a real-looking 20³ LED cube (ledCube.ts drives it).
 *
 * - Every LED is a clear epoxy capsule traced per pixel on a camera-facing quad (ray–capsule intersection): a Fresnel
 *   sheen with the studio lights and the neighbours' glow in it, and, when lit, the light of the die scattered in
 *   the epoxy with a hot core that moves as the cube turns. LEDs a few pixels small are drawn as soft dots instead.
 * - The LEDs' light is kept in a 20³ volume texture (uploaded every frame, with mip levels for a blurred version):
 *   the soldered wire lattice, the unlit LEDs and the circuit board below are lit from it, so light spills around.
 * - The glossy board reflects the cube (the LEDs drawn a second time, mirrored, only where the board is under them).
 * - All of it is added up in linear light, then a bloom pyramid and a filmic tone curve.
 */

export const LED_N = 20;
/** LED capsule radius and half length, and wire radius, in cube units (the cube spans −1…1). */
const SPACING = 2 / (LED_N - 1);
const LED_R = SPACING * 0.17;
const LED_H = SPACING * 0.12;
const WIRE_R = SPACING * 0.022;
export const BOARD_Y = -1 - SPACING * 0.9;
const BOARD_HALF = 1 + SPACING * 1.4;
const f = (n: number) => n.toFixed(5);

const COMMON = `
precision highp float;
precision highp sampler3D;
uniform sampler3D uVol;
uniform mat3 uRot;
uniform float uDist;
uniform vec2 uPrincipal;
uniform float uFocal;
uniform vec2 uRes;
uniform float uPeak;
uniform float uStore;
const int N = ${LED_N};
const float LED_R = ${f(LED_R)};
const float LED_H = ${f(LED_H)};
const float WIRE_R = ${f(WIRE_R)};
const float BOARD_Y = ${f(BOARD_Y)};
const float BOARD_HALF = ${f(BOARD_HALF)};
vec3 toView(vec3 m) { vec3 v = uRot * m; v.z -= uDist; return v; }
vec4 clipOf(vec3 v) {
  float w = -v.z;
  return vec4(((uPrincipal + uFocal * v.xy / w) / uRes * 2.0 - 1.0) * w, 0.0, w);
}
vec3 volUv(vec3 m) { return ((m * 0.5 + 0.5) * float(N - 1) + 0.5) / float(N); }
vec3 volLight(vec3 m, float lod) { return textureLod(uVol, volUv(m), lod).rgb * uPeak; }
/** A small studio fixed to the camera: a softbox up left, a strip light right, a dark room. */
vec3 studio(vec3 r) {
  float key = smoothstep(0.9, 0.985, dot(r, normalize(vec3(-0.55, 0.65, 0.55))));
  float strip = smoothstep(0.93, 0.99, dot(r, normalize(vec3(0.8, 0.15, 0.55))));
  return vec3(1.6, 1.55, 1.5) * key + vec3(0.5, 0.55, 0.65) * strip + vec3(0.012, 0.012, 0.016);
}
`;

const LED_VS = `#version 300 es
${COMMON}
uniform float uMirror;
out vec3 vPos;
out vec3 vCenter;
out vec3 vUp;
out vec3 vLight;
out vec3 vModel;
out float vPx;
out vec2 vCenterPx;
void main() {
  int id = gl_InstanceID;
  ivec3 c = ivec3(id % N, (id / N) % N, id / (N * N));
  vec3 m = vec3(c) / float(N - 1) * 2.0 - 1.0;
  vModel = m;
  vec3 up = vec3(0.0, 1.0, 0.0);
  if (uMirror > 0.5) { m.y = 2.0 * BOARD_Y - m.y; up = -up; }
  vLight = texelFetch(uVol, c, 0).rgb * uPeak;
  vec3 center = toView(m);
  vCenter = center;
  vUp = uRot * up;
  float w = -center.z;
  float reach = (LED_R + LED_H) * 1.3;
  vPx = LED_R * uFocal / w;
  // Tiny LEDs are drawn as soft dots at least ~1.6 px across, so they don't shimmer.
  float grow = max(1.0, 1.6 / max(vPx, 1e-3));
  vec2 q = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
  vec3 corner = center + vec3(q * reach * grow, 0.0);
  vPos = corner;
  vCenterPx = uPrincipal + uFocal * center.xy / w;
  gl_Position = clipOf(corner);
}`;

const LED_FS = `#version 300 es
${COMMON}
uniform float uMirror;
uniform float uMirrorGain;
in vec3 vPos;
in vec3 vCenter;
in vec3 vUp;
in vec3 vLight;
in vec3 vModel;
in float vPx;
in vec2 vCenterPx;
out vec4 o;

float capsule(vec3 ro, vec3 rd, vec3 pa, vec3 pb, float r) {
  vec3 ba = pb - pa;
  vec3 oa = ro - pa;
  float baba = dot(ba, ba);
  float bard = dot(ba, rd);
  float baoa = dot(ba, oa);
  float rdoa = dot(rd, oa);
  float oaoa = dot(oa, oa);
  float a = baba - bard * bard;
  float b = baba * rdoa - baoa * bard;
  float c = baba * oaoa - baoa * baoa - r * r * baba;
  float h = b * b - a * c;
  if (h >= 0.0) {
    float t = (-b - sqrt(h)) / a;
    float y = baoa + t * bard;
    if (y > 0.0 && y < baba) return t;
    vec3 oc = (y <= 0.0) ? oa : ro - pb;
    b = dot(rd, oc);
    c = dot(oc, oc) - r * r;
    h = b * b - c;
    if (h > 0.0) return -b - sqrt(h);
  }
  return -1.0;
}

void main() {
  vec3 rd = normalize(vPos);
  float mirrorGain = 1.0;
  if (uMirror > 0.5) {
    // The reflection is only seen through the board: the view ray must meet it inside its edges.
    vec3 p0 = toView(vec3(0.0, BOARD_Y, 0.0));
    vec3 nb = uRot * vec3(0.0, 1.0, 0.0);
    float tb = dot(p0, nb) / dot(rd, nb);
    vec3 hit = transpose(uRot) * (rd * tb - vec3(0.0, 0.0, -uDist));
    if (tb <= 0.0 || abs(hit.x) > BOARD_HALF || abs(hit.z) > BOARD_HALF) discard;
    float cosb = abs(dot(rd, nb));
    mirrorGain = uMirrorGain * (0.35 + 0.65 * pow(1.0 - cosb, 3.0));
  }
  vec3 near = volLight(vModel, 1.3);
  if (vPx < 2.2) {
    // A soft dot: the LED's light, a hint of the neighbours' glow on its epoxy.
    float d = length(gl_FragCoord.xy - vCenterPx) / max(vPx * 1.3, 0.8);
    float dot_ = exp(-d * d * 1.6);
    if (dot_ < 0.01) discard;
    vec3 col = (vLight * 1.2 + near * 0.05 + vec3(0.003)) * dot_;
    o = vec4(col * mirrorGain * uStore, 0.0);
    return;
  }
  vec3 a = vCenter - vUp * LED_H;
  vec3 b = vCenter + vUp * LED_H;
  float t = capsule(vec3(0.0), rd, a, b, LED_R);
  if (t < 0.0) discard;
  vec3 p = rd * t;
  vec3 ba = b - a;
  float hh = clamp(dot(p - a, ba) / dot(ba, ba), 0.0, 1.0);
  vec3 n = (p - a - hh * ba) / LED_R;
  float cosv = max(dot(n, -rd), 0.0);
  float fres = 0.04 + 0.96 * pow(1.0 - cosv, 5.0);
  // The die sits low in the epoxy; the dome above it spreads its light, brightest where the eye looks through it.
  vec3 die = vCenter - vUp * (LED_H * 0.35);
  float d = length(cross(die, rd));
  float core = exp(-pow(d / (LED_R * 0.42), 2.0));
  vec3 lit = vLight * (1.0 - fres) * (0.3 + 2.4 * core);
  // Clear epoxy: what it reflects (the studio, the glow around it) and a little of that glow scattered inside.
  vec3 r = reflect(rd, n);
  vec3 sheen = fres * (studio(r) + near * 0.5) + near * 0.05 * (1.0 - fres);
  // The dark die and its silver cup, seen through an unlit LED.
  float cup = exp(-pow(d / (LED_R * 0.3), 2.0));
  vec3 inside = vec3(0.025, 0.026, 0.03) * cup * (1.0 - fres);
  o = vec4((lit + sheen + inside) * mirrorGain * uStore, 0.0);
}`;

const WIRE_VS = `#version 300 es
${COMMON}
out vec3 vModel;
out float vCover;
out float vAcross;
void main() {
  int id = gl_InstanceID;
  vec3 a;
  vec3 b;
  float s = 2.0 / float(N - 1);
  if (id < N * N) {
    // Vertical columns (the anodes), from the board up to the top layer.
    int i = id % N;
    int k = id / N;
    a = vec3(float(i) * s - 1.0, BOARD_Y, float(k) * s - 1.0);
    b = vec3(a.x, 1.0 + LED_H, a.z);
  } else {
    // Rows in every layer (the cathodes), along x.
    int j = (id - N * N) / N;
    int k = (id - N * N) % N;
    a = vec3(-1.0, float(j) * s - 1.0 - LED_H - LED_R * 0.6, float(k) * s - 1.0);
    b = vec3(1.0, a.y, a.z);
  }
  float along = float(gl_VertexID >> 1);
  float side = float(gl_VertexID & 1) * 2.0 - 1.0;
  vec3 va = toView(a);
  vec3 vb = toView(b);
  vec2 pa = uPrincipal + uFocal * va.xy / -va.z;
  vec2 pb = uPrincipal + uFocal * vb.xy / -vb.z;
  vec2 dir = normalize(pb - pa + 1e-6);
  vec2 nrm = vec2(-dir.y, dir.x);
  vec3 v = mix(va, vb, along);
  float truePx = WIRE_R * uFocal / -v.z;
  float halfPx = max(truePx, 0.7);
  vCover = truePx / halfPx;
  vAcross = side;
  vModel = mix(a, b, along);
  vec2 px = mix(pa, pb, along) + nrm * side * halfPx;
  float w = -v.z;
  gl_Position = vec4((px / uRes * 2.0 - 1.0) * w, 0.0, w);
}`;

const WIRE_FS = `#version 300 es
${COMMON}
in vec3 vModel;
in float vCover;
in float vAcross;
out vec4 o;
void main() {
  // Tinned copper wire: a bright line down its middle where the LEDs around it light it.
  float round_ = sqrt(max(0.0, 1.0 - vAcross * vAcross));
  vec3 light = volLight(vModel, 0.6) * 0.5 + vec3(0.0045, 0.0045, 0.005);
  o = vec4(light * (0.25 + 0.75 * round_) * vCover * uStore, 0.0);
}`;

const BOARD_VS = `#version 300 es
${COMMON}
out vec3 vModel;
out vec3 vView;
void main() {
  vec2 q = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
  vModel = vec3(q.x * BOARD_HALF, BOARD_Y, q.y * BOARD_HALF);
  vView = toView(vModel);
  gl_Position = clipOf(vView);
}`;

const BOARD_FS = `#version 300 es
${COMMON}
in vec3 vModel;
in vec3 vView;
out vec4 o;
void main() {
  // Black solder mask: the light of the bottom layers pools on it; tinned pads where the columns go in.
  vec3 spill = volLight(vec3(vModel.x, -1.0, vModel.z), 2.2) * 0.35 + volLight(vec3(vModel.x, -0.6, vModel.z), 3.0) * 0.2;
  float s = 2.0 / float(N - 1);
  vec2 cell = abs(fract((vModel.xz + 1.0) / s + 0.5) - 0.5) * s;
  float inside = step(abs(vModel.x), 1.0 + s * 0.3) * step(abs(vModel.z), 1.0 + s * 0.3);
  float pad = inside * smoothstep(LED_R * 0.9, LED_R * 0.6, length(cell));
  vec3 nb = uRot * vec3(0.0, 1.0, 0.0);
  vec3 rd = normalize(vView);
  float fres = 0.04 + 0.96 * pow(1.0 - abs(dot(rd, nb)), 5.0);
  vec3 base = vec3(0.006, 0.008, 0.008) + spill * 0.08;
  vec3 col = base + pad * (spill * 0.5 + studio(reflect(rd, nb)) * 0.12) + fres * studio(reflect(rd, nb)) * 0.05;
  // A soft edge, so the board doesn't end in a hard line.
  float edge = smoothstep(BOARD_HALF, BOARD_HALF - s * 0.6, max(abs(vModel.x), abs(vModel.z)));
  o = vec4(col * edge * uStore, edge);
}`;

const COMPOSITE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform vec3 uBgTop;
uniform vec3 uBgBottom;
uniform float uExposure;
uniform float uStore;
uniform float uBloomGain;
out vec4 o;
${TONEMAP_GLSL}
void main() {
  vec4 s = texture(uScene, vUv);
  vec3 bloom = texture(uBloom, vUv).rgb;
  vec3 bg = mix(uBgBottom, uBgTop, vUv.y);
  vec3 col = bg * (1.0 - s.a) + (s.rgb + bloom * uBloomGain) / uStore;
  o = vec4(toSrgb(aces(col * uExposure)), 1.0);
}`;

export type LedFrame = {
  /** Cube → view rotation, column major. */
  rot: Float32Array;
  exposure: number;
  /** Draw the reflection in the board. */
  mirror: boolean;
  /** × the focal length (the camera control's zoom; 1 when left out). */
  zoom?: number;
};

export type LedCubeRenderer = {
  canvas: HTMLCanvasElement;
  /** `volume`: N³ × RGBA8, x fastest, then y, then z; rgb = colour × brightness. */
  render(volume: Uint8Array, frame: LedFrame): void;
  dispose(): void;
};

/** `width`/`height` in device px; `center` where the cube's middle lands (device px from the bottom left); `size` the cube's half size there, px. */
export function createLedCubeRenderer(opts: {
  width: number;
  height: number;
  center: [number, number];
  size: number;
  background: [[number, number, number], [number, number, number]];
}): LedCubeRenderer | null {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.round(opts.width));
  canvas.height = Math.max(2, Math.round(opts.height));
  const kit = createKit(canvas, 'led-cube');
  if (!kit) return null;
  const { gl } = kit;
  const W = canvas.width;
  const H = canvas.height;
  const DIST = 5.4;
  const focal = opts.size * DIST;
  // Without half-float targets bright light is stored at 1/8 and scaled back when composited.
  const store = kit.hdr ? 1 : 0.125;

  const ledProg = kit.program(LED_VS, LED_FS);
  const wireProg = kit.program(WIRE_VS, WIRE_FS);
  const boardProg = kit.program(BOARD_VS, BOARD_FS);
  const compProg = kit.program(FULL_VS, COMPOSITE_FS);
  const scene = kit.target(W, H);
  const bloom = kit.bloom(W, H, 5);
  if (!ledProg || !wireProg || !boardProg || !compProg || !scene || !bloom) {
    kit.dispose();
    return null;
  }
  const vol = kit.track.texture(gl.createTexture()!);
  gl.bindTexture(gl.TEXTURE_3D, vol);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  for (const wrap of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, wrap, gl.CLAMP_TO_EDGE);
  gl.texStorage3D(gl.TEXTURE_3D, 5, gl.RGBA8, LED_N, LED_N, LED_N);
  const vao = kit.track.vao(gl.createVertexArray()!);

  let zoom = 1;
  const common = (prog: NonNullable<typeof ledProg>, rot: Float32Array) => {
    gl.useProgram(prog.p);
    kit.bind(0, vol, prog.u('uVol'), gl.TEXTURE_3D);
    gl.uniformMatrix3fv(prog.u('uRot'), false, rot);
    gl.uniform1f(prog.u('uDist'), DIST);
    gl.uniform2f(prog.u('uPrincipal'), opts.center[0], opts.center[1]);
    gl.uniform1f(prog.u('uFocal'), focal * zoom);
    gl.uniform2f(prog.u('uRes'), W, H);
    gl.uniform1f(prog.u('uPeak'), 7);
    gl.uniform1f(prog.u('uStore'), store);
  };

  return {
    canvas,
    render(volume, frame) {
      if (kit.lost()) return;
      zoom = frame.zoom ?? 1;
      gl.bindTexture(gl.TEXTURE_3D, vol);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, 0, LED_N, LED_N, LED_N, gl.RGBA, gl.UNSIGNED_BYTE, volume);
      gl.generateMipmap(gl.TEXTURE_3D);
      kit.into(scene);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindVertexArray(vao);
      // The board first (it hides the background), then everything that shines, added up.
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      common(boardProg, frame.rot);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
      common(ledProg, frame.rot);
      if (frame.mirror) {
        gl.uniform1f(ledProg.u('uMirror'), 1);
        gl.uniform1f(ledProg.u('uMirrorGain'), 0.3);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, LED_N ** 3);
      }
      common(wireProg, frame.rot);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, LED_N * LED_N * 2);
      common(ledProg, frame.rot);
      gl.uniform1f(ledProg.u('uMirror'), 0);
      gl.uniform1f(ledProg.u('uMirrorGain'), 1);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, LED_N ** 3);
      gl.disable(gl.BLEND);
      const glow: Target = bloom.run(scene);
      kit.into(null);
      gl.useProgram(compProg.p);
      kit.bind(0, scene.tex, compProg.u('uScene'));
      kit.bind(1, glow.tex, compProg.u('uBloom'));
      gl.uniform3f(compProg.u('uBgTop'), ...opts.background[0]);
      gl.uniform3f(compProg.u('uBgBottom'), ...opts.background[1]);
      gl.uniform1f(compProg.u('uExposure'), frame.exposure);
      gl.uniform1f(compProg.u('uStore'), store);
      gl.uniform1f(compProg.u('uBloomGain'), 0.9 / bloom.levels);
      kit.fullscreen();
    },
    dispose() {
      kit.dispose();
    },
  };
}
