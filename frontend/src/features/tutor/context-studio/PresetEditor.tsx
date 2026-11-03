'use client';

import { useEffect, useRef, useState } from 'react';
import type { TutorPresetData, TutorPresetId } from '../tutorPresets';
import { TUTOR_MODEL_OPTIONS } from '../tutor-config';
import { tutorTtsModel } from '../tutorTts';
import reasoning from '@/config/tutor-reasoning.json';
import { createPresetDraft, patchPresetConfig, presetDraftStale, presetFailure, presetSavePayload, STUDIO_PRESET_NAMES, type PresetDraft } from './presetSettings';
import styles from './context-studio.module.css';

export function PresetEditor({ id, data, save, close }: { id: TutorPresetId; data: TutorPresetData; save: (draft: PresetDraft) => Promise<TutorPresetData>; close: () => void }) {
  const [draft, setDraft] = useState(() => createPresetDraft(id, data));
  const [baseline, setBaseline] = useState(() => JSON.stringify(presetSavePayload(createPresetDraft(id, data))));
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [confirmation, setConfirmation] = useState<'close' | 'reload' | null>(null);
  const heading = useRef<HTMLHeadingElement>(null), mounted = useRef(true);
  const dirty = JSON.stringify(presetSavePayload(draft)) !== baseline, stale = presetDraftStale(draft, data);
  const config = draft.config;
  const efforts = (reasoning as Record<string, string[]>)[config.tutorModel] ?? [];
  useEffect(() => { mounted.current = true; heading.current?.focus(); return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const patch = (key: string, value: string | boolean | number) => { setDraft(current => ({ ...current, config: patchPresetConfig(current.config, key, value) })); setNotice(''); };
  const select = (key: keyof typeof config, label: string, options: readonly string[], labels: Record<string, string> = {}, disabled = false) => {
    const value = key === 'reasoningEffort' && (!config.reasoningEnabled || !efforts.length) ? 'none' : String(config[key] ?? '');
    return <label className={styles.field}>{label}<select value={value} disabled={disabled} onChange={event => patch(key, event.target.value)}>{!options.includes(value) && <option value={value}>{value || 'Не задано'} · текущее значение</option>}{options.map(option => <option key={option} value={option}>{labels[option] ?? (option || 'Автоматически')}</option>)}</select></label>;
  };
  const check = (key: keyof typeof config, label: string) => <label className={styles.check}><input type="checkbox" checked={config[key] === true} onChange={event => patch(key, event.target.checked)} />{label}</label>;
  function reload() { const next = createPresetDraft(id, data); setDraft(next); setBaseline(JSON.stringify(presetSavePayload(next))); setError(''); setNotice('Загружены текущие серверные настройки.'); setConfirmation(null); }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || stale || !dirty) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await save(draft); if (!mounted.current) return;
      const next = createPresetDraft(id, result); setDraft(next); setBaseline(JSON.stringify(presetSavePayload(next)));
      setNotice('Глобальные настройки сохранены. Они применяются к следующим запросам бота; активация графа не нужна.');
    } catch (cause) { if (mounted.current) setError(presetFailure(cause)); }
    finally { if (mounted.current) setBusy(false); }
  }
  return <form className={styles.presetSettings} onSubmit={event => { void submit(event); }} aria-label={`Глобальные настройки: ${STUDIO_PRESET_NAMES[id]}`}>
    <div className={styles.presetSettingsHeader}><h3 tabIndex={-1} ref={heading}>{STUDIO_PRESET_NAMES[id]} · глобальные настройки</h3><button type="button" disabled={busy} onClick={() => dirty ? setConfirmation('close') : close()}>Закрыть</button></div>
    <p className={styles.presetWarning}>Сохранение сразу изменит реальный тариф для всех его пользователей в следующих запросах. Настройки сохраняются отдельно от версии схемы; активировать граф не требуется.</p>
    <p className={styles.hint}>{dirty ? 'Есть несохранённые изменения. Пока они не сохранены, тест и ссылки $tariff используют сохранённые настройки сервера.' : 'Показаны сохранённые настройки. Выбор тарифа для теста не меняет тариф аккаунта.'}</p>
    {stale && <div className={styles.error} role="alert">На сервере появились другие настройки этого тарифа. Ваш черновик сохранён на экране; загрузите текущие настройки перед сохранением.<button type="button" disabled={busy} onClick={() => dirty ? setConfirmation('reload') : reload()}>Загрузить текущие</button></div>}
    {confirmation && <div className={styles.presetDiscard} role="alertdialog" aria-label="Несохранённые настройки тарифа"><p>Отменить несохранённые изменения этого тарифа?</p><button type="button" onClick={() => setConfirmation(null)}>Продолжить редактирование</button><button type="button" onClick={() => confirmation === 'reload' ? reload() : close()}>Отменить изменения</button></div>}
    {error && <p className={styles.error} role="alert">{error}</p>}{notice && <p className={styles.notice} role="status">{notice}</p>}
    <fieldset disabled={busy} className={styles.presetFieldset}>
      <section><h4>Модель и мышление</h4><div className={styles.presetFields}>
        {select('tutorModel', 'Модель ответа', Object.keys(reasoning))}
        {select('reasoningEffort', 'Мышление', efforts.length ? efforts : ['none'], { none: 'Без мышления', low: 'Низкое', medium: 'Среднее', high: 'Высокое', xhigh: 'Очень высокое', max: 'Максимальное' }, !efforts.length)}
        <label className={styles.field}>Глобальный верхний предел токенов ответа<input type="number" required min={700} max={8192} step={1} value={config.maxOutputTokens || ''} onChange={event => patch('maxOutputTokens', Number(event.target.value))} /><small>700–8192</small></label>
      </div><p className={styles.hint}>Фактический предел — минимум из прежнего ограничения по мышлению (700 без мышления / 8192 с ним), глобального предела тарифа и предела узла графа. Значение 8192 сохраняет прежнее поведение.</p></section>
      <details open><summary>Распознавание речи · STT</summary><div className={styles.presetFields}>
        {select('transcriptionModel', 'Основная модель', TUTOR_MODEL_OPTIONS.transcription)}
        {select('primaryTranscriptionLanguage', 'Язык основного потока', ['', 'lv', 'ru', 'uk', 'en'], { lv: 'Латышский', ru: 'Русский', uk: 'Украинский', en: 'Английский' })}
        {check('dualTranscriptionEnabled', 'Два потока распознавания')}
        {select('secondaryTranscriptionModel', 'Модель второго потока', TUTOR_MODEL_OPTIONS.transcription.filter(model => model !== 'browser-speech'), {}, !config.dualTranscriptionEnabled)}
        {select('secondaryTranscriptionLanguage', 'Язык второго потока', ['', 'lv', 'ru'], { lv: 'Латышский', ru: 'Русский' }, !config.dualTranscriptionEnabled)}
      </div></details>
      <details open><summary>Озвучка · TTS</summary><div className={styles.presetFields}>
        {select('ttsMode', 'Режим озвучки', ['api', 'browser'], { api: 'Серверная модель', browser: 'Браузер' })}
        {select('ttsModel', 'Модель озвучки', TUTOR_MODEL_OPTIONS.tts, {}, config.ttsMode === 'browser')}
        {select('ttsVoice', 'Голос выбранной модели', tutorTtsModel(config.ttsModel).voices, {}, config.ttsMode === 'browser')}
        {select('ttsStartMode', 'Начало озвучки', TUTOR_MODEL_OPTIONS.ttsStartMode, { first_sentence: 'После первого предложения', full_reply: 'После полного ответа' })}
      </div><p className={styles.hint}>Голоса берутся из каталога выбранной модели. В тесте конструктора озвучка не запускается.</p></details>
      <details><summary>Контекст, сжатие и память</summary><div className={styles.presetFields}>
        {select('contextMode', 'Контекст', ['basic', 'full'], { basic: 'Базовый', full: 'Полный' })}
        {check('contextCompressionEnabled', 'Сжимать старую переписку')}{check('longMemoryEnabled', 'Долговременная память')}
        {select('contextSummaryModel', 'Модель резюме', ['same_as_tutor', ...Object.keys(reasoning)], { same_as_tutor: 'Как модель ответа' })}
        {select('messageEmbeddingModel', 'Эмбеддинги сообщений', TUTOR_MODEL_OPTIONS.embedding)}
        {select('summaryEmbeddingModel', 'Эмбеддинги резюме', TUTOR_MODEL_OPTIONS.embedding)}
      </div></details>
    </fieldset>
    <div className={styles.presetSettingsFooter}><span>{dirty ? 'Черновик · не сохранено' : 'Сохранённая конфигурация'}</span><button type="submit" className={styles.primary} disabled={busy || stale || !dirty}>{busy ? 'Сохраняем…' : 'Сохранить глобальные настройки'}</button></div>
  </form>;
}
