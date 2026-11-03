
import { profileEffectFrame } from '../effectDiagnostics';
import * as THREE from 'three';
import { effectClientPoint } from '../touchAim';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { DEFAULT_VESSEL, HEIGHT, RINGS, PALETTES, drawPattern, drawPlate, type PatternKind, type PatternOptions, type VesselParameters } from './model';
import { ClayPhysics } from './clayPhysics';
import { CLAY_ROWS, CLAY_SIDES, sampleClay } from './clayMesh';

export type PotterySettings = { paused: boolean; focused: boolean; brush: number; speed: number; softness: number; stage: 'clay' | 'paint'; sculptMode: 'narrow' | 'widen'; pattern: PatternKind; palette: number; seed: number; patterned: boolean; reset: number; undo: number; band: number; adjustment: number; shape: VesselParameters; shapeRevision: number; shapeTransaction: number; onShapeChange?: (shape: VesselParameters) => void; patternOptions: PatternOptions };

export function createPottery(canvas: HTMLCanvasElement, settings: PotterySettings) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#172629');
  scene.fog = new THREE.Fog('#172629', 13, 29);
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 50);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .06);
  scene.environment = environment.texture;
  room.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight('#e1f2ee', '#263130', 1.6));
  const key = new THREE.DirectionalLight('#fff0dc', 4);
  key.position.set(-3, 6, 4); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.normalBias = .025;
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 6, bottom: -4, far: 20 });
  scene.add(key);
  const rim = new THREE.DirectionalLight('#a5dfe9', 2.8);
  rim.position.set(4, 3, -3); scene.add(rim);

  const clayColor = '#96654e';
  const brushPoint = { value: new THREE.Vector3() };
  const brushSize = { value: .38 };
  const brushPower = { value: 0 };
  const bareClay = { value: 1 };
  const clay = new THREE.MeshPhysicalMaterial({ color: clayColor, roughness: .58, metalness: 0, clearcoat: .14, clearcoatRoughness: .4 });
  // Fine throwing rings and granular relief live in the material shader, without ray tracing.
  clay.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, { uBrushPoint: brushPoint, uBrushSize: brushSize, uBrushPower: brushPower, uBareClay: bareClay });
    shader.vertexShader = 'attribute vec3 clayRest; varying vec3 vClayRest; varying vec3 vClayWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvClayRest = clayRest; vClayWorld = (modelMatrix * vec4(position, 1.)).xyz;');
    shader.fragmentShader = `varying vec3 vClayRest; varying vec3 vClayWorld; uniform vec3 uBrushPoint; uniform float uBrushSize; uniform float uBrushPower; uniform float uBareClay;
      float clayHash(vec3 p) {
        p = fract(p * .1031); p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }
      float clayNoise(vec3 p) {
        vec3 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
        return mix(mix(mix(clayHash(i), clayHash(i+vec3(1,0,0)), f.x),
          mix(clayHash(i+vec3(0,1,0)), clayHash(i+vec3(1,1,0)), f.x), f.y),
          mix(mix(clayHash(i+vec3(0,0,1)), clayHash(i+vec3(1,0,1)), f.x),
          mix(clayHash(i+vec3(0,1,1)), clayHash(i+vec3(1,1,1)), f.x), f.y), f.z);
      }
      ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float mottling = clayNoise(vClayRest * 12.) - .5;
      float grain = clayNoise(vClayRest * 95.) - .5;
      float detail = 1. - smoothstep(.35, 1.5, length(fwidth(vClayRest * 95.)));
      float rings = sin(vClayRest.y * 120. + mottling * 3.);
      diffuseColor.rgb *= 1. + uBareClay * (.07 * mottling + .035 * grain * detail + .006 * rings);
      float contact = exp(-3. * pow(vClayWorld.y-uBrushPoint.y, 2.) / (uBrushSize*uBrushSize));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.92,.48,.16), contact*uBrushPower*.55);`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
      float relief = uBareClay * (.0018 * mottling + .0013 * grain * detail + .0001 * rings);
      vec3 q0 = dFdx(vViewPosition), q1 = dFdy(vViewPosition);
      vec3 s = cross(q1, normal), t = cross(normal, q0);
      float determinant = dot(q0, s);
      if (abs(determinant) > 1e-12) normal = normalize(abs(determinant) * normal + sign(determinant) * (dFdx(relief) * s + dFdy(relief) * t));`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor + uBareClay * (.12 * mottling + .08 * grain * detail), .05, 1.);`);
  };
  const physics = new ClayPhysics(DEFAULT_VESSEL);
  const profile = physics.profile;
  let currentShape = { ...settings.shape };
  let history: { clay: Float32Array; shape: VesselParameters }[] = [];
  const station = new THREE.Group(); scene.add(station);
  const potGroup = new THREE.Group(); potGroup.position.y = .47; station.add(potGroup);
  const points = () => [new THREE.Vector2(0, 0), ...Array.from(profile, (r, i) => new THREE.Vector2(r, i / RINGS * HEIGHT)), ...Array.from(profile, (r, i) => new THREE.Vector2(r - .14, i / RINGS * HEIGHT)).reverse().slice(0, -3), new THREE.Vector2(0, .12)];
  const geometry = new THREE.LatheGeometry(points(), 96);
  geometry.setAttribute('clayRest', geometry.getAttribute('position').clone());
  const pot = new THREE.Mesh(geometry, clay); pot.castShadow = true; pot.receiveShadow = true; potGroup.add(pot);
  const uv = geometry.getAttribute('uv');
  const pos = geometry.getAttribute('position');
  for (let i = 0; i < uv.count; i++) uv.setY(i, pos.getY(i) / HEIGHT);
  const cursorMaterial = new THREE.MeshBasicMaterial({ color: '#8ee9df', transparent: true, opacity: .85, depthTest: false });
  const cursor = new THREE.Mesh(new THREE.TorusGeometry(1, .028, 8, 48), cursorMaterial);
  cursor.visible = false; cursor.renderOrder = 10; scene.add(cursor);
  const minusMark = new THREE.Mesh(new THREE.BoxGeometry(.65, .09, .01), cursorMaterial);
  const plusMark = new THREE.Mesh(new THREE.BoxGeometry(.09, .65, .01), cursorMaterial);
  minusMark.renderOrder = plusMark.renderOrder = 11; cursor.add(minusMark, plusMark);
  const contactDot = new THREE.Mesh(new THREE.SphereGeometry(.025, 12, 8), cursorMaterial);
  contactDot.visible = false; contactDot.renderOrder = 11; scene.add(contactDot);
  const metal = new THREE.MeshStandardMaterial({ color: '#6a7f81', metalness: .78, roughness: .32 });
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(1.72, 1.77, .16, 96), metal);
  wheel.position.y = .39; wheel.receiveShadow = true; wheel.castShadow = true; station.add(wheel);
  const ringMaterial = new THREE.MeshStandardMaterial({ color: '#aec7c6', metalness: .85, roughness: .3 });
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25 + i * .13, .008, 6, 96), ringMaterial);
    ring.rotation.x = Math.PI / 2; ring.position.y = .085; wheel.add(ring);
  }
  // Asymmetric marks make the wheel's rotation legible even on unpainted clay.
  for (let i = 0; i < 12; i++) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(.07, .006, .13), ringMaterial);
    const a = i * Math.PI / 6; mark.position.set(Math.sin(a) * 1.64, .084, Math.cos(a) * 1.64); mark.rotation.y = a; wheel.add(mark);
  }
  const baseMaterial = new THREE.MeshStandardMaterial({ color: '#254749', roughness: .55, metalness: .25 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.36, .5, 64), baseMaterial);
  base.position.y = .05; base.receiveShadow = true; base.castShadow = true; station.add(base);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: '#294345', roughness: .63 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), floorMaterial);
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.21; floor.receiveShadow = true; scene.add(floor);
  const textureCanvas = document.createElement('canvas'); textureCanvas.width = textureCanvas.height = 1024;
  const texture = new THREE.CanvasTexture(textureCanvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping; texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  // The showcase plate has its own round composition (drawPlate), not the jug's tile.
  const plateCanvas = document.createElement('canvas'); plateCanvas.width = plateCanvas.height = 1024;
  const plateTexture = new THREE.CanvasTexture(plateCanvas); plateTexture.colorSpace = THREE.SRGBColorSpace;
  plateTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const workbench = new THREE.Group(); scene.add(workbench);
  const oak = new THREE.MeshStandardMaterial({ color: '#92745b', roughness: .76 });
  const porcelain = new THREE.MeshPhysicalMaterial({ color: '#ede0c8', roughness: .27, clearcoat: .7 });
  const dishMaterial = new THREE.MeshPhysicalMaterial({ map: plateTexture, roughness: .23, clearcoat: .85, clearcoatRoughness: .22 });
  const prop = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x,y,z); mesh.castShadow = mesh.receiveShadow = true; workbench.add(mesh); return mesh;
  };
  prop(new THREE.BoxGeometry(3.8,.2,2.8),oak,0,.96,0);
  for(const x of [-1.55,1.55]) for(const z of [-1,1]) prop(new THREE.BoxGeometry(.13,1.15,.13),oak,x,.35,z);
  prop(new THREE.BoxGeometry(3.3,.12,.14),oak,0,.25,-1);
  const dishGeometry = new THREE.LatheGeometry([new THREE.Vector2(0,0),new THREE.Vector2(.65,.015),new THREE.Vector2(.98,.09),new THREE.Vector2(1.14,.23),new THREE.Vector2(1.2,.27),new THREE.Vector2(1.22,.24),new THREE.Vector2(1.15,.19),new THREE.Vector2(1,.04),new THREE.Vector2(.65,-.025),new THREE.Vector2(0,-.03)],80);
  const dishUv=dishGeometry.getAttribute('uv'),dishPos=dishGeometry.getAttribute('position');
  for(let i=0;i<dishUv.count;i++)dishUv.setXY(i,dishPos.getX(i)/2.5+.5,dishPos.getZ(i)/2.5+.5);
  const dish=prop(dishGeometry,dishMaterial,0,2.3,.05); dish.rotation.x=Math.PI*.32;
  prop(new THREE.BoxGeometry(1.4,.08,.18),oak,0,1.3,.7);
  for(const x of [-.55,.55]) { const support=prop(new THREE.CylinderGeometry(.028,.035,1.4,8),oak,x,1.7,-.25); support.rotation.x=-.35; }
  const paints: THREE.MeshStandardMaterial[]=[];
  for(let i=0;i<6;i++){
    const x=-1.45+i*.58;
    prop(new THREE.CylinderGeometry(.19,.16,.27,24),porcelain,x,1.19,-1.05);
    const ink=new THREE.MeshStandardMaterial({color:PALETTES[0].colors[i%4],roughness:.16,metalness:.05});paints.push(ink);
    prop(new THREE.CylinderGeometry(.157,.157,.025,24),ink,x,1.335,-1.05);
  }
  prop(new THREE.CylinderGeometry(.2,.17,.42,24),porcelain,-1.55,1.28,.7);
  for(let i=0;i<4;i++){
    const brush=prop(new THREE.CylinderGeometry(.018,.026,.8,8),oak,-1.58+i*.045,1.8,.7);brush.rotation.z=(i-1.5)*.13;
    const tip=prop(new THREE.SphereGeometry(.04,8,8),metal,-1.58+i*.08,2.21,.7);tip.scale.y=2;
  }
  let patternKey = '', dirty = false, redraw = true, lastReset = settings.reset, lastUndo = settings.undo, lastAdjustment = settings.adjustment, lastStage = settings.stage;
  let lastShape = settings.shapeRevision, lastShapeTransaction = -1;
  const sample = new THREE.Vector3(), pathLength = points().length;
  const updateShape = () => {
    const positions = geometry.getAttribute('position');
    for (let j = 0; j <= 96; j++) for (let i = 0; i < pathLength; i++) {
      if (i === 0 || i === pathLength - 1) sample.set(0, i ? .12 : 0, 0);
      else {
        const outer = i <= RINGS + 1;
        const row = outer ? i - 1 : RINGS - (i - RINGS - 2);
        sampleClay(physics.positions, row / RINGS * CLAY_ROWS, j / 96 * CLAY_SIDES, outer ? 1 : 0, sample);
      }
      positions.setXYZ(j * pathLength + i, sample.x, sample.y, sample.z);
    }
    positions.needsUpdate = true; geometry.computeVertexNormals();
    const normals = geometry.getAttribute('normal');
    for (let i = 0; i < pathLength; i++) {
      const last = 96 * pathLength + i;
      sample.set(normals.getX(i) + normals.getX(last), normals.getY(i) + normals.getY(last), normals.getZ(i) + normals.getZ(last)).normalize();
      normals.setXYZ(i, sample.x, sample.y, sample.z); normals.setXYZ(last, sample.x, sample.y, sample.z);
    }
    normals.needsUpdate = true;
    geometry.computeBoundingSphere(); geometry.computeBoundingBox();
    canvas.dataset.profile = Array.from(profile).map(v => v.toFixed(3)).join(',');
    const stats = physics.diagnostics();
    canvas.dataset.volumeError = stats.volumeError.toFixed(5);
    canvas.dataset.physics = `${stats.nodes} nodes / ${stats.tets} tets`;
    dirty = false; redraw = true;
  };
  const remember = () => { history.push({ clay: physics.snapshot(), shape: { ...currentShape } }); if (history.length > 20) history.shift(); };
  const syncRecipe = (shape: VesselParameters) => {
    currentShape = { ...shape }; settings.shape = currentShape; settings.onShapeChange?.(currentShape);
    canvas.dataset.vessel = JSON.stringify(currentShape);
  };
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let drag: { id: number; y: number; height: number; startHeight: number; angle: number; pressure: number; lift: number } | null = null;
  let keyboardContact = 0;
  const cursorNormal = new THREE.Vector3(), axis = new THREE.Vector3(0, 0, 1);
  const placeCursor = (height: number, angle: number, pressed: boolean, widening = settings.sculptMode === 'widen') => {
    physics.sample(height, angle - potGroup.rotation.y, sample);
    const radius = Math.hypot(sample.x, sample.z);
    cursorNormal.set(Math.sin(angle), 0, Math.cos(angle));
    brushPoint.value.set(station.position.x + Math.sin(angle) * radius, height + potGroup.position.y, Math.cos(angle) * radius);
    cursor.position.copy(brushPoint.value).addScaledVector(cursorNormal, .014);
    cursor.quaternion.setFromUnitVectors(axis, cursorNormal); cursor.scale.setScalar(settings.brush * .65);
    contactDot.position.copy(cursor.position);
    cursorMaterial.color.set(pressed ? '#ffd078' : '#8ee9df');
    plusMark.visible = widening;
    cursor.visible = true; contactDot.visible = pressed; brushSize.value = settings.brush; brushPower.value = pressed ? .9 : .25;
    canvas.dataset.contact = pressed ? 'pressing' : 'hover'; redraw = true;
  };
  const hit = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    const aim = effectClientPoint(event, rect);
    pointer.set((aim.clientX - rect.left) / rect.width * 2 - 1, -(aim.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObject(pot)[0];
  };
  const down = (event: PointerEvent) => {
    if (drag || !settings.focused || settings.stage !== 'clay' || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const point = hit(event); if (!point) return;
    remember();
    const height = point.point.y - potGroup.position.y;
    drag = { id: event.pointerId, y: effectClientPoint(event, canvas.getBoundingClientRect()).clientY, height, startHeight: height, angle: Math.atan2(point.point.x-station.position.x, point.point.z), pressure: event.pointerType === 'pen' ? Math.max(.2, event.pressure) * 1.5 : 1, lift: 0 };
    canvas.setPointerCapture(event.pointerId); canvas.style.cursor = 'grabbing'; event.preventDefault();
  };
  const move = (event: PointerEvent) => {
    if (!settings.focused || settings.stage !== 'clay') return;
    if (!drag) {
      const point = hit(event); canvas.style.cursor = point ? 'crosshair' : 'default';
      if (point) placeCursor(point.point.y - potGroup.position.y, Math.atan2(point.point.x-station.position.x, point.point.z), false);
      else { cursor.visible = contactDot.visible = false; brushPower.value = 0; canvas.dataset.contact = 'none'; redraw = true; }
      return;
    }
    if (event.pointerId !== drag.id) return;
    const units = 2 * camera.position.distanceTo(new THREE.Vector3(0, 1.6, 0)) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / canvas.clientHeight;
    const nextHeight = THREE.MathUtils.clamp(drag.startHeight + (drag.y - effectClientPoint(event, canvas.getBoundingClientRect()).clientY) * units, .12, physics.height);
    drag.lift = THREE.MathUtils.clamp((nextHeight - drag.height) * 12, -1, 1); drag.height = nextHeight;
    const point = hit(event);
    if (point) drag.angle = Math.atan2(point.point.x-station.position.x, point.point.z);
    if (event.pointerType === 'pen') drag.pressure = Math.max(.2, event.pressure) * 1.5;
  };
  const release = () => {
    const id = drag?.id; drag = null; keyboardContact = 0;
    if (id !== undefined && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    physics.setContact(null); cursor.visible = contactDot.visible = false; brushPower.value = 0;
    canvas.dataset.contact = 'none'; canvas.style.cursor = 'default'; redraw = true;
  };
  const leave = () => { if (!drag) release(); };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release); canvas.addEventListener('lostpointercapture', release);
  canvas.addEventListener('pointerleave', leave);
  window.addEventListener('blur', release);
  const resize = () => {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5, Math.sqrt(2200000 / (width * height))));
    renderer.setSize(width, height, false); camera.aspect = width / height;
    // Keep the widest supported vessel and the wheel visible in portrait screens.
    const distance = Math.max(8.8, 2.35 / Math.tan(THREE.MathUtils.degToRad(17)) / camera.aspect);
    camera.position.set(0, 1.65 + distance * .34, distance);
    camera.lookAt(0, 1.65, 0); camera.updateProjectionMatrix();
    const wide=width>=1000;
    station.position.x=wide?distance*Math.tan(THREE.MathUtils.degToRad(17))*camera.aspect*.55:0;
    workbench.position.x=-station.position.x*.9;workbench.scale.setScalar(.9);workbench.visible=wide;
    canvas.dataset.layout=wide?'workbench-left-pot-right':'single-pot';
    redraw = true;
  };
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize(); updateShape();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0, previous = 0, disposed = false;
  const tick = profileEffectFrame(canvas, (time: number) => {
    if (disposed) return;
    frame = requestAnimationFrame(tick);
    if (document.hidden) { previous = time; release(); return; }
    const dt = Math.min((time - previous) / 1000, .04); previous = time;
    if (!settings.focused && (drag || cursor.visible)) release();
    if (lastStage !== settings.stage) { release(); physics.freeze(); lastStage = settings.stage; }
    if (lastReset !== settings.reset) { release(); remember(); physics.reset(); syncRecipe(DEFAULT_VESSEL); lastReset = settings.reset; dirty = true; }
    if (lastUndo !== settings.undo) { release(); const prev = history.pop(); if (prev) { physics.restore(prev.clay); syncRecipe(prev.shape); } lastUndo = settings.undo; dirty = true; }
    if (lastShape !== settings.shapeRevision) {
      release();
      // A whole slider drag is one undo entry, regardless of its event count.
      if (lastShapeTransaction !== settings.shapeTransaction) remember();
      physics.generate(settings.shape); lastShape = settings.shapeRevision; lastShapeTransaction = settings.shapeTransaction; dirty = true;
      syncRecipe(settings.shape);
    }
    if (settings.stage === 'clay') {
      physics.softness = settings.softness;
      if (lastAdjustment !== settings.adjustment) {
        remember(); const height = settings.band / 100 * physics.height;
        physics.setContact({ height, angle: 0, direction: settings.adjustment - lastAdjustment, ring: true, width: settings.brush, pressure: 1 }); keyboardContact = .3;
        placeCursor(height, 0, true, settings.adjustment > lastAdjustment); lastAdjustment = settings.adjustment;
      }
      if (drag) {
        const direction = settings.sculptMode === 'widen' ? 1 : -1;
        physics.setContact({ height: drag.height, angle: drag.angle - potGroup.rotation.y, direction, ring: true, lift: drag.lift, width: settings.brush, pressure: drag.pressure });
        drag.lift *= Math.exp(-8 * dt);
        placeCursor(drag.height, drag.angle, true);
      } else if (keyboardContact > 0) { keyboardContact -= dt; if (keyboardContact <= 0) release(); }
      if (physics.step(dt)) dirty = true;
    }
    if (dirty) updateShape();
    const painted = settings.patterned;
    const nextPattern = `${painted}-${settings.palette}-${settings.seed}-${settings.pattern}-${JSON.stringify(settings.patternOptions)}`;
    if (nextPattern !== patternKey) {
      drawPattern(textureCanvas, settings.seed, settings.palette, settings.pattern, settings.patternOptions); texture.needsUpdate = true;
      drawPlate(plateCanvas, settings.seed, settings.palette, settings.pattern, settings.patternOptions); plateTexture.needsUpdate = true;
      paints.forEach((paint,i)=>paint.color.set(PALETTES[settings.palette].colors[i%4]));
      clay.map = painted ? texture : null; clay.color.set(painted ? '#ffffff' : clayColor);
      bareClay.value = painted ? 0 : 1;
      clay.roughness = painted ? .23 : .58; clay.clearcoat = painted ? .7 : .14;
      clay.clearcoatRoughness = painted ? .28 : .4; clay.needsUpdate = true;
      patternKey = nextPattern; canvas.dataset.pattern = patternKey; redraw = true;
    }
    if (!settings.paused && !reduced.matches) { potGroup.rotation.y += dt * settings.speed; wheel.rotation.y = potGroup.rotation.y; redraw = true; }
    if (redraw) { renderer.render(scene, camera); redraw = false; }
    canvas.dataset.rotation = potGroup.rotation.y.toFixed(3);
  });
  frame = requestAnimationFrame(tick);
  return () => {
    disposed = true; cancelAnimationFrame(frame); observer.disconnect(); release();
    canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', release); canvas.removeEventListener('pointercancel', release); canvas.removeEventListener('lostpointercapture', release); canvas.removeEventListener('pointerleave', leave); window.removeEventListener('blur', release);
    const geometries = new Set<THREE.BufferGeometry>();
    scene.traverse(object => { if (object instanceof THREE.Mesh) geometries.add(object.geometry); });
    geometries.forEach(g => g.dispose());
    [clay, cursorMaterial, metal, ringMaterial, baseMaterial, floorMaterial, oak, porcelain, dishMaterial,...paints].forEach(m => m.dispose());
    physics.dispose();
    texture.dispose(); environment.dispose(); renderer.dispose();
    history = [];
  };
}
