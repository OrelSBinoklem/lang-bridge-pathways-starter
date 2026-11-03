import 'dotenv/config';
import { runtimePipelineSnapshot } from './flows/debug/RuntimeSnapshot.mjs';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { resolveTutorVoiceProfile, respondToTutorTurn } from './agent/tutorAgent.mjs';
import { buildTutorRules } from './agent/TutorRulesBuilder.mjs';
import { getAssistantRouteGuideText } from './commands/routes.mjs';
import { compressTutorContext } from './agent/contextCompressor.mjs';
import { synthesizeElevenLabsDialogue, synthesizeElevenLabsSpeech } from './audio/elevenlabs.mjs';
import { buildSpeechInstructions, synthesizeSpeech } from './audio/speech.mjs';
import { createEarlySpeech } from './audio/earlySpeech.mjs';
import { resolveTtsConfig } from './audio/ttsConfig.mjs';
import { streamSpeechToSocket } from './audio/streamSpeech.mjs';
import { transcribeAudio } from './audio/transcription.mjs';
import { assertStrictCommandResult, dispatchStructuredCommand } from './commands/dispatcher.mjs';
import { dispatchRegisteredCommand } from './commands/adapters/CommandAdapterRegistry.mjs';
import { ToolLoopController } from './agent/ToolLoopController.mjs';
import { TutorContextBuilder } from './context/TutorContextBuilder.mjs';
import { DurableTutorContext } from './context/DurableTutorContext.mjs';
import { MasterSessionRegistry } from './context/MasterSessionRegistry.mjs';
import { resolveTutorTurnConfig, tutorModel } from './agent/reasoning.mjs';
import { createBilling } from './billing.mjs';
import { tutorDiagnostics } from './diagnostics.mjs';
import { resolveClientPresetConfig, basicTutorContext, economyCommandAllowed, longMemoryCommand } from './presets.mjs';
import { siteCharacterVoice } from './agent/siteCharacterVoice.mjs';
import { flowSettings, flowCommandAllowed } from '../../../resources/tutor-flow/graph.mjs';
import { createFlowTestRunner } from './flows/flowTestRunner.mjs';
import { compactJournal } from './context/compactJournal.mjs';
import { TraceArchive } from './flows/debug/TraceArchive.mjs';
import { createTraceMonitor } from './flows/debug/TraceMonitor.mjs';
import { handleServiceCapture, serviceGraph, serviceNodeId } from './flows/debug/ServiceCapture.mjs';

const billing = createBilling();
globalThis.fetch = billing.fetch;
tutorDiagnostics.log('gateway.started',{ok:true});
if (billing.enabled) setInterval(() => billing.retryPending().catch(() => console.error('Credit settlement retry failed')), 30000).unref();

const host = process.env.TUTOR_GATEWAY_HOST || '127.0.0.1';
const port = Number(process.env.TUTOR_GATEWAY_PORT || 8788);
const pendingClientTools = new WeakMap();
const contextBuilders = new WeakMap();
const activeTurns = new WeakMap();
const pendingAudioRequests = new WeakMap();
const durableContexts = new WeakMap();
const conversationLoads = new WeakMap();
const conversationLeases = new WeakMap();
const masterSessions = new MasterSessionRegistry({ onEvent: (event, fields) => tutorDiagnostics.log(event, fields) });
setInterval(() => masterSessions.prune(), 30000).unref();
const creditSessions = new WeakMap();
const flowRunners = new WeakMap();
const traceArchive = new TraceArchive({ directory: process.env.TUTOR_TRACE_DIRECTORY || undefined, onChange: run => traceMonitor.changed(run), onError: () => tutorDiagnostics.log('debug.archive.failed', { ok: false }) });
traceArchive.ready.catch(() => tutorDiagnostics.log('debug.archive.unavailable', { ok: false }));
const traceMonitor = createTraceMonitor({ archive: traceArchive, authorized: ws => billing.enabled && billing.canConfigure(creditSessions.get(ws)), verify: ws => billing.verifyAdmin(creditSessions.get(ws)), send });
setInterval(() => traceArchive.ready.then(() => traceArchive.serialize(() => traceArchive.prune())).catch(() => tutorDiagnostics.log('debug.archive.failed', { ok: false })), 60000).unref();
setInterval(() => traceArchive.checkpoint().catch(() => tutorDiagnostics.log('debug.archive.failed', { ok: false })), 5000).unref();
setInterval(() => {
  for (const run of traceArchive.active.values()) if (run.botId !== 'tutor' && Date.now() - run.startedAt > 600000)
    void traceArchive.finish(run.id, Error('Сервис не завершил запись за 10 минут.')).catch(() => tutorDiagnostics.log('debug.archive.failed', { ok: false }));
}, 60000).unref();

async function clientTurnConfig(ws, config = {}, questionMode) {
  const selected = config.preset || (!billing.canConfigure(creditSessions.get(ws)) ? 'standard' : null);
  const settings = billing.enabled ? await billing.presets({ withProfiles: true }) : null;
  const definitions = settings?.presets;
  if (!selected) return { ...resolveTutorTurnConfig(config, questionMode), aiProfiles: settings?.profiles ?? {} };
  const catalog = definitions ? Object.fromEntries(Object.entries(definitions).map(([id, value]) => [id, value.config])) : undefined;
  return { ...resolveTutorTurnConfig(resolveClientPresetConfig(config, billing.canConfigure(creditSessions.get(ws)), catalog), questionMode), aiProfiles: settings?.profiles ?? {} };
}

async function compressWithTrace(ws, config, options) {
  let id = null, failure = null;
  let inspectionGraph;
  const diagnostic = () => tutorDiagnostics.log('debug.archive.failed', { ok: false });
  try {
    const result = await compressTutorContext({ ...options, profile: config.aiProfiles?.dialogue_summary,
      onRequest: async body => {
        const userId = billing.identity(creditSessions.get(ws));
        try {
          inspectionGraph = config.aiProfiles?.dialogue_summary?._workflowGraph ?? serviceGraph('dialogue_summary', body);
          id = await traceArchive.begin({ userId, botId: 'dialogue_summary', conversationId: durableContexts.get(ws)?.conversationId ?? null,
            graph: inspectionGraph, model: body.model, event: { type: 'service.request' } });
          if (id) {
            traceArchive.append(id, { nodeId: serviceNodeId(inspectionGraph, 'dialogue_summary', 'prompt'), type: 'prompt', status: 'completed', outputPreview: JSON.stringify(body.input.filter(item => item.role === 'developer')) });
            traceArchive.append(id, { nodeId: serviceNodeId(inspectionGraph, 'dialogue_summary', 'source'), type: 'source', status: 'completed', outputPreview: JSON.stringify(body.input.filter(item => item.role !== 'developer')) });
            traceArchive.append(id, { nodeId: serviceNodeId(inspectionGraph, 'dialogue_summary', 'model'), type: 'model_request', status: 'running', inputPreview: JSON.stringify(body) });
          }
        } catch { diagnostic(); }
      },
      onResponse: async (payload, status) => {
        if (status >= 400 || ['incomplete', 'failed'].includes(payload.status)) failure = Error(`Provider status ${status}: ${payload.status ?? 'error'}`);
        if (id) traceArchive.append(id, { nodeId: serviceNodeId(inspectionGraph, 'dialogue_summary', 'model'), type: 'model_response', status: failure ? 'failed' : 'completed', outputPreview: JSON.stringify(payload), usage: payload.usage });
        if (id && !failure) traceArchive.append(id, { nodeId: serviceNodeId(inspectionGraph, 'dialogue_summary', 'reply'), type: 'reply', status: 'completed', outputPreview: JSON.stringify(payload.output_text ?? payload.output) });
      },
    });
    if (!result.ok) failure = Error('Сервис сжатия не смог получить пригодное резюме.');
    return result;
  } catch (error) { failure = error; throw error; }
  finally { if (id) await traceArchive.finish(id, failure).catch(diagnostic); }
}

