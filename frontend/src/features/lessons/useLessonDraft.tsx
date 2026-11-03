'use client';

import { createContext, useContext, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { readDraft } from './draftStorage';

export const LessonDraftContext = createContext<string | null>(null);

// Callers mount only after identity is known and remount when the scope changes.
// Write on input, rather than cleanup, so a navigation cannot discard the last edit.
export function useStoredLessonState<T>(key: string | null, initial: T, accepts: (value: unknown) => value is T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (!key || typeof window === 'undefined') return initial;
    try { return readDraft(window.sessionStorage, key, initial, accepts); }
    catch { console.warn('Lesson draft storage is unavailable.'); return initial; }
  });
  const current = useRef(value);
  const setStoredValue: Dispatch<SetStateAction<T>> = next => {
    const resolved = typeof next === 'function' ? (next as (previous: T) => T)(current.current) : next;
    current.current = resolved;
    if (key) {
      try { window.sessionStorage.setItem(key, JSON.stringify(resolved)); }
      catch { console.warn('Lesson draft could not be saved.'); }
    }
    setValue(resolved);
  };
  return [value, setStoredValue];
}

export function useLessonDraft<T>(field: string, initial: T, accepts: (value: unknown) => value is T) {
  const scope = useContext(LessonDraftContext);
  return useStoredLessonState(scope ? `${scope}:${field}` : null, initial, accepts);
}

export const isDraftText = (value: unknown): value is string => typeof value === 'string';
