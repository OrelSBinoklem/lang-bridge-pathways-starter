// Bakes "arms stay out of the body" into retargeted motion frames for one VRM model. Forward kinematics of the
// normalized rig find the elbow, forearm and hand each frame; where they enter the bare body (vrmBody slices) the
// upper arm, then the forearm, is turned just enough to clear it. The corrections are then widened and blurred over
// time, so a clip never flickers between corrected and uncorrected frames.
import { SLICE_STEP } from './vrmBody.mjs';

const TORSO = ['hips', 'spine', 'chest', 'upperChest'];
const MAX_PUSH = 0.05;
// Skin-to-bone radii (m): how thick the arm is around its bones.
const UPPER_POINTS = [['elbow', 0.035], ['upper', 0.04]];
const LOWER_POINTS = [['wrist', 0.028], ['fore', 0.032], ['tip', 0.018]];

export function bakeArmFix({ bones: rig, slices, y0, hipsRest }, frames, getLocal, getHips, THREE) {
  const order = [];
  const visit = name => { if (!rig[name] || order.includes(name)) return; if (rig[name].parent) visit(rig[name].parent); order.push(name); };
  for (const side of ['left', 'right']) for (const b of ['Shoulder', 'UpperArm', 'LowerArm', 'Hand']) visit(side + b);
  for (const b of TORSO) visit(b);

  const world = {};
  const fk = (f, local) => {
    for (const name of order) {
      const { parent, rest } = rig[name];
      const q = local(name).clone();
      if (!parent) { world[name] = { q, p: getHips(f) }; continue; }
      const pw = world[parent];
      const p = rest.clone().sub(rig[parent].rest).applyQuaternion(pw.q).add(pw.p);
      world[name] = { q: pw.q.clone().multiply(q), p };
    }
  };

  const push = (p, radius) => {
    let bone = TORSO[0];
    for (const name of TORSO) if (world[name] && world[name].p.y <= p.y) bone = name;
    const { q, p: at } = world[bone];
    const local = p.clone().sub(at).applyQuaternion(q.clone().invert()).add(rig[bone].rest);
    const slice = slices[Math.floor((local.y - y0) / SLICE_STEP)];
    if (!slice) return null;
    const ax = slice.rx + radius, az = slice.rz + radius, dx = local.x - slice.cx, dz = local.z - slice.cz;
    const ux = dx / ax, uz = dz / az;
    if (ux * ux + uz * uz >= 1) return null;
    // At the sides straight sideways, in front or behind straight forward or back.
    const px = Math.abs(ux) >= Math.abs(uz) ? Math.sign(dx || 1) * ax * Math.sqrt(1 - uz * uz) - dx : 0;
    const pz = Math.abs(ux) < Math.abs(uz) ? Math.sign(dz) * az * Math.sqrt(1 - ux * ux) - dz : 0;
    return new THREE.Vector3(px, 0, pz).applyQuaternion(q).multiplyScalar(1.05).clampLength(0, MAX_PUSH);
  };

  // Rotation (parent space) that moves `point` by `delta` when applied at `bone`'s origin.
  const turnFor = (bone, point, delta) => {
    const pivot = world[bone].p;
    const from = point.clone().sub(pivot), to = from.clone().add(delta);
    if (from.lengthSq() < 1e-6) return new THREE.Quaternion();
    const rot = new THREE.Quaternion().setFromUnitVectors(from.normalize(), to.normalize());
    const parent = world[rig[bone].parent].q;
    return parent.clone().invert().multiply(rot).multiply(parent);
  };

  const points = side => {
    const s = world[`${side}UpperArm`].p, e = world[`${side}LowerArm`].p, w = world[`${side}Hand`].p;
    return {
      elbow: e, upper: s.clone().lerp(e, 0.6),
      wrist: w, fore: e.clone().lerp(w, 0.5), tip: w.clone().add(w.clone().sub(e).setLength(0.08)),
    };
  };

  /** One stage: per frame corrections for `bone` from `pts`, smoothed over time; returns parent-space rotations. */
  const stage = (side, bone, pts, extra) => {
    const raw = [];
    for (let f = 0; f < frames; f++) {
      const total = new THREE.Quaternion();
      const local = name => (name === bone ? total.clone().multiply(getLocal(name, f)) : extra(name, f));
      for (let pass = 0; pass < 3; pass++) {
        fk(f, local);
        const at = points(side);
        let hit = null;
        for (const [key, radius] of pts) { const d = push(at[key], radius); if (d) { hit = [at[key], d]; break; } }
        if (!hit) break;
        total.premultiply(turnFor(bone, hit[0], hit[1]));
      }
      raw.push(total);
    }
    // Widen (keep the strongest nearby correction), then blur, as rotation vectors.
    const vec = raw.map(q => { const w = Math.min(1, Math.abs(q.w)), s = Math.sqrt(1 - w * w), a = 2 * Math.acos(w) * Math.sign(q.w || 1); return s < 1e-6 ? new THREE.Vector3() : new THREE.Vector3(q.x, q.y, q.z).multiplyScalar(a / s); });
    const wide = vec.map((_, i) => { let best = vec[i]; for (let k = Math.max(0, i - 5); k <= Math.min(frames - 1, i + 5); k++) if (vec[k].lengthSq() > best.lengthSq()) best = vec[k]; return best; });
    const blur = wide.map((_, i) => { const acc = new THREE.Vector3(); let sum = 0; for (let k = -8; k <= 8; k++) { const j = Math.min(frames - 1, Math.max(0, i + k)), g = Math.exp(-(k * k) / 18); acc.addScaledVector(wide[j], g); sum += g; } return acc.multiplyScalar(1 / sum); });
    return blur.map(v => { const a = v.length(); return a < 1e-6 ? new THREE.Quaternion() : new THREE.Quaternion().setFromAxisAngle(v.clone().multiplyScalar(1 / a), a); });
  };

  const fixed = {};
  for (const side of ['left', 'right']) {
    const upper = `${side}UpperArm`, lower = `${side}LowerArm`;
    const upperFix = stage(side, upper, UPPER_POINTS, (name, f) => getLocal(name, f));
    const upperAt = f => upperFix[f].clone().multiply(getLocal(upper, f));
    const lowerFix = stage(side, lower, LOWER_POINTS, (name, f) => (name === upper ? upperAt(f) : getLocal(name, f)));
    fixed[upper] = Array.from({ length: frames }, (_, f) => upperAt(f));
    fixed[lower] = Array.from({ length: frames }, (_, f) => lowerFix[f].clone().multiply(getLocal(lower, f)));
    const angle = q => 2 * Math.acos(Math.min(1, Math.abs(q.w)));
    fixed[`${side}Stats`] = { upper: Math.max(...upperFix.map(angle)), lower: Math.max(...lowerFix.map(angle)) };
  }
  return fixed;
}
