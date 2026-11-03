import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BOARD, PARTS, packagePins, pinAt, type Part } from './layout';
import { LED_MESH } from './ledMesh';

/**
 * The parts of the PROM board as three.js geometry, built from their real packages (millimetres, Y up, the board's
 * top face at y = 0, board (x, y) → world (x − w/2, −(y − h/2))). Static geometry is gathered per material and merged
 * (a handful of draw calls, and one list of triangles for the ray tracer); what moves or lights up — LEDs, switch
 * levers, the rate knob — stays separate and is returned by name.
 */

export const toWorld = (x: number, y: number) => new THREE.Vector3(x - BOARD.w / 2, 0, -(y - BOARD.h / 2));

type MatKey =
  | 'epoxy' | 'socket' | 'tin' | 'mltRed' | 'mltBlue' | 'glass' | 'glassInk' | 'kt315' | 'kt361' | 'can' | 'rubber' | 'ceramic'
  | 'nickel' | 'lamination' | 'tape' | 'copperWire' | 'terminal' | 'plasticBlack' | 'brass' | 'chrome' | 'knob' | 'aluminium'
  | 'wireRed' | 'wireWhite' | 'wireBrown' | 'wireBlue' | 'solder' | 'bakelite' | 'label' | 'labelDark' | 'heatsink' | 'wood' | 'paper';

export function makeMaterials(labelMap: THREE.Texture, labelDarkMap: THREE.Texture) {
  const std = (color: string, roughness: number, metalness = 0, extra: THREE.MeshPhysicalMaterialParameters = {}) =>
    new THREE.MeshPhysicalMaterial({ color, roughness, metalness, ...extra });
  const m: Record<MatKey, THREE.Material> = {
    epoxy: std('#1a1a1c', 0.62, 0, { clearcoat: 0.15, clearcoatRoughness: 0.6 }),
    socket: std('#2b2622', 0.55),
    tin: std('#d4d8dc', 0.32, 1),
    mltRed: std('#8e3a28', 0.42, 0, { clearcoat: 0.5, clearcoatRoughness: 0.35 }),
    mltBlue: std('#3d5f78', 0.42, 0, { clearcoat: 0.5, clearcoatRoughness: 0.35 }),
    glass: std('#ffe6c0', 0.08, 0, { transparent: true, opacity: 0.55 }),
    glassInk: std('#2a1f1a', 0.4),
    kt315: std('#d9a22c', 0.45, 0, { clearcoat: 0.3 }),
    kt361: std('#bca93a', 0.45, 0, { clearcoat: 0.3 }),
    can: std('#c9cdd1', 0.34, 1),
    rubber: std('#161616', 0.85),
    ceramic: std('#d17a2c', 0.5, 0, { clearcoat: 0.3 }),
    nickel: std('#b8bcc1', 0.26, 1),
    lamination: std('#5f6367', 0.5, 0.85),
    tape: std('#d8b247', 0.62),
    copperWire: std('#b8733a', 0.35, 1),
    terminal: std('#2f7a4c', 0.5),
    plasticBlack: std('#141416', 0.5),
    brass: std('#b99d58', 0.33, 1),
    chrome: std('#eceef0', 0.12, 1),
    knob: std('#141414', 0.38, 0, { clearcoat: 0.6 }),
    aluminium: std('#c3c7cb', 0.4, 1),
    wireRed: std('#a8231d', 0.45),
    wireWhite: std('#e6e1d4', 0.5),
    wireBrown: std('#5a3a22', 0.5),
    wireBlue: std('#2c4f9a', 0.45),
    solder: std('#c9ccd0', 0.22, 1),
    bakelite: std('#2a1d16', 0.45, 0, { clearcoat: 0.4 }),
    label: new THREE.MeshStandardMaterial({ map: labelMap, transparent: true, roughness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    labelDark: new THREE.MeshStandardMaterial({ map: labelDarkMap, transparent: true, roughness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    heatsink: std('#9ea3a8', 0.45, 1),
    wood: std('#6b4a30', 0.7),
    paper: std('#efe6cf', 0.8),
  };
  return m;
}

/** Text drawn into one texture; each label is a small plane mapped onto its cell. */
export class LabelAtlas {
  readonly canvas: HTMLCanvasElement;
  private readonly g: CanvasRenderingContext2D;
  private x = 0;
  private y = 0;
  private rowH = 0;
  constructor(readonly size = 2048) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = size;
    this.canvas.height = size;
    this.g = this.canvas.getContext('2d')!;
  }
  /** A plane w × h mm facing +Y (lying on a surface), with the text centred; lines split on '\n'. */
  plane(text: string, w: number, h: number, color: string, weight = 'bold'): THREE.BufferGeometry {
    const ppm = 28;
    const cw = Math.ceil(w * ppm), ch = Math.ceil(h * ppm);
    if (this.x + cw > this.size) {
      this.x = 0;
      this.y += this.rowH + 2;
      this.rowH = 0;
    }
    const x = this.x, y = this.y;
    this.x += cw + 2;
    this.rowH = Math.max(this.rowH, ch);
    const g = this.g;
    const lines = text.split('\n');
    g.save();
    g.fillStyle = color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const fs = Math.min(ch / lines.length * 0.82, (cw / Math.max(...lines.map((l) => l.length))) * 1.7);
    g.font = `${weight} ${fs}px Arial, sans-serif`;
    lines.forEach((l, i) => g.fillText(l, x + cw / 2, y + (ch / lines.length) * (i + 0.5)));
    g.restore();
    const geo = new THREE.PlaneGeometry(w, h);
    geo.rotateX(-Math.PI / 2);
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i += 1) {
      uv.setXY(i, (x + uv.getX(i) * cw) / this.size, 1 - (y + (1 - uv.getY(i)) * ch) / this.size);
    }
    return geo;
  }
}

/** Gathers static geometry per material in world space; merged into one mesh per material at the end. */
export class Collector {
  private readonly lists = new Map<MatKey, THREE.BufferGeometry[]>();
  add(mat: MatKey, geo: THREE.BufferGeometry, matrix: THREE.Matrix4) {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(matrix);
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((g.getAttribute('position').count) * 2), 2));
    const list = this.lists.get(mat) ?? [];
    list.push(g);
    this.lists.set(mat, list);
  }
  build(materials: Record<MatKey, THREE.Material>): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    for (const [key, list] of this.lists) {
      const merged = mergeGeometries(list, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, materials[key]);
      mesh.name = key;
      mesh.userData.mat = key;
      out.push(mesh);
    }
    return out;
  }
}

