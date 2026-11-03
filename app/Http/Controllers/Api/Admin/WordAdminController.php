<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Dictionary;
use App\Models\DictionaryCategory;
use App\Models\DictionaryWord;
use App\Models\UserDictionaryWord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class WordAdminController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'dictionary_id' => ['required', 'integer', 'exists:dictionaries,id'],
            'category_ids' => ['required', 'array', 'min:1'],
            'category_ids.*' => ['integer', 'exists:dictionary_categories,id'],
            'word' => ['required', 'string', 'max:255'],
            'translation_1' => ['required', 'string', 'max:255'],
            'translation_2' => ['nullable', 'string', 'max:255'],
            'translation_3' => ['nullable', 'string', 'max:255'],
            'translation_input_variable' => ['nullable', 'string', 'max:1000'],
            'difficult_translation' => ['nullable', 'string', 'max:255'],
            'translations' => ['nullable', 'array'],
            'translations.*.translation_1' => ['nullable', 'string', 'max:255'],
            'translations.*.translation_2' => ['nullable', 'string', 'max:255'],
            'translations.*.translation_3' => ['nullable', 'string', 'max:255'],
            'translations.*.translation_input_variable' => ['nullable', 'string', 'max:1000'],
            'translations.*.difficult_translation' => ['nullable', 'string', 'max:255'],
            'translations.*.info' => ['nullable', 'string'],
            'info' => ['nullable', 'string'],
            'level' => ['nullable', 'integer', 'min:1', 'max:6'],
            'max_level' => ['nullable', 'integer', 'min:1', 'max:6'],
            'type' => ['nullable', 'string', 'max:50'],
            'gender' => ['nullable', 'string', 'max:1'],
            'is_phrase' => ['sometimes', 'boolean'],
        ]);

        $dictionary = Dictionary::query()->findOrFail($data['dictionary_id']);
        $maxOrder = (int) DictionaryWord::query()->where('dictionary_id', $dictionary->id)->max('order');

        $word = DictionaryWord::query()->create([
            'dictionary_id' => $dictionary->id,
            'word' => $data['word'],
            'learn_lang' => $dictionary->learn_lang,
            'is_phrase' => (bool) ($data['is_phrase'] ?? count(preg_split('/[\s,]+/', $data['word']) ?: []) > 1),
            'translation_1' => $data['translation_1'],
            'translation_2' => $data['translation_2'] ?? null,
            'translation_3' => $data['translation_3'] ?? null,
            'translation_input_variable' => $data['translation_input_variable'] ?? null,
            'difficult_translation' => $data['difficult_translation'] ?? null,
            'info' => $data['info'] ?? null,
            'level' => $data['level'] ?? null,
            'max_level' => $data['max_level'] ?? 1,
            'type' => $data['type'] ?? null,
            'gender' => $data['gender'] ?? null,
            'order' => $maxOrder + 1,
        ]);

        $word->categories()->sync($data['category_ids']);
        $this->syncWordTranslation($word, (string) ($dictionary->lang ?: 'ru'), $data);
        $this->syncWordTranslationsFromPayload($word, $data['translations'] ?? []);
        $this->syncDictionaryTranslationLanguages($dictionary);
        $dictionary->update(['words' => $dictionary->dictionaryWords()->count()]);

        return response()->json(['data' => $word->load(['categories:id', 'translations'])], 201);
    }

    public function update(Request $request, DictionaryWord $word): JsonResponse
    {
        $data = $request->validate([
            'word' => ['sometimes', 'string', 'max:255'],
            'translation_1' => ['sometimes', 'string', 'max:255'],
            'translation_2' => ['nullable', 'string', 'max:255'],
            'translation_3' => ['nullable', 'string', 'max:255'],
            'translation_input_variable' => ['nullable', 'string', 'max:1000'],
            'difficult_translation' => ['nullable', 'string', 'max:255'],
            'info' => ['nullable', 'string'],
            'sound_url' => ['nullable', 'string', 'max:1000'],
            'level' => ['nullable', 'integer', 'min:1', 'max:6'],
            'max_level' => ['nullable', 'integer', 'min:1', 'max:6'],
            'type' => ['nullable', 'string', 'max:50'],
            'gender' => ['nullable', 'string', 'max:10'],
            'is_phrase' => ['sometimes', 'boolean'],
            'category_ids' => ['sometimes', 'array'],
            'category_ids.*' => ['integer', 'exists:dictionary_categories,id'],
            'translations' => ['nullable', 'array'],
            'translations.*.translation_1' => ['nullable', 'string', 'max:255'],
            'translations.*.translation_2' => ['nullable', 'string', 'max:255'],
            'translations.*.translation_3' => ['nullable', 'string', 'max:255'],
            'translations.*.translation_input_variable' => ['nullable', 'string', 'max:1000'],
            'translations.*.difficult_translation' => ['nullable', 'string', 'max:255'],
            'translations.*.info' => ['nullable', 'string'],
        ]);

        $word->fill(collect($data)->except(['category_ids', 'translations'])->all());
        $word->save();

        if (array_key_exists('category_ids', $data)) {
            $word->categories()->sync($data['category_ids'] ?? []);
        }

        $dictionary = $word->dictionary()->first();
        if ($dictionary && $this->hasLegacyTranslationFields($data)) {
            $this->syncWordTranslation($word, (string) ($dictionary->lang ?: 'ru'), $word->toArray());
        }
        if (array_key_exists('translations', $data)) {
            $this->syncWordTranslationsFromPayload($word, $data['translations'] ?? []);
        }
        if ($dictionary) {
            $this->syncDictionaryTranslationLanguages($dictionary);
        }

        return response()->json(['data' => $word->fresh()->load(['categories:id', 'translations'])]);
    }

    public function destroy(Request $request, DictionaryWord $word): JsonResponse
    {
        $categoryId = $request->integer('category_id');
        $dictionaryId = $word->dictionary_id;

        if ($categoryId > 0) {
            $word->categories()->detach($categoryId);
            if ($word->categories()->count() === 0) {
                $word->delete();
            }
        } else {
            $word->delete();
        }

        Dictionary::query()->where('id', $dictionaryId)->update([
            'words' => DictionaryWord::query()->where('dictionary_id', $dictionaryId)->count(),
        ]);

        return response()->json(['ok' => true]);
    }

    public function bulkStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'dictionary_id' => ['required', 'integer', 'exists:dictionaries,id'],
            'category_ids' => ['required', 'array', 'min:1'],
            'category_ids.*' => ['integer', 'exists:dictionary_categories,id'],
            'lines' => ['required', 'string'],
        ]);

        $dictionary = Dictionary::query()->findOrFail($data['dictionary_id']);
        $created = 0;
        $maxOrder = (int) DictionaryWord::query()->where('dictionary_id', $dictionary->id)->max('order');

        foreach (preg_split("/\r\n|\n|\r/", $data['lines']) ?: [] as $line) {
            $line = trim($line);
            if ($line === '') {
                continue;
            }
            $parts = array_map('trim', explode(';', $line));
            if (count($parts) < 2 || $parts[0] === '' || $parts[1] === '') {
                continue;
            }

            $maxOrder++;
            $word = DictionaryWord::query()->create([
                'dictionary_id' => $dictionary->id,
                'word' => $parts[0],
                'learn_lang' => $dictionary->learn_lang,
                'is_phrase' => count(preg_split('/[\s,]+/', $parts[0]) ?: []) > 1,
                'translation_1' => $parts[1],
                'translation_2' => $parts[2] ?? null,
                'translation_3' => $parts[3] ?? null,
                'max_level' => 1,
                'order' => $maxOrder,
            ]);
            $word->categories()->sync($data['category_ids']);
            $this->syncWordTranslation($word, (string) ($dictionary->lang ?: 'ru'), $word->toArray());
            $created++;
        }

        $dictionary->update(['words' => $dictionary->dictionaryWords()->count()]);
        $this->syncDictionaryTranslationLanguages($dictionary);

        return response()->json(['created' => $created]);
    }

    public function move(Request $request): JsonResponse
    {
        $data = $request->validate([
            'word_ids' => ['required', 'array', 'min:1'],
            'word_ids.*' => ['integer', 'exists:dictionary_words,id'],
            'source_category_id' => ['nullable', 'integer', 'exists:dictionary_categories,id'],
            'target_category_id' => ['required', 'integer', 'exists:dictionary_categories,id'],
            'target_dictionary_id' => ['nullable', 'integer', 'exists:dictionaries,id'],
            'mode' => ['required', 'in:move,copy'],
        ]);

        $targetCategory = DictionaryCategory::query()->findOrFail($data['target_category_id']);
        $targetDictId = (int) ($data['target_dictionary_id'] ?? $targetCategory->dictionary_id);
        $mode = $data['mode'];
        $sourceCategoryId = $data['source_category_id'] ?? null;
        $moved = 0;
        $errors = [];

        DB::transaction(function () use ($data, $targetCategory, $targetDictId, $mode, $sourceCategoryId, &$moved, &$errors) {
            foreach ($data['word_ids'] as $wordId) {
                $word = DictionaryWord::query()->find($wordId);
                if (! $word) {
                    $errors[] = "Слово ID {$wordId} не найдено";

                    continue;
                }

                $sameDict = (int) $word->dictionary_id === $targetDictId;

                if (! $sameDict || ($mode === 'copy' && ! $sameDict)) {
                    // cross-dictionary always creates a new word
                    $clone = $word->replicate();
                    $clone->dictionary_id = $targetDictId;
                    $clone->learn_lang = Dictionary::query()->where('id', $targetDictId)->value('learn_lang') ?? $word->learn_lang;
                    $clone->save();
                    $this->copyWordTranslations($word, $clone);
                    $clone->categories()->attach($targetCategory->id);

                    if ($mode === 'move' && $sourceCategoryId) {
                        $word->categories()->detach($sourceCategoryId);
                        if ($word->categories()->count() === 0) {
                            $word->delete();
                        }
                    }
                } elseif ($mode === 'copy') {
                    $word->categories()->syncWithoutDetaching([$targetCategory->id]);
                } else {
                    if ($sourceCategoryId) {
                        $word->categories()->detach($sourceCategoryId);
                    }
                    $word->categories()->syncWithoutDetaching([$targetCategory->id]);
                }

                $moved++;
            }

            foreach (array_unique([(int) ($data['target_dictionary_id'] ?? $targetDictId)]) as $dictId) {
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
            'moved_count' => $moved,
            'errors' => $errors,
            'message' => ($mode === 'copy' ? 'Скопировано' : 'Перемещено')." слов: {$moved}",
        ]);
    }

    public function reorder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category_id' => ['required', 'integer', 'exists:dictionary_categories,id'],
            'word_orders' => ['required', 'array', 'min:1'],
            'word_orders.*.word_id' => ['required', 'integer'],
            'word_orders.*.order' => ['required', 'integer', 'min:0'],
        ]);

        $categoryWordIds = DB::table('dictionary_word_category')
            ->where('category_id', $data['category_id'])
            ->pluck('word_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        if ($categoryWordIds === []) {
            throw ValidationException::withMessages([
                'category_id' => 'Категория пуста или не найдена.',
            ]);
        }

        $updated = 0;
        foreach ($data['word_orders'] as $item) {
            $wordId = (int) $item['word_id'];
            if (! in_array($wordId, $categoryWordIds, true)) {
                continue;
            }
            DictionaryWord::query()->where('id', $wordId)->update(['order' => (int) $item['order']]);
            $updated++;
        }

        return response()->json(['reordered' => true, 'updated_count' => $updated]);
    }

    public function shuffleDictionary(Request $request): JsonResponse
    {
        $data = $request->validate([
            'dictionary_id' => ['required', 'integer', 'exists:dictionaries,id'],
            'confirm' => ['required', 'in:YES_SHUFFLE_PERMANENTLY'],
        ]);

        $words = DictionaryWord::query()
            ->where('dictionary_id', $data['dictionary_id'])
            ->get(['id']);

        $ids = $words->pluck('id')->shuffle()->values();
        foreach ($ids as $index => $id) {
            DictionaryWord::query()->where('id', $id)->update(['order' => $index + 1]);
        }

        return response()->json([
            'shuffled' => true,
            'updated_count' => $ids->count(),
            'message' => 'Порядок слов словаря перемешан',
        ]);
    }

    public function progressShow(Request $request, DictionaryWord $word): JsonResponse
    {
        $user = $request->user();
        $progress = UserDictionaryWord::query()
            ->where('user_id', $user->id)
            ->where('dict_word_id', $word->id)
            ->first();

        return response()->json([
            'progress' => $progress,
            'user_id' => $user->id,
            'user_display' => $user->name ?: $user->email,
            'word' => array_merge($word->only([
                'id',
                'word',
                'translation_1',
                'translation_2',
                'translation_3',
                'translation_input_variable',
                'difficult_translation',
                'info',
                'sound_url',
                'level',
                'max_level',
                'type',
                'gender',
                'is_phrase',
                'order',
            ]), [
                'translations' => $this->serializeWordTranslations($word->loadMissing('translations')),
            ]),
        ]);
    }

    public function sortWithAi(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category_id' => ['required', 'integer', 'exists:dictionary_categories,id'],
            'words' => ['required', 'array', 'min:1'],
            'words.*.id' => ['required', 'integer'],
            'words.*.word' => ['required', 'string'],
            'words.*.translation' => ['nullable', 'string'],
        ]);

        $apiKey = config('services.openai.key') ?: env('OPENAI_API_KEY');
        if (! is_string($apiKey) || $apiKey === '') {
            return response()->json([
                'message' => 'OpenAI API ключ не настроен (OPENAI_API_KEY)',
            ], 422);
        }

        $categoryWordIds = DB::table('dictionary_word_category')
            ->where('category_id', $data['category_id'])
            ->pluck('word_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $words = array_values(array_filter(
            $data['words'],
            fn ($w) => in_array((int) $w['id'], $categoryWordIds, true),
        ));

        if ($words === []) {
            throw ValidationException::withMessages(['words' => 'Нет слов категории.']);
        }

        $list = implode("\n", array_map(
            fn ($w) => $w['word'].' → '.($w['translation'] ?? ''),
            $words,
        ));

        $prompt = "Отсортируй следующие слова по смыслу и частотности. Базовые — в начало, редкие — в конец. Верни ТОЛЬКО строки в формате 'слово → перевод', по одной на строку.\n\n".$list;

        $response = \Illuminate\Support\Facades\Http::withToken($apiKey)
            ->timeout(45)
            ->post('https://api.openai.com/v1/chat/completions', [
                'model' => 'gpt-4o-mini',
                'temperature' => 0.3,
                'messages' => [
                    ['role' => 'system', 'content' => 'Ты лингвист. Отвечай только списком строк слово → перевод.'],
                    ['role' => 'user', 'content' => $prompt],
                ],
            ]);

        if (! $response->successful()) {
            return response()->json(['message' => 'Ошибка OpenAI: '.$response->status()], 502);
        }

        $content = trim((string) data_get($response->json(), 'choices.0.message.content', ''));
        if ($content === '') {
            return response()->json(['message' => 'Пустой ответ OpenAI'], 502);
        }

        $remaining = collect($words)->keyBy(fn ($w) => mb_strtolower($w['word']));
        $sorted = [];
        foreach (preg_split("/\r\n|\n|\r/", $content) ?: [] as $line) {
            $line = trim($line);
            if ($line === '' || ! preg_match('/^(.+?)\s*→/', $line, $m)) {
                continue;
            }
            $key = mb_strtolower(trim($m[1]));
            if ($remaining->has($key)) {
                $sorted[] = $remaining->get($key);
                $remaining->forget($key);
            }
        }
        foreach ($remaining as $w) {
            $sorted[] = $w;
        }

        $orders = [];
        foreach ($sorted as $i => $w) {
            $orders[] = ['word_id' => (int) $w['id'], 'order' => $i + 1];
            DictionaryWord::query()->where('id', $w['id'])->update(['order' => $i + 1]);
        }

        return response()->json([
            'success' => true,
            'sorted_words' => $sorted,
            'word_orders' => $orders,
            'updated_count' => count($orders),
        ]);
    }

    public function destroyAllInCategory(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category_id' => ['required', 'integer', 'exists:dictionary_categories,id'],
            'confirm' => ['required', 'in:DELETE_ALL'],
        ]);

        $wordIds = DB::table('dictionary_word_category')
            ->where('category_id', $data['category_id'])
            ->pluck('word_id');

        $deleted = 0;
        $detached = 0;
        $dictIds = [];

        DB::transaction(function () use ($data, $wordIds, &$deleted, &$detached, &$dictIds) {
            foreach ($wordIds as $wordId) {
                $word = DictionaryWord::query()->find($wordId);
                if (! $word) {
                    continue;
                }
                $dictIds[] = (int) $word->dictionary_id;
                $word->categories()->detach($data['category_id']);
                $detached++;
                if ($word->categories()->count() === 0) {
                    $word->delete();
                    $deleted++;
                }
            }
            foreach (array_unique($dictIds) as $dictId) {
                Dictionary::query()->where('id', $dictId)->update([
                    'words' => DictionaryWord::query()->where('dictionary_id', $dictId)->count(),
                ]);
            }
        });

        return response()->json([
            'detached' => $detached,
            'deleted' => $deleted,
            'message' => "Отвязано: {$detached}, удалено полностью: {$deleted}",
        ]);
    }

    public function progressUpdate(Request $request, DictionaryWord $word): JsonResponse
    {
        $data = $request->validate([
            'attempts' => ['sometimes', 'integer', 'min:0'],
            'correct_attempts' => ['sometimes', 'integer', 'min:0'],
            'attempts_revert' => ['sometimes', 'integer', 'min:0'],
            'correct_attempts_revert' => ['sometimes', 'integer', 'min:0'],
            'statistic_attempts' => ['sometimes', 'integer', 'min:0'],
            'statistic_attempts_revert' => ['sometimes', 'integer', 'min:0'],
            'statistic_correct_attempts' => ['sometimes', 'integer', 'min:0'],
            'statistic_correct_attempts_revert' => ['sometimes', 'integer', 'min:0'],
            'mode_education' => ['sometimes', 'boolean'],
            'mode_education_revert' => ['sometimes', 'boolean'],
            'easy_education' => ['sometimes', 'boolean'],
            'attempts_all' => ['sometimes', 'integer', 'min:0'],
            'correct_attempts_all' => ['sometimes', 'integer', 'min:0'],
            'easy_correct' => ['sometimes', 'boolean'],
            'easy_correct_revert' => ['sometimes', 'boolean'],
            'cooldown_tier' => ['sometimes', 'integer', 'min:0', 'max:2'],
            'cooldown_tier_revert' => ['sometimes', 'integer', 'min:0', 'max:2'],
            'last_shown' => ['nullable', 'date'],
            'last_shown_revert' => ['nullable', 'date'],
            'is_reset' => ['sometimes', 'boolean'],
        ]);

        $row = UserDictionaryWord::query()->firstOrNew([
            'user_id' => $request->user()->id,
            'dict_word_id' => $word->id,
        ]);
        $row->fill($data);
        $row->save();

        return response()->json([
            'message' => 'Прогресс сохранён',
            'progress' => $row->fresh(),
        ]);
    }

    private function normalizeLang(string $lang): string
    {
        return strtolower(trim($lang)) ?: 'ru';
    }

    private function hasLegacyTranslationFields(array $data): bool
    {
        foreach (['translation_1', 'translation_2', 'translation_3', 'translation_input_variable', 'difficult_translation', 'info'] as $field) {
            if (array_key_exists($field, $data)) {
                return true;
            }
        }

        return false;
    }

    private function syncWordTranslation(DictionaryWord $word, string $lang, array $data): void
    {
        $word->translations()->updateOrCreate(
            ['lang' => $this->normalizeLang($lang)],
            [
                'translation_1' => $data['translation_1'] ?? null,
                'translation_2' => $data['translation_2'] ?? null,
                'translation_3' => $data['translation_3'] ?? null,
                'translation_input_variable' => $data['translation_input_variable'] ?? null,
                'difficult_translation' => $data['difficult_translation'] ?? null,
                'info' => $data['info'] ?? null,
            ],
        );
    }

    private function syncWordTranslationsFromPayload(DictionaryWord $word, array $translations): void
    {
        foreach ($translations as $lang => $translation) {
            if (! is_array($translation)) {
                continue;
            }
            $this->syncWordTranslation($word, (string) $lang, $translation);
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

    private function syncDictionaryTranslationLanguages(Dictionary $dictionary): void
    {
        $languages = DB::table('dictionary_word_translations')
            ->join('dictionary_words', 'dictionary_words.id', '=', 'dictionary_word_translations.word_id')
            ->where('dictionary_words.dictionary_id', $dictionary->id)
            ->pluck('dictionary_word_translations.lang')
            ->push($dictionary->lang ?: 'ru')
            ->map(fn ($lang) => $this->normalizeLang((string) $lang))
            ->filter()
            ->unique()
            ->values()
            ->all();

        $dictionary->forceFill(['translation_languages' => $languages])->save();
    }
}
