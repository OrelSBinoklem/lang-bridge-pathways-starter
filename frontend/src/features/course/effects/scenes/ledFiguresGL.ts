import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

/**
 * New Year LED figures (three.js), the LED cube effect's other variants (ledCube.ts):
 *
 *   «Снеговик» — after the owner's photo: three balls of white fabric on wire rings, lit from inside by LEDs that
 *                show through as bright soft spots (the fabric's shader adds up the light of every LED inside, near
 *                and far); a top hat glittering with tinsel, a red band and holly; coal eyes and smile, a carrot nose,
 *                buttons, a red mesh scarf, twig arms.
 *   «Олень»    — an outdoor wire reindeer: its body, neck and head as rings and ribs of white-coated wire, legs, a tail,
 *                branching antlers, LEDs strung along all of it; the head nods; Rudolph's red nose blinks.
 *   «Витрина»  — both, and a small LED cube that shows the time left to the New Year (days:hours) scrolling, before a
 *                curtain of fairy lights out of focus that only breathes (the background that stays lit) — the
 *                figures play their programs over it; snow falls; the floor is a dark mirror.
 *
 * Every LED's colour is worked out each frame (programs: a steady glow with twinkles, waves, colour sweeps,
 * breathing, chases along the wires, sparkle bursts; crossfaded every ~10 s, or one held), optionally all to one beat
 * (120 a minute). LEDs on wires are glowing points; light goes through a bloom pass. A click on a figure fires its
 * own show (a sparkle burst, a chase with the nose flashing, the cube's salute).
 */

export type LedFiguresLook = {
  /** 1 snowman, 2 reindeer, 3 showcase. */
  mode: number;
  /** 0 auto (programs in turn), 1… a program held. */
  program: number;
  /** The steady glow (the part that is always lit). */
  base: number;
  /** How strongly the programs play over it. */
  play: number;
  speed: number;
  bloom: number;
  curtain: number;
  snow: number;
  beat: boolean;
  countdown: boolean;
  exposure: number;
  /** The camera control (orbitControl.ts): turn and tilt added to the figures' own (radians), zoom. */
  cam?: { yaw: number; pitch: number; zoom: number };
};

type V = THREE.Vector3;
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
function hsv(h: number, s: number, val: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h * 6) % 6;
    return val - val * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

/** LEDs of a figure: positions (world, before the figure's own moves), a parameter along their wire (0…1), which
 * group they belong to (for programs), and their colours, worked out each frame. */
type Leds = { pos: Float32Array; along: Float32Array; group: Uint8Array; col: Float32Array; n: number };
const makeLeds = (pts: { p: V; along: number; group: number }[]): Leds => {
  const n = pts.length;
  const pos = new Float32Array(n * 3), along = new Float32Array(n), group = new Uint8Array(n);
  pts.forEach((q, i) => {
    pos.set([q.p.x, q.p.y, q.p.z], i * 3);
    along[i] = q.along;
    group[i] = q.group;
  });
  return { pos, along, group, col: new Float32Array(n * 3), n };
};

/** Glowing points for LEDs: a hot core and a soft halo, added up; sizes in world units (they shrink with distance). */
function ledPoints(leds: Leds, size: number) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(leds.pos, 3));
  const colAttr = new THREE.BufferAttribute(leds.col, 3).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('color', colAttr);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uSize: { value: size }, uScale: { value: 600 } },
    vertexShader: /* glsl */ `
attribute vec3 color;
uniform float uSize; uniform float uScale;
varying vec3 vCol;
void main() {
  vCol = color;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = max(2.0, uSize * uScale / -mv.z);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
varying vec3 vCol;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  // A bulb: a small hot core and a tight halo (a wide one ran neighbours together into stripes).
  float core = exp(-r2 * 12.0) * 3.0;
  float halo = exp(-r2 * 3.5) * 0.22;
  gl_FragColor = vec4(vCol * (core + halo), 1.0);
}`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, colAttr, mat };
}

/** A tube of white-coated wire along a curve. */
const wire = (curve: THREE.Curve<V>, r: number, mat: THREE.Material, seg = 64) => new THREE.Mesh(new THREE.TubeGeometry(curve, seg, r, 6, false), mat);
const ring = (c: V, rx: number, rz: number, y = 0, tilt = 0) => {
  const pts: V[] = [];
  for (let i = 0; i < 24; i += 1) {
    const a = (i / 24) * Math.PI * 2;
    pts.push(v(c.x + Math.cos(a) * rx * Math.cos(tilt), c.y + y + Math.cos(a) * rx * Math.sin(tilt), c.z + Math.sin(a) * rz));
  }
  return new THREE.CatmullRomCurve3(pts, true);
};
/** A vertical ring (in the x–y plane round c, a section across z): for the reindeer's body seen side-on. */
const yzRing = (c: V, ry: number, rz: number) => {
  const pts: V[] = [];
  for (let i = 0; i < 20; i += 1) {
    const a = (i / 20) * Math.PI * 2;
    pts.push(v(c.x, c.y + Math.cos(a) * ry, c.z + Math.sin(a) * rz));
  }
  return new THREE.CatmullRomCurve3(pts, true);
};
const path = (...pts: V[]) => new THREE.CatmullRomCurve3(pts, false, 'centripetal');
/** LEDs strung along a curve every `gap`. */
const along = (curve: THREE.Curve<V>, gap: number, group: number, out: { p: V; along: number; group: number }[]) => {
  const n = Math.max(2, Math.round(curve.getLength() / gap));
  const pts = curve.getSpacedPoints(n);
  const closed = (curve as THREE.CatmullRomCurve3).closed;
  pts.slice(0, closed ? -1 : undefined).forEach((p, i) => out.push({ p, along: i / n, group }));
};

// --- the snowman ------------------------------------------------------------------------------------------------------
const BALLS: [number, number, number][] = [[0, 0.62, 0.62], [0, 1.43, 0.46], [0, 2.08, 0.34]];

