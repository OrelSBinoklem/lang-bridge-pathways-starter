import { T, TAU, v, type World } from './world';
import { bake, backdrop, cylinder, group, round, stars } from './storyKit';

/** A switchyard for plans: each capsule commits to a destination as it passes the switch. */
export function timeSwitchyard(w: World) {
  backdrop(w, '#101e30', '#24333d'); stars(w, 100);
  const left = w.side(0), right = w.side(1);
  const bronze = w.metal('#c7a263'), steel = w.metal('#829b9b'), dark = w.metal('#263d45');
  const frame = group(left);
  for (const radius of [1.7, 2.2, 2.7]) w.ring(frame, radius, .045, bronze);
  for (let i = 0; i < 24; i++) { const a = i * TAU / 24; w.beam(frame, v(Math.cos(a) * 2.3, Math.sin(a) * 2.3), v(Math.cos(a) * 2.65, Math.sin(a) * 2.65), .025, steel); }
  cylinder(w, frame, 1.45, .5, dark).rotation.x = Math.PI / 2;
  w.text(frame, 'БАНК ВРЕМЕНИ', '#edca84', 2.7, .35).position.set(0, .3, .3);
  w.text(frame, '24 часа • без овердрафта', '#c4d8d4', 2.6, .24).position.set(0, -.3, .3);
  bake(frame);
  const bins = ['СЕГОДНЯ', 'ПОЗЖЕ', 'ОТДЫХ'];
  bins.forEach((label, i) => {
    const y = (1 - i) * 2.2;
    round(w, right, [4.4, 1.55, 1.8], [0, y, -.5], dark);
    for (const x of [-2.2, 2.2]) w.beam(right, v(x, y - .6, .5), v(x, y + .6, .5), .07, bronze);
    w.text(right, label, ['#80ead5', '#f8ce84', '#b8a5ff'][i], 3.7, .35).position.set(0, y + .32, .49);
  });
  const switcher = group(w.root, 0, 0, 1.5);
  w.ring(switcher, .65, .08, bronze); const lever = w.beam(switcher, v(), v(0, .8, 0), .08, steel);
  w.sphere(switcher, .16, [0, 0, 0], w.glow('#a8f9de', 1));
  const label = w.text(w.root, 'Клик: сменить стрелку • капсулы уже в пути не перескакивают', '#dcceae', 13, .34); label.position.set(0, -4, 2);
  // Lines are updated in-place when responsive anchors move. No geometry recreation in the animation loop.
  const routes = bins.map((_, route) => {
    const points = new Float32Array(65 * 3);
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.BufferAttribute(points, 3));
    const line = new T.Line(geometry, new T.LineBasicMaterial({ color: ['#73d9b9', '#c8a668', '#b295e5'][route], transparent: true, opacity: .65 })); w.root.add(line);
    return { points, geometry };
  });
  const labels = ['ЯЗЫК', 'ПРОГУЛКА', 'ПРОЕКТ', 'ЗВОНОК', 'ЧТЕНИЕ', 'ПАУЗА'];
  const capsules = labels.map((name, i) => {
    const root = group(w.root), shell = w.metal(['#66bfae', '#d7ac65', '#aa87cf'][i % 3], .4, .3);
    root.name = `planner-capsule-${i}`;
    round(w, root, [1.25, .5, .55], [0, 0, 0], shell, .16);
    w.text(root, name, '#152d36', 1.1, .21).position.set(0, 0, .29);
    return { root, cycle: -1, route: i % 3, committed: false, offset: i / labels.length };
  });
  let selected = 0;
  const point = (u: number, route: number, out: T.Vector3) => {
    out.copy(left.position).lerp(right.position, u);
    const branch = T.MathUtils.smoothstep(u, .34, 1);
    out.y += (1 - route) * 2.2 * branch;
    out.z = .6 + Math.sin(u * Math.PI * 2) * .45;
    return out;
  };
  const scratch = v();
  w.ticks.push((t, dt, pointer) => {
    if (pointer.clicked) selected = (selected + 1) % 3;
    lever.rotation.z += ((selected - 1) * -.7 - lever.rotation.z) * (1 - Math.exp(-dt * 9));
    switcher.position.copy(left.position).lerp(right.position, .34).add(v(0, 0, 1.5));
    for (let route = 0; route < 3; route++) {
      const { points, geometry } = routes[route];
      for (let i = 0; i <= 64; i++) { point(i / 64, route, scratch); scratch.toArray(points, i * 3); }
      geometry.attributes.position.needsUpdate = true; geometry.computeBoundingSphere();
    }
    for (const c of capsules) {
      const clock = t / 12 + c.offset, cycle = Math.floor(clock), u = clock - cycle;
      if (cycle !== c.cycle) { c.cycle = cycle; c.committed = false; }
      if (!c.committed && u >= .34) { c.route = selected; c.committed = true; }
      point(u, c.route, c.root.position);
      c.root.rotation.z = Math.sin(u * TAU) * .1;
      c.root.scale.setScalar(Math.min(1, u * 15, (1 - u) * 15));
    }
    frame.rotation.z = Math.sin(t * .13) * .07;
  });
}
