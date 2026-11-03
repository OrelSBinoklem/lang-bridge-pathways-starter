'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import CategoryLayout from '../layouts/CategoryLayout';
import useGroupCheck from '../hooks/useGroupCheck';
import useInlineTrainingStack from '../hooks/useInlineTrainingStack';
import { WordProvider } from '../contexts/WordContext';
import useGroupWords from '../hooks/useGroupWords';
import WordInput from '../components/WordInput';
import {
  getVisibleWordsFromNounTable,
  parseNounCell,
} from '../utils/helpers';

const findVisibleActiveField = (activeWordId) => {
  const root = document.querySelector('.noun-declension-category--training, .verb-conjugation-category--training');
  if (!root) return null;

  if (activeWordId) {
    const fields = root.querySelectorAll(`[data-table-word-id="${activeWordId}"]`);
    for (const field of fields) {
      const rect = field.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return field.querySelector('.word-input--field-active') || field;
      }
    }
  }

  for (const el of root.querySelectorAll('.word-input--field-active')) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return el;
  }
  return null;
};

const scrollActiveFieldIntoView = (activeWordId) => {
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }

  const doScroll = () => {
    const el = findVisibleActiveField(activeWordId);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  if (isMobile) {
    window.setTimeout(doScroll, 320);
  } else {
    requestAnimationFrame(() => requestAnimationFrame(doScroll));
  }
};

const declensionCases = [
  { key: 'kas', label: 'kas?' },
  { key: 'ka', label: 'kā?' },
  { key: 'kam', label: 'kam?' },
  { key: 'ko', label: 'ko?' },
  { key: 'kur', label: 'kur?' },
];

const declensionNumbers = [
  { key: 'sing', label: 'Vienskaitlis' },
  { key: 'plur', label: 'Daudzskaitlis' },
];

