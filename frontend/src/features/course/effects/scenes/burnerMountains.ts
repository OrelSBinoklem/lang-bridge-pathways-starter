import { norm, type BurnerModel, type V3 } from './dragonBurnerGL';

/**
 * Two mountain burners after the owner's photos, as models for the burner (dragonBurnerGL.ts). Units: 1 = 10 cm, y up,
 * the table at y = 0, the camera looking along −z. The smoke is born under the cone's cup at the top and runs down a
 * channel to a pool in the base.
 *
 * «Гора с мельницей» (red-brown painted resin, on a pink cushion before a sage-green wall): rock pillars with vertical
 * cracks round a channel down the front — a ridge with a groove in it, sills across it so the smoke falls in steps —
 * down to a water wheel standing in the basin; a ledge on the left with a house (white walls, an orange tiled roof), a
 * gold moon behind the top on the right, a pine on the right (a trunk bending up to the left, flat green pads of
 * needles) and a small bush low on the left; the base carved with curling waves.
 *
 * «Водопад» (grey stone with white veins, on a wooden table): two walls of rock round a gorge whose steep floor, with
 * knobs of rock sticking out of the stream, runs down to a pool; a white cloud up on the left, a house on a ledge, a
 * tree in yellow bloom at the front left, a white pebble.
 */

/** Cup, cone and house, the same in both; ridged noise and a fine bump for rock. */
const SHARED = `
// Ridged noise: sharp crests where plain noise is smooth (facets, cracks).
float ridged(vec3 p) { return 1.0 - abs(2.0 * vnoise(p) - 1.0); }
// A fine relief for the shading only (the normal bent by the slope of two octaves of noise): crisp grain the field
// itself does not need to carry.
vec3 bump(vec3 p, float f) {
  vec3 g = vec3(0.0);
  float a = 1.0;
  for (int k = uZero; k < 2; k++) {
    float e = 0.4;
    vec3 q = p * f;
    float c = vnoise(q);
    g += a * vec3(vnoise(q + vec3(e, 0.0, 0.0)) - c, vnoise(q + vec3(0.0, e, 0.0)) - c, vnoise(q + vec3(0.0, 0.0, e)) - c) / e;
    a *= 0.55;
    f *= 2.7;
  }
  return g;
}
uniform vec4 uCup;      // centre x, z; the cup's top, the cone's height
uniform vec4 uHouseA;   // walls: centre, half width
uniform vec4 uHouseB;   // walls: half height, half depth; roof: the ridge's height over the walls' top, overhang
// The cup: a bowl, round at the bottom; the cone on it.
float sdCup(vec3 p) {
  vec3 q = p - vec3(uCup.x, uCup.z, uCup.y);
  float d = sdEllipsoid(q + vec3(0.0, 0.06, 0.0), vec3(0.105, 0.1, 0.105));
  return max(d, q.y);
}
float sdConeT(vec3 p) {
  vec3 b = vec3(uCup.x, uCup.z, uCup.y);
  return sdRoundCone(p, b + vec3(0.0, 0.01, 0.0), b + vec3(0.0, uCup.w, 0.0), 0.085, 0.006);
}
// The house: walls with a window, a gable roof with eaves (out: the roof).
float sdHouse(vec3 p, out float roof) {
  vec3 q = p - uHouseA.xyz;
  vec3 hw = vec3(uHouseA.w, uHouseB.x, uHouseB.y);
  float walls = sdBox(q, hw) - 0.004;
  // A window and a door on the front.
  walls = max(walls, -sdBox(q - vec3(hw.x * 0.45, 0.0, hw.z), vec3(0.025, 0.022, 0.01)));
  walls = max(walls, -sdBox(q - vec3(-hw.x * 0.4, -hw.y * 0.35, hw.z), vec3(0.02, 0.04, 0.01)));
  vec3 r = q - vec3(0.0, hw.y, 0.0);
  float rise = uHouseB.z, over = uHouseB.w;
  float slope = rise / (hw.z + over);
  vec2 nrm = normalize(vec2(slope, 1.0));
  float top = dot(vec2(abs(r.z), r.y - rise), nrm);
  roof = max(max(top, -top - 0.022), max(abs(r.x) - hw.x - over, -r.y - 0.005));
  // The ridge's cap and a chimney.
  roof = min(roof, length(r.yz - vec2(rise + 0.004, 0.0)) - 0.012 + max(abs(r.x) - hw.x - over, 0.0));
  roof = min(roof, sdBox(r - vec3(hw.x * 0.5, rise * 0.7, -hw.z * 0.35), vec3(0.016, rise * 0.55, 0.016)) - 0.002);
  // A window frame's cross bars and a step at the door (part of the walls).
  walls = min(walls, max(sdBox(q - vec3(hw.x * 0.45, 0.0, hw.z), vec3(0.025, 0.022, 0.006)), min(abs(q.x - hw.x * 0.45), abs(q.y)) - 0.003));
  walls = min(walls, sdBox(q - vec3(-hw.x * 0.4, -hw.y + 0.006, hw.z + 0.012), vec3(0.03, 0.006, 0.014)));
  return walls;
}
`;

