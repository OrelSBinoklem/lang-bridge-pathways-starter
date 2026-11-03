<?php

namespace App\Services;

use App\Models\CourseGroup;
use App\Models\CourseStep;
use App\Models\DictionaryCategory;
use App\Models\DictionaryWord;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Builds the vocabulary boundary for a category task.
 *
 * This deliberately uses the published course sequence, rather than the raw
 * category-tree order. A category can contain descendants, and words assigned
 * to more than one category remain visible in both lists while IDs are unique
 * within each list.
 */
class TutorCategoryVocabularyContext
{
    /** @return array<string, mixed> */
    public function build(int $categoryId, ?int $dictionaryId = null): array
    {
        $currentCategory = DictionaryCategory::query()->find($categoryId);
        if (! $currentCategory || ($dictionaryId && (int) $currentCategory->dictionary_id !== $dictionaryId)) {
            throw (new ModelNotFoundException)->setModel(DictionaryCategory::class, [$categoryId]);
        }

        $dictionaryId = (int) $currentCategory->dictionary_id;
        $categories = DictionaryCategory::query()
            ->where('dictionary_id', $dictionaryId)
            ->orderBy('order')
            ->orderBy('id')
            ->get(['id', 'dictionary_id', 'name', 'parent_id', 'order']);
        $categoriesById = $categories->keyBy('id');
        $childrenByParent = $categories->groupBy(fn (DictionaryCategory $category) => $category->parent_id ?? 0);

        $orderedSteps = $this->orderedCourseSteps($dictionaryId);
        $currentIndex = $orderedSteps->search(fn (array $item) => (int) $item['category_id'] === $categoryId);
        $sequenceSource = 'course';

        if ($currentIndex === false) {
            $orderedSteps = $this->orderedTreeCategories($categories, $childrenByParent);
            $currentIndex = $orderedSteps->search(fn (array $item) => (int) $item['category_id'] === $categoryId);
            $sequenceSource = 'category_tree';
        }

        if ($currentIndex === false) {
            // The category exists but is not reachable from a valid tree. It can
            // still be used for a task, just without a previous-course boundary.
            $orderedSteps = collect();
            $currentIndex = 0;
            $sequenceSource = 'standalone';
        }

        $priorItems = $orderedSteps->take($currentIndex)->values();
        $priorWordIds = [];
        $previousCategories = [];

        foreach ($priorItems as $item) {
            $itemCategoryId = (int) $item['category_id'];
            $wordIds = $this->wordIdsForCategory($itemCategoryId, $childrenByParent, $dictionaryId);
            $newWordIds = array_values(array_diff($wordIds, array_keys($priorWordIds)));
            foreach ($wordIds as $wordId) $priorWordIds[$wordId] = true;

            $category = $categoriesById->get($itemCategoryId);
            if (! $category) continue;
            $previousCategories[] = [
                'course_step_id' => $item['course_step_id'] ?? null,
                'id' => $itemCategoryId,
                'name' => $category->name,
                'path' => $this->categoryPath($category, $categoriesById),
                'word_count' => count($wordIds),
                'new_word_count' => count($newWordIds),
            ];
        }

        $currentWordIds = $this->wordIdsForCategory($categoryId, $childrenByParent, $dictionaryId);
        $priorWords = $this->serializeWords(array_keys($priorWordIds), $dictionaryId);
        $currentWords = $this->serializeWords($currentWordIds, $dictionaryId);
        $overlapIds = array_values(array_intersect(array_keys($priorWordIds), $currentWordIds));

        return [
            'dictionary_id' => $dictionaryId,
            'sequence_source' => $sequenceSource,
            'current_category' => [
                'id' => $currentCategory->id,
                'name' => $currentCategory->name,
                'path' => $this->categoryPath($currentCategory, $categoriesById),
                'descendant_category_ids' => $this->descendantIds($categoryId, $childrenByParent),
            ],
            'previous_categories' => $previousCategories,
            'counts' => [
                'previous_categories' => count($previousCategories),
                'prior_unique_words' => count($priorWords),
                'current_unique_words' => count($currentWords),
                'current_words_seen_before' => count($overlapIds),
            ],
            'prior_words' => $priorWords,
            'current_words' => $currentWords,
            'current_word_ids_seen_before' => $overlapIds,
        ];
    }

