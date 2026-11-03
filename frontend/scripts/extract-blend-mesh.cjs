#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- a standalone Node script */
/**
 * Reads meshes straight out of a Blender .blend file (the 2.6x format: SDNA-described file blocks), without Blender.
 *
 *   node scripts/extract-blend-mesh.cjs <file.blend>            lists objects, meshes, materials, modifiers
 *   node scripts/extract-blend-mesh.cjs <file.blend> <out.json>  also writes every mesh object as JSON:
 *     { objects: [{ name, mesh, matrix[16] (column-major, object → world), materials: [names],
 *                   positions: [x,y,z,...], polys: [[matIndex, v0, v1, ...], ...], smooth: [0|1 per poly],
 *                   subsurf: levels }] , materials: { name: { color: [r,g,b], alpha, emit, specular } } }
 *
 * Only what a mesh needs is decoded: Object (name, obmat, data, mat, modifiers), Mesh (mvert, mpoly, mloop, mat),
 * Material (colour, alpha, emit) and SubsurfModifierData (levels). Pointers are resolved through the file blocks'
 * old addresses.
 */
const fs = require('node:fs');

const file = process.argv[2];
const out = process.argv[3];
const buf = fs.readFileSync(file);
if (buf.toString('latin1', 0, 7) !== 'BLENDER') throw new Error('not a .blend file (compressed files must be gunzipped first)');
const ptrSize = buf[7] === 0x5f ? 4 : 8;
const little = buf[8] === 0x76;
const version = buf.toString('latin1', 9, 12);

