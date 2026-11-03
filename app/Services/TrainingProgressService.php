<?php

namespace App\Services;

use App\Models\DictionaryWord;
use App\Models\UserDictionaryWord;
use Illuminate\Support\Facades\DB;

class TrainingProgressService
{
    public function updateProgress(int $userId, int $wordId, bool $isRevert): UserDictionaryWord
    {
        $row = UserDictionaryWord::query()->firstOrNew([
            'user_id' => $userId,
            'dict_word_id' => $wordId,
        ]);

        if (! $row->exists) {
            $row->last_shown = now('UTC');
            $row->easy_education = true;
        }

        if ($isRevert) {
            $row->easy_correct_revert = true;
        } else {
            $row->easy_correct = true;
        }

        $row->save();

        return $row->fresh();
    }

    /**
     * Scoring attempt тренажёра.
     * Зеркало: tools/training-ws/updateAttempts.mjs — менять оба файла вместе.
     *
     * @return array{
     *   dict_word_id: int,
     *   attempts: int,
     *   correct_attempts: int,
     *   attempts_revert: int,
     *   correct_attempts_revert: int,
     *   last_shown: ?string,
     *   last_shown_revert: ?string,
     *   mode_education: bool,
     *   mode_education_revert: bool,
     *   cooldown_tier: int,
     *   cooldown_tier_revert: int,
     *   easy_correct: bool,
     *   easy_correct_revert: bool
     * }
     */
    public function updateAttempts(
        int $userId,
        int $wordId,
        bool $isRevert,
        bool $isCorrect,
        bool $isFirstAttempt,
        int $cooldownTier = 0,
    ): array {
        $tier = max(0, min(2, $cooldownTier));
        $now = now('UTC');

        $row = UserDictionaryWord::query()->firstOrNew([
            'user_id' => $userId,
            'dict_word_id' => $wordId,
        ]);

        if (! $row->exists) {
            $row->attempts = 0;
            $row->correct_attempts = 0;
            $row->attempts_revert = 0;
            $row->correct_attempts_revert = 0;
            $row->mode_education = false;
            $row->mode_education_revert = false;
            $row->cooldown_tier = 0;
            $row->cooldown_tier_revert = 0;
            $row->easy_education = false;
            $row->easy_correct = false;
            $row->easy_correct_revert = false;
            $row->statistic_attempts = 0;
            $row->statistic_attempts_revert = 0;
            $row->statistic_correct_attempts = 0;
            $row->statistic_correct_attempts_revert = 0;
            $row->is_reset = false;
        }

        if ($isRevert) {
            $row->attempts_revert = (int) $row->attempts_revert + 1;
            $row->statistic_attempts_revert = (int) $row->statistic_attempts_revert + 1;

            if ($isCorrect) {
                if ($isFirstAttempt) {
                    $newCa = (int) $row->correct_attempts_revert + 1;
                    $row->correct_attempts_revert = $newCa;
                    $row->statistic_correct_attempts_revert = (int) $row->statistic_correct_attempts_revert + 1;
                    $row->last_shown_revert = $now;
                    $row->mode_education_revert = false;
                    if ($newCa === 2) {
                        $row->cooldown_tier_revert = $tier;
                    }
                } else {
                    $row->last_shown_revert = $now;
                    $row->mode_education_revert = false;
                }
            } else {
                $row->mode_education_revert = true;
            }
        } else {
            $row->attempts = (int) $row->attempts + 1;
            $row->statistic_attempts = (int) $row->statistic_attempts + 1;

            if ($isCorrect) {
                if ($isFirstAttempt) {
                    $newCa = (int) $row->correct_attempts + 1;
                    $row->correct_attempts = $newCa;
                    $row->statistic_correct_attempts = (int) $row->statistic_correct_attempts + 1;
                    $row->last_shown = $now;
                    $row->mode_education = false;
                    if ($newCa === 2) {
                        $row->cooldown_tier = $tier;
                    }
                } else {
                    $row->last_shown = $now;
                    $row->mode_education = false;
                }
            } else {
                $row->mode_education = true;
            }
        }

        $row->save();

        return $this->progressRowPayload($row->fresh());
    }

