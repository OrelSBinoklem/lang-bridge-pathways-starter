'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import CategoryLayout from '../layouts/CategoryLayout';
import useGroupCheck from '../hooks/useGroupCheck';
import useInlineTrainingStack from '../hooks/useInlineTrainingStack';
import { WordProvider } from '../contexts/WordContext';
import useGroupWords from '../hooks/useGroupWords';
import WordInput from '../components/WordInput';
import { getVisibleWordsFromVerbTable, parseVerbCell } from '../utils/helpers';

/** На телефоне desktop-таблица скрыта — скроллим к видимой ячейке (mobile-layout) */
const findVisibleActiveField = (activeWordId) => {
  const root = document.querySelector('.verb-conjugation-category--training');
  if (!root) return null;

  if (activeWordId) {
    const fields = root.querySelectorAll(`[data-verb-word-id="${activeWordId}"]`);
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
    // После blur клавиатура закрывается — ждём пересчёт viewport
    window.setTimeout(doScroll, 320);
  } else {
    requestAnimationFrame(() => requestAnimationFrame(doScroll));
  }
};

const pronouns = [
  { key: 'es', label: 'Es' },
  { key: 'tu', label: 'Tu' },
  { key: '3pers', label: '3 pers.' },
  { key: 'we', label: 'Mēs' },
  { key: 'you_pl', label: 'Jūs' },
];
const tenses = ['past', 'present', 'future'];
const tenseLabels = {
  past: 'pagadne',
  present: 'tagadne',
  future: 'nakotne',
};

const VerbConjugationContent = ({
  verbs,
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

  const resolveVerbCellWordId = useCallback((cellValue, verbKey, conjKey) => {
    const parsed = parseVerbCell(cellValue, verbKey, conjKey);
    if (!parsed) return null;
    const byTranslation = getWordIdByTranslation(parsed.lookupKey);
    if (byTranslation) return byTranslation;
    return getWordIdByText(parsed.form);
  }, [getWordIdByTranslation, getWordIdByText]);

  // Только слова из непустых ячеек таблицы (необычные формы), не вся категория
  const visibleWords = useMemo(
    () => getVisibleWordsFromVerbTable(verbs, resolveVerbCellWordId, dictionaryWordsById),
    [verbs, resolveVerbCellWordId, dictionaryWordsById]
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

  const getWordInputProps = (cellValue, verbKey, conjKey) => {
    const wordId = resolveVerbCellWordId(cellValue, verbKey, conjKey);
    if (!wordId) return null;

    const word = dictionaryWordsById[wordId];
    const userData = userWordsData[wordId];
    const displayStatus = displayStatuses[wordId];
    if (!word) return null;

    const isActive = inlineTrainingActive && activeWordId === wordId;
    const isInTable = wordId && visibleWordIds.has(wordId);
    const onCooldown = Boolean(displayStatus?.cooldownRevert);
    // showWord=true при отсутствии прогресса = «открыто для просмотра», НЕ «выучено»
    const easyRevert = Boolean(userData?.mode_education_revert);
    const isLearnedRevert =
      (Number(userData?.correct_attempts_revert) || 0) >= 2 && !easyRevert;
    // Ввод только в активном поле; на откате — таймер; выученное — не маскируем
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

  const renderWordField = (key, cellValue, verbKey, conjKey, wordId) => {
    const inputProps = getWordInputProps(cellValue, verbKey, conjKey);
    return (
      <div
        key={key}
        className="verb-word-field"
        data-verb-word-id={wordId || undefined}
      >
        {inputProps ? (
          <WordInput {...inputProps} />
        ) : (
          <div className="word-input empty" />
        )}
      </div>
    );
  };

  return (
    <WordProvider
      getWordPropsByText={getWordPropsByText}
      getWordIdByText={getWordIdByText}
      getWordProps={getWordProps}
      getWord={getWord}
    >
      <div className={`verb-conjugation-category${inlineTrainingActive ? ' verb-conjugation-category--training' : ''}`}>
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

        {Object.entries(verbs).map(([verbKey, verbData]) => {
          const allWords = Object.entries(verbData).filter(
            ([key, val]) => key !== 'name' && parseVerbCell(val, verbKey, key)
          );
          if (allWords.length === 0) return null;

          return (
            <div key={verbKey} className="verb-container">
              <div className="verb-header">
                <div className="verb-title">
                  <div className="verb-name">{verbData.name}</div>
                </div>
              </div>
              <div className="verb-rows">
                <div className="verb-rows__desktop">
                  {pronouns.map((pronoun, pronounIndex) => {
                    const hasConjugations = tenses.some((tense) => {
                      const key = `${pronoun.key}_${tense}`;
                      return parseVerbCell(verbData[key], verbKey, key);
                    });
                    if (!hasConjugations) return null;

                    return (
                      <div
                        key={pronoun.key}
                        className={pronounIndex % 2 === 0 ? 'verb-row' : 'verb-row verb-row-even'}
                      >
                        <span className="verb-pronoun">{pronoun.label}</span>
                        <div className="verb-words">
                          {tenses.map((tense) => {
                            const key = `${pronoun.key}_${tense}`;
                            const cellValue = verbData[key];
                            if (!parseVerbCell(cellValue, verbKey, key)) {
                              return <div key={key} className="word-input empty" />;
                            }
                            const wordId = resolveVerbCellWordId(cellValue, verbKey, key);
                            return renderWordField(key, cellValue, verbKey, key, wordId);
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="verb-rows__mobile">
                  {tenses.map((tense) => {
                    const rows = pronouns
                      .map((pronoun) => {
                        const key = `${pronoun.key}_${tense}`;
                        const cellValue = verbData[key];
                        if (!parseVerbCell(cellValue, verbKey, key)) return null;
                        const wordId = resolveVerbCellWordId(cellValue, verbKey, key);
                        return { pronoun, key, cellValue, wordId };
                      })
                      .filter(Boolean);

                    if (rows.length === 0) return null;

                    return (
                      <section key={tense} className="verb-tense-group">
                        <h4 className="verb-tense-group__heading">{tenseLabels[tense]}</h4>
                        {rows.map(({ pronoun, key, cellValue, wordId }) => {
                          const inputProps = getWordInputProps(cellValue, verbKey, key);
                          return (
                            <div key={key} className="verb-tense-block">
                              <span className="verb-pronoun">{pronoun.label}</span>
                              <div className="verb-tense-stack">
                                <div
                                  className="verb-word-field"
                                  data-verb-word-id={wordId || undefined}
                                >
                                  {inputProps ? (
                                    <WordInput {...inputProps} />
                                  ) : (
                                    <div className="word-input empty" />
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </section>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </WordProvider>
  );
};

/**
 * БАЗОВЫЙ КОМПОНЕНТ: Таблица спряжений глаголов
 */
const VerbConjugationBase = ({
  verbs,
  inlineTrainingActive = false,
  inlineStackEpoch = 0,
  onInlineTrainingComplete,
  onInlineStackExhausted,
  ...props
}) => {
  return (
    <CategoryLayout {...props}>
      {(renderProps) => (
        <VerbConjugationContent
          verbs={verbs}
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
};

export default VerbConjugationBase;
