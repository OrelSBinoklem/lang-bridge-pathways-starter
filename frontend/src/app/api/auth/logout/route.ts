import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';
import { AUTH_COOKIE, getAuthToken } from '@/lib/auth';

export async function POST() {
  const token = await getAuthToken();

  if (token) {
    try {
      await apiFetch('/logout', {
        method: 'POST',
        token,
      });
    } catch {
      // Ignore upstream logout failures and always clear local cookie.
    }
  }

  const response = NextResponse.json({ message: 'Logged out' });
  response.cookies.set(AUTH_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });

  return response;
}
