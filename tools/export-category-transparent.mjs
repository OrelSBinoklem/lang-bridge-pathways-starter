import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(path.join(root, 'frontend/package.json'));
const sharp = require('sharp');
const source = path.join(root, 'resources/course/category-art-transparent');
const destination = path.join(root, 'frontend/public/course/categories/transparent');
const manifest = path.join(root, 'frontend/src/features/course/category-transparent.json');
const icons = JSON.parse(await readFile(path.join(root, 'frontend/src/features/course/category-icons.json'), 'utf8'));
const files = new Set(await readdir(source));
const ready = Object.keys(icons).filter(id => ['light', 'dark'].every(theme => files.has(`${id}-${theme}.png`)));

await mkdir(destination, { recursive: true });
for (const id of ready) {
  for (const theme of ['light', 'dark']) {
    const name = `${id}-${theme}`;
    const input = path.join(source, `${name}.png`);
    const stats = await sharp(input).stats();
    if (stats.isOpaque || stats.channels.length !== 4 || stats.channels[3].min !== 0) {
      throw new Error(`${name}: expected an RGBA image with a transparent background`);
    }
    await sharp(input).resize(408, 408, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(destination, `${name}.webp`));
  }
}
// Publish only complete pairs, after every export succeeds.
await writeFile(manifest, `${JSON.stringify(ready.map(Number))}\n`);
console.log(`Exported ${ready.length * 2} images for ${ready.length}/${Object.keys(icons).length} categories.`);
