'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { WordEditor } from '@/features/admin/WordEditor';
import {
  DictWord,
  formatCooldownMs,
  formatDenseWaitMs,
  getWordDisplayStatusExamen,
  getWordTranslationFields,
  getWordTranslationList,
  maskText,
  ProgressRow,
} from '@/features/training/helpers';
import styles from '@/features/training/examen-trainer.module.css';

type Props = {
  dictionaryId: number;
  word: DictWord;
  progress?: ProgressRow | null;
  dense?: boolean;
  denseAttemptsLeft?: number;
  denseWaitSec?: number;
  denseAddMode?: boolean;
  adminMode?: boolean;
  translationLang?: string | null;
  onDenseToggle?: (wordId: number) => void;
  now?: number;
};

export function WordEducationRow({
  dictionaryId,
  word,
  progress,
  dense,
  denseAttemptsLeft,
  denseWaitSec,
  denseAddMode,
  adminMode,
  translationLang,
  onDenseToggle,
  now = Date.now(),
}: Props) {
  const t = useTranslations('Training');
  const tCommon = useTranslations('Common');
  const [infoOpen, setInfoOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const status = getWordDisplayStatusExamen(progress, now);
  const wordTranslation = getWordTranslationFields(word, translationLang);
  const primaryTranslation = wordTranslation.translation_1;
  const easyDirect = status.modeEducation;
  const easyRevert = status.modeEducationRevert;
  const infoHtml = wordTranslation.info?.trim() ?? '';
  const showInfoHint =
    !!infoHtml &&
    ((status.showWord && status.showTranslation) || (easyDirect && easyRevert)) &&
    !status.cooldownDirect &&
    !status.cooldownRevert;

  useEffect(() => {
    if (!infoOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInfoOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [infoOpen]);

  const directLearned = (progress?.correct_attempts ?? 0) >= 2;
  const revertLearned = (progress?.correct_attempts_revert ?? 0) >= 2;
  const both = directLearned && revertLearned;

  let progressClass = styles.progressNone;
  let progressMark: ReactNode = <>—&nbsp;&nbsp;</>;
  if (status.hasAttempts) {
    if (both) {
      progressClass = styles.progressFull;
      progressMark = <>✓&nbsp;&nbsp;</>;
    } else if (directLearned || revertLearned) {
      progressClass = styles.progressPartial;
      progressMark = <>✓&nbsp;&nbsp;</>;
    } else {
      progressMark = <>—&nbsp;&nbsp;</>;
    }
  }

  const translations = getWordTranslationList(word, translationLang).slice(1);

  return (
    <li
      data-word-tour="row"
      className={[dense ? styles.rowDense : '', denseAddMode ? styles.rowDensePick : '']
        .filter(Boolean)
        .join(' ')}
      onClick={(e) => {
        if (e.target instanceof Element && e.target.closest('button, a, input, select, textarea')) {
          return;
        }
        if (denseAddMode) onDenseToggle?.(word.id);
      }}
      onKeyDown={(e) => {
        if (!denseAddMode) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onDenseToggle?.(word.id);
        }
      }}
      role={denseAddMode ? 'button' : undefined}
      tabIndex={denseAddMode ? 0 : undefined}
    >
      {dense && (
        <span className={styles.denseBadge}>
          <span>🔒</span>
          <span className={styles.denseBadgeCount}>{denseAttemptsLeft ?? '·'}</span>
          {!!denseWaitSec && denseWaitSec > 0 && (
            <span className={styles.denseBadgeTime}>⏱️ {formatDenseWaitMs(denseWaitSec * 1000)}</span>
          )}
        </span>
      )}

      <span className={styles.wordCell}>
        {status.cooldownRevert ? (
          <span className={styles.cooldown}>⏱️ {formatCooldownMs(status.cooldownRevert)}</span>
        ) : status.showWord || easyRevert ? (
          <span className={easyRevert ? styles.learningMode : undefined}>
            {easyRevert && <span>📚 </span>}
            {word.word}
          </span>
        ) : (
          <span className={styles.hiddenText}>{maskText(word.word)}</span>
        )}
      </span>

      <span className={styles.translationWrap}>
        <span data-word-tour="progress" className={`${styles.progress} ${progressClass}`}>{progressMark}</span>
        {status.cooldownDirect ? (
          <span className={styles.cooldown}>⏱️ {formatCooldownMs(status.cooldownDirect)}</span>
        ) : status.showTranslation || easyDirect ? (
          <span className={easyDirect ? styles.learningMode : undefined}>
            {primaryTranslation}
            {easyDirect && <span> 📚</span>}
          </span>
        ) : (
          <span className={styles.hiddenText}>{maskText(primaryTranslation)}</span>
        )}
        {!status.cooldownDirect &&
          translations.map((t) => (
            <span key={t}>
              ,{' '}
              {status.showTranslation || easyDirect ? (
                t
              ) : (
                <span className={styles.hiddenText}>{maskText(t)}</span>
              )}
            </span>
          ))}
      </span>

      {showInfoHint && (
        <button
          type="button"
          className={styles.infoHint}
          data-word-tour="hint"
          title={t('hint')}
          aria-label={t('hint')}
          onClick={(e) => {
            e.stopPropagation();
            setInfoOpen(true);
          }}
        >
          ?
        </button>
      )}

      {adminMode && (
        <button
          type="button"
          className={styles.editBtn}
          onClick={(e) => {
            e.stopPropagation();
            setEditOpen((v) => !v);
          }}
        >
          ✏️
        </button>
      )}

      {adminMode && editOpen && (
        <WordEditor dictionaryId={dictionaryId} word={word} onClose={() => setEditOpen(false)} />
      )}

      {infoOpen &&
        infoHtml &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={styles.infoBackdrop}
            role="presentation"
            onClick={() => setInfoOpen(false)}
          >
            <div
              className={styles.infoPopover}
              role="dialog"
              aria-label={t('hint')}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className={styles.infoPopoverClose}
                aria-label={tCommon('close')}
                onClick={() => setInfoOpen(false)}
              >
                ×
              </button>
              <div
                className={styles.infoPopoverContent}
                data-lbp-hint
                dangerouslySetInnerHTML={{ __html: infoHtml }}
              />
            </div>
          </div>,
          document.body,
        )}
    </li>
  );
}
