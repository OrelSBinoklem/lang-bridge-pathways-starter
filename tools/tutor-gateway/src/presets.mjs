import { readFileSync } from 'node:fs';

export const tutorPresets = JSON.parse(readFileSync(new URL('../../../frontend/src/config/tutor-presets.json', import.meta.url), 'utf8'));

// Apply before reasoning, transcription, compression or speech. Legacy/admin requests stay compatible.
export function resolvePresetConfig(config = {}, catalog = tutorPresets) {
  if (!config.preset) return config;
  if (typeof config.preset !== 'string' || !Object.hasOwn(catalog, config.preset)) throw new Error('Неизвестный режим репетитора. Выберите режим заново.');
  const preset = catalog[config.preset];
  const { playbackId } = config;
  const primaryTranscriptionLanguage = ['', 'lv', 'ru', 'uk', 'en'].includes(config.primaryTranscriptionLanguage) ? config.primaryTranscriptionLanguage : preset.primaryTranscriptionLanguage || '';
  return { secondaryTranscriptionModel: 'gpt-4o-transcribe', secondaryTranscriptionLanguage: 'lv',
    liveTranscriptionModel: '', contextSummaryModel: 'gpt-6-luna',
    ttsModel: 'gemini-3.8-flash-tts', ttsVoice: 'Enceladus', ttsStartMode: 'first_sentence',
    messageEmbeddingModel: 'text-embedding-3-large', summaryEmbeddingModel: 'text-embedding-3-large',
    ...preset, preset: config.preset, primaryTranscriptionLanguage, playbackId, humanAvatar: config.humanAvatar, tutorPipeline: 'stt_text_tts' };
}

export function basicTutorContext(context) {
  // Bound only raw history; retain the summary, important notes, page and current task.
  let budget = 12000;
  const recentContext = [];
  for (const line of (context.recentContext || []).slice(-12).reverse()) {
    const text = String(line).slice(-Math.min(2400, budget));
    if (budget <= 0) break;
    recentContext.unshift(text); budget -= text.length;
  }
  const journal = Array.isArray(context.messageStream) ? context.messageStream : null;
  const retained = new Set();
  let journalBudget = 12000;
  if (journal) for (const message of journal.filter(message => message.role !== 'system').slice(-12).reverse()) {
    const size = JSON.stringify(message).length;
    if (size > journalBudget) break;
    retained.add(message); journalBudget -= size;
  }
  // Preserve every pending state delta even when this preset limits raw dialogue;
  // otherwise the frozen snapshot could silently hide an older task change.
  const messageStream = journal ? journal.filter(message => message.role === 'system' || retained.has(message)) : null;
  return { ...context, recentContext, ...(journal ? { messageStream } : {}),
    recentToolInteractions: [] };
}

export function economyCommandAllowed(name) {
  return !['grammar.table.highlight', 'grammar.lesson.present', 'verb.form.highlight'].includes(name);
}

export const longMemoryCommand = name => ['memory.search_history', 'history.get_around_message'].includes(name);

export function resolveClientPresetConfig(config, canConfigure, catalog) {
  const selected = config.preset || (!canConfigure ? 'standard' : null);
  return selected ? resolvePresetConfig({ ...config, preset: selected }, catalog) : config;
}
