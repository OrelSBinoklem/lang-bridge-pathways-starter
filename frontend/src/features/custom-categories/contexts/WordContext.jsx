'use client';

import React, { createContext, useContext } from 'react';

/**
 * Контекст для функций работы со словами
 */
const WordContext = createContext(null);

/**
 * Провайдер контекста
 */
export const WordProvider = ({ children, getWordPropsByText, getWordIdByText, getWordProps, getWord }) => {
  return (
    <WordContext.Provider value={{ getWordPropsByText, getWordIdByText, getWordProps, getWord }}>
      {children}
    </WordContext.Provider>
  );
};

/**
 * Хук для использования функций работы со словами
 */
export const useWordFunctions = () => {
  const context = useContext(WordContext);
  if (!context) {
    throw new Error('useWordFunctions must be used within WordProvider');
  }
  return context;
};

export default WordContext;