// --- «Гора с мельницей» ---------------------------------------------------------------------------------------------
const MILL = `
const float MARCH_K = 0.5;
const vec3 KEY_COL = vec3(1.0, 0.95, 0.88) * 2.3;
const vec3 AMB_COL = vec3(0.55, 0.7, 0.56) * 0.75;
const vec3 WALL = vec3(0.17, 0.25, 0.18);
uniform vec4 uRock[13];    // pillars and spires: x, z, radius, top
uniform vec4 uRidge[7];    // the channel: points along it (x, y, z, radius)
uniform vec4 uScroll[7];   // the waves curling on the base's rim
uniform vec4 uTrunk[7];
uniform vec4 uBranch[6];
uniform vec4 uPadC[15];    // the pine's pads: centre, radius x
uniform vec4 uPadR[15];    // radius y, z
uniform vec3 uWheelC;
uniform mat3 uWheelRot;
uniform vec4 uMoon;
${SHARED}

float sdRockM(vec3 p) {
  float bb = sdBox(p - vec3(-0.1, 0.82, 0.04), vec3(0.47, 0.84, 0.36));
  if (bb > 0.08) { gB = min(gB, bb); return bb; }
  float d = 1e5;
  for (int i = uZero; i < 13; i++) {
    vec4 r = uRock[i];
    // Pillars round-topped; the thin ones (spires) come to a point.
    float tip = r.z < 0.07 ? 0.15 : 0.62;
    d = smin(d, sdRoundCone(p, vec3(r.x, 0.0, r.y), vec3(r.x, r.w - r.z * tip, r.y), r.z, r.z * tip), r.z < 0.07 ? 0.04 : 0.07);
  }
  // The channel: a ridge down the front, a groove in it, sills across the groove.
  float ridge = 1e5, groove = 1e5, sill = 1e5;
  for (int i = uZero; i < 6; i++) {
    vec4 a = uRidge[i], b = uRidge[i + 1];
    ridge = smin(ridge, sdRoundCone(p, a.xyz, b.xyz, a.w, b.w), 0.04);
    groove = min(groove, sdRoundCone(p, a.xyz + vec3(0.0, 0.0, 0.08), b.xyz + vec3(0.0, 0.0, 0.08), 0.058, 0.058));
    if (i > 0) sill = min(sill, sdBox(p - a.xyz - vec3(0.0, -0.03, 0.08), vec3(0.055, 0.014, 0.05)) - 0.006);
  }
  d = smin(d, ridge, 0.05);
  // The ledge the house stands on.
  d = smin(d, sdBox(p - vec3(-0.43, 1.06, 0.04), vec3(0.19, 0.035, 0.15)) - 0.01, 0.04);
  // (owner: «слабоватая и текстура страшная») Carved like the ceramic shan-shui mountains: the rock in strata — each
  // layer a ledge that juts a little and is cut back underneath (a sawtooth in height, its rhythm wandering) — and
  // sharp upright ribs between them; only a little broad noise, no fine lumps (the grain is in the shading).
  if (d < 0.14) {
    float lay = p.y * 11.0 + 0.9 * fbm(vec3(p.x * 2.5, 0.0, p.z * 2.5));
    float saw = fract(lay);
    float strata = 0.016 * (smoothstep(0.0, 0.3, saw) - saw * 0.9);
    float ribs = 0.035 * (ridged(vec3(p.x * 13.0, p.y * 2.2, p.z * 13.0)) - 0.6) + 0.014 * (ridged(vec3(p.x * 31.0, p.y * 5.0, p.z * 31.0)) - 0.6);
    d += 0.035 * (fbm(vec3(p.x * 6.0, p.y * 2.0, p.z * 6.0)) - 0.5) + ribs - strata;
  }
  d = smax(d, -groove, 0.02);
  // Steps carved up the left from the basin to the house's ledge.
  float steps = 1e5;
  for (int i = uZero; i < 9; i++) {
    float t = float(i) / 8.0;
    vec3 c = vec3(mix(-0.22, -0.3, t) + 0.04 * sin(t * 5.0), mix(0.26, 1.0, t), mix(0.22, 0.12, t));
    steps = min(steps, sdBox(p - c, vec3(0.05, 0.012, 0.075)) - 0.004);
  }
  d = min(d, steps);
  return min(d, sill);
}
float sdBaseM(vec3 p) {
  vec3 q = p - vec3(0.05, 0.0, 0.0);
  float rimH = 0.2 + 0.035 * sin(q.x * 16.0 + 1.0) * smoothstep(0.15, 0.4, q.z);
  float d = max((length(q.xz / vec2(0.68, 0.44)) - 1.0) * 0.44, max(p.y - rimH, -p.y));
  if (d < 0.08) d += 0.02 * (fbm(vec3(p.x * 9.0, p.y * 14.0, p.z * 9.0)) - 0.5) + 0.01 * (ridged(vec3(p.x * 30.0, p.y * 12.0, p.z * 30.0)) - 0.6);
  vec2 bc = (p.xz - vec2(0.14, 0.06)) / vec2(0.42, 0.27);
  d = smax(d, -max((length(bc) - 1.0) * 0.27, 0.1 - p.y), 0.03);
  // Waves: curls (a ring with a ball in its eye and a smaller curl inside), crests between them.
  for (int i = uZero; i < 7; i++) {
    vec4 s = uScroll[i];
    vec3 c = p - s.xyz;
    float w = min(sdTorusZ(c, vec2(s.w, s.w * 0.33)), min(length(c) - s.w * 0.42, sdTorusZ(c - vec3(s.w * 0.15, s.w * 0.1, s.w * 0.15), vec2(s.w * 0.55, s.w * 0.14))));
    d = smin(d, w, 0.018);
  }
  return d;
}
float sdPine(vec3 p, out float pads) {
  float bb = sdBox(p - vec3(0.25, 0.72, 0.09), vec3(0.47, 0.6, 0.22));
  if (bb > 0.05) { gB = min(gB, bb); pads = bb; return bb; }
  float d = 1e5;
  for (int i = uZero; i < 6; i++) d = smin(d, sdRoundCone(p, uTrunk[i].xyz, uTrunk[i + 1].xyz, uTrunk[i].w, uTrunk[i + 1].w), 0.02);
  for (int i = uZero; i < 3; i++) d = smin(d, sdRoundCone(p, uBranch[i * 2].xyz, uBranch[i * 2 + 1].xyz, uBranch[i * 2].w, uBranch[i * 2 + 1].w), 0.015);
  if (d < 0.05) d += 0.009 * (ridged(vec3(p.x * 30.0, p.y * 110.0, p.z * 30.0)) - 0.6);
  pads = 1e5;
  for (int i = uZero; i < 15; i++) pads = smin(pads, sdEllipsoid(p - uPadC[i].xyz, vec3(uPadC[i].w, uPadR[i].xy)), 0.025);
  // Tufts: bumps on top, the pads' undersides combed into needles.
  if (pads < 0.05) pads += 0.02 * (vnoise(p * 42.0) - 0.5) + 0.012 * (ridged(vec3(p.x * 120.0, p.y * 40.0, p.z * 120.0)) - 0.6);
  return d;
}
float sdWheel(vec3 p) {
  vec3 q = transpose(uWheelRot) * (p - uWheelC);
  float bb = length(q) - 0.2;
  if (bb > 0.03) { gB = min(gB, bb); return bb; }
  float l = length(q.xy);
  float rim = max(abs(l - 0.15) - 0.014, abs(q.z) - 0.035) - 0.003;
  float hub = max(l - 0.032, abs(q.z) - 0.045) - 0.003;
  float sec = 6.2831853 / 8.0;
  float a = atan(q.y, q.x);
  float a6 = mod(a + 0.5 * sec, sec) - 0.5 * sec;
  vec3 s = vec3(cos(a6) * l, sin(a6) * l, q.z);
  float spokes = sdBox(s - vec3(0.09, 0.0, 0.0), vec3(0.06, 0.008, 0.008));
  // A second rim, inside, and the axle through the hub.
  rim = min(rim, max(abs(l - 0.11) - 0.006, abs(q.z) - 0.028) - 0.002);
  hub = min(hub, max(l - 0.012, abs(q.z) - 0.09));
  float sec2 = 6.2831853 / 16.0;
  float a12 = mod(a + 0.5 * sec2, sec2) - 0.5 * sec2;
  vec3 s2 = vec3(cos(a12) * l, sin(a12) * l, q.z);
  float paddles = sdBox(s2 - vec3(0.172, 0.0, 0.0), vec3(0.022, 0.006, 0.034));
  return min(min(rim, hub), min(spokes, paddles));
}
float sdMoon(vec3 p) {
  vec3 q = p - uMoon.xyz;
  return max(length(q.xy) - uMoon.w, abs(q.z) - 0.008) - 0.004;
}
// Materials: 1 rock, 2 base, 3 cup, 4 cone, 5 walls, 6 roof, 7 moon, 8 needles, 9 bark, 10 wheel.
vec2 mapM(vec3 p) {
  gB = 1e5;
  vec2 r = vec2(sdRockM(p), 1.0);
  float b = sdBaseM(p);
  if (b < r.x) r = vec2(b, 2.0);
  float cup = sdCup(p);
  if (cup < r.x) r = vec2(cup, 3.0);
  float cone = sdConeT(p);
  if (cone < r.x) r = vec2(cone, 4.0);
  float hb = sdBox(p - uHouseA.xyz - vec3(0.0, 0.06, 0.0), vec3(0.22, 0.17, 0.2));
  if (hb < 0.03) {
    float roof;
    float walls = sdHouse(p, roof);
    if (walls < r.x) r = vec2(walls, 5.0);
    if (roof < r.x) r = vec2(roof, 6.0);
  } else { gB = min(gB, hb); r.x = min(r.x, hb); }
  float moon = sdMoon(p);
  if (moon < r.x) r = vec2(moon, 7.0);
  float pads;
  float trunk = sdPine(p, pads);
  if (pads < r.x) r = vec2(pads, 8.0);
  if (trunk < r.x) r = vec2(trunk, 9.0);
  float wheel = sdWheel(p);
  if (wheel < r.x) r = vec2(wheel, 10.0);
  if (gB <= r.x) r.y = -1.0;
  return r;
}
// The room: a sage-green wall, a soft window up left, the pink cushion below.
vec3 studio(vec3 r) {
  vec3 c = mix(vec3(0.4, 0.16, 0.14) * 0.6, WALL * 1.2, smoothstep(-0.25, 0.1, r.y));
  c += vec3(1.0, 0.97, 0.92) * 2.2 * smoothstep(0.82, 0.95, dot(r, uKey)) * uKeyI;
  return c;
}
vec3 backdrop(vec2 uv) {
  return mix(WALL * 0.8, WALL * 1.35, smoothstep(-0.8, 1.2, uv.y + 0.35 * uv.x)) * (0.95 + 0.05 * vnoise(vec3(uv * 3.0, 2.0)));
}
// The pink cushion; its far edge rounds away into the wall.
void table(vec3 p, out vec3 alb, out float rough, out float glaze) {
  alb = vec3(0.6, 0.25, 0.22) * (0.94 + 0.06 * vnoise(vec3(p.xz * 40.0, 0.0)));
  rough = 0.85; glaze = 0.06;
}
// (it ends a little behind the burner: the wall shows past its rounded edge, darker as it turns down)
float tableMask(vec3 p) { return smoothstep(-0.66, -0.6, p.z); }
vec3 tableFade(vec3 p, vec3 col) { return col * mix(1.0, 0.6, smoothstep(-0.3, -0.62, p.z)); }
bool special(float mat, vec3 p, vec3 n, vec3 rd, out vec3 col) { col = vec3(0.0); return false; }
void surface(float mat, vec3 p, vec3 rd, float ao, inout vec3 n, out vec3 alb, out float rough, out float glaze, out float metal) {
  metal = 0.0; rough = 0.5; glaze = 0.3;
  if (mat < 1.5) {
    // Glazed terracotta in strata: brick red, deep brown and ochre bands following the layers (wandering as they
    // do in the shape), the glaze pooled darker in the cracks and creases (not black), thinner and lighter on the
    // ribs; moss and lichen on the ledges' tops; a fine grain only in the shading.
    float lay = p.y * 11.0 + 0.9 * fbm(vec3(p.x * 2.5, 0.0, p.z * 2.5));
    float band = fbm(vec3(p.x * 1.5, lay * 0.55, p.z * 1.5));
    vec3 brick = vec3(0.3, 0.085, 0.04), umber = vec3(0.075, 0.032, 0.02), ochre = vec3(0.46, 0.24, 0.09);
    alb = mix(umber, brick, smoothstep(0.38, 0.5, band));
    alb = mix(alb, ochre, smoothstep(0.58, 0.7, band) * 0.8);
    // Speckles in the glaze (iron spots) and its runs: a little darker streaking downwards.
    alb *= 0.82 + 0.18 * vnoise(vec3(p.x * 24.0, p.y * 6.0, p.z * 24.0));
    alb *= 1.0 - 0.35 * smoothstep(0.78, 0.9, vnoise(p * 160.0));
    float crest = ridged(vec3(p.x * 13.0, p.y * 2.2, p.z * 13.0));
    alb *= mix(0.3, 1.0, smoothstep(0.35, 0.92, ao)) * (0.8 + 0.4 * smoothstep(0.55, 0.9, crest));
    // The underside of each ledge, in its own shadow, darker.
    alb *= 0.75 + 0.25 * smoothstep(0.0, 0.25, fract(lay));
    float moss = smoothstep(0.55, 0.8, n.y) * smoothstep(0.45, 0.65, fbm(p * 9.0)) * smoothstep(0.5, 0.8, ao);
    alb = mix(alb, vec3(0.07, 0.13, 0.04) * (0.8 + 0.4 * vnoise(p * 70.0)), moss);
    n = normalize(n + bump(vec3(p.x, p.y * 0.6, p.z), 40.0) * 0.06);
    rough = mix(0.38, 0.75, moss); glaze = mix(0.45, 0.1, moss);
  } else if (mat < 2.5) {
    // The base in the same glaze, darker, the waves' crests lighter where the glaze ran thin.
    float hi = smoothstep(0.4, 0.75, fbm(p * 8.0)) * smoothstep(0.45, 0.95, ao);
    alb = mix(vec3(0.07, 0.028, 0.016), vec3(0.26, 0.08, 0.04), hi * 0.7 + 0.3 * smoothstep(0.15, 0.22, p.y));
    alb *= mix(0.5, 1.0, smoothstep(0.3, 0.9, ao));
    n = normalize(n + bump(p, 40.0) * 0.05);
    rough = 0.3; glaze = 0.6;
  } else if (mat < 3.5) {
    alb = vec3(0.55, 0.33, 0.17) * (0.9 + 0.2 * vnoise(p * 80.0)); rough = 0.75; glaze = 0.1;
  } else if (mat < 4.5) {
    alb = mix(vec3(0.5, 0.5, 0.48), vec3(0.06), smoothstep(0.01, 0.0, abs(p.y - uCup.z - 0.03) - 0.006));
    alb *= 0.85 + 0.25 * vnoise(p * 90.0); rough = 0.9; glaze = 0.05;
  } else if (mat < 5.5) {
    alb = vec3(0.62, 0.62, 0.64); rough = 0.6; glaze = 0.15;
  } else if (mat < 6.5) {
    // Orange barrel tiles: ridges down the slope, rows across it.
    float ridge = 0.5 + 0.5 * sin((p.x - uHouseA.x) * 120.0);
    float row = smoothstep(0.0, 0.25, fract(abs(p.z - uHouseA.z) * 30.0));
    alb = mix(vec3(0.25, 0.06, 0.015), vec3(0.7, 0.24, 0.04), ridge * row);
    n = normalize(n + vec3(cos((p.x - uHouseA.x) * 120.0) * 0.6, 0.0, 0.0));
    rough = 0.45; glaze = 0.35;
  } else if (mat < 7.5) {
    // Gold leaf with a few craters (darker rings).
    vec2 mq = (p.xy - uMoon.xy) / uMoon.w;
    float cr = 0.0;
    cr = max(cr, smoothstep(0.03, 0.0, abs(length(mq - vec2(0.3, 0.2)) - 0.18)));
    cr = max(cr, smoothstep(0.025, 0.0, abs(length(mq - vec2(-0.35, -0.25)) - 0.12)));
    cr = max(cr, smoothstep(0.02, 0.0, abs(length(mq - vec2(0.1, -0.45)) - 0.08)));
    alb = vec3(0.95, 0.65, 0.2) * (0.8 + 0.3 * vnoise(p * 60.0)) * (1.0 - 0.45 * cr); metal = 1.0; rough = 0.35 + 0.2 * vnoise(p * 200.0); glaze = 0.0;
  } else if (mat < 8.5) {
    // Needles in tufts: strokes along the pad, lighter on top.
    float tuft = ridged(vec3(p.x * 170.0, p.y * 30.0, p.z * 170.0)) * 0.6 + vnoise(p * 60.0) * 0.4;
    alb = mix(vec3(0.01, 0.09, 0.025), vec3(0.09, 0.46, 0.13), smoothstep(0.3, 0.75, tuft) * (0.45 + 0.55 * smoothstep(0.5, 0.95, ao)) * (0.6 + 0.4 * max(n.y, 0.0)));
    n = normalize(n + 0.5 * (vec3(vnoise(p * 140.0), vnoise(p * 140.0 + 7.0), vnoise(p * 140.0 + 13.0)) - 0.5));
    rough = 0.4; glaze = 0.35;
  } else if (mat < 9.5) {
    // Pine bark: grey-brown plates with dark fissures running along the trunk (long cells of noise), a little
    // reddish where the plates flake.
    float plates = ridged(vec3(p.x * 55.0, p.y * 14.0, p.z * 55.0));
    float flake = smoothstep(0.55, 0.8, vnoise(vec3(p.x * 30.0, p.y * 9.0, p.z * 30.0)));
    alb = mix(vec3(0.05, 0.035, 0.025), mix(vec3(0.26, 0.2, 0.15), vec3(0.4, 0.2, 0.1), flake * 0.6), smoothstep(0.25, 0.7, plates));
    alb *= mix(0.55, 1.0, smoothstep(0.3, 0.9, ao));
    n = normalize(n + bump(vec3(p.x * 2.0, p.y * 0.5, p.z * 2.0), 40.0) * 0.12);
    rough = 0.7; glaze = 0.15;
  } else {
    alb = vec3(0.55, 0.36, 0.2) * (0.85 + 0.25 * vnoise(vec3(p.x * 60.0, p.y * 60.0, p.z * 200.0)));
    rough = 0.6; glaze = 0.2;
  }
}
`;

