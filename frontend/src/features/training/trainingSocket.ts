import type { ProgressRow } from '@/features/training/helpers';
import { clientApi } from '@/lib/client-api';

type AttemptPayload = {
  word_id: number;
  is_revert: boolean;
  is_correct: boolean;
  is_first_attempt: boolean;
  cooldown_tier: number;
};

type Pending = {
  resolve: (row: ProgressRow) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const DEFAULT_WS_URL = 'ws://localhost:8091';
const REQUEST_TIMEOUT_MS = 8000;

/** `http` (default) → Laravel POST /training/attempt; `ws` → Node tools/training-ws */
export function attemptTransport(): 'http' | 'ws' {
  const v = (process.env.NEXT_PUBLIC_TRAINING_ATTEMPT_TRANSPORT || 'http').trim().toLowerCase();
  return v === 'ws' ? 'ws' : 'http';
}

function wsUrl(): string {
  return process.env.NEXT_PUBLIC_TRAINING_WS_URL || DEFAULT_WS_URL;
}

let socket: WebSocket | null = null;
let connectPromise: Promise<WebSocket> | null = null;
let ready = false;
const pending = new Map<string, Pending>();

function rejectAll(err: Error) {
  for (const [, p] of pending) {
    clearTimeout(p.timer);
    p.reject(err);
  }
  pending.clear();
}

async function fetchAuthToken(): Promise<string> {
  const res = await fetch('/api/training-ws/token', { cache: 'no-store' });
  if (!res.ok) throw new Error('Не удалось получить токен для WebSocket');
  const body = (await res.json()) as { token?: string };
  if (!body.token) throw new Error('Пустой токен WebSocket');
  return body.token;
}

function attachHandlers(ws: WebSocket) {
  ws.addEventListener('message', (ev) => {
    let msg: {
      id?: string;
      type?: string;
      data?: ProgressRow;
      message?: string;
    };
    try {
      msg = JSON.parse(String(ev.data));
    } catch {
      return;
    }

    if (msg.type === 'ready') {
      ready = true;
      return;
    }

    if (!msg.id) return;
    const p = pending.get(msg.id);
    if (!p) return;
    clearTimeout(p.timer);
    pending.delete(msg.id);

    if (msg.type === 'attempt.ok' && msg.data) {
      p.resolve(msg.data);
      return;
    }
    p.reject(new Error(msg.message || 'Ошибка сохранения ответа'));
  });

  ws.addEventListener('close', () => {
    ready = false;
    socket = null;
    connectPromise = null;
    rejectAll(new Error('WebSocket закрыт'));
  });

  ws.addEventListener('error', () => {
    /* close handler will reject pending */
  });
}

/** For `ws` transport — open socket. For `http` — no-op. */
export async function ensureTrainingSocket(): Promise<WebSocket | null> {
  if (attemptTransport() === 'http') return null;

  if (socket && socket.readyState === WebSocket.OPEN && ready) return socket;
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    const token = await fetchAuthToken();
    const url = `${wsUrl()}?token=${encodeURIComponent(token)}`;

    const ws = await new Promise<WebSocket>((resolve, reject) => {
      const s = new WebSocket(url);
      const fail = (e: Error) => {
        reject(e);
      };

      const onMessage = (ev: MessageEvent) => {
        try {
          const msg = JSON.parse(String(ev.data)) as { type?: string; message?: string };
          if (msg.type === 'ready') {
            ready = true;
            s.removeEventListener('message', onMessage);
            attachHandlers(s);
            resolve(s);
            return;
          }
          if (msg.type === 'error') {
            fail(new Error(msg.message || 'Unauthorized'));
            s.close();
          }
        } catch {
          /* ignore */
        }
      };

      s.addEventListener('message', onMessage);
      s.addEventListener('error', () => fail(new Error('Не удалось подключить Training WS')));
      s.addEventListener('close', () => {
        if (!ready) fail(new Error('Training WS закрыт до ready'));
      });
    });

    socket = ws;
    return ws;
  })();

  try {
    return await connectPromise;
  } catch (e) {
    connectPromise = null;
    socket = null;
    ready = false;
    throw e;
  }
}

export function closeTrainingSocket() {
  if (attemptTransport() === 'http') return;

  rejectAll(new Error('Тренировка завершена'));
  ready = false;
  connectPromise = null;
  if (socket) {
    try {
      socket.close();
    } catch {
      /* ignore */
    }
  }
  socket = null;
}

async function submitAttemptHttp(payload: AttemptPayload): Promise<ProgressRow> {
  const res = await clientApi<{ data: ProgressRow }>('/training/attempt', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

async function submitAttemptWs(payload: AttemptPayload): Promise<ProgressRow> {
  const ws = await ensureTrainingSocket();
  if (!ws) throw new Error('Training WS недоступен');

  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return new Promise<ProgressRow>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Таймаут Training WS'));
    }, REQUEST_TIMEOUT_MS);

    pending.set(id, { resolve, reject, timer });
    ws.send(
      JSON.stringify({
        id,
        type: 'attempt',
        word_id: payload.word_id,
        is_revert: payload.is_revert,
        is_correct: payload.is_correct,
        is_first_attempt: payload.is_first_attempt,
        cooldown_tier: payload.cooldown_tier,
      }),
    );
  });
}

export async function submitAttempt(payload: AttemptPayload): Promise<ProgressRow> {
  if (attemptTransport() === 'ws') {
    return submitAttemptWs(payload);
  }
  return submitAttemptHttp(payload);
}
