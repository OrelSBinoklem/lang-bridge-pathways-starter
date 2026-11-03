/** Voice choices are restricted to the locally supported human avatars. */
export const HUMAN_AVATAR_VOICES = Object.freeze({ a: 'Leda', kiyori: 'Kore', mikami: 'Autonoe', male: 'Orus', glasses: 'Rasalgethi' });

/** Keep the chosen model and rates; character casting applies only to Gemini API speech. */
export function siteCharacterVoice(config, lessonContext) {
  if (!/^gemini-.*-tts$/.test(config.ttsModel || '') || config.ttsMode === 'browser') return config;
  const avatar = typeof config.humanAvatar === 'string' && Object.hasOwn(HUMAN_AVATAR_VOICES, config.humanAvatar) ? config.humanAvatar : 'a';
  return { ...config, ttsVoice: lessonContext ? HUMAN_AVATAR_VOICES[avatar] : 'Fenrir' };
}
