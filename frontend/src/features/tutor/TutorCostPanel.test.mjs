import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = await readFile(new URL('./TutorCostPanel.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
const compiledModule = { exports: {} };
new Function('require', 'module', 'exports', compiled)(
  name => name.endsWith('.css') ? new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) }) : require(name),
  compiledModule, compiledModule.exports,
);
const { TutorCostPanel } = compiledModule.exports;
const fields = ['audioMinutes', 'liveAudioMinutes', 'dialogueActs', 'callsPerAct', 'fixedContextTokens', 'initialHistoryTokens', 'userTokensPerAct', 'outputTokensPerCall', 'reasoningTokensPerCall', 'toolTokensPerCall', 'cacheHitPercent', 'historyTokenLimit', 'ttsWordsPerMinute', 'ttsMinutes', 'retainedHistoryActs', 'summaryBatchActs', 'summaryTokensPerRun', 'summaryReasoningTokensPerRun', 'memorySearchesPerHour', 'memoryQueryTokens', 'memoryResultTokens'];
const amounts = { stt: .054, stt2: .072, liveStt: null, text: .195, tts: .129, messageEmbeddings: .00156, summary: .0126, longMemory: 0, total: .46416 };
const props = { input: Object.fromEntries(fields.map((key, i) => [key, String(i + 1)])), onChange() {}, loadedInput: Object.fromEntries(fields.slice(2).filter(key => !key.startsWith('tts')).map(key => [key, '60'])), onLoadedChange() {}, estimate: { average: amounts, max: { ...amounts, total: 1.55429 } }, pipeline: true, live: false, dual: true, compression: true };
const render = overrides => renderToStaticMarkup(React.createElement(TutorCostPanel, { ...props, ...overrides }));

test('memory shares the LLM group and hourly calculations instead of independent token budgets', () => {
  const html = render();
  for (const title of ['Распознавание речи', 'Мозг — LLM', 'Озвучка', 'Индекс новых сообщений', 'Сжатие диалога']) assert.ok(html.includes(title));
  assert.ok(!html.includes('Память диалога'));
  assert.ok(!html.includes('Индекс резюме'));
  assert.ok(!html.includes('Вход сжатия, токенов/час'));
  assert.equal((html.match(/<h5 /g) || []).length, 3);
  assert.equal((html.match(/<input /g) || []).length, 23);
  assert.ok(html.includes('Параметры мозга'));
  assert.equal((html.match(/type="radio"/g) || []).length, 2);
  assert.equal((html.match(/<article /g) || []).length, 8);
  assert.equal((html.match(/aria-label="Подробнее:/g) || []).length, 30);
  assert.ok(html.includes('Первый вызов холодный'));
  assert.ok(html.includes('Актов диалога за час'));
  assert.ok(html.includes('Постоянный контекст, токенов'));
  assert.ok(!html.includes('Вход без кеша, токенов/час'));
  assert.ok(html.includes('не предел расходов'));
  assert.ok(html.includes('$0.4642'));
  assert.ok(!html.includes('$1.5543'));
  const cards = [...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)].map(match => match[1]);
  for (const card of cards) {
    const brain = ['Ответы бота', 'Индекс новых сообщений', 'Сжатие диалога', 'Поиск в долгой памяти'].some(label => card.includes(`<h6>${label}</h6>`));
    assert.equal(card.includes('Нагруженный:'), brain);
  }
  assert.ok(!html.includes('неполная оценка'));
  assert.ok(html.includes('Скорость речи, слов/мин'));
  assert.ok(html.includes('Озвучка, мин/час'));
  assert.ok(!html.includes('Текст озвучки, токенов/час'));
  assert.ok(!html.includes('Аудио озвучки, токенов/час'));
});

test('inactive steps differ from missing rates, and partial totals are explicit', () => {
  const missing = render({ estimate: { average: { ...amounts, text: null }, max: amounts } });
  assert.ok(missing.includes('Нет тарифа'));
  assert.ok(missing.includes('неполная оценка'));
  const inactive = render({ pipeline: false, compression: false });
  assert.equal((inactive.match(/disabled=""/g) || []).length, 21);
  assert.ok(inactive.includes('Выключено'));
  assert.ok(inactive.includes('неполная оценка'));
  assert.ok(!inactive.includes('Нет тарифа'));
});

test('derived hourly totals distinguish calls from context per call, and reasoning can be disabled', () => {
  const dialogue = {acts:30,calls:45,firstInputTokens:20000,lastInputTokens:30000,inputTokens:1125000,uncachedTokens:225000,cachedTokens:900000,cacheWriteTokens:0,visibleOutputTokens:10800,reasoningTokens:9000,noCacheCost:3.125,historyTrims:0,longContext:false};
  const html = render({estimate:{average:{...amounts,dialogue},max:amounts},reasoning:false});
  assert.ok(html.includes('30 актов · 45 вызовов модели за час'));
  assert.ok(html.includes('Вход на вызов: первый → последний'));
  assert.ok(html.includes('Весь вход за час'));
  assert.ok(html.includes('Без кеша / чтение / запись'));
  assert.ok(html.includes('Основная LLM без кеширования'));
  assert.equal((html.match(/disabled=""/g) || []).length,2);
});

test('browser recognition has a zero rate, no paid parallel recognizers, and explains separate bot costs', () => {
  const browser = {...amounts,stt:0,stt2:null,liveStt:null,total:amounts.total-amounts.stt-amounts.stt2};
  const html=render({browserRecognition:true,dual:false,live:false,estimate:{average:browser,max:browser}});
  assert.ok(html.includes('Распознавание в браузере'));
  assert.ok(html.includes('$0.0000'));
  assert.ok(html.includes('Ответы бота и озвучка оплачиваются отдельно'));
  assert.equal((html.match(/Выключено/g)||[]).length,2);
});
