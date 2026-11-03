import { Body, Box, Sphere, Cylinder, ConvexPolyhedron, Vec3, Quaternion, World, Broadphase, GSSolver, Material, ContactMaterial, HingeConstraint } from 'cannon-es';

/** This exhibit has hundreds of fixed ramp segments but only six moving bodies: never compare static/static pairs. */
export class SkylineBroadphase extends Broadphase {
  constructor() { super(); this.useBoundingBoxes = true; }
  collisionPairs(world: World, a: Body[], b: Body[]) {
    const bodies = world.bodies;
    for (let i = 0; i < bodies.length; i++) {
      const moving = bodies[i];
      if (moving.type === Body.STATIC || moving.sleepState === Body.SLEEPING) continue;
      for (let j = 0; j < bodies.length; j++) {
        const other = bodies[j];
        if (j === i || (other.type !== Body.STATIC && other.sleepState !== Body.SLEEPING && j < i)) continue;
        if (this.needBroadphaseCollision(moving, other)) this.intersectionTest(moving, other, a, b);
      }
    }
  }
}

export type PinballPoint = { x: number; y: number; z: number };
export type SkylinePart = { body: Body; size: [number, number, number]; kind: 'floor' | 'rail' | 'ramp' | 'wire' | 'skirt' | 'bumper' | 'flipper' | 'rotor' | 'bridge' | 'target'; color: number; route?: string; hull?: { vertices: [number, number, number][]; faces: number[][] } };
export type SkylineEvent = { kind: 'bumper' | 'target' | 'multiball' | 'kicker' | 'ramp'; color: number; x: number; y: number; z: number; points: number };
export const SKYLINE_STEP = 1 / 300;
export const SKYLINE_RADIUS = .11;
export const SKYLINE_RAMPS = [
  { name: 'skyline', color: 0, width: .68, points: [
    [-1.4, 0, 1.55], [-1.50, .15, .25], [-1.50, .65, -1.3], [-1.3, 1.25, -2.6],
    [-.45, 1.5, -3.3], [.45, 1.4, -3.25], [1.1, 1.05, -2.5], [1.25, .8, -1.05],
  ] },
  { name: 'helix', color: 1, width: .60, points: [
    [-.3, 0, 2.0], [.3, .12, .85], [.55, .55, -.35], [.05, .96, -1.2],
    [-.55, .9, -1.4], [-.80, .65, -.65], [-.6, .38, .1], [-.2, .24, .22], [.25, 0, -.65],
  ] },
  { name: 'return', color: 2, width: .62, points: [[1.25, .8, -.05], [1.65, .62, 1.05], [1.55, .28, 2.05], [1.1, 0, 2.55]] },
] as const;

/** Sampled centre-lines are shared by collision decks, rims, wireforms and support geometry. */
export function sampleSkylineRamp(points: readonly (readonly number[])[], subdivisions = 4): PinballPoint[] {
  const out: PinballPoint[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[Math.max(0, i - 1)], b = points[i], c = points[i + 1], d = points[Math.min(points.length - 1, i + 2)];
    for (let j = 0; j < subdivisions; j++) {
      const t = j / subdivisions, t2 = t * t, t3 = t2 * t;
      const at = (k: number) => .5 * (2 * b[k] + (-a[k] + c[k]) * t + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t2 + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * t3);
      out.push({ x: at(0), y: Math.max(0, at(1)), z: at(2) });
    }
  }
  const last = points[points.length - 1]; out.push({ x: last[0], y: last[1], z: last[2] });
  return out;
}

