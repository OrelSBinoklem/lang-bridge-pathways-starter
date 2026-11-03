import { foldParameters, normalizedParameters, parameterChanges, stateEvent } from '../../../../resources/tutor-flow/journal.mjs';

// Laravel is authoritative. This object is disposable, scoped to one authenticated conversation.
export class DurableTutorContext {
  constructor({ conversationId, builder, api }) {
    if (!Number.isSafeInteger(conversationId) || conversationId < 1) throw new Error('Choose a conversation first.');
    this.conversationId = conversationId;
    this.builder = builder;
    this.api = (action, payload = {}) => api(action, { ...payload, conversation_id: conversationId });
    this.revision = null;
    this.savedThroughId = 0;
    this.afterId = 0;
    this.hasMore = false;
    this.writes = Promise.resolve();
    this.loading = null;
    this.resumedFromCache = false;
    builder.durable = true;
  }

  async load(options = {}) {
    if (this.loading) await this.loading;
    const loading = this.hydrate(options);
    this.loading = loading;
    try { return await loading; } finally { if (this.loading === loading) this.loading = null; }
  }

  async hydrate({ compress = async () => {}, isActive = () => true, initialOnly = false, resume = null } = {}) {
    await this.writes;
    const page = this.builder.currentPage;
    const pageVersion = this.builder.pageVersion;
    const lesson = this.builder.lessonContext;
    const lessonVersion = this.builder.lessonVersion;
    const iterations = this.builder.agentIterations;
    const compressionRuns = this.builder.compressionRuns;
    const notes = this.builder.importantNotes;
    const voice = this.builder.voiceProfile;
    this.builder.resetConversationContext();
    this.builder.agentIterations = iterations;
    this.builder.compressionRuns = compressionRuns;
    this.afterId = resume?.afterId ?? 0;
    let first = true;
    do {
      if (!isActive()) return;
      const result = await this.api('load', { after_id: this.afterId });
      if (!isActive()) return;
      if (first) {
        // This read always authenticates ownership in Laravel. A changed
        // checkpoint invalidates the optimization, not the canonical history.
        const cacheMatches = resume && result.revision === resume.revision && (result.state?.summary_through_id || 0) === resume.summaryThroughId;
        if (resume && !cacheMatches && this.afterId > 0) {
          resume = null; this.afterId = 0; continue;
        }
        const liveLesson = this.builder.lessonVersion !== lessonVersion ? this.builder.lessonContext : lesson;
        const hasLiveLesson = this.builder.lessonVersion > 0;
        this.revision = result.revision;
        this.savedThroughId = result.state?.summary_through_id || 0;
        this.builder.restoreCheckpoint(result.state);
        if (cacheMatches) { this.builder.messages = structuredClone(resume.messages); this.resumedFromCache = true; }
        this.builder.setCurrentPage(this.builder.pageVersion !== pageVersion ? this.builder.currentPage : page, { restored: true });
        if (hasLiveLesson) this.builder.setLessonContext(liveLesson, { restored: true });
        first = false;
      } else if (result.revision !== this.revision) {
        throw new Error('Беседа изменилась в другом окне. Повторите вопрос.');
      }
      for (const message of result.messages) {
        if (!this.builder.messages.some(existing => existing.id === message.id)) this.builder.messages.push({ ...message, metadata: message.metadata || {} });
        this.afterId = message.id;
      }
      this.hasMore = result.has_more;
      await compress();
      if (initialOnly) break;
    } while (first || this.hasMore);
    if (this.builder.parameterSnapshot !== null) {
      const latest = foldParameters(this.builder.parameterSnapshot, this.builder.messages);
      if (!page && !this.builder.currentPage && latest.page) this.builder.setCurrentPage(latest.page, { restored: true });
      if (this.builder.lessonVersion === 0 && latest.task !== undefined) this.builder.setLessonContext(latest.task, { restored: true });
      if (!this.builder.notesVersion && !notes.length && !this.builder.importantNotes.length && latest.notes) this.builder.importantNotes = latest.notes;
      this.builder.observedProgress = latest.progress || {};
      this.builder.voiceProfile = voice || latest.voice || null;
    } else this.builder.voiceProfile = voice;
  }

  /** Call only after pending writes settle. Payload contains no API/auth closure. */
  resumeSnapshot() {
    if (this.revision === null || this.builder.summaryThroughId !== this.savedThroughId) return null;
    return { revision: this.revision, summaryThroughId: this.savedThroughId, afterId: this.afterId,
      messages: this.builder.messages.filter(message => Number.isSafeInteger(message.id) && message.id <= this.afterId) };
  }

  async observeParameters(parameters = this.builder.currentParameters(), key) {
    if (this.loading) await this.loading;
    const observed = normalizedParameters(parameters);
    return this.enqueue(async () => {
      if (this.builder.parameterSnapshot === null) {
        this.builder.parameterSnapshot = observed;
        const result = await this.api('save', { revision: this.revision, state: this.builder.checkpoint() });
        this.revision = result.revision;
        return null;
      }
      const changes = parameterChanges(foldParameters(this.builder.parameterSnapshot, this.builder.messages), observed);
      if (!changes.length) return null;
      const event = stateEvent(changes);
      const result = await this.api('message', { role: event.role, text: event.text, client_key: key, metadata: event.metadata });
      if (!this.builder.messages.some(message => message.id === result.message_id)) this.builder.messages.push({ ...event, id: result.message_id, createdAt: new Date().toISOString() });
      return result.message_id;
    });
  }

  append(role, text, key, metadata = {}) {
    return this.enqueue(async () => {
      const result = await this.api('message', { role, text, client_key: key, metadata });
      if (!this.builder.messages.some(message => message.id === result.message_id)) {
        this.builder.messages.push({ id: result.message_id, role, text, metadata, createdAt: new Date().toISOString() });
      }
      return result.message_id;
    });
  }

  save() {
    return this.enqueue(async () => {
      const state = structuredClone(this.builder.checkpoint());
      const result = await this.api('save', { revision: this.revision, state });
      this.revision = result.revision;
      this.savedThroughId = state.summary_through_id || 0;
    });
  }

  enqueue(action) {
    const pending = this.writes.then(action);
    // Keep the queue usable, but propagate the failure to the caller (no hidden data loss).
    this.writes = pending.catch(() => {});
    return pending;
  }
}
