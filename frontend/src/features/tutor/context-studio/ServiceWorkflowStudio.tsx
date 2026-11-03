'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ReactFlowProvider, ReactFlow, Background, Controls, MiniMap, Handle, Position, MarkerType, applyNodeChanges, applyEdgeChanges, addEdge, reconnectEdge, useReactFlow, useNodesInitialized, useUpdateNodeInternals, type Node, type NodeProps, type NodeChange, type EdgeChange, type Connection } from '@xyflow/react';
import { clientApi } from '@/lib/client-api';
import reasoning from '@/config/tutor-reasoning.json';
import { META, errorText, type Config, type FlowGraph, type FlowNode, type TraceEvent } from './flowEditor';
import { updateCanvasGeometry, type CanvasGeometry } from './canvasGeometry';
import { edgePresentation, edgeFocus, portColour, PORT_COLOURS } from './edgePresentation';
import { StudioEdge } from './StudioEdge';
import { useTraceHover } from './useTraceHover';
import { TraceHoverCard } from './TraceHoverCard';
import { LiveTracePanel } from './LiveTracePanel';
import { ReplaceGraphDialog } from './ReplaceGraphDialog';
import styles from './context-studio.module.css';

export const SCHEME_NAMES: Record<string, string> = { tutor: 'Основной чат', exams: 'Экзамены', english_exams: 'Экзамены · английский', translation: 'Проверка перевода', memory: 'Память диалогов', references: 'Латышские справочники' };
type Graph = Omit<FlowGraph, 'version' | 'edges'> & { version: 1; edges: (FlowGraph['edges'][number] & { channel?: 'stored' })[] };
type Version = { id: number; name: string; created_at: string; graph: Graph };
type Scheme = { id: string; name: string; roles: string[]; default_graph: Graph; versions: Version[]; head: number | null; active: number | null; revision: string };
type Catalog = Record<string, Scheme>;
type Draft = { graph: Graph; baseline: string; loaded: number | null; revision: string };
type EventLink = { id: string; label: string; colour: string };
type ContextPort = { id: string; label: string; key: string };
type StudioData = Config & { kind: FlowNode['type']; patch: (value: Config) => void; resizeInputs?: (count: number) => void; selected?: boolean; linked?: boolean; eventLinks?: EventLink[] };
const NODE_TYPES = Object.fromEntries(['event', 'source', 'prompt', 'context', 'serialize', 'model', 'tools', 'reply'].map(kind => [kind, WorkflowNode]));
const EDGE_TYPES = { studio: StudioEdge };
const ARIA = { 'controls.ariaLabel': 'Управление холстом', 'controls.zoomIn.ariaLabel': 'Приблизить', 'controls.zoomOut.ariaLabel': 'Отдалить', 'controls.fitView.ariaLabel': 'Показать все ноды', 'minimap.ariaLabel': 'Мини-карта модуля' };
const copy = <T,>(value: T): T => structuredClone(value);
export function serviceNodesForStorage(nodes: FlowNode[]): FlowNode[] { return nodes.map(({ id, type, position, data }) => ({ id, type, position, data })); }
const eventHandle = (id: string) => `event-link:${id}`;
export function canonicalEventConnection(connection: Connection): Connection {
  return connection.sourceHandle?.startsWith('event-link:') ? { ...connection, sourceHandle: 'out' } : connection;
}

export function resizeServiceInputs(node: FlowNode, edges: Graph['edges'], count: number) {
  if (!Number.isInteger(count) || count < 1 || count > 16) throw Error('Укажите от 1 до 16 входов.');
  const inputs = node.data.inputs as ContextPort[], order = node.data.order as string[];
  const removed = inputs.slice(count);
  if (edges.some(edge => edge.target === node.id && removed.some(port => port.id === edge.targetHandle))) throw Error('Сначала отключите линии от удаляемых входов.');
  const next = inputs.slice(0, count).map(port => ({ ...port }));
  while (next.length < count) {
    const number = Array.from({ length: 16 }, (_, i) => i + 1).find(n => !next.some(port => port.id === `in${n}`))!;
    let key = `extra${number}`, suffix = 1;
    while (next.some(port => port.key === key)) key = `extra${number}_${suffix++}`;
    next.push({ id: `in${number}`, label: `Дополнительно ${number}`, key });
  }
  const ids = new Set(next.map(port => port.id));
  return { inputs: next, order: [...order.filter(id => ids.has(id)), ...next.filter(port => !order.includes(port.id)).map(port => port.id)] };
}

