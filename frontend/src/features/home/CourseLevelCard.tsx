'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { getCourseLevelProgress, type CourseLevelSummary } from '@/features/course/course-level-progress';
import { MasteryMark } from '@/features/category-previews/MasteryMark';
import type { LearnLang } from '@/lib/learn-lang';
import { homeCourseLevelHref } from './home-destinations';
import styles from './course-level-cards.module.css';

const Illustration = dynamic(() => import('@/features/home-previews/GlassHoverIllustration'));
const TITLES = {
  ru: ['Первые разговоры', 'Повседневная жизнь', 'Уверенное общение', 'Свобода выражения'],
  uk: ['Перші розмови', 'Повсякденне життя', 'Впевнене спілкування', 'Свобода висловлювання'],
};

export function CourseLevelCard({ id, index, level, uk, language = 'lv' }: { id: string; index: number; level?: CourseLevelSummary; uk: boolean; language?: LearnLang }) {
      const known = !!level && level.total > 0;
      const { percent, rank } = getCourseLevelProgress(level);
      return <Link href={homeCourseLevelHref(language, id)} className={styles.card} data-level={id} data-rank={rank ?? undefined} data-current={level?.status === 'active' || undefined}>
        {rank && known && <span className={styles.rank}><MasteryMark percent={percent} uk={uk} prominent /></span>}
        <span className={styles.top}><strong>{id}</strong><span>{known ? `${percent}%` : '—'}</span></span>
        <h3>{TITLES[uk ? 'uk' : 'ru'][index]}</h3>
        <span className={styles.art} aria-hidden="true"><span className={styles.frame} /><span className={styles.plinth} /><Illustration index={index} className={styles.figure} /></span>
        {known ? <progress className={styles.progress} value={percent} max={100} aria-label={`${uk ? 'Прогрес рівня' : 'Прогресс уровня'} ${id}: ${percent}%`} /> : <span className={styles.progress} aria-hidden="true" />}
        <span className={styles.bottom}><span>{level ? `${level.completed} / ${level.total} ${uk ? 'категорій' : 'категорий'}` : (uk ? 'Немає даних' : 'Нет данных')}</span><i className={`pi ${level?.status === 'locked' ? 'pi-lock' : level?.status === 'completed' ? 'pi-check' : 'pi-arrow-up-right'}`} aria-hidden="true" /></span>
      </Link>;
}
