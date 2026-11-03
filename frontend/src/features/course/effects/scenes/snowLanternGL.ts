import { createKit, FULL_VS, TONEMAP_GLSL, type Target } from './glKit';
import type { FlowBox, LanternModel, V3 } from './snowLanternModels';

/**
 * The New Year snow-globe lantern (the snow-lantern effect): a lantern with a little world inside water and glitter
 * swirling in it, after the owner's photos.
 *
 * The lantern and everything in it stand still, so their light is baked once, by ray tracing a distance field
 * (snowLanternModels.ts): many jittered samples per pixel (antialiasing), each with a soft shadow ray to an area key
 * light (the room's lamp), one to the lantern's own light (an LED panel under the roof, or one of the candles picked at
 * random), one to a third light of the model, a diffuse bounce (ambient occlusion and colour from the room, the
 * emitters seen) and a reflection (the metal, the glazed table); through the front glass a Fresnel reflection of the
 * room, the water's slight tint and the light scattered in it. The samples add up (blending) in three float targets,
 * band by band across frames so a frame never stalls: the light that never changes; the lantern's own light (kept apart
 * so its brightness and the candles' flicker are free at run time) with how much of the water a pixel sees; the depth
 * to the first thing behind the water (the glitter hides behind the figures).
 *
 * The glitter is simulated on the CPU (thousands of flakes and snow): a pump drives a flow given by a stream function
 * ψ = S·F(ξ)·G(η) in the water's box (divergence free: u = ∂ψ/∂y, v = −∂ψ/∂x) — jets up the side walls (or the middle,
 * or one wall), along the top, a slow downdraught (the flakes fall like snow), along the bottom back to the pump, whose
 * nozzle lifts them into the jet again (near the floor the stream function alone would leave them lying) —
 * plus a gentle turn round the vertical and curl noise (sums of waves, also divergence free); each flake lags behind
 * the water (inertia), sinks at its own speed and tumbles; drawn as points (a glint when a flake's face mirrors the
 * lantern's light or the room's lamp into the eye), hidden by the baked depth. A click shakes the lantern, a drag
 * stirs the water. The candles' flames are drawn on top, each flickering. Then bloom and a filmic curve.
 */

export type LanternLook = {
  /** Glitter amount (1 = the default count), flake size, share of white snow, pump, swirls, how fast flakes sink. */
  glitter: number;
  size: number;
  snow: number;
  pump: number;
  swirl: number;
  settle: number;
  sparkle: number;
  /** The lantern's own light, the candles' flicker, bloom, exposure. */
  light: number;
  flicker: number;
  bloom: number;
  exposure: number;
  /** 0 jets up both side walls, 1 one jet in the middle, 2 one jet up the left wall. */
  pumpMode: number;
  /** 0 silver (and a little gold), 1 gold, 2 rainbow. */
  palette: number;
  /** 0 everything, 1 without the glitter, 2 the glitter alone. */
  view: number;
};
/** What the bake depends on: the room's light, samples per pixel, how close the camera is. */
export type LanternBake = { room: number; samples: number; zoom: number; yaw?: number; pitch?: number };
export type LanternPointer = { x: number; y: number; pressed: boolean; clicked: boolean; active: boolean };

const BAKE_PRELUDE = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
uniform vec2 uRes;
uniform int uSample;
uniform int uZero;
uniform vec3 uCamPos;
uniform vec3 uCamFwd;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform float uTanHalf;
uniform float uRoom;
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
layout(location = 2) out vec4 o2;
#define PI 3.14159265
#define FAR 26.0
#define M(x) float(x)
#define I_TABLE 0
#define I_BRONZE 1
#define I_GOLD 2
#define I_SNOW 3
#define I_TREE 4
#define I_BARK 5
#define I_STAR 6
#define I_BALL 7
#define I_BRICK 8
#define I_SNOWROOF 9
#define I_WINDOW 10
#define I_DOOR 11
#define I_IRON 12
#define I_LAMPGLASS 13
#define I_GREEN 14
#define I_RIBBON 15
#define I_TEAL 16
#define I_COPPER 17
#define I_BARN 18
#define I_BARNROOF 19
#define I_DEER 20
#define I_BIRCH 21
#define I_DARK 22
#define I_BIRD 23
#define I_WAX 24
#define I_SANTA 25
#define I_SKIN 26
#define I_FUR 27
#define I_SACK 28
#define I_NIGHT 29
#define I_SLEIGH 30
#define I_GIFT 31
#define I_ANTLER 32
#define I_FIR 33
#define I_BULB 34

