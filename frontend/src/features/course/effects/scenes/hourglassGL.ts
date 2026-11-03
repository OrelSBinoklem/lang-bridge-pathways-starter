import { GLASS, GRAVITY, HOLLOW_TOP, ORIFICE, REPOSE, STREAM_V0 } from './hourglassSand';

/**
 * WebGL2 renderer of the ray-traced hourglass: one fragment shader traces every pixel of the card. A ray that misses
 * the glass reads the room (a baked, linear-light picture of the wall and the desk, see hourglass3d.ts) and, on the
 * desk and the wall, the hourglass's soft shadow from the lamp. A ray that meets it is followed through the glass:
 * Fresnel reflection (the lamp and the room in it) and refraction at the outer wall, through the wall's thickness
 * (with total internal reflection where it happens), into the hollow, onto the sand, or out through the far wall and
 * into the room — so the glass bends what is behind it. The wooden frame, the sand's grains and the falling stream
 * are shaded by the same lamp; the frame's pillars shade the sand. Signed distance functions throughout.
 */

/** The wooden frame, in the glass's units (see hourglassSand.ts): end plates and three turned pillars. */
export const FRAME = {
  /** Where the plates start (the glass's ends touch them), their thickness and radius. */
  capY: 1.0,
  capH: 0.12,
  capR: 0.5,
  /** Distance of the pillars from the axis. */
  pillarAt: 0.455,
  /** Half the height of the whole thing. */
  half: 1.12,
  /** Radius of a cylinder around all of it (for the quick early-out). */
  bound: 0.52,
};

const f = (n: number) => n.toFixed(5);

const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uRes;
uniform vec2 uPrincipal;
uniform float uFocal;
uniform vec3 uCam;
uniform vec3 uCenter;
uniform mat3 uToLocal;
uniform float uParity;
uniform sampler2D uBg;
uniform vec3 uLight;
uniform vec3 uLightCol;
uniform vec3 uSand;
uniform vec4 uTop;
uniform vec4 uBot;
uniform vec4 uStream;
uniform float uTime;
uniform float uExposure;
uniform float uFoot;
uniform int uSamples;

const float R1 = ${f(GLASS.r1)};
const float R2 = ${f(GLASS.r2)};
const float HB = ${f(GLASS.h)};
const float T = ${f(GLASS.t)};
const float ROUND2 = ${f(GLASS.round * GLASS.round)};
const float K = ${f(REPOSE)};
const float INVK = ${f(1 / Math.hypot(1, REPOSE))};
const float Y_BOT = ${f(-HOLLOW_TOP)};
const float STREAM_R = ${f(ORIFICE * 0.62)};
const float V0 = ${f(STREAM_V0)};
const float G = ${f(GRAVITY)};
const float CAP_Y = ${f(FRAME.capY)};
const float CAP_H = ${f(FRAME.capH)};
const float CAP_R = ${f(FRAME.capR)};
const float PILLAR = ${f(FRAME.pillarAt)};
const float HALF = ${f(FRAME.half)};
const float BOUND = ${f(FRAME.bound)};
const float IOR = 1.5;
const float EPS = 0.0012;
const float WALL_Z = -2.4;
const float LAMP_R = 0.8;

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 u = fract(p);
  u = u * u * (3.0 - 2.0 * u);
  return mix(
    mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), u.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), u.x), u.y),
    mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), u.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), u.x), u.y),
    u.z);
}

// ---- shapes, in the glass's own frame (y along its axis, the neck at 0)
float roundCone(vec2 q, float r1, float r2, float h) {
  float b = (r1 - r2) / h;
  float a = sqrt(1.0 - b * b);
  float k = dot(q, vec2(-b, a));
  if (k < 0.0) return length(q) - r1;
  if (k > a * h) return length(q - vec2(0.0, h)) - r2;
  return dot(q, vec2(a, b)) - r1;
}
float glassOut(vec3 p) { return roundCone(vec2(length(p.xz), sqrt(p.y * p.y + ROUND2)), R1, R2, HB); }
float hollow(vec3 p) { return glassOut(p) + T; }

