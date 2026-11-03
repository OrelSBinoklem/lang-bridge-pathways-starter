import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { apiFetch, type ApiUser } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'development') return new Response(null, { status: 404 });
  const url = new URL(request.url);
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || request.headers.get('origin') !== url.origin) return new Response(null, { status: 403 });
  const side = url.searchParams.get('side');
  if (side !== 'left' && side !== 'right' && side !== 'balloons') return new Response(null, { status: 400 });
  const token = await getAuthToken();
  if (!token) return new Response(null, { status: 401 });
  const { user } = await apiFetch<{ user: ApiUser }>('/user', { token });
  if (!user.is_admin) return new Response(null, { status: 403 });
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > 160_000_000) return new Response('Слишком большой файл', { status: 413 });
  const dir = path.resolve(process.cwd(), '../.tmp/carnival-video-20261022');
  await mkdir(dir, { recursive: true });
  const file = `${side}-${Date.now()}.${side === 'balloons' ? 'png' : 'h264'}`;
  await writeFile(path.join(dir, file), new Uint8Array(bytes), { flag: 'wx' });
  return new Response(file);
}
