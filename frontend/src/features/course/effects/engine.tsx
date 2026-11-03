'use client';

import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export type ParticleShape = 'blob' | 'streak' | 'spark' | 'leaf';

export type PointerState = {
  x: number;
  y: number;
  active: boolean;
  moved: boolean;
  /** The main (left) mouse button is down, or a finger/pen is touching. Effects that only react to a press read this. */
  pressed?: boolean;
  /** Remember a short press even if pointerup arrives before the next animation frame. */
  press?: { serial: number; x: number; y: number; contact?: { x: number; y: number } };
  pressHistory?: readonly { serial: number; x: number; y: number; contact?: { x: number; y: number } }[];
  /** Physical finger position, kept for controls drawn inside a canvas. */
  contact?: { x: number; y: number };
  /** 'mouse', 'touch' or 'pen', as PointerEvent reports it. */
  pointerType?: string;
};

const dummy = new THREE.Object3D();

// Shared control points for the leaf's right-side outline (bottom tip -> top tip), used both to
// build the actual geometry and — via leafRightEdgeX below — to know exactly how far the veins
// drawn into the texture can reach before they'd poke past the silhouette.
const LEAF_BOTTOM_TIP = { x: 0, y: -0.5 };
const LEAF_RIGHT_CTRL1 = { x: 0.46, y: -0.32 };
const LEAF_RIGHT_CTRL2 = { x: 0.4, y: 0.3 };
const LEAF_TOP_TIP = { x: 0, y: 0.5 };

/** X of the leaf's right edge at a given local y (bottom tip=-0.5 .. top tip=0.5), by sampling
 * the same cubic bezier `leafGeometry` draws and interpolating between the nearest samples. */
function leafRightEdgeX(localY: number): number {
  const steps = 48;
  let prevX = LEAF_BOTTOM_TIP.x;
  let prevY = LEAF_BOTTOM_TIP.y;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const x =
      mt * mt * mt * LEAF_BOTTOM_TIP.x +
      3 * mt * mt * t * LEAF_RIGHT_CTRL1.x +
      3 * mt * t * t * LEAF_RIGHT_CTRL2.x +
      t * t * t * LEAF_TOP_TIP.x;
    const y =
      mt * mt * mt * LEAF_BOTTOM_TIP.y +
      3 * mt * mt * t * LEAF_RIGHT_CTRL1.y +
      3 * mt * t * t * LEAF_RIGHT_CTRL2.y +
      t * t * t * LEAF_TOP_TIP.y;
    if (y >= localY) {
      const span = y - prevY;
      const frac = span !== 0 ? (localY - prevY) / span : 0;
      return prevX + (x - prevX) * frac;
    }
    prevX = x;
    prevY = y;
  }
  return prevX;
}

// A real pointed-oval leaf silhouette (two bezier curves from one tip to the other, bulging out
// to the sides) — a plain PlaneGeometry here reads as a falling rectangle, not a leaf.
function leafGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(LEAF_BOTTOM_TIP.x, LEAF_BOTTOM_TIP.y);
  shape.bezierCurveTo(LEAF_RIGHT_CTRL1.x, LEAF_RIGHT_CTRL1.y, LEAF_RIGHT_CTRL2.x, LEAF_RIGHT_CTRL2.y, LEAF_TOP_TIP.x, LEAF_TOP_TIP.y);
  shape.bezierCurveTo(-LEAF_RIGHT_CTRL2.x, LEAF_RIGHT_CTRL2.y, -LEAF_RIGHT_CTRL1.x, LEAF_RIGHT_CTRL1.y, LEAF_BOTTOM_TIP.x, LEAF_BOTTOM_TIP.y);
  const geo = new THREE.ShapeGeometry(shape);
  // ShapeGeometry's default UVs are raw shape-space coordinates (e.g. (0, -0.5) at the tip), not
  // normalized to [0,1] — sampling a texture with those clamps almost everywhere to a single edge
  // pixel, so the vein texture below would've rendered as one flat color. Remap to the shape's own
  // bounding box so the texture actually spans the visible leaf.
  geo.computeBoundingBox();
  const bbox = geo.boundingBox!;
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  const position = geo.getAttribute('position') as THREE.BufferAttribute;
  const w = bbox.max.x - bbox.min.x || 1;
  const h = bbox.max.y - bbox.min.y || 1;
  for (let i = 0; i < position.count; i++) {
    uv.setXY(i, (position.getX(i) - bbox.min.x) / w, (position.getY(i) - bbox.min.y) / h);
  }
  uv.needsUpdate = true;
  return geo;
}

