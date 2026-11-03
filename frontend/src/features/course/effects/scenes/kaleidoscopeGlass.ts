/**
 * The kaleidoscope's window ray traced on the GPU (WebGL2): only the one triangle of the drum — the hexagons are its
 * mirrored copies, so this costs one small image a frame (and none while the pile rests and the light keeps still).
 *
 * Every piece is its real shape: a shard or a glitter flake is its polygon extruded to its thickness (a convex prism,
 * cut by slabs), a bead a sphere, a bugle bead a capsule. A shard's broken edge is worn round (tumbled glass): within
 * `bevel` mm of its outline the face's normal leans out to the edge, a quarter-round profile. A ray comes from the eye
 * straight into the drum and:
 *   glass  — Fresnel (Schlick) splits it: the reflected part picks up the lamp's glint and the dark tube, the rest
 *            refracts in, loses colour by Beer–Lambert over the path it really takes through the glass (overlapping
 *            pieces deepen the colour), refracts out — or reflects inside at total internal reflection, which the
 *            rounded edges do a lot: bright and dark rims — and goes on to the next piece; dichroic glass turns from
 *            one colour to the other with the angle;
 *   metal  — glitter and silver-lined rods mirror the lamp through their tilted facets: sparkles; holographic foil
 *            takes its colour from the facet's own tilt (not from the lamp, so moving the light moves glints only);
 *   pearl  — opaque, a soft sheen;
 * and whatever gets through reaches the frosted backlight at the back of the drum. Up to 10 events a ray.
 *
 * Dispersion: with it on, every pixel is traced three times, red, green and blue each with its own index of refraction
 * (real crown glass ±0.004 round 1.52, times the setting), so where the paths part — the rounded edges, total internal
 * reflection — the white backlight splits into rainbow fringes.
 *
 * Glitter foil is hammered: its surface is tiny facets (0.14 mm, each tilted its own way), so a flake flashes in specks
 * and the specks move as the light does.
 *
 * While nothing moves the same picture is traced again and again (kalSamples times in all, a few a frame), each shifted
 * by a fraction of a pixel and with fresh grain on rough glass, and averaged in half floats before the tone curve:
 * smooth edges, glints and frost for the still picture, one trace a frame while it moves.
 *
 * Then the look: exposure, saturation round the luminance, a 1 − e^(−x) tone curve. Whatever is far brighter than the
 * backlight (the lamp's glints) goes into a second target and comes back as a soft glow (two blurs at half size) and
 * six-ray stars along 0°, 60° and 120° — the mirrors' own angles, so a star stays whole in every mirrored copy.
 */

export type GlassBody = {
  kind: number;
  x: number; y: number; z: number;
  m: number[];
  a: number; t: number;
  poly: number[];
  bound: number;
  col: [number, number, number];
  col2: [number, number, number] | null;
  alpha: number;
  pearl: boolean;
  rough: number;
  cut: boolean;
  metal: number;
  fx: number; fy: number;
};

/** The look, see SceneParams.kal*. */
export type GlassLook = {
  exposure: number;
  saturation: number;
  sparkle: number;
  glow: number;
  stars: number;
  dispersion: number;
  bevel: number;
  /** How much the backlight darkens away from where the lamp shines through (1: as designed, 0: even). */
  vignette: number;
};

const TEXELS = 14;
const MAX_BODIES = 160;

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const TRACE = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uBodies;
uniform int uCount;
uniform vec2 uSize;
uniform float uDpr;
uniform float uK;
uniform vec2 uG;
uniform vec2 uRot;
uniform vec3 uLight;
uniform vec3 uBackC;
uniform vec3 uBackE;
uniform vec2 uBackShift;
uniform float uCellR;
uniform float uDepth;
uniform float uExposure;
uniform float uSaturation;
uniform float uSparkle;
uniform float uDispersion;
uniform float uBevel;
uniform float uVignette;
uniform vec2 uJitter;
// The camera's tilt (orbitControl.ts): the rays lean by this (view frame, tangents), through the pile's middle.
uniform vec2 uTilt;
// Which refinement sample this is (fresh grain for the stochastic parts), and whether to write plain radiance for the
// float accumulation (then RESOLVE tone-maps the average) or the finished colours straight away.
uniform int uSeed;
uniform bool uLinearOut;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outHot;

const float IOR = 1.52;
const float BIG = 1e9;

vec4 T(int b, int i) { return texelFetch(uBodies, ivec2(i, b), 0); }

// An integer hash (PCG 2D, Jarzynski & Olano): no patterns, unlike fract(sin(...)), whose precision on GPUs drops for
// big arguments and leaves a grain that is the same in every sample. Two values in -1..1.
vec2 hashI(ivec2 p, int seed) {
  uvec2 v = uvec2(p) * 1664525u + 1013904223u + uint(seed) * 747796405u;
  v.x += v.y * 1664525u;
  v.y += v.x * 1664525u;
  v ^= v >> 16u;
  v.x += v.y * 1664525u;
  v.y += v.x * 1664525u;
  v ^= v >> 16u;
  return vec2(v) * (2.0 / 4294967295.0) - 1.0;
}

mat3 bodyMat(int b) {
  vec3 r0 = T(b, 1).xyz, r1 = T(b, 2).xyz, r2 = T(b, 3).xyz;
  return mat3(vec3(r0.x, r1.x, r2.x), vec3(r0.y, r1.y, r2.y), vec3(r0.z, r1.z, r2.z));
}