// --- «Водопад» ------------------------------------------------------------------------------------------------------
const FALLS = `
const float MARCH_K = 0.5;
const vec3 KEY_COL = vec3(1.0, 0.9, 0.78) * 2.8;
const vec3 AMB_COL = vec3(0.45, 0.42, 0.4) * 0.45;
uniform vec4 uRock[8];
uniform vec4 uKnob[6];
uniform vec4 uCloud[4];
uniform vec4 uCanopy[12];
uniform vec4 uTrunk[2];
uniform vec4 uPebble[6];
uniform vec4 uBoulder[6];
${SHARED}

// The gorge's floor: where it is in front at height y (sloping forward going down, in gentle steps).
float floorZ(float y) { return -0.1 + (1.5 - y) * 0.18 + 0.022 * sin((1.5 - y) * 30.0); }
float sdRockF(vec3 p) {
  float bb = sdBox(p - vec3(0.08, 0.82, 0.02), vec3(0.56, 0.84, 0.36));
  if (bb > 0.08) { gB = min(gB, bb); return bb; }
  float d = 1e5;
  for (int i = uZero; i < 8; i++) {
    vec4 r = uRock[i];
    d = smin(d, sdRoundCone(p, vec3(r.x, 0.0, r.y), vec3(r.x, r.w - r.z * 0.6, r.y), r.z, r.z * 0.6), 0.06);
  }
  // The back of the gorge and its floor.
  d = smin(d, sdBox(p - vec3(0.08, 0.78, -0.2), vec3(0.3, 0.8, 0.1)), 0.05);
  float fl = (p.z - floorZ(p.y)) * 0.9;
  fl = max(fl, max(abs(p.x - 0.09) - 0.27, p.y - 1.52));
  d = smin(d, fl, 0.05);
  // The ledge the house stands on.
  d = smin(d, sdBox(p - vec3(-0.36, 0.9, 0.06), vec3(0.16, 0.03, 0.13)) - 0.01, 0.04);
  // Upright slabs (noise stretched up), sharp creases between them (ridged), a little grain.
  if (d < 0.12) d += 0.055 * (fbm(vec3(p.x * 7.0, p.y * 1.8, p.z * 7.0)) - 0.5) + 0.03 * (ridged(vec3(p.x * 14.0, p.y * 3.0, p.z * 14.0)) - 0.6)
    + 0.012 * (ridged(vec3(p.x * 34.0, p.y * 9.0, p.z * 34.0)) - 0.6) + 0.004 * (vnoise(p * 120.0) - 0.5);
  // Knobs sticking out of the stream: one at the top, two lower, three lower still; craggy.
  float kn = 1e5;
  for (int i = uZero; i < 6; i++) kn = min(kn, sdEllipsoid(p - uKnob[i].xyz, uKnob[i].w * vec3(1.0, 1.45, 1.3)));
  if (kn < 0.05) kn += 0.018 * (ridged(p * 40.0) - 0.6) + 0.008 * (ridged(p * vec3(90.0, 40.0, 90.0)) - 0.6) + 0.004 * (vnoise(p * 140.0) - 0.5);
  return smin(d, kn, 0.015);
}
float sdBaseF(vec3 p) {
  float d = max((length(p.xz / vec2(0.68, 0.5)) - 1.0) * 0.5, max(p.y - 0.2, -p.y));
  if (d < 0.08) d += 0.035 * (fbm(p * vec3(9.0, 12.0, 9.0)) - 0.5) + 0.015 * (ridged(p * vec3(26.0, 10.0, 26.0)) - 0.6);
  // Boulders on the rim.
  float bo = 1e5;
  for (int i = uZero; i < 6; i++) bo = min(bo, sdEllipsoid(p - uBoulder[i].xyz, uBoulder[i].w * vec3(1.3, 0.8, 1.0)));
  if (bo < 0.04) bo += 0.012 * (ridged(p * 35.0) - 0.6);
  d = smin(d, bo, 0.02);
  vec2 pc = (p.xz - vec2(0.05, 0.27)) / vec2(0.3, 0.17);
  float pool = max((length(pc) - 1.0) * 0.17, 0.11 - p.y);
  d = smax(d, -pool, 0.03);
  // The lip lower in front of the pool.
  return smax(d, -sdBox(p - vec3(0.05, 0.2, 0.5), vec3(0.16, 0.06, 0.08)), 0.04);
}
float sdCloud(vec3 p) {
  float bb = sdBox(p - vec3(-0.22, 1.46, 0.08), vec3(0.2, 0.09, 0.08));
  if (bb > 0.03) { gB = min(gB, bb); return bb; }
  float d = 1e5;
  for (int i = uZero; i < 4; i++) {
    vec3 q = p - uCloud[i].xyz;
    q.z *= 1.6;
    d = smin(d, (length(q) - uCloud[i].w) / 1.6, 0.03);
  }
  return min(d, sdTorusZ(p - vec3(-0.34, 1.47, 0.11), vec2(0.034, 0.013)));
}
float sdTree(vec3 p, out float trunk) {
  float bb = sdBox(p - vec3(-0.5, 0.52, 0.31), vec3(0.24, 0.34, 0.12));
  if (bb > 0.04) { gB = min(gB, bb); trunk = bb; return bb; }
  trunk = sdRoundCone(p, uTrunk[0].xyz, uTrunk[1].xyz, uTrunk[0].w, uTrunk[1].w);
  float d = 1e5;
  for (int i = uZero; i < 12; i++) d = smin(d, length(p - uCanopy[i].xyz) - uCanopy[i].w, 0.035);
  // Clusters of bloom: knobbly at two sizes.
  if (d < 0.05) d += 0.03 * (vnoise(p * 36.0) - 0.5) + 0.016 * (ridged(p * 85.0) - 0.6) + 0.006 * (vnoise(p * 200.0) - 0.5);
  return d;
}
// Materials: 1 rock, 2 base, 3 cup, 4 cone, 5 walls, 6 roof, 7 cloud, 8 blossom, 9 bark, 10 pebble.
vec2 mapM(vec3 p) {
  gB = 1e5;
  vec2 r = vec2(sdRockF(p), 1.0);
  float b = sdBaseF(p);
  if (b < r.x) r = vec2(b, 2.0);
  float cup = sdCup(p);
  if (cup < r.x) r = vec2(cup, 3.0);
  float cone = sdConeT(p);
  if (cone < r.x) r = vec2(cone, 4.0);
  float hb = sdBox(p - uHouseA.xyz - vec3(0.0, 0.05, 0.0), vec3(0.17, 0.14, 0.15));
  if (hb < 0.03) {
    float roof;
    float walls = sdHouse(p, roof);
    if (walls < r.x) r = vec2(walls, 5.0);
    if (roof < r.x) r = vec2(roof, 6.0);
  } else { gB = min(gB, hb); r.x = min(r.x, hb); }
  float cloud = sdCloud(p);
  if (cloud < r.x) r = vec2(cloud, 7.0);
  float trunk;
  float tree = sdTree(p, trunk);
  if (tree < r.x) r = vec2(tree, 8.0);
  if (trunk < r.x) r = vec2(trunk, 9.0);
  float peb = 1e5;
  for (int i = uZero; i < 6; i++) peb = min(peb, sdEllipsoid(p - uPebble[i].xyz, uPebble[i].w * vec3(1.3, 0.7, 1.0)));
  if (peb < r.x) r = vec2(peb, 10.0);
  if (gB <= r.x) r.y = -1.0;
  return r;
}
// A dim room: warm shelves out of focus, a green plant on the right, a soft lamp up left.
vec3 studio(vec3 r) {
  vec3 c = vec3(0.03, 0.022, 0.016) + vec3(0.05, 0.035, 0.022) * max(r.y, 0.0);
  c += vec3(1.0, 0.9, 0.75) * 4.0 * smoothstep(0.86, 0.96, dot(r, uKey)) * uKeyI;
  c += vec3(0.02, 0.06, 0.02) * smoothstep(0.3, 0.9, r.x);
  return c;
}
vec3 backdrop(vec2 uv) {
  vec3 c = vec3(0.012, 0.009, 0.007) + vec3(0.03, 0.018, 0.009) * smoothstep(0.4, -0.3, abs(uv.y - 0.15)) * smoothstep(0.2, -1.2, uv.x);
  c += vec3(0.03, 0.02, 0.012) * (0.5 + 0.5 * sin(uv.y * 9.0)) * smoothstep(0.0, -1.4, uv.x) * smoothstep(0.7, 0.2, abs(uv.y));
  c += vec3(0.01, 0.04, 0.012) * smoothstep(0.55, 0.0, length((uv - vec2(1.3, 0.25)) * vec2(1.4, 0.8))) * (0.5 + 0.5 * vnoise(vec3(uv * 5.0, 3.0)));
  return c;
}
// A warm brown wooden table, its grain along x.
void table(vec3 p, out vec3 alb, out float rough, out float glaze) {
  float g = fbm(vec3(p.x * 1.2, p.z * 18.0, 1.0));
  float grain = 0.5 + 0.5 * sin(p.z * 45.0 + g * 8.0);
  alb = mix(vec3(0.12, 0.06, 0.03), vec3(0.3, 0.16, 0.08), grain * 0.6 + g * 0.4);
  rough = 0.5; glaze = 0.25;
}
float tableMask(vec3 p) { return 1.0; }
vec3 tableFade(vec3 p, vec3 col) { return mix(vec3(0.012, 0.009, 0.007), col, exp(-1.6 * max(length(p.xz * vec2(0.7, 1.0)) - 0.8, 0.0))); }
bool special(float mat, vec3 p, vec3 n, vec3 rd, out vec3 col) { col = vec3(0.0); return false; }
void surface(float mat, vec3 p, vec3 rd, float ao, inout vec3 n, out vec3 alb, out float rough, out float glaze, out float metal) {
  metal = 0.0; rough = 0.5; glaze = 0.3;
  if (mat < 2.5) {
    // Dark grey stone, white veins and white on what stands out (as if dry-brushed).
    // Flowing veins (ridges of a warped noise), white caught on the tops of the rock, the hollows dark.
    // Matte stone, crisp: veins (thin ridges of a warped noise) and fine white flecks, white on the crests
    // (ridged noise where the field is convex), dark grit in the hollows, moss in a few hollows looking up; the
    // normal bent by a fine grain.
    vec3 w = p * vec3(7.0, 4.0, 7.0);
    w += 0.8 * vec3(vnoise(w * 1.7), vnoise(w * 1.7 + 4.0), vnoise(w * 1.7 + 9.0));
    float f = fbm(w);
    // Crisp, as on the photo: near-black stone, white drawn sharply along the creases (two sizes of ridged noise, narrow
    // thresholds), on the edges facing up-left (as if dry-brushed), in thin streaks down the faces; dark in the hollows.
    float r1 = ridged(vec3(p.x * 14.0, p.y * 3.0, p.z * 14.0));
    float r2 = ridged(vec3(p.x * 34.0, p.y * 9.0, p.z * 34.0));
    float crest = (smoothstep(0.86, 0.93, r1) + 0.8 * smoothstep(0.9, 0.95, r2)) * smoothstep(0.55, 0.9, ao);
    float streak = smoothstep(0.7, 0.76, vnoise(vec3(p.x * 46.0, p.y * 4.0, p.z * 46.0))) * smoothstep(0.4, 0.6, vnoise(p * 6.0 + 2.0));
    float edge = smoothstep(0.5, 0.75, dot(n, normalize(vec3(-0.5, 0.8, 0.3)))) * smoothstep(0.55, 0.65, f) * smoothstep(0.8, 0.97, ao);
    float fleck = smoothstep(0.86, 0.9, vnoise(p * 130.0)) * 0.6;
    float grit = 0.7 + 0.6 * vnoise(p * 180.0);
    float white = clamp(crest + edge + fleck + streak * 0.85, 0.0, 1.0);
    alb = mix(vec3(0.022, 0.022, 0.025) * grit, vec3(0.7, 0.71, 0.73) * (0.88 + 0.12 * vnoise(p * 110.0)), white);
    alb *= mix(0.55, 1.0, smoothstep(0.35, 0.8, ao));
    float moss = smoothstep(0.62, 0.8, vnoise(p * 9.0 + 3.0)) * smoothstep(0.4, 0.8, n.y) * smoothstep(0.85, 0.55, ao);
    alb = mix(alb, vec3(0.05, 0.09, 0.03) * (0.7 + 0.6 * vnoise(p * 220.0)), moss * 0.7);
    n = normalize(n + bump(p, 48.0) * 0.2 + bump(p, 130.0) * 0.1);
    rough = 0.72; glaze = 0.14;
  } else if (mat < 3.5) {
    alb = vec3(0.55, 0.38, 0.22) * (0.9 + 0.2 * vnoise(p * 80.0)); rough = 0.75; glaze = 0.1;
  } else if (mat < 4.5) {
    alb = mix(vec3(0.42, 0.43, 0.45), vec3(0.04), smoothstep(0.01, 0.0, abs(p.y - uCup.z - 0.025) - 0.007));
    alb *= 0.85 + 0.25 * vnoise(p * 90.0); rough = 0.9; glaze = 0.05;
  } else if (mat < 5.5) {
    alb = vec3(0.6, 0.6, 0.6) * (0.85 + 0.2 * vnoise(p * 60.0)); rough = 0.7; glaze = 0.1;
  } else if (mat < 6.5) {
    float row = smoothstep(0.0, 0.3, fract(abs(p.z - uHouseA.z) * 34.0)) * (0.7 + 0.3 * smoothstep(0.2, 0.8, fract((p.x - uHouseA.x) * 40.0)));
    alb = mix(vec3(0.2, 0.06, 0.03), vec3(0.42, 0.17, 0.1), row);
    rough = 0.7; glaze = 0.15;
  } else if (mat < 7.5) {
    alb = vec3(0.75, 0.76, 0.78); rough = 0.25; glaze = 0.6;
  } else if (mat < 8.5) {
    // Yellow blossom over green leaves.
    float bloom = smoothstep(0.45, 0.62, vnoise(p * 75.0) * 0.7 + vnoise(p * 30.0) * 0.4);
    alb = mix(vec3(0.03, 0.2, 0.03), vec3(0.85, 0.66, 0.03), bloom);
    n = normalize(n + 0.45 * (vec3(vnoise(p * 120.0), vnoise(p * 120.0 + 5.0), vnoise(p * 120.0 + 9.0)) - 0.5));
    rough = 0.6; glaze = 0.15;
  } else if (mat < 9.5) {
    alb = vec3(0.12, 0.07, 0.04); rough = 0.7; glaze = 0.1;
  } else {
    alb = vec3(0.7, 0.7, 0.68); rough = 0.35; glaze = 0.4;
  }
}
`;

