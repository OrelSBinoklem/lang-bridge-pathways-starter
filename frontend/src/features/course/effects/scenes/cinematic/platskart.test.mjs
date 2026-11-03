import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import ts from 'typescript';
import * as T from 'three';

const cache = new Map();
async function moduleUrl(name) {
  if (cache.has(name)) return cache.get(name);
  let code = ts.transpileModule(await readFile(new URL(name + '.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const match of [...code.matchAll(/from ['"]([^'"]+)['"]/g)]) code = code.replace(match[0], `from ${JSON.stringify(match[1].startsWith('.') ? await moduleUrl(match[1]) : import.meta.resolve(match[1]))}`);
  const url = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64'); cache.set(name, url); return url;
}
const { World } = await import(await moduleUrl('./world'));
const { platskartJourney } = await import(await moduleUrl('./storiesPlatskart'));
const { trainMaterials, mappedPlane } = await import(await moduleUrl('./platskartMaterials'));
const { TRAIN_BAKE_SURFACES, trainSipPose } = await import(await moduleUrl('./trainLayout'));
const { trainFingerLift } = await import(await moduleUrl('./platskartHands'));
function fixture(width = 1280, height = 720) {
  const w = Object.create(World.prototype); let seed = 17;
  Object.assign(w, { scene: new T.Scene(), root: new T.Group(), stage: new T.Group(), ticks: [], anchors: [], maps: new Set(), pulse: 0,
    pointer: new T.Vector3(), cameraBase: 21, cameraMotion: 0, eye: new T.Vector3(), target: new T.Vector3(), mobile: width / height < .85,
    camera: new T.PerspectiveCamera(46, width / height, .1, 150), renderer: { shadowMap: { enabled: true } },
    c: { width, height, dpr: 1, body: false, cameraControls: false, rand: () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296), params: { react: 1, cinemaCamera: 0, zoom: 1 } },
  });
  w.scene.add(w.root, w.stage);
  w.text = (parent, text, color, width = 2.4, height = .55) => { const mesh = w.mesh(new T.PlaneGeometry(width, height), new T.MeshBasicMaterial({ color, transparent: true }), parent); mesh.userData.text = text; return mesh; };
  platskartJourney(w, trainMaterials(w, false));
  return w;
}
function dispose(w) {
  const geometries = new Set(), materials = new Set();
  w.scene.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m)); if (o.isInstancedMesh) o.dispose(); });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); w.scene.clear();
}

test('the open sleeping car has a genuinely continuous aisle, side berths and a real window opening', () => {
  const w = fixture();
  try {
    assert.equal(w.scene.getObjectsByProperty('name', 'train-side-berth').length, 5);
    assert.equal(w.scene.getObjectsByProperty('name', 'train-open-aisle').length, 1);
    assert.equal(w.scene.getObjectsByProperty('name', 'train-main-window').length, 1);
    assert.equal(w.scene.getObjectsByProperty('name', 'train-podstakannik').length, 1);
    assert.equal(w.renderer.shadowMap.enabled, false, 'runtime shadows/ray tracing are not required');
    w.update(.03, .03, { x: 0, y: 0, rawX: 0, rawY: 0, active: false, pressed: false, clicked: false }); w.scene.updateMatrixWorld(true);
    const ray = new T.Raycaster(new T.Vector3(1.03, 1.2, 1), new T.Vector3(0, 0, -1), 0, 11);
    assert.equal(ray.intersectObject(w.root, true).length, 0, 'no door or partition blocks the longitudinal passage');
    ray.set(new T.Vector3(-1.6, 1.55, 0), new T.Vector3(-1, 0, 0));
    const hits = ray.intersectObject(w.root, true).filter(h => !h.object.material?.transparent);
    assert.ok(hits.every(h => h.point.x < -2.5), 'the window is a hole in the wall, not a painted rectangle');
  } finally { dispose(w); }
});

