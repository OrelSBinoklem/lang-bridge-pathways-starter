import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { BOARD, NETS } from './layout';
import { buildBoardMaps, NET_INDEX } from './boardTexture';
import { Collector, LabelAtlas, TREE_POSITION, buildParts, makeMaterials, type Dynamic } from './parts3d';
import { createTree } from './tree';
import type { Machine } from './logic';

/**
 * The PROM board in three.js: the board (one shader over the raster maps: mask, copper relief, tinned pads, silk,
 * holes, and the current along every net), all the parts, a desk under it, the decorative tree beside it (its
 * garland is the lamps HL9–HL16, see tree.ts), a desk lamp with shadows, one point light per LED, bloom.
 *
 * The ray-traced light (baked per source, and live) is added by raytrace.ts through `setTracedLight`.
 */

export type CameraState = { yaw: number; pitch: number; dist: number; target: THREE.Vector3 };

export type RenderOptions = {
  /** How strongly the current along the copper shows (0 = off). */
  glow: number;
  exposure: number;
  bloom: number;
  /** The decorative tree beside the board, its sections' order (Q1 at the bottom) and the star's colour. */
  tree: boolean;
  treeUp: boolean;
  star: 'red' | 'white';
};

export { TREE_POSITION };

const NET_COUNT = NETS.length;

export async function createBoardRenderer(width: number, height: number, dpr: number) {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.setPixelRatio(dpr);
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#07080a');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  const sceneAny = scene as unknown as { environmentIntensity?: number };
  sceneAny.environmentIntensity = 0.32;

  const camera = new THREE.PerspectiveCamera(30, width / height, 5, 4000);
  const root = new THREE.Group();
  scene.add(root);

  // --- board -----------------------------------------------------------------------------------------------------
  const maps = buildBoardMaps(12);
  const texOf = (data: Uint8Array<ArrayBuffer>, nearest: boolean) => {
    const t = new THREE.DataTexture(data, maps.width, maps.height, THREE.RGBAFormat);
    t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
    t.minFilter = nearest ? THREE.NearestFilter : THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = !nearest;
    t.anisotropy = nearest ? 1 : 8;
    t.needsUpdate = true;
    return t;
  };
  const surfaceTex = texOf(maps.surface, false);
  const bottomTex = texOf(maps.bottom, false);
  const netsTex = texOf(maps.nets, true);
  const netState = new Float32Array(NET_COUNT * 4);
  const netStateTex = new THREE.DataTexture(netState, NET_COUNT, 1, THREE.RGBAFormat, THREE.FloatType);
  netStateTex.magFilter = THREE.NearestFilter;
  netStateTex.minFilter = THREE.NearestFilter;
  netStateTex.needsUpdate = true;
  const boardUniforms = {
    uSurface: { value: surfaceTex },
    uNets: { value: netsTex },
    uNetState: { value: netStateTex },
    uNetCount: { value: NET_COUNT },
    uTime: { value: 0 },
    uTexel: { value: new THREE.Vector2(1 / maps.width, 1 / maps.height) },
    uGlow: { value: 1 },
    uTraced: { value: null as THREE.Texture | null },
    uTracedOn: { value: 0 },
  };
  const boardMaterial = (bottom: boolean) => {
    const mat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.4, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.25 });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, boardUniforms, bottom ? { uSurface: { value: bottomTex } } : {});
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vBoardUv;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvBoardUv = uv;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec2 vBoardUv;
uniform sampler2D uSurface;
uniform sampler2D uNets;
uniform sampler2D uNetState;
uniform sampler2D uTraced;
uniform float uTracedOn;
uniform float uNetCount;
uniform float uTime;
uniform vec2 uTexel;
uniform float uGlow;
vec4 netStateOf(float id) { return texture2D(uNetState, vec2((id - 0.5) / uNetCount, 0.5)); }
vec3 netGlow(float id, float arcByte) {
  if (id < 0.5) return vec3(0.0);
  vec4 st = netStateOf(id);
  float arc = arcByte * 25.6;
  float lvl = st.r, cur = st.g, ac = st.b, flash = st.a;
  // DC: pulses running along the copper away from the net's source; AC: a shimmer both ways.
  float p = fract(arc / 6.4 - uTime * 0.75);
  float pulse = smoothstep(0.0, 0.12, p) * (1.0 - smoothstep(0.3, 0.62, p));
  float shimmer = 0.5 + 0.5 * sin(arc * 1.9 - uTime * 11.0) * sin(uTime * 7.0 + arc * 0.7);
  vec3 levelCol = vec3(0.1, 0.75, 0.62) * lvl * 0.05;
  vec3 dc = vec3(1.0, 0.52, 0.16) * cur * (0.25 + 1.4 * pulse);
  vec3 acc = vec3(0.55, 0.45, 1.0) * cur * (0.2 + 1.1 * shimmer);
  return (levelCol + mix(dc, acc, ac) + vec3(0.9, 0.95, 1.0) * flash * 0.6) * uGlow * 2.0;
}`)
        .replace('#include <map_fragment>', `