uint rngState;
uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
float rnd() { rngState = pcg(rngState); return float(rngState) * (1.0 / 4294967296.0); }
float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float hash12(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0)), f.x), f.y), f.z);
}
float fbm3(vec3 p) {
  float a = 0.5, s = 0.0;
  for (int i = uZero; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 1.7; a *= 0.5; }
  return s;
}
float sdBox(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float sdBox2(vec2 p, vec2 b) { vec2 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0); }
float sdRBox(vec3 p, vec3 b, float r) { return sdBox(p, b - r) - r; }
float sdRoundRect2(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float sdCylY(vec3 p, float r, float y0, float y1) {
  vec2 d = vec2(length(p.xz) - r, max(y0 - p.y, p.y - y1));
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}
/** A cone frustum centred at the origin: y from -h to h, radius r1 at the bottom, r2 at the top. */
float sdCappedCone(vec3 p, float h, float r1, float r2) {
  vec2 q = vec2(length(p.xz), p.y);
  vec2 k1 = vec2(r2, h);
  vec2 k2 = vec2(r2 - r1, 2.0 * h);
  vec2 ca = vec2(q.x - min(q.x, (q.y < 0.0) ? r1 : r2), abs(q.y) - h);
  vec2 cb = q - k1 + k2 * clamp(dot(k1 - q, k2) / dot(k2, k2), 0.0, 1.0);
  float s = (cb.x < 0.0 && ca.y < 0.0) ? -1.0 : 1.0;
  return s * sqrt(min(dot(ca, ca), dot(cb, cb)));
}
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}
float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2) {
  vec3 ba = b - a;
  float l2 = dot(ba, ba);
  float rr = r1 - r2;
  float a2 = l2 - rr * rr;
  float il2 = 1.0 / l2;
  vec3 pa = p - a;
  float y = dot(pa, ba);
  float z = y - l2;
  vec3 xv = pa * l2 - ba * y;
  float x2 = dot(xv, xv);
  float y2 = y * y * l2;
  float z2 = z * z * l2;
  float k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
  if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
float sdEll(vec3 p, vec3 r) { float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float sdTorusY(vec3 p, float R, float r) { return length(vec2(length(p.xz) - R, p.y)) - r; }
float sdTorusZ(vec3 p, float R, float r) { return length(vec2(length(p.xy) - R, p.z)) - r; }
float sdStar5(vec2 p, float r, float rf) {
  const vec2 k1 = vec2(0.809016994375, -0.587785252292);
  const vec2 k2 = vec2(-0.809016994375, -0.587785252292);
  p.x = abs(p.x);
  p -= 2.0 * max(dot(k1, p), 0.0) * k1;
  p -= 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}
/** A little house in 2D: walls |x| < hw from yb up to yw, a roof up to the apex at ya. */
float sdHouse2(vec2 p, float hw, float yb, float yw, float ya) {
  float box = sdBox2(p - vec2(0.0, (yb + ya) * 0.5), vec2(hw, (ya - yb) * 0.5));
  vec2 n = normalize(vec2(ya - yw, hw));
  return max(box, dot(vec2(abs(p.x), p.y - ya), n));
}
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
vec2 opU(vec2 a, vec2 b) { return a.x < b.x ? a : b; }
vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
/** Distance to an Archimedean spiral r = b·θ of 1 + turns turns. */
float spiral2(vec2 q, float b, float turns) {
  float r = length(q);
  float a = atan(q.y, q.x) + PI;
  float n = clamp(floor((r / b - a) / (2.0 * PI) + 0.5), 0.0, turns);
  return abs(r - b * (a + 2.0 * PI * n));
}
/** Baroque scrolls, mirrored about x = 0 (the lanterns' cast ornament): distance to their lines. */
float scrollRelief(vec2 q, float s) {
  q /= s;
  q.x = abs(q.x);
  float d = spiral2(q - vec2(0.3, 0.0), 0.016, 1.0);
  d = min(d, spiral2(vec2(q.x - 0.85, 0.02 - q.y), 0.014, 1.0));
  d = min(d, spiral2(q - vec2(1.2, 0.04), 0.008, 1.0));
  float x = clamp(q.x, 0.08, 1.12);
  d = min(d, length(vec2(q.x - x, q.y - 0.11 * sin((x - 0.08) * 6.0))));
  d = min(d, abs(length(q) - 0.07));
  return d * s;
}
/** A snowy fir: three fluffy tiers, base at the origin. */
float fir(vec3 q, float h, float rb) {
  float a = atan(q.z, q.x);
  float d = sdCylY(q, rb * 0.12, -0.02, h * 0.2);
  for (int i = uZero; i < 3; i++) {
    float fi = float(i);
    float y0 = h * (0.1 + fi * 0.27);
    float th = h * 0.42;
    float rr = rb * (1.0 - fi * 0.28);
    d = min(d, sdCappedCone(q - vec3(0.0, y0 + th * 0.5, 0.0), th * 0.5, rr * (0.9 + 0.1 * sin(a * 9.0 + fi * 2.0)), 0.006));
  }
  d *= 0.85;
  if (d < 0.02) d += 0.005 * (vnoise(q * 80.0) - 0.5);
  return d;
}
`;

const BAKE_MAIN = /* glsl */ `
#define KEY_POS vec3(-2.2, 3.6, 3.2)
#define KEY_COL (vec3(1.0, 0.88, 0.74) * 0.55 * KEY_GAIN)

struct Mat { vec3 alb; float rough; float metal; vec3 emis; vec3 emisL; };

vec3 snowCol(vec3 p, inout Mat m) {
  float s = hash13(floor(p * 520.0));
  if (s > 0.993) { m.emisL += vec3(1.0, 0.95, 0.85) * 1.2; m.emis += vec3(0.25); }
  return vec3(0.86, 0.89, 0.94) * (0.94 + 0.06 * vnoise(p * 60.0));
}

Mat material(int id, vec3 p, vec3 n, float cav) {
  Mat m = Mat(vec3(0.5), 0.6, 0.0, vec3(0.0), vec3(0.0));
  if (id == I_TABLE) {
#if TABLE_KIND == 0
    float g = fbm3(vec3(p.x * 2.5, p.y, p.z * 36.0));
    m.alb = mix(vec3(0.1, 0.05, 0.025), vec3(0.24, 0.13, 0.065), g);
    m.rough = 0.32;
#elif TABLE_KIND == 1
    float v = fbm3(p * vec3(2.2, 1.0, 2.2) + 3.0);
    float vein = smoothstep(0.025, 0.0, abs(v - 0.52));
    m.alb = mix(vec3(0.76, 0.75, 0.73), vec3(0.42, 0.42, 0.44), vein * 0.75);
    m.rough = 0.2;
#else
    float wv = 0.5 + 0.5 * sin(p.x * 320.0) * sin(p.z * 320.0);
    m.alb = vec3(0.8, 0.77, 0.72) * (0.93 + 0.07 * wv) * (0.9 + 0.1 * fbm3(p * 6.0));
    m.rough = 0.92;
#endif
  } else if (id == I_BRONZE) {
    float gr = fbm3(p * 22.0);
    vec3 mid = mix(vec3(0.06, 0.042, 0.026), vec3(0.15, 0.095, 0.05), gr);
    float hi = smoothstep(0.08, 0.55, cav + (gr - 0.5) * 0.35);
    float lo = smoothstep(-0.08, -0.45, cav);
    m.alb = mix(mix(mid, vec3(0.72, 0.53, 0.25), hi), vec3(0.015, 0.012, 0.008), lo);
    m.metal = mix(0.55, 1.0, hi);
    m.rough = mix(0.5, 0.28, hi);
  } else if (id == I_GOLD) {
    m.alb = vec3(0.8, 0.6, 0.27) * (0.7 + 0.3 * smoothstep(-0.3, 0.3, cav));
    m.metal = 1.0;
    m.rough = 0.3;
  } else if (id == I_SNOW) {
    m.alb = snowCol(p, m);
    m.rough = 0.75;
  } else if (id == I_SNOWROOF) {
    if (n.y > 0.28) { m.alb = snowCol(p, m); m.rough = 0.75; }
    else if (n.y < -0.2) m.alb = vec3(0.09, 0.05, 0.03);
    else m.alb = vec3(0.4, 0.16, 0.09) * (0.8 + 0.3 * vnoise(p * 80.0));
  } else if (id == I_TREE || id == I_FIR) {
    vec3 green = id == I_TREE ? mix(vec3(0.025, 0.11, 0.045), vec3(0.06, 0.2, 0.08), vnoise(p * 60.0))
                              : mix(vec3(0.02, 0.09, 0.05), vec3(0.05, 0.16, 0.09), vnoise(p * 60.0));
    float sn = smoothstep(0.45, 0.8, n.y + 0.4 * (vnoise(p * 45.0) - 0.5) + (id == I_FIR ? 0.08 : 0.0));
    m.alb = mix(green, vec3(0.85, 0.88, 0.93), sn);
    m.rough = 0.75;
    if (id == I_TREE) {
      vec3 q = p - TREE_O;
      float band = fract(q.y * 5.5 - atan(q.z, q.x) / (2.0 * PI));
      if (band < 0.07) {
        m.alb = vec3(0.85, 0.65, 0.25) * (0.7 + 0.5 * vnoise(p * 200.0));
        m.metal = 1.0;
        m.rough = 0.35;
      }
    }
  } else if (id == I_BARK) {
    m.alb = vec3(0.14, 0.08, 0.04);
    m.rough = 0.9;
  } else if (id == I_STAR) {
    m.alb = vec3(0.9, 0.7, 0.2);
    m.metal = 0.8;
    m.rough = 0.3;
    m.emisL = vec3(1.0, 0.75, 0.25) * 0.7;
  } else if (id == I_BALL) {
    m.alb = vec3(0.55, 0.02, 0.02);
    m.metal = 0.5;
    m.rough = 0.18;
  } else if (id == I_BRICK) {
    vec2 bp = vec2(p.x + p.z, p.y) * vec2(28.0, 52.0);
    float row = floor(bp.y);
    bp.x += mod(row, 2.0) * 0.5;
    vec2 f = fract(bp);
    float mortar = max(step(f.x, 0.08), step(f.y, 0.13));
    vec3 brick = mix(vec3(0.3, 0.1, 0.06), vec3(0.5, 0.2, 0.1), hash12(floor(bp)));
    m.alb = mix(brick, vec3(0.55, 0.5, 0.45), mortar);
    m.rough = 0.85;
  } else if (id == I_WINDOW) {
    m.alb = vec3(0.1);
    m.emisL = vec3(1.0, 0.6, 0.22) * 3.0;
  } else if (id == I_DOOR) {
    m.alb = vec3(0.12, 0.06, 0.03);
  } else if (id == I_IRON) {
    m.alb = vec3(0.03, 0.03, 0.035);
    m.metal = 0.6;
    m.rough = 0.35;
  } else if (id == I_LAMPGLASS) {
    m.alb = vec3(0.2);
    m.emisL = vec3(1.0, 0.78, 0.35) * 5.0;
  } else if (id == I_GREEN) {
    m.alb = vec3(0.035, 0.15, 0.055);
    m.rough = 0.8;
  } else if (id == I_RIBBON) {
    m.alb = vec3(0.6, 0.03, 0.03);
    m.rough = 0.35;
  } else if (id == I_TEAL) {
    // Teal paint with a mottled patina: lighter verdigris gathered in the creases, darker where handled.
    float mot = fbm3(p * 18.0);
    m.alb = mix(vec3(0.022, 0.08, 0.095), vec3(0.04, 0.12, 0.13), smoothstep(0.35, 0.7, mot));
    m.alb = mix(m.alb, vec3(0.13, 0.27, 0.24), clamp(cav, 0.0, 1.0) * 0.55);
    m.rough = 0.38 + 0.15 * mot;
  } else if (id == I_COPPER) {
    // Copper, a little hammered, with darker patina spots.
    float spot = smoothstep(0.58, 0.78, fbm3(p * 11.0));
    m.alb = vec3(0.36, 0.18, 0.095) * (0.85 + 0.25 * fbm3(p * 30.0)) * (1.0 + 0.4 * clamp(cav, 0.0, 1.0)) * (1.0 - 0.45 * spot);
    m.metal = 0.25;
    m.rough = 0.4 + 0.2 * spot;
  } else if (id == I_BARN) {
    float g = fract((abs(n.z) > 0.6 ? p.x : p.z) * 45.0);
    float groove = smoothstep(0.12, 0.0, g);
    m.alb = vec3(0.8, 0.78, 0.72) * (1.0 - 0.55 * groove) * (0.82 + 0.18 * fbm3(p * 25.0));
    m.rough = 0.8;
  } else if (id == I_BARNROOF) {
    if (n.y > 0.5 && vnoise(p * 30.0) > 0.3) { m.alb = snowCol(p, m); }
    else if (n.y < -0.2) m.alb = vec3(0.08);
    else m.alb = vec3(0.3, 0.29, 0.28) * (0.75 + 0.25 * step(0.15, fract(p.y * 60.0)));
    m.rough = 0.8;
  } else if (id == I_DEER) {
    m.alb = vec3(0.56, 0.21, 0.05) * (0.9 + 0.2 * vnoise(p * 70.0));
    if (n.y < -0.45) m.alb = vec3(0.82, 0.74, 0.62);
    if (n.y > 0.1 && vnoise(p * 110.0) > 0.74) m.alb = vec3(0.88, 0.82, 0.72);
    if (p.y < GROUND_Y + 0.016) m.alb = vec3(0.04);
    m.rough = 0.75;
  } else if (id == I_BIRCH) {
    float mk = vnoise(vec3(p.x * 25.0, p.y * 60.0, p.z * 25.0));
    m.alb = mk > 0.68 ? vec3(0.05) : vec3(0.86, 0.85, 0.8);
    m.rough = 0.8;
  } else if (id == I_DARK) {
    m.alb = vec3(0.03, 0.025, 0.02);
    m.rough = 0.7;
  } else if (id == I_BIRD) {
    m.alb = vec3(0.65, 0.04, 0.03);
  } else if (id == I_WAX) {
    m.alb = vec3(0.93, 0.86, 0.7);
    m.rough = 0.55;
#if LANTERN_KIND == 1
    float best = 9.0, top = 0.0;
    for (int i = uZero; i < 11; i++) {
      float dx = abs(p.x - CANDLE_B[i].x);
      if (dx < best) { best = dx; top = CANDLE_B[i].y + 0.235; }
    }
    m.emisL = vec3(1.0, 0.62, 0.28) * exp(-max(top - p.y, 0.0) * 22.0) * 1.4;
#endif
  } else if (id == I_SANTA) {
    m.alb = vec3(0.5, 0.025, 0.03);
    m.rough = 0.8;
  } else if (id == I_SKIN) {
    m.alb = vec3(0.85, 0.58, 0.48);
  } else if (id == I_FUR) {
    m.alb = vec3(0.92, 0.91, 0.88);
    m.rough = 0.95;
  } else if (id == I_SACK) {
    m.alb = vec3(0.38, 0.24, 0.12) * (0.85 + 0.3 * fbm3(p * 40.0));
    m.rough = 0.9;
  } else if (id == I_NIGHT) {
    m.alb = vec3(0.02, 0.03, 0.07);
    vec2 c = p.xy * 38.0;
    vec2 ci = floor(c);
    float h = hash12(ci);
    float st = 0.0;
    if (h > 0.88) st = smoothstep(0.12, 0.0, length(fract(c) - 0.5 - (vec2(hash12(ci + 3.1), hash12(ci + 7.7)) - 0.5) * 0.6));
    vec2 mp = p.xy - vec2(-0.25, 0.88);
    float moon = smoothstep(0.046, 0.04, length(mp)) * smoothstep(0.03, 0.04, length(mp - vec2(0.02, 0.012)));
    m.emis = vec3(0.9, 0.9, 1.0) * st * 1.6 + vec3(1.0, 0.95, 0.75) * moon * 1.5 + vec3(0.01, 0.016, 0.045) * smoothstep(0.5, 1.0, p.y);
  } else if (id == I_SLEIGH) {
    m.alb = vec3(0.55, 0.03, 0.03);
    m.rough = 0.25;
    m.metal = 0.2;
  } else if (id == I_GIFT) {
    float h = hash13(floor(p * 9.0 + 0.5));
    m.alb = h < 0.33 ? vec3(0.05, 0.32, 0.1) : h < 0.66 ? vec3(0.06, 0.14, 0.5) : vec3(0.8, 0.6, 0.2);
    m.rough = 0.5;
  } else if (id == I_ANTLER) {
    m.alb = vec3(0.42, 0.32, 0.2);
    m.rough = 0.7;
  } else if (id == I_BULB) {
    m.alb = vec3(0.9, 0.8, 0.6);
    m.emisL = vec3(1.0, 0.75, 0.4) * 5.0;
  }
  return m;
}

/** The room round the lantern: a dim wall, a garland's lights out of focus behind, a lamp behind the viewer. */
vec3 env(vec3 d) {
  vec3 c = ROOM_WALL * (0.55 + 0.45 * smoothstep(-0.3, 0.5, d.y)) * uRoom;
  if (d.z < 0.0) {
    for (int l = uZero; l < 2; l++) {
      float sc = l == 0 ? 7.0 : 11.0;
      vec2 a = vec2(atan(d.x, -d.z), d.y) * sc + float(l) * 3.7;
      vec2 cell = floor(a);
      vec2 f = fract(a) - 0.5;
      float h = hash12(cell + float(l) * 17.0);
      if (h > 0.5) {
        vec2 o = (vec2(hash12(cell + 7.1), hash12(cell + 3.3)) - 0.5) * 0.45;
        float r = 0.14 + 0.16 * hash12(cell + 1.9);
        float disk = smoothstep(r, r * 0.8, length(f - o)) * (0.85 + 0.15 * smoothstep(r * 0.5, r, length(f - o)));
        vec3 bc = mix(BOKEH_A, BOKEH_B, step(0.7, hash12(cell + 5.5)));
        c += bc * disk * (0.25 + 0.6 * hash12(cell + 9.1)) * smoothstep(-0.2, 0.15, d.y) * (l == 0 ? 1.0 : 0.6) * uRoom;
      }
    }
  }
  c += vec3(1.0, 0.86, 0.7) * smoothstep(0.82, 0.96, dot(d, normalize(vec3(-0.5, 0.45, 0.75)))) * 1.6 * uRoom;
  return c;
}

vec2 march(vec3 ro, vec3 rd, float tmax, int steps) {
  float t = 0.0;
  for (int i = uZero; i < 220; i++) {
    if (i >= steps) break;
    vec2 h = mapM(ro + rd * t);
    if (h.x < 0.00035 + 0.0003 * t) return vec2(t, h.y);
    t += h.x * 0.85;
    if (t > tmax) break;
  }
  return vec2(t, -1.0);
}

/** The normal (four taps) and then the convexity (six: out along the normal and in, at three distances — positive on
 * edges and raised ornament, negative in crevices, 0 on flat faces), in one loop so the field is inlined once. */
vec4 normalAndCavity(vec3 p) {
  vec3 n = vec3(0.0);
  vec3 nn = vec3(0.0, 1.0, 0.0);
  float c = 0.0;
  for (int i = uZero; i < 10; i++) {
    vec3 e = vec3(0.0);
    float h = 0.0;
    float s = 0.0;
    vec3 q;
    if (i < 4) {
      e = 0.5773 * (2.0 * vec3(float(((i + 3) >> 1) & 1), float((i >> 1) & 1), float(i & 1)) - 1.0);
      q = p + 0.0005 * e;
    } else {
      if (i == 4) nn = normalize(n);
      int j = i - 4;
      h = 0.005 * float(1 << (j >> 1));
      s = (j & 1) == 0 ? 1.0 : -1.0;
      q = p + nn * h * s;
    }
    float d = mapM(q).x;
    if (i < 4) n += e * d;
    else c += (d - h * s) / h;
  }
  return vec4(nn, c * 0.5);
}

vec3 cosineDir(vec3 n) {
  float u = rnd(), v = rnd();
  float a = 2.0 * PI * u;
  float r = sqrt(v);
  vec3 t = normalize(abs(n.y) < 0.9 ? cross(n, vec3(0.0, 1.0, 0.0)) : cross(n, vec3(1.0, 0.0, 0.0)));
  vec3 b = cross(n, t);
  return normalize(t * cos(a) * r + b * sin(a) * r + n * sqrt(1.0 - v));
}

/** Diffuse plus a Blinn highlight for light from L. */
vec3 brdf(Mat m, vec3 n, vec3 v, vec3 L) {
  float ndl = max(dot(n, L), 0.0);
  vec3 h = normalize(L + v);
  float r4 = max(m.rough * m.rough * m.rough * m.rough, 1e-4);
  float sh = max(2.0 / r4 - 2.0, 1.0);
  vec3 f0 = mix(vec3(0.04), m.alb, m.metal);
  return (m.alb * (1.0 - m.metal) + f0 * pow(max(dot(n, h), 0.0), sh) * (sh + 8.0) / 8.0 * 0.25) * ndl;
}

vec2 boxHit(vec3 ro, vec3 rd, vec3 c, vec3 h) {
  vec3 m = 1.0 / rd;
  vec3 n = m * (ro - c);
  vec3 k = abs(m) * h;
  vec3 t1 = -n - k, t2 = -n + k;
  return vec2(max(max(t1.x, t1.y), t1.z), min(min(t2.x, t2.y), t2.z));
}
vec3 boxNormal(vec3 p, vec3 c, vec3 h) {
  vec3 q = (p - c) / h;
  vec3 a = abs(q);
  return a.x > a.y && a.x > a.z ? vec3(sign(q.x), 0.0, 0.0) : a.y > a.z ? vec3(0.0, sign(q.y), 0.0) : vec3(0.0, 0.0, sign(q.z));
}

void main() {
  rngState = (uint(gl_FragCoord.x) * 1973u + uint(gl_FragCoord.y) * 9277u + uint(uSample) * 26699u) | 1u;
  rnd();
  vec2 jit = vec2(rnd(), rnd()) - 0.5;
  vec2 uv = (gl_FragCoord.xy + jit) / uRes * 2.0 - 1.0;
  vec3 rd0 = normalize(uCamFwd + uv.x * (uRes.x / uRes.y) * uTanHalf * uCamRight + uv.y * uTanHalf * uCamUp);
  vec3 ro0 = uCamPos;

  vec3 cS = vec3(0.0), cL = vec3(0.0);
  vec3 P = ro0, N = vec3(0.0, 1.0, 0.0);
  Mat Mt = Mat(vec3(0.0), 1.0, 0.0, vec3(0.0), vec3(0.0));
  float tHit = FAR;
  bool hit = false;
  vec3 ro = ro0, rd = rd0;
  float tmax = FAR;
  int steps = 200;
  // One march call for every ray (the field is inlined once): 0 the camera's ray, 1 the key light's shadow ray, 2 the
  // lantern's light, 3 the model's third light, 4 a diffuse bounce, 5 a reflection.
  for (int k = uZero; k < 6; k++) {
    vec3 addS = vec3(0.0), addL = vec3(0.0);
    bool trace = true;
    if (k > 0) {
      if (!hit) break;
      ro = P + N * 0.0025;
      if (k == 1) {
        vec3 lp = KEY_POS + (vec3(rnd(), rnd(), rnd()) - 0.5) * 1.3;
        vec3 L = lp - ro;
        float dist = length(L);
        rd = L / dist;
        tmax = 6.0;
        steps = 90;
        addS = KEY_COL * uRoom * brdf(Mt, N, -rd0, rd);
        trace = dot(N, rd) > 0.0;
      } else if (k == 2) {
#if LANTERN_KIND == 0
        vec3 lp = LED_C + vec3((rnd() * 2.0 - 1.0) * LED_HALF.x, 0.0, (rnd() * 2.0 - 1.0) * LED_HALF.y);
        vec3 L = lp - ro;
        float dist = length(L);
        rd = L / dist;
        vec3 E = LED_RAD * max(rd.y, 0.0) * (4.0 * LED_HALF.x * LED_HALF.y) / max(dist * dist, 0.01);
        tmax = dist - 0.006;
#else
        int j = min(int(rnd() * 11.0), 10);
        vec3 lp = CANDLE_B[j] + vec3(0.0, 0.262, 0.0) + (vec3(rnd(), rnd(), rnd()) - 0.5) * 0.03;
        vec3 L = lp - ro;
        float dist = length(L);
        rd = L / dist;
        vec3 E = vec3(1.0, 0.62, 0.28) * CANDLE_POW * 11.0 / max(dist * dist, 0.002);
        tmax = dist - 0.05;
#endif
        steps = 90;
        addL = E * brdf(Mt, N, -rd0, rd);
        trace = dot(N, rd) > 0.0 && tmax > 0.0;
      } else if (k == 3) {
        vec3 lp, E;
        bool toL;
        trace = extraLight(ro, lp, E, toL);
        vec3 L = lp - ro;
        float dist = length(L);
        rd = L / max(dist, 1e-4);
        tmax = dist - 0.03;
        steps = 70;
        vec3 c = E * brdf(Mt, N, -rd0, rd);
        if (toL) addL = c; else addS = c;
        trace = trace && dot(N, rd) > 0.0 && tmax > 0.0;
      } else if (k == 4) {
        rd = cosineDir(N);
        tmax = 5.0;
        steps = 64;
        addS = Mt.alb * (1.0 - Mt.metal);
      } else {
        vec3 rr = reflect(rd0, N);
        vec3 jt = vec3(rnd(), rnd(), rnd()) - 0.5;
        rd = normalize(rr + jt * Mt.rough * Mt.rough * 1.2);
        if (dot(rd, N) < 0.0) rd = rr;
        float c = clamp(dot(N, -rd0), 0.0, 1.0);
        vec3 F = mix(vec3(0.04), Mt.alb, Mt.metal);
        F += (1.0 - F) * pow(1.0 - c, 5.0) * (1.0 - Mt.rough);
        addS = F * (Mt.metal > 0.0 ? 1.0 : (1.0 - Mt.rough * 0.8));
        tmax = 6.0;
        steps = 80;
        trace = max(addS.r, max(addS.g, addS.b)) > 0.03;
      }
    }
    if (!trace) continue;
    vec2 h = march(ro, rd, tmax, steps);
    if (k == 0) {
      if (h.y >= 0.0) {
        hit = true;
        tHit = h.x;
        P = ro + rd * h.x;
        vec4 nc = normalAndCavity(P);
        N = nc.xyz;
        Mt = material(int(h.y + 0.5), P, N, nc.w);
        cS += Mt.emis;
        cL += Mt.emisL;
      } else {
        cS += env(rd);
      }
    } else if (k <= 3) {
      if (h.y < 0.0) { cS += addS; cL += addL; }
    } else {
      vec3 sS = vec3(0.0), sL = vec3(0.0);
      if (h.y < 0.0) sS = env(rd);
      else {
        vec3 q = ro + rd * h.x;
        Mat m2 = material(int(h.y + 0.5), q, -rd, 0.0);
        sS = m2.emis + m2.alb * KEY_COL * uRoom * 0.3;
        sL = m2.emisL + m2.alb * LGUESS * step(sdBox(q - WATER_C, WATER_H), 0.01);
      }
      cS += addS * sS;
      cL += addS * sL;
    }
  }

  // The front glass and the water behind it.
  float mask = 0.0;
  vec2 tb = boxHit(ro0, rd0, WATER_C, WATER_H);
  if (tb.x < tb.y && tb.y > 0.0 && tb.x < tHit) {
    float tIn = max(tb.x, 0.0);
    float dw = max(min(tb.y, tHit) - tIn, 0.0);
    vec3 tr = exp(-dw * vec3(0.1, 0.045, 0.035));
    cS *= tr;
    cL *= tr;
    cL += HAZE_COL * (1.0 - exp(-dw * 0.9));
    vec3 ng = boxNormal(ro0 + rd0 * tIn, WATER_C, WATER_H);
    float c = clamp(dot(-rd0, ng), 0.0, 1.0);
    float F = 0.04 + 0.96 * pow(1.0 - c, 5.0);
    cS = cS * (1.0 - F) + env(reflect(rd0, ng)) * F * 1.5;
    cL *= 1.0 - F;
    mask = 1.0 - F;
  }
  // The table fades into the room far away.
  float fog = 1.0 - exp(-max(tHit - 6.0, 0.0) * 0.35);
  cS = mix(cS, env(rd0) * 0.6, fog);
  cL *= 1.0 - fog;
  o0 = vec4(min(cS, vec3(40.0)), 1.0);
  o1 = vec4(min(cL, vec3(40.0)), mask);
  o2 = vec4(tHit, 0.0, 0.0, 1.0);
}
`;

const GLITTER_VS = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec4 aP;
uniform vec3 uCamPos;
uniform vec3 uFwd;
uniform vec3 uRight;
uniform vec3 uUp;
uniform float uTanHalf;
uniform float uAspect;
uniform float uFocalPx;
uniform float uTime;
uniform float uSize;
uniform float uSnow;
uniform float uSparkle;
uniform float uLantern;
uniform float uRoom;
uniform vec3 uLight1;
uniform vec3 uKeyDir;
uniform vec3 uLightCol;
uniform int uPalette;
out vec3 vCol;
out float vDist;
float h1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
vec3 pal(float s, float tw) {
  if (uPalette == 0) return mix(vec3(0.82, 0.86, 0.95), vec3(1.0, 0.8, 0.45), step(0.85, h1(s * 17.3)));
  if (uPalette == 1) return mix(vec3(1.0, 0.72, 0.3), vec3(1.0, 0.9, 0.62), h1(s * 5.1));
  float h = fract(h1(s * 3.7) + tw * 0.6);
  return clamp(abs(fract(h + vec3(0.0, 0.667, 0.333)) * 6.0 - 3.0) - 1.0, 0.0, 1.0) * 0.8 + 0.2;
}
void main() {
  vec3 rel = aP.xyz - uCamPos;
  float z = max(dot(rel, uFwd), 0.05);
  gl_Position = vec4(dot(rel, uRight) / (uTanHalf * uAspect * z), dot(rel, uUp) / (uTanHalf * z), 0.0, 1.0);
  float s = aP.w;
  bool snow = h1(s * 3.1) < uSnow;
  float size = uSize * (snow ? 1.7 : 1.0) * (0.6 + 0.8 * h1(s * 7.7));
  float px = size * uFocalPx / z;
  float ps = max(px, 1.6);
  gl_PointSize = ps;
  float cover = min(1.0, (px * px) / (ps * ps));
  // A flake tumbles: its face turns with its own two rates.
  float a = s * 61.0 + uTime * (0.7 + 2.6 * h1(s * 5.3));
  float b = s * 23.0 + uTime * (0.4 + 1.8 * h1(s * 9.1));
  vec3 n = vec3(sin(a) * cos(b), cos(a), sin(a) * sin(b));
  vec3 V = normalize(-rel);
  vec3 L1 = normalize(uLight1 - aP.xyz);
  float g1 = pow(abs(dot(n, normalize(L1 + V))), 150.0);
  float g2 = pow(abs(dot(n, normalize(uKeyDir + V))), 150.0);
  float diff = abs(dot(n, L1)) * 0.6 + 0.25;
  vec3 col;
  if (snow) col = vec3(0.92, 0.94, 1.0) * (diff * 0.32 * uLantern * uLightCol + 0.05 * uRoom) + (g1 * uLantern * uLightCol + g2 * uRoom * 0.4) * 3.0 * uSparkle;
  else {
    vec3 base = pal(s, dot(n, V));
    col = base * (diff * 0.16 * uLantern * uLightCol + 0.03 * uRoom) + base * (g1 * uLantern * uLightCol + g2 * uRoom * 0.4 * vec3(1.0, 0.9, 0.8)) * 34.0 * uSparkle;
  }
  vCol = col * cover;
  vDist = length(rel);
}
`;

const GLITTER_FS = /* glsl */ `#version 300 es
precision highp float;
in vec3 vCol;
in float vDist;
uniform sampler2D uA0;
uniform sampler2D uA1;
uniform sampler2D uA2;
uniform vec2 uRes;
out vec4 o;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  vec2 uv = gl_FragCoord.xy / uRes;
  float cnt = texture(uA0, uv).a;
  if (cnt < 0.5) discard;
  float mask = texture(uA1, uv).a / cnt;
  float dep = texture(uA2, uv).r / cnt;
  float vis = mask * smoothstep(dep + 0.006, dep - 0.006, vDist);
  if (vis <= 0.001) discard;
  o = vec4(vCol * exp(-r2 * 2.2) * 1.6 * vis, 1.0);
}
`;

const COMPOSITE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uA0;
uniform sampler2D uA1;
uniform sampler2D uG;
uniform float uLantern;
uniform float uLight;
uniform int uView;
uniform vec2 uRes;
uniform vec4 uFlames[11];
uniform float uSway[11];
uniform int uNF;
out vec4 o;
/** An LED candle's flame: a teardrop (q in units of its half height, y up), a white core, an orange body, a halo. */
vec3 flame(vec2 q, float f, float sw) {
  q.x -= sw * max(q.y + 0.8, 0.0) * 0.18;
  float wid = 0.42 * (1.0 - 0.38 * clamp(q.y, -1.0, 1.4));
  float d = length(vec2(q.x / max(wid, 0.08), q.y * (q.y > 0.0 ? 0.8 : 1.5)));
  float core = exp(-d * d * 5.0);
  float body = exp(-d * d * 1.6);
  float halo = exp(-dot(q, q) * 0.22);
  return (vec3(1.0, 0.93, 0.75) * core * 4.0 + vec3(1.0, 0.55, 0.16) * body * 1.6 + vec3(1.0, 0.5, 0.2) * halo * 0.08) * f;
}
void main() {
  vec4 a = texture(uA0, vUv);
  vec3 c = a.a > 0.5 ? (a.rgb + texture(uA1, vUv).rgb * uLantern) / a.a : vec3(0.0);
  vec3 g = texture(uG, vUv).rgb;
  if (uView == 1) g = vec3(0.0);
  if (uView == 2) c *= 0.12;
  c += g;
  vec2 px = vUv * uRes;
  for (int i = 0; i < 11; i++) {
    if (i >= uNF) break;
    vec4 f = uFlames[i];
    vec2 q = (px - f.xy) / f.z;
    if (dot(q, q) < 80.0) c += flame(q, f.w, uSway[i]) * uLight;
  }
  o = vec4(c, 1.0);
}
`;

const FINAL_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uC;
uniform sampler2D uB;
uniform float uBloom;
uniform float uExposure;
out vec4 o;
${TONEMAP_GLSL}
void main() {
  vec3 c = texture(uC, vUv).rgb + texture(uB, vUv).rgb * uBloom;
  vec3 s = toSrgb(aces(c * uExposure));
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  o = vec4(s + (n - 0.5) / 255.0, 1.0);
}
`;

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const KEY_POS: V3 = [-2.2, 3.6, 3.2];

/** The pump's flow across the box: F(ξ) (the stream function's profile, ξ = −1…1) and U = −F′ (the vertical speed's
 * profile), tabulated, with the jets' and the downdraught's shapes for each pump layout; net flux across is zero. */
function flowTable(mode: number) {
  const N = 256;
  const g = (x: number, c: number, s: number) => Math.exp(-(((x - c) / s) ** 2));
  const sig = 0.17;
  const jet = (x: number) => (mode === 1 ? g(x, 0, sig) : mode === 2 ? g(x, -1, sig * 1.3) : g(x, -1, sig) + g(x, 1, sig));
  const down = (x: number) => (mode === 1 ? g(x, -1, 0.42) + g(x, 1, 0.42) : mode === 2 ? g(x, 0.2, 0.8) : g(x, 0, 0.6));
  let ij = 0;
  let id = 0;
  for (let i = 0; i <= N; i += 1) {
    const x = -1 + (2 * i) / N;
    const w = i === 0 || i === N ? 0.5 : 1;
    ij += jet(x) * w;
    id += down(x) * w;
  }
  const b = ij / id;
  const U = new Float32Array(N + 1);
  const F = new Float32Array(N + 1);
  let umax = 0;
  for (let i = 0; i <= N; i += 1) {
    const x = -1 + (2 * i) / N;
    U[i] = jet(x) - b * down(x);
    umax = Math.max(umax, U[i]);
  }
  for (let i = 1; i <= N; i += 1) F[i] = F[i - 1] - (U[i - 1] + U[i]) * 0.5 * (2 / N);
  const end = F[N];
  for (let i = 0; i <= N; i += 1) F[i] -= (end * i) / N;
  return { N, U, F, umax };
}

export function createSnowLantern(width: number, height: number, model: LanternModel, bakeIn: LanternBake) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const kit = createKit(canvas, 'snow-lantern', { preserveDrawingBuffer: false });
  if (!kit || !kit.hdr) {
    kit?.dispose();
    return null;
  }
  const gl = kit.gl;
  const ctx = gl;
  let bake = { ...bakeIn };

  // The bake's shader is big: compiled in the background where the browser can (asking its status early would block).
  const parallel = gl.getExtension('KHR_parallel_shader_compile');
  const bvs = gl.createShader(gl.VERTEX_SHADER)!;
  gl.shaderSource(bvs, FULL_VS);
  gl.compileShader(bvs);
  const bfs = gl.createShader(gl.FRAGMENT_SHADER)!;
  gl.shaderSource(bfs, BAKE_PRELUDE + model.glsl + BAKE_MAIN);
  gl.compileShader(bfs);
  const bakeProg = gl.createProgram()!;
  gl.attachShader(bakeProg, bvs);
  gl.attachShader(bakeProg, bfs);
  gl.linkProgram(bakeProg);
  const bakeLoc = new Map<string, WebGLUniformLocation | null>();
  const bu = (n: string) => {
    if (!bakeLoc.has(n)) bakeLoc.set(n, ctx.getUniformLocation(bakeProg, n));
    return bakeLoc.get(n)!;
  };

  const glitterProg = kit.program(GLITTER_VS, GLITTER_FS);
  const compProg = kit.program(FULL_VS, COMPOSITE_FS);
  const finalProg = kit.program(FULL_VS, FINAL_FS);
  const glitterT = kit.target(width, height);
  const compT = kit.target(width, height);
  const bloom = kit.bloom(width, height, 5);
  if (!glitterProg || !compProg || !finalProg || !glitterT || !compT || !bloom) {
    kit.dispose();
    return null;
  }
  // The three accumulators (sums of samples; colour, the lantern's light and the water's mask, depth).
  const acc = [kit.texture(width, height, true), kit.texture(width, height, true), kit.texture(width, height, true)];
  const accFbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, accFbo);
  acc.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0));
  gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]);
  const accOk = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (!accOk) {
    kit.dispose();
    return null;
  }
  const clearAcc = () => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, accFbo);
    for (let i = 0; i < 3; i += 1) gl.clearBufferfv(gl.COLOR, i, [0, 0, 0, 0]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };
  clearAcc();

  // The camera: framing the lantern whole, a little from above.
  const tanHalf = 0.36;
  const aspect = width / height;
  const focalPx = height / 2 / tanHalf;
  let camPos: V3 = [0, 0, 0];
  let fwd: V3 = [0, 0, -1];
  let right: V3 = [1, 0, 0];
  let up: V3 = [0, 1, 0];
  const setCamera = (zoom: number, yaw = 0, pitch = 0) => {
    const { target, w, h } = model.frame;
    const dist = (Math.max(h / 2 / tanHalf, w / 2 / (tanHalf * aspect)) * 1.08) / Math.max(zoom, 0.3);
    // A little from above; the camera control turns it round the lantern and tilts it.
    const el = Math.max(-0.15, Math.min(1.2, 0.15 + pitch));
    camPos = [target[0] + dist * Math.cos(el) * Math.sin(yaw), target[1] + dist * Math.sin(el), target[2] + dist * Math.cos(el) * Math.cos(yaw)];
    fwd = norm(sub(target, camPos));
    right = norm(cross(fwd, [0, 1, 0]));
    up = cross(right, fwd);
  };
  setCamera(bake.zoom, bake.yaw, bake.pitch);
  const project = (p: V3) => {
    const r = sub(p, camPos);
    const z = r[0] * fwd[0] + r[1] * fwd[1] + r[2] * fwd[2];
    const x = (r[0] * right[0] + r[1] * right[1] + r[2] * right[2]) / (tanHalf * aspect * z);
    const y = (r[0] * up[0] + r[1] * up[1] + r[2] * up[2]) / (tanHalf * z);
    return { x: (x * 0.5 + 0.5) * width, y: (y * 0.5 + 0.5) * height, z };
  };

  // Baking: band after band of rows, sample after sample.
  let sample = 0;
  let row = 0;
  let band = Math.max(8, Math.ceil(height / 10));
  let linked = false;
  let failed = '';
  const ready = () => {
    if (linked) return true;
    if (failed) return false;
    if (parallel && !gl.getProgramParameter(bakeProg, parallel.COMPLETION_STATUS_KHR)) return false;
    if (!gl.getProgramParameter(bakeProg, gl.LINK_STATUS)) {
      failed = (!gl.getShaderParameter(bfs, gl.COMPILE_STATUS) && gl.getShaderInfoLog(bfs)) || gl.getProgramInfoLog(bakeProg) || 'link';
      console.error('[snow-lantern] bake shader:', failed);
      return false;
    }
    linked = true;
    return true;
  };
  const bakeStep = (dt: number) => {
    if (sample >= bake.samples) return;
    // A frame's share: tuned by the frame time; when frames come rarely (a hidden tab, a test) a whole sample.
    if (dt < 0.2) {
      if (dt > 0.04) band = Math.max(4, Math.floor(band * 0.75));
      else if (dt < 0.022) band = Math.min(height, Math.ceil(band * 1.25));
    }
    let rows = dt >= 0.2 ? height : band;
    gl.useProgram(bakeProg);
    gl.uniform2f(bu('uRes'), width, height);
    gl.uniform1i(bu('uZero'), 0);
    gl.uniform3fv(bu('uCamPos'), camPos);
    gl.uniform3fv(bu('uCamFwd'), fwd);
    gl.uniform3fv(bu('uCamRight'), right);
    gl.uniform3fv(bu('uCamUp'), up);
    gl.uniform1f(bu('uTanHalf'), tanHalf);
    gl.uniform1f(bu('uRoom'), bake.room);
    gl.bindFramebuffer(gl.FRAMEBUFFER, accFbo);
    gl.viewport(0, 0, width, height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.enable(gl.SCISSOR_TEST);
    while (rows > 0 && sample < bake.samples) {
      const h = Math.min(rows, height - row);
      gl.uniform1i(bu('uSample'), sample);
      gl.scissor(0, row, width, h);
      kit.fullscreen();
      row += h;
      rows -= h;
      if (row >= height) {
        row = 0;
        sample += 1;
      }
    }
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.BLEND);
  };

  // The glitter.
  const MAXP = 26000;
  const pos = new Float32Array(MAXP * 3);
  const vel = new Float32Array(MAXP * 3);
  const seed = new Float32Array(MAXP);
  const sink = new Float32Array(MAXP);
  const gpu = new Float32Array(MAXP * 4);
  const fb: FlowBox = model.flow;
  const L = fb.y1 - fb.y0;
  const roofAt = (x: number) => (fb.gable ? fb.gable.wallY + (fb.gable.apexY - fb.gable.wallY) * (1 - Math.abs((x - fb.cx) / fb.hx)) : fb.y1);
  const place = (i: number) => {
    const x = fb.cx + (Math.random() * 2 - 1) * fb.hx * 0.95;
    pos[i * 3] = x;
    pos[i * 3 + 1] = fb.y0 + Math.random() * (Math.min(fb.y1, roofAt(x)) - fb.y0);
    pos[i * 3 + 2] = fb.cz + (Math.random() * 2 - 1) * fb.hz * 0.9;
    vel[i * 3] = vel[i * 3 + 1] = vel[i * 3 + 2] = 0;
    seed[i] = Math.random();
    sink[i] = 0.4 + 0.6 * Math.random();
  };
  for (let i = 0; i < MAXP; i += 1) place(i);
  const volume = 2 * fb.hx * L * 2 * fb.hz;
  const baseCount = 7000 * Math.min(1.2, Math.max(0.28, volume / 1.2));
  let count = 0;
  let table = flowTable(0);
  let tableMode = 0;
  // Curl noise: waves of a vector potential, their curls (k × e) precomputed.
  const waves = Array.from({ length: 4 }, (_, i) => {
    const k = norm([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]);
    const kk = (6 + 4 * Math.random()) / L;
    const e = norm(cross(k, norm([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5])));
    const c = cross(k, e);
    return { kx: k[0] * kk, ky: k[1] * kk, kz: k[2] * kk, cx: c[0] * kk, cy: c[1] * kk, cz: c[2] * kk, w: 0.35 + 0.4 * Math.random() + i * 0.1, ph: Math.random() * 6.28 };
  });
  let shake = 0;
  let clock = 0;
  let stirPrev: V3 | null = null;
  const pointerWorld = (px: number, py: number, cssW: number, cssH: number): V3 | null => {
    const nx = (px / cssW) * 2 - 1;
    const ny = 1 - (py / cssH) * 2;
    const d: V3 = [fwd[0] + nx * aspect * tanHalf * right[0] + ny * tanHalf * up[0], fwd[1] + nx * aspect * tanHalf * right[1] + ny * tanHalf * up[1], fwd[2] + nx * aspect * tanHalf * right[2] + ny * tanHalf * up[2]];
    if (Math.abs(d[2]) < 1e-4) return null;
    const t = (fb.cz - camPos[2]) / d[2];
    return t > 0 ? [camPos[0] + d[0] * t, camPos[1] + d[1] * t, fb.cz] : null;
  };

  const stepGlitter = (dt: number, look: LanternLook, stir: { at: V3; v: V3 } | null) => {
    const mode = Math.round(look.pumpMode);
    if (mode !== tableMode) {
      table = flowTable(mode);
      tableMode = mode;
    }
    const want = Math.min(MAXP, Math.round(baseCount * look.glitter));
    count = want;
    const { N, U, F, umax } = table;
    const jet = 0.6 * L * look.pump * (1 - 0.4 * shake);
    const S = (jet * fb.hx) / Math.max(umax, 1e-3);
    const turb = 0.05 * L * look.swirl * (1 + 4 * shake);
    const rot = 0.25 * look.swirl;
    const zr = (fb.hz / fb.hx) ** 2;
    const lag = 1 - Math.exp(-dt / 0.18);
    const sinkBase = look.settle * L * 0.045;
    const t = clock;
    const wv = waves.map((w) => ({ ...w, p: w.ph + w.w * t }));
    const m = 0.006;
    const x0 = fb.cx - fb.hx + m, x1 = fb.cx + fb.hx - m;
    const z0 = fb.cz - fb.hz + m, z1 = fb.cz + fb.hz - m;
    const y0 = fb.y0 + m;
    const sr = 0.22 * L;
    for (let i = 0; i < count; i += 1) {
      const j = i * 3;
      let x = pos[j], y = pos[j + 1], z = pos[j + 2];
      const xi = Math.min(1, Math.max(-1, (x - fb.cx) / fb.hx));
      const eta = Math.min(1, Math.max(0, (y - fb.y0) / L));
      const zeta = (z - fb.cz) / fb.hz;
      const fi = (xi + 1) * 0.5 * N;
      const i0 = Math.min(N - 1, Math.floor(fi));
      const fr = fi - i0;
      const Fv = F[i0] + (F[i0 + 1] - F[i0]) * fr;
      const Uv = U[i0] + (U[i0 + 1] - U[i0]) * fr;
      const e = 2 * eta - 1;
      const e2 = e * e;
      const e4 = e2 * e2;
      const G = 1 - e4 * e2;
      const Gp = -12 * e4 * e;
      const zf = 1 - 0.5 * zeta * zeta * zeta * zeta;
      let ux = ((S * Fv * Gp) / L) * zf;
      let uy = ((S * Uv * G) / fb.hx) * zf;
      // The pump itself: over its nozzle near the floor (where the stream function's flow stands still) it draws the
      // glitter in and lifts it into the jet.
      if (eta < 0.22) uy += (Math.max(Uv, 0) / umax) * jet * 1.3 * (1 - eta / 0.22) ** 2;
      const sw = rot * Math.sin(Math.PI * eta);
      ux += -sw * (z - fb.cz);
      let uz = sw * (x - fb.cx) * zr;
      for (let k = 0; k < 4; k += 1) {
        const w = wv[k];
        const c = Math.cos(w.kx * x + w.ky * y + w.kz * z + w.p) * turb / (w.kx * w.kx + w.ky * w.ky + w.kz * w.kz) ** 0.5;
        ux += w.cx * c;
        uy += w.cy * c;
        uz += w.cz * c;
      }
      if (stir) {
        const dx = x - stir.at[0], dy = y - stir.at[1], dz = (z - stir.at[2]) * 0.5;
        const d2 = (dx * dx + dy * dy + dz * dz) / (sr * sr);
        if (d2 < 1) {
          const f = (1 - d2) * (1 - d2);
          ux += stir.v[0] * f;
          uy += stir.v[1] * f;
          uz += stir.v[2] * f * 0.3;
        }
      }
      uy -= sinkBase * sink[i];
      let vx = vel[j], vy = vel[j + 1], vz = vel[j + 2];
      vx += (ux - vx) * lag;
      vy += (uy - vy) * lag;
      vz += (uz - vz) * lag;
      x += vx * dt;
      y += vy * dt;
      z += vz * dt;
      if (x < x0) { x = x0; vx = Math.abs(vx) * 0.3; }
      else if (x > x1) { x = x1; vx = -Math.abs(vx) * 0.3; }
      if (z < z0) { z = z0; vz = Math.abs(vz) * 0.3; }
      else if (z > z1) { z = z1; vz = -Math.abs(vz) * 0.3; }
      if (y < y0) { y = y0; vy = Math.max(vy, 0); }
      const top = roofAt(x) - m;
      if (y > top) { y = top; vy = Math.min(vy, 0); }
      pos[j] = x;
      pos[j + 1] = y;
      pos[j + 2] = z;
      vel[j] = vx;
      vel[j + 1] = vy;
      vel[j + 2] = vz;
    }
  };
  const shakeNow = () => {
    shake = 1;
    for (let i = 0; i < count; i += 1) {
      vel[i * 3] += (Math.random() * 2 - 1) * 0.6 * L;
      vel[i * 3 + 1] += (Math.random() * 2 - 0.6) * 0.6 * L;
      vel[i * 3 + 2] += (Math.random() * 2 - 1) * 0.3 * L;
    }
  };
  // Settle the glitter into its flow before the first frame.
  {
    const warmLook: LanternLook = { glitter: 1, size: 1, snow: 0.3, pump: 1, swirl: 1, settle: 1, sparkle: 1, light: 1, flicker: 1, bloom: 1, exposure: 1, pumpMode: 0, palette: 0, view: 0 };
    count = Math.min(MAXP, Math.round(baseCount * 2.5));
    for (let s = 0; s < 90; s += 1) {
      clock += 1 / 30;
      stepGlitter(1 / 30, warmLook, null);
    }
  }

  const vao = kit.track.vao(gl.createVertexArray()!);
  const vbo = kit.track.buffer(gl.createBuffer()!);
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, gpu.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  // The candles' flames: each flickers on its own.
  const flames = model.flames.map(() => ({ a: Math.random() * 10, b: Math.random() * 10, f: 1, sway: 0, dip: 0 }));
  const flameData = new Float32Array(11 * 4);
  const swayData = new Float32Array(11);
  const keyDir = norm(sub(KEY_POS, model.frame.target));

  return {
    canvas,
    /** 'compiling', 'failed: …', or how far the bake is (0…1). */
    status(): { compiling: boolean; failed: string; baked: number } {
      return { compiling: !linked && !failed, failed, baked: Math.min(1, (sample + row / height) / Math.max(1, bake.samples)) };
    },
    /** Bake again with other settings (only what changed: more samples just go on). */
    rebake(next: LanternBake) {
      const restart = next.room !== bake.room || next.zoom !== bake.zoom || (next.yaw ?? 0) !== (bake.yaw ?? 0) || (next.pitch ?? 0) !== (bake.pitch ?? 0) || next.samples < sample;
      bake = { ...next };
      if (restart) {
        setCamera(bake.zoom, bake.yaw, bake.pitch);
        clearAcc();
        sample = 0;
        row = 0;
      }
    },
    shake: shakeNow,
    frame(dt: number, look: LanternLook, ptr: LanternPointer, cssW: number, cssH: number) {
      if (gl.isContextLost() || !ready()) return;
      const sdt = Math.min(dt, 1 / 25);
      clock += sdt;
      shake = Math.max(0, shake - sdt * 0.5);
      // A drag stirs the water (its speed in the lantern's plane), a click shakes it.
      let stir: { at: V3; v: V3 } | null = null;
      if (ptr.pressed) {
        const w = pointerWorld(ptr.x, ptr.y, cssW, cssH);
        if (w && stirPrev && sdt > 0) {
          const v: V3 = [(w[0] - stirPrev[0]) / sdt, (w[1] - stirPrev[1]) / sdt, 0];
          const sp = Math.hypot(v[0], v[1]);
          const cap = 3 * L;
          if (sp > cap) {
            v[0] *= cap / sp;
            v[1] *= cap / sp;
          }
          stir = { at: w, v: [v[0] * 0.8, v[1] * 0.8, (Math.random() - 0.5) * sp * 0.2] };
        }
        stirPrev = w;
      } else stirPrev = null;
      if (ptr.clicked) shakeNow();
      stepGlitter(sdt, look, stir);
      bakeStep(dt);

      // Flicker: two waves and now and then a dip; the candles' baked light follows their mean.
      let mean = 1;
      if (flames.length) {
        let sum = 0;
        flames.forEach((f, i) => {
          f.a += sdt * (6 + (i % 3));
          f.b += sdt * (11 + (i % 4) * 1.3);
          if (Math.random() < sdt * 0.4) f.dip = 0.25 + 0.2 * Math.random();
          f.dip = Math.max(0, f.dip - sdt * 1.8);
          const raw = 1 + 0.09 * Math.sin(f.a) + 0.06 * Math.sin(f.b + Math.sin(f.a * 0.5)) - f.dip;
          f.f += (1 + (raw - 1) * look.flicker - f.f) * Math.min(1, sdt * 18);
          f.sway = (0.5 * Math.sin(f.a * 0.6) + 0.35 * Math.sin(f.b * 0.37)) * look.flicker;
          sum += f.f;
          const pr = project(model.flames[i]);
          flameData.set([pr.x, pr.y, (0.034 * focalPx) / pr.z, f.f], i * 4);
          swayData[i] = f.sway;
        });
        mean = sum / flames.length;
      }
      const lantern = look.light * mean;

      // The glitter into its own target (added up), hidden behind what is baked in front of it.
      for (let i = 0; i < count; i += 1) {
        gpu[i * 4] = pos[i * 3];
        gpu[i * 4 + 1] = pos[i * 3 + 1];
        gpu[i * 4 + 2] = pos[i * 3 + 2];
        gpu[i * 4 + 3] = seed[i];
      }
      kit.into(glitterT);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (count > 0 && look.view !== 1) {
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, gpu, 0, count * 4);
        gl.useProgram(glitterProg.p);
        const u = glitterProg.u;
        gl.uniform3fv(u('uCamPos'), camPos);
        gl.uniform3fv(u('uFwd'), fwd);
        gl.uniform3fv(u('uRight'), right);
        gl.uniform3fv(u('uUp'), up);
        gl.uniform1f(u('uTanHalf'), tanHalf);
        gl.uniform1f(u('uAspect'), aspect);
        gl.uniform1f(u('uFocalPx'), focalPx);
        gl.uniform1f(u('uTime'), clock);
        gl.uniform1f(u('uSize'), 0.0085 * look.size);
        gl.uniform1f(u('uSnow'), look.snow);
        gl.uniform1f(u('uSparkle'), look.sparkle);
        gl.uniform1f(u('uLantern'), lantern);
        gl.uniform1f(u('uRoom'), bake.room);
        gl.uniform3fv(u('uLight1'), model.glint);
        gl.uniform3fv(u('uKeyDir'), keyDir);
        gl.uniform3fv(u('uLightCol'), model.lightCol);
        gl.uniform1i(u('uPalette'), Math.round(look.palette));
        gl.uniform2f(u('uRes'), width, height);
        kit.bind(0, acc[0], u('uA0'));
        kit.bind(1, acc[1], u('uA1'));
        kit.bind(2, acc[2], u('uA2'));
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.POINTS, 0, count);
        gl.bindVertexArray(null);
        gl.disable(gl.BLEND);
      }

      kit.into(compT);
      gl.useProgram(compProg.p);
      const cu = compProg.u;
      kit.bind(0, acc[0], cu('uA0'));
      kit.bind(1, acc[1], cu('uA1'));
      kit.bind(2, glitterT.tex, cu('uG'));
      gl.uniform1f(cu('uLantern'), lantern);
      gl.uniform1f(cu('uLight'), look.light);
      gl.uniform1i(cu('uView'), Math.round(look.view));
      gl.uniform2f(cu('uRes'), width, height);
      gl.uniform4fv(cu('uFlames'), flameData);
      gl.uniform1fv(cu('uSway'), swayData);
      gl.uniform1i(cu('uNF'), flames.length);
      kit.fullscreen();

      const bl: Target = bloom.run(compT);
      kit.into(null);
      gl.useProgram(finalProg.p);
      kit.bind(0, compT.tex, finalProg.u('uC'));
      kit.bind(1, bl.tex, finalProg.u('uB'));
      gl.uniform1f(finalProg.u('uBloom'), 0.05 * look.bloom);
      gl.uniform1f(finalProg.u('uExposure'), look.exposure);
      kit.fullscreen();
    },
    dispose() {
      if (!gl.isContextLost()) {
        gl.deleteProgram(bakeProg);
        gl.deleteShader(bvs);
        gl.deleteShader(bfs);
        gl.deleteFramebuffer(accFbo);
      }
      kit.dispose();
    },
  };
}

export type SnowLantern = NonNullable<ReturnType<typeof createSnowLantern>>;
