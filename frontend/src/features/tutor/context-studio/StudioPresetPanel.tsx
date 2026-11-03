'use client';

import { useState } from 'react';
import { PRESET_IDS, type TutorPresetId } from '../tutorPresets';
import { PresetEditor } from './PresetEditor';
import { presetReasoning, resolvedPresetConfig, STUDIO_PRESET_NAMES } from './presetSettings';
import type { useStudioPresets } from './useStudioPresets';
import styles from './context-studio.module.css';

export function StudioPresetPanel({ presets, selected, select, locked }: { presets: ReturnType<typeof useStudioPresets>; selected: TutorPresetId; select: (id: TutorPresetId) => void; locked: boolean }) {
  const [editing, setEditing] = useState<TutorPresetId | null>(null);
  const { data, error, loading } = presets;
  return <section id="tutor-studio-presets" className={styles.presetPanel} aria-label="Глобальные тарифы и тариф теста">
    <div className={styles.presetPanelHeading}><div><h2>Глобальные параметры тарифов</h2><p>Карточки показывают сохранённые настройки. Выбор задаёт только тариф предпросмотра и теста; сохранение через «Настроить» изменяет глобальный тариф реального бота.</p></div><button type="button" disabled={loading} onClick={() => { void presets.refresh(); }} aria-label="Обновить настройки тарифов"><i className={`pi ${loading ? 'pi-spin pi-spinner' : 'pi-refresh'}`} aria-hidden /></button></div>
    {error && <p className={styles.error} role="alert">{error}{data && ' Показаны последние загруженные настройки; сервер теста использует текущие сохранённые значения.'}</p>}
    <div className={styles.presetCards} role="radiogroup" aria-label="Тариф учебного запуска">{PRESET_IDS.map(id => {
      const config = data ? resolvedPresetConfig(id, data) : null;
      return <article key={id} className={`${styles.presetCard} ${selected === id ? styles.presetCardSelected : ''}`}>
        <button type="button" className={styles.presetChoose} role="radio" aria-checked={selected === id} disabled={locked} aria-label={`Тариф теста: ${STUDIO_PRESET_NAMES[id]}`} onClick={() => select(id)}>
          <strong>{STUDIO_PRESET_NAMES[id]}{selected === id && <i className="pi pi-check-circle" aria-hidden />}</strong>
          {config ? <span className={styles.presetSummary}><span><small>Модель</small><b>{config.tutorModel}</b></span><span><small>Мышление</small><b>{presetReasoning(config)}</b></span><span><small>STT · {config.dualTranscriptionEnabled ? '2 потока' : '1 поток'}</small><b>{config.transcriptionModel}{config.dualTranscriptionEnabled ? ` + ${config.secondaryTranscriptionModel}` : ''}</b></span><span><small>TTS</small><b>{config.ttsMode === 'browser' ? 'Браузер' : `${config.ttsModel} · ${config.ttsVoice}`}</b></span></span> : <span>{loading ? 'Загружаем настройки…' : 'Настройки не загружены'}</span>}
        </button>
        <button type="button" className={styles.presetConfigure} disabled={!data || Boolean(editing && editing !== id)} onClick={() => setEditing(id)}>Настроить<span className={styles.srOnly}> тариф {STUDIO_PRESET_NAMES[id]}</span></button>
      </article>;
    })}</div>
    {editing && data && <PresetEditor key={editing} id={editing} data={data} save={presets.save} close={() => setEditing(null)} />}
  </section>;
}
