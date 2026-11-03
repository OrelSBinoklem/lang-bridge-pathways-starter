import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { AuthForm } from '@/components/auth-form';

export const metadata: Metadata = { title: 'Login' };

export default async function LoginPage() {
  const t = await getTranslations('Auth');
  const tCommon = await getTranslations('Common');

  return (
    <section className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t('loginHeading')}</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">{t('loginHint')}</p>
      </div>
      <Suspense fallback={<div className="text-sm text-zinc-500">{tCommon('loading')}</div>}>
        <AuthForm mode="login" />
      </Suspense>
    </section>
  );
}
