import { NextResponse } from 'next/server';
import { ApiError, apiFetch, type AuthResponse } from '@/lib/api';
import { AUTH_COOKIE } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const data = await apiFetch<AuthResponse>('/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const response = NextResponse.json({ user: data.user });
    response.cookies.set(AUTH_COOKIE, data.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { message: error.message, errors: error.errors },
        { status: error.status },
      );
    }

    return NextResponse.json({ message: 'Unable to login' }, { status: 500 });
  }
}
