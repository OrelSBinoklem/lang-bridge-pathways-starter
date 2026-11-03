import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { T, type Tick } from './world';

/** Animation/raycast boundaries must keep their object identity and local transforms. */
export function carnivalMotion<TObject extends T.Object3D>(object: TObject): TObject {
  object.userData.carnivalMotion = true;
  return object;
}

/** Batch only rigid opaque parts, in the coordinate system of their nearest moving assembly.
 * No decimation, resolution changes, transparent reordering or merging across animated pivots.
 */
export function optimizeCarnival(root: T.Object3D) {
  root.updateMatrixWorld(true);
  const geometryBefore = new Set<T.BufferGeometry>(), materialsBefore = new Set<T.Material>();
  const materials = new Map<string, T.Material>();
  const buckets = new Map<T.Object3D, Map<string, T.Mesh[]>>();
  root.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    geometryBefore.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materialsBefore.add(material);
  });
  const visit = (object: T.Object3D, owner: T.Object3D) => {
    const moving = object === root || !!object.userData.carnivalMotion || !!object.name;
    const boundary = moving ? object : owner;
    if (object instanceof T.Mesh && !(object instanceof T.InstancedMesh) && !moving && !Array.isArray(object.material)
      && !object.material.transparent && object.material instanceof T.MeshStandardMaterial
      && !object.material.userData.carnivalMotion && object.visible && !Object.keys(object.geometry.morphAttributes).length) {
      // Identical paint/skin/metal can share a material; animated light materials are excluded.
      const signature = JSON.stringify({ ...object.material.toJSON(), uuid: undefined, metadata: undefined });
      const material = materials.get(signature) ?? object.material;
      materials.set(signature, material); object.material = material;
      const geometry = object.geometry;
      const attributes = Object.keys(geometry.attributes).sort().map(key => {
        const a = geometry.attributes[key];
        return `${key}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`;
      }).join('|');
      const key = `${material.uuid}|${!!geometry.index}|${attributes}|${object.castShadow}|${object.receiveShadow}|${object.renderOrder}|${object.layers.mask}`;
      const lists = buckets.get(owner) ?? new Map<string, T.Mesh[]>();
      const meshes = lists.get(key) ?? []; meshes.push(object); lists.set(key, meshes); buckets.set(owner, lists);
    }
    for (const child of [...object.children]) visit(child, boundary);
    if (!moving) { object.updateMatrix(); object.matrixAutoUpdate = false; }
  };
  visit(root, root);
  for (const [owner, lists] of buckets) {
    const inverse = owner.matrixWorld.clone().invert();
    for (const meshes of lists.values()) {
      if (meshes.length < 2) continue;
      const parts = meshes.map(mesh => mesh.geometry.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)));
      const geometry = mergeGeometries(parts, false);
      parts.forEach(part => part.dispose());
      if (!geometry) throw new Error('Carnival static geometry could not be merged');
      geometry.computeBoundingSphere(); geometry.computeBoundingBox();
      const first = meshes[0], mesh = new T.Mesh(geometry, first.material);
      mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow;
      mesh.renderOrder = first.renderOrder; mesh.layers.mask = first.layers.mask;
      mesh.updateMatrix(); mesh.matrixAutoUpdate = false;
      mesh.userData.carnivalBatch = meshes.length; owner.add(mesh);
      for (const original of meshes) {
        // Keep any protected descendants, including their original world transforms.
        for (const child of [...original.children]) owner.attach(child);
        original.removeFromParent();
      }
    }
  }
  const usedGeometry = new Set<T.BufferGeometry>(), usedMaterials = new Set<T.Material>();
  root.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    usedGeometry.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) usedMaterials.add(material);
  });
  geometryBefore.forEach(geometry => { if (!usedGeometry.has(geometry)) geometry.dispose(); });
  materialsBefore.forEach(material => { if (!usedMaterials.has(material)) material.dispose(); });
}

/** The same cabin/airframe parts recur under different animated pivots. Keep those pivots and
 * raycast objects, but render identical opaque parts as instances, including in the shadow pass.
 */