function buildSnowman() {
  const g = new THREE.Group();
  // LEDs inside the balls (on spheres a little inside the fabric, evenly by a golden spiral), and on the hat.
  const ledPts: { p: V; along: number; group: number }[] = [];
  BALLS.forEach(([x, y, r], b) => {
    const n = Math.round(130 * r * r);
    for (let i = 0; i < n; i += 1) {
      const t = (i + 0.5) / n;
      const phi = Math.acos(1 - 2 * t);
      const th = i * 2.39996 + b;
      // Right under the fabric (each shows as its own bright spot through it).
      const rr = r * (0.86 + 0.05 * hash(i + b * 31));
      ledPts.push({ p: v(x + Math.sin(phi) * Math.cos(th) * rr, y + Math.cos(phi) * rr, Math.sin(phi) * Math.sin(th) * rr), along: (Math.cos(phi) + 1) / 2, group: b });
    }
  });
  const inner = makeLeds(ledPts);
  // The LEDs seen through the fabric: soft bright dots, only those on the side facing the eye (drawn over the fabric,
  // which hides them otherwise).
  const centers = new Float32Array(inner.n * 3);
  ledPts.forEach((q, i) => {
    const [bx, by] = BALLS[q.group];
    centers.set([bx, by, 0], i * 3);
  });
  const innerGeo = new THREE.BufferGeometry();
  innerGeo.setAttribute('position', new THREE.BufferAttribute(inner.pos, 3));
  innerGeo.setAttribute('center', new THREE.BufferAttribute(centers, 3));
  const innerCol = new THREE.BufferAttribute(inner.col, 3).setUsage(THREE.DynamicDrawUsage);
  innerGeo.setAttribute('color', innerCol);
  const innerMat = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uScale: { value: 600 } },
    vertexShader: /* glsl */ `
attribute vec3 color; attribute vec3 center;
uniform float uScale;
varying vec3 vCol; varying float vFace;
void main() {
  vec3 w = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 c = (modelMatrix * vec4(center, 1.0)).xyz;
  vFace = smoothstep(0.2, 0.75, dot(normalize(w - c), normalize(cameraPosition - w)));
  vCol = color;
  vec4 mv = viewMatrix * vec4(w, 1.0);
  gl_PointSize = vFace > 0.0 ? max(2.0, 0.07 * uScale / -mv.z) : 0.0;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
varying vec3 vCol; varying float vFace;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0 || vFace <= 0.0) discard;
  gl_FragColor = vec4(vCol * (exp(-r2 * 16.0) * 1.4 + exp(-r2 * 4.0) * 0.35) * vFace, 1.0);
}`,
  });
  const innerPoints = new THREE.Points(innerGeo, innerMat);
  innerPoints.frustumCulled = false;
  innerPoints.renderOrder = 2;
  g.add(innerPoints);
  // The fabric: lit by every LED inside (a texture of their positions and colours).
  const texData = new Float32Array(256 * 2 * 4);
  const tex = new THREE.DataTexture(texData, 256, 2, THREE.RGBAFormat, THREE.FloatType);
  tex.needsUpdate = true;
  const fabricU = { uLeds: { value: tex }, uCount: { value: inner.n }, uTime: { value: 0 }, uFill: { value: new THREE.Color(0.55, 0.62, 0.8) } };
  const fabric = new THREE.ShaderMaterial({
    uniforms: fabricU,
    vertexShader: /* glsl */ `
varying vec3 vW; varying vec3 vN; varying vec3 vV;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: /* glsl */ `
uniform sampler2D uLeds; uniform int uCount; uniform float uTime; uniform vec3 uFill;
varying vec3 vW; varying vec3 vN; varying vec3 vV;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  // The light of the LEDs inside: a soft spot from each near one, a wide glow from all.
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 256; i++) {
    if (i >= uCount) break;
    vec3 L = texelFetch(uLeds, ivec2(i, 0), 0).xyz;
    vec3 C = texelFetch(uLeds, ivec2(i, 1), 0).rgb;
    vec3 d = vW - L;
    float r2 = dot(d, d);
    // A sharp spot from each LED close under the fabric, and a soft glow from all of them.
    acc += C * (0.0022 / (r2 + 0.0002) + 0.001 / (r2 + 0.08));
  }
  // The fabric: the wire rings round it (darker lines with a little shadow), the seams between its panels, a weave.
  float y = vW.y * 9.0;
  float rings = smoothstep(0.06, 0.0, abs(fract(y) - 0.5) - 0.44);
  float a = atan(vW.z, vW.x) * 6.0 / 3.14159;
  float seams = smoothstep(0.05, 0.0, abs(fract(a) - 0.5) - 0.46) * 0.5;
  float weave = 0.93 + 0.07 * h21(floor(vW.xy * 300.0) + floor(vW.z * 300.0));
  float edge = pow(1.0 - max(dot(vN, vV), 0.0), 2.0);
  // Translucent: brighter where the light comes through thinner (towards the rim it runs along the fabric).
  vec3 col = (uFill * 0.05 + acc) * weave * (1.0 - 0.35 * rings - 0.2 * seams) * (0.9 + 0.5 * edge);
  gl_FragColor = vec4(col, 1.0);
}`,
  });
  BALLS.forEach(([x, y, r]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 40), fabric);
    m.position.set(x, y, 0);
    m.scale.set(1, 0.95, 1);
    g.add(m);
  });
  // The hat: tinsel black, glittering; a red band, holly leaves and berries.
  const hatU = { uTime: { value: 0 } };
  const tinsel = new THREE.ShaderMaterial({
    uniforms: hatU,
    vertexShader: /* glsl */ `varying vec3 vW; varying vec3 vN; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
