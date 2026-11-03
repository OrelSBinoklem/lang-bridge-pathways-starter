/** Offline only. CPU area-light visibility rays + one diffuse bounce/AO. Never imported by the browser. */
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import ts from 'typescript';

const source = await readFile(new URL('../src/features/course/effects/scenes/cinematic/trainLayout.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { TRAIN_WINDOW: win, TRAIN_BAKE_SURFACES: surfaces, TRAIN_OCCLUDERS: boxes } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const output = new URL('../public/course/effects/platskart/', import.meta.url);
await mkdir(output, { recursive: true });
let state = 176721;
const rand = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a, b, k = 1) => a.map((x, i) => x + b[i] * k);
const normalize = a => { const l = Math.hypot(...a) || 1; return a.map(x => x / l); };
function hitBox(origin, direction, box, max = Infinity) {
  let near = .0005, far = max, axis = 0, sign = 1;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(direction[i]) < 1e-8) { if (origin[i] < box.min[i] || origin[i] > box.max[i]) return null; continue; }
    let a = (box.min[i] - origin[i]) / direction[i], b = (box.max[i] - origin[i]) / direction[i];
    const side = a < b ? -1 : 1;
    if (a > b) [a, b] = [b, a];
    if (a > near) { near = a; axis = i; sign = side; }
    far = Math.min(far, b); if (near > far) return null;
  }
  const normal = [0, 0, 0]; normal[axis] = sign;
  return near < max ? { distance: near, normal, color: box.color } : null;
}
function trace(origin, direction, max = Infinity) {
  let nearest = null;
  for (const box of boxes) {
    const hit = hitBox(origin, direction, box, nearest?.distance ?? max);
    if (hit) nearest = hit;
  }
  return nearest;
}
function windowRay(point, normal) {
  const light = [win.x - .04, win.y0 + rand() * (win.y1 - win.y0), win.z0 + rand() * (win.z1 - win.z0)];
  const delta = light.map((x, i) => x - point[i]), distance = Math.hypot(...delta), direction = normalize(delta);
  const cosine = Math.max(0, dot(direction, normal));
  if (!cosine || trace(add(point, normal, .003), direction, distance - .01)) return 0;
  return cosine * Math.abs(direction[0]) * 4 / (1 + distance * distance);
}
const SUN = normalize([-1, .62, -.28]);
function sunlight(point, normal) {
  const t = (win.x - point[0]) / SUN[0];
  if (t <= 0 || dot(normal, SUN) <= 0) return 0;
  const q = add(point, SUN, t);
  const edge = Math.min(q[1] - win.y0, win.y1 - q[1], q[2] - win.z0, win.z1 - q[2]);
  if (edge < 0 || trace(add(point, normal, .003), SUN, t)) return 0;
  return Math.min(1, edge * 20) * dot(normal, SUN) * 1.9;
}
function hemisphere(normal) {
  let a;
  do { a = [rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1]; } while (dot(a, a) > 1 || dot(a, a) < .001);
  a = normalize(a); return dot(a, normal) < 0 ? a.map(x => -x) : a;
}
const SIZE = 128, SAMPLES = 48;
for (const [name, surface] of Object.entries(surfaces)) {
  const pixels = Buffer.alloc(SIZE * SIZE * 3);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const point = add(add(surface.origin, surface.u, (x + .5) / SIZE), surface.v, 1 - (y + .5) / SIZE);
    let direct = 0, openness = 0; const bounced = [0, 0, 0];
    for (let sample = 0; sample < SAMPLES; sample++) {
      direct += windowRay(point, surface.normal);
      const direction = hemisphere(surface.normal), hit = trace(add(point, surface.normal, .004), direction, 2.8);
      if (!hit) openness++;
      else {
        const reflected = windowRay(add(point, direction, hit.distance), hit.normal);
        for (let channel = 0; channel < 3; channel++) bounced[channel] += reflected * hit.color[channel] * .45;
      }
    }
    const sun = sunlight(point, surface.normal);
    for (let channel = 0; channel < 3; channel++) {
      const warm = [1, .78, .49][channel];
      const linear = .065 + .09 * openness / SAMPLES + warm * (direct / SAMPLES * .7 + sun * .44) + bounced[channel] / SAMPLES;
      pixels[(y * SIZE + x) * 3 + channel] = Math.round(Math.min(1, linear) ** (1 / 2.2) * 255);
    }
  }
  await sharp(pixels, { raw: { width: SIZE, height: SIZE, channels: 3 } }).blur(.65).webp({ lossless: true }).toFile(fileURLToPath(new URL(`light-${name}.webp`, output)));
  console.log(`Baked ${name}: ${SIZE}² × ${SAMPLES} rays, static window + diffuse bounce`);
}
// Multiscale authored surface maps, not photos or game assets. Keep good metal/
// vinyl coloration; add independent roughness, pores and low-frequency wear.
const hash = (x, y) => { const a = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return a - Math.floor(a); };
function noise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y); let u = x - ix, v = y - iy;
  u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
  return (hash(ix, iy) * (1 - u) + hash(ix + 1, iy) * u) * (1 - v) + (hash(ix, iy + 1) * (1 - u) + hash(ix + 1, iy + 1) * u) * v;
}
const N = 768;
for (const kind of ['wood', 'vinyl', 'paint', 'cloth', 'metal', 'skin']) {
  const pixels = Buffer.alloc(N * N * 3), height = Buffer.alloc(N * N), roughness = Buffer.alloc(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const noise = rand() - .5;
    const broad = noise2(x * .008, y * .009), detail = noise2(x * .15, y * .13);
    let value = .6, base = [1, 1, 1], rough = .8;
    if (kind === 'wood') {
      const warp = noise2(x * .003, y * .007) * 17 + noise2(x * .015, y * .01) * 3;
      const fibers = noise2(x * .014, y * .41 + warp) - .5;
      value = .6 + fibers * .1 + (broad - .5) * .06 + noise * .02; base = [.82, .68, .5]; rough = .57 + detail * .27;
    }
    if (kind === 'vinyl') { value = .55 + noise * .09 + (detail - .5) * .07 + (broad - .5) * .035; base = [.46, .57, .47]; rough = .65 + broad * .28; }
    if (kind === 'paint') { value = .8 + noise * .027 + (broad - .5) * .09; base = [1, .95, .83]; rough = .76 + detail * .2; }
    if (kind === 'cloth') { value = .88 + Math.sin(x * 2.9) * .025 + Math.sin(y * 2.9) * .03 + noise * .06; base = [1, .99, .96]; rough = .92 + detail * .07; }
    if (kind === 'metal') { value = .7 + Math.sin(y * 1.2) * .035 + noise * .045; base = [1, .97, .88]; }
    if (kind === 'metal') rough = .46 + detail * .25 + broad * .12;
    if (kind === 'skin') { value = .84 + (broad - .5) * .07 + noise * .022; base = [1, .79 + detail * .025, .67 + detail * .028]; rough = .7 + detail * .23; }
    if (rand() < .00065) value *= .5;
    for (let c = 0; c < 3; c++) pixels[(y * N + x) * 3 + c] = Math.round(Math.max(0, Math.min(1, value * base[c])) * 255);
    height[y * N + x] = Math.round(Math.max(0, Math.min(1, kind === 'skin' ? .5 + noise * .2 + (detail - .5) * .16 : value)) * 255);
    roughness[y * N + x] = Math.round(Math.max(0, Math.min(1, rough)) * 255);
  }
  await sharp(pixels, { raw: { width: N, height: N, channels: 3 } }).webp({ quality: 87 }).toFile(fileURLToPath(new URL(`${kind}.webp`, output)));
  await sharp(height, { raw: { width: N, height: N, channels: 1 } }).png().toFile(fileURLToPath(new URL(`${kind}-height.png`, output)));
  await sharp(roughness, { raw: { width: N, height: N, channels: 1 } }).webp({ quality: 87 }).toFile(fileURLToPath(new URL(`${kind}-roughness.webp`, output)));
}
let needles = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">';
needles += '<path d="M128 253 Q115 140 128 8" fill="none" stroke="#6a6740" stroke-width="4"/>';
for (let i = 0; i < 65; i++) {
  const y = 20 + i * 3.3, span = 5 + Math.sin(i / 65 * Math.PI) * 76;
  for (const sign of [-1, 1]) for (let j = 0; j < 3; j++) {
    const yy = y + j * 1.6, tip = 128 + sign * span * (.65 + rand() * .35);
    needles += `<path d="M${124 + Math.sin(y * .02) * 4} ${yy + 12} Q${128 + sign * span * .45} ${yy + 3} ${tip} ${yy - 15 - rand() * 13}" fill="none" stroke="${['#56674a', '#6b7953', '#3c513d', '#7d855b'][i % 4]}" stroke-width="${1.1 + rand() * 1.4}" stroke-linecap="round"/>`;
  }
}
needles += '</svg>';
await sharp(Buffer.from(needles)).png().toFile(fileURLToPath(new URL('pine-branch.png', output)));
