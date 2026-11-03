<?php

namespace App\Services;

use App\Models\Dictionary;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/** Independent English adaptation of the supplemental dictionary, never an update/import into an existing one. */
class EnglishSupplementDictionary
{
    private const CORE_TYPES = [
        'pronouns' => ['pronoun', 'determiner'], 'prepositions' => ['preposition'], 'quantity' => ['determiner'],
        'numbers' => ['number'], 'linking' => ['adverb'], 'basic-links' => ['conjunction'],
        'articles-group' => ['determiner'], 'function-particles' => ['infinitive-to', 'adverb'], 'interjections' => ['interjection'],
        'question-words' => ['pronoun', 'adverb', 'determiner', 'phrase'],
    ];

    public function load(): array
    {
        return $this->validate(json_decode(file_get_contents(resource_path('dictionaries/english-supplement/package.json')), true, flags: JSON_THROW_ON_ERROR));
    }

    public function validate(array $package): array
    {
        if (($package['version'] ?? null) !== 1 || ($package['max_words_per_leaf'] ?? null) !== 30
            || ! is_string($package['name'] ?? null) || trim($package['name']) === '' || mb_strlen($package['name']) > 255
            || empty($package['categories']) || empty($package['words'])) {
            throw new InvalidArgumentException('Неверный пакет дополнительного английского словаря.');
        }
        $categories = $depths = $parents = $counts = [];
        foreach ($package['categories'] as $category) {
            $key = $category['key'] ?? '';
            $parent = $category['parent'] ?? null;
            if (! is_string($key) || ! preg_match('/^[a-z][a-z0-9-]{0,79}$/', $key) || isset($categories[$key])
                || ($parent !== null && ! isset($categories[$parent]))) {
                throw new InvalidArgumentException('Повтор или неверный порядок категорий.');
            }
            foreach (['name', 'name_uk'] as $field) {
                if (! is_string($category[$field] ?? null) || trim($category[$field]) === '' || mb_strlen($category[$field]) > 255) {
                    throw new InvalidArgumentException('У категории нужны русское и украинское названия.');
                }
            }
            $depths[$key] = $parent === null ? 1 : $depths[$parent] + 1;
            if ($depths[$key] > 3) {
                throw new InvalidArgumentException('Допускается не больше трёх уровней категорий.');
            }
            $categories[$key] = $category;
            if ($parent !== null) {
                $parents[$parent] = true;
            }
        }
        $keys = $identities = [];
        $coreGroups = array_keys(array_filter($categories, fn ($category) => $category['parent'] === 'core'));
        $requiredGroups = array_diff(array_keys(self::CORE_TYPES), ['articles-group', 'question-words']);
        if (array_diff($coreGroups, array_keys(self::CORE_TYPES)) || array_diff($requiredGroups, $coreGroups)) {
            throw new InvalidArgumentException('На втором уровне важных слов допускаются только заданные части речи.');
        }
        foreach ($coreGroups as $key) {
            if (! isset($parents[$key]) || $depths[$key] !== 2) {
                throw new InvalidArgumentException('Смысловые подборки важных слов должны быть на третьем уровне.');
            }
        }
        foreach ($package['words'] as $word) {
            foreach (['key', 'word', 'type', 'ru', 'uk'] as $field) {
                if (! is_string($word[$field] ?? null) || trim($word[$field]) === '' || mb_strlen($word[$field]) > 255) {
                    throw new InvalidArgumentException('У слова отсутствует обязательное поле или перевод.');
                }
            }
            $identity = mb_strtolower(trim($word['word'])).'::'.$word['type'];
            if (isset($keys[$word['key']]) || isset($identities[$identity]) || ! is_int($word['level'] ?? null)
                || $word['level'] < 1 || $word['level'] > 4 || mb_strlen($word['type']) > 50
                || ! is_array($word['categories'] ?? null) || ! $word['categories']
                || count($word['categories']) !== count(array_unique($word['categories']))) {
                throw new InvalidArgumentException('Повтор слова, неверный уровень или связи категорий.');
            }
            foreach (['info', 'info_uk'] as $field) {
                if (! is_string($word[$field] ?? null) || mb_strlen($word[$field]) > 2000) {
                    throw new InvalidArgumentException('Неверная подсказка слова.');
                }
            }
            if (($word['sound_url'] ?? null) !== null && (! is_string($word['sound_url']) || ! preg_match('~^(?:https://|/[^/])~', $word['sound_url']))) {
                throw new InvalidArgumentException('Неверная ссылка озвучки.');
            }
            $keys[$word['key']] = $identities[$identity] = true;
            foreach ($word['categories'] as $category) {
                if (! isset($categories[$category]) || isset($parents[$category])) {
                    throw new InvalidArgumentException('Слово должно быть привязано к конечной категории.');
                }
                $group = $category;
                while ($categories[$group]['parent'] !== null && $categories[$group]['parent'] !== 'core') {
                    $group = $categories[$group]['parent'];
                }
                if ($categories[$group]['parent'] === 'core'
                    && ($depths[$category] !== 3 || ! in_array($word['type'], self::CORE_TYPES[$group], true))) {
                    throw new InvalidArgumentException('Часть речи слова не совпадает с его подборкой важных слов.');
                }
                $counts[$category] = ($counts[$category] ?? 0) + 1;
                if ($counts[$category] > 30) {
                    throw new InvalidArgumentException('В конечной категории больше 30 слов.');
                }
            }
            if (isset($categories['articles-group'])) {
                $groups = array_map(fn ($key) => $categories[$key]['parent'], $word['categories']);
                if (in_array('quantity', $groups, true) && count(array_diff($groups, ['quantity'])) === 0) {
                    throw new InvalidArgumentException('Дополнительные определители должны повторять слова основных категорий.');
                }
                if (in_array('articles-group', $groups, true) && ! in_array($word['word'], ['a', 'an', 'the'], true)) {
                    throw new InvalidArgumentException('В артиклях допускаются только a, an, the.');
                }
            }
        }
        if (isset($categories['articles-group']) && end($coreGroups) !== 'quantity') {
            throw new InvalidArgumentException('Дополнительные определители должны быть последней категорией важных слов.');
        }
        foreach (array_diff_key($categories, $parents) as $key => $_) {
            if (! isset($counts[$key])) {
                throw new InvalidArgumentException('Пустая конечная категория.');
            }
        }

        return $package;
    }

