import { FULL_VS, TONEMAP_GLSL, createKit, type Target } from './glKit';

/**
 * WebGL2 renderer of the nixie clock (nixieClock.ts): a real 3D scene in centimetres — a varnished wooden base on a
 * table in front of a panelled wall, six glass tubes with their anode mesh, stacked wire digits and wired stems —
 * seen by a camera that can orbit it freely.
 *
 * The light is path traced into light maps: the irradiance on the table, the wall and every face of the base, stored
 * in a texture atlas (so it holds for any camera). Each sample does next-event estimation towards a random point of
 * a source (soft shadows; the other tubes' meshes let part of the light through, the base blocks it) and 0–2
 * cosine-weighted diffuse bounces (the orange of the lit wood on the table, the glow off the mesh). Two ways to run:
 *  - baked: one light map per source — the room (0) and each tube's glow (1…6, a glowing volume inside its mesh) —
 *    accumulated progressively up to a sample count and then left alone; a digit change only re-weights its tube's
 *    map (an 8 lights the room more than a 1);
 *  - live: a single light map traced every frame from the light actually emitted — random points on the wires of the
 *    digits lit right now (and the fading one) — blended over the previous frames, so the light follows the digits'
 *    shapes as they change.
 * Colours (wood grain, the table, the wall) are applied per pixel on top of the light maps, and the view-dependent part
 * is computed every frame: the tubes mirrored in the varnish and the table, the room reflected in the glass. Then,
 * through each tube's glass, the copper mesh and the ten digits one behind another — the lit one a white-hot wire in an
 * orange sheath of glowing gas, the others thin wires catching its light — from a distance-field atlas. A bloom pyramid
 * and ACES tone mapping finish the picture.
 */

export const NIXIE_STACK = [1, 6, 2, 7, 5, 0, 4, 9, 8, 3];
/** Glyph box of the digit atlas, in glyph units (a digit is 0.62 wide, 1 tall): x0, y0, width, height. */
export const GLYPH_BOX = [-0.12, -0.12, 0.86, 1.24] as const;
export const GLYPH_DMAX = 0.25;
export const ATLAS_W = 64;
export const ATLAS_H = 92;
/** Points sampled along each digit's wire, for the live light: this many per digit. */
export const DIGIT_POINTS = 64;
const MAPS = 7;

