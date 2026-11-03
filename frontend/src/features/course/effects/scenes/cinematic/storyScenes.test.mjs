import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import * as THREE from 'three';

// Exercise the real builders without a browser, GPU, a DOM shim, or generated files.
// TypeScript is already a project dependency. Absolute module URLs preserve one Three.js instance.
const modules = new Map();
async function moduleUrl(name) {
  if (modules.has(name)) return modules.get(name);
  const source = await readFile(new URL(name + '.ts', import.meta.url), 'utf8');
  let js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const imports = [...js.matchAll(/from ['"]([^'"]+)['"]/g)];
  for (const item of imports) {
    const spec = item[1];
    const url = spec.startsWith('.') ? await moduleUrl(spec) : import.meta.resolve(spec);
    js = js.replace(item[0], `from ${JSON.stringify(url)}`);
  }
  const url = 'data:text/javascript;base64,' + Buffer.from(js).toString('base64');
  modules.set(name, url); return url;
}
const { World } = await import(await moduleUrl('./world'));
const { bake } = await import(await moduleUrl('./storyKit'));
const builders = Object.assign({}, ...await Promise.all(['./storiesTravel', './storiesHome', './storiesTime', './storiesMachines', './storiesNight'].map(async file => import(await moduleUrl(file)))));
const { cloudCarnival } = await import(await moduleUrl('./carnivalDetailed'));
const { carnivalPartyV1, carnivalVideoBackdrop } = await import(await moduleUrl('./carnivalPartyV1'));
const { setCarnivalLoop } = await import(await moduleUrl('./carnivalLoop'));
const { optimizeCarnival, instanceCarnival } = await import(await moduleUrl('./carnivalOptimizations'));
const { profileCarnival } = await import(await moduleUrl('./carnivalProfile'));
const { secondChance, familySupper } = await import(await moduleUrl('./storiesGathering'));
const { transitMachine } = await import(await moduleUrl('./storiesTransitMachine'));
const { pizzaExpress, certificateBureau } = await import(await moduleUrl('./storiesDelivery'));
const { neonMarket } = await import(await moduleUrl('./storiesNeon'));
const { faceAtelier, politeMask } = await import(await moduleUrl('./storiesPersona'));
const { timeSwitchyard } = await import(await moduleUrl('./storiesTimeRouter'));

function fixture(mobile) {
  let seed = 91;
  const w = Object.create(World.prototype);
  Object.assign(w, {
    scene: new THREE.Scene(), root: new THREE.Group(), stage: new THREE.Group(), ticks: [], anchors: [],
    pulse: 0, pointer: new THREE.Vector3(), mobile, cameraBase: mobile ? 28 : 21, cameraMotion: 1, sidePadding: 4.4, mobileSidePadding: 3.5,
    eye: new THREE.Vector3(0, 2, mobile ? 28 : 21), target: new THREE.Vector3(),
    camera: new THREE.PerspectiveCamera(46, mobile ? 390 / 844 : 16 / 9, 0.1, 140),
    c: { width: mobile ? 390 : 1280, height: mobile ? 844 : 720, rand: () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296), params: { react: 0, cinemaCamera: 0, cinemaEvents: 1, zoom: 1 } },
  });
  w.scene.add(w.root, w.stage);
  w.text = (parent, text, color, width = 2.4, height = 0.55) => {
    const mesh = w.mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ color, transparent: true }), parent);
    mesh.userData.text = text; return mesh;
  };
  return w;
}

test('saved original carnival does not gain balloons or speaker cabinets', () => {
  const w = fixture(false);
  try {
    const { left, right } = cloudCarnival(w);
    assert.ok(left.children.length > 0 && right.children.length > 0);
    assert.equal(w.scene.getObjectByName('carnival-speaker'), undefined);
    assert.equal(w.scene.getObjectByName('carnival-balloons'), undefined);
  } finally { dispose(w); }
});

test('baked park is balloon-free and every mechanical transform closes a sixty-second loop', () => {
  const w = fixture(false);
  try {
    setCarnivalLoop(w, 60); carnivalVideoBackdrop(w); optimizeCarnival(w.root);
    assert.equal(w.scene.getObjectByName('carnival-balloons'), undefined);
    assert.equal(w.scene.getObjectsByProperty('name', 'carnival-speaker').length, 2);
    const p = { x: 0, y: 0, clicked: false };
    const snapshot = t => {
      w.update(0, t, p); w.scene.updateMatrixWorld(true);
      const result = [];
      w.scene.traverse(object => {
        result.push(...object.matrixWorld.elements, object.visible ? 1 : 0);
        if (object.isMesh && object.geometry.attributes.position) for (const value of object.geometry.attributes.position.array) result.push(value);
      });
      return result;
    };
    const first = snapshot(0), last = snapshot(60);
    assert.equal(first.length, last.length);
    let maximum = 0; for (let i = 0; i < first.length; i++) maximum = Math.max(maximum, Math.abs(first[i] - last[i]));
    assert.ok(maximum < 1e-5, `loop seam: ${maximum}`);
  } finally { dispose(w); }
});

