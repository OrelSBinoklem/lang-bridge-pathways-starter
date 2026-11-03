import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';
import { useEffect } from 'react';
import type { Config, ModuleDefinition, ModulePort } from './flowEditor';
import styles from './context-studio.module.css';

export function moduleDefinition(data: Config): ModuleDefinition | undefined {
  const value = data.definition;
  return value && typeof value === 'object' && Array.isArray((value as ModuleDefinition).inputs) && Array.isArray((value as ModuleDefinition).outputs) ? value as ModuleDefinition : undefined;
}
export function ModuleCard({ id, definition, selected = false, open, status }: { id: string; definition?: ModuleDefinition; selected?: boolean; open?: () => void; status?: string }) {
  const update = useUpdateNodeInternals();
  const signature = JSON.stringify([definition?.inputs, definition?.outputs]);
  useEffect(() => { update(id); }, [id, signature, update]);
  const row = (port: ModulePort | undefined, side: 'input' | 'output') => port && <div className={styles.modulePort} data-side={side}>
    <Handle type={side === 'input' ? 'target' : 'source'} position={side === 'input' ? Position.Left : Position.Right} id={port.id} role="button" tabIndex={0} aria-label={`${side === 'input' ? 'Вход' : 'Выход'} ${port.id}: ${port.label}`} />
    <span>{port.label}<small>{port.id}</small></span>
  </div>;
  const rows = Math.max(definition?.inputs.length ?? 0, definition?.outputs.length ?? 0);
  return <article className={`${styles.nodeCard} ${styles.moduleCard} ${selected ? styles.selectedCard : ''}`} onDoubleClick={open}>
    <div className={styles.cardHeading}><i className="pi pi-box" aria-hidden /><strong>{definition?.name ?? 'Выберите модуль'}</strong><small>v{definition?.version ?? '—'}</small></div>
    <p className={styles.cardSubtitle}>{definition?.nodes.length ?? 0} внутренних нод · закреплённая версия</p>
    {Array.from({ length: rows }, (_, index) => <div className={styles.modulePortRow} key={index}>{row(definition?.inputs[index], 'input') ?? <span />}{row(definition?.outputs[index], 'output') ?? <span />}</div>)}
    {open && <button type="button" className="nodrag nopan" onClick={open}>Открыть внутреннюю схему</button>}
    <div className={styles.cardFooter}><code>{id}</code><span>{status ?? 'module'}</span></div>
  </article>;
}
