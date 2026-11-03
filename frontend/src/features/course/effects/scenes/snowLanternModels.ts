/**
 * The New Year snow-globe lanterns of the snow-lantern effect (snowLanternGL.ts), after the owner's photos: each is a
 * GLSL distance field (`mapM`, returning distance and a material id) plus the numbers the renderer needs on the CPU —
 * the water's box (glass and glitter), the box the glitter's flow fills, how the camera frames the lantern, where the
 * lantern's own light is (for the flakes' glints) and the candles' flames.
 *
 * The GLSL contract (after the shared prelude: helpers and the I_* material ids):
 *   WATER_C / WATER_H (the glass box), LB_C / LB_H (the lantern's bounds), GROUND_Y, TABLE_KIND (0 wood, 1 marble,
 *   2 cloth), ROOM_WALL / BOKEH_A / BOKEH_B (the room behind), KEY_GAIN, LANTERN_KIND (0 an LED panel under the roof:
 *   LED_C, LED_HALF, LED_RAD; 1 the candles: CANDLE_B[11], CANDLE_POW), HAZE_COL (the light scattered in the water),
 *   LGUESS (roughly how bright the lantern's light is inside, for bounced rays), TREE_O (the tree with the garland),
 *   `vec2 mapM(vec3 p)` and `bool extraLight(vec3 org, out vec3 lp, out vec3 E, out bool toLantern)` (a third light).
 */

export type V3 = [number, number, number];

/** The box the glitter's flow fills (world units): x around cx (±hx), y from y0 to y1, z around cz (±hz); the candle
 * arch's window is a little house — above wallY its roof slopes up to apexY. */
export type FlowBox = { cx: number; cz: number; y0: number; y1: number; hx: number; hz: number; gable?: { wallY: number; apexY: number } };

export type LanternModel = {
  label: string;
  glsl: string;
  /** The glass box (centre, half sizes). */
  water: { c: V3; h: V3 };
  flow: FlowBox;
  /** What the camera frames: the lantern's middle and its width and height. */
  frame: { target: V3; w: number; h: number };
  /** The lantern's own light, for the glitter's glints (and its colour). */
  glint: V3;
  lightCol: V3;
  /** Flame centres (the candle arch), empty otherwise. */
  flames: V3[];
};

const v3 = (v: V3) => `vec3(${v.map((n) => n.toFixed(4)).join(', ')})`;