for (const [width, height] of [[500, 220], [1280, 720], [390, 844]]) test(`${width}×${height}: forest, meal and steam animate without new geometry or invalid transforms`, () => {
  const w = fixture(width, height);
  try {
    const before = new Set(); w.scene.traverse(o => { if (o.geometry) before.add(o.geometry); });
    const p = { x: width / 2, y: height / 2, rawX: width / 2, rawY: height / 2, active: false, pressed: false, clicked: false };
    let taps = false;
    const hands = w.scene.getObjectsByProperty('name', 'train-anatomical-hand');
    const rests = hands.map(hand => hand.position.clone());
    for (let frame = 0; frame < 900; frame++) {
      w.update(.03, frame * .03, p);
      taps ||= w.scene.getObjectsByProperty('name', 'train-finger').some(finger => finger.rotation.x > .2);
      hands.forEach((hand, i) => assert.ok(hand.position.distanceTo(rests[i]) < 1e-9, 'no arm lifting/eating cycle'));
      if (frame % 80 === 0) { w.scene.updateMatrixWorld(true); w.scene.traverse(o => { assert.ok(o.matrixWorld.elements.every(Number.isFinite)); if (o.isInstancedMesh) assert.ok(o.instanceMatrix.array.every(Number.isFinite)); }); }
    }
    assert.ok(taps);
    assert.ok(w.scene.getObjectByName('train-moving-forest').userData.distance > 300);
    const steam = w.scene.getObjectByName('train-tea-steam');
    assert.equal(steam.children.length, 1); assert.equal(steam.children[0].count, 28);
    assert.equal(steam.userData.technique, 'advected-billboard-volume');
    assert.equal(steam.children[0].material.depthWrite, false); assert.ok(steam.children[0].material.uniforms.time.value > 20);
    const after = new Set(); w.scene.traverse(o => { if (o.geometry) after.add(o.geometry); }); assert.deepEqual(after, before);
  } finally { dispose(w); }
});

test('hands, cushions and cabin hardware have their own anatomical and structural detail', () => {
  const w = fixture();
  try {
    const hands = w.scene.getObjectsByProperty('name', 'train-anatomical-hand');
    assert.equal(hands.length, 2);
    for (const hand of hands) { assert.equal(hand.userData.fingers, 5); assert.equal(hand.userData.phalanges, 15); }
    assert.equal(w.scene.getObjectsByProperty('name', 'train-tailored-sleeve').length, 2);
    const cushions = w.scene.getObjectsByProperty('name', 'train-stitched-mattress');
    assert.equal(cushions.length, 22);
    for (const cushion of cushions) { assert.equal(cushion.userData.welt, true); assert.equal(cushion.userData.hinges, 2); }
    assert.ok(w.scene.getObjectByName('train-cabin-hardware'));
    const steam = w.scene.getObjectByName('train-steam-puffs');
    const hits = []; steam.raycast(new T.Raycaster(), hits); assert.equal(hits.length, 0);
    const seeds = steam.geometry.attributes.steamSeed;
    assert.equal(seeds.count, 28); assert.ok(seeds.array.every(Number.isFinite));
  } finally { dispose(w); }
});

test('clicking the tea no longer moves the glass or arms, while fingers occasionally drum independently', () => {
  const w = fixture();
  try {
    const cup = w.scene.getObjectByName('train-tea'), base = cup.position.clone();
    const p = { x: 0, y: 0, rawX: 0, rawY: 0, active: false, pressed: false, clicked: false };
    w.update(.03, .03, p); w.scene.updateMatrixWorld(true); w.camera.updateMatrixWorld(true);
    const point = cup.getWorldPosition(new T.Vector3()).add(new T.Vector3(0, .1, 0)).project(w.camera);
    p.rawX = p.x = (point.x + 1) * w.c.width / 2; p.rawY = p.y = (1 - point.y) * w.c.height / 2; p.clicked = p.active = true;
    w.update(.03, .06, p); p.clicked = false;
    for (let i = 0; i < 55; i++) w.update(.03, .1 + i * .03, p);
    assert.ok(cup.position.distanceTo(base) < 1e-8);
    for (let i = 0; i < 160; i++) w.update(.03, 2 + i * .03, p);
    assert.ok(cup.position.distanceTo(base) < 1e-8);
    assert.equal(w.scene.getObjectByName('train-eating-spoon'), undefined);
    assert.equal(w.scene.getObjectByName('train-resting-spoon').parent.name, 'train-table-things');
    for (const t of [-1, 0, 4.5, 20]) assert.equal(trainSipPose(t), 0);
  } finally { dispose(w); }
});

