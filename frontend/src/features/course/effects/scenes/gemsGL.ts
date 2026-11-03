import { cutPlanes, outlineSamples, METAL_COLORS, type Gem } from './gemsData';
import { GEM_GEOMETRY_GLSL } from './gemsGeometryGL';
import { GEM_PATH_GLSL } from './gemsPathGL';
import { GEM_SAMPLING_GLSL } from './gemsSampling';
import { GEM_DENOISE_GLSL } from './gemsDenoiseGL';
import { GEM_FAST_GLSL } from './gemsFastGL';
import { createGemCaustics } from './gemsCaustics';
import { createGemRefinement, gemTraceTiles, GEM_TRACE_SAMPLES } from './gemsRefinement';
import { createProgressiveProgram } from './progressiveProgram';

/**
 * The gems scene (WebGL2): interactive preview; optional 64 tiled path-traced samples at rest.
 * Completed images are retained; no scene/bloom/compose passes run until the scene changes again.
 *
 * The screen is a honeycomb (flat-topped hexagons, as the kaleidoscope's eyepieces): in each cell the same gem seen
 * from above on its backing, turned by a little or not at all; the lamp is a point light over the screen at the
 * cursor, so every cell sees it from its own side and the glints run across the cells as the cursor moves.
 *
 * A faceted gem is a convex polyhedron (gemsData.ts: the planes of its facets). Each pixel's ray comes straight down
 * (an orthographic view), enters through the facet it meets last of the planes it crosses going in, and is followed
 * inside: to the facet it leaves by (the nearest plane ahead), total internal reflection there or a split by Fresnel —
 * what leaves carries what it sees out there (the studio's two softboxes, the dark room, the viewer's own head right
 * above the stone, the lamp, or the backing under the stone), bent by the colour's own index (the stone's dispersion:
 * the fire), what stays goes on; absorbed on the way by the body's colour (Beer–Lambert). At most two reflections. Silk (fine
 * needles) gives a soft sheen, an emerald's jardin clouds it, a ruby glows red under the lamp; alexandrite changes its
 * colour with the lamp's warmth.
 *
 * An opal is a cabochon (a dome, analytic): its play of colour is diffraction from domains of silica spheres — each
 * domain (a warped Voronoi cell) a little grating with its own tilt and spacing; it flashes the colour λ = λ₀·cos θ
 * (Bragg; θ between the domain's normal and the half vector of the refracted light and view) when the light is near
 * its angle, so the colours run over the stone as the lamp moves. Black, white, boulder (veins in ironstone) and fire
 * opal (transparent orange) differ in their body and how strong the play is.
 *
 * The backings: a fabric (velvet with its sheen at the folds, silk and satin with a streak of shine along them), the
 * gem's mother rock (eleven kinds, with mica sparkle, druse crystals), or a metal setting (prongs and a rim; a bezel for
 * cabochons) on its fabric. The fast preview uses the original soft projected shadow / contact shading.
 * At rest, secondary rays trace the backing, dielectric surfaces and simplified 3D metal settings (gemsPathGL.ts).
 * Material albedo/normal/roughness is baked once, NOT illumination. The path tracer never uses the preview's shadow
 * or its artistic focused-light approximation: its shadow rays intersect real facets / the closed dome.
 * Fast optics use three deterministic RGB paths with exact dielectric Fresnel and at most two internal reflections.
 * Direct and refracted floor hits share cached material and lighting, with analytic native-resolution microdetail.
 * A bounded forward photon pass bakes RGB caustics separately from the native-resolution scene image.
 * The decorative cell border, optical bloom and opal's microscopic colour model remain artistic approximations.
 */

export type GemLook = {
  /** The lamp: css px over the canvas, its height (css px), intensity, warmth (0 daylight … 1 incandescent). */
  lamp: [number, number, number];
  lampI: number;
  warm: number;
  studio: number;
  /** Cells: radius (css px); how much each cell's gem is turned (0 all alike … 1 any angle). */
  cellR: number;
  spin: number;
  /** 0 fabric, 1 rock, 2 setting. */
  backing: number;
  /** More fire than nature gives (1 as is). */
  fire: number;
  glow: number;
  stars: number;
  exposure: number;
  time: number;
  /** The camera (orbitControl.ts): turn and tilt from straight above (radians), closer (×). */
  cam?: [number, number, number];
  /** Ray traced: spectral, stochastic, accumulated while nothing moves (else the fast single pass). */
  trace?: boolean;
};

/** Ray traced: samples a still picture is refined to. */
const TRACE_SAMPLES = GEM_TRACE_SAMPLES;
/** Spectral samples are drawn uniformly over 400–700 nm: per colour, 1 / the mean of spectral() over that range, so a
 * flat spectrum comes out white. */
