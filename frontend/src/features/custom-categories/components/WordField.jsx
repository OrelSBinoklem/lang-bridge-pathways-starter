'use client';

import React, { useState, useEffect } from 'react';
import { WordEditor } from '@/features/admin/WordEditor';
import WordWithPosHint from '../../components/WordWithPosHint';
import { useAdminMode } from '../contexts/AdminModeContext';
import { learnedWithSimplifiedTierTwo } from '../utils/helpers';

/**
 * Альтернативный компонент для отображения слова (копия WordRow)
 * + добавлены 2 дополнительных поля для групповой проверки
 * 
 * @param {string} direction - Направление: 'direct' (только lat→rus), 'reverse' (только rus→lat), 'both' (оба)
 * @param {boolean} hideAvailableWord - Скрывать слово/перевод, который не надо отгадывать (default: false)
 * @param {boolean} vertical - Вертикальное расположение (default: false)
 * @param {string} directValue - Значение поля прямого перевода
 * @param {string} reverseValue - Значение поля обратного перевода
 * @param {function} onDirectChange - Колбэк изменения прямого: (wordId, value) => void
 * @param {function} onReverseChange - Колбэк изменения обратного: (wordId, value) => void
 * @param {boolean} highlightDirectCorrect/Incorrect - Подсветка прямого поля
 * @param {boolean} highlightReverseCorrect/Incorrect - Подсветка обратного поля
 */
