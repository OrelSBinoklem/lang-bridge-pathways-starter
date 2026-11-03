<?php

namespace App\Console\Commands;

use App\Models\Dictionary;
use App\Models\DictionaryCategory;
use App\Models\DictionaryWord;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class MergeDictionaryTranslationsCommand extends Command
{
    private bool $warnedMissingOpenAiKey = false;

    /** @var array<string, bool> */
    private array $targetMissingProcessed = [];

    protected $signature = 'dictionaries:merge-translations
        {--from=uk : Source dictionary UI language}
        {--to=ru : Target dictionary UI language}
        {--learn-lang= : Limit by learned language, for example lv}
        {--dry-run : Show report without writing}
        {--create-missing : Clone source words that do not exist in target dictionary}
        {--fill-missing-ai : Fill empty source translation slots with OpenAI before saving}
        {--fill-target-missing : Fill target dictionary words that still have no source-language translation row}
        {--fill-all-variants : With --fill-missing-ai, also fill optional translation_2 and translation_3}
        {--limit= : Maximum number of source words to process}
        {--ai-model=gpt-4.1-mini : Model for missing translation fill}
        {--delete-source : Delete source dictionaries after successful merge}';

    protected $description = 'Move translations from separate language dictionaries into multilingual translation rows.';

    public function handle(): int
    {
        $from = $this->normalizeLang((string) $this->option('from'));
        $to = $this->normalizeLang((string) $this->option('to'));
        $learnLang = $this->normalizeLang((string) $this->option('learn-lang'));
        $dryRun = (bool) $this->option('dry-run');
        $createMissing = (bool) $this->option('create-missing');
        $fillMissingAi = (bool) $this->option('fill-missing-ai');
        $fillAllVariants = (bool) $this->option('fill-all-variants');
        $limit = max(0, (int) $this->option('limit'));
        $aiModel = trim((string) $this->option('ai-model')) ?: 'gpt-4.1-mini';
        $deleteSource = (bool) $this->option('delete-source');

        if ($from === $to) {
            $this->error('from and to languages must be different.');

            return self::FAILURE;
        }

        if ($deleteSource && $dryRun) {
            $this->warn('--delete-source is ignored in --dry-run mode.');
        }

        $sources = Dictionary::query()
            ->whereRaw('LOWER(lang) = ?', [$from])
            ->when($learnLang !== '', fn ($query) => $query->whereRaw('LOWER(learn_lang) = ?', [$learnLang]))
            ->orderBy('id')
            ->get();

        if ($sources->isEmpty()) {
            $this->warn("No source dictionaries found for lang={$from}.");

            return self::SUCCESS;
        }

        $totals = [
            'dictionaries' => 0,
            'category_translations' => 0,
            'word_translations' => 0,
            'created_words' => 0,
            'missing_words' => 0,
            'empty_translation_slots' => 0,
            'ai_filled_slots' => 0,
            'target_missing_words' => 0,
            'target_ai_created_rows' => 0,
            'limited_out_words' => 0,
            'skipped' => 0,
            'deleted_sources' => 0,
        ];

        foreach ($sources as $source) {
            $target = $this->findTargetDictionary($source, $to);
            if (! $target) {
                $this->warn("Skip source #{$source->id} {$source->name}: target {$to} dictionary not found.");
                $totals['skipped']++;

                continue;
            }

            $this->line(($dryRun ? '[dry-run] ' : '')."Merge source #{$source->id} {$source->name} -> target #{$target->id} {$target->name}");

            $categoryMap = $this->buildCategoryMap($source, $target);
            $sourceCategories = DictionaryCategory::query()
                ->where('dictionary_id', $source->id)
                ->orderBy('parent_id')
                ->orderBy('order')
                ->orderBy('id')
                ->get();

            $sourceWords = DictionaryWord::query()
                ->where('dictionary_id', $source->id)
                ->with('categories:id')
                ->orderBy('id')
                ->when($limit > 0, fn ($query) => $query->limit($limit))
                ->get();

            if ($limit > 0) {
                $totalSourceWords = DictionaryWord::query()
                    ->where('dictionary_id', $source->id)
                    ->count();
                $totals['limited_out_words'] += max(0, $totalSourceWords - $sourceWords->count());
            }

            if (! $dryRun) {
                DB::transaction(function () use (
                    $source,
                    $target,
                    $from,
                    $to,
                    $categoryMap,
                    $sourceCategories,
                    $sourceWords,
                    $createMissing,
                    $fillMissingAi,
                    $fillAllVariants,
                    $aiModel,
                    $limit,
                    $deleteSource,
                    &$totals,
                ): void {
                    $this->mergeCategories($from, $categoryMap, $sourceCategories, $totals);
                    $this->mergeWords($from, $to, $target, $categoryMap, $sourceWords, $createMissing, $fillMissingAi, $fillAllVariants, $aiModel, $totals);
                    $this->fillTargetMissingWords($target, $from, $to, $aiModel, $fillMissingAi && (bool) $this->option('fill-target-missing'), $limit, $totals);
                    $this->syncDictionaryLanguages($target, [$from, $to]);

                    if ($deleteSource) {
                        $source->delete();
                        $totals['deleted_sources']++;
                    }
                });
            } else {
                $this->mergeCategories($from, $categoryMap, $sourceCategories, $totals, true);
                $this->mergeWords($from, $to, $target, $categoryMap, $sourceWords, $createMissing, $fillMissingAi, $fillAllVariants, $aiModel, $totals, true);
                $this->fillTargetMissingWords($target, $from, $to, $aiModel, false, $limit, $totals);
            }

            $totals['dictionaries']++;
        }

        $this->newLine();
        $this->table(
            ['metric', 'count'],
            collect($totals)->map(fn ($count, $metric) => [$metric, $count])->values()->all(),
        );

        return self::SUCCESS;
    }

    private function findTargetDictionary(Dictionary $source, string $to): ?Dictionary
    {
        return Dictionary::query()
            ->whereRaw('LOWER(lang) = ?', [$to])
            ->whereRaw('LOWER(learn_lang) = ?', [$this->normalizeLang((string) $source->learn_lang)])
            ->where('level', $source->level)
            ->where('max_level', $source->max_level)
            ->orderBy('id')
            ->first();
    }

    /** @return array<int, int> */
    private function buildCategoryMap(Dictionary $source, Dictionary $target): array
    {
        $sourcePaths = $this->categoryPaths($source);
        $targetPaths = array_flip($this->categoryPaths($target));
        $map = [];

        foreach ($sourcePaths as $sourceCategoryId => $path) {
            if (isset($targetPaths[$path])) {
                $map[(int) $sourceCategoryId] = (int) $targetPaths[$path];
            }
        }

        return $map;
    }

    /** @return array<int, string> */
    private function categoryPaths(Dictionary $dictionary): array
    {
        $categories = DictionaryCategory::query()
            ->where('dictionary_id', $dictionary->id)
            ->orderBy('parent_id')
            ->orderBy('order')
            ->orderBy('id')
            ->get(['id', 'parent_id', 'order'])
            ->groupBy(fn (DictionaryCategory $category) => $category->parent_id ?: 0);

        $paths = [];
        $walk = function (int $parentId, string $prefix) use (&$walk, &$paths, $categories): void {
            $siblings = ($categories[$parentId] ?? collect())->values();
            foreach ($siblings as $index => $category) {
                $path = $prefix.sprintf('%04d', $index + 1).'/';
                $paths[(int) $category->id] = $path;
                $walk((int) $category->id, $path);
            }
        };
        $walk(0, '');

        return $paths;
    }

    private function mergeCategories(string $from, array $categoryMap, $sourceCategories, array &$totals, bool $dryRun = false): void
    {
        foreach ($sourceCategories as $sourceCategory) {
            $targetCategoryId = $categoryMap[(int) $sourceCategory->id] ?? null;
            if (! $targetCategoryId) {
                continue;
            }

            if (! $dryRun) {
                DB::table('dictionary_category_translations')->updateOrInsert(
                    ['category_id' => $targetCategoryId, 'lang' => $from],
                    [
                        'name' => $sourceCategory->name,
                        'updated_at' => now(),
                        'created_at' => now(),
                    ],
                );
            }

            $totals['category_translations']++;
        }
    }

    private function mergeWords(
        string $from,
        string $to,
        Dictionary $target,
        array $categoryMap,
        $sourceWords,
        bool $createMissing,
        bool $fillMissingAi,
        bool $fillAllVariants,
        string $aiModel,
        array &$totals,
        bool $dryRun = false,
    ): void {
        foreach ($sourceWords as $sourceWord) {
            $targetWord = DictionaryWord::query()
                ->where('dictionary_id', $target->id)
                ->whereRaw('LOWER(word) = ?', [mb_strtolower($sourceWord->word)])
                ->first();

            if (! $targetWord) {
                if (! $createMissing) {
                    $totals['missing_words']++;

                    continue;
                }

                if (! $dryRun) {
                    $targetWord = $sourceWord->replicate();
                    $targetWord->dictionary_id = $target->id;
                    $targetWord->learn_lang = $target->learn_lang;
                    $targetWord->translation_1 = '';
                    $targetWord->translation_2 = null;
                    $targetWord->translation_3 = null;
                    $targetWord->translation_input_variable = null;
                    $targetWord->difficult_translation = null;
                    $targetWord->save();

                    $mappedCategoryIds = $sourceWord->categories
                        ->map(fn ($category) => $categoryMap[(int) $category->id] ?? null)
                        ->filter()
                        ->values()
                        ->all();
                    if ($mappedCategoryIds !== []) {
                        $targetWord->categories()->syncWithoutDetaching($mappedCategoryIds);
                    }
                }

                $totals['created_words']++;
            }

            foreach (['translation_1', 'translation_2', 'translation_3'] as $field) {
                if (trim((string) $sourceWord->{$field}) === '') {
                    $totals['empty_translation_slots']++;
                }
            }

            $translationData = [
                'translation_1' => $sourceWord->translation_1,
                'translation_2' => $sourceWord->translation_2,
                'translation_3' => $sourceWord->translation_3,
                'translation_input_variable' => $sourceWord->translation_input_variable,
                'difficult_translation' => $sourceWord->difficult_translation,
                'info' => $sourceWord->info,
            ];

            if ($fillMissingAi && ! $dryRun) {
                $filled = $this->fillMissingTranslations($sourceWord, $targetWord, $target, $from, $to, $aiModel, $translationData, $fillAllVariants);
                foreach (['translation_1', 'translation_2', 'translation_3'] as $field) {
                    if (($translationData[$field] ?? null) !== ($filled[$field] ?? null)) {
                        $totals['ai_filled_slots']++;
                    }
                }
                $translationData = $filled;
            }

            if (! $dryRun && $targetWord) {
                $targetWord->translations()->updateOrCreate(
                    ['lang' => $from],
                    $translationData,
                );
                $targetWord->translations()->updateOrCreate(
                    ['lang' => $to],
                    [
                        'translation_1' => $targetWord->translation_1,
                        'translation_2' => $targetWord->translation_2,
                        'translation_3' => $targetWord->translation_3,
                        'translation_input_variable' => $targetWord->translation_input_variable,
                        'difficult_translation' => $targetWord->difficult_translation,
                        'info' => $targetWord->info,
                    ],
                );
            }

            $totals['word_translations']++;
        }
    }

    private function fillTargetMissingWords(
        Dictionary $target,
        string $targetLang,
        string $referenceLang,
        string $aiModel,
        bool $shouldWrite,
        int $limit,
        array &$totals,
    ): void {
        $key = $target->id.':'.$targetLang;
        if (isset($this->targetMissingProcessed[$key])) {
            return;
        }
        $this->targetMissingProcessed[$key] = true;

        $query = DictionaryWord::query()
            ->where('dictionary_id', $target->id)
            ->whereDoesntHave('translations', fn ($query) => $query->where('lang', $targetLang))
            ->orderBy('id');

        $totalMissing = (clone $query)->count();
        $words = $query
            ->when($limit > 0, fn ($query) => $query->limit($limit))
            ->get();

        $totals['target_missing_words'] += $totalMissing;
        if ($limit > 0) {
            $totals['limited_out_words'] += max(0, $totalMissing - $words->count());
        }

        foreach ($words as $word) {
            $translationData = [
                'translation_1' => null,
                'translation_2' => null,
                'translation_3' => null,
                'translation_input_variable' => null,
                'difficult_translation' => null,
                'info' => null,
            ];

            if (! $shouldWrite) {
                continue;
            }

            $filled = $this->fillMissingTranslations($word, $word, $target, $targetLang, $referenceLang, $aiModel, $translationData, true);
            if (trim((string) ($filled['translation_1'] ?? '')) === '') {
                continue;
            }

            $word->translations()->updateOrCreate(['lang' => $targetLang], $filled);
            $totals['target_ai_created_rows']++;
            foreach (['translation_1', 'translation_2', 'translation_3'] as $field) {
                if (trim((string) ($filled[$field] ?? '')) !== '') {
                    $totals['ai_filled_slots']++;
                }
            }
        }
    }

    /** @param list<string> $extra */
    private function syncDictionaryLanguages(Dictionary $dictionary, array $extra = []): void
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
            ->merge($extra)
            ->push($dictionary->lang ?: 'ru')
            ->map(fn ($lang) => $this->normalizeLang((string) $lang))
            ->filter()
            ->unique()
            ->values()
            ->all();

        $dictionary->forceFill(['translation_languages' => $languages])->save();
    }

    private function normalizeLang(string $lang): string
    {
        return strtolower(trim($lang));
    }

    /** @param array<string, string|null> $translationData @return array<string, string|null> */
    private function fillMissingTranslations(
        DictionaryWord $word,
        ?DictionaryWord $referenceWord,
        Dictionary $target,
        string $targetLang,
        string $referenceLang,
        string $model,
        array $translationData,
        bool $fillAllVariants,
    ): array {
        $fieldsToFill = $fillAllVariants ? ['translation_1', 'translation_2', 'translation_3'] : ['translation_1'];
        $missing = collect($fieldsToFill)
            ->filter(fn ($field) => trim((string) ($translationData[$field] ?? '')) === '')
            ->values()
            ->all();

        $referenceData = $referenceWord ? [
            'translation_1' => $referenceWord->translation_1,
            'translation_2' => $referenceWord->translation_2,
            'translation_3' => $referenceWord->translation_3,
            'translation_input_variable' => $referenceWord->translation_input_variable,
            'difficult_translation' => $referenceWord->difficult_translation,
            'info' => $referenceWord->info,
        ] : null;

        if (
            trim((string) ($translationData['info'] ?? '')) === ''
            && trim((string) ($referenceData['info'] ?? '')) !== ''
        ) {
            $missing[] = 'info';
        }

        if ($missing === []) {
            return $translationData;
        }

        $apiKey = config('services.openai.key') ?: env('OPENAI_API_KEY');
        if (! is_string($apiKey) || $apiKey === '') {
            if (! $this->warnedMissingOpenAiKey) {
                $this->warn('OpenAI key is missing, AI fill is skipped. Set OPENAI_API_KEY in Laravel .env.');
                $this->warnedMissingOpenAiKey = true;
            }

            return $translationData;
        }

        try {
            $response = Http::withToken($apiKey)
                ->timeout(45)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => $model,
                    'temperature' => 0.2,
                    'response_format' => ['type' => 'json_object'],
                    'messages' => [
                        [
                            'role' => 'system',
                            'content' => 'Return compact JSON only. Translate short dictionary entries concisely. Keep variant order aligned with the reference language: translation_1 means the same sense as reference translation_1, translation_2 matches reference translation_2, and translation_3 matches reference translation_3. For info, translate the human-visible HTML hint text and preserve valid HTML tags.',
                        ],
                        [
                            'role' => 'user',
                            'content' => json_encode([
                                'task' => 'Fill missing translation fields for a language learning dictionary.',
                                'learned_language' => $target->learn_lang,
                                'translation_language' => $targetLang,
                                'reference_translation_language' => $referenceLang,
                                'word_or_phrase' => $word->word,
                                'existing_translation_data' => $translationData,
                                'reference_translation_data' => $referenceData,
                                'missing_fields' => $missing,
                                'output_schema' => [
                                    'translation_1' => 'best short translation',
                                    'translation_2' => 'optional alternative',
                                    'translation_3' => 'optional alternative',
                                    'translation_input_variable' => 'comma-separated accepted answer variants',
                                    'difficult_translation' => 'optional hard/ambiguous translation hint',
                                    'info' => 'optional short HTML hint. Preserve valid HTML tags and translate only human-visible text.',
                                ],
                            ], JSON_UNESCAPED_UNICODE),
                        ],
                    ],
                ]);
        } catch (\Throwable $e) {
            $this->warn("OpenAI fill failed for word #{$word->id}: ".$e->getMessage());

            return $translationData;
        }

        if (! $response->successful()) {
            $this->warn("OpenAI fill failed for word #{$word->id}: HTTP {$response->status()}.");

            return $translationData;
        }

        $text = trim((string) data_get($response->json(), 'choices.0.message.content', ''));
        $decoded = json_decode($text, true);
        if (! is_array($decoded)) {
            $this->warn("OpenAI fill returned invalid JSON for word #{$word->id}.");

            return $translationData;
        }

        foreach (['translation_1', 'translation_2', 'translation_3', 'translation_input_variable', 'difficult_translation', 'info'] as $field) {
            if (array_key_exists($field, $decoded) && is_scalar($decoded[$field])) {
                $translationData[$field] = trim((string) $decoded[$field]) ?: null;
            }
        }

        return $translationData;
    }
}
