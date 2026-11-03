export const CREDIT_REFRESH_EVENT = 'lbp:credits-changed';
export const CREDIT_REFRESH_STORAGE = 'lbp:credits-changed';
export const CREDIT_BALANCE_UPDATED = 'lbp:credits-updated';
export const CREDIT_POLL_MS = 120000;

export function notifyCreditsChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CREDIT_REFRESH_EVENT));
  try {
    window.localStorage.setItem(CREDIT_REFRESH_STORAGE, `${Date.now()}:${Math.random()}`);
  } catch { /* The current tab still updates when storage is unavailable. */ }
}

export function isCreditMutation(path: string, method = 'GET') {
  if (['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) return false;
  const endpoint = path.split('?')[0];
  return endpoint === '/me/subscription'
    || /^\/lessons\/blocks\/[^/]+\/translation-check$/.test(endpoint)
    || /^\/exam-attempts\/[^/]+\/(?:grade|speech)$/.test(endpoint)
    || /^\/tutor\/(?:messages|references|memory\/search-history|memory\/notes(?:\/search)?|memory\/difficult-words|memory\/progress-estimates)$/.test(endpoint);
}

export function watchCreditBalance(refresh: (signal: AbortSignal) => Promise<void>, onError: () => void) {
  const abort = new AbortController();
  let inFlight = false;
  let dirty = false;
  let debounce: ReturnType<typeof setTimeout> | undefined;

  async function run() {
    clearTimeout(debounce);
    if (abort.signal.aborted || document.hidden) return;
    if (inFlight) { dirty = true; return; }
    inFlight = true;
    try { await refresh(abort.signal); }
    catch { if (!abort.signal.aborted) onError(); }
    finally {
      inFlight = false;
      if (dirty && !abort.signal.aborted) { dirty = false; schedule(); }
    }
  }
  function schedule() {
    if (abort.signal.aborted || document.hidden) return;
    clearTimeout(debounce);
    debounce = setTimeout(() => { void run(); }, 200);
  }
  function storage(event: StorageEvent) {
    if (event.key === CREDIT_REFRESH_STORAGE) schedule();
  }
  const interval = setInterval(() => { void run(); }, CREDIT_POLL_MS);
  window.addEventListener(CREDIT_REFRESH_EVENT, schedule);
  window.addEventListener('storage', storage);
  window.addEventListener('focus', schedule);
  document.addEventListener('visibilitychange', schedule);
  void run();
  return {
    refresh: () => { void run(); },
    stop: () => {
      abort.abort();
      clearInterval(interval);
      clearTimeout(debounce);
      window.removeEventListener(CREDIT_REFRESH_EVENT, schedule);
      window.removeEventListener('storage', storage);
      window.removeEventListener('focus', schedule);
      document.removeEventListener('visibilitychange', schedule);
    },
  };
}
