'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { resolveTutorWsUrl } from '@/features/tutor/tutor-config';
import { clientApi } from '@/lib/client-api';
import { ApiError } from '@/lib/api';
import { notifyCreditsChanged } from '@/lib/credit-refresh';
import { TutorReconnect } from './tutorReconnect';
import styles from '@/features/tutor/tutor-page.module.css';

type TutorMessage = {
  id: string;
  role: 'system' | 'user' | 'assistant';
  text: string;
};

type TutorEvent =
  | { type: 'credits.changed' }
  | { type: 'session.ready'; clientId: string; capabilities?: string[] }
  | { type: 'conversation.ready'; conversationId: number }
  | { type: 'assistant.message'; text: string }
  | { type: 'ui.command'; commandId: string; action: TutorAction }
  | { type: 'error'; message: string };

type TutorAction = {
  type: 'navigate';
  to: string;
  title?: string;
};

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function TutorPage() {
  const router = useRouter();
  const wsRef = useRef<WebSocket | null>(null);
  const conversationIdRef = useRef<number | null>(null);
  const recoveryRef = useRef(new TutorReconnect());
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [status, setStatus] = useState<'connecting' | 'ready' | 'closed' | 'error'>('connecting');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<TutorMessage[]>([
    {
      id: createId(),
      role: 'system',
      text: 'MVP: tutor gateway can navigate pages by text commands. Try: “открой грамматику”, “словарь 1”, “category 12”.',
    },
  ]);

  const wsUrl = useMemo(() => resolveTutorWsUrl(), []);

  useEffect(() => {
    let allowReconnect = true;
    const recovery = recoveryRef.current;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.addEventListener('open', async () => {
      try {
        const { ticket } = await clientApi<{ ticket: string }>('/tutor/ticket', { method: 'POST' });
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'session.authenticate', ticket }));
      } catch (error) {
        allowReconnect = !(error instanceof ApiError && [401, 402, 403].includes(error.status));
        setStatus('error'); ws.close();
      }
    });
    ws.addEventListener('close', () => {
      if (wsRef.current !== ws) return;
      setStatus('closed');
      if (allowReconnect) recoveryRef.current.schedule(() => setConnectionAttempt(value => value + 1));
    });
    ws.addEventListener('error', () => setStatus('error'));
    ws.addEventListener('message', (event) => {
      const payload = JSON.parse(event.data) as TutorEvent;
      if (payload.type === 'credits.changed') { notifyCreditsChanged(); return; }
      if (payload.type === 'session.ready') {
        if (!payload.capabilities?.includes('context.persistence.v1')) { recoveryRef.current.ready(); setStatus('ready'); return; }
        void (async () => {
          const current = await clientApi<{ data: { id: number } }>('/tutor/conversation/current');
          const conversation = await clientApi<{ data: { messages: { id: number; role: string; text: string }[] } }>(`/tutor/conversations/${current.data.id}/messages?limit=30`);
          if (wsRef.current !== ws || ws.readyState !== WebSocket.OPEN) return;
          conversationIdRef.current = current.data.id;
          setMessages(conversation.data.messages.map(message => ({ id: `stored-${message.id}`, role: message.role === 'user' ? 'user' : message.role === 'assistant' ? 'assistant' : 'system', text: message.text })));
          ws.send(JSON.stringify({ type: 'client.event', event: 'conversation.changed', payload: { conversation_id: current.data.id, pathname: '/tutor' } }));
        })().catch(() => { setStatus('error'); ws.close(); });
        return;
      }
      if (payload.type === 'conversation.ready') {
        if (payload.conversationId === conversationIdRef.current) { recoveryRef.current.ready(); setStatus('ready'); }
        return;
      }
      if (payload.type === 'assistant.message') {
        setMessages((prev) => [...prev, { id: createId(), role: 'assistant', text: payload.text }]);
        return;
      }
      if (payload.type === 'ui.command' && payload.action.type === 'navigate') {
        router.push(payload.action.to);
        ws.send(
          JSON.stringify({
            type: 'client.event',
            event: 'ui.command.executed',
            payload: { commandId: payload.commandId, action: payload.action },
          }),
        );
        return;
      }
      if (payload.type === 'error') {
        setMessages((prev) => [...prev, { id: createId(), role: 'assistant', text: payload.message }]);
      }
    });

    return () => {
      wsRef.current = null;
      recovery.cancel();
      ws.close();
    };
  }, [router, wsUrl, connectionAttempt]);

  function sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || wsRef.current?.readyState !== WebSocket.OPEN || status !== 'ready') return;
    setMessages((prev) => [...prev, { id: createId(), role: 'user', text: trimmed }]);
    wsRef.current.send(JSON.stringify({ type: 'user.message', text: trimmed, conversationId: conversationIdRef.current, playbackId: crypto.randomUUID() }));
    setInput('');
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <div>
            <h1>AI Tutor Control Room</h1>
            <p>Navigation scaffold for the future Latvian tutor.</p>
          </div>
          <span className={`${styles.status} ${styles[status]}`}>{status}</span>
        </header>

        <div className={styles.messages}>
          {messages.map((message) => (
            <div key={message.id} className={`${styles.message} ${styles[message.role]}`}>
              {message.text}
            </div>
          ))}
        </div>

        <form
          className={styles.composer}
          onSubmit={(event) => {
            event.preventDefault();
            sendText(input);
          }}
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Например: открой грамматику"
          />
          <button type="submit" disabled={status !== 'ready' || !input.trim()}>
            Send
          </button>
        </form>

        <div className={styles.quickActions}>
          {['открой главную', 'открой словарь 1', 'открой грамматику', 'открой кабинет'].map((text) => (
            <button key={text} type="button" onClick={() => sendText(text)} disabled={status !== 'ready'}>
              {text}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
