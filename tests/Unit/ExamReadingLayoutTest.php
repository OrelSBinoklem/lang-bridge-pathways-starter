<?php

namespace Tests\Unit;

use App\Services\Exams\ExamReadingLayout;
use Tests\TestCase;

class ExamReadingLayoutTest extends TestCase
{
    private function tasks(string $level): array
    {
        $pack = json_decode(file_get_contents(resource_path('course/exams/revisions/2026-10-03-'.strtolower($level).'-reading.json')), true, flags: JSON_THROW_ON_ERROR);
        return array_map(fn ($v) => $v['replace_sections']['reading']['tasks'][$level === 'A2' ? 1 : 2], $pack['variants']);
    }

    public function test_all_a2_variants_use_three_explicit_four_advertisement_two_situation_sets(): void
    {
        foreach ($this->tasks('A2') as $task) {
            $before = $task;
            $view = app(ExamReadingLayout::class)->present('A2', $task);
            $this->assertCount(3, $view['reading_groups']);
            $this->assertStringContainsString('1. grupa', $view['text']);
            $covered = $texts = [];
            foreach ($view['reading_groups'] as $group) {
                $this->assertSame(['A','B','C','D'], array_column($group['announcements'], 'label'));
                $this->assertCount(2, $group['question_ids']);
                $texts = array_merge($texts, array_column($group['announcements'], 'text'));
                foreach ($group['question_ids'] as $id) {
                    $source = collect($task['questions'])->firstWhere('id', $id);
                    $question = collect($view['questions'])->firstWhere('id', $id);
                    $this->assertCount(4, $question['options']);
                    $this->assertSame(['A','B','C','D'], array_column($question['options'], 'text'));
                    $this->assertContains($source['correct'], array_column($question['options'], 'id'));
                    $this->assertSame($source['correct'], $question['correct']);
                    $this->assertSame($source['points'], $question['points']);
                    foreach ($question['options'] as $option) {
                        $sourceLetter = collect($source['options'])->firstWhere('id', $option['id'])['text'];
                        $this->assertStringContainsString($sourceLetter.'. '.collect($group['announcements'])->firstWhere('label', $option['text'])['text'], $task['text']);
                    }
                    $covered[] = $id;
                }
                foreach ($group['announcements'] as $announcement) $this->assertStringContainsString($announcement['label'].'. '.$announcement['text'], $view['text']);
            }
            $this->assertCount(8, array_unique($texts));
            $this->assertSame(array_column($task['questions'], 'id'), $covered);
            $this->assertSame($before, $task);
        }
    }

    public function test_all_b2_variants_keep_four_existing_four_text_two_statement_groups(): void
    {
        foreach ($this->tasks('B2') as $task) {
            $view = app(ExamReadingLayout::class)->present('B2', $task);
            $this->assertCount(4, $view['reading_groups']);
            $ids = [];
            foreach ($view['reading_groups'] as $group) {
                $this->assertCount(4, $group['announcements']);
                $this->assertCount(2, $group['question_ids']);
                foreach ($group['question_ids'] as $id) {
                    $source = collect($task['questions'])->firstWhere('id', $id);
                    $question = collect($view['questions'])->firstWhere('id', $id);
                    $this->assertSame(['A','B','C','D'], array_column($question['options'], 'text'));
                    $this->assertSame(array_column($source['options'], 'id'), array_column($question['options'], 'id'));
                    $this->assertSame($source['correct'], $question['correct']);
                    $ids[] = $id;
                }
            }
            $this->assertSame(array_column($task['questions'], 'id'), $ids);
        }
    }

    public function test_old_saved_answer_outside_new_subset_preserves_original_task(): void
    {
        $task = $this->tasks('A2')[0];
        $answers = [$task['questions'][0]['id'] => ['text' => '2']];
        $this->assertSame($task, app(ExamReadingLayout::class)->present('A2', $task, $answers));
        $accepted = [$task['questions'][0]['id'] => ['text' => $task['questions'][0]['correct']]];
        $this->assertArrayHasKey('reading_groups', app(ExamReadingLayout::class)->present('A2', $task, $accepted));
    }

    public function test_edited_sources_keys_and_unrelated_levels_are_not_guessed(): void
    {
        $task = $this->tasks('A2')[0];
        foreach (['A1','B1'] as $level) $this->assertSame($task, app(ExamReadingLayout::class)->present($level, $task));
        $changed = $task; $changed['text'] .= ' Admin edit.';
        $this->assertSame($changed, app(ExamReadingLayout::class)->present('A2', $changed));
        $changed = $task; $changed['questions'][0]['correct'] = '2';
        $this->assertSame($changed, app(ExamReadingLayout::class)->present('A2', $changed));
        $b2 = $this->tasks('B2')[0];
        $b2['questions'][0]['options'][0]['text'] = 'IV-A';
        $this->assertSame($b2, app(ExamReadingLayout::class)->present('B2', $b2));
        $b2 = $this->tasks('B2')[0];
        $b2['questions'][7]['options'][0]['text'] = 'I-A';
        $this->assertSame($b2, app(ExamReadingLayout::class)->present('B2', $b2));
    }

    public function test_review_letters_and_localized_explanations_use_the_same_relabeling(): void
    {
        $task = $this->tasks('A2')[0];
        $view = app(ExamReadingLayout::class)->present('A2', $task);
        $q = $view['questions'][0];
        $this->assertSame('D', collect($q['options'])->firstWhere('id', $q['correct'])['text']);
        $this->assertStringStartsWith('D ', $q['explanation']);
        $this->assertStringStartsWith('D ', $q['explanation_translations']['ru']);
        $this->assertStringStartsWith('D ', $q['explanation_translations']['uk']);
        $this->assertStringNotContainsString('H ', $q['explanation']);
    }

    public function test_a1_and_b1_authored_tasks_keep_their_shared_banks_and_question_counts(): void
    {
        foreach (['A1','B1'] as $level) {
            $variants = require resource_path('course/exams/'.strtolower($level).'.php');
            foreach ($variants as $variant) foreach ($variant['sections'][1]['tasks'] as $task) {
                $this->assertSame($task, app(ExamReadingLayout::class)->present($level, $task));
            }
        }
    }
}
