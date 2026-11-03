'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ReactFlow, ReactFlowProvider, Background, Controls, Handle, Position, MarkerType, useReactFlow, useNodesInitialized, useUpdateNodeInternals, type Node, type NodeProps, type NodeChange } from '@xyflow/react';
import { clientApi } from '@/lib/client-api';
import { errorText } from './flowEditor';
import { edgePresentation } from './edgePresentation';
import { StudioEdge } from './StudioEdge';
import { updateCanvasGeometry, type CanvasGeometry } from './canvasGeometry';
import { projectModuleLayout, masterFrameBounds, type ModuleSnapshots, type BlockPreview } from './projectBlocks';
import { ProjectBlockCard, NestedModuleFrame, ModuleFrameBorder, type ProjectBlockData } from './ProjectBlockCards';
import { MASTER_SESSION_POLICY, MASTER_FRAME_ID, PROJECT_CONTRACT, PROJECT_MODULE_NAMES, projectConnectionColour, projectChannels, moveProjectModules, addProjectModule, expandProjectModule, type ProjectGraph, type ProjectCatalogue, type ProjectConnection, type ProjectModuleRuntime } from './projectScheme';
import styles from './project-scheme.module.css';
import studioStyles from './context-studio.module.css';

type ModuleData = { name: string; icon: string; colour: string; module: boolean; moduleKey?: string; description?: string; roles?: string[]; runtime?: ProjectModuleRuntime; channels: ProjectConnection[]; open: (id: string) => void; inspect: (id: string) => void; toggle: (id: string) => void };
type ModuleNode = Node<ModuleData>;
type CanvasNode = ModuleNode | Node<ProjectBlockData>;
type Draft = { graph: ProjectGraph; baseline: string; revision: string };
const EDGE_TYPES = { studio: StudioEdge };
const NODE_TYPES = { projectMaster: MasterFrameCard, projectModule: ModuleCard, projectFrame: FrameCard, projectBlock: ProjectBlockCard, nestedModuleFrame: NestedModuleFrame };
const CHANNEL_NAMES: Record<string, string> = { event: 'Событие', request: 'Вызов по необходимости', result: 'Возврат результата', stored: 'Сохранение / чтение данных' };
function CanvasSurface({ expanded, children }: { expanded: boolean; children: React.ReactNode }) {
  return expanded ? createPortal(<div className={studioStyles.page} style={{ position: 'fixed', inset: 0, padding: 0, margin: 0, width: 'auto', minHeight: 0, zIndex: 120000 }}>{children}</div>, document.body) : children;
}
function ModulePorts({ id, data, framed = false }: { id: string; data: ModuleData; framed?: boolean }) {
  const incoming = data.channels.filter(edge => edge.target === id), outgoing = data.channels.filter(edge => edge.source === id);
  const updateNodeInternals = useUpdateNodeInternals(), nodeId = id;
  const portSignature = `${incoming.map(edge => edge.id).join('|')}>${outgoing.map(edge => edge.id).join('|')}`;
  useEffect(() => { updateNodeInternals(nodeId); }, [updateNodeInternals, nodeId, portSignature]);
  if (!incoming.length && !outgoing.length) return null;
  const column = (items: ProjectConnection[], input: boolean) => items.length > 0 && <section className={styles.portColumn} data-direction={input ? 'in' : 'out'} aria-label={input ? 'Входы' : 'Выходы'}>
    <small>{input ? 'Входы' : 'Выходы'}</small>
    {items.map(edge => {
      const colour = projectConnectionColour(edge), peer = input ? edge.source : edge.target;
      const peerName = PROJECT_MODULE_NAMES[peer] ?? PROJECT_CONTRACT.anchors.find(anchor => anchor.id === peer)?.name ?? peer;
      return <div key={edge.id} className={styles.portRow} data-project-port={edge.id} style={{ '--port-colour': colour } as CSSProperties}>
        <Handle type={input ? 'target' : 'source'} position={input ? Position.Left : Position.Right} id={edge.id} isConnectable={false} aria-hidden tabIndex={-1}
          style={{ top: '50%', ...(input ? { left: -21 } : { right: -21 }), background: colour }} onClick={event => { event.stopPropagation(); data.inspect(edge.id); }} />
        <button type="button" className={`nodrag nopan ${styles.portLabel}`} aria-label={`${input ? 'Вход' : 'Выход'}: ${edge.label}`} title={`${input ? 'От' : 'В'}: ${peerName}\n${edge.description}`} onClick={event => { event.stopPropagation(); data.inspect(edge.id); }}>{edge.label}</button>
      </div>;
    })}
  </section>;
  return <div className={`${styles.portColumns} ${incoming.length && outgoing.length ? styles.twoPortColumns : ''} ${framed ? styles.framePorts : ''}`}>{column(incoming, true)}{column(outgoing, false)}</div>;
}
function ModuleCard({ id, data, selected }: NodeProps<ModuleNode>) {
  return <article className={`${styles.card} ${selected ? styles.selected : ''} ${!data.module ? styles.anchor : ''}`} style={{ '--module-colour': data.colour } as CSSProperties} data-project-module={data.module ? id : undefined}>
    <header><i className={`pi ${data.icon}`} aria-hidden /><div><small>{data.module ? 'Модуль' : 'Источник / данные'}</small><strong>{data.name}</strong></div></header>
    <code>{id}</code>
    {data.module ? <><p>{data.runtime ? `${data.runtime.nodes} нод · ${data.runtime.edges} связей` : 'Загружаем рабочие ноды…'}</p><p>{data.roles?.join(' · ')}</p><footer><span>{data.runtime ? data.runtime.active === null ? 'Исходная работа' : `Работает версия #${data.runtime.active}` : 'Проверяем версию…'}</span><div className={styles.moduleButtons}><button className="nodrag nopan" type="button" aria-label={`Раскрыть модуль ${data.name}`} onClick={event => { event.stopPropagation(); data.toggle(id); }}>Раскрыть на холсте</button><button className="nodrag nopan" type="button" onClick={event => { event.stopPropagation(); data.open(id); }}>Редактировать</button></div></footer></> : <p>{data.description}</p>}
    <ModulePorts id={id} data={data} />
  </article>;
}
function FrameCard({ data }: NodeProps<ModuleNode>) {
  return <ModuleFrameBorder colour={data.colour}><div className={`${styles.frameHeading} project-module-drag-handle`} data-project-frame={data.moduleKey}>
    <i className={`pi ${data.icon}`} aria-hidden /><strong>{data.name}</strong><code>{data.moduleKey}</code>
    <span>{data.runtime?.nodes} нод · {data.runtime?.active == null ? 'исходная работа' : `рабочая версия #${data.runtime.active}`}</span>
    <button className="nodrag nopan" type="button" aria-label={`Свернуть модуль ${data.name}`} onClick={event => { event.stopPropagation(); data.toggle(data.moduleKey!); }}>Свернуть</button><button className="nodrag nopan" type="button" onClick={event => { event.stopPropagation(); data.open(data.moduleKey!); }}>Редактировать</button>
    </div><ModulePorts id={data.moduleKey!} data={data} framed /></ModuleFrameBorder>;
}
function MasterFrameCard() {
  return <ModuleFrameBorder colour="var(--studio-muted)"><div className={styles.masterHeading} data-project-master>
    <strong><i className="pi pi-sitemap" aria-hidden /> Мастер-сессия</strong><span>Общий шаблон системы</span>
    <small>После отключения: {MASTER_SESSION_POLICY.idleGraceMs / 60000} мин · снимок до {MASTER_SESSION_POLICY.maxSnapshotBytes / 1048576} МиБ · общий кеш до {MASTER_SESSION_POLICY.maxIdleBytes / 1048576} МиБ</small>
  </div></ModuleFrameBorder>;
}
function FitProjectView({ viewKey, active, ready, focusId }: { viewKey: string; active: boolean; ready: boolean; focusId?: string }) {
  const initialized = useNodesInitialized(), flow = useReactFlow(), fitted = useRef('');
  useEffect(() => { if (!initialized || !active || !ready || fitted.current === viewKey) return; fitted.current = viewKey; void flow.fitView({ padding: .12, ...(focusId ? { nodes: [{ id: focusId }] } : {}) }); }, [initialized, active, ready, viewKey, focusId, flow]);
  return null;
}

