import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('./grammarBlank.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { grammarBlankParts: split, grammarSelectWidth: width } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('inline blanks preserve Latvian text, spaces, punctuation and parenthesized hints', () => {
    assert.deepEqual(split('Vakar tu {{blank}} svarīgu pieredzi skolā. (gūt)'), { before: 'Vakar tu ', after: ' svarīgu pieredzi skolā. (gūt)' });
    assert.deepEqual(split('Pērn māsa ___ uz citu dzīvokli. (pārcelties)'), { before: 'Pērn māsa ', after: ' uz citu dzīvokli. (pārcelties)' });
    assert.deepEqual(split('{{blank}}!'), { before: '', after: '!' });
    assert.deepEqual(split('Es ____'), { before: 'Es ', after: '' });
});

test('instructions without a blank retain the separate control layout', () => {
    assert.equal(split('Izvēlies pareizo teikumu.'), null);
    assert.equal(split('a_b'), null);
    assert.equal(split(''), null);
});

test('select width is compact, based on all options and independent of the selected value', () => {
    assert.equal(width(), 9);
    assert.equal(width(['ir', 'bija']), 9);
    assert.equal(width(['pārcēlāmies', 'ir']), 16);
    assert.equal(width(['ir', 'pārcēlāmies']), 16);
    assert.equal(width(['a'.repeat(100)]), 24);
    assert.equal(width(['pa\u0304rce\u0304la\u0304mies']), width(['pārcēlāmies']));
});
