import { T, TAU, v, type World } from './world';
import { backdrop, bake, cylinder, group, round } from './storyKit';

type Emitter = { points: T.Vector3[]; color: T.Color; bank: number };

/** Evaluate the fixed lamp geometry once. Animation only changes three circuit gains. */
function bakedPanel(w: World, parent: T.Group, geometry: T.BufferGeometry, emitters: Emitter[], power: T.Vector3, floor = false) {
  const position = geometry.attributes.position, channels = Array.from({ length: 3 }, () => new Float32Array(position.count * 3));
  const p = v();
  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position, i);
    for (const emitter of emitters) {
      let illumination = 0;
      for (const sample of emitter.points) {
        const distance = p.distanceToSquared(sample);
        const cosine = floor ? Math.max(0, sample.y - p.y) : Math.max(0, sample.z - p.z);
        illumination += cosine / Math.sqrt(distance + .05) / (.2 + distance);
      }
      illumination *= .11 / Math.sqrt(emitter.points.length);
      const color = emitter.color, channel = channels[emitter.bank];
      channel[i * 3] += color.r * illumination; channel[i * 3 + 1] += color.g * illumination; channel[i * 3 + 2] += color.b * illumination;
    }
  }
  channels.forEach((data, i) => geometry.setAttribute(`light${i}`, new T.BufferAttribute(data, 3)));
  const material = new T.ShaderMaterial({
    uniforms: { power: { value: power }, isFloor: { value: floor ? 1 : 0 } },
    vertexShader: `attribute vec3 light0; attribute vec3 light1; attribute vec3 light2;
      varying vec3 a; varying vec3 b; varying vec3 c; varying vec3 p;
      void main(){a=light0;b=light1;c=light2;p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform vec3 power; uniform float isFloor; varying vec3 a; varying vec3 b; varying vec3 c; varying vec3 p;
      void main(){vec2 q=mix(p.xy,p.xz,isFloor);float row=floor(q.y*2.6);vec2 tile=fract(vec2(q.x*1.5+mod(row,2.)*.5,q.y*2.6));
      float joint=smoothstep(0.,.035,min(tile.x,tile.y));float noise=fract(sin(dot(floor(q*75.),vec2(12.9898,78.233)))*43758.5453);
      vec3 base=mix(vec3(.012,.018,.025),vec3(.048,.041,.054),joint)*( .9+noise*.2);
      vec3 light=a*power.x+b*power.y+c*power.z;
      gl_FragColor=vec4(base+light*(.35+.35*joint),1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });
  const mesh = w.mesh(geometry, material, parent); mesh.castShadow = false; mesh.receiveShadow = false;
  mesh.name = floor ? 'neon-baked-floor' : 'neon-baked-wall'; return mesh;
}

export function neonMarket(w: World) {
  backdrop(w, '#080c22', '#110d1c'); w.exposure = .85; w.sidePadding = 6.2;
  const shops = [w.side(0, -2), w.side(1, -2)];
  const shopScale = w.mobile ? Math.min(.68, w.camera.aspect * 1.35) : 1;
  const dark = w.metal('#14202e', .3, .6), steel = w.metal('#4f5965', .65, .33), glass = w.glass('#71b0c4', .15);
  const ray = new T.Raycaster(), pointer = new T.Vector2();
  const switches: T.Mesh[] = [], circuits: { power: T.Vector3; target: T.Vector3; materials: T.MeshStandardMaterial[] }[] = [];
  shops.forEach((shop, side) => {
    shop.scale.setScalar(shopScale);
    const emitters: Emitter[] = [], neonColors = side ? ['#a77cff', '#ffb968', '#5ef0d2'] : ['#ff589c', '#64c8ff', '#ffd580'];
    const materials = neonColors.map(color => w.glow(color, 3));
    const power = v(1, 1, 1), target = v(1, 1, 1); circuits.push({ power, target, materials });
    const fixtures = group(shop);
    const tube = (points: T.Vector3[], bank: number, closed = false) => {
      const curve = new T.CatmullRomCurve3(points, closed, 'centripetal');
      const sampled = curve.getPoints(Math.max(16, points.length * 5));
      emitters.push({ points: sampled, color: new T.Color(neonColors[bank]), bank });
      w.mesh(new T.TubeGeometry(curve, Math.max(48, points.length * 12), .037, 8, closed), materials[bank], shop);
      // Ceramic clips, dark electrode ends and supply wires remain solid when the circuit is off.
      for (let i = 0; i < sampled.length; i += 8) {
        const p = sampled[i]; w.beam(fixtures, v(p.x, p.y, -1.92), p, .025, steel);
      }
      for (const end of [sampled[0], sampled[sampled.length - 1]]) {
        w.sphere(fixtures, .075, [end.x, end.y, end.z], dark);
        w.tube(fixtures, [end, v(end.x + .15, end.y - .2, -1.65), v(end.x + .15, -.5, -1.85)], dark, .018);
      }
    };
    // A continuous glass-tube awning; each of the three icons has its own power circuit.
    tube([v(-3.2, .1, -1.4), v(-3.2, 4.9, -1.4), v(0, 5.25, -1.4), v(3.2, 4.9, -1.4), v(3.2, .1, -1.4)], 0);
    if (!side) {
      tube([v(-2.4, 3.6, -.95), v(-2.05, 3.6, -.95), v(-1.65, 1.95, -.95), v(.35, 1.95, -.95), v(.9, 3.2, -.95), v(-1.9, 3.2, -.95)], 1);
      for (const x of [-1.4, .1]) tube(Array.from({ length: 13 }, (_, i) => v(x + Math.cos(i / 12 * TAU) * .19, 1.5 + Math.sin(i / 12 * TAU) * .19, -.95)), 2);
      tube([v(1.25, 2, -.95), v(1.25, 3.25, -.95), v(2.45, 3.25, -.95), v(2.45, 2, -.95), v(1.25, 2, -.95)], 2);
      tube([v(1.55, 3.25, -.95), v(1.6, 3.7, -.95), v(2.15, 3.7, -.95), v(2.2, 3.25, -.95)], 2);
    } else {
      tube([v(-2.4, 2.9, -.95), v(-1.7, 3.7, -.95), v(.2, 3.7, -.95), v(.9, 2.9, -.95), v(-.75, 1.5, -.95), v(-2.4, 2.9, -.95)], 1);
      tube([v(-1.7, 3.7, -.95), v(-1.15, 2.9, -.95), v(-.75, 1.5, -.95), v(-.25, 2.9, -.95), v(.2, 3.7, -.95)], 2);
      tube([v(-2.4, 2.9, -.95), v(.9, 2.9, -.95)], 2);
      tube(Array.from({ length: 17 }, (_, i) => v(2 + Math.cos(i / 16 * TAU) * .68, 2.8 + Math.sin(i / 16 * TAU) * .68, -.95)), 2);
      tube([v(2, 3.35, -.95), v(2, 2.8, -.95), v(2.38, 2.6, -.95)], 1);
    }
    const wall = new T.PlaneGeometry(7.2, 7.8, 90, 98); wall.translate(0, 1.6, -2);
    bakedPanel(w, shop, wall, emitters, power);
    const floor = new T.PlaneGeometry(7.2, 6.5, 80, 72); floor.rotateX(-Math.PI / 2); floor.translate(0, -2.3, .8);
    bakedPanel(w, shop, floor, emitters, power, true);
    for (const x of [-3.45, 3.45]) w.box(fixtures, [.2, 7.8, .3], [x, 1.6, -1.85], steel);
    const sign = w.text(shop, side ? 'DĀVANAS • 24/7' : 'NAKTS TIRGUS', '#f2d9b8', 5.6, .5); sign.position.set(0, 4.25, -1.3);
    w.text(shop, 'Три кнопки — три контура света', '#b9b9ca', 5.8, .26).position.set(0, .3, -.9);
    for (let i = 0; i < 3; i++) {
      const button = cylinder(w, shop, .19, .13, materials[i], (i - 1) * .7, -.8, 1.8); button.rotation.x = Math.PI / 2;
      button.name = `neon-switch-${side}-${i}`; button.userData.shop = side; button.userData.bank = i; switches.push(button);
    }
    const display = group(shop, 0, -1.7, .3);
    round(w, display, [5.7, .6, 2.1], [0, 0, 0], dark);
    for (const x of [-2.5, 2.5]) cylinder(w, display, .08, .6, steel, x, -.3);
    for (let i = 0; i < 5; i++) {
      const stand = group(display, -2 + i, .5, 0);
      cylinder(w, stand, .4, .1, steel);
      const item = group(stand, 0, .1);
      if (!side) {
        round(w, item, [.55, .65, .35], [0, .35, 0], w.metal(neonColors[i % 3], .2, .45));
        w.tube(item, [v(-.17, .65), v(-.17, .94), v(.17, .94), v(.17, .65)], steel, .025);
      } else {
        const gem = w.mesh(new T.IcosahedronGeometry(.36, 0), w.metal(neonColors[i % 3], .65, .13), item, v(0, .45, 0)); gem.rotation.z = .2;
      }
      w.ticks.push(t => { item.rotation.y = t * .35 + i; });
    }
    w.box(display, [5.6, 1.45, .025], [0, .8, 1.04], glass);
    bake(fixtures);
  });
  w.ticks.push((t, dt, p) => {
    if (p.clicked) {
      w.scene.updateMatrixWorld(true); w.camera.updateMatrixWorld(true);
      pointer.set((p.rawX ?? p.x) / w.c.width * 2 - 1, 1 - (p.rawY ?? p.y) / w.c.height * 2);
      ray.setFromCamera(pointer, w.camera); const hit = ray.intersectObjects(switches, false)[0]?.object;
      if (hit) { const { shop, bank } = hit.userData; const target = circuits[shop].target; target.setComponent(bank, target.getComponent(bank) > .5 ? 0 : 1); }
    }
    circuits.forEach(({ power, target, materials }) => {
      power.lerp(target, 1 - Math.exp(-Math.min(dt, .1) * 12));
      materials.forEach((material, i) => { material.emissiveIntensity = power.getComponent(i) * 1.8; material.color.copy(material.emissive).multiplyScalar(.04 + power.getComponent(i) * .15); });
    });
  });
}