export function instanceCarnival(root: T.Object3D, ticks: Tick[]) {
  const buckets = new Map<string, T.Mesh[]>();
  const hashGeometry = (geometry: T.BufferGeometry) => {
    let hash = 2166136261;
    const add = (value: number) => { hash = Math.imul(hash ^ value, 16777619); };
    const layout: string[] = [];
    for (const key of Object.keys(geometry.attributes).sort()) {
      const attr = geometry.attributes[key]; layout.push(`${key}:${attr.itemSize}:${attr.count}`);
      for (const value of attr.array) add(Math.round(value * 1e6));
    }
    if (geometry.index) for (const value of geometry.index.array) add(value);
    return `${layout.join('|')}:${geometry.index?.count ?? 0}:${hash >>> 0}`;
  };
  const equivalent = (a: T.BufferGeometry, b: T.BufferGeometry) => {
    if (!!a.index !== !!b.index || a.index?.count !== b.index?.count) return false;
    if (a.index && b.index) for (let i = 0; i < a.index.count; i++) if (a.index.array[i] !== b.index.array[i]) return false;
    const keys = Object.keys(a.attributes).sort(), otherKeys = Object.keys(b.attributes).sort();
    if (keys.join('|') !== otherKeys.join('|')) return false;
    for (const key of keys) {
      const x = a.attributes[key], y = b.attributes[key];
      if (x.itemSize !== y.itemSize || x.normalized !== y.normalized || x.array.length !== y.array.length) return false;
      for (let i = 0; i < x.array.length; i++) if (Math.abs(x.array[i] - y.array[i]) > 1e-6) return false;
    }
    return true;
  };
  root.traverseVisible(object => {
    if (!(object instanceof T.Mesh) || object instanceof T.InstancedMesh || object.name || object.children.length
      || object.userData.carnivalMotion || Array.isArray(object.material) || object.material.transparent
      || object.material.userData.carnivalMotion || !(object.material instanceof T.MeshStandardMaterial)) return;
    const key = `${object.material.uuid}|${hashGeometry(object.geometry)}|${object.castShadow}|${object.receiveShadow}|${object.layers.mask}|${object.renderOrder}`;
    const list = buckets.get(key) ?? []; list.push(object); buckets.set(key, list);
  });
  const linked: { batch: T.InstancedMesh; sources: T.Mesh[] }[] = [];
  const displaced = new Set<T.BufferGeometry>();
  for (const list of buckets.values()) {
    if (list.length < 2 || !list.every(mesh => equivalent(list[0].geometry, mesh.geometry))) continue;
    const first = list[0];
    const batch = new T.InstancedMesh(first.geometry, first.material, list.length);
    batch.castShadow = first.castShadow; batch.receiveShadow = first.receiveShadow;
    batch.renderOrder = first.renderOrder; batch.layers.mask = first.layers.mask;
    batch.frustumCulled = false; batch.matrixAutoUpdate = false;
    batch.instanceMatrix.setUsage(T.DynamicDrawUsage);
    batch.userData.carnivalLinked = list.length;
    for (const [index, source] of list.entries()) {
      source.visible = false;
      source.userData.carnivalInstance = { batch: batch.uuid, index };
      if (source.geometry !== first.geometry) { displaced.add(source.geometry); source.geometry = first.geometry; }
    }
    root.add(batch); linked.push({ batch, sources: list });
  }
  const used = new Set<T.BufferGeometry>();
  root.traverse(object => { if (object instanceof T.Mesh) used.add(object.geometry); });
  displaced.forEach(geometry => { if (!used.has(geometry)) geometry.dispose(); });
  const inverse = new T.Matrix4(), matrix = new T.Matrix4();
  const sync = () => {
    // Once before both shadow and colour passes; never one update per draw call.
    root.updateMatrixWorld(true); inverse.copy(root.matrixWorld).invert();
    for (const { batch, sources } of linked) {
      sources.forEach((source, index) => {
        let visible = true;
        for (let parent = source.parent; parent && parent !== root; parent = parent.parent) if (!parent.visible) { visible = false; break; }
        if (visible) matrix.multiplyMatrices(inverse, source.matrixWorld);
        else matrix.makeScale(0, 0, 0);
        batch.setMatrixAt(index, matrix);
      });
      batch.instanceMatrix.needsUpdate = true;
    }
  };
  sync();
  if (linked.length) ticks.push(sync);
  return linked.length;
}

/** Same chase formula and HDR colours, evaluated per lamp on the GPU instead of uploading
 * hundreds of instance colours from JavaScript on every frame.
 */
export function carnivalLampShader(material: T.MeshBasicMaterial, count: number, colors: string[], offset: number) {
  const time = { value: 0 }, events = { value: 1 };
  const index = Float32Array.from({ length: count }, (_, i) => i);
  material.onBeforeCompile = shader => {
    shader.uniforms.carnivalTime = time; shader.uniforms.carnivalEvents = events;
    shader.vertexShader = `uniform float carnivalTime; uniform float carnivalEvents; attribute float carnivalLampIndex;\n${shader.vertexShader}`
      .replace('#include <color_vertex>', `#include <color_vertex>
        float chase = carnivalEvents > 0.5 ? 1.6 + 2.4 * pow(max(0.0, sin(carnivalLampIndex * 0.21 - carnivalTime * 2.0 + ${offset.toFixed(8)})), 4.0) : 2.0;
        vColor.xyz *= chase;`);
  };
  material.customProgramCacheKey = () => `carnival-lamps:${offset}`;
  return { time, events, index: new T.InstancedBufferAttribute(index, 1), palette: colors.map(color => new T.Color(color)) };
}
