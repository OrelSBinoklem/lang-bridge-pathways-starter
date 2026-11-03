import { T, TAU, v, type World } from './world';
import { cloud } from './props';
import { islandsDetail } from './islandsDetail';
import { backdrop, bake, books, cylinder, deck, group, lamp, person, plant, railing, round } from './storyKit';

function room(w: World, p: T.Object3D, color: string, y: number) {
  const g = group(p, 0, y), wood = w.metal('#ab805c', 0.1, 0.85), wall = w.metal(color, 0, 0.85), white = w.metal('#eadcbf', 0, 0.8);
  deck(w, g, 6.8, 3.3, '#ae865f'); w.box(g, [6.7, 2.95, 0.18], [0, 1.48, -1.6], wall);
  for (const x of [-3.3, 3.3]) w.box(g, [0.16, 2.95, 3.3], [x, 1.48, 0], wall);
  for (const y1 of [0.12, 2.8]) w.box(g, [6.6, 0.1, 0.08], [0, y1, -1.45], white);
  round(w, g, [1.7, 1.65, 0.08], [1.75, 1.7, -1.46], w.glass('#6d9dae', 0.8));
  for (const x of [0.88, 1.75, 2.62]) w.box(g, [0.065, 1.78, 0.13], [x, 1.7, -1.39], white);
  for (const y1 of [0.85, 1.7, 2.55]) w.box(g, [1.8, 0.065, 0.13], [1.75, y1, -1.39], white);
  w.box(g, [2, 0.1, 0.4], [1.75, 0.82, -1.3], wood);
  for (const x of [0.7, 2.78]) {
    const curtain = group(g, x, 2.6, -1.16), cloth = w.metal('#eed6bb', 0, 0.95);
    for (let i = 0; i < 6; i++) { const fold = cylinder(w, curtain, 0.055, 1.9, cloth, (i - 2.5) * 0.065, -0.95, 0); fold.scale.z = 0.4; }
    bake(curtain); w.ticks.push(t => { curtain.rotation.x = Math.sin(t * 0.8 + x) * 0.04; });
  }
  const shell = group(g); w.box(shell, [6.8, 0.15, 0.18], [0, 2.94, -1.48], wood); bake(shell); return g;
}
function cat(w: World, p: T.Object3D) {
  const g = group(p), fur = w.metal('#de9957', 0, 0.85), nose = w.metal('#4a3334');
  w.sphere(g, 0.27, [0, 0.28, 0], fur).scale.set(1.45, 0.75, 0.7); w.sphere(g, 0.19, [0.31, 0.4, 0], fur);
  for (const z of [-0.11, 0.11]) { const ear = w.mesh(new T.ConeGeometry(0.09, 0.17, 3), fur, g, v(0.34, 0.59, z)); ear.rotation.x = z; w.sphere(g, 0.025, [0.477, 0.44, z * 0.7], nose); }
  for (const x of [-0.2, 0.2]) for (const z of [-0.12, 0.12]) cylinder(w, g, 0.045, 0.2, fur, x, 0.13, z);
  const tail = group(g, -0.32, 0.3); w.tube(tail, [v(), v(-0.16, 0.2), v(-0.15, 0.52), v(0.04, 0.63)], fur, 0.047);
  w.ticks.push(t => { tail.rotation.x = Math.sin(t * 1.6) * 0.5; }); return g;
}
export function familyHouse(w: World) {
  backdrop(w, '#182c43', '#344749');
  const left = w.side(0, -2.9), right = w.side(1, -2.9);
  const wood = w.metal('#986648', 0.1, 0.7), cream = w.metal('#ecdab4', 0, 0.75), blue = w.metal('#487b88', 0, 0.9);
  const lounge = room(w, left, '#729b92', 0), kitchen = room(w, left, '#d6ad79', 3.1);
  const study = room(w, right, '#8b829e', 0), bedroom = room(w, right, '#829ba8', 3.1);
  // Downstairs living room: sofa cushions, rug, coffee table, TV and photographs.
  round(w, lounge, [2.6, 0.52, 0.95], [-1.4, 0.55, -0.5], blue, 0.17);
  round(w, lounge, [2.6, 0.85, 0.22], [-1.4, 0.93, -0.92], blue);
  for (const x of [-2.65, -0.15]) round(w, lounge, [0.24, 0.8, 1.05], [x, 0.77, -0.5], blue);
  for (const x of [-1.98, -0.83]) { const c = round(w, lounge, [0.75, 0.6, 0.18], [x, 1.05, -0.65], w.metal(x < -1 ? '#d6a45f' : '#bc6877', 0, 0.95)); c.rotation.z = 0.12; }
  w.box(lounge, [3.3, 0.015, 1.65], [-0.6, 0.045, 0.65], w.metal('#ca8371', 0, 1));
  round(w, lounge, [1.4, 0.12, 0.8], [-0.6, 0.59, 0.65], wood); for (const x of [-1.14, -0.06]) for (const z of [0.4, 0.9]) w.beam(lounge, v(x, 0.03, z), v(x, 0.53, z), 0.035, wood);
  books(w, lounge, 3, -0.97, 0.66, 0.63); cylinder(w, lounge, 0.09, 0.16, cream, -0.1, 0.73, 0.68);
  round(w, lounge, [1.6, 1, 0.15], [2.25, 1.35, 0.1], w.metal('#253440')); const tv = w.box(lounge, [1.4, 0.79, 0.018], [2.25, 1.35, 0.19], w.glow('#517a9a', 0.3));
  for (let i = 0; i < 5; i++) { const fish = w.sphere(lounge, 0.085, [2, 1.3, 0.21], w.metal(['#ffbc66', '#63cfd2'][i % 2])); fish.scale.set(1.7, 0.7, 0.15); w.ticks.push(t => { fish.position.x = 2.25 + Math.sin(t * 0.4 + i * 1.5) * 0.55; fish.position.y = 1.35 + Math.cos(t * 0.6 + i) * 0.27; }); }
  tv.castShadow = false;
  plant(w, lounge, 2.6, 0.06, 1.08, 1.1); const pet = cat(w, lounge); w.ticks.push(t => { pet.position.set(-1 + Math.sin(t * 0.16) * 1.4, 0.04, 1.3); pet.rotation.y = Math.cos(t * 0.16) > 0 ? 0 : Math.PI; });
  // Upstairs kitchen with tiles, brass taps, a simmering kettle and dining table.
  const cabinets = group(kitchen);
  for (let i = 0; i < 5; i++) { const x = -2.7 + i * 0.8; round(w, cabinets, [0.75, 0.85, 0.68], [x, 0.5, -0.96], cream); w.box(cabinets, [0.28, 0.025, 0.05], [x, 0.74, -0.59], wood); }
  w.box(cabinets, [4, 0.08, 0.83], [-1.1, 0.97, -0.92], wood);
  for (let x = 0; x < 14; x++) for (let y = 0; y < 3; y++) w.box(cabinets, [0.26, 0.26, 0.018], [-2.86 + x * 0.28, 1.2 + y * 0.28, -1.48], (x + y) % 2 ? cream : blue);
  bake(cabinets);
  w.tube(kitchen, [v(-0.2, 1, -1), v(-0.2, 1.5, -1), v(-0.2, 1.55, -0.8), v(-0.2, 1.35, -0.8)], w.metal('#c5ac7d'), 0.024);
  const kettle = w.sphere(kitchen, 0.23, [-1.85, 1.21, -0.8], w.metal('#c96a57')); kettle.scale.y = 0.8; w.ring(kitchen, 0.22, 0.025, wood, v(-1.85, 1.37, -0.8));
  const steam = w.glass('#e5ebdf', 0.14); for (let i = 0; i < 7; i++) { const puff = w.sphere(kitchen, 0.08, [-1.85, 1.5, -0.8], steam); w.ticks.push(t => { const u = (t * 0.24 + i / 7) % 1; puff.position.set(-1.85 + Math.sin(u * 5) * 0.12, 1.45 + u, -0.8); puff.scale.setScalar(Math.sin(u * Math.PI) * 1.9); }); }
  round(w, kitchen, [1.7, 0.1, 1], [1.3, 0.95, 0.6], wood); for (const x of [0.65, 1.95]) for (const z of [0.25, 0.95]) cylinder(w, kitchen, 0.035, 0.9, wood, x, 0.45, z);
  for (const x of [0.9, 1.7]) { cylinder(w, kitchen, 0.23, 0.035, cream, x, 1.02, 0.58); w.sphere(kitchen, 0.075, [x, 1.08, 0.6], w.metal('#d1a95a')); }
  const cook = person(w, kitchen, '#bc6e74', 1.2); cook.root.position.set(-0.5, 0.05, 0.1); cook.limbs[1].rotation.x = -0.9; w.ticks.push(t => { cook.limbs[3].rotation.x = -0.7 + Math.sin(t * 1.4) * 0.3; });
  // Study and children's attic contain different objects, rather than a mirrored room.
  for (let i = 0; i < 4; i++) { w.box(study, [2.2, 0.08, 0.5], [-1.7, 0.55 + i * 0.56, -1.13], wood); books(w, study, 14, -2.6, 0.59 + i * 0.56, -1.06); }
  round(w, study, [2.5, 0.12, 1], [1.2, 0.8, 0.5], wood); for (const x of [0.2, 2.2]) cylinder(w, study, 0.055, 0.8, wood, x, 0.4, 0.5);
  const laptop = group(study, 1.1, 0.9, 0.5); w.box(laptop, [0.75, 0.035, 0.55], [0, 0, 0], w.metal('#c2c8c4')); const lid = w.box(laptop, [0.75, 0.5, 0.035], [0, 0.24, -0.23], w.glow('#537fa2', 0.35)); lid.rotation.x = -0.15;
  const reader = person(w, study, '#bba157', 1.15); reader.root.position.set(-0.3, 0.06, 1); reader.limbs[1].rotation.x = -0.8;
  round(w, bedroom, [2.2, 0.45, 1.65], [-1.7, 0.42, 0], wood); round(w, bedroom, [2.1, 0.2, 1.55], [-1.7, 0.74, 0], cream);
  round(w, bedroom, [1.3, 0.15, 1.6], [-1.25, 0.89, 0], w.metal('#ca859b', 0, 0.95)); round(w, bedroom, [0.5, 0.22, 1.1], [-2.35, 0.94, 0], cream);
  for (let i = 0; i < 7; i++) { const cube = round(w, bedroom, [0.25, 0.25, 0.25], [0.3 + (i % 3) * 0.3, 0.16 + Math.floor(i / 3) * 0.25, 0.7], w.metal(['#d87773', '#8dbb81', '#d5b24d'][i % 3])); cube.rotation.y = i * 0.3; }
  const mobile = group(bedroom, 1.8, 2.65, 0); for (let i = 0; i < 5; i++) { const a = i * TAU / 5; w.beam(mobile, v(), v(Math.cos(a) * 0.7, 0, Math.sin(a) * 0.7), 0.01, wood); w.beam(mobile, v(Math.cos(a) * 0.7, 0, Math.sin(a) * 0.7), v(Math.cos(a) * 0.7, -0.5, Math.sin(a) * 0.7), 0.008, cream); w.mesh(new T.OctahedronGeometry(0.16), w.metal(['#ffbe65', '#7bcacc', '#d98eba'][i % 3]), mobile, v(Math.cos(a) * 0.7, -0.6, Math.sin(a) * 0.7)); } w.ticks.push(t => { mobile.rotation.y = t * 0.25; });
  for (const p of [left, right]) { const roof = w.mesh(new T.ConeGeometry(5, 2.2, 4), w.metal('#774b53', 0.2, 0.7), p, v(0, 7.05, -0.1)); roof.rotation.y = Math.PI / 4; roof.scale.z = 0.5; plant(w, p, -2.8, -0.1, 2, 1.05, true); }
}

