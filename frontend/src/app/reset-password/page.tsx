'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { FormEvent, Suspense, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';

function ResetForm() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState(search.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const token = search.get('token') ?? '';

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await apiFetch('/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token,
          email,
          password,
          password_confirmation: passwordConfirmation,
        }),
      });
      router.push('/login');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('resetFailed'));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mx-auto grid max-w-md gap-4">
      <h1 className="text-3xl font-semibold tracking-tight">{t('resetTitle')}</h1>
      {!token && <Message severity="warn" text={t('missingToken')} />}
      <form onSubmit={onSubmit} className="grid gap-3">
        <label className="grid gap-2 text-sm">
          {t('email')}
          <InputText
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            className="w-full"
          />
        </label>
        <label className="grid gap-2 text-sm">
          {t('newPassword')}
          <InputText
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            minLength={8}
            className="w-full"
          />
        </label>
        <label className="grid gap-2 text-sm">
          {t('confirmPassword')}
          <InputText
            value={passwordConfirmation}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
            type="password"
            required
            minLength={8}
            className="w-full"
          />
        </label>
        <Button type="submit" label={t('updatePassword')} loading={pending} disabled={!token} />
      </form>
      {error && <Message severity="error" text={error} />}
      <Link href="/login" className="text-sm text-amber-700 underline dark:text-amber-300">
        {t('backToLogin')}
      </Link>
    </section>
  );
}

export default function ResetPasswordPage() {
  const tCommon = useTranslations('Common');
  return (
    <Suspense fallback={<div className="p-8">{tCommon('loading')}</div>}>
      <ResetForm />
    </Suspense>
  );
}
