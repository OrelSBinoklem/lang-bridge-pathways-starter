import { readdir, mkdir, access } from 'node:fs/promises';
import sharp from 'sharp';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const input = path.resolve('../.tmp/carnival-video-20261022');
const output = path.resolve('public/course/effects/carnival');
await mkdir(output, { recursive: true });
const atlas = (await readdir(input)).filter(name => name.startsWith('balloons-') && name.endsWith('.png')).sort().at(-1);
const atlasTarget = path.join(output, 'balloons.webp');
let hasAtlas = true; try { await access(atlasTarget); } catch { hasAtlas = false; }
if (atlas && !hasAtlas) await sharp(path.join(input, atlas)).webp({ lossless: true }).toFile(atlasTarget);
for (const side of ['left', 'right']) {
  const names = (await readdir(input)).filter(name => name.startsWith(side + '-') && name.endsWith('.h264')).sort();
  if (!names.length) throw new Error(`Bake ${side} in /course/carnival-bake first`);
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'warning', '-n', '-r', '60', '-i', path.join(input, names.at(-1)),
    '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-maxrate', '4M', '-bufsize', '8M', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(output, `park-${side}.mp4`)], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`ffmpeg failed: ${side} (existing files are never overwritten)`);
}
