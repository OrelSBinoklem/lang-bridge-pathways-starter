import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../package.json', import.meta.url));
const ts = require('typescript');
export async function resolve(specifier, context, next) {
  try { return await next(specifier, context); } catch (error) {
    if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      for (const suffix of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
        try { return await next(specifier + suffix, context); } catch {}
      }
    }
    throw error;
  }
}
export async function load(url, context, next) {
  if (/\.tsx?$/.test(url)) return { format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(url), 'utf8'), { fileName: new URL(url).pathname, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText };
  return next(url, context);
}
