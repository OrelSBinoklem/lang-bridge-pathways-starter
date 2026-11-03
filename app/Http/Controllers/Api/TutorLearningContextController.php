<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Dictionary;
use App\Models\DictionaryCategory;
use App\Models\DictionaryWord;
use App\Models\UserDictionaryWord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class TutorLearningContextController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $dictionaries = Dictionary::query()
            ->orderBy('id')
            ->get(['id', 'name', 'lang', 'learn_lang', 'words', 'level', 'max_level', 'sound']);

        $languages = [
            'interface' => [
                ['code' => 'ru', 'title' => 'Русский'],
                ['code' => 'uk', 'title' => 'Українська'],
            ],
            'learning' => $dictionaries
                ->pluck('learn_lang')
                ->filter()
                ->map(fn ($lang) => strtolower((string) $lang))
                ->unique()
                ->values()
                ->map(fn ($lang) => ['code' => $lang, 'title' => strtoupper($lang)])
                ->all(),
            'source' => $dictionaries
                ->pluck('lang')
                ->filter()
                ->map(fn ($lang) => strtolower((string) $lang))
                ->unique()
                ->values()
                ->map(fn ($lang) => ['code' => $lang, 'title' => strtoupper($lang)])
                ->all(),
        ];

        $dictionaryPayloads = $dictionaries->map(function (Dictionary $dictionary) use ($user) {
            $categories = DictionaryCategory::query()
                ->where('dictionary_id', $dictionary->id)
                ->orderBy('order')
                ->orderBy('id')
                ->get(['id', 'dictionary_id', 'name', 'parent_id', 'order']);
            $childrenByParent = $categories->groupBy(fn (DictionaryCategory $category) => $category->parent_id ?? 0);
            $wordIdsByCategory = $this->wordIdsByCategory($dictionary->id);
            $progressByWordId = $this->progressByWordId((int) $user->id, $dictionary->id);
            $descendantIdsByCategory = [];
            $statsByCategory = [];

            foreach ($categories as $category) {
                $descendantIdsByCategory[$category->id] = $this->descendantIds((int) $category->id, $childrenByParent);
            }

            foreach ($categories as $category) {
                $categoryIds = array_values(array_unique([(int) $category->id, ...($descendantIdsByCategory[$category->id] ?? [])]));
                $wordIds = collect($categoryIds)
                    ->flatMap(fn ($categoryId) => $wordIdsByCategory[$categoryId] ?? [])
                    ->unique()
                    ->values();
                $statsByCategory[$category->id] = $this->progressStats($wordIds, $progressByWordId);
            }

            $buildTree = function (int $parentId, int $depth) use (&$buildTree, $childrenByParent, $statsByCategory): array {
                return ($childrenByParent[$parentId] ?? collect())
                    ->map(fn (DictionaryCategory $category) => [
                        'id' => $category->id,
                        'name' => $category->name,
                        'parent_id' => $category->parent_id,
                        'depth' => $depth,
                        'order' => $category->order,
                        'progress' => $statsByCategory[$category->id] ?? $this->emptyProgressStats(),
                        'children' => $buildTree((int) $category->id, $depth + 1),
                    ])
                    ->values()
                    ->all();
            };

            return [
                'id' => $dictionary->id,
                'name' => $dictionary->name,
                'lang' => $dictionary->lang,
                'learn_lang' => $dictionary->learn_lang,
                'words' => $dictionary->words,
                'level' => $dictionary->level,
                'max_level' => $dictionary->max_level,
                'sound' => $dictionary->sound,
                'category_tree' => $buildTree(0, 1),
                'level_2_progress' => $categories
                    ->filter(fn (DictionaryCategory $category) => $category->parent_id !== null
                        && optional($categories->firstWhere('id', $category->parent_id))->parent_id === null)
                    ->map(fn (DictionaryCategory $category) => [
                        'id' => $category->id,
                        'name' => $category->name,
                        'parent_id' => $category->parent_id,
                        'progress' => $statsByCategory[$category->id] ?? $this->emptyProgressStats(),
                    ])
                    ->values()
                    ->all(),
            ];
        });

        return response()->json([
            'data' => [
                'languages' => $languages,
                'dictionaries' => $dictionaryPayloads,
            ],
        ]);
    }

    /** @return array<int, array<int, int>> */
    private function wordIdsByCategory(int $dictionaryId): array
    {
        $rows = DB::table('dictionary_word_category')
            ->join('dictionary_words', 'dictionary_words.id', '=', 'dictionary_word_category.word_id')
            ->where('dictionary_words.dictionary_id', $dictionaryId)
            ->get(['dictionary_word_category.category_id', 'dictionary_word_category.word_id']);

        return $rows
            ->groupBy('category_id')
            ->map(fn (Collection $items) => $items->pluck('word_id')->map(fn ($id) => (int) $id)->all())
            ->all();
    }

    /** @return array<int, array{direct: int, revert: int}> */
    private function progressByWordId(int $userId, int $dictionaryId): array
    {
        return UserDictionaryWord::query()
            ->where('user_id', $userId)
            ->whereHas('word', fn ($query) => $query->where('dictionary_id', $dictionaryId))
            ->get(['dict_word_id', 'correct_attempts', 'correct_attempts_revert'])
            ->mapWithKeys(fn (UserDictionaryWord $row) => [
                (int) $row->dict_word_id => [
                    'direct' => (int) $row->correct_attempts,
                    'revert' => (int) $row->correct_attempts_revert,
                ],
            ])
            ->all();
    }

    /** @param array<int, Collection<int, DictionaryCategory>> $childrenByParent */
    private function descendantIds(int $categoryId, Collection $childrenByParent): array
    {
        return ($childrenByParent[$categoryId] ?? collect())
            ->flatMap(fn (DictionaryCategory $child) => [
                (int) $child->id,
                ...$this->descendantIds((int) $child->id, $childrenByParent),
            ])
            ->values()
            ->all();
    }

    private function progressStats(Collection $wordIds, array $progressByWordId): array
    {
        $wordCount = $wordIds->count();
        if ($wordCount === 0) {
            return $this->emptyProgressStats();
        }

        $totalDirections = $wordCount * 2;
        $learnedDirections = 0;
        $fullyLearnedWords = 0;

        foreach ($wordIds as $wordId) {
            $progress = $progressByWordId[(int) $wordId] ?? ['direct' => 0, 'revert' => 0];
            $directLearned = $progress['direct'] >= 2;
            $revertLearned = $progress['revert'] >= 2;
            if ($directLearned) $learnedDirections += 1;
            if ($revertLearned) $learnedDirections += 1;
            if ($directLearned && $revertLearned) $fullyLearnedWords += 1;
        }

        return [
            'word_count' => $wordCount,
            'total_directions' => $totalDirections,
            'learned_directions' => $learnedDirections,
            'fully_learned_words' => $fullyLearnedWords,
            'percent' => round(($learnedDirections / $totalDirections) * 100, 1),
        ];
    }

    private function emptyProgressStats(): array
    {
        return [
            'word_count' => 0,
            'total_directions' => 0,
            'learned_directions' => 0,
            'fully_learned_words' => 0,
            'percent' => 0.0,
        ];
    }
}