// Capsule along local x from -a to a, radius r (Inigo Quilez's). Returns the entry distance or -1.
float capsule(vec3 ro, vec3 rd, float a, float r) {
  vec3 pa = vec3(-a, 0.0, 0.0), pb = vec3(a, 0.0, 0.0);
  vec3 ba = pb - pa, oa = ro - pa;
  float baba = dot(ba, ba), bard = dot(ba, rd), baoa = dot(ba, oa), rdoa = dot(rd, oa), oaoa = dot(oa, oa);
  float qa = baba - bard * bard, qb = baba * rdoa - baoa * bard, qc = baba * oaoa - baoa * baoa - r * r * baba;
  float h = qb * qb - qa * qc;
  if (h >= 0.0) {
    float t = (-qb - sqrt(h)) / qa;
    float y = baoa + t * bard;
    if (y > 0.0 && y < baba) return t;
    vec3 oc = (y <= 0.0) ? oa : ro - pb;
    qb = dot(rd, oc);
    qc = dot(oc, oc) - r * r;
    h = qb * qb - qc;
    if (h > 0.0) return -qb - sqrt(h);
  }
  return -1.0;
}
vec3 capsuleNormal(vec3 p, float a, float r) {
  float s = clamp(p.x, -a, a);
  return (p - vec3(s, 0.0, 0.0)) / r;
}

// A worn edge: within bw (uBevel, at most the piece's thickness) of the outline a face's normal leans out towards the nearest edge, as on a quarter round
// (slope s / sqrt(1 - s²) at s = how far into the bevel).
// Cut crystal instead: a flat chamfer (one slope all across it), so its facets flash as whole bands.
vec3 bevelN(vec3 n, vec2 p, vec2 v[12], int nv, bool cut, float bw) {
  float best = BIG;
  vec2 bn = vec2(0.0);
  for (int k = 0; k < 12; k++) {
    if (k >= nv) break;
    vec2 e = v[(k + 1) % nv] - v[k];
    vec2 n2 = normalize(vec2(e.y, -e.x));
    float d = dot(n2, v[k] - p);
    if (d < best) { best = d; bn = n2; }
  }
  if (cut) return best < max(bw, 0.25) * 1.3 ? normalize(n + vec3(bn * 0.85, 0.0)) : n;
  float s = 1.0 - clamp(best / max(bw, 1e-3), 0.0, 1.0);
  float sl = s / sqrt(max(1.0 - s * s, 0.02));
  return normalize(n + vec3(bn * sl, 0.0));
}

// Intersect body b: entry tn (may be < 0 when starting inside), exit tf, outward normals at both (world).
bool hitBody(int b, vec3 ro, vec3 rd, out float tn, out float tf, out vec3 nn, out vec3 nf) {
  vec4 t0 = T(b, 0);
  vec3 p = t0.xyz;
  int kind = int(t0.w + 0.5);
  float bound = T(b, 4).w;
  // Bounding sphere first.
  vec3 oc = ro - p;
  float bb = dot(oc, rd), cc = dot(oc, oc) - bound * bound;
  if (cc > 0.0 && bb > 0.0) return false;
  if (bb * bb - cc < 0.0) return false;
  mat3 M = bodyMat(b);
  mat3 Mt = transpose(M);
  vec3 lo = Mt * oc, ld = Mt * rd;
  float a = T(b, 1).w, th = T(b, 2).w;
  if (kind == 1) {
    float b2 = dot(lo, ld), c2 = dot(lo, lo) - a * a, h = b2 * b2 - c2;
    if (h < 0.0) return false;
    h = sqrt(h);
    tn = -b2 - h;
    tf = -b2 + h;
    if (tf < 1e-4) return false;
    nn = M * normalize(lo + ld * tn);
    nf = M * normalize(lo + ld * tf);
    return true;
  }
  if (kind == 2) {
    float te = capsule(lo, ld, a, th);
    if (te < 0.0) {
      // Starting inside: the far side, found from beyond it looking back.
      float far = 2.0 * (a + th) + 1.0;
      float tb = capsule(lo + ld * far, -ld, a, th);
      if (tb < 0.0) return false;
      tn = -1.0;
      tf = far - tb;
      nn = vec3(0.0);
      nf = M * capsuleNormal(lo + ld * tf, a, th);
      return true;
    }
    float far = 2.0 * (a + th) + 1.0;
    float tb = capsule(lo + ld * (te + far), -ld, a, th);
    tn = te;
    tf = te + far - max(tb, 0.0);
    nn = M * capsuleNormal(lo + ld * te, a, th);
    nf = M * capsuleNormal(lo + ld * tf, a, th);
    return true;
  }
  // A polygon prism: slabs for the two faces and every edge.
  float t0n = -BIG, t0f = BIG;
  vec3 n0 = vec3(0.0), n1 = vec3(0.0);
  // Faces z = +/- th/2.
  float hz = th * 0.5;
  if (abs(ld.z) < 1e-6) {
    if (abs(lo.z) > hz) return false;
  } else {
    float ta = (hz - lo.z) / ld.z, tb2 = (-hz - lo.z) / ld.z;
    if (ta < tb2) { t0n = ta; n0 = vec3(0.0, 0.0, 1.0); t0f = tb2; n1 = vec3(0.0, 0.0, -1.0); }
    else { t0n = tb2; n0 = vec3(0.0, 0.0, -1.0); t0f = ta; n1 = vec3(0.0, 0.0, 1.0); }
  }
  int nv = int(T(b, 3).w + 0.5);
  vec2 v[12];
  for (int k = 0; k < 6; k++) {
    if (k * 2 >= nv) break;
    vec4 q = T(b, 6 + k);
    v[k * 2] = q.xy;
    v[k * 2 + 1] = q.zw;
  }
  for (int k = 0; k < 12; k++) {
    if (k >= nv) break;
    vec2 va = v[k], vb = v[(k + 1) % nv];
    vec2 e = vb - va;
    vec2 n2 = normalize(vec2(e.y, -e.x));
    float d = dot(n2, va);
    float den = dot(n2, ld.xy);
    float dist = d - dot(n2, lo.xy);
    if (abs(den) < 1e-6) {
      if (dist < 0.0) return false;
      continue;
    }
    float t = dist / den;
    if (den < 0.0) { if (t > t0n) { t0n = t; n0 = vec3(n2, 0.0); } }
    else { if (t < t0f) { t0f = t; n1 = vec3(n2, 0.0); } }
  }
  if (t0n > t0f || t0f < 1e-4) return false;
  // Glass shards have worn edges (glitter foil is cut clean).
  bool cut = (int(T(b, 5).w + 0.5) & 8) != 0;
  if (kind == 0 && (uBevel > 0.001 || cut)) {
    float bw = min(uBevel, th);
    if (n0.z != 0.0) n0 = bevelN(n0, (lo + ld * t0n).xy, v, nv, cut, bw);
    if (n1.z != 0.0) n1 = bevelN(n1, (lo + ld * t0f).xy, v, nv, cut, bw);
  }
  tn = t0n;
  tf = t0f;
  nn = M * n0;
  nf = M * n1;
  return true;
}

