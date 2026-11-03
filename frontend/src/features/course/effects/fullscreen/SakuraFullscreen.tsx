'use client';
import { useMemo } from 'react';
import { SakuraEffect, createSakuraParams } from '../SakuraEffect';
import { FullscreenCanvas } from './FullscreenCanvas';
import type { FullscreenEffectProps } from './types';

export function SakuraFullscreen({ width, height, pointerRef, tuning }: FullscreenEffectProps) {
  const fallback = useMemo(() => createSakuraParams(), []);
  return <FullscreenCanvas><SakuraEffect width={width} height={height} pointerRef={pointerRef} params={tuning?.kind === 'sakura' ? tuning.params : fallback} /></FullscreenCanvas>;
}
