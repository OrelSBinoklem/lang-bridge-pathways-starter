<?php

namespace App\Console\Commands;

use App\Services\TaskGeneration\UserVocabularyProgressContext;
use App\Services\TaskGeneration\ElaipaVocabularyStatistics;
use App\Services\TaskGeneration\VocabularyUnion;
use App\Services\TutorCategoryVocabularyContext;
use Illuminate\Console\Command;
use JsonException;

/** Read-only JSON contract for an offline or server-side task-generation agent. */
class TaskGeneratorContext extends Command
{
    protected $signature = 'task-generator:context
        {category_id : Category for the generated task}
        {--user_id= : User whose learned and started vocabulary is needed}
        {--shared : Generate a shared course context without personal progress}
        {--compact : Return deduplicated vocabulary and minimal progress fields}
        {--elaipa-level= : Exact E-Laipa level key, used with --elaipa-topic}
        {--elaipa-topic= : Exact E-Laipa topic key, never inferred from a translated title}
        {--dictionary_id= : Optional dictionary guard; must match the category}';

    protected $description = 'Print category vocabulary and one user’s scored-word context as JSON for task generation';

    public function handle(TutorCategoryVocabularyContext $categoryVocabulary, UserVocabularyProgressContext $userVocabulary, ElaipaVocabularyStatistics $statistics): int
    {
        $userId = filter_var($this->option('user_id'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ((! $this->option('shared') && $userId === false) || ($this->option('shared') && $this->option('user_id') !== null)) {
            $this->error('Choose either --shared or --user_id=<positive integer>, not both.');

            return self::INVALID;
        }

        $categoryId = filter_var($this->argument('category_id'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($categoryId === false) {
            $this->error('category_id must be a positive integer.');
            return self::INVALID;
        }
        $dictionaryOption = $this->option('dictionary_id');
        $dictionaryId = $dictionaryOption === null || $dictionaryOption === '' ? null : filter_var($dictionaryOption, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($dictionaryId === false) {
            $this->error('The --dictionary_id option must be a positive integer.');

            return self::INVALID;
        }

        try {
            if ((bool) $this->option('elaipa-level') !== (bool) $this->option('elaipa-topic')) {
                $this->error('Provide both --elaipa-level and --elaipa-topic.');
                return self::INVALID;
            }
            $category = $categoryVocabulary->build($categoryId, $dictionaryId ?: null);
            $progress = $this->option('shared') ? null : $userVocabulary->build($userId, (int) $category['dictionary_id']);
            $allWords = collect([...$category['prior_words'], ...$category['current_words'], ...($progress['words_with_score'] ?? [])])->keyBy('id');
            $currentIds = array_column($category['current_words'], 'id');
            $learnedIds = array_column($progress['learned_words'] ?? [], 'id');
            $frequencyForms = $statistics->forText($allWords->pluck('word')->implode(' '));
            $result = [
                'mode' => $this->option('shared') ? 'shared_course' : 'personal',
                'category_vocabulary' => $category,
                // Full dictionary progress lets a generator safely recycle vocabulary
                // from earlier steps as well as avoid already-mastered current words.
                'user_vocabulary_progress' => $progress,
                'frequency_source' => $statistics->metadata(),
                'frequency_forms' => $frequencyForms,
                'target_word_ids' => $currentIds,
                'not_fully_learned_target_ids' => $progress === null ? null : array_values(array_diff($currentIds, $learnedIds)),
            ];
            if ($this->option('elaipa-topic')) {
                $result['elaipa_topic_reference'] = $statistics->topic($this->option('elaipa-level'), $this->option('elaipa-topic'));
            }
            if ($this->option('compact')) {
                unset($result['category_vocabulary']['prior_words'], $result['category_vocabulary']['current_words']);
                $result['vocabulary_union'] = (new VocabularyUnion)->build($category, $progress, $result['elaipa_topic_reference'] ?? null);
                unset($result['elaipa_topic_reference']['words']);
                $result['user_vocabulary_progress'] = $progress === null ? null : [
                    'user_id' => $progress['user_id'], 'criteria' => $progress['criteria'], 'counts' => $progress['counts'],
                    'learned_categories' => $progress['learned_categories'],
                ];
            }
            $this->output->write(json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR).PHP_EOL);
        } catch (JsonException|\RuntimeException $exception) {
            $this->error('Unable to prepare task-generation context: '.$exception->getMessage());

            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}
