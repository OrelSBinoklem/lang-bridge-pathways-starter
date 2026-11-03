'use client';
import { SunWaterEffect } from '../SunWaterEffect';
import type { FullscreenEffectProps } from './types';

export function SunWaterFullscreen({ width, height, pointerRef, tuning }: FullscreenEffectProps) {
  return <SunWaterEffect width={width} height={height} pointerRef={pointerRef} params={tuning?.kind === 'sun-water' ? tuning.params : undefined} />;
}