const COMMON = `
precision highp float;
precision highp int;
uniform vec3 uCam;
uniform vec3 uFwd;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec2 uHalf;
uniform vec2 uShift;
uniform float uTubeX[8];
uniform int uTubes;
uniform vec4 uBaseBox;

const float BASE_H = 3.0;
const float RG = 1.05;
const float GLASS_TOP = 7.3;
const float MX = 0.78;
const float MZ = 0.66;
const float MY0 = 4.0;
const float MY1 = 6.95;
const float STEM_Y1 = 3.85;
const float WALL_Z = -40.0;
const float DS = 2.0;
const float DY0 = 4.45;
const vec3 GLOW = vec3(1.0, 0.36, 0.09);
const vec3 CORE = vec3(1.0, 0.7, 0.38);
const int STACK[10] = int[10](1, 6, 2, 7, 5, 0, 4, 9, 8, 3);
const int STACK_POS[10] = int[10](5, 0, 2, 9, 6, 4, 1, 3, 8, 7);

// The light-map atlas: where each surface lives in it (x0, y0, width, height) and the world extent it covers.
const vec4 R_TABLE = vec4(0.0, 0.0, 0.75, 0.75);
const vec4 R_WALL = vec4(0.75, 0.0, 0.25, 0.25);
const vec4 R_LEFT = vec4(0.75, 0.25, 0.125, 0.0625);
const vec4 R_RIGHT = vec4(0.875, 0.25, 0.125, 0.0625);
const vec4 R_TOP = vec4(0.0, 0.75, 1.0, 0.125);
const vec4 R_FRONT = vec4(0.0, 0.875, 1.0, 0.0625);
const vec4 R_BACK = vec4(0.0, 0.9375, 1.0, 0.0625);
const vec2 TABLE_X = vec2(-45.0, 45.0);
const vec2 TABLE_Z = vec2(-40.0, 40.0);
const vec2 WALL_X = vec2(-80.0, 80.0);
const vec2 WALL_Y = vec2(0.0, 80.0);

struct Hit { float t; vec3 n; int m; int id; };

vec3 safeInv(vec3 d) { return 1.0 / (d + sign(d) * 1e-7 + vec3(equal(d, vec3(0.0))) * 1e-7); }

void boxHit(vec3 ro, vec3 inv, vec3 rd, vec3 bmin, vec3 bmax, inout Hit h, int m, int id) {
  vec3 t0 = (bmin - ro) * inv;
  vec3 t1 = (bmax - ro) * inv;
  vec3 tmin = min(t0, t1);
  vec3 tmax = max(t0, t1);
  float tn = max(max(tmin.x, tmin.y), tmin.z);
  float tf = min(min(tmax.x, tmax.y), tmax.z);
  if (tn > 1e-3 && tn < tf && tn < h.t) {
    h.t = tn;
    h.m = m;
    h.id = id;
    h.n = tn == tmin.x ? vec3(-sign(rd.x), 0.0, 0.0) : tn == tmin.y ? vec3(0.0, -sign(rd.y), 0.0) : vec3(0.0, 0.0, -sign(rd.z));
  }
}
bool boxCross(vec3 ro, vec3 inv, vec3 bmin, vec3 bmax, float tMax) {
  vec3 t0 = (bmin - ro) * inv;
  vec3 t1 = (bmax - ro) * inv;
  vec3 tmin = min(t0, t1);
  vec3 tmax = max(t0, t1);
  float tn = max(max(tmin.x, tmin.y), tmin.z);
  float tf = min(min(tmax.x, tmax.y), tmax.z);
  return tf > max(tn, 1e-3) && tn < tMax;
}
bool baseBlocks(vec3 p, vec3 d, float L) {
  return boxCross(p, safeInv(d), vec3(uBaseBox.x, 0.0, uBaseBox.z), vec3(uBaseBox.y, BASE_H, uBaseBox.w), L);
}

/** Everything opaque: the table (1), the wall (2), the base (3), and inside each tube the mesh's back and sides (4),
 * its stem (5) and its front (6, which only bounced light sees). */
Hit scene(vec3 ro, vec3 rd) {
  Hit h;
  h.t = 1e9;
  h.m = 0;
  h.id = -1;
  h.n = vec3(0.0);
  if (rd.y < 0.0) {
    float t = -ro.y / rd.y;
    if (t > 1e-3 && t < h.t) { h.t = t; h.n = vec3(0.0, 1.0, 0.0); h.m = 1; }
  }
  if (rd.z < 0.0 && ro.z > WALL_Z) {
    float t = (WALL_Z - ro.z) / rd.z;
    if (t > 1e-3 && t < h.t) { h.t = t; h.n = vec3(0.0, 0.0, 1.0); h.m = 2; }
  }
  vec3 inv = safeInv(rd);
  boxHit(ro, inv, rd, vec3(uBaseBox.x, 0.0, uBaseBox.z), vec3(uBaseBox.y, BASE_H, uBaseBox.w), h, 3, -1);
  for (int i = 0; i < 8; i++) {
    if (i >= uTubes) break;
    float x = uTubeX[i];
    boxHit(ro, inv, rd, vec3(x - MX, MY0, -MZ), vec3(x + MX, MY1, -MZ + 0.04), h, 4, i);
    boxHit(ro, inv, rd, vec3(x - MX, MY0, MZ - 0.04), vec3(x + MX, MY1, MZ), h, 6, i);
    boxHit(ro, inv, rd, vec3(x - MX, MY0, -MZ), vec3(x - MX + 0.03, MY1, MZ), h, 4, i);
    boxHit(ro, inv, rd, vec3(x + MX - 0.03, MY0, -MZ), vec3(x + MX, MY1, MZ), h, 4, i);
    boxHit(ro, inv, rd, vec3(x - 0.85, BASE_H, -0.85), vec3(x + 0.85, STEM_Y1, 0.85), h, 5, i);
  }
  return h;
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
/** Wood: slow wavy growth rings along the board, fine pores across. */
float grain(vec2 p) {
  float n = vnoise(vec2(p.x * 0.3, p.y * 7.0)) * 0.7 + vnoise(vec2(p.x * 1.4, p.y * 26.0)) * 0.3;
  float rings = sin(p.y * 11.0 + n * 7.0 + p.x * 0.05);
  return clamp(0.55 + rings * 0.22 + (n - 0.5) * 0.5, 0.0, 1.0);
}
float meshGrid(vec2 g) {
  vec2 f = abs(fract(g / 0.13) - 0.5);
  return max(smoothstep(0.36, 0.46, f.x), smoothstep(0.36, 0.46, f.y));
}

/** Colour (linear) and varnish strength of what was hit. */
void material(Hit h, vec3 p, out vec3 alb, out float spec) {
  spec = 0.0;
  if (h.m == 1) {
    alb = mix(vec3(0.03, 0.016, 0.008), vec3(0.075, 0.04, 0.02), grain(vec2(p.x * 0.6, p.z * 0.5)));
    spec = 0.45;
  } else if (h.m == 2) {
    float plank = smoothstep(0.02, 0.0, abs(fract(p.y / 9.0) - 0.5) - 0.48);
    alb = mix(vec3(0.02, 0.014, 0.01), vec3(0.045, 0.03, 0.02), grain(vec2(p.x * 0.4, p.y * 0.3))) * (1.0 - plank * 0.6);
    spec = 0.05;
  } else if (h.m == 3) {
    vec2 q = abs(h.n.z) > 0.5 ? vec2(p.x, p.y) : abs(h.n.y) > 0.5 ? vec2(p.x, p.z) : vec2(p.z, p.y);
    alb = mix(vec3(0.16, 0.045, 0.012), vec3(0.36, 0.11, 0.035), grain(q));
    spec = 0.55;
    if (h.n.y > 0.5) {
      // The holes the tubes stand in: a dark gap round each.
      for (int i = 0; i < 8; i++) {
        if (i >= uTubes) break;
        float r = length(p.xz - vec2(uTubeX[i], 0.0));
        alb *= 1.0 - 0.85 * smoothstep(0.2, 0.05, abs(r - RG - 0.08));
      }
    }
  } else if (h.m == 4 || h.m == 6) {
    alb = vec3(0.1, 0.05, 0.03) * (0.45 + 0.55 * (1.0 - meshGrid(p.xy)));
    spec = 0.25;
  } else {
    float wires = smoothstep(0.4, 0.5, abs(fract((p.x + p.z) * 3.3) - 0.5));
    alb = mix(vec3(0.05, 0.045, 0.04), vec3(0.2, 0.18, 0.16), wires);
    spec = 0.35;
  }
}

vec3 viewRay(vec2 ndc) {
  return normalize(uFwd + (ndc.x - uShift.x) * uHalf.x * uRight + (ndc.y - uShift.y) * uHalf.y * uUp);
}

/** A point of the light map in the atlas → the world (with its normal); false where the atlas is unused. */
bool atlasPoint(vec2 uv, out vec3 p, out vec3 n) {
  vec2 bx = uBaseBox.xy;
  vec2 bz = uBaseBox.zw;
  vec2 f;
  p = vec3(0.0);
  n = vec3(0.0, 1.0, 0.0);
  if (uv.y < 0.75 && uv.x < 0.75) {
    f = (uv - R_TABLE.xy) / R_TABLE.zw;
    p = vec3(mix(TABLE_X.x, TABLE_X.y, f.x), 0.0, mix(TABLE_Z.x, TABLE_Z.y, f.y));
    return true;
  }
  if (uv.x >= 0.75 && uv.y < 0.25) {
    f = (uv - R_WALL.xy) / R_WALL.zw;
    p = vec3(mix(WALL_X.x, WALL_X.y, f.x), mix(WALL_Y.x, WALL_Y.y, f.y), WALL_Z);
    n = vec3(0.0, 0.0, 1.0);
    return true;
  }
  if (uv.x >= 0.75 && uv.y >= 0.25 && uv.y < 0.3125) {
    bool left = uv.x < 0.875;
    vec4 r = left ? R_LEFT : R_RIGHT;
    f = (uv - r.xy) / r.zw;
    p = vec3(left ? bx.x : bx.y, f.y * BASE_H, mix(bz.x, bz.y, f.x));
    n = vec3(left ? -1.0 : 1.0, 0.0, 0.0);
    return true;
  }
  if (uv.y >= 0.75) {
    if (uv.y < 0.875) {
      f = (uv - R_TOP.xy) / R_TOP.zw;
      p = vec3(mix(bx.x, bx.y, f.x), BASE_H, mix(bz.x, bz.y, f.y));
    } else if (uv.y < 0.9375) {
      f = (uv - R_FRONT.xy) / R_FRONT.zw;
      p = vec3(mix(bx.x, bx.y, f.x), f.y * BASE_H, bz.y);
      n = vec3(0.0, 0.0, 1.0);
    } else {
      f = (uv - R_BACK.xy) / R_BACK.zw;
      p = vec3(mix(bx.x, bx.y, f.x), f.y * BASE_H, bz.x);
      n = vec3(0.0, 0.0, -1.0);
    }
    return true;
  }
  return false;
}
/** The other way: a point on a light-mapped surface → its place in the atlas. */
vec2 atlasUV(int m, vec3 p, vec3 n) {
  vec2 bx = uBaseBox.xy;
  vec2 bz = uBaseBox.zw;
  if (m == 1) return R_TABLE.xy + R_TABLE.zw * clamp(vec2((p.x - TABLE_X.x) / (TABLE_X.y - TABLE_X.x), (p.z - TABLE_Z.x) / (TABLE_Z.y - TABLE_Z.x)), 0.0, 1.0);
  if (m == 2) return R_WALL.xy + R_WALL.zw * clamp(vec2((p.x - WALL_X.x) / (WALL_X.y - WALL_X.x), (p.y - WALL_Y.x) / (WALL_Y.y - WALL_Y.x)), 0.0, 1.0);
  float fx = clamp((p.x - bx.x) / (bx.y - bx.x), 0.0, 1.0);
  float fz = clamp((p.z - bz.x) / (bz.y - bz.x), 0.0, 1.0);
  float fy = clamp(p.y / BASE_H, 0.0, 1.0);
  if (n.y > 0.5) return R_TOP.xy + R_TOP.zw * vec2(fx, fz);
  if (n.z > 0.5) return R_FRONT.xy + R_FRONT.zw * vec2(fx, fy);
  if (n.z < -0.5) return R_BACK.xy + R_BACK.zw * vec2(fx, fy);
  if (n.x < -0.5) return R_LEFT.xy + R_LEFT.zw * vec2(fz, fy);
  return R_RIGHT.xy + R_RIGHT.zw * vec2(fz, fy);
}
`;

