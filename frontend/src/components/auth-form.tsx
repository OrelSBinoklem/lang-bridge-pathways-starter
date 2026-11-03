'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { GoogleIcon } from '@/components/google-icon';
import { Button } from 'primereact/button';
import { Divider } from 'primereact/divider';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { FormEvent, useMemo, useState } from 'react';
import styles from '@/components/auth-form.module.css';

type Mode = 'login' | 'register';

const laravelOrigin =
  process.env.NEXT_PUBLIC_LARAVEL_URL ??
  (process.env.NEXT_PUBLIC_LARAVEL_API_URL
    ? process.env.NEXT_PUBLIC_LARAVEL_API_URL.replace(/\/api\/?$/, '')
    : 'http://127.0.0.1:8000');

const fieldClass = `${styles.input} w-full !box-border !block !px-4 !py-3.5 !pr-12 !text-base !leading-normal !rounded-lg`;

function PasswordField({
  label,
  name,
  value,
  onValueChange,
}: {
  label: string;
  name: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="grid w-full gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
      <span>{label}</span>
      <IconField iconPosition="right" className={`${styles.iconField} w-full`}>
        <InputIcon
          className={`pi ${visible ? 'pi-eye-slash' : 'pi-eye'} cursor-pointer`}
          onClick={() => setVisible((v) => !v)}
        />
        <InputText
          name={name}
          type={visible ? 'text' : 'password'}
          required
          minLength={8}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          className={fieldClass}
          autoComplete={name === 'password' ? 'new-password' : 'new-password'}
        />
      </IconField>
    </label>
  );
}

export function AuthForm({ mode }: { mode: Mode }) {
  const t = useTranslations('Auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');

  const oauthError = useMemo(() => {
    const code = searchParams.get('error');
    if (code === 'google_failed') {
      return t('googleFailed');
    }
    if (code === 'missing_token') {
      return t('googleMissingToken');
    }
    return null;
  }, [searchParams, t]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);

    if (mode === 'register' && password !== passwordConfirmation) {
      setError(t('passwordsMismatch'));
      setPending(false);
      return;
    }

    const payload =
      mode === 'login'
        ? {
            email: String(form.get('email') ?? ''),
            password,
          }
        : {
            name: String(form.get('name') ?? ''),
            email: String(form.get('email') ?? ''),
            password,
            password_confirmation: passwordConfirmation,
          };

    const response = await fetch(`/api/auth/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const firstFieldError =
        body.errors && typeof body.errors === 'object'
          ? String(Object.values(body.errors).flat()[0] ?? '')
          : '';
      setError(firstFieldError || body.message || t('somethingWrong'));
      setPending(false);
      return;
    }

    router.push(mode === 'login' ? '/dashboard' : '/demo');
    router.refresh();
  }

  return (
    <div
      className={`${styles.root} mx-auto w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900`}
    >
      <div className="flex flex-col gap-5">
        <Button
          type="button"
          outlined
          className={`${styles.btn} ${styles.googleBtn} w-full justify-center gap-3`}
          onClick={() => {
            window.location.href = `${laravelOrigin}/auth/google`;
          }}
        >
          <GoogleIcon className={styles.googleIcon} />
          <span>{t('continueGoogle')}</span>
        </Button>

        <Divider align="center" className="!my-0">
          <span className="text-xs uppercase tracking-wide text-zinc-500">{t('or')}</span>
        </Divider>

        <form onSubmit={onSubmit} className="flex w-full flex-col gap-5">
          {mode === 'register' && (
            <label className="grid w-full gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
              <span>{t('name')}</span>
              <InputText name="name" required className={fieldClass} />
            </label>
          )}

          <label className="grid w-full gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            <span>{mode === 'login' ? t('emailOrLogin') : t('email')}</span>
            <InputText
              name="email"
              type={mode === 'login' ? 'text' : 'email'}
              autoComplete="username"
              required
              className={fieldClass}
            />
          </label>

          <PasswordField
            label={t('password')}
            name="password"
            value={password}
            onValueChange={setPassword}
          />

          {mode === 'register' && (
            <PasswordField
              label={t('confirmPassword')}
              name="password_confirmation"
              value={passwordConfirmation}
              onValueChange={setPasswordConfirmation}
            />
          )}

          {(error || oauthError) && (
            <Message className="w-full" severity="error" text={error ?? oauthError ?? ''} />
          )}

          <Button
            type="submit"
            loading={pending}
            label={mode === 'login' ? t('submitLogin') : t('submitRegister')}
            className={`${styles.btn} w-full justify-center`}
          />

          <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
            {mode === 'login' ? (
              <>
                {t('noAccount')}{' '}
                <Link href="/register" className="font-medium underline">
                  {t('toRegister')}
                </Link>
                {' · '}
                <Link href="/forgot-password" className="font-medium underline">
                  {t('forgotPassword')}
                </Link>
              </>
            ) : (
              <>
                {t('hasAccount')}{' '}
                <Link href="/login" className="font-medium underline">
                  {t('toLogin')}
                </Link>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
