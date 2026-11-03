import * as THREE from 'three';
import { stoneMaterial, type StoneUniforms } from './geometry';

/**
 * The statue with water (owner, group 1765 «В городе и в деревне»: «фонтан справа экрана, а слева добавь статую с
 * водой»): a baroque dolphin in stone, standing on its head on a fluted pedestal in a round basin of its own, its
 * body arching up and the tail curling over at the top, a stream of water from its mouth into the basin. Lathe
 * profiles for the basin and the pedestal, a swept body (elliptic sections along a spine, carried frames) for the
 * dolphin, extruded fins and flukes; the same limestone as the fountain (wet below its own water). Built at design
 * scale (metres) and scaled by STATUE_SCALE; the dolphin faces +x (towards the middle of the screen).
 *
 * The renderer places the group, draws the basin's water and lays the stream (renderer.ts), from what this returns:
 * the mouth (where the stream leaves, and which way), the basin's inner radius and water level — all at world scale
 * relative to the group's origin.
 */
export const STATUE_SCALE = 2.1;
/** Face the courtyard's spectator, rather than showing only the dolphin's side. */
export const DOLPHIN_YAW = -0.48;
const S = STATUE_SCALE;

/** Design measures (metres before STATUE_SCALE). */
const D = { basinOut: 1.12, basinIn: 0.97, rim: 0.52, floor: 0.12, water: 0.43, top: 1.56 };

const P = (r: number, y: number) => new THREE.Vector2(r, y);

function basinProfile() {
  const o = D.basinOut, i = D.basinIn, t = D.rim;
  return [
    P(0.001, D.floor), P(i - 0.03, D.floor), P(i, D.floor + 0.03), P(i, t - 0.05), P(i - 0.012, t - 0.03), P(i + 0.01, t),
    P(o - 0.02, t + 0.005), P(o + 0.03, t - 0.015), P(o + 0.045, t - 0.045), P(o + 0.02, t - 0.07), P(o, t - 0.09),
    P(o - 0.02, 0.14), P(o + 0.02, 0.1), P(o + 0.06, 0.07), P(o + 0.07, 0.0),
  ];
}

function pedestalProfile() {
  return [
    P(0.33, D.floor), P(0.33, 0.22), P(0.31, 0.24), P(0.3, 0.27), P(0.315, 0.3), P(0.3, 0.33), P(0.25, 0.36),
    P(0.225, 0.4), P(0.205, 0.46), P(0.19, 1.2), P(0.2, 1.24), P(0.22, 1.26), P(0.205, 1.29), P(0.24, 1.33),
    P(0.29, 1.38), P(0.32, 1.42), P(0.34, 1.44), P(0.34, 1.5), P(0.31, 1.52), P(0.29, D.top - 0.01), P(0.001, D.top),
  ];
}

/** The pedestal's shaft fluted: 16 shallow channels between y 0.46 and 1.2. */
function flute(geo: THREE.LatheGeometry) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let k = 0; k < pos.count; k += 1) {
    const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k);
    if (y < 0.5 || y > 1.16) continue;
    const r = Math.hypot(x, z);
    if (r < 0.1) continue;
    const a = Math.atan2(z, x);
    const ends = Math.min(1, (y - 0.5) / 0.05, (1.16 - y) / 0.05);
    const ch = Math.max(0, Math.cos(a * 16)) ** 2 * 0.014 * ends;
    pos.setXYZ(k, (x / r) * (r - ch), y, (z / r) * (r - ch));
  }
  geo.computeVertexNormals();
}

