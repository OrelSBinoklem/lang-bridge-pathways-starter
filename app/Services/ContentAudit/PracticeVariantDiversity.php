<?php

namespace App\Services\ContentAudit;

/** Editorial selection only: never reads learner answers or changes authored content. */
class PracticeVariantDiversity
{
    public const VERSION = 'lemma-jaccard-triples-v1';
    private const STOP = 'es tu viņš viņa mēs jūs viņi viņas tas tā šis šī un vai bet ar no uz pie par ir būt ne jā nē arī tikai ļoti kā kas kur kad cik lai ka tad te tur viens divi trīs';

    public function __construct(private LatvianLemmaResolver $lemmas, private LessonTextExtractor $texts) {}

    public function vocabulary(array $config): array
    {
        $parts = [];
        foreach (['text', 'source_text', 'instruction', 'prompt', 'lesson_text', 'topic'] as $key) {
            if (is_string($config[$key] ?? null)) $parts[] = $config[$key];
        }
        if (! empty($config['dialogue_segments'])) {
            foreach ($config['dialogue_segments'] as $segment) $parts[] = $segment['text'] ?? '';
        } elseif (is_string($config['transcript'] ?? null)) {
            $parts[] = preg_replace('/^[AB]:\s*/m', '', $config['transcript']);
        }
        foreach ($config['questions'] ?? [] as $question) {
            $parts[] = is_string($question) ? $question : ($question['statement'] ?? $question['prompt'] ?? $question['text'] ?? '');
            if (is_array($question)) foreach ($question['options'] ?? [] as $option) if (is_string($option)) $parts[] = $option;
            if (is_array($question) && str_starts_with($config['task_kind'] ?? '', 'grammar_')) {
                foreach (['tokens', 'accepted_answers'] as $field) {
                    foreach ($question[$field] ?? [] as $word) if (is_string($word)) $parts[] = $word;
                }
            }
        }
        // Authored Latin examples are useful for productive tasks with Russian instructions.
        // Never use generated learner responses, explanations, audio paths or voice metadata.
        $productive = in_array($config['task_kind'] ?? '', ['ru_to_lv', 'roleplay', 'image_description', 'question_formation'], true);
        if ($productive && is_string($config['tutor_prompt'] ?? null)) $parts[] = $config['tutor_prompt'];
        if (($config['task_kind'] ?? '') === 'ru_to_lv' && is_string($config['reference_translation'] ?? null)) $parts[] = $config['reference_translation'];
        $known = $this->lemmas->index()['lemmas'];
        $stop = array_fill_keys(explode(' ', self::STOP), true);
        $words = []; $unknown = 0; $ambiguous = 0;
        foreach ($this->texts->tokens(implode("\n", $parts)) as $token) {
            $word = $token['key'];
            if (! preg_match('/^\p{Latin}[\p{Latin}\p{M}’\x{0027}-]*$/u', $word) || mb_strlen($word) < 2) continue;
            $resolution = $this->lemmas->resolve($word, $known, 'corpus');
            if (count($resolution['lemmas']) === 1) $word = $resolution['lemmas'][0];
            elseif (count($resolution['lemmas']) > 1) $ambiguous++;
            else {
                // Unknown capitalised names do not earn extra diversity just by changing a character.
                if (preg_match('/^\p{Lu}/u', $token['surface'])) continue;
                $unknown++;
            }
            if (! isset($stop[$word])) $words[$word] = true;
        }
        $basis = 'latvian_lemmas';
        if (count($words) < 3 && $productive) {
            $basis = 'instruction_fallback';
            foreach ($this->texts->tokens((string) ($config['instruction'] ?? $config['lesson_text'] ?? '')) as $token) {
                if (preg_match('/\p{Cyrillic}/u', $token['key']) && mb_strlen($token['key']) >= 4) $words['instruction:'.$token['key']] = true;
            }
        }
        ksort($words);

        return ['words' => array_keys($words), 'basis' => $basis, 'unknown' => $unknown, 'ambiguous' => $ambiguous];
    }

    /** Maximise mean pairwise Jaccard distance over every triple, not a greedy shortlist. */
    public function choose(array $variants): array
    {
        usort($variants, fn ($a, $b) => [$a['position'], $a['id']] <=> [$b['position'], $b['id']]);
        $vocabulary = [];
        foreach ($variants as $variant) $vocabulary[$variant['id']] = $this->vocabulary($variant['config']);
        $ids = array_column($variants, 'id');
        $sets = array_map(fn ($entry) => array_fill_keys($entry['words'], true), $vocabulary);
        $best = null; $selected = array_slice($ids, 0, 3);
        for ($a = 0; $a < count($ids) - 2; $a++) for ($b = $a + 1; $b < count($ids) - 1; $b++) for ($c = $b + 1; $c < count($ids); $c++) {
            $triple = [$ids[$a], $ids[$b], $ids[$c]]; $distances = [];
            foreach ([[$a, $b], [$a, $c], [$b, $c]] as [$left, $right]) {
                $x = $sets[$ids[$left]]; $y = $sets[$ids[$right]];
                $union = count($x + $y);
                // Missing vocabulary is not evidence of lexical diversity.
                $distances[] = $x && $y ? 1 - count(array_intersect_key($x, $y)) / $union : 0;
            }
            $score = [round(array_sum($distances) / 3, 10), round(min($distances), 10), count($sets[$triple[0]] + $sets[$triple[1]] + $sets[$triple[2]])];
            if ($best === null || $score > $best) { $best = $score; $selected = $triple; }
        }

        return ['algorithm' => self::VERSION, 'selected_ids' => $selected, 'archive_ids' => array_values(array_diff($ids, $selected)),
            'mean_distance' => $best[0] ?? null, 'min_distance' => $best[1] ?? null, 'vocabulary' => $vocabulary];
    }
}
