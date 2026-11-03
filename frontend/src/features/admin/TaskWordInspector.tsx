'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { useState } from 'react';
import { clientApi } from '@/lib/client-api';
import styles from './category-vocabulary-audit.module.css';

type Category = { id: number; path: string; relation: string };
type Match = { id: number; word: string; relation: string; categories: Category[] };
type Inspection = {
  word: string; status: string; resolution: { lemmas: string[]; review_required: boolean };
  matches: Match[]; categories: Category[]; topics_complete: boolean;
  topics: { id: string; level: string; topic: string; relation: string; frequency: number; forms: { word: string; frequency: number }[] }[];
};

const labels = {
  ru: { loading: 'Проверка слова...', retry: 'Повторить', lemma: 'Начальная форма', review: 'Совпадение по начальной форме приблизительное: проверьте выбранную запись.',
    dictionary: 'Записи нашего словаря', missing: 'Совпадений в этом словаре нет.', topics: 'Где встречалось в E-Laipa', noTopics: 'В текстовом индексе E-Laipa не найдено.',
    incomplete: 'Полный индекс E-Laipa недоступен.', forms: 'Формы', count: 'Употреблений', current: 'Текущая тема', previous: 'Раньше', future: 'Позже', elsewhere: 'Вне пути курса',
    target: 'Целевая категория', source: 'Из категории', select: 'Выберите категорию', search: 'Поиск категории', mode: 'Действие', add: 'Добавить в категорию', move: 'Перенести из категории',
    prepare: 'Проверить перенос', confirm: 'Подтвердить', cancel: 'Отмена', saved: 'Категории обновлены.',
    record: 'Изменяется вся выбранная запись, включая фразу. ID, переводы, прогресс и остальные категории сохраняются.', close: 'Закрыть сведения о слове',
    already: 'Уже добавлено', unplaced: 'Без категории', confirmAdd: 'Добавить запись', confirmMove: 'Перенести запись' },
  uk: { loading: 'Перевірка слова...', retry: 'Повторити', lemma: 'Початкова форма', review: 'Збіг за початковою формою приблизний: перевірте вибраний запис.',
    dictionary: 'Записи нашого словника', missing: 'Збігів у цьому словнику немає.', topics: 'Де траплялося в E-Laipa', noTopics: 'У текстовому індексі E-Laipa не знайдено.',
    incomplete: 'Повний індекс E-Laipa недоступний.', forms: 'Форми', count: 'Уживань', current: 'Поточна тема', previous: 'Раніше', future: 'Пізніше', elsewhere: 'Поза шляхом курсу',
    target: 'Цільова категорія', source: 'З категорії', select: 'Виберіть категорію', search: 'Пошук категорії', mode: 'Дія', add: 'Додати до категорії', move: 'Перенести з категорії',
    prepare: 'Перевірити перенесення', confirm: 'Підтвердити', cancel: 'Скасувати', saved: 'Категорії оновлено.',
    record: 'Змінюється весь вибраний запис, зокрема фраза. ID, переклади, прогрес та інші категорії зберігаються.', close: 'Закрити відомості про слово',
    already: 'Уже додано', unplaced: 'Без категорії', confirmAdd: 'Додати запис', confirmMove: 'Перенести запис' },
};
type Labels = typeof labels.ru;
export type WordInspectionContext = { categoryId: number; dictionaryId: number; topicId: string | null; descendants: boolean };

export function TaskWordInspector({ word, context, onClose }: { word: string; context: WordInspectionContext; onClose: () => void }) {
  const t = labels[useLocale() === 'uk' ? 'uk' : 'ru'];
  const [saved, setSaved] = useState(false);
  const key = ['task-word-inspection', context.categoryId, context.topicId, context.descendants, word];
  const query = useQuery({ queryKey: key, staleTime: 0, queryFn: ({ signal }) => {
    const params = new URLSearchParams({ word, descendants: context.descendants ? '1' : '0' });
    if (context.topicId) params.set('topic', context.topicId);
    return clientApi<{ data: Inspection }>(`/admin/categories/${context.categoryId}/vocabulary-audit/word?${params}`, { signal });
  } });
  const data = query.data?.data;
  return <section className={styles.inspector} aria-label={word} aria-busy={query.isFetching}>
    <div className={styles.inspectorHeading}><h4>{word}</h4><button type="button" onClick={onClose} title={t.close} aria-label={t.close}><i className="pi pi-times" aria-hidden="true" /></button></div>
    {query.isFetching && <p role="status">{t.loading}</p>}
    {query.isError && <div className={styles.error} role="alert"><p>{query.error.message}</p><button type="button" onClick={() => query.refetch()}>{t.retry}</button></div>}
    {saved && <p role="status">{t.saved}</p>}
    {data && !query.isError && <>
      <p>{t.lemma}: <strong>{data.resolution.lemmas.join(', ') || '—'}</strong></p>
      {data.resolution.review_required && <p className={styles.sourceNote}>{t.review}</p>}
      <h5>{t.dictionary}</h5>
      {!data.matches.length && <p>{t.missing}</p>}
      {data.matches.map(match => <details key={match.id} className={styles.placement}>
        <summary><strong>{match.word}</strong> · ID {match.id} · {t[match.relation as 'current'] ?? match.relation}</summary>
        {match.categories.length ? <ul>{match.categories.map(category => <li key={category.id}><a href={`/dictionaries/${context.dictionaryId}/category/${category.id}`}>{category.path}</a></li>)}</ul> : <p>{t.unplaced}</p>}
        <PlacementEditor key={`${match.id}:${match.categories.map(c => c.id).sort().join(',')}`} match={match} categories={data.categories} context={context} t={t} disabled={query.isFetching} onSaved={() => setSaved(true)} />
      </details>)}
      <h5>{t.topics}</h5>
      {!data.topics_complete && <p role="note">{t.incomplete}</p>}
      {!data.topics.length && <p>{t.noTopics}</p>}
      <ul>{data.topics.map(topic => <li key={topic.id}><strong>{topic.level} · {topic.topic}</strong> · {t[topic.relation as 'current'] ?? topic.relation}
        <br />{t.forms}: {topic.forms.map(form => `${form.word} ×${form.frequency}`).join(', ')} · {t.count}: {topic.frequency}</li>)}</ul>
    </>}
  </section>;
}

