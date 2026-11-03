'use client';

import { useEffect, useMemo, useState } from 'react';
import { LiquidDropsEffect } from '@/features/course/effects/LiquidDropsEffect';
import {
  LIQUID_DROPS_PRESETS,
  type LiquidDropsParams,
  type LiquidDropsScene,
} from '@/features/course/effects/liquidDrops/params';

/** Stand-in for the course cards, to judge readability over the effect. */
export function LiquidDropsPreview({
  scene,
  columns,
  image,
  preset,
}: {
  scene?: LiquidDropsScene;
  columns?: number;
  image?: string;
  preset?: string;
}) {
  const [enabled, setEnabled] = useState(true);
  const initialParams = useMemo<Partial<LiquidDropsParams>>(
    () => ({
      ...(preset ? LIQUID_DROPS_PRESETS[preset].look : {}),
      ...(scene ? { scene } : {}),
      ...(columns ? { columns } : {}),
      ...(image ? { scene: 'custom' as const, customImage: image } : {}),
    }),
    [preset, scene, columns, image],
  );
  useEffect(() => {
    document.body.classList.toggle('body-effect-active', enabled);
    return () => document.body.classList.remove('body-effect-active');
  }, [enabled]);
  return (
    <div style={{ minHeight: '80vh', position: 'relative', zIndex: 1, padding: 24 }}>
      <div id="course-effect-gui-anchor" style={{ position: 'fixed', top: 100, right: 12, zIndex: 9998, pointerEvents: 'none' }} />
      <label style={{ background: 'var(--background)', padding: 12, display: 'inline-flex', gap: 8 }}>
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        Красота и здоровье
      </label>
      <div style={{ display: 'grid', gap: 12, maxWidth: 520, marginTop: 24 }}>
        {['Внешность и уход', 'Здоровье и врач', 'Спорт и отдых'].map((title) => (
          <div key={title} style={{ background: 'var(--background)', borderRadius: 12, padding: 16 }}>
            <strong>{title}</strong>
            <p style={{ margin: '6px 0 0' }}>Пример карточки курса поверх эффекта, чтобы оценить читаемость текста.</p>
          </div>
        ))}
      </div>
      {enabled && <LiquidDropsEffect initialParams={initialParams} />}
    </div>
  );
}
