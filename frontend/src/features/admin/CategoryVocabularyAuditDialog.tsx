'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Dialog } from 'primereact/dialog';
import { useState } from 'react';
import { clientApi } from '@/lib/client-api';
import styles from './category-vocabulary-audit.module.css';
import { CategoryLearningBalance, type LearningBalanceReport } from './CategoryLearningBalance';

type Status = 'current' | 'previous' | 'future' | 'elsewhere' | 'unplaced' | 'missing' | 'ambiguous' | 'unsupported';
type Topic = { id: string; level: string; topic: string; position: number };
type Match = { lemma: string; level: string; topic: string; relative: Status; part_of_speech: string; frequency: number };
type AuditWord = {
  id: number; word: string; is_phrase: boolean; status: Status;
  lemmas: string[]; method: string; review_required: boolean; matches: Match[];
};
type Report = {
  category: { id: number; name: string; dictionary_id: number }; context: Topic | null; automatic_topic: string | null;
  topics: Topic[]; total: number; words: AuditWord[];
  summary: Record<Status, { count: number; percent: number }>;
  sources: Record<string, { path: string; sha256: string }>;
  elaipa_contract?: { topic_basis: string; all_topic_occurrences_available: boolean };
  learning_balance?: LearningBalanceReport;
};

const statuses: Status[] = ['current', 'previous', 'future', 'elsewhere', 'unplaced', 'missing', 'ambiguous', 'unsupported'];

export function CategoryVocabularyAuditDialog({ categoryId, open, onClose }: {
  categoryId: number; open: boolean; onClose: () => void;
}) {
  const t = useTranslations('CategoryAudit');
  const ukrainian = useLocale() === 'uk';
  const [topic, setTopic] = useState('');
  const [descendants, setDescendants] = useState(true);
  const [mode, setMode] = useState('corpus');
  const [filter, setFilter] = useState<Status | 'all'>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const query = useQuery({
    queryKey: ['category-vocabulary-audit', categoryId, topic, descendants, mode],
    enabled: open,
    staleTime: 0,
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ descendants: descendants ? '1' : '0', mode });
      if (topic) params.set('topic', topic);
      return clientApi<{ data: Report }>(`/admin/categories/${categoryId}/vocabulary-audit?${params}`, { signal });
    },
  });
  const report = query.data?.data;
  const needle = search.trim().toLocaleLowerCase();
  const visible = report?.words.filter((word) => (filter === 'all' || word.status === filter)
    && `${word.word} ${word.lemmas.join(' ')}`.toLocaleLowerCase().includes(needle)) ?? [];

  return (
    <Dialog header={t('title')} visible={open} onHide={onClose} modal draggable={false}
      className={styles.dialog} style={{ width: 'min(1160px, 96vw)' }} blockScroll>
      <div className={styles.body} aria-busy={query.isFetching}>
        <div className={styles.controls}>
          <label>{t('topic')}
            <select value={topic} disabled={query.isFetching} onChange={(e) => { setTopic(e.target.value); setExpanded(null); }}>
              <option value="">{t('automatic')}{report?.automatic_topic ? `: ${report.automatic_topic}` : ''}</option>
              {report?.topics.map((item) => <option key={item.id} value={item.id}>{item.level} · {item.topic}</option>)}
            </select>
          </label>
          <label className={styles.checkbox}>
            <input type="checkbox" checked={descendants} disabled={query.isFetching} onChange={(e) => setDescendants(e.target.checked)} />
            {t('descendants')}
          </label>
        </div>
        {query.isFetching && <p role="status">{t('loading')}</p>}
        {query.isError && <div role="alert" className={styles.error}>
          <p>{query.error.message}</p>
          <button type="button" onClick={() => query.refetch()}><i className="pi pi-refresh" aria-hidden="true" /> {t('retry')}</button>
        </div>}
        {report && !query.isPlaceholderData && !query.isError && <>
          <p className={styles.context}>{report.context ? `${report.context.level} · ${report.context.topic}` : t('unmapped')}</p>
          {report.learning_balance && <CategoryLearningBalance key={`${report.category.id}:${report.context?.id ?? 'none'}:${mode}:${descendants}`}
            report={report.learning_balance} dictionaryId={report.category.dictionary_id} categoryId={categoryId}
            topicId={report.context?.id ?? null} descendants={descendants} />}
          <details className={styles.existingAudit} open={!report.learning_balance}>
          <summary>{ukrainian ? 'Наші записи: перше появлення в JSON' : 'Наши записи: первое появление в JSON'}</summary>
          <label className={styles.matchingControl}>{t('matching')}
            <select value={mode} disabled={query.isFetching} onChange={(e) => setMode(e.target.value)}>
              <option value="exact">{t('exact')}</option>
              <option value="corpus">{t('corpus')}</option>
              <option value="heuristic">{t('heuristic')}</option>
            </select>
          </label>
          {report.elaipa_contract?.topic_basis === 'first_seen' && <p role="note">{t('sourceWarning')}</p>}
          <div className={styles.summary} aria-label={t('summary')}>
            <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
              <strong>{report.total}</strong><span>{t('all')}</span>
            </button>
            {statuses.filter((status) => report.summary[status].count > 0).map((status) => (
              <button type="button" key={status} data-status={status} aria-pressed={filter === status} onClick={() => setFilter(status)}>
                <strong>{report.summary[status].count} <small>({report.summary[status].percent}%)</small></strong>
                <span>{t(`status.${status}`)}</span>
              </button>
            ))}
          </div>
          <label className={styles.search}><i className="pi pi-search" aria-hidden="true" />
            <input type="search" aria-label={t('search')} placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead><tr><th scope="col">{t('word')}</th><th scope="col">{t('relation')}</th><th scope="col">{t('occurrences')}</th></tr></thead>
              <tbody>{visible.map((word) => (
                <WordRow key={word.id} word={word} expanded={expanded === word.id} onToggle={() => setExpanded(expanded === word.id ? null : word.id)} />
              ))}</tbody>
            </table>
          </div>
          {visible.length === 0 && <p>{t('empty')}</p>}
          <details className={styles.sources}>
            <summary>{t('sources')}</summary>
            <p>{t('methodology')}</p>
            {Object.entries(report.sources).map(([key, value]) => <p key={key}><code>{value.path}</code><br /><small>SHA256: {value.sha256}</small></p>)}
          </details>
          </details>
        </>}
      </div>
    </Dialog>
  );
}

