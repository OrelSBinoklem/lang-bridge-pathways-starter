<?php

namespace Tests\Unit;

use App\Services\ContentAudit\CourseLearningLoad;
use PHPUnit\Framework\TestCase;

class CourseLearningLoadTest extends TestCase
{
    private function load(): CourseLearningLoad
    {
        return new CourseLearningLoad(json_decode(file_get_contents(__DIR__.'/../../resources/course/difficulty-profiles.json'), true, 512, JSON_THROW_ON_ERROR));
    }

    private function context(): array
    {
        $group = ['id' => 7, 'category_id' => 1763, 'level' => 'A1', 'position' => 50];

        return $this->load()->context([$group], $group);
    }

    public function test_position_is_relative_to_level_and_does_not_use_a_category_number(): void
    {
        $groups = [['id' => 1, 'category_id' => 800, 'level' => 'A1', 'position' => 0],
            ['id' => 2, 'category_id' => null, 'level' => 'A2', 'position' => 10],
            ['id' => 3, 'category_id' => 999, 'level' => 'A2', 'position' => 20],
            ['id' => 4, 'category_id' => 2, 'level' => 'A2', 'position' => 30],
            ['id' => 5, 'category_id' => 3, 'level' => 'A2', 'position' => 40]];
        $context = $this->load()->context($groups, $groups[2]);
        $this->assertSame('early', $context['phase']);
        $this->assertSame(1, $context['topic_number']);
        $this->assertSame(3, $context['topics_in_level']);
        $this->assertSame('exit', $this->load()->context($groups, $groups[4])['phase']);
        $this->assertNull($this->load()->context($groups, $groups[1]));
    }

    public function test_reading_and_questions_are_measured_separately_with_evidence(): void
    {
        $report = $this->load()->inspect(['task_kind' => 'reading_binary', 'text' => 'Labdien! Mani sauc Anna.',
            'questions' => array_fill(0, 10, ['statement' => 'Anna šodien dodas uz universitāti lai satiktu drauga jaunāko māsu.']),
            'reference_translation' => str_repeat('Noslēpums ', 90), 'bot_prompt' => str_repeat('Noslēpums ', 90),
            'prompt' => str_repeat('Noslēpums ', 90)], 'reading', $this->context());
        $this->assertSame(4, $report['metrics']['body_words']);
        $this->assertSame(10, $report['metrics']['longest_question_words']);
        $this->assertSame(['question_length', 'question_count'], array_column($report['flags'], 'code'));
        $this->assertStringContainsString('universitāti', $report['flags'][0]['evidence']);
        $this->assertSame('not_verified', $report['grammar_review']);
        $this->assertSame(0, $report['metrics']['condition_words']);
    }

    public function test_short_translation_has_its_own_limit_and_is_not_certified_by_length(): void
    {
        $report = $this->load()->inspect(['task_kind' => 'lv_to_ru', 'source_text' => 'Labdien! Mani sauc Anna.',
            'reference_translation' => str_repeat('А ', 200)], 'reading', $this->context());
        $this->assertSame([], $report['flags']);
        $this->assertSame('not_certified', $report['status']);
        $long = $this->load()->inspect(['task_kind' => 'lv_to_ru', 'source_text' => str_repeat('Anna ', 13)], 'reading', $this->context());
        $this->assertSame(12, $long['flags'][0]['limit']);
    }

    public function test_listening_measures_turns_without_synthesizing_unknown_audio_or_answers(): void
    {
        $report = $this->load()->inspect(['dialogue_segments' => [['text' => str_repeat('Anna ', 14)], ['text' => 'Labdien!']],
            'transcript' => str_repeat('Ignored ', 100)], 'listening', $this->context());
        $this->assertSame(15, $report['metrics']['body_words']);
        $this->assertSame(2, $report['metrics']['turn_count']);
        $this->assertContains('turn_length', array_column($report['flags'], 'code'));
        $productive = $this->load()->inspect(['instruction' => 'Ответь: Kā tev iet?', 'source_text' => str_repeat('Secret ', 100)], 'writing', $this->context());
        $this->assertSame(4, $productive['metrics']['condition_words']);
        $this->assertSame(0, $productive['metrics']['body_words']);
        $this->assertSame('not_inferred_from_unwritten_answer', $productive['answer_requirement']);
    }

    public function test_unmapped_context_keeps_measurements_but_does_not_invent_thresholds(): void
    {
        $report = $this->load()->inspect(['text' => 'Es dzīvoju Rīgā.'], 'reading', null);
        $this->assertSame('unmapped', $report['status']);
        $this->assertSame([], $report['flags']);
        $this->assertSame(3, $report['metrics']['body_words']);
    }
}