float disc(vec3 p, float r, float hh, float round) {
  vec2 d = vec2(length(p.xz) - r + round, abs(p.y) - hh + round);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - round;
}
float frame(vec3 p) {
  vec3 q = vec3(p.x, abs(p.y), p.z);
  float plate = disc(q - vec3(0.0, CAP_Y + CAP_H * 0.5, 0.0), CAP_R, CAP_H * 0.5, 0.03);
  float step1 = disc(q - vec3(0.0, CAP_Y + CAP_H + 0.012, 0.0), CAP_R * 0.78, 0.014, 0.01);
  float socket = disc(q - vec3(0.0, CAP_Y - 0.012, 0.0), 0.15, 0.014, 0.008);
  // Three pillars at 30°, 150° and 270° (turning the glass over maps the set onto itself), turned with beads.
  float axis = min(min(length(q.xz - PILLAR * vec2(0.8660254, 0.5)), length(q.xz - PILLAR * vec2(-0.8660254, 0.5))), length(q.xz - vec2(0.0, -PILLAR)));
  float bead = 0.5 + 0.5 * cos(q.y * 10.5);
  float rad = 0.022 + 0.013 * bead * bead * bead;
  float pillar = max(axis - rad, q.y - CAP_Y - 0.01);
  return min(min(plate, step1), min(socket, pillar * 0.85));
}

vec3 sandFrame(vec3 p) { return vec3(p.x * uParity, p.y * uParity, p.z); }
float sandTop(vec3 p, float hol) {
  if (uTop.x <= 0.0) return 1e3;
  vec3 s = sandFrame(p);
  float r = length(s.xz);
  float y = s.y - uTop.z;
  float surf = max(y - uTop.x, (y - (uTop.y + r * K)) * INVK);
  return max(max(surf, -y), hol);
}
float sandBot(vec3 p, float hol) {
  vec3 s = sandFrame(p);
  float r = length(s.xz);
  float y = s.y - uBot.z;
  float surf = min(y - uBot.x, (y - (uBot.y - r * K)) * INVK);
  return max(max(surf, Y_BOT - y), max(hol, s.y));
}
float sandBoth(vec3 p) { float h = hollow(p); return min(sandTop(p, h), sandBot(p, h)); }
float stream(vec3 p) {
  if (uStream.w < 0.5) return 1e3;
  vec3 s = sandFrame(p);
  float below = -s.y;
  float v = sqrt(V0 * V0 + 2.0 * G * max(below, 0.0));
  float rad = STREAM_R * sqrt(V0 / v);
  float dy = max(uStream.x - below, below - min(uStream.y, uStream.z));
  return max(length(s.xz) - rad, dy);
}

#define GRAD(fn, p) normalize(vec3(1, -1, -1) * fn(p + vec3(1, -1, -1) * 0.0008) + vec3(-1, -1, 1) * fn(p + vec3(-1, -1, 1) * 0.0008) + vec3(-1, 1, -1) * fn(p + vec3(-1, 1, -1) * 0.0008) + vec3(1, 1, 1) * fn(p + vec3(1, 1, 1) * 0.0008))

// ---- the room
vec3 toWorld(vec3 v) { return transpose(uToLocal) * v; }
vec3 toLocalP(vec3 p) { return uToLocal * (p - uCenter); }

vec2 cylinder(vec3 o, vec3 d, float r, float hh) {
  float a = dot(d.xz, d.xz);
  float b = dot(o.xz, d.xz);
  float c = dot(o.xz, o.xz) - r * r;
  float t0 = -1e9;
  float t1 = 1e9;
  if (a > 1e-9) {
    float det = b * b - a * c;
    if (det < 0.0) return vec2(1.0, -1.0);
    float sq = sqrt(det);
    t0 = (-b - sq) / a;
    t1 = (-b + sq) / a;
  } else if (c > 0.0) return vec2(1.0, -1.0);
  if (abs(d.y) > 1e-9) {
    float ya = (-hh - o.y) / d.y;
    float yb = (hh - o.y) / d.y;
    t0 = max(t0, min(ya, yb));
    t1 = min(t1, max(ya, yb));
  } else if (abs(o.y) > hh) return vec2(1.0, -1.0);
  return vec2(t0, t1);
}