uniform float uTime; varying vec3 vW; varying vec3 vN;
float h31(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
void main() {
  vec3 c = floor(vW * 140.0);
  float s = h31(c);
  float tw = pow(max(0.0, sin(uTime * (2.0 + 4.0 * h31(c + 1.0)) + s * 40.0)), 12.0);
  // Black felt with a soft sheen and only a few glints (the lights on it are the bulbs).
  vec3 col = vec3(0.018, 0.018, 0.024) + vec3(0.05, 0.05, 0.065) * pow(max(vN.y, 0.0), 2.0);
  col += vec3(0.8, 0.85, 1.0) * step(0.985, s) * (0.05 + 0.8 * tw);
  gl_FragColor = vec4(col, 1.0);
}`,
  });
  const top = 2.08 + 0.3;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 48), tinsel);
  brim.position.set(0, top, 0);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.25, 0.46, 48), tinsel);
  crown.position.set(0, top + 0.25, 0);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.262, 0.262, 0.08, 48), new THREE.MeshStandardMaterial({ color: 0xa0101a, emissive: 0x300004, roughness: 0.6 }));
  band.position.set(0, top + 0.08, 0);
  g.add(brim, crown, band);
  const leaf = new THREE.MeshStandardMaterial({ color: 0x0c5a1e, emissive: 0x021a06, roughness: 0.5 });
  for (let k = 0; k < 3; k += 1) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 8), leaf);
    l.scale.set(1.6, 0.5, 0.35);
    l.position.set(-0.08 + k * 0.08, top + 0.1 + (k === 1 ? 0.03 : 0), 0.26);
    l.rotation.z = (k - 1) * 0.6;
    g.add(l);
  }
  const berry = new THREE.MeshStandardMaterial({ color: 0xd01020, emissive: 0x500005, roughness: 0.3 });
  for (let k = 0; k < 3; k += 1) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), berry);
    b.position.set(-0.02 + k * 0.025, top + 0.09 + (k % 2) * 0.03, 0.29);
    g.add(b);
  }
  // Face: coal eyes and smile, a carrot nose.
  const coal = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.4 });
  const hy = 2.08;
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), coal);
    e.position.set(sx * 0.11, hy + 0.08, 0.3);
    g.add(e);
  }
  for (let k = 0; k < 7; k += 1) {
    const a = -0.7 + (k / 6) * 1.4;
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.017, 10, 6), coal);
    s.position.set(Math.sin(a) * 0.15, hy - 0.11 + (1 - Math.cos(a)) * 0.06, 0.29 + Math.cos(a) * 0.02);
    g.add(s);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.22, 16), new THREE.MeshStandardMaterial({ color: 0xff6a10, emissive: 0x7a2200, roughness: 0.5 }));
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, hy - 0.01, 0.42);
  g.add(nose);
  // Buttons.
  for (const [y, z] of [[1.55, 0.43], [1.3, 0.44], [0.85, 0.58]]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), coal);
    b.position.set(0, y, z);
    g.add(b);
  }
  // The scarf: a red mesh (a weave of holes), round the neck and hanging down the front.
  const scarfMat = new THREE.ShaderMaterial({
    uniforms: { uTime: hatU.uTime },
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vN; void main() { vUv = uv; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
uniform float uTime; varying vec2 vUv; varying vec3 vN;
void main() {
  vec2 q = vUv * vec2(60.0, 14.0);
  vec2 f = abs(fract(q + vec2(q.y * 0.5, 0.0)) - 0.5);
  float holes = smoothstep(0.32, 0.22, max(f.x, f.y));
  vec3 col = vec3(0.75, 0.04, 0.12) * (0.55 + 0.45 * max(vN.y * 0.5 + 0.5, 0.0)) * (1.0 - 0.55 * holes);
  gl_FragColor = vec4(col + vec3(0.12, 0.0, 0.02), 1.0);
}`,
  });
  const neck = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.07, 12, 48), scarfMat);
  neck.rotation.x = Math.PI / 2;
  neck.position.set(0, 1.8, 0);
  neck.scale.set(1, 1, 0.8);
  g.add(neck);
  const tail = new THREE.Mesh(new THREE.TubeGeometry(path(v(0.12, 1.78, 0.3), v(0.2, 1.55, 0.42), v(0.24, 1.25, 0.46), v(0.27, 1.0, 0.44)), 24, 0.07, 8), scarfMat);
  tail.scale.set(1, 1, 0.6);
  tail.position.z = 0.18;
  g.add(tail);
  // Twig arms.
  const bark = new THREE.MeshStandardMaterial({ color: 0x4a2c16, roughness: 0.9 });
  for (const sx of [-1, 1]) {
    const main = path(v(sx * 0.38, 1.5, 0), v(sx * 0.7, 1.75, 0), v(sx * 1.0, 2.05, 0.02), v(sx * 1.15, 2.3, 0.04));
    g.add(wire(main, 0.014, bark, 24));
    g.add(wire(path(v(sx * 0.85, 1.9, 0.01), v(sx * 0.95, 2.15, 0.02), v(sx * 0.93, 2.3, 0.02)), 0.009, bark, 12));
    g.add(wire(path(v(sx * 1.05, 2.15, 0.03), v(sx * 1.25, 2.2, 0.04), v(sx * 1.35, 2.18, 0.04)), 0.008, bark, 12));
  }
  // LEDs on the hat (tinsel lights, outside).
  const hatPts: { p: V; along: number; group: number }[] = [];
  // A string of bulbs wound round the crown, and a ring of them round the brim's edge.
  for (let i = 0; i < 26; i += 1) {
    const a = i * 0.72;
    const y = top + 0.12 + (i / 26) * 0.36;
    hatPts.push({ p: v(Math.cos(a) * 0.275, y, Math.sin(a) * 0.275), along: i / 26, group: 3 });
  }
  for (let i = 0; i < 16; i += 1) {
    const a = (i / 16) * Math.PI * 2;
    hatPts.push({ p: v(Math.cos(a) * 0.43, top + 0.03, Math.sin(a) * 0.43), along: i / 16, group: 4 });
  }
  const hatLeds = makeLeds(hatPts);
  const hatPoints = ledPoints(hatLeds, 0.11);
  // The string's wire.
  const hatWire = new THREE.MeshStandardMaterial({ color: 0x1a3a1c, roughness: 0.6 });
  g.add(wire(new THREE.CatmullRomCurve3(hatPts.slice(0, 26).map((q) => q.p)), 0.005, hatWire, 120));
  g.add(hatPoints.points);
  return { group: g, inner, innerCol, innerMat, tex, texData, fabricU, hatU, hatLeds, hatPoints };
}

// --- the reindeer -----------------------------------------------------------------------------------------------------
/** A vertical ring in the x–y plane (an eye). */
const xyRing = (c: V, r: number) => {
  const pts: V[] = [];
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    pts.push(v(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, c.z));
  }
  return new THREE.CatmullRomCurve3(pts, true);
};
/** The reindeer's bulbs: one every 8.5 cm along the wire, as on a real outdoor figure (denser they ran together into
 * stripes). */
const DEER_GAP = 0.085;

