<?php

namespace App\Services;

use App\Models\Dictionary;
use App\Models\DictionaryCategory;
use App\Models\DictionaryWord;
use App\Models\UniqueWord;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;

class DictionaryUpdateService
{
    public function __construct(
        private readonly DictionaryImportService $importService,
    ) {}

    /**
     * Умное обновление: upsert слов по (L2, word), прогресс сохраняется.
     *
     * @param  array<int, mixed>|string  $data
     * @param  array<string, mixed>  $meta
     * @return array{updated: int, created: int, deleted: int, categories_synced: int, words: int}
     */
    public function updateFromJson(Dictionary $dictionary, array|string $data, array $meta = []): array
    {
        $data = $this->importService->decodeJson($data);
        if ($data === []) {
            throw new InvalidArgumentException('JSON должен быть непустым массивом');
        }

        $computed = $this->importService->computeLevelRange($data);
        if ($computed['count'] === 0) {
            throw new InvalidArgumentException('В JSON не найдено слов');
        }

        $meta = $this->mergeDictionaryMeta($dictionary, $meta);
        [$level, $maxLevel, $sound] = array_slice(
            $this->importService->resolveMetaLevels($meta, $computed),
            0,
            3,
        );
        $learnLang = trim((string) ($meta['learn_lang'] ?? $dictionary->learn_lang));

        return DB::transaction(function () use ($dictionary, $data, $meta, $level, $maxLevel, $sound, $learnLang) {
            $categoriesSynced = $this->syncCategoryTree($dictionary, $data);

            $categories = DictionaryCategory::query()
                ->where('dictionary_id', $dictionary->id)
                ->get()
                ->keyBy('id');

            $l2ByCategoryId = $this->buildL2AnchorMap($categories);
            $subtreeByL2 = $this->buildSubtreeMap($categories, $l2ByCategoryId);
            $wordIndex = $this->buildWordIndex($dictionary, $categories, $l2ByCategoryId);

            $seenWordIds = [];
            $updated = 0;
            $created = 0;
            $order = 0;

            $this->walkJsonWithCategories(
                $data,
                null,
                $dictionary,
                $categories,
                function (
                    array $item,
                    DictionaryCategory $targetCategory,
                ) use (
                    $dictionary,
                    $learnLang,
                    $l2ByCategoryId,
                    $subtreeByL2,
                    &$wordIndex,
                    &$seenWordIds,
                    &$updated,
                    &$created,
                    &$order,
                ) {
                    $order++;
                    $wordText = (string) $item['word'];
                    $key = $this->wordKey($l2ByCategoryId[$targetCategory->id] ?? $targetCategory->id, $wordText);
                    $attrs = $this->importService->wordAttributesFromJson($item, $learnLang, $order);
                    $l2Id = $l2ByCategoryId[$targetCategory->id] ?? $targetCategory->id;
                    $subtreeIds = $subtreeByL2[$l2Id] ?? [$targetCategory->id];

                    if (isset($wordIndex[$key])) {
                        /** @var DictionaryWord $word */
                        $word = $wordIndex[$key];
                        $word->fill($attrs);
                        $word->dictionary_id = $dictionary->id;
                        $word->save();

                        $detachIds = $word->categories()
                            ->whereIn('dictionary_categories.id', $subtreeIds)
                            ->pluck('dictionary_categories.id')
                            ->all();
                        if ($detachIds !== []) {
                            $word->categories()->detach($detachIds);
                        }
                        $word->categories()->syncWithoutDetaching([$targetCategory->id]);

                        $seenWordIds[$word->id] = true;
                        $updated++;
                    } else {
                        $word = DictionaryWord::query()->create([
                            'dictionary_id' => $dictionary->id,
                            ...$attrs,
                        ]);
                        $word->categories()->attach($targetCategory->id);
                        UniqueWord::query()->firstOrCreate([
                            'word' => $wordText,
                            'lang' => $learnLang,
                        ]);
                        $wordIndex[$key] = $word;
                        $seenWordIds[$word->id] = true;
                        $created++;
                    }
                },
            );

            $deleted = $this->pruneMissingWords($dictionary, $seenWordIds);
            $this->pruneEmptyCategories($dictionary, $data);

            $dictionary->update([
                'name' => trim((string) ($meta['name'] ?? $dictionary->name)),
                'lang' => trim((string) ($meta['lang'] ?? $dictionary->lang)),
                'learn_lang' => $learnLang,
                'level' => $level,
                'max_level' => $maxLevel,
                'sound' => $sound,
                'words' => $dictionary->dictionaryWords()->count(),
            ]);

            return [
                'updated' => $updated,
                'created' => $created,
                'deleted' => $deleted,
                'categories_synced' => $categoriesSynced,
                'words' => (int) $dictionary->fresh()->words,
            ];
        });
    }

