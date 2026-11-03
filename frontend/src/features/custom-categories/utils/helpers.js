'use client';

/**
 * Полезные утилиты для кастомных категорий
 */

const TRAINING_ANSWER_MODE_KEY = 'lbp_training_answer_mode';
const TRAINING_ANSWER_MODE_MAX_AGE_DAYS = 7;

/**
 * Режим ввода ответа: 'select' — выбор из предложенных, 'type' — ввод вручную.
 * @returns {'select'|'type'|null} null если нет в куках
 */
export const getTrainingAnswerMode = () => {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp('(^|;)\\s*' + TRAINING_ANSWER_MODE_KEY + '=([^;]+)'));
  const v = m ? m[2].trim().toLowerCase() : null;
  return (v === 'select' || v === 'type') ? v : null;
};

/**
 * Сохранить режим в куки на 1 неделю.
 * @param {'select'|'type'} mode
 */
export const setTrainingAnswerMode = (mode) => {
  if (typeof document === 'undefined') return;
  const maxAge = TRAINING_ANSWER_MODE_MAX_AGE_DAYS * 24 * 60 * 60;
  document.cookie = `${TRAINING_ANSWER_MODE_KEY}=${mode}; path=/; max-age=${maxAge}; SameSite=Lax`;
};

/**
/**
 * Удаляет скобки с содержимым и знаки препинания (. , ; : ? !) — для подстановки в поле и сравнения ответов
 */
export const stripParenthesesAndPunctuation = (str) => {
  if (typeof str !== 'string') return '';
  return str
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/[.,;:?!]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Нормализация строки для сравнения
 * @param {string} str - Строка для нормализации
 * @returns {string} - Нормализованная строка
 */
export const normalizeString = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:]/g, '') // Удаляет пунктуацию
    .replace(/\s+/g, ' '); // Нормализует пробелы
};

export const getWordTranslationFields = (word, lang = null) => {
  const code = String(lang || '').toLowerCase();
  const localized = code && word?.translations ? word.translations[code] : null;
  return {
    translation_1: localized?.translation_1 || word?.translation_1 || '',
    translation_2: localized?.translation_2 ?? word?.translation_2,
    translation_3: localized?.translation_3 ?? word?.translation_3,
    translation_input_variable:
      localized?.translation_input_variable ?? word?.translation_input_variable,
    difficult_translation: localized?.difficult_translation ?? word?.difficult_translation,
    info: localized?.info ?? word?.info,
  };
};

export const getWordTranslationList = (word, lang = null) => {
  const tr = getWordTranslationFields(word, lang);
  return [tr.translation_1, tr.translation_2, tr.translation_3].filter((t) => t && t !== '0');
};

/**
 * Проверка правильности перевода
 * @param {object} word - Объект слова
 * @param {string} userAnswer - Ответ пользователя
 * @param {boolean} isReverse - Обратный перевод (rus→lat)
 * @returns {boolean} - Правильно ли
 */
export const checkTranslation = (word, userAnswer, isReverse = false, translationLang = null) => {
  const normalized = normalizeString(userAnswer);
  
  if (isReverse) {
    // Обратный перевод: проверяем слово
    return normalizeString(word.word) === normalized;
  } else {
    // Прямой перевод: проверяем все варианты перевода
    const tr = getWordTranslationFields(word, translationLang);
    const correctAnswers = getWordTranslationList(word, translationLang);
    if (tr.translation_input_variable?.trim()) {
      correctAnswers.push(
        ...tr.translation_input_variable
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
      );
    }
    
    return correctAnswers.some(answer => 
      normalizeString(answer) === normalized
    );
  }
};

/**
 * Группировка слов по статусу изучения
 * @param {array} words - Массив слов
 * @param {object} displayStatuses - Статусы отображения {[wordId]: {fullyLearned, ...}}
 * @returns {object} - {learned: [], learning: [], notStarted: []}
 */
export const groupWordsByStatus = (words, displayStatuses) => {
  const learned = [];
  const learning = [];
  const notStarted = [];
  
  words.forEach(word => {
    const status = displayStatuses[word.id];
    if (!status) {
      notStarted.push(word);
    } else if (status.fullyLearned) {
      learned.push(word);
    } else {
      learning.push(word);
    }
  });
  
  return { learned, learning, notStarted };
};

