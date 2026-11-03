import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const compileUrl = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText).toString('base64')}`;
const helpersUrl = compileUrl(await readFile(new URL('../training/helpers.ts', import.meta.url), 'utf8'));
const modelSource = (await readFile(new URL('./model.ts', import.meta.url), 'utf8'))
  .replace("import topicArt from './topic-art.json';", `const topicArt = ${await readFile(new URL('./topic-art.json', import.meta.url), 'utf8')};`)
  .replace("from '@/features/training/helpers'", `from '${helpersUrl}'`);
const { buildCategoryGroups, filterCategoryGroups } = await import(compileUrl(modelSource));
const { getCategoryProgress, collectDescendantIds } = await import(helpersUrl);

const node = (id, name, order, children = [], translations = undefined) => ({
  id, name, order, parent_id: null, children, name_translations: translations,
});
const word = (id, category_ids) => ({ id, word: `word-${id}`, translation_1: `слово-${id}`, category_ids });
const row = (dict_word_id, correct_attempts, correct_attempts_revert) => ({
  dict_word_id, correct_attempts, correct_attempts_revert, attempts: 0, attempts_revert: 0,
});
const artwork = { 'моя семья': '/family.webp', 'еще покупки': '/shopping.webp' };

test('rounding cannot award completion while one direction remains unfinished', () => {
  const data = {
    dictionary: { id: 20 }, nodes: [node(1, 'A1', 1, [node(2, '1. Тема', 1)])],
    words: Array.from({ length: 200 }, (_, i) => word(i + 1, [2])),
    progress: Array.from({ length: 200 }, (_, i) => row(i + 1, 2, i === 199 ? 0 : 2)),
  };
  const [group] = buildCategoryGroups(data, 'ru', {});
  assert.equal(group.percent, 99);
  assert.equal(group.items[0].percent, 99);
});

function fixture() {
  return {
    dictionary: { id: 20, name: 'Авторский', lang: 'ru', learn_lang: 'lv', words: 6 },
    nodes: [
      node(20, 'Тематический B1', 2, [node(21, '1. Rīga: cilvēki', 1)]),
      node(10, 'Тематический A1', 1, [
        node(12, '5. Ещё покупки', 2, [], { uk: '   ' }),
        node(11, '2. Моя семья', 1, [node(111, 'Родственные связи', 1)], { uk: '2. Моя родина' }),
      ], { uk: 'Тематичний A1' }),
    ],
    words: [
      word(1, [11, 111]),
      word(2, [111]),
      word(1, [11, 111]), // A repeated API row must not count twice.
      word(3, [12]),
      word(4, [10]), // A word directly on the group belongs to its total too.
      word(5, [21]),
      word(6, [999]), // Another tree must not leak into this group's statistics.
    ],
    progress: [row(1, 2, 0), row(2, 1, 2), row(3, 2, 2), row(4, 2, 0)],
  };
}

test('group statistics count unique descendant words and use canonical directional learning rules', () => {
  const data = fixture();
  const groups = buildCategoryGroups(data, 'ru', artwork);
  const group = groups.find(item => item.id === 10);
  const category = group.items.find(item => item.id === 11);
  const source = data.nodes.find(item => item.id === 10);
  const progress = Object.fromEntries(data.progress.map(item => [item.dict_word_id, item]));
  const canonical = getCategoryProgress(data.words, progress, source.id, collectDescendantIds(source));

  assert.deepEqual(groups.map(item => item.id), [10, 20], 'The server-defined order wins over source array order');
  assert.deepEqual(group.items.map(item => item.id), [11, 12]);
  assert.deepEqual(canonical, { total: 8, learned: 5, progress: 5 / 8 });
  assert.equal(group.wordCount, 4);
  assert.equal(group.percent, Math.round(canonical.progress * 100));
  assert.equal(category.wordCount, 2, 'Shared memberships and repeated rows do not duplicate words');
  assert.equal(category.percent, 50, 'One successful direction is only half learned; one point is below the threshold');
  assert.equal(group.items.find(item => item.id === 12).percent, 100);
});

test('search preserves original numbers, category links and full-group statistics without mutating data', () => {
  const data = fixture();
  const original = structuredClone(data);
  const groups = buildCategoryGroups(data, 'ru', artwork);
  const beforeFilter = structuredClone(groups);
  const filtered = filterCategoryGroups(groups, 'покупки', 'A1');

  assert.equal(filtered.length, 1);
  assert.deepEqual(filtered[0].items.map(item => item.id), [12]);
  assert.equal(filtered[0].items[0].number, '5', 'A filtered fifth category must not become the first category');
  assert.equal(filtered[0].items[0].href, '/dictionaries/20/category/12');
  assert.equal(filtered[0].wordCount, 4);
  assert.equal(filtered[0].percent, 63, 'Filtering must not replace group progress with the visible item percentage');
  assert.deepEqual(groups, beforeFilter);
  assert.deepEqual(data, original);
});

test('localized labels and search work together while art uses the original category identity', () => {
  const groups = buildCategoryGroups(fixture(), 'uk', artwork);
  const group = groups[0];
  const localized = filterCategoryGroups(groups, 'РОДИНА a1', '');

  assert.equal(group.title, 'Тематичний A1');
  assert.equal(group.description, 'Перші розмови');
  assert.equal(localized[0].items[0].title, '2. Моя родина');
  assert.equal(localized[0].items[0].label, 'Моя родина');
  assert.equal(localized[0].items[0].number, '2');
  assert.equal(localized[0].items[0].art, '/family.webp');
  assert.equal(group.items.find(item => item.id === 12).title, '5. Ещё покупки', 'A blank translation falls back to the existing title');
  assert.equal(filterCategoryGroups(groups, 'еще ПОКУПКИ', '')[0].items[0].id, 12);
  assert.equal(filterCategoryGroups(groups, 'cilveki RIGA', '')[0].items[0].id, 21, 'Latvian diacritics and token order should not block search');
});

test('unavailable progress remains unknown, distinct from a loaded empty progress record', () => {
  const data = fixture();
  const unavailable = buildCategoryGroups({ ...data, progress: null }, 'ru', artwork);
  const empty = buildCategoryGroups({ ...data, progress: [] }, 'ru', artwork);

  assert.ok(unavailable.every(group => group.percent === null && group.items.every(item => item.percent === null)));
  assert.ok(empty.every(group => group.percent === 0 && group.items.every(item => item.percent === 0)));
  assert.equal(unavailable[0].wordCount, 4, 'Counts remain available when user progress fails to load');
  assert.equal(filterCategoryGroups(unavailable, 'покупки', 'A1')[0].percent, null);
});

test('a mixed A1–B2 collection keeps its full title instead of becoming an A1 shelf', () => {
  const names = ['Важные слова A1–B2', 'Важливі слова A1-B2', 'Важные слова A1 — B2'];
  const groups = buildCategoryGroups({ dictionary: { id: 39 }, progress: [], words: [],
    nodes: names.map((name, index) => node(index + 1, name, index, [node(100 + index, 'Союзы', 0)])) }, 'ru', {});
  assert.deepEqual(groups.map(group => group.title), names);
  assert.deepEqual(groups.map(group => group.level), ['', '', '']);
  assert.deepEqual(groups.map(group => group.description), names);
});

test('level and text filters combine, retain order, and return no unrelated categories', () => {
  const groups = buildCategoryGroups(fixture(), 'ru', artwork);
  assert.deepEqual(filterCategoryGroups(groups, '', 'B1').map(item => item.id), [20]);
  assert.deepEqual(filterCategoryGroups(groups, 'семья', 'B1'), []);
  assert.deepEqual(filterCategoryGroups(groups, 'нет такой категории', ''), []);
  assert.deepEqual(filterCategoryGroups(groups, '   ', ''), groups);
  assert.deepEqual(filterCategoryGroups(groups, 'A1', '').flatMap(group => group.items.map(item => item.id)), [11, 12]);
});

test('supplementary collections keep real names, useful art and original unnumbered category links', () => {
  const data = {
    dictionary: { id: 21, name: 'Авторский (дополнительно)', lang: 'ru', learn_lang: 'lv', words: 3 },
    nodes: [node(1, 'Важные слова!', 1, [node(2, 'Местоимения', 1)]),
      node(3, 'Глаголы', 2, [node(4, 'Тренировка спряжений', 1)]),
      node(5, 'Из справочника B2', 3, [node(6, 'Наречия', 1)])],
    words: [word(1, [2]), word(2, [4]), word(3, [6])], progress: [row(1, 2, 2)],
  };
  const groups = buildCategoryGroups(data, 'ru', {});
  assert.deepEqual(groups.map(group => group.title), ['Важные слова!', 'Глаголы', 'Из справочника B2']);
  assert.deepEqual(groups.map(group => group.description), groups.map(group => group.title));
  assert.deepEqual(groups.map(group => group.level), ['', '', 'B2']);
  assert.ok(groups.every(group => group.art === '/course/categories/transparent/1774-light.webp'));
  assert.equal(groups[0].items[0].number, '');
  assert.equal(groups[1].items[0].href, '/dictionaries/21/category/4');
  assert.equal(groups[0].percent, 100);
  const themed = buildCategoryGroups(data, 'ru', { 'важные слова': '/essentials.webp' });
  assert.equal(themed[0].art, '/essentials.webp', 'A collection’s own illustration takes precedence over a generic book');
});

test('all thematic English categories across A1–B2 receive existing artwork without changing category identity', async () => {
  const topics = JSON.parse(await readFile(new URL('./topic-art.json', import.meta.url), 'utf8'));
  const nodes = Object.keys(topics).map((name, index) => node(index + 1, name, index));
  const groups = buildCategoryGroups({ dictionary: { id: 31 }, words: [], progress: null,
    nodes: ['A1', 'A2', 'B1', 'B2'].map((level, index) => node(100 + index, level, index, nodes)) }, 'ru', {});
  assert.ok(Object.keys(topics).length >= 22);
  assert.equal(groups.flatMap(group => group.items).length, Object.keys(topics).length * 4);
  for (const item of groups.flatMap(group => group.items)) {
    assert(item.art, item.title);
    await readFile(new URL(`../../../public${item.art}`, import.meta.url));
    if (item.art.endsWith('-light.webp')) await readFile(new URL(`../../../public${item.art.replace('-light.webp', '-dark.webp')}`, import.meta.url));
    assert.equal(item.percent, null);
    assert.equal(item.href, `/dictionaries/31/category/${item.id}`);
  }
});

test('compact English topics retain their artwork and links when their labels are translated', async () => {
  const taxonomy = JSON.parse(await readFile(new URL('../../../../resources/dictionaries/english-compact/taxonomy.json', import.meta.url), 'utf8'));
  let nextId = 1;
  const nodes = ['A1', 'A2', 'B1', 'B2'].map((level, index) => node(1000 + index, level, index,
    taxonomy.levels[level].map((topic, order) => node(nextId++, topic.name, order, [], { uk: topic.name_uk }))));
  const data = { dictionary: { id: 38 }, words: [], progress: [], nodes };
  const ru = buildCategoryGroups(data, 'ru', {});
  const uk = buildCategoryGroups(data, 'uk', {});
  const ruItems = ru.flatMap(group => group.items);
  const ukItems = uk.flatMap(group => group.items);
  assert.equal(ruItems.length, 34);
  for (const [index, item] of ruItems.entries()) {
    assert.ok(item.art, item.title);
    assert.equal(ukItems[index].art, item.art);
    assert.notEqual(ukItems[index].title, item.title);
    assert.equal(ukItems[index].href, item.href);
    assert.equal(item.href, `/dictionaries/38/category/${item.id}`);
    assert.equal(item.percent, 0);
  }
});
