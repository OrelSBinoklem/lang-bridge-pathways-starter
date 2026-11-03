import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const compile = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText).toString('base64');

test('the first evening effect has a meaningful icon/name without changing its ID or scene', async () => {
  const catalog = compile(await readFile(new URL('./cinematic/catalog.ts', import.meta.url), 'utf8'));
  const source = (await readFile(new URL('../groupEffects.config.ts', import.meta.url), 'utf8'))
    .replace(/(['"])\.\/scenes\/cinematic\/catalog\1/, JSON.stringify(catalog));
  const { getGroupEffectVariants } = await import(compile(source));
  const variants = getGroupEffectVariants(1789);
  assert.equal(variants[0].id,'legacy-1789');
  assert.equal(variants[0].icon,'🌧️');
  assert.equal(variants[0].label.ru,'Вечерний город за стеклом');
  assert.equal(variants[0].effect.sceneId,'fogged-glass');
  assert.equal(variants[1].id,'fogged-blackheads');
});
