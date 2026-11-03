import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const compile = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText).toString('base64');
const catalog = compile(await readFile(new URL('./cinematic/catalog.ts', import.meta.url), 'utf8'));
const config = (await readFile(new URL('../groupEffects.config.ts', import.meta.url), 'utf8'))
  .replace(/(['"])\.\/scenes\/cinematic\/catalog\1/, JSON.stringify(catalog));
const { getGroupEffect } = await import(compile(config));
const effect = getGroupEffect({ categoryId: 1780, title: null });
const { BACKINGS } = await import(compile(await readFile(new URL('./gemsData.ts', import.meta.url), 'utf8')));

test('shopping gems open on rock backing at 1.5x scale on desktop and mobile', () => {
  assert.equal(effect.sceneId, 'gems');
  assert.equal(effect.bodyEffect.scene, 'gems');
  assert.equal(BACKINGS[effect.sceneParams.gmBacking], 'Порода');
  assert.ok(Math.abs(effect.sceneParams.gmCell / 1.4 - 1.5) < 1e-10);
  assert.ok(Math.abs(effect.sceneParams.gmCellMobile / 1.2 - 1.5) < 1e-10);
});

test('group overrides do not change the shared scene defaults or opt into ray tracing', async () => {
  const source = await readFile(new URL('./types.ts', import.meta.url), 'utf8');
  assert.match(source, /gmBacking: 0, gmTrace: 0, gmCell: 1\.4, gmCellMobile: 1\.2/);
  assert.equal(effect.sceneParams.gmTrace, undefined);
});
