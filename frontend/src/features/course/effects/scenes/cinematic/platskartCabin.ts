import { T, v, type World } from './world';
import { bake, cylinder, group, round } from './storyKit';
import type { TrainMaterials } from './platskartMaterials';

export function cabinDetails(w: World, parent: T.Object3D, m: TrainMaterials) {
  const g = group(parent); g.name = 'train-cabin-hardware';
  const screw = (x: number, y: number, z: number) => {
    const head = cylinder(w, g, .0065, .002, m.metal, x, y, z); head.rotation.x = Math.PI / 2;
    const slot = w.box(g, [.007, .0009, .001], [x, y, z + .0015], m.dark); slot.rotation.z = .42;
  };
  // Seams, gaskets and screw heads break up the large, otherwise empty wall.
  for (const x of [-1.73, -.99, -.24, .58]) {
    w.box(g, [.004, 1.68, .003], [x, .98, -1.233], m.rubber);
    round(w, g, [.016, 1.69, .004], [x + .009, .98, -1.229], m.underside, .001);
    for (const y of [.24, .75, 1.28, 1.74]) screw(x + .009, y, -1.222);
  }
  for (const y of [.19, .67, 1.85, 2.39]) round(w, g, [2.45, .013, .012], [-.59, y, -1.224], m.underside, .002);
  // Ventilation grille with a recessed dark back, individual angled louvres.
  const vent = group(g, -.25, 2.24, -1.202);
  round(w, vent, [.44, .18, .028], [0, 0, 0], m.underside, .01);
  w.box(vent, [.39, .13, .005], [0, 0, .016], m.dark);
  for (let i = 0; i < 9; i++) { const louvre = w.box(vent, [.38, .009, .012], [0, -.058 + i * .014, .024], m.underside); louvre.rotation.x = .4; }
  for (const x of [-.195, .195]) screw(x - .25, 2.24, -1.17);
  // A rolled towel over a coat hook and a textile strap, not just decorative dots.
  const towel = group(g, -.08, 1.42, -1.1);
  const cloth = new T.PlaneGeometry(.19, .4, 16, 30), pos = cloth.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, Math.sin(x * 84) * .011 + Math.sin(y * 13 + x * 24) * .003);
  }
  cloth.computeVertexNormals(); w.mesh(cloth, m.cloth, towel, v(0, -.19, 0));
  for (let i = 0; i < 3; i++) w.box(towel, [.18, .002, .002], [0, -.31 - i * .005, .014], m.blue);
  // Period-appropriate route plate, retained real typography rather than a fake texture.
  const plate = group(g, -1.25, 1.77, -1.19);
  round(w, plate, [.52, .115, .012], [0, 0, 0], m.porcelain, .007);
  w.text(plate, 'RĪGA — VALKA', '#343a32', .46, .062).position.z = .009;
  screw(-1.48, 1.77, -1.18); screw(-1.02, 1.77, -1.18);
  // Scuffs are sparse, anisotropic and concentrated around use/fasteners.
  const scratches = new T.InstancedMesh(new T.PlaneGeometry(1, 1), w.metal('#9d9a87', 0, .95), 110);
  const dummy = new T.Object3D();
  for (let i = 0; i < 110; i++) {
    const x = -.2 + w.c.rand() * .8, y = .35 + w.c.rand() * .75;
    dummy.position.set(x, y, -1.218); dummy.rotation.set(0, 0, (w.c.rand() - .5) * .4);
    dummy.scale.set(.004 + w.c.rand() * .035, .0006 + w.c.rand() * .001, 1); dummy.updateMatrix(); scratches.setMatrixAt(i, dummy.matrix);
  }
  g.add(scratches);
  // Table edge laminate, exposed ply, hinge bracket and inlaid fastening screws.
  for (let i = 0; i < 3; i++) round(w, g, [1.39, .0015, .003], [-.99, .779 + i * .007, .581], i === 1 ? m.piping : m.underside, .0005);
  for (const x of [-1.69, -.3]) for (const z of [-.44, .54]) {
    const head = cylinder(w, g, .005, .001, m.metal, x, .826, z);
    head.name = 'train-table-fastener';
  }
  // Paper and small everyday possessions make the space inhabited without blocking it.
  const ticket = group(g, -.98, .829, -.3); ticket.rotation.x = -Math.PI / 2; ticket.rotation.z = .18;
  round(w, ticket, [.19, .09, .0015], [0, 0, 0], m.cloth, .002);
  w.text(ticket, 'RĪGA · 17:42', '#4e4d40', .16, .025).position.set(0, .015, .002);
  for (let i = 0; i < 15; i++) w.box(ticket, [.001 + i % 3 * .0004, .018, .0005], [-.065 + i * .009, -.018, .002], m.piping);
  const box = group(g, -1.53, .835, -.34);
  round(w, box, [.065, .019, .042], [0, .01, 0], m.wood, .003);
  round(w, box, [.06, .001, .036], [0, .02, 0], m.cloth, .002);
  w.text(box, 'RĪGA', '#934d39', .043, .018).rotation.x = -Math.PI / 2;
  bake(g);
  // Local contact gradients complement the baked window illumination; no shadow maps.
  const shadowMaterial = new T.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1,
    vertexShader: 'varying vec2 q;void main(){q=uv-.5;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 q;void main(){float a=exp(-dot(q,q)*24.)*(1.-smoothstep(.3,.5,length(q)));gl_FragColor=vec4(.035,.026,.016,a*.3);}',
  });
  for (const [x, z, sx, sz] of [[-1.14, -.01, .26, .25], [-.6, .31, .48, .46], [-.43, -.22, .26, .22]]) {
    const patch = w.mesh(new T.PlaneGeometry(sx, sz), shadowMaterial, parent, v(x, .827, z)); patch.rotation.x = -Math.PI / 2; patch.castShadow = false;
  }
  return g;
}
