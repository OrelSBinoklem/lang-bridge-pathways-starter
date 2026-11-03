export const BROWSER_SPEECH_MODEL = 'browser-speech';
export const BROWSER_SPEECH_LANGUAGES = [
  { value: 'lv', label: 'Латышский' },
  { value: 'ru', label: 'Русский' },
  { value: 'uk', label: 'Украинский' },
  { value: 'en', label: 'Английский' },
] as const;

type RecognitionResult = { isFinal: boolean; 0?: { transcript: string } };
export type BrowserRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: { resultIndex: number; results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
export type BrowserRecognitionConstructor = new () => BrowserRecognition;
type SpeechWindow = { SpeechRecognition?: BrowserRecognitionConstructor; webkitSpeechRecognition?: BrowserRecognitionConstructor };

export function browserRecognitionConstructor(): BrowserRecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  const browser = window as unknown as SpeechWindow;
  if (typeof browser.SpeechRecognition === 'function') return browser.SpeechRecognition;
  return typeof browser.webkitSpeechRecognition === 'function' ? browser.webkitSpeechRecognition : undefined;
}
export const browserSpeechSupported = () => Boolean(browserRecognitionConstructor());
export const subscribeBrowserSpeech = () => () => {};
export const noBrowserSpeechOnServer = () => false;

export function browserSpeechLanguage(language: string) {
  return ({ lv: 'lv-LV', ru: 'ru-RU', uk: 'uk-UA', en: 'en-US' } as Record<string, string>)[language] || 'lv-LV';
}

export function browserSpeechError(code: string) {
  switch (code) {
    case 'not-allowed': return 'Разрешите браузеру доступ к микрофону и попробуйте снова.';
    case 'service-not-allowed': return 'Сервис распознавания недоступен в этом браузере. Выберите другой вариант распознавания.';
    case 'language-not-supported': return 'Браузер не поддерживает выбранный язык. Выберите другой язык или другой вариант распознавания.';
    case 'network': return 'Браузер не смог подключиться к распознаванию. Проверьте интернет или выберите другой вариант.';
    case 'audio-capture': return 'Браузер не получил звук с микрофона. Проверьте подключение и настройки микрофона.';
    case 'no-speech': return 'Речь не распознана. Попробуйте ещё раз.';
    case 'unsupported': return 'Этот браузер не поддерживает встроенное распознавание. Выберите другой вариант.';
    case 'timeout': return 'Браузер не завершил распознавание. Попробуйте ещё раз или выберите другой вариант.';
    default: return 'Распознавание в браузере прервано. Попробуйте ещё раз. Платное распознавание автоматически не включалось.';
  }
}

type Options = {
  language: string;
  onText: (text: string) => void;
  onDraft: (text: string) => void;
  onState: (state: 'starting' | 'listening' | 'stopping' | 'idle') => void;
  onError: (message: string) => void;
  Constructor?: BrowserRecognitionConstructor;
  startTimeoutMs?: number;
  finishTimeoutMs?: number;
  maxDurationMs?: number;
};

// One hold-to-talk session. No restart, paid fallback, microphone blob or server STT call.
export class BrowserSpeechCapture {
  private recognition: BrowserRecognition | null = null;
  private finals = new Map<number, string>();
  private closed = false;
  private started = false;
  private ended = false;
  private stopping = false;
  private timers: ReturnType<typeof setTimeout>[] = [];
  constructor(private options: Options) {}

  start() {
    if (this.closed || this.recognition) return;
    const Constructor = this.options.Constructor || browserRecognitionConstructor();
    if (!Constructor) { this.fail('unsupported'); return; }
    this.options.onState('starting');
    try {
      const recognition = new Constructor();
      this.recognition = recognition;
      recognition.lang = browserSpeechLanguage(this.options.language);
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => {
        if (this.closed) return;
        this.started = true;
        if (this.stopping) this.requestStop();
        else this.options.onState('listening');
      };
      recognition.onresult = event => {
        if (this.closed) return;
        const draft: string[] = [];
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0]?.transcript.trim() || '';
          if (result.isFinal) this.finals.set(i, text);
          draft.push(text);
        }
        this.options.onDraft(draft.filter(Boolean).join(' '));
      };
      recognition.onerror = event => { if (!this.closed) this.fail(event.error); };
      recognition.onend = () => {
        if (this.closed) return;
        this.ended = true;
        if (this.stopping) this.finish();
        else if (!this.text()) this.fail('no-speech');
        // A browser may end on a pause; keep the text until the user releases the button.
      };
      this.timers.push(setTimeout(() => { if (!this.started && !this.closed) this.fail('timeout'); }, this.options.startTimeoutMs ?? 20000));
      this.timers.push(setTimeout(() => this.stop(), this.options.maxDurationMs ?? 90000));
      recognition.start();
    } catch (error) {
      this.fail(error instanceof Error && ['NotAllowedError', 'SecurityError'].includes(error.name) ? 'not-allowed' : 'aborted');
    }
  }

  stop() {
    if (this.closed || this.stopping) return;
    this.stopping = true;
    this.options.onState('stopping');
    if (this.ended) { this.finish(); return; }
    this.timers.push(setTimeout(() => this.fail('timeout'), this.options.finishTimeoutMs ?? 8000));
    if (this.started) this.requestStop();
  }

  cancel() { this.cleanup(true); }

  private requestStop() {
    try { this.recognition?.stop(); } catch { this.fail('aborted'); }
  }
  private text() { return [...this.finals.entries()].sort(([a], [b]) => a - b).map(([, text]) => text).filter(Boolean).join(' '); }
  private finish() {
    if (this.closed) return;
    const text = this.text();
    if (!text) { this.fail('no-speech'); return; }
    this.cleanup(false);
    this.options.onText(text);
  }
  private fail(code: string) {
    if (this.closed) return;
    this.cleanup(true);
    this.options.onError(browserSpeechError(code));
  }
  private cleanup(abort: boolean) {
    if (this.closed) return;
    this.closed = true;
    this.timers.forEach(clearTimeout);
    const recognition = this.recognition;
    if (recognition) {
      recognition.onstart = recognition.onresult = recognition.onerror = recognition.onend = null;
      if (abort) { try { recognition.abort(); } catch { /* Already stopped by the browser. */ } }
    }
    this.options.onState('idle');
  }
}
