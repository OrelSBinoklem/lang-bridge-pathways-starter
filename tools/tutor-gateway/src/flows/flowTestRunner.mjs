import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validateGraph, EVENT_TYPES, flowSettings } from '../../../../resources/tutor-flow/graph.mjs';
import { flowExecutionService } from './runtime/FlowExecutionService.mjs';
import { TutorContextBuilder } from '../context/TutorContextBuilder.mjs';
import { compactJournal } from '../context/compactJournal.mjs';
import { compressTutorContext } from '../agent/contextCompressor.mjs';
import { createMcpFlowRunner } from './mcp/McpFlowRunner.mjs';
import { tutorPromptManifest, flowCommandInstruction } from '../agent/TutorPromptEnvelope.mjs';
import { resolveTutorTurnConfig } from '../agent/reasoning.mjs';
import { buildTutorModelRequest, tutorModelPacket } from '../agent/tutorAgent.mjs';
import { modelContextBlocks } from '../../../../resources/tutor-flow/assembly.mjs';

const runLocalMcp = createMcpFlowRunner();

const models = Object.keys(JSON.parse(readFileSync(new URL('../../../../frontend/src/config/tutor-reasoning.json', import.meta.url), 'utf8')));

/** A private, isolated studio test. Never appends to a learner's conversation or executes UI commands. */
export function createFlowTestRunner({ send, respond, authorize, resolveConfig, owner = () => null, executionService = flowExecutionService }) {
  let controller = null;
  return {
    cancel() { controller?.abort(); },
    async inspectPrompt(message) {
      const requestId = typeof message.requestId === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(message.requestId) ? message.requestId : null;
      try {
        if (!authorize()) throw new Error('Просмотр инструкций доступен только администратору с действующей авторизацией.');
        if (!requestId) throw new Error('Некорректный ID запроса.');
        const preset = message.preset ?? 'standard';
        if (!['economy', 'standard', 'quality', 'uncompromising'].includes(preset)) throw new Error('Выберите известный тариф.');
        const graph = validateGraph(message.graph, { models });
        const settings = flowSettings(graph, await resolveConfig(preset));
        // Permissions can change while the saved preset is being fetched.
        if (!authorize()) throw new Error('Авторизация администратора истекла.');
        const config = resolveTutorTurnConfig(settings.config);
        send({ type: 'flow.prompt_manifest', requestId, ok: true, data: {
          ...tutorPromptManifest(config, settings.policy), preset, capturedAt: new Date().toISOString(),
          model: config.tutorModel, contextMode: config.contextMode || 'full',
        } });
      } catch (error) { send({ type: 'flow.prompt_manifest', requestId, ok: false, error: error.message }); }
    },
    async run(message) {
      const runId = randomUUID();
      const emit = value => send({ type: 'flow.trace', runId, versionId: null, ...value });
      let current = null, checkpoint = null;
      try {
        if (!authorize()) throw new Error('Конструктор доступен только администратору с действующей авторизацией.');
        if (controller) throw new Error('Дождитесь завершения текущей проверки или остановите её.');
        const preset = message.preset ?? 'standard';
        if (!['economy', 'standard', 'quality', 'uncompromising'].includes(preset)) throw new Error('Выберите известный тариф для проверки.');
        const graph = validateGraph(message.graph, { models });
        const event = message.event;
        if (!event || !EVENT_TYPES.includes(event.type) || typeof event.transcript !== 'string' || event.transcript.length > 12000 || JSON.stringify(event).length > 16000) throw new Error('Некорректное тестовое событие.');
        if (!message.sources || typeof message.sources !== 'object' || Array.isArray(message.sources) || JSON.stringify(message.sources).length > 48000) throw new Error('Контекст теста должен быть JSON-объектом до 48 КБ.');
        if (message.sources.message_stream !== undefined && (!Array.isArray(message.sources.message_stream) || message.sources.message_stream.some(row => !row || !['user', 'assistant', 'system', 'tool'].includes(row.role) || typeof row.text !== 'string'))) throw new Error('Поток сообщений должен быть списком реплик с ролью и текстом.');
        if (message.sources.parameter_state !== undefined && (!message.sources.parameter_state || typeof message.sources.parameter_state !== 'object' || Array.isArray(message.sources.parameter_state))) throw new Error('Блок параметров должен быть JSON-объектом.');
        current = new AbortController(); controller = current;
        const timeout = setTimeout(() => current.abort(new Error('Проверка превысила 120 секунд.')), 120000);
        try {
          const onEvent = event => {
            if (event.type === 'execution_checkpoint') checkpoint = JSON.parse(event.outputPreview);
            emit({ events: [event] });
          };
          const recovery = graph.engine === 'langgraph' && owner() ? { owner: `studio:${owner()}`,
            ...(typeof message.resume === 'string' ? { id: message.resume, resume: true } : {}),
            ...(typeof message.pauseBefore === 'string' && message.pauseBefore ? { pauseBefore: message.pauseBefore } : {}) } : null;
          if ((message.resume || message.pauseBefore) && !recovery) throw Error('Для остановки и продолжения нужен LangGraph и авторизованный администратор.');
          let result;
          if (message.live === true) {
            const config = await resolveConfig(preset);
            if (!authorize()) throw Error('Авторизация администратора истекла.');
            const settings = flowSettings(graph, config);
            const builder = new TutorContextBuilder();
            builder.parameterSnapshot = structuredClone(message.sources.parameter_state || {});
            builder.messages = structuredClone(message.sources.message_stream || []);
            builder.contextSummary = String(message.sources.context_summary || '');
            result = await respond({ transcript: event.transcript, currentPage: event.current_page || message.sources.current_page || null,
              recentContext: message.sources.recent_context || [], importantNotes: message.sources.important_notes || [],
              contextSummary: message.sources.context_summary || '', lessonContext: message.sources.lesson_context || null,
              recentToolInteractions: message.sources.recent_tool_interactions || [], transcriptCandidates: message.sources.transcript_candidates || [],
              messageStream: message.sources.message_stream || null, parameterSnapshot: message.sources.parameter_state || {},
              conversationKey: `studio_${runId}`,
              runFlowCompact: async ({ keepPairs }, _input, execution = {}) => {
                if (config.contextCompressionEnabled === false) throw new Error('Сжатие выключено в настройках тарифа. Переписка сохранена.');
                const summaryModel = config.contextSummaryModel === 'same_as_tutor' ? settings.config.tutorModel : config.contextSummaryModel || 'gpt-6-luna';
                const compaction = await compactJournal(builder, { keepPairs, model: summaryModel, signal: execution.signal || current.signal,
                  compress: options => compressTutorContext({ ...options, profile: config.aiProfiles?.dialogue_summary }) });
                return { compaction, context_summary: builder.contextSummary, parameter_state: builder.parameterSnapshot,
                  message_stream: builder.journalMessages(), user_message_count: builder.messages.filter(m => m.role === 'user').length };
              },
              config, toolResult: event.toolResult || null, flow: { version_id: null, graph }, flowEvent: event.type, flowRecovery: recovery,
              onFlowEvent: onEvent,
              onFlowData: event => { if (event.type === 'model_request') onEvent(event); }, signal: current.signal });
          } else {
            const settings = flowSettings(graph, await resolveConfig(preset));
            if (!authorize()) throw Error('Авторизация администратора истекла.');
            const config = resolveTutorTurnConfig(settings.config);
            const executed = await executionService.execute(graph, { event, sources: message.sources, signal: current.signal, onEvent,
              recovery: recovery ? { ...recovery, settings: { config, live: false } } : null,
              runMcp: (config, execution) => config.service === 'web_search'
                ? { dryRun: true, service: 'web_search', note: 'Внешний поиск не выполнялся: это проверка без платных сервисов.' }
                : runLocalMcp(config, execution) });
            if (executed.paused) {
              emit({ events: [], done: true, paused: true, checkpoint: executed.checkpoint, preset, dryRun: true }); return;
            }
            const packet = tutorModelPacket(executed.packet, config);
            const { body } = buildTutorModelRequest({ config, transcript: event.transcript, toolResult: event.toolResult || null,
              transcriptCandidates: packet.parts.transcript_candidates || [], recentContext: packet.parts.recent_context || [],
              importantNotes: packet.parts.important_notes || [], contextSummary: packet.parts.context_summary || '',
              currentPage: packet.parts.current_page || null, lessonContext: packet.parts.lesson_context || null,
              recentToolInteractions: packet.parts.recent_tool_interactions || [], messageStream: packet.parts.message_stream || null,
              parameterSnapshot: packet.parts.parameter_state || {}, contextBlocks: modelContextBlocks(packet),
              conversationKey: `studio_${runId}`, flowInstructions: [...(packet.blocks ? [] : packet.instructions), flowCommandInstruction(settings.policy)],
              flowOutputLimit: settings.maxOutputTokens });
            onEvent({ nodeId: settings.graph.nodes.find(node => node.type === 'model').id, type: 'model_request_preview',
              status: 'completed', at: new Date().toISOString(), inputPreview: JSON.stringify(body) });
            result = { ...executed.answer, checkpoint: executed.checkpoint };
          }
          if (result?.paused) { emit({ events: [], done: true, paused: true, checkpoint: result.checkpoint, preset, dryRun: false }); return; }
          if (!result?.ok) throw new Error(result?.reply || 'Модель не завершила ответ.');
          current.signal.throwIfAborted();
          emit({ events: [], done: true, reply: result.reply, command: result.command || null, usage: result.metadata?.usage || null,
            preset, checkpoint: result.checkpoint, dryRun: message.live !== true, toolsExecuted: false, speechGenerated: false });
        } finally { clearTimeout(timeout); }
      } catch (error) {
        emit({ events: [], done: true, checkpoint, error: current?.signal.aborted ? 'Проверка остановлена.' : error.message });
      } finally { if (controller === current) controller = null; }
    },
  };
}
