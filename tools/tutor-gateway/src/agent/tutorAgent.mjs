import { tutorDeveloperMessages, flowCommandInstruction, TUTOR_RESPONSE_FORMAT } from './TutorPromptEnvelope.mjs';
import { reasoningRequest, resolveTutorTurnConfig } from './reasoning.mjs';
import { readTutorResponseStream } from './streaming.mjs';
import { tutorPromptCache } from './promptCache.mjs';
import { resolveTtsConfig, ttsCatalog } from '../audio/ttsConfig.mjs';
import { flowSettings } from '../../../../resources/tutor-flow/graph.mjs';
import { flowExecutionService } from '../flows/runtime/FlowExecutionService.mjs';
import { orderedPrompt } from '../context/orderedPrompt.mjs';
import { userMessageCount } from '../../../../resources/tutor-flow/journal.mjs';
import { basicTutorContext } from '../presets.mjs';
import { modelContextBlocks } from '../../../../resources/tutor-flow/assembly.mjs';
import { createMcpFlowRunner } from '../flows/mcp/McpFlowRunner.mjs';
import { runRegisteredMcp } from '../commands/adapters/CommandAdapterRegistry.mjs';

const runFlowMcp = createMcpFlowRunner();

const voiceGenderByName = {
  onyx: 'male',
  echo: 'male',
  ash: 'male',
  ballad: 'male',
  verse: 'male',
  cedar: 'male',
  alloy: 'neutral',
  fable: 'neutral',
  sage: 'neutral',
  marin: 'female',
  nova: 'female',
  shimmer: 'female',
  coral: 'female',
};

export function resolveTutorVoiceProfile(config = {}) {
  if (config.ttsMode === 'browser') return { voice: 'browser', gender: 'neutral', russian_self_reference: 'avoid gendered self-reference when possible' };
  const { voice, provider } = resolveTtsConfig(config);
  const gender = (provider === 'google' ? ttsCatalog.geminiVoiceGenders[voice] : voiceGenderByName[voice]) || 'neutral';
  return {
    voice,
    gender,
    russian_self_reference:
      gender === 'male'
        ? 'masculine'
        : gender === 'female'
          ? 'feminine'
          : 'avoid gendered self-reference when possible',
  };
}

export function tutorModelPacket(inputPacket, config) {
  const packet = { ...inputPacket, parts: { ...inputPacket.parts } };
  if (config.contextMode === 'basic') {
    const limited = basicTutorContext({ recentContext: packet.parts.recent_context || [], messageStream: packet.parts.message_stream,
      recentToolInteractions: packet.parts.recent_tool_interactions || [] });
    for (const [key, value] of [['recent_context', limited.recentContext], ['message_stream', limited.messageStream], ['recent_tool_interactions', limited.recentToolInteractions]]) {
      if (Object.hasOwn(packet.parts, key)) packet.parts[key] = value;
    }
    if (packet.blocks) packet.blocks = packet.blocks.map(block => block.kind === 'source' ? { ...block, value: packet.parts[block.source] } : block);
  }
  return packet;
}

function extractText(response) {
  if (typeof response.output_text === 'string') return response.output_text;
  const chunks = [];
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === 'string') chunks.push(content.text);
    }
  }
  return chunks.join('\n');
}

function normalizeSpokenText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/[“”«»"]/g, '')
    .trim()
    .toLocaleLowerCase();
}

function speechSegmentsMatchReply(reply, speechSegments) {
  if (!reply || !speechSegments.length) return false;
  const spokenText = speechSegments.map((segment) => segment.text).join(' ');
  return normalizeSpokenText(spokenText) === normalizeSpokenText(reply);
}

/**
 * Every top-level `{...}` in the text, parsed. The model sometimes emits the answer twice in a row
 * (`{...} {...}`), which JSON.parse rejects as a whole; strings are skipped so braces inside a reply
 * do not confuse the scan.
 */
function extractJsonObjects(text) {
  const objects = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
    } else if (depth > 0 && char === '"') {
      inString = true;
    } else if (char === '{') {
      if (depth === 0) start = index;
      depth += 1;
    } else if (char === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0) {
        try {
          objects.push(JSON.parse(text.slice(start, index + 1)));
        } catch {
          // A broken fragment is skipped; the other objects may still be fine.
        }
      }
    }
  }
  return objects;
}