vec2 buv = vec2(vBoardUv.x, ${bottom ? '1.0 - ' : ''}vBoardUv.y);
buv.y = 1.0 - buv.y;
${bottom ? 'buv.x = buv.x;' : ''}
vec4 S = texture2D(uSurface, buv);
if (S.a < 0.5) discard;
float cu = S.r;
float silk = ${bottom ? '0.0' : 'S.g'};
float bare = S.b;
vec3 maskCol = vec3(0.035, 0.2, 0.085);
vec3 maskCu = vec3(0.09, 0.34, 0.12);
vec3 base = mix(maskCol, maskCu, cu);
base = mix(base, vec3(0.82, 0.83, 0.8), silk * (1.0 - bare));
base = mix(base, vec3(0.8, 0.81, 0.83), bare);
diffuseColor.rgb = base;
float boardMetal = bare;
float boardRough = mix(mix(0.42, 0.34, cu), 0.26, bare);
boardRough = mix(boardRough, 0.75, silk * (1.0 - bare));`)
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = boardRough;')
        .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = boardMetal;')
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  // Relief: the copper (and more so the solder on the pads) stands up under the mask.
  float hL = texture2D(uSurface, buv - vec2(uTexel.x, 0.0)).r + texture2D(uSurface, buv - vec2(uTexel.x, 0.0)).b;
  float hR = texture2D(uSurface, buv + vec2(uTexel.x, 0.0)).r + texture2D(uSurface, buv + vec2(uTexel.x, 0.0)).b;
  float hF = texture2D(uSurface, buv + vec2(0.0, uTexel.y)).r + texture2D(uSurface, buv + vec2(0.0, uTexel.y)).b;
  float hB = texture2D(uSurface, buv - vec2(0.0, uTexel.y)).r + texture2D(uSurface, buv - vec2(0.0, uTexel.y)).b;
  vec3 tilt = vec3(hL - hR, 0.0, ${bottom ? 'hB - hF' : 'hB - hF'}) * 0.35;
  normal = normalize(normal + (viewMatrix * vec4(tilt, 0.0)).xyz);
}`)
        // With traced light on (raytrace.ts), the LEDs' point lights (no shadows) leave the board to it.
        .replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin.replace('#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )', '#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct ) && !defined( BOARD_TRACED )'))
        .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
