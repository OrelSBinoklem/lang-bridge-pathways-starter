'use client';

import { useState, useCallback, useRef } from 'react';

/**
 * Хук для автоматического сбора слов из WordInGroup компонентов
 */
export const useGroupWords = () => {
  const [words, setWords] = useState([]);
  const addWord = useCallback((wordText) => {
    setWords(prev => {
      if (!prev.includes(wordText)) {
        return [...prev, wordText];
      }
      return prev;
    });
  }, []);
  
  const removeWord = useCallback((wordText) => {
    setWords(prev => prev.filter(word => word !== wordText));
  }, []);
  
  const reset = useCallback(() => {
    setWords([]);
  }, []);
  
  return {
    words,
    addWord,
    removeWord,
    reset
  };
};

export default useGroupWords;
