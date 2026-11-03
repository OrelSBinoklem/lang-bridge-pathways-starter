import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { LogoutButton } from '@/components/logout-button';
import { apiFetch, type ApiUser } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const token = await getAuthToken();
  const t = await getTranslations('Dashboard');

  if (!token) {
    redirect('/login');
  }

  let user: ApiUser | null = null;

  try {
    const payload = await apiFetch<{ user: ApiUser }>('/user', { token });
    user = payload.user;
  } catch {
    redirect('/login');
  }

  return (
    <section className="grid gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">{t('subtitle')}</p>
        </div>
        <LogoutButton />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">{t('name')}</dt>
            <dd className="font-medium">{user.name}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">{t('email')}</dt>
            <dd className="font-medium">{user.email}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">{t('userId')}</dt>
            <dd className="font-medium">{user.id}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">{t('preferredLearnLang')}</dt>
            <dd className="font-medium">{user.preferred_learn_lang ?? '—'}</dd>
          </div>
        </dl>
      </div>

      <a href="/" className="text-sm font-medium text-amber-700 underline dark:text-amber-300">
        {t('homeLink')}
      </a>
    </section>
  );
}