test('finger joints survive baking, palms stay horizontal and skin never pierces the tabletop', () => {
  const w = fixture();
  try {
    const hands = w.scene.getObjectsByProperty('name', 'train-anatomical-hand');
    const fingers = w.scene.getObjectsByProperty('name', 'train-finger');
    assert.equal(fingers.length, 8);
    assert.ok(fingers.every(finger => finger.children.some(mesh => mesh.isMesh)));
    const car = w.scene.getObjectByName('platskart-open-car'), point = new T.Vector3();
    for (let t = 0; t < 18; t += .09) {
      w.update(.03, t, { active: false, pressed: false, clicked: false, rawX: 0, rawY: 0 });
      w.scene.updateMatrixWorld(true);
      const inverse = car.matrixWorld.clone().invert();
      for (const hand of hands) {
        assert.equal(hand.rotation.x, 0); assert.equal(hand.rotation.z, 0);
        hand.traverse(mesh => {
          if (!mesh.isMesh) return;
          const position = mesh.geometry.attributes.position;
          for (let i = 0; i < position.count; i++) {
            point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
            assert.ok(point.y >= TRAIN_BAKE_SURFACES.table.origin[1] - .0001, `hand penetrated table at ${t}: ${point.y}`);
          }
        });
      }
    }
    let active = 0, resting = 0;
    for (let t = 0; t < 17; t += .01) {
      const poses = Array.from({ length: 4 }, (_, i) => trainFingerLift(t, i, 1));
      poses.some(a => a > .001) ? active++ : resting++;
      assert.ok(poses.every(a => a >= 0 && a <= .23));
    }
    assert.ok(resting > active * 8, 'long pauses, not constant finger waving');
    assert.notEqual(trainFingerLift(6.12, 0, 1), trainFingerLift(6.12, 3, 1));
  } finally { dispose(w); }
});

test('all mapped surfaces face their intended normal and their baked files exist', async () => {
  const w = fixture();
  try {
    for (const [name, s] of Object.entries(TRAIN_BAKE_SURFACES)) {
      const mesh = mappedPlane(w, w.root, s.origin, s.u, s.v, s.normal, new T.MeshStandardMaterial(), null);
      const geometry = mesh.geometry, a = new T.Vector3().fromBufferAttribute(geometry.attributes.position, geometry.index.getX(0)), b = new T.Vector3().fromBufferAttribute(geometry.attributes.position, geometry.index.getX(1)), c = new T.Vector3().fromBufferAttribute(geometry.attributes.position, geometry.index.getX(2));
      assert.ok(b.sub(a).cross(c.sub(a)).dot(new T.Vector3(...s.normal)) > 0);
      await access(new URL(`../../../../../../public/course/effects/platskart/light-${name}.webp`, import.meta.url));
    }
  } finally { dispose(w); }
});

test('late texture loading updates the baked material copies without a black wet placeholder', async () => {
  const w = fixture(), pending = [], original = T.TextureLoader.prototype.load;
  try {
    w.renderer.capabilities = { getMaxAnisotropy: () => 8 };
    T.TextureLoader.prototype.load = function(url, ready) { const map = new T.Texture(); pending.push({url, ready, map}); return map; };
    const materials = trainMaterials(w);
    const s = TRAIN_BAKE_SURFACES.table;
    const plane = mappedPlane(w, w.root, s.origin, s.u, s.v, s.normal, materials.wood, null);
    assert.equal(plane.material.map, null); assert.equal(materials.skin.roughnessMap, null);
    for (const item of pending) {
      const file = item.url.split('/').at(-1).split('?')[0];
      await access(new URL(`../../../../../../public/course/effects/platskart/${file}`, import.meta.url));
      item.ready(item.map);
    }
    assert.ok(plane.material.map); assert.equal(plane.material.map, materials.wood.map);
    assert.equal(plane.material.roughnessMap, materials.wood.roughnessMap);
    assert.equal(plane.material.bumpMap, materials.wood.bumpMap);
    assert.equal(materials.skin.roughnessMap.colorSpace, T.NoColorSpace);
    assert.equal(materials.skin.map.colorSpace, T.SRGBColorSpace);
  } finally { T.TextureLoader.prototype.load = original; dispose(w); }
});
