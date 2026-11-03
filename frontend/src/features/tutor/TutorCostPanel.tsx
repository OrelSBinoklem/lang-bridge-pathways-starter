'use client';

import { Tooltip } from 'primereact/tooltip';
import { useEffect, useId, useRef, useState } from 'react';
import type { DialogueCostInput, DialogueCostEstimate, DialogueMemoryInput } from './dialogueCost';
import styles from './tutor-cost-panel.module.css';

export type TutorLlmCostInput = Record<keyof DialogueCostInput | keyof DialogueMemoryInput | 'memorySearchesPerHour' | 'memoryQueryTokens' | 'memoryResultTokens', string>;
export type TutorCostInput = TutorLlmCostInput & {
  audioMinutes: string;
  liveAudioMinutes: string;
  ttsWordsPerMinute: string;
  ttsMinutes: string;
};

type CostKey = 'stt' | 'stt2' | 'liveStt' | 'text' | 'tts' | 'messageEmbeddings' | 'summary' | 'longMemory';
type Amounts = Record<CostKey, number | null> & { total: number; brainTotal?: number | null; dialogue?: DialogueCostEstimate };
type Props = {
  input: TutorCostInput;
  onChange: (key: keyof TutorCostInput, value: string) => void;
  loadedInput: TutorLlmCostInput;
  onLoadedChange: (key: keyof TutorLlmCostInput, value: string) => void;
  estimate: { average: Amounts; max: Amounts };
  pipeline: boolean;
  live: boolean;
  dual: boolean;
  compression: boolean;
  reasoning?: boolean;
  summaryReasoning?: boolean;
  browserRecognition?: boolean;
  browserVoice?: boolean;
  longMemory?: boolean;
};

type Field = { key: keyof TutorCostInput; label: string; help: string; enabled: boolean; min?: number; max?: number; step?: string };
type Part = { key: CostKey; label: string; help: string; enabled: boolean };

function money(value: number | null) {
  if (value == null) {
    return 'Нет тарифа';
  }

  if (value > 0 && value < 0.0001) {
    return '<$0.0001';
  }

  return `$${value.toFixed(4)}`;
}

