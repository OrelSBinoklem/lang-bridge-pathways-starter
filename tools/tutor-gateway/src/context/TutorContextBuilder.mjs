import { normalizedParameters, foldParameters, parameterChanges, stateEvent, userMessageCount, compactionPrefix } from '../../../../resources/tutor-flow/journal.mjs';

export class TutorContextBuilder {
  constructor({ maxRecentMessages = 10, maxStoredMessages = 40, contextWindowTokens = 128000 } = {}) {
    this.maxRecentMessages = maxRecentMessages;
    this.maxStoredMessages = maxStoredMessages;
    this.contextWindowTokens = contextWindowTokens;
    this.messages = [];
    this.toolInteractions = [];
    this.agentIterations = [];
    this.currentPage = null;
    this.pageVersion = 0;
    this.notesVersion = 0;
    this.contextSummary = '';
    this.importantNotes = [];
    this.lastCompression = null;
    this.compressionRuns = [];
    this.lessonContext = null;
    this.durable = false;
    this.summaryThroughId = 0;
    this.lessonVersion = 0;
    this.parameterSnapshot = null;
    this.observedProgress = {};
    this.voiceProfile = null;
  }

  setCurrentPage(pathname, { restored = false } = {}) {
    const value = String(pathname || '').trim();
    if (value) { this.currentPage = value; if (!restored) this.pageVersion++; }
  }

  /** Тема + текст текущего блока урока (письмо/говорение), id блока для команды зачёта, формат и текущий зачёт. */
  setLessonContext(payload, { restored = false } = {}) {
    if (!restored) this.lessonVersion++;
    if (!payload || typeof payload !== 'object') {
      this.lessonContext = null;
      return;
    }
    const topic = String(payload.topic || '').trim();
    const text = String(payload.text || '').trim();
    const instructions = String(payload.instructions || '').trim();
    const lessonBlockId = payload.lessonBlockId == null || payload.lessonBlockId === '' ? null : Number(payload.lessonBlockId);
    if (!topic && !text) {
      this.lessonContext = null;
      return;
    }
    this.lessonContext = {
      topic: topic.slice(0, 200),
      text: text.slice(0, 4000),
      instructions: instructions.slice(0, 4000),
      lessonBlockId: Number.isSafeInteger(lessonBlockId) && lessonBlockId > 0 ? lessonBlockId : null,
      format: payload.format === 'speaking' ? 'speaking' : 'writing',
      completed: Boolean(payload.completed),
    };
  }

  resetConversationContext() {
    this.messages = [];
    this.toolInteractions = [];
    this.agentIterations = [];
    this.contextSummary = '';
    this.lastCompression = null;
    this.compressionRuns = [];
    this.summaryThroughId = 0;
    this.lessonContext = null;
    this.parameterSnapshot = null;
    this.observedProgress = {};
    this.voiceProfile = null;
  }

  restoreCheckpoint(state = {}) {
    this.contextSummary = String(state?.summary || '');
    this.summaryThroughId = state?.summary_through_id || 0;
    this.setLessonContext(state?.lesson_context, { restored: true });
    this.toolInteractions = Array.isArray(state?.tool_interactions) ? state.tool_interactions.slice(-20) : [];
    this.lastCompression = state?.last_compression || null;
    this.parameterSnapshot = state?.journal_version === 1 ? normalizedParameters(state.parameter_snapshot || {}) : null;
  }

  checkpoint() {
    return {
      summary: this.contextSummary,
      summary_through_id: this.summaryThroughId,
      lesson_context: this.lessonContext,
      tool_interactions: this.toolInteractions.slice(-20).map(interaction => {
        const json = JSON.stringify(interaction);
        return json.length <= 2000 ? interaction : {
          command: interaction.command, source: interaction.source, createdAt: interaction.createdAt,
          result: { ok: interaction.result?.ok, preview: json.slice(0, 1500) },
        };
      }),
      last_compression: this.lastCompression,
      ...(this.parameterSnapshot !== null ? { journal_version: 1, parameter_snapshot: this.parameterSnapshot } : {}),
    };
  }

  currentParameters() {
    return normalizedParameters({ page: this.currentPage, task: this.lessonContext, notes: this.importantNotes,
      progress: this.observedProgress, voice: this.voiceProfile });
  }

  initializeJournal() {
    if (this.parameterSnapshot !== null) return false;
    this.parameterSnapshot = this.currentParameters();
    return true;
  }

  pendingParameterChanges() {
    if (this.parameterSnapshot === null) return [];
    return parameterChanges(foldParameters(this.parameterSnapshot, this.messages), this.currentParameters());
  }

  addStateEvent(changes) {
    const event = stateEvent(changes);
    this.addMessage(event.role, event.text, event.metadata);
    return event;
  }

