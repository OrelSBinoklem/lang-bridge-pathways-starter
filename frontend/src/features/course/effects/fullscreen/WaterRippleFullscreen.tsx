'use client';
import { WaterRippleEffect } from '../WaterRippleEffect';
import type { FullscreenEffectProps } from './types';

export function WaterRippleFullscreen({ width, height, pointerRef }: FullscreenEffectProps) {
  return <WaterRippleEffect width={width} height={height} pointerRef={pointerRef} />;
}
