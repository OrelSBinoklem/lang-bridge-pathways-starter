'use client';

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import type { PointerState } from './engine';

/**
 * A night pond: real mirror-reflecting water (three's Water, the same one the site logo uses) with paper lanterns
 * drifting on it, so every lantern, the moon and the torii are reflected and rippled by the waves. Around it: a
 * moonlit sky with stars, far mountains, a torii gate in the mist, fireflies and a blossoming sakura branch whose
 * petals fall onto the water. Ripple rings spread from each lantern and from the cursor.
 */

const CAMERA_FOV = 45;
const CAMERA_DISTANCE = 26;
const RING_POOL = 30;
const BLOSSOM_COUNT = 72;
const FOG_COLOR = 0x111a3d;

export type LanternKind = 'mixed' | 'cube' | 'lotus' | 'boat' | 'toro' | 'chochin' | 'painted';
export const LANTERN_KIND_LABELS: Record<LanternKind, string> = {
  mixed: 'Разные (больше квадратных)',
  cube: 'Квадратные на деревянной основе',
  lotus: 'Лотос со свечой',
  boat: 'Лодочки со свечой',
  toro: 'Храмовые (торо) с крышей',
  chochin: 'Круглые (тётин)',
  painted: 'Расписные (Фудзи, сакура)',
};

export type LanternWaterTuningParams = {
  lanternType: LanternKind;
  count: number;
  size: number;
  speed: number;
  glow: number;
  flicker: number;
  waves: number;
  rings: boolean;
  ringDistortion: number;
  ringSpeed: number;
  ringReach: number;
  ringHeight: number;
  reflections: boolean;
  reflectionStrength: number;
  sakura: boolean;
  sakuraBloom: boolean;
  torii: boolean;
  fireflies: number;
  petals: number;
};

/** `fullPage`: the pond seen over the whole page (BodyLanternWaterEffect) — smaller lanterns, more of them, more fireflies and petals. */
export function createLanternWaterParams(fullPage = false): LanternWaterTuningParams {
  const base: LanternWaterTuningParams = {
    lanternType: 'mixed',
    count: 8,
    size: 1.4,
    speed: 1,
    glow: 1,
    flicker: 1,
    waves: 3.2,
    rings: true,
    ringDistortion: 1.8,
    ringSpeed: 0.9,
    ringReach: 2.4,
    ringHeight: 1,
    reflections: true,
    reflectionStrength: 0.55,
    sakura: true,
    sakuraBloom: true,
    torii: true,
    fireflies: 30,
    petals: 34,
  };
  return fullPage ? { ...base, count: 14, size: 0.9, fireflies: 60, petals: 60 } : base;
}

const KIND_WEIGHTS: [Exclude<LanternKind, 'mixed'>, number][] = [
  ['cube', 0.34],
  ['lotus', 0.2],
  ['boat', 0.14],
  ['toro', 0.1],
  ['chochin', 0.11],
  ['painted', 0.11],
];
function pickKind(kind: LanternKind): Exclude<LanternKind, 'mixed'> {
  if (kind !== 'mixed') return kind;
  let roll = Math.random();
  for (const [k, w] of KIND_WEIGHTS) {
    roll -= w;
    if (roll <= 0) return k;
  }
  return 'cube';
}

