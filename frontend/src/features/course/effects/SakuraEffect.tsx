'use client';

import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PointerState } from './engine';

export type SakuraTuningParams = {
  treeScale: number;
  blossomSize: number;
  windStrength: number;
  gustSpeed: number;
  petalCount: number;
  petalDrift: number;
  petalFall: number;
  petalSize: number;
  blossomDensity: number;
  timeMode: 'auto' | 'dawn' | 'day' | 'dusk' | 'night' | 'cycle';
  cycleSeconds: number;
};

export function createSakuraParams(): SakuraTuningParams {
  return {
    treeScale: 1,
    blossomSize: 1,
    windStrength: 0.35,
    gustSpeed: 1,
    petalCount: 60,
    petalDrift: 55,
    petalFall: 28,
    petalSize: 7,
    blossomDensity: 1,
    timeMode: 'auto',
    cycleSeconds: 80,
  };
}

const CARD_DEPTH = 4;
const FULL_DEPTH = 5;
const MAX_PETALS = 200;
/** Petals blown off the twigs by a click, on top of the ones that drift down on their own. */
const BURST_PETALS = 180;
/** Seconds a stripped blossom waits before it starts to grow back, and how long it takes to open fully. */
const REGROW_DELAY = 2.5;
const REGROW_TIME = 9;
const PETAL_COLORS = ['#ffd3e3', '#f8b4cf', '#f391b7', '#ffe8f0'];

function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Blossom = { id: number; at: number; size: number };

type BranchNode = {
  id: number;
  depth: number;
  length: number;
  thickness: number;
  angle: number;
  attach: number;
  phase: number;
  children: BranchNode[];
  blossoms: Blossom[];
};

/**
 * Seeded, so the tree keeps the same silhouette across remounts. Every child's angle gets a small
 * positive (counter-clockwise, i.e. leftward) bias on top of its spread, so the crown grows out
 * over the card from a trunk planted at the right edge.
 */
function buildTree(height: number, scale: number, detailed: boolean) {
  const rand = mulberry32(1778);
  const nodes: BranchNode[] = [];
  let blossomCount = 0;
  const maxDepth = detailed ? FULL_DEPTH : CARD_DEPTH;

  function grow(depth: number, length: number, thickness: number, angle: number, attach: number): BranchNode {
    const node: BranchNode = { id: nodes.length, depth, length, thickness, angle, attach, phase: rand() * Math.PI * 2, children: [], blossoms: [] };
    nodes.push(node);
    if (depth >= 2) {
      if (detailed) {
        const count = depth === maxDepth ? 1 : 2;
        for (let i = 0; i < count; i++) {
          node.blossoms.push({ id: blossomCount++, at: i === 0 ? 0.45 + rand() * 0.2 : 0.85 + rand() * 0.15, size: 0.65 + rand() * 0.35 });
        }
      } else {
        node.blossoms.push({ id: blossomCount++, at: 1, size: 1.15 - depth * 0.1 });
        if (depth >= 3 || rand() > 0.4) node.blossoms.push({ id: blossomCount++, at: 0.45 + rand() * 0.3, size: 0.7 });
      }
    }
    if (depth < maxDepth) {
      const count = depth === 0 ? 3 : detailed && depth >= 3 ? (depth === 3 || rand() > 0.45 ? 2 : 1) : rand() > 0.35 ? 2 : 3;
      const spread = depth === 0 ? 0.75 : 0.6;
      for (let i = 0; i < count; i++) {
        const childAngle = 0.12 + spread * (i - (count - 1) / 2) + (rand() - 0.5) * 0.25;
        const childAttach = i === count - 1 ? 1 : 0.55 + rand() * 0.4;
        node.children.push(grow(depth + 1, length * (detailed && depth >= 3 ? 0.58 + rand() * 0.12 : 0.66 + rand() * 0.14), thickness * 0.62, childAngle, childAttach));
      }
    }
    return node;
  }

  const root = grow(0, height * 0.34 * scale, Math.max(3, height * 0.07 * scale), 0.22, 0);
  return { root, nodes, blossomCount, maxDepth };
}

