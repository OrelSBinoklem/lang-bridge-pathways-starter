import { makeRandom } from './pointer';
import { createProgressiveProgram } from './progressiveProgram';

/**
 * Two ambers to choose from, each ray-marched in 3D in its own small WebGL2 canvas:
 *
 * - "pebble" (the first one): a flat polished pebble with a few chipped facets lying straight on the suitcase, a
 *   beetle and a fly with wings inside, bubbles and flakes; lit only by the room's bulbs.
 * - "display": a museum piece — a big polished chunk of Baltic amber on a glossy black display base with a light
 *   inside it, described below.
 *
 * The stone is an upright boulder with polished facets and a rough, opaque crust at its foot. Trapped inside: a
 * long-legged mosquito with veined wings, fern fronds, internal fractures that flash when they catch the base light
 * (the "sun spangles" of real amber), bubbles and dark specks. The display light shines up through the resin: every
 * step of a ray gathers light scattered towards the eye, and both that light and the ray itself lose blue and green
 * along the way (Beer–Lambert) — golden where the resin is thin, deep orange where it is thick. Rays refract in and
 * out (n = 1.54) and pick up the room behind, handed in as a texture; the base reflects the glowing stone; the bulbs
 * of the room add their highlights to both.
 */

export type AmberLight = {
  /** Position in the amber's own units, x right, y up, z towards the viewer. */
  x: number;
  y: number;
  z: number;
  /** Linear RGB intensity, already scaled by how lit the bulb is. */
  r: number;
  g: number;
  b: number;
};

export type Amber = {
  readonly canvas: HTMLCanvasElement;
  ready(): boolean;
  failed(): boolean;
  /** The room behind the amber, framed exactly like `canvas`. */
  setBackground(source: TexImageSource): void;
  render(yaw: number, lights: AmberLight[], window: AmberLight, exposure: number, glow: number): void;
  dispose(): void;
};

const MAX_LIGHTS = 16;

/** Camera: a little above the stone, looking slightly down at it, so the top of the base shows. */
export const AMBER_CAMERA = { pos: [0, 1.3, 5.5], target: [0, -0.15, 0] } as const;

/** Where a point in the amber's space lands on the canvas, in amber units from the camera target (y up). */
export function projectAmber(x: number, y: number, z: number): [number, number] {
  const [cx, cy, cz] = AMBER_CAMERA.pos;
  const [tx, ty, tz] = AMBER_CAMERA.target;
  let fx = tx - cx;
  let fy = ty - cy;
  let fz = tz - cz;
  const dist = Math.hypot(fx, fy, fz);
  fx /= dist;
  fy /= dist;
  fz /= dist;
  // right = normalize(cross(f, up)), up' = cross(right, f)
  let rx = -fz;
  let rz = fx;
  const rl = Math.hypot(rx, rz) || 1;
  rx /= rl;
  rz /= rl;
  const ux = -rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy;
  const px = x - cx;
  const py = y - cy;
  const pz = z - cz;
  const depth = px * fx + py * fy + pz * fz;
  const k = dist / depth;
  return [(px * rx + pz * rz) * k, (px * ux + py * uy + pz * uz) * k];
}

const f = (n: number) => n.toFixed(4);
const v3 = (a: number, b: number, c: number) => `vec3(${f(a)}, ${f(b)}, ${f(c)})`;

/** The display piece's loose contents, placed once from a seed and baked into the shader as constants. */
function displayContents(seed: number) {
  const rand = makeRandom(seed);
  const inside = (margin: number) => {
    for (;;) {
      const x = (rand() - 0.5) * 1.6;
      const y = -0.6 + rand() * 1.5;
      const z = (rand() - 0.5) * 0.9;
      if ((x / (0.8 - margin)) ** 2 + ((y - 0.05) / (0.82 - margin)) ** 2 + (z / (0.45 - margin)) ** 2 < 1) return [x, y, z];
    }
  };
  const frame = () => {
    let nx = rand() - 0.5;
    let ny = rand() - 0.5;
    let nz = rand() - 0.5;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl;
    ny /= nl;
    nz /= nl;
    const ax = Math.abs(nx) > 0.5 ? [0, 1, 0] : [1, 0, 0];
    let tx = ny * ax[2] - nz * ax[1];
    let ty = nz * ax[0] - nx * ax[2];
    let tz = nx * ax[1] - ny * ax[0];
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl;
    ty /= tl;
    tz /= tl;
    return { t: v3(tx, ty, tz), b: v3(ny * tz - nz * ty, nz * tx - nx * tz, nx * ty - ny * tx), n: v3(nx, ny, nz) };
  };
  const specks = Array.from({ length: 28 }, () => {
    const [x, y, z] = inside(0.05);
    return `vec4(${f(x)}, ${f(y)}, ${f(z)}, ${f(0.006 + rand() * rand() * 0.02)})`;
  });
  const bubbles = Array.from({ length: 9 }, () => {
    const [x, y, z] = inside(0.08);
    return `vec4(${f(x)}, ${f(y)}, ${f(z)}, ${f(0.008 + rand() * 0.022)})`;
  });
  const flakes = Array.from({ length: 6 }, () => {
    const [x, y, z] = inside(0.08);
    return { pos: v3(x, y, z), ...frame(), rad: v3(0.02 + rand() * 0.035, 0.012 + rand() * 0.02, 0.004) };
  });
  const cracks = Array.from({ length: 13 }, () => {
    const [x, y, z] = inside(0.12);
    return { pos: v3(x, y, z), ...frame(), r: f(0.07 + rand() * 0.14) };
  });
  return { specks, bubbles, flakes, cracks };
}