function buildReindeer() {
  const g = new THREE.Group();
  const head = new THREE.Group();
  // The frame: thin white-coated wire, hardly glowing itself (the bulbs do).
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x5c636d, roughness: 0.55, metalness: 0.2, emissive: 0x050608 });
  const pts: { p: V; along: number; group: number }[] = [];
  const headPts: { p: V; along: number; group: number }[] = [];
  const add = (curve: THREE.Curve<V>, group: number, onHead = false, r = 0.008, lit = true) => {
    (onHead ? head : g).add(wire(curve, r, wireMat, 96));
    if (lit) along(curve, DEER_GAP, group, onHead ? headPts : pts);
  };
  // Body (side-on, x along it, the head at +x): seven rings across — a narrow rump, a deep chest — and eight ribs.
  const sections: [number, number, number, number][] = [
    [-0.68, 1.13, 0.16, 0.13], [-0.52, 1.1, 0.24, 0.2], [-0.3, 1.08, 0.28, 0.23], [-0.06, 1.07, 0.3, 0.24],
    [0.18, 1.1, 0.31, 0.25], [0.38, 1.16, 0.28, 0.22], [0.54, 1.24, 0.2, 0.16],
  ];
  for (const [x, y, ry, rz] of sections) add(yzRing(v(x, y, 0), ry, rz), 0);
  for (let k = 0; k < 8; k += 1) {
    const a = (k / 8) * Math.PI * 2;
    add(path(...sections.map(([x, y, ry, rz]) => v(x, y + Math.cos(a) * ry, Math.sin(a) * rz))), 0);
  }
  // Legs: three wires round each (thigh to hoof, through the knee or the hock), rings at the thigh and the fetlock,
  // a hoof.
  for (const [lx, lz, front] of [[-0.46, -0.11, false], [-0.46, 0.11, false], [0.36, -0.11, true], [0.36, 0.11, true]] as [number, number, boolean][]) {
    const axis = front
      ? [v(lx, 1.0, lz), v(lx + 0.02, 0.78, lz), v(lx + 0.05, 0.52, lz), v(lx + 0.01, 0.26, lz), v(lx + 0.04, 0.06, lz)]
      : [v(lx, 1.02, lz), v(lx - 0.07, 0.8, lz), v(lx - 0.11, 0.54, lz), v(lx - 0.02, 0.27, lz), v(lx + 0.01, 0.06, lz)];
    const rad = [0.08, 0.065, 0.042, 0.032, 0.036];
    for (let k = 0; k < 3; k += 1) {
      const a = (k / 3) * Math.PI * 2 + 0.4;
      add(path(...axis.map((p, i) => v(p.x + Math.cos(a) * rad[i], p.y, p.z + Math.sin(a) * rad[i] * 0.8))), 1);
    }
    add(ring(axis[1], rad[1], rad[1] * 0.8), 1);
    add(ring(axis[3], rad[3], rad[3] * 0.8), 1);
    add(ring(v(axis[4].x, 0.03, lz), 0.05, 0.042), 1);
  }
  // A tail: a little tuft.
  for (const [dy, dz] of [[0.0, 0], [0.04, 0.03], [0.03, -0.03]]) add(path(v(-0.7, 1.18, 0), v(-0.8, 1.27 + dy, dz), v(-0.84, 1.34 + dy, dz * 1.5)), 0);
  // The head group (it nods about the neck's base): the neck, rings tilted along it, and its ribs.
  const neck: [V, number, number, number][] = [[v(0.5, 1.3, 0), 0.17, 0.15, -0.5], [v(0.58, 1.5, 0), 0.14, 0.12, -0.55], [v(0.66, 1.68, 0), 0.12, 0.1, -0.6], [v(0.72, 1.82, 0), 0.105, 0.09, -0.7]];
  for (const [c, rx, rz, tilt] of neck) add(ring(c, rx, rz, 0, tilt), 2, true);
  for (let k = 0; k < 6; k += 1) {
    const a = (k / 6) * Math.PI * 2;
    add(path(...neck.map(([c, rx, rz, tilt]) => v(c.x + Math.cos(a) * rx * Math.cos(tilt), c.y + Math.cos(a) * rx * Math.sin(tilt), c.z + Math.sin(a) * rz))), 2, true);
  }
  // The head: the skull and a tapering muzzle (rings and ribs), eyes, nostrils.
  const skull: [number, number, number, number][] = [[0.7, 1.89, 0.1, 0.09], [0.8, 1.87, 0.095, 0.085], [0.9, 1.82, 0.075, 0.066], [1.0, 1.77, 0.056, 0.05]];
  for (const [x, y, ry, rz] of skull) add(yzRing(v(x, y, 0), ry, rz), 2, true);
  for (let k = 0; k < 6; k += 1) {
    const a = (k / 6) * Math.PI * 2;
    add(path(...skull.map(([x, y, ry, rz]) => v(x, y + Math.cos(a) * ry, Math.sin(a) * rz))), 2, true);
  }
  for (const sz of [-1, 1]) add(xyRing(v(0.82, 1.93, sz * 0.082), 0.02), 2, true, 0.006);
  // Ears: leaf-shaped loops, up and out.
  for (const sz of [-1, 1]) {
    const ear = new THREE.CatmullRomCurve3([v(0.7, 1.97, sz * 0.07), v(0.66, 2.04, sz * 0.15), v(0.6, 2.06, sz * 0.24), v(0.63, 2.0, sz * 0.18), v(0.69, 1.95, sz * 0.1)], true);
    add(ear, 2, true);
  }
  // Antlers: a main beam each side sweeping up and back, five tines (the brow tine forward), one forked.
  for (const sz of [-1, 1]) {
    const beam = path(v(0.72, 1.98, sz * 0.06), v(0.68, 2.15, sz * 0.14), v(0.6, 2.32, sz * 0.22), v(0.5, 2.47, sz * 0.28), v(0.42, 2.6, sz * 0.3), v(0.35, 2.71, sz * 0.28));
    add(beam, 3, true, 0.01);
    const tines: [number, V][] = [
      [0.16, v(0.86, 2.2, sz * 0.12)], [0.36, v(0.74, 2.47, sz * 0.2)], [0.56, v(0.62, 2.66, sz * 0.33)],
      [0.76, v(0.52, 2.83, sz * 0.3)], [0.94, v(0.26, 2.86, sz * 0.22)],
    ];
    for (const [t, tip] of tines) {
      const base = beam.getPoint(t);
      const tine = path(base, base.clone().lerp(tip, 0.55).add(v(0, 0.03, 0)), tip);
      add(tine, 3, true, 0.007);
      if (t > 0.5 && t < 0.6) add(path(tine.getPoint(0.6), tip.clone().add(v(-0.1, 0.1, sz * 0.05))), 3, true, 0.006);
    }
  }
  // A red collar with a gold bell (not lit; the bulbs light it).
  const collar = new THREE.Mesh(new THREE.TubeGeometry(ring(v(0.52, 1.33, 0), 0.165, 0.15, 0, -0.5), 48, 0.022, 8, true), new THREE.MeshStandardMaterial({ color: 0xa8101c, roughness: 0.5, emissive: 0x200003 }));
  head.add(collar);
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 14), new THREE.MeshStandardMaterial({ color: 0xd9a33a, roughness: 0.25, metalness: 0.9, emissive: 0x2a1800 }));
  bell.position.set(0.66, 1.2, 0);
  head.add(bell);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
  nose.position.set(1.05, 1.76, 0);
  head.add(nose);
  // The head turns about the neck's base.
  const pivot = new THREE.Group();
  pivot.position.set(0.48, 1.2, 0);
  head.position.set(-0.48, -1.2, 0);
  pivot.add(head);
  g.add(pivot);
  const body = makeLeds(pts);
  const headLeds = makeLeds(headPts);
  const bodyPoints = ledPoints(body, 0.075);
  const headPoints = ledPoints(headLeds, 0.075);
  g.add(bodyPoints.points);
  head.add(headPoints.points);
  return { group: g, pivot, nose, body, headLeds, bodyPoints, headPoints };
}

