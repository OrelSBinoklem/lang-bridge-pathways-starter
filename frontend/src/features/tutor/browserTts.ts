// Browser voices belong to the device/browser. Never assume a Google or Latvian voice exists.
export function browserVoiceLanguages() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return '';
  return [...new Set(window.speechSynthesis.getVoices().map(voice => voice.lang.toLowerCase().split(/[-_]/)[0]))].sort().join(',');
}
export function subscribeBrowserVoices(update: () => void) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return () => {};
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener('voiceschanged', update);
  window.addEventListener('focus', update);
  return () => { window.speechSynthesis.removeEventListener('voiceschanged', update); window.removeEventListener('focus', update); };
}
export const noBrowserVoices = () => '';

export function browserSpeechParts(text: string, native = 'ru') {
  const parts: { text: string; lang: string }[] = [];
  let lang = native, buffer = '';
  for (const character of text) {
    const next = /\p{Script=Latin}/u.test(character) ? 'lv' : /\p{Script=Cyrillic}/u.test(character) ? native : lang;
    if (next !== lang && buffer.trim()) { parts.push({ text: buffer, lang }); buffer = ''; }
    lang = next; buffer += character;
  }
  if (buffer.trim()) parts.push({ text: buffer, lang });
  return parts;
}

export function speakBrowserText(text: string, native = 'ru', onError: (message: string) => void = () => {}) {
  let cancelled = false;
  const synth = typeof window === 'undefined' ? undefined : window.speechSynthesis;
  const voices = synth?.getVoices() ?? [];
  const utterances: SpeechSynthesisUtterance[] = [];
  const missing = new Set<string>();
  for (const part of browserSpeechParts(text, native)) {
    const voice = voices.find(voice => voice.lang.toLowerCase().split(/[-_]/)[0] === part.lang);
    if (!voice || typeof SpeechSynthesisUtterance === 'undefined') { missing.add(part.lang); continue; }
    const utterance = new SpeechSynthesisUtterance(part.text);
    utterance.lang = voice.lang; utterance.voice = voice;
    utterance.onerror = event => { if (!cancelled && !['canceled', 'interrupted'].includes(event.error)) onError('Браузер не смог озвучить ответ. Текст сохранён.'); };
    utterances.push(utterance);
    synth?.speak(utterance);
  }
  return { missing: [...missing], cancel: () => { cancelled = true; utterances.forEach(value => { value.onerror = null; }); if (utterances.length) synth?.cancel(); } };
}
