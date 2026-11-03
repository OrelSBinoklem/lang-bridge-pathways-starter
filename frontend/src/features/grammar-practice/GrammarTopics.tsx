'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { clientApi } from '@/lib/client-api';
import type { GrammarSummary } from './GrammarTopicHeader';
import styles from './grammar-practice.module.css';
import { GrammarExtensionBadge } from './GrammarExtensionBadge';
import { resolveGrammarTableLink } from '@/features/grammar/data/grammarTableBindings';

export type TopicListItem = {
    id: number;
    title: string;
    slug: string;
    level: string;
    course_group_id: number | null;
    description: string;
    table_keys: string[];
    has_extensions?: boolean;
    summary: GrammarSummary;
    blocks: {
        id: number;
        source_block_id?: number | null;
        grammar_table_keys?: string[];
        is_extension?: boolean;
        title: string | null;
        is_required: boolean;
        best_score: number | null;
        rank: string | null;
        rank_label: string | null;
    }[];
};
export function useGrammarTopics(enabled = true, learnLang = 'lv') {
    return useQuery({
        enabled,
        queryKey: ['grammar-topics', learnLang],
        queryFn: () => clientApi<{ data: TopicListItem[] }>(`/grammar-topics?learn_lang=${encodeURIComponent(learnLang)}`),
        staleTime: 0,
        gcTime: 0,
    });
}
export function GrammarTopics({ tableKey, learnLang = 'lv' }: { tableKey?: string; learnLang?: string }) {
    const query = useGrammarTopics(true, learnLang);
    const [level, setLevel] = useState('all');
    const topics =
        query.data?.data.filter(
            (topic) =>
                (!tableKey || topic.table_keys.includes(resolveGrammarTableLink(tableKey))) &&
                (level === 'all' || topic.level === level),
        ) ?? [];
    return (
        <section className={styles.catalog}>
            <Link href={learnLang === 'en' ? '/grammar/english' : '/grammar'}>
                <i className="pi pi-arrow-left" /> Грамматические таблицы
            </Link>
            <header className={styles.catalogHeader}>
                <h1>Практика грамматики{learnLang === 'en' ? ' · Английский' : ''}</h1>
                <label>
                    Уровень{' '}
                    <select
                        value={level}
                        onChange={(e) => setLevel(e.target.value)}
                    >
                        <option value="all">Все</option>
                        {['A1', 'A2', 'B1', 'B2'].map((item) => (
                            <option key={item}>{item}</option>
                        ))}
                    </select>
                </label>
            </header>
            {tableKey && <Link href={`/grammar/practice?learn_lang=${learnLang}`}>Все темы</Link>}
            {query.isLoading && <p role="status">Загрузка…</p>}
            {query.isError && (
                <p role="alert">
                    Не удалось загрузить темы.{' '}
                    <button onClick={() => query.refetch()}>Повторить</button>
                </p>
            )}
            <div className={styles.topicList}>
                {topics.map((topic) => (
                    <article key={topic.id} className={styles.topicRow}>
                        <div>
                            <span className={styles.level}>{topic.level}</span>
                            {topic.has_extensions && <GrammarExtensionBadge />}
                            <h2>
                                <Link href={`/lessons/${topic.slug}`}>
                                    {topic.title}
                                </Link>
                            </h2>
                            <p>{topic.description}</p>
                        </div>
                        <div className={styles.topicProgress}>
                            <strong>
                                {topic.summary.passed} / {topic.summary.total}
                            </strong>
                            <progress
                                value={topic.summary.score ?? 0}
                                max={100}
                                aria-label={`Прогресс: ${topic.title}`}
                            />
                            <span>
                                {topic.summary.rank_label ?? 'Без ранга'} ·{' '}
                                {topic.summary.score ?? 0}%
                            </span>
                        </div>
                        <Link
                            className={styles.open}
                            href={`/lessons/${topic.slug}`}
                            title="Открыть тему"
                            aria-label={`Открыть: ${topic.title}`}
                        >
                            <i className="pi pi-arrow-right" />
                        </Link>
                    </article>
                ))}
            </div>
            {!query.isLoading && !query.isError && !topics.length && (
                <p>Для этого раздела пока нет опубликованных тем.</p>
            )}
        </section>
    );
}