function taperGeometry(detailed: boolean): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, 0);
  shape.lineTo(0.5, 0);
  if (detailed) {
    shape.bezierCurveTo(0.45, 0.3, 0.3, 0.68, 0.2, 1.02);
    shape.lineTo(-0.2, 1.02);
    shape.bezierCurveTo(-0.29, 0.66, -0.42, 0.3, -0.5, 0);
  } else {
    shape.lineTo(0.32, 1.02);
    shape.lineTo(-0.32, 1.02);
  }
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) + 0.5);
  return geometry;
}

function createBarkTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 64, 0);
  gradient.addColorStop(0, '#38251e');
  gradient.addColorStop(0.38, '#76513d');
  gradient.addColorStop(0.7, '#684333');
  gradient.addColorStop(1, '#34221d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 256);
  const rand = mulberry32(1780);
  for (let i = 0; i < 65; i++) {
    const x = rand() * 64;
    const y = rand() * 256;
    ctx.strokeStyle = rand() > 0.55 ? 'rgba(32,17,13,0.28)' : 'rgba(229,172,124,0.18)';
    ctx.lineWidth = 0.5 + rand() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x - 4 + rand() * 8, y + 20, x - 4 + rand() * 8, y + 42, x - 4 + rand() * 8, y + 70);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Rounded with the small notch at the tip that makes a sakura petal read as one.
function petalGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.5);
  shape.bezierCurveTo(0.42, -0.32, 0.52, 0.28, 0.2, 0.5);
  shape.lineTo(0, 0.36);
  shape.lineTo(-0.2, 0.5);
  shape.bezierCurveTo(-0.52, 0.28, -0.42, -0.32, 0, -0.5);
  return new THREE.ShapeGeometry(shape);
}