    /** @return Collection<int, array{course_step_id: int|null, category_id: int}> */
    private function orderedCourseSteps(int $dictionaryId): Collection
    {
        $groups = CourseGroup::query()
            ->where('dictionary_id', $dictionaryId)
            ->where('is_published', true)
            ->get(['id', 'level', 'position']);
        $groupsById = $groups->keyBy('id');
        $visibleGroupIds = $groups->pluck('id')->all();

        return CourseStep::query()
            ->where('kind', 'category')
            ->where('dictionary_id', $dictionaryId)
            ->where('is_published', true)
            ->whereNotNull('category_id')
            ->where(function ($query) use ($visibleGroupIds) {
                $query->whereNull('group_id');
                if ($visibleGroupIds !== []) $query->orWhereIn('group_id', $visibleGroupIds);
            })
            ->get(['id', 'level', 'position', 'group_id', 'category_id'])
            ->sortBy(function (CourseStep $step) use ($groupsById): array {
                $group = $groupsById->get($step->group_id);
                return [
                    $this->levelPosition($step->level),
                    $group ? (int) $group->position : PHP_INT_MAX,
                    (int) $step->position,
                    (int) $step->id,
                ];
            })
            ->map(fn (CourseStep $step) => [
                'course_step_id' => (int) $step->id,
                'category_id' => (int) $step->category_id,
            ])
            ->values();
    }

    /** @return Collection<int, array{course_step_id: null, category_id: int}> */
    private function orderedTreeCategories(Collection $categories, Collection $childrenByParent): Collection
    {
        $items = [];
        $walk = function (int $parentId) use (&$walk, &$items, $childrenByParent): void {
            foreach ($childrenByParent->get($parentId, collect()) as $category) {
                $items[] = ['course_step_id' => null, 'category_id' => (int) $category->id];
                $walk((int) $category->id);
            }
        };
        $walk(0);

        return collect($items);
    }

    /** @return list<int> */
    private function wordIdsForCategory(int $categoryId, Collection $childrenByParent, int $dictionaryId): array
    {
        $categoryIds = [$categoryId, ...$this->descendantIds($categoryId, $childrenByParent)];
        return DB::table('dictionary_word_category as links')
            ->join('dictionary_words as words', 'words.id', '=', 'links.word_id')
            ->where('words.dictionary_id', $dictionaryId)
            ->whereIn('links.category_id', $categoryIds)
            ->orderBy('words.order')
            ->orderBy('words.id')
            ->pluck('words.id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();
    }

    /** @return list<array<string, mixed>> */
    private function serializeWords(array $wordIds, int $dictionaryId): array
    {
        if ($wordIds === []) return [];

        $positions = array_flip($wordIds);
        return DictionaryWord::query()
            ->where('dictionary_id', $dictionaryId)
            ->whereIn('id', $wordIds)
            ->get([
                'id', 'dictionary_id', 'word', 'learn_lang', 'is_phrase',
                'translation_1', 'translation_2', 'translation_3', 'translation_input_variable',
                'difficult_translation', 'info', 'type', 'gender', 'order',
            ])
            ->sortBy(fn (DictionaryWord $word) => $positions[(int) $word->id] ?? PHP_INT_MAX)
            ->map(fn (DictionaryWord $word) => [
                'id' => (int) $word->id,
                'word' => $word->word,
                'learn_lang' => $word->learn_lang,
                'is_phrase' => (bool) $word->is_phrase,
                'translation_1' => $word->translation_1,
                'translation_2' => $word->translation_2,
                'translation_3' => $word->translation_3,
                'translation_input_variable' => $word->translation_input_variable,
                'difficult_translation' => $word->difficult_translation,
                'info' => $word->info,
                'type' => $word->type,
                'gender' => $word->gender,
            ])
            ->values()
            ->all();
    }

    /** @return list<int> */
    private function descendantIds(int $categoryId, Collection $childrenByParent): array
    {
        return $childrenByParent->get($categoryId, collect())
            ->flatMap(fn (DictionaryCategory $child) => [
                (int) $child->id,
                ...$this->descendantIds((int) $child->id, $childrenByParent),
            ])
            ->values()
            ->all();
    }

    /** @return list<string> */
    private function categoryPath(DictionaryCategory $category, Collection $categoriesById): array
    {
        $path = [$category->name];
        $seen = [(int) $category->id => true];
        $parentId = $category->parent_id;
        while ($parentId && ! isset($seen[$parentId]) && ($parent = $categoriesById->get($parentId))) {
            $seen[(int) $parent->id] = true;
            array_unshift($path, $parent->name);
            $parentId = $parent->parent_id;
        }
        return $path;
    }

    private function levelPosition(?string $level): int
    {
        return match ($level) {
            'A1' => 1,
            'A2' => 2,
            'B1' => 3,
            'B2' => 4,
            default => 99,
        };
    }
}
