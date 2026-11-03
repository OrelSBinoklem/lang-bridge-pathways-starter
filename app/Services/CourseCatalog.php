<?php

namespace App\Services;

use App\Models\DictionaryCategory;

class CourseCatalog
{
    public static function grammar(): array
    {
        $tables = json_decode(file_get_contents(resource_path('course/grammar-tables.json')), true, 512, JSON_THROW_ON_ERROR);
        return array_merge($tables, self::englishGrammar());
    }

    public static function englishGrammar(): array
    {
        $tables = [];
        foreach (['a1', 'a2', 'b1', 'b2', 'forms', 'extensions'] as $file) {
            foreach (json_decode(file_get_contents(resource_path('english-grammar/'.$file.'.json')), true, 512, JSON_THROW_ON_ERROR) as $table) {
                $tables[] = ['id' => $table['id'], 'title' => $table['title'], 'level' => strtoupper($table['level']),
                    'learn_lang' => 'en', 'src' => null,
                    'href' => '/grammar/english?level='.$table['level'].'#'.$table['id']];
            }
        }
        return $tables;
    }

    public static function grammarOptions(): array
    {
        return collect(self::grammar())->mapWithKeys(fn ($item) => [$item['id'] => $item['title']])->all();
    }

    public static function categoryOptions(int $dictionaryId): array
    {
        $categories = DictionaryCategory::where('dictionary_id', $dictionaryId)->orderBy('order')->get()->keyBy('id');
        $result = [];
        foreach ($categories as $category) {
            $path = [$category->name];
            $seen = [$category->id];
            $parent = $category->parent_id;
            while ($parent && isset($categories[$parent]) && !in_array($parent, $seen)) {
                $seen[] = $parent;
                array_unshift($path, $categories[$parent]->name);
                $parent = $categories[$parent]->parent_id;
            }
            if (!$parent && count($path) >= 2 && count($path) <= 3) $result[$category->id] = implode(' / ', $path);
        }
        return $result;
    }

    public static function groupCategoryOptions(int $dictionaryId): array
    {
        $categories = DictionaryCategory::where('dictionary_id', $dictionaryId)->orderBy('order')->get();
        $roots = $categories->whereNull('parent_id')->pluck('id');
        return $categories->whereIn('parent_id', $roots)->pluck('name', 'id')->all();
    }
}