/** A cluster of five-petal flowers over a soft pink haze, drawn once and reused at every tip. */
function createBlossomTexture(detailed: boolean): THREE.CanvasTexture {
  const size = detailed ? 256 : 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = mulberry32(42);

  const haze = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.48);
  haze.addColorStop(0, detailed ? 'rgba(255,190,215,0.22)' : 'rgba(255,190,215,0.55)');
  haze.addColorStop(1, 'rgba(255,190,215,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, size, size);

  for (let f = 0; f < (detailed ? 18 : 10); f++) {
    const dir = rand() * Math.PI * 2;
    const dist = rand() * size * 0.28;
    const cx = size / 2 + Math.cos(dir) * dist;
    const cy = size / 2 + Math.sin(dir) * dist;
    const r = size * (0.07 + rand() * 0.05);
    ctx.fillStyle = PETAL_COLORS[Math.floor(rand() * PETAL_COLORS.length)];
    const offset = rand() * Math.PI;
    for (let p = 0; p < 5; p++) {
      const a = offset + (p / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7, r * 0.62, r * 0.48, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#f7d77a';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    if (detailed) {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.2;
      for (let p = 0; p < 5; p++) {
        const a = offset + (p / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r * 0.15, cy + Math.sin(a) * r * 0.15);
        ctx.lineTo(cx + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95);
        ctx.stroke();
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

type PetalState = {
  x: Float32Array;
  y: Float32Array;
  driftMul: Float32Array;
  fallMul: Float32Array;
  phase: Float32Array;
  rot: Float32Array;
  rotSpeed: Float32Array;
  flip: Float32Array;
  flipSpeed: Float32Array;
  size: Float32Array;
  ready: boolean;
};

function createPetalState(): PetalState {
  return {
    x: new Float32Array(MAX_PETALS),
    y: new Float32Array(MAX_PETALS),
    driftMul: new Float32Array(MAX_PETALS),
    fallMul: new Float32Array(MAX_PETALS),
    phase: new Float32Array(MAX_PETALS),
    rot: new Float32Array(MAX_PETALS),
    rotSpeed: new Float32Array(MAX_PETALS),
    flip: new Float32Array(MAX_PETALS),
    flipSpeed: new Float32Array(MAX_PETALS),
    size: new Float32Array(MAX_PETALS),
    ready: false,
  };
}

function spawnPetal(s: PetalState, i: number, from: THREE.Vector3, height: number, params: SakuraTuningParams, scatterSeconds: number) {
  s.x[i] = from.x + (Math.random() - 0.5) * height * 0.18;
  s.y[i] = from.y + (Math.random() - 0.5) * height * 0.12;
  s.driftMul[i] = 0.5 + Math.random() * 0.9;
  s.fallMul[i] = 0.5 + Math.random() * 0.9;
  s.phase[i] = Math.random() * Math.PI * 2;
  s.rot[i] = Math.random() * Math.PI * 2;
  s.rotSpeed[i] = (Math.random() - 0.5) * 3;
  s.flip[i] = Math.random() * Math.PI * 2;
  s.flipSpeed[i] = 1.5 + Math.random() * 3;
  s.size[i] = 0.7 + Math.random() * 0.6;
  if (scatterSeconds > 0) {
    // Pre-advance along the petal's own path so the scene doesn't open with an empty sky and
    // every petal still clinging to the tree.
    const k = Math.random() * scatterSeconds;
    s.x[i] -= params.petalDrift * s.driftMul[i] * k;
    s.y[i] -= params.petalFall * s.fallMul[i] * k;
  }
}

type BurstState = {
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  rot: Float32Array;
  rotSpeed: Float32Array;
  flip: Float32Array;
  flipSpeed: Float32Array;
  size: Float32Array;
  life: Float32Array;
  phase: Float32Array;
  next: number;
};

function createBurstState(): BurstState {
  const f = () => new Float32Array(BURST_PETALS);
  return { x: f(), y: f(), vx: f(), vy: f(), rot: f(), rotSpeed: f(), flip: f(), flipSpeed: f(), size: f(), life: f(), phase: f(), next: 0 };
}

/** Grows a stripped blossom back from a bud: nothing at 0, a slight overshoot as it opens, full at 1. */
const budToBloom = (level: number) => (level >= 1 ? 1 : 1 + 2.2 * (level - 1) ** 3 + 1.2 * (level - 1) ** 2);

type BranchProps = {
  node: BranchNode;
  registerBranch: (id: number, group: THREE.Group | null) => void;
  registerBlossom: (id: number, mesh: THREE.Mesh | null) => void;
  taper: THREE.BufferGeometry;
  joint: THREE.BufferGeometry;
  plane: THREE.BufferGeometry;
  barkMaterial: THREE.Material;
  blossomMaterial: THREE.Material;
  blossomBase: number;
};

function Branch(props: BranchProps) {
  const { node, registerBranch, registerBlossom, taper, joint, plane, barkMaterial, blossomMaterial, blossomBase } = props;
  return (
    <group ref={(g) => registerBranch(node.id, g)} rotation={[0, 0, node.angle]}>
      <mesh geometry={joint} material={barkMaterial} scale={[node.thickness * 0.5, node.thickness * 0.5, 1]} />
      <mesh geometry={taper} material={barkMaterial} scale={[node.thickness, node.length, 1]} />
      {node.blossoms.map((b) => {
        const s = blossomBase * b.size;
        return (
          <mesh
            key={b.id}
            ref={(m) => registerBlossom(b.id, m)}
            geometry={plane}
            material={blossomMaterial}
            position={[0, node.length * b.at, 0.5]}
            scale={[s, s, 1]}
          />
        );
      })}
      {node.children.map((child) => (
        <group key={child.id} position={[0, node.length * child.attach, 0]}>
          <Branch {...props} node={child} />
        </group>
      ))}
    </group>
  );
}

/**
 * A sakura tree planted at the card's right edge, its branches swaying leftward in the wind, with
 * petals breaking off the crown and drifting left and down. Branches are nested groups pivoting at
 * their own bases, so a twig inherits every sway above it — the trunk barely moves while the tips
 * visibly bend, and blossoms ride along with their branch for free. A click blows the blossoms near the cursor off
 * the twigs in a burst of petals; the bare twigs bud and flower again after a few seconds.
 */
export function SakuraEffect({ width, height, params, pointerRef, detailed = false }: { width: number; height: number; params: SakuraTuningParams; pointerRef: MutableRefObject<PointerState>; detailed?: boolean }) {
  const tree = useMemo(() => buildTree(height, params.treeScale, detailed), [height, params.treeScale, detailed]);
  const taper = useMemo(() => taperGeometry(detailed), [detailed]);
  const joint = useMemo(() => new THREE.CircleGeometry(1, 12), []);
  const plane = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const petal = useMemo(() => petalGeometry(), []);
  const blossomTexture = useMemo(() => createBlossomTexture(detailed), [detailed]);
  const barkTexture = useMemo(() => detailed ? createBarkTexture() : null, [detailed]);
  const barkMaterial = useMemo(() => new THREE.MeshBasicMaterial(barkTexture ? { map: barkTexture } : { color: '#5d3b2f' }), [barkTexture]);
  const blossomMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ map: blossomTexture, transparent: true, depthWrite: false }),
    [blossomTexture],
  );
  const petalMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }),
    [],
  );

  const rootRef = useRef<THREE.Group | null>(null);
  const branchRefs = useRef<(THREE.Group | null)[]>([]);
  const blossomRefs = useRef<(THREE.Mesh | null)[]>([]);
  const petalsRef = useRef<THREE.InstancedMesh | null>(null);
  const petalState = useRef<PetalState | null>(null);
  const spawnPoints = useRef<THREE.Vector3[]>([]);
  const blossomPositions = useRef<THREE.Vector3[]>([]);
  const bloomRef = useRef<{ level: Float32Array; regrowAt: Float32Array } | null>(null);
  const burstRef = useRef<BurstState | null>(null);
  const wasPressed = useRef(false);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const blossomSizes = useMemo(() => {
    const sizes = new Float32Array(tree.blossomCount);
    for (const node of tree.nodes) for (const b of node.blossoms) sizes[b.id] = b.size;
    return sizes;
  }, [tree]);
  const blossomBase = height * (detailed ? 0.13 : 0.2) * params.blossomSize;

  const registerBranch = useCallback((id: number, group: THREE.Group | null) => {
    branchRefs.current[id] = group;
  }, []);
  const registerBlossom = useCallback((id: number, mesh: THREE.Mesh | null) => {
    blossomRefs.current[id] = mesh;
  }, []);

  useEffect(() => {
    const mesh = petalsRef.current;
    if (!mesh) return;
    const palette = PETAL_COLORS.map((c) => new THREE.Color(c));
    for (let i = 0; i < MAX_PETALS + BURST_PETALS; i++) mesh.setColorAt(i, palette[i % palette.length]);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.count = 0;
  }, []);

  useEffect(() => () => {
    [taper, joint, plane, petal].forEach((g) => g.dispose());
    [barkMaterial, blossomMaterial, petalMaterial].forEach((m) => m.dispose());
    blossomTexture.dispose();
    barkTexture?.dispose();
  }, [taper, joint, plane, petal, barkMaterial, blossomMaterial, petalMaterial, blossomTexture, barkTexture]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const time = state.clock.elapsedTime;
    const t = time * params.gustSpeed;
    // Two slow, incommensurate sines multiplied together: gusts that build and die off
    // irregularly rather than pulsing on an obvious fixed beat.
    const gust = 0.55 + 0.45 * Math.sin(t * 0.37) * Math.sin(t * 0.13 + 1.3);

    for (const node of tree.nodes) {
      const group = branchRefs.current[node.id];
      if (!group) continue;
      const depthFactor = (node.depth + 1) / (tree.maxDepth + 1);
      group.rotation.z = node.angle + params.windStrength * depthFactor * (0.22 * gust + 0.07 * Math.sin(t * 2.3 + node.phase));
    }

    const mesh = petalsRef.current;
    const root = rootRef.current;
    if (!mesh || !root) return;
    root.updateMatrixWorld(true);

    const positions = blossomPositions.current;
    for (let i = 0; i < tree.blossomCount; i++) {
      if (!positions[i]) positions[i] = new THREE.Vector3();
      blossomRefs.current[i]?.getWorldPosition(positions[i]);
    }
    let bloom = bloomRef.current;
    if (!bloom || bloom.level.length !== tree.blossomCount) {
      bloom = { level: new Float32Array(tree.blossomCount).fill(1), regrowAt: new Float32Array(tree.blossomCount) };
      bloomRef.current = bloom;
    }
    if (!burstRef.current) burstRef.current = createBurstState();
    const burst = burstRef.current;
    const cursor = pointerRef.current;
    const k = Math.min(2, Math.max(0.6, height / 300));

    // A press blows the blossoms near it off their twigs: they shrink to bare buds and their petals fly off, away
    // from the cursor, then drift down with the rest. Each one grows back after a while.
    const pressed = cursor.active && !!cursor.pressed;
    if (pressed && !wasPressed.current) {
      const radius = Math.min(170, Math.max(60, height * 0.42));
      for (let i = 0; i < tree.blossomCount; i++) {
        const level = bloom.level[i];
        if (!blossomRefs.current[i] || level < 0.1) continue;
        const p = positions[i];
        const dx = p.x - cursor.x;
        const dy = p.y - cursor.y;
        const distance = Math.hypot(dx, dy);
        if (distance > radius) continue;
        const strength = Math.sqrt(1 - distance / radius);
        const lost = level * strength;
        bloom.level[i] = level - lost;
        bloom.regrowAt[i] = time + REGROW_DELAY + Math.random() * 4;
        const nx = distance > 0.001 ? dx / distance : -1;
        const ny = distance > 0.001 ? dy / distance : 0;
        const spread = blossomBase * blossomSizes[i] * 0.3;
        const n = 1 + Math.round(lost * (detailed ? 4 : 7) * blossomSizes[i]);
        for (let j = 0; j < n; j++) {
          const slot = burst.next;
          burst.next = (burst.next + 1) % BURST_PETALS;
          const speed = ((90 + Math.random() * 230) * strength + 40) * k;
          burst.x[slot] = p.x + (Math.random() - 0.5) * spread;
          burst.y[slot] = p.y + (Math.random() - 0.5) * spread;
          burst.vx[slot] = nx * speed + (Math.random() - 0.5) * 70 * k;
          burst.vy[slot] = ny * speed + (Math.random() - 0.3) * 70 * k;
          burst.rot[slot] = Math.random() * Math.PI * 2;
          burst.rotSpeed[slot] = (Math.random() - 0.5) * 9;
          burst.flip[slot] = Math.random() * Math.PI * 2;
          burst.flipSpeed[slot] = 3 + Math.random() * 5;
          burst.size[slot] = 0.7 + Math.random() * 0.6;
          burst.phase[slot] = Math.random() * Math.PI * 2;
          burst.life[slot] = 1;
        }
      }
    }
    wasPressed.current = pressed;

    // Stripped blossoms wait, then swell from buds back into full flower.
    for (let i = 0; i < tree.blossomCount; i++) {
      const blossom = blossomRefs.current[i];
      if (!blossom) continue;
      if (bloom.level[i] < 1 && time >= bloom.regrowAt[i]) bloom.level[i] = Math.min(1, bloom.level[i] + dt / REGROW_TIME);
      const grown = budToBloom(bloom.level[i]);
      const s = blossomBase * blossomSizes[i] * grown;
      blossom.visible = grown > 0.02;
      blossom.scale.set(s, s, 1);
    }

    // Petals drift down only from blossoms that are in flower.
    const points = spawnPoints.current;
    let pointCount = 0;
    for (let pass = 0; pass < 2 && pointCount === 0; pass++) {
      for (let i = 0; i < tree.blossomCount; i++) {
        if (!blossomRefs.current[i] || (pass === 0 && bloom.level[i] < 0.6)) continue;
        if (!points[pointCount]) points[pointCount] = new THREE.Vector3();
        points[pointCount].copy(positions[i]);
        pointCount++;
      }
    }
    if (pointCount === 0) {
      mesh.count = 0;
      return;
    }

    if (!petalState.current) petalState.current = createPetalState();
    const s = petalState.current;
    if (!s.ready) {
      for (let i = 0; i < MAX_PETALS; i++) spawnPetal(s, i, points[Math.floor(Math.random() * pointCount)], height, params, 8);
      s.ready = true;
    }

    const halfW = width / 2;
    const halfH = height / 2;
    const count = Math.min(MAX_PETALS, Math.max(0, Math.round(params.petalCount)));
    const drift = params.petalDrift * (0.6 + gust * 0.8);
    const repelRadius = 90;
    const repelForce = 155;
    for (let i = 0; i < count; i++) {
      s.x[i] -= drift * s.driftMul[i] * dt;
      s.y[i] += (-params.petalFall * s.fallMul[i] + Math.sin(time * 1.7 + s.phase[i]) * 10) * dt;
      if (cursor.active) {
        const dx = s.x[i] - cursor.x;
        const dy = s.y[i] - cursor.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 0.001 && distance < repelRadius) {
          const ease = (1 - distance / repelRadius) ** 2;
          s.x[i] += (dx / distance) * repelForce * ease * dt;
          s.y[i] += (dy / distance) * repelForce * ease * dt;
          s.rot[i] += (dx / distance) * ease * dt * 1.6;
        }
      }
      s.rot[i] += s.rotSpeed[i] * dt;
      s.flip[i] += s.flipSpeed[i] * dt;
      if (s.x[i] < -halfW - 40 || s.y[i] < -halfH - 40) {
        spawnPetal(s, i, points[Math.floor(Math.random() * pointCount)], height, params, 0);
      }
      const size = params.petalSize * s.size[i];
      dummy.position.set(s.x[i], s.y[i], 2);
      dummy.rotation.set(0, 0, s.rot[i]);
      // Squashing the width by |cos| of a spinning phase fakes a petal tumbling edge-on in 3D.
      dummy.scale.set(size * Math.max(0.25, Math.abs(Math.cos(s.flip[i]))), size, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    // Blown petals: flung out fast, then caught by the same wind and slowed to the drift of the others.
    let shown = count;
    const relax = 1 - Math.exp(-1.3 * dt);
    for (let i = 0; i < BURST_PETALS; i++) {
      if (burst.life[i] <= 0) continue;
      burst.vx[i] += (-drift * 0.9 - burst.vx[i]) * relax;
      burst.vy[i] += (-params.petalFall * 1.2 - burst.vy[i]) * relax * 0.8;
      burst.x[i] += burst.vx[i] * dt;
      burst.y[i] += (burst.vy[i] + Math.sin(time * 3 + burst.phase[i]) * 14 * k) * dt;
      burst.rot[i] += burst.rotSpeed[i] * dt;
      burst.flip[i] += burst.flipSpeed[i] * dt;
      burst.life[i] -= dt / 7;
      if (burst.x[i] < -halfW - 40 || burst.y[i] < -halfH - 40) burst.life[i] = 0;
      if (burst.life[i] <= 0) continue;
      const size = params.petalSize * burst.size[i] * Math.min(1, burst.life[i] * 6);
      dummy.position.set(burst.x[i], burst.y[i], 2);
      dummy.rotation.set(0, 0, burst.rot[i]);
      dummy.scale.set(size * Math.max(0.25, Math.abs(Math.cos(burst.flip[i]))), size, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(shown, dummy.matrix);
      shown++;
    }
    mesh.count = shown;
    mesh.instanceMatrix.needsUpdate = true;
  });

  const halfW = width / 2;
  const halfH = height / 2;
  const trunkX = halfW - Math.min(width * 0.14, height * 0.9);
  const trunkY = -halfH - height * 0.04;

  return (
    <group>
      <group ref={rootRef} position={[trunkX, trunkY, 1]}>
        <Branch
          node={tree.root}
          registerBranch={registerBranch}
          registerBlossom={registerBlossom}
          taper={taper}
          joint={joint}
          plane={plane}
          barkMaterial={barkMaterial}
          blossomMaterial={blossomMaterial}
          blossomBase={blossomBase}
        />
      </group>
      <instancedMesh ref={petalsRef} args={[petal, petalMaterial, MAX_PETALS + BURST_PETALS]} frustumCulled={false} />
    </group>
  );
}