for (const optimized of [false, true]) test(`carousel planes move nose-first around the whole orbit: ${optimized ? 'instanced' : 'original'}`, () => {
  const w = fixture(false);
  try {
    carnivalPartyV1(w);
    if (optimized) { optimizeCarnival(w.root); instanceCarnival(w.root, w.ticks); }
    const planes = [];
    w.root.traverse(object => { if (object.userData.carnivalPlane) planes.push(object); });
    assert.equal(planes.length, 10);
    const pointer = { x: 0, y: 0, clicked: false };
    for (const time of [0, .5, 4, 8, 16, 24, 40]) {
      w.update(0, time, pointer); w.root.updateMatrixWorld(true);
      const positions = planes.map(plane => plane.getWorldPosition(new THREE.Vector3()));
      w.update(0, time + .001, pointer); w.root.updateMatrixWorld(true);
      planes.forEach((plane, index) => {
        const movement = plane.getWorldPosition(new THREE.Vector3()).sub(positions[index]).normalize();
        const nose = new THREE.Vector3(1, 0, 0).transformDirection(plane.matrixWorld);
        assert.ok(nose.dot(movement) > .95, `plane ${index} moves tail-first at ${time}`);
      });
    }
  } finally { dispose(w); }
});

for (const mobile of [false, true]) test(`carnival party: ${mobile ? 'portrait' : 'desktop'} motion, pop/regrowth and bounded resources`, () => {
  const w = fixture(mobile);
  try {
    carnivalPartyV1(w);
    const objects = [], geometry = new Set(); w.scene.traverse(o => { objects.push(o); if (o.geometry) geometry.add(o.geometry); });
    assert.equal(objects.filter(o => o.name === 'carnival-speaker').length, 2);
    assert.equal(objects.filter(o => o.name === 'carnival-balloons').length, 2);
    const balloons = objects.filter(o => o.name === 'carnival-balloon-latex');
    assert.equal(balloons.length, 14);
    const woofer = w.scene.getObjectByName('carnival-woofer');
    w.update(1 / 60, 0, { x: 0, y: 0, clicked: false }); const peak = woofer.position.z;
    w.update(1 / 60, 0.22, { x: 0, y: 0, clicked: false }); assert.notEqual(woofer.position.z, peak);
    // Hit an actual 3D shell using its camera projection (same path as a real pointer).
    w.c.params.react = 1;
    for (let i = 0; i < 60; i++) w.update(1 / 60, i / 60, { x: w.c.width / 2, y: w.c.height / 2, clicked: false });
    w.scene.updateMatrixWorld(true); w.camera.updateMatrixWorld(true);
    for (const balloon of balloons) {
      const box = new THREE.Box3().setFromObject(balloon);
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const point = new THREE.Vector3(x, y, z).project(w.camera);
        assert.ok(Math.abs(point.x) < 1, 'balloons must fit the viewport at default zoom');
      }
    }
    const top = balloons[5], projected = top.getWorldPosition(new THREE.Vector3()).project(w.camera);
    w.update(0, 1, { x: w.c.width / 2, y: w.c.height / 2, rawX: (projected.x + 1) * w.c.width / 2, rawY: (1 - projected.y) * w.c.height / 2, active: true, clicked: true });
    assert.equal(top.parent.visible, false, 'a targeted balloon should pop');
    assert.equal(objects.filter(o => o.name === 'carnival-confetti' && o.count > 0).length, 1);
    for (let i = 1; i <= 240; i++) w.update(1 / 60, 1 + i / 60, { x: 0, y: 0, clicked: false });
    assert.equal(top.parent.visible, true); assert.equal(top.parent.scale.x, 1);
    assert.equal(objects.filter(o => o.name === 'carnival-confetti' && o.count > 0).length, 0);
    // Resume from backgrounding and test long-running phases without allocating geometry.
    for (const t of [8, 24, 120, 10000]) {
      w.update(100, t, { x: 0, y: 0, clicked: false }); w.scene.updateMatrixWorld(true);
      w.scene.traverse(o => {
        assert.ok(o.matrixWorld.elements.every(Number.isFinite));
        if (o.geometry) { assert.ok(geometry.has(o.geometry)); assert.ok(o.geometry.getAttribute('position').array.every(Number.isFinite)); }
      });
    }
    const after = []; w.scene.traverse(o => after.push(o)); assert.equal(after.length, objects.length);
  } finally { dispose(w); }
});
function dispose(w) {
  const geometries = new Set(), materials = new Set();
  w.scene.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m)); if (o instanceof THREE.InstancedMesh) o.dispose(); });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); w.ticks.length = 0; w.scene.clear();
}

