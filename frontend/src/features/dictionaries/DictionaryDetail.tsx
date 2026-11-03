'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CategoryAdminPanel } from '@/features/admin/CategoryAdminPanel';
import {
  CategoryTreeView,
  type ApiUser,
  type CategoryNode,
  type Dictionary,
} from '@/features/dictionaries/category-tree';
import type { DictWord, ProgressRow } from '@/features/training/helpers';
import styles from '@/app/dictionaries/dictionary.module.css';
import { apiFetch } from '@/lib/api';
import { clientApi } from '@/lib/client-api';
import { useAdminAppearance } from '@/features/admin/useUserPreview';
import { fetchProgress } from '@/features/training/progress-api';
import { buildCategoryGroups, categoryArtKey } from '@/features/category-previews/model';
import categoryIcons from '@/features/course/category-icons.json';
import transparentCategories from '@/features/course/category-transparent.json';

const CategoryPreview = dynamic(() => import('@/features/category-previews/CategoryPreview').then(module => module.CategoryPreview));
const EMPTY_CATEGORIES: CategoryNode[] = [];
const EMPTY_WORDS: DictWord[] = [];
const artwork = Object.fromEntries(Object.entries(categoryIcons).map(([key, icon]) => [categoryArtKey(icon.name),
  transparentCategories.includes(Number(key)) ? `/course/categories/transparent/${key}-light.webp` : icon.src,
]));

export function DictionaryDetail({ progressAppearance = 'refined' }: { progressAppearance?: 'classic' | 'refined' | 'mastery' }) {
  const t = useTranslations('Dict');
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const dictionaryId = Number(params.id);

  const [user, setUser] = useState<ApiUser | null>(null);
  const [adminMode, setAdminMode] = useState(false);
  const [showCategoryManagement, setShowCategoryManagement] = useState(false);

  useEffect(() => {
    clientApi<{ user: ApiUser }>('/user')
      .then((r) => {
        setUser(r.user);
        setAdminMode(localStorage.getItem('lbp_admin_mode') === '1');
      })
      .catch(() => setUser(null));
  }, []);

  const dictQuery = useQuery({
    queryKey: ['dictionary', dictionaryId],
    enabled: Number.isFinite(dictionaryId),
    queryFn: () => apiFetch<{ data: Dictionary }>(`/dictionaries/${dictionaryId}`),
  });

  const categoriesQuery = useQuery({
    queryKey: ['dictionary-categories', dictionaryId],
    enabled: Number.isFinite(dictionaryId),
    queryFn: () => apiFetch<{ data: CategoryNode[] }>(`/dictionaries/${dictionaryId}/categories`),
  });

  const wordsQuery = useQuery({
    queryKey: ['dictionary-words', dictionaryId],
    enabled: Number.isFinite(dictionaryId),
    queryFn: () => apiFetch<{ data: DictWord[] }>(`/dictionaries/${dictionaryId}/words`),
  });

  const progressQuery = useQuery({
    queryKey: ['progress', dictionaryId],
    enabled: Number.isFinite(dictionaryId) && !!user,
    queryFn: () => fetchProgress(dictionaryId),
  });

  const tree = categoriesQuery.data?.data ?? EMPTY_CATEGORIES;
  const words = wordsQuery.data?.data ?? EMPTY_WORDS;
  const progressByWordId = useMemo(() => {
    const map: Record<number, Pick<ProgressRow, 'correct_attempts' | 'correct_attempts_revert'>> =
      {};
    for (const row of progressQuery.data?.data ?? []) {
      map[row.dict_word_id] = {
        correct_attempts: row.correct_attempts ?? 0,
        correct_attempts_revert: row.correct_attempts_revert ?? 0,
      };
    }
    return map;
  }, [progressQuery.data]);

  function openCategory(id: number) {
    router.push(`/dictionaries/${dictionaryId}/category/${id}`);
  }

  const dict = dictQuery.data?.data;
  const groups = useMemo(() => dict && progressAppearance === 'mastery' ? buildCategoryGroups({
    dictionary: dict, nodes: tree, words, progress: progressQuery.data?.data ?? null,
  }, locale, artwork) : [], [dict, tree, words, progressQuery.data, locale, progressAppearance]);
  const isAdmin = useAdminAppearance(user?.is_admin);
  const adminActive = isAdmin && adminMode;

  function toggleAdminMode() {
    const next = !adminMode;
    setAdminMode(next);
    localStorage.setItem('lbp_admin_mode', next ? '1' : '0');
    if (!next) setShowCategoryManagement(false);
  }

  return (
    <section className="grid gap-4">
      {progressAppearance === 'mastery' ? (
        dictQuery.isError || categoriesQuery.isError || wordsQuery.isError
          ? <p role="alert">{locale === 'uk' ? 'Не вдалося завантажити категорії. Спробуйте оновити сторінку.' : 'Не удалось загрузить категории. Попробуйте обновить страницу.'}</p>
          : !dict || categoriesQuery.isPending || wordsQuery.isPending
            ? <p role="status">{locale === 'uk' ? 'Завантаження категорій…' : 'Загрузка категорий…'}</p>
            : <CategoryPreview primary design="glass-mastery" data={{ dictionary: dict, groups, progressAvailable: !!progressQuery.data }} loadingProgress={!!user && progressQuery.isPending} />
      ) : <>
      <h1 className={styles.title}>
        {dict?.name ?? t('dictionary')}
        <div className="mt-1 text-base font-normal text-zinc-500 dark:text-zinc-400">
          {t('wordsCount', { count: dict?.words ?? 0 })} · {dict?.lang} → {dict?.learn_lang}
        </div>
      </h1>

      {progressAppearance === 'classic' && <div className="mb-2 text-center text-sm font-medium uppercase tracking-wide text-zinc-500">{t('categories')}</div>}
      <CategoryTreeView
        nodes={tree}
        words={words}
        progressByWordId={progressByWordId}
        progressAppearance={progressAppearance}
        onPick={openCategory}
      />
      <div className="mt-6 text-center text-sm text-zinc-500">
        {t('matrix', { count: words.length })}
      </div>
      </>}

      {isAdmin && (
        <div className={styles.adminBar}>
          <button
            type="button"
            className={`${styles.adminToggle} ${adminMode ? styles.adminToggleOn : ''}`}
            onClick={toggleAdminMode}
            title={adminMode ? t('adminOn') : t('adminOff')}
          >
            {adminMode ? t('adminModeOn') : t('adminModeOff')}
          </button>
          {adminActive && (
            <button
              type="button"
              className={styles.adminAction}
              onClick={() => setShowCategoryManagement((v) => !v)}
            >
              {showCategoryManagement ? t('hideCategoryMgmt') : t('showCategoryMgmt')}
            </button>
          )}
          {adminActive && !showCategoryManagement && (
            <span className={styles.adminHint}>{t('categoryMgmtHint')}</span>
          )}
        </div>
      )}

      {adminActive && showCategoryManagement && (
        <CategoryAdminPanel dictionaryId={dictionaryId} tree={tree} />
      )}
    </section>
  );
}
