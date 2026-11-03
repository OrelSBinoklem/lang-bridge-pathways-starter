import { Handle, Position } from '@xyflow/react';
import { SOURCE_LABELS, META, contextInputs, type Config, type FlowGraph, type FlowNode } from './flowEditor';
import { effectiveContextOrder, moveContextBlock } from './contextOrder';
import styles from './context-studio.module.css';
import { portColour } from './edgePresentation';

export function ContextOrderInspector({ graph, node, patch, editInputs = false, handles = false, compact = false }: { graph: FlowGraph; node: FlowNode; patch: (data: Config) => void; editInputs?: boolean; handles?: boolean; compact?: boolean }) {
  const order = effectiveContextOrder(graph, node);
  const inputs = contextInputs(node.data);
  const label = (id: string) => {
    if (id === '$request') return 'Текущий запрос';
    const input = inputs.find(input => input.id === id);
    if (input) return input.label || input.id;
    const block = graph.nodes.find(item => item.id === id);
    return block?.type === 'source' ? SOURCE_LABELS[String(block.data.source)] ?? String(block.data.source) : String(block?.data.title ?? block?.data.name ?? block?.data.text ?? (block ? `${META[block.type].label} · ${id}` : id)).trim().split('\n')[0].slice(0, 80);
  };
  const updateInput = (id: string, key: 'key' | 'label', value: string) => patch({ inputs: inputs.map(input => input.id === id ? { ...input, [key]: value } : input) });
  const inputFields = (id: string) => {
    const input = inputs.find(input => input.id === id);
    if (!editInputs || !input) return null;
    return <div className={styles.portFields}><label>Подпись<input aria-label={`Подпись ${id}`} value={input.label} maxLength={80} onChange={event => updateInput(id, 'label', event.target.value)} /></label><label>Ключ<input aria-label={`Ключ ${id}`} value={input.key} maxLength={60} onChange={event => updateInput(id, 'key', event.target.value)} /></label></div>;
  };
  const moves = (id: string, index: number) => <div className={styles.portMoves}>
    <button type="button" aria-label={`Выше: ${label(id)}`} disabled={index === 0} onClick={() => patch({ order: moveContextBlock(order, id, -1) })}><i className="pi pi-arrow-up" aria-hidden /></button>
    <button type="button" aria-label={`Ниже: ${label(id)}`} disabled={index === order.length - 1} onClick={() => patch({ order: moveContextBlock(order, id, 1) })}><i className="pi pi-arrow-down" aria-hidden /></button>
  </div>;
  return <section className={`${styles.orderInspector} ${compact ? styles.compactOrderInspector : ''}`} aria-label="Порядок блоков контекста">
    {!compact && <h4>Порядок контекста</h4>}
    <div className={styles.pinnedRules}><i className="pi pi-lock" aria-hidden />Обязательные правила · всегда в начале</div>
    <ol className={`${styles.contextOrder} ${compact ? styles.compactContextOrder : ''}`}>{order.map((id, index) => {
      const input = inputs.find(input => input.id === id);
      return <li key={id} data-context-port={id}>{handles && input && <Handle tabIndex={0} role="button" type="target" position={Position.Left} id={id} className={styles.mergeHandle} style={{ left: -24, background: portColour(id) }} aria-label={`Вход ${id}: ${label(id)}`} />}
        {compact && editInputs && input ? <><small className={styles.portId} title={`${graph.edges.filter(edge => edge.target === node.id && edge.targetHandle === id).length} связ.`}>{id}</small><input aria-label={`Подпись ${id}`} title={`Подпись ${id}`} value={input.label} maxLength={80} onChange={event => updateInput(id, 'label', event.target.value)} /><input aria-label={`Ключ ${id}`} title={`Ключ ${id}`} value={input.key} maxLength={60} onChange={event => updateInput(id, 'key', event.target.value)} /></> : <span className={compact ? styles.compactOrderLabel : undefined}><b>{label(id)}</b>{id !== '$request' && <small>{id}{input && ` · ${graph.edges.filter(edge => edge.target === node.id && edge.targetHandle === id).length} связ.`}</small>}</span>}
        {moves(id, index)}{!compact && inputFields(id)}
      </li>;
    })}</ol>
    {editInputs && inputs.some(input => !order.includes(input.id)) && <div className={styles.legacyPorts}><b>Восемь входов · настройки</b>{inputs.filter(input => !order.includes(input.id)).map(input => <div key={input.id} className={styles.legacyPort}>{handles && <Handle tabIndex={0} role="button" type="target" position={Position.Left} id={input.id} className={styles.mergeHandle} aria-label={`Вход ${input.id}: ${input.label}`} />}<small>{input.id}</small>{inputFields(input.id)}</div>)}</div>}
    <p className={styles.hint}>{compact ? 'Стрелки меняют порядок. Линии закреплены за ID входа.' : Array.isArray(node.data.inputs) ? 'Порядок входов задаёт порядок сборки. Перемещение строки сохраняет её ID и подключённые линии. Пустые входы не добавляют данные. Чтобы убрать данные, отключите линию.' : 'Блоки поступают по подключённым линиям, в том числе через условие и сжатие. Новые блоки добавляются перед текущим запросом. Чтобы убрать блок, отключите его линию.'}</p>
  </section>;
}