function radialTexture(stops: [number, string][], size = 128): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [at, color] of stops) g.addColorStop(at, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

const SAKURA_COLORS = ['#ffd3e3', '#f8b4cf', '#f391b7', '#ffe8f0'];

/**
 * A cluster of five-petal flowers over a pink haze, the same read as the "На природе" sakura tree,
 * plus a brighter core so the blossoms catch the lantern light instead of looking like flat dots.
 */
function blossomClusterTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const haze = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.48);
  haze.addColorStop(0, 'rgba(255,196,220,0.6)');
  haze.addColorStop(1, 'rgba(255,190,215,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, size, size);
  for (let f = 0; f < 9; f += 1) {
    const dir = Math.random() * Math.PI * 2;
    const dist = Math.random() * size * 0.28;
    const cx = size / 2 + Math.cos(dir) * dist;
    const cy = size / 2 + Math.sin(dir) * dist;
    const r = size * (0.08 + Math.random() * 0.05);
    ctx.fillStyle = SAKURA_COLORS[Math.floor(Math.random() * SAKURA_COLORS.length)];
    const offset = Math.random() * Math.PI;
    for (let p = 0; p < 5; p += 1) {
      const a = offset + (p / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7, r * 0.62, r * 0.48, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffeaa0';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** One sakura petal: rounded, with the notch at the tip, on a faint glow. */
function sakuraPetalTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const glow = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  glow.addColorStop(0, 'rgba(255,225,238,0.5)');
  glow.addColorStop(1, 'rgba(255,190,215,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  const s = size / 2;
  ctx.translate(s, s);
  ctx.scale(size * 0.78, size * 0.78);
  ctx.beginPath();
  ctx.moveTo(0, 0.46);
  ctx.bezierCurveTo(0.4, 0.3, 0.5, -0.26, 0.19, -0.46);
  ctx.lineTo(0, -0.33);
  ctx.lineTo(-0.19, -0.46);
  ctx.bezierCurveTo(-0.5, -0.26, -0.4, 0.3, 0, 0.46);
  const fill = ctx.createLinearGradient(0, -0.5, 0, 0.5);
  fill.addColorStop(0, '#fff1f6');
  fill.addColorStop(1, '#f391b7');
  ctx.fillStyle = fill;
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Paper of a chochin lantern: warm glow with dark vertical ribs and a glyph. */
function paperTexture(glyph: string, tone: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, tone);
  g.addColorStop(0.5, '#ffe2a0');
  g.addColorStop(1, tone);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = 'rgba(120,40,10,0.55)';
  ctx.lineWidth = 2;
  for (let y = 10; y < 128; y += 14) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(140,20,20,0.9)';
  ctx.font = 'bold 74px "Yu Gothic","Noto Sans JP","Hiragino Sans",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const x of [64, 192]) ctx.fillText(glyph, x, 66);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

/** Bulging chochin silhouette: a lathe around the Y axis. */
function lanternGeometry(): THREE.LatheGeometry {
  const points: THREE.Vector2[] = [];
  for (let i = 0; i <= 12; i += 1) {
    const t = i / 12;
    points.push(new THREE.Vector2(0.42 + 0.5 * Math.pow(Math.sin(Math.PI * t), 0.7), (t - 0.5) * 1.5));
  }
  return new THREE.LatheGeometry(points, 22);
}

/** A live ripple: pure data, nothing drawn for it directly — see the comment where the pool is built. */
type Ring = { x: number; z: number; age: number; life: number; size: number };

type Lantern = {
  group: THREE.Group;
  glow: THREE.Sprite;
  /** Candle flames that flicker on their own, on top of the lantern's overall glow. */
  flames: THREE.Sprite[];
  pool: THREE.Mesh;
  lift: number;
  x: number;
  z: number;
  speed: number;
  phase: number;
  scale: number;
  ringTimer: number;
  /** The lantern's own, damped read of the wave underneath it — see the comment in `stepLanterns` for why this
   * exists instead of just using the raw wave height straight from `waveHeightAt`. */
  swell: number;
  tiltX: number;
  tiltZ: number;
  /** The ripple this lantern itself most recently spawned, if it's still alive — excluded from its own wave
   * sampling (see `stepLanterns`), so it doesn't get thrown by a ring exploding from directly underneath it. */
  ownRing: Ring | null;
};

/** Square paper panel lit from inside, with a few faint brush strokes. */
function cubePaperTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 70, 4, 64, 64, 90);
  g.addColorStop(0, '#fff8c8');
  g.addColorStop(0.55, '#ffc65a');
  g.addColorStop(1, '#ff9a30');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(90,40,10,0.32)';
  ctx.lineWidth = 3;
  for (let x = 26; x < 110; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 22 + Math.random() * 10);
    ctx.lineTo(x + Math.random() * 4 - 2, 90 + Math.random() * 14);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(canvas);
}

/** A cream lantern with a painted motif: kanji, red sun, cherry twig and waves. */
function paintedTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 384);
  g.addColorStop(0, '#fff6df');
  g.addColorStop(1, '#ffe7b8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 384);
  ctx.strokeStyle = 'rgba(150,120,80,0.28)';
  ctx.lineWidth = 1.5;
  for (let y = 6; y < 384; y += 9) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  ctx.fillStyle = '#141414';
  ctx.font = 'bold 76px "Yu Gothic","Noto Sans JP","Hiragino Sans",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ['富', '士', '山'].forEach((ch, i) => ctx.fillText(ch, 58, 70 + i * 82));
  ctx.fillStyle = '#d8281f';
  ctx.beginPath();
  ctx.arc(176, 236, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5a3520';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(150, 190);
  ctx.quadraticCurveTo(190, 130, 206, 70);
  ctx.stroke();
  ctx.fillStyle = '#d8281f';
  for (const [x, y] of [[200, 84], [178, 118], [212, 132], [160, 156]]) {
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#1f7d86';
  ctx.fillRect(0, 312, 256, 72);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  for (let x = 18; x < 256; x += 42) {
    ctx.beginPath();
    ctx.arc(x, 332, 16, Math.PI, Math.PI * 2);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(canvas);
}

type Tracker = <T extends { dispose: () => void }>(o: T) => T;
type LanternShared = {
  halo: THREE.Texture;
  flame: THREE.Texture;
  papers: THREE.Texture[];
  cube: THREE.Texture;
  painted: THREE.Texture;
  caps: THREE.Material;
  wood: THREE.Material;
  wax: THREE.Material;
  lathe: THREE.BufferGeometry;
  capGeometry: THREE.BufferGeometry;
};
type LanternBuild = { group: THREE.Group; lift: number; centerY: number; glowSize: number; flames: THREE.Sprite[] };

function basic(track: Tracker, params: THREE.MeshBasicMaterialParameters) {
  return track(new THREE.MeshBasicMaterial({ toneMapped: false, ...params }));
}

/** Teardrop candle flame: a warm sprite that the frame loop makes dance. */
function flameTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 62, 2, 32, 56, 34);
  g.addColorStop(0, 'rgba(255,255,240,1)');
  g.addColorStop(0.25, 'rgba(255,226,140,0.95)');
  g.addColorStop(0.6, 'rgba(255,150,50,0.5)');
  g.addColorStop(1, 'rgba(255,120,30,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(32, 4);
  ctx.bezierCurveTo(52, 44, 54, 74, 32, 92);
  ctx.bezierCurveTo(10, 74, 12, 44, 32, 4);
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}

/** Adds a lit candle (wax stub + flame) at `y`; the returned sprite is animated per frame. */
function addCandle(group: THREE.Group, track: Tracker, shared: LanternShared, y: number, scale: number): THREE.Sprite {
  const wax = new THREE.Mesh(track(new THREE.CylinderGeometry(0.15 * scale, 0.17 * scale, 0.3 * scale, 10)), shared.wax);
  wax.position.y = y + 0.15 * scale;
  group.add(wax);
  const flame = new THREE.Sprite(
    track(new THREE.SpriteMaterial({ map: shared.flame, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })),
  );
  flame.scale.set(0.34 * scale, 0.52 * scale, 1);
  flame.position.y = y + 0.52 * scale;
  flame.userData.baseY = flame.position.y;
  flame.userData.baseScale = flame.scale.clone();
  group.add(flame);
  return flame;
}

function buildLantern(kind: Exclude<LanternKind, 'mixed'>, index: number, track: Tracker, shared: LanternShared): LanternBuild {
  const group = new THREE.Group();
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, y: number) => {
    const m = new THREE.Mesh(track(geometry), material);
    m.position.y = y;
    group.add(m);
    return m;
  };
  let lift = 0.05;
  let centerY = 0.6;
  let glowSize = 3.4;
  const flames: THREE.Sprite[] = [];
  if (kind === 'lotus') {
    // A paper lotus: a ring of petals around a lit candle, like the floating ones at a lantern festival.
    const palette = [
      [0xe23b22, 0xf7b733],
      [0xf5a623, 0xffd66b],
      [0xd9342b, 0xffb347],
    ] as const;
    const [outer, inner] = palette[index % palette.length];
    const petalGeometry = track(new THREE.CircleGeometry(0.62, 3));
    const outerMaterial = basic(track, { color: outer, side: THREE.DoubleSide });
    const innerMaterial = basic(track, { color: inner, side: THREE.DoubleSide });
    for (let ring = 0; ring < 2; ring += 1) {
      const petals = ring === 0 ? 8 : 6;
      for (let p = 0; p < petals; p += 1) {
        const petal = new THREE.Mesh(petalGeometry, ring === 0 ? outerMaterial : innerMaterial);
        const angle = (p / petals) * Math.PI * 2 + ring * 0.4;
        const radius = ring === 0 ? 0.62 : 0.4;
        petal.position.set(Math.cos(angle) * radius, ring === 0 ? 0.16 : 0.3, Math.sin(angle) * radius);
        petal.scale.setScalar(ring === 0 ? 1 : 0.78);
        petal.rotation.y = -angle + Math.PI / 2;
        petal.rotation.x = ring === 0 ? -0.95 : -0.65;
        group.add(petal);
      }
    }
    mesh(new THREE.CylinderGeometry(0.46, 0.34, 0.16, 14), basic(track, { color: outer }), 0.08);
    flames.push(addCandle(group, track, shared, 0.16, 1));
    lift = 0.03;
    centerY = 0.42;
    glowSize = 3;
  } else if (kind === 'chochin') {
    const body = new THREE.Mesh(shared.lathe, basic(track, { map: shared.papers[index % shared.papers.length] }));
    const top = new THREE.Mesh(shared.capGeometry, shared.caps);
    top.position.y = 0.8;
    const bottom = new THREE.Mesh(shared.capGeometry, shared.caps);
    bottom.position.y = -0.8;
    group.add(body, top, bottom);
    lift = 0.8;
    centerY = 0;
    glowSize = 4.2;
  } else if (kind === 'cube') {
    mesh(new THREE.BoxGeometry(1.55, 0.12, 1.55), shared.wood, 0.06);
    flames.push(addCandle(group, track, shared, 0.12, 1.15));
    mesh(new THREE.BoxGeometry(1, 1.05, 1), basic(track, { map: shared.cube, transparent: true, opacity: 0.86 }), 0.65);
    mesh(new THREE.BoxGeometry(1.08, 0.07, 1.08), shared.caps, 1.2);
    centerY = 0.68;
    glowSize = 3.6;
  } else if (kind === 'toro') {
    const hull = basic(track, { color: 0x8c2a1a });
    mesh(new THREE.BoxGeometry(2.1, 0.16, 1.05), hull, 0.08);
    for (const side of [-1, 1]) {
      const bow = mesh(new THREE.BoxGeometry(0.42, 0.14, 1), hull, 0.2);
      bow.position.x = side * 1.12;
      bow.rotation.z = side * -0.5;
    }
    flames.push(addCandle(group, track, shared, 0.18, 1));
    mesh(new THREE.BoxGeometry(0.85, 0.85, 0.85), basic(track, { map: shared.cube, transparent: true, opacity: 0.85 }), 0.6);
    const roof = mesh(new THREE.ConeGeometry(0.98, 0.5, 4), basic(track, { color: 0x4a2418 }), 1.27);
    roof.rotation.y = Math.PI / 4;
    mesh(new THREE.SphereGeometry(0.09, 8, 6), basic(track, { color: 0xd8b060 }), 1.56);
    centerY = 0.62;
    glowSize = 3.8;
  } else if (kind === 'boat') {
    const palette = [0xd63a24, 0xf2a326, 0xffc24d];
    const color = palette[index % palette.length];
    mesh(new THREE.CylinderGeometry(1.05, 0.5, 0.38, 8, 1, true), basic(track, { color, side: THREE.DoubleSide }), 0.19);
    const arch = mesh(
      new THREE.CylinderGeometry(0.62, 0.62, 0.62, 20, 1, true, -Math.PI / 2, Math.PI),
      basic(track, { color: new THREE.Color(color).lerp(new THREE.Color(0xffe6a0), 0.35), side: THREE.DoubleSide }),
      0.3,
    );
    arch.rotation.x = -Math.PI / 2;
    flames.push(addCandle(group, track, shared, 0.3, 1.2));
    centerY = 0.5;
    glowSize = 3.2;
  } else {
    mesh(new THREE.CylinderGeometry(0.88, 0.88, 0.08, 20), shared.wood, 0.04);
    mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.7, 28, 1, true), basic(track, { map: shared.painted, side: THREE.DoubleSide }), 0.98);
    mesh(new THREE.CylinderGeometry(0.67, 0.67, 0.1, 24), shared.caps, 1.87);
    mesh(new THREE.CylinderGeometry(0.67, 0.67, 0.1, 24), shared.caps, 0.16);
    lift = 0.02;
    centerY = 0.98;
    glowSize = 3.8;
  }
  const glow = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: shared.halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
  glow.scale.set(glowSize, glowSize, 1);
  glow.position.y = centerY;
  group.add(glow);
  group.userData.glow = glow;
  return { group, lift, centerY, glowSize, flames };
}

/** How many live ripples the water shader can bend around at once. */
const RING_SLOTS = 16;

/**
 * Teaches three's Water shader about our ripple rings. Water derives both its lighting and the
 * offset it samples the mirror texture with from `surfaceNormal`, so adding the rings' slope there
 * makes them bend the real reflections (lanterns, moon, torii) instead of only drawing a bright
 * circle on top. Each slot is (centre x, centre z, current radius, amplitude).
 */
function patchWaterWithRings(material: THREE.ShaderMaterial) {
  material.uniforms.rings = { value: Array.from({ length: RING_SLOTS }, () => new THREE.Vector4()) };
  material.uniforms.ringStrength = { value: 1 };
  material.defines = { ...material.defines, RING_SLOTS };
  material.fragmentShader = material.fragmentShader
    .replace(
      'void main() {',
      `uniform vec4 rings[ RING_SLOTS ];
      uniform float ringStrength;

      // Slope of a decaying ring wave: a crest travelling out from the centre, narrow at first and
      // fading as it grows. Returned in the water plane's xz, to be added to the normal.
      vec2 ringSlope( vec2 p ) {
        vec2 slope = vec2( 0.0 );
        for ( int i = 0; i < RING_SLOTS; i ++ ) {
          vec4 ring = rings[ i ];
          if ( ring.w <= 0.0 ) continue;
          vec2 d = p - ring.xy;
          float dist = length( d );
          if ( dist < 0.0001 ) continue;
          float x = dist - ring.z;
          float width = 0.6 + ring.z * 0.22;
          float envelope = exp( - ( x * x ) / ( width * width ) );
          slope += ( d / dist ) * sin( x * 2.6 ) * envelope * ring.w;
        }
        return slope * ringStrength;
      }

      void main() {`,
    )
    .replace(
      'vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );',
      `vec2 ripple = ringSlope( worldPosition.xz );
      vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) + vec3( ripple.x, 0.0, ripple.y ) );`,
    );
}

function buildScene(halfWidth: number, halfHeight: number, params: LanternWaterTuningParams) {
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(o: T): T => {
    disposables.push(o);
    return o;
  };
  const root = new THREE.Group();

  // --- sky dome with a gradient and stars: what the water mirrors besides the objects ---
  const skyMaterial = track(
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {},
      vertexShader: 'varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);}',
      fragmentShader: `varying vec3 vPos; void main(){
        float h = clamp(normalize(vPos).y, 0.0, 1.0);
        vec3 horizon = vec3(0.30, 0.25, 0.42);
        vec3 mid = vec3(0.09, 0.12, 0.30);
        vec3 top = vec3(0.02, 0.03, 0.10);
        vec3 c = mix(horizon, mid, smoothstep(0.0, 0.25, h));
        c = mix(c, top, smoothstep(0.2, 0.9, h));
        gl_FragColor = vec4(c, 1.0); }`,
    }),
  );
  const dome = new THREE.Mesh(track(new THREE.SphereGeometry(300, 24, 16)), skyMaterial);
  dome.renderOrder = -10;
  root.add(dome);

  const starPositions = new Float32Array(160 * 3);
  for (let i = 0; i < 160; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const e = 0.12 + Math.random() * 0.85;
    const r = 280;
    starPositions[i * 3] = Math.cos(a) * Math.cos(e) * r;
    starPositions[i * 3 + 1] = Math.sin(e) * r;
    starPositions[i * 3 + 2] = -Math.abs(Math.sin(a) * Math.cos(e) * r) - 20;
  }
  const starGeometry = track(new THREE.BufferGeometry());
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  root.add(new THREE.Points(starGeometry, track(new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.4, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }))));

  // --- moon ---
  const moonGlowTexture = track(radialTexture([[0, 'rgba(230,240,255,0.9)'], [0.25, 'rgba(190,210,255,0.35)'], [1, 'rgba(160,190,255,0)']], 256));
  const moon = new THREE.Mesh(track(new THREE.CircleGeometry(4.2, 40)), track(new THREE.MeshBasicMaterial({ color: 0xf4f7ff, fog: false })));
  moon.position.set(halfWidth * 0.55, halfHeight * 1.5 + 4, -160);
  moon.scale.setScalar(2.3);
  const moonHalo = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: moonGlowTexture, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })));
  moonHalo.scale.set(60, 60, 1);
  moon.add(moonHalo);
  root.add(moon);

  // --- far mountains and a torii gate in the mist ---
  const mountainMaterial = track(new THREE.MeshBasicMaterial({ color: 0x0c1230 }));
  for (const [x, s, z] of [[-70, 1.3, -170], [10, 1.8, -190], [80, 1.2, -165], [-20, 0.9, -150]] as const) {
    const m = new THREE.Mesh(track(new THREE.ConeGeometry(38, 24, 6)), mountainMaterial);
    m.position.set(x, 10 * s - 4, z);
    m.scale.set(1.4, s, 1);
    root.add(m);
  }
  const toriiMaterial = track(new THREE.MeshBasicMaterial({ color: 0xa8231b }));
  const torii = new THREE.Group();
  for (const x of [-2.4, 2.4]) {
    const pillar = new THREE.Mesh(track(new THREE.CylinderGeometry(0.28, 0.34, 7, 10)), toriiMaterial);
    pillar.position.set(x, 3.5, 0);
    torii.add(pillar);
  }
  const beam = new THREE.Mesh(track(new THREE.BoxGeometry(7.6, 0.5, 0.6)), toriiMaterial);
  beam.position.y = 6.6;
  const beam2 = new THREE.Mesh(track(new THREE.BoxGeometry(6, 0.3, 0.4)), toriiMaterial);
  beam2.position.y = 5.5;
  torii.add(beam, beam2);
  torii.position.set(-halfWidth * 0.75, 0, -46);
  torii.scale.setScalar(1.15);
  torii.visible = params.torii;
  root.add(torii);

  // --- lanterns ---
  const halo = track(radialTexture([[0, 'rgba(255,190,90,0.95)'], [0.3, 'rgba(255,150,60,0.4)'], [1, 'rgba(255,120,40,0)']], 128));
  const shared: LanternShared = {
    halo,
    flame: track(flameTexture()),
    papers: [track(paperTexture('福', '#ff9c3f')), track(paperTexture('旅', '#ffb04d')), track(paperTexture('灯', '#ff8a45'))],
    cube: track(cubePaperTexture()),
    painted: track(paintedTexture()),
    caps: track(new THREE.MeshBasicMaterial({ color: 0x1c1410 })),
    wood: track(new THREE.MeshBasicMaterial({ color: 0x9a6a3c })),
    wax: track(new THREE.MeshBasicMaterial({ color: 0xfff3d4, toneMapped: false })),
    lathe: track(lanternGeometry()),
    capGeometry: track(new THREE.CylinderGeometry(0.5, 0.42, 0.16, 20)),
  };
  const poolGeometry = track(new THREE.PlaneGeometry(1, 1));
  const lanterns: Lantern[] = [];
  const lanternScale = ((halfHeight * 2) / 12) * params.size;
  const lanternCount = Math.max(0, Math.round(params.count));
  for (let i = 0; i < lanternCount; i += 1) {
    const built = buildLantern(pickKind(params.lanternType), i, track, shared);
    const scale = lanternScale * (0.85 + Math.random() * 0.4);
    built.group.scale.setScalar(scale);
    root.add(built.group);
    // A warm light pool on the surface under each lantern.
    const pool = new THREE.Mesh(
      poolGeometry,
      track(new THREE.MeshBasicMaterial({ map: halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.4, fog: false })),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.scale.setScalar(scale * built.glowSize);
    root.add(pool);
    lanterns.push({
      group: built.group,
      glow: built.group.userData.glow as THREE.Sprite,
      flames: built.flames,
      pool,
      lift: built.lift,
      x: -halfWidth * 0.9 + ((i + Math.random() * 0.6) / Math.max(1, lanternCount)) * halfWidth * 1.8,
      // Mostly the middle distance, but wide enough that a lantern sometimes drifts close to camera instead of
      // always staying far off — real ones wouldn't all keep to one depth.
      z: -26 + Math.random() * 34,
      speed: 0.25 + Math.random() * 0.35,
      phase: Math.random() * Math.PI * 2,
      scale,
      ringTimer: Math.random() * 1.2,
      swell: 0,
      tiltX: 0,
      tiltZ: 0,
      ownRing: null,
    });
  }

  // --- ripple rings ---
  // Pure data, no sprite drawn on the surface any more — that read as an unnatural warm-white glare/haze sitting
  // on the water. The ripple is still fully real: it bends the water shader's normal (`patchWaterWithRings`) and
  // lifts lanterns (`waveHeightAt`) — there's just nothing extra painted on top of it.
  const rings: Ring[] = [];
  for (let i = 0; i < RING_POOL; i += 1) rings.push({ x: 0, z: 0, age: 1, life: 1, size: 4 });

  // --- fireflies ---
  const fireflyCount = Math.max(0, Math.round(params.fireflies));
  const flyBase = new Float32Array(fireflyCount * 3);
  const flyPhase = new Float32Array(fireflyCount);
  const flyPositions = new Float32Array(fireflyCount * 3);
  for (let i = 0; i < fireflyCount; i += 1) {
    flyBase[i * 3] = (Math.random() - 0.5) * halfWidth * 2.1;
    flyBase[i * 3 + 1] = 0.6 + Math.random() * halfHeight * 0.9;
    flyBase[i * 3 + 2] = -18 + Math.random() * 20;
    flyPhase[i] = Math.random() * 6.28;
  }
  const flyGeometry = track(new THREE.BufferGeometry());
  flyGeometry.setAttribute('position', new THREE.BufferAttribute(flyPositions, 3));
  const flyTexture = track(radialTexture([[0, 'rgba(230,255,140,1)'], [0.4, 'rgba(190,240,90,0.45)'], [1, 'rgba(160,220,60,0)']], 64));
  root.add(new THREE.Points(flyGeometry, track(new THREE.PointsMaterial({ map: flyTexture, size: halfHeight * 0.16, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }))));

  // Mirrored copies of the small glows: Water's mirror pass renders the scene, but these points are
  // faint and far above the surface, so their reflection is painted here instead — squashed towards
  // the surface and smeared sideways per frame, which reads as a reflection rippling on the waves.
  const reflectionLayers: THREE.Points[] = [];
  const mirrorLayer = (
    source: Float32Array,
    texture: THREE.Texture,
    size: number,
    opacity: number,
  ): { positions: Float32Array; geometry: THREE.BufferGeometry } => {
    const positions = new Float32Array(source.length);
    const geometry = track(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = track(
      new THREE.PointsMaterial({ map: texture, size, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
    );
    const points = new THREE.Points(geometry, material);
    points.visible = params.reflections;
    points.renderOrder = 2;
    reflectionLayers.push(points);
    root.add(points);
    return { positions, geometry };
  };
  const flyMirror = mirrorLayer(flyPositions, flyTexture, halfHeight * 0.13, params.reflectionStrength);

  // --- sakura branch (top-left) with blossoms and falling petals ---
  const sakuraGroup = new THREE.Group();
  sakuraGroup.visible = params.sakura;
  root.add(sakuraGroup);
  const petalCount = Math.max(0, Math.round(params.petals));
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-halfWidth - 2, halfHeight * 1.55, -6),
    new THREE.Vector3(-halfWidth * 0.75, halfHeight * 1.28, -6),
    new THREE.Vector3(-halfWidth * 0.5, halfHeight * 1.32, -6),
    new THREE.Vector3(-halfWidth * 0.28, halfHeight * 1.12, -6),
  ]);
  const branchMaterial = track(new THREE.MeshBasicMaterial({ color: 0x3a2418, fog: false }));
  sakuraGroup.add(new THREE.Mesh(track(new THREE.TubeGeometry(curve, 24, halfHeight * 0.05, 6, false)), branchMaterial));
  const blossomPositions = new Float32Array(BLOSSOM_COUNT * 3);
  for (let i = 0; i < BLOSSOM_COUNT; i += 1) {
    const p = curve.getPoint(Math.pow(Math.random(), 0.8));
    blossomPositions[i * 3] = p.x + (Math.random() - 0.5) * halfHeight * 0.5;
    blossomPositions[i * 3 + 1] = p.y + (Math.random() - 0.4) * halfHeight * 0.45;
    blossomPositions[i * 3 + 2] = p.z + (Math.random() - 0.5) * 2;
  }
  const blossomGeometry = track(new THREE.BufferGeometry());
  blossomGeometry.setAttribute('position', new THREE.BufferAttribute(blossomPositions, 3));
  // "bloom" reuses the five-petal flowers of the На природе tree; "glow" keeps the soft pink dots.
  const petalTexture = params.sakuraBloom
    ? track(sakuraPetalTexture())
    : track(radialTexture([[0, 'rgba(255,214,228,1)'], [0.6, 'rgba(250,170,200,0.95)'], [1, 'rgba(250,170,200,0)']], 64));
  const blossomTexture = params.sakuraBloom ? track(blossomClusterTexture()) : petalTexture;
  sakuraGroup.add(
    new THREE.Points(
      blossomGeometry,
      track(new THREE.PointsMaterial({ map: blossomTexture, size: halfHeight * (params.sakuraBloom ? 0.3 : 0.2), transparent: true, depthWrite: false, fog: false })),
    ),
  );
  if (params.sakuraBloom) {
    // A second, additive pass so the blossoms pick up a little of the lanterns' warmth.
    sakuraGroup.add(
      new THREE.Points(
        blossomGeometry,
        track(
          new THREE.PointsMaterial({
            map: blossomTexture,
            size: halfHeight * 0.32,
            transparent: true,
            opacity: 0.28,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            fog: false,
          }),
        ),
      ),
    );
  }

  const petalBase = new Float32Array(petalCount * 4);
  const petalPositions = new Float32Array(petalCount * 3);
  for (let i = 0; i < petalCount; i += 1) {
    petalBase[i * 4] = -halfWidth * 0.9 + Math.random() * halfWidth * 0.9;
    petalBase[i * 4 + 1] = Math.random() * 6.28;
    petalBase[i * 4 + 2] = 0.5 + Math.random() * 0.9;
    petalBase[i * 4 + 3] = Math.random();
  }
  const petalGeometry = track(new THREE.BufferGeometry());
  petalGeometry.setAttribute('position', new THREE.BufferAttribute(petalPositions, 3));
  sakuraGroup.add(
    new THREE.Points(
      petalGeometry,
      track(new THREE.PointsMaterial({ map: petalTexture, size: halfHeight * (params.sakuraBloom ? 0.14 : 0.11), transparent: true, depthWrite: false, fog: false })),
    ),
  );
  const petalMirror = mirrorLayer(petalPositions, petalTexture, halfHeight * 0.09, params.reflectionStrength * 0.8);

  // --- the water itself ---
  const fallbackNormals = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
  fallbackNormals.needsUpdate = true;
  track(fallbackNormals);
  const water = new Water(new THREE.PlaneGeometry(700, 500), {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: fallbackNormals,
    alpha: 1,
    sunDirection: new THREE.Vector3(0.25, 0.55, -0.8).normalize(),
    sunColor: 0xcfdcff,
    waterColor: new THREE.Color(0x061a36),
    distortionScale: params.waves,
    fog: false,
  });
  water.rotation.x = -Math.PI / 2;
  root.add(water);
  disposables.push({ dispose: () => (water.material as THREE.Material).dispose() });
  patchWaterWithRings(water.material as THREE.ShaderMaterial);

  return {
    root,
    water,
    lanterns,
    rings,
    fireflyCount,
    petalCount,
    flyBase,
    flyPhase,
    flyGeometry,
    flyPositions,
    flyMirror,
    petalBase,
    petalGeometry,
    petalPositions,
    petalMirror,
    reflectionLayers,
    disposables,
  };
}

