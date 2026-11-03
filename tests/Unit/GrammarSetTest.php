<?php

namespace Tests\Unit;

use App\Services\GrammarTask;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class GrammarSetTest extends TestCase
{
    #[DataProvider('letterAnswers')]
    public function test_letter_sets_accept_compact_input_without_weakening_letter_checks(string $expected, string $answer, bool $correct): void
    {
        $config = ['task_kind' => 'grammar_set', 'questions' => [
            ['prompt' => 'Назови набор.', 'accepted_answers' => [$expected]],
        ]];
        $result = GrammarTask::grade($config, [$answer])[0];
        $this->assertSame($correct, $result['is_correct']);
        $this->assertSame($answer, $result['selected']);
        $this->assertSame($expected, $result['correct']);
    }

    public static function letterAnswers(): array
    {
        return [
            'screenshot compact answer' => ['Ģ Ķ Ļ Ņ', 'ķģļņ', true],
            'canonical compact' => ['Ģ Ķ Ļ Ņ', 'ģķļņ', true],
            'reversed uppercase' => ['Ģ Ķ Ļ Ņ', 'ŅĻĶĢ', true],
            'mixed case and separators' => ['Ģ Ķ Ļ Ņ', " ķģ, Ļ; Ņ\n", true],
            'nonbreaking space' => ['Ģ Ķ Ļ Ņ', "ķ\u{00A0}ģļņ", true],
            'decomposed diacritics' => ['Ģ Ķ Ļ Ņ', "k\u{0327}g\u{0327}l\u{0327}n\u{0327}", true],
            'sibilants' => ['Č Š Ž', 'žčš', true],
            'long vowels' => ['Ā Ē Ī Ū', 'ŪīēĀ', true],
            'missing letter' => ['Ģ Ķ Ļ Ņ', 'ķģļ', false],
            'extra letter' => ['Ģ Ķ Ļ Ņ', 'ķģļņč', false],
            'repeated letter' => ['Ģ Ķ Ļ Ņ', 'ķģļņņ', false],
            'repeated separated letter' => ['Ģ Ķ Ļ Ņ', 'ķģļņ, ņ', false],
            'unmarked letters' => ['Ģ Ķ Ļ Ņ', 'kgln', false],
            'one unmarked letter' => ['Ģ Ķ Ļ Ņ', 'ķgļņ', false],
            'cyrillic lookalike' => ['Ā Ē Ī Ū', 'āēīу', false],
            'punctuation is not a letter' => ['Ģ Ķ Ļ Ņ', 'ķģļņ.', false],
        ];
    }

    public function test_multiletter_items_and_other_grammar_kinds_preserve_token_boundaries(): void
    {
        foreach (['dz dž', 'ie ai ei ui oi au eu iu uo', 'labs slikts'] as $expected) {
            $config = ['task_kind' => 'grammar_set', 'questions' => [
                ['prompt' => 'Назови набор.', 'accepted_answers' => [$expected]],
            ]];
            $this->assertTrue(GrammarTask::grade($config, [implode(', ', array_reverse(explode(' ', $expected)))])[0]['is_correct']);
            $this->assertFalse(GrammarTask::grade($config, [str_replace(' ', '', $expected)])[0]['is_correct']);
        }
        $config = ['task_kind' => 'grammar_correct', 'questions' => [
            ['prompt' => 'Исправь предложение.', 'accepted_answers' => ['Man patīk lasīt.']],
        ]];
        $this->assertFalse(GrammarTask::grade($config, ['Manpatīklasīt.'])[0]['is_correct']);
    }
}
