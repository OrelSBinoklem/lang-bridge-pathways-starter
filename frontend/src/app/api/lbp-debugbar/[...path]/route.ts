import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE } from '@/lib/auth';

const API_URL =
  process.env.LARAVEL_API_URL ?? process.env.NEXT_PUBLIC_LARAVEL_API_URL ?? 'http://127.0.0.1:8000/api';

const LARAVEL_URL = API_URL.replace(/\/api\/?$/, '');

async function proxyDebugbar(request: NextRequest, path: string[]) {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  const target = `${LARAVEL_URL}/_debugbar/${path.join('/')}${request.nextUrl.search}`;

  const headers: HeadersInit = {
    Accept: request.headers.get('accept') ?? '*/*',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: 'no-store',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const contentType = request.headers.get('content-type');
    if (contentType) headers['Content-Type'] = contentType;
    init.body = await request.text();
  }

  const response = await fetch(target, init);
  const body = await response.arrayBuffer();
  const outgoingHeaders = new Headers();
  const contentType = response.headers.get('content-type');

  if (contentType) outgoingHeaders.set('content-type', contentType);

  return new NextResponse(body, {
    status: response.status,
    headers: outgoingHeaders,
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxyDebugbar(request, path);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxyDebugbar(request, path);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxyDebugbar(request, path);
}
