/** PCG RXS-M-XS, kept in uint arithmetic; shared reference for sampler regression tests. */
export function gemPcg(value: number) {
  const state = (Math.imul(value, 747796405) + 2891336453) >>> 0;
  const word = Math.imul((state >>> ((state >>> 28) + 4)) ^ state, 277803737) >>> 0;
  return ((word >>> 22) ^ word) >>> 0;
}

/** A bijection on six bits. Separate pixel/dimension seeds decorrelate the strata. */
export function gemPermute64(index: number, seed: number) {
  let value = (index ^ seed) & 63;
  value = Math.imul(value ^ (value >>> 3), ((seed >>> 6) & 63) | 1) & 63;
  value = Math.imul(value ^ (value >>> 2), ((seed >>> 12) & 63) | 1) & 63;
  return (value ^ (value >>> 3) ^ (seed >>> 18)) & 63;
}

export const GEM_SAMPLING_GLSL = `
uint gSeed=1u, gPixelSeed=1u;
uint pcgHash(uint value) {
  uint state=value*747796405u+2891336453u;
  uint word=((state>>((state>>28u)+4u))^state)*277803737u;
  return (word>>22u)^word;
}
float rnd() {
  gSeed=gSeed*747796405u+2891336453u;
  uint word=((gSeed>>((gSeed>>28u)+4u))^gSeed)*277803737u;
  // A 24-bit mantissa cannot round UINT_MAX to 1.0: all samples stay strictly below one.
  return float(((word>>22u)^word)>>8u)*(1./16777216.);
}
uint permute64(uint index,uint seed) {
  uint value=(index^seed)&63u;
  value=((value^(value>>3u))*(((seed>>6u)&63u)|1u))&63u;
  value=((value^(value>>2u))*(((seed>>12u)&63u)|1u))&63u;
  return (value^(value>>3u)^(seed>>18u))&63u;
}
uint sampleStratum(uint dimension) {
  return permute64(uint(uSample),pcgHash(gPixelSeed^pcgHash(dimension+0x9e3779b9u)));
}
float sample1D(uint dimension) { return (float(sampleStratum(dimension))+rnd())/64.; }
vec2 sample2D(uint dimension) {
  uint cell=sampleStratum(dimension);
  // Exactly one jittered sample per 8x8 cell over 64 spp, independently scrambled per dimension/pixel.
  return (vec2(float(cell&7u),float(cell>>3u))+vec2(rnd(),rnd()))/8.;
}
void startGemSample() {
  gPixelSeed=pcgHash(uint(gl_FragCoord.x)^pcgHash(uint(gl_FragCoord.y)+0x85ebca6bu));
  gSeed=pcgHash(gPixelSeed^pcgHash(uint(uSample)+0xc2b2ae35u));
}
`;