const v4 = (rows: number[][]) => new Float32Array(rows.flat());

/** Wheel's frame: its axis turned 20° from the camera. */
const yaw = (20 * Math.PI) / 180;
const wheelRot = new Float32Array([Math.cos(yaw), 0, -Math.sin(yaw), 0, 1, 0, Math.sin(yaw), 0, Math.cos(yaw)]);

export const MILL_MODEL: BurnerModel = {
  id: 'mill',
  label: 'Гора с мельницей',
  glsl: MILL,
  setUniforms(gl, loc) {
    gl.uniform4fv(loc('uRock'), v4([
      [-0.08, -0.1, 0.2, 1.58], [-0.27, -0.05, 0.11, 1.42], [0.1, -0.06, 0.12, 1.48], [0.22, 0.0, 0.12, 0.88],
      [-0.24, 0.06, 0.12, 0.98], [-0.4, 0.02, 0.15, 0.72], [0.14, 0.1, 0.11, 0.48], [-0.32, 0.16, 0.12, 0.45],
      // spires: round the top, on the right shoulder, low on the left
      [0.06, -0.07, 0.05, 1.66], [-0.21, -0.1, 0.055, 1.6], [0.17, 0.06, 0.045, 1.2], [-0.33, 0.15, 0.05, 0.66], [0.3, 0.06, 0.05, 0.98],
    ]));
    gl.uniform4fv(loc('uRidge'), v4([
      [-0.06, 1.52, 0.0, 0.1], [-0.08, 1.26, 0.05, 0.12], [-0.1, 1.02, 0.09, 0.13], [-0.12, 0.78, 0.12, 0.13],
      [-0.07, 0.62, 0.15, 0.12], [-0.11, 0.47, 0.17, 0.12], [-0.08, 0.36, 0.19, 0.1],
    ]));
    gl.uniform4fv(loc('uScroll'), v4([[-0.31, 0.21, 0.34, 0.055], [0.17, 0.22, 0.4, 0.05], [0.33, 0.21, 0.37, 0.045], [0.6, 0.21, 0.21, 0.05], [-0.52, 0.2, 0.22, 0.045], [-0.05, 0.2, 0.42, 0.04], [0.47, 0.21, 0.31, 0.04]]));
    gl.uniform4fv(loc('uTrunk'), v4([
      [0.56, 0.12, 0.08, 0.055], [0.59, 0.38, 0.08, 0.042], [0.53, 0.6, 0.07, 0.036], [0.43, 0.78, 0.06, 0.03],
      [0.31, 0.9, 0.06, 0.025], [0.18, 0.98, 0.07, 0.02], [0.08, 1.02, 0.08, 0.014],
    ]));
    gl.uniform4fv(loc('uBranch'), v4([[0.53, 0.62, 0.07, 0.025], [0.6, 0.86, 0.06, 0.016], [0.43, 0.78, 0.06, 0.02], [0.32, 0.73, 0.11, 0.012], [0.31, 0.9, 0.06, 0.016], [0.36, 1.08, 0.04, 0.01]]));
    const pads = [
      [0.12, 1.1, 0.1, 0.16, 0.04, 0.12], [0.33, 1.15, 0.07, 0.18, 0.045, 0.13], [0.55, 1.06, 0.05, 0.14, 0.04, 0.11],
      [0.05, 0.98, 0.15, 0.11, 0.032, 0.09], [0.28, 1.0, 0.15, 0.14, 0.036, 0.1], [0.5, 0.93, 0.12, 0.11, 0.032, 0.09],
      [0.31, 0.74, 0.13, 0.09, 0.026, 0.07], [-0.53, 0.56, 0.14, 0.07, 0.04, 0.06], [-0.5, 0.49, 0.2, 0.05, 0.032, 0.05],
      // smaller tiers between and above
      [0.22, 1.24, 0.06, 0.1, 0.03, 0.08], [0.44, 1.2, 0.04, 0.09, 0.028, 0.07], [0.62, 0.98, 0.1, 0.07, 0.025, 0.06],
      [0.15, 0.86, 0.17, 0.07, 0.022, 0.06], [0.4, 0.84, 0.16, 0.07, 0.022, 0.06], [-0.46, 0.62, 0.1, 0.045, 0.028, 0.04],
    ];
    gl.uniform4fv(loc('uPadC'), v4(pads.map((q) => q.slice(0, 4))));
    gl.uniform4fv(loc('uPadR'), v4(pads.map((q) => [q[4], q[5], 0, 0])));
    gl.uniform3fv(loc('uWheelC'), [-0.06, 0.3, 0.3]);
    gl.uniformMatrix3fv(loc('uWheelRot'), false, wheelRot);
    gl.uniform4fv(loc('uMoon'), [0.22, 1.37, -0.14, 0.1]);
    gl.uniform4fv(loc('uCup'), [-0.07, -0.06, 1.68, 0.22]);
    gl.uniform4fv(loc('uHouseA'), [-0.44, 1.165, 0.04, 0.13]);
    gl.uniform4fv(loc('uHouseB'), [0.065, 0.09, 0.13, 0.04]);
  },
  mouth: [-0.06, 1.47, 0.065],
  mouthDir: norm([0, -1, 0.12]),
  mouthR: 0.02,
  smoke: 0.7,
  // As the others: heavy, long-lived smoke pouring down.
  smokeDefaults: { dbAmount: 1, dbHeavy: 3, dbFlow: 4, dbSpread: 3, dbSwirl: 0.35, dbLife: 40, dbDensity: 1, dbPowder: 0, dbDetail: 0, dbShade: 0.65, dbCling: 1.5 },
  camera: { target: [0.02, 0.92, 0.05], dir: norm([0.0, -0.13, -1]), fitH: 2.15, fitW: 1.75 },
  bounds: [[-0.76, 0, -0.5], [0.78, 1.95, 0.5]],
  key: norm([-0.35, 0.7, 0.62]),
};

