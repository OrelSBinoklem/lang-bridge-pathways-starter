'use client';

// Ключи, а не сами компоненты: CategoryLayout.jsx попадает сюда из VerbConjugationBase.jsx/
// NounDeclensionBase.jsx, которые сами являются частью customComponents.js — импорт
// customComponents.js отсюда замыкал бы кольцо (см. комментарий в customComponentKeys.js).
import { hasCustomCategoryKey } from '../config/customComponentKeys';

/** Query: ?examen_view=default — показать обычный список слов вместо кастомного шаблона */
export const EXAMEN_VIEW_PARAM = 'examen_view';
export const EXAMEN_VIEW_DEFAULT = 'default';

export function readForceDefaultExamenView() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get(EXAMEN_VIEW_PARAM) === EXAMEN_VIEW_DEFAULT;
}

export function buildExamenViewUrl(forceDefault) {
  const u = new URL(window.location.href);
  if (forceDefault) {
    u.searchParams.set(EXAMEN_VIEW_PARAM, EXAMEN_VIEW_DEFAULT);
  } else {
    u.searchParams.delete(EXAMEN_VIEW_PARAM);
  }
  return `${u.pathname}${u.search}${u.hash}`;
}

export function hasCustomCategoryTemplate(dictionaryId, categoryId) {
  return hasCustomCategoryKey(dictionaryId, categoryId);
}
