import { notFound, redirect } from 'next/navigation';
import { apiFetch, type ApiUser } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { CarnivalBake } from './CarnivalBake';
export default async function CarnivalBakePage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  const token = await getAuthToken();
  if (!token) redirect('/login');
  const { user } = await apiFetch<{ user: ApiUser }>('/user', { token });
  if (!user.is_admin) notFound();
  return <CarnivalBake />;
}
