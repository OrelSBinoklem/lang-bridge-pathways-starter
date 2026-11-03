import { notFound, redirect } from 'next/navigation';
import { ApiError, apiFetch, type ApiUser } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { HomePreview } from '@/features/home-previews/HomePreview';
import { HOME_DESIGNS, type HomeDesign, type HomePreviewData } from '@/features/home-previews/types';

export const metadata = { title: 'Главная · LangBridge Pathways', robots: { index: false, follow: false } };

export default async function HomeDesignPage({ params }: { params: Promise<{ design: string }> }) {
  const { design } = await params;
  if (!HOME_DESIGNS.includes(design as HomeDesign)) notFound();
  const token = await getAuthToken();
  if (!token) redirect('/login');
  let user: ApiUser;
  try {
    ({ user } = await apiFetch<{ user: ApiUser }>('/user', { token }));
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/login');
    throw error;
  }
  if (!user.is_admin) notFound();

  const data: HomePreviewData = { levels: [], dictionaries: [], exams: [], errors: [] };
  // The original homepage owns its queries; do not fetch unused preview catalogs.
  if (design === 'unified') return <HomePreview design="unified" data={data} />;
  const sources = [
    { key: 'levels' as const, path: '/course?learn_lang=lv' },
    { key: 'dictionaries' as const, path: '/dictionaries?learn_lang=lv' },
    { key: 'exams' as const, path: '/exams' },
  ];
  // Read each source independently: an unavailable catalog must not fabricate progress.
  for (const source of sources) {
    try {
      const result = await apiFetch<{ data: unknown }>(source.path, { token });
      if (!Array.isArray(result.data)) throw new Error('Unexpected catalog response');
      if (source.key === 'levels') data.levels = result.data as HomePreviewData['levels'];
      if (source.key === 'dictionaries') data.dictionaries = result.data as HomePreviewData['dictionaries'];
      if (source.key === 'exams') data.exams = result.data as HomePreviewData['exams'];
    } catch (error) {
      console.error(`[home-previews] Cannot load ${source.key}`, error instanceof ApiError ? `HTTP ${error.status}` : error instanceof Error ? error.name : 'Unknown error');
      data.errors.push(source.key);
    }
  }
  return <HomePreview design={design as HomeDesign} data={data} />;
}