function carnivalMetrics(w) {
  w.scene.updateMatrixWorld(true);
  let draws = 0, triangles = 0, vertices = 0, transformUpdates = 0;
  const materials = new Set(), sum = [0, 0, 0], square = [0, 0, 0];
  const point = new THREE.Vector3();
  w.root.traverseVisible(object => {
    if (object.matrixAutoUpdate) transformUpdates++;
    if (!(object instanceof THREE.Mesh)) return;
    draws++; materials.add(object.material);
    const geometry = object.geometry, attribute = geometry.getAttribute('position');
    triangles += (geometry.index?.count ?? attribute.count) / 3 * (object instanceof THREE.InstancedMesh ? object.count : 1);
    if (object instanceof THREE.InstancedMesh && !object.userData.carnivalLinked) return;
    const instances = object instanceof THREE.InstancedMesh ? object.count : 1;
    const matrix = new THREE.Matrix4();
    for (let instance = 0; instance < instances; instance++) {
      if (object instanceof THREE.InstancedMesh) { object.getMatrixAt(instance, matrix); matrix.premultiply(object.matrixWorld); }
      else matrix.copy(object.matrixWorld);
      vertices += attribute.count;
      for (let i = 0; i < attribute.count; i++) {
        point.fromBufferAttribute(attribute, i).applyMatrix4(matrix);
        for (const [axis, value] of point.toArray().entries()) { sum[axis] += value; square[axis] += value * value; }
      }
    }
  });
  return { draws, triangles, vertices, transformUpdates, materials: materials.size, sum, square };
}

for (const mobile of [false, true]) test(`optimized carnival keeps geometry and animation: ${mobile ? 'portrait' : 'desktop'}`, t => {
  const original = fixture(mobile), optimized = fixture(mobile);
  try {
    carnivalPartyV1(original); carnivalPartyV1(optimized);
    const before = carnivalMetrics(optimized);
    optimizeCarnival(optimized.root);
    const after = carnivalMetrics(optimized);
    t.diagnostic(`draw objects ${before.draws} → ${after.draws}; materials ${before.materials} → ${after.materials}; transform updates ${before.transformUpdates} → ${after.transformUpdates}; triangles ${after.triangles}`);
    assert.ok(after.draws < before.draws * .6, 'reduce draw objects by at least 40%');
    assert.ok(after.materials < before.materials * .65);
    assert.ok(after.transformUpdates < before.transformUpdates * .3);
    const compare = () => {
      const a = carnivalMetrics(original), b = carnivalMetrics(optimized);
      assert.equal(a.triangles, b.triangles, 'do not remove any geometric detail');
      assert.equal(a.vertices, b.vertices);
      for (const key of ['sum', 'square']) for (let axis = 0; axis < 3; axis++) {
        assert.ok(Math.abs(a[key][axis] - b[key][axis]) < Math.max(1, Math.abs(a[key][axis])) * 1e-5, `${key}[${axis}] changed`);
      }
    };
    compare();
    for (const time of [0, .22, 1, 8, 24, 120, 10000]) {
      for (const world of [original, optimized]) world.update(1 / 60, time, { x: 0, y: 0, clicked: false });
      compare();
    }
    optimized.c.params.react = 1;
    const balloons = []; optimized.scene.traverse(o => { if (o.name === 'carnival-balloon-latex') balloons.push(o); });
    assert.equal(balloons.length, 14);
    clickObject(optimized, balloons[5], 10001);
    assert.equal(balloons[5].parent.visible, false, 'raycast identity survives batching');
    for (let i = 0; i < 240; i++) optimized.update(1 / 60, 10001 + i / 60, { x: 0, y: 0, clicked: false });
    assert.equal(balloons[5].parent.visible, true, 'regrowth survives batching');
  } finally { dispose(original); dispose(optimized); }
});

