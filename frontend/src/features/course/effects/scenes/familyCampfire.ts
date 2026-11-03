import type { CanvasSceneDef, SceneCtx } from './types';
import { World, T, TAU, v } from './cinematic/world';
import { backdrop, bake, group } from './cinematic/storyKit';

/**
 * «Я, моя семья и друзья» — an evening at the campfire (owner, 2026-10-30: «придумай парочку крутых эффектов для
 * карточек»). A family and a friend sit round a fire in a forest clearing at night: the father toasting a marshmallow,
 * the mother under a blanket, the grandmother on a stump, a child on the grass, a friend with a guitar, the dog.
 *
 * The fire is real light: a warm point light (with soft shadows) flickering in the middle, so the figures have warm
 * faces and fronts, cool moonlit backs, and long shadows on the grass. The flame is a noise shader on three crossed
 * planes (additive, bloomed), with embers, rising sparks (cooling from yellow to red) and slow smoke. The cursor is the
 * wind: the flame and the sparks lean after it. A click throws a log on: the fire flares, a burst of sparks goes up,
 * the light swells and the child throws up its arms.
 *
 * Figures are stylised (capsules and spheres, like the other dioramas' figurines); everything static is baked.
 */

const FIRE_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FIRE_FRAG = /* glsl */ `
varying vec2 vUv;
uniform float uTime; uniform float uWind; uniform float uBoost; uniform float uSeed;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int k = 0; k < 5; k++) { s += a * n(p); p *= 2.03; a *= 0.5; } return s; }
void main() {
  float y = vUv.y;
  float t = uTime * (1.0 + 0.4 * uBoost);
  // The flame bends after the wind, more towards the tip.
  float x = vUv.x - 0.5 - uWind * y * y * 0.32;
  float big = fbm(vec2(x * 2.4 + uSeed, y * 1.8 - t * 1.3));
  float fine = fbm(vec2(x * 7.0 + uSeed * 3.0, y * 6.0 - t * 3.4));
  float tongues = 0.5 + 0.5 * sin(x * 19.0 + uSeed * 5.0 + big * 4.0);
  float width = mix(0.42, 0.02, pow(y, 0.62 + 0.5 * tongues)) * (0.8 + 0.5 * big);
  float body = 1.0 - smoothstep(width * 0.35, width, abs(x + (big - 0.5) * 0.22 * y));
  float heat = body * (1.0 - smoothstep(0.35, 1.0, y + (fine - 0.5) * 0.55)) * smoothstep(0.0, 0.07, y);
  heat = clamp(heat * (0.95 + 0.5 * uBoost), 0.0, 1.0);
  vec3 col = mix(vec3(0.55, 0.06, 0.01), vec3(1.0, 0.42, 0.06), smoothstep(0.08, 0.45, heat));
  col = mix(col, vec3(1.0, 0.8, 0.38), smoothstep(0.45, 0.8, heat));
  col = mix(col, vec3(1.0, 0.95, 0.75), smoothstep(0.9, 1.0, heat));
  gl_FragColor = vec4(col * heat * 1.45, 1.0);
}`;