// The frosted backlight behind the drum (z = 0): brightest where the lamp behind it shines through (uBackShift, which
// the cursor moves), darker towards the rim.
vec3 backlight(vec2 xy) {
  float r = length(xy) / uCellR;
  float rs = length(xy - uBackShift) / uCellR;
  vec3 c = mix(uBackC, uBackE, smoothstep(0.0, 1.0, rs));
  return c * 1.2 * mix(1.02, 0.78 + 0.5 * exp(-2.2 * rs * rs), uVignette) * (1.0 - smoothstep(0.96, 1.02, r) * 0.9);
}
// What a ray leaving the pieces sees: towards the back the backlight; towards the eye the dim room and its lamps —
// the main one (uLight, which the cursor nudges) and five smaller ones round it at their own angles, all turning with
// it. They are discs a few degrees across, not points: a tilted face or a rounded edge catches one as a patch, which
// is what makes a real object cell flash as it moves. None is near the axis, so flat-lying faces stay unlit.
vec3 env(vec3 p, vec3 d) {
  if (d.z < -0.05) {
    float t = -p.z / d.z;
    return backlight(p.xy + d.xy * t);
  }
  vec3 c = vec3(0.1, 0.095, 0.11);
  float az0 = atan(uLight.y, uLight.x);
  for (int i = 0; i < 6; i++) {
    vec3 L = uLight;
    float r = 0.9935;
    vec3 tint = vec3(1.0, 0.94, 0.84) * 40.0;
    if (i > 0) {
      float fi = float(i);
      float az = az0 + fi * 1.2566 + 0.35;
      float tilt = 0.36 + 0.13 * mod(fi * 2.0, 5.0);
      L = vec3(cos(az) * sin(tilt), sin(az) * sin(tilt), cos(tilt));
      r = 0.9965;
      tint = (i % 2 == 0 ? vec3(1.0, 0.95, 0.88) : vec3(0.86, 0.93, 1.0)) * 18.0;
    }
    float l = dot(d, L);
    c += tint * uSparkle * (smoothstep(r - 0.002, r + 0.001, l) + pow(max(l, 0.0), 40.0) * 0.04);
  }
  return c;
}
float schlick(float c, float ior) {
  float r0 = (ior - 1.0) / (ior + 1.0);
  r0 *= r0;
  return r0 + (1.0 - r0) * pow(1.0 - clamp(c, 0.0, 1.0), 5.0);
}

// Rough glass: its surface is a fine grain (0.05 mm, fixed to the piece), each grain tilted its own way, as much as the
// piece is rough (texel 13); the refined still picture averages them into a soft, milky scatter, glints into a sheen.
vec3 frostN(vec3 n, vec3 hp, int b) {
  float rough = T(b, 13).x;
  vec2 lp = (transpose(bodyMat(b)) * (hp - T(b, 0).xyz)).xy;
  // New grain every refinement sample (uSeed), so the average is the smooth scatter, not one frozen pattern.
  ivec2 cell = ivec2(floor(lp / 0.05));
  vec2 h = hashI(cell, b * 7919 + uSeed * 104729);
  vec2 h2 = hashI(cell, b * 7919 + uSeed * 104729 + 1);
  return normalize(n + vec3(h.x, h.y, h2.x) * 0.7 * rough);
}

