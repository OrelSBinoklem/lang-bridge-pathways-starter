'use client';

import type { FlowGraph, Run } from './flowEditor';
import { META } from './flowEditor';
import styles from './context-studio.module.css';

export function ExecutionControls({ graph, pauseBefore, onPauseBefore, run, running, onResume }: {
  graph: FlowGraph; pauseBefore: string; onPauseBefore: (id: string) => void; run?: Run; running: boolean; onResume: (run: Run) => void;
}) {
  const checkpoint = run?.checkpoint;
  return <div className={styles.executionControls}>
    <label className={styles.testPreset}>Остановка теста перед карточкой
      <select aria-label="Остановка теста перед карточкой" value={pauseBefore} disabled={running || graph.engine !== 'langgraph'} onChange={event => onPauseBefore(event.target.value)}>
        <option value="">Без остановки</option>
        {graph.nodes.map(node => <option key={node.id} value={node.id}>{META[node.type].label} · {node.id}</option>)}
      </select>
    </label>
    <p className={styles.hint}>Остановка сохраняет выполненные шаги. Посмотрите данные на линиях и продолжите тот же тест; готовые запросы модели повторяться не будут.</p>
    {checkpoint && <div className={styles.executionCheckpoint} role="status">
      <strong>{run.paused ? 'Исполнение приостановлено' : checkpoint.uncertain.length ? 'Нужна проверка внешнего вызова' : 'Контрольный снимок сохранён'}</strong>
      <span>{checkpoint.completed} шагов · {(checkpoint.bytes / 1048576).toFixed(2)} / {(checkpoint.limitBytes / 1048576).toFixed(0)} МБ</span>
      <code>{checkpoint.id}</code>
      {checkpoint.next?.length ? <span>Дальше: {checkpoint.next.join(', ')}</span> : null}
      {checkpoint.uncertain.length > 0 && <p>Результат вызова неизвестен: {checkpoint.uncertain.join(', ')}. Автоматического повтора и нового списания нет. Проверьте историю кредитов.</p>}
      {run.paused && <button type="button" className={styles.primary} disabled={running || checkpoint.uncertain.length > 0 || !run.fixture} onClick={() => onResume(run)}>Продолжить сохранённый тест{run.live ? ' · за кредиты' : ' · без модели'}</button>}
    </div>}
  </div>;
}
