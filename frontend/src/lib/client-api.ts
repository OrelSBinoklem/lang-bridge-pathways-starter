import { ApiError } from '@/lib/api';
import { isCreditMutation, notifyCreditsChanged } from '@/lib/credit-refresh';

type ApiErrorBody = {
  message?: string;
  errors?: Record<string, string[]>;
};

/** Browser-safe API calls via Next proxy (`/api/lbp/...`) with httpOnly Sanctum cookie. */
export async function clientApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/lbp${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
      cache: 'no-store',
    });
  } finally {
    // Even a failed paid request can release or retain a reservation.
    if (isCreditMutation(path, options.method)) notifyCreditsChanged();
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const body = (await response.json().catch(() => ({}))) as ApiErrorBody & T;

  if (!response.ok) {
    throw new ApiError(response.status, body);
  }

  return body;
}
