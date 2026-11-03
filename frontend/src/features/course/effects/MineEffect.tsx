'use client';
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PointerState } from './engine';
import { MineMiner, PICK_TIP, PICK_SHOULDER, PICK_CONTACT_ANGLE } from './MineMiner';

/** Live-tunable knobs for the mine scene, surfaced through the on-page effect tuning panel. */
export type MineTuningParams = {
  /** Cursor lantern brightness. Lights are physically-based in three r155+, so this is large. */
  lanternIntensity: number;
  /** How far the lantern reaches before falling off completely. */
  lanternRange: number;
  /** The faint "moonlight" fill everything else sits in — deliberately near-dark. */
  ambientLight: number;
  /** Seconds between pickaxe strikes. */
  strikeInterval: number;
  sparkCount: number;
  debrisCount: number;
  dustCount: number;
  /** Miner height as a fraction of the card height. */
  minerScale: number;
  /** How quickly the hand at the top of the chain catches up with the cursor. */
  chainFollowSpeed: number;
  /** Downward force applied to the hanging links. */
  chainGravity: number;
  /** Velocity retained by each chain link per simulation tick. */
  chainDamping: number;
  /** Total chain length as a fraction of the effect height. */
  chainLength: number;
  /** How firmly the distance constraints hold each link in place. */
  chainStiffness: number;
  /** Constraint passes per animation frame; higher values make the chain more stable. */
  chainSolverIterations: number;
};

export function createMineParams(): MineTuningParams {
  return {
    lanternIntensity: 60000,
    lanternRange: 1200,
    ambientLight: 0.38,
    strikeInterval: 1.6,
    sparkCount: 70,
    debrisCount: 40,
    dustCount: 46,
    minerScale: 0.62,
    chainFollowSpeed: 23,
    chainGravity: 2.2,
    chainDamping: 0.74,
    chainLength: 0.16,
    chainStiffness: 0.7,
    chainSolverIterations: 24,
  };
}

/** Vertical field of view of the perspective camera this scene needs — shared with EffectCanvas
 * so both sides agree on the projection used to convert cursor pixels into world coordinates. */
export const MINE_CAMERA_FOV = 45;
export function mineCameraDistance(height: number): number {
  return height / (2 * Math.tan((MINE_CAMERA_FOV * Math.PI) / 360));
}

const ROCK_COLOR = '#626b70';
const ROCK_DARK_COLOR = '#303a43';
const GOLD_COLOR = '#d8ad3a';
const TIMBER_COLOR = '#5a4028';
const CHAIN_GOLD = '#e0b93a';
// World coordinates are derived from the card's pixel size, so ordinary Verlet gravity was
// visually negligible. This converts the debug-slider value into a noticeable screen-space pull.
const CHAIN_GRAVITY_SCALE = 8;

/** Deterministic pseudo-random so the rock/gold layout is stable across re-renders. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

type Chunk = { x: number; y: number; z: number; size: number; gold: boolean; rot: number };

/**
 * The quarry wall the miner works — a solid rock face (not a scatter of floating boulders) with
 * bumpy relief pressed flush against it, one diagonal gold seam, and a timber support frame in
 * front of it (posts + crossbeam) that reads as "mine shaft" at a glance.
 */