/** Soft shadow of the frame and the sand towards the lamp (glass lets most light through), 1 = lit. */
float shadow(vec3 pw, bool glassToo) {
  vec3 L = uLight - pw;
  float dist = length(L);
  vec3 o = toLocalP(pw);
  vec3 d = uToLocal * (L / dist);
  vec2 hit = cylinder(o, d, BOUND + 0.02, HALF + 0.02);
  if (hit.y < 0.0 || hit.x > hit.y) return 1.0;
  float t = max(hit.x, 0.004);
  float res = 1.0;
  float glass = 1.0;
  for (int i = 0; i < 48; i++) {
    vec3 p = o + d * t;
    float h = min(frame(p), sandBoth(p));
    // Penumbra of a lamp shade 0.8 across seen from ~6 away.
    res = min(res, 10.0 * h / max(t, 0.05));
    if (glassToo && glassOut(p) < 0.0) glass = 0.8;
    if (res < 0.02 || t > hit.y) break;
    t += clamp(h, 0.008, 0.1);
  }
  return clamp(res, 0.0, 1.0) * glass;
}

vec3 lampSeen(vec3 ro, vec3 rd) {
  vec3 oc = ro - uLight;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - LAMP_R * LAMP_R;
  float h = b * b - c;
  if (h < 0.0 || -b < 0.0) return vec3(0.0);
  return uLightCol / (3.14159 * LAMP_R * LAMP_R) * smoothstep(0.0, 0.02, h);
}

/** The room behind the camera, seen only in reflections: dim, warmer towards the ceiling, and a big softbox up to the
 * right (the kind of fill light a product photo has), which draws the long highlights on the glass. */
vec3 behind(vec3 ro, vec3 rd) {
  vec3 c = vec3(0.05, 0.045, 0.045) + vec3(0.07, 0.06, 0.05) * clamp(rd.y, 0.0, 1.0);
  if (rd.z > 0.05) {
    float t = (8.0 - ro.z) / rd.z;
    vec2 q = ((ro + rd * t).xy - vec2(4.0, 5.0)) / vec2(1.8, 2.4);
    c += vec3(1.6, 1.57, 1.52) * smoothstep(1.0, 0.75, max(abs(q.x), abs(q.y)));
  }
  return c;
}

/** What a ray sees once it has left the glass: the baked room (with the hourglass's shadow), the lamp, or the room
 * behind the camera. */
vec3 room(vec3 ro, vec3 rd) {
  vec3 lamp = lampSeen(ro, rd);
  float t = -1.0;
  if (rd.y < -1e-4) {
    t = -ro.y / rd.y;
    if (ro.z + rd.z * t < WALL_Z) t = -1.0;
  }
  if (t < 0.0 && rd.z < -1e-4) t = (WALL_Z - ro.z) / rd.z;
  // A tall softbox off to the right, level with the hourglass: the bright lines along the right of the glass.
  vec3 strip = vec3(0.0);
  if (rd.x > 0.05) {
    float ts = (6.0 - ro.x) / rd.x;
    vec2 q = (ro + rd * ts).yz - vec2(2.2, 0.0);
    strip = vec3(1.1, 1.12, 1.15) * smoothstep(1.0, 0.8, max(abs(q.x) / 2.0, abs(q.y) / 1.6));
    if (strip.x > 0.0 && (t < 0.0 || ts < t)) return lamp + strip;
  }
  if (t < 0.0) return lamp + behind(ro, rd);
  vec3 p = ro + rd * t;
  float depth = uCam.z - p.z;
  if (depth < 0.05) return lamp + behind(ro, rd);
  vec2 q = uPrincipal + uFocal * (p.xy - uCam.xy) / depth;
  vec2 uv = q / uRes;
  // Off the picture: the rest of the room, dimly lit, warmer towards the lamp on the left.
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return lamp + vec3(0.05, 0.06, 0.06) + vec3(0.08, 0.05, 0.02) * max(-rd.x, 0.0);
  vec4 bg = textureLod(uBg, uv, 0.0);
  float lit = bg.a > 0.01 ? shadow(p, true) : 1.0;
  return lamp + bg.rgb * (1.0 - bg.a + bg.a * lit);
}

