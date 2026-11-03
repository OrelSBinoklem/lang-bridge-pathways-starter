'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';

export type CircuitTuningParams = { pulseCount: number; pulseSpeedMin: number; pulseSpeedMax: number };
export function createCircuitParams(): CircuitTuningParams {
  return { pulseCount: 10, pulseSpeedMin: 0.25, pulseSpeedMax: 0.6 };
}

export type SparkleTuningParams = { count: number; size: number; speed: number };
export function createSparkleParams(): SparkleTuningParams {
  return { count: 55, size: 3.2, speed: 0.35 };
}

export type PulseRingsTuningParams = { speed: number; ringCount: number; radiusScale: number };
export function createPulseRingsParams(): PulseRingsTuningParams {
  return { speed: 0.28, ringCount: 3, radiusScale: 1 };
}

export type OrbitDotsTuningParams = { dotCount: number; speedScale: number; radiusScale: number };
export function createOrbitDotsParams(): OrbitDotsTuningParams {
  return { dotCount: 5, speedScale: 1, radiusScale: 1 };
}

type Segment = { ax: number; ay: number; bx: number; by: number };

function buildGrid(width: number, height: number): Segment[] {
  const w = Math.max(width, 1);
  const h = Math.max(height, 1);
  const cols = 5;
  const rows = 3;
  const stepX = w / cols;
  const stepY = h / rows;
  const segments: Segment[] = [];
  for (let r = 0; r <= rows; r++) {
    segments.push({ ax: -w / 2, ay: -h / 2 + r * stepY, bx: w / 2, by: -h / 2 + r * stepY });
  }
  for (let c = 0; c <= cols; c++) {
    segments.push({ ax: -w / 2 + c * stepX, ay: -h / 2, bx: -w / 2 + c * stepX, by: h / 2 });
  }
  return segments;
}

