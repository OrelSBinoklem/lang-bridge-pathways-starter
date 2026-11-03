'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { findCategory, sortByOrder, type ApiUser, type CategoryNode, type Dictionary } from '@/features/dictionaries/category-tree';
import { ExamenTrainer } from '@/features/training/ExamenTrainer';
import type { DictWord } from '@/features/training/helpers';
import { apiFetch } from '@/lib/api';
import { clientApi } from '@/lib/client-api';

export type WordsBlockConfig = { dictionary_id: number; category_id: number };

/** Тонкая обёртка над уже существующим тренажёром слов категории — переиспользует ExamenTrainer как есть. */
export function WordsBlock({ config }: { config: WordsBlockConfig }) {
  const dictionaryId = config.dictionary_id;
  const categoryId = config.category_id;
  const [user, setUser] = useState<ApiUser | null>(null);
  useEffect(() => { clientApi<{ user: ApiUser }>('/user').then((r) => setUser(r.user)).catch(() => setUser(null)); }, []);

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

  const words = wordsQuery.data?.data ?? [];
  const selectedCategory = useMemo(
    () => findCategory(categoriesQuery.data?.data ?? [], categoryId),
    [categoriesQuery.data, categoryId],
  );
  const subcategories = useMemo(
    () => sortByOrder(selectedCategory?.children ?? []).map((c) => ({ id: c.id, name: c.name })),
    [selectedCategory],
  );

  if (!Number.isFinite(dictionaryId) || !Number.isFinite(categoryId)) return null;

  return (
    <ExamenTrainer
      dictionaryId={dictionaryId}
      categoryId={categoryId}
      categoryName={selectedCategory?.name}
      learnLang={dictQuery.data?.data.learn_lang}
      subcategories={subcategories}
      words={words}
      isAuthenticated={!!user}
    />
  );
}