// --- geometry helpers ----------------------------------------------------------------------------------------------
const M = () => new THREE.Matrix4();
const T = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z);
const RX = (a: number) => new THREE.Matrix4().makeRotationX(a);
const RY = (a: number) => new THREE.Matrix4().makeRotationY(a);
const RZ = (a: number) => new THREE.Matrix4().makeRotationZ(a);
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (r: number, h: number, seg = 20, r2 = r) => new THREE.CylinderGeometry(r2, r, h, seg);
function roundBox(w: number, h: number, d: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: r * 0.5, bevelSize: r * 0.5, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -h / 2);
  g.rotateX(-Math.PI / 2);
  return g;
}
/** A round wire along points (world-local), radius r. */
function wire(points: THREE.Vector3[], r: number, seg = 24) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.2);
  return new THREE.TubeGeometry(curve, seg, r, 8, false);
}
/** A lead: from (x, top, z) straight down through the board, protruding below. */
const leadDown = (x: number, z: number, top: number, r = 0.3) => {
  const g = cyl(r, top + 3.2, 8);
  g.translate(x, (top - 3.2) / 2, z);
  return g;
};

export type Dynamic = {
  leds: { k: number; group: THREE.Group; glow: THREE.Mesh[]; lens: THREE.Mesh; die: THREE.Mesh; color: THREE.Color; position: THREE.Vector3 }[];
  levers: Record<string, { pivot: THREE.Group; part: Part }>;
  knob: THREE.Group | null;
  hotspots: { ref: string; center: THREE.Vector3; radius: number }[];
};

export const LED_COLORS: Record<string, string> = { red: '#ff2a12', green: '#3cff3a', yellow: '#ffd21a' };
/** Where the decorative tree stands (world mm): on the desk to the left of the board (the panel takes the right). */
export const TREE_POSITION = { x: -(BOARD.w / 2 + 112), z: -8 };

