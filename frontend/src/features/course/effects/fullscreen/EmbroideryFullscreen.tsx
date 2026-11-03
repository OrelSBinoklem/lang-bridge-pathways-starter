'use client';
import { useMemo } from 'react';
import { EmbroideryEffect } from '../culture/EmbroideryEffect';
import { createEmbroideryParams } from '../culture/params';
import type { FullscreenEffectProps } from './types';

export function EmbroideryFullscreen({ width, height, pointerRef, tuning, region }: FullscreenEffectProps) {
  const fallback = useMemo(() => createEmbroideryParams(), []);
  return <EmbroideryEffect width={width} height={height} pointerRef={pointerRef} composition={region ?? 'full'} params={tuning?.kind === 'embroidery' ? tuning.params : fallback} />;
}