function theatreMask(w: World, p: T.Object3D, color: string, mood: number) {
  const g = group(p), porcelain = w.metal(color, 0.25, 0.32), gold = w.metal('#e1b96d'), dark = w.metal('#26223c');
  // Sculpted face with cheek planes, separate brows, nose and articulated eyelids.
  w.sphere(g, 1.25, [0, 0.25, 0], porcelain).scale.set(0.85, 1.15, 0.42);
  w.sphere(g, 0.58, [0, -0.65, 0.03], porcelain).scale.set(1.05, 1, 0.6);
  const eyes: T.Mesh[] = [], brows: T.Group[] = [];
  for (const x of [-0.42, 0.42]) {
    const eye = w.sphere(g, 0.23, [x, 0.42, 0.49], dark); eye.scale.set(1.25, 0.46, 0.22); eyes.push(eye);
    const brow = group(g, x, 0.82, 0.57); w.tube(brow, [v(-0.23, -0.06), v(0, 0.035), v(0.23, -0.06)], gold, 0.032); brows.push(brow);
    w.sphere(g, 0.22, [x * 1.26, -0.08, 0.44], w.metal('#e49389', 0.1, 0.65)).scale.set(1, 0.5, 0.11);
  }
  w.mesh(new T.ConeGeometry(0.15, 0.55, 5), porcelain, g, v(0, 0.06, 0.65)).rotation.x = 0.5;
  const mouth = group(g, 0, -0.49, 0.6); w.tube(mouth, [v(-0.45, 0.06), v(0, -0.19 * mood), v(0.45, 0.06)], dark, 0.035);
  for (let i = 0; i < 8; i++) { const a = Math.PI * 0.08 + i / 7 * Math.PI * 0.84; const petal = w.mesh(new T.OctahedronGeometry(0.3, 1), gold, g, v(Math.cos(a) * 1.06, 0.47 + Math.sin(a) * 1.3, 0)); petal.scale.set(0.55, 1.6, 0.3); petal.rotation.z = a - Math.PI / 2; }
  w.ticks.push(t => { eyes.forEach((eye, i) => { const blink = Math.sin(t * 0.72 + mood + i * 0.07); eye.scale.y = blink > 0.985 ? 0.05 : 0.46; }); brows.forEach((b, i) => { b.rotation.z = (i ? -1 : 1) * (0.12 * mood + Math.sin(t * 0.6) * 0.07); }); mouth.scale.y = 0.8 + Math.sin(t * 0.7) * 0.25; });
  return g;
}
export function personalityTheatre(w: World) {
  backdrop(w, '#151024', '#392637');
  const red = w.metal('#682647', 0, 0.93), gold = w.metal('#cba15d'), wood = w.metal('#41293c', 0.2, 0.65);
  for (let side = 0; side < 2; side++) {
    const stage = w.side(side, -0.5); deck(w, group(stage, 0, -3.3), 7.5, 4.5, '#604148');
    const arch = group(stage); for (const x of [-3.25, 3.25]) { cylinder(w, arch, 0.18, 6.8, gold, x, 0); for (const y of [-3.2, 3.2]) cylinder(w, arch, 0.35, 0.16, gold, x, y); }
    w.tube(arch, [v(-3.25, 3), v(-2.7, 4.1), v(0, 4.5), v(2.7, 4.1), v(3.25, 3)], gold, 0.16);
    for (let i = 0; i < 14; i++) { const x = -3.1 + i * 0.48; const curtain = cylinder(w, arch, 0.28, 0.8 + Math.sin(i / 13 * Math.PI) * 0.7, red, x, 3.45, -0.8); curtain.scale.z = 0.5; }
    for (const x of [-2.85, 2.85]) for (let i = 0; i < 5; i++) cylinder(w, arch, 0.13, 5.7, red, x + (i - 2) * 0.17, -0.2, -0.4);
    bake(arch);
    const mount = group(stage, 0, 0.45, 0.2), mask = theatreMask(w, mount, side ? '#97c6d2' : '#efcc9d', side ? -1 : 1); mask.scale.setScalar(1.4);
    // Pendulum marionette support and strings are part of this scene's motion.
    w.beam(stage, v(-0.55, 3.4), v(-0.55, 2.3, 0.2), 0.012, gold); w.beam(stage, v(0.55, 3.4), v(0.55, 2.3, 0.2), 0.012, gold);
    w.ticks.push(t => { mount.rotation.y = Math.sin(t * 0.42 + side * 2) * 0.33; mount.rotation.z = Math.sin(t * 0.57 + side) * 0.09; });
    for (let i = 0; i < 4; i++) {
      const mini = theatreMask(w, stage, ['#b37dcc', '#ea8e77', '#6cb8a9', '#d2b267'][i], i % 2 ? 1 : -1); mini.scale.setScalar(0.43); mini.position.set(-2.15 + i * 1.43, -2.13, 0.8); mini.rotation.z = (i - 1.5) * 0.08;
      cylinder(w, stage, 0.4, 0.12, wood, mini.position.x, -3.04, 0.8);
    }
    w.text(stage, side ? 'SAPŅOTĀJS' : 'OPTIMISTS', '#e3c990', 4.3, 0.43).position.set(0, -3.1, 2.25);
    for (let i = 0; i < 11; i++) w.sphere(stage, 0.055, [-3 + i * 0.6, -3.07, 2.05], w.glow('#fbcf87', 1.6));
  }
}

