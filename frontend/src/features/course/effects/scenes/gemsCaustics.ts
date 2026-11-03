import { cutPlanes, type Gem } from './gemsData';
import { GEM_GEOMETRY_GLSL } from './gemsGeometryGL';
import { GEM_FAST_GLSL } from './gemsFastGL';
import { createProgressiveProgram } from './progressiveProgram';
import type { GemLook } from './gemsGL';

// Irradiance only, never the scene image. Fixed photon work independent of native output resolution.
export const CAUSTIC_SIZE = 1024;
export const CAUSTIC_RAY_BUDGET = 45000;
export function causticLayout(w: number, h: number, radius: number, cam: readonly number[], analyticDome=false) {
  const ox=w/2,oy=h/2,c=Math.cos(cam[0]),s=Math.sin(cam[0]);
  const point=(x:number,y:number)=>{
    const a=(x-ox)/cam[2],b=(y-oy)/(cam[2]*Math.cos(cam[1]));
    return [ox+c*a-s*b,oy+s*a+c*b];
  };
  const corners=[point(0,0),point(w,0),point(0,h),point(w,h)];
  const x0=Math.min(...corners.map(p=>p[0]))-radius*2;
  const y0=Math.min(...corners.map(p=>p[1]))-radius*2;
  const x1=Math.max(...corners.map(p=>p[0]))+radius*2;
  const y1=Math.max(...corners.map(p=>p[1]))+radius*2;
  const cells:number[]=[];
  for(let q=Math.floor((x0-ox)/(1.5*radius));q<=Math.ceil((x1-ox)/(1.5*radius));q++) {
    const dy=Math.sqrt(3)*radius;
    for(let r=Math.floor((y0-oy)/dy-q*.5);r<=Math.ceil((y1-oy)/dy-q*.5);r++)
      cells.push(ox+1.5*radius*q,oy+dy*(r+q*.5));
  }
  const count=cells.length/2;
  // Each deposited photon evaluates two neighbours too: the footprint must follow refraction's magnification.
  // Closed ellipsoids need one quadratic, not dozens of clipping planes. Spend that saving on smooth coverage.
  const budget=CAUSTIC_RAY_BUDGET*(analyticDome?12:1);
  const grid=Math.max(1,Math.min(28,Math.floor(Math.sqrt(budget/(27*count)))));
  return { cells:new Float32Array(cells), bounds:[x0,y0,x1-x0,y1-y0] as const, grid, point };
}

