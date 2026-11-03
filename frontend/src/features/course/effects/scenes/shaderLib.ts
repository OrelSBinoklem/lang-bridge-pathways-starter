/**
 * The common part of every shader scene: uniforms, noise, and a `main` that calls the scene's
 *   vec3 scene(vec2 uv, vec2 P, vec2 M, float t)
 * uv: 0..1 across the picture (y up); P: centred, aspect-corrected, y from -1 to 1; M: the cursor in P's space (it
 * wanders when nobody points); t: time already scaled by the speed slider.
 * Also available: uPal[0..3] (the palette), uK.y (intensity), uK.z (reaction to the cursor), uPointer.z (a real cursor
 * is over the picture), uPointer.w (button down), uVel (cursor speed), trail(P, radius) (a glow along the cursor's path).
 */
export const SHADER_VERTEX = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export const SHADER_HEADER = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec4 uPointer;
uniform vec2 uVel;
uniform vec3 uPal[4];
uniform vec4 uK;
uniform vec3 uTrail[12];
out vec4 outColor;

float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
  return s;
}
float fbm3(vec2 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 3; i++) { s += a * noise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
  return s;
}
mat2 rot(float a) { float c = cos(a); float s = sin(a); return mat2(c, -s, s, c); }
vec3 hueShift(vec3 c, float deg) {
  float a = radians(deg);
  vec3 k = vec3(0.57735);
  float cs = cos(a);
  float sn = sin(a);
  return c * cs + cross(k, c) * sn + k * dot(k, c) * (1.0 - cs);
}
float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
vec2 toP(vec2 uvTopLeft) {
  float asp = uRes.x / uRes.y;
  return vec2((uvTopLeft.x - 0.5) * asp * 2.0, (0.5 - uvTopLeft.y) * 2.0);
}
// A glow along the path the cursor has taken lately (fading with age).
float trail(vec2 P, float r) {
  float s = 0.0;
  for (int i = 0; i < 12; i++) {
    vec3 t = uTrail[i];
    if (t.z < 0.0) continue;
    vec2 q = toP(t.xy);
    s += exp(-t.z * 1.6) * exp(-dot(P - q, P - q) / (r * r));
  }
  return s;
}
vec3 pal(float x) {
  x = clamp(x, 0.0, 1.0) * 3.0;
  return mix(mix(uPal[0], uPal[1], clamp(x, 0.0, 1.0)), mix(uPal[2], uPal[3], clamp(x - 2.0, 0.0, 1.0)), smoothstep(1.0, 2.0, x));
}
`;

export const SHADER_MAIN = `
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float asp = uRes.x / uRes.y;
  vec2 P = (uv - 0.5) * vec2(asp, 1.0) * 2.0;
  vec2 M = toP(uPointer.xy);
  float t = uTime * uK.x;
  vec3 c = scene(uv, P, M, t);
  c = hueShift(c, uK.w);
  c = max(c, 0.0);
  outColor = vec4(pow(c, vec3(0.92)), 1.0);
}
`;
