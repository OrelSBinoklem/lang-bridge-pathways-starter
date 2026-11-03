/** Deterministic, bounded dielectric optics. No stochastic samples / accumulation / general-scene path tracing. */
export const GEM_FAST_GLSL = `
uniform int uFastReflections;
uniform sampler2D uCaustics;
uniform vec4 uCausticBounds;
float fastFresnel(float cosine,float fromIor,float toIor) {
  float ci=clamp(cosine,0.,1.),eta=fromIor/toIor;
  float sin2=eta*eta*max(0.,1.-ci*ci);
  if(sin2>=1.) return 1.;
  float ct=sqrt(max(0.,1.-sin2));
  float rs=(fromIor*ci-toIor*ct)/max(fromIor*ci+toIor*ct,1e-7);
  float rp=(toIor*ci-fromIor*ct)/max(toIor*ci+fromIor*ct,1e-7);
  return .5*(rs*rs+rp*rp);
}
vec3 fastFloor(vec3 p,vec3 view) {
  vec3 normal,L;float rough;
  vec3 albedo=floorAlbedo(p,normal,rough),I=lampAt(p,L);
  // Resolve the receiving cell for BOTH direct and refracted views, including rays crossing a cell edge.
  vec3 world=toWorldGem(p);
  vec2 css=hexCentre(vec2(world.x,-world.y)*uGemR,gGridOrigin,uCellR);
  mat2 r=cellRotation(css);
  vec2 local=r*(world.xy-vec2(css.x,-css.y)/uGemR);
  vec3 localL=vec3(r*dirWorldGem(L).xy,L.z);
  float height=gDomeG?uCab.z*.8:1.05;
  vec2 projected=local+localL.xy/max(localL.z,.15)*height;
  float inShadow = 1.0 - smoothstep(-.08,.1,outlineDist(projected));
  // Direct light is occluded; transmitted light is supplied separately by the photon map.
  I*=mix(1.,uOpal==2?.22:.06,inShadow);
  float nl=max(dot(normal,L),0.);
  vec3 H=normalize(L+view);
  vec3 result=albedo*(I*nl+vec3(.05,.05,.06)*uStudio+.02);
  vec2 causticUv=(vec2(world.x,-world.y)*uGemR-uCausticBounds.xy)/uCausticBounds.zw;
  if(all(greaterThanEqual(causticUv,vec2(0)))&&all(lessThanEqual(causticUv,vec2(1))))
    result+=albedo*texture(uCaustics,causticUv).rgb;
  result+=I*nl*ggx(max(dot(normal,H),0.),max(.12,rough))*.04;
  if(uBacking!=1){
    if(uFabricKind==0){
      float rim=pow(1.-max(dot(normal,view),0.),1.2)*6.+pow(1.-max(dot(normal,H),0.),3.)*.4;
      result+=(albedo*1.6+.04)*I*rim*nl;
    }else{
      vec3 T=dirOriginalGem(vec3(transpose(r)*vec2(1.,.3*sin(local.y*1.5)),0.));
      T=normalize(T-normal*dot(normal,T));
      float th=sqrt(max(0.,1.-pow(dot(T,H),2.)));
      float exponent=uFabricKind==2?140.:50.;
      float filteredExponent=exponent/(1.+exponent*gPixelWorld*gPixelWorld);
      float sp=pow(th,filteredExponent)*(filteredExponent/exponent)*(uFabricKind==2?1.6:.7);
      result+=mix(vec3(1),albedo,.5)*I*sp*nl;
      result+=albedo*rtEnvironment(reflect(-view,normal))*(uFabricKind==2?.6:.25);
    }
  }
  // Analytic micro-grain remains sharp at native resolution. Subpixel flakes converge to their mean.
  vec2 offset=hash22(css*.071)*37.;
  vec2 grain=local*90.+offset*30.;
  float coverage=1.-smoothstep(.35,1.1,gPixelWorld*90.);
  vec2 fl=(hash22(floor(grain))-.5)*.9;
  vec3 nf=dirOriginalGem(vec3(transpose(r)*fl,1.));
  float sparkle=pow(max(dot(normalize(nf),H),0.),900.)*step(.8,hash12(floor(grain)+3.1));
  float spark=uBacking==1?(uRock==5?2.:uRock==2?1.:uRock==4?.3:uRock==10?.5:0.):0.;
  result+=I*mix(.00022,sparkle,coverage)*6.*spark;
  float contact=1.-smoothstep(0.,.25,outlineDist(local));
  return result*mix(1.,.45,contact*step(0.,outlineDist(local)));
}
vec3 fastOutside(vec3 p,vec3 d) {
  if(d.z<-.00001) {
    float t=(gFloorZ-p.z)/d.z;
    if(t>=-2.*GEM_EPS) return fastFloor(p+d*t,-d);
  }
  return rtEnvironment(d)+lampSeen(d,p);
}
bool fastExit(vec3 p,vec3 d,out float t,out vec3 n) {
  if(!gDomeG) {
    t=leave(p,d,n);
    return t>GEM_EPS*.1 && t<1e6;
  }
  float nearT;vec3 nearN;
  return gemInterval(p,d,1e6,nearT,t,nearN,n) && t>GEM_EPS*.1;
}
// Every ray that leaves the stone — the reflection off the entry face first, then each channel's refracted path,
// bounce by bounce — is shaded at ONE call of fastOutside (2026-10-30): the Windows shader compiler inlines every call,
// and a second call site doubled the biggest part of the shader and its first-visit compile. The same arithmetic in the
// same order as the former nested loops (channel, then bounce), written as one bounded loop.
vec3 fastDielectric(vec3 origin,vec3 direction,float entryT,vec3 entryN) {
  vec3 entry=origin+direction*entryT;
  vec3 absorption=mix(uAbsorb,uAbsorbWarm,uWarm);
  vec3 result=vec3(0),indices=uIor+uDisp*vec3(-.55,0.,.9);
  vec3 L;vec3 lamp=lampAt(entry,L);
  vec3 reflected=vec3(0);
  int channel=-1,bounce=0;
  float ior=1.,value=0.,weight=0.;
  vec3 d=direction,p=entry;
  int steps=1+3*(uFastReflections+1);
  for(int step=0;step<steps+ZERO;step++) {
    if(channel>2) break;
    vec3 so=vec3(0),sd=vec3(0),hit=vec3(0),n=vec3(0);
    float factor=0.,exitF=1.;
    bool done=false;
    if(channel<0) { so=entry+entryN*GEM_EPS; sd=reflect(direction,entryN); factor=1.; }
    else {
      float distance;
      if(!fastExit(p,d,distance,n)) done=true;
      else {
        hit=p+d*distance;
        weight*=exp(-absorption[channel]*distance);
        if(uJardin>0.) {
          float cloud=fbm((p.xy+hit.xy)*3.+vec2(p.z*2.,0));
          weight*=mix(1.,.45+.55*cloud,uJardin);
        }
        if(uSilk>0.) {
          vec2 m=(p.xy+hit.xy)*.5;
          float fibres=pow(abs(sin(dot(m,vec2(1,0))*160.+fbm(m*6.)*4.)),18.)
            +pow(abs(sin(dot(m,vec2(.5,.866))*160.)),18.);
          value+=weight*uSilk*.005*lamp[channel]*fibres;
        }
        exitF=fastFresnel(dot(d,n),ior,1.);
        if(exitF<1.) {
          vec3 outgoing=refract(d,-n,ior);
          so=hit+outgoing*GEM_EPS; sd=outgoing; factor=weight*(1.-exitF);
        }
        if(bounce==uFastReflections || weight*exitF<.0005) done=true;
      }
    }
    if(factor>0.) {
      vec3 shaded=fastOutside(so,sd);
      if(channel<0) reflected=shaded; else value+=factor*shaded[channel];
    }
    if(channel<0 || done) {
      if(channel>=0) result[channel]=value;
      channel++;
      if(channel<=2) {
        ior=indices[channel];
        float entryF=fastFresnel(-dot(direction,entryN),1.,ior);
        value=reflected[channel]*entryF; weight=1.-entryF;
        // Refraction is evaluated at entry separately too, not just recoloured after a common green path.
        d=refract(direction,entryN,1./ior); p=entry+d*GEM_EPS; bounce=0;
      }
    } else { weight*=exitF; d=reflect(d,n); p=hit+d*GEM_EPS; bounce++; }
  }
  result+=vec3(1.,.06,.08)*uFluor*.12*dot(lamp,vec3(.33));
  return max(result,vec3(0));
}
`;