const SPEC_K = (() => {
  let r = 0, g = 0, b = 0, n = 0;
  for (let w = 400; w <= 700; w += 1) {
    r += Math.exp(-(((w - 605) / 42) ** 2)) + 0.3 * Math.exp(-(((w - 430) / 18) ** 2));
    g += Math.exp(-(((w - 545) / 38) ** 2));
    b += Math.exp(-(((w - 455) / 28) ** 2));
    n += 1;
  }
  return [n / r, n / g, n / b] as const;
})();

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const MAIN = `#version 300 es
precision highp float;
precision highp int;
uniform vec2 uRes;
uniform float uDpr;
uniform float uCellR;
uniform float uGemR;
uniform float uSpin;
uniform vec3 uLamp;
uniform float uLampI;
uniform float uWarm;
uniform float uStudio;
uniform float uTime;
uniform vec4 uPlanes[96];
uniform int uNPlanes;
// A zero the shader compiler cannot see through (uNPlanes is a uniform and never negative). Fixed loops written as
// "k < N + ZERO" are then kept as loops: the Windows D3D compiler (FXC, behind ANGLE) otherwise unrolls them — the
// three colour channels times every bounce times every cell side — and a first visit froze for about 9 s while the
// GPU compiled the interactive shader. Same arithmetic, same picture (2026-10-30).
#define ZERO min(uNPlanes, 0)
uniform vec4 uOutline[8];
uniform vec4 uCab;
uniform float uIor;
uniform float uDisp;
uniform vec3 uAbsorb;
uniform vec3 uAbsorbWarm;
uniform int uOpal;
uniform float uSilk;
uniform float uJardin;
uniform float uFluor;
uniform int uBacking;
uniform vec3 uFabric;
uniform int uFabricKind;
uniform int uRock;
uniform vec3 uMetal;
uniform int uProngs;
// The camera: turn, tilt from straight above (radians), closer (×). An orthographic view of the tray.
uniform vec3 uCam;
// 0 the fast single pass; 1 ray traced (one spectral, stochastic sample a pass, accumulated outside), uSample its
// number (fresh randomness), uSpecK the spectrum's normalisation.
uniform int uTrace;
uniform int uSample;
uniform vec3 uSpecK;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outHot;

const float PI = 3.14159265;
const vec3 SB1 = vec3(-0.5546, 0.4537, 0.6977);
const vec3 SB2 = vec3(0.6301, -0.5251, 0.5719);

float hash12(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
vec2 hash22(vec2 p) { vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.103, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int k = 0; k < 5 + ZERO; k++) { s += a * vnoise(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
// Voronoi: the nearest cell's id and how far its edge is.
vec2 voronoi(vec2 x, out vec2 id) {
  vec2 n = floor(x), f = fract(x);
  float d1 = 9.0, d2 = 9.0;
  id = n;
  for (int j = -1; j <= 1 + ZERO; j++) for (int i = -1; i <= 1 + ZERO; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = hash22(n + g);
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = n + g; } else if (d < d2) d2 = d;
  }
  return vec2(sqrt(d1), sqrt(d2) - sqrt(d1));
}

// --- the honeycomb ----------------------------------------------------------------------------------------------
vec2 hexCentre(vec2 p, vec2 origin, float R) {
  float px = (p.x - origin.x) / R, py = (p.y - origin.y) / R;
  float q = (2.0 / 3.0) * px;
  float r = (-1.0 / 3.0) * px + (0.57735027) * py;
  float s = -q - r;
  float rq = floor(q + 0.5), rr = floor(r + 0.5), rs = floor(s + 0.5);
  float dq = abs(rq - q), dr = abs(rr - r), ds = abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs;
  return origin + R * vec2(1.5 * rq, 1.7320508 * (rr + rq * 0.5));
}
float hexSdf(vec2 p, float R) { vec2 a = abs(p); return max(0.8660254 * a.x + 0.5 * a.y, a.y) - 0.8660254 * R; }

// --- light ------------------------------------------------------------------------------------------------------
vec3 gLampP;
vec3 gLampCol;
// Towards the eye (the gem's frame, z up): straight up unless the camera is tilted.
vec3 gV = vec3(0.0, 0.0, 1.0);
// This cell's backing: its pattern offset, its floor's height, whether the stone is a cabochon (backingAt).
vec2 gO;
float gFloorZ;
bool gDomeG;
${GEM_SAMPLING_GLSL}
float gLampSize;
// Analytic pixel footprint, valid even inside divergent refraction loops (no undefined derivatives).
float gPixelWorld=0.;
// The studio seen in a direction (the gem's frame, z up): a light tent, two softboxes, the viewer's head straight above.
vec3 env(vec3 d) {
  vec3 c = vec3(0.01, 0.01, 0.012) + vec3(0.025, 0.024, 0.026) * max(d.z, 0.0);
  // A ring of six panels round the stone, with dark gaps between them (the contrast a cut stone needs: bright and
  // dark facets side by side), a dim ceiling.
  float elev = asin(clamp(d.z, -1.0, 1.0));
  float band = smoothstep(0.3, 0.42, elev) * (1.0 - smoothstep(0.9, 1.05, elev));
  float panels = smoothstep(0.35, 0.6, 0.5 + 0.5 * cos(6.0 * atan(d.y, d.x) + 0.4));
  c += vec3(0.95, 0.95, 1.0) * uStudio * band * panels * 0.9 + vec3(0.22, 0.22, 0.24) * uStudio * smoothstep(1.0, 1.3, elev);
  float s1 = smoothstep(0.86, 0.9, dot(d, SB1));
  float s2 = smoothstep(0.89, 0.93, dot(d, SB2));
  c += (vec3(1.0, 0.96, 0.9) * s1 * 1.7 + vec3(0.88, 0.94, 1.0) * s2 * 1.1) * uStudio;
  // The camera's lens and the viewer right overhead: a small dark spot (it draws the arrows in a brilliant's table).
  return c * (1.0 - 0.8 * smoothstep(0.975, 0.993, dot(d, gV)));
}
// The lamp seen from h in direction d: a small bright disc and its soft halo.
vec3 lampSeen(vec3 d, vec3 h) {
  vec3 L = gLampP - h;
  float dist = length(L);
  L /= dist;
  float c = dot(d, L);
  float rad = gLampSize / dist;
  float pixelAngle=uTrace==0?gPixelWorld/max(dist,.1):0.;
  float filtered=sqrt(rad*rad+pixelAngle*pixelAngle);
  float disc = smoothstep(cos(filtered * 1.7), cos(filtered), c);
  // Broaden subpixel emitters while preserving their integrated intensity.
  disc*=rad*rad/max(filtered*filtered,1e-8);
  return gLampCol * (disc * 26.0 + pow(max(c, 0.0), 220.0) * 1.2);
}
// The lamp's light falling at h (inverse square, 1 right under it at its height) and its direction.
vec3 lampAt(vec3 h, out vec3 L) {
  vec3 v = gLampP - h;
  float d2 = dot(v, v);
  L = v * inversesqrt(d2);
  // Fixed emitted power: changing the lamp height must not secretly brighten the emitter.
  float referenceHeight=420.0/uGemR;
  return gLampCol * (referenceHeight * referenceHeight) / d2;
}
float fresnel(float c, float n) { float r0 = (n - 1.0) / (n + 1.0); r0 *= r0; return r0 + (1.0 - r0) * pow(1.0 - clamp(c, 0.0, 1.0), 5.0); }
float ggx(float nh, float a) { float a2 = a * a + (uTrace==0?min(.02,gPixelWorld*gPixelWorld/12.):0.); float d = nh * nh * (a2 - 1.0) + 1.0; return a2 / (PI * d * d); }

// --- the outline (32 samples) ----------------------------------------------------------------------------------------
float outlineR(float phi) {
  float u = fract(phi / (2.0 * PI)) * 32.0;
  int i0 = int(floor(u)) % 32, i1 = (i0 + 1) % 32;
  float a = uOutline[i0 / 4][i0 % 4], b = uOutline[i1 / 4][i1 % 4];
  return mix(a, b, fract(u));
}
// How far outside the outline (in girdle radii, negative inside).
float outlineDist(vec2 g) { return length(g) - outlineR(atan(g.y, g.x)); }

// --- backings ----------------------------------------------------------------------------------------------------
vec3 gBackingNormal;
float gBackingRoughness;
float fold(vec2 u) {
  return 0.35 * sin(u.x * 1.3 + 1.6 * fbm(u * 0.5)) + 0.18 * sin(u.y * 2.1 + u.x * 0.7 + 2.0 * fbm(u * 0.7 + 3.0)) + 0.05 * fbm(u * 3.0);
}
// The fabric at g (the gem's frame, cell-varied offset o): its colour lit by the lamp (light I from direction L).
vec3 fabric(vec2 g, vec2 o, vec3 I, vec3 L) {
  vec2 u = g * 0.75 + o;
  float e = 0.02;
  float h0 = fold(u);
  vec3 N = normalize(vec3(-(fold(u + vec2(e, 0.0)) - h0) / e * 0.35, -(fold(u + vec2(0.0, e)) - h0) / e * 0.35, 1.0));
  vec3 alb = uFabric * (0.92 + 0.16 * hash12(floor(g * 140.0 + o * 50.0)));
  gBackingNormal=N; gBackingRoughness=uFabricKind==0?.85:uFabricKind==1?.4:.2;
  if(uTrace==1) return alb;
  float nl = max(dot(N, L), 0.0);
  vec3 amb = vec3(0.05, 0.05, 0.06) * uStudio + 0.02;
  vec3 col = alb * (I * nl + amb);
  vec3 H = normalize(L + gV);
  if (uFabricKind == 0) {
    // Velvet: its pile catches the light where it is bent away from the eye.
    float rim = pow(1.0 - max(dot(N, gV), 0.0), 1.2) * 6.0 + pow(1.0 - max(dot(N, H), 0.0), 3.0) * 0.4;
    col += (alb * 1.6 + 0.04) * I * rim * nl;
  } else {
    // Silk and satin: a streak of shine along the folds (fibres across them).
    vec3 T = normalize(vec3(1.0, 0.3 * sin(u.y * 2.0), 0.0) - N * N.x);
    float th = sqrt(max(0.0, 1.0 - pow(dot(T, H), 2.0)));
    float sp = pow(th, uFabricKind == 2 ? 140.0 : 50.0) * (uFabricKind == 2 ? 1.6 : 0.7);
    col += mix(vec3(1.0), alb, 0.5) * I * sp * nl;
    col += alb * env(reflect(-gV, N)) * (uFabricKind == 2 ? 0.6 : 0.25);
  }
  return col;
}
// The mother rock at g: albedo, roughness, a bump, and sparkle (mica, druse faces).
vec3 rock(vec2 g, vec2 o, vec3 I, vec3 L) {
  vec2 u = g * 1.2 + o;
  float n1 = fbm(u * 1.5), n2 = fbm(u * 4.0 + 5.0), n3 = vnoise(u * 18.0);
  vec3 alb;
  float bump = 0.5, rough = 0.7, spark = 0.0;
  vec2 sid;
  vec2 vc = voronoi(u * 6.0, sid);
  if (uRock == 0) { // kimberlite: blue-grey-green, darker clasts
    alb = mix(vec3(0.18, 0.22, 0.22), vec3(0.32, 0.36, 0.34), n1) * mix(0.55, 1.0, smoothstep(0.05, 0.12, vc.y));
  } else if (uRock == 1) { // marble: white with grey veins, polished
    float vein = 1.0 - smoothstep(0.0, 0.05, abs(sin(u.x * 1.4 + u.y * 0.6 + 5.0 * n1) * 0.5));
    alb = mix(vec3(0.85, 0.84, 0.82), vec3(0.42, 0.42, 0.45), vein * 0.8) * (0.93 + 0.07 * n3);
    rough = 0.35; bump = 0.15;
  } else if (uRock == 2) { // schist: dark layers, mica glitter
    float layer = 0.5 + 0.5 * sin(u.y * 9.0 + 3.0 * n1);
    alb = mix(vec3(0.1, 0.1, 0.11), vec3(0.28, 0.27, 0.25), layer * 0.6 + n2 * 0.4);
    spark = 1.0;
  } else if (uRock == 3) { // ironstone: red-brown, ochre bands, a dull gloss
    float band = 0.5 + 0.5 * sin(u.x * 3.0 + u.y * 1.2 + 4.0 * n1);
    alb = mix(vec3(0.16, 0.07, 0.03), vec3(0.45, 0.24, 0.09), band * 0.7 + n2 * 0.3);
    rough = 0.45;
  } else if (uRock == 4) { // pegmatite: pink feldspar, white quartz, black mica
    float k = hash12(sid);
    alb = k < 0.45 ? vec3(0.72, 0.5, 0.42) : k < 0.8 ? vec3(0.85, 0.84, 0.82) : vec3(0.05, 0.05, 0.06);
    alb *= 0.85 + 0.15 * n2;
    spark = k >= 0.8 ? 1.0 : 0.3;
  } else if (uRock == 5) { // a geode's druse: small crystals, each face catching the light
    vec3 tint = exp(-uAbsorb * 0.6);
    alb = mix(vec3(0.75), tint * 0.9, 0.7) * (0.6 + 0.4 * hash12(sid));
    spark = 2.0; rough = 0.2;
  } else if (uRock == 6) { // basalt: dark, porous
    float hole = 1.0 - smoothstep(0.1, 0.16, vc.x);
    alb = vec3(0.12, 0.12, 0.13) * (0.8 + 0.4 * n2) * (1.0 - 0.7 * hole);
  } else if (uRock == 7) { // serpentinite: mottled green, dark veins
    float vein = 1.0 - smoothstep(0.0, 0.04, vc.y);
    alb = mix(vec3(0.12, 0.25, 0.15), vec3(0.32, 0.45, 0.25), n1) * (1.0 - 0.6 * vein);
    rough = 0.4;
  } else if (uRock == 8) { // sandstone: tan, fine grains, faint layers
    alb = mix(vec3(0.55, 0.42, 0.28), vec3(0.72, 0.6, 0.44), 0.5 + 0.5 * sin(u.y * 6.0 + n1 * 3.0)) * (0.85 + 0.25 * n3);
  } else if (uRock == 9) { // rhyolite: red-brown flow bands
    alb = mix(vec3(0.35, 0.12, 0.08), vec3(0.6, 0.32, 0.22), 0.5 + 0.5 * sin(u.x * 5.0 + 6.0 * n1)) * (0.85 + 0.2 * n2);
  } else { // gneiss: banded light and dark grey
    alb = mix(vec3(0.15, 0.15, 0.16), vec3(0.62, 0.6, 0.58), smoothstep(0.35, 0.65, 0.5 + 0.5 * sin(u.y * 7.0 + 5.0 * n1)));
    spark = 0.5;
  }
  // The surface: a bump from the noise (druse: each crystal a tilted face).
  vec3 N;
  if (uRock == 5) {
    vec2 tilt = (hash22(sid) - 0.5) * 1.6;
    N = normalize(vec3(tilt * (1.0 - smoothstep(0.0, 0.08, vc.y) * 0.5), 1.0));
  } else {
    float e = 0.02;
    float h0 = fbm(u * 3.0);
    N = normalize(vec3(-(fbm((u + vec2(e, 0.0)) * 3.0) - h0) / e * bump * 0.2, -(fbm((u + vec2(0.0, e)) * 3.0) - h0) / e * bump * 0.2, 1.0));
  }
  gBackingNormal=N; gBackingRoughness=rough;
  if(uTrace==1) return alb;
  float nl = max(dot(N, L), 0.0);
  vec3 col = alb * (I * nl + vec3(0.05, 0.05, 0.06) * uStudio + 0.02);
  vec3 H = normalize(L + gV);
  col += I * nl * ggx(max(dot(N, H), 0.0), rough) * 0.04;
  // Glitter: tiny flat flakes, each its own tilt; one flashes when it mirrors the lamp to the eye.
  if (spark > 0.0) {
    vec2 cell = floor(g * 90.0 + o * 30.0);
    vec2 fl = (hash22(cell) - 0.5) * 0.9;
    vec3 Nf = normalize(vec3(fl, 1.0));
    float f = pow(max(dot(Nf, H), 0.0), 900.0) * step(0.8, hash12(cell + 3.1));
    col += I * f * 6.0 * spark;
  }
  return col;
}

// --- the gem ---------------------------------------------------------------------------------------------------------
// Where the ray to the eye through g (on the girdle's plane) enters (false: it misses).
bool enterGem(vec2 g, out float tIn, out vec3 nIn) {
  vec3 o = vec3(g, 0.0) + gV * (3.0 / gV.z);
  tIn = -1e9;
  float tOut = 1e9;
  nIn = vec3(0.0, 0.0, 1.0);
  for (int i = 0; i < uNPlanes; i++) {
    vec4 pl = uPlanes[i];
    float dn = -dot(pl.xyz, gV);
    float dist = pl.w - dot(pl.xyz, o);
    if (abs(dn) < 1e-5) {
      if (dist < 0.0) return false;
      continue;
    }
    float t = dist / dn;
    if (dn < 0.0) {
      if (t > tIn) { tIn = t; nIn = pl.xyz; }
    } else {
      tOut = min(tOut, t);
    }
  }
  return tIn < tOut;
}
// The facet a ray from inside leaves by.
float leave(vec3 p, vec3 d, out vec3 n) {
  float best = 1e9;
  n = vec3(0.0, 0.0, 1.0);
  for (int i = 0; i < uNPlanes; i++) {
    vec4 pl = uPlanes[i];
    float dn = dot(pl.xyz, d);
    if (dn > 1e-5) {
      float t = (pl.w - dot(pl.xyz, p)) / dn;
      if (t < best) { best = t; n = pl.xyz; }
    }
  }
  return max(best, 0.0);
}
${GEM_GEOMETRY_GLSL}

// Shared lighting/material lookup for the direct background and all refracted floor hits.
vec3 fastFloor(vec3 p,vec3 view);
vec3 backingAt(vec2 gb) {
  return fastFloor(vec3(gb,gFloorZ),gV);
}
// Where light leaving the stone at h going down (d.z < 0) meets the backing.
vec2 floorHit(vec3 h, vec3 d) { return h.xy + d.xy * ((gFloorZ - h.z) / d.z); }
// What light leaving the stone at h in direction d brings: the studio and the lamp above, the backing below.
vec3 seen(vec3 d, vec3 h, vec3 under) {
  if (d.z < -0.05) return under;
  return env(d) + lampSeen(d, h);
}


vec3 spectral(float w) {
  float r = exp(-pow((w - 605.0) / 42.0, 2.0)) + 0.3 * exp(-pow((w - 430.0) / 18.0, 2.0));
  float g = exp(-pow((w - 545.0) / 38.0, 2.0));
  float b = exp(-pow((w - 455.0) / 28.0, 2.0));
  return vec3(r, g, b);
}

// The play of colour for light from direction Lw (outside, towards the light) at the dome point P, normal N.
vec3 play(vec2 g, vec3 N, vec3 Lw, vec3 I, float scale) {
  vec3 lin = -refract(-Lw, N, 1.0 / 1.45);
  vec3 vin = -refract(-gV, N, 1.0 / 1.45);
  vec3 h = normalize(lin + vin);
  vec3 sum = vec3(0.0);
  for (int layer = 0; layer < 2 + ZERO; layer++) {
    vec2 w2 = g * scale * (layer == 0 ? 1.0 : 1.9) + vec2(1.7, 4.2) * float(layer);
    w2 += (vec2(fbm(w2 * 0.7), fbm(w2 * 0.7 + 9.0)) - 0.5) * 2.0;
    vec2 id;
    vec2 v = voronoi(w2, id);
    vec2 rr = hash22(id + float(layer) * 13.0);
    vec3 nd = normalize(vec3((rr - 0.5) * 0.95, 1.0));
    float lam0 = mix(440.0, 720.0, hash12(id * 1.7 + 0.3));
    float c = max(dot(h, nd), 0.0);
    float glow = exp(-(1.0 - c) * 55.0);
    // Soft rolling striations across the domain, a fine grain, a gentle seam at its edge.
    vec2 sd = normalize(rr - 0.5 + 0.01);
    float stri = (0.78 + 0.22 * sin(dot(w2, sd) * 9.0 + fbm(w2 * 2.0) * 5.0)) * (0.85 + 0.15 * vnoise(w2 * 22.0));
    float edge = smoothstep(0.0, 0.14, v.y);
    sum += spectral(lam0 * c) * glow * stri * edge * (layer == 0 ? 1.0 : 0.45);
  }
  return sum * I;
}

vec3 opalStone(vec2 g, vec3 under, vec3 Ilamp, vec3 Llamp) {
  vec2 e = g / uCab.xy;
  float rr = dot(e, e);
  float z = uCab.z * sqrt(max(1.0 - rr, 0.0));
  vec3 P = vec3(g, z);
  vec3 N = normalize(vec3(g.x / (uCab.x * uCab.x), g.y / (uCab.y * uCab.y), z / (uCab.z * uCab.z) + 1e-4));
  float F = fresnel(dot(N, gV), 1.45);
  vec3 rd = reflect(-gV, N);
  vec3 col = F * (env(rd) + lampSeen(rd, P));
  vec3 L;
  vec3 I = lampAt(P, L);
  // The light inside: the lamp's and the softboxes'.
  float scale = uOpal == 1 ? 2.6 : uOpal == 2 ? 4.2 : uOpal == 3 ? 3.4 : 3.0;
  vec3 pc = play(g, N, L, I, scale) + play(g, N, SB1, vec3(1.0, 0.96, 0.9) * 0.5 * uStudio, scale) + play(g, N, SB2, vec3(0.88, 0.94, 1.0) * 0.32 * uStudio, scale);
  float nl = max(dot(N, L), 0.0);
  vec3 amb = vec3(0.06) * uStudio + 0.02;
  vec3 body;
  float strength;
  if (uOpal == 1) {
    // Black opal: a dark body, the strongest play.
    body = vec3(0.012, 0.013, 0.02) * (I * nl + amb);
    strength = 1.5;
  } else if (uOpal == 2) {
    // White opal: milky, softly lit through, pastel play.
    body = vec3(0.62, 0.64, 0.68) * (I * (0.35 + 0.5 * nl) + amb);
    strength = 0.55;
  } else if (uOpal == 3) {
    // Boulder opal: veins of opal in brown ironstone.
    float m = fbm(g * 2.4 + 3.0) + 0.25 * fbm(g * 9.0);
    float vein = smoothstep(0.5, 0.56, m);
    vec3 stone = mix(vec3(0.14, 0.06, 0.025), vec3(0.32, 0.17, 0.07), fbm(g * 6.0)) * (I * nl + amb);
    body = mix(stone, vec3(0.02, 0.02, 0.03) * (I * nl + amb), vein);
    strength = 1.4 * vein;
  } else {
    // Fire opal: clear orange; what is under it shows through.
    body = under * exp(-uAbsorb * 0.9) * 0.8 + vec3(0.5, 0.15, 0.02) * (I * 0.25 * nl + amb * 0.5);
    strength = 0.35;
  }
  col += (1.0 - F) * (body + pc * strength);
  return col;
}

// --- the setting -------------------------------------------------------------------------------------------------
// Metal at g: prongs (or a bezel for a dome) and a rim round the girdle. Returns coverage (0 none) and its colour.
float setting(vec2 g, bool dome, out vec3 col, vec3 I, vec3 L) {
  float R = outlineR(atan(g.y, g.x));
  float r = length(g);
  float cover = 0.0;
  vec3 N = vec3(0.0, 0.0, 1.0);
  if (dome) {
    float x = (r - R * 0.96) / (R * 0.15);
    if (x > 0.0 && x < 1.0) {
      cover = 1.0;
      N = normalize(vec3(normalize(g) * (0.5 - x) * 1.6, 1.0));
    }
  } else {
    // The rim just outside the girdle.
    float x = (r - R) / 0.07;
    if (x > 0.0 && x < 1.0) {
      cover = 1.0;
      N = normalize(vec3(normalize(g) * (0.5 - x) * 1.2, 1.0));
    }
    // Prongs: claws over the girdle (4 at the corners of a square stone, else 6).
    float n = float(uProngs);
    float a = atan(g.y, g.x);
    float sec = 2.0 * PI / n;
    float off = uProngs == 4 ? PI / 4.0 : 0.0;
    float ak = floor((a - off) / sec + 0.5) * sec + off;
    vec2 dirK = vec2(cos(ak), sin(ak));
    float Rk = outlineR(ak);
    vec2 a0 = dirK * (Rk - 0.13), a1 = dirK * (Rk + 0.1);
    vec2 pa = g - a0, ba = a1 - a0;
    float hh = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    vec2 off2 = pa - ba * hh;
    float dd = length(off2) / 0.105;
    if (dd < 1.0) {
      cover = 1.0;
      float z = sqrt(1.0 - dd * dd);
      N = normalize(vec3(off2 / 0.105 + dirK * (hh - 0.5) * 0.6, z + 0.3));
    }
  }
  if (cover > 0.0) {
    vec3 rd = reflect(-gV, N);
    vec3 H = normalize(L + gV);
    col = uMetal * (env(rd) * 1.8 + lampSeen(rd, vec3(g, 0.1)) * 0.6 + I * max(dot(N, L), 0.0) * 0.12 + 0.03)
      + uMetal * I * ggx(max(dot(N, H), 0.0), 0.12) * 0.15;
  }
  return cover;
}

${GEM_PATH_GLSL}
${GEM_FAST_GLSL}

// The tray's point under a screen point (css px): closer by uCam.z, foreshortened along the tilt, turned.
vec2 toTray(vec2 s, vec2 origin, mat2 yawM) {
  return origin + yawM * (((s - origin) / uCam.z) * vec2(1.0, 1.0 / cos(uCam.y)));
}

void main() {
  vec2 origin = uRes / uDpr * 0.5;
  gPixelWorld=1./max(uDpr*uGemR*uCam.z*cos(uCam.y),1.);
  mat2 yawM = mat2(cos(uCam.x), sin(uCam.x), -sin(uCam.x), cos(uCam.x));
  // Traced: each sample its own point in the pixel (anti-aliasing) and its own randomness.
  vec2 jitter = vec2(0.0);
  if (uTrace == 1) {
    startGemSample();
    jitter = sample2D(0u) - 0.5;
  }
  vec2 p = toTray(vec2(gl_FragCoord.x + jitter.x, uRes.y - gl_FragCoord.y - jitter.y) / uDpr, origin, yawM);
  vec2 eyeH = yawM * vec2(0.0, sin(uCam.y));
  vec2 c = hexCentre(p, origin, uCellR);
  vec2 q = p - c;
  float hid = hash12(c * 0.137);
  float ang = (hid - 0.5) * 2.0 * PI * uSpin;
  mat2 rot = mat2(cos(ang), sin(ang), -sin(ang), cos(ang));
  gRot=rot; gCellCss=c; gGridOrigin=origin;
  vec2 g = rot * vec2(q.x, -q.y) / uGemR;
  gV = vec3(rot * vec2(eyeH.x, -eyeH.y), cos(uCam.y));
  vec2 lq = toTray(uLamp.xy, origin, yawM) - c;
  gLampP = vec3(rot * vec2(lq.x, -lq.y) / uGemR, uLamp.z / uGemR);
  gLampCol = mix(vec3(1.0, 0.97, 0.93), vec3(1.0, 0.7, 0.4), uWarm) * uLampI;
  gLampSize = 18.0 / uGemR;
  // Traced: the lamp a small sphere — each sample lights from a point of it (soft glints and shadows).
  // The traced lamp is a sampled area emitter, not a jittered point light.
  vec2 o = hash22(c * 0.071) * 37.0;
  bool dome = uCab.w > 0.5;
  // The backing's floor: under the culet (a cabochon lies flat).
  float floorZ = dome ? 0.0 : -0.9;
  gO = o;
  gFloorZ = floorZ;
  gDomeG = dome;
  // Where the ray reaches the backing (further along it when the camera is tilted).
  vec2 gb = g + gV.xy / gV.z * floorZ;
  vec3 Lb;
  vec3 Ib = lampAt(vec3(gb, floorZ), Lb);
  // The backing: lit, the stone's shadow and focused light on it, darker right round the stone.
  vec3 col;
  vec3 back = uTrace==1?vec3(0):backingAt(gb);
  // Under the stone (what light leaving downwards sees): the backing in its shadow.
  vec3 under = (uBacking == 1 ? vec3(0.25) : uFabric) * (Ib * 0.25 + 0.03);
  float tIn;
  vec3 nIn;
  bool hit = false;
  // One call site for the stone's optics (2026-10-30): the two branches only find where the ray enters. The Windows
  // shader compiler inlines every call, and two copies of this (the biggest part of the shader) doubled the
  // first-visit compile. The same arithmetic in the same order.
  bool dielectric = false;
  vec3 dro = vec3(0);
  if(uTrace==1) {
    vec3 ro=vec3(g,0)+gV*(3./gV.z);
    col=pathTraceTray(ro,-gV);
  } else if (dome) {
    // The ray to the eye against the dome (an ellipsoid's upper half on the backing).
    vec3 ro = vec3(g, 0.0) + gV * (2.0 / gV.z);
    vec3 so = ro / uCab.xyz, sd = -gV / uCab.xyz;
    float qa = dot(sd, sd), qb = dot(so, sd), qc = dot(so, so) - 1.0;
    float disc = qb * qb - qa * qc;
    vec3 hp = ro - gV * ((-qb - sqrt(max(disc, 0.0))) / qa);
    hit = disc > 0.0 && hp.z >= 0.0;
    if(hit && uOpal==4) {
      float exitT;vec3 exitN;
      hit=gemInterval(ro,-gV,1e6,tIn,exitT,nIn,exitN);
      if(hit){dielectric=true;dro=ro;} else col=back;
    } else col = hit ? opalStone(hp.xy, under, Ib, Lb) : back;
  } else {
    hit = enterGem(g, tIn, nIn);
    if(hit){dielectric=true;dro=vec3(g,0)+gV*(3./gV.z);} else col=back;
  }
  if(dielectric) col=fastDielectric(dro,-gV,tIn,nIn);
  if (uBacking == 2) {
    vec3 mc;
    vec3 Lm;
    vec3 Im = lampAt(vec3(g, 0.05), Lm);
    if (setting(g, dome, mc, Im, Lm) > 0.0) col = mc;
  }
  // The honeycomb's frame: a dark bronze rim with a bevel.
  float hd = hexSdf(q, uCellR);
  float fw = 3.5;
  if (hd > -fw) {
    float x = clamp((hd + fw) / fw, 0.0, 1.0);
    vec2 dir = normalize(q + 1e-4);
    vec3 N = normalize(vec3(vec2(dir.x, -dir.y) * (0.5 - x) * 1.5, 1.0));
    vec3 Lf;
    vec3 If = lampAt(vec3(rot * vec2(q.x, -q.y) / uGemR, 0.0), Lf);
    vec3 H = normalize(Lf + vec3(0.0, 0.0, 1.0));
    col = vec3(0.09, 0.07, 0.05) * (If * max(dot(N, Lf), 0.0) + 0.05) + vec3(0.6, 0.45, 0.25) * If * ggx(max(dot(N, H), 0.0), 0.2) * 0.05;
  }
  outColor = vec4(col, 1.0);
  float Lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  vec3 hot = col * max(Lum - 1.2, 0.0) / max(Lum, 1e-4);
  outHot = vec4(1.0 - exp(-hot * 0.5), 1.0);
}`;

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

