import { T, TAU, v, type World } from './world';

export function gear(w: World, parent: T.Object3D, radius: number, teeth: number, color = '#ad8054') {
  const shape = new T.Shape();
  for (let i = 0; i <= teeth * 4; i++) {
    const a = i / (teeth * 4) * TAU;
    const r = radius * (i % 4 < 2 ? 1 : 0.87);
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const hole = new T.Path(); hole.absarc(0, 0, radius * 0.34, 0, TAU, true); shape.holes.push(hole);
  const mesh = w.mesh(new T.ExtrudeGeometry(shape, { depth: 0.23, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 2, steps: 1 }), w.metal(color), parent);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU;
    w.sphere(mesh, radius * 0.035, [Math.cos(a) * radius * 0.66, Math.sin(a) * radius * 0.66, 0.28], w.metal('#dbe8ed'));
  }
  return mesh;
}

export function aircraft(w: World, parent: T.Object3D, color = '#e8eef8') {
  const group = new T.Group(); parent.add(group);
  const shell = w.metal(color, 0.65, 0.2); const glass = w.metal('#144a6d', 0.7, 0.15);
  const body = w.mesh(new T.CylinderGeometry(0.1, 0.14, 1.5, 12), shell, group); body.rotation.z = Math.PI / 2;
  const nose = w.mesh(new T.ConeGeometry(0.1, 0.36, 12), shell, group, v(0.91, 0, 0)); nose.rotation.z = -Math.PI / 2;
  w.box(group, [0.36, 0.055, 1.6], [0, 0, 0], shell).rotation.y = 0.14;
  w.box(group, [0.23, 0.055, 0.65], [-0.64, 0.05, 0], shell);
  w.box(group, [0.26, 0.4, 0.045], [-0.62, 0.19, 0], shell);
  w.sphere(group, 0.11, [0.48, 0.09, 0], glass).scale.set(1.7, 0.7, 0.8);
  return group;
}

export function building(w: World, parent: T.Object3D, width: number, height: number, depth: number, color: string, light: string, seed = 0) {
  const group = new T.Group(); parent.add(group);
  w.box(group, [width, height, depth], [0, height / 2, 0], w.metal(color, 0.4, 0.4));
  w.box(group, [width * 1.03, 0.12, depth * 1.03], [0, height + 0.06, 0], w.metal('#283a54'));
  const columns = Math.max(2, Math.floor(width / 0.32)); const rows = Math.max(2, Math.floor(height / 0.35));
  const windows = new T.InstancedMesh(new T.BoxGeometry(0.12, 0.15, 0.025), w.glow(light, 1.7), columns * rows);
  const dummy = new T.Object3D();
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    dummy.position.set((column - (columns - 1) / 2) * width / (columns + 0.5), 0.22 + row * (height - 0.3) / rows, depth / 2 + 0.02);
    const on = Math.sin(row * 53.1 + column * 13.7 + seed * 71) > -0.35;
    dummy.scale.setScalar(on ? 1 : 0); dummy.updateMatrix(); windows.setMatrixAt(row * columns + column, dummy.matrix);
  }
  group.add(windows); return group;
}

export function cloud(w: World, parent: T.Object3D, radius = 1) {
  const group = new T.Group(); parent.add(group);
  const material = new T.MeshStandardMaterial({ color: '#c7d6f5', roughness: 1, transparent: true, opacity: 0.5, depthWrite: false });
  for (let i = 0; i < 6; i++) w.sphere(group, radius * (0.5 + w.c.rand() * 0.4), [(i - 2.5) * radius * 0.45, Math.sin(i * 2) * radius * 0.16, Math.cos(i) * radius * 0.2], material);
  return group;
}

export function plinth(w: World, parent: T.Object3D, radius = 2.6, color = '#e8b570') {
  w.mesh(new T.CylinderGeometry(radius, radius * 1.05, 0.3, 64), w.metal('#243044'), parent, v(0, -4.5, 0));
  const rim = w.ring(parent, radius, 0.025, w.glow(color), v(0, -4.32, 0)); rim.rotation.x = Math.PI / 2;
}

export function orbit(w: World, parent: T.Object3D, radius: number, color: string, tilt = 0) {
  const group = new T.Group(); group.rotation.x = tilt; parent.add(group);
  w.ring(group, radius, 0.018, w.glow(color, 1.8));
  const bead = w.sphere(group, 0.085, [radius, 0, 0], w.glow(color, 4));
  w.ticks.push(time => { bead.position.set(Math.cos(time * 0.4) * radius, Math.sin(time * 0.4) * radius, 0); });
  return group;
}