const intersections=GEM_GEOMETRY_GLSL.slice(GEM_GEOMETRY_GLSL.indexOf('bool rayBox(vec3 o, vec3 d'),GEM_GEOMETRY_GLSL.indexOf('vec3 toWorldGem'));
const fresnel=GEM_FAST_GLSL.slice(GEM_FAST_GLSL.indexOf('float fastFresnel'),GEM_FAST_GLSL.indexOf('vec3 fastFloor'));
export const CAUSTIC_VERTEX=`#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec2 aCell;
uniform vec4 uBounds;
uniform vec4 uPlanes[96];uniform int uNPlanes;
uniform vec4 uCab;uniform float uGemR,uSpin,uIor,uDisp;
uniform vec3 uLamp,uPower,uAbsorb;
uniform int uGrid;uniform float uMaxPoint;
out vec3 vFlux;
flat out mat2 vKernel;
const float GEM_EPS=.0004;
bool gDomeG;
float hash12(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
${intersections}
${fresnel}
bool photon(vec2 uv,vec3 lamp,float ior,int channel,int targetBounce,out vec2 hit,out float flux){
  vec3 aperture=vec3((uv-.5)*3.2,.6);
  vec3 d=normalize(aperture-lamp);
  if(d.z>=-.001)return false;
  float nearT,farT;vec3 nearN,farN;
  if(!gemInterval(lamp,d,1e6,nearT,farT,nearN,farN)||nearT<=0.)return false;
  float weight=1.-fastFresnel(-dot(d,nearN),1.,ior);
  float incident=max(-d.z,0.)*pow(420./uGemR,2.)/dot(aperture-lamp,aperture-lamp);
  vec3 p=lamp+d*nearT;
  d=refract(d,nearN,1./ior);p+=d*GEM_EPS;
  for(int bounce=0;bounce<3;bounce++){
    if(!gemInterval(p,d,1e6,nearT,farT,nearN,farN)||farT<=GEM_EPS*.1)return false;
    weight*=exp(-uAbsorb[channel]*farT);
    p+=d*farT;
    float F=fastFresnel(dot(d,farN),ior,1.);
    if(bounce==targetBounce){
      if(F>=1.)return false;
      d=refract(d,-farN,ior);weight*=1.-F;break;
    }
    weight*=F;
    if(weight<.0005)return false;
    d=reflect(d,farN);p+=d*GEM_EPS;
  }
  float floorZ=gDomeG?0.:-.9;
  if(d.z>=-.001)return false;
  float distance=(floorZ-p.z)/d.z;
  if(distance< -GEM_EPS*2.)return false;
  hit=(p+d*distance).xy;
  flux=incident*weight*pow(3.2/float(uGrid),2.);
  return true;
}
void main(){
  gl_Position=vec4(2,2,2,1);gl_PointSize=1.;vFlux=vec3(0);vKernel=mat2(1.);
  gDomeG=uCab.w>.5;
  int sampleCount=uGrid*uGrid,channel=(gl_VertexID/sampleCount)%3,targetBounce=gl_VertexID/(sampleCount*3);
  int sampleId=gl_VertexID%sampleCount;
  vec2 uv=(vec2(sampleId%uGrid,sampleId/uGrid)+.5)/float(uGrid);
  float angle=(hash12(aCell*.137)-.5)*6.2831853*uSpin;
  mat2 rot=mat2(cos(angle),sin(angle),-sin(angle),cos(angle));
  vec3 lamp=vec3(rot*vec2(uLamp.x-aCell.x,aCell.y-uLamp.y)/uGemR,uLamp.z/uGemR);
  float ior=uIor+uDisp*(channel==0?-.55:channel==1?0.:.9);
  vec2 hit,hx,hy;float flux,unused;
  if(!photon(uv,lamp,ior,channel,targetBounce,hit,flux))return;
  float delta=.2/float(uGrid);
  bool hasX=photon(uv+vec2(delta,0),lamp,ior,channel,targetBounce,hx,unused);
  bool hasY=photon(uv+vec2(0,delta),lamp,ior,channel,targetBounce,hy,unused);
  vec2 scale=vec2(1,-1)*uGemR*${CAUSTIC_SIZE}./uBounds.zw;
  vec2 dx=transpose(rot)*(hasX?(hx-hit)*5.:vec2(3.2/float(uGrid),0.))*scale;
  vec2 dy=transpose(rot)*(hasY?(hy-hit)*5.:vec2(0.,3.2/float(uGrid)))*scale;
  vec2 worldHit=transpose(rot)*hit*uGemR;
  vec2 css=aCell+vec2(worldHit.x,-worldHit.y);
  vec2 tex=(css-uBounds.xy)/uBounds.zw;
  gl_Position=vec4(tex*2.-1.,0,1);
  // Elliptical reconstruction follows the actual refracted ray differentials, not the source grid.
  // Overlapping kernels eliminate the visible matrix of separate photon dots on smooth cabochons.
  float pixelWorld=sqrt(uBounds.z*uBounds.w)/${CAUSTIC_SIZE}. /uGemR;
  float blur=max(1.,18./uGemR*.9/max(lamp.z-.6,.1)/pixelWorld);
  mat2 covariance=.6*(outerProduct(dx,dx)+outerProduct(dy,dy))+mat2(blur*blur);
  float a=covariance[0][0],b=covariance[0][1],c=covariance[1][1];
  float largest=.5*(a+c+sqrt((a-c)*(a-c)+4.*b*b));
  // Respect the driver's point-size range; clamp covariance consistently, not just sprite size.
  covariance*=min(1.,(uMaxPoint*uMaxPoint/36.)/max(largest,.0001));
  largest=min(largest,uMaxPoint*uMaxPoint/36.);
  float size=ceil(max(2.,6.*sqrt(largest)));gl_PointSize=size;
  vKernel=inverse(covariance)*(size*size*.125);
  float integral=6.2831853*sqrt(max(determinant(covariance),.0001))*(1.-exp(-4.5));
  vFlux[channel]=uPower[channel]*flux/(pixelWorld*pixelWorld*integral);
}`;
const FRAGMENT=`#version 300 es
precision highp float;
in vec3 vFlux;flat in mat2 vKernel;out vec4 color;
void main(){vec2 q=gl_PointCoord*2.-1.;q.y=-q.y;float exponent=dot(q,vKernel*q);if(exponent>4.5)discard;color=vec4(vFlux*exp(-exponent),0);}`;