const u32 = (o) => (little ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
const i32 = (o) => (little ? buf.readInt32LE(o) : buf.readInt32BE(o));
const i16 = (o) => (little ? buf.readInt16LE(o) : buf.readInt16BE(o));
const f32 = (o) => (little ? buf.readFloatLE(o) : buf.readFloatBE(o));
const ptr = (o) => (ptrSize === 4 ? u32(o) : Number(little ? buf.readBigUInt64LE(o) : buf.readBigUInt64BE(o)));

// --- file blocks ---------------------------------------------------------------------------------------------------
const blocks = [];
let at = 12;
for (;;) {
  const code = buf.toString('latin1', at, at + 4).replace(/\0/g, '');
  const size = i32(at + 4);
  const old = ptr(at + 8);
  const sdna = i32(at + 8 + ptrSize);
  const count = i32(at + 12 + ptrSize);
  const data = at + 16 + ptrSize;
  blocks.push({ code, size, old, sdna, count, data });
  at = data + size;
  if (code === 'ENDB' || at >= buf.length) break;
}
const byOld = new Map(blocks.map((b) => [b.old, b]));

// --- SDNA ----------------------------------------------------------------------------------------------------------
const dna = blocks.find((b) => b.code === 'DNA1');
let p = dna.data;
const tag = (t) => {
  if (buf.toString('latin1', p, p + 4) !== t) throw new Error(`SDNA: expected ${t}`);
  p += 4;
};
const align = () => {
  p = (p + 3) & ~3;
};
tag('SDNA');
tag('NAME');
const names = [];
for (let n = i32(p), k = (p += 4, 0); k < n; k += 1) {
  const end = buf.indexOf(0, p);
  names.push(buf.toString('latin1', p, end));
  p = end + 1;
}
align();
tag('TYPE');
const types = [];
for (let n = i32(p), k = (p += 4, 0); k < n; k += 1) {
  const end = buf.indexOf(0, p);
  types.push(buf.toString('latin1', p, end));
  p = end + 1;
}
align();
tag('TLEN');
const tlen = types.map((_, k) => i16(p + k * 2));
p += types.length * 2;
align();
tag('STRC');
const structs = [];
const structByType = new Map();
for (let n = i32(p), k = (p += 4, 0); k < n; k += 1) {
  const type = i16(p);
  const nf = i16(p + 2);
  p += 4;
  const fields = [];
  let off = 0;
  for (let f = 0; f < nf; f += 1) {
    const ft = i16(p);
    const fn = names[i16(p + 2)];
    p += 4;
    // Field size: pointers are pointer sized, arrays multiply.
    const isPtr = fn.startsWith('*') || fn.startsWith('(*');
    let mult = 1;
    for (const m of fn.matchAll(/\[(\d+)\]/g)) mult *= Number(m[1]);
    const size = (isPtr ? ptrSize : tlen[ft]) * mult;
    const bare = fn.replace(/^[*(]+/, '').replace(/[)[].*$/, '').replace(/\(.*$/, '');
    fields.push({ type: types[ft], name: fn, bare, off, size, isPtr });
    off += size;
  }
  const s = { type: types[type], size: tlen[type], fields, byName: new Map(fields.map((f) => [f.bare, f])) };
  structs.push(s);
  structByType.set(s.type, s);
}

const field = (structName, name) => {
  const f = structByType.get(structName)?.byName.get(name);
  if (!f) throw new Error(`no field ${structName}.${name}`);
  return f;
};
const idName = (base) => {
  // ID.name is char[66] at the start of every ID block (after next/prev pointers etc.).
  const f = field('ID', 'name');
  return buf.toString('latin1', base + f.off, base + f.off + 66).replace(/\0.*$/s, '');
};

// --- materials -----------------------------------------------------------------------------------------------------
const materials = {};
const matName = new Map();
for (const b of blocks.filter((x) => x.code === 'MA')) {
  const s = structs[b.sdna];
  if (s.type !== 'Material') continue;
  const name = idName(b.data).slice(2);
  const g = (n) => (s.byName.has(n) ? f32(b.data + s.byName.get(n).off) : undefined);
  materials[name] = {
    color: [g('r'), g('g'), g('b')],
    alpha: g('alpha'),
    emit: g('emit'),
    specular: [g('specr'), g('specg'), g('specb')],
    rayMirror: g('ray_mirror'),
    ior: g('ang'),
    useNodes: s.byName.has('use_nodes') ? buf[b.data + s.byName.get('use_nodes').off] : 0,
  };
  matName.set(b.old, name);
}

// --- meshes ----------------------------------------------------------------------------------------------------------
const readPtrArray = (addr, n) => {
  const blk = byOld.get(addr);
  if (!blk) return [];
  const outp = [];
  for (let k = 0; k < n; k += 1) outp.push(ptr(blk.data + k * ptrSize));
  return outp;
};
const meshes = new Map();
for (const b of blocks.filter((x) => x.code === 'ME')) {
  const s = structs[b.sdna];
  if (s.type !== 'Mesh') continue;
  const g32 = (n) => i32(b.data + s.byName.get(n).off);
  const gp = (n) => ptr(b.data + s.byName.get(n).off);
  const totvert = g32('totvert');
  const totpoly = g32('totpoly');
  const totloop = g32('totloop');
  const totcol = i16(b.data + s.byName.get('totcol').off);
  const mv = byOld.get(gp('mvert'));
  const mp = byOld.get(gp('mpoly'));
  const ml = byOld.get(gp('mloop'));
  const sv = structByType.get('MVert');
  const sp = structByType.get('MPoly');
  const sl = structByType.get('MLoop');
  const positions = [];
  for (let k = 0; k < totvert; k += 1) {
    const o = mv.data + k * sv.size + sv.byName.get('co').off;
    positions.push(f32(o), f32(o + 4), f32(o + 8));
  }
  const loops = [];
  for (let k = 0; k < totloop; k += 1) loops.push(u32(ml.data + k * sl.size + sl.byName.get('v').off));
  const polys = [];
  const smooth = [];
  for (let k = 0; k < totpoly; k += 1) {
    const o = mp.data + k * sp.size;
    const start = i32(o + sp.byName.get('loopstart').off);
    const n = i32(o + sp.byName.get('totloop').off);
    const mat = i16(o + sp.byName.get('mat_nr').off);
    const flag = buf[o + sp.byName.get('flag').off];
    polys.push([mat, ...loops.slice(start, start + n)]);
    smooth.push(flag & 1);
  }
  const mats = readPtrArray(gp('mat'), totcol).map((a) => matName.get(a) ?? null);
  meshes.set(b.old, { name: idName(b.data).slice(2), positions, polys, smooth, materials: mats, totvert, totpoly });
}

// --- objects ---------------------------------------------------------------------------------------------------------
const objects = [];
const modifierTypes = { 8: 'subsurf', 7: 'mirror', 5: 'array', 18: 'solidify', 15: 'bevel', 1: 'subsurf?' };
for (const b of blocks.filter((x) => x.code === 'OB')) {
  const s = structs[b.sdna];
  if (s.type !== 'Object') continue;
  const name = idName(b.data).slice(2);
  const dataPtr = ptr(b.data + s.byName.get('data').off);
  const mesh = meshes.get(dataPtr);
  const om = s.byName.get('obmat').off;
  const m = [];
  for (let k = 0; k < 16; k += 1) m.push(f32(b.data + om + k * 4));
  // Object-level materials override mesh ones where matbits is set; keep it simple: prefer object mat when present.
  const totcol = s.byName.has('totcol') ? i16(b.data + s.byName.get('totcol').off) : 0;
  const obMats = totcol ? readPtrArray(ptr(b.data + s.byName.get('mat').off), totcol).map((a) => matName.get(a) ?? null) : [];
  // Modifiers: a ListBase of ModifierData blocks.
  const mods = [];
  const lb = b.data + s.byName.get('modifiers').off;
  let md = ptr(lb);
  const smd = structByType.get('ModifierData');
  while (md) {
    const blk = byOld.get(md);
    if (!blk) break;
    const type = i32(blk.data + smd.byName.get('type').off);
    const st = structs[blk.sdna];
    const entry = { type, kind: st.type };
    if (st.type === 'SubsurfModifierData') {
      entry.levels = i16(blk.data + st.byName.get('levels').off);
      entry.renderLevels = i16(blk.data + st.byName.get('renderLevels').off);
    }
    mods.push(entry);
    md = ptr(blk.data + smd.byName.get('next').off);
  }
  objects.push({ name, mesh: mesh?.name ?? null, matrix: m, materials: obMats.some(Boolean) ? obMats : mesh?.materials ?? [], modifiers: mods, meshData: mesh });
  void modifierTypes;
}

console.log(`Blender ${version}, ${ptrSize * 8}-bit, ${little ? 'little' : 'big'} endian; ${blocks.length} blocks, ${structs.length} structs`);
for (const o of objects) {
  const md = o.meshData;
  console.log(`OB ${o.name.padEnd(28)} mesh=${String(o.mesh).padEnd(24)} verts=${md?.totvert ?? '-'} polys=${md?.totpoly ?? '-'} mats=[${o.materials.join(', ')}] mods=${o.modifiers.map((x) => x.kind + (x.levels !== undefined ? `(${x.levels}/${x.renderLevels})` : '')).join(',')}`);
  console.log(`   translate ${o.matrix.slice(12, 15).map((v) => v.toFixed(3)).join(' ')}  scale≈${Math.hypot(o.matrix[0], o.matrix[1], o.matrix[2]).toFixed(3)}`);
}
for (const [n, m] of Object.entries(materials)) console.log(`MA ${n.padEnd(24)} rgb=${m.color.map((v) => v?.toFixed(2)).join(',')} alpha=${m.alpha?.toFixed(2)} emit=${m.emit?.toFixed(2)} nodes=${m.useNodes}`);

if (out) {
  const json = {
    source: file.replace(/^.*[\\/]/, ''),
    objects: objects.filter((o) => o.meshData).map((o) => ({
      name: o.name,
      mesh: o.mesh,
      matrix: o.matrix,
      materials: o.materials,
      subsurf: o.modifiers.find((x) => x.kind === 'SubsurfModifierData')?.renderLevels ?? 0,
      positions: o.meshData.positions.map((v) => Math.round(v * 1e5) / 1e5),
      polys: o.meshData.polys,
      smooth: o.meshData.smooth,
    })),
    materials,
  };
  fs.writeFileSync(out, JSON.stringify(json));
  console.log(`wrote ${out}`);
}
