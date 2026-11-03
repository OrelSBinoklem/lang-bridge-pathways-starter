import { BaseCheckpointSaver, WRITES_IDX_MAP, copyCheckpoint, compareWritesSortKeys, writesSortKey } from '@langchain/langgraph-checkpoint';
import { deflateRaw, inflateRaw } from 'node:zlib';
import { promisify } from 'node:util';

const compress = promisify(deflateRaw), decompress = promisify(inflateRaw), decodeBytes = 8 * 1048576;

/** Public LangGraph checkpointer contract, persisted by the same atomic lease as node effects. */
export class DurableGraphSaver extends BaseCheckpointSaver {
  constructor(lease) { super(); this.lease = lease; }
  key(config) {
    if (config.configurable?.thread_id !== this.lease.record.id || config.configurable?.checkpoint_ns) throw Error('Чужая область контрольного снимка.');
    return config.configurable.checkpoint_id;
  }
  async encode(value) {
    const [type, data] = await this.serde.dumpsTyped(value);
    if (data.byteLength > decodeBytes) throw Error('Состояние LangGraph превышает лимит распаковки.');
    return { type, compressed: true, data: (await compress(data)).toString('base64') };
  }
  async decode(value) {
    const data = Buffer.from(value.data, 'base64');
    return this.serde.loadsTyped(value.type, value.compressed ? await decompress(data, { maxOutputLength: decodeBytes }) : data);
  }
  config(id) { return { configurable: { thread_id: this.lease.record.id, checkpoint_ns: '', checkpoint_id: id } }; }
  async getTuple(config) {
    const id = this.key(config) || Object.keys(this.lease.record.checkpoints).sort().at(-1);
    const saved = this.lease.record.checkpoints[id]; if (!saved) return undefined;
    const writes = Object.values(this.lease.record.writes[id] || {}).sort((a, b) => compareWritesSortKeys(writesSortKey(a.path, a.taskId, a.index), writesSortKey(b.path, b.taskId, b.index)));
    return { config: this.config(id), checkpoint: await this.decode(saved.checkpoint), metadata: await this.decode(saved.metadata),
      ...(saved.parent ? { parentConfig: this.config(saved.parent) } : {}),
      pendingWrites: await Promise.all(writes.map(async w => [w.taskId, w.channel, await this.decode(w.value)])) };
  }
  async *list(config, options = {}) {
    this.key(config); let remaining = options.limit ?? Infinity;
    for (const id of Object.keys(this.lease.record.checkpoints).sort().reverse()) {
      if (config.configurable.checkpoint_id && config.configurable.checkpoint_id !== id || options.before?.configurable?.checkpoint_id && id >= options.before.configurable.checkpoint_id) continue;
      const tuple = await this.getTuple(this.config(id));
      if (options.filter && !Object.entries(options.filter).every(([key, value]) => tuple.metadata[key] === value)) continue;
      if (remaining-- <= 0) return; yield tuple;
    }
  }
  async put(config, checkpoint, metadata) {
    const parent = this.key(config), saved = { checkpoint: await this.encode(copyCheckpoint(checkpoint)), metadata: await this.encode(metadata), parent: parent || null };
    await this.lease.update(record => {
      record.checkpoints[checkpoint.id] = saved;
      // These channels are full snapshots (no DeltaChannel). Keep the current
      // superstep and two predecessors, including pending writes for recovery.
      // Full node outcomes remain in the separate journal for safe effect reuse.
      const retained = new Set(Object.keys(record.checkpoints).sort().slice(-3));
      for (const id of Object.keys(record.checkpoints)) if (!retained.has(id)) delete record.checkpoints[id];
      for (const id of Object.keys(record.writes)) if (!retained.has(id)) delete record.writes[id];
      for (const item of Object.values(record.checkpoints)) if (!retained.has(item.parent)) item.parent = null;
    });
    return this.config(checkpoint.id);
  }
  async putWrites(config, writes, taskId, taskPath = '') {
    const id = this.key(config); if (!id) throw Error('Не указан checkpoint_id.');
    const saved = await Promise.all(writes.map(async ([channel, value], index) => ({ taskId, channel, value: await this.encode(value), index: WRITES_IDX_MAP[channel] ?? index, path: taskPath })));
    await this.lease.update(record => {
      record.writes[id] ||= {};
      for (const write of saved) { const key = `${taskId},${write.index}`; if (write.index < 0 || !Object.hasOwn(record.writes[id], key)) record.writes[id][key] = write; }
    });
  }
  async deleteThread() { throw Error('Контрольные снимки удаляются только политикой хранения.'); }
}
