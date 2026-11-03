<?php

namespace App\Services;

use App\Models\Dictionary;
use App\Models\DictionaryWord;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/** A reviewed arrangement of existing records, not a vocabulary generator. */
class EnglishDictionaryCopy
{
    private const LEVELS = ['A1' => 1, 'A2' => 2, 'B1' => 3, 'B2' => 4, 'C1' => 5];

    public function identity(DictionaryWord $word): array
    {
        $content = Arr::except($word->getAttributes(), ['id', 'dictionary_id', 'created_at', 'updated_at']);
        ksort($content);
        $translations = $word->translations->sortBy('lang')->map(function ($translation) {
            $attributes = Arr::except($translation->getAttributes(), ['id', 'word_id', 'created_at', 'updated_at']);
            ksort($attributes);

            return $attributes;
        })->values()->all();

        return ['id' => (int) $word->id, 'word' => $word->word, 'type' => $word->type, 'level' => $word->level,
            'content_hash' => hash('sha256', json_encode([$content, $translations], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR))];
    }

    public function resources(): array
    {
        $load = static fn (string $name): array => json_decode(file_get_contents(resource_path('dictionaries/english-compact/'.$name)), true, 512, JSON_THROW_ON_ERROR);
        $groups = [];
        foreach (['groups-a1-a2.json', 'groups-b1-b2.json'] as $file) {
            foreach ($load($file)['levels'] as $level => $topics) {
                if (isset($groups[$level])) {
                    throw new InvalidArgumentException('Уровень повторяется в пакете: '.$level);
                }
                $groups[$level] = $topics;
            }
        }

        return [$load('taxonomy.json'), $groups, $load('source-identities.json')['words']];
    }

    /** Validate the whole plan before the first write. Empty future levels stay unpublished. */
    public function prepare(Dictionary $source, array $taxonomy, array $groups, array $identities): array
    {
        if (strtolower($source->learn_lang) !== 'en' || (int) ($taxonomy['version'] ?? 0) !== 1) {
            throw new InvalidArgumentException('Нужен английский словарь и пакет версии 1.');
        }
        if ((int) ($taxonomy['source_dictionary_id'] ?? 0) !== (int) $source->id) {
            throw new InvalidArgumentException('Пакет подготовлен для другого исходного словаря.');
        }
        $name = trim((string) ($taxonomy['name'] ?? ''));
        $limit = $taxonomy['max_words_per_leaf'] ?? null;
        if ($name === '' || mb_strlen($name) > 255 || ! is_int($limit) || $limit < 1 || $limit > 30) {
            throw new InvalidArgumentException('Неверное название или лимит конечной категории (не больше 30).');
        }
        $words = DictionaryWord::where('dictionary_id', $source->id)->with('translations')->orderBy('id')->get()->keyBy('id');
        if ($words->isEmpty()) {
            throw new InvalidArgumentException('Исходный словарь пуст.');
        }
        $expected = [];
        foreach ($identities as $identity) {
            $id = $identity['id'] ?? null;
            if (! is_int($id) || isset($expected[$id])) {
                throw new InvalidArgumentException('Повтор или неверный ID в исходном снимке.');
            }
            $word = $words->get($id);
            if (! $word || $word->word !== ($identity['word'] ?? null) || $word->type !== ($identity['type'] ?? null) || $word->level !== ($identity['level'] ?? null)
                || $this->identity($word)['content_hash'] !== ($identity['content_hash'] ?? null)) {
                throw new InvalidArgumentException('Исходное слово изменилось: '.$id.'. Сначала пересмотрите распределение.');
            }
            $expected[$id] = true;
        }
        if (count($expected) !== $words->count()) {
            throw new InvalidArgumentException('Состав исходного словаря изменился. Нельзя пропускать новые записи.');
        }

        $categories = $assignments = $counts = [];
        foreach ($taxonomy['levels'] as $level => $topics) {
            if (! isset(self::LEVELS[$level])) {
                throw new InvalidArgumentException('Неизвестный уровень: '.$level);
            }
            $levelWords = $words->where('level', self::LEVELS[$level]);
            if ($levelWords->isEmpty()) {
                if (! empty($groups[$level])) {
                    throw new InvalidArgumentException('Распределение содержит отсутствующий уровень: '.$level);
                }

                continue;
            }
            $categories[] = ['key' => $level, 'parent' => null, 'name' => $level, 'name_uk' => $level, 'order' => count($counts)];
            $knownTopics = [];
            foreach ($topics as $position => $topic) {
                $key = $topic['key'];
                if (isset($knownTopics[$key])) {
                    throw new InvalidArgumentException('Повтор ключа темы: '.$level.'/'.$key);
                }
                $knownTopics[$key] = true;
                $sections = $groups[$level][$key] ?? [];
                $topicKey = $level.'/'.$key;
                $categories[] = ['key' => $topicKey, 'parent' => $level, 'name' => $topic['name'], 'name_uk' => $topic['name_uk'] ?? $topic['name'], 'order' => $position];
                $total = array_sum(array_map(fn ($section) => count($section['word_ids'] ?? []), $sections));
                $seenNames = [];
                foreach ($sections as $index => $section) {
                    $sectionName = trim((string) ($section['name'] ?? ''));
                    $ids = $section['word_ids'] ?? [];
                    if ($sectionName === '' || mb_strlen($sectionName) > 255 || isset($seenNames[mb_strtolower($sectionName)]) || ! is_array($ids) || ! $ids || count($ids) > $limit) {
                        throw new InvalidArgumentException('Неверная или слишком большая подкатегория: '.$topicKey.' / '.$sectionName);
                    }
                    $seenNames[mb_strtolower($sectionName)] = true;
                    $destination = $topicKey;
                    // Small topics do not need an unnecessary third level.
                    if ($total > $limit) {
                        $destination .= '/'.$index;
                        $categories[] = ['key' => $destination, 'parent' => $topicKey, 'name' => $sectionName, 'name_uk' => $section['name_uk'] ?? $sectionName, 'order' => $index];
                    }
                    foreach ($ids as $id) {
                        $word = is_int($id) ? $words->get($id) : null;
                        if (! $word || isset($assignments[$id]) || $word->level !== self::LEVELS[$level]) {
                            throw new InvalidArgumentException('Повтор, чужое слово или неверный уровень: '.(string) $id);
                        }
                        $assignments[$id] = $destination;
                    }
                }
                $counts[$level][$topic['name']] = $total;
            }
            if (array_diff(array_keys($groups[$level] ?? []), array_keys($knownTopics))) {
                throw new InvalidArgumentException('Распределение содержит неизвестную тему в '.$level);
            }
        }
        if (array_diff(array_keys($groups), array_keys($taxonomy['levels'])) || count($assignments) !== $words->count()) {
            throw new InvalidArgumentException('Не все исходные слова распределены ровно один раз.');
        }
        if (max(array_count_values($assignments)) > $limit) {
            throw new InvalidArgumentException('Превышен предел слов в конечной категории.');
        }

        return compact('name', 'limit', 'words', 'categories', 'assignments', 'counts');
    }

