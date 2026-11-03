'use client';

import { useEffect, useState } from 'react';
import { clientApi } from '@/lib/client-api';
import { resolveTutorWsUrl } from '../tutor-config';
import type { FlowGraph } from './flowEditor';
import type { PromptManifest } from './promptInspection';

/** Read-only gateway inspection. No provider, tools, learner history or balance writes. */
export function usePromptManifest(graph: FlowGraph, preset: string, revision: string, enabled: boolean) {
  const graphJson = JSON.stringify({ ...graph, nodes: graph.nodes.map(node => ({ ...node, position: { x: 0, y: 0 } })) });
  const key = `${preset}:${revision}:${graphJson}`;
  const [state, setState] = useState<{ key: string; data?: PromptManifest; error?: string }>({ key: '' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController(), requestId = crypto.randomUUID();
    let ws: WebSocket | undefined, settled = false;
    const finish = (data?: PromptManifest, error?: string) => {
      if (abort.signal.aborted || settled) return;
      settled = true; clearTimeout(timeout); ws?.close(); setState({ key, data, error });
    };
    const timeout = setTimeout(() => finish(undefined, 'Шлюз не ответил. Полные инструкции не загружены; подключите шлюз и нажмите «Обновить инструкции».'), 15000);
    const start = setTimeout(() => {
      void clientApi<{ ticket: string }>('/tutor/ticket', { method: 'POST', signal: abort.signal }).then(({ ticket }) => {
        if (abort.signal.aborted) return;
        ws = new WebSocket(resolveTutorWsUrl());
        ws.onopen = () => ws?.send(JSON.stringify({ type: 'session.authenticate', ticket }));
        ws.onmessage = event => {
          if (abort.signal.aborted || settled) return;
          try {
            const payload = JSON.parse(String(event.data));
            if (payload.type === 'session.ready') ws?.send(JSON.stringify({ type: 'flow.prompt_manifest', requestId, preset, graph: JSON.parse(graphJson) }));
            if (payload.type === 'flow.prompt_manifest' && payload.requestId === requestId) finish(payload.ok ? payload.data : undefined, payload.ok ? undefined : String(payload.error));
            if (payload.type === 'error') finish(undefined, String(payload.message || 'Шлюз отклонил просмотр инструкций.'));
          } catch { finish(undefined, 'Шлюз вернул нечитаемый ответ.'); }
        };
        ws.onerror = () => finish(undefined, 'Нет соединения со шлюзом. Полные инструкции не загружены.');
        ws.onclose = () => finish(undefined, 'Соединение со шлюзом закрыто до получения инструкций.');
      }).catch(error => finish(undefined, error instanceof Error ? error.message : 'Не удалось получить инструкции.'));
    }, 350);
    return () => { abort.abort(); clearTimeout(start); clearTimeout(timeout); ws?.close(); };
  }, [key, graphJson, preset, enabled, attempt]);
  return { data: state.key === key ? state.data : undefined, error: state.key === key ? state.error : undefined,
    loading: enabled && state.key !== key, refresh: () => { setState({ key: '' }); setAttempt(value => value + 1); } };
}
