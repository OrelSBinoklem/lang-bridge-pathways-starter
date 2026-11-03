'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { LearnLang } from '@/lib/learn-lang';
import type { HomeDictionary } from './home-types';
import { languageLevelLabel } from './useful-links';
import styles from './home-learning-hub.module.css';

export function DictionaryBook({ dictionary, index, language, uk }: { dictionary: HomeDictionary; index: number; language: LearnLang; uk: boolean }) {
  const t = useTranslations('Home');
  const start = languageLevelLabel(dictionary.level), end = languageLevelLabel(dictionary.max_level);
  return <Link href={`/dictionaries/${dictionary.id}`} prefetch={false} className={styles.book} data-cover={index % 2} data-dictionary-id={dictionary.id}>
    <span className={styles.spine} aria-hidden="true">LANGBRIDGE / {language.toUpperCase()}</span>
    <span className={styles.edition} aria-hidden="true">LEXICON · {String(index + 1).padStart(2, '0')}</span>
    <span className={styles.monogram} aria-hidden="true">Aa<small>{language === 'en' ? 'a e i o u' : 'ā ē ī ū'}</small></span>
    <span className={styles.bookTitle}><strong>{dictionary.name}</strong><small>{start === end ? start : `${start}—${end}`}</small></span>
    <span className={styles.bookBottom}><span>{dictionary.words.toLocaleString(uk ? 'uk-UA' : 'ru-RU')}<small>{uk ? 'слів' : 'слов'}</small></span><i className="pi pi-arrow-up-right" aria-hidden="true" /></span>
    {dictionary.sound && <span className={styles.audio} aria-label={t('soundYes')}><i className="pi pi-volume-up" aria-hidden="true" /></span>}
  </Link>;
}
