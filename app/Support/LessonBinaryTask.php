<?php

namespace App\Support;

use Illuminate\Validation\ValidationException;

final class LessonBinaryTask
{
    public const MIN_QUESTIONS = 3;

    public const MAX_QUESTIONS = 10;

    // Validate the shared question schema; reading/listening metadata belongs to the importer.
    public static function validate(mixed $config): void
    {
        $questions = is_array($config) ? ($config['questions'] ?? null) : null;
        if (! is_array($questions) || ! array_is_list($questions)
            || count($questions) < self::MIN_QUESTIONS || count($questions) > self::MAX_QUESTIONS) {
            throw ValidationException::withMessages([
                'config.questions' => 'В задании должно быть от 3 до 10 утверждений в последовательном массиве.',
            ]);
        }

        foreach ($questions as $index => $question) {
            if (! is_array($question)
                || ! is_string($question['statement'] ?? null) || trim($question['statement']) === ''
                || ! is_bool($question['correct'] ?? null)
                || (array_key_exists('explanation', $question) && ! is_string($question['explanation']))) {
                throw ValidationException::withMessages([
                    "config.questions.$index" => 'Нужны непустая строка statement, boolean correct и строка explanation, если она указана.',
                ]);
            }
        }

        if (array_key_exists('assisted_questions', $config)) {
            $translated = $config['assisted_questions'];
            if (! is_array($translated) || ! array_is_list($translated)
                || array_keys($translated) !== array_keys($questions)) {
                throw ValidationException::withMessages([
                    'config.assisted_questions' => 'Переводы должны быть последовательным массивом с теми же индексами, что и утверждения.',
                ]);
            }
            foreach ($translated as $index => $statement) {
                if (! is_string($statement) || trim($statement) === '') {
                    throw ValidationException::withMessages([
                        "config.assisted_questions.$index" => 'Перевод утверждения должен быть непустой строкой.',
                    ]);
                }
            }
        }
    }

    /** @return list<string> */
    public static function assistedQuestions(mixed $config): array
    {
        self::validate($config);
        if (! array_key_exists('assisted_questions', $config)) {
            throw ValidationException::withMessages(['config.assisted_questions' => 'Для этого варианта нет переводов утверждений.']);
        }

        return $config['assisted_questions'];
    }

    public static function validateAnswers(array $answers, int $questionCount): void
    {
        if (! array_is_list($answers) || count($answers) !== $questionCount) {
            throw ValidationException::withMessages(['answers' => 'Нужно ответить на все утверждения в последовательном массиве.']);
        }

        foreach ($answers as $index => $answer) {
            if (! is_bool($answer)) {
                throw ValidationException::withMessages(["answers.$index" => 'Ответ должен быть boolean: true или false.']);
            }
        }
    }
}