// --- the cube of the showcase (a ticker of LEDs) --------------------------------------------------------------------
const CX = 17, CY = 9, CZ = 4;
/** Digits and a few signs, 3 × 5. */
const FONT: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'], '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'], '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'], '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'], ':': ['000', '010', '000', '010', '000'], ' ': ['000', '000', '000', '000', '000'],
  '*': ['101', '010', '111', '010', '101'],
};
function buildCube() {
  const g = new THREE.Group();
  const pts: { p: V; along: number; group: number }[] = [];
  const s = 0.075;
  for (let k = 0; k < CZ; k += 1) for (let j = 0; j < CY; j += 1) for (let i = 0; i < CX; i += 1) {
    pts.push({ p: v((i - (CX - 1) / 2) * s, 0.25 + j * s, (k - (CZ - 1) / 2) * s), along: i / (CX - 1), group: k });
  }
  const leds = makeLeds(pts);
  const points = ledPoints(leds, 0.06);
  g.add(points.points);
  // The frame: thin wires along the rows, a dark base.
  const lineGeo = new THREE.BufferGeometry();
  const lp: number[] = [];
  for (let k = 0; k < CZ; k += 1) for (let j = 0; j < CY; j += 1) lp.push(-(CX - 1) / 2 * s, 0.25 + j * s, (k - (CZ - 1) / 2) * s, (CX - 1) / 2 * s, 0.25 + j * s, (k - (CZ - 1) / 2) * s);
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  g.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0x5a6070, transparent: true, opacity: 0.35 })));
  const base = new THREE.Mesh(new THREE.BoxGeometry(CX * s + 0.1, 0.12, CZ * s + 0.12), new THREE.MeshStandardMaterial({ color: 0x0c0d12, roughness: 0.3, metalness: 0.4 }));
  base.position.y = 0.16;
  g.add(base);
  return { group: g, leds, points, base };
}

/** The showcase's camera distance (before the screen's proportions and the zoom). */
const SHOW_DIST = 8.6;