// One ray through the drum, glass of index ior.
vec3 trace(vec3 ro, vec3 rd, float ior) {
  vec3 thr = vec3(1.0);
  vec3 col = vec3(0.0);
  int inside = -1;
  for (int ev = 0; ev < 10; ev++) {
    if (max(thr.r, max(thr.g, thr.b)) < 0.004) return col;
    if (inside >= 0) {
      float tn, tf; vec3 nn, nf;
      if (!hitBody(inside, ro, rd, tn, tf, nn, nf)) { inside = -1; continue; }
      vec3 c = T(inside, 4).xyz;
      vec4 t9 = T(inside, 12);
      float clear = t9.w;
      // Beer–Lambert over the path inside: the piece's colour is what its usual path lets through (a shard's
      // thickness, a bead's or a bugle bead's diameter), so tilted and overlapping glass comes out deeper.
      int ik = int(T(inside, 0).w + 0.5);
      float ref = ik == 1 ? 2.0 * T(inside, 1).w : ik == 2 ? 2.0 * T(inside, 2).w : 1.6 * T(inside, 2).w;
      vec3 sigma = -log(max(c, vec3(0.03))) / ref * clear;
      vec4 t5 = T(inside, 5);
      int ifl = int(t5.w + 0.5);
      if ((ifl & 1) != 0) {
        float cosv = abs(dot(rd, nf));
        sigma = mix(-log(max(t5.xyz, vec3(0.03))) / ref * clear, sigma, smoothstep(0.35, 0.85, cosv));
      }
      thr *= exp(-sigma * max(tf, 0.0));
      vec3 hp = ro + rd * tf;
      if ((ifl & 4) != 0) {
        nf = frostN(nf, hp, inside);
        if (dot(nf, rd) < 0.0) nf = normalize(nf - rd * 2.0 * dot(nf, rd));
      }
      vec3 rt = refract(rd, -nf, ior);
      if (dot(rt, rt) < 1e-6) {
        rd = reflect(rd, -nf);
        ro = hp - nf * 1e-3;
      } else {
        float F = schlick(dot(rd, nf), ior);
        thr *= 1.0 - F;
        rd = rt;
        ro = hp + nf * 1e-3;
        inside = -1;
      }
      continue;
    }
    // The nearest piece along the ray.
    float best = BIG;
    int hitB = -1;
    vec3 hn = vec3(0.0);
    for (int b = 0; b < 200; b++) {
      if (b >= uCount) break;
      float tn, tf; vec3 nn, nf;
      if (hitBody(b, ro, rd, tn, tf, nn, nf) && tn > 1e-4 && tn < best) {
        best = tn;
        hitB = b;
        hn = nn;
      }
    }
    if (hitB < 0) return col + thr * env(ro, rd);
    vec3 hp = ro + rd * best;
    vec3 n = normalize(hn);
    if (dot(n, rd) > 0.0) n = -n;
    int kind = int(T(hitB, 0).w + 0.5);
    vec4 t4 = T(hitB, 4);
    vec4 t5 = T(hitB, 5);
    vec4 t9 = T(hitB, 12);
    int flags = int(t5.w + 0.5);
    float metal = t9.z;
    bool pearl = (flags & 2) != 0;
    bool isMetal = (kind == 3) || (kind == 2 && metal > 0.5);
    if (isMetal) {
      // Glitter: the facet sits a little off the face, so each flake flashes at its own angle, and the hammered
      // foil's tiny facets each lean their own way on top of that.
      vec3 fn = n;
      if (kind == 3) {
        mat3 M = bodyMat(hitB);
        vec2 lp = (transpose(M) * (hp - T(hitB, 0).xyz)).xy;
        vec2 micro = hashI(ivec2(floor(lp / 0.14)), hitB * 17) * 0.14;
        fn = normalize(n + M * vec3(t9.x + micro.x, t9.y + micro.y, 0.0) * sign(dot(n, M * vec3(0.0, 0.0, 1.0))));
      }
      vec3 tint = t4.xyz;
      if (kind == 3 && metal > 1.5 && metal < 2.5) {
        // Holographic foil: the hue goes with the facet's own tilt, so it changes when the flake turns, not the lamp.
        float h = fract(dot(fn.xy, vec2(1.3, 2.1)) + t9.x * 2.0 + t9.y);
        tint = 0.5 + 0.5 * cos(6.2831 * (h + vec3(0.0, 0.33, 0.67)));
      }
      return col + thr * tint * (env(hp, reflect(rd, fn)) * 0.95 + 0.05);
    }
    if (pearl) {
      // Nacre: lit from the lamp's side, dimmer round the rim, a faint rosy-green play, the lamps' small glints.
      if (kind == 0) {
        // A shell: ribs fanning out from its hinge (the first corner), and growth lines round it.
        mat3 M = bodyMat(hitB);
        vec2 d = (transpose(M) * (hp - T(hitB, 0).xyz)).xy - T(hitB, 6).xy;
        float ang = atan(d.y, d.x);
        float rib = sin(ang * 26.0);
        vec2 across = vec2(-sin(ang), cos(ang));
        vec3 fz = M * vec3(0.0, 0.0, 1.0);
        n = normalize(n + M * vec3(across * rib * 0.35, 0.0) * sign(dot(n, fz)));
        t4.xyz *= 0.9 + 0.1 * sin(length(d) * 9.0);
      }
      float l = max(dot(n, uLight), 0.0);
      float facing = -dot(rd, n);
      vec3 nacre = mix(vec3(1.0, 0.93, 0.95), vec3(0.93, 1.0, 0.97), 0.5 + 0.5 * sin(facing * 9.0));
      vec3 base = t4.xyz * nacre * (0.14 + 0.42 * l) * (0.55 + 0.45 * facing) + backlight(hp.xy) * 0.08;
      return col + thr * (base + env(hp, reflect(rd, n)) * 0.07);
    }
    // Glass: a glint off the surface, the rest goes in.
    if ((flags & 4) != 0) {
      // Rough: the grain, and the light it scatters back milky.
      n = frostN(n, hp, hitB);
      if (dot(n, rd) > 0.0) n = normalize(n - rd * 2.0 * dot(n, rd));
      float rough = T(hitB, 13).x;
      // Milky white on sand-blasted glass, its own colour on a satin one.
      col += thr * 0.2 * rough * mix(t4.xyz, vec3(1.0), 0.15 + 0.45 * rough) * backlight(hp.xy);
      thr *= 1.0 - 0.18 * rough;
    }
    float F = schlick(-dot(rd, n), ior);
    vec3 refl = env(hp, reflect(rd, n));
    if ((flags & 1) != 0) refl *= mix(vec3(1.0), t5.xyz * 1.6, 0.7);
    col += thr * F * refl;
    thr *= 1.0 - F;
    rd = refract(rd, n, 1.0 / ior);
    ro = hp - n * 1e-3;
    inside = hitB;
  }
  return col + thr * backlight(ro.xy) * 0.5;
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y) + uJitter;
  vec2 uv = (px / uDpr - uG) / uK;
  // View frame → cell frame (the drum's turn).
  vec2 xy = vec2(uRot.x * uv.x + uRot.y * uv.y, -uRot.y * uv.x + uRot.x * uv.y);
  vec2 tilt = vec2(uRot.x * uTilt.x + uRot.y * uTilt.y, -uRot.y * uTilt.x + uRot.x * uTilt.y);
  vec3 rd = normalize(vec3(tilt, -1.0));
  vec3 ro = vec3(xy, uDepth * 0.5) - rd * ((uDepth * 0.5 + 1.0) / -rd.z);
  vec3 col = vec3(0.0);
  int nch = uDispersion > 0.001 ? 3 : 1;
  for (int c = 0; c < 3; c++) {
    if (c >= nch) break;
    // Red bends least, blue most.
    float ior = nch == 1 ? IOR : IOR + (float(c) - 1.0) * 0.004 * uDispersion;
    vec3 r = trace(ro, rd, ior);
    if (nch == 1) col = r;
    else if (c == 0) col.r = r.r;
    else if (c == 1) col.g = r.g;
    else col.b = r.b;
  }
  col *= uExposure;
  const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
  float L = dot(col, LUMA);
  col = max(vec3(L) + (col - vec3(L)) * uSaturation, 0.0);
  if (uLinearOut) {
    outColor = vec4(col, 1.0);
    outHot = vec4(0.0);
    return;
  }
  L = dot(col, LUMA);
  // Far brighter than the backlight (the lamp's glints): into the glow.
  float thr = 2.2 * uExposure;
  vec3 hot = col * max(L - thr, 0.0) / max(L, 1e-4);
  outHot = vec4(1.0 - exp(-hot * 0.35), 1.0);
  outColor = vec4(pow(1.0 - exp(-col), vec3(1.0 / 2.2)), 1.0);
}`;

/** The averaged radiance (float accumulation) tone-mapped, and its hot part for the glow — as TRACE does without it. */
const RESOLVE = `#version 300 es
precision highp float;
uniform sampler2D uAccum;
uniform float uExposure;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outHot;
void main() {
  vec3 col = texelFetch(uAccum, ivec2(gl_FragCoord.xy), 0).rgb;
  float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float thr = 2.2 * uExposure;
  vec3 hot = col * max(L - thr, 0.0) / max(L, 1e-4);
  outHot = vec4(1.0 - exp(-hot * 0.35), 1.0);
  outColor = vec4(pow(1.0 - exp(-col), vec3(1.0 / 2.2)), 1.0);
}`;

/**
 * HDR: what is far brighter than the backlight (the glints, as RESOLVE's hot part but linear and unbounded), at half
 * size (a 2×2 box) — the light the glints throw on the glass round them (blurred, then used by COMPOSE).
 */
const SPILL = `#version 300 es
precision highp float;
uniform sampler2D uAccum;
uniform float uExposure;
out vec4 o;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy) * 2;
  ivec2 last = textureSize(uAccum, 0) - 1;
  vec3 e = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    vec3 col = max(texelFetch(uAccum, min(p + ivec2(i & 1, i >> 1), last), 0).rgb, 0.0);
    float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
    e += col * max(L - 2.2 * uExposure, 0.0) / max(L, 1e-4);
  }
  o = vec4(e * 0.25, 1.0);
}`;

/** A separable 9-tap Gaussian along uStep (in the source's uv). */
const BLUR = `#version 300 es
precision mediump float;
uniform sampler2D uSrc;
uniform vec2 uStep;
uniform vec2 uOut;
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

