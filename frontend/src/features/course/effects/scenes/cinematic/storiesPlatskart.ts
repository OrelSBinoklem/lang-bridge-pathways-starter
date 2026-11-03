import { T, TAU, v, type World } from './world';
import { bake, cylinder, group, round } from './storyKit';
import { mappedPlane, trainMaterials, type TrainMaterials } from './platskartMaterials';
import { passengerHand, teaGlass, trainMeal } from './platskartProps';
import { TRAIN_BAKE_SURFACES } from './trainLayout';
import { berthUpholstery } from './platskartBerths';
import { cabinDetails } from './platskartCabin';

function berth(w: World, parent: T.Group, m: TrainMaterials, x: number, z: number, side = false, bedding = true) {
  const g = group(parent, x, 0, z); g.name = side ? 'train-side-berth' : 'train-open-berth';
  const width = side ? .65 : 2.4, depth = side ? 2.06 : .66;
  for (const y of [.4, 1.96]) {
    berthUpholstery(w, g, m, width, depth, y, bedding, side);
    const rim = [v(-width / 2 + .04, y + .1, depth / 2 - .02), v(width / 2 - .04, y + .1, depth / 2 - .02)];
    w.beam(g, rim[0], rim[1], .009, m.piping);
    for (const dx of [-width / 2 + .1, width / 2 - .1]) {
      w.beam(g, v(dx, y - .03, -depth / 2 + .08), v(dx, y - .23, depth / 2 - .08), .018, m.metal);
      if (y > 1) w.beam(g, v(dx, y + .1, depth / 2), v(dx, y + .4, depth / 2), .014, m.metal);
    }
    if (y > 1) w.beam(g, v(-width / 2 + .1, y + .4, depth / 2), v(width / 2 - .1, y + .4, depth / 2), .014, m.metal);
  }
  // Exposed under-seat locker, bolts and toe-kick; no showroom plinths.
  round(w, g, [width - .07, .27, depth - .12], [0, .18, -.015], m.paint, .02);
  const grip = w.ring(g, .033, .004, m.metal, v(.1, .18, depth / 2 - .055)); grip.scale.y = .45;
  for (const dx of [-width / 2 + .12, width / 2 - .12]) w.sphere(g, .009, [dx, .28, depth / 2 - .05], m.metal);
  bake(g); return g;
}