function shapeGeometry(shape: ParticleShape) {
  if (shape === 'streak') return new THREE.PlaneGeometry(0.35, 1.6);
  if (shape === 'spark') return new THREE.PlaneGeometry(0.5, 0.5);
  if (shape === 'leaf') return leafGeometry();
  return new THREE.PlaneGeometry(0.9, 0.7);
}

// A midrib + a few branching side veins, drawn as translucent dark strokes over a white fill —
// multiplied against each instance's own tint color (via instanceColor), so the veins render as
// a darker shade of whatever color that particular leaf got, same as on a real leaf, instead of a
// flat single-color silhouette. `leafGeometry`'s UVs span this same 0..1 square (ShapeGeometry
// derives UVs from the shape's own bounding box), so the veins line up with the leaf outline.
function createLeafVeinTexture(veinPairs = 3): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  // These particles render as small as ~7 world units on screen, which downscales this 64px
  // texture by ~9x — at the original 2px/1.4px line widths, minification (mipmapping) blurred the
  // veins into a difference of only a few color values, invisible in practice. Thicker lines
  // survive that downscale with real contrast at every size in sizeRange.
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(size / 2, size * 0.08);
  ctx.lineTo(size / 2, size * 0.92);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 4;
  // How far a side vein reaches previously came from an arbitrary formula, unrelated to the
  // leaf's actual outline — it stopped well short of the real edge. leafRightEdgeX gives the
  // silhouette's true half-width at this vein's height (same bezier curve as the geometry).
  // Deliberately overshoot that boundary (margin > 1) rather than stopping just inside it: the
  // geometry itself clips any texture content past its own silhouette, so overshooting is what
  // actually makes the vein terminate flush against the leaf's edge instead of visibly stopping
  // short of it — matching short of the boundary left a gap that was barely perceptible as
  // "not quite reaching the edge" rather than clearly short.
  const bboxWidth = 0.92; // the shape's actual bounding-box width, used for the same UV normalization leafGeometry applies
  const edgeMargin = 1.2;
  // Texture v=0 is the *bottom* of the canvas image once flipY (the THREE.Texture default)
  // un-flips it for GPU sampling, matching leafGeometry's own bbox-based UV mapping.
  for (let i = 1; i <= veinPairs; i++) {
    const t = i / (veinPairs + 1);
    const y = size * (0.16 + t * 0.68);
    const localY = 0.5 - y / size;
    const edgeX = leafRightEdgeX(localY);
    const spread = (size * edgeX * edgeMargin) / bboxWidth;
    ctx.beginPath();
    ctx.moveTo(size / 2, y);
    ctx.lineTo(size / 2 - spread, y - spread * 0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(size / 2, y);
    ctx.lineTo(size / 2 + spread, y - spread * 0.55);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export type AmbientParticlesConfig = {
  count: number;
  colors: string[];
  shape: ParticleShape;
  sizeRange: [number, number];
  fallSpeedRange: [number, number];
  swayAmplitude?: number;
  swaySpeedRange?: [number, number];
  rotationSpeedRange?: [number, number];
  opacity?: number;
  /** 1 = falls (default), -1 = rises (e.g. bubbles/balloons). */
  direction?: 1 | -1;
  /** Only used when `shape: 'leaf'` — number of side-vein pairs branching off the midrib. */
  veinCount?: number;
  /** Optional soft cursor avoidance for drifting particles, in scene pixels. */
  cursorRepelRadius?: number;
  /** Speed of cursor avoidance at the centre of that radius, in scene pixels per second. */
  cursorRepelForce?: number;
};

type AmbientParticle = {
  x: number; y: number; z: number; vy: number;
  swayPhase: number; swaySpeed: number; swayAmp: number;
  rot: number; rotSpeed: number; scale: number; color: THREE.Color;
};

// Randomised, so it must run inside the animation loop (useFrame) rather than during render.
function spawnAmbientParticles(width: number, height: number, config: AmbientParticlesConfig, palette: THREE.Color[]): AmbientParticle[] {
  const halfW = Math.max(width, 1) / 2;
  const halfH = Math.max(height, 1) / 2;
  const [minSpeed, maxSpeed] = config.fallSpeedRange;
  const [minSize, maxSize] = config.sizeRange;
  const [minRot, maxRot] = config.rotationSpeedRange ?? [-0.5, 0.5];
  const [minSway, maxSway] = config.swaySpeedRange ?? [0.5, 1.2];
  const direction = config.direction ?? 1;
  return Array.from({ length: config.count }, () => ({
    x: (Math.random() * 2 - 1) * halfW,
    y: (Math.random() * 2 - 1) * halfH,
    z: Math.random() * 10,
    vy: -direction * (minSpeed + Math.random() * (maxSpeed - minSpeed)),
    swayPhase: Math.random() * Math.PI * 2,
    swaySpeed: minSway + Math.random() * (maxSway - minSway),
    swayAmp: config.swayAmplitude ?? 20,
    rot: Math.random() * Math.PI * 2,
    rotSpeed: minRot + Math.random() * (maxRot - minRot),
    scale: minSize + Math.random() * (maxSize - minSize),
    color: palette[Math.floor(Math.random() * palette.length)] ?? new THREE.Color('#ffffff'),
  }));
}

/** Continuous falling particles (leaves, rain) recycled from the top once they leave the bottom. */
export function AmbientParticles({ width, height, config, pointerRef }: { width: number; height: number; config: AmbientParticlesConfig; pointerRef?: MutableRefObject<PointerState> }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => shapeGeometry(config.shape), [config.shape]);
  const veinTexture = useMemo(
    () => (config.shape === 'leaf' ? createLeafVeinTexture(config.veinCount) : null),
    [config.shape, config.veinCount],
  );
  const palette = useMemo(() => config.colors.map((c) => new THREE.Color(c)), [config.colors]);
  const stateRef = useRef<{ key: string; particles: AmbientParticle[] } | null>(null);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    // Every particle's own scale/speed/sway/rotation is randomized once at spawn from the current
    // config's ranges, not re-read every frame — so the key has to cover the whole config, not
    // just `count`, or tuning-panel sliders like size/speed/sway silently do nothing (they mutate
    // the config object, but nothing here would ever notice and respawn against the new ranges).
    const key = `${Math.round(width)}x${Math.round(height)}x${JSON.stringify(config)}`;
    if (!stateRef.current || stateRef.current.key !== key) {
      stateRef.current = { key, particles: spawnAmbientParticles(width, height, config, palette) };
    }
    const particles = stateRef.current.particles;
    const halfW = Math.max(width, 1) / 2;
    const halfH = Math.max(height, 1) / 2;
    const dt = Math.min(delta, 0.05);
    const direction = config.direction ?? 1;
    const cursor = pointerRef?.current;
    const repelRadius = config.cursorRepelRadius ?? 0;
    const repelForce = config.cursorRepelForce ?? 0;
    particles.forEach((p, i) => {
      p.y += p.vy * dt;
      p.swayPhase += p.swaySpeed * dt;
      p.rot += p.rotSpeed * dt;
      if (direction === 1 && p.y < -halfH - 20) {
        p.y = halfH + 10;
        p.x = (Math.random() * 2 - 1) * halfW;
      } else if (direction === -1 && p.y > halfH + 20) {
        p.y = -halfH - 10;
        p.x = (Math.random() * 2 - 1) * halfW;
      }
      let x = p.x + Math.sin(p.swayPhase) * p.swayAmp;
      if (cursor?.active && repelRadius > 0 && repelForce > 0) {
        const dx = x - cursor.x;
        const dy = p.y - cursor.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 0.001 && distance < repelRadius) {
          const ease = (1 - distance / repelRadius) ** 2;
          p.x += (dx / distance) * repelForce * ease * dt;
          p.y += (dy / distance) * repelForce * ease * dt;
          p.rot += (dx / distance) * ease * dt * 1.6;
          x = p.x + Math.sin(p.swayPhase) * p.swayAmp;
        }
      }
      dummy.position.set(x, p.y, p.z);
      dummy.rotation.z = p.rot;
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, p.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, config.count]} frustumCulled={false}>
      <meshBasicMaterial transparent opacity={config.opacity ?? 0.85} depthWrite={false} map={veinTexture} />
    </instancedMesh>
  );
}

