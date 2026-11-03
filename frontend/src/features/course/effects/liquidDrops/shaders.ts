/**
 * GLSL for the liquid-drops background. three.js compiles these as GLSL ES 3.00, so `texelFetch`,
 * dynamic loop bounds and `int` uniforms are available even though the code uses the old-style
 * `varying` / `texture2D` / `gl_FragColor` names.
 *
 * The glass model (edge refraction by Snell's law, dispersion, fresnel rim, glare, frosted blur,
 * tint) follows the technique of Liquid Glass Studio by iyinchao (MIT):
 * https://github.com/iyinchao/liquid-glass-studio. The shape is different: here it is a metaball
 * field over a grid of drops instead of one or two SDF shapes.
 */

export const VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

/** Pass 1: the picture that lies under the glass. */
export const BACKGROUND_FRAGMENT = `
precision highp float;
varying vec2 vUv;
uniform vec2 uResolution;
uniform float uTime;
uniform int uScene;
uniform float uBrightness;
uniform float uSaturation;
uniform sampler2D uCustom;
uniform float uCustomAspect;
uniform vec2 uCustomFocus;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
// smoothstep whose edges may be reversed (the built-in one is undefined for edge0 >= edge1).
float rs(float a, float b, float x) {
  float t = clamp((x - a) / (b - a), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    sum += amp * vnoise(p);
    p = p * 2.03 + vec2(17.1, 9.7);
    amp *= 0.5;
  }
  return sum;
}

// Terraced turquoise pools stepping down a misty green mountainside at sunrise.
vec3 mountainPools(vec2 uv, float aspect, float t) {
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec3 sky = mix(vec3(0.99, 0.90, 0.70), vec3(0.50, 0.82, 0.80), smoothstep(0.30, 0.95, uv.y));
  float sun = exp(-length((uv - vec2(0.70, 0.60)) * vec2(aspect, 1.0)) * 3.2);
  sky += vec3(1.0, 0.86, 0.55) * sun * 0.55;
  vec3 col = sky;
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    float ridge = 0.54 - fk * 0.07 + (0.20 - fk * 0.03) * fbm(vec2(p.x * (1.1 + fk * 0.55) + fk * 7.3, fk * 3.1));
    float inside = rs(0.004, -0.004, uv.y - ridge);
    vec3 far = mix(vec3(0.60, 0.80, 0.77), vec3(0.06, 0.26, 0.20), fk / 3.0);
    float haze = smoothstep(ridge - 0.30, ridge, uv.y);
    vec3 shaded = mix(far, vec3(0.86, 0.95, 0.90), (1.0 - haze) * (0.55 - 0.12 * fk));
    col = mix(col, shaded, inside);
  }
  float pools = 0.42;
  if (uv.y < pools) {
    float py = uv.y / pools * 4.0;
    float band = floor(py);
    float f = fract(py);
    vec3 water = mix(vec3(0.08, 0.60, 0.60), vec3(0.30, 0.86, 0.74), hash11(band + 3.0));
    vec2 cp = p * vec2(7.0, 4.5) + vec2(t * 0.12, band * 2.3);
    float lines = abs(sin(cp.x * 2.0 + fbm(cp + t * 0.15) * 6.0) + sin(cp.y * 3.0 + fbm(cp * 1.3 - t * 0.12) * 6.0));
    water += vec3(0.55, 0.92, 0.86) * pow(rs(1.4, 0.0, lines), 3.0) * 0.4;
    float rim = rs(0.07, 0.0, f) + smoothstep(0.90, 1.0, f) * 0.35;
    vec3 stone = vec3(0.74, 0.72, 0.64) * (0.7 + 0.3 * fbm(p * 22.0));
    water = mix(water, stone, clamp(rim, 0.0, 1.0));
    col = mix(water, sky, 0.14);
  }
  return col;
}

// Green cedar slats, warm lamps and drifting steam.
vec3 sauna(vec2 uv, float aspect, float t) {
  vec2 p = vec2(uv.x * aspect, uv.y);
  float sx = p.x * 11.0;
  float id = floor(sx);
  float fx = fract(sx);
  float grain = fbm(vec2(sx * 3.5, p.y * 1.3 + id * 5.1));
  vec3 wood = mix(vec3(0.09, 0.19, 0.12), vec3(0.24, 0.35, 0.19), hash11(id * 1.7) * 0.6 + grain * 0.5);
  wood *= 0.75 + 0.5 * grain;
  wood *= mix(0.22, 1.0, smoothstep(0.0, 0.05, fx) * rs(1.0, 0.95, fx));
  vec3 col = wood;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 c = vec2((0.22 + 0.30 * fi) * aspect, 0.78 - 0.06 * sin(fi * 2.1));
    float flick = 0.92 + 0.08 * sin(t * 1.7 + fi * 3.0);
    float d = length(vec2(uv.x * aspect, uv.y) - c);
    col += vec3(1.0, 0.66, 0.30) * exp(-d * d * 9.0) * 0.85 * flick;
    col += vec3(1.0, 0.82, 0.52) * rs(0.035, 0.018, d) * 0.9 * flick;
  }
  float stove = length((uv - vec2(0.86, 0.08)) * vec2(aspect, 1.0));
  col += vec3(0.90, 0.36, 0.12) * exp(-stove * 3.5) * 0.55;
  float s1 = fbm(vec2(p.x * 2.2 + t * 0.05, p.y * 1.4 - t * 0.12));
  float s2 = fbm(vec2(p.x * 3.0 + 3.1 - t * 0.04, p.y * 2.0 - t * 0.18) + s1 * 1.5);
  col = mix(col, vec3(0.86, 0.96, 0.90), clamp(smoothstep(0.45, 0.85, s2), 0.0, 1.0) * 0.42);
  col *= 1.0 - 0.35 * length((uv - 0.5) * vec2(0.9, 1.1));
  return col;
}

// Big soft leaves, light shafts and bokeh over a teal-to-lime gradient.
float leafDistance(vec2 p, vec2 c, float ang, vec2 size) {
  vec2 q = p - c;
  float s = sin(ang);
  float co = cos(ang);
  q = vec2(co * q.x + s * q.y, -s * q.x + co * q.y) / size;
  float width = pow(max(1.0 - q.x * q.x, 0.0), 0.8) * 0.55;
  return abs(q.y) - width;
}
vec3 spaLeaves(vec2 uv, float aspect, float t) {
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec3 col = mix(vec3(0.04, 0.34, 0.33), vec3(0.62, 0.84, 0.40), smoothstep(0.0, 1.1, uv.x * 0.6 + uv.y * 0.7));
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    vec2 c = vec2(hash11(fi * 3.7 + 1.0) * aspect, hash11(fi * 5.3 + 2.0));
    float ang = hash11(fi * 7.1 + 3.0) * 3.14159 + 0.06 * sin(t * 0.3 + fi);
    float scale = 0.42 + hash11(fi * 2.9 + 4.0) * 0.36;
    float blur = mix(0.012, 0.09, hash11(fi * 4.3 + 5.0));
    float d = leafDistance(p, c, ang, vec2(scale, scale * 0.8));
    float mask = rs(blur, -blur, d * scale);
    vec3 leaf = mix(vec3(0.03, 0.30, 0.20), vec3(0.42, 0.70, 0.26), hash11(fi * 6.1 + 7.0));
    vec2 q = p - c;
    float along = q.x * cos(ang) + q.y * sin(ang);
    float across = -q.x * sin(ang) + q.y * cos(ang);
    leaf *= 1.0 - 0.28 * rs(0.02 + blur, 0.0, abs(across));
    leaf *= 0.85 + 0.3 * fbm(vec2(along * 6.0, across * 20.0));
    col = mix(col, leaf, mask * 0.92);
  }
  float shaft = pow(max(0.0, sin((p.x * 1.2 - p.y * 0.8) * 9.0 + fbm(p * 1.5 + t * 0.04) * 3.0)) * 0.5 + 0.5, 4.0);
  col += vec3(1.0, 0.95, 0.65) * shaft * 0.10 * smoothstep(0.2, 0.95, uv.y);
  for (int layer = 0; layer < 2; layer++) {
    float scale = 5.0 + float(layer) * 4.0;
    vec2 g = p * scale + float(layer) * 13.0;
    vec2 cell = floor(g);
    vec2 jitter = vec2(hash21(cell), hash21(cell + 7.7));
    float r = 0.18 + 0.22 * hash21(cell + 3.3);
    float d = length(fract(g) - jitter);
    col += vec3(0.90, 1.0, 0.72) * rs(r, r * 0.55, d) * 0.10 * step(0.6, hash21(cell + 1.1));
  }
  return col;
}

// A rock arch opening on a misty valley, with a glowing pool below it.
vec3 grottoAbove(vec2 p, float t) {
  float r1 = fbm(p * 3.5 + vec2(1.3, 0.7));
  float r2 = fbm(p * 8.0 - r1 * 2.0);
  vec3 rock = mix(vec3(0.05, 0.09, 0.08), vec3(0.22, 0.31, 0.26), r2) * (0.6 + 0.6 * r1);
  vec2 o = vec2(p.x / 0.55, (p.y - 0.10) / 0.62);
  float hole = rs(1.05, 0.85, length(o));
  vec3 view = mix(vec3(0.78, 0.94, 0.84), vec3(0.30, 0.66, 0.52), smoothstep(-0.1, 0.9, -p.y + 0.35));
  view += vec3(1.0, 0.90, 0.60) * exp(-length(p - vec2(0.10, 0.25)) * 4.0) * 0.5;
  vec3 col = mix(rock, view, hole);
  float ray = pow(max(0.0, sin(atan(p.y - 0.30, p.x) * 14.0 + fbm(p * 2.0 + t * 0.05) * 3.0)) * 0.5 + 0.5, 3.0);
  col += vec3(0.70, 1.0, 0.85) * ray * 0.12 * (1.0 - hole) * rs(1.2, 0.0, length(p - vec2(0.0, 0.30)));
  return col;
}
vec3 grotto(vec2 uv, float aspect, float t) {
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  float waterline = -0.16;
  if (p.y >= waterline) return grottoAbove(p, t);
  float depth = waterline - p.y;
  float ripple = (fbm(vec2(p.x * 6.0, p.y * 30.0 + t * 0.6)) - 0.5) * 0.06 * (1.0 + depth * 3.0);
  vec3 reflection = grottoAbove(vec2(p.x + ripple, waterline + depth * 0.9), t);
  vec3 deep = mix(vec3(0.02, 0.32, 0.34), vec3(0.06, 0.62, 0.58), smoothstep(0.0, 0.5, depth));
  vec3 col = mix(deep, reflection, 0.5);
  float lines = abs(sin(p.x * 14.0 + fbm(p * 5.0 + t * 0.2) * 5.0) + sin(p.y * 22.0 + t * 0.5));
  col += vec3(0.5, 1.0, 0.9) * pow(rs(1.2, 0.0, lines), 3.0) * 0.16;
  col += vec3(0.6, 1.0, 0.85) * exp(-depth * 40.0) * 0.4;
  return col;
}

// "cover" fit; when the picture is larger than the screen in one direction, focus picks the part that is shown.
vec2 coverUv(vec2 uv, float aspect, float imageAspect, vec2 focus) {
  vec2 s = aspect > imageAspect ? vec2(1.0, imageAspect / aspect) : vec2(aspect / imageAspect, 1.0);
  vec2 center = clamp(focus, s * 0.5, 1.0 - s * 0.5);
  return (uv - 0.5) * s + center;
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / uResolution.y;
  vec3 col;
  if (uScene == 0) col = mountainPools(uv, aspect, uTime);
  else if (uScene == 1) col = sauna(uv, aspect, uTime);
  else if (uScene == 2) col = spaLeaves(uv, aspect, uTime);
  else if (uScene == 3) col = grotto(uv, aspect, uTime);
  else col = texture2D(uCustom, coverUv(uv, aspect, uCustomAspect, uCustomFocus)).rgb;
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(luma), col, uSaturation) * uBrightness;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

/** Pass 2 (run twice, horizontal then vertical): the frosted copy of the picture. */
export const BLUR_FRAGMENT = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uStep;
void main() {
  vec3 sum = vec3(0.0);
  float total = 0.0;
  for (int i = -6; i <= 6; i++) {
    float w = exp(-float(i * i) / 18.0);
    sum += texture2D(uTex, vUv + uStep * float(i)).rgb * w;
    total += w;
  }
  gl_FragColor = vec4(sum / total, 1.0);
}`;

