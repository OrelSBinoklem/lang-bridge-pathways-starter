import { Body, Box, Sphere, Vec3, World, SAPBroadphase, GSSolver, Quaternion, HingeConstraint, PointToPointConstraint, Material, ContactMaterial } from 'cannon-es';

export type WorkshopPart = { body: Body; kind: 'domino' | 'ball' | 'lever' | 'rotor' | 'pendulum' | 'cradle' | 'platform' | 'rail'; size: [number, number, number]; color: number; direction: Vec3; initial: Vec3; lane?: number; anchor?: Vec3; hingeAxis?: Vec3; guard?: boolean; kickPoint?: Vec3; kickStrength?: number; name?: string };
export type TrackPoint = { x: number; y: number; z: number };
export const DOMINO_SIZE: [number, number, number] = [.10, .94, .5];

/** Freeze retains the collider and mass: nearby activity and clicks restore dynamics.
 * Only spent, supported tiles qualify. Never freeze a slow airborne turning point.
 * A 30 Hz spatial hash checks nearby moving shapes, not every pair of tiles.
 */
export function createLocalDominoSleep(world: World, parts: WorkshopPart[]) {
  const tiles = parts.filter(p => p.kind === 'domino').map(p => p.body);
  const frozen = new Set<Body>();
  const used = new Set<Body>();
  const quiet = new Map<Body, { time: number; position: Vec3; rotation: Quaternion }>();
  const grid = new Map<string, Body[]>(), moving = new Map<Body, number>();
  const supported = new Set<Body>(), seen = new Set<Body>();
  let ticks = 0, checks = 0, freezes = 0, wakes = 0;
  const freeze = (body: Body) => { body.sleep(); body.type = Body.STATIC; frozen.add(body); world.broadphase.dirty = true; };
  const wake = (body: Body) => { if (frozen.delete(body)) { body.type = Body.DYNAMIC; world.broadphase.dirty = true; } quiet.delete(body); used.add(body); body.wakeUp(); };
  const cells = (body: Body, margin: number, visit: (key: string) => void) => {
    const { lowerBound: a, upperBound: b } = body.aabb;
    for (let x = Math.floor((a.x - margin) / 2); x <= Math.floor((b.x + margin) / 2); x++)
      for (let y = Math.floor((a.y - margin) / 2); y <= Math.floor((b.y + margin) / 2); y++)
        for (let z = Math.floor((a.z - margin) / 2); z <= Math.floor((b.z + margin) / 2); z++) visit(`${x},${y},${z}`);
  };
  return {
    get stats() { return { frozen: tiles.filter(b => b.sleepState === Body.SLEEPING).length, active: tiles.filter(b => b.sleepState !== Body.SLEEPING).length, freezes, wakes, checks }; },
    wake,
    update() {
      if (++ticks % 4) return;
      grid.clear(); moving.clear(); supported.clear(); checks = 0;
      for (const { body } of parts) {
        if (body.sleepState === Body.SLEEPING) continue;
        const speed = body.velocity.length() + body.angularVelocity.length() * body.boundingRadius;
        if (speed < .5) continue;
        body.updateAABB();
        const margin = .18 + speed / 30; moving.set(body, margin);
        cells(body, margin, key => { const bucket = grid.get(key); if (bucket) bucket.push(body); else grid.set(key, [body]); });
      }
      for (const contact of world.contacts) {
        if (contact.ni.y < -.35) supported.add(contact.bi);
        if (contact.ni.y > .35) supported.add(contact.bj);
      }
      for (const body of tiles) {
        if (body.sleepState !== Body.SLEEPING) used.add(body);
        else if (used.has(body) && !frozen.has(body)) freeze(body);
        if (body.sleepState === Body.SLEEPING && !frozen.has(body)) continue;
        body.updateAABB(); seen.clear(); let activity = false;
        cells(body, 0, key => {
          for (const other of grid.get(key) ?? []) {
            if (other === body || seen.has(other) || activity) continue;
            seen.add(other); checks++;
            const margin = moving.get(other)!;
            const a = body.aabb.lowerBound, b = body.aabb.upperBound, c = other.aabb.lowerBound, d = other.aabb.upperBound;
            if (a.x <= d.x + margin && b.x >= c.x - margin && a.y <= d.y + margin && b.y >= c.y - margin && a.z <= d.z + margin && b.z >= c.z - margin) activity = true;
          }
        });
        if (activity || (frozen.has(body) && body.velocity.length() + body.angularVelocity.length() * body.boundingRadius > .5)) {
          quiet.delete(body);
          if (frozen.has(body)) { wake(body); wakes++; }
          continue;
        }
        // Static sleeping colliders cannot be woken repeatedly by solver jitter.
        // The swept local-activity query restores full dynamics before a new impact.
        if (frozen.has(body)) continue;
        if (body.sleepState === Body.SLEEPING) continue;
        if (!supported.has(body) || body.velocity.lengthSquared() > .0225 || body.angularVelocity.lengthSquared() > .25) {
          quiet.delete(body); continue;
        }
        const q = quiet.get(body), r = body.quaternion;
        if (!q || q.position.distanceSquared(body.position) > .0016 || Math.abs(q.rotation.x*r.x + q.rotation.y*r.y + q.rotation.z*r.z + q.rotation.w*r.w) < .99875) {
          quiet.set(body, { time: 0, position: body.position.clone(), rotation: r.clone() }); continue;
        }
        q.time += 1 / 30;
        if (q.time >= .9) { freeze(body); quiet.delete(body); freezes++; }
      }
    },
    dispose() { for (const body of frozen) body.type = Body.DYNAMIC; world.broadphase.dirty = true; grid.clear(); moving.clear(); frozen.clear(); used.clear(); quiet.clear(); supported.clear(); seen.clear(); },
  };
}