function resolveContextSummaryModel(config = {}) {
  const configured = config.contextSummaryModel || process.env.OPENAI_CONTEXT_SUMMARY_MODEL || 'gpt-6-luna';
  if (configured === 'same_as_tutor') {
    return config.tutorModel || process.env.OPENAI_TUTOR_MODEL || 'gpt-5.4';
  }
  return configured;
}

function send(ws, payload) {
  if(payload.type==='assistant.message')tutorDiagnostics.log('turn.reply',{output_chars:String(payload.text||'').length,model:payload.metadata?.model,ok:true});
  if(payload.type==='tutor.thinking')tutorDiagnostics.log('turn.thinking',{phase:payload.status});
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function detachConversation(ws) {
  const lease = conversationLeases.get(ws), durable = durableContexts.get(ws);
  conversationLeases.delete(ws);
  if (!lease) return;
  let released = false;
  const finish = snapshot => { if (released) return; released = true; clearTimeout(timer); masterSessions.release(lease, snapshot); };
  // Do not retain transports or wait forever for an old write. Missing snapshots
  // simply take the normal authorized DB path on the next connection.
  const timer = setTimeout(() => finish(null), 3000);
  timer.unref();
  void Promise.resolve(durable?.writes).then(() => finish(durable?.resumeSnapshot() ?? null)).catch(() => {
    tutorDiagnostics.log('session.cache_failed', { ok: false }); finish(null);
  });
}

function withConversation(ws, action) {
  return billing.enabled ? masterSessions.execute(conversationLeases.get(ws), action) : action();
}

function reportTurnError(ws, error) {
  tutorDiagnostics.log('turn.failed',{error_type:error?.name||'Error',status_code:error?.status});
  send(ws, { type: 'error', message: error instanceof Error ? error.message : 'TutorAgent failed.' });
  if (error.status === 401) ws.close(4401, 'Session expired');
}

function emitCommandResult(ws, clientId, result, { announce = true } = {}) {
  assertStrictCommandResult(result);
  send(ws, result);

  if (announce) {
    send(ws, {
      type: 'assistant.message',
      text: result.message,
    });
  }

  if (result.ok && result.action) {
    if (result.action.emitUiCommand !== false) {
      send(ws, {
        type: 'ui.command',
        commandId: result.commandId,
        action: result.action,
      });
    }
    console.log(`[${clientId}] ${result.command} -> ${result.action.to || result.action.type}`);
  }
}

function waitForClientTool(ws, commandId, timeoutMs = 12000, signal) {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const pending = pendingClientTools.get(ws);
    const abort = () => { clearTimeout(timeout); pending?.delete(commandId); reject(signal.reason); };
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      pending?.delete(commandId);
      resolve({
        ok: false,
        commandId,
        error: {
          code: 'tool_timeout',
          message: 'Client-side tool did not return a result in time.',
        },
      });
    }, timeoutMs);

    pending?.set(commandId, (payload) => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      resolve(payload);
    });
    signal?.addEventListener('abort', abort, { once: true });
  });
}

function createDebugSnapshot(ws, config = {}, clientRecentContext = []) {
  const builder = contextBuilders.get(ws);
  const prompt = buildTutorRules();
  const routeGuide = getAssistantRouteGuideText();
  const context = builder?.build({ clientRecentContext }) || {};
  const tutorVoice = resolveTutorVoiceProfile(siteCharacterVoice(config, context.lessonContext));
  const recentAgentIterations = builder?.recentAgentIterations(10) || [];
  const promptCacheStats = recentAgentIterations
    .map((iteration) => iteration?.model_response?.metadata?.promptCache)
    .filter(Boolean)
    .at(-1) || null;
  const promptCacheByIteration = recentAgentIterations.map((iteration, index) => ({
    index,
    step: iteration?.turn?.step ?? index,
    model: iteration?.model_response?.metadata?.model || iteration?.model_config?.tutorModel || null,
    command: iteration?.model_response?.command?.name || null,
    input_tokens: iteration?.model_response?.metadata?.promptCache?.input_tokens ?? null,
    cached_input_tokens: iteration?.model_response?.metadata?.promptCache?.cached_input_tokens ?? null,
    cached_input_percent: iteration?.model_response?.metadata?.promptCache?.cached_input_percent ?? null,
    latency_ms: iteration?.model_response?.metadata?.latencyMs ?? null,
  }));
  return {
    type: 'debug.snapshot',
    ok: true,
    masterSession: masterSessions.describe(conversationLeases.get(ws)),
    capturedAt: new Date().toISOString(),
    currentPage: context.currentPage || null,
    lessonContext: context.lessonContext || null,
    tutorVoice,
    contextSummary: context.contextSummary || '',
    importantNotes: context.importantNotes || [],
    contextStats: builder?.estimateContextStats({ prompt, routeGuide, tutorVoice, clientRecentContext }) || null,
    promptBuilder: {
      source: 'TutorRulesBuilder.buildTutorRules()',
      text: prompt,
    },
    routeGuide,
    recentContext: context.recentContext || [],
    recentContextSource: context.recentContextSource || 'gateway',
    recentMcpInteractions: builder?.recentToolInteractions(10) || [],
    recentAgentIterations,
    promptCacheStats,
    promptCacheByIteration,
  };
}

async function maybeCompressContext(builder, config = {}, clientId = '', durable = null, isActive = () => true, ws = null) {
  if (!builder || config.contextCompressionEnabled === false) return;
  while (builder.messagesForCompression().length >= 20 && isActive()) {
    const messages = builder.messagesForCompression();
    const model = resolveContextSummaryModel(config);
    const result = await compressWithTrace(ws, config, { previousSummary: builder.contextSummary, messages, model });
    if (!isActive()) return;
    if (!result.ok || !result.summary.trim()) throw new Error('Не удалось обновить резюме беседы. История сохранена; попробуйте позже.');
    const compression = {
      ok: result.ok, model, messagesCompressed: messages.length, ...(result.metadata || {}),
    };
    if (builder.parameterSnapshot !== null) builder.applyJournalSummary(result.summary, messages, compression);
    else builder.applyCompressedSummary(result.summary, compression);
    if (durable) await durable.save();
    console.log(`[${clientId}] context compressed ${messages.length} messages via ${model}`);
  }
}

function observeState(ws) {
  const builder = contextBuilders.get(ws), durable = durableContexts.get(ws);
  if (!builder || builder.parameterSnapshot === null || !durable || durable.hasMore) return;
  if (durable.loading) { durable.loading.then(() => { if (contextBuilders.get(ws) === builder) observeState(ws); }).catch(error => reportTurnError(ws, error)); return; }
  const parameters = builder.currentParameters();
  durable.observeParameters(parameters, `state:${randomUUID()}`).catch(error => reportTurnError(ws, error));
}

