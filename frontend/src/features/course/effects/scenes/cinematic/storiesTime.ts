import { T, TAU, v, type World } from './world';
import { gear } from './props';
import { backdrop, bake, books, cylinder, deck, group, plant, round } from './storyKit';

function desk(w: World, p: T.Object3D) {
  const g = group(p, 0, -2.3), wood = w.metal('#806053', 0.15, 0.6), brass = w.metal('#c4a578');
  round(w, g, [7.6, 0.3, 4], [0, 0, 0], wood, 0.13);
  for (const x of [-3, 3]) for (const z of [-1.4, 1.4]) { w.beam(g, v(x, -0.15, z), v(x * 1.05, -2, z * 1.08), 0.09, brass); cylinder(w, g, 0.16, 0.09, wood, x * 1.05, -2, z * 1.08); }
  for (let i = 0; i < 3; i++) { round(w, g, [1.75, 0.37, 1.6], [-2.55, -0.45 - i * 0.41, -0.3], wood); w.box(g, [0.38, 0.05, 0.09], [-2.55, -0.45 - i * 0.41, 0.54], brass); }
  bake(g); return g;
}
export function kineticPlanner(w: World) {
  backdrop(w, '#172a39', '#353533');
  const left = w.side(0), right = w.side(1); desk(w, left); desk(w, right);
  const brass = w.metal('#d4b473'), cream = w.metal('#e7dcb5', 0.05, 0.7), dark = w.metal('#243745'), green = w.metal('#527a71');
  // Split-flap week calendar; an entire physical leaf flips, not a scrolling texture.
  const calendar = group(left, 0, -0.3, -0.5); round(w, calendar, [5.6, 3.35, 0.3], [0, 0, 0], green);
  for (const x of [-2.2, 2.2]) w.beam(calendar, v(x, -1.65, 0), v(x, -2, 0.9), 0.07, brass);
  w.text(calendar, 'MANS PLĀNS', '#eaddb7', 4.5, 0.42).position.set(0, 1.34, 0.18);
  const days = ['P', 'O', 'T', 'C', 'Pk', 'S', 'Sv'];
  for (let i = 0; i < 7; i++) {
    const x = -2.25 + i * 0.75; w.text(calendar, days[i], '#f3db98', 0.58, 0.27).position.set(x, 0.84, 0.2);
    for (let row = 0; row < 3; row++) {
      const card = group(calendar, x, 0.5 - row * 0.62, 0.24);
      round(w, card, [0.63, 0.52, 0.055], [0, -0.25, 0], cream, 0.025);
      w.text(card, String(i + row * 7 + 1).padStart(2, '0'), '#304757', 0.43, 0.27).position.set(0, -0.25, 0.038);
      for (const xx of [-0.2, 0.2]) w.ring(calendar, 0.06, 0.012, brass, v(x + xx, 0.5 - row * 0.62, 0.3)).rotation.y = Math.PI / 2;
      w.ticks.push(t => { const u = (t * 0.15 + (i + row * 7) / 21) % 1; card.rotation.x = u < 0.12 ? Math.sin(u / 0.12 * Math.PI) * -1.6 : 0; });
    }
  }
  books(w, left, 6, -3, -2.08, 0.7);
  const cup = group(left, 2.4, -1.84, 0.85); cylinder(w, cup, 0.26, 0.48, cream); cylinder(w, cup, 0.225, 0.025, w.metal('#432d27'), 0, 0.245); w.ring(cup, 0.19, 0.04, cream, v(0.31, 0, 0));
  const pen = group(left, -0.6, -2.08, 1.5); cylinder(w, pen, 0.035, 1.5, brass).rotation.z = 1.2; w.mesh(new T.ConeGeometry(0.036, 0.2, 12), dark, pen, v(-0.78, -0.3)).rotation.z = 1.2;
  const clipboard = group(right, 0, -0.2, -1.2); round(w, clipboard, [3.9, 3.5, 0.16], [0, 0, 0], dark); round(w, clipboard, [3.5, 3.08, 0.04], [0, -0.08, 0.11], cream);
  w.text(clipboard, 'DARĀMAIS', '#395654', 2.7, 0.35).position.set(0, 1.09, 0.145);
  for (let i = 0; i < 4; i++) {
    const y = 0.48 - i * 0.54; w.ring(clipboard, 0.1, 0.018, green, v(-1.25, y, 0.15));
    w.box(clipboard, [1.6 - i % 2 * 0.35, 0.035, 0.016], [0, y, 0.15], green);
    const tick = group(clipboard, -1.25, y, 0.16); w.beam(tick, v(-0.06, 0), v(-0.01, -0.06), 0.02, green); w.beam(tick, v(-0.01, -0.06), v(0.11, 0.1), 0.02, green);
    w.ticks.push(t => { tick.visible = Math.floor(t / 2) % 5 > i; });
  }
  // A little brass sorting machine transfers task cards between IN and DONE trays.
  const machine = group(right, 0, -1.6, 0.9); round(w, machine, [3.8, 0.35, 1.3], [0, 0, 0], green);
  for (const x of [-1.25, 1.25]) { round(w, machine, [1.15, 0.1, 0.92], [x, 0.3, 0], brass); w.text(machine, x < 0 ? 'IN' : 'DONE', '#f8e1ac', 0.8, 0.23).position.set(x, 0.05, 0.67); }
  for (let i = 0; i < 5; i++) w.box(machine, [0.9, 0.04, 0.7], [-1.25, 0.39 + i * 0.046, 0], cream);
  const cog = gear(w, machine, 0.46, 16, '#be9758'); cog.position.set(0, 0.32, 0.68);
  const arm = group(machine, 0, 0.25, -0.12); cylinder(w, arm, 0.1, 0.85, brass, 0, 0.42); w.beam(arm, v(0, 0.85), v(1.25, 0.85), 0.075, brass); w.box(arm, [0.28, 0.14, 0.38], [1.25, 0.75, 0], dark);
  const card = w.box(machine, [0.9, 0.04, 0.65], [0, 0, 0], cream);
  w.ticks.push(t => { const phase = t * 0.55; arm.rotation.y = Math.PI / 2 + Math.sin(phase) * Math.PI / 2; const pos = v(1.25, 0.65, 0).applyAxisAngle(v(0, 1), arm.rotation.y); card.position.copy(pos).add(arm.position); card.rotation.y = arm.rotation.y; cog.rotation.z = -phase * 2; });
  const timer = group(right, 2.7, -0.85, -0.6); cylinder(w, timer, 0.13, 2, brass); const face = cylinder(w, timer, 0.7, 0.2, cream, 0, 0.9, 0); face.rotation.x = Math.PI / 2;
  for (let i = 0; i < 12; i++) { const a = i * TAU / 12; const tick = w.box(timer, [0.035, 0.11, 0.02], [Math.sin(a) * 0.55, 0.9 + Math.cos(a) * 0.55, 0.12], dark); tick.rotation.z = -a; }
  const hand = group(timer, 0, 0.9, 0.14); w.box(hand, [0.035, 0.48, 0.025], [0, 0.2, 0], dark); w.ticks.push(t => { hand.rotation.z = -t * 0.32; }); plant(w, right, -2.8, -2.08, -0.6, 0.9);
}

