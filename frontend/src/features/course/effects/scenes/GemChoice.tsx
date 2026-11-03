'use client';

import { useReducer } from 'react';
import { GEMS } from './gemsData';
import type { SceneParams } from './types';

// Scene parameters are an imperative engine store shared with the existing tuning panel.
function chooseGem(store: SceneParams, index: number) { store.gmGem = index; }

/** One native picker works inside a short card and on a phone without a clipped canvas menu. */
export function GemChoice({ params }: { params: SceneParams }) {
  const [, refresh] = useReducer((value: number) => value + 1, 0);
  const selected = Math.max(0, Math.min(GEMS.length - 1, Math.round(params.gmGem)));
  return <select aria-label="Выбрать камень" value={selected}
    onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}
    onChange={event => { chooseGem(params, Number(event.target.value)); refresh(); }}
    style={{ position: 'absolute', left: 8, bottom: 8, width: 'calc(100% - 24px)', maxWidth: 240, height: 28,
      zIndex: 2, pointerEvents: 'auto', touchAction: 'manipulation', border: '1px solid #b8a078', borderRadius: 7,
      padding: '3px 8px', background: 'rgba(20,16,22,.86)', color: '#f6eee0', font: '12px sans-serif', textOverflow: 'ellipsis' }}>
    {GEMS.map((gem, index) => <option key={gem.id} value={index}>{gem.name} — {gem.note}</option>)}
  </select>;
}
