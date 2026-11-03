import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { WebSocketServer } from 'ws';
import { updateAttempts } from './updateAttempts.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PORT = Number(process.env.TRAINING_WS_PORT || 8091);
const HOST = process.env.TRAINING_WS_HOST || '0.0.0.0';

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'lbpw',
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z',
});

/** @type {Map<import('ws').WebSocket, number>} */
const authedUsers = new Map();
const subscriptionTokens = new WeakMap();

async function checkSubscription(token) {
  if (process.env.SUBSCRIPTIONS_ENABLED !== 'true') return;
  const root = (process.env.APP_URL || 'http://lbpw.loc').replace(/\/$/, '');
  const response = await fetch(`${root}/api/me/subscription`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (!response.ok || !(await response.json()).data?.active) throw new Error('Подписка недоступна. Откройте раздел «Доступ и ИИ».');
}

async function resolveUserId(token) {
  if (!token || typeof token !== 'string' || !token.includes('|')) return null;
  const [idPart, plain] = token.split('|', 2);
  const id = Number(idPart);
  if (!Number.isFinite(id) || id <= 0 || !plain) return null;

  const hashed = crypto.createHash('sha256').update(plain).digest('hex');
  const [rows] = await pool.query(
    `SELECT tokenable_id FROM personal_access_tokens
     WHERE id = ? AND token = ? AND tokenable_type LIKE '%User%'
     LIMIT 1`,
    [id, hashed],
  );
  const userId = rows[0]?.tokenable_id;
  if (!userId) return null;

  void pool.query('UPDATE personal_access_tokens SET last_used_at = UTC_TIMESTAMP() WHERE id = ?', [id]);
  return Number(userId);
}

function send(ws, payload) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

function extractToken(req) {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const q = url.searchParams.get('token');
    if (q) return decodeURIComponent(q);
  } catch {
    /* ignore */
  }
  const auth = req.headers.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return null;
}

const wss = new WebSocketServer({ host: HOST, port: PORT });

wss.on('listening', () => {
  console.log(`[training-ws] listening ws://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
});

wss.on('connection', async (ws, req) => {
  try {
    const token = extractToken(req);
    const userId = token ? await resolveUserId(token) : null;
    if (!userId) {
      send(ws, { type: 'error', message: 'Unauthorized' });
      ws.close(4401, 'Unauthorized');
      return;
    }
    await checkSubscription(token);
    authedUsers.set(ws, userId);
    subscriptionTokens.set(ws, token);
    send(ws, { type: 'ready', user_id: userId });
  } catch (e) {
    console.error('[training-ws] auth error', e);
    send(ws, { type: 'error', message: 'Auth failed' });
    ws.close(1011, 'Auth failed');
    return;
  }

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      send(ws, { type: 'error', message: 'Invalid JSON' });
      return;
    }

    const id = msg?.id;
    if (msg?.type !== 'attempt') {
      send(ws, { id, type: 'attempt.error', message: 'Unknown type' });
      return;
    }

    const userId = authedUsers.get(ws);
    if (!userId) {
      send(ws, { id, type: 'attempt.error', message: 'Unauthorized' });
      return;
    }

    const wordId = Number(msg.word_id);
    if (!Number.isFinite(wordId) || wordId <= 0) {
      send(ws, { id, type: 'attempt.error', message: 'Invalid word_id' });
      return;
    }

    try {
      await checkSubscription(subscriptionTokens.get(ws));
      const data = await updateAttempts(pool, {
        userId,
        wordId,
        isRevert: !!msg.is_revert,
        isCorrect: !!msg.is_correct,
        isFirstAttempt: !!msg.is_first_attempt,
        cooldownTier: Number(msg.cooldown_tier) || 0,
      });
      send(ws, { id, type: 'attempt.ok', data });
    } catch (e) {
      console.error('[training-ws] attempt error', e);
      send(ws, { id, type: 'attempt.error', message: e?.message || 'DB error' });
    }
  });

  ws.on('close', () => {
    authedUsers.delete(ws);
  });
});

wss.on('error', (err) => {
  console.error('[training-ws] server error', err);
  process.exit(1);
});