  journalMessages() {
    return this.messages.map(({ id, role, text, metadata }) => ({ ...(id ? { id } : {}), role, text,
      ...(metadata?.kind === 'state_delta' ? { metadata } : {}) }));
  }

  journalCompressionMessages(options = {}) { return compactionPrefix(this.messages, options); }

  applyJournalSummary(summary, messages, metadata = {}) {
    const snapshot = foldParameters(this.parameterSnapshot || {}, messages);
    this.applyCompressedSummary(summary, { ...metadata, messagesCompressed: messages.length, journal: true });
    this.parameterSnapshot = snapshot;
  }

  setImportantNotes(notes = []) {
    this.notesVersion++;
    this.importantNotes = Array.isArray(notes)
      ? notes
          .map((note) => ({
            id: note?.id ?? null,
            category: String(note?.category || 'general'),
            key: String(note?.key || '').slice(0, 120),
            content: String(note?.content || '').slice(0, 600),
            importance: Number(note?.importance || 3),
            last_seen_at: note?.last_seen_at || null,
          }))
          .filter((note) => note.key && note.content)
          .slice(0, 8)
      : [];
  }

  addMessage(role, text, metadata = {}) {
    const normalizedText = String(text || '').trim();
    if (!normalizedText) return;

    this.messages.push({
      role,
      text: normalizedText,
      metadata,
      createdAt: new Date().toISOString(),
    });

    if (!this.durable && this.parameterSnapshot === null && this.messages.length > this.maxStoredMessages) {
      this.messages = this.messages.slice(-this.maxStoredMessages);
    }
  }

  addToolResult(command, result) {
    this.addMessage('tool', `${command}: ${result?.ok === false ? 'failed' : 'ok'}`, {
      command,
      result,
    });
  }

  addToolInteraction(interaction = {}) {
    const command = String(interaction.command || '').trim();
    if (!command) return;

    this.toolInteractions.push({
      command,
      params: interaction.params || {},
      result: interaction.result || null,
      source: interaction.source || 'unknown',
      createdAt: new Date().toISOString(),
    });

    if (this.toolInteractions.length > 20) {
      this.toolInteractions = this.toolInteractions.slice(-20);
    }
  }

  recentToolInteractions(limit = 10) {
    return this.toolInteractions.slice(-limit);
  }

  addAgentIteration(iteration = {}) {
    const createdAt = new Date().toISOString();
    this.agentIterations.push({
      id: `${createdAt}-${this.agentIterations.length}`,
      ...iteration,
      createdAt,
    });

    if (this.agentIterations.length > 30) {
      this.agentIterations = this.agentIterations.slice(-30);
    }
  }