async function executeAgentCommand(ws, clientId, agentResult, signal) {
  const commandResult = dispatchRegisteredCommand(
    agentResult.command.name,
    agentResult.command.params || {},
    { signal, metadata: { input: 'tutor.agent', requested_by_model: true } },
    { dispatch: dispatchStructuredCommand },
  );
  contextBuilders.get(ws)?.addToolInteraction({
    command: agentResult.command.name,
    params: agentResult.command.params || {},
    result: commandResult,
    source: 'tutor.agent',
  });

  emitCommandResult(ws, clientId, commandResult, { announce: false });

  if (!commandResult.ok || !commandResult.action || commandResult.action.emitUiCommand === false) {
    return commandResult;
  }

  const toolResult = await waitForClientTool(ws, commandResult.commandId,
    agentResult.command.name === 'web.reference' ? 45000 : 12000, signal);
  contextBuilders.get(ws)?.addToolInteraction({
    command: agentResult.command.name,
    params: agentResult.command.params || {},
    result: toolResult,
    source: 'client.tool_result',
  });
  const builder = contextBuilders.get(ws);
  if (!builder?.durable) builder?.addToolResult(agentResult.command.name, toolResult);
  return {
    ...commandResult,
    clientToolResult: toolResult,
  };
}

function resolveTtsProvider(config = {}) {
  if (config.ttsModel) return resolveTtsConfig(config).provider;
  return String(config.ttsProvider || process.env.TUTOR_TTS_PROVIDER || 'openai').toLowerCase() === 'elevenlabs'
    ? 'elevenlabs'
    : 'openai';
}

function isElevenLabsDialogueEnabled(config = {}) {
  if (resolveTtsProvider(config) === 'elevenlabs') return true;
  return config.elevenLabsDialogueEnabled === true || String(process.env.ELEVENLABS_DIALOGUE_ENABLED || '').toLowerCase() === 'true';
}

function resolveElevenLabsVoiceIds(config = {}) {
  const tutor = config.elevenLabsVoiceId || process.env.ELEVENLABS_TTS_VOICE_ID || '';
  return {
    tutor,
    dialogue_a: config.elevenLabsDialogueVoiceAId || process.env.ELEVENLABS_DIALOGUE_VOICE_A_ID || tutor,
    dialogue_b: config.elevenLabsDialogueVoiceBId || process.env.ELEVENLABS_DIALOGUE_VOICE_B_ID || tutor,
  };
}

async function synthesizeAssistantSegment(segment, config = {}, signal) {
  if (resolveTtsProvider(config) === 'elevenlabs') {
    const voiceIds = resolveElevenLabsVoiceIds(config);
    return synthesizeElevenLabsSpeech({
      text: segment.text,
      voiceId: voiceIds[segment.speaker] || voiceIds.tutor,
      model: config.elevenLabsModel || process.env.ELEVENLABS_TTS_MODEL || 'eleven_v3',
      languageCode: config.elevenLabsLanguage || process.env.ELEVENLABS_TTS_LANGUAGE || '',
      signal,
    });
  }

  const speech = resolveTtsConfig(config);
  return synthesizeSpeech({
    text: segment.text,
    model: speech.model,
    voice: speech.voice,
    instructions: buildSpeechInstructions(segment.style),
    signal,
  });
}

async function speakAssistantSegment(ws, segment, config = {}, segmentIndex = 0, segmentCount = 1, signal, streaming = false) {
  if (resolveTtsProvider(config) === 'google') {
    const speech = resolveTtsConfig(config);
    return streamSpeechToSocket({ ws, segment, model: speech.model, voice: speech.voice,
      playbackId: config.playbackId, segmentIndex, segmentCount, signal });
  }
  const result = await synthesizeAssistantSegment(segment, config, signal);
  if (signal?.aborted) return false;

  send(ws, {
    type: 'tts.audio',
    playbackId: config.playbackId ?? null,
    ok: result.ok,
    audio: result.ok ? result.audio : '',
    mimeType: result.ok ? result.mimeType : null,
    error: result.ok ? null : result.error,
    metadata: {
      ...(result.metadata || {}),
      segmentIndex,
      segmentCount,
      segmentStyle: segment.style || 'neutral_teacher',
      speaker: segment.speaker || 'tutor',
      segmentText: segment.text,
      ttsStartMode: config.ttsStartMode || 'first_sentence',
      streaming,
    },
  });
  return result.ok;
}

function splitFirstSentence(text) {
  const value = String(text || '').trim();
  if (!value) return { first: '', rest: '' };

  const match = value.match(/^([\s\S]{18,}?[.!?…]+)(?:\s+|$)([\s\S]*)$/u);
  if (!match) return { first: value, rest: '' };

  return {
    first: match[1].trim(),
    rest: String(match[2] || '').trim(),
  };
}

function prepareSpeechSegmentsForTts(segments, config = {}) {
  const speechSegments = Array.isArray(segments) && segments.length
    ? segments
    : [{ text: String(segments || ''), style: 'neutral_teacher' }];

  if ((config.ttsStartMode || 'first_sentence') !== 'first_sentence' || speechSegments.length !== 1) {
    return speechSegments;
  }

  const segment = speechSegments[0];
  const { first, rest } = splitFirstSentence(segment.text);
  if (!first || !rest) return speechSegments;

  return [
    { ...segment, text: first },
    { ...segment, text: rest },
  ];
}

async function speakAssistantReply(ws, segments, config = {}, signal) {
  const speechSegments = prepareSpeechSegmentsForTts(segments, config);

  const hasTwoDialogueSpeakers = new Set(
    speechSegments
      .map((segment) => segment?.speaker)
      .filter((speaker) => speaker === 'dialogue_a' || speaker === 'dialogue_b'),
  ).size === 2;

  if (isElevenLabsDialogueEnabled(config) && hasTwoDialogueSpeakers) {
    const result = await synthesizeElevenLabsDialogue({
      segments: speechSegments,
      voiceIds: resolveElevenLabsVoiceIds(config),
      model: config.elevenLabsDialogueModel || process.env.ELEVENLABS_DIALOGUE_MODEL || 'eleven_v3',
      languageCode: config.elevenLabsLanguage || process.env.ELEVENLABS_TTS_LANGUAGE || '',
      signal,
    });
    if (signal?.aborted) return;
    send(ws, {
      type: 'tts.audio',
      playbackId: config.playbackId ?? null,
      ok: result.ok,
      audio: result.ok ? result.audio : '',
      mimeType: result.ok ? result.mimeType : null,
      error: result.ok ? null : result.error,
      metadata: {
        ...(result.metadata || {}),
        dialogue: true,
        segmentIndex: 0,
        segmentCount: speechSegments.length,
        ttsStartMode: config.ttsStartMode || 'first_sentence',
      },
    });
    return;
  }

  for (let index = 0; index < speechSegments.length; index += 1) {
    if (signal?.aborted) return;
    const ok = await speakAssistantSegment(ws, speechSegments[index], config, index, speechSegments.length, signal);
    if (!ok) return;
  }
}

