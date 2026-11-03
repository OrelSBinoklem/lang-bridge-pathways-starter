'use client';

/**
 * Module-level bridge so a lesson block (mounted inside a page, far from the single globally
 * mounted FloatingTutorAssistant in app-shell.tsx) can tell the bot which task is currently
 * open. No React context needed — same "external store" shape as useEffectsEnabled.
 */
export type LessonContext = {
  topic: string;
  text: string;
  instructions: string;
  lessonBlockId: number;
  variantId: number | null;
  format: 'writing' | 'speaking';
  completed: boolean;
} | null;

let current: LessonContext = null;
let tutorSlot: HTMLDivElement | null = null;
const listeners = new Set<() => void>();

export function setLessonTutorSlot(next: HTMLDivElement | null) {
  if (tutorSlot === next) return;
  tutorSlot = next;
  listeners.forEach((listener) => listener());
}

export function getLessonTutorSlot() {
  return tutorSlot;
}

export function getServerLessonTutorSlot() {
  return null;
}

export function setLessonContext(next: LessonContext) {
  current = next;
  listeners.forEach((listener) => listener());
}

export function clearLessonContext(forLessonBlockId?: number) {
  if (forLessonBlockId != null && current?.lessonBlockId !== forLessonBlockId) return;
  setLessonContext(null);
}

export function subscribeLessonContext(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLessonContext(): LessonContext {
  return current;
}

function getServerLessonContext(): LessonContext {
  return null;
}

export { getServerLessonContext };