// ---- materials
vec3 lampLight(vec3 pw, vec3 nw) {
  vec3 L = uLight - pw;
  float d2 = dot(L, L);
  return uLightCol * max(dot(nw, L * inversesqrt(d2)), 0.0) / d2;
}

vec3 shadeFrame(vec3 p, vec3 d) {
  vec3 n = GRAD(frame, p);
  vec3 pw = uCenter + toWorld(p);
  vec3 nw = toWorld(n);
  vec3 dw = toWorld(d);
  // Walnut turned on a lathe: growth rings around the axis on the plates, long grain along the pillars.
  float r = length(p.xz);
  float onPlate = step(CAP_Y - 0.004, abs(p.y));
  float grain = onPlate > 0.5 ? vnoise(vec3(r * 38.0, p.y * 3.0, atan(p.z, p.x) * 2.0)) : vnoise(vec3(p.x * 30.0, p.y * 5.0, p.z * 30.0));
  grain = 0.55 * grain + 0.45 * vnoise(vec3(p * 90.0));
  vec3 albedo = mix(vec3(0.045, 0.02, 0.009), vec3(0.19, 0.095, 0.04), grain);
  vec3 L = normalize(uLight - pw);
  float lit = shadow(pw + nw * 0.006, false);
  vec3 diffuse = albedo * (lampLight(pw, nw) * lit + vec3(0.05, 0.045, 0.05));
  // Oiled finish: a soft highlight and a faint reflection of the room.
  vec3 h = normalize(L - dw);
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(nw, -dw), 0.0), 5.0);
  vec3 spec = uLightCol / dot(uLight - pw, uLight - pw) * pow(max(dot(nw, h), 0.0), 60.0) * 0.35 * lit;
  return diffuse + spec + fres * 0.25 * room(pw + nw * 0.01, reflect(dw, nw));
}

vec3 sandAlbedo(vec3 s, float flowing) {
  // Grains: bright and dark ones, a few glinting quartz faces.
  vec3 g = s * 260.0;
  g.y += flowing * uTime * 1.6;
  float n = hash13(floor(g)) * 0.6 + vnoise(g * 0.5) * 0.4;
  vec3 a = uSand * (0.62 + 0.62 * n);
  return a;
}

float sandTopN(vec3 p) { return sandTop(p, hollow(p)); }
float sandBotN(vec3 p) { return sandBot(p, hollow(p)); }

vec3 shadeSand(vec3 p, vec3 d, bool upper) {
  vec3 n = upper ? GRAD(sandTopN, p) : GRAD(sandBotN, p);
  vec3 s = sandFrame(p);
  vec3 pw = uCenter + toWorld(p);
  vec3 nw = toWorld(n);
  // Grains on the funnel's slope slide down into the neck while the sand runs.
  float r = length(s.xz);
  float onSlope = upper && uStream.w > 0.5 && s.y - uTop.z < uTop.x - 0.004 ? 1.0 : 0.0;
  vec3 at = s;
  if (onSlope > 0.5) at = vec3(normalize(s.xz + 1e-5) * (r + uTime * 0.06), s.y + uTime * 0.04 * K).xzy;
  vec3 albedo = sandAlbedo(at, 0.0);
  float ao = clamp(-hollow(p) / 0.05, 0.45, 1.0);
  float lit = shadow(pw + nw * 0.004, false) * 0.86;
  vec3 col = albedo * (lampLight(pw, nw) * lit + vec3(0.07, 0.065, 0.07)) * ao;
  float glint = step(0.992, hash13(floor(at * 260.0) + 7.0)) * pow(max(dot(nw, normalize(normalize(uLight - pw) - toWorld(d))), 0.0), 8.0);
  return col + glint * lit * uLightCol / dot(uLight - pw, uLight - pw) * 0.6;
}

