import { T, type World } from './world';
import { group } from './storyKit';

/** Soft advected puffs, not eight coincident opaque-looking vertical sheets. */
export function teaSteam(w: World, parent: T.Object3D) {
  const steam = group(parent, 0, .17, 0); steam.name = 'train-tea-steam';
  steam.userData.technique = 'advected-billboard-volume';
  const geometry = new T.PlaneGeometry(1, 1);
  const seeds = new Float32Array(28 * 4);
  for (let i = 0; i < 28; i++) seeds.set([i / 28, w.c.rand() * 6.28, w.c.rand(), w.c.rand()], i * 4);
  geometry.setAttribute('steamSeed', new T.InstancedBufferAttribute(seeds, 4));
  const material = new T.ShaderMaterial({
    transparent: true, depthWrite: false, side: T.DoubleSide,
    uniforms: { time: { value: 0 } },
    vertexShader: `
      attribute vec4 steamSeed; uniform float time;
      varying vec2 q; varying float life; varying float seed;
      void main(){
        q=uv; seed=steamSeed.y; life=fract(time*.155+steamSeed.x);
        float rise=pow(life,.88), spread=.012+rise*.067;
        vec3 base=(modelMatrix*vec4(0.,0.,0.,1.)).xyz;
        // Gravity stays vertical even while the passenger tilts the glass.
        vec3 center=base+vec3(
          sin(life*9.+time*.47+seed)*spread+sin(time*.7+life*5.)*rise*.025,
          rise*.56,
          cos(life*7.+seed)*spread*.63);
        float size=(.025+rise*.12)*(.7+steamSeed.z*.6);
        float a=sin(time*.24+seed)*.6, c=cos(a), s=sin(a);
        vec2 p=mat2(c,-s,s,c)*position.xy*vec2(size,size*1.45);
        vec4 view=viewMatrix*vec4(center,1.);
        view.xy+=p; gl_Position=projectionMatrix*view;
      }`,
    fragmentShader: `
      varying vec2 q; varying float life; varying float seed; uniform float time;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
      float fbm(vec2 p){return noise(p)*.57+noise(p*2.13)*.28+noise(p*4.3)*.15;}
      void main(){
        vec2 p=q-.5;
        vec2 warp=vec2(fbm(p*5.+seed+time*.12),fbm(p*5.-seed-time*.09))-.5;
        float n=fbm(p*8.+warp*2.+vec2(seed,-time*.2));
        float soft=exp(-dot(p,p)*17.)*(1.-smoothstep(.22,.5,length(p)));
        float envelope=smoothstep(0.,.13,life)*(1.-smoothstep(.38,1.,life));
        float density=smoothstep(.23,.73,n)*soft*envelope*.082;
        gl_FragColor=vec4(vec3(.8,.84,.87),density);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const puffs = new T.InstancedMesh(geometry, material, 28);
  const matrix = new T.Matrix4();
  for (let i = 0; i < 28; i++) puffs.setMatrixAt(i, matrix);
  puffs.frustumCulled = false; puffs.castShadow = false; puffs.receiveShadow = false;
  puffs.raycast = () => {}; // Picking must hit the glass, not the shader's undeformed source quad.
  puffs.name = 'train-steam-puffs'; steam.add(puffs);
  return { steam, steamMaterial: material };
}
