import { useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';
import { CONTEXT_MODES, type Config, type FlowGraph, type FlowNode } from './flowEditor';
import { ContextOrderInspector } from './ContextOrderInspector';
import styles from './context-studio.module.css';

export function ContextAssembly({ graph, node, patch, upgrade }: { graph: FlowGraph; node: FlowNode; patch: (data: Config) => void; upgrade: () => void }) {
  const updateInternals = useUpdateNodeInternals();
  const shape = JSON.stringify([node.data.order, node.data.inputs]);
  useEffect(() => { updateInternals(node.id); }, [node.id, shape, updateInternals]);
  const legacyEdges = graph.edges.filter(edge => edge.target === node.id && (!edge.targetHandle || edge.targetHandle === 'in'));
  const modern = Array.isArray(node.data.inputs);
  return <div className={`nodrag nopan nowheel ${styles.mergeBody}`} onDoubleClick={event => event.stopPropagation()}>
    <label className={styles.mergeMode}>Результат сборки<select aria-label="Режим сборки контекста" value={String(node.data.mode ?? 'object')} onChange={event => patch({ mode: event.target.value })}>{Object.entries(CONTEXT_MODES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    {legacyEdges.length > 0 && <div className={styles.legacyInput}><Handle tabIndex={0} role="button" type="target" position={Position.Left} id="in" className={styles.mergeHandle} aria-label="Совместимый вход старой схемы" />Старый общий вход · {legacyEdges.length} связ.</div>}
    {!modern && <p className={styles.hint}>Сохранён старый общий вход и порядок блоков. <button type="button" onClick={upgrade}>Обновить карточки · черновик</button> Добавит восемь входов и сериализацию. Изменения нужно сохранить.</p>}
    <ContextOrderInspector graph={graph} node={node} patch={patch} editInputs={modern} handles={modern} compact={modern} />
  </div>;
}