function stepLanterns(
  assets: ReturnType<typeof buildScene>,
  t: number,
  delta: number,
  halfWidth: number,
  params: LanternWaterTuningParams,
  spawn: (x: number, z: number, size: number, life: number) => Ring | undefined,
) {
  // Lanterns: drift, bob and tilt with the waves, emit rings.
  for (const l of assets.lanterns) {
    l.x += l.speed * params.speed * delta;
    if (l.x > halfWidth * 1.05) l.x = -halfWidth * 1.05;
    const bob = Math.sin(t * 1.3 + l.phase) * 0.12 + Math.sin(t * 0.7 + l.phase * 2) * 0.08;
    // A lantern rests on a patch of water, not one exact point — sampling just its centre let a sharp ripple
    // crest sweep across in a couple of frames and jerk it, since the reading could flip from one side of the
    // wave to the other between frames. Averaging its centre with four points around the rim (the same spread
    // used for the tilt below) is a cheap stand-in for a real floating patch and smooths that right out.
    // Its own most recently spawned ring is excluded from all five samples: right after that ring is born its
    // radius is still tiny, so the lantern sitting almost on top of it would otherwise read a point-blank crest
    // every time and visibly jump — other lanterns' rings and the cursor's still affect it normally.
    const own = l.ownRing ?? undefined;
    const step = 0.6 * l.scale;
    const hC = waveHeightAt(assets, l.x, l.z, params, own);
    const hXp = waveHeightAt(assets, l.x + step, l.z, params, own);
    const hXm = waveHeightAt(assets, l.x - step, l.z, params, own);
    const hZp = waveHeightAt(assets, l.x, l.z + step, params, own);
    const hZm = waveHeightAt(assets, l.x, l.z - step, params, own);
    const targetSwell = ((hC + hXp + hXm + hZp + hZm) / 5) * l.scale * 0.9;
    const targetTiltX = (hXp - hXm) * 0.9;
    const targetTiltZ = (hZp - hZm) * 0.9;
    // The actual bug: several rings overlapping (a couple of lanterns' own ripples plus the cursor's) sum to a
    // wave height that can genuinely swing from one frame to the next — that's real interference, not a mistake.
    // But a lantern has weight; it can't teleport to track that. Reading the raw height straight into its
    // position every frame is what made it look shaken rather than floating, however smooth the height itself
    // was made — so its position/tilt now ease toward the target instead of snapping to it, the way something
    // with actual mass would. Tilt eases noticeably slower than the vertical swell/lift: a rocking motion reads
    // as "shaky" at a follow rate that looks perfectly natural for bobbing up and down.
    const follow = Math.min(1, delta * 6);
    const tiltFollow = Math.min(1, delta * 2.2);
    l.swell += (targetSwell - l.swell) * follow;
    l.tiltX += (targetTiltX - l.tiltX) * tiltFollow;
    l.tiltZ += (targetTiltZ - l.tiltZ) * tiltFollow;
    const y = l.scale * l.lift + bob * l.scale * 0.5 + l.swell;
    l.group.position.set(l.x, y, l.z);
    l.group.rotation.z = Math.sin(t * 0.9 + l.phase) * 0.09 - l.tiltX;
    l.group.rotation.x = Math.cos(t * 0.8 + l.phase * 1.3) * 0.07 + l.tiltZ;
    const wobble = Math.sin(t * 7 + l.phase * 5) * 0.05 + Math.sin(t * 3.1 + l.phase) * 0.03;
    const flicker = 1 + (wobble - 0.08) * params.flicker;
    l.glow.material.opacity = Math.min(1, flicker * params.glow);
    // Candle flames dance faster and taller than the lantern's overall glow.
    for (let f = 0; f < l.flames.length; f += 1) {
      const flame = l.flames[f];
      const base = flame.userData.baseScale as THREE.Vector3;
      const beat = Math.sin(t * 11 + l.phase * 3 + f) * 0.1 + Math.sin(t * 17 + l.phase) * 0.06;
      flame.scale.set(base.x * (1 + beat * 0.5 * params.flicker), base.y * (1 + beat * params.flicker), 1);
      flame.position.x = Math.sin(t * 5.5 + l.phase * 2 + f) * 0.02 * params.flicker;
      (flame.material as THREE.SpriteMaterial).opacity = Math.min(1, (0.85 + beat) * params.glow);
    }
    l.pool.position.set(l.x, 0.02, l.z);
    (l.pool.material as THREE.MeshBasicMaterial).opacity = 0.3 * flicker * params.glow;
    l.ringTimer -= delta;
    if (l.ringTimer <= 0 && params.rings) {
      l.ownRing = spawn(l.x, l.z, l.scale * 3.4 * params.ringReach, 2.4) ?? null;
      l.ringTimer = 1.3 + Math.random() * 0.9;
    } else if (l.ringTimer <= 0) {
      l.ringTimer = 1;
    }
  }

}

