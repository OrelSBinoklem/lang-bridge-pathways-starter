import {
  type AppLocale,
  isAppLocale,
  localeFromAcceptLanguage,
  UI_LANG_COOKIE,
} from '@/i18n/config';

export { UI_LANG_COOKIE, type AppLocale, isAppLocale };

export function getUiLangFromCookie(): AppLocale | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${UI_LANG_COOKIE}=([^;]+)`));
  const v = m?.[1] ? decodeURIComponent(m[1]) : null;
  return isAppLocale(v) ? v : null;
}

export function applyUiLang(locale: AppLocale) {
  document.cookie = `${UI_LANG_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

export function detectBrowserUiLang(): AppLocale {
  if (typeof navigator === 'undefined') return 'ru';
  return localeFromAcceptLanguage(navigator.languages?.join(',') || navigator.language);
}