function ContextInputCount({ count, resize }: { count: number; resize: (count: number) => void }) {
  const [value, setValue] = useState(String(count));
  return <div className={`nodrag nopan ${styles.contextInputCount}`}><label>Количество входов<input type="number" min={1} max={16} value={value} onChange={event => setValue(event.target.value)} /></label><button type="button" onClick={() => resize(Number(value))}>Применить</button></div>;
}

function eventLabel(node?: FlowNode) {
  const role = String(node?.data.role ?? '');
  if (role === 'examiner_en' || role === 'examiner') return 'Экзамен отправлен на проверку';
  if (role.startsWith('exam_stt_')) return 'Устный ответ записан';
  return String(node?.data.title || 'Событие вызова');
}

/** One event may fan out to several destinations; these are connections, not separate events. */
export function eventConnections(graph: Graph, sourceId: string): EventLink[] {
  const outgoing = graph.edges.filter(edge => edge.source === sourceId).slice().sort((a, b) => a.target.localeCompare(b.target, 'en', { numeric: true }) || a.id.localeCompare(b.id));
  const source = graph.nodes.find(node => node.id === sourceId);
  return outgoing.map((edge, index) => {
    return { id: edge.id, label: eventLabel(source), colour: PORT_COLOURS[index % PORT_COLOURS.length] };
  });
}

function WorkflowNode({ id, data, selected }: NodeProps<Node<StudioData>>) {
  const meta = META[data.kind], inputs = data.kind === 'context' ? data.inputs as { id: string; label: string; key: string }[] : [];
  const updateNodeInternals = useUpdateNodeInternals();
  const portSignature = data.kind === 'context' ? (data.order as string[] | undefined)?.join('|') ?? '' : data.eventLinks?.map(link => link.id).join('|') ?? '';
  useEffect(() => { if (data.kind === 'event' || data.kind === 'context') updateNodeInternals(id); }, [data.kind, id, portSignature, updateNodeInternals]);
  const stt = String(data.role).startsWith('exam_stt_');
  const eventTitle = data.role === 'examiner_en' && data.title === 'Экзаменатор · английский' ? 'Английский экзамен отправлен на проверку' : data.title;
  const order = data.order as string[] | undefined;
  return <article className={`${styles.nodeCard} ${data.kind === 'context' ? styles.mergeCard : ''} ${selected ? styles.selectedCard : ''}`} style={{ '--node-accent': meta.color } as CSSProperties} data-linked={data.linked || undefined}>
    {!['event', 'context'].includes(data.kind) && <Handle type="target" position={Position.Left} id="in" role="button" tabIndex={0} aria-label="Вход" />}
    <div className={styles.cardHeading}><span className={styles.nodeIcon}><i className={`pi ${meta.icon}`} aria-hidden /></span><strong>{data.kind === 'model' ? data.title as string : stt && data.kind === 'context' ? 'Параметры аудиозапроса' : meta.label}</strong></div>
    {data.kind === 'context' ? <><label className="nodrag">Результат сборки<select disabled={stt} value={String(data.mode)} onChange={event => data.patch({ mode: event.target.value })}><option value="object">Объект</option><option value="text">Текст</option><option value="json">JSON</option></select></label>{data.resizeInputs && <ContextInputCount key={inputs.length} count={inputs.length} resize={data.resizeInputs} />}<p className={styles.contextKeyHint}>Ключи используются при передаче объекта как текста или JSON.</p>{order?.map((id, index) => { const input = inputs.find(item => item.id === id)!; return <div className={styles.livePort} key={id}><Handle type="target" position={Position.Left} id={id} style={{ background: portColour(id), left: -18 }} role="button" tabIndex={0} aria-label={`Вход ${id}: ${input.label}`} /><div className={`nodrag nopan ${styles.servicePortFields}`}><small>{id}</small><input aria-label={`Подпись ${id}`} value={input.label} maxLength={80} onChange={event => data.patch({ inputs: inputs.map(port => port.id === id ? { ...port, label: event.target.value } : port) })} /><input aria-label={`Ключ объекта ${id}`} value={input.key} maxLength={60} onChange={event => data.patch({ inputs: inputs.map(port => port.id === id ? { ...port, key: event.target.value } : port) })} /></div><span className="nodrag"><button type="button" disabled={!index} aria-label={`Выше: ${input.label}`} onClick={() => { const next = [...order]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; data.patch({ order: next }); }}>↑</button><button type="button" disabled={index === order.length - 1} aria-label={`Ниже: ${input.label}`} onClick={() => { const next = [...order]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; data.patch({ order: next }); }}>↓</button></span></div>; })}</> : <p className={styles.cardSubtitle}>{String(data.kind === 'prompt' ? data.text : data.kind === 'model' ? `${data.model} · ${data.reasoning} · ${data.maxOutputTokens || 'лимит вызова'}` : data.kind === 'serialize' ? stt ? 'Файл аудио + инструкция · multipart' : data.format : data.kind === 'event' ? eventTitle : data.title ?? '')}</p>}
    {data.kind === 'event' && <div className={styles.eventLinks} aria-label="Выходы события"><small>Одно событие · несколько связей</small>{data.eventLinks?.map(link => <div key={link.id}><span>{link.label}</span><Handle type="source" position={Position.Right} id={eventHandle(link.id)} isConnectable={false} role="button" tabIndex={0} aria-label={`Выход: ${link.label}`} style={{ top: '50%', right: -19, background: link.colour }} /></div>)}<div><span>Новая связь</span><Handle type="source" position={Position.Right} id="out" role="button" tabIndex={0} aria-label="Создать связь от события" style={{ top: '50%', right: -19 }} /></div></div>}
    <div className={styles.cardFooter}><code>{String(data.role)}</code><span>{data.kind === 'tools' || data.kind === 'reply' ? 'Контракт сервиса' : 'Нода модуля'}</span></div>
    {data.kind !== 'event' && <Handle type="source" position={Position.Right} id="out" role="button" tabIndex={0} aria-label="Выход" />}
  </article>;
}