// ---------------------------------------------------------------------------------------------------------------------
// 1. The bronze lantern: a Christmas tree with a star, two snowy brick houses with lit windows, a street lamp, firs.
// ---------------------------------------------------------------------------------------------------------------------
const BRONZE_GLSL = /* glsl */ `
#define WATER_C vec3(0.0, 1.17, 0.0)
#define WATER_H vec3(0.64, 0.73, 0.40)
#define LB_C vec3(0.0, 1.38, 0.0)
#define LB_H vec3(0.84, 1.42, 0.56)
#define GROUND_Y 0.5
#define TABLE_KIND 0
#define ROOM_WALL vec3(0.07, 0.035, 0.03)
#define BOKEH_A vec3(1.0, 0.62, 0.28)
#define BOKEH_B vec3(1.0, 0.22, 0.12)
#define KEY_GAIN 1.0
#define LANTERN_KIND 0
#define LED_C vec3(0.0, 1.87, 0.0)
#define LED_HALF vec2(0.45, 0.25)
#define LED_RAD vec3(3.4, 2.85, 2.2)
#define HAZE_COL vec3(0.06, 0.05, 0.038)
#define LGUESS vec3(0.55, 0.46, 0.36)
#define TREE_O vec3(0.03, 0.5, 0.04)

const vec4 FIRS_A[6] = vec4[6](vec4(-0.38, -0.27, 0.62, 0.13), vec4(-0.14, -0.3, 0.52, 0.11), vec4(0.2, -0.29, 0.58, 0.12),
  vec4(0.47, -0.22, 0.66, 0.14), vec4(-0.55, -0.08, 0.5, 0.1), vec4(0.55, 0.14, 0.42, 0.09));

float housingA(vec3 p) {
  float d = sdRBox(p - vec3(0.0, 0.045, 0.0), vec3(0.8, 0.045, 0.52), 0.015);
  float base = sdRBox(p - vec3(0.0, 0.25, 0.0), vec3(0.73, 0.16, 0.47), 0.012);
  if (abs(p.z - 0.47) < 0.04 && base < 0.03) base -= 0.011 * smoothstep(0.014, 0.004, scrollRelief(p.xy - vec2(0.0, 0.25), 0.55));
  d = min(d, base);
  d = min(d, sdRBox(p - vec3(0.0, 0.43, 0.0), vec3(0.76, 0.025, 0.5), 0.012));
  // The window section: a shell with rounded openings front and back, narrower ones at the sides.
  vec3 w = p - vec3(0.0, 1.17, 0.0);
  float shell = sdBox(w, vec3(0.7, 0.73, 0.46));
  shell = max(shell, -sdBox(w, vec3(0.645, 0.76, 0.405)));
  float openF = sdRoundRect2(w.xy, vec2(0.55, 0.62), 0.12);
  shell = max(shell, -max(openF, abs(w.z) - 0.6));
  float openS = sdRoundRect2(w.zy, vec2(0.33, 0.62), 0.08);
  shell = max(shell, -max(openS, abs(w.x) - 0.8));
  d = min(d, shell);
  vec2 cq = abs(w.xz) - vec2(0.7, 0.46);
  d = min(d, max(length(cq) - 0.05, abs(w.y) - 0.73));
  // Cap, a concave roof, a block and the ring.
  d = min(d, sdRBox(p - vec3(0.0, 1.93, 0.0), vec3(0.77, 0.035, 0.52), 0.012));
  d = min(d, sdRBox(p - vec3(0.0, 2.0, 0.0), vec3(0.73, 0.035, 0.48), 0.012));
  float rh = clamp((p.y - 2.03) / 0.3, 0.0, 1.0);
  float sh = 1.0 - (1.0 - rh) * (1.0 - rh);
  vec2 he = mix(vec2(0.7, 0.46), vec2(0.26, 0.17), sh);
  float roof = max(sdBox2(p.xz, he), abs(p.y - 2.18) - 0.15) * 0.6;
  d = min(d, roof);
  d = min(d, sdRBox(p - vec3(0.0, 2.37, 0.0), vec3(0.2, 0.05, 0.14), 0.02));
  d = min(d, sdTorusZ(p - vec3(0.0, 2.6, 0.0), 0.17, 0.028));
  return d;
}

/** The gold: a rim round the front and back openings and scrolls in their corners. */
float ornamentA(vec3 p) {
  vec3 w = p - vec3(0.0, 1.17, 0.0);
  float fz = abs(w.z) - 0.462;
  float rim = abs(sdRoundRect2(w.xy, vec2(0.55, 0.62), 0.12)) - 0.013;
  float d = max(rim, abs(fz) - 0.012);
  vec2 c = abs(w.xy) - vec2(0.47, 0.54);
  float sp = spiral2(c, 0.011, 1.0) - 0.0065;
  sp = max(sp, length(c) - 0.13);
  d = min(d, max(sp, abs(fz) - 0.014));
  return d;
}

vec2 treeA(vec3 q) {
  float bb = sdBox(q - vec3(0.0, 0.56, 0.0), vec3(0.34, 0.64, 0.34));
  if (bb > 0.03) return vec2(bb, M(I_TREE));
  float a = atan(q.z, q.x);
  float t = 1e5;
  for (int i = uZero; i < 6; i++) {
    float fi = float(i);
    float y0 = 0.08 + fi * 0.145;
    float th = 0.26 - fi * 0.014;
    float rb = 0.31 - fi * 0.05;
    float wav = sin(a * (12.0 - fi) + fi * 1.7);
    t = min(t, sdCappedCone(q - vec3(0.0, y0 + th * 0.5, 0.0), th * 0.5, rb * (0.92 + 0.08 * wav), 0.012));
  }
  t *= 0.8;
  if (t < 0.03) t += 0.006 * (vnoise(q * 70.0) - 0.5);
  vec2 r = vec2(t, M(I_TREE));
  r = opU(r, vec2(sdCylY(q, 0.03, -0.05, 0.2), M(I_BARK)));
  vec3 s = q - vec3(0.0, 1.07, 0.0);
  r = opU(r, vec2(max(sdStar5(s.xy, 0.075, 0.45), abs(s.z) - 0.01) - 0.006, M(I_STAR)));
  float b = 1e5;
  for (int i = uZero; i < 10; i++) {
    float fi = float(i);
    float y = 0.16 + fi * 0.078;
    float rr = 0.29 * (1.0 - (y - 0.08) / 0.98) + 0.012;
    float ang = fi * 2.39996 + 0.9;
    b = min(b, length(q - vec3(cos(ang) * rr, y, sin(ang) * rr)) - 0.022);
  }
  return opU(r, vec2(b, M(I_BALL)));
}

vec2 houseA(vec3 q, vec3 hs, float rh) {
  float bb = sdBox(q - vec3(0.0, hs.y + rh * 0.7, 0.0), hs + vec3(0.06, rh * 0.7 + 0.06, 0.06));
  if (bb > 0.03) return vec2(bb, M(I_BRICK));
  vec2 r = vec2(sdBox(q - vec3(0.0, hs.y, 0.0), hs), M(I_BRICK));
  // A gable roof (ridge along x) under thick snow: rounded and overhanging; its vertical gable ends are brick.
  vec3 c = q - vec3(0.0, 2.0 * hs.y + rh, 0.0);
  float s = rh / (hs.z + 0.035);
  float roof = max((c.y + s * abs(c.z)) / sqrt(1.0 + s * s), -c.y - rh - 0.012);
  roof = max(roof, abs(c.x) - hs.x - 0.035) - 0.012;
  r = opU(r, vec2(roof, M(I_SNOWROOF)));
  vec3 cp = q - vec3(hs.x * 0.45, 2.0 * hs.y + rh * 0.85, -hs.z * 0.35);
  r = opU(r, vec2(sdBox(cp, vec3(0.022, rh * 0.55, 0.022)), M(I_BRICK)));
  r = opU(r, vec2(sdEll(cp - vec3(0.0, rh * 0.57, 0.0), vec3(0.032, 0.018, 0.032)), M(I_SNOW)));
  // Two lit windows and a door on the front, a window on the side; frames and a cross in each window.
  vec3 f = q - vec3(0.0, 0.0, hs.z);
  vec2 wx = vec2(abs(f.x) - hs.x * 0.52, f.y - hs.y * 1.15);
  float win = max(sdBox2(wx, vec2(0.03, 0.036)), abs(f.z) - 0.004);
  vec3 sd = q - vec3(hs.x, hs.y * 1.1, 0.0);
  win = min(win, max(sdBox2(sd.zy, vec2(0.03, 0.034)), abs(sd.x) - 0.004));
  r = opU(r, vec2(win, M(I_WINDOW)));
  float fr = max(abs(sdBox2(wx, vec2(0.034, 0.04))) - 0.005, abs(f.z) - 0.009);
  fr = min(fr, max(min(max(abs(wx.x) - 0.003, abs(wx.y) - 0.036), max(abs(wx.y) - 0.003, abs(wx.x) - 0.03)), abs(f.z) - 0.008));
  float door = max(sdBox2(f.xy - vec2(0.0, 0.055), vec2(0.03, 0.055)), abs(f.z) - 0.007);
  r = opU(r, vec2(min(fr, door), M(I_DOOR)));
  return r;
}

vec2 lampA(vec3 q) {
  float bb = sdBox(q - vec3(0.0, 0.38, 0.0), vec3(0.09, 0.42, 0.09));
  if (bb > 0.03) return vec2(bb, M(I_IRON));
  float post = min(sdCylY(q, 0.015, 0.0, 0.6), sdCylY(q, 0.03, -0.05, 0.05) - 0.004);
  vec3 h = q - vec3(0.0, 0.66, 0.0);
  post = min(post, sdCappedCone(h - vec3(0.0, 0.075, 0.0), 0.022, 0.066, 0.012));
  post = min(post, sdCylY(h, 0.036, -0.075, -0.055));
  post = min(post, length(h - vec3(0.0, 0.115, 0.0)) - 0.012);
  // The four corner bars of the lamp's glass.
  vec2 cb = abs(h.xz) - vec2(0.04 + 0.012 * (h.y / 0.055));
  post = min(post, max(length(cb) - 0.005, abs(h.y) - 0.055));
  vec2 r = vec2(post, M(I_IRON));
  r = opU(r, vec2(sdCappedCone(h, 0.055, 0.032, 0.05), M(I_LAMPGLASS)));
  float green = sdTorusY(q - vec3(0.0, 0.5, 0.0), 0.028, 0.018);
  if (green < 0.03) green += 0.008 * (vnoise(q * 90.0) - 0.5);
  r = opU(r, vec2(green, M(I_GREEN)));
  vec3 b = q - vec3(0.0, 0.5, 0.035);
  float bow = min(sdEll(b - vec3(-0.026, 0.012, 0.0), vec3(0.026, 0.016, 0.01)), sdEll(b - vec3(0.026, 0.012, 0.0), vec3(0.026, 0.016, 0.01)));
  bow = min(bow, sdCapsule(b, vec3(-0.004, 0.0, 0.0), vec3(-0.02, -0.065, 0.006), 0.007));
  bow = min(bow, sdCapsule(b, vec3(0.004, 0.0, 0.0), vec3(0.02, -0.065, 0.006), 0.007));
  return opU(r, vec2(bow, M(I_RIBBON)));
}

vec2 interiorA(vec3 p) {
  float gy = GROUND_Y + 0.03 * sin(p.x * 6.0 + 0.7) * cos(p.z * 4.5 - 0.3) + 0.012 * vnoise(p * 14.0)
    + 0.05 * smoothstep(0.25, 0.6, abs(p.x)) + 0.03 * smoothstep(0.0, -0.3, p.z);
  vec2 r = vec2((p.y - gy) * 0.8, M(I_SNOW));
  r = opU(r, treeA(p - TREE_O));
  r = opU(r, houseA(rotY(p - vec3(-0.33, GROUND_Y + 0.01, -0.1), 0.3), vec3(0.15, 0.1, 0.1), 0.1));
  r = opU(r, houseA(rotY(p - vec3(0.37, GROUND_Y + 0.01, -0.08), -0.35), vec3(0.14, 0.095, 0.095), 0.095));
  r = opU(r, lampA(p - vec3(-0.5, GROUND_Y, 0.19)));
  float f = 1e5;
  for (int i = uZero; i < 6; i++) {
    vec4 t = FIRS_A[i];
    vec3 q = p - vec3(t.x, GROUND_Y + 0.01, t.y);
    float b = sdBox(q - vec3(0.0, t.z * 0.5, 0.0), vec3(t.w + 0.03, t.z * 0.5 + 0.03, t.w + 0.03));
    f = min(f, b > 0.03 ? b : fir(q, t.z, t.w));
  }
  return opU(r, vec2(f, M(I_FIR)));
}

vec2 mapM(vec3 p) {
  vec2 r = vec2(p.y, M(I_TABLE));
  float bb = sdBox(p - LB_C, LB_H);
  if (bb > 0.04) { r.x = min(r.x, bb); return r; }
  r = opU(r, vec2(housingA(p), M(I_BRONZE)));
  r = opU(r, vec2(ornamentA(p), M(I_GOLD)));
  float wb = sdBox(p - WATER_C, WATER_H);
  if (wb > 0.03) r.x = min(r.x, wb);
  else r = opU(r, interiorA(p));
  return r;
}

/** The street lamp's head: a small warm light inside the water (it belongs to the lantern's light). */
bool extraLight(vec3 org, out vec3 lp, out vec3 E, out bool toLantern) {
  lp = vec3(-0.5, GROUND_Y + 0.66, 0.19) + (vec3(rnd(), rnd(), rnd()) - 0.5) * 0.05;
  vec3 d = lp - org;
  E = vec3(1.0, 0.7, 0.3) * 0.05 / max(dot(d, d), 0.004);
  toLantern = true;
  return true;
}
`;

