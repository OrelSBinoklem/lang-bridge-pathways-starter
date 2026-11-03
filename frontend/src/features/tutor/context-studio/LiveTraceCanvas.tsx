import { useMemo, useState, type CSSProperties } from 'react';
import { ModuleCard, moduleDefinition } from './ModuleCard';
import { ModuleTraceView } from './ModuleTraceView';
import type { FlowNode, ModuleDefinition } from './flowEditor';
import { HandlerSourceLinks } from './HandlerSourceLinks';
import { ReactFlow, ReactFlowProvider, Background, Controls, Handle, Position, MarkerType, useReactFlow, type NodeProps, type Node, type Edge } from '@xyflow/react';
import { runtimePipeline, runtimeData, runtimeId, type RuntimeCardData } from './runtimePipeline';
import { RuntimePipelineCard } from './RuntimePipelineCards';
import type { Config } from './flowEditor';
import { META, SOURCE_LABELS, contextInputs, type FlowGraph, type TraceEvent, type Kind } from './flowEditor';
import { StudioEdge } from './StudioEdge';
import { edgeFocus, edgePresentation, portColour } from './edgePresentation';
import { TraceHoverCard } from './TraceHoverCard';
import { useTraceHover } from './useTraceHover';
import styles from './context-studio.module.css';

