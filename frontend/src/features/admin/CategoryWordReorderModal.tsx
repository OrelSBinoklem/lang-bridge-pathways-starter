'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { createPortal } from 'react-dom';
import type { DictWord } from '@/features/training/helpers';
import { clientApi } from '@/lib/client-api';
import styles from '@/features/admin/category-word-reorder-modal.module.css';

type SubCategory = { id: number; name: string };
type Group = { id: number; name: string; words: DictWord[] };
type DragState = { groupIndex: number; wordIndex: number } | null;

function wordInCategory(word: DictWord, categoryId: number) {
  return (word.category_ids ?? []).includes(categoryId);
}

function sortWords(words: DictWord[]) {
  return [...words].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id - b.id);
}

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function CategoryWordReorderModal({
  dictionaryId,
  categoryId,
  subcategories,
  words,
  onClose,
  onSaved,
}: {
  dictionaryId: number;
  categoryId: number;
  subcategories: SubCategory[];
  words: DictWord[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const t = useTranslations('Training');
  const dragged = useRef<DragState>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [initialCategoryByWord, setInitialCategoryByWord] = useState<Map<number, number>>(
    () => new Map(),
  );
  const [dropTarget, setDropTarget] = useState<{ groupIndex: number; wordIndex: number } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialGroups = useMemo(() => {
    const byCategory = new Map<number, DictWord[]>();
    byCategory.set(categoryId, sortWords(words.filter((w) => wordInCategory(w, categoryId))));
    for (const sub of subcategories) {
      byCategory.set(sub.id, sortWords(words.filter((w) => wordInCategory(w, sub.id))));
    }
    return [
      { id: categoryId, name: t('reorderRootGroup'), words: byCategory.get(categoryId) ?? [] },
      ...subcategories.map((sub) => ({
        id: sub.id,
        name: sub.name,
        words: byCategory.get(sub.id) ?? [],
      })),
    ];
  }, [categoryId, subcategories, t, words]);

  useEffect(() => {
    setGroups(initialGroups.map((group) => ({ ...group, words: [...group.words] })));
    const nextInitial = new Map<number, number>();
    for (const group of initialGroups) {
      for (const word of group.words) nextInitial.set(word.id, group.id);
    }
    setInitialCategoryByWord(nextInitial);
  }, [initialGroups]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  function resetDrag() {
    dragged.current = null;
    setDropTarget(null);
  }

  function getDropIndex(event: DragEvent<HTMLElement>, wordIndex: number) {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY - rect.top > rect.height / 2 ? wordIndex + 1 : wordIndex;
  }

  function isSamePosition(groupIndex: number, wordIndex: number) {
    const source = dragged.current;
    if (!source) return false;
    return source.groupIndex === groupIndex && (source.wordIndex === wordIndex || source.wordIndex + 1 === wordIndex);
  }

  function moveWord(targetGroupIndex: number, targetWordIndex: number) {
    const source = dragged.current;
    if (!source) return;

    setGroups((previous) => {
      const next = previous.map((group) => ({ ...group, words: [...group.words] }));
      const sourceGroup = next[source.groupIndex];
      const targetGroup = next[targetGroupIndex];
      const [word] = sourceGroup.words.splice(source.wordIndex, 1);
      if (!word) return previous;

      let insertAt = targetWordIndex < 0 ? targetGroup.words.length : targetWordIndex;
      if (source.groupIndex === targetGroupIndex && insertAt > source.wordIndex) insertAt -= 1;
      targetGroup.words.splice(Math.max(0, Math.min(insertAt, targetGroup.words.length)), 0, word);

      dragged.current = {
        groupIndex: targetGroupIndex,
        wordIndex: targetGroup.words.findIndex((w) => w.id === word.id),
      };
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      for (const group of groups) {
        for (const word of group.words) {
          const sourceCategoryId = initialCategoryByWord.get(word.id);
          if (sourceCategoryId !== undefined && sourceCategoryId !== group.id) {
            await clientApi('/admin/words/move', {
              method: 'POST',
              body: JSON.stringify({
                word_ids: [word.id],
                source_category_id: sourceCategoryId,
                target_category_id: group.id,
                target_dictionary_id: dictionaryId,
                mode: 'move',
              }),
            });
          }
        }
      }

      for (const group of groups) {
        if (group.words.length === 0) continue;
        await clientApi('/admin/words/reorder', {
          method: 'POST',
          body: JSON.stringify({
            category_id: group.id,
            word_orders: group.words.map((word, index) => ({
              word_id: word.id,
              order: index + 1,
            })),
          }),
        });
      }

      await onSaved();
      onClose();
    } catch (event) {
      setError(event instanceof Error ? event.message : t('reorderSaveError'));
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className={styles.modal} role="presentation">
      <button type="button" className={styles.overlay} aria-label={t('close')} onClick={onClose} />
      <div className={styles.content} role="dialog" aria-modal="true" aria-labelledby="word-reorder-title">
        <div className={styles.header}>
          <h2 id="word-reorder-title">{t('reorderTitle')}</h2>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label={t('close')}>
            ×
          </button>
        </div>

        <div className={styles.toolbar}>
          <button type="button" className={styles.dragModeButton} disabled={saving}>
            {t('reorderDragMode')}
          </button>
          <button
            type="button"
            className={styles.shuffleButton}
            disabled={saving}
            onClick={() => setGroups((prev) => prev.map((group) => ({ ...group, words: shuffle(group.words) })))}
          >
            {t('reorderShuffle')}
          </button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.body}>
          <div className={styles.hint}>{t('reorderHint')}</div>
          <div className={styles.groups}>
            {groups.map((group, groupIndex) => (
              <section
                key={group.id}
                className={`${styles.group} ${
                  dropTarget?.groupIndex === groupIndex ? styles.groupDropTarget : ''
                }`}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (group.words.length === 0) {
                    setDropTarget({ groupIndex, wordIndex: 0 });
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  moveWord(groupIndex, -1);
                  resetDrag();
                }}
              >
                <h3 className={styles.groupTitle}>{group.name}</h3>
                <div className={styles.wordList}>
                  {group.words.length === 0 && dropTarget?.groupIndex === groupIndex && (
                    <div className={styles.dropPlaceholder} />
                  )}
                  {group.words.map((word, wordIndex) => (
                    <div key={word.id} className={styles.wordDropWrap}>
                      {dropTarget?.groupIndex === groupIndex &&
                        dropTarget.wordIndex === wordIndex &&
                        !isSamePosition(groupIndex, wordIndex) && (
                          <div className={styles.dropPlaceholder} />
                        )}
                      <div
                        className={styles.wordItem}
                        draggable={!saving}
                        onDragStart={(event) => {
                          dragged.current = { groupIndex, wordIndex };
                          event.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setDropTarget({ groupIndex, wordIndex: getDropIndex(event, wordIndex) });
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          moveWord(groupIndex, getDropIndex(event, wordIndex));
                          resetDrag();
                        }}
                        onDragEnd={resetDrag}
                      >
                        <span className={styles.wordOrder}>{wordIndex + 1}</span>
                        <span className={styles.wordText}>{word.word}</span>
                        <span className={styles.wordTranslation}>
                          {word.translation_1 && word.translation_1 !== '0' ? word.translation_1 : ''}
                        </span>
                      </div>
                      {dropTarget?.groupIndex === groupIndex &&
                        dropTarget.wordIndex === group.words.length &&
                        wordIndex === group.words.length - 1 &&
                        !isSamePosition(groupIndex, group.words.length) && (
                          <div className={styles.dropPlaceholder} />
                        )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.cancelButton} onClick={onClose} disabled={saving}>
            {t('reorderCancel')}
          </button>
          <button type="button" className={styles.saveButton} onClick={save} disabled={saving}>
            {saving ? t('reorderSaving') : t('reorderSave')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
