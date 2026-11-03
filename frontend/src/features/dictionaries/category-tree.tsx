'use client';

import type { CSSProperties } from 'react';
import {
  collectDescendantIds,
  getCategoryProgress,
  type DictWord,
  type ProgressRow,
} from '@/features/training/helpers';
import styles from '@/app/dictionaries/dictionary.module.css';
import progressStyles from './category-progress.module.css';

export type CategoryNode = {
  id: number;
  name: string;
  name_translations?: Record<string, string | null>;
  parent_id: number | null;
  order: number;
  children: CategoryNode[];
};

export type Dictionary = {
  id: number;
  name: string;
  lang: string;
  learn_lang: string;
  words: number;
};

export type ApiUser = { id: number; is_admin?: boolean };

export function sortByOrder(nodes: CategoryNode[]) {
  return [...nodes].sort((a, b) => {
    const oa = a.order ?? 0;
    const ob = b.order ?? 0;
    if (oa !== ob) return oa - ob;
    return a.id - b.id;
  });
}

export function findCategory(nodes: CategoryNode[], id: number): CategoryNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const child = findCategory(n.children ?? [], id);
    if (child) return child;
  }
  return null;
}

/** Плоский список для Dropdown: «— » × уровень вложенности вместо цепочки родителей */
export function flattenCategoryOptions(
  nodes: CategoryNode[],
  depth = 0,
): { label: string; value: number; parent_id: number | null; order: number }[] {
  const out: { label: string; value: number; parent_id: number | null; order: number }[] = [];
  for (const n of sortByOrder(nodes)) {
    const sticks = depth > 0 ? `${'—'.repeat(depth)} ` : '';
    out.push({
      label: `${sticks}${n.name}`,
      value: n.id,
      parent_id: n.parent_id,
      order: n.order,
    });
    out.push(...flattenCategoryOptions(n.children ?? [], depth + 1));
  }
  return out;
}

/** Родитель L1 для категории L2 (breadcrumb). */
export function findParent(nodes: CategoryNode[], id: number): CategoryNode | null {
  for (const n of nodes) {
    if ((n.children ?? []).some((c) => c.id === id)) return n;
    const deeper = findParent(n.children ?? [], id);
    if (deeper) return deeper;
  }
  return null;
}

/**
 * Дерево как в WP CategoryTree:
 * L1 — заголовок + агрегированный прогресс
 * L2 — чипы с заливкой прогресса / ✓ при 100%
 */
export function CategoryTreeView({
  nodes,
  words,
  progressByWordId,
  onPick,
  progressAppearance = 'classic',
}: {
  nodes: CategoryNode[];
  words: DictWord[];
  progressByWordId: Record<number, Pick<ProgressRow, 'correct_attempts' | 'correct_attempts_revert'>>;
  onPick: (id: number) => void;
  progressAppearance?: 'classic' | 'refined';
}) {
  return (
    <ul className={`${styles.tree}${progressAppearance === 'refined' ? ` ${progressStyles.refined}` : ''}`}>
      {sortByOrder(nodes).map((l1) => {
        const l1ChildIds = collectDescendantIds(l1);
        const l1Progress = getCategoryProgress(words, progressByWordId, l1.id, l1ChildIds);
        const l1Full = l1Progress.total > 0 && l1Progress.progress >= 1;
        return (
          <li key={l1.id} className={styles.treeL1}>
            <span
              className={`${styles.treeL1Name} ${l1Full ? styles.treeL1NameFull : ''}`}
              style={{ '--category-progress': l1Progress.progress } as CSSProperties}
              data-category-progress={progressAppearance === 'refined' ? 'group' : undefined}
            >
              <span className={styles.treeL1NameText}>{l1.name}</span>
              {l1Full && (
                <span className={styles.progressDone} aria-hidden>
                  ✓
                </span>
              )}
              {progressAppearance === 'refined' && <ProgressStrip progress={l1Progress.progress} complete={l1Full} label={l1.name} />}
            </span>
            <ul className={styles.treeL2}>
              {sortByOrder(l1.children ?? []).map((l2) => {
                const l2ChildIds = collectDescendantIds(l2);
                const { progress, total } = getCategoryProgress(
                  words,
                  progressByWordId,
                  l2.id,
                  l2ChildIds,
                );
                const full = total > 0 && progress >= 1;
                return (
                  <li key={l2.id}>
                    <button
                      type="button"
                      className={`${styles.chip} ${full ? styles.chipFull : ''}`}
                      style={{ '--category-progress': progress } as CSSProperties}
                      data-category-progress={progressAppearance === 'refined' ? 'item' : undefined}
                      onClick={() => onPick(l2.id)}
                    >
                      <span className={styles.chipLabel}>{l2.name}</span>
                      {full && (
                        <span className={styles.progressDone} aria-hidden>
                          ✓
                        </span>
                      )}
                      {progressAppearance === 'refined' && <ProgressStrip progress={progress} complete={full} label={l2.name} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

function ProgressStrip({ progress, complete, label }: { progress: number; complete: boolean; label: string }) {
  return <span className={progressStyles.meter} data-complete={complete || undefined} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 1000) / 10}>
    <span className={progressStyles.fill} />
  </span>;
}