export async function createLedFigures(width: number, height: number) {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03040a);
  const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100);
  scene.add(new THREE.AmbientLight(0x404a66, 0.35));
  // Glow from the figures, for the hat, the scarf, the floor (colours set each frame from their LEDs).
  const glowS = new THREE.PointLight(0xbfd0ff, 4, 6, 1.6);
  const glowR = new THREE.PointLight(0xffe0b0, 3, 6, 1.6);
  const glowC = new THREE.PointLight(0xffc080, 2, 4, 1.6);
  scene.add(glowS, glowR, glowC);
  // The floor: a dark mirror, dimmed by a darker veil over it that thins towards the figures.
  const mirror = new Reflector(new THREE.CircleGeometry(9, 64), { textureWidth: Math.round(width / 2), textureHeight: Math.round(height / 2), color: 0x8a8a96 });
  mirror.rotation.x = -Math.PI / 2;
  scene.add(mirror);
  const veil = new THREE.Mesh(new THREE.CircleGeometry(9, 64), new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `varying vec3 vW; void main() { float d = length(vW.xz); gl_FragColor = vec4(0.012, 0.014, 0.025, mix(0.62, 0.97, smoothstep(1.0, 6.0, d))); }`,
  }));
  veil.rotation.x = -Math.PI / 2;
  veil.position.y = 0.002;
  scene.add(veil);

  const snowman = buildSnowman();
  const reindeer = buildReindeer();
  const cube = buildCube();
  scene.add(snowman.group, reindeer.group, cube.group);

  // The curtain of fairy lights behind, out of focus (big soft discs): the part that stays lit.
  const curtainPts: number[] = [];
  for (let s = 0; s < 34; s += 1) for (let i = 0; i < 26; i += 1) {
    curtainPts.push(-8 + s * 0.48 + (hash(s * 7 + i) - 0.5) * 0.1, 0.2 + i * 0.22 + Math.sin(s * 1.3) * 0.05, -4.5 - hash(s) * 0.6);
  }
  const curtainGeo = new THREE.BufferGeometry();
  curtainGeo.setAttribute('position', new THREE.Float32BufferAttribute(curtainPts, 3));
  const curtainSeed = new Float32Array(curtainPts.length / 3).map((_, i) => hash(i * 3.3));
  curtainGeo.setAttribute('seed', new THREE.BufferAttribute(curtainSeed, 1));
  const curtainU = { uTime: { value: 0 }, uLevel: { value: 1 }, uScale: { value: 600 } };
  const curtain = new THREE.Points(curtainGeo, new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: curtainU,
    vertexShader: /* glsl */ `
attribute float seed; uniform float uTime; uniform float uScale; varying float vS; varying float vB;
void main() {
  vS = seed;
  // Breathing very slowly, each its own phase: a background that never goes dark.
  vB = 0.75 + 0.25 * sin(uTime * (0.3 + seed * 0.4) + seed * 30.0);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = 0.3 * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
uniform float uLevel; varying float vS; varying float vB;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float q = length(d);
  if (q > 1.0) discard;
  // A bokeh disc: flat, a little brighter at the rim.
  float disc = (1.0 - smoothstep(0.85, 1.0, q)) * (0.7 + 0.3 * smoothstep(0.5, 0.95, q));
  vec3 c = mix(vec3(1.0, 0.72, 0.38), vec3(1.0, 0.85, 0.6), vS);
  gl_FragColor = vec4(c * disc * vB * uLevel * 0.045, 1.0);
}`,
  }));
  curtain.frustumCulled = false;
  scene.add(curtain);
  // Snow.
  const SNOW = 900;
  const snowPos = new Float32Array(SNOW * 3);
  for (let i = 0; i < SNOW; i += 1) snowPos.set([(hash(i) - 0.5) * 9, hash(i + 0.5) * 5, (hash(i + 0.7) - 0.5) * 6 - 0.5], i * 3);
  const snowGeo = new THREE.BufferGeometry();
  const snowAttr = new THREE.BufferAttribute(snowPos, 3).setUsage(THREE.DynamicDrawUsage);
  snowGeo.setAttribute('position', snowAttr);
  const snowU = { uScale: { value: 600 }, uLevel: { value: 1 } };
  const snow = new THREE.Points(snowGeo, new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: snowU,
    vertexShader: /* glsl */ `uniform float uScale; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = max(1.5, 0.03 * uScale / -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `uniform float uLevel; void main() { vec2 d = gl_PointCoord * 2.0 - 1.0; float r = dot(d, d); if (r > 1.0) discard; gl_FragColor = vec4(vec3(0.75, 0.8, 0.9) * exp(-r * 3.0) * uLevel * 0.6, 1.0); }`,
  }));
  snow.frustumCulled = false;
  scene.add(snow);

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(1);
  composer.setSize(width, height);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.6, 0.22, 0.6);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // --- programs --------------------------------------------------------------------------------------------------------
  let clock = 0;
  let mode = -1;
  let yaw = 0.35, pitch = 0.18;
  const drag = { on: false, x: 0, y: 0 };
  /** A figure's show after a click: until when. */
  const shows = { snowman: -10, reindeer: -10, cube: -10 };
  const PROGRAMS = 5;
  const progAt = (look: LedFiguresLook) => {
    if (look.program >= 1) return { a: Math.min(PROGRAMS, Math.round(look.program)) - 1, b: Math.min(PROGRAMS, Math.round(look.program)) - 1, f: 0 };
    const T = 10;
    const k = Math.floor(clock / T);
    const f = Math.max(0, (clock - k * T - (T - 1.5)) / 1.5);
    return { a: k % PROGRAMS, b: (k + 1) % PROGRAMS, f };
  };
  /** One LED's colour under program p: t its time, x its parameter (height or place along its wire), s its own seed. */
  const progColor = (p: number, t: number, x: number, s: number, kind: 'snow' | 'deer', beat: number, out: number[]) => {
    let r = 0, g = 0, b = 0;
    if (p === 0) {
      // Steady with twinkles: now and then one flares and dims.
      const tw = Math.pow(Math.max(0, Math.sin(t * (1.3 + s * 2.1) + s * 50)), 20) * 2.2;
      r = g = b = tw;
      if (kind === 'deer') { r *= 1.0; g *= 0.85; b *= 0.6; }
    } else if (p === 1) {
      // A wave running up (the snowman) / along the wires (the reindeer).
      const w = Math.pow(0.5 + 0.5 * Math.sin((x * 6 - t * 2.4) * Math.PI), 6) * 1.6;
      [r, g, b] = kind === 'snow' ? [0.6 * w, 0.8 * w, 1.2 * w] : [1.3 * w, 0.95 * w, 0.4 * w];
    } else if (p === 2) {
      // Colours sweeping through: ice blue → violet → warm.
      const [hr, hg, hb] = hsv((0.55 + 0.25 * Math.sin(t * 0.35) + x * 0.25 + s * 0.05) % 1, 0.75, 1.2);
      r = hr; g = hg; b = hb;
    } else if (p === 3) {
      // Breathing, in turn.
      const br = 0.5 + 0.5 * Math.sin(t * 1.4 - x * 3.0);
      r = g = b = br * 0.9;
    } else {
      // Sparkle: bursts here and there.
      const k = Math.floor(t * 3 + s * 7);
      const on = hash(k * 13.1 + s * 101) > 0.82 ? Math.max(0, 1 - (t * 3 + s * 7 - k) * 2.5) : 0;
      [r, g, b] = hash(k + s * 7) > 0.5 ? [2 * on, 1.8 * on, 1.2 * on] : [1.2 * on, 1.6 * on, 2.2 * on];
    }
    out[0] = r * beat; out[1] = g * beat; out[2] = b * beat;
  };
  const tmpA = [0, 0, 0], tmpB = [0, 0, 0];
  /** Colours of a set of LEDs: the steady base (cool white for the snowman, warm for the reindeer) and the programs
   * played over it, crossfaded. */
  const colourLeds = (leds: Leds, kind: 'snow' | 'deer', look: LedFiguresLook, beat: number, boost: number, xOf: (i: number) => number) => {
    const { a, b, f } = progAt(look);
    const base = kind === 'snow' ? [0.62, 0.72, 1.0] : [1.0, 0.82, 0.55];
    for (let i = 0; i < leds.n; i += 1) {
      const s = hash(i * 1.37 + (kind === 'snow' ? 0 : 50));
      const x = xOf(i);
      progColor(a, clock, x, s, kind, beat, tmpA);
      progColor(b, clock, x, s, kind, beat, tmpB);
      for (let ch = 0; ch < 3; ch += 1) {
        const pl = (tmpA[ch] * (1 - f) + tmpB[ch] * f) * look.play;
        leds.col[i * 3 + ch] = base[ch] * look.base + pl + boost * (ch === 2 ? 1.6 : 1.4) * hash(i + Math.floor(clock * 20));
      }
    }
  };
  /** Days and hours to the next New Year (local time). */
  const untilNewYear = () => {
    const now = new Date();
    const ny = new Date(now.getFullYear() + 1, 0, 1, 0, 0, 0);
    const ms = ny.getTime() - now.getTime();
    return { d: Math.floor(ms / 86400000), h: Math.floor((ms % 86400000) / 3600000), year: now.getFullYear() + 1 };
  };
  const colourCube = (look: LedFiguresLook, beat: number) => {
    const { d, h, year } = untilNewYear();
    const salute = clock < shows.cube;
    const text = salute || (d === 0 && h === 0) ? ` * ${year} * ` : `  ${d}:${String(h).padStart(2, '0')}  *  `;
    // The text as columns, scrolling right to left.
    const cols: number[][] = [];
    for (const ch of text) {
      const gl = FONT[ch] ?? FONT[' '];
      for (let cx = 0; cx < 3; cx += 1) cols.push(gl.map((row) => (row[cx] === '1' ? 1 : 0)));
      cols.push([0, 0, 0, 0, 0]);
    }
    const shift = Math.floor(clock * 6);
    const leds = cube.leds;
    for (let i = 0; i < leds.n; i += 1) {
      const ix = i % CX, iy = Math.floor(i / CX) % CY, iz = Math.floor(i / (CX * CY));
      const col = cols[(ix + shift) % cols.length];
      const row = 6 - iy;
      const lit = look.countdown && row >= 0 && row < 5 && iz >= CZ - 2 ? col[row] : 0;
      // The letters warm and bright on the front two layers, a slow rainbow drifting through the rest.
      const [hr, hg, hb] = hsv((ix / CX * 0.5 + iy / CY * 0.2 + clock * 0.1) % 1, 0.8, 1);
      const bg = (look.countdown ? 0.22 : 0.55) * (0.6 + 0.4 * Math.sin(clock * 2 + iz + ix * 0.4));
      const sal = salute ? Math.max(0, Math.sin(clock * 20 + i)) * 1.5 : 0;
      leds.col[i * 3] = lit * 2.4 * beat + hr * bg + sal;
      leds.col[i * 3 + 1] = lit * 1.7 * beat + hg * bg + sal * 0.8;
      leds.col[i * 3 + 2] = lit * 0.8 * beat + hb * bg + sal * 0.4;
    }
    cube.points.colAttr.needsUpdate = true;
  };

  const ray = new THREE.Raycaster();
  const hitSphere = (cx: number, cy: number, w: number, h: number) => {
    ray.setFromCamera(new THREE.Vector2((cx / w) * 2 - 1, -(cy / h) * 2 + 1), camera);
    const tests: [keyof typeof shows, THREE.Object3D, number, number][] = [['snowman', snowman.group, 1.3, 1.3], ['reindeer', reindeer.group, 1.3, 1.1], ['cube', cube.group, 0.6, 0.6]];
    for (const [name, obj, y, r] of tests) {
      if (!obj.visible) continue;
      const c = new THREE.Vector3(0, y * obj.scale.y, 0).add(obj.position);
      if (ray.ray.distanceSqToPoint(c) < r * r) return name;
    }
    return null;
  };

  // The ticker's height in the showcase (it bobs round it).
  let cubeY = -0.08;
  const layout = (m: number) => {
    snowman.group.visible = m === 1 || m === 3;
    reindeer.group.visible = m === 2 || m === 3;
    cube.group.visible = m === 3;
    curtain.visible = m === 3;
    cube.base.visible = m !== 3;
    if (m === 3) {
      // (owner: «снеговик с левого края, а олень с правого … часы где-то вверху пусть парят») The snowman by the left
      // edge and the reindeer by the right one, wherever the edges are for this screen's proportions (the half width
      // seen at the figures' depth); the reindeer turned to face in, towards the viewer; the ticker hovering high up
      // in the middle (it bobs, see update).
      const aspect = width / height;
      const halfW = Math.tan(((camera.fov / 2) * Math.PI) / 180) * SHOW_DIST * Math.max(1, 1.1 / aspect) * aspect;
      snowman.group.position.set(-halfW * 0.7, 0, 0.1);
      reindeer.group.position.set(halfW * 0.76, 0, -0.35);
      reindeer.group.rotation.y = Math.PI + 0.45;
      cubeY = 2.5;
      cube.group.position.set(0, cubeY, 0.2);
      cube.group.scale.setScalar(0.75);
      cube.group.rotation.y = -0.2;
      yaw = 0;
      pitch = 0.12;
    } else {
      snowman.group.position.set(0, 0, 0);
      reindeer.group.position.set(-0.1, 0, 0);
      reindeer.group.rotation.y = -0.6;
    }
  };

  // The mirror renders the scene into a half-size target: the LEDs' sprites (sized from the full height) would come out
  // twice as large there — and, added up, brighter than the figures (owner: «в отражении олень ярче!»). Halved while it
  // renders.
  const sprites = () => [snowman.hatPoints.mat.uniforms, snowman.innerMat.uniforms, reindeer.bodyPoints.mat.uniforms, reindeer.headPoints.mat.uniforms, cube.points.mat.uniforms, curtainU, snowU];
  const reflect = mirror.onBeforeRender.bind(mirror);
  mirror.onBeforeRender = (...args: Parameters<typeof reflect>) => {
    const us = sprites();
    const saved = us.map((u) => u.uScale.value as number);
    for (const u of us) u.uScale.value = (u.uScale.value as number) * 0.5;
    reflect(...args);
    us.forEach((u, i) => { u.uScale.value = saved[i]; });
  };

  return {
    canvas,
    update(dt: number, look: LedFiguresLook, ptr: { x: number; y: number; pressed: boolean; clicked: boolean; active: boolean }, cssW: number, cssH: number) {
      clock += dt * look.speed;
      if (look.mode !== mode) {
        mode = look.mode;
        layout(mode);
      }
      // The beat: 120 a minute, a quick rise and a slower fall.
      const beatPhase = (clock * 2) % 1;
      const beat = look.beat ? 0.35 + 0.95 * Math.exp(-beatPhase * 5) : 1;
      // A click on a figure fires its show; dragging turns the view.
      if (ptr.clicked) {
        const hit = hitSphere(ptr.x, ptr.y, cssW, cssH);
        if (hit) shows[hit] = clock + 3;
        drag.on = true;
        drag.x = ptr.x;
        drag.y = ptr.y;
      }
      if (!ptr.pressed) drag.on = false;
      // (the view no longer sways by itself — owner: «не двигай сцену!»; only a drag or the camera control turns it)
      if (drag.on) {
        yaw -= (ptr.x - drag.x) * 0.006;
        pitch = Math.max(-0.05, Math.min(0.8, pitch + (ptr.y - drag.y) * 0.004));
        drag.x = ptr.x;
        drag.y = ptr.y;
      }
      // The camera round the middle of what is shown.
      const target = mode === 3 ? v(0, 1.1, 0) : mode === 1 ? v(0, 1.35, 0) : v(0.2, 1.25, 0);
      const cam = look.cam ?? { yaw: 0, pitch: 0, zoom: 1 };
      const dist = ((mode === 3 ? SHOW_DIST : 5.2) * Math.max(1, (cssH / cssW) * 1.1)) / cam.zoom;
      const cy = yaw + cam.yaw;
      const cpt = Math.max(-0.3, Math.min(1.35, pitch + cam.pitch));
      camera.position.set(target.x + Math.sin(cy) * Math.cos(cpt) * dist, target.y + Math.sin(cpt) * dist, target.z + Math.cos(cy) * Math.cos(cpt) * dist);
      camera.lookAt(target);
      // The snowman's LEDs: height in the ball as the program's place.
      if (snowman.group.visible) {
        const boost = clock < shows.snowman ? 1.5 * (shows.snowman - clock) / 3 : 0;
        colourLeds(snowman.inner, 'snow', look, beat, boost, (i) => snowman.inner.along[i] * 0.33 + snowman.inner.group[i] * 0.33);
        snowman.innerCol.needsUpdate = true;
        const data = snowman.texData;
        for (let i = 0; i < snowman.inner.n; i += 1) {
          data.set([snowman.inner.pos[i * 3], snowman.inner.pos[i * 3 + 1], snowman.inner.pos[i * 3 + 2], 1], i * 4);
          data.set([snowman.inner.col[i * 3], snowman.inner.col[i * 3 + 1], snowman.inner.col[i * 3 + 2], 1], 256 * 4 + i * 4);
        }
        snowman.tex.needsUpdate = true;
        // (the fabric's LEDs sit in the snowman's own frame: offset by its place)
        snowman.group.updateMatrixWorld();
        const o = snowman.group.position;
        for (let i = 0; i < snowman.inner.n; i += 1) {
          data[i * 4] += o.x; data[i * 4 + 1] += o.y; data[i * 4 + 2] += o.z;
        }
        // The hat's string: warm white bulbs with a red and a green one in turn, a chase running round it.
        const hl = snowman.hatLeds;
        for (let i = 0; i < hl.n; i += 1) {
          const kind = i % 4;
          const c = kind === 1 ? [1.7, 0.16, 0.1] : kind === 3 ? [0.25, 1.3, 0.35] : [1.6, 1.1, 0.55];
          const chase = 0.55 + 0.6 * look.play * Math.pow(Math.max(0, Math.sin(clock * 3 - i * 0.55)), 4);
          const tw = 1 + boost * hash(i + Math.floor(clock * 20));
          for (let ch = 0; ch < 3; ch += 1) hl.col[i * 3 + ch] = c[ch] * (0.4 + 0.6 * look.base) * chase * beat * tw;
        }
        snowman.hatPoints.colAttr.needsUpdate = true;
        snowman.fabricU.uTime.value = clock;
        snowman.hatU.uTime.value = clock;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < snowman.inner.n; i += 1) { r += snowman.inner.col[i * 3]; g += snowman.inner.col[i * 3 + 1]; b += snowman.inner.col[i * 3 + 2]; }
        const k = 1 / Math.max(1, snowman.inner.n);
        glowS.color.setRGB(r * k, g * k, b * k);
        glowS.position.set(o.x, 1.4, o.z + 0.8);
        glowS.intensity = 6;
      }
      glowS.visible = snowman.group.visible;
      if (reindeer.group.visible) {
        const boost = clock < shows.reindeer ? 1.4 * (shows.reindeer - clock) / 3 : 0;
        colourLeds(reindeer.body, 'deer', look, beat, boost, (i) => reindeer.body.along[i]);
        colourLeds(reindeer.headLeds, 'deer', look, beat, boost, (i) => reindeer.headLeds.along[i]);
        // The antlers in colour while the others play, and a running sparkle along them.
        for (let i = 0; i < reindeer.headLeds.n; i += 1) {
          if (reindeer.headLeds.group[i] !== 3) continue;
          const [hr, hg, hb] = hsv((reindeer.headLeds.along[i] * 0.6 + clock * 0.15) % 1, 0.7, 1);
          const w = 0.5 * look.play;
          reindeer.headLeds.col[i * 3] = reindeer.headLeds.col[i * 3] * (1 - w) + hr * w * 1.3;
          reindeer.headLeds.col[i * 3 + 1] = reindeer.headLeds.col[i * 3 + 1] * (1 - w) + hg * w * 1.3;
          reindeer.headLeds.col[i * 3 + 2] = reindeer.headLeds.col[i * 3 + 2] * (1 - w) + hb * w * 1.3;
        }
        reindeer.bodyPoints.colAttr.needsUpdate = true;
        reindeer.headPoints.colAttr.needsUpdate = true;
        // The head nods now and then; Rudolph's nose blinks (fast during its show).
        const nod = Math.sin(clock * 0.9) * 0.12 + Math.max(0, Math.sin(clock * 0.37)) ** 8 * 0.25;
        reindeer.pivot.rotation.z = -nod;
        const blink = clock < shows.reindeer ? (Math.sin(clock * 18) > 0 ? 1 : 0.1) : 0.4 + 0.6 * Math.max(0, Math.sin(clock * 2.5));
        (reindeer.nose.material as THREE.MeshBasicMaterial).color.setRGB(1.6 * blink, 0.08 * blink, 0.08 * blink);
        const o = reindeer.group.position;
        glowR.position.set(o.x, 1.2, o.z + 0.8);
        glowR.color.setRGB(1, 0.85, 0.6);
        glowR.intensity = 3 * look.base + 2 * look.play;
      }
      glowR.visible = reindeer.group.visible;
      if (cube.group.visible) {
        colourCube(look, beat);
        // Hovering: a slow bob and sway.
        cube.group.position.y = cubeY + 0.05 * Math.sin(clock * 1.2);
        cube.group.rotation.y = -0.2 + 0.08 * Math.sin(clock * 0.5);
        glowC.position.set(cube.group.position.x, 0.5, cube.group.position.z + 0.5);
      }
      glowC.visible = cube.group.visible;
      // The curtain and the snow.
      curtainU.uTime.value = clock;
      curtainU.uLevel.value = look.curtain;
      snow.visible = look.snow > 0.01;
      snowU.uLevel.value = look.snow;
      for (let i = 0; i < SNOW; i += 1) {
        snowPos[i * 3 + 1] -= dt * (0.25 + hash(i) * 0.25) * look.speed;
        snowPos[i * 3] += Math.sin(clock * 0.7 + i) * dt * 0.05;
        if (snowPos[i * 3 + 1] < 0) snowPos[i * 3 + 1] += 5;
      }
      snowAttr.needsUpdate = true;
      bloom.strength = look.bloom * 0.6;
      renderer.toneMappingExposure = look.exposure;
      const scale = height * 0.9;
      for (const m of [snowman.hatPoints.mat, snowman.innerMat, reindeer.bodyPoints.mat, reindeer.headPoints.mat, cube.points.mat]) m.uniforms.uScale.value = scale;
      curtainU.uScale.value = scale;
      snowU.uScale.value = scale;
    },
    render() {
      composer.render();
    },
    dispose() {
      composer.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      snowman.tex.dispose();
      mirror.getRenderTarget().dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

export type LedFigures = Awaited<ReturnType<typeof createLedFigures>>;