export const FALLS_MODEL: BurnerModel = {
  id: 'falls',
  label: 'Скала с водопадом',
  glsl: FALLS,
  setUniforms(gl, loc) {
    gl.uniform4fv(loc('uRock'), v4([
      [-0.19, -0.06, 0.1, 1.62], [-0.33, -0.04, 0.13, 0.93], [-0.2, 0.15, 0.09, 1.3], [-0.28, 0.25, 0.1, 0.6],
      [0.36, -0.05, 0.11, 1.63], [0.4, 0.15, 0.09, 1.38], [0.5, 0.2, 0.1, 0.88], [0.38, 0.32, 0.08, 0.55],
    ]));
    const floorZ = (y: number) => -0.1 + (1.5 - y) * 0.18 + 0.022 * Math.sin((1.5 - y) * 30);
    // One knob high in the stream, two lower, three lower still.
    // Big lumps standing well out of the floor (≈ 2.5 r, much more than the smoke's film), so it parts round them.
    gl.uniform4fv(loc('uKnob'), v4([[0.09, 1.2, 0.085], [-0.03, 0.93, 0.08], [0.21, 0.91, 0.08], [-0.1, 0.6, 0.072], [0.09, 0.58, 0.075], [0.28, 0.6, 0.07]].map(([x, y, r]) => [x, y, floorZ(y) + r * 1.4, r])));
    gl.uniform4fv(loc('uCloud'), v4([[-0.36, 1.43, 0.06, 0.06], [-0.27, 1.47, 0.07, 0.07], [-0.17, 1.46, 0.08, 0.055], [-0.09, 1.44, 0.09, 0.04]]));
    gl.uniform4fv(loc('uCanopy'), v4([
      [-0.52, 0.72, 0.3, 0.085], [-0.42, 0.74, 0.32, 0.075], [-0.62, 0.62, 0.3, 0.075], [-0.36, 0.6, 0.34, 0.075],
      [-0.5, 0.56, 0.36, 0.085], [-0.66, 0.52, 0.28, 0.055], [-0.3, 0.52, 0.36, 0.055], [-0.46, 0.82, 0.28, 0.055],
      [-0.57, 0.8, 0.26, 0.05], [-0.68, 0.68, 0.24, 0.045], [-0.38, 0.68, 0.38, 0.05], [-0.55, 0.47, 0.38, 0.05],
    ]));
    gl.uniform4fv(loc('uTrunk'), v4([[-0.47, 0.16, 0.32, 0.025], [-0.47, 0.55, 0.32, 0.015]]));
    gl.uniform4fv(loc('uPebble'), v4([[-0.34, 0.2, 0.37, 0.035], [-0.29, 0.195, 0.4, 0.022], [-0.4, 0.2, 0.33, 0.025], [0.28, 0.2, 0.4, 0.02], [0.33, 0.2, 0.37, 0.016], [-0.24, 0.19, 0.38, 0.015]]));
    gl.uniform4fv(loc('uBoulder'), v4([[-0.58, 0.2, 0.12, 0.07], [0.55, 0.21, 0.12, 0.07], [0.42, 0.2, 0.32, 0.055], [-0.18, 0.19, 0.44, 0.04], [0.6, 0.19, -0.1, 0.06], [-0.62, 0.19, -0.12, 0.06]]));
    gl.uniform4fv(loc('uCup'), [0.1, -0.03, 1.72, 0.2]);
    gl.uniform4fv(loc('uHouseA'), [-0.38, 0.995, 0.06, 0.1]);
    gl.uniform4fv(loc('uHouseB'), [0.065, 0.07, 0.07, 0.03]);
  },
  mouth: [0.08, 1.46, -0.045],
  mouthDir: norm([0, -1, 0.2]),
  mouthR: 0.028,
  smoke: 0.8,
  // The smoke runs down the gorge's floor (floorZ above) hugging it.
  cling: { zTop: -0.1, yTop: 1.5, slope: 0.18, wig: [0.022, 30], cx: 0.09, hw: 0.27, y0: 0.22, range: 0.065 },
  // The owner's settings for this model.
  smokeDefaults: { dbAmount: 1, dbHeavy: 3, dbFlow: 4, dbSpread: 3, dbSwirl: 0.35, dbLife: 40, dbDensity: 1, dbPowder: 0, dbDetail: 0, dbShade: 0.65, dbCling: 0 },
  camera: { target: [0.0, 0.9, 0.05], dir: norm([0.0, -0.18, -1]), fitH: 2.15, fitW: 1.75 },
  bounds: [[-0.78, 0, -0.5], [0.72, 1.95, 0.55]],
  key: norm([-0.45, 0.62, 0.64]),
};

export type { V3 };
