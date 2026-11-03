'use client';

import { useEffect, useRef, useState } from 'react';

const STAGES = [
  '/course/effects/chick-1.svg',
  '/course/effects/chick-2.svg',
  '/course/effects/chick-3.svg',
  '/course/effects/chick-4.svg',
  '/course/effects/chick-5.svg',
];

function stageOpacity(index: number, t: number): number {
  return Math.max(0, 1 - Math.abs(t - index));
}

/**
 * 5-stage egg-to-chick crossfade for the intro group, driven by cursor X position
 * across the whole `.group` block (0% = left edge/egg, 100% = right edge/chick).
 */
export function ChickHatchStages({ getHost }: { getHost: () => HTMLElement | null }) {
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);

  useEffect(() => {
    const host = getHost();
    if (!host) return;
    const handleMove = (event: MouseEvent) => {
      const rect = host.getBoundingClientRect();
      const ratio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
      const clamped = Math.min(1, Math.max(0, ratio));
      if (Math.abs(clamped - progressRef.current) > 0.003) {
        progressRef.current = clamped;
        setProgress(clamped);
      }
    };
    host.addEventListener('mousemove', handleMove);
    return () => host.removeEventListener('mousemove', handleMove);
  }, [getHost]);

  const t = progress * (STAGES.length - 1);

  return (
    <span aria-hidden="true" style={{ display: 'block', position: 'relative', width: 112, height: 112, flex: '0 0 auto' }}>
      {/*
        Stages don't share the same silhouette (the chick's wings/head extend past the
        egg's outline), so mid-crossfade a pixel covered by only one image sits at ~50%
        opacity and the page's white background bleeds through. This static warm glow
        never fades, so that gap reveals a soft tint instead of a white flash.
      */}
      <span
        style={{
          position: 'absolute', inset: '6%', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,231,189,.55), rgba(255,231,189,0) 70%)',
        }}
      />
      {STAGES.map((src, index) => (
        <img
          key={src}
          src={src}
          alt=""
          width={112}
          height={112}
          style={{ position: 'absolute', inset: 0, opacity: stageOpacity(index, t), transition: 'opacity 60ms linear', pointerEvents: 'none' }}
        />
      ))}
    </span>
  );
}
