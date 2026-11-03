'use client';

import React, { useState, useEffect, memo, useRef } from 'react';
import { WordEditor } from '@/features/admin/WordEditor';
import { useAdminMode } from '../contexts/AdminModeContext';

/** Маска скрытого слова — фикс. 6 символов, без подсказки по длине */
const HIDDEN_WORD_MASK = Array.from({ length: 6 }, () => '█').join(' ');

/**
 * Компонент для ввода слова (упрощенная версия WordField)
 * 
 * Показывает только:
 * - Поле ввода для слова
 * - Индикатор прогресса (галочка)
 * - Таймер отката (вместо поля ввода, по центру)
 * 
 * @param {object} word - Объект слова: {id, word, translation_1, translation_2, translation_3, ...}
 * @param {object} userData - Данные пользователя по слову
 * @param {object} displayStatus - Статус отображения: {showWord, fullyLearned, hasAttempts, cooldownRevert}
 * @param {function} formatTime - Функция форматирования времени откатов
 * @param {number} dictionaryId - ID словаря
 * @param {number} editingWordId - ID редактируемого слова
 * @param {function} onToggleEdit - Колбэк переключения редактирования
 * @param {function} onRefreshDictionaryWords - Колбэк обновления списка слов
 * @param {boolean} showEditButton - Показывать кнопку редактирования ✏️
 * @param {string} value - Значение поля ввода
 * @param {function} onChange - Колбэк изменения значения: (wordId, value) => void
 * @param {boolean} highlightCorrect - Подсветка при правильном ответе
 * @param {boolean} highlightIncorrect - Подсветка при неправильном ответе
 * @param {boolean} autoFocus - Автофокус на поле ввода
 * @param {function} onSubmit - Колбэк по Enter
 * @param {boolean} inputDisabled - Заблокировать ввод (идёт проверка)
 * @param {boolean} fieldActive - Подсветка активного поля тренировки
 * @param {boolean} forceHidden - Принудительно скрыть слово (неактивные поля в тренировке)
 * @param {string} placeholder - Текст placeholder для поля ввода
 */
