import { notFound, redirect } from 'next/navigation';
import { ApiError, apiFetch, type ApiUser } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { ContinuePreviews } from '@/features/home-previews/ContinuePreviews';

export const metadata = { title: 'Кнопка продолжения · варианты', robots: { index: false, follow: false } };

export default async function ContinuePreviewsPage() {
  // This static mockup contains no account data; allow local development without a session.
  if (process.env.NODE_ENV === 'development') return <ContinuePreviews />;
  const token = await getAuthToken();
  if (!token) redirect('/login');
  let user: ApiUser;
  try { ({ user } = await apiFetch<{ user: ApiUser }>('/user', { token })); }
  catch (error) { if (error instanceof ApiError && error.status === 401) redirect('/login'); throw error; }
  if (!user.is_admin) notFound();
  return <ContinuePreviews />;
}