function MineWall({ width, height, wallX }: { width: number; height: number; wallX: number }) {
  const chunks = useMemo<Chunk[]>(() => {
    const rand = seeded(20260912);
    const out: Chunk[] = [];
    // Relief bumps, bulging toward the miner (+X) from the wall face — reads as rock texture,
    // not separate boulders, because they stay pressed right up against the wall plane.
    for (let i = 0; i < 48; i++) {
      const size = height * (0.045 + rand() * 0.07);
      out.push({
        x: wallX - size * 0.7 - rand() * height * 0.63,
        y: -height * 0.4 + rand() * height * 0.8,
        z: -height * 0.07 + rand() * height * 0.045,
        size,
        gold: false,
        rot: rand() * Math.PI,
      });
    }
    // Rubble piled at the foot of the wall.
    for (let i = 0; i < 9; i++) {
      const size = height * (0.028 + rand() * 0.045);
      out.push({
        x: wallX + rand() * height * 0.3,
        y: -height / 2 + size * 0.35,
        z: -height * 0.05 + rand() * height * 0.15,
        size,
        gold: rand() < 0.2,
        rot: rand() * Math.PI,
      });
    }
    return out;
  }, [wallX, height]);

  const postSpread = height * 0.62;
  const postX1 = wallX + height * 0.14;
  const postX2 = wallX + height * 0.42 + postSpread;
  const postTop = height * 0.34;
  const postBottom = -height / 2;
  // A second, smaller support frame further back implies the shaft keeps going instead of
  // stopping dead at one wall — a cheap depth cue without building an actual tunnel.
  const farScale = 0.62;
  const farZ = -height * 0.4;
  const farPostX1 = wallX + height * 0.15;
  const farPostX2 = farPostX1 + postSpread * farScale;
  const farTop = height * 0.34 * farScale;

  const railZ = height * 0.16;
  const railLength = height * 0.85;
  const railStartX = wallX + height * 0.18;
  const cartX = wallX + height * 0.62;

  return (
    <group>
      {/* Rock face the pickaxe hits */}
      <mesh position={[wallX - height * 0.42, 0, -height * 0.13]} receiveShadow>
        <boxGeometry args={[height * 0.84, height * 1.4, height * 0.14]} />
        <meshStandardMaterial color={ROCK_COLOR} roughness={0.95} metalness={0.05} side={THREE.DoubleSide} />
      </mesh>
      {/* One diagonal gold seam running across the face — a real vein, not scattered nuggets. */}
      {Array.from({ length: 28 }, (_, i) => {
        const t = i / 27;
        return <mesh key={`vein-${i}`} position={[wallX - height * (0.025 + t * 0.62), height * (-0.18 + t * 0.52 + Math.sin(i * 1.8) * 0.025), -height * 0.035]} rotation={[i, i * 0.8, i * 0.4]} scale={[1.5, 0.65, 0.7]}>
          <dodecahedronGeometry args={[height * (0.018 + (i % 3) * 0.005), 0]} />
          <meshStandardMaterial color={i % 3 ? GOLD_COLOR : '#f1cd6a'} roughness={0.29} metalness={0.8} />
        </mesh>;
      })}
      {/* Cave backdrop so the scene never shows empty void behind the miner */}
      <mesh position={[0, 0, -height * 0.55]}>
        <planeGeometry args={[width * 1.6, height * 1.6]} />
        <meshStandardMaterial color={ROCK_DARK_COLOR} roughness={1} metalness={0} />
      </mesh>
      {/* Floor */}
      <mesh position={[0, -height * 0.46, -height * 0.1]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width * 1.6, height * 0.9]} />
        <meshStandardMaterial color={ROCK_DARK_COLOR} roughness={1} metalness={0} />
      </mesh>
      {chunks.map((c, i) => (
        <mesh key={i} position={[c.x, c.y, c.z]} rotation={[c.rot, c.rot * 0.7, c.rot * 0.3]} castShadow receiveShadow>
          <dodecahedronGeometry args={[c.size * 0.75, 0]} />
          {c.gold ? (
            <meshStandardMaterial color={GOLD_COLOR} roughness={0.22} metalness={0.95} />
          ) : (
            <meshStandardMaterial color={ROCK_COLOR} roughness={0.9} metalness={0.05} />
          )}
        </mesh>
      ))}
      {/* Timber support frame between the wall and the open floor — the single most recognizable
          "mine" signifier, so it's kept simple and unmissable. */}
      <mesh position={[postX1, (postTop + postBottom) / 2, -height * 0.25]}>
        <cylinderGeometry args={[height * 0.026, height * 0.032, postTop - postBottom, 8]} />
        <meshStandardMaterial color={TIMBER_COLOR} roughness={0.9} />
      </mesh>
      <mesh position={[postX2, (postTop + postBottom) / 2, -height * 0.25]}>
        <cylinderGeometry args={[height * 0.026, height * 0.032, postTop - postBottom, 8]} />
        <meshStandardMaterial color={TIMBER_COLOR} roughness={0.9} />
      </mesh>
      <mesh position={[(postX1 + postX2) / 2, postTop + height * 0.02, -height * 0.25]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[height * 0.034, height * 0.034, postSpread + height * 0.1, 8]} />
        <meshStandardMaterial color={TIMBER_COLOR} roughness={0.9} />
      </mesh>

      {/* Second, smaller support frame further back — the shaft reads as continuing into the
          dark instead of ending at a single flat wall. */}
      <mesh position={[farPostX1, (farTop + postBottom) / 2, farZ]}>
        <cylinderGeometry args={[height * 0.02, height * 0.024, farTop - postBottom, 7]} />
        <meshStandardMaterial color={ROCK_DARK_COLOR} roughness={0.95} />
      </mesh>
      <mesh position={[farPostX2, (farTop + postBottom) / 2, farZ]}>
        <cylinderGeometry args={[height * 0.02, height * 0.024, farTop - postBottom, 7]} />
        <meshStandardMaterial color={ROCK_DARK_COLOR} roughness={0.95} />
      </mesh>
      <mesh position={[(farPostX1 + farPostX2) / 2, farTop + height * 0.015, farZ]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[height * 0.026, height * 0.026, postSpread * farScale + height * 0.08, 7]} />
        <meshStandardMaterial color={ROCK_DARK_COLOR} roughness={0.95} />
      </mesh>

      {/* Rail tracks + a small ore cart — the single most recognizable "someone actually works
          here" prop, so the shaft doesn't read as just an empty tunnel with one guy in it. */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[railStartX + railLength / 2, -height / 2 + height * 0.012, railZ + side * height * 0.05]}>
          <boxGeometry args={[railLength, height * 0.014, height * 0.02]} />
          <meshStandardMaterial color="#6b6258" roughness={0.6} metalness={0.4} />
        </mesh>
      ))}
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[railStartX + (i / 6) * railLength, -height / 2 + height * 0.006, railZ]}>
          <boxGeometry args={[height * 0.02, height * 0.012, height * 0.14]} />
          <meshStandardMaterial color={TIMBER_COLOR} roughness={0.9} />
        </mesh>
      ))}
      <group position={[cartX, -height / 2 + height * 0.09, railZ]}>
        <mesh>
          <boxGeometry args={[height * 0.22, height * 0.025, height * 0.16]} />
          <meshStandardMaterial color="#5a5147" roughness={0.7} metalness={0.3} />
        </mesh>
        {[-1, 1].map(side => <group key={side}>
          <mesh position={[0, height * 0.055, side * height * 0.08]} rotation={[side * 0.12, 0, 0]}><boxGeometry args={[height * 0.24, height * 0.13, height * 0.012]} /><meshStandardMaterial color="#52646b" metalness={0.65} roughness={0.47} /></mesh>
          <mesh position={[side * height * 0.115, height * 0.055, 0]}><boxGeometry args={[height * 0.012, height * 0.13, height * 0.17]} /><meshStandardMaterial color="#52646b" metalness={0.65} roughness={0.47} /></mesh>
          {[-1, 1].map(axle => <group key={axle} position={[axle * height * 0.075, -height * 0.04, side * height * 0.092]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[height * 0.039, height * 0.039, height * 0.018, 18]} /><meshStandardMaterial color="#242c31" metalness={0.75} roughness={0.4} /></mesh>
            <mesh position={[0, 0, side * height * 0.012]}><sphereGeometry args={[height * 0.012, 10, 8]} /><meshStandardMaterial color="#a89a77" metalness={0.8} roughness={0.35} /></mesh>
          </group>)}
          {[0, 1, 2, 3, 4].map(i => <mesh key={i} position={[height * (-0.09 + i * 0.045), height * 0.09, side * height * 0.093]}><sphereGeometry args={[height * 0.005, 8, 6]} /><meshStandardMaterial color="#a5a395" metalness={0.7} roughness={0.3} /></mesh>)}
        </group>)}
        {/* a little ore poking over the rim */}
        <mesh position={[height * 0.02, height * 0.09, 0]}>
          <dodecahedronGeometry args={[height * 0.06, 0]} />
          <meshStandardMaterial color={GOLD_COLOR} roughness={0.3} metalness={0.85} />
        </mesh>
      </group>

      {/* A shovel leaning against the near support post — cheap detail that sells "workplace". */}
      <group position={[postX1 - height * 0.05, -height / 2, height * 0.14]} rotation={[0, 0, 0.32]}>
        <mesh position={[0, height * 0.24, 0]}>
          <cylinderGeometry args={[height * 0.012, height * 0.012, height * 0.5, 6]} />
          <meshStandardMaterial color={TIMBER_COLOR} roughness={0.85} />
        </mesh>
        <mesh position={[0, height * 0.035, 0]} scale={[1, 1.3, 0.2]}>
          <sphereGeometry args={[height * 0.045, 16, 12]} />
          <meshStandardMaterial color="#a7aeb8" roughness={0.4} metalness={0.7} />
        </mesh>
        <mesh position={[0, height * 0.51, 0]}><torusGeometry args={[height * 0.027, height * 0.007, 8, 16]} /><meshStandardMaterial color={TIMBER_COLOR} /></mesh>
      </group>
    </group>
  );
}


