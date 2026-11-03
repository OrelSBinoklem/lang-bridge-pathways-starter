/**
 * Зеркало scoring attempt (опциональный WS-путь).
 * Канон для прода: App\Services\TrainingProgressService::updateAttempts
 * Менять оба файла вместе — см. .cursor/rules/training-attempts-sync.mdc
 */

function asInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function asBool(v) {
  return v === true || v === 1 || v === '1';
}

function rowToProgress(row) {
  return {
    dict_word_id: asInt(row.dict_word_id),
    attempts: asInt(row.attempts),
    correct_attempts: asInt(row.correct_attempts),
    attempts_revert: asInt(row.attempts_revert),
    correct_attempts_revert: asInt(row.correct_attempts_revert),
    last_shown: row.last_shown ?? null,
    last_shown_revert: row.last_shown_revert ?? null,
    mode_education: asBool(row.mode_education),
    mode_education_revert: asBool(row.mode_education_revert),
    cooldown_tier: asInt(row.cooldown_tier),
    cooldown_tier_revert: asInt(row.cooldown_tier_revert),
    easy_correct: asBool(row.easy_correct),
    easy_correct_revert: asBool(row.easy_correct_revert),
  };
}

function emptyRow(userId, wordId) {
  return {
    user_id: userId,
    dict_word_id: wordId,
    attempts: 0,
    correct_attempts: 0,
    attempts_revert: 0,
    correct_attempts_revert: 0,
    last_shown: null,
    last_shown_revert: null,
    mode_education: 0,
    mode_education_revert: 0,
    cooldown_tier: 0,
    cooldown_tier_revert: 0,
    easy_correct: 0,
    easy_correct_revert: 0,
    easy_education: 0,
    statistic_attempts: 0,
    statistic_attempts_revert: 0,
    statistic_correct_attempts: 0,
    statistic_correct_attempts_revert: 0,
    dense_remaining_direct: 0,
    dense_remaining_revert: 0,
    attempts_all: 0,
    correct_attempts_all: 0,
    is_reset: 0,
  };
}

/**
 * @param {import('mysql2/promise').Pool} pool
 * @param {{ userId: number, wordId: number, isRevert: boolean, isCorrect: boolean, isFirstAttempt: boolean, cooldownTier?: number }} p
 */
export async function updateAttempts(pool, p) {
  const userId = asInt(p.userId);
  const wordId = asInt(p.wordId);
  const isRevert = !!p.isRevert;
  const isCorrect = !!p.isCorrect;
  const isFirstAttempt = !!p.isFirstAttempt;
  const tier = Math.max(0, Math.min(2, asInt(p.cooldownTier, 0)));
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const [rows] = await pool.query(
    'SELECT * FROM user_dictionary_words WHERE user_id = ? AND dict_word_id = ? LIMIT 1',
    [userId, wordId],
  );

  const existing = rows[0] ?? null;
  const row = existing ? { ...existing } : emptyRow(userId, wordId);

  if (isRevert) {
    row.attempts_revert = asInt(row.attempts_revert) + 1;
    row.statistic_attempts_revert = asInt(row.statistic_attempts_revert) + 1;

    if (isCorrect) {
      if (isFirstAttempt) {
        const newCa = asInt(row.correct_attempts_revert) + 1;
        row.correct_attempts_revert = newCa;
        row.statistic_correct_attempts_revert = asInt(row.statistic_correct_attempts_revert) + 1;
        row.last_shown_revert = now;
        row.mode_education_revert = 0;
        if (newCa === 2) row.cooldown_tier_revert = tier;
      } else {
        row.last_shown_revert = now;
        row.mode_education_revert = 0;
      }
    } else {
      row.mode_education_revert = 1;
    }
  } else {
    row.attempts = asInt(row.attempts) + 1;
    row.statistic_attempts = asInt(row.statistic_attempts) + 1;

    if (isCorrect) {
      if (isFirstAttempt) {
        const newCa = asInt(row.correct_attempts) + 1;
        row.correct_attempts = newCa;
        row.statistic_correct_attempts = asInt(row.statistic_correct_attempts) + 1;
        row.last_shown = now;
        row.mode_education = 0;
        if (newCa === 2) row.cooldown_tier = tier;
      } else {
        row.last_shown = now;
        row.mode_education = 0;
      }
    } else {
      row.mode_education = 1;
    }
  }

  if (existing) {
    await pool.query(
      `UPDATE user_dictionary_words SET
        attempts = ?, correct_attempts = ?,
        attempts_revert = ?, correct_attempts_revert = ?,
        last_shown = ?, last_shown_revert = ?,
        mode_education = ?, mode_education_revert = ?,
        cooldown_tier = ?, cooldown_tier_revert = ?,
        statistic_attempts = ?, statistic_attempts_revert = ?,
        statistic_correct_attempts = ?, statistic_correct_attempts_revert = ?,
        updated_at = UTC_TIMESTAMP()
      WHERE id = ?`,
      [
        row.attempts,
        row.correct_attempts,
        row.attempts_revert,
        row.correct_attempts_revert,
        row.last_shown,
        row.last_shown_revert,
        row.mode_education ? 1 : 0,
        row.mode_education_revert ? 1 : 0,
        row.cooldown_tier,
        row.cooldown_tier_revert,
        row.statistic_attempts,
        row.statistic_attempts_revert,
        row.statistic_correct_attempts,
        row.statistic_correct_attempts_revert,
        existing.id,
      ],
    );
  } else {
    await pool.query(
      `INSERT INTO user_dictionary_words (
        user_id, dict_word_id,
        attempts, correct_attempts, attempts_revert, correct_attempts_revert,
        last_shown, last_shown_revert,
        mode_education, mode_education_revert,
        cooldown_tier, cooldown_tier_revert,
        statistic_attempts, statistic_attempts_revert,
        statistic_correct_attempts, statistic_correct_attempts_revert,
        easy_education, easy_correct, easy_correct_revert, is_reset,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, UTC_TIMESTAMP(), UTC_TIMESTAMP()
      )`,
      [
        userId,
        wordId,
        row.attempts,
        row.correct_attempts,
        row.attempts_revert,
        row.correct_attempts_revert,
        row.last_shown,
        row.last_shown_revert,
        row.mode_education ? 1 : 0,
        row.mode_education_revert ? 1 : 0,
        row.cooldown_tier,
        row.cooldown_tier_revert,
        row.statistic_attempts,
        row.statistic_attempts_revert,
        row.statistic_correct_attempts,
        row.statistic_correct_attempts_revert,
      ],
    );
  }

  const [freshRows] = await pool.query(
    'SELECT * FROM user_dictionary_words WHERE user_id = ? AND dict_word_id = ? LIMIT 1',
    [userId, wordId],
  );

  return rowToProgress(freshRows[0]);
}
