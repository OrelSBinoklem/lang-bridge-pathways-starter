import { T, v, type World } from './world';
import { bake, group } from './storyKit';
import type { TrainMaterials } from './platskartMaterials';

/** Brief drumming after long pauses; fingers lift from, never push through, their resting plane. */
export function trainFingerLift(time: number, finger: number, side: number) {
  const cycle = ((time + (side < 0 ? 7.2 : 0)) % 17 + 17) % 17;
  const local = cycle - 6 - finger * .075;
  if (local < 0 || local >= 1.08) return 0;
  const beat = local % .36;
  return beat < .24 ? Math.sin(beat / .24 * Math.PI) ** 2 * (side < 0 ? .1 : .23) : 0;
}

/** Rounded fingertip is part of the tube itself, not a separate ball or exposed tube opening. */
function digit(w: World, parent: T.Object3D, points: T.Vector3[], radius: number, m: TrainMaterials) {
  const curve = new T.CatmullRomCurve3(points), geometry = new T.TubeGeometry(curve, 24, radius, 12, false);
  const pos = geometry.attributes.position;
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, center = curve.getPointAt(t);
    const tip = Math.max(0, (t - .84) / .16);
    const taper = (1 - .25 * t) * Math.sqrt(Math.max(0, 1 - tip * tip));
    for (let j = 0; j <= 12; j++) {
      const k = i * 13 + j;
      pos.setXYZ(k, center.x + (pos.getX(k) - center.x) * taper, center.y + (pos.getY(k) - center.y) * taper, center.z + (pos.getZ(k) - center.z) * taper);
    }
  }
  geometry.computeVertexNormals(); w.mesh(geometry, m.skin, parent);
  const t = .77, q = curve.getPointAt(t), tangent = curve.getTangentAt(t);
  const across = v().crossVectors(tangent, v(0, 1, 0)).normalize();
  const dorsal = v().crossVectors(across, tangent).normalize();
  const nail = w.sphere(parent, 1, q.addScaledVector(dorsal, radius * (1 - .25 * t) * .95).toArray() as [number, number, number], m.nail);
  nail.name = 'train-flush-nail';
  nail.scale.set(radius * .61, .00075, radius * .86);
  nail.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(across, dorsal, tangent.clone().negate()));
}

export function passengerHand(w: World, parent: T.Object3D, m: TrainMaterials, side: number) {
  const root = group(parent); root.name = side > 0 ? 'train-right-hand' : 'train-left-hand';
  const sleeve = group(root); sleeve.name = 'train-tailored-sleeve';
  const geometry = new T.CylinderGeometry(.044, .075, 1, 40, 44, true);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), a = Math.atan2(z, x), t = y + .5;
    const folds = Math.sin(t * 76 + Math.sin(a * 3) * 1.4) * .0038 * Math.exp(-(((t - .8) / .24) ** 2))
      + Math.sin(t * 31 - a * 2) * .0024 + Math.sin(a * 5 + t * 12) * .0014;
    const r = Math.hypot(x, z) + folds;
    pos.setXYZ(i, Math.cos(a) * r, y, Math.sin(a) * r * .91);
  }
  geometry.computeVertexNormals(); w.mesh(geometry, m.olive, sleeve);
  // A pair of raised stitched seams and the rolled, ribbed cuff follow the sleeve.
  for (const a of [.4, Math.PI + .4]) {
    const points = Array.from({length: 23}, (_, i) => { const t = i / 22, r = .075 - t * .031; return v(Math.cos(a) * (r + .001), t - .5, Math.sin(a) * (r + .001) * .91); });
    w.tube(sleeve, points, m.stitch, .0008);
  }
  const cuff = group(root); cuff.name = 'train-ribbed-cuff';
  const cuffMesh = w.mesh(new T.CylinderGeometry(.042, .045, .052, 40), m.olive, cuff);
  for (let i = 0; i < 9; i++) { const ring = w.ring(cuff, .043, .0011, m.stitch, v(0, (i - 4) * .0055, 0)); ring.rotation.x = Math.PI / 2; }
  cuffMesh.scale.z = .92; bake(cuff); bake(sleeve);
  const hand = group(root); hand.name = 'train-anatomical-hand';
  const wrist = w.mesh(new T.CapsuleGeometry(.021, .046, 6, 20), m.skin, hand, v(0, -.001, .046)); wrist.rotation.x = Math.PI / 2; wrist.scale.set(1.14, 1, .8);
  const palm = w.mesh(new T.SphereGeometry(1, 40, 32), m.skin, hand);
  palm.scale.set(.038, .019, .063);
  const thenar = w.sphere(hand, .025, [-side * .022, -.004, .007], m.skin); thenar.scale.set(.72, .55, 1.25);
  // Bake only the stationary palm. Baking its children would erase the finger pivots.
  bake(hand);
  const fingers: T.Group[] = [];
  const lengths = [.057, .067, .062, .048];
  for (let i = 0; i < 4; i++) {
    const finger = group(hand, (i - 1.5) * .019, 0, -.043 + (i === 3 ? .008 : 0)); finger.name = 'train-finger';
    fingers.push(finger);
    const l = lengths[i], r = i === 3 ? .0074 : .0088;
    digit(w, finger, [v(0, 0, .005), v(0, .001, -l * .3), v(0, -.004, -l * .68), v(0, -.012, -l * .9), v(0, -.014, -l)], r, m);
    bake(finger);
  }
  const thumb = group(hand); thumb.name = 'train-thumb';
  digit(w, thumb, [v(-side * .025, -.002, .022), v(-side * .04, -.004, .005), v(-side * .053, -.008, -.014), v(-side * .057, -.01, -.028)], .0105, m);
  bake(thumb);
  hand.userData.phalanges = 15; hand.userData.fingers = 5;
  const direction = v(), up = v(0, 1, 0);
  return { hand, update(start: T.Vector3, end: T.Vector3, time = 0) {
    direction.subVectors(end, start);
    const length = direction.length(); direction.normalize();
    sleeve.position.copy(start).add(end).multiplyScalar(.5).addScaledVector(direction, -.04); sleeve.scale.y = Math.max(.1, length - .08);
    sleeve.quaternion.setFromUnitVectors(up, direction);
    cuff.position.copy(end).addScaledVector(direction, -.075); cuff.quaternion.copy(sleeve.quaternion);
    // The forearm slopes up from the lap, but the palm rests level on the table.
    // Following the forearm pitch made curled fingers and nails pierce the tabletop.
    hand.position.copy(end); hand.rotation.set(0, Math.atan2(-direction.x, -direction.z), 0);
    fingers.forEach((finger, i) => { finger.rotation.x = trainFingerLift(time, i, side); });
  } };
}
