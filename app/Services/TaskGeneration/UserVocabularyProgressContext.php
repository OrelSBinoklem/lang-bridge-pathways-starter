<?php

namespace App\Services\TaskGeneration;

use App\Models\Dictionary;
use App\Models\DictionaryCategory;
use App\Models\User;
use App\Support\DictionaryCategoryTree;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Read-only progress input for the future task generator.
 *
 * A word is "learned" only under the course's canonical condition: at least
 * two correct first attempts in each training direction. "words_with_score"
 * is intentionally broader: one correct attempt in either direction is enough.
 */
class UserVocabularyProgressContext
{
    /** @return array<string, mixed> */
    public function build(int $userId, ?int $dictionaryId = null, ?int $categoryId = null): array
    {
        User::query()->findOrFail($userId);

        $category = null;
        $categoryIds = [];
        if ($categoryId !== null) {
            $category = DictionaryCategory::query()->find($categoryId);
            if (! $category || ($dictionaryId !== null && (int) $category->dictionary_id !== $dictionaryId)) {
                throw (new ModelNotFoundException)->setModel(DictionaryCategory::class, [$categoryId]);
            }
            $dictionaryId = (int) $category->dictionary_id;
            $categoryIds = [(int) $category->id, ...$this->descendantIds((int) $category->id, $dictionaryId)];
        }

        if ($dictionaryId !== null && ! Dictionary::query()->whereKey($dictionaryId)->exists()) {
            throw (new ModelNotFoundException)->setModel(Dictionary::class, [$dictionaryId]);
        }

        $rows = DB::table('user_dictionary_words as progress')
            ->join('dictionary_words as words', 'words.id', '=', 'progress.dict_word_id')
            ->where('progress.user_id', $userId)
            ->where(function ($query) {
                $query->where('progress.correct_attempts', '>=', 1)
                    ->orWhere('progress.correct_attempts_revert', '>=', 1);
            })
            ->when($dictionaryId !== null, fn ($query) => $query->where('words.dictionary_id', $dictionaryId))
            ->when($categoryIds !== [], fn ($query) => $query->whereIn('words.id', function ($wordQuery) use ($categoryIds) {
                $wordQuery->from('dictionary_word_category')
                    ->select('word_id')
                    ->whereIn('category_id', $categoryIds);
            }))
            ->orderBy('words.order')
            ->orderBy('words.id')
            ->get([
                'words.id', 'words.dictionary_id', 'words.word', 'words.learn_lang', 'words.is_phrase',
                'words.translation_1', 'words.translation_2', 'words.translation_3',
                'words.translation_input_variable', 'words.difficult_translation', 'words.info', 'words.type', 'words.gender',
                'progress.attempts', 'progress.correct_attempts', 'progress.attempts_revert', 'progress.correct_attempts_revert',
            ])
            ->map(function (object $row): array {
                $directCorrect = (int) $row->correct_attempts;
                $revertCorrect = (int) $row->correct_attempts_revert;

                return [
                    'id' => (int) $row->id,
                    'word' => $row->word,
                    'learn_lang' => $row->learn_lang,
                    'is_phrase' => (bool) $row->is_phrase,
                    'translation_1' => $row->translation_1,
                    'translation_2' => $row->translation_2,
                    'translation_3' => $row->translation_3,
                    'translation_input_variable' => $row->translation_input_variable,
                    'difficult_translation' => $row->difficult_translation,
                    'info' => $row->info,
                    'type' => $row->type,
                    'gender' => $row->gender,
                    'progress' => [
                        'direct_attempts' => (int) $row->attempts,
                        'direct_correct_attempts' => $directCorrect,
                        'reverse_attempts' => (int) $row->attempts_revert,
                        'reverse_correct_attempts' => $revertCorrect,
                        'has_score' => true,
                        'is_fully_learned' => $directCorrect >= 2 && $revertCorrect >= 2,
                    ],
                ];
            })
            ->values();

        $learnedWords = $rows
            ->filter(fn (array $word) => $word['progress']['is_fully_learned'])
            ->values()
            ->all();

        return [
            'user_id' => $userId,
            'scope' => [
                'dictionary_id' => $dictionaryId,
                'category_id' => $category?->id,
                'descendant_category_ids' => $categoryIds === [] ? [] : array_values(array_diff($categoryIds, [(int) $category->id])),
            ],
            'criteria' => [
                'words_with_score' => 'correct_attempts >= 1 OR correct_attempts_revert >= 1',
                'learned_words' => 'correct_attempts >= 2 AND correct_attempts_revert >= 2',
            ],
            'counts' => [
                'words_with_score' => $rows->count(),
                'learned_words' => count($learnedWords),
                'started_but_not_fully_learned_words' => $rows->count() - count($learnedWords),
            ],
            'learned_words' => $learnedWords,
            'learned_categories' => $this->learnedCategories($dictionaryId, array_column($learnedWords, 'id'), $categoryIds),
            'words_with_score' => $rows->all(),
        ];
    }

    private function learnedCategories(?int $dictionaryId, array $learnedIds, array $scopeIds): array
    {
        $categories = DictionaryCategory::query()->when($dictionaryId !== null, fn ($q) => $q->where('dictionary_id', $dictionaryId))
            ->get(['id', 'dictionary_id', 'parent_id', 'order', 'name']);
        $tree = new DictionaryCategoryTree($categories);
        $links = DB::table('dictionary_word_category')->join('dictionary_words', 'dictionary_words.id', '=', 'word_id')
            ->whereIn('category_id', $categories->pluck('id'))
            ->when($dictionaryId !== null, fn ($q) => $q->where('dictionary_words.dictionary_id', $dictionaryId))
            ->get(['category_id', 'word_id'])->groupBy('category_id');
        $result = [];
        foreach ($categories as $category) {
            if ($scopeIds !== [] && ! in_array((int) $category->id, $scopeIds, true)) continue;
            $wordIds = collect($tree->descendantIdsFor($category->id))
                ->flatMap(fn ($id) => $links->get($id, collect())->pluck('word_id'))->unique()->all();
            if ($wordIds !== [] && array_diff($wordIds, $learnedIds) === []) {
                $result[] = ['id' => $category->id, 'dictionary_id' => $category->dictionary_id, 'parent_id' => $category->parent_id, 'name' => $category->name, 'unique_words' => count($wordIds)];
            }
        }

        return $result;
    }

    /** @return list<int> */
    private function descendantIds(int $categoryId, int $dictionaryId): array
    {
        $categories = DictionaryCategory::query()
            ->where('dictionary_id', $dictionaryId)
            ->get(['id', 'parent_id'])
            ->groupBy(fn (DictionaryCategory $item) => $item->parent_id ?? 0);

        $walk = function (int $parentId) use (&$walk, $categories): array {
            return $categories->get($parentId, collect())
                ->flatMap(fn (DictionaryCategory $child) => [(int) $child->id, ...$walk((int) $child->id)])
                ->values()
                ->all();
        };

        return $walk($categoryId);
    }
}
