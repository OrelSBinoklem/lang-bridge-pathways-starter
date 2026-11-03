'use client';

import { useEffect, useState } from 'react';
import { clientApi } from '@/lib/client-api';
import reasoning from '@/config/tutor-reasoning.json';
import { LiveTracePanel } from './LiveTracePanel';
import { errorText } from './flowEditor';
import styles from './context-studio.module.css';

export const BOT_NAMES: Record<string, string> = { tutor: 'Главный репетитор', examiner: 'Экзаменатор', examiner_en: 'Английский экзаменатор', translation: 'Проверка перевода', reference: 'Справочник по латышскому', dialogue_summary: 'Сжатие диалога', daily_summary: 'Суточное резюме', exam_stt_primary: 'Экзамен · распознавание 1', exam_stt_secondary: 'Экзамен · распознавание 2', exam_stt_en_primary: 'Английский экзамен · распознавание 1', exam_stt_en_secondary: 'Английский экзамен · распознавание 2' };
type BotConfig = { model: string; reasoning: string; maxOutputTokens: number; prompts: string[] };
type Profile = { id: string; name: string; description: string; kind: string; config: BotConfig; defaults: BotConfig; revision: string; customized: boolean; variables: string[]; runtime: string; inheritedModel?: string; fixedInstructions?: string };
type Profiles = Record<string, Profile>;

export function BotProfilesPanel({ botId, adminId }: { botId: string; adminId: number }) {
  const [profiles, setProfiles] = useState<Profiles | null>(null), [error, setError] = useState('');
  const [retry, setRetry] = useState(0), [live, setLive] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void clientApi<{ data: Profiles }>('/tutor/flows/bots', { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) { setProfiles(result.data); setError(''); } })
      .catch(cause => { if (!controller.signal.aborted) setError(errorText(cause)); });
    return () => controller.abort();
  }, [retry]);
  const profile = profiles?.[botId];
  return <section className={styles.botPanel} aria-label={`Настройки: ${BOT_NAMES[botId]}`}>
    <nav className={styles.liveControls} aria-label="Настройки и история сервиса"><button type="button" aria-pressed={!live} onClick={() => setLive(false)}>Настройки и инструкции</button><button type="button" aria-pressed={live} onClick={() => setLive(true)}>Реальные запросы · история</button><button type="button" onClick={() => setRetry(value => value + 1)}>Обновить настройки</button></nav>
    {error && <p role="alert" className={styles.error}>{error}<button type="button" onClick={() => setRetry(value => value + 1)}>Повторить загрузку</button></p>}
    <div hidden={live}>{profiles && Object.values(profiles).map(item => <div key={item.id} hidden={item.id !== botId}><ProfileEditor profile={item} update={setProfiles} /></div>)}{!profile && botId !== 'tutor' && <p>{error ? 'Настройки не загружены.' : 'Загружаем реальные настройки сервиса…'}</p>}</div>
    {live && botId !== 'tutor' && <LiveTracePanel key={botId} botId={botId} botName={BOT_NAMES[botId]} adminId={adminId} initialConversation={null} />}
  </section>;
}

