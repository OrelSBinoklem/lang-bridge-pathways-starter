'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { courseRankIcon, courseRankLabel, type CourseRank } from '@/features/course/course-level-progress';
import styles from './grammar-practice.module.css';

const GrammarReferences = dynamic(() => import('./GrammarReferences'));
export type GrammarTopicData = {
    rule: string;
    examples: { text: string; translation: string }[];
    table_keys: string[];
};
export type GrammarSummary = {
    total: number;
    passed: number;
    score: number | null;
    rank_label: string | null;
};

export function GrammarTopicHeader({
    topic,
    summary,
    practice,
    busy,
    onPractice,
    courseHref,
}: {
    topic: GrammarTopicData | null;
    summary: GrammarSummary;
    practice: boolean;
    busy?: boolean;
    onPractice: (value: boolean) => void;
    courseHref: string;
}) {
    const uk = useLocale() === 'uk';
    const score = Math.max(0, Math.min(100, Math.round(summary.score ?? 0)));
    const rank: CourseRank | null = summary.rank_label
        ? score === 100 ? 'diamond' : score >= 90 ? 'gold' : score >= 80 ? 'silver' : 'bronze'
        : null;
    return (
        <div className={styles.topicHeader}>
            <div className={styles.topicToolbar}>
            <Link href={courseHref} prefetch={false} className={styles.courseBack}>
                <i className="pi pi-arrow-left" aria-hidden="true" /> {uk ? 'До шляху курсу' : 'К пути курса'}
            </Link>
            <div className={styles.summary} data-rank={rank ?? 'learning'}>
                <strong className={styles.summaryCount} title={uk ? 'Зараховані підзавдання' : 'Зачтённые подзадания'} aria-label={`${uk ? 'Зараховано' : 'Зачтено'} ${summary.passed} / ${summary.total}`}>
                    <i className="pi pi-check-circle" aria-hidden="true" /> {summary.passed} / {summary.total}
                </strong>
                <progress
                    max={100}
                    value={score}
                    aria-label={uk ? 'Прогрес теми' : 'Прогресс темы'}
                />
                <strong className={styles.summaryPercent}>{score}%</strong>
                {rank && <span className={styles.summaryRank} title={courseRankLabel(rank, uk)} aria-label={courseRankLabel(rank, uk)}>
                    <i className={`pi ${courseRankIcon(rank)}`} aria-hidden="true" />
                    <span className={styles.summaryRankText}>{courseRankLabel(rank, uk)}</span>
                </span>}
            </div>
            </div>
            <div
                className={styles.modes}
                role="group"
                aria-label="Режим грамматики"
            >
                <button
                    type="button"
                    disabled={busy}
                    aria-pressed={!practice}
                    onClick={() => onPractice(false)}
                >
                    Зачёт
                </button>
                <button
                    type="button"
                    disabled={busy}
                    aria-pressed={practice}
                    onClick={() => onPractice(true)}
                >
                    Тренировка с правилом
                </button>
            </div>
            {practice && topic && (
                <div className={styles.rule}>
                    <h2>Правило</h2>
                    <p>{topic.rule}</p>
                    {topic.examples?.map((example, i) => (
                        <p key={i}>
                            <strong>{example.text}</strong> —{' '}
                            {example.translation}
                        </p>
                    ))}
                    {Boolean(topic.table_keys?.length) && (
                        <GrammarReferences tableKeys={topic.table_keys} />
                    )}
                </div>
            )}
        </div>
    );
}
