import { notFound, redirect } from 'next/navigation';
import { apiFetch, ApiError, type ApiUser } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { BrowserSpeechLab } from '@/features/tutor/speech-lab/BrowserSpeechLab';

export const metadata = { title: 'Проверка голосов и распознавания', robots: { index: false, follow: false } };

export default async function BrowserSpeechTestPage() {
  const token = await getAuthToken();
  if (!token) redirect('/login');
  let user: ApiUser;
  try { ({ user } = await apiFetch<{ user: ApiUser }>('/user', { token })); }
  catch (error) { if (error instanceof ApiError && error.status === 401) redirect('/login'); throw error; }
  if (!user.is_admin) notFound();
  return <BrowserSpeechLab />;
}
