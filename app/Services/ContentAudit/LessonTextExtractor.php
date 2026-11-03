<?php

namespace App\Services\ContentAudit;

class LessonTextExtractor
{
    public function parts(array $config, string $scope = 'body'): array
    {
        $parts = [];
        $add = function (string $label, $value) use (&$parts): void {
            if (! is_string($value) || trim($value) === '') {
                return;
            }
            $text = trim(html_entity_decode(strip_tags($value), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            if ($text === '' || preg_match('/\p{Cyrillic}/u', $text)) {
                return;
            }
            $parts[] = ['label' => $label, 'text' => $text];
        };
        $kind = $config['task_kind'] ?? '';
        if (! empty($config['dialogue_segments'])) {
            foreach ($config['dialogue_segments'] as $index => $segment) {
                $add('Реплика '.($index + 1), $segment['text'] ?? null);
            }
        } elseif (! empty($config['transcript'])) {
            $add('Диалог', preg_replace('/^[AB]:\s*/m', '', $config['transcript']));
        }
        $add('Текст', $config['text'] ?? null);
        if ($kind !== 'ru_to_lv') {
            $add('Исходный текст', $config['source_text'] ?? null);
        }
        $add('Задание', $config['instruction'] ?? null);
        $add('Вопрос', $config['prompt'] ?? null);
        foreach ($config['items'] ?? [] as $item) {
            $add('Буква', $item['letter'] ?? null);
        }
        foreach ($config['questions'] ?? [] as $index => $question) {
            if (str_starts_with($kind, 'grammar_') || $scope === 'all') {
                $add('Вопрос '.($index + 1), str_replace('{{blank}}', '', $question['prompt'] ?? $question['statement'] ?? ''));
                if ($scope === 'all') {
                    foreach ($question['options'] ?? [] as $option) {
                        $add('Вариант ответа', $option);
                    }
                }
            }
        }
        if ($scope === 'all') {
            if ($kind === 'ru_to_lv') {
                $add('Эталон на латышском', $config['reference_translation'] ?? null);
            }
            foreach ($config['questions'] ?? [] as $question) {
                foreach ($question['accepted_answers'] ?? [] as $answer) {
                    $add('Эталон', $answer);
                }
                $add('Комментарий', $question['explanation'] ?? null);
            }
        }

        return $parts;
    }

    public function tokens(string $text): array
    {
        preg_match_all('/[\p{L}\p{M}]+(?:[-’\x{0027}][\p{L}\p{M}]+)*/u', $text, $matches, PREG_OFFSET_CAPTURE);

        return array_map(fn ($match) => ['surface' => $match[0], 'key' => LatvianLemmaResolver::normalize($match[0]), 'offset' => $match[1], 'length' => strlen($match[0])], $matches[0]);
    }

    public function units(string $text, array $known): array
    {
        $tokens = $this->tokens($text);
        $units = [];
        for ($i = 0; $i < count($tokens); $i++) {
            $unit = $tokens[$i];
            // Match dictionary phrases only across whitespace, never across punctuation.
            for ($size = min(8, count($tokens) - $i); $size > 1; $size--) {
                $last = $tokens[$i + $size - 1];
                $surface = substr($text, $unit['offset'], $last['offset'] + $last['length'] - $unit['offset']);
                $key = LatvianLemmaResolver::normalize($surface);
                if (! isset($known[$key])) {
                    continue;
                }
                $unit = ['surface' => $surface, 'key' => $key, 'offset' => $unit['offset'], 'length' => strlen($surface)];
                $i += $size - 1;
                break;
            }
            $units[] = $unit;
        }

        return $units;
    }
}
