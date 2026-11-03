import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE } from '@/lib/auth';

const API_URL =
  process.env.LARAVEL_API_URL ?? process.env.NEXT_PUBLIC_LARAVEL_API_URL ?? 'http://127.0.0.1:8000/api';

async function proxy(request: NextRequest, path: string[]) {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  const search = request.nextUrl.search;
  const target = `${API_URL}/${path.join('/')}${search}`;

  const headers: HeadersInit = {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: 'no-store',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const contentType = request.headers.get('content-type') ?? 'application/json';
    headers['Content-Type'] = contentType;
    init.body = await request.text();
  }

  const response = await fetch(target, init);
  const text = await response.text();
  const outgoingHeaders = new Headers({
    'Content-Type': response.headers.get('Content-Type') ?? 'application/json',
    'Cache-Control': 'private, no-store',
  });

  [
    'phpdebugbar-id',
    'phpdebugbar-link',
    'server-timing',
    'x-clockwork-id',
    'x-clockwork-version',
  ].forEach((header) => {
    const value = response.headers.get(header);
    if (value) outgoingHeaders.set(header, value);
  });

  return new NextResponse(text, {
    status: response.status,
    headers: outgoingHeaders,
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(request, path);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(request, path);
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(request, path);
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(request, path);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(request, path);
}
