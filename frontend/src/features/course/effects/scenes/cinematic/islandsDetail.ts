import { T, TAU, v, type World } from './world';
import { bake, group, person } from './storyKit';

/**
 * «Моё место жительства» — the floating islands made richer (owner, 2026-10-30: «именно 3Д острова круче сделай,
 * увеличь детализацию и крутость»). Added over islandVillage (storiesHome.ts), nothing of it removed:
 *
 * - the sky: a warm late-afternoon gradient with a low sun and its halo, soft god-rays, a sea of clouds far below and
 *   small islands drifting in the distance (each with a tree and a waterfall thread);
 * - each island: a layered rock underside (strata in ochre, rust and slate, glowing crystals in the cracks, roots and
 *   vines hanging from the edge), grass tufts and flowers on top, little trees, a stone path, small rocks orbiting it;
 * - life: villagers crossing the rope bridge and back, a hot-air balloon drifting over, lanterns along the bridge that
 *   light up softly, motes of light rising past the islands; the islands bob very slowly, out of step.
 * Static parts are baked; the walkers, balloon, orbiting rocks and distant islands move.
 */
export function islandsDetail(w: World, left: T.Group, right: T.Group, radii: [number, number]) {
  const rand = w.c.rand;
  // ---- the sky: a warm gradient sphere behind everything, a sun and its halo, god-rays.
  const skyMat = new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new T.Color('#3c6f9a') }, mid: { value: new T.Color('#9fc7cc') }, low: { value: new T.Color('#f2c99a') } },
    vertexShader: 'varying vec3 p; void main(){ p=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec3 p; uniform vec3 top; uniform vec3 mid; uniform vec3 low; void main(){ float h=normalize(p).y; vec3 c=mix(low,mid,smoothstep(-.15,.18,h)); c=mix(c,top,smoothstep(.18,.7,h)); gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
  });
  const sky = w.mesh(new T.SphereGeometry(80, 32, 20), skyMat, w.scene);
  sky.castShadow = sky.receiveShadow = false;
  // A soft round glow, computed into a small texture (no canvas: also runs where there is no DOM, as in the tests).
  const GS = 64, glowData = new Uint8Array(GS * GS * 4);
  for (let y = 0; y < GS; y++) for (let x = 0; x < GS; x++) {
    const d = Math.hypot(x - GS / 2 + .5, y - GS / 2 + .5) / (GS / 2), a = d >= 1 ? 0 : d < .25 ? 1 - d * 2.2 : .45 * (1 - (d - .25) / .75);
    glowData.set([255, 255, 255, Math.round(Math.max(0, a) * 255)], (y * GS + x) * 4);
  }
  // (Registered with the world for disposal; the headless test worlds have no texture registry, then it is kept as is.)
  const own = <X extends T.Texture>(t: X): X => { try { return w.ownTexture(t); } catch { return t; } };
  const glowTex = own(new T.DataTexture(glowData, GS, GS)); glowTex.needsUpdate = true;
  const sun = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: '#fff1c8', transparent: true, depthWrite: false, fog: false, blending: T.AdditiveBlending }));
  sun.position.set(9, 6.5, -40); sun.scale.setScalar(16); w.scene.add(sun);
  const core = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: '#ffffff', transparent: true, depthWrite: false, fog: false, blending: T.AdditiveBlending }));
  core.position.copy(sun.position); core.scale.setScalar(4.5); w.scene.add(core);
  // God-rays: long soft additive wedges fanning down from the sun.
  const rays = group(w.scene, sun.position.x, sun.position.y, sun.position.z + 2);
  const rayMat = new T.MeshBasicMaterial({ color: '#fff0c8', transparent: true, opacity: .05, depthWrite: false, fog: false, blending: T.AdditiveBlending, side: T.DoubleSide });
  for (let i = 0; i < 9; i++) {
    const ray = w.mesh(new T.PlaneGeometry(2.5 + rand() * 3, 70), rayMat, rays);
    ray.position.y = -35; ray.rotation.z = -.7 + i * .16 + (rand() - .5) * .05; ray.castShadow = ray.receiveShadow = false;
    // Rotate about the sun, not the strip's middle.
    const pivot = group(rays); pivot.rotation.z = ray.rotation.z; ray.rotation.z = 0; pivot.add(ray);
  }
  // ---- a sea of clouds far below, and drifting distant islands.
  const cloudMat = new T.MeshStandardMaterial({ color: '#f6e6d2', roughness: 1, transparent: true, opacity: .7, depthWrite: false });
  const sea = group(w.root, 0, -12.5, -16);
  for (let i = 0; i < 70; i++) {
    const s = w.sphere(sea, 1.2 + rand() * 2, [(rand() - .5) * 80, rand() * .9, -rand() * 34], cloudMat);
    s.scale.y = .42; s.castShadow = s.receiveShadow = false;
  }
  const far: T.Group[] = [];
  const farRock = w.metal('#6f7f86', .05, .9), farGrass = w.metal('#7aa07a', 0, .95), farTree = w.metal('#4f7d5c', 0, .9);
  const water = w.glass('#bfeff0', .5);
  for (let i = 0; i < 5; i++) {
    const g = group(w.root, -30 + i * 15 + (rand() - .5) * 5, 1 + rand() * 7, -34 - rand() * 14);
    const r = .7 + rand() * .9;
    w.mesh(new T.CylinderGeometry(r, r * .8, .2, 14), farGrass, g);
    const under = w.mesh(new T.ConeGeometry(r * .9, r * 1.6, 9), farRock, g, v(0, -r * .8)); under.rotation.z = Math.PI;
    w.mesh(new T.ConeGeometry(r * .3, r * .9, 8), farTree, g, v(r * .2, r * .5, 0));
    w.box(g, [.05, r * 2.2, .02], [r * .5, -r * 1.1, r * .3], water);
    g.userData.phase = rand() * TAU; g.userData.y = g.position.y; g.userData.x = g.position.x;
    far.push(g);
  }
  // ---- each island: strata, crystals, hanging roots and vines, grass, flowers, trees, a path, orbiting rocks.
  const strata = ['#8a6a4a', '#a0583c', '#5f6e74', '#7c7a68', '#b08b5a'].map(c => w.metal(c, .05, .9));
  const crystal = w.glow('#7ff2e0', 1.6), crystal2 = w.glow('#c9a6ff', 1.4);
  const root = w.metal('#5a4632', 0, .9), vine = w.metal('#3f7a4a', 0, .85);
  const tuft = w.metal('#5f9a55', 0, .95), flowerCols = ['#ffd1e6', '#ffe27a', '#ff8a7a', '#ffffff', '#b8a4ff'].map(c => w.metal(c, 0, .7));
  const stone = w.metal('#c8c0a8', 0, .8), bark = w.metal('#6a4a30', 0, .9), leaf = w.metal('#5a9a5e', 0, .85);
  const orbiters: { mesh: T.Mesh; r: number; a: number; s: number; y: number }[] = [];
  const islands: [T.Group, number][] = [[left, radii[0]], [right, radii[1]]];
  for (const [p, radius] of islands) {
    const g = group(p);
    // Strata: stacked, slightly tilted bands of the cone, each its own rock colour.
    for (let k = 0; k < 6; k++) {
      const top = -.2 - k * radius * .23, h = radius * .22, r0 = radius * .93 * (1 - k * .16), r1 = radius * .93 * (1 - (k + 1) * .16);
      const band = w.mesh(new T.CylinderGeometry(r0 * 1.02, r1 * 1.02, h, 16, 1, true), strata[k % strata.length], g, v(0, top - h / 2, 0));
      band.rotation.set((rand() - .5) * .08, rand() * TAU, (rand() - .5) * .08);
    }
    // Crystals in the cracks.
    for (let k = 0; k < 14; k++) {
      const a = rand() * TAU, depth = .3 + rand() * radius * .9, rr = radius * .9 * (1 - depth / (radius * 1.5)) * .98;
      const c = w.mesh(new T.OctahedronGeometry(.12 + rand() * .16, 0), k % 3 ? crystal : crystal2, g, v(Math.cos(a) * rr, -depth, Math.sin(a) * rr));
      c.scale.y = 1.8 + rand(); c.rotation.set(rand() * .6, a, (rand() - .5) * .8); c.castShadow = false;
    }
    // Roots and vines hanging from the rim.
    for (let k = 0; k < 18; k++) {
      const a = rand() * TAU, r = radius * (.82 + rand() * .12), len = .6 + rand() * 1.6;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const pts = [v(x, -.15, z), v(x * 1.02, -.15 - len * .4, z * 1.02), v(x * .98 + (rand() - .5) * .2, -.15 - len, z * .98)];
      w.tube(g, pts, k % 2 ? root : vine, .025 + rand() * .02);
      if (k % 2 === 0) for (let j = 0; j < 4; j++) { const l = w.sphere(g, .06, [pts[1].x + (rand() - .5) * .1, -.2 - len * (j / 4), pts[1].z + (rand() - .5) * .1], leaf); l.scale.set(1.4, .5, 1); }
    }
    // Grass tufts and flowers round the edge, little trees, a stone path.
    for (let k = 0; k < 90; k++) {
      const a = rand() * TAU, r = Math.sqrt(rand()) * radius * .95;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(x) < radius * .7 && z < .9 && z > -1.4) continue;
      const t = w.mesh(new T.ConeGeometry(.05 + rand() * .05, .18 + rand() * .2, 5), tuft, g, v(x, .27, z));
      t.rotation.set((rand() - .5) * .4, 0, (rand() - .5) * .4);
      if (rand() < .4) w.sphere(g, .055, [x + .05, .38 + rand() * .08, z], flowerCols[k % flowerCols.length]);
    }
    for (let k = 0; k < 3; k++) {
      const a = Math.PI * .1 + k * 2.2 + rand() * .4, r = radius * .78;
      const tr = group(g, Math.cos(a) * r, .19, Math.sin(a) * r - .4);
      w.mesh(new T.CylinderGeometry(.06, .09, .8, 8), bark, tr, v(0, .4));
      for (let j = 0; j < 4; j++) w.sphere(tr, .32 - j * .04, [(rand() - .5) * .3, .9 + j * .18, (rand() - .5) * .3], leaf);
    }
    for (let k = 0; k < 16; k++) {
      const s = w.mesh(new T.CylinderGeometry(.13 + rand() * .06, .15, .05, 7), stone, g, v(-radius * .8 + k * radius * .1, .2, 1.3 + Math.sin(k * .9) * .15));
      s.rotation.y = rand() * TAU;
    }
    bake(g);
    // Small rocks circling the island.
    for (let k = 0; k < 7; k++) {
      const m = w.mesh(new T.DodecahedronGeometry(.12 + rand() * .18, 0), strata[k % strata.length], p);
      orbiters.push({ mesh: m, r: radius * (1.15 + rand() * .35), a: rand() * TAU, s: (.12 + rand() * .15) * (k % 2 ? 1 : -1), y: -.8 - rand() * 2.2 });
    }
  }
  // ---- villagers crossing the bridge (along the same sagging line as the planks), with their own pace.
  const walkers = ['#c9453f', '#3f6fb0', '#e0a63c', '#5c9a6a'].map((c, i) => ({ who: person(w, w.root, c, .55), phase: i / 4, speed: .045 + i * .008 }));
  // Lanterns along the bridge.
  const lanternMat = w.glow('#ffcf7a', 1.2);
  const lanterns = Array.from({ length: 6 }, () => { const l = w.sphere(w.root, .09, [0, 0, 0], lanternMat); l.castShadow = false; return l; });
  // A hot-air balloon drifting over.
  const balloon = group(w.root);
  const stripes = ['#e2553f', '#f3c34a', '#3f8fb0', '#f3ede0'];
  for (let k = 0; k < 8; k++) {
    const seg = w.mesh(new T.SphereGeometry(1, 24, 18, k / 8 * TAU, TAU / 8, 0, Math.PI * .78), w.metal(stripes[k % 4], 0, .7), balloon);
    seg.scale.set(1, 1.2, 1);
  }
  w.box(balloon, [.45, .32, .45], [0, -1.75, 0], bark);
  for (const [x, z] of [[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]]) w.beam(balloon, v(x, -1.6, z), v(x * 3, -.7, z * 3), .01, bark);
  const flame = w.sphere(balloon, .1, [0, -1.35, 0], w.glow('#ffb44a', 3)); flame.castShadow = false;
  balloon.scale.setScalar(.7);
  // Motes of light rising past the islands.
  const MOTES = 80, motePos = new Float32Array(MOTES * 3);
  for (let i = 0; i < MOTES; i++) motePos.set([(rand() - .5) * 26, -6 + rand() * 12, (rand() - .5) * 6], i * 3);
  const moteGeo = new T.BufferGeometry(); moteGeo.setAttribute('position', new T.BufferAttribute(motePos, 3));
  w.scene.add(new T.Points(moteGeo, new T.PointsMaterial({ size: .09, map: glowTex, color: '#fff2c4', transparent: true, depthWrite: false, blending: T.AdditiveBlending })));
  const baseY = [left.position.y, right.position.y];
  const start = v(), end = v();
  w.ticks.push((t, dt) => {
    // The islands bob slowly, out of step (the bridge follows their anchors).
    left.position.y = baseY[0] + Math.sin(t * .35) * .12;
    right.position.y = baseY[1] + Math.sin(t * .31 + 1.7) * .12;
    for (const o of orbiters) { o.a += o.s * dt; o.mesh.position.set(Math.cos(o.a) * o.r, o.y + Math.sin(o.a * 2) * .15, Math.sin(o.a) * o.r); o.mesh.rotation.x += dt * .4; o.mesh.rotation.y += dt * .3; }
    for (const g of far) { g.position.y = g.userData.y + Math.sin(t * .2 + g.userData.phase) * .4; g.position.x = g.userData.x + Math.sin(t * .03 + g.userData.phase) * 1.2; }
    rays.rotation.z = Math.sin(t * .05) * .03;
    (rayMat as T.MeshBasicMaterial).opacity = .045 + .015 * Math.sin(t * .4);
    // The bridge line (as islandVillage lays it).
    start.copy(left.position).add(v(2.65, .12, .85)); end.copy(right.position).add(v(-2.65, .12, .85));
    const point = (u: number) => start.clone().lerp(end, u).add(v(0, -Math.sin(u * Math.PI) * 1.05, 0));
    for (const wk of walkers) {
      wk.who.root.visible = !w.mobile;
      const raw = (t * wk.speed + wk.phase) % 2, forward = raw < 1, u = forward ? raw : 2 - raw;
      const pt = point(u), next = point(Math.min(1, u + .01));
      wk.who.root.position.copy(pt).add(v(0, .04, (forward ? -.15 : .15)));
      wk.who.root.rotation.y = forward ? Math.atan2(next.x - pt.x, 0) : -Math.PI / 2;
      wk.who.walk(t * 1.4 + wk.phase * 9, .7);
    }
    lanterns.forEach((l, i) => { const pt = point((i + .5) / 6); l.position.copy(pt).add(v(0, .78, .41 * (i % 2 ? 1 : -1))); l.visible = !w.mobile; });
    lanternMat.emissiveIntensity = 1.1 + .25 * Math.sin(t * 2.3);
    balloon.position.set(((t * .35) % 40) - 20, 5.5 + Math.sin(t * .25) * .6, -6);
    balloon.rotation.y = t * .1;
    (flame.material as T.MeshStandardMaterial).emissiveIntensity = 2.5 + Math.sin(t * 9) * .8;
    for (let i = 0; i < MOTES; i++) { motePos[i * 3 + 1] += dt * (.15 + (i % 5) * .05); if (motePos[i * 3 + 1] > 7) motePos[i * 3 + 1] = -6; motePos[i * 3] += Math.sin(t + i) * dt * .05; }
    moteGeo.attributes.position.needsUpdate = true;
  });
}