for (const mobile of [false, true]) test(`linked carnival instances preserve moving geometry and clicks: ${mobile ? 'portrait' : 'desktop'}`, t => {
  const original = fixture(mobile), linked = fixture(mobile);
  try {
    for (const w of [original, linked]) { carnivalPartyV1(w); optimizeCarnival(w.root); }
    const before = carnivalMetrics(linked);
    const batches = instanceCarnival(linked.root, linked.ticks);
    const after = carnivalMetrics(linked);
    t.diagnostic(`linked batches ${batches}; visible draw objects ${before.draws} → ${after.draws}; triangles ${after.triangles}`);
    assert.ok(after.draws < before.draws * .85, 'reduce both colour and shadow draw submissions');
    const geometry = new Set(); linked.root.traverse(o => { if (o.geometry) geometry.add(o.geometry); });
    for (const time of [0, .22, 1, 8, 24, 120, 10000]) {
      for (const w of [original, linked]) w.update(1 / 60, time, { x: 0, y: 0, clicked: false });
      const a = carnivalMetrics(original), b = carnivalMetrics(linked);
      assert.equal(a.triangles, b.triangles); assert.equal(a.vertices, b.vertices);
      for (const key of ['sum', 'square']) for (let axis = 0; axis < 3; axis++) {
        // Instance matrices use float32, while the reference CPU world matrix is double precision.
        // Signed sums can cancel around zero; account for per-vertex roundoff, not just the sum's magnitude.
        const tolerance = Math.max(1, Math.abs(a[key][axis])) * 1e-5 + (key === 'sum' ? a.vertices * 1e-6 : 0);
        assert.ok(Math.abs(a[key][axis] - b[key][axis]) < tolerance, `animated ${key}[${axis}] changed at ${time}: ${a[key][axis]} vs ${b[key][axis]}`);
      }
      linked.root.traverse(o => { if (o.geometry) assert.ok(geometry.has(o.geometry)); });
    }
    linked.c.params.react = 1;
    const balloon = linked.scene.getObjectByName('carnival-balloon-latex');
    clickObject(linked, balloon, 10001); assert.equal(balloon.parent.visible, false);
    const checkKnot = hidden => {
      let checked = 0;
      balloon.parent.traverse(o => {
        const entry = o.userData.carnivalInstance;
        if (!entry) return;
        checked++;
        const batch = linked.scene.getObjectByProperty('uuid', entry.batch), matrix = new THREE.Matrix4();
        batch.getMatrixAt(entry.index, matrix);
        assert.equal(Math.abs(matrix.determinant()) < 1e-12, hidden, 'batched knot follows popped/regrowing balloon visibility');
      });
      assert.ok(checked > 0, 'exercise a real batched balloon knot');
    };
    checkKnot(true);
    for (let i = 0; i < 240; i++) linked.update(1 / 60, 10001 + i / 60, { x: 0, y: 0, clicked: false });
    assert.equal(balloon.parent.visible, true);
    checkKnot(false);
  } finally { dispose(original); dispose(linked); }
});

test('carnival lamp animation updates uniforms, not hundreds of instance colours each frame', () => {
  const w = fixture(false);
  try {
    carnivalPartyV1(w);
    const lamps = []; w.root.traverse(o => { if (o.geometry?.getAttribute('carnivalLampIndex')) lamps.push(o); });
    assert.equal(lamps.length, 4);
    const versions = lamps.map(lamp => lamp.instanceColor.version);
    for (let i = 0; i < 60; i++) w.update(1 / 60, i / 60, { x: 0, y: 0, clicked: false });
    lamps.forEach((lamp, index) => {
      w.update(0, 59 / 60, { x: 0, y: 0, clicked: false });
      assert.equal(lamp.instanceColor.version, versions[index]);
      const shader = { uniforms: {}, vertexShader: '#include <color_vertex>' };
      lamp.material.onBeforeCompile(shader, {});
      assert.match(shader.vertexShader, /vColor.xyz \*= chase/);
      assert.equal(shader.uniforms.carnivalTime.value, 59 / 60);
      assert.equal(shader.uniforms.carnivalEvents.value, 1);
      w.c.params.cinemaEvents = 0; w.update(0, 1, { x: 0, y: 0, clicked: false });
      assert.equal(shader.uniforms.carnivalEvents.value, 0);
      w.c.params.cinemaEvents = 1;
    });
  } finally { dispose(w); }
});

