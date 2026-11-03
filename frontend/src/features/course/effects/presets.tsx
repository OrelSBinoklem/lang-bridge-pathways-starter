'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PointerState } from './engine';
import type { MutableRefObject } from 'react';

// Soft, hand-written teardrop-shaped sprite shader shared by the drizzle and the umbrella's
// splash mist — per-instance `size` attribute drives point size. The fragment fades a rounded
// bulb (bottom) merged with a tapering tail (top) to transparent, so particles read as actual
// falling drops instead of plain soft circles.
const DROPLET_VERTEX_SHADER = /* glsl */ `
  attribute float size;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size;
    gl_Position = projectionMatrix * mvPosition;
  }
`;
const DROPLET_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    vec2 p = gl_PointCoord - vec2(0.5);
    p.y = -p.y - 0.05;

    // A single warped distance field: below center it's a plain circle (the drop's rounded
    // bulb); above center the horizontal axis is progressively stretched, which shrinks the
    // shape's effective radius going up and pinches it to a point — a real one-piece teardrop,
    // not two soft blobs blended together (which just reads as a fuzzy circle at a few pixels).
    float k = p.y > 0.0 ? 1.0 + p.y * 3.5 : 1.0;
    vec2 q = vec2(p.x * k, p.y);
    float d = length(q) / 0.34;
    float alpha = smoothstep(1.0, 0.7, d) * uOpacity;

    // Small bright specular glint offset toward one side of the bulb — reads as light reflecting
    // off a wet, glossy droplet instead of a flat-shaded dot.
    float glint = smoothstep(0.09, 0.0, length(p - vec2(-0.09, -0.1)));
    vec3 color = mix(uColor, vec3(1.0), glint * 0.85);

    gl_FragColor = vec4(color, alpha);
  }
`;

// Plain soft circular falloff (no teardrop taper) used to draw the lightning bolt as a chain of
// glowing dots rather than a flat-shaded polygon ribbon — the overlapping soft edges and additive
// blending are what read as "glowing" instead of "vector graphic".
const GLOW_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv) * 2.0;
    float alpha = smoothstep(1.0, 0.0, d) * uOpacity;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

// Same teardrop as DROPLET_FRAGMENT_SHADER, but rotated to the drop's current travel direction
// and stretched along that axis (and squashed on the perpendicular axis by the same factor, so
// the silhouette's area stays constant — real squash-and-stretch, not just "wider") — fast rain
// reads as a short motion streak, and as a drop decelerates (e.g. after bouncing off the umbrella)
// `stretch` shrinks back toward 1 and it settles back into a plain round teardrop.
const RAIN_VERTEX_SHADER = /* glsl */ `
  attribute float size;
  attribute float angle;
  attribute float stretch;
  varying float vAngle;
  varying float vStretch;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size;
    gl_Position = projectionMatrix * mvPosition;
    vAngle = angle;
    vStretch = stretch;
  }
`;
const RAIN_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAngle;
  varying float vStretch;
  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float s = sin(vAngle);
    float c = cos(vAngle);
    vec2 p = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c);
    p.y = -p.y - 0.05;
    // Stretch along travel (y) and squash across it (x) by the reciprocal factor — the two cancel
    // out in the area of the resulting silhouette, so a "streak" reads as the same drop elongated,
    // not a bigger blob.
    p.y /= vStretch;
    p.x *= vStretch;

    float k = p.y > 0.0 ? 1.0 + p.y * 3.5 : 1.0;
    vec2 q = vec2(p.x * k, p.y);
    float d = length(q) / 0.34;
    float alpha = smoothstep(1.0, 0.7, d) * uOpacity;

    float glint = smoothstep(0.09, 0.0, length(p - vec2(-0.09, -0.1)));
    vec3 color = mix(uColor, vec3(1.0), glint * 0.85);

    gl_FragColor = vec4(color, alpha);
  }
`;

