import { T, v, type World } from './world';
import { group, round } from './storyKit';
import type { TrainMaterials } from './platskartMaterials';

function perimeter(width: number, depth: number, y: number, inset: number) {
  const points: T.Vector3[] = [], r = .035;
  for (let corner = 0; corner < 4; corner++) for (let j = 0; j <= 8; j++) {
    const a = corner * Math.PI / 2 + j / 8 * Math.PI / 2;
    points.push(v((corner === 0 || corner === 3 ? 1 : -1) * (width / 2 - inset - r) + Math.cos(a) * r, y, (corner < 2 ? 1 : -1) * (depth / 2 - inset - r) + Math.sin(a) * r));
  }
  return points;
}

export function berthUpholstery(w: World, parent: T.Object3D, m: TrainMaterials, width: number, depth: number, y: number, bedding: boolean, side: boolean) {
  const g = group(parent); g.name = 'train-stitched-mattress';
  // Pressed steel bottom, veneered trim, sprung vinyl top and a separate welt.
  round(w, g, [width - .04, .06, depth - .035], [0, y - .035, 0], m.underside, .012);
  round(w, g, [width, .045, depth], [0, y + .005, 0], m.wood, .012);
  const cushion = round(w, g, [width - .025, .112, depth - .02], [0, y + .075, 0], m.vinyl, .045);
  const pos = cushion.geometry.attributes.position, colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), yy = pos.getY(i), z = pos.getZ(i);
    const edge = Math.min(width / 2 - Math.abs(x), depth / 2 - Math.abs(z));
    const sag = .011 * Math.exp(-((x / (width * .29)) ** 2 + (z / (depth * .31)) ** 2));
    const wrinkle = Math.sin(x * 61 + z * 23) * .0015 * Math.exp(-Math.max(0, edge) * 35);
    if (yy > 0) pos.setY(i, yy - sag + wrinkle);
    const wear = .82 + .13 * Math.max(0, 1 - edge * 10) + .035 * Math.sin(x * 11 + z * 5);
    colors.set([wear * .98, wear, wear * .98], i * 3);
  }
  cushion.geometry.setAttribute('color', new T.BufferAttribute(colors, 3)); cushion.geometry.computeVertexNormals();
  w.tube(g, perimeter(width, depth, y + .077, .023), m.piping, .0028, true);
  w.tube(g, perimeter(width, depth, y + .103, .028), m.stitch, .0007, true);
  // Hinge knuckles, slotted screw heads and braced underside ribs remain visible.
  for (const x of [-width / 2 + .13, width / 2 - .13]) {
    round(w, g, [.075, .11, .014], [x, y - .07, depth / 2 + .001], m.metal, .006);
    for (const dy of [-.035, .035]) {
      const head = w.mesh(new T.CylinderGeometry(.008, .008, .003, 16), m.metal, g, v(x, y - .07 + dy, depth / 2 + .011)); head.rotation.x = Math.PI / 2;
      w.box(g, [.009, .0012, .0007], [x, y - .07 + dy, depth / 2 + .013], m.dark);
    }
  }
  for (let i = 0; i < 5; i++) round(w, g, [width - .13, .016, .023], [0, y - .071, (i - 2) * (depth - .17) / 4], m.underside, .003);
  g.userData.welt = true; g.userData.hinges = 2;
  if (!bedding) return;
  // Pinched fabric pillow, with seams rather than an inflated oval primitive.
  const pillow = w.mesh(new T.SphereGeometry(1, 48, 32), m.cloth, g, v(-width * .32, y + .18, 0));
  const pp = pillow.geometry.attributes.position;
  for (let i = 0; i < pp.count; i++) {
    const xx = pp.getX(i), zz = pp.getZ(i), yy = pp.getY(i);
    const x = Math.sign(xx) * Math.abs(xx) ** .62 * (side ? .24 : .3);
    const z = Math.sign(zz) * Math.abs(zz) ** .62 * (side ? .275 : .2);
    const pinch = (Math.abs(xx) * Math.abs(zz)) ** 2;
    pp.setXYZ(i, x, yy * .076 * (1 - pinch * .8) + Math.sin(x * 68 + z * 17) * .002 * (1 - Math.abs(yy)), z);
  }
  pillow.geometry.computeVertexNormals(); pillow.rotation.y = .08;
  const seam = group(g, -width * .32, y + .178, 0); seam.rotation.y = .08;
  w.tube(seam, perimeter(side ? .48 : .6, side ? .55 : .4, 0, .008), m.stitch, .0009, true);
  const cloth = new T.PlaneGeometry(width * .56, depth * .85, 56, 28), cp = cloth.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i), z = cp.getY(i);
    const fold = Math.sin(x * 28 + z * 4) * .005 + Math.sin(z * 37 + x * 6) * .003;
    cp.setZ(i, fold + .013 * Math.exp(-x * x * 16) + .004 * Math.sin(x * 68 + z * 16));
  }
  cloth.computeVertexNormals();
  const sheet = w.mesh(cloth, m.cloth, g, v(width * .1, y + .14, .01)); sheet.rotation.x = -Math.PI / 2;
  // A folded wool blanket with thickness, soft edge and woven stripe, not painted bars.
  round(w, g, [width * .21, .032, depth * .82], [width * .27, y + .159, .015], m.blanket, .013);
  for (let i = 0; i < 3; i++) round(w, g, [.007, .002, depth * .79], [width * .3 + i * .012, y + .177, .015], m.stitch, .001);
}
