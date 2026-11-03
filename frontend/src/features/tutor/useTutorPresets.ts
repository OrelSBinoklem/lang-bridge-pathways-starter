'use client';

import { useEffect, useState } from 'react';
import { clientApi } from '@/lib/client-api';
import { isTutorPreset, normalizePresets, visiblePreset, type TutorPresetData, type TutorPresetId } from './tutorPresets';

const EVENT = 'lbp:tutor-preset-selected';
const UPDATED = 'lbp:tutor-presets-updated';
export function useTutorPresets() {
  const [data, setData] = useState<TutorPresetData | null>(null);
  const [selected, setSelected] = useState<TutorPresetId>('standard');
  const [account, setAccount] = useState<number | null>(null);
  const [accountLoaded, setAccountLoaded] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    void clientApi<{ data: TutorPresetData }>('/tutor/presets', { signal: abort.signal })
      .then(result => setData(normalizePresets(result.data)))
      .catch(() => { if (!abort.signal.aborted) setError('Не удалось загрузить режимы и цены. Обновите страницу.'); });
    void clientApi<{ data: { user_id: number } }>('/me/subscription', { signal: abort.signal })
      .then(result => {
        setAccount(result.data.user_id);
        try { const saved = localStorage.getItem(`lbp_tutor_preset_${result.data.user_id}`); if (isTutorPreset(saved)) setSelected(visiblePreset(saved)); } catch { /* Current tab remains usable. */ }
      }).catch(() => { /* Guest can view prices; choosing applies after sign-in. */ }).finally(() => { if (!abort.signal.aborted) setAccountLoaded(true); });
    const update = (event: Event) => setData(normalizePresets((event as CustomEvent<TutorPresetData>).detail));
    window.addEventListener(UPDATED, update);
    return () => { abort.abort(); window.removeEventListener(UPDATED, update); };
  }, []);
  useEffect(() => {
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<{ account: number | null; id: TutorPresetId }>).detail;
      if (detail.account === account && isTutorPreset(detail.id)) setSelected(visiblePreset(detail.id));
    };
    const storage = (event: StorageEvent) => {
      if (account !== null && event.key === `lbp_tutor_preset_${account}` && isTutorPreset(event.newValue)) setSelected(visiblePreset(event.newValue));
    };
    window.addEventListener(EVENT, sync); window.addEventListener('storage', storage);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', storage); };
  }, [account]);
  function select(id: TutorPresetId) {
    id = visiblePreset(id);
    setSelected(id);
    if (account !== null) try { localStorage.setItem(`lbp_tutor_preset_${account}`, id); } catch { /* Current tab remains usable. */ }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { account, id } }));
  }
  function updated(next: TutorPresetData) {
    window.dispatchEvent(new CustomEvent(UPDATED, { detail: next }));
  }
  return { data, selected, select, updated, error, account, ready: Boolean(data) && accountLoaded };
}
