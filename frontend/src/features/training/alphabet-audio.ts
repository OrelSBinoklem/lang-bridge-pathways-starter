let active: HTMLAudioElement | null = null;
const audioDirectory = '/audio/grammar/alphabet/gemini38-20261013-aoede';

export function stopAlphabetAudio() {
  if (active) { active.pause(); active.src = ''; active = null; }
}

export async function playAlphabetAudio(key: string) {
  if (!/^[a-z0-9-]{1,64}$/.test(key)) throw new Error('Invalid letter audio key.');
  stopAlphabetAudio();
  const audio = new Audio(`${audioDirectory}/${key}.mp3`);
  active = audio;
  try { await audio.play(); } catch (cause) {
    if (audio !== active && cause instanceof DOMException && cause.name === 'AbortError') return;
    throw cause;
  }
}