vec3 shadeStream(vec3 p) {
  vec3 pw = uCenter + toWorld(p);
  vec3 L = normalize(uLight - pw);
  vec3 albedo = sandAlbedo(p, 1.0);
  return albedo * (uLightCol / dot(uLight - pw, uLight - pw) * 0.75 * 0.86 + vec3(0.07, 0.065, 0.07));
}
float streamCover(vec3 p) {
  vec3 s = sandFrame(p);
  float below = max(-s.y, 0.0);
  float v = sqrt(V0 * V0 + 2.0 * G * below);
  // A grain that is here now left the neck (v − v0)/g ago: the pattern falls with the grains and stretches as they speed up.
  float left = uTime - (v - V0) / G;
  float n = vnoise(vec3(atan(s.z, s.x) * 1.5, left * 90.0, 0.0)) * 0.7 + hash13(vec3(floor(left * 400.0), floor(atan(s.z, s.x) * 3.0), 1.0)) * 0.3;
  // Grains drift apart as they speed up: the stream thins out towards the bottom.
  return smoothstep(0.2, 0.75, n) * mix(1.0, 0.6, clamp(below / 0.9, 0.0, 1.0));
}

float fresnel(float c) {
  float f0 = 0.04;
  return f0 + (1.0 - f0) * pow(1.0 - clamp(c, 0.0, 1.0), 5.0);
}

vec3 traceHourglass(vec3 roW, vec3 rdW) {
  vec3 o = toLocalP(roW);
  vec3 d = uToLocal * rdW;
  vec2 hit = cylinder(o, d, BOUND, HALF + 0.01);
  if (hit.y < 0.0 || hit.x > hit.y) return room(roW, rdW);
  vec3 p = o + d * max(hit.x, 0.0);
  vec3 col = vec3(0.0);
  vec3 thr = vec3(1.0);
  int medium = 0;
  float sMin = 1e3;
  vec3 sAt = vec3(0.0);
  for (int i = 0; i < 180; i++) {
    if (medium == 0) {
      float dg = glassOut(p);
      float df = frame(p);
      float dm = min(dg, df);
      if (dm < EPS) {
        if (df <= dg) return col + thr * shadeFrame(p, d);
        vec3 n = GRAD(glassOut, p);
        float c = -dot(d, n);
        float F = fresnel(c);
        vec3 pw = uCenter + toWorld(p);
        col += thr * F * room(pw, toWorld(reflect(d, n)));
        thr *= 1.0 - F;
        d = refract(d, n, 1.0 / IOR);
        medium = 1;
        p += d * EPS * 3.0;
        continue;
      }
      p += d * dm;
      if (length(p.xz) > BOUND + 0.05 || abs(p.y) > HALF + 0.05) break;
    } else if (medium == 1) {
      float a = -glassOut(p);
      float b = hollow(p);
      float dm = min(a, b);
      if (dm < EPS * 0.5) {
        vec3 n = GRAD(glassOut, p);
        if (b <= a) {
          vec3 rd = refract(d, n, IOR);
          if (dot(rd, rd) < 0.5) { d = reflect(d, n); p += d * EPS * 2.0; continue; }
          thr *= 1.0 - fresnel(-dot(d, n));
          d = rd;
          medium = 2;
        } else {
          vec3 rd = refract(d, -n, IOR);
          if (dot(rd, rd) < 0.5) { d = reflect(d, -n); p += d * EPS * 2.0; continue; }
          thr *= 1.0 - fresnel(dot(d, n));
          d = rd;
          medium = 0;
        }
        p += d * EPS * 3.0;
        continue;
      }
      float stepLen = max(dm, EPS * 0.4);
      thr *= exp(-vec3(1.4, 0.5, 0.9) * stepLen);
      p += d * stepLen;
    } else {
      float hol = hollow(p);
      float ds = min(sandTop(p, hol), sandBot(p, hol));
      float dst = stream(p);
      if (dst < sMin) { sMin = dst; sAt = p; }
      float dc = -hol;
      if (ds < EPS) {
        if (sMin < uFoot) { float cov = streamCover(sAt) * clamp(1.0 - sMin / uFoot, 0.0, 1.0); col += thr * cov * shadeStream(sAt); thr *= 1.0 - cov; }
        bool upper = sandFrame(p).y > 0.0;
        return col + thr * shadeSand(p, d, upper);
      }
      if (dc < EPS) {
        if (sMin < uFoot) { float cov = streamCover(sAt) * clamp(1.0 - sMin / uFoot, 0.0, 1.0); col += thr * cov * shadeStream(sAt); thr *= 1.0 - cov; }
        sMin = 1e3;
        vec3 n = GRAD(glassOut, p);
        thr *= 1.0 - fresnel(dot(d, n));
        d = refract(d, -n, 1.0 / IOR);
        medium = 1;
        p += d * EPS * 3.0;
        continue;
      }
      p += d * min(min(dc, ds), max(dst, uFoot * 0.5));
    }
  }
  vec3 pw = uCenter + toWorld(p);
  return col + thr * room(pw, toWorld(d));
}

