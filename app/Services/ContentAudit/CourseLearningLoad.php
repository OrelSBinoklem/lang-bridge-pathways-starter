<?php

namespace App\Services\ContentAudit;

use RuntimeException;

class CourseLearningLoad
{
    private array $profiles;

    public function __construct(?array $profiles = null)
    {
        $this->profiles = $profiles ?? json_decode(file_get_contents(resource_path('course/difficulty-profiles.json')), true, 512, JSON_THROW_ON_ERROR);
        if (($this->profiles['schema_version'] ?? null) !== 1 || ! isset($this->profiles['levels'])) {
            throw new RuntimeException('Unsupported course learning-load profiles.');
        }
    }

    public function context(array $groups, array $group): ?array
    {
        if (! ($group['category_id'] ?? null) || ! isset($this->profiles['levels'][$group['level'] ?? ''])) {
            return null;
        }
        $peers = array_values(array_filter($groups, fn ($peer) => ($peer['level'] ?? null) === $group['level'] && ($peer['category_id'] ?? null)));
        usort($peers, fn ($a, $b) => [$a['position'], $a['id']] <=> [$b['position'], $b['id']]);
        $ids = array_column($peers, 'id');
        $index = array_search($group['id'], $ids, true);
        if ($index === false) {
            return null;
        }
        $fraction = count($peers) > 1 ? $index / (count($peers) - 1) : 0;
        $phase = $group['level'] === 'A1' && $index < 2 ? 'start' : ($fraction < 0.34 ? 'early' : ($fraction < 0.75 ? 'working' : 'exit'));

        return ['level' => $group['level'], 'phase' => $phase, 'topic_number' => $index + 1, 'topics_in_level' => count($peers),
            'limits' => $this->profiles['levels'][$group['level']][$phase]];
    }

    /** Measures learner input only. Private references and hypothetical answers are not analyzed. */
    public function inspect(array $config, string $skill, ?array $context): array
    {
        $kind = $config['task_kind'] ?? '';
        $body = '';
        $turns = [];
        if ($skill === 'listening') {
            foreach ($config['dialogue_segments'] ?? [] as $segment) {
                if (is_array($segment) && is_string($segment['text'] ?? null)) {
                    $turns[] = $segment['text'];
                }
            }
            $body = $turns ? implode("\n", $turns) : (string) ($config['transcript'] ?? '');
        } elseif ($skill === 'reading') {
            $body = (string) ($kind === 'lv_to_ru' ? ($config['source_text'] ?? '') : ($config['text'] ?? ''));
        }
        $conditions = implode("\n", array_filter([
            $config['instruction'] ?? $config['lesson_text'] ?? '', $config['topic'] ?? '',
        ], 'is_string'));
        $questions = [];
        foreach ($config['questions'] ?? [] as $question) {
            if (is_string($question)) {
                $questions[] = $question;
            } elseif (is_array($question)) {
                $questions[] = (string) ($question['statement'] ?? $question['prompt'] ?? $question['text'] ?? '');
            }
        }
        $sentences = preg_split('/[.!?\n]+/u', strip_tags($body), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $metrics = ['body_words' => $this->words($body), 'condition_words' => $this->words($conditions),
            'sentences' => count(array_filter($sentences, fn ($sentence) => $this->words($sentence) > 0)),
            'longest_sentence_words' => $this->longest($sentences), 'longest_question_words' => $this->longest($questions),
            'question_count' => count($questions), 'turn_count' => count($turns), 'longest_turn_words' => $turns ? $this->longest($turns) : null];
        $flags = [];
        $add = function (string $code, int $actual, int $limit, string $evidence = '') use (&$flags): void {
            if ($actual > $limit) {
                $flags[] = ['code' => $code, 'actual' => $actual, 'limit' => $limit, 'evidence' => $evidence];
            }
        };
        if ($context) {
            $limits = $context['limits'];
            $bodyLimit = $kind === 'lv_to_ru' ? $limits['translation_words'] : ($skill === 'listening' ? $limits['listening_words'] : $limits['reading_words']);
            $add('body_length', $metrics['body_words'], $bodyLimit);
            $add('sentence_length', $metrics['longest_sentence_words'], $limits['sentence_words'], $this->longestText($sentences));
            $add('question_length', $metrics['longest_question_words'], $limits['question_words'], $this->longestText($questions));
            if (in_array($kind, ['reading_binary', 'listening', 'listening_binary'], true)) {
                $add('question_count', $metrics['question_count'], $limits['questions']);
            }
            $add('condition_length', $metrics['condition_words'], $limits['condition_words']);
            if ($metrics['longest_turn_words'] !== null) {
                $add('turn_length', $metrics['longest_turn_words'], $limits['turn_words'], $this->longestText($turns));
            }
        }
        // These are visible language cues, not an assertion that grammar is new or incorrectly taught.
        preg_match_all('/(?:,\s*(?:kas|kurš|kura|kuru|kuram)\b|\b(?:tāpēc ka|kaut gan|lai gan|ja|jo)\b)/iu', $body, $matches);

        return ['schema_version' => 1, 'basis' => 'editorial_limits_not_cefr_or_mastery', 'context' => $context,
            'status' => ! $context ? 'unmapped' : ($flags ? 'review' : 'not_certified'), 'metrics' => $metrics, 'flags' => $flags,
            'grammar_cues' => array_values(array_unique(array_map('trim', $matches[0]))),
            'grammar_review' => 'not_verified', 'answer_requirement' => in_array($skill, ['writing', 'speaking'], true) ? 'not_inferred_from_unwritten_answer' : null];
    }

    private function words(string $text): int
    {
        return preg_match_all('/\p{L}[\p{L}\p{M}]*(?:[-\x{2019}\x{0027}][\p{L}\p{M}]+)*/u', html_entity_decode(strip_tags($text), ENT_QUOTES | ENT_HTML5, 'UTF-8')) ?: 0;
    }

    private function longest(array $parts): int
    {
        return $parts ? max(array_map(fn ($part) => $this->words($part), $parts)) : 0;
    }

    private function longestText(array $parts): string
    {
        usort($parts, fn ($a, $b) => $this->words($b) <=> $this->words($a));

        return trim($parts[0] ?? '');
    }
}
