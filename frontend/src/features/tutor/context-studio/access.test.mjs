import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load({ token, admin = false, unauthorized = false }) {
  const compiled = { exports: {} }; let lookups = 0;
  class ApiError extends Error { status = 401; }
  const code = ts.transpileModule(readFileSync(new URL('../../../app/tutor/context-studio/page.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'exports', code)(name => {
    if (name === 'next/navigation') return { redirect: path => { throw Error('redirect:'+path); }, notFound: () => { throw Error('not-found'); } };
    if (name === '@/lib/auth') return { getAuthToken: async () => token };
    if (name === '@/lib/api') return { ApiError, apiFetch: async () => { lookups++; if (unauthorized) throw new ApiError(); return { user: { id: 7, is_admin: admin } }; } };
    if (name.includes('/ContextStudio')) return { ContextStudio: () => null };
    return require(name);
  }, compiled.exports);
  return { page: (query = {}) => compiled.exports.default({ searchParams: Promise.resolve(query) }), lookups: () => lookups };
}
test('page checks administrator status on the server rather than hiding just the link', async () => {
  const guest = load({ token: null }); await assert.rejects(guest.page(), /redirect:\/login/); assert.equal(guest.lookups(), 0);
  await assert.rejects(load({ token: 'fixture', admin: false }).page(), /not-found/);
  await assert.rejects(load({ token: 'fixture', unauthorized: true }).page(), /redirect:\/login/);
  const element = await load({ token: 'fixture', admin: true }).page(); assert.equal(element.props.adminId, 7);
  assert.equal(element.props.initialScheme, '');
  assert.equal((await load({ token: 'fixture', admin: true }).page({ scheme: 'english_exams' })).props.initialScheme, 'english_exams');
  assert.equal((await load({ token: 'fixture', admin: true }).page({ scheme: 'unknown' })).props.initialScheme, '');
  const live = await load({ token: 'fixture', admin: true }).page({ live: '1', conversation: '123' });
  assert.equal(live.props.initialLive, true); assert.equal(live.props.initialConversation, 123);
  assert.equal((await load({ token: 'fixture', admin: true }).page({ conversation: '-1' })).props.initialConversation, null);
});
