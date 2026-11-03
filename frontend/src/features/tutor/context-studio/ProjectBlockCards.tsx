import { Handle, Position, useViewport, type Node, type NodeProps } from '@xyflow/react';
import type { CSSProperties } from 'react';
import { META } from './flowEditor';
import { blockSummary, type BlockPreview } from './projectBlocks';
import styles from './project-scheme.module.css';

export type ProjectBlockData = { block: BlockPreview; colour: string; toggle: (id: string) => void; [key: string]: unknown };
export function ProjectBlockCard({ data, selected }: NodeProps<Node<ProjectBlockData>>) {
  const { block } = data, meta = META[block.source.type];
  return <article className={`${styles.block} ${selected ? styles.selected : ''}`} style={{ '--module-colour': data.colour } as CSSProperties} data-project-block={block.id}>
    <header><i className={`pi ${meta?.icon ?? 'pi-box'}`} aria-hidden /><strong>{meta?.label ?? block.source.type}</strong></header>
    <code>{block.source.id}</code><p>{blockSummary(block.source)}</p>
    <small>{block.source.type} {String(block.source.data.role ?? '')}</small>
    {block.source.type === 'module' && <button type="button" className="nodrag nopan" aria-label={`Раскрыть модуль ${blockSummary(block.source)}`} onClick={event => { event.stopPropagation(); data.toggle(block.id); }}>Раскрыть на холсте</button>}
    {block.inputs.map((port, i) => <Handle key={port} type="target" position={Position.Left} id={port} isConnectable={false} style={{ top: `${20 + 65 * (i + 1) / (block.inputs.length + 1)}%` }} />)}
    {block.outputs.map((port, i) => <Handle key={port} type="source" position={Position.Right} id={port} isConnectable={false} style={{ top: `${20 + 65 * (i + 1) / (block.outputs.length + 1)}%` }} />)}
  </article>;
}

export function NestedModuleFrame({ data }: NodeProps<Node<ProjectBlockData>>) {
  const { block } = data;
  return <ModuleFrameBorder colour={data.colour}><div className={styles.frameHeading} data-nested-module={block.id}>
    <i className="pi pi-box" aria-hidden /><strong>{blockSummary(block.source)}</strong><code>{block.source.id}</code>
    <button className="nodrag nopan" type="button" aria-label={`Свернуть модуль ${blockSummary(block.source)}`} onClick={event => { event.stopPropagation(); data.toggle(block.id); }}>Свернуть</button>
  </div>{[true, false].flatMap(input => (input ? block.inputPorts : block.outputPorts)?.map((port, index) => <div key={`${input}:${port.id}`} className={styles.nestedPort} style={{ top: 125 + index * 38, ...(input ? { left: 20 } : { right: 20 }) }}>
    <Handle type={input ? 'target' : 'source'} position={input ? Position.Left : Position.Right} id={port.id} isConnectable={false} style={{ top: '50%', ...(input ? { left: -27 } : { right: -27 }) }} />
    <span>{port.label} · <code>{port.id}</code></span>
  </div>) ?? [])}</ModuleFrameBorder>;
}

export function ModuleFrameBorder({ colour, children }: { colour: string; children: React.ReactNode }) {
  const { zoom } = useViewport();
  return <article className={styles.moduleFrame} style={{ '--module-colour': colour, outlineWidth: 5 / Math.max(.05, zoom) } as CSSProperties}>{children}</article>;
}