/** Everything on the board (and around it): static geometry into the collector, moving parts returned. */
export function buildParts(col: Collector, atlas: LabelAtlas, root: THREE.Group, mats: Record<MatKey, THREE.Material>): Dynamic {
  const dyn: Dynamic = { leds: [], levers: {}, knob: null, hotspots: [] };
  const partMatrix = (p: Part) => {
    const w = toWorld(p.x, p.y);
    return T(w.x, 0, w.z).multiply(RY((p.rot * Math.PI) / 180));
  };
  /** Local pin position (x, −y) of a pin, in the part's frame. */
  const lp = (p: Part, pin: string) => {
    const q = packagePins(p.pkg)[pin];
    return [q[0], -q[1]] as const;
  };
  const addLabel = (pm: THREE.Matrix4, text: string, w: number, h: number, x: number, y: number, z: number, dark = false, rotY = 0) => {
    const geo = atlas.plane(text, w, h, dark ? '#1a1a1a' : '#e8e6e0', 'bold');
    col.add(dark ? 'labelDark' : 'label', geo, pm.clone().multiply(T(x, y, z)).multiply(RY(rotY)));
  };
  const solderJoints = (p: Part) => {
    // A cone of solder under the board at every pin.
    for (const pin of Object.keys(packagePins(p.pkg))) {
      const [x, y] = pinAt(p, pin);
      const w = toWorld(x, y);
      const g = cyl(0.95, 0.9, 10, 0.35);
      col.add('solder', g, T(w.x, -BOARD.thickness - 0.45, w.z).multiply(RX(Math.PI)));
    }
  };

  for (const p of PARTS) {
    const pm = partMatrix(p);
    const k = p.pkg;
    solderJoints(p);
    switch (k.kind) {
      case 'dip': {
        const n = k.pins, half = n / 2;
        const len = half * 2.54 + 0.3;
        const bodyW = k.row > 10 ? 13.6 : 6.3;
        const lift = k.socket ? 3.3 : 0.7;
        if (k.socket) {
          col.add('socket', roundBox(len + 2, 3, k.row + 2.6, 0.3), pm.clone().multiply(T(0, 1.5, 0)));
          // The socket's open middle.
          col.add('plasticBlack', box(len - 1, 0.2, k.row - 4.6), pm.clone().multiply(T(0, 3.05, 0)));
        }
        col.add('epoxy', roundBox(len, 3.2, bodyW, 0.35), pm.clone().multiply(T(0, lift + 1.6, 0)));
        // Pin-1 notch and dot.
        col.add('plasticBlack', cyl(0.9, 0.3, 16), pm.clone().multiply(T(-len / 2 + 0.2, lift + 3.3, 0)));
        col.add('plasticBlack', cyl(0.45, 0.2, 12), pm.clone().multiply(T(-len / 2 + 1.8, lift + 3.3, bodyW / 2 - 1.2)));
        for (const pin of Object.keys(packagePins(k))) {
          const [x, z] = lp(p, pin);
          const side = Math.sign(z);
          const shoulder = box(0.5, 0.25, Math.abs(z) - bodyW / 2 + 0.3);
          col.add('tin', shoulder, pm.clone().multiply(T(x, lift + 1.0, side * ((Math.abs(z) + bodyW / 2) / 2))));
          const leg = box(0.5, lift + 1.0 + 3, 0.25);
          col.add('tin', leg, pm.clone().multiply(T(x, (lift + 1.0 - 3) / 2, z)));
          col.add('tin', box(1.2, lift * 0.8 + 0.2, 0.26), pm.clone().multiply(T(x, lift * 0.4 + 0.6, z)));
        }
        addLabel(pm, `${p.label}\n${p.ref === 'DD6' ? '9711' : p.ref === 'DD2' ? '9803' : '9745'}`, len * 0.7, bodyW * 0.55, 0.6, lift + 3.26, 0);
        dyn.hotspots.push({ ref: p.ref, center: new THREE.Vector3().setFromMatrixPosition(pm).setY(lift + 3), radius: len / 2 });
        break;
      }
      case 'axial': {
        const half = k.pitch / 2;
        const mlt = k.body === 'mlt';
        const h = mlt ? 1.9 : 1.4;
        if (mlt) {
          const bodyMat: MatKey = p.label.includes('к') ? 'mltRed' : 'mltBlue';
          const prof = [
            new THREE.Vector2(0.001, -3.1), new THREE.Vector2(0.8, -3.1), new THREE.Vector2(1.18, -2.8), new THREE.Vector2(1.2, -2.2),
            new THREE.Vector2(1.05, -1.7), new THREE.Vector2(1.05, 1.7), new THREE.Vector2(1.2, 2.2), new THREE.Vector2(1.18, 2.8),
            new THREE.Vector2(0.8, 3.1), new THREE.Vector2(0.001, 3.1),
          ];
          col.add(bodyMat, new THREE.LatheGeometry(prof, 18), pm.clone().multiply(T(0, h, 0)).multiply(RZ(Math.PI / 2)));
          addLabel(pm, p.label, 3.2, 1.1, 0, h + 1.07, 0, false);
        } else {
          col.add('glass', cyl(0.85, 3.8, 14), pm.clone().multiply(T(0, h, 0)).multiply(RZ(Math.PI / 2)));
          col.add('glassInk', cyl(0.5, 1.4, 10), pm.clone().multiply(T(0, h, 0)).multiply(RZ(Math.PI / 2)));
          col.add('plasticBlack', cyl(0.88, 0.5, 14), pm.clone().multiply(T(1.3, h, 0)).multiply(RZ(Math.PI / 2)));
        }
        const bodyEnd = mlt ? 3.1 : 1.9;
        for (const s of [-1, 1]) {
          col.add('tin', wire([new THREE.Vector3(s * bodyEnd, h, 0), new THREE.Vector3(s * (half - 0.6), h, 0), new THREE.Vector3(s * half, h - 0.6, 0), new THREE.Vector3(s * half, 0, 0)], 0.3, 10), pm);
          col.add('tin', leadDown(s * half, 0, 0), pm);
        }
        break;
      }
      case 'kt13': {
        const mat: MatKey = p.label.includes('315') ? 'kt315' : 'kt361';
        const shape = new THREE.Shape();
        shape.moveTo(-3.5, 0);
        shape.lineTo(3.5, 0);
        shape.lineTo(3.5, 5.4);
        shape.quadraticCurveTo(3.5, 6.8, 2.2, 6.8);
        shape.lineTo(-2.2, 6.8);
        shape.quadraticCurveTo(-3.5, 6.8, -3.5, 5.4);
        shape.closePath();
        const g = new THREE.ExtrudeGeometry(shape, { depth: 2.6, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 1 });
        g.translate(0, 3, -1.3);
        col.add(mat, g, pm);
        const face = atlas.plane(p.label.slice(-1), 2, 2.2, '#2a2014');
        col.add('labelDark', face, pm.clone().multiply(T(0, 7.1, 1.46)).multiply(RX(Math.PI / 2)));
        for (const pin of ['E', 'C', 'B']) {
          const [x] = lp(p, pin);
          col.add('tin', box(0.6, 6.2, 0.2), pm.clone().multiply(T(x * 0.9, 0.1, 0)));
        }
        break;
      }
      case 'to39': {
        col.add('nickel', cyl(4.6, 0.5, 28), pm.clone().multiply(T(0, 1.8, 0)));
        col.add('nickel', cyl(4.15, 5.8, 28), pm.clone().multiply(T(0, 4.9, 0)));
        col.add('nickel', box(1.2, 0.5, 1.2), pm.clone().multiply(T(-3.6, 1.8, 3.6)).multiply(RY(Math.PI / 4)));
        addLabel(pm, `КТ608\nБ`, 6, 3.6, 0, 7.82, 0, true);
        for (const pin of ['E', 'B', 'C']) {
          const [x, z] = lp(p, pin);
          col.add('tin', leadDown(x, z, 1.6, 0.25), pm);
        }
        break;
      }
      case 'to126': {
        col.add('plasticBlack', box(8, 11, 2.8), pm.clone().multiply(T(0, 7.5, 0)));
        col.add('can', box(8, 11, 0.4), pm.clone().multiply(T(0, 7.5, 1.6)));
        col.add('heatsink', box(20, 18, 1.5), pm.clone().multiply(T(0, 10, 2.6)));
        for (let f = -3; f <= 3; f += 1) col.add('heatsink', box(1, 18, 7), pm.clone().multiply(T(f * 2.9, 10, 6.8)));
        addLabel(pm, 'КТ817\nГ', 6.2, 4, 0, 8, -1.42, false, 0);
        for (const pin of ['E', 'C', 'B']) {
          const [x] = lp(p, pin);
          col.add('tin', box(0.7, 2.4, 0.4), pm.clone().multiply(T(x, 1, 0)));
        }
        break;
      }
      case 'radial': {
        const r = k.d / 2;
        col.add('rubber', cyl(r * 0.96, 1.1, 32), pm.clone().multiply(T(0, 0.55 + 0.4, 0)));
        const prof = [
          new THREE.Vector2(r * 0.96, 1.4), new THREE.Vector2(r, 1.6), new THREE.Vector2(r, k.h - 2.6), new THREE.Vector2(r * 0.93, k.h - 2.2),
          new THREE.Vector2(r, k.h - 1.8), new THREE.Vector2(r, k.h - 0.4), new THREE.Vector2(r * 0.92, k.h), new THREE.Vector2(0.001, k.h),
        ];
        col.add('can', new THREE.LatheGeometry(prof, 36), pm);
        // Printed values on the can (a band facing the front).
        const band = atlas.plane(`${p.label}\nК50-6`, Math.min(r * 1.6, 14), Math.min(k.h * 0.5, 9), '#1d2a5a');
        col.add('labelDark', band, pm.clone().multiply(T(0, k.h * 0.5, r + 0.02)).multiply(RX(Math.PI / 2)));
        col.add('labelDark', atlas.plane('−', 1.8, 1.8, '#1d2a5a'), pm.clone().multiply(T(r * 0.55, k.h + 0.01, 0)));
        for (const pin of ['+', '-']) {
          const [x] = lp(p, pin);
          col.add('tin', leadDown(x, 0, 0.9, 0.3), pm);
        }
        break;
      }
      case 'ceramic': {
        col.add('ceramic', roundBox(5, 4, 2.2, 0.8), pm.clone().multiply(T(0, 4.2, 0)));
        addLabel(pm, '1000', 3.4, 1.4, 0, 4.2, 1.2, true);
        for (const s of [-1, 1]) col.add('tin', leadDown(s * 2.5, 0, 2.4, 0.25), pm);
        break;
      }
      case 'led': {
        const color = new THREE.Color(LED_COLORS[k.color]);
        const group = buildLed(color, mats);
        const w = new THREE.Vector3().setFromMatrixPosition(pm);
        group.position.copy(w);
        group.rotation.y = (p.rot * Math.PI) / 180;
        root.add(group);
        dyn.leds.push({
          k: Number(p.ref.slice(2)) - 1,
          group,
          glow: group.userData.glow,
          lens: group.userData.lens,
          die: group.userData.die,
          color,
          position: w.clone().setY(8.5),
        });
        break;
      }
      case 'pot': {
        col.add('aluminium', cyl(8, 7, 36), pm.clone().multiply(T(0, 4.5, -1.5)));
        col.add('aluminium', cyl(3.4, 5, 20), pm.clone().multiply(T(0, 10.5, -1.5)));
        col.add('brass', cyl(4.4, 1.6, 6), pm.clone().multiply(T(0, 9.2, -1.5)));
        for (const pin of ['1', '2', '3']) {
          const [x, z] = lp(p, pin);
          col.add('tin', box(1.2, 4, 0.4), pm.clone().multiply(T(x, 1, z)));
        }
        const knob = new THREE.Group();
        const kb = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 7, 9, 40), mats.knob);
        kb.position.y = 4.5;
        knob.add(kb);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.4, 0.4, 36), mats.aluminium);
        cap.position.y = 9.1;
        knob.add(cap);
        const mark = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 4.8), mats.wireWhite);
        mark.position.set(0, 9.35, -2.6);
        knob.add(mark);
        knob.position.copy(new THREE.Vector3().setFromMatrixPosition(pm)).add(new THREE.Vector3(0, 12.5, 1.5));
        root.add(knob);
        dyn.knob = knob;
        dyn.hotspots.push({ ref: p.ref, center: knob.position.clone().setY(18), radius: 8 });
        break;
      }
      case 'toggle': {
        const w3 = k.poles === 3 ? 13 : 8.4;
        col.add('bakelite', box(w3, 9, 7), pm.clone().multiply(T(0, 5, 0)));
        col.add('nickel', box(w3 + 1, 0.6, 8), pm.clone().multiply(T(0, 9.8, 0)));
        col.add('nickel', cyl(3, 6, 24), pm.clone().multiply(T(0, 13, 0)));
        col.add('nickel', cyl(4.4, 1.6, 6), pm.clone().multiply(T(0, 12.2, 0)));
        for (const pin of Object.keys(packagePins(k))) {
          const [x, z] = lp(p, pin);
          col.add('tin', box(1.6, 3, 0.4), pm.clone().multiply(T(x, 0.5, z)));
        }
        const pivot = new THREE.Group();
        pivot.position.copy(new THREE.Vector3().setFromMatrixPosition(pm)).setY(15.5);
        pivot.rotation.y = (p.rot * Math.PI) / 180;
        const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.6, 12, 16), mats.chrome);
        lever.position.y = 6;
        const tip = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 12), mats.chrome);
        tip.position.y = 12;
        pivot.add(lever, tip);
        root.add(pivot);
        dyn.levers[p.ref] = { pivot, part: p };
        dyn.hotspots.push({ ref: p.ref, center: pivot.position.clone().setY(22), radius: 7 });
        break;
      }
      case 'bridge': {
        col.add('plasticBlack', roundBox(18, 7, 6, 0.6), pm.clone().multiply(T(0, 4.6, 0)));
        addLabel(pm, 'КЦ405Е', 9, 2, 0, 8.21, 0);
        addLabel(pm, '~   +    −   ~', 16, 1.4, 0, 8.21, 2.1);
        for (const pin of ['~1', '+', '-', '~2']) {
          const [x] = lp(p, pin);
          col.add('tin', leadDown(x, 0, 1.2, 0.4), pm);
        }
        break;
      }
      case 'triac': {
        col.add('nickel', cyl(6.2, 3, 6), pm.clone().multiply(T(0, 1.9, 0)).multiply(RY(Math.PI / 6)));
        col.add('nickel', cyl(4.6, 6.5, 28), pm.clone().multiply(T(0, 6.6, 0)));
        col.add('nickel', cyl(4.9, 0.6, 28), pm.clone().multiply(T(0, 3.7, 0)));
        col.add('glass', cyl(2.1, 1.6, 16), pm.clone().multiply(T(0, 10.6, 0)));
        col.add('plasticBlack', cyl(4.2, 0.4, 24), pm.clone().multiply(T(0, 0.2, 0)));
        // The stud and its nut under the board.
        col.add('nickel', cyl(2.5, 6, 16), pm.clone().multiply(T(0, -4.6, 0)));
        col.add('nickel', cyl(4.6, 2.4, 6), pm.clone().multiply(T(0, -3, 0)).multiply(RY(Math.PI / 6)));
        addLabel(pm, 'КУ208Г', 6, 1.8, 0, 9.87, -2.5, true);
        // Leads out of the top: MT1 thick, the gate thin, bent down to their pads.
        for (const [pin, r] of [['MT1', 0.55], ['G', 0.35]] as const) {
          const [x, z] = lp(p, pin);
          const s = Math.sign(x);
          col.add('copperWire', wire([
            new THREE.Vector3(s * 0.7, 11, 0), new THREE.Vector3(s * 1.8, 13.4, z * 0.3), new THREE.Vector3(x * 0.8, 12.2, z * 0.8),
            new THREE.Vector3(x, 6, z), new THREE.Vector3(x, 0, z),
          ], r, 24), pm);
          col.add('tin', leadDown(x, z, 0, r), pm);
        }
        break;
      }
      case 'xfmrSmall': {
        col.add('lamination', box(12, 11, 9), pm.clone().multiply(T(0, 6.5, 0)));
        col.add('tape', box(7.2, 9.2, 10.4), pm.clone().multiply(T(0, 6.5, 0)));
        col.add('nickel', box(13, 0.5, 10.4), pm.clone().multiply(T(0, 12.2, 0)));
        col.add('nickel', box(15, 0.5, 3), pm.clone().multiply(T(0, 1, 0)));
        for (const pin of ['P1', 'P2', 'S1', 'S2']) {
          const [x, z] = lp(p, pin);
          col.add('copperWire', wire([new THREE.Vector3(x * 0.6, 5, z * 0.7), new THREE.Vector3(x, 2, z), new THREE.Vector3(x, 0, z)], 0.2, 8), pm);
          col.add('tin', leadDown(x, z, 0, 0.25), pm);
        }
        break;
      }
      case 'xfmrPower': {
        // Laminated core with its window, the bobbin with paper tape, a steel clamp.
        for (let s = 0; s < 34; s += 1) {
          col.add('lamination', box(38, 30, 0.72), pm.clone().multiply(T(0, 17, -12.2 + s * 0.74)));
        }
        col.add('tape', roundBox(20, 26, 36, 1.2), pm.clone().multiply(T(0, 17, 0)));
        col.add('paper', box(20.4, 3, 36.4), pm.clone().multiply(T(0, 22, 0)));
        col.add('nickel', box(40, 1, 27), pm.clone().multiply(T(0, 32.5, 0)));
        col.add('nickel', box(40, 1, 27), pm.clone().multiply(T(0, 1.5, 0)));
        for (const s of [-1, 1]) {
          col.add('nickel', box(1, 32, 27), pm.clone().multiply(T(s * 19.8, 17, 0)));
          col.add('brass', cyl(1.6, 36, 12), pm.clone().multiply(T(s * 15, 17, s * 11)));
        }
        addLabel(pm, 'ТПП-224\n~220В / 2×9В', 16, 6, 0, 33.02, 0, true);
        for (const pin of ['P1', 'P2', 'S1', 'S2']) {
          const [x, z] = lp(p, pin);
          const lead: MatKey = pin[0] === 'P' ? 'wireRed' : 'wireWhite';
          col.add(lead, wire([new THREE.Vector3(x * 0.55, 14, z * 0.9), new THREE.Vector3(x * 0.85, 8, z), new THREE.Vector3(x, 2, z), new THREE.Vector3(x, 0, z)], 0.6, 12), pm);
          col.add('tin', leadDown(x, z, 0, 0.4), pm);
        }
        break;
      }
      case 'terminal': {
        const len = k.pins * 5.08;
        col.add('terminal', box(len, 10, 8), pm.clone().multiply(T(0, 5, 0)));
        for (const pin of Object.keys(packagePins(k))) {
          const [x] = lp(p, pin);
          col.add('nickel', cyl(1.5, 0.8, 16), pm.clone().multiply(T(x, 10.2, 1.4)));
          col.add('plasticBlack', box(2.2, 0.3, 0.45), pm.clone().multiply(T(x, 10.62, 1.4)).multiply(RY(0.6 + x)));
          col.add('plasticBlack', box(3.4, 3.4, 0.4), pm.clone().multiply(T(x, 5, -4.02)));
          col.add('tin', box(0.9, 3, 0.9), pm.clone().multiply(T(x, 0.3, 0)));
        }
        break;
      }
      case 'jack': {
        col.add('plasticBlack', box(10, 11, 12), pm.clone().multiply(T(0, 5.5, 0)));
        col.add('nickel', cyl(4, 7, 24), pm.clone().multiply(T(-8, 6.5, 0)).multiply(RZ(Math.PI / 2)));
        col.add('plasticBlack', cyl(2.2, 7.2, 16), pm.clone().multiply(T(-8, 6.5, 0)).multiply(RZ(Math.PI / 2)));
        for (const pin of ['1', '2']) {
          const [x, z] = lp(p, pin);
          col.add('tin', box(1.4, 3, 0.4), pm.clone().multiply(T(x, 0.5, z)));
        }
        break;
      }
    }
  }
  // Brass standoffs at the mounting holes, the board resting on them.
  for (const [x, y] of [[4, 4], [BOARD.w - 4, 4], [4, BOARD.h - 4], [BOARD.w - 4, BOARD.h - 4]]) {
    const w = toWorld(x, y);
    col.add('brass', cyl(2.6, 8, 6), T(w.x, -BOARD.thickness - 4, w.z).multiply(RY(Math.PI / 6)));
    col.add('nickel', cyl(2.9, 1.2, 20), T(w.x, 0.6, w.z));
    col.add('plasticBlack', box(4, 0.4, 0.6), T(w.x, 1.25, w.z).multiply(RY(0.4)));
  }
  buildCables(col);
  return dyn;
}

