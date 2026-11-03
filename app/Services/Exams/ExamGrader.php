<?php

namespace App\Services\Exams;

use App\Models\ExamAttempt;
use Illuminate\Support\Facades\{DB, Log};

class ExamGrader
{
    public function __construct(private ExamDefinition $definition, private ExamAi $ai) {}

    public function grade(int $id): void
    {
        $attempt = DB::transaction(function () use ($id) {
            $attempt = ExamAttempt::whereKey($id)->lockForUpdate()->firstOrFail();
            if ($attempt->grading_tries >= 3) return null;
            if ($attempt->status !== 'pending' && !($attempt->status === 'grading' && $attempt->grading_started_at?->lt(now()->subMinutes(10)))) return null;
            // A speech upload accepted before the deadline may still be transcribing.
            foreach ($attempt->answers as $answer) {
                if (isset($answer['processing']) && $attempt->updated_at->gt(now()->subMinutes(3))) return null;
            }
            $attempt->update(['status' => 'grading', 'grading_started_at' => now(), 'grading_error' => null, 'grading_tries' => $attempt->grading_tries + 1]);
            return $attempt;
        });
        if (!$attempt) return;
        try {
            $items = [];
            $checked = [];
            foreach ($attempt->snapshot['sections'] as $section) {
                foreach ($this->definition->questions($section) as $id => $q) {
                    $answer = trim($attempt->answers[$id]['text'] ?? '');
                    if (isset($attempt->answers[$id]['processing']) || isset($attempt->answers[$id]['processing_error'])) throw new \RuntimeException('Speech needs recovery');
                    if (in_array($q['type'], ['essay', 'speaking']) && $answer !== '') {
                        $items[] = ['id' => $id, 'skill' => $section['skill'], 'prompt' => $q['prompt'], 'context' => $q['context'], 'rubric' => $q['rubric'], 'maximum' => $q['points'], 'answer' => $answer];
                        if ($q['type'] === 'speaking' && isset($attempt->answers[$id]['transcript_candidates'])) {
                            $items[array_key_last($items)]['transcript_candidates'] = $attempt->answers[$id]['transcript_candidates'];
                        }
                    } else {
                        $correct = $q['type'] === 'choice' ? $answer === $q['correct'] : ($q['type'] === 'short' && in_array($this->normalize($answer), array_map($this->normalize(...), $q['accepted']), true));
                        $checked[$id] = ['points' => $correct ? $q['points'] : 0, 'feedback' => $correct ? 'Верно.' : ($answer === '' ? 'Нет ответа.' : ($q['explanation'] ?? 'Неверный ответ.')), 'example' => $q['type'] === 'short' ? implode(' / ', $q['accepted']) : ''];
                    }
                }
            }
            $checked += app(\App\Services\Credits\CreditContext::class)->run($attempt->user_id,
                fn () => ($attempt->snapshot['language'] ?? 'lv') === 'en'
                    ? $this->ai->assess($items, $attempt->snapshot['level'], 'en')
                    : $this->ai->assess($items, $attempt->snapshot['level']), 'exam_check', null, ['type' => 'exam_attempt', 'id' => $attempt->id]);
            $results = [];
            $total = $maximum = 0;
            $passed = true;
            foreach ($attempt->snapshot['sections'] as $section) {
                $points = $max = 0;
                $answers = [];
                foreach ($this->definition->questions($section) as $id => $q) {
                    $points += $checked[$id]['points'];
                    $max += $q['points'];
                    $answers[$id] = $checked[$id] + ['maximum' => $q['points']];
                }
                $sectionPassed = $points * 100 >= $max * 60;
                $passed = $passed && $sectionPassed;
                $results[] = ['skill' => $section['skill'], 'points' => $points, 'maximum' => $max, 'percent' => round($points * 100 / $max, 2), 'passed' => $sectionPassed, 'answers' => $answers];
                $total += $points;
                $maximum += $max;
            }
            $attempt->update(['status' => 'completed', 'results' => $results, 'passed' => $passed, 'score' => round(100 * $total / $maximum, 2), 'grading_error' => null]);
        } catch (\Throwable $error) {
            // Provider bodies can contain submitted work; log only class and attempt ID.
            Log::warning('Exam grading failed', ['attempt_id' => $attempt->id, 'exception' => get_class($error)]);
            $creditError = $error instanceof \App\Services\Credits\CreditException;
            $subscriptionError = $error instanceof \Illuminate\Http\Exceptions\HttpResponseException
                && $error->getResponse()->getStatusCode() === 402;
            $attempt->update(['status' => 'pending', 'grading_error' => $subscriptionError ? 'subscription_required' : ($creditError ? 'credits_unavailable' : 'grading_unavailable'),
                'grading_tries' => ($creditError || $subscriptionError) ? max(0, $attempt->grading_tries - 1) : $attempt->grading_tries]);
        }
    }

    private function normalize(string $text): string { return mb_strtolower(preg_replace('/\s+/u', ' ', trim($text))); }
}