export function createSkylinePinball(onEvent: (event: SkylineEvent) => void = () => {}) {
  const world = new World({ gravity: new Vec3(0, -9.81, 2.1), allowSleep: true });
  world.broadphase = new SkylineBroadphase();
  const solver = new GSSolver(); solver.iterations = 12; solver.tolerance = 1e-5; world.solver = solver;
  // Match the installed Cannon impulse-friction convention at our fixed step (same safeguard as the workshop).
  world.frictionGravity = world.gravity.scale(SKYLINE_STEP);
  const steel = new Material('skyline-ball'), deck = new Material('skyline-deck'), rubber = new Material('skyline-rubber');
  world.addContactMaterial(new ContactMaterial(steel, deck, { friction: .065, restitution: .20, contactEquationStiffness: 1e8, contactEquationRelaxation: 4 }));
  world.addContactMaterial(new ContactMaterial(steel, steel, { friction: .04, restitution: .82 }));
  world.addContactMaterial(new ContactMaterial(steel, rubber, { friction: .1, restitution: .86 }));
  const parts: SkylinePart[] = [], metadata = new Map<number, SkylinePart>();
  const add = (kind: SkylinePart['kind'], position: PinballPoint, size: [number, number, number], color = 0, mass = 0, material = deck) => {
    const shape = kind === 'bumper' ? new Cylinder(size[0] / 2, size[0] / 2, size[1], 16) : new Box(new Vec3(size[0] / 2, size[1] / 2, size[2] / 2));
    const body = new Body({ mass, material, shape, position: new Vec3(position.x, position.y, position.z), collisionFilterGroup: mass ? 4 : 1, collisionFilterMask: mass ? 9 : 8, linearDamping: .02, angularDamping: .08 });
    world.addBody(body);
    const part: SkylinePart = { body, kind, size, color }; parts.push(part); metadata.set(body.id, part); return part;
  };
  add('floor', { x: 0, y: -.13, z: 0 }, [4.65, .26, 8.4]);
  const rail = (a: PinballPoint, b: PinballPoint, width = .07, height = .32, color = 1, kind: 'rail' | 'wire' = 'rail') => {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, length = Math.hypot(dx, dy, dz);
    const part = add(kind, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }, [width, height, length + .018], color);
    part.body.quaternion.setFromEuler(-Math.atan2(dy, Math.hypot(dx, dz)), Math.atan2(dx, dz), 0, 'YXZ');
    return part;
  };
  const outline = [[-2.18, 3.15], [-2.22, -2.9], [-1.65, -3.8], [0, -4.05], [1.6, -3.8], [2.22, -2.9], [2.22, 3.7]];
  for (let i = 1; i < outline.length; i++) rail({ x: outline[i - 1][0], y: .2, z: outline[i - 1][1] }, { x: outline[i][0], y: .2, z: outline[i][1] });
  rail({ x: 1.80, y: .19, z: 3.8 }, { x: 1.80, y: .19, z: -2.65 });
  rail({ x: -2.18, y: .18, z: 2.4 }, { x: -1.1, y: .18, z: 3.1 });
  rail({ x: 1.1, y: .18, z: 3.1 }, { x: 1.8, y: .18, z: 2.6 });
  const routes = SKYLINE_RAMPS.map(route => ({ ...route, samples: sampleSkylineRamp(route.points) }));
  const sectionSide = (points: PinballPoint[], index: number) => {
    const a = points[Math.max(0, index - 1)], b = points[Math.min(points.length - 1, index + 1)], length = Math.hypot(b.x - a.x, b.z - a.z);
    return { x: (b.z - a.z) / length, z: -(b.x - a.x) / length };
  };
  for (const route of routes) for (let i = 1; i < route.samples.length; i++) {
    const a = route.samples[i - 1], b = route.samples[i], dx = b.x - a.x, dz = b.z - a.z, horizontal = Math.hypot(dx, dz), length = Math.hypot(horizontal, b.y - a.y);
    const orientation = new Quaternion(); orientation.setFromEuler(-Math.atan2(b.y - a.y, horizontal), Math.atan2(dx, dz), 0, 'YXZ');
    const normal = orientation.vmult(new Vec3(0, 1, 0));
    const part = add('ramp', { x: (a.x + b.x) / 2 - normal.x * .035, y: (a.y + b.y) / 2 - normal.y * .035, z: (a.z + b.z) / 2 - normal.z * .035 }, [route.width, .07, length + .012], route.color);
    part.body.quaternion.copy(orientation); part.route = route.name;
    const sideA = sectionSide(route.samples, i - 1), sideB = sectionSide(route.samples, i);
    if (route.name !== 'return') {
      // Shared cross-sections close the inner bends; independent rectangular planks would leave triangular holes.
      const w = route.width / 2;
      const corners = [a, a, b, b].map((p, j) => { const side = j < 2 ? sideA : sideB, sign = j % 2 ? 1 : -1; return { x: p.x + side.x * w * sign, z: p.z + side.z * w * sign }; }).sort((a, b) => a.x - b.x || a.z - b.z);
      const cross = (a: { x: number; z: number }, b: { x: number; z: number }, c: { x: number; z: number }) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
      const half = (points: typeof corners) => { const out: typeof corners = []; for (const p of points) { while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 1e-10) out.pop(); out.push(p); } return out; };
      const lower = half(corners), upper = half([...corners].reverse()), polygon = [...lower.slice(0, -1), ...upper.slice(0, -1)], n = polygon.length;
      // Tight inner bends can turn a quad concave. Convex XZ footprints and affine slope planes keep Cannon faces valid.
      const worldVertices: [number, number, number][] = [false, true].flatMap(top => polygon.map(p => [p.x, a.y + (b.y - a.y) * ((p.x - a.x) * dx + (p.z - a.z) * dz) / (horizontal * horizontal) - (top ? 0 : .07), p.z] as [number, number, number]));
      const center = worldVertices.reduce((sum, p) => ({ x: sum.x + p[0] / (2 * n), y: sum.y + p[1] / (2 * n), z: sum.z + p[2] / (2 * n) }), { x: 0, y: 0, z: 0 });
      part.body.position.set(center.x, center.y, center.z);
      const vertices: [number, number, number][] = worldVertices.map(p => [p[0] - center.x, p[1] - center.y, p[2] - center.z]);
      const faces = [Array.from({ length: n }, (_, j) => j), Array.from({ length: n }, (_, j) => 2 * n - 1 - j), ...Array.from({ length: n }, (_, j) => [j, j + n, (j + 1) % n + n, (j + 1) % n])];
      part.body.shapes.length = 0; part.body.shapeOffsets.length = 0; part.body.shapeOrientations.length = 0;
      part.body.quaternion.set(0, 0, 0, 1); part.body.addShape(new ConvexPolyhedron({ vertices: vertices.map(v => new Vec3(...v)), faces })); part.hull = { vertices, faces };
    }
    if (route.name === 'return') {
      // Three independent wire supports, not an invisible broad floor under the wireform.
      part.body.shapes.length = 0; part.body.shapeOffsets.length = 0; part.body.shapeOrientations.length = 0;
      for (const x of [-.20, 0, .20]) part.body.addShape(new Box(new Vec3(.024, .025, (length + .012) / 2)), new Vec3(x, 0, 0));
    }
    if (route.name !== 'return' && Math.min(a.y, b.y) < .4) {
      // Seal the low ramp's underside. Otherwise a ground-level ball can wedge into the narrowing 0–22 cm gap.
      const w = route.width / 2, z = horizontal / 2 + .006, lo = -.1, hiA = a.y - .035, hiB = b.y - .035;
      const centerY = (lo + Math.min(hiA, hiB)) / 2;
      const vertices: [number, number, number][] = [[-w, lo - centerY, -z], [w, lo - centerY, -z], [w, hiA - centerY, -z], [-w, hiA - centerY, -z], [-w, lo - centerY, z], [w, lo - centerY, z], [w, hiB - centerY, z], [-w, hiB - centerY, z]];
      const faces = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [3, 7, 6, 2], [0, 4, 7, 3], [1, 2, 6, 5]];
      const body = new Body({ mass: 0, material: deck, shape: new ConvexPolyhedron({ vertices: vertices.map(v => new Vec3(...v)), faces }), position: new Vec3((a.x + b.x) / 2, centerY, (a.z + b.z) / 2), collisionFilterGroup: 1, collisionFilterMask: 8 });
      body.quaternion.setFromEuler(0, Math.atan2(dx, dz), 0); world.addBody(body);
      const skirt: SkylinePart = { body, kind: 'skirt', size: [route.width, Math.max(hiA, hiB) - lo, horizontal], color: route.color, hull: { vertices, faces } };
      parts.push(skirt); metadata.set(body.id, skirt);
    }
    for (const sign of [-1, 1]) {
      const w = route.width / 2 * sign;
      rail({ x: a.x + sideA.x * w, y: a.y + .13, z: a.z + sideA.z * w }, { x: b.x + sideB.x * w, y: b.y + .13, z: b.z + sideB.z * w }, .05, .22, route.color, 'wire');
    }
  }
  const hinge = (part: SkylinePart, axis: Vec3) => {
    const anchor = new Body({ mass: 0, position: part.body.position.clone(), collisionFilterGroup: 0 }); world.addBody(anchor);
    world.addConstraint(new HingeConstraint(anchor, part.body, { pivotA: new Vec3(), pivotB: new Vec3(), axisA: axis, axisB: axis, collideConnected: false, maxForce: 1e5 }));
  };
  const bridge = add('bridge', { x: 1.25, y: .765, z: -.55 }, [.62, .07, 1.0], 2, .18); hinge(bridge, new Vec3(1, 0, 0));
  for (const x of [-.31, .31]) bridge.body.addShape(new Box(new Vec3(.02, .10, .5)), new Vec3(x, .12, 0));
  for (const z of [-.98, -.12]) add('rail', { x: 1.25, y: .58, z }, [.50, .08, .08], 2);
  const rotor = add('rotor', { x: .7, y: .18, z: 1.55 }, [1.0, .19, .13], 2, .12, rubber); hinge(rotor, new Vec3(0, 1, 0));
  for (const x of [-.43, .43]) rotor.body.addShape(new Sphere(.085), new Vec3(x, .03, 0));
  const bumpers = [[-.65, -2.15], [.65, -1.8], [.75, -.1]].map(([x, z], i) => add('bumper', { x, y: .2, z }, [.60, .40, .60], i, 0, rubber));
  const targets = [-.95, 0, .95].map((x, i) => ({ part: add('target', { x, y: .19, z: -3.45 }, [.38, .38, .12], i, 0, rubber), down: false }));
  const flippers = [-1, 1].map((sign, i) => {
    const pivot = new Vec3(sign * 1.1, .16, 3.1), rest = i ? Math.PI + .25 : -.25;
    const part = add('flipper', { x: pivot.x, y: pivot.y, z: pivot.z }, [.98, .22, .22], i, 0, rubber);
    part.body.shapes.length = 0; part.body.shapeOffsets.length = 0; part.body.shapeOrientations.length = 0;
    part.body.addShape(new Box(new Vec3(.49, .11, .11)), new Vec3(.49, 0, 0));
    part.body.type = Body.KINEMATIC; part.body.collisionFilterGroup = 2; part.body.updateMassProperties();
    part.body.quaternion.setFromEuler(0, rest, 0);
    return { part, pivot, angle: rest, rest, active: i ? Math.PI - .60 : .60 };
  });
  const balls = Array.from({ length: 2 }, () => {
    const body = new Body({ mass: .08, material: steel, shape: new Sphere(SKYLINE_RADIUS), position: new Vec3(2.02, SKYLINE_RADIUS + .01, 3.5), linearDamping: .018, angularDamping: .02, collisionFilterGroup: 0, collisionFilterMask: 15, sleepSpeedLimit: .01 });
    world.addBody(body); body.sleep(); return { body, active: false, route: '', rampUntil: 0, magnet: 0, magnetUntil: 0 };
  });
  const cooldown = new Map<number, number>();
  let time = 0, accumulator = 0, score = 0, shots = 0, multiball = false, combo = 1, comboUntil = 0, previousBumper = -1, nudgeUntil = 0, disposed = false;
  const emit = (kind: SkylineEvent['kind'], color: number, position: PinballPoint, points: number) => { score += points; onEvent({ kind, color, ...position, points }); };
  const activate = (ball: typeof balls[number]) => {
    ball.active = true; ball.route = ''; ball.rampUntil = time; ball.magnet = 0; ball.magnetUntil = time;
    ball.body.position.set(2.02, SKYLINE_RADIUS + .01, 3.5); ball.body.velocity.set(-.1, 0, -12); ball.body.angularVelocity.set(-30, 0, 0);
    ball.body.force.setZero(); ball.body.torque.setZero(); ball.body.collisionFilterGroup = 8; ball.body.wakeUp(); ball.body.aabbNeedsUpdate = true;
  };
  for (const ball of balls) ball.body.addEventListener('collide', (event: { body: Body }) => {
    if (!ball.active) return;
    const part = metadata.get(event.body.id); if (!part) return;
    if (part.kind === 'ramp' && part.route !== ball.route) {
      ball.route = part.route!;
      if (time >= ball.rampUntil) { ball.rampUntil = time + 1.2; emit('ramp', part.color, ball.body.position, 75); }
    }
    if (part.kind === 'floor') ball.route = '';
    const i = bumpers.indexOf(part);
    if (i >= 0 && time > (cooldown.get(part.body.id) ?? -1)) {
      const dx = ball.body.position.x - part.body.position.x, dz = ball.body.position.z - part.body.position.z, length = Math.hypot(dx, dz) || 1;
      ball.body.applyImpulse(new Vec3(dx / length * .19, .015, dz / length * .19)); cooldown.set(part.body.id, time + .18);
      combo = previousBumper >= 0 && previousBumper !== i && time < comboUntil ? Math.min(5, combo + 1) : 1;
      previousBumper = i; comboUntil = time + 3; emit('bumper', i, part.body.position, 100 * combo);
    }
    const target = targets.find(t => t.part === part);
    if (target && !target.down) { target.down = true; part.body.collisionFilterGroup = 0; emit('target', part.color, part.body.position, 250); }
  });
  // addBody may cache the initial axis-aligned bounds before we orient a deck/rail or replace its compound shapes.
  for (const part of parts) part.body.aabbNeedsUpdate = true;
  return { world, parts, routes, bridge, rotor, bumpers, targets, flippers, balls,
    get time() { return time; }, get score() { return score; }, get shots() { return shots; }, get combo() { return combo; },
    get activeBalls() { return Number(balls[0].active) + Number(balls[1].active); },
    update(dt: number, input: { launch: boolean; left: boolean; right: boolean; nudge?: boolean }) {
      if (disposed) return;
      if (input.launch && !balls.some(b => b.active)) {
        activate(balls[0]); shots++; multiball = false;
        for (const t of targets) { t.down = false; t.part.body.collisionFilterGroup = 1; }
      }
      if (input.nudge && time > nudgeUntil) {
        nudgeUntil = time + .8;
        for (const b of balls) if (b.active) b.body.applyImpulse(new Vec3(b.body.position.x < 0 ? .025 : -.025, .018, -.065));
      }
      accumulator += Math.max(0, Math.min(.05, dt));
      while (accumulator >= SKYLINE_STEP) {
        accumulator -= SKYLINE_STEP; time += SKYLINE_STEP;
        if (time > comboUntil) { combo = 1; previousBumper = -1; }
        for (let i = 0; i < flippers.length; i++) {
          const f = flippers[i], target = (i ? input.right : input.left) ? f.active : f.rest;
          // Kinematic angular velocity is passed to contact equations, not a teleported visual paddle.
          f.part.body.angularVelocity.set(0, (target - f.angle) * 30, 0);
        }
        const q = bridge.body.quaternion;
        const angle = Math.atan2(2 * (q.w * q.x + q.y * q.z), 1 - 2 * (q.x * q.x + q.y * q.y));
        bridge.body.torque.x += -angle * 1.8 - bridge.body.angularVelocity.x * .14;
        for (const b of balls) if (b.active) {
          // A powered magnetic scoop: damped field capture followed by one real solenoid impulse.
          const p = b.body.position, dx = p.x - 1.45, dz = p.z + 3.45;
          if (p.y < .35 && Math.hypot(dx, dz) < .30 && time > b.magnetUntil) {
            b.magnet += SKYLINE_STEP;
            b.body.force.x += -dx * 5 - b.body.velocity.x * .4;
            b.body.force.z += -dz * 5 - b.body.velocity.z * .4;
            if (b.magnet > .35) { b.body.applyImpulse(new Vec3(-.18, .12, .30)); b.magnet = 0; b.magnetUntil = time + 1.5; emit('kicker', 2, p, 150); }
          } else b.magnet = 0;
          if (b.body.velocity.length() > 22) b.body.velocity.scale(22 / b.body.velocity.length(), b.body.velocity);
        }
        const resting = !balls.some(b => b.active) && rotor.body.sleepState === Body.SLEEPING && bridge.body.sleepState === Body.SLEEPING
          && flippers.every(f => Math.abs(f.part.body.angularVelocity.y) < .01);
        if (!resting) world.step(SKYLINE_STEP);
        for (const f of flippers) {
          const q = f.part.body.quaternion; f.angle = 2 * Math.atan2(q.y, q.w);
          // Keep the angle on its local turn when the quaternion wraps at ±π.
          while (f.angle < f.rest - Math.PI) f.angle += Math.PI * 2;
          while (f.angle > f.rest + Math.PI) f.angle -= Math.PI * 2;
        }
        for (const b of balls) if (b.active && (b.body.position.z > 4.3 || b.body.position.y < -.8 || Math.abs(b.body.position.x) > 4)) {
          b.active = false; b.body.collisionFilterGroup = 0; b.body.velocity.setZero(); b.body.angularVelocity.setZero(); b.body.sleep();
          b.body.position.set(2.02, SKYLINE_RADIUS + .01, 3.5);
        }
        if (!multiball && targets.every(t => t.down)) {
          multiball = true; const extra = balls.find(b => !b.active); if (extra) activate(extra);
          emit('multiball', 2, { x: 0, y: 1, z: -2 }, 1000);
        }
      }
    },
    dispose() { disposed = true; for (const c of [...world.constraints]) world.removeConstraint(c); for (const b of [...world.bodies]) world.removeBody(b); },
  };
}