type DrizzleDrop = {
  x: number; y: number; z: number; vy: number; vx: number;
  swayPhase: number; swaySpeed: number; size: number; baseSize: number;
  /** True from the moment of collision until this drop recycles off the bottom of the screen —
   * for its entire post-bounce life it's governed by real gravity + air-drag physics (see the
   * `bouncing` branch below) instead of the plain constant-speed model ordinary rain uses, so the
   * launch arc and the fall that follows it are one continuous, physically-consistent motion with
   * no snap in between, and it can't re-trigger a second bounce while still airborne from the first. */
  bouncing: boolean;
  /** Counts down independently of `bouncing` — purely drives the transient "splash" size pop, so
   * the pop always resolves quickly regardless of how long the bounce flight itself takes. */
  popTime: number;
};

/** Live-tunable knobs for the storm preset, surfaced through the on-page effect tuning panel —
 * everything else (canopy geometry, splash mist) stays fixed to keep the panel to a handful of
 * fun/obvious sliders instead of every internal constant. */
export type StormTuningParams = {
  rainCount: number;
  fallSpeedMin: number;
  fallSpeedRange: number;
  /** One constant gravity for the whole post-bounce flight, rise and fall alike — real projectile
   * motion doesn't switch physics depending on which way it's currently moving. */
  bounceGravity: number;
  /** Air resistance opposing a bounced drop's velocity (both while rising and while falling) —
   * real rain doesn't accelerate forever, it reaches a terminal velocity once drag balances
   * gravity. Terminal fall speed works out to `bounceGravity / airDrag`. */
  airDrag: number;
  bounceDrag: number;
  stretchMax: number;
  lightningInterval: number;
  lightningLifetime: number;
  lightningDensity: number;
};

export function createStormParams(): StormTuningParams {
  return {
    rainCount: 300,
    fallSpeedMin: 150,
    fallSpeedRange: 250,
    bounceGravity: 280,
    airDrag: 0.45,
    bounceDrag: 1.5,
    stretchMax: 1.9,
    lightningInterval: 3,
    lightningLifetime: 1.1,
    lightningDensity: 1,
  };
}

/** Canopy hit-zone, relative to the cursor position — matches the umbrella sprite's drawn size. */
const CANOPY_HALF_WIDTH = 21;
const CANOPY_Y_OFFSET = 27;
/** Duration of the visual "splash" size pop only — deliberately decoupled from how long the
 * bounce's flight itself lasts, so the pop always reads as a quick splash rather than being
 * stretched (or truncated) by how long the drop stays airborne. */
const BOUNCE_POP_DURATION = 0.3;
/** Below this speed a drop is drawn as a plain round teardrop (stretch = 1); above it, stretch
 * grows with speed so fast rain reads as a short motion streak. */
const STRETCH_REF_SPEED = 150;
const STRETCH_PER_SPEED = 220;

/**
 * Fine misty drizzle: many tiny soft-shader drops falling slowly, instead of the old tumbling
 * rectangle "streak" particles (which read as confetti, not rain). Drops that fall into the
 * cursor umbrella's canopy zone actually bounce — real collision, not a separate decorative
 * splash system — flung outward and pulled back down by gravity before recycling as new rain.
 */