  updateLastAgentIteration(patch = {}) {
    if (!this.agentIterations.length) return;
    this.agentIterations[this.agentIterations.length - 1] = {
      ...this.agentIterations[this.agentIterations.length - 1],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
  }

  recentAgentIterations(limit = 10) {
    return this.agentIterations.slice(-limit);
  }

  recentMessages(limit = this.maxRecentMessages) {
    if (this.durable) return this.messages;
    return this.messages.slice(-limit);
  }

  recentTextLines(limit = this.maxRecentMessages) {
    return this.recentMessages(limit).map((message) => `${message.role}: ${message.text}`);
  }

  messagesForCompression() {
    if (this.messages.length <= this.maxRecentMessages) return [];
    return this.messages.slice(0, -this.maxRecentMessages).slice(0, 20);
  }

  applyCompressedSummary(summary, metadata = {}) {
    const normalizedSummary = String(summary || '').trim();
    if (normalizedSummary) this.contextSummary = normalizedSummary.slice(0, 2400);
    const count = metadata.messagesCompressed ?? Math.max(0, this.messages.length - this.maxRecentMessages);
    this.summaryThroughId = this.messages[count - 1]?.id || this.summaryThroughId;
    this.messages = this.messages.slice(count);
    this.lastCompression = {
      ...metadata,
      compressedAt: new Date().toISOString(),
      summaryChars: this.contextSummary.length,
    };
    this.compressionRuns.push({
      id: this.lastCompression.compressedAt,
      model: this.lastCompression.model || null,
      usage: this.lastCompression.usage || null,
      ok: this.lastCompression.ok !== false,
      fallback: Boolean(this.lastCompression.fallback),
      createdAt: this.lastCompression.compressedAt,
    });
    if (this.compressionRuns.length > 10) {
      this.compressionRuns = this.compressionRuns.slice(-10);
    }
  }

  estimateContextStats({ prompt = '', routeGuide = '', tutorVoice = null, clientRecentContext = [] } = {}) {
    const gatewayRecentContext = this.recentTextLines();
    const fallbackContext = Array.isArray(clientRecentContext) ? clientRecentContext.slice(-this.maxRecentMessages) : [];
    const recentContext = !this.durable && fallbackContext.length > gatewayRecentContext.length ? fallbackContext : gatewayRecentContext;
    const lessonContext = this.lessonContext
      ? {
          topic: this.lessonContext.topic,
          text: this.lessonContext.text,
          instructions: this.lessonContext.instructions,
          lesson_block_id: this.lessonContext.lessonBlockId,
          format: this.lessonContext.format,
          completed: this.lessonContext.completed,
        }
      : null;
    const tokenEstimate = (chars) => Math.ceil(Number(chars || 0) / 4);
    const breakdown = [
      { key: 'system_rules', label: 'Правила тьютора', chars: String(prompt).length },
      {
        key: 'route_guide',
        label: 'Маршруты сайта',
        chars: `Available routes, stable route guide:\n${routeGuide}`.length,
      },
      {
        key: 'session_context',
        label: 'Страница и урок',
        chars: JSON.stringify({ tutor_voice: tutorVoice, current_page: this.currentPage, lesson_context: lessonContext }).length,
      },
      { key: 'summary', label: 'Сжатая история', chars: this.contextSummary.length },
      { key: 'memory', label: 'Важная память', chars: JSON.stringify(this.importantNotes).length },
      { key: 'messages', label: 'Последние сообщения', chars: JSON.stringify(recentContext).length },
      { key: 'tools', label: 'Результаты инструментов', chars: JSON.stringify(this.recentToolInteractions()).length },
      {
        key: 'request_format',
        label: 'Формат ответа и обвязка',
        chars: JSON.stringify({
          transcript: '',
          transcript_candidates: [],
          transcription_strategy: null,
          toolResult: null,
          responseFormat: {
            reply: 'string',
            speech_segments: [{ text: 'string', style: 'neutral_teacher | warm_encouragement | gentle_correction | calm_explanation | playful_practice' }],
            command: null,
          },
        }).length + 'Return JSON only. User transcript and optional tool result:\n'.length,
      },
    ].map((part) => ({
      ...part,
      tokens: tokenEstimate(part.chars),
    }));
    const estimatedTokens = breakdown.reduce((total, part) => total + part.tokens, 0);
    const chars = breakdown.reduce((total, part) => total + part.chars, 0);
    const fillPercent = Math.min(100, (estimatedTokens / this.contextWindowTokens) * 100);

    return {
      context_window_tokens: this.contextWindowTokens,
      estimated_tokens: estimatedTokens,
      fill_percent: Number(fillPercent.toFixed(2)),
      chars,
      breakdown,
      note: 'Оценка базового контекста следующего запроса. Текущий текст пользователя, результат tool-вызова и будущий ответ сюда не включены.',
      recent_messages: this.recentMessages().length,
      stored_messages: this.messages.length,
      tool_interactions: this.toolInteractions.length,
      agent_iterations: this.agentIterations.length,
      important_notes: this.importantNotes.length,
      summary_chars: this.contextSummary.length,
      last_compression: this.lastCompression,
      compression_runs: this.compressionRuns.slice(-10),
    };
  }

  build({ transcriptCandidates = [], transcriptionStrategy = null, clientRecentContext = [], excludeMessageId = null } = {}) {
    const messages = this.recentMessages().filter(message => !excludeMessageId || message.id !== excludeMessageId);
    const recentContext = messages.map(message => `${message.role}: ${message.text}`);
    const fallbackContext = Array.isArray(clientRecentContext) ? clientRecentContext.slice(-this.maxRecentMessages) : [];
    const useFallbackContext = !this.durable && fallbackContext.length > recentContext.length;

    return {
      currentPage: this.currentPage,
      lessonContext: this.lessonContext,
      contextSummary: this.contextSummary,
      importantNotes: this.importantNotes,
      recentContext: useFallbackContext ? fallbackContext : recentContext,
      recentContextSource: useFallbackContext ? 'browser' : 'gateway',
      recentMessages: messages,
      recentToolInteractions: this.recentToolInteractions(),
      parameterSnapshot: this.parameterSnapshot,
      messageStream: this.parameterSnapshot === null ? null : this.journalMessages(),
      userMessageCount: userMessageCount(this.messages),
      contextStats: this.estimateContextStats(),
      transcriptCandidates,
      transcriptionStrategy,
    };
  }

  buildTranscriptionHints(clientRecentContext = []) {
    const context = this.build({ clientRecentContext });
    const lines = [
      context.currentPage ? `current_page: ${context.currentPage}` : '',
      ...context.recentContext,
    ].filter(Boolean);

    return lines.slice(-this.maxRecentMessages);
  }
}
