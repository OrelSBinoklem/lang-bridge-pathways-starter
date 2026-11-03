import { TRANSCRIPTION_CONTEXT_RULES } from '../../../../../resources/tutor-flow/transcription-contract.mjs';
import type { Config, FlowGraph, FlowNode, TariffPreview, TraceEvent } from './flowEditor';
import { PROMPT_SECTIONS, capturedPromptSections, modelRequestAtCursor, type PromptManifest } from './promptInspection';

export const RUNTIME_PREFIX = '@runtime.';
export const runtimeId = (id: string) => `${RUNTIME_PREFIX}${id}`;
export const isRuntimeId = (id: string) => id.startsWith(RUNTIME_PREFIX);
export type RuntimeCardData = {
  title: string; icon: string; subtitle: string; note: string; code: string;
  fields: [string, string][]; status: string; disabled?: boolean; input?: boolean;
  output?: boolean; stream?: unknown[]; rules?: string[]; request?: Config;
  ports?: { inputs?: { id: string; label: string }[]; outputs?: { id: string; label: string }[] };
};
export const runtimeData = (node?: FlowNode) => node?.data.runtimeCard as RuntimeCardData | undefined;
const object = (value: unknown): Config | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as Config : undefined;
function json(value: unknown) { try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { return undefined; } }
const text = (value: unknown, fallback = 'Не указано') => value == null || value === '' ? fallback : String(value);
const language = (value: unknown) => value === 'lv' ? 'Латышский · lv' : value === 'ru' ? 'Русский · ru' : value === 'uk' ? 'Украинский · uk' : text(value, 'Автоматически');

