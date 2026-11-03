import { mkdir, readFile, writeFile, rename, unlink, readdir, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const MB = 1024 * 1024;
export const TRACE_LIMITS = Object.freeze({ ageMs: 86400000, runsPerUser: 100, userBytes: 25 * MB, totalBytes: 100 * MB, runBytes: 2 * MB, activeBytes: 8 * MB, eventBytes: 512 * 1024, eventsPerRun: 300, maxRuns: 1000 });
const uuid = value => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);
const positive = value => Number.isSafeInteger(value) && value > 0;
// Credentials and recorded audio are never part of an inspection archive.
function safeJSON(value) {
  return JSON.stringify(value, (key, item) => /^(authorization|api[_-]?key|access[_-]?token|secret|ticket|headers|audio|audioBase64|audio_base64|encrypted_content)$/i.test(key) ? '[excluded]' : item);
}

export class TraceArchive {
  constructor({ directory = fileURLToPath(new URL('../../../../../storage/app/private/tutor-debug/', import.meta.url)), limits = {}, clock = Date.now, onChange = () => {}, onError = () => {} } = {}) {
    this.directory = directory; this.limits = { ...TRACE_LIMITS, ...limits }; this.clock = clock; this.onChange = onChange; this.onError = onError;
    this.index = []; this.watches = {}; this.active = new Map(); this.checkpoints = new Map(); this.dropped = new Map(); this.pending = Promise.resolve();
    this.ready = this.load();
  }
  async load() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    for (const file of ['index', 'watches']) {
      try { this[file] = JSON.parse(await readFile(`${this.directory}/${file}.json`, 'utf8')); }
      catch (error) { if (error.code !== 'ENOENT') this.onError(error); }
    }
    if (!Array.isArray(this.index)) this.index = [];
    this.index = this.index.map(item => item.status === 'running' ? { ...item, status: 'failed', error: 'Шлюз перезапущен до завершения запроса; сохранён последний контрольный снимок.' } : item);
    if (!this.watches || typeof this.watches !== 'object' || Array.isArray(this.watches)) this.watches = {};
    // Recover a finished atomic file if the process stopped before updating the index.
    const known = new Set(this.index.map(item => item.id));
    for (const entry of await readdir(this.directory, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const id = entry.name.replace(/\.json$/, '');
      if (uuid(id) && entry.name.endsWith('.json') && !known.has(id)) {
        try {
          if ((await stat(`${this.directory}/${entry.name}`)).size > this.limits.runBytes + 4096) { await unlink(`${this.directory}/${entry.name}`); continue; }
          const run = JSON.parse(await readFile(`${this.directory}/${entry.name}`, 'utf8'));
          if (run.id === id && positive(run.userId) && Number.isFinite(run.startedAt)) {
            run.bytes = (await stat(`${this.directory}/${entry.name}`)).size;
            const item = this.metadata(run); if (item.status === 'running') { item.status = 'failed'; item.error = 'Шлюз перезапущен до завершения запроса.'; }
            this.index.push(item);
          } else await unlink(`${this.directory}/${entry.name}`);
        } catch (error) { this.onError(error); await unlink(`${this.directory}/${entry.name}`).catch(this.onError); }
      }
      if (/^[a-f0-9-]{36}\.tmp$/.test(entry.name)) await unlink(`${this.directory}/${entry.name}`).catch(this.onError);
    }
    await this.prune();
  }
  async atomic(name, text) {
    const temporary = `${this.directory}/${name}.tmp`;
    await writeFile(temporary, text, { mode: 0o600 }); await rename(temporary, `${this.directory}/${name}.json`);
  }
  async prune() {
    const now = this.clock(), users = new Map(); let bytes = 0;
    const keep = [], remove = [];
    for (const item of [...this.index].sort((a, b) => b.startedAt - a.startedAt)) {
      const user = users.get(item.userId) ?? { bytes: 0, count: 0 };
      if (!uuid(item.id) || !positive(item.userId) || now - item.startedAt > this.limits.ageMs || user.count >= this.limits.runsPerUser || user.bytes + item.bytes > this.limits.userBytes || bytes + item.bytes > this.limits.totalBytes || keep.length >= this.limits.maxRuns) remove.push(item);
      else { keep.push(item); bytes += item.bytes; user.bytes += item.bytes; user.count++; users.set(item.userId, user); }
    }
    this.index = keep;
    for (const item of remove) if (uuid(item.id)) await unlink(`${this.directory}/${item.id}.json`).catch(error => { if (error.code !== 'ENOENT') this.onError(error); });
    for (const key of Object.keys(this.watches)) if (this.watches[key] < now) delete this.watches[key];
    for (const key of this.dropped.keys()) if (!Object.keys(this.watches).some(watch => watch === String(key) || watch.startsWith(`${key}:`))) this.dropped.delete(key);
    await this.atomic('index', JSON.stringify(this.index));
  }
  serialize(task) {
    const result = this.pending.then(task); this.pending = result.catch(error => this.onError(error)); return result;
  }
  async watch(userId, enabled = true, botId = 'tutor') {
    await this.ready;
    if (!positive(userId)) throw Error('Неверный пользователь.');
    return this.serialize(async () => {
      const key = botId === 'tutor' ? String(userId) : `${userId}:${botId}`;
      if (enabled && Object.keys(this.watches).length >= 50 && !this.watches[key]) throw Error('Одновременно можно включить до 50 записей пользователей/ботов.');
      if (enabled) this.watches[key] = this.clock() + this.limits.ageMs; else delete this.watches[key];
      await this.atomic('watches', JSON.stringify(this.watches)); this.onChange({ userId, botId, status: enabled ? 'recording' : 'stopped' }); return this.status(userId, botId);
    });
  }
  status(userId, botId = 'tutor') {
    const own = this.index.filter(item => item.userId === userId), active = [...this.active.values()].filter(item => item.userId === userId);
    const key = botId === 'tutor' ? String(userId) : `${userId}:${botId}`;
    return { recording: (this.watches[key] ?? 0) > this.clock(), expiresAt: this.watches[key] ?? null, droppedRuns: this.dropped.get(userId) ?? 0, bytes: own.reduce((sum, item) => sum + item.bytes, 0), totalBytes: this.index.reduce((sum, item) => sum + item.bytes, 0), activeBytes: [...this.active.values()].reduce((sum, item) => sum + item.bytes, 0), runs: own.length, active: active.length, limits: this.limits };
  }
  async begin({ userId, conversationId, graph, versionId = null, preset, model, event, sources, botId = 'tutor', subject = null }) {
    await this.ready;
    const key = botId === 'tutor' ? String(userId) : `${userId}:${botId}`;
    if (!positive(userId) || botId === 'tutor' && !positive(conversationId) || (this.watches[key] ?? 0) <= this.clock()) return null;
    const refused = () => { this.dropped.set(userId, Math.min(999999, (this.dropped.get(userId) ?? 0) + 1)); this.onChange({ userId, botId, conversationId, status: 'capacity_limited' }); return null; };
    if ([...this.active.values()].reduce((sum, item) => sum + item.bytes, 0) >= this.limits.activeBytes || this.active.size >= 8) return refused();
    const run = { id: randomUUID(), userId, botId, subject, conversationId, versionId, graph, preset, model, startedAt: this.clock(), status: 'running', events: [], event, sources, bytes: 0, omitted: 0 };
    const initial = safeJSON(run);
    if (Buffer.byteLength(initial) > this.limits.runBytes / 2) { run.sources = undefined; run.event = undefined; run.omitted++; }
    run.bytes = Buffer.byteLength(safeJSON(run));
    if ([...this.active.values()].reduce((sum, item) => sum + item.bytes, 0) + run.bytes > this.limits.activeBytes) return refused();
    this.active.set(run.id, run);
    this.onChange(this.metadata(run));
    return run.id;
  }
  metadata(run) {
    const { id, userId, conversationId, versionId, preset, model, startedAt, status, bytes, omitted, error, durationMs, subject } = run;
    return { id, userId, botId: run.botId ?? 'tutor', subject, conversationId, versionId, preset, model, startedAt, status, bytes, omitted, error, durationMs };
  }
  append(id, event) {
    const run = this.active.get(id); if (!run) return;
    let json;
    try { json = safeJSON({ ...event, at: event.at ?? new Date(this.clock()).toISOString() }); } catch { run.omitted++; return; }
    const bytes = Buffer.byteLength(json), activeBytes = [...this.active.values()].reduce((sum, item) => sum + item.bytes, 0);
    if (bytes > this.limits.eventBytes || run.bytes + bytes + 2048 > this.limits.runBytes || activeBytes + bytes > this.limits.activeBytes || run.events.length >= this.limits.eventsPerRun) {
      run.omitted++; this.onChange(this.metadata(run)); return;
    }
    run.events.push(JSON.parse(json)); run.bytes += bytes + 1; this.onChange(this.metadata(run));
  }
  async finish(id, error = null) {
    const run = this.active.get(id); if (!run) return;
    run.status = error ? 'failed' : 'completed'; run.durationMs = this.clock() - run.startedAt;
    // Error stacks and provider response bodies are not collected.
    if (error) run.error = String(error.message ?? error).slice(0, 500);
    const json = safeJSON(run); run.bytes = Buffer.byteLength(json);
    try { await this.serialize(async () => { await this.atomic(run.id, json); this.index = [this.metadata(run), ...this.index.filter(item => item.id !== id)]; await this.prune(); }); }
    finally { this.active.delete(id); this.checkpoints.delete(id); this.onChange(this.metadata(run)); }
  }
  async checkpoint() {
    await this.ready;
    return this.serialize(async () => {
      for (const run of this.active.values()) {
        const revision = `${run.events.length}:${run.omitted}`;
        if (this.checkpoints.get(run.id) === revision) continue;
        await this.atomic(run.id, safeJSON(run));
        this.index = [this.metadata(run), ...this.index.filter(item => item.id !== run.id)];
        this.checkpoints.set(run.id, revision);
      }
      await this.prune();
    });
  }
  async list(userId, conversationId = null, botId = 'tutor') {
    await this.ready; await this.serialize(() => this.prune());
    const all = new Map(this.index.map(run => [run.id, run]));
    for (const run of this.active.values()) all.set(run.id, this.metadata(run));
    return { ...this.status(userId, botId), runs: [...all.values()].filter(run => (run.botId ?? 'tutor') === botId && run.userId === userId && (!conversationId || run.conversationId === conversationId)).sort((a, b) => b.startedAt - a.startedAt).slice(0, this.limits.runsPerUser) };
  }
  async detail(userId, id, botId = 'tutor') {
    await this.ready;
    if (!uuid(id)) throw Error('Неверная запись.');
    const active = this.active.get(id);
    if (active?.userId === userId && (active.botId ?? 'tutor') === botId) return JSON.parse(safeJSON(active));
    const item = this.index.find(item => item.id === id && item.userId === userId && (item.botId ?? 'tutor') === botId && this.clock() - item.startedAt <= this.limits.ageMs);
    if (!item) throw Error('Запись недоступна или удалена по лимиту.');
    return { ...JSON.parse(await readFile(`${this.directory}/${id}.json`, 'utf8')), ...item };
  }
}