const vec2 OFF2[2] = vec2[2](vec2(-0.25, 0.25), vec2(0.25, -0.25));
const vec2 OFF4[4] = vec2[4](vec2(-0.125, -0.375), vec2(0.375, -0.125), vec2(0.125, 0.375), vec2(-0.375, 0.125));

vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec3 center = normalize(vec3((frag - uPrincipal) / uFocal, -1.0));
  vec3 o = toLocalP(uCam);
  vec3 dl = uToLocal * center;
  vec2 hit = cylinder(o, dl, BOUND + 0.08, HALF + 0.08);
  bool near = hit.y > 0.0 && hit.x < hit.y;
  vec3 col = vec3(0.0);
  int n = near ? uSamples : 1;
  for (int k = 0; k < 4; k++) {
    if (k >= n) break;
    vec2 off = n == 1 ? vec2(0.0) : n == 2 ? OFF2[k] : OFF4[k];
    vec3 rd = normalize(vec3((frag + off - uPrincipal) / uFocal, -1.0));
    col += near ? traceHourglass(uCam, rd) : room(uCam, rd);
  }
  col /= float(n);
  vec3 mapped = aces(col * uExposure);
  outColor = vec4(pow(mapped, vec3(1.0 / 2.2)), 1.0);
}`;

export type HourglassFrame = {
  toLocal: Float32Array;
  center: [number, number, number];
  parity: number;
  top: [number, number, number, number];
  bottom: [number, number, number, number];
  stream: [number, number, number, number];
  time: number;
  exposure: number;
  samples: number;
};

export type HourglassRenderer = {
  canvas: HTMLCanvasElement;
  render(frame: HourglassFrame): void;
  /** Another camera (the camera control): its place, the axis's point on the canvas, the focal length, the room baked
   * for it, the pixel's footprint. */
  setView(view: { cam: [number, number, number]; principal: [number, number]; focal: number; room: Float32Array; foot: number }): void;
  dispose(): void;
};

/**
 * `room` is the baked picture behind (linear light, alpha = the share of it that is the lamp's direct light), one texel
 * per device pixel, rows from the bottom. The camera sits at `cam`, looks along −z, its axis meets the canvas at
 * `principal` (device px from the bottom left), `focal` device px.
 */
export function createHourglassRenderer(opts: {
  width: number;
  height: number;
  room: Float32Array;
  cam: [number, number, number];
  principal: [number, number];
  focal: number;
  light: [number, number, number];
  lightColor: [number, number, number];
  sand: [number, number, number];
  foot: number;
}): HourglassRenderer | null {
  const canvas = document.createElement('canvas');
  canvas.width = opts.width;
  canvas.height = opts.height;
  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  } catch {
    gl = null;
  }
  if (!gl) return null;
  const g = gl;
  const release = () => g.getExtension('WEBGL_lose_context')?.loseContext();
  const shader = (type: number, src: string) => {
    const sh = g.createShader(type);
    if (!sh) return null;
    g.shaderSource(sh, src);
    g.compileShader(sh);
    if (!g.getShaderParameter(sh, g.COMPILE_STATUS)) {
      console.error('[hourglass] shader:', g.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  };
  const vs = shader(g.VERTEX_SHADER, VERT);
  const fs = shader(g.FRAGMENT_SHADER, FRAG);
  const prog = g.createProgram();
  if (!vs || !fs || !prog) {
    release();
    return null;
  }
  g.attachShader(prog, vs);
  g.attachShader(prog, fs);
  g.linkProgram(prog);
  if (!g.getProgramParameter(prog, g.LINK_STATUS)) {
    console.error('[hourglass] program:', g.getProgramInfoLog(prog));
    release();
    return null;
  }
  const u = (name: string) => g.getUniformLocation(prog, name);
  const loc = {
    res: u('uRes'), principal: u('uPrincipal'), focal: u('uFocal'), cam: u('uCam'), center: u('uCenter'), toLocal: u('uToLocal'),
    parity: u('uParity'), bg: u('uBg'), light: u('uLight'), lightCol: u('uLightCol'), sand: u('uSand'), top: u('uTop'),
    bottom: u('uBot'), stream: u('uStream'), time: u('uTime'), exposure: u('uExposure'), foot: u('uFoot'), samples: u('uSamples'),
  };
  const bg = g.createTexture()!;
  g.bindTexture(g.TEXTURE_2D, bg);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
  g.pixelStorei(g.UNPACK_ALIGNMENT, 1);
  g.texImage2D(g.TEXTURE_2D, 0, g.RGBA16F, opts.width, opts.height, 0, g.RGBA, g.FLOAT, opts.room);
  const vao = g.createVertexArray();
  let disposed = false;

  return {
    canvas,
    render(fr) {
      if (disposed || g.isContextLost()) return;
      g.viewport(0, 0, g.drawingBufferWidth, g.drawingBufferHeight);
      g.useProgram(prog);
      g.bindVertexArray(vao);
      g.activeTexture(g.TEXTURE0);
      g.bindTexture(g.TEXTURE_2D, bg);
      g.uniform1i(loc.bg, 0);
      g.uniform2f(loc.res, opts.width, opts.height);
      g.uniform2f(loc.principal, opts.principal[0], opts.principal[1]);
      g.uniform1f(loc.focal, opts.focal);
      g.uniform3f(loc.cam, ...opts.cam);
      g.uniform3f(loc.light, ...opts.light);
      g.uniform3f(loc.lightCol, ...opts.lightColor);
      g.uniform3f(loc.sand, ...opts.sand);
      g.uniform1f(loc.foot, opts.foot);
      g.uniform3f(loc.center, ...fr.center);
      g.uniformMatrix3fv(loc.toLocal, false, fr.toLocal);
      g.uniform1f(loc.parity, fr.parity);
      g.uniform4f(loc.top, ...fr.top);
      g.uniform4f(loc.bottom, ...fr.bottom);
      g.uniform4f(loc.stream, ...fr.stream);
      g.uniform1f(loc.time, fr.time);
      g.uniform1f(loc.exposure, fr.exposure);
      g.uniform1i(loc.samples, fr.samples);
      g.drawArrays(g.TRIANGLES, 0, 3);
    },
    setView(view) {
      if (disposed || g.isContextLost()) return;
      opts.cam = view.cam;
      opts.principal = view.principal;
      opts.focal = view.focal;
      opts.foot = view.foot;
      g.bindTexture(g.TEXTURE_2D, bg);
      g.pixelStorei(g.UNPACK_ALIGNMENT, 1);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA16F, opts.width, opts.height, 0, g.RGBA, g.FLOAT, view.room);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (!g.isContextLost()) {
        g.deleteTexture(bg);
        g.deleteProgram(prog);
        g.deleteVertexArray(vao);
      }
      release();
    },
  };
}
