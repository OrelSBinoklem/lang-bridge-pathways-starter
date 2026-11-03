<?php

namespace App\Services;

class GrammarTopicProgress
{
    public static function summary(array $blocks): array
    {
        $required = array_values(array_filter($blocks, fn ($block) => $block['is_required']));
        $scores = array_map(fn ($block) => (int) ($block['progress']['best_score'] ?? 0), $blocks);
        $requiredScores = array_map(fn ($block) => (int) ($block['progress']['best_score'] ?? 0), $required);
        $score = $scores ? (int) round(array_sum($scores) / count($scores)) : null;
        $passed = count(array_filter($requiredScores, fn ($value) => $value >= 60));
        $rank = $requiredScores && $passed === count($requiredScores) ? LessonProgressService::rankFor($score) : null;
        return [
            'total' => count($requiredScores),
            'passed' => $passed,
            'score' => $score, 'rank' => $rank, 'rank_label' => LessonProgressService::rankLabel($rank),
        ];
    }
}