const WordInput = ({
  word,
  userData,
  displayStatus,
  formatTime,
  dictionaryId,
  editingWordId,
  onToggleEdit,
  onRefreshDictionaryWords,
  showEditButton = false,
  value = '',
  onChange = null,
  highlightCorrect = false,
  highlightIncorrect = false,
  autoFocus = false,
  onSubmit = null,
  inputDisabled = false,
  fieldActive = false,
  forceHidden = false,
  placeholder = 'Введите слово',
}) => {
  const { isAdminModeActive } = useAdminMode();
  const [showTooltip, setShowTooltip] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus && onChange && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus, onChange, word?.id]);
  
  // Подсказка только на текущей ошибке; при повторном показе поля — сброс
  useEffect(() => {
    if (highlightIncorrect) {
      setShowTooltip(true);
      const timer = setTimeout(() => setShowTooltip(false), 10000);
      return () => clearTimeout(timer);
    }
    setShowTooltip(false);
  }, [highlightIncorrect]);

  useEffect(() => {
    setShowTooltip(false);
  }, [word?.id, fieldActive]);
  
  // Стили для поля ввода (iOS Safari зумит при font-size < 16px)
  const getFieldStyle = (isCorrect, isIncorrect) => {
    const base = {
      border: '1px solid #ced4da',
      borderRadius: '3px',
      padding: '4px 8px',
      fontSize: '16px',
      width: '140px',
      minWidth: '140px',
      maxWidth: '140px',
      boxSizing: 'border-box',
      flexShrink: 0,
      fontFamily: 'inherit',
      textAlign: 'center',
    };
    if (isCorrect) return { ...base, backgroundColor: '#d4edda', borderColor: '#28a745' };
    if (isIncorrect) return { ...base, backgroundColor: '#f8d7da', borderColor: '#dc3545' };
    return base;
  };

  // Стили для таймера отката (показывается вместо поля ввода)
  const getTimerStyle = () => {
    return {
      border: '1px solid #ff9800',
      borderRadius: '3px',
      padding: '4px 8px',
      fontSize: '13px',
      width: '140px',
      minWidth: '140px',
      maxWidth: '140px',
      boxSizing: 'border-box',
      flexShrink: 0,
      textAlign: 'center',
      color: '#ff9800',
      fontWeight: 'bold',
      backgroundColor: '#fff3e0',
      display: 'inline-block',
    };
  };
  
  const showCooldown = Boolean(displayStatus?.cooldownRevert);
  const showInput = Boolean(onChange);
  // Во время ввода (onChange) не подменяем поле открытым словом —
  // showWord=true бывает и у «ещё не начатых» форм в browse-режиме таблицы
  const showRevealedWord = !forceHidden && !showInput && Boolean(displayStatus?.showWord);

  return (
    <div className={`word-input${fieldActive ? ' word-input--field-active' : ''}${showCooldown ? ' word-input--cooldown' : ''}`} style={{
      display: 'flex', 
      alignItems: 'center', 
      gap: '4px',
      padding: '2px 0px',
      minWidth: '140px',
      flexShrink: 0
    }}>
      
      {/* Поле ввода или таймер — key избегает removeChild; minWidth сохраняет фикс. ширину */}
      <span key={showCooldown ? 'cooldown' : showRevealedWord ? 'word' : showInput ? 'input' : 'hidden'} style={{ display: 'inline-block', width: '140px', minWidth: '140px', maxWidth: '140px', flexShrink: 0 }}>
      {showCooldown ? (
        <span style={getTimerStyle()}>
          ⏱️ {formatTime(displayStatus.cooldownRevert)}
        </span>
      ) : showRevealedWord ? (
        // Если слово уже показано — фикс. ширина 140px
        <span style={{
          border: '1px solid #ced4da',
          borderRadius: '3px',
          padding: '4px 8px',
          fontSize: '13px',
          width: '140px',
          minWidth: '140px',
          maxWidth: '140px',
          boxSizing: 'border-box',
          flexShrink: 0,
          textAlign: 'center',
          backgroundColor: '#f5f5f5',
          display: 'inline-block',
        }}>
          {word.word}
        </span>
      ) : showInput ? (
        // Показываем поле ввода
        <span className="word-input-field-wrap" style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <input
            ref={inputRef}
            type="text"
            inputMode="text"
            enterKeyHint="go"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            value={value}
            onChange={(e) => onChange(word.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && onSubmit && !inputDisabled) {
                e.preventDefault();
                onSubmit();
              }
            }}
            placeholder={placeholder}
            disabled={inputDisabled}
            style={{
              ...getFieldStyle(highlightCorrect, highlightIncorrect),
              ...(userData?.mode_education_revert ? { paddingRight: '26px' } : {}),
            }}
            className="word-input-field"
          />
          {userData && displayStatus && displayStatus.fullyLearned && (
            <span className="word-input-field-badge word-input-field-badge--learned">
              ✓
            </span>
          )}
          {userData && userData.mode_education_revert && (
            <span className="learning-mode-text learning-glow learning-mode-icon-end">
              <span className="learning-mode-icon">📚</span>
            </span>
          )}
          {showTooltip && (
            <span className="word-field-tooltip">
              ✓ {word.word}
            </span>
          )}
        </span>
      ) : (
        // Если нет onChange — скрытое слово, фикс. ширина
        <span className="words-hidden-text word-input-field-wrap" style={{
          border: '1px solid #ced4da',
          borderRadius: '3px',
          padding: '4px 8px',
          fontSize: '13px',
          width: '140px',
          minWidth: '140px',
          maxWidth: '140px',
          boxSizing: 'border-box',
          flexShrink: 0,
          textAlign: 'center',
          display: 'inline-block',
          position: 'relative',
        }}>
          {userData && userData.mode_education_revert && !forceHidden ? (
            <>
              <span style={{ color: '#333', fontSize: '16px', fontWeight: 'bold', paddingRight: '20px' }}>{word.word}</span>
              <span className="learning-mode-text learning-glow learning-mode-icon-end">
                <span className="learning-mode-icon">📚</span>
              </span>
            </>
          ) : (
            HIDDEN_WORD_MASK
          )}
        </span>
      )}
      </span>

      {/* Кнопка редактирования (только для админов) */}
      {showEditButton && isAdminModeActive && (
        <button
          className="edit-button"
          style={{ marginLeft: "10px" }}
          onClick={() => onToggleEdit(word.id)}
          title="Редактировать слово"
        >
          ✏️
        </button>
      )}

      {/* Форма редактирования */}
      {editingWordId === word.id && (
        <div style={{ marginTop: "10px", padding: "10px", border: "1px solid #ccc", width: '100%' }}>
          <WordEditor
            dictionaryId={dictionaryId}
            word={word}
            onClose={() => onToggleEdit(null)}
          />
        </div>
      )}
    </div>
  );
};

// Пропуск ре-рендера при редактировании (избегаем removeChild с ReactQuill)
function arePropsEqual(prev, next) {
  if (prev.fieldActive !== next.fieldActive) return false;
  if (prev.autoFocus !== next.autoFocus) return false;
  if (prev.onChange !== next.onChange) return false;
  if (prev.onSubmit !== next.onSubmit) return false;
  if (prev.inputDisabled !== next.inputDisabled) return false;
  if (prev.forceHidden !== next.forceHidden) return false;
  if (prev.placeholder !== next.placeholder) return false;

  const isEditingPrev = prev.editingWordId === prev.word?.id;
  const isEditingNext = next.editingWordId === next.word?.id;
  if (isEditingPrev && isEditingNext && prev.word?.id === next.word?.id) {
    return (
      prev.word === next.word &&
      prev.userData === next.userData &&
      prev.editingWordId === next.editingWordId &&
      prev.value === next.value &&
      prev.highlightCorrect === next.highlightCorrect &&
      prev.highlightIncorrect === next.highlightIncorrect
    );
  }
  return false;
}

export default memo(WordInput, arePropsEqual);

