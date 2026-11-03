'use client';
import { useMemo } from 'react';
import { AmberEffect } from '../culture/AmberEffect';
import { createAmberParams } from '../culture/params';
import type { FullscreenEffectProps } from './types';

export function AmberFullscreen({ width, height, pointerRef, tuning }: FullscreenEffectProps) {
  const fallback = useMemo(() => createAmberParams(), []);
  return <AmberEffect width={width} height={height} pointerRef={pointerRef} params={tuning?.kind === 'amber-words' ? tuning.params : fallback} />;
}
