import { useMemo } from 'react';
import { MessageTimeline, ParameterSnapshot } from './MessageTimeline';
import { parseSources } from './timelineModel';
import styles from './context-studio.module.css';

export function TestSourcesPanel({ sourceText, onChange, onExample }: { sourceText: string; onChange: (text: string) => void; onExample: () => void }) {
  const parsed = useMemo(() => parseSources(sourceText), [sourceText]);
  return <div className={styles.testSourcesPanel}>
    <button type="button" className={styles.exampleButton} onClick={onExample}><i className="pi pi-list" aria-hidden />Пример: 21 реплика + состояния</button>
    {parsed.error ? <p role="alert" className={styles.danger}>JSON источников: {parsed.error}</p> : <>
      <details className={styles.snapshotDetails} open><summary>Параметры до сжатия · из тестового JSON</summary><ParameterSnapshot value={parsed.sources.parameter_state} /><p className={styles.timelineOrigin}>Снимок не переписывается при показе событий. Последующие изменения находятся в потоке ниже; их перенос в снимок выполняет исполнитель сжатия.</p></details>
      <MessageTimeline stream={parsed.sources.message_stream} />
    </>}
    <details className={styles.advancedSources}><summary>Источники контекста · редактировать JSON</summary><label className={styles.field}>Источники контекста · JSON<textarea className={styles.jsonInput} rows={13} spellCheck={false} value={sourceText} onChange={event => onChange(event.target.value)} /><small>Содержимое задаёте вы. История реальных пользователей не загружается. Журнал не обрезается интерфейсом.</small></label></details>
  </div>;
}
