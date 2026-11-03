<?php

namespace App\Services;

use App\Models\Dictionary;
use App\Models\DictionaryCategory;
use App\Models\DictionaryWord;
use Illuminate\Support\Enumerable;

class DictionaryExportService
{
    /**
     * Дерево JSON как у WP export_to_json_tree / DictionaryImportService.
     *
     * @return list<array<string, mixed>>
     */
    public function exportToJsonTree(Dictionary $dictionary): array
    {
        $categories = DictionaryCategory::query()
            ->where('dictionary_id', $dictionary->id)
            ->orderByRaw('parent_id is null desc')
            ->orderBy('order')
            ->orderBy('id')
            ->get();

        /** @var array<int, Enumerable<int, DictionaryWord>> $wordsByCategory */
        $wordsByCategory = [];
        foreach ($categories as $cat) {
            $wordsByCategory[(int) $cat->id] = $cat->words()
                ->orderBy('dictionary_words.order')
                ->orderBy('dictionary_words.id')
                ->get();
        }

        $childrenMap = [];
        foreach ($categories as $cat) {
            $parentKey = $cat->parent_id ? (string) $cat->parent_id : 'root';
            $childrenMap[$parentKey][] = $cat;
        }

        $build = function (string $parentKey, bool $isRoot) use (&$build, $childrenMap, $wordsByCategory): array {
            $nodes = [];
            foreach ($childrenMap[$parentKey] ?? [] as $cat) {
                /** @var DictionaryCategory $cat */
                $childKey = (string) $cat->id;
                $childCategories = $build($childKey, false);
                $catWords = $wordsByCategory[$cat->id] ?? collect();

                $node = [];
                if ($isRoot) {
                    $node['category'] = $cat->name;
                } else {
                    $node['sub_category'] = $cat->name;
                }

                if ($childCategories !== []) {
                    $node['sub_catgories'] = $childCategories;
                }
                if ($catWords->isNotEmpty()) {
                    $node['words'] = $catWords->map(fn (DictionaryWord $w) => $this->wordToJson($w))->values()->all();
                }

                $nodes[] = $node;
            }

            return $nodes;
        };

        return $build('root', true);
    }

    /** @return array<string, mixed> */
    public function wordToJson(DictionaryWord $row): array
    {
        $translations = array_values(array_filter([
            $row->translation_1,
            $row->translation_2,
            $row->translation_3,
        ], static fn ($v) => $v !== null && $v !== ''));

        $translated = count($translations) <= 1
            ? ($translations[0] ?? '')
            : $translations;

        $item = [
            'word' => $row->word,
            'gender' => $row->gender,
            'translated' => $translated,
            'level' => (int) $row->level,
            'maxLevel' => (int) $row->max_level,
            'type' => $row->type,
        ];

        if (! empty($row->difficult_translation)) {
            $item['difficult_translation'] = $row->difficult_translation;
        }
        if (! empty($row->sound_url)) {
            $item['sound'] = $row->sound_url;
        }
        if ($row->is_phrase) {
            $item['is_phrase'] = 1;
        }

        return $item;
    }
}
