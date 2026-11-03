<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Dictionary;
use App\Models\DictionaryCategory;
use App\Models\DictionaryWord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DictionaryController extends Controller implements \Illuminate\Routing\Controllers\HasMiddleware
{
    public static function middleware(): array
    {
        return [\App\Http\Middleware\CacheDictionaryResponse::class];
    }

    public function index(Request $request): JsonResponse
    {
        $learnLang = strtolower((string) $request->query('learn_lang', ''));

        $query = Dictionary::query()->where('is_listed', true)->orderBy('id');

        if ($learnLang !== '') {
            $query->whereRaw('LOWER(learn_lang) = ?', [$learnLang]);
        }

        $items = $query->get()->map(fn (Dictionary $d) => [
            'id' => $d->id,
            'name' => $d->name,
            'lang' => $d->lang,
            'learn_lang' => $d->learn_lang,
            'words' => $d->words,
            'level' => $d->level,
            'max_level' => $d->max_level,
            'sound' => $d->sound,
            'translation_languages' => $this->dictionaryTranslationLanguages($d),
        ]);

        return response()->json(['data' => $items]);
    }

    public function show(Dictionary $dictionary): JsonResponse
    {
        return response()->json([
            'data' => [
                'id' => $dictionary->id,
                'name' => $dictionary->name,
                'lang' => $dictionary->lang,
                'learn_lang' => $dictionary->learn_lang,
                'words' => $dictionary->words,
                'level' => $dictionary->level,
                'max_level' => $dictionary->max_level,
                'sound' => $dictionary->sound,
                'translation_languages' => $this->dictionaryTranslationLanguages($dictionary),
            ],
        ]);
    }

    public function categories(Dictionary $dictionary): JsonResponse
    {
        $categories = DictionaryCategory::query()
            ->where('dictionary_id', $dictionary->id)
            ->with('translations')
            ->orderBy('order')
            ->orderBy('id')
            ->get(['id', 'dictionary_id', 'name', 'parent_id', 'order']);

        $byParent = $categories->groupBy(fn ($c) => $c->parent_id ?? 0);

        $build = function ($parentId) use (&$build, $byParent): array {
            return ($byParent[$parentId] ?? collect())->map(function ($cat) use (&$build) {
                return [
                    'id' => $cat->id,
                    'name' => $cat->name,
                    'name_translations' => $this->serializeCategoryTranslations($cat),
                    'parent_id' => $cat->parent_id,
                    'order' => $cat->order,
                    'children' => $build($cat->id),
                ];
            })->values()->all();
        };

        return response()->json([
            'data' => $build(0),
            'flat' => $categories->map(fn (DictionaryCategory $cat) => [
                'id' => $cat->id,
                'dictionary_id' => $cat->dictionary_id,
                'name' => $cat->name,
                'name_translations' => $this->serializeCategoryTranslations($cat),
                'parent_id' => $cat->parent_id,
                'order' => $cat->order,
            ])->values(),
        ]);
    }

    public function words(Request $request, Dictionary $dictionary): JsonResponse
    {
        $categoryId = $request->query('category_id');

        $query = DictionaryWord::query()
            ->where('dictionary_id', $dictionary->id)
            ->with(['categories:id', 'translations'])
            ->orderBy('order')
            ->orderBy('id');

        if ($categoryId) {
            $query->whereHas('categories', fn ($q) => $q->where('dictionary_categories.id', (int) $categoryId));
        }

        $words = $query->get()->map(fn (DictionaryWord $w) => [
            'id' => $w->id,
            'dictionary_id' => $w->dictionary_id,
            'word' => $w->word,
            'learn_lang' => $w->learn_lang,
            'is_phrase' => $w->is_phrase,
            'translation_1' => $w->translation_1,
            'translation_2' => $w->translation_2,
            'translation_3' => $w->translation_3,
            'translation_input_variable' => $w->translation_input_variable,
            'difficult_translation' => $w->difficult_translation,
            'translations' => $this->serializeWordTranslations($w),
            'info' => $w->info,
            'sound_url' => $w->sound_url,
            'level' => $w->level,
            'max_level' => $w->max_level,
            'type' => $w->type,
            'gender' => $w->gender,
            'order' => $w->order,
            'category_ids' => $w->categories->pluck('id')->values(),
        ]);

        return response()->json(['data' => $words]);
    }

    /** @return list<string> */
    private function dictionaryTranslationLanguages(Dictionary $dictionary): array
    {
        $languages = is_array($dictionary->translation_languages) ? $dictionary->translation_languages : [];
        $fallback = strtolower((string) ($dictionary->lang ?: 'ru'));
        $languages[] = $fallback;

        return collect($languages)
            ->map(fn ($lang) => strtolower(trim((string) $lang)))
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    /** @return array<string, array<string, string|null>> */
    private function serializeWordTranslations(DictionaryWord $word): array
    {
        return $word->translations
            ->mapWithKeys(fn ($translation) => [
                $translation->lang => [
                    'translation_1' => $translation->translation_1,
                    'translation_2' => $translation->translation_2,
                    'translation_3' => $translation->translation_3,
                    'translation_input_variable' => $translation->translation_input_variable,
                    'difficult_translation' => $translation->difficult_translation,
                    'info' => $translation->info,
                ],
            ])
            ->all();
    }

    /** @return array<string, string> */
    private function serializeCategoryTranslations(DictionaryCategory $category): array
    {
        return $category->translations
            ->mapWithKeys(fn ($translation) => [$translation->lang => $translation->name])
            ->all();
    }
}