export type CursorParticlesConfig = {
  count: number;
  colors: string[];
  shape: ParticleShape;
  sizeRange: [number, number];
  lifetime: number;
  speedRange: [number, number];
  spawnPerMove: number;
  gravity?: number;
};

type CursorParticle = {
  x: number; y: number; vx: number; vy: number; age: number; alive: boolean;
  size: number; color: THREE.Color;
};

function makeCursorPool(count: number): CursorParticle[] {
  return Array.from({ length: count }, () => ({ x: 0, y: 0, vx: 0, vy: 0, age: 0, alive: false, size: 0, color: new THREE.Color('#fff') }));
}

/** Short-lived burst particles spawned at a moving pointer position (speed trails, sparks). */
export function CursorParticles({ pointerRef, config }: { pointerRef: MutableRefObject<PointerState>; config: CursorParticlesConfig }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => shapeGeometry(config.shape), [config.shape]);
  const palette = useMemo(() => config.colors.map((c) => new THREE.Color(c)), [config.colors]);
  const poolRef = useRef<CursorParticle[] | null>(null);
  const nextIndexRef = useRef(0);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    if (!poolRef.current || poolRef.current.length !== config.count) {
      poolRef.current = makeCursorPool(config.count);
      nextIndexRef.current = 0;
    }
    const particles = poolRef.current;
    const dt = Math.min(delta, 0.05);
    const cursor = pointerRef.current;
    const [minSize, maxSize] = config.sizeRange;
    const [minSpeed, maxSpeed] = config.speedRange;

    if (cursor.moved && cursor.active) {
      for (let s = 0; s < config.spawnPerMove; s++) {
        const idx = nextIndexRef.current % config.count;
        nextIndexRef.current++;
        const angle = Math.random() * Math.PI * 2;
        const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
        particles[idx] = {
          x: cursor.x,
          y: cursor.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          age: 0,
          alive: true,
          size: minSize + Math.random() * (maxSize - minSize),
          color: palette[Math.floor(Math.random() * palette.length)] ?? new THREE.Color('#fff'),
        };
      }
      cursor.moved = false;
    }

    particles.forEach((p, i) => {
      if (!p.alive) {
        dummy.position.set(0, 0, -1000);
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        return;
      }
      p.age += dt;
      if (p.age >= config.lifetime) {
        p.alive = false;
        dummy.position.set(0, 0, -1000);
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        return;
      }
      p.vy -= (config.gravity ?? 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const t = p.age / config.lifetime;
      const scale = Math.max(p.size * (1 - t), 0.0001);
      dummy.position.set(p.x, p.y, 0);
      dummy.rotation.z = Math.atan2(p.vy, p.vx);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, p.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, config.count]} frustumCulled={false}>
      <meshBasicMaterial transparent opacity={0.9} depthWrite={false} />
    </instancedMesh>
  );
}