async function runTutorAgent(ws, clientId, text, config = {}, context = {}) {
  // Snapshot the active immutable version once; publishing cannot switch a turn midway through a tool loop.
  const pendingRequest = pendingAudioRequests.get(ws);
  const runtimeFlow = await billing.flow();
  if (ws.readyState !== ws.OPEN || pendingAudioRequests.get(ws) !== pendingRequest) return;
  const plan = runtimeFlow ? flowSettings(runtimeFlow.graph, config) : null;
  const userId = billing.identity(creditSessions.get(ws));
  const built = contextBuilders.get(ws)?.build() ?? {};
  const effectiveConfig = siteCharacterVoice(plan ? resolveTutorTurnConfig(plan.config, config.complexQuestion ? 'complex' : undefined) : config, built.lessonContext);
  const sources = { recent_context: built.recentContext ?? [], context_summary: built.contextSummary ?? '', important_notes: built.importantNotes ?? [],
    lesson_context: built.lessonContext ?? null, current_page: built.currentPage ?? null, recent_tool_interactions: built.recentToolInteractions ?? [],
    message_stream: built.messageStream ?? [], parameter_state: built.parameterSnapshot ?? {},
    transcript_candidates: context.transcriptCandidates ?? [], runtime_pipeline: { ...runtimePipelineSnapshot(config, context), masterSession: masterSessions.describe(conversationLeases.get(ws)) } };
  let recording = null;
  try { recording = await traceArchive.begin({ userId, conversationId: context.conversationId, graph: runtimeFlow?.graph ?? null,
    versionId: runtimeFlow?.version_id ?? null, preset: config.preset, model: effectiveConfig.tutorModel,
    event: { type: context.sourceType || 'user.message', transcript: text, current_page: built.currentPage }, sources }); }
  catch { tutorDiagnostics.log('debug.archive.unavailable', { ok: false }); }
  let failure = null;
  if (recording && context.transcriptCandidates?.length) traceArchive.append(recording, { nodeId: '@recognition', type: 'recognition', status: 'completed',
    outputPreview: JSON.stringify({ candidates: context.transcriptCandidates, strategy: context.transcriptionStrategy, primary: config.primaryTranscriptionModel, secondary: config.dualTranscriptionEnabled ? config.secondaryTranscriptionModel : null }) });
  try {
    return await billing.withPreset(config.preset, () => runTutorAgentWithPreset(ws, clientId, text, effectiveConfig, { ...context, runtimeFlow, flowPlan: plan, recording }));
  } catch (error) { failure = error; throw error; }
  finally {
    if (!failure && (ws.readyState !== ws.OPEN || pendingAudioRequests.get(ws) !== pendingRequest)) failure = Error('Запрос прерван или заменён новым.');
    if (recording) await traceArchive.finish(recording, failure).catch(() => tutorDiagnostics.log('debug.archive.failed', { ok: false }));
  }
}

