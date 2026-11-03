'use client';

import React from 'react';
import { checkTranslation, getWordTranslationList, normalizeString } from '../utils/helpers';
import ExamenViewModeSwitch from '../components/ExamenViewModeSwitch';
import { hasCustomCategoryTemplate } from '../utils/examenViewMode';
import { useAdminMode } from '../contexts/AdminModeContext';
import { submitAttempt } from '@/features/training/trainingSocket';

/**
 * Layout для кастомных категорий: индексы слов, checkGroupWords → Training WS.
 */
const CategoryLayout = ({
  category,
  words,
  dictionaryId,
  dictionaryWords,
  dictionaryWordsById,
  userWordsData,
  displayStatuses,
  editingWordId,
  onToggleEdit,
  onRefreshDictionaryWords,
  onRefreshUserData,
  formatTime,
  mode,
  currentTime,
  children,
  categoryId,
  translationLang,
}) => {
  const cooldownTierPref = (() => {
    if (typeof document === 'undefined') return 0;
    const m = document.cookie.match(/(?:^|; )lbp_cooldown_tier_pref=([^;]+)/);
    const v = Number(m?.[1] ?? 0);
    return Number.isFinite(v) ? Math.max(0, Math.min(2, v)) : 0;
  })();

  const submitWordAttempt = async (wordId, isRevertMode, isCorrect, isFirstAttempt) => {
    return submitAttempt({
      word_id: wordId,
      is_revert: isRevertMode,
      is_correct: isCorrect,
      is_first_attempt: Boolean(isFirstAttempt),
      cooldown_tier: cooldownTierPref,
    });
  };

  const checkGroupWords = async (wordIds, answers, isRevert = false, options = {}) => {
    const { creditDirectOnRevertCorrect = false } = options;
    const results = {};
    let hasChanges = false;
    const seen = new Set();
    const uniqueWordIds = wordIds.filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    for (const wordId of uniqueWordIds) {
      const word = dictionaryWordsById[wordId];
      if (!word) continue;

      const displayStatus = displayStatuses[wordId];
      const onCooldown = isRevert ? displayStatus?.cooldownRevert : displayStatus?.cooldownDirect;
      if (onCooldown) continue;

      const answer = answers[wordId] || '';
      if (!answer.trim()) continue;

      const isCorrect = checkTranslation(word, answer, isRevert, translationLang);
      results[wordId] = isCorrect;

      const userData = userWordsData[wordId];
      const me = isRevert ? userData?.mode_education_revert : userData?.mode_education;
      const isFirstAttempt = me ? 0 : 1;

      try {
        const pendingRequests = [submitWordAttempt(wordId, isRevert, isCorrect, isFirstAttempt)];

        if (isCorrect && isRevert && creditDirectOnRevertCorrect && !displayStatus?.cooldownDirect) {
          const directEasy = Boolean(userData?.mode_education);
          const directLearned = (userData?.correct_attempts ?? 0) >= 2 && !directEasy;
          if (!directLearned) {
            const isFirstAttemptDirect = userData?.mode_education ? 0 : 1;
            pendingRequests.push(submitWordAttempt(wordId, false, true, isFirstAttemptDirect));
          }
        }

        await Promise.all(pendingRequests);
        hasChanges = true;
      } catch (err) {
        console.error('Ошибка обновления прогресса:', err);
      }
    }

    if (hasChanges && onRefreshUserData) {
      await onRefreshUserData();
    }

    return results;
  };

  const getWordProps = (wordId, extraProps = {}) => ({
    key: wordId,
    wordId,
    dictionaryWords,
    userWordsData,
    displayStatus: displayStatuses[wordId],
    dictionaryId,
    editingWordId,
    onToggleEdit,
    onRefreshDictionaryWords,
    mode,
    currentTime,
    ...extraProps,
  });

  const getWord = (wordId) => dictionaryWordsById[wordId];

  const wordIndexByCategory = {};
  const translationIndexByCategory = {};

  const addWordToCategoryIndexes = (word, catId, priority = false) => {
    if (!wordIndexByCategory[catId]) wordIndexByCategory[catId] = {};
    if (!translationIndexByCategory[catId]) translationIndexByCategory[catId] = {};
    if (priority || !wordIndexByCategory[catId][word.word]) {
      wordIndexByCategory[catId][word.word] = word;
    }
    getWordTranslationList(word, translationLang).forEach((t) => {
        const norm = normalizeString(t);
        if (priority || !translationIndexByCategory[catId][norm]) {
          translationIndexByCategory[catId][norm] = word;
        }
      });
  };

  if (words && words.length > 0) {
    const catId = category?.id;
    if (catId != null) {
      words.forEach((word) => addWordToCategoryIndexes(word, catId, true));
    }
  }
  (dictionaryWords || []).forEach((word) => {
    if (Array.isArray(word.category_ids)) {
      word.category_ids.forEach((catId) => addWordToCategoryIndexes(word, catId, false));
    }
  });

  const getWordByText = (wordText, catId = category.id) =>
    wordIndexByCategory[catId]?.[wordText] || null;

  const getWordIdByText = (wordText, catId = category.id) =>
    getWordByText(wordText, catId)?.id || null;

  const getWordByTranslation = (translationKey, catId = category.id) => {
    const key = normalizeString(translationKey);
    return translationIndexByCategory[catId]?.[key] || null;
  };

  const getWordIdByTranslation = (translationKey, catId = category.id) =>
    getWordByTranslation(translationKey, catId)?.id || null;

  const isWordInCurrentCategory = (wordText, catId = category.id) =>
    Boolean(wordIndexByCategory[catId]?.[wordText]);

  const getWordPropsByText = (wordText, extraProps = {}) => {
    const wordId = getWordIdByText(wordText);
    if (!wordId) return null;
    return getWordProps(wordId, extraProps);
  };

  const filterWords = (filterFn) => words.filter(filterFn);

  const groupByStatus = () => ({
    learned: words.filter((w) => displayStatuses[w.id]?.fullyLearned),
    learning: words.filter((w) => !displayStatuses[w.id]?.fullyLearned),
    all: words,
  });

  const getStats = () => {
    const learned = words.filter((w) => displayStatuses[w.id]?.fullyLearned).length;
    const total = words.length;
    return {
      total,
      learned,
      learning: total - learned,
      progress: total > 0 ? Math.round((learned / total) * 100) : 0,
    };
  };

  const renderProps = {
    category,
    words,
    dictionaryWordsById,
    userWordsData,
    displayStatuses,
    getWordProps,
    getWord,
    getWordByText,
    getWordIdByText,
    getWordByTranslation,
    getWordIdByTranslation,
    getWordPropsByText,
    isWordInCurrentCategory,
    wordIndexByCategory,
    translationIndexByCategory,
    filterWords,
    groupByStatus,
    stats: getStats(),
    checkGroupWords,
    dictionaryId,
    editingWordId,
    onToggleEdit,
    onRefreshDictionaryWords,
    onRefreshUserData,
    formatTime,
    mode,
    currentTime,
    translationLang,
  };

  const categoryIdForManagement =
    categoryId || category?.id || 0;
  const { isAdminModeActive } = useAdminMode();
  const showDefaultViewLink =
    isAdminModeActive && hasCustomCategoryTemplate(dictionaryId, categoryIdForManagement);

  return (
    <>
      {showDefaultViewLink && <ExamenViewModeSwitch forceDefaultView={false} />}
      {typeof children === 'function' ? children(renderProps) : children}
    </>
  );
};

export default CategoryLayout;
