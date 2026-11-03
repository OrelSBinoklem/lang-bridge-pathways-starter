import { T, v, type World } from './world';
import { backdrop, cylinder, group } from './storyKit';

/** A continuous editable face envelope and independent bone/feature assemblies. No fixed bone count. */
export function faceAtelier(w: World) {
  backdrop(w, '#122a3e', '#262438');
  const head = group(w.root, 0, .1);
  w.eye.set(0, .7, w.mobile ? 15 : 12); w.target.set(0, .1, 0); w.cameraMotion = .1;
  const ivory = w.metal('#e2d2af', .04, .62), cavity = w.metal('#252a36', .05, .65);
  const skinMaterial = new T.MeshPhysicalMaterial({ color: '#e9b49c', transparent: true, opacity: .48, roughness: .48, metalness: 0, clearcoat: .22, side: T.FrontSide, depthWrite: false });
  const geometry = new T.SphereGeometry(1, 96, 64);
  const original = new Float32Array(geometry.attributes.position.array);
  const skin = w.mesh(geometry, skinMaterial, head); skin.renderOrder = 3;
  skin.name = 'face-skin';
  const skull = w.sphere(head, 1, [0, .35, -.08], ivory); skull.scale.set(1.25, 1.8, .92);
  const jaw = group(head, 0, -.9, 0);
  const jawCurve = w.tube(jaw, [v(-1, .45, .35), v(-.9, -.4, .6), v(0, -.78, .9), v(.9, -.4, .6), v(1, .45, .35)], ivory, .17);
  void jawCurve;
  const cheeks = [-1, 1].map(side => {
    const g = group(head, side * .73, -.15, .85);
    w.sphere(g, .3, [0, 0, 0], ivory).scale.set(1.4, .6, .65);
    return g;
  });
  const eyes = [-1, 1].map(side => {
    const g = group(head, side * .53, .5, .8);
    w.sphere(g, .44, [0, 0, -.12], cavity).scale.set(1.12, .9, .7);
    w.ring(g, .42, .055, ivory).scale.set(1.12, .9, 1);
    w.sphere(g, .28, [0, 0, .12], w.metal('#eeeadd', 0, .3));
    const iris = w.sphere(g, .14, [0, 0, .36], w.metal('#368c86', .15, .25)); iris.scale.z = .25;
    const pupil = w.sphere(g, .065, [0, 0, .395], cavity); pupil.scale.z = .2;
    const brow = w.beam(g, v(-.39, .46, .22), v(.39, .46, .22), .045, w.metal('#5f4742', 0, .9));
    return { g, iris, pupil, brow, side };
  });
  const nose = w.mesh(new T.ConeGeometry(.21, .8, 4), ivory, head, v(0, .05, 1.01)); nose.rotation.x = .65;
  for (let i = -5; i <= 5; i++) {
    const x = i * .12, z = .92 - .23 * (x / .6) ** 2;
    w.box(jaw, [.1, .19, .12], [x, -.12, z], ivory);
  }
  const lips: T.Mesh[] = [];
  for (let i = 0; i < 26; i++) lips.push(w.sphere(head, .073, [0, 0, 0], w.metal('#a35c60', 0, .56)));
  for (const side of [-1, 1]) { const ear = w.ring(head, .3, .1, ivory, v(side * 1.38, .15, 0)); ear.scale.set(.55, 1.3, .6); }
  cylinder(w, head, .45, 1, ivory, 0, -2.6, -.2);
  cylinder(w, w.root, 2.4, .25, w.metal('#35545c'), 0, -3.3, 0);
  w.text(w.root, 'АТЕЛЬЕ ХАРАКТЕРА', '#dfd8cc', 5, .43).position.set(0, 3.45, 0);
  w.text(w.root, '⋮ — череп, кожа, черты и эмоции', '#b9d7e0', 5, .3).position.set(0, -3.8, .4);
  let key = '';
  w.ticks.push((time, dt, pointer) => {
    const p = w.c.params;
    const shapeKey = [p.faceWidth, p.faceJaw, p.faceNose, p.faceEyes, p.faceMood].join(':');
    if (key !== shapeKey) {
      key = shapeKey;
      const position = geometry.attributes.position;
      for (let i = 0; i < position.count; i++) {
        const sx = original[i * 3], sy = original[i * 3 + 1], sz = original[i * 3 + 2];
        let x = sx * 1.48 * p.faceWidth * (sy < -.1 ? 1 + (p.faceJaw - 1) * Math.min(1, -sy * 1.4) : 1);
        const y = sy * 2.35;
        let z = sz * 1.15;
        if (sz > 0) {
          const eye = Math.min((x - .53 * p.faceEyes) ** 2, (x + .53 * p.faceEyes) ** 2);
          z -= .22 * Math.exp(-eye / .12 - (y - .5) ** 2 / .18);
          z += .55 * p.faceNose * Math.exp(-x * x / .065 - (y - .02) ** 2 / .28);
          z += .12 * Math.exp(-x * x / .48 - (y + .9) ** 2 / .09);
        }
        if (!Number.isFinite(x)) x = sx;
        position.setXYZ(i, x, y, z);
      }
      position.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingSphere();
      skull.scale.x = 1.25 * p.faceWidth; jaw.scale.x = p.faceJaw * p.faceWidth;
      nose.scale.z = p.faceNose; nose.position.z = .9 + p.faceNose * .12;
      cheeks.forEach((cheek, i) => { cheek.position.x = (i ? 1 : -1) * .73 * p.faceWidth; });
      eyes.forEach(({ g, side, brow }) => { g.position.x = side * .53 * p.faceEyes; brow.rotation.z = -Math.PI / 2 + side * p.faceMood * .35; });
      lips.forEach((lip, i) => { const x = (i / 25 - .5) * 1.12; lip.position.set(x, -.84 + p.faceMood * (x * x - .24), 1.02 - x * x * .2); });
    }
    skinMaterial.opacity = p.faceSkin;
    head.rotation.y = Math.sin(time * .17) * .12 + (pointer.active ? (pointer.x / w.c.width - .5) * .6 : 0);
    const gazeX = pointer.active ? (pointer.x / w.c.width - .5) * .08 : 0;
    eyes.forEach(({ iris, pupil }) => { iris.position.x = gazeX; pupil.position.x = gazeX; });
  });
}