/**
 * Разбить слова на группы
 * @param {array} words - Массив слов
 * @param {number} groupSize - Размер группы
 * @returns {array} - Массив групп [{id, words}, ...]
 */
export const splitIntoGroups = (words, groupSize = 5) => {
  const groups = [];
  for (let i = 0; i < words.length; i += groupSize) {
    groups.push({
      id: Math.floor(i / groupSize),
      words: words.slice(i, i + groupSize),
    });
  }
  return groups;
};

/**
 * Получить статистику слов
 * @param {array} words - Массив слов
 * @param {object} displayStatuses - Статусы отображения
 * @param {object} userWordsData - Данные пользователя
 * @returns {object} - Статистика
 */
export const getWordsStats = (words, displayStatuses, userWordsData) => {
  const total = words.length;
  const learned = words.filter(w => displayStatuses[w.id]?.fullyLearned).length;
  const learning = total - learned;
  
  let totalAttempts = 0;
  let totalCorrect = 0;
  
  words.forEach(w => {
    const userData = userWordsData[w.id];
    if (userData) {
      totalAttempts += (userData.attempts || 0) + (userData.attempts_revert || 0);
      totalCorrect += (userData.correct_attempts || 0) + (userData.correct_attempts_revert || 0);
    }
  });
  
  return {
    total,
    learned,
    learning,
    progress: total > 0 ? Math.round((learned / total) * 100) : 0,
    totalAttempts,
    totalCorrect,
  };
};

/** Метрики сложности слова по числу попыток (прямо и обратно) */
export const getWordDifficultyMetrics = (userData) => {
  if (!userData) return null;

  const directAttempts = Math.max(0, Number(userData.attempts) || 0);
  const revertAttempts = Math.max(0, Number(userData.attempts_revert) || 0);
  const totalAttempts = directAttempts + revertAttempts;
  const peakAttempts = Math.max(directAttempts, revertAttempts);

  let heat = 0;
  if (peakAttempts >= 10) heat = 3;
  else if (peakAttempts >= 5) heat = 2;
  else if (peakAttempts >= 1) heat = 1;

  return {
    directAttempts,
    revertAttempts,
    totalAttempts,
    peakAttempts,
    heat,
  };
};

/** Выбрать top percent% слов категории по числу попыток (для плотного дообучения) */
export const pickHardestWordsForDenseTraining = (words, userWordsData, percent = 15, excludeWordIds = [], deterministic = true) => {
  if (!Array.isArray(words) || words.length === 0) {
    return { wordIds: [], maxAttempts: 0, targetCount: 0, candidateCount: 0 };
  }

  const targetCount = Math.max(1, Math.ceil((words.length * percent) / 100));
  const exclude = new Set((excludeWordIds || []).map(Number));

  const scored = words
    .map((w) => {
      const metrics = getWordDifficultyMetrics(userWordsData[w.id]);
      if (!metrics || metrics.totalAttempts <= 0) return null;
      if (exclude.has(w.id)) return null;
      return { id: w.id, totalAttempts: metrics.totalAttempts };
    })
    .filter(Boolean);

  if (scored.length === 0) {
    return { wordIds: [], maxAttempts: 0, targetCount, candidateCount: 0 };
  }

  scored.sort((a, b) => {
    if (b.totalAttempts !== a.totalAttempts) return b.totalAttempts - a.totalAttempts;
    return deterministic ? a.id - b.id : 0;
  });

  const maxAttempts = scored[0].totalAttempts;
  const pickCount = Math.min(targetCount, scored.length);

  return {
    wordIds: scored.slice(0, pickCount).map((s) => s.id),
    maxAttempts,
    targetCount,
    candidateCount: scored.length,
  };
};

