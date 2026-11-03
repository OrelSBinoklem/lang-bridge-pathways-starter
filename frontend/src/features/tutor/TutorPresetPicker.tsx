'use client';

import { useLocale } from 'next-intl';
import { estimatePreset, VISIBLE_PRESET_IDS, presetName, type TutorPresetData, type TutorPresetId } from './tutorPresets';
import styles from './tutor-presets.module.css';

export function TutorPresetPicker({ data, selected, onSelect, compact = false, disabled = false, plansLink = false }: {
  data: TutorPresetData | null; selected: TutorPresetId; onSelect: (id: TutorPresetId) => void; compact?: boolean; disabled?: boolean; plansLink?: boolean;
}) {
  const uk = useLocale() === 'uk';
  const t = (ru: string, ua: string) => uk ? ua : ru;
  const improved = (id: TutorPresetId, feature: string) => {
    const previousId = VISIBLE_PRESET_IDS[VISIBLE_PRESET_IDS.indexOf(id) - 1];
    if (!data || !previousId) return false;
    const current = data.presets[id].config, previous = data.presets[previousId].config;
    switch (feature) {
      case 'model': return (current.tutorModel.endsWith('-sol') || current.tutorModel === 'gpt-6.1-terra') && previous.tutorModel.endsWith('-luna');
      case 'recognition': return current.transcriptionModel !== 'browser-speech' && current.dualTranscriptionEnabled && !previous.dualTranscriptionEnabled;
      case 'speech': return current.ttsMode === 'api' && previous.ttsMode === 'api'
        && current.ttsModel === 'gemini-3.8-flash-tts' && previous.ttsModel === 'gemini-3.8-flash-lite-tts';
      case 'context': return ((current.contextMode === 'full' && previous.contextMode === 'basic')
        || (current.longMemoryEnabled && !previous.longMemoryEnabled))
        && !(current.contextMode === 'basic' && previous.contextMode === 'full')
        && !(!current.longMemoryEnabled && previous.longMemoryEnabled);
      default: return false;
    }
  };
  const description = (id: TutorPresetId) => {
    if (!data) return ['model', 'recognition', 'speech', 'context'].map(key => ({ key, text: '…' }));
    const c = data.presets[id].config;
    const modelName = c.tutorModel.replace('gpt-', 'GPT ').replace('-luna', ' Luna').replace('-sol', ' Sol').replace('-terra', ' Terra');
    const modelLabel = c.tutorModel === 'gpt-5.6-luna' || c.tutorModel === 'gpt-6-luna'
      ? `Робот ${modelName} (${t('Хороший', 'Хороший')})`
      : c.tutorModel === 'gpt-6-sol'
        ? t('Робот GPT 6 Sol (Крутой)', 'Робот GPT 6 Sol (Крутий)')
        : c.tutorModel === 'gpt-6.1-terra'
          ? t('Робот GPT 6.1 Terra (Крутой)', 'Робот GPT 6.1 Terra (Крутий)')
        : `Робот ${modelName}`;
    return [{ key: 'model', text: modelLabel },
      { key: 'recognition', text: c.transcriptionModel === 'browser-speech' ? t('Распознавание в браузере · бесплатно', 'Розпізнавання у браузері · безкоштовно')
        : t(`Распознавание: ${c.dualTranscriptionEnabled ? 'два потока' : 'один поток'}`, `Розпізнавання: ${c.dualTranscriptionEnabled ? 'два потоки' : 'один потік'}`) },
      { key: 'speech', text: c.ttsMode === 'browser' ? t('Бесплатный голос устройства, если доступен', 'Безкоштовний голос пристрою, якщо доступний')
        : c.ttsModel === 'gemini-3.8-flash-lite-tts' ? t('Потоковая озвучка · Flash-Lite', 'Потокове озвучення · Flash-Lite')
        : c.ttsModel === 'gemini-3.8-flash-tts' ? t('Потоковая озвучка · Flash', 'Потокове озвучення · Flash') : t('Потоковая озвучка', 'Потокове озвучення') },
      { key: 'context', text: [
        c.contextMode === 'basic' ? t('Короткий контекст · без подсветки таблиц', 'Короткий контекст · без підсвічування таблиць') : t('Полный контекст и интерактивные команды', 'Повний контекст та інтерактивні команди'),
        c.longMemoryEnabled ? t('поиск по прошлым диалогам', 'пошук у минулих діалогах') : t('без поиска по прошлым диалогам', 'без пошуку в минулих діалогах'),
      ].join(' · ') },
    ];
  };
  const credit = (id: TutorPresetId) => {
    const value = data ? estimatePreset(data.presets[id], data.commission_percent, undefined, id).credits : null;
    return value == null ? '…' : `≈ ${value.toLocaleString(uk ? 'uk-UA' : 'ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  const scenarioFields = [
    { key: 'dialogueActs', label: t('Реплики пользователя', 'Репліки користувача'), unit: t('за час', 'за годину'), common: t('реплик пользователя за час', 'реплік користувача за годину') },
    { key: 'audioMinutes', label: t('Ваша речь', 'Ваше мовлення'), unit: t('мин/час', 'хв/год'), common: t('минут вашей речи', 'хвилин вашого мовлення') },
    { key: 'ttsMinutes', label: t('Озвучка', 'Озвучення'), unit: t('мин/час', 'хв/год'), common: t('минут озвучки', 'хвилин озвучення') },
    { key: 'ttsWordsPerMinute', label: t('Скорость озвучки', 'Швидкість озвучення'), unit: t('слов/мин', 'слів/хв'), common: t('слов/мин', 'слів/хв') },
    { key: 'cacheHitPercent', label: t('Кеш', 'Кеш'), unit: '%', common: null },
  ];
  const commonScenario: string[] = [];
  const scenarioDifferences: { key: string; label: string; values: string[] }[] = [];
  if (!compact && data) for (const field of scenarioFields) {
    const groups = new Map<number, TutorPresetId[]>();
    for (const id of VISIBLE_PRESET_IDS) {
      const definition = data.presets[id];
      const value = field.key === 'memorySearchesPerHour' && !definition.config.longMemoryEnabled
        ? 0 : Number(definition.scenario[field.key]) || 0;
      groups.set(value, [...(groups.get(value) || []), id]);
    }
    const number = (value: number) => value.toLocaleString(uk ? 'uk-UA' : 'ru-RU');
    const withUnit = (value: number) => `${number(value)}${field.unit.startsWith('/') || field.unit === '%' ? '' : ' '}${field.unit}`;
    if (groups.size === 1) {
      const value = groups.keys().next().value!;
      commonScenario.push(field.common ? `${number(value)} ${field.common}` : `${field.label}: ${withUnit(value)}`);
    } else scenarioDifferences.push({ key: field.key, label: field.label, values: [...groups].map(([value, ids]) =>
      `${new Intl.ListFormat(uk ? 'uk' : 'ru', { type: 'conjunction' }).format(ids.map(id => `«${presetName(id, uk)}»`))} — ${withUnit(value)}`) });
  }
  return <div className={styles.root}>
    {compact ? <div className={styles.compact}><label className={styles.select}>{t('Режим', 'Режим')}<select aria-label={t('Режим расхода кредитов', 'Режим витрат кредитів')} value={selected} disabled={disabled || !data} onChange={event => onSelect(event.target.value as TutorPresetId)}>
      {VISIBLE_PRESET_IDS.map(id => <option key={id} value={id}>{presetName(id, uk)} · {credit(id)} {t('кр/час', 'кр/год')}</option>)}
    </select></label>{plansLink && <a className={styles.plansLink} href="/plans">{t('Подробнее о тарифах', 'Докладніше про тарифи')} <i className="pi pi-arrow-up-right" aria-hidden="true" /></a>}</div> : <div className={styles.cards}>{VISIBLE_PRESET_IDS.map(id => <section key={id} className={styles.card} data-preset={id} data-selected={id === selected || undefined} data-disabled={disabled || !data || undefined}>
      <h3>{presetName(id, uk)}</h3><strong>{credit(id)} <small>{t('кредитов/час', 'кредитів/год')}</small></strong>
      <ul>{description(id).map(line => {
        const better = improved(id, line.key);
        return <li key={line.key} data-feature={line.key} data-improved={better || undefined}
          className={better ? styles.improved : undefined}>
          {better && <span className={styles.srOnly}>{t('Улучшение: ', 'Покращення: ')}</span>}{line.text}
        </li>;
      })}</ul>
      <button type="button" disabled={disabled || !data} aria-pressed={id === selected}
        aria-label={id === selected ? t(`Выбран режим «${presetName(id)}»`, `Вибрано режим «${presetName(id, true)}»`) : t(`Выбрать режим «${presetName(id)}»`, `Вибрати режим «${presetName(id, true)}»`)}
        onClick={() => onSelect(id)}>{id === selected ? t('Выбран', 'Вибрано') : t('Выбрать', 'Вибрати')}</button>
      <p className={styles.commission} aria-hidden={id !== 'economy' || !data || undefined}>{id === 'economy' && data ? t(
        'Комиссия создателю сайта в 2 раза меньше.',
        'Комісія творцю сайту в 2 рази менша.',
      ) : null}</p>
    </section>)}</div>}
    {!compact && data && <details className={styles.note}><summary>{t('Как рассчитана цена и что можно настроить', 'Як розрахована ціна і що можна налаштувати')}</summary>
      {commonScenario.length > 0 && <p>{t('Для всех тарифов', 'Для всіх тарифів')}: {commonScenario.join(', ')}.</p>}
      {scenarioDifferences.map(row => <p key={row.key}><b>{row.label}:</b> {row.values.join('; ')}.</p>)}
    </details>}
  </div>;
}
