import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { T, TAU, v, type World } from './world';
import { carnivalMotion, carnivalLampShader } from './carnivalOptimizations';
import { carnivalRate } from './carnivalLoop';

type Segment = [T.Vector3, T.Vector3, number?];

/** Hundreds of rods, rivets and bulbs share geometry/draw calls rather than hundreds of meshes. */
function rods(parent: T.Object3D, material: T.Material, segments: Segment[], radius = 0.018) {
  const mesh = new T.InstancedMesh(new T.CylinderGeometry(1, 1, 1, 8), material, segments.length);
  const dummy = new T.Object3D(); const axis = v(0, 1, 0);
  segments.forEach(([a, b, r], i) => {
    dummy.position.copy(a).add(b).multiplyScalar(0.5);
    dummy.quaternion.setFromUnitVectors(axis, b.clone().sub(a).normalize());
    dummy.scale.set(r ?? radius, a.distanceTo(b), r ?? radius); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

function dots(parent: T.Object3D, material: T.Material, points: T.Vector3[], radius: number) {
  const mesh = new T.InstancedMesh(new T.SphereGeometry(radius, 10, 8), material, points.length);
  const matrix = new T.Matrix4(); points.forEach((p, i) => { matrix.makeTranslation(p.x, p.y, p.z); mesh.setMatrixAt(i, matrix); });
  parent.add(mesh); return mesh;
}

function bulbs(w: World, parent: T.Object3D, points: T.Vector3[], colors: string[], radius = 0.033, offset = 0) {
  const mesh = dots(parent, new T.MeshBasicMaterial({ color: '#ffffff' }), points, radius);
  const chase = carnivalLampShader(mesh.material as T.MeshBasicMaterial, points.length, colors, offset);
  mesh.geometry.setAttribute('carnivalLampIndex', chase.index);
  for (let i = 0; i < points.length; i++) mesh.setColorAt(i, chase.palette[Math.floor(i / 8) % chase.palette.length]);
  w.ticks.push(time => {
    chase.time.value = time * carnivalRate(w, 2) / 2;
    chase.events.value = w.c.params.cinemaEvents ? 1 : 0;
  });
  return mesh;
}

const circle = (r: number, count: number, z = 0) => Array.from({ length: count }, (_, n) => v(Math.cos(n / count * TAU) * r, Math.sin(n / count * TAU) * r, z));

function rounded(w: World, parent: T.Object3D, size: [number, number, number], position: T.Vector3, material: T.Material, bevel = 0.055) {
  return w.mesh(new RoundedBoxGeometry(...size, 2, bevel), material, parent, position);
}

function passenger(w: World, parent: T.Object3D, color: string, scale = 1) {
  const person = new T.Group(); parent.add(person); person.scale.setScalar(scale);
  const skin = w.metal('#d8a27b', 0, 0.85); const clothes = w.metal(color, 0.05, 0.8);
  w.sphere(person, 0.067, [0, 0.23, 0], skin);
  const hair = w.sphere(person, 0.069, [0, 0.253, -0.013], w.metal('#403127', 0, 0.9)); hair.scale.y = 0.55;
  rounded(w, person, [0.16, 0.18, 0.11], v(0, 0.08, 0), clothes, 0.04);
  rods(person, clothes, [[v(-0.085, 0.14, 0), v(-0.11, 0.035, 0.05)], [v(0.085, 0.14, 0), v(0.11, 0.035, 0.05)]], 0.023);
  return person;
}

function gondola(w: World, parent: T.Object3D, index: number, gold: T.Material) {
  const cabin = carnivalMotion(new T.Group()); parent.add(cabin);
  const paint = w.metal(['#64b7c2', '#cf617b', '#e1af5d', '#7e80b8'][index % 4], 0.35, 0.28);
  const dark = w.metal('#213849', 0.15, 0.65);
  const glass = w.glass('#c5eaf5', 0.16);
  rounded(w, cabin, [0.78, 0.23, 0.65], v(0, -0.83, 0), paint);
  rounded(w, cabin, [0.84, 0.13, 0.72], v(0, -0.22, 0), paint, 0.06);
  const mullions: Segment[] = [];
  for (const x of [-0.34, 0.34]) for (const z of [-0.28, 0.28]) mullions.push([v(x, -0.76, z), v(x, -0.25, z)]);
  for (const z of [-0.31, 0.31]) {
    rounded(w, cabin, [0.68, 0.43, 0.016], v(0, -0.49, z), glass, 0.006);
    mullions.push([v(0, -0.75, z), v(0, -0.24, z)]);
    w.box(cabin, [0.1, 0.015, 0.025], [0.09, -0.57, z * 1.03], gold);
    mullions.push([v(-0.35, -0.71, z), v(0.35, -0.71, z)]);
  }
  rods(cabin, gold, mullions, 0.021);
  rods(cabin, gold, [[v(-0.24, -0.23, 0), v(-0.16, 0.05, 0)], [v(0.24, -0.23, 0), v(0.16, 0.05, 0)], [v(-0.16, 0.05, 0), v(0.16, 0.05, 0)]], 0.028);
  const cap = w.mesh(new T.CylinderGeometry(0.075, 0.075, 0.86, 16), gold, cabin); cap.rotation.x = Math.PI / 2;
  for (const z of [-0.17, 0.17]) rounded(w, cabin, [0.57, 0.065, 0.16], v(0, -0.67, z), dark, 0.025);
  for (const x of [-0.17, 0.17]) {
    const rider = passenger(w, cabin, index % 2 ? '#ffd191' : '#cb96bf'); rider.position.set(x, -0.64, -0.08);
  }
  const badge = w.text(cabin, String(index + 1).padStart(2, '0'), '#fff3d5', 0.3, 0.115); badge.position.set(0, -0.835, 0.331);
  dots(cabin, w.glow('#ffd699', 1), [v(-0.32, -0.22, 0.32), v(0.32, -0.22, 0.32)], 0.027);
  return cabin;
}

function ferrisWheel(w: World, park: T.Group) {
  const ivory = w.metal('#b9c7c9', 0.55, 0.3); const gold = w.metal('#cda162', 0.65, 0.25);
  const blue = w.metal('#285e76', 0.45, 0.4); const trim = w.metal('#527a8d', 0.55, 0.35);
  const machine = new T.Group(); park.add(machine); machine.rotation.y = -0.18;
  const wheel = carnivalMotion(new T.Group()); machine.add(wheel); wheel.position.y = 0.7;
  const radius = 3.1;
  for (const z of [-0.36, 0.36]) {
    for (const r of [radius - 0.18, radius + 0.05]) w.ring(wheel, r, 0.035, ivory, v(0, 0, z));
  }
  const structure: Segment[] = []; const bolts: T.Vector3[] = [];
  for (let n = 0; n < 64; n++) {
    const a = n / 64 * TAU; const b = (n + 1) / 64 * TAU;
    structure.push([v(Math.cos(a) * radius, Math.sin(a) * radius, -0.36), v(Math.cos(a) * radius, Math.sin(a) * radius, 0.36)]);
    structure.push([v(Math.cos(a) * radius, Math.sin(a) * radius, -0.36), v(Math.cos(b) * radius, Math.sin(b) * radius, 0.36)]);
    bolts.push(v(Math.cos(a) * radius, Math.sin(a) * radius, 0.4));
    if (n % 2 === 0) for (const z of [-0.33, 0.33]) structure.push([v(Math.cos(a + 0.22) * 0.38, Math.sin(a + 0.22) * 0.38, z), v(Math.cos(a) * 2.94, Math.sin(a) * 2.94, z)], [v(Math.cos(a - 0.22) * 0.38, Math.sin(a - 0.22) * 0.38, z), v(Math.cos(a) * 2.94, Math.sin(a) * 2.94, z)]);
  }
  rods(wheel, ivory, structure, 0.014); dots(wheel, gold, bolts, 0.026);
  bulbs(w, wheel, circle(3.16, 192, 0.4), ['#ffd39a', '#f790b2', '#8bddf0']);
  bulbs(w, wheel, circle(2.91, 160, 0.4), ['#8ed9ed', '#ffdbae'], 0.022, 2);
  w.ring(wheel, 3.155, 0.014, w.glow('#ec9ab6', 1.5), v(0, 0, 0.38));
  for (const z of [-0.48, 0.48]) {
    const hub = w.mesh(new T.CylinderGeometry(0.44, 0.44, 0.22, 48), blue, wheel, v(0, 0, z)); hub.rotation.x = Math.PI / 2;
    w.ring(wheel, 0.32, 0.04, gold, v(0, 0, z + Math.sign(z) * 0.12));
    dots(wheel, gold, circle(0.34, 12, z + Math.sign(z) * 0.13), 0.035);
  }
  const supports: Segment[] = [];
  for (const z of [-0.82, 0.82]) for (const sign of [-1, 1]) {
    const a = v(sign * 1.95, -4.35, z * 1.4); const b = v(0, 0.7, z);
    supports.push([a, b, 0.095]);
    const next = a.clone().add(v(-sign * 0.45, 0, 0)); supports.push([next, b, 0.06]);
    for (let rung = 1; rung <= 9; rung++) {
      const u = rung / 10; supports.push([a.clone().lerp(b, u), next.clone().lerp(b, u)]);
      if (rung < 9) supports.push([a.clone().lerp(b, u), next.clone().lerp(b, u + 0.1)]);
    }
    rounded(w, machine, [0.85, 0.17, 0.8], a.clone().add(v(-sign * 0.2, -0.08, 0)), blue);
  }
  rods(machine, trim, supports, 0.024);
  rods(machine, gold, [[v(0, 0.7, -1), v(0, 0.7, 1)]], 0.15);
  // Ring drive: motor housings, rubber rollers and a toothed rim at the base.
  for (const sign of [-1, 1]) {
    rounded(w, machine, [0.55, 0.45, 0.6], v(sign * 0.95, -2.65, 0.65), blue);
    const roller = w.mesh(new T.CylinderGeometry(0.22, 0.22, 0.32, 24), w.metal('#28313a', 0.1, 0.85), machine, v(sign * 0.95, -2.43, 0.25)); roller.rotation.x = Math.PI / 2;
    carnivalMotion(roller);
    w.ticks.push(time => { roller.rotation.y = -time * carnivalRate(w, 1.2); });
  }
  const teeth: Segment[] = [];
  for (let i = 0; i < 120; i++) { const a = i / 120 * TAU; teeth.push([v(Math.cos(a) * 2.85, Math.sin(a) * 2.85, -0.35), v(Math.cos(a) * 2.94, Math.sin(a) * 2.94, -0.35)]); }
  rods(wheel, trim, teeth, 0.022);
  const cars: T.Group[] = [];
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * TAU; const cabin = gondola(w, wheel, i, gold); cars.push(cabin); cabin.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
  }
  const base = rounded(w, machine, [4.7, 0.24, 3.1], v(0, -4.4, 0.45), blue, 0.14);
  w.text(base, 'PANORAMA', '#ffe0a5', 2.6, 0.27).position.set(0, 0.18, 1.57);
  for (let step = 0; step < 3; step++) rounded(w, machine, [1.5, 0.13, 0.55], v(0, -4.4 - step * 0.13, 2.15 + step * 0.4), trim, 0.035);
  const rails: Segment[] = [];
  for (const sign of [-1, 1]) {
    for (let n = 0; n < 9; n++) rails.push([v(sign * (0.9 + n * 0.16), -4.23, 1.8), v(sign * (0.9 + n * 0.16), -3.6, 1.8)]);
    rails.push([v(sign * 0.9, -3.6, 1.8), v(sign * 2.2, -3.6, 1.8)]);
  }
  rods(machine, gold, rails, 0.019);
  w.ticks.push(time => { wheel.rotation.z = time * carnivalRate(w, 0.115); cars.forEach((car, i) => { car.rotation.z = -wheel.rotation.z + Math.sin(time * carnivalRate(w, 0.7) + i) * 0.025; }); });
}

function biplane(w: World, parent: T.Object3D, color: string, gold: T.Material) {
  const plane = new T.Group(); parent.add(plane);
  plane.userData.carnivalPlane = true;
  const paint = w.metal(color, 0.38, 0.3); const red = w.metal('#b6464f', 0.25, 0.38);
  const bodyProfile = [new T.Vector2(0, -0.9), new T.Vector2(0.065, -0.76), new T.Vector2(0.15, -0.25), new T.Vector2(0.18, 0.23), new T.Vector2(0.145, 0.65), new T.Vector2(0, 0.76)];
  const fuselage = w.mesh(new T.LatheGeometry(bodyProfile, 32), paint, plane); fuselage.rotation.z = -Math.PI / 2;
  for (const y of [-0.09, 0.37]) {
    rounded(w, plane, [0.48, 0.065, 1.65], v(0.04, y, 0), paint, 0.03);
    for (const z of [-0.67, 0.67]) rounded(w, plane, [0.48, 0.069, 0.12], v(0.04, y, z), red, 0.025);
  }
  const struts: Segment[] = [];
  for (const z of [-0.52, 0.52]) { struts.push([v(-0.13, -0.04, z), v(0.2, 0.34, z)], [v(0.2, -0.04, z), v(-0.13, 0.34, z)]); }
  rods(plane, gold, struts, 0.016);
  rounded(w, plane, [0.25, 0.045, 0.66], v(-0.65, 0.1, 0), paint, 0.022);
  rounded(w, plane, [0.26, 0.36, 0.055], v(-0.68, 0.23, 0), red, 0.025);
  const cockpit = w.sphere(plane, 0.145, [0.06, 0.17, 0], w.glass('#afdeed', 0.4)); cockpit.scale.set(1.6, 0.6, 0.9);
  const pilot = passenger(w, plane, '#67422c', 0.7); pilot.position.set(-0.1, 0.15, 0);
  const engine = w.mesh(new T.CylinderGeometry(0.16, 0.16, 0.13, 24), gold, plane, v(0.65, 0, 0)); engine.rotation.z = Math.PI / 2;
  const propeller = carnivalMotion(new T.Group()); plane.add(propeller); propeller.position.x = 0.75;
  rounded(w, propeller, [0.055, 0.75, 0.08], v(), w.metal('#5a3325', 0.12, 0.6), 0.025);
  w.sphere(propeller, 0.08, [0.035, 0, 0], gold);
  for (const z of [-0.2, 0.2]) {
    const wheel = w.mesh(new T.CylinderGeometry(0.1, 0.1, 0.07, 20), w.metal('#1b2931', 0.1, 0.75), plane, v(0.28, -0.28, z)); wheel.rotation.x = Math.PI / 2;
  }
  rods(plane, gold, [[v(0.28, -0.12, 0), v(0.28, -0.28, -0.2)], [v(0.28, -0.12, 0), v(0.28, -0.28, 0.2)]], 0.023);
  w.ticks.push(time => { propeller.rotation.x = time * carnivalRate(w, 18); });
  return plane;
}

function carousel(w: World, park: T.Group) {
  const gold = w.metal('#c59754', 0.7, 0.28); const cream = w.metal('#f1dcab', 0.15, 0.55);
  const rose = w.metal('#a4456b', 0.3, 0.4); const teal = w.metal('#386c77', 0.4, 0.4);
  const platform = new T.Group(); park.add(platform);
  w.mesh(new T.CylinderGeometry(3.2, 3.3, 0.35, 128), teal, platform, v(0, -3.5, 0));
  w.mesh(new T.CylinderGeometry(3.14, 3.14, 0.05, 128), cream, platform, v(0, -3.3, 0));
  const decking: Segment[] = [];
  for (let i = -12; i <= 12; i++) { const x = i * 0.24; const extent = Math.sqrt(3.1 ** 2 - x ** 2); decking.push([v(x, -3.267, -extent), v(x, -3.267, extent)]); }
  rods(platform, gold, decking, 0.006);
  const rotor = carnivalMotion(new T.Group()); platform.add(rotor);
  const columns = new T.Group(); rotor.add(columns);
  w.mesh(new T.CylinderGeometry(0.28, 0.5, 5.1, 48), teal, columns, v(0, -0.7, 0));
  for (const y of [-3.15, -2.9, 1.2, 1.5]) w.mesh(new T.CylinderGeometry(0.54, 0.54, 0.12, 48), gold, columns, v(0, y, 0));
  const spiral = Array.from({ length: 151 }, (_, i) => { const a = i / 150 * TAU * 6; return v(Math.cos(a) * 0.32, -2.8 + i / 150 * 3.9, Math.sin(a) * 0.32); });
  w.tube(columns, spiral, gold, 0.023);
  // A curved, alternating-panel canopy; each strip is an actual surface, not one low-poly cone.
  const rings = 24; const sides = 48;
  for (let sector = 0; sector < 16; sector++) {
    const positions: number[] = []; const indices: number[] = [];
    for (let row = 0; row <= rings; row++) for (let col = 0; col <= 3; col++) {
      const r = 0.08 + row / rings * 3.3; const a = (sector * 3 + col) / sides * TAU;
      const y = 3.65 - Math.pow(row / rings, 0.55) * 1.72;
      positions.push(Math.cos(a) * r, y, Math.sin(a) * r);
      if (row < rings && col < 3) { const j = row * 4 + col; indices.push(j, j + 4, j + 1, j + 1, j + 4, j + 5); }
    }
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    const material = (sector % 2 ? rose : cream).clone(); material.side = T.DoubleSide;
    w.mesh(geometry, material, rotor);
    const a = sector / 16 * TAU;
    const rib = Array.from({ length: 26 }, (_, n) => { const t = n / 25; const r = 0.08 + t * 3.3; return v(Math.cos(a) * r, 3.67 - Math.pow(t, 0.55) * 1.72, Math.sin(a) * r); });
    w.tube(rotor, rib, gold, 0.022);
    // Scalloped valance and gold ornaments hanging from the rim.
    const mid = a + TAU / 32;
    const valance = w.mesh(new T.SphereGeometry(0.37, 20, 12, 0, TAU, 0, Math.PI / 2), sector % 2 ? cream : rose, rotor, v(Math.cos(mid) * 3.27, 1.96, Math.sin(mid) * 3.27));
    valance.scale.set(1, 0.48, 0.17); valance.rotation.y = -mid + Math.PI / 2; valance.rotation.z = Math.PI;
    w.sphere(rotor, 0.073, [Math.cos(a) * 3.35, 1.83, Math.sin(a) * 3.35], gold);
  }
  const roofLamps = circle(3.38, 160).map(p => v(p.x, 1.99, p.y)); bulbs(w, rotor, roofLamps, ['#ffe3a9', '#ffd0a2'], 0.027);
  const baseLamps = circle(3.26, 120).map(p => v(p.x, -3.48, p.y)); bulbs(w, platform, baseLamps, ['#f3b1cf', '#98deea', '#ffdf98'], 0.027, 1.5);
  w.mesh(new T.SphereGeometry(0.19, 32, 24), gold, rotor, v(0, 3.82, 0));
  rods(rotor, gold, [[v(0, 3.8, 0), v(0, 4.42, 0)]], 0.025);
  const flag = w.mesh(new T.PlaneGeometry(0.58, 0.28, 10, 4), new T.MeshStandardMaterial({ color: '#c46184', side: T.DoubleSide, roughness: 0.8 }), rotor, v(0.3, 4.23, 0));
  carnivalMotion(flag);
  const flagPos = flag.geometry.attributes.position; const original = Float32Array.from(flagPos.array);
  for (let n = 0; n < 10; n++) {
    // The nose is local +X; positive rotor yaw moves it along (sin(a), 0, -cos(a)).
    const a = n / 10 * TAU; const hanger = carnivalMotion(new T.Group()); rotor.add(hanger); hanger.position.set(Math.cos(a) * 2.4, 1.65, Math.sin(a) * 2.4); hanger.rotation.y = -a + Math.PI / 2;
    const plane = biplane(w, hanger, n % 2 ? '#e5b564' : '#83b7c0', gold); plane.scale.setScalar(0.78); plane.position.y = -2.7;
    const cables: Segment[] = [[v(-0.3, 0, -0.25), v(-0.3, -2.58, -0.25)], [v(0.3, 0, 0.25), v(0.3, -2.58, 0.25)]];
    rods(hanger, gold, cables, 0.013);
    // Small alternating chain links at the anchors are individually modelled.
    for (const sign of [-1, 1]) for (let link = 0; link < 6; link++) {
      const ring = w.mesh(new T.TorusGeometry(0.035, 0.009, 6, 12), gold, hanger, v(sign * 0.3, -link * 0.048, sign * 0.25)); ring.rotation.y = link % 2 ? Math.PI / 2 : 0;
    }
    w.ticks.push(time => { hanger.rotation.z = -0.1 + Math.sin(time * carnivalRate(w, 0.65) + a) * 0.055; });
  }
  // The non-rotating perimeter and entrance distinguish the platform from the rotating mechanism.
  const fence: Segment[] = [];
  for (let n = 0; n < 36; n++) { const a = n / 36 * TAU; if (Math.sin(a) > 0.88) continue; fence.push([v(Math.cos(a) * 3.25, -3.27, Math.sin(a) * 3.25), v(Math.cos(a) * 3.25, -2.65, Math.sin(a) * 3.25)]); }
  rods(platform, gold, fence, 0.015);
  const handrail = Array.from({ length: 81 }, (_, n) => { const a = 2.1 + n / 80 * (TAU - 1.06); return v(Math.cos(a) * 3.25, -2.65, Math.sin(a) * 3.25); });
  w.tube(platform, handrail, gold, 0.019);
  for (let n = 0; n < 3; n++) rounded(w, platform, [1.35, 0.12, 0.42], v(0, -3.55 - n * 0.12, 3.3 + n * 0.35), teal, 0.04);
  w.ticks.push(time => {
    rotor.rotation.y = time * carnivalRate(w, 0.19);
    for (let i = 0; i < flagPos.count; i++) flagPos.setZ(i, Math.sin(original[i * 3] * 10 + time * carnivalRate(w, 4)) * 0.045 * (original[i * 3] + 0.3));
    flagPos.needsUpdate = true;
  });
}

function cloudBank(w: World, parent: T.Object3D, y: number) {
  const material = new T.MeshStandardMaterial({ color: '#8faacb', roughness: 1, metalness: 0, flatShading: false });
  const group = carnivalMotion(new T.Group()); parent.add(group); group.position.y = y;
  for (let i = 0; i < 15; i++) {
    const sphere = w.mesh(new T.SphereGeometry(0.55 + w.c.rand() * 0.6, 32, 20), material, group, v((w.c.rand() - 0.5) * 6.6, (w.c.rand() - 0.5) * 0.4, (w.c.rand() - 0.5) * 2.3));
    sphere.scale.set(1.15, 0.6, 1);
  }
  w.ticks.push(time => { group.position.y = y + Math.sin(time * carnivalRate(w, 0.2)) * 0.05; });
}

/** The approved two-ride composition, rebuilt with mechanical and decorative detail. */
export function cloudCarnival(w: World) {
  w.stage.visible = false; w.exposure = 0.92; w.cameraMotion = 0.35;
  w.scene.background = new T.Color('#0b1529'); w.scene.fog = new T.FogExp2('#0b1529', 0.013);
  const backdrop = w.mesh(new T.SphereGeometry(75, 32, 24), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false,
    uniforms: {},
    vertexShader: 'varying vec3 p; void main(){p=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec3 p; void main(){float h=normalize(p).y; vec3 top=vec3(.002,.004,.012);vec3 low=vec3(.014,.028,.055);vec3 c=mix(low,top,smoothstep(-.18,.5,h));gl_FragColor=vec4(c,1.0);}',
  }), w.root);
  backdrop.castShadow = false; backdrop.receiveShadow = false;
  const left = w.side(0, -0.2); const right = w.side(1, -0.2);
  carnivalMotion(left); carnivalMotion(right);
  ferrisWheel(w, left); carousel(w, right);
  cloudBank(w, left, -4.9); cloudBank(w, right, -4.1);
  w.dust(110, '#c5d7ef', 24, 0.025);
  // Keep this base composition intact: the test gallery also uses it without party props.
  return { left, right };
}
