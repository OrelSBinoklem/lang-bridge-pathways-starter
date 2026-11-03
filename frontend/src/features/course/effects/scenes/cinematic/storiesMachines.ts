import { T, TAU, v, type World } from './world';
import { gear } from './props';
import { backdrop, bake, cylinder, deck, group, railing, round, stars } from './storyKit';

export function orbitalAcademy(w: World) {
  backdrop(w, '#050a20', '#132338'); stars(w, 400);
  const left = w.side(0, -2.7), right = w.side(1, 0.1);
  const white = w.metal('#d5dedc', 0.45, 0.35), steel = w.metal('#546b80'), gold = w.metal('#bd8c49'), dark = w.metal('#173143');
  const pad = group(left); deck(w, pad, 7.6, 4.5, '#465363');
  for (const x of [-2.9, 2.9]) { round(w, pad, [1.2, 0.6, 2.2], [x, 0.4, 0], steel); for (let i = 0; i < 5; i++) { const stripe = w.box(pad, [0.09, 0.48, 0.025], [x - 0.4 + i * 0.2, 0.4, 1.12], gold); stripe.rotation.z = -0.3; } }
  const tower = group(left, -2.5, 0, -1.2);
  for (const x of [-0.48, 0.48]) for (const z of [-0.4, 0.4]) w.beam(tower, v(x, 0, z), v(x, 6.1, z), 0.065, steel);
  for (let i = 0; i < 9; i++) { const y = i * 0.65; w.box(tower, [1.2, 0.09, 1.1], [0, y, 0], steel); for (const z of [-0.4, 0.4]) w.beam(tower, v(-0.48, y, z), v(0.48, y + 0.65, z), 0.028, gold); }
  for (let i = 0; i < 27; i++) w.beam(tower, v(-0.21, i * 0.21, 0.56), v(0.21, i * 0.21, 0.56), 0.016, white);
  for (const x of [-0.22, 0.22]) w.beam(tower, v(x, 0, 0.56), v(x, 5.7, 0.56), 0.016, white);
  bake(tower);
  const arms: T.Group[] = [];
  for (const y of [1.9, 3.5, 5.2]) { const arm = group(left, -2.02, y, -0.8); w.box(arm, [1.7, 0.15, 0.45], [0.8, 0, 0], gold); w.beam(arm, v(0, 0.1), v(1.6, 0.65), 0.03, steel); arms.push(arm); }
  for (const z of [-1.4, 1.2]) w.tube(pad, [v(-3.5, 0.4, z), v(-2, 0.9, z), v(-0.8, 0.45, z), v(-0.5, 0.6, 0)], steel, 0.07);
  const rocket = group(left, 0.45, 0.4), shell = group(rocket);
  cylinder(w, shell, 0.54, 3.9, white, 0, 2.55); w.mesh(new T.ConeGeometry(0.54, 1.25, 48), white, shell, v(0, 5.12));
  for (const y of [0.8, 1.35, 3.6, 4.45]) cylinder(w, shell, 0.554, 0.13, dark, 0, y);
  for (let i = 0; i < 8; i++) w.box(shell, [0.09, 0.38, 0.025], [Math.sin(i * TAU / 8) * 0.54, 3.9, Math.cos(i * TAU / 8) * 0.54], dark).rotation.y = i * TAU / 8;
  w.text(shell, 'A1 → C2', '#284757', 0.85, 0.32).position.set(0, 2.7, 0.56);
  for (const x of [-0.88, 0.88]) { cylinder(w, shell, 0.24, 2.5, white, x, 1.7); w.mesh(new T.ConeGeometry(0.24, 0.65, 32), white, shell, v(x, 3.27)); w.mesh(new T.ConeGeometry(0.31, 0.38, 24, 1, true), steel, shell, v(x, 0.32)).rotation.z = Math.PI; }
  for (let i = 0; i < 4; i++) { const fin = group(shell); fin.rotation.y = i * TAU / 4; const shape = new T.Shape(); shape.moveTo(0.45, 0.6); shape.lineTo(1.05, 0.4); shape.lineTo(0.53, 1.75); shape.closePath(); w.mesh(new T.ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: false }), gold, fin); }
  w.mesh(new T.ConeGeometry(0.43, 0.55, 40, 1, true), steel, shell, v(0, 0.31)).rotation.z = Math.PI; bake(shell);
  const flame = group(rocket, 0, 0); for (let i = 0; i < 3; i++) { const f = w.mesh(new T.ConeGeometry(0.29 - i * 0.06, 1.9 - i * 0.2, 32), w.glow(i ? '#93eaff' : '#f5ba6a', 2.2), flame, v(0, -0.8 + i * 0.07)); f.rotation.z = Math.PI; }
  const smoke: T.Mesh[] = []; const vapor = w.glass('#c6d5df', 0.22);
  for (let i = 0; i < (w.mobile ? 12 : 28); i++) smoke.push(w.sphere(pad, 0.3, [0, 0, 0], vapor));
  const countdown = group(pad, 2.65, 1.3, 1.2); round(w, countdown, [1.6, 1.05, 0.13], [0, 0, 0], dark);
  const labels = ['03', '02', '01', 'GO'].map(s => { const m = w.text(countdown, s, '#f6c97c', 1.15, 0.61); m.position.z = 0.08; return m; });
  w.ticks.push(t => {
    const phase = t % 24, lift = Math.max(0, phase - 6), onPad = phase < 6;
    rocket.position.y = 0.4 + Math.min(18, lift * lift * 0.12); rocket.visible = phase < 18;
    rocket.rotation.z = onPad ? 0 : Math.sin(t * 23) * 0.002;
    arms.forEach(a => { a.rotation.y = -Math.min(1, Math.max(0, phase - 3) / 3) * 1.45; });
    flame.visible = phase > 4 && phase < 18; flame.scale.y = 1 + Math.sin(t * 31) * 0.16;
    labels.forEach((label, i) => { label.visible = i === (phase < 2 ? 0 : phase < 4 ? 1 : phase < 6 ? 2 : 3); });
    smoke.forEach((p, i) => { const u = (t * 0.23 + i / smoke.length) % 1, a = i * 2.4; p.visible = phase > 3 && phase < 15; p.position.set(0.45 + Math.cos(a) * u * 3, 0.16 + u * 0.6, Math.sin(a) * u * 2); p.scale.setScalar(Math.sin(u * Math.PI) * 1.6); });
  });
  // Orbital destination: pressurised modules, segmented solar wings and an EVA astronaut.
  const station = group(right); station.rotation.set(0.15, -0.25, -0.15);
  const hub = cylinder(w, station, 0.75, 3.1, white); hub.rotation.z = Math.PI / 2;
  for (const x of [-1.5, 1.5]) { const port = cylinder(w, station, 0.54, 0.25, steel, x); port.rotation.z = Math.PI / 2; w.ring(station, 0.4, 0.08, gold, v(x, 0, 0)).rotation.y = Math.PI / 2; }
  const panelMat = w.metal('#173d85', 0.55, 0.27), gridMat = w.metal('#7488ad');
  for (const side of [-1, 1]) {
    const wing = group(station, side * 2.1, 0); w.beam(wing, v(-0.4, 0), v(0.4, 0), 0.075, steel);
    for (const row of [-1, 1]) { const panel = group(wing, 0, row * 1.7); w.box(panel, [1.5, 2.7, 0.06], [0, 0, 0], panelMat); for (let i = 0; i < 13; i++) w.box(panel, [1.48, 0.018, 0.012], [0, -1.2 + i * 0.2, 0.04], gridMat); for (let i = 0; i < 5; i++) w.box(panel, [0.017, 2.7, 0.012], [-0.6 + i * 0.3, 0, 0.04], gridMat); bake(panel); }
    w.ticks.push(t => { wing.rotation.y = Math.sin(t * 0.11) * 0.22; });
  }
  round(w, station, [1.25, 0.55, 1.3], [0, 0.55, 0], white); w.box(station, [1.5, 0.065, 1.5], [0, 1, 0], dark).rotation.y = Math.PI / 4;
  w.tube(station, [v(0.6, 1.1, 0), v(0.9, 1.05, 0), v(0.95, 0.5, 0)], gold, 0.035);
  const dish = w.mesh(new T.SphereGeometry(0.75, 32, 16, 0, TAU, 0, 0.8), white, station, v(-0.3, -1.4)); dish.rotation.z = Math.PI; w.beam(station, v(0, -0.3), v(-0.3, -1.4), 0.06, steel);
  const astronaut = group(right, 2.9, 1.6, 1.7), suit = group(astronaut); round(w, suit, [0.48, 0.6, 0.35], [0, 0, 0], white); round(w, suit, [0.42, 0.57, 0.2], [0, 0, -0.27], steel);
  w.sphere(suit, 0.29, [0, 0.54, 0], white); w.sphere(suit, 0.25, [0, 0.55, 0.1], w.metal('#c89e51', 0.85, 0.18)).scale.set(0.88, 0.75, 0.8);
  for (const x of [-0.17, 0.17]) { w.beam(suit, v(x, -0.22), v(x * 1.5, -0.73, 0.12), 0.11, white); round(w, suit, [0.22, 0.16, 0.35], [x * 1.5, -0.8, 0.2], white); }
  w.beam(suit, v(-0.27, 0.2), v(-0.6, 0.4), 0.1, white); w.beam(suit, v(0.27, 0.2), v(0.53, -0.08), 0.1, white); bake(suit);
  w.tube(right, [v(0.8, 0), v(1.7, 0.2, 1), v(1.6, 1.7, 1.4), v(2.8, 1.6, 1.4)], gold, 0.018);
  w.ticks.push(t => { station.rotation.y = -0.25 + Math.sin(t * 0.13) * 0.17; astronaut.rotation.z = Math.sin(t * 0.4) * 0.13; });
  railing(w, pad, v(-3.7, 0, 1.95), v(-1, 0, 1.95));
}

