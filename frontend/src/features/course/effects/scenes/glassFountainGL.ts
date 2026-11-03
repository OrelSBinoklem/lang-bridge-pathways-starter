/**
 * The neon glass tabletop fountain, ray traced on the GPU (WebGL2, one fragment shader over signed distance fields).
 * Centimetres, y up, the tray's water at y ≈ 0.
 *
 *   white ceramic   — a stepped base (six square tiers, wider at the top) and the tray's frame: key light with soft
 *                     shadows, ambient occlusion from the distance field, the neon light bleeding over its top edge
 *   the tray        — water over a frosted LED panel whose colour flows through the neon hues; ripples where the
 *                     streams land
 *   glass (n = 1.5) — two lily-pad leaves (shallow dishes with a lobed, notched, wavy rim) on curved acrylic stems, a
 *                     lotus crown with a warm lamp in it, a sphere on top with air bubbles inside (holes in the field,
 *                     so the rays leave the glass into them and back as through real bubbles)
 *   water (n = 1.33) — lying in both leaves and falling as two streams (upper leaf → lower leaf → onto the ball:
 *                     the lotus and the ball stand where the second stream comes down, a little behind its landing
 *                     point, so it lands just in front of the top), a thin film running over the ball, ripples
 *                     spreading in the tray from the lotus, wobbling
 *   the decor       — as in the owner's photo: two clear acrylic rods standing behind (glass too, so they carry the
 *                     neon up their edges), a crystal lotus of two rings of petals under the ball (an upright inner
 *                     ring, a wide flat spiky outer one), and a green sprig with white flowers in a small glass holder
 *                     at the front left (stems, slender leaves and flower clusters built in plantGeometry, kept in
 *                     constant arrays; measured only inside its box)
 *
 * A ray from the eye marches the field; at glass and water it splits by Fresnel: the reflected part picks up the
 * studio's softbox, the key light's glint and the glowing tray (a plane, looked up analytically), the rest refracts
 * in, marches the inside (the field's sign flips), refracts out or reflects at total internal reflection — up to 9
 * events. Whatever reaches the LED panel takes its colour; the ceramic and the floor are lit directly. Mist lies on
 * the floor, lit by the neon. Then exposure and a tone curve; what is much brighter than the rest goes into a second
 * target and comes back as a glow (two blurs at half size), as in kaleidoscopeGlass.ts.
 */

export type GlassFountainLook = {
  /** Ray-tracing depth: 0 full (9 events), 1 light (4 events, shorter marches), 2 none (the first hit only: glass and
   * water shaded from the studio and the tray, not traced through). */
  quality: number;
  /** Trace every other row each frame (the rest kept from the frame before). */
  interlace: boolean;
  /** The water: 0 as before (fixed shapes), 1 a live film (streams wobbling and pulsing, rivulets running over the
   * ball, drips), 2 particles (glassFountainWater.ts; drawn over the trace as a liquid). */
  water: number;
  /** Particles: drop size (×), smoothing (×), detail (more, smaller drops: the drops' radius is × detail^(−1/3), as
   * glassFountainWater.ts makes them), smoothing passes (pairs across and down), how much the water tints what is seen
   * through it. */
  dropSize: number;
  smooth: number;
  detail: number;
  passes: number;
  absorb: number;
  exposure: number;
  neon: [number, number, number];
  neonI: number;
  warm: number;
  key: number;
  mist: number;
  glow: number;
  flow: number;
};

type Leaf = { c: [number, number, number]; r: number; depth: number; tilt: number; spout: number; notch: number };

/** The two leaves: centre, radius, dish depth, tilt (radians, down towards the spout), spout and notch angles. */
const LEAVES: Leaf[] = [
  { c: [-6.2, 17.5, -4.5], r: 6.8, depth: 1.1, tilt: 0.2, spout: 0.35, notch: Math.PI + 0.5 },
  { c: [4.6, 11.4, -3.2], r: 6.0, depth: 1.0, tilt: 0.18, spout: 1.9, notch: -1.1 },
];

type V3 = [number, number, number];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** Local → world rotation of a leaf: tilted down by `tilt` about the horizontal axis across its spout direction. */
function leafMatrix(l: Leaf): number[] {
  const sx = Math.cos(l.spout), sz = Math.sin(l.spout);
  // Rodrigues about axis a = (−sz, 0, sx) (horizontal, across the spout) by −tilt, so the spout side goes down.
  const ax = -sz, ay = 0, az = sx;
  const t = -l.tilt;
  const c = Math.cos(t), s = Math.sin(t), k = 1 - c;
  return [
    c + ax * ax * k, ax * ay * k - az * s, ax * az * k + ay * s,
    ay * ax * k + az * s, c + ay * ay * k, ay * az * k - ax * s,
    az * ax * k - ay * s, az * ay * k + ax * s, c + az * az * k,
  ];
}
const apply = (m: number[], v: V3): V3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
/** A leaf's rim radius at angle a (local): lobed, with the lily pad's notch. */
function rimR(l: Leaf, a: number) {
  const d = Math.atan2(Math.sin(a - l.notch), Math.cos(a - l.notch));
  return l.r * (1 + 0.05 * Math.cos(3 * a) + 0.035 * Math.cos(5 * a + 1)) * (1 - 0.55 * Math.exp(-((d / 0.13) ** 2)));
}
/** Where a leaf's water leaves it: the rim at its spout, lowest point (world). */
function spoutPoint(l: Leaf): V3 {
  const m = leafMatrix(l);
  const R = rimR(l, l.spout) * 0.98;
  const local: V3 = [Math.cos(l.spout) * R, l.depth * 0.9, Math.sin(l.spout) * R];
  return add(l.c, apply(m, local));
}
/** A falling stream: 8 points of the parabola from `from`, thrown out along the spout, down to height `toY`. */
function streamPoints(from: V3, dirAngle: number, speed: number, toY: number): V3[] {
  const g = 981;
  const vx = Math.cos(dirAngle) * speed, vz = Math.sin(dirAngle) * speed;
  const T = Math.sqrt((2 * Math.max(0.5, from[1] - toY)) / g);
  const pts: V3[] = [];
  for (let i = 0; i < 8; i += 1) {
    const t = (i / 7) * T;
    pts.push([from[0] + vx * t, from[1] - 0.5 * g * t * t, from[2] + vz * t]);
  }
  return pts;
}

/** Where things are, for the water's particles (glassFountainWater.ts). */
export type GlassLayout = {
  spout1: V3; dir1: number; spout2: V3; dir2: number;
  ball: V3; ballR: number; lotus: V3;
  leaf1: V3; leaf1R: number;
  waterY: number; tray: number;
};
export function glassLayout(): GlassLayout {
  const from2 = spoutPoint(LEAVES[1]);
  const fall = Math.sqrt((2 * Math.max(0.5, from2[1] - (BALL_Y + BALL_R))) / 981);
  const d2 = [Math.cos(LEAVES[1].spout), Math.sin(LEAVES[1].spout)];
  const lotus: V3 = [from2[0] + d2[0] * (22 * fall - 0.35), 0, from2[2] + d2[1] * (22 * fall - 0.35)];
  return {
    spout1: spoutPoint(LEAVES[0]), dir1: LEAVES[0].spout, spout2: from2, dir2: LEAVES[1].spout,
    ball: [lotus[0], BALL_Y, lotus[2]], ballR: BALL_R, lotus,
    leaf1: [LEAVES[1].c[0], LEAVES[1].c[1] + LEAVES[1].depth * 0.6, LEAVES[1].c[2]], leaf1R: LEAVES[1].r,
    waterY: 0.12, tray: 13.4,
  };
}

