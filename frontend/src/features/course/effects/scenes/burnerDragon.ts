import { add, cross, len, mul, norm, sub, type BurnerModel, type V3 } from './dragonBurnerGL';

/**
 * The dragon on the castle (the owner's first photo), as a model for the burner (dragonBurnerGL.ts). Units: 1 = 10 cm,
 * y up, the table at y = 0, the camera looking along −z.
 *   - the castle, in glossy black glaze: a rocky dish with a pool hollowed in its front (its lip lower in front, so the
 *     smoke runs over it); behind, the keep (battlements, arched niches) and a ring of round towers — battlemented or
 *     with pointed roofs, a spire right under the orb; down its front a switchback stair: five steps down to the left
 *     from under the dragon's head, a landing, three steps down to the right, then the pool; curbs along the flights'
 *     front edges; the brickwork in the shading (raised bricks, sunk joints);
 *   - the dragon, in matte purple-grey clay: its body a chain of round cones along a spline, from the head over the
 *     castle's top and down its left side to the tail curled on the dish; a crest of spines, scales and belly plates;
 *     four legs with claws (the front one holding a blue glass orb); the head bent down over the stair, mouth open,
 *     horns swept back; the left wing spread wide (arm, wrist, four fingers, a membrane with scalloped edges and ribs),
 *     the right one folded behind;
 *   - an incense cone on its back and a stick standing in the pool.
 */

/** Body control: points along the dragon. */
const NB = 36;
/** The head is drawn this many times its design size (sdHead). */
const HS = 1.2;
/** Towers and the stair's boxes. */
const NT = 9;
const NBX = 19;

