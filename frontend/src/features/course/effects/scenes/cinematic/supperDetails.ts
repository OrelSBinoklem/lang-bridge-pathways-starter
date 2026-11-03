import { T, TAU, v, type World } from './world';
import { bake, cylinder, group, round } from './storyKit';

/** Static place settings share materials and are merged with the dining room. */
export function supperTableDetails(w: World, room: T.Group) {
  const linen = w.metal('#f4dca7', 0, .92), berry = w.metal('#9d3257', .05, .28);
  const silver = w.metal('#d5ddd8', .8, .23), pastry = w.metal('#d69548', 0, .77);
  const glaze = w.metal('#fff1dc', .04, .26), leaves = w.metal('#49886c', 0, .8);
  // Woven border: small diamonds and cross stitches, not a high-resolution bitmap.
  for (let i = 0; i < 52; i++) for (const z of [-.09, .59]) {
    const motif = w.box(room, [.075, .012, .075], [-5.65 + i * .22, -1.349, z], linen); motif.rotation.y = Math.PI / 4;
  }
  for (let i = 0; i < 8; i++) {
    const x = -4.8 + i % 4 * 3.2, z = i < 4 ? -.6 : 1.05, side = i < 4 ? -1 : 1;
    const napkin = w.mesh(new T.ConeGeometry(.23, .3, 4), linen, room, v(x - .7, -1.18, z)); napkin.scale.z = .48;
    // Fork tines and a rounded spoon bowl remain visible when zooming in.
    for (const dx of [-.026, 0, .026]) w.box(room, [.012, .02, .13], [x - .49 + dx, -1.29, z - .23], silver);
    const spoon = w.sphere(room, .07, [x + .49, -1.28, z - .23], silver); spoon.scale.set(.7, .18, 1.2);
    const cupX = x + .55, cupZ = z + side * .3;
    cylinder(w, room, .115, .025, silver, cupX, -1.32, cupZ);
    cylinder(w, room, .022, .21, silver, cupX, -1.2, cupZ);
    const bowl = w.mesh(new T.SphereGeometry(.13, 16, 12, 0, TAU, 0, Math.PI * .72), berry, room, v(cupX, -1.03, cupZ)); bowl.rotation.x = Math.PI;
    w.ring(room, .1, .012, silver, v(cupX, -.947, cupZ)).rotation.x = Math.PI / 2;
    for (let cut = 0; cut < 3; cut++) {
      const score = w.box(room, [.13, .012, .017], [x - .065 + cut * .065, -1.099, z], glaze); score.rotation.y = -.6;
    }
  }
  for (const x of [-4.3, 2.1, 4.4]) {
    cylinder(w, room, .43, .045, glaze, x, -1.32, .23);
    for (let j = 0; j < 5; j++) {
      const a = j * TAU / 5;
      const bun = w.mesh(new T.TorusGeometry(.115, .055, 8, 18, Math.PI * 1.65), pastry, room, v(x + Math.cos(a) * .22, -1.21, .23 + Math.sin(a) * .21));
      bun.rotation.set(Math.PI / 2, 0, a);
    }
  }
  // Piped cream and berries on the existing cake; no changing the cake's silhouette.
  for (let i = 0; i < 24; i++) {
    const a = i * TAU / 24;
    const dot = w.mesh(new T.SphereGeometry(.045, 8, 6), glaze, room, v(.2 + Math.cos(a) * .47, -.82, .2 + Math.sin(a) * .47)); dot.scale.y = 1.5;
  }
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4;
    const leaf = w.mesh(new T.SphereGeometry(.1, 10, 6), leaves, room, v(.2 + Math.cos(a) * .18, -.59, .2 + Math.sin(a) * .18)); leaf.scale.set(1, .13, .45); leaf.rotation.y = a;
  }
  cylinder(w, room, .15, .035, glaze, -2, -.79, .2); cylinder(w, room, .045, .055, silver, -2, -.75, .2);
}