type Particle = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; size: number };

function makePool(count: number): Particle[] {
  return Array.from({ length: count }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, size: 0 }));
}

const PARTICLE_VERTEX = /* glsl */ `
  attribute float size;
  attribute float alpha;
  varying float vAlpha;
  void main() {
    vAlpha = alpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (300.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const PARTICLE_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv) * 2.0;
    float a = smoothstep(1.0, 0.15, d) * vAlpha;
    gl_FragColor = vec4(uColor, a);
  }
`;

/**
 * Sparks (bright, additive, short-lived) and rock debris (duller, heavier, falls to the floor),
 * both spawned in bursts at the point where the pickaxe meets the wall.
 */
function StrikeDebris({
  sparkRef,
  params,
  height,
}: {
  sparkRef: MutableRefObject<{ spawn: (x: number, y: number, z: number) => void } | null>;
  params: MineTuningParams;
  height: number;
}) {
  const sparkPoints = useRef<THREE.Points>(null);
  const debrisPoints = useRef<THREE.Points>(null);
  const sparkPool = useRef<Particle[]>([]);
  const debrisPool = useRef<Particle[]>([]);
  const sparkIdx = useRef(0);
  const debrisIdx = useRef(0);

  const sparkUniforms = useMemo(() => ({ uColor: { value: new THREE.Color('#ffc24d') } }), []);
  const debrisUniforms = useMemo(() => ({ uColor: { value: new THREE.Color('#9a7b4a') } }), []);

  const sparkCount = Math.max(Math.round(params.sparkCount), 1);
  const debrisCount = Math.max(Math.round(params.debrisCount), 1);

  // Registered after mount (refs must not be touched during render) — the miner's strike calls
  // this to fire a burst at the point where the pickaxe meets the rock.
  useEffect(() => {
    sparkRef.current = {
      spawn: (x: number, y: number, z: number) => {
        const sparks = sparkPool.current;
        const debris = debrisPool.current;
        if (!sparks.length || !debris.length) return;
        const burst = Math.max(6, Math.round(sparks.length * 0.35));
        for (let i = 0; i < burst; i++) {
          const p = sparks[sparkIdx.current % sparks.length];
          sparkIdx.current++;
          const ang = Math.random() * Math.PI * 2;
          const up = Math.random() * 0.9 + 0.1;
          const speed = height * (0.25 + Math.random() * 0.7);
          p.x = x; p.y = y; p.z = z;
          p.vx = Math.abs(Math.cos(ang)) * speed * 0.9;
          p.vy = up * speed;
          p.vz = Math.sin(ang) * speed * 0.5;
          p.life = 0.28 + Math.random() * 0.35;
          p.size = height * (0.012 + Math.random() * 0.022);
        }
        const debrisBurst = Math.max(4, Math.round(debris.length * 0.3));
        for (let i = 0; i < debrisBurst; i++) {
          const p = debris[debrisIdx.current % debris.length];
          debrisIdx.current++;
          const ang = Math.random() * Math.PI * 2;
          const speed = height * (0.15 + Math.random() * 0.4);
          p.x = x; p.y = y; p.z = z;
          p.vx = Math.abs(Math.cos(ang)) * speed;
          p.vy = Math.random() * speed * 0.8;
          p.vz = Math.sin(ang) * speed * 0.6;
          p.life = 0.9 + Math.random() * 0.8;
          p.size = height * (0.016 + Math.random() * 0.026);
        }
      },
    };
    const ref = sparkRef;
    return () => { ref.current = null; };
  }, [sparkRef, height]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const gravity = height * 1.6;
    const floorY = -height / 2 + height * 0.02;
    if (sparkPool.current.length !== sparkCount) sparkPool.current = makePool(sparkCount);
    if (debrisPool.current.length !== debrisCount) debrisPool.current = makePool(debrisCount);

    const step = (pool: Particle[], points: THREE.Points | null, heavy: boolean) => {
      if (!points) return;
      const geo = points.geometry;
      let pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
      let sizeAttr = geo.getAttribute('size') as THREE.BufferAttribute | undefined;
      let alphaAttr = geo.getAttribute('alpha') as THREE.BufferAttribute | undefined;
      if (!pos || pos.count !== pool.length) {
        pos = new THREE.BufferAttribute(new Float32Array(pool.length * 3), 3);
        sizeAttr = new THREE.BufferAttribute(new Float32Array(pool.length), 1);
        alphaAttr = new THREE.BufferAttribute(new Float32Array(pool.length), 1);
        geo.setAttribute('position', pos);
        geo.setAttribute('size', sizeAttr);
        geo.setAttribute('alpha', alphaAttr);
      }
      pool.forEach((p, i) => {
        if (p.life > 0) {
          p.life -= dt;
          p.vy -= gravity * dt * (heavy ? 1 : 0.45);
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          if (heavy && p.y < floorY) {
            p.y = floorY;
            p.vy *= -0.25;
            p.vx *= 0.6;
            p.vz *= 0.6;
          }
        }
        const alive = p.life > 0;
        pos!.setXYZ(i, p.x, p.y, p.z);
        sizeAttr!.setX(i, alive ? p.size : 0);
        alphaAttr!.setX(i, alive ? Math.min(1, p.life * 3) : 0);
      });
      pos.needsUpdate = true;
      sizeAttr!.needsUpdate = true;
      alphaAttr!.needsUpdate = true;
    };

    step(sparkPool.current, sparkPoints.current, false);
    step(debrisPool.current, debrisPoints.current, true);
  });

  return (
    <>
      <points ref={sparkPoints} frustumCulled={false}>
        <bufferGeometry />
        <shaderMaterial
          vertexShader={PARTICLE_VERTEX}
          fragmentShader={PARTICLE_FRAGMENT}
          uniforms={sparkUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <points ref={debrisPoints} frustumCulled={false}>
        <bufferGeometry />
        <shaderMaterial
          vertexShader={PARTICLE_VERTEX}
          fragmentShader={PARTICLE_FRAGMENT}
          uniforms={debrisUniforms}
          transparent
          depthWrite={false}
        />
      </points>
    </>
  );
}