async function runTutorAgentWithPreset(ws, clientId, text, config = {}, context = {}) {
  config = { ...config, playbackId: context.playbackId ?? null };
  tutorDiagnostics.log('turn.start',{model:config.tutorModel,secondary_model:config.secondaryTranscriptionModel,voice:config.ttsVoice,playback_id:config.playbackId,preset:config.preset,reasoning_enabled:config.reasoningEnabled===true,reasoning_effort:config.reasoningEffort,turn_mode:config.complexQuestion?'complex':'standard',text_chars:String(text||'').length,dual:config.dualTranscriptionEnabled===true});
  const basic = config.contextMode === 'basic';
  const flow = context.runtimeFlow || null;
  const plan = context.flowPlan || null;
  const maxSteps = plan?.policy.maxSteps || 6;
  const speechEnabled = plan?.speech !== false;
  const flowRunId = randomUUID();
  const flowTrace = event => {
    // Contents stay on the authenticated admin's own socket; operational files receive metadata only.
    if (billing.enabled && billing.canConfigure(creditSessions.get(ws))) send(ws, { type: 'flow.trace', runId: flowRunId, versionId: flow?.version_id, events: [event] });
    tutorDiagnostics.log('flow.node', { phase: event.type, status: event.status, duration_ms: event.durationMs || 0 });
  };
  activeTurns.get(ws)?.abort();
  const turn = new AbortController();
  activeTurns.set(ws, turn);
  const isActive = () => !turn.signal.aborted && ws.readyState === ws.OPEN && activeTurns.get(ws) === turn;
  const reportSpeechError = (error) => {
    console.error(`[${clientId}] early speech failed: ${error.message}`);
    if (!isActive() || error.reported) return;
    send(ws, { type: 'tts.audio', playbackId: config.playbackId, ok: false, audio: '', mimeType: null,
      error: { code: 'early_tts_failed', message: error.message }, metadata: { streaming: true } });
  };
  let earlySpeech = null;
  send(ws, {
    type: 'tutor.thinking',
    status: 'started',
  });

  const builder = contextBuilders.get(ws);
  const durable = durableContexts.get(ws);
  if (billing.enabled && (!durable || durable.conversationId !== context.conversationId)) {
    throw new Error('Дождитесь восстановления беседы перед отправкой вопроса.');
  }
  const turnKey = config.playbackId || randomUUID();
  const journalEnabled = Boolean(flow?.graph.nodes.some(node => node.type === 'compact' || node.type === 'source' && node.data.source === 'message_stream'));
  // The graph's compaction node owns summarization. Hydrate the archive first; never
  // run the old record-count compressor as a hidden side effect of this graph.
  if (durable && journalEnabled) await durable.load({ isActive });
  if (!isActive()) return;
  if (journalEnabled && builder) {
    builder.voiceProfile = resolveTutorVoiceProfile(config);
    if (durable) await durable.observeParameters(builder.currentParameters(), `state:${randomUUID()}`);
    else { builder.initializeJournal(); const changes = builder.pendingParameterChanges(); if (changes.length) builder.addStateEvent(changes); }
  }
  const inputMessageId = durable
    ? await durable.append('user', text, `${turnKey}:user`, { transcriptCandidates: context.transcriptCandidates || [], longMemoryEnabled: config.longMemoryEnabled === true, embeddingModel: config.messageEmbeddingModel || 'text-embedding-3-large' }) : null;
  if (!isActive()) return;
  if (durable) await durable.load({
    isActive,
    compress: () => journalEnabled ? Promise.resolve() : maybeCompressContext(builder, config, clientId, durable, isActive, ws),
  });
  else if (!journalEnabled) await maybeCompressContext(builder, config, clientId, null, isActive, ws);
  if (!durable && journalEnabled) builder?.addMessage('user', text, { transcriptCandidates: context.transcriptCandidates || [] });
  if (!isActive()) return;
  const buildContext = () => {
    const built = builder?.build({
    transcriptCandidates: context.transcriptCandidates || [],
    transcriptionStrategy: context.transcriptionStrategy || null,
    clientRecentContext: context.recentContext || [],
    excludeMessageId: inputMessageId,
    }) || context;
    return basic && !journalEnabled ? basicTutorContext(built) : built;
  };
  let builtContext = buildContext();

  let toolResult = null;
  let agentResult = null;
  let referenceCalls = 0;
  let loopReason = 'completed';
  const loop = new ToolLoopController({ maxSteps, ...(plan?.policy.loop || {}), nodeId: flow?.graph.nodes.find(node => node.type === 'tools')?.id || '@tools',
    onEvent: event => { flowTrace(event); if (context.recording) traceArchive.append(context.recording, event); } });
  const stopLoop = reason => {
    loopReason = reason || 'stopped'; earlySpeech?.cancel();
    const message = ({ timeout: 'Поиск занял слишком много времени. Уточните запрос — найденные данные и история сохранены.', no_progress: 'Повторный поиск не дал новых данных. Уточните, что именно нужно найти.', max_cost: 'Достигнут заданный порог расходов API. Поиск остановлен.', cost_unavailable: 'Стоимость последнего вызова ещё не подтверждена. Повторный поиск остановлен.', max_steps: 'Не удалось завершить проверку за допустимое число шагов. Уточните запрос.' })[loopReason] || 'Поиск остановлен до завершения. Уточните запрос.';
    agentResult = { ok: false, command: null, speechSegments: [], reply: message, metadata: { ...(agentResult?.metadata || {}), error: `tool_loop_${loopReason}` } };
  };
  try { await billing.withUsageObserver(usage => loop.recordCost(usage.known ? usage.costUsd : null), async () => {
  for (let step = 0; step < maxSteps; step += 1) {
    if (!isActive()) return;
    const decision = loop.beforeModel(step, { signal: turn.signal });
    if (!decision.ok) { stopLoop(decision.reason); break; }
    if (journalEnabled && durable) await durable.observeParameters(builder.currentParameters(), `state:${randomUUID()}`);
    builtContext = buildContext();
    builder?.addAgentIteration({
      turn: {
        transcript: text,
        step,
      },
      model_config: {
        tutorModel: config.tutorModel || process.env.OPENAI_TUTOR_MODEL || 'gpt-5.4',
        reasoningEnabled: Boolean(config.reasoningEnabled),
        reasoningEffort: config.reasoningEffort || 'none',
      },
      context_sent: {
        current_page: builtContext.currentPage || null,
        lesson_context: builtContext.lessonContext || null,
        context_summary: builtContext.contextSummary || '',
        important_notes: builtContext.importantNotes || [],
        recent_context_source: builtContext.recentContextSource || 'gateway',
        recent_context: builtContext.recentContext || [],
        recent_tool_interactions: builtContext.recentToolInteractions || [],
        transcript_candidates: builtContext.transcriptCandidates || [],
        transcription_strategy: builtContext.transcriptionStrategy || null,
        tool_result_from_previous_iteration: toolResult,
      },
    });
    earlySpeech?.cancel();
    const canSpeakEarly = speechEnabled && config.ttsMode !== 'browser' && config.tutorPipeline === 'stt_text_tts' &&
      (config.ttsStartMode || 'first_sentence') === 'first_sentence';
    earlySpeech = canSpeakEarly ? createEarlySpeech({
      isActive,
      onError: reportSpeechError,
      speak: async (segment, index, signal) => {
        const ok = await speakAssistantSegment(ws, segment, config, index, null, signal, true);
        if (!ok && !signal.aborted) {
          const error = new Error('TTS failed for a streamed sentence.');
          error.reported = true;
          throw error;
        }
      },
    }) : null;
    const iterationSpeech = earlySpeech;
    if (iterationSpeech) turn.signal.addEventListener('abort', () => iterationSpeech.cancel(), { once: true });
    const iterationStartedAt = Date.now();
    try {
      agentResult = await respondToTutorTurn({
        transcript: text,
        transcriptCandidates: builtContext.transcriptCandidates || [],
        transcriptionStrategy: builtContext.transcriptionStrategy || null,
        recentContext: builtContext.recentContext || [],
        importantNotes: builtContext.importantNotes || [],
        contextSummary: builtContext.contextSummary || '',
        currentPage: builtContext.currentPage || null,
        lessonContext: builtContext.lessonContext || null,
        recentToolInteractions: builtContext.recentToolInteractions || [],
        messageStream: builtContext.messageStream,
        parameterSnapshot: builtContext.parameterSnapshot,
        conversationKey: durable ? `conversation_${durable.conversationId}` : null,
        runFlowCompact: journalEnabled ? async ({ keepPairs }, input, execution = {}) => {
          if (config.contextCompressionEnabled === false) throw new Error('Сжатие выключено в настройках репетитора. Переписка сохранена.');
          if (input?.parts.message_stream && JSON.stringify(input.parts.message_stream) !== JSON.stringify(builder.journalMessages())) throw new Error('Входящий журнал изменился. Повторите запрос; история сохранена.');
          const result = await compactJournal(builder, { keepPairs, durable, model: resolveContextSummaryModel(config), signal: execution.signal || turn.signal, isActive, compress: options => compressWithTrace(ws, config, options) });
          const refreshed = buildContext();
          return { compaction: result, context_summary: refreshed.contextSummary, parameter_state: refreshed.parameterSnapshot,
            message_stream: refreshed.messageStream, user_message_count: refreshed.userMessageCount,
            recent_context: refreshed.recentContext, important_notes: refreshed.importantNotes, lesson_context: refreshed.lessonContext,
            current_page: refreshed.currentPage, recent_tool_interactions: refreshed.recentToolInteractions,
            transcript_candidates: refreshed.transcriptCandidates };
        } : null,
        config,
        toolResult,
        flow,
        flowRecovery: flow?.graph.engine === 'langgraph' && durable && billing.identity(creditSessions.get(ws))
          ? { owner: `conversation:${billing.identity(creditSessions.get(ws))}:${durable.conversationId}` } : null,
        flowEvent: toolResult ? 'tool.result' : context.sourceType || 'user.message',
        onFlowEvent: flow ? flowTrace : null,
        onFlowData: context.recording ? event => traceArchive.append(context.recording, event) : null,
        onModelRequest: body => {
          if (flow && billing.enabled && billing.canConfigure(creditSessions.get(ws))) builder?.updateLastAgentIteration({ actual_model_request: body,
            context_sent: { request_body: body, flow_version_id: flow.version_id } });
          if (context.recording && !flow) traceArchive.append(context.recording, { nodeId: '@model', type: 'model_request', status: 'running', inputPreview: JSON.stringify(body) });
        },
        signal: loop.signal,
        onSpeechPrefix: iterationSpeech ? (segments) => {
          if (!isActive()) return;
          // Keep ElevenLabs multi-speaker dialogue in its existing single-request path.
          if (isElevenLabsDialogueEnabled(config) && segments.some((segment) =>
            segment?.speaker === 'dialogue_a' || segment?.speaker === 'dialogue_b')) return;
          iterationSpeech.update(segments);
        } : null,
      });
    } catch (error) {
      iterationSpeech?.cancel();
      if (!isActive()) return;
      send(ws, { type: 'tutor.thinking', status: 'finished', metadata: { error: 'response_stream_failed' } });
      throw error;
    }
    if (!isActive()) return;
    if (!billing.enabled) loop.recordCost(null);
    if (!agentResult.ok || agentResult.command?.name) iterationSpeech?.cancel();
    if (agentResult.metadata && iterationSpeech?.firstRequestAt !== null && iterationSpeech?.firstRequestAt !== undefined) {
      agentResult.metadata.earlySpeech = {
        firstTtsRequestMs: iterationSpeech.firstRequestAt - iterationStartedAt,
        modelCompletedMs: Date.now() - iterationStartedAt,
      };
    }

    builder?.updateLastAgentIteration({
      model_response: {
        ok: Boolean(agentResult?.ok),
        reply: agentResult?.reply || '',
        command: agentResult?.command || null,
        speech_segments: agentResult?.speechSegments || [],
        metadata: agentResult?.metadata || {},
      },
    });
    if (context.recording) traceArchive.append(context.recording, { nodeId: flow?.graph.nodes.find(n => n.type === 'model')?.id ?? '@model', type: 'model_usage', status: agentResult.ok ? 'completed' : 'failed',
      outputPreview: JSON.stringify({ reply: agentResult.reply, command: agentResult.command, metadata: agentResult.metadata }), usage: agentResult.metadata?.usage });

    if (agentResult.command?.name && ((plan && !flowCommandAllowed(plan.policy, agentResult.command.name)) || (basic && !economyCommandAllowed(agentResult.command.name)) || (config.longMemoryEnabled === false && longMemoryCommand(agentResult.command.name)))) {
      toolResult = { ok: false, error: { code: 'preset_disabled', message: 'This preset disables this command. Summaries and important notes remain available; answer using them and the recent conversation.' } };
      if (step < maxSteps - 1) continue;
      agentResult = { ...agentResult, command: null, speechSegments: [], reply: 'Эта возможность отключена в выбранном режиме. Выберите другой режим, чтобы включить её.' };
    }
    if (!agentResult.command?.name) break;
    if (step === maxSteps - 1) {
      earlySpeech?.cancel();
      agentResult = { ...agentResult, ok: false, command: null, speechSegments: [],
        reply: 'Не удалось завершить проверку за допустимое число шагов. Уточните одно слово или правило.',
        metadata: { ...agentResult.metadata, error: 'tool_budget_exhausted' } };
      loopReason = 'max_steps';
      break;
    }
    if (agentResult.command.name === 'web.reference' && ++referenceCalls > 3) {
      toolResult = { ok: false, error: { code: 'reference_budget_exhausted', message: 'Three reference lookups have already been used. Give a final answer preserving any uncertainty.' } };
      continue;
    }
    const commandDecision = loop.beforeCommand(agentResult.command);
    if (!commandDecision.ok) { stopLoop(commandDecision.reason); break; }
    if (durable) await durable.append('tool', JSON.stringify({ command: agentResult.command, status: 'requested' }), `${turnKey}:tool:${step}:requested`);
    if (!isActive()) return;
    if (context.recording) traceArchive.append(context.recording, { nodeId: flow?.graph.nodes.find(n => n.type === 'tools')?.id ?? '@tools', type: 'tool_queue', status: 'running', inputPreview: JSON.stringify(agentResult.command) });
    toolResult = await executeAgentCommand(ws, clientId, agentResult, loop.signal);
    loop.afterCommand(agentResult.command, toolResult);
    if (context.recording) traceArchive.append(context.recording, { nodeId: flow?.graph.nodes.find(n => n.type === 'tools')?.id ?? '@tools', type: 'tool_queue', status: toolResult.ok ? 'completed' : 'failed', outputPreview: JSON.stringify(toolResult) });
    if (flow) flowTrace({ nodeId: flow.graph.nodes.find(n => n.type === 'tools').id, type: 'tools', status: toolResult.ok ? 'completed' : 'failed',
      at: new Date().toISOString(), outputPreview: JSON.stringify(toolResult).slice(0, 3000) });
    if (!isActive()) return;
    if (durable) {
      await durable.append('tool', JSON.stringify({ command: agentResult.command, result: toolResult }).slice(0, 100000), `${turnKey}:tool:${step}`);
      await durable.save();
    }
    builder?.updateLastAgentIteration({
      tool_result: toolResult,
    });
  }
  }); } catch (error) {
    if (loop.signal.aborted && !turn.signal.aborted && isActive()) stopLoop(loop.finish('timeout').reason);
    else { loopReason = turn.signal.aborted ? 'aborted' : 'failed'; throw error; }
  } finally {
    const observation = loop.finish(isActive() ? loopReason : 'aborted');
    if (agentResult) agentResult.metadata = { ...(agentResult.metadata || {}), toolLoop: observation };
  }
  if (!isActive()) return;

  if (!agentResult) {
    agentResult = {
      ok: false,
      reply: 'TutorAgent не вернул ответ.',
      speechSegments: [{ text: 'TutorAgent не вернул ответ.', style: 'calm_explanation' }],
      metadata: { error: 'empty_agent_result' },
    };
  }

  send(ws, {
    type: 'tutor.thinking',
    status: 'finished',
    metadata: agentResult.metadata || {},
  });

  if (durable) {
    await durable.append('assistant', agentResult.reply, `${turnKey}:assistant`, {
      model: agentResult.metadata?.model || null, speechSegments: agentResult.speechSegments || [],
      longMemoryEnabled: config.longMemoryEnabled === true, embeddingModel: config.messageEmbeddingModel || 'text-embedding-3-large',
    });
    await durable.save();
  }
  if (!isActive()) return;
  send(ws, {
    type: 'assistant.message',
    text: agentResult.reply,
    metadata: {
      ...(agentResult.metadata || {}),
      speechSegments: agentResult.speechSegments || [],
      persisted: Boolean(durable),
      playbackId: config.playbackId, browserSpeech: speechEnabled && config.ttsMode === 'browser',
    },
  });
  const delivered = { nodeId: flow?.graph.nodes.find(node => node.type === 'reply')?.id || '@reply', type: 'reply_delivery', status: 'completed', at: new Date().toISOString(), outputPreview: JSON.stringify({ reply: agentResult.reply, toolLoop: agentResult.metadata?.toolLoop, transport: 'websocket_queue' }) };
  flowTrace(delivered); if (context.recording) traceArchive.append(context.recording, delivered);
  if (!durable && !journalEnabled) builder?.addMessage('user', text, {
    transcriptCandidates: context.transcriptCandidates || [],
  });
  if (!durable) builder?.addMessage('assistant', agentResult.reply, {
    speechSegments: agentResult.speechSegments || [],
    model: agentResult.metadata?.model || null,
  });
  if (journalEnabled && durable) await durable.observeParameters(builder.currentParameters(), `state:${randomUUID()}`);

  if (flow && billing.enabled && billing.canConfigure(creditSessions.get(ws))) send(ws, { type: 'flow.trace', runId: flowRunId, versionId: flow.version_id, events: [], done: true, reply: agentResult.reply });
  if (loopReason === 'completed' && speechEnabled && config.ttsMode !== 'browser' && config.tutorPipeline === 'stt_text_tts') {
    const segments = agentResult.speechSegments?.length
      ? agentResult.speechSegments : [{ text: agentResult.reply, style: 'neutral_teacher', speaker: 'tutor' }];
    const speechNode = flow?.graph.nodes.find(n => n.type === 'speech')?.id ?? '@speech';
    if (context.recording) traceArchive.append(context.recording, { nodeId: speechNode, type: 'speech_queue', status: 'running', inputPreview: JSON.stringify({ segments, model: config.ttsModel, voice: config.ttsVoice }) });
    let speechFailed = false;
    if (agentResult.ok && earlySpeech?.started && !agentResult.command?.name) {
      earlySpeech.finish(segments);
      await earlySpeech.done;
    } else {
      earlySpeech?.cancel();
      const speechJob = speakAssistantReply(ws, segments, config, turn.signal).catch((error) => {
        speechFailed = true;
        if (!isActive()) return;
        send(ws, {
          type: 'tts.audio',
          playbackId: config.playbackId,
          ok: false,
          audio: '',
          mimeType: null,
          error: {
            code: 'tts_exception',
            message: error instanceof Error ? error.message : 'Unknown TTS error.',
          },
          metadata: {},
        });
      });
      if (context.recording) await speechJob;
    }
    if (context.recording) traceArchive.append(context.recording, { nodeId: speechNode, type: 'speech_queue', status: speechFailed ? 'failed' : 'completed', outputPreview: JSON.stringify({ audioStored: false, model: config.ttsModel }) });
  }

  console.log(`[${clientId}] tutor reply via ${agentResult.metadata?.model || 'unknown model'}`);
}

