import { readFileSync } from 'node:fs';

export const ttsCatalog = JSON.parse(readFileSync(new URL('../../../../frontend/src/config/tutor-tts.json', import.meta.url), 'utf8'));

export function resolveTtsConfig(config = {}, env = process.env) {
  // Older clients without a TTS selection retain their existing server configuration.
  const model = config.ttsModel || env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
  const profile = ttsCatalog.models.find(item => item.id === model);
  if (!profile) throw new Error('Unsupported tutor speech model.');
  const requestedVoice = config.ttsVoice || (profile.provider === 'google' ? env.GOOGLE_TTS_VOICE : env.OPENAI_TTS_VOICE);
  return { model, provider: profile.provider, voice: profile.voices.includes(requestedVoice) ? requestedVoice : profile.defaultVoice };
}
