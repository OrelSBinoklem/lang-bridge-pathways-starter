<?php

namespace App\Services;

use App\Services\Exams\ExamAi;
use RuntimeException;

/** Course practice uses the same grounded assessment and reference checks as exams. */
class ProductivePracticeAssessment
{
    public function assess(array $config, string $answer, string $skill, string $level, string $language): array
    {
        $rubric = 'Course practice, not an exam. Assess only the published task goals at CEFR '.$level.'. '
            .'Maximum 100: task fulfilment/meaning 0-50; comprehensibility and coherence 0-20; grammar and vocabulary appropriate to this level 0-30. '
            .'Do not require details, exact phrases, length or grammar absent from the task. Fully correct natural alternatives deserve 100; do not reserve perfect scores artificially. '
            .'For dialogue, assess the learner turns only; supplied answer must contain actual learner speech, never credit the tutor responses. '
            .'Speaking is transcript-only: no pronunciation or acoustic fluency assessment. Do not penalize uncertain recognition as a definite learner mistake. '
            .'For image tasks no image pixels are provided: assess only explicit task requirements, never invent visible details. '
            .'Explain the three criterion scores in feedback and give a specific next improvement when below 100. Task data: '
            .json_encode($config, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        $grade = app(ExamAi::class)->assess([['id' => 'practice', 'maximum' => 100, 'answer' => $answer,
            'skill' => $skill, 'prompt' => $config['instruction'] ?? $config['lesson_text'] ?? '',
            'type' => $skill === 'speaking' ? 'speaking' : 'essay', 'rubric' => $rubric]], $level, $language)['practice'] ?? null;
        if (!$grade || !is_numeric($grade['points'] ?? null) || $grade['points'] < 0 || $grade['points'] > 100) throw new RuntimeException('Invalid practice grade');
        // A fractional result below perfect must never become diamond through rounding.
        return $grade + ['score' => (int) floor($grade['points']), 'rubric_version' => 'productive-cefr-v1'];
    }
}
