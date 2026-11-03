'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { WordEditor } from '@/features/admin/WordEditor';
import styles from '@/features/admin/category-similar-drawer.module.css';
import {
  buildCategoryMetaMap,
  buildCategorySimilarReport,
  getDeepestCategoryPaths,
  getWordCategoryIds,
  type SimilarMatch,
} from '@/features/admin/similarWords';
import type { CategoryNode } from '@/features/dictionaries/category-tree';
import type { DictWord } from '@/features/training/helpers';
import { apiFetch } from '@/lib/api';
import { clientApi } from '@/lib/client-api';

type Props = {
  open: boolean;
  onClose: () => void;
  dictionaryId: number;
  categoryId: number;
  categoryWords: DictWord[];
  dictionaryWords: DictWord[];
};

export function CategorySimilarDrawer({
  open,
  onClose,
  dictionaryId,
  categoryId,
  categoryWords,
  dictionaryWords,
}: Props) {
  const t = useTranslations('Admin');
  const qc = useQueryClient();
  const [editWord, setEditWord] = useState<DictWord | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const catsQuery = useQuery({
    queryKey: ['dictionary-categories', dictionaryId],
    enabled: open && !!dictionaryId,
    queryFn: () => apiFetch<{ data: CategoryNode[] }>(`/dictionaries/${dictionaryId}/categories`),
  });

  const metaMap = useMemo(
    () => buildCategoryMetaMap(catsQuery.data?.data ?? []),
    [catsQuery.data],
  );

  const report = useMemo(() => {
    if (!open) return [];
    return buildCategorySimilarReport(categoryWords, dictionaryWords);
  }, [open, categoryWords, dictionaryWords]);

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['dictionary-words', dictionaryId] });
  };

  const deleteMutation = useMutation({
    mutationFn: async ({ wordId, catId }: { wordId: number; catId: number }) =>
      clientApi(`/admin/words/${wordId}?category_id=${catId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setErr(null);
      await invalidate();
      setEditWord((cur) => {
        if (!cur) return null;
        return dictionaryWords.some((w) => w.id === cur.id) ? cur : null;
      });
    },
    onError: (e: Error) => setErr(e.message),
  });

  function findFull(id: number): DictWord | undefined {
    return dictionaryWords.find((w) => w.id === id);
  }

  function deleteMatch(match: SimilarMatch) {
    const full = findFull(match.id);
    const label = full?.word ?? match.word;
    const catIds = getWordCategoryIds(full ?? match);
    const orphan = catIds.length === 0;

    if (orphan) {
      if (!confirm(t('confirmDeleteOrphan', { label }))) return;
      deleteMutation.mutate({ wordId: match.id, catId: 0 });
      return;
    }

    const catId = catIds[0];
    const paths = getDeepestCategoryPaths(metaMap, full ?? match);
    const hint = paths.join(', ') || `ID ${catId}`;
    if (!confirm(t('confirmDeleteFromCategory', { label, hint }))) return;
    deleteMutation.mutate({ wordId: match.id, catId });
  }

  function deleteSource(sourceId: number, sourceWord: string) {
    if (!confirm(t('confirmDeleteSource', { word: sourceWord }))) return;
    deleteMutation.mutate({ wordId: sourceId, catId: categoryId });
  }

  function renderMatch(item: SimilarMatch) {
    const full = findFull(item.id) ?? item;
    const paths = getDeepestCategoryPaths(metaMap, full);
    const catIds = getWordCategoryIds(full);
    const orphan = catIds.length === 0;

    return (
      <span className={styles.match}>
        <span className={styles.matchText}>
          <span className={styles.matchWord}>{item.word}</span>
          {item.translation_1 ? ` — ${item.translation_1}` : ''}
          {paths.length > 0 ? (
            <span className={styles.catPath}>{` — ${paths.join(', ')}`}</span>
          ) : orphan ? (
            <span className={styles.orphan}> — {t('noCategory')}</span>
          ) : (
            <span className={styles.catPath}>
              {` — ${t('categoryNotInTree', { ids: catIds.join(', ') })}`}
            </span>
          )}
        </span>
        <button
          type="button"
          className={styles.iconBtn}
          title={t('edit')}
          onClick={() => {
            const w = findFull(item.id);
            if (w) setEditWord(w);
          }}
        >
          ✏️
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          title={orphan ? t('deleteFully') : t('deleteFromCategory')}
          onClick={() => deleteMatch(item)}
        >
          🗑️
        </button>
      </span>
    );
  }

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div className={styles.backdrop} role="presentation" onClick={onClose} />
      <aside className={styles.drawer} aria-label={t('similarAria')}>
        <div className={styles.header}>
          <span className={styles.title}>{t('similarTitle')}</span>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            {t('similarDrawerClose')}
          </button>
        </div>
        <div className={styles.hint}>{t('similarHint')}</div>
        {err && <div className={styles.orphan} style={{ marginBottom: 8 }}>{err}</div>}
        <div className={styles.body}>
          {!dictionaryWords.length ? (
            <div className={styles.orphan}>{t('noDictData')}</div>
          ) : report.length === 0 ? (
            <div>{t('noWordsInCategory')}</div>
          ) : (
            report.map((row) => (
              <div key={row.sourceId} className={styles.block}>
                <div className={styles.sourceHeader}>
                  <div className={styles.sourceTitle}>
                    <span className={styles.sourceWord}>{row.sourceWord}</span>
                    {row.sourceTranslation ? (
                      <span className={styles.sourceTr}> — {row.sourceTranslation}</span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    title={t('deleteFromCurrentCategory')}
                    onClick={() => deleteSource(row.sourceId, row.sourceWord)}
                  >
                    🗑️
                  </button>
                </div>
                {row.exact.length > 0 ? (
                  <div className={styles.exact}>
                    {row.exact.length === 1 ? (
                      <div>
                        <span style={{ marginRight: 4 }}>{t('exactMatch')}</span>
                        {renderMatch(row.exact[0])}
                      </div>
                    ) : (
                      <>
                        <div>{t('exactMatches', { count: row.exact.length })}</div>
                        <ul className={styles.list}>
                          {row.exact.map((item) => (
                            <li key={item.id}>{renderMatch(item)}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                ) : row.similar.length > 0 ? (
                  <div>
                    <div className={styles.similarLabel}>{t('similarLabel')}</div>
                    <ul className={styles.list}>
                      {row.similar.map((item) => (
                        <li key={item.id}>{renderMatch(item)}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className={styles.ok}>{t('noMatches')}</div>
                )}
              </div>
            ))
          )}
        </div>
      </aside>

      {editWord && (
        <WordEditor
          dictionaryId={dictionaryId}
          word={editWord}
          onClose={() => setEditWord(null)}
        />
      )}
    </>,
    document.body,
  );
}