type ReadData = { kind: Kind; label: string; inputs: { id: string; label: string; key: string }[]; status?: string; linked: boolean; yes: boolean; runtime?: RuntimeCardData; event?: unknown; definition?: ModuleDefinition; open?: () => void };
function ReadNode({ id, data }: NodeProps<Node<ReadData>>) {
  if (data.runtime) return <RuntimePipelineCard data={data.runtime} />;
  if (data.kind === 'module') return <ModuleCard id={id} definition={data.definition} status={data.status} open={data.open} />;
  const meta = META[data.kind];
  return <article className={`${styles.nodeCard} ${data.kind === 'context' ? styles.mergeCard : ''}`} style={{ '--node-accent': meta.color } as CSSProperties} data-linked={data.linked || undefined} data-status={data.status}>
    {data.kind !== 'event' && data.kind !== 'context' && <Handle role="button" tabIndex={0} type="target" position={Position.Left} id="in" aria-label="Вход" />}
    {data.kind === 'event' && ['user.audio', 'user.message'].includes(String(data.event)) && <Handle type="target" id="@runtime.before" position={Position.Left} isConnectable={false} />}
    {data.kind === 'model' && <Handle type="target" id="@runtime.rules" position={Position.Top} isConnectable={false} />}
    {data.kind === 'model' && <Handle type="target" id="@runtime.loop" position={Position.Bottom} isConnectable={false} />}
    <div className={styles.cardHeading}><strong>{meta.label}</strong><small>{data.status ?? 'Ещё не выполнялся'}</small></div>
    <p className={styles.cardSubtitle}>{data.label}</p>
    {data.kind === 'tools' && <HandlerSourceLinks handler="structured-command" />}
    {data.kind === 'context' && (data.inputs.length ? data.inputs.map(input => <div className={styles.livePort} key={input.id}><Handle type="target" role="button" tabIndex={0} position={Position.Left} id={input.id} style={{ background: portColour(input.id), left: -18 }} aria-label={`Вход ${input.id}: ${input.label}`} /><b>{input.label}</b><code>{input.key}</code></div>) : <Handle type="target" role="button" tabIndex={0} position={Position.Left} id="in" aria-label="Вход" />)}
    {data.kind === 'condition' ? <><Handle role="button" tabIndex={0} type="source" position={Position.Right} id="true" style={{ top: '40%' }} aria-label="Да" /><Handle role="button" tabIndex={0} type="source" position={Position.Right} id="false" style={{ top: '80%' }} aria-label="Нет" /></> : data.kind !== 'speech' && <Handle role="button" tabIndex={0} type="source" position={Position.Right} id="out" aria-label="Выход" />}
  </article>;
}
const NODE_TYPES = Object.fromEntries(Object.keys(META).map(kind => [kind, ReadNode]));
const EDGE_TYPES = { studio: StudioEdge };
function LiveCanvas({ graph, events, sources, eventType }: { graph: FlowGraph; events: TraceEvent[]; sources?: Config; eventType?: string }) {
  const pipeline = useMemo(() => runtimePipeline(graph, { events, sources, historical: true, eventType }), [graph, events, sources, eventType]);
  const shown = pipeline.graph, canvas = useReactFlow();
  const [selectedModule, setSelectedModule] = useState<FlowNode>();
  const hover = useTraceHover(shown, pipeline.runtimeEvents, true), focus = edgeFocus(shown.edges, hover.highlight, []);
  const nodes = shown.nodes.map(node => ({ ...node, draggable: false, selectable: false, data: { kind: node.type, runtime: runtimeData(node), event: node.data.event, definition: moduleDefinition(node.data), open: () => setSelectedModule(node),
    label: node.data.title ? String(node.data.title) : node.type === 'source' ? SOURCE_LABELS[String(node.data.source)] ?? String(node.data.source) : String(node.data.text ?? node.data.model ?? ''),
    inputs: node.type === 'context' && Array.isArray(node.data.inputs) ? contextInputs(node.data) : [], status: events.filter(event => event.nodeId === node.id).at(-1)?.status, linked: focus.nodes.has(node.id), yes: true } }));
  const edges: Edge[] = shown.edges.map(edge => { const presentation = edgePresentation(shown.edges, edge), highlighted = focus.edges.has(edge.id); return { ...edge, type: 'studio', sourceHandle: edge.sourceHandle ?? 'out', targetHandle: edge.targetHandle ?? 'in',
    data: { ...presentation, highlighted, muted: focus.edges.size > 0 && !highlighted }, markerEnd: { type: MarkerType.ArrowClosed, color: presentation.colour, width: 16, height: 16 }, zIndex: highlighted ? 10 : 0 }; });
  return <><nav className={styles.runtimeNavigation} aria-label="Этапы выбранного запроса">{pipeline.cards.length > 0 && <><button type="button" onClick={() => void canvas.fitView({ nodes: [{ id: runtimeId('settings') }, { id: runtimeId('primary') }, { id: runtimeId('secondary') }, { id: runtimeId('merge') }], padding: .2, duration: 180 })}>Распознавание · 1 / 2 потока</button><button type="button" onClick={() => void canvas.fitView({ nodes: [{ id: runtimeId('journal') }], padding: .6, maxZoom: 1, duration: 180 })}>Журнал беседы</button></>}</nav><div className={`${styles.flow} ${styles.liveCanvas}`} onClickCapture={hover.portClick} onKeyDownCapture={hover.activate} onFocusCapture={hover.focus} onBlurCapture={hover.leave}>
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={NODE_TYPES} edgeTypes={EDGE_TYPES} nodesConnectable={false} nodesDraggable={false} connectOnClick={false} edgesReconnectable={false} deleteKeyCode={null} onEdgeClick={hover.onEdgeClick} onNodeMouseEnter={hover.onNodeMouseEnter} onNodeMouseLeave={hover.leave} onEdgeMouseEnter={hover.onEdgeMouseEnter} onEdgeMouseLeave={hover.leave} onPaneClick={hover.close} onMoveStart={hover.close} fitView fitViewOptions={{ nodes: graph.nodes.filter(node => !graph.nodes.some(n => n.type === 'context') || ['context', 'source', 'prompt'].includes(node.type)).map(node => ({ id: node.id })), padding: .2 }} minZoom={.12} maxZoom={2} aria-label="Запись исполнения бота"><Background /><Controls showInteractive={false} /></ReactFlow>
    {hover.target && <TraceHoverCard target={hover.target} preview={hover.preview} title={hover.title} id={hover.id} onClose={hover.close} />}
    {selectedModule && moduleDefinition(selectedModule.data) && <ModuleTraceView definition={moduleDefinition(selectedModule.data)!} path={selectedModule.id} events={events} onClose={() => setSelectedModule(undefined)} />}
  </div></>;
}
export function LiveTraceCanvas({ graph, events, sources, eventType }: { graph: FlowGraph; events: TraceEvent[]; sources?: Config; eventType?: string }) {
  const key = useMemo(() => JSON.stringify(graph), [graph]);
  return <ReactFlowProvider key={key}><LiveCanvas graph={graph} events={events} sources={sources} eventType={eventType} /></ReactFlowProvider>;
}