function Drizzle({ width, height, pointerRef, params, umbrellaScale }: { width: number; height: number; pointerRef: MutableRefObject<PointerState>; params: StormTuningParams; umbrellaScale: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const stateRef = useRef<{ key: string; drops: DrizzleDrop[] } | null>(null);
  const uniforms = useMemo(() => ({ uColor: { value: new THREE.Color('#dbe9ff') }, uOpacity: { value: 0.75 } }), []);

  useFrame((_, delta) => {
    const points = pointsRef.current;
    if (!points) return;
    const count = Math.max(Math.round(params.rainCount), 1);
    const key = `${Math.round(width)}x${Math.round(height)}x${count}`;
    if (!stateRef.current || stateRef.current.key !== key) {
      const halfW = Math.max(width, 1) / 2;
      const halfH = Math.max(height, 1) / 2;
      const drops: DrizzleDrop[] = Array.from({ length: count }, () => {
        const size = 4 + Math.random() * 6;
        return {
          x: (Math.random() * 2 - 1) * halfW,
          y: (Math.random() * 2 - 1) * halfH,
          z: Math.random() * 2,
          vy: -(params.fallSpeedMin + Math.random() * params.fallSpeedRange),
          vx: 0,
          swayPhase: Math.random() * Math.PI * 2,
          swaySpeed: 0.4 + Math.random() * 0.8,
          size,
          baseSize: size,
          bouncing: false,
          popTime: 0,
        };
      });
      stateRef.current = { key, drops };
      const positions = new Float32Array(count * 3);
      const sizes = new Float32Array(count);
      const angles = new Float32Array(count);
      const stretches = new Float32Array(count);
      drops.forEach((d, i) => {
        positions[i * 3] = d.x; positions[i * 3 + 1] = d.y; positions[i * 3 + 2] = d.z;
        sizes[i] = d.size;
        stretches[i] = 1;
      });
      const geo = points.geometry;
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
      geo.setAttribute('angle', new THREE.BufferAttribute(angles, 1));
      geo.setAttribute('stretch', new THREE.BufferAttribute(stretches, 1));
    }

    const { drops } = stateRef.current;
    const halfW = Math.max(width, 1) / 2;
    const halfH = Math.max(height, 1) / 2;
    const dt = Math.min(delta, 0.05);
    const cursor = pointerRef.current;
    const posAttr = points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const sizeAttr = points.geometry.getAttribute('size') as THREE.BufferAttribute;
    const angleAttr = points.geometry.getAttribute('angle') as THREE.BufferAttribute;
    const stretchAttr = points.geometry.getAttribute('stretch') as THREE.BufferAttribute;
    // Motion stretch (used for both falling and bouncing drops): faster travel reads as a short
    // streak, and as a drop decelerates (gravity while airborne, drag right after hitting the
    // umbrella) the stretch shrinks back toward 1 and it settles back into a plain round drop.
    const writeMotion = (i: number, vx: number, vy: number) => {
      const speed = Math.hypot(vx, vy);
      const stretch = THREE.MathUtils.clamp(1 + (speed - STRETCH_REF_SPEED) / STRETCH_PER_SPEED, 1, params.stretchMax);
      const angle = Math.atan2(vx, -vy);
      angleAttr.setX(i, angle);
      stretchAttr.setX(i, stretch);
    };
    // Splash-pop size, decaying over BOUNCE_POP_DURATION regardless of how long the drop's actual
    // flight (bounce arc or subsequent normal fall) ends up taking — a fast, deliberate splash
    // instead of the drop being oversized for its whole trip or getting cut short before it settles.
    const updatePopSize = (d: DrizzleDrop) => {
      if (d.popTime > 0) {
        d.popTime = Math.max(d.popTime - dt, 0);
        d.size = d.baseSize * (1 + 0.35 * (d.popTime / BOUNCE_POP_DURATION));
      } else {
        d.size = d.baseSize;
      }
    };
    drops.forEach((d, i) => {
      if (d.bouncing) {
        // One continuous equation of motion for the whole post-bounce flight — a single constant
        // gravity, all the time, minus air drag proportional to speed — instead of a hand-timed
        // arc that then snapped to a fresh constant fall speed. This one formula naturally covers
        // both halves: while launching upward, drag adds to gravity's deceleration; once falling,
        // drag increasingly opposes gravity until they balance at terminal velocity
        // (bounceGravity / airDrag) — a real parabola near the top, smoothly flattening into a
        // steady, fast fall, with no snap or physics switch anywhere.
        d.vx *= Math.max(0, 1 - params.bounceDrag * dt);
        d.vy += (-params.bounceGravity - params.airDrag * d.vy) * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        updatePopSize(d);
        // Only ends when the drop actually leaves the screen — it stays under this same physics
        // (and stays ineligible to bounce again) for its whole trip down, however long that takes.
        if (d.y < -halfH - 10) {
          d.bouncing = false;
          d.vx = 0;
          d.vy = -(params.fallSpeedMin + Math.random() * params.fallSpeedRange);
          d.y = halfH + 5;
          d.x = (Math.random() * 2 - 1) * halfW;
        }
        posAttr.setXYZ(i, d.x, d.y, d.z);
        sizeAttr.setX(i, d.size);
        writeMotion(i, d.vx, d.vy);
        return;
      }

      const prevY = d.y;
      d.y += d.vy * dt;
      d.swayPhase += d.swaySpeed * dt;
      const x = d.x + Math.sin(d.swayPhase) * 3;
      updatePopSize(d);

      if (cursor.active) {
        const relX = x - cursor.x;
        const canopyY = cursor.y + CANOPY_Y_OFFSET * umbrellaScale;
        // Check for *crossing* the canopy line this frame, not "currently inside a thin band" —
        // a fast-falling drop can jump clean past a few-pixel band in one frame and never trigger.
        if (Math.abs(relX) < CANOPY_HALF_WIDTH * umbrellaScale && prevY > canopyY && d.y <= canopyY) {
          const u = THREE.MathUtils.clamp(relX / (CANOPY_HALF_WIDTH * umbrellaScale), -1, 1);
          // A near-dead-center hit gives |u| near 0 — scaling the sideways push by |u| there means
          // it launches almost straight up with barely any horizontal speed, so on the way back
          // down it falls through roughly the same spot it left from (reads as flying straight
          // through the umbrella instead of being deflected off to a side). Every bounce always
          // gets the full sideways kick, regardless of exactly where on the canopy it hit — only
          // the direction (which side) and how much upward lift depend on `u`.
          const side = u !== 0 ? Math.sign(u) : Math.random() < 0.5 ? -1 : 1;
          // Strong initial pop so the drop visibly clears the umbrella right away — the drag
          // above then decelerates it over the rest of the bounce.
          const outSpeed = 70 + Math.random() * 60;
          const upBias = 0.35 + 0.55 * (1 - Math.abs(u));
          d.bouncing = true;
          d.popTime = BOUNCE_POP_DURATION;
          d.x = cursor.x + relX;
          d.y = canopyY;
          d.vx = side * outSpeed;
          d.vy = upBias * outSpeed;
          updatePopSize(d);
          posAttr.setXYZ(i, d.x, d.y, d.z);
          sizeAttr.setX(i, d.size);
          writeMotion(i, d.vx, d.vy);
          return;
        }
      }

      if (d.y < -halfH - 10) {
        d.y = halfH + 5;
        d.x = (Math.random() * 2 - 1) * halfW;
      }
      posAttr.setXYZ(i, x, d.y, d.z);
      sizeAttr.setX(i, d.size);
      writeMotion(i, 0, d.vy);
    });
    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    angleAttr.needsUpdate = true;
    stretchAttr.needsUpdate = true;
  });

  return (
    // Three.js sorts transparent objects for paint order by each *object's* transform distance
    // from the camera, not by individual buffer-attribute vertex positions — since this whole
    // points system stays at one object position, a per-vertex z tweak on a bounced drop can't
    // change draw order. renderOrder overrides the automatic sort directly: higher draws later
    // (on top), so rain — including bounced drops — always paints over the umbrella sprite.
    <points ref={pointsRef} frustumCulled={false} renderOrder={2}>
      <bufferGeometry />
      <shaderMaterial
        vertexShader={RAIN_VERTEX_SHADER}
        fragmentShader={RAIN_FRAGMENT_SHADER}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </points>
  );
}

type Point = { x: number; y: number };

// Classic recursive midpoint-displacement fractal (the standard "lightning generator" algorithm):
// each segment is split at its midpoint, offset perpendicular to the segment by a random amount,
// then both halves recurse with a smaller displacement. This naturally produces a few large
// zigzags with progressively finer wiggle riding on top — a much more organic bolt shape than
// jittering every point independently by the same fixed amount (which looks noisy/spiky).
function midpointDisplace(x0: number, y0: number, x1: number, y1: number, displace: number, out: Point[]): void {
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 7 || displace < 0.6) {
    out.push({ x: x1, y: y1 });
    return;
  }
  const nx = -(y1 - y0) / len;
  const ny = (x1 - x0) / len;
  const offset = (Math.random() * 2 - 1) * displace;
  const mx = (x0 + x1) / 2 + nx * offset;
  const my = (y0 + y1) / 2 + ny * offset;
  midpointDisplace(x0, y0, mx, my, displace * 0.55, out);
  midpointDisplace(mx, my, x1, y1, displace * 0.55, out);
}

