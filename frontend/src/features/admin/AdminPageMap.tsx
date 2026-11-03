'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { adminPages, backendHref } from '@/lib/admin-navigation';
import styles from './admin-page-map.module.css';

const featuredPaths = new Set(['/tutor/context-studio', '/avatar-lab', '/cat-lab', '/table-bot-lab']);

export function AdminPageMap() {
  const uk = useLocale() === 'uk';
  const backendOrigin = useSyncExternalStore(() => () => {}, () => backendHref(''), () => '');
  const featured = adminPages.filter(page => featuredPaths.has(page.href));
  const grouped = adminPages.filter(page => !featuredPaths.has(page.href));
  return <div className={styles.map}>
    <h1>{uk ? 'Карта сторінок адміністратора' : 'Карта страниц администратора'}</h1>
    <section className={styles.featured}>
      <h2>{uk ? 'Схеми та персонажі ШІ' : 'Схемы и персонажи ИИ'}</h2>
      <ul>{featured.map(page => <li key={page.href}><Link href={page.href} prefetch={false}>{page.title}<i className="pi pi-angle-right" aria-hidden /></Link></li>)}</ul>
    </section>
    {[...new Set(grouped.map(page => page.group))].map(group => <details key={group} className={styles.group}>
      <summary><h2>{group}</h2><span className={styles.count}>{grouped.filter(page => page.group === group).length}</span><i className={`pi pi-chevron-down ${styles.chevron}`} aria-hidden="true" /></summary>
      <ul>{grouped.filter(page => page.group === group).map(page => <li key={page.href}>
        {'backend' in page ? <a href={`${backendOrigin}${page.href}`}>{page.title}<i className="pi pi-arrow-up-right" aria-hidden /></a>
          : <Link href={page.href} prefetch={false}>{page.title}<i className="pi pi-angle-right" aria-hidden /></Link>}
      </li>)}</ul>
    </details>)}
  </div>;
}