const TRACE_FS = `#version 300 es
${COMMON}
uniform int uLayer;
uniform int uLive;
uniform int uBounces;
uniform float uSeed;
uniform vec2 uAtlas;
uniform float uStore;
uniform sampler2D uPoints;
uniform int uDigitL[8];
uniform int uPrevL[8];
uniform float uWL[8];
uniform float uPrevWL[8];
uniform float uRoomL;
out vec4 o;

uint state;
float rnd() {
  state = state * 747796405u + 2891336453u;
  uint w = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  w = (w >> 22u) ^ w;
  return float(w) / 4294967296.0;
}
vec3 cosineDir(vec3 n) {
  float u1 = rnd();
  float u2 = rnd();
  float r = sqrt(u1);
  float phi = 6.2831853 * u2;
  vec3 t = normalize(abs(n.y) < 0.99 ? cross(n, vec3(0.0, 1.0, 0.0)) : cross(n, vec3(1.0, 0.0, 0.0)));
  vec3 b = cross(n, t);
  return normalize(t * r * cos(phi) + b * r * sin(phi) + n * sqrt(max(0.0, 1.0 - u1)));
}

/** How much of a light sample at q reaches p: the base and the stems block it, meshes let part of it through. */
float visibility(vec3 p, vec3 q, int own) {
  vec3 d = q - p;
  float L = length(d);
  vec3 rd = d / L;
  vec3 inv = safeInv(rd);
  if (boxCross(p, inv, vec3(uBaseBox.x, 0.0, uBaseBox.z), vec3(uBaseBox.y, BASE_H, uBaseBox.w), L)) return 0.0;
  float T = 1.0;
  for (int i = 0; i < 8; i++) {
    if (i >= uTubes) break;
    float x = uTubeX[i];
    if (boxCross(p, inv, vec3(x - 0.85, BASE_H, -0.85), vec3(x + 0.85, STEM_Y1, 0.85), L)) return 0.0;
    if (boxCross(p, inv, vec3(x - MX, MY0, -MZ), vec3(x + MX, MY1, MZ), L)) T *= i == own ? 0.62 : 0.4;
  }
  return T;
}

/** Irradiance at p from one light sample. Baked: from this map's source. Live: from a source picked in proportion to
 * how brightly it shines right now — a random point on the wire of a lit digit, or the room. */
vec3 directE(vec3 p, vec3 n) {
  int layer = uLayer;
  int digit = -1;
  float scale = 1.0;
  if (uLive == 1) {
    float room = uRoomL * 0.6;
    float total = room;
    for (int i = 0; i < 8; i++) {
      if (i >= uTubes) break;
      total += uWL[i] + uPrevWL[i];
    }
    if (total <= 0.0) return vec3(0.0);
    float r = rnd() * total;
    if (r < room) {
      layer = 0;
      scale = total / 0.6;
    } else {
      r -= room;
      scale = total;
      layer = -1;
      for (int i = 0; i < 8; i++) {
        if (i >= uTubes) break;
        if (r < uWL[i]) { layer = i + 1; digit = uDigitL[i]; break; }
        r -= uWL[i];
        if (r < uPrevWL[i]) { layer = i + 1; digit = uPrevL[i]; break; }
        r -= uPrevWL[i];
      }
      if (layer < 0) return vec3(0.0);
    }
  }
  vec3 q;
  vec3 I;
  int own = -1;
  if (layer == 0) {
    // The room: a soft window high to the left, in front of the clock.
    q = vec3(-40.0, 45.0, 35.0) + (vec3(rnd(), rnd(), rnd()) - 0.5) * 22.0;
    I = vec3(0.85, 0.92, 1.05) * 3000.0;
  } else {
    int i = layer - 1;
    if (digit >= 0) {
      vec2 g = texelFetch(uPoints, ivec2(min(int(rnd() * ${DIGIT_POINTS}.0), ${DIGIT_POINTS - 1}), digit), 0).xy;
      q = vec3(uTubeX[i] + (g.x - 0.31) * DS, DY0 + g.y * DS, 0.27 - float(STACK_POS[digit]) * 0.06);
    } else {
      q = vec3(uTubeX[i] + (rnd() - 0.5) * 1.0, DY0 + rnd() * DS, (rnd() - 0.5) * 0.5);
    }
    I = GLOW * 55.0;
    own = i;
  }
  vec3 d = q - p;
  float d2 = max(dot(d, d), 0.04);
  vec3 l = d * inversesqrt(d2);
  float cosP = dot(n, l);
  if (cosP <= 0.0) return vec3(0.0);
  float vis = visibility(p, q, own);
  return I * cosP / d2 * vis * scale;
}

vec3 sky() { return vec3(0.012, 0.013, 0.017) * (uLive == 1 ? uRoomL : (uLayer == 0 ? 1.0 : 0.0)); }

void main() {
  state = uint(gl_FragCoord.x) * 1973u + uint(gl_FragCoord.y) * 9277u + uint(uSeed) * 26699u + 1u;
  vec2 uv = (gl_FragCoord.xy + vec2(rnd(), rnd()) - 0.5) / uAtlas;
  vec3 p;
  vec3 n;
  if (!atlasPoint(uv, p, n)) { o = vec4(0.0); return; }
  p += n * 2e-3;
  vec3 E = directE(p, n);
  if (uBounces > 0) {
    vec3 d = cosineDir(n);
    Hit h = scene(p, d);
    if (h.m != 0) {
      vec3 p2 = p + d * h.t + h.n * 2e-3;
      vec3 a2;
      float s2;
      material(h, p2, a2, s2);
      vec3 E2 = directE(p2, h.n);
      if (uBounces > 1) {
        vec3 d2 = cosineDir(h.n);
        Hit h3 = scene(p2, d2);
        if (h3.m != 0) {
          vec3 p3 = p2 + d2 * h3.t + h3.n * 2e-3;
          vec3 a3;
          float s3;
          material(h3, p3, a3, s3);
          E2 += a3 * directE(p3, h3.n);
        } else {
          E2 += 3.14159 * sky();
        }
      }
      E += a2 * E2;
    } else {
      E += 3.14159 * sky();
    }
  }
  o = vec4(E * uStore, 1.0);
}`;

