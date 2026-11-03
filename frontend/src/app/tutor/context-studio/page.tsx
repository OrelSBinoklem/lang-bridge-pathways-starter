import { notFound, redirect } from 'next/navigation';
import { apiFetch, ApiError, type ApiUser } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { ContextStudio } from '@/features/tutor/context-studio/ContextStudio';

export const metadata = { title: 'Конструктор схем ботов', robots: { index: false, follow: false } };

export default async function ContextStudioPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const token = await getAuthToken();
  if (!token) redirect('/login');
  let user: ApiUser;
  try { ({ user } = await apiFetch<{ user: ApiUser }>('/user', { token })); }
  catch (error) { if (error instanceof ApiError && error.status === 401) redirect('/login'); throw error; }
  if (!user.is_admin) notFound();
  const query = await searchParams;
  const conversation = Number(query.conversation);
  const requestedModule = query.module ?? query.scheme; // Existing bookmarked links remain valid.
  const scheme = typeof requestedModule === 'string' && ['tutor', 'exams', 'english_exams', 'translation', 'memory', 'references'].includes(requestedModule) ? requestedModule : '';
  return <ContextStudio adminId={user.id} initialLive={query.live === '1'} initialScheme={scheme} initialConversation={Number.isSafeInteger(conversation) && conversation > 0 ? conversation : null} />;
}