/**
 * Pass 3: the drops. Every drop is a smooth bump (Wyvill kernel) and their sum is a metaball field
 * F; the glass is where F rises above the level `uIso`, which is chosen so that a lone drop has
 * exactly radius `uR0`. Neighbouring drops raise each other's field, which is what makes them fuse.
 * All lengths inside the field code are in grid cells.
 */
export const MAIN_FRAGMENT = `
precision highp float;
precision highp int;
precision highp sampler2D;
varying vec2 vUv;

uniform sampler2D uBg;
uniform sampler2D uBlur;
uniform sampler2D uDrops;
uniform vec2 uSize;
uniform float uCell;
uniform vec2 uGrid;
uniform int uRad;
uniform float uReach;
uniform float uIso;
uniform vec3 uPtr;
uniform float uPtrReach;
uniform float uPtrAmp;
uniform float uThick;
uniform float uRefFactor;
uniform float uRefDist;
uniform float uLens;
uniform float uDisp;
uniform float uFrInt;
uniform float uFrRange;
uniform float uGlare;
uniform float uGlareAngle;
uniform vec4 uTint;
uniform float uFrost;
uniform float uShadow;

// x: field value, yz: its gradient.
vec3 field(vec2 q) {
  ivec2 base = ivec2(floor(q));
  ivec2 grid = ivec2(uGrid);
  float invR2 = 1.0 / (uReach * uReach);
  float f = 0.0;
  vec2 g = vec2(0.0);
  for (int j = -uRad; j <= uRad; j++) {
    for (int i = -uRad; i <= uRad; i++) {
      ivec2 id = base + ivec2(i, j);
      if (id.x < 0 || id.y < 0 || id.x >= grid.x || id.y >= grid.y) continue;
      vec4 drop = texelFetch(uDrops, id, 0);
      vec2 v = q - (vec2(id) + 0.5 + drop.xy);
      float t = dot(v, v) * invR2;
      if (t >= 1.0) continue;
      float m = 1.0 - t;
      f += drop.z * m * m * m;
      g -= drop.z * 6.0 * m * m * v * invR2;
    }
  }
  if (uPtr.z > 0.001) {
    vec2 v = q - uPtr.xy;
    float invRc2 = 1.0 / (uPtrReach * uPtrReach);
    float t = dot(v, v) * invRc2;
    if (t < 1.0) {
      float m = 1.0 - t;
      float a = uPtr.z * uPtrAmp;
      f += a * m * m * m;
      g -= a * 6.0 * m * m * v * invRc2;
    }
  }
  return vec3(f, g);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 pixel = vUv * uSize;
  vec2 q = pixel / uCell + 1.0;
  vec3 fld = field(q);
  float gl = max(length(fld.yz), 1e-3);
  // First-order distance to the glass edge, in cells; positive inside the glass.
  float sd = (fld.x - uIso) / gl;
  float mask = clamp(0.5 + sd * uCell / 1.2, 0.0, 1.0);

  vec3 outside = texture2D(uBg, vUv).rgb;
  vec3 color = outside;

  if (mask < 0.999 && uShadow > 0.0) {
    vec3 shadowField = field(q + vec2(0.05, -0.09));
    float ssd = (shadowField.x - uIso) / max(length(shadowField.yz), 1e-3);
    color *= 1.0 - smoothstep(-0.32, 0.04, ssd) * uShadow * 0.5;
  }

  if (mask > 0.0) {
    vec2 n = -fld.yz / gl;
    float depth = max(sd, 0.0);
    float ratio = clamp(1.0 - depth / uThick, 0.0, 1.0);
    float thetaI = asin(clamp(ratio * ratio, 0.0, 1.0));
    float thetaT = asin(clamp(sin(thetaI) / uRefFactor, 0.0, 1.0));
    float edge = clamp(-tan(thetaT - thetaI), 0.0, 6.0);
    // Where the background is sampled from, in cells, pointing toward the middle of the drop: the
    // Snell term bends light at the rim, the gradient term is the lens of the drop's own bulge.
    vec2 inward = -n * edge * uRefDist + fld.yz * uLens;
    vec2 shift = inward * uCell / uSize;
    float spread = uDisp * 0.35;
    vec2 sR = shift * (1.0 - spread);
    vec2 sB = shift * (1.0 + spread);
    vec3 sharp = vec3(texture2D(uBg, vUv + sR).r, texture2D(uBg, vUv + shift).g, texture2D(uBg, vUv + sB).b);
    vec3 frosted = vec3(texture2D(uBlur, vUv + sR).r, texture2D(uBlur, vUv + shift).g, texture2D(uBlur, vUv + sB).b);
    vec3 lens = mix(sharp, frosted, uFrost);
    lens = mix(lens, uTint.rgb, uTint.a * 0.5);

    float rim = pow(clamp(1.0 - depth / uFrRange, 0.0, 1.0), 3.0);
    lens = mix(lens, vec3(1.0), rim * uFrInt * 0.7);

    vec2 lightDir = vec2(cos(uGlareAngle), sin(uGlareAngle));
    float facing = dot(n, lightDir);
    float band = pow(clamp(1.0 - depth / (uFrRange * 2.2), 0.0, 1.0), 2.0);
    float glare = pow(max(facing, 0.0), 3.0) + pow(max(-facing, 0.0), 3.0) * 0.6;
    lens += vec3(1.0) * glare * band * uGlare;

    // The bulge of the drop itself: a soft highlight on top of each bead.
    vec3 bump = normalize(vec3(-fld.yz * 1.2, 1.0));
    vec3 light = normalize(vec3(lightDir * 0.6, 0.8));
    lens += vec3(1.0) * pow(max(dot(bump, light), 0.0), 28.0) * uGlare * 0.7;

    color = mix(color, lens, mask);
  }

  color += (hash12(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(color, 1.0);
}`;
