import { T, TAU, v, type World } from './world';
import { backdrop, bake, cylinder, group, lamp, person, plant, round, stars } from './storyKit';
import { porcelainFracture, porcelainGeometry, porcelainPoint, porcelainRadius } from './porcelainFracture';
import { supperGuestDetails, supperLife, supperTableDetails } from './supperDetails';

/** A single shared table, with a delayed toast passing from person to person. */
export function familySupper(w: World) {
  backdrop(w, '#111d35', '#3b323d'); stars(w, 80);
  w.eye.set(0, 5, 22); w.target.set(0, .2, 0); w.cameraMotion = .15;
  const stage = group(w.root); stage.name = 'supper-stage';
  if (w.mobile) stage.scale.setScalar(Math.min(.57, w.c.width / w.c.height * .9));
  const wood = w.metal('#a36b43', .15, .55), gold = w.metal('#d9b36b', .65, .3);
  const cream = w.metal('#f0dcc1', .05, .55), glass = w.glass('#ffe4ba', .45), dark = w.metal('#2b3946', .2, .65);
  const room = group(stage);
  round(w, room, [17, .35, 8], [0, -3.5, 0], wood);
  for (let x = -8; x <= 8; x += .5) w.box(room, [.018, .012, 7.9], [x, -3.31, 0], dark);
  // Three different façades frame the gathering without a solid wall in front of it.
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 5.1, shell = w.metal(['#98786f', '#637d81', '#88758d'][i], .1, .8);
    round(w, room, [4.8, 6 + i % 2, .4], [x, -.3, -3.7], shell);
    for (const dx of [-1.1, 1.1]) {
      round(w, room, [1.5, 2.3, .08], [x + dx, .3, -3.45], dark);
      w.box(room, [1.2, 2, .02], [x + dx, .3, -3.39], w.glow('#edb36f', .38));
      w.box(room, [.06, 2.1, .08], [x + dx, .3, -3.32], cream);
      w.box(room, [1.25, .06, .08], [x + dx, .3, -3.32], cream);
    }
    const roof = w.mesh(new T.ConeGeometry(3.5, 1.5, 4), wood, room, v(x, 3.4 + (i % 2) * .5, -3.7)); roof.rotation.y = Math.PI / 4; roof.scale.z = .2;
    // Relief details keep the backdrop readable as a courtyard, not three flat panels.
    for (const dx of [-2.22, 2.22]) {
      w.box(room, [.16, 5.8, .12], [x + dx, -.3, -3.42], cream);
      for (let row = 0; row < 12; row++) w.box(room, [.25, .075, .16], [x + dx, -2.9 + row * .47, -3.39], wood);
    }
    for (const y of [-2.9, -1.05, 2.65 + (i % 2) * .5]) w.box(room, [4.7, .12, .2], [x, y, -3.4], cream);
    round(w, room, [1.05, 1.65, .12], [x, -2.35, -3.39], dark);
    for (const dx of [-.26, .26]) round(w, room, [.4, 1.34, .07], [x + dx, -2.37, -3.3], wood);
    for (const dx of [-.07, .07]) w.sphere(room, .035, [x + dx, -2.3, -3.24], gold);
    for (const dx of [-1.1, 1.1]) {
      w.box(room, [1.6, .13, .28], [x + dx, 1.55, -3.26], cream);
      w.box(room, [1.6, .12, .35], [x + dx, -.86, -3.2], cream);
      for (const edge of [-.78, .78]) {
        w.box(room, [.21, 2.12, .06], [x + dx + edge, .3, -3.3], wood);
        for (let slat = 0; slat < 12; slat++) w.box(room, [.23, .035, .035], [x + dx + edge, -.62 + slat * .16, -3.25], gold);
      }
    }
    round(w, room, [.55, .85, .45], [x - 1.3, 3.65 + i % 2 * .5, -3.75], shell);
    w.box(room, [.7, .1, .6], [x - 1.3, 4.08 + i % 2 * .5, -3.75], dark);
  }
  round(w, room, [12, .22, 2.5], [0, -1.5, .25], wood);
  w.box(room, [11.7, .018, .82], [0, -1.37, .25], w.metal('#bd626d', 0, .95));
  for (const x of [-5.2, 5.2]) for (const z of [-.6, 1.1]) cylinder(w, room, .1, 1.8, wood, x, -2.4, z);
  // Handmade feast: dishes, bread, berry bowls, teapot and a three-layer cake.
  for (let i = 0; i < 8; i++) {
    const x = -4.8 + (i % 4) * 3.2, z = i < 4 ? -.6 : 1.05;
    cylinder(w, room, .36, .035, cream, x, -1.34, z);
    w.ring(room, .29, .014, gold, v(x, -1.315, z)).rotation.x = Math.PI / 2;
    for (const dx of [-.49, .49]) w.box(room, [.035, .035, .45], [x + dx, -1.32, z], gold);
    const bun = w.sphere(room, .17, [x, -1.2, z], w.metal('#d99c53', .05, .8)); bun.scale.set(1.2, .6, 1);
  }
  for (let layer = 0; layer < 3; layer++) cylinder(w, room, .62 - layer * .12, .21, layer % 2 ? cream : wood, .2, -1.2 + layer * .21, .2);
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8; w.sphere(room, .065, [.2 + Math.cos(a) * .34, -.62, .2 + Math.sin(a) * .34], w.metal('#b6435f')); }
  const teapot = w.sphere(room, .3, [-2, -1.03, .2], cream); teapot.scale.y = .8;
  w.tube(room, [v(-1.8, -1.05, .2), v(-1.5, -.91, .2), v(-1.45, -.74, .2)], cream, .07);
  w.ring(room, .23, .045, gold, v(-2.3, -1.03, .2));
  supperTableDetails(w, room);
  const flames: T.Mesh[] = [];
  for (const x of [-3.4, 3.4]) {
    cylinder(w, room, .22, .07, gold, x, -1.3, .3); cylinder(w, room, .06, .7, cream, x, -.92, .3);
    const flame = w.sphere(stage, .075, [x, -.49, .3], w.glow('#ffd38b', 2)); flame.scale.y = 2; flames.push(flame);
  }
  plant(w, room, -7.4, -3.3, 2, 1.8, true); plant(w, room, 7.4, -3.3, 2, 1.8, true);
  lamp(w, room, -7, -3.3, -2, 4.6); lamp(w, room, 7, -3.3, -2, 4.6);
  // Suspended lanterns share baked metal/glass geometry; only the warm cores pulse.
  const bulbs: T.Mesh[] = [];
  w.tube(room, [v(-8, 4.3, 1), v(0, 2.9, 1), v(8, 4.3, 1)], dark, .018);
  for (let i = 0; i < 11; i++) {
    const x = -7.5 + i * 1.5, y = 2.9 + (x / 8) ** 2 * 1.4;
    w.beam(room, v(x, y, 1), v(x, y - .35, 1), .012, gold);
    const lantern = w.sphere(room, .24, [x, y - .55, 1], glass); lantern.scale.y = 1.3;
    bulbs.push(w.sphere(stage, .1, [x, y - .55, 1], w.glow('#ffc178', 1.1)));
  }
  w.text(room, 'VIENS GALDS • DAUDZ STĀSTU', '#ffe2ae', 8, .55).position.set(0, -3.65, 4.3);
  w.text(room, 'КЛИК — ПЕРЕДАТЬ ТОСТ ПО КРУГУ', '#edd1be', 7, .3).position.set(0, -4.15, 4.3);
  bake(room);
  const guests = Array.from({ length: 8 }, (_, i) => {
    const human = person(w, stage, ['#ce7677', '#68b9aa', '#deac58', '#849dcc'][i % 4], 1.35);
    const back = i < 4, x = -4.8 + (i % 4) * 3.2, z = back ? -1.6 : 2.1;
    human.root.position.set(x, -2.15, z); human.root.rotation.y = back ? 0 : Math.PI;
    supperGuestDetails(w, human.root, i);
    // Legs stay bent on chairs, arms animate independently for the toast.
    human.limbs[0].rotation.x = human.limbs[2].rotation.x = -1.15;
    const cup = group(human.limbs[3], 0, -.33, .04); cup.name = 'supper-toast-cup'; cylinder(w, cup, .085, .16, cream);
    w.ring(cup, .058, .015, gold, v(.1, 0, 0));
    const chair = group(stage);
    round(w, chair, [.9, .16, .9], [x, -1.57, z], wood);
    for (const dx of [-.34, .34]) for (const dz of [-.34, .34]) cylinder(w, chair, .04, 1.65, wood, x + dx, -2.48, z + dz);
    for (const dx of [-.34, .34]) cylinder(w, chair, .04, .9, wood, x + dx, -1.1, z + (back ? -.4 : .4));
    for (let row = 0; row < 3; row++) round(w, chair, [.77, .12, .08], [x, -.7 - row * .22, z + (back ? -.4 : .4)], wood);
    bake(chair);
    return { ...human, cup };
  });
  const animateLife = supperLife(w, stage);
  let toast = -10, nextToast = 4;
  w.ticks.push((time, dt, pointer) => {
    animateLife(time);
    if ((pointer.clicked && w.c.params.react > 0) || time >= nextToast) { toast = 0; nextToast = time + 16; }
    toast += dt;
    guests.forEach((guest, i) => {
      const age = toast - i * .3, raise = age > 0 && age < 3 ? Math.sin(Math.min(1, age / .6) * Math.PI / 2) * Math.min(1, (3 - age) / .7) : 0;
      guest.limbs[3].rotation.x = -.2 - Math.max(0, raise) * 2.15;
      // The wrist keeps the drink upright while the arm raises it.
      guest.cup.rotation.x = -guest.limbs[3].rotation.x;
      guest.limbs[1].rotation.x = -.4 + Math.sin(time * 1.4 + i) * .16;
    });
    bulbs.forEach((bulb, i) => { (bulb.material as T.MeshStandardMaterial).emissiveIntensity = 1.1 + Math.max(0, 1 - Math.abs(toast - i * .22)) * 1.6; });
    flames.forEach((flame, i) => { flame.scale.set(.8 + Math.sin(time * 8 + i) * .12, 1.9 + Math.sin(time * 11 + i) * .25, 1); });
  });
}

