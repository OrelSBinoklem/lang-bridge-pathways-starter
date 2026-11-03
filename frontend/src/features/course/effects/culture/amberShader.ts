/**
 * The amber, as a picture computed per pixel. A ray goes into a slab of resin shaped like a soft pillow (thick in the
 * middle, thin at the rim), is bent where it enters, and is followed through the resin in steps. On the way:
 *  - it is absorbed the way amber absorbs (blue first, then green: white light comes out orange);
 *  - the resin scatters light (subsurface scattering): the lamp inside the resin and the light from behind are scattered
 *    toward the eye by cloudy streaks, which therefore glow, thin places let more light through, and around the lamp
 *    the surface shows a soft glow that is redder the wider it spreads (red light travels furthest in amber);
 *  - it passes sheets at different depths where words, plant fibres, bubbles and flecks are frozen. Bubbles are little
 *    spheres of air: a dark rim, a bright highlight of the lamp that moves as the lamp moves, and a focused spot of
 *    light on the side away from the lamp.
 * The polished surface adds a highlight of the lamp and the reflection of a soft box.
 */
export const AMBER_VERTEX = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export const AMBER_FRAGMENT = `#version 300 es
precision highp float;
precision highp sampler2DArray;

uniform vec2 uRes;
uniform float uTime;
uniform vec3 uLamp;       // x, y as a share of the card (0..1, top left), z depth in the resin
uniform vec2 uTilt;
uniform float uGlow;
uniform float uCloud;
uniform float uDepth;
uniform float uSparkle;
uniform float uLampSize;
uniform float uBubbles;
uniform float uSss;
uniform sampler2DArray uLayers;   // sheets 0-7: R words, G plant fibres; sheet 8: R sun spangles
out vec4 outColor;

const int STEPS = 24;
const float D = 0.9;
const float LAYERS = 8.0;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x),
                 mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x),
                 mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 3; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s;
}
float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float aspect;

// How high the pillow is at a point of the card, 0 at the rim and 1 across the middle. The corner radius is larger than
// the width of the slope, so that the slope has no creases.
float pillow(vec2 p) {
  float sd = sdRoundBox(p, vec2(aspect, 1.0), 0.9);
  return smoothstep(0.0, 0.75, -sd);
}

// Thickness of the resin.
float thickness(vec2 p) {
  return D * (0.24 + 0.76 * pillow(p)) * (0.97 + 0.03 * vnoise(vec3(p * 1.7, 3.0)));
}

vec2 toUv(vec2 p) {
  return vec2(p.x / aspect * 0.5 + 0.5, 0.5 - p.y * 0.5);
}

// Henyey-Greenstein phase function (a little forward-leaning: resin scatters forward).
float phase(float c) {
  float g = 0.35;
  return (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * c, 1.5) * 0.25;
}

// The bubbles of one sheet: a jittered grid, at most one bubble a cell. Adds the bubble's shading to C and dims T.
void bubbleSheet(vec3 q, float layer, vec3 lampPos, float lamp2, inout vec3 C, inout vec3 T) {
  if (uBubbles <= 0.0) return;
  float cells = 4.2 + 0.3 * layer;
  vec2 g = q.xy * cells + layer * 13.7;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float h = hash12(id + layer * 7.1);
  if (h > 0.05 * uBubbles) return;
  vec2 c = (hash22(id + 3.3 + layer) - 0.5) * 0.45;
  float r = 0.09 + 0.3 * pow(hash12(id + 9.9 + layer), 2.5);
  vec2 d = (f - c) / r;
  float rr = dot(d, d);
  if (rr >= 1.0) return;
  float z = sqrt(1.0 - rr);
  // The sphere's normal (the eye is on the -z side), the direction to the lamp, and to a window-like light in front.
  vec3 n = normalize(vec3(d.x, d.y, -z));
  vec3 V = vec3(0.0, 0.0, -1.0);
  float zc = (layer + 0.5) / LAYERS * D;
  vec3 toLamp = lampPos - vec3(q.xy, zc);
  float dl2 = dot(toLamp, toLamp);
  vec3 Lm = normalize(toLamp);
  float fall = uGlow / (1.0 + dl2 * 9.0 / lamp2);
  float twinkle = 0.8 + 0.2 * sin(uTime * 2.6 + h * 90.0);
  // Glints: the lamp's highlight moves over the bubble as the lamp moves; the window's stays in one place.
  float specLamp = pow(max(dot(n, normalize(Lm + V)), 0.0), 70.0);
  vec3 Lw = normalize(vec3(-0.45, 0.5, -0.75));
  float specWin = pow(max(dot(n, normalize(Lw + V)), 0.0), 55.0);
  // The light that passed through the bubble is focused into a spot on the side away from the lamp.
  vec2 spot = -normalize(Lm.xy + 1e-4) * 0.45;
  float focus = exp(-dot(d - spot, d - spot) * 11.0);
  float rim = smoothstep(0.62, 1.0, sqrt(rr));
  vec3 lightCol = vec3(1.0, 0.9, 0.68);
  vec3 add = (specLamp * fall * 5.0 + focus * fall * 1.6 * (1.0 - rim) + specWin * 0.9 * (0.5 + 0.5 * uSparkle)) * twinkle * lightCol;
  // Air in resin bends light away: the rim is dark, the inside is a little clearer.
  T *= 1.0 - 0.55 * rim;
  C += T * add;
  // The light scattered around the bubble.
  C += T * lightCol * fall * 0.12 * (1.0 - rr);
}

void main() {
  aspect = uRes.x / uRes.y;
  vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes;
  vec2 p = vec2((fc.x - 0.5) * 2.0 * aspect, (0.5 - fc.y) * 2.0);
  vec2 lampP = vec2((uLamp.x - 0.5) * 2.0 * aspect, (0.5 - uLamp.y) * 2.0);
  float lamp2 = uLampSize * uLampSize;

  // The pillow's surface normal (pointing at the viewer, who is on the -z side).
  float e = 0.012;
  float dHx = thickness(p + vec2(e, 0.0)) - thickness(p - vec2(e, 0.0));
  float dHy = thickness(p + vec2(0.0, e)) - thickness(p - vec2(0.0, e));
  vec3 N = normalize(vec3(-dHx / (2.0 * e) * 0.8, -dHy / (2.0 * e) * 0.8, -1.0));
  // The same normal under the cursor (for the lamp's highlight below).
  float dLx = thickness(lampP + vec2(e, 0.0)) - thickness(lampP - vec2(e, 0.0));
  float dLy = thickness(lampP + vec2(0.0, e)) - thickness(lampP - vec2(0.0, e));
  vec3 NL = normalize(vec3(-dLx / (2.0 * e) * 0.8, -dLy / (2.0 * e) * 0.8, -1.0));

  // The ray: looking a little across the card, turned by the tilt, then bent by the surface (amber: n = 1.54).
  vec3 rd = normalize(vec3(p * 0.05 + uTilt, 1.0));
  vec3 rdi = refract(rd, N, 1.0 / 1.54);
  float H = thickness(p);
  float pathEnd = H / max(rdi.z, 0.3);
  float dt = pathEnd / float(STEPS);
  vec3 ro = vec3(p, 0.0);

  // The lamp hangs on the line of sight through the cursor (the view is tilted and bent into the resin, n = 1.54), so
  // its light is always seen right under the cursor, however the view is turned.
  vec3 lampPos = vec3(lampP + (lampP * 0.05 + uTilt) * (uLamp.z / 1.54), uLamp.z);
  vec3 ABS = vec3(0.3, 0.8, 2.3) * uDepth;
  vec3 backLight = vec3(2.1, 1.55, 0.85);
  vec3 T = vec3(1.0);
  vec3 C = vec3(0.0);
  float layer = 0.0;

  for (int i = 0; i < STEPS; i++) {
    float t = (float(i) + 0.5) * dt;
    vec3 q = ro + rdi * t;

    // Streaky, cloudy patches: the resin flowed sideways as it set.
    float fl = fbm(vec3(q.x * 0.8, q.y * 2.4 + 0.5 * sin(q.x * 1.6), q.z * 1.5));
    float cloud = smoothstep(0.36, 0.82, fl) * uCloud;
    // Denser resin is darker and redder.
    vec3 sigA = ABS * (0.6 + 0.8 * fl) * vec3(1.0, 1.0 + 0.25 * cloud, 1.0);
    float sigS = 0.3 * cloud + 0.035;

    // Subsurface scattering, from the lamp inside the resin ...
    vec3 dl = lampPos - q;
    float d2 = dot(dl, dl);
    float dist = sqrt(d2);
    vec3 Li = uGlow * vec3(1.0, 0.76, 0.4) * exp(-ABS * dist * 0.5) / (1.0 + d2 * 14.0 / lamp2);
    float ph = phase(dot(normalize(q - lampPos), -rdi));
    C += T * sigS * Li * ph * dt * 22.0;
    // ... and from behind: the further the light has to travel through the resin, the less of it arrives, so thin
    // places and rims glow.
    vec3 Lb = backLight * exp(-ABS * max(H * 0.98 - q.z, 0.0) * 0.9);
    C += T * sigS * Lb * dt * 1.6;
    T *= exp(-(sigA + sigS) * dt);

    // The sheets: each is met once, when the ray passes its depth.
    while (layer < LAYERS && q.z >= (layer + 0.5) / LAYERS * D) {
      float zc = (layer + 0.5) / LAYERS * D;
      // Inclusions are frozen into resin. Only refraction/view motion changes their apparent position.
      vec2 uv = toUv(q.xy);
      vec3 s = texture(uLayers, vec3(uv, layer)).rgb;
      // A sheet fades out toward the thin rim of the slab instead of ending in a hard edge.
      float wgt = clamp((0.97 * H - zc) / 0.14, 0.0, 1.0);
      s *= wgt;
      vec3 dls = lampPos - vec3(q.xy, zc);
      float ds2 = dot(dls, dls);
      float lit = 1.0 / (1.0 + ds2 * 16.0 / lamp2);
      vec3 lightHere = uGlow * vec3(1.0, 0.86, 0.5) * lit * exp(-ABS * sqrt(ds2) * 0.45);
      // Words and letters: dark in the resin, glowing where the lamp reaches them.
      C += T * s.r * lightHere * 2.6;
      T *= 1.0 - s.r * 0.86;
      // Plant fibres: thin dark strands.
      T *= 1.0 - s.g * 0.6;
      // Flecks of bark and dust: tiny specks on a grid.
      vec2 fg = q.xy * 21.0 + layer * 5.3;
      vec2 fid = floor(fg);
      if (hash12(fid + layer) < 0.05 * uBubbles) {
        vec2 fp = (fract(fg) - 0.5) - (hash22(fid + 1.7) - 0.5) * 0.5;
        T *= 1.0 - 0.55 * (1.0 - smoothstep(0.08, 0.2, length(fp))) * wgt;
      }
      if (wgt > 0.0) {
        vec3 Cb = vec3(0.0);
        vec3 Tb = T;
        bubbleSheet(vec3(q.xy, zc), layer, lampPos, lamp2, Cb, Tb);
        C += Cb * wgt;
        T = mix(T, Tb, wgt);
      }
      layer += 1.0;
    }
  }

  // The sun spangles: flat discs of cracks that flash when the light meets them at the right angle.
  {
    float zc = 0.45 * D;
    vec3 qs = ro + rdi * (zc / max(rdi.z, 0.3));
    vec2 uv = toUv(qs.xy);
    float sp = texture(uLayers, vec3(uv, 8.0)).r * clamp((0.97 * H - zc) / 0.14, 0.0, 1.0);
    vec3 dls = lampPos - vec3(qs.xy, zc);
    float lit = 1.0 / (1.0 + dot(dls, dls) * 10.0 / lamp2);
    float flash = 0.55 + 0.45 * sin(uTime * 1.7 + uv.x * 60.0 + uv.y * 35.0);
    C += T * sp * uSparkle * (0.12 + 3.2 * lit) * flash * vec3(1.0, 0.9, 0.62);
  }

  // What is behind the slab: a warm, soft light, so that the amber glows from within.
  vec3 back = backLight * (0.6 + 0.4 * smoothstep(-1.2, 1.2, p.x * 0.35 + p.y * 0.55 + rdi.x * 2.0));
  C += T * back;

  // Subsurface scattering seen from the surface: the light of the lamp spreads around it, and it spreads furthest in
  // red, so the glow is white-hot in the middle and turns orange, then red, toward its edge.
  float dlp2 = dot(p - lampP, p - lampP);
  vec3 prof = vec3(0.62, 0.42, 0.16) * exp(-dlp2 / (0.035 * lamp2))
            + vec3(0.36, 0.17, 0.05) * exp(-dlp2 / (0.16 * lamp2))
            + vec3(0.22, 0.05, 0.01) * exp(-dlp2 / (0.7 * lamp2));
  C += (0.35 + 0.65 * T) * prof * uGlow * uSss;

  // The polished surface: the lamp's highlight, and the reflection of a soft box that shows on the pillow's slopes.
  vec3 V = vec3(0.0, 0.0, -1.0);
  // The lamp's highlight sits right under the cursor: its light comes from where the slab under the cursor reflects
  // it straight at the eye (so the half vector there is the surface normal NL), and it fades away from the cursor, so
  // the curved slab shows no stray glint anywhere else.
  float spec = pow(max(dot(N, NL), 0.0), 90.0) * exp(-dlp2 / 0.06) * 1.1 * uGlow;
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 rf = reflect(vec3(0.0, 0.0, 1.0), N);
  vec2 sb = rf.xy / max(-rf.z, 0.25);
  float box = (1.0 - smoothstep(0.42, 0.55, abs(sb.x - 0.3))) * (1.0 - smoothstep(0.14, 0.22, abs(sb.y - 0.6)));
  vec3 env = mix(vec3(0.05, 0.03, 0.02), vec3(1.0, 0.97, 0.9), box) + vec3(0.14, 0.1, 0.06) * (0.5 + 0.5 * rf.y);
  C += fres * env * 0.8 + spec * vec3(1.0, 0.96, 0.86);

  C = vec3(1.0) - exp(-C * 1.1);
  C = pow(C, vec3(0.92));
  C += (hash12(gl_FragCoord.xy + fract(uTime) * 100.0) - 0.5) / 128.0;
  outColor = vec4(C, 1.0);
}`;
