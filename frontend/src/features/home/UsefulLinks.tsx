'use client';

import { useTranslations } from 'next-intl';
import type { UsefulLinkDef } from './useful-links';
import styles from './useful-links.module.css';

export function UsefulLinks({ links }: { links: UsefulLinkDef[] }) {
  const t = useTranslations('Home');
  if (!links.length) return null;

  return <section className={styles.section} aria-labelledby="home-useful-links-title" data-home-useful-links="">
    <header className={styles.heading}>
      <i className={`pi pi-bookmark ${styles.headingIcon}`} aria-hidden="true" />
      <h2 id="home-useful-links-title">{t('usefulLinks')}</h2>
      <span className={styles.headingLine} aria-hidden="true" />
    </header>
    <ul className={styles.list}>{links.map(link => <li key={link.href + link.labelKey}>
      <a href={link.href} className={styles.link}
        data-featured={link.highlighted || undefined}
        target={link.external ? '_blank' : undefined}
        rel={link.external ? 'noreferrer' : undefined}
        download={link.download || undefined}>
        <i className={`pi ${link.download ? 'pi-download' : link.highlighted ? 'pi-star-fill' : 'pi-arrow-up-right'} ${styles.icon}`} aria-hidden="true" />
        <span>{t(link.labelKey)}</span>
      </a>
    </li>)}</ul>
  </section>;
}
