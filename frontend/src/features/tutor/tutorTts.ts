import catalog from '../../config/tutor-tts.json';

export const tutorTtsCatalog = catalog;

export function tutorTtsModel(id: string) {
  return catalog.models.find(model => model.id === id) || catalog.models.find(model => model.id === catalog.defaultModel)!;
}

export function tutorTtsVoice(id: string, preferred?: string) {
  const model = tutorTtsModel(id);
  return preferred && model.voices.includes(preferred) ? preferred : model.defaultVoice;
}

export function tutorRequestConfig<T extends { ttsModel: string; ttsVoice: string; ttsStartMode: string }>(config: T, testMode: boolean) {
  return {
    ...(testMode ? config : {}),
    ttsModel: config.ttsModel,
    ttsVoice: tutorTtsVoice(config.ttsModel, config.ttsVoice),
    ttsStartMode: config.ttsStartMode,
  };
}

export function geminiTtsPrice(now = Date.now(), model = 'gemini-3.8-flash-tts') {
  const outputAudio = model === 'gemini-3.8-flash-lite-tts' ? 6 : 9;
  return now < Date.UTC(2027, 0, 1)
    ? { input: 0.5, outputAudio }
    : { input: 1, outputAudio: outputAudio * 2 };
}

export function tutorTtsPromotionNote(model: string, now = Date.now()) {
  if (!['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'].includes(model) || now >= Date.UTC(2027, 0, 1)) return null;
  const after = geminiTtsPrice(Date.UTC(2027, 0, 1), model);
  return `Акция до 31.12.2026. С 01.01.2027 за 1 млн токенов: текст — $${after.input}, звук — $${after.outputAudio}. Цена озвучки вырастет вдвое. Без комиссии сайта.`;
}

export function compactTutorEventForLog(raw: string) {
  try {
    const payload = JSON.parse(raw) as Record<string, unknown>;
    if (payload.type === 'tts.audio' || String(payload.type).startsWith('tts.stream.')) {
      const { audio, ...safe } = payload;
      return JSON.stringify({ ...safe, ...(typeof audio === 'string' ? { audio: `[base64 ${audio.length} chars]` } : {}) });
    }
    return raw.length > 4000 ? `${raw.slice(0, 4000)}... [truncated ${raw.length} chars]` : raw;
  } catch {
    // Malformed frames may contain partial audio; never log their raw bytes.
    return '[invalid tutor event]';
  }
}
