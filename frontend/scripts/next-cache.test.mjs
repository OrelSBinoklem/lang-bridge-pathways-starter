import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cacheBytes, cacheLimit, cachePath, cleanCache } from './next-cache.mjs';

const temporaryRoot = fileURLToPath(new URL('../../.tmp/', import.meta.url));
async function fixture(t) {
  await mkdir(temporaryRoot, { recursive: true });
  const root = await mkdtemp(join(temporaryRoot, 'next-cache-test-'));
  // Only this test's newly created directory is removed, never existing .tmp files.
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.next/dev/cache/turbopack'), { recursive: true });
  await writeFile(join(root, '.next/dev/cache/turbopack/data.sst'), 'cache-data');
  await writeFile(join(root, '.next/BUILD_ID'), 'keep-production-build');
  return root;
}

test('threshold is 10 GiB; small or absent caches are not removed', async t => {
  const root = await fixture(t);
  assert.equal(cacheLimit, 10 * 1024 ** 3);
  assert.equal(await cacheBytes(root), 10);
  const result = await cleanCache({ root, acquireLock: () => { throw new Error('Should not acquire'); } });
  assert.equal(result.status, 'below-limit');
  assert.equal(await cacheBytes(root), 10);
});

test('at threshold only the exact cache is removed under a lock', async t => {
  const root = await fixture(t);
  let released = false;
  const result = await cleanCache({ root, limit: 10, acquireLock: () => ({ unlock: async () => { released = true; } }) });
  assert.equal(result.status, 'removed');
  assert.equal(released, true);
  assert.equal(await cacheBytes(root), 0);
  assert.equal(await readFile(join(root, '.next/BUILD_ID'), 'utf8'), 'keep-production-build');
});

test('even manual forced cleanup refuses an active Next lock', async t => {
  const root = await fixture(t);
  assert.equal((await cleanCache({ root, force: true, acquireLock: () => undefined })).status, 'busy');
  assert.equal(await cacheBytes(root), 10);
});

test('real Next native lock prevents concurrent cleanup', async t => {
  const root = await fixture(t);
  const { acquireDevLock } = await import('./next-cache.mjs');
  const lock = await acquireDevLock(root);
  assert(lock);
  try {
    assert.equal((await cleanCache({ root, force: true })).status, 'busy');
    assert.equal(await cacheBytes(root), 10);
  } finally { await lock.unlock(); }
  assert.equal((await cleanCache({ root, force: true })).status, 'removed');
});

test('junction/symlink paths are refused and their data is preserved', async t => {
  const root = await fixture(t);
  const target = await cachePath(root);
  const other = join(root, 'keep');
  await mkdir(other);
  await writeFile(join(other, 'important'), 'keep');
  await rm(target, { recursive: true });
  await symlink(other, target, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(cleanCache({ root, force: true }), /Unsafe cache directory/);
  assert.equal(await readFile(join(other, 'important'), 'utf8'), 'keep');
});
