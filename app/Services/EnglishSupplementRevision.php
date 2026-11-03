<?php

namespace App\Services;

use App\Models\Dictionary;
use App\Models\DictionaryCategory;
use App\Models\DictionaryWord;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/** Reviewed additive revisions: keep existing word/category IDs and private progress. */
class EnglishSupplementRevision
{
    public static function packageHash(array $package): string
    {
        return hash('sha256', json_encode($package, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
    }

    public static function categoryHash(array $category): string
    {
        unset($category['created_at'], $category['updated_at']);
        foreach ($category['translations'] as &$translation) {
            unset($translation['created_at'], $translation['updated_at']);
            ksort($translation);
        }
        unset($translation);
        usort($category['translations'], fn ($a, $b) => $a['lang'] <=> $b['lang']);
        ksort($category);

        return hash('sha256', json_encode($category, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
    }

    public function prepare(Dictionary $dictionary, array $revision, array $package): array
    {
        app(EnglishSupplementDictionary::class)->validate($package);
        if (($revision['version'] ?? null) !== 1 || $dictionary->id !== ($revision['dictionary_id'] ?? null)
            || strtolower($dictionary->learn_lang) !== 'en' || $dictionary->name !== $package['name']
            || ($revision['package_hash'] ?? null) !== self::packageHash($package)
            || empty($revision['base_words']) || empty($revision['base_categories'])) {
            throw new InvalidArgumentException('Неверный словарь или неподтверждённая редакция пакета.');
        }
        $words = $dictionary->dictionaryWords()->with(['translations', 'categories'])->get()->keyBy('id');
        $categories = DictionaryCategory::where('dictionary_id', $dictionary->id)->with('translations')->get()->keyBy('id');
        $baseWords = collect($revision['base_words']);
        $baseCategories = collect($revision['base_categories']);
        if ($baseWords->pluck('id')->unique()->count() !== $baseWords->count()
            || $baseCategories->pluck('id')->unique()->count() !== $baseCategories->count()
            || $baseWords->pluck('key')->unique()->count() !== $baseWords->count()
            || $baseCategories->pluck('key')->unique()->count() !== $baseCategories->count()) {
            throw new InvalidArgumentException('Повтор ID или ключа в редакции.');
        }
        $pending = $words->count() === $baseWords->count() && $categories->count() === $baseCategories->count();
        $applied = $words->count() === count($package['words']) && $categories->count() === count($package['categories']);
        // Content-only revisions have identical counts: identify their state by all hashes.
        if ($pending && $applied) {
            $matches = function (string $field) use ($baseWords, $baseCategories, $words, $categories): bool {
                foreach ($baseCategories as $base) {
                    $row = $categories->get($base['id']);
                    if (! $row || self::categoryHash($row->toArray()) !== $base[$field]) {
                        return false;
                    }
                }
                foreach ($baseWords as $base) {
                    $row = $words->get($base['id']);
                    if (! $row || EnglishDictionaryAudio::fingerprint($row->attributesToArray() + ['translations' => $row->translations->toArray()]) !== $base[$field]) {
                        return false;
                    }
                }

                return true;
            };
            $pending = $matches('before_hash');
            $applied = $matches('after_hash');
        }
        if (! $pending && ! $applied) {
            throw new InvalidArgumentException('Состав словаря изменился. Частичные импорты не заменяются.');
        }
        $identity = fn ($word) => mb_strtolower(trim($word['word'])).'::'.$word['type'];
        $desiredWords = collect($package['words'])->keyBy('key');
        $categoryIds = $baseCategories->pluck('id', 'key')->all();
        foreach ($baseCategories as $base) {
            $category = $categories->get($base['id']);
            if (! $category || self::categoryHash($category->toArray()) !== $base[$applied && ! $pending ? 'after_hash' : 'before_hash']) {
                throw new InvalidArgumentException('Категория изменена администратором: '.$base['key']);
            }
        }
        if ($applied && ! $pending) {
            foreach ($package['categories'] as $category) {
                if (isset($categoryIds[$category['key']])) {
                    continue;
                }
                $parent = $category['parent'] === null ? null : ($categoryIds[$category['parent']] ?? -1);
                $matches = $categories->filter(fn ($row) => $row->parent_id === $parent && $row->name === $category['name']);
                $match = $matches->count() === 1 ? $matches->first() : null;
                if (! $match || $match->translations->firstWhere('lang', 'uk')?->name !== $category['name_uk']) {
                    throw new InvalidArgumentException('Добавленная категория изменилась.');
                }
                $categoryIds[$category['key']] = $match->id;
            }
        }
        foreach ($baseWords as $base) {
            $word = $words->get($base['id']);
            if (! $word || ! isset($desiredWords[$base['key']]) || $identity($word->getAttributes()) !== $identity($desiredWords[$base['key']])
                || EnglishDictionaryAudio::fingerprint($word->attributesToArray() + ['translations' => $word->translations->toArray()]) !== $base[$applied && ! $pending ? 'after_hash' : 'before_hash']
                || $word->sound_url !== $base['sound_url']) {
                throw new InvalidArgumentException('Слово, перевод или озвучка изменены: '.$base['key']);
            }
            $actual = $word->categories->pluck('id')->sort()->values()->all();
            $expected = $applied && ! $pending
                ? array_map(fn ($key) => $categoryIds[$key], $desiredWords[$base['key']]['categories']) : $base['category_ids'];
            sort($expected);
            if ($actual !== $expected) {
                throw new InvalidArgumentException('Связи слова изменились: '.$base['key']);
            }
        }
        if ($applied && ! $pending) {
            $baseIds = $baseWords->pluck('id')->all();
            $new = $words->reject(fn ($word) => in_array($word->id, $baseIds, true))->keyBy(fn ($word) => $identity($word->getAttributes()));
            foreach ($package['words'] as $order => $desired) {
                if ($baseWords->contains('key', $desired['key'])) {
                    continue;
                }
                $word = $new->get($identity($desired));
                if (! $word) {
                    throw new InvalidArgumentException('Добавленное слово не найдено.');
                }
                foreach ($this->attributes($desired, $dictionary->id, $order) as $field => $value) {
                    if ($value !== $word->$field) {
                        throw new InvalidArgumentException('Добавленное слово изменилось: '.$desired['key']);
                    }
                }
                foreach (['ru' => 'info', 'uk' => 'info_uk'] as $lang => $hint) {
                    $translation = $word->translations->firstWhere('lang', $lang);
                    foreach ($this->translation($desired[$lang], $desired[$hint]) as $field => $value) {
                        if (! $translation || $value !== $translation->$field) {
                            throw new InvalidArgumentException('Добавленный перевод изменился.');
                        }
                    }
                }
                $expected = array_map(fn ($key) => $categoryIds[$key], $desired['categories']);
                sort($expected);
                if ($word->categories->pluck('id')->sort()->values()->all() !== $expected) {
                    throw new InvalidArgumentException('Связи добавленного слова изменились.');
                }
            }
        }

        return ['dictionary_id' => $dictionary->id, 'already_applied' => $applied && ! $pending,
            'words_before' => $baseWords->count(), 'words_after' => count($package['words']),
            'words_added' => count($package['words']) - $baseWords->count(),
            'categories_added' => count($package['categories']) - $baseCategories->count(),
            'hints_changed' => $baseWords->filter(fn ($row) => $row['before_hash'] !== $row['after_hash'])->count()];
    }

    public function apply(Dictionary $dictionary, array $revision, array $package): array
    {
        return DB::transaction(function () use ($dictionary, $revision, $package) {
            DB::table('dictionaries')->where('id', $dictionary->id)->lockForUpdate()->get(['id']);
            $ids = array_column($revision['base_words'], 'id');
            DB::table('dictionary_words')->where('dictionary_id', $dictionary->id)->lockForUpdate()->get(['id']);
            DB::table('dictionary_word_translations')->whereIn('word_id', $ids)->lockForUpdate()->get(['id']);
            DB::table('dictionary_categories')->where('dictionary_id', $dictionary->id)->lockForUpdate()->get(['id']);
            DB::table('dictionary_category_translations')->whereIn('category_id', array_column($revision['base_categories'], 'id'))->lockForUpdate()->get(['id']);
            $result = $this->prepare($dictionary, $revision, $package);
            if ($result['already_applied']) {
                return $result;
            }
            $categoryIds = array_column($revision['base_categories'], 'id', 'key');
            foreach ($package['categories'] as $order => $category) {
                $attributes = ['name' => $category['name'], 'parent_id' => $category['parent'] === null ? null : $categoryIds[$category['parent']]];
                if ($revision['update_category_order'] ?? false) {
                    $attributes['order'] = $order;
                }
                if (isset($categoryIds[$category['key']])) {
                    $row = DictionaryCategory::findOrFail($categoryIds[$category['key']]);
                    $row->fill($attributes)->save();
                } else {
                    $row = DictionaryCategory::create(['dictionary_id' => $dictionary->id, 'order' => $order, ...$attributes]);
                    $categoryIds[$category['key']] = $row->id;
                }
                foreach (['ru' => $category['name'], 'uk' => $category['name_uk']] as $lang => $name) {
                    $row->translations()->updateOrCreate(['lang' => $lang], ['name' => $name]);
                }
            }
            $base = array_column($revision['base_words'], null, 'key');
            foreach ($package['words'] as $order => $desired) {
                if (isset($base[$desired['key']])) {
                    $word = DictionaryWord::findOrFail($base[$desired['key']]['id']);
                    if ($base[$desired['key']]['before_hash'] !== $base[$desired['key']]['after_hash']) {
                        $word->fill(['info' => $desired['info'] ?: null])->save();
                        foreach (['ru' => 'info', 'uk' => 'info_uk'] as $lang => $field) {
                            $word->translations()->where('lang', $lang)->update(['info' => $desired[$field] ?: null]);
                        }
                    }
                } else {
                    $word = DictionaryWord::create($this->attributes($desired, $dictionary->id, $order));
                    foreach (['ru' => 'info', 'uk' => 'info_uk'] as $lang => $field) {
                        $word->translations()->create(['lang' => $lang, ...$this->translation($desired[$lang], $desired[$field])]);
                    }
                }
                $word->categories()->sync(array_map(fn ($key) => $categoryIds[$key], $desired['categories']));
            }
            $dictionary->update(['words' => count($package['words']), 'sound' => collect($package['words'])->every(fn ($word) => ! empty($word['sound_url']))]);
            $verified = $this->prepare($dictionary, $revision, $package);
            if (! $verified['already_applied']) {
                throw new InvalidArgumentException('Проверка редакции после записи не прошла.');
            }
            DB::afterCommit(fn () => DictionaryCache::invalidate());

            return $result;
        });
    }

    private function translation(string $text, string $info): array
    {
        $parts = array_map('trim', explode(';', $text));

        return ['translation_1' => $parts[0], 'translation_2' => $parts[1] ?? null, 'translation_3' => $parts[2] ?? null,
            'translation_input_variable' => count($parts) > 3 ? implode(';', array_slice($parts, 3)) : null, 'info' => $info ?: null];
    }

    private function attributes(array $word, int $dictionaryId, int $order): array
    {
        return ['dictionary_id' => $dictionaryId, 'word' => $word['word'], 'learn_lang' => 'EN',
            'is_phrase' => str_contains($word['word'], ' '), 'type' => $word['type'], 'level' => $word['level'], 'max_level' => $word['level'],
            'sound_url' => $word['sound_url'] ?? null, 'order' => $order, ...$this->translation($word['ru'], $word['info'])];
    }
}