function displayFragment(seed: number) {
  const { specks, bubbles, flakes, cracks } = displayContents(seed);
  const list = <T>(items: T[], pick: (item: T) => string) => items.map(pick).join(', ');
  return `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform vec2 uOrigin;
uniform float uScale;
uniform mat3 uRot;
uniform sampler2D uBg;
uniform int uNL;
uniform vec3 uLP[${MAX_LIGHTS}];
uniform vec3 uLC[${MAX_LIGHTS}];
uniform vec3 uWP;
uniform vec3 uWC;
uniform float uExposure;
uniform float uGlow;
out vec4 outColor;

const vec3 CAM = ${v3(...AMBER_CAMERA.pos)};
const vec3 TARGET = ${v3(...AMBER_CAMERA.target)};
const vec3 GLOW_POS = vec3(0.0, -0.97, 0.0);
const vec3 GLOW_COL = vec3(1.0, 0.8, 0.52);
const vec3 SIGMA = vec3(0.16, 0.88, 2.7);
const vec3 SCATTER = vec3(1.0, 0.66, 0.3);

const int NS = ${specks.length};
const vec4 SPECK[NS] = vec4[NS](${specks.join(', ')});
const int NB = ${bubbles.length};
const vec4 BUB[NB] = vec4[NB](${bubbles.join(', ')});
const int NF = ${flakes.length};
const vec3 FP[NF] = vec3[NF](${list(flakes, (x) => x.pos)});
const vec3 FT[NF] = vec3[NF](${list(flakes, (x) => x.t)});
const vec3 FB[NF] = vec3[NF](${list(flakes, (x) => x.b)});
const vec3 FN[NF] = vec3[NF](${list(flakes, (x) => x.n)});
const vec3 FR[NF] = vec3[NF](${list(flakes, (x) => x.rad)});
const int NC = ${cracks.length};
const vec3 CP[NC] = vec3[NC](${list(cracks, (x) => x.pos)});
const vec3 CT[NC] = vec3[NC](${list(cracks, (x) => x.t)});
const vec3 CB[NC] = vec3[NC](${list(cracks, (x) => x.b)});
const vec3 CN[NC] = vec3[NC](${list(cracks, (x) => x.n)});
const float CR[NC] = float[NC](${list(cracks, (x) => x.r)});

const vec3 BUG_P = vec3(-0.06, 0.14, 0.04);
const float BUG_S = 0.56;

float sdEllipsoid(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / max(k1, 1e-5);
}
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a;
  vec3 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
float smax(float a, float b, float k) { return -smin(-a, -b, k); }
mat2 rot2(float a) { float c = cos(a); float s = sin(a); return mat2(c, s, -s, c); }

// ---- the stone: an upright boulder, polished facets, a rough crust around its foot, flat where it stands.
float crustAmount(vec3 p) {
  return smoothstep(-0.5, -0.74, p.y + 0.07 * sin(7.0 * p.x + 1.0) + 0.05 * sin(9.0 * p.z + 2.0));
}
float sdAmber(vec3 p) {
  vec3 q = p - vec3(0.06 * p.y, 0.05, 0.0);
  float d = sdEllipsoid(q, vec3(0.92, 0.98, 0.56));
  d += 0.06 * sin(2.3 * p.x + 0.7) * sin(2.1 * p.y + 1.9) * sin(2.9 * p.z + 0.3);
  d += 0.022 * sin(5.3 * p.x - 3.7 * p.y + 4.1 * p.z);
  d = smax(d, dot(p, normalize(vec3(0.62, 0.72, 0.3))) - 0.78, 0.04);
  d = smax(d, dot(p, normalize(vec3(-0.72, 0.58, 0.38))) - 0.74, 0.04);
  d = smax(d, dot(p, normalize(vec3(0.15, 0.25, 1.0))) - 0.5, 0.05);
  d = smax(d, dot(p, normalize(vec3(-0.3, 0.1, 1.0))) - 0.5, 0.05);
  d = smax(d, dot(p, normalize(vec3(0.35, -0.2, -1.0))) - 0.5, 0.05);
  d = smax(d, dot(p, normalize(vec3(0.95, -0.1, 0.2))) - 0.84, 0.04);
  d = smax(d, dot(p, normalize(vec3(-0.9, -0.35, -0.2))) - 0.82, 0.04);
  d = smax(d, dot(p, normalize(vec3(-0.2, 1.0, -0.3))) - 0.95, 0.04);
  float c = smoothstep(-0.42, -0.78, p.y);
  d += c * 0.028 * (sin(17.0 * p.x) * sin(15.0 * p.y + 1.0) * sin(16.0 * p.z) * 0.6 + sin(29.0 * p.x + 23.0 * p.z) * 0.4);
  d = smax(d, -p.y - 0.9, 0.02);
  return d;
}

// ---- the display base: a rounded black slab.
float sdStand(vec3 p) {
  vec3 q = abs(p - vec3(0.0, -1.04, 0.0)) - vec3(1.0, 0.08, 0.62);
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - 0.05;
}

// ---- the mosquito, in its own frame: x towards the head, y to its sides, z its back (towards the viewer).
// x = distance, y = material: 1 chitin, 2 wing
vec2 sdMosquito(vec3 p) {
  vec3 q = vec3(p.x, abs(p.y), p.z);
  float tho = sdEllipsoid(p - vec3(0.02, 0.0, 0.0), vec3(0.11, 0.08, 0.08));
  float abd = sdEllipsoid(p - vec3(-0.3, 0.0, -0.01), vec3(0.26, 0.05, 0.05));
  float hed = sdEllipsoid(p - vec3(0.15, 0.0, 0.0), vec3(0.05, 0.055, 0.05));
  float d = smin(smin(tho, abd, 0.02), hed, 0.015);
  d = min(d, sdCapsule(p, vec3(0.19, 0.0, 0.0), vec3(0.36, 0.0, -0.02), 0.006));
  d = min(d, sdCapsule(q, vec3(0.18, 0.02, 0.02), vec3(0.3, 0.1, 0.04), 0.006));
  d = min(d, sdCapsule(q, vec3(0.06, 0.05, -0.02), vec3(0.2, 0.28, -0.04), 0.009));
  d = min(d, sdCapsule(q, vec3(0.2, 0.28, -0.04), vec3(0.42, 0.55, -0.06), 0.007));
  d = min(d, sdCapsule(q, vec3(0.0, 0.06, -0.03), vec3(0.02, 0.36, -0.05), 0.009));
  d = min(d, sdCapsule(q, vec3(0.02, 0.36, -0.05), vec3(0.0, 0.72, -0.08), 0.007));
  d = min(d, sdCapsule(q, vec3(-0.05, 0.05, -0.03), vec3(-0.25, 0.32, -0.05), 0.009));
  d = min(d, sdCapsule(q, vec3(-0.25, 0.32, -0.05), vec3(-0.55, 0.62, -0.08), 0.007));
  vec2 r = vec2(d, 1.0);
  vec3 w = q - vec3(-0.02, 0.05, 0.05);
  w.xy = rot2(-0.35) * w.xy;
  float wing = sdEllipsoid(w - vec3(-0.26, 0.06, 0.0), vec3(0.3, 0.075, 0.006));
  if (wing < r.x) r = vec2(wing, 2.0);
  return r;
}
vec3 toBug(vec3 p) {
  vec3 b = p - BUG_P;
  b.xy = rot2(-2.35) * b.xy;
  return b / BUG_S;
}

// ---- a fern frond: a curving stem with paired leaflets shrinking towards the tip.
float sdFrond(vec3 p, vec3 base, vec2 dir, float len, float bend) {
  vec2 perp = vec2(-dir.y, dir.x);
  vec3 mid = base + vec3(dir * len * 0.5 + perp * bend * len * 0.25, 0.0);
  float bound = length(p - mid) - len * 0.75;
  if (bound > 0.05) return bound;
  float d = 1e5;
  vec3 prev = base;
  for (int k = 1; k <= 3; k++) {
    float t = float(k) / 3.0;
    vec3 cur = base + vec3(dir * len * t + perp * bend * len * t * t, 0.0);
    d = min(d, sdCapsule(p, prev, cur, 0.009 * (1.2 - t * 0.6)));
    prev = cur;
  }
  for (int k = 1; k <= 8; k++) {
    float t = float(k) / 9.0;
    vec3 pt = base + vec3(dir * len * t + perp * bend * len * t * t, 0.0);
    vec2 tang = normalize(dir + perp * 2.0 * bend * t);
    vec2 side = vec2(-tang.y, tang.x);
    float leaf = 0.075 * (1.0 - t * 0.7);
    for (int s = -1; s <= 1; s += 2) {
      vec2 axis = normalize(side * float(s) + tang * 0.45);
      vec3 c = pt + vec3(axis * leaf * 0.55, 0.0);
      vec3 v = p - c;
      d = min(d, sdEllipsoid(vec3(dot(v.xy, axis), dot(v.xy, vec2(-axis.y, axis.x)), v.z), vec3(leaf * 0.55, leaf * 0.2, 0.008)));
    }
  }
  return d;
}

// x = distance, y = material: 1 chitin, 2 wing, 3 bubble, 4 debris, 6 fracture
vec2 sdInclusions(vec3 p) {
  vec2 res = vec2(1e5, 0.0);
  vec3 bp = p - BUG_P;
  float bb = length(bp) - BUG_S * 0.82;
  if (bb > 0.04) res = vec2(bb, 1.0);
  else {
    vec2 h = sdMosquito(toBug(p));
    res = vec2(h.x * BUG_S, h.y);
  }
  float fern = sdFrond(p, vec3(-0.3, -0.7, 0.12), normalize(vec2(-0.55, 0.84)), 0.46, 0.35);
  fern = min(fern, sdFrond(p, vec3(0.08, -0.76, -0.08), normalize(vec2(0.15, 1.0)), 0.36, -0.3));
  fern = min(fern, sdFrond(p, vec3(0.36, -0.7, 0.14), normalize(vec2(0.72, 0.7)), 0.4, 0.28));
  if (fern < res.x) res = vec2(fern, 4.0);
  for (int i = 0; i < NS; i++) {
    float d = length(p - SPECK[i].xyz) - SPECK[i].w;
    if (d < res.x) res = vec2(d, 4.0);
  }
  for (int i = 0; i < NB; i++) {
    float d = length(p - BUB[i].xyz) - BUB[i].w;
    if (d < res.x) res = vec2(d, 3.0);
  }
  for (int i = 0; i < NF; i++) {
    vec3 c = p - FP[i];
    if (length(c) - FR[i].x > res.x) continue;
    float d = sdEllipsoid(vec3(dot(c, FT[i]), dot(c, FB[i]), dot(c, FN[i])), FR[i]);
    if (d < res.x) res = vec2(d, 4.0);
  }
  for (int i = 0; i < NC; i++) {
    vec3 c = p - CP[i];
    if (length(c) - CR[i] > res.x) continue;
    vec2 q = vec2(length(vec2(dot(c, CT[i]), dot(c, CB[i]))) - CR[i], abs(dot(c, CN[i])) - 0.002);
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    if (d < res.x) res = vec2(d, 6.0);
  }
  return res;
}

vec3 amberNormal(vec3 p) {
  const vec2 k = vec2(1.0, -1.0);
  const float e = 0.002;
  return normalize(k.xyy * sdAmber(p + k.xyy * e) + k.yyx * sdAmber(p + k.yyx * e) + k.yxy * sdAmber(p + k.yxy * e) + k.xxx * sdAmber(p + k.xxx * e));
}
vec3 standNormal(vec3 p) {
  const vec2 k = vec2(1.0, -1.0);
  const float e = 0.002;
  return normalize(k.xyy * sdStand(p + k.xyy * e) + k.yyx * sdStand(p + k.yyx * e) + k.yxy * sdStand(p + k.yxy * e) + k.xxx * sdStand(p + k.xxx * e));
}
vec3 inclusionNormal(vec3 p) {
  const vec2 k = vec2(1.0, -1.0);
  const float e = 0.0015;
  return normalize(k.xyy * sdInclusions(p + k.xyy * e).x + k.yyx * sdInclusions(p + k.yyx * e).x + k.yxy * sdInclusions(p + k.yxy * e).x + k.xxx * sdInclusions(p + k.xxx * e).x);
}

// Light of the room's bulbs and the window arriving at p; n = 0 means "from every direction" (no cosine).
vec3 roomLight(vec3 p, vec3 n, float wrap) {
  vec3 sum = vec3(0.0);
  bool facing = dot(n, n) > 0.0;
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= uNL) break;
    vec3 L = uLP[i] - p;
    float c = facing ? clamp((dot(n, normalize(L)) + wrap) / (1.0 + wrap), 0.0, 1.0) : 1.0;
    sum += uLC[i] * c / (dot(L, L) + 0.08);
  }
  vec3 W = normalize(uWP - p);
  float cw = facing ? clamp((dot(n, W) + wrap) / (1.0 + wrap), 0.0, 1.0) : 1.0;
  return sum + uWC * cw + vec3(0.012, 0.01, 0.008);
}
vec3 roomSpecular(vec3 p, vec3 n, vec3 v, float power) {
  vec3 sum = vec3(0.0);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= uNL) break;
    vec3 L = uLP[i] - p;
    sum += uLC[i] * pow(max(dot(n, normalize(normalize(L) + v)), 0.0), power) / (dot(L, L) + 0.08);
  }
  return sum + uWC * pow(max(dot(n, normalize(normalize(uWP - p) + v)), 0.0), power) * 2.0;
}
// The display light, as it reaches p through the resin.
vec3 glowAt(vec3 p) {
  float dist = length(p - GLOW_POS);
  return GLOW_COL * uGlow * exp(-SIGMA * dist) / (dist * dist + 0.35);
}

vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

vec3 camF;
vec3 camR;
vec3 camU;
float camD;
vec2 toPixel(vec3 world) {
  vec3 rel = world - CAM;
  float z = max(dot(rel, camF), 0.1);
  return vec2(dot(rel, camR), dot(rel, camU)) * (camD / z) * uScale + uOrigin;
}
vec3 background(vec2 px) {
  vec2 uv = clamp(vec2(px.x / uRes.x, 1.0 - px.y / uRes.y), vec2(0.001), vec2(0.999));
  return pow(texture(uBg, uv).rgb, vec3(2.2));
}

vec3 crustShade(vec3 P, vec3 N, vec3 V) {
  float m = 0.5 + 0.5 * sin(23.0 * P.x + 5.0 * sin(19.0 * P.z)) * sin(21.0 * P.y);
  vec3 albedo = mix(vec3(0.16, 0.05, 0.015), vec3(0.44, 0.17, 0.04), m);
  float inner = exp(-length(P - GLOW_POS) * 1.5);
  return albedo * (roomLight(P, N, 0.4) + GLOW_COL * uGlow * inner * vec3(0.8, 0.36, 0.1)) + roomSpecular(P, N, V, 30.0) * 0.05;
}

vec3 standShade(vec3 P, vec3 N, vec3 V) {
  vec3 R = reflect(-V, N);
  vec3 refl = vec3(0.004, 0.003, 0.003);
  float t = 0.02;
  for (int i = 0; i < 48; i++) {
    vec3 q = P + R * t;
    float d = sdAmber(q);
    if (d < 0.003) {
      float up = clamp((q.y + 0.9) / 1.9, 0.0, 1.0);
      refl = GLOW_COL * uGlow * mix(1.2, 0.25, up) * vec3(1.0, 0.5, 0.14) * 0.3;
      break;
    }
    t += max(d * 0.9, 0.004);
    if (t > 4.0) break;
  }
  float F = max(0.04 + 0.96 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 5.0), 0.14);
  float spill = exp(-length(P.xz) * 2.0) * step(0.5, N.y);
  return refl * F + roomSpecular(P, N, V, 90.0) * 0.7 + roomLight(P, N, 0.0) * 0.01
    + GLOW_COL * vec3(1.0, 0.5, 0.14) * uGlow * spill * 0.12;
}

void main() {
  camF = normalize(TARGET - CAM);
  camR = normalize(cross(camF, vec3(0.0, 1.0, 0.0)));
  camU = cross(camR, camF);
  camD = length(TARGET - CAM);
  vec2 uv = (gl_FragCoord.xy - uOrigin) / uScale;
  vec3 rdW = normalize(camF * camD + camR * uv.x + camU * uv.y);
  // Everything is traced in the display's own (turning) frame; the bulbs arrive already rotated into it.
  mat3 toObj = transpose(uRot);
  vec3 ro = toObj * CAM;
  vec3 rd = toObj * rdW;
  vec3 bc = vec3(0.0, -0.12, 0.0);
  float bR = 1.65;
  vec3 oc = ro - bc;
  float bq = dot(oc, rd);
  float disc = bq * bq - dot(oc, oc) + bR * bR;
  if (disc <= 0.0) { outColor = vec4(0.0); return; }
  float t = -bq - sqrt(disc);
  float tEnd = -bq + sqrt(disc);
  float minD = 1e5;
  float mat = 0.0;
  for (int i = 0; i < 96; i++) {
    vec3 p = ro + rd * t;
    float da = sdAmber(p);
    float ds = sdStand(p);
    float d = min(da, ds);
    minD = min(minD, d);
    if (d < 0.0008) { mat = da < ds ? 1.0 : 2.0; break; }
    t += d * 0.75;
    if (t > tEnd) break;
  }
  if (mat == 0.0) {
    float a = 1.0 - smoothstep(0.0, 1.5 / uScale, minD);
    outColor = vec4(vec3(0.02, 0.01, 0.005) * a, a);
    return;
  }
  vec3 P = ro + rd * t;
  vec3 V = -rd;
  vec3 col;
  if (mat == 2.0) {
    col = aces(standShade(P, standNormal(P), V) * uExposure);
  } else {
    vec3 N = amberNormal(P);
    float F = 0.045 + 0.955 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 5.0);
    vec3 inside = vec3(0.0);
    vec3 trans = vec3(1.0);
    vec3 dir = refract(rd, N, 1.0 / 1.54);
    vec3 ambient = roomLight(P, vec3(0.0), 0.0);
    float s = 0.004;
    bool exited = false;
    bool thin = false;
    vec3 exitP = P;
    for (int i = 0; i < 120; i++) {
      vec3 p = P + dir * s;
      float da = sdAmber(p);
      if (da > 0.0) { exited = true; exitP = p; break; }
      vec2 inc = sdInclusions(p);
      if (inc.x < 0.0025) {
        if (inc.y == 3.0 || inc.y == 2.0 || inc.y == 6.0) {
          if (!thin) {
            vec3 ni = inclusionNormal(p);
            if (inc.y == 3.0) {
              float rim = pow(1.0 - abs(dot(ni, dir)), 2.2);
              inside += trans * (glowAt(p) + ambient) * rim * 0.5;
              trans *= 1.0 - 0.3 * rim;
            } else if (inc.y == 2.0) {
              vec3 w = toBug(p);
              vec3 q = vec3(w.x, abs(w.y), w.z) - vec3(-0.02, 0.05, 0.05);
              q.xy = rot2(-0.35) * q.xy;
              float veins = smoothstep(0.82, 1.0, abs(cos(atan(q.y + 0.02, -q.x) * 11.0))) + smoothstep(0.06, 0.075, abs(q.y - 0.06));
              float irid = abs(dot(ni, dir));
              vec3 tint = 0.55 + 0.45 * cos(6.2831 * (irid * 1.3 + vec3(0.0, 0.33, 0.67)));
              inside += trans * (glowAt(p) + ambient) * tint * 0.06;
              trans *= mix(0.78, 0.25, clamp(veins, 0.0, 1.0));
            } else {
              vec3 toGlow = normalize(GLOW_POS - p);
              float flash = pow(max(dot(reflect(dir, ni), toGlow), 0.0), 10.0);
              inside += trans * glowAt(p) * (0.12 + 2.6 * flash) * vec3(1.0, 0.82, 0.5) * 0.4;
              trans *= 0.9;
            }
            thin = true;
          }
          s += 0.008;
          continue;
        }
        vec3 ni = inclusionNormal(p);
        vec3 albedo = inc.y == 4.0 ? vec3(0.08, 0.035, 0.012) : vec3(0.03, 0.018, 0.008);
        vec3 lit = (roomLight(p, ni, 0.4) + glowAt(p) * clamp(dot(ni, normalize(GLOW_POS - p)) * 0.6 + 0.4, 0.0, 1.0)) * vec3(1.0, 0.62, 0.3);
        vec3 shine = inc.y == 1.0 ? roomSpecular(p, ni, -dir, 50.0) * 0.12 : vec3(0.0);
        inside += trans * (albedo * lit + shine);
        trans = vec3(0.0);
        break;
      }
      thin = false;
      float stepLen = clamp(min(inc.x, -da) * 0.9, 0.006, 0.05);
      inside += trans * (glowAt(p) + ambient * 0.6) * SCATTER * 0.32 * stepLen;
      trans *= exp(-SIGMA * stepLen);
      s += stepLen;
      if (max(trans.r, max(trans.g, trans.b)) < 0.004) break;
    }
    vec3 behind = vec3(0.0);
    if (exited && trans.r > 0.002) {
      vec3 nO = amberNormal(exitP);
      vec3 out1 = refract(dir, -nO, 1.54);
      bool tir = dot(out1, out1) < 1e-4;
      vec3 od = uRot * (tir ? reflect(dir, -nO) : out1);
      behind = background(toPixel(uRot * exitP) + od.xy * 0.3 * uScale) * (tir ? 0.3 : 1.0);
    }
    vec3 surface = roomSpecular(P, N, V, 220.0) * 2.4 + roomSpecular(P, N, V, 26.0) * 0.1 + ambient * F * 0.6;
    vec3 clear = aces((inside * (1.0 - F) + surface) * uExposure) + (1.0 - F) * trans * behind;
    vec3 crust = aces(crustShade(P, N, V) * uExposure);
    col = mix(clear, crust, crustAmount(P));
  }
  outColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
}`;
}

