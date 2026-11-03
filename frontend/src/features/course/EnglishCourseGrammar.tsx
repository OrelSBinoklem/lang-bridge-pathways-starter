'use client';

import { ENGLISH_TABLES } from '../english-grammar/catalog';
import { EnglishTablePractice } from '../english-grammar/EnglishTablePractice';
import { useGrammarTopics } from '../grammar-practice/GrammarTopics';
import styles from '../english-grammar/english-tables.module.css';

export default function EnglishCourseGrammar({ tableId }: { tableId: string }) {
  const table = ENGLISH_TABLES.find(table => table.id === tableId);
  const practice = useGrammarTopics(true, 'en');
  return table ? <div className={`${styles.page} ${styles.courseEmbed}`}><EnglishTablePractice table={table} topics={practice.data?.data ?? []} loading={practice.isPending} error={practice.isError} onRetry={() => void practice.refetch()} /></div> : <p>Таблица недоступна.</p>;
}
