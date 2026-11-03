export const surfaceFunctions = /* glsl */ `
uniform sampler2D uField;
uniform sampler2D uPhoto;
const float TAN_FOV = 0.41421356237;
const float IMAGE_ASPECT = 1.3333333333;
vec3 pointAt(vec2 uv) {
  float d = texture(uField, uv).r;
  return vec3((uv * 2.0 - 1.0) * vec2(TAN_FOV * IMAGE_ASPECT, TAN_FOV) * d, -d);
}
vec2 projectPoint(vec3 p) { return p.xy / max(-p.z, 0.1) / vec2(TAN_FOV * IMAGE_ASPECT, TAN_FOV) * 0.5 + 0.5; }
vec3 normalAt(vec2 uv) {
  vec2 e = vec2(1.0 / 768.0, 1.0 / 576.0);
  vec3 p = pointAt(uv);
  vec3 l = p - pointAt(uv - vec2(e.x, 0.0));
  vec3 r = pointAt(uv + vec2(e.x, 0.0)) - p;
  vec3 b = p - pointAt(uv - vec2(0.0, e.y));
  vec3 t = pointAt(uv + vec2(0.0, e.y)) - p;
  vec3 dx = abs(l.z) < abs(r.z) ? l : r;
  vec3 dy = abs(b.z) < abs(t.z) ? b : t;
  vec3 n = normalize(cross(dx, dy));
  if (any(isnan(n))) n = vec3(0.0, 0.0, 1.0);
  return n;
}
vec3 probePosition(int index) {
  return vec3(float(index % 3 - 1) * 10.0, float(index / 3 - 1) * 7.0, 1.2);
}
`;

export const bakeVertex = /* glsl */ `
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const bakeFragment = /* glsl */ `
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 outColor;
uniform int uProbe;
uniform int uSample;
${surfaceFunctions}
uint seed;
float randomValue() {
  seed ^= seed >> 16u; seed *= 0x7feb352du; seed ^= seed >> 15u; seed *= 0x846ca68bu; seed ^= seed >> 16u;
  return float(seed >> 8u) / 16777216.0;
}
vec3 diffuseDirection(vec3 n) {
  float r = sqrt(randomValue()), a = randomValue() * 6.2831853;
  vec3 tangent = normalize(cross(abs(n.z) > 0.9 ? vec3(0,1,0) : vec3(0,0,1), n));
  return tangent * (r*cos(a)) + cross(n,tangent) * (r*sin(a)) + n*sqrt(1.0-r*r);
}
float visibility(vec3 a, vec3 b) {
  float jitter = randomValue();
  for(int i=1; i<33; i++) {
    vec3 p = mix(a,b,(float(i)+jitter)/33.0);
    if(p.z > -0.5) continue;
    vec2 uv = projectPoint(p);
    if(any(lessThan(uv,vec2(0))) || any(greaterThan(uv,vec2(1)))) continue;
    float depth = texture(uField,uv).r;
    if(-p.z > depth + max(0.09,depth*0.012)) return 0.0;
  }
  return 1.0;
}
vec3 directLight(vec3 p, vec3 n) {
  vec3 lamp = probePosition(uProbe);
  float angle = randomValue()*6.2831853, radius = sqrt(randomValue())*0.4;
  lamp += vec3(cos(angle)*radius,sin(angle)*radius,0);
  vec3 delta = lamp-p;
  float d2 = dot(delta,delta);
  float cosine = max(0.0,dot(n,normalize(delta)));
  return vec3(cosine * 42.0 / (d2+3.0) * visibility(p+n*0.10,lamp));
}
bool bounceHit(vec3 p, vec3 direction, out vec2 uv) {
  float distance = 0.12;
  for(int i=0;i<28;i++) {
    distance += 0.10 + distance*0.20;
    vec3 at = p + direction*distance;
    if(at.z > -0.5) return false;
    uv = projectPoint(at);
    if(any(lessThan(uv,vec2(0.002))) || any(greaterThan(uv,vec2(0.998)))) return false;
    float d = texture(uField,uv).r;
    if(-at.z > d+max(0.05,d*0.006)) return true;
  }
  return false;
}
void main() {
  seed = uint(gl_FragCoord.x)*1973u + uint(gl_FragCoord.y)*9277u + uint(uSample+1)*26699u + uint(uProbe+1)*31847u;
  vec3 p = pointAt(vUv), n = normalAt(vUv);
  if(texture(uField,vUv).b > 0.5) { outColor=vec4(0,0,0,1); return; }
  vec3 radiance = directLight(p,n), throughput = vec3(1.0);
  for(int i=0;i<2;i++) {
    vec2 hitUv;
    if(!bounceHit(p+n*0.12,diffuseDirection(n),hitUv)) break;
    p = pointAt(hitUv); n = normalAt(hitUv);
    throughput *= clamp(texture(uPhoto,hitUv).rgb,vec3(0.03),vec3(0.75))*0.68;
    radiance += throughput*directLight(p,n);
  }
  outColor=vec4(min(radiance,vec3(6.0)),1.0);
}
`;

export const streetVertex = /* glsl */ `
out vec2 vUv;
out vec3 vPosition;
void main() {
  vUv=uv; vPosition=position;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}
