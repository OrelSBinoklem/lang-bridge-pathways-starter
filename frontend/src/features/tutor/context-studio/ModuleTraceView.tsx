import { useRef, useEffect, useState } from 'react';
import { ReactFlow, ReactFlowProvider, Background, Controls, Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { ModuleCard, moduleDefinition } from './ModuleCard';
import { META, type Config, type FlowGraph, type FlowNode, type ModuleDefinition, type TraceEvent } from './flowEditor';
import { contextInputs } from './flowEditor';
import { useTraceHover } from './useTraceHover';
import { TraceHoverCard } from './TraceHoverCard';
import styles from './context-studio.module.css';
import moduleStyles from './modules.module.css';

type Data = { node: FlowNode; definition: ModuleDefinition; status?: string; open: (node: FlowNode) => void } & Config;
function TraceNode({ id, data }: NodeProps<Node<Data>>) {
  const node = data.node;
  if (node.type === 'module') return <ModuleCard id={id} definition={moduleDefinition(node.data)} status={data.status} open={() => data.open(node)} />;
  const input = node.type === 'module_input', output = node.type === 'module_output';
  const port = (input ? data.definition.inputs : data.definition.outputs).find(item => item.id === node.data.port);
  return <article className={styles.nodeCard} data-status={data.status}>
    {!input && node.type !== 'context' && <Handle id="in" type="target" position={Position.Left} isConnectable={false} role="button" tabIndex={0} aria-label="Вход" />}
    <div className={styles.cardHeading}><strong>{META[node.type].label}</strong><small>{data.status ?? 'Нет события'}</small></div>
    <p className={styles.cardSubtitle}>{port?.label ?? String(node.data.text ?? node.data.source ?? node.data.service ?? node.data.model ?? '')}</p>
    {node.type === 'context' && contextInputs(node.data).map(item => <div className={styles.livePort} key={item.id}><Handle id={item.id} type="target" position={Position.Left} isConnectable={false} role="button" tabIndex={0} aria-label={item.label} />{item.label}</div>)}
    <code>{id}</code>
    {node.type === 'condition' ? ['true', 'false'].map((value, index) => <Handle key={value} id={value} type="source" position={Position.Right} style={{ top: `${40 + index * 40}%` }} isConnectable={false} role="button" tabIndex={0} aria-label={value === 'true' ? 'Да' : 'Нет'} />) : !output && <Handle id="out" type="source" position={Position.Right} isConnectable={false} role="button" tabIndex={0} aria-label="Выход" />}
  </article>;
}
const NODE_TYPES = Object.fromEntries(Object.keys(META).map(kind => [kind, TraceNode]));
function TraceCanvas({ definition, path, events }: { definition: ModuleDefinition; path: string; events: TraceEvent[] }) {
  const graph: FlowGraph = { version: 2, name: definition.name, nodes: definition.nodes, edges: definition.edges };
  const current = events.filter(event => event.nodeId.startsWith(`${path}__`)).map(event => ({ ...event, nodeId: event.nodeId.slice(path.length + 2) }));
  const hover = useTraceHover(graph, current, true), [child, setChild] = useState<FlowNode>();
  const nodes = definition.nodes.map(node => ({ ...node, data: { node, definition, open: setChild, status: current.filter(event => event.nodeId === node.id).at(-1)?.status } }));
  return <><p className={styles.hint}>Запись v{definition.version} · только просмотр · данные до выбранного момента. Клик по порту или линии открывает фактический вход / выход.</p><div style={{ height: '70dvh', minHeight: 420 }} onClickCapture={hover.portClick} onKeyDownCapture={hover.activate}><ReactFlow nodes={nodes} edges={definition.edges} nodeTypes={NODE_TYPES} nodesDraggable={false} nodesConnectable={false} edgesReconnectable={false} deleteKeyCode={null} onNodeDoubleClick={(_event, node) => { if (node.type === 'module') setChild(definition.nodes.find(item => item.id === node.id)); }} onEdgeClick={hover.onEdgeClick} onPaneClick={hover.close} fitView minZoom={.15}><Background /><Controls showInteractive={false} /></ReactFlow></div>{hover.target && <TraceHoverCard target={hover.target} preview={hover.preview} title={hover.title} id={hover.id} onClose={hover.close} />}{child && moduleDefinition(child.data) && <ModuleTraceView definition={moduleDefinition(child.data)!} path={`${path}__${child.id}`} events={events} onClose={() => setChild(undefined)} />}</>;
}
export function ModuleTraceView({ definition, path, events, onClose }: { definition: ModuleDefinition; path: string; events: TraceEvent[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className={moduleStyles.dialog} onCancel={event => { event.preventDefault(); onClose(); }} aria-label={`Запись модуля ${definition.name}`}><header className={moduleStyles.header}><h2>{definition.name} <code>{path}</code></h2><button type="button" onClick={onClose}>Закрыть</button></header><ReactFlowProvider><TraceCanvas definition={definition} path={path} events={events} /></ReactFlowProvider></dialog>;
}
