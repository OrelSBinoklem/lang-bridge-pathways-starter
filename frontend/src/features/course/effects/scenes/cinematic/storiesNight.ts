import { T, TAU, v, type World } from './world';
import { backdrop, bake, bunting, cylinder, deck, group, lamp, person, plant, railing, round, stars } from './storyKit';

function lantern(w: World, p: T.Object3D, color: string) {
  const g = group(p), paper = w.glow(color, 0.5), rib = w.metal('#7d4e43');
  w.sphere(g, 0.3, [0, 0, 0], paper).scale.y = 1.25;
  for (let i = 0; i < 7; i++) { const y = -0.28 + i * 0.093, r = 0.303 * Math.sqrt(1 - (y / 0.38) ** 2); w.ring(g, r, 0.009, rib, v(0, y)).rotation.x = Math.PI / 2; }
  for (const y of [-0.36, 0.36]) cylinder(w, g, 0.12, 0.06, rib, 0, y);
  w.beam(g, v(0, -0.4), v(0, -0.7), 0.012, rib); bake(g); return g;
}
function stool(w: World, p: T.Object3D, x: number, z: number) {
  const g = group(p, x, 0, z), wood = w.metal('#86674e'), iron = w.metal('#3b4241');
  cylinder(w, g, 0.28, 0.1, wood, 0, 0.65); for (let i = 0; i < 3; i++) { const a = i * TAU / 3; w.beam(g, v(Math.sin(a) * 0.18, 0.6, Math.cos(a) * 0.18), v(Math.sin(a) * 0.25, 0.02, Math.cos(a) * 0.25), 0.025, iron); } bake(g); return g;
}
export function jazzCourtyard(w: World) {
  backdrop(w, '#112e3c', '#32433d'); stars(w, 110);
  const band = w.side(0, -2.8), cafe = w.side(1, -2.8);
  deck(w, band, 7.8, 4.4, '#655c49'); deck(w, cafe, 7.8, 4.4, '#655c49');
  const wood = w.metal('#91664d', 0.1, 0.7), gold = w.metal('#d4ae62'), dark = w.metal('#29383f'), cream = w.metal('#e6d6b2', 0.1, 0.7);
  const stage = group(band, 0, 0.15, -0.3); deck(w, stage, 6.8, 3.2, '#9a7554');
  const sign = group(stage, 0, 3.65, -1.6); round(w, sign, [5.7, 1, 0.18], [0, 0, 0], dark); w.text(sign, 'SAVĒJIE • JAZZ', '#f2cb88', 5.1, 0.49).position.z = 0.1;
  for (const x of [-3.1, 3.1]) cylinder(w, stage, 0.05, 4.6, wood, x, 2.3, -1.4);
  // Drum kit with kick, toms, cymbals, throne and an articulated drummer.
  const drums = group(stage, 0, 0.3, -0.1), red = w.metal('#ab5b51', 0.5, 0.4);
  const kick = cylinder(w, drums, 0.58, 0.58, red, 0, 0.3, 0.2); kick.rotation.x = Math.PI / 2;
  const skin = cylinder(w, drums, 0.53, 0.02, cream, 0, 0.3, 0.51); skin.rotation.x = Math.PI / 2;
  w.text(drums, 'LB', '#656b61', 0.6, 0.28).position.set(0, 0.3, 0.53);
  for (const x of [-0.47, 0.47]) { cylinder(w, drums, 0.28, 0.34, red, x, 1.05, 0); cylinder(w, drums, 0.27, 0.03, cream, x, 1.23, 0); }
  for (const x of [-0.85, 0.94]) { cylinder(w, drums, 0.018, 1.62, dark, x, 0.7); const cymbal = w.mesh(new T.ConeGeometry(0.46, 0.07, 48), gold, drums, v(x, 1.54)); for (let j = 0; j < 3; j++) w.beam(drums, v(x, 0.25), v(x + Math.sin(j * TAU / 3) * 0.3, -0.13, Math.cos(j * TAU / 3) * 0.3), 0.017, dark); w.ticks.push(t => { cymbal.rotation.z = Math.sin(t * 10 + x) * 0.035; }); }
  const drummer = person(w, stage, '#5c8c91', 1.15); drummer.root.position.set(0, 0.43, -0.75); stool(w, stage, 0, -0.75);
  for (const [i, x] of [[1, -1], [3, 1]]) { const limb = drummer.limbs[i]; w.beam(limb, v(0, -0.26, 0), v(0, -0.8, 0), 0.016, cream); w.ticks.push(t => { limb.rotation.x = -1 + Math.sin(t * 7 + x) * 0.4; }); }
  const bassPlayer = person(w, stage, '#c4815c', 1.6); bassPlayer.root.position.set(-2.2, 0.1, 0.3); bassPlayer.limbs[1].rotation.x = -0.9; bassPlayer.limbs[3].rotation.x = -0.6;
  const bass = group(stage, -1.75, 1, 0.85); bass.rotation.z = -0.17;
  w.sphere(bass, 0.45, [0, 0, 0], wood).scale.set(0.8, 1.2, 0.24); w.sphere(bass, 0.3, [0, 0.47, 0], wood).scale.set(0.86, 1, 0.35); w.box(bass, [0.1, 1.8, 0.12], [0, 1.18, 0], dark);
  for (let i = 0; i < 4; i++) w.beam(bass, v(-0.035 + i * 0.023, -0.35, 0.13), v(-0.035 + i * 0.023, 2, 0.13), 0.004, gold);
  for (const x of [-0.17, 0.17]) w.tube(bass, [v(x, -0.08, 0.13), v(x * 0.6, 0.13, 0.14), v(x, 0.3, 0.12)], dark, 0.017);
  const saxPlayer = person(w, stage, '#b15a75', 1.6); saxPlayer.root.position.set(2.1, 0.1, 0.1); saxPlayer.limbs[1].rotation.x = -1; saxPlayer.limbs[3].rotation.x = -0.8;
  const sax = group(stage, 1.9, 1.15, 0.7); w.tube(sax, [v(0.12, 0.4), v(0, 0.3), v(0.1, -0.5), v(0.4, -0.55), v(0.48, -0.1)], gold, 0.085); w.mesh(new T.ConeGeometry(0.25, 0.35, 32, 1, true), gold, sax, v(0.48, 0.05));
  for (let i = 0; i < 6; i++) w.sphere(sax, 0.028, [0.12, 0.25 - i * 0.1, 0.09], cream);
  w.ticks.push(t => { bass.rotation.z = -0.17 + Math.sin(t * 1.5) * 0.035; saxPlayer.root.rotation.z = Math.sin(t * 1.5) * 0.025; sax.rotation.z = Math.sin(t * 1.5) * 0.025; });
  // Cafe terrace: espresso machine, stocked counter, cups and guests around small tables.
  const kiosk = group(cafe, 0, 0, -1); round(w, kiosk, [5.5, 1.2, 1.2], [0, 0.65, 0], w.metal('#496f67')); w.box(kiosk, [5.8, 0.12, 1.5], [0, 1.3, 0], wood);
  round(w, kiosk, [1.45, 0.77, 0.55], [-1.4, 1.76, 0], cream); for (const x of [-1.8, -1.1]) { cylinder(w, kiosk, 0.06, 0.23, gold, x, 1.52, 0.31); cylinder(w, kiosk, 0.09, 0.13, cream, x, 1.45, 0.3); }
  for (let i = 0; i < 8; i++) { cylinder(w, kiosk, 0.06, 0.33, w.glass(i % 2 ? '#b89668' : '#66af7c', 0.8), 0.6 + i * 0.2, 1.53, 0); }
  const host = person(w, cafe, '#dfa260', 1.25); host.root.position.set(0, 0.5, -1.5); host.limbs[1].rotation.x = -0.8;
  for (let i = 0; i < 3; i++) {
    const x = -2.2 + i * 2.2, table = group(cafe, x, 0, 0.9); cylinder(w, table, 0.56, 0.09, wood, 0, 0.93); cylinder(w, table, 0.045, 0.91, dark, 0, 0.45); cylinder(w, table, 0.3, 0.05, dark, 0, 0.04);
    for (const dx of [-0.22, 0.22]) { cylinder(w, table, 0.12, 0.02, cream, dx, 0.99); cylinder(w, table, 0.065, 0.12, cream, dx, 1.06); }
    const candle = cylinder(w, table, 0.045, 0.2, cream, 0, 1.08); w.sphere(candle, 0.028, [0, 0.14, 0], w.glow('#ffd184', 1.8));
    stool(w, cafe, x - 0.55, 1.25); const guest = person(w, cafe, ['#ba7482', '#779faf', '#b7a365'][i], 0.95); guest.root.position.set(x - 0.55, 0.4, 1.25); guest.root.rotation.y = 0.7; guest.limbs[0].rotation.x = -0.8; guest.limbs[2].rotation.x = -0.8; w.ticks.push(t => { guest.limbs[3].rotation.x = -0.5 + Math.sin(t * 0.8 + i) * 0.13; });
  }
  for (const p of [band, cafe]) {
    bunting(w, p, v(-3.6, 5, -1), v(3.6, 5, -1), 12);
    const cable = w.tube(p, [v(-3.6, 4.5, 0), v(0, 3.85, 0), v(3.6, 4.5, 0)], wood, 0.014);
    for (let i = 0; i < 7; i++) { const l = lantern(w, p, ['#f3b56f', '#d885a5', '#87bda0'][i % 3]); l.position.copy(cable.getPointAt((i + 0.5) / 7)).add(v(0, -0.35)); w.ticks.push(t => { l.rotation.z = Math.sin(t * 0.8 + i) * 0.07; }); }
    plant(w, p, -3.3, 0.03, 1.6, 1.3); plant(w, p, 3.2, 0.03, 1.5, 1.3, true);
  }
  // Click a performer for a short solo. Notes originate at that instrument, not from the page centre.
  const performers = [bassPlayer.root, drummer.root, saxPlayer.root];
  const notes = Array.from({ length: 18 }, (_, i) => {
    const root = group(stage), ink = w.glow(['#ffc16d', '#8de1d4', '#ef9aba'][i % 3], .7);
    w.sphere(root, .08, [0, 0, 0], ink).scale.set(1.2, .7, .3);
    w.beam(root, v(.06, 0, 0), v(.06, .3, 0), .015, ink);
    w.beam(root, v(.06, .3, 0), v(.17, .23, 0), .018, ink);
    return root;
  });
  const lamps = [-2.2, 0, 2.1].map(x => {
    const light = new T.PointLight('#ffd798', 0, 5, 2); light.position.set(x, 2.6, 1.8); stage.add(light); return light;
  });
  let solo = 0, until = 0;
  const projected = v();
  w.text(band, 'Клик по музыканту — соло', '#e8cf9d', 6, .3).position.set(0, -.65, 2);
  w.ticks.push((t, dt, pointer) => {
    if (pointer.clicked) {
      let nearest = Infinity;
      performers.forEach((person, i) => {
        person.getWorldPosition(projected); projected.y += 1; projected.project(w.camera);
        const d = Math.hypot((projected.x * .5 + .5) * w.c.width - pointer.x, (.5 - projected.y * .5) * w.c.height - pointer.y);
        if (d < nearest) { nearest = d; solo = i; }
      });
      if (nearest < Math.min(w.c.width, w.c.height) * .3) until = t + 7;
    }
    const lead = t < until ? solo : Math.floor(t / 9) % 3;
    const beat = Math.max(0, Math.sin(t * 7));
    lamps.forEach((light, i) => { light.intensity = (i === lead ? 5 : 1) * (.8 + .2 * beat); });
    notes.forEach((note, i) => {
      const u = (t * .4 + i / notes.length) % 1;
      note.visible = i % 3 === lead || i < 3;
      note.position.set([-1.75, 0, 2.35][i % 3] + Math.sin(u * 4 + i) * u * .45, 1.4 + u * 2.1, 1);
      note.rotation.z = Math.sin(t * 2 + i) * .2;
      note.scale.setScalar(Math.sin(u * Math.PI) * (.8 + .25 * beat));
    });
    if (lead === 0) bassPlayer.limbs[3].rotation.x = -.8 + Math.sin(t * 12) * .15;
    if (lead === 2) saxPlayer.limbs[3].rotation.x = -.8 + Math.sin(t * 8) * .1;
  });
}