/** Real rigid bodies: no successor list, timed activations, scripted rotations or re-arming. */
export function createDominoArchipelago() {
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
    part.anchor = anchor; part.hingeAxis = axis; hinges.push({ body: part.body, anchor, pivot });
    part.body.sleepSpeedLimit = .015;
  }
  add('platform', 0, -.35, 0, [32, .7, 24], 4).body.material = tabletop;
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
  function track(points: TrackPoint[], color: number, dominos = true, walls = false, openEntry = false, protect = false) {
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
      // Real side panels catch spent tiles before they can shortcut to a lower lane.
      // They are rendered as clear safety screens, not invisible collision filtering.
      if (dominos && (a.y > .7 || protect) && (!openEntry || i >= 2)) for (const side of [-1, 1]) {
        const guard = add('rail', (a.x + b.x) / 2 - dz / length * .61 * side,
          (a.y + b.y) / 2 + .55, (a.z + b.z) / 2 + dx / length * .61 * side,
          [Math.hypot(length, dy) + .05, 1.2, .06], 5, 0, yaw);
        guard.body.quaternion.setFromEuler(0, yaw, Math.atan2(dy, length), 'YXZ');
        guard.guard = true;
      }
      if (dominos) {
        const piece = add('domino', a.x, a.y + DOMINO_SIZE[1] / 2 + .015, a.z, DOMINO_SIZE, color, .12, yaw);
        piece.direction.set(dx / length, 0, dz / length);
        piece.lane = tracks.length - 1;
      }
    }
  }
  function line(a: TrackPoint, b: TrackPoint, spacing = .48) {
    const count = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / spacing);
    return Array.from({ length: count + 1 }, (_, i) => ({ x: a.x + (b.x - a.x) * i / count, y: a.y + (b.y - a.y) * i / count, z: a.z + (b.z - a.z) * i / count }));
  }

  const launches: { title: string; index: number }[] = [];
  const stations: { title: string; x: number; z: number; width: number }[] = [];
  const register = (title: string, part: WorkshopPart) => { launches.push({ title, index: dynamic.indexOf(part) }); };
  const helix = Array.from({ length: 89 }, (_, i) => {
    const t = i / 88, a = -Math.PI / 2 + t * Math.PI * 2.5;
    return { x: -8 + 3.1 * Math.cos(a), y: 6.8 - 3.6 * t, z: -1 + 3.1 * Math.sin(a) };
  });
  track(helix, 0); register('Винт', dynamic[0]);
  // Close the open back of the top landing too: the first tile's base can slide
  // backwards while its top falls forward, otherwise it drops onto the next turn.
  const start = tracks[0][0], next = tracks[0][1];
  const startLength = Math.hypot(next.x - start.x, next.z - start.z);
  const startDx = (next.x - start.x) / startLength, startDz = (next.z - start.z) / startLength;
  add('rail', start.x - startDx * .25, start.y + .55, start.z - startDz * .25,
    [.06, 1.2, 1.28], 5, 0, -Math.atan2(startDz, startDx)).guard = true;
  track([...line(helix.at(-1)!, { x: -3.2, y: 3.2, z: 2 }).slice(0, -1),
    ...line({ x: -3.2, y: 3.2, z: 2 }, { x: .6, y: 3.2, z: 2 })], 1);
  // One hinged paddle feeds three lanes, including the return path to the hoop.
  add('platform', 1, 3.1, 2.65, [1.2, .2, 3.8], 5);
  const fork = add('lever', 1, 3.7, 2.65, [.12, 1, 3.2], 5, .17);
  fork.name = 'Раздвоитель'; fork.kickPoint = new Vec3(0, .4, 0); fork.kickStrength = .3;
  hinged(fork, new Vec3(1.06, 3.21, 2.65), new Vec3(.06, -.5, 0), new Vec3(0, 0, 1));
  for (const side of [-1, 1]) {
    const points = Array.from({ length: 30 }, (_, i) => {
      const t = i / 29;
      return { x: 1.55 + t * (side < 0 ? 7.45 : 4.45), y: 3.2 - t * (side < 0 ? 1.2 : 1.8), z: 2 + side * (.65 + 3 * t * t * (3 - 2 * t)) };
    });
    track(points, side < 0 ? 2 : 3, true, false, true);
  }
  // Three alternating slopes form a marble switchback; rail collisions redirect the ball.
  const corners = [{ x: 9.2, y: 2, z: -1.65 }, { x: 12, y: 1.6, z: -3.9 },
    { x: 8.6, y: .95, z: -6.2 }, { x: 11.8, y: .25, z: -8.6 }];
  const chute: TrackPoint[] = [];
  let previous = corners[0];
  for (let i = 1; i < corners.length - 1; i++) {
    const a = corners[i - 1], b = corners[i], c = corners[i + 1];
    const blend = (other: TrackPoint) => {
      const t = Math.min(.4, 1.2 / Math.hypot(other.x - b.x, other.z - b.z));
      return { x: b.x + (other.x - b.x) * t, y: b.y + (other.y - b.y) * t, z: b.z + (other.z - b.z) * t };
    };
    const entry = blend(a), exit = blend(c);
    chute.push(...line(previous, entry, .18).slice(0, -1));
    for (let j = 0; j < 16; j++) {
      const t = j / 16, u = 1 - t;
      chute.push({ x: u * u * entry.x + 2 * u * t * b.x + t * t * exit.x,
        y: u * u * entry.y + 2 * u * t * b.y + t * t * exit.y,
        z: u * u * entry.z + 2 * u * t * b.z + t * t * exit.z });
    }
    previous = exit;
  }
  chute.push(...line(previous, corners.at(-1)!, .18));
  track(chute, 2, false, true);
  const marble = add('ball', 9.4, 2.3, -1.8, [.62, .62, .62], 5, .42);
  marble.direction.set(.78, 0, -.63); marble.name = 'Шаровой серпантин'; register('Шар', marble);
  // The marble arrives diagonally. A real hinged paddle distributes its impact
  // across all three rows instead of relying on a lucky glancing hit.
  add('platform', 11.95, .02, -9.15, [2.4, .2, 1.05], 5);
  const finishGate = add('lever', 11.95, .63, -9.15, [2.2, .94, .12], 5, .17);
  finishGate.name = 'Финишный распределитель'; finishGate.direction.set(0, 0, -1);
  finishGate.kickPoint = new Vec3(0, .35, 0); finishGate.kickStrength = .2;
  hinged(finishGate, new Vec3(11.95, .16, -9.15), new Vec3(0, -.47, 0), new Vec3(1, 0, 0));
  for (const branch of [-1, 0, 1]) track(line(
    { x: 11.95 + branch * .52, y: .12, z: -9.65 },
    { x: 11.9 + branch * 1.1, y: .12, z: -11 }), branch + 1);
  // A balanced drawbridge is free on its hinge and held by physical travel stops.
  const bridge = add('lever', 6.8, .95, 5.65, [2.3, .18, 1.05], 2, .38);
  bridge.name = 'Качающийся мост'; bridge.direction.set(0, -1, 0);
  bridge.kickPoint = new Vec3(-.9, 0, 0); bridge.kickStrength = .8;
  hinged(bridge, bridge.body.position.clone(), new Vec3(), new Vec3(0, 0, 1));
  for (const x of [5.9, 7.7]) add('platform', x, .3, 5.65, [.28, .6, 1], 4);
  // A vertical six-spoke paddle wheel. The ring, spokes and paddles all have colliders.
  const wheel = add('rotor', 9.9, 2.05, 5.65, [.3, .3, .5], 5, .65);
  wheel.name = 'Лопастное колесо'; wheel.direction.set(0, 1, 0); wheel.kickPoint = new Vec3(1.4, 0, 0); wheel.kickStrength = 4;
  function boxOn(part: WorkshopPart, size: [number, number, number], offset: Vec3, angle = 0) {
    const q = new Quaternion(); q.setFromAxisAngle(new Vec3(0, 0, 1), angle);
    part.body.addShape(new Box(new Vec3(size[0] / 2, size[1] / 2, size[2] / 2)), offset, q);
    part.body.updateMassProperties();
  }
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    boxOn(wheel, [1.55, .1, .16], new Vec3(.78 * Math.cos(a), .78 * Math.sin(a), 0), a);
    boxOn(wheel, [.28, .65, .8], new Vec3(1.6 * Math.cos(a), 1.6 * Math.sin(a), 0), a);
  }
  wheel.body.quaternion.setFromEuler(0, 0, -.25);
  hinged(wheel, wheel.body.position.clone(), new Vec3(), new Vec3(0, 0, 1)); register('Колесо', wheel);
  // A pin-jointed connecting rod transfers the bridge stroke to the wheel.
  // The old gap only worked when a loose tile happened to fly across it.
  const bridgePin = new Vec3(1, 0, -.65), wheelPin = new Vec3(-1.4, 0, -.65);
  const pinA = bridge.body.pointToWorldFrame(bridgePin), pinB = wheel.body.pointToWorldFrame(wheelPin);
  const rodLength = pinA.distanceTo(pinB);
  const rod = add('lever', (pinA.x + pinB.x) / 2, (pinA.y + pinB.y) / 2, 5, [rodLength, .10, .12], 5, .035);
  rod.name = 'Соединительный шатун'; rod.body.quaternion.setFromEuler(0, 0, Math.atan2(pinB.y - pinA.y, pinB.x - pinA.x));
  for (const joint of [new PointToPointConstraint(bridge.body, bridgePin, rod.body, new Vec3(-rodLength / 2, 0, 0), 1e6),
    new PointToPointConstraint(wheel.body, wheelPin, rod.body, new Vec3(rodLength / 2, 0, 0), 1e6)]) {
    joint.collideConnected = false; world.addConstraint(joint);
  }
  // Cannon wakes collision partners, not the rest of a pinned dynamic assembly.
  // Wake the connected rigid-body island together; no velocity/impulse is added.
  const linkageBodies = [bridge.body, rod.body, wheel.body];
  let wakingLinkage = false;
  const wakeLinkage = () => {
    if (wakingLinkage) return;
    wakingLinkage = true; for (const body of linkageBodies) body.wakeUp(); wakingLinkage = false;
  };
  for (const body of linkageBodies) body.addEventListener('wakeup', wakeLinkage);
  // The lower paddle strikes near a tile's centre and can just slide it upright.
  // A bottom-hinged receiver converts that short stroke into a reliable falling tip.
  add('platform', 10.82, .02, 5.65, [.5, .2, 1.05], 5);
  const wheelGate = add('lever', 10.82, .59, 5.65, [.10, .94, .7], 2, .08);
  wheelGate.name = 'Выход колеса'; wheelGate.kickPoint = new Vec3(0, .3, 0);
  hinged(wheelGate, new Vec3(10.87, .12, 5.65), new Vec3(.05, -.47, 0), new Vec3(0, 0, 1));
  track(line({ x: 11.35, y: .12, z: 5.65 }, { x: 13.6, y: .12, z: 5.65 }), 2);
  // The suspended hammer and a folded domino ribbon occupy the middle of the exhibit.
  const hammer = add('lever', -1.1, .85, -5.4, [.85, .55, .7], 5, .45);
  hammer.name = 'Подвесной молот'; hammer.direction.set(-1, 0, 0); hammer.kickPoint = new Vec3(); hammer.kickStrength = .9;
  boxOn(hammer, [.08, 3.1, .08], new Vec3(0, 1.55, 0));
  hinged(hammer, new Vec3(-1.1, 3.95, -5.4), new Vec3(0, 3.1, 0), new Vec3(0, 0, 1)); register('Молот', hammer);
  track([...line({ x: -1.95, y: .12, z: -5.4 }, { x: -5.1, y: .12, z: -5.4 }).slice(0, -1),
    ...Array.from({length: 22}, (_, i) => { const a = Math.PI / 2 + i / 21 * Math.PI; return { x: -5.1 + 1.15 * Math.cos(a), y: .12, z: -6.55 + 1.15 * Math.sin(a) }; }).slice(0, -1),
    ...line({ x: -5.1, y: .12, z: -7.7 }, { x: 5.4, y: .12, z: -7.7 })], 3, true, false, false, true);
  // A hollow rolling hoop (not a solid sphere) drives the low front lane.
  const hoop = add('rotor', -11.3, .94, 9.2, [.025, .025, .025], 5, .85);
  hoop.name = 'Катящееся кольцо'; hoop.direction.set(1, 0, 0); hoop.kickPoint = new Vec3(0, .7, 0); hoop.kickStrength = 1.3;
  for (let i = 0; i < 24; i++) {
    const a = i * Math.PI / 12;
    boxOn(hoop, [.12, .245, .48], new Vec3(.86 * Math.cos(a), .86 * Math.sin(a), 0), a);
  }
  register('Кольцо', hoop);
  track(line({ x: -9.5, y: .12, z: 9.2 }, { x: -.5, y: .12, z: 9.2 }), 0);
  const bell = add('pendulum', .2, .74, 9.2, [.8, .8, .8], 5, .22);
  bell.name = 'Финальный подвес'; hinged(bell, new Vec3(.2, 3, 9.2), new Vec3(0, 2.26, 0), new Vec3(0, 0, 1));
  bell.direction.set(1, 0, 0);
  // A second elevated arc crosses the low ring lane without touching it.
  track(Array.from({ length: 35 }, (_, i) => {
    const t = i / 34, a = Math.PI + t * Math.PI;
    return { x: 3.2 + 2.6 * Math.cos(a), y: 2.4 - 1.5 * t, z: 9.6 + 2.1 * Math.sin(a) };
  }), 1);
  // A visible descending return lane connects the shared fork to the left hoop.
  // Append it after the existing lanes so their diagnostic IDs stay stable.
  const returnLane = [
    ...Array.from({ length: 25 }, (_, i) => {
      const t = i / 24, a = -Math.PI / 2 + t * Math.PI;
      return { x: 1.55 + 1.2 * Math.cos(a), y: 3.2 - .6 * t, z: 5.15 + 1.2 * Math.sin(a) };
    }).slice(0, -1),
    ...line({ x: 1.55, y: 2.6, z: 6.35 }, { x: -12.8, y: 1.2, z: 6.35 }).slice(0, -1),
    ...Array.from({ length: 40 }, (_, i) => {
      const t = i / 39, a = -Math.PI / 2 - t * Math.PI;
      return { x: -12.8 + 1.425 * Math.cos(a), y: 1.2 - 1.08 * t, z: 7.775 + 1.425 * Math.sin(a) };
    }).slice(0, -1),
    ...line({ x: -12.8, y: .12, z: 9.2 }, { x: -12.05, y: .12, z: 9.2 }),
  ];
  track(returnLane, 1, true, false, true);
  // A separate hammer circuit now continues through five pendulums. Their impact
  // travels through real steel contacts; there is no callback launching the exit.
  for (let i = 0; i < 5; i++) {
    const x = 5.55 + i * .525;
    const bead = add('cradle', x, .40, -7.7, [.52, .52, .52], 5, .10);
    bead.name = `Колыбель Ньютона ${i + 1}`; bead.direction.set(1, 0, 0);
    hinged(bead, new Vec3(x, 2.9, -7.7), new Vec3(0, 2.5, 0), new Vec3(0, 0, 1));
  }
  const cradleGate = add('lever', 8.02, .62, -7.7, [.10, .94, .7], 2, .08);
  cradleGate.name = 'Маятниковый переводчик'; cradleGate.kickPoint = new Vec3(0, .3, 0);
  add('platform', 8.07, .05, -7.7, [.5, .14, 1.05], 5);
  hinged(cradleGate, new Vec3(8.07, .15, -7.7), new Vec3(.05, -.47, 0), new Vec3(0, 0, 1));
  // The exit curls behind the hammer ribbon, then returns in the opposite direction.
  // Keep the paths separated in space instead of filtering their collisions.
  track([
    ...Array.from({ length: 30 }, (_, i) => {
      const a = i / 29 * Math.PI;
      return { x: 8.5 + .95 * Math.sin(a), y: .12, z: -8.65 + .95 * Math.cos(a) };
    }).slice(0, -1),
    ...line({ x: 8.5, y: .12, z: -9.6 }, { x: -3.8, y: .12, z: -9.6 }),
  ], 2, true, false, true, true);
  const gong = add('pendulum', -4.1, .45, -9.6, [.9, .9, .9], 5, .15);
  gong.name = 'Обратный финиш'; gong.direction.set(-1, 0, 0);
  hinged(gong, new Vec3(-4.1, 2.8, -9.6), new Vec3(0, 2.35, 0), new Vec3(0, 0, 1));
  stations.push(
    {title:'01 / ВИНТОВАЯ БАШНЯ', x:-9,z:-9.4,width:4.5},
    {title:'02 / РАЗВИЛКА',x:1,z:3.7,width:3},
    {title:'03 / СЕРПАНТИН',x:10,z:-.3,width:3},
    {title:'04 / ЛОПАСТНОЕ КОЛЕСО',x:9.5,z:7.3,width:4.6},
    {title:'05 / МОЛОТ',x:-1,z:-3.5,width:3},
    {title:'06 / КАТЯЩЕЕСЯ КОЛЬЦО',x:-6,z:10.8,width:5},
    {title:'07 / ПЯТЬ МАЯТНИКОВ',x:5.8,z:-5.4,width:4.2},
    {title:'08 / ОБРАТНЫЙ ФИНИШ',x:1,z:-11.2,width:4.5},
  );
  let accumulator = 0, time = 0, pushes = 0;
  // Only a collision or a user impulse wakes an initially resting piece. No auto-start.
  for (let i = 0; i < 30; i++) world.step(1 / 120);
  for (const p of dynamic) p.body.sleep();
  (world.broadphase as SAPBroadphase).autoDetectAxis();
  const localSleep = createLocalDominoSleep(world, dynamic);
  function push(index: number) {
    const p = dynamic[index]; if (!p) return;
    const b = p.body; localSleep.wake(b); pushes++;
    const impulse = p.direction.scale(p.kickStrength ?? (p.kind === 'domino' ? .055 : p.kind === 'ball' ? .7 : .45));
    const point = p.kickPoint ?? (p.kind === 'domino' ? new Vec3(0, .35, 0) : p.kind === 'rotor' ? new Vec3(.8, 0, 0) : p.kind === 'lever' ? new Vec3(0, 0, -1) : new Vec3());
    b.applyImpulse(impulse, point);
  }
  return {
    world, parts, dynamic, tracks, hinges, push, launches, stations,
    get time() { return time; }, get pushes() { return pushes; },
    get sleepStats() { return localSleep.stats; },
    update(dt: number) {
      if (!Number.isFinite(dt)) return;
      accumulator += Math.max(0, Math.min(.06, dt));
      while (accumulator + 1e-10 >= 1 / 120) {
        // Idle exhibits need no collision/constraint pass at all; camera controls
        // still render normally, and push() makes the next tick active again.
        if (dynamic.some(p => p.body.sleepState !== Body.SLEEPING)) { world.step(1 / 120); localSleep.update(); }
        accumulator -= 1 / 120; time += 1 / 120;
      }
    },
    dispose() { localSleep.dispose(); for (const body of linkageBodies) body.removeEventListener('wakeup', wakeLinkage); for (const constraint of [...world.constraints]) world.removeConstraint(constraint); for (const body of [...world.bodies]) world.removeBody(body); },
  };
}
