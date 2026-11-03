import { Handle, Position } from '@xyflow/react';
import { MessageTimeline } from './MessageTimeline';
import { type FlowNode } from './flowEditor';
import { runtimeData, type RuntimeCardData } from './runtimePipeline';
import { messageText } from './promptInspection';
import styles from './context-studio.module.css';

export function RuntimePipelineCard({ data }: { data: RuntimeCardData }) {
  const merge = data.title === 'Сборка вариантов речи', journal = data.title === 'Журнал беседы · зебра';
  return <article className={`${styles.nodeCard} ${styles.runtimeCard}`} data-disabled={data.disabled || undefined}>
    {data.ports?.inputs?.map((port, index, all) => <Handle key={port.id} type="target" id={port.id} position={Position.Left} isConnectable={false} style={{ top: `${100 * (index + 1) / (all.length + 1)}%` }} role="button" tabIndex={0} aria-label={port.label} />)}
    {data.input && (merge ? ['primary', 'secondary'].map((id, index) => <Handle key={id} type="target" id={id} position={Position.Left} isConnectable={false} style={{ top: `${34 + index * 32}%` }} role="button" tabIndex={0} aria-label={`Вариант ${index + 1}`} />) : journal ? ['audio', 'text'].map((id, index) => <Handle key={id} type="target" id={id} position={Position.Left} isConnectable={false} style={{ top: `${34 + index * 32}%` }} role="button" tabIndex={0} aria-label={id === 'audio' ? 'Распознанная речь' : 'Текст'} />) : <><Handle type="target" id="in" position={Position.Left} isConnectable={false} role="button" tabIndex={0} aria-label="Запись ученика" /><Handle type="target" id="settings" position={Position.Top} isConnectable={false} role="button" tabIndex={0} aria-label="Настройки тарифа" /></>)}
    <div className={styles.cardHeading}><span className={styles.nodeIcon}><i className={`pi ${data.icon}`} aria-hidden /></span><strong>{data.title}</strong><i className="pi pi-lock" aria-hidden /></div>
    <p className={styles.cardSubtitle}>{data.subtitle}</p>
    {data.fields.slice(0, 3).map(([label, value]) => <div className={styles.runtimeField} key={label}><span>{label}</span><b>{value}</b></div>)}
    <div className={styles.cardFooter}><code>уже работает в шлюзе</code><span>{data.status}</span></div>
    {data.output && <Handle type="source" id="out" position={Position.Right} isConnectable={false} role="button" tabIndex={0} aria-label="Выход существующего этапа" />}
    {data.ports?.outputs?.map((port, index, all) => <Handle key={port.id} type="source" id={port.id} position={Position.Right} isConnectable={false} style={{ top: `${100 * (index + 1) / (all.length + 1)}%` }} role="button" tabIndex={0} aria-label={port.label} />)}
  </article>;
}
export function RuntimePipelineInspector({ node }: { node: FlowNode }) {
  const data = runtimeData(node); if (!data) return null;
  return <><div className={styles.inspectorTitle}><span className={styles.eyebrow}>Существующий этап шлюза</span><h3 className={styles.inspectorHeading}>{data.title}<code className={styles.nodeId}>{node.id}</code></h3></div>
    <p className={styles.hint}>{data.note}</p>
    {data.fields.map(([label, value]) => <label className={styles.field} key={label}>{label}<input readOnly value={value} /></label>)}
    {data.rules && <label className={styles.field}>Полный текст · {data.rules.join('\n').length.toLocaleString('ru-RU')} символов<textarea readOnly rows={18} value={data.rules.join('\n')} /></label>}
    {data.title === 'Параметры тарифа' || data.title === 'Настройки распознавания' || data.title.startsWith('Распознавание ·') ? <a href="#tutor-studio-presets">Открыть глобальные настройки трёх тарифов</a> : null}
    {data.request && <section className={styles.requestInspection}><h4>Сообщения в порядке отправки</h4>
      {(data.request.input as Record<string, unknown>[]).map((message, index) => <details key={index}><summary>{index + 1}. {String(message.role ?? message.type ?? 'данные')} · {messageText(message).length.toLocaleString('ru-RU')} символов</summary><pre>{messageText(message) || JSON.stringify(message, null, 2)}</pre></details>)}
      <details><summary>Полное тело запроса · JSON и настройки кеша</summary><pre>{JSON.stringify(data.request, null, 2)}</pre></details>
    </section>}
    {data.stream && <MessageTimeline stream={data.stream} origin="Журнал выбранного момента / учебного примера" />}
    <p className={styles.hint}>Код: <code>{data.code}</code></p><p className={styles.hint}>Эта карточка показывает действующую обработку. Её нельзя удалить или переподключить как шаг пользовательской схемы.</p>
  </>;
}