function forest(w: World, m: TrainMaterials, detail = false) {
  const g = group(w.root); g.name = 'train-moving-forest';
  // Detailed: twice the trees, a third of them birches (white bark with black marks: one striped map, tinted per tree).
  const COUNT = detail ? 420 : 210;
  let barkMap: T.CanvasTexture | null = null;
  if (detail) {
    const cv = document.createElement('canvas'); cv.width = 16; cv.height = 128;
    const bg = cv.getContext('2d')!; bg.fillStyle = '#ffffff'; bg.fillRect(0, 0, 16, 128);
    for (let y = 2; y < 128; y += 5 + Math.floor(w.c.rand() * 9)) { bg.fillStyle = '#1e1c18'; bg.fillRect(Math.floor(w.c.rand() * 8), y, 4 + Math.floor(w.c.rand() * 10), 1 + Math.floor(w.c.rand() * 2)); }
    barkMap = w.ownTexture(new T.CanvasTexture(cv)); barkMap.colorSpace = T.SRGBColorSpace;
  }
  const bark = detail ? new T.MeshStandardMaterial({ color: '#ffffff', map: barkMap, roughness: .9 }) : w.metal('#534d39', .02, .95);
  const leaves = new T.MeshStandardMaterial({ color: '#aab68b', map: m.pine, alphaTest: .065, alphaToCoverage: true, side: T.DoubleSide, roughness: 1 });
  const trunks = new T.InstancedMesh(new T.CylinderGeometry(.035, .07, 1, 7), bark, COUNT);
  const branches = new T.BufferGeometry(), positions: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let tier = 0; tier < 9; tier++) for (let spoke = 0; spoke < 7; spoke++) {
    const a = spoke / 7 * TAU + tier * .72, length = (1 - tier / 11) * .9, width = length * .32, y = .15 + tier * .085;
    const outward = v(Math.cos(a), -.18, Math.sin(a)), side = v(-Math.sin(a), 0, Math.cos(a));
    const base = positions.length / 3;
    for (const [s, t] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) {
      const p = v(0, y, 0).addScaledVector(outward, t * length).addScaledVector(side, s * width);
      positions.push(p.x, p.y, p.z); uv.push((s + 1) / 2, t);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  branches.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); branches.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); branches.setIndex(indices); branches.computeVertexNormals();
  const crowns = new T.InstancedMesh(branches, leaves, COUNT);
  trunks.castShadow = crowns.castShadow = false; g.add(trunks, crowns);
  const trees = Array.from({ length: COUNT }, (_, i) => ({ x: -3.4 - (i % (detail ? 5 : 3)) * 5.2 - w.c.rand() * 4, z: w.c.rand() * 100 - 50, h: 2.2 + w.c.rand() * 4.2, width: .6 + w.c.rand() * .65, birch: detail && w.c.rand() < .34 }));
  const dummy = new T.Object3D();
  for (let i = 0; i < trees.length; i++) {
    crowns.setColorAt(i, trees[i].birch ? new T.Color().setHSL(.2 + w.c.rand() * .05, .32, .62 + w.c.rand() * .14) : new T.Color().setHSL(.22 + w.c.rand() * .08, .12, .65 + w.c.rand() * .2));
    if (detail) trunks.setColorAt(i, trees[i].birch ? new T.Color('#ece9de') : new T.Color('#4a4434'));
  }
  // Detailed: a far tree line along the horizon (a jagged silhouette on one long plane, drifting slowly), and grass and
  // bushes by the track.
  let farLine: T.Mesh | null = null, tufts: T.InstancedMesh | null = null;
  const tuftSpots = detail ? Array.from({ length: 260 }, () => ({ x: -2.6 - w.c.rand() * 3.2, z: w.c.rand() * 60 - 30, s: .15 + w.c.rand() * .45 })) : [];
  if (detail) {
    const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 128;
    const fg = cv.getContext('2d')!; fg.fillStyle = '#5f6a52';
    fg.beginPath(); fg.moveTo(0, 128);
    for (let x = 0; x <= 2048; x += 6) fg.lineTo(x, 70 - Math.abs(Math.sin(x * .9)) * (18 + w.c.rand() * 30) - Math.sin(x * .004) * 12);
    fg.lineTo(2048, 128); fg.closePath(); fg.fill();
    const tex = w.ownTexture(new T.CanvasTexture(cv)); tex.wrapS = T.RepeatWrapping; tex.repeat.set(3, 1); tex.colorSpace = T.SRGBColorSpace;
    farLine = w.mesh(new T.PlaneGeometry(220, 9), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: true }), g, v(-40, 3.2, 0));
    farLine.rotation.y = Math.PI / 2; farLine.castShadow = farLine.receiveShadow = false;
    tufts = new T.InstancedMesh(new T.ConeGeometry(.25, 1, 6), new T.MeshStandardMaterial({ color: '#56653a', roughness: 1 }), tuftSpots.length);
    tufts.castShadow = false; g.add(tufts);
  }
  const terrain = w.mesh(new T.PlaneGeometry(100, 200), new T.ShaderMaterial({
    side: T.DoubleSide, uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec2 q; void main(){q=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 q;uniform float time;void main(){float f=sin(q.y*600.+time*4.)*.025+sin(q.x*190.)*.025;gl_FragColor=vec4(vec3(.21,.24,.135)+f,1.);}',
  }), g, v(-51.9, -.13, 0)); terrain.rotation.x = -Math.PI / 2;
  // Wooden telegraph poles and three sagging wires pass closer than the forest.
  const POLES = detail ? 9 : 5, POLE_GAP = detail ? 12.8 : 23;
  const poles = Array.from({ length: POLES }, (_, i) => {
    const pole = group(g, -4.5, 0, i * 23 - 45);
    pole.userData.index = i;
    cylinder(w, pole, .055, 4.6, bark, 0, 2.3, 0);
    w.box(pole, [1.1, .09, .09], [0, 4.1, 0], bark);
    for (const x of [-.4, 0, .4]) { w.sphere(pole, .065, [x, 4.2, 0], w.metal('#9caa97', .12, .4)); w.tube(pole, [v(x, 4.2, 0), v(x, 3.8, 11.5), v(x, 4.2, 23)], bark, .008); }
    bake(pole); return pole;
  });
  let travelled = 0;
  return (dt: number, time: number) => {
    travelled += dt * 12;
    for (let i = 0; i < trees.length; i++) {
      const tree = trees[i], z = ((tree.z + travelled + 50) % 100) - 50;
      dummy.position.set(tree.x, tree.h * .45, z); dummy.scale.set(1, tree.h, 1); dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
      dummy.position.set(tree.x, tree.h * .1, z); dummy.scale.set(tree.width * 2, tree.h, tree.width * 2); dummy.updateMatrix(); crowns.setMatrixAt(i, dummy.matrix);
    }
    trunks.instanceMatrix.needsUpdate = true; crowns.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < poles.length; i++) poles[i].position.z = ((i * POLE_GAP + travelled + 55) % (POLES * POLE_GAP)) - 55;
    if (farLine) (farLine.material as T.MeshBasicMaterial).map!.offset.x = travelled * .0006;
    if (tufts) {
      for (let i = 0; i < tuftSpots.length; i++) { const t = tuftSpots[i]; dummy.position.set(t.x, t.s * .4, ((t.z + travelled + 30) % 60) - 30); dummy.scale.set(t.s, t.s * 1.1, t.s); dummy.updateMatrix(); tufts.setMatrixAt(i, dummy.matrix); }
      tufts.instanceMatrix.needsUpdate = true;
    }
    (terrain.material as T.ShaderMaterial).uniforms.time.value = time;
    g.userData.distance = travelled;
    // The sun through the passing trunks: how many of the nearest trees are between it and the window just now.
    let shade = 0;
    for (let i = 0; i < trees.length; i++) { const t = trees[i]; if (t.x < -7) continue; const z = ((t.z + travelled + 50) % 100) - 50; shade += Math.exp(-((z + .4) ** 2) / .35); }
    g.userData.sun = Math.max(.35, 1 - shade * .45);
  };
}

