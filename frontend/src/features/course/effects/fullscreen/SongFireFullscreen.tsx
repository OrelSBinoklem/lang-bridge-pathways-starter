'use client';
import { useMemo } from 'react';
import { SongFireEffect } from '../culture/SongFireEffect';
import { createSongFireParams } from '../culture/params';
import type { FullscreenEffectProps } from './types';

export function SongFireFullscreen({ width, height, pointerRef, tuning }: FullscreenEffectProps) {
  const fallback = useMemo(() => createSongFireParams(), []);
  return <SongFireEffect fullscreen width={width} height={height} pointerRef={pointerRef} params={tuning?.kind === 'song-fire' ? tuning.params : fallback} />;
}
