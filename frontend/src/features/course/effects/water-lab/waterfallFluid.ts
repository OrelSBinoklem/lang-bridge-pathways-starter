import * as THREE from 'three';
import { FLUID_DT, PRESSURE_ITERATIONS, fluidGrid, fluidSteps, type WaterPointer } from './waterfallSimulation';

const vertex = `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const header = `
varying vec2 vUv;
uniform sampler2D uVelocity,uWater,uPressure,uDivergence;
uniform vec2 uCell,uSize;
uniform vec4 uPointer;
uniform float uDt,uFlow,uTime;
vec2 X(){return vec2(uCell.x,0.);}
vec2 Y(){return vec2(0.,uCell.y);}
bool solid(vec2 p){
  return p.y<.105 || (uPointer.w>.5 && uPointer.w<1.5 && length(p*uSize-uPointer.xy)<uPointer.z);
}
float water(vec2 p){return solid(p)||p.x<0.||p.x>1.||p.y>1.?0.:texture2D(uWater,p).r;}
bool wet(vec2 p){return water(p)>.035;}
vec2 velocity(vec2 p){
  vec2 v=texture2D(uVelocity,p).xy;
  return .5*vec2(v.x+texture2D(uVelocity,p-X()).x,v.y+texture2D(uVelocity,p-Y()).y);
}
vec2 trace(vec2 p,vec2 v){
  vec2 end=p-v*uDt/uSize;
  // Stop the backtrace at a solid: fast flow must not sample through the cursor.
  for(int i=1;i<=4;i++){vec2 q=mix(p,end,float(i)*.25);if(solid(q))return mix(p,end,float(i-1)*.25);}
  return clamp(end,uCell*.5,1.-uCell*.5);
}
float pressure(vec2 p,float center){return solid(p)?center:(wet(p)?texture2D(uPressure,p).r:0.);}
float source(vec2 p){
  float halfWidth=min(.19*uSize.x,.235)*(.65+.35*uFlow);
  float edge=abs((p.x-.5)*uSize.x);
  return (1.-smoothstep(halfWidth-.009,halfWidth,edge))*step(.831,p.y)*step(p.y,.852);
}
`;

/** MAC face velocities + air-pressure boundary. An approximate 2D liquid sheet, not a 3D splash solver. */
export function createWaterfallFluid(renderer: THREE.WebGLRenderer) {
  const scene = new THREE.Scene(), camera = new THREE.Camera();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); scene.add(quad);
  const target = () => new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
  });
  const vel = [target(), target()], liquid = [target(), target()], pres = [target(), target()];
  const div = target();
  const cell = new THREE.Vector2(), size = new THREE.Vector2();
  const uniforms = {
    uVelocity: { value: vel[0].texture }, uWater: { value: liquid[0].texture },
    uPressure: { value: pres[0].texture }, uDivergence: { value: div.texture },
    uCell: { value: cell }, uSize: { value: size }, uPointer: { value: new THREE.Vector4() },
    uDt: { value: FLUID_DT }, uTime: { value: 0 }, uFlow: { value: 1 },
  };
  const material = (body: string) => new THREE.ShaderMaterial({
    uniforms, vertexShader: vertex, fragmentShader: header + body, depthTest: false, depthWrite: false,
  });
  const initialize = material(`void main(){
    float halfWidth=min(.19*uSize.x,.235);
    float mask=(1.-smoothstep(halfWidth-.012,halfWidth,abs((vUv.x-.5)*uSize.x)))*step(.16,vUv.y)*step(vUv.y,.852);
    float pool=step(.105,vUv.y)*step(vUv.y,.15);
    float age=(sqrt(.012+1.08*max(0.,.84-vUv.y))-.11)/.54;
    gl_FragColor=vec4(max(mask,pool),pool*.12,max(0.,age)*mask,1.);
  }`);
  const initializeVelocity = material(`void main(){
    gl_FragColor=vec4(0.,wet(vUv)&&vUv.y>.16?-sqrt(.012+1.08*max(0.,.84-vUv.y)):0.,0.,1.);
  }`);
  const advectVelocity = material(`void main(){
    vec2 p=vUv;
    vec2 v=vec2(texture2D(uVelocity,trace(p,velocity(p+X()*.5))).x,
                texture2D(uVelocity,trace(p,velocity(p+Y()*.5))).y);
    if(wet(p)||wet(p+Y()))v.y-=.54*uDt;
    if(uPointer.w>1.5){
      vec2 d=p*uSize-uPointer.xy;float r=length(d);
      float force=1.-smoothstep(uPointer.z,uPointer.z*2.7,r);
      v+=d/max(r,.002)*force*uDt*2.5*(uPointer.w>2.5?-1.:1.);
    }
    v*=exp(-.045*uDt);
    v*=exp(-3.*uDt*(1.-smoothstep(.15,.21,p.y)));
    float s=source(p);v=mix(v,vec2(0.,-.13-.035*uFlow),s);
    if(solid(p)||solid(p+X()))v.x=0.;
    if(solid(p)||solid(p+Y()))v.y=0.;
    gl_FragColor=vec4(clamp(v,vec2(-1.8),vec2(1.8)),0.,1.);
  }`);
  const divergence = material(`void main(){
    vec2 v=texture2D(uVelocity,vUv).xy;
    float left=texture2D(uVelocity,vUv-X()).x,bottom=texture2D(uVelocity,vUv-Y()).y;
    float d=wet(vUv)?v.x-left+v.y-bottom:0.;
    gl_FragColor=vec4(d,0.,0.,1.);
  }`);
  const jacobi = material(`void main(){
    float c=texture2D(uPressure,vUv).r;
    float sum=pressure(vUv-X(),c)+pressure(vUv+X(),c)+pressure(vUv-Y(),c)+pressure(vUv+Y(),c);
    float p=wet(vUv)?(sum-texture2D(uDivergence,vUv).r)*.25:0.;
    gl_FragColor=vec4(p,0.,0.,1.);
  }`);
  const project = material(`void main(){
    float c=pressure(vUv,0.);
    vec2 v=texture2D(uVelocity,vUv).xy;
    v-=vec2(pressure(vUv+X(),c)-c,pressure(vUv+Y(),c)-c);
    if(solid(vUv)||solid(vUv+X()))v.x=0.;
    if(solid(vUv)||solid(vUv+Y()))v.y=0.;
    gl_FragColor=vec4(v,0.,1.);
  }`);
  const advectWater = material(`void main(){
    vec2 v=velocity(vUv),back=trace(vUv,v);
    vec3 d=texture2D(uWater,back).rgb;
    // Advected material age gives the optical shader a coordinate attached to the flow.
    d.b+=uDt*step(.035,d.r);
    // Air entrainment follows shear and impact, then travels with the water.
    vec2 dv=velocity(vUv+X())-velocity(vUv-X());
    float impact=smoothstep(.08,.45,-v.y)*(1.-smoothstep(.155,.205,vUv.y));
    float shear=smoothstep(.025,.17,length(dv));
    d.g=d.g*exp(-.85*uDt)+(impact*3.+shear*.6)*uDt*d.r;
    float inlet=source(vUv);
    d.r=max(d.r,inlet);d.b*=1.-inlet;
    // The photographed basin drains away from this 2D slice, into depth.
    d.rg*=exp(-uDt*2.*(1.-smoothstep(.13,.18,vUv.y)));
    if(vUv.y>.86)d=vec3(0.);
    // Open lateral drains prevent a continuously fed basin from filling the screen.
    d.rg*=1.-smoothstep(.46,.5,abs(vUv.x-.5))*step(vUv.y,.17)*.2;
    if(solid(vUv))d=vec3(0.);
    gl_FragColor=vec4(clamp(d.rg,0.,1.),clamp(d.b,0.,16.),1.);
  }`);
  let width = 1, height = 1, remainder = 0, time = 0;
  function run(m: THREE.ShaderMaterial, out: THREE.WebGLRenderTarget) {
    uniforms.uVelocity.value = vel[0].texture; uniforms.uWater.value = liquid[0].texture;
    uniforms.uPressure.value = pres[0].texture;
    quad.material = m; renderer.setRenderTarget(out); renderer.render(scene, camera);
  }
  function reset() {
    remainder = 0; time = 0; uniforms.uPointer.value.set(0, 0, 0, 0);
    renderer.setClearColor(0, 0);
    for (const t of [...vel, ...liquid, ...pres, div]) { renderer.setRenderTarget(t); renderer.clear(); }
    run(initialize, liquid[0]); run(initializeVelocity, vel[0]);
  }
  return {
    get texture() { return liquid[0].texture; },
    get velocityTexture() { return vel[0].texture; },
    get texel() { return cell; },
    resize(aspect: number) {
      ({ width, height } = fluidGrid(aspect)); size.set(aspect, 1); cell.set(1 / width, 1 / height);
      for (const t of [...vel, ...liquid, ...pres, div]) t.setSize(width, height);
      reset();
    }, reset,
    advance(elapsed: number, pointer: WaterPointer, flow: number, worldHeight: number) {
      const tick = fluidSteps(remainder, elapsed); remainder = tick.remainder;
      uniforms.uPointer.value.set(pointer.x / worldHeight, 1 - pointer.y / worldHeight,
        pointer.radius / worldHeight, pointer.active ? (pointer.tool === 'barrier' ? 1 : pointer.tool === 'push' ? 2 : 3) : 0);
      uniforms.uFlow.value = flow;
      for (let i = 0; i < tick.steps; i++) {
        time += FLUID_DT; uniforms.uTime.value = time;
        run(advectVelocity, vel[1]); vel.reverse();
        run(divergence, div);
        // Warm-start the pressure instead of clearing it every step.
        for (let j = 0; j < PRESSURE_ITERATIONS; j++) { run(jacobi, pres[1]); pres.reverse(); }
        run(project, vel[1]); vel.reverse();
        run(advectWater, liquid[1]); liquid.reverse();
      }
    },
    inspect() {
      const data = new Uint16Array(width * height * 4), speed = new Uint16Array(data.length);
      const before = new Uint16Array(data.length);
      renderer.readRenderTargetPixels(liquid[0], 0, 0, width, height, data);
      renderer.readRenderTargetPixels(vel[0], 0, 0, width, height, speed);
      renderer.readRenderTargetPixels(div, 0, 0, width, height, before);
      let mass = 0, maximumSpeed = 0, finite = true, hash = 2166136261;
      let beforeSquare = 0, afterSquare = 0, samples = 0, obstacleMass = 0;
      for (let i = 0; i < data.length; i += 4) {
        const d = THREE.DataUtils.fromHalfFloat(data[i]);
        const x = THREE.DataUtils.fromHalfFloat(speed[i]), y = THREE.DataUtils.fromHalfFloat(speed[i + 1]);
        finite &&= Number.isFinite(d + x + y); mass += d; maximumSpeed = Math.max(maximumSpeed, Math.hypot(x, y));
        hash = Math.imul(hash ^ data[i], 16777619);
        const cx = (i / 4) % width, cy = Math.floor(i / 4 / width);
        const ptr = uniforms.uPointer.value;
        if (ptr.w === 1 && Math.hypot((cx + .5) / width * size.x - ptr.x, (cy + .5) / height - ptr.y) < ptr.z) obstacleMass += d;
        if (cx > 0 && cy > 0 && d > .1) {
          const pre = THREE.DataUtils.fromHalfFloat(before[i]);
          const post = x - THREE.DataUtils.fromHalfFloat(speed[i - 4]) + y - THREE.DataUtils.fromHalfFloat(speed[i - width * 4 + 1]);
          beforeSquare += pre * pre; afterSquare += post * post; samples++;
        }
      }
      return { width, height, cells: width * height, mass, maximumSpeed, finite, hash: hash >>> 0, time, obstacleMass,
        divergenceBefore: Math.sqrt(beforeSquare / Math.max(1, samples)), divergenceAfter: Math.sqrt(afterSquare / Math.max(1, samples)) };
    },
    dispose() {
      for (const t of [...vel, ...liquid, ...pres, div]) t.dispose();
      for (const m of [initialize, initializeVelocity, advectVelocity, divergence, jacobi, project, advectWater]) m.dispose();
      quad.geometry.dispose();
    },
  };
}
