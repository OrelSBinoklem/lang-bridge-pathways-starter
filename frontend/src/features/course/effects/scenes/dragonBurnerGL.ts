/**
 * Backflow incense burners after the owner's photos — a procedural model (BurnerModel: the dragon on its castle in
 * burnerDragon.ts, the two mountains in burnerMountains.ts) — and their smoke, all on the GPU (WebGL2).
 *
 * A model is a signed distance field in GLSL (units: 1 = 10 cm, y up, standing on a table at y = 0; the camera looks
 * along −z, +x is to the right) with its materials, its room (backdrop, table, what its glaze reflects), where the
 * smoke leaves it and how the camera frames it. The camera never moves, so the burner is ray marched once (soft
 * shadows, ambient occlusion, glaze reflections), refined over a few frames and kept; the same field, sampled once
 * into a grid, is the obstacle for the smoke.
 *
 * The smoke is a fluid on a grid (64 × 80 × 48 cells of 2.4 mm, as 2D tiles of a texture atlas), stepped every frame:
 *   - the air's velocity carried along by itself (semi-Lagrangian);
 *   - the smoke is heavier than air: it pulls the air down where it is (cold incense smoke sinks, with a few per cent
 *     more density than air: about 0.3 m/s²);
 *   - vorticity confinement gives back the small eddies the grid smooths away, so the streams curl and roll at their
 *     edges instead of sagging as a soft mass;
 *   - the air cannot go into the burner (the grid's distance field): what flows into a surface is taken away, so the
 *     smoke slides along it; ledges, stairs, pools and the table hold it and it spills over their edges;
 *   - the flow is made incompressible: divergence, a pressure solved by Jacobi iterations (kept from frame to frame),
 *     its gradient taken away — so the smoke spreads where it lands instead of piling up;
 *   - the smoke's density carried along by the flow (MacCormack: sharp, kept within its neighbours' range), on a grid
 *     twice as fine as the velocity's (1.2 mm: the streams keep clear edges and fine curls, not soft lumps), fading
 *     slowly, born at the source with a little speed of its own;
 *   - the cursor pushes the air along its ray.
 * It is drawn by marching each pixel's ray through the grid (half size, joined to the burner by depth), lit by the
 * key light through the smoke and the burner on its way (a light grid marched every frame), with forward scattering;
 * the composite shades the burner under the smoke and tone-maps.
 */

export type DragonLook = {
  /** How much smoke the source gives (its density there, 0…1). */
  amount: number;
  /** How heavy the smoke is (how strongly it sinks). */
  heavy: number;
  /** How freely the air moves (1 / damping). */
  flow: number;
  /** How fast the smoke leaves the source. */
  spread: number;
  /** Eddies (vorticity confinement). */
  swirl: number;
  /** How strongly the smoke clings to the model's channel (models with `cling`; × its weight). */
  cling: number;
  /** How long it lasts, s. */
  life: number;
  /** Key light. */
  light: number;
  /** How dense the smoke looks. */
  density: number;
  exposure: number;
};

export type DragonPointer = { x: number; y: number; vx: number; vy: number; active: boolean };