`;

export const streetFragment = /* glsl */ `
precision highp float;
precision highp sampler2DArray;
out vec4 finalColor;
#define gl_FragColor finalColor
in vec2 vUv;
in vec3 vPosition;
uniform sampler2DArray uBake;
uniform vec2 uPointer;
uniform float uAimDepth;
uniform float uDepthTravel;
uniform vec3 uLightColor;
uniform float uPower;
uniform float uAmbient;
uniform float uWet;
uniform float uExposure;
uniform float uIndirect;
uniform int uMode;
uniform vec2 uBakeSize;
${surfaceFunctions}
vec3 directApprox(int layer, vec3 p, vec3 n) {
  vec3 delta=probePosition(layer)-p;
  return vec3(max(dot(n,normalize(delta)),0.0)*42.0/(dot(delta,delta)+3.0));
}
vec3 readProbe(int layer, vec3 p, vec3 n) {
  vec4 sum=vec4(0);
  float centerDepth=texture(uField,vUv).r;
  for(int i=0;i<5;i++) {
    vec2 off = i==0 ? vec2(0) : i==1 ? vec2(1,0) : i==2 ? vec2(-1,0) : i==3 ? vec2(0,1) : vec2(0,-1);
    vec2 uv=vUv+off/uBakeSize;
    float other=texture(uField,uv).r;
    float w=exp(-abs(other-centerDepth)*3.0)*(i==0?2.0:1.0);
    vec4 s=texture(uBake,vec3(uv,float(layer)));
    sum+=vec4(s.rgb/max(s.a,1.0),1.0)*w;
  }
  vec4 center=texture(uBake,vec3(vUv,float(layer)));
  return mix(directApprox(layer,p,n),sum.rgb/max(sum.a,0.001),min(center.a/8.0,1.0));
}
void main() {
  vec3 photo=texture(uPhoto,vUv).rgb;
  vec4 field=texture(uField,vUv);
  if(uMode==2) {
    float d=clamp((55.0-field.r)/50.0,0.0,1.0);
    gl_FragColor=vec4(vec3(d),1.0);
  } else {
    vec3 p=pointAt(vUv), n=normalAt(vUv);
    vec2 grid=clamp(uPointer+1.0,vec2(0.0),vec2(1.999));
    ivec2 cell=ivec2(floor(grid)); vec2 f=fract(grid);
    int a=cell.x+cell.y*3;
    vec3 irradiance=mix(mix(readProbe(a,p,n),readProbe(a+1,p,n),f.x),mix(readProbe(a+3,p,n),readProbe(a+4,p,n),f.x),f.y);
    vec3 lamp=vec3(uPointer*vec2(10.0,7.0),1.2);
    vec3 ray=vec3(uPointer*vec2(TAN_FOV*IMAGE_ASPECT,TAN_FOV),-1.0);
    vec3 aimDirection=normalize(mix(normalize(ray),normalize(ray*uAimDepth-lamp),uDepthTravel));
    float cone=dot(normalize(mix(p,p-lamp,uDepthTravel)),aimDirection);
    float beam=smoothstep(0.91,0.992,cone);
    float depthFocus=exp(-pow(log(max(field.r,0.1)/uAimDepth)/0.70,2.0));
    beam*=mix(1.0,0.10+2.5*depthFocus,uDepthTravel);
    vec3 l=normalize(lamp-p), v=normalize(cameraPosition-p), h=normalize(l+v);
    float floorAmount=field.g;
    float roughness=mix(0.65,0.20,uWet*floorAmount);
    // Small pavement relief breaks up the reflection without a decorative overlay.
    float micro=sin(p.x*35.0+p.z*8.0)*sin(p.z*31.0)*0.015*floorAmount;
    vec3 specNormal=normalize(n+vec3(micro,0.0,-micro));
    float nh=max(dot(specNormal,h),0.0), nv=max(dot(specNormal,v),0.001), nl=max(dot(specNormal,l),0.0);
    float alpha=roughness*roughness, a2=alpha*alpha;
    float distribution=a2/(3.14159*pow(nh*nh*(a2-1.0)+1.0,2.0));
    float k=(roughness+1.0)*(roughness+1.0)/8.0;
    float geometry=nv/(nv*(1.0-k)+k)*nl/(nl*(1.0-k)+k);
    float fresnel=0.035+0.965*pow(1.0-max(dot(v,h),0.0),5.0);
    float spec=distribution*geometry*fresnel/max(4.0*nv,0.01)*42.0/(dot(lamp-p,lamp-p)+3.0);
    float highlight=smoothstep(0.65,1.0,max(photo.r,max(photo.g,photo.b)));
    vec3 albedo=photo/max(0.36,sqrt(dot(photo,vec3(0.2126,0.7152,0.0722))));
    vec3 lighting=mix(vec3(dot(irradiance,vec3(0.3333))),irradiance,uIndirect);
    vec3 color=photo*uAmbient + albedo*lighting*uLightColor*uPower*(0.15+2.1*beam) + uLightColor*spec*uPower*mix(0.35,2.0,floorAmount)*uWet*(0.2+beam);
    color=mix(color,max(color,photo*0.9),highlight*0.6);
    color=mix(color,photo*uAmbient,field.b);
    color*=uExposure;
    // A soft shoulder leaves the source photograph intact at unit gain.
    color=color/(vec3(1.0)+max(color-vec3(0.82),vec3(0.0))*0.35);
    gl_FragColor=vec4(color,1.0);
  }
  #include <colorspace_fragment>
}
`;