material.clearcoat *= (1.0 - bare) * (1.0 - silk * 0.7);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
  vec4 N = texture2D(uNets, buv);
  float idTop = floor(N.${bottom ? 'b' : 'r'} * 255.0 + 0.5);
  float idUnder = floor(N.${bottom ? 'r' : 'b'} * 255.0 + 0.5);
  totalEmissiveRadiance += netGlow(idTop, N.${bottom ? 'a' : 'g'}) * cu * (1.0 - bare * 0.6);
  // A trace on the other side glows faintly through the glass-fibre board.
  totalEmissiveRadiance += netGlow(idUnder, N.${bottom ? 'g' : 'a'}) * (1.0 - cu) * 0.18;
  if (uTracedOn > 0.5) totalEmissiveRadiance += diffuseColor.rgb * texture2D(uTraced, buv).rgb;
}`);
    };
    return mat;
  };
  const top = new THREE.Mesh(new THREE.PlaneGeometry(BOARD.w, BOARD.h), boardMaterial(false));
  top.rotation.x = -Math.PI / 2;
  top.receiveShadow = true;
  top.name = 'board-top';
  const under = new THREE.Mesh(new THREE.PlaneGeometry(BOARD.w, BOARD.h), boardMaterial(true));
  under.rotation.x = Math.PI / 2;
  under.position.y = -BOARD.thickness;
  under.name = 'board-bottom';
  const fr4 = new THREE.MeshStandardMaterial({ color: '#b9a86a', roughness: 0.6 });
  const edgeGeo = new THREE.BoxGeometry(BOARD.w, BOARD.thickness, BOARD.h);
  const edges = new THREE.Mesh(edgeGeo, [fr4, fr4, new THREE.MeshBasicMaterial({ visible: false }), new THREE.MeshBasicMaterial({ visible: false }), fr4, fr4]);
  edges.position.y = -BOARD.thickness / 2;
  edges.castShadow = true;
  root.add(top, under, edges);

  // Desk: dark oiled wood.
  const woodCanvas = document.createElement('canvas');
  woodCanvas.width = 1024;
  woodCanvas.height = 1024;
  {
    const g = woodCanvas.getContext('2d')!;
    g.fillStyle = '#3a2618';
    g.fillRect(0, 0, 1024, 1024);
    for (let k = 0; k < 420; k += 1) {
      const y = Math.random() * 1024;
      g.strokeStyle = `rgba(${Math.random() < 0.5 ? '20,10,5' : '90,60,35'},${0.08 + Math.random() * 0.18})`;
      g.lineWidth = 0.6 + Math.random() * 3;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= 1024; x += 32) g.lineTo(x, y + Math.sin(x * 0.004 + k) * 6 + Math.sin(x * 0.02 + k * 3) * 1.5);
      g.stroke();
    }
  }
  const woodTex = new THREE.CanvasTexture(woodCanvas);
  woodTex.colorSpace = THREE.SRGBColorSpace;
  woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
  woodTex.repeat.set(3, 3);
  woodTex.anisotropy = 8;
  const deskMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.55, metalness: 0 });
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), deskMat);
  desk.rotation.x = -Math.PI / 2;
  desk.position.y = -BOARD.thickness - 8;
  desk.receiveShadow = true;
  root.add(desk);

  // --- parts -----------------------------------------------------------------------------------------------------
  const atlas = new LabelAtlas(2048);
  const labelTex = new THREE.CanvasTexture(atlas.canvas);
  labelTex.colorSpace = THREE.SRGBColorSpace;
  labelTex.anisotropy = 8;
  const mats = makeMaterials(labelTex, labelTex);
  const col = new Collector();
  const dyn: Dynamic = buildParts(col, atlas, root, mats);
  labelTex.needsUpdate = true;
  const statics = col.build(mats);
  for (const m of statics) {
    m.castShadow = m.userData.mat !== 'label' && m.userData.mat !== 'labelDark';
    m.receiveShadow = true;
    root.add(m);
  }
  for (const led of dyn.leds) led.group.traverse((o) => ((o as THREE.Mesh).castShadow = true));

  // --- light -----------------------------------------------------------------------------------------------------
  const key = new THREE.DirectionalLight('#ffe4c4', 1.6);
  key.position.set(-160, 300, 160);
  key.target.position.set(0, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera as THREE.OrthographicCamera;
  // Wide enough for the tree beside the board.
  sc.left = -380; sc.right = 150; sc.top = 170; sc.bottom = -170; sc.near = 50; sc.far = 900;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.3;
  key.shadow.radius = 3;
  root.add(key, key.target);
  const fill = new THREE.HemisphereLight('#9fb4d8', '#2a1a10', 0.12);
  root.add(fill);
  const ledLights = dyn.leds.map((l) => {
    const pl = new THREE.PointLight(l.color, 0, 90, 2);
    pl.position.copy(l.position).setY(11);
    root.add(pl);
    return pl;
  });

  // --- the tree beside the board, lit by its own baked garland -------------------------------------------------
  const tree = createTree(renderer, -BOARD.thickness - 8, new THREE.Vector3(TREE_POSITION.x, 0, TREE_POSITION.z));
  tree.hookDesk(deskMat);
  root.add(tree.group);

  // --- post ------------------------------------------------------------------------------------------------------
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(width * dpr, height * dpr, { type: THREE.HalfFloatType, samples: 4 }));
  composer.setPixelRatio(dpr);
  composer.setSize(width, height);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.55, 0.4, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // --- per frame -------------------------------------------------------------------------------------------------
  const ledLevel = new Float32Array(8);
  const lampLevel = new Float32Array(8);
  const setCamera = (c: CameraState) => {
    const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    camera.position.set(c.target.x + c.dist * cp * Math.sin(c.yaw), c.target.y + c.dist * sp, c.target.z + c.dist * cp * Math.cos(c.yaw));
    camera.lookAt(c.target);
  };
  const logNorm = (i: number) => Math.min(1, Math.log10(1 + i * 1000) / 3);

  return {
    canvas,
    renderer,
    scene,
    camera,
    root,
    statics,
    dyn,
    boardUniforms,
    boardMaps: maps,
    ledLights,
    get ledLevel() {
      return ledLevel;
    },
    get lampLevel() {
      return lampLevel;
    },
    resize(w: number, h: number) {
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    /** Advance the lights (LEDs switch in microseconds, filaments take a tenth of a second) and the copper. */
    update(m: Machine, dt: number, t: number, cam: CameraState, o: RenderOptions) {
      setCamera(cam);
      renderer.toneMappingExposure = o.exposure;
      bloom.strength = 0.55 * o.bloom;
      boardUniforms.uTime.value = t;
      boardUniforms.uGlow.value = o.glow;
      for (let k = 0; k < 8; k += 1) {
        const lit = m.lit(k) ? 1 : 0;
        ledLevel[k] += (lit - ledLevel[k]) * Math.min(1, dt * 40);
        const target = lit;
        // A filament heats in ~60 ms and cools in ~150 ms.
        lampLevel[k] += (target - lampLevel[k]) * Math.min(1, dt * (target > lampLevel[k] ? 16 : 7));
      }
      for (const led of dyn.leds) {
        const v = ledLevel[led.k];
        for (const gm of led.glow) (gm.material as THREE.MeshStandardMaterial).emissiveIntensity = v * 9;
        (led.die.material as THREE.MeshStandardMaterial).emissiveIntensity = v * 3;
        (led.lens.material as THREE.MeshPhysicalMaterial).emissiveIntensity = v * 0.9;
        ledLights[led.k].intensity = v * 260;
      }
      // Switches and the rate knob.
      const lever = (ref: string, up: boolean) => {
        const l = dyn.levers[ref];
        if (!l) return;
        const target = up ? -0.42 : 0.42;
        l.pivot.rotation.x += (target - l.pivot.rotation.x) * Math.min(1, dt * 18);
      };
      lever('SB1', m.sw.sb1 === 0);
      lever('SB2', m.sw.sb2 === 'gen');
      lever('SB3', m.sw.sb3 === 1);
      lever('SB4', m.sw.sb4 === 1);
      lever('SB5', m.sw.sb5);
      if (dyn.knob) dyn.knob.rotation.y = 2.4 - m.rate * 4.8;
      // The copper: level, current, AC, a flash on the clock edges.
      const ns = m.nets;
      for (let i = 0; i < NET_COUNT; i += 1) {
        const n = NETS[i];
        const s = ns[n.name];
        const o4 = i * 4;
        if (!s) {
          netState[o4] = netState[o4 + 1] = netState[o4 + 2] = netState[o4 + 3] = 0;
          continue;
        }
        netState[o4] = s.v > 20 ? 1 : Math.min(1, s.v / 5);
        netState[o4 + 1] = n.name === 'GND' ? 0 : logNorm(s.i);
        netState[o4 + 2] = s.ac ? 1 : 0;
        netState[o4 + 3] = n.name === 'CLK' ? m.clockFlash : n.name === 'CARRY1' ? m.carryFlash : n.name === 'PCLK' ? m.programFlash : 0;
      }
      netStateTex.needsUpdate = true;
      tree.update(lampLevel, o.treeUp, o.star, o.tree);
    },
    render() {
      composer.render();
    },
    /** The part under a screen point (px of this renderer's canvas), if it is one you can operate. */
    pick(x: number, y: number, w: number, h: number): string | null {
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2((x / w) * 2 - 1, -(y / h) * 2 + 1), camera);
      let best: string | null = null;
      let bestD = Infinity;
      for (const hs of dyn.hotspots) {
        const d = ray.ray.distanceSqToPoint(hs.center);
        if (d < hs.radius * hs.radius) {
          const along = hs.center.distanceTo(camera.position);
          if (along < bestD) {
            bestD = along;
            best = hs.ref;
          }
        }
      }
      return best;
    },
    /** Where a board point is on the screen (for the panel's lines to the chips). */
    project(v: THREE.Vector3, w: number, h: number) {
      const p = v.clone().project(camera);
      return [((p.x + 1) / 2) * w, ((1 - p.y) / 2) * h, p.z] as const;
    },
    netIndex: NET_INDEX,
    get treeProgress() {
      return tree.progress;
    },
    dispose() {
      tree.dispose();
      composer.dispose();
      renderer.dispose();
      pmrem.dispose();
      env.dispose();
      for (const t of [surfaceTex, bottomTex, netsTex, netStateTex, labelTex, woodTex]) t.dispose();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
    },
  };
}

export type BoardRenderer = Awaited<ReturnType<typeof createBoardRenderer>>;