/** The dolphin's spine (design units, in the xy plane, the mouth first) and its girth along it. */
const SPINE = [
  new THREE.Vector3(0.44, 1.69, 0), new THREE.Vector3(0.3, 1.66, 0), new THREE.Vector3(0.12, 1.72, 0),
  new THREE.Vector3(-0.04, 1.9, 0), new THREE.Vector3(-0.16, 2.16, 0), new THREE.Vector3(-0.14, 2.46, 0),
  new THREE.Vector3(0.0, 2.7, 0), new THREE.Vector3(0.2, 2.82, 0), new THREE.Vector3(0.38, 2.83, 0),
];
// A big head (the baroque dolphin is mostly head and mouth), then a body tapering to a thin tail stock.
const GIRTH: [number, number][] = [
  [0, 0.045], [0.03, 0.085], [0.08, 0.17], [0.15, 0.24], [0.24, 0.255], [0.36, 0.215], [0.5, 0.165], [0.64, 0.12],
  [0.78, 0.08], [0.9, 0.055], [1, 0.045],
];
const girth = (u: number) => {
  for (let k = 1; k < GIRTH.length; k += 1) {
    if (u <= GIRTH[k][0]) {
      const [u0, r0] = GIRTH[k - 1];
      const [u1, r1] = GIRTH[k];
      const f = (u - u0) / (u1 - u0);
      return r0 + (r1 - r0) * (f * f * (3 - 2 * f));
    }
  }
  return GIRTH[GIRTH.length - 1][1];
};

/** The body: elliptic sections along the spine (lateral is z throughout, the back is z × tangent). */
function dolphinBody(curve: THREE.CatmullRomCurve3) {
  const rings = 120;
  const sides = 40;
  const pos: number[] = [];
  const idx: number[] = [];
  const lat = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i <= rings; i += 1) {
    const u = i / rings;
    const c = curve.getPointAt(u);
    const t = curve.getTangentAt(u);
    const back = new THREE.Vector3().crossVectors(lat, t).normalize();
    const r = girth(u);
    // Laterally a little narrower; a ridge along the back towards the tail (the tail stock is keeled).
    const a = r * (0.82 - 0.25 * Math.max(0, (u - 0.7) / 0.3));
    for (let k = 0; k < sides; k += 1) {
      const th = (k / sides) * Math.PI * 2;
      const cb = Math.cos(th), sl = Math.sin(th);
      // The head: a rounded melon over a beak; the mouth's line as a slight groove.
      const keel = u > 0.65 ? 1 + 0.35 * Math.max(0, Math.abs(cb)) ** 8 * ((u - 0.65) / 0.35) : 1;
      const groove = u < 0.1 ? 1 - 0.12 * Math.exp(-((cb + 0.1) ** 2) / 0.01) * (1 - u / 0.1) : 1;
      const rb = r * keel * groove;
      pos.push(c.x + back.x * cb * rb + lat.x * sl * a, c.y + back.y * cb * rb + lat.y * sl * a, c.z + back.z * cb * rb + lat.z * sl * a);
    }
  }
  for (let i = 0; i < rings; i += 1) {
    for (let k = 0; k < sides; k += 1) {
      const a = i * sides + k, b = i * sides + ((k + 1) % sides);
      idx.push(a, b, a + sides, b, b + sides, a + sides);
    }
  }
  // Caps: the mouth's tip and the tail's end.
  const tip = pos.length / 3;
  const c0 = curve.getPointAt(0).addScaledVector(curve.getTangentAt(0), -0.025);
  pos.push(c0.x, c0.y, c0.z);
  const end = pos.length / 3;
  const c1 = curve.getPointAt(1).addScaledVector(curve.getTangentAt(1), 0.03);
  pos.push(c1.x, c1.y, c1.z);
  for (let k = 0; k < sides; k += 1) {
    idx.push(tip, (k + 1) % sides, k);
    idx.push(end, rings * sides + k, rings * sides + ((k + 1) % sides));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** A fin: a flat outline (x along `along`, y along `out`), extruded thin with a bevel, placed at `at`. */
function fin(outline: [number, number][], at: THREE.Vector3, along: THREE.Vector3, out: THREE.Vector3, thick: number) {
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.6, bevelSize: thick * 0.6, bevelSegments: 3, curveSegments: 16 });
  geo.translate(0, 0, -thick / 2);
  const n = new THREE.Vector3().crossVectors(along, out).normalize();
  const m = new THREE.Matrix4().makeBasis(along.clone().normalize(), out.clone().normalize(), n);
  m.setPosition(at);
  geo.applyMatrix4(m);
  geo.computeVertexNormals();
  return geo;
}

