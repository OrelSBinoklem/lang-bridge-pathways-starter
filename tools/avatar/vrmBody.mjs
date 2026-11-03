// Reads what the motion baker needs from a VRM file (GLB) without a browser: the normalized humanoid rig
// (rest positions, humanoid parents) and the outline of the bare body (skin only, clothes may give way) as an
// ellipse per height slice. VRM 0.0 models face -Z; their positions are turned half round so everything here faces
// +Z like VRM 1.0 (the motions are made for +Z, the player mirrors them back for VRM 0.0).
import { readFileSync } from 'node:fs';

export const SLICE_STEP = 0.03;
/** Clothes stand off the body by about this much (m). */
const INSET = 0.015;
/** A skin edge further than this (m) in front of or behind the clothes over it was cut away. */
const GAP = 0.035;

export function readVrmBody(path, THREE) {
  const glb = readFileSync(path);
  const jsonLen = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString());
  const binStart = 20 + jsonLen + 8;
  const bin = glb.subarray(binStart, binStart + glb.readUInt32LE(20 + jsonLen));

  // World matrices of all nodes in the file's rest pose.
  const parentOf = new Map();
  json.nodes.forEach((n, i) => (n.children ?? []).forEach(c => parentOf.set(c, i)));
  const local = json.nodes.map(n => n.matrix ? new THREE.Matrix4().fromArray(n.matrix) : new THREE.Matrix4().compose(
    new THREE.Vector3(...(n.translation ?? [0, 0, 0])), new THREE.Quaternion(...(n.rotation ?? [0, 0, 0, 1])), new THREE.Vector3(...(n.scale ?? [1, 1, 1]))));
  const vrm0 = !json.extensions.VRMC_vrm;
  const facing = vrm0 ? new THREE.Matrix4().makeRotationY(Math.PI) : new THREE.Matrix4();
  const world = [];
  const worldOf = i => world[i] ??= parentOf.has(i) ? worldOf(parentOf.get(i)).clone().multiply(local[i]) : facing.clone().multiply(local[i]);
  json.nodes.forEach((_, i) => worldOf(i));

  // Normalized rig: identity rest rotations, each bone at its rest world position, parent = nearest humanoid ancestor.
  const humanBones = vrm0
    ? Object.fromEntries(json.extensions.VRM.humanoid.humanBones.map(b => [b.bone, { node: b.node }]))
    : json.extensions.VRMC_vrm.humanoid.humanBones;
  const boneOfNode = new Map(Object.entries(humanBones).map(([name, b]) => [b.node, name]));
  const bones = {};
  for (const [name, { node }] of Object.entries(humanBones)) {
    let p = parentOf.get(node);
    while (p != null && !boneOfNode.has(p)) p = parentOf.get(p);
    bones[name] = { rest: new THREE.Vector3().setFromMatrixPosition(world[node]), parent: p == null ? null : boneOfNode.get(p) };
  }

  // Body outline: skin vertices (VRoid body material "…Body_00_SKIN") between 0.5 m and just below the armpits.
  // VRoid removes skin hidden under clothes, so where little skin is left (the back, the chest) the outline comes
  // from the clothes over it, drawn in by INSET.
  const armpit = bones.leftUpperArm.rest.y - 0.14;
  const reach = Math.abs(bones.leftUpperArm.rest.x) + 0.12;
  const y0 = 0.5, count = Math.ceil((armpit - y0) / SLICE_STEP);
  const empty = () => ({ minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
  const boxes = { skin: Array.from({ length: count }, empty), cloth: Array.from({ length: count }, empty) };
  const v = new THREE.Vector3();
  json.nodes.forEach((n, i) => {
    if (n.mesh == null) return;
    const mesh = json.meshes[n.mesh];
    if (/face|hair/i.test(mesh.name ?? n.name ?? '')) return;
    for (const prim of mesh.primitives) {
      const material = json.materials[prim.material]?.name ?? '';
      const box = /body.*skin/i.test(material) ? boxes.skin : /Tops|Bottoms|Onepiece/.test(material) ? boxes.cloth : null;
      if (!box) continue;
      const acc = json.accessors[prim.attributes.POSITION];
      const view = json.bufferViews[acc.bufferView];
      const stride = view.byteStride ?? 12, base = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
      // Primitives share one vertex buffer; only a material's own triangles say which vertices are its.
      for (const k of usedVertices(json, bin, prim)) {
        const o = base + k * stride;
        // Skinned vertices are already in the bind (world) space.
        v.set(bin.readFloatLE(o), bin.readFloatLE(o + 4), bin.readFloatLE(o + 8));
        if (vrm0) v.set(-v.x, v.y, -v.z);
        const s = Math.floor((v.y - y0) / SLICE_STEP);
        if (s < 0 || s >= count || Math.abs(v.x) > reach) continue;
        const b = box[s];
        b.minX = Math.min(b.minX, v.x); b.maxX = Math.max(b.maxX, v.x);
        b.minZ = Math.min(b.minZ, v.z); b.maxZ = Math.max(b.maxZ, v.z);
      }
    }
  });
  // The body is symmetric: width as the larger half (a cut on one side does not narrow it); front and back apart.
  const half = b => Math.max(-b.minX, b.maxX);
  const slices = boxes.skin.map((skin, s) => {
    const cloth = boxes.cloth[s], hasSkin = skin.minX !== Infinity, hasCloth = cloth.minX !== Infinity;
    if (!hasSkin && !hasCloth) return null;
    if (!hasSkin) return { cx: 0, cz: (cloth.minZ + cloth.maxZ) / 2, rx: half(cloth) - INSET, rz: (cloth.maxZ - cloth.minZ) / 2 - INSET };
    // A skin edge far inside the clothes over it is where the skin was cut away (the back, the chest). The width
    // stays the skin's: at the sides loose clothes stand far off, and the arms hang right next to the body.
    const rx = half(skin);
    let minZ = skin.minZ, maxZ = skin.maxZ;
    if (hasCloth) {
      if (cloth.minZ < minZ - GAP) minZ = cloth.minZ + INSET;
      if (cloth.maxZ > maxZ + GAP) maxZ = cloth.maxZ - INSET;
    }
    return { cx: 0, cz: (minZ + maxZ) / 2, rx, rz: (maxZ - minZ) / 2 };
  });
  // Too few vertices in a slice (a coarse skirt) leave it empty or flat: take its neighbours' outline instead.
  const ok = s => s && s.rx > 0.06 && s.rz > 0.03;
  for (let i = 0; i < slices.length; i++) {
    if (ok(slices[i])) continue;
    let a = i - 1, b = i + 1;
    while (a >= 0 && !ok(slices[a])) a--;
    while (b < slices.length && !ok(slices[b])) b++;
    const near = [slices[a], slices[b]].filter(ok);
    slices[i] = near.length ? Object.fromEntries(['cx', 'cz', 'rx', 'rz'].map(k => [k, near.reduce((sum, s) => sum + s[k], 0) / near.length])) : null;
  }
  return { bones, slices, y0, hipsRest: bones.hips.rest.clone() };
}

function usedVertices(json, bin, prim) {
  const acc = json.accessors[prim.indices], view = json.bufferViews[acc.bufferView];
  const size = { 5121: 1, 5123: 2, 5125: 4 }[acc.componentType];
  const read = { 1: o => bin.readUInt8(o), 2: o => bin.readUInt16LE(o), 4: o => bin.readUInt32LE(o) }[size];
  const base = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0), used = new Set();
  for (let i = 0; i < acc.count; i++) used.add(read(base + i * size));
  return used;
}