/** The first amber: a flat polished pebble lying straight on the suitcase, a beetle and a fly with wings inside. */
function pebbleContents(seed: number) {
  const rand = makeRandom(seed);
  const inside = () => {
    for (;;) {
      const x = (rand() - 0.5) * 1.5;
      const y = -0.35 + rand() * 0.8;
      const z = (rand() - 0.5) * 0.9;
      if ((x / 0.82) ** 2 + (y / 0.55) ** 2 + (z / 0.5) ** 2 < 1) return [x, y, z];
    }
  };
  const bubbles = Array.from({ length: 14 }, () => {
    const [x, y, z] = inside();
    const r = rand() < 0.2 ? 0.045 + rand() * 0.03 : 0.01 + rand() * 0.028;
    return `vec4(${f(x)}, ${f(y)}, ${f(z)}, ${f(r)})`;
  });
  const debris = Array.from({ length: 16 }, (_, i) => {
    const [x, y, z] = inside();
    let nx = rand() - 0.5;
    let ny = rand() - 0.5;
    let nz = rand() - 0.5;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl;
    ny /= nl;
    nz /= nl;
    const ax = Math.abs(nx) > 0.5 ? [0, 1, 0] : [1, 0, 0];
    let tx = ny * ax[2] - nz * ax[1];
    let ty = nz * ax[0] - nx * ax[2];
    let tz = nx * ax[1] - ny * ax[0];
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl;
    ty /= tl;
    tz /= tl;
    const twig = i % 5 === 0;
    const rad = twig ? [0.1 + rand() * 0.08, 0.009, 0.009] : [0.015 + rand() * 0.035, 0.01 + rand() * 0.025, 0.004];
    return {
      pos: v3(x, y, z),
      t: v3(tx, ty, tz),
      b: v3(ny * tz - nz * ty, nz * tx - nx * tz, nx * ty - ny * tx),
      n: v3(nx, ny, nz),
      rad: v3(rad[0], rad[1], rad[2]),
    };
  });
  return { bubbles, debris };
}

