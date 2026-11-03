'use client';

import { useTranslations } from 'next-intl';
import type { ReferenceTenseForms, VerbModalData } from '@/features/verb-search/types';
import styles from '@/features/verb-search/verb-modal.module.css';

type Props = {
  verbData: VerbModalData | null;
  onClose: () => void;
};

function collapseTenseToRow(tenseData: ReferenceTenseForms = {}): string[] {
  const firstSing = tenseData['1sg'] || '';
  const secondSing = tenseData['2sg'] || '';
  const thirdSing = tenseData['3sg'] || '';
  const firstPl = tenseData['1pl'] || '';
  const secondPl = tenseData['2pl'] || '';
  const thirdPl = tenseData['3pl'] || '';

  let thirdCombined = '';
  if (thirdSing && thirdPl) {
    thirdCombined = thirdSing === thirdPl ? thirdSing : `${thirdSing} / ${thirdPl}`;
  } else if (thirdSing || thirdPl) {
    thirdCombined = thirdSing || thirdPl;
  }

  return [
    firstSing || '—',
    secondSing || '—',
    thirdCombined || '—',
    firstPl || '—',
    secondPl || '—',
  ];
}

export function VerbModal({ verbData, onClose }: Props) {
  const t = useTranslations('VerbSearch');

  if (!verbData) return null;

  const lemma = verbData.lemma || verbData.latvian || verbData.verb || '';
  const translationRu = verbData.translation?.ru || verbData.russian || '';
  const translationUk = verbData.translation?.uk || verbData.ukrainian || '';
  const className = verbData.className || verbData.class || '';
  const forms = Array.isArray(verbData.forms) ? verbData.forms : [];
  const generatedFormsAvailableFlag =
    typeof verbData.generatedFormsAvailable === 'boolean'
      ? verbData.generatedFormsAvailable
      : null;
  const hasFullParadigm = forms.length >= 15;
  const shouldShowGeneratedTable =
    generatedFormsAvailableFlag === null
      ? hasFullParadigm
      : generatedFormsAvailableFlag && hasFullParadigm;
  const hasPartialForms = !shouldShowGeneratedTable && forms.length > 0;
  const showGeneratedContent = shouldShowGeneratedTable || hasPartialForms;
  const matchedTableNumbers = Array.isArray(verbData.matchedTableNumbers)
    ? verbData.matchedTableNumbers
    : [];
  const referenceTable = verbData.referenceTable || null;
  const referenceSource = referenceTable?.source || null;
  const pronouns = ['es', 'tu', '3. pers.', 'mēs', 'jūs'];
  const personKeys = ['1sg', '2sg', '3', '1pl', '2pl'];

  const classDisplay =
    className && String(className).toLowerCase() === 'irregular'
      ? t('irregularClass')
      : className;

  const tenses = hasFullParadigm
    ? [
        { key: 'past', label: 'Pagātne', values: forms.slice(5, 10) },
        { key: 'present', label: 'Tagadne', values: forms.slice(0, 5) },
        { key: 'future', label: 'Nākotne', values: forms.slice(10, 15) },
      ]
    : [];

  const referenceTenses = referenceSource?.forms
    ? [
        {
          key: 'past',
          label: 'Pagātne',
          values: collapseTenseToRow(referenceSource.forms.past || {}),
        },
        {
          key: 'present',
          label: 'Tagadne',
          values: collapseTenseToRow(referenceSource.forms.present || {}),
        },
        {
          key: 'future',
          label: 'Nākotne',
          values: collapseTenseToRow(referenceSource.forms.future || {}),
        },
      ]
    : [];

  const hasReferenceTable = referenceTenses.some((tense) =>
    tense.values.some((value) => value && value !== '—'),
  );
  const showReferencePlaceholder = !hasReferenceTable && matchedTableNumbers.length > 0;

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div className={styles.content} onClick={(e) => e.stopPropagation()} role="dialog">
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={t('close')}>
          &times;
        </button>

        <div className={styles.header}>
          <div className={styles.infoLine}>
            <span className={styles.lemma}>{lemma || '—'}</span>
            {classDisplay ? <span className={styles.classChip}>{classDisplay}</span> : null}
            <span className={styles.transInline}>
              <span className={styles.transLabel}>RU:</span>
              <span className={styles.transValue}>{translationRu || '—'}</span>
            </span>
            <span className={styles.transInline}>
              <span className={styles.transLabel}>UK:</span>
              <span className={styles.transValue}>{translationUk || '—'}</span>
            </span>
          </div>
        </div>

        <div
          className={
            (hasReferenceTable || showReferencePlaceholder) && showGeneratedContent
              ? styles.bodyWithReference
              : styles.body
          }
        >
          {showGeneratedContent ? (
            <div className={styles.tableWrapper} data-verb-table="generated">
              <div className={styles.tableTitle}>{t('generatedTable')}</div>
              {shouldShowGeneratedTable ? (
                <table className={styles.formsTable}>
                  <thead>
                    <tr>
                      <th>Personas</th>
                      {tenses.map((tense) => (
                        <th key={tense.key}>{tense.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pronouns.map((pronoun, rowIndex) => (
                      <tr key={pronoun}>
                        <td className={styles.pronoun}>{pronoun}</td>
                        {tenses.map((tense) => (
                          <td
                            key={`${tense.key}-${rowIndex}`}
                            className={styles.formValue}
                            data-verb-tense={tense.key}
                            data-verb-person={personKeys[rowIndex]}
                            data-verb-table="generated"
                          >
                            {tense.values[rowIndex] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className={styles.formsGrid}>
                  {forms.map((form, index) => (
                    <div key={index} className={styles.formCell}>
                      <span className={styles.formIndex}>{index + 1}.</span>
                      <span className={styles.formText}>{form}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {hasReferenceTable ? (
            <div className={styles.tableWrapper} data-verb-table="reference">
              <div className={styles.tableTitle}>
                {t('referenceTable')}{' '}
                {referenceSource?.infinitive ? <strong>&quot;{referenceSource.infinitive}&quot;</strong> : null}{' '}
                {t('referenceSuffix')}
              </div>
              <table className={styles.formsTable}>
                <thead>
                  <tr>
                    <th>Personas</th>
                    {referenceTenses.map((tense) => (
                      <th key={`ref-${tense.key}`}>{tense.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pronouns.map((pronoun, rowIndex) => (
                    <tr key={`ref-${pronoun}`}>
                      <td className={styles.pronoun}>{pronoun}</td>
                      {referenceTenses.map((tense) => (
                        <td
                          key={`ref-${tense.key}-${rowIndex}`}
                          className={styles.formValue}
                          data-verb-tense={tense.key}
                          data-verb-person={personKeys[rowIndex]}
                          data-verb-table="reference"
                        >
                          {tense.values[rowIndex] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {showReferencePlaceholder && !hasReferenceTable ? (
            <div className={styles.tableWrapper}>
              <div className={styles.tableTitle}>Etalona tabula</div>
              <div className={styles.referenceMissing}>
                {t('referenceMissing', { numbers: matchedTableNumbers.join(', ') })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
