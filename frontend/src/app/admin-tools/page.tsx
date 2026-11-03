import { notFound, redirect } from 'next/navigation';
import { apiFetch, type ApiUser } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { AdminPageMap } from '@/features/admin/AdminPageMap';

export default async function AdminToolsPage() {
  const token = await getAuthToken();
  if (!token) redirect('/login');
  const { user } = await apiFetch<{ user: ApiUser }>('/user', { token });
  if (!user.is_admin) notFound();
  return <AdminPageMap />;
}
