import defaults from '../../config/tutor-presets.json';
import scenarioDefaults from '../../config/tutor-scenario-defaults.json';
import { estimateDialogueCost, priceDialogueMemory } from './dialogueCost';
import { TUTOR_PRICE_USD, tutorTtsPrice } from './tutor-config';
import { estimateTtsVolume } from './ttsCostVolume';

export type TutorPresetId = keyof typeof defaults;
export const PRESET_IDS = Object.keys(defaults) as TutorPresetId[];
export const VISIBLE_PRESET_IDS: TutorPresetId[] = PRESET_IDS.filter(id => id !== 'uncompromising');
export const visiblePreset = (id: TutorPresetId): TutorPresetId => id === 'uncompromising' ? 'quality' : id;
export const isTutorPreset = (value: unknown): value is TutorPresetId => typeof value === 'string' && PRESET_IDS.includes(value as TutorPresetId);
export type PresetScenario = Record<string, string | number>;
export type TutorPresetConfig = ReturnType<typeof defaultPresetConfig>;
export type TutorPresetDefinition = { config: TutorPresetConfig; scenario: PresetScenario; loadedScenario: PresetScenario };
export type TutorPresetData = { presets: Record<TutorPresetId, TutorPresetDefinition>; commission_percent: number };

export function defaultPresetConfig(id: TutorPresetId) {
  return { primaryTranscriptionLanguage: '', secondaryTranscriptionModel: 'gpt-4o-transcribe', secondaryTranscriptionLanguage: 'lv',
    liveTranscriptionModel: '', voiceModel: 'gpt-realtime-2.1', tutorPipeline: 'stt_text_tts',
    contextSummaryModel: 'gpt-6-luna', messageEmbeddingModel: 'text-embedding-3-large', summaryEmbeddingModel: 'text-embedding-3-large',
    ttsModel: 'gemini-3.8-flash-tts', ttsVoice: 'Enceladus', ttsStartMode: 'first_sentence', liveDelay: 'medium', ...defaults[id] };
}

export function presetScenario(id: TutorPresetId, saved: PresetScenario = {}) {
  void id;
  return { audioMinutes: '12', liveAudioMinutes: '0', ttsWordsPerMinute: '150', ttsMinutes: '10', ...scenarioDefaults, ...saved };
}

export function normalizePresets(data: TutorPresetData): TutorPresetData {
  return { ...data, presets: PRESET_IDS.reduce((result, id) => { result[id] = {
    config: { ...defaultPresetConfig(id), ...data.presets[id].config },
    scenario: presetScenario(id, data.presets[id].scenario),
    loadedScenario: { ...presetScenario(id), dialogueActs: '60', callsPerAct: '1.5', cacheHitPercent: '50',
      fixedContextTokens: id === 'economy' ? '9000' : '12000', historyTokenLimit: id === 'economy' ? '3000' : '32000', userTokensPerAct: '120', outputTokensPerCall: '240',
      reasoningTokensPerCall: '1000', ...data.presets[id].loadedScenario },
  }; return result; }, {} as TutorPresetData['presets']) };
}

export function presetName(id: TutorPresetId, uk = false) {
  return { economy: uk ? 'Економ' : 'Эконом', standard: uk ? 'Простий' : 'Простой', quality: uk ? 'Якісний' : 'Качественный', uncompromising: uk ? 'Максимальний' : 'Максимальный' }[id];
}

export function presetCommissionPercent(id: TutorPresetId | undefined, basePercent: number) {
  // Match Laravel's integer basis points, rounding a half basis point upwards.
  return id === 'economy' ? Math.floor((Math.round(basePercent * 100) + 1) / 2) / 100 : basePercent;
}

export function estimatePreset(definition: TutorPresetDefinition, baseCommissionPercent: number, now = Date.now(), id?: TutorPresetId) {
  const commissionPercent = presetCommissionPercent(id, baseCommissionPercent);
  const c = definition.config, raw = definition.scenario;
  const n = (key: string) => Math.max(0, Number(raw[key]) || 0);
  const searches = c.longMemoryEnabled ? n('memorySearchesPerHour') : 0;
  const model = c.tutorModel as keyof typeof TUTOR_PRICE_USD.textPerMillionTokens;
  const summary = (c.contextSummaryModel === 'same_as_tutor' ? model : c.contextSummaryModel) as typeof model;
  const embedRate = TUTOR_PRICE_USD.embeddingPerMillionTokens[c.messageEmbeddingModel as keyof typeof TUTOR_PRICE_USD.embeddingPerMillionTokens]?.input;
  const dialogue = estimateDialogueCost({
    dialogueActs: n('dialogueActs'), callsPerAct: n('callsPerAct'),
    fixedContextTokens: n('fixedContextTokens') + (searches * n('memoryResultTokens') / Math.max(1, n('dialogueActs'))),
    initialHistoryTokens: n('initialHistoryTokens'), userTokensPerAct: n('userTokensPerAct'), outputTokensPerCall: n('outputTokensPerCall'),
    reasoningTokensPerCall: c.reasoningEnabled && c.reasoningEffort !== 'none' ? n('reasoningTokensPerCall') : 0,
    toolTokensPerCall: n('toolTokensPerCall'), cacheHitPercent: n('cacheHitPercent'), historyTokenLimit: n('historyTokenLimit'),
  }, model, TUTOR_PRICE_USD.textPerMillionTokens[model], { enabled: c.contextCompressionEnabled,
    retainedHistoryActs: n('retainedHistoryActs'), summaryBatchActs: n('summaryBatchActs'), summaryTokensPerRun: n('summaryTokensPerRun'), summaryReasoningTokensPerRun: 0 });
  const memory = priceDialogueMemory(dialogue, summary, TUTOR_PRICE_USD.textPerMillionTokens[summary], c.longMemoryEnabled ? embedRate : 0);
  const queryCost = searches * n('memoryQueryTokens') * (embedRate ?? 0) / 1e6;
  const browser = c.transcriptionModel === 'browser-speech';
  const sttRates = TUTOR_PRICE_USD.transcriptionPerMinute;
  const sttRate = sttRates[c.transcriptionModel as keyof typeof sttRates];
  const secondRate = sttRates[c.secondaryTranscriptionModel as keyof typeof sttRates];
  const speech = estimateTtsVolume(n('ttsWordsPerMinute'), n('ttsMinutes'), c.ttsModel);
  const ttsRate = tutorTtsPrice(c.ttsModel, now);
  const characterRate = c.ttsModel === 'tts-1' ? 15 : c.ttsModel === 'tts-1-hd' ? 30 : null;
  const tts = c.ttsMode === 'browser' ? 0 : ttsRate ? (speech.ttsInputTokens * ttsRate.input + speech.ttsAudioTokens * ttsRate.outputAudio) / 1e6
    : characterRate ? speech.words * 6 * characterRate / 1e6 : null;
  const recognition = browser ? 0 : typeof sttRate === 'number' && (!c.dualTranscriptionEnabled || typeof secondRate === 'number')
    ? n('audioMinutes') * (sttRate + (c.dualTranscriptionEnabled ? secondRate : 0)) : null;
  const api = memory.brainTotal == null || tts == null || recognition == null ? null : memory.brainTotal + queryCost + tts + recognition;
  return { credits: api == null || !Number.isFinite(baseCommissionPercent) || baseCommissionPercent < 0 || baseCommissionPercent >= 100 ? null : api / (1 - commissionPercent / 100), api,
    commissionPercent, dialogue, memory, queryCost, tts, recognition };
}