    /**
     * @return array{
     *   dict_word_id: int,
     *   attempts: int,
     *   correct_attempts: int,
     *   attempts_revert: int,
     *   correct_attempts_revert: int,
     *   last_shown: ?string,
     *   last_shown_revert: ?string,
     *   mode_education: bool,
     *   mode_education_revert: bool,
     *   cooldown_tier: int,
     *   cooldown_tier_revert: int,
     *   easy_correct: bool,
     *   easy_correct_revert: bool
     * }
     */
    public function progressRowPayload(UserDictionaryWord $row): array
    {
        return [
            'dict_word_id' => (int) $row->dict_word_id,
            'attempts' => (int) $row->attempts,
            'correct_attempts' => (int) $row->correct_attempts,
            'attempts_revert' => (int) $row->attempts_revert,
            'correct_attempts_revert' => (int) $row->correct_attempts_revert,
            'last_shown' => $row->last_shown?->toIso8601String(),
            'last_shown_revert' => $row->last_shown_revert?->toIso8601String(),
            'mode_education' => (bool) $row->mode_education,
            'mode_education_revert' => (bool) $row->mode_education_revert,
            'cooldown_tier' => (int) $row->cooldown_tier,
            'cooldown_tier_revert' => (int) $row->cooldown_tier_revert,
            'easy_correct' => (bool) $row->easy_correct,
            'easy_correct_revert' => (bool) $row->easy_correct_revert,
        ];
    }

    /** @param list<int> $wordIds */
    public function resetWords(int $userId, array $wordIds): void
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $wordIds))));
        if ($ids === []) {
            return;
        }

        UserDictionaryWord::query()
            ->where('user_id', $userId)
            ->whereIn('dict_word_id', $ids)
            ->update([
                'easy_education' => false,
                'easy_correct' => false,
                'easy_correct_revert' => false,
                'mode_education' => true,
                'mode_education_revert' => true,
                'cooldown_tier' => 0,
                'cooldown_tier_revert' => 0,
                'last_shown' => null,
                'last_shown_revert' => null,
                'correct_attempts' => 0,
                'correct_attempts_revert' => 0,
                'is_reset' => true,
            ]);
    }

    public function resetCategory(int $userId, int $categoryId): void
    {
        $wordIds = DB::table('dictionary_word_category')
            ->where('category_id', $categoryId)
            ->pluck('word_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $this->resetWords($userId, $wordIds);
    }

    /** @param list<int> $categoryIds */
    public function setCategoriesEasyMode(int $userId, array $categoryIds): int
    {
        $wordIds = DB::table('dictionary_word_category')
            ->whereIn('category_id', $categoryIds)
            ->pluck('word_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        if ($wordIds === []) {
            return 0;
        }

        $this->ensureProgressRowsForWords($userId, $wordIds);

        return UserDictionaryWord::query()
            ->where('user_id', $userId)
            ->whereIn('dict_word_id', $wordIds)
            ->update([
                'easy_education' => true,
                'mode_education' => true,
                'mode_education_revert' => true,
            ]);
    }

    /** @param list<int> $categoryIds */
    public function demoteCategoryScoresToOne(int $userId, array $categoryIds): int
    {
        $wordIds = DB::table('dictionary_word_category')
            ->whereIn('category_id', $categoryIds)
            ->pluck('word_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        if ($wordIds === []) {
            return 0;
        }

        $updated = 0;
        UserDictionaryWord::query()
            ->where('user_id', $userId)
            ->whereIn('dict_word_id', $wordIds)
            ->where(function ($q) {
                $q->where('correct_attempts', '>=', 2)
                    ->orWhere('correct_attempts_revert', '>=', 2);
            })
            ->each(function (UserDictionaryWord $row) use (&$updated) {
                if ((int) $row->correct_attempts >= 2) {
                    $row->correct_attempts = 1;
                }
                if ((int) $row->correct_attempts_revert >= 2) {
                    $row->correct_attempts_revert = 1;
                }
                $row->save();
                $updated++;
            });

        return $updated;
    }

    /** @param list<int> $wordIds */
    public function ensureProgressRowsForWords(int $userId, array $wordIds): void
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $wordIds))));
        if ($ids === []) {
            return;
        }

        $existing = UserDictionaryWord::query()
            ->where('user_id', $userId)
            ->whereIn('dict_word_id', $ids)
            ->pluck('dict_word_id')
            ->all();

        $missing = array_values(array_diff($ids, array_map('intval', $existing)));
        $now = now();
        foreach (array_chunk($missing, 200) as $chunk) {
            $payload = [];
            foreach ($chunk as $wordId) {
                $payload[] = [
                    'user_id' => $userId,
                    'dict_word_id' => $wordId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
            UserDictionaryWord::query()->insert($payload);
        }
    }

    public function ensureProgressRows(int $userId, int $dictionaryId): void
    {
        $wordIds = DictionaryWord::query()
            ->where('dictionary_id', $dictionaryId)
            ->pluck('id');

        $existing = UserDictionaryWord::query()
            ->where('user_id', $userId)
            ->whereIn('dict_word_id', $wordIds)
            ->pluck('dict_word_id')
            ->all();

        $missing = $wordIds->diff($existing);
        $now = now();

        foreach ($missing->chunk(200) as $chunk) {
            $payload = [];
            foreach ($chunk as $wordId) {
                $payload[] = [
                    'user_id' => $userId,
                    'dict_word_id' => $wordId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
            UserDictionaryWord::query()->insert($payload);
        }
    }
}
