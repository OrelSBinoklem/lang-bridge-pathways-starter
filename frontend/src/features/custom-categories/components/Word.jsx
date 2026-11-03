import React from 'react';
import WordRow from '../../components/WordRow';
import WordField from './WordField';
import { 
  formatTime, 
  getWordDisplayStatusEducation, 
  getWordDisplayStatusExamen 
} from '../utils/helpers';

/**
 * Word - УНИВЕРСАЛЬНЫЙ компонент для отображения слова
 * 
 * ОТЛИЧИЯ от WordInGroup:
 * 1. Принимает wordId напрямую (не ищет по тексту)
 * 2. НЕ регистрирует слово в группе автоматически
 * 3. Может быть type='row' (строка) или type='field' (поле ввода)
 * 4. Может быть direction='direct', 'reverse' или 'both'
 * 5. Может работать в режимах 'examen' или 'education'
 * 6. Вычисляет displayStatus автоматически
 * 7. НЕ привязан к группам - работает независимо
 * 
 * ИСПОЛЬЗОВАНИЕ: Всюду, где нужно отобразить слово (списки, тренировки, экзамены)
 * 
 * @param {number} wordId - ID слова (вместо объекта word)
 * @param {array} dictionaryWords - Массив всех слов словаря
 * @param {object} userWordsData - Объект с данными пользователей {[wordId]: userData}
 * @param {object} displayStatus - (Опционально) Уже вычисленный displayStatus - если передан, вычисление пропускается
 * @param {number} dictionaryId - ID словаря
 * @param {number} editingWordId - ID редактируемого слова
 * @param {function} onToggleEdit - Переключение редактирования
 * @param {function} onRefreshDictionaryWords - Обновление списка слов
 * @param {string} mode - 'examen' или 'education'
 * @param {boolean} showEditButton - Показывать кнопку ✏️
 * @param {number} currentTime - Текущее время (для обновления таймеров в examen)
 * @param {string} type - Тип компонента: 'row' (WordRow, по умолчанию) или 'field' (WordField)
 * @param {string} direction - Направление для полей: 'direct' (lat→rus), 'reverse' (rus→lat), 'both' (оба, по умолчанию)
 * @param {boolean} hideAvailableWord - Скрывать слово, которое не надо отгадывать
 * @param {boolean} vertical - Вертикальное расположение слова и перевода
 */
const Word = ({
  wordId,
  dictionaryWords,
  userWordsData,
  displayStatus: displayStatusProp = null, // Опционально - можно передать готовый
  dictionaryId,
  editingWordId,
  onToggleEdit,
  onRefreshDictionaryWords,
  mode = 'examen',
  showEditButton = true,
  currentTime = Date.now(),
  type = 'row', // 'row' или 'field'
  direction = 'both', // 'direct', 'reverse', 'both'
  hideAvailableWord = false, // Скрывать доступное слово
  vertical = false, // Вертикальное расположение
  // Параметры для WordField (групповая проверка)
  directValue,
  reverseValue,
  onDirectChange,
  onReverseChange,
  highlightDirectCorrect,
  highlightDirectIncorrect,
  highlightReverseCorrect,
  highlightReverseIncorrect,
}) => {
  
  // Находим слово в массиве
  const word = dictionaryWords.find(w => w.id === wordId);
  if (!word) {
    console.error('Word: слово с ID', wordId, 'не найдено в dictionaryWords');
    return null;
  }
  
  const userData = userWordsData[wordId];
  
  // Вычисляем displayStatus только если не передан
  const displayStatus = displayStatusProp || (
    mode === 'education'
      ? getWordDisplayStatusEducation(userData)
      : getWordDisplayStatusExamen(userData, currentTime)
  );
  
  // Выбираем компонент для рендера
  const Component = type === 'field' ? WordField : WordRow;
  
  // ============================================================================
  // РЕНДЕР
  // ============================================================================
  
  return (
    <Component
      word={word}
      userData={userData}
      displayStatus={displayStatus}
      formatTime={mode === 'examen' ? formatTime : null}
      dictionaryId={dictionaryId}
      editingWordId={editingWordId}
      onToggleEdit={onToggleEdit}
      onRefreshDictionaryWords={onRefreshDictionaryWords}
      showEditButton={showEditButton}
      mode={mode}
      // Передаём параметры для WordField
      direction={direction}
      hideAvailableWord={hideAvailableWord}
      vertical={vertical}
      directValue={directValue}
      reverseValue={reverseValue}
      onDirectChange={onDirectChange}
      onReverseChange={onReverseChange}
      highlightDirectCorrect={highlightDirectCorrect}
      highlightDirectIncorrect={highlightDirectIncorrect}
      highlightReverseCorrect={highlightReverseCorrect}
      highlightReverseIncorrect={highlightReverseIncorrect}
    />
  );
};

export default Word;