function ProfileEditor({ profile, update }: { profile: Profile; update: (profiles: Profiles) => void }) {
  const [draft, setDraft] = useState<BotConfig>(() => structuredClone(profile.config));
  const [revision, setRevision] = useState(profile.revision), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile.config);
  const modelChoices = profile.kind === 'stt' ? ['gpt-transcribe', 'gpt-4o-transcribe', 'gpt-4o-mini-transcribe', 'whisper-1'] : ['inherit', ...Object.keys(reasoning)];
  const efforts = draft.model === 'inherit' ? ['none', 'low', 'medium', 'high', 'xhigh', 'max'] : (reasoning as Record<string, string[]>)[draft.model] ?? [];
  const patch = (value: Partial<BotConfig>) => { setDraft(old => ({ ...old, ...value })); setNotice(''); };
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  async function save() {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await clientApi<{ data: Profiles }>(`/tutor/flows/bots/${profile.id}`, { method: 'PUT', body: JSON.stringify({ expected_revision: revision, config: draft }) });
      update(result.data); setRevision(result.data[profile.id].revision); setNotice('Сохранено. Новые запросы этого бота используют эти настройки.');
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }
  return <div className={styles.botEditor}>
    <div><h2>{profile.name}</h2><p>{profile.description}</p><small>{profile.runtime} · {profile.customized ? 'Сохранённые настройки администратора' : 'Исходные настройки сервиса'}</small></div>
    <p className={styles.hint}>Изменения применяются только после сохранения. Рубрики заданий, формат результата, ограничения инструментов и проверка баллов остаются в сервисе. История показывает фактические запросы, включая данные задания и дополнительные инструкции.</p>
    <fieldset disabled={busy}><legend>Запрос модели</legend><div className={styles.botFields}>
      <label>Модель<select aria-label="Модель сервиса" value={draft.model} onChange={event => { const model = event.target.value; const values = (reasoning as Record<string, string[]>)[model]; patch({ model, reasoning: draft.reasoning === 'inherit' || model === 'inherit' || values?.includes(draft.reasoning) ? draft.reasoning : values?.[0] ?? 'none' }); }}>
        {!modelChoices.includes(draft.model) && <option value={draft.model}>{draft.model}</option>}{modelChoices.map(model => <option key={model} value={model}>{model === 'inherit' ? `Из настроек вызова${profile.inheritedModel ? ` · ${profile.inheritedModel}` : ' / тарифа'}` : model}</option>)}</select></label>
      {profile.kind !== 'stt' && <><label>Мышление<select aria-label="Мышление сервиса" value={draft.reasoning} onChange={event => patch({ reasoning: event.target.value })}><option value="inherit">Из настроек вызова</option>{(efforts.length ? efforts : ['none']).map(value => <option key={value} value={value}>{value === 'none' ? 'Без мышления' : value}</option>)}</select></label><label>Лимит токенов ответа<input aria-label="Лимит ответа сервиса" type="number" min={0} max={16000} value={draft.maxOutputTokens} onChange={event => patch({ maxOutputTokens: Number(event.target.value) })} /><small>0 — оставить лимит вызова</small></label></>}
    </div>
    <h3>Инструкции</h3><p className={styles.hint}>Данные поступают отдельно: {profile.variables.join(' · ')}. Переменная {'{{level}}'} подставляет уровень задания, если он предусмотрен сервисом.</p>
    {draft.prompts.map((prompt, index) => <label className={styles.botPrompt} key={index}>Инструкция {index + 1}<textarea aria-label={`Инструкция ${index + 1}`} value={prompt} maxLength={16000} rows={Math.min(16, Math.max(4, Math.ceil(prompt.length / 110)))} onChange={event => patch({ prompts: draft.prompts.map((value, i) => i === index ? event.target.value : value) })} /></label>)}
    {profile.fixedInstructions && <details><summary>Дополнительные общие инструкции проверки · только просмотр</summary><p>Сервис дописывает их к первой инструкции перед запросом. Они задают работу с латышскими справочниками.</p><pre>{profile.fixedInstructions}</pre></details>}
    <div className={styles.liveControls}><button type="button" className={styles.primary} disabled={!dirty || revision !== profile.revision} onClick={() => void save()}>Сохранить настройки бота</button><button type="button" onClick={() => { setDraft(structuredClone(profile.config)); setRevision(profile.revision); setError(''); }}>Отменить изменения</button><button type="button" onClick={() => patch(structuredClone(profile.defaults))}>Подставить исходные настройки</button><span>{dirty ? 'Есть несохранённые изменения' : 'Изменений нет'}</span></div></fieldset>
    {revision !== profile.revision && <p role="alert" className={styles.error}>Настройки обновились на сервере. Черновик сохранён на экране; «Отменить изменения» загрузит свежие значения.</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status" className={styles.notice}>{notice}</p>}
  </div>;
}