/** Данные для мини-графика попыток по словам категории (сортировка: больше попыток — левее) */
export const getCategoryAttemptChartData = (
  words,
  userWordsData,
  selectedWordIds = [],
  excludeWordIds = [],
  translationLang = null,
) => {
  if (!Array.isArray(words) || words.length === 0) {
    return { bars: [], maxAttempts: 0, chartMax: 1 };
  }

  const selected = new Set((selectedWordIds || []).map(Number));
  const inDense = new Set((excludeWordIds || []).map(Number));

  const bars = words.map((w) => {
    const metrics = getWordDifficultyMetrics(userWordsData[w.id]);
    const tr = getWordTranslationFields(w, translationLang);
    const directAttempts = metrics?.directAttempts || 0;
    const revertAttempts = metrics?.revertAttempts || 0;
    const totalAttempts = metrics?.totalAttempts || 0;
    return {
      id: w.id,
      word: w.word || '',
      translation_1: tr.translation_1 || '',
      translation_2: tr.translation_2 || '',
      translation_3: tr.translation_3 || '',
      info: tr.info || '',
      directAttempts,
      revertAttempts,
      totalAttempts,
      inDense: inDense.has(w.id),
      selected: selected.has(w.id),
    };
  });

  bars.sort((a, b) => b.totalAttempts - a.totalAttempts || String(a.word).localeCompare(String(b.word)));

  const maxAttempts = bars.length ? Math.max(...bars.map((b) => b.totalAttempts)) : 0;
  const chartMax = Math.max(1, maxAttempts);

  return {
    bars: bars.map((b) => ({
      ...b,
      isMaxTier: maxAttempts > 0 && b.totalAttempts === maxAttempts,
    })),
    maxAttempts,
    chartMax,
  };
};

/**
 * @returns {string} - Форматированное время "ч:мм"
 */
export const formatTime = (milliseconds) => {
  const hours = Math.floor(milliseconds / (60 * 60 * 1000));
  const minutes = Math.floor((milliseconds % (60 * 60 * 1000)) / (60 * 1000));
  return `${hours}:${String(minutes).padStart(2, '0')}`;
};

/**
 * Рассчитать оставшееся время отката
 * @param {string} lastShown - Время последнего показа
 * @param {number} correctAttempts - Количество правильных попыток
 * @param {number} modeEducation - Режим обучения (0 или 1)
 * @param {number} currentTime - Текущее время (по умолчанию Date.now())
 * @returns {number|null} - Оставшееся время в миллисекундах или null
 */
// ТЕСТОВЫЙ РЕЖИМ ОТКАТОВ: true = 1 мин и 2 мин, false = 30 мин и 20 часов
const TEST_COOLDOWN_MODE = false;
const TEST_COOLDOWN_FIRST = 1 * 60 * 1000;   // 1 минута
const TEST_COOLDOWN_SECOND = 2 * 60 * 1000;  // 2 минуты
const NORMAL_COOLDOWN_FIRST = 30 * 60 * 1000;   // 30 минут (первый интервал)
const NORMAL_COOLDOWN_SECOND = 20 * 60 * 60 * 1000;  // 20 часов (второй, стандарт)
const COOLDOWN_TIER_EASY_SECOND = 30 * 60 * 1000;   // 30 мин (лёгкая / tier 1)
const COOLDOWN_TIER_MEDIUM_SECOND = 3 * 60 * 60 * 1000; // 3 ч (упрощённая / tier 2)

/** Текущий выбранный интервал откатов из куки (0/1/2). Не путать со снимком в БД при 2-м балле. */
export function getLearnCooldownTierPreference() {
  if (typeof document === 'undefined') return 0;
  const m = document.cookie.match(/(?:^|;)\s*lbp_cooldown_tier_pref=([^;]+)/);
  if (!m) return 0;
  const v = parseInt(m[1].trim(), 10);
  if (v === 0 || v === 1 || v === 2) return v;
  return 0;
}

/**
 * @param {string} lastShown
 * @param {number} correctAttempts
 * @param {number} cooldownTier 0 = 20 ч после 1-го балла, 1 = 30 мин, 2 = 3 ч (первый интервал всегда 30 мин)
 * @param {number} currentTime
 */
/** Парсинг last_shown: MySQL "YYYY-MM-DD HH:mm:ss" или ISO с Z / микросекундами */
function parseLastShownUtcMs(lastShown) {
  if (!lastShown || lastShown === '' || lastShown === '0000-00-00 00:00:00') {
    return null;
  }
  let s = String(lastShown).trim();
  // "2026-06-28T02:09:35.000000Z" — укорачиваем микросекунды до мс
  s = s.replace(/\.(\d{3})\d+(?=(Z|[+-]\d{2}:?\d{2})?$)/, '.$1');
  if (/^\d{4}-\d{2}-\d{2} /.test(s)) {
    s = s.replace(' ', 'T');
  }
  // Уже ISO с timezone — не добавляем второй Z
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    s = `${s}Z`;
  }
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : null;
}