function PlacementEditor({ match, categories, context, t, disabled, onSaved }: { match: Match; categories: Category[]; context: WordInspectionContext; t: Labels; disabled: boolean; onSaved: () => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'move' | 'add'>('add');
  const [source, setSource] = useState(match.categories.length === 1 ? String(match.categories[0].id) : '');
  const [target, setTarget] = useState(match.categories.some(c => c.id === context.categoryId) ? '' : String(context.categoryId));
  const [search, setSearch] = useState('');
  const [confirming, setConfirming] = useState(false);
  const targetCategory = categories.find(category => category.id === Number(target));
  const sourceCategory = match.categories.find(category => category.id === Number(source));
  const valid = targetCategory && (mode === 'add' ? !match.categories.some(c => c.id === targetCategory.id) : sourceCategory && sourceCategory.id !== targetCategory.id);
  const mutation = useMutation({ mutationFn: () => clientApi(`/admin/categories/${context.categoryId}/vocabulary-audit/placement`, {
    method: 'POST', body: JSON.stringify({ word_id: match.id, mode, source_category_id: mode === 'move' ? Number(source) : null,
      target_category_id: Number(target), expected_category_ids: match.categories.map(category => category.id) }),
  }), onSuccess: async () => {
    setConfirming(false);
    onSaved();
    await qc.invalidateQueries({ queryKey: ['task-word-inspection'] });
    await qc.invalidateQueries({ queryKey: ['category-vocabulary-audit'] });
    await qc.invalidateQueries({ queryKey: ['dictionary-words', context.dictionaryId] });
    await qc.invalidateQueries({ queryKey: ['dictionary-categories', context.dictionaryId] });
  } });
  const busy = disabled || mutation.isPending;
  return <div>
    <p className={styles.sourceNote}>{t.record}</p>
    <fieldset className={styles.placementControls} disabled={busy}>
      <label>{t.mode}<select value={mode} onChange={e => { setMode(e.target.value as 'move' | 'add'); setConfirming(false); mutation.reset(); }}>
        <option value="add">{t.add}</option><option value="move" disabled={!match.categories.length}>{t.move}</option>
      </select></label>
      {mode === 'move' && <label>{t.source}<select value={source} onChange={e => { setSource(e.target.value); setConfirming(false); mutation.reset(); }}>
        <option value="">{t.select}</option>{match.categories.map(category => <option key={category.id} value={category.id}>{category.path}</option>)}
      </select></label>}
      <label>{t.search}<input type="search" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <label>{t.target}<select value={target} onChange={e => { setTarget(e.target.value); setConfirming(false); mutation.reset(); }}>
        <option value="">{t.select}</option>{categories.filter(category => category.id === Number(target) || category.path.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim())).map(category =>
          <option key={category.id} value={category.id} disabled={mode === 'add' && match.categories.some(c => c.id === category.id)}>{t[category.relation as 'current'] ?? category.relation} · {category.path}</option>)}
      </select></label>
    </fieldset>
    {targetCategory && <p className={styles.sourceNote}>{t.target}: {targetCategory.path}</p>}
    {mutation.isError && <p role="alert" className={styles.error}>{mutation.error.message}</p>}
    {confirming ? <div className={styles.confirmPlacement}>
      <p><strong>{mode === 'move' ? t.confirmMove : t.confirmAdd}: {match.word} (ID {match.id})</strong><br />
        {mode === 'move' && <>{sourceCategory?.path} → </>}{targetCategory?.path}</p>
      <button type="button" disabled={!valid || busy} onClick={() => mutation.mutate()}><i className="pi pi-check" aria-hidden="true" /> {t.confirm}</button>
      <button type="button" disabled={busy} onClick={() => setConfirming(false)}>{t.cancel}</button>
    </div> : <button className={styles.placementButton} type="button" disabled={!valid || busy} onClick={() => setConfirming(true)}><i className="pi pi-arrow-right" aria-hidden="true" /> {t.prepare}</button>}
  </div>;
}
