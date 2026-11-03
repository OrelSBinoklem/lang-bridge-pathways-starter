<?php

namespace App\Services;

use App\Models\Dictionary;
use App\Models\DictionaryCategory;
use App\Models\DictionaryWord;
use App\Models\UniqueWord;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class DictionaryImportService
{
    /**
     * @param  array<int, mixed>|string  $data
     * @param  array<string, mixed>  $meta
     */
    public function importFromJson(array|string $data, array $meta): Dictionary
    {
        $data = $this->decodeJson($data);

        if ($data === []) {
            throw new InvalidArgumentException('JSON должен быть непустым массивом');
        }

        $name = trim((string) ($meta['name'] ?? ''));
        $lang = trim((string) ($meta['lang'] ?? ''));
        $learnLang = trim((string) ($meta['learn_lang'] ?? ''));

        if ($name === '' || $lang === '' || $learnLang === '') {
            throw new InvalidArgumentException('Заполните название, lang и learn_lang');
        }

        $computed = $this->computeLevelRange($data);
        if ($computed['count'] === 0) {
            throw new InvalidArgumentException('В JSON не найдено слов');
        }

        [$level, $maxLevel, $sound, $wordCount] = $this->resolveMetaLevels($meta, $computed);

        return DB::transaction(function () use ($data, $name, $lang, $learnLang, $wordCount, $level, $maxLevel, $sound) {
            $dictionary = Dictionary::query()->create([
                'name' => $name,
                'lang' => $lang,
                'learn_lang' => $learnLang,
                'words' => $wordCount,
                'level' => $level,
                'max_level' => $maxLevel,
                'sound' => $sound,
            ]);

            $this->importTreeInto($dictionary, $data, $learnLang);

            $dictionary->update([
                'words' => $dictionary->dictionaryWords()->count(),
            ]);

            return $dictionary->fresh();
        });
    }

    /**
     * Импорт дерева категорий/слов в уже существующий словарь (без создания Dictionary).
     *
     * @param  array<int, mixed>  $data
     */
    public function importTreeInto(Dictionary $dictionary, array $data, ?string $learnLang = null): int
    {
        $learnLang = $learnLang ?? (string) $dictionary->learn_lang;
        $this->addWordsRecursion($data, $dictionary, null, $learnLang, 0);

        return $dictionary->dictionaryWords()->count();
    }

    /**
     * @param  array<int, mixed>|string  $data
     * @return array<int, mixed>
     */
    public function decodeJson(array|string $data): array
    {
        if (is_string($data)) {
            $decoded = json_decode($data, true);
            if (! is_array($decoded)) {
                throw new InvalidArgumentException('Некорректный JSON');
            }

            return $decoded;
        }

        return $data;
    }

    /**
     * @param  array<string, mixed>  $meta
     * @param  array{count: int, min: int, max: int}  $computed
     * @return array{0: int, 1: int, 2: bool, 3: int}
     */
    public function resolveMetaLevels(array $meta, array $computed): array
    {
        $level = max(1, (int) ($meta['level'] ?? 1));
        $maxLevel = max($level, (int) ($meta['max_level'] ?? $meta['maxLevel'] ?? 1));
        $sound = ! empty($meta['sound']);

        if (! empty($meta['auto_levels'])) {
            if ($computed['min'] < 99) {
                $level = $computed['min'];
            }
            if ($computed['max'] > 0) {
                $maxLevel = $computed['max'];
            }
        }

        $wordCount = ! empty($meta['use_json_word_count'])
            ? $computed['count']
            : (int) ($meta['words'] ?? $computed['count']);

        return [$level, $maxLevel, $sound, $wordCount];
    }

    /**
     * @param  array<int, mixed>  $data
     * @return array{count: int, min: int, max: int}
     */
    public function computeLevelRange(array $data): array
    {
        $count = 0;
        $min = 99;
        $max = 0;

        $this->walkJsonTree($data, function (array $item) use (&$count, &$min, &$max) {
            if (! isset($item['word'])) {
                return;
            }
            $count++;
            if (isset($item['level'])) {
                $min = min($min, (int) $item['level']);
            }
            if (isset($item['maxLevel']) || isset($item['max_level'])) {
                $max = max($max, (int) ($item['maxLevel'] ?? $item['max_level']));
            }
        });

        return ['count' => $count, 'min' => $min, 'max' => $max];
    }

    /**
     * @param  array<string, mixed>  $item
     * @return array<string, mixed>
     */
    public function wordAttributesFromJson(array $item, string $learnLang, int $order): array
    {
        $translated = $item['translated'] ?? $item['translation_1'] ?? '';
        $t1 = is_array($translated) ? ($translated[0] ?? '') : $translated;
        $t2 = is_array($translated) ? ($translated[1] ?? null) : ($item['translation_2'] ?? null);
        $t3 = is_array($translated) ? ($translated[2] ?? null) : ($item['translation_3'] ?? null);

        return [
            'word' => (string) $item['word'],
            'learn_lang' => $learnLang,
            'is_phrase' => count(preg_split('/[\s,]+/', (string) $item['word']) ?: []) > 1,
            'translation_1' => (string) $t1,
            'translation_2' => $t2,
            'translation_3' => $t3,
            'difficult_translation' => $item['difficult_translation'] ?? null,
            'sound_url' => $item['sound'] ?? $item['sound_url'] ?? null,
            'level' => isset($item['level']) ? (int) $item['level'] : null,
            'max_level' => (int) ($item['maxLevel'] ?? $item['max_level'] ?? 1),
            'type' => $item['type'] ?? null,
            'gender' => $item['gender'] ?? null,
            'order' => $order,
        ];
    }

    /**
     * @param  array<int, mixed>  $data
     * @param  callable(array): void  $onWord
     */
    public function walkJsonTree(array $data, callable $onWord): void
    {
        foreach ($data as $item) {
            if (! is_array($item)) {
                continue;
            }
            if (isset($item['category']) || isset($item['sub_category'])) {
                foreach (['sub_catgories', 'catgories', 'words'] as $key) {
                    if (isset($item[$key]) && is_array($item[$key])) {
                        $this->walkJsonTree($item[$key], $onWord);
                    }
                }

                continue;
            }
            if (isset($item['word'])) {
                $onWord($item);
            }
        }
    }

    /**
     * @param  array<int, mixed>  $data
     */
    private function addWordsRecursion(
        array $data,
        Dictionary $dictionary,
        ?int $parentCategoryId,
        string $learnLang,
        int $orderStart = 0,
    ): int {
        $indexWord = $orderStart;

        foreach ($data as $item) {
            if (! is_array($item)) {
                continue;
            }

            $isCategory = isset($item['category']) || isset($item['sub_category']);

            if ($isCategory) {
                $category = DictionaryCategory::query()->create([
                    'dictionary_id' => $dictionary->id,
                    'name' => $item['category'] ?? $item['sub_category'],
                    'parent_id' => $parentCategoryId,
                    'order' => 0,
                ]);

                foreach (['sub_catgories', 'catgories'] as $key) {
                    if (isset($item[$key]) && is_array($item[$key])) {
                        $indexWord = $this->addWordsRecursion(
                            $item[$key],
                            $dictionary,
                            (int) $category->id,
                            $learnLang,
                            $indexWord,
                        );
                    }
                }
                if (isset($item['words']) && is_array($item['words'])) {
                    $indexWord = $this->addWordsRecursion(
                        $item['words'],
                        $dictionary,
                        (int) $category->id,
                        $learnLang,
                        $indexWord,
                    );
                }

                continue;
            }

            if (! isset($item['word'])) {
                continue;
            }

            $indexWord++;
            $attrs = $this->wordAttributesFromJson($item, $learnLang, $indexWord);
            $word = DictionaryWord::query()->create([
                'dictionary_id' => $dictionary->id,
                ...$attrs,
            ]);

            if ($parentCategoryId !== null) {
                $word->categories()->attach($parentCategoryId);
            }

            UniqueWord::query()->firstOrCreate([
                'word' => $item['word'],
                'lang' => $learnLang,
            ]);
        }

        return $indexWord;
    }
}
