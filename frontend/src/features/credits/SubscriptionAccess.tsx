import { getAuthToken } from '@/lib/auth';
import { apiFetch, ApiError } from '@/lib/api';
import { AccessPlans, type Subscription } from './AccessPlans';

export async function SubscriptionAccess({ children }: { children: React.ReactNode }) {
  const token = await getAuthToken();
  if (!token) return <AccessPlans />;
  let active = false;
  try {
    const { data } = await apiFetch<{ data: Subscription }>('/me/subscription', { token });
    active = data.active;
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) throw error;
  }
  return active ? children : <AccessPlans />;
}
