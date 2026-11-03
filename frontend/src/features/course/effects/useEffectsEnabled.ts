'use client';

import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'lbp_course_effects_enabled';
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === '1') return true;
  if (raw === '0') return false;
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// Server/first paint has no access to localStorage or matchMedia; default to on and let
// useSyncExternalStore reconcile with the real preference right after hydration.
function getServerSnapshot(): boolean {
  return true;
}

/**
 * Persisted opt-in/out for the WebGL group effects. Defaults to on, except when the OS
 * requests reduced motion and the user has not made an explicit choice yet.
 */
export function useEffectsEnabled(): [boolean, (next: boolean) => void] {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const update = useCallback((next: boolean) => {
    window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    listeners.forEach((listener) => listener());
  }, []);
  return [enabled, update];
}
