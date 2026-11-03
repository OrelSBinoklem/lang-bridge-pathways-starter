'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { isCameraAdmin, onCameraAdminChange } from './scenes/orbitControl';

const STORAGE_KEY = 'lbp_course_effect_comparison';
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  const stopAdmin = onCameraAdminChange(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    stopAdmin();
    window.removeEventListener('storage', onStorage);
  };
}

function getSnapshot() {
  return isCameraAdmin() && window.localStorage.getItem(STORAGE_KEY) === '1';
}

const getServerSnapshot = () => false;

/** Administrator opt-in: compare the same selected effect in its card and page compositions. */
export function useEffectComparison(): [boolean, (next: boolean) => void] {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const update = useCallback((next: boolean) => {
    if (!isCameraAdmin()) return;
    window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    listeners.forEach(listener => listener());
  }, []);
  return [enabled, update];
}
