import { T, TAU, v, type World } from './world';
import { aircraft, cloud } from './props';
import { backdrop, bake, books, bunting, cylinder, deck, group, lamp, person, plant, railing, round, stars } from './storyKit';

function envelope(w: World, p: T.Object3D, color: string) {
  const e = group(p), paper = w.metal(color, 0, 0.7), ink = w.metal('#ac8072', 0.1, 0.6);
  round(w, e, [0.65, 0.43, 0.045], [0, 0, 0], paper, 0.025);
  w.beam(e, v(-0.3, 0.19, 0.028), v(0, -0.04, 0.028), 0.008, ink);
  w.beam(e, v(0.3, 0.19, 0.028), v(0, -0.04, 0.028), 0.008, ink);
  w.box(e, [0.1, 0.12, 0.01], [0.22, 0.08, -0.029], w.metal('#e46a7c'));
  bake(e); return e;
}
function postRobot(w: World, p: T.Object3D, color: string) {
  const g = group(p), shell = w.metal(color, 0.45, 0.3), brass = w.metal('#cfad77'), dark = w.metal('#172b39');
  const body = group(g);
  round(w, body, [1.35, 1.5, 0.95], [0, 0, 0], shell, 0.2);
  round(w, body, [1.08, 0.55, 0.06], [0, 0.23, 0.51], dark);
  for (const x of [-0.3, 0.3]) { w.sphere(body, 0.13, [x, 0.28, 0.57], w.glow('#b9ffff', 1.8)); w.ring(body, 0.18, 0.027, brass, v(x, 0.28, 0.56)); }
  w.tube(body, [v(-0.24, -0.14, 0.51), v(0, -0.25, 0.54), v(0.24, -0.14, 0.51)], brass, 0.023);
  cylinder(w, body, 0.055, 0.5, brass, 0, 0.95); w.sphere(body, 0.11, [0, 1.24, 0], w.glow('#ff6e82'));
  for (let i = 0; i < 5; i++) w.box(body, [0.11, 0.12, 0.02], [-0.4 + i * 0.2, -0.51, 0.51], brass);
  for (const x of [-0.38, 0.38]) { cylinder(w, body, 0.16, 0.45, brass, x, -0.96); round(w, body, [0.48, 0.2, 0.73], [x, -1.24, 0.1], dark); }
  bake(body);
  const arm = group(g, 0.77, 0.25); w.sphere(arm, 0.16, [0, 0, 0], brass);
  w.beam(arm, v(), v(0.45, 0.15), 0.1, shell); w.beam(arm, v(0.45, 0.15), v(0.64, 0.65), 0.09, shell);
  for (let i = 0; i < 3; i++) w.beam(arm, v(0.64 + i * 0.08, 0.65), v(0.61 + i * 0.11, 0.91), 0.025, brass);
  bake(arm); w.ticks.push(t => { arm.rotation.z = Math.sin(t * 2.5) * 0.23; g.position.y = Math.sin(t * 1.1) * 0.09; }); return g;
}
export function helloPost(w: World) {
  backdrop(w, '#102249', '#253443'); stars(w, 130);
  const left = w.side(0, -0.6), right = w.side(1, -0.3);
  const cream = w.metal('#e5ccb1', 0.2, 0.65), red = w.metal('#c55d67', 0.4), brass = w.metal('#ceaa72');
  // A postal dock, not a second copy of the destination airship.
  const dock = group(left, 0, -2.1); deck(w, dock, 7.4, 3.3, '#48747a');
  const office = group(dock, -1.2, 0, -0.7);
  round(w, office, [3.6, 2.9, 1.8], [0, 1.45, 0], cream);
  w.box(office, [3.9, 0.18, 2], [0, 2.98, 0], red);
  for (let i = 0; i < 4; i++) { round(w, office, [0.52, 1.2, 0.07], [-1.22 + i * 0.81, 1.6, 0.94], w.glass('#69bdd2', 0.7)); w.box(office, [0.58, 0.04, 0.05], [-1.22 + i * 0.81, 1.6, 1], brass); }
  w.text(office, 'SVEIKI! • PASTS', '#424c5b', 3.3, 0.42).position.set(0, 2.62, 0.95);
  const mail = group(dock, 2.7, 0.6, 0.7); round(w, mail, [0.8, 1.15, 0.7], [0, 0, 0], red); w.box(mail, [0.58, 0.09, 0.03], [0, 0.19, 0.37], w.metal('#152639')); w.text(mail, '✉', '#ffe6ad', 0.4, 0.35).position.set(0, -0.2, 0.37);
  const robot = postRobot(w, dock, '#58c9c5'); robot.position.set(0.8, 1.3, 0.9);
  // Preserve dock-relative vertical placement while the robot gently bobs.
  w.ticks.push(t => { robot.position.y = 1.3 + Math.sin(t * 1.1) * 0.09; });
  lamp(w, dock, -3.3, 0, 0.7); plant(w, dock, -2.8, 0, 0.9, 0.85, true);
  bunting(w, left, v(-3.5, 3.8), v(3.5, 3.5), 12);
  const ship = group(right, 0, 1.8), hull = group(ship);
  w.sphere(hull, 1, [0, 0, 0], w.metal('#d7b17d', 0.5, 0.4)).scale.set(3.5, 1.25, 1.3);
  for (let i = -3; i <= 3; i++) { const r = Math.sqrt(Math.max(0.05, 1 - (i / 3.5) ** 2)); const ring = w.ring(hull, 1.29 * r, 0.023, brass, v(i, 0, 0)); ring.rotation.y = Math.PI / 2; }
  w.text(hull, 'HELLO, WORLD', '#474464', 3.2, 0.46).position.set(0, 0, 1.34);
  round(w, hull, [2.65, 0.78, 0.9], [0, -1.85, 0], w.metal('#497c8a'));
  for (const x of [-0.95, 0, 0.95]) { w.beam(hull, v(x, -0.85, 0), v(x, -1.6, 0), 0.028, brass); round(w, hull, [0.48, 0.35, 0.03], [x, -1.75, 0.47], w.glass('#9ad9e1', 0.8)); }
  const tail = w.mesh(new T.ConeGeometry(0.9, 1.2, 3), red, hull, v(3, 0.7)); tail.rotation.z = -Math.PI / 2;
  bake(hull);
  for (const x of [-1.2, 1.2]) { const prop = group(ship, x, -1.6, 0.9); w.sphere(prop, 0.13, [0, 0, 0], brass); for (let i = 0; i < 3; i++) { const blade = round(w, prop, [0.1, 0.85, 0.04], [0, 0, 0], brass); blade.rotation.z = i * TAU / 3; } w.ticks.push(t => { prop.rotation.z = t * 9; }); }
  const basket = group(right, 0, -2.5); deck(w, basket, 6.8, 3); const receiver = postRobot(w, basket, '#eab057'); receiver.position.x = -1;
  w.ticks.push(t => { receiver.position.y = 1.3 + Math.sin(t * 1.1 + 2) * 0.08; ship.position.y = 1.8 + Math.sin(t * 0.6) * 0.22; ship.rotation.z = Math.sin(t * 0.3) * 0.035; });
  for (let i = 0; i < 7; i++) { const e = envelope(w, basket, i % 2 ? '#f3d6b1' : '#8ddad2'); e.position.set(1.6, 0.22 + i * 0.11, 0.5); e.rotation.x = -Math.PI / 2; e.rotation.z = i * 0.08; }
  // Letters travel between the actual responsive anchors, including on a portrait screen.
  for (let i = 0; i < 9; i++) { const letter = envelope(w, w.root, i % 2 ? '#ffe4ae' : '#a9e5df'); w.ticks.push(t => { const u = (t * 0.047 + i / 9) % 1; letter.position.copy(left.position).lerp(right.position, u).add(v(0, 3.9 + Math.sin(u * Math.PI) * 1.3, -2)); letter.rotation.set(Math.sin(t + i) * 0.2, Math.sin(u * TAU) * 0.3, Math.sin(t * 1.5 + i) * 0.13); }); }
  for (const p of [left, right]) { const c = cloud(w, p, 1.5); c.position.set(0, -3.3, -0.5); }
}

