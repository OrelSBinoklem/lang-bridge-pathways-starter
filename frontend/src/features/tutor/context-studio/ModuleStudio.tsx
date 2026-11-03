'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type SetStateAction } from 'react';
import { ReactFlow, ReactFlowProvider, Background, Controls, Handle, Position, MarkerType, applyNodeChanges, applyEdgeChanges, addEdge, useReactFlow, useNodesInitialized, type NodeProps, type Node, type NodeChange, type EdgeChange } from '@xyflow/react';
import { createModuleDefinition, validateModuleDefinition } from '../../../../../resources/tutor-flow/graph.mjs';
import { clientApi } from '@/lib/client-api';
import { NodeInspector } from './NodeInspector';
import { ContextAssembly } from './ContextAssembly';
import { ModuleCard, moduleDefinition } from './ModuleCard';
import { META, initialData, errorText, SOURCE_LABELS, type Kind, type Config, type FlowGraph, type FlowNode, type ModuleDefinition, type ModulePort, type TraceEvent } from './flowEditor';
import { validFlowConnection, syncContextOrders } from './contextOrder';
import { StudioEdge } from './StudioEdge';
import { edgePresentation } from './edgePresentation';
import { useTraceHover } from './useTraceHover';
import { TraceHoverCard } from './TraceHoverCard';
import { updateCanvasGeometry, type CanvasGeometry } from './canvasGeometry';
import styles from './context-studio.module.css';
import moduleStyles from './modules.module.css';
import { HandlerSourceLinks } from './HandlerSourceLinks';
import { cleanModule, createModuleDraft, moduleDraftReducer } from './moduleDraft';