/** Traced: this sample blended into the running average (uW = 1 / samples); the glints' part taken from the average —
 * not averaged itself: each sample is one wavelength, and the threshold (by luminance) would let mostly the green ones
 * through, tinting the glow. */
const ACC = `#version 300 es
precision highp float;
uniform sampler2D uNewC; uniform sampler2D uOldC;
uniform vec2 uSize; uniform float uW;
layout(location = 0) out vec4 oc;
layout(location = 1) out vec4 oh;
void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  oc = mix(texture(uOldC, uv), texture(uNewC, uv), uW);
  float L = dot(oc.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 hot = oc.rgb * max(L - 1.2, 0.0) / max(L, 1e-4);
  oh = vec4(1.0 - exp(-hot * 0.5), 1.0);
}`;

/** The picture, the glints' glow and six-rayed stars, a tone curve. */
const COMPOSE = `#version 300 es
precision highp float;
uniform sampler2D uColor; uniform sampler2D uSmall; uniform sampler2D uWide;
uniform vec2 uSize; uniform float uGlow; uniform float uStars; uniform float uStarStep; uniform float uExposure;
uniform bool uFastAA;
out vec4 o;
vec3 exposed(vec2 uv){return 1.-exp(-texture(uColor,uv).rgb*uExposure);}
// Native-resolution edge AA, only for the unaccumulated preview. No history/ghosting or image resize.
vec3 edgeAA(vec2 uv,vec3 centre){
  vec2 px=1./uSize;
  vec3 nw=exposed(uv+vec2(-1,1)*px),ne=exposed(uv+px);
  vec3 sw=exposed(uv-px),se=exposed(uv+vec2(1,-1)*px);
  vec3 luma=vec3(.299,.587,.114);
  float a=dot(nw,luma),b=dot(ne,luma),c=dot(sw,luma),d=dot(se,luma),m=dot(centre,luma);
  float lo=min(m,min(min(a,b),min(c,d))),hi=max(m,max(max(a,b),max(c,d)));
  if(hi-lo<max(.025,hi*.12))return centre;
  vec2 dir=vec2(-((a+b)-(c+d)),(a+c)-(b+d));
  float reduction=max((a+b+c+d)*.03125,.0078125);
  dir=clamp(dir/(min(abs(dir.x),abs(dir.y))+reduction),vec2(-4),vec2(4))*px;
  vec3 inner=.5*(exposed(uv-dir/6.)+exposed(uv+dir/6.));
  vec3 outer=inner*.5+.25*(exposed(uv-dir*.5)+exposed(uv+dir*.5));
  float lum=dot(outer,luma);
  return lum<lo||lum>hi?inner:outer;
}
void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  vec3 c = exposed(uv);
  if(uFastAA)c=edgeAA(uv,c);
  c += texture(uWide, uv).rgb * uGlow;
  if (uStars > 0.0) {
    vec3 s = vec3(0.0);
    for (int a = 0; a < 3; a++) {
      float an = float(a) * 1.0471976 + 0.2618;
      vec2 dir = vec2(cos(an), sin(an)) * uStarStep / uSize;
      for (int i = 1; i <= 14; i++) {
        float w = exp(-float(i) * 0.24);
        s += (texture(uSmall, uv + dir * float(i)).rgb + texture(uSmall, uv - dir * float(i)).rgb) * w;
      }
    }
    c += s * uStars * 0.3;
  }
  o = vec4(pow(c, vec3(1.0 / 2.2)), 1.0);
}`;