function neonFacade(w: World, p: T.Object3D, width: number, height: number, color: string, index: number) {
  const g = group(p), stone = w.metal(color, 0.25, 0.7), iron = w.metal('#38505b'), frame = w.metal('#87959c'), light = w.glow(index % 2 ? '#edb66e' : '#77b9c5', 0.6);
  w.box(g, [width, height, 2], [0, height / 2, -0.7], stone);
  for (let row = 0; row < Math.floor(height / 0.85); row++) for (const x of [-width * 0.27, width * 0.27]) {
    const y = 0.5 + row * 0.85; w.box(g, [width * 0.29, 0.57, 0.05], [x, y, 0.34], light); w.box(g, [0.035, 0.57, 0.055], [x, y, 0.38], iron);
    if (row % 2 === index % 2) { w.box(g, [width * 0.43, 0.09, 0.5], [x, y - 0.35, 0.55], frame); for (let i = 0; i < 5; i++) w.box(g, [0.025, 0.35, 0.025], [x - width * 0.18 + i * width * 0.09, y - 0.18, 0.8], iron); w.box(g, [width * 0.43, 0.035, 0.035], [x, y, 0.8], iron); }
  }
  for (let y = 0.15; y < height; y += 0.85) w.box(g, [width + 0.08, 0.055, 2.1], [0, y, -0.7], iron);
  w.box(g, [width + 0.15, 0.17, 2.15], [0, height, -0.7], iron);
  const ac = group(g, width * 0.25, height + 0.3, -0.5); w.box(ac, [0.65, 0.45, 0.65], [0, 0, 0], frame); for (let i = 0; i < 6; i++) w.box(ac, [0.52, 0.02, 0.025], [0, -0.15 + i * 0.055, 0.34], iron);
  bake(g); return g;
}
function nightCar(w: World, p: T.Object3D, color: string) {
  const g = group(p), shell = w.metal(color, 0.65, 0.3), dark = w.metal('#1d303b');
  round(w, g, [1.4, 0.32, 0.62], [0, 0.28, 0], shell); round(w, g, [0.75, 0.3, 0.53], [-0.08, 0.54, 0], dark);
  for (const x of [-0.42, 0.42]) for (const z of [-0.32, 0.32]) { const wheel = cylinder(w, g, 0.15, 0.07, dark, x, 0.16, z); wheel.rotation.x = Math.PI / 2; }
  for (const z of [-0.23, 0.23]) { w.sphere(g, 0.04, [0.7, 0.32, z], w.glow('#d9ecdc', 1.4)); w.sphere(g, 0.035, [-0.71, 0.3, z], w.glow('#e2726d', 1)); }
  bake(g); return g;
}
export function rainyDistrict(w: World) {
  backdrop(w, '#081424', '#192b37'); w.exposure = 0.83;
  const left = w.side(0, -3.1), right = w.side(1, -3.1), steel = w.metal('#38525a'), gold = w.metal('#b49e71');
  for (const [side, p] of [left, right].entries()) {
    deck(w, p, 8.3, 5.1, '#304951');
    for (let i = 0; i < 3; i++) {
      const height = [5.5, 7.9, 6.2][(i + side) % 3]; const building = neonFacade(w, p, 2.25, height, ['#455060', '#364958', '#4d495f'][i], i + side); building.position.set(-2.65 + i * 2.65, 0, -0.7 - i % 2 * 0.8);
      const sign = group(building, (i % 2 ? -1 : 1) * 0.92, height - 1.7, 0.82); round(w, sign, [0.63, 2.35, 0.12], [0, 0, 0], steel);
      const word = ['RĪGA', 'KINO', 'HOTEL'][(i + side) % 3]; for (let k = 0; k < word.length; k++) w.text(sign, word[k], ['#ffa389', '#77e7d2', '#caa4ed'][i], 0.43, 0.4).position.set(0, 0.83 - k * 0.4, 0.08);
      const canopy = w.box(building, [2.18, 0.09, 0.9], [0, 1.28, 0.7], w.metal(i % 2 ? '#587d79' : '#835e68')); canopy.rotation.x = 0.15;
      w.text(building, ['KAFE', '24 H', 'RADIO'][i], '#f2c192', 1.7, 0.28).position.set(0, 0.95, 0.9);
    }
    // Tram viaduct, with visible beams and sleepers, runs in front of the facades.
    const viaduct = group(p, 0, 1.7, 1.25); w.box(viaduct, [8.1, 0.23, 1.25], [0, 0, 0], steel);
    for (const x of [-3, 0, 3]) { w.box(viaduct, [0.22, 1.7, 0.6], [x, -0.95, 0], steel); w.beam(viaduct, v(x, -1.4, 0), v(x + 0.55, -0.1, 0), 0.065, steel); }
    for (let i = 0; i < 32; i++) w.box(viaduct, [0.07, 0.06, 1], [-3.85 + i * 0.25, 0.15, 0], gold);
    for (const z of [-0.31, 0.31]) w.box(viaduct, [8, 0.05, 0.055], [0, 0.2, z], gold);
    const tram = group(viaduct); round(w, tram, [2.4, 0.65, 0.68], [0, 0.64, 0], w.metal(side ? '#b8c6ae' : '#ba8162')); for (let i = 0; i < 7; i++) for (const z of [-0.35, 0.35]) w.box(tram, [0.24, 0.28, 0.025], [-0.93 + i * 0.31, 0.75, z], w.glow('#b2d4b6', 0.45));
    w.ticks.push(t => { const x = Math.sin(t * 0.14 + side * 2) * 2.6; tram.position.x = x; });
    const street = group(p, 0, 0.02, 2.2); w.box(street, [8, 0.06, 1.1], [0, 0, 0], w.metal('#182d36', 0.6, 0.15));
    const car = nightCar(w, street, side ? '#766193' : '#518482'); w.ticks.push(t => { car.position.x = ((t * 0.62 + side * 3) % 7) - 3.5; });
    for (let i = 0; i < 5; i++) {
      const reflection = w.mesh(new T.PlaneGeometry(0.25, 0.8 + i % 3 * 0.15), new T.MeshBasicMaterial({ color: ['#cb8c6a', '#61959e', '#9e73b1'][i % 3], transparent: true, opacity: 0.18, depthWrite: false }), street, v(-3 + i * 1.4, 0.04, 0)); reflection.rotation.x = -Math.PI / 2;
      w.ticks.push(t => { reflection.scale.x = 0.7 + Math.sin(t * 2 + i) * 0.18; });
    }
    lamp(w, p, -3.8, 0, 2.7, 3.4); lamp(w, p, 3.5, 0, 2.7, 3.4);
    const pedestrian = person(w, p, '#a68b60', 0.65); const umbrella = group(pedestrian.root, 0, 1.55); w.mesh(new T.SphereGeometry(0.64, 32, 12, 0, TAU, 0, 1), w.metal(side ? '#718db6' : '#c17578', 0.2, 0.65), umbrella); cylinder(w, umbrella, 0.015, 0.9, gold, 0, -0.25);
    w.ticks.push(t => { pedestrian.root.position.set(Math.sin(t * 0.12 + side) * 3.1, 0.08, 3); pedestrian.walk(t); pedestrian.root.rotation.y = Math.cos(t * 0.12 + side) > 0 ? Math.PI / 2 : -Math.PI / 2; });
    railing(w, p, v(-3.8, 0.1, -2), v(3.8, 0.1, -2), '#49616b', 0.5);
  }
  const tower = group(right, 0, 6.8, -1.5); cylinder(w, tower, 0.69, 1.1, w.metal('#826a58'), 0, 0.6); w.mesh(new T.ConeGeometry(0.8, 0.45, 32), steel, tower, v(0, 1.38)); for (const x of [-0.45, 0.45]) for (const z of [-0.45, 0.45]) w.beam(tower, v(x, -0.6, z), v(x, 0.1, z), 0.04, steel);
  // Rain is line geometry rather than blurry particles, with independent pavement rings.
  const n = w.mobile ? 220 : 680, xyz = new Float32Array(n * 6); const seeds = Array.from({ length: n }, () => [w.c.rand() * 38 - 19, w.c.rand() * 18, w.c.rand() * 13 - 5]);
  const geom = new T.BufferGeometry(); geom.setAttribute('position', new T.BufferAttribute(xyz, 3)); w.root.add(new T.LineSegments(geom, new T.LineBasicMaterial({ color: '#81a7ba', transparent: true, opacity: 0.22 })));
  w.ticks.push(t => { for (let i = 0; i < n; i++) { const [x, y, z] = seeds[i], py = 11 - ((y + t * (4 + i % 3)) % 18); xyz.set([x, py, z, x - 0.04, py - 0.25, z], i * 6); } geom.attributes.position.needsUpdate = true; });
  for (let i = 0; i < 24; i++) { const p = i % 2 ? left : right; const ring = w.ring(p, 0.18, 0.007, w.glass('#91bdd0', 0.4), v(Math.sin(i * 6) * 3.5, 0.1, 2.2 + Math.cos(i) * 0.4)); ring.rotation.x = Math.PI / 2; w.ticks.push(t => { const u = (t * 0.7 + i / 24) % 1; ring.scale.setScalar(u * 2); (ring.material as T.MeshPhysicalMaterial).opacity = (1 - u) * 0.3; }); }
}
