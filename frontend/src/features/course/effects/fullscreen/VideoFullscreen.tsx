'use client';
import { useEffect } from 'react';
import { VideoLoopEffect } from '../VideoLoopEffect';
import type { FullscreenEffectProps } from './types';

export function VideoFullscreen({ effect }: FullscreenEffectProps) {
  useEffect(() => {
    if (!effect.videoSrc) return;
    // Match other full-page scenes: translucent panel backgrounds, fully opaque text and buttons.
    document.body.classList.add('scene-body-active');
    return () => document.body.classList.remove('scene-body-active');
  }, [effect.videoSrc]);
  return effect.videoSrc ? <VideoLoopEffect src={effect.videoSrc} /> : null;
}