function pebbleFragment(seed: number) {
  const { bubbles, debris } = pebbleContents(seed);
  return `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform vec2 uOrigin;
uniform float uScale;
uniform mat3 uRot;
uniform sampler2D uBg;
uniform int uNL;
uniform vec3 uLP[${MAX_LIGHTS}];
uniform vec3 uLC[${MAX_LIGHTS}];
uniform vec3 uWP;
uniform vec3 uWC;
uniform float uExposure;
out vec4 outColor;

const int NB = ${bubbles.length};
const vec4 BUB[NB] = vec4[NB](${bubbles.join(', ')});
const int ND = ${debris.length};
const vec3 DP[ND] = vec3[ND](${debris.map((x) => x.pos).join(', ')});
const vec3 DT[ND] = vec3[ND](${debris.map((x) => x.t).join(', ')});
const vec3 DB[ND] = vec3[ND](${debris.map((x) => x.b).join(', ')});
const vec3 DN[ND] = vec3[ND](${debris.map((x) => x.n).join(', ')});
const vec3 DR[ND] = vec3[ND](${debris.map((x) => x.rad).join(', ')});

const vec3 BEETLE_P = vec3(-0.14, 0.04, 0.02);
const float BEETLE_S = 0.34;
const vec3 FLY_P = vec3(0.47, -0.08, -0.12);
const float FLY_S = 0.22;
const vec3 SIGMA = vec3(0.32, 0.95, 3.1);
const vec3 SCATTER = vec3(0.95, 0.56, 0.2);

float sdEllipsoid(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / max(k1, 1e-5);
}
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a;
  vec3 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
float smax(float a, float b, float k) { return -smin(-a, -b, k); }
mat2 rot2(float a) { float c = cos(a); float s = sin(a); return mat2(c, s, -s, c); }

float sdAmber(vec3 p) {
  float d = sdEllipsoid(p, vec3(1.0, 0.72, 0.64));
  d += 0.05 * sin(3.1 * p.x + 1.3) * sin(2.7 * p.y + 0.4) * sin(3.3 * p.z + 2.1);
  d += 0.018 * sin(7.3 * p.x + 5.1 * p.y + 6.2 * p.z);
  d = smax(d, dot(p, normalize(vec3(0.75, 0.55, 0.35))) - 0.68, 0.06);
  d = smax(d, dot(p, normalize(vec3(-0.55, 0.62, -0.3))) - 0.6, 0.06);
  d = smax(d, dot(p, normalize(vec3(0.25, 0.3, -0.9))) - 0.52, 0.05);
  d = smax(d, dot(p, normalize(vec3(-0.9, -0.1, 0.4))) - 0.86, 0.05);
  d = smax(d, -p.y - 0.5, 0.03);
  return d;
}

// x = distance, y = material: 1 chitin, 2 wing, 3 bubble, 4 debris, 5 eye
vec2 sdBeetle(vec3 p) {
  vec3 q = vec3(p.x, abs(p.y), p.z);
  float abd = sdEllipsoid(p - vec3(-0.2, 0.0, 0.0), vec3(0.42, 0.29, 0.2));
  float tho = sdEllipsoid(p - vec3(0.27, 0.0, 0.01), vec3(0.15, 0.21, 0.13));
  float hed = sdEllipsoid(p - vec3(0.45, 0.0, 0.0), vec3(0.09, 0.12, 0.08));
  float d = smin(smin(abd, tho, 0.03), hed, 0.025);
  d = min(d, sdCapsule(q, vec3(0.52, 0.04, -0.01), vec3(0.61, 0.02, -0.02), 0.018));
  d = min(d, sdCapsule(q, vec3(0.3, 0.14, -0.06), vec3(0.42, 0.34, -0.1), 0.022));
  d = min(d, sdCapsule(q, vec3(0.42, 0.34, -0.1), vec3(0.58, 0.44, -0.16), 0.016));
  d = min(d, sdCapsule(q, vec3(0.1, 0.2, -0.08), vec3(0.08, 0.44, -0.12), 0.022));
  d = min(d, sdCapsule(q, vec3(0.08, 0.44, -0.12), vec3(0.02, 0.6, -0.2), 0.016));
  d = min(d, sdCapsule(q, vec3(-0.12, 0.2, -0.08), vec3(-0.3, 0.42, -0.12), 0.022));
  d = min(d, sdCapsule(q, vec3(-0.3, 0.42, -0.12), vec3(-0.52, 0.52, -0.2), 0.016));
  d = min(d, sdCapsule(q, vec3(0.5, 0.06, 0.02), vec3(0.62, 0.16, 0.05), 0.011));
  d = min(d, sdCapsule(q, vec3(0.62, 0.16, 0.05), vec3(0.74, 0.3, 0.03), 0.013));
  return vec2(d, 1.0);
}

vec2 sdFly(vec3 p) {
  vec3 q = vec3(p.x, abs(p.y), p.z);
  float tho = sdEllipsoid(p - vec3(0.05, 0.0, 0.0), vec3(0.17, 0.14, 0.14));
  float abd = sdEllipsoid(p - vec3(-0.25, 0.0, -0.01), vec3(0.23, 0.15, 0.12));
  float hed = sdEllipsoid(p - vec3(0.27, 0.0, 0.01), vec3(0.08, 0.12, 0.09));
  vec2 r = vec2(smin(smin(tho, abd, 0.03), hed, 0.02), 1.0);
  float eyes = length(q - vec3(0.3, 0.075, 0.03)) - 0.066;
  if (eyes < r.x) r = vec2(eyes, 5.0);
  float legs = sdCapsule(q, vec3(0.12, 0.08, -0.1), vec3(0.3, 0.3, -0.24), 0.011);
  legs = min(legs, sdCapsule(q, vec3(0.02, 0.1, -0.1), vec3(0.0, 0.36, -0.26), 0.011));
  legs = min(legs, sdCapsule(q, vec3(-0.08, 0.08, -0.1), vec3(-0.3, 0.3, -0.25), 0.011));
  if (legs < r.x) r = vec2(legs, 1.0);
  vec3 w = q - vec3(-0.16, 0.21, 0.1);
  w.xy = rot2(0.45) * w.xy;
  float wing = sdEllipsoid(w, vec3(0.34, 0.11, 0.008));
  if (wing < r.x) r = vec2(wing, 2.0);
  return r;
}

vec2 sdInclusions(vec3 p) {
  vec2 res = vec2(1e5, 0.0);
  vec3 b = p - BEETLE_P;
  float bb = length(b) - BEETLE_S * 0.9;
  if (bb > 0.05) res = vec2(bb, 1.0);
  else {
    b.xy = rot2(0.55) * b.xy;
    b.yz = rot2(0.35) * b.yz;
    vec2 h = sdBeetle(b / BEETLE_S);
    h.x *= BEETLE_S;
    res = h;
  }
  vec3 fy = p - FLY_P;
  float fb = length(fy) - FLY_S * 0.8;
  if (fb > 0.05) { if (fb < res.x) res = vec2(fb, 1.0); }
  else {
    fy.xy = rot2(-2.3) * fy.xy;
    fy.xz = rot2(0.4) * fy.xz;
    vec2 h = sdFly(fy / FLY_S);
    h.x *= FLY_S;
    if (h.x < res.x) res = h;
  }
  for (int i = 0; i < NB; i++) {
    float d = length(p - BUB[i].xyz) - BUB[i].w;
    if (d < res.x) res = vec2(d, 3.0);
  }
  for (int i = 0; i < ND; i++) {
    vec3 c = p - DP[i];
    float bound = length(c) - DR[i].x;
    if (bound > res.x) continue;
    float d = sdEllipsoid(vec3(dot(c, DT[i]), dot(c, DB[i]), dot(c, DN[i])), DR[i]);
    if (d < res.x) res = vec2(d, 4.0);
  }
  return res;
}

vec3 amberNormal(vec3 p) {
  const vec2 k = vec2(1.0, -1.0);
  const float e = 0.002;
  return normalize(k.xyy * sdAmber(p + k.xyy * e) + k.yyx * sdAmber(p + k.yyx * e) + k.yxy * sdAmber(p + k.yxy * e) + k.xxx * sdAmber(p + k.xxx * e));
}
vec3 inclusionNormal(vec3 p) {
  const vec2 k = vec2(1.0, -1.0);
  const float e = 0.0015;
  return normalize(k.xyy * sdInclusions(p + k.xyy * e).x + k.yyx * sdInclusions(p + k.yyx * e).x + k.yxy * sdInclusions(p + k.yxy * e).x + k.xxx * sdInclusions(p + k.xxx * e).x);
}

vec3 lightAt(vec3 p, vec3 n, float wrap) {
  vec3 sum = vec3(0.0);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= uNL) break;
    vec3 L = uLP[i] - p;
    float d2 = dot(L, L);
    float c = dot(n, n) > 0.0 ? clamp((dot(n, normalize(L)) + wrap) / (1.0 + wrap), 0.0, 1.0) : 1.0;
    sum += uLC[i] * c / (d2 + 0.08);
  }
  vec3 W = normalize(uWP - p);
  float cw = dot(n, n) > 0.0 ? clamp((dot(n, W) + wrap) / (1.0 + wrap), 0.0, 1.0) : 1.0;
  return sum + uWC * cw + vec3(0.02, 0.016, 0.012);
}

vec3 specular(vec3 p, vec3 n, vec3 v, float power) {
  vec3 sum = vec3(0.0);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= uNL) break;
    vec3 L = uLP[i] - p;
    float d2 = dot(L, L);
    vec3 h = normalize(normalize(L) + v);
    sum += uLC[i] * pow(max(dot(n, h), 0.0), power) / (d2 + 0.08);
  }
  vec3 h = normalize(normalize(uWP - p) + v);
  return sum + uWC * pow(max(dot(n, h), 0.0), power) * 2.0;
}

vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

vec3 background(vec2 px) {
  vec2 uv = clamp(vec2(px.x / uRes.x, 1.0 - px.y / uRes.y), vec2(0.001), vec2(0.999));
  return pow(texture(uBg, uv).rgb, vec3(2.2));
}

vec2 toPixel(vec3 w) { return w.xy * (6.0 / (6.0 - w.z)) * uScale + uOrigin; }

void main() {
  vec2 frag = gl_FragCoord.xy;
  mat3 toObj = transpose(uRot);
  vec3 ro = toObj * vec3(0.0, 0.0, 6.0);
  vec3 target = vec3((frag - uOrigin) / uScale, 0.0);
  vec3 rd = toObj * normalize(target - vec3(0.0, 0.0, 6.0));
  float bsR = 1.12;
  float bq = dot(ro, rd);
  float disc = bq * bq - dot(ro, ro) + bsR * bsR;
  if (disc <= 0.0) { outColor = vec4(0.0); return; }
  float t = -bq - sqrt(disc);
  float tEnd = -bq + sqrt(disc);
  float minD = 1e5;
  bool hit = false;
  for (int i = 0; i < 80; i++) {
    vec3 p = ro + rd * t;
    float d = sdAmber(p);
    minD = min(minD, d);
    if (d < 0.0008) { hit = true; break; }
    t += d * 0.85;
    if (t > tEnd) break;
  }
  if (!hit) {
    float a = 1.0 - smoothstep(0.0, 1.5 / uScale, minD);
    outColor = vec4(vec3(0.3, 0.14, 0.04) * a, a);
    return;
  }
  vec3 P = ro + rd * t;
  vec3 N = amberNormal(P);
  vec3 V = -rd;
  float F = 0.045 + 0.955 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 5.0);
  vec3 inside = vec3(0.0);
  vec3 trans = vec3(1.0);
  vec3 dir = refract(rd, N, 1.0 / 1.54);
  vec3 glow = lightAt(P, vec3(0.0), 0.0);
  float s = 0.004;
  bool exited = false;
  bool inBubble = false;
  bool inWing = false;
  vec3 exitP = P;
  for (int i = 0; i < 110; i++) {
    vec3 p = P + dir * s;
    float da = sdAmber(p);
    if (da > 0.0) { exited = true; exitP = p; break; }
    vec2 inc = sdInclusions(p);
    if (inc.x < 0.0025) {
      if (inc.y == 3.0) {
        if (!inBubble) {
          vec3 nb = inclusionNormal(p);
          float rim = pow(1.0 - abs(dot(nb, dir)), 2.2);
          inside += trans * (lightAt(p, vec3(0.0), 0.0) * 0.55 + 0.03) * rim;
          trans *= 1.0 - 0.35 * rim;
          inBubble = true;
        }
        s += 0.01;
        continue;
      }
      if (inc.y == 2.0) {
        if (!inWing) {
          vec3 nw = inclusionNormal(p);
          float irid = abs(dot(nw, dir));
          vec3 tint = 0.5 + 0.5 * cos(6.2831 * (irid * 1.4 + vec3(0.0, 0.33, 0.67)));
          inside += trans * lightAt(p, nw, 0.6) * tint * 0.08;
          trans *= 0.72;
          inWing = true;
        }
        s += 0.01;
        continue;
      }
      vec3 ni = inclusionNormal(p);
      vec3 albedo = inc.y == 5.0 ? vec3(0.22, 0.03, 0.01) : inc.y == 4.0 ? vec3(0.06, 0.03, 0.012) : vec3(0.03, 0.02, 0.01);
      vec3 lit = lightAt(p, ni, 0.35) * vec3(1.0, 0.62, 0.3);
      vec3 shine = inc.y == 4.0 ? vec3(0.0) : specular(p, ni, -dir, 60.0) * vec3(0.5, 0.62, 0.45) * 0.35;
      inside += trans * (albedo * lit + shine);
      trans = vec3(0.0);
      break;
    }
    inBubble = false;
    inWing = false;
    float stepLen = clamp(min(inc.x, -da) * 0.9, 0.006, 0.055);
    inside += trans * glow * SCATTER * 0.22 * stepLen;
    trans *= exp(-SIGMA * stepLen);
    s += stepLen;
    if (max(trans.r, max(trans.g, trans.b)) < 0.004) break;
  }
  vec3 behind = vec3(0.0);
  if (exited && max(trans.r, trans.g) > 0.0) {
    vec3 nO = amberNormal(exitP);
    vec3 out1 = refract(dir, -nO, 1.54);
    bool tir = dot(out1, out1) < 1e-4;
    vec3 od = uRot * (tir ? reflect(dir, -nO) : out1);
    behind = background(toPixel(uRot * exitP) + od.xy * 0.35 * uScale) * (tir ? 0.35 : 1.0);
  }
  vec3 env = pow(textureLod(uBg, vec2(0.5), 6.0).rgb, vec3(2.2)) * 0.9;
  vec3 surface = specular(P, N, V, 220.0) * 2.2 + specular(P, N, V, 28.0) * 0.12 + env * F;
  vec3 light = aces((inside * (1.0 - F) + surface * max(F, 0.08)) * uExposure);
  vec3 col = light + (1.0 - F) * trans * behind;
  outColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
}`;
}

