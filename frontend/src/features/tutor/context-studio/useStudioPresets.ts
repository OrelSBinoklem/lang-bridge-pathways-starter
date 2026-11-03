'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clientApi } from '@/lib/client-api';
import type { TutorPresetData } from '../tutorPresets';
import { presetFailure, presetSavePayload, type PresetDraft } from './presetSettings';

export function useStudioPresets() {
  const [data, setData] = useState<TutorPresetData | null>(null);
  const [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  const fetchPresets = useCallback(async (signal?: AbortSignal) => {
    try { const result = await clientApi<{ data: TutorPresetData }>('/tutor/presets', { signal }); if (mounted.current && !signal?.aborted) { setData(result.data); setError(''); } }
    catch (cause) { if (!signal?.aborted && mounted.current) setError(presetFailure(cause)); }
    finally { if (mounted.current && !signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    mounted.current = true; const abort = new AbortController();
    void clientApi<{ data: TutorPresetData }>('/tutor/presets', { signal: abort.signal })
      .then(result => { if (!abort.signal.aborted) { setData(result.data); setError(''); } })
      .catch(cause => { if (!abort.signal.aborted) setError(presetFailure(cause)); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    const updated = (event: Event) => { const next = (event as CustomEvent<TutorPresetData>).detail; if (next?.presets) setData(next); };
    window.addEventListener('lbp:tutor-presets-updated', updated);
    return () => { mounted.current = false; abort.abort(); window.removeEventListener('lbp:tutor-presets-updated', updated); };
  }, []);
  const refresh = useCallback(() => { setLoading(true); setError(''); return fetchPresets(); }, [fetchPresets]);
  const save = useCallback(async (draft: PresetDraft) => {
    const result = await clientApi<{ data: TutorPresetData }>(`/tutor/presets/${draft.id}`, { method: 'PUT', body: JSON.stringify(presetSavePayload(draft)) });
    if (mounted.current) setData(result.data);
    window.dispatchEvent(new CustomEvent('lbp:tutor-presets-updated', { detail: result.data }));
    return result.data;
  }, []);
  return { data, error, loading, refresh, save };
}
