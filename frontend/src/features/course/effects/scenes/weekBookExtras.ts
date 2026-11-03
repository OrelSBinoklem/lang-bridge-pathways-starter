import { T, TAU, v, type World } from './cinematic/world';
import { group, person, round } from './cinematic/storyKit';

/**
 * The week book's days made different from each other, richer and more colourful (owner, 2026-10-30: «книгу
 * разнообразней сделай дни, побольше деталей и красочней»). Each day gets:
 *
 * - a painted ground on the right page in the day's colours (old-town cobbles, a running track, wet asphalt with
 *   puddles, market tiles, warm cobbles in lamplight, a museum parquet, a lawn with flowers);
 * - its own weather and life, moving once the page has stood up:
 *   Monday a red-and-cream Riga tram crossing the page and pigeons pecking; Tuesday a basketball hoop with a bouncing
 *   ball and confetti of the gym's flags; Wednesday rain — streaks, rings in the puddles, an umbrella; Thursday bunting
 *   over the market, balloons bobbing, flower buckets; Friday strings of warm lights and a street musician; Saturday
 *   falling autumn leaves and a painter at an easel; Sunday a kite on a string, butterflies, ducks on a pond.
 *
 * Built with the same pop-up hinge (\`pop\`) as the rest of the page, so it folds and unfolds with it.
 */
type Pop = (x: number, z: number, build: (root: T.Group) => void, flatten?: boolean, layer?: number) => T.Group;
export type DayExtras = (time: number, dt: number, shown: boolean) => void;

const PAGE_W = 5.15, PAGE_D = 6.5;

function groundTexture(w: World, day: number) {
  const cv = document.createElement('canvas'); cv.width = 768; cv.height = 1024;
  const g = cv.getContext('2d')!, r = w.c.rand;
  // A soft watercolour wash over the lower two thirds of the page, edges fading.
  const wash = (color: string, x: number, y: number, rr: number, a: number) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, color + Math.round(a * 255).toString(16).padStart(2, '0')); gr.addColorStop(1, color + '00');
    g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  };
  const base = ['#c9a27a', '#d9765a', '#6f8796', '#e4b24e', '#7a5a9a', '#b98a5a', '#7fbf6a'][day];
  for (let k = 0; k < 12; k++) wash(base, 100 + r() * 570, 400 + r() * 560, 220 + r() * 180, .3 + r() * .16);
  // A second, lighter hue for depth, and a few bright spots of colour.
  const accent = ['#7fb7d9', '#f2c84b', '#9b8fb7', '#e2452f', '#ffcf7a', '#e27a3a', '#ffd84a'][day];
  for (let k = 0; k < 5; k++) wash(accent, 100 + r() * 570, 420 + r() * 540, 120 + r() * 120, .22);
  g.lineWidth = 2;
  if (day === 0 || day === 4) {
    // Cobbles, darker under the evening.
    for (let y = 470; y < 980; y += 26) for (let x = (y / 26) % 2 ? 40 : 53; x < 730; x += 26) {
      g.fillStyle = day === 4 ? `rgba(90,70,110,${(.3 + r() * .18).toFixed(2)})` : `rgba(150,105,70,${(.26 + r() * .16).toFixed(2)})`;
      g.beginPath(); g.roundRect(x, y, 22, 22, 6); g.fill();
    }
    if (day === 4) for (const [x, y] of [[200, 700], [520, 640], [380, 880]]) wash('#ffd27a', x, y, 160, .35);
  } else if (day === 1) {
    for (let k = 0; k < 5; k++) { g.strokeStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(384, 760, 330 - k * 46, 210 - k * 30, 0, 0, TAU); g.stroke(); }
    g.fillStyle = 'rgba(217,118,90,.35)'; g.beginPath(); g.ellipse(384, 760, 330, 210, 0, 0, TAU); g.fill();
  } else if (day === 2) {
    g.fillStyle = 'rgba(70,90,105,.28)'; g.fillRect(40, 450, 690, 540);
    for (const [x, y, a, b] of [[230, 640, 120, 45], [520, 820, 150, 55], [400, 520, 90, 30]]) { g.fillStyle = 'rgba(170,200,230,.55)'; g.beginPath(); g.ellipse(x, y, a, b, 0, 0, TAU); g.fill(); }
  } else if (day === 3) {
    for (let y = 470; y < 980; y += 48) for (let x = 40; x < 730; x += 48) { g.fillStyle = ((x + y) / 48) % 2 ? 'rgba(228,178,78,.22)' : 'rgba(200,90,70,.16)'; g.fillRect(x, y, 46, 46); }
  } else if (day === 5) {
    for (let y = 460; y < 990; y += 22) for (let x = 40; x < 730; x += 90) { g.fillStyle = `rgba(150,100,60,${(.16 + ((x + y) % 3) * .05).toFixed(2)})`; g.fillRect(x + ((y / 22) % 2) * 45, y, 86, 20); }
  } else {
    for (let k = 0; k < 900; k++) { const x = 40 + r() * 690, y = 450 + r() * 540; g.strokeStyle = `rgba(80,${(140 + r() * 60) | 0},70,.45)`; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 6, y - 8 - r() * 8); g.stroke(); }
    for (let k = 0; k < 70; k++) { g.fillStyle = ['#ffd84a', '#ff8ab0', '#ffffff', '#b48cff'][k % 4]; g.beginPath(); g.arc(40 + r() * 690, 450 + r() * 540, 5, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(110,170,220,.6)'; g.beginPath(); g.ellipse(560, 850, 140, 70, 0, 0, TAU); g.fill();
  }
  const tex = w.ownTexture(new T.CanvasTexture(cv)); tex.colorSpace = T.SRGBColorSpace; return tex;
}

