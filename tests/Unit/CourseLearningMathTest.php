<?php

namespace Tests\Unit;

use App\Services\CourseLearningGuide;
use Tests\TestCase;

class CourseLearningMathTest extends TestCase
{
    private function group(int $id, int $score): array
    {
        return ['id' => $id, 'skills' => ['grammar' => ['progress' => ['total' => 1, 'passed' => 0, 'best_score' => $score]]]];
    }

    public function test_group_uses_minimum_and_arithmetic_mean_of_practice_percentages(): void
    {
        $group = $this->group(1, 60);
        foreach (['listening', 'reading', 'writing', 'speaking'] as $skill) {
            $group['skills'][$skill]['progress'] = ['total' => 1, 'passed' => 1, 'best_score' => 80];
        }
        $levels = [['id' => 'A1', 'steps' => [['group_id' => 1, 'kind' => 'category', 'available' => true, 'total_words' => 10, 'learned_words' => 9]], 'groups' => [$group]]];
        $result = (new CourseLearningGuide)->annotate($levels, 80)[0]['groups'][0]['learning'];
        $this->assertSame(['words' => 90, 'grammar' => 60, 'practice' => 80], $result['parts']);
        $this->assertSame(60, $result['percent']);
        $this->assertTrue($result['active']);
    }

    public function test_four_twenty_percent_skills_mean_twenty_and_create_sixty_points_of_debt(): void
    {
        $group = $this->group(1, 90);
        foreach (['listening', 'reading', 'writing', 'speaking'] as $skill) {
            $group['skills'][$skill]['progress'] = ['total' => 1, 'passed' => 0, 'best_score' => 20];
        }
        $levels = [['id' => 'A1', 'steps' => [['group_id' => 1, 'kind' => 'category', 'available' => true,
            'total_words' => 10, 'learned_words' => 7]], 'groups' => [$group, $this->group(2, 100)]]];
        $groups = (new CourseLearningGuide)->annotate($levels, 80)[0]['groups'];
        $this->assertSame(['words' => 70, 'grammar' => 90, 'practice' => 20], $groups[0]['learning']['parts']);
        $this->assertSame(20, $groups[0]['learning']['percent']);
        $this->assertSame(60, $groups[1]['learning']['previous_debt']);
    }

    public function test_practice_mean_weights_skills_equally_omits_absent_skills_and_rounds_down(): void
    {
        $group = $this->group(1, 100);
        $group['skills'] += [
            'listening' => ['progress' => ['total' => 10, 'passed' => 0, 'best_score' => 31]],
            'reading' => ['progress' => ['total' => 1, 'passed' => 1, 'best_score' => 80]],
            'writing' => ['progress' => ['total' => 0, 'best_score' => 100]],
        ];
        $levels = [['id' => 'A1', 'steps' => [], 'groups' => [$group]]];
        $result = (new CourseLearningGuide)->annotate($levels, 80)[0]['groups'][0]['learning'];
        $this->assertSame(55, $result['parts']['practice']);
        $this->assertSame(55, $result['percent']);
    }

    public function test_two_empty_groups_plus_half_a_group_use_the_full_two_and_a_half_budget(): void
    {
        $levels = [['id' => 'A1', 'steps' => [], 'groups' => [
            $this->group(1, 0), $this->group(2, 0), $this->group(3, 40),
            $this->group(4, 79), $this->group(5, 0),
        ]]];
        $groups = (new CourseLearningGuide)->annotate($levels, 80)[0]['groups'];
        $this->assertSame(200, $groups[3]['learning']['previous_debt']);
        $this->assertTrue($groups[3]['learning']['active']);
        $this->assertSame(201, $groups[4]['learning']['previous_debt']);
        $this->assertFalse($groups[4]['learning']['active']);
    }

    public function test_debt_is_cumulative_across_levels_and_exact_limit_is_inclusive(): void
    {
        $levels = [['id' => 'A1', 'steps' => [], 'groups' => [$this->group(1, 0), $this->group(2, 0), $this->group(3, 40)]],
            ['id' => 'A2', 'steps' => [], 'groups' => [$this->group(4, 0), $this->group(5, 100)]]];
        $result = (new CourseLearningGuide)->annotate($levels, 80);
        $this->assertSame(200, $result[1]['groups'][0]['learning']['previous_debt']);
        $this->assertTrue($result[1]['groups'][0]['learning']['active']);
        $this->assertFalse($result[1]['groups'][1]['learning']['active']);
        $this->assertSame(280, $result[1]['groups'][1]['learning']['previous_debt']);
    }

    public function test_higher_scores_never_cancel_an_older_deficit_and_empty_placeholders_add_no_debt(): void
    {
        $levels = [['id' => 'A1', 'steps' => [], 'groups' => [$this->group(1, 0), ['id' => 2], $this->group(3, 100), $this->group(4, 0)]]];
        $result = (new CourseLearningGuide)->annotate($levels, 60)[0]['groups'];
        $this->assertFalse($result[1]['learning']['active']);
        $this->assertSame(60, $result[3]['learning']['previous_debt']);
        $this->assertTrue($result[3]['learning']['active']);
    }

    public function test_missing_materials_are_omitted_and_ungraded_productive_tasks_use_completion(): void
    {
        $levels = [['id' => 'A1', 'steps' => [], 'groups' => [['id' => 1, 'skills' => [
            'grammar' => ['progress' => ['total' => 0]],
            'speaking' => ['progress' => ['total' => 2, 'passed' => 1, 'best_score' => null]],
        ]]]]];
        $result = (new CourseLearningGuide)->annotate($levels, 80)[0]['groups'][0]['learning'];
        $this->assertSame(['practice' => 50], $result['parts']);
        $this->assertSame(50, $result['percent']);
    }
}
