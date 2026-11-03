export const locales = ['ru', 'uk'] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = 'ru';
export const UI_LANG_COOKIE = 'lbp_ui_lang';

export function isAppLocale(value: unknown): value is AppLocale {
  return value === 'ru' || value === 'uk';
}

/** Accept-Language / navigator → uk если есть uk, иначе ru */
export function localeFromAcceptLanguage(header: string | null | undefined): AppLocale {
  const h = (header || '').toLowerCase();
  if (h.includes('uk')) return 'uk';
  return 'ru';
}