function buildJaggedPath(x0: number, y0: number, x1: number, y1: number, roughness: number): Point[] {
  const points: Point[] = [{ x: x0, y: y0 }];
  midpointDisplace(x0, y0, x1, y1, Math.hypot(x1 - x0, y1 - y0) * roughness, points);
  return points;
}

// A flat-shaded triangle ribbon has crisp polygon edges — it reads as a "vector graphic", not a
// glowing bolt. Instead we walk each path at a fixed spacing and drop a soft glowing dot (the same
// technique as the drizzle, via GLOW_FRAGMENT_SHADER) at every sample point; overlapping soft
// circles blur into a continuous fuzzy tube, and a second wider/dimmer layer becomes the halo.
function samplePathPoints(path: Point[], spacing: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.round(segLen / spacing));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      out.push({ x: THREE.MathUtils.lerp(a.x, b.x, t), y: THREE.MathUtils.lerp(a.y, b.y, t) });
    }
  }
  out.push(path[path.length - 1]);
  return out;
}

function buildGlowBuffers(paths: Point[][], spacing: number, size: number, z: number): { position: Float32Array; size: Float32Array } {
  const pts: Point[] = [];
  paths.forEach((path) => pts.push(...samplePathPoints(path, spacing)));
  const position = new Float32Array(pts.length * 3);
  const sizeArr = new Float32Array(pts.length);
  pts.forEach((p, i) => {
    position[i * 3] = p.x;
    position[i * 3 + 1] = p.y;
    position[i * 3 + 2] = z;
    sizeArr[i] = size;
  });
  return { position, size: sizeArr };
}

