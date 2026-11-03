'use client';

import { useEffect, useState } from 'react';
import { BodyLiquidGlassEffect } from '@/features/course/effects/BodyLiquidGlassEffect';

export default function LiquidGlassPreview() {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    document.body.classList.toggle('body-effect-active', enabled);
    return () => document.body.classList.remove('body-effect-active');
  }, [enabled]);
  return <div style={{ minHeight: '80vh', position: 'relative', zIndex: 1, padding: 24 }}>
    <div id="course-effect-gui-anchor" style={{ position: 'fixed', top: 100, right: 12, zIndex: 9998, pointerEvents: 'none' }} />
    <label style={{ background: 'var(--background)', padding: 12, display: 'inline-flex', gap: 8 }}>
      <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
      Я интересуюсь…
    </label>
    {enabled && <BodyLiquidGlassEffect />}
  </div>;
}
