'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { TrainingSessionModal, type TrainingSessionModalProps } from './TrainingSessionModal';
import { playWordAudio } from './audio';
import { formatCorrectAnswerDisplay, getWordTranslationFields, PHRASE_WORD_MIN_COUNT, promptFor, type DictWord } from './helpers';
import styles from './examen-trainer.module.css';

type Props = Pick<TrainingSessionModalProps, 'meta' | 'answer' | 'onAnswerChange' | 'showResult' | 'isCorrect' | 'isUpdating' | 'selectionMode' | 'choiceOptions' | 'onCheck' | 'onNext' | 'onFinish'> & {
  word: DictWord;
  mode: boolean;
  learnLang: string;
  translationLang?: string | null;
  phraseRetryTooltip: boolean;
};

export function TrainingModal(props: Props) {
  const t = useTranslations('Training');
  const [infoOpen, setInfoOpen] = useState(false);
  const { word, mode, translationLang, showResult, isCorrect } = props;
  const infoHtml = getWordTranslationFields(word, translationLang).info?.trim() ?? '';
  useEffect(() => setInfoOpen(false), [word.id, showResult, isCorrect]);
  function replayAudio() { playWordAudio(word.word, props.learnLang, word.sound_url); }
  return <TrainingSessionModal {...props}
    prompt={mode ? formatCorrectAnswerDisplay(word, false, translationLang) || promptFor(word, true, translationLang) : word.word}
    onReplay={!mode ? replayAudio : undefined}
    notice={props.phraseRetryTooltip ? t('phraseRetry', { count: PHRASE_WORD_MIN_COUNT }) : undefined}
    correctAnswer={<span className={styles.correctAnswerTextRow}>
      <span className={styles.correctAnswerText}>{formatCorrectAnswerDisplay(word, mode, translationLang)}</span>
      {mode && <button type="button" className={styles.audioBtn} onClick={replayAudio}
        title={t('replayAudio')} aria-label={t('replayAudio')}><i className="pi pi-volume-up" aria-hidden="true" /></button>}
      {infoHtml && <button type="button" className={styles.correctAnswerInfoBtn}
        aria-label={t('hint')} title={t('hint')} onClick={() => setInfoOpen(value => !value)}>?</button>}
    </span>}
    overlay={infoOpen && <div className={styles.sessionHint}>
      <button type="button" className={styles.infoPopoverClose} aria-label={t('close')} onClick={() => setInfoOpen(false)}><i className="pi pi-times" /></button>
      <div className={styles.infoPopoverContent} data-lbp-hint dangerouslySetInnerHTML={{ __html: infoHtml }} />
    </div>}
  />;
}

export function TrainingEmptyModal({ onFinish }: { onFinish: () => void }) {
  const t = useTranslations('Training');
  return <TrainingSessionModal prompt={t('queueEmpty')} meta={t('queueEmptyHint')}
    answer="" onAnswerChange={() => {}} showResult isCorrect isUpdating={false}
    selectionMode={false} choiceOptions={[]} onCheck={() => {}} onNext={onFinish} onFinish={onFinish}
    nextLabel={t('close')} statusOnly />;
}

export function RetrainingNoticeModal({ onContinue, onReview }: {
  onContinue: () => void;
  onReview: () => void;
}) {
  const t = useTranslations('Training');
  return <TrainingSessionModal prompt={<span className={styles.retrainingNoticeText}>{t('retrainingText')}</span>}
    meta={t('retrainingTitle')} dialogLabel={t('retrainingTitle')}
    answer="" onAnswerChange={() => {}} showResult isCorrect isUpdating={false}
    selectionMode={false} choiceOptions={[]} onCheck={() => {}} onNext={onContinue} onFinish={onReview}
    nextLabel={t('continueAnswering')} finishLabel={t('closeAndReview')} statusOnly />;
}