/** Picks a random point on the block's boundary, used as a bolt's start/end so it always reaches the edge. */
function randomEdgePoint(halfW: number, halfH: number): Point {
  const edge = Math.floor(Math.random() * 4);
  if (edge === 0) return { x: -halfW, y: (Math.random() * 2 - 1) * halfH };
  if (edge === 1) return { x: halfW, y: (Math.random() * 2 - 1) * halfH };
  if (edge === 2) return { x: (Math.random() * 2 - 1) * halfW, y: halfH };
  return { x: (Math.random() * 2 - 1) * halfW, y: -halfH };
}

/** Main trunk (edge to edge, or cursor to edge) plus 1-3 jagged offshoot branches peeling off it. */
function buildBoltPaths(x0: number, y0: number, x1: number, y1: number): Point[][] {
  const main = buildJaggedPath(x0, y0, x1, y1, 0.16);
  const paths: Point[][] = [main];

  const mainLen = Math.max(Math.hypot(x1 - x0, y1 - y0), 1);
  const mainAngle = Math.atan2(y1 - y0, x1 - x0);
  const branchCount = 1 + Math.floor(Math.random() * 3);
  for (let b = 0; b < branchCount; b++) {
    const startIdx = 2 + Math.floor(Math.random() * Math.max(main.length - 4, 1));
    const start = main[Math.min(startIdx, main.length - 2)];
    const angle = mainAngle + (Math.random() * 2 - 1) * 1.0;
    const length = (0.15 + Math.random() * 0.3) * mainLen;
    const bx = start.x + Math.cos(angle) * length;
    const by = start.y + Math.sin(angle) * length;
    paths.push(buildJaggedPath(start.x, start.y, bx, by, 0.22));
  }
  return paths;
}

/**
 * Branching lightning bolts: fire on their own every couple of seconds (sky-to-ground, edge to
 * edge) and also spring from the cursor toward a random edge while actively hovering. Drawn as two
 * layers of glowing dots along the same path — a wide, dim halo and a narrower, brighter core —
 * composited with additive blending, so it reads as a soft glowing bolt instead of a flat polygon.
 */