export function createGemCaustics(gl:WebGL2RenderingContext) {
  const pointRange=gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array|undefined;
  const maxPoint=Math.min(64,pointRange?.[1]??64);
  const pending=createProgressiveProgram(gl,CAUSTIC_VERTEX,FRAGMENT,'gems: caustic photons');
  if(!pending)throw new Error('Cannot allocate gem caustics shader');
  const texture=gl.createTexture()!,framebuffer=gl.createFramebuffer()!,vao=gl.createVertexArray()!,buffer=gl.createBuffer()!;
  gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,CAUSTIC_SIZE,CAUSTIC_SIZE,0,gl.RGBA,gl.HALF_FLOAT,null);
  gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
  gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
  gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.vertexAttribDivisor(0,1);
  let key='',layoutKey='',layout:ReturnType<typeof causticLayout>|null=null;
  let bakes=0,rays=0;
  return {
    texture,
    ready(){if(pending.failed())throw new Error('Gem caustics shader failed; see console');return pending.ready();},
    get diagnostics(){return {causticBakes:bakes,causticRays:rays};},
    render(gem:Gem,look:GemLook,w:number,h:number){
      const cam=look.cam??[0,0,1];
      const nextLayout=JSON.stringify([w,h,look.cellR,cam,gem.cut==='cabochon']);
      if(nextLayout!==layoutKey){
        layout=causticLayout(w,h,look.cellR,cam,gem.cut==='cabochon');layoutKey=nextLayout;
        gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,layout.cells,gl.STATIC_DRAW);
      }
      const data=layout!;
      const next=JSON.stringify([gem.id,nextLayout,look.lamp,look.lampI,look.warm,look.fire,look.spin]);
      if(next===key)return data.bounds;
      key=next;bakes++;
      gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.viewport(0,0,CAUSTIC_SIZE,CAUSTIC_SIZE);
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
      rays=0;
      if(gem.opal>0&&gem.opal!==4)return data.bounds;
      gl.useProgram(pending.prog);gl.bindVertexArray(vao);
      const u=pending.u,planes=cutPlanes(gem),arr=new Float32Array(384);arr.set(planes);
      gl.uniform4fv(u('uPlanes'),arr);gl.uniform1i(u('uNPlanes'),planes.length/4);
      gl.uniform4f(u('uCab'),1,1/gem.aspect,gem.opal===4?.5:.42,gem.cut==='cabochon'?1:0);
      gl.uniform4fv(u('uBounds'),data.bounds);
      gl.uniform1f(u('uGemR'),look.cellR*.56);gl.uniform1f(u('uSpin'),look.spin);
      gl.uniform1f(u('uIor'),gem.ior);gl.uniform1f(u('uDisp'),gem.dispersion*look.fire);
      gl.uniform1i(u('uGrid'),data.grid);
      gl.uniform1f(u('uMaxPoint'),maxPoint);
      const lamp=data.point(look.lamp[0],look.lamp[1]);
      gl.uniform3f(u('uLamp'),lamp[0],lamp[1],look.lamp[2]);
      gl.uniform3f(u('uPower'),look.lampI,(.97-.27*look.warm)*look.lampI,(.93-.53*look.warm)*look.lampI);
      gl.uniform3fv(u('uAbsorb'),gem.absorb.map((a,i)=>a*(1-look.warm)+(gem.absorbWarm??gem.absorb)[i]*look.warm));
      gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.blendEquation(gl.FUNC_ADD);
      const vertices=data.grid*data.grid*9;
      gl.drawArraysInstanced(gl.POINTS,0,vertices,data.cells.length/2);
      gl.disable(gl.BLEND);
      rays=vertices*data.cells.length/2*3;
      return data.bounds;
    },
    dispose(){pending.dispose();gl.deleteTexture(texture);gl.deleteFramebuffer(framebuffer);gl.deleteBuffer(buffer);gl.deleteVertexArray(vao);},
  };
}
