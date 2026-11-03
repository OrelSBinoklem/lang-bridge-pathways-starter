'use client';
import { AmbientParticles } from '../engine';
import { FullscreenCanvas } from './FullscreenCanvas';
import type { FullscreenEffectProps } from './types';

export function AmbientFullscreen({ effect, width, height, pointerRef, tuning }: FullscreenEffectProps) {
  const config = tuning?.kind === 'ambient' ? tuning.params : effect.ambient;
  return <FullscreenCanvas>{config && <AmbientParticles width={width} height={height} pointerRef={pointerRef} config={config} />}</FullscreenCanvas>;
}
