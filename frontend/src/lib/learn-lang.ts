export type LearnLang = 'lv' | 'en';

export const LEARN_LANG_COOKIE = 'selected_lang';

/** Синхронизация модалки языков ↔ SelectButton без перезагрузки */
export const LEARN_LANG_EVENT = 'lbp:learn-lang';

export function getLearnLangFromCookie(): LearnLang | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|; )selected_lang=([^;]+)/);
  const value = match?.[1]?.toLowerCase();
  return value === 'lv' || value === 'en' ? value : null;
}

export function setLearnLangCookie(lang: LearnLang): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${LEARN_LANG_COOKIE}=${lang}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

export function applyLearnLang(lang: LearnLang): void {
  setLearnLangCookie(lang);
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<LearnLang>(LEARN_LANG_EVENT, { detail: lang }));
}

export function isLearnLang(value: unknown): value is LearnLang {
  return value === 'lv' || value === 'en';
}
