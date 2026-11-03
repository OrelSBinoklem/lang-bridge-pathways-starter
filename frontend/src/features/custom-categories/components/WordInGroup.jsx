import React from 'react';
import Word from './Word';
import { useWordFunctions } from '../contexts/WordContext';

/**
 * WordInGroup - ОБЁРТКА для групповой проверки слов
 * 
 * ОТЛИЧИЯ от Word:
 * 1. Принимает wordText (текст) ИЛИ wordId (ID) - находит слово по тексту или использует ID
 * 2. Автоматически регистрирует слово в группе (groupWords.addWord)
 * 3. Всегда использует type='field' (поле ввода) и direction='direct'
 * 4. Привязан к групповой проверке через groupCheck (answers, results, setAnswer)
 * 5. Использует Word внутри себя - это обёртка над Word
 * 
 * ИСПОЛЬЗОВАНИЕ: В кастомных категориях для групповой проверки нескольких слов
 * 
 * @param {string} wordText - Текст слова для поиска (например "summa") - опционально, если передан wordId
 * @param {number} wordId - ID слова напрямую - опционально, если передан wordText
 * @param {object} groupCheck - Объект с состоянием проверки группы (answers, results, setAnswer)
 * @param {object} groupWords - Объект для регистрации слов в группе
 * @param {boolean} hideAvailableWord - Скрывать слово, которое не надо отгадывать
 * @param {boolean} vertical - Вертикальное расположение
 */
const WordInGroup = ({ wordText, wordId: wordIdProp, groupCheck, groupWords, hideAvailableWord = false, vertical = false }) => {
  const { getWordPropsByText, getWordIdByText, getWordProps, getWord } = useWordFunctions();
  
  // Определяем wordId и wordText для использования
  // Приоритет: если передан wordId, используем его; иначе используем wordText
  let finalWordId = wordIdProp;
  let finalWordText = wordText;
  
  // Если передан только wordId, получаем слово и его текст для регистрации в группе
  if (wordIdProp && !wordText && getWord) {
    const word = getWord(wordIdProp);
    if (word) {
      finalWordText = word.word;
    }
  }
  
  // Если передан только wordText, находим ID
  if (wordText && !wordIdProp && getWordIdByText) {
    const foundId = getWordIdByText(wordText);
    if (foundId) {
      finalWordId = foundId;
    }
  }
  
  // Если передан и wordId, и wordText, используем wordId (приоритет)
  if (wordIdProp && wordText) {
    finalWordId = wordIdProp;
    // wordText оставляем для регистрации в группе
  }
  
  // Автоматическая регистрация слова в группе (это делает WordInGroup уникальным!)
  React.useEffect(() => {
    if (groupWords && finalWordText) {
      groupWords.addWord(finalWordText);
    }
  }, [finalWordText, groupWords]);
  
  // Если не удалось определить wordId, не рендерим компонент
  if (!finalWordId) {
    return <div>Слово {wordIdProp ? `с ID ${wordIdProp}` : `"${wordText}"`} не найдено</div>;
  }
  
  // Получаем пропсы для Word через контекст
  let props = null;
  
  if (wordIdProp && getWordProps) {
    // Если передан wordId, используем getWordProps напрямую
    props = getWordProps(wordIdProp, {
      type: 'field',
      direction: 'direct',
      hideAvailableWord: hideAvailableWord,
      vertical: vertical,
      directValue: groupCheck.answers[wordIdProp] || '',
      onDirectChange: groupCheck.setAnswer,
      highlightDirectCorrect: groupCheck.results[wordIdProp] === true,
      highlightDirectIncorrect: groupCheck.results[wordIdProp] === false,
    });
  } else if (finalWordText && getWordPropsByText) {
    // Если передан wordText, используем getWordPropsByText
    props = getWordPropsByText(finalWordText, {
      type: 'field',
      direction: 'direct',
      hideAvailableWord: hideAvailableWord,
      vertical: vertical,
      directValue: groupCheck.answers[finalWordId] || '',
      onDirectChange: groupCheck.setAnswer,
      highlightDirectCorrect: groupCheck.results[finalWordId] === true,
      highlightDirectIncorrect: groupCheck.results[finalWordId] === false,
    });
  }
  
  // Использует Word внутри себя - это обёртка!
  if (!props) {
    return <div>Слово {wordIdProp ? `с ID ${wordIdProp}` : `"${wordText}"`} не найдено</div>;
  }
  
  return <Word {...props} />;
};

export default WordInGroup;