type Mote = { x: number; y: number; z: number; vy: number; phase: number };

/**
 * Slow-drifting dust motes filling the shaft. They don't receive real lighting (they're unlit
 * point sprites), so brightness is faked by distance to the lantern's actual swinging position —
 * motes that happen to be near the light visibly catch it, which is what sells the volumetric
 * "light shining through dusty air" look.
 */
function DustMotes({ width, height, lanternPos, count }: { width: number; height: number; lanternPos: MutableRefObject<THREE.Vector3>; count: number }) {
  const points = useRef<THREE.Points>(null);
  const motes = useRef<Mote[]>([]);
  const uniforms = useMemo(() => ({ uColor: { value: new THREE.Color('#ffe3b0') } }), []);
  const safeCount = Math.max(Math.round(count), 0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const halfW = width / 2;
    const halfH = height / 2;
    if (motes.current.length !== safeCount) {
      motes.current = Array.from({ length: safeCount }, () => ({
        x: (Math.random() * 2 - 1) * halfW,
        y: (Math.random() * 2 - 1) * halfH,
        z: -height * 0.2 + Math.random() * height * 0.5,
        vy: height * (0.01 + Math.random() * 0.02),
        phase: Math.random() * Math.PI * 2,
      }));
    }
    const pts = points.current;
    if (!pts) return;
    const geo = pts.geometry;
    let pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
    let sizeAttr = geo.getAttribute('size') as THREE.BufferAttribute | undefined;
    let alphaAttr = geo.getAttribute('alpha') as THREE.BufferAttribute | undefined;
    if (!pos || pos.count !== safeCount) {
      pos = new THREE.BufferAttribute(new Float32Array(safeCount * 3), 3);
      sizeAttr = new THREE.BufferAttribute(new Float32Array(safeCount), 1);
      alphaAttr = new THREE.BufferAttribute(new Float32Array(safeCount), 1);
      geo.setAttribute('position', pos);
      geo.setAttribute('size', sizeAttr);
      geo.setAttribute('alpha', alphaAttr);
    }
    const lp = lanternPos.current;
    motes.current.forEach((m, i) => {
      m.phase += dt * 0.6;
      m.y += m.vy * dt;
      if (m.y > halfH + 5) { m.y = -halfH - 5; m.x = (Math.random() * 2 - 1) * halfW; }
      const x = m.x + Math.sin(m.phase) * height * 0.02;
      const dx = x - lp.x, dy = m.y - lp.y, dz = m.z - lp.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const glow = THREE.MathUtils.clamp(1 - dist / (height * 0.55), 0, 1);
      pos!.setXYZ(i, x, m.y, m.z);
      sizeAttr!.setX(i, height * 0.006 * (0.6 + glow * 1.8));
      alphaAttr!.setX(i, 0.05 + glow * 0.85);
    });
    pos.needsUpdate = true;
    sizeAttr!.needsUpdate = true;
    alphaAttr!.needsUpdate = true;
  });

  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry />
      <shaderMaterial
        vertexShader={PARTICLE_VERTEX}
        fragmentShader={PARTICLE_FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

const ROPE_SEGMENTS = 18;
type RopePoint = { x: number; y: number; px: number; py: number };

/**
 * The cursor lantern: a small metal cage with a glowing flame, hanging from a real simulated
 * chain (verlet-integrated points + distance constraints, not a rigid line) whose top link
 * follows the cursor instantly — that's "the hand" — while the rest sags and swings under gravity
 * like actual linked chain, settling into a pendulum instead of a rigid rod snapping to the mouse.
 */
function Lantern({ height, anchorPos, lanternPos, params }: { height: number; anchorPos: MutableRefObject<THREE.Vector3>; lanternPos: MutableRefObject<THREE.Vector3>; params: MineTuningParams }) {
  const groupRef = useRef<THREE.Group>(null);
  const segmentRefs = useRef<(THREE.Mesh | null)[]>([]);
  const ropeRef = useRef<RopePoint[] | null>(null);
  const followRef = useRef<{ x: number; y: number } | null>(null);
  const flameUniforms = useMemo(() => ({ uColor: { value: new THREE.Color('#ffcf6b') } }), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const segDir = useMemo(() => new THREE.Vector3(), []);
  const chainLength = height * params.chainLength;
  const segLength = chainLength / ROPE_SEGMENTS;

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.035);
    const target = anchorPos.current;
    if (!followRef.current) followRef.current = { x: target.x, y: target.y };
    const follow = followRef.current;
    const followAlpha = 1 - Math.exp(-params.chainFollowSpeed * dt);
    follow.x += (target.x - follow.x) * followAlpha;
    follow.y += (target.y - follow.y) * followAlpha;
    const a = { x: follow.x, y: follow.y, z: target.z };
    const topY = a.y;
    const hookY = topY - chainLength;
    if (!ropeRef.current || ropeRef.current.length !== ROPE_SEGMENTS + 1) {
      ropeRef.current = Array.from({ length: ROPE_SEGMENTS + 1 }, (_, i) => {
        const t = i / ROPE_SEGMENTS;
        const x = a.x + Math.sin(t * Math.PI) * chainLength * 0.2;
        const y = topY + (hookY - topY) * t;
        return { x, y, px: x, py: y };
      });
    }
    const points = ropeRef.current;
    const pin = () => {
      points[0].x = a.x; points[0].y = topY;
      points[0].px = a.x; points[0].py = topY;
    };
    for (let i = 1; i <= ROPE_SEGMENTS; i++) {
      const p = points[i];
      const vx = (p.x - p.px) * Math.pow(params.chainDamping, dt * 60);
      const vy = (p.y - p.py) * Math.pow(params.chainDamping, dt * 60);
      p.px = p.x; p.py = p.y;
      p.x += vx; p.y += vy - height * params.chainGravity * CHAIN_GRAVITY_SCALE * dt * dt;
    }
    // The cursor pins only the top link; gravity and constraints move the hanging lamp.
    for (let iter = 0; iter < Math.round(params.chainSolverIterations); iter++) {
      pin();
      for (let i = 0; i < ROPE_SEGMENTS; i++) {
        const p = points[i], q = points[i + 1];
        const dx = q.x - p.x, dy = q.y - p.y;
        const distance = Math.hypot(dx, dy) || 0.0001;
        const correction = ((distance - segLength) / distance) * params.chainStiffness;
        const wp = i === 0 ? 0 : 1, wq = 1;
        const pCorrectionX = dx * correction * wp / (wp + wq);
        const pCorrectionY = dy * correction * wp / (wp + wq);
        const qCorrectionX = dx * correction * wq / (wp + wq);
        const qCorrectionY = dy * correction * wq / (wp + wq);
        // Keep previous coordinates in step with the constraint correction. Without this, a
        // corrected position becomes phantom velocity on the next Verlet update and looks jelly-like.
        p.x += pCorrectionX; p.y += pCorrectionY;
        p.px += pCorrectionX; p.py += pCorrectionY;
        q.x -= qCorrectionX; q.y -= qCorrectionY;
        q.px -= qCorrectionX; q.py -= qCorrectionY;
      }
    }
    pin();
    const last = points[ROPE_SEGMENTS], previous = points[ROPE_SEGMENTS - 1];
    const tilt = Math.atan2(last.x - previous.x, previous.y - last.y);
    if (groupRef.current) {
      groupRef.current.position.set(last.x + Math.sin(tilt) * height * 0.0855, last.y - Math.cos(tilt) * height * 0.0855, a.z);
      groupRef.current.rotation.z = tilt;
    }
    lanternPos.current.set(last.x + Math.sin(tilt) * height * 0.063, last.y - Math.cos(tilt) * height * 0.063, a.z);
    for (let i = 0; i < ROPE_SEGMENTS; i++) {
      const mesh = segmentRefs.current[i];
      if (!mesh) continue;
      const p = points[i], q = points[i + 1];
      segDir.set(q.x - p.x, q.y - p.y, 0);
      mesh.position.set((p.x + q.x) / 2, (p.y + q.y) / 2, a.z);
      mesh.scale.set(1, segDir.length() / (height * 0.016), 1);
      mesh.quaternion.setFromUnitVectors(up, segDir.normalize());
      mesh.rotateY(i % 2 ? Math.PI / 2 : 0);
    }
  });

  const r = height * 0.045;
  const barCount = 5;
  const bars = useMemo(() => Array.from({ length: barCount }, (_, i) => (i / barCount) * Math.PI * 2), []);
  const linkRadius = height * 0.008;

  return (
    <>
      {Array.from({ length: ROPE_SEGMENTS }, (_, i) => (
        <mesh key={i} ref={(el) => { segmentRefs.current[i] = el; }}>
          <torusGeometry args={[linkRadius, height * 0.002, 6, 12]} />
          <meshStandardMaterial color={CHAIN_GOLD} roughness={0.3} metalness={0.85} />
        </mesh>
      ))}
      <group ref={groupRef}>
        {/* hook */}
        <mesh position={[0, r * 1.9, 0]}>
          <torusGeometry args={[r * 0.35, r * 0.09, 6, 10]} />
          <meshStandardMaterial color="#2c2c2c" roughness={0.5} metalness={0.6} />
        </mesh>
        {/* top cap */}
        <mesh position={[0, r * 1.5, 0]}>
          <cylinderGeometry args={[r * 0.75, r * 0.9, r * 0.35, 10]} />
          <meshStandardMaterial color="#2c2c2c" roughness={0.5} metalness={0.6} />
        </mesh>
        {/* cage bars around the flame */}
        {bars.map((a, i) => (
          <mesh key={i} position={[Math.cos(a) * r * 0.8, r * 0.5, Math.sin(a) * r * 0.8]}>
            <cylinderGeometry args={[r * 0.05, r * 0.05, r * 1.9, 6]} />
            <meshStandardMaterial color="#3a3a3a" roughness={0.5} metalness={0.5} />
          </mesh>
        ))}
        {/* base */}
        <mesh position={[0, -r * 0.45, 0]}>
          <cylinderGeometry args={[r * 0.85, r * 0.7, r * 0.35, 10]} />
          <meshStandardMaterial color="#2c2c2c" roughness={0.5} metalness={0.6} />
        </mesh>
        {/* flame — unlit so it always reads as a bright glowing dot regardless of scene light */}
        <mesh position={[0, r * 0.5, 0]}>
          <sphereGeometry args={[r * 0.32, 10, 8]} />
          <meshBasicMaterial color="#fff2c8" toneMapped={false} />
        </mesh>
        <points position={[0, r * 0.5, 0]} frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[new Float32Array([0, 0, 0]), 3]} />
            <bufferAttribute attach="attributes-size" args={[new Float32Array([r * 5]), 1]} />
            <bufferAttribute attach="attributes-alpha" args={[new Float32Array([0.55]), 1]} />
          </bufferGeometry>
          <shaderMaterial
            vertexShader={PARTICLE_VERTEX}
            fragmentShader={PARTICLE_FRAGMENT}
            uniforms={flameUniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      </group>
    </>
  );
}