function cottage(w: World, p: T.Object3D, color: string) {
  const g = group(p), wall = w.metal(color, 0, 0.85), roof = w.metal('#59777f', 0.2, 0.6), trim = w.metal('#e1cf9f', 0.1, 0.6);
  w.box(g, [1.45, 1.55, 1.3], [0, 0.77, 0], wall); const top = w.mesh(new T.ConeGeometry(1.23, 1.05, 4), roof, g, v(0, 2)); top.rotation.y = Math.PI / 4;
  w.box(g, [0.29, 0.85, 0.045], [0.35, 0.44, 0.68], w.metal('#594c46'));
  for (const x of [-0.43, 0.43]) { w.box(g, [0.36, 0.43, 0.04], [x, 1.15, 0.68], w.glow('#ffcb76', 0.5)); w.box(g, [0.035, 0.44, 0.06], [x, 1.15, 0.72], trim); }
  w.box(g, [0.28, 0.85, 0.32], [-0.5, 2.2, -0.2], wall);
  for (let i = 0; i < 3; i++) w.box(g, [0.85, 0.12, 0.25], [0.23, 0.06 + i * 0.1, 1 - i * 0.18], trim);
  bake(g); return g;
}
function island(w: World, p: T.Object3D, radius: number) {
  const g = group(p), rock = w.metal('#657975', 0.15, 0.85), grass = w.metal('#658b66', 0, 0.95);
  w.mesh(new T.CylinderGeometry(radius, radius * 0.75, 0.38, 28), grass, g);
  const stone = w.mesh(new T.ConeGeometry(radius * 0.92, radius * 1.5, 13, 4), rock, g, v(0, -radius * 0.72)); stone.rotation.z = Math.PI;
  for (let i = 0; i < 18; i++) { const a = i * 2.4; const shard = w.mesh(new T.DodecahedronGeometry(0.18 + w.c.rand() * 0.3), rock, g, v(Math.cos(a) * radius * 0.75, -w.c.rand() * radius, Math.sin(a) * radius * 0.75)); shard.scale.y = 1.8; }
  bake(g); return g;
}
export function islandVillage(w: World) {
  backdrop(w, '#245876', '#7ba8a1');
  const left = w.side(0, -0.7), right = w.side(1, -0.6), timber = w.metal('#77654c', 0.1, 0.8), white = w.metal('#ded7b1', 0.1, 0.75);
  island(w, left, 3.6); island(w, right, 3.3);
  for (let i = 0; i < 3; i++) { const home = cottage(w, left, ['#d69b6c', '#9eb597', '#cda47a'][i]); home.position.set(-2 + i * 1.85, 0.2, -0.5 + Math.sin(i * 2) * 0.45); }
  for (let i = 0; i < 6; i++) plant(w, left, -2.8 + i * 1.1, 0.2, 1.4, 0.6 + i % 2 * 0.25, i % 2 === 0);
  const mill = group(right, -0.9, 0.2, -0.6); w.mesh(new T.CylinderGeometry(0.65, 1, 2.8, 32), white, mill, v(0, 1.4)); w.mesh(new T.ConeGeometry(1, 1.2, 32), w.metal('#895e56'), mill, v(0, 3.4));
  const rotor = group(mill, 0, 2.65, 0.84); cylinder(w, rotor, 0.18, 0.3, timber).rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) { const arm = group(rotor); arm.rotation.z = i * Math.PI / 2; w.beam(arm, v(), v(0, 2.15), 0.045, timber); for (let k = 0; k < 8; k++) w.box(arm, [0.47, 0.08, 0.045], [0.18, 0.67 + k * 0.19, 0], white); }
  w.ticks.push(t => { rotor.rotation.z = -t * 0.42; });
  const lookout = group(right, 1.9, 0.2, 0.6); cylinder(w, lookout, 0.45, 2, white, 0, 1); cylinder(w, lookout, 0.58, 0.65, w.glass('#8ce4d2', 0.7), 0, 2.2); w.mesh(new T.ConeGeometry(0.72, 0.5, 24), timber, lookout, v(0, 2.8));
  const lens = group(lookout, 0, 2.2); w.box(lens, [0.5, 0.2, 0.18], [0, 0, 0], w.glow('#ffd881', 2)); w.ticks.push(t => { lens.rotation.y = t * 0.55; });
  for (const p of [left, right]) {
    railing(w, p, v(-2.3, 0.2, 2), v(2.3, 0.2, 2), '#c5b88d', 0.45);
    const water = w.glass('#93edee', 0.55); const waterfall = group(p, 1, 0, 2.2);
    for (let i = 0; i < 14; i++) { const strand = w.box(waterfall, [0.045, 3.2 + i % 3 * 0.3, 0.025], [-0.36 + i * 0.055, -1.7, 0], water); w.ticks.push(t => { strand.scale.y = 0.95 + Math.sin(t * 3 + i) * 0.05; }); }
    for (let i = 0; i < 22; i++) { const drop = w.sphere(waterfall, 0.035, [0, 0, 0], water); w.ticks.push(t => { const u = (t * 0.45 + i / 22) % 1; drop.position.set(Math.sin(i * 7) * 0.4, -u * 4.5, u * 0.22); drop.scale.set(1, 2, 1); }); }
    const mist = cloud(w, p, 1.5); mist.position.set(0, -3.7, -0.6);
  }
  // Bridge endpoints follow the two responsive anchors instead of being baked at desktop coordinates.
  const bridge = group(w.root); bridge.visible = !w.mobile;
  const plankGeo = new T.BoxGeometry(1, 0.065, 0.85), planks = new T.InstancedMesh(plankGeo, timber, 45); bridge.add(planks);
  const ropes = new T.InstancedMesh(new T.CylinderGeometry(0.023, 0.023, 1, 8), timber, 88 + 30); bridge.add(ropes);
  const d = new T.Object3D(), up = v(0, 1), start = v(), end = v(), a = v(), b = v();
  const point = (u: number, height: number, z: number) => start.clone().lerp(end, u).add(v(0, -Math.sin(u * Math.PI) * 1.05 + height, z));
  const rope = (idx: number, from: T.Vector3, to: T.Vector3) => { d.position.copy(from).add(to).multiplyScalar(0.5); d.quaternion.setFromUnitVectors(up, to.clone().sub(from).normalize()); d.scale.set(1, from.distanceTo(to), 1); d.updateMatrix(); ropes.setMatrixAt(idx, d.matrix); };
  w.ticks.push(() => {
    if (w.mobile) return;
    start.copy(left.position).add(v(2.65, 0.12, 0.85)); end.copy(right.position).add(v(-2.65, 0.12, 0.85));
    for (let i = 0; i < 45; i++) { const u = i / 44; d.position.copy(point(u, 0, 0)); d.quaternion.identity(); d.scale.set(start.distanceTo(end) / 45 * 0.94, 1, 1); d.updateMatrix(); planks.setMatrixAt(i, d.matrix); }
    let idx = 0;
    for (const z of [-0.41, 0.41]) { for (let i = 0; i < 44; i++) rope(idx++, a.copy(point(i / 44, 0.6, z)), b.copy(point((i + 1) / 44, 0.6, z))); for (let i = 0; i < 15; i++) rope(idx++, a.copy(point(i / 14, 0, z)), b.copy(point(i / 14, 0.6, z))); }
    planks.instanceMatrix.needsUpdate = true; ropes.instanceMatrix.needsUpdate = true;
  });
  for (let i = 0; i < 7; i++) { const bird = group(w.root); const a = w.box(bird, [0.3, 0.025, 0.1], [-0.15, 0, 0], timber), b = w.box(bird, [0.3, 0.025, 0.1], [0.15, 0, 0], timber); w.ticks.push(t => { bird.position.set(Math.sin(t * 0.14 + i * 0.42) * 13, 4.8 + Math.sin(t * 0.4 + i) * 0.7, -3); a.rotation.z = Math.sin(t * 5 + i) * 0.5; b.rotation.z = -a.rotation.z; }); }
  lamp(w, left, -2.4, 0.3, 1, 1.6); lamp(w, right, 2.6, 0.3, -0.8, 1.5);
  // 2026-10-30: the richer sky, rock, greenery and life (islandsDetail.ts).
  islandsDetail(w, left, right, [3.6, 3.3]);
}
