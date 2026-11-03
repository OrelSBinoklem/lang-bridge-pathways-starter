'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { LearnLang } from '@/lib/learn-lang';
import type { HomeLayoutProps } from '../home-types';
import { HomeCourseOverview } from '../HomeCourseOverview';
import { UsefulLinks } from '../UsefulLinks';
import { languageLevelLabel, USEFUL_LINKS } from '../useful-links';
import styles from '../home.module.css';

/** The existing unified preview retains its original list-based composition. */
export function LegacyHomeLayout({ language: learnLang, dictionaries, loading, courseLevels, courseError, uk, onOpenIntro }: HomeLayoutProps & { language: LearnLang }) {
 const t=useTranslations('Home');
 const showLangExtras=learnLang==='lv', showGrammarExtras=true;
 return <>
  {showLangExtras && <HomeCourseOverview levels={courseLevels} error={courseError} uk={uk} legacy />}
      <ul className={styles.dictList}>
        {dictionaries.map((d) => {
          const start = languageLevelLabel(d.level);
          const end = languageLevelLabel(d.max_level);
          return (
            <li key={d.id} className={styles.dictItem}>
              <Link href={`/dictionaries/${d.id}`} prefetch={false} className={styles.dictLink}>
                <span className={styles.level}>
                  {start !== end ? `${start} - ${end}` : start}
                </span>
                <h2 className={styles.dictTitle}>{d.name}</h2>
                <span className={styles.count}>{d.words}</span>
                <span className={styles.sound}>{d.sound ? t('soundYes') : t('soundNo')}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {!loading && dictionaries.length === 0 && (
        <p className={styles.empty}>{t('empty')}</p>
      )}

      {showGrammarExtras && (
        <Link href={learnLang === 'en' ? '/grammar/english' : '/grammar'} prefetch={false} className={styles.grammarLink}>
          <i className={`pi pi-table ${styles.grammarIcon}`} aria-hidden="true" />
          <h2>{uk ? 'Граматичні таблиці' : 'Грамматические таблицы'}</h2>
          <span className={styles.grammarLevels}>A1–B2</span>
          <i className="pi pi-arrow-right" aria-hidden="true" />
        </Link>
      )}

      {showGrammarExtras && (
        <Link href={learnLang === 'en' ? '/grammar/practice?learn_lang=en' : '/grammar/practice'} prefetch={false} className={styles.grammarLink}>
          <i className={`pi pi-pencil ${styles.grammarIcon}`} aria-hidden="true" />
          <h2>{uk ? 'Тренування граматики' : 'Тренировки грамматики'}</h2>
          <span className={styles.grammarLevels}>A1–B2</span>
          <i className="pi pi-arrow-right" aria-hidden="true" />
        </Link>
      )}

      {showGrammarExtras && (
        <div className={styles.buttons}>
          <button
            type="button"
            className={`${styles.modalBtn} ${styles.modalBtnGrammar}`}
            onClick={() => onOpenIntro('grammar')}
          >
            {t('grammarBtn')}
          </button>
          {showLangExtras && <button
            type="button"
            className={`${styles.modalBtn} ${styles.modalBtnConcepts}`}
            onClick={() => onOpenIntro('concepts')}
          >
            {t('conceptsBtn')}
          </button>}
        </div>
      )}

  <UsefulLinks links={USEFUL_LINKS[learnLang] ?? []} />
  {learnLang==='en' && <Link href="/exams?learn_lang=en" prefetch={false} className={styles.grammarLink}><i className="pi pi-graduation-cap" aria-hidden="true" /><h2>{uk ? 'Іспити з англійської' : 'Экзамены по английскому'}</h2><span className={styles.grammarLevels}>A1–B2</span><i className="pi pi-arrow-right" aria-hidden="true" /></Link>}
 </>;
}