function blossom(w: World, p: T.Object3D, color: string, radius: number) {
  const flower = group(p), mat = w.metal(color, 0.1, 0.5), petals: T.Group[] = [];
  for (let i = 0; i < 14; i++) {
    const a = i * TAU / 14, hinge = group(flower); hinge.rotation.y = a;
    const petal = w.sphere(hinge, radius, [0, radius * 0.5, radius * 0.6], mat); petal.scale.set(0.36, 0.08, 0.9); petal.rotation.x = -0.3; petals.push(hinge);
  }
  w.sphere(flower, radius * 0.23, [0, 0.12, 0], w.metal('#f7c752', 0.1, 0.65));
  return { root: flower, petals };
}
export function secondSpring(w: World) {
  backdrop(w, '#1e213d', '#3b4741');
  const left = w.side(0, -0.5), right = w.side(1, -0.4), brass = w.metal('#c89a58', 0.65, 0.33), green = w.metal('#597b5c', 0.2, 0.7), wood = w.metal('#754b42', 0.1, 0.7);
  deck(w, group(left, 0, -2.9), 6.8, 4, '#55423d');
  const gram = group(left, 0, -1.95); round(w, gram, [3.6, 1.2, 2.6], [0, 0, 0], wood, 0.13);
  for (const y of [-0.53, 0.52]) w.box(gram, [3.75, 0.12, 2.72], [0, y, 0], brass);
  for (let i = 0; i < 12; i++) w.box(gram, [0.07, 0.45, 0.04], [-1.25 + i * 0.23, 0, 1.33], brass);
  const record = group(gram, -0.15, 0.66); cylinder(w, record, 1.08, 0.055, w.metal('#192b30', 0.3, 0.25)); cylinder(w, record, 0.24, 0.06, w.metal('#d36c7c'));
  for (let i = 0; i < 13; i++) w.ring(record, 0.38 + i * 0.048, 0.006, w.metal('#415257'), v(0, 0.035)).rotation.x = Math.PI / 2;
  w.ticks.push(t => { record.rotation.y = t * 1.1; });
  w.tube(gram, [v(1.2, 0.65, -0.75), v(1.4, 0.95, -0.4), v(0.75, 0.9, 0.4), v(0.45, 0.78, 0.65)], brass, 0.05);
  w.tube(gram, [v(1.25, 0.5, -0.8), v(1.25, 2.3, -0.8), v(0.4, 3, -0.4)], brass, 0.17);
  // The brass horn opens toward the viewer and becomes a living flower.
  const horn = group(gram, 0.3, 2.9, -0.4); horn.rotation.x = Math.PI / 2 - 0.35;
  const points = [new T.Vector2(0.15, 0), new T.Vector2(0.2, 0.4), new T.Vector2(0.4, 0.85), new T.Vector2(0.8, 1.35), new T.Vector2(1.3, 1.7), new T.Vector2(1.6, 1.83)];
  w.mesh(new T.LatheGeometry(points, 64), new T.MeshStandardMaterial({ color: '#d3ad68', metalness: 0.65, roughness: 0.3, side: T.DoubleSide }), horn);
  w.ring(horn, 1.59, 0.055, brass, v(0, 1.83)).rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8; w.tube(horn, points.map(pt => v(Math.cos(a) * pt.x, pt.y, Math.sin(a) * pt.x)), brass, 0.014); }
  const flower = blossom(w, left, '#e98fbb', 1.15); flower.root.position.set(-1.5, 0.8, 0.9); flower.root.rotation.x = 0.8;
  w.tube(left, [v(-2.2, -2.7, 0.4), v(-2.6, -0.8, 0.5), v(-1.5, 0.8, 0.9)], green, 0.08);
  // A giant old pocket watch is reclaimed by a garden, its mechanism runs backwards.
  const watch = group(right, 0, 0.5); cylinder(w, watch, 2.4, 0.35, brass).rotation.x = Math.PI / 2;
  cylinder(w, watch, 2.18, 0.38, w.metal('#dcc9a1', 0.15, 0.7)).rotation.x = Math.PI / 2;
  w.ring(watch, 2.22, 0.08, brass, v(0, 0, 0.24));
  for (let i = 0; i < 12; i++) { const a = i * TAU / 12; w.text(watch, String(i || 12), '#4b594e', 0.36, 0.36).position.set(Math.sin(a) * 1.86, Math.cos(a) * 1.86, 0.22); }
  for (let i = 0; i < 4; i++) { const cog = gear(w, watch, 0.49 + i % 2 * 0.12, 18, '#ad8855'); cog.position.set((i % 2 - 0.5) * 1.05, (Math.floor(i / 2) - 0.5) * 1.05, 0.23); w.ticks.push(t => { cog.rotation.z = t * (i % 2 ? -0.28 : 0.28); }); }
  const hands = group(watch, 0, 0, 0.64); w.box(hands, [0.075, 1.75, 0.025], [0, 0.7, 0], green); w.ticks.push(t => { hands.rotation.z = t * 0.14; });
  w.ring(watch, 0.4, 0.09, brass, v(0, 2.9)); round(w, watch, [0.6, 0.3, 0.42], [0, 2.48, 0], brass);
  const garden = group(right, 0, -2.8); deck(w, garden, 7.1, 3.4, '#506250');
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4, x = Math.cos(a) * 2.6, y = 0.8 + (i % 3) * 0.65;
    w.tube(garden, [v(x, 0), v(x + Math.sin(a) * 0.5, y * 0.55, 0.3), v(x, y, 0.8)], green, 0.035);
    const f = blossom(w, garden, ['#e5ae48', '#cc76a1', '#7ebfbc'][i % 3], 0.48); f.root.position.set(x, y, 0.8); f.root.rotation.x = 0.6;
    w.ticks.push(t => { f.petals.forEach(p => { p.rotation.x = -0.35 + Math.sin(t * 0.25 + i) * 0.45; }); });
  }
  w.ticks.push(t => { flower.petals.forEach(p => { p.rotation.x = Math.sin(t * 0.3) * 0.6; }); });
  for (let i = 0; i < 9; i++) {
    const butterfly = group(w.root), black = w.metal('#443a50'), color = w.metal(['#e9a151', '#e782a5', '#71bdcf'][i % 3], 0.1, 0.5);
    w.sphere(butterfly, 0.07, [0, 0, 0], black).scale.set(0.55, 1.8, 0.5);
    const wings = [-1, 1].map(s => { const hinge = group(butterfly); for (const y of [-0.07, 0.11]) { const wing = w.sphere(hinge, y > 0 ? 0.22 : 0.16, [s * 0.19, y, 0], color); wing.scale.set(1, 0.8, 0.08); w.sphere(hinge, 0.047, [s * 0.21, y, 0.02], black).scale.z = 0.1; } return hinge; });
    w.ticks.push(t => { const a = t * 0.23 + i * 0.65; const center = i % 2 ? left.position : right.position; butterfly.position.copy(center).add(v(Math.sin(a) * 3, 1.7 + Math.cos(a * 1.7) * 2, 1.6 + Math.cos(a) * 0.5)); wings[0].rotation.y = Math.sin(t * 11 + i) * 0.9; wings[1].rotation.y = -wings[0].rotation.y; butterfly.rotation.z = Math.sin(a) * 0.3; });
  }
}
