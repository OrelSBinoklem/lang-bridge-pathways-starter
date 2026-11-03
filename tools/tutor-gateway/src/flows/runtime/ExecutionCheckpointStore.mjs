import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, stat, readdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const MB = 1048576;
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
export const CHECKPOINT_LIMITS = Object.freeze({ runBytes: 4 * MB, maxRuns: 32, ownerRuns: 8, activeRuns: 8, ageMs: 86400000 });
export const executionFingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Private, bounded recovery data. Conversation history and billing remain in Laravel.
 * One gateway worker owns this directory; this is not a distributed execution lock. */
export class ExecutionCheckpointStore {
  constructor({ directory = fileURLToPath(new URL('../../../../../storage/app/private/tutor-executions/', import.meta.url)),
    temporary = fileURLToPath(new URL('../../../../../.tmp/tutor-execution-writes/', import.meta.url)), limits = {}, clock = Date.now, replace = rename } = {}) {
    this.directory = directory; this.temporary = temporary; this.limits = { ...CHECKPOINT_LIMITS, ...limits }; this.clock = clock;
    this.active = new Map(); this.queue = Promise.resolve(); this.replace = replace;
  }
  serialize(work) { const next = this.queue.then(work); this.queue = next.catch(() => {}); return next; }
  async read(id) {
    if (!uuid(id)) throw Error('Некорректный ID контрольного снимка.');
    const path = join(this.directory, `${id}.json`);
    if ((await stat(path)).size > this.limits.runBytes) throw Error('Контрольный снимок превышает лимит.');
    const record = JSON.parse(await readFile(path, 'utf8'));
    if (record.schema !== 1 || record.id !== id) throw Error('Повреждён контрольный снимок исполнения.');
    return record;
  }
  async write(record) {
    record.updatedAt = this.clock();
    const text = JSON.stringify(record);
    if (Buffer.byteLength(text) > this.limits.runBytes) throw Error('Контрольный снимок достиг лимита памяти. Новые шаги не запущены.');
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await mkdir(this.temporary, { recursive: true, mode: 0o700 });
    const temporary = join(this.temporary, `${record.id}-${randomUUID()}.pending`);
    const file = await open(temporary, 'wx', 0o600);
    try { await file.writeFile(text); await file.sync(); } finally { await file.close(); }
    try {
      // Windows scanners can briefly hold the old target. Retry the atomic file
      // replacement only, never the provider/model action that produced it.
      for (let attempt = 0; ; attempt++) {
        try { await this.replace(temporary, join(this.directory, `${record.id}.json`)); break; }
        catch (error) { if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= 6) throw error; await delay(10 * 2 ** attempt); }
      }
    }
    finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  }
  async prune(owner) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await mkdir(this.temporary, { recursive: true, mode: 0o700 });
    for (const name of await readdir(this.temporary)) {
      if (!/^[a-f0-9-]{36}-[a-f0-9-]{36}\.pending$/.test(name)) continue;
      const path = join(this.temporary, name);
      if (this.clock() - (await stat(path)).mtimeMs > this.limits.ageMs) await unlink(path);
    }
    const records = [];
    for (const entry of await readdir(this.directory)) {
      if (!entry.endsWith('.json') || !uuid(entry.slice(0, -5))) continue;
      // Do not silently remove corrupt files: an operator should investigate them.
      records.push(await this.read(entry.slice(0, -5)));
    }
    records.sort((a, b) => b.updatedAt - a.updatedAt);
    let retained = 0, own = 0;
    for (const record of records) {
      const active = this.active.has(record.id), ours = record.owner === owner;
      if (!active && (this.clock() - record.updatedAt > this.limits.ageMs || retained >= this.limits.maxRuns - 1 || ours && own >= this.limits.ownerRuns - 1)) {
        await unlink(join(this.directory, `${record.id}.json`));
      } else { retained++; if (ours) own++; }
    }
    if (retained >= this.limits.maxRuns || own >= this.limits.ownerRuns) throw Error('Лимит активных контрольных снимков.');
  }
  async acquire({ owner, fingerprint, id = randomUUID(), resume = false }) {
    if (typeof owner !== 'string' || !owner || !/^[a-f0-9]{64}$/.test(fingerprint) || !uuid(id)) throw Error('Не задана область исполнения.');
    const ownerHash = executionFingerprint(owner);
    return this.serialize(async () => {
      if (this.active.has(id)) throw Error('Это исполнение уже запущено.');
      if (this.active.size >= this.limits.activeRuns) throw Error('Слишком много активных исполнений.');
      let record;
      if (resume) {
        record = await this.read(id);
        if (record.owner !== ownerHash) throw Error('Нет доступа к контрольному снимку.');
        if (record.fingerprint !== fingerprint) throw Error('Схема, входные данные или настройки изменились. Начните новый запуск.');
        if (this.clock() - record.updatedAt > this.limits.ageMs) throw Error('Срок хранения контрольного снимка истёк.');
      } else {
        try { await stat(join(this.directory, `${id}.json`)); throw Error('ID исполнения уже существует.'); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        await this.prune(ownerHash);
        record = { schema: 1, id, owner: ownerHash, fingerprint, createdAt: this.clock(), updatedAt: this.clock(), status: 'running', nodes: {}, checkpoints: {}, writes: {} };
        await this.write(record);
      }
      const lease = new ExecutionLease(this, record); this.active.set(id, lease); return lease;
    });
  }
}

export class ExecutionLease {
  constructor(store, record) { this.store = store; this.record = record; this.pending = Promise.resolve(); this.closed = false; this.storageFailure = null; }
  async update(work) {
    const next = this.pending.then(async () => {
      if (this.closed || this.storageFailure) throw this.storageFailure || Error('Исполнение уже закрыто.');
      // Work on a copy: a failed disk write must not turn an uncertain paid call into a completed one in RAM.
      const next = structuredClone(this.record); const result = await work(next);
      try { await this.store.write(next); } catch (error) { this.storageFailure = error; throw error; }
      this.record = next; return result;
    });
    this.pending = next.catch(() => {}); return next;
  }
  node(id) { return Object.hasOwn(this.record.nodes, id) ? this.record.nodes[id] : undefined; }
  start(id, type) { return this.update(record => { Object.defineProperty(record.nodes, id, { value: { status: 'running', type, external: ['model', 'compact', 'mcp'].includes(type) }, enumerable: true, configurable: true, writable: true }); }); }
  complete(id, value) { return this.update(record => { Object.defineProperty(record.nodes, id, { value: { ...(Object.hasOwn(record.nodes, id) ? record.nodes[id] : {}), ...value }, enumerable: true, configurable: true, writable: true }); }); }
  async close(status) {
    try { await this.update(record => { record.status = status; }); }
    finally { await this.pending; this.closed = true; this.store.active.delete(this.record.id); }
  }
  summary() {
    const nodes = Object.entries(this.record.nodes), uncertain = nodes.filter(([, node]) => node.external && !['completed', 'skipped'].includes(node.status)).map(([id]) => id);
    return { id: this.record.id, status: this.record.status, completed: nodes.filter(([, node]) => node.status === 'completed').length,
      uncertain, bytes: Buffer.byteLength(JSON.stringify(this.record)), limitBytes: this.store.limits.runBytes };
  }
}
