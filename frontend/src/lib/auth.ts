import { cookies } from 'next/headers';

export const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME ?? 'lbpw_token';

export async function getAuthToken(): Promise<string | undefined> {
  const store = await cookies();

  return store.get(AUTH_COOKIE)?.value;
}
