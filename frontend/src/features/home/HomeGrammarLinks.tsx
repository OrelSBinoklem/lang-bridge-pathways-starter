'use client';

import Link from 'next/link';
import type { LearnLang } from '@/lib/learn-lang';
import { homeDestinations } from './home-destinations';
import styles from './home-learning-hub.module.css';

export function HomeGrammarLinks({ language, uk }: { language: LearnLang; uk: boolean }) {
  const links = homeDestinations(language);
  return <section className={styles.practice} aria-labelledby="home-practice-heading" data-home-module="grammar">
    <header className={styles.heading}><h2 id="home-practice-heading">{uk ? 'Граматика' : 'Грамматика'}</h2></header>
    <div className={styles.tools}>
      <Link href={links.grammar} prefetch={false} className={`${styles.tool} ${styles.paper}`}>
        <span className={styles.serial} aria-hidden="true">01</span>
        <span className={styles.toolCopy}><strong>{uk ? 'Граматичні таблиці' : 'Грамматические таблицы'}</strong><small>{uk ? 'Правила, форми та приклади' : 'Правила, формы и примеры'}</small><span className={styles.levels}>A1–B2 <i className="pi pi-arrow-up-right" aria-hidden="true" /></span></span>
        <span className={styles.grammarGlyph} aria-hidden="true">{language === 'en' ? 'a' : 'ā'}<small>{language === 'en' ? '→ an' : '→ a'}</small></span>
        <i className={`pi pi-table ${styles.cornerIcon}`} aria-hidden="true" />
      </Link>
      <Link href={links.practice} prefetch={false} className={`${styles.tool} ${styles.glass}`}>
        <span className={styles.serial} aria-hidden="true">02</span>
        <span className={styles.toolCopy}><strong>{uk ? 'Список граматичних завдань' : 'Список грамматических заданий'}</strong><small>{uk ? 'Обери тему й потренуй правило' : 'Выбери тему и потренируй правило'}</small><span className={styles.levels}>A1–B2 <i className="pi pi-arrow-up-right" aria-hidden="true" /></span></span>
        <span className={styles.exerciseGlyph} aria-hidden="true"><span>___</span><span>✓</span><span>___</span></span>
        <i className={`pi pi-pencil ${styles.cornerIcon}`} aria-hidden="true" />
      </Link>
    </div>
  </section>;
}
