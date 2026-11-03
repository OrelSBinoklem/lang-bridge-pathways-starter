/** Exact convex-plane clipping / half-ellipsoid intersections shared by eye, shadow and secondary rays. */
export const GEM_GEOMETRY_GLSL = `
const float GEM_EPS = .0004;
uniform int uGridSteps;
mat2 gRot;
vec2 gCellCss, gGridOrigin;
int gHitKind;
bool rayBox(vec3 o,vec3 d,float limit);

float capsuleHit(vec3 o,vec3 d,vec3 a,vec3 b,float radius,out vec3 n) {
  vec3 ba=b-a,oa=o-a; float bb=dot(ba,ba),bd=dot(ba,d),bo=dot(ba,oa);
  float A=bb-bd*bd,B=bb*dot(oa,d)-bo*bd,C=bb*dot(oa,oa)-bo*bo-radius*radius*bb;
  float t=1e7;
  if(abs(A)>1e-8 && B*B-A*C>=0.) {
    float root=sqrt(B*B-A*C);
    for(int j=0;j<2+ZERO;j++) {
      float hit=(-B+(j==0?-root:root))/A,y=bo+hit*bd;
      if(hit>GEM_EPS && hit<t && y>0. && y<bb) {t=hit;n=normalize(o+d*t-a-ba*y/bb);}
    }
  }
  for(int j=0;j<2+ZERO;j++) {
    vec3 centre=j==0?a:b,v=o-centre;float q=dot(v,d),disc=q*q-dot(v,v)+radius*radius;
    if(disc<0.) continue;
    float hit=-q-sqrt(disc);
    float y=dot(o+d*hit-a,ba);
    if(hit>GEM_EPS && hit<t && (j==0?y<=0.:y>=bb)) {t=hit;n=normalize(o+d*t-centre);}
  }
  return t;
}
float metalHit(vec3 o,vec3 d,float limit,out vec3 n) {
  if(uBacking!=2 || !rayBox(o,d,limit)) return 1e7;
  float best=1e7;
  // A closed elliptical metal band and actual capsule-shaped claws, not a screen-space overlay.
  vec2 a=o.xy/uCab.xy,b=d.xy/uCab.xy;
  float A=dot(b,b),B=dot(a,b);
  for(int ring=0;ring<2+ZERO;ring++) {
    float radius=ring==0?1.07:.98,disc=B*B-A*(dot(a,a)-radius*radius);
    if(A<1e-8 || disc<0.) continue;
    for(int side=0;side<2+ZERO;side++) {
      float t=(-B+(side==0?-1.:1.)*sqrt(disc))/A;
      vec3 p=o+d*t;
      if(t>GEM_EPS && t<min(best,limit) && p.z>=-.06 && p.z<=.04) {
        best=t;n=normalize(vec3(p.xy/(uCab.xy*uCab.xy),0))*(ring==0?1.:-1.);
      }
    }
  }
  if(abs(d.z)>1e-8) for(int side=0;side<2+ZERO;side++) {
    float t=((side==0?-.06:.04)-o.z)/d.z;vec2 p=(o+d*t).xy/uCab.xy;float r=length(p);
    if(t>GEM_EPS && t<min(best,limit) && r>=.98 && r<=1.07) {best=t;n=vec3(0,0,side==0?-1.:1.);}
  }
  if(!gDomeG) for(int claw=0;claw<6+ZERO;claw++) {
    if(claw>=uProngs) break;
    float angle=2.*PI*float(claw)/float(uProngs)+(uProngs==4?PI/4.:0.);
    vec2 radial=vec2(cos(angle),sin(angle));float r=outlineR(angle);vec3 cn;
    float t=capsuleHit(o,d,vec3(radial*(r-.13),.065),vec3(radial*(r+.1),-.025),.075,cn);
    if(t<min(best,limit)) {best=t;n=cn;}
  }
  return best;
}

bool rayBox(vec3 o, vec3 d, float limit) {
  vec3 inv = 1. / (sign(d + vec3(1e-12)) * max(abs(d), vec3(1e-8)));
  vec3 a = (vec3(-1.4,-1.4,-.91)-o)*inv, b = (vec3(1.4,1.4,.6)-o)*inv;
  vec3 lo = min(a,b), hi = max(a,b);
  return max(max(lo.x,lo.y),max(lo.z,0.)) < min(min(hi.x,hi.y),min(hi.z,limit));
}
bool gemInterval(vec3 o, vec3 d, float limit, out float nearT, out float farT, out vec3 nearN, out vec3 farN) {
  nearT=-1e8; farT=1e8; nearN=vec3(0,0,1); farN=vec3(0,0,-1);
  if (!rayBox(o,d,limit)) return false;
  if (gDomeG) {
    vec3 a=o/uCab.xyz, b=d/uCab.xyz;
    float qa=dot(b,b), qb=dot(a,b), qc=dot(a,a)-1.;
    float disc=qb*qb-qa*qc;
    if (disc<0.) return false;
    nearT=(-qb-sqrt(disc))/qa; farT=(-qb+sqrt(disc))/qa;
    nearN=normalize((o+d*nearT)/(uCab.xyz*uCab.xyz));
    farN=normalize((o+d*farT)/(uCab.xyz*uCab.xyz));
    // The cabochon is the upper half ellipsoid, closed by its real flat bottom, not a full sphere.
    if (abs(d.z)<1e-8) { if(o.z<0.) return false; }
    else {
      float bottom=-o.z/d.z;
      if(d.z>0. && bottom>nearT) { nearT=bottom; nearN=vec3(0,0,-1); }
      if(d.z<0. && bottom<farT) { farT=bottom; farN=vec3(0,0,-1); }
    }
  } else {
    for(int i=0;i<uNPlanes;i++) {
      vec4 p=uPlanes[i]; float nd=dot(p.xyz,d), dist=p.w-dot(p.xyz,o);
      if(abs(nd)<1e-8) { if(dist<0.) return false; }
      else {
        float t=dist/nd;
        if(nd<0. && t>nearT) { nearT=t; nearN=p.xyz; }
        if(nd>0. && t<farT) { farT=t; farN=p.xyz; }
        if(nearT>farT) return false;
      }
    }
  }
  return nearT<farT && farT>GEM_EPS && nearT<limit;
}
vec3 toWorldGem(vec3 p) { return vec3(transpose(gRot)*p.xy+vec2(gCellCss.x,-gCellCss.y)/uGemR,p.z); }
vec3 dirWorldGem(vec3 d) { return vec3(transpose(gRot)*d.xy,d.z); }
vec3 dirOriginalGem(vec3 d) { return vec3(gRot*d.xy,d.z); }
vec3 pointOriginalGem(vec3 p) { return vec3(gRot*(p.xy-vec2(gCellCss.x,-gCellCss.y)/uGemR),p.z); }
mat2 cellRotation(vec2 css) {
  float a=(hash12(css*.137)-.5)*2.*PI*uSpin;
  return mat2(cos(a),sin(a),-sin(a),cos(a));
}
// Hex-grid traversal skips empty space; each visited cut gets a cheap bounding-box rejection first.
// A finite 12-cell path budget is separate from the surface-bounce budget.
bool gridGemHit(vec3 o, vec3 d, float limit, out float hitT, out vec3 hitN, out vec2 hitCell) {
  vec3 ow=toWorldGem(o), dw=dirWorldGem(d);
  float start=0., end=limit;
  if(abs(dw.z)>1e-7) {
    float a=(-.91-ow.z)/dw.z, b=(.6-ow.z)/dw.z;
    start=max(0.,min(a,b)); end=min(end,max(a,b));
  } else if(ow.z<-.91 || ow.z>.6) return false;
  if(start>=end) return false;
  float cursor=start;
  for(int step=0;step<uGridSteps;step++) {
    vec3 at=ow+dw*(cursor+GEM_EPS);
    vec2 css=hexCentre(vec2(at.x,-at.y)*uGemR,gGridOrigin,uCellR);
    vec2 centre=vec2(css.x,-css.y)/uGemR;
    mat2 r=cellRotation(css);
    vec3 localO=vec3(r*(ow.xy-centre),ow.z), localD=vec3(r*dw.xy,dw.z);
    float nt,ft; vec3 nn,fn;
    float nearest=1e7; vec3 localN; int kind=1;
    if(gemInterval(localO,localD,end,nt,ft,nn,fn)) {nearest=nt>GEM_EPS?nt:ft;localN=nt>GEM_EPS?nn:fn;}
    vec3 metalN;float metalT=metalHit(localO,localD,end,metalN);
    if(metalT<nearest) {nearest=metalT;localN=metalN;kind=2;}
    if(nearest>=cursor-GEM_EPS && nearest<end) {
      hitT=nearest;hitN=dirOriginalGem(vec3(transpose(r)*localN.xy,localN.z));hitCell=css;gHitKind=kind;return true;
    }
    float edge=end;
    vec2 rel=ow.xy-centre;
    float h=.8660254*uCellR/uGemR;
    for(int side=0;side<6+ZERO;side++) {
      float angle=PI/6.+float(side)*PI/3.; vec2 n=vec2(cos(angle),sin(angle));
      float nd=dot(dw.xy,n);
      if(nd>1e-7) edge=min(edge,(h-dot(rel,n))/nd);
    }
    if(edge>=end-GEM_EPS) break;
    cursor=max(edge+GEM_EPS,cursor+GEM_EPS);
  }
  return false;
}
float geometricVisibility(vec3 p,vec3 light) {
  vec3 v=light-p; float len=length(v),t; vec3 n; vec2 cell;
  return gridGemHit(p+normalize(v)*GEM_EPS,normalize(v),len-GEM_EPS,t,n,cell)?0.:1.;
}
`;