test('local carnival profiling cannot disable features or install wrappers in production', () => {
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const original = { draw() {}, update() {} };
    const draw = original.draw, update = original.update;
    for (const mode of [1, 2, 3, 4, 5, 6]) {
      profileCarnival(original, mode);
      assert.equal(original.draw, draw); assert.equal(original.update, update);
    }
  } finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
});

function clickObject(w, object, time = 0) {
  w.scene.updateMatrixWorld(true); w.camera.updateMatrixWorld(true);
  const p = object.getWorldPosition(new THREE.Vector3()).project(w.camera);
  const x = (p.x + 1) * w.c.width / 2, y = (1 - p.y) * w.c.height / 2;
  w.update(1 / 60, time, { x, y, rawX: x, rawY: y, active: true, pressed: false, clicked: true });
}

for (const mobile of [false, true]) test(`original plan interactions: ${mobile ? 'portrait' : 'desktop'} masks and face settings`, () => {
  const w = fixture(mobile), face = fixture(mobile);
  try {
    politeMask(w); const mask = w.scene.getObjectByName('persona-mask');
    const pointer = { x: 0, y: 0, clicked: true };
    w.update(1 / 60, 0, pointer); pointer.clicked = false;
    for (let i = 0; i < 120; i++) w.update(1 / 60, i / 60, pointer);
    assert.ok(mask.position.y > 2.35);
    pointer.clicked = true; w.update(1 / 60, 2, pointer); pointer.clicked = false;
    for (let i = 0; i < 120; i++) w.update(1 / 60, 2 + i / 60, pointer);
    assert.ok(mask.position.y < .01);
    Object.assign(face.c.params, { faceWidth: 1, faceJaw: 1, faceNose: 1, faceEyes: 1, faceMood: 0, faceSkin: .48 });
    faceAtelier(face); face.update(0, 0, pointer);
    const skin = face.scene.getObjectByName('face-skin'), geometry = skin.geometry, before = geometry.attributes.position.array.slice();
    Object.assign(face.c.params, { faceWidth: 1.3, faceJaw: .8, faceNose: 1.4, faceEyes: 1.2, faceMood: -.8, faceSkin: .2 });
    face.update(1 / 60, 1, pointer);
    assert.equal(skin.geometry, geometry); assert.notDeepEqual(geometry.attributes.position.array, before);
    assert.ok(geometry.attributes.position.array.every(Number.isFinite)); assert.equal(skin.material.opacity, .2);
  } finally { dispose(w); dispose(face); }
});

test('planner does not divert capsules already past the switch', () => {
  const w = fixture(false);
  try {
    timeSwitchyard(w); const capsule = w.scene.getObjectByName('planner-capsule-0');
    w.update(1 / 60, 6, { x: 0, y: 0, clicked: false }); const before = capsule.position.clone();
    w.update(0, 6, { x: 0, y: 0, clicked: true }); assert.deepEqual(capsule.position, before);
    w.update(0, 6, { x: 0, y: 0, clicked: true }); assert.deepEqual(capsule.position, before);
  } finally { dispose(w); }
});

for (const mobile of [false, true]) test(`bureau: ${mobile ? 'portrait' : 'desktop'} visitors loop and click accelerates without teleporting`, () => {
  const w = fixture(mobile);
  try {
    certificateBureau(w); const people = []; w.scene.traverse(o => { if (o.name === 'certificate-visitor') people.push(o); });
    assert.equal(people.length, 6); w.update(0, 0, { x: 0, y: 0, clicked: false });
    const before = people.map(o => o.position.clone());
    w.update(0, 0, { x: 0, y: 0, clicked: true }); people.forEach((o, i) => assert.deepEqual(o.position, before[i]));
    for (let frame = 1; frame <= 30 * 60; frame++) {
      const previous = people.map(o => o.position.clone());
      w.update(1 / 60, frame / 60, { x: 0, y: 0, clicked: frame === 900 });
      people.forEach((o, i) => assert.ok(o.position.distanceTo(previous[i]) < .2, `visitor jumped at ${frame}`));
    }
  } finally { dispose(w); }
});

