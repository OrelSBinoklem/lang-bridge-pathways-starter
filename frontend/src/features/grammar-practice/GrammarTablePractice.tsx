'use client';

import { useEffect, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import { GrammarPracticeOverlay } from '@/features/grammar/GrammarPracticeOverlay';
import type { TopicListItem } from './GrammarTopics';
import type { InlineGrammarTarget } from './InlineGrammarLesson';
import styles from './inline-grammar.module.css';

const InlineGrammarLesson = dynamic(() => import('./InlineGrammarLesson'), { loading: () => <p role="status">Загрузка задания…</p> });

export function GrammarTablePractice({ children, tableKey, topics, learnLang = 'lv', anonymous, loading, error, onRetry, onLayout, fillHeight = false }: {
  children: ReactNode; tableKey?: string; topics: TopicListItem[]; learnLang?: string; anonymous?: boolean;
  loading?: boolean; error?: boolean; onRetry?: () => void; onLayout?: () => void;
  fillHeight?: boolean;
}) {
  const [target, setTarget] = useState<InlineGrammarTarget | null>(null);
  const [open, setOpen] = useState(false);
  const first = topics.flatMap(topic => topic.blocks.filter(block => !block.source_block_id && (!tableKey || (block.grammar_table_keys ?? topic.table_keys).includes(tableKey)))
    .map(block => ({ slug: topic.slug, blockId: block.id, title: block.title ?? topic.title })))[0];
  useEffect(() => { onLayout?.(); }, [open, onLayout]);
  useEffect(() => {
    const reveal = (event: Event) => { if ((event as CustomEvent<{ tableKey?: string }>).detail?.tableKey === tableKey) flushSync(() => setOpen(false)); };
    window.addEventListener('grammar.table.reveal', reveal);
    return () => window.removeEventListener('grammar.table.reveal', reveal);
  }, [tableKey]);
  const openTask = (value: InlineGrammarTarget) => { setTarget(value); setOpen(true); };
  return <div className={styles.card} data-fill-height={fillHeight || undefined} data-inline-grammar-table={tableKey} onClick={event => { if (open || (event.target as HTMLElement).closest('button,a,input,select,summary,details')) event.stopPropagation(); }}>
    <div hidden={open} className={styles.tableView}>{children}</div>
    {target && <section hidden={!open} className={styles.panel} onClick={event => event.stopPropagation()} aria-label={`Задание: ${target.title}`}>
      <div className={styles.header}><strong>{target.title}</strong><button type="button" onClick={() => setOpen(false)}><i className="pi pi-table" aria-hidden /> К таблице</button></div>
      <InlineGrammarLesson key={`${target.slug}:${target.blockId}`} target={target} active={open} />
    </section>}
    {!open && <>
      {first ? <button type="button" data-grammar-tour="exercises" className={styles.open} onClick={() => openTask(first)}><i className="pi pi-pencil" aria-hidden /> Упражнения</button>
        : anonymous ? <p className={styles.status}><Link href="/login">Войти для упражнений</Link></p>
          : error ? <p role="alert" className={styles.status}>Не удалось загрузить задания. <button type="button" onClick={onRetry}>Повторить</button></p>
            : loading ? <p role="status" className={styles.status}>Загрузка заданий…</p> : null}
      <GrammarPracticeOverlay topics={topics} tableKey={tableKey} learnLang={learnLang} onOpen={openTask} />
    </>}
  </div>;
}
