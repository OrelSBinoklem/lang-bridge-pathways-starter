import { lstat, readdir, realpath, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const cacheLimit = 10 * 1024 ** 3;
const parts = ['.next', 'dev', 'cache', 'turbopack'];

// Refuse junctions/symlinks rather than allowing a cleanup to escape .next/dev/cache.
export async function cachePath(root = frontendRoot) {
  let current = await realpath(root);
  for (const part of parts) {
    current = join(current, part);
    try {
      const entry = await lstat(current);
      if (entry.isSymbolicLink() || !entry.isDirectory()) throw new Error(`Unsafe cache directory: ${current}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  if (relative(await realpath(root), current) !== join(...parts)) throw new Error('Cache path escaped frontend.');
  return current;
}

async function directoryBytes(directory) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return 0; throw error; }
  let bytes = 0;
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Linked cache entry: ${path}`);
    if (entry.isDirectory()) bytes += await directoryBytes(path);
    else {
      try { bytes += (await lstat(path)).size; }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  return bytes;
}

export async function cacheBytes(root = frontendRoot) {
  return directoryBytes(await cachePath(root));
}

export function formatGiB(bytes) { return `${(bytes / 1024 ** 3).toFixed(2)} GiB`; }

export async function acquireDevLock(root = frontendRoot) {
  const require = createRequire(join(frontendRoot, 'package.json'));
  const swc = require('next/dist/build/swc/index.js');
  await swc.loadBindings();
  if (swc.getBindingsSync().isWasm) throw new Error('Native Next.js lock unavailable; cache cleanup refused.');
  const { Lockfile } = require('next/dist/build/lockfile.js');
  return Lockfile.tryAcquire(join(root, '.next', 'dev', 'lock'));
}

export async function cleanCache({ root = frontendRoot, limit = cacheLimit, force = false, acquireLock = acquireDevLock } = {}) {
  let bytes = await cacheBytes(root);
  if (!bytes || (!force && bytes < limit)) return { status: 'below-limit', bytes };
  // Use the very same native lock as Next dev, including stale-lock handling.
  const lock = await acquireLock(root);
  if (!lock) return { status: 'busy', bytes };
  try {
    const target = await cachePath(root);
    bytes = await directoryBytes(target);
    if (!force && bytes < limit) return { status: 'below-limit', bytes };
    await rm(target, { recursive: true, force: true });
    return { status: 'removed', bytes };
  } finally { await lock.unlock(); }
}

export function logCleanup(result) {
  if (result.status === 'removed') console.log(`[next-cache] Removed ${formatGiB(result.bytes)} of Turbopack cache.`);
  if (result.status === 'busy') console.warn('[next-cache] Next dev is still using the cache; cleanup deferred until the next start.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv[2] === '--clean') logCleanup(await cleanCache({ force: true }));
    else console.log(`[next-cache] ${formatGiB(await cacheBytes())}; automatic cleanup threshold: ${formatGiB(cacheLimit)}.`);
  } catch (error) { console.error('[next-cache]', error.message); process.exitCode = 1; }
}
