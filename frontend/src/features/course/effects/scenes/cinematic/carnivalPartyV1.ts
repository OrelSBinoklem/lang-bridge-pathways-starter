import { T, TAU, v, type World } from './world';
import { group, round, bake } from './storyKit';
import { cloudCarnival } from './carnivalDetailed';
import { carnivalMotion } from './carnivalOptimizations';
import { carnivalRate } from './carnivalLoop';

/** Saved 06.10.2026. Keep this builder for the gallery snapshot when a later park replaces it. */
const LATEX = ['#ff426a', '#ffb52e', '#38d5ba', '#559aff', '#b975f4', '#ff82bc', '#ffe278'];

function speaker(w: World, parent: T.Group, x: number, floor: number, side: number) {
  const rig = group(parent, x, floor, 2.15); rig.name = 'carnival-speaker'; rig.rotation.y = -side * 0.17;
  const cabinet = group(rig), dark = w.metal('#101721', 0.15, 0.72), trim = w.metal('#566579', 0.72, 0.3);
  const rubber = w.metal('#18212b', 0, 0.88), coneMat = w.metal('#374250', 0.25, 0.62);
  round(w, cabinet, [1.68, 0.16, 1.3], [0, 0, 0], w.metal('#ae784b', 0.65, 0.32));
  round(w, cabinet, [1.25, 2.58, 0.83], [0, 1.42, 0], dark, 0.09);
  round(w, cabinet, [1.1, 2.38, 0.035], [0, 1.42, 0.43], w.metal('#222c3a', 0.2, 0.8), 0.04);
  for (const sx of [-1, 1]) {
    for (const y of [0.21, 2.62]) round(w, cabinet, [0.18, 0.16, 0.92], [sx * 0.54, y, 0], trim, 0.03);
    round(w, cabinet, [0.035, 0.38, 0.28], [sx * 0.635, 1.5, 0], rubber, 0.01);
    for (const y of [0.48, 1.32, 1.62, 2.5]) w.sphere(cabinet, 0.024, [sx * 0.5, y, 0.468], trim);
  }
  const lights = w.glow(side < 0 ? '#ff4b96' : '#4fe4e3', 1.4);
  lights.userData.carnivalMotion = true;
  const cones: T.Group[] = [];
  for (const y of [0.86, 1.84]) {
    w.mesh(new T.CircleGeometry(0.46, 64), rubber, cabinet, v(0, y, 0.466));
    w.ring(cabinet, 0.448, 0.022, trim, v(0, y, 0.493));
    w.ring(cabinet, 0.417, 0.018, lights, v(0, y, 0.51));
    w.ring(cabinet, 0.378, 0.035, rubber, v(0, y, 0.49));
    const piston = group(rig, 0, y, 0.49); piston.name = 'carnival-woofer'; cones.push(piston);
    const profile = [new T.Vector2(0.09, -0.095), new T.Vector2(0.17, -0.08), new T.Vector2(0.31, -0.012), new T.Vector2(0.36, 0)];
    const cone = w.mesh(new T.LatheGeometry(profile, 64), coneMat, piston); cone.rotation.x = Math.PI / 2;
    const cap = w.sphere(piston, 0.135, [0, 0, 0.03], dark); cap.scale.z = 0.5;
    for (const r of [0.21, 0.27, 0.32]) w.ring(piston, r, 0.005, rubber, v(0, 0, 0.09 - r * 0.25));
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; w.sphere(cabinet, 0.018, [Math.cos(a) * 0.447, y + Math.sin(a) * 0.447, 0.52], trim); }
  }
  // Recessed bass ports, a horn tweeter and real cabinet hardware, not a flat icon.
  for (const x of [-0.24, 0.24]) {
    round(w, cabinet, [0.31, 0.09, 0.03], [x, 0.31, 0.47], rubber, 0.03);
    round(w, cabinet, [0.34, 0.1, 0.018], [x, 2.43, 0.47], trim, 0.02);
  }
  const badge = w.text(cabinet, 'CLOUD / SOUND', '#bccbd4', 0.77, 0.11); badge.position.set(0, 1.36, 0.47);
  bake(cabinet);
  const meter = group(rig, -side * 0.76, 0.26, 0.48);
  const segments: T.Mesh[] = [];
  const bright = [w.glow('#44edcd', 1.8), w.glow('#ffc751', 1.8), w.glow('#ff528a', 1.8)];
  for (let i = 0; i < 14; i++) {
    round(w, meter, [0.16, 0.1, 0.035], [0, i * 0.15, 0], dark, 0.01);
    segments.push(carnivalMotion(round(w, meter, [0.1, 0.07, 0.022], [0, i * 0.15, 0.025], bright[Math.floor(i / 5)], 0.006)));
  }
  const waves = Array.from({ length: 3 }, () => {
    const material = new T.MeshBasicMaterial({ color: side < 0 ? '#ff77bd' : '#77eaff', transparent: true, opacity: 0, depthWrite: false });
    const ring = carnivalMotion(w.ring(rig, 0.46, 0.009, material, v(0, 0.86, 0.55))); ring.castShadow = false; return ring;
  });
  w.ticks.push(time => {
    const phase = (time * carnivalRate(w, 2.15 * TAU) / TAU) % 1, kick = Math.exp(-phase * 11), snare = Math.exp(-((phase + 0.5) % 1) * 16);
    const beat = Math.min(1, kick + snare * 0.2 + w.pulse * 0.3);
    cones.forEach((cone, i) => { cone.position.z = 0.49 + beat * (i === 0 ? 0.095 : 0.058); });
    lights.emissiveIntensity = w.c.params.cinemaEvents ? 0.8 + beat * 1.9 : 1;
    segments.forEach((segment, i) => { segment.visible = i < 2 + (0.5 + 0.5 * Math.sin(time * carnivalRate(w, 3.4) + side)) * 5 + beat * 7; });
    waves.forEach((ring, i) => {
      const age = (time * carnivalRate(w, 0.95 * TAU) / TAU + i / 3) % 1;
      ring.scale.setScalar(1 + age * 1.1); ring.position.z = 0.55 + age * 0.5;
      (ring.material as T.MeshBasicMaterial).opacity = w.c.params.cinemaEvents ? Math.sin(age * Math.PI) * 0.15 : 0;
    });
  });
}

