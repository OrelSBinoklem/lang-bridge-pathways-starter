import { useCallback, useEffect, useRef, useState } from 'react';
import { clientApi } from '@/lib/client-api';
import { resolveTutorWsUrl } from '../tutor-config';
import type { LiveHistory, LiveRun } from './liveTraceTypes';

export function useLiveTrace(userId: number, conversationId: number | null, botId = 'tutor') {
  const [history, setHistory] = useState<LiveHistory | null>(null), [record, setRecord] = useState<LiveRun | null>(null);
  const [status, setStatus] = useState('Подключение…'), [error, setError] = useState(''), [following, setFollowing] = useState(true), [frame, setFrame] = useState(0), [pending, setPending] = useState(0);
  const socket = useRef<WebSocket | null>(null), requestCounter = useRef(0), selected = useRef<string | null>(null), follow = useRef(true);
  const waiting = useRef(new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>());
  const request = useCallback((action: string, extra: Record<string, unknown> = {}) => new Promise<unknown>((resolve, reject) => {
    const ws = socket.current;
    if (ws?.readyState !== WebSocket.OPEN) { reject(Error('Дождитесь подключения к шлюзу.')); return; }
    if (waiting.current.size >= 6) { reject(Error('Дождитесь загрузки данных.')); return; }
    const id = `monitor_${++requestCounter.current}`;
    const timer = setTimeout(() => { waiting.current.delete(id); reject(Error('Шлюз не ответил на запрос отладки.')); }, 15000);
    waiting.current.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ type: 'debug.monitor', id, action, userId, conversationId, botId, ...extra }));
  }), [userId, conversationId, botId]);
  const freeze = () => { follow.current = false; setFollowing(false); };
  const load = useCallback(async (id: string, live = false) => {
    const result = await request('detail', { runId: id }) as LiveRun;
    if (selected.current !== id || live && !follow.current) return;
    setRecord(result); setFrame(result.events.length);
  }, [request]);
  const refresh = useCallback(async () => {
    const result = await request('list') as LiveHistory; setHistory(result);
    const next = follow.current ? result.runs[0]?.id : selected.current;
    if (next && follow.current) { selected.current = next; await load(next, true); }
  }, [request, load]);
  useEffect(() => {
    let disposed = false, retry: ReturnType<typeof setTimeout> | undefined, update: ReturnType<typeof setTimeout> | undefined, attempts = 0;
    const controller = new AbortController(), requests = waiting.current;
    selected.current = null;
    function failure(cause: unknown) { if (!disposed) setError(cause instanceof Error ? cause.message : 'Ошибка отладки.'); }
    async function connect() {
      if (disposed) return;
      try {
        const { ticket } = await clientApi<{ ticket: string }>('/tutor/ticket', { method: 'POST', signal: controller.signal });
        if (disposed) return; setStatus('Авторизация…');
        const ws = new WebSocket(resolveTutorWsUrl()); socket.current = ws;
        ws.onopen = () => ws.send(JSON.stringify({ type: 'session.authenticate', ticket }));
        ws.onmessage = event => {
          if (disposed) return;
          try {
            if (String(event.data).length > 3 * 1048576) throw Error('Запись превышает предел загрузки браузера.');
            const message = JSON.parse(String(event.data));
            if (message.type === 'session.ready') { attempts = 0; setStatus('Подключено'); setError(''); void refresh().catch(failure); }
            if (message.type === 'debug.monitor.result') {
              const pending = requests.get(message.id); if (!pending) return; clearTimeout(pending.timer); requests.delete(message.id);
              if (message.error) pending.reject(Error(message.error)); else pending.resolve(message.data);
            }
            if (message.type === 'debug.monitor.changed') {
              if (!follow.current) { setPending(value => Math.min(9999, value + 1)); return; }
              if (!update) update = setTimeout(() => { update = undefined; void refresh().catch(failure); }, 1500);
            }
            if (message.type === 'error') failure(Error(message.message ?? 'Ошибка шлюза.'));
          } catch (cause) { failure(cause); }
        };
        ws.onerror = () => failure(Error('Не удалось подключиться к шлюзу отладки.'));
        ws.onclose = () => {
          if (disposed) return; setStatus('Соединение закрыто');
          for (const item of requests.values()) { clearTimeout(item.timer); item.reject(Error('Соединение закрыто.')); } requests.clear();
          retry = setTimeout(() => void connect(), Math.min(30000, 2000 * ++attempts));
        };
      } catch (cause) { if (!disposed) { failure(cause); retry = setTimeout(() => void connect(), 5000); } }
    }
    void connect();
    return () => { disposed = true; controller.abort(); clearTimeout(retry); clearTimeout(update); const ws = socket.current; socket.current = null; ws?.close();
      for (const item of requests.values()) { clearTimeout(item.timer); item.reject(Error('Просмотр закрыт.')); } requests.clear(); };
  }, [refresh]);
  const select = async (id: string) => { freeze(); selected.current = id; setError(''); try { await load(id); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); } };
  const resume = () => { follow.current = true; setFollowing(true); setPending(0); void refresh().catch(cause => setError(cause.message)); };
  const watch = async (enabled: boolean) => { setError(''); try { await request('watch', { enabled }); await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); } };
  const step = (value: number) => { freeze(); setFrame(Math.max(0, Math.min(record?.events.length ?? 0, value))); };
  const reset = () => { selected.current = null; follow.current = true; setRecord(null); setHistory(null); setFrame(0); setError(''); setFollowing(true); setPending(0); setStatus('Подключение…'); };
  const previousRequest = async () => {
    freeze();
    const index = history?.runs.findIndex(run => run.id === record?.id) ?? -1, older = index >= 0 ? history?.runs.slice(index + 1).find(run => run.conversationId === record?.conversationId) : undefined;
    if (!older) throw Error('В архиве нет предыдущего запроса.');
    const value = await request('detail', { runId: older.id }) as LiveRun;
    const body = value.events.filter(event => event.type === 'model_request').at(-1)?.inputPreview;
    if (typeof body !== 'string') throw Error('Точное тело предыдущего запроса не сохранилось.');
    return body;
  };
  return { history, record, status, error, following, frame, pending, freeze, resume, select, watch, step, refresh, reset, previousRequest };
}
