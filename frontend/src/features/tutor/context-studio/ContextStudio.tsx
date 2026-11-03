'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, Handle, Position, MarkerType, applyNodeChanges, applyEdgeChanges, addEdge, reconnectEdge, useReactFlow, useNodesInitialized, type Node, type NodeProps, type NodeChange, type EdgeChange, type Connection, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { defaultFlow, validateGraph, nodeCatalog, upgradeVisualAssembly } from '../../../../../resources/tutor-flow/graph.mjs';
import { clientApi } from '@/lib/client-api';
import { ApiError } from '@/lib/api';
import { notifyCreditsChanged } from '@/lib/credit-refresh';
import { resolveTutorWsUrl } from '@/features/tutor/tutor-config';
import reasoning from '@/config/tutor-reasoning.json';
import { KINDS, META, EVENTS, EVENT_LABELS, SOURCE_LABELS, MCP_SERVICES, SERIALIZE_FORMATS, cleanGraph, fingerprint, nodeIssues, initialData, mergeTrace, errorText, pretty, applyMutationState, type FlowServerState, type FlowMutationState, type Kind, type Config, type FlowGraph, type FlowNode, type Run, type TraceEvent } from './flowEditor';
import { ContextAssembly } from './ContextAssembly';
import { NodeInspector, TraceDetails } from './NodeInspector';
import { ReplaceGraphDialog } from './ReplaceGraphDialog';
import { TestSourcesPanel } from './TestSourcesPanel';
import { ExecutionControls } from './ExecutionControls';
import { createTimelineExample, parseSources } from './timelineModel';
import { syncContextOrders, validFlowConnection } from './contextOrder';
import { useTraceHover } from './useTraceHover';
import { TraceHoverCard } from './TraceHoverCard';
import { updateCanvasGeometry, type CanvasGeometry } from './canvasGeometry';
import { edgePresentation, edgeFocus } from './edgePresentation';
import { StudioEdge } from './StudioEdge';
import { useStudioPresets } from './useStudioPresets';
import { usePromptManifest } from './usePromptManifest';
import { StudioPresetPanel } from './StudioPresetPanel';
import { LiveTracePanel } from './LiveTracePanel';
import { ServiceWorkflowStudio, SCHEME_NAMES } from './ServiceWorkflowStudio';
import { replayInput, type LiveRun } from './liveTraceTypes';
import { runtimePipeline, runtimeData, isRuntimeId, runtimeId, type RuntimeCardData } from './runtimePipeline';
import { RuntimePipelineCard, RuntimePipelineInspector } from './RuntimePipelineCards';
import { ModuleCard, moduleDefinition } from './ModuleCard';
import { ModuleStudio } from './ModuleStudio';
import type { ModuleDefinition } from './flowEditor';
import { HandlerSourceLinks } from './HandlerSourceLinks';
import { ProjectSchemeCanvas } from './ProjectSchemeCanvas';
import { resolvedPresetConfig, STUDIO_PRESET_NAMES } from './presetSettings';
import { PRESET_IDS, type TutorPresetId } from '../tutorPresets';
import styles from './context-studio.module.css';

type CardData = Config & { __kind: Kind; __openModule?: (node: FlowNode) => void; __runtime?: RuntimeCardData; __linked?: boolean; __issues: string[]; __status?: TraceEvent['status']; __graph: FlowGraph; __node: FlowNode; __patch: (data: Config) => void; __upgrade: () => void; __tariff?: { name: string; config: Config } };
type CardNode = Node<CardData>;
type Running = { id: string; ws?: WebSocket; controller: AbortController; timer?: ReturnType<typeof setTimeout>; sent: boolean };
const MODELS = Object.keys(reasoning);
const EMPTY_STATE: FlowServerState = { versions: [], head_version_id: null, active_version_id: null, default_graph: defaultFlow() };
const SYNTHETIC_SOURCES = { recent_context: [{ role: 'user', text: 'Я начинаю изучать латышский язык.' }], context_summary: 'Учебный пример: уровень A1, тема — знакомство.', important_notes: ['Предпочитает короткие объяснения на русском.'], lesson_context: { title: 'Знакомство', level: 'A1' }, current_page: '/course', recent_tool_interactions: [], transcript_candidates: ['Как поздороваться по-латышски?'] };
const CATALOG = { ...nodeCatalog, source: { ...nodeCatalog.source, description: META.source.description }, condition: { ...nodeCatalog.condition, description: META.condition.description }, context: { ...nodeCatalog.context, description: META.context.description }, compact: { ...META.compact, group: 'Контекст' }, serialize: { ...META.serialize, group: 'Контекст' }, mcp: { ...META.mcp, group: 'Инструменты' } };
const uid = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
const STATUS = { running: 'Выполняется', completed: 'Готово', skipped: 'Пропущен', failed: 'Ошибка' };
const FLOW_LABELS = { 'controls.ariaLabel': 'Управление холстом', 'controls.zoomIn.ariaLabel': 'Приблизить', 'controls.zoomOut.ariaLabel': 'Отдалить', 'controls.fitView.ariaLabel': 'Показать весь поток', 'minimap.ariaLabel': 'Мини-карта', 'handle.ariaLabel': 'Порт соединения', 'node.a11yDescription.default': 'Нажмите Enter для выбора узла, стрелки для перемещения, Delete для удаления.', 'edge.a11yDescription.default': 'Нажмите Enter для выбора связи, Delete для удаления.' };