export function ServiceWorkflowStudio({ schemeId, adminId }: { schemeId: string; adminId: number }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null), [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void clientApi<{ data: Catalog }>('/tutor/flows/workflows', { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      setCatalog(result.data); setError('');
      setDrafts(current => {
        const next = { ...current };
        for (const scheme of Object.values(result.data)) if (!next[scheme.id]) {
          const version = scheme.versions.find(v => v.id === (scheme.active ?? scheme.head));
          const graph = copy(version?.graph ?? scheme.default_graph);
          next[scheme.id] = { graph, baseline: JSON.stringify(graph), loaded: version?.id ?? null, revision: scheme.revision };
        }
        return next;
      });
    }).catch(cause => { if (!controller.signal.aborted) setError(errorText(cause)); });
    return () => controller.abort();
  }, [retry]);
  const dirty = Object.values(drafts).some(draft => JSON.stringify(draft.graph) !== draft.baseline);
  useEffect(() => { if (!dirty) return; const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
  if (schemeId === 'tutor') return null;
  const scheme = catalog?.[schemeId], draft = drafts[schemeId];
  return <section aria-label={`Модуль: ${SCHEME_NAMES[schemeId]}`}>
    {error && <p role="alert" className={styles.error}>{error}<button type="button" onClick={() => setRetry(value => value + 1)}>Повторить</button></p>}
    {scheme && draft ? <ReactFlowProvider key={schemeId}><ServiceCanvas scheme={scheme} draft={draft} adminId={adminId}
      patchDraft={update => setDrafts(current => ({ ...current, [schemeId]: { ...current[schemeId], ...update } }))}
      refresh={() => setRetry(value => value + 1)} updateCatalog={setCatalog} /></ReactFlowProvider> : !error && <p>Загружаем схему…</p>}
  </section>;
}

function ServiceCanvas({ scheme, draft, patchDraft, refresh, updateCatalog, adminId }: { scheme: Scheme; draft: Draft; patchDraft: (value: Partial<Draft>) => void; refresh: () => void; updateCatalog: (catalog: Catalog) => void; adminId: number }) {
  const { graph } = draft, dirty = JSON.stringify(graph) !== draft.baseline, canvas = useReactFlow();
  const initialized = useNodesInitialized(), centered = useRef(false);
  useEffect(() => { if (!initialized || centered.current) return; centered.current = true; const context = graph.nodes.find(n => n.type === 'context'); if (context) void canvas.setCenter(context.position.x + 200, context.position.y + 250, { zoom: .65, duration: 150 }); }, [initialized, canvas, graph.nodes]);
  const [selected, setSelected] = useState<string | null>(null), [geometry, setGeometry] = useState<CanvasGeometry>({});
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [version, setVersion] = useState(String(draft.loaded ?? '')), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [live, setLive] = useState(false), [role, setRole] = useState(scheme.roles[0]);
  const [replacement, setReplacement] = useState<Graph | null>(null);
  const [replacementId, setReplacementId] = useState<number | null>(null);
  const [sample, setSample] = useState(JSON.stringify({ model: 'gpt-5.4', input: [{ role: 'user', content: JSON.stringify([{ id: 'example', skill: 'writing', prompt: 'Поздоровайтесь и представьтесь.', rubric: 'Приветствие и имя', maximum: 2, answer: 'Labdien! Mani sauc Anna.' }]) }] }, null, 2));
  const [preview, setPreview] = useState<{ fingerprint: string; request: unknown; events: TraceEvent[] } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { if (!expanded) return; const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [expanded]);
  const flowGraph = graph as unknown as FlowGraph;
  const hover = useTraceHover(flowGraph, preview?.fingerprint === JSON.stringify(graph) ? preview.events : [], true), focused = edgeFocus(graph.edges, hover.highlight, []);
  const node = graph.nodes.find(n => n.id === selected);
  const patchNode = (id: string, data: Config) => patchDraft({ graph: { ...graph, nodes: graph.nodes.map(n => n.id === id ? { ...n, data: { ...n.data, ...data } } : n) } });
  const nodes = graph.nodes.map(n => ({ ...n, ...geometry[n.id], selected: selected === n.id, data: { ...n.data, kind: n.type, eventLinks: n.type === 'event' ? eventConnections(graph, n.id) : undefined, resizeInputs: n.type === 'context' ? (count: number) => { try { const update = resizeServiceInputs(n, graph.edges, count); patchNode(n.id, update); setError(''); } catch (cause) { setError(errorText(cause)); } } : undefined, linked: focused.nodes.has(n.id), patch: (data: Config) => patchNode(n.id, data) } }));
  const edges = graph.edges.map(edge => { const base = edgePresentation(graph.edges, edge), links = graph.nodes.find(n => n.id === edge.source)?.type === 'event' ? eventConnections(graph, edge.source) : [], index = links.findIndex(link => link.id === edge.id), view = index < 0 ? base : { ...base, colour: links[index].colour, lane: .2 + .6 * (index + 1) / (links.length + 1) }; return { ...edge, ...(index >= 0 ? { sourceHandle: eventHandle(edge.id) } : {}), selected: selectedEdge === edge.id, type: 'studio', reconnectable: edge.channel !== 'stored', label: edge.channel === 'stored' ? 'Сохранённая расшифровка · следующий этап' : undefined, data: { ...view, branch: edge.channel === 'stored', highlighted: selectedEdge === edge.id || focused.edges.has(edge.id), muted: !!focused.edges.size && !focused.edges.has(edge.id) }, markerEnd: { type: MarkerType.ArrowClosed, color: view.colour, width: 16, height: 16 } }; });
  function changeNodes(changes: NodeChange[]) {
    setGeometry(current => updateCanvasGeometry(current, changes));
    const selection = changes.filter(change => change.type === 'select' && change.selected).at(-1); if (selection && 'id' in selection) setSelected(selection.id);
    const moves = changes.filter(change => change.type === 'position');
    if (moves.length) patchDraft({ graph: { ...graph, nodes: serviceNodesForStorage(applyNodeChanges(moves, graph.nodes as Node[]) as FlowNode[]) } });
  }
  function changeEdges(changes: EdgeChange[]) { const edits = changes.filter(change => change.type === 'remove' && !graph.edges.some(e => e.id === change.id && e.channel === 'stored')); if (edits.length) patchDraft({ graph: { ...graph, edges: applyEdgeChanges(edits, graph.edges) } }); }
  async function mutate(action: string) {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await clientApi<{ data: Catalog }>(`/tutor/flows/workflows/${scheme.id}/${action}`, { method: 'POST', body: JSON.stringify({ expected_revision: draft.revision, ...(action === 'save' ? { graph } : action === 'activate' ? { version_id: draft.loaded } : {}) }) });
      updateCatalog(result.data); const next = result.data[scheme.id];
      patchDraft({ revision: next.revision, ...(action === 'save' ? { baseline: JSON.stringify(graph), loaded: next.head } : {}) });
      if (action === 'save') setVersion(String(next.head));
      setNotice(action === 'save' ? 'Версия сохранена. Работа функционала ещё не переключена.' : action === 'activate' ? 'Версия модуля применена: новые вызовы функционала используют её связи, инструкции и модели.' : 'Восстановлена исходная работа сервиса.');
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }
  function install(next: Graph, id: number | null) { patchDraft({ graph: copy(next), baseline: JSON.stringify(next), loaded: id, revision: scheme.revision }); setGeometry({}); setSelected(null); setVersion(String(id ?? '')); }
  function replace(next: Graph, id: number | null) { hover.close(); if (dirty) { setReplacement(next); setReplacementId(id); } else install(next, id); }
  function add(type: 'prompt' | 'source') {
    if (type === 'source' && role.startsWith('exam_stt_')) { setError('У аудиораспознавания один файловый источник. Инструкции и модель редактируются отдельно.'); return; }
    const id = `${role}__${type}_${crypto.randomUUID().slice(0, 8)}`, currentRole = role;
    patchDraft({ graph: { ...graph, nodes: [...graph.nodes, { id, type, position: canvas.screenToFlowPosition({ x: 350, y: 400 }), data: type === 'prompt' ? { role: currentRole, text: 'Новая инструкция' } : { role: currentRole, source: 'variables', title: 'Параметры вызова' } }] } }); setSelected(id);
  }
  async function previewRequest() {
    setPreviewing(true); setError('');
    try {
      const fingerprint = JSON.stringify(graph);
      const result = await clientApi<{ data: { request: unknown; events: TraceEvent[] } }>(`/tutor/flows/workflows/${scheme.id}/preview`, { method: 'POST', body: JSON.stringify({ graph, role, body: JSON.parse(sample), variables: { level: 'B2' } }) });
      setPreview({ fingerprint, ...result.data }); setNotice('Учебный запрос собран тем же компилятором, что используется в работе. Модель и инструменты не вызывались. Кликните по порту или линии для просмотра данных.');
    } catch (cause) { setError(errorText(cause)); }
    finally { setPreviewing(false); }
  }
  function removeEdge() { if (graph.edges.some(e => e.id === selectedEdge && !e.channel)) { patchDraft({ graph: { ...graph, edges: graph.edges.filter(e => e.id !== selectedEdge) } }); setSelectedEdge(null); hover.close(); } }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (replacement || live) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); if (!busy && draft.revision === scheme.revision) void mutate('save'); }
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); if (!previewing) void previewRequest(); }
      if ((event.key === 'Delete' || event.key === 'Backspace') && !(event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable="true"]')) removeEdge();
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  });
  const valid = (connection: Connection) => {
    const source = graph.nodes.find(n => n.id === connection.source), target = graph.nodes.find(n => n.id === connection.target);
    const pairs: Record<string, string[]> = { event: ['source', 'prompt'], source: ['context'], prompt: ['context'], context: ['serialize'], serialize: ['model'], model: ['tools'], tools: ['reply'] };
    return !!source && !!target && source.data.role === target.data.role && !!pairs[source.type]?.includes(target.type) && !graph.edges.some(e => e.source === connection.source && e.target === connection.target && e.targetHandle === connection.targetHandle);
  };
  return <><div inert={!!replacement}>
    <nav className={styles.liveControls}><button type="button" aria-pressed={!live} onClick={() => setLive(false)}>Модуль · ноды</button><button type="button" aria-pressed={live} onClick={() => setLive(true)}>История исполнения</button></nav>
    {live ? <><label>Вызов внутри модуля<select value={role} onChange={event => setRole(event.target.value)}>{scheme.roles.map(id => <option key={id} value={id}>{graph.nodes.find(n => n.type === 'model' && n.data.role === id)?.data.title as string}</option>)}</select></label><LiveTracePanel key={role} botId={role} botName={scheme.name} adminId={adminId} initialConversation={null} /></> : <>
    <div className={styles.toolbar}><div className={styles.nameGroup}><label>Название модуля<input value={graph.name} maxLength={120} onChange={event => patchDraft({ graph: { ...graph, name: event.target.value } })} /></label><span>{dirty ? '● Черновик изменён' : draft.loaded ? `Версия #${draft.loaded}` : 'Исходные ноды модуля'} · {scheme.active ? `Работает #${scheme.active}` : 'Исходная работа сервиса'}</span></div><div className={styles.toolbarActions}><button type="button" disabled={busy || draft.revision !== scheme.revision} onClick={() => void mutate('save')}>Сохранить версию модуля</button><button type="button" className={styles.primary} disabled={busy || dirty || !draft.loaded || draft.loaded === scheme.active || draft.revision !== scheme.revision} onClick={() => void mutate('activate')}>Применить версию модуля</button></div></div>
    <div className={styles.versionBar}><label>Версии<select value={version} onChange={event => setVersion(event.target.value)}><option value="">Исходные ноды модуля</option>{scheme.versions.map(v => <option key={v.id} value={v.id}>#{v.id} · {v.name}{v.id === scheme.active ? ' · активна' : ''}</option>)}</select></label><button type="button" disabled={busy} onClick={() => { const chosen = scheme.versions.find(v => v.id === Number(version)); replace(chosen?.graph ?? scheme.default_graph, chosen?.id ?? null); }}>Загрузить</button><button type="button" disabled={busy} onClick={refresh}>Обновить версии</button><button type="button" disabled={busy || !scheme.active} onClick={() => void mutate('deactivate')}>Вернуть исходную работу</button><button type="button" onClick={() => patchDraft({ revision: scheme.revision })} disabled={draft.revision === scheme.revision}>Принять обновлённый список · сохранить черновик</button></div>
    <p className={styles.hint}>Это модуль приложения: в нём могут работать несколько ботов. Линии определяют подключённые инструкции, источники и сборку запроса. У экзаменов распознавание и итоговая проверка запускаются в разное время; расшифровки сохраняются в ответе ученика и поступают в источник проверки. Правила баллов и сохранения результатов остаются обязательными контрактами сервиса.</p>
    {(error || notice) && <p role={error ? 'alert' : 'status'} className={error ? styles.error : styles.notice}>{error || notice}</p>}
    <div className={`${styles.serviceWorkspace} ${expanded ? styles.serviceExpanded : ''}`}>
      <aside className={styles.library}><h2>Ноды модуля</h2><label>Вызов<select value={role} onChange={event => setRole(event.target.value)}>{scheme.roles.map(id => <option key={id} value={id}>{graph.nodes.find(n => n.type === 'model' && n.data.role === id)?.data.title as string}</option>)}</select></label><button type="button" onClick={() => add('prompt')}>+ Инструкция</button><button type="button" onClick={() => add('source')}>+ Источник</button><h3>Найти в модуле</h3>{scheme.roles.map(id => <button type="button" key={id} onClick={() => { const target = graph.nodes.find(n => n.data.role === id && n.type === 'context')!; setRole(id); setSelected(target.id); void canvas.fitView({ nodes: graph.nodes.filter(n => n.data.role === id).map(n => ({ id: n.id })), padding: .12, duration: 200 }); }}>{graph.nodes.find(n => n.data.role === id && n.type === 'model')?.data.title as string}</button>)}</aside>
      <main className={styles.canvasArea}><div className={styles.canvasToolbar}><b>{graph.name}</b><div><button type="button" disabled={!graph.edges.some(e => e.id === selectedEdge && !e.channel)} onClick={removeEdge}>Удалить связь</button><button type="button" onClick={() => void canvas.fitView({ padding: .12 })}>Показать всю схему</button><button type="button" onClick={() => setExpanded(value => !value)}>{expanded ? 'Свернуть холст' : 'Развернуть холст'}</button></div></div><div className={`${styles.flow} ${styles.serviceCanvas}`} onClickCapture={hover.portClick} onKeyDownCapture={hover.activate} onFocusCapture={hover.focus} onBlurCapture={hover.leave}>
        <ReactFlow ariaLabelConfig={ARIA} nodes={nodes} edges={edges} nodeTypes={NODE_TYPES} edgeTypes={EDGE_TYPES} connectOnClick={false} onNodesChange={changeNodes} onEdgesChange={changeEdges} onNodeClick={(_event, n) => { setSelected(n.id); setSelectedEdge(null); }} onPaneClick={() => { setSelected(null); setSelectedEdge(null); hover.close(); }} onConnect={connection => patchDraft({ graph: { ...graph, edges: addEdge({ ...connection, id: crypto.randomUUID() }, graph.edges) } })} isValidConnection={connection => valid(connection as Connection)} onReconnect={(old, connection) => { const original = graph.edges.find(edge => edge.id === old.id); if (original) patchDraft({ graph: { ...graph, edges: reconnectEdge(original, canonicalEventConnection(connection), graph.edges) } }); }} onNodeMouseEnter={hover.onNodeMouseEnter} onNodeMouseLeave={hover.leave} onEdgeMouseEnter={hover.onEdgeMouseEnter} onEdgeMouseLeave={hover.leave} onEdgeClick={(event, edge) => { setSelectedEdge(edge.id); hover.onEdgeClick(event, edge); }} onMoveStart={hover.close} onNodeDragStart={hover.close} fitView fitViewOptions={{ padding: .12 }} minZoom={.15} maxZoom={2} deleteKeyCode={null} panOnDrag={[1, 2]} panOnScroll selectionOnDrag selectionKeyCode="Shift" defaultEdgeOptions={{ type: 'studio', reconnectable: true }} aria-label={`Граф модуля ${scheme.name}`}><Background gap={20} /><Controls showInteractive={false} /><MiniMap pannable zoomable nodeColor={n => META[n.type as FlowNode['type']]?.color ?? '#888'} /></ReactFlow>
      </div><div className={styles.canvasFooter}>{graph.nodes.length} узлов · {graph.edges.length} связей · Выберите карточку для настройки</div></main>
      <aside className={styles.inspector}>{node ? <ServiceNodeInspector node={node} patch={data => patchNode(node.id, data)} remove={() => { patchDraft({ graph: { ...graph, nodes: graph.nodes.filter(n => n.id !== node.id), edges: graph.edges.filter(e => e.source !== node.id && e.target !== node.id) } }); setSelected(null); }} /> : <div className={styles.emptyInspector}><h3>Настройки ноды</h3><p>Выберите инструкцию, модель или сборку контекста прямо на схеме.</p></div>}</aside>
    </div>
    <section className={`${styles.testPanel} ${styles.serviceTest}`} aria-label="Предпросмотр модуля"><h2>Проверка сборки контекста · без модели</h2><p>Только введённый учебный пример. Прогресс, экзамены и кредиты не меняются. Выбран вызов: {role}. Формат оценки и инструменты добавляет рабочий обработчик сервиса; здесь проверяется сборка на введённом теле запроса. Для аудио показываются параметры без загрузки записи.</p><label className={styles.field}>Учебное тело запроса<textarea rows={7} value={sample} maxLength={150000} onChange={event => setSample(event.target.value)} /></label><button type="button" disabled={previewing} onClick={() => void previewRequest()}>{previewing ? 'Собираю…' : 'Собрать запрос · бесплатно'}</button>{preview && <details><summary>Получившийся запрос{preview.fingerprint !== JSON.stringify(graph) ? ' · схема после теста изменена' : ''}</summary><pre>{JSON.stringify(preview.request, null, 2)}</pre></details>}</section>
    </>}
    </div>{replacement && <ReplaceGraphDialog onAnswer={replace => { if (replace) install(replacement, replacementId); setReplacement(null); }} />}
    {hover.target && <TraceHoverCard target={hover.target} preview={hover.preview} title={hover.title} id={hover.id} onClose={hover.close} />}
  </>;
}

function ServiceNodeInspector({ node, patch, remove }: { node: FlowNode; patch: (data: Config) => void; remove: () => void }) {
  const d = node.data, stt = String(d.role).startsWith('exam_stt_');
  const availableEfforts = (reasoning as Record<string, string[]>)[String(d.model)];
  const efforts = availableEfforts?.length ? availableEfforts : d.model === 'inherit' ? ['none', 'low', 'medium', 'high', 'xhigh', 'max'] : ['none'];
  const select = (key: string, label: string, values: string[]) => <label className={styles.field}>{label}<select disabled={stt && key === 'mode'} value={String(d[key])} onChange={event => {
    const value = event.target.value, efforts = (reasoning as Record<string, string[]>)[value];
    patch({ [key]: value, ...(key === 'model' && !stt && value !== 'inherit' && d.reasoning !== 'inherit' && !efforts?.includes(String(d.reasoning)) ? { reasoning: efforts?.[0] ?? 'none' } : {}) });
  }}>{values.map(value => <option key={value} value={value}>{value === 'inherit' ? 'Из настроек вызова' : value}</option>)}</select></label>;
  return <><div className={styles.inspectorTitle}><h3 className={styles.inspectorHeading}>{META[node.type].label}<code className={styles.nodeId} aria-label={`ID ноды: ${node.id}`} title="ID ноды · можно выделить и скопировать">{node.id}</code></h3></div>
    {node.type === 'prompt' && <label className={styles.field}>Инструкция<textarea rows={18} maxLength={16000} value={String(d.text)} onChange={event => patch({ text: event.target.value })} /><small>{'{{level}}'} — уровень задания, если передан сервисом</small></label>}
    {node.type === 'source' && <>{select('source', 'Источник', stt ? ['request'] : ['request', 'variables'])}<p>request — фактические данные задания, ответа или аудиозаписи. variables — параметры вызова. Данные ученика передаются отдельно от инструкций.</p></>}
    {node.type === 'model' && <>{select('model', 'Модель', stt ? ['gpt-transcribe', 'gpt-4o-transcribe', 'gpt-4o-mini-transcribe', 'whisper-1'] : ['inherit', ...Object.keys(reasoning)])}{!stt && <>{select('reasoning', 'Мышление', ['inherit', ...efforts])}<label className={styles.field}>Лимит ответа<input type="number" min={0} max={16000} value={Number(d.maxOutputTokens)} onChange={event => patch({ maxOutputTokens: Number(event.target.value) })} /><small>0 — лимит вызова. Несовместимое с моделью мышление сервер не сохранит.</small></label></>}</>}
    {node.type === 'context' && <><p>Количество, подписи, ключи и порядок входов настраиваются в карточке. Подключённый вход нельзя удалить, пока его линия не отключена. Ключи используются при передаче объекта как текста или JSON; при формате сообщений данные передаются отдельными сообщениями.</p>{select('mode', 'Результат сборки', ['object', 'text', 'json'])}{(d.inputs as { id: string; label: string; key: string }[]).map(input => <label className={styles.field} key={input.id}>{input.id} · подпись<input value={input.label} maxLength={80} onChange={event => patch({ inputs: (d.inputs as Config[]).map(p => p.id === input.id ? { ...p, label: event.target.value } : p) })} />Ключ объекта<input value={input.key} maxLength={60} onChange={event => patch({ inputs: (d.inputs as Config[]).map(p => p.id === input.id ? { ...p, key: event.target.value } : p) })} /></label>)}</>}
    {node.type === 'serialize' && (stt ? <p>Аудиозапись и инструкция передаются как multipart. Порядок полей не меняет протокол распознавания.</p> : select('format', 'Формат для модели', ['messages', 'text', 'json']))}
    {['event', 'tools', 'reply'].includes(node.type) && <><p>{String(d.title)}</p><p>Это привязка к реальному событию и обработчику сервиса. Проверка баллов, сохранение и разрешённые справочники остаются защищёнными.</p></>}
    {['prompt', 'source'].includes(node.type) && <button type="button" className={styles.deleteButton} onClick={remove}>Удалить карточку</button>}
  </>;
}
