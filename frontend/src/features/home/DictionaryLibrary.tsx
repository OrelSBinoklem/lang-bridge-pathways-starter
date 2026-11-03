'use client';

import { useTranslations } from 'next-intl';
import type { LearnLang } from '@/lib/learn-lang';
import type { HomeDictionary } from './home-types';
import { DictionaryBook } from './DictionaryBook';
import styles from './home-learning-hub.module.css';

export function DictionaryLibrary({ dictionaries, loading, language, uk }: { dictionaries: HomeDictionary[]; loading: boolean; language: LearnLang; uk: boolean }) {
  const t = useTranslations('Home');
  return <section className={styles.library} aria-labelledby="home-dictionaries-heading" data-home-module="dictionaries">
    <header className={styles.heading}><h2 id="home-dictionaries-heading">{uk ? 'Слова для твого світу' : 'Слова для твоего мира'}</h2><i className="pi pi-book" aria-hidden="true" /></header>
    <ul className={styles.books}>{dictionaries.map((dictionary, index) => <li key={dictionary.id}><DictionaryBook dictionary={dictionary} index={index} language={language} uk={uk} /></li>)}</ul>
    {loading && <p className={styles.notice} role="status">{uk ? 'Завантаження словників…' : 'Загрузка словарей…'}</p>}
    {!loading && !dictionaries.length && <p className={styles.notice} role="status">{t('empty')}</p>}
  </section>;
}
