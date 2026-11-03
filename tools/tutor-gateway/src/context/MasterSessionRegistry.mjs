import { randomUUID } from 'node:crypto';
import policy from '../../../../resources/tutor-flow/session-policy.json' with { type: 'json' };

export const MASTER_SESSION_POLICY = Object.freeze(policy);

/** A process-local lease/cache, never an authority for ownership, history or credits.
 * Only detached, JSON data is retained; sockets, credentials, provider requests and
 * execution closures never enter the cache. Laravel must authorize every restore. */
export class MasterSessionRegistry {
  constructor({ policy = MASTER_SESSION_POLICY, now = Date.now, onEvent = () => {} } = {}) {
    this.policy = { ...MASTER_SESSION_POLICY, ...policy };
    for (const value of Object.values(this.policy)) if (!Number.isSafeInteger(value) || value < 1) throw Error('Invalid session limits.');
    this.now = now; this.onEvent = onEvent; this.sessions = new Map(); this.restores = new WeakMap(); this.executions = new Map();
  }

  open(userId, conversationId) {
    if (![userId, conversationId].every(value => Number.isSafeInteger(value) && value > 0)) throw Error('Authenticated conversation required.');
    this.prune();
    const key = `${userId}:${conversationId}`;
    let session = this.sessions.get(key);
    if (!session) {
      while (this.sessions.size >= this.policy.maxSessions && this.evictOldest()) { /* discard only disposable idle caches */ }
      if (this.sessions.size >= this.policy.maxSessions) throw Error('Слишком много активных бесед. Попробуйте позже.');
      session = { id: randomUUID(), holders: new Set(), cached: null, bytes: 0, detachedAt: null, concurrent: false };
      this.sessions.set(key, session);
    }
    if (session.holders.size >= this.policy.maxAttachmentsPerSession) throw Error('Эта беседа уже открыта в нескольких вкладках. Закройте лишние.');
    const snapshot = session.holders.size === 0 && session.cached ? JSON.parse(session.cached) : null;
    if (session.holders.size) session.concurrent = true;
    session.cached = null; session.bytes = 0; session.detachedAt = null;
    const token = Symbol('conversation lease');
    session.holders.add(token);
    const lease = Object.freeze({ id: session.id, key, token, snapshot });
    this.onEvent('session.opened', { request_id: session.id, pending: session.holders.size });
    return lease;
  }

  confirmRestore(lease, accepted) {
    const session = this.sessions.get(lease?.key);
    if (!session || session.id !== lease.id || !session.holders.has(lease.token)) return;
    this.restores.set(lease, accepted === true);
    this.onEvent('session.restored', { request_id: session.id, reason: accepted ? 'warm_snapshot' : 'canonical_database' });
  }

  /** Foreground actor boundary: other conversations run in parallel; a second
   * tab cannot launch paid work into the same conversation while its first tab
   * is running. Same-transport replacement preserves the existing abort policy. */
  async execute(lease, action) {
    const session = this.sessions.get(lease?.key);
    if (!session || session.id !== lease.id || !session.holders.has(lease.token)) throw Error('Сначала восстановите беседу.');
    const runs = this.executions.get(lease.key) ?? new Map();
    if ([...runs.values()].some(owner => owner !== lease.token) || runs.size >= this.policy.maxPendingTurns) {
      this.onEvent('session.busy', { request_id: session.id, pending: runs.size });
      throw Error('В этой беседе ещё выполняется запрос. Дождитесь ответа или остановки в другой вкладке.');
    }
    const run = Symbol('foreground turn'); runs.set(run, lease.token); this.executions.set(lease.key, runs);
    try { return await action(); }
    finally { runs.delete(run); if (!runs.size && this.executions.get(lease.key) === runs) this.executions.delete(lease.key); }
  }

  release(lease, snapshot = null) {
    const session = this.sessions.get(lease?.key);
    if (!session || session.id !== lease.id || !session.holders.delete(lease.token)) return;
    if (session.holders.size) return;
    // Concurrent tabs retain independent builders. Read canonical DB history on
    // their next connection rather than guessing which tab's snapshot is newest.
    let json = null;
    if (snapshot && !session.concurrent) {
      try { json = JSON.stringify(snapshot); } catch { /* fall back to canonical DB restore */ }
    }
    const bytes = json ? Buffer.byteLength(json) : 0;
    if (!bytes || bytes > this.policy.maxSnapshotBytes) {
      this.sessions.delete(lease.key);
      this.onEvent('session.cache_skipped', { request_id: session.id, reason: session.concurrent ? 'concurrent_tabs' : 'unavailable_or_oversized' });
      return;
    }
    session.cached = json; session.bytes = bytes; session.detachedAt = this.now();
    this.onEvent('session.detached', { request_id: session.id, input_bytes: bytes, duration_ms: this.policy.idleGraceMs });
    this.prune();
  }

  evictOldest() {
    const oldest = [...this.sessions.entries()].filter(([, session]) => !session.holders.size).sort((a, b) => a[1].detachedAt - b[1].detachedAt)[0];
    if (!oldest) return false;
    this.sessions.delete(oldest[0]);
    this.onEvent('session.evicted', { request_id: oldest[1].id, reason: 'capacity' });
    return true;
  }

  prune() {
    for (const [key, session] of this.sessions) if (!session.holders.size && this.now() - session.detachedAt >= this.policy.idleGraceMs) {
      this.sessions.delete(key); this.onEvent('session.expired', { request_id: session.id });
    }
    while (this.stats().idleBytes > this.policy.maxIdleBytes && this.evictOldest()) { /* bounded retained payload */ }
  }

  stats() {
    const sessions = [...this.sessions.values()];
    return { sessions: sessions.length, active: sessions.filter(session => session.holders.size).length,
      idle: sessions.filter(session => !session.holders.size).length, idleBytes: sessions.reduce((sum, session) => sum + session.bytes, 0) };
  }

  describe(lease) {
    const session = this.sessions.get(lease?.key);
    return { id: lease?.id ?? null, scope: 'authenticated_conversation', idleGraceMs: this.policy.idleGraceMs,
      resumed: this.restores.get(lease) === true, active: Boolean(session?.holders.has(lease.token)),
      pendingTurns: this.executions.get(lease?.key)?.size ?? 0,
      limits: { maxIdleBytes: this.policy.maxIdleBytes, maxSnapshotBytes: this.policy.maxSnapshotBytes, maxSessions: this.policy.maxSessions,
        maxAttachmentsPerSession: this.policy.maxAttachmentsPerSession, maxPendingTurns: this.policy.maxPendingTurns } };
  }
}