export type V3 = [number, number, number];
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => mul(a, 1 / (len(a) || 1));
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * A burner's model. Its GLSL comes after the shared helpers (HELPERS: uZero, gB, noise, the distance primitives, ggx,
 * uKey/uKeyI, RIM) and must define:
 *   - `const float MARCH_K` (the march's step factor: < 1 for fields bent by noise), `const vec3 KEY_COL`, `AMB_COL`;
 *   - `vec2 mapM(vec3 p)`: the distance and the material (≥ 1; −1 where the closest is only a bound — set gB = 1e5
 *     first and lower it with each bound used);
 *   - `vec3 studio(vec3 r)`: what a glossy surface reflects; `vec3 backdrop(vec2 uv)`: the room behind;
 *   - `void table(vec3 p, out vec3 alb, out float rough, out float glaze)`, `vec3 tableFade(vec3 p, vec3 col)`;
 *   - `bool special(float mat, vec3 p, vec3 n, vec3 rd, out vec3 col)`: materials shaded on their own (glass);
 *   - `void surface(float mat, vec3 p, vec3 rd, float ao, inout vec3 n, out vec3 alb, out float rough, out float glaze,
 *     out float metal)`;
 *   - `float tableMask(vec3 p)`: where the table is (1) and where the backdrop shows past its edge (0).
 */
export type BurnerModel = {
  id: string;
  label: string;
  glsl: string;
  setUniforms(gl: WebGL2RenderingContext, loc: (name: string) => WebGLUniformLocation | null): void;
  /** Where the smoke is born, the way it leaves, the source's radius, how much it gives (× the setting). */
  mouth: V3;
  mouthDir: V3;
  mouthR: number;
  smoke: number;
  camera: { target: V3; dir: V3; fitH: number; fitW: number };
  /** The box the burner fits in (the march starts at it). */
  bounds: [V3, V3];
  /** The key light's direction. */
  key: V3;
  /** A channel the smoke clings to (the Coandă effect of a cold, heavy stream on rock): its floor in front at height y
   * is z = zTop + (yTop − y)·slope + wig[0]·sin((yTop − y)·wig[1]), across x = cx ± hw, from y0 to yTop. The smoke within
   * `range` of it is pulled onto it — only that thin layer, thinner than what sticks out of the floor, so a knob in its
   * way is gone round at the sides, not over the top. */
  cling?: { zTop: number; yTop: number; slope: number; wig: [number, number]; cx: number; hw: number; y0: number; range: number };
  /** The smoke settings this model starts with (set when it is chosen; dragonBurner.ts). */
  smokeDefaults?: { dbAmount: number; dbHeavy: number; dbFlow: number; dbSpread: number; dbSwirl: number; dbCling: number; dbLife: number; dbDensity: number; dbPowder: number; dbDetail: number; dbShade: number };
};

/** The smoke's grid: cells, tiles of the atlas (z slices side by side, TX a row), the cell's size. The density lies on
 * a grid twice as fine each way, tiled the same. The box is the same at every level (1.56 × 1.95 × 1.17 from BMIN). */
type Grid = { GX: number; GY: number; GZ: number; TX: number; AW: number; AH: number; AW2: number; AH2: number; CELL: number };
/** The levels the settings offer (×: cells each way against the base 64 × 80 × 48; TX keeps the atlases ≤ 4096). */
export const GRID_LEVELS = [
  { label: '0,75×', s: 0.75, tx: 6 },
  { label: '1× (как было)', s: 1, tx: 8 },
  { label: '1,25×', s: 1.25, tx: 12 },
  { label: '1,5×', s: 1.5, tx: 12 },
] as const;
function gridFor(level: number): Grid {
  const L = GRID_LEVELS[Math.max(0, Math.min(GRID_LEVELS.length - 1, Math.round(level)))];
  const GX = Math.round(64 * L.s), GY = Math.round(80 * L.s), GZ = Math.round(48 * L.s), TX = L.tx;
  return { GX, GY, GZ, TX, AW: GX * TX, AH: GY * (GZ / TX), AW2: GX * TX * 2, AH2: GY * 2 * ((GZ * 2) / TX), CELL: 1.56 / GX };
}
const BMIN: V3 = [-0.78, 0, -0.5];

const HELPERS = `
// Always 0 (never set): loops start from it so that the shader compiler cannot unroll them. Unrolled, every loop over
// a model's parts — and every call of map() inside a loop — is copied out again and again, and the Direct3D compiler
// behind WebGL on Windows then takes minutes over the shader. For the same reason repeated parts are loops over
// uniform data, mapM() gives the material too (no second set of calls to find it), the normal and the occlusion share
// one loop, and the obstacle bake goes through the march's own loop: map() is written out three times, not seven.
uniform int uZero;
uniform vec3 uKey;
uniform float uKeyI;
// The smallest bound (a lower bound standing in for a part far away, not a surface) given for the point mapM() is
// measuring: soft shadows must not take a penumbra from it (a ray grazing an invisible box darkened the table).
float gB;
const vec3 FILL = normalize(vec3(0.85, 0.35, 0.55));
const vec3 RIM = normalize(vec3(0.45, 0.5, -0.75));

float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { return vnoise(p) * 0.5 + vnoise(p * 2.03) * 0.25 + vnoise(p * 4.01) * 0.125; }
float smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
float smax(float a, float b, float k) { return -smin(-a, -b, k); }
float sdEllipsoid(vec3 p, vec3 r) { float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float sdBox(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float sdCylY(vec3 p, float r, float y0, float y1) {
  vec2 d = vec2(length(p.xz) - r, abs(p.y - 0.5 * (y0 + y1)) - 0.5 * (y1 - y0));
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}
// Inigo Quilez's round cone: a capsule whose radius goes from r1 at a to r2 at b.
float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2) {
  vec3 ba = b - a; float l2 = dot(ba, ba); float rr = r1 - r2; float a2 = l2 - rr * rr; float il2 = 1.0 / l2;
  vec3 pa = p - a; float y = dot(pa, ba); float z = y - l2;
  vec3 xv = pa * l2 - ba * y; float x2 = dot(xv, xv); float y2 = y * y * l2; float z2 = z * z * l2;
  float k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
  if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
float dot2(vec3 v) { return dot(v, v); }
// Inigo Quilez's distance to a triangle.
float udTri(vec3 p, vec3 a, vec3 b, vec3 c) {
  vec3 ba = b - a, pa = p - a, cb = c - b, pb = p - b, ac = a - c, pc = p - c;
  vec3 nor = cross(ba, ac);
  return sqrt((sign(dot(cross(ba, nor), pa)) + sign(dot(cross(cb, nor), pb)) + sign(dot(cross(ac, nor), pc)) < 2.0)
    ? min(min(dot2(ba * clamp(dot(ba, pa) / dot2(ba), 0.0, 1.0) - pa), dot2(cb * clamp(dot(cb, pb) / dot2(cb), 0.0, 1.0) - pb)), dot2(ac * clamp(dot(ac, pc) / dot2(ac), 0.0, 1.0) - pc))
    : dot(nor, pa) * dot(nor, pa) / dot2(nor));
}
// A torus round the z axis (major radius r.x, minor r.y).
float sdTorusZ(vec3 p, vec2 r) { vec2 q = vec2(length(p.xy) - r.x, p.z); return length(q) - r.y; }
float ggx(float nh, float r) { float a = r * r; float a2 = a * a; float d = nh * nh * (a2 - 1.0) + 1.0; return a2 / (3.14159 * d * d); }
`;

/** After the model: the normal and the occlusion. */
const NORMAL_AO = `
float map(vec3 p) { return mapM(p).x; }
// The normal (four samples round p: a tetrahedron) and the ambient occlusion (five steps out along it), in one loop.
void normalAO(vec3 p, bool level, out vec3 n, out float ao) {
  vec3 acc = vec3(0.0);
  float occ = 0.0, w = 1.0;
  n = vec3(0.0, 1.0, 0.0);
  for (int i = uZero; i < 9; i++) {
    vec3 e = 0.5773 * (2.0 * vec3(float(((i + 3) >> 1) & 1), float((i >> 1) & 1), float(i & 1)) - 1.0);
    if (i == 4 && !level) n = normalize(acc);
    float h = 0.012 + 0.04 * float(i - 3);
    vec3 q = i < 4 ? p + 0.0012 * e : p + n * h;
    float d = map(q);
    if (i < 4) {
      acc += e * d;
    } else {
      occ += (h - min(d, q.y)) * w;
      w *= 0.7;
    }
  }
  ao = clamp(1.0 - 2.4 * occ, 0.0, 1.0);
}
`;

/** The shaders, for a grid. */
function sources(g: Grid) {
const { GX, GY, GZ, TX, AW, AH, CELL } = g;
/** The smoke's grid in GLSL: cells ↔ atlas texels, trilinear samples. */
const GRID = `
const ivec3 GI = ivec3(${GX}, ${GY}, ${GZ});
const vec3 GN = vec3(${GX}.0, ${GY}.0, ${GZ}.0);
const vec2 ATLAS = vec2(${AW}.0, ${AH}.0);
const vec3 BMIN = vec3(${BMIN.join(', ')});
const float CELL = ${CELL};
ivec3 cellAt(vec2 frag) {
  ivec2 f = ivec2(frag);
  int tx = f.x / ${GX}, ty = f.y / ${GY};
  return ivec3(f.x - tx * ${GX}, f.y - ty * ${GY}, ty * ${TX} + tx);
}
ivec2 texelOf(ivec3 c) {
  c = clamp(c, ivec3(0), GI - 1);
  return ivec2((c.z % ${TX}) * ${GX} + c.x, (c.z / ${TX}) * ${GY} + c.y);
}
vec4 at(sampler2D s, ivec3 c) { return texelFetch(s, texelOf(c), 0); }
bool outside(ivec3 c) { return any(lessThan(c, ivec3(0))) || any(greaterThanEqual(c, GI)); }
// Trilinear: two bilinear samples in the slices round g.z (g.xy kept to texel centres: nothing bleeds between tiles).
vec4 tri(sampler2D s, vec3 g) {
  g = clamp(g, vec3(0.0), GN - 1.0);
  float z0 = floor(g.z);
  float z1 = min(z0 + 1.0, GN.z - 1.0);
  vec2 o0 = vec2(mod(z0, ${TX}.0), floor(z0 / ${TX}.0)) * GN.xy;
  vec2 o1 = vec2(mod(z1, ${TX}.0), floor(z1 / ${TX}.0)) * GN.xy;
  return mix(texture(s, (o0 + g.xy + 0.5) / ATLAS), texture(s, (o1 + g.xy + 0.5) / ATLAS), g.z - z0);
}
vec3 gridOf(vec3 p) { return (p - BMIN) / CELL - 0.5; }
vec3 worldOf(ivec3 c) { return BMIN + (vec3(c) + 0.5) * CELL; }
// The fine grid of the density: twice the cells each way, 8 × 12 tiles.
const ivec3 GI2 = ivec3(${GX * 2}, ${GY * 2}, ${GZ * 2});
const vec3 GN2 = vec3(${GX * 2}.0, ${GY * 2}.0, ${GZ * 2}.0);
const vec2 ATLAS2 = vec2(${AW * 2}.0, ${AH * 4}.0);
const float CELL2 = CELL * 0.5;
ivec3 cellAt2(vec2 frag) {
  ivec2 f = ivec2(frag);
  int tx = f.x / ${GX * 2}, ty = f.y / ${GY * 2};
  return ivec3(f.x - tx * ${GX * 2}, f.y - ty * ${GY * 2}, ty * ${TX} + tx);
}
ivec2 texelOf2(ivec3 c) {
  c = clamp(c, ivec3(0), GI2 - 1);
  return ivec2((c.z % ${TX}) * ${GX * 2} + c.x, (c.z / ${TX}) * ${GY * 2} + c.y);
}
vec4 at2(sampler2D s, ivec3 c) { return texelFetch(s, texelOf2(c), 0); }
vec4 tri2(sampler2D s, vec3 g) {
  g = clamp(g, vec3(0.0), GN2 - 1.0);
  float z0 = floor(g.z);
  float z1 = min(z0 + 1.0, GN2.z - 1.0);
  vec2 o0 = vec2(mod(z0, ${TX}.0), floor(z0 / ${TX}.0)) * GN2.xy;
  vec2 o1 = vec2(mod(z1, ${TX}.0), floor(z1 / ${TX}.0)) * GN2.xy;
  return mix(texture(s, (o0 + g.xy + 0.5) / ATLAS2), texture(s, (o1 + g.xy + 0.5) / ATLAS2), g.z - z0);
}
vec3 gridOf2(vec3 p) { return (p - BMIN) / CELL2 - 0.5; }
vec3 worldOf2(ivec3 c) { return BMIN + (vec3(c) + 0.5) * CELL2; }
// The density at a point (the fine grid).
float densityAt(sampler2D s, vec3 p) { return tri2(s, gridOf2(p)).r; }
`;
/** A sim pass: its cell, solid cells (below the table, inside the burner). */
const SIM_HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
${GRID}
uniform sampler2D uSdf;
bool solid(ivec3 c) { return c.y < 0 || (!outside(c) && at(uSdf, c).r < 0.0); }
out vec4 o;
const ivec3 X = ivec3(1, 0, 0), Y = ivec3(0, 1, 0), Z = ivec3(0, 0, 1);
`;

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

/** The burner, ray marched: linear colour, and (first sample) the distance along the ray in .a. Mode 1: the field
 * sampled into the smoke's grid instead (the obstacle). */
const sceneSource = (model: BurnerModel) => `#version 300 es
precision highp float;
${HELPERS}
${model.glsl}
${NORMAL_AO}
uniform int uMode;
uniform vec2 uSize;
uniform vec3 uCam;
uniform mat3 uCamRot;
uniform float uTan;
uniform vec2 uJitter;
uniform vec3 uBMin;
uniform vec3 uBMax;
out vec4 outColor;

float softShadow(vec3 ro, vec3 rd) {
  float res = 1.0, t = 0.015;
  for (int i = uZero; i < 56; i++) {
    vec3 p = ro + rd * t;
    if (p.y > 1.95 || abs(p.x) > 1.0 || abs(p.z) > 0.75) break;
    vec2 hm = mapM(p);
    float h = hm.x;
    // Bounds are not surfaces: no penumbra from them. (A wide penumbra: the key light is a big softbox.)
    if (hm.y > 0.0) res = min(res, 4.0 * h / t);
    if (res < 0.002) return 0.0;
    t += clamp(h, 0.008, 0.12);
  }
  return clamp(res, 0.0, 1.0);
}

// mat: from the march (0 the table).
vec3 shade(vec3 p, vec3 rd, float mat) {
  bool onTable = mat < 0.5;
  vec3 n;
  float ao;
  normalAO(p, onTable, n, ao);
  vec3 alb; float rough; float glaze; float metal = 0.0;
  vec3 v = -rd;
  if (onTable) {
    table(p, alb, rough, glaze);
  } else {
    vec3 sc;
    if (special(mat, p, n, rd, sc)) return sc;
    surface(mat, p, rd, ao, n, alb, rough, glaze, metal);
  }
  float sh = softShadow(p + n * 0.004, uKey);
  float nl = max(dot(n, uKey), 0.0);
  vec3 hk = normalize(uKey + v);
  float nv = max(dot(n, v), 1e-3);
  float fres = 0.04 + 0.96 * pow(1.0 - nv, 5.0);
  vec3 key = KEY_COL * uKeyI;
  vec3 col = alb * (1.0 - metal) * (key * nl * sh + AMB_COL * (0.5 + 0.5 * dot(n, FILL)) * ao + vec3(0.06) * ao);
  vec3 f0 = mix(vec3(0.04), alb, metal);
  col += key * sh * nl * ggx(max(dot(n, hk), 0.0), rough) * mix(f0, vec3(1.0), pow(1.0 - max(dot(hk, v), 0.0), 5.0)) * (0.3 + 0.7 * max(glaze, metal));
  // Rim from the back.
  col += vec3(0.7, 0.8, 1.0) * 0.35 * pow(1.0 - nv, 3.0) * max(dot(n, RIM), 0.0) * ao;
  // Reflections of the room in the glaze (metal: tinted by itself).
  vec3 refl = studio(reflect(rd, n));
  col += refl * mix(vec3(fres * glaze), mix(alb, vec3(1.0), fres), metal) * ao * (1.0 - rough * 0.8);
  if (onTable) col = tableFade(p, col);
  return col;
}

void main() {
  bool bake = uMode == 1;
  vec3 ro, rd;
  float t = 0.0, tMax = 1.0, tTable = 1e5;
  vec3 bg = vec3(0.0);
  if (bake) {
    // The obstacle for the smoke: the field (with the table) at each cell's centre — the march's first step.
    ivec2 f = ivec2(gl_FragCoord.xy);
    int tx = f.x / ${GX}, ty = f.y / ${GY};
    vec3 c = vec3(float(f.x - tx * ${GX}), float(f.y - ty * ${GY}), float(ty * ${TX} + tx));
    ro = vec3(${BMIN.join(', ')}) + (c + 0.5) * ${CELL};
    rd = vec3(0.0, 1.0, 0.0);
  } else {
    vec2 px = gl_FragCoord.xy + uJitter;
    vec2 uv = (px - 0.5 * uSize) / (0.5 * uSize.y);
    rd = normalize(uCamRot * vec3(uv * uTan, 1.0));
    ro = uCam;
    bg = backdrop(uv);
    tTable = rd.y < 0.0 ? -ro.y / rd.y : 1e5;
    tMax = min(tTable, 12.0);
    vec3 inv = 1.0 / rd;
    vec3 t0 = (uBMin - ro) * inv, t1 = (uBMax - ro) * inv;
    vec3 tn = min(t0, t1), tf = max(t0, t1);
    float a = max(max(tn.x, tn.y), tn.z), b = min(min(tf.x, tf.y), tf.z);
    if (b < max(a, 0.0)) t = tMax;
    else { t = max(a, 0.0); tMax = min(tMax, b); }
  }
  float hitT = -1.0, mat = 0.0;
  for (int i = uZero; i < 300; i++) {
    if (t >= tMax) break;
    vec3 p = ro + rd * t;
    vec2 dm = mapM(p);
    if (bake) {
      outColor = vec4(min(dm.x, p.y), 0.0, 0.0, 1.0);
      return;
    }
    if (dm.x < 0.0005 * t) { hitT = t; mat = dm.y; break; }
    t += dm.x * MARCH_K;
  }
  vec3 col;
  float depth;
  if (hitT > 0.0) {
    col = shade(ro + rd * hitT, rd, max(mat, 1.0));
    depth = hitT;
  } else if (tTable < 1e4) {
    vec3 pt = ro + rd * tTable;
    float m = tableMask(pt);
    col = m > 0.0 ? mix(bg, shade(pt, rd, 0.0), m) : bg;
    depth = m > 0.5 ? tTable : 60.0;
  } else {
    col = bg;
    depth = 60.0;
  }
  outColor = vec4(col, depth);
}`;


// --- the smoke's passes ------------------------------------------------------------------------------------------
// --- the smoke's passes ------------------------------------------------------------------------------------------
/** 1. The velocity carried along by itself, damped a little. */
const ADVECT_V = `${SIM_HEAD}
uniform sampler2D uVel;
uniform float uDt;
uniform float uDamp;
void main() {
  ivec3 c = cellAt(gl_FragCoord.xy);
  if (solid(c)) { o = vec4(0.0); return; }
  vec3 v = at(uVel, c).xyz;
  o = vec4(tri(uVel, vec3(c) - uDt * v / CELL).xyz * exp(-uDt * uDamp), 0.0);
}`;
/** 2. The curl (and its size). */
const CURL = `${SIM_HEAD}
uniform sampler2D uVel;
void main() {
  ivec3 c = cellAt(gl_FragCoord.xy);
  vec3 dx = at(uVel, c + X).xyz - at(uVel, c - X).xyz;
  vec3 dy = at(uVel, c + Y).xyz - at(uVel, c - Y).xyz;
  vec3 dz = at(uVel, c + Z).xyz - at(uVel, c - Z).xyz;
  vec3 w = vec3(dy.z - dz.y, dz.x - dx.z, dx.y - dy.x) / (2.0 * CELL);
  o = vec4(w, length(w));
}`;
/** 3. Forces: eddies kept up (vorticity confinement), the smoke's weight, the mouth, the cursor. */
const FORCE = `${SIM_HEAD}
uniform sampler2D uVel;
uniform sampler2D uCurl;
uniform sampler2D uDens;
uniform float uDt;
uniform float uEps;
uniform float uHeavy;
uniform float uSpeed;
uniform vec3 uMouth;
uniform vec3 uMouthDir;
uniform float uMouthR;
uniform vec3 uPtrO;
uniform vec3 uPtrD;
uniform vec3 uPtrV;
uniform float uPtrOn;
// The channel the smoke clings to: zTop, yTop, slope, strength; wiggle (amp, freq), cx, hw; y0, range.
uniform vec4 uClingA;
uniform vec4 uClingB;
uniform vec2 uClingC;
void main() {
  ivec3 c = cellAt(gl_FragCoord.xy);
  if (solid(c)) { o = vec4(0.0); return; }
  vec3 v = at(uVel, c).xyz;
  vec3 w = at(uCurl, c).xyz;
  vec3 eta = vec3(at(uCurl, c + X).w - at(uCurl, c - X).w, at(uCurl, c + Y).w - at(uCurl, c - Y).w, at(uCurl, c + Z).w - at(uCurl, c - Z).w);
  float el = length(eta);
  vec3 pc = worldOf(c);
  float rho = densityAt(uDens, pc);
  // Confinement where there is smoke (the clear air needs no eddies of its own).
  vec3 f = el > 1e-6 ? uEps * CELL * cross(eta / el, w) * smoothstep(0.0, 0.08, rho + 0.3 * densityAt(uDens, pc + vec3(0.0, 2.0 * CELL, 0.0))) : vec3(0.0);
  f.y -= uHeavy * rho;
  vec3 p = worldOf(c);
  if (uClingA.w > 0.0 && p.y > uClingC.x && p.y < uClingA.y) {
    float h = uClingA.y - p.y;
    float dz = p.z - (uClingA.x + h * uClingA.z + uClingB.x * sin(h * uClingB.y));
    float across = 1.0 - smoothstep(uClingB.w - 0.05, uClingB.w, abs(p.x - uClingB.z));
    // Pulled back onto the floor (its normal is about −z), only inside the thin layer over it.
    if (dz > 0.0 && dz < uClingC.y) f.z -= uClingA.w * rho * across * (1.0 - dz / uClingC.y);
  }
  if (uPtrOn > 0.5) {
    vec3 q = p - uPtrO;
    float along = dot(q, uPtrD);
    float dist = length(q - uPtrD * along);
    f += uPtrV * 5.0 * exp(-dist * dist / (0.09 * 0.09));
  }
  v += f * uDt;
  // The mouth: the smoke leaves it with a speed of its own.
  float m = 1.0 - smoothstep(uMouthR, 2.0 * uMouthR, length(p - uMouth));
  v = mix(v, uMouthDir * uSpeed, m);
  o = vec4(v, 0.0);
}`;
/** 4. Divergence (the burner's faces let nothing through). */
const DIV = `${SIM_HEAD}
uniform sampler2D uVel;
float face(ivec3 n, int k) { return solid(n) ? 0.0 : at(uVel, n)[k]; }
void main() {
  ivec3 c = cellAt(gl_FragCoord.xy);
  if (solid(c)) { o = vec4(0.0); return; }
  float d = face(c + X, 0) - face(c - X, 0) + face(c + Y, 1) - face(c - Y, 1) + face(c + Z, 2) - face(c - Z, 2);
  o = vec4(d / (2.0 * CELL), 0.0, 0.0, 0.0);
}`;
/** 5. Pressure, one Jacobi iteration: the burner's faces closed (its pressure taken as the cell's own), the box's
 * open sides and top at zero (the air flows freely out). */
const JACOBI = `${SIM_HEAD}
uniform sampler2D uPres;
uniform sampler2D uDiv;
// −1: a plain Jacobi step. 0 / 1: red-black Gauss–Seidel with over-relaxation — only the cells of this colour move
// (towards their neighbours' latest values, overshooting by uOmega), the others keep theirs: converges several
// times faster for the same number of passes.
uniform int uParity;
uniform float uOmega;
float P(ivec3 n, float pc) { return solid(n) ? pc : outside(n) ? 0.0 : at(uPres, n).r; }
void main() {
  ivec3 c = cellAt(gl_FragCoord.xy);
  if (solid(c)) { o = vec4(0.0); return; }
  float pc = at(uPres, c).r;
  float s = P(c + X, pc) + P(c - X, pc) + P(c + Y, pc) + P(c - Y, pc) + P(c + Z, pc) + P(c - Z, pc);
  float pj = (s - at(uDiv, c).r * CELL * CELL) / 6.0;
  if (uParity >= 0) {
    if (((c.x + c.y + c.z) & 1) != uParity) { o = vec4(pc, 0.0, 0.0, 0.0); return; }
    pj = mix(pc, pj, uOmega);
  }
  o = vec4(pj, 0.0, 0.0, 0.0);
}`;
/** 6. The pressure's gradient taken away; along the burner, what goes into it is taken away too (it slides). */
const PROJECT = `${SIM_HEAD}
uniform sampler2D uVel;
uniform sampler2D uPres;
float P(ivec3 n, float pc) { return solid(n) ? pc : outside(n) ? 0.0 : at(uPres, n).r; }
void main() {
  ivec3 c = cellAt(gl_FragCoord.xy);
  if (solid(c)) { o = vec4(0.0); return; }
  float pc = at(uPres, c).r;
  vec3 g = vec3(P(c + X, pc) - P(c - X, pc), P(c + Y, pc) - P(c - Y, pc), P(c + Z, pc) - P(c - Z, pc)) / (2.0 * CELL);
  vec3 v = at(uVel, c).xyz - g;
  // Next to the burner (a solid neighbour — not just a small distance, which may be a bound):
  if (solid(c + X) || solid(c - X) || solid(c + Y) || solid(c - Y) || solid(c + Z) || solid(c - Z)) {
    vec3 n = vec3(at(uSdf, c + X).r - at(uSdf, c - X).r, at(uSdf, c + Y).r - at(uSdf, c - Y).r, at(uSdf, c + Z).r - at(uSdf, c - Z).r);
    n = n / max(length(n), 1e-6);
    float vn = dot(v, n);
    if (vn < 0.0) v -= n * vn;
  }
  o = vec4(v, 0.0);
}`;
/** 7. The density carried along (the first, plain step of MacCormack), on the fine grid: the velocity read from
 * the coarse one at each fine cell. */
const ADVECT_D1 = `${SIM_HEAD}
uniform sampler2D uDens;
uniform sampler2D uVel;
uniform float uDt;
void main() {
  ivec3 c = cellAt2(gl_FragCoord.xy);
  vec3 p = worldOf2(c);
  if (tri(uSdf, gridOf(p)).r < 0.0) { o = vec4(0.0); return; }
  vec3 v = tri(uVel, gridOf(p)).xyz;
  o = vec4(densityAt(uDens, p - uDt * v), 0.0, 0.0, 0.0);
}`;
/** 8. MacCormack's correction (back again, half the error put right, kept within the cells it came from), the fading,
 * the box's edges (it flows on beyond them), the mouth. */
const ADVECT_D2 = `${SIM_HEAD}
uniform sampler2D uDens;
uniform sampler2D uHat;
uniform sampler2D uVel;
uniform float uDt;
uniform float uDecay;
uniform float uAmount;
uniform vec3 uMouth;
uniform float uMouthR;
void main() {
  ivec3 c = cellAt2(gl_FragCoord.xy);
  vec3 p = worldOf2(c);
  if (tri(uSdf, gridOf(p)).r < 0.0) { o = vec4(0.0); return; }
  vec3 v = tri(uVel, gridOf(p)).xyz;
  float hat = at2(uHat, c).r;
  float back = densityAt(uHat, p + uDt * v);
  float r = hat + 0.5 * (at2(uDens, c).r - back);
  vec3 g = clamp(gridOf2(p - uDt * v), vec3(0.0), GN2 - 1.0);
  ivec3 b = ivec3(floor(g));
  float lo = 1e9, hi = -1e9;
  for (int k = 0; k < 8; k++) {
    float s = at2(uDens, b + ivec3(k & 1, (k >> 1) & 1, k >> 2)).r;
    lo = min(lo, s);
    hi = max(hi, s);
  }
  r = clamp(r, lo, hi) * exp(-uDt * uDecay);
  vec3 e = min(vec3(c), GN2 - 1.0 - vec3(c));
  r *= smoothstep(0.0, 10.0, min(e.x, e.z)) * smoothstep(0.0, 6.0, e.y + 6.0 * float(c.y < 8));
  float m = 1.0 - smoothstep(0.8 * uMouthR, 1.7 * uMouthR, length(p - uMouth));
  r = max(r, m * uAmount);
  o = vec4(clamp(r, 0.0, 1.5), 0.0, 0.0, 0.0);
}`;
/** 9. The light: how much of the key light reaches each cell — through the smoke (r), and through the smoke and the
 * burner both (g). */
const LIGHT = `${SIM_HEAD}
uniform sampler2D uDens;
uniform vec3 uKey;
uniform float uSigma;
void main() {
  ivec3 c = cellAt(gl_FragCoord.xy);
  vec3 g = vec3(c);
  float tau = 0.0, block = 0.0;
  for (int i = 1; i <= 24; i++) {
    vec3 q = g + uKey * (${(1.4 * GX / 64).toFixed(4)} * float(i));
    if (any(lessThan(q, vec3(-0.5))) || any(greaterThan(q, GN - 0.5))) break;
    tau += densityAt(uDens, BMIN + (q + 0.5) * CELL);
    if (block < 1.0 && tri(uSdf, q).r < 0.0) block = 1.0;
  }
  float t = exp(-tau * uSigma * ${(1.4 * GX / 64).toFixed(4)} * CELL);
  o = vec4(t, t * (1.0 - block), 0.0, 0.0);
}`;
/** 9b. Where there is smoke at all: per block of 8³ fine cells (a 2D atlas of OX × OY tiles, OZ of them in a row),
 * the density averaged over 2³ groups (bilinear taps between texels) and the largest of those kept; a cell beyond the
 * block on each side is included, so the march's trilinear samples never miss what lies just over a block's edge. */
const OCC = `#version 300 es
precision highp float;
precision highp sampler2D;
${GRID}
uniform sampler2D uDens;
out vec4 o;
void main() {
  ivec2 f = ivec2(gl_FragCoord.xy);
  int oz = f.x / ${GX / 4};
  ivec3 b = ivec3(f.x - oz * ${GX / 4}, f.y, oz) * 8;
  float m = 0.0;
  for (int k = -1; k <= 8; k++) {
    int z = clamp(b.z + k, 0, GI2.z - 1);
    vec2 tile = vec2(float(z % ${TX}), float(z / ${TX})) * GN2.xy;
    for (int j = 0; j < 5; j++) for (int i = 0; i < 5; i++) {
      vec2 xy = clamp(vec2(b.xy) + vec2(float(i), float(j)) * 2.0, vec2(1.0), GN2.xy - 1.0);
      m = max(m, texture(uDens, (tile + xy) / ATLAS2).r);
    }
  }
  o = vec4(m, 0.0, 0.0, 0.0);
}`;
/** 10. The smoke seen: each pixel's ray marched through the grid, up to the burner. */
const RENDER = `#version 300 es
precision highp float;
precision highp sampler2D;
${GRID}
uniform sampler2D uDens;
uniform sampler2D uLight;
uniform sampler2D uScene;
uniform vec2 uSize;
uniform vec3 uCam;
uniform mat3 uCamRot;
uniform float uTan;
uniform vec3 uKey;
uniform float uKeyI;
uniform float uSigma;
uniform float uFrame;
// Filters: the step (× the cell), "powder" (thin edges of dense smoke darker, as light scattered in and out), detail
// (noise carried with time breaking the smoke into finer wisps than the grid holds), the previous frame blended in.
uniform float uStepK;
uniform float uPowder;
uniform float uDetail;
uniform float uTime;
uniform sampler2D uOcc;
uniform float uSkip;
out vec4 o;
const vec3 RIM = normalize(vec3(0.45, 0.5, -0.75));
float hash12(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float h13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vn(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h13(i), h13(i + vec3(1, 0, 0)), f.x), mix(h13(i + vec3(0, 1, 0)), h13(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h13(i + vec3(0, 0, 1)), h13(i + vec3(1, 0, 1)), f.x), mix(h13(i + vec3(0, 1, 1)), h13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float hg(float c, float g) { float g2 = g * g; return (1.0 - g2) / (4.0 * 3.14159 * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }
void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  vec2 q = (gl_FragCoord.xy - 0.5 * uSize) / (0.5 * uSize.y);
  vec3 rd = normalize(uCamRot * vec3(q * uTan, 1.0));
  float tScene = texture(uScene, uv).a;
  vec3 bmax = BMIN + GN * CELL;
  vec3 inv = 1.0 / rd;
  vec3 t0 = (BMIN - uCam) * inv, t1 = (bmax - uCam) * inv;
  vec3 tn = min(t0, t1), tf = max(t0, t1);
  float ta = max(max(tn.x, tn.y), max(tn.z, 0.0));
  float tb = min(min(min(tf.x, tf.y), tf.z), tScene);
  vec3 col = vec3(0.0);
  float T = 1.0;
  if (tb > ta) {
    float ds = CELL * 0.6 / max(uStepK, 0.25);
    float t = ta + ds * hash12(gl_FragCoord.xy + fract(uFrame * 0.61803) * 97.0);
    // Light scattered towards the eye: mostly forward (the key light from behind the smoke glows), some back.
    float cosK = dot(rd, -uKey);
    float phase = mix(hg(cosK, 0.55), hg(cosK, -0.2), 0.35) * 12.566;
    float rimPh = pow(max(dot(rd, -RIM), 0.0), 8.0);
    vec3 keyCol = vec3(1.0, 0.9, 0.8) * 1.9 * uKeyI;
    vec3 amb = vec3(0.3, 0.34, 0.42) * 0.38;
    for (int i = 0; i < 200; i++) {
      if (t > tb) break;
      vec3 pw = uCam + rd * t;
      vec3 g = gridOf(pw);
      float rho = densityAt(uDens, pw);
      if (rho > 0.002 && uDetail > 0.0) {
        // Finer wisps: noise drifting slowly downwards (as the smoke runs), eating into the thin parts more.
        float nz = vn(pw * 90.0 + vec3(0.0, uTime * 1.5, 0.0)) * 0.6 + vn(pw * 210.0 + vec3(uTime * 0.7, uTime * 2.5, 0.0)) * 0.4;
        rho = max(0.0, rho * (1.0 + uDetail * (nz - 0.5) * 1.6) - uDetail * 0.06 * nz);
      }
      if (rho > 0.002) {
        // Dense smoke reads as a body with a clear edge, thin smoke as a veil.
        float sig = uSigma * (0.9 * smoothstep(0.03, 0.3, rho) + 0.35 * rho);
        float a = 1.0 - exp(-sig * ds);
        vec2 L = tri(uLight, g).rg;
        float powder = mix(1.0, 2.0 * (1.0 - exp(-sig * ds * 6.0)), uPowder);
        vec3 Li = keyCol * L.g * phase * powder + amb * (0.55 + 0.45 * L.r) + vec3(0.7, 0.8, 1.0) * 1.2 * rimPh * L.r;
        col += T * a * Li * vec3(0.86, 0.87, 0.9);
        T *= 1.0 - a;
        if (T < 0.004) break;
        t += ds;
      } else if (uSkip > 0.5) {
        // Empty here: if the whole block is empty, jump to where the ray leaves it.
        vec3 g2 = gridOf2(pw);
        ivec3 bc = clamp(ivec3(floor(g2 / 8.0)), ivec3(0), ivec3(${GX / 4 - 1}, ${GY / 4 - 1}, ${GZ / 4 - 1}));
        if (texelFetch(uOcc, ivec2(bc.z * ${GX / 4} + bc.x, bc.y), 0).r < 0.002) {
          vec3 lo = BMIN + vec3(bc) * 8.0 * CELL2, hi = lo + 8.0 * CELL2;
          vec3 ta = (lo - uCam) * inv, tb2 = (hi - uCam) * inv;
          vec3 tf2 = max(ta, tb2);
          t = max(t + ds, min(min(tf2.x, tf2.y), tf2.z) + ds * 0.5);
        } else {
          t += ds * 1.8;
        }
      } else {
        t += ds * 1.8;
      }
    }
  }
  o = vec4(col, 1.0 - T);
}`;
/** 10b. The frame before blended in (the smoke moves little from frame to frame): less of the march's grain. The
 * history is first held within the range of this frame's 3 × 3 neighbourhood, so moving smoke leaves no trail. */
const RESOLVE = `#version 300 es
precision highp float;
uniform sampler2D uCur;
uniform sampler2D uPrev;
uniform vec2 uSize;
uniform float uTaa;
out vec4 o;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 cur = texelFetch(uCur, c, 0);
  if (uTaa <= 0.0) { o = cur; return; }
  vec4 mn = cur, mx = cur;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec4 s = texelFetch(uCur, clamp(c + ivec2(i, j), ivec2(0), ivec2(uSize) - 1), 0);
    mn = min(mn, s);
    mx = max(mx, s);
  }
  vec4 prev = clamp(texelFetch(uPrev, c, 0), mn, mx);
  o = mix(cur, prev, uTaa);
}`;
/** 11. The burner, darkened where the smoke shades it, and the smoke over it (joined by depth), tone-mapped. */
const COMPOSE = `#version 300 es
precision highp float;
precision highp sampler2D;
${GRID}
uniform sampler2D uScene;
uniform sampler2D uSmoke;
uniform sampler2D uLight;
uniform vec2 uSize;
uniform vec2 uSmokeSize;
uniform vec3 uCam;
uniform mat3 uCamRot;
uniform float uTan;
uniform float uExposure;
uniform float uShade;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  vec4 sc = texture(uScene, uv);
  vec3 col = sc.rgb;
  if (sc.a < 50.0) {
    vec2 q = (gl_FragCoord.xy - 0.5 * uSize) / (0.5 * uSize.y);
    vec3 rd = normalize(uCamRot * vec3(q * uTan, 1.0));
    vec3 g = gridOf(uCam + rd * (sc.a - 0.01));
    // (fading out towards the grid's sides, so its edge does not show)
    vec3 e = min(g + 0.5, GN - 0.5 - g);
    float inside = smoothstep(0.0, 6.0, min(e.x, e.z)) * step(0.0, min(e.y, 1.0));
    col *= mix(1.0, tri(uLight, g).r, uShade * inside);
  }
  // The smoke from its half-size picture: the four nearest samples, those at the depth of this pixel weighted up (so
  // it does not bleed over the burner's edges).
  vec2 hp = uv * uSmokeSize - 0.5;
  vec2 b = floor(hp), f = hp - b;
  vec4 acc = vec4(0.0);
  float ws = 0.0;
  for (int k = 0; k < 4; k++) {
    vec2 oo = vec2(float(k & 1), float(k >> 1));
    vec2 suv = (b + oo + 0.5) / uSmokeSize;
    float w = (oo.x > 0.5 ? f.x : 1.0 - f.x) * (oo.y > 0.5 ? f.y : 1.0 - f.y) + 1e-4;
    float dk = texture(uScene, suv).a;
    w /= 0.01 + abs(dk - sc.a) / max(sc.a, 0.5) * 20.0;
    acc += texture(uSmoke, suv) * w;
    ws += w;
  }
  vec4 s = acc / ws;
  col = col * (1.0 - s.a) + s.rgb;
  col *= uExposure;
  col = 1.0 - exp(-col);
  vec2 vq = uv - 0.5;
  col *= 1.0 - 0.35 * dot(vq, vq) * 2.0;
  o = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
}`;
return { VERT, sceneSource, ADVECT_V, CURL, FORCE, DIV, JACOBI, PROJECT, ADVECT_D1, ADVECT_D2, LIGHT, OCC, RENDER, RESOLVE, COMPOSE };
}

export type DragonBurner = ReturnType<typeof createDragonBurner>;

/** How the camera is turned from the model's own view: about the vertical (°), up or down (°), closer (×). */
export type BurnerView = { yaw: number; pitch: number; zoom: number };
/** The smoke's drawing: its picture's size (× the canvas), the march's step (× finer), powder, detail, how much of the
 * frame before is kept, how much the smoke shades the burner. */
export type SmokeLook = {
  res: number; step: number; powder: number; detail: number; taa: number; shade: number;
  /** Skip empty blocks in the march. */
  skip: boolean;
  /** Pressure: 0 Jacobi, 1 red-black SOR; and how many passes. */
  solver: number;
  passes: number;
  /** Step the smoke only every other frame (twice the time step). */
  halfRate: boolean;
};

export function createDragonBurner(width: number, height: number, model: BurnerModel, gridLevel = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) return null;
  const ctx = gl;
  const G = gridFor(gridLevel);
  const { AW, AH, AW2, AH2 } = G;
  const S = sources(G);
  // Compiled in the background where the browser can (KHR_parallel_shader_compile): the burner's shader takes seconds,
  // and asking for its status before it is done would block the page.
  const parallel = gl.getExtension('KHR_parallel_shader_compile');
  const shaders: WebGLShader[] = [];
  const shader = (type: number, src: string) => {
    const s = ctx.createShader(type)!;
    ctx.shaderSource(s, src);
    ctx.compileShader(s);
    shaders.push(s);
    return s;
  };
  const vert = shader(gl.VERTEX_SHADER, S.VERT);
  const programs: WebGLProgram[] = [];
  const program = (fs: string) => {
    const p = ctx.createProgram()!;
    ctx.attachShader(p, vert);
    ctx.attachShader(p, shader(ctx.FRAGMENT_SHADER, fs));
    ctx.bindAttribLocation(p, 0, 'aPos');
    ctx.linkProgram(p);
    programs.push(p);
    return p;
  };
  const P = {
    scene: program(S.sceneSource(model)), advectV: program(S.ADVECT_V), curl: program(S.CURL), force: program(S.FORCE), div: program(S.DIV),
    jacobi: program(S.JACOBI), project: program(S.PROJECT), advectD1: program(S.ADVECT_D1), advectD2: program(S.ADVECT_D2),
    light: program(S.LIGHT), occ: program(S.OCC), render: program(S.RENDER), resolve: program(S.RESOLVE), compose: program(S.COMPOSE),
  };
  const uniCache = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
  const loc = (p: WebGLProgram, name: string) => {
    let m = uniCache.get(p);
    if (!m) uniCache.set(p, (m = new Map()));
    if (!m.has(name)) m.set(name, ctx.getUniformLocation(p, name));
    return m.get(name) ?? null;
  };

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const tex = (w: number, h: number, internal: number, format: number, type: number, filter: number) => {
    const t = ctx.createTexture()!;
    ctx.bindTexture(ctx.TEXTURE_2D, t);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, filter);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, filter);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);
    ctx.texImage2D(ctx.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
    return t;
  };
  const fbo = (t: WebGLTexture) => {
    const f = ctx.createFramebuffer()!;
    ctx.bindFramebuffer(ctx.FRAMEBUFFER, f);
    ctx.framebufferTexture2D(ctx.FRAMEBUFFER, ctx.COLOR_ATTACHMENT0, ctx.TEXTURE_2D, t, 0);
    return f;
  };
  /** A target: its texture and framebuffer (null: the canvas). */
  type Target = { t: WebGLTexture; f: WebGLFramebuffer | null; w: number; h: number };
  const target = (w: number, h: number, internal: number, format: number, type: number, filter: number): Target => {
    const t = tex(w, h, internal, format, type, filter);
    return { t, f: fbo(t), w, h };
  };
  const grid4 = () => target(AW, AH, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR);
  const grid1 = () => target(AW, AH, gl.R16F, gl.RED, gl.HALF_FLOAT, gl.LINEAR);
  const fine1 = () => target(AW2, AH2, gl.R16F, gl.RED, gl.HALF_FLOAT, gl.LINEAR);
  const drop = (t: Target) => {
    gl.deleteTexture(t.t);
    gl.deleteFramebuffer(t.f);
  };

  // The burner: accumulated linear colour, the distance along the ray in alpha (from the first, unjittered sample);
  // and a third-size picture drawn whole while the camera moves.
  const scene = target(width, height, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST);
  const lw = Math.max(1, Math.round(width / 3)), lh = Math.max(1, Math.round(height / 3));
  const sceneLo = target(lw, lh, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST);
  // The smoke's grid.
  const sdf = grid1();
  let vel = [grid4(), grid4()];
  let dens = [fine1(), fine1()];
  let pres = [grid1(), grid1()];
  const hat = fine1();
  const divT = grid1();
  const curlT = grid4();
  const light = target(AW, AH, gl.RG16F, gl.RG, gl.HALF_FLOAT, gl.LINEAR);
  // Occupancy: a coarse atlas (blocks of 8³ fine cells).
  const occ = target((G.GX / 4) * (G.GZ / 4), G.GY / 4, gl.R16F, gl.RED, gl.HALF_FLOAT, gl.NEAREST);
  // The smoke seen, at a part of the size: this frame's picture and two of history (for blending in the frames
  // before); made again when the size changes.
  let smokeRes = 0;
  let sw = 1, sh = 1;
  let smoke: Target[] = [];
  let histValid = false;
  const sizeSmoke = (res: number) => {
    if (res === smokeRes) return;
    smokeRes = res;
    histValid = false;
    for (const t of smoke) drop(t);
    sw = Math.max(1, Math.round(width * res));
    sh = Math.max(1, Math.round(height * res));
    smoke = [0, 1, 2].map(() => target(sw, sh, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR));
    for (const t of smoke) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.f);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
  };
  sizeSmoke(0.5);
  for (const t of [...vel, ...dens, ...pres, hat, divT, curlT, light]) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.f);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  // Camera: looking at the burner (further back on narrow screens so it fits), turned and moved closer as asked.
  const aspect = width / height;
  const tanHalf = Math.tan((30 * Math.PI) / 360);
  const { fitH, fitW, target: tgt, dir: camDir } = model.camera;
  const dist0 = Math.max(fitH / (2 * tanHalf), fitW / (2 * tanHalf * aspect)) + 0.5;
  let dist = dist0;
  let cam: V3 = [0, 0, 0], cf: V3 = [0, 0, 1], cr: V3 = [1, 0, 0], cu: V3 = [0, 1, 0];
  const camRot = new Float32Array(9);
  let viewKey = '';
  const setView = (v: BurnerView) => {
    const d0 = norm(camDir);
    const elev0 = Math.asin(Math.max(-1, Math.min(1, -d0[1])));
    const az0 = Math.atan2(d0[0], d0[2]);
    const elev = Math.max(-0.35, Math.min(1.35, elev0 + (v.pitch * Math.PI) / 180));
    const az = az0 + (v.yaw * Math.PI) / 180;
    const d: V3 = [Math.cos(elev) * Math.sin(az), -Math.sin(elev), Math.cos(elev) * Math.cos(az)];
    dist = dist0 / Math.max(0.3, v.zoom);
    cam = sub(tgt, mul(d, dist));
    cf = norm(sub(tgt, cam));
    cr = norm(cross([0, 1, 0], cf));
    cu = cross(cf, cr);
    // Column-major mat3 with columns right, up, forward (camera → world). The screen's x runs to the right.
    camRot.set([-cr[0], -cr[1], -cr[2], cu[0], cu[1], cu[2], cf[0], cf[1], cf[2]]);
  };
  setView({ yaw: 0, pitch: 0, zoom: 1 });
  const key = norm(model.key);

  /** Whether the shaders are compiled and linked (then the burner's uniforms are set once). Throws if one failed. */
  let linked = false;
  const ready = () => {
    if (linked) return true;
    if (parallel && programs.some((q) => !gl.getProgramParameter(q, parallel.COMPLETION_STATUS_KHR))) return false;
    for (const q of programs) {
      if (!gl.getProgramParameter(q, gl.LINK_STATUS)) {
        const bad = shaders.find((s) => !gl.getShaderParameter(s, gl.COMPILE_STATUS));
        throw new Error((bad && gl.getShaderInfoLog(bad)) || gl.getProgramInfoLog(q) || 'link');
      }
    }
    const p = P.scene;
    gl.useProgram(p);
    model.setUniforms(gl, (n) => loc(p, n));
    gl.uniform3fv(loc(p, 'uBMin'), model.bounds[0]);
    gl.uniform3fv(loc(p, 'uBMax'), model.bounds[1]);
    gl.uniform3fv(loc(p, 'uKey'), key);
    gl.uniform1f(loc(p, 'uKeyI'), 1);
    // The obstacle grid: the same field, once.
    gl.uniform1i(loc(p, 'uMode'), 1);
    gl.bindFramebuffer(gl.FRAMEBUFFER, sdf.f);
    gl.viewport(0, 0, AW, AH);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.uniform1i(loc(p, 'uMode'), 0);
    linked = true;
    return true;
  };

  /** One full-screen pass of a program into a target, its textures bound to units in order, then its uniforms. */
  const run = (p: WebGLProgram, out: Target, textures: [string, WebGLTexture][], set?: (u: (name: string) => WebGLUniformLocation | null) => void) => {
    gl.useProgram(p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, out.f);
    gl.viewport(0, 0, out.w, out.h);
    textures.forEach(([name, t], i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.uniform1i(loc(p, name), i);
    });
    set?.((name) => loc(p, name));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const setCam = (u: (name: string) => WebGLUniformLocation | null, w: number, h: number) => {
    gl.uniform2f(u('uSize'), w, h);
    gl.uniform3fv(u('uCam'), cam);
    gl.uniformMatrix3fv(u('uCamRot'), false, camRot);
    gl.uniform1f(u('uTan'), tanHalf);
  };

  // The burner's picture is refined in bands (a full ray-marched frame at once would stall), then kept. While the
  // camera moves, the third-size picture is drawn whole every frame instead, until the full one has its first sample.
  const SAMPLES = 8;
  const BANDS = 8;
  let pass = 0;
  let keyI = -1;
  let sim = 0;
  let frameNo = 0;
  let lowActive = false;
  let moved = false;

  const sceneUniforms = (look: DragonLook, w: number, h: number) => {
    const p = P.scene;
    setCam((n) => loc(p, n), w, h);
    gl.uniform3fv(loc(p, 'uKey'), key);
    gl.uniform1f(loc(p, 'uKeyI'), look.light);
  };
  const renderScene = (look: DragonLook, view: BurnerView) => {
    const vk = `${view.yaw.toFixed(2)}|${view.pitch.toFixed(2)}|${view.zoom.toFixed(3)}`;
    moved = vk !== viewKey;
    if (moved) {
      viewKey = vk;
      setView(view);
      pass = 0;
      lowActive = frameNo > 0;
    }
    if (keyI !== look.light) {
      keyI = look.light;
      pass = 0;
    }
    const p = P.scene;
    gl.useProgram(p);
    gl.bindVertexArray(vao);
    if (moved && lowActive) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, sceneLo.f);
      gl.viewport(0, 0, lw, lh);
      sceneUniforms(look, lw, lh);
      gl.uniform2f(loc(p, 'uJitter'), 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return;
    }
    if (pass >= SAMPLES * BANDS) return;
    const sample = Math.floor(pass / BANDS), band = pass % BANDS;
    gl.bindFramebuffer(gl.FRAMEBUFFER, scene.f);
    gl.viewport(0, 0, width, height);
    gl.enable(gl.SCISSOR_TEST);
    const y0 = Math.floor((band * height) / BANDS), y1 = Math.floor(((band + 1) * height) / BANDS);
    gl.scissor(0, y0, width, y1 - y0);
    sceneUniforms(look, width, height);
    gl.uniform2f(loc(p, 'uJitter'), sample ? ((0.5 + sample * 0.7548777) % 1) - 0.5 : 0, sample ? ((0.5 + sample * 0.5698403) % 1) - 0.5 : 0);
    if (sample) {
      // Average the colour; keep the first sample's distance in alpha.
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA, gl.ZERO, gl.ONE);
      gl.blendColor(0, 0, 0, 1 / (sample + 1));
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    pass += 1;
    if (pass >= BANDS) lowActive = false;
  };

  const mouthDir = norm(model.mouthDir);
  const step = (dt: number, look: DragonLook, ptr: { o: V3; d: V3; v: V3; on: boolean }, sl: SmokeLook) => {
    gl.bindVertexArray(vao);
    const SDF: [string, WebGLTexture] = ['uSdf', sdf.t];
    // 1. Velocity carried along.
    run(P.advectV, vel[1], [SDF, ['uVel', vel[0].t]], (u) => {
      gl.uniform1f(u('uDt'), dt);
      // Damped: the stream shares its momentum with the air round it, so it falls at a few centimetres a second.
      gl.uniform1f(u('uDamp'), 0.6 / Math.max(0.1, look.flow));
    });
    vel = [vel[1], vel[0]];
    // 2. Curl, 3. forces.
    run(P.curl, curlT, [SDF, ['uVel', vel[0].t]]);
    run(P.force, vel[1], [SDF, ['uVel', vel[0].t], ['uCurl', curlT.t], ['uDens', dens[0].t]], (u) => {
      gl.uniform1f(u('uDt'), dt);
      gl.uniform1f(u('uEps'), look.swirl * 12);
      gl.uniform1f(u('uHeavy'), look.heavy * 1.6);
      gl.uniform1f(u('uSpeed'), look.spread * 0.3);
      gl.uniform3fv(u('uMouth'), model.mouth);
      gl.uniform3fv(u('uMouthDir'), mouthDir);
      gl.uniform1f(u('uMouthR'), model.mouthR);
      gl.uniform3fv(u('uPtrO'), ptr.o);
      gl.uniform3fv(u('uPtrD'), ptr.d);
      gl.uniform3fv(u('uPtrV'), ptr.v);
      gl.uniform1f(u('uPtrOn'), ptr.on ? 1 : 0);
      const cl = model.cling;
      gl.uniform4f(u('uClingA'), cl?.zTop ?? 0, cl?.yTop ?? 0, cl?.slope ?? 0, cl ? look.cling * look.heavy * 1.6 * 1.5 : 0);
      gl.uniform4f(u('uClingB'), cl?.wig[0] ?? 0, cl?.wig[1] ?? 0, cl?.cx ?? 0, cl?.hw ?? 0);
      gl.uniform2f(u('uClingC'), cl?.y0 ?? 0, cl?.range ?? 0);
    });
    vel = [vel[1], vel[0]];
    // 4. Divergence, 5. pressure (more iterations on a finer grid), 6. projection.
    run(P.div, divT, [SDF, ['uVel', vel[0].t]]);
    const passes = Math.max(2, Math.round(sl.passes * Math.max(1, G.GX / 64)));
    for (let i = 0; i < passes; i += 1) {
      run(P.jacobi, pres[1], [SDF, ['uPres', pres[0].t], ['uDiv', divT.t]], (u) => {
        gl.uniform1i(u('uParity'), sl.solver >= 0.5 ? i & 1 : -1);
        gl.uniform1f(u('uOmega'), 1.7);
      });
      pres = [pres[1], pres[0]];
    }
    run(P.project, vel[1], [SDF, ['uVel', vel[0].t], ['uPres', pres[0].t]]);
    vel = [vel[1], vel[0]];
    // 7–8. Density carried along (MacCormack), faded, born at the source.
    run(P.advectD1, hat, [SDF, ['uDens', dens[0].t], ['uVel', vel[0].t]], (u) => gl.uniform1f(u('uDt'), dt));
    run(P.advectD2, dens[1], [SDF, ['uDens', dens[0].t], ['uHat', hat.t], ['uVel', vel[0].t]], (u) => {
      gl.uniform1f(u('uDt'), dt);
      gl.uniform1f(u('uDecay'), 1 / Math.max(1, look.life));
      gl.uniform1f(u('uAmount'), look.amount * model.smoke);
      gl.uniform3fv(u('uMouth'), model.mouth);
      gl.uniform1f(u('uMouthR'), model.mouthR);
    });
    dens = [dens[1], dens[0]];
    sim += dt;
  };

  const sigma = (look: DragonLook) => 28 * look.density;
  const draw = (look: DragonLook, sl: SmokeLook) => {
    sizeSmoke(Math.max(0.25, Math.min(1, sl.res)));
    const sceneT = lowActive ? sceneLo.t : scene.t;
    gl.bindVertexArray(vao);
    // 9. The light through the smoke.
    run(P.light, light, [['uSdf', sdf.t], ['uDens', dens[0].t]], (u) => {
      gl.uniform3fv(u('uKey'), key);
      gl.uniform1f(u('uSigma'), sigma(look));
    });
    // 9b. Where there is smoke.
    if (sl.skip) run(P.occ, occ, [['uDens', dens[0].t]]);
    // 10. The smoke seen.
    run(P.render, smoke[0], [['uDens', dens[0].t], ['uLight', light.t], ['uScene', sceneT], ['uOcc', occ.t]], (u) => {
      setCam(u, sw, sh);
      gl.uniform3fv(u('uKey'), key);
      gl.uniform1f(u('uKeyI'), look.light);
      gl.uniform1f(u('uSigma'), sigma(look));
      gl.uniform1f(u('uFrame'), frameNo);
      gl.uniform1f(u('uStepK'), sl.step);
      gl.uniform1f(u('uPowder'), sl.powder);
      gl.uniform1f(u('uDetail'), sl.detail);
      gl.uniform1f(u('uTime'), sim);
      gl.uniform1f(u('uSkip'), sl.skip ? 1 : 0);
    });
    // 10b. The frames before blended in (not right after the camera moved or the size changed).
    const taa = moved || !histValid ? 0 : Math.max(0, Math.min(0.9, sl.taa));
    run(P.resolve, smoke[2], [['uCur', smoke[0].t], ['uPrev', smoke[1].t]], (u) => {
      gl.uniform2f(u('uSize'), sw, sh);
      gl.uniform1f(u('uTaa'), taa);
    });
    smoke = [smoke[0], smoke[2], smoke[1]];
    histValid = true;
    // 11. Together, onto the canvas.
    run(P.compose, { t: scene.t, f: null, w: width, h: height }, [['uScene', sceneT], ['uSmoke', smoke[1].t], ['uLight', light.t]], (u) => {
      setCam(u, width, height);
      gl.uniform2f(u('uSmokeSize'), sw, sh);
      gl.uniform1f(u('uExposure'), look.exposure);
      gl.uniform1f(u('uShade'), sl.shade);
    });
    frameNo += 1;
  };

  /** The camera ray through a canvas point (css px of the canvas) and a velocity on the burner's plane (units/s). */
  const pointerRay = (x: number, y: number, vx: number, vy: number, cssW: number, cssH: number) => {
    const q: [number, number] = [((x / cssW) * 2 - 1) * (cssW / cssH), -((y / cssH) * 2 - 1)];
    // camRot maps (qx, qy, 1) → world; its first column is −right (the screen's x).
    const d = norm(add(add(mul([-cr[0], -cr[1], -cr[2]], q[0] * tanHalf), mul(cu, q[1] * tanHalf)), cf));
    const k = (2 * tanHalf * dist) / cssH;
    const v = add(mul([-cr[0], -cr[1], -cr[2]], vx * k), mul(cu, -vy * k));
    return { o: cam, d, v };
  };

  return {
    canvas,
    /** False while the shaders are still compiling (nothing may be drawn yet). */
    get ready() {
      return ready();
    },
    get refining() {
      return pass < SAMPLES * BANDS;
    },
    get simTime() {
      return sim;
    },
    /** Run the smoke ahead without drawing (so it is already flowing when the picture first shows). */
    warm(seconds: number, look: DragonLook, smokeLook: SmokeLook) {
      const n = Math.round(seconds * 60);
      const none = { o: [0, 0, 0] as V3, d: [0, 0, 1] as V3, v: [0, 0, 0] as V3, on: false };
      for (let i = 0; i < n; i += 1) step(1 / 60, look, none, smokeLook);
    },
    frame(dt: number, look: DragonLook, pointer: DragonPointer, cssW: number, cssH: number, view: BurnerView, smokeLook: SmokeLook) {
      renderScene(look, view);
      const ray = pointerRay(pointer.x, pointer.y, pointer.vx, pointer.vy, cssW, cssH);
      // Every frame, or every other one with twice the step.
      if (!smokeLook.halfRate) step(Math.min(dt, 1 / 30), look, { ...ray, on: pointer.active }, smokeLook);
      else if (frameNo % 2 === 0) step(Math.min(dt * 2, 1 / 15), look, { ...ray, on: pointer.active }, smokeLook);
      draw(look, smokeLook);
    },
    dispose() {
      for (const t of [scene, sceneLo, sdf, ...vel, ...dens, ...pres, hat, divT, curlT, light, occ, ...smoke]) drop(t);
      for (const p of programs) gl.deleteProgram(p);
      gl.deleteBuffer(buf);
      gl.deleteVertexArray(vao);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