/** Which amber: the first one (a pebble lying on the suitcase) or the museum piece on its lit display base. */
export type AmberKind = 'pebble' | 'display';

const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/**
 * `width`/`height` in device px, `scale` device px per amber unit, `originX/originY` where the camera target lands,
 * in device px from the canvas's bottom-left corner.
 */
export function createAmber(kind: AmberKind, width: number, height: number, scale: number, originX: number, originY: number, seed: number): Amber | null {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.round(width));
  canvas.height = Math.max(2, Math.round(height));
  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true });
  } catch {
    gl = null;
  }
  if (!gl || typeof gl.texStorage2D !== 'function') return null;
  const g = gl;
  const release = () => g.getExtension('WEBGL_lose_context')?.loseContext();
  const shader = createProgressiveProgram(g, VERT, kind === 'display' ? displayFragment(seed) : pebbleFragment(seed), 'string-lights amber');
  if (!shader) {
    release();
    return null;
  }
  const locations = () => {
    const u = shader.u;
    return {
      res: u('uRes'), origin: u('uOrigin'), scale: u('uScale'), rot: u('uRot'), bg: u('uBg'), nl: u('uNL'), lp: u('uLP'),
      lc: u('uLC'), wp: u('uWP'), wc: u('uWC'), exposure: u('uExposure'), glow: u('uGlow'),
    };
  };
  let loc: ReturnType<typeof locations> | null = null;
  const bg = g.createTexture()!;
  g.bindTexture(g.TEXTURE_2D, bg);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
  g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, 1, 1, 0, g.RGBA, g.UNSIGNED_BYTE, new Uint8Array([20, 14, 10, 255]));
  const vao = g.createVertexArray();
  g.bindVertexArray(vao);
  const lp = new Float32Array(MAX_LIGHTS * 3);
  const lc = new Float32Array(MAX_LIGHTS * 3);
  let disposed = false;

  return {
    canvas,
    ready: () => !disposed && !g.isContextLost() && shader.ready(),
    failed: () => g.isContextLost() || shader.failed(),
    setBackground(source) {
      if (disposed || g.isContextLost()) return;
      g.bindTexture(g.TEXTURE_2D, bg);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, source);
      g.generateMipmap(g.TEXTURE_2D);
    },
    render(yaw, lights, win, exposure, glow) {
      if (disposed || g.isContextLost() || !shader.ready()) return;
      loc ??= locations();
      const count = Math.min(MAX_LIGHTS, lights.length);
      const c = Math.cos(yaw);
      const s = Math.sin(yaw);
      // Into the display's turning frame (the transpose of the rotation uploaded below).
      const toObj = (l: AmberLight) => [c * l.x - s * l.z, l.y, s * l.x + c * l.z];
      lp.fill(0);
      lc.fill(0);
      for (let i = 0; i < count; i += 1) {
        lp.set(toObj(lights[i]), i * 3);
        lc.set([lights[i].r, lights[i].g, lights[i].b], i * 3);
      }
      const w = toObj(win);
      g.viewport(0, 0, g.drawingBufferWidth, g.drawingBufferHeight);
      g.clearColor(0, 0, 0, 0);
      g.clear(g.COLOR_BUFFER_BIT);
      g.useProgram(shader.prog);
      g.uniform2f(loc.res, g.drawingBufferWidth, g.drawingBufferHeight);
      g.uniform2f(loc.origin, originX, originY);
      g.uniform1f(loc.scale, scale);
      g.uniformMatrix3fv(loc.rot, false, [c, 0, -s, 0, 1, 0, s, 0, c]);
      g.activeTexture(g.TEXTURE0);
      g.bindTexture(g.TEXTURE_2D, bg);
      g.uniform1i(loc.bg, 0);
      g.uniform1i(loc.nl, count);
      g.uniform3fv(loc.lp, lp);
      g.uniform3fv(loc.lc, lc);
      g.uniform3f(loc.wp, w[0], w[1], w[2]);
      g.uniform3f(loc.wc, win.r, win.g, win.b);
      g.uniform1f(loc.exposure, exposure);
      g.uniform1f(loc.glow, glow);
      g.drawArrays(g.TRIANGLES, 0, 3);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (!g.isContextLost()) {
        g.deleteTexture(bg);
        shader.dispose();
        g.deleteVertexArray(vao);
      }
      release();
    },
  };
}