    /**
     * Полная замена содержимого словаря (прогресс по старым словам теряется).
     *
     * @param  array<int, mixed>|string  $data
     * @param  array<string, mixed>  $meta
     * @return array{updated: int, created: int, deleted: int, categories_synced: int, words: int}
     */
    public function replaceFromJson(Dictionary $dictionary, array|string $data, array $meta = []): array
    {
        $data = $this->importService->decodeJson($data);
        if ($data === []) {
            throw new InvalidArgumentException('JSON должен быть непустым массивом');
        }

        $computed = $this->importService->computeLevelRange($data);
        if ($computed['count'] === 0) {
            throw new InvalidArgumentException('В JSON не найдено слов');
        }

        $meta = $this->mergeDictionaryMeta($dictionary, $meta);
        [$level, $maxLevel, $sound] = array_slice(
            $this->importService->resolveMetaLevels($meta, $computed),
            0,
            3,
        );
        $learnLang = trim((string) ($meta['learn_lang'] ?? $dictionary->learn_lang));

        return DB::transaction(function () use ($dictionary, $data, $meta, $level, $maxLevel, $sound, $learnLang) {
            $deleted = $dictionary->dictionaryWords()->count();

            DictionaryCategory::query()
                ->where('dictionary_id', $dictionary->id)
                ->update(['parent_id' => null]);

            DictionaryWord::query()
                ->where('dictionary_id', $dictionary->id)
                ->delete();

            DictionaryCategory::query()
                ->where('dictionary_id', $dictionary->id)
                ->delete();

            $words = $this->importService->importTreeInto($dictionary, $data, $learnLang);

            $dictionary->update([
                'name' => trim((string) ($meta['name'] ?? $dictionary->name)),
                'lang' => trim((string) ($meta['lang'] ?? $dictionary->lang)),
                'learn_lang' => $learnLang,
                'level' => $level,
                'max_level' => $maxLevel,
                'sound' => $sound,
                'words' => $words,
            ]);

            return [
                'updated' => 0,
                'created' => $words,
                'deleted' => $deleted,
                'categories_synced' => DictionaryCategory::query()->where('dictionary_id', $dictionary->id)->count(),
                'words' => $words,
            ];
        });
    }

    /**
     * @param  array<string, mixed>  $meta
     * @return array<string, mixed>
     */
    private function mergeDictionaryMeta(Dictionary $dictionary, array $meta): array
    {
        return array_merge([
            'name' => $dictionary->name,
            'lang' => $dictionary->lang,
            'learn_lang' => $dictionary->learn_lang,
            'level' => $dictionary->level,
            'max_level' => $dictionary->max_level,
            'sound' => $dictionary->sound,
            'auto_levels' => $meta['auto_levels'] ?? false,
            'use_json_word_count' => true,
        ], $meta);
    }

    /**
     * @param  array<int, mixed>  $data
     */
    private function syncCategoryTree(Dictionary $dictionary, array $data): int
    {
        $synced = 0;
        $this->syncCategoryLevel($dictionary, $data, null, $synced);

        return $synced;
    }

