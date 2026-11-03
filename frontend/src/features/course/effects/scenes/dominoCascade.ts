import {
  ACESFilmicToneMapping, BoxGeometry, BufferGeometry, CanvasTexture, CatmullRomCurve3, Color,
  CylinderGeometry, DirectionalLight, Group, HemisphereLight, InstancedMesh, Matrix4, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Object3D, OrthographicCamera, PCFSoftShadowMap,
  PlaneGeometry, PMREMGenerator, Raycaster, RingGeometry, Scene, SphereGeometry, TorusGeometry,
  SRGBColorSpace, TubeGeometry, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { CanvasSceneDef } from './types';
import { createCascade, type CascadeNode } from './dominoCascadeState';

const COLORS = ['#ef795f', '#5ec8be', '#e9bd63', '#92a6e4'];
const NAMES = { domino: 'Домино', ball: 'Шар на рельсах', lever: 'Качели', pendulum: 'Маятник', rotor: 'Разветвитель', bell: 'Финальный гонг' };

export const DOMINO_CASCADE: CanvasSceneDef = {
  kind: 'canvas', id: 'domino-cascade', label: 'Мастерская импульсов · домино и механизмы',
  palettes: [['#122432', ...COLORS]], pixelRatioCap: 2, warmupFrames: 1,
  defaultParams: { speed: 1, react: 1, intensity: 1 },
  create(c) {
    const sim = createCascade();
    const renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(c.dpr, 1.5, Math.sqrt(1_800_000 / (c.width * c.height))));
    renderer.setSize(c.width, c.height, false);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
    const scene = new Scene(); scene.background = new Color('#10212f');
    const aspect = c.width / c.height, halfY = Math.max(10.5, 14.8 / aspect);
    const camera = new OrthographicCamera(-halfY * aspect, halfY * aspect, halfY, -halfY, .1, 100);
    camera.position.set(8, 24, 26); camera.lookAt(0, 0, .2); camera.updateMatrixWorld();
    const pmrem = new PMREMGenerator(renderer), room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, .04); scene.environment = environment.texture;
    room.dispose(); pmrem.dispose();
    scene.add(new HemisphereLight('#d2eaf8', '#44372f', 1.7));
    const key = new DirectionalLight('#fff0db', 3.8); key.position.set(-9, 16, 8);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -18, right: 18, top: 16, bottom: -16, near: 1, far: 55 });
    key.shadow.bias = -.0003; key.shadow.normalBias = .025; scene.add(key);
    const rim = new DirectionalLight('#a9d9ff', 2.1); rim.position.set(10, 8, -12); scene.add(rim);
    const geometries = new Set<BufferGeometry>();
    const materials = new Set<MeshStandardMaterial | MeshBasicMaterial>();
    function material(color: string, metalness = 0, roughness = .4) {
      const m = new MeshStandardMaterial({ color, metalness, roughness }); materials.add(m); return m;
    }
    const navy = material('#213b49', .3), brass = material('#cfa96c', .8, .24);
    const enamel = COLORS.map(color => material(color, .18, .27));
    const dark = material('#111e29', .2), ivory = material('#f5eada', .12, .28);
    const steel = material('#bacbd0', .88, .22);
    function geometry<T extends BufferGeometry>(g: T) { geometries.add(g); return g; }
    function mesh(g: BufferGeometry, m: MeshStandardMaterial | MeshBasicMaterial, parent: Object3D, x = 0, y = 0, z = 0) {
      const object = new Mesh(g, m); object.position.set(x, y, z); object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
    }
    const box = geometry(new BoxGeometry(1, 1, 1));
    const sphere = geometry(new SphereGeometry(1, 24, 16));
    const cylinder = geometry(new CylinderGeometry(1, 1, 1, 24));
    function block(parent: Object3D, m: MeshStandardMaterial, x: number, y: number, z: number, w: number, h: number, d: number) {
      const o = mesh(box, m, parent, x, y, z); o.scale.set(w, h, d); return o;
    }
    function rod(parent: Object3D, a: Vector3, b: Vector3, radius = .06, m = brass) {
      const o = mesh(cylinder, m, parent); o.position.copy(a).add(b).multiplyScalar(.5);
      o.scale.set(radius, a.distanceTo(b), radius); o.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize()); return o;
    }
    const board = mesh(geometry(new RoundedBoxGeometry(25, .65, 17.5, 3, .22)), navy, scene, 0, -.4, 0);
    board.receiveShadow = true;
    block(scene, brass, 0, -.73, 0, 24.4, .07, 16.9);
    for (const x of [-10, 10]) for (const z of [-6.5, 6.5]) {
      const foot = mesh(cylinder, dark, scene, x, -1.1, z); foot.scale.set(.65, .7, .65);
    }
    const floor = mesh(geometry(new PlaneGeometry(200, 200)), material('#122432', .08, .8), scene, 0, -1.5, 0);
    floor.rotation.x = -Math.PI / 2; floor.castShadow = false;

    // One baked print for route inlays, fine grid, stage labels and screw sockets.
    const print = document.createElement('canvas'); print.width = 2048; print.height = 1434;
    const ink = print.getContext('2d')!;
    ink.fillStyle = '#213b49'; ink.fillRect(0, 0, print.width, print.height);
    const px = (x: number) => (x + 12.5) / 25 * print.width;
    const pz = (z: number) => (z + 8.75) / 17.5 * print.height;
    ink.strokeStyle = '#7299a51b'; ink.lineWidth = 1;
    for (let x = -12; x <= 12; x += .5) { ink.beginPath(); ink.moveTo(px(x), 0); ink.lineTo(px(x), print.height); ink.stroke(); }
    for (let z = -8; z <= 8; z += .5) { ink.beginPath(); ink.moveTo(0, pz(z)); ink.lineTo(print.width, pz(z)); ink.stroke(); }
    for (const n of sim.nodes) for (const id of n.next) {
      const next = sim.nodes[id]; ink.strokeStyle = COLORS[n.lane] + '45'; ink.lineWidth = 5;
      ink.beginPath(); ink.moveTo(px(n.endX), pz(n.endZ)); ink.lineTo(px(next.x), pz(next.z)); ink.stroke();
    }
    ink.font = '500 23px sans-serif'; ink.fillStyle = '#b9ccd1';
    for (const [text, x, z] of [['01  /  FIRST TOUCH', -10, -7.5], ['02  /  LEVER & PENDULUM', -5, -3.8], ['03  /  TWO WAYS', -.3, 4.2], ['04  /  GRAND FINALE', -5, 7.6]] as const) ink.fillText(text, px(x), pz(z));
    ink.strokeStyle = '#d6b47666'; ink.lineWidth = 3; ink.strokeRect(30, 30, print.width - 60, print.height - 60);
    const printTexture = new CanvasTexture(print); printTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    printTexture.colorSpace = SRGBColorSpace;
    const printMaterial = material('#ffffff', .16, .65); printMaterial.map = printTexture;
    const top = mesh(geometry(new PlaneGeometry(24.8, 17.3)), printMaterial, scene, 0, -.065, 0); top.rotation.x = -Math.PI / 2; top.castShadow = false;
    for (const x of [-11.8, 11.8]) for (const z of [-8, 8]) {
      const screw = mesh(cylinder, brass, scene, x, -.015, z); screw.scale.set(.12, .06, .12);
      block(scene, dark, x, .02, z, .13, .015, .025);
    }

    const dominoNodes = sim.nodes.filter(n => n.kind === 'domino');
    const bodyMaterial = material('#ffffff', .22, .26);
    const bodies = new InstancedMesh(geometry(new RoundedBoxGeometry(.19, 1.12, .57, 2, .045)), bodyMaterial, dominoNodes.length);
    bodies.castShadow = bodies.receiveShadow = true; scene.add(bodies);
    const pips = new InstancedMesh(sphere, ivory, dominoNodes.length * 6); scene.add(pips);
    const bands = new InstancedMesh(box, brass, dominoNodes.length); scene.add(bands);
    const dummy = new Object3D(), local = new Object3D(), matrix = new Matrix4(), composed = new Matrix4();
    for (let i = 0; i < dominoNodes.length; i++) bodies.setColorAt(i, new Color(COLORS[dominoNodes[i].lane]));
    const moving = new Map<number, { root: Group; animate: (n: CascadeNode) => void }>();
    const pickables: Object3D[] = [bodies];
    const haloMaterial = new MeshBasicMaterial({ color: '#fff0bc', transparent: true, opacity: .8, depthWrite: false }); materials.add(haloMaterial);
    const halo = mesh(geometry(new RingGeometry(.65, .7, 48)), haloMaterial, scene, 0, .03, 0); halo.rotation.x = -Math.PI / 2; halo.visible = false;
    const pulseMaterial = new MeshBasicMaterial({ color: '#ffd496', transparent: true, opacity: .28, depthWrite: false }); materials.add(pulseMaterial);
    const pulses = new InstancedMesh(geometry(new RingGeometry(.9, 1, 32)), pulseMaterial, 24); pulses.count = 0; scene.add(pulses);
    for (const n of sim.nodes.filter(n => n.kind !== 'domino')) {
      const root = new Group(); root.userData.nodeId = n.id; scene.add(root); pickables.push(root);
      root.position.set(n.x, 0, n.z);
      const plinth = mesh(geometry(new RoundedBoxGeometry(n.kind === 'ball' ? 1 : 2.7, .15, n.kind === 'ball' ? 1 : 2, 2, .1)), dark, root, 0, .02, 0);
      plinth.receiveShadow = true;
      let animate: (n: CascadeNode) => void;
      if (n.kind === 'ball') {
        const curve = new CatmullRomCurve3([new Vector3(0, .76, 0), new Vector3(1.5, .65, .8), new Vector3(1.8, .48, 2.4), new Vector3(0, .36, 4)]);
        for (const offset of [-.2, .2]) {
          const rail = new CatmullRomCurve3(curve.getPoints(80).map(p => p.add(new Vector3(offset, -.24, 0))));
          mesh(geometry(new TubeGeometry(rail, 80, .055, 8, false)), brass, root);
        }
        for (const t of [.04, .28, .55, .8, .98]) {
          const p = curve.getPoint(t); rod(root, new Vector3(p.x, .08, p.z), new Vector3(p.x, p.y - .25, p.z), .07, steel);
          block(root, navy, p.x, .04, p.z, .7, .08, .35);
        }
        const ball = mesh(sphere, steel, root); ball.scale.setScalar(.33);
        const ring = mesh(geometry(new TorusGeometry(1.005, .065, 8, 24)), enamel[n.lane], ball);
        ring.rotation.x = .7;
        animate = state => { ball.position.copy(curve.getPoint(Math.min(1, state.q))); ball.rotation.z = -state.q * 15; };
      } else if (n.kind === 'lever') {
        const fulcrum = mesh(geometry(new CylinderGeometry(.1, .6, .7, 3)), brass, root, 0, .42, 0); fulcrum.rotation.y = Math.PI / 2;
        const pivot = new Group(); pivot.position.y = .85; root.add(pivot);
        mesh(geometry(new RoundedBoxGeometry(3, .18, .65, 2, .08)), enamel[1], pivot);
        for (const x of [-1.25, 1.25]) { const pad = mesh(cylinder, brass, pivot, x, .16, 0); pad.scale.set(.31, .15, .31); }
        rod(root, new Vector3(0, .85, -.62), new Vector3(0, .85, .62), .13, steel);
        animate = state => { pivot.rotation.z = .32 - Math.min(1, state.q) * .64; };
      } else if (n.kind === 'pendulum') {
        // Swing along z to carry the turn into the next row.
        for (const x of [-.8, .8]) rod(root, new Vector3(x, .1, 1), new Vector3(x, 3, 1), .09);
        rod(root, new Vector3(-1, 3, 1), new Vector3(1, 3, 1), .12);
        const pivot = new Group(); pivot.position.set(.5, 2.9, 1); root.add(pivot);
        rod(pivot, new Vector3(), new Vector3(0, -2.4, 0), .045, steel);
        const bob = mesh(sphere, enamel[1], pivot, 0, -2.4, 0); bob.scale.setScalar(.42);
        const collar = mesh(geometry(new TorusGeometry(1.01, .08, 8, 24)), brass, bob); collar.rotation.x = Math.PI / 2;
        animate = state => { pivot.rotation.x = -(state.q - 1); };
      } else if (n.kind === 'rotor') {
        const spindle = mesh(cylinder, steel, root, 0, .7, 0); spindle.scale.set(.17, 1.3, .17);
        const wheel = new Group(); wheel.position.y = .7; root.add(wheel);
        for (let j = 0; j < 4; j++) {
          const arm = new Group(); arm.rotation.y = j * Math.PI / 2; wheel.add(arm);
          block(arm, brass, .65, 0, 0, 1.3, .1, .13);
          mesh(geometry(new RoundedBoxGeometry(.19, .85, .5, 2, .06)), enamel[j], arm, 1.05, .15, 0);
        }
        const cap = mesh(sphere, brass, root, 0, 1.42, 0); cap.scale.setScalar(.23);
        animate = state => { wheel.rotation.y = state.q; };
      } else {
        for (const x of [-1, 1]) rod(root, new Vector3(x, .08, 0), new Vector3(x, 2.7, 0), .09);
        rod(root, new Vector3(-1.15, 2.7, 0), new Vector3(1.15, 2.7, 0), .1);
        const gong = new Group(); gong.position.y = 1.65; root.add(gong);
        const disk = mesh(cylinder, brass, gong); disk.scale.set(.85, .09, .85); disk.rotation.x = Math.PI / 2;
        const center = mesh(sphere, brass, gong, 0, 0, .08); center.scale.set(.27, .27, .12);
        mesh(geometry(new TorusGeometry(.75, .025, 8, 48)), steel, gong, 0, 0, .06);
        animate = state => { gong.rotation.x = state.active ? Math.sin(state.age * 18) * .15 * Math.exp(-state.age * .4) : 0; };
      }
      moving.set(n.id, { root, animate });
    }
    const raycaster = new Raycaster(), mouse = new Vector2();
    let selected = -1, pointerX = -1, pointerY = -1, lost = false, autoStart = true;
    let resetAt = Infinity;
    const onLost = (e: Event) => { e.preventDefault(); lost = true; console.warn('Domino cascade: graphics context lost'); };
    const onRestored = () => { lost = false; };
    renderer.domElement.addEventListener('webglcontextlost', onLost); renderer.domElement.addEventListener('webglcontextrestored', onRestored);
    function updateModels() {
      for (let i = 0; i < dominoNodes.length; i++) {
        const n = dominoNodes[i], next = sim.nodes[n.next[0]];
        dummy.position.set(n.x, .01, n.z); dummy.rotation.set(0, -Math.atan2(next.z - n.z, next.x - n.x), 0); dummy.updateMatrix();
        local.position.set(0, 0, 0); local.rotation.set(0, 0, -n.q); local.scale.set(1, 1, 1); local.updateMatrix();
        matrix.multiplyMatrices(dummy.matrix, local.matrix);
        local.position.set(0, .56, 0); local.rotation.set(0, 0, 0); local.updateMatrix();
        bodies.setMatrixAt(i, composed.multiplyMatrices(matrix, local.matrix));
        for (let j = 0; j < 6; j++) {
          local.position.set(-.101, .23 + Math.floor(j / 2) * .3, j % 2 ? -.14 : .14);
          local.scale.set(.012, .043, .043); local.updateMatrix();
          pips.setMatrixAt(i * 6 + j, composed.multiplyMatrices(matrix, local.matrix));
        }
        local.position.set(.101, .56, 0); local.scale.set(.012, .028, .44); local.updateMatrix();
        bands.setMatrixAt(i, composed.multiplyMatrices(matrix, local.matrix));
      }
      bodies.instanceMatrix.needsUpdate = pips.instanceMatrix.needsUpdate = bands.instanceMatrix.needsUpdate = true;
      for (const n of sim.nodes) moving.get(n.id)?.animate(n);
      let pulseCount = 0;
      for (const n of sim.nodes) {
        if (!n.active || n.age > .55 || pulseCount >= 24) continue;
        local.position.set(n.x, .025, n.z); local.rotation.set(-Math.PI / 2, 0, 0);
        local.scale.setScalar(.18 + n.age * 1.1); local.updateMatrix(); pulses.setMatrixAt(pulseCount++, local.matrix);
      }
      pulses.count = pulseCount; pulses.instanceMatrix.needsUpdate = true;
      scene.updateMatrixWorld();
    }
    updateModels(); bodies.computeBoundingSphere();
    return {
      update(dt, _t, pointer) {
        sim.update(dt);
        if (autoStart && !sim.started && sim.time > 2.5) { sim.trigger(0); autoStart = false; }
        updateModels();
        if (pointer.active) {
          pointerX = pointer.rawX; pointerY = pointer.rawY;
          mouse.set(pointerX / c.width * 2 - 1, 1 - pointerY / c.height * 2);
          raycaster.setFromCamera(mouse, camera);
          const hit = raycaster.intersectObjects(pickables, true)[0]; selected = -1;
          if (hit) {
            if (hit.object === bodies && hit.instanceId !== undefined) selected = dominoNodes[hit.instanceId].id;
            else { let o: Object3D | null = hit.object; while (o && o.userData.nodeId === undefined) o = o.parent; selected = o?.userData.nodeId ?? -1; }
          }
          if (pointer.clicked) {
            if (pointerY >= 71 && pointerY <= 100 && pointerX >= c.width - 120 && pointerX <= c.width - 22) { sim.reset(); autoStart = false; resetAt = 0; }
            else if (selected >= 0) { sim.trigger(selected); autoStart = false; }
          }
        } else selected = -1;
        halo.visible = selected >= 0;
        if (selected >= 0) { const n = sim.nodes[selected]; halo.position.set(n.x, .03, n.z); }
        resetAt += dt;
        renderer.toneMappingExposure = Math.max(.5, Math.min(1.6, c.params.intensity * 1.15));
      },
      draw(g) {
        if (lost) { g.fillStyle = '#122432'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#fff'; g.fillText('Графический контекст потерян. Перезапустите сцену.', 20, 40); return; }
        renderer.render(scene, camera); g.drawImage(renderer.domElement, 0, 0, c.width, c.height);
        const compact = c.width < 600;
        g.textAlign = 'left'; g.fillStyle = '#e9dfca'; g.font = `600 ${compact ? 17 : 25}px system-ui`;
        g.fillText('МАСТЕРСКАЯ ИМПУЛЬСОВ', 24, 39);
        g.font = `${compact ? 10 : 12}px system-ui`; g.fillStyle = '#9eb8c8';
        g.fillText(`${sim.nodes.filter(n => n.fired).length} / ${sim.nodes.length} звеньев · домино / шар / рычаг / маятник`, 24, 61);
        g.fillStyle = '#234251'; g.beginPath(); g.roundRect(c.width - 120, 71, 98, 29, 8); g.fill();
        g.fillStyle = '#e3d4b5'; g.textAlign = 'center'; g.font = '12px system-ui'; g.fillText('↻ Собрать', c.width - 71, 90);
        g.fillStyle = '#b8cad4'; g.font = `${compact ? 11 : 13}px system-ui`;
        g.fillText('Нажмите на любую деталь. Повторный клик по упавшей — новый каскад отсюда.', c.width / 2, c.height - 63, c.width - 40);
        if (selected >= 0) {
          const n = sim.nodes[selected]; g.fillStyle = '#ffe1a5'; g.font = '13px system-ui';
          g.fillText(`${NAMES[n.kind]} · ${n.fired ? 'перезапустить участок' : 'подтолкнуть'}`, Math.max(140, Math.min(c.width - 140, pointerX)), Math.max(125, pointerY - 24));
        } else if (resetAt < 1.8) { g.fillStyle = '#ffe1a5'; g.fillText('Всё собрано — выберите любую деталь', c.width / 2, c.height - 88); }
      },
      dispose() {
        renderer.domElement.removeEventListener('webglcontextlost', onLost); renderer.domElement.removeEventListener('webglcontextrestored', onRestored);
        for (const g of geometries) g.dispose(); for (const m of materials) m.dispose();
        bodies.dispose(); pips.dispose(); bands.dispose(); pulses.dispose(); printTexture.dispose(); environment.dispose();
        key.shadow.map?.dispose(); renderer.dispose(); renderer.forceContextLoss(); print.width = print.height = 1;
      },
    };
  },
};