/**
 * The picture plus the glow and the six-ray stars (from the lightly blurred hot image).
 *
 * HDR (uHdr = the monitor's peak, uHdrWhite = the picture's white, both in multiples of SDR white; uHdr 0 for SDR;
 * uHdrGlints = how strongly highlights rise): the colour is taken straight from the float average (linear, before any
 * curve — no 8-bit step, so dark gradients stay smooth), per channel:
 *   - the SDR curve 1 − e^(−x), as in SDR: shadows, midtones, the light table as they were;
 *   - plus, for what is brighter than the light table (x above 4.5), a rise with the logarithm of the scene's own
 *     radiance — as the eye judges brightness — starting smoothly (t² / (1 + t): no kink, no band at the onset); so how
 *     bright a glint is depends on the scene, not on the monitor;
 *   - times the white; and only in the top quarter below the monitor's peak rolled off towards it: the calibration
 *     keeps glints within the monitor, it does not make them brighter.
 * (First versions stretched the SDR curve's shoulder up to the peak: raising the peak raised every glint — the owner
 * found it unnatural, glints harsh and the rest dull.) Per channel, so a very bright coloured glint whitens as it nears the
 * peak, as real light does. Then HDR's own saturation (uHdrSat) round the luminance, and written with the exact sRGB
 * curve (piecewise, extended above 1): that is how Chrome reads a float canvas, so the light is what the SDR curve meant,
 * as a gamma-2.2 monitor shows it in SDR. (Encoding with gamma 2.2 instead, as the SDR path does, lifted the darks
 * several times over under the sRGB curve: the colours looked pale.) The glow and the stars get their own HDR strength
 * (uHdrBloom): there the glints show their brightness themselves. The SDR path (uHdr 0) is exactly as it was.
 *
 * And in HDR the glints light the glass round them (uHdrSpill): the tracer's glints only mirror the virtual lamps, the
 * panes next to a blazing one stayed as they were — in SDR the glow hid it, in HDR they looked dull. The glints' own
 * light (SPILL, blurred wide, in floats) falls on each pixel's colour as it is without its own glint (the glass's
 * transmittance under the backlight, so a pane lights up in its own colour, as light scattered in glass does, not as
 * a white haze), softly bounded; the glint itself is not made brighter.
 */
