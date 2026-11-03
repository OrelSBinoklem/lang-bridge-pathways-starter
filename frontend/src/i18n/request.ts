import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import {
  defaultLocale,
  isAppLocale,
  localeFromAcceptLanguage,
  UI_LANG_COOKIE,
} from '@/i18n/config';

export default getRequestConfig(async () => {
  const jar = await cookies();
  const fromCookie = jar.get(UI_LANG_COOKIE)?.value;
  const locale = isAppLocale(fromCookie)
    ? fromCookie
    : localeFromAcceptLanguage((await headers()).get('accept-language'));

  return {
    locale: locale || defaultLocale,
    messages: (await import(`../../messages/${locale || defaultLocale}.json`)).default,
  };
});