    /** All-or-nothing independent copy. Existing dictionaries are never updated. */
    public function create(Dictionary $source, array $taxonomy, array $groups, array $identities): Dictionary
    {
        return DB::transaction(function () use ($source, $taxonomy, $groups, $identities) {
            $source = Dictionary::whereKey($source->id)->lockForUpdate()->firstOrFail();
            $plan = $this->prepare($source, $taxonomy, $groups, $identities);
            if (Dictionary::where('name', $plan['name'])->exists()) {
                throw new InvalidArgumentException('Словарь с этим названием уже существует. Повторная копия не создана.');
            }
            $now = now();
            $attributes = Arr::except($source->getAttributes(), ['id', 'created_at', 'updated_at']);
            $targetId = DB::table('dictionaries')->insertGetId(array_merge($attributes, ['name' => $plan['name'], 'words' => $plan['words']->count(), 'created_at' => $now, 'updated_at' => $now]));
            $categoryIds = $categoryTranslations = [];
            foreach ($plan['categories'] as $category) {
                $id = DB::table('dictionary_categories')->insertGetId(['dictionary_id' => $targetId, 'parent_id' => $category['parent'] ? $categoryIds[$category['parent']] : null, 'name' => $category['name'], 'order' => $category['order'], 'created_at' => $now, 'updated_at' => $now]);
                $categoryIds[$category['key']] = $id;
                foreach (['ru' => $category['name'], 'uk' => $category['name_uk']] as $lang => $name) {
                    $categoryTranslations[] = ['category_id' => $id, 'lang' => $lang, 'name' => $name, 'created_at' => $now, 'updated_at' => $now];
                }
            }
            foreach (array_chunk($categoryTranslations, 250) as $chunk) {
                DB::table('dictionary_category_translations')->insert($chunk);
            }
            $translations = $links = [];
            foreach ($plan['words'] as $word) {
                $attributes = Arr::except($word->getAttributes(), ['id', 'dictionary_id', 'created_at', 'updated_at']);
                $id = DB::table('dictionary_words')->insertGetId(array_merge($attributes, ['dictionary_id' => $targetId, 'created_at' => $now, 'updated_at' => $now]));
                $links[] = ['word_id' => $id, 'category_id' => $categoryIds[$plan['assignments'][$word->id]]];
                foreach ($word->translations as $translation) {
                    $translations[] = array_merge(Arr::except($translation->getAttributes(), ['id', 'word_id', 'created_at', 'updated_at']), ['word_id' => $id, 'created_at' => $now, 'updated_at' => $now]);
                }
            }
            foreach (array_chunk($translations, 250) as $chunk) {
                DB::table('dictionary_word_translations')->insert($chunk);
            }
            foreach (array_chunk($links, 500) as $chunk) {
                DB::table('dictionary_word_category')->insert($chunk);
            }

            return Dictionary::findOrFail($targetId);
        });
    }
}
