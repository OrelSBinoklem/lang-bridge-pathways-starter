'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'lbp_course_effect_variants';
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// The raw string, not a parsed object: useSyncExternalStore compares snapshots by identity, so a
// freshly parsed object on every call would look like a change and re-render forever.
function getSnapshot(): string {
  return window.localStorage.getItem(STORAGE_KEY) ?? '{}';
}

function getServerSnapshot(): string {
  return '{}';
}

function parse(raw: string): Record<string, string> {
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === 'object' ? (value as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Persisted per-group choice of effect variant (e.g. leaves vs. sakura), keyed by category id. */
export function useGroupEffectVariants(): [Record<string, string>, (categoryId: number, variantId: string) => void] {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const selected = useMemo(() => parse(raw), [raw]);
  const select = useCallback((categoryId: number, variantId: string) => {
    const next = { ...parse(getSnapshot()), [categoryId]: variantId };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    listeners.forEach((listener) => listener());
  }, []);
  return [selected, select];
}