/**
 * One object is used as is. For a repeated answer the later object wins, but an empty reply or a
 * missing command is filled in from the earlier ones, so `{reply:"", command} {reply:"...", command}`
 * keeps both the wording and the command.
 */
function mergeAgentObjects(objects) {
  if (objects.length === 1) return objects[0];
  const withCommand = (item) => item?.command && typeof item.command === 'object' && item.command.name;
  const withReply = (item) => typeof item?.reply === 'string' && item.reply.trim();
  const replyItem = [...objects].reverse().find(withReply);
  const commandItem = [...objects].reverse().find(withCommand);
  const last = objects[objects.length - 1];
  return {
    ...last,
    reply: replyItem ? replyItem.reply : '',
    speech_segments: replyItem ? replyItem.speech_segments : last.speech_segments,
    command: commandItem ? commandItem.command : last.command,
  };
}

function normalizeAgentJson(text) {
  try {
    const objects = extractJsonObjects(String(text || ''));
    if (!objects.length) throw new Error('no_json_object');
    const parsed = mergeAgentObjects(objects);
    const speechSegments = Array.isArray(parsed.speech_segments)
      ? parsed.speech_segments
          .map((segment) => ({
            text: typeof segment?.text === 'string' ? segment.text.trim() : '',
            style: typeof segment?.style === 'string' ? segment.style : 'neutral_teacher',
            speaker: ['tutor', 'dialogue_a', 'dialogue_b'].includes(segment?.speaker) ? segment.speaker : 'tutor',
          }))
          .filter((segment) => segment.text)
      : [];
    const reply = typeof parsed.reply === 'string' ? parsed.reply : '';
    return {
      reply,
      speechSegments: speechSegmentsMatchReply(reply, speechSegments) ? speechSegments : [],
      command: parsed.command && typeof parsed.command === 'object' ? parsed.command : null,
      raw: parsed,
    };
  } catch {
    // Text that looks like JSON but could not be read is never shown to the student as is.
    const looksLikeJson = /^\s*[{[]/.test(String(text || ''));
    return {
      reply: text && !looksLikeJson ? text : 'Я услышал, но пока не смог разобрать ответ модели.',
      speechSegments: [],
      command: null,
      raw: looksLikeJson ? { unparsed: String(text).slice(0, 2000) } : null,
    };
  }
}

function calculatePromptCacheStats(usage = null) {
  const inputTokens = Number(usage?.input_tokens || 0);
  const cachedTokens = Number(usage?.input_tokens_details?.cached_tokens || 0);
  const cachedInputPercent = inputTokens > 0 ? Number(((cachedTokens / inputTokens) * 100).toFixed(2)) : 0;

  return {
    input_tokens: inputTokens,
    cached_input_tokens: cachedTokens,
    cached_input_percent: cachedInputPercent,
  };
}

/** Pure request assembly shared by actual calls and free administrative previews. */
export function buildTutorModelRequest({ transcript, transcriptCandidates = [], transcriptionStrategy = null, recentContext = [],
  importantNotes = [], contextSummary = '', currentPage = null, lessonContext = null, recentToolInteractions = [],
  messageStream = null, parameterSnapshot = null, contextBlocks = null, conversationKey = null, config = {}, toolResult = null,
  flowInstructions = [], flowOutputLimit = null } = {}) {
  const model = config.tutorModel || process.env.OPENAI_TUTOR_MODEL || 'gpt-5.4';
  const tutorVoice = resolveTutorVoiceProfile(config);
  const inputPayload = {
    tutor_voice: tutorVoice,
    important_notes: importantNotes,
    context_summary: contextSummary,
    lesson_context: lessonContext
      ? {
          topic: lessonContext.topic,
          text: lessonContext.text,
          instructions: lessonContext.instructions,
          lesson_block_id: lessonContext.lessonBlockId,
          format: lessonContext.format,
          completed: lessonContext.completed,
        }
      : null,
    recent_context: recentContext,
    recent_tool_interactions: recentToolInteractions,
    current_page: currentPage,
    transcript,
    transcript_candidates: transcriptCandidates,
    transcription_strategy: transcriptionStrategy,
    toolResult,
    responseFormat: TUTOR_RESPONSE_FORMAT,
  };

  const body = {
    model,
    ...tutorPromptCache(model),
    prompt_cache_key: process.env.OPENAI_TUTOR_PROMPT_CACHE_KEY || 'lbpw-tutor-agent-v1',
    input: [
      ...tutorDeveloperMessages(config, flowInstructions),
      {
        role: 'user',
        content: `Return JSON only. User transcript and optional tool result:\n${JSON.stringify(inputPayload)}`,
      },
    ],
    text: {
      format: {
        type: 'json_object',
      },
    },
    max_output_tokens: 700,
  };

  const reasoning = reasoningRequest(config, model);
  if (reasoning.reasoning) body.reasoning = reasoning.reasoning;
  if (messageStream !== null || contextBlocks !== null) {
    Object.assign(body, orderedPrompt({ developers: body.input.slice(0, -1), summary: contextSummary,
      parameters: parameterSnapshot || {}, messages: messageStream, model, cacheKey: conversationKey,
      configurationUpdate: reasoning.update, blocks: contextBlocks,
      request: { transcript, transcript_candidates: transcriptCandidates, transcription_strategy: transcriptionStrategy, toolResult },
      responseFormat: inputPayload.responseFormat }));
  } else if (reasoning.update) body.input.splice(2, 0, reasoning.update);
  body.max_output_tokens = reasoning.maxOutputTokens;
  if (flowOutputLimit) body.max_output_tokens = Math.min(body.max_output_tokens, flowOutputLimit);

  return { body, reasoning, model };
}

export async function respondToTutorTurn({
  transcript,
  transcriptCandidates = [],
  transcriptionStrategy = null,
  recentContext = [],
  importantNotes = [],
  contextSummary = '',
  currentPage = null,
  lessonContext = null,
  recentToolInteractions = [],
  messageStream = null,
  parameterSnapshot = null,
  contextBlocks = null,
  runFlowCompact = null,
  conversationKey = null,
  config = {},
  toolResult = null,
  onSpeechPrefix = null,
  flow = null,
  flowEvent = 'user.message',
  onFlowEvent = null,
  onFlowData = null,
  flowRecovery = null,
  flowInstructions = [],
  flowOutputLimit = null,
  onModelRequest = null,
  signal,
}) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      ok: false,
      reply: 'OPENAI_API_KEY не настроен на tutor gateway.',
      command: null,
      metadata: { error: 'openai_key_missing' },
    };
  }

  if (flow) {
    const settings = flowSettings(flow.graph, config);
    settings.config = resolveTutorTurnConfig(settings.config, config.complexQuestion ? 'complex' : undefined);
    const result = await flowExecutionService.execute(settings.graph, {
      event: { type: flowEvent, transcript, current_page: currentPage, toolResult },
      sources: { recent_context: recentContext, important_notes: importantNotes, context_summary: contextSummary,
        lesson_context: lessonContext, current_page: currentPage, recent_tool_interactions: recentToolInteractions,
        transcript_candidates: transcriptCandidates, message_stream: messageStream || [], parameter_state: parameterSnapshot || {},
        user_message_count: userMessageCount(messageStream || []) },
      runCompact: runFlowCompact,
      runMcp: (configuration, context) => runRegisteredMcp(configuration, context, { run: runFlowMcp }),
      onEvent: onFlowEvent, onData: onFlowData, signal, recovery: flowRecovery ? { ...flowRecovery, settings: settings.config } : null,
      runModel: (inputPacket, nodeSettings, execution = {}) => {
        const internal = execution.modulePath?.length > 0;
        const nodeConfig = internal ? resolveTutorTurnConfig({ ...settings.config,
          ...(nodeSettings.model !== 'preset' ? { tutorModel: nodeSettings.model } : {}),
          ...(nodeSettings.reasoning !== 'preset' ? { reasoningEnabled: nodeSettings.reasoning !== 'none', reasoningEffort: nodeSettings.reasoning } : {}) }) : settings.config;
        const modelNodeId = execution.nodeId || settings.graph.nodes.find(n => n.type === 'model').id;
        // The wire carries the full journal for counting/compaction. Preset limits apply
        // at the model boundary, never to the upstream state-machine input.
        const packet = tutorModelPacket(inputPacket, settings.config);
        return respondToTutorTurn({ transcript, transcriptCandidates: packet.parts.transcript_candidates || [],
        transcriptionStrategy, recentContext: packet.parts.recent_context || [], importantNotes: packet.parts.important_notes || [],
        contextSummary: packet.parts.context_summary || '', currentPage: packet.parts.current_page || null,
        lessonContext: packet.parts.lesson_context || null, recentToolInteractions: packet.parts.recent_tool_interactions || [],
        messageStream: Array.isArray(packet.parts.message_stream) ? packet.parts.message_stream : null,
        parameterSnapshot: packet.parts.parameter_state || {}, contextBlocks: modelContextBlocks(packet), conversationKey,
        config: nodeConfig, toolResult, signal: execution.signal || signal, onSpeechPrefix: !internal && settings.speech ? onSpeechPrefix : null,
        onModelRequest: body => {
          onModelRequest?.(body);
          onFlowData?.({ nodeId: modelNodeId, type: 'model_request', status: 'running',
            at: new Date().toISOString(), inputPreview: JSON.stringify(body, null, 2) });
          onFlowEvent?.({ nodeId: modelNodeId, type: 'model', status: 'running',
            at: new Date().toISOString(), inputPreview: JSON.stringify(body, null, 2) });
        },
        flowInstructions: [...(packet.blocks ? [] : packet.instructions), ...(internal ? ['Ты внутренний помощник. Верни результат своей задачи в reply, command должен быть null. Команды выполняет основной репетитор.'] : []), flowCommandInstruction(settings.policy)],
        flowOutputLimit: internal ? Math.min(settings.maxOutputTokens, nodeSettings.maxOutputTokens) : settings.maxOutputTokens });
      },
    });
    if (result.paused) return { ok: true, paused: true, checkpoint: result.checkpoint, reply: '', command: null };
    return { ...result.answer, ...(result.checkpoint ? { checkpoint: result.checkpoint } : {}), metadata: { ...result.answer.metadata, flow: { versionId: flow.version_id ?? null,
      name: flow.graph.name, engine: result.engine || 'native', preset: settings.config.preset || null,
      nodes: result.trace.filter(e => e.status === 'completed').map(e => e.nodeId) } } };
  }

  const { body, reasoning, model } = buildTutorModelRequest({ transcript, transcriptCandidates, transcriptionStrategy, recentContext,
    importantNotes, contextSummary, currentPage, lessonContext, recentToolInteractions, messageStream, parameterSnapshot,
    contextBlocks, conversationKey, config, toolResult, flowInstructions, flowOutputLimit });

  const startedAt = Date.now();
  if (onSpeechPrefix) body.stream = true;
  onModelRequest?.(body);
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  });
  let timing = {};
  let payload;
  if (response.ok && onSpeechPrefix) {
    const streamed = await readTutorResponseStream(response, { onSpeechPrefix, startedAt });
    payload = streamed.payload;
    timing = streamed.timing;
  } else payload = await response.json().catch(() => ({}));
  const latencyMs = Date.now() - startedAt;

  if (!response.ok) {
    return {
      ok: false,
      reply: payload?.error?.message || `OpenAI tutor response failed with HTTP ${response.status}.`,
      command: null,
      metadata: {
        model,
        latencyMs,
        status: response.status,
        error: payload?.error || null,
      },
    };
  }

  if (payload.status === 'failed' || payload.status === 'incomplete' || !extractText(payload).trim()) {
    return {
      ok: false,
      reply: 'Модель не завершила ответ. Попробуйте задать вопрос ещё раз или разбить его на части.',
      command: null,
      metadata: { model, latencyMs, usage: payload.usage || null,
        promptCache: calculatePromptCacheStats(payload.usage || null),
        error: payload.error || payload.incomplete_details || { code: 'empty_model_response' } },
    };
  }
  const agentJson = normalizeAgentJson(extractText(payload));
  return {
    ok: true,
    reply: agentJson.reply || 'Labi. Turpinām!',
    speechSegments: agentJson.speechSegments?.length
      ? agentJson.speechSegments
      : [{ text: agentJson.reply || 'Labi. Turpinām!', style: 'neutral_teacher' }],
    command: agentJson.command,
    metadata: {
      model,
      latencyMs,
      streaming: Boolean(onSpeechPrefix),
      ...timing,
      usage: payload.usage || null,
      reasoningEffort: reasoning.effort,
      reasoningRequestEffort: body.reasoning?.effort || null,
      promptCache: calculatePromptCacheStats(payload.usage || null),
      promptCacheRetention: body.prompt_cache_retention || 'provider_default',
      raw: agentJson.raw,
    },
  };
}