export function weekBookExtras(w: World, sheet: T.Group, pop: Pop, day: number): DayExtras {
  const r = w.c.rand;
  // The painted ground, printed on the page (a decal just above the paper, under the pop-ups).
  // (Bent like the page itself, just above it.)
  const decal = new T.PlaneGeometry(PAGE_W, PAGE_D, 28, 20), dp = decal.getAttribute('position');
  for (let i = 0; i < dp.count; i++) dp.setZ(i, .025 * Math.sin((dp.getX(i) / PAGE_W + .5) * Math.PI) + .006);
  decal.rotateX(-Math.PI / 2); decal.translate(PAGE_W / 2, .012, 0);
  const ground = w.mesh(decal, new T.MeshStandardMaterial({ map: groundTexture(w, day), transparent: true, roughness: .9, depthWrite: false }), sheet);
  ground.castShadow = false;
  const mat = (c: string, rough = .6) => w.metal(c, .05, rough);
  const ticks: ((t: number, dt: number) => void)[] = [];
  // Things moving freely over the page (rain, leaves, butterflies): shown only while this day is open.
  const free = group(sheet);
  if (day === 0) {
    // A Riga tram crossing the front of the page, and pigeons.
    const tram = pop(PAGE_W / 2, 2.55, p => {
      const body = group(p); body.name = 'tram';
      round(w, body, [1.7, .5, .42], [0, .32, 0], mat('#c8322d'), .08);
      round(w, body, [1.72, .18, .44], [0, .62, 0], mat('#f1e3c4'), .06);
      for (let k = 0; k < 5; k++) w.box(body, [.22, .16, .45], [-.6 + k * .3, .45, 0], w.glow('#ffe7a8', .4));
      w.beam(body, v(0, .72, 0), v(.25, 1.05, 0), .012, mat('#333'));
      for (const x of [-.55, .55]) for (const z of [-.18, .18]) { const wh = w.mesh(new T.CylinderGeometry(.09, .09, .05, 14), mat('#222'), body, v(x, .08, z)); wh.rotation.x = Math.PI / 2; }
    }, false, 2);
    const body = tram.getObjectByName('tram')!;
    const pigeons = Array.from({ length: 4 }, (_, i) => pop(.9 + i * .9, 1.9 + (i % 2) * .3, p => {
      w.sphere(p, .07, [0, .08, 0], mat('#8a8f9a')).scale.set(1.4, 1, 1); w.sphere(p, .045, [.09, .14, 0], mat('#5f6470'));
    }, false, 3));
    ticks.push(t => { body.position.x = Math.sin(t * .35) * 1.6; pigeons.forEach((g, i) => { g.rotation.z = Math.max(0, Math.sin(t * 3 + i)) * .5; }); });
  } else if (day === 1) {
    // A basketball hoop and a bouncing ball; pennants.
    pop(4.5, -.3, p => {
      w.beam(p, v(0, 0, 0), v(0, 1.9, 0), .03, mat('#555'));
      w.box(p, [.6, .42, .03], [-.05, 1.95, .1], mat('#f4f4f4'));
      const rim = w.ring(p, .12, .012, mat('#e2552c'), v(-.05, 1.78, .25)); rim.rotation.x = Math.PI / 2;
    }, true, 2);
    const ball = pop(4.4, .5, p => { w.sphere(p, .1, [0, .1, 0], mat('#e27a2c', .8)); }, false, 3);
    pop(PAGE_W / 2, -1.9, p => {
      for (let k = 0; k < 12; k++) { const f = w.mesh(new T.ConeGeometry(.08, .2, 3), mat(['#d9765a', '#f2c84b', '#4aa3c8'][k % 3]), p, v(-2 + k * .36, 2.1, 0)); f.rotation.z = Math.PI; }
      w.beam(p, v(-2.1, 2.2, 0), v(2.1, 2.2, 0), .008, mat('#444'));
    }, true, 1);
    const b = ball.children[0];
    ticks.push(t => { const u = (t * 1.3) % 1; b.position.set(-.3 * u, .1 + Math.abs(Math.sin(u * Math.PI)) * 1.3, -.45 * u); });
  } else if (day === 2) {
    // Rain: streaks over the page, rings spreading in the puddles, an umbrella.
    const N = 260, drops = new T.InstancedMesh(new T.BoxGeometry(.012, .28, .012), new T.MeshBasicMaterial({ color: '#7fb0d8', transparent: true, opacity: .8 }), N);
    drops.castShadow = false; free.add(drops);
    const seeds = Array.from({ length: N }, () => [.1 + r() * (PAGE_W - .2), (r() - .5) * (PAGE_D - .4), r() * 3.5]);
    const rings = [[1.55, .3], [3.5, 1.65], [2.6, -.65]].map(([x, z]) => { const ring = w.ring(free, .15, .008, mat('#e6f1fa'), v(x, .05, z)); ring.rotation.x = Math.PI / 2; ring.castShadow = false; return ring; });
    pop(1.3, 1.6, p => {
      const um = w.mesh(new T.SphereGeometry(.42, 18, 10, 0, TAU, 0, Math.PI / 2.4), mat('#e2457a'), p, v(0, 1.25, 0)); um.castShadow = true;
      w.beam(p, v(0, 0, 0), v(0, 1.3, 0), .015, mat('#333'));
    }, true, 3);
    const d = new T.Object3D();
    ticks.push((t) => {
      seeds.forEach((s, i) => { const y = 3.5 - ((t * 4 + s[2]) % 3.5); d.position.set(s[0], y, s[1]); d.updateMatrix(); drops.setMatrixAt(i, d.matrix); });
      drops.instanceMatrix.needsUpdate = true;
      rings.forEach((ring, i) => { const u = (t * .8 + i * .37) % 1; ring.scale.setScalar(.4 + u * 2.2); (ring.material as T.MeshStandardMaterial).opacity = 1 - u; (ring.material as T.MeshStandardMaterial).transparent = true; });
    });
  } else if (day === 3) {
    // Bunting over the market, balloons, flower buckets.
    pop(PAGE_W / 2, -1.7, p => {
      for (const x of [-2.3, 2.3]) w.beam(p, v(x, 0, 0), v(x, 2.6, 0), .03, mat('#7a5a3a'));
      const cols = ['#e2452f', '#f2c84b', '#3aa36a', '#3a7ac8', '#e27ab0'];
      for (let k = 0; k < 18; k++) { const x = -2.2 + k * .26, y = 2.5 - Math.sin(k / 17 * Math.PI) * .35; const f = w.mesh(new T.ConeGeometry(.1, .24, 3), mat(cols[k % 5]), p, v(x, y - .12, 0)); f.rotation.z = Math.PI; }
    }, true, 1);
    const balloons = [0, 1, 2].map(i => pop(.9 + i * .35, 1.3, p => {
      w.sphere(p, .2, [0, 1.6, 0], mat(['#e2452f', '#3a7ac8', '#f2c84b'][i], .3)).scale.y = 1.15;
      w.beam(p, v(0, 1.38, 0), v(0, .2, 0), .004, mat('#eee'));
    }, false, 3));
    pop(4.3, 1.4, p => {
      for (let k = 0; k < 3; k++) {
        w.mesh(new T.CylinderGeometry(.14, .11, .25, 14), mat('#6a7f8a'), p, v(k * .35 - .35, .12, 0));
        for (let j = 0; j < 6; j++) w.sphere(p, .06, [k * .35 - .35 + Math.sin(j) * .08, .32 + (j % 3) * .05, Math.cos(j) * .08], mat(['#ff6a8a', '#ffd84a', '#ffffff'][k]));
      }
    }, true, 2);
    ticks.push(t => balloons.forEach((b, i) => { b.children[0].position.y = 1.6 + Math.sin(t * 1.4 + i) * .08; b.rotation.z = Math.sin(t * .9 + i) * .06; }));
  } else if (day === 4) {
    // Strings of warm lights and a street musician.
    const bulbMat = w.glow('#ffcf7a', 2.4);
    pop(PAGE_W / 2, -1.5, p => {
      for (const x of [-2.3, 2.3]) w.beam(p, v(x, 0, 0), v(x, 2.4, 0), .025, mat('#333'));
      for (let k = 0; k <= 16; k++) { const x = -2.25 + k * .28, y = 2.3 - Math.sin(k / 16 * Math.PI) * .45; const b = w.sphere(p, .045, [x, y, 0], bulbMat); b.castShadow = false; }
    }, true, 1);
    const musician = pop(4.1, .7, p => {
      const m = person(w, p, '#3a6a8a', .85);
      const guitar = group(m.root, .05, .62, .18); guitar.rotation.z = 1.1;
      w.sphere(guitar, .13, [0, 0, 0], mat('#b06a2c')).scale.set(1, 1.1, .4);
      w.box(guitar, [.04, .45, .03], [0, .3, 0], mat('#3a2410'));
    }, false, 3);
    ticks.push(t => { bulbMat.emissiveIntensity = 2.1 + Math.sin(t * 2.2) * .4; musician.rotation.z = Math.sin(t * 3.2) * .04; });
  } else if (day === 5) {
    // Falling autumn leaves and a painter at an easel.
    pop(4.2, .6, p => {
      for (const [x, z] of [[-.25, .15], [.25, .15], [0, -.25]]) w.beam(p, v(x * .3, 1.3, 0), v(x, 0, z), .018, mat('#7a5a3a'));
      w.box(p, [.62, .48, .03], [0, 1.05, .05], mat('#f6efe0'));
      for (let k = 0; k < 5; k++) w.box(p, [.12 + r() * .2, .08 + r() * .12, .01], [-.2 + r() * .4, .9 + r() * .3, .07], mat(['#e2452f', '#f2c84b', '#3a7ac8', '#3aa36a', '#e27ab0'][k]));
    }, true, 2);
    pop(3.55, 1.2, p => { person(w, p, '#8a3a5a', .85); }, false, 3);
    const leaves = Array.from({ length: 26 }, () => {
      const m = w.mesh(new T.PlaneGeometry(.12, .08), new T.MeshStandardMaterial({ color: ['#e2702c', '#d9a12c', '#b0402a'][Math.floor(r() * 3)], side: T.DoubleSide }), free);
      m.castShadow = false; m.userData = { x: r() * PAGE_W, z: (r() - .5) * PAGE_D * .8, s: r() * 10, sp: .25 + r() * .3 }; return m;
    });
    ticks.push(t => leaves.forEach(m => { const u = m.userData as { x: number; z: number; s: number; sp: number }; const y = 3.2 - ((t * u.sp + u.s) % 3.2); m.position.set(u.x + Math.sin(t + u.s) * .3, Math.max(.06, y), u.z); m.rotation.set(t * 2 + u.s, t + u.s, t * 1.3); }));
  } else {
    // A kite, butterflies, ducks on the pond.
    const kite = pop(2.1, .9, p => {
      const k = group(p, .5, 3.1, -.3); k.name = 'kite';
      const shape = new T.Shape(); shape.moveTo(0, .3); shape.lineTo(.2, 0); shape.lineTo(0, -.35); shape.lineTo(-.2, 0); shape.closePath();
      w.mesh(new T.ShapeGeometry(shape), new T.MeshStandardMaterial({ color: '#e2452f', side: T.DoubleSide }), k);
      for (let j = 0; j < 4; j++) { const bow = w.mesh(new T.ConeGeometry(.04, .08, 3), mat(['#f2c84b', '#3a7ac8'][j % 2]), k, v(0, -.45 - j * .15, 0)); bow.rotation.z = Math.PI / 2; }
      w.beam(p, v(0, .5, 0), v(.5, 2.8, -.3), .004, mat('#eee'));
    }, false, 3);
    const kiteBody = kite.getObjectByName('kite')!;
    const butterflies = Array.from({ length: 4 }, (_, i) => {
      const b = group(free, 0, 0, 0);
      const wingMat = new T.MeshStandardMaterial({ color: ['#ffb84a', '#b48cff', '#ff8ab0', '#4ac8e2'][i], side: T.DoubleSide });
      const wl = w.mesh(new T.CircleGeometry(.07, 10), wingMat, b, v(-.05, 0, 0)), wr = w.mesh(new T.CircleGeometry(.07, 10), wingMat, b, v(.05, 0, 0));
      return { b, wl, wr, i };
    });
    const ducks = [0, 1].map(i => pop(4.1, 1.7, p => {
      w.sphere(p, .1, [0, .08, 0], mat(i ? '#f2f0e6' : '#6a5a3a')).scale.set(1.5, .8, 1); w.sphere(p, .06, [.12, .18, 0], mat(i ? '#f2f0e6' : '#2f6a3a'));
      w.mesh(new T.ConeGeometry(.025, .07, 6), mat('#f2a02c'), p, v(.19, .17, 0)).rotation.z = -Math.PI / 2;
    }, false, 3));
    ticks.push(t => {
      kiteBody.position.set(.5 + Math.sin(t * .7) * .25, 3.1 + Math.sin(t * 1.1) * .15, -.3); kiteBody.rotation.z = Math.sin(t * 1.3) * .25;
      butterflies.forEach(({ b, wl, wr, i }) => {
        b.position.set(1.5 + i * .8 + Math.sin(t * .6 + i) * .4, .8 + Math.sin(t * 1.7 + i * 2) * .25, .6 + Math.cos(t * .5 + i) * .5);
        wl.rotation.y = Math.sin(t * 18 + i) * .9; wr.rotation.y = -wl.rotation.y;
      });
      ducks.forEach((d, i) => { d.position.x = 4.1 + Math.sin(t * .4 + i * 2) * .35 - .5 + i * .2; d.position.z = 1.75 + Math.cos(t * .4 + i * 2) * .18; d.rotation.y = -(t * .4 + i * 2); });
    });
  }
  free.visible = false;
  return (time, dt, shown) => { free.visible = shown; if (shown) for (const tick of ticks) tick(time, dt); };
}