/** Bespoke effect for "systematic" groups: pulses of light travelling along a faint circuit grid. */
export function CircuitSparkEffect({ width, height, pulseColor = '#6ff0ff', lineColor = '#2c5a63', params }: { width: number; height: number; pulseColor?: string; lineColor?: string; params: CircuitTuningParams }) {
  const segments = useMemo(() => buildGrid(width, height), [width, height]);
  const lineGeometry = useMemo(() => {
    const points: number[] = [];
    segments.forEach((s) => points.push(s.ax, s.ay, 0, s.bx, s.by, 0));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    return geo;
  }, [segments]);

  const pulseCount = Math.max(Math.round(params.pulseCount), 1);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geometry = useMemo(() => new THREE.PlaneGeometry(4, 4), []);
  const color = useMemo(() => new THREE.Color(pulseColor), [pulseColor]);
  type Pulse = { seg: Segment; t: number; speed: number };
  const pulsesRef = useRef<{ key: string; segs: Segment[]; pulses: Pulse[] } | null>(null);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const key = `${pulseCount}`;
    if (!pulsesRef.current || pulsesRef.current.key !== key || pulsesRef.current.segs !== segments) {
      pulsesRef.current = {
        key,
        segs: segments,
        pulses: Array.from({ length: pulseCount }, () => ({
          seg: segments[Math.floor(Math.random() * segments.length)],
          t: Math.random(),
          speed: params.pulseSpeedMin + Math.random() * Math.max(params.pulseSpeedMax - params.pulseSpeedMin, 0),
        })),
      };
    }
    const pulses = pulsesRef.current.pulses;
    pulses.forEach((p, i) => {
      p.t += p.speed * delta;
      if (p.t >= 1) {
        p.t = 0;
        p.seg = segments[Math.floor(Math.random() * segments.length)];
        p.speed = params.pulseSpeedMin + Math.random() * Math.max(params.pulseSpeedMax - params.pulseSpeedMin, 0);
      }
      const x = THREE.MathUtils.lerp(p.seg.ax, p.seg.bx, p.t);
      const y = THREE.MathUtils.lerp(p.seg.ay, p.seg.by, p.t);
      dummy.position.set(x, y, 1);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <>
      <lineSegments geometry={lineGeometry}>
        <lineBasicMaterial color={lineColor} transparent opacity={0.35} />
      </lineSegments>
      <instancedMesh key={pulseCount} ref={meshRef} args={[geometry, undefined, pulseCount]} frustumCulled={false}>
        <meshBasicMaterial color="#eafcff" transparent opacity={0.9} depthWrite={false} />
      </instancedMesh>
    </>
  );
}

/** Twinkling glow field, no ring — reused across several "mood" groups with different colors. */
export function SparkleFieldEffect({ width, height, color = '#ffd27a', params }: { width: number; height: number; color?: string; params: SparkleTuningParams }) {
  return (
    <Sparkles
      key={Math.round(params.count)}
      count={Math.max(Math.round(params.count), 1)}
      scale={[Math.max(width * 0.85, 10), Math.max(height * 0.85, 10), 20]}
      size={params.size}
      speed={params.speed}
      color={color}
      opacity={0.9}
    />
  );
}

/** Concentric rings expanding from the center and fading — a slow "heartbeat"/sonar pulse. */
export function PulseRingsEffect({ width, height, color = '#e78fb0', params }: { width: number; height: number; color?: string; params: PulseRingsTuningParams }) {
  const ringCount = Math.max(Math.round(params.ringCount), 1);
  const groupRef = useRef<THREE.Group>(null);
  const ringsRef = useRef<THREE.Mesh[]>([]);
  const maxRadius = Math.max(Math.min(width, height) * 0.42, 6) * params.radiusScale;

  useFrame((_, delta) => {
    ringsRef.current.forEach((mesh, i) => {
      if (!mesh) return;
      const phase = (mesh.userData.phase as number) + delta * params.speed;
      mesh.userData.phase = phase % 1;
      const t = (phase + i / ringCount) % 1;
      const scale = 0.15 + t * 1.2;
      mesh.scale.setScalar(scale);
      (mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.6;
    });
  });

  return (
    <group ref={groupRef} key={ringCount}>
      {Array.from({ length: ringCount }, (_, i) => (
        <mesh key={i} ref={(el) => { if (el) { el.userData.phase = i / ringCount; ringsRef.current[i] = el; } }} position={[0, 0, 1]}>
          <ringGeometry args={[maxRadius * 0.82, maxRadius, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

/** A handful of dots orbiting the center at different radii/speeds — "world"/"connection" feel. */
export function OrbitDotsEffect({ width, height, color = '#7fa8e0', params }: { width: number; height: number; color?: string; params: OrbitDotsTuningParams }) {
  const dotCount = Math.max(Math.round(params.dotCount), 1);
  const maxRadius = Math.max(Math.min(width, height) * 0.4, 6) * params.radiusScale;
  const dots = useMemo(
    () =>
      Array.from({ length: dotCount }, (_, i) => ({
        radius: maxRadius * (0.35 + (i / dotCount) * 0.65),
        speed: 0.12 + (i % 3) * 0.08,
        phase: (i / dotCount) * Math.PI * 2,
        size: 3 + (i % 3) * 1.5,
      })),
    [maxRadius, dotCount],
  );
  const dotRefs = useRef<THREE.Mesh[]>([]);

  useFrame((_, delta) => {
    dots.forEach((dot, i) => {
      dot.phase += dot.speed * params.speedScale * delta;
      const mesh = dotRefs.current[i];
      if (!mesh) return;
      mesh.position.set(Math.cos(dot.phase) * dot.radius, Math.sin(dot.phase) * dot.radius * 0.6, 1);
    });
  });

  return (
    <>
      {dots.map((dot, i) => (
        <mesh key={i} ref={(el) => { if (el) dotRefs.current[i] = el; }}>
          <circleGeometry args={[dot.size, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.85} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}
