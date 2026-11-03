'use client';

import { GrammarTablePractice } from '@/features/grammar-practice/GrammarTablePractice';
import type { TopicListItem } from '@/features/grammar-practice/GrammarTopics';
import { EnglishGrammarTable } from './EnglishGrammarTable';
import type { EnglishTable } from './types';
import { ENGLISH_TABLES } from './catalog';
import styles from './english-tables.module.css';

export function EnglishTablePractice({ table, topics, loading, error, onRetry, anonymous }: {
  table: EnglishTable; topics: TopicListItem[]; loading?: boolean; error?: boolean; onRetry?: () => void; anonymous?: boolean;
}) {
  return <div className={styles.practiceHost} data-grammar-practice-host>
    <GrammarTablePractice topics={topics} tableKey={table.key} learnLang="en" loading={loading} error={error} onRetry={onRetry} anonymous={anonymous}>
    <EnglishGrammarTable table={table} tables={ENGLISH_TABLES} />
    </GrammarTablePractice>
  </div>;
}