for (const mobile of [false, true]) test(`neon: ${mobile ? 'portrait' : 'desktop'} baked contributions follow their own circuit without new lights`, () => {
  const w = fixture(mobile);
  try {
    neonMarket(w); w.update(0, 0, { x: 0, y: 0, clicked: false });
    const panels = [], geometry = new Set();
    w.scene.traverse(o => { if (o.name.startsWith('neon-baked-')) panels.push(o); if (o.geometry) geometry.add(o.geometry); assert.ok(!(o instanceof THREE.PointLight)); });
    assert.equal(panels.length, 4);
    for (const panel of panels) for (let i = 0; i < 3; i++) {
      const data = panel.geometry.getAttribute(`light${i}`).array; assert.ok(data.every(Number.isFinite)); assert.ok(data.some(x => x > 0));
    }
    clickObject(w, w.scene.getObjectByName('neon-switch-0-1'));
    for (let i = 0; i < 60; i++) w.update(1 / 60, i / 60, { x: 0, y: 0, clicked: false });
    assert.ok(panels[0].material.uniforms.power.value.y < .001);
    assert.equal(panels[0].material.uniforms.power.value.x, 1); assert.equal(panels[2].material.uniforms.power.value.y, 1);
    assert.equal(panels[0].material.uniforms.power.value, panels[1].material.uniforms.power.value);
    w.scene.traverse(o => { if (o.geometry) assert.ok(geometry.has(o.geometry)); });
  } finally { dispose(w); }
});

for (const mobile of [false, true]) test(`pizza delivery: ${mobile ? 'portrait' : 'desktop'} full loop has aligned handoffs and no mid-flight jumps`, () => {
  const w = fixture(mobile);
  try {
    pizzaExpress(w); const pizza = w.scene.getObjectByName('pizza-payload'), drone = w.scene.getObjectByName('pizza-drone');
    const factory = w.scene.getObjectByName('pizza-factory'), home = w.scene.getObjectByName('pizza-home'), lift = w.scene.getObjectByName('pizza-lift');
    const geometry = new Set(); w.scene.traverse(o => { if (o.geometry) geometry.add(o.geometry); });
    const pointer = { x: w.c.width / 2, y: w.c.height / 2, clicked: false };
    let previous = null;
    for (let frame = 0; frame <= 24 * 120; frame++) {
      const t = frame / 120;
      w.update(frame === 0 ? 0 : 1 / 120, t, pointer); w.scene.updateMatrixWorld(true);
      if (previous && pizza.scale.x > .01 && t < 23.99) assert.ok(pizza.position.distanceTo(previous) < .15, `jump at ${t}`);
      previous = pizza.position.clone();
      if (t > 7.1 && t < 9.9) {
        const onLift = lift.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, .16 * factory.scale.y, 0));
        assert.ok(pizza.position.distanceTo(onLift) < 1e-8, 'payload rests on the scaled lift');
      }
      if (t > 12.1 && t < 16.9) assert.ok(pizza.position.distanceTo(drone.position.clone().add(new THREE.Vector3(0, -.6 * factory.scale.y, 0))) < 1e-8);
      if (t > 17.1 && t < 21) assert.ok(pizza.position.distanceTo(home.localToWorld(new THREE.Vector3(.5, 2.96, 2.2))) < 1e-8, 'delivery reaches the balcony table');
    }
    assert.ok(pizza.scale.x < 1e-5);
    const before = drone.position.clone(); w.c.params.react = 1;
    w.update(1 / 120, 24.01, { ...pointer, clicked: true });
    assert.ok(drone.position.distanceTo(before) < .02, 'click changes speed, not the phase');
    const after = new Set(); w.scene.traverse(o => { if (o.geometry) after.add(o.geometry); assert.ok(o.matrixWorld.elements.every(Number.isFinite)); });
    assert.deepEqual(after, geometry);
  } finally { dispose(w); }
});

for (const width of [320, 390]) test(`pizza buildings fit a ${width}px portrait viewport`, () => {
  const w = fixture(true);
  try {
    w.c.width = width; w.camera.aspect = width / w.c.height; pizzaExpress(w);
    w.update(0, 0, { x: width / 2, y: w.c.height / 2, clicked: false });
    w.scene.updateMatrixWorld(true); w.camera.updateMatrixWorld(true);
    for (const name of ['pizza-home', 'pizza-factory']) {
      const b = new THREE.Box3().setFromObject(w.scene.getObjectByName(name));
      for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
        const p = new THREE.Vector3(x, y, z).project(w.camera);
        assert.ok(Math.abs(p.x) < 1 && Math.abs(p.y) < 1, `${name}: ${p.toArray()}`);
      }
    }
  } finally { dispose(w); }
});