/**
 * A miner working a gold seam, lit almost entirely by a warm lantern hanging on a chain from the
 * cursor — moving the mouse genuinely relights the scene from that side and swings the lantern
 * like a real pendulum, since this is a real point light in a 3D scene rather than a 2D glow sprite.
 */
export function MineEffect({
  width,
  height,
  pointerRef,
  params,
  cameraDistance,
}: {
  width: number;
  height: number;
  pointerRef: MutableRefObject<PointerState>;
  params: MineTuningParams;
  /** Distance from the perspective camera to the z=0 plane — `pointerRef` gives cursor coordinates
   * calibrated for that plane, so the lantern (which hangs at a different depth) needs this to
   * scale them back to correctly-aligned world coordinates. Without it the lantern visibly drifts
   * away from the actual cursor position the further it swings from screen center. */
  cameraDistance: number;
}) {
  const swingRef = useRef<THREE.Group | null>(null);
  const minerGroupRef = useRef<THREE.Group | null>(null);
  const lanternLightRef = useRef<THREE.PointLight>(null);
  const flashLightRef = useRef<THREE.PointLight>(null);
  const sparkApi = useRef<{ spawn: (x: number, y: number, z: number) => void } | null>(null);
  const timer = useRef(0.6);
  const phase = useRef(-1);
  const lanternLevel = useRef(0);
  const flashLevel = useRef(0);
  const recoilLevel = useRef(0);

  const lanternZ = height * 0.3;
  const sceneOffsetX = width * 0.2;
  // The point the top of the chain is pinned to ("the hand") — updated every frame from the
  // cursor, depth-corrected for lanternZ; the lantern's own position comes out of the rope
  // simulation inside <Lantern>, not from spring physics here anymore.
  const anchorPos = useRef(new THREE.Vector3(0, height * 0.25, lanternZ));
  const lanternPos = useRef(new THREE.Vector3(0, height * 0.15, lanternZ));

  // Miner now stands on the RIGHT, facing left toward the wall on the left — the whole rig is
  // built facing +X internally, so it's wrapped in a 180° turn here instead of re-deriving every
  // offset's sign for a mirrored pose.
  const minerHeight = height * params.minerScale;
  const minerBaseX = Math.min(width * 0.24, height * 0.42);
  const floorY = -height * 0.43;
  // Where the pickaxe head lands on the wall, in world space — matches the actual wall face
  // position so sparks land on the rock instead of floating in front of or behind it.
  const impact = useMemo(
    () => {
      const tip = PICK_TIP.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), PICK_CONTACT_ANGLE).add(PICK_SHOULDER).multiplyScalar(minerHeight);
      return { x: minerBaseX - tip.x, y: floorY + tip.y, z: -tip.z };
    },
    [minerBaseX, minerHeight, floorY],
  );
  const wallX = impact.x;

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const swing = swingRef.current;
    const cursor = pointerRef.current;

    // The cursor's (x, y) from pointerRef is calibrated for the z=0 plane of the perspective
    // camera; the chain's hand-anchor lives at z=lanternZ, which is closer to the camera, so it
    // maps to more screen pixels per world unit there. Scaling by this ratio keeps the anchor
    // under the actual cursor instead of trailing inward as it swings away from screen center.
    const depthScale = (cameraDistance - lanternZ) / cameraDistance;
    anchorPos.current.set(
      cursor.active ? cursor.x * depthScale - sceneOffsetX : 0,
      (cursor.active ? cursor.y : height * 0.25) * depthScale,
      lanternZ,
    );

    const lantern = lanternLightRef.current;
    if (lantern) {
      const target = cursor.active ? 1 : 0.25;
      lanternLevel.current = THREE.MathUtils.damp(lanternLevel.current, target, 6, dt);
      lantern.position.copy(lanternPos.current);
      lantern.intensity = params.lanternIntensity * lanternLevel.current;
      lantern.distance = params.lanternRange;
    }

    // Strike flash: a brief second light at the impact point, synced with the spark burst.
    if (flashLevel.current > 0) flashLevel.current = Math.max(0, flashLevel.current - dt / 0.16);
    const flash = flashLightRef.current;
    if (flash) {
      flash.position.set(impact.x, impact.y, impact.z + height * 0.05);
      flash.intensity = params.lanternIntensity * 0.9 * flashLevel.current;
      flash.distance = params.lanternRange * 0.5;
    }

    // Recoil: a quick backward kick on the whole body when the pick lands.
    if (recoilLevel.current > 0) recoilLevel.current = Math.max(0, recoilLevel.current - dt / 0.22);
    if (minerGroupRef.current) {
      minerGroupRef.current.position.set(minerBaseX + recoilLevel.current * minerHeight * 0.05, floorY, 0);
    }

    // Strike cycle: wind up, snap forward, recover.
    timer.current -= dt;
    if (timer.current <= 0) {
      timer.current = Math.max(0.4, params.strikeInterval);
      phase.current = 0;
    }
    if (phase.current >= 0) {
      const previousPhase = phase.current;
      phase.current += dt * (0.95 / Math.min(0.95, Math.max(0.4, params.strikeInterval)));
      const t = phase.current;
      if (previousPhase < 0.56 && t >= 0.56) {
        sparkApi.current?.spawn(impact.x, impact.y, impact.z);
        flashLevel.current = 1;
        recoilLevel.current = 1;
      }
      let angle: number;
      // Raise the tool above the helmet, then accelerate down toward the rock.
      if (t < 0.42) {
        const k = Math.min(t / 0.42, 1);
        angle = THREE.MathUtils.lerp(0.15, 2.4, k * k * (3 - 2 * k));
      } else if (t < 0.56) {
        const k = (t - 0.42) / 0.14;
        angle = THREE.MathUtils.lerp(2.4, PICK_CONTACT_ANGLE, k * k);
      } else if (t < 0.95) {
        angle = THREE.MathUtils.lerp(0.65, 0.15, (t - 0.56) / 0.39);
      } else {
        angle = 0.15;
        phase.current = -1;
      }
      if (swing) swing.rotation.z = angle;
    }
  });

  return (
    <group position={[sceneOffsetX, 0, 0]}>
      <ambientLight intensity={params.ambientLight} color="#cfc9bd" />
      <directionalLight position={[width * 0.3, height * 0.6, height * 0.5]} intensity={0.55} color="#b9cedf" />
      <pointLight ref={lanternLightRef} color="#ffce89" decay={2} castShadow shadow-mapSize={[512, 512]} shadow-bias={-0.0003} shadow-normalBias={height * 0.001} shadow-camera-near={1} shadow-camera-far={Math.max(params.lanternRange, height * 2)} />
      <pointLight ref={flashLightRef} color="#ffe3a0" decay={2} castShadow={false} />

      <MineWall width={width} height={height} wallX={wallX} />

      <group ref={minerGroupRef} position={[minerBaseX, floorY, 0]} rotation={[0, Math.PI, 0]}>
        <MineMiner height={minerHeight} swingRef={swingRef} />
      </group>

      <StrikeDebris sparkRef={sparkApi} params={params} height={height} />
      <DustMotes width={width} height={height} lanternPos={lanternPos} count={params.dustCount} />
      <Lantern height={height} anchorPos={anchorPos} lanternPos={lanternPos} params={params} />
    </group>
  );
}