function stepRings(assets: ReturnType<typeof buildScene>, delta: number, params: LanternWaterTuningParams) {
  const uniforms = (assets.water.material as THREE.ShaderMaterial).uniforms;
  const slots = uniforms.rings.value as THREE.Vector4[];
  uniforms.ringStrength.value = params.ringDistortion;
  let slot = 0;
  for (const ring of assets.rings) {
    if (ring.age >= ring.life) continue;
    ring.age += delta * params.ringSpeed;
    const { k, radius, amplitude } = ringShape(ring, params);
    if (k >= 1) continue;
    // Handed to the water shader so it bends the reflections — overlapping slots add up inside the shader, so
    // crossing ripples interfere like real ones.
    if (slot < slots.length) {
      slots[slot].set(ring.x, ring.z, radius, amplitude);
      slot += 1;
    }
  }
  for (; slot < slots.length; slot += 1) slots[slot].w = 0;
}

/** Current radius and amplitude of one live ripple, matching what the shader draws. */
function ringShape(ring: { age: number; life: number; size: number }, params: LanternWaterTuningParams) {
  const k = Math.min(1, ring.age / ring.life);
  // Radius starts at 0 (k = 0) so a ripple genuinely grows outward from its origin point instead of
  // appearing already a fixed distance out — a flat offset here read as the ring not coming from the cursor.
  return { k, radius: ring.size * k * 0.42, amplitude: (1 - k) * (1 - k) * 0.5 * params.ringHeight };
}

