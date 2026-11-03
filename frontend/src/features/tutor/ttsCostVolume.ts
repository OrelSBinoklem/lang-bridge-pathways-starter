// Calculator assumptions only. Actual credit settlements use provider-reported usage.
// Gemini output: https://ai.google.dev/gemini-api/docs/pricing (25 audio tokens/second).
// OpenAI duration conversion and text tokens/word are deliberately approximate.
export function estimateTtsVolume(wordsPerMinute: number, minutes: number, model: string) {
  const speed = Number.isFinite(wordsPerMinute) ? Math.max(0, wordsPerMinute) : 0;
  const duration = Number.isFinite(minutes) ? Math.min(60, Math.max(0, minutes)) : 0;
  const words = speed * duration;
  const audioTokensPerMinute = model.startsWith('gemini-') ? 1500 : 1200;
  return {
    words,
    minutes: duration,
    ttsInputTokens: Math.ceil(words * 2),
    ttsAudioTokens: words > 0 ? Math.ceil(duration * audioTokensPerMinute) : 0,
  };
}
