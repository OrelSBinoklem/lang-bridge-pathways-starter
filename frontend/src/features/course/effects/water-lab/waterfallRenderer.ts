import * as THREE from 'three';
import type { WaterPointer } from './waterfallSimulation';
import { createWaterfallFluid } from './waterfallFluid';

const vertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const noise = `
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){return noise(p)*.57+noise(p*2.03+7.)*.28+noise(p*4.1+17.)*.15;}
`;

/** Grid-driven refraction and foam; simulation resolution is independent of the display. */
export async function createWaterfallRenderer(signal: AbortSignal, canvas: HTMLCanvasElement) {
  const backdrop = await new THREE.TextureLoader().loadAsync('/course/effects/waterfall-rock-v1.webp');
  if (signal.aborted) { backdrop.dispose(); signal.throwIfAborted(); }
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: false, powerPreference: 'low-power' }); }
  catch (error) { backdrop.dispose(); throw error; }
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.autoClear = false;
  const camera = new THREE.Camera();
  const fullScene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  fullScene.add(quad);
  const fluid = createWaterfallFluid(renderer);
  const world = new THREE.Vector2(1000, 850), texel = new THREE.Vector2(1, 1);
  // A fixed, GPU-only impact spray: no per-frame particle allocation or CPU uploads.
  const sprayScene = new THREE.Scene();
  const sprayGeometry = new THREE.BufferGeometry();
  const seeds = new Float32Array(192 * 3);
  for (let i = 0; i < 192; i++) {
    seeds[i * 3] = (i + .5) / 192;
    seeds[i * 3 + 1] = ((i * 73) % 193) / 193;
    seeds[i * 3 + 2] = ((i * 113) % 197) / 197;
  }
  sprayGeometry.setAttribute('position', new THREE.BufferAttribute(seeds, 3));
  const sprayMaterial = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    uniforms: {
      uWater: { value: fluid.texture }, uVelocity: { value: fluid.velocityTexture },
      uWorld: { value: world }, uTime: { value: 0 }, uScale: { value: 1 },
      uPointer: { value: new THREE.Vector4() },
    },
    vertexShader: `
uniform sampler2D uWater,uVelocity;uniform vec2 uWorld;uniform float uTime,uScale;uniform vec4 uPointer;
varying float vAlpha;
void main(){
  float spread=min(uWorld.x*.38,uWorld.y*.28);
  float x=.5+(position.x-.5)*2.*spread/uWorld.x;
  vec2 hit=vec2(x,.24);
  float amount=texture2D(uWater,hit).r;
  vec2 flow=texture2D(uVelocity,hit).xy;
  float lift=95.+position.z*155.;
  float life=2.*lift/720.;
  float age=mod(uTime+position.y*2.,life+.18+position.z*.45);
  float side=(position.y-.5)*220.+flow.x*180.;
  vec2 p=vec2(x*uWorld.x+side*age,.842*uWorld.y-lift*age+360.*age*age);
  vAlpha=smoothstep(.025,.28,amount)*smoothstep(.025,.18,-flow.y);
  vAlpha*=step(age,life)*(1.-smoothstep(life*.72,life,age));
  if(uPointer.w>.5)vAlpha*=smoothstep(uPointer.z,uPointer.z+3.,length(p-uPointer.xy));
  gl_Position=vec4(p.x/uWorld.x*2.-1.,1.-p.y/uWorld.y*2.,0.,1.);
  gl_PointSize=max(1.5,(2.2+position.z*2.8)*uScale);
}`,
    fragmentShader: `varying float vAlpha;
void main(){
  vec2 p=gl_PointCoord*2.-1.;float r=dot(p,p);
  if(r>1.||vAlpha<.01)discard;
  float edge=1.-smoothstep(.4,1.,r);
  float light=.65+.35*(1.-smoothstep(0.,.7,length(p-vec2(-.25,.3))));
  gl_FragColor=vec4(vec3(.84,.94,.98)*light,edge*vAlpha*.9);
}`,
  });
  const spray = new THREE.Points(sprayGeometry, sprayMaterial); spray.frustumCulled = false; sprayScene.add(spray);
  const composite = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, uniforms: {
      uDensity: { value: fluid.texture }, uVelocity: { value: fluid.velocityTexture }, uBackdrop: { value: backdrop }, uWorld: { value: world },
      uTexel: { value: texel }, uTime: { value: 0 }, uCrop: { value: 1 },
      uPointer: { value: new THREE.Vector4(-1000, -1000, 0, 0) },
    }, vertexShader: vertex,
    fragmentShader: `
uniform sampler2D uDensity,uVelocity,uBackdrop;uniform vec2 uWorld,uTexel;uniform float uTime,uCrop;uniform vec4 uPointer;
varying vec2 vUv;
${noise}
vec3 background(vec2 uv){
  float y=1.-uv.y;
  y=y<.84?y*.80/.84:.80+(y-.84)*.20/.16;
  return texture2D(uBackdrop,vec2(clamp(.5+(uv.x-.5)*uCrop,.001,.999),clamp(1.-y,.001,.999))).rgb;
}
void main(){
  vec2 uv=vUv;vec2 p=vec2(uv.x,1.-uv.y)*uWorld;
  float fall=clamp((p.y/uWorld.y-.16)/.68,0.,1.);
  vec3 field=texture2D(uDensity,uv).rgb;
  float thick=field.r;
  vec2 gradient=vec2(texture2D(uDensity,uv+vec2(uTexel.x,0)).r-texture2D(uDensity,uv-vec2(uTexel.x,0)).r,
                     texture2D(uDensity,uv+vec2(0,uTexel.y)).r-texture2D(uDensity,uv-vec2(0,uTexel.y)).r);
  vec2 flow=texture2D(uVelocity,uv).xy;
  vec2 q=vec2(p.x*.105+flow.x*6.,(field.b-uTime)*4.);
  // Narrow longitudinal folds: clear water between reflective ridges, not a fog layer.
  vec2 strand=vec2(p.x*.15+flow.x*5.,q.y*.24);
  float fold=noise(strand);
  float ridge=smoothstep(.52,.78,fold);
  float fine=smoothstep(.66,.85,noise(strand*vec2(2.7,2.1)+11.));
  float breakup=smoothstep(.24,.69,noise(vec2(strand.x*.7,q.y*2.3)));
  vec2 micro=vec2((noise(strand+vec2(.15,0))-fold)*3.,noise(q*vec2(.3,1.8))*.13-.065);
  vec3 N=normalize(vec3(-gradient*.9+micro*vec2(1.2,.4),1.));
  vec2 bend=N.xy*vec2(.009,.003)*clamp(thick,0.,1.4);
  vec3 behind=background(uv);
  // The pool itself refracts the photographed bed, with a low-amplitude moving surface.
  if(p.y>uWorld.y*.84){
    vec2 poolQ=vec2(p.x*.016,p.y*.065-uTime*.5);
    float r=fbm(poolQ);
    behind=background(uv+vec2(sin(p.y*.15+uTime*2.),r-.5)*vec2(.0008,.002));
    behind+=vec3(.08,.10,.09)*pow(max(0.,r-.38)*1.7,5.);
  }
  vec3 refracted=background(uv+bend);
  vec3 reflection=mix(vec3(.16,.23,.19),vec3(.84,.89,.88),smoothstep(-.45,.7,N.y+N.x*.35));
  float fresnel=.025+.7*pow(1.-max(N.z,0.),5.);
  float glint=pow(max(dot(N,normalize(vec3(-.35,.5,1.))),0.),65.);
  vec3 water=mix(refracted*vec3(.83,.92,.92),reflection,.07+fresnel*.7);
  float fallingSpeed=smoothstep(.04,.32,-flow.y);
  water+=vec3(.8,.9,.96)*(ridge*breakup*.7+fine*.18+glint*.18)*fallingSpeed;
  float broken=smoothstep(.45,1.,fall)*ridge*breakup*.24;
  water=mix(water,vec3(.88,.95,.98),broken);
  float coverage=smoothstep(.10,.68,thick);
  float fallingMask=1.-smoothstep(.835,.865,p.y/uWorld.y);
  coverage*=fallingMask;
  // Keep the hand-shaped hole open, instead of letting density blur bridge the obstacle.
  float cursorDistance=length(p-uPointer.xy);
  if(uPointer.w>.5)coverage*=smoothstep(uPointer.z-1.,uPointer.z+3.,cursorDistance);
  coverage*=smoothstep(uWorld.y*.16-2.,uWorld.y*.16+3.,p.y);
  vec3 color=mix(behind,water,coverage);
  float foam=(1.-exp(-field.g*2.8))*smoothstep(.08,.65,thick);
  float bubbles=smoothstep(.44,.72,noise(p*vec2(.8,.55)+vec2(flow.x,-flow.y)*uTime*.35));
  foam*=mix(.48,.18,fallingMask)*bubbles;
  color=mix(color,vec3(.88,.94,.95),clamp(foam,0.,.75));
  if(abs(p.y/uWorld.y-.842)<.024){
    vec2 hit=vec2(uv.x,.24);
    float impact=smoothstep(.025,.28,texture2D(uDensity,hit).r)*smoothstep(.025,.18,-texture2D(uVelocity,hit).y);
    float crown=exp(-abs(p.y-uWorld.y*.842)*.17);
    float flecks=smoothstep(.44,.72,noise(vec2(p.x*.7,p.y*.8-uTime*11.)));
    color=mix(color,vec3(.88,.95,.97),impact*crown*flecks*.75);
  }
  // Thin tool outline, no luminous orb or painted disk hiding the liquid.
  if(uPointer.z>0.){
    float line=1.-smoothstep(.6,1.7,abs(cursorDistance-uPointer.z));
    color=mix(color,vec3(.93,.93,.82),line*.55);
  }
  gl_FragColor=vec4(color,1.);
}`,
  });
  function pass(material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    quad.material = material; renderer.setRenderTarget(target); renderer.render(fullScene, camera);
  }
  return {
    canvas: renderer.domElement,
    resize(pixelWidth: number, pixelHeight: number, width: number, height: number) {
      renderer.setSize(pixelWidth, pixelHeight, false); world.set(width, height);
      fluid.resize(width / height); texel.copy(fluid.texel);
      sprayMaterial.uniforms.uScale.value = pixelHeight / height;
      composite.uniforms.uCrop.value = Math.min(1, width / height / (1672 / 941));
    },
    advance(dt: number, pointer: WaterPointer, flow: number) { fluid.advance(dt, pointer, flow, world.y); },
    reset() { fluid.reset(); },
    inspect() { return fluid.inspect(); },
    render(time: number, pointer: WaterPointer) {
      composite.uniforms.uDensity.value = fluid.texture;
      composite.uniforms.uVelocity.value = fluid.velocityTexture;
      composite.uniforms.uTime.value = time;
      composite.uniforms.uPointer.value.set(pointer.x, pointer.y, pointer.active ? pointer.radius : 0, pointer.active && pointer.tool === 'barrier' ? 1 : 0);
      pass(composite, null);
      sprayMaterial.uniforms.uWater.value = fluid.texture;
      sprayMaterial.uniforms.uVelocity.value = fluid.velocityTexture;
      sprayMaterial.uniforms.uTime.value = time;
      sprayMaterial.uniforms.uPointer.value.copy(composite.uniforms.uPointer.value);
      renderer.render(sprayScene, camera);
    },
    dispose() {
      backdrop.dispose(); fluid.dispose(); composite.dispose(); quad.geometry.dispose();
      sprayGeometry.dispose(); sprayMaterial.dispose();
      renderer.dispose();
    },
  };
}

export type WaterfallRenderer = Awaited<ReturnType<typeof createWaterfallRenderer>>;