// ---------------------------------------------------------------------------------------------------------------------
// 2. The teal-and-copper lantern: a white barn with a wreath, two deer, birches with red birds, firs.
// ---------------------------------------------------------------------------------------------------------------------
const BARN_GLSL = /* glsl */ `
#define WATER_C vec3(0.0, 0.88, 0.0)
#define WATER_H vec3(0.62, 0.54, 0.3)
#define LB_C vec3(0.0, 1.36, 0.0)
#define LB_H vec3(0.82, 1.4, 0.47)
#define GROUND_Y 0.38
#define TABLE_KIND 1
#define ROOM_WALL vec3(0.075, 0.068, 0.062)
#define BOKEH_A vec3(1.0, 0.7, 0.36)
#define BOKEH_B vec3(0.75, 0.85, 1.0)
#define KEY_GAIN 1.3
#define LANTERN_KIND 0
#define LED_C vec3(0.0, 1.405, 0.0)
#define LED_HALF vec2(0.45, 0.2)
#define LED_RAD vec3(3.6, 3.0, 2.3)
#define HAZE_COL vec3(0.055, 0.047, 0.036)
#define LGUESS vec3(0.6, 0.5, 0.4)
#define TREE_O vec3(0.0, -9.0, 0.0)

const vec4 FIRS_B[7] = vec4[7](vec4(-0.44, -0.06, 0.46, 0.11), vec4(-0.56, 0.15, 0.34, 0.08), vec4(0.41, -0.06, 0.5, 0.12),
  vec4(0.56, 0.13, 0.36, 0.085), vec4(-0.3, -0.16, 0.38, 0.09), vec4(0.29, -0.15, 0.42, 0.1), vec4(-0.05, -0.24, 0.32, 0.08));
const vec3 BIRCH[7] = vec3[7](vec3(-0.5, -0.21, 0.022), vec3(-0.35, -0.24, 0.026), vec3(-0.17, -0.26, 0.019), vec3(0.17, -0.26, 0.021),
  vec3(0.34, -0.22, 0.025), vec3(0.51, -0.19, 0.02), vec3(-0.57, 0.05, 0.017));

vec2 housingB(vec3 p) {
  float cop = sdRBox(p - vec3(0.0, 0.035, 0.0), vec3(0.79, 0.035, 0.43), 0.01);
  cop = max(cop, -sdBox(p, vec3(0.62, 0.03, 0.6)));
  cop = max(cop, -sdBox(p, vec3(0.9, 0.03, 0.28)));
  float teal = sdRBox(p - vec3(0.0, 0.14, 0.0), vec3(0.73, 0.075, 0.39), 0.01);
  cop = min(cop, sdRBox(p - vec3(0.0, 0.275, 0.0), vec3(0.7, 0.065, 0.37), 0.008));
  vec3 w = p - vec3(0.0, 0.88, 0.0);
  float shell = sdBox(w, vec3(0.69, 0.55, 0.36));
  shell = max(shell, -sdBox(w, vec3(0.625, 0.6, 0.305)));
  shell = max(shell, -max(sdRoundRect2(w.xy, vec2(0.6, 0.5), 0.015), abs(w.z) - 0.5));
  shell = max(shell, -max(sdRoundRect2(w.xy, vec2(0.63, 0.525), 0.02), 0.345 - abs(w.z)));
  shell = max(shell, -max(sdRoundRect2(w.zy, vec2(0.27, 0.5), 0.015), abs(w.x) - 0.8));
  vec3 sb = vec3(abs(w.x) - 0.66, w.y, w.z);
  shell = min(shell, min(sdBox(sb, vec3(0.025, 0.5, 0.012)), sdBox(sb, vec3(0.025, 0.012, 0.28))));
  // Rivets up the four corners, front and back (owner: «повысь детализацию, особенно второму корпусу»).
  if (abs(w.y) < 0.5) {
    vec3 rv = vec3(abs(w.x) - 0.655, mod(w.y + 0.05, 0.1) - 0.05, abs(w.z) - 0.362);
    shell = min(shell, length(rv) - 0.011);
  }
  cop = min(cop, shell);
  cop = min(cop, sdRBox(p - vec3(0.0, 1.475, 0.0), vec3(0.77, 0.04, 0.44), 0.012));
  // Beading along the eaves plate's edge.
  if (abs(p.y - 1.475) < 0.04) {
    float bead = 1e5;
    if (abs(p.x) < 0.76) bead = length(vec3(mod(p.x + 0.03, 0.06) - 0.03, p.y - 1.475, abs(p.z) - 0.452)) - 0.016;
    if (abs(p.z) < 0.43) bead = min(bead, length(vec3(abs(p.x) - 0.782, p.y - 1.475, mod(p.z + 0.03, 0.06) - 0.03)) - 0.016);
    cop = min(cop, bead);
  }
  // The same beads round the base's top.
  if (abs(p.y - 0.34) < 0.03) {
    float bead = 1e5;
    if (abs(p.x) < 0.69) bead = length(vec3(mod(p.x + 0.03, 0.06) - 0.03, p.y - 0.34, abs(p.z) - 0.372)) - 0.013;
    if (abs(p.z) < 0.36) bead = min(bead, length(vec3(abs(p.x) - 0.702, p.y - 0.34, mod(p.z + 0.03, 0.06) - 0.03)) - 0.013);
    cop = min(cop, bead);
  }
  // A bell-shaped roof: flared at the eaves, steep up to the vented neck; a cap, a knob and the ring.
  float rh = clamp((p.y - 1.51) / 0.5, 0.0, 1.0);
  float wv = 0.33 + 0.43 * pow(1.0 - rh, 2.2);
  float roofB = max(sdBox2(p.xz, vec2(wv, wv * 0.575 + 0.01)), abs(p.y - 1.76) - 0.25) * 0.5 - 0.008;
  // Standing seams down the bell: raised ribs, eight across each face.
  if (roofB < 0.02 && p.y > 1.52 && p.y < 2.0) {
    float wz = wv * 0.575 + 0.01;
    float u = abs(p.x) / wv > abs(p.z) / wz ? p.z / wz : p.x / wv;
    roofB -= 0.006 * smoothstep(0.22, 0.0, abs(fract(u * 4.0 + 0.5) - 0.5));
  }
  teal = min(teal, roofB);
  float neck = sdRBox(p - vec3(0.0, 2.1, 0.0), vec3(0.3, 0.09, 0.19), 0.01);
  if (neck < 0.02 && abs(p.y - 2.1) < 0.065) {
    float g = abs(p.z) > 0.17 ? p.x : p.z;
    neck += 0.007 * smoothstep(0.16, 0.0, abs(fract(g * 24.0) - 0.5));
  }
  teal = min(teal, neck);
  teal = min(teal, sdRBox(p - vec3(0.0, 2.205, 0.0), vec3(0.34, 0.025, 0.225), 0.01));
  teal = min(teal, sdCappedCone(p - vec3(0.0, 2.26, 0.0), 0.035, 0.2, 0.06));
  teal = min(teal, length(p - vec3(0.0, 2.33, 0.0)) - 0.05);
  teal = min(teal, sdTorusZ(p - vec3(0.0, 2.53, 0.0), 0.17, 0.026));
  return opU(vec2(cop, M(I_COPPER)), vec2(teal, M(I_TEAL)));
}

vec2 barnB(vec3 q) {
  float bb = sdBox(q - vec3(0.0, 0.29, 0.0), vec3(0.27, 0.31, 0.18));
  if (bb > 0.03) return vec2(bb, M(I_BARN));
  float body = sdBox(q - vec3(0.0, 0.16, 0.0), vec3(0.2, 0.16, 0.13));
  // A gambrel roof (ridge along z): a steep lower slope, a shallow upper one; the front gable is set back.
  vec2 a = vec2(abs(q.x), q.y);
  float d1 = dot(a - vec2(0.228, 0.3), normalize(vec2(0.14, 0.07)));
  float d2 = dot(a - vec2(0.152, 0.445), normalize(vec2(0.08, 0.15)));
  float slopes = max(d1, d2);
  float gable = max(slopes + 0.02, max(0.29 - q.y, abs(q.z) - 0.13));
  vec2 r = vec2(min(body, gable), M(I_BARN));
  float roof = max(max(slopes, -slopes - 0.02), max(0.285 - q.y, abs(q.z) - 0.155));
  r = opU(r, vec2(roof, M(I_BARNROOF)));
  vec3 f = q - vec3(0.0, 0.0, 0.13);
  float dark = max(sdBox2(f.xy - vec2(0.0, 0.4), vec2(0.028, 0.03)), abs(f.z) - 0.005);
  dark = min(dark, max(sdBox2(f.xy - vec2(0.0, 0.1), vec2(0.08, 0.1)), abs(f.z) - 0.004));
  r = opU(r, vec2(dark, M(I_DARK)));
  float xb = min(sdCapsule(f, vec3(-0.07, 0.015, 0.007), vec3(0.07, 0.185, 0.007), 0.006), sdCapsule(f, vec3(0.07, 0.015, 0.007), vec3(-0.07, 0.185, 0.007), 0.006));
  xb = min(xb, max(abs(sdBox2(f.xy - vec2(0.0, 0.1), vec2(0.08, 0.1))) - 0.007, abs(f.z) - 0.009));
  xb = min(xb, max(abs(sdBox2(f.xy - vec2(0.0, 0.4), vec2(0.028, 0.03))) - 0.006, abs(f.z) - 0.009));
  r = opU(r, vec2(xb, M(I_BARN)));
  float wr = sdTorusZ(f - vec3(0.0, 0.29, 0.014), 0.042, 0.014);
  if (wr < 0.02) wr += 0.007 * (vnoise(q * 95.0) - 0.5);
  r = opU(r, vec2(wr, M(I_GREEN)));
  vec3 bw = f - vec3(0.0, 0.25, 0.03);
  float bow = min(sdEll(bw - vec3(-0.016, 0.0, 0.0), vec3(0.016, 0.011, 0.007)), sdEll(bw - vec3(0.016, 0.0, 0.0), vec3(0.016, 0.011, 0.007)));
  return opU(r, vec2(bow, M(I_RIBBON)));
}

/** A deer facing +x, hooves at y = 0; graze lowers the head to the snow, buck gives antlers. */
vec2 deer(vec3 q, float graze, float buck) {
  float bb = sdBox(q - vec3(0.02, 0.22, 0.0), vec3(0.21, 0.24, 0.09));
  if (bb > 0.03) return vec2(bb, M(I_DEER));
  float d = sdEll(q - vec3(0.0, 0.2, 0.0), vec3(0.105, 0.052, 0.043));
  d = smin(d, sdEll(q - vec3(0.065, 0.205, 0.0), vec3(0.05, 0.056, 0.041)), 0.02);
  d = smin(d, sdEll(q - vec3(-0.07, 0.205, 0.0), vec3(0.045, 0.05, 0.04)), 0.02);
  vec3 nb = graze > 0.5 ? vec3(0.16, 0.085, 0.0) : vec3(0.13, 0.31, 0.0);
  d = smin(d, sdRoundCone(q, vec3(0.075, 0.22, 0.0), nb, 0.03, 0.02), 0.02);
  vec3 hd = graze > 0.5 ? normalize(vec3(0.45, -1.0, 0.0)) : normalize(vec3(1.0, -0.3, 0.0));
  vec3 hc = nb + hd * 0.005;
  d = smin(d, sdRoundCone(q, hc, hc + hd * 0.065, 0.024, 0.012), 0.012);
  vec3 eu = hc + (graze > 0.5 ? vec3(-0.01, -0.005, 0.0) : vec3(-0.012, 0.022, 0.0));
  d = min(d, sdEll(q - eu - vec3(0.0, 0.01, 0.02), vec3(0.009, 0.022, 0.006)));
  d = min(d, sdEll(q - eu - vec3(0.0, 0.01, -0.02), vec3(0.009, 0.022, 0.006)));
  for (int i = uZero; i < 4; i++) {
    float fx = i < 2 ? 0.07 : -0.075;
    float fz = (i == 0 || i == 2) ? 0.022 : -0.022;
    vec3 hip = vec3(fx, 0.19, fz);
    vec3 knee = vec3(fx + (i < 2 ? 0.006 : -0.022), 0.095, fz);
    d = smin(d, sdRoundCone(q, hip, knee, 0.022, 0.011), 0.012);
    d = min(d, sdRoundCone(q, knee, vec3(fx + (i < 2 ? 0.0 : -0.006), 0.006, fz), 0.011, 0.008));
  }
  d = min(d, sdEll(q - vec3(-0.112, 0.225, 0.0), vec3(0.016, 0.022, 0.01)));
  vec2 r = vec2(d, M(I_DEER));
  if (buck > 0.5) {
    float an = 1e5;
    for (int k = uZero; k < 2; k++) {
      float s = k == 0 ? 1.0 : -1.0;
      vec3 b0 = hc + vec3(-0.008, 0.026, 0.014 * s);
      vec3 b1 = b0 + vec3(-0.028, 0.075, 0.035 * s);
      vec3 b2 = b1 + vec3(0.03, 0.055, 0.012 * s);
      an = min(an, sdCapsule(q, b0, b1, 0.006));
      an = min(an, sdCapsule(q, b1, b2, 0.005));
      an = min(an, sdCapsule(q, b1, b1 + vec3(0.035, 0.035, 0.0), 0.0045));
      an = min(an, sdCapsule(q, mix(b0, b1, 0.45), mix(b0, b1, 0.45) + vec3(0.03, 0.03, 0.006 * s), 0.0045));
      an = min(an, sdCapsule(q, b2, b2 + vec3(-0.018, 0.03, 0.0), 0.004));
    }
    r = opU(r, vec2(an, M(I_ANTLER)));
  }
  return r;
}

vec2 bird(vec3 q) {
  float d = sdEll(q, vec3(0.022, 0.015, 0.014));
  d = smin(d, length(q - vec3(0.018, 0.012, 0.0)) - 0.011, 0.006);
  d = min(d, sdEll(q - vec3(0.03, 0.022, 0.0), vec3(0.006, 0.008, 0.004)));
  d = min(d, sdCapsule(q, vec3(-0.015, 0.0, 0.0), vec3(-0.04, -0.012, 0.0), 0.005));
  return vec2(d, M(I_BIRD));
}

vec2 interiorB(vec3 p) {
  float gy = GROUND_Y + 0.025 * sin(p.x * 7.0) * cos(p.z * 5.0 + 1.0) + 0.01 * vnoise(p * 15.0) + 0.04 * smoothstep(0.3, 0.6, abs(p.x));
  vec2 r = vec2((p.y - gy) * 0.8, M(I_SNOW));
  r = opU(r, barnB(p - vec3(0.0, GROUND_Y + 0.005, -0.1)));
  r = opU(r, deer(rotY(p - vec3(-0.22, GROUND_Y + 0.005, 0.11), 0.35), 0.0, 1.0));
  r = opU(r, deer(rotY(p - vec3(0.21, GROUND_Y + 0.005, 0.13), PI - 0.3), 1.0, 0.0));
  float bz = 1e5;
  for (int i = uZero; i < 7; i++) {
    vec3 b = BIRCH[i];
    vec3 q = p - vec3(b.x, 0.0, b.y);
    float fi = float(i);
    float t = length(q.xz + 0.008 * sin(q.y * vec2(9.0, 7.0) + fi)) - b.z * (1.0 - 0.18 * (q.y - GROUND_Y));
    t = max(t, max(GROUND_Y - 0.05 - q.y, q.y - 1.5));
    float hb = 1.0 + 0.06 * mod(fi, 3.0);
    float sgn = mod(fi, 2.0) < 0.5 ? 1.0 : -1.0;
    t = min(t, sdCapsule(q, vec3(0.0, hb, 0.0), vec3(0.11 * sgn, hb + 0.13, 0.02), 0.006));
    t = min(t, sdCapsule(q, vec3(0.0, hb + 0.17, 0.0), vec3(-0.08 * sgn, hb + 0.27, -0.01), 0.005));
    bz = min(bz, t);
  }
  r = opU(r, vec2(bz, M(I_BIRCH)));
  r = opU(r, bird(p - vec3(-0.27, 1.2, -0.215)));
  r = opU(r, bird(rotY(p - vec3(0.25, 1.13, -0.24), PI)));
  float f = 1e5;
  for (int i = uZero; i < 7; i++) {
    vec4 t = FIRS_B[i];
    vec3 q = p - vec3(t.x, GROUND_Y + 0.01, t.y);
    float b = sdBox(q - vec3(0.0, t.z * 0.5, 0.0), vec3(t.w + 0.03, t.z * 0.5 + 0.03, t.w + 0.03));
    f = min(f, b > 0.03 ? b : fir(q, t.z, t.w));
  }
  return opU(r, vec2(f, M(I_FIR)));
}

vec2 mapM(vec3 p) {
  vec2 r = vec2(p.y, M(I_TABLE));
  float bb = sdBox(p - LB_C, LB_H);
  if (bb > 0.04) { r.x = min(r.x, bb); return r; }
  r = opU(r, housingB(p));
  float wb = sdBox(p - WATER_C, WATER_H);
  if (wb > 0.03) r.x = min(r.x, wb);
  else r = opU(r, interiorB(p));
  return r;
}

bool extraLight(vec3 org, out vec3 lp, out vec3 E, out bool toLantern) {
  lp = vec3(0.0); E = vec3(0.0); toLantern = false;
  return false;
}
`;

