'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import {
  findCategory,
  findParent,
  sortByOrder,
  type ApiUser,
  type CategoryNode,
  type Dictionary,
} from '@/features/dictionaries/category-tree';
import { ExamenTrainer } from '@/features/training/ExamenTrainer';
import type { DictWord } from '@/features/training/helpers';
import styles from '@/app/dictionaries/dictionary.module.css';
import { apiFetch } from '@/lib/api';
import { clientApi } from '@/lib/client-api';
import { useAdminAppearance } from '@/features/admin/useUserPreview';
import { CategoryVocabularyAuditDialog } from '@/features/admin/CategoryVocabularyAuditDialog';
import { WordsTour } from '@/features/home-tour/WordsTour';
import tourStyles from '@/features/home-tour/home-tour.module.css';

export default function DictionaryCategoryPage() {
  const t = useTranslations('Dict');
  const auditT = useTranslations('CategoryAudit');
  const params = useParams<{ id: string; categoryId: string }>();
  const router = useRouter();
  const dictionaryId = Number(params.id);
  const categoryId = Number(params.categoryId);

  const [user, setUser] = useState<ApiUser | null>(null);
  const [adminMode, setAdminMode] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  useEffect(() => {
    clientApi<{ user: ApiUser }>('/user')
      .then((r) => setUser(r.user))
      .catch(() => setUser(null));
    setAdminMode(localStorage.getItem('lbp_admin_mode') === '1');
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

  const tree = categoriesQuery.data?.data ?? [];
  const words = wordsQuery.data?.data ?? [];

  const selectedCategory = useMemo(
    () => (Number.isFinite(categoryId) ? findCategory(tree, categoryId) : null),
    [tree, categoryId],
  );
  const parentCategory = useMemo(
    () => (Number.isFinite(categoryId) ? findParent(tree, categoryId) : null),
    [tree, categoryId],
  );
  const subcategories = useMemo(
    () => sortByOrder(selectedCategory?.children ?? []).map((c) => ({ id: c.id, name: c.name })),
    [selectedCategory],
  );

  const dict = dictQuery.data?.data;
  const isAdmin = useAdminAppearance(user?.is_admin);
  const adminActive = isAdmin && adminMode;

  function backToCategories() {
    router.push(`/dictionaries/${dictionaryId}`);
  }

  function toggleAdminMode() {
    const next = !adminMode;
    setAdminMode(next);
    localStorage.setItem('lbp_admin_mode', next ? '1' : '0');
  }

  if (!Number.isFinite(dictionaryId) || !Number.isFinite(categoryId)) {
    return <div className="p-8 text-center text-zinc-500">{t('badCategoryUrl')}</div>;
  }

  return (
    <section className="grid gap-4">
      <div className={tourStyles.categoryHeader}>
      <h1 className={styles.title}>
        <button type="button" className={styles.titleBtn} onClick={backToCategories} data-word-tour="category">
          {dict?.name ?? t('dictionary')}
          {parentCategory ? ` → ${parentCategory.name}` : ''}
          {selectedCategory ? ` → ${selectedCategory.name}` : ` → #${categoryId}`}
        </button>
      </h1>
      {selectedCategory && wordsQuery.isSuccess && <WordsTour key={`${dictionaryId}:${categoryId}`} isAuthenticated={!!user} />}
      </div>
      {isAdmin && selectedCategory && (
        <div>
          <button type="button" className={styles.adminAction} onClick={() => setAuditOpen(true)}>
            <i className="pi pi-chart-bar" aria-hidden="true" /> {auditT('title')}
          </button>
          <CategoryVocabularyAuditDialog key={`${dictionaryId}:${categoryId}`} categoryId={categoryId} open={auditOpen} onClose={() => setAuditOpen(false)} />
        </div>
      )}

      {categoriesQuery.isSuccess && !selectedCategory ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {t('categoryNotFound', { id: categoryId })}{' '}
          <button type="button" className="underline" onClick={backToCategories}>
            {t('backToCategories')}
          </button>
        </div>
      ) : (
        <ExamenTrainer
          dictionaryId={dictionaryId}
          categoryId={categoryId}
          categoryName={selectedCategory?.name}
          learnLang={dict?.learn_lang}
          subcategories={subcategories}
          words={words}
          isAuthenticated={!!user}
          adminMode={adminActive}
        />
      )}

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
          {adminActive && <span className={styles.adminHint}>{t('adminHint')}</span>}
        </div>
      )}
    </section>
  );
}