const COMPOSE = `#version 300 es
precision highp float;
uniform sampler2D uColor;
uniform sampler2D uSmall;
uniform sampler2D uWide;
uniform sampler2D uAccum;
uniform vec2 uSize;
uniform float uGlow;
uniform float uStars;
uniform float uStarStep;
uniform float uHdr;
uniform float uHdrWhite;
uniform float uHdrGlints;
uniform float uHdrSat;
uniform float uHdrBloom;
uniform float uHdrSpill;
uniform float uExposure;
uniform sampler2D uSpill;
out vec4 o;
vec3 srgbEnc(vec3 y) {
  return mix(12.92 * y, 1.055 * pow(y, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), y));
}
vec3 hdrTone(vec3 x) {
  const float XW = 4.5;
  vec3 t = max(x - XW, 0.0) / XW;
  vec3 y = uHdrWhite * (1.0 - exp(-x) + uHdrGlints * log2(1.0 + t * t / (1.0 + t)));
  float a = 0.75 * uHdr;
  vec3 soft = a + (uHdr - a) * (1.0 - exp(-(y - a) / max(uHdr - a, 1e-3)));
  return mix(y, soft, step(vec3(a), y));
}
void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  vec3 c;
  if (uHdr > 1.0) {
    vec3 x = max(texture(uAccum, uv).rgb, 0.0);
    if (uHdrSpill > 0.0) {
      // The glints' light on the glass here: the light (in backlights) times the colour without its own glint.
      float back = 1.2 * uExposure;
      float L = dot(x, vec3(0.2126, 0.7152, 0.0722));
      vec3 base = x * min(1.0, 2.2 * uExposure / max(L, 1e-4));
      vec3 s = texture(uSpill, uv).rgb / back;
      x += uHdrSpill * base * s / (1.0 + 0.25 * s);
    }
    vec3 yv = hdrTone(x);
    // HDR's own saturation, round the luminance.
    float ly = dot(yv, vec3(0.2126, 0.7152, 0.0722));
    yv = max(vec3(ly) + (yv - vec3(ly)) * uHdrSat, 0.0);
    c = srgbEnc(yv);
  } else {
    c = texture(uColor, uv).rgb;
  }
  // The glow and the stars as bright as the picture's white; in HDR weaker (they stand in for brightness a screen
  // cannot show, and in HDR the glints themselves show it).
  float glowK = uHdr > 1.0 ? pow(uHdrWhite, 1.0 / 2.2) * uHdrBloom : 1.0;
  if (uGlow > 0.0) c += texture(uWide, uv).rgb * uGlow * glowK;
  if (uStars > 0.0) {
    vec3 s = vec3(0.0);
    for (int a = 0; a < 3; a++) {
      float ang = float(a) * 1.0471976;
      vec2 dir = vec2(cos(ang), sin(ang)) * uStarStep / uSize;
      for (int i = 1; i <= 10; i++) {
        float w = 1.0 - float(i) / 11.0;
        w *= w;
        s += (texture(uSmall, uv + dir * float(i)).rgb + texture(uSmall, uv - dir * float(i)).rgb) * w;
      }
    }
    c += s * uStars * 0.35 * glowK;
  }
  o = vec4(c, 1.0);
}`;

const lin = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((v) => Math.pow(v, 2.2)) as [number, number, number];
};