const COMPOSE_FS = `#version 300 es
${COMMON}
uniform vec2 uRes;
uniform sampler2D uL0;
uniform sampler2D uL1;
uniform sampler2D uL2;
uniform sampler2D uL3;
uniform sampler2D uL4;
uniform sampler2D uL5;
uniform sampler2D uL6;
uniform sampler2D uLiveMap;
uniform int uLiveOn;
uniform float uLiveScale;
uniform float uW[7];
uniform float uBlur;
uniform vec2 uAtlasTexel;
uniform mediump sampler2DArray uDigits;
uniform int uDigit[8];
uniform int uPrev[8];
uniform float uOn[8];
uniform float uPrevOn[8];
uniform float uTubeW[8];
uniform float uRoom;
uniform float uGloss;
uniform float uRough;
uniform float uGlassK;
uniform float uLightOnly;
out vec4 o;

vec3 maps(vec2 uv) {
  if (uLiveOn == 1) return texture(uLiveMap, uv).rgb * uLiveScale;
  return uW[0] * texture(uL0, uv).rgb + uW[1] * texture(uL1, uv).rgb + uW[2] * texture(uL2, uv).rgb + uW[3] * texture(uL3, uv).rgb
    + uW[4] * texture(uL4, uv).rgb + uW[5] * texture(uL5, uv).rgb + uW[6] * texture(uL6, uv).rgb;
}
/** Light from the maps, softened while they are still young and noisy. */
vec3 irradiance(vec2 uv) {
  vec3 c = maps(uv);
  if (uBlur > 0.0) {
    vec2 d = uAtlasTexel * uBlur;
    vec3 s = maps(uv + vec2(d.x, 0.0)) + maps(uv - vec2(d.x, 0.0)) + maps(uv + vec2(0.0, d.y)) + maps(uv - vec2(0.0, d.y));
    c = mix(c, (c + s) / 5.0, min(1.0, uBlur));
  }
  return c;
}

/** The room reflected: dark, with a tall soft window to the upper left, in front. */
vec3 env(vec3 r) {
  vec3 c = vec3(0.01, 0.01, 0.013) * uRoom;
  float win = smoothstep(0.08, 0.0, abs(r.x + 0.55) - 0.16) * smoothstep(-0.1, 0.25, r.y) * smoothstep(-0.2, 0.3, r.z);
  c += vec3(0.55, 0.6, 0.68) * win * uRoom;
  return c;
}

/** Varnish: the room and the glowing tubes mirrored, blurred by the roughness, hidden where the base is in the way. */
vec3 specular(vec3 p, vec3 n, vec3 v, float ks, float shin) {
  vec3 r = reflect(-v, n);
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  vec3 s = baseBlocks(p + n * 2e-3, r, 1e3) ? vec3(0.0) : env(r);
  for (int i = 0; i < 8; i++) {
    if (i >= uTubes) break;
    vec3 c = vec3(uTubeX[i], DY0 + DS * 0.5, 0.0);
    vec3 d = c - p;
    float L = length(d);
    vec3 l = d / L;
    float a = max(acos(clamp(dot(r, l), -1.0, 1.0)) - 0.8 / L, 0.0);
    float lobe = pow(cos(min(a, 1.5)), shin) * (shin + 2.0) / 6.2832;
    if (lobe < 1e-4) continue;
    if (baseBlocks(p + n * 2e-3, l, L)) continue;
    s += GLOW * uTubeW[i] * min(lobe * 55.0 / (L * L), 30.0);
  }
  return s * ks * fres;
}

vec3 surface(Hit h, vec3 p, vec3 v) {
  vec3 alb;
  float ks;
  material(h, p, alb, ks);
  vec3 base = uLightOnly > 0.5 ? vec3(0.45) : alb;
  if (h.m <= 3) {
    vec3 E = irradiance(atlasUV(h.m, p, h.n));
    vec3 col = base / 3.14159 * E;
    if (uLightOnly < 0.5 && ks > 0.0) {
      float shin = h.m == 1 ? mix(220.0, 8.0, uRough) : mix(520.0, 14.0, uRough);
      col += specular(p, h.n, v, ks * uGloss, shin);
    }
    // The table fades into the dark far away.
    if (h.m == 1) col *= smoothstep(80.0, 30.0, length(p.xz));
    return col;
  }
  // Inside a tube: lit mostly by its own glow.
  int i = h.id;
  vec3 c = vec3(uTubeX[i], DY0 + DS * 0.5, 0.0);
  vec3 d = c - p;
  float d2 = dot(d, d) + 0.25;
  float cosL = max(dot(h.n, d * inversesqrt(d2)), 0.0);
  vec3 E = uTubeW[i] * GLOW * 55.0 * cosL / d2 + uRoom * vec3(0.3);
  return base / 3.14159 * E;
}

float glassHit(vec3 ro, vec3 rd, float x, out vec3 n) {
  float best = 1e9;
  n = vec3(0.0, 0.0, 1.0);
  vec2 oc = ro.xz - vec2(x, 0.0);
  vec2 d = rd.xz;
  float a = dot(d, d);
  float b = dot(oc, d);
  float c = dot(oc, oc) - RG * RG;
  float disc = b * b - a * c;
  if (disc > 0.0 && a > 1e-8) {
    float t = (-b - sqrt(disc)) / a;
    float y = ro.y + rd.y * t;
    if (t > 0.0 && y > BASE_H && y < GLASS_TOP) {
      best = t;
      vec2 q = oc + d * t;
      n = normalize(vec3(q.x, 0.0, q.y));
    }
  }
  vec3 cs = vec3(x, GLASS_TOP, 0.0);
  vec3 oc3 = ro - cs;
  float b3 = dot(oc3, rd);
  float c3 = dot(oc3, oc3) - RG * RG;
  float disc3 = b3 * b3 - c3;
  if (disc3 > 0.0) {
    float t = -b3 - sqrt(disc3);
    vec3 p = ro + rd * t;
    if (t > 0.0 && t < best && p.y >= GLASS_TOP) {
      best = t;
      n = normalize(p - cs);
    }
  }
  return best;
}

/** Inside tube i, near to far: the mesh, the ten digits, then what is behind them. Works from any side: the digit
 * planes are taken in the order the ray meets them. */
vec3 interior(int i, vec3 ro, vec3 rd, float tBack, vec3 behind) {
  float x = uTubeX[i];
  vec3 acc = vec3(0.0);
  float T = 1.0;
  float lit = uTubeW[i];
  vec3 inv = safeInv(rd);
  vec3 bmin = vec3(x - MX, MY0, -MZ);
  vec3 bmax = vec3(x + MX, MY1, MZ);
  vec3 t0 = (bmin - ro) * inv;
  vec3 t1 = (bmax - ro) * inv;
  vec3 tmin = min(t0, t1);
  vec3 tmax = max(t0, t1);
  float tn = max(max(tmin.x, tmin.y), tmin.z);
  float tf = min(min(tmax.x, tmax.y), tmax.z);
  if (tn > 0.0 && tn < tf && tn < tBack) {
    vec3 p = ro + rd * tn;
    vec2 g = tn == tmin.x ? p.zy : tn == tmin.y ? p.xz : p.xy;
    float m = meshGrid(g);
    vec3 wire = vec3(0.02, 0.012, 0.008) * uRoom + GLOW * 0.18 * lit + vec3(0.9, 0.5, 0.3) * 0.02;
    acc += T * m * wire;
    T *= 1.0 - m * 0.8;
  }
  bool forward = rd.z < 0.0;
  for (int j = 0; j < 10; j++) {
    int k = forward ? j : 9 - j;
    float z = 0.27 - float(k) * 0.06;
    if (abs(rd.z) < 1e-5) break;
    float t = (z - ro.z) / rd.z;
    if (t <= 0.0 || t >= tBack) continue;
    vec3 p = ro + rd * t;
    vec2 gl = vec2((p.x - x) / DS + 0.31, (p.y - DY0) / DS);
    vec2 uv = (gl - vec2(${GLYPH_BOX[0]}, ${GLYPH_BOX[1]})) / vec2(${GLYPH_BOX[2]}, ${GLYPH_BOX[3]});
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) continue;
    int dv = STACK[k];
    float d = texture(uDigits, vec3(uv.x, 1.0 - uv.y, float(dv))).r * ${GLYPH_DMAX.toFixed(3)};
    float on = dv == uDigit[i] ? uOn[i] : dv == uPrev[i] ? uPrevOn[i] : 0.0;
    // A thin white-hot wire inside a wider orange sheath of glowing gas.
    float core = exp(-pow(d / 0.011, 2.0));
    float halo = exp(-d / 0.045) * 0.3 + exp(-d / 0.14) * 0.05;
    vec3 emit = (CORE * core * 5.0 + GLOW * exp(-pow(d / 0.026, 2.0)) * 2.2 + GLOW * halo * 3.0) * on;
    float wire = smoothstep(0.013, 0.006, d) * (1.0 - on);
    vec3 wireCol = vec3(0.03, 0.028, 0.026) * uRoom + GLOW * 0.22 * lit;
    acc += T * (emit + wire * wireCol);
    T *= 1.0 - wire * 0.85 - core * on * 0.7;
  }
  return acc + T * behind;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 rd = viewRay(uv * 2.0 - 1.0);
  Hit h = scene(uCam, rd);
  // The mesh's front face is for bounced light only: from the camera the interior is drawn by interior().
  if (h.m == 6) {
    float skip = h.t + 0.05;
    h = scene(uCam + rd * skip, rd);
    h.t += skip;
  }
  vec3 col = h.m == 0 ? vec3(0.0) : surface(h, uCam + rd * h.t, -rd);
  float front = h.t;
  int ti = -1;
  vec3 gn = vec3(0.0);
  float tg = front;
  for (int i = 0; i < 8; i++) {
    if (i >= uTubes) break;
    vec3 n;
    float t = glassHit(uCam, rd, uTubeX[i], n);
    if (t < tg) {
      tg = t;
      ti = i;
      gn = n;
    }
  }
  if (ti >= 0) {
    vec3 inside = interior(ti, uCam, rd, front, col);
    float cosT = abs(dot(rd, gn));
    float F = clamp((0.04 + 0.96 * pow(1.0 - cosT, 5.0)) * uGlassK, 0.0, 1.0);
    vec3 g = inside * vec3(0.97, 0.98, 0.97) * (1.0 - F) + env(reflect(rd, gn)) * F;
    g += GLOW * uTubeW[ti] * 0.05 * pow(1.0 - cosT, 2.0);
    col = g;
  }
  o = vec4(col, 1.0);
}`;

