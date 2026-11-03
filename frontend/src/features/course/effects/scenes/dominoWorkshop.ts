import {
  ACESFilmicToneMapping, BoxGeometry, BufferGeometry, CanvasTexture, CircleGeometry, Color, CylinderGeometry, DirectionalLight,
  Group, HemisphereLight, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, OrthographicCamera,
  PCFSoftShadowMap, PlaneGeometry, PMREMGenerator, Raycaster, Scene, SphereGeometry, SRGBColorSpace, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createDominoWorkshop, DOMINO_SIZE, type WorkshopPart } from './dominoWorkshopPhysics';
import { createOrbit } from './orbitControl';
import type { CanvasSceneDef } from './types';

const COLORS = ['#f37555', '#51bfb2', '#e8b953', '#9898dd', '#213b48', '#d5b579'];
export const DOMINO_WORKSHOP: CanvasSceneDef = {
  kind: 'canvas', id: 'domino-workshop', label: 'Импульс II · винтовая мастерская · физика',
  palettes: [['#122332', ...COLORS]], defaultParams: { speed: 1, intensity: 1, camOn: 1 }, pixelRatioCap: 2, warmupFrames: 1,
  create(c) {
    const sim = createDominoWorkshop();
    const orbit = createOrbit(c, { pitch: [-35, 40], zoom: [.65, 3.5], place: () => ({ right: c.width - 18, top: 75 }) });
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
    const staticParts = sim.parts.filter(p => p.body.mass === 0);
    const staticBoxes = new InstancedMesh(cube, mat('#ffffff', .25, .46), staticParts.length); staticBoxes.castShadow = staticBoxes.receiveShadow = true; scene.add(staticBoxes);
    staticParts.forEach((p, i) => {
      dummy.position.copy(p.body.position); dummy.quaternion.copy(p.body.quaternion); dummy.scale.set(...p.size); dummy.updateMatrix();
      staticBoxes.setMatrixAt(i, dummy.matrix); staticBoxes.setColorAt(i, new Color(COLORS[p.color]).multiplyScalar(p.kind === 'rail' ? 1 : .7));
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
    for (const [text, x, z, width] of [
      ['01 / ВИНТОВОЙ СПУСК', -4.8, -7.6, 4.3], ['02 / МОСТ', 3.5, -7.7, 3.4],
      ['03 / ПЕРЕДАЧА', 8.2, 5.4, 3], ['04 / ИНЕРЦИЯ', -5.4, 3.4, 3.4],
      ['05 / НЬЮТОН', 6.1, 9.6, 3.5],
    ] as const) {
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
      dummy.position.set(-11.8 + j / 15 * 23.6, .025, side * 9.65); dummy.rotation.set(0, 0, 0); dummy.scale.set(.045, .05, .045); dummy.updateMatrix(); fasteners.setMatrixAt(i, dummy.matrix);
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
      if (p.kind === 'ball' || p.kind === 'pendulum' || p.kind === 'cradle') piece(root, sphere, steel, 0, 0, 0, p.size[0] / 2, p.size[0] / 2, p.size[0] / 2);
      else {
        piece(root, cube, colors[p.color], 0, 0, 0, ...p.size);
        if (p.kind === 'rotor') {
          piece(root, cube, colors[5], 0, 0, 0, .2, .18, 1.9);
          for (const [x, z, color] of [[.83, 0, 0], [-.83, 0, 1], [0, .83, 2], [0, -.83, 3]]) piece(root, cube, colors[color], x, .1, z, .34, .7, .34);
        } else for (const z of [-1, 1]) piece(root, cylinder, colors[5], 0, .1, z, .32, .07, .32);
      }
      if (p.anchor) {
        const a = p.anchor;
        if (p.kind === 'pendulum' || p.kind === 'cradle') {
          const wire = piece(scene, cylinder, colors[5], 0, 0, 0, .023, 1, .023); wires.push({ part: p, object: wire });
          for (const offset of [-.65, .65]) piece(scene, cylinder, colors[5], a.x, a.y / 2, a.z + offset, .055, a.y, .055);
          piece(scene, cube, colors[5], a.x, a.y, a.z, .12, .12, 1.5);
        } else piece(scene, cylinder, steel, a.x, a.y / 2, a.z, .15, a.y, .15);
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
      camera.lookAt(target); const half = Math.max(13, 15.4 / (c.width / c.height)) / orbit.zoom;
      camera.left = -half * c.width / c.height; camera.right = -camera.left; camera.top = half; camera.bottom = -half; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    };
    function updateObjects() {
      dominoParts.forEach((p, i) => {
        dummy.position.copy(p.body.position); dummy.quaternion.copy(p.body.quaternion); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); dominos.setMatrixAt(i, dummy.matrix);
        dominos.setColorAt(i, (p === hovered ? highlightColors : normalColors)[p.color]);
        dotParent.position.copy(p.body.position); dotParent.quaternion.copy(p.body.quaternion);
        for (let j = 0; j < 4; j++) {
          dotLocal.position.set(.055, j < 2 ? -.23 : .23, j % 2 ? -.13 : .13); dotLocal.scale.set(.035, .035, 1); dotParent.updateMatrixWorld(true);
          dots.setMatrixAt(i * 4 + j, dotLocal.matrixWorld);
        }
      });
      dominos.instanceMatrix.needsUpdate = dots.instanceMatrix.needsUpdate = true; if (dominos.instanceColor) dominos.instanceColor.needsUpdate = true;
      dominos.computeBoundingSphere();
      for (const [p, root] of movable) { root.position.copy(p.body.position); root.quaternion.copy(p.body.quaternion); }
      for (const { part: p, object } of wires) {
        const a = p.anchor!; wireVector.set(a.x - p.body.position.x, a.y - p.body.position.y, a.z - p.body.position.z);
        object.position.set((a.x + p.body.position.x) / 2, (a.y + p.body.position.y) / 2, (a.z + p.body.position.z) / 2);
        object.scale.set(.023, wireVector.length(), .023); object.quaternion.setFromUnitVectors(axisY, wireVector.normalize());
      }
      scene.updateMatrixWorld();
    }
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
            if (pointer.rawX < 174 && pointer.rawY > 76 && pointer.rawY < 108) sim.push(0);
            else if (hovered) sim.push(sim.dynamic.indexOf(hovered));
          }
        }
        renderer.toneMappingExposure = Math.max(.5, Math.min(1.7, c.params.intensity * 1.1));
      },
      draw(g) {
        if (lost) { g.fillStyle = '#112332'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#fff'; g.fillText('Графический контекст потерян. Откройте сцену заново.', 20, 40); return; }
        renderer.render(scene, camera); g.drawImage(renderer.domElement, 0, 0, c.width, c.height);
        g.fillStyle = '#efe5cf'; g.textAlign = 'left'; g.font = `600 ${c.width < 600 ? 18 : 25}px system-ui`; g.fillText('ИМПУЛЬС II / ВИНТОВАЯ МАСТЕРСКАЯ', 22, 36, c.width - 44);
        g.fillStyle = '#b2c7d2'; g.font = '12px system-ui'; g.fillText(`${dominoParts.length} домино · столкновения и шарниры · толчков: ${sim.pushes}`, 23, 59, c.width - 46);
        g.fillStyle = '#244654'; g.beginPath(); g.roundRect(22, 76, 150, 32, 8); g.fill(); g.fillStyle = '#ffe1a0'; g.fillText('↗ Толкнуть начало', 36, 97);
        orbit.draw(g);
        g.textAlign = 'center'; g.fillStyle = '#cbdae1'; g.font = '12px system-ui';
        g.fillText('Клик — толчок · тянуть — поворот · колесо — зум · Shift + тянуть — сдвиг камеры', c.width / 2, c.height - 65, c.width - 32);
      },
      dispose() {
        window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); window.removeEventListener('blur', blur);
        orbit.dispose(); sim.dispose(); renderer.domElement.removeEventListener('webglcontextlost', onLost); renderer.domElement.removeEventListener('webglcontextrestored', onRestored);
        staticBoxes.dispose(); dominos.dispose(); dots.dispose(); columns.dispose(); fasteners.dispose(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); environment.dispose(); light.shadow.map?.dispose(); renderer.dispose(); renderer.forceContextLoss();
      },
    };
  },
};
