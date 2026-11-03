/**
 * Loads body motions made by tools/avatar/convert-mixamo.mjs and turns them into three.js clips for the normalized
 * bones of a VRM model. Quaternions come as Int16 (value * 32767), hips positions as Int16 (value / hips height * 8192).
 * Every model has its own set (the arms are fitted to its body), in the folder `base`. The motions face +Z (VRM 1.0);
 * VRM 0.0 models face -Z in their own space, so for them x and z are mirrored.
 */
import * as THREE from 'three';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';

export type MotionData = { name: string; duration: number; fps: number; frames: number; bones: Record<string, string>; hips: string | null };

const cache = new Map<string, Promise<MotionData>>();

export function loadMotion(base: string, file: string) {
  const url = `${base}${file}.json`;
  let data = cache.get(url);
  if (!data) {
    data = fetch(url).then(r => { if (!r.ok) throw new Error(`motion ${file}: ${r.status}`); return r.json() as Promise<MotionData>; });
    data.catch(() => cache.delete(url));
    cache.set(url, data);
  }
  return data;
}

function decode(packed: string, scale: number) {
  const bin = atob(packed);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return Float32Array.from(new Int16Array(bytes.buffer), v => v / scale);
}

/** hipsRest: the normalized hips bone's rest position; its height scales the motion to this model. */
export function buildMotionClip(data: MotionData, vrm: VRM, hipsRest: THREE.Vector3, name: string) {
  const times = Float32Array.from({ length: data.frames }, (_, i) => Math.min(data.duration, i / data.fps));
  const tracks: THREE.KeyframeTrack[] = [];
  const flip = vrm.meta.metaVersion === '0' ? -1 : 1;
  for (const [bone, packed] of Object.entries(data.bones)) {
    const node = vrm.humanoid.getNormalizedBoneNode(bone as VRMHumanBoneName);
    if (!node) continue;
    const values = decode(packed, 32767);
    for (let i = 0; i < values.length; i += 4) {
      const length = Math.hypot(values[i], values[i + 1], values[i + 2], values[i + 3]) || 1;
      for (let k = 0; k < 4; k++) values[i + k] /= length;
      values[i] *= flip; values[i + 2] *= flip;
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${node.name}.quaternion`, values.length === 4 ? [0] : Array.from(times), Array.from(values)));
  }
  const hips = vrm.humanoid.getNormalizedBoneNode('hips');
  if (data.hips && hips) {
    const values = decode(data.hips, 8192);
    for (let i = 0; i < values.length; i += 3) {
      values[i] = hipsRest.x + values[i] * hipsRest.y * flip;
      values[i + 1] = values[i + 1] * hipsRest.y;
      values[i + 2] = hipsRest.z + values[i + 2] * hipsRest.y * flip;
    }
    tracks.push(new THREE.VectorKeyframeTrack(`${hips.name}.position`, Array.from(times), Array.from(values)));
  }
  return new THREE.AnimationClip(name, data.duration, tracks);
}
