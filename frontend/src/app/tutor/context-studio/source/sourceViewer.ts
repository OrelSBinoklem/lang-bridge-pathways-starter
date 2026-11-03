import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import handlers from '../../../../../../resources/tutor-flow/command-handlers.json';

export const SOURCE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Content-Type': 'text/html; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
};
const escape = (text: string) => text.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
const style = 'body{font:16px system-ui;margin:0;padding:24px;color:#172337;background:#f4f6fa}main{max-width:1400px;margin:auto}a{color:#2455a6}pre{overflow:auto;max-height:70vh;background:#fff;border:1px solid #bcc8d8;padding:20px;font:13px/1.6 monospace;tab-size:2}code,p{overflow-wrap:anywhere}section{margin-block:28px}@media(prefers-color-scheme:dark){body{background:#151b27;color:#e3e9f3}pre{background:#202938;border-color:#4b5d79}a{color:#9bbfff}}';
export function sourceDocument(title: string, body: string) {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>${style}</style></head><body><main>${body}</main></body></html>`;
}
export const findSourceHandler = (id: string) => handlers.find(item => item.id === id);

/** Only the selected metadata entry's two code files can be read. No request path
 * is ever resolved. Reject symlinks and oversized files instead of truncating. */
export async function handlerSourceDocument(id: string, repositoryRoot: string) {
  const handler = findSourceHandler(id);
  if (!handler) throw new Error('Unknown handler');
  // These allowlisted repository sources are deployed alongside Next. Do not
  // trace a dynamic filesystem root into .next (which would include the repo).
  const root = await realpath(/* turbopackIgnore: true */ repositoryRoot);
  const sections = await Promise.all([...new Set([handler.sourceFile, handler.contractFile])].map(async file => {
    const expected = resolve(/* turbopackIgnore: true */ root, file), actual = await realpath(/* turbopackIgnore: true */ expected), path = relative(root, actual);
    if (actual !== expected || isAbsolute(path) || path.startsWith('..')) throw new Error('Source path denied');
    if ((await stat(/* turbopackIgnore: true */ actual)).size > 524288) throw new Error('Source file is too large');
    const code = await readFile(/* turbopackIgnore: true */ actual, 'utf8');
    return `<section><h2>${file === handler.sourceFile ? 'TypeScript · обработчик' : 'TypeScript · контракт'}</h2><p><code>${escape(file)}</code></p><pre tabindex="0" aria-label="Исходный код только для чтения"><code>${escape(code)}</code></pre></section>`;
  }));
  return sourceDocument(handler.label, `<a href="/tutor/context-studio">← Конструктор схем</a><h1>${escape(handler.label)}</h1><p>Только для чтения · администратор</p><p>${escape(handler.description)}</p><p>Команды: <code>${escape(handler.commands.join(', '))}</code></p><h2>Путь выполнения</h2><ol>${handler.executionPath.map(path => `<li><code>${escape(path)}</code></li>`).join('')}</ol>${sections.join('')}`);
}