/** A seated figure: a torso, a head with hair, thighs and shins, two arms on shoulder pivots. Faces +z. */
type Figure = { root: T.Group; torso: T.Group; head: T.Group; armL: T.Group; armR: T.Group; base: { l: number; r: number } };
function figure(w: World, parent: T.Object3D, o: {
  seat: number; scale: number; shirt: string; pants: string; skin: string; hair: string; ground?: boolean; long?: boolean; bun?: boolean;
}) {
  const root = group(parent);
  root.scale.setScalar(o.scale);
  const shirt = w.metal(o.shirt, 0, 0.88), pants = w.metal(o.pants, 0, 0.9), skin = w.metal(o.skin, 0, 0.62), hair = w.metal(o.hair, 0, 0.75);
  const cap = (r: number, l: number, m: T.Material, p: T.Object3D) => w.mesh(new T.CapsuleGeometry(r, l, 6, 14), m, p);
  const hip = o.seat;
  // Legs: thighs forward, shins down (or crossed on the ground).
  for (const s of [-1, 1]) {
    if (o.ground) {
      const thigh = cap(0.085, 0.34, pants, root);
      thigh.position.set(s * 0.15, hip + 0.04, 0.16);
      thigh.rotation.set(Math.PI / 2, 0, s * 0.9);
      const shin = cap(0.075, 0.32, pants, root);
      shin.position.set(-s * 0.04, hip + 0.03, 0.34);
      shin.rotation.set(Math.PI / 2, 0, -s * 1.25);
    } else {
      const thigh = cap(0.09, 0.34, pants, root);
      thigh.position.set(s * 0.11, hip + 0.02, 0.2);
      thigh.rotation.x = Math.PI / 2;
      const shin = cap(0.08, Math.max(0.1, hip - 0.12), pants, root);
      shin.position.set(s * 0.11, hip / 2, 0.42);
      const shoe = w.sphere(root, 0.09, [s * 0.11, 0.05, 0.47], w.metal('#2b2420', 0, 0.7));
      shoe.scale.set(1, 0.6, 1.5);
    }
  }
  const torso = group(root, 0, hip + 0.06, 0);
  torso.rotation.x = 0.16;
  const chest = cap(0.21, 0.42, shirt, torso);
  chest.position.y = 0.38;
  chest.scale.z = 0.82;
  const head = group(torso, 0, 0.9, 0.04);
  w.sphere(head, 0.165, [0, 0, 0], skin).scale.set(0.95, 1.05, 1);
  const hairCap = w.mesh(new T.SphereGeometry(0.175, 24, 16, 0, TAU, 0, Math.PI * 0.55), hair, head);
  hairCap.position.set(0, 0.02, -0.02);
  hairCap.rotation.x = -0.35;
  if (o.long) {
    const back = cap(0.12, 0.28, hair, head);
    back.position.set(0, -0.2, -0.1);
  }
  if (o.bun) w.sphere(head, 0.08, [0, 0.13, -0.15], hair);
  w.sphere(head, 0.03, [0, -0.02, 0.165], skin);
  const arm = (s: number) => {
    const shoulder = group(torso, s * 0.25, 0.62, 0);
    const upper = cap(0.07, 0.24, shirt, shoulder);
    upper.position.y = -0.16;
    const elbow = group(shoulder, 0, -0.3, 0);
    const fore = cap(0.06, 0.22, shirt, elbow);
    fore.position.set(0, -0.02, 0.15);
    fore.rotation.x = Math.PI / 2;
    w.sphere(elbow, 0.065, [0, -0.02, 0.33], skin);
    return shoulder;
  };
  const armL = arm(-1), armR = arm(1);
  // Hands out towards the fire by default.
  armL.rotation.set(-0.55, 0, 0.12);
  armR.rotation.set(-0.55, 0, -0.12);
  return { root, torso, head, armL, armR, base: { l: -0.55, r: -0.55 } } as Figure;
}

function ringPlace(obj: T.Object3D, angle: number, radius: number, y = 0) {
  obj.position.set(Math.sin(angle) * radius, y, Math.cos(angle) * radius);
  obj.rotation.y = angle + Math.PI;
}

