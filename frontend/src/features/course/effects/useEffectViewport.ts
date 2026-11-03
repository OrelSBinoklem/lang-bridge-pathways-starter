'use client';

import { useSyncExternalStore } from 'react';
import { FULL_HD_EFFECT_QUERY } from './effectPlacement';

function subscribe(listener: () => void) {
  const query = window.matchMedia(FULL_HD_EFFECT_QUERY);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}

const getSnapshot = () => window.matchMedia(FULL_HD_EFFECT_QUERY).matches;
const getServerSnapshot = () => false;

/** Subscribe only to crossing Full HD, not every resize pixel. SSR starts without a full-page renderer. */
export function useEffectViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
