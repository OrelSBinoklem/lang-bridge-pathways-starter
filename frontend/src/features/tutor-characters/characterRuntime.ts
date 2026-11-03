'use client';

export type SiteCharacterAction = { type: 'site_character'; operation: 'emotion' | 'point'; emotion?: string; target?: string; mode?: string; durationMs?: number };
type Controller = (action: SiteCharacterAction) => Promise<{ matched: number; reason?: string }>;
let controller: Controller | null = null;
const tourOwners = new Set<unknown>();
const legacyTourOwner = Symbol('tour');
const listeners = new Set<() => void>();
export const subscribeCharacterTour = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getCharacterTour = () => tourOwners.size > 0;
export const noCharacterTour = () => false;
export function setCharacterTour(active: boolean, owner: unknown = legacyTourOwner) {
  if (active) tourOwners.add(owner); else tourOwners.delete(owner);
  listeners.forEach(listener => listener());
}
export function registerSiteCharacter(next: Controller) { controller = next; return () => { if (controller === next) controller = null; }; }
export async function runSiteCharacter(action: SiteCharacterAction) {
  if (getCharacterTour()) return { matched: 0, reason: 'tour_active' };
  if (!controller) return { matched: 0, reason: 'site_keeper_not_visible' };
  return controller(action);
}

export type GrammarCharacterFocus = { targets: HTMLElement[]; label: string; durationMs: number; layer?: number };
export function showGrammarCharacter(detail: GrammarCharacterFocus) {
  window.dispatchEvent(new CustomEvent('tutor.character.grammar', { detail }));
}