function trolley(w: World, p: T.Object3D, color: string) {
  const g = group(p), shell = w.metal(color, 0.45, 0.3), dark = w.metal('#173744'), silver = w.metal('#c2ccd0');
  round(w, g, [2.7, 0.85, 0.85], [0, 0.58, 0], shell);
  for (const z of [-0.44, 0.44]) {
    for (let i = 0; i < 6; i++) round(w, g, [0.31, 0.32, 0.025], [-1.05 + i * 0.42, 0.76, z], dark, 0.025);
    for (const x of [-0.9, 0.8]) { const wheel = cylinder(w, g, 0.21, 0.1, dark, x, 0.2, z); wheel.rotation.x = Math.PI / 2; w.ring(g, 0.1, 0.028, silver, v(x, 0.2, z * 1.14)); }
    w.box(g, [2.6, 0.05, 0.026], [0, 0.45, z], silver);
  }
  w.box(g, [0.027, 0.36, 0.65], [1.36, 0.75, 0], dark);
  for (const z of [-0.3, 0.3]) w.sphere(g, 0.058, [1.38, 0.45, z], w.glow('#ffe6b4', 2));
  for (const z of [-0.2, 0.2]) w.beam(g, v(0.2, 1.02, z), v(-0.8, 1.8, z), 0.018, silver);
  bake(g); return g;
}
export function transitCity(w: World) {
  backdrop(w, '#123751', '#547c8a');
  const left = w.side(0, -2), right = w.side(1, -2.6), concrete = w.metal('#b4b4a4', 0.1, 0.85), red = w.metal('#be6951', 0.15, 0.6), dark = w.metal('#253f4b');
  const bridge = group(left); deck(w, bridge, 8.3, 3.8, '#767e77');
  w.box(bridge, [8.1, 0.04, 1.85], [0, 0.04, 0], w.metal('#37454b', 0.1, 0.85));
  for (let i = -6; i <= 6; i++) w.box(bridge, [0.35, 0.012, 0.06], [i * 0.62, 0.068, 0], concrete);
  for (const x of [-3, 0, 3]) { w.box(bridge, [0.6, 2.8, 2.5], [x, -1.55, 0], concrete); w.box(bridge, [1.2, 0.22, 2.9], [x, -2.85, 0], dark); }
  for (const z of [-1.7, 1.7]) railing(w, bridge, v(-4, 0, z), v(4, 0, z), '#536b72', 0.65);
  for (const x of [-3.7, 0, 3.7]) { lamp(w, bridge, x, 0, -1.4, 2.5); w.beam(bridge, v(x, 2.1, -1.4), v(x, 2.1, 0.65), 0.023, dark); }
  for (const z of [-0.65, -0.25]) w.beam(bridge, v(-4.4, 2.1, z), v(4.4, 2.1, z), 0.012, dark);
  const bus = trolley(w, bridge, '#e7a13e'); w.ticks.push(t => { bus.position.set(Math.sin(t * 0.23) * 2.65, 0.2, -0.45); bus.rotation.y = Math.cos(t * 0.23) < 0 ? Math.PI : 0; });
  for (let i = 0; i < 5; i++) { const human = person(w, bridge, ['#e57164', '#75bdb5', '#d4b454'][i % 3], 0.63); w.ticks.push(t => { human.root.position.set(((t * 0.22 + i * 1.6) % 7.6) - 3.8, 0.12, 1.22); human.root.rotation.y = Math.PI / 2; human.walk(t + i); }); }
  for (let i = 0; i < 3; i++) {
    const home = group(left, -2.6 + i * 2.5, 0, -3); w.box(home, [2, 2.9 + i * 0.7, 1.5], [0, 1.45 + i * 0.35, 0], w.metal(['#bd7e61', '#e0b473', '#679b93'][i], 0.1, 0.8));
    const roof = w.mesh(new T.ConeGeometry(1.65, 1.2, 4), red, home, v(0, 3.5 + i * 0.7)); roof.rotation.y = Math.PI / 4; roof.scale.z = 0.75;
    for (let r = 0; r < 3; r++) for (const x of [-0.5, 0.5]) { w.box(home, [0.55, 0.55, 0.07], [x, 0.7 + r * 0.9, 0.8], dark); w.box(home, [0.04, 0.55, 0.09], [x, 0.7 + r * 0.9, 0.85], concrete); }
    bake(home);
  }
  deck(w, right, 8, 4.3, '#4f6671');
  const terminal = group(right, -1.2, 0, -1.1); round(w, terminal, [4.4, 1.65, 1.7], [0, 0.85, 0], concrete);
  for (let i = 0; i < 8; i++) w.box(terminal, [0.43, 1, 0.035], [-1.89 + i * 0.54, 0.9, 0.88], w.glass('#4d96af', 0.72));
  w.text(terminal, 'RĪGA • AIRPORT', '#fbe0a8', 3.8, 0.4).position.set(0, 1.92, 0.9);
  cylinder(w, right, 0.38, 3.5, concrete, 2.3, 1.75, -1.2); cylinder(w, right, 0.83, 0.7, w.glass('#55b3cc', 0.85), 2.3, 3.6, -1.2); cylinder(w, right, 0.95, 0.12, dark, 2.3, 4.02, -1.2);
  const radar = group(right, 2.3, 4.3, -1.2); w.box(radar, [1.15, 0.25, 0.08], [0, 0, 0], concrete); w.ticks.push(t => { radar.rotation.y = t * 0.8; });
  for (let i = 0; i < 14; i++) for (const z of [0.4, 1.9]) w.sphere(right, 0.035, [-3.8 + i * 0.58, 0.08, z], w.glow('#8bdef4', 1.4));
  const jet = aircraft(w, right); jet.scale.setScalar(2.3);
  for (let i = 0; i < 7; i++) w.sphere(jet, 0.034, [-0.4 + i * 0.15, 0.06, 0.13], dark);
  w.ticks.push(t => { const u = ((t + 2) % 18) / 18; jet.position.set(-3 + u * 7, 0.55 + Math.max(0, u - 0.45) ** 2 * 15, 1); jet.rotation.z = Math.max(0, Math.sin(u * Math.PI)) * 0.14; jet.scale.setScalar(2.3 * (u > 0.88 ? (1 - u) / 0.12 : u < 0.1 ? u / 0.1 : 1)); });
  for (let i = 0; i < 3; i++) { const c = cloud(w, w.root, 1.5); c.position.set((i - 1) * 11, 5.5 + i * 0.4, -8); w.ticks.push(t => { c.position.x = (i - 1) * 11 + Math.sin(t * 0.06 + i) * 2; }); }
}

