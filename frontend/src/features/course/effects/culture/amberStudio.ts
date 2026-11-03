import * as T from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { PointerState } from '../engine';
import type { AmberParams } from './params';
import { AMBER_WORDS, pick } from './words';
import { amberGeometry, amberLayout, amberSettings, amberWordPosition, amberRindGeometry, createAmberMotion, stepAmberMotion } from './amberModel';

type Options = { canvas: HTMLCanvasElement; overlay: HTMLCanvasElement; width: number; height: number; params: AmberParams; uk: boolean };

/** Real meshes and raster transmission. No old texture arrays, raw GL shader or full-page resin slab. */
export async function createAmberStudio(o: Options) {
  const context=o.overlay.getContext('2d');
  if(!context)throw new Error('Amber caption canvas is unavailable.');
  const overlay=context;
  const renderer = new T.WebGLRenderer({ canvas: o.canvas, alpha: false, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  const scene = new T.Scene(); scene.background = new T.Color('#101e1d');
  const camera = new T.PerspectiveCamera(38, o.width / o.height, .05, 100);
  const maps = new Set<T.Texture>();
  const own = <M extends T.Texture>(map: M) => { maps.add(map); return map; };
  const room = new RoomEnvironment(), pmrem = new T.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, .025); room.dispose(); pmrem.dispose();
  scene.environment = environment.texture; scene.environmentIntensity = .55;
  scene.add(new T.HemisphereLight('#ecf0df', '#1c2c24', 1.3));
  const key = new T.DirectionalLight('#fff2cd', 1.8); key.position.set(-3, 5, 6); scene.add(key);
  const back = new T.PointLight('#ffa627', 22, 15, 2); back.position.set(-1, 1.5, -3); scene.add(back);
  const lamp = new T.PointLight('#fff4d3', 22, 14, 2); lamp.position.set(0, 2.5, 4); scene.add(lamp);
  const collection = new T.Group(); scene.add(collection);
  const main = new T.Group(), gems = [main, new T.Group(), new T.Group(), new T.Group()]; gems.forEach(g => collection.add(g));
  const meshes: T.Mesh[] = [], materials: T.MeshPhysicalMaterial[] = [];
  let seed = 180022;
  const rand = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
  const surface = document.createElement('canvas'); surface.width = surface.height = 512;
  const sg = surface.getContext('2d')!, pixels = sg.createImageData(512, 512);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const n = rand(), patch = Math.sin(x * .024 + Math.sin(y * .019) * 2) * Math.sin(y * .017);
    const i = (y * 512 + x) * 4, value = 155 + patch * 32 + n * 20;
    pixels.data.set([value, value, value, 255], i);
  }
  sg.putImageData(pixels, 0, 0);
  const grain = own(new T.CanvasTexture(surface)); grain.wrapS = grain.wrapT = T.RepeatWrapping;
  const rindMaterial=new T.MeshStandardMaterial({color:'#714624',roughness:.96,bumpMap:grain,bumpScale:.06});
  for (let i = 0; i < gems.length; i++) {
    const material = new T.MeshPhysicalMaterial({
      color: '#fff4d7', metalness: 0, roughness: .18,
      transmission: .96, thickness: 1.35, ior: 1.54,
      attenuationColor: i === 1 ? '#b95710' : '#d68a20', attenuationDistance: 1.4,
      clearcoat: .8, clearcoatRoughness: .18, bumpMap: grain, bumpScale: .012,
      roughnessMap: grain, transparent: true, opacity: 1,
    });
    const mesh = new T.Mesh(amberGeometry(i * 2.7 + 1.4), material);
    mesh.name = 'amber-nugget'; gems[i].name = `amber-stone-${i}`; gems[i].add(mesh); meshes.push(mesh); materials.push(material);
    const rind=new T.Mesh(amberRindGeometry(mesh.geometry),rindMaterial);rind.name='amber-weathered-back';gems[i].add(rind);
    // A warm, spatially varying scattering lobe behind the inclusions. This
    // raster proxy prevents black transmission from turning honey resin olive.
    const core=new T.Mesh(new T.SphereGeometry(1,48,32),new T.ShaderMaterial({
      vertexShader:'varying vec3 q;void main(){q=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec3 q;void main(){
        float flow=sin(q.x*7.+sin(q.y*5.)*2.+q.z*4.)*.5+.5;
        float cloud=pow(max(0.,1.-length(q.xy)*.8),2.);
        vec3 c=mix(vec3(.36,.115,.012),vec3(.88,.47,.075),cloud*.7+flow*.15);
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    }));core.position.z=-.42;core.scale.set(.86,.85,.16);core.name='amber-scattering-core';gems[i].add(core);
  }
  const dark = new T.MeshStandardMaterial({ color: '#67320d', roughness: .67, metalness: .05 });
  const honey = new T.MeshStandardMaterial({ color: '#925b1c', roughness: .48, metalness: .08 });
  const bubbles = new T.InstancedMesh(new T.SphereGeometry(1, 14, 10), honey, 90);
  const dummy = new T.Object3D();
  for (let i = 0; i < 90; i++) {
    let q: T.Vector3;
    do { q = new T.Vector3(rand() * 1.6 - .8, rand() * 1.6 - .8, rand() * .9 - .45); } while (q.length() > .8);
    const r = .008 + rand() ** 3 * .043;
    dummy.position.copy(q); dummy.scale.set(r, r * (.7 + rand() * .6), r); dummy.updateMatrix(); bubbles.setMatrixAt(i, dummy.matrix);
  }
  main.add(bubbles);
  const plant = new T.Group(); plant.name = 'amber-botanical-inclusion'; main.add(plant); plant.position.set(-.12, -.16, -.05); plant.rotation.z = -.4;
  const stem = new T.CatmullRomCurve3([new T.Vector3(-.34, -.42, 0), new T.Vector3(-.08, -.14, .03), new T.Vector3(.11, .24, 0), new T.Vector3(.25, .5, -.04)]);
  plant.add(new T.Mesh(new T.TubeGeometry(stem, 32, .004, 6), dark));
  for (let i = 1; i < 12; i++) for (const sign of [-1, 1]) {
    const q = stem.getPoint(i / 13), length = Math.sin(i / 13 * Math.PI) * .16;
    const tip = q.clone().add(new T.Vector3(sign * length, .07, 0));
    plant.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([q, q.clone().lerp(tip,.6).add(new T.Vector3(0,.015,0)),tip]), 10, .0022, 5), dark));
    for (let j = 1; j < 6; j++) {
      const p = q.clone().lerp(tip,j/6);
      const leaf = new T.Mesh(new T.SphereGeometry(1, 8, 6), dark); leaf.position.copy(p); leaf.scale.set(.025, .006, .0015); leaf.rotation.z = sign * .6; plant.add(leaf);
    }
  }
  // A tiny winged seed is an actual spatial inclusion, not a word-texture channel.
  const seedPod = new T.Group(); seedPod.name = 'amber-winged-seed'; main.add(seedPod); seedPod.position.set(.48,.2,-.12); seedPod.rotation.z = .7;
  const pod = new T.Mesh(new T.CapsuleGeometry(.018,.075,4,10), dark); seedPod.add(pod);
  for (const sign of [-1,1]) {
    const wing = new T.Mesh(new T.SphereGeometry(1,16,10), honey); wing.position.set(sign*.055,.025,0); wing.scale.set(.05,.13,.002); wing.rotation.z = sign * -.45; seedPod.add(wing);
    for (let i=0;i<4;i++) { const line = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(0,0,.003),new T.Vector3(sign*(.03+i*.012),.09-i*.024,.003)]),new T.LineBasicMaterial({color:'#694414'})); seedPod.add(line); }
  }
  const words: T.Mesh<T.PlaneGeometry,T.MeshBasicMaterial>[] = [];
  for (let i = 0; i < AMBER_WORDS.length; i++) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 112;
    const g = canvas.getContext('2d')!; g.font = 'italic 52px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
    g.fillText(AMBER_WORDS[i].lv,256,56,480);
    const texture = own(new T.CanvasTexture(canvas)); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = Math.min(4,renderer.capabilities.getMaxAnisotropy());
    const material = new T.MeshBasicMaterial({map:texture,color:'#512908',alphaTest:.3,side:T.DoubleSide});
    const mesh = new T.Mesh(new T.PlaneGeometry(.66,.145),material); mesh.position.copy(amberWordPosition(i)); mesh.rotation.z = Math.sin(i*2)*.08; mesh.name = `amber-word-${i}`;
    main.add(mesh); words.push(mesh);
  }
  // One baked radial caustic behind each piece. No screen-space reflection or ray tracing.
  const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 256;
  const gg = glowCanvas.getContext('2d')!, gradient = gg.createRadialGradient(128,128,4,128,128,125);
  gradient.addColorStop(0,'rgba(249,150,32,.21)'); gradient.addColorStop(.35,'rgba(211,122,21,.12)'); gradient.addColorStop(1,'rgba(211,122,21,0)');
  gg.fillStyle = gradient; gg.fillRect(0,0,256,256);
  const glowMap = own(new T.CanvasTexture(glowCanvas));
  const halos = gems.map(() => { const material = new T.MeshBasicMaterial({map:glowMap,transparent:true,depthWrite:false}); const mesh = new T.Mesh(new T.PlaneGeometry(6,5),material); mesh.position.z = -1.8; collection.add(mesh); return mesh; });
  const grainBackdrop = new T.Mesh(new T.PlaneGeometry(200,200),new T.ShaderMaterial({
    depthWrite:false,
    vertexShader:'varying vec2 q;void main(){q=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec2 q;void main(){float n=fract(sin(dot(floor(q*20000.),vec2(12.9898,78.233)))*43758.5453);gl_FragColor=vec4(vec3(.032,.063,.058)+n*.009,1.);}',
  })); grainBackdrop.position.z=-5; scene.add(grainBackdrop);
  const motion = createAmberMotion();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const projected = new T.Vector3(), ndc = new T.Vector2(), ray = new T.Raycaster();
  const viewPlane = new T.Plane(new T.Vector3(0,0,1),-2), lightTarget = new T.Vector3(), restLamp=new T.Vector3(-1,2.5,4);
  let width=o.width, height=o.height, ratio=1, quality=-1, layout=amberLayout(width,height), selected=0, hovered=-1, pinnedUntil=0, last=0, lost=false, disposed=false;
  const onLost = (event: Event) => { event.preventDefault(); lost=true; };
  const onRestored = () => { lost=false; last=0; };
  o.canvas.addEventListener('webglcontextlost',onLost); o.canvas.addEventListener('webglcontextrestored',onRestored);
  function resize(w:number,h:number) {
    width=Math.max(1,w);height=Math.max(1,h);layout=amberLayout(width,height);
    camera.aspect=width/height;camera.position.set(0,.35,layout.distance);camera.lookAt(0,0,0);camera.updateProjectionMatrix();
    main.position.copy(layout.main);main.scale.copy(layout.scale);
    for(let i=1;i<gems.length;i++) {gems[i].position.set(...layout.satellites[i-1] as [number,number,number]);gems[i].scale.set(.58+i*.1,.48+i*.12,.45);gems[i].rotation.set(.2*i,-.45*i,.3*i);}
    gems.forEach((g,i)=>{halos[i].position.x=g.position.x;halos[i].position.y=g.position.y-.25;halos[i].scale.setScalar(i? .45:1);});
    quality=-1;
  }
  resize(width,height);
  function caption(wordIndex:number) {
    const word=AMBER_WORDS[wordIndex], text=`${word.lv} — ${pick(word,o.uk)}`;
    overlay.setTransform(ratio,0,0,ratio,0,0);overlay.clearRect(0,0,width,height);
    const compact=height<300, font=compact?12:Math.min(22,width/24);
    overlay.font=`500 ${font}px Georgia,serif`; const size=Math.min(width-24,overlay.measureText(text).width+32), x=(width-size)/2, y=height-(compact?31:layout.mode==='tall'?160:76);
    overlay.fillStyle='rgba(8,22,20,.82)';overlay.beginPath();overlay.roundRect(x,y,size,font+18,10);overlay.fill();
    overlay.fillStyle='#f6d59c';overlay.textAlign='center';overlay.textBaseline='middle';overlay.fillText(text,width/2,y+(font+18)/2,size-16);
    if(!compact) {overlay.font=`${width<500?10:12}px system-ui,sans-serif`;overlay.fillStyle='#b7bfb2';overlay.fillText(o.uk?'Тягніть — обертання · дотик — наступне слово':'Тяните — вращение · нажатие — следующее слово',width/2,height-(layout.mode==='tall'?120:25),width-24);}
  }
  function frame(now:number,pointer:PointerState) {
    if(disposed||lost) return;
    const dt=last?Math.max(0,Math.min(.05,(now-last)/1000)):0;last=now;
    if(document.hidden) return;
    const p=amberSettings(o.params);stepAmberMotion(motion,dt,pointer,height,reduced.matches);
    const desired=Math.min(2,(devicePixelRatio||1)*p.quality,Math.sqrt(2_000_000/(width*height)));
    if(Math.abs(quality-desired)>.025) {quality=desired;ratio=Math.min(devicePixelRatio||1,2);renderer.setPixelRatio(quality);renderer.setSize(width,height,false);o.overlay.width=Math.round(width*ratio);o.overlay.height=Math.round(height*ratio);o.canvas.dataset.renderResolution=`${o.canvas.width}x${o.canvas.height}`;}
    main.rotation.set(motion.pitch+(pointer.active?pointer.y/height*.1*p.parallax:0),motion.yaw+(pointer.active?pointer.x/width*.08*p.parallax:0),Math.sin(motion.time*.22)*.018);
    main.position.y=layout.main.y+(reduced.matches?0:Math.sin(motion.time*.45)*.035);
    for(let i=1;i<gems.length;i++)gems[i].rotation.y=-.45*i+motion.yaw*.2;
    materials.forEach((m,i)=>{m.roughness=.12+p.cloud*.09;m.attenuationDistance=1.9/p.depth;m.thickness=(i? .7:1.35)*p.depth;m.emissive.set('#9c4205');m.emissiveIntensity=p.glow*.035+p.sss*.012;m.clearcoat=.35+p.sparkle*.25;});
    bubbles.count=Math.round(45*p.inclusions);plant.visible=seedPod.visible=p.inclusions>.15;
    words.forEach((word,i)=>{word.visible=i<p.words;word.material.color.set(i===selected?'#9c611b':'#512b0d');});
    if(selected>=p.words)selected=0;
    scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    hovered=-1;
    if(pointer.active) {
      const px=pointer.x+width/2,py=height/2-pointer.y;let closest=height<300?35:65;
      words.forEach((word,i)=>{if(!word.visible)return;word.getWorldPosition(projected).project(camera);const d=Math.hypot((projected.x+1)*width/2-px,(1-projected.y)*height/2-py);if(d<closest){closest=d;hovered=i;}});
      ndc.set(pointer.x/width*2,pointer.y/height*2);ray.setFromCamera(ndc,camera);
      if(ray.ray.intersectPlane(viewPlane,lightTarget))lamp.position.lerp(lightTarget,1-Math.exp(-dt*10));
      if(motion.click&&ray.intersectObjects(meshes).length){selected=hovered>=0&&hovered!==selected?hovered:(selected+1)%p.words;pinnedUntil=now+2200;}
    } else lamp.position.lerp(restLamp,Math.min(1,dt*2));
    lamp.intensity=8+p.glow*6;lamp.distance=9+p.lamp*3;
    renderer.render(scene,camera);caption(now<pinnedUntil?selected:hovered>=0?hovered:selected);
  }
  function dispose() {
    if(disposed)return;disposed=true;
    o.canvas.removeEventListener('webglcontextlost',onLost);o.canvas.removeEventListener('webglcontextrestored',onRestored);
    const geometries=new Set<T.BufferGeometry>(),mats=new Set<T.Material>();
    scene.traverse(obj=>{const mesh=obj as T.Mesh;if(mesh.geometry)geometries.add(mesh.geometry);if(mesh.material)(Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(m=>mats.add(m));if(obj instanceof T.InstancedMesh)obj.dispose();});
    geometries.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());maps.forEach(m=>m.dispose());environment.dispose();renderer.dispose();renderer.forceContextLoss();
  }
  try { await renderer.compileAsync(scene,camera); }
  catch(error) {dispose();throw error;}
  return {resize,frame,dispose};
}
