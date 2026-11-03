import Link from 'next/link';
import { COURSE_LEVEL_IDS, courseRankIcon, courseRankLabel, getCourseLevelProgress, type CourseLevelSummary } from '@/features/course/course-level-progress';
import { ApiError } from '@/lib/api';
import { CourseLevelCards } from './CourseLevelCards';
import type { LearnLang } from '@/lib/learn-lang';
import { homeDestinations, homeCourseLevelHref } from './home-destinations';
import styles from './home.module.css';

export function HomeCourseOverview({ levels, error, uk, legacy = false, language = 'lv' }: { levels: CourseLevelSummary[]; error: unknown; uk: boolean; legacy?: boolean; language?: LearnLang }) {
  return <section className={styles.courseOverview} data-illustrated={!legacy || undefined} aria-labelledby="home-course-heading" data-home-module="course">
    <div className={styles.courseHeading}>
      <div><h2 id="home-course-heading">{uk ? 'Шлях курсу' : 'Путь курса'}</h2></div>
      <Link href={homeDestinations(language).course} className={styles.courseOpen} aria-label={uk ? 'Відкрити шлях курсу' : 'Открыть путь курса'} title={uk ? 'Відкрити шлях курсу' : 'Открыть путь курса'}><i className="pi pi-arrow-right" aria-hidden="true" /></Link>
    </div>
    {legacy ? <div className={styles.courseGrid}>{COURSE_LEVEL_IDS.map(id => {
      const level = levels.find(item => item.id === id), { percent, rank } = getCourseLevelProgress(level);
      return <Link key={id} href={homeCourseLevelHref(language, id)} className={`${styles.courseCard} ${rank ? styles[rank] : ''}`}>
        <span className={styles.courseCardTop}><strong>{id}</strong>{rank ? <span className={styles.courseRank}><i className={`pi ${courseRankIcon(rank)}`} aria-hidden="true" /><span>{courseRankLabel(rank, uk)}</span></span> : level?.status !== 'completed' && <i className={`pi ${level?.status === 'locked' ? 'pi-lock' : 'pi-arrow-right'}`} aria-hidden="true" />}</span>
        <span className={styles.courseCardMiddle}><strong>{level?.total ? `${percent}%` : '—'}</strong></span><span className={styles.courseBar} aria-hidden="true"><span style={{ width: `${percent}%` }} /></span>
        <small>{level ? `${level.completed} / ${level.total} ${uk ? 'категорій' : 'категорий'}` : '—'}</small>
      </Link>;
    })}</div> : <CourseLevelCards levels={levels} uk={uk} language={language} />}
    {!!error && <p className={styles.courseNotice}>{error instanceof ApiError && error.status === 401 ? <><Link href="/login">{uk ? 'Увійдіть' : 'Войдите'}</Link>{uk ? ', щоб побачити свій прогрес.' : ', чтобы увидеть свой прогресс.'}</> : uk ? 'Не вдалося завантажити прогрес.' : 'Не удалось загрузить прогресс.'}</p>}
  </section>;
}
