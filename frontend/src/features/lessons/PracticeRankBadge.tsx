import { courseRankIcon, courseRankLabel } from '@/features/course/course-level-progress';
import type { PracticeVariantRank } from './practiceSkills';
import styles from './lesson-page.module.css';

export function practiceRankDescription(summary: PracticeVariantRank | undefined, uk: boolean) {
  if (!summary) return uk ? 'Результат ще не завантажено' : 'Результат ещё не загружен';
  const rank = summary.rank ? `${courseRankLabel(summary.rank, uk)}. ` : '';
  const score = summary.score === null ? '' : `${uk ? 'Середній бал' : 'Средний балл'}: ${summary.score}%. `;
  const ungraded = summary.ungraded_total ? ` ${uk ? 'Без оцінки' : 'Без оценки'}: ${summary.ungraded_total}.` : '';
  const skills = summary.skills_total != null ? ` ${uk ? 'Навички' : 'Навыки'}: ${summary.skills_passed ?? 0}/${summary.skills_total}.` : '';
  const pending = summary.completed ? '' : (uk ? ' Залік ще не отримано.' : ' Зачёт ещё не получен.');
  return `${rank}${score}${uk ? 'Зараховано' : 'Зачтено'}: ${summary.passed}/${summary.total}.${skills}${ungraded}${pending} ${uk ? 'Бали за залікові спроби.' : 'Баллы за зачётные попытки.'}`;
}

export function PracticeRankBadge({ summary, uk }: { summary?: PracticeVariantRank; uk: boolean }) {
  const completed = summary?.completed === true;
  const ungraded = summary != null && summary.total === 0 && summary.ungraded_total > 0;
  const state = summary?.rank ?? (completed ? 'passed' : 'pending');
  const label = summary?.rank ? courseRankLabel(summary.rank, uk)
    : completed ? (uk ? 'Зараховано' : 'Зачтено')
      : ungraded ? (uk ? 'Без оцінки' : 'Без оценки')
        : summary && (summary.passed > 0 || summary.score !== null) ? (uk ? 'У процесі' : 'В процессе')
          : summary ? (uk ? 'Не розпочато' : 'Не начат') : (uk ? 'Немає даних' : 'Нет данных');
  const value = summary?.rank && summary.score != null ? `${summary.score}%`
    : summary?.skills_total != null ? `${summary.skills_passed ?? 0}/${summary.skills_total}`
      : summary && summary.total > 0 ? `${summary.passed}/${summary.total}` : ungraded ? 'б/о' : '...';
  const icon = summary?.rank ? courseRankIcon(summary.rank) : completed ? 'pi-check-circle' : 'pi-circle';
  return <span className={styles.practiceRank} data-rank={state} title={practiceRankDescription(summary, uk)}>
    <i className={`pi ${icon}`} aria-hidden="true" />
    <span className={styles.practiceRankLabel}>{label}</span>
    <span className={styles.practiceRankValue}>{value}</span>
  </span>;
}