/** Accessories follow the existing character rig; they do not modify other scene people. */
export function supperGuestDetails(w: World, root: T.Group, index: number) {
  root.name = 'supper-guest';
  const g = group(root), ivory = w.metal('#f1dfbd', 0, .8), dark = w.metal('#353038', .3, .6);
  const hair = w.metal(['#d9d4c6', '#633e2c', '#24232f', '#b98342'][index % 4], 0, .8);
  if (index % 3 === 0) {
    for (const x of [-.065, .065]) w.ring(g, .045, .009, dark, v(x, 1.02, .171));
    w.box(g, [.045, .012, .015], [0, 1.025, .177], dark);
  }
  if (index % 3 === 1) {
    const bun = w.sphere(g, .11, [0, 1.19, -.07], hair); bun.scale.y = .8;
    w.ring(g, .073, .012, ivory, v(0, 1.2, -.07)).rotation.x = Math.PI / 2;
  } else {
    for (let i = 0; i < 5; i++) w.mesh(new T.SphereGeometry(.06, 10, 8), hair, g, v(-.12 + i * .06, 1.15 + Math.sin(i / 4 * Math.PI) * .035, .04));
  }
  for (const side of [-1, 1]) {
    const collar = w.box(g, [.09, .13, .02], [side * .06, .8, .12], ivory); collar.rotation.z = side * .35;
  }
  for (let i = 0; i < 3; i++) w.mesh(new T.SphereGeometry(.012, 8, 6), ivory, g, v(0, .69 - i * .075, .12));
  bake(g);
}

/** A curious cat and a bounded steam point cloud supply small secondary motion. */
export function supperLife(w: World, stage: T.Group) {
  const cat = group(stage); cat.name = 'supper-cat';
  const fur = w.metal('#d6a36d', 0, .85), pale = w.metal('#f3dec0', 0, .9), ink = w.metal('#443945', 0, .8);
  const body = group(cat);
  w.sphere(body, .22, [0, .32, 0], fur).scale.set(.85, 1, 1.8);
  w.sphere(body, .19, [0, .52, .35], fur);
  w.sphere(body, .115, [0, .45, .48], pale).scale.set(1, .6, .5);
  for (const side of [-1, 1]) {
    w.mesh(new T.ConeGeometry(.085, .2, 3), fur, body, v(side * .12, .72, .32));
    w.sphere(body, .025, [side * .075, .56, .508], ink);
    for (let i = 0; i < 3; i++) w.beam(body, v(side * .055, .45, .52), v(side * .24, .43 + i * .025, .53), .004, pale);
  }
  w.mesh(new T.ConeGeometry(.035, .04, 3), ink, body, v(0, .48, .54)).rotation.x = Math.PI / 2;
  bake(body);
  const legs = [-1, 1].flatMap(side => [-1, 1].map(end => {
    const leg = group(cat, side * .12, .3, end * .25);
    round(w, leg, [.11, .27, .12], [0, -.13, 0], fur);
    round(w, leg, [.13, .07, .18], [0, -.26, .035], pale); bake(leg); return leg;
  }));
  const tail = group(cat, 0, .36, -.32);
  w.tube(tail, [v(), v(0, .1, -.25), v(0, .5, -.36), v(.07, .65, -.25)], fur, .045);
  const geometry = new T.BufferGeometry(), xyz = new Float32Array(48 * 3);
  geometry.setAttribute('position', new T.BufferAttribute(xyz, 3));
  const steam = new T.Points(geometry, new T.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { size: { value: 35 } },
    vertexShader: 'uniform float size; varying float fade; void main(){vec4 p=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*p; gl_PointSize=clamp(size/-p.z,1.,9.); fade=1.-smoothstep(-.7,.5,position.y);}',
    fragmentShader: 'varying float fade; void main(){float r=length(gl_PointCoord-.5)*2.; gl_FragColor=vec4(.9,.85,.75,(1.-smoothstep(.1,1.,r))*.13*fade);}',
  })); steam.name = 'supper-steam'; steam.frustumCulled = false; stage.add(steam);
  return (time: number) => {
    // Closed path, no teleport at either end. The cat glances up at the feast.
    const a = time * .13, moving = Math.max(0, Math.cos(time * .35));
    cat.position.set(Math.sin(a) * 5.8, -3.26, 2.85 + Math.cos(a) * .35);
    cat.rotation.y = Math.atan2(Math.cos(a) * 5.8, -Math.sin(a) * .35);
    body.rotation.x = -.08 - moving * .12; tail.rotation.z = Math.sin(time * 1.7) * .25;
    legs.forEach((leg, i) => { leg.rotation.x = Math.sin(time * 7 + (i === 0 || i === 3 ? 0 : Math.PI)) * .35; });
    for (let i = 0; i < 48; i++) {
      const u = (time * .18 + i / 48) % 1;
      xyz[i * 3] = -2 + Math.sin(u * 7 + i * 1.7) * u * .16;
      xyz[i * 3 + 1] = -.72 + u * 1.1;
      xyz[i * 3 + 2] = .2 + Math.cos(u * 6 + i) * u * .12;
    }
    geometry.attributes.position.needsUpdate = true;
  };
}