const NounDeclensionContent = ({
  nouns,
  nounGroups,
  categoryProps,
  inlineTrainingActive,
  inlineStackEpoch = 0,
  onInlineTrainingComplete,
  onInlineStackExhausted,
  getWordPropsByText,
  stats,
  getWordIdByText,
  getWordIdByTranslation,
  getWordProps,
  getWord,
  dictionaryWordsById,
  userWordsData,
  displayStatuses,
  dictionaryId,
  editingWordId,
  onToggleEdit,
  onRefreshDictionaryWords,
  formatTime,
  currentTime,
  checkGroupWords,
}) => {
  const groupCheck = useGroupCheck();
  const groupWords = useGroupWords();
  const [inputValues, setInputValues] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const resolveNounCellWordId = useCallback((cellValue, lemma, cellKey) => {
    const parsed = parseNounCell(cellValue, lemma, cellKey);
    if (!parsed) return null;
    const byTranslation = getWordIdByTranslation(parsed.lookupKey);
    if (byTranslation) return byTranslation;
    return getWordIdByText(parsed.form);
  }, [getWordIdByTranslation, getWordIdByText]);

  const visibleWords = useMemo(
    () => getVisibleWordsFromNounTable(nouns, resolveNounCellWordId, dictionaryWordsById),
    [nouns, resolveNounCellWordId, dictionaryWordsById]
  );

  const visibleWordIds = useMemo(
    () => new Set(visibleWords.map((w) => w.id)),
    [visibleWords]
  );

  const { activeWordId, recordSubmit } = useInlineTrainingStack({
    inlineTrainingActive,
    stackEpoch: inlineStackEpoch,
    visibleWords,
    visibleWordIds,
    userWordsData,
    currentTime,
    groupCheck,
    onStackExhausted: onInlineStackExhausted,
    onTrainingComplete: onInlineTrainingComplete,
  });

  useEffect(() => {
    if (!inlineTrainingActive || !activeWordId) return;
    setInputValues((prev) => ({ ...prev, [activeWordId]: '' }));
    scrollActiveFieldIntoView(activeWordId);
  }, [activeWordId, inlineTrainingActive]);

  const handleInputChange = (wordId, value) => {
    setInputValues((prev) => ({ ...prev, [wordId]: value }));
    const word = dictionaryWordsById[wordId];
    if (word?.word && !groupWords.words.includes(word.word)) {
      groupWords.addWord(word.word);
    }
    groupCheck.setAnswer(wordId, value);
  };

  const handleSubmitActiveWord = async () => {
    if (!inlineTrainingActive || !activeWordId || submitting) return;
    const answer = (inputValues[activeWordId] || '').trim();
    if (!answer) return;

    setSubmitting(true);
    const wordId = activeWordId;
    try {
      const results = await checkGroupWords([wordId], { [wordId]: answer }, true, {
        creditDirectOnRevertCorrect: true,
      });
      const isCorrect = results[wordId] === true;
      groupCheck.setResult(wordId, isCorrect);
      recordSubmit(wordId, isCorrect);
    } finally {
      setSubmitting(false);
    }
  };

  const getWordInputProps = (cellValue, lemma, cellKey) => {
    const wordId = resolveNounCellWordId(cellValue, lemma, cellKey);
    if (!wordId) return null;

    const word = dictionaryWordsById[wordId];
    const userData = userWordsData[wordId];
    const displayStatus = displayStatuses[wordId];
    if (!word) return null;

    const isActive = inlineTrainingActive && activeWordId === wordId;
    const isInTable = wordId && visibleWordIds.has(wordId);
    const onCooldown = Boolean(displayStatus?.cooldownRevert);
    const easyRevert = Boolean(userData?.mode_education_revert);
    const isLearnedRevert =
      (Number(userData?.correct_attempts_revert) || 0) >= 2 && !easyRevert;
    const allowInput = inlineTrainingActive && isActive && isInTable && !onCooldown && !isLearnedRevert;
    const forceHidden = inlineTrainingActive && isInTable && !isActive && !onCooldown && !isLearnedRevert;

    return {
      word,
      userData,
      displayStatus,
      formatTime,
      dictionaryId,
      editingWordId,
      onToggleEdit,
      onRefreshDictionaryWords,
      value: inputValues[wordId] || '',
      onChange: allowInput ? handleInputChange : null,
      onSubmit: isActive ? handleSubmitActiveWord : null,
      autoFocus: isActive,
      inputDisabled: inlineTrainingActive && isActive && submitting,
      highlightCorrect: groupCheck.results[wordId] === true,
      highlightIncorrect: groupCheck.results[wordId] === false,
      fieldActive: isActive && isInTable,
      forceHidden,
      placeholder: 'Введите слово',
    };
  };

  const renderWordField = (cellKey, cellValue, lemma, wordId) => {
    const inputProps = getWordInputProps(cellValue, lemma, cellKey);
    return (
      <div key={cellKey} className="verb-word-field" data-table-word-id={wordId || undefined}>
        {inputProps ? <WordInput {...inputProps} /> : <div className="word-input empty" />}
      </div>
    );
  };

  const renderEmptyField = (cellKey) => (
    <div key={cellKey} className="word-input empty" />
  );

  const renderNumberBlockDesktop = (lemmas, numberKey, numberLabel) => {
    const hasAnyForm = lemmas.some((lemma) =>
      declensionCases.some((c) => {
        const cellKey = `${numberKey}_${c.key}`;
        return parseNounCell(nouns[lemma]?.[cellKey], lemma, cellKey);
      })
    );
    if (!hasAnyForm) return null;

    return (
      <div key={numberKey} className="noun-number-section">
        <h4 className="noun-number-section__heading">{numberLabel}</h4>
        <div className="verb-row verb-row--header">
          <span className="verb-pronoun" aria-hidden="true" />
          <div className="verb-words verb-words--headers">
            {lemmas.map((lemma) => (
              <div key={lemma} className="noun-column-cell noun-column-cell--header">
                <span className="noun-column-header">{lemma}</span>
              </div>
            ))}
          </div>
        </div>
        {declensionCases.map((c, rowIndex) => {
          const rowCells = lemmas.map((lemma) => {
            const cellKey = `${numberKey}_${c.key}`;
            const cellValue = nouns[lemma]?.[cellKey];
            if (!parseNounCell(cellValue, lemma, cellKey)) return null;
            const wordId = resolveNounCellWordId(cellValue, lemma, cellKey);
            return { lemma, cellKey, cellValue, wordId };
          }).filter(Boolean);

          if (rowCells.length === 0) return null;

          return (
            <div
              key={c.key}
              className={rowIndex % 2 === 0 ? 'verb-row' : 'verb-row verb-row-even'}
            >
              <span className="verb-pronoun">{c.label}</span>
              <div className="verb-words">
                {lemmas.map((lemma) => {
                  const cellKey = `${numberKey}_${c.key}`;
                  const cellValue = nouns[lemma]?.[cellKey];
                  return (
                    <div key={`${lemma}_${cellKey}`} className="noun-column-cell">
                      {!parseNounCell(cellValue, lemma, cellKey)
                        ? renderEmptyField(`${lemma}_${cellKey}`)
                        : renderWordField(
                            cellKey,
                            cellValue,
                            lemma,
                            resolveNounCellWordId(cellValue, lemma, cellKey)
                          )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderNumberBlockMobile = (lemmas, numberKey, numberLabel) => {
    const hasAnyForm = lemmas.some((lemma) =>
      declensionCases.some((c) => {
        const cellKey = `${numberKey}_${c.key}`;
        return parseNounCell(nouns[lemma]?.[cellKey], lemma, cellKey);
      })
    );
    if (!hasAnyForm) return null;

    return (
      <section key={numberKey} className="verb-tense-group noun-number-group">
        <h4 className="verb-tense-group__heading">{numberLabel}</h4>
        {lemmas.map((lemma) => {
          const caseRows = declensionCases
            .map((c) => {
              const cellKey = `${numberKey}_${c.key}`;
              const cellValue = nouns[lemma]?.[cellKey];
              if (!parseNounCell(cellValue, lemma, cellKey)) return null;
              const wordId = resolveNounCellWordId(cellValue, lemma, cellKey);
              return { c, cellKey, cellValue, wordId };
            })
            .filter(Boolean);

          if (caseRows.length === 0) return null;

          return (
            <section key={lemma} className="verb-tense-group noun-lemma-group">
              <h4 className="verb-tense-group__heading noun-lemma-group__heading">{lemma}</h4>
              {caseRows.map(({ c, cellKey, cellValue, wordId }) => {
                const inputProps = getWordInputProps(cellValue, lemma, cellKey);
                return (
                  <div key={cellKey} className="verb-tense-block">
                    <span className="verb-pronoun">{c.label}</span>
                    <div className="verb-tense-stack">
                      <div className="verb-word-field" data-table-word-id={wordId || undefined}>
                        {inputProps ? <WordInput {...inputProps} /> : <div className="word-input empty" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}
      </section>
    );
  };

  const groups = nounGroups?.length
    ? nounGroups
    : Object.keys(nouns).reduce((acc, lemma, index, keys) => {
        const chunkIndex = Math.floor(index / 3);
        if (!acc[chunkIndex]) {
          acc[chunkIndex] = { title: null, lemmas: [] };
        }
        acc[chunkIndex].lemmas.push(lemma);
        return acc;
      }, []);

  return (
    <WordProvider
      getWordPropsByText={getWordPropsByText}
      getWordIdByText={getWordIdByText}
      getWordProps={getWordProps}
      getWord={getWord}
    >
      <div
        className={`verb-conjugation-category noun-declension-category${
          inlineTrainingActive ? ' verb-conjugation-category--training noun-declension-category--training' : ''
        }`}
      >
        <div className="category-header" style={{ marginBottom: '20px' }}>
          <h2>📚 {categoryProps.category.category_name}</h2>
          <div className="stats">
            📚 Всего: <strong>{stats.total}</strong>
            {' • '}
            ✅ Изучено: <strong>{stats.learned}</strong>
            {inlineTrainingActive && (
              <>
                {' • '}
                <span className="verb-inline-training-hint">Введите слово в подсвеченное поле и нажмите Enter</span>
              </>
            )}
          </div>
        </div>

        {groups.map((group, groupIndex) => {
          const lemmas = group.lemmas.filter((lemma) => nouns[lemma]);
          if (lemmas.length === 0) return null;

          return (
            <div key={group.title || groupIndex} className="verb-container noun-group-container">
              {group.title && (
                <div className="verb-header">
                  <div className="verb-title">
                    <div className="verb-name">{group.title}</div>
                  </div>
                </div>
              )}
              <div className="verb-rows">
                <div className="verb-rows__desktop">
                  {declensionNumbers.map((n) =>
                    renderNumberBlockDesktop(lemmas, n.key, n.label)
                  )}
                </div>
                <div className="verb-rows__mobile">
                  {declensionNumbers.map((n) =>
                    renderNumberBlockMobile(lemmas, n.key, n.label)
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </WordProvider>
  );
};

const NounDeclensionBase = ({
  nouns,
  nounGroups,
  inlineTrainingActive = false,
  inlineStackEpoch = 0,
  onInlineTrainingComplete,
  onInlineStackExhausted,
  ...props
}) => (
  <CategoryLayout {...props}>
    {(renderProps) => (
      <NounDeclensionContent
        nouns={nouns}
        nounGroups={nounGroups}
        categoryProps={props}
        inlineTrainingActive={inlineTrainingActive}
        inlineStackEpoch={inlineStackEpoch}
        onInlineTrainingComplete={onInlineTrainingComplete}
        onInlineStackExhausted={onInlineStackExhausted}
        {...renderProps}
      />
    )}
  </CategoryLayout>
);

export default NounDeclensionBase;
