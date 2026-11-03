// node tools/avatar/optimize-vrm.mjs <in.vrm> <out.vrm> [--info]
// Shrinks the textures of a VRM (GLB) in place of the original images; every extension (VRMC_*, MToon) is kept as is.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const sharp = require('sharp');

const [input, output, flag] = process.argv.slice(2);
const glb = readFileSync(input);
const jsonLen = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString());
const binStart = 20 + jsonLen + 8;
const bin = glb.subarray(binStart, binStart + glb.readUInt32LE(20 + jsonLen));
const view = i => { const v = json.bufferViews[i]; return bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength); };

// Which materials use which image (to choose sizes: the face is seen up close).
const users = new Map();
const texImage = t => json.textures[t]?.source;
for (const m of json.materials) {
  const add = idx => { if (idx == null) return; const img = texImage(idx); if (img == null) return; users.set(img, [...new Set([...(users.get(img) ?? []), m.name.replace(' (Instance)', '')])]); };
  const walk = o => { if (!o || typeof o !== 'object') return; for (const [k, v] of Object.entries(o)) { if (k === 'index' && typeof v === 'number' && /texture/i.test(JSON.stringify(Object.keys(o)))) add(v); if (v && typeof v === 'object') { if ('index' in v && typeof v.index === 'number') add(v.index); walk(v); } } };
  walk(m);
}

const out = new Map();
for (const [i, img] of json.images.entries()) {
  const data = view(img.bufferView);
  const meta = await sharp(data).metadata();
  const who = (users.get(i) ?? []).join(', ');
  const max = img.name === 'Thumbnail' ? 128 : 1024;
  if (flag === '--info') { console.log(i, img.name, `${meta.width}x${meta.height}`, meta.hasAlpha ? 'alpha' : '', (data.length / 1024 | 0) + 'K', '|', who); continue; }
  if (meta.width <= max && meta.height <= max) continue;
  let pipe = sharp(data).resize({ width: Math.min(meta.width, max), height: Math.min(meta.height, max), fit: 'inside' });
  const stats = meta.hasAlpha ? await sharp(data).stats() : null;
  const usesAlpha = stats ? stats.channels[3].min < 255 : false;
  const buf = usesAlpha
    ? await pipe.png({ compressionLevel: 9 }).toBuffer()
    : await pipe.removeAlpha().jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  out.set(img.bufferView, buf);
  img.mimeType = usesAlpha ? 'image/png' : 'image/jpeg';
  console.log(i, img.name, `${meta.width} -> ${Math.min(meta.width, max)}`, img.mimeType, (data.length / 1024 | 0) + 'K ->', (buf.length / 1024 | 0) + 'K', '|', who);
}
if (flag === '--info') process.exit(0);

// Rebuild the binary chunk with the new images, 4-byte aligned.
const parts = []; let offset = 0;
for (const [i, v] of json.bufferViews.entries()) {
  const data = out.get(i) ?? view(i);
  v.byteOffset = offset; v.byteLength = data.length;
  parts.push(data); offset += data.length;
  const pad = (4 - (offset % 4)) % 4; if (pad) { parts.push(Buffer.alloc(pad)); offset += pad; }
}
json.buffers[0].byteLength = offset;
let jsonBuf = Buffer.from(JSON.stringify(json));
jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);
const binBuf = Buffer.concat(parts);
const header = Buffer.alloc(12); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + binBuf.length, 8);
const chunk = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
writeFileSync(output, Buffer.concat([header, chunk(jsonBuf.length, 0x4e4f534a), jsonBuf, chunk(binBuf.length, 0x004e4942), binBuf]));
console.log('written', output, (offset / 1024 / 1024).toFixed(2) + ' MB');