for (const mobile of [false, true]) test(`transit details: ${mobile ? 'portrait' : 'desktop'} pauses, resumes and closes lift doors before travel`, () => {
  const w = fixture(mobile);
  try {
    transitMachine(w); w.c.params.react = 1;
    const cars = [], lifts = [], geometry = new Set(); let objects = 0;
    w.scene.traverse(o => { objects++; if (o.name === 'transit-car') cars.push(o); if (o.name === 'transit-lift') lifts.push(o); if (o.geometry) geometry.add(o.geometry); });
    assert.equal(cars.length, 4); assert.equal(lifts.length, 2);
    const pointer = { x: 0, y: 0, clicked: false }; let time = 0;
    const step = (frames, clicked = false) => {
      for (let i = 0; i < frames; i++) { time += 1 / 60; w.update(1 / 60, time, { ...pointer, clicked: clicked && i === 0 }); }
    };
    w.update(0, 0, pointer);
    let previous = lifts.map(lift => lift.position.y), openAtRest = false;
    for (let frame = 0; frame < 2400; frame++) {
      step(1);
      lifts.forEach((lift, i) => {
        const open = lift.children.filter(o => o.name === 'transit-lift-door').some(o => Math.abs(o.position.x) > .271);
        if (open) { openAtRest = true; assert.ok(Math.abs(lift.position.y - previous[i]) < 1e-8, 'doors only open at a stop'); }
      }); previous = lifts.map(lift => lift.position.y);
    }
    assert.ok(openAtRest);
    step(240, true); const parked = cars.map(car => car.position.clone());
    step(120); cars.forEach((car, i) => assert.ok(car.position.distanceTo(parked[i]) < 1e-6, 'no drift after braking'));
    step(120, true); assert.ok(cars[0].position.distanceTo(parked[0]) > .1);
    let after = 0; w.scene.updateMatrixWorld(true); w.scene.traverse(o => { after++; assert.ok(o.matrixWorld.elements.every(Number.isFinite)); if (o.geometry) assert.ok(geometry.has(o.geometry)); });
    assert.equal(after, objects);
  } finally { dispose(w); }
});

for (const mobile of [false, true]) test(`supper details: ${mobile ? 'portrait' : 'desktop'} toast propagation, upright cups and bounded secondary motion`, () => {
  const w = fixture(mobile);
  try {
    familySupper(w); w.c.params.react = 1;
    const guests = [], cups = [], geometry = new Set(); let objects = 0;
    w.scene.traverse(o => { objects++; if (o.name === 'supper-guest') guests.push(o); if (o.name === 'supper-toast-cup') cups.push(o); if (o.geometry) geometry.add(o.geometry); });
    assert.equal(guests.length, 8); assert.equal(cups.length, 8);
    const cat = w.scene.getObjectByName('supper-cat'), steam = w.scene.getObjectByName('supper-steam');
    const pointer = { x: 0, y: 0, clicked: false }; const frame = (t, clicked = false) => w.update(1 / 60, t, { ...pointer, clicked });
    frame(0, true);
    for (let i = 1; i <= 40; i++) frame(i / 60);
    assert.ok(cups[0].parent.rotation.x < -1.5); assert.equal(cups[7].parent.rotation.x, -.2, 'toast has not jumped to the final guest');
    const before = cat.position.clone();
    for (let i = 41; i <= 720; i++) {
      frame(i / 60); cups.forEach(cup => assert.ok(Math.abs(cup.rotation.x + cup.parent.rotation.x) < 1e-10));
    }
    assert.ok(before.distanceTo(cat.position) > 1);
    assert.ok(steam.geometry.attributes.position.array.every(Number.isFinite));
    frame(12.1, true); frame(12.12); assert.ok(cups[0].parent.rotation.x < -.2, 'can repeat the toast');
    let after = 0; w.scene.updateMatrixWorld(true); w.scene.traverse(o => { after++; assert.ok(o.matrixWorld.elements.every(Number.isFinite)); if (o.geometry) assert.ok(geometry.has(o.geometry)); });
    assert.equal(after, objects);
  } finally { dispose(w); }
});

for (const width of [320, 390]) for (const [build, name] of [[familySupper, 'supper-stage'], [transitMachine, 'transit-city']]) {
  test(`${name}: full composition fits a ${width}px portrait viewport`, () => {
    const w = fixture(true);
    try {
      w.c.width = width; w.camera.aspect = width / w.c.height;
      build(w); w.update(0, 0, { x: width / 2, y: w.c.height / 2, clicked: false });
      w.scene.updateMatrixWorld(true); w.camera.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(w.scene.getObjectByName(name));
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const point = new THREE.Vector3(x, y, z).project(w.camera);
        assert.ok(Math.abs(point.x) < 1 && Math.abs(point.y) < 1, `clipped corner: ${point.toArray()}`);
      }
    } finally { dispose(w); }
  });
}

