import { useEffect, useMemo, useState } from 'react';
import { clientApi } from '@/lib/client-api';
import { useLiveTrace } from './useLiveTrace';
import { LiveTraceCanvas } from './LiveTraceCanvas';
import { megabytes, traceAt, requestDiff, type DebugUsers, type LiveRun } from './liveTraceTypes';
import styles from './context-studio.module.css';

export function LiveTracePanel({ adminId, initialConversation, onReplay, botId = 'tutor', botName = 'Живой чат' }: { adminId: number; initialConversation: number | null; onReplay?: (record: LiveRun) => Promise<void>; botId?: string; botName?: string }) {
  const [userId, setUserId] = useState(adminId), [conversationId, setConversationId] = useState<number | null>(initialConversation);
  const [query, setQuery] = useState(''), [search, setSearch] = useState(''), [directory, setDirectory] = useState<DebugUsers | null>(null), [directoryError, setDirectoryError] = useState('');
  const [searchRevision, setSearchRevision] = useState(0);
  const findUsers = () => { setSearch(query); setSearchRevision(value => value + 1); };
  const live = useLiveTrace(userId, botId === 'tutor' ? conversationId : null, botId);
  const [comparison, setComparison] = useState<{ id: string; result: ReturnType<typeof requestDiff> } | null>(null);
  const [comparing, setComparing] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void clientApi<{ data: DebugUsers }>(`/tutor/flows/debug-users?user_id=${userId}&q=${encodeURIComponent(search)}`, { signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) { setDirectory(response.data); setDirectoryError(''); } })
      .catch(cause => { if (!controller.signal.aborted) setDirectoryError(cause.message); });
    return () => controller.abort();
  }, [userId, search, searchRevision]);
  const events = useMemo(() => traceAt(live.record?.events ?? [], live.frame), [live.record, live.frame]);
  const selectedEvent = events.at(-1);
  const requestEvents = events.filter(event => event.type === 'model_request');
  const modelRequest = requestEvents.at(-1)?.inputPreview;
  async function compare() {
    if (!live.record || typeof modelRequest !== 'string') return;
    const id = live.record.id; setComparing(true);
    try { const previous = requestEvents.length > 1 ? String(requestEvents.at(-2)?.inputPreview) : await live.previousRequest(); setComparison({ id, result: requestDiff(previous, modelRequest) }); }
    catch (cause) { setDirectoryError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setComparing(false); }
  }
  return <section className={styles.livePanel} aria-label="Живое наблюдение за ботом">
    <div className={styles.liveHeader}><div><h2>{botName} · наблюдение</h2><p>Только для администраторов. Заморозка останавливает просмотр; бот продолжает работу. Отладка не меняет сообщения, прогресс и баланс.</p></div><span role="status">{live.status}</span></div>
    <div className={styles.liveSelectors}>
      <label>Найти пользователя<input aria-label="Поиск пользователя отладки" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') findUsers(); }} /></label>
      <button type="button" onClick={findUsers}>Найти</button>
      <label>Пользователь<select aria-label="Пользователь отладки" value={userId} onChange={event => { live.reset(); setUserId(Number(event.target.value)); setConversationId(null); }}>
        {!directory?.users.some(user => user.id === userId) && <option value={userId}>ID {userId}</option>}
        {directory?.users.map(user => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}
      </select></label>
      {botId === 'tutor' && <label>Беседа<select aria-label="Беседа отладки" value={conversationId ?? ''} onChange={event => { live.reset(); setConversationId(event.target.value ? Number(event.target.value) : null); }}><option value="">Все беседы пользователя</option>{directory?.conversations.map(conversation => <option key={conversation.id} value={conversation.id}>#{conversation.id} · {new Date(conversation.updated_at).toLocaleString('ru-RU')}</option>)}</select></label>}
    </div>
    {(directoryError || live.error) && <p role="alert" className={styles.error}>{directoryError || live.error}</p>}
    <div className={styles.liveControls}>
      <button type="button" disabled={!live.history} className={live.history?.recording ? styles.deleteButton : styles.primary} onClick={() => void live.watch(!live.history?.recording)}>{live.history?.recording ? 'Остановить запись пользователя' : 'Начать запись пользователя'}</button>
      <button type="button" onClick={live.following ? live.freeze : live.resume}>{live.following ? '❚❚ Заморозить просмотр' : '▶ Следовать за эфиром'}</button>
      <button type="button" onClick={() => void live.refresh().catch(cause => setDirectoryError(cause.message))}>Обновить список</button>
      <span>{live.following ? 'Эфир' : `Просмотр заморожен · новых уведомлений: ${live.pending}`}</span>
    </div>
    <p className={styles.hint}>Записываются будущие запросы выбранного пользователя к этому боту в течение 24 часов. Общий лимит всех ботов: до 100 запросов и 25 МБ на пользователя; весь архив — до 100 МБ. Активные записи шлюза — до 8 МБ. Одна запись — до 2 МБ, в браузере хранится только выбранная запись. Аудиофайлы не сохраняются.</p>
    {live.history && <p>Архив пользователя: {megabytes(live.history.bytes)} / {megabytes(live.history.limits.userBytes)} · общий: {megabytes(live.history.totalBytes)} / {megabytes(live.history.limits.totalBytes)} · собирается: {megabytes(live.history.activeBytes)}</p>}
    {!!live.history?.droppedRuns && <p role="alert" className={styles.error}>Из-за лимита активных записей не записано запросов: {live.history.droppedRuns}. Работа бота продолжалась; эти запросы не доступны для просмотра.</p>}
    <div className={styles.liveWorkspace}><aside className={styles.liveHistory}><h3>Запросы · {live.history?.runs.length ?? 0}/100</h3>{live.history?.runs.map(run => <button key={run.id} type="button" aria-pressed={live.record?.id === run.id} onClick={() => void live.select(run.id)}><strong>{new Date(run.startedAt).toLocaleTimeString('ru-RU')} · {run.subject?.type === 'exam_attempt' ? `экзамен #${run.subject.id}` : run.conversationId ? `беседа #${run.conversationId}` : botName}</strong><span>{run.status} · {run.preset ?? (botId === 'tutor' ? 'индивидуальные настройки' : 'настройки сервиса')}</span><small>{run.model ?? 'Модель не указана'} · {megabytes(run.bytes)}</small></button>)}</aside>
      <div className={styles.liveDetails}>{live.record ? <>
        <div className={styles.liveControls}><strong>{botId === 'tutor' ? `Схема #${live.record.versionId ?? 'встроенная'}` : 'Фиксированная схема сервиса'} · {live.record.model} · {live.record.durationMs ?? '…'} мс</strong>{onReplay && botId === 'tutor' && <button type="button" disabled={!live.record.graph || !live.record.event || !live.record.sources || !!live.record.omitted} onClick={() => void onReplay(live.record!).catch(cause => setDirectoryError(cause.message))}>Скопировать в учебный тест</button>}</div>
        {!!live.record.omitted && <p role="alert" className={styles.error}>Достигнут лимит записи: не сохранено фрагментов — {live.record.omitted}. Это неполный снимок; отсутствующие данные не восстанавливаются выдуманными значениями.</p>}
        {live.record.error && <p className={styles.error}>{live.record.error}</p>}
        <div className={styles.liveTimeline}><button type="button" disabled={!live.frame} onClick={() => live.step(live.frame - 1)}>← Шаг</button><label>Момент {live.frame}/{live.record.events.length}<input type="range" aria-label="Момент исполнения" min={0} max={live.record.events.length} value={live.frame} onChange={event => live.step(Number(event.target.value))} /></label><button type="button" disabled={live.frame >= live.record.events.length} onClick={() => live.step(live.frame + 1)}>Шаг →</button></div>
        <p className={styles.hint}>Данные карточек соответствуют выбранному моменту. Кликните по линии или кружку, чтобы открыть полный сохранённый вход/выход.</p>
        {live.record.graph ? <LiveTraceCanvas graph={live.record.graph} events={events} sources={live.record.sources} eventType={String(live.record.event?.type ?? '')} /> : <p>Запрос выполнен встроенным ботом без сохранённой схемы; данные доступны в событиях ниже.</p>}
        <details><summary>Очередь событий · {events.length}</summary><ol className={styles.liveEventList}>{events.map((event, index) => <li key={index}><button type="button" onClick={() => live.step(index + 1)}>{index + 1}. {event.nodeId} · {event.type} · {event.status}</button></li>)}</ol></details>
        {selectedEvent && <details open><summary>Выбранный шаг: {selectedEvent.nodeId} · {selectedEvent.status}</summary>{selectedEvent.inputPreview !== undefined && <><h4>Вход</h4><pre>{typeof selectedEvent.inputPreview === 'string' ? selectedEvent.inputPreview : JSON.stringify(selectedEvent.inputPreview, null, 2)}</pre></>}{selectedEvent.outputPreview !== undefined && <><h4>Выход</h4><pre>{typeof selectedEvent.outputPreview === 'string' ? selectedEvent.outputPreview : JSON.stringify(selectedEvent.outputPreview, null, 2)}</pre></>}{selectedEvent.usage !== undefined && <pre>{JSON.stringify(selectedEvent.usage, null, 2)}</pre>}</details>}
        {modelRequest !== undefined && <details><summary>Точный запрос модели</summary><p>Тело запроса на выбранном шаге. Заголовки авторизации и аудиофайлы исключены.</p><pre>{String(modelRequest)}</pre><button type="button" disabled={comparing} onClick={() => void compare()}>{comparing ? 'Сравниваю…' : 'Сравнить с предыдущим запросом'}</button>{comparison?.id === live.record.id && <div><h4>Изменения контекста</h4><p>Сравнение содержимого запросов; попадание в кеш проверяется по фактическому usage, а не по этому сравнению.</p>{comparison.result.changes.map(change => <details key={change.path}><summary>{change.path}</summary><h4>Было</h4><pre>{change.before}</pre><h4>Стало</h4><pre>{change.after}</pre></details>)}{!comparison.result.changes.length && <p>Изменений нет.</p>}{comparison.result.limited && <p>Показаны первые 100 изменений; полное тело текущего запроса доступно выше.</p>}</div>}</details>}
      </> : <div className={styles.emptyRuns}><h3>Пока нет выбранного запроса</h3><p>Включите запись, выполните обычное действие с выбранным ботом и выберите запрос слева. Старые проверки без записи восстановить нельзя. Просмотр не вызывает модель и не расходует кредиты.</p></div>}</div>
    </div>
  </section>;
}