export const FAMILY_CAMPFIRE: CanvasSceneDef = {
  kind: 'canvas',
  id: 'family-campfire',
  label: 'Вечер у костра · семья и друзья, искры по клику',
  palettes: [['#07090f', '#ff9a4d', '#ffd27a', '#3b4f78']],
  defaultParams: { cinemaBloom: 0.6, cinemaCamera: 0.12 },
  create(c: SceneCtx) {
    const w = new World(c, '#ff9a4d', '#06070c');
    // A deep sky with a paler band at the horizon, so the pines stand out as silhouettes.
    backdrop(w, '#070b18', '#28344f');
    w.scene.fog = new T.FogExp2('#121827', 0.034);
    w.scene.environmentIntensity = 0.12;
    w.cameraMotion = 0.12;
    w.exposure = 1.05;
    const wide = c.width / c.height;
    w.eye.set(0, 3.4, 8.6);
    w.target.set(0, 0.7, 0);
    if (w.mobile) w.eye.set(0, 5, 13);
    if (!c.body && wide > 2.2) {
      w.eye.set(0, 2.5, 6.3);
      w.target.set(0, 0.85, 0);
      w.camera.setViewOffset(c.width, c.height, -c.width * 0.22, 0, c.width, c.height);
    }
    // Night: a dim blue sky light, the moon as a weak cool key, the accent rim low.
    w.scene.traverse((o) => {
      if (o instanceof T.HemisphereLight) { o.intensity = 0.32; o.color.set('#41558a'); o.groundColor.set('#120d0a'); }
      else if (o instanceof T.DirectionalLight) {
        if (o.castShadow) { o.color.set('#9db3e8'); o.intensity = 0.8; o.position.set(-9, 14, -6); }
        else o.intensity = 0.25;
      }
    });

    // ---- the ground: ash in the middle, trodden earth, then grass (a baked radial texture with noise).
    const groundCanvas = document.createElement('canvas');
    groundCanvas.width = groundCanvas.height = 1024;
    {
      const g = groundCanvas.getContext('2d')!;
      const grd = g.createRadialGradient(512, 512, 0, 512, 512, 512);
      grd.addColorStop(0, '#2a2522');
      grd.addColorStop(0.035, '#3d3530');
      grd.addColorStop(0.09, '#3a2c20');
      grd.addColorStop(0.16, '#2c3a1e');
      grd.addColorStop(1, '#131c10');
      g.fillStyle = grd;
      g.fillRect(0, 0, 1024, 1024);
      for (let k = 0; k < 26000; k += 1) {
        const a = c.rand() * TAU, r = Math.sqrt(c.rand()) * 512;
        const x = 512 + Math.cos(a) * r, y = 512 + Math.sin(a) * r;
        const grass = r > 80;
        const l = Math.round((grass ? 22 : 40) + c.rand() * 30);
        g.fillStyle = grass ? `rgba(${l - 8},${l + 14},${l - 12},0.5)` : `rgba(${l},${l - 4},${l - 8},0.5)`;
        g.fillRect(x, y, 1 + c.rand() * 2.5, 1 + c.rand() * 2.5);
      }
    }
    const groundTex = w.ownTexture(new T.CanvasTexture(groundCanvas));
    groundTex.colorSpace = T.SRGBColorSpace;
    groundTex.anisotropy = Math.min(8, w.renderer.capabilities.getMaxAnisotropy());
    const ground = w.mesh(new T.CircleGeometry(30, 96), new T.MeshStandardMaterial({ map: groundTex, roughness: 0.95, metalness: 0 }), w.root);
    ground.rotation.x = -Math.PI / 2;
    ground.castShadow = false;

    const statics = group(w.root);
    // Stones round the fire.
    const stone = w.metal('#55534f', 0, 0.85);
    stone.flatShading = true;
    for (let k = 0; k < 15; k += 1) {
      const a = (k / 15) * TAU + c.rand() * 0.15;
      const s = w.mesh(new T.DodecahedronGeometry(0.2 + c.rand() * 0.08, 0), stone, statics);
      s.position.set(Math.sin(a) * 0.95, 0.08, Math.cos(a) * 0.95);
      s.scale.set(1.2, 0.7 + c.rand() * 0.3, 1);
      s.rotation.set(c.rand(), c.rand() * TAU, c.rand());
    }
    // The fire's logs in a little tepee, charred.
    const bark = w.metal('#3a2618', 0, 0.9), char = w.metal('#141110', 0, 0.95);
    for (let k = 0; k < 6; k += 1) {
      const a = (k / 6) * TAU;
      const log = w.mesh(new T.CylinderGeometry(0.07, 0.09, 1.0, 10), k % 2 ? bark : char, statics);
      log.position.set(Math.sin(a) * 0.28, 0.32, Math.cos(a) * 0.28);
      // Leaning in, the tops meeting over the middle.
      log.rotation.set(-Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55);
    }
    // Two benches (logs) and a stump.
    const bench = (a: number, len: number) => {
      const b = w.mesh(new T.CylinderGeometry(0.22, 0.24, len, 16), bark, statics);
      ringPlace(b, a, 2.25, 0.22);
      b.rotation.set(0, a + Math.PI, Math.PI / 2);
      b.rotation.order = 'YXZ';
    };
    bench(-2.25, 1.9);
    bench(2.35, 1.5);
    const stump = w.mesh(new T.CylinderGeometry(0.26, 0.3, 0.42, 16), bark, statics);
    ringPlace(stump, 1.25, 2.2, 0.21);
    // Pines round the clearing (none in front of the camera).
    const pine = w.metal('#08110c', 0, 0.95), trunk = w.metal('#1a120c', 0, 0.9);
    for (let k = 0; k < 46; k += 1) {
      const a = c.rand() * TAU;
      if (Math.cos(a) > 0.55) continue;
      const r = 7 + c.rand() * 10, h = 3.5 + c.rand() * 4;
      const tree = group(statics, Math.sin(a) * r, 0, Math.cos(a) * r);
      w.mesh(new T.CylinderGeometry(0.1, 0.16, h * 0.3, 8), trunk, tree).position.y = h * 0.15;
      for (let t = 0; t < 4; t += 1) {
        const cone = w.mesh(new T.ConeGeometry(h * (0.28 - t * 0.05), h * 0.38, 9), pine, tree);
        cone.position.y = h * (0.35 + t * 0.17);
      }
    }
    // Grass tufts.
    const tuft = w.metal('#1f3318', 0, 0.9);
    for (let k = 0; k < 420; k += 1) {
      const a = c.rand() * TAU, r = 1.4 + Math.pow(c.rand(), 0.6) * 9;
      const t = w.mesh(new T.ConeGeometry(0.015 + c.rand() * 0.025, 0.1 + c.rand() * 0.2, 4), tuft, statics);
      t.position.set(Math.sin(a) * r, 0.1, Math.cos(a) * r);
      t.rotation.set((c.rand() - 0.5) * 0.4, 0, (c.rand() - 0.5) * 0.4);
    }
    bake(statics);

    // ---- the people (and the dog).
    const people = group(w.root);
    const place = (f: Figure, a: number, r: number) => { ringPlace(f.root, a, r); people.add(f.root); };
    const dad = figure(w, people, { seat: 0.44, scale: 1, shirt: '#7a3b2e', pants: '#2c3340', skin: '#d9a682', hair: '#2e211a' });
    place(dad, -2.55, 2.25);
    const mom = figure(w, people, { seat: 0.44, scale: 0.93, shirt: '#3d5a7a', pants: '#3a3030', skin: '#e6b99a', hair: '#5a321c', long: true });
    place(mom, -1.95, 2.25);
    const gran = figure(w, people, { seat: 0.42, scale: 0.88, shirt: '#6b5a7a', pants: '#3d3a44', skin: '#e9c3a6', hair: '#c9c2bb', bun: true });
    place(gran, 1.25, 2.2);
    const kid = figure(w, people, { seat: 0.05, scale: 0.68, shirt: '#d1a23a', pants: '#3a5a4a', skin: '#e8bc9a', hair: '#8a5a2a', ground: true });
    place(kid, 0.45, 1.75);
    const friend = figure(w, people, { seat: 0.44, scale: 0.98, shirt: '#3f6a4a', pants: '#2a2c33', skin: '#a8714f', hair: '#1a1410' });
    place(friend, 2.25, 2.35);
    // Mom's blanket over her shoulders.
    const blanket = w.mesh(new T.CylinderGeometry(0.2, 0.36, 0.55, 18, 1, true), new T.MeshStandardMaterial({ color: '#8a3a3a', roughness: 0.95, side: T.DoubleSide }), mom.torso);
    blanket.position.set(0, 0.48, -0.02);
    // Dad's marshmallow stick into the fire.
    dad.armR.rotation.set(-1.05, 0, -0.1);
    const stick = w.beam(dad.armR, v(0, -0.32, 0.33), v(0, -0.5, 1.75), 0.012, bark);
    void stick;
    const marshMat = new T.MeshStandardMaterial({ color: '#f3e6cf', emissive: '#ff9a4d', emissiveIntensity: 0.25, roughness: 0.6 });
    const marsh = w.mesh(new T.CylinderGeometry(0.045, 0.045, 0.08, 12), marshMat, dad.armR);
    marsh.position.set(0, -0.5, 1.72);
    // The friend's guitar across the lap, the right arm strumming.
    const wood = w.metal('#a8652c', 0.05, 0.42), dark = w.metal('#2a1a10', 0.05, 0.5);
    const guitar = group(friend.torso, 0.02, 0.2, 0.3);
    guitar.rotation.set(0.15, 0, 1.2);
    w.sphere(guitar, 0.2, [0, -0.12, 0], wood).scale.set(1, 1.05, 0.38);
    w.sphere(guitar, 0.16, [0, 0.14, 0], wood).scale.set(1, 1, 0.38);
    w.mesh(new T.CircleGeometry(0.06, 20), dark, guitar).position.set(0, 0.04, 0.08);
    w.box(guitar, [0.06, 0.62, 0.04], [0, 0.55, 0], dark);
    w.box(guitar, [0.09, 0.14, 0.05], [0, 0.9, 0], dark);
    friend.armL.rotation.set(-0.9, 0, 0.9);
    friend.armR.rotation.set(-0.45, 0, -0.25);
    friend.base = { l: -0.9, r: -0.45 };
    // The dog lying by the child.
    const dog = group(people);
    ringPlace(dog, 0.05, 1.75);
    const fur = w.metal('#8a5a2e', 0, 0.85);
    w.mesh(new T.CapsuleGeometry(0.17, 0.42, 6, 12), fur, dog).rotation.set(0, 0, Math.PI / 2);
    dog.children[dog.children.length - 1].position.set(-0.05, 0.17, 0);
    const dogHead = group(dog, 0.38, 0.24, 0.05);
    w.sphere(dogHead, 0.14, [0, 0, 0], fur);
    w.sphere(dogHead, 0.08, [0.12, -0.04, 0.02], fur).scale.set(1.3, 0.8, 0.9);
    w.sphere(dogHead, 0.03, [0.21, -0.02, 0.02], w.metal('#111', 0.2, 0.3));
    for (const s of [-1, 1]) { const ear = w.sphere(dogHead, 0.06, [-0.02, 0.06, s * 0.11], w.metal('#5a3a1e', 0, 0.85)); ear.scale.set(0.6, 1.3, 0.5); }
    const tail = w.mesh(new T.CapsuleGeometry(0.035, 0.26, 4, 8), fur, dog);
    tail.position.set(-0.42, 0.2, 0);
    tail.rotation.z = 1.1;

    // ---- the fire: three crossed flame planes, an ember bed and the light.
    const fireUniforms = { uTime: { value: 0 }, uWind: { value: 0 }, uBoost: { value: 0 }, uSeed: { value: 0 } };
    const flames: T.Mesh[] = [];
    for (let k = 0; k < 5; k += 1) {
      const m = new T.ShaderMaterial({
        uniforms: { ...fireUniforms, uSeed: { value: k * 3.7 } },
        vertexShader: FIRE_VERT, fragmentShader: FIRE_FRAG,
        transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
      });
      // Three big crossed planes, and two smaller tongues off the middle.
      const small = k >= 3;
      const plane = w.mesh(new T.PlaneGeometry(small ? 0.9 : 1.6, small ? 1.4 : 2.1), m, w.root);
      plane.castShadow = false;
      plane.receiveShadow = false;
      plane.position.set(small ? (k === 3 ? -0.22 : 0.2) : 0, small ? 0.72 : 0.98, small ? (k === 3 ? 0.1 : -0.12) : 0);
      plane.rotation.y = (k / 3) * Math.PI + (small ? 0.6 : 0);
      plane.userData.y = plane.position.y;
      flames.push(plane);
    }
    const emberMat = w.glow('#ff6a1e', 2.2);
    const embers = group(w.root);
    for (let k = 0; k < 18; k += 1) {
      const a = c.rand() * TAU, r = Math.sqrt(c.rand()) * 0.42;
      const e = w.mesh(new T.DodecahedronGeometry(0.05 + c.rand() * 0.05, 0), emberMat, embers);
      e.position.set(Math.sin(a) * r, 0.05, Math.cos(a) * r);
      e.castShadow = false;
    }
    const light = new T.PointLight('#ff8a3a', 34, 22, 1.6);
    light.position.set(0, 0.85, 0);
    light.castShadow = !w.mobile;
    light.shadow.mapSize.set(512, 512);
    light.shadow.bias = -0.004;
    light.shadow.radius = 4;
    w.scene.add(light);
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = glowCanvas.height = 128;
    {
      const g = glowCanvas.getContext('2d')!;
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,200,140,1)');
      gr.addColorStop(0.3, 'rgba(255,140,60,0.45)');
      gr.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
    }
    const glowTex = w.ownTexture(new T.CanvasTexture(glowCanvas));
    const groundGlow = w.mesh(new T.PlaneGeometry(4.5, 4.5), new T.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0.5 }), w.root);
    groundGlow.rotation.x = -Math.PI / 2;
    groundGlow.position.y = 0.02;
    groundGlow.castShadow = false;

    // ---- sparks (CPU particles, additive points) and smoke (soft sprites).
    const MAX = 420;
    const sp = new Float32Array(MAX * 3), sv = new Float32Array(MAX * 3), life = new Float32Array(MAX), col = new Float32Array(MAX * 3);
    const sparkGeo = new T.BufferGeometry();
    sparkGeo.setAttribute('position', new T.BufferAttribute(sp, 3));
    sparkGeo.setAttribute('color', new T.BufferAttribute(col, 3));
    const dotCanvas = document.createElement('canvas');
    dotCanvas.width = dotCanvas.height = 32;
    {
      const g = dotCanvas.getContext('2d')!;
      const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.35, 'rgba(255,255,255,0.6)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 32, 32);
    }
    const dotTex = w.ownTexture(new T.CanvasTexture(dotCanvas));
    const sparks = new T.Points(sparkGeo, new T.PointsMaterial({ size: 0.07, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    sparks.frustumCulled = false;
    w.scene.add(sparks);
    let next = 0;
    const emit = (count: number, power: number) => {
      for (let k = 0; k < count; k += 1) {
        const i = next;
        next = (next + 1) % MAX;
        const a = c.rand() * TAU, r = c.rand() * 0.3;
        sp[i * 3] = Math.sin(a) * r; sp[i * 3 + 1] = 0.5 + c.rand() * 0.6; sp[i * 3 + 2] = Math.cos(a) * r;
        sv[i * 3] = (c.rand() - 0.5) * 0.6 * power; sv[i * 3 + 1] = (1.2 + c.rand() * 1.8) * power; sv[i * 3 + 2] = (c.rand() - 0.5) * 0.6 * power;
        life[i] = 1.2 + c.rand() * 1.6;
      }
    };
    const smokeTex = glowTex;
    const smoke = Array.from({ length: 10 }, (_, k) => {
      const s = new T.Sprite(new T.SpriteMaterial({ map: smokeTex, color: '#3a3a40', transparent: true, depthWrite: false, opacity: 0 }));
      s.userData.t = k / 10;
      w.scene.add(s);
      return s;
    });

    // ---- the night sky's stars.
    const starPos = new Float32Array(900 * 3);
    for (let k = 0; k < 900; k += 1) {
      const a = c.rand() * TAU, e = 0.12 + Math.pow(c.rand(), 0.7) * 1.3;
      starPos.set([Math.cos(a) * Math.cos(e) * 80, Math.sin(e) * 80, Math.sin(a) * Math.cos(e) * 80], k * 3);
    }
    const starGeo = new T.BufferGeometry();
    starGeo.setAttribute('position', new T.BufferAttribute(starPos, 3));
    w.scene.add(new T.Points(starGeo, new T.PointsMaterial({ color: '#dfe6ff', size: 0.35, map: dotTex, transparent: true, depthWrite: false, fog: false })));

    // ---- life.
    let boost = 0, cheer = 0, emitCarry = 0;
    w.ticks.push((time, dt, p) => {
      const react = c.params.react;
      if (p.clicked && react > 0) { boost = 1; cheer = 1; emit(140, 1.25); }
      boost = Math.max(0, boost - dt * 0.35);
      cheer = Math.max(0, cheer - dt * 0.45);
      const wind = w.pointer.x * 0.9 * react + Math.sin(time * 0.37) * 0.12;
      for (const f of flames) {
        const u = (f.material as T.ShaderMaterial).uniforms;
        u.uTime.value = time; u.uWind.value = wind; u.uBoost.value = boost;
        f.scale.set(1 + boost * 0.25, 1 + boost * 0.6, 1);
        f.position.y = f.userData.y + boost * 0.6;
      }
      const flick = 0.82 + 0.1 * Math.sin(time * 9.1) + 0.06 * Math.sin(time * 23.7 + 1.3) + 0.05 * Math.sin(time * 4.3);
      light.intensity = 34 * flick * (1 + boost * 1.4) * (0.5 + 0.5 * Math.min(1.5, c.params.intensity));
      light.position.x = Math.sin(time * 5.3) * 0.05 + wind * 0.15;
      groundGlow.material.opacity = 0.42 * flick * (1 + boost);
      emberMat.emissiveIntensity = 1.8 + 0.7 * Math.sin(time * 3.1) + boost * 2;
      // Sparks: a steady trickle, buoyant, drifting with the wind, cooling from yellow to deep red.
      emitCarry += dt * (14 + boost * 40);
      while (emitCarry > 1) { emit(1, 1); emitCarry -= 1; }
      for (let i = 0; i < MAX; i += 1) {
        if (life[i] <= 0) { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; continue; }
        life[i] -= dt;
        sv[i * 3] += (wind * 1.4 - sv[i * 3]) * dt * 0.8 + (Math.sin(time * 7 + i) * 0.6) * dt;
        sv[i * 3 + 1] += (0.25 - sv[i * 3 + 1] * 0.35) * dt;
        sv[i * 3 + 2] += Math.cos(time * 5 + i * 1.7) * 0.4 * dt;
        sp[i * 3] += sv[i * 3] * dt; sp[i * 3 + 1] += sv[i * 3 + 1] * dt; sp[i * 3 + 2] += sv[i * 3 + 2] * dt;
        const k = Math.max(0, Math.min(1, life[i] / 2.2));
        col[i * 3] = 1.6 * k + 0.2; col[i * 3 + 1] = 0.9 * k * k; col[i * 3 + 2] = 0.25 * k * k * k;
      }
      sparkGeo.attributes.position.needsUpdate = true;
      sparkGeo.attributes.color.needsUpdate = true;
      // Smoke puffs rise, widen and fade, leaning with the wind.
      for (const s of smoke) {
        const t = (s.userData.t + time * 0.07) % 1;
        s.position.set(wind * t * t * 3 + Math.sin(time * 0.5 + s.userData.t * 9) * 0.2, 2.1 + t * 4.2, Math.cos(s.userData.t * 7) * 0.2 * t);
        s.scale.setScalar(0.8 + t * 3.4);
        s.material.opacity = 0.16 * Math.sin(t * Math.PI) * (0.7 + boost * 0.5);
      }
      // Breathing, heads turned to the fire (a little to the guitar), the strum, the child cheering at a flare.
      const all = [dad, mom, gran, kid, friend];
      all.forEach((f, k) => {
        f.torso.scale.y = 1 + 0.012 * Math.sin(time * 1.6 + k);
        f.head.rotation.y = Math.sin(time * 0.3 + k * 1.7) * 0.18;
        f.head.rotation.x = 0.15 + Math.sin(time * 0.45 + k) * 0.04;
      });
      friend.armR.rotation.x = friend.base.r + Math.sin(time * 9) * 0.12;
      friend.torso.rotation.z = Math.sin(time * 1.5) * 0.03;
      dad.armR.rotation.y = Math.sin(time * 0.7) * 0.05;
      kid.armL.rotation.x = -0.55 - cheer * 2.2;
      kid.armR.rotation.x = -0.55 - cheer * 2.2;
      kid.root.position.y = Math.abs(Math.sin(time * 9)) * 0.05 * cheer;
      tail.rotation.z = 1.1 + Math.sin(time * (3 + cheer * 9)) * 0.25;
      dogHead.rotation.z = cheer * 0.3;
      marshMat.emissiveIntensity = 0.25 + boost * 0.8;
    });
    return w;
  },
};