/** A seeded random (the sprig is the same every time). */
function rand(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Where the sprig stands (its holder's foot, on the LED panel). */
const SPRIG: V3 = [-6.6, -0.5, 4.4];

/**
 * The sprig: a main stem bending up, side branches leaving it alternately round it, slender leaves along both, and a
 * cluster of small white flowers at every tip. Stems as capsules (a, b, radius), leaves as flat ellipsoids (centre,
 * long axis, across axis, sizes), flowers as small balls.
 */
function plantGeometry() {
  const rnd = rand(7);
  const stems: { a: V3; b: V3; r: number }[] = [];
  const leaves: { c: V3; d: V3; len: number; w: number }[] = [];
  const flowers: { c: V3; r: number }[] = [];
  const norm3 = (v: V3): V3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const lerp = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const at = (o: V3, x: number, y: number, z: number): V3 => [o[0] + x, o[1] + y, o[2] + z];
  // The main stem: four segments, leaning a little.
  const main: V3[] = [at(SPRIG, 0, 0.3, 0), at(SPRIG, 0.25, 3.6, -0.1), at(SPRIG, -0.2, 7.2, 0.25), at(SPRIG, 0.35, 10.2, 0.05), at(SPRIG, 0.15, 12.0, -0.2)];
  for (let i = 0; i < main.length - 1; i += 1) stems.push({ a: main[i], b: main[i + 1], r: 0.11 - i * 0.015 });
  const along = (t: number): V3 => {
    const u = t * (main.length - 1);
    const k = Math.min(main.length - 2, Math.floor(u));
    return lerp(main[k], main[k + 1], u - k);
  };
  // A leaf leaving point o along direction d (mostly outwards and up), lying flat (its width horizontal, across d —
  // the shader takes that axis as d × up).
  const leaf = (o: V3, d: V3, len: number) => {
    const dir = norm3(d);
    leaves.push({ c: at(o, dir[0] * len * 0.5, dir[1] * len * 0.5, dir[2] * len * 0.5), d: dir, len, w: 0.25 + rnd() * 0.08 });
  };
  const cluster = (tip: V3, n: number, spread: number) => {
    for (let k = 0; k < n; k += 1) {
      const a = rnd() * Math.PI * 2;
      const r = spread * Math.sqrt(rnd());
      flowers.push({ c: at(tip, Math.cos(a) * r, (rnd() - 0.3) * spread * 0.9, Math.sin(a) * r), r: 0.13 + rnd() * 0.08 });
    }
  };
  // Side branches, alternately round the stem (golden angle), shorter towards the top.
  const BR = 9;
  for (let i = 0; i < BR; i += 1) {
    const t = 0.22 + (i / (BR - 1)) * 0.68;
    const o = along(t);
    const a = i * 2.4 + 0.6;
    const out: V3 = [Math.cos(a), 0, Math.sin(a)];
    const rise = 0.8 + rnd() * 0.5;
    const L = 2.9 - t * 1.6 + rnd() * 0.5;
    const mid = at(o, out[0] * L * 0.5, rise * L * 0.32, out[2] * L * 0.5);
    const tip = at(o, out[0] * L * 0.85, rise * L * 0.72, out[2] * L * 0.85);
    stems.push({ a: o, b: mid, r: 0.055 }, { a: mid, b: tip, r: 0.045 });
    // Leaves along the branch, alternating.
    for (let j = 0; j < 4; j += 1) {
      const q = lerp(o, tip, 0.15 + j * 0.22);
      const sideA = a + (j % 2 ? 1 : -1) * (0.9 + rnd() * 0.4);
      leaf(q, [Math.cos(sideA) * 0.8 + out[0] * 0.4, 0.45 + rnd() * 0.5, Math.sin(sideA) * 0.8 + out[2] * 0.4], 1.25 + rnd() * 0.6);
    }
    cluster(tip, 4, 0.42);
  }
  // Leaves on the main stem and a cluster at its top.
  for (let j = 0; j < 6; j += 1) {
    const q = along(0.12 + j * 0.13);
    const a = j * 2.1 + 1.1;
    leaf(q, [Math.cos(a), 0.6, Math.sin(a)], 1.4 + rnd() * 0.5);
  }
  cluster(main[main.length - 1], 6, 0.5);
  // The box round it all (with the leaves' and flowers' size).
  const lo: V3 = [1e9, 1e9, 1e9], hi: V3 = [-1e9, -1e9, -1e9];
  const grow = (v: V3, r: number) => { for (let k = 0; k < 3; k += 1) { lo[k] = Math.min(lo[k], v[k] - r); hi[k] = Math.max(hi[k], v[k] + r); } };
  for (const st of stems) { grow(st.a, st.r); grow(st.b, st.r); }
  for (const l of leaves) grow(l.c, l.len * 0.6);
  for (const fl of flowers) grow(fl.c, fl.r);
  return { stems, leaves, flowers, lo, hi };
}

/** The glass ball on the lotus: its centre's height and radius. */
const BALL_Y = 4.05;
const BALL_R = 2.55;

const f = (x: number) => x.toFixed(4);
const v3 = (v: V3) => `vec3(${f(v[0])}, ${f(v[1])}, ${f(v[2])})`;
const m3t = (m: number[]) => `mat3(${m.map(f).join(', ')})`; // column-major from row-major = the transpose (world → local)

function shaderSource() {
  const L = LEAVES.map((l) => ({ l, m: leafMatrix(l) }));
  const plant = plantGeometry();
  // In uniform arrays, not constant ones: a constant array indexed in a loop becomes a per-pixel copy under ANGLE's
  // Direct3D (a frame took seconds); uniforms are read from a constant buffer.
  const plantArrays = `
const int N_STEM = ${plant.stems.length};
const int N_PLEAF = ${plant.leaves.length};
const int N_FLOWER = ${plant.flowers.length};
uniform vec4 STEM_A[N_STEM];
uniform vec4 STEM_B[N_STEM];
uniform vec4 PLEAF_C[N_PLEAF];
uniform vec4 PLEAF_D[N_PLEAF];
uniform vec4 FLOWER[N_FLOWER];
const vec3 PLANT_LO = ${v3(plant.lo)};
const vec3 PLANT_HI = ${v3(plant.hi)};
const vec3 SPRIG = ${v3(SPRIG)};`;
  const s1 = streamPoints(spoutPoint(LEAVES[0]), LEAVES[0].spout, 26, LEAVES[1].c[1] + 0.4);
  // The ball under the second stream: where the stream is at the ball's top, the ball's centre a little behind.
  const from2 = spoutPoint(LEAVES[1]);
  const fall = Math.sqrt((2 * Math.max(0.5, from2[1] - (BALL_Y + BALL_R))) / 981);
  const dir2 = [Math.cos(LEAVES[1].spout), Math.sin(LEAVES[1].spout)];
  const lotus: V3 = [from2[0] + dir2[0] * (22 * fall - 0.35), 0, from2[2] + dir2[1] * (22 * fall - 0.35)];
  const s2 = streamPoints(from2, LEAVES[1].spout, 22, BALL_Y + BALL_R - 0.2);
  const leafFn = L.map(({ l, m }, i) => `
vec2 leaf${i}(vec3 p) {
  vec3 q = ${m3t(m)} * (p - ${v3(l.c)});
  float r = length(q.xz);
  if (r > ${f(l.r * 1.25)} || abs(q.y) > ${f(l.depth + 2.0)}) { float b = max(r - ${f(l.r * 1.1)}, abs(q.y) - ${f(l.depth + 1.5)}); return vec2(b, b); }
  float a = atan(q.z, q.x);
  float dn = atan(sin(a - ${f(l.notch)}), cos(a - ${f(l.notch)}));
  float R = ${f(l.r)} * (1.0 + 0.05 * cos(3.0 * a) + 0.035 * cos(5.0 * a + 1.0)) * (1.0 - 0.55 * exp(-(dn / 0.13) * (dn / 0.13)));
  float u = r / R;
  float h = ${f(l.depth)} * u * u + 0.22 * sin(9.0 * a) * u * u * u;
  float glass = max(abs(q.y - h) - 0.17, r - R) * 0.55;
  float wl = ${f(l.depth * 0.62)} + 0.03 * sin(uTime * 3.0 + r * 2.0);
  float water = max(max(h + 0.17 - q.y, q.y - wl), r - R * 0.9) * 0.55;
  return vec2(glass, water);
}`).join('\n');
  const streamFn = (name: string, pts: V3[], r0: number, r1: number) => `
float ${name}(vec3 p) {
  float d = 1e9;
  ${pts.slice(0, -1).map((a, i) => {
    const b = pts[i + 1];
    const t0 = i / 7, t1 = (i + 1) / 7;
    return `{ vec3 a = ${v3(a)}, b = ${v3(b)};
    vec3 pa = p - a, ba = b - a; float hh = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    float t = mix(${f(t0)}, ${f(t1)}, hh);
    vec3 w = pa - ba * hh + vec3(sin(uTime * 23.0 + t * 31.0), 0.0, cos(uTime * 19.0 + t * 27.0)) * (0.05 + 0.18 * uLive) * t
      + vec3(sin(uTime * 2.3 + t * 3.0), 0.0, cos(uTime * 1.7 + t * 2.0)) * 0.35 * uLive * t * t;
    float pulse = 1.0 + 0.25 * uLive * sin(uTime * 1.7 - t * 2.0);
    d = min(d, length(w) - mix(${f(r0)}, ${f(r1)}, t) * pulse * (1.0 + (0.12 + 0.3 * uLive) * sin(uTime * 40.0 - t * 60.0))); }`;
  }).join('\n  ')}
  return d;
}`;
  const flat = (rows: number[][]) => new Float32Array(rows.flat());
  return {
    plant: {
      STEM_A: flat(plant.stems.map((q) => [...q.a, q.r])),
      STEM_B: flat(plant.stems.map((q) => [...q.b, 0])),
      PLEAF_C: flat(plant.leaves.map((q) => [...q.c, q.len])),
      PLEAF_D: flat(plant.leaves.map((q) => [...q.d, q.w])),
      FLOWER: flat(plant.flowers.map((q) => [...q.c, q.r])),
    },
    source: `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uCamPos;
uniform mat3 uCamRot;
uniform float uFocal;
uniform vec3 uNeon;
uniform float uNeonI;
uniform float uWarm;
uniform float uKey;
uniform float uExposure;
uniform float uMist;
uniform float uFlow;
// Always 0: loops start from it, so the compiler cannot unroll them (map() is copied into every place it is called
// from; unrolled loops in it make the shader take minutes to compile under ANGLE).
uniform int uZero;
uniform float uLive;
uniform float uPart;
uniform int uMaxEv;
uniform int uSteps;
uniform float uInterlace;
uniform float uFrame;
// Ripples in the tray where the particles come down: x, z, start time, strength.
uniform vec4 uRipple[16];
uniform int uNRipple;
// The air bubbles in the ball (they need many small steps: only in the full trace).
uniform float uBubbles;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outHot;
layout(location = 2) out vec4 outDepth;

const float TRAY = 13.4;
const float WATER_Y = 0.12;
const float PANEL_Y = -0.55;
const float FLOOR_Y = -9.6;
const vec3 LOTUS = ${v3(lotus)};
const vec3 BALL = ${v3([lotus[0], BALL_Y, lotus[2]])};
const float BALL_R = ${f(BALL_R)};
const vec3 KEY_DIR = normalize(vec3(-0.55, 0.8, 0.35));
const vec3 STREAM1_END = ${v3(s1[7])};
const vec3 STREAM2_END = ${v3(s2[7])};
${plantArrays}

float hash1(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise3(vec3 p) {
  vec3 i = floor(p), q = fract(p);
  q = q * q * (3.0 - 2.0 * q);
  return mix(mix(mix(hash1(i), hash1(i + vec3(1, 0, 0)), q.x), mix(hash1(i + vec3(0, 1, 0)), hash1(i + vec3(1, 1, 0)), q.x), q.y),
             mix(mix(hash1(i + vec3(0, 0, 1)), hash1(i + vec3(1, 0, 1)), q.x), mix(hash1(i + vec3(0, 1, 1)), hash1(i + vec3(1, 1, 1)), q.x), q.y), q.z);
}
float sdRoundBox(vec3 p, vec3 b, float r) { vec3 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
float sdEllipsoid(vec3 p, vec3 r) { float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float sdVCyl(vec3 p, float r, float y0, float y1) {
  vec2 d = vec2(length(p.xz) - r, abs(p.y - 0.5 * (y0 + y1)) - 0.5 * (y1 - y0));
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - 0.04;
}
// The sprig: (distance, material) — 7 stems and leaves, 8 flowers; only its box outside it.
vec2 sprig(vec3 p) {
  vec3 bc = 0.5 * (PLANT_LO + PLANT_HI), bh = 0.5 * (PLANT_HI - PLANT_LO);
  vec3 bq = abs(p - bc) - bh;
  float box = length(max(bq, 0.0)) + min(max(bq.x, max(bq.y, bq.z)), 0.0);
  if (box > 0.4) return vec2(box, 7.0);
  float green = 1e9;
  for (int i = uZero; i < N_STEM; i++) green = min(green, sdCapsule(p, STEM_A[i].xyz, STEM_B[i].xyz, STEM_A[i].w));
  for (int i = uZero; i < N_PLEAF; i++) {
    vec3 d = PLEAF_D[i].xyz, sd = normalize(cross(d, vec3(0.0, 1.0, 0.0)));
    vec3 q = p - PLEAF_C[i].xyz;
    vec3 lq = vec3(dot(q, d), dot(q, sd), dot(q, cross(d, sd)));
    // Slender and pointed: narrower towards both ends.
    float u = clamp(abs(lq.x) / (0.5 * PLEAF_C[i].w), 0.0, 1.0);
    green = min(green, sdEllipsoid(lq, vec3(0.5 * PLEAF_C[i].w, PLEAF_D[i].w * (1.0 - 0.45 * u * u), 0.035)) * 0.8);
  }
  float white = 1e9;
  for (int i = uZero; i < N_FLOWER; i++) white = min(white, length(p - FLOWER[i].xyz) - FLOWER[i].w);
  return white < green ? vec2(white, 8.0) : vec2(green, 7.0);
}

${leafFn}
${streamFn('stream1', s1, 0.3, 0.22)}
${streamFn('stream2', s2, 0.27, 0.2)}

// Ripples on the tray's water: rings spreading from the lotus, where the water off the ball comes down, and a fine
// shiver.
float trayWave(vec2 xz) {
  float r = max(length(xz - LOTUS.xz) - 4.6, 0.0);
  float h = 0.05 * sin(r * 5.0 - uTime * 9.0) * exp(-r * 0.35) * uFlow * (1.0 + 0.6 * uLive * sin(uTime * 1.7)) + 0.012 * sin(xz.x * 1.7 + uTime * 1.3) * sin(xz.y * 2.1 - uTime);
  // Rings from where the drops came down: running out at 14 cm/s, dying away.
  for (int i = uZero; i < 16; i++) {
    if (i >= uNRipple) break;
    vec4 rp = uRipple[i];
    float age = uTime - rp.z;
    float rr = length(xz - rp.xy);
    float front = rr - age * 14.0;
    h += rp.w * 0.07 * sin(front * 3.2) * exp(-front * front * 0.35) * exp(-age * 1.1) / (1.0 + rr * 0.4);
  }
  return h;
}

// The scene: returns distance and material (1 ceramic, 2 glass, 3 water, 4 warm lamp, 5 floor, 6 LED panel).
vec2 map(vec3 p) {
  vec2 res = vec2(p.y - FLOOR_Y, 5.0);
  // The stepped base: six tiers, 1.5 cm high, the top one widest (only the tiers near p are measured).
  float k = clamp(floor((-p.y - 0.6) / 1.5), 0.0, 5.0);
  float base = 1e9;
  for (int j = -1; j <= 1; j++) {
    float kk = clamp(k + float(j), 0.0, 5.0);
    float s = 14.3 - kk * 1.15;
    base = min(base, sdRoundBox(p - vec3(0.0, -0.6 - 1.5 * kk - 0.75, 0.0), vec3(s, 0.75, s), 0.18));
  }
  // The tray's frame: a square ring standing above the water.
  float frame = max(sdRoundBox(p - vec3(0.0, -0.2, 0.0), vec3(14.3, 0.55, 14.3), 0.15), -sdRoundBox(p - vec3(0.0, 0.2, 0.0), vec3(TRAY, 1.0, TRAY), 0.3));
  float ceramic = min(base, frame);
  if (ceramic < res.x) res = vec2(ceramic, 1.0);
  float panel = sdRoundBox(p - vec3(0.0, PANEL_Y - 0.25, 0.0), vec3(TRAY, 0.25, TRAY), 0.05);
  if (panel < res.x) res = vec2(panel, 6.0);
  // (the waves only measured near the surface)
  float wy = p.y - WATER_Y;
  float water = max(max(abs(wy) < 0.6 ? wy - trayWave(p.xz) : wy, PANEL_Y - p.y), max(abs(p.x), abs(p.z)) - TRAY);
  // Glass: the lotus crown (petals by angular repetition), the ball with bubbles, the stems, the leaves.
  vec3 q = p - LOTUS;
  float ang = atan(q.z, q.x);
  float petals = 1e9;
  // The inner ring: eight upright petals, tilted outwards.
  float sec = 6.2831853 / 8.0;
  float a0 = (floor(ang / sec) + 0.5) * sec;
  for (int j = 0; j < 2; j++) {
    float aa = a0 + float(j) * sign(ang - a0) * sec;
    vec2 cs = vec2(cos(aa), sin(aa));
    vec3 lp = vec3(dot(q.xz, cs), q.y, dot(q.xz, vec2(-cs.y, cs.x)));
    lp -= vec3(1.9, 1.0, 0.0);
    float c = cos(0.55), s = sin(0.55);
    lp = vec3(c * lp.x - s * lp.y, s * lp.x + c * lp.y, lp.z);
    petals = min(petals, sdEllipsoid(lp, vec3(0.32, 1.35, 0.85)));
  }
  // The outer ring: twelve long flat pointed petals lying out over the tray, tips curling up — the crystal snowflake.
  float sec2 = 6.2831853 / 12.0;
  float b0 = (floor((ang + 0.5 * sec2) / sec2)) * sec2;
  for (int j = 0; j < 2; j++) {
    float aa = b0 + float(j) * sign(ang - b0) * sec2;
    vec2 cs = vec2(cos(aa), sin(aa));
    vec3 lp = vec3(dot(q.xz, cs), q.y, dot(q.xz, vec2(-cs.y, cs.x)));
    lp -= vec3(3.05, 0.42 + 0.06 * (lp.x - 3.05) * (lp.x - 3.05), 0.0);
    float u = clamp((lp.x + 2.0) / 4.0, 0.0, 1.0);
    petals = min(petals, sdEllipsoid(lp, vec3(2.0, 0.17, 0.62 * (1.0 - 0.75 * u * u) + 0.05)) * 0.8);
  }
  float ball = length(p - BALL) - BALL_R;
  if (ball < 0.3 && uBubbles > 0.5) {
    vec3 bq = (p - BALL) * 2.4;
    vec3 cell = floor(bq);
    vec3 fq = fract(bq) - 0.5;
    float hb = hash1(cell);
    vec3 jit = (vec3(hash1(cell + 7.1), hash1(cell + 3.3), hash1(cell + 5.7)) - 0.5) * 0.5;
    float bub = hb > 0.55 && length(cell / 2.4) < BALL_R - 0.45 ? length(fq - jit) - (0.05 + 0.12 * hash1(cell + 1.9)) : 1e9;
    ball = max(ball, -bub / 2.4);
  }
  float stems = min(
    min(sdCapsule(p, vec3(-3.4, -0.4, -3.8), vec3(-3.9, 8.0, -3.4), 0.45), sdCapsule(p, vec3(-3.9, 8.0, -3.4), ${v3([LEAVES[0].c[0] + 0.3, LEAVES[0].c[1] - 0.6, LEAVES[0].c[2]])}, 0.45)),
    min(sdCapsule(p, vec3(3.2, -0.4, -5.2), vec3(5.4, 5.5, -5.0), 0.42), sdCapsule(p, vec3(5.4, 5.5, -5.0), ${v3([LEAVES[1].c[0] - 0.2, LEAVES[1].c[1] - 0.5, LEAVES[1].c[2]])}, 0.42)));
  vec2 l0 = leaf0(p), l1 = leaf1(p);
  // Clear acrylic rods behind (a tall one between the leaves, a short one by the ball) and the sprig's glass holder
  // (a thick-walled cup).
  float rods = min(sdVCyl(p - vec3(-0.9, 0.0, -6.6), 0.48, -0.4, 14.2), sdVCyl(p - vec3(6.4, 0.0, -1.2), 0.42, -0.4, 7.4));
  float holder = max(sdVCyl(p - SPRIG, 0.95, 0.0, 2.6), -sdVCyl(p - SPRIG, 0.72, 0.35, 3.2));
  float glass = min(min(min(petals, ball), min(stems, min(l0.x, l1.x))), min(rods, holder));
  if (glass < res.x) res = vec2(glass, 2.0);
  float falls = min(stream1(p), stream2(p));
  // The film over the ball (its upper three quarters), trembling.
  vec3 fb = p - BALL;
  float film;
  if (uLive > 0.5) {
    // Rivulets: thicker bands running down over the ball (the pattern slides down with time), the film's lower edge
    // wandering.
    float lb = length(fb);
    float th = acos(clamp(fb.y / max(lb, 1e-3), -1.0, 1.0));
    float ph = atan(fb.z, fb.x);
    float riv = smoothstep(0.2, 0.95, sin(ph * 6.0 + 1.8 * sin(th * 3.0 - uTime * 2.2) + noise3(vec3(ph * 2.0, th * 4.0 - uTime * 3.0, 0.0)) * 2.0));
    float hh = 0.025 + 0.12 * riv * smoothstep(0.1, 0.9, th);
    film = max(abs(lb - BALL_R - hh) - hh, -fb.y - (0.55 + 0.2 * sin(uTime * 1.3 + ph * 2.0)) * BALL_R);
    // Drips letting go below the widest part and falling to the petals.
    for (int k = uZero; k < 4; k++) {
      float fk = float(k);
      float ph0 = fract(uTime * (0.55 + 0.13 * fk) + fk * 0.37);
      float a = fk * 1.7 + floor(uTime * (0.55 + 0.13 * fk) + fk * 0.37) * 2.3;
      vec3 c0 = BALL + vec3(cos(a) * BALL_R * 0.93, -0.45 * BALL_R, sin(a) * BALL_R * 0.93);
      vec3 dp = c0 + vec3(cos(a), 0.0, sin(a)) * ph0 * 0.6 - vec3(0.0, ph0 * ph0 * 3.4, 0.0);
      film = min(film, sdEllipsoid(p - dp, vec3(0.16, 0.16 + 0.12 * ph0, 0.16)));
    }
  } else {
    film = max(abs(length(fb) - BALL_R - 0.06 - 0.02 * sin(uTime * 7.0 + fb.y * 6.0 + atan(fb.z, fb.x) * 3.0)) - 0.06, -fb.y - 0.6 * BALL_R);
  }
  falls = min(falls, film);
  if (uFlow < 0.05) falls = 1e9;
  water = min(water, min(falls, min(l0.y, l1.y)));
  if (water < res.x) res = vec2(water, 3.0);
  float lamp = length(p - (LOTUS + vec3(0.0, 1.05, 0.0))) - 0.55;
  if (lamp < res.x) res = vec2(lamp, 4.0);
  vec2 sp = sprig(p);
  if (sp.x < res.x) res = sp;
  return res;
}
// (one map() in a loop the compiler cannot unroll, not four calls: map() is copied into every place it is called)
vec3 normalAt(vec3 p) {
  vec3 n = vec3(0.0);
  for (int i = uZero; i < 4; i++) {
    vec3 e = 0.5773 * (2.0 * vec3(float(((i + 3) >> 1) & 1), float((i >> 1) & 1), float(i & 1)) - 1.0);
    n += e * map(p + e * 0.0069).x;
  }
  return normalize(n);
}
float softShadow(vec3 ro, vec3 rd) {
  float res = 1.0, t = 0.05;
  for (int i = uZero; i < 40; i++) {
    float h = map(ro + rd * t).x;
    if (h < 0.001) return 0.0;
    res = min(res, 10.0 * h / t);
    t += clamp(h, 0.03, 1.2);
    if (t > 40.0) break;
  }
  return clamp(res, 0.0, 1.0);
}
float ao(vec3 p, vec3 n) {
  float o = 0.0, w = 1.0;
  for (int i = uZero + 1; i <= 5; i++) { float h = 0.12 * float(i); o += (h - map(p + n * h).x) * w; w *= 0.7; }
  return clamp(1.0 - o * 1.6, 0.0, 1.0);
}
// The LED panel seen through the diffuser: brighter in the middle, a faint grid of LEDs.
vec3 panelLight(vec2 xz) {
  vec2 g = fract(xz / 2.2) - 0.5;
  float dots = exp(-dot(g, g) * 18.0);
  float mid = 1.0 - smoothstep(4.0, 16.0, length(xz));
  return uNeon * uNeonI * (0.45 + 0.9 * mid) * (0.85 + 0.35 * dots);
}
// The dark studio: a softbox up to the left, a faint warm wall; below the tray's height, the glowing tray itself.
vec3 env(vec3 ro, vec3 d) {
  vec3 c = vec3(0.006, 0.006, 0.01) + vec3(0.02, 0.018, 0.03) * smoothstep(-0.2, 0.6, d.y);
  float sb = max(dot(d, KEY_DIR), 0.0);
  c += vec3(1.0, 0.94, 0.86) * uKey * (smoothstep(0.93, 0.97, sb) * 2.6 + pow(sb, 12.0) * 0.12);
  if (d.y < -0.01) {
    float t = (WATER_Y - ro.y) / d.y;
    vec3 h = ro + d * t;
    if (t > 0.0 && max(abs(h.x), abs(h.z)) < TRAY) c += panelLight(h.xz) * 0.55;
  }
  return c;
}
vec3 shadeCeramic(vec3 p, vec3 n, vec3 v) {
  float sh = softShadow(p + n * 0.02, KEY_DIR);
  float dif = max(dot(n, KEY_DIR), 0.0) * sh;
  float o = ao(p, n);
  vec3 alb = vec3(0.86, 0.85, 0.83);
  vec3 c = alb * (vec3(1.0, 0.95, 0.88) * dif * uKey * 1.1 + vec3(0.05, 0.05, 0.065) * o);
  // The neon over the frame's top and down the tiers' faces (the panel shines through the frame's edge).
  float near = exp(min(p.y + 0.5, 0.0) / 1.6);
  c += alb * uNeon * uNeonI * 0.33 * near * (0.4 + 0.6 * max(n.y, 0.0)) * o;
  // A soft glaze: the softbox's reflection.
  vec3 r = reflect(v, n);
  c += vec3(1.0, 0.95, 0.9) * pow(max(dot(r, KEY_DIR), 0.0), 40.0) * 0.25 * uKey * sh;
  return c;
}
// The sprig: green leaves and stems (the light through them shows from behind), small white flowers; lit by the key
// light and from below by the tray's neon.
vec3 shadePlant(vec3 p, vec3 n, vec3 v, bool flower) {
  float sh = softShadow(p + n * 0.03, KEY_DIR);
  vec3 alb = flower ? vec3(0.78, 0.8, 0.74) : mix(vec3(0.05, 0.16, 0.03), vec3(0.16, 0.34, 0.06), noise3(p * 3.0));
  float dif = max(dot(n, KEY_DIR), 0.0) * sh;
  // Thin leaves let the light through: the side facing away is lit too, greener.
  float back = flower ? 0.0 : max(dot(-n, KEY_DIR), 0.0) * sh * 0.45;
  vec3 c = alb * vec3(1.0, 0.95, 0.88) * uKey * (dif * 1.05 + back) + alb * vec3(0.04, 0.045, 0.06);
  // The tray's glow from below.
  float below = exp(-max(p.y - WATER_Y, 0.0) / 6.0);
  c += alb * uNeon * uNeonI * 0.5 * below * (0.35 + 0.65 * max(-n.y, 0.0) + (flower ? 0.3 : 0.0));
  // A waxy glint on the leaves.
  vec3 r = reflect(v, n);
  c += vec3(1.0, 0.96, 0.9) * pow(max(dot(r, KEY_DIR), 0.0), 24.0) * (flower ? 0.05 : 0.18) * uKey * sh;
  return c;
}
vec3 shadeFloor(vec3 p, vec3 n, vec3 v) {
  vec2 d = abs(p.xz) - vec2(9.0);
  float contact = exp(-max(max(d.x, d.y), 0.0) * 0.35);
  vec3 c = vec3(0.012, 0.012, 0.016) * (1.0 - 0.6 * contact);
  c += uNeon * uNeonI * 0.05 * exp(-max(max(d.x, d.y), 0.0) * 0.12);
  vec3 r = reflect(v, n);
  c += env(p, r) * 0.06;
  return c;
}

void main() {
  // Every other row this frame (the rest stays from the frame before).
  if (uInterlace > 0.5 && mod(floor(gl_FragCoord.y) + uFrame, 2.0) > 0.5) discard;
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec3 ro = uCamPos;
  vec3 rd = normalize(uCamRot * vec3(uv, -uFocal));
  vec3 col = vec3(0.0);
  vec3 thr = vec3(1.0);
  float firstT = -1.0;
  bool inside = false;
  float mediumIor = 1.0;
  for (int ev = uZero; ev < 9; ev++) {
    if (ev >= uMaxEv) break;
    float t = 0.02;
    vec2 h = vec2(0.0);
    bool hit = false;
    for (int i = uZero; i < 140; i++) {
      if (i >= uSteps) break;
      h = map(ro + rd * t);
      float dd = inside ? -h.x : h.x;
      if (dd < 0.0015 * (1.0 + t * 0.02)) { hit = true; break; }
      t += max(dd, 0.004);
      if (t > 160.0) break;
    }
    if (!hit) { col += thr * env(ro, rd); break; }
    vec3 p = ro + rd * t;
    if (firstT < 0.0) firstT = t;
    vec3 n = normalAt(p);
    float mat = h.y;
    if (mat == 1.0) { col += thr * shadeCeramic(p, n, rd); break; }
    if (mat == 5.0) { col += thr * shadeFloor(p, n, rd); break; }
    if (mat == 6.0) { col += thr * panelLight(p.xz); break; }
    if (mat == 7.0 || mat == 8.0) { col += thr * shadePlant(p, n, rd, mat == 8.0); break; }
    if (mat == 4.0) { col += thr * vec3(1.0, 0.62, 0.25) * uWarm * (1.5 + 0.8 * max(dot(n, -rd), 0.0)); break; }
    // Glass or water.
    float ior = mat == 2.0 ? 1.5 : 1.33;
    bool entering = dot(rd, n) < 0.0;
    vec3 nf = entering ? n : -n;
    float eta = entering ? 1.0 / ior : ior;
    float c0 = clamp(-dot(rd, nf), 0.0, 1.0);
    float r0 = (ior - 1.0) / (ior + 1.0);
    r0 *= r0;
    float F = r0 + (1.0 - r0) * pow(1.0 - c0, 5.0);
    vec3 refl = reflect(rd, nf);
    // The reflected part: the studio, the glowing tray, the softbox's glint (not traced further).
    col += thr * F * env(p, refl);
    // Acrylic carries the panel's light inside it and lets it out at its edges and grazing faces: the neon rims.
    if (mat == 2.0) col += thr * uNeon * uNeonI * 0.22 * pow(1.0 - c0, 2.0) * exp(-max(p.y, 0.0) / 14.0);
    vec3 refr = refract(rd, nf, eta);
    if (ev == uMaxEv - 1) {
      // The last event allowed: not traced on — what is behind taken from the studio and the tray, seen straight
      // through (a thick piece of glass bends the ray back about as much as it bent it in).
      col += thr * (1.0 - F) * env(p, normalize(mix(rd, refr, 0.4))) * (mat == 3.0 ? vec3(0.9, 0.97, 0.96) : vec3(0.95, 0.97, 0.99));
      break;
    }
    if (dot(refr, refr) < 1e-6) {
      rd = refl;
      ro = p + nf * 0.01;
      continue;
    }
    thr *= 1.0 - F;
    // The warm lamp tints the glass round it; water is faintly green.
    if (!entering) thr *= mat == 3.0 ? vec3(0.96, 0.99, 0.98) : vec3(0.985, 0.99, 0.995);
    rd = refr;
    ro = p - nf * 0.01;
    inside = entering;
  }
  // Mist on the floor, lit by the neon.
  float mist = 0.0;
  if (uMist > 0.0 && rd.y != 0.0) {
    float tEnd = firstT > 0.0 ? firstT : 160.0;
    for (int i = 0; i < 10; i++) {
      float ti = tEnd * (float(i) + 0.5) / 10.0;
      vec3 mp = uCamPos + normalize(uCamRot * vec3(uv, -uFocal)) * ti;
      float band = smoothstep(-5.0, -9.6, mp.y) * smoothstep(40.0, 10.0, length(mp.xz));
      mist += noise3(mp * 0.18 + vec3(uTime * 0.08, 0.0, uTime * 0.05)) * band;
    }
    mist *= uMist * tEnd / 10.0 * 0.018;
  }
  col = col * exp(-mist) + (uNeon * uNeonI * 0.18 + vec3(0.04)) * (1.0 - exp(-mist));
  col *= uExposure;
  float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
  vec3 hot = col * max(L - 1.4, 0.0) / max(L, 1e-4);
  outHot = vec4(1.0 - exp(-hot * 0.6), 1.0);
  outDepth = vec4(firstT > 0.0 ? firstT : 1e4, 0.0, 0.0, 1.0);
  outColor = vec4(pow(1.0 - exp(-col * 1.1), vec3(1.0 / 2.2)), 1.0);
}`,
  };
}

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const BLUR = `#version 300 es
precision mediump float;
uniform sampler2D uSrc; uniform vec2 uStep; uniform vec2 uOut;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / uOut;
  vec3 c = texture(uSrc, uv).rgb * 0.227027;
  c += (texture(uSrc, uv + uStep).rgb + texture(uSrc, uv - uStep).rgb) * 0.1945946;
  c += (texture(uSrc, uv + uStep * 2.0).rgb + texture(uSrc, uv - uStep * 2.0).rgb) * 0.1216216;
  c += (texture(uSrc, uv + uStep * 3.0).rgb + texture(uSrc, uv - uStep * 3.0).rgb) * 0.054054;
  c += (texture(uSrc, uv + uStep * 4.0).rgb + texture(uSrc, uv - uStep * 4.0).rgb) * 0.016216;
  o = vec4(c, 1.0);
}`;

/** The water's particles: spheres seen by the tracer's camera (as points), their depth (view distance, front of the
 * sphere) or their thickness (the chord through them); hidden behind the traced scene. */
const PART_VERT = `#version 300 es
in vec4 aP;
uniform vec3 uCamPos; uniform mat3 uCamRot; uniform float uFocal; uniform vec2 uRes; uniform float uSize;
out float vZ; out float vR;
void main() {
  vec3 q = aP.xyz - uCamPos;
  vec3 right = uCamRot[0], up = uCamRot[1], back = uCamRot[2];
  float z = -dot(q, back);
  vec2 uv = vec2(dot(q, right), dot(q, up)) * uFocal / max(z, 1e-3);
  vec2 pxy = uv * uRes.y + 0.5 * uRes;
  gl_Position = vec4(pxy / uRes * 2.0 - 1.0, 0.5, 1.0);
  float r = aP.w * uSize;
  gl_PointSize = z > 0.5 ? max(2.0, 2.0 * r * uFocal / z * uRes.y) : 0.0;
  vZ = z;
  vR = r;
}`;
const PART_FRAG = (thickness: boolean) => `#version 300 es
precision highp float;
uniform sampler2D uSceneT; uniform vec2 uRes; uniform float uFocal;
in float vZ; in float vR;
out vec4 o;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  float nz = sqrt(1.0 - r2);
  float z = vZ - nz * vR;
  // The traced scene's distance along this pixel's ray, as a view depth.
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float zs = texture(uSceneT, gl_FragCoord.xy / uRes).r * uFocal / length(vec2(length(uv), uFocal));
  if (z > zs + 0.05) discard;
  ${thickness ? 'o = vec4(2.0 * nz * vR, 0.0, 0.0, 1.0);' : 'o = vec4(z, 0.0, 0.0, 1.0);\n  gl_FragDepth = clamp(z / 300.0, 0.0, 1.0);'}
}`;
/** Smoothing the particles' depth across the screen, edge-aware (a bilateral filter, one direction a pass): close
 * depths blend into one surface, a drop far in front of another keeps its edge. The thickness is blurred plainly. */
const SMOOTH = `#version 300 es
precision highp float;
uniform sampler2D uDepth; uniform sampler2D uThick; uniform vec2 uStep; uniform vec2 uOut; uniform float uR;
layout(location = 0) out vec4 oD;
layout(location = 1) out vec4 oT;
void main() {
  vec2 uv = gl_FragCoord.xy / uOut;
  float d0 = texture(uDepth, uv).r;
  float t = 0.0, tw = 0.0;
  for (int k = -6; k <= 6; k++) {
    float w = exp(-float(k * k) / 18.0);
    t += texture(uThick, uv + uStep * float(k) * uR).r * w;
    tw += w;
  }
  oT = vec4(t / tw, 0.0, 0.0, 1.0);
  if (d0 > 9e3) { oD = vec4(d0, 0.0, 0.0, 1.0); return; }
  float acc = 0.0, ws = 0.0;
  for (int k = -6; k <= 6; k++) {
    float d = texture(uDepth, uv + uStep * float(k) * uR).r;
    if (d > 9e3) continue;
    float dz = (d - d0) / 0.35;
    float w = exp(-float(k * k) / 18.0 - dz * dz);
    acc += d * w;
    ws += w;
  }
  oD = vec4(acc / ws, 0.0, 0.0, 1.0);
}`;

const COMPOSE = `#version 300 es
precision highp float;
uniform sampler2D uColor; uniform sampler2D uGlowTex; uniform vec2 uSize; uniform float uGlow;
uniform sampler2D uPDepth; uniform sampler2D uPThick; uniform float uParticles;
uniform mat3 uCamRot; uniform float uFocal; uniform vec3 uNeon; uniform float uNeonI; uniform float uKey; uniform float uExposure;
uniform float uAbsorb;
out vec4 o;
const vec3 KEY_DIR = normalize(vec3(-0.55, 0.8, 0.35));
vec3 viewPos(vec2 uv, float z) { vec2 s = (uv * uSize - 0.5 * uSize) / uSize.y; return vec3(s * z / uFocal, -z); }
// What the water reflects: the studio's dark, its softbox, the glowing tray below (as the tracer's env, roughly).
vec3 envLin(vec3 d) {
  vec3 c = vec3(0.006, 0.006, 0.01) + vec3(0.02, 0.018, 0.03) * smoothstep(-0.2, 0.6, d.y);
  float sb = max(dot(d, KEY_DIR), 0.0);
  c += vec3(1.0, 0.94, 0.86) * uKey * (smoothstep(0.93, 0.97, sb) * 2.6 + pow(sb, 12.0) * 0.12);
  c += uNeon * uNeonI * 0.6 * smoothstep(0.0, -0.5, d.y);
  return c;
}
vec3 tone(vec3 c) { return pow(1.0 - exp(-c * uExposure * 1.1), vec3(1.0 / 2.2)); }
void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  vec3 c = texture(uColor, uv).rgb;
  if (uParticles > 0.5) {
    float z = texture(uPDepth, uv).r;
    float T = texture(uPThick, uv).r;
    if (z < 9e3 && T > 0.004) {
      // The surface from the smoothed depth: its normal from the neighbours (the nearer side of each pair).
      vec2 e = 1.0 / uSize;
      vec3 P = viewPos(uv, z);
      float zr = texture(uPDepth, uv + vec2(e.x, 0.0)).r, zl = texture(uPDepth, uv - vec2(e.x, 0.0)).r;
      float zu = texture(uPDepth, uv + vec2(0.0, e.y)).r, zd = texture(uPDepth, uv - vec2(0.0, e.y)).r;
      vec3 dx = abs(zr - z) < abs(zl - z) && zr < 9e3 ? viewPos(uv + vec2(e.x, 0.0), zr) - P : P - viewPos(uv - vec2(e.x, 0.0), zl < 9e3 ? zl : z);
      vec3 dy = abs(zu - z) < abs(zd - z) && zu < 9e3 ? viewPos(uv + vec2(0.0, e.y), zu) - P : P - viewPos(uv - vec2(0.0, e.y), zd < 9e3 ? zd : z);
      vec3 n = normalize(cross(dx, dy));
      if (n.z < 0.0) n = -n;
      vec3 V = normalize(P);
      float cosi = clamp(dot(-V, n), 0.0, 1.0);
      float F = 0.02 + 0.98 * pow(1.0 - cosi, 5.0);
      // Clear water, not a haze: the picture behind seen through it, bent by its surface (the more the thicker it is,
      // the colours parting a little), tinted only by what the water absorbs on its way.
      vec2 off = n.xy * (0.01 + min(T, 1.6) * 0.045);
      vec3 behind = vec3(texture(uColor, uv + off * 1.06).r, texture(uColor, uv + off).g, texture(uColor, uv + off * 0.94).b);
      behind *= exp(-T * vec3(0.5, 0.16, 0.1) * uAbsorb);
      // Reflected (in the world: the camera's rotation): the studio, its softbox, the glowing tray below.
      vec3 Rw = uCamRot * reflect(V, n);
      vec3 refl = tone(envLin(Rw)) + tone(uNeon * uNeonI * 0.7) * smoothstep(-0.1, -0.7, Rw.y);
      float sd = max(dot(Rw, KEY_DIR), 0.0);
      float spec = (pow(sd, 600.0) * 3.5 + pow(sd, 60.0) * 0.18) * uKey;
      vec3 w = mix(behind, refl, F) + vec3(spec);
      // Where the surface turns away the light is bent off: a darker rim gives the water its edge.
      w *= mix(1.0, 0.82, smoothstep(0.4, 0.05, cosi));
      // A crisp edge (the thickness only decides where water is), not a soft fade.
      float a = smoothstep(0.025, 0.07, T);
      c = mix(c, w, a);
    }
  }
  c += texture(uGlowTex, uv).rgb * uGlow;
  // A soft vignette, as a lens would.
  vec2 q = uv - 0.5;
  c *= 1.0 - dot(q, q) * 0.6;
  o = vec4(c, 1.0);
}`;

export function createGlassFountainTracer(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  // Float targets for the depths (the particles need them; without, the particles' mode shows the live film).
  const floatOk = !!gl.getExtension('EXT_color_buffer_float');
  // Compiled in the background where the browser can (KHR_parallel_shader_compile): the tracer's shader takes many
  // seconds, and asking for its status at once would freeze the page; `ready` says when it is done.
  const parallel = gl.getExtension('KHR_parallel_shader_compile');
  const shaders: WebGLShader[] = [];
  const programs: WebGLProgram[] = [];
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    shaders.push(s);
    return s;
  };
  const vert = compile(gl.VERTEX_SHADER, VERT);
  const program = (src: string, vs: WebGLShader = vert, attr = 'aPos') => {
    const p = gl.createProgram()!;
    gl.attachShader(p, vs);
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, src));
    gl.bindAttribLocation(p, 0, attr);
    gl.linkProgram(p);
    programs.push(p);
    return p;
  };
  const src = shaderSource();
  const trace = program(src.source);
  const blur = program(BLUR);
  const compose = program(COMPOSE);
  const partVert = compile(gl.VERTEX_SHADER, PART_VERT);
  const partProgram = (fs: string) => program(fs, partVert, 'aP');
  const pDepth = floatOk ? partProgram(PART_FRAG(false)) : null;
  const pThick = floatOk ? partProgram(PART_FRAG(true)) : null;
  const smooth = floatOk ? program(SMOOTH) : null;
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  // The particles' points.
  const MAXP = 24000;
  const pData = new Float32Array(MAXP * 4);
  const pVao = gl.createVertexArray();
  gl.bindVertexArray(pVao);
  const pBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, pBuf);
  gl.bufferData(gl.ARRAY_BUFFER, pData.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(vao);
  const hw = Math.max(1, width >> 1), hh = Math.max(1, height >> 1);
  const target = (w: number, h: number, internal: number = gl.RGBA8, type: number = gl.UNSIGNED_BYTE, filter: number = gl.LINEAR) => {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, gl.RGBA, type, null);
    return t;
  };
  const texColor = target(width, height), texHot = target(width, height);
  const halfA = target(hw, hh), halfB = target(hw, hh);
  const F16 = (filter: number) => target(width, height, gl.RGBA16F, gl.HALF_FLOAT, filter);
  const texSceneT = floatOk ? F16(gl.NEAREST) : null;
  // The particles' depth in 32-bit floats: in half floats at the fountain's ~70 cm a step is 0.06 cm, a third of a
  // drop, and the surface's normals came out stepped (grainy, like foam or smoke).
  const pD = floatOk ? [target(width, height, gl.RGBA32F, gl.FLOAT, gl.NEAREST), target(width, height, gl.RGBA32F, gl.FLOAT, gl.NEAREST)] : [];
  const pT = floatOk ? [F16(gl.LINEAR), F16(gl.LINEAR)] : [];
  const fbo = (...texs: WebGLTexture[]) => {
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    texs.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0));
    gl.drawBuffers(texs.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
    return fb;
  };
  const fbTrace = texSceneT ? fbo(texColor, texHot, texSceneT) : fbo(texColor, texHot);
  const fbA = fbo(halfA), fbB = fbo(halfB);
  // The particles' depth (with a depth buffer: the nearest sphere wins), their thickness, the smoothing's ping-pong.
  let depthRb: WebGLRenderbuffer | null = null;
  let fbPD: WebGLFramebuffer | null = null, fbPT: WebGLFramebuffer | null = null, fbS0: WebGLFramebuffer | null = null, fbS1: WebGLFramebuffer | null = null;
  if (floatOk) {
    fbPD = fbo(pD[0]);
    depthRb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthRb);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRb);
    fbPT = fbo(pT[0]);
    fbS0 = fbo(pD[1], pT[1]);
    fbS1 = fbo(pD[0], pT[0]);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  type U = Record<string, WebGLUniformLocation | null>;
  const uni = (p: WebGLProgram, names: string[]): U => Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(p, n)]));
  let ut: U = {}, ub: U = {}, uc: U = {};
  let upd: U | null = null, upt: U | null = null, us: U | null = null;
  let linked = false;
  /** Whether the shaders are compiled and linked (then the uniforms are looked up once). Throws if one failed. */
  const ready = () => {
    if (linked) return true;
    if (parallel && programs.some((q) => !gl.getProgramParameter(q, parallel.COMPLETION_STATUS_KHR))) return false;
    for (const q of programs) {
      if (!gl.getProgramParameter(q, gl.LINK_STATUS)) {
        const bad = shaders.find((sh) => !gl.getShaderParameter(sh, gl.COMPILE_STATUS));
        throw new Error((bad && gl.getShaderInfoLog(bad)) || gl.getProgramInfoLog(q) || 'link');
      }
    }
    gl.useProgram(trace);
    for (const [name, values] of Object.entries(src.plant)) gl.uniform4fv(gl.getUniformLocation(trace, name), values);
    ut = uni(trace, ['uRes', 'uTime', 'uCamPos', 'uCamRot', 'uFocal', 'uNeon', 'uNeonI', 'uWarm', 'uKey', 'uExposure', 'uMist', 'uFlow', 'uLive', 'uPart', 'uMaxEv', 'uSteps', 'uInterlace', 'uFrame', 'uRipple', 'uNRipple', 'uBubbles']);
    ub = uni(blur, ['uSrc', 'uStep', 'uOut']);
    uc = uni(compose, ['uColor', 'uGlowTex', 'uSize', 'uGlow', 'uPDepth', 'uPThick', 'uParticles', 'uCamRot', 'uFocal', 'uNeon', 'uNeonI', 'uKey', 'uExposure', 'uAbsorb']);
    const partNames = ['uCamPos', 'uCamRot', 'uFocal', 'uRes', 'uSize', 'uSceneT'];
    upd = pDepth ? uni(pDepth, partNames) : null;
    upt = pThick ? uni(pThick, partNames) : null;
    us = smooth ? uni(smooth, ['uDepth', 'uThick', 'uStep', 'uOut', 'uR']) : null;
    gl.useProgram(compose);
    gl.uniform1i(uc.uColor, 0);
    gl.uniform1i(uc.uGlowTex, 1);
    gl.uniform1i(uc.uPDepth, 2);
    gl.uniform1i(uc.uPThick, 3);
    gl.useProgram(blur);
    gl.uniform1i(ub.uSrc, 0);
    linked = true;
    return true;
  };
  let frame = 0;
  const ripples = new Float32Array(16 * 4);

  return {
    canvas,
    /** False while the shaders are still compiling (nothing is drawn yet). Throws if one failed. */
    get ready() {
      return ready();
    },
    /** Whether the particles can be drawn (float targets). */
    particlesOk: floatOk,
    /** cam: position (cm) and the columns of its rotation (right, up, back); focal: 1 / tan(vfov / 2) / 2. `water`
     * (particles mode): the drops (x, y, z, radius each) and the tray's ripples (x, z, start, strength). */
    render(time: number, cam: { pos: [number, number, number]; rot: number[]; focal: number }, look: GlassFountainLook, water?: { drops: Float32Array; count: number; ripples: readonly (readonly number[])[] }) {
      if (!linked) return;
      const W = canvas.width, H = canvas.height;
      const parts = look.water >= 1.5 && floatOk && !!water;
      gl.bindVertexArray(vao);
      gl.useProgram(trace);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbTrace);
      gl.viewport(0, 0, W, H);
      gl.uniform2f(ut.uRes, W, H);
      gl.uniform1f(ut.uTime, time);
      gl.uniform3f(ut.uCamPos, cam.pos[0], cam.pos[1], cam.pos[2]);
      gl.uniformMatrix3fv(ut.uCamRot, false, cam.rot);
      gl.uniform1f(ut.uFocal, cam.focal);
      gl.uniform3f(ut.uNeon, look.neon[0], look.neon[1], look.neon[2]);
      gl.uniform1f(ut.uNeonI, look.neonI);
      gl.uniform1f(ut.uWarm, look.warm);
      gl.uniform1f(ut.uKey, look.key);
      gl.uniform1f(ut.uExposure, look.exposure);
      gl.uniform1f(ut.uMist, look.quality >= 1.5 ? 0 : look.mist);
      gl.uniform1f(ut.uFlow, parts ? 0 : look.flow);
      gl.uniform1f(ut.uLive, look.water >= 0.5 && !parts ? 1 : 0);
      gl.uniform1f(ut.uPart, parts ? 1 : 0);
      const q = Math.round(look.quality);
      gl.uniform1i(ut.uMaxEv, q === 0 ? 9 : q === 1 ? 4 : 1);
      gl.uniform1i(ut.uSteps, q === 0 ? 140 : q === 1 ? 100 : 80);
      gl.uniform1f(ut.uBubbles, q === 0 ? 1 : 0);
      gl.uniform1f(ut.uInterlace, look.interlace ? 1 : 0);
      gl.uniform1f(ut.uFrame, frame % 2);
      ripples.fill(0);
      const nr = parts ? Math.min(16, water!.ripples.length) : 0;
      for (let i = 0; i < nr; i += 1) ripples.set(water!.ripples[water!.ripples.length - nr + i].slice(0, 4), i * 4);
      gl.uniform4fv(ut.uRipple, ripples);
      gl.uniform1i(ut.uNRipple, nr);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      frame += 1;
      // The particles: their depth, their thickness, smoothed.
      if (parts && pDepth && pThick && smooth && upd && upt && us && texSceneT) {
        const n = Math.min(MAXP, water!.count);
        gl.bindVertexArray(pVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, pBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, water!.drops.subarray(0, n * 4));
        const setP = (u: U) => {
          gl.uniform3f(u.uCamPos, cam.pos[0], cam.pos[1], cam.pos[2]);
          gl.uniformMatrix3fv(u.uCamRot, false, cam.rot);
          gl.uniform1f(u.uFocal, cam.focal);
          gl.uniform2f(u.uRes, W, H);
          gl.uniform1f(u.uSize, look.dropSize);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, texSceneT);
          gl.uniform1i(u.uSceneT, 0);
        };
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbPD);
        gl.viewport(0, 0, W, H);
        gl.clearColor(1e4, 0, 0, 1);
        gl.clearDepth(1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.useProgram(pDepth);
        setP(upd);
        gl.drawArrays(gl.POINTS, 0, n);
        gl.disable(gl.DEPTH_TEST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbPT);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(pThick);
        setP(upt);
        gl.drawArrays(gl.POINTS, 0, n);
        gl.disable(gl.BLEND);
        gl.bindVertexArray(vao);
        gl.useProgram(smooth);
        gl.uniform1i(us.uDepth, 0);
        gl.uniform1i(us.uThick, 1);
        gl.uniform2f(us.uOut, W, H);
        // The smoothing's reach follows the drops' size on the screen (about their radius at the fountain).
        const camDist = Math.hypot(cam.pos[0], cam.pos[1] - 6.5, cam.pos[2]);
        const reach = Math.max(0.3, look.smooth * (0.3 * look.dropSize * Math.cbrt(1 / Math.max(look.detail, 0.2)) * cam.focal * H) / camDist / 6);
        gl.uniform1f(us.uR, reach);
        const stepLoc = us.uStep;
        const sm = (fromD: WebGLTexture, fromT: WebGLTexture, to: WebGLFramebuffer, dx: number, dy: number) => {
          gl.bindFramebuffer(gl.FRAMEBUFFER, to);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, fromD);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, fromT);
          gl.uniform2f(stepLoc, dx / W, dy / H);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        };
        for (let k = 0; k < Math.max(1, Math.round(look.passes)); k += 1) {
          sm(pD[0], pT[0], fbS0!, 1, 0);
          sm(pD[1], pT[1], fbS1!, 0, 1);
        }
      }
      gl.bindVertexArray(vao);
      gl.useProgram(blur);
      const pass = (srcT: WebGLTexture, sw: number, sh: number, dst: WebGLFramebuffer, dx: number, dy: number) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, dst);
        gl.viewport(0, 0, hw, hh);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, srcT);
        gl.uniform2f(ub.uStep, dx / sw, dy / sh);
        gl.uniform2f(ub.uOut, hw, hh);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };
      pass(texHot, W, H, fbA, 1.5, 0);
      pass(halfA, hw, hh, fbB, 0, 1.5);
      pass(halfB, hw, hh, fbA, 3, 0);
      pass(halfA, hw, hh, fbB, 0, 3);
      gl.useProgram(compose);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texColor);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, halfB);
      if (parts) {
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, pD[0]);
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, pT[0]);
      }
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform2f(uc.uSize, W, H);
      gl.uniform1f(uc.uGlow, look.glow);
      gl.uniform1f(uc.uParticles, parts ? 1 : 0);
      gl.uniformMatrix3fv(uc.uCamRot, false, cam.rot);
      gl.uniform1f(uc.uFocal, cam.focal);
      gl.uniform3f(uc.uNeon, look.neon[0], look.neon[1], look.neon[2]);
      gl.uniform1f(uc.uNeonI, look.neonI);
      gl.uniform1f(uc.uKey, look.key);
      gl.uniform1f(uc.uExposure, look.exposure);
      gl.uniform1f(uc.uAbsorb, look.absorb);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      for (const t of [texColor, texHot, halfA, halfB, texSceneT, ...pD, ...pT]) if (t) gl.deleteTexture(t);
      for (const fb of [fbTrace, fbA, fbB, fbPD, fbPT, fbS0, fbS1]) if (fb) gl.deleteFramebuffer(fb);
      if (depthRb) gl.deleteRenderbuffer(depthRb);
      gl.deleteBuffer(buf);
      gl.deleteBuffer(pBuf);
      gl.deleteVertexArray(vao);
      gl.deleteVertexArray(pVao);
      for (const p of [trace, blur, compose, pDepth, pThick, smooth]) if (p) gl.deleteProgram(p);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}

export type GlassFountainTracer = NonNullable<ReturnType<typeof createGlassFountainTracer>>;
