'use client';

import type { ReactNode } from 'react';

const FILL = { position: 'absolute', inset: 0, width: '100%', height: '100%' } as const;

/** Posters are pre-generated files: browsing the gallery must never initialize an effect. */
export function EffectPreviewPoster({ running, title, children, stillSrc }: {
  running: boolean; title: string; children: ReactNode; stillSrc: string;
}) {
  return <div style={FILL} data-effect-preview={running ? 'live' : 'ready'}>
    {running
      ? <div style={FILL}>{children}</div>
      // Native lazy loading keeps off-screen posters cheap, without any canvas warm-up.
      // eslint-disable-next-line @next/next/no-img-element
      : <img src={stillSrc} alt={`Превью: ${title}`} loading="lazy" decoding="async" width={560} height={350} style={{ ...FILL, objectFit: 'cover' }} />}
  </div>;
}