// ---------------------------------------------------------------------------------------------------------------------
// 3. The candle arch: a stepped bronze arch with 11 LED candles, a little house-shaped window of water with Father
//    Christmas, a sleigh with presents and a tree before a painted night.
// ---------------------------------------------------------------------------------------------------------------------
/** The steps: half width and top of step k (k = 0 the lowest, 5 the top). */
const stepW = (k: number) => 1.04 - 0.18 * k;
const stepH = (k: number) => 0.5 + 0.15 * k;
/** Where the candles stand (the bottom of the cup): one at each end of steps 0…4 and one on the top. */
const CANDLE_BASES: V3[] = [
  ...[0, 1, 2, 3, 4].flatMap((k) => [[-(stepW(k) - 0.09), stepH(k), 0.02] as V3, [stepW(k) - 0.09, stepH(k), 0.02] as V3]),
  [0, stepH(5), 0.02],
];
const FLAME_LIFT = 0.262;

const ARCH_GLSL = /* glsl */ `
#define WATER_C vec3(0.0, 0.72, 0.05)
#define WATER_H vec3(0.42, 0.3, 0.14)
#define LB_C vec3(0.0, 0.82, 0.0)
#define LB_H vec3(1.18, 0.84, 0.3)
#define GROUND_Y 0.44
#define TABLE_KIND 2
#define ROOM_WALL vec3(0.06, 0.045, 0.035)
#define BOKEH_A vec3(1.0, 0.66, 0.3)
#define BOKEH_B vec3(1.0, 0.85, 0.55)
#define KEY_GAIN 0.55
#define LANTERN_KIND 1
#define CANDLE_POW 0.022
#define HAZE_COL vec3(0.03, 0.026, 0.02)
#define LGUESS vec3(0.35, 0.25, 0.15)
#define TREE_O vec3(0.0, -9.0, 0.0)
#define ARCH_LED vec3(0.0, 0.9, 0.06)

const vec3 CANDLE_B[11] = vec3[11](${CANDLE_BASES.map(v3).join(', ')});

/** The window: a little house (walls up to 0.8, the roof's apex at 1.02). */
float windowC(vec2 p) { return sdHouse2(p, 0.42, 0.42, 0.8, 1.02); }

float bodyC(vec3 p) {
  float d = sdRBox(p - vec3(0.0, 0.15, 0.0), vec3(1.12, 0.15, 0.24), 0.015);
  if (abs(p.z - 0.24) < 0.04 && d < 0.03) d -= 0.01 * smoothstep(0.014, 0.004, scrollRelief(p.xy - vec2(0.0, 0.15), 0.45));
  d = min(d, sdRBox(p - vec3(0.0, 0.315, 0.0), vec3(1.14, 0.018, 0.255), 0.01));
  float s = 1e5;
  for (int k = uZero; k < 6; k++) {
    float fk = float(k);
    float w = 1.04 - 0.18 * fk;
    float h = 0.5 + 0.15 * fk;
    s = min(s, sdBox(p - vec3(0.0, (0.33 + h) * 0.5, 0.0), vec3(w, (h - 0.33) * 0.5, 0.2)));
    float lip = sdRBox(p - vec3(0.0, h - 0.008, 0.0), vec3(w + 0.012, 0.014, 0.212), 0.008);
    if (k < 5) lip = max(lip, w - 0.18 - abs(p.x));
    s = min(s, lip);
    // Scallops hanging under the step's edge (on the exposed part of its front).
    if (k < 5 && abs(p.z - 0.2) < 0.03 && abs(p.x) > w - 0.18 && abs(p.x) < w) {
      vec2 sc = vec2(fract(abs(p.x) * 16.0) - 0.5, (p.y - (h - 0.04)) * 16.0);
      s = min(s, max(length(sc) / 16.0 - 0.018, max(abs(p.z - 0.205) - 0.01, p.y - (h - 0.02))));
    }
  }
  s = max(s, -max(windowC(p.xy), -(p.z + 0.09)));
  return min(d, s);
}

vec2 candlesC(vec3 p) {
  float cup = 1e5, wax = 1e5, bulb = 1e5;
  for (int i = uZero; i < 11; i++) {
    vec3 q = p - CANDLE_B[i];
    if (abs(q.x) > 0.12 || q.y < -0.05 || q.y > 0.4) {
      cup = min(cup, sdBox(q - vec3(0.0, 0.16, 0.0), vec3(0.08, 0.17, 0.08)));
      continue;
    }
    float fi = float(i);
    cup = min(cup, sdCylY(q, 0.062, 0.0, 0.032) - 0.005);
    float a = atan(q.z, q.x);
    float top = 0.235 + 0.01 * sin(a * 3.0 + fi * 1.7);
    float w = sdCylY(q, 0.05, 0.03, top);
    w = max(w, -sdCylY(q, 0.036, top - 0.016, top + 0.1));
    float da = 1.3 + fi * 0.7;
    vec3 dp = vec3(0.05 * cos(da), 0.0, 0.05 * sin(da));
    w = smin(w, sdCapsule(q, dp + vec3(0.0, top - 0.01, 0.0), dp * 1.04 + vec3(0.0, top - 0.055 - 0.02 * fract(fi * 0.37), 0.0), 0.008), 0.012);
    wax = min(wax, w);
    bulb = min(bulb, sdRoundCone(q, vec3(0.0, top - 0.008, 0.0), vec3(0.0, top + 0.05, 0.0), 0.017, 0.004));
  }
  return opU(opU(vec2(cup, M(I_GOLD)), vec2(wax, M(I_WAX))), vec2(bulb, M(I_BULB)));
}

vec2 santa(vec3 q) {
  float bb = sdBox(q - vec3(0.0, 0.17, -0.02), vec3(0.13, 0.2, 0.13));
  if (bb > 0.03) return vec2(bb, M(I_SANTA));
  float body = sdCappedCone(q - vec3(0.0, 0.1, 0.0), 0.1, 0.075, 0.05);
  body = smin(body, sdEll(q - vec3(0.0, 0.12, 0.012), vec3(0.068, 0.07, 0.064)), 0.02);
  body = min(body, min(sdRoundCone(q, vec3(0.055, 0.17, 0.0), vec3(0.085, 0.1, 0.045), 0.022, 0.018), sdRoundCone(q, vec3(-0.055, 0.17, 0.0), vec3(-0.08, 0.1, 0.045), 0.022, 0.018)));
  vec3 h = q - vec3(0.0, 0.235, 0.0);
  body = min(body, sdRoundCone(h, vec3(0.0, 0.025, 0.0), vec3(0.028, 0.1, -0.025), 0.042, 0.008));
  vec2 r = vec2(body, M(I_SANTA));
  float fur = sdTorusY(q - vec3(0.0, 0.012, 0.0), 0.074, 0.014);
  fur = min(fur, sdTorusY(h - vec3(0.0, 0.025, 0.0), 0.042, 0.011));
  fur = min(fur, length(h - vec3(0.028, 0.105, -0.025)) - 0.016);
  fur = min(fur, sdEll(h - vec3(0.0, -0.034, 0.022), vec3(0.042, 0.05, 0.03)));
  fur = min(fur, min(length(q - vec3(0.085, 0.1, 0.045)) - 0.02, length(q - vec3(-0.08, 0.1, 0.045)) - 0.02));
  if (fur < 0.02) fur += 0.004 * (vnoise(q * 120.0) - 0.5);
  r = opU(r, vec2(fur, M(I_FUR)));
  float skin = min(length(h) - 0.04, length(h - vec3(0.0, -0.002, 0.042)) - 0.009);
  r = opU(r, vec2(skin, M(I_SKIN)));
  float dk = sdTorusY(q - vec3(0.0, 0.105, 0.0), 0.069, 0.008);
  dk = min(dk, min(length(h - vec3(0.014, 0.01, 0.036)) - 0.005, length(h - vec3(-0.014, 0.01, 0.036)) - 0.005));
  dk = min(dk, min(length(q - vec3(0.088, 0.09, 0.055)) - 0.013, length(q - vec3(-0.083, 0.09, 0.055)) - 0.013));
  r = opU(r, vec2(dk, M(I_DARK)));
  r = opU(r, vec2(sdEll(q - vec3(-0.07, 0.16, -0.07), vec3(0.058, 0.072, 0.05)), M(I_SACK)));
  return r;
}

vec2 sleigh(vec3 q) {
  float bb = sdBox(q - vec3(0.0, 0.08, 0.0), vec3(0.17, 0.12, 0.09));
  if (bb > 0.03) return vec2(bb, M(I_SLEIGH));
  float b = sdRBox(q - vec3(0.0, 0.065, 0.0), vec3(0.1, 0.035, 0.055), 0.015);
  b = max(b, -sdRBox(q - vec3(-0.01, 0.105, 0.0), vec3(0.08, 0.04, 0.042), 0.01));
  b = min(b, sdRBox(q - vec3(-0.095, 0.1, 0.0), vec3(0.015, 0.06, 0.055), 0.012));
  float curl = max(sdTorusZ(vec3(q.x - 0.1, q.y - 0.07, abs(q.z) - 0.0), 0.035, 0.012), -(q.x - 0.1));
  b = min(b, max(curl, abs(q.z) - 0.055));
  vec2 r = vec2(b, M(I_SLEIGH));
  vec3 rz = vec3(q.x, q.y, abs(q.z) - 0.05);
  float run = sdCapsule(rz, vec3(-0.11, 0.004, 0.0), vec3(0.1, 0.004, 0.0), 0.006);
  run = min(run, max(sdTorusZ(rz - vec3(0.1, 0.045, 0.0), 0.041, 0.006), -(rz.x - 0.1)));
  run = min(run, min(sdCapsule(rz, vec3(-0.06, 0.004, 0.0), vec3(-0.06, 0.04, 0.0), 0.005), sdCapsule(rz, vec3(0.05, 0.004, 0.0), vec3(0.05, 0.04, 0.0), 0.005)));
  r = opU(r, vec2(run, M(I_GOLD)));
  float g = sdRBox(q - vec3(-0.025, 0.12, 0.012), vec3(0.03, 0.028, 0.03), 0.004);
  g = min(g, sdRBox(rotY(q - vec3(0.035, 0.11, -0.01), 0.5), vec3(0.025, 0.022, 0.025), 0.004));
  return opU(r, vec2(g, M(I_GIFT)));
}

vec2 interiorC(vec3 p) {
  float wb = sdBox(p - WATER_C, WATER_H);
  float gy = GROUND_Y + 0.018 * sin(p.x * 12.0 + 0.5) + 0.008 * vnoise(p * 20.0) + 0.03 * smoothstep(0.2, 0.42, abs(p.x));
  vec2 r = vec2(max((p.y - gy) * 0.8, wb), M(I_SNOW));
  r = opU(r, vec2(max(p.z + 0.085, wb), M(I_NIGHT)));
  r = opU(r, santa(rotY(p - vec3(-0.19, GROUND_Y, 0.04), -0.25)));
  r = opU(r, sleigh(rotY(p - vec3(0.05, GROUND_Y + 0.005, 0.02), PI - 0.35)));
  vec3 tq = p - vec3(0.27, GROUND_Y, -0.02);
  float tb = sdBox(tq - vec3(0.0, 0.2, 0.0), vec3(0.15, 0.23, 0.15));
  if (tb > 0.03) r.x = min(r.x, tb);
  else {
    r = opU(r, vec2(fir(tq, 0.36, 0.13), M(I_FIR)));
    vec3 s = tq - vec3(0.0, 0.385, 0.0);
    r = opU(r, vec2(max(sdStar5(s.xy, 0.032, 0.45), abs(s.z) - 0.006) - 0.004, M(I_STAR)));
    float bl = 1e5;
    for (int i = uZero; i < 6; i++) {
      float fi = float(i);
      float y = 0.07 + fi * 0.045;
      float rr = 0.12 * (1.0 - y / 0.38) + 0.006;
      float ang = fi * 2.39996 + 1.2;
      bl = min(bl, length(tq - vec3(cos(ang) * rr, y, sin(ang) * rr)) - 0.012);
    }
    r = opU(r, vec2(bl, M(I_BALL)));
  }
  float gift = sdRBox(p - vec3(0.15, GROUND_Y + 0.025, 0.1), vec3(0.03, 0.025, 0.025), 0.004);
  gift = min(gift, sdRBox(rotY(p - vec3(-0.33, GROUND_Y + 0.02, 0.09), 0.4), vec3(0.025, 0.02, 0.022), 0.004));
  return opU(r, vec2(gift, M(I_GIFT)));
}

vec2 mapM(vec3 p) {
  vec2 r = vec2(p.y, M(I_TABLE));
  float bb = sdBox(p - LB_C, LB_H);
  if (bb > 0.04) { r.x = min(r.x, bb); return r; }
  r = opU(r, vec2(bodyC(p), M(I_BRONZE)));
  float rim = max(abs(windowC(p.xy)) - 0.014, abs(p.z - 0.212) - 0.014);
  r = opU(r, vec2(rim, M(I_GOLD)));
  if (p.y > 0.4) r = opU(r, candlesC(p));
  else r.x = min(r.x, 0.4 - p.y + 0.03);
  float wb = sdBox(p - WATER_C, WATER_H);
  if (wb > 0.03) r.x = min(r.x, wb);
  else r = opU(r, interiorC(p));
  return r;
}

/** The window's own little light under its roof (steady: not the candles). */
bool extraLight(vec3 org, out vec3 lp, out vec3 E, out bool toLantern) {
  lp = ARCH_LED + (vec3(rnd(), rnd(), rnd()) - 0.5) * vec3(0.12, 0.02, 0.08);
  vec3 d = lp - org;
  E = vec3(1.0, 0.85, 0.65) * 0.06 / max(dot(d, d), 0.004);
  toLantern = false;
  return true;
}
`;