test('static batching preserves transformed bounds and transparent layers', () => {
  const w = fixture(false), g = new THREE.Group(); w.root.add(g); g.position.set(3, 2, -1); g.rotation.y = 0.4;
  const nested = new THREE.Group(); nested.rotation.z = 0.2; g.add(nested);
  const mat = new THREE.MeshStandardMaterial();
  const carrier = w.box(nested, [1, 2, 3], [1, 2, 3], mat); w.box(nested, [2, 1, 1], [-2, 0, 0], mat);
  const glass = w.box(carrier, [1, 1, 1], [0, 0, 0], new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5 }));
  // Compare actual vertices. A transformed AABB can grow when several rotated meshes are merged.
  const before = new THREE.Box3().setFromObject(g, true);
  bake(g); const after = new THREE.Box3().setFromObject(g, true);
  assert.ok(before.min.distanceTo(after.min) < 1e-5); assert.ok(before.max.distanceTo(after.max) < 1e-5);
  assert.equal(glass.parent, g); dispose(w);
});

test('all twelve distinct story builders are covered', () => { assert.equal(Object.keys(builders).length, 12); });

for (const mobile of [false, true]) test(`restoration: ${mobile ? 'portrait' : 'desktop'} assembles all irregular fragments without reset or new geometry`, () => {
  const w = fixture(mobile);
  try {
    secondChance(w); w.c.params.react = 1;
    const fragments = [], geometry = new Set();
    w.scene.traverse(o => { if (o.name === 'restoration-fragment') fragments.push(o); if (o.geometry) geometry.add(o.geometry); });
    assert.equal(fragments.length, 48);
    const seams = w.scene.getObjectByName('restoration-gold-seams'); assert.equal(seams.visible, false);
    const pointer = { x: w.c.width / 2, y: w.c.height / 2, rawX: w.c.width / 2, rawY: w.c.height / 2, active: true, clicked: true };
    for (let i = 0; i < 48; i++) { w.camera.updateMatrixWorld(true); w.update(1 / 60, i / 60, pointer); }
    pointer.clicked = false;
    for (let i = 0; i < 240; i++) w.update(1 / 60, 1 + i / 60, pointer);
    assert.equal(seams.visible, true); assert.ok(fragments.every(p => p.position.length() < 1e-10));
    const vessel = w.scene.getObjectByName('restoration-vessel');
    assert.ok(vessel.rotation.y > 0); assert.equal(vessel.parent.rotation.y, 0, 'labels and workshop tools do not rotate with the vase');
    for (let i = 0; i < 120; i++) w.update(1 / 30, 10 + i / 30, pointer);
    assert.equal(seams.visible, true); assert.ok(fragments.every(p => p.position.length() < 1e-10));
    const after = new Set(); w.scene.traverse(o => { if (o.geometry) after.add(o.geometry); }); assert.deepEqual(after, geometry);
  } finally { dispose(w); }
});
for (const [name, build] of Object.entries(builders)) for (const mobile of [false, true]) {
  test(`${name}: ${mobile ? 'portrait' : 'desktop'} geometry and complete animation cycles stay finite`, () => {
    const w = fixture(mobile);
    try {
      build(w);
      assert.ok(w.ticks.length > 0, 'the scene must contain motion');
      let vertices = 0;
      w.scene.traverse(o => {
        if (!o.geometry) return;
        const attr = o.geometry.getAttribute('position'); vertices += attr.count;
        for (const value of attr.array) assert.ok(Number.isFinite(value), 'invalid vertex');
      });
      assert.ok(vertices > 10000, 'unexpectedly empty scene');
      for (const t of [0, 0.3, 2.27, 3.59, 4, 6, 8.5, 12, 17.99, 18, 23.99, 24, 48, 120]) {
        w.update(1 / 60, t, { x: 0, y: 0, clicked: false }); w.scene.updateMatrixWorld(true);
        w.scene.traverse(o => {
          assert.ok(o.matrixWorld.elements.every(Number.isFinite), `invalid transform at ${t}`);
          if (o instanceof THREE.InstancedMesh) assert.ok(o.instanceMatrix.array.every(Number.isFinite), `invalid instance at ${t}`);
        });
      }
      assert.equal(w.stage.visible, false, 'old showroom floor should not leak into a story');
    } finally { dispose(w); }
  });
}