/** A read-only projection of existing gateway stages. Never send these cards to the executor. */
export function runtimePipeline(graph: FlowGraph, { tariff, events = [], sources = {}, historical = false, selectedRun = false, eventType = 'user.message', promptManifest }: {
  tariff?: TariffPreview; events?: TraceEvent[]; sources?: Config; historical?: boolean; selectedRun?: boolean; eventType?: string; promptManifest?: PromptManifest;
} = {}) {
  const audioEvent = graph.nodes.find(node => node.type === 'event' && node.data.event === 'user.audio');
  const textEvent = graph.nodes.find(node => node.type === 'event' && node.data.event === 'user.message');
  const journal = graph.nodes.find(node => node.type === 'source' && node.data.source === 'message_stream');
  const model = graph.nodes.find(node => node.type === 'model');
  if (!audioEvent || !journal || !model) return { graph, runtimeEvents: events, cards: [] as FlowNode[] };
  const captured = object(sources.runtime_pipeline);
  const observedRequest = modelRequestAtCursor(events, model.id);
  const previewRequest = observedRequest?.event.type === 'model_request_preview';
  const sections = observedRequest?.request ? capturedPromptSections(observedRequest.request) : !historical && !selectedRun ? promptManifest?.sections ?? [] : [];
  const recognitionEvent = events.findLast(event => event.type === 'recognition' && event.status === 'completed');
  const recognition = object(json(recognitionEvent?.outputPreview));
  const candidates = Array.isArray(recognition?.candidates) ? recognition.candidates as Config[] : [];
  const strategy = object(recognition?.strategy), primaryStrategy = object(strategy?.primary), secondaryStrategy = object(strategy?.secondary);
  const settings = object(captured?.recognition) ?? (!historical ? tariff?.config : undefined);
  const primaryModel = settings?.transcriptionModel ?? primaryStrategy?.model ?? candidates.find(candidate => candidate.id === 'primary')?.model;
  const secondaryModel = settings?.secondaryTranscriptionModel || secondaryStrategy?.model || candidates.find(candidate => candidate.id === 'secondary')?.model || primaryModel;
  const browser = primaryModel === 'browser-speech';
  const dual = settings ? settings.dualTranscriptionEnabled === true && !browser : strategy ? strategy.mode === 'dual' : candidates.length ? candidates.length === 2 : undefined;
  const settingOrigin = historical ? settings || strategy ? 'Настройки выбранного запроса' : 'В старой записи настройки STT не сохранены' : tariff ? `Сохранённый тариф «${tariff.name}»` : 'Тариф ещё не загружен';
  const streamEvent = events.findLast(event => event.status === 'completed' && ['source', 'condition', 'compact', 'context', 'serialize'].includes(event.type) && Array.isArray(object(object(json(event.outputPreview))?.parts)?.message_stream));
  const streamParts = object(object(json(streamEvent?.outputPreview))?.parts);
  // Historical cursors must not reveal future journal rows or borrow the current test fixture.
  const stream = Array.isArray(streamParts?.message_stream) ? streamParts.message_stream : !historical && !selectedRun && Array.isArray(sources.message_stream) ? sources.message_stream : undefined;
  const gate = graph.nodes.find(node => node.type === 'condition' && node.data.field === 'user_message_count');
  const countEvent = events.findLast(event => event.nodeId === gate?.id && event.status === 'completed' && typeof event.observed === 'number');
  const users = stream?.filter(row => object(row)?.role === 'user').length ?? (typeof countEvent?.observed === 'number' ? countEvent.observed : undefined);
  const threshold = text(gate?.data.value, '20');
  const audio = recognitionEvent != null || captured?.sourceType === 'user.audio' || !historical && eventType === 'user.audio';
  const ordinary = historical ? captured?.sourceType === 'user.message' : eventType === 'user.message';
  const virtualEvents: TraceEvent[] = [];
  const cards: FlowNode[] = [];
  const left = Math.min(audioEvent.position.x, textEvent?.position.x ?? 0), y = Math.min(audioEvent.position.y, textEvent?.position.y ?? 0);
  const add = (id: string, x: number, top: number, data: RuntimeCardData) => cards.push({ id: runtimeId(id), type: 'source', position: { x, y: top }, data: { runtimeCard: data } });
  const completed = (id: string, output: unknown, original?: TraceEvent, failed = false) => virtualEvents.push({ nodeId: runtimeId(id), type: 'runtime_observation', status: failed ? 'failed' : 'completed', at: original?.at ?? 0, outputPreview: JSON.stringify(output), durationMs: original?.durationMs });
  add('audio', left - 1960, y - 330, { title: 'Голос ученика', icon: 'pi-microphone', subtitle: 'Одна запись → один или два потока', note: 'Эта запись уже обрабатывается шлюзом до запуска показанного графа. Аудиобайты в отладке не сохраняются.', code: 'tools/tutor-gateway/src/server.mjs · handleUserAudioWithPreset', fields: [['Вход', 'user.audio'], ['Аудио в архиве', 'Не сохраняется']], status: audio && recognitionEvent ? 'Распознавание завершилось' : historical ? 'Нет наблюдения аудио' : 'Существующий вход', output: true });
  add('settings', left - 1960, y - 70, { title: 'Настройки распознавания', icon: 'pi-sliders-h', subtitle: `${settingOrigin} · ${dual === undefined ? 'число потоков неизвестно' : dual ? '2 потока' : '1 поток'}`, note: 'Параметры уже берутся из тарифа. Карточка показывает существующие значения; новые обработчики не добавляются.', code: 'tools/tutor-gateway/src/server.mjs · handleUserAudioWithPreset', fields: [['Источник настроек', settingOrigin], ['Потоки', dual === undefined ? 'Не сохранены' : dual ? 'Два параллельно' : 'Один']], status: 'Настройки', output: true });
  for (const [id, label, candidateId, top] of [['primary', 'Распознавание · 1', 'primary', y - 330], ['secondary', 'Распознавание · 2', 'secondary', y - 30]] as const) {
    const candidate = candidates.find(row => row.id === candidateId), second = id === 'secondary';
    const disabled = second && dual === false;
    const selectedLanguage = second ? settings?.secondaryTranscriptionLanguage ?? secondaryStrategy?.language_hint : settings?.primaryTranscriptionLanguage ?? primaryStrategy?.language_hint;
    add(id, left - 1520, top, { title: label, icon: 'pi-volume-up', subtitle: disabled ? 'Выключено в этом тарифе' : text(second ? secondaryModel : primaryModel, 'Модель из настроек шлюза'), note: browser ? 'Распознаёт браузер. В шлюз поступает готовое текстовое сообщение; платное распознавание здесь не вызывается.' : second ? 'Запускается на той же записи только при включённом втором потоке. Обе задачи ожидаются через Promise.all.' : 'Основной вариант. Если он не дал текста, код пробует успешный второй вариант.', code: browser ? 'frontend/src/features/tutor/browserSpeech.ts' : 'tools/tutor-gateway/src/server.mjs · handleUserAudioWithPreset → transcribeAudio', fields: [['Модель', text(second ? secondaryModel : primaryModel)], ['Язык', historical && selectedLanguage === undefined ? 'Не сохранён в этой записи' : language(selectedLanguage)], ['Состояние', disabled ? 'Не запускается' : candidate ? candidate.ok ? 'Получен текст' : 'Ошибка распознавания' : 'Данных запуска пока нет']], status: disabled ? 'Выключено' : candidate ? candidate.ok ? 'Готово' : 'Ошибка' : 'До запуска', disabled, input: true, output: true });
    if (candidate) completed(id, candidate, recognitionEvent, candidate.ok !== true);
  }
  add('merge', left - 1080, y - 220, { title: 'Сборка вариантов речи', icon: 'pi-clone', subtitle: 'transcript + transcript_candidates + strategy', note: 'Код сохраняет оба исходных распознавания. transcript выбирается из успешного первого, иначе второго. Это сборка JS-объекта, без дополнительного вызова нейросети.', code: 'tools/tutor-gateway/src/server.mjs · candidates / transcriptionStrategy / result', fields: [['Основной текст', 'Первый успешный непустой вариант'], ['Варианты', 'Одна запись, до двух исходных текстов'], ['Передача', 'Один запрос к боту, не две реплики']], status: recognitionEvent ? 'Варианты собраны' : 'Существующий этап', input: true, output: true });
  add('text', left - 1080, y + 70, { title: 'Текст ученика', icon: 'pi-comment', subtitle: browser ? 'Текст из браузерного распознавания' : 'Сообщение из поля чата', note: 'Текстовые сообщения используют тот же журнал. Браузерное распознавание тоже отправляет готовый текст, без платного STT шлюза.', code: 'tools/tutor-gateway/src/server.mjs · user.message', fields: [['Событие', 'user.message']], status: ordinary ? 'Текстовый путь' : 'Существующий вход', output: true });
  add('journal', left - 620, y - 65, { title: 'Журнал беседы · зебра', icon: 'pi-database', subtitle: users === undefined ? 'Здесь накапливаются реплики ученика' : `${users} реплик ученика · порог > ${threshold}`, note: 'Данные сохраняются в tutor_messages. Шлюз восстанавливает их в builder.messages; условие считает только role=user. Ответ бота и state_delta добавляются в этот же журнал, но счётчик ученика не увеличивают.', code: 'tools/tutor-gateway/src/context/DurableTutorContext.mjs · append / load', fields: [['Постоянное хранение', 'MySQL · tutor_messages'], ['В памяти шлюза', 'TutorContextBuilder.messages'], ['Реплик ученика', users === undefined ? 'Нет данных выбранного момента' : String(users)], ['Источник счётчика', streamEvent ? `Фактический журнал · ${streamEvent.nodeId}` : stream ? 'Учебный пример до запуска' : countEvent ? 'Счётчик условия; строки не поместились в снимок' : 'Не подставляется']], stream, status: streamEvent ? 'Фактический журнал' : stream ? 'Учебный пример' : 'Нет данных запуска', input: true, output: true });
  const capturedRules = Array.isArray(captured?.transcriptionRules) ? captured.transcriptionRules.filter((rule): rule is string => typeof rule === 'string') : undefined;
  add('rules', model.position.x - 430, model.position.y - 390, { title: 'Как бот читает варианты речи', icon: 'pi-shield', subtitle: 'Часть основных правил · не отдельная добавка', note: 'Эти строки уже содержатся в основных правилах репетитора. Здесь показан отдельный разбор обработки речи, повторно в запрос они не вставляются.', code: 'tools/tutor-gateway/src/agent/TutorRulesBuilder.mjs · contextRules', fields: [['Передаётся', 'Два варианта одной записи, не два сообщения'], ['Текущий запрос', 'transcript_candidates + transcription_strategy']], rules: capturedRules ?? [...TRANSCRIPTION_CONTEXT_RULES], status: capturedRules ? 'Правила из снимка запроса' : historical ? 'Правила текущего кода · не снимок старого запроса' : 'Существующие правила', ports: { inputs: [{ id: 'in', label: 'Фрагмент основных правил' }] } });
  for (const [index, definition] of PROMPT_SECTIONS.entries()) {
    const section = sections.find(section => section.id === definition.id);
    add(`prompt_${definition.id}`, model.position.x - 1250 + index * 405, model.position.y - 810, {
      title: `${index + 1}. ${definition.title}`, icon: 'pi-file-edit',
      subtitle: section ? `${section.role} · ${section.characters.toLocaleString('ru-RU')} символов` : 'Полный текст пока не получен',
      note: observedRequest?.request ? previewRequest ? 'Из учебной сборки без обращения к модели. Использован рабочий компилятор; сжатие и внешние платные инструменты в этом режиме только моделируются.' : 'Из фактического запроса выбранной итерации. Подключённые карточки инструкций схемы идут отдельно в итоговом запросе.'
        : historical || selectedRun ? 'В выбранном моменте полного снимка нет. Текущие правила не выдаются за правила старого запуска.'
          : 'Точный серверный префикс для выбранного тарифа и настроек схемы. Собран той же функцией, что используется при обращении к модели. Это предпросмотр, не факт отправки.',
      code: definition.source, fields: [['Порядок', `${index + 1} · до блоков схемы`], ['Роль', 'developer'], ['Символов', section ? String(section.characters) : 'Нет данных']],
      rules: section ? [section.text] : undefined, output: true,
      status: observedRequest?.request && section ? previewRequest ? 'Учебная сборка' : 'Снимок запроса' : section ? 'Предпросмотр шлюза' : 'Нет полного снимка',
    });
    if (observedRequest?.request && section) completed(`prompt_${definition.id}`, { role: section.role, content: section.text }, observedRequest.event);
  }
  add('tariff', model.position.x + 435, model.position.y - 380, { title: 'Параметры тарифа', icon: 'pi-sliders-h', subtitle: observedRequest?.request ? previewRequest ? 'Параметры учебной сборки' : 'Фактические параметры запроса' : !historical && !selectedRun && tariff ? `Тариф «${tariff.name}» · настройки выше` : 'Нет снимка настроек',
    note: 'Тариф выбирает модель, мышление, предел ответа, память, распознавание и озвучку. Узел модели может переопределить модель и мышление. Служебные тарифы экзаменов этим выбором не меняются.',
    code: 'tools/tutor-gateway/src/agent/reasoning.mjs · flowSettings', fields: [['Модель', text(observedRequest?.request?.model ?? (!historical && !selectedRun ? promptManifest?.model : undefined))],
      ['Мышление', text(object(observedRequest?.request?.reasoning)?.effort ?? (!historical && !selectedRun ? tariff?.config.reasoningEffort : undefined))], ['Предел ответа', text(observedRequest?.request?.max_output_tokens)]], status: observedRequest?.request ? previewRequest ? 'Учебная сборка' : 'Снимок запроса' : 'Глобальные настройки', output: true });
  add('request', model.position.x + 15, model.position.y - 380, { title: 'Итоговый запрос модели', icon: 'pi-list', subtitle: observedRequest?.request ? `${(observedRequest.request.input as unknown[]).length} сообщений · ${String(observedRequest.request.model)}` : 'Префикс + карточки схемы + данные → модель',
    note: observedRequest?.request ? previewRequest ? 'Учебный запрос собран рабочим компилятором. Модель не вызывалась, кредиты не списывались. Резюме и внешние платные инструменты при бесплатном тесте моделируются. Внутренние модели модулей не вызываются; их вывод в этом режиме учебный.' : 'Полное тело фактически подготовленного запроса, с порядком сообщений, ролями, текстом, параметрами и границами кеша. История ограничена выбранным моментом.'
      : 'Полный запрос появится после сборки теста или в живой истории, когда модель получит контекст. Отдельные карточки выше показывают серверные инструкции; источники и инструкция схемы поступают через её сборку. Неполный снимок не подменяется примером.',
    code: 'tools/tutor-gateway/src/agent/tutorAgent.mjs → orderedPrompt.mjs', fields: [['Состояние', observedRequest?.request ? 'Полный снимок запроса' : 'Полного снимка нет'], ['Сборка', 'Префикс → блоки схемы → текущий запрос'], ['Данные и роли', 'Каждое сообщение отдельно, в реальном порядке']], request: observedRequest?.request, output: true,
    ports: { inputs: [...PROMPT_SECTIONS.map(section => ({ id: section.id, label: section.title })), { id: 'context', label: 'Сериализованный контекст схемы' }, { id: 'tariff', label: 'Параметры модели' }] }, status: observedRequest?.request ? previewRequest ? 'Учебный запрос · без модели' : 'Фактический запрос' : 'Ожидание сборки' });
  if (observedRequest?.request) completed('request', observedRequest.request, observedRequest.event);
  if (recognitionEvent) { completed('audio', { recordingProcessed: true, audioStored: false, ...(object(captured?.recordingMetadata) ?? {}) }, recognitionEvent); completed('merge', recognition, recognitionEvent); }
  if (streamEvent && stream) completed('journal', { message_stream: stream, userMessages: users, storage: 'tutor_messages / builder.messages' }, streamEvent);
  const edges = [...graph.edges];
  const edge = (from: string, to: string, targetHandle = 'in', sourceHandle = 'out') => edges.push({ id: runtimeId(`edge.${from}.${to}`), source: isRuntimeId(from) ? from : runtimeId(from), target: to, sourceHandle, targetHandle });
  for (const target of ['primary', 'secondary']) { edge('audio', runtimeId(target)); edge('settings', runtimeId(target), 'settings'); edge(target, runtimeId('merge'), target); }
  edge('merge', runtimeId('journal'), 'audio'); edge('text', runtimeId('journal'), 'text');
  edge('journal', audioEvent.id, '@runtime.before'); if (textEvent) edge('journal', textEvent.id, '@runtime.before');
  for (const section of PROMPT_SECTIONS) edge(`prompt_${section.id}`, runtimeId('request'), section.id);
  edge('prompt_base', runtimeId('rules')); edge('tariff', runtimeId('request'), 'tariff');
  // Only the visual wire is expanded: saved graph and execution remain unchanged.
  for (const connection of edges.filter(connection => connection.target === model.id && !isRuntimeId(connection.id))) {
    edges.splice(edges.indexOf(connection), 1);
    edges.push({ ...connection, id: runtimeId(`request.${connection.id}`), target: runtimeId('request'), targetHandle: 'context' });
  }
  edge('request', model.id);
  const tools = graph.nodes.find(node => node.type === 'tools'), reply = graph.nodes.find(node => node.type === 'reply');
  if (tools && reply) {
    const policy = object(tools.data.loop) ?? {}, loopEvents = events.filter(event => event.type === 'tool_loop'), last = loopEvents.at(-1);
    const fields: [string, string][] = [['Шагов модели', String(tools.data.maxSteps)], ['Время', `${Number(policy.timeoutMs ?? 120000) / 1000} с`], ['Одинаковых поисков без новых данных', String(policy.maxRepeatedCommand ?? 2)]];
    add('loop_result', tools.position.x + 30, tools.position.y + 340, { title: 'Результат команды → боту', icon: 'pi-replay', subtitle: 'Данные поиска или выполнения команды', note: 'Фактический результат передаётся в следующий вызов модели через toolResult и историю команд. Это часть уже существующего цикла шлюза.', code: 'tools/tutor-gateway/src/server.mjs · executeAgentCommand', fields: [['Повтор', last?.iteration == null ? 'Нет данных запуска' : String(last.iteration)], ['Данные', 'Запрос, результат и ошибки видны по порту']], status: last ? String(last.phase ?? last.status) : 'До запуска', ports: { inputs: [{ id: 'in', label: 'Команда и её результат' }], outputs: [{ id: 'out', label: 'Результат для следующего шага' }] } });
    add('loop_decision', tools.position.x - 400, tools.position.y + 340, { title: 'Продолжить поиск?', icon: 'pi-directions-alt', subtitle: 'Команда → повтор · ответ или лимит → выход', note: 'Бот уточняет запрос или читает соседние сообщения. Контроллер ограничивает число шагов, время и одинаковые поиски без новых данных. При заданном денежном пороге учитывается подтверждённая цена API; незавершённый поиск не выдаётся за найденный ответ.', code: 'tools/tutor-gateway/src/agent/ToolLoopController.ts', fields, status: last ? String(last.reason ?? last.phase ?? last.status) : 'До запуска', ports: { inputs: [{ id: 'in', label: 'Решение модели и результат поиска' }], outputs: [{ id: 'true', label: 'Ещё один шаг' }, { id: 'false', label: 'Ответ / остановка' }] } });
    // Display the existing server loop without introducing executable graph cycles.
    const direct = edges.findIndex(edge => edge.source === tools.id && edge.target === reply.id); if (direct >= 0) edges.splice(direct, 1);
    edges.push({ id: runtimeId('edge.tools.loop_result'), source: tools.id, target: runtimeId('loop_result'), sourceHandle: 'out', targetHandle: 'in' });
    edge('loop_result', runtimeId('loop_decision')); edge('loop_decision', model.id, '@runtime.loop', 'true'); edge('loop_decision', reply.id, 'in', 'false');
    for (const event of loopEvents) { if (['command', 'feedback'].includes(event.phase ?? '')) virtualEvents.push({ ...event, nodeId: runtimeId('loop_result') }); virtualEvents.push({ ...event, nodeId: runtimeId('loop_decision'), branch: event.phase !== 'finish', ...(event.reason && event.status === 'failed' ? { error: event.reason } : {}) }); }
  }
  return { graph: { ...graph, nodes: [...graph.nodes, ...cards], edges }, runtimeEvents: [...events, ...virtualEvents], cards };
}
