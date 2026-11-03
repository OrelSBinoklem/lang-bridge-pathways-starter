'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import styles from './examen-trainer.module.css';

export type TrainingSessionModalProps = {
  prompt: ReactNode;
  meta?: string;
  answer: string;
  onAnswerChange: (value: string) => void;
  showResult: boolean;
  isCorrect: boolean;
  isUpdating: boolean;
  selectionMode: boolean;
  choiceOptions: string[];
  correctAnswer?: ReactNode;
  notice?: ReactNode;
  resultNotice?: ReactNode;
  error?: string;
  overlay?: ReactNode;
  statusOnly?: boolean;
  nextLabel?: string;
  finishLabel?: string;
  dialogLabel?: string;
  onReplay?: () => void;
  onCheck: (answer?: string) => void;
  onNext: () => void;
  onFinish: () => void;
};

/** Shared presentation; each trainer retains its own queue and server scoring. */
export function TrainingSessionModal(props: TrainingSessionModalProps) {
  const t = useTranslations('Training');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const finishRef = useRef(props.onFinish);
  finishRef.current = props.onFinish;
  useEffect(() => {
    const dialog = dialogRef.current;
    const previous = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  useEffect(() => {
    if (props.showResult) nextRef.current?.focus();
    else if (!props.selectionMode) inputRef.current?.focus();
  }, [props.showResult, props.prompt, props.selectionMode]);
  if (typeof document === 'undefined') return null;
  return createPortal(<dialog ref={dialogRef} className={`${styles.modal} ${styles.sessionDialog}`}
    aria-label={props.dialogLabel ?? t('trainingAria')} onCancel={event => { event.preventDefault(); finishRef.current(); }}
    onClick={event => { if (event.target === event.currentTarget) props.onFinish(); }}>
    <div className={styles.sessionContent}>
      <button type="button" className={styles.sessionClose} onClick={props.onFinish}
        title={t('exitTraining')} aria-label={t('exitTraining')}><i className="pi pi-times" aria-hidden="true" /></button>
      {props.meta && <div className={styles.modalMeta}>{props.meta}</div>}
      <div className={styles.modalPrompt}>
        <span>{props.prompt}</span>
        {props.onReplay && <button type="button" className={styles.audioBtn} onClick={props.onReplay}
          title={t('replayAudio')} aria-label={t('replayAudio')}><i className="pi pi-volume-up" aria-hidden="true" /></button>}
      </div>
      {!props.showResult && <form onSubmit={event => { event.preventDefault(); props.onCheck(); }}>
        {props.notice && <div className={styles.phraseRetryTooltip} role="status">{props.notice}</div>}
        <input ref={inputRef} className={styles.modalInput} value={props.answer}
          onChange={event => props.onAnswerChange(event.target.value)} autoComplete="off"
          placeholder={t('answerPlaceholder')} aria-label={t('answerPlaceholder')} disabled={props.isUpdating} />
        {props.selectionMode && props.choiceOptions.length > 0 && <div className={styles.choiceOptions}>
          {props.choiceOptions.map(option => <button key={option} type="button" className={styles.choiceBtn}
            disabled={props.isUpdating} onClick={() => props.onCheck(option)}>{option}</button>)}
        </div>}
        <button type="submit" className={styles.modalCheck} disabled={props.isUpdating} aria-busy={props.isUpdating}>
          {props.isUpdating ? <><span className={styles.modalCheckSpinner} aria-hidden="true" />{t('updating')}</>
            : props.answer.trim() ? t('check') : t('skip')}
        </button>
      </form>}
      {props.showResult && <div role="status">
        {!props.statusOnly && <div className={`${styles.trainingResult} ${props.isCorrect ? styles.trainingResultOk : styles.trainingResultBad}`}>
          {props.isCorrect ? t('correctOk') : <>{t('incorrectPrefix')}
            {props.answer.trim() && <div className={styles.userWrongAnswer}>{props.answer.trim()}</div>}</>}
        </div>}
        {!props.isCorrect && <div className={styles.correctAnswerBox}><strong>{t('correctAnswer')}:</strong>{props.correctAnswer}</div>}
        {props.resultNotice && <p className={styles.modalMeta}>{props.resultNotice}</p>}
        <div className={styles.trainingControls}>
          <button ref={nextRef} type="button" data-next-word className={styles.trainingNextBtn}
            onClick={props.onNext}>{props.nextLabel ?? t('nextWord')}</button>
          <button type="button" className={styles.trainingFinishBtn} onClick={props.onFinish}>{props.finishLabel ?? t('finish')}</button>
        </div>
      </div>}
      {props.error && <p role="alert" className={styles.trainingResultBad}>{props.error}</p>}
      {props.overlay}
    </div>
  </dialog>, document.body);
}