    /**
     * @param  array<int, mixed>  $nodes
     */
    private function syncCategoryLevel(
        Dictionary $dictionary,
        array $nodes,
        ?int $parentId,
        int &$synced,
    ): void {
        $order = 0;
        foreach ($nodes as $item) {
            if (! is_array($item)) {
                continue;
            }
            if (! isset($item['category']) && ! isset($item['sub_category'])) {
                continue;
            }

            $name = (string) ($item['category'] ?? $item['sub_category']);
            $order++;

            $category = DictionaryCategory::query()
                ->where('dictionary_id', $dictionary->id)
                ->where('parent_id', $parentId)
                ->where('name', $name)
                ->first();

            if (! $category) {
                $category = DictionaryCategory::query()->create([
                    'dictionary_id' => $dictionary->id,
                    'name' => $name,
                    'parent_id' => $parentId,
                    'order' => $order,
                ]);
            } elseif ((int) $category->order !== $order) {
                $category->update(['order' => $order]);
            }

            $synced++;

            foreach (['sub_catgories', 'catgories'] as $key) {
                if (isset($item[$key]) && is_array($item[$key])) {
                    $this->syncCategoryLevel($dictionary, $item[$key], (int) $category->id, $synced);
                }
            }
        }
    }

    /**
     * @param  \Illuminate\Support\Collection<int, DictionaryCategory>  $categories
     * @return array<int, int> categoryId => l2OrL1Id
     */
    private function buildL2AnchorMap($categories): array
    {
        $byId = $categories->keyBy('id');
        $map = [];

        foreach ($categories as $cat) {
            $map[$cat->id] = $this->resolveL2AnchorId($cat, $byId);
        }

        return $map;
    }

    /**
     * @param  \Illuminate\Support\Collection<int, DictionaryCategory>  $byId
     */
    private function resolveL2AnchorId(DictionaryCategory $cat, $byId): int
    {
        $current = $cat;
        $guard = 0;
        while ($current->parent_id !== null && $guard++ < 50) {
            $parent = $byId->get($current->parent_id);
            if (! $parent) {
                break;
            }
            if ($parent->parent_id === null) {
                // current is L2
                return (int) $current->id;
            }
            $current = $parent;
        }

        // L1 or orphan
        return (int) $current->id;
    }

    /**
     * @param  \Illuminate\Support\Collection<int, DictionaryCategory>  $categories
     * @param  array<int, int>  $l2ByCategoryId
     * @return array<int, list<int>>
     */
    private function buildSubtreeMap($categories, array $l2ByCategoryId): array
    {
        $subtree = [];
        foreach ($categories as $cat) {
            $l2 = $l2ByCategoryId[$cat->id] ?? $cat->id;
            $subtree[$l2] ??= [];
            $subtree[$l2][] = (int) $cat->id;
        }

        return $subtree;
    }

    /**
     * @param  \Illuminate\Support\Collection<int, DictionaryCategory>  $categories
     * @param  array<int, int>  $l2ByCategoryId
     * @return array<string, DictionaryWord>
     */
    private function buildWordIndex(Dictionary $dictionary, $categories, array $l2ByCategoryId): array
    {
        $index = [];
        $words = DictionaryWord::query()
            ->where('dictionary_id', $dictionary->id)
            ->with('categories:id')
            ->orderBy('id')
            ->get();

        foreach ($words as $word) {
            $catIds = $word->categories->pluck('id')->all();
            if ($catIds === []) {
                continue;
            }
            foreach ($catIds as $catId) {
                $l2Id = $l2ByCategoryId[(int) $catId] ?? (int) $catId;
                $key = $this->wordKey($l2Id, (string) $word->word);
                if (isset($index[$key])) {
                    if ($index[$key]->id !== $word->id) {
                        Log::warning('Dictionary update: duplicate word under same L2', [
                            'dictionary_id' => $dictionary->id,
                            'word' => $word->word,
                            'l2_id' => $l2Id,
                            'kept_id' => $index[$key]->id,
                            'skipped_id' => $word->id,
                        ]);
                    }

                    continue;
                }
                $index[$key] = $word;
            }
        }

        return $index;
    }

    private function wordKey(int $l2Id, string $word): string
    {
        return $l2Id.'|'.mb_strtolower(trim($word));
    }