async function handleUserAudio(ws, clientId, message, request) {
  const config = await clientTurnConfig(ws, message.config || {}, message.questionMode);
  return billing.withPreset(config.preset, () => handleUserAudioWithPreset(ws, clientId, message, request, config));
}

async function handleUserAudioWithPreset(ws, clientId, message, request, config) {
  if (pendingAudioRequests.get(ws) !== request || ws.readyState !== ws.OPEN) return;
  const model = config.transcriptionModel || process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-transcribe';
  if (model === 'browser-speech') throw new Error('Браузерное распознавание должно отправлять текст. Платная обработка аудио не запускалась.');
  const contextMessages = contextBuilders.get(ws)?.buildTranscriptionHints(message.recentContext) ||
    (Array.isArray(message.recentContext) ? message.recentContext : []);
  const primaryLanguage = config.primaryTranscriptionLanguage || '';
  const secondaryLanguage = config.secondaryTranscriptionLanguage || '';
  const dualEnabled = Boolean(config.dualTranscriptionEnabled);
  const secondaryModel = config.secondaryTranscriptionModel || model;

  const primaryRequest = {
    audio: message.audio,
    mimeType: message.mimeType,
    model,
    language: primaryLanguage,
    contextMessages,
  };
  const requests = [
    transcribeAudio(primaryRequest),
    ...(dualEnabled
      ? [
          transcribeAudio({
            audio: message.audio,
            mimeType: message.mimeType,
            model: secondaryModel,
            language: secondaryLanguage,
            contextMessages,
          }),
        ]
      : []),
  ];
  const [primaryResult, secondaryResult] = await Promise.all(requests);
  if (pendingAudioRequests.get(ws) !== request || ws.readyState !== ws.OPEN) return;
  const candidates = [
    {
      id: 'primary',
      priority: 1,
      model,
      language: primaryLanguage || 'auto',
      ok: primaryResult.ok,
      text: primaryResult.ok ? String(primaryResult.text || '').trim() : '',
      error: primaryResult.ok ? null : primaryResult.error,
      metadata: primaryResult.metadata || {},
    },
    ...(dualEnabled
      ? [
          {
            id: 'secondary',
            priority: 2,
            model: secondaryModel,
            language: secondaryLanguage || 'auto',
            ok: secondaryResult?.ok,
            text: secondaryResult?.ok ? String(secondaryResult.text || '').trim() : '',
            error: secondaryResult?.ok ? null : secondaryResult?.error,
            metadata: secondaryResult?.metadata || {},
          },
        ]
      : []),
  ];
  const transcriptionStrategy = {
    mode: dualEnabled ? 'dual' : 'single',
    primary: {
      model,
      language_hint: primaryLanguage || 'auto',
      prompt_profile: primaryLanguage === 'lv' ? 'latvian_priority' : primaryLanguage === 'ru' ? 'russian_priority' : 'mixed_auto',
    },
    secondary: dualEnabled
      ? {
          model: secondaryModel,
          language_hint: secondaryLanguage || 'auto',
          prompt_profile: secondaryLanguage === 'lv' ? 'latvian_priority' : secondaryLanguage === 'ru' ? 'russian_priority' : 'mixed_auto',
        }
      : null,
  };
  const result = primaryResult.ok && String(primaryResult.text || '').trim()
    ? primaryResult
    : secondaryResult?.ok && String(secondaryResult.text || '').trim()
      ? secondaryResult
      : primaryResult;

  send(ws, {
    type: 'transcription.result',
    ok: result.ok,
    text: result.ok ? result.text : '',
    error: result.ok ? null : result.error,
    metadata: {
      ...(result.metadata || {}),
      mimeType: message.mimeType,
      sizeBytes: message.sizeBytes,
      dualTranscriptionEnabled: dualEnabled,
      candidates,
      transcriptionStrategy,
    },
  });

  const transcript = result.ok ? String(result.text || '').trim() : '';
  if (transcript) {
    console.log(`[${clientId}] transcribed ${transcript.length} chars via ${result.metadata?.model || model}`);
    await runTutorAgent(ws, clientId, transcript, config, {
      transcriptCandidates: candidates,
      transcriptionStrategy,
      recentContext: contextMessages,
      playbackId: safePlaybackId(message.playbackId),
      conversationId: message.conversationId,
      sourceType: 'user.audio',
      recognitionSettings: { transcriptionModel: model, primaryTranscriptionLanguage: primaryLanguage, dualTranscriptionEnabled: dualEnabled, secondaryTranscriptionModel: secondaryModel, secondaryTranscriptionLanguage: secondaryLanguage },
      audioMetadata: { mimeType: message.mimeType, sizeBytes: message.sizeBytes },
    });
    return;
  }

  console.log(`[${clientId}] transcription failed`, result.error || {});
}

