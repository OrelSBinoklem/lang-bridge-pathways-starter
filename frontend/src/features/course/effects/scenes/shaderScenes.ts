import type { ShaderSceneDef } from './types';

/**
 * Scenes that are one fragment shader each. Every scene defines `vec3 scene(vec2 uv, vec2 P, vec2 M, float t)`, see
 * shaderLib.ts. Palettes are four colours: what `uPal[0..3]` holds.
 */
export const SHADER_SCENES: ShaderSceneDef[] = [
  {
    kind: 'shader',
    id: 'aurora',
    label: 'Северное сияние',
    palettes: [['#2be3a5', '#5b8cff', '#c46bff', '#ffffff'], ['#ff5f8a', '#ffb45b', '#7a5bff', '#ffffff'], ['#63f0d0', '#2fa8ff', '#2fe38a', '#ffffff']],
    fragment: `
vec3 scene(vec2 uv, vec2 P, vec2 M, float t) {
  float asp = uRes.x / uRes.y;
  vec3 col = mix(vec3(0.005, 0.01, 0.04), vec3(0.03, 0.05, 0.12), uv.y);
  vec2 sp = uv * vec2(asp, 1.0) * 70.0;
  float h = hash21(floor(sp));
  col += step(0.982, h) * (0.4 + 0.6 * sin(t * 2.0 + h * 40.0)) * 0.7;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float y0 = 0.42 + 0.1 * fi + 0.07 * sin(P.x * 1.4 + t * 0.35 + fi * 2.0) + 0.04 * fbm(vec2(P.x * 2.0 + fi * 5.0, t * 0.1));
    y0 += uK.z * 0.16 * exp(-pow(P.x - M.x, 2.0) * 1.3) * (M.y * 0.4 + 0.1) * sin(t * 0.7 + fi);
    float d = uv.y - y0;
    float band = exp(-max(d, 0.0) * 2.6 - max(-d, 0.0) * 16.0);
    float rays = 0.55 + 0.45 * noise(vec2(P.x * 16.0 + fi * 9.0, t * 0.5));
    band *= (0.45 + 0.55 * fbm(vec2(P.x * 1.7 + t * 0.12 + fi * 4.0, uv.y * 3.0)));
    col += pal(0.1 + 0.35 * fi + 0.1 * sin(t * 0.3 + fi)) * band * rays * uK.y * 1.1;
  }
  float ridge = 0.12 + 0.06 * fbm(vec2(P.x * 1.6, 0.0)) + 0.04 * sin(P.x * 3.0);
  col = mix(col, vec3(0.01, 0.015, 0.03), smoothstep(ridge + 0.005, ridge - 0.005, uv.y));
  return col;
}`,
  },
  {
    kind: 'shader',
    id: 'rain-glass',
    label: 'Дождь на стекле',
    palettes: [['#ff7a3c', '#3c8cff', '#ffd25a', '#ff4f8b'], ['#5affc8', '#5a7cff', '#c95aff', '#ffe25a']],
    fragment: `
vec3 bokeh(vec2 st, float t) {
  vec3 c = mix(uPal[1], uPal[0], smoothstep(0.0, 1.0, st.y)) * 0.18;
  for (int i = 0; i < 3; i++) {
    float sc = 4.0 + float(i) * 4.5;
    vec2 g = st * sc + vec2(t * 0.03 * float(i + 1), float(i) * 3.1);
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    vec2 o = (hash22(id + float(i) * 13.0) - 0.5) * 0.5;
    float r = 0.16 + 0.22 * hash21(id + 3.3);
    float m = smoothstep(1.0, 0.75, length(f - o) / r) * step(0.45, hash21(id + 9.1));
    c += pal(hash21(id + 1.7)) * m * (0.5 + 0.2 * float(i));
  }
  return c;
}
vec3 scene(vec2 uv, vec2 P, vec2 M, float t) {
  float asp = uRes.x / uRes.y;
  vec2 st = uv * vec2(asp, 1.0);
  vec2 offs = vec2(0.0);
  float mask = 0.0;
  float wipe = clamp(trail(P, 0.26) * uK.z, 0.0, 1.0);
  for (int i = 0; i < 2; i++) {
    float sc = 7.0 + float(i) * 6.0;
    vec2 g = st * sc;
    g.y += t * (0.15 + 0.1 * float(i)) * step(0.5, hash21(floor(g) + 5.0));
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    vec2 o = (hash22(id + float(i) * 7.7) - 0.5) * 0.5;
    float r = 0.14 + 0.18 * hash21(id + 1.3);
    float run = step(0.72, hash21(id + 4.4));
    vec2 q = f - o;
    q.y = q.y * (1.0 - 0.6 * run) + run * 0.0;
    float d = length(q) / r;
    float dropMask = smoothstep(1.0, 0.7, d) * step(0.35, hash21(id + 8.8));
    offs += -q / r * 0.06 * dropMask;
    mask += dropMask * (1.0 - wipe);
  }
  vec3 blurred = bokeh(st * 0.5 + 0.0, t);
  vec3 sharp = bokeh(st + offs * (1.0 - wipe), t);
  vec3 col = mix(blurred * 0.6, sharp * 1.4, clamp(mask, 0.0, 1.0));
  col = mix(col, bokeh(st, t) * 1.1, wipe);
  col += vec3(0.5, 0.6, 0.8) * 0.06 * clamp(mask, 0.0, 1.0);
  return col * (0.7 + 0.5 * uK.y);
}`,
  },
  {
    kind: 'shader',
    id: 'sunset',
    label: 'Закат',
    palettes: [['#231a4d', '#c4467a', '#ff9a4d', '#ffe6a3'], ['#0e2a5c', '#4a78c9', '#ffb37a', '#fff2c9'], ['#2a103a', '#a02a63', '#ff6a3d', '#ffd27a']],
    fragment: `
vec3 scene(vec2 uv, vec2 P, vec2 M, float t) {
  float asp = uRes.x / uRes.y;
  float horizon = 0.3;
  float sunY = horizon + 0.14 + 0.06 * sin(t * 0.1) + (0.5 - uPointer.y) * 0.1 * uK.z * uPointer.z;
  vec2 sp = vec2((uv.x - 0.66 - (uPointer.x - 0.5) * 0.08 * uK.z) * asp, uv.y - sunY);
  vec3 col = mix(uPal[2], uPal[1], smoothstep(horizon, horizon + 0.4, uv.y));
  col = mix(col, uPal[0], smoothstep(horizon + 0.3, 1.0, uv.y));
  float dsun = length(sp);
  col += uPal[3] * (smoothstep(0.1, 0.085, dsun) * 1.3 + 0.55 * exp(-dsun * 3.5)) * uK.y;
  float clouds = fbm(vec2(P.x * 1.1 + t * 0.04, uv.y * 6.0 + 0.6 * fbm(vec2(P.x * 2.0, t * 0.05))));
  float band = smoothstep(0.5, 0.78, clouds) * smoothstep(horizon, horizon + 0.12, uv.y) * smoothstep(0.85, 0.4, uv.y);
  col = mix(col, mix(uPal[2], uPal[3], 0.5) * 1.05, band * 0.55 * (0.4 + exp(-abs(uv.y - sunY - 0.05) * 3.0)));
  float b = floor(uv.x * asp * 10.0);
  float h = 0.05 + 0.13 * hash11(b) * step(0.3, hash11(b * 3.1));
  float ground = horizon - 0.08 + h + 0.02 * noise(vec2(uv.x * asp * 4.0, 1.0));
  vec3 sil = vec3(0.03, 0.02, 0.05);
  float win = step(0.86, hash21(floor(vec2(uv.x * asp * 40.0, uv.y * 30.0)))) * step(0.5, hash11(b + 9.0));
  sil += uPal[3] * 0.5 * win * smoothstep(0.02, 0.0, uv.y - ground + 0.06) * step(uv.y, ground - 0.01);
  col = mix(col, sil, smoothstep(ground + 0.004, ground - 0.004, uv.y));
  return col;
}`,
  },
  {
    kind: 'shader',
    id: 'ocean',
    label: 'Море на закате',
    palettes: [['#ff7a4d', '#ffcf7a', '#0f3a5c', '#e8f6ff'], ['#7ab6ff', '#dff2ff', '#0a4a6a', '#ffffff']],
    fragment: `
vec3 scene(vec2 uv, vec2 P, vec2 M, float t) {
  float asp = uRes.x / uRes.y;
  float horizon = 0.5;
  vec3 col;
  float sunX = 0.5 + (uPointer.x - 0.5) * 0.4 * uK.z * uPointer.z;
  if (uv.y > horizon) {
    float s = (uv.y - horizon) / (1.0 - horizon);
    col = mix(uPal[1], uPal[0], smoothstep(0.0, 0.5, s));
    col = mix(col, uPal[2] * 0.6, smoothstep(0.4, 1.0, s));
    float d = length(vec2((uv.x - sunX) * asp, (uv.y - horizon - 0.04) * 1.6));
    col += uPal[3] * (smoothstep(0.12, 0.1, d) + 0.4 * exp(-d * 3.0)) * uK.y;
  } else {
    float depth = horizon - uv.y;
    float zz = 1.0 / (depth + 0.06);
    float X = (uv.x - 0.5) * asp * zz * 0.5;
    float w = fbm(vec2(X * 1.5 + t * 0.15, zz * 0.9 - t * 0.5));
    float w2 = fbm(vec2(X * 4.0 - t * 0.2, zz * 2.5 - t * 0.9));
    float h = w * 0.7 + w2 * 0.3;
    vec3 water = mix(uPal[2], uPal[2] * 0.25, smoothstep(0.0, 0.5, depth));
    water += uPal[0] * 0.25 * exp(-depth * 4.0);
    float column = exp(-pow((uv.x - sunX) * asp / (0.05 + depth * 0.7), 2.0));
    float glitter = pow(smoothstep(0.55, 0.9, h + noise(vec2(X * 30.0, zz * 9.0 - t * 2.0)) * 0.5), 3.0);
    col = water + (uPal[1] * glitter * column * 2.4 + uPal[0] * column * 0.35) * uK.y;
    float r = length(P - M);
    col += uPal[3] * uK.z * uPointer.z * 0.35 * exp(-r * 5.0) * (0.5 + 0.5 * sin(r * 40.0 - t * 6.0));
  }
  return col;
}`,
  },
  {
    kind: 'shader',
    id: 'glitter',
    label: 'Блёстки',
    palettes: [['#3a0a2e', '#160a26', '#ff8ad4', '#ffd45a'], ['#03202a', '#0a0a1c', '#5affe6', '#ff7ad9'], ['#1a1030', '#08060f', '#ff5ac8', '#5ab8ff']],
    fragment: `
vec3 scene(vec2 uv, vec2 P, vec2 M, float t) {
  float asp = uRes.x / uRes.y;
  vec3 base = mix(uPal[0], uPal[1], uv.y) * 0.5;
  float ld = length(P - M);
  base += uPal[2] * exp(-ld * ld * 1.6) * 0.3 * uK.z;
  vec3 col = base;
  for (int i = 0; i < 2; i++) {
    float sc = 55.0 + float(i) * 35.0;
    vec2 st = uv * vec2(asp, 1.0) * sc;
    vec2 id = floor(st);
    vec2 f = fract(st) - 0.5;
    float h = hash21(id + float(i) * 31.0);
    vec2 o = (hash22(id + 2.0) - 0.5) * 0.5;
    float tw = pow(max(0.0, sin(t * (1.0 + h * 3.0) + h * 40.0) * 0.5 + 0.5), 5.0);
    float lit = 0.25 + 1.6 * exp(-ld * ld * 1.2) * uK.z + 0.5 * trail(P, 0.25) * uK.z;
    float spark = smoothstep(0.3 * h + 0.06, 0.0, length(f - o)) * tw * lit;
    col += pal(h) * spark * 3.0 * uK.y + vec3(spark * spark) * 2.0;
  }
  return col;
}`,
  },
  {
    kind: 'shader',
    id: 'soap-film',
    label: 'Мыльная плёнка',
    palettes: [['#ff6ad5', '#6ad5ff', '#ffe36a', '#8a6aff'], ['#6affc8', '#6a8aff', '#ff6a9a', '#ffe36a']],
    fragment: `
vec3 scene(vec2 uv, vec2 P, vec2 M, float t) {
  vec2 w = vec2(fbm(P * 1.6 + vec2(t * 0.1, 0.0)), fbm(P * 1.6 + vec2(3.1, -t * 0.08)));
  float th = fbm(P * 1.3 + 1.8 * w + vec2(0.0, -t * 0.06));
  th += 0.22 * exp(-dot(P - M, P - M) * 2.2) * uK.z + 0.25 * trail(P, 0.3) * uK.z;
  vec3 film = 0.5 + 0.5 * cos(6.2831 * (th * 2.4 + vec3(0.0, 0.33, 0.67)));
  film = mix(film, pal(th * 1.3), 0.4);
  float body = smoothstep(0.15, 0.65, th);
  vec3 bg = vec3(0.02, 0.025, 0.06);
  float shine = pow(smoothstep(0.55, 0.95, fbm(P * 2.5 - t * 0.05)), 3.0);
  return bg + film * (0.25 + 0.6 * body) * uK.y + shine * 0.35;
}`,
  },
  {
    kind: 'shader',
    id: 'bokeh-warm',
    label: 'Тёплые огни',
    palettes: [['#ff9a4d', '#c4467a', '#ffe0a3', '#ff6a4d'], ['#ffb84d', '#a8452f', '#fff0c8', '#ff8a3d']],
    fragment: `
vec3 scene(vec2 uv, vec2 P, vec2 M, float t) {
  float asp = uRes.x / uRes.y;
  vec3 col = mix(uPal[1] * 0.35, vec3(0.05, 0.02, 0.05), uv.y) + uPal[0] * 0.12 * exp(-dot(P - M, P - M) * 1.2) * uK.z;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float sc = 3.5 + fi * 3.0;
    vec2 g = uv * vec2(asp, 1.0) * sc;
    g += vec2(t * 0.06 * (fi + 1.0), sin(t * 0.2 + fi) * 0.3);
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    vec2 o = (hash22(id + fi * 11.0) - 0.5) * 0.45;
    float r = 0.15 + 0.25 * hash21(id + 5.0);
    float d = length(f - o) / r;
    float disc = smoothstep(1.0, 0.85, d) * (0.5 + 0.5 * smoothstep(0.6, 1.0, d));
    float on = step(0.4, hash21(id + 7.0));
    float glow = 1.0 + 1.5 * exp(-dot(P - M, P - M) * 2.0) * uK.z;
    col += pal(hash21(id + 1.0)) * disc * on * (0.28 + 0.12 * fi) * glow * uK.y;
  }
  return col;
}`,
  },
  {
    kind: 'shader',
    id: 'mist-forest',
    label: 'Туман в лесу',
    palettes: [['#0c1f1a', '#2a5a48', '#bfe8c8', '#ffe9a8'], ['#10182a', '#34507a', '#b8d8ff', '#fff0c0']],
    fragment: `
vec3 scene(vec2 uv, vec2 P, vec2 M, float t) {
  float asp = uRes.x / uRes.y;
  vec3 col = mix(uPal[1] * 0.6, uPal[0], uv.y);
  vec2 lp = vec2(0.3 + (uPointer.x - 0.5) * 0.3 * uK.z * uPointer.z, 1.05);
  float ray = 0.0;
  vec2 d = uv - lp;
  float ang = atan(d.x, -d.y);
  ray = pow(0.5 + 0.5 * sin(ang * 14.0 + t * 0.2 + 2.0 * fbm(vec2(ang * 3.0, t * 0.1))), 3.0) * smoothstep(1.4, 0.0, length(d));
  col += uPal[3] * ray * 0.35 * uK.y;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float sc = 6.0 + fi * 3.0;
    float base = 0.18 + fi * 0.09;
    float cell = floor(uv.x * asp * sc + fi * 13.0);
    float hh = 0.12 + 0.25 * hash11(cell + fi * 5.0);
    float fx = fract(uv.x * asp * sc + fi * 13.0) - 0.5;
    float tree = step(uv.y - base, hh * (1.0 - abs(fx) * 1.9)) * step(base - 0.06, uv.y) * step(0.3, hash11(cell + fi * 2.0));
    vec3 tc = mix(vec3(0.01, 0.03, 0.03), uPal[0] * 0.7, fi * 0.28);
    col = mix(col, tc, tree);
    float mist = fbm(vec2(uv.x * asp * 1.4 + t * (0.03 + 0.02 * fi), uv.y * 3.0 + fi * 7.0));
    col = mix(col, uPal[2] * 0.75, smoothstep(0.45, 0.85, mist) * 0.18 * (1.0 - fi * 0.1) * smoothstep(base - 0.1, base + 0.25, uv.y));
  }
  float fl = step(0.985, hash21(floor(uv * vec2(asp, 1.0) * 30.0 + vec2(0.0, t * 0.05)))) * (0.5 + 0.5 * sin(t * 3.0 + uv.x * 40.0));
  col += uPal[3] * fl * 0.6;
  return col;
}`,
  },
  {
    kind: 'shader',
    id: 'mountains',
    label: 'Горы на рассвете',
    palettes: [['#1a1f4a', '#e0607a', '#ffb070', '#fff0c0'], ['#0a2a3a', '#3a8aaa', '#a8e0ff', '#ffffff']],
    fragment: `
vec3 scene(vec2 uv, vec2 P, vec2 M, float t) {
  float asp = uRes.x / uRes.y;
  vec3 col = mix(uPal[2], uPal[1], smoothstep(0.2, 0.7, uv.y));
  col = mix(col, uPal[0], smoothstep(0.55, 1.0, uv.y));
  vec2 sun = vec2(0.5 + (uPointer.x - 0.5) * 0.2 * uK.z * uPointer.z, 0.42);
  float ds = length((uv - sun) * vec2(asp, 1.0));
  col += uPal[3] * (smoothstep(0.09, 0.07, ds) + 0.5 * exp(-ds * 3.0)) * uK.y;
  float par = (uPointer.x - 0.5) * uK.z * uPointer.z;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float x = uv.x * asp * (1.4 + fi * 0.4) + par * (0.15 + fi * 0.12) + fi * 10.0;
    float h = 0.16 + fi * 0.06 + 0.22 * fbm(vec2(x * 1.3, fi * 3.0)) * (0.6 + 0.2 * fi);
    float m = smoothstep(h + 0.003, h - 0.003, uv.y - 0.0);
    vec3 mc = mix(uPal[1] * 0.7, vec3(0.02, 0.03, 0.06), fi / 4.0);
    mc = mix(mc, uPal[2], exp(-(h - uv.y) * 14.0) * 0.4 * (1.0 - fi / 5.0));
    col = mix(col, mc, m);
  }
  return col;
}`,
  },
  {
    kind: 'shader',
    id: 'rainbow',
    label: 'Радуга',
    palettes: [['#6ac0ff', '#dff4ff', '#ffe27a', '#ffffff'], ['#ff9ac8', '#ffe0f0', '#ffd96a', '#ffffff']],
    fragment: `
vec3 scene(vec2 uv, vec2 P, vec2 M, float t) {
  float asp = uRes.x / uRes.y;
  vec3 col = mix(uPal[1], uPal[0], smoothstep(0.0, 1.0, uv.y));
  vec2 sun = vec2(0.86, 0.85);
  float ds = length((uv - sun) * vec2(asp, 1.0));
  col += uPal[2] * (smoothstep(0.08, 0.06, ds) + 0.35 * exp(-ds * 3.0));
  vec2 c = vec2(0.5 + (uPointer.x - 0.5) * 0.25 * uK.z * uPointer.z, -0.25);
  float r = length((uv - c) * vec2(asp, 1.0));
  float band = (r - 0.62) / 0.16;
  float show = smoothstep(0.0, 0.25, uv.y) * (0.55 + 0.45 * uK.z * clamp(uPointer.z + 0.3, 0.0, 1.0));
  vec3 rb = 0.5 + 0.5 * cos(6.2831 * (band * 0.75 + vec3(0.0, 0.33, 0.67)));
  float mask = smoothstep(1.0, 0.7, abs(band * 2.0 - 1.0)) * step(0.0, band) * step(band, 1.0);
  col = mix(col, rb, mask * 0.6 * show * uK.y);
  float cl = fbm(vec2(P.x * 1.4 + t * 0.06, uv.y * 4.0));
  col = mix(col, vec3(1.0), smoothstep(0.55, 0.85, cl) * smoothstep(0.1, 0.4, uv.y) * 0.75);
  return col;
}`,
  },
  {
    kind: 'shader',
    id: 'time-vortex',
    label: 'Вихрь времени',
    palettes: [['#e0b45a', '#ff7a4d', '#5a7cff', '#fff2c8'], ['#5affc8', '#5a7cff', '#c95aff', '#ffffff']],
    fragment: `
vec3 scene(vec2 uv, vec2 P, vec2 M, float t) {
  vec2 q = P - M * 0.35 * uK.z;
  float r = length(q);
  float a = atan(q.y, q.x);
  vec3 col = vec3(0.02, 0.02, 0.05);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float rr = r * (1.0 + fi * 0.0) - 0.18 * fi;
    float ring = fi * 0.32 + 0.25;
    float dir = mod(fi, 2.0) < 1.0 ? 1.0 : -1.0;
    float ang = a + t * (0.25 + 0.12 * fi) * dir;
    float ticks = smoothstep(0.03, 0.0, abs(fract(ang * (12.0 + 6.0 * fi) / 6.2831) - 0.5) - 0.46);
    float band = smoothstep(0.05, 0.0, abs(r - ring));
    float hand = smoothstep(0.02, 0.0, abs(sin(ang - t * dir * 0.6))) * step(r, ring) * step(0.05, r);
    col += pal(fi / 3.0) * (band * (0.25 + 0.75 * ticks) + hand * 0.25 * (1.0 - r / ring)) * uK.y;
    col += pal(fi / 3.0) * 0.05 * exp(-abs(r - ring) * 12.0);
  }
  col += uPal[3] * 0.35 * exp(-r * 4.0);
  col += uPal[0] * 0.2 * trail(P, 0.25) * uK.z;
  return col;
}`,
  },
];
