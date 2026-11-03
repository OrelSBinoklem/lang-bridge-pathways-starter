import { T, TAU, v, type World } from './world';
import { bake, cylinder, group, round } from './storyKit';
import type { TrainMaterials } from './platskartMaterials';
import { teaSteam } from './platskartSteam';
export { passengerHand } from './platskartHands';

export function teaGlass(w: World, parent: T.Object3D, m: TrainMaterials) {
  const root = group(parent, -1.14, .834, -.01); root.name = 'train-tea';
  const profile = [[0, .008], [.068, .008], [.075, .02], [.078, .2], [.074, .208], [.07, .2], [.067, .023]].map(([x, y]) => new T.Vector2(x, y));
  w.mesh(new T.LatheGeometry(profile, 64), m.glass, root);
  const rim = w.ring(root, .075, .0032, m.glass, v(0, .204, 0)); rim.rotation.x = Math.PI / 2;
  const holder = group(root); holder.name = 'train-podstakannik';
  for (const y of [.012, .035, .11, .131]) { const ring = w.ring(holder, .081, .004, m.metal, v(0, y)); ring.rotation.x = Math.PI / 2; }
  cylinder(w, holder, .083, .012, m.metal, 0, .007, 0);
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * TAU;
    w.beam(holder, v(Math.cos(a) * .08, .02, Math.sin(a) * .08), v(Math.cos(a) * .08, .126, Math.sin(a) * .08), .0025, m.metal);
    const points = Array.from({ length: 13 }, (_, j) => {
      const t = j / 12 * TAU, angle = a + Math.sin(t) * .13;
      return v(Math.cos(angle) * .082, .075 + Math.cos(t) * .033, Math.sin(angle) * .082);
    });
    w.tube(holder, points, m.metal, .0017, true);
  }
  for (const y of [.037, .113]) w.tube(holder, [v(.074, y, 0), v(.12, y + (y > .1 ? -.01 : .01), 0), v(.127, .075, 0)], m.metal, .006);
  const badge = w.mesh(new T.SphereGeometry(.022, 20, 14), m.brass, holder, v(0, .075, .083)); badge.scale.set(1.2, 1.4, .18);
  const emblem = new T.Shape();
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + Math.PI / 2, r = i % 2 ? .007 : .015; if (!i) emblem.moveTo(Math.cos(a) * r, Math.sin(a) * r); else emblem.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  emblem.closePath(); w.mesh(new T.ShapeGeometry(emblem), m.metal, holder, v(0, .075, .088));
  bake(holder);
  const liquid = cylinder(w, root, .068, .139, m.tea, 0, .087, 0); liquid.name = 'train-tea-liquid';
  const meniscus = w.ring(root, .0675, .0025, m.tea, v(0, .158, 0)); meniscus.rotation.x = Math.PI / 2;
  const teaSurface = w.mesh(new T.CircleGeometry(.067, 48), new T.ShaderMaterial({
    transparent: true, uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec2 uvp; void main(){uvp=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 uvp; uniform float time; void main(){vec2 p=uvp-.5;float a=sin(length(p)*85.-time*3.)*.015;float h=exp(-length(p-vec2(-.2,.1))*18.);gl_FragColor=vec4(vec3(.17,.075,.012)+h*.38+a,.88);}',
  }), root, v(0, .159, 0)); teaSurface.rotation.x = -Math.PI / 2;
  const shader = teaSurface.material as T.ShaderMaterial;
  const { steam, steamMaterial } = teaSteam(w, root);
  return { root, steam, steamMaterial, shader };
}

export function trainMeal(w: World, parent: T.Object3D, m: TrainMaterials) {
  const plate = group(parent, -.6, .834, .31); plate.name = 'train-meal';
  const rim = [[0, .005], [.13, .005], [.155, .018], [.19, .027], [.192, .035], [.153, .027], [.126, .014], [0, .014]].map(([x, y]) => new T.Vector2(x, y));
  w.mesh(new T.LatheGeometry(rim, 64), m.porcelain, plate);
  const blueRim = w.ring(plate, .189, .003, m.blue, v(0, .035, 0)); blueRim.rotation.x = Math.PI / 2;
  const grain = new T.InstancedMesh(new T.SphereGeometry(.009, 5, 4), w.metal('#d2b789', .05, .85), 420);
  const dummy = new T.Object3D();
  for (let i = 0; i < 420; i++) {
    const a = w.c.rand() * TAU, r = Math.sqrt(w.c.rand()) * .115;
    dummy.position.set(Math.cos(a) * r, .025 + (.12 - r) * .4 + w.c.rand() * .015, Math.sin(a) * r);
    dummy.rotation.set(w.c.rand() * 2, w.c.rand() * 3, w.c.rand() * 2); dummy.scale.set(1, .6, .65); dummy.updateMatrix(); grain.setMatrixAt(i, dummy.matrix);
    grain.setColorAt(i, new T.Color().setHSL(.075 + w.c.rand() * .025, .25, .24 + w.c.rand() * .16));
  }
  plate.add(grain);
  for (let i = 0; i < 4; i++) {
    const cucumber = cylinder(w, plate, .038, .007, w.metal('#819042', .02, .8), .08 + i * .014, .032 + i * .005, -.06);
    const edge = w.ring(cucumber, .036, .002, w.metal('#354b27', .03, .7)); edge.rotation.x = Math.PI / 2;
  }
  const tableProps = group(parent);
  const napkin = w.box(tableProps, [.28, .002, .2], [-.34, .835, -.22], m.cloth); napkin.rotation.y = -.22;
  const crust = w.metal('#695137', .02, .9), crumb = w.metal('#bc9e6c', 0, .98);
  for (let i = 0; i < 2; i++) {
    const bread = group(tableProps, -.43 + i * .03, .862 + i * .025, -.22 + i * .018); bread.rotation.y = -.18;
    round(w, bread, [.19, .028, .15], [0, 0, 0], crust, .026);
    round(w, bread, [.165, .007, .126], [0, .016, 0], crumb, .018);
    for (let k = 0; k < 26; k++) w.sphere(bread, .002 + w.c.rand() * .003, [(w.c.rand() - .5) * .145, .02, (w.c.rand() - .5) * .1], crust).scale.y = .15;
  }
  for (const [x, z] of [[-1.35, .17], [-1.29, .21]]) round(w, tableProps, [.032, .03, .032], [x, .85, z], m.porcelain, .004);
  const salt = group(tableProps, -1.48, .834, -.25);
  cylinder(w, salt, .028, .075, m.glass, 0, .038, 0); cylinder(w, salt, .024, .06, m.cloth, 0, .032, 0);
  cylinder(w, salt, .03, .014, m.metal, 0, .082, 0);
  for (let i = 0; i < 6; i++) { const dot = w.mesh(new T.CircleGeometry(.0018, 6), m.dark, salt, v(Math.cos(i) * .014, .09, Math.sin(i) * .014)); dot.rotation.x = -Math.PI / 2; }
  bake(tableProps);
  return plate;
}

