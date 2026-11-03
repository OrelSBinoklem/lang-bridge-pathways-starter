import { T, TAU, v, type World } from './world';
import { bake, backdrop, cylinder, deck, group, lamp, person, plant, railing, round, stars } from './storyKit';
import { pizzaArmPose, pizzaPhases } from './pizzaChoreography';

const smooth = (x: number) => { const u = T.MathUtils.clamp(x, 0, 1); return u * u * (3 - 2 * u); };

export function certificateBureau(w: World) {
  backdrop(w, '#33455d', '#74675a');
  const a = w.side(0, -2.6), b = w.side(1, -2.6);
  if (w.mobile) {
    const scale = Math.min(.68, w.c.width / w.c.height * 1.35);
    a.scale.setScalar(scale); b.scale.setScalar(scale);
  }
  const paper = w.metal('#f3e5b9', 0, .9), wood = w.metal('#7d4d36', .1, .7), red = w.metal('#9e3640');
  for (const platform of [a, b]) { deck(w, platform, 7.5, 4, '#73705b'); lamp(w, platform, -3, 0, -1.2); }
  const office = group(a);
  round(w, office, [5.5, 3.7, .3], [0, 1.85, -.9], w.metal('#b5bea8', 0, .8));
  w.text(office, 'БЮРО ПРИСУТСТВИЯ', '#283535', 4.8, .46).position.set(0, 3.35, -.7);
  w.box(office, [4.9, .23, 1.6], [0, 1.2, .1], wood);
  for (const x of [-2.15, 2.15]) w.box(office, [.2, 1.3, 1], [x, .6, .1], wood);
  for (let i = 0; i < 16; i++) w.box(office, [.85, .045, .65], [-1.65, 1.37 + i * .047, .15], paper);
  w.text(office, 'ВЫ ЗДЕСЬ БЫЛИ', '#923d43', 2.3, .28).position.set(0, .85, .94);
  bake(office);
  const clerk = person(w, a, '#647371', 1.8); clerk.root.position.set(.3, .6, -.4);
  const stamp = group(a, .8, 2.2, .65);
  cylinder(w, stamp, .15, .45, wood); round(w, stamp, [.65, .12, .4], [0, -.28, 0], red);
  const certificate = group(a, .6, 1.4, 1.1);
  w.box(certificate, [1.1, .8, .03], [0, 0, 0], paper);
  w.text(certificate, 'СПРАВКА', '#403c33', .95, .16).position.set(0, .22, .025);
  w.text(certificate, 'Я ЗДЕСЬ БЫЛ', '#403c33', 1, .14).position.set(0, -.03, .025);
  w.ring(certificate, .14, .013, red, v(.26, -.2, .025));
  const receipt = group(b, 0, 2.7, -.8);
  round(w, receipt, [5.2, 1.6, .12], [0, 0, 0], paper);
  w.text(receipt, 'ПРИЯТНО ПОЗНАКОМИТЬСЯ!', '#424b46', 4.9, .42).position.set(0, .25, .09);
  w.text(receipt, 'Теперь это официально.', '#974d47', 4.2, .33).position.set(0, -.35, .09);
  const queue = Array.from({ length: 6 }, (_, i) => {
    const human = person(w, w.root, ['#ca8054', '#6287a6', '#9c6578'][i % 3], 1.5);
    human.root.name = 'certificate-visitor';
    if (w.mobile) human.root.scale.multiplyScalar(.65);
    const sheet = group(human.root, .45, .8, .25);
    w.box(sheet, [.55, .39, .025], [0, 0, 0], paper);
    w.ring(sheet, .075, .012, red, v(.12, -.06, .02));
    return { human, sheet, phase: i / 6 };
  });
  const walkway = w.box(w.root, [1, .16, 1.8], [0, -2.7, 1.9], w.metal('#73705b', 0, .9));
  plant(w, b, 2.8, 0, .6, 1.2);
  let boost = 0, clock = 0;
  w.ticks.push((t, dt, p) => {
    if (p.clicked) boost = 1;
    clock += Math.min(Math.max(dt, 0), .1) * (1 + boost * 1.5);
    boost = Math.max(0, boost - dt * .65);
    const phase = clock % 4;
    walkway.position.x = (a.position.x + b.position.x) / 2;
    walkway.position.y = (a.position.y + b.position.y) / 2 - .1;
    walkway.scale.x = a.position.distanceTo(b.position) + 1;
    walkway.rotation.z = Math.atan2(b.position.y - a.position.y, b.position.x - a.position.x);
    stamp.position.y = 2.1 - Math.sin(smooth(phase / .6) * Math.PI) * .7;
    certificate.rotation.z = Math.sin(t) * .06;
    certificate.visible = phase > .55;
    clerk.limbs[3].rotation.x = -.6 - Math.sin(phase * 2) * .4;
    for (const { human, sheet, phase: offset } of queue) {
      const q = (clock / 20 + offset) % 1;
      const progress = (1 - Math.cos(q * TAU)) * .5;
      human.root.position.copy(a.position).lerp(b.position, progress);
      human.root.position.y -= .02;
      human.root.position.z = 1.8 + Math.sin(q * TAU) * .7;
      human.root.rotation.y = Math.atan2(Math.sin(q * TAU), Math.cos(q * TAU) * .18);
      human.walk(clock + offset * 8, .5);
      sheet.visible = q > .12 && q < .75;
      sheet.rotation.z = .12 + Math.sin(clock * 2 + offset) * .1;
    }
  });
  // Neutral typography and invented characters, not a likeness copied from a film.
  const plaque = w.text(b, 'Был. Познакомился. Получил справку.', '#ead8b6', 6, .32); plaque.position.set(0, -.7, 1);
}

