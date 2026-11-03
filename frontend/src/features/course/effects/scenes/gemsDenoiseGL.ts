/** Small bilateral resolve, ONCE after 64 spp. Never fed back into progressive accumulation. */
export const GEM_DENOISE_KERNEL = [1, 4, 6, 4, 1] as const;
export const GEM_DENOISE_RANGE = 24;
export const GEM_DENOISE_GLSL = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uNoisy;
uniform vec2 uSize;
layout(location=0) out vec4 outColor;
layout(location=1) out vec4 outHot;
const float kernel[5]=float[5](${GEM_DENOISE_KERNEL.map(n => `${n}.`).join(',')});
// Compare bounded HDR colours, but average original linear radiance: bright glints are not clipped.
vec3 guide(vec3 c) { return c/(1.+c); }
void main() {
  ivec2 pixel=ivec2(gl_FragCoord.xy),last=ivec2(uSize)-1;
  vec3 centre=texelFetch(uNoisy,pixel,0).rgb;
  vec3 centreGuide=guide(centre),sum=vec3(0);
  float total=0.;
  for(int y=-2;y<=2;y++) for(int x=-2;x<=2;x++) {
    vec3 value=texelFetch(uNoisy,clamp(pixel+ivec2(x,y),ivec2(0),last),0).rgb;
    vec3 difference=guide(value)-centreGuide;
    float weight=kernel[x+2]*kernel[y+2]*exp2(-${GEM_DENOISE_RANGE}.*dot(difference,difference));
    sum+=value*weight; total+=weight;
  }
  vec3 colour=sum/total;
  outColor=vec4(colour,1);
  float luminance=dot(colour,vec3(.2126,.7152,.0722));
  vec3 hot=colour*max(luminance-1.2,0.)/max(luminance,1e-4);
  outHot=vec4(1.-exp(-hot*.5),1);
}`;
