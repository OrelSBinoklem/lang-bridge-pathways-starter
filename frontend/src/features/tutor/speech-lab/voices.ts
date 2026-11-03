export const speechLanguages = [
  { id: 'ru', tag: 'ru-RU', title: 'Русский', sample: 'Привет! Я изучаю латышский язык. Сегодня я хочу погулять по Риге и поговорить с друзьями.' },
  { id: 'uk', tag: 'uk-UA', title: 'Українська', sample: 'Привіт! Я вивчаю латиську мову. Сьогодні я хочу погуляти Ригою та поговорити з друзями.' },
  { id: 'lv', tag: 'lv-LV', title: 'Latviešu', sample: 'Sveiki! Es mācos latviešu valodu. Šodien es gribu pastaigāties pa Rīgu un parunāt ar draugiem.' },
] as const;
export type SpeechLanguage = typeof speechLanguages[number]['id'];
export type LabVoice = { id: string; name: string; lang: string; local: boolean; google: boolean; preferred: boolean };

export const voiceId = (voice: Pick<SpeechSynthesisVoice, 'voiceURI' | 'name' | 'lang' | 'localService'>) => JSON.stringify([voice.voiceURI, voice.name, voice.lang, voice.localService]);
export function voiceSnapshot() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return '[]';
  return JSON.stringify(window.speechSynthesis.getVoices().map(voice => ({
    id: voiceId(voice), name: voice.name, lang: voice.lang, local: voice.localService,
    google: /google/i.test(voice.name), preferred: voice.default,
  })).sort((a, b) => a.id.localeCompare(b.id)));
}
export const noVoices = () => '[]';
export function subscribeVoices(update: () => void) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return () => {};
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener('voiceschanged', update); window.addEventListener('focus', update);
  return () => { window.speechSynthesis.removeEventListener('voiceschanged', update); window.removeEventListener('focus', update); };
}
export function languageVoices(voices: LabVoice[], language: SpeechLanguage) {
  return voices.filter(voice => voice.lang.toLowerCase().replaceAll('_', '-').split('-')[0] === language);
}
export function selectedVoice(voices: LabVoice[], selection?: string) {
  return voices.find(voice => voice.id === selection) || voices.find(voice => voice.google) || voices.find(voice => voice.preferred) || voices[0];
}
export const secureBrowser = () => typeof window !== 'undefined' && window.isSecureContext;
export const noSecureBrowser = () => false;
export const staticSubscription = () => () => {};
