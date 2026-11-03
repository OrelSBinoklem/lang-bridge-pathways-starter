/** Directional gravity/capillary waves, analytically differentiated and pixel-filtered.
 * No multi-octave noise derivatives (24 noise evaluations per fragment in the old surface).
 * Dispersion: omega² = g k + sigma/rho k³, metres/seconds, clean water at room temperature. */
export const CAPILLARY_WATER_GLSL = /* glsl */ `
uniform sampler2D uWaterDetail;
vec2 waveSlope(vec2 p, float t, vec2 direction, float k, float amplitude) {
  float phase = dot(p, direction) * k - sqrt(9.81 * k + 0.000074 * k * k * k) * t;
  float footprint = fwidth(phase);
  float filterK = 1.0 - smoothstep(1.2, 3.1, footprint);
  return direction * (k * amplitude * cos(phase) * filterK);
}
vec2 ripples(vec2 p, float t) {
  return waveSlope(p, t, vec2(0.96, 0.28), 9.0, 0.0038)
       + waveSlope(p, t, vec2(-0.38, 0.925), 18.0, 0.0017)
       + waveSlope(p, t, vec2(0.66, -0.751), 37.0, 0.00065)
       + waveSlope(p, t, vec2(0.15, 0.989), 71.0, 0.00022);
}
// Two filtered lookups replace the second four-wave octave, twelve foam hashes,
// and the old sine-grid caustic. No new render pass or per-frame texture upload.
vec4 waterDetail(vec2 p, float t) {
  vec4 a = texture2D(uWaterDetail, p * 0.38 + vec2(t * 0.013, -t * 0.009));
  vec4 b = texture2D(uWaterDetail, p * 0.91 + vec2(-t * 0.008, t * 0.017));
  return vec4((a.rg + b.rg - 1.0) * 0.18, a.b * 0.6 + b.b * 0.4, max(a.a, b.a) * (0.65 + 0.35 * min(a.a, b.a)));
}
vec2 refractedUv(vec3 W, vec3 V, vec3 N, float depth, out float opticalPath) {
  vec3 T = refract(V, N, 1.0 / 1.333);
  opticalPath = depth / max(0.15, -T.y);
  vec3 bottom = W + T * opticalPath;
  vec4 clip = uProj * uView * vec4(bottom, 1.0);
  return clamp(clip.xy / clip.w * 0.5 + 0.5, vec2(0.001), vec2(0.999));
}
`;

/** Roughness-filtered microfacet sunlight instead of two unbounded Phong spikes. */
export const WATER_LIGHT_GLSL = /* glsl */ `
float waterFresnel(float cosine) {
  float x = 1.0 - clamp(cosine, 0.0, 1.0);
  float x2 = x * x;
  return 0.0204 + 0.9796 * x2 * x2 * x;
}
float waterSpecular(vec3 N, vec3 V, vec3 L, float roughness) {
  vec3 H = normalize(L - V);
  float nh = max(dot(N, H), 0.0);
  float nv = max(dot(N, -V), 0.001);
  float nl = max(dot(N, L), 0.0);
  float a2 = roughness * roughness + min(fwidth(nh), 0.12) * 0.06;
  float d = nh * nh * (a2 - 1.0) + 1.0;
  float distribution = a2 / max(3.14159265 * d * d, 0.00001);
  float k = roughness * 0.5;
  float visibility = nl / max((nv * (1.0 - k) + k) * (nl * (1.0 - k) + k), 0.001);
  return distribution * visibility * waterFresnel(dot(-V, H)) * 0.25;
}
`;