/**
 * Surface height where the ripples meet, so floating things ride the same wave the shader shows.
 * Ripples simply add up, which is what makes two crossing rings lift a lantern higher than one.
 */
function waveHeightAt(
  assets: ReturnType<typeof buildScene>,
  x: number,
  z: number,
  params: LanternWaterTuningParams,
  excludeRing?: Ring,
) {
  let height = 0;
  for (const ring of assets.rings) {
    if (ring === excludeRing) continue;
    if (ring.age >= ring.life) continue;
    const { radius, amplitude } = ringShape(ring, params);
    const dx = x - ring.x;
    const dz = z - ring.z;
    const offset = Math.hypot(dx, dz) - radius;
    const width = 0.6 + radius * 0.22;
    height += Math.cos(offset * 2.6) * Math.exp(-(offset * offset) / (width * width)) * amplitude;
  }
  // A crowd of rings passing the same spot at once (a quick sweep of the cursor, say) could otherwise add up to
  // a lift that reads as the lantern leaping rather than riding a wave — several crests overlapping is still
  // real, it just shouldn't be unbounded.
  return THREE.MathUtils.clamp(height, -0.55 * params.ringHeight, 0.55 * params.ringHeight);
}

/** Reflections of the fireflies and the petals on the surface. */
function stepReflections(assets: ReturnType<typeof buildScene>, params: LanternWaterTuningParams, t: number) {
  for (const layer of assets.reflectionLayers) layer.visible = params.reflections;
  if (!params.reflections) return;
  const spread = 0.5 + params.waves * 0.12;
  stepMirror(assets.flyPositions, assets.flyMirror.positions, assets.fireflyCount, t, spread);
  stepMirror(assets.petalPositions, assets.petalMirror.positions, assets.petalCount, t, spread);
  assets.flyMirror.geometry.attributes.position.needsUpdate = true;
  assets.petalMirror.geometry.attributes.position.needsUpdate = true;
  assets.reflectionLayers.forEach((layer, i) => {
    (layer.material as THREE.PointsMaterial).opacity = params.reflectionStrength * (i === 0 ? 1 : 0.8);
  });
}