function WordRow({ word, expanded, onToggle }: { word: AuditWord; expanded: boolean; onToggle: () => void }) {
  const t = useTranslations('CategoryAudit');
  const primary = word.matches.find((match) => match.relative === 'current') ?? word.matches[0];
  const topics = new Set(word.matches.map((match) => `${match.level}:${match.topic}`));
  return <>
    <tr>
      <th scope="row"><button type="button" className={styles.word} onClick={onToggle} aria-expanded={expanded} aria-controls={`category-audit-word-${word.id}`}>
        <i className={`pi ${expanded ? 'pi-chevron-down' : 'pi-chevron-right'}`} aria-hidden="true" />{word.word}
      </button></th>
      <td><span className={styles.status} data-status={word.status}>{t(`status.${word.status}`)}</span>
        {word.review_required && <i className={`pi pi-info-circle ${styles.review}`} role="img" title={t('review')} aria-label={t('review')} />}
      </td>
      <td>{primary ? <>{primary.level} · {primary.topic}{topics.size > 1 && <small className={styles.more}> +{topics.size - 1}</small>}</> : t('noTopics')}</td>
    </tr>
    <tr id={`category-audit-word-${word.id}`} hidden={!expanded} className={styles.details}><td colSpan={3}>
      <div className={styles.wordDetails}>
        <p><strong>{t('lemma')}: </strong>{word.lemmas.join(', ') || t('notFound')} · {t(`method.${word.method}`)}</p>
        {word.is_phrase && <p>{t('phrase')}</p>}
        {word.review_required && <p>{t('review')}</p>}
        {word.matches.length > 0 && <ul>{word.matches.map((match, i) => (
          <li key={`${match.lemma}:${match.level}:${match.topic}:${i}`}>
            <strong>{match.lemma}</strong> · {match.level} · {match.topic} · {match.part_of_speech} · {t('frequency', { count: match.frequency })}
            <span className={styles.status} data-status={match.relative}>{t(`status.${match.relative}`)}</span>
          </li>
        ))}</ul>}
      </div>
    </td></tr>
  </>;
}
