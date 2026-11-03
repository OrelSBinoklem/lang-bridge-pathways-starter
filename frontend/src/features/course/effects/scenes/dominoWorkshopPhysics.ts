import { Body, Box, Sphere, Vec3, World, SAPBroadphase, GSSolver, HingeConstraint, Material, ContactMaterial } from 'cannon-es';

export type WorkshopPart = { body: Body; kind: 'domino' | 'ball' | 'lever' | 'rotor' | 'pendulum' | 'cradle' | 'platform' | 'rail'; size: [number, number, number]; color: number; direction: Vec3; initial: Vec3; anchor?: Vec3 };
export type TrackPoint = { x: number; y: number; z: number };
export const DOMINO_SIZE: [number, number, number] = [.10, .94, .5];

/** Real rigid bodies: no successor list, timed activations, scripted rotations or re-arming. */
export function createDominoWorkshop() {
  const world = new World({ gravity: new Vec3(0, -22, 0), allowSleep: true });
  // Cannon 0.20 clamps friction lambda as an impulse, although Narrowphase supplies μmg.
  // Convert that limit to μmg·dt; otherwise small boxes stick as if glued at 120 Hz.
  world.frictionGravity = world.gravity.scale(1 / 120);
  world.broadphase = new SAPBroadphase(world);
  const solver = new GSSolver(); solver.iterations = 16; solver.tolerance = .0001; world.solver = solver;
  const solid = new Material('workshop-solid');
  const enamel = new Material('domino-enamel');
  const steel = new Material('polished-steel');
  const tabletop = new Material('workshop-tabletop');
  world.addContactMaterial(new ContactMaterial(solid, solid, { friction: .42, restitution: .06, contactEquationStiffness: 1e8, contactEquationRelaxation: 4 }));
  world.addContactMaterial(new ContactMaterial(enamel, enamel, { friction: .12, restitution: .12 }));
  world.addContactMaterial(new ContactMaterial(enamel, solid, { friction: .018, restitution: .02 }));
  // The broad table/ground catches fallen tiles; keep the narrow transfer tracks smooth.
  world.addContactMaterial(new ContactMaterial(enamel, tabletop, { friction: .06, restitution: .02 }));
  world.addContactMaterial(new ContactMaterial(steel, tabletop, { friction: .16, restitution: .12 }));
  world.addContactMaterial(new ContactMaterial(solid, tabletop, { friction: .42, restitution: .06 }));
  world.addContactMaterial(new ContactMaterial(steel, steel, { friction: .02, restitution: .94 }));
  world.addContactMaterial(new ContactMaterial(steel, solid, { friction: .16, restitution: .12 }));
  world.addContactMaterial(new ContactMaterial(steel, enamel, { friction: .08, restitution: .2 }));
  const parts: WorkshopPart[] = [], dynamic: WorkshopPart[] = [], tracks: TrackPoint[][] = [];
  // Match the visible ground beneath the exhibit: falling objects must not fall through it.
  world.addBody(new Body({ mass: 0, material: tabletop, shape: new Box(new Vec3(75, .05, 75)), position: new Vec3(0, -.77, 0) }));
  const hinges: { body: Body; anchor: Vec3; pivot: Vec3 }[] = [];
  function add(kind: WorkshopPart['kind'], x: number, y: number, z: number, size: [number, number, number], color: number, mass = 0, yaw = 0) {
    const shape = kind === 'ball' || kind === 'pendulum' || kind === 'cradle' ? new Sphere(size[0] / 2) : new Box(new Vec3(size[0] / 2, size[1] / 2, size[2] / 2));
    const body = new Body({ mass, material: kind === 'domino' ? enamel : shape instanceof Sphere ? steel : solid, shape, position: new Vec3(x, y, z), linearDamping: .015, angularDamping: .025, sleepSpeedLimit: .04, sleepTimeLimit: .7 });
    body.quaternion.setFromEuler(0, yaw, 0); world.addBody(body);
    const part: WorkshopPart = { body, kind, size, color, direction: new Vec3(Math.cos(yaw), 0, -Math.sin(yaw)), initial: body.position.clone() };
    parts.push(part); if (mass) dynamic.push(part); return part;
  }
  function hinged(part: WorkshopPart, anchor: Vec3, pivot: Vec3, axis: Vec3) {
    const fixed = new Body({ mass: 0, position: anchor.clone() }); world.addBody(fixed);
    world.addConstraint(new HingeConstraint(fixed, part.body, { pivotA: new Vec3(), pivotB: pivot, axisA: axis, axisB: axis, collideConnected: false, maxForce: 1e6 }));
    part.anchor = anchor; hinges.push({ body: part.body, anchor, pivot });
    part.body.sleepSpeedLimit = .015;
  }
  add('platform', 0, -.35, 0, [25, .7, 20], 4).body.material = tabletop;
  function spaced(points: TrackPoint[], spacing: number) {
    const result = [points[0]]; let remaining = spacing;
    for (let i = 1; i < points.length; i++) {
      let a = points[i - 1]; const b = points[i]; let length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      while (length >= remaining) {
        const t = remaining / length;
        a = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
        result.push(a); length -= remaining; remaining = spacing;
      }
      remaining -= length;
    }
    const last = points.at(-1)!;
    if (remaining > spacing * .65 && result.length > 1) result.pop();
    result.push(last); return result;
  }
  function track(points: TrackPoint[], color: number, dominos = true, walls = false) {
    if (dominos) points = spaced(points, .46);
    tracks.push(points);
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1], dx = b.x - a.x, dz = b.z - a.z, dy = b.y - a.y;
      const length = Math.hypot(dx, dz), yaw = -Math.atan2(dz, dx);
      // Domino terraces are level treads, not a slope that topples the entire helix by itself.
      const platform = add('platform', dominos ? a.x : (a.x + b.x) / 2, (dominos ? a.y : (a.y + b.y) / 2) - .1, dominos ? a.z : (a.z + b.z) / 2, [Math.hypot(length, dy) + .035, .2, walls ? 1.05 : 1.16], color, 0, yaw);
      if (!dominos) platform.body.quaternion.setFromEuler(0, yaw, Math.atan2(dy, length), 'YXZ');
      if (walls) for (const side of [-1, 1]) {
        const rail = add('rail', (a.x + b.x) / 2 - dz / length * .51 * side, (a.y + b.y) / 2 + .18, (a.z + b.z) / 2 + dx / length * .51 * side, [Math.hypot(length, dy) + .06, .4, .09], 5, 0, yaw);
        rail.body.quaternion.copy(platform.body.quaternion);
      }
      if (dominos) {
        const piece = add('domino', a.x, a.y + DOMINO_SIZE[1] / 2 + .015, a.z, DOMINO_SIZE, color, .12, yaw);
        piece.direction.set(dx / length, 0, dz / length);
      }
    }
  }
  function line(a: TrackPoint, b: TrackPoint, spacing = .48) {
    const count = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / spacing);
    return Array.from({ length: count + 1 }, (_, i) => ({ x: a.x + (b.x - a.x) * i / count, y: a.y + (b.y - a.y) * i / count, z: a.z + (b.z - a.z) * i / count }));
  }
  // One complete turn, descending three units; the exit passes underneath the entrance.
  const helix = Array.from({ length: 57 }, (_, i) => {
    const t = i / 56, angle = Math.PI + t * Math.PI * 2;
    return { x: -4 + 4.2 * Math.cos(angle), y: 6 - 3 * t, z: -1 + 4.2 * Math.sin(angle) };
  });
  track(helix, 0);
  const bridge = [
    ...line(helix.at(-1)!, { x: -8.2, y: 2.8, z: -5.4 }).slice(0, -1),
    ...Array.from({ length: 10 }, (_, i) => { const a = Math.PI + i / 9 * Math.PI / 2; return { x: -7.2 + Math.cos(a), y: 2.8, z: -5.4 + Math.sin(a) }; }).slice(0, -1),
    ...line({ x: -7.2, y: 2.8, z: -6.4 }, { x: 8.2, y: 2.8, z: -6.4 }),
  ];
  track(bridge, 1);
  const chute = [
    ...line({ x: 8.2, y: 2.8, z: -6.4 }, { x: 8.6, y: 2.8, z: -6.4 }, .2).slice(0, -1),
    ...Array.from({ length: 18 }, (_, i) => { const t = i / 18, a = -Math.PI / 2 + t * Math.PI / 2; return { x: 8.6 + Math.cos(a), y: 2.8 - .4 * t, z: -5.4 + Math.sin(a) }; }),
    ...Array.from({ length: 32 }, (_, i) => { const t = i / 31; return { x: 9.6 - .6 * t * t * (3 - 2 * t), y: 2.4 - 1.45 * t, z: -5.4 + 6.2 * t }; }),
  ];
  track(chute, 2, false, true);
  const ball = add('ball', 8.5, 3.12, -6.4, [.62, .62, .62], 5, .42); ball.direction.set(1, 0, 0);
  // Ball lands on the input end; its weight moves the hinged lever, not a scripted animation.
  const lever = add('lever', 9, .6, 2, [.85, .16, 2.5], 2, .24);
  hinged(lever, new Vec3(9, .6, 2), new Vec3(), new Vec3(1, 0, 0)); lever.direction.set(0, 0, 1);
  // Physical stops limit the seesaw's travel.
  add('platform', 9, .12, .95, [.9, .24, .3], 4);
  add('platform', 9, .12, 3.05, [.9, .24, .3], 4);
  const approach = [
    ...line({ x: 9, y: .22, z: 3.45 }, { x: 8.6, y: .22, z: 4.1 }).slice(0, -1),
    ...line({ x: 8.6, y: .22, z: 4.1 }, { x: 4.1, y: .22, z: 4.1 }).slice(0, -1),
    ...line({ x: 4.1, y: .22, z: 4.1 }, { x: 3.9, y: .22, z: 4.6 }),
  ];
  track(approach, 2);
  const rotor = add('rotor', 3.2, .7, 5.2, [1.9, .18, .2], 5, .16);
  rotor.body.addShape(new Box(new Vec3(.1, .09, .95)));
  for (const [x, z] of [[.83, 0], [-.83, 0], [0, .83], [0, -.83]]) rotor.body.addShape(new Box(new Vec3(.17, .35, .17)), new Vec3(x, .1, z));
  rotor.body.updateMassProperties(); rotor.body.angularDamping = .08;
  hinged(rotor, rotor.body.position.clone(), new Vec3(), new Vec3(0, 1, 0)); rotor.direction.set(0, 0, 1);
  const lower = [
    ...line({ x: 3.2, y: .12, z: 6.35 }, { x: 2.8, y: .12, z: 6.8 }).slice(0, -1),
    ...line({ x: 2.8, y: .12, z: 6.8 }, { x: -.85, y: .12, z: 6.8 }),
  ];
  track(lower, 3);
  const pendulum = add('pendulum', -1.5, .65, 6.8, [.58, .58, .58], 5, .14);
  hinged(pendulum, new Vec3(-1.5, 3.05, 6.8), new Vec3(0, 2.4, 0), new Vec3(0, 0, 1)); pendulum.direction.set(-1, 0, 0);
  const spiral = [
    ...line({ x: -2.15, y: .12, z: 6.8 }, { x: -3.7, y: .12, z: 6.8 }).slice(0, -1),
    ...Array.from({ length: 51 }, (_, i) => { const t = i / 50, a = t * Math.PI * 3; const r = 2.1 - 1.3 * t; return { x: -5.8 + r * Math.cos(a), y: .12, z: 6.8 + r * Math.sin(a) }; }),
  ];
  track(spiral, 3);
  // A freely interacting Newton cradle, with a short independent output fan.
  for (let i = 0; i < 5; i++) {
    const p = add('cradle', .5 + i * .56, .8, 9, [.56, .56, .56], 5, .22);
    hinged(p, new Vec3(.5 + i * .56, 2.65, 9), new Vec3(0, 1.85, 0), new Vec3(0, 0, 1)); p.direction.set(1, 0, 0);
  }
  track(line({ x: 3.7, y: .12, z: 9 }, { x: 8, y: .12, z: 9 }), 2);
  let accumulator = 0, time = 0, pushes = 0;
  // Only a collision or a user impulse wakes an initially resting piece. No auto-start.
  for (let i = 0; i < 30; i++) world.step(1 / 120);
  for (const p of dynamic) p.body.sleep();
  (world.broadphase as SAPBroadphase).autoDetectAxis();
  function push(index: number) {
    const p = dynamic[index]; if (!p) return;
    const b = p.body; b.wakeUp(); pushes++;
    const impulse = p.direction.scale(p.kind === 'domino' ? .24 : p.kind === 'ball' ? .7 : .45);
    const point = p.kind === 'domino' ? new Vec3(0, .35, 0) : p.kind === 'rotor' ? new Vec3(.8, 0, 0) : p.kind === 'lever' ? new Vec3(0, 0, -1) : new Vec3();
    if (p.kind === 'lever') impulse.set(0, -1, 0);
    b.applyImpulse(impulse, point);
  }
  return {
    world, parts, dynamic, tracks, hinges, push,
    get time() { return time; }, get pushes() { return pushes; },
    update(dt: number) {
      if (!Number.isFinite(dt)) return;
      accumulator += Math.max(0, Math.min(.06, dt));
      while (accumulator + 1e-10 >= 1 / 120) { world.step(1 / 120); accumulator -= 1 / 120; time += 1 / 120; }
    },
    dispose() { for (const constraint of [...world.constraints]) world.removeConstraint(constraint); for (const body of [...world.bodies]) world.removeBody(body); },
  };
}