/** One АЛ307 from the model: leads, die, glow volume, epoxy lens, reflector cup. */
function buildLed(color: THREE.Color, mats: Record<MatKey, THREE.Material>) {
  const bytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const pos16 = new Int16Array(bytes(LED_MESH.positions).buffer);
  const nrm8 = new Int8Array(bytes(LED_MESH.normals).buffer);
  const idx = new Uint16Array(bytes(LED_MESH.indices).buffer);
  const n = LED_MESH.vertices;
  const positions = new Float32Array(n * 3);
  const normals = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) {
    for (let a = 0; a < 3; a += 1) {
      positions[i * 3 + a] = LED_MESH.min[a] + ((pos16[i * 3 + a] + 32767) / 65534) * (LED_MESH.max[a] - LED_MESH.min[a]);
      normals[i * 3 + a] = nrm8[i * 3 + a] / 127;
    }
  }
  const group = new THREE.Group();
  const glow: THREE.Mesh[] = [];
  let lens: THREE.Mesh | null = null;
  let die: THREE.Mesh | null = null;
  for (const [start, count, name] of LED_MESH.groups) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setIndex(new THREE.BufferAttribute(idx.slice(start, start + count), 1));
    let mat: THREE.Material;
    if (name === 'LEADS') mat = mats.tin;
    else if (name === 'REFLECTOR') mat = mats.chrome;
    else if (name === 'LENS') {
      mat = new THREE.MeshPhysicalMaterial({
        color: color.clone().lerp(new THREE.Color('#ffffff'), 0.35), roughness: 0.12, transmission: 0.82, thickness: 4, ior: 1.52,
        attenuationColor: color, attenuationDistance: 5, transparent: true, emissive: color, emissiveIntensity: 0,
      });
    } else {
      mat = new THREE.MeshStandardMaterial({ color: name === 'EMITTER_WHITE' ? '#d8d8d8' : color, emissive: color, emissiveIntensity: 0, roughness: 0.4 });
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.part = name;
    if (name === 'LENS') lens = mesh;
    if (name === 'EMITTER') glow.push(mesh);
    if (name === 'EMITTER_WHITE') die = mesh;
    group.add(mesh);
  }
  // The flange 3 mm over the board, the leads through it.
  group.position.y = 0;
  group.children.forEach((c) => (c.position.y = 5.3));
  group.userData = { glow, lens, die };
  return group;
}