export const LANTERN_MODELS: readonly LanternModel[] = [
  {
    label: 'Бронзовый: ёлка и домики',
    glsl: BRONZE_GLSL,
    water: { c: [0, 1.17, 0], h: [0.64, 0.73, 0.4] },
    flow: { cx: 0, cz: 0, y0: 0.52, y1: 1.88, hx: 0.61, hz: 0.37 },
    frame: { target: [0, 1.43, 0], w: 1.72, h: 2.96 },
    glint: [0, 1.85, 0],
    lightCol: [1, 0.85, 0.65],
    flames: [],
  },
  {
    label: 'Бирюзовый: амбар и олени',
    glsl: BARN_GLSL,
    water: { c: [0, 0.88, 0], h: [0.62, 0.54, 0.3] },
    flow: { cx: 0, cz: 0, y0: 0.4, y1: 1.4, hx: 0.6, hz: 0.28 },
    frame: { target: [0, 1.38, 0], w: 1.72, h: 2.88 },
    glint: [0, 1.39, 0],
    lightCol: [1, 0.86, 0.68],
    flames: [],
  },
  {
    label: 'Арка со свечами',
    glsl: ARCH_GLSL,
    water: { c: [0, 0.72, 0.05], h: [0.42, 0.3, 0.14] },
    flow: { cx: 0, cz: 0.05, y0: 0.46, y1: 1.0, hx: 0.4, hz: 0.12, gable: { wallY: 0.8, apexY: 1.0 } },
    frame: { target: [0, 0.8, 0], w: 2.42, h: 1.72 },
    glint: [0, 0.9, 0.06],
    lightCol: [1, 0.72, 0.42],
    flames: CANDLE_BASES.map(([x, y, z]) => [x, y + FLAME_LIFT, z] as V3),
  },
];