/** Broken porcelain is assembled piece by piece; progress is never reset automatically. */
export function secondChance(w: World) {
  backdrop(w, '#151c36', '#27303c'); stars(w, 70);
  w.eye.set(0, 1.8, 20); w.target.set(0, .1, 0); w.cameraMotion = .12;
  const stage = group(w.root); if (w.mobile) stage.scale.setScalar(.62);
  const porcelain = new T.MeshPhysicalMaterial({ color: '#6bb9bd', metalness: .08, roughness: .24, clearcoat: 1, clearcoatRoughness: .12 });
  porcelain.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vPorcelain;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPorcelain = uv;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vPorcelain;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float band = 1. - smoothstep(.029, .035, abs(vPorcelain.y - .24));
        band = max(band, 1. - smoothstep(.029, .035, abs(vPorcelain.y - .76)));
        float diamond = abs(fract(vPorcelain.x * 28.) - .5) * 2. + abs(fract(vPorcelain.y * 80.) - .5) * 2.;
        vec3 ink = mix(vec3(.94,.83,.61), vec3(.15,.35,.42), smoothstep(.7,.85,diamond));
        diffuseColor.rgb = mix(diffuseColor.rgb, ink, band);
        float rim = max(1. - smoothstep(.004,.009,abs(vPorcelain.y - .06)), 1. - smoothstep(.004,.009,abs(vPorcelain.y - .94)));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.94,.83,.61), rim);
      `);
  };
  porcelain.customProgramCacheKey = () => 'restoration-painted-porcelain-v1';
  const cutFace = w.metal('#d8cec0', 0, .94), gold = w.metal('#f7c06a', .86, .19), dark = w.metal('#253a48', .5, .5);
  const plinth = group(stage); cylinder(w, plinth, 3.8, .28, dark, 0, -3.25);
  cylinder(w, plinth, 3.65, .04, w.metal('#203f4b', 0, .95), 0, -3.09);
  w.ring(plinth, 3.65, .025, gold, v(0, -3.06, 0)).rotation.x = Math.PI / 2;
  const profile = Array.from({ length: 97 }, (_, i) => { const y = -2.7 + i / 96 * 5.3; return new T.Vector2(porcelainRadius(y) - .018, y); });
  const vessel = group(stage); vessel.name = 'restoration-vessel';
  const seams = w.mesh(new T.LatheGeometry(profile, 128), gold, vessel); seams.visible = false;
  const pieces: { group: T.Group; from: T.Vector3; rotation: T.Euler; progress: number; wanted: boolean; center: T.Vector3 }[] = [];
  const cells = porcelainFracture(w.c.rand);
  for (const cell of cells) {
    const data = porcelainGeometry(cell), geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(data.positions, 3));
    geometry.setAttribute('normal', new T.Float32BufferAttribute(data.normals, 3));
    geometry.setAttribute('uv', new T.Float32BufferAttribute(data.uvs, 2)); geometry.setIndex(data.indices);
    geometry.addGroup(0, data.shellCount, 0); geometry.addGroup(data.shellCount, data.indices.length - data.shellCount, 1);
    const piece = group(vessel), mesh = new T.Mesh(geometry, [porcelain, cutFace]); mesh.castShadow = true; mesh.receiveShadow = true; piece.add(mesh);
    piece.name = 'restoration-fragment';
    const angle = cell.center.x * TAU;
    const from = v(Math.sin(angle) * (1.8 + w.c.rand() * 1.1), (cell.center.y - .5) * 2.5, Math.cos(angle) * (1.4 + w.c.rand()));
    const rotation = new T.Euler((w.c.rand() - .5) * .35, (w.c.rand() - .5) * .4, (w.c.rand() - .5) * .3);
    piece.position.copy(from); piece.rotation.copy(rotation);
    pieces.push({ group: piece, from, rotation, progress: 0, wanted: false, center: v(...porcelainPoint(cell.center)) });
  }
  seams.name = 'restoration-gold-seams';
  // Small workshop tools are baked together. No extra render loop, texture downloads or per-frame geometry.
  cylinder(w, plinth, .48, .2, dark, 3.05, -2.9, 1.5); cylinder(w, plinth, .42, .025, gold, 3.05, -2.785, 1.5);
  w.beam(plinth, v(-3.5, -2.82, 1), v(-2.7, -2.7, 2.4), .055, w.metal('#a76b40', .1, .7));
  w.beam(plinth, v(-2.7, -2.7, 2.4), v(-2.5, -2.67, 2.75), .075, gold);
  const lens = w.ring(plinth, .33, .045, gold, v(-3.2, -2.75, -.3)); lens.rotation.x = Math.PI / 2;
  w.beam(plinth, v(-3.2, -2.75, -.63), v(-3.2, -2.75, -1.35), .065, dark);
  w.ring(plinth, .86, .045, gold, v(0, -2.7, 0)).rotation.x = Math.PI / 2;
  const plaque = w.text(plinth, 'OTRĀ IESPĒJA / ВТОРОЙ ШАНС', '#f3d497', 9, .55); plaque.position.set(0, -3.8, 3.4);
  w.text(plinth, 'СОБИРАЙ КЛИКАМИ • ШВЫ СТАНОВЯТСЯ ЗОЛОТОМ', '#a8ced4', 10, .3).position.set(0, -4.35, 3.4);
  bake(plinth);
  const cursor = v(), projected = v();
  w.ticks.push((time, dt, pointer) => {
    if (pointer.clicked && w.c.params.react > 0) {
      cursor.set(pointer.rawX / w.c.width * 2 - 1, 1 - pointer.rawY / w.c.height * 2, 0);
      let closest: typeof pieces[number] | null = null, distance = Infinity;
      stage.updateMatrixWorld(true);
      for (const piece of pieces) if (!piece.wanted) {
        projected.copy(piece.center); piece.group.localToWorld(projected); projected.project(w.camera);
        const d = Math.hypot((projected.x - cursor.x) * w.c.width, (projected.y - cursor.y) * w.c.height);
        if (d < distance) { distance = d; closest = piece; }
      }
      if (closest) {
        closest.wanted = true;
        // Adjacent fragments join as a small repair patch, not an all-at-once reset.
        pieces.filter(p => !p.wanted && p.center.distanceTo(closest!.center) < 1.3).slice(0, 2).forEach(p => { p.wanted = true; });
      }
    }
    let finished = true;
    pieces.forEach((piece, i) => {
      if (piece.wanted) piece.progress = Math.min(1, piece.progress + dt * .65);
      const u = piece.progress * piece.progress * (3 - 2 * piece.progress), scatter = 1 - u;
      piece.group.position.copy(piece.from).multiplyScalar(scatter); piece.group.position.y += Math.sin(time * .65 + i * 1.7) * .065 * scatter;
      piece.group.rotation.set(piece.rotation.x * scatter, piece.rotation.y * scatter, piece.rotation.z * scatter);
      if (piece.progress < 1) finished = false;
    });
    // Avoid filling empty holes with an intact golden vase during the assembly.
    seams.visible = finished;
    if (finished) vessel.rotation.y += dt * .09;
  });
}
