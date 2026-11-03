'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { CSSProperties } from 'react';
import type { TopicListItem } from '@/features/grammar-practice/GrammarTopics';
import { clientApi } from '@/lib/client-api';
import styles from './grammar-practice-overlay.module.css';
import { GrammarExtensionBadge } from '@/features/grammar-practice/GrammarExtensionBadge';
import type { InlineGrammarTarget } from '@/features/grammar-practice/InlineGrammarLesson';

export function GrammarPracticeOverlay({ topics, tableKey, learnLang = 'lv', onOpen }: { topics: TopicListItem[]; tableKey?: string; learnLang?: string; onOpen?: (target: InlineGrammarTarget) => void }) {
  const course = useQuery({ enabled: topics.length > 0, queryKey: ['grammar-course-locks', learnLang], queryFn: () => clientApi<{ data: { steps: { group_id: number | null; status: string }[] }[] }>(`/course?learn_lang=${encodeURIComponent(learnLang)}`), staleTime: 30_000 });
  const groupLocked = new Map<number, boolean>();
  for (const level of course.data?.data ?? []) for (const step of level.steps) {
    if (step.group_id != null && !groupLocked.has(step.group_id)) groupLocked.set(step.group_id, step.status === 'locked');
  }
  const blocks = topics.flatMap(topic => (topic.blocks ?? []).filter(block => !block.source_block_id
    && (!tableKey || (block.grammar_table_keys ?? topic.table_keys).includes(tableKey))).map(block => ({ ...block, topic })));
  if (!blocks.length) return null;
  const passed = blocks.filter(block => (block.best_score ?? 0) >= 60).length;

  return (
    <nav className={styles.overlay} data-grammar-tour="progress" aria-label={`Грамматика: зачтено ${passed} из ${blocks.length} подзаданий`} onClick={event => event.stopPropagation()}>
      <div className={styles.circles}>
        {blocks.map((block, index) => {
          const score = Math.max(0, Math.min(100, block.best_score ?? 0));
          const locked = block.topic.course_group_id != null && (course.isPending || groupLocked.get(block.topic.course_group_id) === true);
          const label = `${index + 1}. ${block.topic.title}: ${block.title ?? 'Подзадание'} — ${locked ? 'Закрыто до открытия группы' : block.best_score === null ? 'Не начато' : `${score}%, ${block.rank_label ?? 'изучается'}`}${block.is_required ? '' : ', необязательное'}`;
          const content = <><span className={styles.ring} aria-hidden="true" /><span className={styles.medal} aria-hidden="true">{locked ? <i className="pi pi-lock" /> : index + 1}</span></>;
          const className = styles.circle;
          const state = locked ? 'locked' : block.rank ?? (score > 0 ? 'learning' : 'new');
          const style = { '--progress': locked ? '100%' : `${score}%` } as CSSProperties;
          return <Link key={block.id} href={`/lessons/${block.topic.slug}#lesson-block-${block.id}`} prefetch={false}
            onClick={event => { if (onOpen && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onOpen({ slug: block.topic.slug, blockId: block.id, title: block.title ?? block.topic.title }); } }}
            className={className} data-rank={block.rank ?? 'none'} data-state={state} data-score={score}
            style={style} title={`${label}${block.is_extension ? ' · extends' : ''}`} aria-label={`${label}${block.is_extension ? ' · extends' : ''}`}>
            {content}{block.is_extension && <GrammarExtensionBadge compact />}
          </Link>;
        })}
      </div>
    </nav>
  );
}