function balloonBunch(w: World, parent: T.Group, side: number, floor: number) {
  const bunch = group(parent, side * 3.35, floor, 0.5); bunch.name = 'carnival-balloons';
  const stringMaterial = w.metal('#d1bca8', 0.05, 0.88), weight = w.metal('#e5ac55', 0.65, 0.3);
  round(w, bunch, [0.36, 0.15, 0.36], [0, 0.08, 0], weight);
  const profile: T.Vector2[] = [];
  for (let i = 0; i <= 36; i++) {
    const a = i / 36 * Math.PI;
    profile.push(new T.Vector2(Math.sin(a) * (0.82 + 0.2 * Math.sin(a / 2)), -Math.cos(a) * 1.25));
  }
  const balloonGeo = new T.LatheGeometry(profile, 48), knotGeo = new T.ConeGeometry(0.055, 0.11, 16);
  const positions = [[-0.6, 5.9, 0.28], [0.43, 6.3, -0.18], [-0.24, 7.07, -0.35], [0.55, 7.61, -0.5], [-0.67, 7.73, -0.6], [0, 8.55, -0.9], [0.4, 5.05, 0.4]];
  const ray = new T.Raycaster(), pointer = new T.Vector2();
  const states = positions.map(([x, y, z], i) => {
    const rig = carnivalMotion(group(bunch)), size = 0.43 + (i % 3) * 0.045;
    const material = new T.MeshPhysicalMaterial({ color: LATEX[(i + (side > 0 ? 3 : 0)) % LATEX.length], metalness: 0.02, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.35, sheenRoughness: 0.4 });
    const shell = w.mesh(balloonGeo, material, rig); shell.scale.setScalar(size); shell.name = 'carnival-balloon-latex';
    const knot = w.mesh(knotGeo, material, rig, v(0, -size * 1.25 - 0.035, 0)); knot.rotation.z = Math.PI;
    // Preallocated tube: each frame only updates positions, no new geometry/material allocations.
    const rope = w.mesh(new T.TubeGeometry(new T.LineCurve3(v(), v(0, 1, 0)), 24, 0.009, 4, false), stringMaterial, bunch);
    carnivalMotion(rope);
    rope.castShadow = false; rope.frustumCulled = false;
    return { rig, shell, rope, size, base: v(x * side, y, z), pos: v(x * side, y, z), velocity: v(), cooldown: 0, phase: i * 1.72 + side, index: i };
  });
  // A bounded reusable burst pool: popping never accumulates particles or GPU resources.
  const confettiMaterial = new T.MeshStandardMaterial({ color: '#ffffff', side: T.DoubleSide, roughness: 0.6 });
  const confetti = new T.InstancedMesh(new T.PlaneGeometry(0.055, 0.095), confettiMaterial, 84); bunch.add(confetti);
  confetti.name = 'carnival-confetti'; confetti.frustumCulled = false; confetti.count = 0;
  const pieces: { position: T.Vector3; velocity: T.Vector3; age: number; spin: number }[] = [];
  const dummy = new T.Object3D();
  for (let i = 0; i < 84; i++) confetti.setColorAt(i, new T.Color(LATEX[i % LATEX.length]));
  const ropePoint = v(), end = v();
  w.ticks.push((time, dt, input) => {
    // Clamp after suspended tabs; spring integration stays stable instead of exploding on resume.
    const elapsed = Math.max(0, Math.min(dt, 0.05)), steps = Math.max(1, Math.ceil(elapsed * 120)), h = elapsed / steps;
    for (const state of states) {
      state.cooldown = Math.max(0, state.cooldown - elapsed);
      const growth = state.cooldown > 0 ? 0 : Math.min(1, state.rig.scale.x + elapsed * 1.7);
      state.rig.visible = growth > 0; state.rope.visible = growth > 0; state.rig.scale.setScalar(growth);
      for (let s = 0; s < steps; s++) {
        const targetX = state.base.x + Math.sin(time * 0.7 + state.phase) * 0.19;
        const targetY = state.base.y + Math.sin(time * 0.95 + state.phase) * 0.12;
        state.velocity.x += ((targetX - state.pos.x) * 7 - state.velocity.x * 2.5) * h;
        state.velocity.y += ((targetY - state.pos.y) * 9 - state.velocity.y * 3) * h;
        state.pos.addScaledVector(state.velocity, h);
      }
    }
    // Soft pairwise contacts keep neighbouring latex shells from passing through each other.
    for (let i = 0; i < states.length; i++) for (let j = i + 1; j < states.length; j++) {
      const a = states[i], b = states[j]; if (!a.rig.visible || !b.rig.visible) continue;
      const dx = b.pos.x - a.pos.x, dy = (b.pos.y - a.pos.y) / 1.25, dz = b.pos.z - a.pos.z;
      const d = Math.hypot(dx, dy, dz), min = (a.size + b.size) * 0.92;
      if (d > 0.001 && d < min) { const f = (min - d) * 0.5 / d; a.pos.x -= dx * f; b.pos.x += dx * f; a.pos.y -= dy * f; b.pos.y += dy * f; }
    }
    for (const state of states) {
      state.rig.position.copy(state.pos); state.rig.rotation.z = -state.velocity.x * 0.14 + Math.sin(time + state.phase) * 0.035;
      end.set(0, -state.size * 1.25 - 0.085, 0).multiplyScalar(state.rig.scale.x).applyEuler(state.rig.rotation).add(state.pos);
      const attr = state.rope.geometry.getAttribute('position');
      for (let n = 0; n <= 24; n++) {
        const u = n / 24, bow = Math.sin(u * Math.PI);
        ropePoint.copy(end).multiplyScalar(u);
        ropePoint.x += bow * (0.12 * Math.sin(time * 0.65 + state.phase) - state.base.x * 0.1);
        ropePoint.z += bow * 0.16;
        for (let j = 0; j <= 4; j++) { const a = j / 4 * TAU; attr.setXYZ(n * 5 + j, ropePoint.x + Math.cos(a) * 0.009, ropePoint.y, ropePoint.z + Math.sin(a) * 0.009); }
      }
      attr.needsUpdate = true;
    }
    if (input.active && input.clicked && w.c.params.react > 0) {
      w.scene.updateMatrixWorld(true); w.camera.updateMatrixWorld(true);
      pointer.set(input.rawX / w.c.width * 2 - 1, 1 - input.rawY / w.c.height * 2);
      ray.setFromCamera(pointer, w.camera);
      const visible = states.filter(s => s.rig.visible && s.rig.scale.x > 0.85);
      const hit = ray.intersectObjects(visible.map(s => s.shell), false)[0];
      const popped = hit && visible.find(s => s.shell === hit.object);
      if (popped) {
        popped.cooldown = 2.4; popped.rig.visible = false; popped.rope.visible = false; popped.rig.scale.setScalar(0);
        pieces.length = 0;
        for (let i = 0; i < 84; i++) {
          const a = w.c.rand() * TAU, speed = 0.6 + w.c.rand() * 2.2;
          pieces.push({ position: popped.pos.clone(), velocity: v(Math.cos(a) * speed, Math.sin(a) * speed + 0.8, (w.c.rand() - 0.5) * 2), age: 0, spin: w.c.rand() * TAU });
        }
      }
    }
    confetti.count = pieces.length;
    pieces.forEach((piece, i) => {
      piece.age += elapsed; piece.velocity.y -= elapsed * 1.7; piece.position.addScaledVector(piece.velocity, elapsed);
      dummy.position.copy(piece.position); dummy.rotation.set(piece.spin + piece.age * 5, piece.age * 3, piece.spin + piece.age * 4);
      dummy.scale.setScalar(Math.max(0, 1 - Math.max(0, piece.age - 1.4) / 0.6)); dummy.updateMatrix(); confetti.setMatrixAt(i, dummy.matrix);
    });
    if (pieces.length && pieces[0].age >= 2) { pieces.length = 0; confetti.count = 0; }
    confetti.instanceMatrix.needsUpdate = true;
  });
}

/** The live first variant and its versioned gallery snapshot use the same complete composition. */
export function carnivalPartyV1(w: World) {
  const { left, right } = cloudCarnival(w);
  // Include the latex radius and perspective at the front of the rides, not just their platforms.
  w.sidePadding = 6;
  w.mobileSidePadding = 4.4;
  speaker(w, left, 2.7, -4.37, -1);
  speaker(w, right, -2.9, -3.55, 1);
  balloonBunch(w, left, -1, -4.4);
  balloonBunch(w, right, 1, -3.6);
}

/** Approved scenery without balloons. Random dust is drawn live, not baked. */
export function carnivalVideoBackdrop(w: World) {
  const sides = cloudCarnival(w);
  speaker(w, sides.left, 2.7, -4.37, -1);
  speaker(w, sides.right, -2.9, -3.55, 1);
  for (const child of [...w.scene.children]) if (child instanceof T.Points) child.removeFromParent();
  return sides;
}