/** First-person open Soviet sleeping car. All ray visibility work lives in scripts/bake-platskart.mjs. */
export function platskartJourney(w: World, supplied?: TrainMaterials) {
  const m = supplied ?? trainMaterials(w);
  // The detailed variant (1767, owner 2026-10-30: «на основе дефолта, только подними детализацию»).
  const detail = (w.c.params.platDetail ?? 0) >= .5;
  w.stage.visible = false; w.cameraMotion = 0; w.exposure = 1.12;
  w.scene.background = new T.Color('#9fa88f'); w.scene.fog = new T.FogExp2('#949c83', .008);
  w.scene.environmentIntensity = .35;
  for (const child of [...w.scene.children]) if (child instanceof T.Light) child.removeFromParent();
  if (w.renderer) w.renderer.shadowMap.enabled = false;
  w.scene.add(new T.HemisphereLight('#e0e6df', '#655d50', .95));
  const daylight = new T.DirectionalLight('#f1eee2', 1.3); daylight.position.set(-5, 5, -.5); w.scene.add(daylight);
  const carriageLight = new T.PointLight('#ffd6a5', 1.5, 6, 2); carriageLight.position.set(.4, 2.45, -.5); w.scene.add(carriageLight);
  const car = group(w.root); car.name = 'platskart-open-car';
  const room = group(car);
  for (const [name, s] of Object.entries(TRAIN_BAKE_SURFACES)) {
    const mat = name === 'table' ? m.wood : name === 'floor' ? m.dark : m.paint;
    const plane = mappedPlane(w, room, s.origin, s.u, s.v, s.normal, mat, m.lights[name as keyof typeof m.lights]);
    plane.name = `train-baked-${name}`;
  }
  // The outer wall has real openings. No animated screen is pasted over an opaque wall.
  round(w, room, [.1, .92, 16], [-1.9, .46, -4], m.wood, .01);
  round(w, room, [.1, .5, 16], [-1.9, 2.31, -4], m.paint, .01);
  for (let bay = 0; bay < 6; bay++) {
    const z = -bay * 2.6;
    for (const end of [-1, 1]) round(w, room, [.12, 1.2, .48], [-1.9, 1.5, z + end * 1.09], m.paint, .015);
    const window = group(room, -1.84, 1.49, z); window.name = bay ? 'train-window' : 'train-main-window';
    for (const y of [-.58, .58]) round(w, window, [.13, .08, 1.86], [0, y, 0], m.wood, .022);
    for (const zz of [-.89, .89]) round(w, window, [.13, 1.22, .08], [0, 0, zz], m.wood, .022);
    for (const y of [-.52, .51, .23]) round(w, window, [.08, .026, 1.72], [.04, y, 0], m.metal, .006);
    for (const zz of [-.83, .83]) round(w, window, [.08, 1.03, .027], [.04, 0, zz], m.metal, .006);
    // Weather strip, fasteners, ventilation latch and a rail with gathered linen curtains.
    for (const zz of [-.86, .86]) for (const y of [-.51, .51]) w.sphere(window, .009, [.09, y, zz], m.metal);
    round(w, window, [.05, .035, .12], [.1, .29, .58], m.metal, .006);
    const glass = w.mesh(new T.PlaneGeometry(1.63, .98), new T.MeshStandardMaterial({ color: '#9ca98c', opacity: .045, transparent: true, roughness: .8, depthWrite: false, side: T.DoubleSide, envMapIntensity: .05 }), window, v(-.035, 0, 0)); glass.rotation.y = Math.PI / 2;
    w.beam(window, v(.16, .7, -1.05), v(.16, .7, 1.05), .016, m.brass);
    for (const side of [-1, 1]) {
      const curtain = new T.PlaneGeometry(.32, 1.17, 18, 24), pos = curtain.attributes.position;
      for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); pos.setZ(i, Math.sin(x * 88) * .025 + Math.sin(y * 6 + x * 20) * .008); }
      curtain.computeVertexNormals();
      const cloth = w.mesh(curtain, m.cloth, window, v(.15, .04, side * .93)); cloth.rotation.y = Math.PI / 2;
      w.box(window, [.08, .045, .28], [.15, -.03, side * .93], m.brass);
      for (let i = 0; i < 7; i++) { const ring = w.ring(window, .023, .003, m.metal, v(.16, .66, side * .93 + (i - 3) * .042)); ring.rotation.y = Math.PI / 2; }
    }
  }
  // The aisle is continuous along Z, with longitudinal side berths on the right.
  const aisle = group(car); aisle.name = 'train-open-aisle';
  for (let bay = 0; bay < 5; bay++) {
    const z = -bay * 2.6;
    berth(w, aisle, m, -.59, z - .83, false, true);
    if (bay === 0) berth(w, aisle, m, -.59, 1.22, false, false);
    berth(w, aisle, m, 1.77, z, true, true);
    if (bay > 0) round(w, room, [2.49, 2.48, .07], [-.59, 1.24, z - 1.23], m.paint, .025);
    round(w, room, [.08, 2.52, .1], [.68, 1.26, z - 1.23], m.wood, .02);
    for (const x of [.68, 1.37]) {
      w.beam(room, v(x, .12, z - 1.15), v(x, 2.5, z - 1.15), .017, m.metal);
      if (x < 1) for (let y = .5; y <= 1.8; y += .32) w.beam(room, v(x - .1, y, z - 1.15), v(x + .1, y, z - 1.15), .018, m.metal);
    }
    // Upper luggage rack: bent frame, wire grid, a worn holdall and rolled blanket.
    const rack = group(room, -.55, 2.36, z - .78);
    for (const zz of [-.31, .31]) w.beam(rack, v(-1.05, 0, zz), v(1.05, 0, zz), .014, m.metal);
    for (const xx of [-1.05, 1.05]) w.beam(rack, v(xx, 0, -.31), v(xx, 0, .31), .014, m.metal);
    for (let i = 0; i < 19; i++) w.beam(rack, v(-1 + i * .11, .02, -.3), v(-1 + i * .11, .02, .3), .005, m.dark);
    for (let i = 0; i < 7; i++) w.beam(rack, v(-1.02, .02, -.27 + i * .09), v(1.02, .02, -.27 + i * .09), .004, m.metal);
    if (bay < 3) {
      round(w, rack, [.64, .22, .34], [-.3, .13, 0], m.olive, .1);
      w.tube(rack, [v(-.49, .23, 0), v(-.3, .32, 0), v(-.11, .23, 0)], m.piping, .015);
      const roll = cylinder(w, rack, .105, .38, m.cloth, .43, .12, 0); roll.rotation.z = Math.PI / 2;
    }
    const label = w.text(room, `${13 + bay * 4}–${16 + bay * 4}`, '#574b35', .21, .08); label.position.set(.53, 1.7, z - 1.18);
    const ceilingLamp = group(room, .94, 2.52, z);
    round(w, ceilingLamp, [.34, .06, .52], [0, 0, 0], m.metal, .03);
    round(w, ceilingLamp, [.26, .045, .41], [0, -.04, 0], m.lamp, .05);
    for (const x of [-.1, .1]) w.beam(ceilingLamp, v(x, -.07, -.19), v(x, -.07, .19), .007, m.metal);
    for (let i = 0; i < 8; i++) w.box(room, [.025, .013, .2], [.48 + i * .09, 2.565, z - .8], m.dark);
  }
  // Near bay: table support and the lower wall's ribs, coat hooks, mesh pocket, reading light.
  round(w, room, [1.48, .055, 1.06], [-.99, .793, .05], m.wood, .028);
  for (const z of [-.31, .43]) w.beam(room, v(-1.73, .38, z), v(-.5, .76, z), .025, m.metal);
  round(w, room, [.075, .035, 1.72], [-1.79, .875, 0], m.wood, .008);
  for (let i = 0; i < 7; i++) round(w, room, [.07, .4, .08], [-1.81, .36, -.55 + i * .18], m.paint, .012);
  const sign = group(room, -.59, 1.63, -1.19);
  round(w, sign, [.56, .22, .025], [0, 0, 0], m.wood, .01);
  w.text(sign, 'НЕ КУРИТЬ', '#c4b28b', .48, .1).position.z = .02;
  const timetable = group(room, .32, 1.23, -1.18);
  round(w, timetable, [.25, .34, .03], [0, 0, 0], m.wood, .005);
  round(w, timetable, [.21, .3, .006], [0, 0, .02], m.cloth, .002);
  for (let i = 0; i < 6; i++) w.box(timetable, [.16 - (i % 3) * .02, .005, .004], [0, .11 - i * .04, .026], m.dark);
  for (const x of [-.3, 0]) w.tube(room, [v(x, 1.48, -1.17), v(x, 1.45, -1.08), v(x, 1.5, -1.07)], m.metal, .01);
  const pocket = group(room, -1.25, 1.35, -1.18);
  for (let i = 0; i < 10; i++) w.beam(pocket, v(-.19 + i * .04, -.14, .04), v(-.19 + i * .04, .14, 0), .0025, m.piping);
  for (let i = 0; i < 7; i++) w.beam(pocket, v(-.2, -.14 + i * .04, .04), v(.2, -.14 + i * .04, .04), .0025, m.piping);
  const magazine = w.box(pocket, [.23, .28, .012], [0, .06, .01], m.cloth); magazine.rotation.z = -.12;
  w.text(pocket, 'В ПУТИ', '#4d5d57', .18, .05).position.set(0, .13, .026);
  const reading = group(room, -1.65, 1.78, -1.16);
  w.mesh(new T.SphereGeometry(.075, 20, 14), m.brass, reading);
  const shade = w.mesh(new T.ConeGeometry(.08, .12, 24, 1, true), m.metal, reading, v(.08, -.04, .03)); shade.rotation.z = -.65;
  bake(room);
  cabinDetails(w, car, m);

  const tableThings = group(car); tableThings.name = 'train-table-things';
  trainMeal(w, tableThings, m);
  const tea = teaGlass(w, tableThings, m);
  const left = passengerHand(w, car, m, -1), right = passengerHand(w, car, m, 1);
  // Utensil stays on the table; the passenger no longer cycles a spoon or lifts the cup.
  const spoon = group(tableThings, -.89, .839, .24); spoon.name = 'train-resting-spoon';
  round(w, spoon, [.014, .006, .17], [0, 0, .04], m.metal, .003);
  const bowl = w.mesh(new T.SphereGeometry(.028, 24, 16, 0, TAU, 0, Math.PI / 2), m.metal, spoon, v(0, 0, -.06)); bowl.scale.set(.68, .2, 1.25); bowl.rotation.x = Math.PI;
  bake(spoon);
  const updateForest = forest(w, m, detail);
  if (detail) {
    // On the table: sugar cubes, a lemon slice in the tea's saucer, a folded newspaper.
    const sugar = w.metal('#f4f1e8', 0, .7);
    for (let i = 0; i < 4; i++) w.box(tableThings, [.022, .022, .022], [-.62 + (i % 2) * .026, .835 + Math.floor(i / 2) * .023, -.18 + (i % 3) * .01], sugar).rotation.y = i * .4;
    const lemon = w.mesh(new T.CylinderGeometry(.028, .028, .006, 20), w.metal('#f2d24a', 0, .45), tableThings, v(-.5, .826, .2)); lemon.rotation.x = .1;
    const paper = group(tableThings, -1.35, .83, -.25); paper.rotation.y = .5;
    w.box(paper, [.3, .012, .22], [0, 0, 0], w.metal('#ddd8c8', 0, .9));
    for (let i = 0; i < 6; i++) w.box(paper, [.12 - (i % 2) * .03, .002, .006], [-.06, .007, -.08 + i * .03], m.dark);
    w.box(paper, [.08, .002, .07], [.08, .007, -.03], w.metal('#8a8578', 0, .9));
  }
  const leftEnd = v(-1.02, .845, .46), rightEnd = v(-.34, .845, .46);
  // Stay in the passenger's seat on portrait screens too: backing into the next
  // bay exposes the arm roots and puts an unrelated upper berth across the view.
  const eyeBase = w.mobile ? v(0, 1.43, .95) : v(.18, 1.43, 1.28);
  const targetBase = w.mobile ? v(-1.1, .96, -.35) : v(-.37, 1.14, -1);
  w.eye.copy(eyeBase); w.target.copy(targetBase);
  w.camera.fov = w.mobile ? 100 : 67; w.camera.near = .025; w.camera.far = 150; w.camera.updateProjectionMatrix();
  const fromLeft = v(-.8, .73, 1.48), fromRight = v(.39, .73, 1.47);
  left.update(fromLeft, leftEnd); right.update(fromRight, rightEnd);
  let lookX = 0, lookY = 0, oldX = 0, oldY = 0, wasPressed = false;
  w.ticks.push((time, dt, p) => {
    dt = Math.min(dt, .05);
    const sway = Math.sin(time * 1.7) * .0018 + Math.sin(time * 13) * .0005;
    car.rotation.z = sway;
    if (p.pressed && wasPressed && w.c.cameraControls !== false && w.c.params.react > 0) {
      lookX = T.MathUtils.clamp(lookX + (p.rawX - oldX) / w.c.width * .9, -.28, .28);
      lookY = T.MathUtils.clamp(lookY - (p.rawY - oldY) / w.c.height * .6, -.15, .15);
    }
    oldX = p.rawX; oldY = p.rawY; wasPressed = p.pressed;
    w.camera.position.copy(eyeBase).add(v(sway * .65, Math.sin(time * 2.6) * .002, Math.sin(time * 1.1) * .001));
    w.camera.lookAt(targetBase.x + lookX, targetBase.y + lookY, targetBase.z);
    tea.steamMaterial.uniforms.time.value = time; tea.shader.uniforms.time.value = time;
    right.update(fromRight, rightEnd, time); left.update(fromLeft, leftEnd, time);
    updateForest(dt, time);
    if (detail) {
      // The sun flickers through the passing trees; the carriage light stays steady.
      const sun = (car.parent ? (w.root.getObjectByName('train-moving-forest')?.userData.sun as number | undefined) : 1) ?? 1;
      daylight.intensity += (1.3 * (.55 + .7 * sun) - daylight.intensity) * Math.min(1, dt * 14);
    }
  });
}