/** Paints the mirrored copy of a point cloud: squashed onto the surface and smeared by the waves. */
function stepMirror(source: Float32Array, target: Float32Array, count: number, t: number, spread: number) {
  for (let i = 0; i < count; i += 1) {
    const x = source[i * 3];
    const y = source[i * 3 + 1];
    const z = source[i * 3 + 2];
    const depth = Math.min(1, y / 6);
    target[i * 3] = x + Math.sin(t * 1.6 + z * 0.7 + y) * spread * depth;
    target[i * 3 + 1] = -y * 0.82;
    target[i * 3 + 2] = z + Math.cos(t * 1.1 + x * 0.5) * spread * 0.4 * depth;
  }
}

export type LanternWaterView = { fov: number; distance: number; heightRatio: number; targetRatio: number };

export function LanternWaterEffect({ width, height, pointerRef, params, view }: { width: number; height: number; pointerRef: MutableRefObject<PointerState>; params: LanternWaterTuningParams; view?: LanternWaterView }) {
  const getThree = useThree((state) => state.get);
  const clockRef = useRef(0);
  const reduceMotion = useMemo(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);

  const aspect = width / height;
  const fov = view?.fov ?? CAMERA_FOV, distance = view?.distance ?? CAMERA_DISTANCE;
  const heightRatio = view?.heightRatio ?? .36, targetRatio = view?.targetRatio ?? .25;
  const halfHeight = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * distance;
  const halfWidth = halfHeight * aspect;

  const assetsRef = useRef<ReturnType<typeof buildScene> | null>(null);
  // Anything that changes what is built (not just how it moves) rebuilds the scene.
  const structureKey = [params.lanternType, params.count, params.size, params.sakura, params.sakuraBloom, params.torii, params.fireflies, params.petals].join('|');

  useEffect(() => {
    const { scene, camera, gl } = getThree();
    const assets = buildScene(halfWidth, halfHeight, params);
    assetsRef.current = assets;
    let alive = true;
    // Real ripple-normal map for the water; the 1x1 fallback keeps the first frames flat.
    new THREE.TextureLoader().load('/textures/waternormals.jpg', (texture) => {
      if (!alive) {
        texture.dispose();
        return;
      }
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      (assets.water.material as THREE.ShaderMaterial).uniforms.normalSampler.value = texture;
    });
    const previousFog = scene.fog;
    scene.fog = new THREE.FogExp2(FOG_COLOR, 0.006);
    scene.add(assets.root);
    const perspective = camera as THREE.PerspectiveCamera;
    perspective.fov = fov;
    perspective.position.set(0, halfHeight * heightRatio, distance);
    perspective.lookAt(0, halfHeight * targetRatio, -8);
    perspective.updateProjectionMatrix();
    gl.toneMapping = THREE.NoToneMapping;
    return () => {
      alive = false;
      assetsRef.current = null;
      scene.remove(assets.root);
      scene.fog = previousFog;
      assets.disposables.forEach((d) => d.dispose());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [halfWidth, halfHeight, getThree, structureKey, fov, distance, heightRatio, targetRatio]);

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const wasPressed = useRef(false);

  function spawnRing(assets: NonNullable<typeof assetsRef.current>, x: number, z: number, size: number, life: number) {
    const ring = assets.rings.find((r) => r.age >= r.life);
    if (!ring) return undefined;
    ring.age = 0;
    ring.life = life;
    ring.size = size;
    ring.x = x;
    ring.z = z;
    return ring;
  }

  useFrame((state, rawDelta) => {
    const assets = assetsRef.current;
    if (!assets) return;
    const delta = Math.min(rawDelta, 0.05) * (reduceMotion ? 0.25 : 1);
    clockRef.current += delta;
    const t = clockRef.current;
    const waterUniforms = (assets.water.material as THREE.ShaderMaterial).uniforms;
    waterUniforms.time.value += delta * 0.55;
    waterUniforms.distortionScale.value = params.waves;

    stepLanterns(assets, t, delta, halfWidth, params, (x, z, size, life) => spawnRing(assets, x, z, size, life));

    // Cursor ripples: one ring per click/tap, not one trailing along the whole path — a constant stream of
    // rings from just moving the mouse was adding to the general interference the lanterns were fighting.
    const cursor = pointerRef.current;
    const justClicked = !!cursor.pressed && !wasPressed.current;
    wasPressed.current = !!cursor.pressed;
    if (cursor.active && justClicked) {
      const ndc = new THREE.Vector2((cursor.x / (width / 2)), (cursor.y / (height / 2)));
      raycaster.setFromCamera(ndc, state.camera);
      if (raycaster.ray.intersectPlane(plane, hit)) {
        // Sized off the pond's own larger half-extent, not just its height, so a ripple genuinely reaches
        // every edge of the visible water — and a little past it — on any aspect ratio, the way a real wave
        // doesn't just stop partway. At the default "Дальность кругов" this lands just beyond the edge. A
        // longer life (not a bigger size) is what makes it travel there at half the old speed: it still ends
        // up the same size, it just takes twice as long getting there, instead of sweeping past anything
        // nearby fast enough to jolt it.
        const pondReach = Math.max(halfWidth, halfHeight);
        spawnRing(assets, hit.x, hit.z, pondReach * 0.95 * params.ringReach, 3.6);
      }
    }

    stepRings(assets, delta, params);

    // Fireflies wander in soft loops.
    const fp = assets.flyPositions;
    for (let i = 0; i < assets.fireflyCount; i += 1) {
      const ph = assets.flyPhase[i];
      fp[i * 3] = assets.flyBase[i * 3] + Math.sin(t * 0.4 + ph) * 1.4;
      fp[i * 3 + 1] = assets.flyBase[i * 3 + 1] + Math.sin(t * 0.7 + ph * 2) * 0.7;
      fp[i * 3 + 2] = assets.flyBase[i * 3 + 2] + Math.cos(t * 0.35 + ph) * 1.2;
    }
    assets.flyGeometry.attributes.position.needsUpdate = true;

    // Petals fall from the branch, sway, and settle on the water surface before starting over.
    const pp = assets.petalPositions;
    const top = halfHeight * 1.25;
    for (let i = 0; i < assets.petalCount; i += 1) {
      const speed = assets.petalBase[i * 4 + 2] * (halfHeight * 0.2);
      const cycle = ((t * speed * 0.35 + assets.petalBase[i * 4 + 3] * 3) % 3) / 3;
      const y = top * (1 - cycle);
      pp[i * 3] = assets.petalBase[i * 4] + Math.sin(t * 0.9 + assets.petalBase[i * 4 + 1]) * 1.2 + cycle * 2;
      pp[i * 3 + 1] = Math.max(0.08, y);
      pp[i * 3 + 2] = -6 + Math.sin(assets.petalBase[i * 4 + 1] * 3) * 6;
    }
    assets.petalGeometry.attributes.position.needsUpdate = true;

    stepReflections(assets, params, t);
  });

  return null;
}
