'use client';

import type { CSSProperties, Ref } from 'react';
import { toggleWebglGui } from '@/components/webgl-gui-toggle';

/** Shared by the test page and course: keep the original preview controls unchanged. */
export function EffectDebugToggle({ style, settings = false }: { style?: CSSProperties; settings?: boolean }) {
  return <button type="button" onPointerDown={event => event.stopPropagation()} onClick={toggleWebglGui}
    title="Панель отладки (dat.GUI)" style={{
      padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.28)',
      background: '#222a31', color: '#eef2f5', font: '500 14px sans-serif', cursor: 'pointer',
      position: 'relative', zIndex: 2, ...style,
    }}>{settings ? '⚙ Настройки' : '⋮ Отладка'}</button>;
}

export function EffectLoadBadge({ ref, style }: { ref?: Ref<HTMLDivElement>; style?: CSSProperties }) {
  return <div ref={ref} data-scene-load="" style={{
    position: 'absolute', right: 8, bottom: 44, zIndex: 4, pointerEvents: 'none', padding: '3px 8px', borderRadius: 7,
    background: 'rgba(8,10,14,0.72)', font: '500 11.5px ui-monospace, Consolas, monospace', color: '#8fe3a4', whiteSpace: 'nowrap',
    maxWidth: 'calc(100% - 16px)', overflow: 'hidden', textOverflow: 'ellipsis', ...style,
  }} />;
}
