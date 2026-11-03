import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { T, TAU, v, type World } from './world';

export function group(parent: T.Object3D, x = 0, y = 0, z = 0) {
  const g = new T.Group(); g.position.set(x, y, z); parent.add(g); return g;
}
export function round(w: World, p: T.Object3D, size: [number, number, number], pos: [number, number, number], m: T.Material, radius = 0.08) {
  return w.mesh(new RoundedBoxGeometry(...size, 3, Math.min(radius, Math.min(...size) / 3)), m, p, v(...pos));
}
export function cylinder(w: World, p: T.Object3D, r: number, h: number, m: T.Material, x = 0, y = 0, z = 0) {
  return w.mesh(new T.CylinderGeometry(r, r, h, 32), m, p, v(x, y, z));
}
/** Only call on a finished, entirely static prop. Moving subassemblies remain separate. */
export function bake(p: T.Group) {
  p.updateMatrixWorld(true);
  const inverse = p.matrixWorld.clone().invert();
  const buckets = new Map<T.Material, T.BufferGeometry[]>();
  const originals: T.Mesh[] = [];
  p.traverse(o => {
    if (!(o instanceof T.Mesh) || o instanceof T.InstancedMesh || Array.isArray(o.material)) return;
    // Transparent layers need their original sorting origins.
    if (o.material.transparent) return;
    const g = o.geometry.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld));
    const flat = g.index ? g.toNonIndexed() : g;
    if (flat !== g) g.dispose();
    const list = buckets.get(o.material) ?? []; list.push(flat); buckets.set(o.material, list); originals.push(o);
  });
  for (const [m, geometries] of buckets) {
    const geometry = mergeGeometries(geometries, false);
    geometries.forEach(g => g.dispose());
    if (!geometry) throw new Error('Static scene geometry could not be merged');
    const mesh = new T.Mesh(geometry, m); mesh.castShadow = true; mesh.receiveShadow = true; p.add(mesh);
  }
  // Keep transparent children (and their world transforms) when an opaque parent is flattened.
  for (const mesh of originals) { for (const child of [...mesh.children]) p.attach(child); mesh.removeFromParent(); mesh.geometry.dispose(); }
}
export function backdrop(w: World, top: string, bottom: string) {
  w.stage.visible = false; w.cameraMotion = 0.4; w.sidePadding = 5;
  w.scene.background = new T.Color(bottom); w.scene.fog = new T.FogExp2(bottom, 0.012);
  const material = new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false,
    uniforms: { top: { value: new T.Color(top) }, bottom: { value: new T.Color(bottom) } },
    vertexShader: 'varying vec3 p; void main(){ p=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec3 p; uniform vec3 top; uniform vec3 bottom; void main(){ float h=smoothstep(-.2,.8,normalize(p).y); gl_FragColor=vec4(mix(bottom,top,h),1.); #include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
  });
  // Shader preprocessor directives must start on their own line.
  material.fragmentShader = material.fragmentShader.replace('; #include', ';\n#include');
  const sky = w.mesh(new T.SphereGeometry(85, 32, 24), material, w.scene);
  sky.castShadow = false; sky.receiveShadow = false;
}
export function deck(w: World, p: T.Object3D, width: number, depth: number, color = '#26434d') {
  const d = group(p); const edge = w.metal(color, 0.35, 0.6), slab = w.metal('#29313a', 0.2, 0.8);
  round(w, d, [width, 0.35, depth], [0, -0.18, 0], edge, 0.14);
  for (let x = -width / 2 + 0.3; x < width / 2; x += 0.48) w.box(d, [0.025, 0.018, depth - 0.2], [x, 0.01, 0], slab);
  bake(d); return d;
}
export function railing(w: World, p: T.Object3D, a: T.Vector3, b: T.Vector3, color = '#abb4af', height = 0.6) {
  const g = group(p), mat = w.metal(color); const n = Math.ceil(a.distanceTo(b) / 0.3);
  w.beam(g, a.clone().add(v(0, height, 0)), b.clone().add(v(0, height, 0)), 0.027, mat);
  for (let i = 0; i <= n; i++) { const q = a.clone().lerp(b, i / n); w.beam(g, q, q.clone().add(v(0, height, 0)), 0.018, mat); }
  bake(g); return g;
}
export function lamp(w: World, p: T.Object3D, x: number, y: number, z: number, height = 2.5) {
  const g = group(p, x, y, z), metal = w.metal('#273640'), light = w.glow('#ffd69a', 1.8);
  cylinder(w, g, 0.09, 0.2, metal, 0, 0.1); cylinder(w, g, 0.035, height, metal, 0, height / 2);
  w.tube(g, [v(0, height - 0.2), v(0, height + 0.25), v(0.45, height + 0.3), v(0.55, height)], metal, 0.032);
  w.mesh(new T.ConeGeometry(0.2, 0.13, 24), metal, g, v(0.55, height, 0));
  w.sphere(g, 0.1, [0.55, height - 0.1, 0], light); bake(g); return g;
}
export function plant(w: World, p: T.Object3D, x: number, y: number, z: number, scale = 1, flowering = false) {
  const g = group(p, x, y, z); g.scale.setScalar(scale);
  const pot = w.metal('#bd735c', 0.1, 0.8), green = w.metal('#2e966c', 0.1, 0.8), pink = w.metal('#ff73ac', 0.05, 0.6);
  w.mesh(new T.CylinderGeometry(0.25, 0.17, 0.4, 24), pot, g, v(0, 0.2));
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4, tip = v(Math.cos(a) * 0.3, 0.6 + (i % 3) * 0.16, Math.sin(a) * 0.3);
    w.beam(g, v(0, 0.35), tip, 0.015, green);
    const leaf = w.sphere(g, 0.18, tip.toArray() as [number, number, number], flowering && i % 2 === 0 ? pink : green); leaf.scale.set(0.6, 1.7, 0.22); leaf.rotation.z = -a;
  }
  bake(g); return g;
}
export function person(w: World, p: T.Object3D, color = '#e97767', scale = 1) {
  const g = group(p); g.scale.setScalar(scale);
  const skin = w.metal('#e5af87', 0, 0.8), hair = w.metal('#352b36', 0.05, 0.8), cloth = w.metal(color, 0, 0.85), dark = w.metal('#293b4c', 0.1, 0.7);
  const body = group(g);
  round(w, body, [0.32, 0.43, 0.21], [0, 0.65, 0], cloth);
  w.sphere(body, 0.17, [0, 1.01, 0], skin);
  w.mesh(new T.SphereGeometry(0.18, 20, 14, 0, TAU, 0, 1.75), hair, body, v(0, 1.05, -0.015));
  for (const x of [-0.06, 0.06]) w.sphere(body, 0.016, [x, 1.02, 0.156], dark);
  const limbs: T.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = group(g, side * 0.1, 0.47); limbs.push(leg);
    round(w, leg, [0.12, 0.34, 0.14], [0, -0.17, 0], dark);
    round(w, leg, [0.14, 0.09, 0.25], [0, -0.38, 0.045], hair);
    const arm = group(g, side * 0.22, 0.8); limbs.push(arm);
    round(w, arm, [0.11, 0.31, 0.13], [0, -0.13, 0], cloth); w.sphere(arm, 0.062, [0, -0.3, 0], skin);
    bake(leg); bake(arm);
  }
  bake(body);
  return { root: g, limbs, walk: (t: number, amount = 1) => limbs.forEach((l, i) => { l.rotation.x = Math.sin(t * 5 + (i < 2 ? 0 : Math.PI)) * (i % 2 ? -0.55 : 0.6) * amount; }) };
}
export function books(w: World, p: T.Object3D, count: number, x: number, y: number, z: number) {
  const g = group(p, x, y, z), paper = w.metal('#eee4c5', 0, 0.8);
  const colors = ['#ce6473', '#379c98', '#dfac4e', '#7363b3'];
  for (let i = 0; i < count; i++) {
    const h = 0.35 + w.c.rand() * 0.25, b = group(g, i * 0.13, 0);
    const cover = w.metal(colors[i % 4], 0.05, 0.7);
    w.box(b, [0.1, h, 0.3], [0, h / 2, 0], paper);
    for (const dx of [-0.06, 0.06]) w.box(b, [0.018, h + 0.02, 0.32], [dx, h / 2, 0], cover);
    w.box(b, [0.13, h + 0.02, 0.018], [0, h / 2, 0.16], cover);
    for (const f of [0.2, 0.8]) w.box(b, [0.09, 0.015, 0.01], [0, h * f, 0.174], paper);
  }
  bake(g); return g;
}
export function bunting(w: World, p: T.Object3D, a: T.Vector3, b: T.Vector3, count = 14) {
  const mat = w.metal('#6a615b'), g = group(p);
  const points = Array.from({ length: 17 }, (_, i) => a.clone().lerp(b, i / 16).add(v(0, -Math.sin(i / 16 * Math.PI) * 0.6)));
  const curve = w.tube(g, points, mat, 0.018);
  for (let i = 0; i < count; i++) {
    const q = curve.getPointAt((i + 0.5) / count), shape = new T.Shape();
    shape.moveTo(-0.16, 0); shape.lineTo(0.16, 0); shape.lineTo(0, -0.35); shape.closePath();
    w.mesh(new T.ShapeGeometry(shape), new T.MeshStandardMaterial({ color: ['#ffba65', '#eb759b', '#5bc3b6'][i % 3], side: T.DoubleSide }), g, q);
  }
  bake(g); return g;
}
export function stars(w: World, count = 240) {
  const xyz = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) { xyz[i * 3] = (w.c.rand() - 0.5) * 80; xyz[i * 3 + 1] = (w.c.rand() - 0.3) * 48; xyz[i * 3 + 2] = -25 - w.c.rand() * 35; }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(xyz, 3));
  w.scene.add(new T.Points(g, new T.PointsMaterial({ color: '#c3ddff', size: 0.075, sizeAttenuation: true })));
}
