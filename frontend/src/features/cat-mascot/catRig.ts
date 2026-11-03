/**
 * Skeleton of the cat in its bind pose (standing, facing +X, ground at y = 0, left side at +Z).
 * Every bone has an identity bind rotation, so a child's offset from its parent is also the bind direction
 * of that segment; inverse kinematics (catPose.ts) relies on this.
 */
export type V3 = [number, number, number];
export type BoneDef = { name: string; parent: string | null; at: V3 };

export const TAIL_BONES = 9;
const FZ = 0.085;
const RZ = 0.09;

function legs(side: 'L' | 'R'): BoneDef[] {
  const s = side === 'L' ? 1 : -1;
  return [
    { name: `shoulder${side}`, parent: 'spine2', at: [0.15, 0.5, FZ * s] },
    { name: `elbow${side}`, parent: `shoulder${side}`, at: [0.135, 0.27, FZ * s] },
    { name: `wrist${side}`, parent: `elbow${side}`, at: [0.155, 0.085, FZ * s] },
    { name: `hand${side}`, parent: `wrist${side}`, at: [0.19, 0.033, FZ * s] },
    { name: `thigh${side}`, parent: 'hips', at: [-0.3, 0.45, RZ * s] },
    { name: `knee${side}`, parent: `thigh${side}`, at: [-0.2, 0.27, RZ * s] },
    { name: `hock${side}`, parent: `knee${side}`, at: [-0.33, 0.12, RZ * s] },
    { name: `foot${side}`, parent: `hock${side}`, at: [-0.28, 0.033, RZ * s] },
  ];
}

export const BONES: BoneDef[] = [
  { name: 'root', parent: null, at: [0, 0, 0] },
  { name: 'hips', parent: 'root', at: [-0.3, 0.5, 0] },
  { name: 'spine1', parent: 'hips', at: [-0.08, 0.515, 0] },
  { name: 'spine2', parent: 'spine1', at: [0.12, 0.525, 0] },
  { name: 'neck', parent: 'spine2', at: [0.235, 0.6, 0] },
  { name: 'head', parent: 'neck', at: [0.335, 0.74, 0] },
  { name: 'jaw', parent: 'head', at: [0.4, 0.7, 0] },
  { name: 'earL', parent: 'head', at: [0.33, 0.85, 0.08] },
  { name: 'earR', parent: 'head', at: [0.33, 0.85, -0.08] },
  ...legs('L'),
  ...legs('R'),
  ...Array.from({ length: TAIL_BONES }, (_, i): BoneDef => ({
    name: `tail${i}`, parent: i ? `tail${i - 1}` : 'hips', at: [-0.43 - i * 0.07, 0.53 + i * 0.012, 0],
  })),
];

export const BONE_INDEX: Record<string, number> = Object.fromEntries(BONES.map((bone, i) => [bone.name, i]));
export const boneAt = (name: string): V3 => BONES[BONE_INDEX[name]].at;