    /**
     * @param  array<int, mixed>  $nodes
     * @param  \Illuminate\Support\Collection<int, DictionaryCategory>  $categories
     * @param  callable(array, DictionaryCategory): void  $onWord
     */
    private function walkJsonWithCategories(
        array $nodes,
        ?int $parentId,
        Dictionary $dictionary,
        $categories,
        callable $onWord,
    ): void {
        foreach ($nodes as $item) {
            if (! is_array($item)) {
                continue;
            }

            if (isset($item['category']) || isset($item['sub_category'])) {
                $name = (string) ($item['category'] ?? $item['sub_category']);
                $category = DictionaryCategory::query()
                    ->where('dictionary_id', $dictionary->id)
                    ->where('parent_id', $parentId)
                    ->where('name', $name)
                    ->first();

                if (! $category) {
                    continue;
                }

                foreach (['sub_catgories', 'catgories'] as $key) {
                    if (isset($item[$key]) && is_array($item[$key])) {
                        $this->walkJsonWithCategories(
                            $item[$key],
                            (int) $category->id,
                            $dictionary,
                            $categories,
                            $onWord,
                        );
                    }
                }
                if (isset($item['words']) && is_array($item['words'])) {
                    foreach ($item['words'] as $wordItem) {
                        if (is_array($wordItem) && isset($wordItem['word'])) {
                            $onWord($wordItem, $category);
                        }
                    }
                }

                continue;
            }

            // слово без категории (не ожидается в нормальном JSON)
            if (isset($item['word']) && $parentId !== null) {
                $category = $categories->get($parentId);
                if ($category) {
                    $onWord($item, $category);
                }
            }
        }
    }

    /**
     * @param  array<int, true>  $seenWordIds
     */
    private function pruneMissingWords(Dictionary $dictionary, array $seenWordIds): int
    {
        $deleted = 0;
        $words = DictionaryWord::query()
            ->where('dictionary_id', $dictionary->id)
            ->get(['id']);

        foreach ($words as $word) {
            if (isset($seenWordIds[$word->id])) {
                continue;
            }
            $word->categories()->detach();
            $word->delete();
            $deleted++;
        }

        return $deleted;
    }

    /**
     * @param  array<int, mixed>  $data
     */
    private function pruneEmptyCategories(Dictionary $dictionary, array $data): void
    {
        $keepIds = $this->collectJsonCategoryIds($dictionary, $data);
        if ($keepIds === []) {
            return;
        }

        // Несколько проходов: сначала листья, потом родители
        for ($pass = 0; $pass < 20; $pass++) {
            $candidates = DictionaryCategory::query()
                ->where('dictionary_id', $dictionary->id)
                ->whereNotIn('id', array_keys($keepIds))
                ->orderByDesc('id')
                ->get();

            $removed = 0;
            foreach ($candidates as $cat) {
                $hasWords = $cat->words()->exists();
                $hasChildren = DictionaryCategory::query()->where('parent_id', $cat->id)->exists();
                if (! $hasWords && ! $hasChildren) {
                    $cat->delete();
                    $removed++;
                }
            }
            if ($removed === 0) {
                break;
            }
        }
    }

    /**
     * @param  array<int, mixed>  $data
     * @return array<int, true>
     */
    private function collectJsonCategoryIds(Dictionary $dictionary, array $data): array
    {
        $ids = [];
        $this->collectJsonCategoryIdsRecursive($dictionary, $data, null, $ids);

        return $ids;
    }

    /**
     * @param  array<int, mixed>  $nodes
     * @param  array<int, true>  $ids
     */
    private function collectJsonCategoryIdsRecursive(
        Dictionary $dictionary,
        array $nodes,
        ?int $parentId,
        array &$ids,
    ): void {
        foreach ($nodes as $item) {
            if (! is_array($item) || (! isset($item['category']) && ! isset($item['sub_category']))) {
                continue;
            }
            $name = (string) ($item['category'] ?? $item['sub_category']);
            $cat = DictionaryCategory::query()
                ->where('dictionary_id', $dictionary->id)
                ->where('parent_id', $parentId)
                ->where('name', $name)
                ->first();
            if (! $cat) {
                continue;
            }
            $ids[$cat->id] = true;
            foreach (['sub_catgories', 'catgories'] as $key) {
                if (isset($item[$key]) && is_array($item[$key])) {
                    $this->collectJsonCategoryIdsRecursive(
                        $dictionary,
                        $item[$key],
                        (int) $cat->id,
                        $ids,
                    );
                }
            }
        }
    }
}