function mechanicalDragon(w: World, p: T.Object3D) {
  const g = group(p), copper = w.metal('#a86645', 0.7, 0.34), brass = w.metal('#ceac68'), dark = w.metal('#33434c');
  const fixed = group(g);
  w.sphere(fixed, 0.8, [0, 0, 0], copper).scale.set(1.5, 0.65, 0.65);
  for (let i = 0; i < 7; i++) w.ring(fixed, 0.58 - Math.abs(i - 3) * 0.05, 0.045, brass, v(-0.9 + i * 0.3, 0, 0)).rotation.y = Math.PI / 2;
  w.tube(fixed, [v(0.8, 0), v(1.4, 0.5), v(1.5, 1.35), v(2.1, 1.55)], copper, 0.27);
  round(w, fixed, [0.9, 0.4, 0.4], [2.25, 1.54, 0], copper); for (const z of [-0.22, 0.22]) { w.sphere(fixed, 0.08, [2.05, 1.72, z], w.glow('#91e6d5', 2)); w.mesh(new T.ConeGeometry(0.09, 0.5, 8), brass, fixed, v(1.8, 1.95, z)).rotation.z = 0.35; }
  w.tube(fixed, [v(-0.8, 0), v(-1.7, -0.2), v(-2.4, 0.1), v(-2.8, 0.65)], copper, 0.12);
  for (const x of [-0.6, 0.6]) for (const z of [-0.35, 0.35]) { w.beam(fixed, v(x, -0.25, z), v(x - 0.2, -0.9, z * 1.6), 0.09, brass); w.box(fixed, [0.5, 0.12, 0.3], [x - 0.07, -0.96, z * 1.6], dark); }
  bake(fixed);
  for (const side of [-1, 1]) {
    const wing = group(g, -0.25, 0.3, side * 0.45);
    // Visible ribbed, articulated wings, rather than a glowing blob.
    const fabric = new T.MeshStandardMaterial({ color: side < 0 ? '#bc8863' : '#527f82', metalness: 0.35, roughness: 0.55, side: T.DoubleSide });
    const verts = new Float32Array([0, 0, 0, -1.15, 1.55, side * 1.55, 1.1, 2.3, side * 2.2, 0, 0, 0, 1.1, 2.3, side * 2.2, 1.15, 0.65, side * 2.3]);
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(verts, 3)); geo.computeVertexNormals(); w.mesh(geo, fabric, wing);
    for (const q of [v(-1.15, 1.55, side * 1.55), v(0, 1.9, side * 1.9), v(1.1, 2.3, side * 2.2), v(1.15, 0.65, side * 2.3)]) w.beam(wing, v(), q, 0.035, brass);
    w.ticks.push(t => { wing.rotation.x = side * (0.2 + Math.sin(t * 1.1) * 0.35); });
  }
  const jaw = group(g, 1.9, 1.4); round(w, jaw, [0.72, 0.12, 0.35], [0.33, -0.05, 0], brass); w.ticks.push(t => { jaw.rotation.z = -0.08 - Math.max(0, Math.sin(t * 0.7)) * 0.18; }); return g;
}
export function dragonWorkshop(w: World) {
  backdrop(w, '#142333', '#382c2c');
  const left = w.side(0, -2.8), right = w.side(1, -2.8), steel = w.metal('#53646a'), dark = w.metal('#2f343c'), copper = w.metal('#b88c61'), brick = w.metal('#97594a', 0.1, 0.9);
  for (const p of [left, right]) deck(w, p, 7.6, 4.8, '#515a56');
  const furnace = group(left, -1.8, 0, -0.6); round(w, furnace, [2.5, 3.4, 1.9], [0, 1.7, 0], brick);
  for (let row = 0; row < 8; row++) for (let col = 0; col < 4; col++) w.box(furnace, [0.48, 0.025, 0.025], [-0.95 + col * 0.63 + row % 2 * 0.13, 0.35 + row * 0.4, 0.966], dark);
  round(w, furnace, [1.85, 1.45, 0.1], [0, 1.45, 1], dark); round(w, furnace, [1.5, 1.1, 0.04], [0, 1.45, 1.07], w.glow('#e78b38', 1.1));
  for (let i = 0; i < 7; i++) w.beam(furnace, v(-0.7 + i * 0.23, 0.83, 1.12), v(-0.7 + i * 0.23, 2, 1.12), 0.025, steel);
  cylinder(w, furnace, 0.4, 2.8, dark, 0, 4.6, -0.1); for (const y of [3.5, 4.2, 5, 5.8]) cylinder(w, furnace, 0.44, 0.08, copper, 0, y, -0.1);
  const press = group(left, 1.5, 0, 0.25);
  for (const x of [-0.9, 0.9]) w.box(press, [0.35, 3.9, 0.5], [x, 1.95, -0.3], steel);
  w.box(press, [2.25, 0.4, 0.9], [0, 3.8, -0.3], steel); round(w, press, [1.7, 0.9, 1.3], [0, 0.5, 0], dark); w.box(press, [1.5, 0.16, 1.2], [0, 1.04, 0], copper);
  const hammer = group(press); cylinder(w, hammer, 0.11, 1.9, copper, 0, 2.5, -0.3); round(w, hammer, [1.1, 0.6, 0.95], [0, 1.6, -0.1], steel);
  const hot = w.box(press, [0.95, 0.15, 0.35], [0, 1.19, 0.14], w.glow('#ffa95a', 1.8));
  const wheel = gear(w, press, 0.65, 22); wheel.position.set(1.3, 2.7, -0.4);
  const sparks = new T.InstancedMesh(new T.SphereGeometry(0.025, 6, 4), w.glow('#ffd897', 2), 70); press.add(sparks); const d = new T.Object3D();
  w.ticks.push(t => {
    const u = (t % 3.6) / 3.6, impact = 0.63;
    // Head bottom is y=1.3 at impact, just above the heated bar's top at 1.265.
    hammer.position.y = u < impact ? 1.35 * Math.sin(u / impact * Math.PI) : 0.06 * Math.sin((u - impact) * 18) * Math.exp(-(u - impact) * 14);
    wheel.rotation.z = -t * 0.8; hot.scale.x = 1 + Math.max(0, u - impact) * 0.1;
    const age = (u - impact) * 3.6;
    for (let i = 0; i < 70; i++) { const a = i * 2.4, speed = 0.8 + (i % 7) * 0.22; d.position.set(Math.cos(a) * speed * Math.max(0, age), 1.3 + (1.5 + i % 5 * 0.4) * age - 3.6 * age * age, 0.15 + Math.sin(a) * speed * Math.max(0, age)); d.scale.setScalar(age > 0 && age < 0.8 && d.position.y > 0.1 ? 1 - age : 0); d.updateMatrix(); sparks.setMatrixAt(i, d.matrix); } sparks.instanceMatrix.needsUpdate = true;
  });
  const bench = group(right, 0, 0.9); round(w, bench, [6.5, 0.2, 3], [0, 0, 0], copper); for (const x of [-2.7, 2.7]) for (const z of [-1.1, 1.1]) w.box(bench, [0.15, 0.85, 0.15], [x, -0.5, z], steel);
  const dragon = mechanicalDragon(w, bench); dragon.position.set(0, 1.17, 0); dragon.rotation.y = -0.2;
  const blueprint = group(right, 0, 4.7, -1.9); w.box(blueprint, [5.8, 1.8, 0.09], [0, 0, 0], w.metal('#254d67'));
  w.text(blueprint, 'DRACO • WORKSHOP', '#c0d7d5', 4.8, 0.38).position.set(0, 0.4, 0.07);
  for (let i = 0; i < 4; i++) { const c = gear(w, blueprint, 0.27, 12, '#9bbdc5'); c.position.set(-1.6 + i * 1.05, -0.26, 0.06); }
  for (let i = 0; i < 6; i++) { const tool = group(bench, -2.7 + i * 0.28, 0.16, 1.15); w.box(tool, [0.07, 0.04, 0.5], [0, 0, 0], steel); w.ring(tool, 0.085, 0.018, steel, v(0, 0, 0.28)).rotation.x = Math.PI / 2; tool.rotation.y = i * 0.1; }
  const crane = group(right, -3.2, 0, -1.2); cylinder(w, crane, 0.09, 5.4, copper, 0, 2.7); w.beam(crane, v(0, 5.4), v(2, 5.4), 0.075, copper); w.beam(crane, v(0, 4), v(2, 5.4), 0.04, steel);
  const hook = group(crane, 1.8, 4); w.beam(hook, v(0, 1.4), v(), 0.013, steel); w.ring(hook, 0.15, 0.04, copper); w.ticks.push(t => { hook.rotation.z = Math.sin(t * 0.75) * 0.06; });
  // The workbenches are stations of one workshop: the foreground conveyor carries finished parts.
  const conveyor = group(w.root); conveyor.visible = !w.mobile;
  const belt = w.box(conveyor, [1, 0.1, 0.85], [0, -3.28, 1.4], dark);
  const rails = [-1, 1].map(s => w.box(conveyor, [1, 0.09, 0.05], [0, -3.13, 1.4 + s * 0.45], copper));
  const rollers = Array.from({ length: 34 }, () => { const r = cylinder(w, conveyor, 0.06, 0.86, steel); r.rotation.x = Math.PI / 2; return r; });
  const parts = Array.from({ length: 7 }, (_, i) => { const part = gear(w, conveyor, 0.22 + i % 2 * 0.08, 12); part.rotation.x = -Math.PI / 2; return part; });
  w.ticks.push(t => { if (w.mobile) return; const x1 = left.position.x + 2, x2 = right.position.x - 2, span = x2 - x1, mid = (x1 + x2) / 2; belt.scale.x = span; belt.position.x = mid; rails.forEach(r => { r.scale.x = span; r.position.x = mid; }); rollers.forEach((r, i) => { r.position.set(x1 + span * i / 33, -3.18, 1.4); }); parts.forEach((p, i) => { p.position.set(x1 + span * ((t * 0.034 + i / 7) % 1), -3.08, 1.4); }); });
}
