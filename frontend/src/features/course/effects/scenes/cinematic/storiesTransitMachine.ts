import { T, TAU, v, type World } from './world';
import { aircraft } from './props';
import { backdrop, bake, cylinder, group, lamp, person, round, stars } from './storyKit';

/** A continuous miniature interchange, not a physical railway simulation. */
export function transitMachine(w: World) {
  backdrop(w, '#081d38', '#193641'); stars(w, 100);
  w.cameraMotion = .18; w.eye.set(0, 6.2, 23); w.target.set(0, .3, 0);
  const city = group(w.root); city.name = 'transit-city';
  city.scale.setScalar(w.mobile ? Math.min(.52, w.c.width / w.c.height * .9) : 1);
  const steel = w.metal('#b6d5cc', .8, .3), dark = w.metal('#183944', .5, .55);
  const brass = w.metal('#d8a865', .7, .3), concrete = w.metal('#64868b', .15, .8);
  const cyan = w.glow('#51dbc9', 1.3), amber = w.glow('#ffb35f', 1.5);
  const architecture = group(city);
  round(w, architecture, [18.8, .5, 9.2], [0, -3.9, -.6], dark, .15);
  // Two decks joined by a rising helix, with a visible return viaduct behind it.
  const route = new T.CatmullRomCurve3([
    v(-7, -2.7, 2), v(-3, -2.7, 3.2), v(2, -2.5, 3), v(6.3, -1.7, 1.6),
    v(7, -.5, -1.4), v(4.8, .6, -2.9), v(2.7, 1.7, -1.2), v(4.1, 2.7, 1.2),
    v(7, 2.9, 1.3), v(8, 2.7, -1.8), v(5.8, 2.2, -4), v(0, 1.2, -4.2),
    v(-5.8, .1, -3.9), v(-8, -.9, -2.2), v(-8.2, -2, .1),
  ], true, 'catmullrom', .35);
  // A real ribbon road and separate rails; no floating vehicles between disconnected pieces.
  const positions: number[] = [], normals: number[] = [], indices: number[] = [];
  const rails: T.Vector3[][] = [[], []];
  const samples = 384, up = v(0, 1, 0);
  for (let i = 0; i <= samples; i++) {
    const p = route.getPointAt(i / samples), tangent = route.getTangentAt(i / samples);
    const side = v().crossVectors(tangent, up).normalize(), normal = v().crossVectors(side, tangent).normalize();
    for (const sign of [-1, 1]) {
      const edge = p.clone().addScaledVector(side, sign * .7);
      positions.push(edge.x, edge.y, edge.z); normals.push(normal.x, normal.y, normal.z);
      rails[sign === -1 ? 0 : 1].push(p.clone().addScaledVector(side, sign * .52).add(v(0, .12, 0)));
    }
    if (i < samples) { const n = i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
    if (i % 12 === 0) {
      w.beam(architecture, p.clone().addScaledVector(side, -.8), p.clone().addScaledVector(side, .8), .065, steel);
      w.beam(architecture, v(p.x, -3.6, p.z), p.clone().add(v(0, -.1, 0)), .095, concrete);
    }
  }
  const road = new T.BufferGeometry(); road.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); road.setAttribute('normal', new T.Float32BufferAttribute(normals, 3)); road.setIndex(indices);
  const roadMat = w.metal('#24434b', .3, .7); roadMat.side = T.DoubleSide; w.mesh(road, roadMat, architecture);
  rails.forEach(points => w.mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.slice(0, -1), true), samples, .035, 6, true), steel, architecture));
  // Route markers are geometry, not dozens of shadow-casting lights.
  for (let i = 0; i < 96; i++) {
    const p = route.getPointAt(i / 96); w.mesh(new T.SphereGeometry(.035, 8, 6), i % 4 ? cyan : amber, architecture, p.add(v(0, .03, 0)));
  }
  for (let i = 0; i < 7; i++) {
    const x = -5.7 + i * 1.45, h = 1.2 + (i * 7 % 5) * .35;
    round(w, architecture, [1.15, h, 1.1], [x, -3.6 + h / 2, -1.7], w.metal(['#668f92', '#b98167', '#c6aa77'][i % 3], .15, .7));
    for (let row = 0; row < 3; row++) for (const dx of [-.28, .28]) w.box(architecture, [.19, .22, .035], [x + dx, -3.3 + row * .4, -1.13], amber);
  }
  // Terminal under the elevated runway; lift cages move inside braced towers.
  const lifts: { cage: T.Group; doors: T.Group[]; pulley: T.Group }[] = [];
  for (const x of [-5, 5]) {
    for (const dx of [-.65, .65]) for (const z of [-.65, .65]) w.beam(architecture, v(x + dx, -3.6, z), v(x + dx, 4, z), .045, steel);
    for (let y = -3.5; y < 3.9; y += .9) {
      w.beam(architecture, v(x - .65, y, -.65), v(x + .65, y + .9, -.65), .025, brass);
      w.beam(architecture, v(x + .65, y, -.65), v(x - .65, y + .9, -.65), .025, brass);
    }
    const lift = group(city, x, -3.4); lift.name = 'transit-lift';
    round(w, lift, [1.15, .12, 1.15], [0, 0, 0], brass);
    for (const dx of [-.52, .52]) w.beam(lift, v(dx, 0, -.5), v(dx, 1.2, -.5), .035, steel);
    round(w, lift, [1.15, .1, 1.15], [0, 1.2, 0], brass);
    const passenger = person(w, lift, x < 0 ? '#ed9261' : '#60cbc6', .75); passenger.root.position.y = .09;
    const doors = [-1, 1].map(sign => {
      const door = group(lift, sign * .27, .6, .55); door.name = 'transit-lift-door';
      w.box(door, [.49, 1.05, .035], [0, 0, 0], dark);
      w.box(door, [.4, .85, .04], [0, .02, .025], w.glass('#9ee9e7', .2));
      w.box(door, [.025, .24, .025], [-sign * .17, -.1, .04], brass);
      return door;
    });
    const pulley = group(city, x, 4.38, -.45);
    w.ring(pulley, .28, .045, brass);
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6; w.beam(pulley, v(), v(Math.cos(a) * .27, Math.sin(a) * .27, 0), .025, steel);
    }
    bake(pulley);
    w.beam(architecture, v(x, -3.4, -.46), v(x, 4.38, -.46), .012, dark);
    lifts.push({ cage: lift, doors, pulley });
  }
  round(w, architecture, [12.4, .22, 1.5], [0, 4, 0], concrete);
  for (let i = -8; i <= 8; i++) w.box(architecture, [.36, .015, .05], [i * .67, 4.12, 0], steel);
  for (const x of [-6, 6]) for (const z of [-.6, .6]) w.sphere(architecture, .065, [x, 4.17, z], cyan);
  // Railway hall: riveted arches, a clock, platform benches and striped awnings.
  const station = group(architecture, -2.2, -2.6, 1.8);
  round(w, station, [5.8, .18, 1.2], [0, -.15, -.75], concrete);
  for (const x of [-2.6, 0, 2.6]) {
    w.beam(station, v(x, 0, -1.25), v(x, 1.6, -1.25), .055, steel);
    w.tube(station, [v(x, 1.5, -1.25), v(x, 2.05, -.8), v(x, 1.6, -.1)], brass, .035);
    for (let y = .2; y < 1.5; y += .3) w.box(station, [.12, .055, .09], [x, y, -1.2], brass);
  }
  for (let i = 0; i < 22; i++) w.box(station, [.25, .07, 1.3], [-2.75 + i * .26, 1.62, -.66], i % 2 ? steel : dark);
  for (const x of [-1.5, 1.5]) {
    round(w, station, [1.15, .1, .3], [x, .27, -.9], brass);
    for (const dx of [-.4, .4]) w.box(station, [.07, .3, .25], [x + dx, .09, -.9], dark);
  }
  w.text(station, '01   RĪGA   →   02', '#ffe5b0', 2.4, .3).position.set(0, 1.42, .03);
  const clockFace = cylinder(w, station, .38, .06, dark, 0, 2.2, -.65); clockFace.rotation.x = Math.PI / 2;
  w.ring(station, .38, .025, brass, v(0, 2.2, -.6));
  for (let i = 0; i < 12; i++) {
    const a = i * TAU / 12;
    w.box(station, [.035, .055, .025], [Math.sin(a) * .3, 2.2 + Math.cos(a) * .3, -.6], steel).rotation.z = -a;
  }
  const clockHand = group(city, -2.2, -.4, 1.22); clockHand.name = 'transit-clock-hand';
  w.box(clockHand, [.025, .27, .025], [0, .115, 0], amber);
  // Small luggage loop is independent of the trains and stays on its conveyor.
  round(w, architecture, [3.3, .15, .8], [2, -3.3, 2.2], dark);
  for (let i = 0; i < 16; i++) {
    const roller = cylinder(w, architecture, .065, .74, steel, .5 + i * .2, -3.2, 2.2); roller.rotation.x = Math.PI / 2;
  }
  const luggage = Array.from({ length: 5 }, (_, i) => {
    const bag = group(city); bag.name = 'transit-luggage';
    round(w, bag, [.28, .4, .23], [0, .2, 0], w.metal(['#d77d58', '#6cc8c0', '#e1b666'][i % 3], .15, .6));
    w.ring(bag, .07, .015, brass, v(0, .43, 0));
    w.box(bag, [.035, .4, .24], [.07, .2, 0], dark); bake(bag); return bag;
  });
  const name = w.text(architecture, 'PĀRSĒŠANĀS / TRANSFER', '#ffe0a3', 7, .55); name.position.set(-.4, -4.2, 5);
  const instruction = w.text(architecture, 'КЛИК — ПУСК / ПАУЗА', '#a8d5d4', 5, .35); instruction.position.set(0, -4.75, 5);
  lamp(w, architecture, -8.6, -3.6, 3.3, 2.3); lamp(w, architecture, 8.6, -3.6, 3.3, 2.3);
  bake(architecture);
  const tram = (color: string) => {
    const body = group(city), shell = w.metal(color, .4, .35); body.name = 'transit-car';
    round(w, body, [1.7, .65, .75], [0, .48, 0], shell);
    for (const z of [-.38, .38]) {
      for (let x = -.6; x < .7; x += .3) w.box(body, [.23, .28, .018], [x, .57, z], dark);
      w.box(body, [1.6, .05, .02], [0, .24, z], brass);
      for (const x of [-.52, .52]) { const wheel = cylinder(w, body, .14, .08, dark, x, .14, Math.sign(z) * .52); wheel.rotation.x = Math.PI / 2; }
    }
    w.box(body, [.025, .3, .58], [.86, .56, 0], dark);
    for (const z of [-.24, .24]) w.sphere(body, .04, [.88, .28, z], amber);
    for (const z of [-.18, .18]) w.beam(body, v(.15, .82, z), v(-.45, 1.15, z), .018, steel);
    for (let i = 0; i < 7; i++) w.box(body, [.045, .045, .4], [-.5 + i * .12, .83, 0], dark);
    for (const z of [-.395, .395]) {
      w.box(body, [.2, .49, .018], [.48, .45, z], brass);
      w.box(body, [.14, .22, .02], [.48, .56, z * 1.01], dark);
      w.box(body, [.012, .43, .025], [.48, .45, z * 1.02], steel);
    }
    w.box(body, [.25, .1, .15], [-.94, .19, 0], steel);
    bake(body); return body;
  };
  const trams = [tram('#f4ab4d'), tram('#f4ab4d'), tram('#55c8bb'), tram('#55c8bb')];
  const carGap = 2.02 / route.getLength();
  const jet = aircraft(w, city); jet.scale.setScalar(1.7);
  const walkers = Array.from({ length: 6 }, (_, i) => person(w, city, ['#e6a464', '#b395df', '#65d1c3'][i % 3], .65));
  // A lit pedestrian promenade under the road, on the front edge of the base.
  const promenade = group(city); round(w, promenade, [16.4, .15, .85], [0, -3.5, 3.35], concrete); bake(promenade);
  let clock = 0, running = true, velocity = 1;
  const orientation = new T.Matrix4(), forward = v(), side = v(), normal = v();
  w.ticks.push((_time, dt, pointer) => {
    if (pointer.clicked && w.c.params.react > 0) running = !running;
    velocity += ((running ? 1 : 0) - velocity) * (1 - Math.exp(-dt * 5)); clock += dt * velocity;
    trams.forEach((tram, i) => {
      const u = (clock / 30 + Math.floor(i / 2) * .5 - (i % 2) * carGap + 1) % 1;
      tram.position.copy(route.getPointAt(u)); forward.copy(route.getTangentAt(u));
      side.crossVectors(forward, up).normalize(); normal.crossVectors(side, forward).normalize();
      orientation.makeBasis(forward, normal, side); tram.quaternion.setFromRotationMatrix(orientation);
    });
    lifts.forEach(({ cage, doors, pulley }, i) => {
      const phase = (clock + i * 10) % 20;
      const smooth = (u: number) => { const x = T.MathUtils.clamp(u, 0, 1); return x * x * (3 - 2 * x); };
      const height = smooth((phase - 3) / 6) - smooth((phase - 13) / 6);
      cage.position.y = -3.35 + height * 6.1;
      const dwell = phase < 3 ? phase : phase >= 9 && phase < 13 ? phase - 9 : -1;
      const open = dwell < 0 ? 0 : smooth(dwell / .5) * (1 - smooth((dwell - (phase < 3 ? 2 : 3)) / .5));
      doors.forEach((door, n) => { door.position.x = (n ? 1 : -1) * (.27 + .42 * open); });
      pulley.rotation.z = height * -16;
    });
    clockHand.rotation.z = -clock * .35;
    luggage.forEach((bag, i) => {
      const a = clock * .5 + i * TAU / 5; bag.position.set(2 + Math.cos(a) * 1.35, -3.1, 2.2 + Math.sin(a) * .22); bag.rotation.y = -a;
    });
    walkers.forEach((human, i) => {
      const a = (clock * .018 + i / 6) * TAU;
      human.root.position.set(Math.sin(a) * 7.7, -3.4, 3.35 + Math.cos(a) * .25);
      human.root.rotation.y = Math.atan2(7.7 * Math.cos(a), -.25 * Math.sin(a)); human.walk(clock + i, Math.max(.15, Math.abs(Math.cos(a))));
    });
    const a = clock * .19;
    jet.position.set(Math.sin(a) * 9, 5 + Math.cos(a) * .65, -2 - Math.cos(a) * 5);
    jet.rotation.set(0, -Math.atan2(5 * Math.sin(a), 9 * Math.cos(a)), -.1 * Math.sin(a));
  });
}