function NodeCard({ data, selected }: NodeProps<CardNode>) {
  if (data.__runtime) return <RuntimePipelineCard data={data.__runtime} />;
  if (data.__kind === 'module') return <ModuleCard id={data.__node.id} definition={moduleDefinition(data)} selected={selected} status={data.__status} open={() => data.__openModule?.(data.__node)} />;
  const kind = data.__kind, meta = META[kind];
  const subtitle = kind === 'event' ? EVENT_LABELS[String(data.event)] ?? data.event : kind === 'source' ? SOURCE_LABELS[String(data.source)] ?? data.source : kind === 'prompt' ? data.text : kind === 'condition' ? data.field === 'user_message_count' ? `Реплик ученика > ${data.value}` : `${data.field} ${data.operator === 'equals' ? '=' : 'содержит'} «${data.value}»` : kind === 'compact' ? `Оставить ${data.keepPairs} пар + текущую реплику` : kind === 'model' ? data.model === 'preset' ? 'Модель тарифа' : data.model : kind === 'tools' ? `${data.allCommands ? 'Все доступные команды' : `${Array.isArray(data.allowedCommands) ? data.allowedCommands.length : 0} команд`} · до ${data.maxSteps} шагов` : kind === 'speech' ? data.enabled ? 'Озвучка включена' : 'Без озвучки' : kind === 'context' ? 'Инструкции + данные → запрос' : 'Текст ответа репетитора';
  return <article className={`${styles.nodeCard} ${kind === 'context' ? styles.mergeCard : ''} ${selected ? styles.selectedCard : ''} ${data.__issues.length ? styles.invalidCard : ''}`} style={{ '--node-accent': meta.color } as CSSProperties} data-status={data.__status} data-linked={data.__linked || undefined}>
    {kind !== 'event' && kind !== 'context' && <Handle tabIndex={0} role="button" type="target" position={Position.Left} id="in" aria-label="Вход" />}
    {kind === 'event' && ['user.message', 'user.audio'].includes(String(data.event)) && <Handle tabIndex={0} role="button" type="target" position={Position.Left} id="@runtime.before" isConnectable={false} aria-label="Сообщение подготовлено шлюзом" />}
    {kind === 'model' && <Handle tabIndex={0} role="button" type="target" position={Position.Top} id="@runtime.rules" isConnectable={false} aria-label="Обязательные инструкции шлюза" />}
    {kind === 'model' && <Handle tabIndex={0} role="button" type="target" position={Position.Bottom} id="@runtime.loop" isConnectable={false} aria-label="Следующий шаг поиска и команд" />}
    <div className={styles.cardHeading}><span className={styles.nodeIcon}><i className={`pi ${CATALOG[kind].icon}`} aria-hidden /></span><strong>{meta.label}</strong><i className="pi pi-ellipsis-h" aria-hidden /></div>
    {kind === 'context' ? <ContextAssembly graph={data.__graph} node={data.__node} patch={data.__patch} upgrade={data.__upgrade} /> : <p className={styles.cardSubtitle}>{String(kind === 'serialize' ? SERIALIZE_FORMATS[String(data.format)] ?? data.format : kind === 'mcp' ? `${MCP_SERVICES[String(data.service)] ?? data.service} · ${data.service === 'grammar_table' ? data.tableKey || 'Укажите таблицу' : data.query || 'Запрос из входа'}` : subtitle ?? '')}</p>}
    {kind === 'model' && <div className={styles.tariffBinding}>{data.model === 'preset' && <p><code>$tariff.tutorModel</code><small>{data.__tariff ? `${data.__tariff.name}: ${data.__tariff.config.tutorModel}` : 'Сохранённые настройки загружаются'}</small></p>}{data.reasoning === 'preset' && <p><code>$tariff.reasoningEffort</code><small>{data.__tariff ? data.__tariff.config.reasoningEnabled ? String(data.__tariff.config.reasoningEffort) : 'none · без мышления' : 'Не загружено'}</small></p>}</div>}
    {kind === 'tools' && <div className={styles.nestedAssistant}><strong><i className="pi pi-table" aria-hidden /> Табличник</strong><small>Внутренний инструмент этого бота · грамматические таблицы и подсветка</small></div>}
    {kind === 'mcp' && <div className="nodrag nopan"><HandlerSourceLinks service={String(data.service)} /></div>}
    {kind === 'tools' && <div className="nodrag nopan"><HandlerSourceLinks handler="structured-command" /><br /><HandlerSourceLinks handler="memory.search_history" /></div>}
    <div className={styles.cardFooter}><code>{kind}</code>{data.__issues.length ? <span className={styles.danger} title={data.__issues.join('\n')}><i className="pi pi-exclamation-circle" aria-hidden /> {data.__issues.length}</span> : <span data-status={data.__status}>{data.__status ? STATUS[data.__status] : kind === 'source' ? `${data.limitChars} симв.` : 'Готов к настройке'}</span>}</div>
    {kind === 'condition' ? <><span className={styles.yesPort}>да</span><Handle tabIndex={0} role="button" type="source" position={Position.Right} id="true" style={{ top: '42%', background: '#35a78b' }} aria-label="Да — условие выполнено" /><span className={styles.noPort}>нет</span><Handle tabIndex={0} role="button" type="source" position={Position.Right} id="false" style={{ top: '77%' }} aria-label="Нет — условие не выполнено" /></> : kind !== 'speech' && <Handle tabIndex={0} role="button" type="source" position={Position.Right} id="out" aria-label="Выход" />}
  </article>;
}
const NODE_TYPES = Object.fromEntries(KINDS.map(kind => [kind, NodeCard]));
const EDGE_TYPES = { studio: StudioEdge };
export function ContextStudio({ adminId, initialLive = false, initialConversation = null, initialScheme = '' }: { adminId: number; initialLive?: boolean; initialConversation?: number | null; initialScheme?: string }) { return <ReactFlowProvider><Studio key={adminId} adminId={adminId} initialLive={initialLive} initialConversation={initialConversation} initialScheme={initialScheme} /></ReactFlowProvider>; }

