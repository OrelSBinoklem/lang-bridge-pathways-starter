import {
  ACESFilmicToneMapping, BoxGeometry, BufferGeometry, CanvasTexture, CircleGeometry, Color, CylinderGeometry, DirectionalLight,
  Group, HemisphereLight, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, OrthographicCamera,
  PCFSoftShadowMap, PlaneGeometry, PMREMGenerator, Raycaster, Scene, SphereGeometry, SRGBColorSpace, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { Box as PhysicsBox, Sphere as PhysicsSphere } from 'cannon-es';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createDominoArchipelago, DOMINO_SIZE, type WorkshopPart } from './dominoArchipelagoPhysics';
import { createOrbit } from './orbitControl';
import type { CanvasSceneDef } from './types';

const COLORS = ['#fa6255', '#22c8ba', '#f9bd44', '#a079e9', '#15323d', '#d8ad66'];
export const DOMINO_ARCHIPELAGO: CanvasSceneDef = {
  kind: 'canvas', id: 'domino-archipelago', label: 'Импульс III · архипелаг механизмов',
  palettes: [['#122332', ...COLORS]], defaultParams: { speed: 1, intensity: 1, camOn: 1 }, pixelRatioCap: 2, warmupFrames: 1,
  create(c) {
    const sim = createDominoArchipelago();
    const orbit = createOrbit(c, { pitch: [-35, 40], zoom: [.65, 3.5], place: () => ({ right: c.width - 18, top: c.width < 700 ? 154 : 75 }) });
    const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(1.5, c.dpr, Math.sqrt(1_600_000 / (c.width * c.height)))); renderer.setSize(c.width, c.height, false);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    const scene = new Scene(); scene.background = new Color('#101f2c');
    const camera = new OrthographicCamera(-18, 18, 13, -13, .1, 150), target = new Vector3(0, 2, .5);
    const pmrem = new PMREMGenerator(renderer), room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, .04); scene.environment = environment.texture; room.dispose(); pmrem.dispose();
    scene.add(new HemisphereLight('#d8eafa', '#4d3830', 1.4));
    const light = new DirectionalLight('#fff0d8', 3.2); light.position.set(-10, 21, 10); light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048); Object.assign(light.shadow.camera, { left: -19, right: 19, top: 19, bottom: -19, near: 1, far: 65 });
    light.shadow.normalBias = .035; light.shadow.bias = -.0002; scene.add(light);
    const rim = new DirectionalLight('#b3d8ff', 1.8); rim.position.set(12, 10, -9); scene.add(rim);
    const geometries: BufferGeometry[] = [];
    const materials: MeshStandardMaterial[] = [];
    const textures: CanvasTexture[] = [];
    const geo = <T extends BufferGeometry>(g: T) => { geometries.push(g); return g; };
    const mat = (color: string, metalness = .15, roughness = .36) => { const m = new MeshStandardMaterial({ color, metalness, roughness }); materials.push(m); return m; };
    const colors = COLORS.map((s, i) => mat(s, i === 5 ? .8 : .22, i === 5 ? .24 : .35));
    const ivory = mat('#ece3c8', .08, .32), steel = mat('#9eb4c5', .8, .2), charcoal = mat('#11232f', .22, .6);
    const cube = geo(new BoxGeometry(1, 1, 1)), round = geo(new RoundedBoxGeometry(...DOMINO_SIZE, 2, .018));
    const sphere = geo(new SphereGeometry(1, 24, 16)), cylinder = geo(new CylinderGeometry(1, 1, 1, 16));
    const dummy = new Object3D();
    const floor = new Mesh(geo(new PlaneGeometry(150, 150)), charcoal); floor.rotation.x = -Math.PI / 2; floor.position.y = -.72; floor.receiveShadow = true; scene.add(floor);
    const staticParts = sim.parts.filter(p => p.body.mass === 0 && !p.guard);
    const staticBoxes = new InstancedMesh(cube, mat('#ffffff', .25, .46), staticParts.length); staticBoxes.castShadow = staticBoxes.receiveShadow = true; scene.add(staticBoxes);
    staticParts.forEach((p, i) => {
      dummy.position.copy(p.body.position); dummy.quaternion.copy(p.body.quaternion); dummy.scale.set(...p.size); dummy.updateMatrix();
      staticBoxes.setMatrixAt(i, dummy.matrix); staticBoxes.setColorAt(i, new Color(COLORS[p.color]).multiplyScalar(p.kind === 'rail' ? 1 : .7));
    });
    const guardParts = sim.parts.filter(p => p.guard);
    const glass = mat('#8dc8dd', .05, .22); glass.transparent = true; glass.opacity = .16; glass.depthWrite = false;
    const guards = new InstancedMesh(cube, glass, guardParts.length); scene.add(guards);
    guardParts.forEach((p, i) => {
      dummy.position.copy(p.body.position); dummy.quaternion.copy(p.body.quaternion); dummy.scale.set(...p.size); dummy.updateMatrix(); guards.setMatrixAt(i, dummy.matrix);
    });
    const dominoParts = sim.dynamic.filter(p => p.kind === 'domino');
    const dominos = new InstancedMesh(round, mat('#ffffff', .18, .27), dominoParts.length); dominos.castShadow = dominos.receiveShadow = true; scene.add(dominos);
    const dots = new InstancedMesh(geo(new CircleGeometry(1, 12)), ivory, dominoParts.length * 4); scene.add(dots);
    const dotParent = new Object3D(), dotLocal = new Object3D(); dotParent.add(dotLocal);
    dotLocal.rotation.y = Math.PI / 2;
    const normalColors = COLORS.map(s => new Color(s)), highlightColors = normalColors.map(v => v.clone().multiplyScalar(1.4));
    const pickables: Object3D[] = [dominos];
    const movable = new Map<WorkshopPart, Group>(), wires: { part: WorkshopPart; object: Mesh }[] = [];
    function piece(parent: Object3D, geometry: BufferGeometry, material: MeshStandardMaterial, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
      const mesh = new Mesh(geometry, material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
    }
    // Fine engraved markings are baked once; only the rigid bodies and their shadows move.
    for (const { title: text, x, z, width } of sim.stations) {
      const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 96;
      const g = canvas.getContext('2d')!;
      g.fillStyle = '#213b48'; g.fillRect(0, 0, 768, 96); g.strokeStyle = '#8faaa9'; g.lineWidth = 2; g.strokeRect(3, 3, 762, 90);
      g.fillStyle = '#eddfbe'; g.font = '600 37px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 384, 48);
      const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); textures.push(texture);
      const material = mat('#ffffff', .1, .7); material.map = texture;
      const label = piece(scene, geo(new PlaneGeometry(width, width / 8)), material, x, .012, z, 1, 1, 1); label.rotation.x = -Math.PI / 2; label.castShadow = false;
    }
    // Repeated brass fasteners stay instanced rather than making dozens of draw calls.
    const fasteners = new InstancedMesh(cylinder, steel, 32); scene.add(fasteners);
    for (let i = 0; i < 32; i++) {
      const side = i < 16 ? -1 : 1, j = i % 16;
      dummy.position.set(-14.3 + j / 15 * 28.6, .025, side * 11.65); dummy.rotation.set(0, 0, 0); dummy.scale.set(.045, .05, .045); dummy.updateMatrix(); fasteners.setMatrixAt(i, dummy.matrix);
    }
    const supports: { x: number; y: number; z: number }[] = [];
    for (const track of sim.tracks) for (let i = 0; i < track.length - 1; i += 11) {
      const p = track[i], next = track[i + 1], dx = next.x - p.x, dz = next.z - p.z, length = Math.hypot(dx, dz);
      if (p.y < .7 || !length) continue;
      supports.push({ x: p.x - dz / length * .8, y: p.y, z: p.z + dx / length * .8 });
      piece(scene, cube, colors[5], p.x - dz / length * .4, p.y - .2, p.z + dx / length * .4, 1, .12, .18).rotation.y = -Math.atan2(dz, dx) + Math.PI / 2;
    }
    const columns = new InstancedMesh(cylinder, colors[5], supports.length); columns.castShadow = true; scene.add(columns);
    supports.forEach((p, i) => { dummy.position.set(p.x, p.y / 2, p.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(.065, p.y, .065); dummy.updateMatrix(); columns.setMatrixAt(i, dummy.matrix); });
    for (const p of sim.dynamic.filter(p => p.kind !== 'domino')) {
      const root = new Group(); root.userData.part = p; scene.add(root); pickables.push(root); movable.set(p, root);
      p.body.shapes.forEach((shape, i) => {
        const offset = p.body.shapeOffsets[i], q = p.body.shapeOrientations[i];
        let mesh: Mesh | undefined;
        if (shape instanceof PhysicsSphere) mesh = piece(root, sphere, steel, offset.x, offset.y, offset.z, shape.radius, shape.radius, shape.radius);
        else if (shape instanceof PhysicsBox) {
          const h = shape.halfExtents;
          mesh = piece(root, cube, p.kind === 'rotor' && i % 2 ? colors[i % 4] : colors[p.color], offset.x, offset.y, offset.z, h.x * 2, h.y * 2, h.z * 2);
        }
        if (mesh) mesh.quaternion.copy(q);
      });
      if (p.anchor) {
        const a = p.anchor;
        if (p.kind === 'pendulum' || p.kind === 'cradle') {
          const wire = piece(scene, cylinder, colors[5], 0, 0, 0, .023, 1, .023); wires.push({ part: p, object: wire });
          for (const offset of [-.65, .65]) piece(scene, cylinder, colors[5], a.x, a.y / 2, a.z + offset, .055, a.y, .055);
          piece(scene, cube, colors[5], a.x, a.y, a.z, .12, .12, 1.5);
        } else {
          const direction = new Vector3(p.hingeAxis?.x ?? 0, p.hingeAxis?.y ?? 0, p.hingeAxis?.z ?? 1);
          const halfSpan = p.hingeAxis?.x ? p.size[0] / 2 + .15 : Math.max(.75, p.size[2] / 2 + .15);
          for (const side of [-1, 1]) piece(scene, cylinder, colors[5], a.x + direction.x * halfSpan * side, a.y / 2, a.z + direction.z * halfSpan * side, .065, a.y, .065);
          const axle = piece(scene, cylinder, steel, a.x, a.y, a.z, .085, halfSpan * 2 + .15, .085);
          axle.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction);
        }
      }
    }
    const ray = new Raycaster(), pointerNdc = new Vector2(), axisY = new Vector3(0, 1, 0), wireVector = new Vector3();
    let hovered: WorkshopPart | undefined, lost = false;
    let shift = false, pan: { x: number; y: number } | undefined;
    const keyDown = (event: KeyboardEvent) => { shift = event.shiftKey; };
    const keyUp = (event: KeyboardEvent) => { shift = event.shiftKey; };
    const blur = () => { shift = false; pan = undefined; };
    window.addEventListener('keydown', keyDown); window.addEventListener('keyup', keyUp); window.addEventListener('blur', blur);
    const panRight = new Vector3(), panUp = new Vector3();
    const onLost = (e: Event) => { e.preventDefault(); lost = true; console.warn('Domino workshop: graphics context lost'); };
    const onRestored = () => { lost = false; };
    renderer.domElement.addEventListener('webglcontextlost', onLost); renderer.domElement.addEventListener('webglcontextrestored', onRestored);
    const updateView = () => {
      const yaw = .35 + orbit.yaw, pitch = .72 + orbit.pitch;
      camera.position.set(target.x + 38 * Math.cos(pitch) * Math.sin(yaw), target.y + 38 * Math.sin(pitch), target.z + 38 * Math.cos(pitch) * Math.cos(yaw));
      camera.lookAt(target); const half = Math.max(15, 18 / (c.width / c.height)) / orbit.zoom;
      camera.left = -half * c.width / c.height; camera.right = -camera.left; camera.top = half; camera.bottom = -half; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    };
    const lastPoses = new Float64Array(dominoParts.length * 7).fill(NaN);
    let lastHover: WorkshopPart | undefined, colorsReady = false;
    function updateObjects() {
      let moved = false;
      const colorsChanged = !colorsReady || hovered !== lastHover;
      dominoParts.forEach((p, i) => {
        if (colorsChanged) dominos.setColorAt(i, (p === hovered ? highlightColors : normalColors)[p.color]);
        const b = p.body, q = b.quaternion, offset = i * 7;
        // Sleeping tiles keep their GPU matrices, including the four face markings.
        // Compare the final pose, not sleepState: capture the last movement before sleep.
        if (lastPoses[offset] === b.position.x && lastPoses[offset + 1] === b.position.y && lastPoses[offset + 2] === b.position.z &&
          lastPoses[offset + 3] === q.x && lastPoses[offset + 4] === q.y && lastPoses[offset + 5] === q.z && lastPoses[offset + 6] === q.w) return;
        lastPoses.set([b.position.x, b.position.y, b.position.z, q.x, q.y, q.z, q.w], offset); moved = true;
        dummy.position.copy(p.body.position); dummy.quaternion.copy(p.body.quaternion); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); dominos.setMatrixAt(i, dummy.matrix);
        dominos.instanceMatrix.addUpdateRange(i * 16, 16);
        dotParent.position.copy(p.body.position); dotParent.quaternion.copy(p.body.quaternion);
        for (let j = 0; j < 4; j++) {
          dotLocal.position.set(.055, j < 2 ? -.23 : .23, j % 2 ? -.13 : .13); dotLocal.scale.set(.035, .035, 1); dotParent.updateMatrixWorld(true);
          dots.setMatrixAt(i * 4 + j, dotLocal.matrixWorld);
        }
        dots.instanceMatrix.addUpdateRange(i * 64, 64);
      });
      if (moved) {
        dominos.instanceMatrix.needsUpdate = dots.instanceMatrix.needsUpdate = true;
        dominos.computeBoundingSphere(); dots.computeBoundingSphere();
      }
      if (colorsChanged && dominos.instanceColor) dominos.instanceColor.needsUpdate = true;
      colorsReady = true; lastHover = hovered;
      for (const [p, root] of movable) { root.position.copy(p.body.position); root.quaternion.copy(p.body.quaternion); }
      for (const { part: p, object } of wires) {
        const a = p.anchor!; wireVector.set(a.x - p.body.position.x, a.y - p.body.position.y, a.z - p.body.position.z);
        object.position.set((a.x + p.body.position.x) / 2, (a.y + p.body.position.y) / 2, (a.z + p.body.position.z) / 2);
        object.scale.set(.023, wireVector.length(), .023); object.quaternion.setFromUnitVectors(axisY, wireVector.normalize());
      }
      scene.updateMatrixWorld();
    }
    const launchRects = () => {
      const columns = Math.max(2, Math.min(5, Math.floor((c.width - 44) / 100)));
      return sim.launches.map((launch, i) => ({ ...launch, x: 22 + (i % columns) * 100, y: 76 + Math.floor(i / columns) * 34, w: 94, h: 28 }));
    };
    updateView(); updateObjects();
    return {
      update(dt, _t, rawPointer) {
        const panning = !!pan || (shift && rawPointer.active && rawPointer.pressed);
        if (panning && rawPointer.pressed) {
          if (pan) {
            const scale = (camera.top - camera.bottom) / c.height;
            panRight.setFromMatrixColumn(camera.matrixWorld, 0); panUp.setFromMatrixColumn(camera.matrixWorld, 1);
            target.addScaledVector(panRight, (pan.x - rawPointer.rawX) * scale).addScaledVector(panUp, (rawPointer.rawY - pan.y) * scale);
            target.clamp(new Vector3(-16, -2, -14), new Vector3(16, 10, 14));
          }
          pan = { x: rawPointer.rawX, y: rawPointer.rawY };
        } else pan = undefined;
        const pointer = orbit.update(panning ? { ...rawPointer, active: false, pressed: false, clicked: false } : rawPointer); updateView();
        sim.update(dt); updateObjects(); hovered = undefined;
        if (pointer.active) {
          pointerNdc.set(pointer.rawX / c.width * 2 - 1, 1 - pointer.rawY / c.height * 2); ray.setFromCamera(pointerNdc, camera);
          const hit = ray.intersectObjects(pickables, true)[0];
          if (hit?.object === dominos && hit.instanceId !== undefined) hovered = dominoParts[hit.instanceId];
          else if (hit) { let object: Object3D | null = hit.object; while (object && !object.userData.part) object = object.parent; hovered = object?.userData.part; }
          if (pointer.clicked) {
            const launch = launchRects().find(b => pointer.rawX >= b.x && pointer.rawX <= b.x + b.w && pointer.rawY >= b.y && pointer.rawY <= b.y + b.h);
            if (launch) sim.push(launch.index);
            else if (hovered) sim.push(sim.dynamic.indexOf(hovered));
          }
        }
        renderer.toneMappingExposure = Math.max(.5, Math.min(1.7, c.params.intensity * 1.1));
      },
      draw(g) {
        if (lost) { g.fillStyle = '#112332'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#fff'; g.fillText('Графический контекст потерян. Откройте сцену заново.', 20, 40); return; }
        renderer.render(scene, camera); g.drawImage(renderer.domElement, 0, 0, c.width, c.height);
        g.fillStyle = '#efe5cf'; g.textAlign = 'left'; g.font = `600 ${c.width < 600 ? 18 : 25}px system-ui`; g.fillText('ИМПУЛЬС III / АРХИПЕЛАГ МЕХАНИЗМОВ', 22, 36, c.width - 44);
        const sleep = sim.sleepStats;
        g.fillStyle = '#b2c7d2'; g.font = '12px system-ui'; g.fillText(`${dominoParts.length} домино · активны: ${sleep.active} · спят: ${sleep.frozen} · толчков: ${sim.pushes}`, 23, 59, c.width - 46);
        for (const button of launchRects()) {
          g.fillStyle = '#244654'; g.beginPath(); g.roundRect(button.x, button.y, button.w, button.h, 7); g.fill();
          g.fillStyle = '#ffe1a0'; g.fillText('↗ ' + button.title, button.x + 10, button.y + 19);
        }
        orbit.draw(g);
        g.textAlign = 'center'; g.fillStyle = '#cbdae1'; g.font = '12px system-ui';
        g.fillText('Клик — толчок · тянуть — поворот · колесо — зум · Shift + тянуть — сдвиг камеры', c.width / 2, c.height - 65, c.width - 32);
      },
      dispose() {
        window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); window.removeEventListener('blur', blur);
        orbit.dispose(); sim.dispose(); renderer.domElement.removeEventListener('webglcontextlost', onLost); renderer.domElement.removeEventListener('webglcontextrestored', onRestored);
        staticBoxes.dispose(); guards.dispose(); dominos.dispose(); dots.dispose(); columns.dispose(); fasteners.dispose(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); environment.dispose(); light.shadow.map?.dispose(); renderer.dispose(); renderer.forceContextLoss();
      },
    };
  },
};
