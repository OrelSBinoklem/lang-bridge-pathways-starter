import {
  ACESFilmicToneMapping, AdditiveBlending, BoxGeometry, BufferGeometry, Float32BufferAttribute, CanvasTexture, Color, CylinderGeometry,
  DirectionalLight, DoubleSide, Group, HemisphereLight, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  Object3D, PerspectiveCamera, PlaneGeometry, PMREMGenerator, Scene, SphereGeometry, SRGBColorSpace, TorusGeometry, Vector3, WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createSkylinePinball, SKYLINE_RADIUS, type SkylinePart } from './pinballSkylinePhysics';
import type { ScenePointer } from './types';
import { skylinePinballLayout } from './pinballSkylineLayout';

const COLORS = ['#ff4e9c', '#39dbfa', '#ffc353'];
const RGB: [number, number, number][] = [[1, .08, .35], [.08, .8, 1], [1, .6, .06]];

export function createPinballSkylineRenderer(width: number, height: number, onHit: (color: [number, number, number]) => void, expanded = false) {
  const rect = skylinePinballLayout(width, height, expanded);
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(1.75, Math.sqrt(750_000 / (rect.width * rect.height))));
  renderer.setSize(rect.width, rect.height, false); renderer.setClearColor('#000000', 0);
  renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = false;
  const scene = new Scene(), root = new Group(); scene.add(root);
  const camera = new PerspectiveCamera(38, rect.width / rect.height, .1, 100);
  const geometries: BufferGeometry[] = [], materials: (MeshStandardMaterial | MeshBasicMaterial)[] = [], textures: CanvasTexture[] = [];
  const geo = <T extends BufferGeometry>(g: T) => { geometries.push(g); return g; };
  const mat = (color: string, metalness = .3, roughness = .34) => { const m = new MeshStandardMaterial({ color, metalness, roughness }); materials.push(m); return m; };
  const steel = mat('#b6cad6', .92, .22), dark = mat('#101e30', .5, .35), rubber = mat('#24212f', .05, .55), brass = mat('#e8b74c', .85, .3);
  const decks = COLORS.map(c => { const m = mat(c, .55, .27); m.color.multiplyScalar(.55); m.side = DoubleSide; return m; });
  const clearRail = mat('#a4dbed', .05, .24); clearRail.transparent = true; clearRail.opacity = .22; clearRail.depthWrite = false;
  const glows = COLORS.map(c => { const m = mat(c, .25, .3); m.emissive.set(c); m.emissiveIntensity = .6; return m; });
  const brushCanvas = document.createElement('canvas'); brushCanvas.width = 256; brushCanvas.height = 128;
  const bgx = brushCanvas.getContext('2d')!, pixels = bgx.createImageData(256, 128); let brushSeed = 12345;
  for (let y = 0; y < 128; y++) for (let x = 0; x < 256; x++) {
    brushSeed = (Math.imul(brushSeed, 1664525) + 1013904223) >>> 0;
    const value = 105 + Math.sin(y * 2.1) * 24 + (brushSeed / 4294967296 - .5) * 12, index = (y * 256 + x) * 4;
    pixels.data[index] = pixels.data[index + 1] = pixels.data[index + 2] = value; pixels.data[index + 3] = 255;
  }
  bgx.putImageData(pixels, 0, 0); const brushed = new CanvasTexture(brushCanvas); textures.push(brushed);
  for (const material of [steel, brass, ...decks]) { material.roughnessMap = brushed; material.bumpMap = brushed; material.bumpScale = .006; }
  const cube = geo(new BoxGeometry(1, 1, 1)), sphere = geo(new SphereGeometry(1, 20, 14));
  const cylinder = geo(new CylinderGeometry(1, 1, 1, 12)), torus = geo(new TorusGeometry(1, .085, 6, 32));
  const dummy = new Object3D();
  const addMesh = (geometry: BufferGeometry, material: MeshStandardMaterial | MeshBasicMaterial, x: number, y: number, z: number, sx = 1, sy = sx, sz = sx, parent = root) => {
    const m = new Mesh(geometry, material); m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m;
  };
  const sparks: { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; color: number }[] = [];
  const flashes = [0, 0, 0]; let jackpot = 0;
  const sim = createSkylinePinball(event => {
    if (event.kind === 'bumper') flashes[event.color] = 1;
    if (event.kind === 'multiball') jackpot = 2.5;
    if (event.kind !== 'ramp') {
      onHit(RGB[event.color]);
      for (let i = 0; i < 10 && sparks.length < 80; i++) {
        const a = i * Math.PI / 5;
        sparks.push({ x: event.x, y: event.y + .2, z: event.z, vx: Math.cos(a) * .8, vy: .8 + (i % 3) * .15, vz: Math.sin(a) * .8, life: .55, color: event.color });
      }
    }
  });

  // Reflection environment is evaluated once; no screen-space transmission, ray tracing or live shadow pass.
  const pmrem = new PMREMGenerator(renderer), room = new RoomEnvironment(), env = pmrem.fromScene(room, .03);
  scene.environment = env.texture; room.dispose(); pmrem.dispose();
  scene.add(new HemisphereLight('#d6ecff', '#24304c', 1.6));
  const key = new DirectionalLight('#fff1dd', 2.5); key.position.set(-4, 9, 5); scene.add(key);
  const rim = new DirectionalLight('#82c5ff', 2); rim.position.set(5, 5, -3); scene.add(rim);
  const shell = geo(new RoundedBoxGeometry(4.96, .72, 8.83, 2, .12)); addMesh(shell, dark, 0, -.40, 0);
  const trim = geo(new RoundedBoxGeometry(5.0, .10, 8.88, 2, .04)); addMesh(trim, steel, 0, -.06, 0);
  addMesh(cube, dark, 0, -.04, 0, 4.65, .08, 8.42);
  for (const x of [-2.25, 2.25]) for (const z of [-3.8, 3.8]) {
    addMesh(cylinder, rubber, x, -.86, z, .17, .3, .17);
    addMesh(cylinder, steel, x, -.61, z, .09, .28, .09);
  }
  const art = document.createElement('canvas'); art.width = 768; art.height = 1400;
  const a = art.getContext('2d')!;
  const bg = a.createLinearGradient(0, 0, 768, 1400); bg.addColorStop(0, '#172a3a'); bg.addColorStop(.5, '#14172d'); bg.addColorStop(1, '#22152d'); a.fillStyle = bg; a.fillRect(0, 0, 768, 1400);
  const ax = (x: number) => (x / 4.65 + .5) * 768, az = (z: number) => (z / 8.4 + .5) * 1400;
  for (let i = 0; i < 32; i++) { a.strokeStyle = i % 4 ? '#27334b' : '#33506a'; a.lineWidth = i % 4 ? 1 : 2; a.beginPath(); a.moveTo(0, i * 44); a.lineTo(768, i * 44); a.stroke(); }
  for (let i = 0; i < 18; i++) { a.strokeStyle = '#2a3550'; a.beginPath(); a.moveTo(i * 45, 0); a.lineTo(i * 45, 1400); a.stroke(); }
  for (const route of sim.routes) { a.strokeStyle = '#04061088'; a.lineWidth = route.width / 4.65 * 768 + 18; a.lineJoin = 'round'; a.beginPath(); route.samples.forEach((p, i) => i ? a.lineTo(ax(p.x), az(p.z)) : a.moveTo(ax(p.x), az(p.z))); a.stroke(); }
  for (const b of sim.bumpers) { const p = b.body.position; const glow = a.createRadialGradient(ax(p.x), az(p.z), 2, ax(p.x), az(p.z), 95); glow.addColorStop(0, COLORS[b.color] + '66'); glow.addColorStop(.5, '#00000022'); glow.addColorStop(1, '#00000000'); a.fillStyle = glow; a.fillRect(ax(p.x) - 95, az(p.z) - 95, 190, 190); }
  a.textAlign = 'center'; a.fillStyle = '#7476aa'; a.font = '800 54px sans-serif'; a.fillText('SKYLINE', 384, 1080); a.font = '600 20px monospace'; a.fillText('CHROMA / GRAVITY WORKS', 384, 1115);
  const artTexture = new CanvasTexture(art); artTexture.colorSpace = SRGBColorSpace; textures.push(artTexture);
  const artMat = mat('#ffffff', .15, .5); artMat.map = artTexture;
  const floorPrint = addMesh(geo(new PlaneGeometry(4.65, 8.4)), artMat, 0, .003, 0); floorPrint.rotation.x = -Math.PI / 2;

  const batch = (parts: SkylinePart[], material: MeshStandardMaterial, kind = 'box') => {
    const m = new InstancedMesh(kind === 'wire' ? cylinder : cube, material, parts.length); root.add(m);
    parts.forEach((p, i) => {
      dummy.position.copy(p.body.position); dummy.quaternion.copy(p.body.quaternion);
      if (kind === 'wire') {
        const up = new Vector3(0, p.size[1] / 2, 0).applyQuaternion(dummy.quaternion); dummy.position.add(up);
        dummy.rotateX(Math.PI / 2); dummy.scale.set(.025, p.size[2], .025);
      } else dummy.scale.set(...p.size);
      dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); return m;
  };
  batch(sim.parts.filter(p => p.kind === 'rail'), steel);
  const hullGeometry = (p: SkylinePart) => {
    const vertices: number[] = [];
    for (const face of p.hull!.faces) for (let i = 1; i < face.length - 1; i++) for (const index of [face[0], face[i], face[i + 1]]) {
      const v = new Vector3(...p.hull!.vertices[index]).applyQuaternion(p.body.quaternion).add(p.body.position); vertices.push(v.x, v.y, v.z);
    }
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(vertices, 3)); g.computeVertexNormals(); return g;
  };
  const skirtGeometry = sim.parts.filter(p => p.kind === 'skirt').map(hullGeometry);
  const skirts = mergeGeometries(skirtGeometry); if (skirts) root.add(new Mesh(geo(skirts), dark)); for (const g of skirtGeometry) g.dispose();
  for (let color = 0; color < 3; color++) {
    const pieces = sim.parts.filter(p => p.kind === 'ramp' && p.hull && p.color === color).map(hullGeometry);
    if (pieces.length) { const merged = mergeGeometries(pieces); if (merged) root.add(new Mesh(geo(merged), decks[color])); }
    for (const g of pieces) g.dispose();
    batch(sim.parts.filter(p => p.kind === 'wire' && p.color === color), clearRail);
  }
  batch(sim.parts.filter(p => p.kind === 'wire'), steel, 'wire');
  const wireDecks = sim.parts.filter(p => p.kind === 'ramp' && p.route === 'return');
  const wireSupports = new InstancedMesh(cylinder, brass, wireDecks.length * 3); root.add(wireSupports);
  wireDecks.forEach((p, i) => [-.20, 0, .20].forEach((offset, j) => {
    dummy.position.copy(p.body.position); dummy.quaternion.copy(p.body.quaternion);
    dummy.position.add(new Vector3(offset, 0, 0).applyQuaternion(dummy.quaternion)); dummy.rotateX(Math.PI / 2);
    dummy.scale.set(.024, p.size[2], .024); dummy.updateMatrix(); wireSupports.setMatrixAt(i * 3 + j, dummy.matrix);
  })); wireSupports.computeBoundingSphere();
  const supports: { x: number; y: number; z: number; height: number }[] = [];
  for (const route of sim.routes) route.samples.forEach((p, i) => { if (i % 5 === 0 && p.y > .22) supports.push({ x: p.x, y: p.y / 2, z: p.z, height: p.y }); });
  const columns = new InstancedMesh(cylinder, steel, supports.length); root.add(columns);
  supports.forEach((p, i) => { dummy.position.set(p.x, p.y, p.z); dummy.quaternion.identity(); dummy.scale.set(.055, p.height, .055); dummy.updateMatrix(); columns.setMatrixAt(i, dummy.matrix); }); columns.computeBoundingSphere();
  const dynamics: { part: SkylinePart; group: Group }[] = [];
  for (const part of [sim.bridge, sim.rotor, ...sim.flippers.map(f => f.part)]) {
    const group = new Group(); root.add(group); dynamics.push({ part, group });
    const isFlipper = part.kind === 'flipper';
    addMesh(geo(new RoundedBoxGeometry(...part.size, 2, .045)), isFlipper ? rubber : brass, isFlipper ? .49 : 0, 0, 0, 1, 1, 1, group);
    if (isFlipper) {
      addMesh(cube, steel, .49, .115, 0, .83, .022, .13, group);
      addMesh(cylinder, steel, 0, .02, 0, .15, .30, .15, group);
    } else if (part.kind === 'bridge') {
      for (const x of [-.31, .31]) addMesh(cube, glows[2], x, .12, 0, .04, .20, 1, group);
      const axle = addMesh(cylinder, steel, 0, -.07, 0, .055, .9, .055, group); axle.rotation.z = Math.PI / 2;
    } else {
      for (const x of [-.43, .43]) addMesh(sphere, glows[2], x, .03, 0, .095, .08, .095, group);
      addMesh(cylinder, steel, 0, 0, 0, .07, .4, .07, group);
    }
  }
  const bumperCaps = sim.bumpers.map((part, i) => {
    const p = part.body.position;
    addMesh(cylinder, rubber, p.x, .16, p.z, .30, .28, .30);
    addMesh(cylinder, steel, p.x, .32, p.z, .30, .08, .30);
    const dome = addMesh(sphere, glows[i], p.x, .36, p.z, .25, .04, .25);
    const ring = addMesh(torus, glows[i], p.x, .33, p.z, .275); ring.rotation.x = Math.PI / 2;
    return dome;
  });
  const targetMeshes = sim.targets.map(({ part }, i) => {
    const group = new Group(); root.add(group); group.position.copy(part.body.position);
    addMesh(cube, steel, 0, 0, 0, .42, .42, .10, group); addMesh(cube, glows[i], 0, 0, .063, .29, .27, .027, group); return group;
  });
  // The scoop sits at floor level, below the raised skyline deck.
  const scoop = addMesh(torus, brass, 1.45, .1, -3.45, .28); scoop.rotation.x = Math.PI / 2;
  addMesh(cylinder, dark, 1.45, .08, -3.45, .24, .1, .24);
  for (let i = 0; i < 7; i++) { const ring = addMesh(torus, glows[2], 1.45, .06 + i * .015, -3.45, .27); ring.rotation.x = Math.PI / 2; }
  const ballMeshes = sim.balls.map(() => addMesh(sphere, steel, 2.02, SKYLINE_RADIUS, 3.5, SKYLINE_RADIUS));

  const lampCanvas = document.createElement('canvas'); lampCanvas.width = lampCanvas.height = 64;
  const lg = lampCanvas.getContext('2d')!, glow = lg.createRadialGradient(32, 32, 0, 32, 32, 32); glow.addColorStop(0, '#ffffff'); glow.addColorStop(.12, '#ffffffa0'); glow.addColorStop(1, '#ffffff00'); lg.fillStyle = glow; lg.fillRect(0, 0, 64, 64);
  const lampTexture = new CanvasTexture(lampCanvas); textures.push(lampTexture);
  const lampMat = new MeshBasicMaterial({ map: lampTexture, transparent: true, blending: AdditiveBlending, depthWrite: false }); materials.push(lampMat);
  const lampPositions = sim.routes.flatMap(route => route.samples.filter((_, i) => i % 2 === 0).map(p => ({ ...p, color: route.color })));
  const lamps = new InstancedMesh(geo(new PlaneGeometry(1, 1)), lampMat, lampPositions.length); lamps.frustumCulled = false; root.add(lamps);
  const particles = new InstancedMesh(sphere, mat('#ffffff', .1, .25), 80); particles.frustumCulled = false; root.add(particles);

  // The DMD is a real panel in the backbox; upload its tiny texture only when the score/mode changes.
  const displayCanvas = document.createElement('canvas'); displayCanvas.width = 768; displayCanvas.height = 192;
  const dg = displayCanvas.getContext('2d')!, displayTexture = new CanvasTexture(displayCanvas); displayTexture.colorSpace = SRGBColorSpace; textures.push(displayTexture);
  const displayMat = new MeshBasicMaterial({ map: displayTexture }); materials.push(displayMat);
  for (const x of [-2.0, 2.0]) addMesh(cylinder, steel, x, .65, -4.42, .055, 1.3, .055);
  const backbox = new Group(); backbox.position.set(0, 1.6, -4.48); backbox.rotation.x = -.35; root.add(backbox);
  addMesh(geo(new RoundedBoxGeometry(4.7, 1.12, .4, 2, .08)), dark, 0, 0, 0, 1, 1, 1, backbox);
  addMesh(geo(new PlaneGeometry(4.32, .88)), displayMat, 0, 0, .211, 1, 1, 1, backbox);
  const center = new Vector3(0, .25, -.1), direction = new Vector3(2.2, 13, 10).normalize();
  camera.position.copy(center).addScaledVector(direction, 20); camera.lookAt(center); camera.updateMatrixWorld();
  const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const tanY = Math.tan(camera.fov * Math.PI / 360), tanX = tanY * camera.aspect;
  let distance = 1;
  const fitPoints: Vector3[] = [];
  for (const x of [-2.51, 2.51]) for (const y of [-1, .12]) for (const z of [-4.45, 4.45]) fitPoints.push(new Vector3(x, y, z));
  for (const x of [-2.36, 2.36]) for (const y of [.9, 2.35]) for (const z of [-4.8, -4.05]) fitPoints.push(new Vector3(x, y, z));
  for (const route of sim.routes) for (const p of route.samples) for (const dx of [-.4, .4]) fitPoints.push(new Vector3(p.x + dx, p.y + .3, p.z));
  for (const point of fitPoints) {
    const corner = point.sub(center), depth = corner.dot(direction);
    distance = Math.max(distance, Math.abs(corner.dot(right)) / tanX + depth, Math.abs(corner.dot(up)) / tanY + depth);
  }
  camera.position.copy(center).addScaledVector(direction, distance * 1.03); camera.lookAt(center); camera.updateMatrixWorld();
  camera.zoom = expanded ? 1 : 1.08; camera.updateProjectionMatrix();
  const wheel = (event: WheelEvent) => {
    if (event.clientX < rect.x || event.clientX > rect.x + rect.width || event.clientY < rect.y || event.clientY > rect.y + rect.height) return;
    event.preventDefault(); camera.zoom = Math.max(.9, Math.min(2.5, camera.zoom * Math.exp(-event.deltaY * .001))); camera.updateProjectionMatrix();
  };
  window.addEventListener('wheel', wheel, { passive: false });
  let lastDisplay = '', lastPressed = false, disposed = false, lastStats = -1;
  const updateDisplay = () => {
    const mode = jackpot > 0 ? 'MULTIBALL / 2 ШАРА' : sim.combo > 1 ? `COMBO ×${sim.combo}` : sim.activeBalls ? 'SKYLINE / HELIX / GRAVITY' : 'НАЖМИ — ПУСК';
    const key = `${sim.score}:${mode}`; if (key === lastDisplay) return; lastDisplay = key;
    dg.fillStyle = '#050b14'; dg.fillRect(0, 0, 768, 192); dg.textAlign = 'center'; dg.fillStyle = '#75e0f1'; dg.font = '700 23px monospace'; dg.fillText('CHROMA / SKYLINE', 384, 32);
    dg.font = '700 79px monospace'; dg.fillStyle = '#d3faff'; dg.fillText(String(sim.score).padStart(7, '0'), 384, 113);
    dg.font = '600 24px sans-serif'; dg.fillStyle = jackpot > 0 ? '#ffcf75' : '#65dabf'; dg.fillText(mode, 384, 166); displayTexture.needsUpdate = true;
  };
  return { rect, sim,
    update(dt: number, p: ScenePointer, enabled: boolean) {
      if (disposed) return false;
      const x = (p.rawX - rect.x) / rect.width, y = (p.rawY - rect.y) / rect.height;
      const inside = enabled && p.active && x >= 0 && x <= 1 && y >= 0 && y <= 1;
      const pressed = inside && p.pressed, step = Math.max(0, Math.min(.05, dt));
      sim.update(step, { launch: inside && (p.clicked || pressed && !lastPressed), nudge: inside && p.clicked && sim.activeBalls > 0, left: pressed && x < .65, right: pressed && x > .35 }); lastPressed = pressed;
      jackpot = Math.max(0, jackpot - step);
      for (let i = 0; i < 3; i++) { flashes[i] = Math.max(0, flashes[i] - step * 3); glows[i].emissiveIntensity = .45 + flashes[i] * 2; bumperCaps[i].scale.y = .04 * (1 - flashes[i] * .22); }
      for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.life -= step; s.x += s.vx * step; s.y += s.vy * step; s.z += s.vz * step; s.vy -= step * 3; if (s.life <= 0) sparks.splice(i, 1); }
      return inside;
    },
    draw(g: CanvasRenderingContext2D) {
      if (disposed) return;
      for (const { part, group } of dynamics) { group.position.copy(part.body.position); group.quaternion.copy(part.body.quaternion); }
      sim.targets.forEach((target, i) => { targetMeshes[i].position.y = target.down ? -.26 : .19; });
      sim.balls.forEach((ball, i) => { ballMeshes[i].visible = ball.active || i === 0 && !sim.activeBalls; ballMeshes[i].position.copy(ball.body.position); ballMeshes[i].quaternion.copy(ball.body.quaternion); });
      lampPositions.forEach((p, i) => {
        const phase = (i * .11 - sim.time * .7) % 1, bright = phase < 0 && phase > -.13;
        dummy.position.set(p.x, p.y + .05, p.z); dummy.quaternion.copy(camera.quaternion); dummy.scale.setScalar(bright ? .22 : .095); dummy.updateMatrix(); lamps.setMatrixAt(i, dummy.matrix);
        lamps.setColorAt(i, new Color(COLORS[p.color]).multiplyScalar(bright ? 1.2 : .32));
      }); lamps.instanceMatrix.needsUpdate = true; if (lamps.instanceColor) lamps.instanceColor.needsUpdate = true;
      for (let i = 0; i < 80; i++) {
        const s = sparks[i]; dummy.position.set(s?.x ?? 0, s?.y ?? 0, s?.z ?? 0); dummy.quaternion.identity(); dummy.scale.setScalar(s ? .032 * s.life / .55 : 0); dummy.updateMatrix(); particles.setMatrixAt(i, dummy.matrix);
        if (s) particles.setColorAt(i, new Color(COLORS[s.color]));
      } particles.instanceMatrix.needsUpdate = true; if (particles.instanceColor) particles.instanceColor.needsUpdate = true;
      updateDisplay(); renderer.render(scene, camera); g.drawImage(renderer.domElement, rect.x, rect.y, rect.width, rect.height);
      g.save(); g.textAlign = 'center'; g.fillStyle = '#a4bdcf'; g.font = '11px sans-serif'; g.fillText('Клик — пуск · держи лопатки · колесо — масштаб', rect.x + rect.width / 2, rect.y + rect.height - 5, rect.width); g.restore();
      if (process.env.NODE_ENV === 'development' && sim.time - lastStats > .5) { lastStats = sim.time; g.canvas.dataset.pinball3d = JSON.stringify({ draws: renderer.info.render.calls, triangles: renderer.info.render.triangles, bodies: sim.world.bodies.length, score: sim.score, balls: sim.activeBalls, heights: sim.balls.map(b => Math.round(b.body.position.y * 100) / 100) }); }
    },
    dispose() {
      if (disposed) return; disposed = true; sim.dispose();
      window.removeEventListener('wheel', wheel);
      for (const geometry of geometries) geometry.dispose(); for (const material of materials) material.dispose(); for (const texture of textures) texture.dispose();
      env.dispose(); renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
