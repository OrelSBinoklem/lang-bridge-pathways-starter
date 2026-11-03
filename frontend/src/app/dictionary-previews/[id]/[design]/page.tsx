import { notFound, redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { ApiError, apiFetch, type ApiUser } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { CategoryPreview } from '@/features/category-previews/CategoryPreview';
import { CATEGORY_DESIGNS, type CategoryDesign, type VisualCategoryDesign, type CategoryPreviewData } from '@/features/category-previews/types';
import { buildCategoryGroups, categoryArtKey } from '@/features/category-previews/model';
import categoryIcons from '@/features/course/category-icons.json';
import transparentCategories from '@/features/course/category-transparent.json';
import { DictionaryDetail } from '@/features/dictionaries/DictionaryDetail';
import { SubscriptionAccess } from '@/features/credits/SubscriptionAccess';

export const metadata = { title: 'Категории · варианты дизайна', robots: { index: false, follow: false } };

export default async function DictionaryDesignPage({ params, searchParams }: {
  params: Promise<{ id: string; design: string }>;
  searchParams: Promise<{ q?: string; level?: string }>;
}) {
  const { id, design } = await params;
  const dictionaryId = Number(id);
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(dictionaryId) || dictionaryId <= 0 || !CATEGORY_DESIGNS.includes(design as CategoryDesign)) notFound();
  const token = await getAuthToken();
  if (!token) redirect('/login');
  let user: ApiUser;
  try { ({ user } = await apiFetch<{ user: ApiUser }>('/user', { token })); }
  catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/login');
    throw error;
  }
  if (!user.is_admin) notFound();
  // This study deliberately keeps the actual dictionary page and shell intact.
  if (design === 'clean-progress' || design === 'original') return <SubscriptionAccess><DictionaryDetail progressAppearance={design === 'original' ? 'classic' : 'refined'} /></SubscriptionAccess>;
  const results = await Promise.allSettled([
    apiFetch<{ data: CategoryPreviewData['dictionary'] }>(`/dictionaries/${dictionaryId}`, { token }),
    apiFetch<{ data: CategoryPreviewData['nodes'] }>(`/dictionaries/${dictionaryId}/categories`, { token }),
    apiFetch<{ data: CategoryPreviewData['words'] }>(`/dictionaries/${dictionaryId}/words`, { token }),
    apiFetch<{ data: NonNullable<CategoryPreviewData['progress']> }>(`/me/progress?dictionary_id=${dictionaryId}&date_format=raw`, { token }),
  ]);
  const [dictionary, categories, words, progress] = results;
  if (dictionary.status === 'rejected' && dictionary.reason instanceof ApiError && dictionary.reason.status === 404) notFound();
  if (dictionary.status === 'rejected' || categories.status === 'rejected' || words.status === 'rejected') {
    console.error('[dictionary-previews] Catalog unavailable', { dictionaryId, sources: results.slice(0, 3).map(result => result.status) });
    throw new Error('Не удалось загрузить категории словаря. Попробуйте ещё раз.');
  }
  if (progress.status === 'rejected') console.error('[dictionary-previews] Progress unavailable', { dictionaryId, status: progress.reason instanceof ApiError ? progress.reason.status : 'unknown' });
  const query = await searchParams;
  const source: CategoryPreviewData = {
    dictionary: dictionary.value.data, nodes: categories.value.data, words: words.value.data,
    progress: progress.status === 'fulfilled' ? progress.value.data : null,
  };
  const artwork = Object.fromEntries(Object.entries(categoryIcons).map(([key, icon]) => [categoryArtKey(icon.name),
    transparentCategories.includes(Number(key)) ? `/course/categories/transparent/${key}-light.webp` : icon.src,
  ]));
  // Send only the small rendered catalog; raw vocabulary and progress rows stay on the server.
  const groups = buildCategoryGroups(source, await getLocale(), artwork);
  return <CategoryPreview design={design as VisualCategoryDesign} data={{ dictionary: source.dictionary, groups, progressAvailable: source.progress !== null }} initialSearch={typeof query.q === 'string' ? query.q : ''} initialLevel={typeof query.level === 'string' ? query.level : ''} />;
}