export const getCooldownTime = (lastShown, correctAttempts, cooldownTier = 0, currentTime = Date.now()) => {
  const lastShownTime = parseLastShownUtcMs(lastShown);
  if (lastShownTime == null) {
    return null;
  }

  const elapsed = currentTime - lastShownTime;
  
  let cooldownDuration;
  const first = TEST_COOLDOWN_MODE ? TEST_COOLDOWN_FIRST : NORMAL_COOLDOWN_FIRST;
  const secondStandard = TEST_COOLDOWN_MODE ? TEST_COOLDOWN_SECOND : NORMAL_COOLDOWN_SECOND;
  const tier = Number(cooldownTier) || 0;

  if (correctAttempts === 0) {
    cooldownDuration = first;
  } else if (correctAttempts === 1) {
    if (tier === 1) {
      cooldownDuration = TEST_COOLDOWN_MODE ? TEST_COOLDOWN_SECOND : COOLDOWN_TIER_EASY_SECOND;
    } else if (tier === 2) {
      cooldownDuration = TEST_COOLDOWN_MODE ? TEST_COOLDOWN_SECOND : COOLDOWN_TIER_MEDIUM_SECOND;
    } else {
      cooldownDuration = secondStandard;
    }
  } else if (correctAttempts >= 2) {
    return null;
  }

  const remaining = cooldownDuration - elapsed;
  if (remaining <= 0) return null;
  
  return remaining;
};

/**
 * Получить статус отображения слова для режима Education
 * @param {object} userData - Данные пользователя по слову
 * @returns {object} - {showWord, showTranslation, fullyLearned}
 */
export const getWordDisplayStatusEducation = (userData) => {
  if (!userData) {
    return {
      showWord: true,
      showTranslation: true,
      fullyLearned: false
    };
  }
  
  if (userData.easy_education === 0) {
    return {
      showWord: true,
      showTranslation: true,
      fullyLearned: false
    };
  }
  
  const directLearned = userData.easy_correct === 1;
  const revertLearned = userData.easy_correct_revert === 1;
  
  return {
    showWord: directLearned,
    showTranslation: revertLearned,
    fullyLearned: directLearned && revertLearned
  };
};

/** Хотя бы одно направление доведено до 2 баллов в упрощённом режиме (tier 2 = 3 ч между 1-м и 2-м баллом). */
export const learnedWithSimplifiedTierTwo = (userData) => {
  if (!userData) return false;
  const directDone = Number(userData.correct_attempts) >= 2;
  const revertDone = Number(userData.correct_attempts_revert) >= 2;
  const directSimplified = directDone && Number(userData.cooldown_tier) === 2;
  const revertSimplified = revertDone && Number(userData.cooldown_tier_revert) === 2;
  return directSimplified || revertSimplified;
};

/**
 * Получить статус отображения слова для режима Examen
 * @param {object} userData - Данные пользователя по слову
 * @param {number} currentTime - Текущее время для вычисления откатов
 * @returns {object} - {showWord, showTranslation, fullyLearned, hasAttempts, cooldownDirect, cooldownRevert}
 */
