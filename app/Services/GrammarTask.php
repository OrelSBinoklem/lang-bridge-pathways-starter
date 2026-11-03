<?php

namespace App\Services;

use Illuminate\Validation\ValidationException;

class GrammarTask
{
    public const KINDS = [
        'grammar_gap' => 'Грамматика: пропуск',
        'grammar_select' => 'Грамматика: выбор формы',
        'grammar_order' => 'Грамматика: порядок слов',
        'grammar_correct' => 'Грамматика: исправление ошибки',
        'grammar_set' => 'Грамматика: перечислить весь набор',
        'grammar_items' => 'Грамматика: элементы по одному',
    ];

    public static function validate(array $config): void
    {
        $fail = fn () => throw ValidationException::withMessages(['config' => 'Проверьте шаблон, вопросы и эталонные ответы задания грамматики.']);
        $kind = $config['task_kind'] ?? '';
        if ($kind === 'grammar_items') {
            $items = $config['items'] ?? null;
            if (!is_array($items) || !array_is_list($items) || count($items) < 1 || count($items) > 40) $fail();
            $keys = [];
            foreach ($items as $item) {
                if (!is_array($item) || !is_string($item['key'] ?? null) || !preg_match('/^[a-z0-9-]{1,64}$/', $item['key'])
                    || !is_string($item['letter'] ?? null) || trim($item['letter']) === ''
                    || !is_string($item['hint'] ?? null) || trim($item['hint']) === '') $fail();
                $keys[] = $item['key'];
            }
            if (count(array_unique($keys)) !== count($keys)) $fail();
            return;
        }
        $questions = $config['questions'] ?? null;
        if (!isset(self::KINDS[$kind]) || !is_array($questions) || !array_is_list($questions) || count($questions) < 1 || count($questions) > 30) $fail();
        foreach ($questions as $q) {
            if (!is_array($q) || !is_string($q['prompt'] ?? null) || trim($q['prompt']) === '') $fail();
            $accepted = $q['accepted_answers'] ?? null;
            if (!is_array($accepted) || !array_is_list($accepted) || !$accepted || count($accepted) > 20) $fail();
            foreach ($accepted as $answer) if (!is_string($answer) || trim($answer) === '') $fail();
            if ($kind === 'grammar_gap' && substr_count($q['prompt'], '{{blank}}') !== 1) $fail();
            if ($kind === 'grammar_set') {
                foreach ($accepted as $answer) if (count(self::setTokens($answer)) < 2) $fail();
            }
            if ($kind === 'grammar_select') {
                $options = $q['options'] ?? null;
                if (!is_array($options) || !array_is_list($options) || count($options) < 2 || count($options) > 12) $fail();
                foreach ($options as $option) if (!is_string($option) || trim($option) === '') $fail();
                if (count(array_unique($options)) !== count($options) || array_diff($accepted, $options)) $fail();
            }
            if ($kind === 'grammar_order') {
                $tokens = $q['tokens'] ?? null;
                if (!is_array($tokens) || !array_is_list($tokens) || count($tokens) < 2 || count($tokens) > 30) $fail();
                foreach ($tokens as $token) if (!is_string($token) || trim($token) === '') $fail();
                $bag = self::wordBag(implode(' ', $tokens));
                foreach ($accepted as $answer) if (self::wordBag($answer) !== $bag) $fail();
            }
        }
    }

    private static function wordBag(string $text): array
    {
        $words = preg_split('/\s+/u', trim(preg_replace('/([,.!?;:])/u', ' $1 ', self::normalize($text))), -1, PREG_SPLIT_NO_EMPTY);
        sort($words);
        return $words;
    }

    public static function normalize(string $text): string
    {
        if (class_exists(\Normalizer::class)) $text = \Normalizer::normalize($text, \Normalizer::FORM_C);
        $text = mb_strtolower(trim($text), 'UTF-8');
        $text = preg_replace('/\s+([,.!?;:])/u', '$1', $text);
        return preg_replace('/\s+/u', ' ', $text);
    }

    private static function setTokens(string $text, bool $splitLetters = false): array
    {
        $tokens = preg_split('/[\s,;]+/u', self::normalize($text), -1, PREG_SPLIT_NO_EMPTY);
        if ($splitLetters) {
            preg_match_all('/\X/u', implode('', $tokens), $matches);
            $tokens = $matches[0];
        }
        if (count($tokens) !== count(array_unique($tokens))) return [];
        sort($tokens);
        return $tokens;
    }

    private static function matchesSet(string $answer, string $expected): bool
    {
        $expectedTokens = self::setTokens($expected);
        if ($expectedTokens === []) return false;
        // Compact input is unambiguous only for sets of single letters, not words or digraphs.
        $lettersOnly = count(array_filter($expectedTokens, fn ($token) => mb_strlen($token, 'UTF-8') === 1)) === count($expectedTokens);
        return self::setTokens($answer, $lettersOnly) === $expectedTokens;
    }

    public static function clientConfig(array $config): array
    {
        self::validate($config);
        if ($config['task_kind'] === 'grammar_items') {
            return ['task_kind' => 'grammar_items', 'instruction' => (string) ($config['instruction'] ?? ''), 'items' => []];
        }
        return [
            'task_kind' => $config['task_kind'],
            'instruction' => (string) ($config['instruction'] ?? ''),
            'questions' => array_map(fn ($q) => array_intersect_key($q, array_flip(['prompt', 'options', 'tokens'])), $config['questions']),
        ];
    }

    public static function grade(array $config, array $answers): array
    {
        self::validate($config);
        if ($config['task_kind'] === 'grammar_items') {
            throw ValidationException::withMessages(['answers' => 'Буквы проверяются по одной.']);
        }
        if (!array_is_list($answers) || count($answers) !== count($config['questions'])) {
            throw ValidationException::withMessages(['answers' => 'Ответьте на все вопросы задания.']);
        }
        $checked = [];
        foreach ($config['questions'] as $index => $q) {
            $answer = $answers[$index];
            if (!is_string($answer) || trim($answer) === '' || mb_strlen($answer) > 2000) {
                throw ValidationException::withMessages(['answers' => 'Ответ должен быть непустым текстом до 2000 символов.']);
            }
            if ($config['task_kind'] === 'grammar_select' && !in_array($answer, $q['options'], true)) {
                throw ValidationException::withMessages(['answers' => 'Выберите один из предложенных ответов.']);
            }
            $checked[] = [
                'statement' => $q['prompt'], 'selected' => $answer,
                'correct' => $q['accepted_answers'][0],
                'is_correct' => $config['task_kind'] === 'grammar_set'
                    ? in_array(true, array_map(fn ($expected) => self::matchesSet($answer, $expected), $q['accepted_answers']), true)
                    : in_array(self::normalize($answer), array_map(self::normalize(...), $q['accepted_answers']), true),
                'explanation' => (string) ($q['explanation'] ?? ''),
            ];
        }
        return $checked;
    }
}