export function createGlassTracer(width: number, height: number, backCenter: string, backEdge: string) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    return s;
  };
  const vert = shader(gl.VERTEX_SHADER, VERT);
  const program = (src: string) => {
    const p = gl.createProgram()!;
    gl.attachShader(p, vert);
    gl.attachShader(p, shader(gl.FRAGMENT_SHADER, src));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
    return p;
  };
  const trace = program(TRACE);
  const blur = program(BLUR);
  const compose = program(COMPOSE);
  const resolve = program(RESOLVE);
  const spill = program(SPILL);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  const data = new Float32Array(TEXELS * MAX_BODIES * 4);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, TEXELS, MAX_BODIES, 0, gl.RGBA, gl.FLOAT, data);

  // Render targets: the picture and its hot part at full size, the blurs at half — in 8 bits: the glow is tuned so (in
  // half floats its faint tails survive the blurs and the halos grow into glare).
  const floatTargets = !!gl.getExtension('EXT_color_buffer_float');
  const hw = Math.max(1, Math.ceil(width / 2));
  const hh = Math.max(1, Math.ceil(height / 2));
  const target = (w: number, h: number) => {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return t;
  };
  const texColor = target(width, height);
  const texHot = target(width, height);
  const halfA = target(hw, hh);
  const halfB = target(hw, hh);
  const halfC = target(hw, hh);
  const fbo = (...texs: WebGLTexture[]) => {
    const f = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    texs.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0));
    gl.drawBuffers(texs.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
    return f;
  };
  const fbTrace = fbo(texColor, texHot);
  // The refinement's running average: in half floats, before the tone curve (8 bits after it lose the small steps a
  // many-sample average is made of, and averaging tone-mapped colours dims the glints). Without float render targets,
  // straight into texColor/texHot as before.
  let accum: WebGLTexture | null = null;
  let fbAccum: WebGLFramebuffer | null = null;
  if (floatTargets) {
    accum = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, accum);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    fbAccum = fbo(accum);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteFramebuffer(fbAccum);
      gl.deleteTexture(accum);
      accum = null;
      fbAccum = null;
    }
  }
  const fbA = fbo(halfA);
  const fbB = fbo(halfB);
  const fbC = fbo(halfC);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  // HDR: the glints' light, blurred, in half floats at half size; made when first asked.
  let spillT: { a: WebGLTexture; b: WebGLTexture; fa: WebGLFramebuffer; fb: WebGLFramebuffer } | null = null;
  const spillTargets = () => {
    if (spillT) return spillT;
    const make = () => {
      const tx = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, hw, hh, 0, gl.RGBA, gl.HALF_FLOAT, null);
      return tx;
    };
    const a = make(), b = make();
    spillT = { a, b, fa: fbo(a), fb: fbo(b) };
    return spillT;
  };

  const uniforms = (p: WebGLProgram, names: string[]) => Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(p, n)]));
  const ut = uniforms(trace, ['uBodies', 'uCount', 'uSize', 'uDpr', 'uK', 'uG', 'uRot', 'uLight', 'uBackC', 'uBackE', 'uBackShift', 'uCellR', 'uDepth', 'uTilt',
    'uExposure', 'uSaturation', 'uSparkle', 'uDispersion', 'uBevel', 'uVignette', 'uJitter', 'uSeed', 'uLinearOut']);
  const ur = uniforms(resolve, ['uAccum', 'uExposure']);
  const ub = uniforms(blur, ['uSrc', 'uStep', 'uOut']);
  const uc = uniforms(compose, ['uColor', 'uSmall', 'uWide', 'uAccum', 'uSize', 'uGlow', 'uStars', 'uStarStep', 'uHdr', 'uHdrWhite', 'uHdrGlints', 'uHdrSat', 'uHdrBloom', 'uHdrSpill', 'uExposure', 'uSpill']);
  const us = uniforms(spill, ['uAccum', 'uExposure']);
  // The HDR picture: a float target, read back whole for the WebGPU canvas (kaleidoscopeHdr.ts); made when first asked.
  let hdrOut: { tex: WebGLTexture; fb: WebGLFramebuffer; buf: Float32Array } | null = null;
  const hdrTarget = () => {
    if (hdrOut) return hdrOut;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, null);
    const f = fbo(t);
    hdrOut = { tex: t, fb: f, buf: new Float32Array(width * height * 4) };
    return hdrOut;
  };
  gl.useProgram(trace);
  gl.uniform1i(ut.uBodies, 0);
  gl.uniform3fv(ut.uBackC, lin(backCenter));
  gl.uniform3fv(ut.uBackE, lin(backEdge));
  gl.useProgram(blur);
  gl.uniform1i(ub.uSrc, 0);
  gl.useProgram(resolve);
  gl.uniform1i(ur.uAccum, 0);
  gl.useProgram(compose);
  gl.uniform1i(uc.uColor, 0);
  gl.uniform1i(uc.uSmall, 1);
  gl.uniform1i(uc.uWide, 2);
  gl.uniform1i(uc.uAccum, 3);
  gl.uniform1i(uc.uSpill, 4);
  gl.useProgram(spill);
  gl.uniform1i(us.uAccum, 0);

  const blurPass = (src: WebGLTexture, srcW: number, srcH: number, dst: WebGLFramebuffer, dx: number, dy: number) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst);
    gl.viewport(0, 0, hw, hh);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src);
    gl.uniform2f(ub.uStep, dx / srcW, dy / srcH);
    gl.uniform2f(ub.uOut, hw, hh);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  return {
    canvas,
    /**
     * bodies: the drum's pieces (cell frame, mm); view: the drum's turn; g: the triangle's centroid on its canvas (css
     * px) where the drum's centre sits; k: px per mm; light: towards the lamp, cell frame; backShift: where the
     * backlight is brightest (mm, cell frame). sample: 0 for a new picture, n to add more sub-pixel-shifted traces of
     * the same one (with fresh grain) to the average; count: how many samples this call traces (sample, sample + 1, …).
     * hdrPeak > 1 (where float targets exist, hdrCapable): the picture in extended range for an HDR canvas, returned as
     * RGBA floats (rows bottom up) instead of drawn on this canvas; otherwise null. hdrPeak: the monitor's peak,
     * hdrWhite: the picture's white (both in multiples of SDR white), hdrGlints: how strongly highlights rise, hdrSat:
     * the saturation, hdrBloom: the glow and the stars (share of SDR), hdrSpill: the glints' light on the glass.
     */
    render(bodies: readonly GlassBody[], view: number, gx: number, gy: number, k: number, dpr: number, light: [number, number, number], backShift: [number, number], cellR: number, depth: number, reach: number, look: GlassLook, sample = 0, count = 1, hdrPeak = 0, hdrWhite = 1, hdrGlints = 0.8, hdrSat = 1, hdrBloom = 1, hdrSpill = 0, tilt: [number, number] = [0, 0]): Float32Array | null {
      let n = 0;
      for (const b of bodies) {
        if (n >= MAX_BODIES) break;
        if (Math.hypot(b.x, b.y) > reach + b.bound) continue;
        const o = n * TEXELS * 4;
        const m = b.m;
        data[o] = b.x; data[o + 1] = b.y; data[o + 2] = b.z; data[o + 3] = b.kind;
        data[o + 4] = m[0]; data[o + 5] = m[1]; data[o + 6] = m[2]; data[o + 7] = b.a;
        data[o + 8] = m[3]; data[o + 9] = m[4]; data[o + 10] = m[5]; data[o + 11] = b.t;
        data[o + 12] = m[6]; data[o + 13] = m[7]; data[o + 14] = m[8]; data[o + 15] = b.poly.length / 2;
        const c = b.col;
        data[o + 16] = Math.pow(c[0] / 255, 2.2); data[o + 17] = Math.pow(c[1] / 255, 2.2); data[o + 18] = Math.pow(c[2] / 255, 2.2);
        data[o + 19] = b.kind === 2 ? b.a + b.t : b.bound;
        const c2 = b.col2 ?? c;
        data[o + 20] = Math.pow(c2[0] / 255, 2.2); data[o + 21] = Math.pow(c2[1] / 255, 2.2); data[o + 22] = Math.pow(c2[2] / 255, 2.2);
        // Flags: 1 dichroic, 2 pearl (nacre), 4 rough (how rough: texel 11), 8 cut crystal.
        data[o + 23] = (b.col2 ? 1 : 0) | (b.pearl ? 2 : 0) | (b.rough > 0.01 ? 4 : 0) | (b.cut ? 8 : 0);
        for (let v = 0; v < 24; v += 1) data[o + 24 + v] = b.poly[v] ?? 0;
        // Clear glass (the pale shards) absorbs less.
        data[o + 48] = b.fx; data[o + 49] = b.fy; data[o + 50] = b.metal; data[o + 51] = b.alpha < 0.6 ? 0.35 : 1;
        data[o + 52] = b.rough;
        n += 1;
      }
      const W = canvas.width, H = canvas.height;
      // 1. The trace, into the picture and its hot part.
      gl.useProgram(trace);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbAccum ?? fbTrace);
      gl.viewport(0, 0, W, H);
      gl.uniform1i(ut.uLinearOut, fbAccum ? 1 : 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, TEXELS, Math.max(1, n), gl.RGBA, gl.FLOAT, data.subarray(0, Math.max(1, n) * TEXELS * 4));
      gl.uniform1i(ut.uCount, n);
      gl.uniform2f(ut.uSize, W, H);
      gl.uniform1f(ut.uDpr, dpr);
      gl.uniform1f(ut.uK, k);
      gl.uniform2f(ut.uG, gx, gy);
      gl.uniform2f(ut.uRot, Math.cos(view), Math.sin(view));
      gl.uniform3f(ut.uLight, light[0], light[1], light[2]);
      gl.uniform2f(ut.uBackShift, backShift[0], backShift[1]);
      gl.uniform1f(ut.uCellR, cellR);
      gl.uniform1f(ut.uDepth, depth);
      gl.uniform2f(ut.uTilt, tilt[0], tilt[1]);
      gl.uniform1f(ut.uExposure, look.exposure);
      gl.uniform1f(ut.uSaturation, look.saturation);
      gl.uniform1f(ut.uSparkle, look.sparkle);
      gl.uniform1f(ut.uDispersion, look.dispersion);
      gl.uniform1f(ut.uBevel, look.bevel);
      gl.uniform1f(ut.uVignette, look.vignette);
      for (let i = 0; i < Math.max(1, count); i += 1) {
        const s = sample + i;
        // The R2 sequence of sub-pixel shifts; blended in as a running average (weight 1 / (s + 1)).
        gl.uniform2f(ut.uJitter, s ? ((0.5 + s * 0.7548777) % 1) - 0.5 : 0, s ? ((0.5 + s * 0.5698403) % 1) - 0.5 : 0);
        gl.uniform1i(ut.uSeed, s);
        if (s) {
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA);
          gl.blendColor(0, 0, 0, 1 / (s + 1));
        }
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.disable(gl.BLEND);
      }
      if (accum) {
        // The average, tone-mapped, and its hot part.
        gl.useProgram(resolve);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbTrace);
        gl.bindTexture(gl.TEXTURE_2D, accum);
        gl.uniform1f(ur.uExposure, look.exposure);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      // 2. The hot part blurred a little (for the stars), then a lot (the glow), at half size.
      const glow = look.glow > 0.001, stars = look.stars > 0.001;
      if (glow || stars) {
        gl.useProgram(blur);
        blurPass(texHot, W, H, fbA, dpr, 0);
        blurPass(halfA, hw, hh, fbB, 0, 0.5 * dpr);
        if (glow) {
          blurPass(halfB, hw, hh, fbA, 2 * dpr, 0);
          blurPass(halfA, hw, hh, fbC, 0, 2 * dpr);
        }
      }
      // 3. Everything together, onto the canvas (or, HDR, into the float target that is read back).
      const hdr = hdrPeak > 1 && accum ? hdrTarget() : null;
      // HDR: the glints' light on the glass round them, blurred wide (σ ≈ 15 css px).
      const sp = hdr && hdrSpill > 0.001 ? spillTargets() : null;
      if (sp) {
        gl.useProgram(spill);
        gl.bindFramebuffer(gl.FRAMEBUFFER, sp.fa);
        gl.viewport(0, 0, hw, hh);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, accum);
        gl.uniform1f(us.uExposure, look.exposure);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.useProgram(blur);
        blurPass(sp.a, hw, hh, sp.fb, 2 * dpr, 0);
        blurPass(sp.b, hw, hh, sp.fa, 0, 2 * dpr);
        blurPass(sp.a, hw, hh, sp.fb, 4 * dpr, 0);
        blurPass(sp.b, hw, hh, sp.fa, 0, 4 * dpr);
      }
      gl.useProgram(compose);
      gl.bindFramebuffer(gl.FRAMEBUFFER, hdr ? hdr.fb : null);
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, accum);
      gl.uniform1f(uc.uHdr, hdr ? hdrPeak : 0);
      gl.uniform1f(uc.uHdrWhite, hdrWhite);
      gl.uniform1f(uc.uHdrGlints, hdrGlints);
      gl.uniform1f(uc.uHdrSat, hdrSat);
      gl.uniform1f(uc.uHdrBloom, hdrBloom);
      gl.uniform1f(uc.uHdrSpill, sp ? hdrSpill : 0);
      gl.uniform1f(uc.uExposure, look.exposure);
      gl.activeTexture(gl.TEXTURE4);
      gl.bindTexture(gl.TEXTURE_2D, sp ? sp.a : null);
      gl.viewport(0, 0, W, H);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texColor);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, halfB);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, halfC);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform2f(uc.uSize, W, H);
      gl.uniform1f(uc.uGlow, glow ? look.glow : 0);
      gl.uniform1f(uc.uStars, stars ? look.stars : 0);
      gl.uniform1f(uc.uStarStep, 1.6 * dpr);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!hdr) return null;
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.FLOAT, hdr.buf);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return hdr.buf;
    },
    /** Whether render can give an HDR picture (float render targets). */
    get hdrCapable() {
      return !!accum;
    },
    dispose() {
      for (const t of [tex, texColor, texHot, halfA, halfB, halfC, accum, hdrOut?.tex ?? null, spillT?.a ?? null, spillT?.b ?? null]) gl.deleteTexture(t);
      for (const f of [fbTrace, fbA, fbB, fbC, fbAccum, hdrOut?.fb ?? null, spillT?.fa ?? null, spillT?.fb ?? null]) gl.deleteFramebuffer(f);
      gl.deleteBuffer(buf);
      gl.deleteVertexArray(vao);
      for (const p of [trace, blur, compose, resolve, spill]) gl.deleteProgram(p);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}

export type GlassTracer = NonNullable<ReturnType<typeof createGlassTracer>>;
