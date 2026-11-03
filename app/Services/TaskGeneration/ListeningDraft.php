<?php

namespace App\Services\TaskGeneration;

use RuntimeException;

/** Validate the authored package before any database writes or paid requests. */
class ListeningDraft
{
    public function validate(array $draft, array $allowedWordIds): void
    {
        if (($draft['schema_version'] ?? null) !== 1 || count($draft['variants'] ?? []) !== 5) {
            throw new RuntimeException('Expected schema_version=1 and exactly five variants.');
        }
        foreach ($draft['variants'] as $index => $variant) {
            $fail = static function (string $message) use ($index): never {
                throw new RuntimeException('Variant '.($index + 1).': '.$message);
            };
            if (!is_string($variant['title'] ?? null) || trim($variant['title']) === '') $fail('missing title');
            foreach (['a', 'b'] as $speaker) {
                if (empty($variant['speakers'][$speaker]['name']) || !in_array($variant['speakers'][$speaker]['gender'] ?? null, ['male', 'female'], true)) $fail('invalid speaker profile');
                $profile = $variant['speakers'][$speaker];
                if (isset($profile['age_group']) && !in_array($profile['age_group'], ['young_adult', 'adult', 'older_adult'], true)) $fail('invalid speaker age group');
                if (isset($profile['delivery']) && (!is_string($profile['delivery']) || trim($profile['delivery']) === '' || mb_strlen($profile['delivery']) > 240)) $fail('invalid voice direction');
            }
            $ids = $variant['target_word_ids'] ?? [];
            if (!$ids || array_filter($ids, fn ($id) => !is_int($id)) || array_diff($ids, $allowedWordIds)) $fail('target IDs must belong to the selected category');
            $speakers = [];
            $characters = 0;
            foreach ($variant['segments'] ?? [] as $segment) {
                if (!is_array($segment) || count($segment) !== 2 || !in_array($segment[0], ['a', 'b'], true) || !is_string($segment[1]) || trim($segment[1]) === '') $fail('invalid dialogue segment');
                $speakers[$segment[0]] = true;
                $characters += mb_strlen(trim($segment[1]));
            }
            if (count($speakers) !== 2 || $characters > 2000) $fail('both speakers required, maximum 2000 spoken characters');
            $questions = $variant['questions'] ?? [];
            if (!is_array($questions) || !array_is_list($questions) || count($questions) < 3 || count($questions) > 10) $fail('three to ten questions required');
            foreach ($questions as $question) {
                if (!is_array($question) || count($question) !== 3 || !is_string($question[0]) || trim($question[0]) === '' || !is_bool($question[1]) || !is_string($question[2]) || trim($question[2]) === '') $fail('invalid question');
            }
            if (count(array_unique(array_column($questions, 0))) !== count($questions)
                || abs(2 * count(array_filter(array_column($questions, 1))) - count($questions)) > 1) $fail('distinct questions, balanced true and false required');
        }
    }

    public function config(array $variant): array
    {
        $segments = array_map(fn ($segment) => ['speaker' => $segment[0], 'text' => $segment[1]], $variant['segments']);
        return [
            'task_kind' => 'listening',
            'dialogue_segments' => $segments,
            'speaker_profiles' => $variant['speakers'],
            'transcript' => implode("\n", array_map(fn ($segment) => strtoupper($segment['speaker']).': '.$segment['text'], $segments)),
            'questions' => array_map(fn ($question) => ['statement' => $question[0], 'correct' => $question[1], 'explanation' => $question[2]], $variant['questions']),
        ];
    }
}
