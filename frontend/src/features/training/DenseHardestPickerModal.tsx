'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AttemptChartBar,
  DictWord,
  getCategoryAttemptChartData,
  pickHardestWordsForDenseTraining,
  ProgressRow,
} from '@/features/training/helpers';
import styles from '@/features/training/dense-hardest-picker.module.css';

const PERCENT_OPTIONS = [10, 15, 20] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  words: DictWord[];
  progressById: Record<number, ProgressRow>;
  activeDenseIds: number[];
  initialPercent?: number;
  translationLang?: string | null;
  submitting?: boolean;
  onConfirm: (percent: number, wordIds: number[]) => void | Promise<void>;
};

export function DenseHardestPickerModal({
  open,
  onClose,
  words,
  progressById,
  activeDenseIds,
  initialPercent = 15,
  translationLang,
  submitting = false,
  onConfirm,
}: Props) {
  const t = useTranslations('DensePicker');
  const [percent, setPercent] = useState(initialPercent);
  const [hovered, setHovered] = useState<AttemptChartBar | null>(null);
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (open) setPercent(initialPercent);
  }, [open, initialPercent]);

  useEffect(() => {
    if (!open) setHovered(null);
  }, [open]);

  const pick = useMemo(
    () => pickHardestWordsForDenseTraining(words, progressById, percent, activeDenseIds),
    [words, progressById, percent, activeDenseIds],
  );

  const chart = useMemo(
    () =>
      getCategoryAttemptChartData(
        words,
        progressById,
        pick.wordIds,
        activeDenseIds,
        translationLang,
      ),
    [words, progressById, pick.wordIds, activeDenseIds, translationLang],
  );

  if (!open || typeof document === 'undefined') return null;

  const translations = hovered
    ? [hovered.translation_1, hovered.translation_2, hovered.translation_3]
        .map((tr) => (tr != null ? String(tr).trim() : ''))
        .filter((tr) => tr && tr !== '0')
    : [];

  return createPortal(
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        role="dialog"
        aria-labelledby="dense-hardest-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className={styles.close} onClick={onClose} aria-label={t('close')}>
          ×
        </button>

        <h2 id="dense-hardest-title" className={styles.title}>
          {t('title')}
        </h2>

        <p className={styles.hint}>{t('hint', { percent })}</p>

        <div className={styles.percentRow}>
          <span className={styles.percentLabel}>{t('percentLabel')}</span>
          <div className={styles.percentOptions} role="group" aria-label={t('percentAria')}>
            {PERCENT_OPTIONS.map((p) => (
              <button
                key={p}
                type="button"
                className={`${styles.percentBtn} ${percent === p ? styles.percentBtnActive : ''}`}
                onClick={() => setPercent(p)}
              >
                {p}%
              </button>
            ))}
          </div>
        </div>

        <div className={styles.summary}>
          {t('summary', {
            add: pick.wordIds.length,
            target: pick.targetCount,
            available: pick.candidateCount,
          })}
        </div>

        <div className={styles.chartWrap}>
          <div className={styles.chart} role="img" aria-label={t('chartAria')}>
            {chart.bars.map((bar) => {
              const totalH =
                bar.totalAttempts > 0
                  ? Math.max(4, Math.round((bar.totalAttempts / chart.chartMax) * 100))
                  : 2;
              const directH =
                bar.totalAttempts > 0
                  ? Math.round((bar.directAttempts / bar.totalAttempts) * totalH)
                  : 0;
              const revertH = Math.max(0, totalH - directH);

              return (
                <div
                  key={bar.id}
                  className={[
                    styles.barCol,
                    bar.inDense ? styles.barColDense : '',
                    bar.isMaxTier ? styles.barColMax : '',
                    bar.selected ? styles.barColSelected : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTipPos({ x: rect.left + rect.width / 2, y: rect.bottom });
                    setHovered(bar);
                  }}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div className={styles.barStack} style={{ height: `${totalH}%` }}>
                    {revertH > 0 && (
                      <span
                        className={`${styles.barSeg} ${styles.barSegRevert}`}
                        style={{ flexGrow: revertH }}
                      />
                    )}
                    {directH > 0 && (
                      <span
                        className={`${styles.barSeg} ${styles.barSegDirect}`}
                        style={{ flexGrow: directH }}
                      />
                    )}
                    {bar.totalAttempts === 0 && (
                      <span className={`${styles.barSeg} ${styles.barSegEmpty}`} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className={styles.legend}>
            <span>
              <i className={`${styles.swatch} ${styles.swatchDirect}`} /> {t('legendDirect')}
            </span>
            <span>
              <i className={`${styles.swatch} ${styles.swatchRevert}`} /> {t('legendRevert')}
            </span>
            <span>
              <i className={`${styles.swatch} ${styles.swatchSelected}`} /> {t('legendSelected')}
            </span>
            <span>
              <i className={`${styles.swatch} ${styles.swatchDense}`} /> {t('legendDense')}
            </span>
          </div>
        </div>

        {hovered && (
          <div className={styles.tooltip} style={{ left: tipPos.x, top: tipPos.y }} role="tooltip">
            <div className={styles.tooltipWord}>{hovered.word}</div>
            {translations.length > 0 && (
              <div className={styles.tooltipTrans}>{translations.join(', ')}</div>
            )}
            <div className={styles.tooltipAttempts}>
              <span className={styles.tooltipDirect}>→ {hovered.directAttempts}</span>
              <span className={styles.tooltipRevert}>← {hovered.revertAttempts}</span>
            </div>
          </div>
        )}

        <div className={styles.actions}>
          <button type="button" className={`${styles.btn} ${styles.btnCancel}`} onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnConfirm}`}
            disabled={pick.wordIds.length === 0 || submitting}
            onClick={() => onConfirm(percent, pick.wordIds)}
          >
            {submitting ? t('adding') : t('addWords', { count: pick.wordIds.length })}
          </button>
        </div>

        {pick.candidateCount === 0 && <p className={styles.warn}>{t('emptyWarn')}</p>}
      </div>
    </div>,
    document.body,
  );
}