const WordField = ({
  word,
  userData,
  displayStatus,
  formatTime,
  dictionaryId,
  editingWordId,
  onToggleEdit,
  onRefreshDictionaryWords,
  showEditButton = true,
  // Настройка направления и полей ввода
  direction = 'both', // 'direct', 'reverse', 'both'
  hideAvailableWord = false, // Скрывать слово, которое не надо отгадывать
  vertical = false, // Вертикальное расположение
  directValue = '',
  reverseValue = '',
  onDirectChange = null,
  onReverseChange = null,
  highlightDirectCorrect = false,
  highlightDirectIncorrect = false,
  highlightReverseCorrect = false,
  highlightReverseIncorrect = false,
}) => {
  const { isAdminModeActive } = useAdminMode();
  const [showDirectTooltip, setShowDirectTooltip] = useState(false);
  const [showReverseTooltip, setShowReverseTooltip] = useState(false);
  
  // Показать всплывашку при неправильном ответе
  useEffect(() => {
    if (highlightDirectIncorrect) {
      setShowDirectTooltip(true);
      const timer = setTimeout(() => setShowDirectTooltip(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [highlightDirectIncorrect]);
  
  useEffect(() => {
    if (highlightReverseIncorrect) {
      setShowReverseTooltip(true);
      const timer = setTimeout(() => setShowReverseTooltip(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [highlightReverseIncorrect]);
  
  // Стили для подсветки
  const getFieldStyle = (isCorrect, isIncorrect) => {
    const base = {
      border: '1px solid #ced4da',
      borderRadius: '4px',
      padding: '4px 8px',
      fontSize: '14px',
      width: '150px',
      fontFamily: 'inherit',
    };
    if (isCorrect) return { ...base, backgroundColor: '#d4edda', borderColor: '#28a745' };
    if (isIncorrect) return { ...base, backgroundColor: '#f8d7da', borderColor: '#dc3545' };
    return base;
  };
  
  // Рендер индикатора прогресса (логика классов как в WordRow)
  const renderProgressIndicator = () => {
    if (!userData || !displayStatus.hasAttempts) {
      return vertical ? '' : <span>&nbsp;&nbsp;&mdash;&nbsp;&nbsp;</span>;
    }
    const directLearned = userData.correct_attempts >= 2;
    const revertLearned = userData.correct_attempts_revert >= 2;
    const bothLearned = directLearned && revertLearned;

    const showCheck = directLearned || revertLearned;
    const progressClass = bothLearned
      ? 'fully-learned'
      : showCheck
        ? 'partially-learned'
        : 'not-learned';

    const showStar = showCheck && learnedWithSimplifiedTierTwo(userData);
    const wrapStyle = showStar ? { position: 'relative', display: 'inline-block' } : {};

    const body = showCheck ? (
      <>
        ✓
        {showStar && (
          <span className="words-progress-indicator__easy-star" aria-hidden="true">*</span>
        )}
      </>
    ) : vertical ? (
      ''
    ) : (
      <span dangerouslySetInnerHTML={{ __html: '&mdash;' }} />
    );

    return (
      <span className={`words-progress-indicator ${progressClass}`} style={wrapStyle}>
        {body}
        &nbsp;&nbsp;
      </span>
    );
  };

  // Определяем, нужно ли показывать поле для обратного перевода (rus→lat)
  const showReverseField = onReverseChange && (direction === 'reverse' || direction === 'both');
  // Определяем, нужно ли показывать поле для прямого перевода (lat→rus)
  const showDirectField = onDirectChange && (direction === 'direct' || direction === 'both');
  
  // Стили для вертикального расположения
  const containerStyle = vertical ? { 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '8px',
    alignItems: 'flex-start' 
  } : {};
  
  return (
    <li key={word.id} style={containerStyle} className={vertical ? 'word-field-vertical' : ''}>
      {/* Слово */}
      <span className="words-education-list__word">
        {displayStatus.cooldownRevert ? (
          <span style={{ color: '#ff9800', fontWeight: 'bold' }}>
            ⏱️ {formatTime(displayStatus.cooldownRevert)}
          </span>
        ) : (displayStatus.showWord || (showDirectField && !hideAvailableWord)) ? (
          // Если слово доступно ИЛИ (активен режим прямого перевода И не скрывать) - показываем слово
          <WordWithPosHint text={word.word} hintFirst />
        ) : showReverseField && !displayStatus.showWord ? (
          // Если нужно отгадать латышское слово - показываем поле ввода
          <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="text"
              value={reverseValue}
              onChange={(e) => onReverseChange(word.id, e.target.value)}
              placeholder="lat"
              style={getFieldStyle(highlightReverseCorrect, highlightReverseIncorrect)}
              className="word-field-inline-input"
            />
            {userData && userData.mode_education_revert === 1 && (
              <span className="learning-mode-text learning-glow">
                <span className="learning-mode-icon">📚</span>
              </span>
            )}
            {showReverseTooltip && (
              <span className="word-field-tooltip">
                ✓ <WordWithPosHint text={word.word} hintFirst />
              </span>
            )}
          </span>
        ) : (displayStatus.showWord || showDirectField) && hideAvailableWord ? (
          // Если hideAvailableWord=true и слово доступно - скрываем его
          <span>&nbsp;</span>
        ) : (
          <span className="words-hidden-text">
            {userData && userData.mode_education_revert === 1 ? (
              <span className="learning-mode-text">
                <span className="learning-mode-icon">📚</span> <span style={{ color: '#333', fontSize: '16px', fontWeight: 'bold' }}><WordWithPosHint text={word.word} hintFirst /></span>
              </span>
            ) : (
              word.word.split('').map((char, index) => 
                char === ' ' ? ' ' : '█ '
              ).join('')
            )}
          </span>
        )}
      </span>

      <span className="words-education-list__translation-wrap">
      {/* Перевод 1 */}
      <span className="words-education-list__translation_1">
        {renderProgressIndicator()}
        {displayStatus.cooldownDirect ? (
          <span style={{ color: '#ff9800', fontWeight: 'bold' }}>
            ⏱️ {formatTime(displayStatus.cooldownDirect)}
          </span>
        ) : (displayStatus.showTranslation || (showReverseField && !hideAvailableWord)) ? (
          // Если перевод доступен ИЛИ (активен режим обратного перевода И не скрывать) - показываем перевод
          word.translation_1
        ) : showDirectField && !displayStatus.showTranslation ? (
          // Если нужно отгадать русский перевод - показываем поле ввода
          <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="text"
              value={directValue}
              onChange={(e) => onDirectChange(word.id, e.target.value)}
              placeholder="rus"
              style={getFieldStyle(highlightDirectCorrect, highlightDirectIncorrect)}
              className="word-field-inline-input"
            />
            {userData && userData.mode_education === 1 && (
              <span className="learning-mode-text learning-glow">
                <span className="learning-mode-icon">📚</span>
              </span>
            )}
            {showDirectTooltip && (
              <span className="word-field-tooltip">
                ✓ {word.translation_1}
                {word.translation_2 && `, ${word.translation_2}`}
                {word.translation_3 && `, ${word.translation_3}`}
              </span>
            )}
          </span>
        ) : (displayStatus.showTranslation || showReverseField) && hideAvailableWord ? (
          // Если hideAvailableWord=true и перевод доступен - скрываем его
          <span>&nbsp;</span>
        ) : (
          <span className="words-hidden-text">
            {userData && userData.mode_education === 1 ? (
              <span className="learning-mode-text">
                <span style={{ color: '#333', fontSize: '16px', fontWeight: 'normal' }}>{word.translation_1}</span> <span className="learning-mode-icon">📚</span>
              </span>
            ) : (
              word.translation_1.split('').map((char, index) => 
                char === ' ' ? ' ' : '█ '
              ).join('')
            )}
          </span>
        )}
      </span>
      
      {/* Перевод 2 */}
      {word.translation_2 && !displayStatus.cooldownDirect && !hideAvailableWord && (
        <span className="words-education-list__translation_2">
          , {displayStatus.showTranslation || showReverseField ? (
            word.translation_2
          ) : (
            <span className="words-hidden-text">
              {word.translation_2.split('').map((char, index) => 
                char === ' ' ? ' ' : '█ '
              ).join('')}
            </span>
          )}
        </span>
      )}
      
      {/* Перевод 3 */}
      {word.translation_3 && !displayStatus.cooldownDirect && !hideAvailableWord && (
        <span className="words-education-list__translation_3">
          , {displayStatus.showTranslation || showReverseField ? (
            word.translation_3
          ) : (
            <span className="words-hidden-text">
              {word.translation_3.split('').map((char, index) => 
                char === ' ' ? ' ' : '█ '
              ).join('')}
            </span>
          )}
        </span>
      )}
      </span>

      {showEditButton && isAdminModeActive && (
        <button
          className="edit-button"
          style={{ marginLeft: "10px" }}
          onClick={() => onToggleEdit(word.id)}
        >
          ✏️
        </button>
      )}

      {editingWordId === word.id && (
        <div style={{ marginTop: "10px", padding: "10px", border: "1px solid #ccc" }}>
          <WordEditor 
            dictionaryId={dictionaryId} 
            word={word} 
            onClose={() => onToggleEdit(null)}
            onRefreshDictionaryWords={onRefreshDictionaryWords}
          />
        </div>
      )}
    </li>
  );
};

export default WordField;

