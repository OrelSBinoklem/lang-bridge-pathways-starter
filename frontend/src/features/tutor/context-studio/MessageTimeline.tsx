import { pretty } from './flowEditor';
import { readMessageStream, stateChanges, type MessageRecord } from './timelineModel';
import styles from './context-studio.module.css';

const PARAM_LABELS: Record<string, string> = {
  page: 'Страница', task: 'Задание', notes: 'Заметки', progress: 'Прогресс', voice: 'Голос',
  'task.completed': 'Задание выполнено', 'task.topic': 'Тема задания', 'task.text': 'Текст задания',
  'task.instructions': 'Инструкции к заданию', 'task.lessonBlockId': 'Блок урока', 'task.format': 'Формат задания',
};
const ROLE_LABELS = { user: 'Ученик', assistant: 'Робот', tool: 'Инструмент', system: 'Системная запись' };
const isDelta = (record: MessageRecord) => record.role === 'system' && record.metadata?.kind === 'state_delta';
export function ParameterSnapshot({ value }: { value: unknown }) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return <p className={styles.hint}>Блок параметров не задан.</p>;
  return <dl className={styles.parameterSnapshot}>{Object.entries(value).map(([key, item]) => <div key={key}><dt>{PARAM_LABELS[key] ?? key}</dt><dd>{pretty(item)}</dd></div>)}</dl>;
}
export function MessageTimeline({ stream, title = 'Поток сообщений · зебра', origin = 'Введённые тестовые данные' }: { stream: unknown; title?: string; origin?: string }) {
  const { records, errors } = readMessageStream(stream);
  const userCount = records.filter(record => record.role === 'user').length;
  return <section className={styles.timelineSection} aria-label={title}>
    <header className={styles.timelineHeading}><h4>{title}</h4><span>{userCount} реплик ученика · {records.length} записей</span></header>
    <p className={styles.timelineOrigin}>{origin}. Порядок записей сохранён; новые сообщения и изменения добавляются в конец.</p>
    {errors.map(error => <p key={error} className={styles.danger}>{error}</p>)}
    <div className={styles.timelineScroll} tabIndex={0} aria-label="Упорядоченные записи потока">
      {records.length ? records.map((record, index) => <article key={`${record.id ?? 'record'}:${index}`} className={styles.timelineRow} data-role={isDelta(record) ? 'state' : record.role}>
        <div className={styles.timelineMeta}><span>{isDelta(record) ? 'Изменение состояния' : ROLE_LABELS[record.role]}</span><small>#{index + 1}{record.createdAt ? ` · ${record.createdAt}` : ''}</small></div>
        {record.metadata?.dryRun === true && <strong className={styles.drySummary}>Учебное резюме · без вызова модели</strong>}
        <p>{record.text}</p>
        {isDelta(record) && <dl className={styles.stateChanges}>{stateChanges(record).map((change, i) => <div key={`${change.path}:${i}`}><dt>{PARAM_LABELS[change.path] ?? change.path}</dt><dd>{change.path === 'task.completed' && typeof change.value === 'boolean' ? change.value ? 'Да' : 'Нет' : pretty(change.value)}</dd></div>)}</dl>}
      </article>) : <p className={styles.hint}>В JSON нет message_stream. Добавьте записи или загрузите учебный пример.</p>}
    </div>
  </section>;
}
