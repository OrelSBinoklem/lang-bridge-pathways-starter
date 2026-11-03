import type { ShaderSceneDef } from './types';

/**
 * "I travel…": a night drive on a four-lane highway through a pine forest. A real perspective camera 1.3 m above
 * wet asphalt: streetlamps every 34 m light pools on the road (inverse square, cosine law) and glowing cones in the
 * damp air; the lights are mirrored in the wet road as long soft columns and sharp spots where there are puddles.
 * Oncoming cars come at you with headlights that flare and light the road in front of them; cars ahead show red
 * tail lights (the one in your lane brakes now and then), and your own low beams light the lane markings. The road
 * bends on its own; the cursor steers it, and holding the button switches on the high beams.
 */
export const NIGHT_HIGHWAY: ShaderSceneDef = {
  kind: 'shader',
  id: 'highway',
  label: 'Ночная трасса',
  palettes: [
    ['#0a1030', '#4a2a5e', '#ff2436', '#ffa048'],
    ['#040b16', '#18344e', '#ff3048', '#d8e4ff'],
  ],
  fragment: `
const float CH = 1.3;    // camera height, m
const float FO = 1.2;    // focal length, picture heights
const float GAP = 34.0;  // between streetlamps, m
const float LH = 8.5;    // lamp head height
const float LX = 6.3;    // lamp head, m from the centre line
const float PX = 8.4;    // lamp post
const float CAMX = 1.75; // we drive in the inner lane of the right-hand side

float bendAt(float z, float b) { return b * z * z * 0.0011; }

// The light of the nearest streetlamps at road point p = (x, height, distance along the road) on a surface with normal n.
vec3 lampLight(vec3 p, vec3 n) {
  vec3 E = vec3(0.0);
  for (int side = 0; side < 2; side++) {
    float sd = float(side) * 2.0 - 1.0;
    float off = side == 0 ? GAP * 0.5 : 0.0;
    float i0 = floor((p.z - off) / GAP);
    for (int k = -1; k <= 2; k++) {
      vec3 d = vec3(sd * LX, LH, (i0 + float(k)) * GAP + off) - p;
      float d2 = dot(d, d) + 1.0;
      E += vec3(max(dot(d, n), 0.0) / (d2 * sqrt(d2)));
    }
  }
  return E * 170.0;
}

// A light's reflection on wet asphalt: a sharp spot at its mirror image in puddles, a long soft column elsewhere.
float streak(vec2 s, vec2 mirror, float contact, float w, float wet) {
  float dx = s.x - mirror.x;
  float v = s.y - mirror.y;
  float below = smoothstep(contact + 0.001, contact - 0.006, s.y);
  float sharp = exp(-dx * dx / (w * w)) * exp(-v * v / (w * w * 4.0 + 0.00004));
  float soft = exp(-dx * dx / (w * w * 5.0 + 0.00002)) * exp(-v * v / 0.02);
  return below * (soft * mix(0.3, 0.12, wet) + sharp * wet * 1.2);
}

vec3 scene(vec2 uv, vec2 P, vec2 M, float t) {
  float asp = uRes.x / uRes.y;
  float hy = 0.6;
  float vpx = 0.62;
  vec2 s = vec2((uv.x - vpx) * asp, uv.y - hy);
  float px = 1.0 / uRes.y;
  float travel = t * 22.0;
  float steer = clamp((M.x - (vpx - 0.5) * 2.0 * asp) / (0.8 * asp), -1.0, 1.0);
  float bend = 0.35 * sin(t * 0.05) + 0.2 * sin(t * 0.13 + 2.0) + steer * uK.z * 0.6;
  float high = uPointer.z * uPointer.w;
  vec3 lampCol = uPal[3];
  vec3 tailCol = uPal[2];
  vec3 headCol = vec3(1.0, 0.95, 0.86);
  float I = uK.y;

  // The sky: haze glowing low over the forest, stars, the moon behind thin cloud.
  float up = max(s.y, 0.0);
  vec3 col = mix(uPal[1] * 0.45, uPal[0] * 0.65, smoothstep(0.0, 0.3, up));
  col += uPal[1] * 0.25 * exp(-up * 20.0);
  vec2 sg = uv * vec2(asp, 1.0) * 80.0;
  float hs = hash21(floor(sg));
  vec2 sf = fract(sg) - 0.5;
  col += vec3(0.9, 0.92, 1.0) * step(0.97, hs) * exp(-dot(sf, sf) * 40.0) * (0.55 + 0.45 * sin(t * 1.3 + hs * 60.0)) * smoothstep(0.04, 0.25, up) * 0.8;
  vec2 mp = vec2(0.42, 0.25);
  float md = length(s - mp);
  float mr = 0.042;
  float disc = smoothstep(mr + px, mr - px, md);
  col += vec3(0.45, 0.5, 0.65) * 0.2 * exp(-max(md - mr, 0.0) * 14.0);
  col = mix(col, vec3(0.92, 0.9, 0.82) * (0.78 + 0.22 * fbm3((s - mp) * 55.0)), disc);
  float cl = smoothstep(0.52, 0.85, fbm(vec2(s.x * 1.8 + t * 0.008, s.y * 6.0 + 3.0))) * smoothstep(0.02, 0.12, up);
  col = mix(col, uPal[0] * 0.5 + vec3(0.2, 0.21, 0.26) * exp(-md * 3.5), cl * 0.55);
  // The forest far ahead, where the road disappears.
  float fx = s.x - bendAt(420.0, bend) * FO / 420.0;
  float band = 0.014 + 0.012 * fbm3(vec2(fx * 24.0, 0.0)) + 0.008 * abs(fract(fx * 70.0 + hash11(floor(fx * 70.0))) - 0.5);
  if (s.y > -0.002 && s.y < band) col = vec3(0.01, 0.014, 0.018) + uPal[1] * 0.035;

  float zHit = 1e5;
  int kind = 0; // 0 sky, 1 road, 2 anything standing
  float wet = 0.0;
  float xr = 0.0;
  float wG = 0.0;

  // The road and its shoulders.
  if (s.y < 0.0) {
    float tg = CH / max(-s.y, 1e-4);
    float z = tg * FO;
    xr = CAMX + tg * s.x - bendAt(z, bend);
    wG = z + travel;
    float fw = max(fwidth(xr), 0.002);
    float fwz = max(fwidth(wG), 0.002);
    float grain = noise(vec2(xr * 5.0, wG * 1.5));
    vec3 alb = vec3(0.07, 0.07, 0.075) * (0.7 + 0.6 * grain);
    wet = smoothstep(0.5, 0.7, fbm3(vec2(xr * 0.35, wG * 0.07)));
    float onRoad = smoothstep(7.4 + fw, 7.4 - fw, abs(xr));
    float line = smoothstep(0.09 + fw, 0.09 - fw, abs(abs(xr) - 7.0));
    line = max(line, smoothstep(0.06 + fw, 0.06 - fw, abs(abs(xr) - 0.16)));
    float dash = mix(step(fract(wG / 12.0), 0.35), 0.35, smoothstep(1.5, 5.0, fwz));
    line = max(line, smoothstep(0.07 + fw, 0.07 - fw, abs(abs(xr) - 3.5)) * dash);
    vec3 shoulder = mix(vec3(0.06, 0.055, 0.045), vec3(0.018, 0.03, 0.018), smoothstep(8.0, 9.5, abs(xr))) * (0.6 + 0.8 * noise(vec2(xr * 2.0, wG * 0.6)));
    alb = mix(shoulder, alb * (1.0 - wet * 0.5), onRoad);
    line *= onRoad * (1.0 - wet * 0.6);
    alb = mix(alb, vec3(0.65), line);
    vec3 E = vec3(0.012, 0.014, 0.028) + lampCol * lampLight(vec3(xr, 0.0, wG), vec3(0.0, 1.0, 0.0));
    // Our low beams (high beams while the button is down): the paint shines back at us.
    float lx = tg * s.x;
    float beam = exp(-pow(lx / (0.9 + z * 0.2), 2.0)) * smoothstep(2.0, 7.0, z) * exp(-z / mix(40.0, 110.0, high)) * (1.2 + high);
    E += headCol * beam * (2.0 + line * 6.0);
    // Other cars light the road in front of them.
    for (int ln = 0; ln < 4; ln++) {
      float lane = ln == 0 ? -5.25 : ln == 1 ? -1.75 : ln == 2 ? 5.25 : 1.75;
      float spacing = ln == 0 ? 120.0 : ln == 1 ? 150.0 : ln == 2 ? 70.0 : 1.0;
      float speed = ln == 0 ? 42.0 : ln == 1 ? 46.0 : 6.0;
      float ph = hash11(float(ln) * 7.3) * 3.0 - t * speed / spacing;
      for (int k = 0; k < 3; k++) {
        float zc = ln == 3 ? 46.0 + 16.0 * sin(t * 0.06) : -12.0 + spacing * (fract(ph) + float(k));
        if (ln == 3 && k > 0) break;
        float id = floor(ph) - float(k);
        if (ln < 3 && hash11(id * 1.37 + float(ln) * 11.0) < 0.35) continue;
        float dz = zc + travel - wG;
        float dxl = xr - lane;
        float toward = ln < 2 ? dz : -dz;
        E += headCol * exp(-pow(dxl / (0.8 + abs(dz) * 0.22), 2.0)) * smoothstep(0.5, 4.0, toward) * exp(-toward / 28.0) * 1.6;
        if (ln >= 2) E += tailCol * exp(-dxl * dxl * 0.4) * exp(-max(dz, 0.0) * 0.35) * smoothstep(0.0, 1.0, dz) * 0.25;
      }
    }
    col = alb * E;
    zHit = z;
    kind = 1;
  }

  // Standing things beside the road: the guard rails and the pine forest, both walls along the road.
  if (abs(s.x) > 1e-4) {
    for (int side = 0; side < 2; side++) {
      float sd = float(side) * 2.0 - 1.0;
      for (int wall = 0; wall < 2; wall++) {
        float wx = sd * (wall == 0 ? 7.9 : 34.0 - 6.0 * float(side));
        float z = 60.0;
        float tw = -1.0;
        for (int it = 0; it < 3; it++) {
          tw = (wx + bendAt(z, bend) - CAMX) / s.x;
          z = tw * FO;
        }
        if (tw <= 0.0 || z >= zHit) continue;
        float y = CH + tw * s.y;
        float wv = z + travel;
        vec3 n = vec3(-sd, 0.0, 0.0);
        if (wall == 0) {
          if (y < 0.62 || y > 0.78) continue;
          // A steel rail: dull, with a bright streak where a lamp is mirrored in it.
          vec3 E = lampLight(vec3(wx, y, wv), n) + lampLight(vec3(wx, y, wv), vec3(0.0, 1.0, 0.0)) * 0.5;
          float spec = pow(max(0.0, 1.0 - abs(fract((wv - (side == 0 ? GAP * 0.5 : 0.0)) / GAP + 0.5) - 0.5) * 6.0), 3.0);
          col = vec3(0.035) * (0.6 + 0.4 * step(0.7, y)) + lampCol * (E * 0.04 + spec * 0.25);
          if (side == 1) col += headCol * 0.15 * exp(-z / 25.0) * smoothstep(3.0, 8.0, z);
        } else {
          // Spruces: each a spire whose tip rises above its neighbours, the forest's edge a jagged line on the sky.
          float cell = floor(wv / 3.2);
          float tri = 1.0 - abs(fract(wv / 3.2) * 2.0 - 1.0);
          float hT = 10.0 + 6.0 * hash11(cell + sd * 13.0) + 4.0 * fbm3(vec2(wv * 0.02, sd));
          hT = mix(hT * 0.72, hT, tri * tri);
          if (y < 0.0 || y > hT) continue;
          vec3 E = lampLight(vec3(sd * 9.0, min(y, 5.0), wv), n);
          float leaf = 0.7 + 0.3 * noise(vec2(wv * 2.0, y * 2.0));
          col = vec3(0.006, 0.01, 0.01) * leaf + lampCol * E * 0.012 * leaf * exp(-y * 0.12);
        }
        zHit = z;
        kind = 2;
      }
    }
  }

  // Lamp posts and arms.
  for (int side = 0; side < 2; side++) {
    float sd = float(side) * 2.0 - 1.0;
    float off = side == 0 ? GAP * 0.5 : 0.0;
    float i0 = floor((travel - off) / GAP);
    for (int k = 0; k < 12; k++) {
      float zl = (i0 + float(k)) * GAP + off - travel;
      if (zl < 1.0 || zl > zHit) continue;
      float b = bendAt(zl, bend) - CAMX;
      float postX = (sd * PX + b) * FO / zl;
      float headX = (sd * LX + b) * FO / zl;
      float top = (LH - CH) * FO / zl;
      float ground = -CH * FO / zl;
      float wdt = max(0.11 * FO / zl, px * 0.6);
      float post = step(abs(s.x - postX), wdt) * step(ground, s.y) * step(s.y, top);
      float arm = step(sdSeg(s, vec2(postX, top), vec2(headX, top + 0.2 * FO / zl)), wdt * 0.7);
      float cover = max(post, arm) * clamp(wdt / px, 0.3, 1.0);
      col = mix(col, vec3(0.025, 0.025, 0.03) + lampCol * 0.015, cover);
      if (cover > 0.5) { zHit = zl; kind = 2; }
    }
  }

  // Car bodies: dark shapes caught by the lamps and our headlights, with a glassy rear window.
  for (int ln = 0; ln < 4; ln++) {
    float lane = ln == 0 ? -5.25 : ln == 1 ? -1.75 : ln == 2 ? 5.25 : 1.75;
    float spacing = ln == 0 ? 120.0 : ln == 1 ? 150.0 : ln == 2 ? 70.0 : 1.0;
    float speed = ln == 0 ? 42.0 : ln == 1 ? 46.0 : 6.0;
    float ph = hash11(float(ln) * 7.3) * 3.0 - t * speed / spacing;
    for (int k = 2; k >= 0; k--) {
      if (ln == 3 && k > 0) continue;
      float zc = ln == 3 ? 46.0 + 16.0 * sin(t * 0.06) : -12.0 + spacing * (fract(ph) + float(k));
      float id = floor(ph) - float(k);
      if (ln < 3 && hash11(id * 1.37 + float(ln) * 11.0) < 0.35) continue;
      if (zc < 1.5 || zc > zHit) continue;
      float cx = lane + bendAt(zc, bend) - CAMX;
      vec2 q = s * zc / FO;       // this pixel at the car's depth, camera-space metres
      float yq = q.y + CH;        // height above the road
      float bodyHalf = yq > 0.95 ? mix(0.9, 0.62, clamp((yq - 0.95) / 0.5, 0.0, 1.0)) : 0.9;
      if (abs(q.x - cx) > bodyHalf || yq < 0.28 || yq > 1.45) continue;
      vec3 E = lampLight(vec3(lane, 1.0, zc + travel), vec3(0.0, 0.3, -1.0)) + vec3(0.02);
      float lit = exp(-pow((q.x) / (0.9 + zc * 0.2), 2.0)) * exp(-zc / mix(40.0, 110.0, high)) * 2.5;
      vec3 paint = vec3(0.03, 0.03, 0.035) * (1.0 + float(int(hash11(id + 3.0) * 4.0)));
      vec3 c = paint * (lampCol * E + headCol * lit);
      if (yq > 0.98 && yq < 1.38 && abs(q.x - cx) < bodyHalf - 0.08) c = vec3(0.01, 0.012, 0.02) + lampCol * E * 0.01 + vec3(0.08, 0.09, 0.12) * smoothstep(0.02, 0.0, abs(yq - 1.3)) * 0.4;
      col = c;
      zHit = zc;
      kind = 2;
    }
  }

  // Night haze thickens with distance.
  if (kind > 0) col = mix(col, uPal[1] * 0.12 + lampCol * 0.02, 1.0 - exp(-zHit / 260.0));

  // Lights: lamp heads with halos and cones of lit air, their reflections on the wet road.
  vec3 add = vec3(0.0);
  for (int side = 0; side < 2; side++) {
    float sd = float(side) * 2.0 - 1.0;
    float off = side == 0 ? GAP * 0.5 : 0.0;
    float i0 = floor((travel - off) / GAP);
    for (int k = 0; k < 12; k++) {
      float zl = (i0 + float(k)) * GAP + off - travel;
      if (zl < 1.0) continue;
      float b = bendAt(zl, bend) - CAMX;
      vec2 h = vec2((sd * LX + b) * FO / zl, (LH + 0.15 - CH) * FO / zl);
      float fade = exp(-zl / 420.0);
      float vis = zl < zHit + 1.0 ? 1.0 : 0.15;
      vec2 d = s - h;
      float core = max(0.35 * FO / zl, px * 0.9);
      add += lampCol * (exp(-(d.x * d.x * 0.35 + d.y * d.y * 2.0) / (core * core)) * 2.2 * vis + exp(-length(d) / (0.03 + 1.2 / zl)) * 0.08) * fade;
      float ground = -CH * FO / zl;
      if (s.y < h.y && s.y > ground && zl < zHit) {
        float f = (h.y - s.y) / (h.y - ground);
        float hw = (0.3 + f * 3.4) * FO / zl;
        add += lampCol * exp(-d.x * d.x / (hw * hw)) * (1.0 - f * 0.7) * 0.05 * fade;
      }
      if (kind == 1) {
        vec2 mirror = vec2(h.x, (-LH - CH) * FO / zl);
        add += lampCol * streak(s, mirror, ground, max(0.4 * FO / zl, px), wet) * 1.3 * fade;
      }
    }
  }
  // Car lights: headlights flare at you, tail lights glow red; both mirrored in the road.
  for (int ln = 0; ln < 4; ln++) {
    float lane = ln == 0 ? -5.25 : ln == 1 ? -1.75 : ln == 2 ? 5.25 : 1.75;
    float spacing = ln == 0 ? 120.0 : ln == 1 ? 150.0 : ln == 2 ? 70.0 : 1.0;
    float speed = ln == 0 ? 42.0 : ln == 1 ? 46.0 : 6.0;
    float ph = hash11(float(ln) * 7.3) * 3.0 - t * speed / spacing;
    for (int k = 0; k < 3; k++) {
      if (ln == 3 && k > 0) break;
      float zc = ln == 3 ? 46.0 + 16.0 * sin(t * 0.06) : -12.0 + spacing * (fract(ph) + float(k));
      float id = floor(ph) - float(k);
      if (ln < 3 && hash11(id * 1.37 + float(ln) * 11.0) < 0.35) continue;
      if (zc < 1.5) continue;
      float cx = lane + bendAt(zc, bend) - CAMX;
      bool front = ln < 2;
      float ly = front ? 0.68 : 0.9;
      float spread = front ? 0.7 : 0.76;
      vec3 lc = front ? headCol : tailCol;
      float brake = ln == 3 ? 1.0 + 1.6 * smoothstep(0.6, 0.8, sin(t * 0.37)) : 1.0;
      float pw = (front ? 2.4 : 1.0) * brake;
      float vis = zc < zHit + 0.6 ? 1.0 : 0.0;
      float fade = exp(-zc / 380.0);
      for (int e = 0; e < 2; e++) {
        float ex = cx + (float(e) * 2.0 - 1.0) * spread;
        vec2 h = vec2(ex * FO / zc, (ly - CH) * FO / zc);
        vec2 d = s - h;
        float core = max(0.12 * FO / zc, px * 0.8);
        float g = exp(-dot(d, d) / (core * core)) * vis + exp(-length(d) / (0.02 + 0.5 / zc)) * 0.06;
        if (front) g += exp(-abs(d.y) / (px * 1.2)) * exp(-abs(d.x) / (0.05 + 3.0 / zc)) * 0.12 * vis;
        add += lc * g * pw * fade;
        if (kind == 1) {
          vec2 mirror = vec2(h.x, (-ly - CH) * FO / zc);
          add += lc * streak(s, mirror, -CH * FO / zc, max(0.18 * FO / zc, px), wet) * pw * 0.8 * fade;
        }
      }
    }
  }
  col += add * I;
  col = 1.0 - exp(-col * 1.7);
  return col;
}`,
};

