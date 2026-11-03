import { resolve } from 'node:path';
import { apiFetch as serverApi, ApiError, type ApiUser } from '@/lib/api';
import { getAuthToken } from '@/lib/auth';
import { findSourceHandler, handlerSourceDocument, sourceDocument, SOURCE_HEADERS } from './sourceViewer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Auth precedes even metadata lookup/filesystem access. All responses are private. */
export async function GET(request: Request) {
  const reply = (body: string, status = 200) => new Response(body, { status, headers: SOURCE_HEADERS });
  const token = await getAuthToken();
  if (!token) return reply(sourceDocument('Вход', '<h1>Требуется вход</h1><a href="/login">Войти</a>'), 401);
  let user: ApiUser;
  try { ({ user } = await serverApi<{ user: ApiUser }>('/user', { token })); }
  catch (error) {
    if (error instanceof ApiError && [401, 403].includes(error.status)) return reply(sourceDocument('Нет доступа', '<h1>Нет доступа</h1>'), error.status);
    console.error('[handler-source] Authorization unavailable', error instanceof ApiError ? { status: error.status } : { name: error instanceof Error ? error.name : 'Error' });
    return reply(sourceDocument('Проверка доступа недоступна', '<h1>Не удалось проверить доступ</h1>'), 503);
  }
  if (!user.is_admin) return reply(sourceDocument('Не найдено', '<h1>Не найдено</h1>'), 404);
  const query = new URL(request.url).searchParams;
  const id = query.get('handler');
  if (!id || query.getAll('handler').length !== 1 || !findSourceHandler(id)) return reply(sourceDocument('Не найдено', '<h1>Обработчик не найден</h1>'), 404);
  try {
    // Next is started in frontend/, alongside the repository's resources/tools.
    return reply(await handlerSourceDocument(id, resolve(/* turbopackIgnore: true */ process.cwd(), '..')));
  } catch (error) {
    console.error('[handler-source] Allowlisted source unavailable', { handler: id, code: error && typeof error === 'object' && 'code' in error ? String(error.code) : error instanceof Error ? error.message : 'Error' });
    return reply(sourceDocument('Исходник недоступен', '<h1>Исходник недоступен</h1><p>Проверьте наличие исходников обработчика на сервере.</p>'), 503);
  }
}
