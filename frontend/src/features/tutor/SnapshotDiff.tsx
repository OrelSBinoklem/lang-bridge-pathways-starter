'use client';

import { useMemo, useState } from 'react';
import { diffText, foldRows, type DiffRow, type Part } from '@/features/tutor/textDiff';
import styles from '@/features/tutor/snapshot-diff.module.css';

function RowText({ parts, kind }: { parts: Part[]; kind: DiffRow['kind'] }) {
  return (
    <code className={styles.text}>
      {parts.map((part, index) =>
        part.changed ? (
          <mark key={index} className={kind === 'delete' ? styles.charRemoved : styles.charAdded}>
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
      {/* An empty line still needs height and a selectable end. */}
      {'​'}
    </code>
  );
}

function Row({ row }: { row: DiffRow }) {
  const rowClass = row.kind === 'delete' ? styles.rowRemoved : row.kind === 'insert' ? styles.rowAdded : styles.rowEqual;
  return (
    <div className={`${styles.row} ${rowClass}`}>
      <span className={styles.no}>{row.kind === 'insert' ? '' : row.oldNo}</span>
      <span className={styles.no}>{row.kind === 'delete' ? '' : row.newNo}</span>
      <span className={styles.mark} aria-hidden>
        {row.kind === 'delete' ? '−' : row.kind === 'insert' ? '+' : ''}
      </span>
      <RowText parts={row.parts} kind={row.kind} />
    </div>
  );
}

/**
 * One diff of two documents: exact lines (Myers), changed characters marked inside edited lines,
 * long unchanged stretches folded. It has no scroll area of its own; the page around it scrolls.
 */
export function SnapshotDiff({ before, after }: { before: string; after: string }) {
  const result = useMemo(() => diffText(before, after), [before, after]);
  const segments = useMemo(() => foldRows(result.rows, 3), [result]);
  const [showAll, setShowAll] = useState(false);
  const [unfolded, setUnfolded] = useState<ReadonlySet<number>>(() => new Set());

  const identical = result.addedLines === 0 && result.removedLines === 0;
  const folds = segments.filter((segment) => segment.type === 'fold').length;

  return (
    <div className={styles.diff}>
      <div className={styles.toolbar}>
        <span className={styles.statAdded} title="Добавлено строк / изменённых символов">
          +{result.addedLines} строк · {result.addedChars} симв.
        </span>
        <span className={styles.statRemoved} title="Удалено строк / изменённых символов">
          −{result.removedLines} строк · {result.removedChars} симв.
        </span>
        {result.approximate && (
          <span className={styles.statWarn} title="Документы слишком разные для точного построчного сравнения">
            приблизительно: середина заменена целиком
          </span>
        )}
        {folds > 0 && !identical && (
          <button type="button" className={styles.toolbarButton} onClick={() => setShowAll((value) => !value)}>
            {showAll ? 'Свернуть неизменённое' : 'Показать весь документ'}
          </button>
        )}
      </div>

      {identical ? (
        <div className={styles.empty}>Снапшоты совпадают: изменений нет.</div>
      ) : (
        <div className={styles.rows}>
          {segments.map((segment, index) => {
            if (segment.type === 'rows' || showAll || unfolded.has(index)) {
              return segment.rows.map((row, rowIndex) => <Row key={`${index}-${rowIndex}`} row={row} />);
            }
            return (
              <button
                key={`fold-${index}`}
                type="button"
                className={styles.fold}
                onClick={() => setUnfolded((current) => new Set(current).add(index))}
              >
                ⋯ {segment.rows.length} неизменённых строк
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** A pair of neighbouring snapshots; the diff is computed only while the pair is open. */
export function SnapshotDiffPair({
  title,
  previousLabel,
  currentLabel,
  before,
  after,
  defaultOpen,
}: {
  title: string;
  previousLabel: string;
  currentLabel: string;
  before: string;
  after: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details className={styles.pair} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className={styles.pairSummary}>
        <strong>{title}</strong>
        <span>предыдущий: {previousLabel}</span>
        <span>текущий: {currentLabel}</span>
      </summary>
      {open && <SnapshotDiff before={before} after={after} />}
    </details>
  );
}
