/** Finite-depth Monte Carlo light transport: actual scene intersections after every reflection/refraction. */
export const GEM_PATH_GLSL = `
uniform int uPathSteps;
uniform int uMaxReflections;
uniform sampler2D uMaterialColor;
uniform sampler2D uMaterialNormal;
bool gSurfaceMetal=false;
uint gBounceDimension=0u;
vec3 rtEnvironment(vec3 d) {
  vec3 saved=gV; gV=dirWorldGem(gV);
  vec3 value=env(dirWorldGem(d)); gV=saved; return value;
}
vec3 cosineDirection(vec3 n) {
  vec2 u=sample2D(gBounceDimension+1u);
  float a=2.*PI*u.x,r=sqrt(u.y);
  vec3 t=normalize(cross(abs(n.z)>.9?vec3(0,1,0):vec3(0,0,1),n));
  return normalize(t*r*cos(a)+cross(n,t)*r*sin(a)+n*sqrt(max(0.,1.-r*r)));
}
vec3 sampleLamp() {
  vec2 u=sample2D(gBounceDimension);
  float a=2.*PI*u.x,r=gLampSize*sqrt(u.y);
  return gLampP+vec3(cos(a)*r,sin(a)*r,0);
}
float lampIntersection(vec3 p,vec3 d) {
  if(d.z<=1e-7) return 1e7;
  float t=(gLampP.z-p.z)/d.z;
  return t>GEM_EPS && length((p+d*t-gLampP).xy)<gLampSize?t:1e7;
}
float lampPdf(vec3 a,vec3 b) {
  vec3 v=b-a; return dot(v,v)/(PI*gLampSize*gLampSize*max(.0001,abs(normalize(v).z)));
}
vec3 lampRadiance() { float h=420./uGemR; return gLampCol*h*h/(PI*gLampSize*gLampSize); }
float powerWeight(float a,float b) { return a*a/max(a*a+b*b,1e-12); }
vec3 floorAlbedo(vec3 p,out vec3 normal,out float rough) {
  vec3 world=toWorldGem(p);
  vec2 css=hexCentre(vec2(world.x,-world.y)*uGemR,gGridOrigin,uCellR);
  vec2 centre=vec2(css.x,-css.y)/uGemR; mat2 r=cellRotation(css);
  vec2 local=r*(world.xy-centre); vec2 offset=hash22(css*.071)*37.;
  vec2 uv=fract((local+offset/(uBacking==1?1.2:.75))/24.+.5);
  vec4 material=texture(uMaterialColor,uv);
  vec3 localN=normalize(texture(uMaterialNormal,uv).xyz*2.-1.);
  vec3 albedo=material.rgb;
  normal=dirOriginalGem(vec3(transpose(r)*localN.xy,localN.z));
  rough=material.a;
  return clamp(albedo,vec3(.001),vec3(.96));
}
vec3 surfaceBsdf(vec3 albedo,vec3 n,vec3 v,vec3 l,float rough) {
  float nv=max(dot(n,v),.0001),nl=max(dot(n,l),0.);
  if(nl<=0.) return vec3(0);
  vec3 h=normalize(v+l); float nh=max(dot(n,h),0.),vh=max(dot(v,h),0.);
  float alpha=max(.06,rough*rough),a2=alpha*alpha;
  float D=ggx(nh,alpha);
  float Gv=2.*nv/(nv+sqrt(a2+(1.-a2)*nv*nv));
  float Gl=2.*nl/(nl+sqrt(a2+(1.-a2)*nl*nl));
  vec3 f0=gSurfaceMetal?uMetal:vec3(.04),F=f0+(1.-f0)*pow(1.-vh,5.);
  return (gSurfaceMetal?vec3(0):albedo*(1.-F)/PI)+F*D*Gv*Gl/max(4.*nv*nl,.0001);
}
float surfacePdf(vec3 n,vec3 v,vec3 l,float rough) {
  vec3 h=normalize(v+l); float nh=max(dot(n,h),0.);
  float spec=gSurfaceMetal?.9:.1;
  return (1.-spec)*max(dot(n,l),0.)/PI+spec*ggx(nh,max(.06,rough*rough))*nh/max(4.*abs(dot(v,h)),.0001);
}
vec3 sampleSurface(vec3 n,vec3 v,float rough) {
  if(rnd()>(gSurfaceMetal?.9:.1)) return cosineDirection(n);
  vec2 uv=sample2D(gBounceDimension+1u);
  float a=max(.06,rough*rough),u=uv.x;
  float cz=sqrt((1.-u)/(1.+(a*a-1.)*u)),sz=sqrt(max(0.,1.-cz*cz)),phi=2.*PI*uv.y;
  vec3 t=normalize(cross(abs(n.z)>.9?vec3(0,1,0):vec3(0,0,1),n));
  vec3 h=normalize(n*cz+(t*cos(phi)+cross(n,t)*sin(phi))*sz);
  return reflect(-v,h);
}
// Closed surface dielectric, real floor hits and secondary gem hits; no painted contact shadow/FBM caustic.
vec3 pathTraceTray(vec3 ro,vec3 rd) {
  vec3 radiance=vec3(0),throughput=vec3(1);
  bool inside=false,delta=true;
  int reflections=0,transmissions=0;
  float previousPdf=1.; vec3 previousPoint=ro;
  float lambda=400.+300.*sample1D(1u);
  vec3 spectralWeight=spectral(lambda)*uSpecK;
  float ior=uIor+uDisp*(lambda<550.?mix(.9,0.,clamp((lambda-450.)/100.,0.,1.)):mix(0.,-.55,clamp((lambda-550.)/100.,0.,1.)));
  vec3 absorption=mix(uAbsorb,uAbsorbWarm,uWarm);
  // The terminal lookup after the last surface can still see an emitter/environment, never a third reflection.
  for(int bounce=0;bounce<=uPathSteps;bounce++) {
    gBounceDimension=2u+uint(bounce)*2u;
    float floorT=rd.z<-.00001?(gFloorZ-ro.z)/rd.z:1e7;
    if(floorT<GEM_EPS) floorT=1e7;
    float lightT=lampIntersection(ro,rd), t=min(floorT,lightT),gemT;
    vec3 n; vec2 cell;
    bool gemHit=gridGemHit(ro,rd,t,gemT,n,cell);
    int hitKind=gemHit?gHitKind:0;
    if(gemHit) t=gemT;
    if(inside && t<1e6) throughput*=exp(-absorption*t);
    if(t>1e6) { radiance+=throughput*rtEnvironment(rd); break; }
    vec3 p=ro+rd*t;
    if(!gemHit && lightT<floorT) {
      radiance+=throughput*lampRadiance()*(delta?1.:powerWeight(previousPdf,lampPdf(previousPoint,p))); break;
    }
    if(bounce==uPathSteps) break;
    if(hitKind==1 && !(uOpal>=1 && uOpal<=3)) {
      bool entering=dot(rd,n)<0.; vec3 facing=entering?n:-n;
      float eta=entering?1./ior:ior;
      vec3 transmitted=refract(rd,facing,eta);
      float F=fresnel(abs(dot(rd,n)),ior);
      if(dot(transmitted,transmitted)<1e-8 || rnd()<F) {
        if(reflections>=uMaxReflections) break;
        reflections++; rd=reflect(rd,facing);
      }
      else {
        if(transmissions>=6) break;
        transmissions++; rd=normalize(transmitted); inside=entering;
      }
      // Every reflected/refracted ray re-enters the real scene, not a flat environment estimate.
      ro=p+rd*GEM_EPS; delta=true;
    } else {
      if(reflections>=uMaxReflections) break;
      reflections++;
      vec3 albedo; float rough;
      gSurfaceMetal=hitKind==2;
      if(gSurfaceMetal) {albedo=uMetal;rough=.16;}
      else if(gemHit) {
        // Opal's visible colour remains a procedural scattering BSDF; geometry/visibility are traced.
        vec3 world=toWorldGem(p); mat2 r=cellRotation(cell);
        vec2 local=r*(world.xy-vec2(cell.x,-cell.y)/uGemR);
        albedo=uOpal==2?vec3(.62,.64,.68):uOpal==3?vec3(.18,.085,.04):vec3(.014,.017,.025);
        vec3 L=normalize(gLampP-p); vec2 domain;
        vec2 vc=voronoi(local*(uOpal==2?4.2:2.6),domain);
        vec3 domainN=normalize(n+vec3((hash22(domain)-.5)*.65,0));
        float alignment=max(dot(normalize(L-rd),domainN),0.);
        float wavelength=mix(440.,720.,hash12(domain*1.7+.3))*alignment;
        vec3 diffraction=spectral(wavelength)*exp(-(1.-alignment)*55.)*smoothstep(0.,.14,vc.y);
        albedo=clamp(albedo+diffraction*(uOpal==2?.45:1.4),vec3(.002),vec3(.95));
        rough=.16;
      } else albedo=floorAlbedo(p,n,rough);
      vec3 v=-rd;
      if(dot(n,v)<0.) n=-n;
      vec3 lp=sampleLamp(),lv=lp-p,l=normalize(lv);
      float pdfL=lampPdf(p,lp),pdfB=surfacePdf(n,v,l,rough);
      float visibility=geometricVisibility(p+n*GEM_EPS,lp);
      radiance+=throughput*surfaceBsdf(albedo,n,v,l,rough)*lampRadiance()*max(dot(n,l),0.)*visibility/pdfL*powerWeight(pdfL,pdfB);
      rd=sampleSurface(n,v,rough);
      previousPdf=surfacePdf(n,v,rd,rough);
      throughput*=surfaceBsdf(albedo,n,v,rd,rough)*max(dot(n,rd),0.)/max(previousPdf,1e-8);
      previousPoint=p; ro=p+n*GEM_EPS; delta=false; inside=false;
    }
    if(bounce>=5) {
      float survival=clamp(max(throughput.r,max(throughput.g,throughput.b)),.08,.95);
      if(rnd()>survival) break;
      throughput/=survival;
    }
  }
  return max(vec3(0),radiance*spectralWeight);
}
`;
