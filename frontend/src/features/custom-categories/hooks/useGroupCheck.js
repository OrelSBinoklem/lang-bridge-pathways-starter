'use client';

import { useState } from 'react';

/**
 * Простой хук для групповой проверки слов
 * Хранит введённые ответы и результаты проверки для подсветки
 */
export const useGroupCheck = () => {
  const [answers, setAnswers] = useState({}); // { [wordId]: "введённый текст" }
  const [results, setResults] = useState({}); // { [wordId]: true/false/null }
  
  /**
   * Установить ответ для слова
   */
  const setAnswer = (wordId, value) => {
    setAnswers(prev => ({ ...prev, [wordId]: value }));
  };
  
  /**
   * Установить результат проверки
   */
  const setResult = (wordId, isCorrect) => {
    setResults(prev => ({ ...prev, [wordId]: isCorrect }));
  };
  
  /**
   * Сбросить всё
   */
  const reset = (wordIds = []) => {
    if (wordIds.length === 0) {
      setAnswers({});
      setResults({});
    } else {
      setAnswers(prev => {
        const newAnswers = { ...prev };
        wordIds.forEach(id => delete newAnswers[id]);
        return newAnswers;
      });
      setResults(prev => {
        const newResults = { ...prev };
        wordIds.forEach(id => delete newResults[id]);
        return newResults;
      });
    }
  };
  
  return {
    answers,      // { [wordId]: "текст" }
    results,      // { [wordId]: true/false/null }
    setAnswer,    // (wordId, value) => void
    setResult,    // (wordId, isCorrect) => void
    reset,        // (wordIds?) => void
  };
};

export default useGroupCheck;
