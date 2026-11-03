import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const frontendOrigin = request.nextUrl.origin;

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=missing_token', frontendOrigin));
  }

  const response = NextResponse.redirect(new URL('/dashboard', frontendOrigin));
  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