export function pizzaExpress(w: World) {
  backdrop(w, '#06182e', '#244754'); stars(w, 170);
  w.sidePadding = 7;
  const home = w.side(0, -3), factory = w.side(1, -3);
  home.name = 'pizza-home'; factory.name = 'pizza-factory';
  if (w.mobile) {
    const scale = Math.min(.66, w.c.width / w.c.height * 1.35);
    home.scale.setScalar(scale); factory.scale.setScalar(scale);
  }
  const steel = w.metal('#b9cbd0', .8, .24), dark = w.metal('#263747'), red = w.metal('#dd5f4f', .3), cream = w.metal('#dec59d', .1, .7);
  const buildings = group(home); deck(w, buildings, 7, 4);
  round(w, buildings, [4.3, 5.6, 2], [0, 2.8, -.6], cream);
  const roof = w.mesh(new T.ConeGeometry(3.5, 1.5, 4), red, buildings, v(0, 6.1, -.6)); roof.rotation.y = Math.PI / 4;
  for (const y of [1.2, 3.5]) for (const x of [-1.2, 1.2]) {
    round(w, buildings, [.92, 1.3, .1], [x, y, .46], dark);
    w.box(buildings, [.77, 1.13, .03], [x, y, .53], w.glow('#ffc77d', .5));
    w.box(buildings, [.04, 1.2, .04], [x, y, .57], steel);
    w.box(buildings, [.8, .05, .04], [x, y, .57], steel);
  }
  w.box(buildings, [3.5, .22, 1.6], [0, 2.45, 1], cream);
  railing(w, buildings, v(-1.7, 2.5, 1.7), v(1.7, 2.5, 1.7));
  plant(w, buildings, -1.4, 2.55, 1.4, .7); bake(buildings);
  const customer = person(w, home, '#6ea8cf', 1.65); customer.root.position.set(.55, 2.55, 1.1);
  const servingTable = group(home, .5, 2.7, 2.2);
  cylinder(w, servingTable, .7, .12, cream, 0, .2); cylinder(w, servingTable, .045, .4, steel);
  bake(servingTable);
  const kitchen = group(factory); deck(w, kitchen, 8.4, 5.1, '#294851');
  for (const x of [-3.7, 3.7]) { w.box(kitchen, [.22, 6, 3.5], [x, 3, -.7], dark); }
  w.box(kitchen, [7.8, .25, 4], [0, 4.6, -.7], steel);
  w.box(kitchen, [7.8, 4.4, .2], [0, 2.2, -2.5], dark);
  w.text(kitchen, 'PIZZA • AUTOMATICA', '#ffce72', 6.5, .55).position.set(0, 5.25, -.55);
  w.box(kitchen, [6.5, .4, 1.2], [0, 1.1, .3], steel);
  for (let x = -3; x <= 3; x += .3) cylinder(w, kitchen, .12, 1.17, dark, x, 1.36, .3).rotation.x = Math.PI / 2;
  round(w, kitchen, [1.65, 1.5, 1.7], [.3, 2.05, -.05], red);
  w.box(kitchen, [1.2, .65, .04], [.3, 1.9, .84], w.glow('#ff862c', 2));
  for (let i = 0; i < 7; i++) w.box(kitchen, [.12, .04, .05], [-.15 + i * .15, 2.6, .84], steel);
  for (const x of [-2.5, 2.3]) cylinder(w, kitchen, .45, .5, dark, x, .25, -.9);
  bake(kitchen);
  const arms = [-2.5, 2.3].map(x => {
    const stand = group(factory, x, 0, -.9);
    cylinder(w, stand, .15, 2.8, steel, 0, 1.4);
    w.beam(stand, v(0, 2.8, 0), v(0, 2.8, 1.7), .11, steel); bake(stand);
    const arm = group(factory, x, 2.8, .8); arm.name = 'pizza-robot';
    w.sphere(arm, .2, [0, 0, 0], red); w.beam(arm, v(), v(1.15, 0, 0), .11, steel);
    const elbow = group(arm, 1.15, 0);
    w.sphere(elbow, .17, [0, 0, 0], red); w.beam(elbow, v(), v(1.1, 0, 0), .085, steel);
    const wrist = group(elbow, 1.1, 0); wrist.name = 'pizza-robot-tip';
    cylinder(w, wrist, .09, .17, dark);
    for (const side of [-1, 1]) w.beam(wrist, v(side * .12, 0, 0), v(side * .07, -.17, 0), .025, steel);
    return { x, arm, elbow, wrist };
  });
  const lift = group(factory, 3.1, 1.4, .8); lift.name = 'pizza-lift';
  w.box(lift, [1.3, .15, 1.3], [0, 0, 0], steel);
  for (const x of [2.55, 3.65]) w.beam(factory, v(x, .3, .2), v(x, 5.8, .2), .04, steel);
  const pizza = group(w.root); pizza.name = 'pizza-payload';
  const crustMaterial = w.metal('#e9c695', 0, .85);
  cylinder(w, pizza, .55, .12, crustMaterial);
  const sauce = cylinder(w, pizza, .48, .018, w.metal('#d15b35', 0, .6), 0, .069);
  const cheese = cylinder(w, pizza, .45, .02, w.metal('#ffc66d', 0, .7), 0, .083);
  const toppings = Array.from({ length: 8 }, (_, i) => cylinder(w, pizza, .07, .024, red, Math.cos(i * 2.4) * .34, .1, Math.sin(i * 2.4) * .34));
  const rawCrust = new T.Color('#e9c695'), bakedCrust = new T.Color('#b87935');
  const drone = group(w.root), rotors: T.Group[] = []; drone.name = 'pizza-drone';
  round(w, drone, [.8, .3, .65], [0, 0, 0], cream);
  for (const x of [-.65, .65]) for (const z of [-.65, .65]) {
    w.beam(drone, v(), v(x, .06, z), .055, steel);
    cylinder(w, drone, .12, .18, dark, x, .14, z);
    const rotor = group(drone, x, .26, z); rotors.push(rotor);
    round(w, rotor, [1, .025, .09], [0, 0, 0], dark);
    w.ring(drone, .54, .02, steel, v(x, .22, z)).rotation.x = Math.PI / 2;
    w.beam(drone, v(x * .5, -.1, z * .5), v(x * .5, -.65, z * .5), .025, steel);
  }
  const sling = group(factory, 0, 4.8, .1);
  for (const x of [-1.1, 1.1]) w.beam(sling, v(x, 0, 0), v(x, 1.4, 0), .12, red);
  // A visible overhead loader carries the pizza from the lift to the drone cradle.
  const loaderRail = group(factory);
  for (const z of [.55, 1.05]) w.beam(loaderRail, v(0, 6.55, z), v(3.1, 6.55, z), .035, steel);
  for (const x of [0, 3.1]) w.beam(loaderRail, v(x, 4.75, 1.1), v(x, 6.55, 1.1), .035, steel);
  bake(loaderRail);
  const loader = group(factory); loader.name = 'pizza-loader';
  round(w, loader, [.4, .14, .65], [0, 0, 0], red);
  const loaderRod = w.mesh(new T.CylinderGeometry(.025, .025, 1, 8), steel, loader);
  const claw = group(loader);
  for (const x of [-.58, .58]) {
    w.beam(claw, v(x, .2, 0), v(x, -.1, 0), .018, steel);
    w.beam(claw, v(x, -.1, 0), v(x * .7, -.1, 0), .018, steel);
  }
  const bands = [-1.1, 1.1].map(x => {
    const mesh = w.mesh(new T.CylinderGeometry(.035, .035, 1, 8), w.metal('#cf9e56'), sling);
    return { x, mesh };
  });
  const status = w.text(factory, 'Замес → печь → лифт → доставка', '#e6d4a8', 7.5, .35); status.position.set(0, -.65, 2);
  const dock = v(), destination = v(), pos = v(), payloadDock = v(), landingPizza = v(), pickup = v();
  const factoryPoint = (x: number, y: number, z: number, out: T.Vector3) => out.set(x, y, z).multiply(factory.scale).add(factory.position);
  const homePoint = (x: number, y: number, z: number, out: T.Vector3) => out.set(x, y, z).multiply(home.scale).add(home.position);
  let clock = 0, boost = 0;
  w.ticks.push((_time, dt, pointer) => {
    if (pointer.clicked && w.c.params.react > 0) boost = 1;
    boost = Math.max(0, boost - dt * .4); clock += dt * (1 + boost * 1.5);
    const phase = pizzaPhases(clock), { t } = phase, scale = factory.scale.x;
    pizza.scale.setScalar(scale * phase.dough * (t >= 18 ? phase.servedScale : 1)); drone.scale.setScalar(scale);
    sauce.scale.setScalar(Math.max(.001, smooth((t - .6) / .8)));
    cheese.scale.setScalar(Math.max(.001, smooth((t - 1.4) / .8)));
    toppings.forEach((top, i) => { top.visible = t > 2.1 + i * .16; });
    crustMaterial.color.copy(rawCrust).lerp(bakedCrust, smooth((t - 4.5) / 1.5));
    const beltX = -2.7 + phase.conveyor * 5.8;
    arms.forEach(({ x, arm, elbow, wrist }, i) => {
      const working = i === 0 ? t < 3.4 : t >= 6 && t < 7;
      const targetX = working ? beltX - x : (i ? -.5 : .5), targetY = working ? -1.01 + Math.sin(clock * 6) * .035 : -.15;
      const pose = pizzaArmPose(targetX, targetY);
      const blend = 1 - Math.exp(-dt * 12);
      arm.rotation.z += (pose.shoulder - arm.rotation.z) * blend;
      elbow.rotation.z += (pose.elbow - elbow.rotation.z) * blend;
      wrist.rotation.z = -arm.rotation.z - elbow.rotation.z;
    });
    lift.position.y = 1.45 + phase.lift * 3.2;
    factoryPoint(0, 6.2, .1, dock);
    // The stretched launch point is also the first point of the outbound curve.
    if (t >= 10 && t < 18.5) dock.z += .7 * scale * phase.stretch;
    homePoint(.5, 3.56, 2.2, destination);
    homePoint(.5, 2.96, 2.2, landingPizza);
    payloadDock.copy(dock).add(v(0, -.6 * scale, 0));
    drone.position.copy(dock); drone.rotation.z = 0;
    if (t < 7) factoryPoint(beltX, 1.61, .8, pizza.position);
    else if (t < 10) factoryPoint(lift.position.x, lift.position.y + .16, lift.position.z, pizza.position);
    else if (t < 12) { factoryPoint(lift.position.x, lift.position.y + .16, lift.position.z, pickup); pizza.position.copy(pickup).lerp(payloadDock, phase.pickup); }
    else if (t < 17) {
      // Sling releases fast, rotors brake near the balcony: same continuous payload, never teleports mid-flight.
      const flight = phase.flight;
      drone.position.copy(dock).lerp(destination, flight).add(v(0, Math.sin(flight * Math.PI) * 2.1, 0));
      drone.rotation.z = Math.sin(flight * Math.PI) * .24;
      pizza.position.copy(drone.position).add(v(0, -.6 * scale, 0));
    } else {
      pizza.position.copy(landingPizza);
      drone.position.copy(destination).lerp(dock, phase.returning).add(v(0, Math.sin(phase.returning * Math.PI) * 2.7, 0));
    }
    customer.limbs[3].rotation.z = t >= 17 ? Math.sin(clock * 5) * .45 - .5 : 0;
    loader.visible = t >= 10 && t < 12;
    if (loader.visible) {
      const localX = (pizza.position.x - factory.position.x) / scale, localY = (pizza.position.y - factory.position.y) / scale;
      const localZ = (pizza.position.z - factory.position.z) / scale, length = 6.55 - localY - .15;
      loader.position.set(localX, 6.55, localZ); loaderRod.position.y = -length / 2; loaderRod.scale.y = length; claw.position.y = -length;
    }
    for (const { x, mesh } of bands) {
      const start = v(x, 1.4, 0), end = v(0, 1.4, t >= 10 && t < 12 ? phase.stretch * .7 : 0);
      pos.copy(start).add(end).multiplyScalar(.5); mesh.position.copy(pos);
      mesh.scale.y = start.distanceTo(end); mesh.quaternion.setFromUnitVectors(v(0, 1), end.sub(start).normalize());
    }
    rotors.forEach((r, i) => { r.rotation.y = clock * (i % 2 ? 40 : -40); });
  });
}
