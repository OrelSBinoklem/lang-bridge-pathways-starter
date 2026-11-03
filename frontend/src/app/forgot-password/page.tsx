'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { FormEvent, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';

export default function ForgotPasswordPage() {
  const t = useTranslations('Auth');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await apiFetch<{ message: string }>('/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setMessage(res.message ?? t('resetSent'));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('requestFailed'));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mx-auto grid max-w-md gap-4">
      <h1 className="text-3xl font-semibold tracking-tight">{t('forgotTitle')}</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('forgotHint')}</p>
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
        <Button type="submit" label={t('sendResetLink')} loading={pending} />
      </form>
      {message && <Message severity="success" text={message} />}
      {error && <Message severity="error" text={error} />}
      <Link href="/login" className="text-sm text-amber-700 underline dark:text-amber-300">
        {t('backToLogin')}
      </Link>
    </section>
  );
}