function buildDragon() {
  const head: V3 = [0.31, 1.12, 0.14];
  const fwd = norm([0.3, -0.6, 0.74]);
  const right = norm(cross(fwd, [0, 1, 0]));
  const up = cross(right, fwd);
  // The body: from behind the head up over the castle's top, along it, down its left side (in front of the towers
  // there), the tail curled on the dish's front left (x, y, z, radius).
  const ctrl: [number, number, number, number][] = [
    [0.27, 1.22, 0.07, 0.05],
    [0.22, 1.35, 0.0, 0.062],
    [0.1, 1.42, -0.08, 0.075],
    [-0.06, 1.43, -0.1, 0.08],
    [-0.2, 1.35, -0.06, 0.075],
    [-0.33, 1.18, 0.02, 0.066],
    [-0.41, 0.98, 0.1, 0.058],
    [-0.44, 0.76, 0.16, 0.05],
    [-0.42, 0.55, 0.22, 0.042],
    [-0.38, 0.37, 0.29, 0.034],
    [-0.36, 0.25, 0.38, 0.025],
    [-0.3, 0.215, 0.45, 0.016],
    [-0.21, 0.225, 0.48, 0.007],
  ];
  const cat = (p0: number[], p1: number[], p2: number[], p3: number[], t: number) => {
    const t2 = t * t, t3 = t2 * t;
    return p1.map((_, k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3));
  };
  const body: number[] = [];
  for (let i = 0; i < NB; i += 1) {
    const u = (i / (NB - 1)) * (ctrl.length - 1);
    const k = Math.min(ctrl.length - 2, Math.floor(u));
    const q = cat(ctrl[Math.max(0, k - 1)], ctrl[k], ctrl[k + 1], ctrl[Math.min(ctrl.length - 1, k + 2)], u - k);
    body.push(q[0], q[1], q[2], Math.max(0.006, q[3]));
  }
  // The orb, held by the front left paw over the spire.
  const orb: [number, number, number, number] = [-0.02, 1.15, 0.06, 0.085];
  // Legs: hip, knee, foot (with radii).
  const legs = [
    [0.07, 1.37, -0.02, 0.04], [0.03, 1.31, 0.1, 0.03], [-0.02, 1.25, 0.075, 0.022],
    [0.17, 1.34, -0.03, 0.04], [0.25, 1.22, 0.03, 0.03], [0.24, 1.08, 0.06, 0.022],
    [-0.2, 1.3, -0.02, 0.042], [-0.22, 1.17, 0.07, 0.032], [-0.2, 1.08, 0.02, 0.024],
    [-0.08, 1.36, -0.16, 0.04], [-0.02, 1.2, -0.22, 0.03], [-0.02, 1.08, -0.2, 0.022],
  ].flat();
  // Claws: three at each foot (base, tip); the orb's paw closes round the orb.
  const claws: number[] = [];
  for (let f = 0; f < 4; f += 1) {
    const foot: V3 = [legs[(f * 3 + 2) * 4], legs[(f * 3 + 2) * 4 + 1], legs[(f * 3 + 2) * 4 + 2]];
    const hip: V3 = [legs[f * 12], legs[f * 12 + 1], legs[f * 12 + 2]];
    const out = norm([foot[0] - hip[0], 0, foot[2] - hip[2]]);
    const side: V3 = [-out[2], 0, out[0]];
    for (let k = -1; k <= 1; k += 1) {
      const base = add(foot, mul(side, k * 0.014));
      let tip: V3;
      if (f === 0) {
        const a = k * 0.75;
        const dir = norm([Math.sin(a) * 0.9, 0.15, Math.cos(a) * 0.9]);
        tip = add([orb[0], orb[1], orb[2]], mul(dir, orb[3] + 0.006));
      } else {
        tip = add(add(base, mul(out, 0.032)), mul(side, k * 0.012));
        tip[1] -= 0.03;
      }
      claws.push(base[0], base[1], base[2], 0.011, tip[0], tip[1], tip[2], 0.002);
    }
  }
  // The left wing spread: shoulder, elbow, wrist, four finger tips, where its edge meets the body.
  const L = {
    S: [-0.04, 1.44, -0.12] as V3, E: [-0.26, 1.6, -0.16] as V3, W: [-0.48, 1.72, -0.12] as V3,
    F1: [-0.79, 1.66, -0.06] as V3, F2: [-0.75, 1.43, -0.03] as V3, F3: [-0.62, 1.25, -0.02] as V3, F4: [-0.43, 1.16, -0.04] as V3,
    B: [-0.22, 1.3, -0.08] as V3,
  };
  // The right wing folded up behind: shoulder, elbow, wrist, three finger tips.
  const R = { S: [0.08, 1.45, -0.16] as V3, E: [0.24, 1.62, -0.28] as V3, W: [0.36, 1.71, -0.22] as V3, G1: [0.5, 1.56, -0.3] as V3, G2: [0.44, 1.4, -0.33] as V3, G3: [0.3, 1.36, -0.3] as V3 };
  const tris = [
    [L.S, L.E, L.W], [L.S, L.W, L.F4], [L.S, L.F4, L.B], [L.W, L.F1, L.F2], [L.W, L.F2, L.F3], [L.W, L.F3, L.F4],
    [R.S, R.E, R.W], [R.S, R.W, R.G3], [R.W, R.G1, R.G2], [R.W, R.G2, R.G3],
  ].flat().flatMap((v) => [...v, 0]);
  const scallop = (a: V3, b: V3, away: V3) => {
    const m = mul(add(a, b), 0.5);
    const l = len(sub(b, a));
    return [...add(m, mul(norm(sub(m, away)), l * 0.45)), l * 0.62];
  };
  const scallops = [scallop(L.F1, L.F2, L.W), scallop(L.F2, L.F3, L.W), scallop(L.F3, L.F4, L.W), scallop(L.F4, L.B, L.S), scallop(R.G1, R.G2, R.W), scallop(R.G2, R.G3, R.W)].flat();
  const bone = (a: V3, ra: number, b: V3, rb: number) => [...a, ra, ...b, rb];
  const bones = [
    bone(L.S, 0.024, L.E, 0.019), bone(L.E, 0.019, L.W, 0.015), bone(L.W, 0.012, L.F1, 0.003), bone(L.W, 0.011, L.F2, 0.003),
    bone(L.W, 0.01, L.F3, 0.003), bone(L.W, 0.01, L.F4, 0.003), bone(L.W, 0.013, add(L.W, [0.02, 0.05, 0.035]), 0.002),
    bone(R.S, 0.022, R.E, 0.017), bone(R.E, 0.017, R.W, 0.013), bone(R.W, 0.01, R.G1, 0.003), bone(R.W, 0.009, R.G2, 0.003),
    bone(R.W, 0.009, R.G3, 0.003),
  ].flat();
  // The towers (x, z, radius, top) and their roofs (a pointed roof's height; 0: a hollow battlemented top). Round the
  // keep like the photo's: tall ones at the back, a spire right under the orb, spires along the sides, one under each
  // front foot of the dragon.
  const towerList: [number, number, number, number, number][] = [
    [-0.28, -0.04, 0.11, 1.02, 0],
    [-0.1, -0.27, 0.1, 1.2, 0],
    [0.3, -0.22, 0.09, 1.0, 0.22],
    [0.25, 0.04, 0.075, 1.0, 0],
    [0.0, 0.02, 0.06, 0.84, 0.21],
    [-0.45, -0.12, 0.07, 0.75, 0.15],
    [0.47, 0.12, 0.07, 0.8, 0.16],
    [0.56, 0.2, 0.055, 0.5, 0.13],
    [-0.26, 0.18, 0.06, 0.62, 0.14],
  ];
  const towers = towerList.flatMap((t) => [t[0], t[1], t[2], t[3]]);
  const roofs = towerList.flatMap((t) => [t[4], 0, 0, 0]);
  // The stair (boxes: from, to; the top tilted by `slope` along x about `pivot`, so what lands runs down the flight):
  // five steps down to the left from under the mouth (reaching back to the keep), a landing, three steps down to the
  // right in front of them, curbs along the front edges and at the top step's right end.
  const boxA: number[] = [];
  const boxB: number[] = [];
  const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, pivot: number, slope: number) => {
    boxA.push((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, pivot);
    boxB.push((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2, slope);
  };
  const A: [number, number][] = [[0.28, 0.86], [0.2, 0.79], [0.12, 0.72], [0.04, 0.65], [-0.04, 0.58]];
  A.forEach(([x0, top], k) => {
    const pivot = k === 0 ? 0.37 : x0 + 0.04;
    box(x0, 0.46, 0.1, top, -0.06, 0.32, pivot, 0.14);
    box(x0, 0.46, top - 0.03, top + 0.045, 0.295, 0.32, pivot, 0.14);
  });
  box(0.44, 0.46, 0.83, 0.905, -0.06, 0.32, 0.37, 0.14);
  box(-0.18, -0.04, 0.1, 0.51, -0.06, 0.48, -0.11, 0);
  box(-0.18, -0.04, 0.48, 0.555, 0.455, 0.48, -0.11, 0);
  const B: [number, number][] = [[0.05, 0.44], [0.14, 0.37], [0.23, 0.3]];
  B.forEach(([x1, top]) => {
    box(-0.18, x1, 0.1, top, 0.32, 0.48, x1 - 0.045, -0.14);
    box(-0.18, x1, top - 0.03, top + 0.045, 0.455, 0.48, x1 - 0.045, -0.14);
  });
  // The incense cone on the back (its foot, height) and the stick in the pool (from, to).
  const cone = [0.13, 1.47, -0.07, 0.15];
  const stick = [0.44, 0.12, 0.4, 0.006, 0.42, 1.0, 0.36, 0.005];
  // The mouth: the head's frame (the head is drawn HS times its design size).
  const mouth = add(add(head, mul(fwd, 0.17 * HS)), mul(up, -0.07 * HS));
  return { body, legs, claws, orb, tris, scallops, bones, towers, roofs, boxA, boxB, wristL: L.W, wristR: R.W, cone, stick, head, rot: [...right, ...up, ...fwd], mouth, fwd };
}

const GLSL = `
const int NB = ${NB};
uniform vec4 uBody[NB];
uniform vec4 uLegs[12];
uniform vec4 uClaws[24];
uniform vec3 uHead;
uniform mat3 uHeadRot;
uniform vec4 uTri[30];
uniform vec4 uScallop[6];
uniform vec4 uBone[24];
uniform vec3 uWristL;
uniform vec3 uWristR;
uniform vec4 uTowers[${NT}];
uniform vec4 uRoofs[${NT}];
uniform vec4 uBoxA[${NBX}];
uniform vec4 uBoxB[${NBX}];
uniform vec4 uOrb;
uniform vec4 uCone;
uniform vec4 uStick[2];
const float MARCH_K = 0.8;
const vec3 KEY_COL = vec3(1.0, 0.88, 0.74) * 3.2;
const vec3 AMB_COL = vec3(0.35, 0.42, 0.55) * 0.4;

// --- the castle (black glaze) ------------------------------------------------------------------------------------
// The rocky dish at the foot, a pool hollowed in its front right (the lip lower in front).
float sdBase(vec3 p) {
  vec2 e = vec2(0.66, 0.54);
  float rim = 0.19 - 0.05 * smoothstep(0.25, 0.5, p.z);
  float d = max((length(p.xz / e) - 1.0) * 0.5, max(p.y - rim, -p.y));
  if (d < 0.08) d -= 0.03 * (fbm(p * 8.0 + 3.0) - 0.5) * smoothstep(0.2, 0.04, abs(p.y - 0.09));
  vec2 pc = (p.xz - vec2(0.3, 0.33)) / vec2(0.26, 0.17);
  float pool = max((length(pc) - 1.0) * 0.17, 0.125 - p.y);
  return smax(d, -pool, 0.025);
}
// Battlements round a tower's top.
float merlonsRing(vec3 q, float r, float top) {
  float sec = 6.2831853 / 10.0;
  float a = atan(q.z, q.x);
  a = mod(a + 0.5 * sec, sec) - 0.5 * sec;
  float l = length(q.xz);
  vec3 m = vec3(cos(a) * l - (r - 0.018), q.y - top - 0.026, sin(a) * l);
  return sdBox(m, vec3(0.018, 0.026, 0.02)) - 0.003;
}
// A tower (x, z, radius, top): a round shaft, a pointed roof (roof > 0) or a hollowed battlemented top, slit windows.
float sdTower(vec3 p, vec4 tw, float roof) {
  float r = tw.z, top = tw.w;
  vec3 q = p - vec3(tw.x, 0.0, tw.y);
  float d = sdCylY(q, r, 0.1, top) - 0.004;
  if (d > 0.4) {
    d -= max(roof, 0.06) + 0.01;
    gB = min(gB, d);
    return d;
  }
  if (roof > 0.0) {
    // A ledge under the roof, then the cone.
    d = min(d, sdCylY(q, r + 0.012, top - 0.012, top + 0.008) - 0.003);
    d = min(d, sdRoundCone(q, vec3(0.0, top + 0.01, 0.0), vec3(0.0, top + roof, 0.0), r * 1.12, 0.004));
  } else {
    d = min(d, merlonsRing(q, r, top));
    d = max(d, -sdCylY(q, r - 0.03, top - 0.03, top + 0.2));
  }
  vec3 w = q - vec3(0.0, top - 0.17, r);
  return smax(d, -sdBox(w, vec3(0.008, 0.035, 0.03)), 0.004);
}
// The keep: a block with battlements along its front and sides and two arched niches.
float sdKeep(vec3 p) {
  vec3 c = vec3(-0.04, 0.53, -0.19), b = vec3(0.25, 0.47, 0.13);
  float d = sdBox(p - c, b) - 0.006;
  if (d > 0.25) return d;
  float top = c.y + b.y;
  vec3 q = p - vec3(c.x, top + 0.028, 0.0);
  vec3 f = q - vec3(0.0, 0.0, c.z + b.z - 0.02);
  f.x = mod(f.x + 0.035, 0.07) - 0.035;
  float mf = max(sdBox(f, vec3(0.018, 0.028, 0.02)), abs(q.x) - b.x + 0.005);
  vec3 s = q;
  s.x = abs(s.x) - (b.x - 0.02);
  s.z = mod(s.z - c.z + 0.035, 0.07) - 0.035;
  float ms = max(sdBox(s, vec3(0.02, 0.028, 0.018)), abs(q.z - c.z) - b.z + 0.005);
  d = min(d, min(mf, ms) - 0.003);
  vec3 n = p - vec3(-0.2, 0.0, c.z + b.z);
  n.y = n.y - 0.78;
  float niche = min(sdBox(n - vec3(0.0, -0.03, 0.0), vec3(0.035, 0.05, 0.025)), length(n.xy - vec2(0.0, 0.02)) - 0.035);
  niche = max(niche, abs(n.z) - 0.025);
  return smax(d, -niche, 0.006);
}
float sdTowers(vec3 p) {
  float d = 1e5;
  for (int i = uZero; i < ${NT}; i++) d = min(d, sdTower(p, uTowers[i], uRoofs[i].x));
  return d;
}
// The switchback stair: boxes, their tops tilted along x down the flight.
float sdStairs(vec3 p) {
  float bb = sdBox(p - vec3(0.14, 0.5, 0.21), vec3(0.34, 0.42, 0.29));
  if (bb > 0.03) {
    gB = min(gB, bb);
    return bb;
  }
  float d = 1e5;
  for (int i = uZero; i < ${NBX}; i++) {
    vec4 a = uBoxA[i], b = uBoxB[i];
    vec3 q = p;
    q.y -= (p.x - a.w) * b.w;
    d = min(d, sdBox(q - a.xyz, b.xyz - 0.003) - 0.003);
  }
  return d;
}
float sdCastle(vec3 p) {
  return min(min(sdBase(p), sdKeep(p)), min(sdTowers(p), sdStairs(p)));
}

// --- the dragon (matte clay) ---------------------------------------------------------------------------------------
float sdHead(vec3 h0, out float horn) {
  vec3 h = h0 / ${HS.toFixed(2)};
  vec3 q = vec3(abs(h.x), h.y, h.z);
  float skull = sdEllipsoid(h - vec3(0.0, 0.02, 0.0), vec3(0.1, 0.085, 0.12));
  float snout = sdRoundCone(h, vec3(0.0, 0.0, 0.06), vec3(0.0, -0.012, 0.235), 0.066, 0.042);
  float d = smin(skull, snout, 0.05);
  float jaw = sdRoundCone(h, vec3(0.0, -0.065, 0.02), vec3(0.0, -0.15, 0.19), 0.048, 0.026);
  d = smin(d, jaw, 0.025);
  d = smax(d, -sdEllipsoid(h - vec3(0.0, -0.075, 0.17), vec3(0.042, 0.03, 0.1)), 0.012);
  d = smin(d, sdEllipsoid(q - vec3(0.052, 0.074, 0.075), vec3(0.042, 0.022, 0.05)), 0.02);
  d = smax(d, -sdEllipsoid(q - vec3(0.022, 0.02, 0.238), vec3(0.012, 0.01, 0.016)), 0.006);
  float mane = sdRoundCone(q, vec3(0.03, 0.05, -0.07), vec3(0.085, 0.11, -0.2), 0.034, 0.006);
  mane = min(mane, sdRoundCone(q, vec3(0.06, 0.0, -0.06), vec3(0.15, -0.03, -0.17), 0.028, 0.004));
  mane = min(mane, sdRoundCone(q, vec3(0.07, -0.06, 0.0), vec3(0.15, -0.1, -0.08), 0.02, 0.003));
  d = smin(d, mane, 0.02);
  float teeth = sdRoundCone(q, vec3(0.03, -0.035, 0.19), vec3(0.03, -0.068, 0.19), 0.009, 0.001);
  teeth = min(teeth, sdRoundCone(q, vec3(0.028, -0.11, 0.15), vec3(0.028, -0.075, 0.155), 0.008, 0.001));
  horn = sdRoundCone(q, vec3(0.05, 0.075, -0.03), vec3(0.11, 0.17, -0.25), 0.026, 0.005);
  horn = min(horn, sdRoundCone(q, vec3(0.07, 0.04, -0.05), vec3(0.16, 0.06, -0.19), 0.016, 0.003));
  horn = min(horn, teeth) * ${HS.toFixed(2)};
  return d * ${HS.toFixed(2)};
}
float sdBody(vec3 p, out float crest, out float s, out vec3 axis, out vec3 off, out float rad) {
  float d = 1e5, best = 1e5;
  int bi = 0;
  for (int i = uZero; i < NB - 1; i++) {
    float di = sdRoundCone(p, uBody[i].xyz, uBody[i + 1].xyz, uBody[i].w, uBody[i + 1].w);
    if (di < best) { best = di; bi = i; }
    d = smin(d, di, 0.03);
  }
  vec3 a = uBody[bi].xyz, b = uBody[bi + 1].xyz, ba = b - a;
  float h = clamp(dot(p - a, ba) / dot(ba, ba), 0.0, 1.0);
  axis = normalize(ba);
  rad = mix(uBody[bi].w, uBody[bi + 1].w, h);
  off = p - (a + ba * h);
  s = (float(bi) + h) / float(NB - 1);
  vec3 out1 = normalize(vec3(a.x + 0.05, 0.0, a.z + 0.1) + vec3(1e-4));
  vec3 up = normalize(mix(out1, vec3(0.0, 1.0, 0.0), smoothstep(0.9, 1.3, a.y)) - axis * dot(axis, mix(out1, vec3(0.0, 1.0, 0.0), smoothstep(0.9, 1.3, a.y))));
  vec3 side = normalize(cross(axis, up));
  float along = (float(bi) + h) * 2.6;
  float saw = fract(along);
  float tall = 0.05 * (rad / 0.08) * (1.0 - saw) * smoothstep(0.02, 0.1, s) * (1.0 - smoothstep(0.85, 0.98, s));
  float hgt = dot(off, up) - rad * 0.6;
  crest = max(abs(dot(off, side)) - 0.006 * (1.2 - saw), max(hgt - tall, -hgt));
  crest = tall < 0.003 ? 1e5 : max(crest, length(off) - rad - tall - 0.01);
  return d;
}
float sdLegs(vec3 p) {
  float d = 1e5;
  for (int i = uZero; i < 4; i++) {
    vec4 hip = uLegs[i * 3], knee = uLegs[i * 3 + 1], foot = uLegs[i * 3 + 2];
    d = smin(d, sdRoundCone(p, hip.xyz, knee.xyz, hip.w, knee.w), 0.02);
    d = smin(d, sdRoundCone(p, knee.xyz, foot.xyz, knee.w, foot.w), 0.015);
  }
  return d;
}
float sdClaws(vec3 p) {
  float d = 1e5;
  for (int i = uZero; i < 12; i++) d = min(d, sdRoundCone(p, uClaws[i * 2].xyz, uClaws[i * 2 + 1].xyz, uClaws[i * 2].w, uClaws[i * 2 + 1].w));
  return d;
}
float sdWings(vec3 p, out float bone) {
  float region = min(sdBox(p - vec3(-0.4, 1.44, -0.1), vec3(0.43, 0.34, 0.12)), sdBox(p - vec3(0.29, 1.53, -0.24), vec3(0.25, 0.22, 0.14)));
  if (region > 0.02) {
    gB = min(gB, region);
    bone = region;
    return region;
  }
  float m = 1e5;
  for (int i = uZero; i < 10; i++) m = min(m, udTri(p, uTri[i * 3].xyz, uTri[i * 3 + 1].xyz, uTri[i * 3 + 2].xyz));
  m -= 0.0045;
  float cut = 1e5;
  for (int i = uZero; i < 6; i++) cut = min(cut, length(p - uScallop[i].xyz) - uScallop[i].w);
  m = max(m, -cut);
  bone = 1e5;
  for (int i = uZero; i < 12; i++) bone = min(bone, sdRoundCone(p, uBone[i * 2].xyz, uBone[i * 2 + 1].xyz, uBone[i * 2].w, uBone[i * 2 + 1].w));
  return m;
}
float sdEye(vec3 h) {
  return (length(vec3(abs(h.x), h.y, h.z) / ${HS.toFixed(2)} - vec3(0.061, 0.043, 0.098)) - 0.02) * ${HS.toFixed(2)};
}
float sdOrb(vec3 p) { return length(p - uOrb.xyz) - uOrb.w; }
float sdCone(vec3 p) { return sdRoundCone(p, uCone.xyz + vec3(0.0, 0.03, 0.0), uCone.xyz + vec3(0.0, uCone.w, 0.0), 0.042, 0.004); }
float sdStick(vec3 p) { return sdRoundCone(p, uStick[0].xyz, uStick[1].xyz, uStick[0].w, uStick[1].w); }
// Materials: 1 the glaze, 2 the clay, 3 horn (crest, horns, claws, the wings' bones), 4 the wings' membranes, 5 the
// eyes, 6 the orb, 7 the cone, 8 the stick.
vec2 mapM(vec3 p) {
  gB = 1e5;
  vec2 r = vec2(sdCastle(p), 1.0);
  float box = sdBox(p - vec3(-0.13, 1.0, 0.07), vec3(0.75, 0.85, 0.48));
  if (box < 0.05) {
    float crest, s, rad, horn, bone;
    vec3 axis, off;
    float body = sdBody(p, crest, s, axis, off, rad);
    body = smin(body, sdLegs(p), 0.025);
    vec3 h = transpose(uHeadRot) * (p - uHead);
    body = smin(body, sdHead(h, horn), 0.05);
    if (body < r.x) r = vec2(body, 2.0);
    float memb = sdWings(p, bone);
    float hard = min(min(crest, horn), min(sdClaws(p), bone));
    if (hard < r.x) r = vec2(hard, 3.0);
    if (memb < r.x) r = vec2(memb, 4.0);
    float eye = sdEye(h);
    if (eye < r.x) r = vec2(eye, 5.0);
  } else {
    gB = min(gB, box);
    r.x = min(r.x, box);
  }
  float orb = sdOrb(p);
  if (orb < r.x) r = vec2(orb, 6.0);
  float cone = sdCone(p);
  if (cone < r.x) r = vec2(cone, 7.0);
  float stick = sdStick(p);
  if (stick < r.x) r = vec2(stick, 8.0);
  if (gB <= r.x) r.y = -1.0;
  return r;
}

// The studio seen in a glossy surface: a big warm softbox up left in front, a cool strip at the back right, a faint
// green of plants out of focus on the left, a dark room.
vec3 studio(vec3 r) {
  vec3 c = vec3(0.012, 0.011, 0.012) + vec3(0.03, 0.026, 0.022) * max(r.y, 0.0);
  c += vec3(0.02, 0.05, 0.02) * smoothstep(0.3, 0.9, -r.x) * smoothstep(-0.2, 0.3, r.y);
  float box = smoothstep(0.88, 0.96, dot(r, uKey));
  c += vec3(1.0, 0.9, 0.78) * 7.0 * box * uKeyI;
  float strip = smoothstep(0.93, 0.985, dot(r, RIM));
  c += vec3(0.7, 0.8, 1.0) * 2.5 * strip;
  return c;
}
vec3 backdrop(vec2 uv) {
  vec3 bg = vec3(0.004, 0.0038, 0.0042) + vec3(0.012, 0.009, 0.007) * exp(-5.0 * dot(uv - vec2(0.0, 0.25), uv - vec2(0.0, 0.25)));
  return bg + vec3(0.004, 0.012, 0.005) * smoothstep(0.6, 0.0, length((uv - vec2(-1.0, 0.1)) * vec2(1.0, 1.6))) * (0.6 + 0.4 * vnoise(vec3(uv * 6.0, 1.0)));
}
// Old dark wood: long grain along x, cracks; it fades into the dark away from the burner.
void table(vec3 p, out vec3 alb, out float rough, out float glaze) {
  float g = fbm(vec3(p.x * 1.5, p.z * 22.0, 0.0));
  float grain = 0.5 + 0.5 * sin(p.z * 60.0 + g * 9.0);
  alb = mix(vec3(0.05, 0.04, 0.032), vec3(0.13, 0.1, 0.075), grain * 0.7 + g * 0.3);
  alb *= 0.75 + 0.25 * smoothstep(0.02, 0.06, abs(fract(p.z * 3.1 + g * 0.3) - 0.5));
  rough = 0.55; glaze = 0.25;
}
float tableMask(vec3 p) { return 1.0; }
vec3 tableFade(vec3 p, vec3 col) { return mix(vec3(0.004, 0.0038, 0.0042), col, exp(-2.2 * max(length(p.xz * vec2(0.8, 1.0)) - 0.75, 0.0))); }

// Brickwork on the castle's upright faces: rows of raised bricks, staggered, sunk joints (returns the joint, 0…1, and
// bends the normal at the bricks' edges, both ways, so each brick catches its own highlight).
float bricks(vec3 p, inout vec3 n) {
  if (abs(n.y) > 0.6 || p.y < 0.2) return 0.0;
  float u = abs(n.z) > abs(n.x) ? p.x : p.z;
  float row = floor(p.y / 0.034);
  float v = fract(p.y / 0.034);
  float uu = fract(u / 0.072 + 0.5 * mod(row, 2.0));
  float j = max(smoothstep(0.1, 0.0, v) + smoothstep(0.9, 1.0, v), smoothstep(0.06, 0.0, uu) + smoothstep(0.94, 1.0, uu));
  j = clamp(j, 0.0, 1.0);
  vec3 t = normalize(cross(vec3(0.0, 1.0, 0.0), n) + vec3(1e-4));
  n = normalize(n + vec3(0.0, (v < 0.5 ? -1.0 : 1.0) * 0.45 * smoothstep(0.22, 0.0, min(v, 1.0 - v)), 0.0)
      + t * (uu < 0.5 ? -1.0 : 1.0) * 0.35 * smoothstep(0.12, 0.0, min(uu, 1.0 - uu)) * sign(abs(n.z) > abs(n.x) ? n.z : -n.x));
  return j;
}
// The blue glass orb: deep blue inside, the light focused through it glowing on its far side, the studio in its
// surface.
bool special(float mat, vec3 p, vec3 n, vec3 rd, out vec3 col) {
  col = vec3(0.0);
  if (mat < 5.5 || mat > 6.5) return false;
  vec3 v = -rd;
  float nv = max(dot(n, v), 0.0);
  float fres = 0.04 + 0.96 * pow(1.0 - nv, 5.0);
  vec3 inner = vec3(0.004, 0.03, 0.16) * (0.4 + 0.6 * nv);
  inner += vec3(0.05, 0.35, 0.9) * pow(max(dot(n, -uKey), 0.0), 3.0) * 1.2 * uKeyI;
  inner += vec3(0.02, 0.12, 0.35) * pow(1.0 - nv, 2.0);
  vec3 refl = studio(reflect(rd, n));
  vec3 hk = normalize(uKey + v);
  col = inner * (1.0 - fres) + refl * fres + vec3(1.0, 0.95, 0.9) * 3.2 * uKeyI * ggx(max(dot(n, hk), 0.0), 0.06) * 0.05;
  return true;
}
void surface(float mat, vec3 p, vec3 rd, float ao, inout vec3 n, out vec3 alb, out float rough, out float glaze, out float metal) {
  metal = 0.0;
  if (mat > 7.5) {
    // The stick: pale bamboo, its burnt tip dark.
    alb = mix(vec3(0.42, 0.22, 0.09), vec3(0.03), smoothstep(0.96, 0.99, p.y)); rough = 0.5; glaze = 0.2;
  } else if (mat > 6.5) {
    float ash = smoothstep(uCone.y + uCone.w * 0.72, uCone.y + uCone.w * 0.85, p.y);
    alb = mix(vec3(0.32, 0.17, 0.08) * (0.85 + 0.3 * vnoise(p * 120.0)), vec3(0.42, 0.41, 0.39), ash);
    rough = 0.85; glaze = 0.05;
  } else if (mat > 4.5) {
    alb = vec3(0.12, 0.05, 0.02); rough = 0.1; glaze = 1.0;
  } else if (mat > 2.5 && mat < 3.5) {
    alb = vec3(0.1, 0.082, 0.09); rough = 0.38; glaze = 0.35;
  } else if (mat > 3.5) {
    vec3 rel = p - (p.x < 0.0 ? uWristL : uWristR);
    float ang = atan(rel.y, rel.x);
    float rib = 0.5 + 0.5 * sin(ang * 46.0 + vnoise(p * 30.0) * 2.0);
    alb = vec3(0.07, 0.054, 0.064) * (0.8 + 0.3 * rib);
    n = normalize(n + cross(n, vec3(0.0, 0.0, 1.0)) * (rib - 0.5) * 0.15);
    rough = 0.6; glaze = 0.2;
  } else if (mat > 1.5) {
    alb = vec3(0.072, 0.056, 0.064);
    rough = 0.55; glaze = 0.25;
    float crest, s, rad;
    vec3 axis, off;
    if (sdBody(p, crest, s, axis, off, rad) < 0.004) {
      vec3 up = normalize(vec3(0.0, 1.0, 0.0) - axis * axis.y + vec3(1e-4));
      vec3 side = normalize(cross(axis, up));
      float ang = atan(dot(off, side), dot(off, up));
      vec3 inward = normalize(vec3(-p.x - 0.05, 0.0, -p.z - 0.1) + vec3(1e-4));
      vec3 bellyDir = normalize(mix(inward, vec3(0.0, -1.0, 0.0), smoothstep(0.9, 1.3, p.y)));
      float belly = smoothstep(0.35, 0.75, dot(normalize(off), bellyDir));
      float u = s * 170.0, w = ang / 6.2832 * 18.0;
      float row = floor(u);
      vec2 cell = vec2(fract(u), fract(w + 0.5 * mod(row, 2.0))) - 0.5;
      float edge = smoothstep(0.28, 0.5, max(abs(cell.x) * 1.3, length(cell)));
      n = normalize(n + axis * cell.x * 0.45 * (1.0 - belly));
      float plate = smoothstep(0.35, 0.5, abs(fract(s * 210.0) - 0.5));
      alb = mix(alb * (1.0 - 0.5 * edge) * (1.0 + 0.25 * (1.0 - edge)), vec3(0.12, 0.1, 0.1) * (1.0 - 0.3 * plate), belly);
      rough = mix(0.5, 0.65, belly);
    }
  } else {
    // The castle: black glaze, the joints between bricks duller.
    float j = bricks(p, n);
    alb = vec3(0.007, 0.007, 0.008) + vec3(0.01) * j;
    rough = mix(0.08, 0.45, j); glaze = mix(1.0, 0.4, j);
    if (p.y < 0.2) rough = 0.12 + 0.1 * vnoise(p * 25.0);
  }
}
`;

export const DRAGON_MODEL: BurnerModel = (() => {
  const b = buildDragon();
  return {
    id: 'dragon',
    label: 'Дракон на замке',
    // The owner's settings for this model.
    smokeDefaults: { dbAmount: 1, dbHeavy: 3, dbFlow: 4, dbSpread: 3, dbSwirl: 0.35, dbLife: 40, dbDensity: 1, dbPowder: 0, dbDetail: 0, dbShade: 0.65, dbCling: 3 },
    glsl: GLSL,
    setUniforms(gl, loc) {
      gl.uniform4fv(loc('uBody'), new Float32Array(b.body));
      gl.uniform4fv(loc('uLegs'), new Float32Array(b.legs));
      gl.uniform4fv(loc('uClaws'), new Float32Array(b.claws));
      gl.uniform4fv(loc('uTri'), new Float32Array(b.tris));
      gl.uniform4fv(loc('uScallop'), new Float32Array(b.scallops));
      gl.uniform4fv(loc('uBone'), new Float32Array(b.bones));
      gl.uniform4fv(loc('uTowers'), new Float32Array(b.towers));
      gl.uniform4fv(loc('uRoofs'), new Float32Array(b.roofs));
      gl.uniform4fv(loc('uBoxA'), new Float32Array(b.boxA));
      gl.uniform4fv(loc('uBoxB'), new Float32Array(b.boxB));
      gl.uniform3fv(loc('uWristL'), b.wristL);
      gl.uniform3fv(loc('uWristR'), b.wristR);
      gl.uniform4fv(loc('uOrb'), new Float32Array(b.orb));
      gl.uniform4fv(loc('uCone'), new Float32Array(b.cone));
      gl.uniform4fv(loc('uStick'), new Float32Array(b.stick));
      gl.uniform3fv(loc('uHead'), b.head);
      gl.uniformMatrix3fv(loc('uHeadRot'), false, new Float32Array(b.rot));
    },
    mouth: b.mouth,
    // Forward and down out of the mouth.
    mouthDir: norm(add(mul(b.fwd, 0.3), [0, -1, 0])),
    mouthR: 0.025,
    smoke: 1,
    camera: { target: [-0.08, 0.86, 0.05], dir: norm([0.05, -0.3, -1]), fitH: 2.2, fitW: 1.75 },
    bounds: [[-0.9, 0, -0.56], [0.68, 1.9, 0.6]],
    key: norm([-0.55, 0.65, 0.52]),
  };
})();
