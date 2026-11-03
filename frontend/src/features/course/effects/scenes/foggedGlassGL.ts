/**
 * The fogged window (WebGL2): a night street out of focus behind misted glass, drops on it, wiping.
 *
 *   city     — the street behind the glass, sharp through clear glass (or out of focus: «фокус»): sky with the
 *              city's glow and stars, a far skyline and a near row of houses (varied widths, heights, roofs — gable,
 *              stepped, a spire, an antenna — facades, window grids, shop fronts), the road with kerbs and a dashed
 *              line, two rows of street lamps on poles going off to a vanishing point (sodium and LED, a pool of
 *              light under each), cars (bodies with cabins, windows, wheels; headlights coming, tail lights going,
 *              the nearest in front), a traffic light on its post, neon signs; every light a small point with a
 *              halo (a bokeh disc out of focus), with its streak on the wet road below. Full size.
 *   blur     — the street seen through the mist: much more blurred (quarter size); and the bright part alone,
 *              blurred (the glare of lamps through mist and smears).
 *   fog      — the state of the glass (a texture, stepped each frame): R mist, G wetness (a drop has run there), B smear
 *              (where it was wiped, in streaks), A the wipe's direction. The mist comes back by itself (less where wet);
 *              where a drop is it is cleared and wet — so a running drop leaves a clear wet trail; a wipe takes the
 *              mist off unevenly (the cloth's streaks) and leaves smears.
 *   drops    — the drops (simulated in foggedGlass.ts) as a height field: one instanced quad each, a dome (stretched
 *              and widened at the bottom while it runs), the higher one kept where they overlap.
 *   compose  — clear glass shows the street, mist shows it blurred and milky, a drop shows it bent through its dome
 *              (inverted, magnified) with a dark rim and the lights caught in it; the wet trails carry fine droplets;
 *              smears scatter the lamps' light across their streaks; the lamps glow through the mist; tone curve.
 */
import { foggedPhotoFallback } from './foggedPhotoSource';

export type FogLook = {
  time: number;
  fogMax: number;
  regrow: number;
  wipe: { a: [number, number]; b: [number, number]; r: number; on: boolean };
  smudge: number;
  lights: number;
  bokeh: number;
  traffic: number;
  exposure: number;
  /** How out of focus the street is (0 sharp … 1 all bokeh). */
  focus: number;
  /** The mist's blur (0 none … 1 a quarter-size blur … 2 a sixteenth-size one, heavy), how milky it is (the light it
   * scatters), how long a drop's wet trail stays clear (0 mists over at once … 0.9 stays long). */
  blur: number;
  veil: number;
  /** The condensation's fine grain over the mist (0 a plain blur … 1 coarse). */
  grain: number;
  trail: number;
  /** Puddles on the asphalt (0 none … 1.5 many). */
  puddles: number;
  /** How the street is made: 0 live (drawn whole every frame), 1 baked (what stands still drawn once, what moves —
   * lamps, cars, neon, the traffic light — drawn over it each frame at half size), 2 a looped video (VP9, a minute;
   * the street's own settings are baked into it), falling back to live where it cannot play. */
  street?: number;
  /** The camera (orbitControl.ts): the street behind the glass moved (uv, as the eye moves) and closer (×). */
  cam?: [number, number, number];
};

/** The street's uv under a canvas uv for the camera: closer, moved, and enlarged enough that its edges never show. */
const camScale = (cam: [number, number, number]) => cam[2] * (1 + 2.6 * Math.max(Math.abs(cam[0]), Math.abs(cam[1])));

/** The street's looped video (see .tmp/street-video.mjs): 720p, 1080p, 2160p, VP9 in WebM. */
export const STREET_VIDEO = (h: number) => `/course/effects/fogged-street-${h}.webm`;
const STREET_VIDEO_SIZES = [720, 1080, 2160];

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const LIB = `
float hash12(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float hash11(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { s += a * vnoise(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
`;

