'use client';

import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { Button } from 'primereact/button';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const t = useTranslations('Shell');
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return null;
  }

  const dark = theme === 'dark';

  return (
    <Button
      type="button"
      rounded
      text
      icon={dark ? 'pi pi-sun' : 'pi pi-moon'}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={t('toggleTheme')}
    />
  );
}