function shopShell(w: World, p: T.Object3D, color: string, title: string) {
  const g = group(p), wall = w.metal(color, 0.15, 0.75), trim = w.metal('#e7c99f', 0.25, 0.5), dark = w.metal('#202e3b');
  w.box(g, [6.4, 6.1, 0.35], [0, 0.7, -1.65], wall);
  for (const x of [-3.1, 3.1]) { w.box(g, [0.36, 6.2, 2.6], [x, 0.7, -0.4], wall); for (const y of [-2.3, 0.5, 3.7]) w.box(g, [0.55, 0.2, 2.85], [x, y, -0.4], trim); }
  w.box(g, [6.6, 0.2, 2.8], [0, 0.5, -0.4], trim); w.box(g, [6.6, 0.25, 2.8], [0, 3.75, -0.4], trim);
  for (let i = 0; i < 4; i++) { const x = -2.25 + i * 1.5; round(w, g, [0.9, 1.3, 0.08], [x, 2.65, -1.4], dark); w.box(g, [1.05, 0.14, 0.38], [x, 1.92, -1.22], trim); w.box(g, [0.055, 1.25, 0.06], [x, 2.65, -1.33], trim); }
  w.text(g, title, '#ffe9b3', 5.8, 0.55).position.set(0, 0.95, 1.06);
  for (let i = 0; i < 16; i++) { const a = w.box(g, [0.4, 0.09, 1.2], [-3 + i * 0.4, 0.32, 1.12], i % 2 ? trim : wall); a.rotation.x = 0.18; }
  bake(g); return g;
}
export function shoppingPassage(w: World) {
  backdrop(w, '#191630', '#3c273b');
  const left = w.side(0, -0.1), right = w.side(1, 0.1);
  const wood = w.metal('#6c4542', 0.1, 0.7), gold = w.metal('#d6b273'), cream = w.metal('#ede0bd', 0.1, 0.6);
  shopShell(w, left, '#357778', 'GRĀMATAS & ZIEDI'); shopShell(w, right, '#97577a', 'ATELIER • 07');
  for (const p of [left, right]) { const pavement = group(p, 0, -2.45, 0.2); deck(w, pavement, 7.5, 4.5, '#74666d'); lamp(w, pavement, -3.4, 0, 1.7, 3.6); plant(w, pavement, 3, 0, 1.5, 1.2, true); }
  // Bookshop: three stocked shelves, reading chair, flower crates and a rolling ladder.
  const shelves = group(left, -1.35, -2.15, -0.45);
  for (let r = 0; r < 4; r++) { w.box(shelves, [2.9, 0.09, 0.6], [0, r * 0.61, 0], wood); books(w, shelves, 18, -1.2, r * 0.61 + 0.05, 0.05); }
  for (const x of [-1.43, 1.43]) w.box(shelves, [0.12, 2.7, 0.6], [x, 1.25, 0], wood);
  const ladder = group(left, -2.7, -2.25, 0.45); for (const x of [-0.22, 0.22]) w.beam(ladder, v(x, 0, 0.2), v(x, 2.7, -0.35), 0.035, gold); for (let i = 0; i < 9; i++) w.beam(ladder, v(-0.22, i * 0.3, 0.2 - i * 0.061), v(0.22, i * 0.3, 0.2 - i * 0.061), 0.025, gold); bake(ladder);
  w.ticks.push(t => { ladder.position.x = -1.7 + Math.sin(t * 0.18) * 0.9; });
  for (let i = 0; i < 6; i++) plant(w, left, 1.2 + (i % 2) * 0.7, -2.3 + Math.floor(i / 2) * 0.42, 0.5 - Math.floor(i / 2) * 0.55, 0.95, true);
  const customer = person(w, left, '#d09357', 1.1); customer.root.position.set(0.4, -2.3, 1.7); customer.limbs[1].rotation.x = -0.9; books(w, customer.root, 1, 0.18, 0.57, 0.24);
  // Atelier: dress form on a turntable, clothes rail, sewing machine and moving fabric.
  const mannequin = group(right, -1.45, -1.1, 0.05); cylinder(w, mannequin, 0.75, 0.1, gold, 0, -1.15);
  cylinder(w, mannequin, 0.05, 0.9, gold, 0, -0.65);
  const dress = w.metal('#d4678e', 0.15, 0.45);
  w.mesh(new T.LatheGeometry([new T.Vector2(0.68, -0.55), new T.Vector2(0.55, -0.3), new T.Vector2(0.28, 0.4), new T.Vector2(0.39, 0.75), new T.Vector2(0.2, 1.03)], 48), dress, mannequin);
  w.sphere(mannequin, 0.14, [0, 1.13, 0], cream); w.ring(mannequin, 0.29, 0.025, gold, v(0, 0.39)).rotation.x = Math.PI / 2;
  for (let i = 0; i < 12; i++) w.beam(mannequin, v(Math.cos(i * TAU / 12) * 0.27, 0.36, Math.sin(i * TAU / 12) * 0.27), v(Math.cos(i * TAU / 12) * 0.66, -0.52, Math.sin(i * TAU / 12) * 0.66), 0.009, gold);
  w.ticks.push(t => { mannequin.rotation.y = t * 0.28; });
  const rack = group(right, 1.5, -2.2, -0.8);
  for (const x of [-0.9, 0.9]) cylinder(w, rack, 0.035, 2.4, gold, x, 1.2); w.beam(rack, v(-0.9, 2.4), v(0.9, 2.4), 0.035, gold);
  for (let i = 0; i < 6; i++) { const x = -0.7 + i * 0.28, material = w.metal(['#668bc9', '#d66c83', '#c7a96a'][i % 3], 0, 0.8); const coat = group(rack, x, 1.55); w.box(coat, [0.09, 0.94, 0.48], [0, 0, 0], material); w.beam(coat, v(0, 0.8), v(0, 0.5, 0.26), 0.018, gold); w.beam(coat, v(0, 0.8), v(0, 0.5, -0.26), 0.018, gold); }
  const table = group(right, 1.2, -1.38, 1.1); w.box(table, [2.2, 0.12, 1], [0, 0, 0], wood); for (const x of [-0.9, 0.9]) for (const z of [-0.35, 0.35]) w.box(table, [0.07, 0.85, 0.07], [x, -0.47, z], gold);
  round(w, table, [0.83, 0.53, 0.22], [0, 0.39, 0], cream); w.box(table, [0.47, 0.25, 0.25], [-0.1, 0.23, 0.04], wood);
  const flywheel = w.ring(table, 0.22, 0.045, gold, v(0.47, 0.44)); w.ticks.push(t => { flywheel.rotation.z = t * 4; });
  const needle = w.box(table, [0.025, 0.17, 0.025], [-0.26, 0.18, 0.18], gold); w.ticks.push(t => { needle.position.y = 0.2 + Math.sin(t * 19) * 0.06; });
  w.box(table, [1.2, 0.018, 0.6], [-0.3, 0.085, 0.18], dress); cylinder(w, table, 0.09, 0.28, dress, 0.2, 0.82);
  bunting(w, left, v(-3, 4.2), v(3, 4.2)); bunting(w, right, v(-3, 4.2), v(3, 4.2));
  for (const p of [left, right]) {
    const sign = group(p, 2.7, 3, 0.5); w.beam(sign, v(-0.25, 0.6, -1), v(-0.25, 0.6, 0.6), 0.04, gold); round(w, sign, [0.85, 1.2, 0.12], [0, -0.1, 0.5], wood); w.text(sign, 'OPEN', '#ffb1c4', 0.7, 0.3).position.set(0, -0.1, 0.58); w.ticks.push(t => { sign.rotation.x = Math.sin(t * 0.8) * 0.05; });
  }
}