function Studio({ adminId, initialLive, initialConversation, initialScheme }: { adminId: number; initialLive: boolean; initialConversation: number | null; initialScheme: string }) {
  const [liveMode, setLiveMode] = useState(initialLive);
  const [botId, setBotId] = useState(Object.hasOwn(SCHEME_NAMES, initialScheme) ? initialScheme : initialLive ? 'tutor' : '');
  const [graph, setGraph] = useState<FlowGraph>(defaultFlow);
  const [geometry, setGeometry] = useState<CanvasGeometry>({});
  const presets = useStudioPresets();
  const [previewPreset, setPreviewPreset] = useState<TutorPresetId>('standard');
  const tariff = useMemo(() => presets.data ? { id: previewPreset, name: STUDIO_PRESET_NAMES[previewPreset], config: resolvedPresetConfig(previewPreset, presets.data) } : undefined, [previewPreset, presets.data]);
  const [baseline, setBaseline] = useState(() => fingerprint(defaultFlow()));
  const [server, setServer] = useState<FlowServerState>(EMPTY_STATE);
  const [loadedId, setLoadedId] = useState<number | null>(null);
  const [versionPick, setVersionPick] = useState('');
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]), [selectedEdges, setSelectedEdges] = useState<string[]>([]);
  const [libraryFilter, setLibraryFilter] = useState('');
  const [modulesOpen, setModulesOpen] = useState(false), [moduleInitial, setModuleInitial] = useState<ModuleDefinition>(), [moduleOrigin, setModuleOrigin] = useState<string>();
  const openModule = useCallback((node?: FlowNode) => { setModuleOrigin(node?.id); setModuleInitial(node ? moduleDefinition(node.data) : undefined); setModulesOpen(true); }, []);
  const [runs, setRuns] = useState<Run[]>([]), [runPick, setRunPick] = useState(''), [running, setRunning] = useState(false);
  const [testType, setTestType] = useState('user.message'), [transcript, setTranscript] = useState('Как поздороваться по-латышски?'), [currentPage, setCurrentPage] = useState('/course');
  const [sourceText, setSourceText] = useState(() => JSON.stringify({ ...SYNTHETIC_SOURCES, ...createTimelineExample() }, null, 2));
  const [toolResult, setToolResult] = useState('{"ok":true,"result":"Учебный результат команды"}');
  const [testTab, setTestTab] = useState<'input' | 'events'>('input');
  const [pauseBefore, setPauseBefore] = useState('');
  const [replaceRequested, setReplaceRequested] = useState(false);
  const replacementResolve = useRef<((replace: boolean) => void) | null>(null);
  const fileRef = useRef<HTMLInputElement>(null), active = useRef<Running | null>(null), mounted = useRef(true);
  const canvas = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const [focusRequest, setFocusRequest] = useState(1);
  const focused = useRef(0);
  const dirty = fingerprint(graph) !== baseline;
  const pickedRun = runs.find(run => run.id === runPick);
  const parsedSources = useMemo(() => parseSources(sourceText), [sourceText]);
  const promptManifest = usePromptManifest(graph, previewPreset, JSON.stringify(tariff?.config ?? null), ready && !!tariff && botId === 'tutor' && !liveMode);
  const pipeline = useMemo(() => runtimePipeline(graph, { tariff, events: pickedRun?.events, sources: parsedSources.sources, selectedRun: Boolean(pickedRun), eventType: testType, promptManifest: promptManifest.data }), [graph, tariff, pickedRun, parsedSources.sources, testType, promptManifest.data]);
  const selected = pipeline.graph.nodes.find(n => n.id === selectedNodes.at(-1));
  const hover = useTraceHover(pipeline.graph, pipeline.runtimeEvents);
  const focusedLinks = useMemo(() => edgeFocus(pipeline.graph.edges, hover.highlight, selectedEdges), [pipeline.graph.edges, hover.highlight, selectedEdges]);
  const reconnectingEdge = useRef<string | undefined>(undefined);
  function loadTimelineExample() { setSourceText(JSON.stringify({ ...SYNTHETIC_SOURCES, ...createTimelineExample(21) }, null, 2)); setTranscript('Я закончил задание. Что дальше?'); }
  const issues = useMemo(() => {
    const local = nodeIssues(graph, MODELS); let problem = '';
    try { validateGraph(cleanGraph(graph), { models: MODELS }); } catch (cause) { problem = errorText(cause); }
    if (problem) for (const node of graph.nodes) if (problem.includes(`${node.id}:`) || problem.includes(` ${node.id}.`)) local[node.id] = [...(local[node.id] ?? []), problem];
    return { nodes: local, problem };
  }, [graph]);
  const upgradeAssembly = useCallback(() => {
    try { setGraph(validateGraph(upgradeVisualAssembly(cleanGraph(graph)), { models: MODELS })); setNotice('Карточки обновлены: восемь входов и сериализация. Изменения не сохранены; сохраните новую версию для активации.'); }
    catch (cause) { setError(errorText(cause)); }
  }, [graph]);
  const cardNodes: CardNode[] = useMemo(() => pipeline.graph.nodes.map(node => ({ ...node, ...geometry[node.id], draggable: !isRuntimeId(node.id), deletable: !isRuntimeId(node.id), selected: selectedNodes.includes(node.id), ...(hover.target?.kind === 'node' && hover.target.id === node.id ? { domAttributes: { 'aria-describedby': hover.id } } : {}), data: { ...node.data, __runtime: runtimeData(node), __openModule: openModule, __linked: focusedLinks.nodes.has(node.id), __kind: node.type, __tariff: tariff, __upgrade: upgradeAssembly, __graph: graph, __node: node, __patch: (data: Config) => setGraph(current => ({ ...current, nodes: current.nodes.map(item => item.id === node.id ? { ...item, data: { ...item.data, ...data } } : item) })), __issues: issues.nodes[node.id] ?? [], __status: pickedRun?.events.filter(event => event.nodeId === node.id).at(-1)?.status } })), [pipeline.graph.nodes, graph, geometry, selectedNodes, issues.nodes, pickedRun, hover.target, hover.id, upgradeAssembly, tariff, focusedLinks, openModule]);
  const flowEdges = useMemo(() => pipeline.graph.edges.map(edge => {
    const presentation = edgePresentation(pipeline.graph.edges, edge), highlighted = focusedLinks.edges.has(edge.id);
    return { ...edge, type: 'studio', selected: selectedEdges.includes(edge.id),
      ...(hover.target?.kind === 'edge' && hover.target.id === edge.id ? { domAttributes: { 'aria-describedby': hover.id } } : {}),
      reconnectable: !isRuntimeId(edge.id), deletable: !isRuntimeId(edge.id),
      sourceHandle: edge.sourceHandle ?? 'out', targetHandle: edge.targetHandle ?? 'in',
      label: edge.sourceHandle === 'true' ? 'да' : edge.sourceHandle === 'false' ? 'нет' : undefined,
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: presentation.colour },
      zIndex: highlighted ? 10 : 0,
      data: { ...presentation, highlighted, muted: focusedLinks.edges.size > 0 && !highlighted },
    };
  }), [pipeline.graph.edges, selectedEdges, hover.target, hover.id, focusedLinks]);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const response = await clientApi<{ data: FlowServerState }>('/tutor/flows', { signal }); if (mounted.current) setServer(response.data); return response.data;
  }, []);
  function installGraph(next: FlowGraph, id: number | null) {
    setGraph(next); setBaseline(fingerprint(next)); setLoadedId(id); setSelectedNodes(next.nodes.filter(n => n.type === 'context').slice(0, 1).map(n => n.id)); setSelectedEdges([]); setFocusRequest(value => value + 1);
  }
  useEffect(() => {
    if (!ready || !nodesInitialized || focused.current === focusRequest) return;
    const node = canvas.getNodes().find(node => node.id === runtimeId('merge')) ?? canvas.getNodes().find(node => node.type === 'context');
    if (!node) return;
    focused.current = focusRequest;
    void canvas.setCenter(node.position.x + 195, node.position.y + 170, { zoom: .7, duration: 200 });
  }, [ready, nodesInitialized, focusRequest, canvas]);
  useEffect(() => {
    mounted.current = true; const controller = new AbortController();
    void (async () => {
      const state = await refresh(controller.signal), id = state.active_version_id ?? state.head_version_id;
      const next = id == null ? state.default_graph : (await clientApi<{ data: { graph: FlowGraph } }>(`/tutor/flows/${id}`, { signal: controller.signal })).data.graph;
      if (controller.signal.aborted) return;
      const safe = validateGraph(next, { models: MODELS }); setGraph(safe); setBaseline(fingerprint(safe)); setLoadedId(id); setVersionPick(id == null ? '' : String(id)); setSelectedNodes(safe.nodes.filter(n => n.type === 'context').slice(0, 1).map(n => n.id)); setReady(true);
    })().catch(cause => { if (!controller.signal.aborted) { setError(errorText(cause)); setReady(false); } });
    return () => { mounted.current = false; controller.abort(); const run = active.current; active.current = null; if (run) { clearTimeout(run.timer); run.controller.abort(); if (run.ws?.readyState === WebSocket.OPEN) run.ws.send(JSON.stringify({ type: 'flow.cancel' })); run.ws?.close(); } };
  }, [refresh, adminId, loadAttempt]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function report(cause: unknown) {
    const details = cause instanceof ApiError && cause.errors ? Object.values(cause.errors).flat().join(' · ') : '';
    setError(`${cause instanceof ApiError && cause.status === 409 ? 'Конфликт версий (409). Другой администратор изменил поток. Черновик сохранён на экране; сведения о версиях обновлены. Сверьте их и повторите действие. ' : ''}${errorText(cause)}${details ? ` · ${details}` : ''}`);
    if (cause instanceof ApiError && cause.status === 409) void refresh().catch(refreshError => setError(old => `${old} Не удалось обновить версии: ${errorText(refreshError)}`));
  }
  function mayReplace(): Promise<boolean> {
    if (!dirty) return Promise.resolve(true);
    if (replacementResolve.current) return Promise.resolve(false);
    return new Promise(resolve => { replacementResolve.current = resolve; setReplaceRequested(true); });
  }
  function answerReplacement(replace: boolean) {
    const resolve = replacementResolve.current; replacementResolve.current = null; setReplaceRequested(false); resolve?.(replace);
  }
  useEffect(() => () => { replacementResolve.current?.(false); replacementResolve.current = null; }, []);
  async function refreshAfterMutation(success: string) {
    try { await refresh(); }
    catch (cause) { setError(`${success} Список версий не удалось обновить: ${errorText(cause)}. Состояние из ответа сервера применено; список можно обновить вручную.`); }
  }
  async function loadVersion() {
    if (!versionPick || !(await mayReplace())) return; setBusy(true); setError('');
    try { const response = await clientApi<{ data: { graph: FlowGraph } }>(`/tutor/flows/${Number(versionPick)}`); installGraph(validateGraph(response.data.graph, { models: MODELS }), Number(versionPick)); setNotice(`Загружена версия #${versionPick}. Для возврата к ней нажмите «Активировать».`); }
    catch (cause) { report(cause); } finally { setBusy(false); }
  }
  async function save() {
    if (!ready || busy) return; setError(''); let safe: FlowGraph;
    try { safe = validateGraph(cleanGraph(graph), { models: MODELS }); } catch (cause) { report(cause); return; }
    setBusy(true);
    try {
      const response = await clientApi<{ data: FlowMutationState }>('/tutor/flows', { method: 'POST', body: JSON.stringify({ graph: safe, expected_head_version_id: server.head_version_id }) });
      const result = response.data, savedId = result.version?.id ?? result.head_version_id;
      setServer(current => applyMutationState(current, result));
      setBaseline(fingerprint(safe)); setGraph(current => fingerprint(current) === fingerprint(graph) ? safe : current);
      if (savedId != null) { setLoadedId(savedId); setVersionPick(String(savedId)); }
      setNotice(`Сохранена новая неизменяемая версия${savedId != null ? ` #${savedId}` : ''}. Для применения активируйте её.`);
      await refreshAfterMutation(`Версия${savedId != null ? ` #${savedId}` : ''} успешно сохранена.`);
    } catch (cause) { report(cause); } finally { setBusy(false); }
  }
  async function activation(deactivate = false) {
    if (!ready || busy || (!deactivate && (dirty || loadedId == null))) return; setBusy(true); setError('');
    try {
      const response = await clientApi<{ data: FlowMutationState }>(deactivate ? '/tutor/flows/deactivate' : `/tutor/flows/${loadedId}/activate`, { method: 'POST', body: JSON.stringify({ expected_active_version_id: server.active_version_id }) });
      setServer(current => applyMutationState(current, response.data));
      setNotice(deactivate ? 'Включён встроенный поток репетитора.' : `Активна версия #${loadedId}. Для отката загрузите и активируйте старую версию.`);
      await refreshAfterMutation(deactivate ? 'Встроенный поток успешно включён.' : `Версия #${loadedId} успешно активирована.`);
    }
    catch (cause) { report(cause); } finally { setBusy(false); }
  }
  function changeNodes(changes: NodeChange<CardNode>[]) {
    setGeometry(current => updateCanvasGeometry(current, changes));
    const selections = changes.filter(change => change.type === 'select');
    if (selections.length) setSelectedNodes(current => { const next = new Set(current); for (const change of selections) if (change.type === 'select') { if (change.selected) next.add(change.id); else next.delete(change.id); } return [...next]; });
    const edits = changes.filter(change => ['position', 'remove'].includes(change.type) && !('id' in change && change.id.startsWith('@runtime.')));
    if (edits.length) setGraph(current => { const nodes = applyNodeChanges(edits as NodeChange[], current.nodes as Node[]) as FlowNode[]; const next = cleanGraph({ ...current, nodes, edges: current.edges.filter(edge => nodes.some(n => n.id === edge.source) && nodes.some(n => n.id === edge.target)) }); return edits.some(edit => edit.type === 'remove') ? syncContextOrders(next) : next; });
  }
  function changeEdges(changes: EdgeChange[]) {
    setSelectedEdges(current => { const next = new Set(current); for (const change of changes) if (change.type === 'select') { if (change.selected) next.add(change.id); else next.delete(change.id); } return [...next]; });
    const edits = changes.filter(change => change.type !== 'select' && !('id' in change && change.id.startsWith('@runtime.'))); if (edits.length) setGraph(current => syncContextOrders(cleanGraph({ ...current, edges: applyEdgeChanges(edits, current.edges) })));
  }
  function validConnection(connection: Connection | Edge) { return validFlowConnection(graph, connection, reconnectingEdge.current); }
  function addNode(kind: Kind, position?: { x: number; y: number }) {
    if (graph.nodes.length >= 64) { setError('В потоке может быть до 64 узлов.'); return; }
    if (['compact', 'serialize', 'model', 'tools', 'reply', 'speech'].includes(kind) && graph.nodes.some(n => n.type === kind)) { setSelectedNodes([graph.nodes.find(n => n.type === kind)!.id]); return; }
    const id = uid(kind); setGraph(current => ({ ...current, nodes: [...current.nodes, { id, type: kind, position: position ?? canvas.screenToFlowPosition({ x: window.innerWidth / 2, y: 360 }), data: initialData(kind) }] })); setSelectedNodes([id]); setNotice('Узел добавлен. Соедините его порты с другими карточками.');
  }
  function addTableAssistant() {
    const existing = graph.nodes.find(n => n.type === 'mcp' && ['grammar_search', 'grammar_table'].includes(String(n.data.service)));
    if (existing) { setSelectedNodes([existing.id]); void canvas.fitView({ nodes: [{ id: existing.id }], padding: .7 }); return; }
    const context = graph.nodes.find(n => n.type === 'context'), event = graph.nodes.find(n => n.type === 'event' && n.data.event === 'user.message');
    if (!context || !event || !Array.isArray(context.data.inputs)) { setError('Для табличника нужны событие сообщения и сборка с восемью входами.'); return; }
    const id = uid('table_assistant');
    setGraph(current => syncContextOrders({ ...current, nodes: [...current.nodes, { id, type: 'mcp', position: { x: context.position.x - 420, y: context.position.y + 500 }, data: { service: 'grammar_search', query: '', tableKey: '', limit: 3 } }], edges: [...current.edges, { id: uid('edge'), source: event.id, target: id, sourceHandle: 'out', targetHandle: 'in' }, { id: uid('edge'), source: id, target: context.id, sourceHandle: 'out', targetHandle: 'in6' }] }));
    setSelectedNodes([id]); setNotice('Табличник добавлен внутрь схемы основного чата. Это черновик: сохраните и включите версию, чтобы применять подключение.');
  }
  function removeSelection() { if (![...selectedNodes, ...selectedEdges].some(id => !isRuntimeId(id))) return; setGraph(current => syncContextOrders({ ...current, nodes: current.nodes.filter(n => !selectedNodes.includes(n.id)), edges: current.edges.filter(e => !selectedEdges.includes(e.id) && !selectedNodes.includes(e.source) && !selectedNodes.includes(e.target)) })); setSelectedNodes([]); setSelectedEdges([]); }
  function showRuntime(id: string) { setSelectedNodes([runtimeId(id)]); hover.close(); const ids = id === 'settings' ? ['audio', 'settings', 'primary', 'secondary', 'merge'] : [id]; void canvas.fitView({ nodes: ids.map(key => ({ id: runtimeId(key) })), padding: .15, maxZoom: .9, duration: 200 }); }
  function exportGraph() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(cleanGraph(graph), null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'tutor-flow-v2.json'; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice('JSON экспортирован. Черновик можно перенести этим файлом.');
  }
  async function importGraph(file?: File) {
    if (!file) return;
    try { if (file.size > 131072) throw Error('Файл должен быть не больше 128 КБ.'); const next = validateGraph(JSON.parse(await file.text()), { models: MODELS }); if (!(await mayReplace())) return; setGraph(next); setLoadedId(null); setSelectedNodes([]); setNotice('JSON импортирован как черновик. Сохраните новую версию.'); requestAnimationFrame(() => { void canvas.fitView({ padding: .15 }); }); } catch (cause) { report(cause); }
  }
  async function restoreExample() {
    if (!(await mayReplace())) return;
    setGraph(validateGraph(server.default_graph, { models: MODELS })); setLoadedId(null); setSelectedNodes([]);
    setNotice('Восстановлен пример. Сохраните версию для активации.'); requestAnimationFrame(() => { void canvas.fitView({ padding: .15 }); });
  }
  function updateRun(id: string, update: (run: Run) => Run) { if (mounted.current) setRuns(current => current.map(run => run.id === id ? update(run) : run)); }
  function finishRun(run: Running, errorMessage?: string) {
    if (active.current !== run) return;
    active.current = null; clearTimeout(run.timer); run.controller.abort(); run.ws?.close(); setRunning(false);
    updateRun(run.id, current => ({ ...current, done: true, ...(errorMessage ? { error: errorMessage } : {}) })); notifyCreditsChanged();
  }
  function cancelRun() {
    const run = active.current; if (!run) return;
    if (run.ws?.readyState === WebSocket.OPEN) run.ws.send(JSON.stringify({ type: 'flow.cancel' }));
    finishRun(run, 'Запуск отменён администратором. Уже выполненный запрос может быть учтён провайдером.');
  }
  async function testFlow(live: boolean, resumeRun?: Run) {
    if (active.current || !ready) return; setError('');
    try {
      const safe = validateGraph(resumeRun?.fixture?.graph ?? cleanGraph(graph), { models: MODELS });
      if (sourceText.length > 150000) throw Error('Тестовые источники: не больше 150 000 символов. Журнал не обрезается.');
      const sources: unknown = resumeRun?.fixture?.sources ?? JSON.parse(sourceText);
      if (!sources || typeof sources !== 'object' || Array.isArray(sources)) throw Error('Источники должны быть JSON-объектом.');
      const event = resumeRun?.fixture?.event ?? { type: testType, transcript, current_page: currentPage, ...(testType === 'tool.result' ? { toolResult: JSON.parse(toolResult) as unknown } : {}) };
      const preset = resumeRun?.preset ?? previewPreset;
      const run: Running = { id: uid('run'), controller: new AbortController(), sent: false };
      active.current = run; setRunning(true); setRunPick(run.id); setTestTab('events');
      setRuns(current => [{ id: run.id, name: safe.name, preset, live, started: new Date().toISOString(), events: [], done: false, versionId: dirty ? null : loadedId,
        fixture: { graph: safe, event, sources: sources as Record<string, unknown> } }, ...current].slice(0, 20));
      run.timer = setTimeout(() => finishRun(run, 'Истекло время ожидания соединения или авторизации (25 с).'), 25000);
      try {
        const { ticket } = await clientApi<{ ticket: string }>('/tutor/ticket', { method: 'POST', signal: run.controller.signal });
        if (active.current !== run) return;
        const ws = new WebSocket(resolveTutorWsUrl()); run.ws = ws;
        ws.onopen = () => { if (active.current === run) ws.send(JSON.stringify({ type: 'session.authenticate', ticket })); };
        ws.onmessage = message => {
          if (active.current !== run) return;
          try {
            const payload = JSON.parse(String(message.data));
            if (payload.type === 'credits.changed') { notifyCreditsChanged(); return; }
            if (payload.type === 'session.ready' && !run.sent) {
              run.sent = true; clearTimeout(run.timer);
              run.timer = setTimeout(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'flow.cancel' })); finishRun(run, 'Запуск не завершился за 5 минут; отправлена отмена.'); }, 300000);
              ws.send(JSON.stringify({ type: 'flow.test', graph: safe, event, sources, live, preset,
                ...(resumeRun?.checkpoint ? { resume: resumeRun.checkpoint.id } : { pauseBefore: safe.engine === 'langgraph' ? pauseBefore : '' }) })); return;
            }
            if (payload.type === 'error') { const text = String(payload.message ?? payload.error ?? 'Шлюз отклонил тест'); setError(text); finishRun(run, text); return; }
            if (payload.type !== 'flow.trace') return;
            const events = Array.isArray(payload.events) ? payload.events.filter((item: TraceEvent) => item && typeof item.nodeId === 'string' && typeof item.type === 'string' && ['running', 'completed', 'skipped', 'failed'].includes(item.status)) : [];
            updateRun(run.id, current => ({ ...current, serverId: payload.runId ?? current.serverId, versionId: payload.versionId ?? current.versionId, events: mergeTrace(current.events, events), done: Boolean(payload.done), paused: Boolean(payload.paused),
              ...(payload.checkpoint ? { checkpoint: payload.checkpoint } : {}), ...(payload.reply != null ? { reply: pretty(payload.reply) } : {}), ...(payload.command != null ? { command: payload.command } : {}), ...(payload.usage != null ? { usage: payload.usage } : {}), ...(payload.error ? { error: pretty(payload.error) } : {}) }));
            if (payload.done) { if (payload.error) setError(pretty(payload.error)); finishRun(run); }
          } catch (cause) { const text = `Ошибка протокола теста: ${errorText(cause)}`; setError(text); finishRun(run, text); }
        };
        ws.onerror = () => { const text = 'Не удалось подключиться к шлюзу репетитора.'; setError(text); finishRun(run, text); };
        ws.onclose = event => { if (active.current === run) { const text = `Соединение закрыто до завершения теста (${event.code})${event.reason ? `: ${event.reason}` : ''}.`; setError(text); finishRun(run, text); } };
      } catch (cause) { if (active.current === run) { report(cause); finishRun(run, errorText(cause)); } }
    } catch (cause) { report(cause); }
  }
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (replacementResolve.current || modulesOpen || liveMode || botId !== 'tutor') return;
      const target = event.target as HTMLElement;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void save(); }
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void testFlow(false); }
      if ((event.key === 'Delete' || event.key === 'Backspace') && !target.closest('input,textarea,select,[contenteditable="true"]') && (selectedNodes.length || selectedEdges.length)) { event.preventDefault(); removeSelection(); }
    };
    window.addEventListener('keydown', keyboard); return () => window.removeEventListener('keydown', keyboard);
  });

  async function copyLiveRun(record: LiveRun) {
    const input = replayInput(record);
    if (!input) throw Error('Нет полного снимка для учебного теста.');
    const sources = JSON.stringify(input.sources, null, 2);
    if (sources.length > 150000) throw Error('Источники больше лимита учебного теста. Используйте просмотр записи без повторного запуска.');
    const next = validateGraph(input.graph, { models: MODELS });
    if (!(await mayReplace())) return;
    installGraph(next, null); setBaseline('');
    setSourceText(sources); setTranscript(String(input.event.transcript ?? '')); setCurrentPage(String(input.event.current_page ?? '/course'));
    setToolResult(JSON.stringify(input.event.toolResult ?? {}, null, 2));
    setTestType(EVENTS.includes(String(input.event.type)) ? String(input.event.type) : 'user.message');
    if (PRESET_IDS.includes(input.preset as TutorPresetId)) setPreviewPreset(input.preset as TutorPresetId);
    setNotice('Снимок перенесён в учебный тест. Запрос модели и команды не запускались. Проверка без модели бесплатна; запуск с моделью выполняется только отдельной кнопкой.');
    setLiveMode(false); setTestTab('input');
  }
  return <section className={styles.page} aria-label="Конструктор потока репетитора">
    <div inert={replaceRequested}>
    <header className={styles.heading}><a href="/admin-tools" className={styles.back} aria-label="Административные инструменты"><i className="pi pi-arrow-left" aria-hidden /></a><span className={styles.brandIcon}><i className="pi pi-sitemap" aria-hidden /></span><div><span className={styles.eyebrow}>LangBridge · Tutor studio</span><h1>Конструктор схем ботов</h1></div><span className={styles.adminBadge}>Администратор</span></header>
    <ProjectSchemeCanvas moduleId={botId} locked={running} openModule={id => { hover.close(); setBotId(id); }} />
    {(!botId || botId === 'tutor') && <div className={styles.botSelector}><button type="button" disabled={!ready || running} onClick={() => { setBotId('tutor'); openModule(); }}><i className="pi pi-box" aria-hidden /> Создать или открыть модуль</button><span>Модуль объединяет карточки в одну группу. Новый модуль добавляется в схему основного чата; чтобы изменить работающего бота, сохраните и активируйте её версию.</span></div>}
    <ServiceWorkflowStudio schemeId={botId || 'tutor'} adminId={adminId} />
    <StudioPresetPanel presets={presets} selected={previewPreset} select={setPreviewPreset} locked={running} />
    <div hidden={botId !== 'tutor'}>
    <nav className={styles.liveControls} aria-label="Режим конструктора"><button type="button" aria-pressed={!liveMode} onClick={() => { hover.close(); setLiveMode(false); }}>Рабочая схема и учебный тест</button><button type="button" aria-pressed={liveMode} onClick={() => { hover.close(); setLiveMode(true); }}>Живой чат · история</button></nav>
    {botId === 'tutor' && liveMode && <LiveTracePanel adminId={adminId} initialConversation={initialConversation} onReplay={copyLiveRun} />}
    {!liveMode && <>
    <div className={styles.toolbar}>
      <div className={styles.nameGroup}><label htmlFor="flow-name">Название потока</label><input id="flow-name" disabled={!ready || busy} maxLength={120} value={graph.name} onChange={e => setGraph(current => ({ ...current, name: e.target.value }))} /><div className={styles.badges}><span className={dirty ? styles.dirtyBadge : styles.savedBadge}>{dirty ? '● Несохранённые изменения' : loadedId != null ? `Сохранено · #${loadedId}` : 'Встроенный шаблон'}</span><span className={styles.activeBadge}>{server.active_version_id == null ? 'Работает встроенный поток' : `Активна #${server.active_version_id}`}</span></div></div>
      <div className={styles.toolbarActions}><button type="button" disabled={!ready || busy || Boolean(issues.problem)} onClick={() => void save()} title="Ctrl / ⌘ S"><i className="pi pi-save" aria-hidden />Сохранить версию</button><button type="button" className={styles.primary} disabled={!ready || busy || dirty || loadedId == null || loadedId === server.active_version_id} onClick={() => void activation()} title={dirty ? 'Сначала сохраните изменения' : 'Применить выбранную сохранённую версию'}><i className="pi pi-check-circle" aria-hidden />Активировать {loadedId != null ? `#${loadedId}` : ''}</button></div>
    </div>
    <div className={styles.versionBar}><label>Исполнитель<select aria-label="Исполнитель графа" disabled={!ready || busy} value={graph.engine ?? "native"} onChange={event => setGraph(current => ({ ...current, engine: event.target.value as "native" | "langgraph" }))}><option value="native">Встроенный · Native</option><option value="langgraph">JavaScript · LangGraph.js</option></select></label><span className={styles.versionHint}>Выбор применяется только после сохранения новой версии и её активации.</span><label>Версии<select aria-label="Сохранённые версии" value={versionPick} disabled={!ready || busy} onChange={e => setVersionPick(e.target.value)}><option value="">Выберите версию</option>{server.versions.map(v => <option key={v.id} value={v.id}>#{v.id} · {v.name} · {new Date(v.created_at).toLocaleString('ru-RU')}{v.id === server.active_version_id ? ' · активна' : ''}</option>)}</select></label><button type="button" disabled={!ready || busy || !versionPick} onClick={() => void loadVersion()}>Загрузить</button><button type="button" disabled={busy} onClick={() => { setError(''); if (!ready) { setLoadAttempt(value => value + 1); return; } void refresh().then(() => setNotice('Список версий обновлён.')).catch(report); }} aria-label="Обновить версии"><i className="pi pi-refresh" aria-hidden /></button><span className={styles.versionHint}>Для отката загрузите старую версию и активируйте её.</span><button type="button" disabled={!ready || busy || server.active_version_id == null} onClick={() => void activation(true)}>Вернуть встроенный поток</button></div>
    <div className={styles.feedback} aria-live="polite">{error && <div className={styles.error} role="alert"><i className="pi pi-exclamation-triangle" aria-hidden /><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Закрыть сообщение">×</button></div>}{notice && <div className={styles.notice}><i className="pi pi-info-circle" aria-hidden />{notice}</div>}{!ready && !error && <div className={styles.notice}>Загружаем серверные версии…</div>}</div>
    <div className={styles.promptStatus} role="status"><span>{promptManifest.loading ? 'Загружаем полный серверный префикс…' : promptManifest.error || (promptManifest.data ? `Инструкции шлюза: ${promptManifest.data.sections.reduce((sum, section) => sum + section.characters, 0).toLocaleString('ru-RU')} символов · ${STUDIO_PRESET_NAMES[previewPreset]}. Полный текст — в карточках.` : 'Полные инструкции ещё не загружены.')}</span><button type="button" disabled={promptManifest.loading} onClick={promptManifest.refresh}>Обновить инструкции</button></div>
    <div className={styles.workspace} inert={!ready || busy}>
      <aside className={styles.library}><div className={styles.panelHeading}><h2>Библиотека</h2><span>{KINDS.length}</span></div><label className={styles.search}><i className="pi pi-search" aria-hidden /><input aria-label="Поиск узла" placeholder="Найти узел…" value={libraryFilter} onChange={e => setLibraryFilter(e.target.value)} /></label><p className={styles.libraryHint}>Перетащите на холст или нажмите +</p>
        <button type="button" onClick={addTableAssistant}><i className="pi pi-table" aria-hidden />Табличник · добавить в эту схему</button>
        {KINDS.filter(kind => !['module', 'module_input', 'module_output'].includes(kind)).filter(kind => `${META[kind].label} ${kind} ${CATALOG[kind].description}`.toLowerCase().includes(libraryFilter.toLowerCase())).map(kind => <div key={kind} className={styles.libraryGroup}><span>{CATALOG[kind].group} / {kind}</span><button type="button" draggable onDragStart={e => { e.dataTransfer.setData('application/tutor-node', kind); e.dataTransfer.effectAllowed = 'move'; }} onClick={() => addNode(kind)} title={CATALOG[kind].description}><i className={`pi ${CATALOG[kind].icon}`} style={{ color: META[kind].color }} aria-hidden /><span><b>{META[kind].label}</b><small>{CATALOG[kind].description}</small></span><i className="pi pi-plus" aria-hidden /></button></div>)}
      </aside>
      <main className={styles.canvasArea}><div className={styles.canvasToolbar}><span><i className="pi pi-circle-fill" aria-hidden />Основной репетитор</span><div><button type="button" title="Показать весь поток" onClick={() => { void canvas.fitView({ padding: .15, duration: 300 }); }}><i className="pi pi-expand" aria-hidden /><span>Весь поток</span></button><button type="button" disabled={![...selectedNodes, ...selectedEdges].some(id => !isRuntimeId(id))} onClick={removeSelection} aria-label="Удалить выделенные узлы и связи"><i className="pi pi-trash" aria-hidden /></button><button type="button" onClick={exportGraph} title="Экспорт JSON"><i className="pi pi-download" aria-hidden /><span>JSON</span></button><button type="button" onClick={() => fileRef.current?.click()} title="Импорт JSON" aria-label="Импорт JSON"><i className="pi pi-upload" aria-hidden /></button><button type="button" onClick={() => void restoreExample()} title="Восстановить пример" aria-label="Восстановить пример"><i className="pi pi-replay" aria-hidden /></button></div></div>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={e => { void importGraph(e.target.files?.[0]); e.target.value = ''; }} />
        <nav className={styles.runtimeNavigation} aria-label="Существующие этапы бота"><span>До и вокруг графа уже работают:</span><button type="button" onClick={() => { setRunPick(''); showRuntime('prompt_base'); }}>Полные инструкции</button><button type="button" onClick={() => showRuntime('request')}>Итоговый запрос</button><a href="#tutor-studio-presets">Параметры тарифов</a><button type="button" onClick={() => showRuntime('settings')}>Распознавание · настройки</button><button type="button" onClick={() => showRuntime('merge')}>Склейка вариантов</button><button type="button" onClick={() => showRuntime('journal')}>Где копятся реплики</button><button type="button" onClick={() => showRuntime('loop_decision')}>Цикл поиска и команд</button></nav>
        <div className={styles.flow} onFocusCapture={hover.focus} onBlurCapture={hover.leave} onClickCapture={hover.portClick} onKeyDownCapture={hover.activate}>
          <ReactFlow connectOnClick={false} onEdgeClick={hover.onEdgeClick} onNodeMouseEnter={hover.onNodeMouseEnter} onNodeMouseLeave={hover.leave} onEdgeMouseEnter={hover.onEdgeMouseEnter} onEdgeMouseLeave={hover.leave} onMoveStart={hover.close} onNodeDragStart={hover.close} onReconnectStart={(_event, edge) => { reconnectingEdge.current = edge.id; hover.close(); }} onReconnectEnd={() => { reconnectingEdge.current = undefined; }} ariaLabelConfig={FLOW_LABELS} nodes={cardNodes} edges={flowEdges} nodeTypes={NODE_TYPES} edgeTypes={EDGE_TYPES} onNodesChange={changeNodes} onEdgesChange={changeEdges} onConnect={connection => setGraph(current => syncContextOrders(cleanGraph({ ...current, edges: addEdge({ ...connection, id: uid('edge') }, current.edges) })))} onReconnect={(old, connection) => setGraph(current => syncContextOrders(cleanGraph({ ...current, edges: reconnectEdge(old, connection, current.edges) })))} isValidConnection={validConnection} onPaneClick={() => { hover.close(); setSelectedNodes([]); setSelectedEdges([]); }} onDrop={e => { e.preventDefault(); const kind = e.dataTransfer.getData('application/tutor-node'); if (KINDS.includes(kind as Kind)) addNode(kind as Kind, canvas.screenToFlowPosition({ x: e.clientX, y: e.clientY })); }} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} fitView fitViewOptions={{ padding: .16 }} minZoom={.15} maxZoom={2} deleteKeyCode={null} multiSelectionKeyCode={['Meta', 'Control']} selectionOnDrag panOnDrag={[1, 2]} panOnScroll selectionKeyCode="Shift" connectionLineStyle={{ stroke: '#6366f1', strokeWidth: 3 }} defaultEdgeOptions={{ type: 'studio', reconnectable: true }} proOptions={{ hideAttribution: false }} aria-label="Граф потока репетитора"><Background gap={20} size={1} /><Controls showInteractive={false} /><MiniMap nodeColor={node => META[node.type as Kind]?.color ?? '#888'} pannable zoomable /></ReactFlow>
        </div><div className={styles.canvasFooter}><span>{graph.nodes.length} узлов · {graph.edges.length} связей{pipeline.cards.length > 0 && ` + ${pipeline.cards.length} этапов шлюза`}</span><span>Потяните от порта к порту · край связи можно переподключить</span></div>
      </main>
      <aside className={styles.inspector}>{selected && runtimeData(selected) ? <RuntimePipelineInspector node={selected} /> : selected?.type === 'module' ? <><h3>{moduleDefinition(selected.data)?.name}<code className={styles.nodeId}>{selected.id}</code></h3><p>Версия {moduleDefinition(selected.data)?.version} закреплена в этой карточке. Изменение библиотеки её не заменяет.</p><button type="button" onClick={() => openModule(selected)}>Открыть внутреннюю схему</button><button type="button" onClick={removeSelection}>Удалить карточку из схемы</button></> : <NodeInspector tariff={tariff} graph={graph} testSources={parsedSources.sources} sourceError={parsedSources.error} node={selected} issues={selected ? issues.nodes[selected.id] ?? [] : []} events={pickedRun?.events.filter(event => event.nodeId === selected?.id) ?? []} patch={data => { if (selected) setGraph(current => ({ ...current, nodes: current.nodes.map(node => node.id === selected.id ? { ...node, data: { ...node.data, ...data } } : node) })); }} remove={removeSelection} />}</aside>
    </div>
    <div className={`${styles.validation} ${issues.problem ? styles.invalid : ''}`}><i className={`pi ${issues.problem ? 'pi-exclamation-circle' : 'pi-check-circle'}`} aria-hidden /><span>{issues.problem || 'Граф прошёл проверку. Его можно сохранить и проверить на учебном событии.'}</span>{Object.keys(issues.nodes).length > 0 && <button type="button" onClick={() => { const id = Object.keys(issues.nodes)[0]; setSelectedNodes([id]); void canvas.fitView({ nodes: [{ id }], padding: .7, duration: 250 }); }}>Показать узел с ошибкой</button>}</div>
    <section className={styles.testPanel} aria-label="Тесты и история запусков"><div className={styles.testHeader}><div className={styles.testTabs}><button type="button" aria-pressed={testTab === 'input'} onClick={() => setTestTab('input')}><i className="pi pi-sliders-h" aria-hidden />Тестовое событие</button><button type="button" aria-pressed={testTab === 'events'} onClick={() => setTestTab('events')}><i className="pi pi-list" aria-hidden />События и результаты {pickedRun && <span>{pickedRun.events.length}</span>}</button></div><div className={styles.testActions}><label className={styles.testPreset}>Тариф теста<select aria-label="Тариф теста" value={previewPreset} disabled={running} onChange={event => setPreviewPreset(event.target.value as TutorPresetId)}>{PRESET_IDS.map(id => <option key={id} value={id}>{STUDIO_PRESET_NAMES[id]}</option>)}</select></label><button type="button" disabled={!ready || running || Boolean(issues.problem)} onClick={() => void testFlow(false)} title="Ctrl / ⌘ Enter"><i className="pi pi-play" aria-hidden />Проверить поток · без модели</button><button type="button" className={styles.primary} disabled={!ready || running || Boolean(issues.problem)} onClick={() => void testFlow(true)}><i className="pi pi-sparkles" aria-hidden />Запустить с моделью · за кредиты</button>{running && <button type="button" className={styles.deleteButton} onClick={cancelRun}>Отменить</button>}</div></div>
      <p className={styles.testExplanation}>Только введённые ниже учебные данные. Проверка идёт через тот же исполнитель шлюза; несохранённый граф допустим для теста. Тест использует сохранённый тариф «{STUDIO_PRESET_NAMES[previewPreset]}», выбранный для предпросмотра. Несохранённые настройки редактора в тест не передаются. Команды показываются без выполнения, озвучка не создаётся. Снимки page.context / lesson.context сами не вызывают платный запрос — в студии запуск всегда явный.</p>
      <ExecutionControls graph={graph} pauseBefore={pauseBefore} onPauseBefore={setPauseBefore} run={pickedRun} running={running} onResume={run => void testFlow(run.live, run)} />
      {testTab === 'input' ? <div className={styles.testInputs}><div><label className={styles.field}>Тип события<select value={testType} onChange={e => setTestType(e.target.value)}>{EVENTS.map(event => <option key={event} value={event}>{EVENT_LABELS[event] ?? event}</option>)}</select></label><label className={styles.field}>Учебный текст / расшифровка<textarea rows={4} maxLength={12000} value={transcript} onChange={e => setTranscript(e.target.value)} /></label><label className={styles.field}>Текущая страница<input maxLength={2000} value={currentPage} onChange={e => setCurrentPage(e.target.value)} /></label>{testType === 'tool.result' && <label className={styles.field}>Учебный результат инструмента (JSON)<textarea rows={4} value={toolResult} maxLength={12000} onChange={e => setToolResult(e.target.value)} /></label>}</div><TestSourcesPanel sourceText={sourceText} onChange={setSourceText} onExample={loadTimelineExample} /></div> : <div className={styles.runWorkspace}><aside className={styles.runHistory}><h3>Запуски <span>{runs.length}/20</span></h3><p className={styles.hint}>В памяти этой вкладки</p>{runs.map(run => <button type="button" key={run.id} aria-pressed={run.id === runPick} onClick={() => setRunPick(run.id)}><span><i className={`pi ${run.error ? 'pi-times-circle' : run.paused ? 'pi-pause-circle' : run.done ? 'pi-check-circle' : 'pi-spin pi-spinner'}`} aria-hidden />{run.live ? 'С моделью' : 'Без модели'}</span><small>{new Date(run.started).toLocaleTimeString('ru-RU')} · {STUDIO_PRESET_NAMES[(run.preset ?? 'standard') as TutorPresetId]} · {run.versionId ? `#${run.versionId}` : 'черновик / шаблон'}</small></button>)}</aside><div className={styles.runResult}>{pickedRun ? <><div className={styles.runTitle}><h3>{pickedRun.name}</h3><span>{pickedRun.error ? 'Ошибка / отмена' : pickedRun.paused ? 'Приостановлен' : pickedRun.done ? 'Завершён' : 'Выполняется…'}</span></div>{pickedRun.error && <p className={styles.error}>{pickedRun.error}</p>}{pickedRun.reply && <div className={styles.reply}><small>{pickedRun.live ? 'Ответ модели' : 'Результат проверки без модели'}</small><p>{pickedRun.reply}</p></div>}{pickedRun.command != null && <details open><summary>Предложенная команда · не выполнялась</summary><pre>{pretty(pickedRun.command)}</pre></details>}{pickedRun.usage != null && <details open><summary>Фактический usage провайдера</summary><pre>{pretty(pickedRun.usage)}</pre></details>}{pickedRun.events.length ? pickedRun.events.map((event, index) => <TraceDetails key={index} event={event} />) : <p className={styles.hint}>{pickedRun.done ? 'Шлюз не вернул события узлов.' : 'Ожидаем авторизацию и события шлюза…'}</p>}</> : <div className={styles.emptyRuns}><i className="pi pi-play-circle" aria-hidden /><h3>Проверьте поток</h3><p>Отправьте учебное событие. Здесь появятся трасса узлов, входы, выходы и фактический результат.</p></div>}</div></div>}
    </section>
    </>}
    </div>
    </div>
    <ModuleStudio open={modulesOpen} adminId={adminId} initial={moduleInitial} initialEvents={pickedRun?.events.filter(event => moduleOrigin && event.nodeId.startsWith(`${moduleOrigin}__`)).map(event => ({ ...event, nodeId: event.nodeId.slice((moduleOrigin?.length ?? 0) + 2) })) ?? []} onClose={() => setModulesOpen(false)} onInsert={definition => { const id = uid('module'); setGraph(current => ({ ...current, nodes: [...current.nodes, { id, type: 'module', position: { x: 1100, y: 650 }, data: { definition } }] })); setSelectedNodes([id]); setNotice('Модуль добавлен как черновик. Подключите порты, сохраните и включите версию схемы.'); }} onApply={moduleOrigin ? definition => setGraph(current => ({ ...current, nodes: current.nodes.map(node => node.id === moduleOrigin ? { ...node, data: { definition } } : node) })) : undefined} />
    {replaceRequested && <ReplaceGraphDialog onAnswer={answerReplacement} />}
    {!replaceRequested && hover.target && <TraceHoverCard target={hover.target} preview={hover.preview} title={hover.title} id={hover.id} onClose={hover.close} />}
  </section>;
}
