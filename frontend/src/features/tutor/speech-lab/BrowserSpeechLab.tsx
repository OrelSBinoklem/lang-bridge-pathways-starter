'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { BrowserSpeechCapture, browserSpeechSupported, subscribeBrowserSpeech, noBrowserSpeechOnServer } from '../browserSpeech';
import { languageVoices, selectedVoice, voiceSnapshot, noVoices, subscribeVoices, speechLanguages, voiceId,
  secureBrowser, noSecureBrowser, staticSubscription, type LabVoice, type SpeechLanguage } from './voices';
import styles from './browser-speech-lab.module.css';

type Result = { draft: string; final: string; message: string };
const emptyResult = (): Result => ({ draft: '', final: '', message: '' });

export function BrowserSpeechLab() {
  const snapshot = useSyncExternalStore(subscribeVoices, voiceSnapshot, noVoices);
  const voices = useMemo(() => JSON.parse(snapshot) as LabVoice[], [snapshot]);
  const recognition = useSyncExternalStore(subscribeBrowserSpeech, browserSpeechSupported, noBrowserSpeechOnServer);
  const secure = useSyncExternalStore(staticSubscription, secureBrowser, noSecureBrowser);
  const [choice, setChoice] = useState<Partial<Record<SpeechLanguage, string>>>({});
  const [texts, setTexts] = useState<Record<SpeechLanguage, string>>({ ru: speechLanguages[0].sample, uk: speechLanguages[1].sample, lv: speechLanguages[2].sample });
  const [results, setResults] = useState<Record<SpeechLanguage, Result>>({ ru: emptyResult(), uk: emptyResult(), lv: emptyResult() });
  const [active, setActive] = useState<SpeechLanguage | null>(null);
  const [phase, setPhase] = useState<'starting' | 'listening' | 'stopping' | 'idle'>('idle');
  const [speaking, setSpeaking] = useState<SpeechLanguage | null>(null);
  const [tempo, setTempo] = useState(1);
  const capture = useRef<BrowserSpeechCapture | null>(null);
  const speech = useRef<SpeechSynthesisUtterance | null>(null);
  const speechTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [, refresh] = useState(0);

  function update(language: SpeechLanguage, patch: Partial<Result>) {
    setResults(previous => ({ ...previous, [language]: { ...previous[language], ...patch } }));
  }
  function cancelVoice() {
    speechTimers.current.forEach(clearTimeout); speechTimers.current = [];
    const current = speech.current; speech.current = null;
    if (current) { current.onstart = current.onend = current.onerror = null; window.speechSynthesis?.cancel(); }
    setSpeaking(null);
  }
  function cancelCapture() {
    const current = capture.current; capture.current = null; current?.cancel();
    setActive(null); setPhase('idle');
  }
  function stopAll() { cancelCapture(); cancelVoice(); }

  useEffect(() => {
    const hide = () => {
      if (!document.hidden) return;
      const current = capture.current; capture.current = null; current?.cancel();
      const utterance = speech.current; speech.current = null;
      if (utterance) { utterance.onstart = utterance.onend = utterance.onerror = null; window.speechSynthesis?.cancel(); }
      speechTimers.current.forEach(clearTimeout); speechTimers.current = [];
      setActive(null); setPhase('idle'); setSpeaking(null);
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      const current = capture.current; capture.current = null; current?.cancel();
      const utterance = speech.current; speech.current = null;
      if (utterance) { utterance.onstart = utterance.onend = utterance.onerror = null; window.speechSynthesis?.cancel(); }
      speechTimers.current.forEach(clearTimeout);
    };
  }, []);

  function play(language: SpeechLanguage) {
    if (capture.current) return;
    cancelVoice();
    const available = languageVoices(voices, language), picked = selectedVoice(available, choice[language]);
    const native = window.speechSynthesis?.getVoices().find(voice => voiceId(voice) === picked?.id);
    if (!native || typeof SpeechSynthesisUtterance === 'undefined') { update(language, { message: 'Голос этого языка недоступен. Обнови список голосов.' }); return; }
    if (!texts[language].trim()) return;
    const utterance = new SpeechSynthesisUtterance(texts[language].trim());
    speech.current = utterance; utterance.voice = native; utterance.lang = native.lang; utterance.rate = tempo;
    setSpeaking(language); update(language, { message: `Запускаю голос: ${native.name}` });
    const finish = (message: string) => {
      if (speech.current !== utterance) return;
      speech.current = null; speechTimers.current.forEach(clearTimeout); speechTimers.current = [];
      setSpeaking(null); update(language, { message });
    };
    utterance.onstart = () => { if (speech.current === utterance) update(language, { message: `Говорит: ${native.name}` }); };
    utterance.onend = () => finish(`Готово · ${native.name}`);
    utterance.onerror = event => finish(`Не удалось озвучить (${event.error}). Попробуй другой доступный голос.`);
    speechTimers.current.push(setTimeout(() => {
      if (speech.current !== utterance) return;
      finish('Озвучка не завершилась за 90 секунд. Она остановлена.'); window.speechSynthesis.cancel();
    }, 90000));
    try { window.speechSynthesis.speak(utterance); }
    catch { finish('Браузер не смог запустить озвучку.'); }
  }

  function record(language: SpeechLanguage) {
    if (capture.current || !recognition || !secure) return;
    cancelVoice(); setActive(language); update(language, { draft: '', final: '', message: 'Разреши микрофон и произнеси фразу.' });
    const session = new BrowserSpeechCapture({
      language,
      onState: state => { if (capture.current === session) setPhase(state); },
      onDraft: draft => { if (capture.current === session) update(language, { draft }); },
      onText: text => {
        if (capture.current !== session) return;
        capture.current = null; setActive(null); setPhase('idle');
        update(language, { draft: '', final: text, message: 'Готово. Это текст распознавания без исправлений.' });
      },
      onError: message => {
        if (capture.current !== session) return;
        capture.current = null; setActive(null); setPhase('idle'); update(language, { draft: '', message });
      },
    });
    capture.current = session; session.start();
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><h1>Проверка голосов и распознавания</h1><p>Русский · українська · latviešu</p></div>
      <button type="button" onClick={stopAll} disabled={!active && !speaking}><i className="pi pi-stop" aria-hidden /> Остановить всё</button>
    </header>
    <p className={styles.note}>Кредиты сайта не расходуются. Голоса берутся из браузера; Google отмечен по названию. Если голоса нужного языка нет, это будет видно сразу.</p>
    <div className={styles.capabilities} role="status">
      <span>Голосов: {voices.length}</span><span>Распознавание: {recognition ? 'доступно' : 'не поддерживается'}</span>
      <span>Микрофон: {secure ? 'HTTPS / localhost' : 'нужен HTTPS или localhost'}</span>
      <button type="button" onClick={() => { window.speechSynthesis?.getVoices(); refresh(value => value + 1); }}>Обновить голоса</button>
    </div>
    <label className={styles.tempo}>Темп озвучки <input aria-label="Темп озвучки" type="range" min="0.7" max="1.3" step="0.1" value={tempo} disabled={Boolean(speaking)} onChange={event => setTempo(Number(event.target.value))} /><output>{tempo.toFixed(1)}×</output></label>
    <div className={styles.cards}>{speechLanguages.map(language => {
      const available = languageVoices(voices, language.id), selected = selectedVoice(available, choice[language.id]);
      const listening = active === language.id, result = results[language.id];
      return <section className={styles.card} key={language.id} aria-labelledby={`speech-${language.id}`}>
        <h2 id={`speech-${language.id}`}>{language.title} <small>{language.tag}</small></h2>
        <label>Текст для озвучки<textarea aria-label={`Текст для озвучки: ${language.title}`} lang={language.tag} maxLength={800} value={texts[language.id]} onChange={event => setTexts(previous => ({ ...previous, [language.id]: event.target.value }))} /></label>
        <label>Голос<select aria-label={`Голос: ${language.title}`} value={selected?.id ?? ''} disabled={!available.length || Boolean(speaking)} onChange={event => setChoice(previous => ({ ...previous, [language.id]: event.target.value }))}>
          {!available.length && <option value="">Нет голосов этого языка</option>}
          {available.map(voice => <option key={voice.id} value={voice.id}>{voice.name} · {voice.lang}{voice.google ? ' · Google' : ''}</option>)}
        </select></label>
        <p className={styles.voiceNote}>{!available.length ? 'Браузер не предлагает голос этого языка. Распознавание можно проверить отдельно.' : available.some(voice => voice.google) ? 'Есть голос с Google в названии.' : 'Голоса Google для этого языка не найдены. В списке — другие голоса устройства.'}</p>
        <div className={styles.actions}>
          <button type="button" disabled={!selected || !texts[language.id].trim() || Boolean(active)} onClick={() => play(language.id)}><i className="pi pi-volume-up" aria-hidden /> Послушать</button>
          <button type="button" disabled={speaking !== language.id} onClick={cancelVoice}>Стоп</button>
        </div>
        <div className={styles.recognition}>
          <h3>Проверка микрофона</h3><p>Нажми «Начать», скажи фразу на этом языке, затем «Завершить».</p>
          <div className={styles.actions}>
            <button type="button" disabled={!recognition || !secure || Boolean(active && !listening) || phase === 'stopping'} onClick={() => listening ? capture.current?.stop() : record(language.id)}>
              <i className={`pi ${listening ? 'pi-stop-circle' : 'pi-microphone'}`} aria-hidden />{listening ? phase === 'stopping' ? 'Завершаю…' : 'Завершить' : 'Начать'}
            </button>
            <button type="button" disabled={listening} onClick={() => setResults(previous => ({ ...previous, [language.id]: emptyResult() }))}>Очистить</button>
          </div>
          <label>{listening ? 'Текущая расшифровка' : 'Распознанный текст'}<textarea aria-label={`Распознанный текст: ${language.title}`} lang={language.tag} readOnly value={listening ? result.draft : result.final} placeholder="Здесь появится твоя речь…" /></label>
          <p className={styles.status} role="status" aria-live="polite">{listening && phase === 'starting' ? 'Запускаю микрофон…' : result.message || 'Проверка ещё не запускалась.'}</p>
        </div>
      </section>;
    })}</div>
    <p className={styles.note}>Тест не отправляет речь нашему боту и ничего не сохраняет. Сам браузер может отправлять звук своему сервису распознавания. После ухода с этой вкладки микрофон и озвучка останавливаются.</p>
    <details className={styles.inventory}><summary>Все голоса, которые предоставил браузер ({voices.length})</summary>
      {voices.length ? <ul>{voices.map(voice => <li key={voice.id}>{voice.name} · {voice.lang} · {voice.local ? 'локальный' : 'сетевой'}</li>)}</ul> : <p>Список пуст. Попробуй обновить голоса или открыть страницу в другом браузере.</p>}
    </details>
  </main>;
}