const FINAL_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uHdr;
uniform sampler2D uBloom;
uniform float uBloomGain;
uniform float uExposure;
out vec4 o;
${TONEMAP_GLSL}
void main() {
  vec3 c = texture(uHdr, vUv).rgb + texture(uBloom, vUv).rgb * uBloomGain;
  o = vec4(toSrgb(aces(c * uExposure)), 1.0);
}`;

export type NixieSetup = {
  width: number;
  height: number;
  tubeX: number[];
  baseBox: [number, number, number, number];
  /** Distance fields of the ten digits, ATLAS_W × ATLAS_H × 10 bytes. */
  atlas: Uint8Array;
  /** DIGIT_POINTS points (x, y in glyph units) along each digit's wire, 10 rows. */
  points: Float32Array;
};

export type NixieFrame = {
  camera: { pos: number[]; target: number[]; vfov: number; shiftX: number };
  digit: number[];
  prev: number[];
  on: number[];
  prevOn: number[];
  /** How brightly each tube's lit digit shines now (wire length × on × flicker × the glow slider). */
  glow: number[];
  /** The same for the digit fading out. */
  glowPrev: number[];
  room: number;
  gloss: number;
  rough: number;
  glass: number;
  bloom: number;
  exposure: number;
  lightOnly: boolean;
  denoise: boolean;
  live: boolean;
  /** Baked light: light-map size, bounces and samples per texel to stop at; `restart` bumped to start over. */
  mapSize: number;
  bounces: number;
  spp: number;
  restart: number;
};

export type NixieRenderer = {
  canvas: HTMLCanvasElement;
  render(frame: NixieFrame): void;
  stats(): string;
  dispose(): void;
};

export function createNixieRenderer(s: NixieSetup): NixieRenderer | null {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.round(s.width));
  canvas.height = Math.max(2, Math.round(s.height));
  const kit = createKit(canvas, 'nixie');
  if (!kit) return null;
  const { gl } = kit;
  const W = canvas.width;
  const H = canvas.height;
  const store = kit.hdr ? 1 : 1 / 64;
  const trace = kit.program(FULL_VS, TRACE_FS);
  const compose = kit.program(FULL_VS, COMPOSE_FS);
  const final = kit.program(FULL_VS, FINAL_FS);
  const hdr = kit.target(W, H);
  const bloom = kit.bloom(W, H, 5);
  if (!trace || !compose || !final || !hdr || !bloom) {
    kit.dispose();
    return null;
  }

  // The digit atlas: ten distance fields in a texture array.
  const atlas = kit.track.texture(gl.createTexture()!);
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, atlas);
  gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.R8, ATLAS_W, ATLAS_H, 10, 0, gl.RED, gl.UNSIGNED_BYTE, s.atlas);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // The digits' wire points, one row per digit, read with texelFetch.
  const points = kit.track.texture(gl.createTexture()!);
  gl.bindTexture(gl.TEXTURE_2D, points);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, DIGIT_POINTS, 10, 0, gl.RG, gl.FLOAT, s.points);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  // Light maps: made (and remade) at the chosen size.
  let size = 0;
  let maps: Target[] = [];
  let live: Target | null = null;
  const spp = new Float32Array(MAPS);
  let liveFrames = 0;
  const drop = (t: Target | null) => {
    if (!t) return;
    gl.deleteTexture(t.tex);
    gl.deleteFramebuffer(t.fbo);
  };
  const clear = (t: Target) => {
    kit.into(t);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  };
  const allocate = (n: number) => {
    maps.forEach(drop);
    drop(live);
    maps = [];
    live = null;
    for (let l = 0; l < MAPS; l += 1) {
      const t = kit.target(n, n);
      if (!t) return false;
      clear(t);
      maps.push(t);
    }
    live = kit.target(n, n);
    if (!live) return false;
    clear(live);
    size = n;
    spp.fill(0);
    liveFrames = 0;
    return true;
  };
  if (!allocate(512)) {
    kit.dispose();
    return null;
  }

  const tubeX = new Float32Array(8);
  s.tubeX.forEach((x, i) => (tubeX[i] = x));
  const n = s.tubeX.length;
  const fwd = [0, 0, -1];
  const right = [1, 0, 0];
  const up = [0, 1, 0];
  const cam = [0, 5, 30];
  let halfY = 0.2;
  let shiftX = 0;
  const setCamera = (c: NixieFrame['camera']) => {
    const d = [c.target[0] - c.pos[0], c.target[1] - c.pos[1], c.target[2] - c.pos[2]];
    const l = Math.hypot(d[0], d[1], d[2]) || 1;
    fwd[0] = d[0] / l;
    fwd[1] = d[1] / l;
    fwd[2] = d[2] / l;
    // right = forward × world up, up = right × forward.
    const rl = Math.hypot(fwd[2], fwd[0]) || 1;
    right[0] = -fwd[2] / rl;
    right[1] = 0;
    right[2] = fwd[0] / rl;
    up[0] = right[1] * fwd[2] - right[2] * fwd[1];
    up[1] = right[2] * fwd[0] - right[0] * fwd[2];
    up[2] = right[0] * fwd[1] - right[1] * fwd[0];
    cam[0] = c.pos[0];
    cam[1] = c.pos[1];
    cam[2] = c.pos[2];
    halfY = Math.tan((c.vfov * Math.PI) / 360);
    shiftX = c.shiftX;
  };
  const sceneUniforms = (p: NonNullable<typeof trace>) => {
    gl.uniform3f(p.u('uCam'), cam[0], cam[1], cam[2]);
    gl.uniform3f(p.u('uFwd'), fwd[0], fwd[1], fwd[2]);
    gl.uniform3f(p.u('uRight'), right[0], right[1], right[2]);
    gl.uniform3f(p.u('uUp'), up[0], up[1], up[2]);
    gl.uniform2f(p.u('uHalf'), halfY * (W / H), halfY);
    gl.uniform2f(p.u('uShift'), shiftX, 0);
    gl.uniform1fv(p.u('uTubeX'), tubeX);
    gl.uniform1i(p.u('uTubes'), n);
    gl.uniform4f(p.u('uBaseBox'), ...s.baseBox);
  };
  const f8 = (a: number[]) => {
    const out = new Float32Array(8);
    a.forEach((v, i) => (out[i] = v));
    return out;
  };
  const i8 = (a: number[]) => {
    const out = new Int32Array(8);
    a.forEach((v, i) => (out[i] = v));
    return out;
  };

  let seed = 1;
  let bakedBounces = -1;
  let bakedRestart = -1;
  let lastLive = false;
  let lastStats = '';
  const pass = (target: Target, layer: number, fr: NixieFrame, blendAlpha: number) => {
    kit.into(target);
    gl.enable(gl.BLEND);
    if (blendAlpha > 0) {
      // Live: this frame's sample laid over an exponentially fading history.
      gl.blendColor(0, 0, 0, blendAlpha);
      gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA);
    } else {
      gl.blendFunc(gl.ONE, gl.ONE);
    }
    gl.useProgram(trace.p);
    sceneUniforms(trace);
    gl.uniform1i(trace.u('uLayer'), layer);
    gl.uniform1i(trace.u('uLive'), blendAlpha > 0 ? 1 : 0);
    gl.uniform1i(trace.u('uBounces'), fr.bounces);
    gl.uniform1f(trace.u('uSeed'), seed);
    gl.uniform2f(trace.u('uAtlas'), size, size);
    gl.uniform1f(trace.u('uStore'), store);
    kit.bind(0, points, trace.u('uPoints'));
    gl.uniform1iv(trace.u('uDigitL'), i8(fr.digit));
    gl.uniform1iv(trace.u('uPrevL'), i8(fr.prev));
    gl.uniform1fv(trace.u('uWL'), f8(fr.glow));
    gl.uniform1fv(trace.u('uPrevWL'), f8(fr.glowPrev));
    gl.uniform1f(trace.u('uRoomL'), fr.room);
    kit.fullscreen();
    gl.disable(gl.BLEND);
    seed += 1;
  };

  return {
    canvas,
    stats: () => lastStats,
    render(fr) {
      if (kit.lost()) return;
      setCamera(fr.camera);
      const wantSize = [256, 512, 1024].includes(fr.mapSize) ? fr.mapSize : 512;
      if (wantSize !== size && !allocate(wantSize)) return;
      if (fr.bounces !== bakedBounces || fr.restart !== bakedRestart) {
        bakedBounces = fr.bounces;
        bakedRestart = fr.restart;
        maps.forEach(clear);
        spp.fill(0);
        if (live) clear(live);
        liveFrames = 0;
      }
      if (fr.live !== lastLive) {
        lastLive = fr.live;
        if (live) clear(live);
        liveFrames = 0;
      }
      let blur = 0;
      if (fr.live && live) {
        // Two samples a frame; the history weighs like a running mean at first, then fades by ~1/12 per sample.
        for (let k = 0; k < 2; k += 1) {
          liveFrames += 1;
          pass(live, 0, fr, Math.max(1 / 12, 1 / liveFrames));
        }
        blur = fr.denoise ? 1.4 : 0;
        lastStats = `живая трассировка · карта ${size}²`;
      } else {
        const target = Math.max(1, fr.spp);
        const young = spp.some((v, l) => l <= n && v < 4);
        const budget = young ? n + 1 : 2;
        for (let k = 0; k < budget; k += 1) {
          let best = -1;
          for (let l = 0; l <= n; l += 1) if (spp[l] < target && (best < 0 || spp[l] < spp[best])) best = l;
          if (best < 0) break;
          pass(maps[best], best, fr, 0);
          spp[best] += 1;
        }
        let minSpp = Infinity;
        for (let l = 0; l <= n; l += 1) minSpp = Math.min(minSpp, spp[l]);
        blur = fr.denoise ? Math.max(0, Math.min(2, (24 - minSpp) / 10)) : 0;
        lastStats = `${minSpp}/${target} сэмплов · карта ${size}²`;
      }

      const w = new Float32Array(MAPS);
      const inv = (l: number) => (spp[l] > 0 ? 1 / (spp[l] * store) : 0);
      w[0] = inv(0) * fr.room;
      for (let i = 0; i < n; i += 1) w[i + 1] = inv(i + 1) * (fr.glow[i] + fr.glowPrev[i]);
      kit.into(hdr);
      gl.useProgram(compose.p);
      sceneUniforms(compose);
      gl.uniform2f(compose.u('uRes'), W, H);
      maps.forEach((t, l) => kit.bind(l, t.tex, compose.u(`uL${l}`)));
      kit.bind(7, live!.tex, compose.u('uLiveMap'));
      gl.uniform1i(compose.u('uLiveOn'), fr.live ? 1 : 0);
      gl.uniform1f(compose.u('uLiveScale'), 1 / store);
      gl.uniform1fv(compose.u('uW'), w);
      gl.uniform1f(compose.u('uBlur'), blur);
      gl.uniform2f(compose.u('uAtlasTexel'), 1 / size, 1 / size);
      kit.bind(8, atlas, compose.u('uDigits'), gl.TEXTURE_2D_ARRAY);
      gl.uniform1iv(compose.u('uDigit'), i8(fr.digit));
      gl.uniform1iv(compose.u('uPrev'), i8(fr.prev));
      gl.uniform1fv(compose.u('uOn'), f8(fr.on));
      gl.uniform1fv(compose.u('uPrevOn'), f8(fr.prevOn));
      gl.uniform1fv(compose.u('uTubeW'), f8(fr.glow.map((g, i) => g + fr.glowPrev[i])));
      gl.uniform1f(compose.u('uRoom'), fr.room);
      gl.uniform1f(compose.u('uGloss'), fr.gloss);
      gl.uniform1f(compose.u('uRough'), fr.rough);
      gl.uniform1f(compose.u('uGlassK'), fr.glass);
      gl.uniform1f(compose.u('uLightOnly'), fr.lightOnly ? 1 : 0);
      kit.fullscreen();
      const glow = bloom.run(hdr);
      kit.into(null);
      gl.useProgram(final.p);
      kit.bind(0, hdr.tex, final.u('uHdr'));
      kit.bind(1, glow.tex, final.u('uBloom'));
      gl.uniform1f(final.u('uBloomGain'), (1.2 * fr.bloom) / bloom.levels);
      gl.uniform1f(final.u('uExposure'), fr.exposure);
      kit.fullscreen();
    },
    dispose() {
      kit.dispose();
    },
  };
}