export function createGemRenderer(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) return null;
  const ctx = gl;
  const compile = (type: number, src: string) => {
    const s = ctx.createShader(type)!;
    ctx.shaderSource(s, src);
    ctx.compileShader(s);
    if (!ctx.getShaderParameter(s, ctx.COMPILE_STATUS)) throw new Error(ctx.getShaderInfoLog(s) ?? 'shader');
    return s;
  };
  const vert = compile(gl.VERTEX_SHADER, VERT);
  const program = (src: string) => {
    const p = ctx.createProgram()!;
    ctx.attachShader(p, vert);
    ctx.attachShader(p, compile(ctx.FRAGMENT_SHADER, src));
    ctx.bindAttribLocation(p, 0, 'aPos');
    ctx.linkProgram(p);
    if (!ctx.getProgramParameter(p, ctx.LINK_STATUS)) throw new Error(ctx.getProgramInfoLog(p) ?? 'link');
    return p;
  };
  const blur = program(BLUR);
  const compose = program(COMPOSE);
  const accumulate = program(ACC);
  const loc = (p: WebGLProgram) => {
    const cache = new Map<string, WebGLUniformLocation | null>();
    return (n: string) => {
      if (!cache.has(n)) cache.set(n, ctx.getUniformLocation(p, n));
      return cache.get(n) ?? null;
    };
  };
  const ub = loc(blur), uc = loc(compose), ua = loc(accumulate);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const target = (w: number, h: number, internal: number, type: number) => {
    const t = ctx.createTexture()!;
    ctx.bindTexture(ctx.TEXTURE_2D, t);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.LINEAR);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.LINEAR);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);
    ctx.texImage2D(ctx.TEXTURE_2D, 0, internal, w, h, 0, ctx.RGBA, type, null);
    return t;
  };
  const fbo = (...ts: WebGLTexture[]) => {
    const f = ctx.createFramebuffer()!;
    ctx.bindFramebuffer(ctx.FRAMEBUFFER, f);
    ts.forEach((t, i) => ctx.framebufferTexture2D(ctx.FRAMEBUFFER, ctx.COLOR_ATTACHMENT0 + i, ctx.TEXTURE_2D, t, 0));
    ctx.drawBuffers(ts.map((_, i) => ctx.COLOR_ATTACHMENT0 + i));
    return f;
  };
  const hw = Math.max(1, width >> 1), hh = Math.max(1, height >> 1);
  const texColor = target(width, height, gl.RGBA16F, gl.HALF_FLOAT);
  const texHot = target(width, height, gl.RGBA8, gl.UNSIGNED_BYTE);
  const halfA = target(hw, hh, gl.RGBA8, gl.UNSIGNED_BYTE), halfB = target(hw, hh, gl.RGBA8, gl.UNSIGNED_BYTE), halfC = target(hw, hh, gl.RGBA8, gl.UNSIGNED_BYTE);
  const fbMain = fbo(texColor, texHot), fbA = fbo(halfA), fbB = fbo(halfB), fbC = fbo(halfC);
  // Traced: the running averages (colour, glints), ping-pong.
  const accC = [target(width, height, gl.RGBA16F, gl.HALF_FLOAT), target(width, height, gl.RGBA16F, gl.HALF_FLOAT)];
  const accH = [target(width, height, gl.RGBA8, gl.UNSIGNED_BYTE), target(width, height, gl.RGBA8, gl.UNSIGNED_BYTE)];
  const fbAcc = [fbo(accC[0], accH[0]), fbo(accC[1], accH[1])];
  let accIdx = 0;
  let denoiseProgram: WebGLProgram | null = null;
  let denoised = false, denoiseRuns = 0;
  const refinement = createGemRefinement();
  const tiles = gemTraceTiles(width, height);
  let renderMode: 'fast' | 'trace' | 'cached' = 'fast';
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  const materialSize = 1024;
  const materialColor = target(materialSize,materialSize,gl.RGBA8,gl.UNSIGNED_BYTE);
  const materialNormal = target(materialSize,materialSize,gl.RGBA8,gl.UNSIGNED_BYTE);
  for(const t of [materialColor,materialNormal]) {
    gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
  }
  const materialFramebuffer = fbo(materialColor,materialNormal);
  const opticsHeader = MAIN.slice(0,MAIN.indexOf('// --- backings'));
  const materials = MAIN.slice(MAIN.indexOf('// --- backings'),MAIN.indexOf('// --- the gem'));
  const materialSource = `${opticsHeader}${materials}
    void main(){
      vec2 p=(gl_FragCoord.xy/${materialSize}.-.5)*24.;
      vec3 albedo=uBacking==1?rock(p,vec2(0),vec3(0),vec3(0,0,1)):fabric(p,vec2(0),vec3(0),vec3(0,0,1));
      outColor=vec4(albedo,gBackingRoughness); outHot=vec4(gBackingNormal*.5+.5,1);
    }`.replace('uniform int uTrace;','const int uTrace = 1;');
  const materialProgram = program(materialSource);
  const materialLoc = loc(materialProgram);
  let materialKey = '';
  const caustics=createGemCaustics(gl);

  let gemSet: Gem | null = null;
  const setGem = (gem: Gem) => {
    gemSet = gem;
    gl.useProgram(main);
    const planes = cutPlanes(gem);
    const arr = new Float32Array(96 * 4);
    arr.set(planes.subarray(0, 96 * 4));
    gl.uniform4fv(um('uPlanes'), arr);
    gl.uniform1i(um('uNPlanes'), planes.length / 4);
    gl.uniform4fv(um('uOutline'), outlineSamples(gem));
    const cab = gem.cut === 'cabochon';
    gl.uniform4f(um('uCab'), 1, 1 / gem.aspect, gem.opal === 4 ? 0.5 : 0.42, cab ? 1 : 0);
    gl.uniform1f(um('uIor'), gem.ior);
    gl.uniform3fv(um('uAbsorb'), gem.absorb);
    gl.uniform3fv(um('uAbsorbWarm'), gem.absorbWarm ?? gem.absorb);
    gl.uniform1i(um('uOpal'), gem.opal);
    gl.uniform1f(um('uSilk'), gem.silk);
    gl.uniform1f(um('uJardin'), gem.jardin);
    gl.uniform1f(um('uFluor'), gem.fluor);
    const f = gem.fabric.color;
    gl.uniform3f(um('uFabric'), ...([1, 3, 5].map((i) => Math.pow(parseInt(f.slice(i, i + 2), 16) / 255, 2.2)) as [number, number, number]));
    gl.uniform1i(um('uFabricKind'), gem.fabric.kind);
    gl.uniform1i(um('uRock'), gem.rock);
    gl.uniform3fv(um('uMetal'), METAL_COLORS[gem.metal]);
    gl.uniform1i(um('uProngs'), gem.cut === 'princess' || gem.cut === 'emerald' || gem.cut === 'cushion' ? 4 : 6);
  };

  // Compile the large optics program last: no synchronous setup query may wait behind it in the driver queue.
  const mainSource = (trace: boolean) => MAIN.replace('uniform int uTrace;', `const int uTrace = ${trace ? 1 : 0};`);
  const spectrum = MAIN.slice(MAIN.indexOf('vec3 spectral('),MAIN.indexOf('// The play of colour'));
  const cameraSetup = MAIN.slice(MAIN.indexOf('void main() {'),MAIN.indexOf('  // Where the ray reaches the backing'));
  const trayFrame = MAIN.slice(MAIN.indexOf('  // The honeycomb\'s frame:'));
  const trayProjection = MAIN.slice(MAIN.indexOf('vec2 toTray('),MAIN.indexOf('void main() {'));
  const traceSource = `${opticsHeader}${GEM_GEOMETRY_GLSL}${spectrum}${GEM_PATH_GLSL}${trayProjection}${cameraSetup}
    vec3 col=pathTraceTray(vec3(g,0)+gV*(3./gV.z),-gV);
    ${trayFrame}`.replace('uniform int uTrace;', 'const int uTrace = 1;');
  const mainPending = createProgressiveProgram(gl, VERT, mainSource(false), 'gems: interactive');
  if (!mainPending) throw new Error('Cannot allocate gems shader');
  let tracedPending: ReturnType<typeof createProgressiveProgram> = null;
  let main = mainPending.prog;
  let um = loc(main);

  return {
    canvas,
    /** Traced: samples still to go before the still picture is done (0 when done or not traced). */
    get traceLeft() {
      return TRACE_SAMPLES - refinement.samples;
    },
    get diagnostics() { return { mode: renderMode, samples: refinement.samples, limit: TRACE_SAMPLES, denoised, denoiseRuns, ...caustics.diagnostics, tile: refinement.tile, tiles: tiles.length, changes: refinement.changes, quietMs: Math.round(refinement.quietMs) }; },
    render(gem: Gem, look: GemLook, dpr: number, now = performance.now()) {
      if (!mainPending.ready()) {
        if (mainPending.failed()) throw new Error('Gems shader compilation failed; see console diagnostics');
        return;
      }
      if(!caustics.ready())return;
      const { time, ...stableLook } = look;
      void time;
      const plan = refinement.next(JSON.stringify([gem.id, stableLook, dpr]), now, !!look.trace, tiles.length);
      if(plan.changed) denoised = false;
      renderMode = plan.mode;
      if (plan.mode === 'cached') return;
      const trace = plan.mode === 'trace';
      if (trace) {
        if (!tracedPending) {
          tracedPending = createProgressiveProgram(gl, VERT, traceSource, 'gems: path trace');
          if (!tracedPending) throw new Error('Cannot allocate gems trace shader');
          return;
        }
        if (!tracedPending.ready()) {
          if (tracedPending.failed()) throw new Error('Gems trace shader compilation failed; see console diagnostics');
          return;
        }
      }
      const nextProgram = trace ? tracedPending!.prog : mainPending.prog;
      if (nextProgram !== main) { main = nextProgram; um = loc(main); gemSet = null; }
      if (gem !== gemSet) setGem(gem);
      const W = canvas.width, H = canvas.height;
      const causticBounds=!trace?caustics.render(gem,look,W/dpr,H/dpr):null;
      gl.bindVertexArray(vao);
      if(materialKey !== `${gem.id}:${look.backing}`) {
        gl.useProgram(materialProgram);
        gl.bindFramebuffer(gl.FRAMEBUFFER,materialFramebuffer);
        gl.viewport(0,0,materialSize,materialSize);
        gl.uniform1i(materialLoc('uBacking'),look.backing);
        gl.uniform1i(materialLoc('uRock'),gem.rock);
        gl.uniform1i(materialLoc('uFabricKind'),gem.fabric.kind);
        gl.uniform3fv(materialLoc('uFabric'),[1,3,5].map(i=>Math.pow(parseInt(gem.fabric.color.slice(i,i+2),16)/255,2.2)));
        gl.uniform3fv(materialLoc('uAbsorb'),gem.absorb);
        gl.drawArrays(gl.TRIANGLES,0,3);
        materialKey=`${gem.id}:${look.backing}`;
      }
      if (trace) {
        const tile = tiles[plan.tile];
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(tile.x,tile.y,tile.width,tile.height);
      }
      gl.useProgram(main);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbMain);
      gl.viewport(0, 0, W, H);
      gl.uniform2f(um('uRes'), W, H);
      gl.uniform1f(um('uDpr'), dpr);
      gl.uniform1f(um('uCellR'), look.cellR);
      gl.uniform1f(um('uGemR'), look.cellR * 0.56);
      gl.uniform1f(um('uSpin'), look.spin);
      gl.uniform3f(um('uLamp'), look.lamp[0], look.lamp[1], look.lamp[2]);
      const cam = look.cam ?? [0, 0, 1];
      gl.uniform3f(um('uCam'), cam[0], cam[1], cam[2]);
      gl.uniform1f(um('uLampI'), look.lampI);
      gl.uniform1f(um('uWarm'), look.warm);
      gl.uniform1f(um('uStudio'), look.studio);
      gl.uniform1f(um('uTime'), look.time);
      gl.uniform1f(um('uDisp'), gem.dispersion * look.fire);
      gl.uniform1i(um('uBacking'), look.backing);
      gl.uniform1i(um('uTrace'), trace ? 1 : 0);
      gl.uniform1i(um('uSample'), plan.sample);
      gl.uniform1i(um('uGridSteps'), 12);
      // At most two reflections; up to six additional dielectric entry/exit crossings.
      gl.uniform1i(um('uPathSteps'), 8);
      gl.uniform1i(um('uMaxReflections'), 2);
      gl.uniform1i(um('uFastReflections'),2);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,materialColor); gl.uniform1i(um('uMaterialColor'),0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,materialNormal); gl.uniform1i(um('uMaterialNormal'),1);
      if(causticBounds){
        gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,caustics.texture);gl.uniform1i(um('uCaustics'),2);
        gl.uniform4fv(um('uCausticBounds'),causticBounds);
      }
      gl.uniform3f(um('uSpecK'), SPEC_K[0], SPEC_K[1], SPEC_K[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (trace) {
        gl.disable(gl.SCISSOR_TEST);
        if (!refinement.completeTile(tiles.length)) return;
        gl.useProgram(accumulate);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbAcc[1 - accIdx]);
        const bind = (unit: number, t: WebGLTexture, name: string) => {
          gl.activeTexture(gl.TEXTURE0 + unit);
          gl.bindTexture(gl.TEXTURE_2D, t);
          gl.uniform1i(ua(name), unit);
        };
        bind(0, texColor, 'uNewC');
        bind(1, accC[accIdx], 'uOldC');
        gl.uniform2f(ua('uSize'), W, H);
        gl.uniform1f(ua('uW'), 1 / refinement.samples);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        accIdx = 1 - accIdx;
        if(refinement.samples === TRACE_SAMPLES) {
          // Resolve once into the now spare ping-pong target. No extra image/FBO, no filtered history feedback.
          denoiseProgram ??= program(GEM_DENOISE_GLSL);
          gl.useProgram(denoiseProgram);
          gl.bindFramebuffer(gl.FRAMEBUFFER,fbAcc[1-accIdx]);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D,accC[accIdx]);
          gl.uniform1i(gl.getUniformLocation(denoiseProgram,'uNoisy'),0);
          gl.uniform2f(gl.getUniformLocation(denoiseProgram,'uSize'),W,H);
          gl.drawArrays(gl.TRIANGLES,0,3);
          accIdx=1-accIdx;
          denoised=true; denoiseRuns++;
        }
      }
      const showColor = trace ? accC[accIdx] : texColor;
      const showHot = trace ? accH[accIdx] : texHot;
      // The glints blurred a little (stars) and a lot (glow), at half size.
      gl.useProgram(blur);
      gl.uniform1i(ub('uSrc'), 0);
      gl.uniform2f(ub('uOut'), hw, hh);
      const pass = (src: WebGLTexture, sw: number, sh: number, dst: WebGLFramebuffer, dx: number, dy: number) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, dst);
        gl.viewport(0, 0, hw, hh);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, src);
        gl.uniform2f(ub('uStep'), dx / sw, dy / sh);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };
      pass(showHot, W, H, fbA, dpr, 0);
      pass(halfA, hw, hh, fbB, 0, 0.5 * dpr);
      pass(halfB, hw, hh, fbA, 2.5 * dpr, 0);
      pass(halfA, hw, hh, fbC, 0, 2.5 * dpr);
      gl.useProgram(compose);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, showColor);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, halfB);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, halfC);
      gl.uniform1i(uc('uColor'), 0);
      gl.uniform1i(uc('uSmall'), 1);
      gl.uniform1i(uc('uWide'), 2);
      gl.uniform2f(uc('uSize'), W, H);
      gl.uniform1f(uc('uGlow'), look.glow);
      gl.uniform1f(uc('uStars'), look.stars);
      gl.uniform1f(uc('uStarStep'), 1.6 * dpr);
      gl.uniform1f(uc('uExposure'), look.exposure);
      gl.uniform1i(uc('uFastAA'),trace?0:1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      caustics.dispose();
      for (const t of [texColor, texHot, halfA, halfB, halfC, ...accC, ...accH,materialColor,materialNormal]) gl.deleteTexture(t);
      for (const f of [fbMain, fbA, fbB, fbC, ...fbAcc,materialFramebuffer]) gl.deleteFramebuffer(f);
      mainPending.dispose();
      tracedPending?.dispose();
      if(denoiseProgram) gl.deleteProgram(denoiseProgram);
      for (const p of [blur, compose, accumulate,materialProgram]) gl.deleteProgram(p);
      gl.deleteBuffer(buf);
      gl.deleteVertexArray(vao);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}

export type GemRenderer = NonNullable<ReturnType<typeof createGemRenderer>>;