export function politeMask(w: World) {
  backdrop(w, '#251b38', '#452f49');
  w.eye.set(0, 1, w.mobile ? 21 : 17);
  const left = w.side(0), right = w.side(1);
  // This camera is closer than the shared world camera; reserve space for both faces and their labels.
  w.sidePadding = 8.5;
  const dark = w.metal('#38252e', .1, .6), skin = w.metal('#c96754', 0, .6), porcelain = w.metal('#eee5d5', .12, .23);
  const makeFace = (parent: T.Group, material: T.Material, smile: boolean) => {
    const g = group(parent);
    w.sphere(g, 1, [0, 0, 0], material).scale.set(1.7, 2.3, .6);
    for (const side of [-1, 1]) {
      w.sphere(g, .14, [side * .6, .5, .6], dark).scale.set(1, smile ? .5 : 1, .3);
      const brow = w.beam(g, v(side * .3, .95, .55), v(side * .95, .95, .55), .06, dark); brow.rotation.z += side * (smile ? .12 : .48);
    }
    w.tube(g, Array.from({ length: 17 }, (_, i) => { const x = (i / 16 - .5) * 1.7; return v(x, -.65 + (smile ? 1 : -1) * (x * x - .6) * .6, .62); }), dark, .065);
    return g;
  };
  const angry = makeFace(left, skin, false), mask = makeFace(left, porcelain, true);
  mask.name = 'persona-mask';
  const mirror = makeFace(right, skin, false);
  w.text(left, 'СНАРУЖИ: ВСЁ ПРЕКРАСНО', '#f1d8a7', 6, .35).position.set(0, 3, 0);
  w.text(right, 'ВНУТРИ: А-А-А!', '#ffb8a1', 5, .4).position.set(0, 3, 0);
  w.text(right, 'Клик — снять / надеть маску', '#d1c1d8', 6, .32).position.set(0, -3.1, 0);
  const steam = Array.from({ length: 20 }, (_, i) => w.sphere(right, .12 + i % 3 * .05, [0, 0, -.1], w.glass('#eab5ba', .35)));
  let off = false, lift = 0;
  w.ticks.push((t, dt, p) => {
    if (p.clicked) off = !off;
    lift += ((off ? 1 : 0) - lift) * (1 - Math.exp(-dt * 4));
    mask.position.set(lift * 1.6, lift * 2.4, .65 + lift * .3); mask.rotation.z = lift * -.4;
    angry.rotation.z = Math.sin(t * 17) * .014;
    mirror.rotation.z = Math.sin(t * 19) * .025;
    steam.forEach((s, i) => { const u = (t * .6 + i / steam.length) % 1; s.position.set((i % 2 ? 1 : -1) * (1.45 + u * .6), u * 2.5, -.2); s.scale.setScalar(Math.sin(u * Math.PI)); });
  });
}