export const getWordDisplayStatusExamen = (userData, currentTime = Date.now()) => {
  // Если нет записи вообще - показываем слово и перевод открыто (как в удалённом режиме обучения)
  if (!userData) {
    return {
      showWord: true,            // Показываем слово
      showTranslation: true,     // Показываем перевод
      fullyLearned: false,
      hasAttempts: false,
      cooldownDirect: null,
      cooldownRevert: null,
      modeEducation: 0,
      modeEducationRevert: 0
    };
  }

  // ProgressRow из Laravel: boolean; WP: 0/1 — нормализуем
  const modeEdu = Number(userData.mode_education) ? 1 : 0;
  const modeEduRevert = Number(userData.mode_education_revert) ? 1 : 0;
  const attempts = Number(userData.attempts) || 0;
  const attemptsRevert = Number(userData.attempts_revert) || 0;
  const correctAttempts = Number(userData.correct_attempts) || 0;
  const correctAttemptsRevert = Number(userData.correct_attempts_revert) || 0;
  
  // Проверяем, является ли запись "сброшенной" (после кнопки сброса)
  // Сброшенная запись имеет все счётчики = 0 И last_shown = NULL/пустое/"0000-00-00 00:00:00"
  const isResetState = (
    !modeEdu &&
    !modeEduRevert &&
    attempts === 0 &&
    attemptsRevert === 0 &&
    correctAttempts === 0 &&
    correctAttemptsRevert === 0 &&
    (!userData.last_shown || userData.last_shown === '' || userData.last_shown === '0000-00-00 00:00:00') &&
    (!userData.last_shown_revert || userData.last_shown_revert === '' || userData.last_shown_revert === '0000-00-00 00:00:00')
  );
  
  // Если запись сброшенная - показываем слово и перевод открыто (как в удалённом режиме обучения)
  if (isResetState) {
    return {
      showWord: true,            // Показываем слово
      showTranslation: true,     // Показываем перевод
      fullyLearned: false,
      hasAttempts: false,
      cooldownDirect: null,
      cooldownRevert: null,
      modeEducation: modeEdu,
      modeEducationRevert: modeEduRevert
    };
  }
  
  // Обычная запись с реальными попытками
  const liveTier = getLearnCooldownTierPreference();
  const cooldownDirect = getCooldownTime(
    userData.last_shown,
    correctAttempts,
    liveTier,
    currentTime
  );
  const cooldownRevert = getCooldownTime(
    userData.last_shown_revert,
    correctAttemptsRevert,
    liveTier,
    currentTime
  );
  
  const directLearned = correctAttempts >= 2;
  const revertLearned = correctAttemptsRevert >= 2;
  const hasAnyAttempts = attempts > 0 || attemptsRevert > 0;
  // В лёгком режиме не считаем слово выученным
  const inEasyMode = modeEdu === 1 || modeEduRevert === 1;
  const fullyLearned = (directLearned && revertLearned) && !inEasyMode;

  return {
    showWord: revertLearned,
    showTranslation: directLearned,
    fullyLearned,
    hasAttempts: hasAnyAttempts,
    cooldownDirect: cooldownDirect,
    cooldownRevert: cooldownRevert,
    modeEducation: modeEdu,
    modeEducationRevert: modeEduRevert
  };
};

/** Сокращения для standard-ключа (как в CSV: form,standard) */
export const VERB_PRONOUN_ABBR = { es: 'es', tu: 'tu', '3pers': '3p', we: 'mes', you_pl: 'jus' };
export const VERB_TENSE_ABBR = { past: 'pag', present: 'tag', future: 'nak' };

/** standard-ключ из инфинитива и ключа ячейки: būt + es_past → "būt es pag" */
export const buildVerbStandardKey = (verbKey, conjKey) => {
  const match = conjKey.match(/^(es|tu|3pers|we|you_pl)_(past|present|future)$/);
  if (!match) return null;
  const [, pronoun, tense] = match;
  return `${verbKey} ${VERB_PRONOUN_ABBR[pronoun]} ${VERB_TENSE_ABBR[tense]}`;
};

/**
 * Ячейка таблицы: строка "biju" или пара [форма, standard] как в CSV translation_1
 * @returns {{ form: string, lookupKey: string } | null}
 */
export const parseVerbCell = (cellValue, verbKey, conjKey) => {
  if (!cellValue || cellValue === '-') return null;
  if (Array.isArray(cellValue)) {
    const [form, standardKey] = cellValue;
    if (!form || !standardKey) return null;
    return { form, lookupKey: standardKey };
  }
  if (typeof cellValue === 'string') {
    const standardKey = buildVerbStandardKey(verbKey, conjKey);
    return { form: cellValue, lookupKey: standardKey || cellValue };
  }
  return null;
};

