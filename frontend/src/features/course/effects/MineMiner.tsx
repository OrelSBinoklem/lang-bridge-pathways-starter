'use client';

import { useMemo, type MutableRefObject } from 'react';
import * as THREE from 'three';

type Vec = [number, number, number];

function Oval({ at, size, color, metal = 0 }: { at: Vec; size: Vec; color: string; metal?: number }) {
  return <mesh position={at} scale={size} castShadow receiveShadow><sphereGeometry args={[1, 20, 14]} /><meshStandardMaterial color={color} roughness={metal ? 0.32 : 0.78} metalness={metal} /></mesh>;
}

function Limb({ from, to, radius, color }: { from: Vec; to: Vec; radius: number; color: string }) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const direction = b.clone().sub(a);
  return <mesh position={a.add(b).multiplyScalar(0.5)} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize())} castShadow><capsuleGeometry args={[radius, Math.max(0.001, direction.length() - radius * 2), 5, 14]} /><meshStandardMaterial color={color} roughness={0.8} /></mesh>;
}

// Normalized coordinates keep the grip and impact marker attached when the debug scale changes.
export const PICK_TIP = new THREE.Vector3(0.43, -0.60, 0);
export const PICK_SHOULDER = new THREE.Vector3(0.10, 0.58, 0.07);
export const PICK_CONTACT_ANGLE = 0.65;

export function MineMiner({ height, swingRef }: { height: number; swingRef: MutableRefObject<THREE.Group | null> }) {
  const pick = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.16, -0.04);
    shape.quadraticCurveTo(-0.09, 0.065, 0, 0.025);
    shape.quadraticCurveTo(0.095, 0.02, 0.13, 0);
    shape.quadraticCurveTo(0.04, -0.006, 0, -0.018);
    shape.quadraticCurveTo(-0.08, -0.012, -0.16, -0.04);
    return shape;
  }, []);
  return <group scale={height}>
    {[-1, 1].map(side => <group key={side}>
      <Limb from={[-side * 0.065, 0.32, side * 0.06]} to={[side * 0.085, 0.10, side * 0.07]} radius={0.055} color="#425b62" />
      <Oval at={[side * 0.085 + 0.035, 0.055, side * 0.07]} size={[0.091, 0.05, 0.064]} color="#382d28" />
      <Oval at={[side * 0.085 + 0.035, 0.023, side * 0.07]} size={[0.093, 0.018, 0.067]} color="#171d22" />
      {[0, 1, 2].map(i => <Limb key={i} from={[side * 0.085 + 0.05, 0.079 + i * 0.005, side * 0.07 - 0.026]} to={[side * 0.085 + 0.03, 0.079 + i * 0.005, side * 0.07 + 0.026]} radius={0.004} color="#b7a182" />)}
    </group>)}
    <Oval at={[0.02, 0.44, 0]} size={[0.125, 0.19, 0.10]} color="#597b83" />
    <Oval at={[0.025, 0.35, 0]} size={[0.121, 0.045, 0.106]} color="#503d2e" />
    <Oval at={[0.105, 0.35, -0.074]} size={[0.021, 0.025, 0.008]} color="#c8a153" metal={0.7} />
    {[-1, 1].map(side => <group key={side}>
      <Limb from={[0.04, 0.59, side * 0.08]} to={[0.11, 0.38, side * 0.07]} radius={0.016} color="#a57542" />
      <Oval at={[0.112, 0.40, side * 0.068]} size={[0.012, 0.012, 0.012]} color="#dec076" metal={0.65} />
    </group>)}
    <Oval at={[-0.09, 0.38, -0.09]} size={[0.047, 0.067, 0.03]} color="#866044" />
    <Limb from={[0.045, 0.59, 0]} to={[0.055, 0.69, 0]} radius={0.05} color="#d39a70" />
    <Oval at={[0.06, 0.73, 0]} size={[0.125, 0.137, 0.116]} color="#e4b38b" />
    <Oval at={[0.12, 0.665, 0]} size={[0.091, 0.077, 0.097]} color="#655045" />
    <Oval at={[0.183, 0.727, 0]} size={[0.037, 0.031, 0.045]} color="#e3a77f" />
    {[-1, 1].map(side => <group key={side}>
      <Oval at={[0.03, 0.73, side * 0.11]} size={[0.03, 0.042, 0.022]} color="#d39a70" />
      <Oval at={[0.157, 0.761, side * 0.055]} size={[0.026, 0.022, 0.023]} color="#ffefd6" />
      <Oval at={[0.176, 0.76, side * 0.058]} size={[0.009, 0.013, 0.013]} color="#202c30" />
      <Limb from={[0.15, 0.79, side * 0.035]} to={[0.153, 0.787, side * 0.08]} radius={0.008} color="#554138" />
      <Oval at={[0.176, 0.684, side * 0.025]} size={[0.025, 0.016, 0.04]} color="#786054" />
    </group>)}
    <mesh position={[0.055, 0.801, 0]} castShadow><sphereGeometry args={[0.148, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#e4ae3f" roughness={0.38} metalness={0.25} /></mesh>
    <Oval at={[0.075, 0.8, 0]} size={[0.171, 0.016, 0.156]} color="#c8902c" metal={0.3} />
    <Limb from={[-0.055, 0.887, 0]} to={[0.12, 0.923, 0]} radius={0.013} color="#f6cb66" />
    <Oval at={[0.184, 0.846, 0]} size={[0.023, 0.04, 0.039]} color="#39464b" metal={0.6} />
    <Oval at={[0.204, 0.846, 0]} size={[0.008, 0.026, 0.027]} color="#ffdf92" metal={0.1} />
    <group ref={swingRef} position={PICK_SHOULDER}>
      {[-0.13, 0].map(z => <group key={z}>
        <Limb from={[0, 0, z]} to={[0.005, -0.16, z]} radius={0.05} color="#597b83" />
        <Limb from={[0.005, -0.16, z]} to={[0.125, -0.33, -0.01]} radius={0.042} color="#dba578" />
        <Oval at={[0.125, -0.33 + z * 0.4, -0.01]} size={[0.05, 0.056, 0.05]} color="#b38c58" />
      </group>)}
      <Limb from={[0.05, -0.24, 0]} to={[0.30, -0.60, 0]} radius={0.016} color="#9a6e40" />
      {[0, 1, 2, 3].map(i => <mesh key={i} position={[0.14 + i * 0.012, -0.37 - i * 0.017, 0]} rotation={[0, 0, 0.61]}><torusGeometry args={[0.018, 0.004, 6, 12]} /><meshStandardMaterial color="#573f30" /></mesh>)}
      <mesh position={[0.30, -0.60, -0.017]} castShadow><extrudeGeometry args={[pick, { depth: 0.034, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.004, bevelThickness: 0.004 }]} /><meshStandardMaterial color="#9daeb0" metalness={0.85} roughness={0.28} /></mesh>
    </group>
  </group>;
}