const server = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/internal/debug/capture') {
    void handleServiceCapture(req, res, { archive: traceArchive, secret: process.env.CREDITS_GATEWAY_SECRET }).catch(() => { if (!res.headersSent) res.writeHead(500); res.end(); });
    return;
  }
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'tutor-gateway' }));
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'not_found' }));
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 10 * 1024 * 1024 });

function safePlaybackId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value) ? value : null;
}

wss.on('connection', (ws) => {
  let creditSession = null;
  let unsubscribeCredits = () => {};
  let authenticating = false;
  let alive = true;
  ws.on('pong', () => { alive = true; });
  const heartbeat = setInterval(() => {
    if (!alive) { ws.terminate(); return; }
    alive = false;
    ws.ping();
  }, 30000);
  heartbeat.unref();
  const authTimeout = billing.enabled ? setTimeout(() => { if (!creditSession) ws.close(4401, 'Authentication required'); }, 15000) : null;
  const clientId = randomUUID();
  tutorDiagnostics.log('connection.open',{connection_id:clientId,authenticated:!billing.enabled});
  ws.on('error',error=>tutorDiagnostics.log('connection.failed',{connection_id:clientId,error_type:error.name}));
  pendingClientTools.set(ws, new Map());
  contextBuilders.set(ws, new TutorContextBuilder({ maxRecentMessages: 10, maxStoredMessages: 80 }));
  flowRunners.set(ws, createFlowTestRunner({
    send: payload => send(ws, payload), respond: respondToTutorTurn,
    authorize: () => billing.enabled && billing.canConfigure(creditSession),
    owner: () => billing.identity(creditSession),
    resolveConfig: (preset = 'standard') => clientTurnConfig(ws, { preset }),
  }));
  console.log(`[${clientId}] connected`);
  const ready = () => send(ws, {
    type: 'session.ready',
    clientId,
    tutorModel: tutorModel(),
    capabilities: [
      'command.result.v1',
      'commands.list',
      'commands.describe',
      'web.sources',
      'web.reference',
      'routes.list',
      'navigate',
      'memory.get',
      'learning.context',
      'learning.category_vocabulary',
      'site.menu.describe',
      'site.menu.activate',
      'verb.search.open',
      'verb.form.highlight',
      'memory.search_history',
      'memory.notes.search',
      'history.get_around_message',
      'memory.save_difficult_word',
      'memory.note.save',
      'memory.save_progress_estimate',
      'grammar.tables.list',
      'grammar.table.get_structure',
      'grammar.table.doc',
      'grammar.table.highlight',
      'grammar.table.get_content',
      'grammar.table.get_hint',
      'grammar.lesson.present',
      'audio.transcribe',
      'tts.audio',
      'tts.stream.pcm_s16le',
      'tts.cancel',
      'pending.client_tools',
      'context_builder.v1',
      ...(billing.enabled ? ['context.persistence.v1'] : []),
    ],
    routeRegistryAvailable: true,
    assistantInstructions: 'Tool discovery трехуровневый: краткий каталог уже есть в prompt; commands.list дает текущий список команд; commands.describe дает полные params одной команды. Если имен команд недостаточно, сначала посмотри описания и только потом действуй. Используй routes.list, когда нужны route params. Для таблиц грамматики используй grammar.tables.list и grammar.table.get_structure перед grammar.table.highlight или grammar.lesson.present, чтобы не выдумывать targets.',
  });

  if (!billing.enabled) ready();
  ws.on('message', (raw) => tutorDiagnostics.run({connection_id:clientId,trace_id:randomUUID()},()=>billing.run(creditSession, () => {
    if (billing.enabled && !creditSession) {
      let auth;
      try { auth = JSON.parse(raw.toString()); } catch { ws.close(4401, 'Authentication required'); return; }
      if (auth.type !== 'session.authenticate' || authenticating || typeof auth.ticket !== 'string') return;
      authenticating = true;
      billing.authenticate(auth.ticket).then((session) => {
        if (ws.readyState !== WebSocket.OPEN) { billing.forget(session); return; }
        unsubscribeCredits = billing.subscribe(session, () => send(ws, { type: 'credits.changed' }));
        creditSession = session; creditSessions.set(ws, session); clearTimeout(authTimeout); ready();
        tutorDiagnostics.log('connection.authenticated',{authenticated:true});
      }).catch(() => { send(ws, { type: 'error', message: 'Не удалось войти в голосового бота. Откройте его заново.' }); ws.close(4401, 'Authentication failed'); });
      return;
    }
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      runTutorAgent(ws, clientId, raw.toString()).catch((error) => {
        reportTurnError(ws, error);
      });
      return;
    }

    if (message.type === 'debug.monitor') {
      void traceMonitor.handle(ws, message);
      return;
    }
    if (message.type === 'flow.test') {
      flowRunners.get(ws).run(message).catch(error => reportTurnError(ws, error));
      return;
    }
    if (message.type === 'flow.prompt_manifest') {
      void flowRunners.get(ws).inspectPrompt(message);
      return;
    }
    if (message.type === 'flow.cancel') {
      flowRunners.get(ws).cancel();
      return;
    }

    if (message.type === 'user.message') {
      tutorDiagnostics.log('client.request',{message_type:message.type,text_chars:String(message.text||'').length});
      const request = {};
      pendingAudioRequests.set(ws, request);
      contextBuilders.get(ws)?.setCurrentPage(message.currentPage);
      Promise.resolve(conversationLoads.get(ws)).then(() => withConversation(ws, async () => {
        const config = await clientTurnConfig(ws, message.config || {}, message.questionMode);
        if (pendingAudioRequests.get(ws) !== request || ws.readyState !== ws.OPEN) return;
        return runTutorAgent(ws, clientId, message.text, config, {
        recentContext: Array.isArray(message.recentContext) ? message.recentContext : [],
        playbackId: safePlaybackId(message.playbackId),
        conversationId: message.conversationId,
      }); })).catch((error) => {
        if (pendingAudioRequests.get(ws) !== request) return;
        reportTurnError(ws, error);
      });
      return;
    }
    if (message.type === 'user.audio') {
      tutorDiagnostics.log('client.request',{message_type:message.type,audio_bytes:Number(message.sizeBytes)||0,duration_ms:Number(message.durationMs)||0});
      activeTurns.get(ws)?.abort();
      const request = Symbol('audio request');
      pendingAudioRequests.set(ws, request);
      contextBuilders.get(ws)?.setCurrentPage(message.currentPage);
      Promise.resolve(conversationLoads.get(ws)).then(() => withConversation(ws, () => {
        if (billing.enabled && durableContexts.get(ws)?.conversationId !== message.conversationId) throw new Error('Дождитесь восстановления беседы.');
        return handleUserAudio(ws, clientId, message, request);
      })).catch((error) => {
        if (pendingAudioRequests.get(ws) !== request) return;
        send(ws, {
          type: 'transcription.result',
          ok: false,
          text: '',
          error: {
            code: 'transcription_exception',
            message: error instanceof Error ? error.message : 'Unknown transcription error.',
          },
          metadata: {},
        });
      });
      return;
    }
    if (message.type === 'tts.cancel') {
      tutorDiagnostics.log('client.cancel',{cancelled:true});
      activeTurns.get(ws)?.abort();
      pendingAudioRequests.delete(ws);
      return;
    }
    if (message.type === 'mcp.command') {
      if (!billing.canConfigure(creditSession)) { send(ws, { type: 'error', message: 'Ручные команды доступны только администратору.' }); return; }
      const result = dispatchStructuredCommand(message.command, message.params || {}, { input: 'mcp.command' });
      contextBuilders.get(ws)?.addToolInteraction({
        command: message.command,
        params: message.params || {},
        result,
        source: 'manual.mcp.command',
      });
      emitCommandResult(ws, clientId, result);
      return;
    }
    if (message.type === 'debug.snapshot') {
      if (!billing.enabled || !billing.canConfigure(creditSession)) { send(ws, { type: 'error', message: 'Отладка доступна только администраторам.' }); return; }
      try {
        send(ws, createDebugSnapshot(
          ws,
          message.config || {},
          Array.isArray(message.recentContext) ? message.recentContext : [],
        ));
      } catch (error) {
        console.error(`[${clientId}] debug snapshot failed`, error);
        send(ws, {
          type: 'debug.snapshot',
          ok: false,
          error: {
            message: error instanceof Error ? error.message : 'debug snapshot failed',
          },
        });
      }
      return;
    }
    if (message.type === 'client.event') {
      if (message.event === 'page.changed') {
        contextBuilders.get(ws)?.setCurrentPage(message.payload?.pathname);
        observeState(ws);
      }
      if (message.event === 'lesson.context') {
        contextBuilders.get(ws)?.setLessonContext(message.payload || null);
        observeState(ws);
      }
      if (message.event === 'conversation.changed') {
        activeTurns.get(ws)?.abort();
        pendingAudioRequests.delete(ws);
        detachConversation(ws);
        const builder = new TutorContextBuilder({ maxRecentMessages: 10, maxStoredMessages: 80 });
        contextBuilders.set(ws, builder);
        durableContexts.delete(ws);
        builder.setCurrentPage(message.payload?.pathname);
        if (billing.enabled) {
          const load = Promise.resolve().then(async () => {
            if (contextBuilders.get(ws) !== builder || ws.readyState !== WebSocket.OPEN) return;
            const lease = masterSessions.open(billing.identity(creditSession), message.payload?.conversation_id);
            conversationLeases.set(ws, lease);
            const durable = new DurableTutorContext({
              conversationId: message.payload?.conversation_id, builder, api: billing.context,
            });
            await durable.load({ initialOnly: true, resume: lease.snapshot, isActive: () => contextBuilders.get(ws) === builder && ws.readyState === WebSocket.OPEN });
            if (contextBuilders.get(ws) !== builder || ws.readyState !== WebSocket.OPEN) return;
            masterSessions.confirmRestore(lease, durable.resumedFromCache);
            durableContexts.set(ws, durable);
            send(ws, { type: 'conversation.ready', conversationId: durable.conversationId, masterSession: masterSessions.describe(lease) });
          });
          conversationLoads.set(ws, load);
          load.catch((error) => {
            if (contextBuilders.get(ws) !== builder) return;
            reportTurnError(ws, error);
            if (ws.readyState === WebSocket.OPEN) ws.close(1011, 'Context load failed');
          });
        }
      }
      if (message.event === 'memory.updated') {
        contextBuilders.get(ws)?.setImportantNotes(message.payload?.important_notes || []);
        observeState(ws);
      }
      if (message.event === 'tool.result' && message.payload?.commandId) {
        const pending = pendingClientTools.get(ws);
        const resolve = pending?.get(message.payload.commandId);
        if (resolve) {
          pending.delete(message.payload.commandId);
          resolve(message.payload);
        }
      }
      console.log(`[${clientId}] client.event`, message.event);
      return;
    }
    send(ws, { type: 'error', message: `Unsupported message type: ${message.type || 'unknown'}` });
  })));

  ws.on('close', (code) => {
    traceMonitor.close(ws);
    tutorDiagnostics.log('connection.closed',{connection_id:clientId,close_code:code,cancelled:Boolean(activeTurns.get(ws))});
    detachConversation(ws);
    billing.forget(creditSession);
    creditSessions.delete(ws);
    flowRunners.get(ws)?.cancel();
    flowRunners.delete(ws);
    unsubscribeCredits();
    clearTimeout(authTimeout);
    clearInterval(heartbeat);
    activeTurns.get(ws)?.abort();
    activeTurns.delete(ws);
    pendingAudioRequests.delete(ws);
    pendingClientTools.delete(ws);
    contextBuilders.delete(ws);
    durableContexts.delete(ws);
    conversationLoads.delete(ws);
    console.log(`[${clientId}] disconnected`);
  });
});

server.listen(port, host, () => {
  console.log(`Tutor gateway listening on ws://${host}:${port}/ws`);
});
