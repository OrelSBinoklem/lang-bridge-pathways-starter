<?php

namespace Tests\Feature;

use App\Services\Exams\ExamAi;
use App\Services\ProductivePracticeAssessment;
use Tests\TestCase;

class ProductivePracticeAssessmentTest extends TestCase
{
    public function test_course_rubric_is_level_specific_and_fractional_scores_never_become_false_diamond(): void
    {
        $this->mock(ExamAi::class, function ($mock) {
            $mock->shouldReceive('assess')->once()->withArgs(function ($items, $level, $language) {
                $this->assertSame('B2', $level); $this->assertSame('lv', $language);
                $this->assertSame('Actual learner words', $items[0]['answer']);
                $this->assertStringContainsString('no pronunciation', $items[0]['rubric']);
                $this->assertStringContainsString('natural alternatives deserve 100', $items[0]['rubric']);
                $this->assertStringContainsString('Introduce yourself', $items[0]['rubric']);
                return true;
            })->andReturn(['practice' => ['points' => 99.9, 'feedback' => 'Есть неточность.', 'recommendation' => 'Уточни форму.']]);
        });
        $grade = app(ProductivePracticeAssessment::class)->assess(['instruction' => 'Introduce yourself'], 'Actual learner words', 'speaking', 'B2', 'lv');
        $this->assertSame(99, $grade['score']);
    }
}