export function buildStatue(uniforms: StoneUniforms, center: { value: THREE.Vector2 }) {
  const group = new THREE.Group();
  const stone = stoneMaterial(uniforms, false, { center, pool: D.water * S, basinIn: D.basinIn * S });
  const add = (geo: THREE.BufferGeometry) => {
    const m = new THREE.Mesh(geo, stone);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  add(new THREE.LatheGeometry(basinProfile(), 128));
  const ped = new THREE.LatheGeometry(pedestalProfile(), 128);
  flute(ped);
  add(ped);
  // A cushion of carved waves on the pedestal's top, where the head rests.
  for (let k = 0; k < 7; k += 1) {
    const a = (k / 7) * Math.PI * 2;
    const g = new THREE.SphereGeometry(0.09, 20, 12);
    g.scale(1.3, 0.55, 1);
    g.rotateY(-a);
    g.translate(Math.cos(a) * 0.2, D.top + 0.015, Math.sin(a) * 0.2);
    add(g);
  }
  const curve = new THREE.CatmullRomCurve3(SPINE, false, 'centripetal');
  add(dolphinBody(curve));
  const lat = new THREE.Vector3(0, 0, 1);
  const frame = (u: number) => {
    const c = curve.getPointAt(u);
    const t = curve.getTangentAt(u);
    const back = new THREE.Vector3().crossVectors(lat, t).normalize();
    return { c, t, back };
  };
  // The dorsal fin, swept back towards the tail.
  {
    const { c, t, back } = frame(0.5);
    add(fin([[-0.14, 0], [0.2, 0], [0.26, 0.08], [0.24, 0.27], [0.1, 0.17]], c.clone().addScaledVector(back, girth(0.5) * 0.85), t, back, 0.035));
  }
  // The flippers, out from the sides and back along the belly.
  for (const side of [-1, 1]) {
    const { c, t, back } = frame(0.25);
    const out = lat.clone().multiplyScalar(side).addScaledVector(back, -0.5).normalize();
    add(fin([[-0.09, 0], [0.09, 0], [0.2, 0.15], [0.22, 0.27], [0.1, 0.2]], c.clone().addScaledVector(out, girth(0.25) * 0.75), t, out, 0.016));
  }
  // The flukes: two swept lobes across the tail's end, in its lateral plane.
  for (const side of [-1, 1]) {
    const { c, t } = frame(0.985);
    const out = lat.clone().multiplyScalar(side);
    add(fin([[-0.06, 0], [0.05, 0], [0.24, 0.17], [0.38, 0.44], [0.18, 0.4], [0.0, 0.22]], c, t, out, 0.04));
  }
  // Eyes: small bosses over the beak.
  for (const side of [-1, 1]) {
    const { c, back } = frame(0.13);
    const e = new THREE.SphereGeometry(0.04, 16, 10);
    e.translate(c.x + back.x * 0.07, c.y + back.y * 0.07, side * girth(0.13) * 0.74);
    add(e);
  }
  group.scale.setScalar(S);
  group.rotation.y = DOLPHIN_YAW;
  // The mouth: where the stream leaves (just ahead of the beak), and which way the water goes (ahead and a little up).
  const m0 = curve.getPointAt(0);
  const t0 = curve.getTangentAt(0).negate();
  return {
    group,
    stone,
    // World-oriented offsets, including scale exactly once: the ballistic stream must still leave the beak.
    mouth: new THREE.Vector3(m0.x + t0.x * 0.03, m0.y + t0.y * 0.03, 0).multiplyScalar(S).applyAxisAngle(new THREE.Vector3(0, 1, 0), DOLPHIN_YAW),
    mouthDir: new THREE.Vector3(t0.x, Math.max(t0.y, 0) + 0.25, 0).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), DOLPHIN_YAW),
    basinIn: D.basinIn * S,
    basinOut: (D.basinOut + 0.07) * S,
    water: D.water * S,
  };
}

export type Statue = ReturnType<typeof buildStatue>;