/** The street behind the glass. uv: 0…1, y up; distances in units of the height. */
const CITY = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uLights;
uniform float uBokeh;
uniform float uTraffic;
// How out of focus the street is (0: sharp — the eye on the street through clear glass; 1: as before, all bokeh).
uniform float uFocus;
// The neon signs' words, one row each (SIGN_WORDS, drawn by drawSignAtlas; mipmapped: the glow is a blurrier level).
uniform sampler2D uSigns;
// Puddles on the asphalt (0 none).
uniform float uPuddles;
// What is drawn: 0 everything (live), 1 only what stands still (baked once), 2 only what moves (lamps, cars, neon,
// the traffic light; premultiplied, alpha = a car's cover) — the baked street is 1 under 2.
uniform int uLayer;
// 0, or a period in seconds: every motion's rate rounded so the whole street repeats exactly (the looped video).
uniform float uLoop;
// The camera: the street moved (uv) and closer (×).
uniform vec3 uCam;
out vec4 o;
${LIB}
float gAspect;
float qf(float f) { return uLoop > 0.0 ? max(1.0, floor(f * uLoop / 6.2831853 + 0.5)) * 6.2831853 / uLoop : f; }
float qr(float r) { return uLoop > 0.0 ? max(1.0, floor(r * uLoop + 0.5)) / uLoop : r; }
float lt() { return uLoop > 0.0 ? mod(uTime, uLoop) : uTime; }
// A light: a bokeh disc (a rounded hexagon, brighter rim) when out of focus, a small bright point with a halo when
// sharp.
float bokeh(vec2 p, vec2 c, float r) {
  float rs = max(0.0025, r * 0.12);
  float rr = mix(rs, r, uFocus);
  vec2 d = (p - c) / rr;
  vec2 a = abs(d);
  float hex = max(0.866 * a.x + 0.5 * a.y, a.y) / 0.866;
  float q = mix(length(d), hex, 0.35 * uFocus);
  float disc = q > 1.2 ? 0.0 : (1.0 - smoothstep(mix(0.6, 0.86, uFocus), 1.0, q)) * (0.72 + 0.4 * smoothstep(0.55, 0.97, q) * uFocus);
  // The halo round a sharp light (the air and the glass scatter a little).
  float halo = exp(-length(p - c) / (r * 0.6)) * 0.22 * (1.0 - uFocus);
  return disc * mix(2.2, 1.0, uFocus) + halo;
}
// A light's streak on the wet road under it.
float streak(vec2 p, vec2 c, float r, float roadY) {
  if (c.y < roadY) return 0.0;
  float y0 = roadY - (c.y - roadY) * 0.9;
  float w = mix(max(0.003, r * 0.25), r * 0.7, uFocus);
  vec2 d = vec2((p.x - c.x) / w, (p.y - (roadY + y0) * 0.5) / max((roadY - y0) * 0.6, 1e-3));
  return exp(-dot(d, d) * 1.6) * 0.35 * (0.75 + 0.25 * vnoise(vec2(p.x * 300.0, p.y * 40.0)));
}
float box(vec2 p, vec2 c, vec2 h, float r) { vec2 q = abs(p - c) - h + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
// The edge's softness for shapes: a pixel when sharp, wider out of focus.
float aa() { return mix(1.2 / uRes.y, 0.02, uFocus); }
float fill(float d) { return 1.0 - smoothstep(-aa(), aa(), d); }

// Buildings along the horizon: blocks of varied width, height, roof (flat, gable, stepped, a spire or an antenna),
// facade colour and window grid; lit windows, shop fronts at street level. far: a taller, dimmer row behind.
vec3 buildings(vec2 p, float horizon, vec3 col, bool far) {
  float scale = far ? 0.7 : 1.0;
  float base = horizon - (far ? 0.0 : 0.05);
  // Blocks of varied width: walk along x in a hashed sequence of widths.
  float x = p.x / scale + (far ? 17.3 : 0.0);
  float w0 = 0.07;
  float idx = floor(x / w0);
  float f = fract(x / w0);
  float id = idx + (far ? 100.0 : 0.0);
  // Neighbouring cells merge into wider buildings now and then.
  float merge = hash11(floor(idx / 2.0) * 3.1 + (far ? 9.0 : 0.0));
  if (merge > 0.6) { id = floor(idx / 2.0) * 2.0 + (far ? 100.0 : 0.0); f = fract(x / (w0 * 2.0)); }
  float hgt = (far ? 0.22 : 0.08) + (far ? 0.32 : 0.3) * hash11(id * 3.7) * (0.4 + 0.6 * hash11(id * 1.3 + 2.0));
  float top = base + hgt * scale;
  float roofType = hash11(id * 5.9);
  float y = p.y;
  // The roof's outline.
  float roofTop = top;
  if (!far && roofType < 0.3) roofTop = top + 0.05 * (1.0 - abs(f - 0.5) * 2.0);           // gable
  else if (roofType < 0.45) roofTop = top + (f > 0.25 && f < 0.75 ? 0.025 : 0.0);           // a step
  float spire = roofType > 0.9 ? smoothstep(0.012, 0.0, abs(f - 0.5) * w0) * 0.08 * (1.0 - abs(f - 0.5) * 6.0) : 0.0;
  float antenna = roofType > 0.75 && roofType <= 0.9 && abs(f - 0.7) < 0.03 ? 0.04 : 0.0;
  float edgeL = f < 0.03 || f > 0.97 ? 1.0 : 0.0;
  if (y < base || y > roofTop + max(spire, antenna) * scale) return col;
  // The facade: a dark colour of its own (brick, blue-grey, plaster), the far row bluer and dimmer.
  vec3 wall = mix(vec3(0.018, 0.016, 0.02), vec3(0.03, 0.02, 0.016), hash11(id * 2.3));
  wall = mix(wall, vec3(0.012, 0.016, 0.026), far ? 0.6 : hash11(id * 8.1) * 0.5);
  if (y > roofTop) return mix(col, wall * 0.7, 0.9);
  vec3 c = wall * (1.0 - 0.25 * edgeL);
  if (y > top) return mix(col, c * 0.85, 0.95);
  // Windows: a grid of its own, lit at random (warm or cool), some with a shade, flickering a little.
  float cols = 3.0 + floor(hash11(id * 4.4) * 4.0);
  float rowH = (far ? 0.022 : 0.028) * (0.85 + 0.3 * hash11(id * 6.6));
  vec2 g = vec2(f * cols, (y - base) / (rowH * scale));
  vec2 wc = floor(g), wf = fract(g) - 0.5;
  float inWin = step(abs(wf.x), 0.3) * step(abs(wf.y), 0.28);
  float lit = step(0.58, hash12(wc + id * 11.0));
  float warm = hash12(wc * 1.7 + id);
  vec3 wcol = warm > 0.35 ? vec3(1.0, 0.7, 0.38) : warm > 0.12 ? vec3(0.62, 0.78, 1.0) : vec3(0.9, 0.5, 1.0);
  float shade = 0.55 + 0.45 * smoothstep(-0.28, 0.1, wf.y * (hash12(wc + 4.0) > 0.5 ? 1.0 : -1.0));
  float win = mix(inWin, smoothstep(0.42, 0.2, length(wf / vec2(0.32, 0.3))), uFocus);
  c += wcol * lit * win * shade * (far ? 0.12 : 0.3) * uLights * (0.9 + 0.1 * (uLayer == 1 ? 0.0 : sin(uTime * qf(0.3) + warm * 30.0)));
  c += vec3(0.02, 0.025, 0.035) * (1.0 - lit) * win * 0.6;
  // A shop front along the street (near row): a lit band, an awning.
  if (!far && y - base < 0.03) {
    float shop = step(0.45, hash11(id * 7.7));
    vec3 sc = mix(vec3(1.0, 0.8, 0.5), vec3(0.5, 0.9, 1.0), hash11(id * 3.3));
    c += sc * shop * 0.2 * uLights * smoothstep(0.0, 0.004, y - base) * (1.0 - smoothstep(0.022, 0.026, y - base));
    if (y - base > 0.026) c = mix(c, vec3(0.1, 0.02, 0.02) * shop + c * (1.0 - shop), 0.8);
  }
  return mix(col, c, 0.97);
}

// A car seen at depth z in a lane (x: its centre at depth 1): its body (with the cabin and windows), coming
// (front) or going (back). Returns the body's colour weight and writes its colour.
float car(vec2 p, vec2 vp, float lane, float z, float seed, out vec3 cc) {
  vec2 c = vp + vec2(lane / z, -0.075 / z);
  float s = 1.0 / z;
  float body = box(p, c, vec2(0.13, 0.04) * s, 0.02 * s);
  float cabin = box(p, c + vec2(0.0, 0.05) * s, vec2(0.09, 0.03) * s, 0.025 * s);
  float d = min(body, cabin);
  vec3 paint = mix(vec3(0.02, 0.02, 0.025), mix(vec3(0.08, 0.015, 0.012), vec3(0.015, 0.03, 0.06), step(0.5, hash11(seed * 3.0))), step(0.35, hash11(seed)));
  // Windows: the cabin's glass dark, catching the street's light along its top.
  float glass = box(p, c + vec2(0.0, 0.05) * s, vec2(0.075, 0.02) * s, 0.015 * s);
  cc = paint;
  cc = mix(cc, vec3(0.01, 0.012, 0.02) + vec3(0.05, 0.04, 0.03) * smoothstep(0.0, 0.02 * s, p.y - (c.y + 0.05 * s)), fill(glass));
  // A highlight along the roof and the bonnet (the lamps above).
  cc += vec3(0.06, 0.05, 0.04) * smoothstep(0.006 * s, 0.0, abs(p.y - (c.y + 0.078 * s))) * fill(cabin);
  // Wheels.
  float wheels = min(length(p - c - vec2(-0.085, -0.04) * s) - 0.022 * s, length(p - c - vec2(0.085, -0.04) * s) - 0.022 * s);
  cc = mix(cc, vec3(0.004), fill(wheels));
  return max(fill(d), fill(wheels));
}

// The street at p (sky, houses, the road, lamps, cars, the traffic light, neon); called again for what a puddle mirrors.
vec4 street(vec2 p) {
  float horizon = 0.44;
  vec2 vp = vec2(gAspect * 0.56, horizon);
  float roadY = horizon - 0.02;
  vec3 col = vec3(0.0);
  if (uLayer != 2) {
  // Sky: deep blue above, the city's orange glow low down; stars where it is dark enough.
  col = mix(vec3(0.1, 0.06, 0.05), vec3(0.015, 0.02, 0.05), smoothstep(horizon, 1.0, p.y));
  vec2 sc = floor(p * 140.0);
  float star = step(0.985, hash12(sc)) * smoothstep(0.6, 0.85, p.y);
  vec2 sf = fract(p * 140.0) - 0.5 - (vec2(hash12(sc + 3.0), hash12(sc + 7.0)) - 0.5) * 0.6;
  float tw = uLayer == 1 ? 0.8 : 0.6 + 0.4 * sin(uTime * qf(1.0 + 3.0 * hash12(sc + 1.0)) + hash12(sc) * 40.0);
  col += vec3(0.8, 0.85, 1.0) * star * tw * exp(-dot(sf, sf) * mix(60.0, 8.0, uFocus)) * mix(0.9, 0.25, uFocus) * (0.3 + 0.7 * hash12(sc + 5.0));
  // The far skyline, then the near row of houses.
  col = buildings(p, horizon, col, true);
  col = buildings(p, horizon, col, false);
  // The road below the horizon, wet and dark: kerbs going off to the vanishing point, a dashed line in the middle.
  if (p.y < roadY) {
    // Asphalt (owner: «асфальт генеративной текстурой, я его не вижу»): in the road's own coordinates (x across, the
    // road ±0.62; y the depth), so everything shrinks with distance. Grey tar with stones in it at two sizes (fading off
    // far away before it would shimmer), tar seams and cracks, darker mended patches, worn paint: the dashed centre
    // line, the edge lines, a zebra crossing near; the pavement of tiles beyond the kerbs. Wet: the lamps' light lies on
    // it in pools (below) and as streaks.
    float adz = max(vp.y - p.y, 1e-3);
    vec2 rc = vec2((p.x - vp.x) * (0.12 / adz), 0.12 / adz);
    float ax = abs(rc.x + 0.01);
    float fade = clamp(1.7 - rc.y * 0.17, 0.0, 1.0) * (1.0 - 0.7 * uFocus);
    float g1 = vnoise(rc * 80.0), g2 = vnoise(rc * 230.0 + 7.0);
    float stones = smoothstep(0.6, 0.85, g1 * 0.55 + g2 * 0.55) * fade;
    float crack = smoothstep(0.03, 0.0, abs(fbm(rc * vec2(5.0, 2.6) + 4.0) - 0.5)) * smoothstep(0.5, 0.65, vnoise(rc * 1.7 + 5.0)) * fade;
    float mend = smoothstep(0.57, 0.6, fbm(rc * vec2(1.4, 0.7) + 11.0));
    vec3 asphalt = mix(vec3(0.05, 0.05, 0.056), vec3(0.032, 0.032, 0.036), mend);
    asphalt *= 0.75 + 0.5 * mix(0.5, g1, fade);
    asphalt += vec3(0.055, 0.053, 0.05) * stones;
    asphalt *= 1.0 - 0.65 * crack;
    float centre = (1.0 - smoothstep(0.012, 0.02, ax)) * step(0.45, fract(rc.y * 0.5));
    float edges = 1.0 - smoothstep(0.008, 0.016, abs(ax - 0.55));
    float zebra = step(1.0, rc.y) * step(rc.y, 1.55) * step(0.5, fract(rc.x * 5.0)) * step(ax, 0.5);
    float paint = clamp(centre + edges + zebra, 0.0, 1.0) * (0.55 + 0.45 * smoothstep(0.3, 0.7, g2)) * mix(0.4, 1.0, fade);
    asphalt = mix(asphalt, vec3(0.42, 0.42, 0.39), paint * step(ax, 0.6));
    if (ax > 0.6) {
      // The kerb, then the pavement's tiles.
      vec2 tile = rc * vec2(9.0, 4.0);
      float joint = max(smoothstep(0.08, 0.0, abs(fract(tile.x) - 0.5) - 0.42), smoothstep(0.08, 0.0, abs(fract(tile.y) - 0.5) - 0.42)) * fade;
      asphalt = vec3(0.058, 0.055, 0.052) * (0.85 + 0.3 * vnoise(floor(tile) * 1.7)) * (1.0 - 0.5 * joint);
      asphalt = mix(asphalt, vec3(0.11, 0.105, 0.1), 1.0 - smoothstep(0.0, 0.03, ax - 0.6));
    }
    // The street's general light on it (stronger near), so it reads at night.
    asphalt *= 1.0 + 1.2 * smoothstep(8.0, 1.0, rc.y);
    col = asphalt;
  }
  }
  vec3 lights = vec3(0.0);
  // Street lamps: poles and heads, two rows going off to the vanishing point.
  for (int i = 0; i < 11; i++) {
    float z = 1.0 + float(i) * 1.15;
    for (int s = 0; s < 2; s++) {
      float side = s == 0 ? -1.0 : 1.0;
      vec2 c = vp + vec2(side * 0.95 / z, 0.62 / z);
      float pole = box(p, vec2(c.x + side * 0.05 / z, (c.y + vp.y - 0.12 / z) * 0.5), vec2(0.006 / z, (c.y - vp.y + 0.12 / z) * 0.5), 0.0);
      float arm = box(p, c + vec2(side * 0.025 / z, 0.008 / z), vec2(0.03 / z, 0.004 / z), 0.0);
      if (uLayer != 2) col = mix(col, vec3(0.008, 0.008, 0.01), fill(min(pole, arm)) * (1.0 - 0.7 * uFocus));
      if (uLayer == 1) continue;
      float r = (0.075 / z + 0.012) * uBokeh;
      float sodium = hash11(float(i) * 7.0 + float(s) * 3.0) > 0.35 ? 1.0 : 0.0;
      vec3 lc = sodium > 0.5 ? vec3(1.0, 0.55, 0.16) : vec3(0.88, 0.94, 1.0);
      float flick = 1.0 - 0.25 * step(0.995, hash11(floor(lt() * 8.0) + float(i * 2 + s)));
      lights += lc * (bokeh(p, c, r) * 1.6 + streak(p, c, r, roadY)) * flick;
      // The pool of light on the road under it.
      vec2 pd = (p - vec2(c.x - side * 0.25 / z, vp.y - 0.11 / z)) / vec2(0.35 / z, 0.05 / z);
      lights += lc * exp(-dot(pd, pd)) * 0.05;
    }
  }
  // Cars: bodies and their lights, coming on the right lane (headlights), going on the left (tail lights); the
  // nearest one in front.
  float bestZ = 1e5;
  vec3 carCol = vec3(0.0);
  float carA = 0.0;
  for (int k = 0; k < 6; k++) {
    if (uLayer == 1) break;
    float fk = float(k);
    float speed = (0.55 + 0.4 * hash11(fk * 5.1)) * uTraffic;
    float zc = 1.2 + mod(13.0 - (uTime * qr(speed / 13.0) * 13.0 + fk * 2.3), 13.0);
    float zt = 1.2 + mod(uTime * qr(speed * 0.8 / 13.0) * 13.0 + fk * 2.1, 13.0);
    vec3 cc;
    float a = car(p, vp, 0.28, zc, fk, cc) * smoothstep(13.5, 9.0, zc) * step(0.05, uTraffic);
    if (a > 0.01 && zc < bestZ) { bestZ = zc; carCol = cc; carA = a; }
    a = car(p, vp, -0.3, zt, fk + 20.0, cc) * smoothstep(13.5, 9.0, zt) * step(0.05, uTraffic);
    if (a > 0.01 && zt < bestZ) { bestZ = zt; carCol = cc; carA = a; }
    for (int e = 0; e < 2; e++) {
      float ex = e == 0 ? -1.0 : 1.0;
      vec2 ch = vp + vec2((0.28 + ex * 0.09) / zc, -0.09 / zc);
      vec2 ct = vp + vec2((-0.3 + ex * 0.09) / zt, -0.085 / zt);
      float rh = (0.045 / zc + 0.006) * uBokeh, rt = (0.04 / zt + 0.006) * uBokeh;
      lights += vec3(1.0, 0.96, 0.88) * (bokeh(p, ch, rh) * 2.2 + streak(p, ch, rh, roadY) * 1.2) * smoothstep(13.5, 9.0, zc);
      lights += vec3(1.0, 0.08, 0.05) * (bokeh(p, ct, rt) * 1.6 + streak(p, ct, rt, roadY)) * smoothstep(13.5, 9.0, zt);
    }
  }
  float ca = carA * (1.0 - 0.6 * uFocus);
  col = mix(col, carCol, ca);
  // A traffic light on its post: red, green, amber (a 15 s cycle when looping).
  float tper = uLoop > 0.0 ? 15.0 : 14.0;
  float ph = mod(uTime, tper) * 14.0 / tper;
  vec3 tl = ph < 6.0 ? vec3(1.0, 0.1, 0.05) : ph < 12.0 ? vec3(0.15, 1.0, 0.45) : vec3(1.0, 0.6, 0.05);
  vec2 tc = vp + vec2(0.55 / 3.0, 0.48 / 3.0);
  if (uLayer != 2) col = mix(col, vec3(0.006), fill(min(box(p, tc + vec2(0.0, -0.11), vec2(0.004, 0.11), 0.0), box(p, tc, vec2(0.012, 0.03), 0.003))) * (1.0 - 0.7 * uFocus));
  if (uLayer != 1) lights += tl * (bokeh(p, tc, 0.04 * uBokeh) * 2.0 + streak(p, tc, 0.04 * uBokeh, roadY));
  // Neon signs on the facades in Latvian (SIGN_WORDS: KAFEJNĪCA, APTIEKA, VEIKALS high up, a small ATVĒRTS
  // over a shop), flickering now and then: the words sharp when in focus, their tubes' glow round them.
  for (int n = 0; n < 4; n++) {
    if (uLayer == 1) break;
    float fn = float(n);
    vec2 nc = n < 3 ? vec2(gAspect * (0.12 + 0.36 * fn) + 0.1 * sin(fn * 4.0), horizon + 0.12 + 0.1 * hash11(fn * 9.0)) : vec2(gAspect * 0.8, horizon + 0.035);
    vec2 hs = n < 3 ? vec2(0.13, 0.026) : vec2(0.07, 0.014);
    vec3 nl = n == 0 ? vec3(1.0, 0.15, 0.55) : n == 1 ? vec3(0.1, 0.9, 1.0) : n == 2 ? vec3(0.6, 0.25, 1.0) : vec3(1.0, 0.18, 0.08);
    float on = step(0.08, fract(uTime * qr(0.13) + fn * 0.37)) * (1.0 - 0.6 * step(0.97, hash11(floor(lt() * 12.0) + fn)));
    vec2 d = (p - nc) / (hs * vec2(1.15, 1.6)) / uBokeh;
    vec2 q = (p - nc) / hs;
    float words = 0.0, glow = 0.0;
    if (abs(q.x) < 1.2 && abs(q.y) < 1.6) {
      // The word's row in the atlas (rows top down; the canvas's first row is the texture's first).
      vec2 tc = vec2(q.x * 0.5 + 0.5, (fn + 0.5 - q.y * 0.5) / 4.0);
      float inside = step(abs(q.x), 1.0) * step(abs(q.y), 1.0);
      words = texture(uSigns, tc).r * inside;
      glow = textureLod(uSigns, tc, 4.0).r * inside;
    }
    float sharp = words * 1.5 + glow * 0.6 + exp(-dot(d, d) * 1.4) * 0.25;
    lights += nl * mix(sharp, exp(-dot(d, d) * 1.4) * 0.9 + glow * 0.3, uFocus) * on;
  }
  if (uLayer == 2) return vec4(carCol * ca + lights * uLights, ca);
  col += lights * uLights;
  return vec4(col, 1.0);
}

void main() {
  vec2 uv = 0.5 + (gl_FragCoord.xy / uRes - 0.5) / uCam.z + uCam.xy;
  gAspect = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * gAspect, uv.y);
  vec4 st = street(p);
  vec3 col = st.rgb;
  float alpha = st.a;
  // Puddles on the road: a mirror of the street above (the line it mirrors about is the road's edge), trembling
  // with rings from the drizzle; their edges soft only when the street is out of focus.
  float horizon = 0.44, roadY = horizon - 0.02;
  vec2 vp = vec2(gAspect * 0.56, horizon);
  float dz = vp.y - p.y;
  if (uPuddles > 0.0 && p.y < roadY - 0.004 && dz > 0.0) {
    vec2 rc = vec2((p.x - vp.x) * (0.12 / dz), 0.12 / dz);
    float n = fbm(rc * vec2(5.0, 4.5) + vec2(3.1, 7.7));
    float th = 0.63 - uPuddles * 0.08;
    float edge = mix(0.012, 0.06, uFocus) + 0.02 * clamp(rc.y * 0.1, 0.0, 1.0);
    float pm = smoothstep(th, th + edge, n) * (1.0 - smoothstep(0.7, 0.8, abs(rc.x + 0.01))) * smoothstep(13.0, 6.0, rc.y);
    if (pm > 0.0) {
      vec2 rr = rc * vec2(9.0, 3.0);
      vec2 ci = floor(rr), cf = fract(rr) - 0.5;
      float ph = fract(uTime * qr(0.45) + hash12(ci));
      float rl = length(cf);
      // (The still layer's mirror is still; the rings tremble only what moves in it.)
      float ring = uLayer == 1 ? 0.0 : sin((rl - ph * 0.5) * 45.0) * exp(-ph * 3.0) * step(rl, ph * 0.5 + 0.05);
      float wob = uLayer == 1 ? 0.0 : 0.0007 * sin(uTime * qf(1.3) + p.y * 300.0);
      vec2 q = vec2(p.x + ring * 0.0016 + wob, 2.0 * roadY - p.y);
      vec3 refl = street(q).rgb * vec3(0.72, 0.75, 0.82);
      col = mix(col, refl, pm * 0.9);
      alpha *= 1.0 - pm * 0.9;
    }
  }
  o = vec4(col, uLayer == 2 ? alpha : 1.0);
}`;


/** The baked street: the still layer under the moving one (premultiplied, its alpha a car's cover); or the video,
 * cropped to cover the canvas. */
const STREET_COMP = `#version 300 es
precision highp float;
uniform sampler2D uStill; uniform sampler2D uMove; uniform sampler2D uVideo; uniform vec2 uRes; uniform int uMode;
uniform vec2 uCover; uniform float uLights;
// The camera (as in CITY; the baked layers have it already).
uniform vec3 uCam;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  if (uMode == 2 || uMode == 3) {
    uv = 0.5 + (uv - 0.5) / uCam.z + uCam.xy;
    vec2 v = 0.5 + (uv - 0.5) * uCover;
    // The video stores the street's light squeezed into 8 bits as (c / (1 + c))^(1/2.2) (the lamps are far over 1):
    // unsqueezed back to linear light, as the live street is (it was made with «Огни» 1.2).
    vec3 e = pow(texture(uVideo, vec2(v.x, 1.0 - v.y)).rgb, vec3(2.2));
    o = vec4((uMode == 3 ? e : e / max(1.0 - e, 0.03)) * uLights / 1.2, 1.0);
    return;
  }
  vec4 m = texture(uMove, uv);
  o = vec4(texture(uStill, uv).rgb * (1.0 - m.a) + m.rgb, 1.0);
}`;

const BLUR = `#version 300 es
precision highp float;
uniform sampler2D uSrc; uniform vec2 uStep; uniform vec2 uOut; uniform float uThreshold;
out vec4 o;
vec3 tap(vec2 uv) { vec3 c = texture(uSrc, uv).rgb; float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); return uThreshold > 0.0 ? c * max(l - uThreshold, 0.0) / max(l, 1e-4) : c; }
void main() {
  vec2 uv = gl_FragCoord.xy / uOut;
  vec3 c = tap(uv) * 0.227027;
  c += (tap(uv + uStep) + tap(uv - uStep)) * 0.1945946;
  c += (tap(uv + uStep * 2.0) + tap(uv - uStep * 2.0)) * 0.1216216;
  c += (tap(uv + uStep * 3.0) + tap(uv - uStep * 3.0)) * 0.054054;
  c += (tap(uv + uStep * 4.0) + tap(uv - uStep * 4.0)) * 0.016216;
  o = vec4(c, 1.0);
}`;

/** The glass's state, stepped. */
const FOG = `#version 300 es
precision highp float;
uniform sampler2D uFog;
uniform sampler2D uDrops;
uniform vec2 uRes;
uniform float uDt;
uniform float uRegrow;
uniform float uFogMax;
uniform vec4 uWipe;
uniform float uWipeR;
uniform float uWipeOn;
uniform float uTrail;
out vec4 o;
${LIB}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec4 f = texture(uFog, uv);
  float F = f.r, T = f.g, S = f.b, A = f.a;
  // The mist comes back (slower where a drop has left the glass wet), the wet dries, the smear stays long.
  // A running drop's wet trail beads up with fresh condensation much quicker than a wiped patch (uTrail 0: nine times as
  // fast, 0.9: three times slower). (The trails used to stay clear for minutes — mist coming back at a quarter of the speed, the wet drying at 0.025/s —
  // so after a minute the glass looked half dry.)
  F += uDt * uRegrow * (uFogMax - F) * (1.0 - 0.9 * uTrail * T);
  // A trail dries slowly (≈ 30 s), its fine droplets shrinking away as it does.
  T = max(T - uDt * mix(0.03, 0.01, uTrail), 0.0);
  S = max(S - uDt * 0.003, 0.0);
  // Where a drop is: clear and wet.
  if (texture(uDrops, uv).r > 0.02) {
    F = 0.0;
    T = 1.0;
  }
  // The wipe: unevenly, in the cloth's streaks, leaving smears along them.
  if (uWipeOn > 0.5) {
    vec2 p = uv * uRes, a = uWipe.xy, b = uWipe.zw;
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    float d = length(pa - ba * h);
    float brush = 1.0 - smoothstep(uWipeR * 0.55, uWipeR, d);
    if (brush > 0.0) {
      vec2 dir = normalize(ba + vec2(1e-4, 0.0));
      vec2 perp = vec2(-dir.y, dir.x);
      float across = dot(p, perp), along = dot(p, dir);
      // The cloth's streaks: uneven in spacing and strength, wandering a little along the stroke.
      float w = across * (0.55 + 0.5 * vnoise(vec2(along * 0.01, across * 0.02))) + vnoise(vec2(across * 0.12, along * 0.004)) * 9.0;
      float lines = (0.5 + 0.5 * sin(w)) * (0.55 + 0.45 * vnoise(vec2(across * 0.3, along * 0.02)));
      float k = brush * (0.55 + 0.4 * lines);
      F *= 1.0 - k;
      // The finger wipes the fine droplets away too (it used to wet the glass: a fast stroke left a scatter of tiny
      // droplets that dried within a second — they flashed and vanished).
      T *= 1.0 - brush * 0.9;
      S = max(S, brush * (0.3 + 0.7 * smoothstep(0.55, 0.95, lines)) * (0.6 + 0.4 * vnoise(p * 0.05)));
      A = mix(A, fract(atan(dir.y, dir.x) / 3.14159265 + 1.0), brush);
    }
  }
  o = vec4(clamp(F, 0.0, 1.0), T, S, A);
}`;

/** The drops: instanced quads, a dome each (the higher one kept). */
const DROP_V = `#version 300 es
in vec2 aPos;
in vec4 aDrop;
in vec4 aShape;
uniform vec2 uView;
out vec2 vQ;
out float vR;
out float vStretch;
void main() {
  // aDrop: centre (px, y down), radius (of the round drop of the same water), stretch (1 at rest, longer while
  // running). aShape: the axis's angle and the elongation along it (a strand smeared by the cloth: e× longer, as much
  // thinner — the same area).
  float s = aDrop.w;
  float e = max(aShape.y, 1.0);
  float a = aDrop.z * sqrt(e), b = aDrop.z / sqrt(e);
  vec2 ax = vec2(cos(aShape.x), sin(aShape.x));
  vec2 ay = vec2(-ax.y, ax.x);
  vec2 l = aPos * vec2(a * 1.15, b * 1.15);
  vec2 off = ax * l.x + ay * l.y;
  off.y *= s;
  vec2 p = aDrop.xy + off;
  vQ = aPos * 1.15;
  // A strand keeps the drop's water: its height from the drop (a little flatter), so it still reads as water.
  vR = aDrop.z * 0.8;
  vStretch = e > 1.05 ? 1.0 : s;
  gl_Position = vec4(p.x / uView.x * 2.0 - 1.0, 1.0 - p.y / uView.y * 2.0, 0.0, 1.0);
}`;
const DROP_F = `#version 300 es
precision highp float;
in vec2 vQ;
in float vR;
in float vStretch;
out vec4 o;
void main() {
  vec2 q = vQ;
  // Wider at the bottom (y down here), a little pointed at the top while it runs.
  q.x /= 1.0 + 0.22 * q.y * (vStretch - 1.0) * 3.0;
  float d = length(q);
  if (d > 1.0) discard;
  float h = sqrt(1.0 - d * d) * (0.35 + vR / 14.0);
  o = vec4(h, 0.0, 0.0, 1.0);
}`;

const COMPOSE = `#version 300 es
precision highp float;
uniform sampler2D uBg;
uniform sampler2D uBlur;
uniform sampler2D uBright;
uniform sampler2D uFog;
uniform sampler2D uDrops;
uniform sampler2D uBlur2;
uniform sampler2D uBright2;
uniform float uBlurAmt;
uniform float uVeil;
uniform float uGrain;
uniform vec2 uRes;
uniform float uDpr;
uniform float uSmudge;
uniform float uExposure;
uniform float uTime;
out vec4 o;
${LIB}
// Fine droplets left where a drop ran (a cellular scatter, more where wetter): height and mask.
float micro(vec2 px, float wet, out vec2 grad) {
  grad = vec2(0.0);
  if (wet < 0.01) return 0.0;
  vec2 cell = floor(px / 7.0);
  float best = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = cell + vec2(float(i), float(j));
    // As the trail dries each droplet shrinks away smoothly (it used to vanish at once when the wetness fell below its
    // threshold): its size from how far the wetness still is above that threshold.
    float size = clamp((hash12(c) - (1.0 - wet * 0.85)) / 0.15, 0.0, 1.0);
    if (size <= 0.0) continue;
    vec2 ctr = (c + 0.2 + 0.6 * vec2(hash12(c + 1.7), hash12(c + 3.1))) * 7.0;
    float r = (1.0 + 2.2 * hash12(c + 5.3)) * (0.3 + 0.7 * size);
    vec2 d = (px - ctr) / r;
    float dd = dot(d, d);
    if (dd < 1.0) {
      float h = sqrt(1.0 - dd) * size;
      if (h > best) { best = h; grad = -d / max(h, 0.2) / r; }
    }
  }
  return best;
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 px = gl_FragCoord.xy / uDpr;
  vec2 t = 1.0 / uRes;
  vec4 fog = texture(uFog, uv);
  float F = fog.r, wet = fog.g, S = fog.b, A = fog.a;
  // The drops' dome: height and slope.
  float h = texture(uDrops, uv).r;
  vec2 g = vec2(texture(uDrops, uv + vec2(t.x, 0.0)).r - texture(uDrops, uv - vec2(t.x, 0.0)).r,
                texture(uDrops, uv + vec2(0.0, t.y)).r - texture(uDrops, uv - vec2(0.0, t.y)).r) * 0.5 * uDpr;
  vec2 mg;
  float mh = micro(px, wet, mg);
  float drop = smoothstep(0.0, 0.06, h);
  float mdrop = smoothstep(0.0, 0.25, mh);
  vec2 slope = g * 9.0 + mg * 0.9 * mdrop;
  // Through a drop: the street bent (inverted, magnified), sharper; the rim dark (light leaves sideways).
  vec2 ruv = uv - slope * 0.06;
  vec3 clear = texture(uBg, ruv).rgb;
  float rim = smoothstep(0.35, 1.0, length(slope) * 0.5) * max(drop, mdrop);
  // Mist: the street much blurred, milky with the light it scatters, a fine grain of condensation.
  // The condensation's grain: real misted glass has both — the blur, and up close a fine texture of microdroplets;
  // fine and soft (a setting; 0 is a plain blur).
  float grain = 1.0 + uGrain * (0.2 * (vnoise(px * 0.6) - 0.5) + 0.1 * (vnoise(px * 2.3) - 0.5));
  // Real mist scatters the light widely: the blur from the pyramid (none → a quarter-size blur → a sixteenth-size one),
  // the lamps' glare growing with it into big soft halos, a milky veil lit by the street's own light; and the mist is
  // not even (thicker and thinner patches).
  vec3 bq = texture(uBlur, uv).rgb, b2 = texture(uBlur2, uv).rgb;
  vec3 base = uBlurAmt < 1.0 ? mix(texture(uBg, uv).rgb, bq, uBlurAmt) : mix(bq, b2, min(uBlurAmt - 1.0, 1.0));
  vec3 glare = uBlurAmt < 1.0 ? texture(uBright, uv).rgb : mix(texture(uBright, uv).rgb, texture(uBright2, uv).rgb * 1.3, min(uBlurAmt - 1.0, 1.0));
  vec3 veil = (vec3(0.012, 0.014, 0.02) + (uBlurAmt > 1.0 ? b2 : bq) * 0.22) * uVeil;
  vec3 misty = base * (0.86 - 0.08 * uVeil) + glare * 0.9 + veil;
  misty *= grain;
  // The mist is a blur, not a veil over the sharp street (owner: «практически не размывается, а просто беловатое»):
  // mixing the sharp picture in by the mist's density let 8–20 % of it through everywhere, windows showed as squares.
  // Thin mist (a wipe coming back) is a light blur; from 0.45 on it is the full blur with its milkiness — the sharp
  // street only where the glass is really clear. The density varies a little (thicker and thinner patches).
  float uneven = 0.9 + 0.2 * fbm(px * 0.0035 + 3.0);
  float dens = clamp(F * uneven, 0.0, 1.0) * (1.0 - drop);
  // Misting over again (after a wipe) it comes back as it was: the milkiness and the grain grow with the mist.
  vec3 light = (texture(uBlur, uv).rgb * 0.9 + texture(uBright, uv).rgb * 0.5 + veil * 0.6) * mix(1.0, grain, 0.6);
  vec3 col = dens < 0.45 ? mix(clear, light, smoothstep(0.0, 0.45, dens)) : mix(light, misty, smoothstep(0.45, 0.8, dens));
  // Fine droplets left by a running drop show the street through them only while the mist there is thin.
  col = mix(col, clear, mdrop * 0.75 * (1.0 - smoothstep(0.3, 0.7, dens)));
  float mist = dens;
  col *= 1.0 - 0.65 * rim;
  // The lights caught in the drops: a bright point where the dome looks at a lamp.
  vec3 caught = texture(uBright, uv - slope * 0.12).rgb;
  col += caught * (drop + mdrop * 0.5) * smoothstep(0.2, 0.8, length(slope) * 0.6) * 1.2;
  // Smears scatter the lamps' light across their streaks.
  if (S > 0.01) {
    float ang = A * 3.14159265;
    vec2 across = vec2(-sin(ang), cos(ang)) * t * 7.0;
    vec3 sc = vec3(0.0);
    for (int i = 1; i <= 6; i++) sc += (texture(uBright, uv + across * float(i)).rgb + texture(uBright, uv - across * float(i)).rgb) * exp(-float(i) * 0.35);
    float lines = 0.6 + 0.4 * sin(dot(px, vec2(-sin(ang), cos(ang)).yx * vec2(1.0, -1.0)) * 0.9);
    // Only the lamps' light scattered along the smears (no whitish streaks: the glass mists over as a plain blur).
    col += sc * S * uSmudge * 0.35 * lines + vec3(0.02, 0.022, 0.03) * S * uSmudge;
  }
  // Lamps glare a little on the wet clear glass too (vertical streaks of the water film).
  vec3 vs = vec3(0.0);
  for (int i = 1; i <= 4; i++) vs += texture(uBright, uv + vec2(0.0, t.y * 9.0 * float(i))).rgb + texture(uBright, uv - vec2(0.0, t.y * 9.0 * float(i))).rgb;
  col += vs * 0.05 * (1.0 - mist) * (0.3 + wet);
  col = 1.0 - exp(-col * uExposure);
  vec2 vq = uv - 0.5;
  col *= 1.0 - 0.45 * dot(vq, vq);
  o = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
}`;

export const MAX_DROPS = 600;

/** The neon signs' words (one row each in the atlas, in this order; the export of the street's video draws the same). */
export const SIGN_WORDS = ['KAFEJNĪCA', 'APTIEKA', 'VEIKALS', 'ATVĒRTS'];
/** The words, white on black, a row of 1024 × 160 each, a bold narrow sans: the CITY shader's uSigns. */
export function drawSignAtlas() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 160 * SIGN_WORDS.length;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  SIGN_WORDS.forEach((w, i) => {
    let size = 120;
    g.font = `bold ${size}px "Arial Narrow", Arial, sans-serif`;
    while (g.measureText(w).width > 960 && size > 40) {
      size -= 4;
      g.font = `bold ${size}px "Arial Narrow", Arial, sans-serif`;
    }
    g.fillText(w, 512, i * 160 + 84);
  });
  return c;
}
/** Floats per drop: x, y, radius, stretch, axis angle, elongation, 2 unused. */
export const DROP_FLOATS = 8;

export function createFogRenderer(width: number, height: number, cssW: number, cssH: number, photoUrl?: string) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
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
  const program = (fs: string, vs?: WebGLShader) => {
    const p = ctx.createProgram()!;
    ctx.attachShader(p, vs ?? vert);
    ctx.attachShader(p, compile(ctx.FRAGMENT_SHADER, fs));
    ctx.bindAttribLocation(p, 0, 'aPos');
    ctx.bindAttribLocation(p, 1, 'aDrop');
    ctx.bindAttribLocation(p, 2, 'aShape');
    ctx.linkProgram(p);
    if (!ctx.getProgramParameter(p, ctx.LINK_STATUS)) throw new Error(ctx.getProgramInfoLog(p) ?? 'link');
    return p;
  };
  const pCity = program(CITY), pBlur = program(BLUR), pFog = program(FOG), pCompose = program(COMPOSE), pStreet = program(STREET_COMP);
  // The signs' words: a texture with mipmaps (their glow).
  const signs = ctx.createTexture()!;
  ctx.bindTexture(ctx.TEXTURE_2D, signs);
  ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, ctx.RGBA, ctx.UNSIGNED_BYTE, drawSignAtlas());
  ctx.generateMipmap(ctx.TEXTURE_2D);
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.LINEAR_MIPMAP_LINEAR);
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.LINEAR);
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);
  const pDrop = program(DROP_F, compile(gl.VERTEX_SHADER, DROP_V));
  const locs = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
  const u = (p: WebGLProgram, n: string) => {
    let m = locs.get(p);
    if (!m) locs.set(p, (m = new Map()));
    if (!m.has(n)) m.set(n, ctx.getUniformLocation(p, n));
    return m.get(n) ?? null;
  };
  // A full-screen triangle; and a quad for the drops with a per-instance buffer.
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const tri = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, tri);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const dropVao = gl.createVertexArray();
  gl.bindVertexArray(dropVao);
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const inst = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, inst);
  gl.bufferData(gl.ARRAY_BUFFER, MAX_DROPS * DROP_FLOATS * 4, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, DROP_FLOATS * 4, 0);
  gl.vertexAttribDivisor(1, 1);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 4, gl.FLOAT, false, DROP_FLOATS * 4, 16);
  gl.vertexAttribDivisor(2, 1);
  gl.bindVertexArray(null);

  const target = (w: number, h: number, internal: number, format: number, type: number) => {
    const t = ctx.createTexture()!;
    ctx.bindTexture(ctx.TEXTURE_2D, t);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.LINEAR);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.LINEAR);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);
    ctx.texImage2D(ctx.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
    const f = ctx.createFramebuffer()!;
    ctx.bindFramebuffer(ctx.FRAMEBUFFER, f);
    ctx.framebufferTexture2D(ctx.FRAMEBUFFER, ctx.COLOR_ATTACHMENT0, ctx.TEXTURE_2D, t, 0);
    return { t, f, w, h };
  };
  type Target = { t: WebGLTexture; f: WebGLFramebuffer | null; w: number; h: number };
  const quarter = (n: number) => Math.max(1, Math.round(n / 4));
  const bg = target(width, height, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
  // The baked street: its still layer (full size, drawn when its settings change) and the moving one (half size).
  const still = target(width, height, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
  const move = target(Math.max(1, width >> 1), Math.max(1, height >> 1), gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
  let stillKey = '';
  // The video: made when first asked for, the size nearest above the canvas's height.
  let video: HTMLVideoElement | null = null;
  let videoTex: WebGLTexture | null = null;
  let videoOk = false;
  let videoFrame = false;
  const photo = photoUrl ? new Image() : null;
  let photoTex: WebGLTexture | null = null;
  let photoReady = false;
  let photoFailed = false;
  let currentPhotoUrl = photoUrl;
  const retrySmallerPhoto = (reason: string, maxTextureSize = Infinity) => {
    if (!photo || !currentPhotoUrl) return false;
    const next = foggedPhotoFallback(currentPhotoUrl, maxTextureSize);
    if (!next) return false;
    console.warn(`[fogged-blackheads] ${reason}; trying smaller JPEG ${next}`);
    currentPhotoUrl = next;
    photo.src = next;
    return true;
  };
  if (photo) {
    photo.onload = () => {
      if (Math.max(photo.naturalWidth, photo.naturalHeight) > ctx.getParameter(ctx.MAX_TEXTURE_SIZE)) {
        if (retrySmallerPhoto('Photograph exceeds the GPU texture limit', ctx.getParameter(ctx.MAX_TEXTURE_SIZE))) return;
        photoFailed = true;
        console.error('[fogged-blackheads] Photograph exceeds the GPU texture limit');
        return;
      }
      photoTex = ctx.createTexture();
      ctx.bindTexture(ctx.TEXTURE_2D, photoTex);
      ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, ctx.RGBA, ctx.UNSIGNED_BYTE, photo);
      ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.LINEAR);
      ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.LINEAR);
      ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
      ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);
      photoReady = true;
    };
    photo.onerror = () => {
      if (retrySmallerPhoto('Photograph failed to load')) return;
      photoFailed = true;
      console.error('[fogged-blackheads] Background image failed to load', photo.src);
    };
    photo.src = photoUrl!;
  }
  const startVideo = () => {
    const h = STREET_VIDEO_SIZES.find((v) => v >= height * 0.9) ?? 2160;
    const v = document.createElement('video');
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.crossOrigin = 'anonymous';
    if (!v.canPlayType('video/webm; codecs="vp9"')) return;
    v.src = STREET_VIDEO(h);
    v.addEventListener('playing', () => { videoOk = true; });
    const onFrame = () => { videoFrame = true; v.requestVideoFrameCallback?.(onFrame); };
    v.requestVideoFrameCallback?.(onFrame);
    void v.play().catch(() => { videoOk = false; });
    video = v;
    videoTex = ctx.createTexture()!;
    ctx.bindTexture(ctx.TEXTURE_2D, videoTex);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.LINEAR);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.LINEAR);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);
  };
  const qa = target(quarter(width), quarter(height), gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
  const qb = target(quarter(width), quarter(height), gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
  const blur = target(quarter(width), quarter(height), gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
  const bright = target(quarter(width), quarter(height), gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
  // A level down (a sixteenth): the heavy blur of real mist, and the lamps' glare through it.
  const six = (n: number) => Math.max(1, Math.round(n / 16));
  const ea = target(six(width), six(height), gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
  const eb = target(six(width), six(height), gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
  const blur2 = target(six(width), six(height), gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
  const bright2 = target(six(width), six(height), gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
  // The glass's state at half the css size; the drops at full size.
  const fw = Math.max(1, Math.round(cssW / 2)), fh = Math.max(1, Math.round(cssH / 2));
  let fog = [target(fw, fh, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT), target(fw, fh, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT)];
  const drops = target(width, height, gl.R16F, gl.RED, gl.HALF_FLOAT);
  // Fogged all over to start with (at the mist's level, set on the first frame).
  let fogStarted = false;
  for (const t of fog) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.f);
    gl.clearColor(1, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  const run = (p: WebGLProgram, out: Target, textures: [string, WebGLTexture][], set?: (n: (name: string) => WebGLUniformLocation | null) => void) => {
    gl.useProgram(p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, out.f);
    gl.viewport(0, 0, out.w, out.h);
    textures.forEach(([name, t], i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.uniform1i(u(p, name), i);
    });
    set?.((n) => u(p, n));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const blurPass = (src: Target, dst: Target, dx: number, dy: number, threshold = 0) => {
    run(pBlur, dst, [['uSrc', src.t]], (n) => {
      gl.uniform2f(n('uStep'), dx / src.w, dy / src.h);
      gl.uniform2f(n('uOut'), dst.w, dst.h);
      gl.uniform1f(n('uThreshold'), threshold);
    });
  };

  let last = -1;
  return {
    canvas,
    /** drops: x, y (css px, y down), radius (css px), stretch — `count` of them. */
    render(look: FogLook, dropData: Float32Array, count: number, dt: number) {
      gl.bindVertexArray(vao);
      // 1. The street; 2. it blurred (the mist), and its bright part blurred (the glare).
      const mode = Math.round(look.street ?? 0);
      if (!photo && mode === 2 && !video) startVideo();
      const cam = look.cam ?? [0, 0, 1];
      const camZ = camScale(cam);
      const city = (out: Target, layer: number) => run(pCity, out, [['uSigns', signs]], (n) => {
        gl.uniform2f(n('uRes'), out.w, out.h);
        gl.uniform1f(n('uTime'), look.time);
        gl.uniform1f(n('uLights'), look.lights);
        gl.uniform1f(n('uBokeh'), look.bokeh);
        gl.uniform1f(n('uTraffic'), look.traffic);
        gl.uniform1f(n('uFocus'), look.focus);
        gl.uniform1f(n('uPuddles'), look.puddles);
        gl.uniform1i(n('uLayer'), layer);
        gl.uniform1f(n('uLoop'), 0);
        gl.uniform3f(n('uCam'), cam[0], cam[1], camZ);
      });
      if (photo && photoReady && photoTex) {
        const va = photo.naturalWidth / photo.naturalHeight, ca = width / height;
        run(pStreet, bg, [['uVideo', photoTex]], (n) => {
          gl.uniform2f(n('uRes'), bg.w, bg.h);
          gl.uniform1i(n('uMode'), 3);
          gl.uniform2f(n('uCover'), ca < va ? ca / va : 1, ca < va ? 1 : va / ca);
          gl.uniform1f(n('uLights'), look.lights);
          gl.uniform3f(n('uCam'), cam[0], cam[1], camZ);
        });
      } else if (photo) {
        if (photoFailed) throw new Error('Не удалось загрузить фотографию Дома Черноголовых');
        gl.bindFramebuffer(gl.FRAMEBUFFER, bg.f);
        gl.clearColor(.015, .02, .03, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      } else if (mode === 2 && video && videoOk && videoTex && video.videoWidth > 0) {
        if (videoFrame || !video.requestVideoFrameCallback) {
          videoFrame = false;
          gl.bindTexture(gl.TEXTURE_2D, videoTex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        }
        const va = video.videoWidth / video.videoHeight, ca = width / height;
        run(pStreet, bg, [['uVideo', videoTex]], (n) => {
          gl.uniform2f(n('uRes'), bg.w, bg.h);
          gl.uniform1i(n('uMode'), 2);
          gl.uniform2f(n('uCover'), ca < va ? ca / va : 1, ca < va ? 1 : va / ca);
          gl.uniform1f(n('uLights'), look.lights);
          gl.uniform3f(n('uCam'), cam[0], cam[1], camZ);
        });
      } else if (mode === 1) {
        const key = `${look.lights}|${look.bokeh}|${look.focus}|${look.puddles}|${cam.join(',')}`;
        if (key !== stillKey) {
          stillKey = key;
          city(still, 1);
        }
        city(move, 2);
        run(pStreet, bg, [['uStill', still.t], ['uMove', move.t]], (n) => {
          gl.uniform2f(n('uRes'), bg.w, bg.h);
          gl.uniform1i(n('uMode'), 1);
          gl.uniform3f(n('uCam'), 0, 0, 1);
        });
      } else city(bg, 0);
      // (the street is full size now: the first passes reach twice as many of its texels)
      blurPass(bg, qa, 3, 0);
      blurPass(qa, qb, 0, 1.5);
      blurPass(qb, qa, 3.5, 0);
      blurPass(qa, blur, 0, 3.5);
      blurPass(bg, qa, 3, 0, 0.55);
      blurPass(qa, qb, 0, 1.5);
      blurPass(qb, qa, 3, 0);
      blurPass(qa, bright, 0, 3);
      if (look.blur > 1.001) {
        blurPass(blur, ea, 2, 0);
        blurPass(ea, eb, 0, 2);
        blurPass(eb, ea, 2, 0);
        blurPass(ea, blur2, 0, 2);
        blurPass(bright, ea, 2, 0);
        blurPass(ea, eb, 0, 2);
        blurPass(eb, ea, 2, 0);
        blurPass(ea, bright2, 0, 2);
      }
      // 3. The drops' height field.
      gl.bindFramebuffer(gl.FRAMEBUFFER, drops.f);
      gl.viewport(0, 0, drops.w, drops.h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (count > 0) {
        gl.useProgram(pDrop);
        gl.uniform2f(u(pDrop, 'uView'), cssW, cssH);
        gl.bindVertexArray(dropVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, inst);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, dropData.subarray(0, count * DROP_FLOATS));
        gl.enable(gl.BLEND);
        gl.blendEquation(gl.MAX);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);
        gl.blendEquation(gl.FUNC_ADD);
        gl.disable(gl.BLEND);
        gl.bindVertexArray(vao);
      }
      // 4. The glass: mist coming back, drops, the wipe. (First, the mist set at its own level: starting it at 1 and
      // letting it settle to the setting looked like the glass drying.)
      if (!fogStarted) {
        fogStarted = true;
        for (const t of fog) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, t.f);
          gl.clearColor(look.fogMax, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
        }
      }
      run(pFog, fog[1], [['uFog', fog[0].t], ['uDrops', drops.t]], (n) => {
        gl.uniform2f(n('uRes'), fog[1].w, fog[1].h);
        gl.uniform1f(n('uDt'), last < 0 ? 0 : dt);
        gl.uniform1f(n('uRegrow'), look.regrow);
        gl.uniform1f(n('uFogMax'), look.fogMax);
        const k = fog[1].w / cssW;
        const w = look.wipe;
        gl.uniform4f(n('uWipe'), w.a[0] * k, (cssH - w.a[1]) * k, w.b[0] * k, (cssH - w.b[1]) * k);
        gl.uniform1f(n('uWipeR'), w.r * k);
        gl.uniform1f(n('uWipeOn'), w.on ? 1 : 0);
        gl.uniform1f(n('uTrail'), look.trail);
      });
      fog = [fog[1], fog[0]];
      last = look.time;
      // 5. Together.
      const screen: Target = { t: bg.t, f: null, w: width, h: height };
      run(pCompose, screen, [['uBg', bg.t], ['uBlur', blur.t], ['uBright', bright.t], ['uFog', fog[0].t], ['uDrops', drops.t], ['uBlur2', blur2.t], ['uBright2', bright2.t]], (n) => {
        gl.uniform1f(n('uBlurAmt'), look.blur);
        gl.uniform1f(n('uVeil'), look.veil);
        gl.uniform1f(n('uGrain'), look.grain);
        gl.uniform2f(n('uRes'), width, height);
        gl.uniform1f(n('uDpr'), width / cssW);
        gl.uniform1f(n('uSmudge'), look.smudge);
        gl.uniform1f(n('uExposure'), look.exposure);
        gl.uniform1f(n('uTime'), look.time);
      });
    },
    dispose() {
      if (photo) { photo.onload = null; photo.onerror = null; photo.src = ''; }
      if (photoTex) gl.deleteTexture(photoTex);
      video?.pause();
      if (video) video.src = '';
      if (videoTex) gl.deleteTexture(videoTex);
      gl.deleteTexture(signs);
      for (const t of [bg, still, move, qa, qb, blur, bright, ea, eb, blur2, bright2, drops, ...fog]) {
        gl.deleteTexture(t.t);
        gl.deleteFramebuffer(t.f);
      }
      for (const p of [pCity, pBlur, pFog, pCompose, pDrop, pStreet]) gl.deleteProgram(p);
      for (const b of [tri, quad, inst]) gl.deleteBuffer(b);
      gl.deleteVertexArray(vao);
      gl.deleteVertexArray(dropVao);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}

export type FogRenderer = NonNullable<ReturnType<typeof createFogRenderer>>;