export function ProjectSchemeCanvas({ moduleId, openModule, locked }: { moduleId: string; openModule: (id: string) => void; locked: boolean }) {
  return <ReactFlowProvider><ProjectCanvas moduleId={moduleId} openModule={openModule} locked={locked} /></ReactFlowProvider>;
}

function ProjectCanvas({ moduleId, openModule, locked }: { moduleId: string; openModule: (id: string) => void; locked: boolean }) {
  const [catalogue, setCatalogue] = useState<ProjectCatalogue | null>(null), [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [project, setProject] = useState('main'), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false), [retry, setRetry] = useState(0), [createOpen, setCreateOpen] = useState(false), [name, setName] = useState('');
  const [selected, setSelected] = useState<string | null>(null), [edgeId, setEdgeId] = useState<string | null>(null), [expanded, setExpanded] = useState(false);
  const [geometry, setGeometry] = useState<CanvasGeometry>({});
  const [snapshots, setSnapshots] = useState<ModuleSnapshots | null>(null), [blocksError, setBlocksError] = useState('');
  const [expandedNested, setExpandedNested] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string>();
  const [selectedBlock, setSelectedBlock] = useState<BlockPreview | null>(null);
  const pending = useRef(false), requestSequence = useRef(0), previousModule = useRef(moduleId);
  const draft = drafts[project], dirty = Boolean(draft && JSON.stringify(draft.graph) !== draft.baseline);
  const showBlocks = Boolean(draft?.graph.modules.some(module => module.expanded));
  const allExpanded = Boolean(draft?.graph.modules.length && draft.graph.modules.every(module => module.expanded));
  const openedModules = draft?.graph.modules.filter(module => module.expanded) ?? [];
  const fitFocusId = focusId ?? (openedModules.length === 1 ? openedModules[0].id : undefined);
  const anyDirty = Object.values(drafts).some(d => JSON.stringify(d.graph) !== d.baseline);
  function accept(data: ProjectCatalogue) {
    setCatalogue(data); setDrafts(current => {
      const next = { ...current };
      for (const document of data.schemes) if (!next[document.id] || JSON.stringify(next[document.id].graph) === next[document.id].baseline) next[document.id] = { graph: structuredClone(document.graph), baseline: JSON.stringify(document.graph), revision: document.revision };
      return next;
    });
  }
  useEffect(() => {
    const controller = new AbortController(), sequence = ++requestSequence.current;
    void clientApi<{ data: ProjectCatalogue }>('/tutor/flows/project-schemes', { signal: controller.signal }).then(result => { if (!controller.signal.aborted && sequence === requestSequence.current) { accept(result.data); setError(''); } }).catch(cause => { if (!controller.signal.aborted && sequence === requestSequence.current) setError(errorText(cause)); });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    if (!showBlocks) return;
    const controller = new AbortController();
    void clientApi<{ data: { modules: ModuleSnapshots } }>('/tutor/flows/project-schemes/blocks', { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) { setSnapshots(result.data.modules); setBlocksError(''); } })
      .catch(cause => { if (!controller.signal.aborted) setBlocksError(errorText(cause)); });
    return () => controller.abort();
  }, [showBlocks, retry]);
  useEffect(() => { if (previousModule.current && !moduleId) setRetry(value => value + 1); previousModule.current = moduleId; }, [moduleId]);
  useEffect(() => { if (!anyDirty) return; const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [anyDirty]);
  useEffect(() => { if (!expanded) return; const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [expanded]);
  const patch = (graph: ProjectGraph) => setDrafts(current => ({ ...current, [project]: { ...current[project], graph } }));
  const channels = draft ? projectChannels(draft.graph) : [];
  const selectedEdge = channels.find(edge => edge.id === edgeId);
  const selectedDefinition = PROJECT_CONTRACT.modules.find(module => module.id === selected);
  const blocksVisible = showBlocks && snapshots !== null;
  const blockLayout = useMemo(() => draft ? projectModuleLayout(draft.graph, snapshots ?? {}, expandedNested) : null, [draft, snapshots, expandedNested]);
  const flow = useReactFlow();
  const selectedInternalEdge = blockLayout?.edges.find(edge => edge.id === edgeId);
  function goModule(id: string) { setExpanded(false); openModule(id); }
  function inspectEdge(id: string) { setSelectedBlock(null); setEdgeId(id); }
  function toggleModule(id: string) {
    if (!draft || locked) return;
    const ref = draft.graph.modules.find(module => module.id === id); if (!ref) return;
    patch(expandProjectModule(draft.graph, id, !ref.expanded)); setFocusId(id); setSelected(id); setEdgeId(null); setSelectedBlock(null);
  }
  function toggleNested(id: string) {
    setExpandedNested(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    setFocusId(id); setSelectedBlock(null); setEdgeId(null);
  }
  function expandAll(value: boolean) {
    if (!draft || locked) return;
    patch({ ...draft.graph, modules: draft.graph.modules.map(module => ({ ...module, expanded: value })) }); setFocusId(undefined); setSelectedBlock(null); setEdgeId(null);
  }
  const nodes: CanvasNode[] = draft ? [...PROJECT_CONTRACT.anchors.map(anchor => ({ id: anchor.id, ...geometry[anchor.id], type: 'projectModule', position: blockLayout?.anchors[anchor.id] ?? anchor.position, draggable: false, data: { ...anchor, module: false, channels, open: goModule, inspect: inspectEdge, toggle: toggleModule } })), ...draft.graph.modules.map(module => {
    const definition = PROJECT_CONTRACT.modules.find(item => item.id === module.id)!;
    const frame = blockLayout?.frames.find(frame => frame.id === module.id);
    if (frame) return { id: module.id, ...geometry[module.id], type: 'projectFrame', position: frame.position, style: { width: frame.width, height: frame.height }, dragHandle: '.project-module-drag-handle', selected: selected === module.id, data: { ...definition, moduleKey: module.id, runtime: snapshots![module.id], module: true, channels, open: goModule, inspect: inspectEdge, toggle: toggleModule } };
    return { id: module.id, ...geometry[module.id], type: 'projectModule', position: blockLayout?.positions[module.id] ?? module.position, selected: selected === module.id, data: { ...definition, runtime: catalogue?.modules[module.id], module: true, channels, open: goModule, inspect: inspectEdge, toggle: toggleModule } };
  }), ...(blockLayout?.frames.flatMap(frame => frame.blocks.map(block => ({ id: block.id, ...geometry[block.id], type: block.expanded ? 'nestedModuleFrame' : 'projectBlock', parentId: block.parentId, ...(block.expanded ? { style: { width: block.width, height: block.height } } : {}), extent: 'parent' as const, draggable: false, zIndex: 2, position: block.position, selected: selectedBlock?.id === block.id, data: { block, colour: PROJECT_CONTRACT.modules.find(module => module.id === frame.id)!.colour, toggle: toggleNested } }))) ?? [])] : [];
  if (draft && project === 'main') {
    const boundary = masterFrameBounds(nodes);
    nodes.unshift({ id: MASTER_FRAME_ID, ...geometry[MASTER_FRAME_ID], type: 'projectMaster', position: boundary.position,
      style: { width: boundary.width, height: boundary.height }, draggable: false, selectable: false, zIndex: -1,
      data: { name: 'Мастер-сессия', icon: 'pi-sitemap', colour: 'var(--studio-muted)', module: false, channels: [], open: goModule, inspect: inspectEdge, toggle: toggleModule } });
  }
  const frameId = (id: string) => id;
  const dimensionsReady = nodes.every(node => (typeof node.style?.width !== 'number' || Math.abs((node.measured?.width ?? 0) - node.style.width) < 1)
    && (typeof node.style?.height !== 'number' || Math.abs((node.measured?.height ?? 0) - node.style.height) < 1));
  const edges = channels.map(edge => ({ id: edge.id, source: frameId(edge.source), target: frameId(edge.target), sourceHandle: edge.id, targetHandle: edge.id, type: 'studio', label: selected === edge.source || selected === edge.target || edgeId === edge.id ? edge.label : undefined,
    markerEnd: { type: MarkerType.ArrowClosed, color: projectConnectionColour(edge), width: 20, height: 20 },
    data: { ...edgePresentation(channels, edge), colour: projectConnectionColour(edge), branch: edge.channel === 'stored', highlighted: edgeId === edge.id || selected === edge.source || selected === edge.target, muted: Boolean(selected || edgeId) && edgeId !== edge.id && selected !== edge.source && selected !== edge.target } }));
  const insideEdges = (blockLayout?.edges ?? []).map(edge => ({ ...edge, type: 'studio', zIndex: 1, markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' }, data: { ...edgePresentation(blockLayout!.edges, edge), highlighted: edgeId === edge.id || selectedBlock?.id === edge.source || selectedBlock?.id === edge.target, muted: false } }));
  function changeNodes(changes: NodeChange<CanvasNode>[]) {
    setGeometry(current => updateCanvasGeometry(current, changes));
    if (!draft) return;
    const next = moveProjectModules(draft.graph, changes, showBlocks);
    if (next !== draft.graph) patch(next);
  }
  async function save() {
    if (!draft || pending.current) return;
    const id = project, snapshot = structuredClone(draft.graph); pending.current = true; requestSequence.current++; setBusy(true); setError('');
    try {
      const result = await clientApi<{ data: ProjectCatalogue }>(`/tutor/flows/project-schemes/${id}`, { method: 'PUT', body: JSON.stringify({ graph: snapshot, expected_revision: draft.revision }) });
      const document = result.data.schemes.find(item => item.id === id)!; setCatalogue(result.data);
      setDrafts(current => ({ ...current, [id]: { graph: current[id].graph, baseline: JSON.stringify(document.graph), revision: document.revision } }));
      setNotice('Модули, их раскрытие и расположение сохранены. Рабочие версии ботов не переключались.');
    } catch (cause) { setError(errorText(cause)); }
    finally { pending.current = false; setBusy(false); }
  }
  async function create() {
    if (pending.current) return; pending.current = true; requestSequence.current++; setBusy(true); setError('');
    try {
      const result = await clientApi<{ data: ProjectCatalogue & { id: string } }>('/tutor/flows/project-schemes', { method: 'POST', body: JSON.stringify({ name }) });
      accept(result.data); setProject(result.data.id); openModule(''); setCreateOpen(false); setName(''); setSelected(null); setEdgeId(null); setNotice('Дополнительная схема создана. Главная схема продолжает работать.');
    } catch (cause) { setError(errorText(cause)); }
    finally { pending.current = false; setBusy(false); }
  }
  function choose(id: string) { setFocusId(undefined); setProject(id); openModule(''); setSelected(null); setEdgeId(null); setSelectedBlock(null); }
  return <section className={styles.project} aria-label="Главная схема проекта и её модули">
    <div className={styles.toolbar}><label>Схема проекта<select aria-label="Схема проекта" value={project} disabled={!catalogue || busy || locked} onChange={event => choose(event.target.value)}>{catalogue ? catalogue.schemes.map(document => <option key={document.id} value={document.id}>{document.graph.name}{document.id === 'main' ? ' · главная' : ''}</option>) : <option value="main">Главная схема проекта</option>}</select></label><button type="button" disabled={busy || locked || !catalogue} onClick={() => setCreateOpen(value => !value)}><i className="pi pi-plus" aria-hidden />Новая схема</button><button type="button" disabled={busy || locked} onClick={() => setRetry(value => value + 1)}>Обновить состояние модулей</button>{moduleId && <button type="button" disabled={locked} onClick={() => openModule('')}><i className="pi pi-arrow-left" aria-hidden />К главной схеме</button>}</div>
    {createOpen && <form className={styles.create} onSubmit={event => { event.preventDefault(); void create(); }}><label>Название новой схемы<input aria-label="Название новой схемы" value={name} maxLength={120} onChange={event => setName(event.target.value)} /></label><button type="submit" disabled={busy || !name.trim()}>Создать</button><button type="button" disabled={busy} onClick={() => setCreateOpen(false)}>Отмена</button><small>Создаётся отдельный холст. Существующие рабочие модуля можно подключить ссылками; их боты не копируются.</small></form>}
    {error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status">{notice}</p>}
    {!moduleId && draft && <div className={styles.actions}><button type="button" disabled={busy || locked || !showBlocks} onClick={() => expandAll(false)}>Свернуть все модули</button><button type="button" disabled={busy || locked || allExpanded || !draft.graph.modules.length} onClick={() => expandAll(true)}>Раскрыть все модули</button><span>Раскрыто: {openedModules.length} из {draft.graph.modules.length}. Сохраните компоновку, чтобы запомнить вид.</span></div>}
    <nav className={styles.breadcrumb} aria-label="Путь внутри схемы"><button type="button" disabled={locked || !moduleId} onClick={() => openModule('')}>{draft?.graph.name ?? 'Главная схема проекта'}</button>{moduleId && <><span aria-hidden>›</span><strong>Модуль: {PROJECT_MODULE_NAMES[moduleId]}</strong></>}</nav>
    <div hidden={Boolean(moduleId)}>
      <div className={styles.explanation}><p>На главной схеме — модули проекта. Каждый можно раскрыть здесь в рамке или открыть его редактор. Табличник и другие вложенные модули находятся внутри основного чата.</p><small>Линии показывают существующие вызовы и обмен данными. Это событийные каналы: модули не запускаются все подряд. Кликните линию или порт для описания.</small></div>
      {!draft ? <p>Загружаем главную схему…</p> : <>
        <div className={styles.actions}><label>Название схемы<input aria-label="Название схемы проекта" value={draft.graph.name} maxLength={120} onChange={event => patch({ ...draft.graph, name: event.target.value })} /></label><button type="button" disabled={busy || !dirty} onClick={() => void save()}>{busy ? 'Сохраняем…' : 'Сохранить расположение и состав'}</button>{dirty && <button type="button" disabled={busy} onClick={() => patch(JSON.parse(draft.baseline) as ProjectGraph)}>Отменить изменения компоновки</button>}<span>{dirty ? 'Есть несохранённые изменения' : 'Сохранено / исходное расположение'}</span><label className={styles.blockToggle}><input type="checkbox" checked={allExpanded} onChange={event => expandAll(event.target.checked)} />Раскрыть все модули</label><button type="button" onClick={() => setExpanded(value => !value)}>{expanded ? 'Свернуть холст' : 'Развернуть холст'}</button></div>
        {project !== 'main' && <div className={styles.library}>{PROJECT_CONTRACT.modules.filter(module => !draft.graph.modules.some(item => item.id === module.id)).map(module => <button type="button" key={module.id} onClick={() => patch(addProjectModule(draft.graph, module.id))}>+ {module.name}</button>)}</div>}
        {blocksError && <p className={styles.error} role="alert">Не удалось загрузить блоки модулей: {blocksError}</p>}
        {showBlocks && !snapshots && !blocksError && <p role="status">Загружаем рабочие блоки модулей…</p>}
        <CanvasSurface expanded={expanded}><div className={`${styles.workspace} ${expanded ? styles.expanded : ''}`}>
          <div className={styles.canvas}><ReactFlow key={project} nodes={nodes} edges={[...edges, ...insideEdges]} nodeTypes={NODE_TYPES} edgeTypes={EDGE_TYPES} onNodesChange={changeNodes} onNodeClick={(_event, node) => { if (node.type === 'projectBlock' || node.type === 'nestedModuleFrame') { const block = (node.data as ProjectBlockData).block; setSelected(block.moduleId); setSelectedBlock(block); } else { setSelected((node.data as ModuleData).moduleKey ?? node.id); setSelectedBlock(null); } setEdgeId(null); }} onNodeDoubleClick={(_event, node) => { const id = node.type === 'projectBlock' || node.type === 'nestedModuleFrame' ? (node.data as ProjectBlockData).block.moduleId : (node.data as ModuleData).moduleKey ?? node.id; if (node.type === 'projectBlock' || node.type === 'nestedModuleFrame') { const block = (node.data as ProjectBlockData).block; if (block.source.type === 'module') toggleNested(block.id); } else if (PROJECT_MODULE_NAMES[id]) toggleModule(id); }} onPaneClick={() => { setSelected(null); setEdgeId(null); setSelectedBlock(null); }} onEdgeClick={(_event, edge) => { setEdgeId(edge.id); setSelected(null); setSelectedBlock(null); }} nodesConnectable={false} edgesReconnectable={false} deleteKeyCode={null} minZoom={blocksVisible ? .035 : .15} maxZoom={1.6} fitView fitViewOptions={{ padding: .1 }} panOnScroll aria-label="Суперсхема проекта"><FitProjectView viewKey={`${project}:${blocksVisible}:${expanded}:${retry}:${draft.graph.modules.map(module => `${module.id}:${module.expanded}`).join()}:${[...expandedNested].join()}:${fitFocusId}`} active={!moduleId} ready={dimensionsReady} focusId={fitFocusId} /><Background gap={22} size={1} /><Controls showInteractive={false} /></ReactFlow></div>
          <aside className={styles.inspector}>{expanded && <button type="button" onClick={() => setExpanded(false)}>Свернуть · Escape</button>}{expanded && <button type="button" onClick={() => expandAll(!allExpanded)}>{allExpanded ? 'Свернуть все модули' : 'Раскрыть все модули'}</button>}
            {showBlocks && !snapshots && <small>{blocksError || 'Загружаем блоки…'}</small>}
            {selectedBlock ? <><h3>{selectedBlock.source.type}</h3><code>{selectedBlock.source.id}</code><p>Модуль: {PROJECT_MODULE_NAMES[selectedBlock.moduleId]}</p><pre>{JSON.stringify(selectedBlock.source.data, null, 2)}</pre><button type="button" onClick={() => void flow.fitView({ nodes: [{ id: selectedBlock.id }], padding: .5, maxZoom: 1.1 })}>Приблизить блок</button><button type="button" onClick={() => goModule(selectedBlock.moduleId)}>Открыть редактор модуля</button></> : selectedInternalEdge ? <><h3>Связь внутри модуля</h3><code>{selectedInternalEdge.id}</code><p>{selectedInternalEdge.source} → {selectedInternalEdge.target}</p><p>Выход: {selectedInternalEdge.sourceHandle ?? 'out'} · вход: {selectedInternalEdge.targetHandle ?? 'in'}</p></> : selectedEdge ? <><h3>{selectedEdge.label}</h3><code>{selectedEdge.id}</code><p>{PROJECT_MODULE_NAMES[selectedEdge.source] ?? selectedEdge.source} → {PROJECT_MODULE_NAMES[selectedEdge.target] ?? selectedEdge.target}</p><strong>{CHANNEL_NAMES[selectedEdge.channel]}</strong><p>{selectedEdge.description}</p><small>Обработчик</small><code>{selectedEdge.handler}</code></> : selectedDefinition ? <><h3>{selectedDefinition.name}</h3><code>{selectedDefinition.id}</code>{blocksVisible && <button type="button" onClick={() => void flow.fitView({ nodes: [{ id: frameId(selectedDefinition.id) }], padding: .12 })}>Приблизить модуль</button>}<p>Модуль связан с прежним исполнителем и его рабочей версией. Раскрытие показывает карточки здесь; редактирование и активация выполняются в редакторе модуля.</p><button type="button" disabled={locked} onClick={() => toggleModule(selectedDefinition.id)}>{draft.graph.modules.find(module => module.id === selectedDefinition.id)?.expanded ? "Свернуть модуль" : "Раскрыть на холсте"}</button><button type="button" disabled={locked} onClick={() => goModule(selectedDefinition.id)}>Редактировать модуль</button>{project !== 'main' && <button type="button" onClick={() => { patch({ ...draft.graph, modules: draft.graph.modules.filter(module => module.id !== selectedDefinition.id) }); setSelected(null); }}>Убрать ссылку с этого холста</button>}</> : <><h3>Модули проекта</h3><p>Кнопка «Раскрыть на холсте» или двойной клик показывает карточки модуля в рамке. Можно раскрыть один модуль или несколько одновременно.</p><p>У каждого модуля сохраняются собственные версии и настройки. Сохранение общей компоновки не запускает моделей и не меняет оценивание.</p><ul className={styles.legend}>{Object.entries(CHANNEL_NAMES).map(([key, text]) => <li key={key}><span>{text}</span></li>)}</ul></>}</aside>
        </div></CanvasSurface>
      </>}
    </div>
  </section>;
}