const INTERNAL: Kind[] = ['source', 'prompt', 'condition', 'context', 'serialize', 'mcp', 'model'];
const uid = (prefix: string) => `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
const asGraph = (definition: ModuleDefinition): FlowGraph => ({ version: 2, name: definition.name, nodes: definition.nodes, edges: definition.edges });
const copy = <T,>(value: T): T => structuredClone(value);
function WireBuilder({ graph, onAdd }: { graph: FlowGraph; onAdd: (wire: { source: string; target: string; sourceHandle: string; targetHandle: string }) => void }) {
  const [source, setSource] = useState(graph.nodes.find(node => node.type !== 'module_output')?.id ?? ''), [target, setTarget] = useState(graph.nodes.find(node => node.type !== 'module_input' && node.id !== source)?.id ?? '');
  const [sourcePort, setSourcePort] = useState('out'), [targetPort, setTargetPort] = useState('in');
  const from = graph.nodes.find(node => node.id === source), to = graph.nodes.find(node => node.id === target);
  const outPorts = from?.type === 'module' ? moduleDefinition(from.data)?.outputs ?? [] : from?.type === 'condition' ? [{ id: 'true', label: 'Да' }, { id: 'false', label: 'Нет' }] : [{ id: 'out', label: 'Выход' }];
  const inPorts = to?.type === 'module' ? moduleDefinition(to.data)?.inputs ?? [] : to?.type === 'context' ? (to.data.inputs ?? []) as ModulePort[] : [{ id: 'in', label: 'Вход' }];
  return <div className={moduleStyles.wireForm}><label>Из ноды<select value={source} onChange={event => { setSource(event.target.value); setSourcePort(''); }}>{graph.nodes.filter(node => node.type !== 'module_output').map(node => <option key={node.id} value={node.id}>{META[node.type].label} · {node.id}</option>)}</select></label><label>Выход<select value={outPorts.some(port => port.id === sourcePort) ? sourcePort : outPorts[0]?.id ?? ''} onChange={event => setSourcePort(event.target.value)}>{outPorts.map(port => <option key={port.id} value={port.id}>{port.label} · {port.id}</option>)}</select></label><span>→</span><label>В ноду<select value={target} onChange={event => { setTarget(event.target.value); setTargetPort(''); }}>{graph.nodes.filter(node => node.type !== 'module_input').map(node => <option key={node.id} value={node.id}>{META[node.type].label} · {node.id}</option>)}</select></label><label>Вход<select value={inPorts.some(port => port.id === targetPort) ? targetPort : inPorts[0]?.id ?? ''} onChange={event => setTargetPort(event.target.value)}>{inPorts.map(port => <option key={port.id} value={port.id}>{port.label} · {port.id}</option>)}</select></label><button type="button" onClick={() => onAdd({ source, target, sourceHandle: outPorts.find(port => port.id === sourcePort)?.id ?? outPorts[0]?.id ?? '', targetHandle: inPorts.find(port => port.id === targetPort)?.id ?? inPorts[0]?.id ?? '' })}>Соединить</button></div>;
}
type CardData = Config & { kind: Kind; node: FlowNode; graph: FlowGraph; definition: ModuleDefinition; patch: (data: Config) => void; open: (definition: ModuleDefinition) => void };

function FragmentNode({ id, data, selected }: NodeProps<Node<CardData>>) {
  const kind = data.kind, node = data.node, meta = META[kind];
  if (kind === 'module') return <ModuleCard id={id} definition={moduleDefinition(node.data)} selected={selected} open={() => { const value = moduleDefinition(node.data); if (value) data.open(value); }} />;
  const boundary = kind === 'module_input' || kind === 'module_output';
  const port = boundary ? (kind === 'module_input' ? data.definition.inputs : data.definition.outputs).find(item => item.id === node.data.port) : undefined;
  const label = boundary ? port?.label ?? String(node.data.port) : kind === 'source' ? SOURCE_LABELS[String(node.data.source)] : kind === 'prompt' ? String(node.data.text) : kind === 'mcp' ? String(node.data.service) : meta.description;
  return <article className={`${styles.nodeCard} ${selected ? styles.selectedCard : ''} ${kind === 'context' ? styles.mergeCard : ''}`} style={{ '--node-accent': meta.color } as CSSProperties}>
    {!['module_input', 'context'].includes(kind) && <Handle type="target" id="in" position={Position.Left} role="button" tabIndex={0} aria-label="Вход" />}
    <div className={styles.cardHeading}><i className={`pi ${meta.icon}`} aria-hidden /><strong>{meta.label}</strong></div>
    {kind === 'context' ? <ContextAssembly graph={data.graph} node={node} patch={data.patch} upgrade={() => {}} /> : <p className={styles.cardSubtitle}>{label}</p>}
    <div className={styles.cardFooter}><code>{id}</code><small>{boundary ? String(node.data.port) : kind}</small></div>
    {kind === 'mcp' && <div className="nodrag nopan"><HandlerSourceLinks service={String(node.data.service)} /></div>}
    {kind === 'condition' ? <><Handle type="source" id="true" position={Position.Right} style={{ top: '40%' }} role="button" tabIndex={0} aria-label="Да" /><Handle type="source" id="false" position={Position.Right} style={{ top: '80%' }} role="button" tabIndex={0} aria-label="Нет" /></> : kind !== 'module_output' && <Handle type="source" id="out" position={Position.Right} role="button" tabIndex={0} aria-label="Выход" />}
  </article>;
}
const NODE_TYPES = Object.fromEntries([...INTERNAL, 'module_input', 'module_output', 'module'].map(kind => [kind, FragmentNode]));
const EDGE_TYPES = { studio: StudioEdge };

export function ModuleStudio({ open, adminId, initial, initialEvents = [], onClose, onInsert, onApply }: { open: boolean; adminId: number; initial?: ModuleDefinition; initialEvents?: TraceEvent[]; onClose: () => void; onInsert: (definition: ModuleDefinition) => void; onApply?: (definition: ModuleDefinition) => void }) {
  return <ReactFlowProvider><ModuleWorkspace key={initial ? `${initial.id}:${initial.version}` : 'library'} open={open} adminId={adminId} initial={initial} initialEvents={initialEvents} onClose={onClose} onInsert={onInsert} onApply={onApply} /></ReactFlowProvider>;
}
function ModuleWorkspace({ open, initial, initialEvents, onClose, onInsert, onApply }: Omit<Parameters<typeof ModuleStudio>[0], 'initialEvents'> & { initialEvents: TraceEvent[] }) {
  const [catalog, setCatalog] = useState<ModuleDefinition[]>([]), [loaded, setLoaded] = useState(false);
  const [draftState, dispatch] = useReducer(moduleDraftReducer, null, () => createModuleDraft(initial ?? createModuleDefinition({ id: uid('module'), name: 'Новый модуль', inputs: 1, outputs: 1 }) as ModuleDefinition, Boolean(initial)));
  const { draft, baseline, saved } = draftState;
  const setDraft = useCallback((update: SetStateAction<ModuleDefinition>) => dispatch({ type: 'edit', update }), []);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [selected, setSelected] = useState<string>(), [geometry, setGeometry] = useState<CanvasGeometry>({}), [selectedEdges, setSelectedEdges] = useState<string[]>([]);
  const [nested, setNested] = useState<ModuleDefinition>();
  const [wireForm, setWireForm] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null), viewport = useRef<HTMLDivElement>(null);
  const canvas = useReactFlow(), initialized = useNodesInitialized();
  const graph = useMemo(() => asGraph(draft), [draft]);
  const dirty = baseline !== JSON.stringify(cleanModule(draft));
  const hover = useTraceHover(graph, initialEvents);
  const current = draft.nodes.find(node => node.id === selected);
  useEffect(() => { if (open && !dialog.current?.open) dialog.current?.showModal(); if (!open && dialog.current?.open) dialog.current?.close(); }, [open]);
  useEffect(() => {
    if (!open || !initialized || !viewport.current) return;
    let fitted = false, frame = 0;
    const observer = new ResizeObserver(entries => { if (fitted || !entries[0]?.contentRect.width || !entries[0]?.contentRect.height) return; fitted = true; frame = requestAnimationFrame(() => { void canvas.fitView({ padding: .18, maxZoom: 1 }); }); });
    observer.observe(viewport.current); return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [open, initialized, canvas]);
  useEffect(() => {
    if (!open || loaded) return;
    const controller = new AbortController();
    void clientApi<{ data: { modules: ModuleDefinition[] } }>('/tutor/flows/modules', { signal: controller.signal }).then(response => { setCatalog(response.data.modules); setLoaded(true); }).catch(cause => { if (!controller.signal.aborted) setError(errorText(cause)); });
    return () => controller.abort();
  }, [open, loaded]);
  const patch = useCallback((id: string, data: Config) => setDraft(value => ({ ...value, nodes: value.nodes.map(node => node.id === id ? { ...node, data: { ...node.data, ...data } } : node) })), [setDraft]);
  const nodes = useMemo(() => draft.nodes.map(node => ({ ...node, ...geometry[node.id], selected: node.id === selected, deletable: !['module_input', 'module_output'].includes(node.type), data: { kind: node.type, node, graph, definition: draft, patch: (data: Config) => patch(node.id, data), open: setNested } })), [draft, graph, geometry, selected, patch]);
  const edges = draft.edges.map(edge => { const presentation = edgePresentation(draft.edges, edge); return { ...edge, selected: selectedEdges.includes(edge.id), type: 'studio', data: { ...presentation }, markerEnd: { type: MarkerType.ArrowClosed, color: presentation.colour } }; });
  function install(definition: ModuleDefinition) { dispatch({ type: 'load', definition, saved: true }); setSelected(undefined); setSelectedEdges([]); setGeometry({}); hover.close(); setError(''); }
  function newModule() { const value = createModuleDefinition({ id: uid('module'), name: 'Новый модуль', inputs: 1, outputs: 1 }) as ModuleDefinition; dispatch({ type: 'load', definition: value, saved: false }); setSelected(undefined); setSelectedEdges([]); setGeometry({}); setError(''); }
  function changeNodes(changes: NodeChange[]) {
    setGeometry(value => updateCanvasGeometry(value, changes));
    for (const change of changes) if (change.type === 'select' && change.selected) setSelected(change.id);
    const edits = changes.filter(change => change.type === 'position' || change.type === 'remove' && !draft.nodes.some(node => node.id === change.id && ['module_input', 'module_output'].includes(node.type)));
    if (edits.length) setDraft(value => { const nodes = applyNodeChanges(edits, value.nodes as Node[]) as FlowNode[]; return { ...value, nodes, edges: value.edges.filter(edge => nodes.some(node => node.id === edge.source) && nodes.some(node => node.id === edge.target)) }; });
  }
  function changeEdges(changes: EdgeChange[]) {
    for (const change of changes) if (change.type === 'select') setSelectedEdges(value => change.selected ? [...new Set([...value, change.id])] : value.filter(id => id !== change.id));
    const edits = changes.filter(change => change.type !== 'select'); if (edits.length) setDraft(value => ({ ...value, edges: applyEdgeChanges(edits, value.edges) }));
  }
  function ports(side: 'inputs' | 'outputs', count: number) {
    if (!Number.isInteger(count) || count < 1 || count > 16) return;
    const list = draft[side];
    if (count < list.length) {
      const removed = list.slice(count), boundary = side === 'inputs' ? 'module_input' : 'module_output';
      const ids = draft.nodes.filter(node => node.type === boundary && removed.some(port => port.id === node.data.port)).map(node => node.id);
      if (draft.edges.some(edge => ids.includes(edge.source) || ids.includes(edge.target))) { setError('Сначала отключите линии удаляемых портов. Подключения сохранены.'); return; }
      setDraft(value => ({ ...value, [side]: list.slice(0, count), nodes: value.nodes.filter(node => !ids.includes(node.id)) })); return;
    }
    const more: ModulePort[] = [], nodes: FlowNode[] = [];
    for (let i = list.length; i < count; i++) { const port = { id: `${side === 'inputs' ? 'in' : 'out'}${i + 1}`, label: `${side === 'inputs' ? 'Вход' : 'Выход'} ${i + 1}` }; more.push(port); nodes.push({ id: uid(side === 'inputs' ? 'input' : 'output'), type: side === 'inputs' ? 'module_input' : 'module_output', position: { x: side === 'inputs' ? 0 : 800, y: i * 180 }, data: { port: port.id } }); }
    setDraft(value => ({ ...value, [side]: [...list, ...more], nodes: [...value.nodes, ...nodes] }));
  }
  async function save() {
    if (saving.current) return;
    saving.current = true;
    setError(''); setBusy(true);
    try {
      const latest = Math.max(0, ...catalog.filter(item => item.id === draft.id).map(item => item.version));
      const definition = validateModuleDefinition({ ...cleanModule(draft), version: latest + 1 }) as ModuleDefinition;
      const result = await clientApi<{ data: { definition: ModuleDefinition; modules: ModuleDefinition[] } }>('/tutor/flows/modules', { method: 'POST', body: JSON.stringify({ definition, expected_version: latest || null }) });
      setCatalog(result.data.modules);
      dispatch({ type: 'saved', submitted: draft, definition: result.data.definition, generation: draftState.generation });
    } catch (cause) { setError(errorText(cause)); } finally { saving.current = false; setBusy(false); }
  }
  function insert(definition: ModuleDefinition) { onInsert(copy(definition)); onClose(); }
  function add(kind: Kind, definition?: ModuleDefinition) {
    if (draft.nodes.length >= 64) { setError('В модуле допускается до 64 нод.'); return; }
    const id = uid(kind); setDraft(value => ({ ...value, nodes: [...value.nodes, { id, type: kind, position: { x: 400, y: 100 + value.nodes.length * 20 }, data: definition ? { definition: copy(definition) } : initialData(kind) }] })); setSelected(id);
  }
  function connect(wire: { source: string | null; target: string | null; sourceHandle?: string | null; targetHandle?: string | null }) {
    if (!wire.source || !wire.target || !validFlowConnection(graph, wire)) { setError('Эти порты нельзя соединить. Проверьте направление, тип нод и отсутствие цикла.'); return; }
    setDraft(value => { const next = syncContextOrders({ ...asGraph(value), edges: addEdge({ ...wire, source: wire.source!, target: wire.target!, id: uid('edge') }, value.edges) }); return { ...value, edges: next.edges, nodes: next.nodes }; }); setError(''); hover.close();
  }
  function removeSelection() { const ids = draft.nodes.filter(node => node.id === selected && !['module_input', 'module_output'].includes(node.type)).map(node => node.id); setDraft(value => ({ ...value, nodes: value.nodes.filter(node => !ids.includes(node.id)), edges: value.edges.filter(edge => !selectedEdges.includes(edge.id) && !ids.includes(edge.source) && !ids.includes(edge.target)) })); setSelected(undefined); setSelectedEdges([]); hover.close(); }
  const boundary = current && ['module_input', 'module_output'].includes(current.type);
  return <dialog ref={dialog} className={moduleStyles.dialog} onCancel={event => { event.preventDefault(); onClose(); }} aria-label="Библиотека и редактор составных модулей" onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); event.stopPropagation(); if (!busy) void save(); } }}>
    <header className={moduleStyles.header}><div><h2>Составные модули</h2><p>Внешние входы и выходы → обычные ноды внутри → повторное использование</p></div><button type="button" onClick={onClose}>Закрыть · черновик сохранится во вкладке</button></header>
    <div className={moduleStyles.toolbar}><label>Модуль<select aria-label="Сохранённый модуль" value={saved && !dirty ? `${draft.id}:${draft.version}` : ''} onChange={event => { if (dirty) { setError('Сохраните текущий черновик или явно создайте новый модуль перед переключением.'); return; } const value = catalog.find(item => `${item.id}:${item.version}` === event.target.value); if (value) install(value); }}><option value="">Черновик</option>{catalog.map(item => <option key={`${item.id}:${item.version}`} value={`${item.id}:${item.version}`}>{item.name} · v{item.version}</option>)}</select></label><button type="button" onClick={newModule}>Создать новый</button><button type="button" aria-pressed={wireForm} onClick={() => setWireForm(value => !value)}>Добавить связь</button><button type="button" disabled={!selectedEdges.length && (!current || ['module_input', 'module_output'].includes(current.type))} onClick={removeSelection}>Удалить выделенное</button><button type="button" disabled={busy} onClick={() => void save()}>{busy ? 'Сохранение…' : 'Сохранить новую версию'}</button><button type="button" disabled={!saved || dirty || busy} onClick={() => insert(draft)}>Добавить в схему</button>{initial && onApply && <button type="button" disabled={!saved || dirty || busy} onClick={() => { onApply(copy(draft)); onClose(); }}>Применить к выбранной карточке</button>}<small>{!saved || dirty ? 'Несохранённый черновик' : `Сохранена v${draft.version}`}</small></div>
    {wireForm && <WireBuilder key={draft.id} graph={graph} onAdd={connect} />}
    {error && <p className={styles.error} role="alert">{error}<button type="button" onClick={() => setLoaded(false)}>Обновить библиотеку</button></p>}
    <div className={moduleStyles.settings}><label>Название<input value={draft.name} maxLength={120} onChange={event => setDraft(value => ({ ...value, name: event.target.value }))} /></label>{(['inputs', 'outputs'] as const).map(side => <fieldset key={side}><legend>{side === 'inputs' ? 'Входы' : 'Выходы'}</legend><label>Количество<input type="number" min={1} max={16} value={draft[side].length} onChange={event => ports(side, Number(event.target.value))} /></label><div className={moduleStyles.portNames}>{draft[side].map(port => <label key={port.id}>{port.id}<input maxLength={80} aria-label={`Подпись ${side === 'inputs' ? 'входа' : 'выхода'} ${port.id}`} value={port.label} onChange={event => setDraft(value => ({ ...value, [side]: value[side].map(item => item.id === port.id ? { ...item, label: event.target.value } : item) }))} /></label>)}</div></fieldset>)}</div>
    <div className={moduleStyles.workspace}><aside><h3>Внутренние ноды</h3>{INTERNAL.map(kind => <button type="button" key={kind} onClick={() => add(kind)}><i className={`pi ${META[kind].icon}`} aria-hidden />{META[kind].label} +</button>)}<h3>Другие модули</h3>{catalog.filter((item, index, all) => item.id !== draft.id && all.findIndex(other => other.id === item.id) === index).map(item => <button type="button" key={item.id} onClick={() => add('module', item)}>{item.name} · v{item.version} +</button>)}<p>Каждый порт связан с одноимённой граничной нодой. Передаются объекты потока; данные разных запусков не смешиваются.</p></aside>
      <div ref={viewport} className={moduleStyles.canvas} onClickCapture={hover.portClick} onKeyDownCapture={hover.activate}><ReactFlow connectOnClick={false} nodes={nodes} edges={edges} nodeTypes={NODE_TYPES} edgeTypes={EDGE_TYPES} onNodesChange={changeNodes} onEdgesChange={changeEdges} onNodeClick={(_event, node) => setSelected(node.id)} onPaneClick={() => { setSelected(undefined); setSelectedEdges([]); hover.close(); }} isValidConnection={wire => validFlowConnection(graph, wire)} onConnect={connect} onEdgeClick={(event, edge) => { setSelected(undefined); hover.onEdgeClick(event, edge); }} onMoveStart={hover.close} onNodeDragStart={hover.close} fitView minZoom={.15} maxZoom={2} panOnDrag={[1, 2]} panOnScroll deleteKeyCode={null} aria-label="Внутренняя схема модуля"><Background /><Controls showInteractive={false} /></ReactFlow></div>
      <aside className={moduleStyles.inspector}>{boundary ? <><h3>{META[current.type].label} <code>{current.id}</code></h3><p>Внешний порт: <b>{String(current.data.port)}</b>. Подпись и число портов задаются сверху. Для удаления сначала отключите линии, затем уменьшите число портов.</p></> : current?.type === 'module' ? <><h3>{moduleDefinition(current.data)?.name}</h3><button type="button" onClick={() => setNested(moduleDefinition(current.data))}>Открыть внутреннюю схему</button><button type="button" onClick={() => setDraft(value => ({ ...value, nodes: value.nodes.filter(node => node.id !== current.id), edges: value.edges.filter(edge => edge.source !== current.id && edge.target !== current.id) }))}>Удалить карточку</button></> : current ? <NodeInspector graph={graph} node={current} issues={[]} events={initialEvents.filter(event => event.nodeId === current?.id)} patch={data => { if (current) patch(current.id, data); }} remove={() => { if (current) setDraft(value => ({ ...value, nodes: value.nodes.filter(node => node.id !== current.id), edges: value.edges.filter(edge => edge.source !== current.id && edge.target !== current.id) })); }} /> : <div className={styles.emptyInspector}><h3>Настройки ноды</h3><p>Выберите внутреннюю карточку. Соединять ноды можно линиями или кнопкой «Добавить связь». Ctrl / ⌘ S сохраняет новую версию этого модуля.</p></div>}</aside></div>
    <footer className={moduleStyles.footer}>Сохранение модуля не активирует бота. Вставленная карточка хранит свою версию; для изменения рабочего бота сохраните и включите новую версию основной схемы.</footer>
    {hover.target && <TraceHoverCard target={hover.target} preview={hover.preview} title={hover.title} id={hover.id} onClose={hover.close} />}
    {nested && <ModuleStudio open adminId={0} initial={nested} onClose={() => setNested(undefined)} onInsert={value => add('module', value)} onApply={value => { if (current?.type === 'module') patch(current.id, { definition: value }); }} />}
  </dialog>;
}
