export function createTraceMonitor({ archive, authorized, verify = async () => {}, send }) {
  const subscribers = new Map();
  const pending = new WeakMap(); let activeRequests = 0;
  return {
    changed(run) {
      for (const [ws, subscription] of subscribers) {
        if (!authorized(ws) || subscription.userId !== run.userId || subscription.botId !== (run.botId ?? 'tutor') || subscription.conversationId && run.conversationId && subscription.conversationId !== run.conversationId || subscription.timer) continue;
        subscription.timer = setTimeout(() => { subscription.timer = null; if (authorized(ws)) send(ws, { type: 'debug.monitor.changed', userId: run.userId }); }, 750);
        subscription.timer.unref?.();
      }
    },
    close(ws) { const item = subscribers.get(ws); if (item?.timer) clearTimeout(item.timer); subscribers.delete(ws); },
    async handle(ws, message) {
      if (message.type !== 'debug.monitor') return false;
      const id = typeof message.id === 'string' ? message.id.slice(0, 64) : '';
      let counted = false;
      try {
        if (!authorized(ws)) throw Error('Отладка доступна только администраторам.');
        if ((pending.get(ws) ?? 0) >= 2 || activeRequests >= 8 || (ws.bufferedAmount ?? 0) > 4 * 1024 * 1024) throw Error('Дождитесь загрузки текущего снимка.');
        counted = true; pending.set(ws, (pending.get(ws) ?? 0) + 1); activeRequests++;
        try { await verify(ws); } catch { this.close(ws); throw Error('Админский доступ к отладке истёк или отозван. Откройте страницу заново.'); }
        if (!Number.isSafeInteger(message.userId) || message.userId < 1 || message.conversationId != null && (!Number.isSafeInteger(message.conversationId) || message.conversationId < 1)) throw Error('Неверный пользователь или беседа.');
        const previous = subscribers.get(ws), now = Date.now();
        const rate = previous?.rate && now - previous.rate.start < 60000 ? previous.rate : { start: now, count: 0 };
        if (++rate.count > 100) throw Error('Слишком много запросов отладки.');
        const botId = message.botId ?? 'tutor';
        if (typeof botId !== 'string' || !/^[a-z_]{1,50}$/.test(botId)) throw Error('Неверный бот.');
        const subscription = { userId: message.userId, botId, conversationId: message.conversationId ?? null, rate, timer: previous?.timer ?? null };
        subscribers.set(ws, subscription);
        let data;
        if (message.action === 'list') data = await archive.list(message.userId, message.conversationId, botId);
        else if (message.action === 'detail') data = await archive.detail(message.userId, message.runId, botId);
        else if (message.action === 'watch' && typeof message.enabled === 'boolean') data = await archive.watch(message.userId, message.enabled, botId);
        else throw Error('Неизвестное действие отладки.');
        send(ws, { type: 'debug.monitor.result', id, data });
      } catch (error) { send(ws, { type: 'debug.monitor.result', id, error: error.message }); }
      finally { if (counted) { pending.set(ws, (pending.get(ws) ?? 1) - 1); activeRequests--; } }
      return true;
    },
  };
}
