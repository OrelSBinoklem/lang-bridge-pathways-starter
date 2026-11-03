<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Dictionary;
use App\Models\DictionaryCategory;
use App\Models\DictionaryWord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CategoryAdminController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'dictionary_id' => ['required', 'integer', 'exists:dictionaries,id'],
            'name' => ['required', 'string', 'min:2', 'max:255'],
            'name_translations' => ['nullable', 'array'],
            'name_translations.*' => ['nullable', 'string', 'min:1', 'max:255'],
            'parent_id' => ['nullable', 'integer', 'exists:dictionary_categories,id'],
            'order' => ['nullable', 'integer', 'min:0'],
        ]);

        if (! empty($data['parent_id'])) {
            $parent = DictionaryCategory::query()->findOrFail($data['parent_id']);
            if ((int) $parent->dictionary_id !== (int) $data['dictionary_id']) {
                throw ValidationException::withMessages([
                    'parent_id' => 'Родительская категория из другого словаря.',
                ]);
            }
        }

        $order = $data['order'] ?? ((int) DictionaryCategory::query()
            ->where('dictionary_id', $data['dictionary_id'])
            ->when(
                empty($data['parent_id']),
                fn ($q) => $q->whereNull('parent_id'),
                fn ($q) => $q->where('parent_id', $data['parent_id']),
            )
            ->max('order') + 1);

        $category = DictionaryCategory::query()->create([
            'dictionary_id' => $data['dictionary_id'],
            'name' => trim($data['name']),
            'parent_id' => $data['parent_id'] ?? null,
            'order' => $order,
        ]);

        $dictionary = Dictionary::query()->findOrFail($data['dictionary_id']);
        $this->syncCategoryTranslation($category, (string) ($dictionary->lang ?: 'ru'), trim($data['name']));
        $this->syncCategoryTranslationsFromPayload($category, $data['name_translations'] ?? []);
        $this->syncDictionaryTranslationLanguages($dictionary);

        return response()->json([
            'data' => $category->fresh()->load('translations'),
            'message' => 'Категория создана',
        ], 201);
    }

    public function update(Request $request, DictionaryCategory $category): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'min:2', 'max:255'],
            'name_translations' => ['nullable', 'array'],
            'name_translations.*' => ['nullable', 'string', 'min:1', 'max:255'],
            'parent_id' => ['nullable', 'integer', 'exists:dictionary_categories,id'],
            'order' => ['nullable', 'integer', 'min:0'],
        ]);

        if (array_key_exists('parent_id', $data) && $data['parent_id']) {
            if ((int) $data['parent_id'] === (int) $category->id) {
                throw ValidationException::withMessages(['parent_id' => 'Категория не может быть родителем самой себе.']);
            }
            $parent = DictionaryCategory::query()->findOrFail($data['parent_id']);
            if ((int) $parent->dictionary_id !== (int) $category->dictionary_id) {
                throw ValidationException::withMessages(['parent_id' => 'Родитель из другого словаря.']);
            }
            if ($this->wouldCreateCycle($category->id, (int) $data['parent_id'])) {
                throw ValidationException::withMessages(['parent_id' => 'Циклическая вложенность.']);
            }
        }

        if (isset($data['name'])) {
            $data['name'] = trim($data['name']);
        }

        $category->fill(collect($data)->except(['name_translations'])->all());
        $category->save();

        $dictionary = $category->dictionary()->first();
        if ($dictionary && array_key_exists('name', $data)) {
            $this->syncCategoryTranslation($category, (string) ($dictionary->lang ?: 'ru'), $category->name);
        }
        if (array_key_exists('name_translations', $data)) {
            $this->syncCategoryTranslationsFromPayload($category, $data['name_translations'] ?? []);
        }
        if ($dictionary) {
            $this->syncDictionaryTranslationLanguages($dictionary);
        }

        return response()->json([
            'data' => $category->fresh()->load('translations'),
            'message' => 'Категория обновлена',
        ]);
    }

    public function destroy(DictionaryCategory $category): JsonResponse
    {
        DB::transaction(function () use ($category) {
            // Как в WP: отвязать слова, детей поднять в корень
            DB::table('dictionary_word_category')->where('category_id', $category->id)->delete();
            DictionaryCategory::query()
                ->where('parent_id', $category->id)
                ->update(['parent_id' => null]);
            $category->delete();
        });

        return response()->json(['ok' => true, 'message' => 'Категория удалена']);
    }

    public function reorder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'dictionary_id' => ['required', 'integer', 'exists:dictionaries,id'],
            'parent_id' => ['nullable', 'integer', 'exists:dictionary_categories,id'],
            'category_orders' => ['required', 'array', 'min:1'],
            'category_orders.*.category_id' => ['required', 'integer'],
            'category_orders.*.order' => ['required', 'integer', 'min:0'],
        ]);

        $parentId = $data['parent_id'] ?? null;
        $validIds = DictionaryCategory::query()
            ->where('dictionary_id', $data['dictionary_id'])
            ->when(
                $parentId === null,
                fn ($q) => $q->whereNull('parent_id'),
                fn ($q) => $q->where('parent_id', $parentId),
            )
            ->pluck('id')
            ->all();

        $updated = 0;
        foreach ($data['category_orders'] as $item) {
            $id = (int) $item['category_id'];
            if (! in_array($id, $validIds, true)) {
                continue;
            }
            DictionaryCategory::query()->where('id', $id)->update(['order' => (int) $item['order']]);
            $updated++;
        }

        return response()->json(['reordered' => true, 'updated_count' => $updated]);
    }

    public function moveToDictionary(Request $request, DictionaryCategory $category): JsonResponse
    {
        $data = $request->validate([
            'target_dictionary_id' => ['required', 'integer', 'exists:dictionaries,id'],
            'target_parent_id' => ['nullable', 'integer', 'exists:dictionary_categories,id'],
        ]);

        $targetDictId = (int) $data['target_dictionary_id'];
        $targetParentId = $data['target_parent_id'] ?? null;

        if ((int) $category->dictionary_id === $targetDictId) {
            throw ValidationException::withMessages([
                'target_dictionary_id' => 'Категория уже в этом словаре.',
            ]);
        }

        if ($targetParentId) {
            $targetParent = DictionaryCategory::query()->findOrFail($targetParentId);
            if ((int) $targetParent->dictionary_id !== $targetDictId) {
                throw ValidationException::withMessages([
                    'target_parent_id' => 'Родитель не из целевого словаря.',
                ]);
            }
        }

        $sourceDictId = (int) $category->dictionary_id;
        $subtreeIds = $this->collectSubtreeIds($category->id);
        $movedWords = 0;
        $clonedWords = 0;

        DB::transaction(function () use (
            $category,
            $targetDictId,
            $targetParentId,
            $subtreeIds,
            $sourceDictId,
            &$movedWords,
            &$clonedWords,
        ) {
            $targetLearnLang = Dictionary::query()->where('id', $targetDictId)->value('learn_lang');
            $rootOrder = (int) DictionaryCategory::query()
                ->where('dictionary_id', $targetDictId)
                ->when(
                    $targetParentId === null,
                    fn ($q) => $q->whereNull('parent_id'),
                    fn ($q) => $q->where('parent_id', $targetParentId),
                )
                ->max('order') + 1;

            $category->update([
                'dictionary_id' => $targetDictId,
                'parent_id' => $targetParentId,
                'order' => $rootOrder,
            ]);

            DictionaryCategory::query()
                ->whereIn('id', array_diff($subtreeIds, [$category->id]))
                ->update(['dictionary_id' => $targetDictId]);

            $wordIds = DB::table('dictionary_word_category')
                ->whereIn('category_id', $subtreeIds)
                ->distinct()
                ->pluck('word_id')
                ->map(fn ($id) => (int) $id)
                ->all();

            $externalLinks = DB::table('dictionary_word_category')
                ->whereIn('word_id', $wordIds)
                ->whereNotIn('category_id', $subtreeIds)
                ->pluck('word_id')
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->all();

            $wordIdMap = [];

            foreach ($wordIds as $wordId) {
                $word = DictionaryWord::query()->find($wordId);
                if (! $word) {
                    continue;
                }

                $needsClone = in_array($wordId, $externalLinks, true)
                    || (int) $word->dictionary_id !== $sourceDictId;

                if ($needsClone || (int) $word->dictionary_id !== $targetDictId) {
                    if (in_array($wordId, $externalLinks, true)) {
                        $clone = $word->replicate();
                        $clone->dictionary_id = $targetDictId;
                        $clone->learn_lang = $targetLearnLang ?? $word->learn_lang;
                        $clone->save();
                        $this->copyWordTranslations($word, $clone);
                        $wordIdMap[$wordId] = $clone->id;
                        $clonedWords++;

                        // Переключить связи поддерева на клон
                        foreach ($subtreeIds as $catId) {
                            $exists = DB::table('dictionary_word_category')
                                ->where('word_id', $wordId)
                                ->where('category_id', $catId)
                                ->exists();
                            if (! $exists) {
                                continue;
                            }
                            DB::table('dictionary_word_category')
                                ->where('word_id', $wordId)
                                ->where('category_id', $catId)
                                ->delete();
                            DB::table('dictionary_word_category')->insertOrIgnore([
                                'word_id' => $clone->id,
                                'category_id' => $catId,
                            ]);
                        }
                    } else {
                        $word->dictionary_id = $targetDictId;
                        $word->learn_lang = $targetLearnLang ?? $word->learn_lang;
                        $word->save();
                        $movedWords++;
                    }
                } else {
                    $movedWords++;
                }
            }

            foreach ([$sourceDictId, $targetDictId] as $dictId) {
                Dictionary::query()->where('id', $dictId)->update([
                    'words' => DictionaryWord::query()->where('dictionary_id', $dictId)->count(),
                ]);
                $dictionary = Dictionary::query()->find($dictId);
                if ($dictionary) {
                    $this->syncDictionaryTranslationLanguages($dictionary);
                }
            }
        });

        return response()->json([
            'success' => true,
            'moved_category_id' => $category->id,
            'target_dictionary_id' => $targetDictId,
            'moved_words' => $movedWords,
            'cloned_words' => $clonedWords,
            'message' => 'Категория перенесена',
        ]);
    }

    /** @return list<int> */
    private function collectSubtreeIds(int $rootId): array
    {
        $ids = [$rootId];
        $queue = [$rootId];
        while ($queue !== []) {
            $parent = array_shift($queue);
            $children = DictionaryCategory::query()
                ->where('parent_id', $parent)
                ->pluck('id')
                ->all();
            foreach ($children as $childId) {
                $ids[] = (int) $childId;
                $queue[] = (int) $childId;
            }
        }

        return array_values(array_unique($ids));
    }

    private function wouldCreateCycle(int $categoryId, int $newParentId): bool
    {
        $current = $newParentId;
        $guard = 0;
        while ($current && $guard < 100) {
            if ($current === $categoryId) {
                return true;
            }
            $current = (int) (DictionaryCategory::query()->where('id', $current)->value('parent_id') ?? 0);
            $guard++;
        }

        return false;
    }

    private function normalizeLang(string $lang): string
    {
        return strtolower(trim($lang)) ?: 'ru';
    }

    private function syncCategoryTranslation(DictionaryCategory $category, string $lang, ?string $name): void
    {
        $name = trim((string) $name);
        if ($name === '') {
            return;
        }

        $category->translations()->updateOrCreate(
            ['lang' => $this->normalizeLang($lang)],
            ['name' => $name],
        );
    }

    private function syncCategoryTranslationsFromPayload(DictionaryCategory $category, array $translations): void
    {
        foreach ($translations as $lang => $name) {
            $this->syncCategoryTranslation($category, (string) $lang, is_scalar($name) ? (string) $name : null);
        }
    }

    private function copyWordTranslations(DictionaryWord $source, DictionaryWord $target): void
    {
        $source->loadMissing('translations');
        foreach ($source->translations as $translation) {
            $target->translations()->updateOrCreate(
                ['lang' => $this->normalizeLang((string) $translation->lang)],
                [
                    'translation_1' => $translation->translation_1,
                    'translation_2' => $translation->translation_2,
                    'translation_3' => $translation->translation_3,
                    'translation_input_variable' => $translation->translation_input_variable,
                    'difficult_translation' => $translation->difficult_translation,
                    'info' => $translation->info,
                ],
            );
        }
    }

    private function syncDictionaryTranslationLanguages(Dictionary $dictionary): void
    {
        $wordLanguages = DB::table('dictionary_word_translations')
            ->join('dictionary_words', 'dictionary_words.id', '=', 'dictionary_word_translations.word_id')
            ->where('dictionary_words.dictionary_id', $dictionary->id)
            ->pluck('dictionary_word_translations.lang');

        $categoryLanguages = DB::table('dictionary_category_translations')
            ->join('dictionary_categories', 'dictionary_categories.id', '=', 'dictionary_category_translations.category_id')
            ->where('dictionary_categories.dictionary_id', $dictionary->id)
            ->pluck('dictionary_category_translations.lang');

        $languages = $wordLanguages
            ->merge($categoryLanguages)
            ->push($dictionary->lang ?: 'ru')
            ->map(fn ($lang) => $this->normalizeLang((string) $lang))
            ->filter()
            ->unique()
            ->values()
            ->all();

        $dictionary->forceFill(['translation_languages' => $languages])->save();
    }
}
