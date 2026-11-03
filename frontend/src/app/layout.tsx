import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { AppShell } from '@/components/app-shell';
import { Providers } from '@/components/providers';
import { isLearnLang, LEARN_LANG_COOKIE } from '@/lib/learn-lang';
import { GRAMMAR_FONT_COOKIE, isGrammarFontLarge } from '@/lib/grammar-font-preference';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: process.env.NEXT_PUBLIC_APP_NAME ?? 'LBPW',
    template: `%s · ${process.env.NEXT_PUBLIC_APP_NAME ?? 'LBPW'}`,
  },
  description: 'Next.js + PrimeReact frontend for Laravel API',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const cookieStore = await cookies();
  const learnLangValue = cookieStore.get(LEARN_LANG_COOKIE)?.value?.toLowerCase();
  const initialLearnLang = isLearnLang(learnLangValue) ? learnLangValue : 'lv';
  const initialLargeFont = isGrammarFontLarge(cookieStore.get(GRAMMAR_FONT_COOKIE)?.value);

  return (
    <html lang={locale} suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full${initialLargeFont ? ' lbp-font-large' : ''}`}>
      <body className="min-h-full antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <AppShell initialLearnLang={initialLearnLang} initialLargeFont={initialLargeFont}>{children}</AppShell>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