/** Слова, реально показанные в таблице спряжений (только непустые ячейки verbs) */
export const getVisibleWordsFromVerbTable = (verbs, resolveVerbCellWordId, dictionaryWordsById) => {
  if (!verbs || typeof verbs !== 'object') return [];
  const seen = new Set();
  const list = [];
  Object.entries(verbs).forEach(([verbKey, verbData]) => {
    if (!verbData || typeof verbData !== 'object') return;
    Object.entries(verbData).forEach(([conjKey, val]) => {
      if (conjKey === 'name' || !parseVerbCell(val, verbKey, conjKey)) return;
      const wordId = resolveVerbCellWordId(val, verbKey, conjKey);
      if (!wordId || seen.has(wordId)) return;
      const word = dictionaryWordsById[wordId];
      if (!word) return;
      seen.add(wordId);
      list.push(word);
    });
  });
  return list;
};

/** Сокращения для standard-ключа склонений (как в CSV) */
export const NOUN_NUMBER_ABBR = { sing: 'viens', plur: 'daudz' };
export const NOUN_CASE_ABBR = { kas: 'kas', ka: 'ka', kam: 'kam', ko: 'ko', kur: 'kur' };

/** lemma + sing_kas → "tēvs viens kas" */
export const buildNounStandardKey = (lemma, cellKey) => {
  const match = cellKey.match(/^(sing|plur)_(kas|ka|kam|ko|kur)$/);
  if (!match) return null;
  const [, number, caseKey] = match;
  return `${lemma} ${NOUN_NUMBER_ABBR[number]} ${NOUN_CASE_ABBR[caseKey]}`;
};

export const parseNounCell = (cellValue, lemma, cellKey) => {
  if (!cellValue || cellValue === '-') return null;
  if (Array.isArray(cellValue)) {
    const [form, standardKey] = cellValue;
    if (!form || !standardKey) return null;
    return { form, lookupKey: standardKey };
  }
  if (typeof cellValue === 'string') {
    const standardKey = buildNounStandardKey(lemma, cellKey);
    return { form: cellValue, lookupKey: standardKey || cellValue };
  }
  return null;
};

/** Слова из непустых ячеек таблицы склонений */
export const getVisibleWordsFromNounTable = (nouns, resolveNounCellWordId, dictionaryWordsById) => {
  if (!nouns || typeof nouns !== 'object') return [];
  const seen = new Set();
  const list = [];
  Object.entries(nouns).forEach(([lemma, nounData]) => {
    if (!nounData || typeof nounData !== 'object') return;
    Object.entries(nounData).forEach(([cellKey, val]) => {
      if (cellKey === 'name' || !parseNounCell(val, lemma, cellKey)) return;
      const wordId = resolveNounCellWordId(val, lemma, cellKey);
      if (!wordId || seen.has(wordId)) return;
      const word = dictionaryWordsById[wordId];
      if (!word) return;
      seen.add(wordId);
      list.push(word);
    });
  });
  return list;
};

/** Слова категории, доступные для обратной тренировки (ввод латышского) */
export const getEligibleRevertTrainingWordIds = (wordsList, userWordsData, currentTime = Date.now()) => {
  if (!Array.isArray(wordsList)) return [];
  return wordsList
    .filter((word) => {
      const ud = userWordsData?.[word.id];
      // Нет прогресса / «чистый» старт — слово можно тренировать
      // (showWord=true в browse-режиме НЕ означает «уже выучено»)
      if (!ud) return true;

      const correctRevert = Number(ud.correct_attempts_revert) || 0;
      const easyRevert = Boolean(ud.mode_education_revert) || Number(ud.mode_education_revert) === 1;
      const attempts = Number(ud.attempts) || 0;
      const attemptsRevert = Number(ud.attempts_revert) || 0;
      const correct = Number(ud.correct_attempts) || 0;
      const noActivity =
        !ud.mode_education &&
        !ud.mode_education_revert &&
        attempts === 0 &&
        attemptsRevert === 0 &&
        correct === 0 &&
        correctRevert === 0 &&
        !ud.last_shown &&
        !ud.last_shown_revert;
      if (noActivity) return true;

      const ds = getWordDisplayStatusExamen(ud, currentTime);
      if (ds.fullyLearned || ds.cooldownRevert) return false;

      // Обратный выучен (≥2) — пропускаем, кроме лёгкого режима
      if (correctRevert >= 2 && !easyRevert) return false;
      return true;
    })
    .map((word) => word.id);
};
