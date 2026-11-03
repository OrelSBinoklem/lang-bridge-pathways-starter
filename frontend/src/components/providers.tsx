'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { PrimeReactProvider } from 'primereact/api';
import { ReactNode, useEffect, useState } from 'react';

import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';

const THEME_LIGHT = '/primereact-themes/lara-light-amber/theme.css';
const THEME_DARK = '/primereact-themes/lara-dark-amber/theme.css';

/** Одна тема PrimeReact — без статичного light.css, который ломал dark. */
function PrimeThemeSync({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      const dark = root.classList.contains('dark');
      let link = document.getElementById('primereact-theme') as HTMLLinkElement | null;

      if (!link) {
        link = document.createElement('link');
        link.id = 'primereact-theme';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }

      const next = dark ? THEME_DARK : THEME_LIGHT;
      if (link.getAttribute('href') !== next) {
        link.setAttribute('href', next);
      }
    };

    apply();

    const observer = new MutationObserver(apply);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <PrimeReactProvider>
          <PrimeThemeSync>{children}</PrimeThemeSync>
        </PrimeReactProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
