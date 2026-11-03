import { geminiTtsPrice, tutorTtsCatalog } from './tutorTts';

export const TUTOR_MODEL_OPTIONS = {
  transcription: [
    'browser-speech',
    'gpt-transcribe',
    'gpt-4o-transcribe',
    'gpt-4o-mini-transcribe',
    'whisper-1',
  ],
  transcriptionLanguage: [
    { value: '', label: 'auto / mixed' },
    { value: 'lv', label: 'Latvian hint' },
    { value: 'ru', label: 'Russian hint' },
  ],
  liveTranscription: ['gpt-live-transcribe', 'gpt-realtime-whisper'],
  voice: [
    'gpt-realtime-2.1',
    'gpt-realtime-2.1-mini',
    'gpt-realtime-2',
    'gpt-realtime-1.5',
    'gpt-realtime-translate',
  ],
  tutor: [
    'gpt-6.1-sol',
    'gpt-6.1-terra',
    'gpt-6-sol',
    'gpt-6-luna',
    'gpt-5.6-sol',
    'gpt-5.6-terra',
    'gpt-5.6-luna',
    'gpt-5.5',
    'gpt-5.4',
    'gpt-5.4-mini',
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4.1-nano',
    'o4-mini',
    'o3',
  ],
  tts: tutorTtsCatalog.models.map(model => model.id),
  voices: [
    'marin',
    'cedar',
    'alloy',
    'ash',
    'ballad',
    'coral',
    'echo',
    'fable',
    'onyx',
    'nova',
    'sage',
    'shimmer',
    'verse',
  ],
  legacyTtsVoices: ['alloy', 'ash', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer'],
  liveDelay: ['low', 'medium', 'high'],
  reasoningEffort: ['none', 'low', 'medium', 'high', 'xhigh', 'max'],
  ttsStartMode: ['first_sentence', 'full_reply'],
  tutorPipeline: ['realtime_voice', 'stt_text_tts'],
  contextSummary: ['on', 'off'],
  contextSummaryModel: ['gpt-6-luna', 'gpt-5.4-mini', 'same_as_tutor', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-5.6-luna'],
  embedding: ['text-embedding-3-large', 'text-embedding-3-small'],
} as const;

export const TUTOR_PRICE_USD = {
  transcriptionPerMinute: {
    'gpt-transcribe': 0.0045,
    'gpt-4o-transcribe': 0.006,
    'gpt-4o-mini-transcribe': 0.003,
    'whisper-1': 0.006,
  },
  liveTranscriptionPerMinute: {
    'gpt-live-transcribe': 0.017,
    'gpt-realtime-whisper': 0.017,
  },
  textPerMillionTokens: {
    'gpt-6.1-sol': { input: 2, cachedInput: 0.1, cacheWrite: 2.5, output: 10 },
    'gpt-6.1-terra': { input: 1, cachedInput: 0.05, cacheWrite: 1.25, output: 5 },
    'gpt-6-sol': { input: 2, cachedInput: 0.2, cacheWrite: 2.5, output: 10 },
    'gpt-6-luna': { input: 0.1, cachedInput: 0.01, cacheWrite: 0.125, output: 0.5 },
    'gpt-5.6-sol': { input: 4, cachedInput: 0.4, output: 20 },
    'gpt-5.6-terra': { input: 2, cachedInput: 0.2, output: 12 },
    'gpt-5.6-luna': { input: 0.2, cachedInput: 0.02, output: 1.2 },
    'gpt-5.5': { input: 5, cachedInput: 0.5, output: 30 },
    'gpt-5.4': { input: 2.5, cachedInput: 0.25, output: 15 },
    'gpt-5.4-mini': { input: 0.75, cachedInput: 0.075, output: 4.5 },
    'gpt-4.1': { input: 2, cachedInput: 0.5, output: 8 },
    'gpt-4.1-mini': { input: 0.4, cachedInput: 0.1, output: 1.6 },
    'gpt-4.1-nano': { input: 0.1, cachedInput: 0.025, output: 0.4 },
    'o4-mini': { input: 1.1, cachedInput: 0.275, output: 4.4 },
    'o3': { input: 2, cachedInput: 0.5, output: 8 },
  },
  ttsPerMillionTokens: {
    'gpt-4o-mini-tts': { input: 0.6, outputAudio: 12 },
    'gpt-4o-mini-tts-2025-12-15': { input: 0.6, outputAudio: 12 },
  },
  embeddingPerMillionTokens: {
    'text-embedding-3-small': { input: 0.02 },
    'text-embedding-3-large': { input: 0.13 },
  },
} as const;

export function resolveTutorWsUrl() {
  return process.env.NEXT_PUBLIC_TUTOR_WS_URL || 'ws://127.0.0.1:8788/ws';
}

export function tutorTtsPrice(model: string, now = Date.now()) {
  return model === 'gemini-3.8-flash-tts' || model === 'gemini-3.8-flash-lite-tts' ? geminiTtsPrice(now, model)
    : TUTOR_PRICE_USD.ttsPerMillionTokens[model as keyof typeof TUTOR_PRICE_USD.ttsPerMillionTokens];
}