export function TutorCostPanel({ input, onChange, loadedInput, onLoadedChange, estimate, pipeline, live, dual, compression, reasoning = true, summaryReasoning = true, browserRecognition = false, browserVoice = false, longMemory = true }: Props) {
  const id = useId().replace(/:/g, '');
  const [brainScenario, setBrainScenario] = useState<'average' | 'max'>('average');
  const brainEstimate = estimate[brainScenario];
  const brainInput = brainScenario === 'max' ? loadedInput : input;
  const tooltip = useRef<Tooltip>(null);
  useEffect(() => {
    tooltip.current?.updateTargetEvents();
  }, []);
  const groups: { key: string; label: string; icon: string; fields: Field[]; parts: Part[] }[] = [
    {
      key: 'recognition', label: 'Распознавание речи', icon: 'pi-microphone',
      fields: [
        { key: 'audioMinutes', label: 'Ваша речь, мин/час', enabled: pipeline && !browserRecognition,
          help: 'Сколько минут за час говорите вы. Если включены две модели распознавания, запись оплачивается у обеих.' },
        { key: 'liveAudioMinutes', label: 'Живое прослушивание, мин/час', enabled: pipeline && !browserRecognition,
          help: 'Сколько минут за час бот слушает вас в реальном времени. Если включено, оплачивается дополнительно к обычному распознаванию.' },
      ],
      parts: [
        { key: 'stt', label: browserRecognition ? 'Распознавание в браузере' : 'Основное распознавание', enabled: pipeline,
          help: browserRecognition ? `Речь распознаёт браузер, без списания кредитов за распознавание. ${browserVoice ? 'Ответы бота оплачиваются отдельно. Голос устройства бесплатный, если доступен.' : 'Ответы бота и озвучка оплачиваются отдельно.'}` : 'Переводит вашу речь в текст. Стоимость зависит от длительности записи и выбранной модели.' },
        { key: 'stt2', label: 'Второе распознавание', enabled: pipeline && dual && !browserRecognition,
          help: 'Распознаёт ту же запись второй моделью для сравнения. Оплачивается отдельно.' },
        { key: 'liveStt', label: 'Живое распознавание', enabled: live && !browserRecognition,
          help: 'Распознаёт речь прямо во время разговора. Стоимость зависит от минут прослушивания.' },
      ],
    },
    {
      key: 'brain', label: 'Мозг — LLM', icon: 'pi-sparkles',
      fields: [
        { key: 'dialogueActs', label: 'Актов диалога за час', enabled: pipeline, max: 1000,
          help: 'Один акт — ваше сообщение и ответ бота. Укажите, сколько таких обменов ожидаете за час.' },
        { key: 'callsPerAct', label: 'Вызовов модели на акт', enabled: pipeline, min: 1, max: 20, step: '0.1',
          help: '1 — один запрос на ответ. Работа с инструментами может потребовать больше: 30 актов × 1,5 = 45 запросов. Озвучка и сжатие считаются отдельно.' },
        { key: 'memorySearchesPerHour', label: 'Поисков в долгой памяти/час', enabled: pipeline && longMemory, max: 1000,
          help: 'Сколько раз за час бот ищет подробности в прошлых диалогах. Сами старые диалоги целиком в запрос не добавляются.' },
        { key: 'memoryQueryTokens', label: 'Запрос поиска, токенов', enabled: pipeline && longMemory,
          help: 'Длина поискового запроса: оплачивается его преобразование в вектор для поиска.' },
        { key: 'memoryResultTokens', label: 'Найденная память, токенов/поиск', enabled: pipeline && longMemory,
          help: 'Сколько найденных фрагментов передаётся модели. Их чтение включено в цену ответов бота. Дополнительные вызовы для инструментов задавайте выше.' },
        { key: 'fixedContextTokens', label: 'Постоянный контекст, токенов', enabled: pipeline,
          help: 'Инструкции бота, описание страницы и задания. Этот объём передаётся модели при каждом запросе, а не один раз за час.' },
        { key: 'initialHistoryTokens', label: 'История в начале, токенов', enabled: pipeline,
          help: 'Сколько переписки уже накопилось к началу часа. Новые сообщения будут постепенно увеличивать этот объём.' },
        { key: 'userTokensPerAct', label: 'Сообщение пользователя, токенов/акт', enabled: pipeline,
          help: 'Средняя длина одного вашего сообщения, включая распознанную речь.' },
        { key: 'outputTokensPerCall', label: 'Ответ модели, токенов/вызов', enabled: pipeline,
          help: 'Средняя длина ответа модели за один запрос. Скрытое рассуждение сюда не входит — оно задаётся отдельно.' },
        { key: 'reasoningTokensPerCall', label: 'Рассуждение, токенов/вызов', enabled: pipeline && reasoning,
          help: 'Сколько токенов модель тратит на обдумывание ответа. Они оплачиваются отдельно от текста. При выключенном мышлении расход равен нулю.' },
        { key: 'toolTokensPerCall', label: 'Результат инструментов, токенов', enabled: pipeline,
          help: 'Объём данных, которые инструменты возвращают боту перед дополнительным запросом. При одном запросе на акт не добавляется.' },
        { key: 'cacheHitPercent', label: 'Попадание повторного префикса в кеш, %', enabled: pipeline, max: 100,
          help: 'Какая часть уже переданного контекста повторно читается из кеша по сниженной цене. Первый вызов холодный, без кеша. У новых моделей запись кеша тоже может оплачиваться.' },
        { key: 'historyTokenLimit', label: 'Лимит истории без сжатия, токенов', enabled: pipeline && !compression,
          help: 'Сколько старой переписки оставлять, если сжатие выключено. 0 — без ограничения. При удалении старых сообщений кеш истории сбрасывается.' },
        { key: 'retainedHistoryActs', label: 'Оставлять последних актов', enabled: pipeline && compression, max: 1000,
          help: 'Сколько последних обменов хранить дословно. Более старые сообщения можно сжимать. 5 актов — это 10 сообщений.' },
        { key: 'summaryBatchActs', label: 'Актов в одной порции сжатия', enabled: pipeline && compression, min: 1, max: 1000,
          help: 'Сколько старых обменов накопить перед созданием краткого пересказа. 10 актов — это 20 сообщений. Число сжатий рассчитывается автоматически.' },
        { key: 'summaryTokensPerRun', label: 'Резюме, токенов/сжатие', enabled: pipeline && compression, min: 1,
          help: 'Ожидаемая длина краткого пересказа старой переписки. Он заменяет старое резюме и передаётся боту вместе с новыми сообщениями.' },
        { key: 'summaryReasoningTokensPerRun', label: 'Рассуждение, токенов/сжатие', enabled: pipeline && compression && summaryReasoning,
          help: 'Токены на обдумывание при создании пересказа. Если модель позволяет выключить мышление, бот его выключает и этот расход равен нулю.' },
      ],
      parts: [
        { key: 'longMemory', label: 'Поиск в долгой памяти', enabled: pipeline && longMemory,
          help: 'Цена векторных запросов поиска. Индексация сообщений считается отдельно, чтение найденного — в ответах бота. Резюме и важные заметки сохраняются независимо от поиска.' },
        { key: 'text', label: 'Ответы бота', enabled: pipeline,
          help: 'Расходы основной модели на чтение контекста, ответы и мышление. Поиск по памяти и сжатие переписки показаны отдельно.' },
        { key: 'messageEmbeddings', label: 'Индекс новых сообщений', enabled: pipeline && longMemory,
          help: 'Подготовка новых сообщений для поиска по памяти. Ваши реплики и ответы бота обрабатываются один раз. Расход зависит от их числа и длины.' },
        { key: 'summary', label: 'Сжатие диалога', enabled: pipeline && compression,
          help: 'Создание краткого пересказа старой переписки, чтобы бот помнил разговор с меньшим контекстом. Если сжатие не понадобилось, расход равен нулю.' },
      ],
    },
    {
      key: 'voice', label: 'Озвучка', icon: 'pi-volume-up',
      fields: [
        { key: 'ttsWordsPerMinute', label: 'Скорость речи, слов/мин', enabled: pipeline,
          help: 'Темп речи для оценки стоимости: 150 слов/мин × 10 минут = 1500 слов. Реальную скорость голоса это поле не меняет.' },
        { key: 'ttsMinutes', label: 'Озвучка, мин/час', enabled: pipeline,
          help: 'Сколько минут за час говорит бот: от 0 до 60. Например, 10 — это 10 минут озвучки за час занятия.' },
      ],
      parts: [
        { key: 'tts', label: browserVoice ? 'Голос устройства' : 'Голос бота', enabled: pipeline,
          help: browserVoice ? 'Бесплатная браузерная озвучка. Если нужного голоса на устройстве нет, соответствующий текст не озвучивается. Платного переключения нет.' : 'Примерная стоимость голоса по выбранной модели, темпу и минутам речи. Реальное списание считается по фактическому расходу сервиса.' },
      ],
    },
  ];
  const incomplete = !pipeline || groups.some(group => group.parts.some(part => part.enabled && estimate.average[part.key] == null));
  const helpClass = `tutor-cost-help-${id}`;
  const helpButton = (label: string, help: string) => <button type="button"
    className={`${styles.help} ${helpClass}`} data-pr-tooltip={help} aria-label={`Подробнее: ${label}`}
    aria-describedby={`${id}-tooltip`}
    onClick={event => event.currentTarget.focus()}><i className="pi pi-info-circle" aria-hidden="true" /></button>;

  return <section className={styles.panel} aria-label="Оценка расходов API за час">
    <Tooltip ref={tooltip} id={`${id}-tooltip`} target={`.${helpClass}`} event="both" position="top" closeOnEscape
      baseZIndex={5400}
      pt={{ root: { 'aria-hidden': false } }}
      autoHide={false} className={styles.tooltip} />
    <header className={styles.total}>
      <div><h4>Расход API за час</h4><span>Без комиссии сайта · {incomplete ? 'неполная оценка' : 'расчётный сценарий'}</span></div>
      <div className={styles.amount}><span>По заданным параметрам</span><strong>{money(estimate.average.total)}</strong></div>
      {helpButton('Итого за час', 'Общие расходы на распознавание, ответы, память и озвучку за час. Без комиссии сайта. Если какой-то тариф неизвестен, оценка неполная.')}
    </header>
    {groups.map(group => <section className={styles.group} key={group.key} aria-labelledby={`${id}-${group.key}`}>
      <h5 id={`${id}-${group.key}`}><i className={`pi ${group.icon}`} aria-hidden="true" />{group.label}</h5>
      {group.key === 'brain' && <>
        <p className={styles.explanation}>1 акт = сообщение пользователя + ответ бота. Контекст оплачивается заново на каждом вызове, включая чтение из кеша. «Нагруженный» — сценарий более интенсивного диалога, а не предел расходов; он относится только к модели и памяти.</p>
        <fieldset className={styles.scenarios}>
          <legend>Параметры мозга</legend>
          {(['average', 'max'] as const).map(scenario => <label key={scenario} data-active={brainScenario === scenario || undefined}>
            <input type="radio" name={`${id}-scenario`} value={scenario} checked={brainScenario === scenario} onChange={() => setBrainScenario(scenario)} />
            {scenario === 'average' ? 'Обычный' : 'Нагруженный'}
          </label>)}
        </fieldset>
        <p className={styles.explanation}>Ниже меняются только параметры выбранного сценария. Суммы обоих сценариев показаны в карточках; общий итог сверху использует обычный.</p>
      </>}
      <div className={styles.inputs}>{group.fields.map(field => <div key={field.key} className={`${styles.field} ${helpClass}`} data-pr-tooltip={field.help}>
        <div className={styles.fieldLabel}><label htmlFor={`${id}-${field.key}`}>{field.label}</label>{helpButton(field.label, field.help)}</div>
        <input id={`${id}-${field.key}`} value={group.key === 'brain' ? brainInput[field.key as keyof TutorLlmCostInput] : input[field.key]} inputMode={field.key.endsWith('Minutes') || field.step?.includes('.') ? 'decimal' : 'numeric'}
          type={group.key === 'brain' || group.key === 'voice' ? 'number' : undefined}
          min={field.min ?? (group.key === 'brain' || group.key === 'voice' ? 0 : undefined)}
          max={field.key === 'ttsMinutes' ? 60 : field.max} step={field.step ?? (field.key === 'ttsMinutes' ? '0.1' : '1')}
          disabled={!field.enabled} onChange={event => {
            const value = event.target.value;
            const max = field.key === 'ttsMinutes' ? 60 : field.max;
            const bounded = max != null && Number(value) > max ? String(max) : value;

            if (group.key === 'brain' && brainScenario === 'max') {
              onLoadedChange(field.key as keyof TutorLlmCostInput, bounded);
            } else {
              onChange(field.key, bounded);
            }
          }} />
      </div>)}</div>
      {group.key === 'brain' && pipeline && brainEstimate.dialogue && <div className={styles.dialogueSummary} aria-label="Расчёт LLM за час">
        <strong>{brainScenario === 'max' ? 'Нагруженный' : 'Обычный'}: {brainEstimate.dialogue.acts} актов · {brainEstimate.dialogue.calls} вызовов модели за час</strong>
        <dl>
          <div><dt>Вход на вызов: первый → последний</dt><dd>{Math.round(brainEstimate.dialogue.firstInputTokens).toLocaleString('ru-RU')} → {Math.round(brainEstimate.dialogue.lastInputTokens).toLocaleString('ru-RU')}</dd></div>
          <div><dt>Весь вход за час</dt><dd>{Math.round(brainEstimate.dialogue.inputTokens).toLocaleString('ru-RU')} токенов</dd></div>
          <div><dt>Без кеша / чтение / запись</dt><dd>{[brainEstimate.dialogue.uncachedTokens, brainEstimate.dialogue.cachedTokens, brainEstimate.dialogue.cacheWriteTokens].map(value => Math.round(value).toLocaleString('ru-RU')).join(' / ')}</dd></div>
          <div><dt>Ответы / рассуждение за час</dt><dd>{Math.round(brainEstimate.dialogue.visibleOutputTokens).toLocaleString('ru-RU')} / {Math.round(brainEstimate.dialogue.reasoningTokens).toLocaleString('ru-RU')}</dd></div>
          {brainEstimate.dialogue.memory && <>
            <div><dt>Индекс новых сообщений за час</dt><dd>{Math.round(longMemory ? brainEstimate.dialogue.memory.messageEmbeddingTokens : 0).toLocaleString('ru-RU')} токенов</dd></div>
            <div><dt>Сжатий за час</dt><dd>{brainEstimate.dialogue.memory.compressionCalls}</dd></div>
            <div><dt>Вход сжатия / резюме / рассуждение</dt><dd>{[brainEstimate.dialogue.memory.summaryInputTokens, brainEstimate.dialogue.memory.summaryOutputTokens, brainEstimate.dialogue.memory.summaryReasoningTokens].map(value => Math.round(value).toLocaleString('ru-RU')).join(' / ')}</dd></div>
          </>}
          {brainEstimate.brainTotal !== undefined && <div><dt>Модель и память за час</dt><dd><strong>{money(brainEstimate.brainTotal)}</strong></dd></div>}
        </dl>
        {brainEstimate.dialogue.noCacheCost != null && <small>Основная LLM без кеширования: {money(brainEstimate.dialogue.noCacheCost)}/час</small>}
        {brainEstimate.dialogue.historyTrims > 0 && <small>Сдвигов окна истории: {brainEstimate.dialogue.historyTrims}. Учтён сброс её кеша.</small>}
        {!reasoning && <small>Рассуждение выключено в настройках модели и не включено в расход.</small>}
        <small>Это сценарий, не измерение текущего чата. Индекс и сжатие рассчитаны по тем же актам; озвучка задаётся отдельно.</small>
        {brainEstimate.dialogue.longContext && <small role="status">Для такого размера вызова нужен тариф длинного контекста; стоимость LLM не включена в итог.</small>}
      </div>}
      <div className={styles.cards}>{group.parts.map(part => <article key={part.key}
        className={`${styles.card} ${helpClass}`} data-pr-tooltip={part.help} data-inactive={!part.enabled || undefined}>
        <div className={styles.cardLabel}><h6>{part.label}</h6>{helpButton(part.label, part.help)}</div>
        {group.key === 'brain' && part.enabled && <small>Обычный</small>}
        <b>{part.enabled ? money(estimate.average[part.key]) : 'Выключено'}</b>
        {group.key === 'brain' && part.enabled && <small>Нагруженный: {money(estimate.max[part.key])}</small>}
      </article>)}</div>
    </section>)}
  </section>;
}