/**
 * The cables: from X3 (the lamps' outputs, HL9–HL16) along the desk behind the board to the tree, whose garland
 * sections are those lamps; the mains lead from X2 off the back of the desk.
 */
function buildCables(col: Collector) {
  const deskY = -BOARD.thickness - 8;
  const x3 = toWorld(148, 119);
  const tree = new THREE.Vector3(TREE_POSITION.x, deskY, TREE_POSITION.z);
  col.add('wireWhite', wire([
    x3.clone().add(new THREE.Vector3(0, 9, -3)), x3.clone().add(new THREE.Vector3(0, 12, -12)),
    new THREE.Vector3(x3.x - 16, deskY + 2.4, x3.z - 26), new THREE.Vector3(-40, deskY + 2.2, x3.z - 34),
    new THREE.Vector3(tree.x + 60, deskY + 2.2, tree.z - 40), new THREE.Vector3(tree.x + 36, deskY + 14, tree.z - 16),
    new THREE.Vector3(tree.x + 30, deskY + 30, tree.z - 12),
  ], 2.2, 80), M());
  const x2 = toWorld(179, 119);
  col.add('wireBrown', wire([
    x2.clone().add(new THREE.Vector3(0, 9, -3)), x2.clone().add(new THREE.Vector3(4, 10, -16)),
    new THREE.Vector3(x2.x + 30, deskY + 3.6, x2.z - 40), new THREE.Vector3(x2.x + 60, deskY + 2.6, x2.z - 110),
  ], 2.6, 40), M());
}
