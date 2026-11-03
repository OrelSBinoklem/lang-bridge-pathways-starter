'use client';

import { useId, useRef, useState, type PointerEvent } from 'react';
import { useLocale } from 'next-intl';
import { OverlayPanel } from 'primereact/overlaypanel';
import type { TutorVoiceMode } from './voiceTurn';
import styles from './floating-tutor-assistant.module.css';

type Props = {
  ready: boolean;
  activeMode: TutorVoiceMode | null;
  complexAvailable: boolean;
  browserRecognition?: boolean;
  recognitionLanguage?: string;
  onStart: (mode: TutorVoiceMode, event?: PointerEvent<HTMLButtonElement>, language?: string) => void;
  onStop: (event?: PointerEvent<HTMLButtonElement>) => void;
};

export function TutorVoiceControls({ ready, activeMode, complexAvailable, browserRecognition = false, recognitionLanguage = 'lv', onStart, onStop }: Props) {
  const ukrainian = useLocale() === 'uk';
  const help = useRef<OverlayPanel>(null);
  const helpButton = useRef<HTMLButtonElement>(null);
  const helpId = useId(), helpTitleId = useId();
  const [helpOpen, setHelpOpen] = useState(false);
  function positionHelp() {
    const panel = help.current?.getElement(), button = helpButton.current;
    if (!panel || !button) return;
    panel.style.display = 'block';
    const anchor = button.getBoundingClientRect(), margin = 12;
    const above = anchor.top >= panel.offsetHeight + margin;
    panel.style.left = `${Math.max(margin, Math.min(anchor.right - panel.offsetWidth, window.innerWidth - panel.offsetWidth - margin))}px`;
    panel.style.top = `${Math.max(margin, Math.min(above ? anchor.top - panel.offsetHeight - margin : anchor.bottom + margin, window.innerHeight - panel.offsetHeight - margin))}px`;
    panel.style.setProperty('--overlayArrowLeft', `${Math.max(0, anchor.left - Number.parseFloat(panel.style.left))}px`);
    panel.setAttribute('data-p-overlaypanel-flipped', String(above));
  }
  const labels = ukrainian
    ? { standard: 'Говорити', complex: 'Складне питання', release: 'Відпустіть, щоб надіслати', hold: 'Утримуйте, щоб говорити' }
    : { standard: 'Говорить', complex: 'Сложный вопрос', release: 'Отпустите, чтобы отправить', hold: 'Удерживайте, чтобы говорить' };

  const languageNames: Record<string, string> = ukrainian
    ? { lv: 'Латиська', ru: 'Російська', uk: 'Українська', en: 'Англійська' }
    : { lv: 'Латышский', ru: 'Русский', uk: 'Украинский', en: 'Английский' };
  const buttons: { key: string; mode: TutorVoiceMode; language?: string; label: string }[] = browserRecognition
    ? [
        { key: 'latvian', mode: 'standard', language: 'lv', label: ukrainian ? 'Сказати латиською' : 'Сказать по-латышски' },
        { key: 'native', mode: 'standard', language: ukrainian ? 'uk' : 'ru', label: ukrainian ? 'Сказати українською' : 'Сказать по-русски' },
        { key: 'complex', mode: 'complex', language: recognitionLanguage || 'lv', label: labels.complex },
      ]
    : [{ key: 'standard', mode: 'standard', label: labels.standard }, { key: 'complex', mode: 'complex', label: labels.complex }];

  return buttons.map(({ key, mode, language, label }) => {
    const active = activeMode === mode && (!browserRecognition || language === recognitionLanguage);
    const languageHint = language ? `${ukrainian ? 'Мова розпізнавання' : 'Язык распознавания'}: ${languageNames[language] || languageNames.lv}.` : '';
    const control = (
      <button
        data-chat-tour={mode === 'complex' ? 'complex' : 'voice'}
        key={key}
        type="button"
        className={`${styles.talkButton} ${browserRecognition && mode === 'standard' ? styles.languageTalkButton : ''} ${mode === 'complex' ? styles.complexQuestionButton : ''} ${active ? styles.talkButtonActive : ''}`}
        disabled={!ready || (mode === 'complex' && !complexAvailable) || (activeMode !== null && !active)}
        aria-label={label}
        aria-pressed={active}
        title={mode === 'complex' && !complexAvailable
          ? ukrainian ? 'Для цієї моделі режим міркування недоступний' : 'Для этой модели режим рассуждения недоступен'
          : `${active ? labels.release : labels.hold}${languageHint ? ` ${languageHint}` : ''}`}
        onPointerDown={(event) => { if (event.button === 0) onStart(mode, event, language); }}
        onPointerUp={onStop}
        onPointerCancel={onStop}
        onKeyDown={(event) => {
          if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            if (!event.repeat) onStart(mode, undefined, language);
          }
        }}
        onKeyUp={(event) => {
          if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            onStop();
          }
        }}
        onBlur={() => { if (active) onStop(); }}
      >
        <i className={`pi ${mode === 'complex' ? 'pi-sparkles' : 'pi-microphone'}`} aria-hidden="true" />
        <span>{active ? labels.release : label}{!active && browserRecognition && mode === 'complex' ? ` · ${(recognitionLanguage || 'lv').toUpperCase()}` : ''}</span>
      </button>
    );
    if (mode !== 'complex') return control;
    return <div key={key} className={styles.complexQuestionControl}>
      {control}
      <button ref={helpButton} type="button" className={styles.complexQuestionHelp}
        aria-label={ukrainian ? 'Про режим «Складне питання»' : 'О режиме «Сложный вопрос»'}
        aria-haspopup="dialog" aria-expanded={helpOpen} aria-controls={helpId}
        onClick={event => { event.stopPropagation(); help.current?.toggle(event); }}>
        <i className="pi pi-question-circle" aria-hidden="true" />
      </button>
      <OverlayPanel ref={help} id={helpId} pt={{ root: { role: 'dialog' } }} aria-labelledby={helpTitleId} data-tutor-help-popover="true"
        className={styles.complexQuestionPopover} showCloseIcon ariaCloseLabel={ukrainian ? 'Закрити підказку' : 'Закрыть подсказку'}
        transitionOptions={{ timeout: 150, onEntering: positionHelp }}
        onShow={() => { positionHelp(); setHelpOpen(true); }} onHide={() => setHelpOpen(false)}
        onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); help.current?.hide(); helpButton.current?.focus(); } }}>
        <strong id={helpTitleId}>{labels.complex}</strong>
        <p>{ukrainian ? 'Вмикає режим міркування робота для цього запиту.' : 'Включает режим размышления робота для этого запроса.'}</p>
        <p>{ukrainian ? 'Один такий запит може коштувати як 2–3 звичайних. Відповіді доведеться почекати трохи довше.' : 'Один такой запрос может стоить как 2–3 обычных. Ответа придётся подождать немного дольше.'}</p>
      </OverlayPanel>
    </div>;
  });
}