    private function translation(string $text, string $info): array
    {
        $parts = array_map('trim', explode(';', $text));

        return ['translation_1' => $parts[0], 'translation_2' => $parts[1] ?? null, 'translation_3' => $parts[2] ?? null,
            'translation_input_variable' => count($parts) > 3 ? implode(';', array_slice($parts, 3)) : null, 'info' => $info ?: null];
    }

    public function create(array $package): Dictionary
    {
        $package = $this->validate($package);

        return DB::transaction(function () use ($package) {
            if (Dictionary::where('name', $package['name'])->lockForUpdate()->exists()) {
                throw new InvalidArgumentException('Этот словарь уже существует. Существующие записи не заменены.');
            }
            $now = now();
            $dictionary = Dictionary::create(['name' => $package['name'], 'lang' => 'RU', 'learn_lang' => 'EN',
                'words' => count($package['words']), 'level' => min(array_column($package['words'], 'level')),
                'max_level' => max(array_column($package['words'], 'level')),
                'sound' => count(array_filter($package['words'], fn ($word) => ! empty($word['sound_url']))) === count($package['words']),
                'translation_languages' => ['ru', 'uk']]);
            $categoryIds = $translations = $links = [];
            foreach ($package['categories'] as $order => $category) {
                $id = DB::table('dictionary_categories')->insertGetId(['dictionary_id' => $dictionary->id,
                    'parent_id' => $category['parent'] === null ? null : $categoryIds[$category['parent']],
                    'name' => $category['name'], 'order' => $order, 'created_at' => $now, 'updated_at' => $now]);
                $categoryIds[$category['key']] = $id;
                foreach (['ru' => $category['name'], 'uk' => $category['name_uk']] as $lang => $name) {
                    $translations[] = ['category_id' => $id, 'lang' => $lang, 'name' => $name, 'created_at' => $now, 'updated_at' => $now];
                }
            }
            DB::table('dictionary_category_translations')->insert($translations);
            $translations = [];
            foreach ($package['words'] as $order => $word) {
                $ru = $this->translation($word['ru'], $word['info']);
                $id = DB::table('dictionary_words')->insertGetId(['dictionary_id' => $dictionary->id, 'word' => $word['word'], 'learn_lang' => 'EN',
                    'is_phrase' => str_contains($word['word'], ' '), 'type' => $word['type'], 'level' => $word['level'], 'max_level' => $word['level'],
                    'sound_url' => $word['sound_url'] ?? null, 'order' => $order, ...$ru, 'created_at' => $now, 'updated_at' => $now]);
                foreach (['ru' => $ru, 'uk' => $this->translation($word['uk'], $word['info_uk'])] as $lang => $attributes) {
                    $translations[] = ['word_id' => $id, 'lang' => $lang, ...$attributes, 'created_at' => $now, 'updated_at' => $now];
                }
                foreach ($word['categories'] as $category) {
                    $links[] = ['word_id' => $id, 'category_id' => $categoryIds[$category]];
                }
            }
            foreach (array_chunk($translations, 200) as $chunk) {
                DB::table('dictionary_word_translations')->insert($chunk);
            }
            foreach (array_chunk($links, 300) as $chunk) {
                DB::table('dictionary_word_category')->insert($chunk);
            }

            return $dictionary;
        });
    }
}
