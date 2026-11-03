import { defaultPresetConfig, presetName, type TutorPresetData, type TutorPresetId, type TutorPresetDefinition } from '../tutorPresets';
import { tutorTtsVoice } from '../tutorTts';
import reasoning from '@/config/tutor-reasoning.json';

export type PresetConfig = ReturnType<typeof defaultPresetConfig> & { maxOutputTokens: number };
export type PresetDraft = { id: TutorPresetId; config: PresetConfig; scenario: TutorPresetDefinition['scenario']; loadedScenario: TutorPresetDefinition['loadedScenario']; serverFingerprint: string };
export const STUDIO_PRESET_NAMES = { economy: presetName('economy'), standard: presetName('standard'), quality: presetName('quality'), uncompromising: presetName('uncompromising') };
export const presetDefinitionFingerprint = (value: TutorPresetDefinition) => JSON.stringify(value);
export function resolvedPresetConfig(id: TutorPresetId, data: TutorPresetData): PresetConfig {
  const merged = { ...defaultPresetConfig(id), ...data.presets[id].config };
  return { ...merged, maxOutputTokens: merged.maxOutputTokens ?? 8192 };
}
export function createPresetDraft(id: TutorPresetId, data: TutorPresetData): PresetDraft {
  const raw = data.presets[id];
  return { id, config: structuredClone(resolvedPresetConfig(id, data)), scenario: structuredClone(raw.scenario), loadedScenario: structuredClone(raw.loadedScenario), serverFingerprint: presetDefinitionFingerprint(raw) };
}
/** Scenarios belong to pricing; the studio must preserve their raw server representation. */
export function presetSavePayload(draft: PresetDraft) {
  return structuredClone({ config: draft.config, scenario: draft.scenario, loadedScenario: draft.loadedScenario });
}
export function presetDraftStale(draft: PresetDraft, data: TutorPresetData) {
  return draft.serverFingerprint !== presetDefinitionFingerprint(data.presets[draft.id]);
}
export function patchPresetConfig(config: PresetConfig, key: string, value: string | number | boolean): PresetConfig {
  const next = { ...config, [key]: value };
  if (key === 'tutorModel') {
    const efforts = (reasoning as Record<string, string[]>)[String(value)] ?? [];
    const enabled = efforts.length > 0 && (!efforts.includes('none') || config.reasoningEnabled && config.reasoningEffort !== 'none');
    next.reasoningEffort = enabled ? efforts.includes(config.reasoningEffort) && config.reasoningEffort !== 'none' ? config.reasoningEffort : efforts.find(effort => effort !== 'none') ?? 'none' : 'none';
    next.reasoningEnabled = enabled;
  }
  if (key === 'reasoningEffort') next.reasoningEnabled = value !== 'none';
  if (key === 'ttsModel') next.ttsVoice = tutorTtsVoice(String(value), config.ttsVoice);
  return next;
}
export function presetReasoning(config: PresetConfig): string {
  return config.reasoningEnabled ? config.reasoningEffort : 'none';
}
export function presetFailure(cause: unknown): string {
  const error = cause as { message?: string; errors?: Record<string, string[]> };
  return `${error?.message ?? 'Не удалось сохранить настройки'}${error?.errors ? ` · ${Object.values(error.errors).flat().join(' · ')}` : ''}`;
}