/** A centered full-viewport composition; the original road and the separate relit street stay unchanged. */
export const HIGHWAY_PANORAMA: ShaderSceneDef = {
  ...NIGHT_HIGHWAY,
  id: 'highway-panorama', label: 'Генеративная трасса — широкая панорама',
  defaultParams: { quality: 1, react: .45 },
  fragment: NIGHT_HIGHWAY.fragment
    .replace('float hy = 0.6;', 'float hy = 0.52;')
    .replace('float vpx = 0.62;', 'float vpx = 0.5;')
    .replace('const float FO = 1.2;', 'const float FO = 0.98;')
    // Extra aggregate is faded before subpixel scale; it must not shimmer on the horizon.
    .replace('float grain = noise(vec2(xr * 5.0, wG * 1.5));', `float grain = noise(vec2(xr * 5.0, wG * 1.5));
    grain += (noise(vec2(xr * 36.0, wG * 18.0)) - 0.5) * 0.24 * (1.0 - smoothstep(0.015, 0.05, fwz));`)
    .replace('col = alb * E;', `col = alb * E;
    float stud = (1.0 - smoothstep(0.04, 0.08 + fw, abs(abs(xr) - 6.7)))
      * (1.0 - smoothstep(0.1, 0.18 + fwz, abs(mod(wG + 6.0, 12.0) - 6.0)));
    col += vec3(0.75, 0.85, 0.64) * stud * beam * 2.0;`),
};