function CursorLightningBolts({ width, height, pointerRef, params }: { width: number; height: number; pointerRef: MutableRefObject<PointerState>; params: StormTuningParams }) {
  const haloRef = useRef<THREE.Points>(null);
  const coreRef = useRef<THREE.Points>(null);
  const impactRef = useRef<THREE.Points>(null);
  const flashRef = useRef<THREE.Mesh>(null);
  const impactPos = useRef({ x: 0, y: 0 });
  const timer = useRef<number | null>(null);
  const life = useRef(0);
  const flashLife = useRef(0);
  const FLASH_LIFETIME = 0.22;
  const haloUniforms = useMemo(() => ({ uColor: { value: new THREE.Color('#3a6fd8') }, uOpacity: { value: 0 } }), []);
  const coreUniforms = useMemo(() => ({ uColor: { value: new THREE.Color('#bcd8ff') }, uOpacity: { value: 0 } }), []);
  const impactUniforms = useMemo(() => ({ uColor: { value: new THREE.Color('#3a6fd8') }, uOpacity: { value: 0 } }), []);

  useFrame((_, delta) => {
    const halo = haloRef.current;
    const core = coreRef.current;
    const impact = impactRef.current;
    const flash = flashRef.current;
    if (!halo || !core || !impact || !flash) return;
    if (timer.current === null) timer.current = params.lightningInterval * (0.4 + Math.random() * 0.6);
    const haloMat = halo.material as THREE.ShaderMaterial;
    const coreMat = core.material as THREE.ShaderMaterial;
    const impactMat = impact.material as THREE.ShaderMaterial;
    const flashMat = flash.material as THREE.MeshBasicMaterial;

    if (life.current > 0) {
      life.current = Math.max(0, life.current - delta);
      const t = life.current / params.lightningLifetime;
      const boltT = t * t * 0.7 + t * 0.3;
      haloMat.uniforms.uOpacity.value = boltT * 0.5;
      coreMat.uniforms.uOpacity.value = boltT;
      impactMat.uniforms.uOpacity.value = t * 0.8;
      impact.position.set(impactPos.current.x, impactPos.current.y, 4.5);
    }
    if (flashLife.current > 0) {
      flashLife.current = Math.max(0, flashLife.current - delta);
      flashMat.opacity = (flashLife.current / FLASH_LIFETIME) * 0.4;
    }

    timer.current -= delta;
    if (timer.current <= 0) {
      timer.current = params.lightningInterval * (0.6 + Math.random() * 0.8);
      const halfW = Math.max(width, 1) / 2;
      const halfH = Math.max(height, 1) / 2;
      const cursor = pointerRef.current;
      const start = cursor.active ? { x: cursor.x, y: cursor.y } : randomEdgePoint(halfW, halfH);
      const end = randomEdgePoint(halfW, halfH);
      const paths = buildBoltPaths(start.x, start.y, end.x, end.y);
      // Density is presented to the tuning panel as "more density = denser dots"; internally that
      // means a *smaller* sample spacing, so it's inverted here rather than exposing raw spacing.
      const density = Math.max(params.lightningDensity, 0.1);

      halo.geometry.dispose();
      const haloGeo = new THREE.BufferGeometry();
      const haloBuf = buildGlowBuffers(paths, 2 / density, 18, 4);
      haloGeo.setAttribute('position', new THREE.BufferAttribute(haloBuf.position, 3));
      haloGeo.setAttribute('size', new THREE.BufferAttribute(haloBuf.size, 1));
      halo.geometry = haloGeo;

      core.geometry.dispose();
      const coreGeo = new THREE.BufferGeometry();
      const coreBuf = buildGlowBuffers(paths, 1.5 / density, 6, 4.2);
      coreGeo.setAttribute('position', new THREE.BufferAttribute(coreBuf.position, 3));
      coreGeo.setAttribute('size', new THREE.BufferAttribute(coreBuf.size, 1));
      core.geometry = coreGeo;

      impactPos.current = { x: end.x, y: end.y };
      life.current = params.lightningLifetime;
      flashLife.current = FLASH_LIFETIME;
    }
  });

  return (
    <>
      {/* Background flash, triggered in the same frame as the bolt so it reads as one event. */}
      <mesh ref={flashRef} position={[0, 0, 3.5]}>
        <planeGeometry args={[Math.max(width, 1), Math.max(height, 1)]} />
        <meshBasicMaterial color="#dfe9ff" transparent opacity={0} depthWrite={false} />
      </mesh>
      <points ref={haloRef} frustumCulled={false}>
        <bufferGeometry />
        <shaderMaterial
          vertexShader={DROPLET_VERTEX_SHADER}
          fragmentShader={GLOW_FRAGMENT_SHADER}
          uniforms={haloUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <points ref={coreRef} frustumCulled={false}>
        <bufferGeometry />
        <shaderMaterial
          vertexShader={DROPLET_VERTEX_SHADER}
          fragmentShader={GLOW_FRAGMENT_SHADER}
          uniforms={coreUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {/* Soft glowing dot at the strike point — a flat-shaded plane here read as a hard blue
          rectangle once the bolt itself became a soft glow, so this reuses the same glow shader. */}
      <points ref={impactRef} position={[0, 0, -1000]} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array([0, 0, 0]), 3]} />
          <bufferAttribute attach="attributes-size" args={[new Float32Array([34]), 1]} />
        </bufferGeometry>
        <shaderMaterial
          vertexShader={DROPLET_VERTEX_SHADER}
          fragmentShader={GLOW_FRAGMENT_SHADER}
          uniforms={impactUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  );
}

function createUmbrellaTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(size / 2, size / 2);
  ctx.beginPath();
  ctx.moveTo(-size * 0.42, 2);
  ctx.quadraticCurveTo(-size * 0.42, -size * 0.34, 0, -size * 0.36);
  ctx.quadraticCurveTo(size * 0.42, -size * 0.34, size * 0.42, 2);
  ctx.quadraticCurveTo(size * 0.31, -size * 0.08, size * 0.21, 2);
  ctx.quadraticCurveTo(size * 0.1, -size * 0.08, 0, 2);
  ctx.quadraticCurveTo(-size * 0.1, -size * 0.08, -size * 0.21, 2);
  ctx.quadraticCurveTo(-size * 0.31, -size * 0.08, -size * 0.42, 2);
  ctx.closePath();
  ctx.fillStyle = '#eaf3ff';
  ctx.fill();
  ctx.strokeStyle = '#6f97d0';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(0, size * 0.4);
  ctx.strokeStyle = '#5a7cb8';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(size * 0.055, size * 0.4, size * 0.065, Math.PI * 0.15, Math.PI * 1.5);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

type Splash = { x: number; y: number; vx: number; vy: number; age: number; alive: boolean; size: number };

/**
 * A tiny umbrella sprite that tracks the cursor while it's over the block, with a constant fine
 * mist of microscopic white splash droplets flicking off it (rendered with the same soft-dot
 * shader as the drizzle).
 */
function CursorUmbrella({ pointerRef, scale }: { pointerRef: MutableRefObject<PointerState>; scale: number }) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const texture = useMemo(() => createUmbrellaTexture(), []);
  const uniforms = useMemo(() => ({ uColor: { value: new THREE.Color('#ffffff') }, uOpacity: { value: 0.9 } }), []);
  const opacityRef = useRef(0);
  const heldRef = useRef({ x: 0, y: 0, shown: false });
  const poolRef = useRef<Splash[] | null>(null);
  const nextIndexRef = useRef(0);
  const spawnTimer = useRef(0);
  const SPLASH_COUNT = 60;
  const SPLASH_LIFETIME = 0.6;
  const GRAVITY = 70;
  // Matches the umbrella sprite's 1.5x-enlarged drawn size (scale=[51,51,1] below) and the
  // Drizzle collision zone (CANOPY_HALF_WIDTH/CANOPY_Y_OFFSET) it needs to visually line up with.
  const CANOPY_HALF_WIDTH = 19.5;
  const CANOPY_RIM_Y = 27;

  useFrame((_, delta) => {
    const sprite = spriteRef.current;
    const points = pointsRef.current;
    if (!sprite || !points) return;
    const dt = Math.min(delta, 0.05);
    const cursor = pointerRef.current;

    // The umbrella follows the cursor closely but smoothly: a touchpad moves the pointer in small uneven steps, which
    // a sprite pinned to it frame by frame shows as jitter. It jumps straight there when it (re)appears or is far off.
    const held = heldRef.current;
    const far = Math.hypot(cursor.x - held.x, cursor.y - held.y) > 160;
    if (!held.shown || far) {
      held.x = cursor.x;
      held.y = cursor.y;
    } else {
      held.x = THREE.MathUtils.damp(held.x, cursor.x, 28, dt);
      held.y = THREE.MathUtils.damp(held.y, cursor.y, 28, dt);
    }
    held.shown = cursor.active;
    opacityRef.current = THREE.MathUtils.damp(opacityRef.current, cursor.active ? 1 : 0, 10, dt);
    (sprite.material as THREE.SpriteMaterial).opacity = opacityRef.current;
    sprite.position.set(held.x, held.y + 24 * scale, 6);

    if (!poolRef.current) {
      poolRef.current = Array.from({ length: SPLASH_COUNT }, () => ({ x: 0, y: 0, vx: 0, vy: 0, age: 0, alive: false, size: 0 }));
      const positions = new Float32Array(SPLASH_COUNT * 3);
      const sizes = new Float32Array(SPLASH_COUNT);
      points.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      points.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    }
    const pool = poolRef.current;

    if (cursor.active && opacityRef.current > 0.15) {
      spawnTimer.current -= dt;
      if (spawnTimer.current <= 0) {
        spawnTimer.current = 0.015;
        for (let s = 0; s < 3; s++) {
          const idx = nextIndexRef.current % SPLASH_COUNT;
          nextIndexRef.current++;
          // Spawn along the canopy arc (u = -1 left edge .. 0 apex .. 1 right edge) and launch
          // outward along the dome's surface tangent — a real bounce, not a puff from one spot.
          const u = Math.random() * 2 - 1;
          const domeLift = (1 - u * u) * 3 * scale;
          const outSpeed = 12 + Math.random() * 20;
          const upBias = 0.3 + 0.65 * (1 - Math.abs(u));
          pool[idx] = {
            x: held.x + u * CANOPY_HALF_WIDTH * scale,
            y: held.y + CANOPY_RIM_Y * scale + domeLift,
            vx: u * outSpeed * (0.8 + Math.random() * 0.4),
            vy: upBias * outSpeed + Math.random() * 5,
            age: 0,
            alive: true,
            size: 1 + Math.random() * 2,
          };
        }
      }
    }

    const posAttr = points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const sizeAttr = points.geometry.getAttribute('size') as THREE.BufferAttribute;
    pool.forEach((p, i) => {
      if (!p.alive) { sizeAttr.setX(i, 0); return; }
      p.age += dt;
      if (p.age >= SPLASH_LIFETIME) { p.alive = false; sizeAttr.setX(i, 0); return; }
      // Gravity pulls every bounced drop back down after its initial outward launch — a real
      // parabolic arc, not particles that just drift up and fade.
      p.vy -= GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const t = 1 - p.age / SPLASH_LIFETIME;
      posAttr.setXYZ(i, p.x, p.y, 6);
      sizeAttr.setX(i, p.size * t);
    });
    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
  });

  return (
    <>
      <sprite ref={spriteRef} scale={[51 * scale, 51 * scale, 1]} renderOrder={1}>
        <spriteMaterial map={texture} transparent opacity={0} depthWrite={false} />
      </sprite>
      <points ref={pointsRef} frustumCulled={false} renderOrder={3}>
        <bufferGeometry />
        <shaderMaterial
          vertexShader={DROPLET_VERTEX_SHADER}
          fragmentShader={DROPLET_FRAGMENT_SHADER}
          uniforms={uniforms}
          transparent
          depthWrite={false}
        />
      </points>
    </>
  );
}

/** Bespoke storm combo for the weather group: drizzle + a cursor-hugging umbrella + synced lightning. */
export function StormEffect({ width, height, pointerRef, params, umbrellaScale = 1 }: { width: number; height: number; pointerRef: MutableRefObject<PointerState>; params: StormTuningParams; umbrellaScale?: number }) {
  return (
    <>
      <Drizzle width={width} height={height} pointerRef={pointerRef} params={params} umbrellaScale={umbrellaScale} />
      <CursorLightningBolts width={width} height={height} pointerRef={pointerRef} params={params} />
      <CursorUmbrella pointerRef={pointerRef} scale={umbrellaScale} />
    </>
  );
}
