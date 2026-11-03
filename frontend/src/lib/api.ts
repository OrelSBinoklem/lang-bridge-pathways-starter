import type { AuthResponse } from '@/lib/types';

export type { ApiUser, AuthResponse, Category, DemoDashboard, Paginated, Post, Product } from '@/lib/types';

type ApiErrorBody = {
  message?: string;
  errors?: Record<string, string[]>;
};

const API_URL =
  process.env.LARAVEL_API_URL ?? process.env.NEXT_PUBLIC_LARAVEL_API_URL ?? 'http://127.0.0.1:8000/api';

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message ?? 'Request failed');
    this.status = status;
    this.errors = body.errors;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;

  // Protected dictionary data needs the same-origin cookie-to-token bridge, not a public URL.
  const url = typeof window !== 'undefined' && /^\/dictionaries\//.test(path) ? `/api/lbp${path}` : `${API_URL}${path}`;
  const response = await fetch(url, {
    ...rest,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    cache: 'no-store',
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const body = (await response.json().catch(() => ({}))) as ApiErrorBody & T;

  if (!response.ok) {
    throw new ApiError(response.status, body);
  }

  return body;
}

export async function loginRequest(payload: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
